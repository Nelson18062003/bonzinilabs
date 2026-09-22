// ============================================================
// LE BON DE RETRAIT — une page A4 : qui a emporté quoi, quand, à Douala,
// avec la signature. C'est la preuve que la marchandise a changé de mains.
// jsPDF, Helvetica ; la signature (PNG) est incrustée quand on l'a.
// ============================================================
import { jsPDF } from 'jspdf';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { transportLabel, type Release } from '@/lib/warehouse';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';

const M = 18;
const W = 210 - 2 * M;
const ascii = (s: string) => s.replace(/³/g, '3').replace(/[\u00A0\u202F]/g, ' ');
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export function buildReleaseNotePdf(r: Release, signatureDataUrl?: string | null): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = M;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('Bonzini Labs', M, y + 6);
  pdf.setFontSize(16); pdf.text('BON DE RETRAIT', 210 - M, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90);
  pdf.text('Entrepôt de Douala', M, y + 12);
  pdf.text([r.release_no, fmt(r.released_at)], 210 - M, y + 12, { align: 'right' });
  pdf.setTextColor(0);
  y += 24; pdf.setDrawColor(200); pdf.line(M, y, 210 - M, y); y += 8;

  const name = r.client ? clientFullName(r.client) : 'Client';
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('CLIENT', M, y); pdf.text('REMIS À', M + W / 2, y);
  pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text(name, M, y + 6); pdf.text(r.picked_by_name, M + W / 2, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  pdf.text([r.client?.customer_code ?? '', r.client?.phone ?? ''].filter(Boolean), M, y + 12);
  pdf.text([r.picked_by_phone ?? '', r.released_by_name ? `Remis par ${r.released_by_name}` : ''].filter(Boolean), M + W / 2, y + 12);
  y += 26;

  const cols = { n: M, d: M + 34, t: M + 96, w: M + 132, dim: M + 150, cbm: 210 - M };
  pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 8, 'F');
  pdf.setFontSize(8); pdf.setTextColor(90); pdf.setFont('helvetica', 'bold');
  pdf.text('N° COLIS', cols.n + 2, y + 5.5); pdf.text('CONTENU', cols.d, y + 5.5); pdf.text('ARRIVÉ PAR', cols.t, y + 5.5);
  pdf.text('POIDS', cols.w + 12, y + 5.5, { align: 'right' }); pdf.text('DIMENSIONS', cols.dim + 26, y + 5.5, { align: 'right' }); pdf.text('M3', cols.cbm, y + 5.5, { align: 'right' });
  y += 8; pdf.setTextColor(0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
  let kg = 0; let cbm = 0;
  for (const p of r.parcels) {
    if (y > 235) { pdf.addPage(); y = M; }
    const desc = pdf.splitTextToSize(ascii(p.description || p.kind || 'Colis'), cols.t - cols.d - 4) as string[];
    pdf.setFont('helvetica', 'bold'); pdf.text(p.parcel_no, cols.n + 2, y + 5.5); pdf.setFont('helvetica', 'normal');
    pdf.text(desc, cols.d, y + 5.5);
    pdf.text(ascii(transportLabel(p)), cols.t, y + 5.5);
    pdf.text(ascii(formatKg(p.weight_kg)), cols.w + 12, y + 5.5, { align: 'right' });
    pdf.text(ascii(formatDims(p)), cols.dim + 26, y + 5.5, { align: 'right' });
    pdf.text(ascii(formatCbm(p.cbm)), cols.cbm, y + 5.5, { align: 'right' });
    if (p.condition === 'damaged') { pdf.setFontSize(8); pdf.setTextColor(180, 30, 30); pdf.text(ascii(`Abîmé à l'arrivée${p.condition_note ? ` : ${p.condition_note}` : ''}`), cols.d, y + 5.5 + desc.length * 4.2); pdf.setTextColor(0); pdf.setFontSize(9.5); y += 4; }
    kg += Number(p.weight_kg ?? 0); cbm += Number(p.cbm ?? 0);
    y += 4 + Math.max(1, desc.length) * 4.2;
    pdf.setDrawColor(230); pdf.line(M, y, 210 - M, y);
  }
  y += 6;
  pdf.setFillColor(30, 30, 30); pdf.rect(M, y, W, 10, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5);
  pdf.text(`${r.parcels.length} COLIS REMIS`, M + 3, y + 6.8);
  pdf.text(ascii(`${formatKg(kg)} · ${formatCbm(cbm)}`), 210 - M - 3, y + 6.8, { align: 'right' });
  pdf.setTextColor(0); pdf.setFont('helvetica', 'normal');
  y += 20;

  // La signature et la mention.
  if (y > 215) { pdf.addPage(); y = M; }
  pdf.setFontSize(9); pdf.setTextColor(90);
  pdf.text(['Je reconnais avoir reçu les colis ci-dessus, en l\'état constaté à la remise.', 'Toute réclamation sur le contenu se fait avant de quitter l\'entrepôt.'].map(ascii), M, y);
  pdf.setTextColor(0);
  y += 12;
  pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('SIGNATURE', M, y); pdf.text('DATE', M + W / 2, y); pdf.setTextColor(0);
  pdf.setDrawColor(180); pdf.rect(M, y + 3, 80, 34);
  if (signatureDataUrl) { try { pdf.addImage(signatureDataUrl, 'PNG', M + 2, y + 5, 76, 30); } catch { /* signature illisible : cadre vide */ } }
  pdf.setFontSize(10); pdf.text(fmt(r.released_at), M + W / 2, y + 10);
  pdf.setFontSize(9.5); pdf.text(r.picked_by_name, M, y + 43);
  if (r.note) { pdf.setFontSize(9); pdf.setTextColor(90); pdf.text(pdf.splitTextToSize(ascii(r.note), W) as string[], M, y + 52); pdf.setTextColor(0); }

  pdf.setTextColor(150); pdf.setFontSize(8);
  pdf.text(ascii(`Bonzini Labs · ${r.release_no} · ${name}`), 105, 290, { align: 'center' });
  return pdf;
}

export function releaseFileName(r: Release): string {
  return `bonzini-bon-retrait-${r.release_no}-${r.client?.customer_code ?? ''}.pdf`;
}

export async function deliverReleaseNotePdf(r: Release, signatureDataUrl?: string | null): Promise<'shared' | 'downloaded'> {
  const pdf = buildReleaseNotePdf(r, signatureDataUrl);
  const file = new File([pdf.output('blob')], releaseFileName(r), { type: 'application/pdf' });
  return deliverFile(file, `${r.release_no} · ${r.client ? clientFullName(r.client) : r.picked_by_name}`);
}
