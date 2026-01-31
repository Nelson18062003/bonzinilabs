import { parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Canonical payment steps in order
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

export interface PaymentTimelineStepUI {
  id: string;
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
  formattedDate?: string;
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
 * Build UI timeline steps from payment status and timeline events
 * Shows all canonical steps with proper completed/current/pending status
 */
export function buildPaymentTimelineSteps(
  paymentStatus: string,
  paymentMethod: string,
  events: PaymentTimelineEvent[] = []
): PaymentTimelineStepUI[] {
  // Map events by event_type for quick lookup
  const eventMap = new Map<string, PaymentTimelineEvent>();
  events.forEach(event => {
    // Use the first event of each type (earliest)
    if (!eventMap.has(event.event_type)) {
      eventMap.set(event.event_type, event);
    }
  });

  // If rejected, show different flow
  if (paymentStatus === 'rejected') {
    return buildRejectedTimeline(paymentMethod, eventMap);
  }

  // Use cash steps for cash payments
  const steps = paymentMethod === 'cash' ? CASH_PAYMENT_STEPS : PAYMENT_STEPS;

  // Find current step index based on payment status
  const currentStepIndex = steps.findIndex(step => step.key === paymentStatus);

  // For cash_pending status (mapped from created for cash payments)
  let effectiveCurrentIndex = currentStepIndex;
  if (paymentMethod === 'cash' && paymentStatus === 'created') {
    effectiveCurrentIndex = steps.findIndex(step => step.key === 'cash_pending');
    if (effectiveCurrentIndex === -1) effectiveCurrentIndex = 0;
  }

  return steps.map((step, index) => {
    let status: 'completed' | 'current' | 'pending';

    if (effectiveCurrentIndex === -1) {
      // Status not found in steps, mark first as current
      status = index === 0 ? 'current' : 'pending';
    } else if (index < effectiveCurrentIndex) {
      status = 'completed';
    } else if (index === effectiveCurrentIndex) {
      status = 'current';
    } else {
      status = 'pending';
    }

    // Get timestamp from events if available
    const event = eventMap.get(step.key);
    const timestamp = event?.created_at;

    return {
      id: `step-${step.key}`,
      key: step.key,
      label: step.label,
      description: event?.description || step.description,
      status,
      timestamp,
      formattedDate: safeFormatDate(timestamp),
    };
  });
}

/**
 * Build timeline for rejected payments
 */
function buildRejectedTimeline(paymentMethod: string, eventMap: Map<string, PaymentTimelineEvent>): PaymentTimelineStepUI[] {
  // Show steps up to rejection
  const stepsBeforeReject = paymentMethod === 'cash'
    ? ['created', 'cash_pending', 'cash_scanned']
    : ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing'];

  const steps = paymentMethod === 'cash' ? CASH_PAYMENT_STEPS : PAYMENT_STEPS;
  const result: PaymentTimelineStepUI[] = [];

  for (const stepKey of stepsBeforeReject) {
    const stepDef = steps.find(s => s.key === stepKey);
    if (!stepDef) continue;

    const event = eventMap.get(stepKey);

    // If we have an event for this step, it was completed
    if (event) {
      result.push({
        id: `step-${stepKey}`,
        key: stepKey,
        label: stepDef.label,
        description: event.description || stepDef.description,
        status: 'completed',
        timestamp: event.created_at,
        formattedDate: safeFormatDate(event.created_at),
      });
    }
  }

  // Add rejected step as current
  const rejectedEvent = eventMap.get('rejected');
  result.push({
    id: 'step-rejected',
    key: 'rejected',
    label: REJECTED_STEP.label,
    description: rejectedEvent?.description || REJECTED_STEP.description,
    status: 'current',
    timestamp: rejectedEvent?.created_at,
    formattedDate: safeFormatDate(rejectedEvent?.created_at),
  });

  return result;
}

/**
 * Get icon name for a payment step (for use with lucide-react)
 */
export function getPaymentStepIconName(stepKey: string, status: 'completed' | 'current' | 'pending'): string {
  if (status === 'completed') return 'Check';

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
export function getPaymentStepColors(stepKey: string, status: 'completed' | 'current' | 'pending'): string {
  if (status === 'completed') {
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
