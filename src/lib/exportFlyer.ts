import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2.45; // 440px × 2.45 ≈ 1080px

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

async function waitForFonts(): Promise<void> {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 600));
}

async function capture(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Cloner l'élément dans un wrapper propre directement sur document.body,
  // sans aucun parent avec z-index / opacity / position problématiques.
  // C'est la seule façon fiable de faire fonctionner html2canvas.
  const w = element.offsetWidth || 440;
  const h = element.scrollHeight || element.offsetHeight;

  const tmpWrapper = document.createElement('div');
  tmpWrapper.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    `width:${w}px`,
    'z-index:99999',
    'pointer-events:none',
    'overflow:visible',
  ].join(';');

  const clone = element.cloneNode(true) as HTMLElement;
  tmpWrapper.appendChild(clone);
  document.body.appendChild(tmpWrapper);

  // Laisser le browser peindre le clone
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const cloneH = clone.offsetHeight || h;

  try {
    return await html2canvas(clone, {
      scale: FLYER_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#050208',
      logging: false,
      width: w,
      height: cloneH,
      windowWidth: w,
      windowHeight: cloneH,
    });
  } finally {
    document.body.removeChild(tmpWrapper);
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
