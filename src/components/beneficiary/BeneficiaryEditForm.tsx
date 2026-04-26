// ============================================================
// Shared beneficiary edit form.
// Single source of truth for the edit-after-creation flow used by:
//   - The client (EditBeneficiaryPage, full-page route)
//   - The admin  (MobileBeneficiaryEdit, in a full-page layout)
//
// The component owns its internal state (9 fields + QR file/preview),
// validates per method, and emits onSubmit. Parents render the
// surrounding chrome (Dialog header / page header / sticky footer)
// via the `renderActions` render prop so layout decisions stay at
// the call site.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Phone,
  QrCode,
  Upload,
  User,
} from 'lucide-react';
import { EmailField, PhoneField, TextArea, TextField } from '@/components/form';
import { Label } from '@/components/ui/label';
import type { Payment } from '@/hooks/usePayments';

export type PaymentMethod = Payment['method'];

export interface BeneficiaryFormValues {
  beneficiary_name: string;
  beneficiary_phone: string;
  beneficiary_email: string;
  beneficiary_qr_code_url: string;
  beneficiary_bank_name: string;
  beneficiary_bank_account: string;
  beneficiary_bank_extra: string;
  beneficiary_notes: string;
  beneficiary_identifier: string;
}

export function emptyBeneficiaryValues(): BeneficiaryFormValues {
  return {
    beneficiary_name: '',
    beneficiary_phone: '',
    beneficiary_email: '',
    beneficiary_qr_code_url: '',
    beneficiary_bank_name: '',
    beneficiary_bank_account: '',
    beneficiary_bank_extra: '',
    beneficiary_notes: '',
    beneficiary_identifier: '',
  };
}

export function valuesFromPayment(payment: Payment): BeneficiaryFormValues {
  return {
    beneficiary_name: payment.beneficiary_name ?? '',
    beneficiary_phone: payment.beneficiary_phone ?? '',
    beneficiary_email: payment.beneficiary_email ?? '',
    beneficiary_qr_code_url: payment.beneficiary_qr_code_url ?? '',
    beneficiary_bank_name: payment.beneficiary_bank_name ?? '',
    beneficiary_bank_account: payment.beneficiary_bank_account ?? '',
    beneficiary_bank_extra: payment.beneficiary_bank_extra ?? '',
    beneficiary_notes: payment.beneficiary_notes ?? '',
    beneficiary_identifier: payment.beneficiary_identifier ?? '',
  };
}

/**
 * Validate the form for the given method. Returns null when valid,
 * an i18n key otherwise so the caller can toast a translated message.
 */
function validate(
  method: PaymentMethod,
  values: BeneficiaryFormValues,
  qrFile: File | null,
): string | null {
  if (method === 'alipay' || method === 'wechat') {
    const hasAnyChannel =
      qrFile ||
      values.beneficiary_qr_code_url ||
      values.beneficiary_phone.trim() ||
      values.beneficiary_email.trim() ||
      values.beneficiary_identifier.trim();
    if (!hasAnyChannel) return 'detail.validation.atLeastOneContact';
    return null;
  }

  if (method === 'bank_transfer') {
    if (!values.beneficiary_name.trim()) return 'detail.validation.nameRequired';
    if (!values.beneficiary_bank_name.trim()) return 'detail.validation.bankNameRequired';
    if (!values.beneficiary_bank_account.trim()) return 'detail.validation.bankAccountRequired';
    return null;
  }

  return null;
}

interface RenderActionsArgs {
  submit: () => void;
  isSubmitting: boolean;
  values: BeneficiaryFormValues;
}

interface Props {
  payment: Payment;
  initialValues?: BeneficiaryFormValues;
  isSubmitting?: boolean;
  /**
   * Called when the primary action runs after passing validation.
   * Receives the current values + an optional newly-selected QR file.
   * The caller is responsible for uploading the QR and persisting the
   * resulting URL alongside the other values.
   */
  onSubmit: (values: BeneficiaryFormValues, qrFile: File | null) => Promise<void> | void;
  /**
   * Called with a translation key when validation blocks submission.
   * Default behaviour is no-op; the caller should `toast.error(t(key))`.
   */
  onValidationError?: (i18nKey: string) => void;
  /**
   * Render prop for the action area. Receives `submit`, `isSubmitting`
   * and the current values so the caller can compose its own buttons
   * inside a Dialog footer or a sticky page footer.
   */
  renderActions: (args: RenderActionsArgs) => React.ReactNode;
}

