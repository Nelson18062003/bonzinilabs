// ============================================================
// CAPTURE D'UN NŒUD DU DOM EN PNG — le pipeline, en un seul endroit.
//
// Trois fonctionnalités rasterisaient déjà un bloc affiché à l'écran (le
// flyer des taux, la cotation du simulateur, le tableau de bord Trésorerie),
// chacune avec sa copie de la même précaution. Une quatrième arrivait
// (l'instruction de paiement) : le pipeline vit désormais ici, et les
// appelants n'ont plus qu'à dire QUOI capturer.
//
// Deux précautions y vivent, et ni l'une ni l'autre n'est cosmétique.
//
// 1. LES POLICES DOIVENT ÊTRE CHARGÉES. `html-to-image` peint avec les
//    polices disponibles à l'instant de la capture ; si la fonte n'est pas
//    prête, le PNG part en police de repli — et sur un document bilingue,
//    « 付款金额 » devient une rangée de rectangles. Le bug est invisible à
//    l'écran : seul le fichier est faux.
//
// 2. LA CSS DES POLICES N'EST RÉCUPÉRÉE QU'UNE FOIS. La capture se fait dans
//    un `foreignObject` SVG, qui n'a pas accès aux polices du document :
//    `html-to-image` doit donc réécrire les `@font-face` en base64 DANS le
//    SVG. Laissé à lui-même, il refait ce travail à CHAQUE clic — il retélé-
//    charge la feuille Google Fonts et tous les fichiers qu'elle référence,
//    dont les dizaines de sous-ensembles Unicode de Noto Sans SC (une police
//    idéographique se compte en mégaoctets). Mesuré ici, avec l'endpoint
//    injoignable : 12,6 s par capture, sans le moindre retour à l'écran.
//    On la calcule donc UNE fois par session et on la repasse à chaque appel
//    (`fontEmbedCSS` court-circuite toute la récupération) ; en cas d'échec
//    ou de lenteur, on capture sans elle plutôt que de faire attendre.
// ============================================================
import { toPng, getFontEmbedCSS } from 'html-to-image';

/** Les deux familles du produit : DM Sans (latin) et Noto Sans SC (idéogrammes). */
const FONT_SPECS = [
  '400 16px "DM Sans"',
  '700 16px "DM Sans"',
  '800 16px "DM Sans"',
  '900 16px "DM Sans"',
  '400 16px "Noto Sans SC"',
  '700 16px "Noto Sans SC"',
  '900 16px "Noto Sans SC"',
];

/**
 * Attend que les polices du produit soient réellement peintes.
 *
 * Au pire (API absente, chargement en échec) on capture quand même : une
 * image dans une police de repli vaut mieux que pas d'image du tout.
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    /* best effort */
  }
}

/**
 * La CSS des `@font-face`, par JEU DE POLICES employé.
 *
 * La clé n'est pas le nœud : `html-to-image` ne retient que les `@font-face`
 * des familles RÉELLEMENT utilisées dans le sous-arbre capturé. Deux blocs
 * qui emploient les mêmes familles ont donc droit à la même CSS — mais un
 * bloc qui en emploierait une de plus doit refaire la collecte, sinon sa
 * police manquerait à l'image. D'où une clé calculée sur les familles.
 */
const fontEmbedCssByFamilies = new Map<string, Promise<string>>();

/** Au-delà, on capture sans polices embarquées : un export lent est un export
 *  qu'on croit cassé. */
const FONT_CSS_TIMEOUT_MS = 5000;

/** Les familles employées dans le sous-arbre — la même lecture que fait
 *  `html-to-image` pour filtrer les `@font-face`. */
function usedFontFamilies(node: HTMLElement): string {
  const families = new Set<string>();
  const walk = (el: HTMLElement) => {
    const declared = el.style.fontFamily || getComputedStyle(el).fontFamily;
    for (const font of declared.split(',')) families.add(font.trim().replace(/["']/g, ''));
    for (const child of Array.from(el.children)) if (child instanceof HTMLElement) walk(child);
  };
  walk(node);
  return [...families].sort().join('|');
}

function loadFontEmbedCss(node: HTMLElement): Promise<string> {
  const key = usedFontFamilies(node);
  let pending = fontEmbedCssByFamilies.get(key);
  if (!pending) {
    // Le coût est RÉSEAU (la feuille Google Fonts et tous ses fichiers), pas
    // processeur : un délai maximum a donc un sens, et rien ne gèle pendant.
    pending = Promise.race([
      getFontEmbedCSS(node),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), FONT_CSS_TIMEOUT_MS)),
    ]).catch(() => '');
    fontEmbedCssByFamilies.set(key, pending);
  }
  return pending;
}

/**
 * Lance la collecte SANS attendre — à appeler quand la fenêtre s'ouvre.
 *
 * Le coût est réseau, pas processeur (vérifié : un minuteur de 100 ms se
 * déclenche à l'heure pendant la collecte), donc rien ne gèle. L'opérateur
 * lit la carte pendant ce temps, et son clic sur « Copier l'image » tombe
 * sur un cache chaud au lieu d'attendre plusieurs secondes devant un
 * bouton qui tourne.
 */
export function prewarmFontEmbedCss(node: HTMLElement): void {
  void loadFontEmbedCss(node).catch(() => undefined);
}

/** Repart de zéro — pour les tests, et si l'on venait à changer les polices. */
export function resetFontEmbedCache(): void {
  fontEmbedCssByFamilies.clear();
}

export interface CaptureOptions {
  /** Taille naturelle du nœud, quand il doit être capturé hors de son rendu écran. */
  width?: number;
  height?: number;
  /** 1 pour un nœud déjà en taille naturelle, 2–3 pour densifier un bloc d'écran. */
  pixelRatio?: number;
  backgroundColor?: string;
}

/** Le nœud tel qu'il est à l'écran, en PNG (data URL). */
export async function captureNodePng(node: HTMLElement, options: CaptureOptions = {}): Promise<string> {
  await ensureFontsReady();
  const fontEmbedCSS = await loadFontEmbedCss(node);
  return toPng(node, { cacheBust: true, fontEmbedCSS, ...options });
}

/** Déclenche un téléchargement de navigateur pour une data URL. */
export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Ce qui a réellement eu lieu — l'appelant en tire son message. */
export type CopyOutcome = 'copied' | 'downloaded';

/**
 * Le nœud dans le presse-papiers, en image.
 *
 * Repli sur un téléchargement quand le navigateur n'expose pas
 * `ClipboardItem` (Firefox jusqu'à récemment, WebView Android) : l'image
 * existe alors quand même, elle passe par le disque. Sans ce repli, le clic
 * ne produirait rien de visible — le pire des retours.
 */
export async function copyNodePng(
  node: HTMLElement,
  filename: string,
  options: CaptureOptions = {},
): Promise<CopyOutcome> {
  const dataUrl = await captureNodePng(node, options);
  const canWrite = typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.clipboard?.write;
  if (canWrite) {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  }
  triggerDownload(dataUrl, filename);
  return 'downloaded';
}
