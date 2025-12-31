import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ExportablePayment {
  id: string;
  reference: string;
  created_at: string;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: string;
  status: string;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_bank_name: string | null;
  beneficiary_bank_account: string | null;
  beneficiary_qr_code_url: string | null;
  client_name: string;
}

const formatXAF = (amount: number): string => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatRMB = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy', { locale: fr });
};

const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'alipay': return 'Alipay';
    case 'wechat': return 'WeChat Pay';
    case 'bank_transfer': return 'Virement Bancaire';
    case 'cash': return 'Cash';
    default: return method;
  }
};

export async function generatePaymentsExportPDF(payments: ExportablePayment[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryColor: [number, number, number] = [139, 92, 246]; // Purple
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const accentColor: [number, number, number] = [59, 130, 246];

  // ========== PAGE 1: RÉCAPITULATIF ==========
  let yPos = 20;

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('BONZINI TRADING', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Export Paiements - Prestataire Externe', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text('Genere le ' + formatDateTime(new Date()), pageWidth / 2, 40, { align: 'center' });

  yPos = 60;

  // Summary section
  doc.setTextColor(...textColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RECAPITULATIF', 20, yPos);
  
  yPos += 15;

  // Summary boxes
  const totalRMB = payments.reduce((sum, p) => sum + p.amount_rmb, 0);
  const totalXAF = payments.reduce((sum, p) => sum + p.amount_xaf, 0);

  // Number of payments box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, yPos, 80, 40, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Nombre de paiements', 28, yPos + 12);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(payments.length.toString(), 28, yPos + 32);

  // Total RMB box
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(110, yPos, 80, 40, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Total a payer (RMB)', 118, yPos + 12);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text(formatRMB(totalRMB) + ' Y', 118, yPos + 32);

  yPos += 55;

  // List of payment references
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Liste des paiements inclus:', 20, yPos);
  
  yPos += 8;

  // Table of payments summary
  const summaryData = payments.map((p, index) => [
    (index + 1).toString(),
    p.reference,
    p.client_name,
    getMethodLabel(p.method),
    formatRMB(p.amount_rmb) + ' Y',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Reference', 'Client', 'Methode', 'Montant RMB']],
    body: summaryData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 50 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: 20, right: 20 },
  });

  // Total row
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  doc.setFillColor(...primaryColor);
  doc.roundedRect(20, finalY + 5, pageWidth - 40, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL A PAYER:', 30, finalY + 14);
  doc.text(formatRMB(totalRMB) + ' RMB', pageWidth - 30, finalY + 14, { align: 'right' });

  // ========== PAGES SUIVANTES: 1 PAIEMENT PAR PAGE ==========
  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    doc.addPage();
    
    yPos = 20;

    // Header with page number
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BONZINI TRADING - Ordre de Paiement', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Paiement ' + (i + 1) + ' / ' + payments.length + ' - ' + payment.reference, pageWidth / 2, 28, { align: 'center' });

    yPos = 50;

    // Payment info section
    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Informations du paiement', 20, yPos);
    
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const infoLines = [
      ['Reference:', payment.reference],
      ['Client:', payment.client_name],
      ['Date creation:', formatDate(payment.created_at)],
      ['Methode:', getMethodLabel(payment.method)],
      ['Taux applique:', '1 RMB = ' + formatXAF(Math.round(payment.amount_xaf / payment.amount_rmb)) + ' XAF'],
      ['Equivalent XAF:', formatXAF(payment.amount_xaf) + ' XAF'],
    ];

    infoLines.forEach(([label, value]) => {
      doc.setTextColor(...mutedColor);
      doc.text(label, 20, yPos);
      doc.setTextColor(...textColor);
      doc.text(value, 70, yPos);
      yPos += 7;
    });

    // ========== MONTANT À PAYER (TRÈS GROS) ==========
    yPos += 10;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(20, yPos, pageWidth - 40, 50, 6, 6, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('MONTANT A PAYER', pageWidth / 2, yPos + 15, { align: 'center' });
    
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(formatRMB(payment.amount_rmb) + ' RMB', pageWidth / 2, yPos + 40, { align: 'center' });

    yPos += 65;

    // ========== INFORMATIONS BÉNÉFICIAIRE ==========
    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Informations du beneficiaire', 20, yPos);
    
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (payment.beneficiary_name) {
      doc.setTextColor(...mutedColor);
      doc.text('Nom:', 20, yPos);
      doc.setTextColor(...textColor);
      doc.text(payment.beneficiary_name, 70, yPos);
      yPos += 7;
    }

    if (payment.beneficiary_phone) {
      doc.setTextColor(...mutedColor);
      doc.text('Telephone:', 20, yPos);
      doc.setTextColor(...textColor);
      doc.text(payment.beneficiary_phone, 70, yPos);
      yPos += 7;
    }

    if (payment.beneficiary_bank_name) {
      doc.setTextColor(...mutedColor);
      doc.text('Banque:', 20, yPos);
      doc.setTextColor(...textColor);
      doc.text(payment.beneficiary_bank_name, 70, yPos);
      yPos += 7;
    }

    if (payment.beneficiary_bank_account) {
      doc.setTextColor(...mutedColor);
      doc.text('Compte:', 20, yPos);
      doc.setTextColor(...textColor);
      doc.text(payment.beneficiary_bank_account, 70, yPos);
      yPos += 7;
    }

    // ========== QR CODE ==========
    if (payment.beneficiary_qr_code_url) {
      yPos += 10;
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(20, yPos, pageWidth - 40, 90, 4, 4, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      doc.text('QR Code de paiement', pageWidth / 2, yPos + 12, { align: 'center' });
      
      // Try to load and embed QR code image
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              // Center the QR code
              const qrSize = 60;
              const qrX = (pageWidth - qrSize) / 2;
              doc.addImage(img, 'PNG', qrX, yPos + 18, qrSize, qrSize);
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => {
            // If image fails to load, show URL instead
            doc.setFontSize(8);
            doc.setTextColor(...mutedColor);
            doc.text('QR Code URL:', 30, yPos + 40);
            doc.setTextColor(...accentColor);
            const urlText = payment.beneficiary_qr_code_url || '';
            const truncatedUrl = urlText.length > 60 ? urlText.substring(0, 60) + '...' : urlText;
            doc.text(truncatedUrl, 30, yPos + 50);
            resolve();
          };
          img.src = payment.beneficiary_qr_code_url || '';
        });
      } catch {
        // Fallback: show URL
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text('QR Code disponible a:', 30, yPos + 40);
        doc.setTextColor(...accentColor);
        const urlText = payment.beneficiary_qr_code_url || '';
        const truncatedUrl = urlText.length > 80 ? urlText.substring(0, 80) + '...' : urlText;
        doc.text(truncatedUrl, 30, yPos + 50);
      }
    }

    // Footer
    doc.setDrawColor(229, 231, 235);
    doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Document confidentiel - Usage interne uniquement', 20, pageHeight - 8);
    doc.text('Page ' + (i + 2) + ' / ' + (payments.length + 1), pageWidth - 20, pageHeight - 8, { align: 'right' });
  }

  // Add footer to first page
  doc.setPage(1);
  doc.setDrawColor(229, 231, 235);
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Document confidentiel - Usage interne uniquement', 20, pageHeight - 8);
  doc.text('Page 1 / ' + (payments.length + 1), pageWidth - 20, pageHeight - 8, { align: 'right' });

  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
  const filename = 'Export_Paiements_' + dateStr + '.pdf';

  // Download
  doc.save(filename);
}
