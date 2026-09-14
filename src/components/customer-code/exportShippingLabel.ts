// ============================================================
// SORTIES DE L'ÉTIQUETTE COLIS — image (WeChat, WhatsApp) ou PDF (impression).
//
// L'étiquette est peinte sur un canvas (src/lib/shippingLabelCanvas.ts) ; ici
// on en fait un FICHIER et on le remet à la personne :
//   • sur téléphone, par la feuille de partage native (navigator.share avec
//     un File) — c'est un vrai fichier qui part dans WhatsApp ou WeChat, pas
//     un lien « blob: » ouvert dans un onglet ;
//   • sinon (bureau, WebView ancienne), par un téléchargement.
// ============================================================
import { jsPDF } from 'jspdf';
import { DESTINATION_SLUG, type ShippingDestination } from '@/lib/customerCode';
import { LABEL_W, LABEL_H, fitOnPage } from '@/lib/shippingLabelCanvas';

/** Peint l'étiquette à l'échelle demandée — fourni par useShippingLabel(). */
export type RenderLabel = (scale?: number) => Promise<HTMLCanvasElement>;

export type Outcome = 'shared' | 'downloaded';
export type CopyOutcome = 'copied' | 'downloaded';

/** ×3 : 1800 × 2850 px, ~220 dpi sur une page A4 — net à l'impression, lisible en zoom. */
const EXPORT_SCALE = 3;

export function labelFileName(code: string, destination: ShippingDestination, ext: 'png' | 'pdf'): string {
  return `bonzini-etiquette-${DESTINATION_SLUG[destination]}-${code}.${ext}`;
}

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob a échoué'))), 'image/png'));
}

export async function labelImageFile(render: RenderLabel, code: string, destination: ShippingDestination): Promise<File> {
  const blob = await canvasToBlob(await render(EXPORT_SCALE));
  return new File([blob], labelFileName(code, destination, 'png'), { type: 'image/png' });
}

/** PDF A4, prêt à imprimer : l'étiquette posée à sa proportion, centrée, avec une marge. */
export async function labelPdfFile(render: RenderLabel, code: string, destination: ShippingDestination): Promise<File> {
  const canvas = await render(EXPORT_SCALE);
  const box = fitOnPage(LABEL_W, LABEL_H);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', box.x, box.y, box.w, box.h, undefined, 'FAST');
  return new File([pdf.output('blob')], labelFileName(code, destination, 'pdf'), { type: 'application/pdf' });
}

/** Téléchargement de navigateur, sans laisser traîner d'URL. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Partage natif si le navigateur sait partager CE fichier, sinon téléchargement. */
export async function deliverFile(file: File, title: string): Promise<Outcome> {
  if (canShareFiles()) {
    const payload = { files: [file], title };
    if (!navigator.canShare || navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err) {
        // La personne a refermé la feuille de partage : ce n'est pas un échec.
        if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
        // Autre erreur (feuille indisponible) : on retombe sur le téléchargement.
      }
    }
  }
  downloadFile(file);
  return 'downloaded';
}

export async function sendLabelImage(render: RenderLabel, code: string, destination: ShippingDestination): Promise<Outcome> {
  return deliverFile(await labelImageFile(render, code, destination), `Bonzini · ${code}`);
}

export async function sendLabelPdf(render: RenderLabel, code: string, destination: ShippingDestination): Promise<Outcome> {
  return deliverFile(await labelPdfFile(render, code, destination), `Bonzini · ${code}`);
}

export async function downloadLabelImage(render: RenderLabel, code: string, destination: ShippingDestination): Promise<void> {
  downloadFile(await labelImageFile(render, code, destination));
}

export async function downloadLabelPdf(render: RenderLabel, code: string, destination: ShippingDestination): Promise<void> {
  downloadFile(await labelPdfFile(render, code, destination));
}

/**
 * L'image dans le presse-papiers — à coller dans WeChat, WhatsApp ou un e-mail.
 * Le Blob est passé en PROMESSE : Safari n'accepte l'écriture que dans le
 * geste de la personne, et la peinture (chargement des polices) est asynchrone.
 * Sans ClipboardItem (Firefox ancien, WebView), on télécharge.
 */
export async function copyLabelImage(render: RenderLabel, code: string, destination: ShippingDestination): Promise<CopyOutcome> {
  const canWrite = typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.clipboard?.write;
  if (canWrite) {
    const blob = render(EXPORT_SCALE).then(canvasToBlob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  }
  await downloadLabelImage(render, code, destination);
  return 'downloaded';
}
