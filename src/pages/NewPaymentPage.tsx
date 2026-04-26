// ============================================================
// PAGE — NewPaymentPage (4-step wizard)
// Orchestrator only. Each step lives in
//   src/components/payment-form/NewPayment*Step.tsx
// Pure rate logic lives in
//   src/components/payment-form/paymentRateLogic.ts
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StepProgressBar } from '@/components/payment-form/StepProgressBar';
import { SuccessScreen } from '@/components/payment-form/SuccessScreen';
import { NewPaymentMethodStep } from '@/components/payment-form/NewPaymentMethodStep';
import { NewPaymentAmountStep } from '@/components/payment-form/NewPaymentAmountStep';
import { NewPaymentBeneficiaryStep } from '@/components/payment-form/NewPaymentBeneficiaryStep';
import { NewPaymentConfirmStep } from '@/components/payment-form/NewPaymentConfirmStep';
import {
  STEP_KEYS,
  type Currency,
  type IdentificationType,
  type NewBeneficiaryDraft,
  type PaymentMethodType,
  type Step,
} from '@/components/payment-form/types';
import {
  clientCountryToRateKey,
  computePaymentValues,
} from '@/components/payment-form/paymentRateLogic';
import {
  makeAmountStepSchema,
  methodStepSchema,
  validateBeneficiaryStep,
} from '@/components/payment-form/paymentSchemas';
import { useMyWallet } from '@/hooks/useWallet';
import { useClientRates } from '@/hooks/useDailyRates';
import { useMyProfile } from '@/hooks/useProfile';
import { useCreatePayment } from '@/hooks/usePayments';
import {
  useBeneficiaries,
  useCreateBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NewPaymentPage = () => {
  const { t } = useTranslation('payments');
  const navigate = useNavigate();

  // ── Data hooks ─────────────────────────────────────────────
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: clientRatesData } = useClientRates();
  const { data: profile } = useMyProfile();
  const createPayment = useCreatePayment();
  const createBeneficiary = useCreateBeneficiary();

  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('method');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);

  // step 1
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);

  // step 2
  const [currency, setCurrency] = useState<Currency>('XAF');
  const [inputAmount, setInputAmount] = useState('');

  // step 3
  const [beneficiaryTab, setBeneficiaryTab] = useState<'existing' | 'new'>('existing');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [skipBeneficiary, setSkipBeneficiary] = useState(false);
  const [cashBenefType, setCashBenefType] = useState<'self' | 'other'>('self');
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftIdType, setDraftIdType] = useState<IdentificationType>('qr');
  const [draftIdentifier, setDraftIdentifier] = useState('');
  const [draftBankName, setDraftBankName] = useState('');
  const [draftBankAccount, setDraftBankAccount] = useState('');
  const [draftBankExtra, setDraftBankExtra] = useState('');
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);

  const draft: NewBeneficiaryDraft = {
    name: draftName,
    phone: draftPhone,
    email: draftEmail,
    idType: draftIdType,
    identifier: draftIdentifier,
    bankName: draftBankName,
    bankAccount: draftBankAccount,
    bankExtra: draftBankExtra,
  };

  const { data: existingBeneficiaries } = useBeneficiaries(selectedMethod || undefined);

  // ── Computed values (pure) ─────────────────────────────────
  const clientCountryKey = useMemo(
    () => clientCountryToRateKey(profile?.country),
    [profile?.country],
  );

  const computed = useMemo(
    () =>
      computePaymentValues({
        inputAmount,
        currency,
        selectedMethod,
        walletBalanceXaf: wallet?.balance_xaf ?? 0,
        clientRatesData,
        clientCountryKey,
      }),
    [inputAmount, currency, selectedMethod, wallet?.balance_xaf, clientRatesData, clientCountryKey],
  );

  // ── QR file lifecycle ──────────────────────────────────────
  const handleQrFileSelect = (file: File) => {
    if (qrCodePreview) URL.revokeObjectURL(qrCodePreview);
    setQrCodeFile(file);
    setQrCodePreview(URL.createObjectURL(file));
  };

  const handleQrFileRemove = () => {
    if (qrCodePreview) URL.revokeObjectURL(qrCodePreview);
    setQrCodeFile(null);
    setQrCodePreview(null);
  };

  // ── Submit ─────────────────────────────────────────────────
  const buildBeneficiarySnapshot = (): Record<string, unknown> | undefined => {
    if (skipBeneficiary) return undefined;
    if (selectedBeneficiary) {
      return {
        id: selectedBeneficiary.id,
        name: selectedBeneficiary.name,
        payment_method: selectedBeneficiary.payment_method,
        identifier: selectedBeneficiary.identifier,
        identifier_type: selectedBeneficiary.identifier_type,
        phone: selectedBeneficiary.phone,
        email: selectedBeneficiary.email,
        bank_name: selectedBeneficiary.bank_name,
        bank_account: selectedBeneficiary.bank_account,
      };
    }
    if (selectedMethod === 'cash') {
      return {
        type: cashBenefType,
        name:
          cashBenefType === 'self'
            ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
            : draftName,
        phone: cashBenefType === 'self' ? profile?.phone : draftPhone,
      };
    }
    if (selectedMethod === 'alipay' || selectedMethod === 'wechat') {
      return {
        name: draftName,
        identifier: draftIdentifier,
        identifier_type: draftIdType,
        phone: draftPhone,
        email: draftEmail,
      };
    }
    if (selectedMethod === 'bank_transfer') {
      return {
        name: draftName,
        bank_name: draftBankName,
        bank_account: draftBankAccount,
        bank_extra: draftBankExtra,
      };
    }
    return undefined;
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !computed.isValidAmount || !computed.hasEnoughBalance) return;

    try {
      let beneficiaryId: string | undefined = selectedBeneficiary?.id;

      // 1. Upload QR if attached.
      let qrCodeUrl: string | undefined;
      if (qrCodeFile) {
        const compressed = await compressImage(qrCodeFile);
        const filePath = `qr-codes/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, compressed);
        if (uploadError) {
          toast.error(t('form.qrUploadError'));
          return;
        }
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      // 2. Save the new beneficiary master record (best-effort).
      if (!skipBeneficiary && !selectedBeneficiary && draftName) {
        try {
          const newBenef = await createBeneficiary.mutateAsync({
            payment_method: selectedMethod,
            name: draftName,
            identifier: draftIdentifier || undefined,
            identifier_type: draftIdType || undefined,
            phone: draftPhone || undefined,
            email: draftEmail || undefined,
            bank_name: draftBankName || undefined,
            bank_account: draftBankAccount || undefined,
            bank_extra: draftBankExtra || undefined,
            qr_code_file: qrCodeFile || undefined,
          });
          beneficiaryId = newBenef.id;
        } catch {
          /* keep going — payment creation is the priority */
        }
      }

      // 3. Build the snapshot fields and create the payment.
      const snapshot = buildBeneficiarySnapshot();
      const isCash = selectedMethod === 'cash';
      const legacyBenefName = isCash
        ? cashBenefType === 'self'
          ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
          : draftName
        : ((snapshot?.name as string) ?? undefined);

      const result = await createPayment.mutateAsync({
        amount_xaf: computed.amountXAF,
        amount_rmb: computed.amountRMB,
        exchange_rate: Math.round(computed.rate * 1_000_000),
        method: selectedMethod,
        beneficiary_name: legacyBenefName || undefined,
        beneficiary_phone: isCash
          ? cashBenefType === 'self'
            ? profile?.phone || undefined
            : draftPhone || undefined
          : ((snapshot?.phone as string) ?? undefined),
        beneficiary_email: (snapshot?.email as string) ?? undefined,
        beneficiary_qr_code_url: qrCodeUrl || undefined,
        beneficiary_bank_name: (snapshot?.bank_name as string) ?? undefined,
        beneficiary_bank_account: (snapshot?.bank_account as string) ?? undefined,
        beneficiary_bank_extra: (snapshot?.bank_extra as string) ?? undefined,
        beneficiary_identifier: (snapshot?.identifier as string) ?? undefined,
        beneficiary_identifier_type: snapshot?.identifier_type as IdentificationType | undefined,
        cash_beneficiary_type: isCash ? cashBenefType : undefined,
        cash_beneficiary_first_name: isCash
          ? cashBenefType === 'self'
            ? profile?.first_name
            : draftName.split(' ')[0]
          : undefined,
        cash_beneficiary_last_name: isCash
          ? cashBenefType === 'self'
            ? profile?.last_name
            : draftName.split(' ').slice(1).join(' ')
          : undefined,
        cash_beneficiary_phone: isCash
          ? cashBenefType === 'self'
            ? profile?.phone || undefined
            : draftPhone || undefined
          : undefined,
        beneficiary_id: beneficiaryId,
        beneficiary_details: snapshot,
        rate_is_custom: false,
      });

      if (result.payment_id) setCreatedPaymentId(result.payment_id);
      setShowSuccess(true);
    } catch {
      /* mutation errors already toast */
    }
  };

  // ── Success screen ─────────────────────────────────────────
  if (showSuccess) {
    return (
      <MobileLayout showNav={false}>
        <SuccessScreen
          variant="client"
          amountXAF={computed.amountXAF}
          amountRMB={computed.amountRMB}
          method={selectedMethod || 'cash'}
          onViewPayment={() =>
            navigate(createdPaymentId ? `/payments/${createdPaymentId}` : '/payments')
          }
          onNewPayment={() => navigate('/payments')}
          onGoBack={() => navigate('/wallet')}
        />
      </MobileLayout>
    );
  }

  // ── Step ↔ progress ────────────────────────────────────────
  const STEPS = STEP_KEYS.map((key) => ({ key, label: t(`form.steps.${key}`) }));
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Step validation (Zod-backed) ───────────────────────────
  // Each step has its own schema; the wizard footer disables the
  // "Continuer" CTA when the current step doesn't parse. The
  // beneficiary step exposes a soft error (informational only;
  // navigation is always allowed thanks to "compléter plus tard").
  const stepValidations = {
    method: methodStepSchema.safeParse({ selectedMethod }),
    amount: makeAmountStepSchema({
      walletBalanceXaf: wallet?.balance_xaf ?? 0,
    }).safeParse({ amountXAF: computed.amountXAF }),
    beneficiarySoftError: validateBeneficiaryStep({
      method: selectedMethod ?? 'cash',
      draft,
      hasQrFile: !!qrCodeFile,
      cashType: cashBenefType,
      hasSelectedBeneficiary: !!selectedBeneficiary,
    }),
  };

  // ── Footer button ──────────────────────────────────────────
  const footerCTA = (() => {
    switch (step) {
      case 'method':
        return {
          label: t('form.continue'),
          disabled: !stepValidations.method.success,
          onClick: () => setStep('amount'),
          isSubmit: false,
        };
      case 'amount':
        return {
          label: t('form.continue'),
          disabled: !stepValidations.amount.success,
          onClick: () => setStep('beneficiary'),
          isSubmit: false,
        };
      case 'beneficiary':
        return {
          // Validation is informational on this step — the user is
          // always allowed to skip via the "complete later" path.
          label: t('form.continue'),
          disabled: false,
          onClick: () => {
            setSkipBeneficiary(false);
            setStep('confirm');
          },
          isSubmit: false,
        };
      case 'confirm':
        return {
          label: createPayment.isPending ? t('form.submitting') : t('form.submit'),
          disabled: createPayment.isPending,
          onClick: handleSubmit,
          isSubmit: true,
        };
    }
  })();

  // ── Confirm-step derived data ──────────────────────────────
  const confirmSnapshot = step === 'confirm' ? buildBeneficiarySnapshot() : undefined;
  const hasBeneficiary =
    !skipBeneficiary &&
    !!(
      selectedBeneficiary ||
      draftName ||
      (selectedMethod === 'cash' && cashBenefType === 'self')
    );

  return (
    <MobileLayout showNav={false}>
      <PageHeader
        title={t('newPayment')}
        showBack
        onBack={() => {
          if (currentStepIndex > 0) setStep(STEPS[currentStepIndex - 1].key);
          else navigate('/payments');
        }}
      />

      <div className="px-4 py-2">
        <StepProgressBar steps={STEPS} currentStepIndex={currentStepIndex} />
      </div>

      <div className="px-4 py-4 flex-1">
        {step === 'method' && (
          <NewPaymentMethodStep
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
          />
        )}

        {step === 'amount' && (
          <NewPaymentAmountStep
            currency={currency}
            onCurrencyChange={setCurrency}
            inputAmount={inputAmount}
            onInputAmountChange={setInputAmount}
            rate={computed.rate}
            amountXAF={computed.amountXAF}
            amountRMB={computed.amountRMB}
            walletBalanceXaf={wallet?.balance_xaf}
            walletLoading={walletLoading}
            hasEnoughBalance={computed.hasEnoughBalance}
            isValidAmount={computed.isValidAmount}
            showRate={computed.showRate}
          />
        )}

        {step === 'beneficiary' && selectedMethod && (
          <NewPaymentBeneficiaryStep
            selectedMethod={selectedMethod}
            profile={profile}
            existingBeneficiaries={existingBeneficiaries}
            beneficiaryTab={beneficiaryTab}
            onBeneficiaryTabChange={setBeneficiaryTab}
            selectedBeneficiary={selectedBeneficiary}
            onSelectedBeneficiaryChange={setSelectedBeneficiary}
            cashBenefType={cashBenefType}
            onCashBenefTypeChange={setCashBenefType}
            draft={draft}
            setters={{
              setName: setDraftName,
              setPhone: setDraftPhone,
              setEmail: setDraftEmail,
              setIdType: setDraftIdType,
              setIdentifier: setDraftIdentifier,
              setBankName: setDraftBankName,
              setBankAccount: setDraftBankAccount,
              setBankExtra: setDraftBankExtra,
            }}
            qrCodePreview={qrCodePreview}
            onQrFileSelect={handleQrFileSelect}
            onQrFileRemove={handleQrFileRemove}
            onSkip={() => {
              setSkipBeneficiary(true);
              setStep('confirm');
            }}
          />
        )}

        {step === 'confirm' && selectedMethod && (
          <NewPaymentConfirmStep
            selectedMethod={selectedMethod}
            methodLabel={t(`form.methods.${selectedMethod}.label`)}
            amountXAF={computed.amountXAF}
            amountRMB={computed.amountRMB}
            rate={computed.rate}
            showRate={computed.showRate}
            balanceAfter={computed.balanceAfter}
            beneficiaryName={(confirmSnapshot?.name as string) || undefined}
            hasBeneficiary={hasBeneficiary}
          />
        )}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={footerCTA.onClick}
          disabled={footerCTA.disabled}
          className={cn(
            'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
            footerCTA.disabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : footerCTA.isSubmit
                ? 'bg-primary text-primary-foreground'
                : 'btn-primary-gradient',
          )}
        >
          {createPayment.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          {footerCTA.label}
        </button>
      </div>
    </MobileLayout>
  );
};

export default NewPaymentPage;
