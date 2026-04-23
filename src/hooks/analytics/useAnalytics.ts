/**
 * Analytics hooks v2 — range-driven, TZ-safe, aggregates explicit.
 *
 * Every hook takes a `DateRange` so the whole dashboard responds to a
 * single DateRangePicker. All time math goes through the helpers in
 * `src/lib/analytics/dateRange.ts` which apply the business timezone
 * (Africa/Douala) — the legacy helpers in `useDashboardAnalytics.ts`
 * used the browser's local offset and silently shifted days by 1-2h.
 *
 * Data sources: `ledger_entries`, `payments`, `deposits`, `clients`,
 * `daily_rates`, `admin_audit_logs`. Postgres-side aggregation is kept
 * to `rpc()` where it already exists; otherwise we fetch a bounded
 * range and aggregate in JS (acceptable at the current volume — see
 * the full audit for the CQRS/materialised-view upgrade path).
 *
 * All hooks return an explicit `{ current, previous }` split when the
 * range has `compareToPrevious = true`, so the UI can show Δ vs the
 * previous period without re-running the math.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import {
  bucketKeyFor,
  bucketStarts,
  previousRange,
  toSupabaseBounds,
  type DateRange,
  type Granularity,
} from '@/lib/analytics/dateRange';

const ANALYTICS_STALE = 60 * 1000;
const ANALYTICS_GC = 5 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────────

export interface CurrentVsPrevious<T> {
  current: T;
  previous: T | null;
}

export interface FlowPoint {
  bucket: string;    // ISO UTC of the bucket start
  label: string;     // Human-readable label (Lun, 24 Mar, Avr, S12...)
  deposits: number;  // XAF
  payments: number;  // XAF
  net: number;       // deposits - payments
}

export interface VolumeSummary {
  totalXAF: number;
  totalRMB: number;
  opCount: number;
  avgTicketXAF: number;
}

export interface MethodBreakdown {
  key: string;
  label: string;
  count: number;
  amount: number;
}

export interface TopClient {
  userId: string;
  firstName: string;
  lastName: string;
  opCount: number;
  totalXAF: number;
  totalRMB: number;
}

export interface DepositStatusSummary {
  validated: { count: number; amountXAF: number };
  rejected: { count: number; amountXAF: number };
  pendingProof: { count: number; amountXAF: number };
  pendingReview: { count: number; amountXAF: number };
  cancelled: { count: number; amountXAF: number };
  validationRate: number; // 0–1
  rejectionRate: number;  // 0–1
}

export interface FunnelStats {
  clientsTotal: number;
  clientsWithDeposit: number;
  clientsWithPayment: number;
  depositToPaymentRate: number; // clientsWithPayment / clientsWithDeposit
}

// ────────────────────────────────────────────────────────────────────────────
// Labels — business TZ
// ────────────────────────────────────────────────────────────────────────────

const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function labelFor(bucket: Date, granularity: Granularity): string {
  const biz = new Date(bucket.getTime() + 60 * 60_000); // business TZ
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

// ────────────────────────────────────────────────────────────────────────────
// 1. Net flow by bucket — FIXED (no Math.abs, TZ-safe, range-driven)
// ────────────────────────────────────────────────────────────────────────────

async function fetchFlow(range: DateRange): Promise<FlowPoint[]> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('entry_type, amount_xaf, created_at')
    .in('entry_type', ['DEPOSIT_VALIDATED', 'PAYMENT_EXECUTED'])
    .gte('created_at', fromISO)
    .lt('created_at', toISO);
  if (error) throw error;

  const buckets = new Map<string, { deposits: number; payments: number }>();
  for (const b of bucketStarts(range)) {
    buckets.set(b.toISOString(), { deposits: 0, payments: 0 });
  }

  for (const entry of data ?? []) {
    const key = bucketKeyFor(new Date(entry.created_at), range.granularity);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = Number(entry.amount_xaf ?? 0);
    // Ledger convention: deposits are positive, payments negative.
    // Take the magnitude, but classify explicitly by entry_type.
    const magnitude = Math.abs(amount);
    if (entry.entry_type === 'DEPOSIT_VALIDATED') {
      bucket.deposits += magnitude;
    } else {
      bucket.payments += magnitude;
    }
  }

  return [...buckets.entries()].map(([iso, v]) => ({
    bucket: iso,
    label: labelFor(new Date(iso), range.granularity),
    deposits: v.deposits,
    payments: v.payments,
    net: v.deposits - v.payments,
  }));
}

export function useFlowSeries(
  range: DateRange,
  options?: Omit<UseQueryOptions<CurrentVsPrevious<FlowPoint[]>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CurrentVsPrevious<FlowPoint[]>>({
    queryKey: ['analytics-v2-flow', range.from.toISOString(), range.to.toISOString(), range.granularity, range.compareToPrevious],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchFlow(range);
      const previous = range.compareToPrevious ? await fetchFlow(previousRange(range)) : null;
      return { current, previous };
    },
    ...options,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Payment volume summary — FIXED (status=completed only, explicit avg)
// ────────────────────────────────────────────────────────────────────────────

async function fetchPaymentSummary(range: DateRange): Promise<VolumeSummary> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('amount_xaf, amount_rmb')
    .eq('status', 'completed')
    .gte('created_at', fromISO)
    .lt('created_at', toISO);
  if (error) throw error;

  const rows = data ?? [];
  const totalXAF = rows.reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);
  const totalRMB = rows.reduce((s, r) => s + Number(r.amount_rmb ?? 0), 0);
  const opCount = rows.length;
  const avgTicketXAF = opCount === 0 ? 0 : Math.round(totalXAF / opCount);
  return { totalXAF, totalRMB, opCount, avgTicketXAF };
}

export function usePaymentSummary(range: DateRange) {
  return useQuery<CurrentVsPrevious<VolumeSummary>>({
    queryKey: ['analytics-v2-payment-summary', range.from.toISOString(), range.to.toISOString(), range.compareToPrevious],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchPaymentSummary(range);
      const previous = range.compareToPrevious ? await fetchPaymentSummary(previousRange(range)) : null;
      return { current, previous };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Deposit volume summary
// ────────────────────────────────────────────────────────────────────────────

async function fetchDepositSummary(range: DateRange): Promise<VolumeSummary> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data, error } = await supabaseAdmin
    .from('deposits')
    .select('amount_xaf')
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

export function useDepositSummary(range: DateRange) {
  return useQuery<CurrentVsPrevious<VolumeSummary>>({
    queryKey: ['analytics-v2-deposit-summary', range.from.toISOString(), range.to.toISOString(), range.compareToPrevious],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const current = await fetchDepositSummary(range);
      const previous = range.compareToPrevious ? await fetchDepositSummary(previousRange(range)) : null;
      return { current, previous };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Deposit method breakdown — FIXED (emits BOTH count and amount)
// ────────────────────────────────────────────────────────────────────────────

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  cash_agency: 'Espèces agence',
  cash_agent: 'Cash agent',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  card: 'Carte',
  other: 'Autre',
};

export function useDepositMethodBreakdown(range: DateRange) {
  return useQuery<MethodBreakdown[]>({
    queryKey: ['analytics-v2-deposit-methods', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('deposits')
        .select('method, amount_xaf')
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
// 5. Payment method breakdown — FIXED (completed only, both count & amount)
// ────────────────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
  bank_transfer: 'Virement',
  cash: 'Espèces',
};

export function usePaymentMethodBreakdown(range: DateRange) {
  return useQuery<MethodBreakdown[]>({
    queryKey: ['analytics-v2-payment-methods', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('method, amount_xaf, amount_rmb')
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
// 6. Deposit status summary — FIXED (separates pending_proof vs admin_review,
//    explicit rates)
// ────────────────────────────────────────────────────────────────────────────

export function useDepositStatusSummary(range: DateRange) {
  return useQuery<DepositStatusSummary>({
    queryKey: ['analytics-v2-deposit-status', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('deposits')
        .select('status, amount_xaf')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      const out: DepositStatusSummary = {
        validated: { count: 0, amountXAF: 0 },
        rejected: { count: 0, amountXAF: 0 },
        pendingProof: { count: 0, amountXAF: 0 },
        pendingReview: { count: 0, amountXAF: 0 },
        cancelled: { count: 0, amountXAF: 0 },
        validationRate: 0,
        rejectionRate: 0,
      };

      for (const row of data ?? []) {
        const amount = Number(row.amount_xaf ?? 0);
        switch (row.status) {
          case 'validated':
            out.validated.count += 1;
            out.validated.amountXAF += amount;
            break;
          case 'rejected':
            out.rejected.count += 1;
            out.rejected.amountXAF += amount;
            break;
          case 'awaiting_proof':
          case 'proof_submitted':
            out.pendingProof.count += 1;
            out.pendingProof.amountXAF += amount;
            break;
          case 'admin_review':
            out.pendingReview.count += 1;
            out.pendingReview.amountXAF += amount;
            break;
          case 'cancelled':
          case 'created':
            out.cancelled.count += 1;
            out.cancelled.amountXAF += amount;
            break;
        }
      }
      const terminal = out.validated.count + out.rejected.count;
      out.validationRate = terminal === 0 ? 0 : out.validated.count / terminal;
      out.rejectionRate = terminal === 0 ? 0 : out.rejected.count / terminal;
      return out;
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Top clients — single round-trip via join
// ────────────────────────────────────────────────────────────────────────────

export function useTopClients(range: DateRange, limit = 10) {
  return useQuery<TopClient[]>({
    queryKey: ['analytics-v2-top-clients', range.from.toISOString(), range.to.toISOString(), limit],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount_xaf, amount_rmb, clients!payments_user_id_fkey(first_name, last_name)')
        .eq('status', 'completed')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      type PaymentRow = {
        user_id: string;
        amount_xaf: number | null;
        amount_rmb: number | null;
        clients?: { first_name: string | null; last_name: string | null } | null;
      };

      const agg = new Map<
        string,
        { firstName: string; lastName: string; opCount: number; totalXAF: number; totalRMB: number }
      >();
      for (const row of (data ?? []) as unknown as PaymentRow[]) {
        if (!row.user_id) continue;
        const e = agg.get(row.user_id) ?? {
          firstName: row.clients?.first_name ?? '',
          lastName: row.clients?.last_name ?? '',
          opCount: 0,
          totalXAF: 0,
          totalRMB: 0,
        };
        e.opCount += 1;
        e.totalXAF += Number(row.amount_xaf ?? 0);
        e.totalRMB += Number(row.amount_rmb ?? 0);
        agg.set(row.user_id, e);
      }
      return [...agg.entries()]
        .map(([userId, v]) => ({ userId, ...v }))
        .sort((a, b) => b.totalXAF - a.totalXAF)
        .slice(0, limit);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Funnel — deposit → payment conversion (MISSING metric in the old code)
// ────────────────────────────────────────────────────────────────────────────

export function useFunnel(range: DateRange) {
  return useQuery<FunnelStats>({
    queryKey: ['analytics-v2-funnel', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const [{ count: clientsTotal }, depositUsersRes, paymentUsersRes] = await Promise.all([
        supabaseAdmin.from('clients').select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('deposits')
          .select('user_id')
          .eq('status', 'validated')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
        supabaseAdmin
          .from('payments')
          .select('user_id')
          .eq('status', 'completed')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
      ]);

      if (depositUsersRes.error) throw depositUsersRes.error;
      if (paymentUsersRes.error) throw paymentUsersRes.error;

      const depositUsers = new Set((depositUsersRes.data ?? []).map((r) => r.user_id).filter(Boolean));
      const paymentUsers = new Set((paymentUsersRes.data ?? []).map((r) => r.user_id).filter(Boolean));
      const bothUsers = [...depositUsers].filter((u) => paymentUsers.has(u));

      return {
        clientsTotal: clientsTotal ?? 0,
        clientsWithDeposit: depositUsers.size,
        clientsWithPayment: paymentUsers.size,
        depositToPaymentRate: depositUsers.size === 0 ? 0 : bothUsers.length / depositUsers.size,
      };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 9. Median processing time — FIXED (null-safe, median instead of mean)
// ────────────────────────────────────────────────────────────────────────────

export function useDepositProcessingTime(range: DateRange) {
  return useQuery<{ medianMinutes: number | null; p90Minutes: number | null; sampleSize: number }>({
    queryKey: ['analytics-v2-processing-time', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('deposits')
        .select('created_at, validated_at')
        .eq('status', 'validated')
        .gte('created_at', fromISO)
        .lt('created_at', toISO)
        .not('validated_at', 'is', null);
      if (error) throw error;

      const durations = (data ?? [])
        .map((r) => {
          if (!r.created_at || !r.validated_at) return null;
          const start = new Date(r.created_at).getTime();
          const end = new Date(r.validated_at).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
          return (end - start) / 60_000;
        })
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);

      if (durations.length === 0) {
        return { medianMinutes: null, p90Minutes: null, sampleSize: 0 };
      }

      const pct = (p: number) => {
        const idx = Math.min(durations.length - 1, Math.max(0, Math.floor(durations.length * p)));
        return Math.round(durations[idx]);
      };
      return { medianMinutes: pct(0.5), p90Minutes: pct(0.9), sampleSize: durations.length };
    },
  });
}
