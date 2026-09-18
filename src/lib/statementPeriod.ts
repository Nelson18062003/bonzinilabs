/**
 * Relevé de compte — la PÉRIODE.
 *
 * Le relevé PDF couvrait « tout l'historique », plafonné en silence à 100
 * lignes. Il couvre désormais une période choisie (préréglages ou dates
 * libres), avec un solde d'ouverture et un solde de clôture.
 *
 * Toute l'arithmétique de dates s'appuie sur `analytics/dateRange.ts`,
 * qui parle en jours civils de Douala (UTC+1, sans heure d'été) : un
 * « 30 derniers jours » commence à minuit Douala, pas à minuit du poste.
 *
 * `prepareStatement` est PURE : elle reçoit des mouvements déjà mappés (dans
 * n'importe quel ordre), garde ceux de la période, et calcule les soldes.
 * C'est elle qui est testée ; les écrans ne font que lui passer des données.
 */
import type { StatementMovement } from '@/lib/pdf/templates/ClientStatementPDF';
import {
  BONZINI_EPOCH,
  BUSINESS_TZ,
  buildCustomRange,
  buildRangeFromPreset,
  toBusinessDayString,
} from '@/lib/analytics/dateRange';

// ─── Préréglages ──────────────────────────────────────────────────────────────

export type StatementPeriodPreset =
  | 'today'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom';

export interface StatementPresetDef {
  id: StatementPeriodPreset;
  /** Clé i18n dans le namespace `common`. */
  labelKey: string;
  /** Libellé français de secours (defaultValue). */
  labelFr: string;
}

/** Ordre d'affichage des puces du sélecteur. */
export const STATEMENT_PRESETS: readonly StatementPresetDef[] = [
  { id: 'today',        labelKey: 'statementPeriod.presets.today',        labelFr: "Aujourd'hui" },
  { id: 'last_7_days',  labelKey: 'statementPeriod.presets.last_7_days',  labelFr: '7 derniers jours' },
  { id: 'last_14_days', labelKey: 'statementPeriod.presets.last_14_days', labelFr: '14 derniers jours' },
  { id: 'last_30_days', labelKey: 'statementPeriod.presets.last_30_days', labelFr: '30 derniers jours' },
  { id: 'last_90_days', labelKey: 'statementPeriod.presets.last_90_days', labelFr: '3 derniers mois' },
  { id: 'this_month',   labelKey: 'statementPeriod.presets.this_month',   labelFr: 'Ce mois-ci' },
  { id: 'last_month',   labelKey: 'statementPeriod.presets.last_month',   labelFr: 'Mois dernier' },
  { id: 'all_time',     labelKey: 'statementPeriod.presets.all_time',     labelFr: "Tout l'historique" },
  { id: 'custom',       labelKey: 'statementPeriod.presets.custom',       labelFr: 'Personnalisé' },
];

export const DEFAULT_STATEMENT_PRESET: StatementPeriodPreset = 'last_30_days';

// ─── Plage ────────────────────────────────────────────────────────────────────

export interface StatementRange {
  /** Instant UTC inclusif (minuit Douala du premier jour). */
  from: Date;
  /** Instant UTC inclusif (23:59:59.999 Douala du dernier jour). */
  to: Date;
  preset: StatementPeriodPreset;
}

