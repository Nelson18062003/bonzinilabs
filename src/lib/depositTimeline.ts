// ============================================================
// MODULE DEPOTS — Timeline utilities (from scratch)
// ============================================================
import { parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DepositTimelineEvent } from '@/types/deposit';

// ── Step definitions ─────────────────────────────────────────

export const DEPOSIT_STEPS = [
  { key: 'created', label: 'Demande créée', description: 'Dépôt déclaré' },
  { key: 'awaiting_proof', label: 'En attente de preuve', description: 'Envoyez votre preuve de dépôt' },
  { key: 'proof_submitted', label: 'Preuve envoyée', description: 'En attente de vérification' },
  { key: 'admin_review', label: 'En vérification', description: "L'équipe Bonzini vérifie votre dépôt" },
  { key: 'validated', label: 'Validé', description: 'Dépôt confirmé' },
  { key: 'wallet_credited', label: 'Solde crédité', description: 'Votre wallet a été crédité' },
] as const;

export const REJECTED_STEP = {
  key: 'rejected',
  label: 'Rejeté',
  description: 'Dépôt refusé',
} as const;

export const CORRECTION_STEP = {
  key: 'correction_requested',
  label: 'Correction demandée',
  description: 'Veuillez renvoyer une preuve corrigée',
} as const;

// ── Types ────────────────────────────────────────────────────

export type StepStatus = 'completed' | 'current' | 'pending';

export interface TimelineStepUI {
  id: string;
  key: string;
  label: string;
  description: string;
  status: StepStatus;
  formattedDate?: string;
}

// ── Date helper ──────────────────────────────────────────────

export function safeFormatDate(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  try {
    const d = parseISO(isoStr);
    if (!isValid(d)) return null;
    return format(d, 'dd MMM yyyy, HH:mm', { locale: fr });
  } catch {
    return null;
  }
}

// ── Build timeline steps ─────────────────────────────────────

const STATUS_ORDER = ['created', 'awaiting_proof', 'proof_submitted', 'admin_review', 'validated', 'wallet_credited'];

function findEventDate(events: DepositTimelineEvent[], eventType: string): string | null {
  const evt = events.find((e) => e.event_type === eventType);
  return evt ? safeFormatDate(evt.created_at) : null;
}

export function buildDepositTimelineSteps(
  currentStatus: string,
  events: DepositTimelineEvent[],
): TimelineStepUI[] {
  if (currentStatus === 'rejected') {
    return buildRejectedTimeline(events);
  }
  if (currentStatus === 'pending_correction') {
    return buildCorrectionTimeline(events);
  }

  const statusIndex = STATUS_ORDER.indexOf(currentStatus);

  return DEPOSIT_STEPS.map((step, i) => {
    let status: StepStatus;
    if (currentStatus === 'validated' || currentStatus === 'wallet_credited') {
      status = 'completed';
    } else if (i < statusIndex) {
      status = 'completed';
    } else if (i === statusIndex) {
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
      formattedDate: findEventDate(events, step.key) || undefined,
    };
  });
}

function buildRejectedTimeline(events: DepositTimelineEvent[]): TimelineStepUI[] {
  const steps: TimelineStepUI[] = DEPOSIT_STEPS.slice(0, 3).map((step) => ({
    id: `step-${step.key}`,
    key: step.key,
    label: step.label,
    description: step.description,
    status: 'completed' as StepStatus,
    formattedDate: findEventDate(events, step.key) || undefined,
  }));

  steps.push({
    id: 'step-rejected',
    key: REJECTED_STEP.key,
    label: REJECTED_STEP.label,
    description: REJECTED_STEP.description,
    status: 'current',
    formattedDate: findEventDate(events, 'rejected') || undefined,
  });

  return steps;
}

function buildCorrectionTimeline(events: DepositTimelineEvent[]): TimelineStepUI[] {
  const steps: TimelineStepUI[] = DEPOSIT_STEPS.slice(0, 3).map((step) => ({
    id: `step-${step.key}`,
    key: step.key,
    label: step.label,
    description: step.description,
    status: 'completed' as StepStatus,
    formattedDate: findEventDate(events, step.key) || undefined,
  }));

  steps.push({
    id: 'step-correction',
    key: CORRECTION_STEP.key,
    label: CORRECTION_STEP.label,
    description: CORRECTION_STEP.description,
    status: 'current',
    formattedDate: findEventDate(events, 'correction_requested') || undefined,
  });

  return steps;
}

// ── Visual helpers ───────────────────────────────────────────

export function getStepIconName(key: string): string {
  const map: Record<string, string> = {
    created: 'FileText',
    awaiting_proof: 'Upload',
    proof_submitted: 'Image',
    admin_review: 'Eye',
    validated: 'CheckCircle',
    wallet_credited: 'Wallet',
    rejected: 'XCircle',
    correction_requested: 'AlertTriangle',
  };
  return map[key] || 'Circle';
}

export function getStepColors(key: string, status: StepStatus): string {
  if (status === 'pending') return 'border-muted-foreground/30 text-muted-foreground/30';

  if (key === 'rejected') return 'border-red-500 text-red-500 bg-red-50';
  if (key === 'correction_requested') return 'border-orange-500 text-orange-500 bg-orange-50';
  if (key === 'validated' || key === 'wallet_credited') return 'border-green-500 text-green-500 bg-green-50';

  if (status === 'completed') return 'border-primary text-primary bg-primary/10';
  if (status === 'current') return 'border-primary text-primary bg-primary/10';

  return 'border-muted-foreground/30 text-muted-foreground/30';
}

// ── SLA age indicator ────────────────────────────────────────

export type SlaLevel = 'fresh' | 'aging' | 'overdue';

/**
 * Returns an SLA urgency level based on how old a deposit is.
 * Returns null for terminal statuses (validated/rejected).
 * - fresh: < 2 hours
 * - aging: 2-8 hours
 * - overdue: > 8 hours
 */
export function getDepositSlaLevel(createdAt: string, status: string): SlaLevel | null {
  if (['validated', 'rejected'].includes(status)) return null;
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hoursAgo < 2) return 'fresh';
  if (hoursAgo < 8) return 'aging';
  return 'overdue';
}
