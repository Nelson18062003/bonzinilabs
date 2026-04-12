import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';

// ============================================================================
// DASHBOARD ANALYTICS HOOKS
// All queries use supabaseAdmin (admin context only)
// ============================================================================

const ANALYTICS_STALE = 60 * 1000; // 1 minute
const ANALYTICS_GC = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── 1. Financial Flow (Deposits vs Payments by day) ─────────

export interface DailyFlowPoint {
  day: string;       // "Lun", "Mar", etc.
  date: string;      // ISO date
  deposits: number;  // XAF
  payments: number;  // XAF
}

export function useFinancialFlowData(days: number = 7) {
  return useQuery({
    queryKey: ['analytics-financial-flow', days],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = daysAgo(days);

      // Fetch validated deposits and executed payments from ledger_entries
      const { data: entries, error } = await supabaseAdmin
        .from('ledger_entries')
        .select('entry_type, amount_xaf, created_at')
        .in('entry_type', ['DEPOSIT_VALIDATED', 'PAYMENT_EXECUTED'])
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const buckets = new Map<string, { deposits: number; payments: number }>();

      // Initialize buckets for each day
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        buckets.set(key, { deposits: 0, payments: 0 });
      }

      // Fill buckets
      for (const entry of entries || []) {
        const key = new Date(entry.created_at).toISOString().split('T')[0];
        const bucket = buckets.get(key);
        if (!bucket) continue;
        const amount = Math.abs(entry.amount_xaf);
        if (entry.entry_type === 'DEPOSIT_VALIDATED') {
          bucket.deposits += amount;
        } else {
          bucket.payments += amount;
        }
      }

      const result: DailyFlowPoint[] = [];
      for (const [dateKey, vals] of buckets) {
        const d = new Date(dateKey + 'T00:00:00');
        result.push({
          day: dayNames[d.getDay()],
          date: dateKey,
          deposits: vals.deposits,
          payments: vals.payments,
        });
      }

      return result;
    },
  });
}

// ── 2. Monthly Volume Trend ─────────────────────────────────

export interface MonthlyVolumePoint {
  month: string;
  deposits: number;
  payments: number;
  total: number;
}

export function useMonthlyVolumeTrend(months: number = 6) {
  return useQuery({
    queryKey: ['analytics-monthly-volume', months],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(months);
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

      const { data: entries, error } = await supabaseAdmin
        .from('ledger_entries')
        .select('entry_type, amount_xaf, created_at')
        .in('entry_type', ['DEPOSIT_VALIDATED', 'PAYMENT_EXECUTED'])
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const buckets = new Map<string, { deposits: number; payments: number }>();

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, { deposits: 0, payments: 0 });
      }

      for (const entry of entries || []) {
        const d = new Date(entry.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        const amount = Math.abs(entry.amount_xaf);
        if (entry.entry_type === 'DEPOSIT_VALIDATED') bucket.deposits += amount;
        else bucket.payments += amount;
      }

      const result: MonthlyVolumePoint[] = [];
      for (const [key, vals] of buckets) {
        const [, m] = key.split('-');
        result.push({
          month: monthNames[parseInt(m) - 1],
          deposits: vals.deposits,
          payments: vals.payments,
          total: vals.deposits + vals.payments,
        });
      }

      return result;
    },
  });
}

// ── 3. Deposit Method Breakdown ─────────────────────────────

