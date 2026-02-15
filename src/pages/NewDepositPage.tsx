import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StepTransition } from '@/components/auth/StepTransition';
import { CountdownTimer } from '@/components/deposit/CountdownTimer';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { useCountUp } from '@/hooks/useCountUp';
import { formatXAF } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDeposit, useUploadMultipleProofs } from '@/hooks/useDeposits';
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
  Phone,
  Building2,
  User,
  Loader2,
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
  | 'client-info'
  | 'creating'
  | 'instructions'
  | 'proof';

const PHASE_1_STEPS: Step[] = ['amount', 'family', 'submethod', 'bank', 'agency', 'client-info'];

function getPhaseIndex(step: Step): number {
  if (PHASE_1_STEPS.includes(step) || step === 'creating') return 0;
  if (step === 'instructions') return 1;
  return 2; // proof
}

const NewDepositPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createDeposit = useCreateDeposit();
  const uploadProofs = useUploadMultipleProofs();

  // Flow state
  const [step, setStep] = useState<Step>('amount');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [createdDeposit, setCreatedDeposit] = useState<{ id: string; reference: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [createdAtTimestamp, setCreatedAtTimestamp] = useState<string | null>(null);

  // Count-up animation for amount preview
  const parsedAmount = parseInt(amount) || 0;
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

  // Create deposit (transition between Phase 1 and Phase 2)
  const doCreateDeposit = async (overrides?: {
    method?: DepositMethod;
    family?: DepositMethodFamily;
    subMethod?: DepositSubMethod;
    bankName?: string;
    agencyName?: string;
  }) => {
    goTo('creating');
    try {
      const deposit = await createDeposit.mutateAsync({
        amount_xaf: parseInt(amount),
        method: overrides?.method || getDepositMethod(),
        bank_name: overrides?.bankName || selectedBank || undefined,
        agency_name: overrides?.agencyName || selectedAgency || undefined,
        client_phone: clientPhone || undefined,
      });

      setCreatedDeposit({ id: deposit.id!, reference: deposit.reference! });
      setCreatedAtTimestamp(new Date().toISOString());
      if (overrides?.family) setSelectedFamily(overrides.family);
      if (overrides?.subMethod) setSelectedSubMethod(overrides.subMethod);

      toast.success('Dépôt créé avec succès !', {
        description: 'Suivez les instructions pour effectuer le dépôt.',
      });

      goTo('instructions');
    } catch {
      // Error handled by mutation's onError — go back to family selection
      goTo('family', 'back');
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
      // Wave has no sub-selection, create deposit immediately
      doCreateDeposit({
        method: SUB_METHOD_TO_DB_METHOD['WAVE_TRANSFER'],
        family: family,
        subMethod: 'WAVE_TRANSFER',
      });
    }
  };

  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);
    setDirection('forward');

    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else if (subMethod === 'OM_WITHDRAWAL' || subMethod === 'MTN_WITHDRAWAL') {
      setStep('client-info');
    } else {
      // Transfers go directly to deposit creation
      doCreateDeposit();
    }
  };

  const handleBankSelected = (bank: BankOption) => {
    setSelectedBank(bank);
    doCreateDeposit({ bankName: bank });
  };

  const handleAgencySelected = (agency: AgencyOption) => {
    setSelectedAgency(agency);
    doCreateDeposit({ agencyName: agency });
  };

  const handleClientInfoSubmit = () => {
    if (!clientPhone || !clientName) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    doCreateDeposit();
  };

  // Proof upload handlers
  const handleProofConfirm = async () => {
    if (!createdDeposit || !proofFiles.length) return;

    try {
      await uploadProofs.mutateAsync({
        depositId: createdDeposit.id,
        files: proofFiles,
      });
      navigate(`/deposits/${createdDeposit.id}`, { state: { fromProofUpload: true } });
    } catch {
      // Error handled by mutation
    }
  };

  const handleSkipProof = () => {
    if (!createdDeposit) return;
    navigate(`/deposits/${createdDeposit.id}`);
  };

  // Get instruction info based on selected method
  const getInstructionInfo = () => {
    if (!selectedFamily) return null;
    const depositRef = createdDeposit?.reference || '';

    if (selectedFamily === 'BANK' && selectedBank) {
      const bankInfo = getBankInfo(selectedBank);
      return {
        type: 'bank',
        title: selectedSubMethod === 'BANK_TRANSFER' ? 'Virement bancaire' : 'Dépôt cash en banque',
        accountLabel: 'N° Compte',
        accountValue: bankInfo?.bonziniAccount.accountNumber || '',
        accountName: bankInfo?.bonziniAccount.accountName || '',
        bankName: bankInfo?.bonziniAccount.bankName || '',
        instructions: selectedSubMethod === 'BANK_TRANSFER'
          ? [
              'Connectez-vous à votre application bancaire ou rendez-vous en agence',
              'Effectuez un virement vers le compte ci-dessus',
              `Indiquez la référence: ${depositRef}`,
              'Conservez le reçu et téléchargez-le ici',
            ]
          : [
              `Rendez-vous dans une agence ${bankInfo?.label}`,
              'Effectuez un dépôt cash sur le compte ci-dessus',
              `Indiquez la référence: ${depositRef}`,
              'Conservez le bordereau et téléchargez-le ici',
            ],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          type: 'mobile',
          title: 'Transfert Orange Money',
          accountLabel: 'Numéro OM',
          accountValue: orangeMoneyAccount.phone,
          accountName: orangeMoneyAccount.accountName,
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
          type: 'merchant',
          title: 'Retrait Orange Money',
          accountLabel: 'Titulaire',
          accountValue: omMerchantInfo.accountName,
          accountName: omMerchantInfo.accountName,
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
          type: 'mobile',
          title: 'Transfert MTN Mobile Money',
          accountLabel: 'Numéro MOMO',
          accountValue: mtnMoneyAccount.phone,
          accountName: mtnMoneyAccount.accountName,
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
          type: 'merchant',
          title: 'Retrait MTN Mobile Money',
          accountLabel: 'Titulaire',
          accountValue: mtnMerchantInfo.accountName,
          accountName: mtnMerchantInfo.accountName,
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
        type: 'agency',
        title: 'Dépôt en agence Bonzini',
        accountLabel: 'Agence',
        accountValue: agencyInfo?.label || '',
        accountName: 'BONZINI TRADING',
        address: agencyInfo?.address,
        hours: agencyInfo?.hours,
        instructions: [
          `Rendez-vous à l'agence ${agencyInfo?.label}`,
          'Présentez votre pièce d\'identité',
          `Mentionnez la référence: ${depositRef}`,
          'Effectuez votre dépôt en espèces',
          'Conservez votre reçu',
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        type: 'mobile',
        title: 'Transfert Wave',
        accountLabel: 'Numéro Wave',
        accountValue: waveAccount.phone,
        accountName: waveAccount.accountName,
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

  const handleCopyAll = () => {
    const info = getInstructionInfo();
    if (!info) return;
    const depositRef = createdDeposit?.reference || '';

    const allText = `${info.accountLabel}: ${info.accountValue}\nTitulaire: ${info.accountName}\nMontant: ${formatXAF(parseInt(amount))} XAF\nRéférence: ${depositRef}`;
    handleCopy(allText, 'all');
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

  const renderClientInfoForm = () => (
    <StepTransition stepKey="client-info" direction={direction}>
      <div className="space-y-6">
        <button
          onClick={() => goTo('submethod', 'back')}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="card-elevated p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Nous avons besoin de vos informations pour initier le retrait
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Votre nom (sur le compte {selectedFamily === 'ORANGE_MONEY' ? 'OM' : 'MOMO'})
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Numéro de téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ex: 6XX XXX XXX"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleClientInfoSubmit}
          disabled={!clientPhone || !clientName}
          className={cn(
            'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
            clientPhone && clientName
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

  const renderCreating = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-deposit-pulse">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
      <p className="font-semibold text-foreground mt-6">Création du dépôt...</p>
      <p className="text-sm text-muted-foreground mt-2">Un instant</p>
    </div>
  );

  const renderInstructions = () => {
    const info = getInstructionInfo();
    if (!info) return null;
    const depositRef = createdDeposit?.reference || '';

    return (
      <StepTransition stepKey="instructions" direction={direction}>
        <div className="space-y-4">
          {/* Summary card */}
          <div className="card-elevated p-4 bg-primary/5 border-primary/20 animate-scale-in">
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

          {/* Countdown timer */}
          {createdAtTimestamp && (
            <div className="animate-slide-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
              <CountdownTimer createdAt={createdAtTimestamp} />
            </div>
          )}

          {/* Account info */}
          <div
            className="card-elevated p-4 space-y-3 animate-slide-up"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Informations de dépôt
              </p>
              <button
                onClick={handleCopyAll}
                className="text-xs text-primary font-medium hover:underline"
              >
                {copiedField === 'all' ? 'Copié !' : 'Tout copier'}
              </button>
            </div>

            {(info as any).bankName && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Banque</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{(info as any).bankName}</span>
                  <button onClick={() => handleCopy((info as any).bankName!, 'bank')}>
                    {copiedField === 'bank' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">{info.accountLabel}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground font-mono text-sm">{info.accountValue}</span>
                <button onClick={() => handleCopy(info.accountValue, 'account')}>
                  {copiedField === 'account' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Titulaire</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{info.accountName}</span>
                <button onClick={() => handleCopy(info.accountName, 'name')}>
                  {copiedField === 'name' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
                </button>
              </div>
            </div>

            {(info as any).address && (
              <div className="flex items-start justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Adresse</span>
                <span className="font-medium text-foreground text-right text-sm">{(info as any).address}</span>
              </div>
            )}

            {(info as any).hours && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Horaires</span>
                <span className="font-medium text-foreground text-sm">{(info as any).hours}</span>
              </div>
            )}

            {/* Merchant code for withdrawals */}
            {(info as any).merchantCode && (
              <div className="py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-2">Code Marchand</span>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                  <span className="font-bold text-foreground font-mono text-sm break-all">{(info as any).merchantCode}</span>
                  <button onClick={() => handleCopy((info as any).merchantCode, 'merchant')}>
                    {copiedField === 'merchant' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground flex-shrink-0 ml-2" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Référence</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary font-mono text-xs">{depositRef}</span>
                <button onClick={() => handleCopy(depositRef, 'ref')}>
                  {copiedField === 'ref' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div
            className="card-elevated p-4 animate-slide-up"
            style={{ animationDelay: '150ms', animationFillMode: 'both' }}
          >
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

          <button
            onClick={() => goTo('proof')}
            className="w-full btn-primary-gradient flex items-center justify-center gap-2 animate-slide-up"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
          >
            J'ai effectué le dépôt
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </StepTransition>
    );
  };

  const renderProofUpload = () => (
    <StepTransition stepKey="proof" direction={direction}>
      <div className="space-y-4">
        <div className="card-elevated p-4">
          <ProofUpload
            onFilesSelect={setProofFiles}
            selectedFiles={proofFiles}
            onConfirm={handleProofConfirm}
            isSubmitting={uploadProofs.isPending}
          />
        </div>

        <button
          onClick={handleSkipProof}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Envoyer la preuve plus tard
        </button>
      </div>
    </StepTransition>
  );

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      amount: 'Nouveau dépôt',
      family: 'Méthode de dépôt',
      submethod: 'Type d\'opération',
      bank: 'Choix de la banque',
      agency: 'Choix de l\'agence',
      'client-info': 'Vos informations',
      creating: 'Création...',
      instructions: 'Bordereau',
      proof: 'Preuve de dépôt',
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
        {step === 'client-info' && renderClientInfoForm()}
        {step === 'creating' && renderCreating()}
        {step === 'instructions' && renderInstructions()}
        {step === 'proof' && renderProofUpload()}
      </div>
    </MobileLayout>
  );
};

export default NewDepositPage;
