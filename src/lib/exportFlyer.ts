import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2.45; // 440px × 2.45 ≈ 1080px

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

async function capture(element: HTMLElement): Promise<string> {
  // Attendre le chargement complet des polices (Syne, DM Sans, Noto Sans SC)
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 800));

  const h = element.scrollHeight || element.offsetHeight || 900;

  // html-to-image sérialise le DOM en SVG foreignObject avec les styles inline
  // et encode les polices en base64 — la position de l'élément sur la page
  // n'affecte pas le rendu (contrairement à html2canvas qui fait un screenshot).
  return await toPng(element, {
    pixelRatio: FLYER_SCALE,
    width: 440,
    height: h,
    backgroundColor: '#050208',
  });
}

export async function downloadFlyerPNG(element: HTMLElement): Promise<void> {
  const dataUrl = await capture(element);
  const link = document.createElement('a');
  link.download = fileName('png');
  link.href = dataUrl;
  link.click();
}

export async function downloadFlyerPDF(element: HTMLElement): Promise<void> {
  const dataUrl = await capture(element);
  const w = Math.round(440 * FLYER_SCALE);
  const h = Math.round((element.scrollHeight || element.offsetHeight || 900) * FLYER_SCALE);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
  pdf.save(fileName('pdf'));
}