export interface MethodBreakdownItem {
  method: string;
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export function useDepositMethodBreakdown() {
  return useQuery({
    queryKey: ['analytics-deposit-methods'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(3);

      const { data: deposits, error } = await supabaseAdmin
        .from('deposits')
        .select('method, amount_xaf')
        .eq('status', 'validated')
        .gte('created_at', since);

      if (error) throw error;

      const METHOD_LABELS: Record<string, string> = {
        bank_transfer: 'Virement bancaire',
        bank_cash: 'Dépôt en banque',
        agency_cash: 'Agence Bonzini',
        om_transfer: 'Orange Money',
        om_withdrawal: 'Retrait OM',
        mtn_transfer: 'MTN Money',
        mtn_withdrawal: 'Retrait MTN',
        wave: 'Wave',
      };

      const groups = new Map<string, { count: number; amount: number }>();
      let total = 0;

      for (const d of deposits || []) {
        const method = d.method || 'other';
        if (!groups.has(method)) groups.set(method, { count: 0, amount: 0 });
        const g = groups.get(method)!;
        g.count += 1;
        g.amount += d.amount_xaf || 0;
        total += 1;
      }

      const result: MethodBreakdownItem[] = [];
      for (const [method, vals] of groups) {
        result.push({
          method,
          label: METHOD_LABELS[method] || method,
          count: vals.count,
          amount: vals.amount,
          percentage: total > 0 ? Math.round((vals.count / total) * 100) : 0,
        });
      }

      return result.sort((a, b) => b.count - a.count);
    },
  });
}

// ── 4. Payment Method Breakdown ─────────────────────────────

export function usePaymentMethodBreakdown() {
  return useQuery({
    queryKey: ['analytics-payment-methods'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(3);

      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('method, amount_xaf, amount_rmb')
        .in('status', ['completed', 'processing', 'ready_for_payment'])
        .gte('created_at', since);

      if (error) throw error;

      const METHOD_LABELS: Record<string, string> = {
        alipay: 'Alipay',
        wechat: 'WeChat',
        bank_transfer: 'Virement',
        cash: 'Cash',
      };

      const groups = new Map<string, { count: number; amountXAF: number; amountRMB: number }>();
      let total = 0;

      for (const p of payments || []) {
        const method = p.method || 'other';
        if (!groups.has(method)) groups.set(method, { count: 0, amountXAF: 0, amountRMB: 0 });
        const g = groups.get(method)!;
        g.count += 1;
        g.amountXAF += p.amount_xaf || 0;
        g.amountRMB += p.amount_rmb || 0;
        total += 1;
      }

      const result = [];
      for (const [method, vals] of groups) {
        result.push({
          method,
          label: METHOD_LABELS[method] || method,
          count: vals.count,
          amountXAF: vals.amountXAF,
          amountRMB: vals.amountRMB,
          percentage: total > 0 ? Math.round((vals.count / total) * 100) : 0,
        });
      }

      return result.sort((a, b) => b.count - a.count);
    },
  });
}

// ── 5. Payment Volume Stats (CNY + Average) ─────────────────

export interface PaymentVolumeStats {
  totalRMB30d: number;
  totalXAF30d: number;
  avgPaymentXAF: number;
  avgPaymentRMB: number;
  totalCount30d: number;
  trendRMB: number; // % change vs previous 30d
}

export function usePaymentVolumeStats() {
  return useQuery({
    queryKey: ['analytics-payment-volume'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since30 = daysAgo(30);
      const since60 = daysAgo(60);

      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('amount_xaf, amount_rmb, created_at')
        .eq('status', 'completed')
        .gte('created_at', since60);

      if (error) throw error;

      let current = { totalXAF: 0, totalRMB: 0, count: 0 };
      let previous = { totalXAF: 0, totalRMB: 0, count: 0 };

      for (const p of payments || []) {
        if (p.created_at >= since30) {
          current.totalXAF += p.amount_xaf || 0;
          current.totalRMB += p.amount_rmb || 0;
          current.count += 1;
        } else {
          previous.totalXAF += p.amount_xaf || 0;
          previous.totalRMB += p.amount_rmb || 0;
          previous.count += 1;
        }
      }

      const trendRMB = previous.totalRMB > 0
        ? Math.round(((current.totalRMB - previous.totalRMB) / previous.totalRMB) * 100)
        : 0;

      return {
        totalRMB30d: current.totalRMB,
        totalXAF30d: current.totalXAF,
        avgPaymentXAF: current.count > 0 ? Math.round(current.totalXAF / current.count) : 0,
        avgPaymentRMB: current.count > 0 ? Math.round(current.totalRMB / current.count) : 0,
        totalCount30d: current.count,
        trendRMB,
      } satisfies PaymentVolumeStats;
    },
  });
}

// ── 6. Top Clients by Volume ────────────────────────────────

export interface TopClientItem {
  userId: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  totalVolume: number;
  paymentCount: number;
}

export function useTopClients(limit: number = 5) {
  return useQuery({
    queryKey: ['analytics-top-clients', limit],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(1);

      // Get completed payments from last 30 days
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount_xaf')
        .eq('status', 'completed')
        .gte('created_at', since);

      if (error) throw error;

      // Aggregate by user
      const userMap = new Map<string, { total: number; count: number }>();
      for (const p of payments || []) {
        if (!userMap.has(p.user_id)) userMap.set(p.user_id, { total: 0, count: 0 });
        const u = userMap.get(p.user_id)!;
        u.total += p.amount_xaf || 0;
        u.count += 1;
      }

      // Sort and take top N
      const sorted = [...userMap.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, limit);

      if (sorted.length === 0) return [];

      // Fetch client names
      const userIds = sorted.map(([id]) => id);
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, company_name')
        .in('user_id', userIds);

      const clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      return sorted.map(([userId, vals]) => {
        const client = clientMap.get(userId);
        return {
          userId,
          firstName: client?.first_name || '?',
          lastName: client?.last_name || '',
          companyName: client?.company_name || null,
          totalVolume: vals.total,
          paymentCount: vals.count,
        } satisfies TopClientItem;
      });
    },
  });
}

