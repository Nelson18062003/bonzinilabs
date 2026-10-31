/**
 * Opérations v2 — l'état des filtres de la liste, et sa traduction en
 * filtres serveur (usePaginatedAdminDeposits / usePaginatedAdminPayments).
 *
 * L'état vit au niveau du module (pas dans le composant) : ouvrir une fiche
 * puis revenir retrouve l'onglet, la puce, les filtres et la recherche —
 * avant, tout repartait à zéro.
 */
import type { DepositFilters } from '@/hooks/usePaginatedDeposits';
import type { PaymentFilters } from '@/hooks/usePaginatedPayments';
import { FAMILY_TO_METHODS } from '@/lib/depositsList';
import { PAY_TO_PAY } from './opsQueries';

export type OpsTab = 'deposits' | 'payments';
export type PayChip = 'to_pay' | 'in_progress' | 'paid' | 'all';
export type DepChip = 'to_validate' | 'credited' | 'refused' | 'all';
export type Period = 'all' | 'today' | '7d' | '30d' | 'custom';
export type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
export type PayExtra = 'waiting_beneficiary_info' | 'rejected' | 'cancelled_by_admin' | null;
export type DepExtra = 'no_proof' | 'cancelled' | null;
export type PayMethodKey = 'all' | 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
export type DepFamilyKey = 'all' | 'ORANGE_MONEY' | 'MTN_MONEY' | 'WAVE' | 'BANK' | 'AGENCY_BONZINI';

export interface OpsFilterState {
  period: Period;
  from: string;
  to: string;
  sort: SortKey;
  payMethod: PayMethodKey;
  depFamily: DepFamilyKey;
  payExtra: PayExtra;
  depExtra: DepExtra;
}

export const DEFAULT_FILTERS: OpsFilterState = {
  period: 'all', from: '', to: '', sort: 'newest', payMethod: 'all', depFamily: 'all', payExtra: null, depExtra: null,
};

export interface OpsMemory {
  payChip: PayChip;
  depChip: DepChip;
  filters: OpsFilterState;
  search: string;
}

export const opsMemory: OpsMemory = { payChip: 'to_pay', depChip: 'all', filters: { ...DEFAULT_FILTERS }, search: '' };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function periodRange(f: OpsFilterState, now = new Date()): { dateFrom?: string; dateTo?: string } {
  if (f.period === 'today') return { dateFrom: ymd(now) };
  if (f.period === '7d' || f.period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - (f.period === '7d' ? 6 : 29));
    return { dateFrom: ymd(d) };
  }
  if (f.period === 'custom') return { dateFrom: f.from || undefined, dateTo: f.to || undefined };
  return {};
}

/** Combien de filtres (hors puce) sont posés — pour « Filtres et tri · 2 ». */
export function activeFilterCount(f: OpsFilterState, tab: OpsTab): number {
  let n = 0;
  if (f.period !== 'all') n++;
  if (f.sort !== 'newest') n++;
  if (tab === 'payments') { if (f.payMethod !== 'all') n++; if (f.payExtra) n++; }
  else { if (f.depFamily !== 'all') n++; if (f.depExtra) n++; }
  return n;
}

export function paymentFilters(chip: PayChip, f: OpsFilterState, search: string): PaymentFilters {
  const out: PaymentFilters = {};
  if (f.payExtra) out.statuses = [f.payExtra];
  else if (chip === 'to_pay') out.statuses = PAY_TO_PAY;
  else if (chip === 'in_progress') out.statuses = ['processing'];
  else if (chip === 'paid') out.statuses = ['completed'];
  if (f.payMethod !== 'all') out.method = f.payMethod;
  Object.assign(out, periodRange(f));
  out.sortField = f.sort.startsWith('amount') ? 'amount_rmb' : 'created_at';
  out.sortAscending = f.sort === 'oldest' || f.sort === 'amount_asc';
  if (search.trim()) out.search = search.trim();
  return out;
}

export function depositFilters(chip: DepChip, f: OpsFilterState, search: string): DepositFilters {
  const out: DepositFilters = {};
  if (f.depExtra === 'no_proof') out.statuses = ['created', 'awaiting_proof'];
  else if (f.depExtra === 'cancelled') out.statuses = ['cancelled', 'cancelled_by_admin'];
  else if (chip === 'to_validate') out.statuses = ['proof_submitted', 'admin_review', 'pending_correction'];
  else if (chip === 'credited') out.status = 'validated';
  else if (chip === 'refused') out.status = 'rejected';
  if (f.depFamily !== 'all') out.methods = FAMILY_TO_METHODS[f.depFamily] ?? [];
  Object.assign(out, periodRange(f));
  out.sortField = f.sort.startsWith('amount') ? 'amount_xaf' : 'created_at';
  out.sortAscending = f.sort === 'oldest' || f.sort === 'amount_asc';
  if (search.trim()) out.search = search.trim();
  return out;
}
