// exportFlyer.ts — server-side rendering via Supabase Edge Function
//
// Architecture:
//   Client sends rates → Edge Function (Satori) → SVG with text-as-paths
//   Client draws SVG on native canvas → PNG blob → download
//
// Why this beats html-to-image on Android:
//   • No DOM cloning, no font base64-encoding in-browser (was causing OOM crashes)
//   • Native <img>+canvas.drawImage() of an SVG is hardware-accelerated
//   • SVG text converted to vector paths server-side: zero font loading on device
import { jsPDF } from 'jspdf';

export interface FlyerRates {
  alipay: number;
  wechat: number;
  bank:   number;
  cash:   number;
}

function fileName(ext: string): string {
  return `bonzini-rate-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

async function triggerDownload(blob: Blob, name: string): Promise<void> {
  // Web Share API — works natively on iOS Safari 15+ and Android Chrome.
  // Shows the system share sheet so the user can save to Photos, WhatsApp, etc.
  const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  if (canShare) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Taux du jour — Bonzini' });
      return;
    }
  }

  // Desktop fallback: anchor click (works on Chrome, Firefox, Safari desktop).
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Edge Function call ────────────────────────────────────────────────────
async function fetchFlyer(rates: FlyerRates, dark: boolean): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const apiKey      = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/generate-flyer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ rates, dark }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`generate-flyer: ${res.status} — ${msg}`);
  }

  return res.text(); // SVG string
}

// ── SVG → PNG blob (native browser, no libraries) ────────────────────────
// The SVG from Satori has all text as vector paths, so no font loading is
// needed. The <img>+canvas approach is hardware-accelerated on all browsers.
function svgToBlob(svg: string, scale = 2): Promise<Blob> {
  // Parse the SVG dimensions so we size the canvas correctly.
  const w = parseFloat(svg.match(/width="([^"]+)"/)?.[1]  ?? '440');
  const h = parseFloat(svg.match(/height="([^"]+)"/)?.[1] ?? '870');

  return new Promise<Blob>((resolve, reject) => {
    const blob  = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url   = URL.createObjectURL(blob);
    const img   = new Image();

    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        'image/png',
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image failed to load'));
    };

    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export async function downloadFlyerPNG(rates: FlyerRates, dark: boolean): Promise<void> {
  const svg  = await fetchFlyer(rates, dark);
  const blob = await svgToBlob(svg, 2);
  await triggerDownload(blob, fileName('png'));
}

export async function downloadFlyerPDF(rates: FlyerRates, dark: boolean): Promise<void> {
  const svg     = await fetchFlyer(rates, dark);
  const pngBlob = await svgToBlob(svg, 2);

  const w = Math.round(parseFloat(svg.match(/width="([^"]+)"/)?.[1]  ?? '440') * 2);
  const h = Math.round(parseFloat(svg.match(/height="([^"]+)"/)?.[1] ?? '870') * 2);

  const dataUrl = await blobToDataUrl(pngBlob);
  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);

  await triggerDownload(pdf.output('blob'), fileName('pdf'));
}
