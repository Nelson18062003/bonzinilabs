// ============================================================
// LE MANIFESTE D'UNE EXPÉDITION AÉRIENNE — une page A4 (ou plus), pour la
// compagnie, le transitaire et l'entrepôt de Douala : la LTA, le vol, les
// dates, puis les colis client par client — numéro, contenu, poids,
// dimensions, m³ — et, pour l'entrepôt, si le devis est payé. jsPDF,
// Helvetica, même sortie que les autres documents (deliverFile).
// ============================================================
import { jsPDF } from 'jspdf';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { awbLabel, flightSentence, fmtDay, groupByClient, parcelUnpaid, type AirParcel, type AirShipment } from '@/lib/airShipment';
import type { CargoShipment } from '@/lib/cargo/model';
import type { ParcelWithDeposit } from '@/lib/reception';

/** Ce que le manifeste imprime en tête, quel que soit le transport. */
export interface ManifestHead {
  /** « Air cargo · Guangzhou → Douala » ou « Sea cargo · Guangzhou → Douala » */
  mode: string;
  /** La référence : « LTA 071-… » ou le numéro de conteneur. */
  ref: string;
  facts: [string, string][];
  notes?: string | null;
  fileRef: string;
}
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';

const M = 14;
const W = 210 - 2 * M;
const ascii = (s: string) => s.replace(/³/g, '3').replace(/[\u00A0\u202F]/g, ' ');

export function buildAirManifestPdf(a: AirShipment): jsPDF {
  const parcels = a.parcels ?? [];
  return buildManifestPdf({
    mode: 'Air cargo · Guangzhou → Douala',
    ref: awbLabel(a),
    facts: [
      ['LTA', awbLabel(a).replace('LTA ', '')],
      ['Vol', flightSentence(a)],
      ['Départ', `${a.origin}${a.etd ? ` · ${fmtDay(a.etd)}` : ''}`],
      ['Arrivée', `${a.destination}${a.eta ? ` · ${fmtDay(a.eta)}` : ''}`],
    ],
    notes: a.notes,
    fileRef: a.awb_number,
  }, parcels);
}

/** Le manifeste d'une boîte : les colis reçus à l'entrepôt et chargés dedans. */
export function buildSeaManifestPdf(s: CargoShipment, parcels: ParcelWithDeposit[]): jsPDF {
  return buildManifestPdf({
    mode: 'Sea cargo · Guangzhou → Douala',
    ref: s.container_number,
    facts: [
      ['Conteneur', `${s.container_number}${s.container_iso ? ` · ${s.container_iso}` : ''}`],
      ['B/L', s.bl_number || '—'],
      ['Navire', [s.vessel_name, s.voyage].filter(Boolean).join(' · ') || '—'],
      ['Arrivée', `${s.pod_name}${s.eta_promised ? ` · ${fmtDay(s.eta_promised)}` : ''}`],
    ],
    notes: s.notes,
    fileRef: s.container_number.replace(/\s+/g, ''),
  }, parcels as AirParcel[]);
}

