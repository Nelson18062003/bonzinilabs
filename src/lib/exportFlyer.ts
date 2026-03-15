import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2.45; // 440px × 2.45 ≈ 1080px

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

async function waitForFonts(): Promise<void> {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 400));
}

export async function downloadFlyerPNG(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await html2canvas(element, {
    scale: FLYER_SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#050208',
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = fileName('png');
  link.href = dataUrl;
  link.click();
}

export async function downloadFlyerPDF(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await html2canvas(element, {
    scale: FLYER_SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#050208',
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
  pdf.save(fileName('pdf'));
}
