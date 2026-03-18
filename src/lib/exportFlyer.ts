import { toPng, getFontEmbedCSS } from 'html-to-image';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2; // 440px × 2 = 880px (full HD — was 2.45, 33% less pixels to compute)

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

// Font CSS is cached after the first call so subsequent exports are instant
let _fontEmbedCSS: string | null = null;

/**
 * Pre-fetches and caches the Google Fonts as base64 so the first export
 * doesn't have to wait for a network round-trip.
 * Call this once when the flyer section becomes visible.
 */
export async function warmupFlyerFonts(element: HTMLElement): Promise<void> {
  if (_fontEmbedCSS) return;
  await document.fonts.ready;
  _fontEmbedCSS = await getFontEmbedCSS(element);
}

async function capture(element: HTMLElement): Promise<string> {
  await document.fonts.ready;

  const h = element.scrollHeight || element.offsetHeight || 900;

  return await toPng(element, {
    pixelRatio: FLYER_SCALE,
    width: 440,
    height: h,
    backgroundColor: '#050208',
    // Pass cached font CSS so html-to-image skips the network re-fetch
    ...((_fontEmbedCSS != null) && { fontEmbedCSS: _fontEmbedCSS }),
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Triggers a file download that works on all browsers, including iOS Safari.
 * Using URL.createObjectURL avoids the async gesture-chain issue that breaks
 * link.click() with a large dataUrl on mobile browsers.
 */
function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadFlyerPNG(element: HTMLElement): Promise<void> {
  const dataUrl = await capture(element);
  triggerDownload(dataUrlToBlob(dataUrl), fileName('png'));
}

export async function downloadFlyerPDF(element: HTMLElement): Promise<void> {
  const dataUrl = await capture(element);
  const w = Math.round(440 * FLYER_SCALE);
  const h = Math.round((element.scrollHeight || element.offsetHeight || 900) * FLYER_SCALE);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);

  // pdf.save() uses the same broken link.click() pattern on mobile.
  // pdf.output('blob') + URL.createObjectURL works everywhere.
  const blob = pdf.output('blob');
  triggerDownload(blob, fileName('pdf'));
}
