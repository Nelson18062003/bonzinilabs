// exportFlyer.ts — téléchargement du flyer « Taux du jour ».
//
// Le fichier est rasterisé DEPUIS LE DOM du composant RateFlyer affiché à
// l'écran (html-to-image) : l'aperçu et le fichier téléchargé sont le même
// rendu, pixel pour pixel — impossible de diverger, aucune dépendance à
// l'état de déploiement serveur. (L'edge function generate-flyer reste le
// chemin de Mola pour l'envoi côté serveur ; à redéployer séparément.)
//
// Téléchargement via anchor click direct — iOS Safari 13+, Android, desktop.
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Taille naturelle du flyer (le nœud capturé doit être non transformé).
export const FLYER_W = 2150;
export const FLYER_H = 2560;

function fileName(ext: string): string {
  return `bonzini_taux_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function triggerDownload(dataUrl: string, name: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// DM Sans (latin/chiffres) + Noto Sans SC (chinois) doivent être chargées
// AVANT la capture, sinon le PNG part avec une police de repli — piège
// classique html-to-image (même garde que l'export Trésorerie).
async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load('700 16px "DM Sans"'),
        document.fonts.load('800 16px "DM Sans"'),
        document.fonts.load('900 16px "DM Sans"'),
        document.fonts.load('700 16px "Noto Sans SC"'),
        document.fonts.load('900 16px "Noto Sans SC"'),
      ]);
      await document.fonts.ready;
    } catch {
      /* best effort */
    }
  }
}

async function capturePng(node: HTMLElement): Promise<string> {
  await ensureFontsReady();
  return toPng(node, {
    width: FLYER_W,
    height: FLYER_H,
    pixelRatio: 1, // le nœud est déjà en taille naturelle 2150×2560
    cacheBust: true,
  });
}

// ── API publique ──────────────────────────────────────────────────────────
// `node` = racine NON transformée du RateFlyer rendu (cf. RateFlyerSheet).

export async function downloadFlyerPNG(node: HTMLElement): Promise<void> {
  triggerDownload(await capturePng(node), fileName('png'));
}

export async function downloadFlyerPDF(node: HTMLElement): Promise<void> {
  const dataUrl = await capturePng(node);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [FLYER_W, FLYER_H] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, FLYER_W, FLYER_H, undefined, 'FAST');
  pdf.save(fileName('pdf'));
}
