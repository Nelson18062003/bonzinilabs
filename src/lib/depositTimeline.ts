import { parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Canonical deposit steps in order
export const DEPOSIT_STEPS = [
  { key: 'created', label: 'Demande créée', description: 'Demande de dépôt initiée' },
  { key: 'awaiting_proof', label: 'En attente de preuve', description: 'En attente de la preuve de dépôt' },
  { key: 'proof_submitted', label: 'Preuve envoyée', description: 'Preuve de dépôt soumise' },
  { key: 'admin_review', label: 'En vérification', description: 'Vérification par l\'équipe Bonzini' },
  { key: 'validated', label: 'Validé', description: 'Dépôt validé et wallet crédité' },
] as const;

export const REJECTED_STEP = { 
  key: 'rejected', 
  label: 'Rejeté', 
  description: 'Dépôt rejeté' 
};

export interface TimelineStepUI {
  id: string;
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string; // ISO string or undefined
  formattedDate?: string;
}

export interface DepositTimelineEvent {
  id: string;
  deposit_id: string;
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
 * Build UI timeline steps from deposit status and timeline events
 * Shows all canonical steps with proper completed/current/pending status
 */
export function buildDepositTimelineSteps(
  depositStatus: string,
  events: DepositTimelineEvent[] = []
): TimelineStepUI[] {
  // Map events by event_type for quick lookup
  const eventMap = new Map<string, DepositTimelineEvent>();
  events.forEach(event => {
    // Use the first event of each type (earliest)
    if (!eventMap.has(event.event_type)) {
      eventMap.set(event.event_type, event);
    }
  });

  // If rejected, show different flow
  if (depositStatus === 'rejected') {
    return buildRejectedTimeline(eventMap);
  }

  // Find current step index based on deposit status
  const currentStepIndex = DEPOSIT_STEPS.findIndex(step => step.key === depositStatus);
  
  return DEPOSIT_STEPS.map((step, index) => {
    let status: 'completed' | 'current' | 'pending';
    
    if (currentStepIndex === -1) {
      // Status not found in steps (shouldn't happen), mark first as current
      status = index === 0 ? 'current' : 'pending';
    } else if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
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
 * Build timeline for rejected deposits
 */
function buildRejectedTimeline(eventMap: Map<string, DepositTimelineEvent>): TimelineStepUI[] {
  // Show steps up to rejection
  const stepsBeforeReject = ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'];
  const result: TimelineStepUI[] = [];

  for (const stepKey of stepsBeforeReject) {
    const stepDef = DEPOSIT_STEPS.find(s => s.key === stepKey);
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
 * Get icon name for a step (for use with lucide-react)
 */
export function getStepIconName(stepKey: string, status: 'completed' | 'current' | 'pending'): string {
  if (status === 'completed') return 'Check';
  
  switch (stepKey) {
    case 'created': return 'Clock';
    case 'awaiting_proof': return 'Upload';
    case 'proof_submitted': return 'FileText';
    case 'admin_review': return 'Search';
    case 'validated': return 'CheckCircle';
    case 'wallet_credited': return 'Wallet';
    case 'rejected': return 'XCircle';
    default: return 'Clock';
  }
}

/**
 * Get color classes for a step
 */
export function getStepColors(stepKey: string, status: 'completed' | 'current' | 'pending'): string {
  if (status === 'completed') {
    return 'bg-primary text-primary-foreground border-primary';
  }
  
  if (status === 'current') {
    if (stepKey === 'rejected') {
      return 'bg-destructive/10 text-destructive border-destructive animate-pulse';
    }
    if (stepKey === 'validated') {
      return 'bg-emerald-100 text-emerald-600 border-emerald-500 animate-pulse';
    }
    return 'bg-primary/10 text-primary border-primary animate-pulse';
  }
  
  // pending
  return 'bg-muted text-muted-foreground border-muted';
}
