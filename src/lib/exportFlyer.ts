// exportFlyer.ts — l'image du flyer « Taux du jour ».
//
// L'image est rasterisée DEPUIS LE DOM du composant RateFlyer (html-to-image)
// puis affichée telle quelle dans le panneau : ce qu'on voit, ce qu'on copie
// et ce qu'on télécharge sont le même fichier, pixel pour pixel. Pas de PDF
// (retiré le 25/09/2026 à la demande du fondateur : « ça ne sert à rien »).
// L'edge function generate-flyer dessine le même flyer pour Mola et Telegram.
import { captureNodePng, triggerDownload } from './nodeImage';
import { flyerFileName } from './rateFlyer';

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

/**
 * Le flyer en fichier PNG (2160×2700). `node` = racine NON transformée du
 * RateFlyer rendu (cf. RateFlyerSheet) ; `countryKey` = pays du flyer
 * (« gabon »), dans le nom du fichier.
 */
export async function flyerPngFile(node: HTMLElement, countryKey: string): Promise<File> {
  await imagesReady(node);
  const dataUrl = await captureNodePng(node, { width: FLYER_W, height: FLYER_H, pixelRatio: PIXEL_RATIO });
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], flyerFileName(countryKey, 'png'), { type: 'image/png' });
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
