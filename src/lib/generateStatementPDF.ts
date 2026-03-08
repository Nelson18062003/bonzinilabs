import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================
// Relevé de Compte Client — Format bancaire professionnel
// ============================================================

export interface StatementOperation {
  id: string;
  created_at: string;
  operation_type: string; // 'deposit' | 'payment' | 'adjustment'
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
}

export interface StatementData {
  clientName: string;
  clientPhone?: string;
  clientCountry?: string;
  periodStart: Date;
  periodEnd: Date;
  operations: StatementOperation[];
  initialBalance: number;
  finalBalance: number;
}

// ---------- Helpers ----------

const fmtXAF = (n: number): string =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const fmtDate = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, 'dd/MM/yyyy');

const fmtDateLong = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, 'dd MMMM yyyy', { locale: fr });

const fmtDateTime = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, "dd/MM/yyyy 'a' HH:mm");

const typeLabel = (type: string): string => {
  switch (type) {
    case 'deposit': return 'Depot';
    case 'payment': return 'Paiement';
    case 'adjustment': return 'Ajustement';
    default: return type;
  }
};

// ---------- Colors ----------

const C = {
  primary:  [30, 64, 175] as [number, number, number],   // Indigo-800
  primaryL: [219, 234, 254] as [number, number, number],  // Blue-100
  dark:     [17, 24, 39] as [number, number, number],     // Gray-900
  text:     [31, 41, 55] as [number, number, number],     // Gray-800
  muted:    [107, 114, 128] as [number, number, number],  // Gray-500
  light:    [243, 244, 246] as [number, number, number],  // Gray-100
  white:    [255, 255, 255] as [number, number, number],
  green:    [5, 122, 85] as [number, number, number],     // Emerald-700
  greenBg:  [236, 253, 245] as [number, number, number],  // Emerald-50
  red:      [185, 28, 28] as [number, number, number],    // Red-700
  redBg:    [254, 242, 242] as [number, number, number],  // Red-50
  border:   [209, 213, 219] as [number, number, number],  // Gray-300
};

// ============================================================
// Main export function
// ============================================================

