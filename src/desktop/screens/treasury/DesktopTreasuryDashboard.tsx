/**
 * Trésorerie — analyse (bénéfice, taux moyens, stock, top contreparties).
 *
 * Rebuilt onto the console's dimensional contract (`@/desktop/ui/tokens`). This
 * screen used to be the mobile dashboard with a wider grid: it imported
 * `KpiCard`, `RateCardXafCny`, `TopList`, `QuickLink` and the two flow charts
 * from `MobileTreasuryDashboard`, which is why it carried 36px, 26px, 18px,
 * 11px and 10px type on one page. Those imports are gone; the phone screen is
 * untouched and still owns them.
 *
 * Decisions worth keeping:
 *   · **every KPI is a `Metric`, and nine of the ten are clickable.** A weighted
 *     purchase rate is explained by the list of purchases; a stock is explained
 *     by the movements it is the net of. Two tiles stay inert on purpose (see
 *     the comments at the grid) because no screen explains them.
 *   · **the weighted average rate left the chart headers.** It is the same
 *     number as the « Taux achat » / « Taux vente » tiles, and the tiles are the
 *     reliable home — the charts only render from two operations upward.
 *   · **the three "quick links" left the page bottom for the head.** Starting a
 *     purchase is a screen action, not a tile in the footer.
 *   · **the period is one `Segment`**, not seven pills; the custom range inputs
 *     only appear when the period is custom.
 *
 * Guarded on `canViewTreasury`. Admin context → `supabaseAdmin` (in the hooks).
 */
import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  History,
  Landmark,
  Percent,
  RefreshCw,
  Scale,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  type FlowPoint,
  useTopCounterparties,
  useTreasuryDashboard,
  useUsdtFlowEvolution,
  useWacEvolution,
} from '@/hooks/useTreasury';
import { PRESETS, getRange, fmt, toCnyPer1MXaf, type Preset } from '@/mobile/screens/treasury/treasuryDashboardUtils';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import {
  Button,
  EmptyState,
  Figure,
  Holder,
  Input,
  Metric,
  Panel,
  PanelHead,
  Segment,
  Spinner,
} from '@/desktop/ui/primitives';
import { MenuButton } from '@/desktop/ui/Popover';
import { ScreenHead, Toolbar, Workspace } from '@/desktop/ui/layout';

/* ── Destinations ────────────────────────────────────────────────────── */

const PURCHASES_ROUTE = '/m/more/treasury/purchases';
const SALES_ROUTE = '/m/more/treasury/sales';
const OPERATIONS_ROUTE = '/m/more/treasury/operations';
const ACCOUNTS_ROUTE = '/m/more/treasury/accounts';
/** Le taux client est calculé sur la table `payments` — c'est là qu'il s'explique. */
const PAYMENTS_ROUTE = '/m/payments';

/* ── Chart chrome ────────────────────────────────────────────────────── */

/**
 * Axes, grid and ticks paint with `currentColor`, so the chart follows the
 * console's foreground ramp (and the theme) instead of carrying a second colour
 * table. The series colour is a CSS variable declared on the panel, which is how
 * a dark variant stays a class rather than a second render path.
 */
const AXIS_TICK = { fontSize: 12, fontWeight: 600, fill: 'currentColor' };
const AXIS_LINE = { stroke: 'currentColor', strokeOpacity: 0.25 };

const TOOLTIP_STYLE = {
  background: 'var(--tip-bg, #FFFFFF)',
  border: '1px solid var(--tip-line, rgba(28,24,54,0.10))',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--tip-fg, #15131F)',
};
const TOOLTIP_LABEL_STYLE = { fontSize: 12, fontWeight: 700, color: 'var(--tip-fg, #15131F)' };

const CHART_VARS =
  '[--tip-bg:#FFFFFF] [--tip-line:#1C183618] [--tip-fg:#15131F] ' +
  'dark:[--tip-bg:#15141C] dark:[--tip-line:#FFFFFF1F] dark:[--tip-fg:#F3F2F8]';

/** One colour per series, taken from the shared tone palette. */
const SERIES: Record<'purchase' | 'sale' | 'cmp', string> = {
  purchase: '[--series:#5B4CC4] dark:[--series:#B5AAF0]',
  sale: '[--series:#9A6B12] dark:[--series:#E7C083]',
  cmp: '[--series:#6B5BD2] dark:[--series:#A99BF0]',
};

