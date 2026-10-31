/**
 * Analyses mobile v2 — formats des chiffres et des dates.
 *
 * Montants ENTIERS (jamais « 18,4 M »), milliers séparés par une espace
 * insécable : en 40 px, l'espace fine de `fr-FR` disparaît à l'œil.
 */
import type { Tone } from '@/mobile/designKit';
import { BUSINESS_TZ_OFFSET_MINUTES, PRESET_LABELS, type DateRange, type Granularity } from '@/lib/analytics/dateRange';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 412 680 000 (espaces insécables). */
export function int(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf.format(Math.round(v)).replace(/[\u202F\s]/g, '\u00A0').replace('-', '−');
}

/** Un nombre signé : +230 000 / −6 490 000. */
export function signed(v: number): string {
  if (v > 0) return `+${int(v)}`;
  return int(v);
}

/** 41,5 (une décimale au plus). */
export function dec(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).replace(/[\u202F\s]/g, '\u00A0');
}

/** Une part 0 → 1 en « 38 % ». */
export function pct(share: number | null | undefined, digits = 0): string {
  if (share == null || !Number.isFinite(share)) return '—';
  return `${dec(share * 100, digits)}\u00A0%`;
}

/** Variation relative, `null` si rien à comparer. */
export function delta(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0 || !Number.isFinite(previous)) return null;
  return (current - previous) / Math.abs(previous);
}

/** Le tag de variation : « +12 % » vert, « −6 % » rouge. `higherIsBetter = false` inverse les couleurs. */
export function deltaTag(d: number | null | undefined, higherIsBetter = true): { tone: Tone; label: string } | undefined {
  if (d == null || !Number.isFinite(d)) return undefined;
  const p = Math.round(d * 100);
  const label = p > 0 ? `+${p}\u00A0%` : p < 0 ? `−${Math.abs(p)}\u00A0%` : '0\u00A0%';
  const good = higherIsBetter ? p > 0 : p < 0;
  return { tone: p === 0 ? 'neutral' : good ? 'success' : 'danger', label };
}

/** « 1 h 20 », « 38 min ». */
export function minutes(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const m = Math.round(v);
  if (m < 60) return `${m}\u00A0min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 48) return `${Math.round(h / 24)}\u00A0j`;
  return r === 0 ? `${h}\u00A0h` : `${h}\u00A0h\u00A0${String(r).padStart(2, '0')}`;
}

/* ── Dates (jours civils de Douala) ─────────────────────────────────────── */

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** L'instant décalé : ses composants UTC sont l'heure murale de Douala. */
export function biz(d: Date | string): Date {
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  return new Date(t + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
}

/** « 14 oct. » */
export function dayMonth(d: Date | string): string {
  const b = biz(d);
  return `${b.getUTCDate()}\u00A0${MONTHS[b.getUTCMonth()]}`;
}

/** « mer. 14 oct. » */
export function weekdayDayMonth(d: Date | string): string {
  const b = biz(d);
  return `${DAYS[b.getUTCDay()]} ${b.getUTCDate()}\u00A0${MONTHS[b.getUTCMonth()]}`;
}

/** « oct. », « févr. » */
export function monthShort(d: Date | string): string {
  return MONTHS[biz(d).getUTCMonth()];
}

/** « Septembre » */
export function monthLong(d: Date | string): string {
  return MONTHS_LONG[biz(d).getUTCMonth()];
}

export const MONTH_NAMES = MONTHS_LONG;

/** « 14:52 » à l'heure de Douala. */
export function hhmm(d: Date | string): string {
  const b = biz(d);
  return `${String(b.getUTCHours()).padStart(2, '0')}:${String(b.getUTCMinutes()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' de Douala. */
export function dayKey(d: Date | string): string {
  const b = biz(d);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}-${String(b.getUTCDate()).padStart(2, '0')}`;
}

/** « 22-09 » pour un nom de fichier. */
export function fileDay(d: Date | string): string {
  const b = biz(d);
  return `${String(b.getUTCDate()).padStart(2, '0')}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Le libellé de la période : le préréglage, ou « 5 oct. → 18 oct. ». */
export function periodLabel(range: DateRange): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset];
  return `${dayMonth(range.from)} → ${dayMonth(new Date(range.to.getTime() - 1))}`;
}

/** Nombre de jours civils couverts par la plage. */
export function rangeDays(range: Pick<DateRange, 'from' | 'to'>): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));
}

/** « vs 30 jours précédents », « vs hier », « vs période précédente ». */
export function versusLabel(range: DateRange): string {
  switch (range.preset) {
    case 'today': return 'vs hier';
    case 'yesterday': return 'vs avant-hier';
    case 'this_week': return 'vs semaine dernière';
    case 'last_week': return 'vs semaine d’avant';
    case 'this_month': return 'vs mois dernier';
    case 'last_month': return 'vs mois d’avant';
    case 'this_year': return 'vs année dernière';
    case 'all_time': return 'vs période précédente';
    default: return `vs ${rangeDays(range)} jours précédents`;
  }
}

/** L'unité d'un pas, au singulier (« Semaine en cours »). */
export const STEP_NOUN: Record<Granularity, string> = {
  hour: 'Heure', day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre', year: 'Année',
};

/** Le libellé d'un seau sur l'axe ou dans une bulle, selon le pas. */
export function bucketText(iso: string, g: Granularity, long = false): string {
  const b = biz(iso);
  switch (g) {
    case 'hour': return `${String(b.getUTCHours()).padStart(2, '0')}h`;
    case 'day': return long ? weekdayDayMonth(iso) : dayMonth(iso);
    case 'week': return long ? `Semaine du ${dayMonth(iso)}` : dayMonth(iso);
    case 'month': return long ? `${MONTHS_LONG[b.getUTCMonth()]} ${b.getUTCFullYear()}` : MONTHS[b.getUTCMonth()];
    case 'quarter': return `T${Math.floor(b.getUTCMonth() / 3) + 1} ${b.getUTCFullYear()}`;
    case 'year': return String(b.getUTCFullYear());
  }
}

/** Le seau qui contient « maintenant » est en cours : il se dessine en contour. */
export function isCurrentBucket(iso: string, nextIso: string | undefined, now = Date.now()): boolean {
  const start = new Date(iso).getTime();
  const end = nextIso ? new Date(nextIso).getTime() : Infinity;
  return start <= now && now < end;
}

/** Étiquettes d'axe : premier, deux intermédiaires, dernier (« Auj. » si c'est aujourd'hui). */
export function axisLabels(buckets: string[], g: Granularity, opts: { count?: number; today?: boolean } = {}): Record<number, string> {
  const n = buckets.length;
  if (n === 0) return {};
  const count = Math.min(opts.count ?? 4, n);
  const out: Record<number, string> = {};
  for (let k = 0; k < count; k++) {
    const i = count === 1 ? 0 : Math.round((k * (n - 1)) / (count - 1));
    out[i] = bucketText(buckets[i], g);
  }
  if (opts.today && g === 'day' && n > 1 && dayKey(buckets[n - 1]) === dayKey(new Date())) out[n - 1] = 'Auj.';
  return out;
}

/** Une valeur « ronde » sous le maximum, pour le seul repère chiffré du graphe. */
export function niceRef(max: number): number | null {
  if (!Number.isFinite(max) || max <= 0) return null;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [5, 2, 1]) {
    const v = m * p;
    if (v <= max && v >= max * 0.45) return v;
  }
  return p;
}