export function BeneficiaryEditForm({
  payment,
  initialValues,
  isSubmitting = false,
  onSubmit,
  onValidationError,
  renderActions,
}: Props) {
  const { t } = useTranslation('payments');

  const [values, setValues] = useState<BeneficiaryFormValues>(
    initialValues ?? valuesFromPayment(payment),
  );
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Re-seed when the underlying payment changes (e.g. dialog re-open).
  useEffect(() => {
    setValues(initialValues ?? valuesFromPayment(payment));
    setQrFile(null);
    setQrPreview(null);
    // initialValues is intentionally not in the dep list — callers may
    // pass a fresh object on every render and we only want to seed
    // when the payment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);

  const updateField = <K extends keyof BeneficiaryFormValues>(
    key: K,
    value: BeneficiaryFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const error = validate(payment.method, values, qrFile);
    if (error) {
      onValidationError?.(error);
      return;
    }
    void onSubmit(values, qrFile);
  };

  return (
    <div className="space-y-4">
      {/* Alipay / WeChat */}
      {(payment.method === 'alipay' || payment.method === 'wechat') && (
        <>
          <div className="bg-muted/50 rounded-lg p-3">
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
                  <img
                    src={qrPreview}
                    alt={t('detail.form.qrPreview')}
                    className="w-32 h-32 rounded-lg border object-cover"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t('detail.form.clickToReplace')}
                  </span>
                </div>
              ) : values.beneficiary_qr_code_url ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={values.beneficiary_qr_code_url}
                    alt={t('detail.form.qrBeneficiary')}
                    className="w-32 h-32 rounded-lg border object-cover"
                    loading="lazy"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t('detail.form.clickToReplace')}
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">{t('detail.form.addQrCode')}</p>
                  <p className="text-xs text-muted-foreground">{t('detail.form.ofBeneficiary')}</p>
                </>
              )}
            </div>
            <input
              ref={qrInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFileChange}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('detail.form.or')}
              </span>
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
            value={values.beneficiary_phone}
            onChange={(e) => updateField('beneficiary_phone', e.target.value)}
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
            value={values.beneficiary_email}
            onChange={(e) => updateField('beneficiary_email', e.target.value)}
          />

          <TextField
            label={
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                {payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
              </span>
            }
            autoComplete="off"
            value={values.beneficiary_identifier}
            onChange={(e) => updateField('beneficiary_identifier', e.target.value)}
            placeholder={t('form.beneficiary.alipayWechatId')}
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
            value={values.beneficiary_name}
            onChange={(e) => updateField('beneficiary_name', e.target.value)}
            placeholder={t('detail.form.fullName')}
          />
        </>
      )}

      {/* Bank transfer */}
      {payment.method === 'bank_transfer' && (
        <>
          <div className="bg-muted/50 rounded-lg p-3">
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
            value={values.beneficiary_name}
            onChange={(e) => updateField('beneficiary_name', e.target.value)}
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
            value={values.beneficiary_bank_name}
            onChange={(e) => updateField('beneficiary_bank_name', e.target.value)}
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
            value={values.beneficiary_bank_account}
            onChange={(e) => updateField('beneficiary_bank_account', e.target.value)}
            placeholder={t('detail.form.bankAccountNumber')}
            required
          />
          <TextField
            label={t('form.beneficiary.swiftAgency')}
            autoComplete="off"
            value={values.beneficiary_bank_extra}
            onChange={(e) => updateField('beneficiary_bank_extra', e.target.value)}
            placeholder="SWIFT / IBAN / agence"
          />
          <TextArea
            label={
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('detail.form.commentOptional')}
              </span>
            }
            value={values.beneficiary_notes}
            onChange={(e) => updateField('beneficiary_notes', e.target.value)}
            placeholder={t('detail.form.additionalInstructions')}
            rows={3}
          />
        </>
      )}

      {/* Cash — no inputs */}
      {payment.method === 'cash' && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-medium">{t('detail.form.noInfoRequired')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('detail.form.cashQrAutoGenerated')}
          </p>
        </div>
      )}

      {/* Spinner inline so callers don't have to wire it themselves */}
      {isSubmitting && (
        <div className="flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        </div>
      )}

      {renderActions({ submit, isSubmitting, values })}
    </div>
  );
}
