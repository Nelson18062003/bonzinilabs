/** Les formats des pages Douane, dans la langue de l'écran. */
import { formatNumber } from '@/lib/formatters';
import { getCurrentLocale } from '@/i18n';
import type { Confidence } from '@/lib/customs/levies';

/** « 5 746 750 XAF » dans la langue de l'écran. */
export const xaf = (n: number) => `${formatNumber(Math.round(n))} XAF`;

/** « 57,5 % » / « 57.5% » */
export const pct = (ratio: number) =>
  new Intl.NumberFormat(getCurrentLocale(), { style: 'percent', maximumFractionDigits: 1 }).format(ratio);

/** Un taux légal en % : « 12,5 % », « 0,95 % », « 0,05 % » — jamais arrondi. */
export const ratePct = (rate: number) =>
  new Intl.NumberFormat(getCurrentLocale(), { style: 'percent', maximumFractionDigits: 3 }).format(rate / 100);

/** Vert : officiel ou vérifié sur une DAU. Ambre : estimé ou à confirmer. */
export const isSure = (c: Confidence) => c === 'officiel' || c === 'observe';
