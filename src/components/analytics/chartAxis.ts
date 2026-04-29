/**
 * Adaptive Recharts axis helpers.
 *
 * Tuned for mobile-first fintech time-series:
 *   - bars are NEVER dropped — every bucket renders;
 *   - X-axis labels are thinned when the bucket count exceeds what the
 *     canvas can show legibly (Recharts `interval` prop), keeping them
 *     readable rather than overlapping;
 *   - rotation kicks in only when even the thinned labels remain dense;
 *   - day labels lose their weekday prefix once the row gets crowded;
 *   - the full label stays available in the tooltip via `payload.label`.
 *
 * Spread the returned object on a Recharts `<XAxis>`:
 *
 *   <XAxis dataKey="label" {...timeXAxisProps({ granularity, dataLength })} />
 *
 * Use `timeChartBottomMargin(...)` to reserve room for rotated labels.
 */

import type { Granularity } from '@/lib/analytics/dateRange';

interface TimeXAxisOpts {
  granularity: Granularity;
  dataLength: number;
}

/**
 * Maximum legible labels for a ~360px wide mobile card by granularity.
 * Beyond this, labels get thinned (every Nth tick) AND rotated.
 */
function maxLabelsFor(granularity: Granularity): number {
  switch (granularity) {
    case 'hour':    return 12;
    case 'day':     return 10;
    case 'week':    return 14;
    case 'month':   return 12;
    case 'quarter': return 10;
    case 'year':    return 10;
  }
}

/**
 * Compute Recharts `interval` to thin labels: 0 means "render every tick",
 * N means "skip N ticks between rendered labels". Bars are unaffected —
 * Recharts only thins the label rendering, not the data series.
 */
function tickInterval(opts: TimeXAxisOpts): number {
  const cap = maxLabelsFor(opts.granularity);
  if (opts.dataLength <= cap) return 0;
  return Math.ceil(opts.dataLength / cap) - 1;
}

/** Rotate labels only when even thinned labels would still be cramped. */
function needsRotation(opts: TimeXAxisOpts): boolean {
  return opts.dataLength > maxLabelsFor(opts.granularity);
}

/**
 * Strip the weekday prefix from day labels ("Lun 24" → "24") when the
 * bucket count makes full labels impossible to fit. The full label
 * stays available in the tooltip via `payload.label`.
 */
function compactDayLabel(label: string): string {
  const m = /^[A-Za-zÀ-ÿ]+\s(\d{1,2})$/.exec(label);
  return m ? m[1] : label;
}

export function timeXAxisProps(opts: TimeXAxisOpts) {
  const rotate = needsRotation(opts);
  const compact = opts.granularity === 'day' && opts.dataLength > 7;
  const interval = tickInterval(opts);

  return {
    interval,
    tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
    axisLine: false,
    tickLine: false,
    minTickGap: 4,
    tickMargin: rotate ? 4 : 6,
    angle: rotate ? -35 : 0,
    textAnchor: (rotate ? 'end' : 'middle') as 'end' | 'middle',
    height: rotate ? 60 : 28,
    padding: { left: 6, right: 6 },
    tickFormatter: compact ? compactDayLabel : undefined,
  };
}

/**
 * Returns the chart `margin.bottom` value to reserve room for rotated
 * X-axis labels. Pair with `timeXAxisProps`.
 */
export function timeChartBottomMargin(opts: TimeXAxisOpts): number {
  return needsRotation(opts) ? 28 : 4;
}
