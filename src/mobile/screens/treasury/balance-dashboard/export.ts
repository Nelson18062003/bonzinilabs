import { captureNodePng, triggerDownload } from '@/lib/nodeImage';
import { jsPDF } from 'jspdf';
import { PAGE } from './constants';

function fileName(ext: string): string {
  return `bonzini_soldes_${new Date().toISOString().slice(0, 10)}.${ext}`;
}


/** Capture the preview node to a high-res PNG data URL (≈1785×2525, pixelRatio 3). */
async function capturePng(node: HTMLElement): Promise<string> {
  return captureNodePng(node, {
    pixelRatio: 3,
    width: PAGE.width,
    height: PAGE.height,
    backgroundColor: '#0F1117',
  });
}

export async function downloadDashboardPng(node: HTMLElement): Promise<void> {
  const dataUrl = await capturePng(node);
  triggerDownload(dataUrl, fileName('png'));
}

export async function downloadDashboardPdf(node: HTMLElement): Promise<void> {
  const dataUrl = await capturePng(node);
  // A4 portrait in points — exactly the prototype's page size.
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  pdf.addImage(dataUrl, 'PNG', 0, 0, PAGE.width, PAGE.height, undefined, 'FAST');
  pdf.save(fileName('pdf'));
}
