// ============================================================
// LES JETONS DES FICHES CLIENT (Mobile Money, coordonnées bancaires) : couleurs,
// rayons et petites fonctions de mise en page, sans JSX. Les composants
// partagés sont dans guideKit.tsx.
//   · couleurs : encre, textes secondaires foncés pour les yeux fatigués,
//     couleurs pleines pré-mélangées sur fond sombre (react-pdf rend mal le
//     rgba des bordures) ;
//   · étiquettes bilingues, coupures de ligne choisies, titres ajustés,
//     contour du ticket de preuve.
// ============================================================
import { colors } from './styles';

export const INK = colors.violetDark;
export const WHITE = colors.white;
export const CALL_GREEN = '#1faa59';
export const R = { box: 20, inner: 12, cell: 6 };
/** Textes secondaires : plus foncés que le gris habituel, pour les yeux fatigués. */
export const MUTED = '#5f5775';
/** Sur fond sombre : couleurs pleines pré-mélangées. */
export const PANEL = '#251a37';
export const LINE_ON_INK = '#362d42';
export const LINE_ON_PANEL = '#3a2f4b';
export const OR_RING = '#5f586a';
export const ON_INK_SOFT = '#d6d0e0';
/** Le violet et l'orange foncés, pour écrire sur blanc (contraste AA). */
export const VIOLET_DEEP = '#7b2fd0';
export const ORANGE_DEEP = '#c53d06';

/** Paysage : la colonne de couleur (largeur, marge) et la marge de la zone de données. */
export const SIDE_W = 280;
export const SIDE_PAD = 24;
export const AREA_PAD = 30;

/** La couleur d'une partie, son numéro, et la couleur du français et de l'anglais posés dessus. */
export interface Tone { n: string; color: string; fr: string; en: string }

/** Un texte dans les deux langues de nos clients. */
export interface BiText { fr: string; en: string }

/** « NUMÉRO · NUMBER » : une étiquette dans les deux langues, sur une ligne. */
export function biLabel(b: BiText): string {
  return b.fr.toLowerCase() === b.en.toLowerCase() ? b.fr : `${b.fr} · ${b.en}`;
}

/**
 * Coupures choisies pour une colonne étroite : une phrase trop longue pour une
 * ligne se coupe en deux lignes équilibrées — après « ? » ou à la virgule la
 * plus centrale s'il y en a, sinon à l'espace le plus central — et « Mobile
 * Money » ne se sépare jamais.
 */
export function balanced(text: string, size: number, room: number, em = 0.54): string {
  const keep = text.replace(/Mobile Money/g, 'Mobile Money');
  if (keep.length * size * em <= room) return keep;
  const mid = keep.length / 2;
  const pick = (re: RegExp) => {
    let best = -1;
    for (const m of keep.matchAll(re)) {
      const at = (m.index ?? 0) + m[0].length - 1;
      if (best < 0 || Math.abs(at - mid) < Math.abs(best - mid)) best = at;
    }
    return best;
  };
  const at = [pick(/\? /g), pick(/, /g), pick(/ /g)].find((i) => i > 0) ?? -1;
  return at > 0 ? `${keep.slice(0, at)}\n${keep.slice(at + 1)}` : keep;
}

/** Un titre en capitales ajusté à la largeur disponible (jamais au-delà de `max`). */
export function fitSize(word: string, max: number, room: number, em: number): number {
  return Math.min(max, Math.floor((room / (word.length * em)) * 10) / 10);
}

/** Le contour d'un ticket : coins arrondis en haut, dents de scie en bas. */
export function ticketPath(w: number, h: number, tooth: number): string {
  const r = R.box;
  const n = Math.round(w / 14);
  const tw = w / n;
  let d = `M0 ${r} Q0 0 ${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - tooth}`;
  for (let i = 0; i < n; i++) {
    const x = w - i * tw;
    d += ` L${(x - tw / 2).toFixed(2)} ${h} L${(x - tw).toFixed(2)} ${h - tooth}`;
  }
  return `${d} Z`;
}

/**
 * Les chasses de DM Sans Black (900), en em, mesurées dans la police servie
 * (public/fonts) : de quoi calculer au point près la largeur d'un IBAN, d'un
 * SWIFT ou d'un nom, et lui donner la plus grande taille qui tient sur une
 * ligne. Les graisses 700–800 sont à 1–2 % près.
 */
const BLACK_EM: Record<string, number> = {
  0: 0.71, 1: 0.379, 2: 0.578, 3: 0.607, 4: 0.663, 5: 0.625, 6: 0.636, 7: 0.537, 8: 0.64, 9: 0.636,
  A: 0.722, B: 0.648, C: 0.744, D: 0.713, E: 0.588, F: 0.563, G: 0.783, H: 0.723, I: 0.284, J: 0.553, K: 0.674, L: 0.568, M: 0.899,
  N: 0.741, O: 0.786, P: 0.624, Q: 0.786, R: 0.641, S: 0.611, T: 0.608, U: 0.693, V: 0.717, W: 1.033, X: 0.689, Y: 0.651, Z: 0.588,
  a: 0.598, b: 0.663, c: 0.617, d: 0.663, e: 0.612, f: 0.38, g: 0.607, h: 0.63, i: 0.284, j: 0.283, k: 0.6, l: 0.28, m: 0.955,
  n: 0.629, o: 0.615, p: 0.663, q: 0.663, r: 0.42, s: 0.54, t: 0.445, u: 0.629, v: 0.577, w: 0.837, x: 0.593, y: 0.619, z: 0.5,
  é: 0.612, è: 0.612, ê: 0.612, à: 0.598, ô: 0.615, ç: 0.617, É: 0.588, È: 0.588, Ô: 0.786,
  ' ': 0.226, '°': 0.369, '·': 0.268, '-': 0.586, '+': 0.588, "'": 0.208, '/': 0.437, '.': 0.268, ',': 0.264, ':': 0.27, '?': 0.543,
};

/** Largeur d'un texte en DM Sans Black, en em (espacement des lettres non compris) ; `upper` pour un texte mis en capitales. */
export function blackEm(text: string, upper = false): number {
  let em = 0;
  for (const ch of upper ? text.toUpperCase() : text) em += BLACK_EM[ch] ?? 0.75;
  return em;
}

/** La plus grande taille (au dixième de point) qui fait tenir `text` dans `room`, sans dépasser `max`. */
export function fitBlack(text: string, max: number, room: number, spacing = 0, upper = false): number {
  const n = [...text].length;
  return Math.min(max, Math.floor(((room - spacing * n) / blackEm(text, upper)) * 10) / 10);
}
