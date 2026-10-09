// ============================================================
// Tableau de bord des ventes — le graphique d'évolution d'un indicateur.
//
//   · un flux (paiements, dépôts, kilos, prospects…) en BARRES ; un stock
//     (les clients) en COURBE — SALES_METRICS[metric].chart, ou `kind` ;
//   · `mode="stacked"` : une couleur par commercial, empilées (barres) ou
//     côte à côte (courbes) ; `mode="total"` : l'équipe, ou la fiche seule ;
//   · la couleur suit la fiche (sourceSlots), jamais son rang ; la légende
//     masque ou remet une série sans repeindre les autres ;
//   · la période en cours n'est pas finie : sa barre est estompée, son point
//     creux, et une ligne sous le graphique le dit ;
//   · info-bulle en français : la période, la valeur de chaque commercial,
//     le total ; une vue tableau pour qui préfère les chiffres.
// Un seul axe, des graduations courtes (« 40 M »), une grille en filets pleins.
// ============================================================
import { useMemo, useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, ComposedChart, Area, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import type { SalesSeries } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import {
  SALES_METRICS,
  formatAxis,
  formatValue,
  niceTicks,
  periodLabel,
  seriesColor,
  toChartRows,
  type EvolutionRow,
  type SalesMetricKey,
  type SalesUnit,
  type SeriesMeta,
} from '@/lib/salesSeries';
import { EmptyState, SeriesSwatch, useElementWidth } from './primitives';
import { AXIS_BAND, AXIS_FONT, TooltipShell, periodTick, periodTicks, prefersReducedMotion, yAxisWidth } from './chartBits';

export interface EvolutionChartProps {
  /** La réponse de sales_series (toutes les fiches, ou une seule). */
  series: SalesSeries;
  metric: SalesMetricKey;
  /** `stacked` : par commercial (défaut s'il y a plusieurs fiches) ; `total` : l'équipe ou la fiche seule. */
  mode?: 'stacked' | 'total';
  /** Barres ou courbe ; défaut : selon l'indicateur (courbe pour les clients). */
  kind?: 'bar' | 'line';
  /** Hauteur du tracé ET de l'axe des périodes, en px (défaut 260). */
  height?: number;
  /** Largeur fixe (tests, captures) ; sinon toute la largeur disponible. */
  width?: number;
  /** « Aujourd'hui » (captures, tests) ; défaut : maintenant. */
  now?: Date;
  /** La légende (défaut : dès qu'il y a plusieurs séries). */
  showLegend?: boolean;
  /** Le bouton « Tableau » (défaut : oui). */
  tableToggle?: boolean;
  /** Un titre pour les lecteurs d'écran (défaut : « Évolution : <indicateur> »). */
  ariaLabel?: string;
  /** Ce qui s'affiche quand tout est à zéro (défaut : « Pas encore d'activité sur cette période »). */
  emptyState?: ReactNode;
  className?: string;
}

const SINGLE_KEY = 'team';
const SINGLE_COLOR = seriesColor(1);

export function EvolutionChart({
  series,
  metric,
  mode,
  kind,
  height = 260,
  width: fixedWidth,
  now,
  showLegend,
  tableToggle = true,
  ariaLabel,
  emptyState,
  className,
}: EvolutionChartProps) {
  const def = SALES_METRICS[metric];
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [asTable, setAsTable] = useState(false);
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const width = fixedWidth ?? measured;

  const { rows, series: metas } = useMemo(() => toChartRows(series, metric, { hidden, now }), [series, metric, hidden, now]);
  const stacked = (mode ?? (metas.length > 1 ? 'stacked' : 'total')) === 'stacked' && metas.length > 1;
  const chartKind = kind ?? def.chart;
  const visible = stacked ? metas.filter((m) => !hidden.has(m.key)) : [];
  const legend = (showLegend ?? stacked) && stacked;
  const empty = rows.every((r) => r.team === 0 && r.total === 0);
  const last = rows[rows.length - 1];

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (metas.length - next.size > 1) next.add(key);
      return next;
    });

  const label = ariaLabel ?? `Évolution : ${def.label.toLowerCase()}`;

  return (
    <figure className={cn('sd m-0 min-w-0', className)} aria-label={label}>
      {(legend || tableToggle) && !empty && (
        <div className="mb-3 flex min-w-0 flex-wrap items-start gap-x-1 gap-y-1">
          {legend && (
            <ul role="list" className="contents" aria-label="Commerciaux affichés">
              {metas.map((m) => (
                <li key={m.key} className="min-w-0 max-w-full">
                  <LegendItem meta={m} unit={def.unit} off={hidden.has(m.key)} shape={chartKind === 'line' ? 'line' : 'rect'} onToggle={() => toggle(m.key)} />
                </li>
              ))}
            </ul>
          )}
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
        emptyState ?? <EmptyState height={height} />
      ) : asTable ? (
        <EvolutionTable rows={rows} metas={stacked ? visible : []} unit={def.unit} grain={series.grain} />
      ) : (
        <div ref={ref} className="relative min-w-0" style={{ height }}>
          {width > 0 && (
            <Plot
              key={`${metric}|${stacked ? 'stacked' : 'total'}|${chartKind}`}
              rows={rows}
              metas={visible}
              stacked={stacked}
              kind={chartKind}
              unit={def.unit}
              width={width}
              height={height}
              periods={series.periods}
              grain={series.grain}
            />
          )}
        </div>
      )}

      {!empty && !asTable && last?.current && (last.team !== 0 || last.total !== 0) && (
        <figcaption className="mt-2 text-[13px] leading-snug text-muted-foreground">
          {series.grain === 'month' ? `${periodLabel(last.period, 'month', 'long')} n’est pas fini` : 'La semaine en cours n’est pas finie'}
          {chartKind === 'bar' ? ' : sa barre est estompée.' : ' : son point est creux.'}
        </figcaption>
      )}
    </figure>
  );
}

