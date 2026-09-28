// ============================================================
// LE FLYER « TAUX DU JOUR » — les chiffres et le texte, sans JSX.
//
// Validé par le fondateur le 24/09/2026 (maquette « simple + bloc rouge ») :
//   · un flyer PAR PAYS, le pays en très gros ;
//   · « Pour 1 000 000 XAF, votre fournisseur reçoit : » puis un gros chiffre
//     par groupe de modes (Alipay, WeChat Pay et virement ont presque
//     toujours le même taux : une seule carte ; le cash à part) ;
//   · les petits paiements (tranches de montant moins favorables) dans un
//     bloc ROUGE, qu'on ne peut pas rater ;
//   · signé BONZINI (28/09/2026 : plus la raison sociale), ni site, ni
//     WhatsApp ; le jour ET l'heure DE GUANGZHOU, fuseau écrit (UTC+8) ; le drapeau chinois à côté
//     du pays ; plus de phrase « taux valables ce jour » en bas.
// Mêmes calculs que la RPC calculate_final_rate et que le paiement :
// base × (1 + pays) × (1 + tranche), arrondi comme calculateFinalRate puis à
// l'entier. Tout vient de la publication active et de rate_adjustments : si
// l'équipe change une tranche dans Réglages, le flyer suit.
// ============================================================
import { COUNTRIES } from '@/types/rates';
import type { DailyRate, PaymentMethodKey, RateAdjustment } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from './rateCalculation';
import { countryMeta, REFERENCE_COUNTRY_KEY } from './countryRates';

/** Le nom en tête du flyer et en signature du message (décision du 28/09/2026). */
export const FLYER_BRAND = 'BONZINI';

/**
 * Le jour et l'heure du flyer sont ceux de GUANGZHOU (décision du 28/09/2026),
 * fuseau écrit sur le flyer. La Chine n'a qu'un fuseau (UTC+8, sans heure
 * d'été) : l'identifiant IANA est Asia/Shanghai.
 */
export const FLYER_TIME_ZONE = 'Asia/Shanghai';

/** La langue du flyer : on bascule FR ↔ EN au moment de le fabriquer (28/09/2026). */
export type FlyerLang = 'fr' | 'en';
export const FLYER_LANGS: readonly FlyerLang[] = ['fr', 'en'];

/**
 * Tous les mots du flyer et de son message, par langue. Copiés À L'IDENTIQUE
 * dans supabase/functions/generate-flyer (Mola, Telegram) — le test
 * rateFlyer.test.ts vérifie que la fonction serveur contient chacun d'eux.
 */
export const FLYER_TEXT = {
  fr: {
    title: 'Taux du jour',
    forAmount: 'Pour',
    supplierGets: ', votre fournisseur reçoit\u00a0:',
    china: 'Chine',
    allAmounts: 'Tous montants',
    andAbove: 'XAF et plus',
    under: 'Moins de',
    from: 'De',
    to: 'à',
    payment: 'Paiement',
    paymentOf: 'Paiement de',
    methods: { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Virement', cash: 'Cash' },
    countries: { cameroun: 'Cameroun', gabon: 'Gabon', tchad: 'Tchad', rca: 'Centrafrique', congo: 'Congo', guinee: 'Guinée Équatoriale' },
    days: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    colon: ' :',
    zone: 'heure de Guangzhou (UTC+8)',
  },
  en: {
    title: "Today's rate",
    forAmount: 'For',
    supplierGets: ', your supplier receives:',
    china: 'China',
    allAmounts: 'All amounts',
    andAbove: 'XAF and above',
    under: 'Under',
    from: 'From',
    to: 'to',
    payment: 'Payment',
    paymentOf: 'Payment of',
    methods: { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Bank transfer', cash: 'Cash' },
    countries: { cameroun: 'Cameroon', gabon: 'Gabon', tchad: 'Chad', rca: 'Central African Rep.', congo: 'Congo', guinee: 'Equatorial Guinea' },
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    colon: ':',
    zone: 'Guangzhou time (UTC+8)',
  },
} as const;

/** Ordre des modes sur le flyer ; le libellé dépend de la langue (FLYER_TEXT). */
export const FLYER_METHODS: { key: PaymentMethodKey; label: string }[] = [
  { key: 'alipay', label: 'Alipay' },
  { key: 'wechat', label: 'WeChat Pay' },
  { key: 'virement', label: 'Virement' },
  { key: 'cash', label: 'Cash' },
];

/** Une tranche de montant : de `min` à `max` XAF (max null = sans limite). */
export interface FlyerBracket { min: number; max: number | null; pct: number; label: string }

/** Une carte du flyer : des modes au même taux, et leur taux par tranche (même ordre que `brackets`). */
export interface FlyerGroup { keys: PaymentMethodKey[]; label: string; rates: number[] }

export interface FlyerData {
  lang: FlyerLang;
  country: { key: string; label: string; iso: string | null };
  /** Jour affiché : « Jeudi 24 septembre 2026 » / « Thursday 24 September 2026 ». */
  date: string;
  /** Heure de Guangzhou au moment du flyer : « 17h00 » / « 17:00 » (le fuseau : FLYER_TEXT.zone). */
  time: string;
  /** Tranches, de la meilleure (« 400 000 XAF et plus ») aux petits paiements. */
  brackets: FlyerBracket[];
  groups: FlyerGroup[];
}

/** « 10 800 » en français (espace insécable : le nombre ne se coupe jamais), « 10,800 » en anglais. */
function fmtInt(n: number, lang: FlyerLang = 'fr'): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '\u00a0');
}
export { fmtInt as formatFlyerNumber };

