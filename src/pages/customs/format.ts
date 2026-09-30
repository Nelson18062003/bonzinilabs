/** Les formats des pages Douane, dans la langue de l'écran. */
import { formatNumber } from '@/lib/formatters';
import { getCurrentLocale } from '@/i18n';
import type { Confidence } from '@/lib/customs/levies';

/**
 * L'espace fine insécable (U+202F) du français devient une insécable
 * ordinaire : Satoshi, la police du site, n'a pas la fine, et le moteur de
 * rendu la synthétise si étroite que « 302 557 » se lisait « 302557 ».
 */
const wide = (s: string) => s.replace(/\u202f/g, '\u00a0');

/** « 302 557 » dans la langue de l'écran, milliers bien séparés. */
export const num = (n: number, decimals = 0) => wide(formatNumber(n, decimals));

/** « 5 746 750 XAF » dans la langue de l'écran. */
export const xaf = (n: number) => `${num(Math.round(n))} XAF`;

/** « 57,5 % » / « 57.5% » */
export const pct = (ratio: number) =>
  wide(new Intl.NumberFormat(getCurrentLocale(), { style: 'percent', maximumFractionDigits: 1 }).format(ratio));

/** Un taux légal en % : « 12,5 % », « 0,95 % », « 0,05 % » — jamais arrondi. */
export const ratePct = (rate: number) =>
  new Intl.NumberFormat(getCurrentLocale(), { style: 'percent', maximumFractionDigits: 3 }).format(rate / 100);

/** Vert : officiel ou vérifié sur une DAU. Ambre : estimé ou à confirmer. */
export const isSure = (c: Confidence) => c === 'officiel' || c === 'observe';

/** « 1er octobre 2026 », « 17 septembre 2029 » — une date AAAA-MM-JJ, dans la langue de l'écran. */
export const longDate = (iso: string, year = true) => {
  const locale = getCurrentLocale();
  const s = new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return locale.startsWith('fr') ? s.replace(/^1 /, '1er ') : s;
};

/** Typographie française : espace insécable avant ? ! : ; » et après « (textes du moteur, écrits avec des espaces simples). */
export const frSpaces = (s: string) => s.replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0');
