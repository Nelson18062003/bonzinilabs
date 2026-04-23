/**
 * Admin analytics dashboard — v2.
 *
 * Rebuilt on top of the new analytics foundations:
 *   - Single DateRangePicker drives every hook (src/lib/analytics/).
 *   - Hooks return timezone-safe series computed against Africa/Douala.
 *   - Explicit comparison-to-previous-period mode.
 *   - Primitives (<KpiCard>, <ChartCard>, <BreakdownBar>) replace
 *     11 bespoke sections of ad-hoc markup from the previous version.
 *
 * Old hooks in `src/hooks/useDashboardAnalytics.ts` remain to power
 * the home screen (`/m`, `MobileDashboard`) and will be migrated later.
 * The critical calculation bugs they contained (timezone, count-vs-
 * volume, status mixing) are FIXED in the new hooks used here.
 */

import * as React from 'react';
import { RefreshCw, TrendingUp, Users, Wallet, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import {
  DateRangeProvider,
  useDateRange,
} from '@/lib/analytics/DateRangeContext';
import {
  DateRangePicker,
  KpiCard,
  KpiRow,
  ChartCard,
  BreakdownBar,
  formatCompact,
  formatCurrency,
  formatInteger,
  formatPercent,
  computeDelta,
} from '@/components/analytics';
import {
  useFlowSeries,
  usePaymentSummary,
  useDepositSummary,
  useDepositMethodBreakdown,
  usePaymentMethodBreakdown,
  useDepositStatusSummary,
  useTopClients,
  useFunnel,
  useDepositProcessingTime,
} from '@/hooks/analytics/useAnalytics';

// ────────────────────────────────────────────────────────────────────────────
// Colour tokens — match the Bonzini brand palette used across the app.
// ────────────────────────────────────────────────────────────────────────────

const COLOR_DEPOSITS = 'hsl(258 100% 60%)';   // violet
const COLOR_PAYMENTS = 'hsl(36 100% 55%)';    // amber
const COLOR_NET_POSITIVE = 'hsl(142 71% 45%)';
const COLOR_NET_NEGATIVE = 'hsl(16 100% 55%)'; // orange

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  alipay: '#1677ff',
  wechat: '#07c160',
  bank_transfer: 'hsl(258 100% 60%)',
  cash: 'hsl(16 100% 55%)',
};

const DEPOSIT_METHOD_COLORS: Record<string, string> = {
  cash_agency: 'hsl(36 100% 55%)',
  cash_agent: 'hsl(16 100% 55%)',
  mobile_money: 'hsl(258 100% 60%)',
  bank_transfer: 'hsl(230 70% 55%)',
  card: 'hsl(200 70% 55%)',
  other: 'hsl(0 0% 60%)',
};

// ────────────────────────────────────────────────────────────────────────────
// Export wrapper — provides the DateRange context.
// ────────────────────────────────────────────────────────────────────────────

