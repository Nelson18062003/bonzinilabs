// ============================================================
// Shared types and constants for the client payment-detail screen.
// Extracted from PaymentDetailPage so each section component can
// import them without coupling to the page itself.
// ============================================================
import type { Payment } from '@/hooks/usePayments';

/** Tailwind classes used to colour the status badge in the page header. */
export const STATUS_BADGE_STYLES: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  waiting_beneficiary_info: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  ready_for_payment: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  cash_pending: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  cash_scanned: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  processing: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

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