/* ── La légende : un bouton par fiche ──────────────────────────────────── */

function LegendItem({ meta, unit, off, shape, onToggle }: { meta: SeriesMeta; unit: SalesUnit; off: boolean; shape: 'rect' | 'line'; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!off}
      title={off ? `Afficher ${meta.label}` : `Masquer ${meta.label}`}
      className={cn('sd-press inline-flex h-9 max-w-full items-center gap-2 rounded-lg px-2 text-left text-[14px]', off && 'opacity-55')}
    >
      <SeriesSwatch color={meta.color} shape={shape} muted={off} />
      <span className={cn('truncate font-medium text-foreground', off && 'line-through decoration-1')}>{meta.label}</span>
      {meta.archived && <span className="shrink-0 text-[13px] text-muted-foreground">archivée</span>}
      <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(unit, meta.total, 'compact')}</span>
    </button>
  );
}

/* ── Le tracé ──────────────────────────────────────────────────────────── */

function Plot({
  rows,
  metas,
  stacked,
  kind,
  unit,
  width,
  height,
  periods,
  grain,
}: {
  rows: EvolutionRow[];
  metas: SeriesMeta[];
  stacked: boolean;
  kind: 'bar' | 'line';
  unit: SalesUnit;
  width: number;
  height: number;
  periods: string[];
  grain: SalesSeries['grain'];
}) {
  const keys = stacked ? metas.map((m) => m.key) : [SINGLE_KEY];
  const max = Math.max(0, ...rows.map((r) => (stacked ? (kind === 'bar' ? r.total : Math.max(0, ...keys.map((k) => Number(r[k]) || 0))) : r.team)));
  const yTicks = niceTicks(max, unit);
  const yWidth = yAxisWidth(unit, yTicks[yTicks.length - 1]);
  const tick = periodTick(periods, grain, periodTicks(periods, grain, Math.max(0, width - yWidth - 12)));
  // Une seule entrée animée : un redimensionnement (barre de défilement, rotation) ne refait pas pousser
  // les barres depuis zéro. Changer d'indicateur ou d'affichage remonte le tracé (clé) : il s'anime à nouveau.
  const [entered, setEntered] = useState(false);
  const animate = !prefersReducedMotion() && !entered;
  const done = () => setEntered(true);
  const colorOf = (key: string) => (stacked ? (metas.find((m) => m.key === key)?.color ?? SINGLE_COLOR) : SINGLE_COLOR);

  return (
    <ComposedChart width={width} height={height} data={rows} margin={{ top: 8, right: kind === 'line' ? 10 : 4, bottom: 0, left: 0 }} barCategoryGap="26%">
      <CartesianGrid vertical={false} stroke="var(--sd-grid)" strokeWidth={1} />
      <XAxis
        dataKey="period"
        interval={0}
        tick={tick}
        tickLine={false}
        axisLine={{ stroke: 'var(--sd-baseline)' }}
        height={AXIS_BAND}
        padding={kind === 'line' ? { left: 12, right: 12 } : undefined}
      />
      <YAxis
        width={yWidth}
        ticks={yTicks}
        interval={0}
        tickFormatter={(v: number) => formatAxis(unit, v)}
        tick={{ fontSize: AXIS_FONT, fill: 'var(--sd-ink-2)' }}
        tickLine={false}
        axisLine={false}
        domain={[0, yTicks[yTicks.length - 1]]}
      />
      <Tooltip
        isAnimationActive={false}
        cursor={kind === 'bar' ? { fill: 'var(--sd-cursor)' } : { stroke: 'var(--sd-baseline)', strokeWidth: 1 }}
        content={<EvolutionTooltip metas={metas} stacked={stacked} unit={unit} />}
        wrapperStyle={{ outline: 'none' }}
        offset={14}
      />
      {kind === 'bar'
        ? keys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId={stacked ? 'sources' : undefined}
              fill={colorOf(key)}
              maxBarSize={24}
              isAnimationActive={animate}
              animationDuration={450}
              onAnimationEnd={done}
              shape={(props: unknown) => <BarSegment {...(props as SegmentProps)} seriesKey={key} stacked={stacked} />}
            />
          ))
        : keys.map((key) =>
            stacked ? (
              <Line
                key={key}
                type="linear"
                dataKey={key}
                stroke={colorOf(key)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                dot={(props: unknown) => <EndDot {...(props as DotProps)} rows={rows} color={colorOf(key)} key={`${key}-${(props as DotProps).index}`} />}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--sd-surface)', fill: colorOf(key) }}
                isAnimationActive={animate}
                animationDuration={600}
                onAnimationEnd={done}
              />
            ) : (
              <Area
                key={key}
                type="linear"
                dataKey={key}
                stroke={SINGLE_COLOR}
                strokeWidth={2}
                fill={SINGLE_COLOR}
                fillOpacity={0.1}
                dot={(props: unknown) => <EndDot {...(props as DotProps)} rows={rows} color={SINGLE_COLOR} key={`${key}-${(props as DotProps).index}`} />}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--sd-surface)', fill: SINGLE_COLOR }}
                isAnimationActive={animate}
                animationDuration={600}
                onAnimationEnd={done}
              />
            ),
          )}
    </ComposedChart>
  );
}

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: EvolutionRow;
}

