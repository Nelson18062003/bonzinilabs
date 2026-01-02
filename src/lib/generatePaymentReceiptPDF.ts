import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface PaymentReceiptData {
  // Payment info
  id: string;
  reference: string;
  created_at: string;
  processed_at: string | null;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  status: string;
  
  // Client info
  client_name: string;
  client_id: string;
  client_phone: string | null;
  
  // Beneficiary info
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_bank_name: string | null;
  beneficiary_bank_account: string | null;
  beneficiary_qr_code_url: string | null;
  
  // Proofs
  proofs: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    description: string | null;
    created_at: string;
    uploaded_by_type: string;
  }>;
}

const formatRMB = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatXAF = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
};

const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'alipay': return 'Alipay';
    case 'wechat': return 'WeChat Pay';
    case 'bank_transfer': return 'Virement bancaire';
    case 'cash': return 'Cash';
    default: return method;
  }
};

// Load Chinese font from Google Fonts CDN
const loadChineseFont = async (): Promise<string | null> => {
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf';
    
    const response = await fetch(fontUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Failed to load Chinese font:', error);
    return null;
  }
};

// Load image and return it with original dimensions
const loadImage = async (url: string): Promise<{ img: HTMLImageElement; width: number; height: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      resolve({
        img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// Add image to PDF preserving aspect ratio
const addImageToPage = (
  doc: jsPDF,
  img: HTMLImageElement,
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  centerX: number,
  startY: number
): { width: number; height: number; x: number; y: number } => {
  let imgWidth = originalWidth;
  let imgHeight = originalHeight;
  
  // Scale down if needed, preserving aspect ratio
  if (imgWidth > maxWidth) {
    const scale = maxWidth / imgWidth;
    imgWidth = maxWidth;
    imgHeight = imgHeight * scale;
  }
  
  if (imgHeight > maxHeight) {
    const scale = maxHeight / imgHeight;
    imgHeight = maxHeight;
    imgWidth = imgWidth * scale;
  }
  
  const x = centerX - imgWidth / 2;
  const y = startY;
  
  doc.addImage(img, 'PNG', x, y, imgWidth, imgHeight);
  
  return { width: imgWidth, height: imgHeight, x, y };
};

export async function generatePaymentReceiptPDF(data: PaymentReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Load and register Chinese font
  const chineseFontBase64 = await loadChineseFont();
  let useChineseFont = false;
  
  if (chineseFontBase64) {
    try {
      doc.addFileToVFS('NotoSansSC.ttf', chineseFontBase64);
      doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'normal');
      useChineseFont = true;
    } catch (error) {
      console.error('Failed to add Chinese font to PDF:', error);
    }
  }
  
  const setFont = (style: 'normal' | 'bold' = 'normal') => {
    if (useChineseFont) {
      doc.setFont('NotoSansSC', 'normal');
    } else {
      doc.setFont('helvetica', style);
    }
  };
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  // Colors
  const primaryColor: [number, number, number] = [139, 92, 246];
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const successColor: [number, number, number] = [34, 197, 94];

  let yPos = 0;
  let pageNumber = 1;
  const totalPages = 1 + Math.ceil(data.proofs.length / 1); // 1 page + proofs

  const drawFooter = (currentPage: number) => {
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Bonzini — Document généré le ${formatDateShort(new Date())}`, margin, pageHeight - 12);
    doc.text(`Page ${currentPage}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  };

  // ========== PAGE 1: MAIN INFO ==========
  
  // Header with logo
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BONZINI TRADING', pageWidth / 2, 16, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('FICHE DE PAIEMENT', pageWidth / 2, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(data.reference, pageWidth / 2, 36, { align: 'center' });

  yPos = 50;

  // Status badge
  doc.setFillColor(...successColor);
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('✓ PAIEMENT EFFECTUÉ', pageWidth / 2, yPos + 8, { align: 'center' });

  yPos += 20;

  // ========== BLOC RÉCAPITULATIF ==========
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, contentWidth, 65, 3, 3, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 65, 3, 3, 'S');
  
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉCAPITULATIF DU PAIEMENT', margin + 5, yPos + 8);
  
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  let infoY = yPos + 18;
  
  const drawInfoRow = (label: string, value: string, x: number, y: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(label, x, y);
    doc.setFontSize(10);
    setFont('bold');
    doc.setTextColor(...textColor);
    doc.text(value || 'Non renseigné', x, y + 5);
  };
  
  drawInfoRow('ID Paiement', data.id.substring(0, 8).toUpperCase(), col1X, infoY);
  drawInfoRow('Statut', 'Paiement effectué', col2X, infoY);
  
  infoY += 15;
  drawInfoRow('Date de création', formatDateTime(data.created_at), col1X, infoY);
  drawInfoRow('Date effectué', data.processed_at ? formatDateTime(data.processed_at) : 'Non renseigné', col2X, infoY);
  
  infoY += 15;
  drawInfoRow('Mode de paiement', getMethodLabel(data.method), col1X, infoY);
  drawInfoRow('Taux appliqué', `1 RMB = ${(1 / data.exchange_rate).toFixed(2)} XAF`, col2X, infoY);
  
  yPos += 75;

  // ========== MONTANTS ==========
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'S');
  
  // XAF debited
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Montant débité', margin + 10, yPos + 10);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(`${formatXAF(data.amount_xaf)} XAF`, margin + 10, yPos + 22);
  
  // RMB sent
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Montant envoyé', pageWidth / 2 + 10, yPos + 10);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`${formatRMB(data.amount_rmb)} RMB`, pageWidth / 2 + 10, yPos + 24);

  yPos += 45;

  // ========== CLIENT INFO ==========
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
  
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT', margin + 5, yPos + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Nom:', margin + 5, yPos + 18);
  doc.text('ID:', pageWidth / 2, yPos + 18);
  doc.text('Téléphone:', margin + 5, yPos + 26);
  
  doc.setTextColor(...textColor);
  setFont('bold');
  doc.text(data.client_name || 'Non renseigné', margin + 25, yPos + 18);
  doc.text(data.client_id.substring(0, 8).toUpperCase(), pageWidth / 2 + 15, yPos + 18);
  doc.text(data.client_phone || 'Non renseigné', margin + 40, yPos + 26);

  yPos += 40;

  // ========== BENEFICIARY INFO ==========
  const beneficiaryHeight = data.method === 'bank_transfer' ? 45 : 
                           (data.method === 'cash' ? 25 : 35);
  
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, yPos, contentWidth, beneficiaryHeight, 3, 3, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, beneficiaryHeight, 3, 3, 'S');
  
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BÉNÉFICIAIRE', margin + 5, yPos + 8);
  
  let benefY = yPos + 16;
  
  if (data.method === 'cash') {
    doc.setFontSize(10);
    setFont('normal');
    doc.setTextColor(...textColor);
    doc.text('Paiement cash au bureau', margin + 5, benefY);
  } else if (data.method === 'bank_transfer') {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Banque:', margin + 5, benefY);
    doc.text('Compte:', pageWidth / 2, benefY);
    
    doc.setTextColor(...textColor);
    setFont('bold');
    doc.text(data.beneficiary_bank_name || 'Non renseigné', margin + 30, benefY);
    doc.text(data.beneficiary_bank_account || 'Non renseigné', pageWidth / 2 + 25, benefY);
    
    benefY += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Nom:', margin + 5, benefY);
    doc.text('Téléphone:', pageWidth / 2, benefY);
    
    doc.setTextColor(...textColor);
    setFont('bold');
    doc.text(data.beneficiary_name || 'Non renseigné', margin + 25, benefY);
    doc.text(data.beneficiary_phone || 'Non renseigné', pageWidth / 2 + 35, benefY);
  } else {
    // Alipay / WeChat
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text('Nom:', margin + 5, benefY);
    doc.text('Téléphone/ID:', pageWidth / 2, benefY);
    
    doc.setTextColor(...textColor);
    setFont('bold');
    doc.text(data.beneficiary_name || 'Non renseigné', margin + 25, benefY);
    doc.text(data.beneficiary_phone || 'Non renseigné', pageWidth / 2 + 40, benefY);
    
    if (data.beneficiary_qr_code_url) {
      benefY += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...mutedColor);
      doc.text('(QR Code sur la page suivante)', margin + 5, benefY);
    }
  }

  yPos += beneficiaryHeight + 10;

  // ========== QR CODE SECTION (for Alipay/WeChat) ==========
  if ((data.method === 'alipay' || data.method === 'wechat') && data.beneficiary_qr_code_url) {
    const remainingHeight = pageHeight - yPos - 30;
    
    if (remainingHeight > 80) {
      // Draw QR code on this page
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`QR CODE ${data.method === 'alipay' ? 'ALIPAY' : 'WECHAT'}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 5;
      
      const qrData = await loadImage(data.beneficiary_qr_code_url);
      if (qrData) {
        const maxQrHeight = remainingHeight - 15;
        const maxQrWidth = contentWidth - 40;
        
        addImageToPage(
          doc,
          qrData.img,
          qrData.width,
          qrData.height,
          maxQrWidth,
          maxQrHeight,
          pageWidth / 2,
          yPos
        );
      } else {
        doc.setFontSize(9);
        doc.setTextColor(...mutedColor);
        doc.text('QR Code non disponible', pageWidth / 2, yPos + 20, { align: 'center' });
      }
    }
  }

  // Footer
  drawFooter(pageNumber);

  // ========== PROOFS PAGES ==========
  if (data.proofs.length > 0) {
    for (let i = 0; i < data.proofs.length; i++) {
      const proof = data.proofs[i];
      doc.addPage();
      pageNumber++;
      
      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PREUVE DE PAIEMENT', pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${i + 1} / ${data.proofs.length}`, pageWidth / 2, 20, { align: 'center' });
      
      yPos = 35;
      
      // Proof info
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      doc.text('Ajoutée le:', margin + 5, yPos + 8);
      doc.text('Par:', pageWidth / 2, yPos + 8);
      
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDateShort(proof.created_at), margin + 35, yPos + 8);
      doc.text(proof.uploaded_by_type === 'admin' ? 'Bonzini' : 'Client', pageWidth / 2 + 15, yPos + 8);
      
      if (proof.description) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text(`Type: ${proof.description}`, margin + 5, yPos + 16);
      }
      
      yPos += 28;
      
      // Load and display proof image
      const imageData = await loadImage(proof.file_url);
      
      if (imageData) {
        const availableHeight = pageHeight - yPos - 30;
        const availableWidth = contentWidth;
        
        // Draw border
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        
        const result = addImageToPage(
          doc,
          imageData.img,
          imageData.width,
          imageData.height,
          availableWidth,
          availableHeight,
          pageWidth / 2,
          yPos
        );
        
        // Draw border around image
        doc.roundedRect(result.x - 2, result.y - 2, result.width + 4, result.height + 4, 2, 2, 'S');
      } else {
        // Image failed to load
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'F');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text('Impossible de charger l\'image', pageWidth / 2, yPos + 20, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(proof.file_name, pageWidth / 2, yPos + 32, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        const truncatedUrl = proof.file_url.length > 60 
          ? proof.file_url.substring(0, 60) + '...' 
          : proof.file_url;
        doc.text(truncatedUrl, pageWidth / 2, yPos + 42, { align: 'center' });
      }
      
      drawFooter(pageNumber);
    }
  } else {
    // No proofs - add a note on a new page or at the bottom
    doc.addPage();
    pageNumber++;
    
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PREUVES DE PAIEMENT', pageWidth / 2, 15, { align: 'center' });
    
    yPos = 50;
    
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('Aucune preuve disponible', pageWidth / 2, yPos + 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Les preuves de paiement n\'ont pas encore été ajoutées', pageWidth / 2, yPos + 30, { align: 'center' });
    
    drawFooter(pageNumber);
  }

  return doc;
}

export async function downloadPaymentReceiptPDF(data: PaymentReceiptData): Promise<void> {
  const doc = await generatePaymentReceiptPDF(data);
  
  // Generate filename
  const dateStr = format(new Date(), 'yyyyMMdd');
  const clientName = data.client_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const filename = `Paiement_${data.reference}_${clientName}_${dateStr}.pdf`;

  doc.save(filename);
}
