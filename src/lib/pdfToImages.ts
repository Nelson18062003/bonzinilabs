// ============================================================
// UN PDF EN UNE SEULE IMAGE PNG, dans le navigateur.
//
// Pour envoyer une fiche sur WhatsApp comme une photo : chaque page du PDF
// (fabriqué par react-pdf) est dessinée par pdf.js, et TOUTES les pages sont
// réunies dans UNE image (demande du fondateur, 25/09/2026 : « une seule
// image, pas six »). Les pages sont posées en planche, sur la grille la plus
// proche du carré (6 pages portrait → 3 colonnes × 2 lignes) : WhatsApp
// réduit une image à ~1 600 px sur son grand côté, et une longue bande de six
// pages deviendrait illisible, là où une planche carrée reste lisible au zoom.
// L'image est identique au PDF, trait pour trait. pdf.js (≈ 1,8 Mo avec son
// worker) n'est chargé qu'au premier appel ; la version « legacy » fonctionne
// aussi sur les téléphones anciens.
// ============================================================

/** ×2,5 : une page A4 seule fait 1488 × 2105 px — nette en plein écran sur un téléphone. */
export const IMAGE_SCALE = 2.5;

/**
 * Plafond de surface d'un canvas : Safari sur iPhone refuse au-delà de
 * 16 777 216 px (4096²). On reste dessous, avec une marge.
 */
export const MAX_CANVAS_AREA = 16_000_000;
/** Plafond de côté (Chrome et Firefox : 32 767 px ; on reste loin dessous). */
export const MAX_CANVAS_SIDE = 16_000;

/** Écart entre deux pages et marge autour de la planche, en points PDF. */
export const SHEET_GAP = 16;
/** Le fond de la planche : un gris très clair, pour que les pages blanches se détachent. */
export const SHEET_BACKGROUND = '#e9e6ef';

export interface PageSize { width: number; height: number }

export interface SheetLayout {
  cols: number;
  rows: number;
  /** Échelle appliquée aux pages (points PDF → pixels). */
  scale: number;
  /** Taille de l'image, en pixels. */
  width: number;
  height: number;
  /** Case de chaque page, en pixels, dans l'ordre de lecture (gauche → droite, haut → bas). */
  cells: { x: number; y: number; width: number; height: number }[];
}

/**
 * La planche : le nombre de colonnes qui donne l'image la plus carrée (sans
 * cases vides inutiles), puis
 * l'échelle la plus grande (au plus `scale`) qui tient sous les plafonds du
 * canvas. Les pages d'un même document ont la même taille ; on prend la plus
 * grande pour la case, par sûreté.
 */
export function sheetLayout(pages: PageSize[], scale = IMAGE_SCALE): SheetLayout {
  const n = pages.length;
  if (n === 0) throw new Error('Document vide');
  const cellW = Math.max(...pages.map((p) => p.width));
  const cellH = Math.max(...pages.map((p) => p.height));
  // Une page seule : l'image est la page, sans marge.
  const gap = n > 1 ? SHEET_GAP : 0;
  const sizeFor = (cols: number) => {
    const rows = Math.ceil(n / cols);
    return { cols, rows, w: cols * cellW + (cols + 1) * gap, h: rows * cellH + (rows + 1) * gap };
  };
  // Le plus carré, en pénalisant les cases vides : 4 pages portrait font une
  // grille 2 × 2 (et non 3 + 1), 6 pages portrait 3 × 2, 6 pages paysage 2 × 3.
  const score = (x: { cols: number; rows: number; w: number; h: number }) => Math.abs(Math.log(x.w / x.h)) + (x.cols * x.rows - n) / n;
  let best = sizeFor(1);
  for (let cols = 2; cols <= n; cols++) {
    const s = sizeFor(cols);
    if (score(s) < score(best) - 1e-9) best = s;
  }
  const fit = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA / (best.w * best.h)), MAX_CANVAS_SIDE / Math.max(best.w, best.h));
  // Arrondi vers le bas : la surface ne dépasse JAMAIS le plafond, et chaque case reste dans l'image.
  const px = (v: number) => Math.floor(v * fit);
  const cells = pages.map((p, i) => {
    const c = i % best.cols;
    const r = Math.floor(i / best.cols);
    // Une page plus petite que la case y est centrée.
    const x = gap + c * (cellW + gap) + (cellW - p.width) / 2;
    const y = gap + r * (cellH + gap) + (cellH - p.height) / 2;
    return { x: px(x), y: px(y), width: px(p.width), height: px(p.height) };
  });
  return { cols: best.cols, rows: best.rows, scale: fit, width: px(best.w), height: px(best.h), cells };
}

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image impossible à créer'))), 'image/png'));
}

/** Nom de l'image : celui du PDF, en .png (« coordonnees-bancaires-portrait.png », « rib-uba.png »). */
export function sheetImageName(pdfName: string): string {
  return `${pdfName.replace(/\.pdf$/i, '')}.png`;
}

/** Toutes les pages du PDF réunies dans UNE image PNG (une page seule reste une page). */
export async function pdfToSheetImage(pdf: File, scale = IMAGE_SCALE): Promise<File> {
  const pdfjs = await loadPdfJs();
  // Nos propres PDF, mais par principe : pdf.js n'évalue jamais de code venu d'un document.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), isEvalSupported: false }).promise;
  const sheet = document.createElement('canvas');
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) pages.push(await doc.getPage(n));
    const layout = sheetLayout(pages.map((p) => { const v = p.getViewport({ scale: 1 }); return { width: v.width, height: v.height }; }), scale);
    sheet.width = layout.width;
    sheet.height = layout.height;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.fillStyle = SHEET_BACKGROUND;
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    // Chaque page sur SON canvas, puis collée dans sa case : pdf.js repeint tout
    // le canvas en blanc avant de dessiner, ce qui effacerait les pages déjà posées.
    const pageCanvas = document.createElement('canvas');
    try {
      for (const [i, page] of pages.entries()) {
        const cell = layout.cells[i];
        const viewport = page.getViewport({ scale: layout.scale });
        pageCanvas.width = Math.round(viewport.width);
        pageCanvas.height = Math.round(viewport.height);
        const pctx = pageCanvas.getContext('2d');
        if (!pctx) throw new Error('Canvas indisponible');
        // Fond blanc : un PNG transparent s'afficherait en noir dans certaines messageries.
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pctx, viewport }).promise;
        ctx.drawImage(pageCanvas, cell.x, cell.y, cell.width, cell.height);
        page.cleanup();
      }
    } finally {
      pageCanvas.width = 0;
    }
    return new File([await canvasToPng(sheet)], sheetImageName(pdf.name), { type: 'image/png' });
  } finally {
    sheet.width = 0; // libère la mémoire du canvas tout de suite (iOS)
    await doc.destroy();
  }
}
