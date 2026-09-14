// ============================================================
// Le geste « sortir l'étiquette », partagé par le composeur (client, desktop)
// et la feuille mobile : un état `busy`, un dispatch par sorte de sortie,
// les mêmes garde-fous (rien pendant un export, erreur en toast, jamais un
// bouton qui reste bloqué).
// ============================================================
import { useState } from 'react';
import { toast } from 'sonner';
import type { ShippingDestination } from '@/lib/customerCode';
import { copyLabelImage, downloadLabelImage, downloadLabelPdf, sendLabelImage, sendLabelPdf, type RenderLabel } from './exportShippingLabel';

export type LabelExportKind = 'share' | 'sharePdf' | 'copy' | 'png' | 'pdf';

export interface LabelExportMessages {
  downloaded: string;
  pdfDownloaded: string;
  copied: string;
  error: string;
}

export function useLabelExport(render: RenderLabel, code: string, destination: ShippingDestination, ready: boolean, messages: LabelExportMessages) {
  const [busy, setBusy] = useState<LabelExportKind | null>(null);
  const canRun = ready && busy === null;

  const run = async (kind: LabelExportKind) => {
    if (!canRun) return;
    setBusy(kind);
    try {
      if (kind === 'share') { if ((await sendLabelImage(render, code, destination)) === 'downloaded') toast.success(messages.downloaded); }
      else if (kind === 'sharePdf') { if ((await sendLabelPdf(render, code, destination)) === 'downloaded') toast.success(messages.pdfDownloaded); }
      else if (kind === 'copy') { toast.success((await copyLabelImage(render, code, destination)) === 'copied' ? messages.copied : messages.downloaded); }
      else if (kind === 'png') { await downloadLabelImage(render, code, destination); toast.success(messages.downloaded); }
      else { await downloadLabelPdf(render, code, destination); }
    } catch (err) {
      console.error('shipping label export', err);
      toast.error(messages.error);
    } finally {
      setBusy(null);
    }
  };

  return { busy, canRun, run };
}
