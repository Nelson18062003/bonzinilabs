// ============================================================
// Beneficiary edit dialog. Self-contained: owns its own form state
// + QR upload + validation + save mutation. The page only opens
// and closes it.
//
// This component will be replaced in Batch 6 by the shared
// <BeneficiaryEditForm/> used by both client and admin. For now we
// keep the existing dialog UX intact.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload, QrCode, User, Phone, Mail, FileText, Building2, CreditCard, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmailField, PhoneField, TextArea, TextField } from '@/components/form';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import { useUpdateBeneficiaryInfo } from '@/hooks/usePayments';
import type { Payment } from '@/hooks/usePayments';

interface BeneficiaryFormState {
  beneficiary_name: string;
  beneficiary_phone: string;
  beneficiary_email: string;
  beneficiary_qr_code_url: string;
  beneficiary_bank_name: string;
  beneficiary_bank_account: string;
  beneficiary_notes: string;
}

function emptyForm(): BeneficiaryFormState {
  return {
    beneficiary_name: '',
    beneficiary_phone: '',
    beneficiary_email: '',
    beneficiary_qr_code_url: '',
    beneficiary_bank_name: '',
    beneficiary_bank_account: '',
    beneficiary_notes: '',
  };
}

interface Props {
  payment: Payment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasBeneficiaryInfo: boolean;
}

