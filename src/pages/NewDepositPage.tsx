import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StepTransition } from '@/components/auth/StepTransition';
import { useCountUp } from '@/hooks/useCountUp';
import { formatXAF } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDeposit } from '@/hooks/useDeposits';
import { SUB_METHOD_TO_DB_METHOD, type DepositMethod } from '@/types/deposit';
import {
  methodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
  getBankInfo,
  getAgencyInfo,
} from '@/data/depositMethodsData';
import {
  DepositMethodFamily,
  DepositSubMethod,
  BankOption,
  AgencyOption
} from '@/types/deposit';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Copy,
  Info,
  MapPin,
  Clock,
  Building2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type Step =
  | 'amount'
  | 'family'
  | 'submethod'
  | 'bank'
  | 'agency'
  | 'recap'
  | 'creating';

const PHASE_1_STEPS: Step[] = ['amount', 'family', 'submethod', 'bank', 'agency'];

function getPhaseIndex(step: Step): number {
  if (PHASE_1_STEPS.includes(step)) return 0;
  if (step === 'recap') return 1;
  return 2; // creating
}

const NewDepositPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('deposits');
  const { user } = useAuth();
  const createDeposit = useCreateDeposit();

  // Flow state
  const [step, setStep] = useState<Step>('amount');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Count-up animation for amount preview
  const MAX_DEPOSIT_XAF = 50_000_000; // 50 000 000 XAF max par dépôt
  const parsedAmount = Math.min(parseInt(amount) || 0, MAX_DEPOSIT_XAF);
  const animatedAmount = useCountUp(parsedAmount, { enabled: parsedAmount > 0 });

  // Navigate between steps
  const goTo = (nextStep: Step, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir);
    setStep(nextStep);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(t('detail.copied'));
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error(t('detail.copyError'));
    }
  };

  // Map our internal types to the database deposit method format
  const getDepositMethod = (): DepositMethod => {
    if (selectedSubMethod) return SUB_METHOD_TO_DB_METHOD[selectedSubMethod];
    if (selectedFamily === 'AGENCY_BONZINI') return SUB_METHOD_TO_DB_METHOD['AGENCY_CASH'];
    if (selectedFamily === 'WAVE') return SUB_METHOD_TO_DB_METHOD['WAVE_TRANSFER'];
    return 'bank_transfer';
  };

  // Create deposit — only called from recap after explicit user confirmation
  const doCreateDeposit = async () => {
    goTo('creating');
    try {
      const deposit = await createDeposit.mutateAsync({
        amount_xaf: parseInt(amount),
        method: getDepositMethod(),
        bank_name: selectedBank || undefined,
        agency_name: selectedAgency || undefined,
      });

      toast.success(t('new.depositCreated'), {
        description: t('new.depositCreatedDesc', { reference: deposit.reference }),
      });

      // Navigate to deposit detail — proof upload is handled there
      navigate(`/deposits/${deposit.id}`, { state: { fromCreation: true } });
    } catch {
      // Error handled by mutation's onError — go back to recap
      goTo('recap', 'back');
    }
  };

  // Determine next step based on method family selection
  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    setDirection('forward');

    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
      // Wave has no sub-selection — go directly to recap
      setSelectedSubMethod('WAVE_TRANSFER');
      setStep('recap');
    }
  };

  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);
    setDirection('forward');

    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else {
      // All sub-methods (transfers AND withdrawals) go to recap
      setStep('recap');
    }
  };

  const handleBankSelected = (bank: BankOption) => {
    setSelectedBank(bank);
    goTo('recap');
  };

  const handleAgencySelected = (agency: AgencyOption) => {
    setSelectedAgency(agency);
    goTo('recap');
  };

  // Back navigation from recap depends on the path taken
  const handleRecapBack = () => {
    if (selectedFamily === 'WAVE') {
      goTo('family', 'back');
    } else if (selectedFamily === 'AGENCY_BONZINI') {
      goTo('agency', 'back');
    } else if (selectedBank) {
      goTo('bank', 'back');
    } else {
      goTo('submethod', 'back');
    }
  };

  // Build recap info with coordinates + instructions for the selected method
  const getRecapInfo = () => {
    if (!selectedFamily) return null;

    if (selectedFamily === 'BANK' && selectedBank) {
      const bankInfo = getBankInfo(selectedBank);
      return {
        title: selectedSubMethod === 'BANK_TRANSFER' ? t('new.recap.bankTransferTitle') : t('new.recap.bankCashTitle'),
        fields: [
          { label: t('new.recap.bank'), value: bankInfo?.bonziniAccount.bankName || '', key: 'bank' },
          { label: t('new.recap.accountNumber'), value: bankInfo?.bonziniAccount.accountNumber || '', key: 'account', mono: true },
          { label: t('new.recap.accountHolder'), value: bankInfo?.bonziniAccount.accountName || '', key: 'name' },
          { label: t('new.recap.iban'), value: bankInfo?.bonziniAccount.iban || '', key: 'iban', mono: true },
          { label: t('new.recap.swift'), value: bankInfo?.bonziniAccount.swift || '', key: 'swift', mono: true },
        ],
        merchantCode: undefined as string | undefined,
        instructions: selectedSubMethod === 'BANK_TRANSFER'
          ? [
              t('new.recap.bankTransferInstr1'),
              t('new.recap.bankTransferInstr2'),
              t('new.recap.bankTransferInstr3'),
              t('new.recap.bankTransferInstr4'),
            ]
          : [
              t('new.recap.bankCashInstr1', { bank: bankInfo?.label }),
              t('new.recap.bankCashInstr2'),
              t('new.recap.bankCashInstr3'),
              t('new.recap.bankCashInstr4'),
            ],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          title: t('new.recap.omTransferTitle'),
          fields: [
            { label: t('new.recap.omNumber'), value: orangeMoneyAccount.phone, key: 'account', mono: true },
            { label: t('new.recap.accountHolder'), value: orangeMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            t('new.recap.omTransferInstr1'),
            t('new.recap.omTransferInstr2', { phone: orangeMoneyAccount.phone }),
            t('new.recap.omTransferInstr3', { amount: `${formatXAF(parseInt(amount))} XAF` }),
            t('new.recap.omTransferInstr4'),
            t('new.recap.omTransferInstr5'),
          ],
        };
      } else {
        const merchantCodeWithAmount = omMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: t('new.recap.omWithdrawalTitle'),
          fields: [
            { label: t('new.recap.accountHolder'), value: omMerchantInfo.accountName, key: 'name' },
          ],
          merchantCode: merchantCodeWithAmount,
          instructions: [
            t('new.recap.omWithdrawalInstr1'),
            t('new.recap.omWithdrawalInstr2'),
            t('new.recap.omWithdrawalInstr3'),
          ],
        };
      }
    }

    if (selectedFamily === 'MTN_MONEY') {
      if (selectedSubMethod === 'MTN_TRANSFER') {
        return {
          title: t('new.recap.mtnTransferTitle'),
          fields: [
            { label: t('new.recap.mtnNumber'), value: mtnMoneyAccount.phone, key: 'account', mono: true },
            { label: t('new.recap.accountHolder'), value: mtnMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            t('new.recap.mtnTransferInstr1'),
            t('new.recap.mtnTransferInstr2'),
            t('new.recap.mtnTransferInstr3', { phone: mtnMoneyAccount.phone }),
            t('new.recap.mtnTransferInstr4', { amount: `${formatXAF(parseInt(amount))} XAF` }),
            t('new.recap.mtnTransferInstr5'),
          ],
        };
      } else {
        const merchantCodeWithAmount = mtnMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: t('new.recap.mtnWithdrawalTitle'),
          fields: [
            { label: t('new.recap.accountHolder'), value: mtnMerchantInfo.accountName, key: 'name' },
          ],
          merchantCode: merchantCodeWithAmount,
          instructions: [
            t('new.recap.mtnWithdrawalInstr1'),
            t('new.recap.mtnWithdrawalInstr2'),
            t('new.recap.mtnWithdrawalInstr3'),
          ],
        };
      }
    }

    if (selectedFamily === 'AGENCY_BONZINI' && selectedAgency) {
      const agencyInfo = getAgencyInfo(selectedAgency);
      return {
        title: t('new.recap.agencyTitle'),
        fields: [
          { label: t('new.recap.agency'), value: agencyInfo?.label || '', key: 'agency' },
          { label: t('new.recap.address'), value: agencyInfo?.address || '', key: 'address' },
          { label: t('new.recap.hours'), value: agencyInfo?.hours || '', key: 'hours' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          t('new.recap.agencyInstr1', { agency: agencyInfo?.label }),
          t('new.recap.agencyInstr2'),
          t('new.recap.agencyInstr3'),
          t('new.recap.agencyInstr4'),
          t('new.recap.agencyInstr5'),
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        title: t('new.recap.waveTitle'),
        fields: [
          { label: t('new.recap.waveNumber'), value: waveAccount.phone, key: 'account', mono: true },
          { label: t('new.recap.accountHolder'), value: waveAccount.accountName, key: 'name' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          t('new.recap.waveInstr1'),
          t('new.recap.waveInstr2'),
          t('new.recap.waveInstr3', { phone: waveAccount.phone }),
          t('new.recap.waveInstr4', { amount: `${formatXAF(parseInt(amount))} XAF` }),
          t('new.recap.waveInstr5'),
        ],
      };
    }

    return null;
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderPhaseProgress = () => {
    const currentPhase = getPhaseIndex(step);

    return (
      <div className="flex gap-1.5 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i <= currentPhase ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
    );
  };

  const renderAmountInput = () => (
    <StepTransition stepKey="amount" direction={direction}>
      <div className="space-y-6">
        <div className="card-elevated p-6">
          <p className="text-sm text-muted-foreground text-center mb-4">
            {t('new.amountToDeposit')}
          </p>
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="amount-input text-foreground"
              autoFocus
            />
            <span className="text-2xl font-medium text-muted-foreground">XAF</span>
          </div>
          {parsedAmount > 0 && (
            <p
              className="text-center text-sm text-muted-foreground mt-2"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatXAF(animatedAmount)} XAF
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[100000, 500000, 1000000].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset.toString())}
              className={cn(
                'py-3 rounded-xl font-medium transition-all text-sm active:scale-[0.97]',
                parsedAmount === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              )}
            >
              {formatXAF(preset)}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t('new.minimumAmount')}
        </p>

        <button
          onClick={() => parsedAmount >= 50000 && goTo('family')}
          disabled={parsedAmount < 50000}
          className={cn(
            'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
            parsedAmount >= 50000
              ? 'btn-primary-gradient'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {t('new.continue')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </StepTransition>
  );

  const renderFamilySelection = () => (
    <StepTransition stepKey="family" direction={direction}>
      <div className="space-y-3">
        <button
          onClick={() => goTo('amount', 'back')}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('new.back')}
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          {t('new.howToDeposit')}
        </p>
        {methodFamilies.map((family) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const IconComponent = (Icons as any)[family.icon] || Icons.Banknote;
          const isSelected = selectedFamily === family.family;

          return (
            <button
              key={family.family}
              onClick={() => handleFamilySelected(family.family)}
              className={cn(
                'method-card w-full text-left',
                isSelected && 'method-card-selected'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
              )}>
                <IconComponent className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{family.label}</p>
                <p className="text-xs text-muted-foreground">{family.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </StepTransition>
  );

  const renderSubMethodSelection = () => {
    if (!selectedFamily) return null;
    const subMethodsList = getSubMethodsForFamily(selectedFamily);

    return (
      <StepTransition stepKey="submethod" direction={direction}>
        <div className="space-y-3">
          <button
            onClick={() => goTo('family', 'back')}
            className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('new.back')}
          </button>

          <p className="text-sm text-muted-foreground mb-4">
            {t('new.operationType')}
          </p>

          {subMethodsList.map((subMethod) => (
            <button
              key={subMethod.subMethod}
              onClick={() => handleSubMethodSelected(subMethod.subMethod)}
              className="method-card w-full text-left"
            >
              <div className="flex-1">
                <p className="font-semibold text-foreground">{subMethod.label}</p>
                <p className="text-xs text-muted-foreground">{subMethod.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </StepTransition>
    );
  };

  const renderBankSelection = () => (
    <StepTransition stepKey="bank" direction={direction}>
      <div className="space-y-3">
        <button
          onClick={() => goTo('submethod', 'back')}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('new.back')}
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          {t('new.chooseBank')}
        </p>

        {banks.map((bank) => (
          <button
            key={bank.bank}
            onClick={() => handleBankSelected(bank.bank)}
            className="method-card w-full text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{bank.label}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </StepTransition>
  );

  const renderAgencySelection = () => (
    <StepTransition stepKey="agency" direction={direction}>
      <div className="space-y-3">
        <button
          onClick={() => goTo('family', 'back')}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('new.back')}
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          {t('new.chooseAgency')}
        </p>

        {agencies.map((agency) => (
          <button
            key={agency.agency}
            onClick={() => handleAgencySelected(agency.agency)}
            className="method-card w-full text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <MapPin className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{agency.label}</p>
              <p className="text-xs text-muted-foreground">{agency.address}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {agency.hours}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </StepTransition>
  );

  const renderRecap = () => {
    const info = getRecapInfo();
    if (!info) return null;

    return (
      <StepTransition stepKey="recap" direction={direction}>
        <div className="space-y-4">
          <button
            onClick={handleRecapBack}
            className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('new.back')}
          </button>

          {/* Summary card */}
          <div className="card-elevated p-4 bg-primary/5 border-primary/20">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm text-muted-foreground">{t('new.amountToDeposit')}</span>
              <span
                className="font-bold text-lg text-foreground"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatXAF(parseInt(amount))} XAF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('detail.method')}</span>
              <span className="text-sm font-medium text-foreground">{info.title}</span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="card-elevated p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              {t('new.recap.depositCoordinates')}
            </p>

            {info.fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-medium text-foreground text-sm text-right',
                    field.mono && 'font-mono'
                  )}>
                    {field.value}
                  </span>
                  <button onClick={() => handleCopy(field.value, field.key)}>
                    {copiedField === field.key
                      ? <Check className="w-4 h-4 text-success" />
                      : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    }
                  </button>
                </div>
              </div>
            ))}

            {/* Merchant code for withdrawals */}
            {info.merchantCode && (
              <div className="py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-2">{t('new.recap.merchantCode')}</span>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                  <span className="font-bold text-foreground font-mono text-sm break-all">{info.merchantCode}</span>
                  <button onClick={() => handleCopy(info.merchantCode!, 'merchant')} className="flex-shrink-0 ml-2">
                    {copiedField === 'merchant'
                      ? <Check className="w-4 h-4 text-success" />
                      : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Amount row */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">{t('new.recap.amountToSend')}</span>
              <span className="font-bold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatXAF(parseInt(amount))} XAF
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold text-foreground mb-4">{t('new.recap.instructions')}</p>
            <ol className="space-y-3">
              {info.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm text-muted-foreground pt-0.5">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Confirmation notice */}
          <div className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3">
            <p className="text-xs text-primary leading-relaxed">
              {t('new.recap.confirmNotice')}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={doCreateDeposit}
            disabled={createDeposit.isPending}
            className={cn(
              'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
              createDeposit.isPending
                ? 'bg-primary/60 text-primary-foreground'
                : 'btn-primary-gradient'
            )}
          >
            {createDeposit.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            {t('new.recap.confirmButton')}
          </button>
        </div>
      </StepTransition>
    );
  };

  const renderCreating = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-deposit-pulse">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
      <p className="font-semibold text-foreground mt-6">{t('new.creating')}</p>
      <p className="text-sm text-muted-foreground mt-2">{t('new.pleaseWait')}</p>
    </div>
  );

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      amount: t('new.steps.amount'),
      family: t('new.steps.family'),
      submethod: t('new.steps.submethod'),
      bank: t('new.steps.bank'),
      agency: t('new.steps.agency'),
      recap: t('new.steps.recap'),
      creating: t('new.steps.creating'),
    };
    return titles[step];
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader
        title={getStepTitle()}
        showBack={step !== 'creating'}
      />

      <div className="px-4 py-6">
        {/* Phase progress bar */}
        {step !== 'creating' && renderPhaseProgress()}

        {step === 'amount' && renderAmountInput()}
        {step === 'family' && renderFamilySelection()}
        {step === 'submethod' && renderSubMethodSelection()}
        {step === 'bank' && renderBankSelection()}
        {step === 'agency' && renderAgencySelection()}
        {step === 'recap' && renderRecap()}
        {step === 'creating' && renderCreating()}
      </div>
    </MobileLayout>
  );
};

export default NewDepositPage;
