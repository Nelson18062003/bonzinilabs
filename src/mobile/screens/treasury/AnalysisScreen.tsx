/**
 * Analyse trésorerie — maquettes 07-tresorerie/30 à 34, cinq écrans qui se
 * suivent par balayage (points en bas), sur la période partagée :
 *
 *   1. le bénéfice (marge par ¥ livré, taux client, taux de revient, CNY livrés),
 *      barres par semaine, la semaine en cours en contour ;
 *   2. le stock d'USDT en fin de journée, le point le plus bas, le capital immobilisé ;
 *   3. le coût moyen et le taux d'achat du jour (ou le taux de vente) ;
 *   4. les volumes achetés / vendus par semaine ;
 *   5. la part de chaque fournisseur ou acheteur, son taux et son écart.
 *
 * Mêmes sources que l'ordinateur : `get_treasury_dashboard` (aussi semaine
 * par semaine pour les barres), `get_top_counterparties`, séries WAC et flux.
 * Le « … » reprend la période et l'export CSV.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Download } from 'lucide-react';
import {
  useTopCounterparties, useTreasuryDashboard, useTreasuryOperations, useUsdtFlowEvolution, useWacEvolution, type TreasuryDashboard,
} from '@/hooks/useTreasury';
import { exportCsv } from '@/lib/analytics/csvExport';
import { fmtNum, withSign } from '@/desktop/screens/treasury/treasuryFormat';
import { viewOperation } from '@/desktop/screens/treasury/operationView';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BarChart, BigFigure, BoxSegmented, ChartCard, ChartLegend, EmptyLine, KVBox, LineChart, MoreButton, ScreenTop, ShareRow, TEXT, Tag,
  useSheet, type Tone,
} from '@/mobile/designKit';
import { GroupedBarChart, Pager, PeriodChip, PeriodSheet, SquareLegend, TreasuryGate } from './parts';
import { bizDay, daysOf, fmtUsdt, periodNoun, shortDay, tp, usePeriod, useWeeklyDashboards, weeksOf, type PeriodState } from './treasuryMobile';

export function AnalysisScreen() {
  return (
    <TreasuryGate>
      <AnalysisBody />
    </TreasuryGate>
  );
}

/** « 30 k », « 1,2 M » — seulement pour les repères d'axe. */
function axis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${fmtNum(v / 1_000_000, a >= 10_000_000 ? 0 : 1)} M`;
  if (a >= 1_000) return `${fmtNum(v / 1_000, 0)} k`;
  return fmtNum(v, 0);
}

/** Trois repères ronds qui encadrent les valeurs. */
function ticksFor(values: number[]): number[] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo || Math.abs(hi) || 1;
  const step = 10 ** Math.floor(Math.log10(span / 2));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 3) ?? step * 10;
  // Des repères qui ENCADRENT les valeurs (le graphe s'étend jusqu'à eux).
  const start = Math.floor(lo / nice) * nice;
  const end = Math.ceil(hi / nice) * nice;
  const out: number[] = [];
  for (let t = start; t <= end + nice * 0.001 && out.length < 5; t += nice) out.push(Math.round(t * 1e6) / 1e6);
  return out.length >= 2 ? out : [lo, hi];
}

function edgeLabels(n: number, labels: string[]): Record<number, string> {
  if (n === 0) return {};
  if (n === 1) return { 0: labels[0] };
  return { 0: labels[0], [n - 1]: labels[n - 1] };
}

function AnalysisBody() {
  const navigate = useNavigate();
  const period = usePeriod();
  const more = useSheet();
  const periodSheet = useSheet();
  const [page, setPage] = useState(0);
  const dash = useTreasuryDashboard(period.fromIso, period.toIso);
  const d = dash.data;

  const exportIt = () => {
    if (!d) return;
    exportCsv(`tresorerie_${bizDay(period.range.from)}_${bizDay(period.range.to)}.csv`, [
      { indicateur: 'Bénéfice (XAF)', valeur: d.benefit_total_xaf },
      { indicateur: 'Taux client (XAF/CNY)', valeur: d.client_rate.weighted_avg_rate_xaf_per_cny },
      { indicateur: 'Taux de revient (XAF/CNY)', valeur: d.taux_de_revient_xaf_per_cny },
      { indicateur: 'CNY livrés', valeur: d.client_rate.total_cny },
      { indicateur: 'Achats (nombre)', valeur: d.purchases.count },
      { indicateur: 'USDT achetés', valeur: d.purchases.total_usdt },
      { indicateur: 'XAF payés', valeur: d.purchases.total_xaf },
      { indicateur: 'Taux d’achat moyen (XAF/USDT)', valeur: d.purchases.weighted_avg_rate_xaf_per_usdt },
      { indicateur: 'Ventes (nombre)', valeur: d.sales.count },
      { indicateur: 'USDT vendus', valeur: d.sales.total_usdt },
      { indicateur: 'CNY reçus', valeur: d.sales.total_cny },
      { indicateur: 'Taux de vente moyen (CNY/USDT)', valeur: d.sales.weighted_avg_rate_cny_per_usdt },
      { indicateur: 'Stock USDT', valeur: d.stock_usdt },
      { indicateur: 'Coût moyen (XAF/USDT)', valeur: d.wac_usdt_current },
      { indicateur: 'Capital immobilisé (XAF)', valeur: d.capital_immobilized_current_xaf },
    ]);
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Analyse trésorerie" right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pt-4">
        <PeriodChip onClick={periodSheet.show} />
      </div>
      {dash.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void dash.refetch() }}>L’analyse n’a pas pu être calculée.</EmptyLine>
      ) : !d ? (
        <EmptyLine>Chargement…</EmptyLine>
      ) : (
        <Pager
          index={page}
          onIndex={setPage}
          pages={[
            <ProfitPage key="p" d={d} period={period} />,
            <StockPage key="s" d={d} period={period} />,
            <CostPage key="c" d={d} period={period} />,
            <VolumePage key="v" d={d} period={period} />,
            <RankPage key="r" period={period} onOpen={(id) => navigate(tp.counterparty(id))} />,
          ]}
        />
      )}
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Période', hint: period.label, icon: CalendarDays, onClick: periodSheet.show },
          { label: 'Exporter en CSV', icon: Download, onClick: exportIt, disabled: !d },
        ]}
      />
      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 px-5 pt-5">{children}</div>;
}

/* 1 · Bénéfice ──────────────────────────────────────────────────────────── */
function ProfitPage({ d, period }: { d: TreasuryDashboard; period: PeriodState }) {
  const [sel, setSel] = useState<number | null>(null);
  const weeks = useMemo(() => weeksOf(period.range, 8), [period.range]);
  const weekly = useWeeklyDashboards(weeks);
  const clientRate = d.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revient = d.taux_de_revient_xaf_per_cny ?? null;
  const marge = clientRate !== null && revient !== null ? clientRate - revient : null;
  const bars = weeks.map((w, i) => {
    const v = Number(weekly[i]?.data?.benefit_total_xaf ?? 0);
    return { label: w.label, value: v, display: `${withSign(v, 0)} XAF`, current: w.current };
  });
  const loading = weekly.some((q) => q.isLoading);
  const peak = bars.reduce((m, b, i) => (b.value > (bars[m]?.value ?? -Infinity) ? i : m), 0);
  return (
    <Page>
      <BigFigure
        label={`Bénéfice · ${periodNoun(period)}`}
        size="md"
        value={withSign(d.benefit_total_xaf, 0)}
        unit="XAF"
        note={marge !== null ? <span>Marge <b className="font-bold">{withSign(marge, 2)}</b> XAF par ¥ livré</span> : undefined}
      />
      <ChartCard title="Bénéfice par semaine" aside={bars[peak] && !loading ? axis(bars[peak].value) : undefined}>
        {loading ? <div className="h-[200px]" /> : (
          <BarChart
            data={bars}
            height={200}
            signed={bars.some((b) => b.value < 0)}
            selected={sel}
            onSelect={setSel}
            xLabels={Object.fromEntries(bars.map((b, i) => [i, i === 0 || i === bars.length - 1 || i === Math.floor(bars.length / 2) ? b.label : '']).filter(([, l]) => l))}
            ariaLabel="Bénéfice par semaine"
          />
        )}
      </ChartCard>
      <KVBox
        rows={[
          { label: 'Taux client', value: `${fmtNum(clientRate, 2)} XAF/CNY` },
          { label: 'Taux de revient', value: `${fmtNum(revient, 2)} XAF/CNY` },
          { label: 'CNY livrés', value: `¥ ${fmtNum(d.client_rate.total_cny, 0)}` },
        ]}
      />
    </Page>
  );
}

/* 2 · Stock USDT ────────────────────────────────────────────────────────── */
function StockPage({ d, period }: { d: TreasuryDashboard; period: PeriodState }) {
  const [sel, setSel] = useState<number | null>(null);
  const wac = useWacEvolution(period.fromIso, period.toIso);
  const delta = Number(d.purchases.total_usdt) - Number(d.sales.total_usdt);
  const days = useMemo(() => daysOf(period.range), [period.range]);
  const series = useMemo(() => {
    const lastOfDay = new Map<string, number>();
    for (const p of wac.data ?? []) lastOfDay.set(bizDay(p.at), p.stock);
    let cur = Number(d.stock_usdt) - delta;
    return days.map((k) => {
      if (lastOfDay.has(k)) cur = lastOfDay.get(k)!;
      return cur;
    });
  }, [wac.data, days, d.stock_usdt, delta]);
  const minIdx = series.length ? series.indexOf(Math.min(...series)) : -1;
  return (
    <Page>
      <BigFigure
        label="Stock USDT · aujourd’hui"
        size="md"
        value={fmtNum(d.stock_usdt, 2)}
        unit="USDT"
        delta={{ tone: delta >= 0 ? 'success' : 'danger', label: withSign(delta, 0) }}
        note={<span>sur la période</span>}
      />
      <ChartCard title="Stock en fin de journée">
        {wac.isLoading ? <div className="h-[200px]" /> : series.length < 2 ? (
          <p className={cn('py-8 text-center text-[16px]', TEXT.muted)}>Pas assez de jours.</p>
        ) : (
          <LineChart
            series={[{ values: series, label: 'Stock' }]}
            height={190}
            yTicks={ticksFor(series)}
            formatY={axis}
            minLabel={minIdx >= 0 ? fmtNum(series[minIdx], 0) : undefined}
            selected={sel}
            onSelect={setSel}
            xLabels={edgeLabels(series.length, days.map(shortDay))}
            ariaLabel="Stock USDT en fin de journée"
          />
        )}
      </ChartCard>
      <KVBox
        rows={[
          { label: 'Capital immobilisé', value: `${fmtNum(d.capital_immobilized_current_xaf, 0)} XAF` },
          ...(minIdx >= 0 ? [{ label: `Plus bas · ${shortDay(days[minIdx])}`, value: `${fmtNum(series[minIdx], 2)} USDT` }] : []),
        ]}
      />
    </Page>
  );
}

/* 3 · Coût moyen ────────────────────────────────────────────────────────── */
function CostPage({ d, period }: { d: TreasuryDashboard; period: PeriodState }) {
  const [sel, setSel] = useState<number | null>(null);
  const [view, setView] = useState<'buy' | 'sell'>('buy');
  const wac = useWacEvolution(period.fromIso, period.toIso);
  const flow = useUsdtFlowEvolution(period.fromIso, period.toIso);
  const days = useMemo(() => daysOf(period.range), [period.range]);
  const { wacDaily, buyDaily, sellDaily } = useMemo(() => {
    const w = new Map<string, number>();
    for (const p of wac.data ?? []) if (p.wac > 0) w.set(bizDay(p.at), p.wac);
    const avg = (pts: Array<{ at: string; rate: number; usdt: number }>) => {
      const m = new Map<string, { x: number; u: number }>();
      for (const p of pts) {
        const k = bizDay(p.at);
        const c = m.get(k) ?? { x: 0, u: 0 };
        m.set(k, { x: c.x + p.rate * p.usdt, u: c.u + p.usdt });
      }
      return m;
    };
    const fill = (get: (k: string) => number | undefined, first: number) => {
      let cur = first;
      return days.map((k) => {
        const v = get(k);
        if (v !== undefined && Number.isFinite(v)) cur = v;
        return cur;
      });
    };
    const firstWac = (wac.data ?? []).find((p) => p.wac > 0)?.wac ?? d.wac_usdt_current;
    const b = avg(flow.data?.purchases ?? []);
    const s = avg(flow.data?.sales ?? []);
    const firstBuy = (flow.data?.purchases ?? [])[0]?.rate ?? d.purchases.weighted_avg_rate_xaf_per_usdt;
    const firstSell = (flow.data?.sales ?? [])[0]?.rate ?? d.sales.weighted_avg_rate_cny_per_usdt;
    return {
      wacDaily: fill((k) => w.get(k), firstWac),
      buyDaily: fill((k) => { const c = b.get(k); return c && c.u > 0 ? c.x / c.u : undefined; }, firstBuy),
      sellDaily: fill((k) => { const c = s.get(k); return c && c.u > 0 ? c.x / c.u : undefined; }, firstSell),
    };
  }, [wac.data, flow.data, days, d]);
  const deltaWac = wacDaily.length ? d.wac_usdt_current - wacDaily[0] : 0;
  const loading = wac.isLoading || flow.isLoading;
  const series = view === 'buy'
    ? [{ values: wacDaily, label: 'Coût', tone: 'ink' as const }, { values: buyDaily, label: 'Achat', tone: 'grey' as const }]
    : [{ values: sellDaily, label: 'Vente', tone: 'ink' as const }];
  return (
    <Page>
      <BigFigure
        label="Coût moyen · aujourd’hui"
        size="md"
        value={fmtNum(d.wac_usdt_current, 2)}
        unit="XAF/USDT"
        delta={{ tone: 'neutral', label: withSign(deltaWac, 2) }}
        note={<span>sur la période</span>}
      />
      <BoxSegmented
        ariaLabel="Courbe"
        value={view}
        onChange={(v) => { setView(v); setSel(null); }}
        options={[
          { value: 'buy', label: 'Coût et achat' },
          { value: 'sell', label: 'Taux de vente' },
        ]}
      />
      <ChartCard>
        {loading ? <div className="h-[200px]" /> : days.length < 2 ? (
          <p className={cn('py-8 text-center text-[16px]', TEXT.muted)}>Pas assez de jours.</p>
        ) : (
          <>
            <LineChart
              series={series}
              height={190}
              yTicks={ticksFor(series.flatMap((s) => s.values))}
              formatY={(v) => fmtNum(v, view === 'buy' ? 0 : 2)}
              selected={sel}
              onSelect={setSel}
              xLabels={edgeLabels(days.length, days.map(shortDay))}
              ariaLabel={view === 'buy' ? 'Coût moyen et taux d’achat du jour' : 'Taux de vente du jour'}
            />
            <ChartLegend items={view === 'buy' ? [{ label: 'Coût moyen' }, { label: 'Taux d’achat du jour', tone: 'grey' }] : [{ label: 'Taux de vente du jour' }]} />
          </>
        )}
      </ChartCard>
      <KVBox
        rows={[
          { label: 'Taux d’achat moyen', value: `${fmtNum(d.purchases.weighted_avg_rate_xaf_per_usdt, 2)} XAF/USDT` },
          { label: 'Taux de vente moyen', value: `${fmtNum(d.sales.weighted_avg_rate_cny_per_usdt, 4)} CNY/USDT` },
        ]}
      />
    </Page>
  );
}

/* 4 · Volumes ───────────────────────────────────────────────────────────── */
function VolumePage({ d, period }: { d: TreasuryDashboard; period: PeriodState }) {
  const ops = useTreasuryOperations(period.fromIso, period.toIso);
  const weeks = useMemo(() => weeksOf(period.range, 6), [period.range]);
  const groups = useMemo(() => {
    const out = weeks.map((w) => ({ label: w.label, a: 0, b: 0 }));
    for (const op of ops.data ?? []) {
      const v = viewOperation(op);
      if (v.voided) continue;
      const i = weeks.findIndex((w) => v.at >= w.fromIso && v.at <= w.toIso);
      if (i < 0) continue;
      if (v.kind === 'purchase') out[i].a += v.usdt;
      else out[i].b += v.usdt;
    }
    return out;
  }, [ops.data, weeks]);
  const ticks = ticksFor([0, ...groups.flatMap((g) => [g.a, g.b])]);
  return (
    <Page>
      <BigFigure
        label={`Achetés · ${periodNoun(period)}`}
        size="md"
        value={fmtUsdt(d.purchases.total_usdt)}
        unit="USDT"
        note={<span>Vendus <b className="font-bold">{fmtUsdt(d.sales.total_usdt)}</b> USDT</span>}
      />
      <ChartCard>
        {ops.isLoading ? <div className="h-[200px]" /> : (
          <>
            <GroupedBarChart groups={groups} height={190} ticks={ticks} formatTick={axis} format={(v) => `${fmtUsdt(v)} USDT`} ariaLabel="Achats et ventes par semaine" />
            <SquareLegend items={[{ label: 'Achats', tone: 'ink' }, { label: 'Ventes', tone: 'grey' }]} />
          </>
        )}
      </ChartCard>
      <KVBox
        rows={[
          { label: `Achats · ${d.purchases.count}`, value: `${fmtNum(d.purchases.total_xaf, 0)} XAF` },
          { label: `Ventes · ${d.sales.count}`, value: `¥ ${fmtNum(d.sales.total_cny, 0)}` },
        ]}
      />
    </Page>
  );
}

/* 5 · Par fournisseur / acheteur ────────────────────────────────────────── */
function RankPage({ period, onOpen }: { period: PeriodState; onOpen: (id: string) => void }) {
  const [type, setType] = useState<'usdt_supplier' | 'cny_buyer'>('usdt_supplier');
  const top = useTopCounterparties(type, period.fromIso, period.toIso, 10);
  const rows = top.data?.top ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total_usdt), 0);
  const buying = type === 'usdt_supplier';
  const first = rows[0];
  const tone = (dev: number): Tone => {
    // Un achat moins cher que la moyenne est bon ; une vente plus chère aussi.
    const good = buying ? dev < 0 : dev > 0;
    if (Math.abs(dev) < 0.005) return 'neutral';
    return good ? 'success' : Math.abs(dev) >= 0.1 ? 'danger' : 'neutral';
  };
  return (
    <Page>
      <BigFigure
        label={first ? `${first.display_name} · part des ${buying ? 'achats' : 'ventes'}` : buying ? 'Part des achats' : 'Part des ventes'}
        size="md"
        value={first && total > 0 ? `${fmtNum((Number(first.total_usdt) / total) * 100, 0)} %` : '—'}
      />
      <BoxSegmented
        ariaLabel="Contreparties"
        value={type}
        onChange={setType}
        options={[
          { value: 'usdt_supplier', label: 'Fournisseurs' },
          { value: 'cny_buyer', label: 'Acheteurs' },
        ]}
      />
      {top.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void top.refetch() }}>Le classement n’a pas pu être chargé.</EmptyLine>
      ) : !top.isLoading && rows.length === 0 ? (
        <EmptyLine>{buying ? 'Aucun achat sur la période.' : 'Aucune vente sur la période.'}</EmptyLine>
      ) : (
        <div>
          {rows.map((r) => (
            <ShareRow
              key={r.id}
              title={r.display_name}
              subtitle={
                <span className="mt-0.5 inline-flex flex-wrap items-center gap-2">
                  {fmtNum(r.weighted_avg_rate, buying ? 2 : 4)} {buying ? 'XAF/USDT' : 'CNY/USDT'}
                  <Tag tone={tone(Number(r.deviation_pct))}>{withSign(Number(r.deviation_pct), 2)} %</Tag>
                </span>
              }
              value={`${fmtUsdt(Number(r.total_usdt))} USDT`}
              share={total > 0 ? Number(r.total_usdt) / total : 0}
              onClick={() => onOpen(r.id)}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