export function MobileAnalyticsDashboard() {
  return (
    <DateRangeProvider defaultPreset="last_30_days">
      <DashboardBody />
    </DateRangeProvider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Body — subscribes to the range + every KPI hook.
// ────────────────────────────────────────────────────────────────────────────

function DashboardBody() {
  const { range } = useDateRange();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const flow = useFlowSeries(range);
  const payments = usePaymentSummary(range);
  const deposits = useDepositSummary(range);
  const depositMethods = useDepositMethodBreakdown(range);
  const paymentMethods = usePaymentMethodBreakdown(range);
  const statusSummary = useDepositStatusSummary(range);
  const topClients = useTopClients(range, 10);
  const funnel = useFunnel(range);
  const processing = useDepositProcessingTime(range);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['analytics-v2'] });
    } finally {
      setRefreshing(false);
    }
  };

  // ─────────────────────────── KPIs ─────────────────────────────

  const tpvCurrent = payments.data?.current.totalXAF ?? 0;
  const tpvPrevious = payments.data?.previous?.totalXAF ?? null;
  const tpvDelta = computeDelta(tpvCurrent, tpvPrevious);

  const avgTicketCurrent = payments.data?.current.avgTicketXAF ?? 0;
  const avgTicketPrevious = payments.data?.previous?.avgTicketXAF ?? null;
  const avgTicketDelta = computeDelta(avgTicketCurrent, avgTicketPrevious);

  const depositsCurrent = deposits.data?.current.totalXAF ?? 0;
  const depositsPrevious = deposits.data?.previous?.totalXAF ?? null;
  const depositsDelta = computeDelta(depositsCurrent, depositsPrevious);

  const netCurrent = depositsCurrent - tpvCurrent;
  const netPrevious = depositsPrevious != null && tpvPrevious != null ? depositsPrevious - tpvPrevious : null;
  const netDelta = computeDelta(netCurrent, netPrevious);

  const validationRate = statusSummary.data?.validationRate ?? 0;

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={refreshing}>
      <div className="flex flex-col gap-6 p-4 pb-24 bg-muted/30 min-h-screen">

        {/* TOOLBAR ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-xs text-muted-foreground">
              Aperçu de l'activité sur la période sélectionnée — fuseau Africa/Douala.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DateRangePicker />
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Rafraîchir"
              className="rounded-lg border border-border bg-background p-2 shadow-sm hover:bg-muted/50"
            >
              <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </button>
          </div>
        </header>

        {/* SECTION 1 — Hero KPIs ───────────────────────────── */}
        <KpiRow columns={4}>
          <KpiCard
            accent="amber"
            icon={<TrendingUp className="h-4 w-4" />}
            label="TPV — Volume paiements"
            value={formatCurrency(tpvCurrent, 'XAF', { compact: true })}
            secondary={`${formatInteger(payments.data?.current.opCount)} opérations · ¥${formatCompact(payments.data?.current.totalRMB ?? 0)}`}
            delta={range.compareToPrevious ? tpvDelta : undefined}
            loading={payments.isLoading}
            description="Somme des paiements au statut 'completed' sur la période. Exclut explicitement les paiements en cours (processing, ready_for_payment)."
          />
          <KpiCard
            accent="violet"
            icon={<Wallet className="h-4 w-4" />}
            label="Dépôts validés"
            value={formatCurrency(depositsCurrent, 'XAF', { compact: true })}
            secondary={`${formatInteger(deposits.data?.current.opCount)} dépôts`}
            delta={range.compareToPrevious ? depositsDelta : undefined}
            loading={deposits.isLoading}
            description="Somme des dépôts au statut 'validated' sur la période."
          />
          <KpiCard
            accent={netCurrent >= 0 ? 'emerald' : 'red'}
            label="Flux net"
            value={formatCurrency(netCurrent, 'XAF', { compact: true })}
            secondary={netCurrent >= 0 ? "Plus d'entrées que de sorties" : 'Plus de sorties que d\'entrées'}
            delta={range.compareToPrevious ? netDelta : undefined}
            loading={payments.isLoading || deposits.isLoading}
            description="Dépôts validés − Paiements exécutés sur la période."
          />
          <KpiCard
            accent="neutral"
            icon={<Clock className="h-4 w-4" />}
            label="Ticket moyen paiement"
            value={formatCurrency(avgTicketCurrent, 'XAF', { compact: true })}
            delta={range.compareToPrevious ? avgTicketDelta : undefined}
            loading={payments.isLoading}
            description="Montant moyen par paiement exécuté (total XAF / nombre d'opérations completed)."
          />
        </KpiRow>

        {/* SECTION 2 — Funnel + Validation ──────────────────── */}
        <KpiRow columns={3}>
          <KpiCard
            accent="violet"
            icon={<Users className="h-4 w-4" />}
            label="Clients actifs sur la période"
            value={formatInteger(funnel.data?.clientsWithPayment)}
            secondary={`${formatInteger(funnel.data?.clientsTotal)} clients au total`}
            loading={funnel.isLoading}
            description="Nombre de clients ayant eu au moins un paiement exécuté pendant la période."
          />
          <KpiCard
            accent="amber"
            label="Conversion dépôt → paiement"
            value={formatPercent(funnel.data?.depositToPaymentRate ?? 0)}
            secondary={`${formatInteger(funnel.data?.clientsWithDeposit)} ont déposé · ${formatInteger(funnel.data?.clientsWithPayment)} ont payé`}
            loading={funnel.isLoading}
            description="Part des clients qui ont payé parmi ceux qui ont déposé sur la période. Proxy de l'utilité du solde chargé."
          />
          <KpiCard
            accent="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Taux de validation dépôts"
            value={formatPercent(validationRate)}
            secondary={`${formatInteger(statusSummary.data?.validated.count ?? 0)} validés · ${formatInteger(statusSummary.data?.rejected.count ?? 0)} rejetés`}
            loading={statusSummary.isLoading}
            description="validated / (validated + rejected). Exclut les dépôts en attente — ils ne sont pas encore tranchés."
          />
        </KpiRow>

        {/* SECTION 3 — Flow chart ──────────────────────────── */}
        <ChartCard
          title="Flux financier"
          subtitle={range.granularity === 'day' ? 'par jour' : range.granularity === 'week' ? 'par semaine' : range.granularity === 'month' ? 'par mois' : 'par heure'}
          description="Dépôts validés (violet) vs paiements exécutés (ambre) agrégés par bucket. Le flux net est la différence."
          loading={flow.isLoading}
          error={flow.error as Error | null}
          empty={flow.data?.current.every((p) => p.deposits === 0 && p.payments === 0)}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={flow.data?.current ?? []} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatCompact(v)} axisLine={false} tickLine={false} />
              <Tooltip content={<FlowTooltip />} />
              <Bar dataKey="deposits" name="Dépôts" fill={COLOR_DEPOSITS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="payments" name="Paiements" fill={COLOR_PAYMENTS} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* SECTION 4 — Breakdowns côte-à-côte ─────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard
            title="Répartition dépôts par méthode"
            subtitle="Volume XAF"
            description="Part de chaque méthode dans le volume total des dépôts validés. Les pastilles montrent aussi le nombre d'opérations et leur part en count — pour éviter la confusion nombre/volume."
            loading={depositMethods.isLoading}
            error={depositMethods.error as Error | null}
            empty={!depositMethods.data || depositMethods.data.length === 0}
          >
            <BreakdownBar
              items={(depositMethods.data ?? []).map((m) => ({
                key: m.key,
                label: m.label,
                count: m.count,
                amount: m.amount,
                color: DEPOSIT_METHOD_COLORS[m.key] ?? 'hsl(258 100% 60%)',
              }))}
              mode="amount"
              currency="XAF"
            />
          </ChartCard>

          <ChartCard
            title="Répartition paiements par méthode"
            subtitle="Volume XAF"
            description="Part de chaque méthode dans le volume total des paiements exécutés (status 'completed' uniquement — exclut les paiements non finalisés qui biaisaient l'ancienne version)."
            loading={paymentMethods.isLoading}
            error={paymentMethods.error as Error | null}
            empty={!paymentMethods.data || paymentMethods.data.length === 0}
          >
            <BreakdownBar
              items={(paymentMethods.data ?? []).map((m) => ({
                key: m.key,
                label: m.label,
                count: m.count,
                amount: m.amount,
                color: PAYMENT_METHOD_COLORS[m.key] ?? 'hsl(258 100% 60%)',
              }))}
              mode="amount"
              currency="XAF"
            />
          </ChartCard>
        </div>

        {/* SECTION 5 — Opérations (processing time + status) ── */}
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            accent="violet"
            icon={<Clock className="h-4 w-4" />}
            label="Temps de validation (médiane)"
            value={processing.data?.medianMinutes != null ? `${processing.data.medianMinutes} min` : '—'}
            secondary={
              processing.data?.p90Minutes != null
                ? `P90: ${processing.data.p90Minutes} min · échantillon: ${formatInteger(processing.data.sampleSize)}`
                : undefined
            }
            loading={processing.isLoading}
            description="Temps médian entre la création d'un dépôt et sa validation. Plus fiable que la moyenne (moins sensible aux outliers). P90 = 90% des dépôts sont validés en moins."
          />
          <KpiCard
            accent="red"
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Dépôts rejetés"
            value={formatInteger(statusSummary.data?.rejected.count ?? 0)}
            secondary={formatCurrency(statusSummary.data?.rejected.amountXAF ?? 0, 'XAF', { compact: true })}
            loading={statusSummary.isLoading}
            invertColor
            description="Dépôts explicitement rejetés sur la période. Pour les raisons détaillées, consulter l'écran Dépôts."
          />
          <KpiCard
            accent="amber"
            label="Dépôts en attente"
            value={formatInteger(
              (statusSummary.data?.pendingProof.count ?? 0) +
                (statusSummary.data?.pendingReview.count ?? 0),
            )}
            secondary={`${formatInteger(statusSummary.data?.pendingProof.count ?? 0)} preuve à envoyer · ${formatInteger(statusSummary.data?.pendingReview.count ?? 0)} en revue admin`}
            loading={statusSummary.isLoading}
            description="Dépôts pas encore tranchés : soit en attente de preuve (client), soit en revue (admin)."
          />
        </div>

        {/* SECTION 6 — Top clients ────────────────────────── */}
        <ChartCard
          title="Top 10 clients"
          subtitle="Classés par volume de paiements sur la période"
          description="Somme des paiements au statut 'completed' par client. Utile pour identifier la concentration du chiffre."
          loading={topClients.isLoading}
          error={topClients.error as Error | null}
          empty={!topClients.data || topClients.data.length === 0}
        >
          <TopClientsList items={topClients.data ?? []} />
        </ChartCard>

      </div>
    </PullToRefresh>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function FlowTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const net = payload.reduce(
    (acc, p) => acc + (p.name === 'Dépôts' ? p.value : -p.value),
    0,
  );
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
          <span className="text-muted-foreground">{e.name}</span>
          <span className="font-bold tabular-nums ml-auto">
            {formatCurrency(e.value, 'XAF', { compact: true })}
          </span>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-border/50 flex items-center justify-between">
        <span className="text-muted-foreground">Net</span>
        <span className="font-bold tabular-nums" style={{ color: net >= 0 ? COLOR_NET_POSITIVE : COLOR_NET_NEGATIVE }}>
          {net >= 0 ? '+' : ''}
          {formatCurrency(net, 'XAF', { compact: true })}
        </span>
      </p>
    </div>
  );
}

interface TopClientRow {
  userId: string;
  firstName: string;
  lastName: string;
  opCount: number;
  totalXAF: number;
  totalRMB: number;
}

function TopClientsList({ items }: { items: TopClientRow[] }) {
  if (items.length === 0) return null;
  const max = items[0]?.totalXAF ?? 0;
  return (
    <div className="space-y-2">
      {items.map((c, i) => {
        const widthPct = max === 0 ? 0 : (c.totalXAF / max) * 100;
        const name = `${c.firstName} ${c.lastName}`.trim() || 'Client inconnu';
        return (
          <div key={c.userId} className="group">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="font-medium truncate max-w-[180px]">{name}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatInteger(c.opCount)} op · <span className="font-semibold text-foreground">{formatCurrency(c.totalXAF, 'XAF', { compact: true })}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${widthPct}%`,
                  background: 'hsl(258 100% 60%)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