// ── 7. Client Growth Data ───────────────────────────────────

export interface ClientGrowthPoint {
  month: string;
  total: number;
  newClients: number;
}

export function useClientGrowthData(months: number = 6) {
  return useQuery({
    queryKey: ['analytics-client-growth', months],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { data: clients, error } = await supabaseAdmin
        .from('clients')
        .select('created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

      // Count clients by month
      const monthlyNew = new Map<string, number>();
      for (const c of clients || []) {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyNew.set(key, (monthlyNew.get(key) || 0) + 1);
      }

      // Build cumulative result for last N months
      const result: ClientGrowthPoint[] = [];
      let cumulative = 0;

      // Count all clients before the window
      const windowStart = new Date();
      windowStart.setMonth(windowStart.getMonth() - months);

      for (const c of clients || []) {
        if (new Date(c.created_at) < windowStart) cumulative++;
      }

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const newCount = monthlyNew.get(key) || 0;
        cumulative += newCount;

        result.push({
          month: monthNames[d.getMonth()],
          total: cumulative,
          newClients: newCount,
        });
      }

      return result;
    },
  });
}

// ── 8. Deposit Status Breakdown ─────────────────────────────

export interface DepositStatusBreakdown {
  validated: number;
  pending: number;
  rejected: number;
  validationRate: number;
  rejectionRate: number;
}

export function useDepositStatusBreakdown() {
  return useQuery({
    queryKey: ['analytics-deposit-status'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(3);

      const [validatedRes, rejectedRes, pendingRes] = await Promise.all([
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'validated')
          .gte('created_at', since),
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'rejected')
          .gte('created_at', since),
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .in('status', ['proof_submitted', 'admin_review', 'awaiting_proof', 'pending_correction'])
          .gte('created_at', since),
      ]);

      const validated = validatedRes.count || 0;
      const rejected = rejectedRes.count || 0;
      const pending = pendingRes.count || 0;
      const total = validated + rejected + pending;

      return {
        validated,
        pending,
        rejected,
        validationRate: total > 0 ? Math.round((validated / total) * 100) : 0,
        rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
      } satisfies DepositStatusBreakdown;
    },
  });
}

// ── 9. Average Processing Time (Deposits) ───────────────────

export function useAvgProcessingTime() {
  return useQuery({
    queryKey: ['analytics-processing-time'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = daysAgo(30);

      const { data: deposits, error } = await supabaseAdmin
        .from('deposits')
        .select('created_at, validated_at')
        .eq('status', 'validated')
        .not('validated_at', 'is', null)
        .gte('created_at', since);

      if (error) throw error;

      if (!deposits || deposits.length === 0) return { avgMinutes: 0, count: 0 };

      let totalMs = 0;
      let count = 0;
      for (const d of deposits) {
        if (d.validated_at) {
          totalMs += new Date(d.validated_at).getTime() - new Date(d.created_at).getTime();
          count++;
        }
      }

      return {
        avgMinutes: count > 0 ? Math.round(totalMs / count / 60000) : 0,
        count,
      };
    },
  });
}

