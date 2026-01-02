import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { downloadPaymentReceiptPDF, PaymentReceiptData } from '@/lib/generatePaymentReceiptPDF';

interface PaymentReceiptButtonProps {
  payment: {
    id: string;
    reference: string;
    created_at: string;
    processed_at: string | null;
    amount_xaf: number;
    amount_rmb: number;
    exchange_rate: number;
    method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
    status: string;
    user_id: string;
    beneficiary_name: string | null;
    beneficiary_phone: string | null;
    beneficiary_bank_name: string | null;
    beneficiary_bank_account: string | null;
    beneficiary_qr_code_url: string | null;
    profiles?: {
      first_name?: string;
      last_name?: string;
      phone?: string;
    } | null;
  };
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

export function PaymentReceiptButton({ payment, proofs }: PaymentReceiptButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const isCompleted = payment.status === 'completed';
  
  const clientName = payment.profiles 
    ? `${payment.profiles.first_name || ''} ${payment.profiles.last_name || ''}`.trim() 
    : 'Client inconnu';
  
  const handleDownload = async () => {
    setIsGenerating(true);
    
    try {
      const receiptData: PaymentReceiptData = {
        id: payment.id,
        reference: payment.reference,
        created_at: payment.created_at,
        processed_at: payment.processed_at,
        amount_xaf: payment.amount_xaf,
        amount_rmb: payment.amount_rmb,
        exchange_rate: payment.exchange_rate,
        method: payment.method,
        status: payment.status,
        client_name: clientName,
        client_id: payment.user_id,
        client_phone: payment.profiles?.phone || null,
        beneficiary_name: payment.beneficiary_name,
        beneficiary_phone: payment.beneficiary_phone,
        beneficiary_bank_name: payment.beneficiary_bank_name,
        beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        proofs: proofs || [],
      };
      
      await downloadPaymentReceiptPDF(receiptData);
      toast.success('Fiche PDF téléchargée');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Impossible de générer le PDF — réessayez');
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (!isCompleted) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                variant="outline" 
                disabled
                className="w-full opacity-50 cursor-not-allowed"
              >
                <FileText className="w-4 h-4 mr-2" />
                Télécharger la fiche PDF
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Disponible après paiement effectué</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      className="w-full"
      onClick={handleDownload}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4 mr-2" />
          Télécharger la fiche PDF
        </>
      )}
    </Button>
  );
}
