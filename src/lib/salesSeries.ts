// ============================================================
// Tableau de bord des ventes (08/10) — le calcul, sans affichage.
//
// Tout ce que les écrans (« Mes équipes › Les commerciaux », la page d'un
// commercial, « Mon mois » de /v) font des chiffres de sales_series avant
// de les dessiner : la définition de chaque indicateur (libellé, unité,
// « plus c'est haut, mieux c'est »), les écarts avec la plage précédente,
// le taux de conversion, les libellés de période (« oct. 2026 »,
// « sem. du 5 oct. »), les plages toutes prêtes (3, 6, 12 mois, 12
// semaines, à l'heure de Douala), les lignes pour recharts (une série par
// fiche, couleur stable par fiche) et les totaux d'équipe.
//
// Fonctions pures : aucune requête, aucune horloge implicite (`now` se
// passe en paramètre — les captures et les tests figent la date).
// Les composants vivent dans src/components/salesdash/.
// ============================================================
import type { SalesFunnel, SalesGrain, SalesPoint, SalesSeries, SalesSeriesSource, SalesTotals } from '@/hooks/useSales';

/* ── Les indicateurs ───────────────────────────────────────────────────── */

export type SalesMetricKey = keyof SalesTotals;
export type SalesUnit = 'count' | 'xaf' | 'kg' | 'cbm';

export interface SalesMetricDef {
  key: SalesMetricKey;
  /** Le nom complet (« Paiements de ses clients » se dit « Paiements » : le contexte dit de qui). */
  label: string;
  /** Pour un onglet ou une colonne étroite. */
  short: string;
  unit: SalesUnit;
  /** Faux pour les prospects perdus : une hausse y est une mauvaise nouvelle. */
  higherIsBetter: boolean;
  /**
   * Comment une plage se résume : `sum` un flux (somme des périodes) ;
   * `stock` une valeur à la fin (clients) ; `distinct` « au moins une fois »
   * (clients actifs : le serveur les compte, une somme les compterait deux fois).
   */
  aggregate: 'sum' | 'stock' | 'distinct';
  /** Barres pour un flux, courbe pour un stock. */
  chart: 'bar' | 'line';
  /** La définition, telle que le serveur la calcule. */
  definition: string;
}

const def = (
  key: SalesMetricKey,
  label: string,
  short: string,
  unit: SalesUnit,
  definition: string,
  o: Partial<Pick<SalesMetricDef, 'higherIsBetter' | 'aggregate' | 'chart'>> = {},
): SalesMetricDef => ({ key, label, short, unit, definition, higherIsBetter: true, aggregate: 'sum', chart: 'bar', ...o });

export const SALES_METRICS: Record<SalesMetricKey, SalesMetricDef> = {
  clients_total: def('clients_total', 'Clients', 'Clients', 'count', 'Clients dont le commercial est l’origine, à la fin de la période.', {
    aggregate: 'stock',
    chart: 'line',
  }),
  new_clients: def('new_clients', 'Nouveaux clients', 'Nouveaux', 'count', 'Clients arrivés dans la période (compte créé ou origine attribuée).'),
  active_clients: def('active_clients', 'Clients actifs', 'Actifs', 'count', 'Clients qui ont payé, déposé ou envoyé un colis dans la période.', {
    aggregate: 'distinct',
  }),
  prospects_new: def('prospects_new', 'Prospects ajoutés', 'Prospects', 'count', 'Prospects saisis dans la période.'),
  prospects_won: def('prospects_won', 'Prospects devenus clients', 'Convertis', 'count', 'Prospects dont le compte client a été créé dans la période.'),
  prospects_lost: def('prospects_lost', 'Prospects perdus', 'Perdus', 'count', 'Prospects passés à « Perdu » dans la période.', { higherIsBetter: false }),
  payments_xaf: def('payments_xaf', 'Paiements', 'Paiements', 'xaf', 'Paiements terminés des clients du commercial (montant en XAF).'),
  payments_count: def('payments_count', 'Nombre de paiements', 'Nb paiements', 'count', 'Paiements terminés des clients du commercial.'),
  deposits_xaf: def('deposits_xaf', 'Dépôts', 'Dépôts', 'xaf', 'Dépôts validés des clients du commercial (montant en XAF).'),
  deposits_count: def('deposits_count', 'Nombre de dépôts', 'Nb dépôts', 'count', 'Dépôts validés des clients du commercial.'),
  air_parcels: def('air_parcels', 'Colis avion', 'Colis avion', 'count', 'Colis avion enregistrés au bureau de Guangzhou pour ses clients.'),
  air_kg: def('air_kg', 'Fret avion', 'Avion', 'kg', 'Kilos des colis avion enregistrés au bureau de Guangzhou pour ses clients.'),
  flights: def('flights', 'Vols', 'Vols', 'count', 'Vols distincts ayant emporté au moins un colis de ses clients.'),
  sea_parcels: def('sea_parcels', 'Colis bateau', 'Colis bateau', 'count', 'Colis bateau reçus à l’entrepôt pour ses clients.'),
  sea_cbm: def('sea_cbm', 'Fret bateau', 'Bateau', 'cbm', 'Volume (m³) des colis bateau reçus à l’entrepôt pour ses clients.'),
};

