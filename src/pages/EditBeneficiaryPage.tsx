// ============================================================
// PAGE — Edit Beneficiary (client side). Refonte « Direction A » (designKit) :
// canvas, en-tête unique, barre d'actions en bas (SoftPill/PrimaryPill).
// <BeneficiaryEditForm> partagé conservé. Logique 100% PRÉSERVÉE :
// toStoredPath (jamais d'URL signée en base), upload QR, save carnet opt-in
// non-bloquant, transitions de statut via la RPC.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toStoredPath } from '@/lib/signedUrls';
import { toast } from 'sonner';
import {
  usePaymentDetail,
  useUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import { useCreateBeneficiary } from '@/hooks/useBeneficiaries';
import type { BeneficiaryMode, IdentifierType } from '@/lib/beneficiaries/spec';
import { isBeneficiaryComplete } from '@/lib/beneficiaries/spec';
import {
  BeneficiaryEditForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryEditForm';
import { SURFACE, TEXT, PrimaryPill, SoftPill } from '@/mobile/designKit';

export default function EditBeneficiaryPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('payments');
  const { t: tc } = useTranslation('client');

  const { data: payment, isLoading } = usePaymentDetail(paymentId);
  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();
  const createBeneficiary = useCreateBeneficiary();
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  // Lot 5: offer to also persist this completed beneficiary to the carnet.
  const [alsoSave, setAlsoSave] = useState(false);

  const goBackToPayment = () => {
    if (paymentId) navigate(`/payments/${paymentId}`);
    else navigate('/payments');
  };

  const handleSave = async (values: BeneficiaryFormValues, qrFile: File | null) => {
    if (!payment || !paymentId) return;

    try {
      // Normalize to the durable "<bucket>/<path>" form: never persist the
      // temporary signed URL that the detail hook injected for display.
      let qrUrl: string | null = toStoredPath(values.beneficiary_qr_code_url);

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

      // Lot 5: optionally also save to the client's carnet for reuse.
      // Only when checked, the payment isn't already linked, and the data
      // is complete for its mode (mirror of the DB CHECK). Non-blocking:
      // a carnet failure must not undo the payment-snapshot save.
      if (alsoSave && !payment.beneficiary_id && payment.method !== 'cash') {
        const mode = payment.method as BeneficiaryMode;
        const carnetInput = {
          payment_method: mode,
          alias: values.beneficiary_name || '',
          name: values.beneficiary_name || '',
          identifier: values.beneficiary_identifier || undefined,
          identifier_type:
            (payment.method === 'alipay' || payment.method === 'wechat') && values.beneficiary_identifier
              ? ('id' as IdentifierType)
              : undefined,
          phone: values.beneficiary_phone || undefined,
          email: values.beneficiary_email || undefined,
          bank_name: values.beneficiary_bank_name || undefined,
          bank_account: values.beneficiary_bank_account || undefined,
          bank_extra: values.beneficiary_bank_extra || undefined,
        };
        const completeForCarnet = isBeneficiaryComplete({
          ...carnetInput,
          qr_code_url: qrUrl || undefined,
        });
        if (completeForCarnet) {
          try {
            await createBeneficiary.mutateAsync({ ...carnetInput, qr_code_file: qrFile ?? undefined });
          } catch {
            // Hook toasts the cause; the payment beneficiary is already saved.
          }
        }
      }

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
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
          <PageHeader title={t('detail.dialog.editTitle')} showBack onBack={goBackToPayment} />
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('h-12 w-full animate-pulse rounded-2xl', SURFACE.card, SURFACE.shadow)} />
            ))}
            <div className={cn('h-32 w-full animate-pulse rounded-2xl', SURFACE.card, SURFACE.shadow)} />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!payment) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center', SURFACE.canvas)}>
          <p className={cn('text-[15px]', TEXT.muted)}>{t('detail.notFound')}</p>
          <PrimaryPill onClick={() => navigate('/payments')} className="mt-5">
            {t('detail.backToPayments')}
          </PrimaryPill>
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

  const leadIn: Record<string, string> = {
    alipay: t('detail.dialog.alipayDescription'),
    wechat: t('detail.dialog.wechatDescription'),
    bank_transfer: t('detail.dialog.bankTransferDescription'),
    cash: t('detail.dialog.cashDescription'),
  };

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        <PageHeader title={headerTitle} showBack onBack={goBackToPayment} />

        <div className="px-4 py-4 pb-36">
          {leadIn[payment.method] && (
            <p className={cn('mb-4 text-[14px]', TEXT.muted)}>{leadIn[payment.method]}</p>
          )}

          <BeneficiaryEditForm
            payment={payment}
            isSubmitting={isBusy}
            onSubmit={handleSave}
            onValidationError={(key) => toast.error(t(key))}
            renderActions={({ submit }) => (
              <div
                className={cn(
                  'fixed inset-x-0 bottom-0 z-10 border-t border-black/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/[0.08]',
                  SURFACE.card,
                )}
              >
                {payment.method !== 'cash' && !payment.beneficiary_id && (
                  <label className={cn('mx-auto mb-3 flex max-w-screen-md cursor-pointer items-center gap-2 text-[13px]', TEXT.muted)}>
                    <input
                      type="checkbox"
                      checked={alsoSave}
                      onChange={(e) => setAlsoSave(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    {tc('beneficiaries.saveToCarnet', { defaultValue: 'Enregistrer aussi dans mon carnet' })}
                  </label>
                )}
                <div className="mx-auto flex max-w-screen-md gap-3">
                  <SoftPill onClick={goBackToPayment} disabled={isBusy} className="flex-1 py-[15px] text-[15px]">
                    {t('detail.dialog.close')}
                  </SoftPill>
                  {payment.method !== 'cash' && (
                    <PrimaryPill onClick={submit} loading={isBusy} className="flex-1 py-[15px] text-[15px]">
                      <CheckCircle className="h-5 w-5" />
                      {t('detail.dialog.save')}
                    </PrimaryPill>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </MobileLayout>
  );
}
