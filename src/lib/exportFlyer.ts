// exportFlyer.ts — téléchargement du flyer « Taux du jour ».
//
// Le fichier est rasterisé DEPUIS LE DOM du composant RateFlyer affiché à
// l'écran (html-to-image) : l'aperçu et le fichier téléchargé sont le même
// rendu, pixel pour pixel — impossible de diverger, aucune dépendance à
// l'état de déploiement serveur. (L'edge function generate-flyer reste le
// chemin de Mola pour l'envoi côté serveur ; à redéployer séparément.)
//
// Téléchargement via anchor click direct — iOS Safari 13+, Android, desktop.
import { captureNodePng, triggerDownload } from './nodeImage';
import { jsPDF } from 'jspdf';

// Taille naturelle du flyer (le nœud capturé doit être non transformé).
export const FLYER_W = 2150;
export const FLYER_H = 2560;

function fileName(ext: string): string {
  return `bonzini_taux_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

async function capturePng(node: HTMLElement): Promise<string> {
  // pixelRatio 1 : le nœud est déjà rendu en taille naturelle 2150×2560.
  return captureNodePng(node, { width: FLYER_W, height: FLYER_H, pixelRatio: 1 });
}

// ── API publique ──────────────────────────────────────────────────────────
// `node` = racine NON transformée du RateFlyer rendu (cf. RateFlyerSheet).

export async function downloadFlyerPNG(node: HTMLElement): Promise<void> {
  triggerDownload(await capturePng(node), fileName('png'));
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

export async function downloadFlyerPDF(node: HTMLElement): Promise<void> {
  const dataUrl = await capturePng(node);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [FLYER_W, FLYER_H] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, FLYER_W, FLYER_H, undefined, 'FAST');
  pdf.save(fileName('pdf'));
}
