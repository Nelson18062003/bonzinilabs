// ============================================================
// MODULE DEPOTS — MobileNewDeposit (Premium Rebuild)
// Multi-step wizard for admin deposit creation
// Steps: client → amount → method → submethod → bank/agency → proofs → summary
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAllClients, useAdminCreateDeposit } from '@/hooks/useAdminDeposits';
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
  subMethodRequiresAgencySelection,
  MOBILE_MONEY_TRANSACTION_LIMIT,
} from '@/data/depositMethodsData';
import { formatXAF, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Check,
  ChevronRight,
  Building2,
  Store,
  Smartphone,
  Waves,
  Upload,
  X,
  User,
  AlertTriangle,
  Paperclip,
  MessageSquare,
  CreditCard,
  FileText,
  Wallet,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

type Step = 'client' | 'amount' | 'method' | 'submethod' | 'bank' | 'agency' | 'proofs' | 'summary';

const ALL_STEPS: Step[] = ['client', 'amount', 'method', 'submethod', 'bank', 'agency', 'proofs', 'summary'];

const AMOUNT_PRESETS = [100_000, 500_000, 1_000_000, 2_000_000];

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Store,
  Smartphone,
  Waves,
};

export function MobileNewDeposit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(preselectedClientId ? 'amount' : 'client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<NonNullable<typeof clients>[0] | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-select client from URL params
  useEffect(() => {
    if (preselectedClientId && clients && !selectedClient) {
      const client = clients.find((c) => c.user_id === preselectedClientId);
      if (client) setSelectedClient(client);
    }
  }, [preselectedClientId, clients, selectedClient]);

  // ── Derived ────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 20);

    const search = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
          c.phone?.includes(search),
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  const getDepositMethod = () => {
    if (selectedSubMethod) return SUB_METHOD_TO_DB_METHOD[selectedSubMethod];
    if (selectedFamily === 'AGENCY_BONZINI') return SUB_METHOD_TO_DB_METHOD['AGENCY_CASH'];
    if (selectedFamily === 'WAVE') return SUB_METHOD_TO_DB_METHOD['WAVE_TRANSFER'];
    return 'bank_transfer' as const;
  };

  const isMobileMoneyMethod =
    selectedFamily === 'ORANGE_MONEY' ||
    selectedFamily === 'MTN_MONEY' ||
    selectedFamily === 'WAVE';
  const amountNum = parseInt(amount) || 0;
  const exceedsLimit = isMobileMoneyMethod && amountNum > MOBILE_MONEY_TRANSACTION_LIMIT;

  const getProgress = () => {
    const index = ALL_STEPS.indexOf(step);
    return ((index + 1) / ALL_STEPS.length) * 100;
  };

  // ── Handlers ───────────────────────────────────────────────
  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    setSelectedSubMethod(null);
    setSelectedBank(null);
    setSelectedAgency(null);

    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
      setSelectedSubMethod('WAVE_TRANSFER');
      setStep('proofs');
    }
  };

  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);

    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else if (subMethodRequiresAgencySelection(subMethod)) {
      setStep('agency');
    } else {
      setStep('proofs');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProofFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedClient || !amount || !selectedFamily) {
      toast.error('Informations manquantes');
      return;
    }

    try {
      await createDeposit.mutateAsync({
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
        proofFiles,
      });
      navigate('/m/deposits');
    } catch {
      // Error handled by mutation
    }
  };

  // ── Back navigation ────────────────────────────────────────
  const canGoBack = preselectedClientId ? step !== 'amount' : step !== 'client';
  const handleBack = () => {
    if (step === 'summary') {
      setStep('proofs');
    } else if (step === 'proofs') {
      if (selectedFamily === 'WAVE') {
        setStep('method');
      } else if (selectedBank) {
        setStep('bank');
      } else if (selectedAgency) {
        setStep('agency');
      } else if (selectedSubMethod) {
        setStep('submethod');
      } else {
        setStep('method');
      }
    } else if (step === 'bank' || step === 'agency') {
      if (familyRequiresSubMethod(selectedFamily!)) {
        setStep('submethod');
      } else {
        setStep('method');
      }
    } else if (step === 'submethod') {
      setStep('method');
    } else if (step === 'method') {
      setStep('amount');
    } else if (step === 'amount' && preselectedClientId) {
      navigate(`/m/clients/${preselectedClientId}`);
    } else if (step === 'amount') {
      setStep('client');
    }
  };

  const backToPath = preselectedClientId
    ? `/m/clients/${preselectedClientId}`
    : '/m/deposits';

  // ── Summary helpers ────────────────────────────────────────
  const getMethodLabel = (): string => {
    const familyLabel = methodFamilies.find((f) => f.family === selectedFamily)?.label || '';
    const bankLabel = selectedBank ? banks.find((b) => b.bank === selectedBank)?.label : null;
    const agencyLabel = selectedAgency ? agencies.find((a) => a.agency === selectedAgency)?.label : null;
    const parts = [familyLabel];
    if (bankLabel) parts.push(bankLabel);
    if (agencyLabel) parts.push(agencyLabel);
    return parts.join(' — ');
  };

  // ── Step rendering ─────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 1: Client Selection                           │
      // └─────────────────────────────────────────────────────┘
      case 'client':
        return (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Sélectionner un client</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choisissez le client pour ce dépôt
              </p>
            </div>

            {/* Search */}
            <div className="px-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou téléphone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full h-12 pl-10 pr-10 rounded-2xl bg-muted/60 border-0 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {clientSearch && (
                  <button
                    onClick={() => setClientSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
              {clientsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const isSelected = selectedClient?.user_id === client.user_id;
                  return (
                    <button
                      key={client.user_id}
                      onClick={() => {
                        setSelectedClient(client);
                        setStep('amount');
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-2xl border transition-all duration-150 active:scale-[0.98]',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-card',
                      )}
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                      )}>
                        {client.first_name?.[0]}{client.last_name?.[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        {client.phone && (
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                        )}
                        {client.company_name && (
                          <p className="text-xs text-muted-foreground truncate">{client.company_name}</p>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucun client trouvé</p>
                </div>
              )}
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 2: Amount Entry                               │
      // └─────────────────────────────────────────────────────┘
      case 'amount':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Montant du dépôt</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pour {selectedClient?.first_name} {selectedClient?.last_name}
              </p>
            </div>

            {/* Hero amount input */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="relative w-full">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount ? parseInt(amount).toLocaleString('fr-FR') : ''}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  className="text-5xl font-bold text-center bg-transparent w-full focus:outline-none tracking-tight"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
              <span className="text-lg text-muted-foreground mt-2 font-medium">XAF</span>

              {/* Live formatted preview */}
              {amountNum > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  {formatCurrency(amountNum)}
                </p>
              )}
            </div>

            {/* Quick presets */}
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wider">
                Montants rapides
              </p>
              <div className="grid grid-cols-4 gap-2">
                {AMOUNT_PRESETS.map((preset) => {
                  const isActive = amount === preset.toString();
                  return (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset.toString())}
                      className={cn(
                        'h-12 rounded-2xl font-semibold text-sm transition-all duration-150 active:scale-[0.96]',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-foreground hover:bg-muted',
                      )}
                    >
                      {preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Continue */}
            <div className="px-4 pb-6">
              <button
                onClick={() => setStep('method')}
                disabled={!amount || amountNum < 1000}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold disabled:opacity-40 active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                Continuer
              </button>
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 3: Method Family                              │
      // └─────────────────────────────────────────────────────┘
      case 'method':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Méthode de dépôt</h2>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrency(amountNum)}</p>
            </div>

            {exceedsLimit && (
              <div className="mx-4 mb-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  Le montant dépasse la limite mobile money de{' '}
                  {formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)} par transaction.
                </p>
              </div>
            )}

            <div className="flex-1 px-4 space-y-3 pb-4">
              {methodFamilies.map((family) => {
                const Icon = METHOD_ICONS[family.icon] || Building2;
                return (
                  <button
                    key={family.family}
                    onClick={() => handleFamilySelected(family.family)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-all duration-150"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold">{family.label}</p>
                      <p className="text-sm text-muted-foreground">{family.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 4: Sub-method                                 │
      // └─────────────────────────────────────────────────────┘
      case 'submethod': {
        const subMethodsList = selectedFamily ? getSubMethodsForFamily(selectedFamily) : [];
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Type de dépôt</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {methodFamilies.find((f) => f.family === selectedFamily)?.label}
              </p>
            </div>

            <div className="flex-1 px-4 space-y-3 pb-4">
              {subMethodsList.map((sub) => (
                <button
                  key={sub.subMethod}
                  onClick={() => handleSubMethodSelected(sub.subMethod)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-all duration-150"
                >
                  <div className="flex-1 text-left">
                    <p className="font-semibold">{sub.label}</p>
                    <p className="text-sm text-muted-foreground">{sub.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      }

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 5: Bank Selection                             │
      // └─────────────────────────────────────────────────────┘
      case 'bank':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Sélectionner la banque</h2>
              <p className="text-sm text-muted-foreground mt-1">Banque utilisée pour le dépôt</p>
            </div>

            <div className="flex-1 px-4 space-y-3 pb-4">
              {banks.map((bank) => (
                <button
                  key={bank.bank}
                  onClick={() => {
                    setSelectedBank(bank.bank);
                    setStep('proofs');
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-all duration-150"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold">{bank.label}</p>
                    <p className="text-xs text-muted-foreground font-mono tracking-tight truncate">
                      {bank.bonziniAccount.accountNumber}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 6: Agency Selection                           │
      // └─────────────────────────────────────────────────────┘
      case 'agency':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Sélectionner l'agence</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Agence Bonzini où le dépôt sera effectué
              </p>
            </div>

            <div className="flex-1 px-4 space-y-3 pb-4">
              {agencies.map((agency) => (
                <button
                  key={agency.agency}
                  onClick={() => {
                    setSelectedAgency(agency.agency);
                    setStep('proofs');
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-all duration-150"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Store className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold">{agency.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{agency.address}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">{agency.hours}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 7: Proof Upload                               │
      // └─────────────────────────────────────────────────────┘
      case 'proofs':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Preuves de dépôt</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ajoutez les justificatifs (optionnel)
              </p>
            </div>

            <div className="flex-1 px-4">
              {/* File upload area */}
              <label className="block w-full border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-primary/40 transition-colors bg-muted/30">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-1">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Ajouter des photos ou PDFs</p>
                  <p className="text-xs text-muted-foreground">Maximum 5 fichiers</p>
                </div>
              </label>

              {/* File previews */}
              {proofFiles.length > 0 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                  {proofFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 rounded-2xl overflow-hidden bg-muted border border-border flex-shrink-0"
                    >
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preuve ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
                            {file.name}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Admin comment */}
              <div className="mt-5">
                <label className="text-sm font-semibold mb-2 block">Commentaire interne</label>
                <textarea
                  placeholder="Note pour l'équipe (optionnel)"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full h-24 p-3.5 rounded-2xl border border-border bg-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-6 pt-4 space-y-2.5">
              <button
                onClick={() => setStep('summary')}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                Voir le récapitulatif
              </button>
              {proofFiles.length === 0 && (
                <button
                  onClick={() => setStep('summary')}
                  className="w-full h-11 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Passer sans preuve
                </button>
              )}
            </div>
          </div>
        );

      // ┌─────────────────────────────────────────────────────┐
      // │  STEP 8: Summary                                    │
      // └─────────────────────────────────────────────────────┘
      case 'summary':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Récapitulatif</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vérifiez les informations avant de créer
              </p>
            </div>

            <div className="flex-1 px-4 space-y-3 pb-4">
              {/* Amount hero */}
              <div className="relative overflow-hidden rounded-2xl p-5 border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <div className="relative z-10">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Montant</p>
                  <p className="amount-hero text-primary">{formatXAF(amountNum)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">XAF</p>
                </div>
                <Sparkles className="absolute top-4 right-4 w-5 h-5 text-primary/20" />
              </div>

              {/* Client card */}
              <div className="rounded-2xl p-4 border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {selectedClient?.first_name?.[0]}{selectedClient?.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Client</p>
                    <p className="font-semibold truncate">
                      {selectedClient?.first_name} {selectedClient?.last_name}
                    </p>
                    {selectedClient?.phone && (
                      <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Method card */}
              <div className="rounded-2xl p-4 border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Méthode</p>
                    <p className="font-semibold truncate">{getMethodLabel()}</p>
                  </div>
                </div>
              </div>

              {/* Proofs card */}
              {proofFiles.length > 0 && (
                <div className="rounded-2xl p-4 border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Preuves</p>
                      <p className="font-semibold">{proofFiles.length} fichier{proofFiles.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Proof thumbnails */}
                  <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                    {proofFiles.map((file, i) => (
                      <div key={i} className="w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border flex-shrink-0">
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment card */}
              {adminComment && (
                <div className="rounded-2xl p-4 border border-border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Commentaire</p>
                      <p className="text-sm leading-relaxed">{adminComment}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit CTA */}
            <div className="px-4 pb-6 pt-2">
              <button
                onClick={handleSubmit}
                disabled={createDeposit.isPending}
                className={cn(
                  'w-full h-14 rounded-2xl font-semibold flex items-center justify-center gap-2.5 transition-all duration-150 shadow-sm',
                  createDeposit.isPending
                    ? 'bg-primary/70 text-primary-foreground'
                    : 'bg-primary text-primary-foreground active:scale-[0.98]',
                )}
              >
                {createDeposit.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Créer le dépôt
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Nouveau dépôt"
        showBack
        onBack={canGoBack ? handleBack : undefined}
        backTo={backToPath}
      />

      {/* Progress bar */}
      <div className="h-1.5 bg-muted/50">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {/* Context banner — selected client + amount */}
      {selectedClient && step !== 'client' && (
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium">
              {selectedClient.first_name} {selectedClient.last_name}
            </span>
            {amount && step !== 'amount' && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <div className="flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(amountNum)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {renderStep()}

      {/* Back button for selection steps (method, submethod, bank, agency) */}
      {canGoBack && step !== 'amount' && step !== 'proofs' && step !== 'summary' && step !== 'client' && (
        <div className="px-4 pb-6">
          <button
            onClick={handleBack}
            className="w-full h-12 rounded-2xl border border-border font-medium active:scale-[0.98] transition-all duration-150"
          >
            Retour
          </button>
        </div>
      )}
    </div>
  );
}
