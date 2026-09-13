// ============================================================
// PARTAGE DE L'ÉTIQUETTE COLIS — image (WeChat, WhatsApp) ou PDF (impression).
//
// Le client envoie l'étiquette à son fournisseur comme il envoie tout le
// reste : en pièce jointe dans une conversation. Le partage natif
// (navigator.share avec un fichier) est donc le premier chemin ; quand le
// navigateur ne l'offre pas (bureau, WebView ancienne), on télécharge.
// ============================================================
import { jsPDF } from 'jspdf';
import { captureNodePng, triggerDownload } from '@/lib/nodeImage';
import { LABEL_W, LABEL_H } from './ShippingLabel';

function fileName(code: string, ext: 'png' | 'pdf') {
  return `bonzini-etiquette-${code}.${ext}`;
}

async function labelPng(node: HTMLElement): Promise<string> {
  return captureNodePng(node, { width: LABEL_W, height: LABEL_H, pixelRatio: 2, backgroundColor: '#FFFFFF' });
}

export type ShareOutcome = 'shared' | 'downloaded';

/** Étiquette en PNG : partage natif si possible, sinon téléchargement. */
export async function shareShippingLabel(node: HTMLElement, code: string): Promise<ShareOutcome> {
  const dataUrl = await labelPng(node);
  const name = fileName(code, 'png');
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    const payload = { files: [file], title: `Bonzini · ${code}` };
    if (!navigator.canShare || navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err) {
        // L'utilisateur a fermé la feuille de partage : ce n'est pas un échec.
        if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      }
    }
  }
  triggerDownload(dataUrl, name);
  return 'downloaded';
}

/** Étiquette en PDF A5 (148 × 210 mm — le ratio du nœud), prête à imprimer. */
export async function downloadShippingLabelPdf(node: HTMLElement, code: string): Promise<void> {
  const dataUrl = await labelPng(node);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  pdf.addImage(dataUrl, 'PNG', 0, 0, 148, 210, undefined, 'FAST');
  pdf.save(fileName(code, 'pdf'));
}
