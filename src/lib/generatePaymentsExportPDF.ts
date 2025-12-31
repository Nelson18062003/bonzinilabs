import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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

const formatRMB = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm');
};

const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'alipay': return 'Alipay';
    case 'wechat': return 'WeChat Pay';
    case 'bank_transfer': return 'Bank Transfer';
    case 'cash': return 'Cash';
    default: return method;
  }
};

export async function generatePaymentsExportPDF(payments: ExportablePayment[]): Promise<jsPDF> {
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

  // ========== PAGE 1: SUMMARY ==========
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
  doc.text('Payment Orders for External Partner', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text('Generated on ' + formatDateTime(new Date()), pageWidth / 2, 40, { align: 'center' });

  yPos = 60;

  // Summary section
  doc.setTextColor(...textColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 20, yPos);
  
  yPos += 15;

  // Summary boxes
  const totalRMB = payments.reduce((sum, p) => sum + p.amount_rmb, 0);

  // Number of payments box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, yPos, 80, 40, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Number of Payments', 28, yPos + 12);
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
  doc.text('Total Amount (RMB)', 118, yPos + 12);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text(formatRMB(totalRMB) + ' Y', 118, yPos + 32);

  yPos += 55;

  // List of payment references
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Payments Included:', 20, yPos);
  
  yPos += 8;

  // Table of payments summary
  const summaryData = payments.map((p, index) => [
    (index + 1).toString(),
    p.beneficiary_name || '-',
    getMethodLabel(p.method),
    formatRMB(p.amount_rmb) + ' Y',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Beneficiary', 'Method', 'Amount RMB']],
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
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
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
  doc.text('TOTAL TO PAY:', 30, finalY + 14);
  doc.text(formatRMB(totalRMB) + ' RMB', pageWidth - 30, finalY + 14, { align: 'right' });

  // Footer on first page
  doc.setDrawColor(229, 231, 235);
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Confidential Document - Internal Use Only', 20, pageHeight - 8);
  doc.text('Page 1 / ' + (payments.length + 1), pageWidth - 20, pageHeight - 8, { align: 'right' });

  // ========== FOLLOWING PAGES: 1 PAYMENT PER PAGE ==========
  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    doc.addPage();
    
    yPos = 0;

    // Clear visual separator - top banner with payment number and reference
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT ORDER ' + (i + 1) + ' / ' + payments.length, pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(payment.reference, pageWidth / 2, 24, { align: 'center' });

    yPos = 40;

    // ========== AMOUNT TO PAY (VERY LARGE) ==========
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(15, yPos, pageWidth - 30, 45, 6, 6, 'F');
    
    // Add border for emphasis
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(2);
    doc.roundedRect(15, yPos, pageWidth - 30, 45, 6, 6, 'S');
    doc.setLineWidth(0.2);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('AMOUNT TO PAY', pageWidth / 2, yPos + 12, { align: 'center' });
    
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(formatRMB(payment.amount_rmb) + ' RMB', pageWidth / 2, yPos + 36, { align: 'center' });

    yPos += 55;

    // ========== BENEFICIARY INFO (compact) ==========
    const hasBeneficiaryInfo = payment.beneficiary_name || payment.beneficiary_phone || 
                               payment.beneficiary_bank_name || payment.beneficiary_bank_account;
    
    if (hasBeneficiaryInfo) {
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(15, yPos, pageWidth - 30, 40, 4, 4, 'F');
      
      let infoY = yPos + 10;
      doc.setFontSize(10);

      // Two columns layout
      const leftCol = 25;
      const rightCol = pageWidth / 2 + 10;

      if (payment.beneficiary_name) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text('Name:', leftCol, infoY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text(payment.beneficiary_name, leftCol + 25, infoY);
      }

      if (payment.beneficiary_phone) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text('Phone:', rightCol, infoY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text(payment.beneficiary_phone, rightCol + 25, infoY);
      }

      infoY += 12;

      if (payment.beneficiary_bank_name) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text('Bank:', leftCol, infoY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text(payment.beneficiary_bank_name, leftCol + 25, infoY);
      }

      if (payment.beneficiary_bank_account) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text('Account:', rightCol, infoY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text(payment.beneficiary_bank_account, rightCol + 30, infoY);
      }

      yPos += 50;
    }

    // ========== QR CODE (larger area) ==========
    if (payment.beneficiary_qr_code_url) {
      const qrBoxHeight = pageHeight - yPos - 35;
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(15, yPos, pageWidth - 30, qrBoxHeight, 4, 4, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(15, yPos, pageWidth - 30, qrBoxHeight, 4, 4, 'S');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      doc.text('Payment QR Code', pageWidth / 2, yPos + 12, { align: 'center' });
      
      // Calculate QR size to fill available space
      const availableHeight = qrBoxHeight - 25;
      const qrSize = Math.min(availableHeight - 10, 120);
      
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              const qrX = (pageWidth - qrSize) / 2;
              const qrY = yPos + 18;
              doc.addImage(img, 'PNG', qrX, qrY, qrSize, qrSize);
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => {
            doc.setFontSize(8);
            doc.setTextColor(...mutedColor);
            doc.text('QR Code URL:', 25, yPos + 50);
            doc.setTextColor(...accentColor);
            const urlText = payment.beneficiary_qr_code_url || '';
            const truncatedUrl = urlText.length > 70 ? urlText.substring(0, 70) + '...' : urlText;
            doc.text(truncatedUrl, 25, yPos + 60);
            resolve();
          };
          img.src = payment.beneficiary_qr_code_url || '';
        });
      } catch {
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text('QR Code available at:', 25, yPos + 50);
        doc.setTextColor(...accentColor);
        const urlText = payment.beneficiary_qr_code_url || '';
        const truncatedUrl = urlText.length > 80 ? urlText.substring(0, 80) + '...' : urlText;
        doc.text(truncatedUrl, 25, yPos + 60);
      }
    }

    // ========== VISUAL SEPARATOR AT BOTTOM ==========
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(3);
    doc.line(20, pageHeight - 22, pageWidth - 20, pageHeight - 22);
    doc.setLineWidth(0.2);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Confidential Document - Internal Use Only', 20, pageHeight - 8);
    doc.text('Page ' + (i + 2) + ' / ' + (payments.length + 1), pageWidth - 20, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

export async function downloadPaymentsExportPDF(payments: ExportablePayment[]): Promise<void> {
  const doc = await generatePaymentsExportPDF(payments);
  
  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
  const filename = 'Payment_Orders_' + dateStr + '.pdf';

  // Download
  doc.save(filename);
}
