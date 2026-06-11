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
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SURFACE, PrimaryPill } from '@/mobile/designKit';
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
} from '@/components/payment-form/paymentSchemas';
import {
  emptyBeneficiaryForm,
  isBeneficiaryFormValid,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryForm';
import { getBeneficiaryNaturalKey, type IdentifierType } from '@/lib/beneficiaries/spec';
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
  // "Me payer moi-même" — applies to ALL modes (cash prefills from profile;
  // alipay/wechat/bank just tag relation=self and keep the account fields).
  const [useSelf, setUseSelf] = useState(false);
  const [dontSave, setDontSave] = useState(false);
  const [form, setForm] = useState<BeneficiaryFormValues>(() => emptyBeneficiaryForm('cash'));
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);

  const { data: existingBeneficiaries } = useBeneficiaries(selectedMethod || undefined);

  // Keep the form's mode in sync with the wizard's selected method, and
  // reset the per-method draft when the method changes.
  const formMode = form.payment_method;
  if (selectedMethod && selectedMethod !== formMode) {
    setForm(emptyBeneficiaryForm(selectedMethod));
    setSelectedBeneficiary(null);
    setUseSelf(false);
  }

  // Soft duplicate detection against the client's saved beneficiaries for
  // this mode (mirrors the DB unique index; cash has no hard key).
  const duplicateMatch = useMemo<Beneficiary | null>(() => {
    if (!selectedMethod || useSelf || selectedBeneficiary) return null;
    const key = getBeneficiaryNaturalKey({
      payment_method: form.payment_method,
      alias: form.alias,
      name: form.name,
      identifier: form.identifier,
      bank_account: form.bank_account,
      bank_name: form.bank_name,
    });
    if (!key) return null;
    return (
      existingBeneficiaries?.find((b) => {
        const bKey = getBeneficiaryNaturalKey({
          payment_method: b.payment_method,
          alias: b.alias ?? b.name,
          name: b.name,
          identifier: b.identifier,
          bank_account: b.bank_account,
          bank_name: b.bank_name,
        });
        return bKey && bKey.column === key.column && bKey.value === key.value;
      }) ?? null
    );
  }, [selectedMethod, useSelf, selectedBeneficiary, form, existingBeneficiaries]);

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

  // Resolved beneficiary fields for cash+self (prefilled from the profile).
  const selfCashName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const isCashSelf = selectedMethod === 'cash' && useSelf;

  // ── Submit ─────────────────────────────────────────────────
  // The snapshot is the FROZEN copy stored on the payment. It NEVER reads
  // back the live beneficiary row afterwards (immutable history).
  const buildBeneficiarySnapshot = (): Record<string, unknown> | undefined => {
    if (skipBeneficiary) return undefined;
    if (selectedBeneficiary) {
      return {
        id: selectedBeneficiary.id,
        alias: selectedBeneficiary.alias ?? selectedBeneficiary.name,
        name: selectedBeneficiary.name,
        payment_method: selectedBeneficiary.payment_method,
        identifier: selectedBeneficiary.identifier,
        identifier_type: selectedBeneficiary.identifier_type,
        phone: selectedBeneficiary.phone,
        email: selectedBeneficiary.email,
        bank_name: selectedBeneficiary.bank_name,
        bank_account: selectedBeneficiary.bank_account,
        bank_extra: selectedBeneficiary.bank_extra,
        relation_type: selectedBeneficiary.relation_type,
      };
    }
    if (isCashSelf) {
      return { relation_type: 'self', name: selfCashName, phone: profile?.phone };
    }
    if (selectedMethod === 'cash') {
      return {
        relation_type: form.relation_type,
        alias: form.alias,
        name: form.name,
        phone: form.phone,
        email: form.email,
      };
    }
    if (selectedMethod === 'alipay' || selectedMethod === 'wechat') {
      return {
        relation_type: useSelf ? 'self' : form.relation_type,
        alias: form.alias,
        name: form.name,
        identifier: form.identifier,
        identifier_type: form.identifier_type,
        phone: form.phone,
        email: form.email,
      };
    }
    if (selectedMethod === 'bank_transfer') {
      return {
        relation_type: useSelf ? 'self' : form.relation_type,
        alias: form.alias,
        name: form.name,
        bank_name: form.bank_name,
        bank_account: form.bank_account,
        bank_extra: form.bank_extra,
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

      // 2. Save the new beneficiary to the carnet, unless: skipped, a saved
      //    one is selected, cash+self (it's the client), or "don't save".
      //    Non-silent: a save failure is surfaced but the PAYMENT still
      //    proceeds (the frozen snapshot below keeps it complete).
      if (
        !skipBeneficiary &&
        !selectedBeneficiary &&
        !dontSave &&
        !isCashSelf &&
        isBeneficiaryFormValid(form, { hasQr: !!qrCodeFile })
      ) {
        if (duplicateMatch) {
          // A matching saved beneficiary already exists → link it instead
          // of creating a duplicate (the DB unique index would reject it).
          beneficiaryId = duplicateMatch.id;
        } else {
          try {
            const newBenef = await createBeneficiary.mutateAsync({
              payment_method: selectedMethod,
              alias: form.alias,
              name: form.name,
              identifier: form.identifier || undefined,
              identifier_type: form.identifier_type || undefined,
              phone: form.phone || undefined,
              email: form.email || undefined,
              bank_name: form.bank_name || undefined,
              bank_account: form.bank_account || undefined,
              bank_extra: form.bank_extra || undefined,
              relation_type: useSelf ? 'self' : form.relation_type,
              notes: form.notes || undefined,
              qr_code_file: qrCodeFile || undefined,
            });
            beneficiaryId = newBenef.id;
          } catch {
            // The hook already toasts the cause; tell the user the carnet
            // save failed but the payment will still go through.
            toast.warning(t('form.beneficiary.saveFailedPaymentContinues'));
          }
        }
      }

      // 3. Build the snapshot fields and create the payment.
      const snapshot = buildBeneficiarySnapshot();
      const isCash = selectedMethod === 'cash';
      const benefName = isCashSelf ? selfCashName : ((snapshot?.name as string) ?? undefined);
      const benefPhone = isCashSelf
        ? profile?.phone || undefined
        : ((snapshot?.phone as string) ?? undefined);

      const result = await createPayment.mutateAsync({
        amount_xaf: computed.amountXAF,
        amount_rmb: computed.amountRMB,
        exchange_rate: Math.round(computed.rate * 1_000_000),
        method: selectedMethod,
        beneficiary_name: benefName || undefined,
        beneficiary_phone: benefPhone,
        beneficiary_email: (snapshot?.email as string) ?? undefined,
        beneficiary_qr_code_url: qrCodeUrl || undefined,
        beneficiary_bank_name: (snapshot?.bank_name as string) ?? undefined,
        beneficiary_bank_account: (snapshot?.bank_account as string) ?? undefined,
        beneficiary_bank_extra: (snapshot?.bank_extra as string) ?? undefined,
        beneficiary_identifier: (snapshot?.identifier as string) ?? undefined,
        beneficiary_identifier_type: snapshot?.identifier_type as IdentificationType | undefined,
        cash_beneficiary_type: isCash ? (useSelf ? 'self' : 'other') : undefined,
        cash_beneficiary_first_name: isCash
          ? useSelf
            ? profile?.first_name
            : form.name.split(' ')[0]
          : undefined,
        cash_beneficiary_last_name: isCash
          ? useSelf
            ? profile?.last_name
            : form.name.split(' ').slice(1).join(' ')
          : undefined,
        cash_beneficiary_phone: benefPhone,
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
  // beneficiary step is informational only (navigation always allowed
  // thanks to "compléter plus tard").
  const stepValidations = {
    method: methodStepSchema.safeParse({ selectedMethod }),
    amount: makeAmountStepSchema({
      walletBalanceXaf: wallet?.balance_xaf ?? 0,
    }).safeParse({ amountXAF: computed.amountXAF }),
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
    !!(selectedBeneficiary || isCashSelf || form.name);

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <PageHeader
          title={t('newPayment')}
          showBack
          onBack={() => {
            if (currentStepIndex > 0) setStep(STEPS[currentStepIndex - 1].key);
            else navigate('/payments');
          }}
        />

        <div className="px-1 pt-1">
          <StepProgressBar steps={STEPS} currentStepIndex={currentStepIndex} />
        </div>

        <div className="flex-1 px-4 py-4">
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
            useSelf={useSelf}
            onUseSelfChange={setUseSelf}
            formValues={form}
            onFormChange={setForm}
            dontSave={dontSave}
            onDontSaveChange={setDontSave}
            duplicateMatch={duplicateMatch}
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

        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <PrimaryPill
            onClick={footerCTA.onClick}
            disabled={footerCTA.disabled}
            loading={footerCTA.isSubmit && createPayment.isPending}
            className="w-full py-[15px] text-[15px]"
          >
            {footerCTA.label}
          </PrimaryPill>
        </div>
      </div>
    </MobileLayout>
  );
};

export default NewPaymentPage;
