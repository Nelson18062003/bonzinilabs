/**
 * Shared, form-factor-agnostic config for the admin payments list — used by both
 * MobilePaymentsScreen and DesktopPaymentsScreen so status buckets, method
 * filters, sort options and the method→logo mapping never drift.
 */
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentStatus } from '@/types/payment';

export type FilterKey = PaymentStatus | 'all' | 'to_process';

export const METHOD_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes méthodes' },
  ...Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label })),
];

export const SORT_OPTIONS: { key: string; label: string; field: 'created_at' | 'amount_rmb'; ascending: boolean }[] = [
  { key: 'newest', label: 'Plus récent', field: 'created_at', ascending: false },
  { key: 'oldest', label: 'Plus ancien', field: 'created_at', ascending: true },
  { key: 'amount_desc', label: 'Montant ↓', field: 'amount_rmb', ascending: false },
  { key: 'amount_asc', label: 'Montant ↑', field: 'amount_rmb', ascending: true },
];

/** Map a DB method to one of the 4 logo keys PaymentMethodLogo accepts. */
export function logoMethod(method: string): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'bank_transfer';
}
