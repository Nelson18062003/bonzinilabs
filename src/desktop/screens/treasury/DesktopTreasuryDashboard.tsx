/**
 * Desktop admin — Treasury analytics dashboard.
 *
 * Same data hooks and (reused) building blocks as MobileTreasuryDashboard —
 * KpiCard, RateCardXafCny, FlowEvolutionChart, FlowDistributionChart, TopList,
 * QuickLink and the helpers are imported from it so nothing is reimplemented.
 * Only the layout changes: KPIs in 4-up rows and charts / top lists in a
 * two-column grid instead of one long mobile scroll.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, History, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DateField } from '@/components/form';
import { INSET, Pill, SectionTitle } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTopCounterparties, useTreasuryDashboard, useUsdtFlowEvolution, useWacEvolution } from '@/hooks/useTreasury';
import {
  KpiCard,
  RateCardXafCny,
  QuickLink,
  TopList,
  FlowEvolutionChart,
  FlowDistributionChart,
} from '@/mobile/screens/treasury/MobileTreasuryDashboard';
import { PRESETS, getRange, fmt, type Preset } from '@/mobile/screens/treasury/treasuryDashboardUtils';
import { cn } from '@/lib/utils';

function WacChartSection({ wacSeries }: { wacSeries: Array<{ at: string; wac: number }> }) {
  const data = wacSeries.map((p) => ({
    ...p,
    label: new Date(p.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  }));
  return (
    <section>
      <SectionTitle>Évolution WAC USDT</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-3">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              domain={['dataMin - 10', 'dataMax + 10']}
            />
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
  );
}

export function DesktopTreasuryDashboard() {
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
  const { data: flowSeries } = useUsdtFlowEvolution(fromIso, toIso);

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const benefitPositive = (dash?.benefit_total_xaf ?? 0) >= 0;
  const clientRateXafPerCny = dash?.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revientXafPerCny = dash?.taux_de_revient_xaf_per_cny ?? null;
  const margePerCny =
    clientRateXafPerCny !== null && revientXafPerCny !== null ? clientRateXafPerCny - revientXafPerCny : null;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Dashboard trésorerie</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">Bénéfice, taux moyens, stock et top contreparties</p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Pill key={p.value} active={preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </Pill>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
        </span>
      </div>
      {preset === 'custom' && (
        <div className={cn(INSET, 'grid max-w-md grid-cols-2 gap-2 p-3')}>
          <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {isLoading || !dash ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Benefit hero */}
          <div className={cn('rounded-3xl p-6', benefitPositive ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bénéfice période</div>
            <div className={cn('mt-1 text-4xl font-extrabold tabular-nums', benefitPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
              {dash.benefit_total_xaf >= 0 ? '+' : ''}
              {fmt(dash.benefit_total_xaf, 0)}
              <span className="ml-1 text-base font-semibold text-muted-foreground">XAF</span>
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">= XAF reçu clients − coût XAF des USDT vendus pour les livrer</div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Achat USDT" value={fmt(dash.purchases.total_usdt, 2)} unit="USDT" hint={`${dash.purchases.count} op · ${fmt(dash.purchases.total_xaf, 0)} XAF`} tone="violet" />
            <KpiCard label="Vente USDT" value={fmt(dash.sales.total_usdt, 2)} unit="USDT" hint={`${dash.sales.count} op · ${fmt(dash.sales.total_cny, 2)} CNY`} tone="amber" />
            <KpiCard label="Taux achat" value={fmt(dash.purchases.weighted_avg_rate_xaf_per_usdt, 4)} unit="XAF/USDT" tone="violet" />
            <KpiCard label="Taux vente" value={fmt(dash.sales.weighted_avg_rate_cny_per_usdt, 4)} unit="CNY/USDT" tone="amber" />
            <RateCardXafCny label="Revient" xafPerCny={revientXafPerCny} tone="emerald" />
            <RateCardXafCny label="Client" xafPerCny={clientRateXafPerCny} tone="orange" />
            <KpiCard label="WAC USDT" value={fmt(dash.wac_usdt_current, 4)} unit="XAF/USDT" tone="emerald" />
            <KpiCard label="Stock USDT" value={fmt(dash.stock_usdt, 2)} unit="USDT" tone={dash.is_stock_usdt_negative ? 'red' : 'neutral'} />
          </div>

          {/* Marge + capital */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {margePerCny !== null && (
              <div className="rounded-2xl bg-emerald-500/10 p-4">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Marge par CNY livré</div>
                <div className={cn('text-[20px] font-extrabold tabular-nums', margePerCny >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                  {margePerCny >= 0 ? '+' : ''}
                  {fmt(margePerCny, 4)}
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">XAF / CNY livré</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">= Taux client − Taux de revient</div>
              </div>
            )}
            <KpiCard label="Capital immobilisé" value={fmt(dash.capital_immobilized_current_xaf, 0)} unit="XAF" hint="USDT × WAC + CNY × taux" tone="neutral" />
          </div>

          {dash.is_stock_usdt_negative && (
            <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-[12px] text-red-700 dark:text-red-300">Stock USDT négatif. Cherche un achat manquant à enregistrer.</span>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {wacSeries && wacSeries.length > 1 && <WacChartSection wacSeries={wacSeries} />}
            {flowSeries && flowSeries.purchases.length >= 2 && (
              <FlowEvolutionChart series={flowSeries.purchases} title="Évolution du coût d'achat USDT" hint="Un point = un achat saisi · taux effectif XAF/USDT" tone="violet" unit="XAF/USDT" decimals={2} />
            )}
            {flowSeries && flowSeries.purchases.length >= 3 && (
              <FlowDistributionChart series={flowSeries.purchases} title="Distribution du coût d'achat USDT" hint="Concentration des achats par tranche de taux" tone="violet" unit="XAF/USDT" decimals={2} />
            )}
            {flowSeries && flowSeries.sales.length >= 2 && (
              <FlowEvolutionChart series={flowSeries.sales} title="Évolution du prix de vente USDT" hint="Un point = une vente saisie · taux effectif CNY/USDT" tone="amber" unit="CNY/USDT" decimals={4} />
            )}
            {flowSeries && flowSeries.sales.length >= 3 && (
              <FlowDistributionChart series={flowSeries.sales} title="Distribution du prix de vente USDT" hint="Concentration des ventes par tranche de taux" tone="amber" unit="CNY/USDT" decimals={4} />
            )}
          </div>

          {/* Top lists */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle>Top fournisseurs USDT</SectionTitle>
              <TopList rows={topSuppliers?.top ?? []} rateLabel="XAF/USDT" emptyText="Aucun fournisseur sur la période." />
            </section>
            <section>
              <SectionTitle>Top acheteurs CNY</SectionTitle>
              <TopList rows={topBuyers?.top ?? []} rateLabel="CNY/USDT" emptyText="Aucun acheteur sur la période." />
            </section>
          </div>

          {/* Quick links */}
          <div className="grid max-w-md grid-cols-3 gap-2.5">
            <QuickLink icon={ArrowDownToLine} label="Achat" tone="violet" onClick={() => navigate('/m/more/treasury/purchase')} />
            <QuickLink icon={ArrowUpFromLine} label="Vente" tone="amber" onClick={() => navigate('/m/more/treasury/sale')} />
            <QuickLink icon={History} label="Historique" tone="neutral" onClick={() => navigate('/m/more/treasury/operations')} />
          </div>
        </>
      )}
    </div>
  );
}