export const SALES_METRIC_KEYS = Object.keys(SALES_METRICS) as SalesMetricKey[];

/** Les indicateurs que la direction regarde d'abord (tuiles, onglets du graphique). */
export const HEADLINE_METRICS: SalesMetricKey[] = ['payments_xaf', 'deposits_xaf', 'new_clients', 'prospects_new', 'air_kg', 'flights'];

/** Une valeur du serveur, jamais NaN : null, undefined, texte vide ou infini comptent pour 0. */
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/* ── Les nombres ───────────────────────────────────────────────────────── */

const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const COMPACT = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const COMPACT2 = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 2 });

/** Le signe moins typographique (−) et non le trait d'union. */
const MINUS = '−';
const signed = (s: string, v: number) => (v > 0 ? `+${s}` : v < 0 ? `${MINUS}${s}` : s);

const UNIT_SUFFIX: Record<SalesUnit, string | null> = { count: null, xaf: 'XAF', kg: 'kg', cbm: 'm³' };

/** Le nombre seul, sans unité. `compact` : « 48,3 M » (au-delà du million pour les XAF, de 10 000 sinon). */
export function formatNumber(unit: SalesUnit, value: number, style: 'full' | 'compact' = 'full'): string {
  const v = num(value);
  const a = Math.abs(v);
  if (style === 'compact' && (unit === 'xaf' ? a >= 1_000_000 : a >= 10_000)) return (a >= 10_000_000 ? COMPACT : COMPACT2).format(v);
  if (unit === 'xaf' || unit === 'count') return NF.format(Math.round(v));
  if (unit === 'kg') return (a >= 100 ? NF : NF1).format(v);
  return (a >= 100 ? NF1 : NF2).format(v);
}

/** La valeur et son unité, séparées (la tuile écrit l'unité plus petite) ; `full` est le libellé complet. */
export function valueParts(unit: SalesUnit, value: number, style: 'full' | 'compact' = 'compact'): { number: string; unit: string | null; full: string } {
  const suffix = UNIT_SUFFIX[unit];
  const full = suffix ? `${formatNumber(unit, value)} ${suffix}` : formatNumber(unit, value);
  return { number: formatNumber(unit, value, style), unit: suffix, full };
}

/** « 48 312 500 XAF », « 1 234 kg », « 12,5 m³ », « 42 » — ou compact : « 48,3 M XAF ». */
export function formatValue(unit: SalesUnit, value: number, style: 'full' | 'compact' = 'full'): string {
  const p = valueParts(unit, value, style);
  return p.unit ? `${p.number} ${p.unit}` : p.number;
}

export const formatMetric = (key: SalesMetricKey, value: number, style: 'full' | 'compact' = 'full') => formatValue(SALES_METRICS[key].unit, value, style);

/**
 * Une graduation d'axe : courte, sans unité (le titre du graphique la porte).
 * Les montants s'abrègent dès le millier (« 40 M », « 500 k ») ; les kilos,
 * m³ et nombres seulement à partir de 10 000 (« 2 500 » se lit mieux que « 2,5 k »).
 */
export function formatAxis(unit: SalesUnit, value: number): string {
  const v = num(value);
  if (v === 0) return '0';
  const s = Math.abs(v) >= (unit === 'xaf' ? 1000 : 10_000) ? COMPACT.format(v) : unit === 'count' || unit === 'xaf' ? NF.format(v) : NF1.format(v);
  // L'espace fine insécable (U+202F) disparaît dans le SVG de recharts : l'espace insécable ordinaire.
  return s.replace(/\u202f/g, '\u00a0');
}

