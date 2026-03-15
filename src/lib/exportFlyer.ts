import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2.45; // 440px × 2.45 ≈ 1080px

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

async function waitForFonts(): Promise<void> {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 800));
}

async function capture(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Rendre le parent temporairement visible hors-écran pour que html2canvas
  // ait un layout correct (opacity:0 / z-index:-1 faussent les mesures).
  const parent = element.parentElement as HTMLElement | null;
  const originalParentStyle = parent?.getAttribute('style') ?? '';

  if (parent) {
    parent.style.cssText =
      'position:fixed;top:0;left:-10000px;z-index:99999;pointer-events:none;';
  }

  // Laisser le browser recalculer le layout
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const w = element.offsetWidth || 440;
  const h = element.scrollHeight || element.offsetHeight || 900;

  try {
    return await html2canvas(element, {
      scale: FLYER_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#050208',
      logging: false,
      width: w,
      height: h,
      scrollX: 10000, // compense le left:-10000px
      scrollY: 0,
      windowWidth: w,
      windowHeight: h,
    });
  } finally {
    if (parent) {
      parent.setAttribute('style', originalParentStyle);
    }
  }
}

export async function downloadFlyerPNG(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await capture(element);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = fileName('png');
  link.href = dataUrl;
  link.click();
}

export async function downloadFlyerPDF(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await capture(element);

  const dataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
  pdf.save(fileName('pdf'));
}
