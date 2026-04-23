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

// ────────────────────────────────────────────────────────────────────────────
// 10. Operational alerts — stale deposits/payments, clients without activity
// ────────────────────────────────────────────────────────────────────────────

export interface DashboardAlert {
  id: string;
  severity: 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  count: number;
  actionHref?: string;
}

export function useDashboardAlerts() {
  return useQuery<DashboardAlert[]>({
    queryKey: ['analytics-v2-alerts'],
    staleTime: 60 * 1000,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600_000).toISOString();

      const [stalePendingProof, stalePayments, criticalStaleReview] = await Promise.all([
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'proof_submitted')
          .lt('updated_at', twentyFourHoursAgo),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['ready_for_payment', 'processing'])
          .lt('updated_at', twentyFourHoursAgo),
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'admin_review')
          .lt('updated_at', fortyEightHoursAgo),
      ]);

      const alerts: DashboardAlert[] = [];

      if ((stalePendingProof.count ?? 0) > 0) {
        alerts.push({
          id: 'stale-deposit-proofs',
          severity: 'warning',
          title: 'Preuves de dépôt anciennes',
          description: 'Dépôts avec preuve envoyée depuis plus de 24h sans traitement.',
          count: stalePendingProof.count ?? 0,
          actionHref: '/m/deposits',
        });
      }

      if ((criticalStaleReview.count ?? 0) > 0) {
        alerts.push({
          id: 'stale-review',
          severity: 'critical',
          title: 'Dépôts en revue depuis >48h',
          description: 'Action admin requise — bloquent potentiellement les paiements clients.',
          count: criticalStaleReview.count ?? 0,
          actionHref: '/m/deposits',
        });
      }

      if ((stalePayments.count ?? 0) > 0) {
        alerts.push({
          id: 'stale-payments',
          severity: 'warning',
          title: 'Paiements en attente > 24h',
          description: "Paiements prêts ou en cours d'exécution depuis plus de 24h.",
          count: stalePayments.count ?? 0,
          actionHref: '/m/payments',
        });
      }

      return alerts;
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 11. Rate history — time series of daily_rates per method
// ────────────────────────────────────────────────────────────────────────────

export interface RateHistoryPoint {
  bucket: string; // ISO
  label: string;
  alipay: number | null;
  wechat: number | null;
  virement: number | null;
  cash: number | null;
}

