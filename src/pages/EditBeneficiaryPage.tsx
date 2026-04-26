// ============================================================
// PAGE — Edit Beneficiary (client side).
// Full-page editor that replaces the in-place dialog. The page
// pattern matches the admin's MobileBeneficiaryEdit so iOS keyboards
// don't fight a Dialog scroll container — this is a much better
// mobile UX. The form rendering / state is delegated to the shared
// <BeneficiaryEditForm>; this page only owns chrome + side effects.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import {
  usePaymentDetail,
  useUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import {
  BeneficiaryEditForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryEditForm';

export default function EditBeneficiaryPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('payments');

  const { data: payment, isLoading } = usePaymentDetail(paymentId);
  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const goBackToPayment = () => {
    if (paymentId) navigate(`/payments/${paymentId}`);
    else navigate('/payments');
  };

  const handleSave = async (values: BeneficiaryFormValues, qrFile: File | null) => {
    if (!payment || !paymentId) return;

    try {
      let qrUrl: string | null = values.beneficiary_qr_code_url || null;

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      await updateBeneficiaryInfo.mutateAsync({
        paymentId,
        beneficiaryInfo: {
          beneficiary_name: values.beneficiary_name || null,
          beneficiary_phone: values.beneficiary_phone || null,
          beneficiary_email: values.beneficiary_email || null,
          beneficiary_qr_code_url: qrUrl,
          beneficiary_bank_name: values.beneficiary_bank_name || null,
          beneficiary_bank_account: values.beneficiary_bank_account || null,
          beneficiary_bank_extra: values.beneficiary_bank_extra || null,
          beneficiary_notes: values.beneficiary_notes || null,
          beneficiary_identifier: values.beneficiary_identifier || null,
          beneficiary_identifier_type:
            (payment.method === 'alipay' || payment.method === 'wechat') &&
            values.beneficiary_identifier
              ? 'id'
              : null,
        },
        paymentMethod: payment.method,
      });

      toast.success(t('detail.toast.beneficiarySaved'));
      goBackToPayment();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('detail.toast.saveFailed');
      toast.error(message);
    } finally {
      setIsUploadingQr(false);
    }
  };

  const isBusy = updateBeneficiaryInfo.isPending || isUploadingQr;

  if (isLoading) {
    return (
      <MobileLayout>
        <PageHeader title={t('detail.dialog.editTitle')} showBack onBack={goBackToPayment} />
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!payment) {
    return (
      <MobileLayout>
        <PageHeader title={t('detail.dialog.editTitle')} showBack onBack={() => navigate('/payments')} />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">{t('detail.notFound')}</p>
          <Button onClick={() => navigate('/payments')} className="mt-4">
            {t('detail.backToPayments')}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const hasBeneficiaryInfo =
    payment.method === 'cash' ||
    !!payment.beneficiary_qr_code_url ||
    !!payment.beneficiary_name ||
    !!payment.beneficiary_phone ||
    !!payment.beneficiary_email ||
    !!payment.beneficiary_bank_account;

  const headerTitle = hasBeneficiaryInfo
    ? t('detail.dialog.editTitle')
    : t('detail.dialog.addTitle');

  return (
    <MobileLayout showNav={false}>
      <PageHeader title={headerTitle} showBack onBack={goBackToPayment} />

      <div className="px-4 py-4 pb-32">
        {/* Method-specific lead-in */}
        {payment.method === 'alipay' && (
          <p className="text-sm text-muted-foreground mb-4">
            {t('detail.dialog.alipayDescription')}
          </p>
        )}
        {payment.method === 'wechat' && (
          <p className="text-sm text-muted-foreground mb-4">
            {t('detail.dialog.wechatDescription')}
          </p>
        )}
        {payment.method === 'bank_transfer' && (
          <p className="text-sm text-muted-foreground mb-4">
            {t('detail.dialog.bankTransferDescription')}
          </p>
        )}
        {payment.method === 'cash' && (
          <p className="text-sm text-muted-foreground mb-4">
            {t('detail.dialog.cashDescription')}
          </p>
        )}

        <BeneficiaryEditForm
          payment={payment}
          isSubmitting={isBusy}
          onSubmit={handleSave}
          onValidationError={(key) => toast.error(t(key))}
          renderActions={({ submit }) => (
            <div className="fixed inset-x-0 bottom-0 bg-background border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-10">
              <div className="flex gap-3 max-w-screen-md mx-auto">
                <button
                  type="button"
                  onClick={goBackToPayment}
                  disabled={isBusy}
                  className="flex-1 h-12 rounded-xl border border-border font-medium text-sm disabled:opacity-50"
                >
                  {t('detail.dialog.close')}
                </button>
                {payment.method !== 'cash' && (
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
                    {t('detail.dialog.save')}
                  </button>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </MobileLayout>
  );
}
