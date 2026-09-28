// ============================================================
// LA LANGUE DES DOCUMENTS BILINGUES (coordonnées bancaires, Mobile Money).
//
// Les textes de ces documents sont des paires { fr, en } : le français en
// grand, l'anglais juste dessous. Depuis le 28/09/2026 on choisit :
//   · 'bi' — les deux (comme avant) ;
//   · 'fr' / 'en' — une seule langue.
// Pour une seule langue, chaque paire reçoit le MÊME texte des deux côtés :
// la ligne principale affiche la langue choisie, et toute ligne secondaire
// n'est dessinée que si elle diffère de la principale (règle des modèles :
// `x.en !== x.fr`). Aucune mise en page à dupliquer.
// ============================================================

export type DocLang = 'bi' | 'fr' | 'en';
export const DOC_LANGS: readonly DocLang[] = ['fr', 'en', 'bi'];

function isPair(v: unknown): v is { fr: string; en: string } {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && typeof (v as { fr?: unknown }).fr === 'string' && typeof (v as { en?: unknown }).en === 'string';
}

/** Tout l'objet, chaque paire { fr, en } réduite à la langue choisie (sauf 'bi'). */
export function localizeBi<T>(value: T, lang: DocLang): T {
  if (lang === 'bi') return value;
  const walk = (v: unknown): unknown => {
    if (isPair(v)) {
      const text = v[lang];
      return { ...(v as object), fr: text, en: text };
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

/** Le même objet, ses textes fixés (`as const`) élargis en `string` : une langue en remplace une autre. */
export type LooseText<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly LooseText<U>[]
    : T extends object
      ? { [K in keyof T]: LooseText<T[K]> }
      : T;

/** Le nom du fichier selon la langue : « rib-uba.pdf » (les deux), « rib-uba-en.pdf ». */
export function withDocLang(filename: string, lang: DocLang): string {
  return lang === 'bi' ? filename : filename.replace(/(\.[a-z]+)$/, `-${lang}$1`);
}
