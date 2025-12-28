import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface StatementOperation {
  id: string;
  created_at: string;
  operation_type: string;
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
}

export interface StatementData {
  clientName: string;
  clientPhone?: string;
  periodStart: Date;
  periodEnd: Date;
  operations: StatementOperation[];
  initialBalance: number;
  finalBalance: number;
}

const formatXAF = (amount: number): string => {
  // Use manual formatting to avoid font issues with special characters
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: fr });
};

const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

const getOperationLabel = (type: string, description: string | null): string => {
  if (description) return description;
  
  switch (type) {
    case 'deposit':
      return 'Dépôt validé';
    case 'payment':
      return 'Paiement';
    case 'adjustment':
      return 'Ajustement';
    default:
      return type;
  }
};

export function generateStatementPDF(data: StatementData): void {
  // A3 landscape format for better readability
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3'
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const successColor: [number, number, number] = [16, 185, 129];
  const dangerColor: [number, number, number] = [239, 68, 68];

  let yPos = 25;

  // Header - Company name
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('BONZINI TRADING', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Releve de Compte Client', pageWidth / 2, 34, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text('Genere le ' + formatDateTime(new Date()), pageWidth / 2, 44, { align: 'center' });

  yPos = 70;

  // Client info section
  doc.setTextColor(...textColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations Client', 20, yPos);
  
  yPos += 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Nom:', 20, yPos);
  doc.setTextColor(...textColor);
  doc.text(data.clientName, 70, yPos);
  
  if (data.clientPhone) {
    yPos += 8;
    doc.setTextColor(...mutedColor);
    doc.text('Telephone:', 20, yPos);
    doc.setTextColor(...textColor);
    doc.text(data.clientPhone, 70, yPos);
  }

  yPos += 8;
  doc.setTextColor(...mutedColor);
  doc.text('Periode:', 20, yPos);
  doc.setTextColor(...textColor);
  doc.text('Du ' + formatDate(data.periodStart) + ' au ' + formatDate(data.periodEnd), 70, yPos);

  // Balance summary box
  yPos += 20;
  
  // Initial balance box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, yPos, 150, 35, 4, 4, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...mutedColor);
  doc.text('Solde initial', 28, yPos + 12);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(formatXAF(data.initialBalance) + ' XAF', 28, yPos + 26);

  // Final balance box
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(180, yPos, 150, 35, 4, 4, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Solde final', 188, yPos + 12);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(formatXAF(data.finalBalance) + ' XAF', 188, yPos + 26);

  // Variation
  const variation = data.finalBalance - data.initialBalance;
  yPos += 45;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Variation sur la periode:', 20, yPos);
  doc.setFont('helvetica', 'bold');
  if (variation >= 0) {
    doc.setTextColor(...successColor);
    doc.text('+' + formatXAF(variation) + ' XAF', 90, yPos);
  } else {
    doc.setTextColor(...dangerColor);
    doc.text(formatXAF(variation) + ' XAF', 90, yPos);
  }

  yPos += 20;

  // Movements table
  doc.setTextColor(...textColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Historique des mouvements', 20, yPos);
  
  yPos += 8;

  if (data.operations.length === 0) {
    yPos += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...mutedColor);
    doc.text('Aucun mouvement sur cette periode', 20, yPos);
  } else {
    // Prepare table data
    const tableData = data.operations.map(op => {
      const isCredit = op.operation_type === 'deposit' || 
        (op.operation_type === 'adjustment' && op.balance_after > op.balance_before);
      
      const amountStr = isCredit 
        ? '+' + formatXAF(op.amount_xaf)
        : '-' + formatXAF(op.amount_xaf);

      return [
        formatDateTime(op.created_at),
        getOperationLabel(op.operation_type, op.description),
        amountStr,
        formatXAF(op.balance_after) + ' XAF',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Libelle', 'Montant (XAF)', 'Solde apres']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 12,
      },
      bodyStyles: {
        fontSize: 11,
        textColor: textColor,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 60, halign: 'right' },
        3: { cellWidth: 70, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: 20, right: 20 },
      didParseCell: function(data) {
        // Color the amount column
        if (data.section === 'body' && data.column.index === 2) {
          const cellText = data.cell.text[0] || '';
          if (cellText.startsWith('+')) {
            data.cell.styles.textColor = successColor;
            data.cell.styles.fontStyle = 'bold';
          } else if (cellText.startsWith('-')) {
            data.cell.styles.textColor = dangerColor;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(229, 231, 235);
    doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(
      'BONZINI TRADING SARL - Document genere automatiquement',
      20,
      pageHeight - 8
    );
    doc.text(
      'Page ' + i + ' / ' + pageCount,
      pageWidth - 20,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  // Generate filename
  const clientNameClean = data.clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const periodStr = format(data.periodStart, 'yyyyMMdd') + '-' + format(data.periodEnd, 'yyyyMMdd');
  const filename = 'Releve_' + clientNameClean + '_' + periodStr + '.pdf';

  // Download
  doc.save(filename);
}
