// ============================================================
// ESPACE COMMERCIAL — « Mon mois » : le calcul, sans affichage.
//
// L'accueil du commercial lit deux sources :
//   · commercial_dashboard(mois) — sa fiche, ses objectifs du mois, ses
//     prospects ouverts et à relancer (l'état d'aujourd'hui) ;
//   · sales_series(6 mois finissant au mois choisi, par mois) — les chiffres
//     mois par mois : la valeur du mois, celle du mois d'avant (la
//     tendance) et les courbes.
// Les chiffres du mois viennent de sales_series quand il répond (mêmes
// définitions que le tableau du mois, et les mêmes valeurs que les
// courbes) ; sinon — migration pas encore passée, réseau — de
// commercial_dashboard : l'accueil n'est jamais vide, il perd seulement
// les tendances et les courbes (et les vols, que seul sales_series compte).
//
// La tendance d'un mois PAS FINI ne se dit pas en pourcentage : le 9
// octobre, « −65 % » par rapport à septembre entier ne dirait que le
// calendrier. On écrit alors la valeur de septembre (« Septembre :
// 37,7 M XAF ») ; le pourcentage n'apparaît que pour un mois fini.
//
// Fonctions pures : `now` se passe en paramètre (tests, captures).
// ============================================================
import type { SalesFunnel, SalesSeries, SalesTotals } from '@/hooks/useSales';
import { currentMonth, monthLabel, shiftMonth, type Objective, type SalesMetrics } from '@/lib/sales';
import { SALES_METRICS, SALES_METRIC_KEYS, computeDelta, doualaToday, hasActivity, metricValues, num, type SalesDelta, type SalesMetricKey } from '@/lib/salesSeries';

/** Combien de mois l'accueil montre (le mois choisi compris). */
export const HOME_MONTHS = 6;

/** La plage de sales_series pour un mois choisi : les 6 mois qui finissent par lui (`to` exclu). */
export function homeRange(month: string): { from: string; to: string; grain: 'month' } {
  return { from: shiftMonth(month, -(HOME_MONTHS - 1)), to: shiftMonth(month, 1), grain: 'month' };
}

/** « octobre », « septembre ». */
export const monthWord = (month: string) => monthLabel(month).split(' ')[0];

/** Les chiffres d'un mois ; `null` = inconnu (les vols, sans sales_series). */
export type MonthFigures = Record<SalesMetricKey, number | null>;

/** Nombre de jours d'un mois « AAAA-MM-01 ». */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export interface MonthClock {
  /** Le mois contient aujourd'hui (Douala) : il n'est pas fini. */
  current: boolean;
  /** Un mois à venir (ne devrait pas arriver : le sélecteur s'arrête au mois en cours). */
  future: boolean;
  /** Le jour d'aujourd'hui dans ce mois (mois en cours), sinon null. */
  day: number | null;
  days: number;
  /** La part du mois écoulée, jour d'aujourd'hui compris (1 pour un mois fini, 0 à venir). */
  elapsed: number;
}

export function monthClock(month: string, now: Date = new Date()): MonthClock {
  const today = currentMonth(now);
  const days = daysInMonth(month);
  if (month < today) return { current: false, future: false, day: null, days, elapsed: 1 };
  if (month > today) return { current: false, future: true, day: null, days, elapsed: 0 };
  const day = Number(doualaToday(now).slice(8, 10)) || 1;
  return { current: true, future: false, day, days, elapsed: Math.min(1, day / days) };
}

/** Les chiffres d'un mois tels que sales_series les donne (null si le mois n'est pas dans la réponse). */
export function figuresFromSeries(series: SalesSeries | null | undefined, month: string): MonthFigures | null {
  const p = series?.team?.points?.find((x) => x.period === month) ?? series?.sources?.[0]?.points?.find((x) => x.period === month);
  if (!p) return null;
  return Object.fromEntries(SALES_METRIC_KEYS.map((k) => [k, num(p[k])])) as MonthFigures;
}

/**
 * Les mêmes chiffres, depuis commercial_dashboard (repli). `clients` y est
 * le parc d'AUJOURD'HUI ; les vols et les prospects perdus n'y sont pas.
 */