/**
 * Des graduations rondes de 0 à au moins `max` : un pas de 1, 2, 2,5 ou 5 × 10ⁿ
 * (1, 2 ou 5 pour un compte : jamais de demi-client), environ `target` intervalles.
 * 67,4 M → 0, 20, 40, 60, 80 M ; 15,5 M → 0, 5, 10, 15, 20 M ; rien → 0, 1.
 */
export function niceTicks(max: number, unit: SalesUnit = 'xaf', target = 4): number[] {
  const m = num(max);
  if (m <= 0) return [0, 1];
  const raw = m / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const factors = unit === 'count' ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = (factors.find((f) => f * pow >= raw - 1e-9) ?? 10) * pow;
  if (unit === 'count') step = Math.max(1, Math.round(step));
  const top = Math.ceil(m / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2 && out.length < 12; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** « 1 paiement », « 3 paiements ». */
export function plural(n: number, one: string, many: string): string {
  return `${NF.format(num(n))} ${Math.abs(num(n)) >= 2 ? many : one}`;
}

/** La ligne sous la valeur d'une tuile : ce qui l'éclaire (nombre d'opérations, colis…). Null s'il n'y a rien à dire. */
export function metricSub(key: SalesMetricKey, t: SalesTotals): string | null {
  switch (key) {
    case 'payments_xaf':
      return plural(t.payments_count, 'paiement', 'paiements');
    case 'deposits_xaf':
      return plural(t.deposits_count, 'dépôt', 'dépôts');
    case 'air_kg':
      return `${NF.format(num(t.air_parcels))} colis`;
    case 'sea_cbm':
      return `${NF.format(num(t.sea_parcels))} colis`;
    case 'flights':
      return num(t.flights) > 0 ? `${formatValue('kg', num(t.air_kg) / num(t.flights))} par vol` : null;
    case 'clients_total':
      return num(t.new_clients) > 0 ? `dont ${plural(t.new_clients, 'nouveau', 'nouveaux')}` : null;
    case 'new_clients':
    case 'active_clients':
      return `sur ${plural(t.clients_total, 'client', 'clients')}`;
    case 'prospects_new':
      return num(t.prospects_won) > 0 ? `${plural(t.prospects_won, 'devenu client', 'devenus clients')}` : null;
    case 'prospects_won':
      return num(t.prospects_lost) > 0 ? `${plural(t.prospects_lost, 'perdu', 'perdus')}` : null;
    default:
      return null;
  }
}

/* ── Les écarts avec la plage précédente ───────────────────────────────── */

/**
 * `none` : rien avant, rien maintenant (0 → 0) — pas de tendance à montrer.
 * `new`  : rien avant, quelque chose maintenant (0 → x) — un pourcentage n'a pas de sens.
 * `change` : le cas ordinaire, y compris x → 0 (−100 %).
 */
export type DeltaKind = 'none' | 'new' | 'change';

export interface SalesDelta {
  kind: DeltaKind;
  current: number;
  previous: number;
  /** current − previous. */
  abs: number;
  /** (current − previous) / previous ; null pour `none` et `new`. */
  pct: number | null;
  direction: 'up' | 'down' | 'flat';
  /** Bon ou mauvais selon le sens de l'indicateur ; neutre si stable. */
  tone: 'good' | 'bad' | 'neutral';
}

/** Moins d'un demi-point : « stable ». */
const FLAT = 0.005;

export function computeDelta(current: number, previous: number, higherIsBetter = true): SalesDelta {
  const c = num(current);
  const p = num(previous);
  const abs = c - p;
  if (p === 0 && c === 0) return { kind: 'none', current: c, previous: p, abs: 0, pct: null, direction: 'flat', tone: 'neutral' };
  const pct = p === 0 ? null : abs / Math.abs(p);
  const direction = pct === null ? (abs > 0 ? 'up' : 'down') : Math.abs(pct) < FLAT ? 'flat' : pct > 0 ? 'up' : 'down';
  const tone = direction === 'flat' ? 'neutral' : (direction === 'up') === higherIsBetter ? 'good' : 'bad';
  return { kind: p === 0 ? 'new' : 'change', current: c, previous: p, abs, pct, direction, tone };
}

export const metricDelta = (key: SalesMetricKey, totals: SalesTotals, previous: SalesTotals) =>
  computeDelta(totals[key], previous[key], SALES_METRICS[key].higherIsBetter);

const PCT0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * « +12 % », « −100 % », « stable », « nouveau » ; pour un petit compte
 * (moins de 10 avant), l'écart en nombre — « +3 » dit plus que « +150 % ».
 * Chaîne vide pour `none`.
 */
export function formatDelta(d: SalesDelta, unit: SalesUnit = 'xaf'): string {
  if (d.kind === 'none') return '';
  if (unit === 'count' && d.previous < 10) return d.abs === 0 ? 'stable' : signed(NF.format(Math.abs(d.abs)), d.abs);
  if (d.kind === 'new') return 'nouveau';
  if (d.direction === 'flat') return 'stable';
  const pct = d.pct ?? 0;
  return `${signed(PCT0.format(Math.abs(pct) * 100), pct)} %`;
}

/* ── Les prospects ─────────────────────────────────────────────────────── */

/** Devenus clients / prospects ajoutés dans la plage ; null s'il n'y en a aucun. */
export function conversionRate(f: Pick<SalesFunnel, 'won' | 'total'> | null | undefined): number | null {
  const total = num(f?.total);
  return total > 0 ? num(f?.won) / total : null;
}

/** « 19 % » ; une décimale sous 10 % (« 4,5 % ») ; « — » sans valeur. */
export function formatRate(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return '—';
  const v = r * 100;
  return `${(v > 0 && v < 10 ? NF1 : PCT0).format(v)} %`;
}

export type FunnelStageKey = 'open' | 'to_verify' | 'won' | 'lost';

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** Part des prospects ajoutés (0 à 1) ; 0 si aucun. */
  share: number;
}

/**
 * Où en sont, AUJOURD'HUI, les prospects ajoutés dans la plage : en cours
 * (à contacter, contactés, intéressés) → à vérifier (la direction doit
 * trancher) → devenus clients ; à part, perdus. Une partition du total.
 */
export function funnelStages(f: SalesFunnel | null | undefined): FunnelStage[] {
  const total = num(f?.total);
  const share = (n: number) => (total > 0 ? n / total : 0);
  const open = num(f?.new) + num(f?.contacted) + num(f?.interested);
  const rows: [FunnelStageKey, string, number][] = [
    ['open', 'En cours', open],
    ['to_verify', 'À vérifier', num(f?.to_verify)],
    ['won', 'Devenus clients', num(f?.won)],
    ['lost', 'Perdus', num(f?.lost)],
  ];
  return rows.map(([key, label, count]) => ({ key, label, count, share: share(count) }));
}

/* ── Les périodes (heure de Douala) ────────────────────────────────────── */

const DOUALA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Le jour à Douala, « AAAA-MM-JJ ». */
export function doualaToday(now: Date = new Date()): string {
  const parts = DOUALA_DAY.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Le début de la période qui contient ce jour : le 1er du mois, ou le lundi. */
export function periodStart(day: string, grain: SalesGrain): string {
  const d = toDate(day);
  if (grain === 'month') return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const back = (d.getUTCDay() + 6) % 7; // lundi = 0
  return toIso(new Date(d.getTime() - back * 86_400_000));
}

/** Avancer (ou reculer) de n périodes. */
export function addPeriods(period: string, grain: SalesGrain, n: number): string {
  const d = toDate(period);
  if (grain === 'month') return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
  return toIso(new Date(d.getTime() + n * 7 * 86_400_000));
}

/** Les débuts de période de [from, to[. */
export function periodsBetween(from: string, to: string, grain: SalesGrain): string[] {
  const out: string[] = [];
  for (let p = periodStart(from, grain); p < to && out.length < 520; p = addPeriods(p, grain, 1)) out.push(p);
  return out;
}

/** La période contient-elle aujourd'hui (elle est donc incomplète) ? */
export function isCurrentPeriod(period: string, grain: SalesGrain, now: Date = new Date()): boolean {
  return periodStart(doualaToday(now), grain) === period.slice(0, 10);
}

const FR_MONTH_SHORT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const FR_MONTH_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });

