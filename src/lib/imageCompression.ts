/**
 * Sanitize a filename for safe use in Supabase Storage paths.
 * Removes accents, replaces spaces and special chars with underscores,
 * keeps only safe ASCII characters + dots for extensions.
 */
export function sanitizeFileName(name: string): string {
  // Normalize unicode (é → e, ñ → n, etc.)
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Replace spaces and unsafe chars with underscore, collapse multiples
  return normalized
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'file';
}

/**
 * Compress an image file using the browser Canvas API.
 * Non-image files (PDFs, etc.) pass through unchanged.
 * Always sanitizes the filename for safe storage paths.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<File> {
  const safeName = sanitizeFileName(file.name);
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!imageTypes.includes(file.type)) {
    // Non-image: just sanitize name
    return new File([file], safeName, { type: file.type, lastModified: file.lastModified });
  }

  // Skip tiny files (< 100KB) — still sanitize name
  if (file.size < 100 * 1024) {
    return new File([file], safeName, { type: file.type, lastModified: file.lastModified });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Skip if already small enough
      if (width <= maxWidth) {
        resolve(new File([file], safeName, { type: file.type, lastModified: file.lastModified }));
        return;
      }

      // Scale down proportionally
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(new File([file], safeName, { type: file.type, lastModified: file.lastModified }));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help — return original with safe name
            resolve(new File([file], safeName, { type: file.type, lastModified: Date.now() }));
            return;
          }
          resolve(new File([blob], safeName, { type: file.type, lastModified: Date.now() }));
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(new File([file], safeName, { type: file.type, lastModified: file.lastModified }));
    };

    img.src = url;
  });
}

/** Compress an array of files (images get compressed, others pass through) */
export async function compressImages(files: File[], maxWidth = 1200, quality = 0.8): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxWidth, quality)));
}
