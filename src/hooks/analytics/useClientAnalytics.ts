/**
 * Client-side analytics hooks — exposed on the "Mon activité" page.
 *
 * Same metrics as the admin layer, but:
 *   - queries go through `supabase` (client session), not `supabaseAdmin`
 *   - RLS implicitly scopes every row to the logged-in user's data
 *   - payload size stays tiny per request (one user's history)
 *
 * No new bug surface — these hooks reuse the same TZ-safe DateRange
 * contract and the same aggregation logic as the admin hooks.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  bucketKeyFor,
  bucketStarts,
  previousRange,
  toSupabaseBounds,
  type DateRange,
  type Granularity,
} from '@/lib/analytics/dateRange';

const CLIENT_ANALYTICS_STALE = 60 * 1000;
const CLIENT_ANALYTICS_GC = 5 * 60 * 1000;

// Re-use types from the admin layer without pulling the whole module.
export interface ClientCurrentVsPrevious<T> {
  current: T;
  previous: T | null;
}

export interface ClientFlowPoint {
  bucket: string;
  label: string;
  deposits: number;
  payments: number;
  net: number;
}

export interface ClientVolumeSummary {
  totalXAF: number;
  totalRMB: number;
  opCount: number;
  avgTicketXAF: number;
}

export interface ClientMethodBreakdown {
  key: string;
  label: string;
  count: number;
  amount: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Labels (duplicated rather than shared to keep the client bundle minimal
// and this module independent of the admin hooks)
// ────────────────────────────────────────────────────────────────────────────

const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function labelFor(bucket: Date, granularity: Granularity): string {
  const biz = new Date(bucket.getTime() + 60 * 60_000);
  switch (granularity) {
    case 'hour':
      return `${biz.getUTCHours().toString().padStart(2, '0')}h`;
    case 'day':
      return `${DAY_LABELS_FR[biz.getUTCDay()]} ${biz.getUTCDate()}`;
    case 'week': {
      const d = new Date(biz.getTime());
      d.setUTCDate(biz.getUTCDate() + 3);
      const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
      return `S${week}`;
    }
    case 'month':
      return `${MONTH_LABELS_FR[biz.getUTCMonth()]} ${biz.getUTCFullYear().toString().slice(-2)}`;
  }
}

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  cash_agency: 'Espèces agence',
  cash_agent: 'Cash agent',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  card: 'Carte',
  other: 'Autre',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
  bank_transfer: 'Virement',
  cash: 'Espèces',
};

// ────────────────────────────────────────────────────────────────────────────
// 1. Client flow series (user's own deposits vs payments by bucket)
// ────────────────────────────────────────────────────────────────────────────

async function fetchClientFlow(range: DateRange): Promise<ClientFlowPoint[]> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Instead of ledger_entries (admin-only), combine the two user-facing tables.
  const [depRes, payRes] = await Promise.all([
    supabase
      .from('deposits')
      .select('amount_xaf, validated_at')
      .eq('user_id', user.id)
      .eq('status', 'validated')
      .gte('validated_at', fromISO)
      .lt('validated_at', toISO),
    supabase
      .from('payments')
      .select('amount_xaf, completed_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', fromISO)
      .lt('created_at', toISO),
  ]);

  if (depRes.error) throw depRes.error;
  if (payRes.error) throw payRes.error;

  const buckets = new Map<string, { deposits: number; payments: number }>();
  for (const b of bucketStarts(range)) {
    buckets.set(b.toISOString(), { deposits: 0, payments: 0 });
  }

  for (const dep of depRes.data ?? []) {
    if (!dep.validated_at) continue;
    const key = bucketKeyFor(new Date(dep.validated_at), range.granularity);
    const bucket = buckets.get(key);
    if (bucket) bucket.deposits += Number(dep.amount_xaf ?? 0);
  }
  for (const pay of payRes.data ?? []) {
    const ts = pay.completed_at ?? pay.created_at;
    if (!ts) continue;
    const key = bucketKeyFor(new Date(ts), range.granularity);
    const bucket = buckets.get(key);
    if (bucket) bucket.payments += Number(pay.amount_xaf ?? 0);
  }

  return [...buckets.entries()].map(([iso, v]) => ({
    bucket: iso,
    label: labelFor(new Date(iso), range.granularity),
    deposits: v.deposits,
    payments: v.payments,
    net: v.deposits - v.payments,
  }));
}

export function useClientFlowSeries(range: DateRange) {
  return useQuery<ClientCurrentVsPrevious<ClientFlowPoint[]>>({
    queryKey: ['client-analytics-flow', range.from.toISOString(), range.to.toISOString(), range.granularity, range.compareToPrevious],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchClientFlow(range);
      const previous = range.compareToPrevious ? await fetchClientFlow(previousRange(range)) : null;
      return { current, previous };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Client payment summary
// ────────────────────────────────────────────────────────────────────────────

async function fetchClientPaymentSummary(range: DateRange): Promise<ClientVolumeSummary> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalXAF: 0, totalRMB: 0, opCount: 0, avgTicketXAF: 0 };

  const { data, error } = await supabase
    .from('payments')
    .select('amount_xaf, amount_rmb')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', fromISO)
    .lt('created_at', toISO);
  if (error) throw error;

  const rows = data ?? [];
  const totalXAF = rows.reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);
  const totalRMB = rows.reduce((s, r) => s + Number(r.amount_rmb ?? 0), 0);
  const opCount = rows.length;
  return {
    totalXAF,
    totalRMB,
    opCount,
    avgTicketXAF: opCount === 0 ? 0 : Math.round(totalXAF / opCount),
  };
}

export function useClientPaymentSummary(range: DateRange) {
  return useQuery<ClientCurrentVsPrevious<ClientVolumeSummary>>({
    queryKey: ['client-analytics-payment-summary', range.from.toISOString(), range.to.toISOString(), range.compareToPrevious],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchClientPaymentSummary(range);
      const previous = range.compareToPrevious ? await fetchClientPaymentSummary(previousRange(range)) : null;
      return { current, previous };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Client deposit summary
// ────────────────────────────────────────────────────────────────────────────

async function fetchClientDepositSummary(range: DateRange): Promise<ClientVolumeSummary> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalXAF: 0, totalRMB: 0, opCount: 0, avgTicketXAF: 0 };

  const { data, error } = await supabase
    .from('deposits')
    .select('amount_xaf')
    .eq('user_id', user.id)
    .eq('status', 'validated')
    .gte('created_at', fromISO)
    .lt('created_at', toISO);
  if (error) throw error;

  const rows = data ?? [];
  const totalXAF = rows.reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);
  const opCount = rows.length;
  return {
    totalXAF,
    totalRMB: 0,
    opCount,
    avgTicketXAF: opCount === 0 ? 0 : Math.round(totalXAF / opCount),
  };
}

export function useClientDepositSummary(range: DateRange) {
  return useQuery<ClientCurrentVsPrevious<ClientVolumeSummary>>({
    queryKey: ['client-analytics-deposit-summary', range.from.toISOString(), range.to.toISOString(), range.compareToPrevious],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchClientDepositSummary(range);
      const previous = range.compareToPrevious ? await fetchClientDepositSummary(previousRange(range)) : null;
      return { current, previous };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Client payment method breakdown
// ────────────────────────────────────────────────────────────────────────────

export function useClientPaymentMethodBreakdown(range: DateRange) {
  return useQuery<ClientMethodBreakdown[]>({
    queryKey: ['client-analytics-payment-methods', range.from.toISOString(), range.to.toISOString()],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('payments')
        .select('method, amount_xaf')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      const map = new Map<string, { count: number; amount: number }>();
      for (const row of data ?? []) {
        const key = row.method ?? 'other';
        const entry = map.get(key) ?? { count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += Number(row.amount_xaf ?? 0);
        map.set(key, entry);
      }
      return [...map.entries()]
        .map(([key, v]) => ({
          key,
          label: PAYMENT_METHOD_LABELS[key] ?? key,
          count: v.count,
          amount: v.amount,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Client deposit method breakdown
// ────────────────────────────────────────────────────────────────────────────

export function useClientDepositMethodBreakdown(range: DateRange) {
  return useQuery<ClientMethodBreakdown[]>({
    queryKey: ['client-analytics-deposit-methods', range.from.toISOString(), range.to.toISOString()],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('deposits')
        .select('method, amount_xaf')
        .eq('user_id', user.id)
        .eq('status', 'validated')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      const map = new Map<string, { count: number; amount: number }>();
      for (const row of data ?? []) {
        const key = row.method ?? 'other';
        const entry = map.get(key) ?? { count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += Number(row.amount_xaf ?? 0);
        map.set(key, entry);
      }
      return [...map.entries()]
        .map(([key, v]) => ({
          key,
          label: DEPOSIT_METHOD_LABELS[key] ?? key,
          count: v.count,
          amount: v.amount,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Client wallet balance + evolution
// ────────────────────────────────────────────────────────────────────────────

export interface ClientWalletStats {
  currentBalanceXAF: number;
  totalDepositedXAF: number;
  totalPaidXAF: number;
  utilizationRate: number; // totalPaid / totalDeposited, 0-1
}

export function useClientWalletStats(range: DateRange) {
  return useQuery<ClientWalletStats>({
    queryKey: ['client-analytics-wallet', range.from.toISOString(), range.to.toISOString()],
    staleTime: CLIENT_ANALYTICS_STALE,
    gcTime: CLIENT_ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { currentBalanceXAF: 0, totalDepositedXAF: 0, totalPaidXAF: 0, utilizationRate: 0 };
      }

      const [walletRes, depRes, payRes] = await Promise.all([
        supabase
          .from('wallets')
          .select('balance_xaf')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('deposits')
          .select('amount_xaf')
          .eq('user_id', user.id)
          .eq('status', 'validated')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
        supabase
          .from('payments')
          .select('amount_xaf')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
      ]);

      if (walletRes.error) throw walletRes.error;
      if (depRes.error) throw depRes.error;
      if (payRes.error) throw payRes.error;

      const totalDepositedXAF = (depRes.data ?? []).reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);
      const totalPaidXAF = (payRes.data ?? []).reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);

      return {
        currentBalanceXAF: Number(walletRes.data?.balance_xaf ?? 0),
        totalDepositedXAF,
        totalPaidXAF,
        utilizationRate: totalDepositedXAF === 0 ? 0 : Math.min(1, totalPaidXAF / totalDepositedXAF),
      };
    },
  });
}
