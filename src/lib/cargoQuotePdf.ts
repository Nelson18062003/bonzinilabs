// ============================================================
// LE DEVIS EN PDF — une page A4, en français, que l'admin envoie au client
// par WhatsApp. jsPDF et ses polices de base (Helvetica) : un devis n'a pas
// d'idéogrammes, et rien à charger. Même sortie que l'étiquette :
// deliverFile → feuille de partage sur téléphone, téléchargement sinon.
// ============================================================
import { jsPDF } from 'jspdf';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { BASIS_UNIT, xaf, type Quote } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';

const M = 18; // marge, mm
const W = 210 - 2 * M;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Les ASCII de jsPDF ne connaissent pas « ³ » : on écrit m3. Les chiffres, eux, passent. */
const ascii = (s: string) => s.replace(/³/g, '3').replace(/[\u00A0\u202F]/g, ' ');

export function buildQuotePdf(q: Quote, settings: ShippingSettings): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const company = settings.company;
  const mode = q.location === 'office' ? 'Air cargo' : 'Sea cargo';
  let y = M;

  // En-tête : la société à gauche, le numéro à droite.
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('Bonzini Labs', M, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(90);
  pdf.text([company.nameEn, company.email, `WhatsApp ${company.whatsapp}`].filter(Boolean), M, y + 12);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.text('DEVIS', 210 - M, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.text([q.quote_no, fmtDate(q.sent_at ?? q.updated_at)], 210 - M, y + 12, { align: 'right' });
  y += 26;
  pdf.setDrawColor(200); pdf.line(M, y, 210 - M, y); y += 8;

  // Client et dépôt, deux colonnes.
  const name = q.client ? clientFullName(q.client) : 'Client à attribuer';
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('CLIENT', M, y); pdf.text('DÉPÔT', M + W / 2, y);
  pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text(name, M, y + 6); pdf.text(`${q.deposit_no} · ${mode}`, M + W / 2, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  pdf.text([q.client?.customer_code ?? '', q.client?.phone ?? '', [q.client?.city, q.client?.country].filter(Boolean).join(', ')].filter(Boolean), M, y + 12);
  pdf.text([`Reçu le ${fmtDate(q.closed_at ?? q.opened_at)} à Guangzhou`, `${q.lines.filter((l) => l.kind === 'parcel').length} colis`], M + W / 2, y + 12);
  y += 26;

  // Le tableau.
  const cols = { n: M, d: M + 12, b: M + 92, q: M + 118, u: M + 140, a: 210 - M };
  pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 8, 'F');
  pdf.setFontSize(8); pdf.setTextColor(90); pdf.setFont('helvetica', 'bold');
  pdf.text('N°', cols.n + 2, y + 5.5); pdf.text('DÉSIGNATION', cols.d, y + 5.5); pdf.text('BASE', cols.b, y + 5.5);
  pdf.text('QTÉ', cols.q, y + 5.5, { align: 'right' }); pdf.text('P.U.', cols.u + 10, y + 5.5, { align: 'right' }); pdf.text('MONTANT', cols.a, y + 5.5, { align: 'right' });
  y += 8; pdf.setTextColor(0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  for (const l of q.lines) {
    if (y > 262) { pdf.addPage(); y = M; }
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
  y += 20;

  pdf.setFontSize(9); pdf.setTextColor(90);
  const notes = [
    'Devis valable 30 jours. Règlement possible avant le départ de Chine ou au retrait à Douala.',
    'Les colis sont remis sur présentation du code client, une fois le devis réglé.',
    q.notes ? ascii(q.notes) : '',
  ].filter(Boolean);
  pdf.text(notes, M, y);
  pdf.setTextColor(150); pdf.setFontSize(8);
  pdf.text(`Bonzini Labs · ${q.quote_no} · ${q.deposit_no}`, 105, 290, { align: 'center' });
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
