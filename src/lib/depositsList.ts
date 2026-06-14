/**
 * Shared, form-factor-agnostic logic for the admin deposits list — used by both
 * the mobile screen (MobileDepositsScreenV2) and the desktop screen
 * (DesktopDepositsScreen) so the two never drift on method families, status
 * filtering or period presets. Pure data only (no React, no presentation).
 */
import type { DepositStatus, DepositMethod } from '@/types/deposit';

/** Method "families" — brand identity for the method vignette + filtering. */
export const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean; name: string }> = {
  BANK: { letter: 'B', bg: '#1e3a5f', name: 'Banque' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE', name: 'Agence' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600', name: 'Orange' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true, name: 'MTN' },
  WAVE: { letter: 'W', bg: '#1dc3e3', name: 'Wave' },
};

export function getFamilyFromMethod(method: string): string {
  if (['bank_transfer', 'bank_cash'].includes(method)) return 'BANK';
  if (method === 'agency_cash') return 'AGENCY_BONZINI';
  if (['om_transfer', 'om_withdrawal'].includes(method)) return 'ORANGE_MONEY';
  if (['mtn_transfer', 'mtn_withdrawal'].includes(method)) return 'MTN_MONEY';
  if (method === 'wave') return 'WAVE';
  return 'BANK';
}

/** Family → DB methods (for client-side filtering). */
export const FAMILY_TO_METHODS: Record<string, DepositMethod[]> = {
  BANK: ['bank_transfer', 'bank_cash'],
  AGENCY_BONZINI: ['agency_cash'],
  ORANGE_MONEY: ['om_transfer', 'om_withdrawal'],
  MTN_MONEY: ['mtn_transfer', 'mtn_withdrawal'],
  WAVE: ['wave'],
};

/** The list's status filter: every concrete status, plus "all" and the
 *  composite "to_process" bucket. */
export type FilterKey = DepositStatus | 'all' | 'to_process';
export const TO_PROCESS_STATUSES: DepositStatus[] = ['proof_submitted', 'admin_review'];

export type PeriodPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export function getPeriodDates(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    return { dateFrom: ymd(now), dateTo: ymd(now) };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { dateFrom: ymd(y), dateTo: ymd(y) };
  }
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { dateFrom: ymd(monday), dateTo: '' };
  }
  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: ymd(first), dateTo: '' };
  }
  return { dateFrom: '', dateTo: '' };
}
