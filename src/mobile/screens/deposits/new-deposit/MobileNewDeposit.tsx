// ============================================================
// MODULE DEPOTS — Admin New Deposit (Single File)
// Mirrors client NewDepositPage.tsx patterns:
//   StepTransition CSS, card-elevated, method-card, btn-primary-gradient
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { StepTransition } from '@/components/auth/StepTransition';
import { useAllClients, useAdminCreateDeposit } from '@/hooks/useAdminDeposits';
import { useCountUp } from '@/hooks/useCountUp';
import { formatXAF, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  SUB_METHOD_TO_DB_METHOD,
  type DepositMethodFamily,
  type DepositSubMethod,
  type BankOption,
  type AgencyOption,
} from '@/types/deposit';
import {
  methodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
  MOBILE_MONEY_TRANSACTION_LIMIT,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
} from '@/data/depositMethodsData';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Copy,
  FileText,
  Info,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import * as Icons from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

type Step = 'client' | 'amount' | 'family' | 'submethod' | 'bank' | 'agency' | 'recap' | 'creating';

const PHASE_1_STEPS: Step[] = ['client', 'amount', 'family', 'submethod', 'bank', 'agency'];

function getPhaseIndex(step: Step): number {
  if (PHASE_1_STEPS.includes(step)) return 0;
  if (step === 'recap') return 1;
  return 2;
}

// ── Component ──────────────────────────────────────────────

