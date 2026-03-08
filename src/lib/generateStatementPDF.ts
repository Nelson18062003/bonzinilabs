import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================
// Relevé de Compte Client — Design Bonzini
// Couleurs marque : Violet #9b59b6 · Or #e8a838 · Orange #e8632b
// Format : A4 Paysage (297×210mm)
// ============================================================

export interface StatementOperation {
  id: string;
  created_at: string;
  operation_type: string; // simplified ('deposit'|'payment'|'adjustment') or raw enum ('DEPOSIT_VALIDATED'|'PAYMENT_EXECUTED'|...)
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
}

export interface StatementData {
  clientName: string;
  clientPhone?: string;
  clientCountry?: string;
  clientId?: string;
  periodStart: Date;
  periodEnd: Date;
  operations: StatementOperation[];
  initialBalance: number;
  finalBalance: number;
  logoBase64?: string;
}

// ---------- Helpers ----------

type RGB = [number, number, number];

const fmtXAF = (n: number): string =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const fmtDateLong = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, 'd MMMM yyyy', { locale: fr });

const fmtDateTime = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, "d MMMM yyyy 'a' HH:mm", { locale: fr });

const fmtDate = (d: Date | string): string =>
  format(typeof d === 'string' ? new Date(d) : d, 'dd/MM/yyyy');

// ---------- Credit/Debit determination ----------

export const isCreditOperation = (opType: string, balanceBefore: number, balanceAfter: number): boolean => {
  const t = opType.toUpperCase();
  // Explicit credits (raw enum + simplified)
  if (t === 'DEPOSIT' || t === 'DEPOSIT_VALIDATED' || t === 'ADMIN_CREDIT' || t === 'PAYMENT_CANCELLED_REFUNDED') return true;
  // Explicit debits
  if (t === 'PAYMENT' || t === 'PAYMENT_EXECUTED' || t === 'PAYMENT_RESERVED' || t === 'ADMIN_DEBIT' || t === 'DEPOSIT_REFUSED') return false;
  // Fallback for 'adjustment' or unknown
  return balanceAfter > balanceBefore;
};

export const typeLabel = (type: string): string => {
  switch (type.toUpperCase()) {
    case 'DEPOSIT': case 'DEPOSIT_VALIDATED': return 'Depot';
    case 'DEPOSIT_REFUSED': return 'Depot refuse';
    case 'PAYMENT': case 'PAYMENT_EXECUTED': return 'Paiement';
    case 'PAYMENT_RESERVED': return 'Paiement reserve';
    case 'PAYMENT_CANCELLED_REFUNDED': return 'Remboursement';
    case 'ADMIN_CREDIT': return 'Credit admin';
    case 'ADMIN_DEBIT': return 'Debit admin';
    case 'ADJUSTMENT': return 'Ajustement';
    default: return type;
  }
};

// ---------- Brand Colors ----------

const B = {
  violet:      [155, 89, 182] as RGB,   // #9b59b6
  violetDark:  [125, 60, 152] as RGB,   // #7d3c98
  violetLight: [243, 236, 248] as RGB,  // #f3ecf8
  gold:        [232, 168, 56] as RGB,   // #e8a838
  goldLight:   [253, 244, 227] as RGB,  // #fdf4e3
  orange:      [232, 99, 43] as RGB,    // #e8632b
  orangeLight: [253, 238, 232] as RGB,  // #fdeee8
  dark:        [26, 16, 40] as RGB,     // #1a1028
  text:        [45, 32, 64] as RGB,     // #2d2040
  muted:       [122, 114, 144] as RGB,  // #7a7290
  light:       [248, 246, 250] as RGB,  // #f8f6fa
  border:      [235, 230, 240] as RGB,  // #ebe6f0
  white:       [255, 255, 255] as RGB,
  green:       [16, 185, 129] as RGB,   // #10b981
  greenBg:     [236, 253, 245] as RGB,  // #ecfdf5
  blue:        [59, 130, 246] as RGB,   // #3b82f6
  blueBg:      [239, 246, 255] as RGB,  // #eff6ff
};

