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
//   · au seul nom de NORTON GAUSS BONZINI SARL : ni « Bonzini », ni site, ni
//     WhatsApp, ni heure de Guangzhou.
// Mêmes calculs que la RPC calculate_final_rate et que le paiement :
// base × (1 + pays) × (1 + tranche), arrondi comme calculateFinalRate puis à
// l'entier. Tout vient de la publication active et de rate_adjustments : si
// l'équipe change une tranche dans Réglages, le flyer suit.
// ============================================================
import { COUNTRIES } from '@/types/rates';
import type { DailyRate, PaymentMethodKey, RateAdjustment } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from './rateCalculation';
import { countryMeta, REFERENCE_COUNTRY_KEY } from './countryRates';
import { LEGAL_NAME } from './companyIdentity';

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
  country: { key: string; label: string; iso: string | null };
  /** Jour affiché : « Jeudi 24 septembre 2026 ». */
  date: string;
  /** Tranches, de la meilleure (« 400 000 XAF et plus ») aux petits paiements. */
  brackets: FlyerBracket[];
  groups: FlyerGroup[];
}

function fmtInt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export { fmtInt as formatFlyerNumber };

/**
 * Les tranches de rate_adjustments (type tier), de la plus haute à la plus
 * basse. Deux tranches voisines au même pourcentage n'en font qu'une : t2 et
 * t3 à 0 % donnent « 400 000 XAF et plus ». Bornes : celles du calcul
 * (1 000 000 et 400 000 XAF, cf. getTierKey).
 */
export function flyerBrackets(adjustments: readonly RateAdjustment[]): FlyerBracket[] {
  const pctOf = (key: string) => {
    const t = adjustments.find((a) => a.type === 'tier' && a.key === key);
    return t && !t.is_reference ? Number(t.percentage) || 0 : 0;
  };
  const asc = [
    { min: 0, pct: pctOf('t1') },
    { min: 400_000, pct: pctOf('t2') },
    { min: 1_000_000, pct: pctOf('t3') },
  ];
  const merged: { min: number; pct: number }[] = [];
  for (const t of asc) {
    const last = merged[merged.length - 1];
    if (!last || last.pct !== t.pct) merged.push({ ...t });
  }
  return merged
    .map((b, i) => {
      const next = merged[i + 1];
      const max = next ? next.min - 1 : null;
      let label: string;
      if (merged.length === 1) label = 'Tous montants';
      else if (max === null) label = `${fmtInt(b.min)} XAF et plus`;
      else if (b.min === 0) label = `Moins de ${fmtInt(next!.min)} XAF`;
      else label = `De ${fmtInt(b.min)} à ${fmtInt(max)} XAF`;
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
function groupMethods(rate: DailyRate, countryPct: number, brackets: FlyerBracket[]): FlyerGroup[] {
  const groups: FlyerGroup[] = [];
  for (const m of FLYER_METHODS) {
    const rates = brackets.map((b) => bracketRate(getBaseRate(rate, m.key), countryPct, b));
    const same = m.key === 'cash' ? undefined : groups.find((g) => !g.keys.includes('cash') && g.rates.every((r, i) => r === rates[i]));
    if (same) same.keys.push(m.key);
    else groups.push({ keys: [m.key], label: m.label, rates });
  }
  for (const g of groups) g.label = g.keys.map((k) => FLYER_METHODS.find((m) => m.key === k)!.label).join(' · ');
  return groups;
}

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « Jeudi 24 septembre 2026 », jour de Douala. */
export function flyerDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Douala', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get('year'), m = get('month'), d = get('day');
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${FR_DAYS[wd]} ${d} ${FR_MONTHS[m - 1]} ${y}`;
}

/** Tout ce que le flyer d'un pays affiche. Pays inconnu : la référence (Cameroun). */
export function buildFlyerData(
  rate: DailyRate,
  adjustments: readonly RateAdjustment[],
  countryKey: string = REFERENCE_COUNTRY_KEY,
  now: Date = new Date(),
): FlyerData {
  const known = COUNTRIES.some((c) => c.key === countryKey) ? countryKey : REFERENCE_COUNTRY_KEY;
  const meta = countryMeta(known);
  const brackets = flyerBrackets(adjustments);
  const pct = countryPercentage(adjustments, known);
  return {
    country: { key: known, label: meta.label, iso: meta.iso },
    date: flyerDate(now),
    brackets,
    groups: groupMethods(rate, pct, brackets),
  };
}

/** « Paiement de moins de 400 000 XAF », « Paiement de 400 000 à 999 999 XAF ». */
export function smallPaymentTitle(b: FlyerBracket): string {
  const lower = b.label.charAt(0).toLowerCase() + b.label.slice(1);
  return lower.startsWith('de ') ? `Paiement ${lower}` : `Paiement de ${lower}`;
}

/**
 * Le message WhatsApp qui accompagne le flyer (docs/PHRASES_taux_du_jour.md, § 1).
 * Pas de « Bonzini », pas de site : la raison sociale en signature.
 */
export function flyerCaption(data: FlyerData): string {
  const small = data.brackets.slice(1);
  const lines = [`Taux du jour · ${data.country.label} · ${data.date.charAt(0).toLowerCase()}${data.date.slice(1)}`, 'Pour 1 000 000 XAF, votre fournisseur reçoit :'];
  for (const g of data.groups) lines.push(`• ${g.label.replace(/ · /g, ', ')} : ${fmtInt(g.rates[0])} ¥`);
  small.forEach((b, i) => {
    lines.push('', `${smallPaymentTitle(b)} :`);
    for (const g of data.groups) lines.push(`• ${g.label.replace(/ · /g, ', ')} : ${fmtInt(g.rates[i + 1])} ¥`);
  });
  lines.push('', 'Taux valables ce jour, confirmés au moment du paiement.', LEGAL_NAME);
  return lines.join('\n');
}

/** Nom de fichier : « taux_du_jour_gabon_2026-09-24.png » (date de Douala). */
export function flyerFileName(countryKey: string, ext: 'png' | 'pdf', now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(now);
  return `taux_du_jour_${countryKey.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${day}.${ext}`;
}
