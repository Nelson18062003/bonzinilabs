// ============================================================
// LE BON DE RÉCEPTION ET DEVIS, LE REÇU, LA FACTURE — en PDF, avec l'en-tête
// et le pied officiels (src/lib/pdf, @react-pdf/renderer) et l'émetteur
// NORTON GAUSS BONZINI SARL. Le rendu vit dans
// src/lib/pdf/templates/CargoDocumentsPDF.tsx.
//
// Le bon de réception et devis (l'ancien « devis de fret », guide du
// 04/10/2026) porte les photos de chaque colis : elles sont chargées ici,
// réduites (pdfPhotos), avant le rendu. Il se fabrique avec ou sans devis :
// sans prix posés, il n'en montre pas.
//
// Ici : la fabrication du fichier, dans UNE langue (français ou anglais, au
// choix — retenu sur l'appareil), et sa remise :
//   · download… — TÉLÉCHARGER, toujours : le fichier arrive dans les
//     téléchargements, jamais de feuille de partage (le bouton « Télécharger ») ;
//   · share…    — PARTAGER (WhatsApp, WeChat) : la feuille de partage du
//     téléphone ; sans elle, téléchargement (le bouton « Partager », mobile) ;
//   · deliver…  — le geste par défaut d'un écran qui n'a qu'un bouton :
//     téléchargé sur ordinateur, partagé sur téléphone. Sur un PC Windows,
//     Chrome sait partager un fichier : sans cette règle, « PDF » ouvrait le
//     partage Windows au lieu de télécharger.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { deliverFile, downloadFile, saveOrShareFile, type Outcome } from '@/components/customer-code/exportShippingLabel';
import type { ShippingSettings } from '@/lib/customerCode';
import { clientFullName, type Deposit } from '@/lib/reception';
import { xaf, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { receptionDocData, receptionPhotoPaths } from '@/lib/receptionDoc';
import { loadPdfPhotos } from '@/lib/pdf/pdfPhotos';
import { CargoInvoicePDF, CargoReceiptPDF, ReceptionQuotePDF, type CargoDocLang } from '@/lib/pdf/templates/CargoDocumentsPDF';

export type { CargoDocLang };
export const CARGO_DOC_LANGS: readonly CargoDocLang[] = ['fr', 'en'];
export const CARGO_DOC_LANG_LABEL: Record<CargoDocLang, string> = { fr: 'Français', en: 'English' };

/** La langue des documents cargo, retenue sur l'appareil : on ne la redemande pas à chaque devis. */
const LANG_KEY = 'bonzini-cargo-doc-lang';
export function readCargoDocLang(): CargoDocLang {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
}
export function storeCargoDocLang(lang: CargoDocLang): void {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* stockage indisponible : on redemandera */ }
}

const who = (q: Pick<Quote, 'client' | 'deposit_no'>) => q.client?.customer_code ?? q.deposit_no;

/** Le bon d'un dépôt : le dépôt (photos, état), son devis s'il existe — l'un des deux au moins. */
export interface ReceptionDocInput { deposit: Deposit | null; quote: Quote | null }
const receptionSubject = ({ deposit, quote }: ReceptionDocInput) => ({
  deposit_no: (deposit?.deposit_no ?? quote?.deposit_no) as string,
  client: deposit?.client ?? quote?.client ?? null,
});

/** « bonzini-bon-reception-RC-000122-BZ-482913.pdf » — le numéro du dépôt, puis le client. */
export function receptionFileName(input: ReceptionDocInput, lang: CargoDocLang = 'fr'): string {
  const s = receptionSubject(input);
  const tail = s.client?.customer_code ? `${s.deposit_no}-${s.client.customer_code}` : s.deposit_no;
  return lang === 'en' ? `bonzini-goods-receipt-${tail}.pdf` : `bonzini-bon-reception-${tail}.pdf`;
}
export function receiptFileName(q: Quote, p: QuotePayment, lang: CargoDocLang = 'fr'): string {
  return lang === 'en' ? `bonzini-receipt-${p.receipt_no}-${who(q)}.pdf` : `bonzini-recu-${p.receipt_no}-${who(q)}.pdf`;
}
export function invoiceFileName(q: Quote, lang: CargoDocLang = 'fr'): string {
  return lang === 'en' ? `bonzini-invoice-${q.invoice_no ?? q.quote_no}-${who(q)}.pdf` : `bonzini-facture-${q.invoice_no ?? q.quote_no}-${who(q)}.pdf`;
}

async function render(el: ReactElement, name: string): Promise<File> {
  const blob = await pdf(el).toBlob();
  return new File([blob], name, { type: 'application/pdf' });
}
/** Le bon de réception et devis : les photos d'abord (réduites), puis le rendu. */
export async function buildReceptionPdf(input: ReceptionDocInput, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  if (!input.deposit && !input.quote) throw new Error('Dépôt introuvable');
  const photos = input.deposit ? await loadPdfPhotos(receptionPhotoPaths(input.deposit)) : new Map();
  const data = receptionDocData(input.deposit, input.quote, photos);
  return render(createElement(ReceptionQuotePDF, { data, settings, lang }), receptionFileName(input, lang));
}
export function buildReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  return render(createElement(CargoReceiptPDF, { q, p, settings, lang }), receiptFileName(q, p, lang));
}
export function buildInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  return render(createElement(CargoInvoicePDF, { q, settings, lang }), invoiceFileName(q, lang));
}

const receptionTitle = (input: ReceptionDocInput) => {
  const s = receptionSubject(input);
  return `${s.deposit_no} · ${s.client ? clientFullName(s.client) : 'Bon de réception'}`;
};
const invoiceTitle = (q: Quote, lang: CargoDocLang) => `${q.invoice_no ?? (lang === 'en' ? 'Invoice' : 'Facture')} · ${q.client ? clientFullName(q.client) : q.deposit_no}`;


// ── Télécharger : toujours un fichier, jamais de partage ──
export async function downloadReceptionPdf(input: ReceptionDocInput, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildReceptionPdf(input, settings, lang));
}
export async function downloadReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildReceiptPdf(q, p, settings, lang));
}
export async function downloadInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildInvoicePdf(q, settings, lang));
}

// ── Partager : la feuille de partage du téléphone (WhatsApp, WeChat), sinon téléchargement ──
export async function shareReceptionPdf(input: ReceptionDocInput, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildReceptionPdf(input, settings, lang), receptionTitle(input));
}
export async function shareReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildReceiptPdf(q, p, settings, lang), `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}
export async function shareInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildInvoicePdf(q, settings, lang), invoiceTitle(q, lang));
}

// ── Le geste par défaut (un seul bouton) : téléchargé sur ordinateur, partagé sur téléphone ──
export async function deliverReceptionPdf(input: ReceptionDocInput, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildReceptionPdf(input, settings, lang), receptionTitle(input));
}
export async function deliverReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildReceiptPdf(q, p, settings, lang), `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}
export async function deliverInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildInvoicePdf(q, settings, lang), invoiceTitle(q, lang));
}
