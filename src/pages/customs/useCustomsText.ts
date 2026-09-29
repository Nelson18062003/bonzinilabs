/**
 * Les textes du moteur dans la langue de l'écran. Le moteur écrit en français,
 * la langue des textes de loi ; l'anglais et le chinois viennent du namespace
 * `customs`, avec le français en valeur par défaut.
 */
import { useTranslation } from 'react-i18next';
import type { LiquidationLine, SimNote } from '@/lib/customs/engine';
import type { Finding } from '@/lib/customs/audit';
import { xaf } from './format';

/** Le texte d'une note dans la langue de l'écran ; le français fait foi. */
export function useNoteText() {
  const { t, i18n } = useTranslation('customs');
  const fr = (i18n.language ?? 'fr').startsWith('fr');
  return (n: SimNote) => {
    if (fr) return n.fr;
    const params = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, typeof v === 'number' && k !== 'rate' ? xaf(v).replace(' XAF', '') : v]));
    return t(`notes.${n.id}`, { ...params, defaultValue: n.fr });
  };
}

export function useLevyLabel() {
  const { t, i18n } = useTranslation('customs');
  const fr = (i18n.language ?? 'fr').startsWith('fr');
  return (l: LiquidationLine) => (fr ? l.label : t(`levy.${l.code}`, { defaultValue: l.label }));
}

/** Le texte d'un constat d'audit dans la langue de l'écran ; le français (du moteur) fait foi. */
export function useFindingText() {
  const { t, i18n } = useTranslation('customs');
  const fr = (i18n.language ?? 'fr').startsWith('fr');
  return (f: Finding) => {
    if (fr) return f.fr;
    const params = Object.fromEntries(Object.entries(f.params).map(([k, v]) =>
      [k, typeof v === 'number' && !['applied', 'official', 'n'].includes(k) ? xaf(v) : v]));
    const variant = f.kind === 'classification' || f.kind === 'used_goods' ? `${f.kind}_${f.route}` : f.kind;
    return t(`audit.f.${variant}`, { ...params, defaultValue: t(`audit.f.${f.kind}`, { ...params, defaultValue: f.fr }) });
  };
}