/**
 * Le libellé d'une période :
 *   axis  « oct. »            · « 5 oct. »
 *   short « oct. 2026 »       · « sem. du 5 oct. »
 *   long  « octobre 2026 »    · « semaine du 5 au 11 oct. 2026 »
 */
export function periodLabel(period: string, grain: SalesGrain, style: 'axis' | 'short' | 'long' = 'short'): string {
  const d = toDate(period);
  const y = d.getUTCFullYear();
  if (grain === 'month') {
    if (style === 'axis') return FR_MONTH_SHORT.format(d);
    if (style === 'short') return `${FR_MONTH_SHORT.format(d)} ${y}`;
    return `${FR_MONTH_LONG.format(d)} ${y}`;
  }
  const day = d.getUTCDate();
  const mon = FR_MONTH_SHORT.format(d);
  if (style === 'axis') return `${day} ${mon}`;
  if (style === 'short') return `sem. du ${day} ${mon}`;
  const end = new Date(d.getTime() + 6 * 86_400_000);
  const endMon = FR_MONTH_SHORT.format(end);
  const head = end.getUTCMonth() === d.getUTCMonth() ? `${day}` : `${day} ${mon}`;
  return `semaine du ${head} au ${end.getUTCDate()} ${endMon} ${end.getUTCFullYear()}`;
}

