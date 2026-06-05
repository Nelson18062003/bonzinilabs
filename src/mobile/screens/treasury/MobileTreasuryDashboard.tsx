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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { DateField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
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
  tone?: 'violet' | 'amber' | 'orange' | 'emerald' | 'red' | 'neutral';
  trend?: 'up' | 'down';
}) {
  const toneClasses: Record<string, string> = {
    violet: 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10',
    amber: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10',
    orange: 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10',
    emerald: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10',
    red: 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10',
    neutral: 'border-border bg-card',
  };
  const labelTone: Record<string, string> = {
    violet: 'text-violet-700 dark:text-violet-300',
    amber: 'text-amber-700 dark:text-amber-300',
    orange: 'text-orange-700 dark:text-orange-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-red-700 dark:text-red-300',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className={cn('rounded-2xl border p-3.5', toneClasses[tone ?? 'neutral'])}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', labelTone[tone ?? 'neutral'])}>
          {label}
        </span>
        {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
      </div>
      <div className="text-[18px] font-extrabold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-xs font-semibold text-muted-foreground ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
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
  tone: 'violet' | 'amber' | 'orange' | 'emerald';
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

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const benefitTone = (dash?.benefit_total_xaf ?? 0) >= 0 ? 'emerald' : 'red';

  // Client rate is XAF/CNY directly from the existing `payments` table.
  const clientRateXafPerCny = dash?.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revientXafPerCny = dash?.taux_de_revient_xaf_per_cny ?? null;
  const margePerCny =
    clientRateXafPerCny !== null && revientXafPerCny !== null
      ? clientRateXafPerCny - revientXafPerCny
      : null;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Dashboard trésorerie" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-5">
        {/* Period chips (scrollable on small screens) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                'flex-shrink-0 h-9 px-3 rounded-full text-[12px] font-semibold border-2 transition-colors',
                preset === p.value
                  ? 'border-violet-600 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range pickers */}
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl p-3">
            <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground -mt-2">
          {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
        </div>

        {isLoading || !dash ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Bénéfice headline */}
            <div className={cn(
              'rounded-2xl border-2 p-4',
              benefitTone === 'emerald' ? 'border-emerald-300 dark:border-emerald-600/50 bg-emerald-50 dark:bg-emerald-500/10' : 'border-red-300 dark:border-red-600/50 bg-red-50 dark:bg-red-500/10',
            )}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Bénéfice période
              </div>
              <div className={cn(
                'text-3xl font-extrabold tabular-nums',
                benefitTone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
              )}>
                {dash.benefit_total_xaf >= 0 ? '+' : ''}
                {fmt(dash.benefit_total_xaf, 0)}
                <span className="text-sm font-semibold text-muted-foreground ml-1">XAF</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                = XAF reçu clients − coût XAF des USDT vendus pour les livrer
              </div>
            </div>

            {/* Volumes */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Volumes</h2>
              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Achat USDT"
                  value={fmt(dash.purchases.total_usdt, 2)}
                  unit="USDT"
                  hint={`${dash.purchases.count} op · ${fmt(dash.purchases.total_xaf, 0)} XAF`}
                  tone="violet"
                />
                <KpiCard
                  label="Vente USDT"
                  value={fmt(dash.sales.total_usdt, 2)}
                  unit="USDT"
                  hint={`${dash.sales.count} op · ${fmt(dash.sales.total_cny, 2)} CNY`}
                  tone="amber"
                />
              </div>
            </section>

            {/* Taux moyens pondérés (XAF/USDT, CNY/USDT) */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Taux moyens pondérés
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Achat"
                  value={fmt(dash.purchases.weighted_avg_rate_xaf_per_usdt, 4)}
                  unit="XAF/USDT"
                  tone="violet"
                />
                <KpiCard
                  label="Vente"
                  value={fmt(dash.sales.weighted_avg_rate_cny_per_usdt, 4)}
                  unit="CNY/USDT"
                  tone="amber"
                />
              </div>
            </section>

            {/* Taux XAF/CNY (revient / client / marge) avec format dual */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Taux XAF / CNY
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <RateCardXafCny label="Revient" xafPerCny={revientXafPerCny} tone="emerald" />
                <RateCardXafCny label="Client" xafPerCny={clientRateXafPerCny} tone="orange" />
                {margePerCny !== null && (
                  <div className="col-span-2 bg-gradient-to-br from-emerald-50 dark:from-emerald-500/10 to-amber-50 dark:to-amber-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                      Marge par CNY livré
                    </div>
                    <div className={cn(
                      'text-[18px] font-extrabold tabular-nums',
                      margePerCny >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
                    )}>
                      {margePerCny >= 0 ? '+' : ''}
                      {fmt(margePerCny, 4)}
                      <span className="text-xs font-semibold text-muted-foreground ml-1">XAF / CNY livré</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      = Taux client − Taux de revient
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* WAC + stocks */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Stock & capital</h2>
              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="WAC USDT"
                  value={fmt(dash.wac_usdt_current, 4)}
                  unit="XAF/USDT"
                  tone="emerald"
                />
                <KpiCard
                  label="Stock USDT"
                  value={fmt(dash.stock_usdt, 2)}
                  unit="USDT"
                  tone={dash.is_stock_usdt_negative ? 'red' : 'neutral'}
                />
                <KpiCard
                  label="Capital immobilisé"
                  value={fmt(dash.capital_immobilized_current_xaf, 0)}
                  unit="XAF"
                  hint="USDT × WAC + CNY × taux"
                  tone="neutral"
                />
              </div>
              {dash.is_stock_usdt_negative && (
                <div className="mt-2 flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[12px] text-red-700 dark:text-red-300">
                    Stock USDT négatif. Cherche un achat manquant à enregistrer.
                  </span>
                </div>
              )}
            </section>

            {/* WAC chart */}
            {wacSeries && wacSeries.length > 1 && (
              <section>
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Évolution WAC USDT
                </h2>
                <div className="bg-card border border-border rounded-2xl p-3">
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
                      <Line
                        type="monotone"
                        dataKey="wac"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Top counterparties */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Top fournisseurs USDT
              </h2>
              <TopList
                rows={topSuppliers?.top ?? []}
                rateLabel="XAF/USDT"
                emptyText="Aucun fournisseur sur la période."
              />
            </section>

            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Top acheteurs CNY
              </h2>
              <TopList
                rows={topBuyers?.top ?? []}
                rateLabel="CNY/USDT"
                emptyText="Aucun acheteur sur la période."
              />
            </section>

            {/* Quick links */}
            <section className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={() => navigate('/m/more/treasury/purchase')}
                className="bg-violet-600 text-white rounded-xl py-3 flex flex-col items-center gap-1 active:opacity-80"
              >
                <ArrowDownToLine className="w-5 h-5" />
                <span className="text-[11px] font-bold">Achat</span>
              </button>
              <button
                onClick={() => navigate('/m/more/treasury/sale')}
                className="bg-amber-500 text-white rounded-xl py-3 flex flex-col items-center gap-1 active:opacity-80"
              >
                <ArrowUpFromLine className="w-5 h-5" />
                <span className="text-[11px] font-bold">Vente</span>
              </button>
              <button
                onClick={() => navigate('/m/more/treasury/operations')}
                className="bg-slate-700 text-white rounded-xl py-3 flex flex-col items-center gap-1 active:opacity-80"
              >
                <History className="w-5 h-5" />
                <span className="text-[11px] font-bold">Historique</span>
              </button>
            </section>
          </>
        )}
      </div>
    </div>
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
    return <div className="text-center text-muted-foreground text-[12px] py-4">{emptyText}</div>;
  }
  return (
    <div className="bg-card rounded-2xl border border-border divide-y divide-border/60 overflow-hidden">
      {rows.map((r, i) => (
        <div key={r.id} className="p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center text-[12px] font-bold">
            #{i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] truncate">{r.display_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {r.operation_count} op · {fmt(r.total_usdt, 2)} USDT
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-[13px] tabular-nums">{fmt(r.weighted_avg_rate, 4)}</div>
            <div className="text-[10px] text-muted-foreground">{rateLabel}</div>
          </div>
          <div
            className={cn(
              'text-right tabular-nums w-12 text-[11px] font-bold',
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
