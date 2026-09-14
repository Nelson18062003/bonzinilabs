// ============================================================
// Locale date-fns de la langue d'interface, en synchrone (les trois
// locales sont petites ; l'import différé de `getDateFnsLocale` dans
// src/i18n ne convient pas à un `format()` appelé pendant le rendu).
// Un `locale: fr` codé en dur affichait « 17 août » aux clients en
// anglais ou en chinois.
// ============================================================
import { fr, enUS, zhCN } from 'date-fns/locale';
import i18n from '@/i18n';

export function dateLocale(lang: string | undefined = i18n.language) {
  const l = (lang ?? 'fr').slice(0, 2);
  if (l === 'en') return enUS;
  if (l === 'zh') return zhCN;
  return fr;
}
