import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { PAGE } from './constants';

function fileName(ext: string): string {
  return `bonzini_soldes_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function triggerDownload(dataUrl: string, name: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Ensure Libre Baskerville is loaded before capture, otherwise the
// PNG renders with a fallback serif (classic html-to-image pitfall).
async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load('400 16px "Libre Baskerville"'),
        document.fonts.load('700 16px "Libre Baskerville"'),
      ]);
      await document.fonts.ready;
    } catch {
      /* best effort */
    }
  }
}

/** Capture the preview node to a high-res PNG data URL (≈1785×2525, pixelRatio 3). */
async function capturePng(node: HTMLElement): Promise<string> {
  await ensureFontsReady();
  return toPng(node, {
    pixelRatio: 3,
    width: PAGE.width,
    height: PAGE.height,
    cacheBust: true,
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