// ── 10. Admin Productivity ──────────────────────────────────

export interface AdminProductivityItem {
  adminId: string;
  firstName: string;
  lastName: string;
  depositValidations: number;
  paymentProcessed: number;
  total: number;
}

export function useAdminProductivity() {
  return useQuery({
    queryKey: ['analytics-admin-productivity'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = daysAgo(7);

      const { data: logs, error } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('admin_user_id, action_type')
        .in('action_type', ['validate_deposit', 'reject_deposit', 'process_payment', 'complete_payment'])
        .gte('created_at', since);

      if (error) throw error;

      const adminMap = new Map<string, { deposits: number; payments: number }>();
      for (const log of logs || []) {
        if (!adminMap.has(log.admin_user_id)) {
          adminMap.set(log.admin_user_id, { deposits: 0, payments: 0 });
        }
        const a = adminMap.get(log.admin_user_id)!;
        if (log.action_type.includes('deposit')) a.deposits++;
        else a.payments++;
      }

      if (adminMap.size === 0) return [];

      // Fetch admin names
      const adminIds = [...adminMap.keys()];
      const { data: admins } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, first_name, last_name')
        .in('user_id', adminIds);

      const nameMap = new Map(admins?.map(a => [a.user_id, a]) || []);

      const result: AdminProductivityItem[] = [];
      for (const [adminId, vals] of adminMap) {
        const admin = nameMap.get(adminId);
        result.push({
          adminId,
          firstName: admin?.first_name || 'Admin',
          lastName: admin?.last_name || '',
          depositValidations: vals.deposits,
          paymentProcessed: vals.payments,
          total: vals.deposits + vals.payments,
        });
      }

      return result.sort((a, b) => b.total - a.total);
    },
  });
}

// ── 11. Rate History for Chart ──────────────────────────────

export interface RateHistoryPoint {
  date: string;
  label: string;
  alipay: number;
  wechat: number;
  virement: number;
  cash: number;
}

export function useRateHistoryData(days: number = 7) {
  return useQuery({
    queryKey: ['analytics-rate-history', days],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = daysAgo(days);

      const { data: rates, error } = await supabaseAdmin
        .from('daily_rates')
        .select('rate_alipay, rate_wechat, rate_virement, rate_cash, effective_at')
        .gte('effective_at', since)
        .order('effective_at', { ascending: true });

      if (error) throw error;

      return (rates || []).map(r => {
        const d = new Date(r.effective_at);
        return {
          date: r.effective_at,
          label: `${d.getDate()} ${['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][d.getMonth()]}`,
          alipay: r.rate_alipay,
          wechat: r.rate_wechat,
          virement: r.rate_virement,
          cash: r.rate_cash,
        } satisfies RateHistoryPoint;
      });
    },
  });
}

// ── 12. Alerts / Anomalies ──────────────────────────────────

export interface DashboardAlert {
  type: 'warning' | 'danger' | 'info';
  message: string;
  count?: number;
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ['analytics-alerts'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const yesterday = daysAgo(1);
      const alerts: DashboardAlert[] = [];

      // Check for stale deposits (pending for >24h)
      const { count: staleDeposits } = await supabaseAdmin
        .from('deposits')
        .select('id', { count: 'exact', head: true })
        .in('status', ['proof_submitted', 'admin_review'])
        .lt('created_at', yesterday);

      if (staleDeposits && staleDeposits > 0) {
        alerts.push({
          type: 'warning',
          message: `${staleDeposits} dépôt${staleDeposits > 1 ? 's' : ''} en attente depuis +24h`,
          count: staleDeposits,
        });
      }

      // Check for stale payments
      const { count: stalePayments } = await supabaseAdmin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['ready_for_payment', 'processing'])
        .lt('created_at', yesterday);