/**
 * L'année sous une graduation : à la première, et quand elle change
 * (« janv. » de l'année suivante). Null ailleurs — l'axe reste léger.
 */
export function axisYear(periods: string[], index: number): string | null {
  const p = periods[index];
  if (!p) return null;
  const y = p.slice(0, 4);
  if (index === 0) return y;
  return periods[index - 1]?.slice(0, 4) !== y ? y : null;
}

/** « nov. 2025 – oct. 2026 », « 20 juil. – 11 oct. 2026 ». */
export function rangeLabel(periods: string[], grain: SalesGrain): string {
  if (!periods.length) return '';
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (grain === 'month') return first === last ? periodLabel(first, grain, 'short') : `${periodLabel(first, grain, 'short')} – ${periodLabel(last, grain, 'short')}`;
  const end = addPeriods(last, 'week', 1);
  const endDay = toDate(end);
  endDay.setUTCDate(endDay.getUTCDate() - 1);
  const sameYear = first.slice(0, 4) === toIso(endDay).slice(0, 4);
  const start = `${periodLabel(first, 'week', 'axis')}${sameYear ? '' : ` ${first.slice(0, 4)}`}`;
  return `${start} – ${endDay.getUTCDate()} ${FR_MONTH_SHORT.format(endDay)} ${endDay.getUTCFullYear()}`;
}

/* ── Les plages toutes prêtes ──────────────────────────────────────────── */

export type SalesRangePreset = '3m' | '6m' | '12m' | '12w';

export interface SalesRangePresetDef {
  value: SalesRangePreset;
  label: string;
  /** Pour un écran étroit. */
  short: string;
  grain: SalesGrain;
  count: number;
}

export const RANGE_PRESETS: SalesRangePresetDef[] = [
  { value: '3m', label: '3 mois', short: '3 mois', grain: 'month', count: 3 },
  { value: '6m', label: '6 mois', short: '6 mois', grain: 'month', count: 6 },
  { value: '12m', label: '12 mois', short: '12 mois', grain: 'month', count: 12 },
  { value: '12w', label: '12 semaines', short: '12 sem.', grain: 'week', count: 12 },
];

export const presetDef = (p: SalesRangePreset) => RANGE_PRESETS.find((x) => x.value === p) ?? RANGE_PRESETS[2];

/**
 * La plage d'un préréglage, période en cours COMPRISE : « 3 mois » le
 * 9 octobre 2026 = août, septembre, octobre → { from: '2026-08-01',
 * to: '2026-11-01', grain: 'month' }. `to` est exclu (comme sales_series).
 */
export function rangeForPreset(preset: SalesRangePreset, now: Date = new Date()): { from: string; to: string; grain: SalesGrain } {
  const d = presetDef(preset);
  const current = periodStart(doualaToday(now), d.grain);
  return { from: addPeriods(current, d.grain, -(d.count - 1)), to: addPeriods(current, d.grain, 1), grain: d.grain };
}

