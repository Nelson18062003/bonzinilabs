// ============================================================
// Tableau de bord des ventes — plusieurs indicateurs de MÊME unité, côte à
// côte, période par période (barres groupées) : « Nouveaux clients » et
// « Prospects devenus clients », par exemple.
//
// Ce qu'EvolutionChart ne fait pas : lui empile les COMMERCIAUX pour un
// indicateur ; ici, ce sont des indicateurs d'une même série (series.team,
// l'équipe ou la fiche seule) qu'on compare. Côte à côte et non empilés :
// ils peuvent se recouvrir (un prospect devenu client est aussi un nouveau
// client), une pile les compterait deux fois.
//
// Une seule unité, donc un seul axe (jamais deux échelles sur un tracé).
// Couleurs dans l'ordre validé (teinte 1, puis 2…), légende toujours là
// (deux séries ou plus), 2 px de vide entre deux barres voisines, bout
// arrondi en haut ; la période en cours estompée ; info-bulle et vue
// tableau.
// ============================================================
import { useMemo, useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import type { SalesSeries } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { SALES_METRICS, formatAxis, formatValue, isCurrentPeriod, niceTicks, num, periodLabel, pointAt, seriesColor, type SalesMetricKey, type SalesUnit } from '@/lib/salesSeries';
import { EmptyState, SeriesSwatch, useElementWidth } from './primitives';
import { AXIS_BAND, AXIS_FONT, TooltipShell, periodTick, periodTicks, prefersReducedMotion, yAxisWidth } from './chartBits';

export interface MetricBarsProps {
  /** La réponse de sales_series (ou pickSource(…)) : on dessine `series.team`. */
  series: Pick<SalesSeries, 'grain' | 'periods' | 'team'>;
  /** Deux ou trois indicateurs de la même unité, dans l'ordre des teintes. */
  metrics: SalesMetricKey[];
  /** Libellés propres (« Venus de vos prospects »), par indicateur. */
  labels?: Partial<Record<SalesMetricKey, string>>;
  /** Hauteur du tracé ET de l'axe des périodes (défaut 200). */
  height?: number;
  /** Largeur fixe (tests, captures) ; sinon toute la largeur. */
  width?: number;
  now?: Date;
  /** Le bouton « Tableau » (défaut : oui). */
  tableToggle?: boolean;
  emptyState?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

interface Row {
  period: string;
  long: string;
  current: boolean;
  [key: string]: number | string | boolean;
}

interface Meta {
  key: SalesMetricKey;
  label: string;
  color: string;
  total: number;
}

export function MetricBars({ series, metrics, labels, height = 200, width: fixedWidth, now, tableToggle = true, emptyState, ariaLabel, className }: MetricBarsProps) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const [asTable, setAsTable] = useState(false);
  const width = fixedWidth ?? measured;
  const unit = SALES_METRICS[metrics[0]].unit;

  const metas: Meta[] = useMemo(
    () =>
      metrics.map((key, i) => ({
        key,
        label: labels?.[key] ?? SALES_METRICS[key].label,
        color: seriesColor(i + 1),
        total: series.periods.reduce((s, p) => s + num(pointAt(series.team?.points, p)[key]), 0),
      })),
    [metrics, labels, series],
  );
  const rows: Row[] = useMemo(
    () =>
      series.periods.map((period) => {
        const p = pointAt(series.team?.points, period);
        const row: Row = { period, long: periodLabel(period, series.grain, 'long'), current: isCurrentPeriod(period, series.grain, now) };
        for (const m of metrics) row[m] = num(p[m]);
        return row;
      }),
    [series, metrics, now],
  );
  const empty = rows.every((r) => metrics.every((m) => r[m] === 0));
  const last = rows[rows.length - 1];

  return (
    <figure className={cn('sd m-0 min-w-0', className)} aria-label={ariaLabel ?? metas.map((m) => m.label).join(' et ')}>
      {!empty && (
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
          <ul role="list" className="contents" aria-label="Séries affichées">
            {metas.map((m) => (
              <li key={m.key} className="inline-flex h-9 min-w-0 max-w-full items-center gap-2 px-2 text-[14px]">
                <SeriesSwatch color={m.color} />
                <span className="truncate font-medium text-foreground">{m.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(unit, m.total, 'compact')}</span>
              </li>
            ))}
          </ul>
          {tableToggle && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              className="sd-press ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
            >
              {asTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
              {asTable ? 'Graphique' : 'Tableau'}
            </button>
          )}
        </div>
      )}

      {empty ? (
        (emptyState ?? <EmptyState height={height} />)
      ) : asTable ? (
        <BarsTable rows={rows} metas={metas} unit={unit} grain={series.grain} />
      ) : (
        <div ref={ref} className="relative min-w-0" style={{ height }}>
          {width > 0 && <Plot rows={rows} metas={metas} unit={unit} width={width} height={height} periods={series.periods} grain={series.grain} />}
        </div>
      )}

      {!empty && !asTable && last?.current && metrics.some((m) => last[m] !== 0) && (
        <figcaption className="mt-2 text-[13px] leading-snug text-muted-foreground">
          {series.grain === 'month' ? `${periodLabel(last.period, 'month', 'long')} n’est pas fini` : 'La semaine en cours n’est pas finie'} : ses barres sont estompées.
        </figcaption>
      )}
    </figure>
  );
}

function Plot({
  rows,
  metas,
  unit,
  width,
  height,
  periods,
  grain,
}: {
  rows: Row[];
  metas: Meta[];
  unit: SalesUnit;
  width: number;
  height: number;
  periods: string[];
  grain: SalesSeries['grain'];
}) {
  const max = Math.max(0, ...rows.flatMap((r) => metas.map((m) => Number(r[m.key]) || 0)));
  const yTicks = niceTicks(max, unit, 3);
  const yWidth = yAxisWidth(unit, yTicks[yTicks.length - 1]);
  const tick = periodTick(periods, grain, periodTicks(periods, grain, Math.max(0, width - yWidth - 12)));
  // Une seule entrée animée : un redimensionnement ne refait pas pousser les barres.
  const [entered, setEntered] = useState(false);
  const animate = !prefersReducedMotion() && !entered;
  // Des barres fines (≤ 16 px), la place qui reste est de l'air.
  const band = (width - yWidth - 8) / Math.max(1, rows.length);
  const barSize = Math.max(4, Math.min(16, Math.floor((band * 0.62 - 2 * (metas.length - 1)) / metas.length)));

  return (
    <ComposedChart width={width} height={height} data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
      <CartesianGrid vertical={false} stroke="var(--sd-grid)" strokeWidth={1} />
      <XAxis dataKey="period" interval={0} tick={tick} tickLine={false} axisLine={{ stroke: 'var(--sd-baseline)' }} height={AXIS_BAND} />
      <YAxis
        width={yWidth}
        ticks={yTicks}
        interval={0}
        tickFormatter={(v: number) => formatAxis(unit, v)}
        tick={{ fontSize: AXIS_FONT, fill: 'var(--sd-ink-2)' }}
        tickLine={false}
        axisLine={false}
        allowDecimals={unit !== 'count'}
        domain={[0, yTicks[yTicks.length - 1]]}
      />
      <Tooltip
        isAnimationActive={false}
        cursor={{ fill: 'var(--sd-cursor)' }}
        content={<BarsTooltip metas={metas} unit={unit} />}
        wrapperStyle={{ outline: 'none' }}
        offset={14}
      />
      {metas.map((m) => (
        <Bar
          key={m.key}
          dataKey={m.key}
          name={m.label}
          fill={m.color}
          barSize={barSize}
          isAnimationActive={animate}
          animationDuration={450}
          onAnimationEnd={() => setEntered(true)}
          shape={(props: unknown) => <RoundedBar {...(props as BarProps)} />}
        />
      ))}
    </ComposedChart>
  );
}

interface BarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Row;
}

