/**
 * Unified semantic mapping for domain statuses and admin roles → ONE tone scale.
 * Fixes the audit finding: the same meaning (e.g. "en attente") was coloured
 * differently across clients / deposits / payments, and ROLE_BADGE_COLORS was
 * redefined 3×. Here, same meaning = same tone, everywhere.
 *
 * Labels stay reasonable defaults; screens may keep their own i18n label helper
 * and use ONLY the tone from here for colour. (Phase 1 wires these in.)
 */
import type { Tone } from './tokens';

/** Deposit status → tone. */
export function depositStatusTone(s: string): Tone {
  switch (s) {
    case 'validated':
    case 'completed':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    case 'processing':
    case 'in_progress':
      return 'info';
    case 'to_process':
    case 'pending':
    case 'pending_review':
    case 'needs_correction':
      return 'pending';
    default:
      return 'neutral';
  }
}

/** Payment status → tone. */
export function paymentStatusTone(s: string): Tone {
  switch (s) {
    case 'completed':
    case 'paid':
      return 'success';
    case 'rejected':
    case 'failed':
    case 'cancelled':
      return 'danger';
    case 'processing':
    case 'cash_scanned':
    case 'in_progress':
      return 'info';
    case 'to_process':
    case 'pending':
      return 'pending';
    default:
      return 'neutral';
  }
}

/** Client status → tone (handles mixed casing seen in the codebase). */
export function clientStatusTone(s: string): Tone {
  switch (s.toLowerCase()) {
    case 'active':
      return 'success';
    case 'suspended':
      return 'danger';
    case 'pending_kyc':
      return 'pending';
    case 'inactive':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Admin role → label + tone (single source; replaces the 3 duplicated dicts). */
export const ROLE_META: Record<string, { label: string; tone: Tone }> = {
  super_admin: { label: 'Super admin', tone: 'info' },
  ops: { label: 'Opérations', tone: 'info' },
  support: { label: 'Support', tone: 'success' },
  customer_success: { label: 'Customer success', tone: 'pending' },
  cash_agent: { label: 'Agent cash', tone: 'pending' },
  admin: { label: 'Admin', tone: 'info' },
};

export function roleMeta(role: string): { label: string; tone: Tone } {
  return ROLE_META[role] ?? { label: role, tone: 'neutral' };
}
