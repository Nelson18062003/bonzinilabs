/**
 * Les codes du tarif, sous toutes leurs écritures.
 *
 * Un même produit s'écrit de quatre façons selon le document qu'on a en main :
 *   - SH à 6 chiffres (OMD)          8701.93          le simulateur, la proforma
 *   - TEC CEMAC à 8 chiffres          8701.93.00
 *   - CGI à 11 chiffres (annexes)     870190 11 000    les listes d'accises et d'exonérations
 *   - CAMCIS à 12 chiffres (la DAU)   870193.00.1000   ce que la douane liquide
 * On compare toujours sur les chiffres seuls, complétés à droite par des zéros :
 * le CGI écrit « 870190 11 000 » là où CAMCIS écrit « 870190.11.0000 », et c'est
 * la même ligne (docs/cargo/dossiers/2026-08_CTR-MRSU9909331_BL-271875389/code-sh-tracteur.md).
 */

/** Les chiffres seuls : « 8701.90.11 » → « 87019011 ». */
export function hsDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Un code plausible : 2 à 12 chiffres, sans rien d'autre que des séparateurs. */
export function isHsCode(input: string): boolean {
  const d = hsDigits(input);
  return d.length >= 2 && d.length <= 12 && /^[\d\s.-]+$/.test(input.trim());
}

/** Complète à droite jusqu'à 12 chiffres (le format CAMCIS). */
export function pad12(input: string, fill = '0'): string {
  const d = hsDigits(input).slice(0, 12);
  return d + fill.repeat(12 - d.length);
}

/** La sous-position SH à 6 chiffres, ou null si le code est plus court. */
export function hs6(input: string): string | null {
  const d = hsDigits(input);
  return d.length >= 6 ? d.slice(0, 6) : null;
}

/**
 * Affichage :
 *   2 → « 87 » · 4 → « 87.01 » · 6 → « 8701.93 » · 8 → « 8701.93.00 »
 *   11 (CGI) → « 870190 11 000 » · 12 (CAMCIS) → « 870193.00.1000 »
 * Les longueurs 12 et 11 gardent l'écriture de leur document, pour que le client
 * retrouve à l'écran exactement ce qu'il lit sur sa DAU ou dans le CGI.
 */
export function formatHs(input: string): string {
  const d = hsDigits(input);
  switch (d.length) {
    case 2: return d;
    case 3: return `${d.slice(0, 2)}.${d.slice(2)}`;
    case 4: return `${d.slice(0, 2)}.${d.slice(2)}`;
    case 5: case 6: return `${d.slice(0, 4)}.${d.slice(4)}`;
    case 7: case 8: return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
    case 11: return `${d.slice(0, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
    case 12: return `${d.slice(0, 6)}.${d.slice(6, 8)}.${d.slice(8)}`;
    default: return d.length > 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8)}` : d;
  }
}

/**
 * Une entrée de liste du CGI ou de la loi de finances : un préfixe (« 6309 »,
 * « 481810 »), ou une plage « 340119-340290 » (bornes incluses, au niveau de
 * précision écrit dans le texte).
 */
export type CodeSpec = string;

/**
 * Le code donné relève-t-il de la spécification ?
 *   'yes'   — oui, quel que soit le détail national (le code est au moins aussi
 *             précis que la spécification et il est dedans) ;
 *   'maybe' — la spécification descend plus bas que le code connu : ça dépend de la
 *             ligne nationale (ex. on connaît 870323, le texte vise 8703239100) ;
 *   'no'    — non.
 */
export function matchSpec(code: string, spec: CodeSpec): 'yes' | 'maybe' | 'no' {
  const c = hsDigits(code);
  if (!c) return 'no';
  const [fromRaw, toRaw] = spec.split('-');
  if (toRaw === undefined) {
    const s = hsDigits(fromRaw);
    if (c.length >= s.length) return c.startsWith(s) ? 'yes' : 'no';
    return s.startsWith(c) ? 'maybe' : 'no';
  }
  const from = hsDigits(fromRaw), to = hsDigits(toRaw);
  const precision = Math.max(from.length, to.length);
  const lo = pad12(from, '0'), hi = pad12(to, '9');
  // Le code couvre l'intervalle [code…0, code…9] : dedans, dehors, ou à cheval.
  const cLo = pad12(c, '0'), cHi = pad12(c, '9');
  if (cHi < lo || cLo > hi) return 'no';
  if (cLo >= lo && cHi <= hi) return 'yes';
  return c.length >= precision ? 'no' : 'maybe';
}

/** Le meilleur résultat sur une liste de spécifications. */
export function matchAny(code: string, specs: readonly CodeSpec[]): 'yes' | 'maybe' | 'no' {
  let best: 'yes' | 'maybe' | 'no' = 'no';
  for (const s of specs) {
    const m = matchSpec(code, s);
    if (m === 'yes') return 'yes';
    if (m === 'maybe') best = 'maybe';
  }
  return best;
}
