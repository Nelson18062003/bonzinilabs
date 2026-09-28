// exportFlyer.ts — l'image du flyer « Taux du jour ».
//
// L'image est rasterisée DEPUIS LE DOM du composant RateFlyer (html-to-image)
// puis affichée telle quelle dans le panneau : ce qu'on voit, ce qu'on copie
// et ce qu'on télécharge sont le même fichier, pixel pour pixel. Pas de PDF
// (retiré le 25/09/2026 à la demande du fondateur : « ça ne sert à rien »).
// L'edge function generate-flyer dessine le même flyer pour Mola et Telegram.
import { captureNodePng, triggerDownload } from './nodeImage';
import { flyerFileName, type FlyerLang } from './rateFlyer';
import { flyerFontsLoaded, loadFlyerFonts } from './flyerFonts';

// Taille naturelle du flyer (le nœud capturé doit être non transformé),
// exportée au double : 2160×2700, net sur WhatsApp.
export const FLYER_W = 1080;
export const FLYER_H = 1350;
const PIXEL_RATIO = 2;

/** Attend que les images du nœud (le drapeau) soient chargées : sinon elles manqueraient à la capture. */
async function imagesReady(node: HTMLElement): Promise<void> {
  await Promise.all([...node.querySelectorAll('img')].map((img) =>
    img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => undefined)));
}

/** Deux images : le navigateur a recalculé la mise en page avec la police chargée. */
const nextFrames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Le flyer en fichier PNG (2160×2700). `node` = racine NON transformée du
 * RateFlyer rendu (cf. RateFlyerSheet) ; `countryKey` = pays du flyer
 * (« gabon ») et `lang` sa langue, dans le nom du fichier.
 *
 * La police est celle de lib/flyerFonts.ts, chargée dans la page ET remise à
 * la capture : l'image a toujours la mise en page de l'écran (voir le bug du
 * « flyer cassé » décrit là-bas). Police absente = erreur, jamais une image
 * dans une autre police.
 */
export async function flyerPngFile(node: HTMLElement, countryKey: string, lang: FlyerLang = 'fr'): Promise<File> {
  const fontEmbedCSS = await loadFlyerFonts();
  await imagesReady(node);
  await nextFrames();
  if (!flyerFontsLoaded()) throw new Error('Police du flyer indisponible');
  const dataUrl = await captureNodePng(node, { width: FLYER_W, height: FLYER_H, pixelRatio: PIXEL_RATIO, fontEmbedCSS, webkitWarmup: true });
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], flyerFileName(countryKey, 'png', new Date(), lang), { type: 'image/png' });
}

// Capture générique d'un nœud NON transformé en taille naturelle — même
// pipeline (fonts prêtes, toPng) que le flyer. Utilisé par la cotation du
// simulateur (RateQuoteCard).
export async function downloadNodePNG(
  node: HTMLElement,
  width: number,
  height: number,
  name: string,
): Promise<void> {
  triggerDownload(await captureNodePng(node, { width, height, pixelRatio: 1 }), name);
}
