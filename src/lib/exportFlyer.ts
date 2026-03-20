// exportFlyer.ts — téléchargement du flyer via la Supabase Edge Function generate-flyer.
//
// Pipeline :
//   Client envoie les taux → Edge Function (Satori → PNG via Resvg) → blob PNG → download natif
//
// Pas de Web Share API : on utilise un anchor click direct qui fonctionne
// sur iOS Safari 13+, Android Chrome et desktop.
import { jsPDF } from 'jspdf';

export interface FlyerRates {
  alipay: number;
  wechat: number;
  bank:   number;
  cash:   number;
}

function fileName(ext: string): string {
  return `bonzini_taux_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// Téléchargement natif — fonctionne sur iOS, Android, desktop.
function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Appel à la Edge Function ───────────────────────────────────────────────
// Retourne directement un PNG blob — aucune conversion DOM côté client.
async function fetchFlyerPNG(rates: FlyerRates, dark: boolean): Promise<Blob> {
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

  return res.blob();
}

// ── API publique ──────────────────────────────────────────────────────────

export async function downloadFlyerPNG(rates: FlyerRates, dark: boolean): Promise<void> {
  const blob = await fetchFlyerPNG(rates, dark);
  triggerDownload(blob, fileName('png'));
}

export async function downloadFlyerPDF(rates: FlyerRates, dark: boolean): Promise<void> {
  const pngBlob = await fetchFlyerPNG(rates, dark);

  // Convertit le PNG en PDF via jsPDF
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(pngBlob);
  });

  // Dimensions en px pour que le PDF soit exactement à la taille du PNG (2150×2560)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [2150, 2560] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, 2150, 2560);

  triggerDownload(pdf.output('blob'), fileName('pdf'));
}