function ChartPanel({
  title,
  hint,
  series,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  series: keyof typeof SERIES;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel className={cn('overflow-hidden', SERIES[series], CHART_VARS)}>
      <PanelHead title={title} hint={hint} actions={actions} />
      {/* `currentColor` for the axes is set here, once. */}
      <div className={cn('p-4', DFG.faint)}>{children}</div>
    </Panel>
  );
}

function dayLabel(at: string) {
  return new Date(at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** Évolution du CMP USDT — un point par opération qui l'a déplacé. */
function CmpChart({ points }: { points: Array<{ at: string; wac: number }> }) {
  const data = points.map((p) => ({ ...p, label: dayLabel(p.at) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.14} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} {...AXIS_LINE} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          width={64}
          domain={['dataMin - 10', 'dataMax + 10']}
          tickFormatter={(v: number) => fmt(v, 0)}
          {...AXIS_LINE}
        />
        <Tooltip
          formatter={(value) => [`${fmt(Number(value), 4)} XAF/USDT`, 'CMP']}
          labelStyle={TOOLTIP_LABEL_STYLE}
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          type="monotone"
          dataKey="wac"
          stroke="var(--series)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--series)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Un point = une opération réellement saisie, au taux effectif de l'opération. */
function FlowChart({
  id,
  series,
  unit,
  decimals,
}: {
  id: string;
  series: FlowPoint[];
  unit: string;
  decimals: number;
}) {
  const data = series.map((p) => ({
    ...p,
    label: dayLabel(p.at),
    timeLabel: new Date(p.at).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
  const values = series.map((p) => p.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, max * 0.0015);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--series)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.14} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} {...AXIS_LINE} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          width={72}
          domain={[Math.max(0, min - padding), max + padding]}
          tickFormatter={(v: number) => fmt(v, decimals)}
          {...AXIS_LINE}
        />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel ?? ''}
          formatter={(value, _name, item) => {
            const p = item.payload as FlowPoint;
            return [`${fmt(Number(value), decimals)} ${unit} · ${fmt(p.usdt, 2)} USDT`, ''];
          }}
          labelStyle={TOOLTIP_LABEL_STYLE}
          contentStyle={TOOLTIP_STYLE}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--series)"
          strokeWidth={2}
          fill={`url(#${id})`}
          dot={data.length <= 60 ? { r: 2.5, fill: 'var(--series)', strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** ~10 tranches uniformes entre min et max ; un taux unique donne un seul bin. */
function buildBuckets(series: FlowPoint[], decimals: number) {
  const values = series.map((p) => p.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    const totalUsdt = series.reduce((a, p) => a + p.usdt, 0);
    return [{ binStart: min, binEnd: min, count: series.length, usdt: totalUsdt, label: fmt(min, decimals) }];
  }
  const target = 10;
  const bucketSize = (max - min) / target;
  const buckets = Array.from({ length: target }, (_, i) => ({
    binStart: min + i * bucketSize,
    binEnd: min + (i + 1) * bucketSize,
    count: 0,
    usdt: 0,
    label: '',
  }));
  for (const p of series) {
    const idx = Math.min(target - 1, Math.floor((p.rate - min) / bucketSize));
    buckets[idx].count += 1;
    buckets[idx].usdt += p.usdt;
  }
  for (const b of buckets) b.label = fmt((b.binStart + b.binEnd) / 2, decimals);
  return buckets;
}

/** Taux médian pondéré par volume USDT — distinct de la moyenne pondérée. */
function weightedMedian(series: FlowPoint[]) {
  const totalUsdt = series.reduce((a, p) => a + p.usdt, 0);
  const sorted = [...series].sort((a, b) => a.rate - b.rate);
  let cum = 0;
  let median = sorted[0]?.rate ?? 0;
  for (const p of sorted) {
    cum += p.usdt;
    if (cum >= totalUsdt / 2) {
      median = p.rate;
      break;
    }
  }
  return median;
}

function DistributionChart({ series, unit, decimals }: { series: FlowPoint[]; unit: string; decimals: number }) {
  const buckets = React.useMemo(() => buildBuckets(series, decimals), [series, decimals]);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.14} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} {...AXIS_LINE} />
        <YAxis tick={AXIS_TICK} tickLine={false} width={40} allowDecimals={false} {...AXIS_LINE} />
        <Tooltip
          cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
          labelFormatter={(_, payload) => {
            const b = payload?.[0]?.payload as { binStart: number; binEnd: number } | undefined;
            return b ? `${fmt(b.binStart, decimals)} – ${fmt(b.binEnd, decimals)} ${unit}` : '';
          }}
          formatter={(_v, _name, item) => {
            const b = item.payload as { count: number; usdt: number };
            return [`${b.count} op · ${fmt(b.usdt, 2)} USDT`, ''];
          }}
          labelStyle={TOOLTIP_LABEL_STYLE}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="count" fill="var(--series)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Top counterparties ──────────────────────────────────────────────── */

interface TopRow {
  id: string;
  display_name: string;
  operation_count: number;
  total_usdt: number;
  weighted_avg_rate: number;
  deviation_pct: number;
}

function TopPanel({
  title,
  rows,
  rateLabel,
  emptyText,
}: {
  title: string;
  rows: TopRow[];
  rateLabel: string;
  emptyText: string;
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead title={title} hint="Taux moyen pondéré · écart vs moyenne de la période" />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title={emptyText} />
      ) : (
        rows.map((r, i) => {
          const dev = r.deviation_pct;
          const devTone = Math.abs(dev) < 0.5 ? undefined : dev > 0 ? 'negative' : 'positive';
          return (
            <div
              key={r.id}
              className={cn(
                'flex min-h-11 items-center gap-3 px-4 py-2',
                i < rows.length - 1 && 'border-b',
                DS.line,
              )}
            >
              <Holder size="sm">
                <span className={DT.label}>{i + 1}</span>
              </Holder>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>{r.display_name}</span>
                <span className={cn('block truncate', DT.label, DFG.faint)}>
                  {r.operation_count} op · {fmt(r.total_usdt, 2)} USDT
                </span>
              </span>
              <Figure value={fmt(r.weighted_avg_rate, 4)} unit={rateLabel} size="md" />
              <span className="w-16 shrink-0 text-right" title="Écart vs moyenne de la période">
                <Figure value={`${dev >= 0 ? '+' : ''}${fmt(dev, 2)} %`} size="sm" tone={devTone} />
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function DesktopTreasuryDashboard() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();

  const [preset, setPreset] = React.useState<Preset>('month');
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = React.useState(monthStart);
  const [customTo, setCustomTo] = React.useState(today);

  const range = React.useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data: dash, isLoading, isError, isFetching, refetch } = useTreasuryDashboard(fromIso, toIso);
  const { data: topSuppliers } = useTopCounterparties('usdt_supplier', fromIso, toIso, 5);
  const { data: topBuyers } = useTopCounterparties('cny_buyer', fromIso, toIso, 5);
  const { data: cmpSeries } = useWacEvolution(fromIso, toIso);
  const { data: flowSeries } = useUsdtFlowEvolution(fromIso, toIso);

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;

  const benefit = dash?.benefit_total_xaf ?? 0;
  const benefitPositive = benefit >= 0;
  const clientRateXafPerCny = dash?.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revientXafPerCny = dash?.taux_de_revient_xaf_per_cny ?? null;
  const margePerCny =
    clientRateXafPerCny !== null && revientXafPerCny !== null ? clientRateXafPerCny - revientXafPerCny : null;
  const clientAlt = toCnyPer1MXaf(clientRateXafPerCny);
  const revientAlt = toCnyPer1MXaf(revientXafPerCny);

  return (
    <Workspace
      head={
        <ScreenHead
          title="Analyse trésorerie"
          subtitle="Bénéfice, taux moyens pondérés, stock USDT et top contreparties sur la période"
          actions={
            <>
              <MenuButton
                items={[
                  {
                    label: 'Actualiser',
                    icon: RefreshCw,
                    onSelect: () => { void refetch(); },
                    disabled: isFetching,
                    hint: 'Actualisation en cours…',
                  },
                  { label: 'Historique des opérations', icon: History, onSelect: () => navigate(OPERATIONS_ROUTE) },
                  { label: 'Comptes & soldes', icon: Wallet, onSelect: () => navigate(ACCOUNTS_ROUTE) },
                ]}
              />
              <Button icon={ArrowDownToLine} onClick={() => navigate('/m/more/treasury/purchase')}>
                Nouvel achat USDT
              </Button>
              <Button variant="primary" icon={ArrowUpFromLine} onClick={() => navigate('/m/more/treasury/sale')}>
                Nouvelle vente USDT
              </Button>
            </>
          }
        />
      }
    >
      <Toolbar
        className="mb-4"
        trailing={
          <span className={cn(DT.label, DFG.muted, 'tabular-nums')}>
            {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
          </span>
        }
      >
        <Segment value={preset} onChange={setPreset} options={PRESETS} />
        {preset === 'custom' ? (
          <>
            <Input
              type="date"
              aria-label="Début de période"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="Fin de période"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-40"
            />
          </>
        ) : null}
      </Toolbar>

      {isError ? (
        <Panel>
          <EmptyState
            icon={AlertTriangle}
            title="Analyse indisponible"
            hint="La requête a échoué — les chiffres ne sont pas à zéro, ils n'ont simplement pas pu être lus."
            action={
              <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                Réessayer
              </Button>
            }
          />
        </Panel>
      ) : isLoading || !dash ? (
        <Spinner />
      ) : (
        <>
          {/* La seule figure « hero » de l'écran. */}
          <Panel className="mb-4 p-4">
            <p className={cn(DT.micro, DFG.faint)}>Bénéfice période</p>
            <p className="mt-2">
              <Figure
                size="hero"
                tone={benefitPositive ? 'positive' : 'negative'}
                value={`${benefitPositive ? '+' : ''}${fmt(benefit, 0)}`}
                unit="XAF"
              />
            </p>
            <p className={cn(DT.label, DFG.muted, 'mt-2 font-normal')}>
              = XAF reçu clients − coût XAF des USDT vendus pour les livrer
            </p>
          </Panel>

          <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={ArrowDownToLine}
              tone="info"
              label="Achat USDT"
              value={fmt(dash.purchases.total_usdt, 2)}
              unit="USDT"
              hint={`${dash.purchases.count} op · ${fmt(dash.purchases.total_xaf, 0)} XAF`}
              onClick={() => navigate(PURCHASES_ROUTE)}
            />
            <Metric
              icon={ArrowUpFromLine}
              tone="pending"
              label="Vente USDT"
              value={fmt(dash.sales.total_usdt, 2)}
              unit="USDT"
              hint={`${dash.sales.count} op · ${fmt(dash.sales.total_cny, 2)} CNY`}
              onClick={() => navigate(SALES_ROUTE)}
            />
            <Metric
              icon={Percent}
              tone="info"
              label="Taux achat"
              value={fmt(dash.purchases.weighted_avg_rate_xaf_per_usdt, 4)}
              unit="XAF/USDT"
              hint="Moyen pondéré · voir les achats"
              onClick={() => navigate(PURCHASES_ROUTE)}
            />
            <Metric
              icon={Percent}
              tone="pending"
              label="Taux vente"
              value={fmt(dash.sales.weighted_avg_rate_cny_per_usdt, 4)}
              unit="CNY/USDT"
              hint="Moyen pondéré · voir les ventes"
              onClick={() => navigate(SALES_ROUTE)}
            />

            {/* Taux de revient : agrégat de toute la chaîne (achat + vente +
                frais). Aucun écran ne le détaille aujourd'hui, donc la tuile
                reste inerte plutôt que d'inventer une destination. */}
            <Metric
              icon={Scale}
              label="Taux de revient"
              value={fmt(revientXafPerCny, 4)}
              unit="XAF/CNY"
              hint={revientAlt ? `1M XAF = ${fmt(revientAlt, 0)} CNY` : 'Chaîne achat → vente'}
            />
            <Metric
              icon={Users}
              tone="info"
              label="Taux client"
              value={fmt(clientRateXafPerCny, 4)}
              unit="XAF/CNY"
              hint={clientAlt ? `1M XAF = ${fmt(clientAlt, 0)} CNY · voir les paiements` : 'Voir les paiements'}
              onClick={() => navigate(PAYMENTS_ROUTE)}
            />
            {/* Marge : différence des deux tuiles ci-dessus. Rien à ouvrir. */}
            {margePerCny !== null ? (
              <Metric
                icon={TrendingUp}
                tone={margePerCny >= 0 ? 'success' : 'danger'}
                label="Marge par CNY livré"
                value={`${margePerCny >= 0 ? '+' : ''}${fmt(margePerCny, 4)}`}
                unit="XAF/CNY"
                hint="= Taux client − taux de revient"
              />
            ) : null}
            <Metric
              icon={Coins}
              tone="success"
              label="CMP USDT"
              value={fmt(dash.wac_usdt_current, 4)}
              unit="XAF/USDT"
              hint="Coût moyen pondéré · voir les mouvements"
              onClick={() => navigate(OPERATIONS_ROUTE)}
            />
            <Metric
              icon={Coins}
              tone={dash.is_stock_usdt_negative ? 'danger' : undefined}
              label="Stock USDT"
              value={fmt(dash.stock_usdt, 2)}
              unit="USDT"
              hint="Achats − ventes · voir les mouvements"
              onClick={() => navigate(OPERATIONS_ROUTE)}
            />
            <Metric
              icon={Landmark}
              label="Capital immobilisé"
              value={fmt(dash.capital_immobilized_current_xaf, 0)}
              unit="XAF"
              hint="USDT × CMP + CNY × taux · voir les comptes"
              onClick={() => navigate(ACCOUNTS_ROUTE)}
            />
          </section>

          {dash.is_stock_usdt_negative ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#C0504D]/30 bg-[#FBE7E7] px-4 py-3 dark:border-[#E79A9A]/30 dark:bg-[#3A2526]">
              {/* Give the glyph the line box of the text beside it (13/20) so it
                  centres optically without a 2px nudge off the grid. */}
              <span className="flex h-5 shrink-0 items-center">
                <AlertTriangle className="h-4 w-4 text-[#C0504D] dark:text-[#E79A9A]" aria-hidden />
              </span>
              <div>
                <p className={cn(DT.body, 'font-bold text-[#C0504D] dark:text-[#E79A9A]')}>Stock USDT négatif</p>
                <p className={cn(DT.label, DFG.base, 'mt-1 font-normal')}>
                  Plus d'USDT ont été vendus qu'achetés. Enregistrez l'achat manquant ou corrigez l'opération fautive
                  avant de publier un taux de revient.
                </p>
              </div>
            </div>
          ) : null}

          <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cmpSeries && cmpSeries.length > 1 ? (
              <ChartPanel title="Évolution du CMP USDT" hint="Un point = une opération qui a déplacé le coût moyen" series="cmp">
                <CmpChart points={cmpSeries} />
              </ChartPanel>
            ) : null}

            {flowSeries && flowSeries.purchases.length >= 2 ? (
              <ChartPanel
                title="Évolution du coût d'achat USDT"
                hint={`${flowSeries.purchases.length} achats · taux effectif XAF/USDT`}
                series="purchase"
              >
                <FlowChart id="flow-purchases" series={flowSeries.purchases} unit="XAF/USDT" decimals={2} />
              </ChartPanel>
            ) : null}

            {flowSeries && flowSeries.purchases.length >= 3 ? (
              <ChartPanel
                title="Distribution du coût d'achat USDT"
                hint="Concentration des achats par tranche de taux"
                series="purchase"
                actions={<Figure value={fmt(weightedMedian(flowSeries.purchases), 2)} unit="médiane" size="md" />}
              >
                <DistributionChart series={flowSeries.purchases} unit="XAF/USDT" decimals={2} />
              </ChartPanel>
            ) : null}

            {flowSeries && flowSeries.sales.length >= 2 ? (
              <ChartPanel
                title="Évolution du prix de vente USDT"
                hint={`${flowSeries.sales.length} ventes · taux effectif CNY/USDT`}
                series="sale"
              >
                <FlowChart id="flow-sales" series={flowSeries.sales} unit="CNY/USDT" decimals={4} />
              </ChartPanel>
            ) : null}

            {flowSeries && flowSeries.sales.length >= 3 ? (
              <ChartPanel
                title="Distribution du prix de vente USDT"
                hint="Concentration des ventes par tranche de taux"
                series="sale"
                actions={<Figure value={fmt(weightedMedian(flowSeries.sales), 4)} unit="médiane" size="md" />}
              >
                <DistributionChart series={flowSeries.sales} unit="CNY/USDT" decimals={4} />
              </ChartPanel>
            ) : null}
          </section>

          <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <TopPanel
              title="Top fournisseurs USDT"
              rows={topSuppliers?.top ?? []}
              rateLabel="XAF/USDT"
              emptyText="Aucun fournisseur sur la période"
            />
            <TopPanel
              title="Top acheteurs CNY"
              rows={topBuyers?.top ?? []}
              rateLabel="CNY/USDT"
              emptyText="Aucun acheteur sur la période"
            />
          </section>
        </>
      )}
    </Workspace>
  );
}
