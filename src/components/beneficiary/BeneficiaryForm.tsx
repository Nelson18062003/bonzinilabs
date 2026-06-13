// ============================================================
// BeneficiaryForm — reusable, mode-aware create/edit form.
//
// Used by the client carnet (BeneficiariesPage), the wizard "Nouveau"
// tab and the admin carnet (client detail). Alias-first; mode-specific
// fields mirror src/lib/beneficiaries/spec.ts; hard validation via the
// Zod schema, so the submit button stays disabled until the beneficiary
// is complete for its mode. Names/banks accept ANY script (CJK welcome).
//
// Refonte « Direction A » : contrôles alignés sur le standard de l'app
// (mêmes classes que la lib `form/` → parité avec l'écran d'édition),
// sélecteurs en chips designKit (anneau lilas), erreurs en rouge sémantique.
// Logique 100 % PRÉSERVÉE (validation, onChange, QR).
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, CreditCard, Mail, Phone, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BENEFICIARY_MODE_ORDER,
  type BeneficiaryMode,
  type IdentifierType,
  type RelationType,
  type BeneficiaryInput,
  validateBeneficiaryInput,
} from '@/lib/beneficiaries/spec';
import { modeIcon, modeLabel } from '@/lib/beneficiaries/labels';
import { SURFACE, TEXT } from '@/mobile/designKit';

export interface BeneficiaryFormValues {
  payment_method: BeneficiaryMode;
  alias: string;
  name: string;
  identifier: string;
  identifier_type: IdentifierType;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_extra: string;
  relation_type: RelationType;
  notes: string;
}

export function emptyBeneficiaryForm(mode: BeneficiaryMode): BeneficiaryFormValues {
  return {
    payment_method: mode,
    alias: '',
    name: '',
    identifier: '',
    identifier_type: 'id',
    phone: '',
    email: '',
    bank_name: '',
    bank_account: '',
    bank_extra: '',
    relation_type: 'supplier',
    notes: '',
  };
}

interface Props {
  values: BeneficiaryFormValues;
  onChange: (values: BeneficiaryFormValues) => void;
  /** When set, the mode picker is hidden (edit mode locks the mode). */
  lockMode?: boolean;
  /** When set, the relation picker is hidden (wizard already asks moi-même/autre). */
  hideRelation?: boolean;
  qrPreview?: string | null;
  onQrSelect?: (file: File) => void;
  onQrRemove?: () => void;
  /** Existing stored QR (edit mode) so we can show "has QR". */
  hasStoredQr?: boolean;
  /** Signed URL of the already-saved QR, so edit mode can PREVIEW it
   *  (instead of a generic placeholder icon). */
  storedQrUrl?: string | null;
}

// Contrôle de saisie — mêmes classes que la lib `form/` (parité visuelle app-wide).
const inputCls =
  'flex h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground';
// Chip sélectionnable (méthode / type d'identifiant / relation) — langage wizard.
const chip = (active: boolean) =>
  cn(
    'rounded-xl py-3 transition active:scale-[0.98]',
    SURFACE.card,
    SURFACE.shadow,
    active && 'ring-2 ring-[#8B5CF6]',
  );

/** Preview of the already-saved QR; falls back to a generic icon if the
 *  signed URL fails to load. */
function StoredQr({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center', SURFACE.holder)}>
        <QrCode className="h-10 w-10" />
      </div>
    );
  }
  return <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

