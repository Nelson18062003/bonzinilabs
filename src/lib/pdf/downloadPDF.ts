import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export async function downloadPDF(document: ReactElement, filename: string): Promise<void> {
  const blob = await pdf(document).toBlob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