export function MobileNewDeposit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  // Flow state
  const [step, setStep] = useState<Step>(preselectedClientId ? 'amount' : 'client');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<NonNullable<typeof clients>[0] | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const amountNum = parseInt(amount) || 0;
  const animatedAmount = useCountUp(amountNum, { enabled: amountNum > 0 });

  // Preselected client from URL
  useEffect(() => {
    if (preselectedClientId && clients && !selectedClient) {
      const client = clients.find((c) => c.user_id === preselectedClientId);
      if (client) setSelectedClient(client);
    }
  }, [preselectedClientId, clients, selectedClient]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 20);
    const search = clientSearch.toLowerCase();
    return clients
      .filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
        c.phone?.includes(search),
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  // ── Navigation helpers ──────────────────────────────────

  const goTo = (nextStep: Step, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir);
    setStep(nextStep);
  };

  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    setSelectedSubMethod(null);
    setSelectedBank(null);
    setSelectedAgency(null);
    setDirection('forward');

    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
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

  const handleRecapBack = () => {
    if (selectedFamily === 'WAVE') goTo('family', 'back');
    else if (selectedFamily === 'AGENCY_BONZINI') goTo('agency', 'back');
    else if (selectedBank) goTo('bank', 'back');
    else goTo('submethod', 'back');
  };

  const handleHeaderBack = () => {
    switch (step) {
      case 'client':
        navigate(preselectedClientId ? `/m/clients/${preselectedClientId}` : '/m/deposits');
        break;
      case 'amount':
        if (preselectedClientId) navigate(`/m/clients/${preselectedClientId}`);
        else goTo('client', 'back');
        break;
      case 'family':
        goTo('amount', 'back');
        break;
      case 'submethod':
        goTo('family', 'back');
        break;
      case 'bank':
      case 'agency':
        familyRequiresSubMethod(selectedFamily!) ? goTo('submethod', 'back') : goTo('family', 'back');
        break;
      case 'recap':
        handleRecapBack();
        break;
    }
  };

  // ── Helpers ─────────────────────────────────────────────

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

  const getDepositMethod = () => {
    if (selectedSubMethod) return SUB_METHOD_TO_DB_METHOD[selectedSubMethod];
    if (selectedFamily === 'AGENCY_BONZINI') return SUB_METHOD_TO_DB_METHOD['AGENCY_CASH'];
    if (selectedFamily === 'WAVE') return SUB_METHOD_TO_DB_METHOD['WAVE_TRANSFER'];
    return 'bank_transfer' as const;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProofFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) =>
    setProofFiles((prev) => prev.filter((_, idx) => idx !== i));

  const doCreateDeposit = async () => {
    if (!selectedClient || !amount || !selectedFamily) {
      toast.error('Informations manquantes');
      return;
    }
    goTo('creating');
    try {
      const result = await createDeposit.mutateAsync({
        user_id: selectedClient.user_id,
        amount_xaf: amountNum,
        method: getDepositMethod(),
        bank_name: selectedBank
          ? banks.find((b) => b.bank === selectedBank)?.label
          : undefined,
        agency_name: selectedAgency
          ? agencies.find((a) => a.agency === selectedAgency)?.label
          : undefined,
        admin_comment: adminComment || undefined,
        proofFiles: proofFiles.length > 0 ? proofFiles : undefined,
      });
      navigate(`/m/deposits/${result.id}`);
    } catch {
      goTo('recap', 'back');
    }
  };

  // ── Recap data ──────────────────────────────────────────

  const getRecapInfo = () => {
    if (!selectedFamily) return null;

    if (selectedFamily === 'BANK' && selectedBank) {
      const b = banks.find((x) => x.bank === selectedBank);
      if (!b) return null;
      return {
        title: selectedSubMethod === 'BANK_TRANSFER' ? 'Virement bancaire' : 'Dépôt cash en banque',
        fields: [
          { label: 'Banque', value: b.bonziniAccount.bankName, key: 'bank' },
          { label: 'N° Compte', value: b.bonziniAccount.accountNumber, key: 'account', mono: true },
          { label: 'Titulaire', value: b.bonziniAccount.accountName, key: 'name' },
          { label: 'IBAN', value: b.bonziniAccount.iban, key: 'iban', mono: true },
          { label: 'SWIFT', value: b.bonziniAccount.swift, key: 'swift', mono: true },
        ],
        merchantCode: undefined as string | undefined,
        instructions:
          selectedSubMethod === 'BANK_TRANSFER'
            ? [
                'Le client se connecte à son app bancaire',
                'Il effectue un virement vers le compte ci-dessus',
                `Montant exact : ${formatCurrency(amountNum)}`,
                'Il conserve le reçu',
              ]
            : [
                `Le client se rend en agence ${b.label}`,
                'Il effectue un dépôt cash',
                `Montant exact : ${formatCurrency(amountNum)}`,
                'Il conserve le bordereau',
              ],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          title: 'Transfert Orange Money',
          fields: [
            { label: 'Opérateur', value: 'ORANGE MONEY', key: 'op' },
            { label: 'Numéro', value: orangeMoneyAccount.phone, key: 'phone', mono: true },
            { label: 'Titulaire', value: orangeMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            'Composer #150*1*1#',
            `Numéro : ${orangeMoneyAccount.phone}`,
            `Montant : ${formatCurrency(amountNum)}`,
            'Confirmer avec le code PIN',
          ],
        };
      }
      return {
        title: 'Retrait Orange Money',
        fields: [
          { label: 'Opérateur', value: 'ORANGE MONEY', key: 'op' },
          { label: 'Titulaire', value: omMerchantInfo.accountName, key: 'name' },
        ],
        merchantCode: omMerchantInfo.merchantCode.replace('MONTANT', amount),
        instructions: [
          'Composer le code marchand ci-dessous',
          'Valider avec le code PIN Orange Money',
          "Capture d'écran du SMS de confirmation",
        ],
      };
    }

    if (selectedFamily === 'MTN_MONEY') {
      if (selectedSubMethod === 'MTN_TRANSFER') {
        return {
          title: 'Transfert MTN Mobile Money',
          fields: [
            { label: 'Opérateur', value: 'MTN MOMO', key: 'op' },
            { label: 'Numéro', value: mtnMoneyAccount.phone, key: 'phone', mono: true },
            { label: 'Titulaire', value: mtnMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            'Depuis le compte MTN Float',
            `Transfert vers ${mtnMoneyAccount.phone}`,
            `Montant : ${formatCurrency(amountNum)}`,
            'Confirmer avec le code PIN',
          ],
        };
      }
      return {
        title: 'Retrait MTN Mobile Money',
        fields: [
          { label: 'Opérateur', value: 'MTN MOMO', key: 'op' },
          { label: 'Titulaire', value: mtnMerchantInfo.accountName, key: 'name' },
        ],
        merchantCode: mtnMerchantInfo.merchantCode.replace('MONTANT', amount),
        instructions: [
          'Composer le code marchand ci-dessous',
          'Valider avec le code PIN MTN',
          "Capture d'écran du SMS de confirmation",
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        title: 'Transfert Wave',
        fields: [
          { label: 'Numéro Wave', value: waveAccount.phone, key: 'phone', mono: true },
          { label: 'Titulaire', value: waveAccount.accountName, key: 'name' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          "Ouvrir l'app Wave",
          'Sélectionner "Envoyer"',
          `Numéro : ${waveAccount.phone}`,
          `Montant : ${formatCurrency(amountNum)}`,
        ],
      };
    }

    if (selectedFamily === 'AGENCY_BONZINI' && selectedAgency) {
      const a = agencies.find((x) => x.agency === selectedAgency);
      if (!a) return null;
      return {
        title: 'Dépôt en agence Bonzini',
        fields: [
          { label: 'Agence', value: a.label, key: 'agency' },
          { label: 'Adresse', value: a.address, key: 'address' },
          { label: 'Horaires', value: a.hours, key: 'hours' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          `Se rendre à ${a.label}`,
          "Présenter sa pièce d'identité",
          `Déposer ${formatCurrency(amountNum)} en espèces`,
          'Conserver le reçu',
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
              i <= currentPhase ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>
    );
  };

  const renderClientSelect = () => (
    <StepTransition stepKey="client" direction={direction}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sélectionnez le client pour ce dépôt
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nom ou téléphone..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-secondary border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            autoFocus
          />
          {clientSearch && (
            <button
              onClick={() => setClientSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Client list */}
        {clientsLoading ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Chargement...</p>
          </div>
        ) : filteredClients.length > 0 ? (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <button
                key={client.user_id}
                onClick={() => {
                  setSelectedClient(client);
                  goTo('amount');
                }}
                className="method-card w-full text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {client.first_name?.[0]}
                  {client.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {client.first_name} {client.last_name}
                  </p>
                  {client.phone && (
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <User className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
          </div>
        )}
      </div>
    </StepTransition>
  );

  const renderAmountInput = () => (
    <StepTransition stepKey="amount" direction={direction}>
      <div className="space-y-6">
        {!preselectedClientId && (
          <button
            onClick={() => goTo('client', 'back')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        )}

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
          {amountNum > 0 && (
            <p
              className="text-center text-sm text-muted-foreground mt-2"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatXAF(animatedAmount)} XAF
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[100000, 500000, 1000000, 2000000].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset.toString())}
              className={cn(
                'py-3 rounded-xl font-medium transition-all text-sm active:scale-[0.97]',
                amountNum === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80',
              )}
            >
              {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}K`}
            </button>
          ))}
        </div>

        <button
          onClick={() => amountNum >= 1000 && goTo('family')}
          disabled={amountNum < 1000}
          className={cn(
            'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
            amountNum >= 1000
              ? 'btn-primary-gradient'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
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
          Méthode de dépôt
        </p>

        {amountNum > MOBILE_MONEY_TRANSACTION_LIMIT && (
          <div className="p-3 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Le montant dépasse la limite mobile money (
                {formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)})
              </p>
            </div>
          </div>
        )}

        {methodFamilies.map((family) => {
          const IconComponent =
            (Icons as Record<string, React.ComponentType<{ className?: string }>>)[family.icon] ||
            Icons.Banknote;
          const isSelected = selectedFamily === family.family;

          return (
            <button
              key={family.family}
              onClick={() => handleFamilySelected(family.family)}
              className={cn(
                'method-card w-full text-left',
                isSelected && 'method-card-selected',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground',
                )}
              >
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

          <p className="text-sm text-muted-foreground mb-4">Type d'opération</p>

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

        <p className="text-sm text-muted-foreground mb-4">Choisissez la banque</p>

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
          onClick={() =>
            familyRequiresSubMethod(selectedFamily!)
              ? goTo('submethod', 'back')
              : goTo('family', 'back')
          }
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <p className="text-sm text-muted-foreground mb-4">Choisissez une agence</p>

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
              <span className="text-sm text-muted-foreground">Montant</span>
              <span
                className="font-bold text-lg text-foreground"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatXAF(amountNum)} XAF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Méthode</span>
              <span className="text-sm font-medium text-foreground">{info.title}</span>
            </div>
          </div>

          {/* Client card */}
          {selectedClient && (
            <div className="card-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {selectedClient.first_name?.[0]}
                  {selectedClient.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-semibold text-foreground text-sm truncate">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Coordinates */}
          <div className="card-elevated p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              Coordonnées de dépôt
            </p>

            {info.fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between py-2 border-b border-border/50"
              >
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium text-foreground text-sm text-right',
                      field.mono && 'font-mono',
                    )}
                  >
                    {field.value}
                  </span>
                  <button onClick={() => handleCopy(field.value, field.key)}>
                    {copiedField === field.key ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Merchant code */}
            {info.merchantCode && (
              <div className="py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-2">
                  Code Marchand
                </span>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                  <span className="font-bold text-foreground font-mono text-sm break-all">
                    {info.merchantCode}
                  </span>
                  <button
                    onClick={() => handleCopy(info.merchantCode!, 'merchant')}
                    className="flex-shrink-0 ml-2"
                  >
                    {copiedField === 'merchant' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Amount row */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Montant à envoyer</span>
              <span
                className="font-bold text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatXAF(amountNum)} XAF
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

          {/* Proof upload (optional) */}
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold text-foreground mb-3">
              Preuves (optionnel)
            </p>
            <label className="block w-full cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="border-2 border-dashed border-border/40 hover:border-primary/30 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Photos ou PDFs (max 5)</p>
              </div>
            </label>

            {proofFiles.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {proofFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border/30 flex-shrink-0"
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground truncate max-w-full px-1">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin comment (optional) */}
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold text-foreground mb-3">
              Commentaire admin (optionnel)
            </p>
            <textarea
              placeholder="Note interne..."
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              enterKeyHint="done"
              className="w-full h-20 p-3 rounded-xl border border-border/50 bg-secondary/50 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
          </div>

          {/* Confirmation notice */}
          <div className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3">
            <p className="text-xs text-primary leading-relaxed">
              Le dépôt sera créé pour le client.{' '}
              {proofFiles.length > 0
                ? 'Les preuves seront téléchargées et le statut avancé à "Preuve envoyée".'
                : 'Le client pourra ensuite ajouter ses preuves.'}
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
                : 'btn-primary-gradient',
            )}
          >
            {createDeposit.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            Confirmer et créer le dépôt
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

  // ── Main render ──────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader
        title="Nouveau dépôt"
        showBack={step !== 'creating'}
        onBack={handleHeaderBack}
        backTo={
          preselectedClientId
            ? `/m/clients/${preselectedClientId}`
            : '/m/deposits'
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {step !== 'creating' && renderPhaseProgress()}

        {step === 'client' && renderClientSelect()}
        {step === 'amount' && renderAmountInput()}
        {step === 'family' && renderFamilySelection()}
        {step === 'submethod' && renderSubMethodSelection()}
        {step === 'bank' && renderBankSelection()}
        {step === 'agency' && renderAgencySelection()}
        {step === 'recap' && renderRecap()}
        {step === 'creating' && renderCreating()}
      </div>
    </div>
  );
}
