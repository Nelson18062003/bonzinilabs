// ============================================================
// Beneficiary edit dialog (client side).
// Thin wrapper around the shared <BeneficiaryEditForm>: it handles
// the Dialog chrome, the QR storage upload, and the
// useUpdateBeneficiaryInfo mutation. Form rendering / state /
// validation are owned by BeneficiaryEditForm.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import { useUpdateBeneficiaryInfo, type Payment } from '@/hooks/usePayments';
import {
  BeneficiaryEditForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryEditForm';

interface Props {
  payment: Payment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasBeneficiaryInfo: boolean;
}

export function PaymentBeneficiaryEditDialog({
  payment,
  open,
  onOpenChange,
  hasBeneficiaryInfo,
}: Props) {
  const { t } = useTranslation('payments');
  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const dialogDescription = (() => {
    switch (payment.method) {
      case 'alipay':
        return t('detail.dialog.alipayDescription');
      case 'wechat':
        return t('detail.dialog.wechatDescription');
      case 'bank_transfer':
        return t('detail.dialog.bankTransferDescription');
      case 'cash':
        return t('detail.dialog.cashDescription');
    }
  })();

  const handleSave = async (values: BeneficiaryFormValues, qrFile: File | null) => {
    try {
      let qrUrl: string | null = values.beneficiary_qr_code_url || null;

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${payment.id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      await updateBeneficiaryInfo.mutateAsync({
        paymentId: payment.id,
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

      onOpenChange(false);
      toast.success(t('detail.toast.beneficiarySaved'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('detail.toast.saveFailed');
      toast.error(message);
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleCompleteLater = () => {
    onOpenChange(false);
    toast.info(t('detail.toast.completeLater'));
  };

  const isBusy = updateBeneficiaryInfo.isPending || isUploadingQr;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hasBeneficiaryInfo ? t('detail.dialog.editTitle') : t('detail.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <BeneficiaryEditForm
            payment={payment}
            isSubmitting={isBusy}
            onSubmit={handleSave}
            onValidationError={(key) => toast.error(t(key))}
            renderActions={({ submit }) => (
              <DialogFooter className="flex-col gap-2 sm:flex-row pt-2">
                {(payment.method === 'alipay' || payment.method === 'wechat') && (
                  <Button
                    variant="outline"
                    onClick={handleCompleteLater}
                    className="w-full sm:w-auto"
                  >
                    {t('detail.dialog.completeLater')}
                  </Button>
                )}
                {payment.method !== 'cash' && (
                  <Button
                    onClick={submit}
                    disabled={isBusy}
                    className="w-full sm:w-auto"
                  >
                    {isBusy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {t('detail.dialog.save')}
                  </Button>
                )}
                {payment.method === 'cash' && (
                  <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                    {t('detail.dialog.close')}
                  </Button>
                )}
              </DialogFooter>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