/**
 * Les tranches de rate_adjustments (type tier), de la plus haute à la plus
 * basse. Deux tranches voisines au même pourcentage n'en font qu'une : t2 et
 * t3 à 0 % donnent « 400 000 XAF et plus ». Bornes : celles du calcul
 * (1 000 000 et 400 000 XAF, cf. getTierKey).
 */
export function flyerBrackets(adjustments: readonly RateAdjustment[], lang: FlyerLang = 'fr'): FlyerBracket[] {
  const t = FLYER_TEXT[lang];
  const pctOf = (key: string) => {
    const a = adjustments.find((x) => x.type === 'tier' && x.key === key);
    return a && !a.is_reference ? Number(a.percentage) || 0 : 0;
  };
  const asc = [
    { min: 0, pct: pctOf('t1') },
    { min: 400_000, pct: pctOf('t2') },
    { min: 1_000_000, pct: pctOf('t3') },
  ];
  const merged: { min: number; pct: number }[] = [];
  for (const x of asc) {
    const last = merged[merged.length - 1];
    if (!last || last.pct !== x.pct) merged.push({ ...x });
  }
  const n = (v: number) => fmtInt(v, lang);
  return merged
    .map((b, i) => {
      const next = merged[i + 1];
      const max = next ? next.min - 1 : null;
      let label: string;
      if (merged.length === 1) label = t.allAmounts;
      else if (max === null) label = `${n(b.min)} ${t.andAbove}`;
      else if (b.min === 0) label = `${t.under} ${n(next!.min)} XAF`;
      else label = `${t.from} ${n(b.min)} ${t.to} ${n(max)} XAF`;
      return { min: b.min, max, pct: b.pct, label };
    })
    .reverse();
}

/** Écart du pays (0 pour la référence ou un pays inconnu). */
export function countryPercentage(adjustments: readonly RateAdjustment[], countryKey: string): number {
  const a = adjustments.find((x) => x.type === 'country' && x.key === countryKey);
  return a && !a.is_reference ? Number(a.percentage) || 0 : 0;
}

/** Le taux d'un mode dans une tranche, arrondi à l'entier comme sur le flyer. */
function bracketRate(base: number, countryPct: number, b: FlyerBracket): number {
  if (!(base > 0)) return 0;
  // Un montant représentatif de la tranche suffit : calculateFinalRate en déduit la tranche.
  return Math.round(calculateFinalRate(base, countryPct, b.min, [{ key: tierKeyAt(b.min), percentage: b.pct }]).finalRate);
}
function tierKeyAt(amount: number): string {
  return amount >= 1_000_000 ? 't3' : amount >= 400_000 ? 't2' : 't1';
}

/** Les cartes : les modes au même taux (sur toutes les tranches) se regroupent ; le cash reste seul. */
function groupMethods(rate: DailyRate, countryPct: number, brackets: FlyerBracket[], lang: FlyerLang): FlyerGroup[] {
  const groups: FlyerGroup[] = [];
  for (const m of FLYER_METHODS) {
    const rates = brackets.map((b) => bracketRate(getBaseRate(rate, m.key), countryPct, b));
    const same = m.key === 'cash' ? undefined : groups.find((g) => !g.keys.includes('cash') && g.rates.every((r, i) => r === rates[i]));
    if (same) same.keys.push(m.key);
    else groups.push({ keys: [m.key], label: m.label, rates });
  }
  for (const g of groups) g.label = g.keys.map((k) => FLYER_TEXT[lang].methods[k]).join(' · ');
  return groups;
}

