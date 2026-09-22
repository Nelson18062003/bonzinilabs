// ============================================================
// LES DOCUMENTS DU CLIENT, EN PDF — une page A4, en français, que l'admin
// envoie par WhatsApp. Trois papiers, un par moment de la chaîne :
//   · le DEVIS (DV-…)             quand les prix sont posés
//   · le REÇU (RE-…)              à chaque encaissement
//   · la FACTURE ACQUITTÉE (FA-…) quand tout est payé — le document final
// jsPDF et ses polices de base (Helvetica) : pas d'idéogrammes ici, rien à
// charger. Même sortie que l'étiquette : deliverFile → feuille de partage
// sur téléphone, téléchargement sinon.
// ============================================================
import { jsPDF } from 'jspdf';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { BASIS_UNIT, METHOD_LABEL, PLACE_LABEL, activePayments, quoteBalance, quotePaid, xaf, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';

const M = 18; // marge, mm
const W = 210 - 2 * M;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Les ASCII de jsPDF ne connaissent pas « ³ » : on écrit m3. Les espaces fines des milliers redeviennent des espaces. */
const ascii = (s: string) => s.replace(/³/g, '3').replace(/[\u00A0\u202F]/g, ' ');

type Kind = 'DEVIS' | 'REÇU' | 'FACTURE ACQUITTÉE';

/** L'en-tête commun : la société à gauche, le type et le numéro à droite ; puis le client et le dépôt. Renvoie le y courant. */
function header(pdf: jsPDF, q: Quote, settings: ShippingSettings, kind: Kind, no: string, date: string | null | undefined): number {
  const company = settings.company;
  const mode = q.location === 'office' ? 'Air cargo' : 'Sea cargo';
  let y = M;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('Bonzini Labs', M, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(90);
  pdf.text([company.nameEn, company.email, `WhatsApp ${company.whatsapp}`].filter(Boolean), M, y + 12);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(kind.length > 10 ? 15 : 20); pdf.text(ascii(kind), 210 - M, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.text([no, fmtDate(date)], 210 - M, y + 12, { align: 'right' });
  y += 26;
  pdf.setDrawColor(200); pdf.line(M, y, 210 - M, y); y += 8;

  const name = q.client ? clientFullName(q.client) : 'Client à attribuer';
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('CLIENT', M, y); pdf.text('DÉPÔT', M + W / 2, y);
  pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text(name, M, y + 6); pdf.text(`${q.deposit_no} · ${mode}`, M + W / 2, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  pdf.text([q.client?.customer_code ?? '', q.client?.phone ?? '', [q.client?.city, q.client?.country].filter(Boolean).join(', ')].filter(Boolean), M, y + 12);
  pdf.text([`Reçu le ${fmtDate(q.closed_at ?? q.opened_at)} à Guangzhou`, `${q.lines.filter((l) => l.kind === 'parcel').length} colis · devis ${q.quote_no}`], M + W / 2, y + 12);
  return y + 26;
}

/** Le tableau des lignes du devis, avec son TOTAL. Renvoie le y courant. */
function linesTable(pdf: jsPDF, q: Quote, y: number): number {
  const cols = { n: M, d: M + 12, b: M + 92, q: M + 118, u: M + 140, a: 210 - M };
  pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 8, 'F');
  pdf.setFontSize(8); pdf.setTextColor(90); pdf.setFont('helvetica', 'bold');
  pdf.text('N°', cols.n + 2, y + 5.5); pdf.text('DÉSIGNATION', cols.d, y + 5.5); pdf.text('BASE', cols.b, y + 5.5);
  pdf.text('QTÉ', cols.q, y + 5.5, { align: 'right' }); pdf.text('P.U.', cols.u + 10, y + 5.5, { align: 'right' }); pdf.text('MONTANT', cols.a, y + 5.5, { align: 'right' });
  y += 8; pdf.setTextColor(0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  for (const l of q.lines) {
    if (y > 250) { pdf.addPage(); y = M; }
    const label = l.kind === 'parcel' ? (l.description || l.label || l.kind_of_parcel || 'Colis') : l.label;
    const no = l.kind === 'parcel' ? String(l.parcel_seq ?? l.seq).padStart(2, '0') : '';
    const basis = l.kind !== 'parcel' ? (l.kind === 'discount' ? 'remise' : 'frais') : l.basis === 'fixed' ? 'fixe' : `${BASIS_UNIT[l.basis]}`;
    const qty = l.basis === 'fixed' || l.quantity == null ? '' : `${Number(l.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${BASIS_UNIT[l.basis]}`;
    const unit = l.basis === 'fixed' || l.unit_price_xaf == null ? '' : xaf(l.unit_price_xaf);
    const lines = pdf.splitTextToSize(ascii(label), cols.b - cols.d - 4) as string[];
    pdf.text(no, cols.n + 2, y + 5.5);
    pdf.text(lines, cols.d, y + 5.5);
    pdf.text(ascii(basis), cols.b, y + 5.5);
    pdf.text(ascii(qty), cols.q, y + 5.5, { align: 'right' });
    pdf.text(ascii(unit), cols.u + 10, y + 5.5, { align: 'right' });
    pdf.setFont('helvetica', 'bold'); pdf.text(ascii(xaf(l.amount_xaf)), cols.a, y + 5.5, { align: 'right' }); pdf.setFont('helvetica', 'normal');
    y += 4 + Math.max(1, lines.length) * 4.2;
    pdf.setDrawColor(230); pdf.line(M, y, 210 - M, y);
  }
  y += 6;
  pdf.setFillColor(30, 30, 30); pdf.rect(M + W - 78, y, 78, 11, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text('TOTAL', M + W - 74, y + 7.5); pdf.text(ascii(xaf(q.total_xaf)), 210 - M - 3, y + 7.5, { align: 'right' });
  pdf.setTextColor(0); pdf.setFont('helvetica', 'normal');
  return y + 20;
}

/** Les encaissements, en petites lignes : reçu, date, mode, lieu, montant. Renvoie le y courant. */
function paymentsBlock(pdf: jsPDF, payments: QuotePayment[], y: number, title: string): number {
  if (payments.length === 0) return y;
  if (y > 230) { pdf.addPage(); y = M; }
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(title, M, y); y += 4;
  pdf.setTextColor(0); pdf.setFontSize(9.5);
  for (const p of payments) {
    const left = `${p.receipt_no} · ${fmtDate(p.paid_at)} · ${METHOD_LABEL[p.method]}${p.reference ? ` (${p.reference})` : ''} · ${PLACE_LABEL[p.place]}`;
    pdf.text(ascii(left), M, y + 4);
    pdf.setFont('helvetica', 'bold'); pdf.text(ascii(xaf(p.amount_xaf)), 210 - M, y + 4, { align: 'right' }); pdf.setFont('helvetica', 'normal');
    y += 6;
  }
  return y + 4;
}

function footer(pdf: jsPDF, text: string) {
  pdf.setTextColor(150); pdf.setFontSize(8);
  pdf.text(ascii(text), 105, 290, { align: 'center' });
  pdf.setTextColor(0);
}

function notes(pdf: jsPDF, lines: string[], y: number): number {
  const kept = lines.filter(Boolean).map(ascii);
  pdf.setFontSize(9); pdf.setTextColor(90);
  pdf.text(kept, M, y);
  pdf.setTextColor(0);
  return y + kept.length * 4.5;
}

// ── Le devis ──
export function buildQuotePdf(q: Quote, settings: ShippingSettings): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = header(pdf, q, settings, 'DEVIS', q.quote_no, q.sent_at ?? q.updated_at);
  y = linesTable(pdf, q, y);
  notes(pdf, [
    'Devis valable 30 jours. Règlement possible avant le départ de Chine ou au retrait à Douala.',
    'Les colis sont remis sur présentation du code client, une fois le devis réglé.',
    q.notes ?? '',
  ], y);
  footer(pdf, `Bonzini Labs · ${q.quote_no} · ${q.deposit_no}`);
  return pdf;
}

export function quoteFileName(q: Quote): string {
  return `bonzini-devis-${q.quote_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`;
}

/** Le PDF part dans la feuille de partage (WhatsApp, WeChat) ou se télécharge. */
export async function deliverQuotePdf(q: Quote, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  const pdf = buildQuotePdf(q, settings);
  const file = new File([pdf.output('blob')], quoteFileName(q), { type: 'application/pdf' });
  return deliverFile(file, `${q.quote_no} · ${q.client ? clientFullName(q.client) : q.deposit_no}`);
}

// ── Le reçu d'un encaissement ──
export function buildReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = header(pdf, q, settings, 'REÇU', p.receipt_no, p.paid_at);

  // Le montant, en grand : c'est ce que le client garde.
  pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 30, 'F');
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('MONTANT REÇU', M + 6, y + 8);
  pdf.setTextColor(0); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24); pdf.text(ascii(xaf(p.amount_xaf)), M + 6, y + 21);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  pdf.text([
    `${METHOD_LABEL[p.method]}${p.reference ? ` · réf. ${p.reference}` : ''}`,
    ascii(PLACE_LABEL[p.place]),
    `Le ${fmtDateTime(p.paid_at)}${p.received_by_name ? ` · reçu par ${p.received_by_name}` : ''}`,
  ], 210 - M - 6, y + 10, { align: 'right' });
  y += 40;

  // Où en est le devis après ce paiement.
  const paid = quotePaid(q); const balance = quoteBalance(q);
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('LE DEVIS ' + q.quote_no, M, y); y += 5;
  pdf.setTextColor(0); pdf.setFontSize(10);
  const rows: [string, string][] = [['Total du devis', xaf(q.total_xaf)], ['Encaissé à ce jour', xaf(paid)], ['Reste à payer', xaf(balance)]];
  for (const [k, v] of rows) {
    pdf.text(k, M, y + 4);
    pdf.setFont('helvetica', k === 'Reste à payer' ? 'bold' : 'normal'); pdf.text(ascii(v), 210 - M, y + 4, { align: 'right' }); pdf.setFont('helvetica', 'normal');
    pdf.setDrawColor(230); pdf.line(M, y + 7, 210 - M, y + 7);
    y += 8;
  }
  y += 6;
  y = paymentsBlock(pdf, activePayments(q), y, 'TOUS LES ENCAISSEMENTS SUR CE DEVIS');
  if (p.note) y = notes(pdf, [p.note], y + 2);
  notes(pdf, [balance > 0 ? 'Les colis sont remis une fois le devis entièrement réglé.' : 'Devis entièrement réglé : les colis sont remis sur présentation du code client.'], y + 4);
  footer(pdf, `Bonzini Labs · ${p.receipt_no} · ${q.quote_no} · ${q.deposit_no}`);
  return pdf;
}

export function receiptFileName(q: Quote, p: QuotePayment): string {
  return `bonzini-recu-${p.receipt_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`;
}

export async function deliverReceiptPdf(q: Quote, p: QuotePayment, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  const pdf = buildReceiptPdf(q, p, settings);
  const file = new File([pdf.output('blob')], receiptFileName(q, p), { type: 'application/pdf' });
  return deliverFile(file, `${p.receipt_no} · ${xaf(p.amount_xaf)}`);
}

// ── La facture acquittée ──
export function buildInvoicePdf(q: Quote, settings: ShippingSettings): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = header(pdf, q, settings, 'FACTURE ACQUITTÉE', q.invoice_no ?? '', q.invoiced_at ?? q.paid_at);
  y = linesTable(pdf, q, y);
  // Le tampon « ACQUITTÉE » : encaissée en entier, tel jour.
  pdf.setDrawColor(30); pdf.setLineWidth(0.6); pdf.rect(M, y - 6, 70, 14);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text('ACQUITTÉE', M + 5, y + 1);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.text(ascii(`le ${fmtDate(q.paid_at ?? q.invoiced_at)} · ${xaf(quotePaid(q))}`), M + 5, y + 5.5);
  pdf.setLineWidth(0.2);
  y += 16;
  y = paymentsBlock(pdf, activePayments(q), y, 'RÉGLÉE PAR');
  notes(pdf, ['Facture acquittée : aucun montant ne reste dû sur ce dépôt.', 'Les colis sont remis sur présentation du code client.', q.notes ?? ''], y + 2);
  footer(pdf, `Bonzini Labs · ${q.invoice_no ?? ''} · ${q.quote_no} · ${q.deposit_no}`);
  return pdf;
}

export function invoiceFileName(q: Quote): string {
  return `bonzini-facture-${q.invoice_no ?? q.quote_no}-${q.client?.customer_code ?? q.deposit_no}.pdf`;
}

export async function deliverInvoicePdf(q: Quote, settings: ShippingSettings): Promise<'shared' | 'downloaded'> {
  const pdf = buildInvoicePdf(q, settings);
  const file = new File([pdf.output('blob')], invoiceFileName(q), { type: 'application/pdf' });
  return deliverFile(file, `${q.invoice_no ?? 'Facture'} · ${q.client ? clientFullName(q.client) : q.deposit_no}`);
}
