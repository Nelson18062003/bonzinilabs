// ============================================================
// Voice recording utilities — Web standards, no external dep
//
// Compatibilité confirmée :
//   - iOS Safari 14.1+ → audio/mp4 (HE-AAC)
//   - Chrome / Edge → audio/webm;codecs=opus
//   - Firefox → audio/ogg;codecs=opus OU audio/webm;codecs=opus
//   - Android Chrome → audio/webm;codecs=opus
//
// Voir https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
// ============================================================

export interface VoiceMimeChoice {
  mimeType: string;
  extension: string;
}

/**
 * Détecte le meilleur format audio supporté par le browser actuel.
 * iOS Safari ne supporte QUE audio/mp4 ; les autres préfèrent webm.
 * Retourne null si MediaRecorder n'est pas du tout supporté.
 */
export function detectVoiceMimeType(): VoiceMimeChoice | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const candidates: VoiceMimeChoice[] = [
    { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/aac', extension: 'aac' },
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ];

  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      // Certains browsers throw plutôt que retourner false. Ignorer.
    }
  }

  // Dernière chance : MediaRecorder existe mais on ne sait pas quel format.
  // On accepte le défaut du browser.
  return { mimeType: '', extension: 'webm' };
}

/**
 * Vérifie si le browser supporte au moins un format audio enregistrable
 * ET expose getUserMedia (mic API).
 */
export function isVoiceRecordingSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return detectVoiceMimeType() !== null;
}

/**
 * Demande la permission micro à l'utilisateur (popup natif iOS / Android).
 * Retourne le MediaStream prêt à enregistrer.
 *
 * Erreurs courantes :
 *   - NotAllowedError : utilisateur a refusé OU a refusé précédemment
 *   - NotFoundError   : pas de micro sur l'appareil
 *   - NotReadableError: micro occupé par une autre app
 */
export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not supported');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

/**
 * Formate une durée en secondes vers MM:SS (max 9999s pour faire propre).
 */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.min(9999, Math.round(seconds)));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formate une taille en bytes vers une string humaine.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
