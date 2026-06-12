// ============================================================
// Shared types and constants for the client payment-detail screen.
// Extracted from PaymentDetailPage so each section component can
// import them without coupling to the page itself.
// ============================================================
import type { Payment } from '@/hooks/usePayments';

/** All states in which the client may still edit beneficiary info. */
export const EDITABLE_STATUSES = ['created', 'waiting_beneficiary_info', 'ready_for_payment'] as const;

/** All states in which the payment is locked (read-only). */
export const LOCKED_STATUSES = ['processing', 'completed', 'rejected'] as const;

/** All states in which the client may attach instruction files. */
export const UPLOADABLE_STATUSES = ['created', 'waiting_beneficiary_info', 'ready_for_payment'] as const;

export function isStatusEditable(status: Payment['status']): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function isStatusLocked(status: Payment['status']): boolean {
  return (LOCKED_STATUSES as readonly string[]).includes(status);
}

export function isStatusUploadable(status: Payment['status']): boolean {
  return (UPLOADABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Most legacy client payments stored the rate as a decimal
 * (0.01153 = 1 XAF → 0.01153 RMB).
 * Recent admin-created payments store an integer (1M XAF → 11530 RMB).
 * This helper normalises both into the integer form so the UI is
 * consistent regardless of vintage.
 */
export function normalizeRateToInt(exchangeRate: number | null | undefined): number {
  if (!exchangeRate) return 0;
  return exchangeRate < 1 ? Math.round(exchangeRate * 1_000_000) : Math.round(exchangeRate);
}
