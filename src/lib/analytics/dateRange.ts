/**
 * Temporal foundations for the analytics module.
 *
 * The business runs in Africa/Douala (UTC+1 year-round, no DST).
 * This module exposes a single `DateRange` contract that every
 * analytics hook consumes, so the whole dashboard can be retargeted
 * by changing one thing.
 *
 * Never use `new Date().setDate(...)` + `toISOString().split('T')[0]`
 * directly — it silently shifts by the browser's local offset and
 * was the root cause of sub-day inaccuracies in the previous
 * `useDashboardAnalytics.ts` implementation.
 */

import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMilliseconds,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';

/** Business timezone — fixed, no daylight-saving. */
export const BUSINESS_TZ = 'Africa/Douala';
export const BUSINESS_TZ_OFFSET_MINUTES = 60;

// ────────────────────────────────────────────────────────────────────────────

export type PresetId =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface DateRange {
  /** Inclusive start in UTC. */
  from: Date;
  /** Exclusive end in UTC. */
  to: Date;
  /** Preset used to build the range, or 'custom'. */
  preset: PresetId;
  /** Bucket size for time-series queries. */
  granularity: Granularity;
  /** If true, hooks also compute the equivalent previous range. */
  compareToPrevious: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// TZ-safe primitives
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current wall-clock date in the business timezone,
 * as a JS Date whose UTC values reflect business-TZ year/month/day.
 * e.g. if now = 2026-04-23T23:30:00Z, result = 2026-04-24T00:30:00Z
 * (because Douala is already on April 24th at 00:30).
 */
function nowInBusinessTZ(now = new Date()): Date {
  return new Date(now.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
}

/**
 * Given a Date whose UTC components reflect business-TZ wall clock,
 * convert it back to the real UTC instant (for Supabase queries).
 */
function businessTZToUTC(businessDate: Date): Date {
  return new Date(businessDate.getTime() - BUSINESS_TZ_OFFSET_MINUTES * 60_000);
}

/**
 * Picks a smart default granularity based on the range size.
 */
function defaultGranularity(from: Date, to: Date): Granularity {
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
  if (days <= 2) return 'hour';
  if (days <= 60) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

// ────────────────────────────────────────────────────────────────────────────
// Preset builders — every date is built in business TZ then converted to UTC.
// ────────────────────────────────────────────────────────────────────────────

export function buildRangeFromPreset(
  preset: PresetId,
  options: { now?: Date; granularity?: Granularity } = {},
): DateRange {
  const now = options.now ?? new Date();
  const biz = nowInBusinessTZ(now);

  let fromBiz: Date;
  let toBiz: Date;

  switch (preset) {
    case 'today': {
      fromBiz = startOfDay(biz);
      toBiz = endOfDay(biz);
      break;
    }
    case 'yesterday': {
      const y = subDays(biz, 1);
      fromBiz = startOfDay(y);
      toBiz = endOfDay(y);
      break;
    }
    case 'last_7_days': {
      fromBiz = startOfDay(subDays(biz, 6));
      toBiz = endOfDay(biz);
      break;
    }
    case 'last_30_days': {
      fromBiz = startOfDay(subDays(biz, 29));
      toBiz = endOfDay(biz);
      break;
    }
    case 'last_90_days': {
      fromBiz = startOfDay(subDays(biz, 89));
      toBiz = endOfDay(biz);
      break;
    }
    case 'this_week': {
      fromBiz = startOfWeek(biz, { weekStartsOn: 1 });
      toBiz = endOfWeek(biz, { weekStartsOn: 1 });
      break;
    }
    case 'last_week': {
      const lw = subWeeks(biz, 1);
      fromBiz = startOfWeek(lw, { weekStartsOn: 1 });
      toBiz = endOfWeek(lw, { weekStartsOn: 1 });
      break;
    }
    case 'this_month': {
      fromBiz = startOfMonth(biz);
      toBiz = endOfMonth(biz);
      break;
    }
    case 'last_month': {
      const lm = subMonths(biz, 1);
      fromBiz = startOfMonth(lm);
      toBiz = endOfMonth(lm);
      break;
    }
    case 'this_quarter': {
      fromBiz = startOfQuarter(biz);
      toBiz = endOfQuarter(biz);
      break;
    }
    case 'this_year': {
      fromBiz = startOfYear(biz);
      toBiz = endOfYear(biz);
      break;
    }
    case 'last_year': {
      const ly = subYears(biz, 1);
      fromBiz = startOfYear(ly);
      toBiz = endOfYear(ly);
      break;
    }
    case 'custom': {
      // Caller must use buildCustomRange — fall back to last 30 days.
      fromBiz = startOfDay(subDays(biz, 29));
      toBiz = endOfDay(biz);
      break;
    }
  }

  const from = businessTZToUTC(fromBiz);
  const to = businessTZToUTC(toBiz);

  return {
    from,
    to,
    preset,
    granularity: options.granularity ?? defaultGranularity(from, to),
    compareToPrevious: false,
  };
}

/**
 * Build a custom range from business-TZ day boundaries.
 * `fromDay` and `toDay` are expressed as business-TZ calendar days.
 */
export function buildCustomRange(
  fromDay: Date,
  toDay: Date,
  granularity?: Granularity,
): DateRange {
  const fromBiz = startOfDay(nowInBusinessTZ(fromDay));
  const toBiz = endOfDay(nowInBusinessTZ(toDay));
  const from = businessTZToUTC(fromBiz);
  const to = businessTZToUTC(toBiz);
  return {
    from,
    to,
    preset: 'custom',
    granularity: granularity ?? defaultGranularity(from, to),
    compareToPrevious: false,
  };
}

/**
 * Returns the equivalent "period right before" — same length, ending
 * at (range.from - 1ms). Used for comparisons ("vs previous period").
 */
export function previousRange(range: DateRange): DateRange {
  const length = range.to.getTime() - range.from.getTime();
  const to = subMilliseconds(range.from, 1);
  const from = new Date(to.getTime() - length + 1);

  // For named presets, snap to the expected previous equivalent
  // (e.g. 'this_month' previous = 'last_month').
  switch (range.preset) {
    case 'today':
      return buildRangeFromPreset('yesterday', { granularity: range.granularity });
    case 'this_week':
      return buildRangeFromPreset('last_week', { granularity: range.granularity });
    case 'this_month':
      return buildRangeFromPreset('last_month', { granularity: range.granularity });
    case 'this_quarter': {
      const biz = nowInBusinessTZ();
      const lq = subQuarters(biz, 1);
      return {
        from: businessTZToUTC(startOfQuarter(lq)),
        to: businessTZToUTC(endOfQuarter(lq)),
        preset: 'custom',
        granularity: range.granularity,
        compareToPrevious: false,
      };
    }
    case 'this_year':
      return buildRangeFromPreset('last_year', { granularity: range.granularity });
    default:
      return {
        from,
        to,
        preset: 'custom',
        granularity: range.granularity,
        compareToPrevious: false,
      };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Supabase query bounds
// ────────────────────────────────────────────────────────────────────────────

/**
 * Converts the range to ISO timestamp strings ready for Supabase
 * `.gte()` / `.lt()` filters. Always UTC — Postgres handles the TZ.
 */
export function toSupabaseBounds(range: DateRange): { fromISO: string; toISO: string } {
  return {
    fromISO: range.from.toISOString(),
    toISO: range.to.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bucket helpers — for time-series aggregation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Yields the bucket start timestamps (in UTC) that cover `range`
 * at the requested granularity. The last bucket may extend past `range.to`
 * — the caller should clip when computing widths.
 */
export function bucketStarts(range: DateRange): Date[] {
  const out: Date[] = [];
  let cursor = new Date(range.from.getTime());
  while (cursor < range.to) {
    out.push(new Date(cursor.getTime()));
    switch (range.granularity) {
      case 'hour':
        cursor = new Date(cursor.getTime() + 3600_000);
        break;
      case 'day':
        cursor = addDays(cursor, 1);
        break;
      case 'week':
        cursor = addDays(cursor, 7);
        break;
      case 'month':
        cursor = addMonths(cursor, 1);
        break;
    }
  }
  return out;
}

/**
 * Buckets a timestamp into its owning bucket-start key (ISO UTC).
 * Uses business TZ for day/week/month bucketing so that e.g. a payment
 * at 23:30 UTC counted as "April 23" in Douala goes into the April 23 bucket.
 */
export function bucketKeyFor(instant: Date, granularity: Granularity): string {
  const biz = nowInBusinessTZ(instant);
  let bucketBiz: Date;
  switch (granularity) {
    case 'hour':
      bucketBiz = new Date(biz.getFullYear(), biz.getMonth(), biz.getDate(), biz.getHours());
      break;
    case 'day':
      bucketBiz = startOfDay(biz);
      break;
    case 'week':
      bucketBiz = startOfWeek(biz, { weekStartsOn: 1 });
      break;
    case 'month':
      bucketBiz = startOfMonth(biz);
      break;
  }
  return businessTZToUTC(bucketBiz).toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// Labels for presets
// ────────────────────────────────────────────────────────────────────────────

export const PRESET_LABELS: Record<PresetId, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  last_7_days: '7 derniers jours',
  last_30_days: '30 derniers jours',
  last_90_days: '90 derniers jours',
  this_week: 'Cette semaine',
  last_week: 'Semaine dernière',
  this_month: 'Ce mois',
  last_month: 'Mois dernier',
  this_quarter: 'Ce trimestre',
  this_year: 'Cette année',
  last_year: 'Année dernière',
  custom: 'Personnalisé',
};

export const PRESET_GROUPS: Array<{ label: string; items: PresetId[] }> = [
  { label: 'Jour', items: ['today', 'yesterday'] },
  { label: 'Semaine', items: ['last_7_days', 'this_week', 'last_week'] },
  { label: 'Mois', items: ['last_30_days', 'this_month', 'last_month'] },
  { label: 'Période longue', items: ['last_90_days', 'this_quarter', 'this_year', 'last_year'] },
];
