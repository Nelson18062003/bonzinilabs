// ============================================================
// MODULE DEPOTS — Timeline utilities (refonte v2)
// Method-aware, event-based timeline with 4 steps
// ============================================================
import { parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DepositTimelineEvent } from '@/types/deposit';
import {
  getTimelineMethodFamily,
  TIMELINE_STEP_KEYS,
  TIMELINE_STEP_LABELS,
} from '@/types/deposit';

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

// ── Special terminal step definitions ────────────────────────

const REJECTED_STEP = {
  key: 'rejected',
  label: 'Rejeté',
  description: 'Dépôt refusé',
} as const;

const CORRECTION_STEP = {
  key: 'correction_requested',
  label: 'Correction demandée',
  description: 'Veuillez renvoyer une preuve corrigée',
} as const;

const CANCELLED_STEP = {
  key: 'cancelled',
  label: 'Annulé',
  description: 'Dépôt annulé par le client',
} as const;

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

// ── Event lookup ─────────────────────────────────────────────

/**
 * Find the most relevant event date for a given step key.
 * Some event_types don't exactly match step keys, so we map them.
 */
const EVENT_TYPE_MAP: Record<string, string[]> = {
  created: ['created'],
  proof_submitted: ['proof_submitted', 'proof_added', 'resubmitted', 'proof_resubmitted'],
  admin_review: ['admin_review'],
  validated: ['validated', 'wallet_credited'],
  rejected: ['rejected'],
  correction_requested: ['correction_requested'],
  cancelled: ['cancelled'],
};

function findEventDate(events: DepositTimelineEvent[], stepKey: string): string | null {
  const matchTypes = EVENT_TYPE_MAP[stepKey] || [stepKey];
  // Find the earliest matching event
  for (const eventType of matchTypes) {
    const evt = events.find((e) => e.event_type === eventType);
    if (evt) return safeFormatDate(evt.created_at);
  }
  return null;
}

function hasEvent(events: DepositTimelineEvent[], stepKey: string): boolean {
  const matchTypes = EVENT_TYPE_MAP[stepKey] || [stepKey];
  return events.some((e) => matchTypes.includes(e.event_type));
}

// ── Build steps for a method family ──────────────────────────

function getStepsForMethod(method: string): Array<{ key: string; label: string; description: string }> {
  const family = getTimelineMethodFamily(method);
  const labels = TIMELINE_STEP_LABELS[family];
  return TIMELINE_STEP_KEYS.map((key) => ({
    key,
    label: labels[key].label,
    description: labels[key].description,
  }));
}

// ── Status order for positional comparison ───────────────────

const STATUS_INDEX: Record<string, number> = {
  created: 0,
  awaiting_proof: 0, // Same as created (phantom status)
  proof_submitted: 1,
  admin_review: 2,
  validated: 3,
  wallet_credited: 3, // Same as validated
};

// ── Main builder ─────────────────────────────────────────────

export function buildDepositTimelineSteps(
  currentStatus: string,
  method: string,
  events: DepositTimelineEvent[],
): TimelineStepUI[] {
  // Terminal statuses: use event-based builder
  if (currentStatus === 'rejected') {
    return buildTerminalTimeline(method, REJECTED_STEP, events);
  }
  if (currentStatus === 'cancelled') {
    return buildTerminalTimeline(method, CANCELLED_STEP, events);
  }
  if (currentStatus === 'pending_correction') {
    return buildTerminalTimeline(method, CORRECTION_STEP, events);
  }

  // Normal flow: 4 steps with hybrid position + event logic
  const steps = getStepsForMethod(method);
  const currentIndex = STATUS_INDEX[currentStatus] ?? -1;
  const isTerminalCompleted = currentStatus === 'validated' || currentStatus === 'wallet_credited';

  return steps.map((step, i) => {
    let status: StepStatus;
    if (isTerminalCompleted) {
      status = 'completed';
    } else if (i < currentIndex) {
      status = 'completed';
    } else if (i === currentIndex) {
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

// ── Terminal timeline builder ────────────────────────────────

/**
 * Builds timeline for terminal/branching statuses (rejected, cancelled, correction).
 * Shows only the steps that actually happened (based on events) + the terminal step.
 */
function buildTerminalTimeline(
  method: string,
  terminalStep: { key: string; label: string; description: string },
  events: DepositTimelineEvent[],
): TimelineStepUI[] {
  const allSteps = getStepsForMethod(method);
  const result: TimelineStepUI[] = [];

  // Always show 'created' as completed (deposit exists = it was created)
  const createdStep = allSteps[0];
  result.push({
    id: `step-${createdStep.key}`,
    key: createdStep.key,
    label: createdStep.label,
    description: createdStep.description,
    status: 'completed',
    formattedDate: findEventDate(events, 'created') || undefined,
  });

  // For remaining normal steps (proof_submitted, admin_review), only show if event exists
  for (let i = 1; i < allSteps.length - 1; i++) {
    const step = allSteps[i];
    if (hasEvent(events, step.key)) {
      result.push({
        id: `step-${step.key}`,
        key: step.key,
        label: step.label,
        description: step.description,
        status: 'completed',
        formattedDate: findEventDate(events, step.key) || undefined,
      });
    }
  }

  // Add the terminal step as current
  result.push({
    id: `step-${terminalStep.key}`,
    key: terminalStep.key,
    label: terminalStep.label,
    description: terminalStep.description,
    status: 'current',
    formattedDate: findEventDate(events, terminalStep.key) || undefined,
  });

  return result;
}

// ── Visual helpers ───────────────────────────────────────────

export function getStepIconName(key: string): string {
  const map: Record<string, string> = {
    created: 'FileText',
    proof_submitted: 'Image',
    admin_review: 'Eye',
    validated: 'CheckCircle',
    rejected: 'XCircle',
    correction_requested: 'AlertTriangle',
    cancelled: 'Ban',
  };
  return map[key] || 'Circle';
}

export function getStepColors(key: string, status: StepStatus): string {
  if (status === 'pending') return 'border-muted-foreground/30 text-muted-foreground/30';

  if (key === 'rejected') return 'border-red-500 text-red-500 bg-red-50';
  if (key === 'cancelled') return 'border-gray-500 text-gray-500 bg-gray-50';
  if (key === 'correction_requested') return 'border-orange-500 text-orange-500 bg-orange-50';
  if (key === 'validated') return 'border-green-500 text-green-500 bg-green-50';

  if (status === 'completed') return 'border-primary text-primary bg-primary/10';
  if (status === 'current') return 'border-primary text-primary bg-primary/10';

  return 'border-muted-foreground/30 text-muted-foreground/30';
}

// ── SLA age indicator ────────────────────────────────────────

export type SlaLevel = 'fresh' | 'aging' | 'overdue';

/**
 * Returns an SLA urgency level based on how old a deposit is.
 * Returns null for terminal statuses (validated/rejected/cancelled).
 * - fresh: < 2 hours
 * - aging: 2-8 hours
 * - overdue: > 8 hours
 */
export function getDepositSlaLevel(createdAt: string, status: string): SlaLevel | null {
  if (['validated', 'rejected', 'cancelled'].includes(status)) return null;
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hoursAgo < 2) return 'fresh';
  if (hoursAgo < 8) return 'aging';
  return 'overdue';
}
