import { parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Canonical payment steps in order (main flow)
export const PAYMENT_STEPS = [
  { key: 'created', label: 'Paiement créé', description: 'Le montant a été réservé sur votre solde' },
  { key: 'waiting_beneficiary_info', label: 'Infos en attente', description: 'Ajoutez les informations du bénéficiaire' },
  { key: 'ready_for_payment', label: 'Prêt à payer', description: 'Bonzini va procéder au paiement' },
  { key: 'processing', label: 'En cours', description: 'Paiement en cours de traitement' },
  { key: 'completed', label: 'Terminé', description: 'Paiement effectué avec succès' },
] as const;

// Cash-specific payment steps
export const CASH_PAYMENT_STEPS = [
  { key: 'created', label: 'QR Code généré', description: 'Présentez ce QR code au bureau Bonzini' },
  { key: 'cash_pending', label: 'En attente', description: 'Rendez-vous au bureau avec le QR code' },
  { key: 'cash_scanned', label: 'Scanné', description: 'QR code validé au bureau' },
  { key: 'completed', label: 'Cash remis', description: 'Vous avez reçu votre argent' },
] as const;

export const REJECTED_STEP = {
  key: 'rejected',
  label: 'Paiement refusé',
  description: 'Le montant a été recrédité sur votre solde'
};

// Event type configurations for display
export const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  created: { label: 'Création', icon: 'Clock', color: 'primary' },
  waiting_info: { label: 'En attente', icon: 'User', color: 'yellow' },
  info_provided: { label: 'Infos ajoutées', icon: 'CheckCircle', color: 'green' },
  info_updated: { label: 'Infos modifiées', icon: 'Edit', color: 'blue' },
  instructions_uploaded: { label: 'Instructions', icon: 'Upload', color: 'blue' },
  ready_for_payment: { label: 'Prêt', icon: 'CheckCircle', color: 'purple' },
  processing: { label: 'En cours', icon: 'Loader2', color: 'orange' },
  proof_uploaded: { label: 'Preuve Bonzini', icon: 'Image', color: 'green' },
  completed: { label: 'Terminé', icon: 'CheckCircle2', color: 'green' },
  rejected: { label: 'Refusé', icon: 'XCircle', color: 'red' },
  cash_pending: { label: 'QR Généré', icon: 'QrCode', color: 'cyan' },
  cash_scanned: { label: 'Scanné', icon: 'ScanLine', color: 'orange' },
};

export interface PaymentTimelineStepUI {
  id: string;
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
  formattedDate?: string;
  isExtraEvent?: boolean; // For events not in canonical flow
}

export interface PaymentTimelineEvent {
  id: string;
  payment_id: string;
  event_type: string;
  description: string;
  performed_by: string | null;
  created_at: string;
}

/**
 * Safely format a date string, returns undefined if invalid
 */
export function safeFormatDate(dateStr: string | undefined | null, formatStr: string = 'dd MMM yyyy, HH:mm'): string | undefined {
  if (!dateStr) return undefined;

  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return undefined;
    return format(date, formatStr, { locale: fr });
  } catch {
    return undefined;
  }
}

/**
 * Build UI timeline showing ALL events in chronological order
 * This provides a complete audit trail of the payment lifecycle
 */
export function buildPaymentTimelineSteps(
  paymentStatus: string,
  paymentMethod: string,
  events: PaymentTimelineEvent[] = []
): PaymentTimelineStepUI[] {
  // If rejected, use special timeline
  if (paymentStatus === 'rejected') {
    return buildRejectedTimeline(paymentMethod, events);
  }

  // If no events, use canonical steps only
  if (events.length === 0) {
    return buildCanonicalSteps(paymentStatus, paymentMethod);
  }

  // Build event-based timeline showing ALL events
  return buildEventBasedTimeline(paymentStatus, paymentMethod, events);
}

/**
 * Build canonical steps when no events exist
 */
function buildCanonicalSteps(paymentStatus: string, paymentMethod: string): PaymentTimelineStepUI[] {
  const steps = paymentMethod === 'cash' ? CASH_PAYMENT_STEPS : PAYMENT_STEPS;

  let currentStepIndex = steps.findIndex(step => step.key === paymentStatus);

  // Handle cash_pending mapping for cash payments
  if (paymentMethod === 'cash' && paymentStatus === 'created') {
    currentStepIndex = steps.findIndex(step => step.key === 'cash_pending');
    if (currentStepIndex === -1) currentStepIndex = 0;
  }

  return steps.map((step, index) => {
    let status: 'completed' | 'current' | 'pending';

    if (currentStepIndex === -1) {
      status = index === 0 ? 'current' : 'pending';
    } else if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
      status = 'current';
    } else {
      status = 'pending';
    }

    return {
      id: `step-${step.key}`,
      key: step.key,
      label: step.label,
      description: step.description,
      status,
    };
  });
}

/**
 * Build event-based timeline showing ALL recorded events
 */
