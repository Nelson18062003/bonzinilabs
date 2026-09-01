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

/* ── Primitives de calendrier — EN COMPOSANTS UTC ──────────────────────
 *
 * Ces fonctions remplacent volontairement leurs homonymes de `date-fns`,
 * qui ne sont PAS utilisables ici.
 *
 * Le module représente une heure murale de Douala par une `Date` décalée de
 * +1 h, puis lit ses composants. Or `date-fns` lit les composants LOCAUX du
 * navigateur : sur un poste à UTC+1 — c'est-à-dire au Cameroun, donc sur
 * quasiment tous les postes réels — le décalage était appliqué DEUX fois.
 *
 * Bug observé en production : chaque barre du graphique portait l'étiquette
 * du jour PRÉCÉDENT. Les opérations du mardi s'affichaient sous « Lun 31 »,
 * et la colonne « Mar 1 » paraissait vide alors qu'on était mardi. Les
 * données étaient justes, les étiquettes mentaient. Le dernier jour de la
 * période était en prime tronqué (« Cette semaine » perdait son dimanche).
 *
 * Le seul environnement où l'ancien code était juste était un navigateur à
 * UTC — c'est-à-dire les captures d'écran et les tests, jamais l'utilisateur.
 *
 * Ces primitives ne lisent QUE des composants UTC : le résultat ne dépend
 * donc plus du fuseau du poste. Douala étant à UTC+1 toute l'année, sans
 * heure d'été, l'arithmétique est exacte.
 */

type WeekOptions = { weekStartsOn?: 0 | 1 };

const clone = (d: Date): Date => new Date(d.getTime());

