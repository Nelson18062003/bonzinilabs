import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  History,
  AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useTopCounterparties,
  useTreasuryDashboard,
  useWacEvolution,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | 'mtd';

function getRange(preset: Preset): { from: Date; to: Date; label: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === '7d') {
    from.setDate(to.getDate() - 7);
    return { from, to, label: '7 derniers jours' };
  }
  if (preset === '30d') {
    from.setDate(to.getDate() - 30);
    return { from, to, label: '30 derniers jours' };
  }
  // mtd
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return { from, to, label: 'Mois en cours' };
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
  trend?: 'up' | 'down' | 'flat';
}) {
  const toneClasses: Record<string, string> = {
    violet: 'border-violet-200 bg-violet-50',
    amber: 'border-amber-200 bg-amber-50',
    orange: 'border-orange-200 bg-orange-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    red: 'border-red-200 bg-red-50',
    neutral: 'border-border bg-white',
  };
  const labelTone: Record<string, string> = {
    violet: 'text-violet-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className={cn('rounded-2xl border p-3.5', toneClasses[tone ?? 'neutral'])}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', labelTone[tone ?? 'neutral'])}>
          {label}
        </span>
        {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
      </div>
      <div className="text-[18px] font-extrabold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-xs font-semibold text-muted-foreground ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function MobileTreasuryDashboard() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const range = useMemo(() => getRange(preset), [preset]);
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

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Dashboard trésorerie" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-5">
        {/* Period */}
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { value: '7d' as const, label: '7 j' },
            { value: '30d' as const, label: '30 j' },
            { value: 'mtd' as const, label: 'Mois' },
          ]).map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                'flex-1 h-9 rounded-lg text-[13px] font-semibold transition-colors',
                preset === p.value ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
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
              benefitTone === 'emerald' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50',
            )}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Bénéfice période
              </div>
              <div className={cn(
                'text-3xl font-extrabold tabular-nums',
                benefitTone === 'emerald' ? 'text-emerald-700' : 'text-red-700',
              )}>
                {dash.benefit_total_xaf >= 0 ? '+' : ''}
                {fmt(dash.benefit_total_xaf, 0)}
                <span className="text-sm font-semibold text-muted-foreground ml-1">XAF</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-[12px]">
                <div>
                  <span className="text-muted-foreground">Spread chaîne</span>
                  <div className={cn('font-bold', dash.spread_chain_xaf >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {dash.spread_chain_xaf >= 0 ? '+' : ''}{fmt(dash.spread_chain_xaf, 0)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Spread client</span>
                  <div className={cn('font-bold', dash.spread_client_xaf >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {dash.spread_client_xaf >= 0 ? '+' : ''}{fmt(dash.spread_client_xaf, 0)}
                  </div>
                </div>
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

            {/* Taux moyens pondérés */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Taux moyens pondérés</h2>
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
                <KpiCard
                  label="Client"
                  value={fmt(dash.client_rate.weighted_avg_rate_xaf_per_cny, 4)}
                  unit="XAF/CNY"
                  hint={`${dash.client_rate.count} paiements`}
                  tone="orange"
                />
                <KpiCard
                  label="WAC USDT actuel"
                  value={fmt(dash.wac_usdt_current, 4)}
                  unit="XAF/USDT"
                  tone="emerald"
                />
              </div>
            </section>

            {/* Stocks & capital */}
            <section>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Stock & capital</h2>
              <div className="grid grid-cols-2 gap-2">
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
                <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-[12px] text-red-700">
                    Stock USDT négatif. Cherchez un achat manquant à enregistrer.
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
                <div className="bg-white border border-border rounded-2xl p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={wacSeries.map((p) => ({
                      ...p,
                      label: new Date(p.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip
                        formatter={(v: number) => [`${fmt(v, 4)} XAF/USDT`, 'WAC']}
                        labelStyle={{ fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="wac"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ r: 3 }}
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
    <div className="bg-white rounded-2xl border border-border divide-y divide-border/60 overflow-hidden">
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
                ? 'text-red-600'
                : 'text-emerald-600',
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