/**
 * Un morceau de barre : bout arrondi (4 px) seulement en haut de la pile,
 * pied carré sur la ligne de base, et 2 px de vide entre deux morceaux —
 * c'est le vide qui sépare, pas un trait.
 */
function BarSegment({ x = 0, y = 0, width = 0, height = 0, fill, payload, seriesKey, stacked }: SegmentProps & { seriesKey: string; stacked: boolean }) {
  if (!(height > 0) || !(width > 0)) return null;
  const top = !stacked || payload?.top === seriesKey;
  let yy = y;
  let hh = height;
  if (!top && hh > 3) {
    yy += 2;
    hh -= 2;
  }
  const r = top ? Math.min(4, hh, width / 2) : 0;
  const d = r
    ? `M${x},${yy + hh}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + width - r}Q${x + width},${yy} ${x + width},${yy + r}V${yy + hh}Z`
    : `M${x},${yy + hh}V${yy}H${x + width}V${yy + hh}Z`;
  return <path d={d} fill={fill} fillOpacity={payload?.current ? 0.45 : 1} />;
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number | null;
}

/** Le point de bout de courbe (≥ 8 px, anneau de la couleur du fond) ; creux si la période est en cours. */
function EndDot({ cx, cy, index, rows, color }: DotProps & { rows: EvolutionRow[]; color: string }) {
  if (index !== rows.length - 1 || cx == null || cy == null) return <g />;
  const current = !!rows[index]?.current;
  return <circle cx={cx} cy={cy} r={4.5} fill={current ? 'var(--sd-surface)' : color} stroke={current ? color : 'var(--sd-surface)'} strokeWidth={2} />;
}

/* ── L'info-bulle ──────────────────────────────────────────────────────── */

function EvolutionTooltip({
  active,
  payload,
  metas,
  stacked,
  unit,
}: {
  active?: boolean;
  payload?: { payload?: EvolutionRow }[];
  metas: SeriesMeta[];
  stacked: boolean;
  unit: SalesUnit;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const lines = stacked ? [...metas].map((m) => ({ m, v: Number(row[m.key]) || 0 })).sort((a, b) => b.v - a.v) : [];
  return (
    <TooltipShell title={row.long} current={row.current}>
      {stacked ? (
        <>
          <ul className="mt-2 space-y-1.5">
            {lines.map(({ m, v }) => (
              <li key={m.key} className={cn('flex items-center gap-2.5 text-[14px]', v === 0 && 'opacity-60')}>
                <SeriesSwatch color={m.color} shape="line" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatValue(unit, v)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/70 pt-2 text-[14px]">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{formatValue(unit, row.total)}</span>
          </div>
        </>
      ) : (
        <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.01em]">{formatValue(unit, row.team)}</p>
      )}
    </TooltipShell>
  );
}

/* ── La vue tableau ────────────────────────────────────────────────────── */

function EvolutionTable({ rows, metas, unit, grain }: { rows: EvolutionRow[]; metas: SeriesMeta[]; unit: SalesUnit; grain: SalesSeries['grain'] }) {
  const multi = metas.length > 0;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-max border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[13px] text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-4 py-2 font-medium sm:pl-0">
              {grain === 'month' ? 'Mois' : 'Semaine'}
            </th>
            {multi &&
              metas.map((m) => (
                <th key={m.key} scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <SeriesSwatch color={m.color} shape="dot" />
                    {m.label}
                  </span>
                </th>
              ))}
            <th scope="col" className="px-4 py-2 text-right font-medium sm:pr-0">
              {multi ? 'Total' : 'Valeur'}
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...rows].reverse().map((r) => (
            <tr key={r.period} className="border-t border-border/60">
              <th scope="row" className="sticky left-0 bg-card px-4 py-2 text-left font-medium sm:pl-0">
                {periodLabel(r.period, grain, 'short')}
                {r.current && <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">en cours</span>}
              </th>
              {multi &&
                metas.map((m) => (
                  <td key={m.key} className="px-3 py-2 text-right text-muted-foreground">
                    {formatValue(unit, Number(r[m.key]) || 0)}
                  </td>
                ))}
              <td className="px-4 py-2 text-right font-semibold sm:pr-0">{formatValue(unit, multi ? r.total : r.team)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