/** « par rapport aux 3 mois précédents », « … aux 12 semaines précédentes ». */
export function compareLabel(preset: SalesRangePreset): string {
  const d = presetDef(preset);
  return d.grain === 'month' ? `par rapport aux ${d.count} mois précédents` : `par rapport aux ${d.count} semaines précédentes`;
}

/* ── Les sommes ────────────────────────────────────────────────────────── */

export function emptyTotals(): SalesTotals {
  return Object.fromEntries(SALES_METRIC_KEYS.map((k) => [k, 0])) as unknown as SalesTotals;
}

export function emptyFunnel(): SalesFunnel {
  return { total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 };
}

/** La somme de plusieurs totaux (ou points) : clé par clé, sans NaN. */
export function sumTotals(list: readonly SalesTotals[]): SalesTotals {
  const out = emptyTotals();
  for (const t of list) for (const k of SALES_METRIC_KEYS) out[k] += num(t?.[k]);
  return out;
}

export function sumFunnels(list: readonly SalesFunnel[]): SalesFunnel {
  const out = emptyFunnel();
  for (const f of list) for (const k of Object.keys(out) as (keyof SalesFunnel)[]) out[k] += num(f?.[k]);
  return out;
}

/** Le point d'une période (zéros si la fiche n'en a pas). */
export function pointAt(points: readonly SalesPoint[] | undefined, period: string): SalesPoint {
  return points?.find((p) => p.period === period) ?? { period, ...emptyTotals() };
}

/**
 * L'équipe recomposée côté écran, quand on n'en garde qu'une partie (sans
 * les fiches archivées, par exemple). Somme clé par clé, comme le serveur.
 * `flights` aussi : un vol qui emporte des colis de deux commerciaux compte
 * deux fois — le serveur seul sait dédoublonner ; préférer `series.team`
 * quand toutes les fiches sont gardées.
 */
export function teamOf(sources: readonly SalesSeriesSource[], periods: readonly string[]): SalesSeries['team'] {
  return {
    points: periods.map((period) => ({ period, ...sumTotals(sources.map((s) => pointAt(s.points, period))) })),
    totals: sumTotals(sources.map((s) => s.totals)),
    previous_totals: sumTotals(sources.map((s) => s.previous_totals)),
    funnel: sumFunnels(sources.map((s) => s.funnel)),
  };
}

/** Une réponse réduite à une fiche : `team` devient cette fiche. Null si elle n'y est pas. */
export function pickSource(series: SalesSeries, sourceId: string): SalesSeries | null {
  const s = series.sources.find((x) => x.source_id === sourceId);
  if (!s) return null;
  return { ...series, sources: [s], team: { points: s.points, totals: s.totals, previous_totals: s.previous_totals, funnel: s.funnel } };
}

/** Les valeurs d'un indicateur, période par période (une mini-courbe). */
export function metricValues(points: readonly SalesPoint[] | undefined, key: SalesMetricKey): number[] {
  return (points ?? []).map((p) => num(p[key]));
}

/** Y a-t-il quoi que ce soit à montrer ? */
export function hasActivity(t: SalesTotals | null | undefined, f?: SalesFunnel | null): boolean {
  if (!t) return false;
  const any = SALES_METRIC_KEYS.some((k) => k !== 'clients_total' && num(t[k]) !== 0);
  return any || num(f?.total) > 0;
}

/**
 * Les fiches dans l'ordre d'un classement : les actives par valeur
 * décroissante, puis les archivées (même règle). À égalité : par nom.
 */
export function rankSources(sources: readonly SalesSeriesSource[], key: SalesMetricKey = 'payments_xaf'): SalesSeriesSource[] {
  return [...sources].sort(
    (a, b) =>
      Number(!a.is_active) - Number(!b.is_active) || num(b.totals?.[key]) - num(a.totals?.[key]) || a.label.localeCompare(b.label, 'fr'),
  );
}

/* ── Les couleurs des fiches ───────────────────────────────────────────── */

/** Huit teintes catégorielles (src/components/salesdash/salesdash.css) ; au-delà : « Autres », en gris. */
export const SERIES_SLOTS = 8;
export const OTHER_COLOR = 'var(--sd-other)';
export const seriesColor = (slot: number | null) => (slot && slot >= 1 && slot <= SERIES_SLOTS ? `var(--sd-cat-${slot})` : OTHER_COLOR);