function buildEventBasedTimeline(
  paymentStatus: string,
  paymentMethod: string,
  events: PaymentTimelineEvent[]
): PaymentTimelineStepUI[] {
  const result: PaymentTimelineStepUI[] = [];
  const steps = paymentMethod === 'cash' ? CASH_PAYMENT_STEPS : PAYMENT_STEPS;
  const processedEvents = new Set<string>();

  // Sort events by created_at
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Map to find step index by key
  const stepIndexMap = new Map(steps.map((s, i) => [s.key, i]));

  // Find current step index
  let currentStepIndex = stepIndexMap.get(paymentStatus) ?? -1;
  if (paymentMethod === 'cash' && paymentStatus === 'created') {
    currentStepIndex = stepIndexMap.get('cash_pending') ?? 0;
  }

  // Process each event
  for (const event of sortedEvents) {
    const eventKey = event.event_type;
    const config = EVENT_TYPE_CONFIG[eventKey];
    const stepDef = steps.find(s => s.key === eventKey);

    // Determine if this is a main step or extra event
    const isMainStep = stepDef !== undefined;
    const stepIndex = stepIndexMap.get(eventKey);

    let status: 'completed' | 'current' | 'pending' = 'completed';

    if (isMainStep && stepIndex !== undefined) {
      if (stepIndex < currentStepIndex) {
        status = 'completed';
      } else if (stepIndex === currentStepIndex) {
        status = paymentStatus === eventKey ? 'current' : 'completed';
      } else {
        status = 'pending';
      }
    }

    result.push({
      id: event.id,
      key: eventKey,
      label: config?.label || stepDef?.label || eventKey,
      description: event.description,
      status,
      timestamp: event.created_at,
      formattedDate: safeFormatDate(event.created_at),
      isExtraEvent: !isMainStep,
    });

    processedEvents.add(eventKey);
  }

  // Add future canonical steps that haven't occurred yet
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Skip if we already have an event for this step
    if (processedEvents.has(step.key)) continue;

    // Only add if it's after current status
    if (i > currentStepIndex) {
      result.push({
        id: `step-${step.key}`,
        key: step.key,
        label: step.label,
        description: step.description,
        status: 'pending',
      });
    }
  }

  return result;
}

/**
 * Build timeline for rejected payments
 */
function buildRejectedTimeline(
  paymentMethod: string,
  events: PaymentTimelineEvent[]
): PaymentTimelineStepUI[] {
  const result: PaymentTimelineStepUI[] = [];

  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Add all events as completed (except the rejected one)
  for (const event of sortedEvents) {
    const eventKey = event.event_type;
    const config = EVENT_TYPE_CONFIG[eventKey];
    const isRejected = eventKey === 'rejected';

    result.push({
      id: event.id,
      key: eventKey,
      label: config?.label || eventKey,
      description: event.description,
      status: isRejected ? 'current' : 'completed',
      timestamp: event.created_at,
      formattedDate: safeFormatDate(event.created_at),
    });
  }

  // If no rejected event in DB, add it manually
  if (!sortedEvents.some(e => e.event_type === 'rejected')) {
    result.push({
      id: 'step-rejected',
      key: 'rejected',
      label: REJECTED_STEP.label,
      description: REJECTED_STEP.description,
      status: 'current',
    });
  }

  return result;
}

/**
 * Get icon name for a payment step (for use with lucide-react)
 */
export function getPaymentStepIconName(stepKey: string, status: 'completed' | 'current' | 'pending'): string {
  if (status === 'completed') return 'Check';

  const config = EVENT_TYPE_CONFIG[stepKey];
  if (config) return config.icon;

  switch (stepKey) {
    case 'created': return 'Clock';
    case 'waiting_beneficiary_info': return 'User';
    case 'ready_for_payment': return 'CheckCircle';
    case 'processing': return 'Loader2';
    case 'completed': return 'CheckCircle2';
    case 'cash_pending': return 'QrCode';
    case 'cash_scanned': return 'ScanLine';
    case 'rejected': return 'XCircle';
    default: return 'Clock';
  }
}

/**
 * Get color classes for a payment step
 */
export function getPaymentStepColors(stepKey: string, status: 'completed' | 'current' | 'pending', isExtraEvent?: boolean): string {
  if (status === 'completed') {
    // Extra events get a subtle different style
    if (isExtraEvent) {
      return 'bg-blue-100 text-blue-600 border-blue-300';
    }
    return 'bg-primary text-primary-foreground border-primary';
  }

  if (status === 'current') {
    if (stepKey === 'rejected') {
      return 'bg-destructive/10 text-destructive border-destructive animate-pulse';
    }
    if (stepKey === 'completed') {
      return 'bg-emerald-100 text-emerald-600 border-emerald-500 animate-pulse';
    }
    return 'bg-primary/10 text-primary border-primary animate-pulse';
  }

  // pending
  return 'bg-muted text-muted-foreground border-muted';
}