      if (stalePayments && stalePayments > 0) {
        alerts.push({
          type: 'danger',
          message: `${stalePayments} paiement${stalePayments > 1 ? 's' : ''} non traité${stalePayments > 1 ? 's' : ''} depuis +24h`,
          count: stalePayments,
        });
      }

      // Check for new clients without first deposit
      const { data: newClients } = await supabaseAdmin
        .from('clients')
        .select('user_id')
        .gte('created_at', daysAgo(7));

      if (newClients && newClients.length > 0) {
        const userIds = newClients.map(c => c.user_id);
        const { data: deposits } = await supabaseAdmin
          .from('deposits')
          .select('user_id')
          .in('user_id', userIds);

        const clientsWithDeposit = new Set(deposits?.map(d => d.user_id) || []);
        const noDeposit = userIds.filter(id => !clientsWithDeposit.has(id));

        if (noDeposit.length > 0) {
          alerts.push({
            type: 'info',
            message: `${noDeposit.length} nouveau${noDeposit.length > 1 ? 'x' : ''} client${noDeposit.length > 1 ? 's' : ''} sans dépôt initial`,
            count: noDeposit.length,
          });
        }
      }

      return alerts;
    },
  });
}

// ── 13. Net Flow Stats ──────────────────────────────────────

export interface NetFlowStats {
  totalIn: number;
  totalOut: number;
  netFlow: number;
}

export function useNetFlowStats(days: number = 7) {
  return useQuery({
    queryKey: ['analytics-net-flow', days],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = daysAgo(days);

      const { data: entries, error } = await supabaseAdmin
        .from('ledger_entries')
        .select('entry_type, amount_xaf')
        .in('entry_type', ['DEPOSIT_VALIDATED', 'PAYMENT_EXECUTED'])
        .gte('created_at', since);

      if (error) throw error;

      let totalIn = 0;
      let totalOut = 0;

      for (const e of entries || []) {
        const amount = Math.abs(e.amount_xaf);
        if (e.entry_type === 'DEPOSIT_VALIDATED') totalIn += amount;
        else totalOut += amount;
      }

      return { totalIn, totalOut, netFlow: totalIn - totalOut } satisfies NetFlowStats;
    },
  });
}

// ── 14. Total Clients Count ────────────────────────────────

export interface TotalClientsStats {
  total: number;
  active: number;    // status = 'active'
  inactive: number;  // other statuses
  kycVerified: number;
}

export function useTotalClientsStats() {
  return useQuery({
    queryKey: ['analytics-total-clients'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { data: clients, error } = await supabaseAdmin
        .from('clients')
        .select('status, kyc_verified');

      if (error) throw error;

      let total = 0;
      let active = 0;
      let inactive = 0;
      let kycVerified = 0;

      for (const c of clients || []) {
        total++;
        if (c.status === 'active') active++;
        else inactive++;
        if (c.kyc_verified) kycVerified++;
      }

      return { total, active, inactive, kycVerified } satisfies TotalClientsStats;
    },
  });
}

// ── 15. Client Registration Source (Admin vs Self-registered) ──

export interface RegistrationSourceStats {
  adminCreated: number;
  selfRegistered: number;
  adminCreatedPct: number;
  selfRegisteredPct: number;
  /** Monthly breakdown for chart */
  monthly: Array<{
    month: string;
    adminCreated: number;
    selfRegistered: number;
  }>;
}