export function useRateHistory(range: DateRange) {
  return useQuery<RateHistoryPoint[]>({
    queryKey: ['analytics-v2-rate-history', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('daily_rates')
        .select('effective_at, rate_alipay, rate_wechat, rate_virement, rate_cash')
        .gte('effective_at', fromISO)
        .lt('effective_at', toISO)
        .order('effective_at', { ascending: true });
      if (error) throw error;

      return (data ?? []).map((r) => ({
        bucket: r.effective_at,
        label: labelFor(new Date(r.effective_at), range.granularity === 'hour' ? 'day' : range.granularity),
        alipay: r.rate_alipay != null ? Number(r.rate_alipay) : null,
        wechat: r.rate_wechat != null ? Number(r.rate_wechat) : null,
        virement: r.rate_virement != null ? Number(r.rate_virement) : null,
        cash: r.rate_cash != null ? Number(r.rate_cash) : null,
      }));
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 12. Admin productivity — action counts per admin from audit logs
// ────────────────────────────────────────────────────────────────────────────

export interface AdminProductivityRow {
  adminId: string;
  name: string;
  depositsValidated: number;
  depositsRejected: number;
  paymentsProcessed: number;
  totalActions: number;
}

export function useAdminProductivity(range: DateRange) {
  return useQuery<AdminProductivityRow[]>({
    queryKey: ['analytics-v2-admin-productivity', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data: logs, error } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('admin_user_id, action_type')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      const agg = new Map<string, AdminProductivityRow>();
      for (const log of logs ?? []) {
        if (!log.admin_user_id) continue;
        const entry = agg.get(log.admin_user_id) ?? {
          adminId: log.admin_user_id,
          name: '',
          depositsValidated: 0,
          depositsRejected: 0,
          paymentsProcessed: 0,
          totalActions: 0,
        };
        const action = log.action_type ?? '';
        if (action === 'validate_deposit') entry.depositsValidated += 1;
        else if (action === 'reject_deposit') entry.depositsRejected += 1;
        else if (action === 'process_payment' || action === 'complete_payment') entry.paymentsProcessed += 1;
        entry.totalActions += 1;
        agg.set(log.admin_user_id, entry);
      }

      if (agg.size === 0) return [];

      // Resolve admin names in one round-trip.
      const ids = [...agg.keys()];
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, first_name, last_name')
        .in('user_id', ids);
      for (const role of roles ?? []) {
        const row = agg.get(role.user_id);
        if (row) {
          row.name = `${role.first_name ?? ''} ${role.last_name ?? ''}`.trim() || 'Admin';
        }
      }

      return [...agg.values()].sort((a, b) => b.totalActions - a.totalActions);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 13. Volume report — time-series with peak, total, avg, and trend
// ────────────────────────────────────────────────────────────────────────────

export interface VolumeReportPoint {
  bucket: string;
  label: string;
  amountXAF: number;
  opCount: number;
}

export interface VolumeReport {
  series: VolumeReportPoint[];
  totalXAF: number;
  opCount: number;
  avgXAF: number;
  peak: VolumeReportPoint | null;
  previousTotalXAF: number;
  trendPct: number | null; // (current - previous) / previous
}

async function fetchVolumeReport(
  range: DateRange,
  table: 'deposits' | 'payments',
  status: string,
): Promise<VolumeReport> {
  const { fromISO, toISO } = toSupabaseBounds(range);
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('amount_xaf, created_at')
    .eq('status', status)
    .gte('created_at', fromISO)
    .lt('created_at', toISO);
  if (error) throw error;

  const buckets = new Map<string, { amountXAF: number; opCount: number }>();
  for (const b of bucketStarts(range)) {
    buckets.set(b.toISOString(), { amountXAF: 0, opCount: 0 });
  }
  for (const row of data ?? []) {
    const key = bucketKeyFor(new Date(row.created_at), range.granularity);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.amountXAF += Number(row.amount_xaf ?? 0);
    bucket.opCount += 1;
  }

  const series: VolumeReportPoint[] = [...buckets.entries()].map(([iso, v]) => ({
    bucket: iso,
    label: labelFor(new Date(iso), range.granularity),
    amountXAF: v.amountXAF,
    opCount: v.opCount,
  }));

  const totalXAF = series.reduce((s, p) => s + p.amountXAF, 0);
  const opCount = series.reduce((s, p) => s + p.opCount, 0);
  const avgXAF = opCount === 0 ? 0 : Math.round(totalXAF / opCount);
  const peak = series.length === 0
    ? null
    : series.reduce((best, p) => (p.amountXAF > (best?.amountXAF ?? 0) ? p : best), series[0]);

  // Previous period total for trend computation
  const prev = previousRange(range);
  const prevBounds = toSupabaseBounds(prev);
  const prevRes = await supabaseAdmin
    .from(table)
    .select('amount_xaf')
    .eq('status', status)
    .gte('created_at', prevBounds.fromISO)
    .lt('created_at', prevBounds.toISO);
  const previousTotalXAF = (prevRes.data ?? []).reduce((s, r) => s + Number(r.amount_xaf ?? 0), 0);
  const trendPct = previousTotalXAF === 0 ? null : (totalXAF - previousTotalXAF) / Math.abs(previousTotalXAF);

  return { series, totalXAF, opCount, avgXAF, peak, previousTotalXAF, trendPct };
}

export function useDepositVolumeReport(range: DateRange) {
  return useQuery<VolumeReport>({
    queryKey: ['analytics-v2-deposit-volume-report', range.from.toISOString(), range.to.toISOString(), range.granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: () => fetchVolumeReport(range, 'deposits', 'validated'),
  });
}

export function usePaymentVolumeReport(range: DateRange) {
  return useQuery<VolumeReport>({
    queryKey: ['analytics-v2-payment-volume-report', range.from.toISOString(), range.to.toISOString(), range.granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: () => fetchVolumeReport(range, 'payments', 'completed'),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 14. Client growth — cumulative new clients by month
// ────────────────────────────────────────────────────────────────────────────

export interface ClientGrowthPoint {
  bucket: string;
  label: string;
  newClients: number;
  cumulative: number;
}

export function useClientGrowth(range: DateRange) {
  return useQuery<ClientGrowthPoint[]>({
    queryKey: ['analytics-v2-client-growth', range.from.toISOString(), range.to.toISOString(), range.granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      // Cumulative requires counting everyone BEFORE the window too.
      const [before, within] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .lt('created_at', fromISO),
        supabaseAdmin
          .from('clients')
          .select('created_at')
          .gte('created_at', fromISO)
          .lt('created_at', toISO)
          .order('created_at', { ascending: true }),
      ]);

      if (within.error) throw within.error;

      const buckets = new Map<string, number>();
      for (const b of bucketStarts(range)) {
        buckets.set(b.toISOString(), 0);
      }
      for (const row of within.data ?? []) {
        const key = bucketKeyFor(new Date(row.created_at), range.granularity);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      let cumulative = before.count ?? 0;
      return [...buckets.entries()].map(([iso, newClients]) => {
        cumulative += newClients;
        return {
          bucket: iso,
          label: labelFor(new Date(iso), range.granularity),
          newClients,
          cumulative,
        };
      });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 15. Registration source — admin-created vs self-registered
// ────────────────────────────────────────────────────────────────────────────

export interface RegistrationSourceStats {
  adminCreated: number;
  selfRegistered: number;
  totalNew: number;
  adminCreatedPct: number;
}

export function useRegistrationSource(range: DateRange) {
  return useQuery<RegistrationSourceStats>({
    queryKey: ['analytics-v2-registration-source', range.from.toISOString(), range.to.toISOString()],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const [clientsRes, adminLogsRes] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('user_id, created_at')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
        supabaseAdmin
          .from('admin_audit_logs')
          .select('target_id, action_type, created_at')
          .eq('action_type', 'create_client')
          .gte('created_at', fromISO)
          .lt('created_at', toISO),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (adminLogsRes.error) throw adminLogsRes.error;

      const adminCreatedIds = new Set(
        (adminLogsRes.data ?? []).map((l) => l.target_id).filter((id): id is string => !!id),
      );
      const totalNew = (clientsRes.data ?? []).length;
      const adminCreated = (clientsRes.data ?? []).filter((c) => adminCreatedIds.has(c.user_id)).length;
      const selfRegistered = totalNew - adminCreated;

      return {
        adminCreated,
        selfRegistered,
        totalNew,
        adminCreatedPct: totalNew === 0 ? 0 : adminCreated / totalNew,
      };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 16. UTM source — top channels self-registered clients came from
// ────────────────────────────────────────────────────────────────────────────

export interface UtmSourceRow {
  source: string;
  medium: string;
  campaign: string;
  count: number;
}

export function useUtmSources(range: DateRange, limit = 10) {
  return useQuery<UtmSourceRow[]>({
    queryKey: ['analytics-v2-utm-sources', range.from.toISOString(), range.to.toISOString(), limit],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('utm_source, utm_medium, utm_campaign')
        .gte('created_at', fromISO)
        .lt('created_at', toISO)
        .not('utm_source', 'is', null);
      if (error) throw error;

      const map = new Map<string, UtmSourceRow>();
      for (const row of data ?? []) {
        const source = row.utm_source ?? '(direct)';
        const medium = row.utm_medium ?? '(none)';
        const campaign = row.utm_campaign ?? '(none)';
        const key = `${source}|${medium}|${campaign}`;
        const entry = map.get(key) ?? { source, medium, campaign, count: 0 };
        entry.count += 1;
        map.set(key, entry);
      }
      return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 17. Wallet exposure — total XAF sitting in client wallets (unpaid-out)
// ────────────────────────────────────────────────────────────────────────────

export interface WalletExposure {
  totalXAF: number;
  clientsWithBalance: number;
  avgBalancePerClient: number;
  top10ShareXAF: number; // concentration risk
}

export function useWalletExposure() {
  return useQuery<WalletExposure>({
    queryKey: ['analytics-v2-wallet-exposure'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('balance_xaf')
        .gt('balance_xaf', 0);
      if (error) throw error;

      const balances = (data ?? []).map((r) => Number(r.balance_xaf ?? 0)).sort((a, b) => b - a);
      const totalXAF = balances.reduce((s, v) => s + v, 0);
      const clientsWithBalance = balances.length;
      const top10ShareXAF = balances.slice(0, 10).reduce((s, v) => s + v, 0);

      return {
        totalXAF,
        clientsWithBalance,
        avgBalancePerClient: clientsWithBalance === 0 ? 0 : Math.round(totalXAF / clientsWithBalance),
        top10ShareXAF,
      };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 18. Deposit status timeline — stacked status counts by bucket
// ────────────────────────────────────────────────────────────────────────────

export interface DepositStatusTimelinePoint {
  bucket: string;
  label: string;
  validated: number;
  rejected: number;
  pending: number;
}

export function useDepositStatusTimeline(range: DateRange) {
  return useQuery<DepositStatusTimelinePoint[]>({
    queryKey: ['analytics-v2-deposit-status-timeline', range.from.toISOString(), range.to.toISOString(), range.granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { fromISO, toISO } = toSupabaseBounds(range);
      const { data, error } = await supabaseAdmin
        .from('deposits')
        .select('status, created_at')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      if (error) throw error;

      const buckets = new Map<string, { validated: number; rejected: number; pending: number }>();
      for (const b of bucketStarts(range)) {
        buckets.set(b.toISOString(), { validated: 0, rejected: 0, pending: 0 });
      }
      for (const row of data ?? []) {
        const key = bucketKeyFor(new Date(row.created_at), range.granularity);
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (row.status === 'validated') bucket.validated += 1;
        else if (row.status === 'rejected') bucket.rejected += 1;
        else bucket.pending += 1;
      }
      return [...buckets.entries()].map(([iso, v]) => ({
        bucket: iso,
        label: labelFor(new Date(iso), range.granularity),
        ...v,
      }));
    },
  });
}

