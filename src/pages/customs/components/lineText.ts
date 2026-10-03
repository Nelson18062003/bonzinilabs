/**
 * Écrire une ligne du tarif pour un humain. Beaucoup de sous-positions ne se
 * lisent qu'avec leur position (« Autres », « D'une puissance > 75 kW ») : on
 * les préfixe alors du libellé de la position.
 */
import type { Nomenclature, TariffLine } from '@/lib/customs/nomenclature';

const FRAGMENT = /^(autres?|other|d['’]une?|de |du |des |en |pour |à |avec |sans |of |for |with |n\.d\.a|n\.e\.c|-)/i;

export function lineTitle(nom: Nomenclature, line: TariffLine, lang: 'fr' | 'en' | 'zh'): string {
  const own = lang === 'en' ? line.en : line.fr;
  const heading = nom.headings.get(line.code.slice(0, 4));
  const headText = heading ? (lang === 'en' ? heading.en : heading.fr) : '';
  if (headText && (own.length < 28 || FRAGMENT.test(own))) return `${headText} — ${own}`;
  return own;
}

/** « 30 % », « 5–20 % », « — ». */
export function rateLabel(line: TariffLine): string {
  if (line.rateMax == null) return '—';
  if (line.rateMin != null && line.rateMin !== line.rateMax) return `${line.rateMin}–${line.rateMax} %`;
  return `${line.rateMax} %`;
}