/**
 * La couleur suit la FICHE, jamais son rang : les fiches sont classées par
 * identifiant (stable, quel que soit l'ordre du serveur ou le classement
 * affiché) et prennent les teintes dans l'ordre, sans en sauter — c'est
 * l'ordre validé pour les daltoniens (voisins distincts). Masquer une
 * série dans la légende ne repeint pas les autres.
 */
export function sourceSlots(sources: readonly Pick<SalesSeriesSource, 'source_id'>[]): Map<string, number | null> {
  const ids = [...new Set(sources.map((s) => s.source_id))].sort();
  return new Map(ids.map((id, i) => [id, i < SERIES_SLOTS ? i + 1 : null]));
}

/* ── Les lignes pour recharts ──────────────────────────────────────────── */

export interface SeriesMeta {
  /** La clé de la série dans une ligne (« s1 », « s2 »… ; « other » pour les autres). */
  key: string;
  sourceIds: string[];
  label: string;
  archived: boolean;
  slot: number | null;
  color: string;
  /** Le total de la plage, pour la légende. */
  total: number;
}

export interface EvolutionRow {
  period: string;
  /** « oct. » / « 5 oct. ». */
  axis: string;
  /** « octobre 2026 » / « semaine du 5 au 11 oct. 2026 ». */
  long: string;
  /** L'année sous la graduation, ou null. */
  year: string | null;
  /** La période contient aujourd'hui : elle n'est pas finie. */
  current: boolean;
  /** Somme des séries visibles. */
  total: number;
  /** La valeur de l'équipe (series.team), source de vérité quand rien n'est masqué. */
  team: number;
  /** La clé de la série visible la plus haute non nulle (son bout est arrondi). */
  top: string | null;
  [seriesKey: string]: number | string | boolean | null;
}

/**
 * Les lignes d'un graphique d'évolution : une par période, une colonne par
 * fiche (couleur stable), plus `total` (les séries visibles) et `team`.
 * Les séries suivent l'ordre des teintes, de bas en haut d'un empilement.
 * Au-delà de huit fiches, les dernières se regroupent en « Autres ».
 */
export function toChartRows(
  series: Pick<SalesSeries, 'grain' | 'periods' | 'sources' | 'team'>,
  metric: SalesMetricKey,
  opts: { hidden?: ReadonlySet<string>; now?: Date } = {},
): { rows: EvolutionRow[]; series: SeriesMeta[] } {
  const slots = sourceSlots(series.sources);
  const bySlot = [...series.sources].sort((a, b) => (slots.get(a.source_id) ?? 99) - (slots.get(b.source_id) ?? 99) || a.source_id.localeCompare(b.source_id));
  const metas: SeriesMeta[] = [];
  const members = new Map<string, SalesSeriesSource[]>();
  for (const s of bySlot) {
    const slot = slots.get(s.source_id) ?? null;
    if (slot === null) {
      let other = metas.find((m) => m.key === 'other');
      if (!other) {
        other = { key: 'other', sourceIds: [], label: 'Autres', archived: false, slot: null, color: OTHER_COLOR, total: 0 };
        metas.push(other);
        members.set('other', []);
      }
      other.sourceIds.push(s.source_id);
      other.total += num(s.totals?.[metric]);
      members.get('other')!.push(s);
      continue;
    }
    const key = `s${slot}`;
    metas.push({ key, sourceIds: [s.source_id], label: s.label, archived: !s.is_active, slot, color: seriesColor(slot), total: num(s.totals?.[metric]) });
    members.set(key, [s]);
  }
  const hidden = opts.hidden ?? new Set<string>();
  const rows = series.periods.map((period, i) => {
    const row: EvolutionRow = {
      period,
      axis: periodLabel(period, series.grain, 'axis'),
      long: periodLabel(period, series.grain, 'long'),
      year: axisYear(series.periods, i),
      current: isCurrentPeriod(period, series.grain, opts.now),
      total: 0,
      team: num(pointAt(series.team?.points, period)[metric]),
      top: null,
    };
    for (const m of metas) {
      const v = members.get(m.key)!.reduce((s, src) => s + num(pointAt(src.points, period)[metric]), 0);
      row[m.key] = v;
      if (!hidden.has(m.key)) {
        row.total += v;
        if (v !== 0) row.top = m.key;
      }
    }
    return row;
  });
  return { rows, series: metas };
}
