// ============================================================
// LE RELEVÉ DES COLIS D'UN CLIENT en PDF — les vignettes d'abord (petites :
// 240 px suffisent à reconnaître un carton), puis le rendu. Une langue (FR |
// EN), celle des documents cargo retenue sur l'appareil. Remise comme les
// autres documents : téléchargé sur ordinateur, partagé sur téléphone.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { downloadFile, saveOrShareFile, type Outcome } from '@/components/customer-code/exportShippingLabel';
import { buildClientStatement } from '@/lib/clientStatement';
import { readCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { loadPdfPhotos } from '@/lib/pdf/pdfPhotos';
import { ClientStatementPDF } from '@/lib/pdf/templates/ClientStatementPDF';
import { clientFullName, parcelPhotoPaths, type Deposit } from '@/lib/reception';

/** « bonzini-releve-colis-BZ-482913-2026-10-12.pdf » */
export function statementFileName(code: string | null | undefined, asOf: string, lang: CargoDocLang = 'fr'): string {
  const day = asOf.slice(0, 10);
  return lang === 'en' ? `bonzini-parcel-statement-${code ?? 'client'}-${day}.pdf` : `bonzini-releve-colis-${code ?? 'client'}-${day}.pdf`;
}

export async function buildClientStatementPdf(deposits: readonly Deposit[], lang: CargoDocLang = 'fr', asOf: string = new Date().toISOString()): Promise<File> {
  const statement = buildClientStatement(deposits);
  if (statement.held.parcels === 0 && statement.deliveredCount === 0) throw new Error('Aucun colis reçu pour ce client');
  const held = [...statement.guangzhou, ...statement.transit.flatMap((g) => g.parcels), ...statement.douala];
  const photos = await loadPdfPhotos(held.map((x) => parcelPhotoPaths(x.parcel)[0]).filter(Boolean), { maxSide: 240 });
  const doc: ReactElement = createElement(ClientStatementPDF, { statement, photos, asOf, lang });
  const blob = await pdf(doc).toBlob();
  return new File([blob], statementFileName(statement.client?.customer_code, asOf, lang), { type: 'application/pdf' });
}

/** Télécharger : toujours un fichier. */
export async function downloadClientStatementPdf(deposits: readonly Deposit[], lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildClientStatementPdf(deposits, lang));
}

/** Le geste par défaut : téléchargé sur ordinateur, partagé sur téléphone (WhatsApp). */
export async function deliverClientStatementPdf(deposits: readonly Deposit[], lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  const file = await buildClientStatementPdf(deposits, lang);
  const client = deposits.find((d) => d.client)?.client;
  return saveOrShareFile(file, `Relevé des colis · ${client ? clientFullName(client) : 'client'}`);
}
