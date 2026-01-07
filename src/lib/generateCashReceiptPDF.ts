import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CashPaymentPDFData {
  id: string;
  reference: string;
  amount_rmb: number;
  amount_xaf: number;
  exchange_rate?: number;
  created_at: string;
  cash_paid_at: string | null;
  cash_signature_url: string | null;
  cash_signed_by_name: string | null;
  cash_beneficiary_first_name: string | null;
  cash_beneficiary_last_name: string | null;
  cash_beneficiary_phone: string | null;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_email: string | null;
  client?: {
    first_name: string;
    last_name: string;
    phone?: string | null;
  };
}

export async function generateCashPaymentReceiptPDF(payment: CashPaymentPDFData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Helper functions
  const formatRMB = (amount: number) => `¥ ${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  const formatXAF = (amount: number) => `${amount.toLocaleString('fr-FR')} XAF`;

  const getBeneficiaryName = () => {
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '-';
  };

  const getBeneficiaryPhone = () => payment.cash_beneficiary_phone || payment.beneficiary_phone || '-';

  // ===== HEADER =====
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('BONZINI', margin, 20);

  // Receipt title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Reçu de paiement cash / Cash Payment Receipt', margin, 32);

  // Status badge
  doc.setFillColor(34, 197, 94); // green-500
  doc.roundedRect(pageWidth - margin - 30, 12, 30, 10, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYÉ', pageWidth - margin - 15, 19, { align: 'center' });

  y = 55;

  // ===== RECEIPT NUMBER =====
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Numéro de reçu / Receipt Number:', margin, y);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const receiptNumber = `BONZ-CASH-${payment.reference}`;
  doc.text(receiptNumber, margin, y + 6);

  y += 18;

  // ===== SECTION: PAYMENT INFO =====
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 40, 3, 3, 'F');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS PAIEMENT / PAYMENT DETAILS', margin + 5, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);

  const col1 = margin + 5;
  const col2 = pageWidth / 2 + 5;

  doc.text(`ID: ${payment.id.slice(0, 8)}...`, col1, y + 18);
  doc.text(`Mode: Cash / Espèces`, col2, y + 18);

  const createdDate = format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: fr });
  doc.text(`Créé le: ${createdDate}`, col1, y + 26);

  if (payment.cash_paid_at) {
    const paidDate = format(new Date(payment.cash_paid_at), 'dd/MM/yyyy HH:mm', { locale: fr });
    doc.text(`Payé le: ${paidDate}`, col2, y + 26);
  }

  doc.text('Bureau: Guangzhou', col1, y + 34);

  y += 50;

  // ===== SECTION: AMOUNTS =====
  doc.setFillColor(220, 252, 231); // green-100
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 35, 3, 3, 'F');

  doc.setTextColor(22, 101, 52); // green-800
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTANT REMIS / AMOUNT PAID', margin + 5, y + 8);

  doc.setFontSize(28);
  doc.text(formatRMB(payment.amount_rmb), margin + 5, y + 26);

  // XAF and rate on the right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Équivalent: ${formatXAF(payment.amount_xaf)}`, col2, y + 18);
  if (payment.exchange_rate) {
    doc.text(`Taux: 1 RMB = ${payment.exchange_rate.toFixed(2)} XAF`, col2, y + 26);
  }

  y += 45;

  // ===== SECTION: CLIENT =====
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, (pageWidth - 2 * margin) / 2 - 3, 35, 3, 3, 'F');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT BONZINI', margin + 5, y + 8);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (payment.client) {
    doc.text(`${payment.client.first_name} ${payment.client.last_name}`, margin + 5, y + 18);
    if (payment.client.phone) {
      doc.text(payment.client.phone, margin + 5, y + 26);
    }
  } else {
    doc.text('-', margin + 5, y + 18);
  }

  // ===== SECTION: BENEFICIARY =====
  const beneficiaryX = pageWidth / 2 + 3;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(beneficiaryX, y, (pageWidth - 2 * margin) / 2 - 3, 35, 3, 3, 'F');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BÉNÉFICIAIRE / BENEFICIARY', beneficiaryX + 5, y + 8);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(getBeneficiaryName(), beneficiaryX + 5, y + 18);
  doc.text(getBeneficiaryPhone(), beneficiaryX + 5, y + 26);

  y += 45;

  // ===== SECTION: SIGNATURE =====
  doc.setFillColor(254, 249, 195); // yellow-100
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 60, 3, 3, 'F');

  doc.setTextColor(133, 77, 14); // yellow-800
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURE DU BÉNÉFICIAIRE / BENEFICIARY SIGNATURE', margin + 5, y + 8);

  // Signature image
  if (payment.cash_signature_url) {
    try {
      const img = await loadImage(payment.cash_signature_url);
      
      // Calculate dimensions preserving aspect ratio
      const maxWidth = 80;
      const maxHeight = 35;
      let imgWidth = img.width;
      let imgHeight = img.height;
      
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      imgWidth = imgWidth * ratio;
      imgHeight = imgHeight * ratio;

      // Center the signature
      const imgX = margin + 5;
      const imgY = y + 12;

      doc.addImage(img, 'PNG', imgX, imgY, imgWidth, imgHeight);
    } catch (error) {
      console.error('Error loading signature image:', error);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text('[Signature non disponible]', margin + 5, y + 30);
    }
  }

  // Signature details on the right
  doc.setTextColor(133, 77, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (payment.cash_signed_by_name) {
    doc.text(`Signataire: ${payment.cash_signed_by_name}`, col2, y + 20);
  }
  if (payment.cash_paid_at) {
    doc.text(`Date: ${format(new Date(payment.cash_paid_at), 'dd/MM/yyyy HH:mm')}`, col2, y + 30);
  }

  y += 70;

  // ===== LEGAL MENTION =====
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Ce reçu atteste que le paiement cash a été remis au bénéficiaire.',
    margin,
    y
  );
  doc.text(
    'This receipt certifies that the cash payment has been delivered to the beneficiary.',
    margin,
    y + 5
  );

  y += 15;

  doc.setFontSize(8);
  doc.text(`Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, margin, y);
  doc.text('Bonzini — Guangzhou, China', pageWidth - margin, y, { align: 'right' });

  // Download
  const fileName = `Recu-Cash-${payment.reference}-${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}

// Helper to load image as base64
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
