import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';
import { toast } from 'sonner';

interface CashReceiptDownloadButtonProps {
  payment: {
    id: string;
    reference: string;
    amount_rmb: number;
    amount_xaf: number;
    exchange_rate?: number;
    status: string;
    method: string;
    created_at: string;
    processed_at?: string | null;
    cash_paid_at?: string | null;
    cash_signature_url?: string | null;
    cash_signature_timestamp?: string | null;
    cash_signed_by_name?: string | null;
    cash_beneficiary_first_name?: string | null;
    cash_beneficiary_last_name?: string | null;
    cash_beneficiary_phone?: string | null;
    beneficiary_name?: string | null;
    beneficiary_phone?: string | null;
    beneficiary_email?: string | null;
  };
  client?: {
    first_name: string;
    last_name: string;
    phone?: string | null;
  };
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
}

export function CashReceiptDownloadButton({
  payment,
  client,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Télécharger le reçu PDF',
}: CashReceiptDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const isCashPayment = payment.method === 'cash';
  const isPaid = payment.status === 'completed';
  const canDownload = isCashPayment && isPaid;

  const handleDownload = async () => {
    if (!canDownload) return;

    setIsGenerating(true);
    try {
      const beneficiaryName = payment.cash_beneficiary_first_name
        ? `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name || ''}`
        : payment.beneficiary_name || undefined;

      const clientName = client
        ? `${client.first_name} ${client.last_name}`
        : 'Client';

      const receiptData: PaymentReceiptData = {
        id: payment.id,
        reference: payment.reference,
        created_at: payment.created_at,
        processed_at: payment.processed_at || payment.cash_paid_at,
        amount_xaf: payment.amount_xaf,
        amount_rmb: payment.amount_rmb,
        exchange_rate: payment.exchange_rate || 0,
        method: payment.method,
        status: payment.status,
        client_name: clientName,
        client_phone: client?.phone,
        beneficiary_name: beneficiaryName,
        beneficiary_phone: payment.cash_beneficiary_phone || payment.beneficiary_phone,
        beneficiary_email: payment.beneficiary_email,
        cash_signature_url: payment.cash_signature_url,
        cash_signature_timestamp: payment.cash_signature_timestamp,
        cash_signed_by_name: payment.cash_signed_by_name,
      };

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `Recu_Cash_${payment.reference}_${dateStr}.pdf`,
      );
      toast.success('Reçu PDF téléchargé');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isCashPayment) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDownload}
      disabled={!canDownload || isGenerating}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <FileDown className="w-4 h-4 mr-2" />
      )}
      {!isPaid ? 'Disponible après paiement' : label}
    </Button>
  );
}
