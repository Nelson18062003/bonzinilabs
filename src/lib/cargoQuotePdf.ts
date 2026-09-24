// ============================================================
// LE DEVIS, LE REÇU, LA FACTURE ACQUITTÉE — en PDF, avec l'en-tête et le pied
// officiels (src/lib/pdf, @react-pdf/renderer) et l'émetteur NORTON GAUSS
// BONZINI SARL. Ici : la fabrication du fichier et sa remise (téléchargement,
// ou feuille de partage sur téléphone). Le rendu vit dans
// src/lib/pdf/templates/CargoDocumentsPDF.tsx.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import type { ShippingSettings } from '@/lib/customerCode';
import { clientFullName } from '@/lib/reception';
import { xaf, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { CargoInvoicePDF, CargoQuotePDF, CargoReceiptPDF } from '@/lib/pdf/templates/CargoDocumentsPDF';

export function quoteFileName(q: Quote): string { return `bonzini-devis-${q.quote_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`; }
export function receiptFileName(q: Quote, p: QuotePayment): string { return `bonzini-recu-${p.receipt_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`; }
export function invoiceFileName(q: Quote): string { return `bonzini-facture-${q.invoice_no ?? q.quote_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`; }

export async function buildQuotePdf(q: Quote, settings: ShippingSettings): Promise<File> {
  const el: ReactElement = createElement(CargoQuotePDF, { q, settings });
  const blob = await pdf(el).toBlob();
  return new File([blob], quoteFileName(q), { type: 'application/pdf' });
}
export async function buildReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings): Promise<File> {
  const el: ReactElement = createElement(CargoReceiptPDF, { q, p, settings });
  const blob = await pdf(el).toBlob();
  return new File([blob], receiptFileName(q, p), { type: 'application/pdf' });
}
export async function buildInvoicePdf(q: Quote, settings: ShippingSettings): Promise<File> {
  const el: ReactElement = createElement(CargoInvoicePDF, { q, settings });
  const blob = await pdf(el).toBlob();
  return new File([blob], invoiceFileName(q), { type: 'application/pdf' });
}

/** Le PDF part dans la feuille de partage (WhatsApp, WeChat) ou se télécharge. */
export async function deliverQuotePdf(q: Quote, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  return deliverFile(await buildQuotePdf(q, settings), `${q.quote_no} · ${q.client ? clientFullName(q.client) : q.deposit_no}`);
}
export async function deliverReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  return deliverFile(await buildReceiptPdf(q, p, settings), `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}
export async function deliverInvoicePdf(q: Quote, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  return deliverFile(await buildInvoicePdf(q, settings), `${q.invoice_no ?? 'Facture'} · ${q.client ? clientFullName(q.client) : q.deposit_no}`);
}

/** Téléchargement direct, sans feuille de partage (desktop, ou quand on veut le fichier). */
export async function downloadQuotePdf(q: Quote, settings: ShippingSettings): Promise<void> { downloadFile(await buildQuotePdf(q, settings)); }
export async function downloadReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings): Promise<void> { downloadFile(await buildReceiptPdf(q, p, settings)); }
export async function downloadInvoicePdf(q: Quote, settings: ShippingSettings): Promise<void> { downloadFile(await buildInvoicePdf(q, settings)); }