function buildManifestPdf(h: ManifestHead, parcels: AirParcel[]): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const groups = groupByClient(parcels);
  const totalKg = parcels.reduce((t, p) => t + Number(p.weight_kg ?? 0), 0);
  const totalCbm = parcels.reduce((t, p) => t + Number(p.cbm ?? 0), 0);
  const unpaid = parcels.filter(parcelUnpaid).length;
  let y = M;

  // En-tête.
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text(LEGAL_NAME, M, y + 6);
  pdf.setFontSize(16); pdf.text('MANIFESTE', 210 - M, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90);
  pdf.text(ascii(h.mode), M, y + 12);
  pdf.text(fmtDay(new Date().toISOString()), 210 - M, y + 12, { align: 'right' });
  pdf.setTextColor(0);
  y += 20;
  pdf.setDrawColor(200); pdf.line(M, y, 210 - M, y); y += 7;

  // La fiche : LTA, vol, dates, totaux.
  const facts: [string, string][] = [
    ...h.facts,
    ['Colis', `${parcels.length} · ${formatKg(totalKg)} · ${formatCbm(totalCbm)}`],
    ['Clients', String(groups.length)],
  ];
  const colW = W / 3;
  facts.forEach(([k, v], i) => {
    const x = M + (i % 3) * colW; const yy = y + Math.floor(i / 3) * 12;
    pdf.setFontSize(7.5); pdf.setTextColor(120); pdf.text(k.toUpperCase(), x, yy);
    pdf.setFontSize(10.5); pdf.setTextColor(0); pdf.setFont('helvetica', 'bold'); pdf.text(ascii(v), x, yy + 5); pdf.setFont('helvetica', 'normal');
  });
  y += 30;

  // Le tableau, client par client.
  const cols = { n: M, c: M + 30, d: M + 78, w: M + 122, dim: M + 142, cbm: M + 166, pay: 210 - M };
  const head = () => {
    pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 7, 'F');
    pdf.setFontSize(7.5); pdf.setTextColor(90); pdf.setFont('helvetica', 'bold');
    pdf.text('N° COLIS', cols.n + 2, y + 5); pdf.text('CLIENT', cols.c, y + 5); pdf.text('CONTENU', cols.d, y + 5);
    pdf.text('POIDS', cols.w + 12, y + 5, { align: 'right' }); pdf.text('DIMENSIONS', cols.dim + 20, y + 5, { align: 'right' }); pdf.text('M3', cols.cbm + 10, y + 5, { align: 'right' }); pdf.text('DEVIS', cols.pay, y + 5, { align: 'right' });
    y += 7; pdf.setTextColor(0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  };
  head();
  for (const g of groups) {
    const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
    for (const p of g.parcels) {
      if (y > 272) { pdf.addPage(); y = M; head(); }
      const desc = pdf.splitTextToSize(ascii(p.description || p.kind || 'Colis'), cols.w - cols.d - 3) as string[];
      pdf.setFont('helvetica', 'bold'); pdf.text(p.parcel_no, cols.n + 2, y + 4.5); pdf.setFont('helvetica', 'normal');
      pdf.text(pdf.splitTextToSize(ascii(`${name}${g.client?.customer_code ? ` · ${g.client.customer_code}` : ''}`), cols.d - cols.c - 3) as string[], cols.c, y + 4.5);
      pdf.text(desc, cols.d, y + 4.5);
      pdf.text(ascii(formatKg(p.weight_kg)), cols.w + 12, y + 4.5, { align: 'right' });
      pdf.text(ascii(formatDims(p)), cols.dim + 20, y + 4.5, { align: 'right' });
      pdf.text(ascii(formatCbm(p.cbm)), cols.cbm + 10, y + 4.5, { align: 'right' });
      const unpaid = parcelUnpaid(p);
      if (unpaid) pdf.setTextColor(180, 30, 30);
      pdf.text(unpaid ? (Number(p.quote_total_xaf ?? 0) > 0 ? ascii(`reste ${xaf(Number(p.quote_total_xaf) - Number(p.quote_paid_xaf ?? 0))}`) : 'sans prix') : 'payé', cols.pay, y + 4.5, { align: 'right' });
      pdf.setTextColor(0);
      y += 3 + Math.max(1, desc.length) * 3.8;
      pdf.setDrawColor(230); pdf.line(M, y, 210 - M, y);
    }
    // Le sous-total du client.
    if (y > 272) { pdf.addPage(); y = M; head(); }
    pdf.setFontSize(8); pdf.setTextColor(90);
    pdf.text(ascii(`${name} · ${g.parcels.length} colis · ${formatKg(g.kg)} · ${formatCbm(g.cbm)}`), cols.pay, y + 4, { align: 'right' });
    pdf.setTextColor(0); pdf.setFontSize(8.5);
    y += 7;
  }
  // Le total.
  y += 3;
  pdf.setFillColor(30, 30, 30); pdf.rect(M, y, W, 9, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
  pdf.text(`TOTAL · ${parcels.length} colis`, M + 3, y + 6);
  pdf.text(ascii(`${formatKg(totalKg)} · ${formatCbm(totalCbm)}${unpaid > 0 ? ` · ${unpaid} colis non soldé${unpaid > 1 ? 's' : ''}` : ' · tout payé'}`), 210 - M - 3, y + 6, { align: 'right' });
  pdf.setTextColor(0); pdf.setFont('helvetica', 'normal');
  y += 16;
  if (h.notes) { pdf.setFontSize(9); pdf.setTextColor(90); pdf.text(pdf.splitTextToSize(ascii(h.notes), W) as string[], M, y); pdf.setTextColor(0); }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setTextColor(150); pdf.setFontSize(8);
    pdf.text(ascii(`${LEGAL_NAME} · Manifeste ${h.ref} · page ${i}/${pages}`), 105, 290, { align: 'center' });
    pdf.setTextColor(0);
  }
  return pdf;
}

export function manifestFileName(a: AirShipment): string {
  return `bonzini-manifeste-${a.awb_number}.pdf`;
}

export async function deliverAirManifestPdf(a: AirShipment): Promise<'shared' | 'downloaded'> {
  const pdf = buildAirManifestPdf(a);
  const file = new File([pdf.output('blob')], manifestFileName(a), { type: 'application/pdf' });
  return deliverFile(file, `Manifeste ${awbLabel(a)}`);
}

export async function deliverSeaManifestPdf(s: CargoShipment, parcels: ParcelWithDeposit[]): Promise<'shared' | 'downloaded'> {
  const pdf = buildSeaManifestPdf(s, parcels);
  const file = new File([pdf.output('blob')], `bonzini-manifeste-${s.container_number.replace(/\s+/g, '')}.pdf`, { type: 'application/pdf' });
  return deliverFile(file, `Manifeste ${s.container_number}`);
}