/** Une barre : bout arrondi de 4 px, pied carré sur la ligne de base ; estompée si la période est en cours. */
function RoundedBar({ x = 0, y = 0, width = 0, height = 0, fill, payload }: BarProps) {
  if (!(height > 0) || !(width > 0)) return null;
  const r = Math.min(4, height, width / 2);
  const d = `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
  return <path d={d} fill={fill} fillOpacity={payload?.current ? 0.45 : 1} />;
}

function BarsTooltip({ active, payload, metas, unit }: { active?: boolean; payload?: { payload?: Row }[]; metas: Meta[]; unit: SalesUnit }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <TooltipShell title={row.long} current={row.current}>
      <ul className="mt-2 space-y-1.5">
        {metas.map((m) => (
          <li key={m.key} className="flex items-center gap-2.5 text-[14px]">
            <SeriesSwatch color={m.color} shape="line" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatValue(unit, Number(row[m.key]) || 0)}</span>
          </li>
        ))}
      </ul>
    </TooltipShell>
  );
}

function BarsTable({ rows, metas, unit, grain }: { rows: Row[]; metas: Meta[]; unit: SalesUnit; grain: SalesSeries['grain'] }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-max border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[13px] text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-4 py-2 font-medium sm:pl-0">
              {grain === 'month' ? 'Mois' : 'Semaine'}
            </th>
            {metas.map((m) => (
              <th key={m.key} scope="col" className="px-4 py-2 text-right font-medium sm:last:pr-0">
                <span className="inline-flex items-center gap-1.5">
                  <SeriesSwatch color={m.color} shape="dot" />
                  {m.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...rows].reverse().map((r) => (
            <tr key={r.period} className="border-t border-border/60">
              <th scope="row" className="sticky left-0 bg-card px-4 py-2 text-left font-medium sm:pl-0">
                {periodLabel(r.period, grain, 'short')}
                {r.current && <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">en cours</span>}
              </th>
              {metas.map((m) => (
                <td key={m.key} className="px-4 py-2 text-right font-semibold sm:last:pr-0">
                  {formatValue(unit, Number(r[m.key]) || 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
