// ============================================================
// Tableau de bord des ventes — le fret avion : les kilos en barres, les
// vols en courbe, et (au choix) le bateau en m³.
//
// Pas de double axe : deux mesures d'échelles différentes sur un même tracé
// inventent une corrélation (l'alignement des deux axes est arbitraire).
// D'où des panneaux EMPILÉS qui partagent l'axe des périodes : mêmes
// marges, même largeur d'axe, survol synchronisé — une colonne de périodes
// se lit d'un coup, de haut en bas, avec ses vraies valeurs.
// Dessine `series.team` (l'équipe, ou la fiche seule après pickSource).
// ============================================================
import { useId, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesPoint, SalesSeries } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { formatAxis, formatValue, isCurrentPeriod, niceTicks, num, periodLabel, plural, seriesColor, type SalesUnit } from '@/lib/salesSeries';
import { EmptyState, useElementWidth } from './primitives';
import { AXIS_BAND, AXIS_FONT, TooltipShell, periodTick, periodTicks, prefersReducedMotion, yAxisWidth } from './chartBits';

export interface CargoChartProps {
  series: SalesSeries;
  /** Ajoute le panneau du fret bateau (m³). */
  showSea?: boolean;
  /** Largeur fixe (tests, captures) ; sinon toute la largeur. */
  width?: number;
  now?: Date;
  /** Les chiffres de tête (kilos, colis, vols, kg par vol) ; défaut : oui. */
  showStats?: boolean;
  className?: string;
}

interface CargoRow extends SalesPoint {
  current: boolean;
}

const KG = seriesColor(1);

export function CargoChart({ series, showSea = false, width: fixedWidth, now, showStats = true, className }: CargoChartProps) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const width = fixedWidth ?? measured;
  const syncId = useId();
  const rows: CargoRow[] = useMemo(
    () =>
      series.periods.map((period) => {
        const p = series.team.points.find((x) => x.period === period);
        return {
          period,
          clients_total: num(p?.clients_total),
          new_clients: num(p?.new_clients),
          active_clients: num(p?.active_clients),
          prospects_new: num(p?.prospects_new),
          prospects_won: num(p?.prospects_won),
          prospects_lost: num(p?.prospects_lost),
          payments_xaf: num(p?.payments_xaf),
          payments_count: num(p?.payments_count),
          deposits_xaf: num(p?.deposits_xaf),
          deposits_count: num(p?.deposits_count),
          air_parcels: num(p?.air_parcels),
          air_kg: num(p?.air_kg),
          flights: num(p?.flights),
          sea_parcels: num(p?.sea_parcels),
          sea_cbm: num(p?.sea_cbm),
          current: isCurrentPeriod(period, series.grain, now),
        };
      }),
    [series, now],
  );
  const t = series.team.totals;
  const kg = num(t.air_kg);
  const flights = num(t.flights);
  const empty = kg === 0 && flights === 0 && (!showSea || num(t.sea_cbm) === 0);

  // Des graduations rondes par panneau ; une seule largeur d'axe pour tous : les barres et les points s'alignent.
  const scale = {
    air_kg: niceTicks(Math.max(0, ...rows.map((r) => r.air_kg)), 'kg', 3),
    flights: niceTicks(Math.max(0, ...rows.map((r) => r.flights)), 'count', 2),
    sea_cbm: niceTicks(Math.max(0, ...rows.map((r) => r.sea_cbm)), 'cbm', 2),
  };
  const top = (k: keyof typeof scale) => scale[k][scale[k].length - 1];
  const yWidth = Math.max(yAxisWidth('kg', top('air_kg')), yAxisWidth('count', top('flights')), showSea ? yAxisWidth('cbm', top('sea_cbm')) : 0);
  const plotWidth = Math.max(0, width - yWidth - 12);
  const ticks = periodTicks(series.periods, series.grain, plotWidth);
  const tick = periodTick(series.periods, series.grain, ticks);
  // Une seule entrée animée (un redimensionnement ne refait pas pousser les barres).
  const [entered, setEntered] = useState(false);
  const animate = !prefersReducedMotion() && !entered;
  const done = () => setEntered(true);

  const panels: { key: 'air_kg' | 'flights' | 'sea_cbm'; title: string; unit: SalesUnit; height: number; type: 'bar' | 'line' }[] = [
    { key: 'air_kg', title: 'Kilos envoyés par avion', unit: 'kg', height: 150, type: 'bar' },
    { key: 'flights', title: 'Vols', unit: 'count', height: 84, type: 'line' },
    ...(showSea ? [{ key: 'sea_cbm' as const, title: 'Fret bateau (m³)', unit: 'cbm' as const, height: 84, type: 'bar' as const }] : []),
  ];
  const lastPanel = panels[panels.length - 1].key;

  return (
    <figure className={cn('sd m-0 min-w-0', className)} aria-label="Fret avion : kilos et vols par période">
      {showStats && (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label="Fret avion" value={formatValue('kg', kg)} strong />
          <Stat label="Colis avion" value={formatValue('count', num(t.air_parcels))} />
          <Stat label="Vols" value={formatValue('count', flights)} />
          <Stat label="Par vol" value={flights > 0 ? formatValue('kg', kg / flights) : '—'} />
          {showSea && <Stat label="Fret bateau" value={formatValue('cbm', num(t.sea_cbm))} />}
          {showSea && <Stat label="Colis bateau" value={formatValue('count', num(t.sea_parcels))} />}
        </dl>
      )}
      {empty ? (
        <EmptyState title="Aucun colis avion sur cette période" height={220}>
          Les kilos et les vols apparaîtront dès le premier colis enregistré à Guangzhou.
        </EmptyState>
      ) : (
        <div ref={ref} className="min-w-0 space-y-2">
          {width > 0 &&
            panels.map((panel) => {
              const isLast = panel.key === lastPanel;
              const color = panel.key === 'flights' ? 'var(--sd-ink)' : KG;
              return (
                <div key={panel.key}>
                  <p className="mb-1 flex items-baseline justify-between gap-2 text-[13px] font-medium text-muted-foreground">
                    <span>{panel.title}</span>
                  </p>
                  <ComposedChart
                    width={width}
                    height={panel.height + (isLast ? AXIS_BAND : 0)}
                    data={rows}
                    syncId={syncId}
                    margin={{ top: 8, right: 4, bottom: isLast ? 0 : 8, left: 0 }}
                    barCategoryGap="26%"
                  >
                    <CartesianGrid vertical={false} stroke="var(--sd-grid)" />
                    <XAxis
                      dataKey="period"
                      scale="band"
                      interval={0}
                      tick={isLast ? tick : false}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--sd-baseline)' }}
                      height={isLast ? AXIS_BAND : 1}
                    />
                    <YAxis
                      width={yWidth}
                      ticks={scale[panel.key]}
                      interval={0}
                      tickFormatter={(v: number) => formatAxis(panel.unit, v)}
                      tick={{ fontSize: AXIS_FONT, fill: 'var(--sd-ink-2)' }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, top(panel.key)]}
                    />
                    <Tooltip
                      isAnimationActive={false}
                      cursor={panel.type === 'bar' ? { fill: 'var(--sd-cursor)' } : { stroke: 'var(--sd-baseline)', strokeWidth: 1 }}
                      content={panel.key === 'air_kg' ? <CargoTooltip showSea={showSea} grain={series.grain} /> : <NoTooltip />}
                      wrapperStyle={{ outline: 'none' }}
                      offset={14}
                    />
                    {panel.type === 'bar' ? (
                      <Bar
                        dataKey={panel.key}
                        fill={color}
                        maxBarSize={24}
                        isAnimationActive={animate}
                        animationDuration={450}
                        onAnimationEnd={done}
                        shape={(props: unknown) => <RoundedBar {...(props as BarProps)} />}
                      />
                    ) : (
                      <Line
                        type="linear"
                        dataKey={panel.key}
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        dot={(props: unknown) => <FlightDot {...(props as DotProps)} rows={rows} key={`f-${(props as DotProps).index}`} />}
                        activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--sd-surface)', fill: 'var(--sd-ink)' }}
                        isAnimationActive={animate}
                        animationDuration={450}
                        onAnimationEnd={done}
                      />
                    )}
                  </ComposedChart>
                </div>
              );
            })}
        </div>
      )}
    </figure>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate tabular-nums text-foreground', strong ? 'text-[20px] font-semibold tracking-[-0.01em]' : 'text-[16px] font-semibold')}>{value}</dd>
    </div>
  );
}

