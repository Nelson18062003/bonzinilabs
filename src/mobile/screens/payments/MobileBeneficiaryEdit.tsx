// ============================================================
// MODULE PAIEMENTS — MobileBeneficiaryEdit (admin)
// Full-page editor for the beneficiary info of a payment.
// Form rendering / state lives in <BeneficiaryEditForm>; this page
// owns the page chrome (header + sticky footer), the QR upload to
// admin storage, and the useAdminUpdateBeneficiaryInfo mutation.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { useAdminPaymentDetail } from '@/hooks/usePayments';
import { useAdminUpdateBeneficiaryInfo } from '@/hooks/useAdminPayments';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import {
  BeneficiaryEditForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryEditForm';

export function MobileBeneficiaryEdit() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('payments');

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const adminUpdateBeneficiaryInfo = useAdminUpdateBeneficiaryInfo();
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const handleSave = async (values: BeneficiaryFormValues, qrFile: File | null) => {
    if (!payment || !paymentId) return;

    try {
      let qrUrl: string | null = values.beneficiary_qr_code_url || null;

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      const identifier = values.beneficiary_identifier.trim();
      const isAlipayOrWechat =
        payment.method === 'alipay' || payment.method === 'wechat';

      await adminUpdateBeneficiaryInfo.mutateAsync({
        paymentId,
        beneficiaryInfo: {
          beneficiary_name: values.beneficiary_name || undefined,
          beneficiary_phone: values.beneficiary_phone || undefined,
          beneficiary_email: values.beneficiary_email || undefined,
          beneficiary_qr_code_url: qrUrl || undefined,
          beneficiary_bank_name: values.beneficiary_bank_name || undefined,
          beneficiary_bank_account: values.beneficiary_bank_account || undefined,
          beneficiary_bank_extra: values.beneficiary_bank_extra || undefined,
          beneficiary_notes: values.beneficiary_notes || undefined,
          beneficiary_identifier: identifier || undefined,
          beneficiary_identifier_type: isAlipayOrWechat && identifier ? 'id' : undefined,
        },
      });

      navigate(-1);
    } catch {
      // Mutation toast already surfaces the error.
    } finally {
      setIsUploadingQr(false);
    }
  };

  const isBusy = adminUpdateBeneficiaryInfo.isPending || isUploadingQr;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader
          title="Modifier bénéficiaire"
          showBack
          backTo={`/m/payments/${paymentId}`}
        />
        <SkeletonDetail />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Modifier bénéficiaire" showBack backTo="/m/payments" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Paiement introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Modifier bénéficiaire"
        showBack
        backTo={`/m/payments/${paymentId}`}
      />

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <BeneficiaryEditForm
          payment={payment}
          isSubmitting={isBusy}
          onSubmit={handleSave}
          onValidationError={(key) => toast.error(t(key))}
          renderActions={({ submit }) => (
            <div className="sticky bottom-0 bg-background border-t border-border -mx-4 px-4 py-3 mt-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={isBusy}
                  className="flex-1 h-12 rounded-xl border border-border font-medium text-sm disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isBusy}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