// Type badge colors
const TYPE_COLORS: Record<string, { text: RGB; bg: RGB }> = {
  'Depot':           { text: B.green, bg: B.greenBg },
  'Paiement':        { text: B.orange, bg: B.orangeLight },
  'Remboursement':   { text: B.blue, bg: B.blueBg },
  'Credit admin':    { text: B.green, bg: B.greenBg },
  'Debit admin':     { text: B.orange, bg: B.orangeLight },
  'Depot refuse':    { text: B.muted, bg: B.light },
  'Paiement reserve': { text: B.orange, bg: B.orangeLight },
  'Ajustement':      { text: B.muted, bg: B.light },
};

// ---------- Brand bar helper ----------

function drawBrandBar(doc: jsPDF, x: number, y: number, width: number, height: number) {
  const goldW = width * 0.33;
  const violetW = width * 0.40;
  const orangeW = width - goldW - violetW;
  doc.setFillColor(...B.gold);
  doc.rect(x, y, goldW, height, 'F');
  doc.setFillColor(...B.violet);
  doc.rect(x + goldW, y, violetW, height, 'F');
  doc.setFillColor(...B.orange);
  doc.rect(x + goldW + violetW, y, orangeW, height, 'F');
}

// ============================================================
// Logo loader utility
// ============================================================

export async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const response = await fetch('/assets/bonzini-logo.jpg');
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// ============================================================
// Main export function
// ============================================================

