// ============================================================
// Video utilities — durée + génération de poster côté client
// ============================================================

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
}

/**
 * Charge la vidéo en mémoire et extrait sa durée et dimensions.
 * Retourne null si le fichier est invalide ou inanalysable.
 */
export async function readVideoMetadata(file: File): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      const meta: VideoMetadata = {
        durationSeconds: Math.round(video.duration),
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      resolve(meta);
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    // Timeout de sécurité (5s)
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);
  });
}

/**
 * Extrait la première frame visible de la vidéo et la renvoie comme Blob JPEG.
 * Utilisé pour générer un poster affiché dans la bulle avant playback.
 */
export async function generateVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadeddata = () => {
      // Seek à 0.1s pour éviter une frame noire au tout début
      video.currentTime = Math.min(0.1, video.duration / 10);
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        // Réduire à max 640px de large
        const scale = Math.min(1, 640 / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          'image/jpeg',
          0.7
        );
      } catch (err) {
        console.error('Poster generation error', err);
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);
  });
}
