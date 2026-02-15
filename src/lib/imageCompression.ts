/**
 * Compress an image file using the browser Canvas API.
 * Non-image files (PDFs, etc.) pass through unchanged.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<File> {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!imageTypes.includes(file.type)) return file;

  // Skip tiny files (< 100KB)
  if (file.size < 100 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Skip if already small enough
      if (width <= maxWidth) {
        resolve(file);
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
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help — return original
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/** Compress an array of files (images get compressed, others pass through) */
export async function compressImages(files: File[], maxWidth = 1200, quality = 0.8): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxWidth, quality)));
}