/** Dernier jour du mois contenant `d` (1-31), en UTC. */
function lastDayOfMonthUTC(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function startOfDay(d: Date): Date {
  const x = clone(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = clone(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = clone(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

const subDays = (d: Date, n: number): Date => addDays(d, -n);
const subWeeks = (d: Date, n: number): Date => addDays(d, -7 * n);
const subMilliseconds = (d: Date, n: number): Date => new Date(d.getTime() - n);

/**
 * Ajoute `n` mois en bornant au dernier jour du mois d'arrivée : le 31 janvier
 * plus un mois donne le 28 (ou 29) février, jamais le 2 ou 3 mars.
 */
function addMonths(d: Date, n: number): Date {
  const x = clone(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  x.setUTCDate(Math.min(day, lastDayOfMonthUTC(x)));
  return x;
}

const subMonths = (d: Date, n: number): Date => addMonths(d, -n);
const subQuarters = (d: Date, n: number): Date => addMonths(d, -3 * n);

/** Même bornage que `addMonths` : le 29 février plus un an donne le 28. */
function addYears(d: Date, n: number): Date {
  const x = clone(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCFullYear(x.getUTCFullYear() + n);
  x.setUTCDate(Math.min(day, lastDayOfMonthUTC(x)));
  return x;
}

const subYears = (d: Date, n: number): Date => addYears(d, -n);

function startOfWeek(d: Date, options: WeekOptions = {}): Date {
  const weekStartsOn = options.weekStartsOn ?? 0;
  const x = startOfDay(d);
  return addDays(x, -((x.getUTCDay() - weekStartsOn + 7) % 7));
}

const endOfWeek = (d: Date, options: WeekOptions = {}): Date =>
  endOfDay(addDays(startOfWeek(d, options), 6));

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setUTCDate(1);
  return x;
}

const endOfMonth = (d: Date): Date => subMilliseconds(addMonths(startOfMonth(d), 1), 1);

function startOfQuarter(d: Date): Date {
  const x = startOfMonth(d);
  x.setUTCMonth(Math.floor(x.getUTCMonth() / 3) * 3);
  return x;
}

const endOfQuarter = (d: Date): Date => subMilliseconds(addMonths(startOfQuarter(d), 3), 1);

function startOfYear(d: Date): Date {
  const x = startOfDay(d);
  x.setUTCMonth(0, 1);
  return x;
}

const endOfYear = (d: Date): Date => subMilliseconds(addYears(startOfYear(d), 1), 1);

const differenceInCalendarDays = (a: Date, b: Date): number =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);

/** Business timezone — fixed, no daylight-saving. */
export const BUSINESS_TZ = 'Africa/Douala';
export const BUSINESS_TZ_OFFSET_MINUTES = 60;

/**
 * Earliest date covered by the analytics dashboard. Used as the lower
 * bound of the "all_time" preset. Set conservatively before Bonzini's
 * first records — extending it backwards is cheap (empty buckets), but
 * shrinking it forwards risks hiding historic data.
 */
export const BONZINI_EPOCH = new Date('2024-01-01T00:00:00.000Z');

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
  | 'all_time'
  | 'custom';

export type Granularity = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  hour: 'Heure',
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
  year: 'Année',
};

/** Returns "par jour", "par semaine"... — for chart subtitles. */
export function granularitySubtitle(g: Granularity): string {
  switch (g) {
    case 'hour': return 'par heure';
    case 'day': return 'par jour';
    case 'week': return 'par semaine';
    case 'month': return 'par mois';
    case 'quarter': return 'par trimestre';
    case 'year': return 'par an';
  }
}

/** Granularities that don't make sense for very short / very long ranges. */
export function granularityIsCompatible(g: Granularity, range: DateRange): boolean {
  // En jours civils de DOUALA. Comptés en UTC, « Aujourd'hui » (23:00Z la
  // veille → 22:59Z) chevauchait deux dates et valait 2 jours : « par jour »
  // y était accepté, et donnait un seul seau.
  const days = differenceInCalendarDays(nowInBusinessTZ(range.to), nowInBusinessTZ(range.from)) + 1;
  switch (g) {
    case 'hour':
      return days <= 3;
    case 'day':
      // Un seul jour « par jour » = UN seau : le graphique « Aujourd'hui »
      // n'affichait qu'une barre. Une journée se lit par heure.
      return days >= 2 && days <= 120;
    case 'week':
      return days >= 7 && days <= 730;
    case 'month':
      return days >= 28;
    case 'quarter':
      return days >= 90;
    case 'year':
      return days >= 365;
  }
}

/**
 * Returns a granularity guaranteed to be compatible with `range`.
 * If the requested granularity is incompatible (e.g. range = 1 day with
 * granularity = year, which would yield a single empty bucket), falls
 * back to a sensible default derived from the range size.
 *
 * Use this at every boundary where a granularity is consumed (chart
 * queries, axis builders) so the dashboard never receives a degenerate
 * combination — even if state is hydrated from URL params or persisted
 * preferences.
 */
export function coerceGranularity(range: DateRange): Granularity {
  return granularityIsCompatible(range.granularity, range)
    ? range.granularity
    : defaultGranularity(range.from, range.to);
}

/** Le défaut qu'une plage reçoit quand personne n'a choisi de granularité. */
export function defaultGranularityOf(range: Pick<DateRange, 'from' | 'to'>): Granularity {
  return defaultGranularity(range.from, range.to);
}

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
  if (days <= 730) return 'month';
  if (days <= 1825) return 'quarter';
  return 'year';
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
    case 'all_time': {
      // From Bonzini's epoch to today (business TZ).
      const epochBiz = nowInBusinessTZ(BONZINI_EPOCH);
      fromBiz = startOfDay(epochBiz);
      toBiz = endOfDay(biz);
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
 * Le sélecteur de dates fournit une `Date` dont les composants LOCAUX portent
 * le jour que l'utilisateur a cliqué dans le calendrier. On ne lit donc QUE
 * ces composants-là, jamais l'instant : sur un poste à UTC+8, minuit local
 * est déjà la veille en UTC, et lire l'instant décalait la plage d'un jour
 * entier.
 */
function calendarDayToBusiness(day: Date | string): Date {
  if (typeof day === 'string') {
    // La forme RÉELLE livrée par le calendrier ('YYYY-MM-DD'). La lire ici,
    // directement en jour civil, supprime le détour qui cassait : le
    // sélecteur faisait `new Date('2026-09-01')` — minuit UTC — puis on
    // lisait des composants LOCAUX ; à l'ouest de UTC, c'était la veille, et
    // TOUTE la plage reculait d'un jour.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (!m) throw new Error(`Jour civil attendu au format YYYY-MM-DD, reçu « ${day} »`);
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
}

/**
 * Build a custom range from business-TZ day boundaries.
 * `fromDay` and `toDay` are expressed as business-TZ calendar days.
 */
export function buildCustomRange(
  fromDay: Date | string,
  toDay: Date | string,
  granularity?: Granularity,
): DateRange {
  const fromBiz = calendarDayToBusiness(fromDay);
  const toBiz = endOfDay(calendarDayToBusiness(toDay));
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
  // `to` est INCLUSIF (23:59:59.999) : la longueur vraie est to − from + 1 ms.
  // Sans le +1, la période précédente d'un custom perdait sa première
  // milliseconde — et donc, en pratique, rien, mais l'invariant « même
  // longueur, contiguë » était faux d'un cheveu.
  const length = range.to.getTime() - range.from.getTime() + 1;
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
 * at the requested granularity. The first bucket is snapped to the
 * granularity boundary that contains `range.from` so it stays aligned
 * with `bucketKeyFor` — without this snap, weekly/monthly buckets
 * built from a range whose start doesn't fall on a Monday/1st would
 * never receive any data point.
 */
export function bucketStarts(range: DateRange): Date[] {
  const out: Date[] = [];
  // Ancre : le seau qui contient range.from. Le curseur est tenu en HEURE
  // MURALE DE DOUALA (composants UTC décalés de +1 h), pas en instant UTC.
  //
  // C'est ce qui a manqué : « minuit Douala le 1er mars » est l'instant UTC
  // « 28 février 23:00 ». Faire `addMonths` sur cet instant borne le jour à
  // min(28, dernier jour) et l'ancre dérivait — 31 janv → 28 févr → 28 mars
  // → 28 avr… Les événements d'avril à décembre ne trouvaient plus de seau
  // et disparaissaient du graphique en silence, tout en comptant dans les
  // totaux. Sur la date murale, le 1er du mois plus un mois est toujours le
  // 1er du mois suivant.
  let cursorBiz = nowInBusinessTZ(new Date(bucketKeyFor(range.from, range.granularity)));
  const toBiz = nowInBusinessTZ(range.to);
  while (cursorBiz < toBiz) {
    out.push(businessTZToUTC(cursorBiz));
    switch (range.granularity) {
      case 'hour':
        cursorBiz = new Date(cursorBiz.getTime() + 3600_000);
        break;
      case 'day':
        cursorBiz = addDays(cursorBiz, 1);
        break;
      case 'week':
        cursorBiz = addDays(cursorBiz, 7);
        break;
      case 'month':
        cursorBiz = addMonths(cursorBiz, 1);
        break;
      case 'quarter':
        cursorBiz = addMonths(cursorBiz, 3);
        break;
      case 'year':
        cursorBiz = addYears(cursorBiz, 1);
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
      // Le SEUL cas qui utilisait encore le constructeur LOCAL — raté lors du
      // passage en composants UTC. Sur un poste à UTC+1, les seaux horaires
      // étaient décalés d'une heure.
      bucketBiz = new Date(Date.UTC(biz.getUTCFullYear(), biz.getUTCMonth(), biz.getUTCDate(), biz.getUTCHours()));
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
    case 'quarter':
      bucketBiz = startOfQuarter(biz);
      break;
    case 'year':
      bucketBiz = startOfYear(biz);
      break;
  }
  return businessTZToUTC(bucketBiz).toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// Étiquette d'un seau — source unique
// ────────────────────────────────────────────────────────────────────────────

const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

/**
 * Étiquette humaine d'un seau (« Mar 1 », « 14h », « S36 », « Sep 26 »).
 *
 * Vit ICI, avec `bucketKeyFor`, et non dans les hooks : les deux fonctions
 * doivent partager exactement la même convention de fuseau. Elles étaient
 * jusqu'ici dans deux fichiers séparés — et dupliquées entre `useAnalytics`
 * et `useClientAnalytics` —, ce qui a permis à l'étiquette de dériver d'un
 * jour par rapport au seau qu'elle nomme sans qu'aucun test ne le voie.
 *
 * `bucket` est l'instant UTC de début du seau, tel que produit par
 * `bucketKeyFor` / `bucketStarts`.
 */
export function bucketLabel(bucket: Date, granularity: Granularity): string {
  const biz = new Date(bucket.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  switch (granularity) {
    case 'hour':
      return `${biz.getUTCHours().toString().padStart(2, '0')}h`;
    case 'day':
      return `${DAY_LABELS_FR[biz.getUTCDay()]} ${biz.getUTCDate()}`;
    case 'week': {
      // Numéro de semaine ISO : on vise le jeudi de la semaine.
      const d = new Date(biz.getTime());
      d.setUTCDate(biz.getUTCDate() + 3);
      const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return `S${Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)}`;
    }
    case 'month':
      return `${MONTH_LABELS_FR[biz.getUTCMonth()]} ${biz.getUTCFullYear().toString().slice(-2)}`;
    case 'quarter':
      return `T${Math.floor(biz.getUTCMonth() / 3) + 1} ${biz.getUTCFullYear().toString().slice(-2)}`;
    case 'year':
      return biz.getUTCFullYear().toString();
  }
}

/**
 * Étiquette d'AXE : comme `bucketLabel`, mais avec le contexte que l'axe ne
 * donne pas autrement.
 *
 * Sur un axe qui traverse plusieurs mois, « Lun 3 » ne dit pas de quel mois
 * il s'agit ; sur un axe qui traverse plusieurs jours par heure, « 14h » se
 * répète sans dire quel jour. L'utilisateur voyait « Dim 4 · Dim 18 · Dim 1 ·
 * Dim 15… » sur une année entière et ne pouvait pas s'y retrouver — les
 * étiquettes étaient exactes et illisibles.
 *
 * Règle : à chaque changement de contexte (nouveau mois pour les jours,
 * nouveau jour pour les heures) et sur le premier seau, l'étiquette porte le
 * contexte ; ailleurs elle reste courte. L'infobulle garde `bucketLabel`.
 */
export function bucketAxisLabel(bucket: Date, granularity: Granularity, range: DateRange): string {
  const biz = new Date(bucket.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  const fromBiz = new Date(range.from.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  const toBiz = new Date(range.to.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  const short = bucketLabel(bucket, granularity);
  const key = bucket.toISOString();
  // Le contexte va aux deux BOUTS de l'axe — Recharts garde toujours la
  // première et la dernière étiquette (`preserveStartEnd`) — et à chaque
  // changement de mois ou de jour entre les deux.
  const isFirst = bucketKeyFor(range.from, granularity) === key;
  const isLast = bucketKeyFor(new Date(range.to.getTime() - 1), granularity) === key;
  const isEdge = isFirst || isLast;

  switch (granularity) {
    case 'hour': {
      const spansDays = fromBiz.getUTCDate() !== toBiz.getUTCDate() || fromBiz.getUTCMonth() !== toBiz.getUTCMonth();
      if (!spansDays) return short;
      return isEdge || biz.getUTCHours() === 0
        ? `${DAY_LABELS_FR[biz.getUTCDay()]} ${biz.getUTCDate()} · ${short}`
        : short;
    }
    case 'day': {
      const spansMonths = fromBiz.getUTCMonth() !== toBiz.getUTCMonth() || fromBiz.getUTCFullYear() !== toBiz.getUTCFullYear();
      if (!spansMonths) return short;
      return isEdge || biz.getUTCDate() === 1
        ? `${biz.getUTCDate()} ${MONTH_LABELS_FR[biz.getUTCMonth()].toLowerCase()}`
        : String(biz.getUTCDate());
    }
    case 'week': {
      // « S36 » seul est cryptique : on donne le lundi qui ouvre la semaine.
      return `${biz.getUTCDate()} ${MONTH_LABELS_FR[biz.getUTCMonth()].toLowerCase()}`;
    }
    default:
      return short;
  }
}

/**
 * Un instant, affiché comme JOUR CIVIL DE DOUALA — « 1 sept. 2026 ».
 *
 * Pour le libellé du sélecteur et des en-têtes. `format(range.from, …)` de
 * date-fns lit les composants LOCAUX du poste : sur un navigateur à UTC, une
 * plage commençant « minuit Douala » (= 23:00 UTC la veille) s'affichait avec
 * la date de la veille alors que la plage, elle, était juste.
 */
export function formatBusinessDay(instant: Date): string {
  const biz = new Date(instant.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  return `${biz.getUTCDate()} ${MONTH_LABELS_FR[biz.getUTCMonth()].toLowerCase()}. ${biz.getUTCFullYear()}`;
}

/** Jour civil de Douala en 'YYYY-MM-DD' — la forme que parle le calendrier. */
export function toBusinessDayString(instant: Date): string {
  const biz = new Date(instant.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  const mm = String(biz.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(biz.getUTCDate()).padStart(2, '0');
  return `${biz.getUTCFullYear()}-${mm}-${dd}`;
}

/** « 1 sept. 2026 → 30 sept. 2026 », ou le libellé du preset. */
export function formatRangeLabel(range: DateRange): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset];
  return `${formatBusinessDay(range.from)} → ${formatBusinessDay(range.to)}`;
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
  all_time: 'Tout',
  custom: 'Personnalisé',
};

export const PRESET_GROUPS: Array<{ label: string; items: PresetId[] }> = [
  { label: 'Jour', items: ['today', 'yesterday'] },
  { label: 'Semaine', items: ['last_7_days', 'this_week', 'last_week'] },
  { label: 'Mois', items: ['last_30_days', 'this_month', 'last_month'] },
  { label: 'Période longue', items: ['last_90_days', 'this_quarter', 'this_year', 'last_year'] },
  { label: 'Historique', items: ['all_time'] },
];
