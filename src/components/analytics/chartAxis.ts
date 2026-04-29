/**
 * Adaptive Recharts axis helpers.
 *
 * The defaults are tuned for fintech time-series:
 *   - never silently drop bars or buckets;
 *   - keep every bucket label readable, rotating when crowded;
 *   - strip noisy day-of-week prefixes when the bucket count grows.
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

/** Decide whether labels should be rotated to fit on a mobile-first canvas. */
function needsRotation(opts: TimeXAxisOpts): boolean {
  // Conservative thresholds tuned for ~360px wide cards on mobile.
  switch (opts.granularity) {
    case 'hour':
      return opts.dataLength > 12;     // typical 24h day still fits without rotation
    case 'day':
      return opts.dataLength > 10;     // "Lun 24" fits 10 abreast, beyond → rotate
    case 'week':
      return opts.dataLength > 14;
    case 'month':
      return opts.dataLength > 12;
    case 'quarter':
      return opts.dataLength > 10;
    case 'year':
      return opts.dataLength > 10;
  }
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

  return {
    // interval=0 forces Recharts to render every bucket label so the
    // user actually sees the temporal coverage. Rotation handles the
    // fit; we don't want Recharts to silently hide ticks.
    interval: 0 as const,
    tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
    axisLine: false,
    tickLine: false,
    // minTickGap is only respected when interval is auto, but we keep
    // it set to 0 for safety in case someone overrides interval.
    minTickGap: 0,
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
