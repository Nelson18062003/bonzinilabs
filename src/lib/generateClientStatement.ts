import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================
// Relevé de compte client — Design Bonzini
// Couleurs : Violet #a64af7 · Or #f3a745 · Orange #fe560d
// Format : A4 Paysage (297 × 210 mm) · Police : Helvetica
// ============================================================

// ─── TYPES ────────────────────────────────────────────────────

export interface StatementMovement {
  date: string;
  reference: string;
  type: 'Dépôt' | 'Paiement' | 'Remboursement' | 'Ajustement';
  motif: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface StatementInput {
  clientName: string;
  clientPhone?: string;
  clientCountry?: string;
  clientRef?: string;
  movements: StatementMovement[];
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
}

// Raw shapes accepted by mapping helpers (avoid importing hook types)
export interface RawWalletOp {
  id: string;
  operation_type: string;
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

export interface RawLedgerEntry {
  id: string;
  entryType: string;
  amountXAF: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  referenceType?: string | null;
  description: string | null;
  createdAt: Date;
}

// ─── COLORS ───────────────────────────────────────────────────

type RGB = [number, number, number];
const C: Record<string, RGB> = {
  dark:        [26,  16,  40],
  violet:      [166, 74,  247],
  violetLight: [243, 236, 248],
  gold:        [243, 167, 69],
  orange:      [254, 86,  13],
  orangeLight: [253, 238, 232],
  green:       [16,  185, 129],
  greenLight:  [236, 253, 245],
  text:        [45,  32,  64],
  muted:       [122, 114, 144],
  light:       [248, 246, 250],
  border:      [235, 230, 240],
  white:       [255, 255, 255],
  headerText:  [200, 190, 220],
  subText:     [180, 170, 200],
  dimText:     [130, 120, 160],
};

// ─── FORMATTERS ───────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtShortDate(iso: string): string {
  try {
    return format(new Date(iso), 'dd/MM/yyyy');
  } catch {
    return iso;
  }
}

export function fmtDateLong(iso: string): string {
  try {
    return format(new Date(iso), 'd MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

// ─── CREDIT / DEBIT LOGIC ─────────────────────────────────────

function isCredit(type: string, balanceBefore: number, balanceAfter: number): boolean {
  const t = type.toUpperCase();
  if (['DEPOSIT', 'DEPOSIT_VALIDATED', 'ADMIN_CREDIT', 'PAYMENT_CANCELLED_REFUNDED'].includes(t)) return true;
  if (['PAYMENT', 'PAYMENT_EXECUTED', 'PAYMENT_RESERVED', 'ADMIN_DEBIT', 'DEPOSIT_REFUSED'].includes(t)) return false;
  return balanceAfter > balanceBefore;
}

function getMovementType(entryType: string): StatementMovement['type'] {
  const t = entryType.toUpperCase();
  if (t === 'PAYMENT_CANCELLED_REFUNDED') return 'Remboursement';
  if (t.includes('DEPOSIT') || t === 'ADMIN_CREDIT') return 'Dépôt';
  if (t.includes('PAYMENT')) return 'Paiement';
  return 'Ajustement';
}

function getFallbackMotif(entryType: string): string {
  const map: Record<string, string> = {
    DEPOSIT: 'Dépôt',
    DEPOSIT_VALIDATED: 'Dépôt validé',
    DEPOSIT_REFUSED: 'Dépôt refusé',
    PAYMENT: 'Paiement',
    PAYMENT_EXECUTED: 'Paiement effectué',
    PAYMENT_RESERVED: 'Paiement réservé',
    PAYMENT_CANCELLED_REFUNDED: 'Remboursement',
    ADMIN_CREDIT: 'Crédit administrateur',
    ADMIN_DEBIT: 'Débit administrateur',
    ADJUSTMENT: 'Ajustement',
  };
  return map[entryType.toUpperCase()] || entryType;
}

function buildRef(refType?: string | null, refId?: string | null, id?: string): string {
  const prefix = refType === 'deposit' ? 'DEP' : refType === 'payment' ? 'PAY' : 'OP';
  const suffix = (refId || id || '').slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

// ─── MAPPING HELPERS (exported) ───────────────────────────────

export function buildMovementFromWalletOp(op: RawWalletOp): StatementMovement {
  const credit = isCredit(op.operation_type, op.balance_before, op.balance_after);
  return {
    date: op.created_at,
    reference: buildRef(op.reference_type, op.reference_id, op.id),
    type: getMovementType(op.operation_type),
    motif: op.description || getFallbackMotif(op.operation_type),
    debit: credit ? 0 : Math.abs(op.amount_xaf),
    credit: credit ? Math.abs(op.amount_xaf) : 0,
    solde: op.balance_after,
  };
}

export function buildMovementFromLedgerEntry(entry: RawLedgerEntry): StatementMovement {
  const credit = isCredit(entry.entryType, entry.balanceBefore, entry.balanceAfter);
  return {
    date: entry.createdAt.toISOString(),
    reference: buildRef(entry.referenceType, entry.referenceId, entry.id),
    type: getMovementType(entry.entryType),
    motif: entry.description || getFallbackMotif(entry.entryType),
    debit: credit ? 0 : Math.abs(entry.amountXAF),
    credit: credit ? Math.abs(entry.amountXAF) : 0,
    solde: entry.balanceAfter,
  };
}

// ─── PDF GENERATION ───────────────────────────────────────────

export function generateClientStatement(data: StatementInput): void {
  const { clientName, clientPhone, clientCountry, clientRef, movements, periodFrom, periodTo, generatedAt } = data;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;

  // Totals
  const totalCredits = movements.reduce((s, m) => s + m.credit, 0);
  const totalDebits  = movements.reduce((s, m) => s + m.debit,  0);
  const soldeFinal   = movements.length > 0 ? movements[movements.length - 1].solde : 0;

  // ── HELPERS ──────────────────────────────────────────────────

  function setFill(...rgb: RGB) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
  function setTxt(...rgb: RGB)  { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
  function setLine(...rgb: RGB) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }

  // ── HEADER (drawn on each page) ───────────────────────────

  function drawHeader() {
    const H = 40;

    // Dark background
    setFill(...C.dark);
    doc.rect(0, 0, pageW, H, 'F');

    // Tricolor stripe below header
    const sy = H; const sh = 1.5;
    setFill(...C.gold);   doc.rect(0,              sy, pageW * 0.28, sh, 'F');
    setFill(...C.violet); doc.rect(pageW * 0.28,   sy, pageW * 0.44, sh, 'F');
    setFill(...C.orange); doc.rect(pageW * 0.72,   sy, pageW * 0.28, sh, 'F');

    // Logo circle "B"
    setFill(...C.violet);
    doc.circle(margin + 5, 12, 5, 'F');
    setTxt(...C.white);
    doc.setFontSize(10); doc.setFont('Helvetica', 'bold');
    doc.text('B', margin + 5, 13.5, { align: 'center' });

    // Brand name
    setTxt(...C.white);
    doc.setFontSize(14); doc.setFont('Helvetica', 'bold');
    doc.text('Bonzini', margin + 13, 12.5);
    doc.setFontSize(6); doc.setFont('Helvetica', 'normal');
    setTxt(...C.subText);
    doc.text('Paiements CEMAC \u2192 Chine', margin + 13, 17);

    // Document type (top right)
    setTxt(...C.dimText);
    doc.setFontSize(6); doc.setFont('Helvetica', 'bold');
    doc.text('DOCUMENT OFFICIEL', pageW - margin, 10, { align: 'right' });
    setTxt(...C.white);
    doc.setFontSize(11); doc.setFont('Helvetica', 'bold');
    doc.text('Relevé de compte client', pageW - margin, 16, { align: 'right' });

    // Client info (bottom-left of header)
    const iy = 25;
    setTxt(...C.gold);
    doc.setFontSize(6); doc.setFont('Helvetica', 'bold');
    doc.text('CLIENT', margin, iy);

    setTxt(...C.white);
    doc.setFontSize(9); doc.setFont('Helvetica', 'bold');
    doc.text(clientName, margin, iy + 5);

    doc.setFontSize(7); doc.setFont('Helvetica', 'normal');
    setTxt(...C.subText);
    if (clientPhone) doc.text(clientPhone, margin, iy + 10);
    const extra = [clientCountry, clientRef].filter(Boolean).join(' · ');
    if (extra) doc.text(extra, margin, iy + 14);

    // Period (bottom-right of header)
    setTxt(...C.gold);
    doc.setFontSize(6); doc.setFont('Helvetica', 'bold');
    doc.text('PÉRIODE', pageW - margin, iy, { align: 'right' });

    setTxt(...C.white);
    doc.setFontSize(7.5); doc.setFont('Helvetica', 'normal');
    doc.text(`Du ${periodFrom}`, pageW - margin, iy + 5,  { align: 'right' });
    doc.text(`Au ${periodTo}`,   pageW - margin, iy + 10, { align: 'right' });

    doc.setFontSize(6);
    setTxt(...C.dimText);
    doc.text(`Émis le ${generatedAt}`, pageW - margin, iy + 14, { align: 'right' });
  }

  // ── FOOTER (drawn on each page after table) ───────────────

  function drawFooter(pageNum: number, totalPages: number) {
    const fy = pageH - 8;

    // Mini tricolor bar
    const bw = 36; const bx = pageW / 2 - bw / 2;
    setFill(...C.gold);   doc.rect(bx,              fy - 2, bw * 0.28, 0.5, 'F');
    setFill(...C.violet); doc.rect(bx + bw * 0.28,  fy - 2, bw * 0.44, 0.5, 'F');
    setFill(...C.orange); doc.rect(bx + bw * 0.72,  fy - 2, bw * 0.28, 0.5, 'F');

    // Center text
    setTxt(...C.muted);
    doc.setFontSize(5.5); doc.setFont('Helvetica', 'normal');
    doc.text(
      `Document généré automatiquement par Bonzini \u2014 ${generatedAt}  ·  support@bonzinilabs.com`,
      pageW / 2, fy + 2, { align: 'center' }
    );

    // Page number
    doc.text(`Page ${pageNum} / ${totalPages}`, pageW - margin, fy + 2, { align: 'right' });

    // Mini logo
    setFill(...C.violet);
    doc.circle(margin + 2.5, fy + 1, 2, 'F');
    setTxt(...C.white);
    doc.setFontSize(4); doc.setFont('Helvetica', 'bold');
    doc.text('B', margin + 2.5, fy + 1.8, { align: 'center' });
    setTxt(...C.muted);
    doc.setFontSize(5.5); doc.setFont('Helvetica', 'normal');
    doc.text('bonzinilabs.com', margin + 7, fy + 2);
  }

  // ── PAGE 1: Header + Summary boxes ───────────────────────

  drawHeader();
  let curY = 44; // header(40) + stripe(1.5) + gap(2.5)

  // 3 summary boxes
  const boxW = (contentW - 6) / 3;
  const boxH = 20;
  const boxes = [
    { label: 'TOTAL DÉPÔTS',    value: `+${fmt(totalCredits)}`, sub: 'XAF', bg: C.greenLight,  color: C.green  },
    { label: 'TOTAL PAIEMENTS', value: `-${fmt(totalDebits)}`,  sub: 'XAF', bg: C.orangeLight, color: C.orange },
    { label: 'SOLDE FINAL',     value: fmt(soldeFinal),          sub: 'XAF', bg: C.violetLight, color: C.violet },
  ];

  boxes.forEach((box, i) => {
    const x = margin + i * (boxW + 3);
    setFill(...box.bg);
    doc.roundedRect(x, curY, boxW, boxH, 2, 2, 'F');

    setTxt(...C.muted);
    doc.setFontSize(5.5); doc.setFont('Helvetica', 'bold');
    doc.text(box.label, x + boxW / 2, curY + 5.5, { align: 'center' });

    setTxt(...box.color);
    doc.setFontSize(14); doc.setFont('Helvetica', 'bold');
    doc.text(box.value, x + boxW / 2, curY + 13, { align: 'center' });

    setTxt(...C.muted);
    doc.setFontSize(5); doc.setFont('Helvetica', 'normal');
    doc.text(box.sub, x + boxW / 2, curY + 17.5, { align: 'center' });
  });

  curY += boxH + 6;

  // Section label
  setTxt(...C.muted);
  doc.setFontSize(7); doc.setFont('Helvetica', 'bold');
  doc.text(`DÉTAIL DES MOUVEMENTS (${movements.length})`, margin, curY + 3);
  curY += 6;

  // ── TABLE ────────────────────────────────────────────────

  const tableBody: string[][] = movements.map(m => [
    fmtShortDate(m.date),
    m.reference,
    m.type,
    m.motif,
    m.debit  > 0 ? `-${fmt(m.debit)}`  : '',
    m.credit > 0 ? `+${fmt(m.credit)}` : '',
    fmt(m.solde),
  ]);

  // Totals row
  tableBody.push([
    '', '', '', 'TOTAUX',
    `-${fmt(totalDebits)}`,
    `+${fmt(totalCredits)}`,
    fmt(soldeFinal),
  ]);

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [['Date', 'Réf.', 'Type', 'Motif / Description', 'Débit (XAF)', 'Crédit (XAF)', 'Solde (XAF)']],
    body: tableBody,
    theme: 'plain',
    styles: {
      font: 'Helvetica',
      fontSize: 7,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: C.text,
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.headerText,
      fontStyle: 'bold',
      fontSize: 6,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22, font: 'Courier', fontSize: 6 },
      2: { cellWidth: 22 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: C.light,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      const { row, column, cell, section } = data;
      const isLast = row.index === tableBody.length - 1;

      // Totals row → dark background
      if (isLast && section === 'body') {
        cell.styles.fillColor   = C.dark;
        cell.styles.textColor   = C.white;
        cell.styles.fontStyle   = 'bold';
        if (column.index === 4) cell.styles.textColor = [255, 150, 100];
        if (column.index === 5) cell.styles.textColor = [100, 220, 160];
      }

      // Debit → orange
      if (column.index === 4 && !isLast && section === 'body' && cell.raw) {
        cell.styles.textColor = C.orange;
        cell.styles.fontStyle = 'bold';
      }

      // Credit → green
      if (column.index === 5 && !isLast && section === 'body' && cell.raw) {
        cell.styles.textColor = C.green;
        cell.styles.fontStyle = 'bold';
      }

      // Type column → colored by type
      if (column.index === 2 && section === 'body' && !isLast) {
        const colors: Record<string, RGB> = {
          'Dépôt':        C.green,
          'Paiement':     C.orange,
          'Remboursement':[59, 130, 246],
          'Ajustement':   C.muted,
        };
        const tc = colors[String(cell.raw)];
        if (tc) { cell.styles.textColor = tc; cell.styles.fontStyle = 'bold'; }
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1) drawHeader();
    },
  });

  // Draw footers on all pages (after table, total pages is known)
  const totalPages: number = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  // Download
  const safeName = clientName.replace(/\s+/g, '');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`releve_${safeName}_${today}.pdf`);
}
