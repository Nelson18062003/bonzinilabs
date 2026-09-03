/**
 * La fenêtre des graphiques de CROISSANCE — « semaine après semaine »,
 * « mois après mois ».
 *
 * Ces graphiques ne suivent PAS le sélecteur de période en haut de l'écran, et
 * c'est voulu. Sur « 30 derniers jours », un graphique mensuel donnerait UN
 * seau : la question « est-ce que ça grandit ? » n'a pas de réponse sur une
 * seule barre. Une matrice de croissance a besoin de son propre horizon —
 * douze semaines, douze mois — pour qu'une tendance existe.
 *
 * Tout le calcul se fait sur le JOUR CIVIL DE DOUALA, en arithmétique de
 * calendrier pure (chaînes 'YYYY-MM-DD'), puis passe par `buildCustomRange`
 * qui reconvertit en instants UTC. C'est la leçon du bogue de fuseau : dès
 * qu'on manipule des `Date` pour faire du calendrier, on décale d'un jour sur
 * la moitié des postes.
 */
import { buildCustomRange, toBusinessDayString, type DateRange } from './dateRange';

/** Le pas d'une matrice de croissance. Un seul choix : la semaine ou le mois. */
export type GrowthMode = 'week' | 'month';

export const GROWTH_MODE_LABELS: Record<GrowthMode, string> = {
  week: 'Semaine',
  month: 'Mois',
};

/** « semaine après semaine » / « mois après mois » — pour les sous-titres. */
export const GROWTH_MODE_PHRASE: Record<GrowthMode, string> = {
  week: 'semaine après semaine',
  month: 'mois après mois',
};

/** Le nom d'UNE période, au singulier. */
export const GROWTH_MODE_NOUN: Record<GrowthMode, string> = {
  week: 'semaine',
  month: 'mois',
};

/**
 * Les tournures qui dépendent du GENRE. « Semaine » est féminin, « mois » est
 * masculin : composer les libellés à partir du seul nom donnait « dernière
 * mois complète » et « la mois en cours ». Le genre ne se devine pas d'un
 * `Record<GrowthMode, string>` — il faut écrire les deux formes.
 */
export const GROWTH_MODE_TEXT: Record<
  GrowthMode,
  {
    lastComplete: string;
    vsPrevious: string;
    /** Forme courte, pour l'infobulle : « vs semaine précédente ». */
    vsPreviousShort: string;
    plural: string;
    currentIs: string;
  }
> = {
  week: {
    lastComplete: 'Dernière semaine complète',
    vsPrevious: "vs la semaine d'avant",
    vsPreviousShort: 'vs semaine précédente',
    plural: 'semaines',
    currentIs: 'est la semaine en cours',
  },
  month: {
    lastComplete: 'Dernier mois complet',
    vsPrevious: "vs le mois d'avant",
    vsPreviousShort: 'vs mois précédent',
    plural: 'mois',
    currentIs: 'est le mois en cours',
  },
};

/** Combien de périodes une matrice montre par défaut, la courante comprise. */
export const GROWTH_PERIODS = 12;

const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' → composants entiers, sans jamais construire de `Date` locale. */
function parseDay(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
}

function formatDay(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Le lundi qui ouvre la semaine d'un jour civil donné.
 *
 * Semaine ISO (lundi), comme `bucketKeyFor` — les deux DOIVENT s'accorder,
 * sinon la fenêtre commence au milieu d'un seau et la première barre est une
 * demi-semaine qu'on lirait comme un effondrement.
 */
export function startOfBusinessWeek(day: string): string {
  const { y, m, d } = parseDay(day);
  const t = Date.UTC(y, m - 1, d);
  const dow = new Date(t).getUTCDay(); // 0 = dimanche
  const offset = (dow + 6) % 7; // lundi = 0
  const monday = new Date(t - offset * MS_PER_DAY);
  return formatDay(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

/** Le premier jour du mois d'un jour civil donné. */
export function startOfBusinessMonth(day: string): string {
  const { y, m } = parseDay(day);
  return formatDay(y, m, 1);
}

/**
 * Le premier jour de la fenêtre : le début de la période située `periods - 1`
 * pas avant la période EN COURS. La fenêtre contient donc `periods` seaux,
 * dont le dernier est la période courante — incomplète, et signalée comme
 * telle par le graphique.
 */
export function growthWindowStart(mode: GrowthMode, periods: number, today: string): string {
  if (mode === 'week') {
    const monday = parseDay(startOfBusinessWeek(today));
    // Les semaines font exactement 7 jours et Douala n'a pas d'heure d'été :
    // le calcul en millisecondes est exact.
    const start = new Date(Date.UTC(monday.y, monday.m - 1, monday.d) - (periods - 1) * 7 * MS_PER_DAY);
    return formatDay(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
  }
  // Les mois n'ont pas de longueur fixe : on compte en MOIS, pas en jours.
  const { y, m } = parseDay(startOfBusinessMonth(today));
  const total = y * 12 + (m - 1) - (periods - 1);
  return formatDay(Math.floor(total / 12), (total % 12) + 1, 1);
}

/**
 * La plage à passer aux hooks d'analyse : `periods` seaux entiers du pas
 * demandé, finissant aujourd'hui.
 *
 * `granularity` est FORCÉE au pas : c'est tout l'objet de la fenêtre. Elle
 * reste compatible par construction — 12 semaines = 84 jours (≥ 7), 12 mois
 * ≈ 335 jours (≥ 28).
 */
export function buildGrowthRange(
  mode: GrowthMode,
  periods: number = GROWTH_PERIODS,
  now: Date = new Date(),
): DateRange {
  const today = toBusinessDayString(now);
  return buildCustomRange(growthWindowStart(mode, periods, today), today, mode);
}
