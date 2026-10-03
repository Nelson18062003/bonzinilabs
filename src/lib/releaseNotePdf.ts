// ============================================================
// LE BON DE RETRAIT — fabrication du fichier PDF (en-tête et pied officiels,
// src/lib/pdf/templates/ReleaseNotePDF.tsx) et sa remise : TÉLÉCHARGÉ sur
// ordinateur (jamais la feuille de partage de Windows), partagé sur téléphone.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { downloadFile, saveOrShareFile, type Outcome } from '@/components/customer-code/exportShippingLabel';
import type { Release } from '@/lib/warehouse';
import { clientFullName } from '@/lib/reception';
import { ReleaseNotePDF } from '@/lib/pdf/templates/ReleaseNotePDF';

export function releaseFileName(r: Release): string { return `bonzini-bon-retrait-${r.release_no}-${r.client?.customer_code ?? ''}.pdf`; }

export async function buildReleaseNotePdf(r: Release, signatureDataUrl?: string | null): Promise<File> {
  const el: ReactElement = createElement(ReleaseNotePDF, { r, signatureDataUrl });
  const blob = await pdf(el).toBlob();
  return new File([blob], releaseFileName(r), { type: 'application/pdf' });
}

/** Le geste par défaut : téléchargé sur ordinateur, partagé sur téléphone (le client repart avec, sur WhatsApp). */
export async function deliverReleaseNotePdf(r: Release, signatureDataUrl?: string | null): Promise<Outcome> {
  return saveOrShareFile(await buildReleaseNotePdf(r, signatureDataUrl), `${r.release_no} · ${r.client ? clientFullName(r.client) : r.picked_by_name}`);
}

export async function downloadReleaseNotePdf(r: Release, signatureDataUrl?: string | null): Promise<void> { downloadFile(await buildReleaseNotePdf(r, signatureDataUrl)); }
