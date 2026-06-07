import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

/**
 * Génère le PDF puis tente un PARTAGE NATIF du fichier (WhatsApp, email, …)
 * via la Web Share API mobile. Repli automatique sur téléchargement quand le
 * partage de fichier n'est pas supporté (desktop, navigateurs anciens) ou si
 * l'utilisateur annule.
 */
export async function sharePDF(document: ReactElement, filename: string): Promise<void> {
  const blob = await pdf(document).toBlob();
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // Annulation utilisateur → ne pas re-télécharger.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Autre erreur → repli sur téléchargement.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
