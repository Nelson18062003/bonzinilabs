// ============================================================
// LE DEVIS, LE REÇU, LA FACTURE ACQUITTÉE — en PDF, avec l'en-tête et le pied
// officiels (src/lib/pdf, @react-pdf/renderer) et l'émetteur NORTON GAUSS
// BONZINI SARL. Le rendu vit dans src/lib/pdf/templates/CargoDocumentsPDF.tsx.
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
import { clientFullName } from '@/lib/reception';
import { xaf, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { CargoInvoicePDF, CargoQuotePDF, CargoReceiptPDF, type CargoDocLang } from '@/lib/pdf/templates/CargoDocumentsPDF';

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

const who = (q: Quote) => q.client?.customer_code ?? q.deposit_no;
export function quoteFileName(q: Quote, lang: CargoDocLang = 'fr'): string {
  return lang === 'en' ? `bonzini-quote-${q.quote_no}-${who(q)}.pdf` : `bonzini-devis-${q.quote_no}-${who(q)}.pdf`;
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
export function buildQuotePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  return render(createElement(CargoQuotePDF, { q, settings, lang }), quoteFileName(q, lang));
}
export function buildReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  return render(createElement(CargoReceiptPDF, { q, p, settings, lang }), receiptFileName(q, p, lang));
}
export function buildInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = 'fr'): Promise<File> {
  return render(createElement(CargoInvoicePDF, { q, settings, lang }), invoiceFileName(q, lang));
}

const quoteTitle = (q: Quote) => `${q.quote_no} · ${q.client ? clientFullName(q.client) : q.deposit_no}`;
const invoiceTitle = (q: Quote, lang: CargoDocLang) => `${q.invoice_no ?? (lang === 'en' ? 'Invoice' : 'Facture')} · ${q.client ? clientFullName(q.client) : q.deposit_no}`;

// ── Télécharger : toujours un fichier, jamais de partage ──
export async function downloadQuotePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildQuotePdf(q, settings, lang));
}
export async function downloadReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildReceiptPdf(q, p, settings, lang));
}
export async function downloadInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<void> {
  downloadFile(await buildInvoicePdf(q, settings, lang));
}

// ── Partager : la feuille de partage du téléphone (WhatsApp, WeChat), sinon téléchargement ──
export async function shareQuotePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildQuotePdf(q, settings, lang), quoteTitle(q));
}
export async function shareReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildReceiptPdf(q, p, settings, lang), `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}
export async function shareInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return deliverFile(await buildInvoicePdf(q, settings, lang), invoiceTitle(q, lang));
}

// ── Le geste par défaut (un seul bouton) : téléchargé sur ordinateur, partagé sur téléphone ──
export async function deliverQuotePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildQuotePdf(q, settings, lang), quoteTitle(q));
}
export async function deliverReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildReceiptPdf(q, p, settings, lang), `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}
export async function deliverInvoicePdf(q: Quote, settings: ShippingSettings, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildInvoicePdf(q, settings, lang), invoiceTitle(q, lang));
}
