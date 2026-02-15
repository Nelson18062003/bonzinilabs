/**
 * SLA urgency indicator for payments.
 * Payments have longer SLA than deposits (international transfers).
 * - fresh:   < 4 hours
 * - aging:   4-12 hours
 * - overdue: > 12 hours
 */

export type SlaLevel = 'fresh' | 'aging' | 'overdue';

export function getPaymentSlaLevel(createdAt: string, status: string): SlaLevel | null {
  if (['completed', 'rejected'].includes(status)) return null;
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hoursAgo < 4) return 'fresh';
  if (hoursAgo < 12) return 'aging';
  return 'overdue';
}