export function generateStatementPDF(data: StatementData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();   // 297
  const ml = 15; // margin left
  const mr = 15; // margin right
  const cw = pw - ml - mr; // content width

  let y = 0;

  // ==========================================================
  // HEADER — Bande bleue avec logo texte
  // ==========================================================
  const headerH = 38;
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pw, headerH, 'F');

  // Logo text
  doc.setTextColor(...C.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BONZINI', ml, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('TRADING SARL', ml + 50, 16);

  // Title right-aligned
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELEVE DE COMPTE', pw - mr, 14, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Document genere le ' + fmtDateTime(new Date()), pw - mr, 22, { align: 'right' });

  // Thin accent line
  doc.setFillColor(96, 165, 250); // Blue-400
  doc.rect(0, headerH, pw, 1.5, 'F');

  y = headerH + 10;

  // ==========================================================
  // CLIENT INFO + PERIOD (two columns)
  // ==========================================================
  const colLeft = ml;
  const colRight = pw / 2 + 5;

  // Left column — Client
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text('TITULAIRE DU COMPTE', colLeft, y);

  y += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(data.clientName, colLeft, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text);
  if (data.clientPhone) {
    doc.text('Tel : ' + data.clientPhone, colLeft, y);
    y += 4.5;
  }
  if (data.clientCountry) {
    doc.text('Pays : ' + data.clientCountry, colLeft, y);
    y += 4.5;
  }

  // Right column — Period
  const yPeriod = headerH + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text('PERIODE', colRight, yPeriod);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text);
  doc.text('Du ' + fmtDateLong(data.periodStart), colRight, yPeriod + 5);
  doc.text('Au ' + fmtDateLong(data.periodEnd), colRight, yPeriod + 9.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text('NOMBRE DE MOUVEMENTS', colRight, yPeriod + 17);
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text(String(data.operations.length), colRight, yPeriod + 22);

  y = Math.max(y, yPeriod + 26) + 4;

  // Separator
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - mr, y);
  y += 6;

  // ==========================================================
  // BALANCE SUMMARY — 3 boxes
  // ==========================================================
  const boxW = (cw - 6) / 3; // 3 boxes with 3mm gap
  const boxH = 20;

  // Box 1: Solde initial
  doc.setFillColor(...C.light);
  doc.roundedRect(ml, y, boxW, boxH, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text('SOLDE INITIAL', ml + 4, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(fmtXAF(data.initialBalance) + ' XAF', ml + 4, y + 14);

  // Box 2: Solde final
  const box2x = ml + boxW + 3;
  doc.setFillColor(...C.primaryL);
  doc.roundedRect(box2x, y, boxW, boxH, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text('SOLDE FINAL', box2x + 4, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text(fmtXAF(data.finalBalance) + ' XAF', box2x + 4, y + 14);

  // Box 3: Variation
  const variation = data.finalBalance - data.initialBalance;
  const box3x = ml + (boxW + 3) * 2;
  const isPositive = variation >= 0;
  doc.setFillColor(...(isPositive ? C.greenBg : C.redBg));
  doc.roundedRect(box3x, y, boxW, boxH, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isPositive ? C.green : C.red));
  doc.text('VARIATION', box3x + 4, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text((isPositive ? '+' : '') + fmtXAF(variation) + ' XAF', box3x + 4, y + 14);

  y += boxH + 8;

  // ==========================================================
  // MOVEMENTS TABLE
  // ==========================================================
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('DETAIL DES MOUVEMENTS', ml, y);
  y += 3;

  if (data.operations.length === 0) {
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.muted);
    doc.text('Aucun mouvement sur cette periode.', ml, y);
    y += 15;
  } else {
    // Build table rows with running balance
    const rows = data.operations.map((op, idx) => {
      const isCredit = op.operation_type === 'deposit' ||
        (op.operation_type === 'adjustment' && op.balance_after > op.balance_before);

      const refId = op.id.slice(0, 8).toUpperCase();
      const motif = op.description || typeLabel(op.operation_type);

      return [
        fmtDate(op.created_at),
        refId,
        typeLabel(op.operation_type),
        motif,
        isCredit ? '' : fmtXAF(op.amount_xaf),      // Debit
        isCredit ? fmtXAF(op.amount_xaf) : '',       // Credit
        fmtXAF(op.balance_after),                     // Solde
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[
        'Date',
        'Ref.',
        'Type',
        'Motif / Description',
        'Debit (XAF)',
        'Credit (XAF)',
        'Solde (XAF)',
      ]],
      body: rows,
      theme: 'plain',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
        textColor: C.text,
        lineColor: C.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: C.primary,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 22 },              // Date
        1: { cellWidth: 18, font: 'courier' }, // Ref
        2: { cellWidth: 20 },              // Type
        3: { cellWidth: 'auto' },           // Motif
        4: { cellWidth: 24, halign: 'right' }, // Debit
        5: { cellWidth: 24, halign: 'right' }, // Credit
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }, // Solde
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: ml, right: mr },
      didParseCell(hookData) {
        if (hookData.section !== 'body') return;

        // Color debit column red
        if (hookData.column.index === 4 && hookData.cell.text[0]) {
          hookData.cell.styles.textColor = C.red;
        }
        // Color credit column green
        if (hookData.column.index === 5 && hookData.cell.text[0]) {
          hookData.cell.styles.textColor = C.green;
        }
      },
    });

    // Get Y after table
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  // ==========================================================
  // TOTALS SUMMARY — Footer block
  // ==========================================================
  // Compute totals
  let totalDeposits = 0;
  let totalPayments = 0;
  let totalAdjustments = 0;
  let countDeposits = 0;
  let countPayments = 0;

  data.operations.forEach(op => {
    const isCredit = op.operation_type === 'deposit' ||
      (op.operation_type === 'adjustment' && op.balance_after > op.balance_before);

    if (op.operation_type === 'deposit') {
      totalDeposits += op.amount_xaf;
      countDeposits++;
    } else if (op.operation_type === 'payment') {
      totalPayments += op.amount_xaf;
      countPayments++;
    } else {
      totalAdjustments += isCredit ? op.amount_xaf : -op.amount_xaf;
    }
  });

  // Check if we need a new page for the summary
  if (y + 55 > ph - 25) {
    doc.addPage();
    y = 20;
  }

  // Summary box
  const summaryX = pw / 2;
  const summaryW = pw / 2 - mr;

  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y, pw - mr, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text('RECAPITULATIF', summaryX, y);
  y += 6;

  const summaryRows = [
    ['Total depots (' + countDeposits + ')', fmtXAF(totalDeposits) + ' XAF', C.green],
    ['Total paiements (' + countPayments + ')', fmtXAF(totalPayments) + ' XAF', C.red],
    ['Solde final', fmtXAF(data.finalBalance) + ' XAF', C.primary],
  ];

  summaryRows.forEach(([label, value, color]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    doc.text(label as string, summaryX, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(color as [number, number, number]));
    doc.text(value as string, pw - mr, y, { align: 'right' });
    y += 5;
  });

  // ==========================================================
  // FOOTER — on every page
  // ==========================================================
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(ml, ph - 14, pw - mr, ph - 14);

    // Left: Legal mention
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(
      'Document genere automatiquement par Bonzini Trading SARL — ' + fmtDateLong(new Date()),
      ml,
      ph - 9,
    );

    // Right: Page number
    doc.text('Page ' + i + ' / ' + pages, pw - mr, ph - 9, { align: 'right' });
  }

  // ==========================================================
  // SAVE & DOWNLOAD
  // ==========================================================
  const safeName = data.clientName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const dateStr = format(new Date(), 'yyyyMMdd');
  doc.save('releve_' + safeName + '_' + dateStr + '.pdf');
}
