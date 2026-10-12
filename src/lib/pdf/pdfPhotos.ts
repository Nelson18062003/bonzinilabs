// ============================================================
// LES PHOTOS DES COLIS DANS UN PDF — le seau `parcel-photos` est privé :
// on signe les chemins (par lots de 100), on télécharge chaque image, on la
// réduit (côté le plus long 640 px, JPEG 0,72) et on la rend en data URL,
// que react-pdf embarque. Une photo de téléphone pèse 3 Mo ; réduite, 50 Ko :
// un bon de réception de dix colis reste un fichier qu'on envoie sur WhatsApp.
//
// Une photo qui ne se charge pas (supprimée, réseau) est simplement absente :
// le document dit « sans photo », il ne tombe jamais en erreur pour ça.
// Staff seulement (`supabaseAdmin`) : ces documents se fabriquent dans l'admin.
// ============================================================
import { supabaseAdmin } from '@/integrations/supabase/client';

/** Une photo prête pour react-pdf : la data URL JPEG et ses dimensions (pour garder le cadrage). */
export interface PdfPhoto { src: string; width: number; height: number }

const BUCKET = 'parcel-photos';
const MAX_SIDE = 640;
const QUALITY = 0.72;
const TIMEOUT_MS = 15_000;

/** Les chemins → URL signées (10 min), par lots de 100 comme la console. */
async function signAll(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(chunk, 600);
    if (error) continue;
    for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Une image (blob) réduite en JPEG : le côté le plus long à `maxSide`, l'orientation EXIF respectée. */
async function shrink(blob: Blob, maxSide: number): Promise<PdfPhoto> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    // Fond blanc : un PNG transparent ne devient pas noir en JPEG.
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { src: canvas.toDataURL('image/jpeg', QUALITY), width, height };
  } finally {
    bitmap.close();
  }
}

/**
 * Les photos demandées, prêtes pour le PDF, rangées par chemin. Quatre
 * téléchargements à la fois ; chacune a 15 s. Ce qui échoue est absent de la carte.
 */
export async function loadPdfPhotos(paths: readonly string[], opts: { maxSide?: number } = {}): Promise<Map<string, PdfPhoto>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, PdfPhoto>();
  if (unique.length === 0) return out;
  const urls = await signAll(unique).catch(() => new Map<string, string>());
  const queue = unique.filter((p) => urls.has(p));
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const res = await withTimeout(fetch(urls.get(path) as string), TIMEOUT_MS);
        if (!res.ok) continue;
        out.set(path, await withTimeout(shrink(await res.blob(), opts.maxSide ?? MAX_SIDE), TIMEOUT_MS));
      } catch {
        /* photo indisponible : le document l'écrit */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return out;
}