export function BeneficiaryForm({
  values,
  onChange,
  lockMode,
  hideRelation,
  qrPreview,
  onQrSelect,
  onQrRemove,
  hasStoredQr,
  storedQrUrl,
}: Props) {
  const { t } = useTranslation('client');
  const [touched, setTouched] = useState(false);

  const mode = values.payment_method;
  const isAlipayWechat = mode === 'alipay' || mode === 'wechat';
  const isBank = mode === 'bank_transfer';
  const isCash = mode === 'cash';

  // Build the canonical input for validation (snake_case = spec).
  const errors = useMemo(() => {
    const input: BeneficiaryInput = {
      payment_method: mode,
      alias: values.alias,
      name: values.name,
      identifier: values.identifier,
      identifier_type: values.identifier_type,
      phone: values.phone,
      email: values.email,
      bank_name: values.bank_name,
      bank_account: values.bank_account,
      bank_extra: values.bank_extra,
      qr_code_url: qrPreview || hasStoredQr ? 'has-qr' : undefined,
      relation_type: values.relation_type,
      notes: values.notes,
    };
    return validateBeneficiaryInput(input);
  }, [values, mode, qrPreview, hasStoredQr]);

  const set = <K extends keyof BeneficiaryFormValues>(key: K, v: BeneficiaryFormValues[K]) =>
    onChange({ ...values, [key]: v });

  const handleQrInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onQrSelect) onQrSelect(file);
  };

  const fieldError = (field: keyof typeof errors) =>
    touched && errors[field] ? (
      <p className="mt-1 text-xs font-medium text-[#C0504D] dark:text-[#E79A9A]">
        {t(errors[field]!.replace('beneficiaries.', ''))}
      </p>
    ) : null;

  const idTypeOptions: ReadonlyArray<{ key: IdentifierType; icon: typeof QrCode }> = [
    { key: 'id', icon: CreditCard },
    { key: 'phone', icon: Phone },
    { key: 'email', icon: Mail },
  ];

  return (
    <div className="space-y-4" onBlur={() => setTouched(true)}>
      {/* Mode picker (hidden in edit mode) */}
      {!lockMode && (
        <div className="grid grid-cols-4 gap-2">
          {BENEFICIARY_MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('payment_method', m)}
              className={cn('flex flex-col items-center gap-1', chip(mode === m))}
            >
              <span className="font-serif text-lg">{modeIcon(m)}</span>
              <span className={cn('text-[11px] font-medium', TEXT.strong)}>{modeLabel(m)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Alias — the hero field, required for every mode */}
      <div>
        <label className={labelCls}>{t('beneficiaries.fields.alias')} *</label>
        <input
          type="text"
          value={values.alias}
          onChange={(e) => set('alias', e.target.value)}
          placeholder={t('beneficiaries.fields.aliasPlaceholder')}
          className={inputCls}
        />
        {fieldError('alias')}
      </div>

      {/* QR (alipay/wechat) */}
      {isAlipayWechat && onQrSelect && (
        <div>
          <label className={labelCls}>{t('beneficiaries.fields.qrCode')}</label>
          {qrPreview || storedQrUrl || hasStoredQr ? (
            <div className="relative h-32 w-32 overflow-hidden rounded-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08]">
              {qrPreview ? (
                <img src={qrPreview} alt="" className="h-full w-full object-cover" />
              ) : storedQrUrl ? (
                <StoredQr src={storedQrUrl} />
              ) : (
                <div className={cn('flex h-full w-full items-center justify-center', SURFACE.holder)}>
                  <QrCode className="h-10 w-10" />
                </div>
              )}
              {onQrRemove && (
                <button
                  type="button"
                  onClick={onQrRemove}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          ) : (
            <label
              className={cn(
                'block w-full cursor-pointer rounded-xl border-2 border-dashed border-[#C9C2F0] transition-colors hover:border-[#8B5CF6] dark:border-[#4A4660]',
                SURFACE.card,
              )}
            >
              <input type="file" accept="image/*" onChange={handleQrInput} className="hidden" />
              <div className="flex h-24 flex-col items-center justify-center gap-2">
                <Upload className={cn('h-6 w-6', TEXT.muted)} />
                <p className={cn('text-sm', TEXT.muted)}>{t('beneficiaries.fields.qrCode')}</p>
              </div>
            </label>
          )}
        </div>
      )}

      {/* Holder name (all modes) */}
      <div>
        <label className={labelCls}>{t('beneficiaries.fields.name')} *</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t('beneficiaries.fields.namePlaceholder')}
          className={inputCls}
        />
        {fieldError('name')}
      </div>

      {/* Alipay/WeChat: identifier type + value */}
      {isAlipayWechat && (
        <>
          <div>
            <label className={labelCls}>{t('beneficiaries.fields.identifierType')}</label>
            <div className="grid grid-cols-3 gap-2">
              {idTypeOptions.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('identifier_type', key)}
                  className={cn('flex flex-col items-center gap-1', chip(values.identifier_type === key))}
                >
                  <Icon className={cn('h-5 w-5', TEXT.strong)} />
                  <span className={cn('text-xs font-medium', TEXT.strong)}>
                    {t(`beneficiaries.fields.${key === 'id' ? 'identifier' : key === 'phone' ? 'phone' : 'email'}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('beneficiaries.fields.identifier')}</label>
            <input
              type={values.identifier_type === 'email' ? 'email' : values.identifier_type === 'phone' ? 'tel' : 'text'}
              value={values.identifier}
              onChange={(e) => set('identifier', e.target.value)}
              className={inputCls}
            />
            {fieldError('identifier')}
          </div>
        </>
      )}

      {/* Bank transfer fields */}
      {isBank && (
        <>
          <div>
            <label className={labelCls}>{t('beneficiaries.fields.bankName')} *</label>
            <input
              type="text"
              value={values.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
              className={inputCls}
            />
            {fieldError('bank_name')}
          </div>
          <div>
            <label className={labelCls}>{t('beneficiaries.fields.bankAccount')} *</label>
            <input
              type="text"
              inputMode="numeric"
              value={values.bank_account}
              onChange={(e) => set('bank_account', e.target.value)}
              className={inputCls}
            />
            {fieldError('bank_account')}
          </div>
          <div>
            <label className={labelCls}>{t('beneficiaries.fields.bankExtra')}</label>
            <input
              type="text"
              value={values.bank_extra}
              onChange={(e) => set('bank_extra', e.target.value)}
              className={inputCls}
            />
          </div>
        </>
      )}

      {/* Cash: phone required */}
      {isCash && (
        <div>
          <label className={labelCls}>{t('beneficiaries.fields.phone')} *</label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+86..."
            className={inputCls}
          />
          {fieldError('phone')}
        </div>
      )}

      {/* Email (optional) for alipay/wechat/cash */}
      {!isBank && (
        <div>
          <label className={labelCls}>{t('beneficiaries.fields.email')}</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="email@exemple.com"
            className={inputCls}
          />
        </div>
      )}

      {/* Relationship (hidden in the wizard, which already asks moi-même/autre) */}
      {!hideRelation && (
        <div>
          <label className={labelCls}>{t('beneficiaries.fields.relationType')}</label>
          <div className="grid grid-cols-3 gap-2">
            {(['self', 'supplier', 'other'] as RelationType[]).map((rel) => (
              <button
                key={rel}
                type="button"
                onClick={() => set('relation_type', rel)}
                className={cn('text-sm font-medium', chip(values.relation_type === rel), TEXT.strong)}
              >
                {t(`beneficiaries.relations.${rel}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className={labelCls}>{t('beneficiaries.fields.notes')}</label>
        <textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className={cn(inputCls, 'h-auto resize-none py-2.5')}
        />
      </div>
    </div>
  );
}

/** True when the form is complete for its mode (mirrors DB CHECK). */
export function isBeneficiaryFormValid(
  values: BeneficiaryFormValues,
  opts?: { hasQr?: boolean },
): boolean {
  const input: BeneficiaryInput = {
    payment_method: values.payment_method,
    alias: values.alias,
    name: values.name,
    identifier: values.identifier,
    identifier_type: values.identifier_type,
    phone: values.phone,
    email: values.email,
    bank_name: values.bank_name,
    bank_account: values.bank_account,
    bank_extra: values.bank_extra,
    qr_code_url: opts?.hasQr ? 'has-qr' : undefined,
    relation_type: values.relation_type,
    notes: values.notes,
  };
  return Object.keys(validateBeneficiaryInput(input)).length === 0;
}