export function generateStatementPDF(data: StatementData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();   // 210
  const ml = 18;
  const mr = 18;
  const cw = pw - ml - mr; // 261

  let y = 0;

  // ==========================================================
  // HEADER — Dark background with brand bar
  // ==========================================================
  const headerH = 52;
  doc.setFillColor(...B.dark);
  doc.rect(0, 0, pw, headerH, 'F');

  // Logo
  if (data.logoBase64) {
    try {
      doc.addImage(data.logoBase64, 'JPEG', ml, 8, 14, 14);
    } catch {
      // Fallback: no logo
    }
  }

  // Company name
  const logoTextX = data.logoBase64 ? ml + 17 : ml;
  doc.setTextColor(...B.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Bonzini', logoTextX, 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255, 0.45);
  doc.text('Paiements CEMAC → Chine', logoTextX, 20);

  // Document title (right side, boxed)
  const titleBoxW = 55;
  const titleBoxH = 22;
  const titleBoxX = pw - mr - titleBoxW;
  doc.setFillColor(255, 255, 255, 0.06);
  doc.setDrawColor(255, 255, 255, 0.08);
  doc.roundedRect(titleBoxX, 6, titleBoxW, titleBoxH, 3, 3, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255, 0.4);
  doc.text('DOCUMENT', titleBoxX + 5, 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.white);
  doc.text('Releve de compte', titleBoxX + 5, 19);

  // Brand bar
  drawBrandBar(doc, ml, 28, cw, 1.5);

  // Client info (left) + Period (right)
  const infoY = 34;

  // Client label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.gold);
  doc.text('CLIENT', ml, infoY);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.white);
  doc.text(data.clientName, ml, infoY + 5.5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255, 0.5);
  let clientInfoY = infoY + 10.5;
  if (data.clientPhone) {
    doc.text(data.clientPhone, ml, clientInfoY);
    clientInfoY += 4;
  }
  if (data.clientCountry) {
    let countryLine = data.clientCountry;
    if (data.clientId) countryLine += ' · ' + data.clientId;
    doc.text(countryLine, ml, clientInfoY);
  }

  // Period (right)
  const periodX = pw - mr;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.gold);
  doc.text('PERIODE', periodX, infoY, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.white);
  doc.text('Du ' + fmtDateLong(data.periodStart), periodX, infoY + 5.5, { align: 'right' });
  doc.text('Au ' + fmtDateLong(data.periodEnd), periodX, infoY + 10.5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255, 0.35);
  doc.text('Emis le ' + fmtDateTime(new Date()), periodX, infoY + 16, { align: 'right' });

  y = headerH;

  // ==========================================================
  // SUMMARY — 3 boxes (Total dépôts, Total paiements, Solde)
  // ==========================================================

  // Compute totals
  let totalCredits = 0;
  let totalDebits = 0;
  let countCredits = 0;
  let countDebits = 0;
  let countRefunds = 0;

  data.operations.forEach(op => {
    const isCredit = isCreditOperation(op.operation_type, op.balance_before, op.balance_after);
    const label = typeLabel(op.operation_type);
    if (label === 'Remboursement') countRefunds++;
    if (isCredit) {
      totalCredits += op.amount_xaf;
      countCredits++;
    } else {
      totalDebits += op.amount_xaf;
      countDebits++;
    }
  });

  const soldeFinal = data.operations.length > 0 ? data.finalBalance : data.initialBalance;

  // 3 summary boxes
  const boxW = cw / 3;
  const boxH = 22;
  const boxY = y;

  const summaryItems = [
    { label: 'TOTAL DEPOTS', value: '+' + fmtXAF(totalCredits), textColor: B.green, bgColor: B.greenBg, suffix: 'XAF' },
    { label: 'TOTAL PAIEMENTS', value: '-' + fmtXAF(totalDebits), textColor: B.orange, bgColor: B.orangeLight, suffix: 'XAF' },
    { label: 'SOLDE FINAL', value: fmtXAF(soldeFinal), textColor: B.violet, bgColor: B.violetLight, suffix: 'XAF' },
  ];

  summaryItems.forEach((item, i) => {
    const bx = ml + i * boxW;
    doc.setFillColor(...item.bgColor);
    doc.rect(bx, boxY, boxW, boxH, 'F');
    // Separator between boxes
    if (i < 2) {
      doc.setDrawColor(...B.border);
      doc.setLineWidth(0.3);
      doc.line(bx + boxW, boxY, bx + boxW, boxY + boxH);
    }
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...B.muted);
    doc.text(item.label, bx + boxW / 2, boxY + 7, { align: 'center' });
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.textColor);
    doc.text(item.value, bx + boxW / 2, boxY + 15, { align: 'center' });
    // Suffix
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...B.muted);
    doc.text(item.suffix, bx + boxW / 2, boxY + 19.5, { align: 'center' });
  });

  // Border under summary
  doc.setDrawColor(...B.border);
  doc.setLineWidth(0.5);
  doc.line(ml, boxY + boxH, pw - mr, boxY + boxH);

  y = boxY + boxH + 6;

  // ==========================================================
  // MOVEMENTS TABLE
  // ==========================================================
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.muted);
  doc.text('DETAIL DES MOUVEMENTS (' + data.operations.length + ')', ml, y);
  y += 3;

  if (data.operations.length === 0) {
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...B.muted);
    doc.text('Aucun mouvement sur cette periode.', ml, y);
    y += 15;
  } else {
    // Build table rows
    const rows = data.operations.map((op) => {
      const isCredit = isCreditOperation(op.operation_type, op.balance_before, op.balance_after);
      const refId = op.id.slice(0, 8).toUpperCase();
      const motif = op.description || typeLabel(op.operation_type);
      const label = typeLabel(op.operation_type);

      return [
        fmtDate(op.created_at),
        refId,
        label,
        motif,
        isCredit ? '' : '-' + fmtXAF(op.amount_xaf),
        isCredit ? '+' + fmtXAF(op.amount_xaf) : '',
        fmtXAF(op.balance_after),
      ];
    });

    // Footer row (totals)
    const footRow = [
      '',
      '',
      '',
      'Totaux',
      '-' + fmtXAF(totalDebits),
      '+' + fmtXAF(totalCredits),
      fmtXAF(soldeFinal),
    ];

    autoTable(doc, {
      startY: y,
      head: [[
        'Date',
        'Ref.',
        'Type',
        'Motif',
        'Debit',
        'Credit',
        'Solde',
      ]],
      body: rows,
      foot: [footRow],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        textColor: B.text,
        lineColor: B.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: B.dark,
        textColor: [255, 255, 255, 0.6] as any,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
      },
      footStyles: {
        fillColor: B.dark,
        textColor: B.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 28 },                          // Date
        1: { cellWidth: 22, font: 'courier' },         // Ref
        2: { cellWidth: 30 },                          // Type
        3: { cellWidth: 'auto' },                      // Motif
        4: { cellWidth: 35, halign: 'right' },         // Debit
        5: { cellWidth: 35, halign: 'right' },         // Credit
        6: { cellWidth: 38, halign: 'right', fontStyle: 'bold' }, // Solde
      },
      alternateRowStyles: {
        fillColor: B.light,
      },
      margin: { left: ml, right: mr },
      didParseCell(hookData) {
        // Body styling
        if (hookData.section === 'body') {
          // Type column (2) — colored badge via text color + bg
          if (hookData.column.index === 2) {
            const label = hookData.cell.text[0];
            const tc = TYPE_COLORS[label];
            if (tc) {
              hookData.cell.styles.textColor = tc.text;
              hookData.cell.styles.fillColor = tc.bg;
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
          // Debit column (4) — orange
          if (hookData.column.index === 4 && hookData.cell.text[0]) {
            hookData.cell.styles.textColor = B.orange;
            hookData.cell.styles.fontStyle = 'bold';
          }
          // Credit column (5) — green
          if (hookData.column.index === 5 && hookData.cell.text[0]) {
            hookData.cell.styles.textColor = B.green;
            hookData.cell.styles.fontStyle = 'bold';
          }
          // Solde column (6) — check if negative
          if (hookData.column.index === 6) {
            const val = hookData.cell.text[0];
            if (val && val.startsWith('-')) {
              hookData.cell.styles.textColor = B.orange;
            }
          }
          // Date column — muted
          if (hookData.column.index === 0) {
            hookData.cell.styles.textColor = B.muted;
          }
          // Ref column — muted
          if (hookData.column.index === 1) {
            hookData.cell.styles.textColor = B.muted;
          }
        }

        // Footer styling
        if (hookData.section === 'foot') {
          // Debit total — orange light
          if (hookData.column.index === 4 && hookData.cell.text[0]) {
            hookData.cell.styles.textColor = [255, 138, 101] as any; // #ff8a65
          }
          // Credit total — green light
          if (hookData.column.index === 5 && hookData.cell.text[0]) {
            hookData.cell.styles.textColor = [102, 187, 106] as any; // #66bb6a
          }
          // Motif — "Totaux" label
          if (hookData.column.index === 3) {
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 6;
  }

  // ==========================================================
  // STATS — Counters section
  // ==========================================================
  if (y + 30 > ph - 30) {
    doc.addPage();
    y = 20;
  }

  const statsBoxW = cw;
  const statsBoxH = 22;
  doc.setFillColor(...B.light);
  doc.setDrawColor(...B.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ml, y, statsBoxW, statsBoxH, 4, 4, 'FD');

  const statsItems = [
    { label: 'MOUVEMENTS', value: data.operations.length, color: B.violet },
    { label: 'DEPOTS', value: countCredits, color: B.green },
    { label: 'PAIEMENTS', value: countDebits, color: B.orange },
    { label: 'REMBOURSEMENTS', value: countRefunds, color: B.blue },
  ];

  const statsColW = statsBoxW / statsItems.length;
  statsItems.forEach((stat, i) => {
    const sx = ml + i * statsColW + statsColW / 2;
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...stat.color);
    doc.text(String(stat.value), sx, y + 10, { align: 'center' });
    // Label
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...B.muted);
    doc.text(stat.label, sx, y + 16, { align: 'center' });
  });

  y += statsBoxH + 6;

  // ==========================================================
  // FOOTER — on every page
  // ==========================================================
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    const footerY = ph - 20;

    // Brand bar (centered, small)
    const barW = 60;
    const barX = (pw - barW) / 2;
    drawBrandBar(doc, barX, footerY, barW, 1);

    // Main text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...B.muted);
    doc.text(
      'Document genere automatiquement par Bonzini — ' + fmtDateTime(new Date()),
      pw / 2,
      footerY + 5,
      { align: 'center' },
    );
    doc.text(
      'Ce releve est fourni a titre informatif · support@bonzinilabs.com',
      pw / 2,
      footerY + 9,
      { align: 'center' },
    );

    // bonzinilabs.com
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...B.muted);
    doc.text('bonzinilabs.com', pw / 2, footerY + 14, { align: 'center' });

    // Page number (right)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Page ' + i + ' / ' + pages, pw - mr, footerY + 14, { align: 'right' });
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
