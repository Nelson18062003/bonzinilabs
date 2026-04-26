// ============================================================
// Step 3 — Beneficiary.
// Two tabs: "saved" (pick from useBeneficiaries) or "new"
// (method-specific form: cash / alipay-wechat / bank).
// The "saved" path also exposes a "complete later" escape.
// ============================================================
import { useTranslation } from 'react-i18next';
import {
  Check,
  CreditCard,
  Mail,
  Phone,
  QrCode,
  Upload,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Beneficiary } from '@/hooks/useBeneficiaries';
import type { useMyProfile } from '@/hooks/useProfile';
import {
  type IdentificationType,
  type NewBeneficiaryDraft,
  type NewBeneficiaryDraftSetters,
  type PaymentMethodType,
} from './types';

type Profile = NonNullable<ReturnType<typeof useMyProfile>['data']>;

interface Props {
  selectedMethod: PaymentMethodType;
  profile: Profile | undefined;
  existingBeneficiaries: Beneficiary[] | undefined;
  beneficiaryTab: 'existing' | 'new';
  onBeneficiaryTabChange: (tab: 'existing' | 'new') => void;
  selectedBeneficiary: Beneficiary | null;
  onSelectedBeneficiaryChange: (b: Beneficiary | null) => void;
  cashBenefType: 'self' | 'other';
  onCashBenefTypeChange: (t: 'self' | 'other') => void;
  draft: NewBeneficiaryDraft;
  setters: NewBeneficiaryDraftSetters;
  qrCodePreview: string | null;
  onQrFileSelect: (file: File) => void;
  onQrFileRemove: () => void;
  onSkip: () => void;
}