interface BarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: CargoRow;
}

/** Une barre : bout arrondi de 4 px, pied carré ; estompée si la période est en cours. */
function RoundedBar({ x = 0, y = 0, width = 0, height = 0, fill, payload }: BarProps) {
  if (!(height > 0) || !(width > 0)) return null;
  const r = Math.min(4, height, width / 2);
  const d = `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
  return <path d={d} fill={fill} fillOpacity={payload?.current ? 0.45 : 1} />;
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

/** Un point par période (≥ 8 px, anneau du fond) ; creux pour la période en cours. */
function FlightDot({ cx, cy, index = 0, rows }: DotProps & { rows: CargoRow[] }) {
  if (cx == null || cy == null) return <g />;
  const current = !!rows[index]?.current;
  return <circle cx={cx} cy={cy} r={4} fill={current ? 'var(--sd-surface)' : 'var(--sd-ink)'} stroke={current ? 'var(--sd-ink)' : 'var(--sd-surface)'} strokeWidth={current ? 1.75 : 2} />;
}

function NoTooltip() {
  return null;
}

function CargoTooltip({ active, payload, showSea, grain }: { active?: boolean; payload?: { payload?: CargoRow }[]; showSea: boolean; grain: SalesSeries['grain'] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const items: [string, string][] = [
    ['Kilos', formatValue('kg', row.air_kg)],
    ['Colis avion', formatValue('count', row.air_parcels)],
    ['Vols', formatValue('count', row.flights)],
  ];
  if (row.flights > 0) items.push(['Par vol', formatValue('kg', row.air_kg / row.flights)]);
  if (showSea) items.push(['Bateau', `${formatValue('cbm', row.sea_cbm)} · ${plural(row.sea_parcels, 'colis', 'colis')}`]);
  return (
    <TooltipShell title={periodLabel(row.period, grain, 'long')} current={row.current}>
      <dl className="mt-2 space-y-1.5 text-[14px]">
        {items.map(([k, v], i) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={cn('tabular-nums', i === 0 ? 'font-semibold' : 'font-medium')}>{v}</dd>
          </div>
        ))}
      </dl>
    </TooltipShell>
  );
}
