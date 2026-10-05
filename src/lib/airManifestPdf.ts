// ============================================================
// LE MANIFESTE D'UNE EXPÉDITION AÉRIENNE — une page A4 (ou plus), pour la
// compagnie, le transitaire et l'entrepôt de Douala : la LTA, le vol, les
// dates, puis les colis client par client — numéro, contenu, poids,
// dimensions, m³ — et, pour l'entrepôt, si le devis est payé. En avion,
// quand les colis voyagent en paquets de 32 kg, une colonne « PAQUET » dit
// dans quel paquet chercher chaque colis (le manifeste maritime n'en a pas).
// La LTA provisoire (PROV-…) ne s'imprime jamais : « à venir ». jsPDF,
// Helvetica. Remise : TÉLÉCHARGÉ sur ordinateur (jamais la feuille de partage
// de Windows), partagé sur téléphone (deliverFile).
// ============================================================
import { jsPDF } from 'jspdf';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { saveOrShareFile, type Outcome } from '@/components/customer-code/exportShippingLabel';
import { awbFileRef, awbLabel, flightSentence, fmtDay, formatAwb, groupByClient, parcelUnpaid, type AirParcel, type AirShipment } from '@/lib/airShipment';
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
  /** Avion : une colonne « PAQUET » (le paquet de 32 kg de chaque colis). Absente du manifeste maritime. */
  packageColumn?: boolean;
}
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';

