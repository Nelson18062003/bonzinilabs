// ============================================================
// PARTAGE DE L'ÉTIQUETTE COLIS — image (WeChat, WhatsApp) ou PDF (impression).
//
// Le client envoie l'étiquette à son fournisseur comme il envoie tout le
// reste : en pièce jointe dans une conversation. Le partage natif
// (navigator.share avec un fichier) est donc le premier chemin ; quand le
// navigateur ne l'offre pas (bureau, WebView ancienne), on télécharge.
// ============================================================
import { jsPDF } from 'jspdf';
import { captureNodePng, copyNodePng, triggerDownload, type CaptureOptions, type CopyOutcome } from '@/lib/nodeImage';
import { DESTINATION_SLUG, type ShippingDestination } from '@/lib/customerCode';
import { LABEL_W, LABEL_H } from './ShippingLabel';

export interface LabelExportOptions {
  /**
   * Téléphone : ×2 au lieu de ×3, et SANS incorporer les polices web.
   * Incorporer Noto Sans SC, c'est télécharger et encoder en base64 des
   * dizaines de sous-ensembles (plusieurs Mo) — sur un iPhone en 5G, c'est
   * le « ça tourne, puis ça cale » constaté le 14/09/2026. Le rendu prend
   * alors les polices du système (PingFang pour le chinois) : lisible,
   * imprimable, et prêt en une seconde.
   */
  fast?: boolean;
}

function fileName(code: string, destination: ShippingDestination, ext: 'png' | 'pdf') {
  return `bonzini-etiquette-${DESTINATION_SLUG[destination]}-${code}.${ext}`;
}

function captureOptions(opts: LabelExportOptions): CaptureOptions {
  // ×3 : 1800 × 2850 px, ~220 dpi sur une page A4 — net à l'impression,
  // lisible en zoom sur WeChat, et toujours sous 1 Mo.
  return opts.fast
    ? { width: LABEL_W, height: LABEL_H, pixelRatio: 2, backgroundColor: '#FFFFFF', embedFonts: false }
    : { width: LABEL_W, height: LABEL_H, pixelRatio: 3, backgroundColor: '#FFFFFF' };
}

async function labelPng(node: HTMLElement, opts: LabelExportOptions = {}): Promise<string> {
  return captureNodePng(node, captureOptions(opts));
}

export type ShareOutcome = 'shared' | 'downloaded';

/** Étiquette en PNG : partage natif si possible, sinon téléchargement. */
export async function shareShippingLabel(node: HTMLElement, code: string, destination: ShippingDestination, opts: LabelExportOptions = {}): Promise<ShareOutcome> {
  const dataUrl = await labelPng(node, opts);
  const name = fileName(code, destination, 'png');
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

/** Étiquette en PNG, téléchargée (bureau, ou quand on veut le fichier). */
export async function downloadShippingLabelPng(node: HTMLElement, code: string, destination: ShippingDestination, opts: LabelExportOptions = {}): Promise<void> {
  triggerDownload(await labelPng(node, opts), fileName(code, destination, 'png'));
}

/** Étiquette en PNG dans le presse-papiers — à coller dans WeChat, WhatsApp ou un e-mail. */
export async function copyShippingLabelPng(node: HTMLElement, code: string, destination: ShippingDestination, opts: LabelExportOptions = {}): Promise<CopyOutcome> {
  return copyNodePng(node, fileName(code, destination, 'png'), captureOptions(opts));
}

/** Étiquette en PDF A4, prête à imprimer : posée à sa proportion, centrée, avec une marge. */
export async function downloadShippingLabelPdf(node: HTMLElement, code: string, destination: ShippingDestination, opts: LabelExportOptions = {}): Promise<void> {
  const dataUrl = await labelPng(node, opts);
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 8;
  const ratio = LABEL_H / LABEL_W;
  let w = PAGE_W - 2 * MARGIN;
  let h = w * ratio;
  if (h > PAGE_H - 2 * MARGIN) { h = PAGE_H - 2 * MARGIN; w = h / ratio; }
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(dataUrl, 'PNG', (PAGE_W - w) / 2, (PAGE_H - h) / 2, w, h, undefined, 'FAST');
  pdf.save(fileName(code, destination, 'pdf'));
}