export function NewPaymentBeneficiaryStep({
  selectedMethod,
  profile,
  existingBeneficiaries,
  beneficiaryTab,
  onBeneficiaryTabChange,
  selectedBeneficiary,
  onSelectedBeneficiaryChange,
  cashBenefType,
  onCashBenefTypeChange,
  draft,
  setters,
  qrCodePreview,
  onQrFileSelect,
  onQrFileRemove,
  onSkip,
}: Props) {
  const { t } = useTranslation('payments');

  const isCash = selectedMethod === 'cash';
  const isAlipayWechat = selectedMethod === 'alipay' || selectedMethod === 'wechat';
  const isBankTransfer = selectedMethod === 'bank_transfer';

  const handleQrInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onQrFileSelect(file);
  };

  const idTypeOptions: ReadonlyArray<{ key: IdentificationType; icon: typeof QrCode; label: string }> = [
    { key: 'qr', icon: QrCode, label: t('form.beneficiary.idTypes.qr') },
    { key: 'id', icon: CreditCard, label: t('form.beneficiary.idTypes.id') },
    { key: 'email', icon: Mail, label: t('form.beneficiary.idTypes.email') },
    { key: 'phone', icon: Phone, label: t('form.beneficiary.idTypes.phone') },
  ];

  const inputCls =
    'w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {isCash ? t('form.beneficiary.whoPicks') : t('form.beneficiary.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isCash ? t('form.beneficiary.mustPresentQr') : t('form.beneficiary.selectOrCreate')}
        </p>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => onBeneficiaryTabChange('existing')}
          className={cn(
            'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
            beneficiaryTab === 'existing'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          {t('form.beneficiary.existing')}
        </button>
        <button
          onClick={() => onBeneficiaryTabChange('new')}
          className={cn(
            'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
            beneficiaryTab === 'new'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          {t('form.beneficiary.new')}
        </button>
      </div>

      {beneficiaryTab === 'existing' ? (
        <div className="space-y-2">
          {!existingBeneficiaries || existingBeneficiaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('form.beneficiary.noneRegistered')}</p>
              <button
                onClick={() => onBeneficiaryTabChange('new')}
                className="mt-2 text-sm text-primary font-medium"
              >
                {t('form.beneficiary.createNew')}
              </button>
            </div>
          ) : (
            existingBeneficiaries.map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  onSelectedBeneficiaryChange(selectedBeneficiary?.id === b.id ? null : b)
                }
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  selectedBeneficiary?.id === b.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border',
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {b.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.identifier || b.phone || b.bank_account || b.email || ''}
                  </p>
                </div>
                {selectedBeneficiary?.id === b.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {isCash && (
            <>
              <div className="space-y-2">
                <button
                  onClick={() => onCashBenefTypeChange('self')}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                    cashBenefType === 'self'
                      ? 'border-[#dc2626] bg-red-50/50'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">{t('form.beneficiary.myself')}</p>
                    {profile && (
                      <p className="text-xs text-muted-foreground">
                        {profile.first_name} {profile.last_name}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => onCashBenefTypeChange('other')}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                    cashBenefType === 'other'
                      ? 'border-[#dc2626] bg-red-50/50'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{t('form.beneficiary.anotherPerson')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('form.beneficiary.provideDetails')}
                    </p>
                  </div>
                </button>
              </div>
              {cashBenefType === 'other' && (
                <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {t('form.beneficiary.fullNameRequired')}
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setters.setName(e.target.value)}
                      placeholder={t('form.beneficiaryName')}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {t('form.beneficiary.phoneRequired')}
                    </label>
                    <input
                      type="tel"
                      value={draft.phone}
                      onChange={(e) => setters.setPhone(e.target.value)}
                      placeholder="+86..."
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {t('form.beneficiary.emailOptional')}
                    </label>
                    <input
                      type="email"
                      value={draft.email}
                      onChange={(e) => setters.setEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {isAlipayWechat && (
            <>
              <div className="space-y-3">
                {qrCodePreview ? (
                  <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden">
                    <img src={qrCodePreview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={onQrFileRemove}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="block w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <input type="file" accept="image/*" onChange={handleQrInput} className="hidden" />
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t('form.beneficiary.addQrCode')}
                      </p>
                    </div>
                  </label>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('form.beneficiary.orProvideInfo')}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('form.beneficiaryName')}
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setters.setName(e.target.value)}
                  placeholder={t('form.beneficiary.fullName')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('form.beneficiary.idType')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {idTypeOptions.map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setters.setIdType(key)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors',
                        draft.idType === key ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {draft.idType !== 'qr' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {draft.idType === 'id'
                      ? t('form.beneficiaryId')
                      : draft.idType === 'email'
                        ? 'Email'
                        : t('form.beneficiary.phoneLabel')}
                  </label>
                  <input
                    type={draft.idType === 'email' ? 'email' : draft.idType === 'phone' ? 'tel' : 'text'}
                    value={draft.identifier}
                    onChange={(e) => setters.setIdentifier(e.target.value)}
                    placeholder={
                      draft.idType === 'id'
                        ? t('form.beneficiary.alipayWechatId')
                        : draft.idType === 'email'
                          ? 'email@exemple.com'
                          : '+86...'
                    }
                    className={inputCls}
                  />
                </div>
              )}
            </>
          )}

          {isBankTransfer && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('form.beneficiary.nameRequired')}
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setters.setName(e.target.value)}
                  placeholder={t('form.beneficiary.fullName')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('form.beneficiary.bankRequired')}
                </label>
                <input
                  type="text"
                  value={draft.bankName}
                  onChange={(e) => setters.setBankName(e.target.value)}
                  placeholder={t('form.beneficiary.bankName')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('form.beneficiary.accountRequired')}
                </label>
                <input
                  type="text"
                  value={draft.bankAccount}
                  onChange={(e) => setters.setBankAccount(e.target.value)}
                  placeholder={t('form.beneficiary.accountNumber')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('form.beneficiary.additionalInfo')}
                </label>
                <input
                  type="text"
                  value={draft.bankExtra}
                  onChange={(e) => setters.setBankExtra(e.target.value)}
                  placeholder={t('form.beneficiary.swiftAgency')}
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>
      )}

      {!isCash && (
        <button
          onClick={onSkip}
          className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
        >
          {t('form.beneficiary.addLater')}
        </button>
      )}
    </div>
  );
}