export interface StatementCustomDays {
  /** 'YYYY-MM-DD' ou ''. */
  from: string;
  /** 'YYYY-MM-DD' ou ''. */
  to: string;
}

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Construit la plage d'un préréglage. Pour `custom`, `custom.from` /
 * `custom.to` sont des jours civils 'YYYY-MM-DD' ; une borne absente est
 * complétée (début → époque Bonzini, fin → aujourd'hui) et des bornes
 * inversées sont remises dans l'ordre.
 */
export function buildStatementRange(
  preset: StatementPeriodPreset,
  custom?: StatementCustomDays,
  now: Date = new Date(),
): StatementRange {
  switch (preset) {
    case 'today':
    case 'last_7_days':
    case 'last_30_days':
    case 'last_90_days':
    case 'this_month':
    case 'last_month':
    case 'all_time': {
      const r = buildRangeFromPreset(preset, { now });
      return { from: r.from, to: r.to, preset };
    }
    case 'last_14_days': {
      // Pas de préréglage analytics : 14 jours civils de Douala, aujourd'hui inclus.
      const today = buildRangeFromPreset('today', { now });
      const firstDay = toBusinessDayString(new Date(today.from.getTime() - 13 * DAY_MS));
      const r = buildCustomRange(firstDay, toBusinessDayString(today.to));
      return { from: r.from, to: r.to, preset };
    }
    case 'custom': {
      const today = buildRangeFromPreset('today', { now });
      let fromDay = custom?.from && DAY_RE.test(custom.from) ? custom.from : toBusinessDayString(BONZINI_EPOCH);
      let toDay = custom?.to && DAY_RE.test(custom.to) ? custom.to : toBusinessDayString(today.to);
      if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
      const r = buildCustomRange(fromDay, toDay);
      return { from: r.from, to: r.to, preset };
    }
  }
}

/** « Tout l'historique » : aucune borne à envoyer à la base. */
export function isAllTime(range: StatementRange): boolean {
  return range.preset === 'all_time';
}

/** Les bornes à passer aux requêtes, ou `null` pour tout l'historique. */
export function statementQueryRange(range: StatementRange): { from: Date; to: Date } | null {
  return isAllTime(range) ? null : { from: range.from, to: range.to };
}

// ─── Libellé ──────────────────────────────────────────────────────────────────

type Lang = 'fr' | 'en' | 'zh';

function normLang(lang: string | undefined): Lang {
  const l = (lang ?? 'fr').slice(0, 2).toLowerCase();
  return l === 'en' || l === 'zh' ? l : 'fr';
}

const INTL_LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', zh: 'zh-CN' };

/** Un instant, écrit comme jour civil de Douala — « 1 sept. 2026 ». */
export function formatStatementDay(instant: Date, lang?: string): string {
  const l = normLang(lang);
  return new Intl.DateTimeFormat(INTL_LOCALE[l], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BUSINESS_TZ,
  }).format(instant);
}

/**
 * « Du 1 sept. 2026 au 18 sept. 2026 » — la phrase d'aperçu du sélecteur.
 * Pour tout l'historique, la phrase le dit au lieu d'afficher l'époque.
 */
export function statementPeriodLabel(range: StatementRange, lang?: string): string {
  const l = normLang(lang);
  if (isAllTime(range)) {
    const upTo = formatStatementDay(range.to, l);
    return l === 'en' ? `All history, up to ${upTo}`
      : l === 'zh' ? `全部历史，截至 ${upTo}`
      : `Tout l'historique, jusqu'au ${upTo}`;
  }
  const from = formatStatementDay(range.from, l);
  const to = formatStatementDay(range.to, l);
  if (from === to) {
    return l === 'en' ? `On ${from}` : l === 'zh' ? `${from}` : `Le ${from}`;
  }
  return l === 'en' ? `From ${from} to ${to}`
    : l === 'zh' ? `${from} 至 ${to}`
    : `Du ${from} au ${to}`;
}

// ─── Préparation (pure) ───────────────────────────────────────────────────────

export interface PrepareStatementInput {
  /** Mouvements déjà mappés et filtrés, dans n'importe quel ordre. */
  movements: StatementMovement[];
  range: { from: Date; to: Date };
  /** `true` : on ignore les bornes et on garde tout. */
  allTime: boolean;
  /**
   * `balance_after` de la dernière écriture AVANT la période — utilisé
   * quand la période n'a aucun mouvement (sinon l'ouverture se lit sur la
   * première ligne). Absent → 0.
   */
  lastBalanceBeforeRange?: number | null;
}

export interface PreparedStatement {
  /** Triés du plus ancien au plus récent, bornés à la période. */
  movements: StatementMovement[];
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
}

const time = (m: StatementMovement) => new Date(m.date).getTime();

export function prepareStatement({
  movements,
  range,
  allTime,
  lastBalanceBeforeRange,
}: PrepareStatementInput): PreparedStatement {
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  const kept = movements
    .filter((m) => {
      if (allTime) return true;
      const t = time(m);
      return t >= fromMs && t <= toMs;
    })
    .sort((a, b) => time(a) - time(b));

  const openingBalance = kept.length > 0
    ? kept[0].soldeAvant
    : (lastBalanceBeforeRange ?? 0);
  const closingBalance = kept.length > 0
    ? kept[kept.length - 1].solde
    : openingBalance;

  const totalCredits = kept.reduce((s, m) => s + m.credit, 0);
  const totalDebits = kept.reduce((s, m) => s + m.debit, 0);

  return { movements: kept, openingBalance, closingBalance, totalCredits, totalDebits };
}
