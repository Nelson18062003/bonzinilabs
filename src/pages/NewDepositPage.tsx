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
      toast.success('Copié !');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
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

      toast.success('Dépôt créé avec succès !', {
        description: `Référence: ${deposit.reference}. Téléchargez vos justificatifs.`,
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
        title: selectedSubMethod === 'BANK_TRANSFER' ? 'Virement bancaire' : 'Dépôt cash en banque',
        fields: [
          { label: 'Banque', value: bankInfo?.bonziniAccount.bankName || '', key: 'bank' },
          { label: 'N° Compte', value: bankInfo?.bonziniAccount.accountNumber || '', key: 'account', mono: true },
          { label: 'Titulaire', value: bankInfo?.bonziniAccount.accountName || '', key: 'name' },
          { label: 'IBAN', value: bankInfo?.bonziniAccount.iban || '', key: 'iban', mono: true },
          { label: 'SWIFT', value: bankInfo?.bonziniAccount.swift || '', key: 'swift', mono: true },
        ],
        merchantCode: undefined as string | undefined,
        instructions: selectedSubMethod === 'BANK_TRANSFER'
          ? [
              'Connectez-vous à votre application bancaire ou rendez-vous en agence',
              'Effectuez un virement vers le compte ci-dessus',
              'Vous recevrez une référence après confirmation',
              'Conservez le reçu et téléchargez-le ensuite',
            ]
          : [
              `Rendez-vous dans une agence ${bankInfo?.label}`,
              'Effectuez un dépôt cash sur le compte ci-dessus',
              'Vous recevrez une référence après confirmation',
              'Conservez le bordereau et téléchargez-le ensuite',
            ],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          title: 'Transfert Orange Money',
          fields: [
            { label: 'Numéro OM', value: orangeMoneyAccount.phone, key: 'account', mono: true },
            { label: 'Titulaire', value: orangeMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            'Composez #150*1*1#',
            `Entrez le numéro: ${orangeMoneyAccount.phone}`,
            `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
            'Confirmez avec votre code PIN',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      } else {
        const merchantCodeWithAmount = omMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: 'Retrait Orange Money',
          fields: [
            { label: 'Titulaire', value: omMerchantInfo.accountName, key: 'name' },
          ],
          merchantCode: merchantCodeWithAmount,
          instructions: [
            'Composez le code ci-dessous sur votre téléphone',
            'Validez avec votre code PIN Orange Money',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      }
    }

    if (selectedFamily === 'MTN_MONEY') {
      if (selectedSubMethod === 'MTN_TRANSFER') {
        return {
          title: 'Transfert MTN Mobile Money',
          fields: [
            { label: 'Numéro MOMO', value: mtnMoneyAccount.phone, key: 'account', mono: true },
            { label: 'Titulaire', value: mtnMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            'Composez *126#',
            'Sélectionnez "Transfert d\'argent"',
            `Entrez le numéro: ${mtnMoneyAccount.phone}`,
            `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
            'Confirmez avec votre code PIN',
          ],
        };
      } else {
        const merchantCodeWithAmount = mtnMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: 'Retrait MTN Mobile Money',
          fields: [
            { label: 'Titulaire', value: mtnMerchantInfo.accountName, key: 'name' },
          ],
          merchantCode: merchantCodeWithAmount,
          instructions: [
            'Composez le code ci-dessous sur votre téléphone',
            'Validez avec votre code PIN MTN Mobile Money',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      }
    }

    if (selectedFamily === 'AGENCY_BONZINI' && selectedAgency) {
      const agencyInfo = getAgencyInfo(selectedAgency);
      return {
        title: 'Dépôt en agence Bonzini',
        fields: [
          { label: 'Agence', value: agencyInfo?.label || '', key: 'agency' },
          { label: 'Adresse', value: agencyInfo?.address || '', key: 'address' },
          { label: 'Horaires', value: agencyInfo?.hours || '', key: 'hours' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          `Rendez-vous à l'agence ${agencyInfo?.label}`,
          'Présentez votre pièce d\'identité',
          'Vous recevrez une référence après confirmation',
          'Effectuez votre dépôt en espèces',
          'Conservez votre reçu',
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        title: 'Transfert Wave',
        fields: [
          { label: 'Numéro Wave', value: waveAccount.phone, key: 'account', mono: true },
          { label: 'Titulaire', value: waveAccount.accountName, key: 'name' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          'Ouvrez l\'application Wave',
          'Sélectionnez "Envoyer"',
          `Entrez le numéro: ${waveAccount.phone}`,
          `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
          'Confirmez le transfert',
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
            Montant à déposer
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
          Montant minimum : 50 000 XAF
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
          Continuer
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
          Retour
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          Comment souhaitez-vous déposer ?
        </p>
        {methodFamilies.map((family) => {
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
            Retour
          </button>

          <p className="text-sm text-muted-foreground mb-4">
            Type d'opération
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
          Retour
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          Choisissez votre banque
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
          Retour
        </button>

        <p className="text-sm text-muted-foreground mb-4">
          Choisissez une agence
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
            Retour
          </button>

          {/* Summary card */}
          <div className="card-elevated p-4 bg-primary/5 border-primary/20">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm text-muted-foreground">Montant à déposer</span>
              <span
                className="font-bold text-lg text-foreground"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatXAF(parseInt(amount))} XAF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Méthode</span>
              <span className="text-sm font-medium text-foreground">{info.title}</span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="card-elevated p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              Coordonnées de dépôt
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
                <span className="text-sm text-muted-foreground block mb-2">Code Marchand</span>
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
              <span className="text-sm text-muted-foreground">Montant à envoyer</span>
              <span className="font-bold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatXAF(parseInt(amount))} XAF
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Instructions</p>
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
              En confirmant, votre demande de dépôt sera enregistrée. Vous pourrez ensuite télécharger vos justificatifs.
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
            Je confirme ma demande de dépôt
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
      <p className="font-semibold text-foreground mt-6">Création du dépôt...</p>
      <p className="text-sm text-muted-foreground mt-2">Un instant</p>
    </div>
  );

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      amount: 'Nouveau dépôt',
      family: 'Méthode de dépôt',
      submethod: 'Type d\'opération',
      bank: 'Choix de la banque',
      agency: 'Choix de l\'agence',
      recap: 'Récapitulatif',
      creating: 'Création...',
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
