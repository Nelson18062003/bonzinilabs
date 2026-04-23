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
  ExportButton,
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
  useDashboardAlerts,
  useRateHistory,
  useAdminProductivity,
  useDepositVolumeReport,
  usePaymentVolumeReport,
  useClientGrowth,
  useRegistrationSource,
  useUtmSources,
  useWalletExposure,
  useDepositStatusTimeline,
  type DashboardAlert,
  type AdminProductivityRow,
  type VolumeReport,
  type ClientGrowthPoint,
  type DepositStatusTimelinePoint,
  type UtmSourceRow,
} from '@/hooks/analytics/useAnalytics';
import { Area, AreaChart } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useDateRange as useDateRangeCtx } from '@/lib/analytics/DateRangeContext';

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
  const navigate = useNavigate();
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
  const alerts = useDashboardAlerts();
  const rateHistory = useRateHistory(range);
  const adminProductivity = useAdminProductivity(range);
  const depositVolumeReport = useDepositVolumeReport(range);
  const paymentVolumeReport = usePaymentVolumeReport(range);
  const clientGrowth = useClientGrowth(range);
  const registrationSource = useRegistrationSource(range);
  const utmSources = useUtmSources(range, 10);
  const walletExposure = useWalletExposure();
  const statusTimeline = useDepositStatusTimeline(range);

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

        {/* SECTION 0 — Alerts (only when at least one alert exists) ── */}
        {alerts.data && alerts.data.length > 0 ? (
          <AlertsSection alerts={alerts.data} onNavigate={navigate} />
        ) : null}

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

        {/* SECTION 1b — Exposure & structural KPIs ──────────── */}
        <KpiRow columns={4}>
          <KpiCard
            accent="violet"
            icon={<Wallet className="h-4 w-4" />}
            label="Exposition wallets"
            value={formatCurrency(walletExposure.data?.totalXAF ?? 0, 'XAF', { compact: true })}
            secondary={`${formatInteger(walletExposure.data?.clientsWithBalance ?? 0)} clients avec solde`}
            loading={walletExposure.isLoading}
            description="Somme totale XAF encore dans les wallets clients (non dépensée). Indique ton engagement financier envers les clients à l'instant T — indépendant de la période sélectionnée."
          />
          <KpiCard
            accent="amber"
            label="Solde moyen par client"
            value={formatCurrency(walletExposure.data?.avgBalancePerClient ?? 0, 'XAF', { compact: true })}
            loading={walletExposure.isLoading}
            description="Exposition totale / nombre de clients avec un solde strictement positif."
          />
          <KpiCard
            accent="orange"
            label="Concentration top 10"
            value={
              walletExposure.data && walletExposure.data.totalXAF > 0
                ? formatPercent(walletExposure.data.top10ShareXAF / walletExposure.data.totalXAF)
                : '—'
            }
            secondary={
              walletExposure.data
                ? formatCurrency(walletExposure.data.top10ShareXAF, 'XAF', { compact: true })
                : undefined
            }
            loading={walletExposure.isLoading}
            description="Part des 10 plus gros soldes dans l'exposition totale. Plus élevé = plus de risque de concentration (un gros retrait aurait un impact disproportionné)."
          />
          <KpiCard
            accent="emerald"
            label="Ratio dépôts / paiements"
            value={
              tpvCurrent > 0
                ? (depositsCurrent / tpvCurrent).toFixed(2) + '×'
                : '—'
            }
            secondary={
              tpvCurrent > 0 && depositsCurrent >= tpvCurrent
                ? 'Entrées > sorties'
                : 'Sorties > entrées'
            }
            loading={payments.isLoading || deposits.isLoading}
            description="Dépôts validés / Paiements exécutés sur la période. >1 = ton encours augmente, <1 = tu consommes les wallets."
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
          toolbar={
            <ExportButton
              filename="flux"
              disabled={!flow.data?.current || flow.data.current.length === 0}
              rows={() =>
                (flow.data?.current ?? []).map((p) => ({
                  bucket: p.bucket,
                  label: p.label,
                  depots_xaf: p.deposits,
                  paiements_xaf: p.payments,
                  net_xaf: p.net,
                }))
              }
              columns={[
                { key: 'bucket', label: 'Bucket (UTC)' },
                { key: 'label', label: 'Libellé' },
                { key: 'depots_xaf', label: 'Dépôts XAF' },
                { key: 'paiements_xaf', label: 'Paiements XAF' },
                { key: 'net_xaf', label: 'Net XAF' },
              ]}
            />
          }
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

        {/* SECTION 3b — Volume reports (deposits + payments) ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <VolumeReportCard
            title="Rapport volume dépôts"
            report={depositVolumeReport.data}
            isLoading={depositVolumeReport.isLoading}
            error={depositVolumeReport.error}
            color="hsl(258 100% 60%)"
            exportName="rapport_depots"
          />
          <VolumeReportCard
            title="Rapport volume paiements"
            report={paymentVolumeReport.data}
            isLoading={paymentVolumeReport.isLoading}
            error={paymentVolumeReport.error}
            color="hsl(36 100% 55%)"
            exportName="rapport_paiements"
          />
        </div>

        {/* SECTION 3c — Deposit status timeline (stacked) ──── */}
        <ChartCard
          title="Statut des dépôts dans le temps"
          subtitle="Nombre de dépôts créés par bucket, empilés par statut"
          description="Montre à quel rythme les dépôts arrivent, combien sont validés vs rejetés vs encore en attente. Les pics peuvent signaler des campagnes ou des problèmes opérationnels."
          loading={statusTimeline.isLoading}
          error={statusTimeline.error as Error | null}
          empty={!statusTimeline.data || statusTimeline.data.every((p) => p.validated + p.rejected + p.pending === 0)}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusTimeline.data ?? []} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="validated" stackId="s" name="Validés" fill="hsl(142 71% 45%)" />
              <Bar dataKey="pending" stackId="s" name="En attente" fill="hsl(36 100% 55%)" />
              <Bar dataKey="rejected" stackId="s" name="Rejetés" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
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

        {/* SECTION 4b — Clients: growth + registration source ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard
            title="Croissance clients"
            subtitle="Cumul total + nouveaux clients par bucket"
            description="Barre : nouveaux clients inscrits dans le bucket. Aire : total cumulé (incluant tous les clients d'avant la période). Les plateaux indiquent un ralentissement de l'acquisition."
            loading={clientGrowth.isLoading}
            error={clientGrowth.error as Error | null}
            empty={!clientGrowth.data || clientGrowth.data.length === 0}
          >
            <ClientGrowthChart points={clientGrowth.data ?? []} />
          </ChartCard>

          <ChartCard
            title="Sources d'inscription"
            subtitle={`${formatInteger(registrationSource.data?.totalNew ?? 0)} nouveau${(registrationSource.data?.totalNew ?? 0) > 1 ? 'x' : ''} client${(registrationSource.data?.totalNew ?? 0) > 1 ? 's' : ''} sur la période`}
            description="Répartition admin-créés (via la back-office) vs self-registered (via l'app). La base UTM complète est listée en dessous pour l'acquisition marketing."
            loading={registrationSource.isLoading}
            error={registrationSource.error as Error | null}
            empty={!registrationSource.data || registrationSource.data.totalNew === 0}
          >
            <RegistrationSourceBlock stats={registrationSource.data} utm={utmSources.data ?? []} />
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

        {/* SECTION 6 — Rate history ────────────────────────── */}
        <ChartCard
          title="Évolution des taux"
          subtitle="CNY pour 1M XAF par méthode — définis dans daily_rates"
          description="Taux effectifs appliqués sur la période, par méthode. Indique la marge que tu prends (écart entre les méthodes) et la volatilité."
          loading={rateHistory.isLoading}
          error={rateHistory.error as Error | null}
          empty={!rateHistory.data || rateHistory.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rateHistory.data ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip content={<RateTooltip />} />
              <Line type="monotone" dataKey="alipay" name="Alipay" stroke="#1677ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wechat" name="WeChat" stroke="#07c160" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="virement" name="Virement" stroke="hsl(258 100% 60%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cash" name="Cash" stroke="hsl(16 100% 55%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* SECTION 7 — Admin productivity ───────────────────── */}
        <ChartCard
          title="Productivité des admins"
          subtitle="Nombre d'actions par administrateur sur la période"
          description="Actions comptabilisées dans admin_audit_logs : validate_deposit, reject_deposit, process_payment, complete_payment. Volume brut — utile pour répartir la charge, pas pour mesurer la qualité."
          loading={adminProductivity.isLoading}
          error={adminProductivity.error as Error | null}
          empty={!adminProductivity.data || adminProductivity.data.length === 0}
        >
          <AdminProductivityList rows={adminProductivity.data ?? []} />
        </ChartCard>

        {/* SECTION 8 — Top clients ────────────────────────── */}
        <ChartCard
          title="Top 10 clients"
          subtitle="Classés par volume de paiements sur la période"
          description="Somme des paiements au statut 'completed' par client. Utile pour identifier la concentration du chiffre."
          loading={topClients.isLoading}
          error={topClients.error as Error | null}
          empty={!topClients.data || topClients.data.length === 0}
          toolbar={
            <ExportButton
              filename="top_clients"
              disabled={!topClients.data || topClients.data.length === 0}
              rows={() =>
                (topClients.data ?? []).map((c, i) => ({
                  rang: i + 1,
                  client: `${c.firstName} ${c.lastName}`.trim() || 'Inconnu',
                  'user_id': c.userId,
                  'nb_operations': c.opCount,
                  'volume_xaf': c.totalXAF,
                  'volume_rmb': c.totalRMB,
                }))
              }
              columns={[
                { key: 'rang', label: 'Rang' },
                { key: 'client', label: 'Client' },
                { key: 'user_id', label: 'User ID' },
                { key: 'nb_operations', label: 'Opérations' },
                { key: 'volume_xaf', label: 'Volume XAF' },
                { key: 'volume_rmb', label: 'Volume RMB' },
              ]}
            />
          }
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

// ────────────────────────────────────────────────────────────────────────────
// AlertsSection — compact stacked list of operational alerts
// ────────────────────────────────────────────────────────────────────────────

function AlertsSection({
  alerts,
  onNavigate,
}: {
  alerts: DashboardAlert[];
  onNavigate: (path: string) => void;
}) {
  const severityStyle: Record<DashboardAlert['severity'], { box: string; icon: string; title: string }> = {
    critical: {
      box: 'bg-red-500/10 border-red-500/30',
      icon: 'text-red-600',
      title: 'text-red-700',
    },
    warning: {
      box: 'bg-amber-500/10 border-amber-500/30',
      icon: 'text-amber-600',
      title: 'text-amber-700',
    },
    info: {
      box: 'bg-blue-500/10 border-blue-500/30',
      icon: 'text-blue-600',
      title: 'text-blue-700',
    },
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Alertes opérationnelles
      </h2>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const s = severityStyle[alert.severity];
          const Clickable = !!alert.actionHref;
          return (
            <button
              key={alert.id}
              type="button"
              disabled={!Clickable}
              onClick={Clickable ? () => onNavigate(alert.actionHref!) : undefined}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${s.box} ${Clickable ? 'hover:opacity-90' : 'cursor-default'}`}
            >
              <AlertTriangle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${s.title}`}>
                  {alert.title}{' '}
                  <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-xs tabular-nums">
                    {alert.count}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RateTooltip — shared with LineChart (rate history)
// ────────────────────────────────────────────────────────────────────────────

function RateTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex items-center gap-1.5 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
          <span className="text-muted-foreground">{e.name}</span>
          <span className="ml-auto font-semibold">¥{formatCompact(e.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AdminProductivityList — ranked list of admins by action count
// ────────────────────────────────────────────────────────────────────────────

function AdminProductivityList({ rows }: { rows: AdminProductivityRow[] }) {
  if (rows.length === 0) return null;
  const max = rows[0]?.totalActions ?? 0;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const widthPct = max === 0 ? 0 : (r.totalActions / max) * 100;
        return (
          <div key={r.adminId}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium truncate max-w-[180px]">{r.name || 'Admin'}</span>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{formatInteger(r.totalActions)}</span> actions
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${widthPct}%`, background: 'hsl(258 100% 60%)' }}
              />
            </div>
            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground tabular-nums">
              <span>✓ {formatInteger(r.depositsValidated)} dépôts validés</span>
              <span>✗ {formatInteger(r.depositsRejected)} rejetés</span>
              <span>▸ {formatInteger(r.paymentsProcessed)} paiements</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// VolumeReportCard — total + ops + avg + peak + trend + bar chart + export
// ────────────────────────────────────────────────────────────────────────────

interface VolumeReportCardProps {
  title: string;
  report: VolumeReport | undefined;
  isLoading: boolean;
  error: unknown;
  color: string;
  exportName: string;
}

function VolumeReportCard({ title, report, isLoading, error, color, exportName }: VolumeReportCardProps) {
  const { range } = useDateRangeCtx();
  const hasData = !!report && report.series.some((p) => p.amountXAF > 0);

  return (
    <ChartCard
      title={title}
      subtitle={
        range.granularity === 'day'
          ? 'Par jour'
          : range.granularity === 'week'
            ? 'Par semaine'
            : range.granularity === 'month'
              ? 'Par mois'
              : 'Par heure'
      }
      description="Série temporelle du volume avec total, opérations, ticket moyen, pic et tendance % par rapport à la période précédente de même longueur."
      loading={isLoading}
      error={error as Error | null}
      empty={!hasData}
      toolbar={
        <ExportButton
          filename={exportName}
          disabled={!hasData}
          rows={() =>
            (report?.series ?? []).map((p) => ({
              bucket: p.bucket,
              label: p.label,
              volume_xaf: p.amountXAF,
              operations: p.opCount,
            }))
          }
          columns={[
            { key: 'bucket', label: 'Bucket (UTC)' },
            { key: 'label', label: 'Libellé' },
            { key: 'volume_xaf', label: 'Volume XAF' },
            { key: 'operations', label: 'Opérations' },
          ]}
        />
      }
      footer={
        report && hasData ? (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">Total</div>
              <div className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(report.totalXAF, 'XAF', { compact: true })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Opérations</div>
              <div className="text-sm font-bold text-foreground tabular-nums">
                {formatInteger(report.opCount)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Ticket moyen</div>
              <div className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(report.avgXAF, 'XAF', { compact: true })}
              </div>
            </div>
            {report.peak ? (
              <div className="col-span-2">
                <div className="text-muted-foreground">Pic</div>
                <div className="text-sm font-bold text-foreground tabular-nums">
                  {report.peak.label} · {formatCurrency(report.peak.amountXAF, 'XAF', { compact: true })}
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-muted-foreground">Tendance</div>
              <div
                className="text-sm font-bold tabular-nums"
                style={{
                  color:
                    report.trendPct == null
                      ? 'hsl(var(--muted-foreground))'
                      : report.trendPct >= 0
                        ? 'hsl(142 71% 45%)'
                        : 'hsl(0 84% 60%)',
                }}
              >
                {report.trendPct == null
                  ? 'N/D'
                  : `${report.trendPct >= 0 ? '+' : ''}${formatPercent(report.trendPct)}`}
              </div>
            </div>
          </div>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={report?.series ?? []} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip content={<VolumeTooltip color={color} />} />
          <Bar dataKey="amountXAF" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function VolumeTooltip({ active, payload, label, color }: {
  active?: boolean;
  payload?: Array<{ payload: VolumeReport['series'][number] }>;
  label?: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="flex items-center gap-1.5 tabular-nums">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-muted-foreground">Volume</span>
        <span className="ml-auto font-bold">{formatCurrency(p.amountXAF, 'XAF', { compact: true })}</span>
      </p>
      <p className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">Opérations</span>
        <span className="ml-auto font-semibold">{formatInteger(p.opCount)}</span>
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ClientGrowthChart — AreaChart cumulative + bars for new
// ────────────────────────────────────────────────────────────────────────────

function ClientGrowthChart({ points }: { points: ClientGrowthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(258 100% 60%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(258 100% 60%)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<GrowthTooltip />} />
        <Area type="monotone" dataKey="cumulative" stroke="hsl(258 100% 60%)" strokeWidth={2} fill="url(#growthGradient)" name="Total cumulé" />
        <Bar dataKey="newClients" fill="hsl(36 100% 55%)" name="Nouveaux" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function GrowthTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: ClientGrowthPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">Nouveaux clients</span>
        <span className="ml-auto font-bold">{formatInteger(p.newClients)}</span>
      </p>
      <p className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">Total cumulé</span>
        <span className="ml-auto font-bold">{formatInteger(p.cumulative)}</span>
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RegistrationSourceBlock — breakdown + UTM table
// ────────────────────────────────────────────────────────────────────────────

interface RegistrationStats {
  adminCreated: number;
  selfRegistered: number;
  totalNew: number;
  adminCreatedPct: number;
}

function RegistrationSourceBlock({
  stats,
  utm,
}: {
  stats: RegistrationStats | undefined;
  utm: UtmSourceRow[];
}) {
  if (!stats) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin-créés</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatInteger(stats.adminCreated)}</div>
          <div className="text-xs text-muted-foreground">{formatPercent(stats.adminCreatedPct)} du total</div>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Self-registered</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatInteger(stats.selfRegistered)}</div>
          <div className="text-xs text-muted-foreground">{formatPercent(1 - stats.adminCreatedPct)} du total</div>
        </div>
      </div>

      {utm.length > 0 ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top sources UTM
          </div>
          <div className="space-y-1">
            {utm.map((row) => (
              <div
                key={`${row.source}-${row.medium}-${row.campaign}`}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{row.source}</span>
                  <span className="text-muted-foreground"> · {row.medium}</span>
                  {row.campaign !== '(none)' ? (
                    <span className="text-muted-foreground"> · {row.campaign}</span>
                  ) : null}
                </div>
                <span className="flex-shrink-0 font-semibold tabular-nums">
                  {formatInteger(row.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune source UTM sur la période.</p>
      )}
    </div>
  );
}
