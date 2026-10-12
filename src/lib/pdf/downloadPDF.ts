import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

/**
 * Télécharge un document PDF. Le lien est ajouté à la page et son URL n'est
 * libérée qu'après quelques secondes : sur téléphone (Safari iOS, Chrome
 * Android), libérer l'URL dans la foulée du clic faisait échouer le
 * téléchargement sans un mot.
 */
export async function downloadPDF(document: ReactElement, filename: string): Promise<void> {
  const blob = await pdf(document).toBlob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