export function useRegistrationSourceStats(months: number = 6) {
  return useQuery({
    queryKey: ['analytics-registration-source', months],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const since = monthsAgo(months);
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

      // Get all clients
      const { data: clients, error: clientsErr } = await supabaseAdmin
        .from('clients')
        .select('user_id, created_at')
        .gte('created_at', since);

      if (clientsErr) throw clientsErr;

      // Get admin-created client IDs from audit logs
      const { data: auditLogs, error: auditErr } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('target_id, created_at')
        .eq('action_type', 'create_client')
        .gte('created_at', since);

      if (auditErr) throw auditErr;

      const adminCreatedIds = new Set(
        (auditLogs || []).map(log => log.target_id).filter(Boolean)
      );

      // Global counts
      let adminCreated = 0;
      let selfRegistered = 0;

      // Monthly buckets
      const buckets = new Map<string, { adminCreated: number; selfRegistered: number }>();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, { adminCreated: 0, selfRegistered: 0 });
      }

      for (const client of clients || []) {
        const isAdmin = adminCreatedIds.has(client.user_id);
        if (isAdmin) adminCreated++;
        else selfRegistered++;

        const d = new Date(client.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (bucket) {
          if (isAdmin) bucket.adminCreated++;
          else bucket.selfRegistered++;
        }
      }

      const total = adminCreated + selfRegistered;

      const monthly = [];
      for (const [key, vals] of buckets) {
        const [, m] = key.split('-');
        monthly.push({
          month: monthNames[parseInt(m) - 1],
          adminCreated: vals.adminCreated,
          selfRegistered: vals.selfRegistered,
        });
      }

      return {
        adminCreated,
        selfRegistered,
        adminCreatedPct: total > 0 ? Math.round((adminCreated / total) * 100) : 0,
        selfRegisteredPct: total > 0 ? Math.round((selfRegistered / total) * 100) : 0,
        monthly,
      } satisfies RegistrationSourceStats;
    },
  });
}

// ── 16. Deposit Volume Report (day / week / month) ─────────

export type PeriodGranularity = 'day' | 'week' | 'month';

export interface VolumeReportPoint {
  label: string;
  volume: number;
  count: number;
  avgAmount: number;
}

export interface VolumeReportData {
  points: VolumeReportPoint[];
  totalVolume: number;
  totalCount: number;
  avgAmount: number;
  trend: number; // % vs previous equivalent period
  peakLabel: string;
  peakVolume: number;
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

function buildBucketConfig(granularity: PeriodGranularity) {
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  if (granularity === 'day') {
    // Last 14 days — label: "Lun 24 Mar"
    const keys: Array<{ key: string; label: string }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      keys.push({ key, label: `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}` });
    }
    const since = daysAgo(28); // fetch 28 days for trend comparison
    const getKey = (dateStr: string) => new Date(dateStr).toISOString().split('T')[0];
    return { keys, since, getKey, prevDays: 14 };
  }

  if (granularity === 'week') {
    // Last 8 weeks — label: "10–16 Mar" or "24 Fév–2 Mar"
    const keys: Array<{ key: string; label: string }> = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - i * 7);
      // Align to Monday
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const wn = getWeekNumber(weekStart);
      const key = `${weekStart.getFullYear()}-W${String(wn).padStart(2, '0')}`;