const M = 14;
const W = 210 - 2 * M;
/** Le bas du contenu (mm) : le pied de page s'imprime à 290. */
const FOOT = 283;
// Helvetica (jsPDF) n'imprime que le jeu WinAnsi : hors de ce jeu, un caractère sort en
// octets parasites (« Guangzhou → Douala » s'imprimait « Guangzhou !' Douala »). Les
// flèches deviennent « > », les espaces fines des espaces, le reste (chinois…) « ? ».
const ascii = (s: string) => s
  .replace(/³/g, '3').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/[→⇒➔⟶]/g, '>')
  .replace(/[^\n\r\t\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '?');

/** Une colonne du tableau, de x0 à x1 (mm) : le texte part de x0, les nombres s'alignent sur x1. */
type Span = [x0: number, x1: number];
export interface ManifestColumns { n: Span; k: Span | null; c: Span; d: Span; w: Span; dim: Span; cbm: Span; pay: Span }
/** L'écart entre deux colonnes (mm). */
export const MANIFEST_COL_GAP = 3;

/**
 * Les colonnes du tableau, de gauche à droite et bord à bord sur la largeur utile, sans
 * chevauchement. Les colonnes de chiffres ont la largeur de leur valeur la plus longue en
 * Helvetica 8,5 : « RC-000122-01 » gras 19,5 mm (+ 2 de marge), « PQ-000041 » 15,2,
 * « 123,4 kg » 11,5, « 120 × 100 × 100 cm » 26,2, « 0,096 m3 » 12,4, « reste 1 157 300 XAF »
 * 27,3. Client et contenu se partagent le reste et passent à la ligne.
 */
export function manifestColumns(packageColumn: boolean): ManifestColumns {
  const widths = { n: 21.5, k: packageColumn ? 15.5 : 0, w: 12, dim: 26.5, cbm: 12.5, pay: 27.5 };
  const gaps = (packageColumn ? 7 : 6) * MANIFEST_COL_GAP;
  const free = (W - gaps - Object.values(widths).reduce((t, v) => t + v, 0)) / 2;
  let x = M;
  const col = (w: number): Span => { const s: Span = [x, x + w]; x += w + MANIFEST_COL_GAP; return s; };
  const n = col(widths.n); const k = packageColumn ? col(widths.k) : null;
  const c = col(free); const d = col(free);
  return { n, k, c, d, w: col(widths.w), dim: col(widths.dim), cbm: col(widths.cbm), pay: col(widths.pay) };
}

export function buildAirManifestPdf(a: AirShipment): jsPDF {
  const parcels = a.parcels ?? [];
  const packages = a.packages ?? [];
  const facts: [string, string][] = [
    ['LTA', formatAwb(a.awb_number)],
    ['Vol', flightSentence(a)],
    ['Départ', `${a.origin}${a.etd ? ` · ${fmtDay(a.etd)}` : ''}`],
    ['Arrivée', `${a.destination}${a.eta ? ` · ${fmtDay(a.eta)}` : ''}`],
  ];
  if (packages.length > 0) {
    const gross = packages.reduce((t, k) => t + Number(k.gross_weight_kg ?? k.net_weight_kg ?? 0), 0);
    facts.push(['Paquets', `${packages.length}${gross > 0 ? ` · ${formatKg(gross)} brut` : ''}`]);
  }
  return buildManifestPdf({
    mode: 'Air cargo · Guangzhou → Douala',
    ref: awbLabel(a),
    facts,
    notes: a.notes,
    fileRef: awbFileRef(a),
    packageColumn: parcels.some((p) => !!p.package_no),
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
  // Deux lignes de faits (30 mm) ; une troisième quand l'avion a des paquets.
  y += Math.ceil(facts.length / 3) * 12 + 6;

  // Le tableau, client par client. Avec la colonne PAQUET, client et contenu cèdent de la place.
  const cols = manifestColumns(!!h.packageColumn);
  const head = () => {
    pdf.setFillColor(245, 245, 245); pdf.rect(M, y, W, 7, 'F');
    pdf.setFontSize(7.5); pdf.setTextColor(90); pdf.setFont('helvetica', 'bold');
    pdf.text('N° COLIS', cols.n[0] + 2, y + 5); pdf.text('CLIENT', cols.c[0], y + 5); pdf.text('CONTENU', cols.d[0], y + 5);
    if (cols.k) pdf.text('PAQUET', cols.k[0], y + 5);
    pdf.text('POIDS', cols.w[1], y + 5, { align: 'right' }); pdf.text('DIMENSIONS', cols.dim[1], y + 5, { align: 'right' }); pdf.text('M3', cols.cbm[1], y + 5, { align: 'right' }); pdf.text('DEVIS', cols.pay[1], y + 5, { align: 'right' });
    y += 7; pdf.setTextColor(0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  };
  head();
  for (const g of groups) {
    const name = g.client ? clientFullName(g.client) : 'Client à attribuer';
    for (const p of g.parcels) {
      const desc = pdf.splitTextToSize(ascii(p.description || p.kind || 'Colis'), cols.d[1] - cols.d[0]) as string[];
      // Le nom, puis le code client sur sa propre ligne : la colonne est étroite.
      const who = [...(pdf.splitTextToSize(ascii(name), cols.c[1] - cols.c[0]) as string[]), ...(g.client?.customer_code ? [g.client.customer_code] : [])];
      // La ligne prend la hauteur du plus long des deux textes (contenu, client) : rien ne déborde sur la suivante, ni sur le pied de page.
      const rowH = 3 + Math.max(1, desc.length, who.length) * 3.8;
      if (y + rowH > FOOT) { pdf.addPage(); y = M; head(); }
      pdf.setFont('helvetica', 'bold'); pdf.text(p.parcel_no, cols.n[0] + 2, y + 4.5); pdf.setFont('helvetica', 'normal');
      if (cols.k) pdf.text(p.package_no ?? '—', cols.k[0], y + 4.5);
      pdf.text(who, cols.c[0], y + 4.5);
      pdf.text(desc, cols.d[0], y + 4.5);
      pdf.text(ascii(formatKg(p.weight_kg)), cols.w[1], y + 4.5, { align: 'right' });
      pdf.text(ascii(formatDims(p)), cols.dim[1], y + 4.5, { align: 'right' });
      pdf.text(ascii(formatCbm(p.cbm)), cols.cbm[1], y + 4.5, { align: 'right' });
      const unpaid = parcelUnpaid(p);
      if (unpaid) pdf.setTextColor(180, 30, 30);
      pdf.text(unpaid ? (Number(p.quote_total_xaf ?? 0) > 0 ? ascii(`reste ${xaf(Number(p.quote_total_xaf) - Number(p.quote_paid_xaf ?? 0))}`) : 'sans prix') : 'payé', cols.pay[1], y + 4.5, { align: 'right' });
      pdf.setTextColor(0);
      y += rowH;
      pdf.setDrawColor(230); pdf.line(M, y, 210 - M, y);
    }
    // Le sous-total du client.
    if (y + 7 > FOOT) { pdf.addPage(); y = M; head(); }
    pdf.setFontSize(8); pdf.setTextColor(90);
    pdf.text(ascii(`${name} · ${g.parcels.length} colis · ${formatKg(g.kg)} · ${formatCbm(g.cbm)}`), cols.pay[1], y + 4, { align: 'right' });
    pdf.setTextColor(0); pdf.setFontSize(8.5);
    y += 7;
  }
  // Le total, puis les notes : jamais sur le pied de page.
  y += 3;
  if (y + 9 > FOOT) { pdf.addPage(); y = M; }
  pdf.setFillColor(30, 30, 30); pdf.rect(M, y, W, 9, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
  pdf.text(`TOTAL · ${parcels.length} colis`, M + 3, y + 6);
  pdf.text(ascii(`${formatKg(totalKg)} · ${formatCbm(totalCbm)}${unpaid > 0 ? ` · ${unpaid} colis non soldé${unpaid > 1 ? 's' : ''}` : ' · tout payé'}`), 210 - M - 3, y + 6, { align: 'right' });
  pdf.setTextColor(0); pdf.setFont('helvetica', 'normal');
  y += 16;
  if (h.notes) {
    pdf.setFontSize(9); pdf.setTextColor(90);
    const notes = pdf.splitTextToSize(ascii(h.notes), W) as string[];
    if (y + notes.length * 4 > FOOT) { pdf.addPage(); y = M + 4; }
    pdf.text(notes, M, y); pdf.setTextColor(0);
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setTextColor(150); pdf.setFontSize(8);
    pdf.text(ascii(`${LEGAL_NAME} · Manifeste ${h.ref} · page ${i}/${pages}`), 105, 290, { align: 'center' });
    pdf.setTextColor(0);
  }
  return pdf;
}

export function manifestFileName(a: AirShipment): string {
  return `bonzini-manifeste-${awbFileRef(a)}.pdf`;
}

export async function deliverAirManifestPdf(a: AirShipment): Promise<Outcome> {
  const pdf = buildAirManifestPdf(a);
  const file = new File([pdf.output('blob')], manifestFileName(a), { type: 'application/pdf' });
  return saveOrShareFile(file, `Manifeste ${awbLabel(a)}`);
}

export async function deliverSeaManifestPdf(s: CargoShipment, parcels: ParcelWithDeposit[]): Promise<Outcome> {
  const pdf = buildSeaManifestPdf(s, parcels);
  const file = new File([pdf.output('blob')], `bonzini-manifeste-${s.container_number.replace(/\s+/g, '')}.pdf`, { type: 'application/pdf' });
  return saveOrShareFile(file, `Manifeste ${s.container_number}`);
}
