import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const FLYER_SCALE = 2.45; // 440px × 2.45 ≈ 1080px

function fileName(ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `bonzini-rate-${d}.${ext}`;
}

async function waitForFonts(): Promise<void> {
  await document.fonts.ready;
  // Extra delay to ensure Google Fonts are fully rendered
  await new Promise((r) => setTimeout(r, 600));
}

async function captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  // The element lives inside a hidden wrapper (opacity:0, z-index:-1).
  // html2canvas skips elements with z-index < 0, so we temporarily reveal
  // the wrapper before capturing.
  const wrapper = element.parentElement as HTMLElement;

  const savedOpacity = wrapper.style.opacity;
  const savedZIndex = wrapper.style.zIndex;

  wrapper.style.opacity = '1';
  wrapper.style.zIndex = '9999';

  // Wait two animation frames so the browser actually paints the element
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    return await html2canvas(element, {
      scale: FLYER_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#050208',
      logging: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
      windowWidth: element.offsetWidth,
      windowHeight: element.offsetHeight,
    });
  } finally {
    wrapper.style.opacity = savedOpacity;
    wrapper.style.zIndex = savedZIndex;
  }
}

export async function downloadFlyerPNG(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await captureElement(element);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = fileName('png');
  link.href = dataUrl;
  link.click();
}

export async function downloadFlyerPDF(element: HTMLElement): Promise<void> {
  await waitForFonts();
  const canvas = await captureElement(element);

  const dataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
  pdf.save(fileName('pdf'));
}