/** Le jour de Guangzhou en chiffres. */
function flyerYmd(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: FLYER_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** « Jeudi 24 septembre 2026 » / « Thursday 24 September 2026 », jour de Guangzhou. */
export function flyerDate(now: Date = new Date(), lang: FlyerLang = 'fr'): string {
  const { y, m, d } = flyerYmd(now);
  const t = FLYER_TEXT[lang];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${t.days[wd]} ${d} ${t.months[m - 1]} ${y}`;
}

/** « 17h00 » / « 17:00 », heure de Guangzhou. */
export function flyerTime(now: Date = new Date(), lang: FlyerLang = 'fr'): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: FLYER_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}${lang === 'en' ? ':' : 'h'}${get('minute')}`;
}

/** Tout ce que le flyer d'un pays affiche. Pays inconnu : la référence (Cameroun). */
export function buildFlyerData(
  rate: DailyRate,
  adjustments: readonly RateAdjustment[],
  countryKey: string = REFERENCE_COUNTRY_KEY,
  now: Date = new Date(),
  lang: FlyerLang = 'fr',
): FlyerData {
  const known = COUNTRIES.some((c) => c.key === countryKey) ? countryKey : REFERENCE_COUNTRY_KEY;
  const meta = countryMeta(known);
  const brackets = flyerBrackets(adjustments, lang);
  const pct = countryPercentage(adjustments, known);
  const names = FLYER_TEXT[lang].countries as Record<string, string>;
  return {
    lang,
    country: { key: known, label: names[known] ?? meta.label, iso: meta.iso },
    date: flyerDate(now, lang),
    time: flyerTime(now, lang),
    brackets,
    groups: groupMethods(rate, pct, brackets, lang),
  };
}

/** « Paiement de moins de 400 000 XAF », « Payment of 400,000 to 999,999 XAF ». */
export function smallPaymentTitle(b: FlyerBracket, lang: FlyerLang = 'fr'): string {
  const t = FLYER_TEXT[lang];
  const lower = b.label.charAt(0).toLowerCase() + b.label.slice(1);
  if (lang === 'en') return b.min === 0 ? `${t.payment} ${lower}` : `${t.paymentOf} ${lower.replace(/^from /, '')}`;
  return lower.startsWith('de ') ? `${t.payment} ${lower}` : `${t.paymentOf} ${lower}`;
}

/** « Taux du jour » / « Today's rate ». */
export function flyerTitle(lang: FlyerLang): string {
  return FLYER_TEXT[lang].title;
}

/**
 * Le message WhatsApp qui accompagne le flyer (docs/PHRASES_taux_du_jour.md, § 1),
 * dans la langue du flyer. Pas de site : BONZINI en signature.
 */
export function flyerCaption(data: FlyerData): string {
  const t = FLYER_TEXT[data.lang];
  const n = (v: number) => fmtInt(v, data.lang);
  const day = data.lang === 'fr' ? `${data.date.charAt(0).toLowerCase()}${data.date.slice(1)}` : data.date;
  const line = (g: FlyerGroup, r: number) => `• ${g.label.replace(/ · /g, ', ')}${t.colon} ${n(r)} ¥`;
  const lines = [
    `${t.title} · ${data.country.label} → ${t.china} · ${day} · ${data.time} ${t.zone}`,
    `${t.forAmount} ${n(1_000_000)} XAF${t.supplierGets.replace(/\u00a0/g, ' ')}`,
  ];
  for (const g of data.groups) lines.push(line(g, g.rates[0]));
  data.brackets.slice(1).forEach((b, i) => {
    lines.push('', `${smallPaymentTitle(b, data.lang)}${t.colon}`);
    for (const g of data.groups) lines.push(line(g, g.rates[i + 1]));
  });
  lines.push('', FLYER_BRAND);
  return lines.join('\n');
}

/** Nom de fichier : « taux_du_jour_gabon_2026-09-24.png », « todays_rate_gabon_2026-09-24.png » (date de Guangzhou). */
export function flyerFileName(countryKey: string, ext: 'png' | 'pdf', now: Date = new Date(), lang: FlyerLang = 'fr'): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: FLYER_TIME_ZONE }).format(now);
  return `${lang === 'en' ? 'todays_rate' : 'taux_du_jour'}_${countryKey.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${day}.${ext}`;
}