export function PaymentBeneficiaryEditDialog({ payment, open, onOpenChange, hasBeneficiaryInfo }: Props) {
  const { t } = useTranslation('payments');
  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();

  const [form, setForm] = useState<BeneficiaryFormState>(emptyForm);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill form when the dialog opens / payment changes.
  useEffect(() => {
    setForm({
      beneficiary_name: payment.beneficiary_name || '',
      beneficiary_phone: payment.beneficiary_phone || '',
      beneficiary_email: payment.beneficiary_email || '',
      beneficiary_qr_code_url: payment.beneficiary_qr_code_url || '',
      beneficiary_bank_name: payment.beneficiary_bank_name || '',
      beneficiary_bank_account: payment.beneficiary_bank_account || '',
      beneficiary_notes: payment.beneficiary_notes || '',
    });
    setQrFile(null);
    setQrPreview(null);
  }, [payment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): { valid: boolean; message?: string } => {
    if (payment.method === 'alipay' || payment.method === 'wechat') {
      const hasQr = qrFile || form.beneficiary_qr_code_url;
      const hasPhone = form.beneficiary_phone.trim();
      const hasEmail = form.beneficiary_email.trim();
      if (!hasQr && !hasPhone && !hasEmail) {
        return { valid: false, message: t('detail.validation.atLeastOneContact') };
      }
      return { valid: true };
    }

    if (payment.method === 'bank_transfer') {
      if (!form.beneficiary_name.trim()) {
        return { valid: false, message: t('detail.validation.nameRequired') };
      }
      if (!form.beneficiary_bank_name.trim()) {
        return { valid: false, message: t('detail.validation.bankNameRequired') };
      }
      if (!form.beneficiary_bank_account.trim()) {
        return { valid: false, message: t('detail.validation.bankAccountRequired') };
      }
      return { valid: true };
    }

    return { valid: true };
  };

  const handleSave = async () => {
    const validation = validate();
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    try {
      let qrUrl = form.beneficiary_qr_code_url;

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
          beneficiary_name: form.beneficiary_name || null,
          beneficiary_phone: form.beneficiary_phone || null,
          beneficiary_email: form.beneficiary_email || null,
          beneficiary_qr_code_url: qrUrl || null,
          beneficiary_bank_name: form.beneficiary_bank_name || null,
          beneficiary_bank_account: form.beneficiary_bank_account || null,
          beneficiary_notes: form.beneficiary_notes || null,
        },
        paymentMethod: payment.method,
      });

      onOpenChange(false);
      setQrFile(null);
      setQrPreview(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hasBeneficiaryInfo ? t('detail.dialog.editTitle') : t('detail.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {payment.method === 'alipay' && t('detail.dialog.alipayDescription')}
            {payment.method === 'wechat' && t('detail.dialog.wechatDescription')}
            {payment.method === 'bank_transfer' && t('detail.dialog.bankTransferDescription')}
            {payment.method === 'cash' && t('detail.dialog.cashDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Alipay / WeChat fields */}
          {(payment.method === 'alipay' || payment.method === 'wechat') && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">{t('detail.form.provideAtLeastOne')}</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  QR Code {payment.method === 'alipay' ? 'Alipay' : 'WeChat'}
                </Label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => qrInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') qrInputRef.current?.click();
                  }}
                  className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {qrPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={qrPreview} alt={t('detail.form.qrPreview')} className="w-32 h-32 rounded-lg border object-cover" />
                      <span className="text-xs text-muted-foreground">{t('detail.form.clickToReplace')}</span>
                    </div>
                  ) : form.beneficiary_qr_code_url ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={form.beneficiary_qr_code_url} alt={t('detail.form.qrBeneficiary')} className="w-32 h-32 rounded-lg border object-cover" loading="lazy" />
                      <span className="text-xs text-muted-foreground">{t('detail.form.clickToReplace')}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">{t('detail.form.addQrCode')}</p>
                      <p className="text-xs text-muted-foreground">{t('detail.form.ofBeneficiary')}</p>
                    </>
                  )}
                </div>
                <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrFileChange} />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('detail.form.or')}</span>
                </div>
              </div>

              <PhoneField
                label={
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t('detail.form.phoneNumber')}
                  </span>
                }
                dialCode="+86"
                value={form.beneficiary_phone}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_phone: e.target.value }))}
                placeholder="138 0000 0000"
              />

              <EmailField
                label={
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('detail.form.emailOptional')}
                  </span>
                }
                showIcon={false}
                value={form.beneficiary_email}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_email: e.target.value }))}
              />

              <TextField
                label={
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('detail.form.beneficiaryNameOptional')}
                  </span>
                }
                variant="name"
                autoComplete="name"
                value={form.beneficiary_name}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_name: e.target.value }))}
                placeholder={t('detail.form.fullName')}
              />
            </div>
          )}

          {/* Bank transfer fields */}
          {payment.method === 'bank_transfer' && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">{t('detail.form.provideBankInfo')}</p>
              </div>

              <TextField
                label={
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('detail.form.beneficiaryNameRequired')}
                  </span>
                }
                variant="name"
                autoComplete="name"
                value={form.beneficiary_name}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_name: e.target.value }))}
                placeholder={t('detail.form.accountHolderName')}
                required
              />
              <TextField
                label={
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {t('detail.form.bankNameRequired')}
                  </span>
                }
                autoComplete="organization"
                value={form.beneficiary_bank_name}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_bank_name: e.target.value }))}
                placeholder="Ex: Bank of China, ICBC..."
                required
              />
              <TextField
                label={
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {t('detail.form.accountNumberRequired')}
                  </span>
                }
                variant="numeric"
                autoComplete="off"
                value={form.beneficiary_bank_account}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_bank_account: e.target.value }))}
                placeholder={t('detail.form.bankAccountNumber')}
                required
              />
              <TextArea
                label={
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('detail.form.commentOptional')}
                  </span>
                }
                value={form.beneficiary_notes}
                onChange={(e) => setForm((p) => ({ ...p, beneficiary_notes: e.target.value }))}
                placeholder={t('detail.form.additionalInstructions')}
                rows={3}
              />
            </div>
          )}

          {/* Cash method — no inputs */}
          {payment.method === 'cash' && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium">{t('detail.form.noInfoRequired')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('detail.form.cashQrAutoGenerated')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {(payment.method === 'alipay' || payment.method === 'wechat') && (
            <Button variant="outline" onClick={handleCompleteLater} className="w-full sm:w-auto">
              {t('detail.dialog.completeLater')}
            </Button>
          )}
          {payment.method !== 'cash' && (
            <Button
              onClick={handleSave}
              disabled={updateBeneficiaryInfo.isPending || isUploadingQr}
              className="w-full sm:w-auto"
            >
              {(updateBeneficiaryInfo.isPending || isUploadingQr) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {t('detail.dialog.save')}
            </Button>
          )}
          {payment.method === 'cash' && (
            <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {t('detail.dialog.close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