export function figuresFromMetrics(m: SalesMetrics | null | undefined): MonthFigures | null {
  if (!m) return null;
  return {
    clients_total: num(m.clients),
    new_clients: num(m.new_clients),
    active_clients: num(m.active_clients),
    prospects_new: num(m.prospects_new),
    prospects_won: num(m.prospects_won),
    prospects_lost: null,
    payments_xaf: num(m.payments_xaf),
    payments_count: num(m.payments_count),
    deposits_xaf: num(m.deposits_xaf),
    deposits_count: num(m.deposits_count),
    air_parcels: num(m.air_parcels),
    air_kg: num(m.air_kg),
    flights: null,
    sea_parcels: num(m.sea_parcels),
    sea_cbm: num(m.sea_cbm),
  };
}

/** Le point du mois d'avant (null s'il n'est pas dans la réponse). */
export function previousFigures(series: SalesSeries | null | undefined, month: string): SalesTotals | null {
  const prev = shiftMonth(month, -1);
  const f = figuresFromSeries(series, prev);
  if (!f) return null;
  return Object.fromEntries(SALES_METRIC_KEYS.map((k) => [k, num(f[k])])) as SalesTotals;
}

export interface MonthComparison {
  /** La valeur du mois d'avant (null : inconnue). */
  previous: number | null;
  /** L'écart en pourcentage — seulement si le mois choisi est fini et les deux valeurs connues. */
  delta: SalesDelta | null;
}

/** Comparer un chiffre du mois à celui du mois d'avant. */
export function compareMonth(key: SalesMetricKey, figures: MonthFigures | null, previous: SalesTotals | null, complete: boolean): MonthComparison {
  const cur = figures?.[key];
  const prev = previous ? num(previous[key]) : null;
  if (prev === null || cur == null) return { previous: prev, delta: null };
  if (!complete) return { previous: prev, delta: null };
  const d = computeDelta(cur, prev, SALES_METRICS[key].higherIsBetter);
  return { previous: prev, delta: d.kind === 'none' ? null : d };
}

/** Les valeurs d'un indicateur sur les 6 mois (mini-courbe), ou rien. */
export function homeSpark(series: SalesSeries | null | undefined, key: SalesMetricKey): number[] | null {
  const pts = series?.team?.points ?? series?.sources?.[0]?.points;
  return pts && pts.length > 1 ? metricValues(pts, key) : null;
}

/** Les 6 mois sont-ils tous vides (fiche toute neuve) ? Les prospects comptent comme une activité. */
export function isQuiet(series: SalesSeries | null | undefined): boolean {
  if (!series?.team) return false;
  const t = series.team.totals;
  return !hasActivity(t, series.team.funnel as SalesFunnel) && num(t?.clients_total) === 0;
}

/* ── Les objectifs ─────────────────────────────────────────────────────── */

export type PaceStatus = 'reached' | 'ahead' | 'behind' | 'missed';

export interface ObjectivePace {
  /** Réalisé / cible, borné à [0, 1] (la barre). */
  ratio: number;
  /** Réalisé / cible en pour cent, arrondi (peut dépasser 100). */
  pct: number;
  /** Ce qu'il reste à faire (0 une fois atteint). */
  left: number;
  /** Ce qu'il faudrait avoir fait aujourd'hui pour finir le mois à la cible (mois en cours). */
  expected: number | null;
  /**
   * reached : atteint ; ahead : pas encore, mais au moins au rythme du
   * calendrier ; behind : en dessous de ce rythme (mois en cours) ;
   * missed : le mois est fini sans l'atteindre.
   */
  status: PaceStatus;
}

/**
 * Où en est un objectif, rapporté au calendrier : le 9 octobre (9 jours sur
 * 31), 35 % de la cible, c'est « dans le rythme » ; 20 %, « sous le
 * rythme ». Un objectif sans cible (0) compte comme atteint dès qu'il y a
 * quelque chose — il ne devrait pas exister.
 */
export function objectivePace(o: Objective, clock: Pick<MonthClock, 'current' | 'elapsed'>): ObjectivePace {
  const target = num(o.target);
  const actual = num(o.actual);
  const ratio = target > 0 ? Math.max(0, Math.min(1, actual / target)) : actual > 0 ? 1 : 0;
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  const left = Math.max(0, target - actual);
  const reached = target > 0 ? actual >= target : actual > 0;
  const expected = clock.current ? target * clock.elapsed : null;
  const status: PaceStatus = reached ? 'reached' : clock.current ? (actual >= (expected ?? 0) ? 'ahead' : 'behind') : 'missed';
  return { ratio, pct, left, expected, status };
}
