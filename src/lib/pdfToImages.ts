// ============================================================
// LES PAGES D'UN PDF EN IMAGES PNG, dans le navigateur.
//
// Pour envoyer une fiche sur WhatsApp comme une photo : chaque page du PDF
// (fabriqué par react-pdf) est dessinée par pdf.js sur un canvas, puis
// enregistrée en PNG. Les images sont donc identiques au PDF, trait pour
// trait. pdf.js (≈ 1,8 Mo avec son worker) n'est chargé qu'au premier
// appel ; la version « legacy » fonctionne aussi sur les téléphones anciens.
// ============================================================

/** ×2,5 : une page A4 portrait fait 1488 × 2105 px — nette en plein écran sur un téléphone. */
export const IMAGE_SCALE = 2.5;

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

/** Nom d'image d'une page : « rib-uba.png », ou « coordonnees-bancaires-portrait-p2.png » pour un livret. */
export function pageImageName(pdfName: string, page: number, pages: number): string {
  const base = pdfName.replace(/\.pdf$/i, '');
  return pages > 1 ? `${base}-p${page}.png` : `${base}.png`;
}

/** Toutes les pages du PDF, en PNG, dans l'ordre. */
export async function pdfToPngFiles(pdf: File, scale = IMAGE_SCALE): Promise<File[]> {
  const pdfjs = await loadPdfJs();
  // Nos propres PDF, mais par principe : pdf.js n'évalue jamais de code venu d'un document.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const files: File[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      // Fond blanc : un PNG transparent s'afficherait en noir dans certaines messageries.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      files.push(new File([await canvasToPng(canvas)], pageImageName(pdf.name, n, doc.numPages), { type: 'image/png' }));
      page.cleanup();
      canvas.width = 0; // libère la mémoire du canvas tout de suite (iOS)
    }
    return files;
  } finally {
    await doc.destroy();
  }
}