      let label: string;
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        label = `${weekStart.getDate()}–${weekEnd.getDate()} ${monthNames[weekStart.getMonth()]}`;
      } else {
        label = `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]}–${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;
      }
      keys.push({ key, label });
    }
    const since = daysAgo(16 * 7); // 16 weeks for trend
    const getKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const wn = getWeekNumber(d);
      return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
    };
    return { keys, since, getKey, prevDays: 8 * 7 };
  }

  // month — label: "Mar 2026"
  const keys: Array<{ key: string; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    keys.push({ key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
  }
  const since = monthsAgo(12); // 12 months for trend
  const getKey = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  return { keys, since, getKey, prevDays: 180 };
}

export function useDepositVolumeReport(granularity: PeriodGranularity = 'day') {
  return useQuery({
    queryKey: ['analytics-deposit-volume-report', granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const config = buildBucketConfig(granularity);

      const { data: deposits, error } = await supabaseAdmin
        .from('deposits')
        .select('amount_xaf, created_at, status')
        .eq('status', 'validated')
        .gte('created_at', config.since);

      if (error) throw error;

      // Build current period buckets
      const currentKeys = new Set(config.keys.map(k => k.key));
      const buckets = new Map<string, { volume: number; count: number }>();
      for (const k of config.keys) {
        buckets.set(k.key, { volume: 0, count: 0 });
      }

      let prevVolume = 0;
      let prevCount = 0;

      for (const d of deposits || []) {
        const key = config.getKey(d.created_at);
        const amount = d.amount_xaf || 0;

        if (currentKeys.has(key)) {
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.volume += amount;
            bucket.count += 1;
          }
        } else {
          // Previous period for trend calculation
          prevVolume += amount;
          prevCount += 1;
        }
      }

      let totalVolume = 0;
      let totalCount = 0;
      let peakLabel = '';
      let peakVolume = 0;

      const points: VolumeReportPoint[] = config.keys.map(k => {
        const b = buckets.get(k.key)!;
        totalVolume += b.volume;
        totalCount += b.count;
        if (b.volume > peakVolume) {
          peakVolume = b.volume;
          peakLabel = k.label;
        }
        return {
          label: k.label,
          volume: b.volume,
          count: b.count,
          avgAmount: b.count > 0 ? Math.round(b.volume / b.count) : 0,
        };
      });

      const trend = prevVolume > 0
        ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100)
        : 0;

      return {
        points,
        totalVolume,
        totalCount,
        avgAmount: totalCount > 0 ? Math.round(totalVolume / totalCount) : 0,
        trend,
        peakLabel,
        peakVolume,
      } satisfies VolumeReportData;
    },
  });
}

// ── 17. Payment Volume Report (day / week / month) ─────────

export function usePaymentVolumeReport(granularity: PeriodGranularity = 'day') {
  return useQuery({
    queryKey: ['analytics-payment-volume-report', granularity],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const config = buildBucketConfig(granularity);

      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('amount_xaf, amount_rmb, created_at, method')
        .eq('status', 'completed')
        .gte('created_at', config.since);

      if (error) throw error;

      const currentKeys = new Set(config.keys.map(k => k.key));
      const buckets = new Map<string, { volume: number; volumeRMB: number; count: number }>();
      for (const k of config.keys) {
        buckets.set(k.key, { volume: 0, volumeRMB: 0, count: 0 });
      }

      let prevVolume = 0;

      for (const p of payments || []) {
        const key = config.getKey(p.created_at);
        const amountXAF = p.amount_xaf || 0;
        const amountRMB = p.amount_rmb || 0;

        if (currentKeys.has(key)) {
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.volume += amountXAF;
            bucket.volumeRMB += amountRMB;
            bucket.count += 1;
          }
        } else {
          prevVolume += amountXAF;
        }
      }

      let totalVolume = 0;
      let totalCount = 0;
      let totalRMB = 0;
      let peakLabel = '';
      let peakVolume = 0;

      const points: VolumeReportPoint[] = config.keys.map(k => {
        const b = buckets.get(k.key)!;
        totalVolume += b.volume;
        totalRMB += b.volumeRMB;
        totalCount += b.count;
        if (b.volume > peakVolume) {
          peakVolume = b.volume;
          peakLabel = k.label;
        }
        return {
          label: k.label,
          volume: b.volume,
          count: b.count,
          avgAmount: b.count > 0 ? Math.round(b.volume / b.count) : 0,
        };
      });

      const trend = prevVolume > 0
        ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100)
        : 0;

      return {
        points,
        totalVolume,
        totalCount,
        avgAmount: totalCount > 0 ? Math.round(totalVolume / totalCount) : 0,
        trend,
        peakLabel,
        peakVolume,
      } satisfies VolumeReportData;
    },
  });
}

// ─── UTM Source Stats ─────────────────────────────────────────────────────────

export interface UtmSourceStats {
  rows: Array<{ source: string; count: number; pct: number }>;
  total: number;
}

export function useUtmSourceStats() {
  return useQuery({
    queryKey: ['analytics-utm-source'],
    staleTime: ANALYTICS_STALE,
    gcTime: ANALYTICS_GC,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('utm_source')
        .not('utm_source', 'is', null);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        const src = row.utm_source ?? 'direct';
        counts.set(src, (counts.get(src) ?? 0) + 1);
      }

      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const rows = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({
          source,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        }));

      return { rows, total } satisfies UtmSourceStats;
    },
  });
}
