// Prise d'effet d'une publication de taux — logique PARTAGÉE entre le mobile
// (RateSetTab) et le desktop (RatePublishCard), pour qu'une correction serve
// les deux copies.
//
// Piège corrigé : `new Date('yyyy-MM-dd')` interprète la chaîne en UTC
// minuit ; dans un fuseau négatif, la date locale retombe la VEILLE et les
// taux se retrouvaient antidatés d'un jour. On construit donc la date en
// heure LOCALE à partir des composantes.

export type RateDateOption = 'now' | 'today' | 'yesterday' | 'custom';

export const RATE_DATE_OPTIONS: { key: RateDateOption; label: string }[] = [
  { key: 'now', label: 'Maintenant' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'custom', label: 'Autre…' },
];

export function rateEffectiveAt(
  option: RateDateOption,
  customDate: string,
  customHour: number,
  customMin: number,
): string {
  const now = new Date();
  if (option === 'now') return now.toISOString();
  if (option === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (option === 'yesterday') {
    now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const [y, m, d] = customDate.split('-').map(Number);
  const local = new Date(y || now.getFullYear(), (m || 1) - 1, d || 1, customHour, customMin, 0, 0);
  return local.toISOString();
}
