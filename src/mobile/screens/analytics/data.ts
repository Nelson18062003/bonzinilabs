/**
 * Analyses mobile v2 — les quelques lectures que les hooks partagés
 * (`useAnalytics`) ne donnent pas : la LISTE des opérations d'une période
 * (écran 04 et listes filtrées), d'où se calculent aussi les médianes et la
 * répartition des délais, et les plus gros soldes (écran 11).
 *
 * Mêmes tables, mêmes filtres, même date d'événement que `useAnalytics`
 * (`payments.processed_at` / `deposits.validated_at`) : une liste ouverte
 * depuis une barre contient exactement ce que la barre compte. Lectures
 * seules, `supabaseAdmin`, aucune écriture.
 */
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';

const STALE = 60_000;
/** Au-delà, une agrégation serveur s'impose (voir `useTopClients`). */
const CAP = 5_000;

export interface PeriodPayment {
  id: string;
  reference: string | null;
  userId: string | null;
  clientName: string;
  amountXaf: number;
  amountRmb: number;
  method: string;
  at: string;
  beneficiary: string | null;
}

export interface PeriodDeposit {
  id: string;
  reference: string | null;
  userId: string | null;
  clientName: string;
  amountXaf: number;
  method: string;
  bankName: string | null;
  createdAt: string;
  at: string;
}

async function clientNames(ids: string[]): Promise<Map<string, { name: string; code: string | null }>> {
  const out = new Map<string, { name: string; code: string | null }>();
  if (ids.length === 0) return out;
  const { data } = await supabaseAdmin.from('clients').select('user_id, first_name, last_name, customer_code').in('user_id', ids);
  for (const c of data ?? []) {
    out.set(c.user_id, { name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client', code: c.customer_code ?? null });
  }
  return out;
}

/** Les paiements EXÉCUTÉS de la période, les plus récents d'abord. */
export function usePeriodPayments(fromISO: string, toISO: string, enabled = true) {
  return useQuery<PeriodPayment[]>({
    queryKey: ['analytics-v2-m-payments', fromISO, toISO],
    staleTime: STALE,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, reference, user_id, amount_xaf, amount_rmb, method, processed_at, beneficiary_name')
        .eq('status', 'completed')
        .gte('processed_at', fromISO)
        .lt('processed_at', toISO)
        .order('processed_at', { ascending: false })
        .limit(CAP);
      if (error) throw error;
      const rows = data ?? [];
      const names = await clientNames([...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))]);
      return rows.map((r) => ({
        id: r.id,
        reference: r.reference ?? null,
        userId: r.user_id ?? null,
        clientName: (r.user_id && names.get(r.user_id)?.name) || 'Client',
        amountXaf: Number(r.amount_xaf ?? 0),
        amountRmb: Number(r.amount_rmb ?? 0),
        method: r.method ?? 'other',
        at: r.processed_at ?? '',
        beneficiary: r.beneficiary_name ?? null,
      }));
    },
  });
}

/** Les dépôts VALIDÉS de la période, les plus récents d'abord. */
export function usePeriodDeposits(fromISO: string, toISO: string, enabled = true) {
  return useQuery<PeriodDeposit[]>({
    queryKey: ['analytics-v2-m-deposits', fromISO, toISO],
    staleTime: STALE,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('deposits')
        .select('id, reference, user_id, amount_xaf, method, bank_name, created_at, validated_at')
        .eq('status', 'validated')
        .gte('validated_at', fromISO)
        .lt('validated_at', toISO)
        .order('validated_at', { ascending: false })
        .limit(CAP);
      if (error) throw error;
      const rows = data ?? [];
      const names = await clientNames([...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))]);
      return rows.map((r) => ({
        id: r.id,
        reference: r.reference ?? null,
        userId: r.user_id ?? null,
        clientName: (r.user_id && names.get(r.user_id)?.name) || 'Client',
        amountXaf: Number(r.amount_xaf ?? 0),
        method: r.method ?? 'other',
        bankName: r.bank_name ?? null,
        createdAt: r.created_at ?? '',
        at: r.validated_at ?? '',
      }));
    },
  });
}

export interface TopBalance {
  userId: string;
  name: string;
  code: string | null;
  balance: number;
}

/** Les plus gros soldes de portefeuille, maintenant. */
export function useTopBalances(limit = 10) {
  return useQuery<TopBalance[]>({
    queryKey: ['analytics-v2-m-top-balances', limit],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('user_id, balance_xaf')
        .gt('balance_xaf', 0)
        .order('balance_xaf', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = [...(data ?? [])].sort((a, b) => Number(b.balance_xaf ?? 0) - Number(a.balance_xaf ?? 0)).slice(0, limit);
      const names = await clientNames(rows.map((r) => r.user_id).filter((x): x is string => !!x));
      return rows.map((r) => ({
        userId: r.user_id,
        name: names.get(r.user_id)?.name ?? 'Client',
        code: names.get(r.user_id)?.code ?? null,
        balance: Number(r.balance_xaf ?? 0),
      }));
    },
  });
}

/* ── Calculs purs ───────────────────────────────────────────────────────── */

export function median(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Tranches de durée de validation (écran 17), en minutes. */
export const DURATION_BUCKETS: { label: string; max: number }[] = [
  { label: 'Moins de 15 min', max: 15 },
  { label: '15 à 30 min', max: 30 },
  { label: '30 min à 1 h', max: 60 },
  { label: '1 à 2 h', max: 120 },
  { label: '2 à 6 h', max: 360 },
  { label: 'Plus de 6 h', max: Infinity },
];

export function durationBuckets(deposits: Pick<PeriodDeposit, 'createdAt' | 'at'>[]): number[] {
  const counts = DURATION_BUCKETS.map(() => 0);
  for (const d of deposits) {
    const start = new Date(d.createdAt).getTime();
    const end = new Date(d.at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const m = (end - start) / 60_000;
    const i = DURATION_BUCKETS.findIndex((b) => m < b.max);
    counts[i === -1 ? counts.length - 1 : i] += 1;
  }
  return counts;
}
