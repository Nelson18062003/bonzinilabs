import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { DateField } from '@/components/form';
import { IconChip, INSET, Pill, SectionTitle, SOFT_CARD, TONE_DOT, TONE_TEXT } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useMarketRateEvolution,
  useTopCounterparties,
  useTreasuryDashboard,
  useWacEvolution,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Custom' },
];

function getRange(preset: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  switch (preset) {
    case 'day':
      from.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      // Monday-based start.
      const dayOfWeek = from.getDay() || 7; // Sun=7
      from.setDate(from.getDate() - (dayOfWeek - 1));
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'quarter': {
      const m = from.getMonth();
      const startMonth = m - (m % 3);
      from.setMonth(startMonth, 1);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'year':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'all':
      from.setFullYear(2020, 0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00') : new Date(to.getFullYear(), to.getMonth(), 1),
        to: customTo ? new Date(customTo + 'T23:59:59') : to,
      };
  }
  return { from, to };
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "1M XAF → X CNY" representation of a XAF/CNY rate. */
function toCnyPer1MXaf(xafPerCny: number | null | undefined): number | null {
  if (xafPerCny === null || xafPerCny === undefined || !Number.isFinite(xafPerCny) || xafPerCny <= 0) return null;
  return 1_000_000 / xafPerCny;
}

type KpiTone = 'violet' | 'amber' | 'orange' | 'emerald' | 'red' | 'neutral';
const KPI_DOT: Record<KpiTone, string> = {
  violet: TONE_DOT.violet,
  amber: TONE_DOT.amber,
  orange: TONE_DOT.orange,
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  neutral: 'bg-muted-foreground/40',
};
const KPI_TEXT: Record<KpiTone, string> = {
  violet: TONE_TEXT.violet,
  amber: TONE_TEXT.amber,
  orange: TONE_TEXT.orange,
  emerald: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

function KpiCard({
  label,
  value,
  unit,
  hint,
  tone,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: KpiTone;
  trend?: 'up' | 'down';
}) {
  const t = tone ?? 'neutral';
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', KPI_DOT[t])} />
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', KPI_TEXT[t])}>{label}</span>
        {trend === 'up' && <TrendingUp className="ml-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        {trend === 'down' && <TrendingDown className="ml-auto h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
      </div>
      <div className="text-[18px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Rate card showing XAF/CNY value AND the "1M XAF = X CNY" dual format. */
function RateCardXafCny({
  label,
  xafPerCny,
  tone,
}: {
  label: string;
  xafPerCny: number | null | undefined;
  tone: KpiTone;
}) {
  const altFormat = toCnyPer1MXaf(xafPerCny ?? null);
  return (
    <KpiCard
      label={label}
      value={fmt(xafPerCny ?? null, 4)}
      unit="XAF/CNY"
      tone={tone}
      hint={altFormat ? `1M XAF = ${fmt(altFormat, 0)} CNY` : undefined}
    />
  );
}

export function MobileTreasuryDashboard() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('month');
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(monthStart);
  const [customTo, setCustomTo] = useState(today);

  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data: dash, isLoading } = useTreasuryDashboard(fromIso, toIso);
  const { data: topSuppliers } = useTopCounterparties('usdt_supplier', fromIso, toIso, 5);
  const { data: topBuyers } = useTopCounterparties('cny_buyer', fromIso, toIso, 5);
  const { data: wacSeries } = useWacEvolution(fromIso, toIso);
  const { data: marketSeries } = useMarketRateEvolution(fromIso, toIso);

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const benefitPositive = (dash?.benefit_total_xaf ?? 0) >= 0;

  // Client rate is XAF/CNY directly from the existing `payments` table.
  const clientRateXafPerCny = dash?.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revientXafPerCny = dash?.taux_de_revient_xaf_per_cny ?? null;
  const margePerCny =
    clientRateXafPerCny !== null && revientXafPerCny !== null ? clientRateXafPerCny - revientXafPerCny : null;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Dashboard trésorerie" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-5 space-y-6">
        {/* Period chips (scrollable on small screens) */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {PRESETS.map((p) => (
            <Pill key={p.value} active={preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </Pill>
          ))}
        </div>

        {/* Custom range pickers */}
        {preset === 'custom' && (
          <div className={cn(INSET, 'grid grid-cols-2 gap-2 p-3')}>
            <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="-mt-3 text-center text-[11px] text-muted-foreground">
          {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
        </div>

        {isLoading || !dash ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Bénéfice headline */}
            <div className={cn('rounded-3xl p-5', benefitPositive ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bénéfice période</div>
              <div className={cn('text-3xl font-extrabold tabular-nums', benefitPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                {dash.benefit_total_xaf >= 0 ? '+' : ''}
                {fmt(dash.benefit_total_xaf, 0)}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">XAF</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                = XAF reçu clients − coût XAF des USDT vendus pour les livrer
              </div>
            </div>

            {/* Volumes */}
            <section>
              <SectionTitle>Volumes</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <KpiCard label="Achat USDT" value={fmt(dash.purchases.total_usdt, 2)} unit="USDT" hint={`${dash.purchases.count} op · ${fmt(dash.purchases.total_xaf, 0)} XAF`} tone="violet" />
                <KpiCard label="Vente USDT" value={fmt(dash.sales.total_usdt, 2)} unit="USDT" hint={`${dash.sales.count} op · ${fmt(dash.sales.total_cny, 2)} CNY`} tone="amber" />
              </div>
            </section>

            {/* Taux moyens pondérés */}
            <section>
              <SectionTitle>Taux moyens pondérés</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <KpiCard label="Achat" value={fmt(dash.purchases.weighted_avg_rate_xaf_per_usdt, 4)} unit="XAF/USDT" tone="violet" />
                <KpiCard label="Vente" value={fmt(dash.sales.weighted_avg_rate_cny_per_usdt, 4)} unit="CNY/USDT" tone="amber" />
              </div>
            </section>

            {/* Taux XAF/CNY (revient / client / marge) */}
            <section>
              <SectionTitle>Taux XAF / CNY</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <RateCardXafCny label="Revient" xafPerCny={revientXafPerCny} tone="emerald" />
                <RateCardXafCny label="Client" xafPerCny={clientRateXafPerCny} tone="orange" />
                {margePerCny !== null && (
                  <div className="col-span-2 rounded-2xl bg-emerald-500/10 p-4">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Marge par CNY livré</div>
                    <div className={cn('text-[18px] font-extrabold tabular-nums', margePerCny >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                      {margePerCny >= 0 ? '+' : ''}
                      {fmt(margePerCny, 4)}
                      <span className="ml-1 text-xs font-semibold text-muted-foreground">XAF / CNY livré</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">= Taux client − Taux de revient</div>
                  </div>
                )}
              </div>
            </section>

            {/* WAC + stocks */}
            <section>
              <SectionTitle>Stock & capital</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <KpiCard label="WAC USDT" value={fmt(dash.wac_usdt_current, 4)} unit="XAF/USDT" tone="emerald" />
                <KpiCard label="Stock USDT" value={fmt(dash.stock_usdt, 2)} unit="USDT" tone={dash.is_stock_usdt_negative ? 'red' : 'neutral'} />
                <div className="col-span-2">
                  <KpiCard label="Capital immobilisé" value={fmt(dash.capital_immobilized_current_xaf, 0)} unit="XAF" hint="USDT × WAC + CNY × taux" tone="neutral" />
                </div>
              </div>
              {dash.is_stock_usdt_negative && (
                <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="text-[12px] text-red-700 dark:text-red-300">Stock USDT négatif. Cherche un achat manquant à enregistrer.</span>
                </div>
              )}
            </section>

            {/* WAC chart */}
            {wacSeries && wacSeries.length > 1 && (
              <section>
                <SectionTitle>Évolution WAC USDT</SectionTitle>
                <div className="rounded-2xl border border-border bg-card p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={wacSeries.map((p) => ({
                      ...p,
                      label: new Date(p.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip
                        formatter={(v: number) => [`${fmt(v, 4)} XAF/USDT`, 'WAC']}
                        labelStyle={{ fontSize: 12, color: 'hsl(var(--popover-foreground))' }}
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          fontSize: 12,
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Line type="monotone" dataKey="wac" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Évolution du marché — coût d'achat USDT (Cameroun) */}
            {marketSeries && marketSeries.length > 1 && (
              <MarketRateChart
                series={marketSeries.map((p) => ({ at: p.at, value: p.cost_xaf }))}
                title="Coût d'achat USDT (marché Cameroun)"
                hint="VWAP des asks Binance P2P · table rate_snapshots"
                tone="violet"
                unit="XAF/USDT"
                decimals={2}
              />
            )}

            {/* Évolution du marché — prix de vente USDT (Chine) */}
            {marketSeries && marketSeries.length > 1 && (
              <MarketRateChart
                series={marketSeries.map((p) => ({ at: p.at, value: p.price_cny }))}
                title="Prix de vente USDT (marché Chine)"
                hint="VWAP des bids Binance P2P − spread OTC · table rate_snapshots"
                tone="amber"
                unit="CNY/USDT"
                decimals={4}
              />
            )}

            {/* Top counterparties */}
            <section>
              <SectionTitle>Top fournisseurs USDT</SectionTitle>
              <TopList rows={topSuppliers?.top ?? []} rateLabel="XAF/USDT" emptyText="Aucun fournisseur sur la période." />
            </section>

            <section>
              <SectionTitle>Top acheteurs CNY</SectionTitle>
              <TopList rows={topBuyers?.top ?? []} rateLabel="CNY/USDT" emptyText="Aucun acheteur sur la période." />
            </section>

            {/* Quick links */}
            <section className="grid grid-cols-3 gap-2.5">
              <QuickLink icon={ArrowDownToLine} label="Achat" tone="violet" onClick={() => navigate('/m/more/treasury/purchase')} />
              <QuickLink icon={ArrowUpFromLine} label="Vente" tone="amber" onClick={() => navigate('/m/more/treasury/sale')} />
              <QuickLink icon={History} label="Historique" tone="neutral" onClick={() => navigate('/m/more/treasury/operations')} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function QuickLink({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  tone: 'violet' | 'amber' | 'neutral';
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(SOFT_CARD, 'flex flex-col items-center gap-2 py-3.5 transition active:scale-[0.98]')}>
      <IconChip icon={icon} tone={tone} size="sm" />
      <span className="text-[11px] font-bold text-foreground">{label}</span>
    </button>
  );
}

function TopList({
  rows,
  rateLabel,
  emptyText,
}: {
  rows: Array<{
    id: string;
    display_name: string;
    operation_count: number;
    total_usdt: number;
    weighted_avg_rate: number;
    deviation_pct: number;
  }>;
  rateLabel: string;
  emptyText: string;
}) {
  if (!rows || rows.length === 0) {
    return <div className="py-4 text-center text-[12px] text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-3xl border border-border bg-card">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 p-3.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-foreground">
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-foreground">{r.display_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {r.operation_count} op · {fmt(r.total_usdt, 2)} USDT
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold tabular-nums text-foreground">{fmt(r.weighted_avg_rate, 4)}</div>
            <div className="text-[10px] text-muted-foreground">{rateLabel}</div>
          </div>
          <div
            className={cn(
              'w-12 text-right text-[11px] font-bold tabular-nums',
              Math.abs(r.deviation_pct) < 0.5
                ? 'text-muted-foreground'
                : r.deviation_pct > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400',
            )}
            title="Écart vs moyenne période"
          >
            {r.deviation_pct >= 0 ? '+' : ''}
            {fmt(r.deviation_pct, 2)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MarketRateChart — courbe d'évolution d'un prix marché (achat XAF ou vente CNY).
// S'aligne sur le style du graphique 'Évolution WAC USDT' au-dessus, avec un
// dégradé sous la ligne et un tooltip colorisé selon la 'tone' Treasury.
// ────────────────────────────────────────────────────────────────────────────

const TONE_STROKE: Record<'violet' | 'amber', string> = {
  violet: 'hsl(258 100% 60%)',
  amber: 'hsl(36 100% 55%)',
};

function MarketRateChart({
  series,
  title,
  hint,
  tone,
  unit,
  decimals,
}: {
  series: { at: string; value: number }[];
  title: string;
  hint?: string;
  tone: 'violet' | 'amber';
  unit: string;
  decimals: number;
}) {
  const stroke = TONE_STROKE[tone];
  const gradientId = `market-rate-${tone}`;
  const data = series.map((p) => ({
    ...p,
    label: new Date(p.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  }));
  const values = series.map((p) => p.value);
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPct = first !== 0 ? (delta / first) * 100 : 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, max * 0.0015);
  const yMin = Math.max(0, min - padding);
  const yMax = max + padding;

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-extrabold tabular-nums" style={{ color: stroke }}>{fmt(last, decimals)}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">{unit}</span>
          </div>
          <span
            className={cn(
              'text-[11px] font-bold tabular-nums',
              delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {delta >= 0 ? '+' : ''}{fmt(delta, decimals)} ({delta >= 0 ? '+' : ''}{fmt(deltaPct, 2)}%)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => fmt(v, decimals)}
              width={62}
            />
            <Tooltip
              formatter={(v: number) => [`${fmt(v, decimals)} ${unit}`, '']}
              labelStyle={{ fontSize: 12, color: 'hsl(var(--popover-foreground))' }}
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                fontSize: 12,
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={data.length <= 30 ? { r: 2.5, fill: stroke, strokeWidth: 0 } : false}
              activeDot={{ r: 4, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {hint && <div className="mt-1.5 text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </section>
  );
}

