import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAllClients, useAdminCreateDeposit } from '@/hooks/useAdminCreateDeposit';
import { DepositMethod } from '@/hooks/useDeposits';
import {
  methodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
} from '@/data/depositMethodsData';
import {
  DepositMethodFamily,
  DepositSubMethod,
  BankOption,
  AgencyOption,
} from '@/types/deposit';
import { formatCurrency } from '@/lib/formatters';
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
  Calendar,
  User,
} from 'lucide-react';

type Step = 'client' | 'amount' | 'method' | 'submethod' | 'bank' | 'agency' | 'proofs' | 'summary';

const AMOUNT_PRESETS = [100000, 500000, 1000000, 2000000];

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Store,
  Smartphone,
  Waves,
};

export function MobileNewDeposit() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  // Form state
  const [step, setStep] = useState<Step>('client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 20);

    const search = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
          c.phone?.includes(search)
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  // Get deposit method for DB
  const getDepositMethod = (): DepositMethod => {
    if (selectedFamily === 'BANK') {
      return selectedSubMethod === 'BANK_TRANSFER' ? 'bank_transfer' : 'bank_cash';
    }
    if (selectedFamily === 'ORANGE_MONEY') {
      return selectedSubMethod === 'OM_TRANSFER' ? 'om_transfer' : 'om_withdrawal';
    }
    if (selectedFamily === 'MTN_MONEY') {
      return selectedSubMethod === 'MTN_TRANSFER' ? 'mtn_transfer' : 'mtn_withdrawal';
    }
    if (selectedFamily === 'AGENCY_BONZINI') return 'agency_cash';
    if (selectedFamily === 'WAVE') return 'wave';
    return 'bank_transfer';
  };

  // Progress percentage
  const getProgress = () => {
    const steps: Step[] = ['client', 'amount', 'method', 'submethod', 'bank', 'agency', 'proofs', 'summary'];
    const index = steps.indexOf(step);
    return ((index + 1) / steps.length) * 100;
  };

  // Handle family selection
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

  // Handle sub-method selection
  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);

    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else {
      setStep('proofs');
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProofFiles((prev) => [...prev, ...files].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedClient || !amount || !selectedFamily) {
      toast.error('Informations manquantes');
      return;
    }

    try {
      await createDeposit.mutateAsync({
        userId: selectedClient.user_id,
        amountXaf: parseInt(amount),
        method: getDepositMethod(),
        depositDate: new Date(),
        bankName: selectedBank?.label,
        agencyName: selectedAgency?.label,
        proofFiles,
        adminComment: adminComment || undefined,
      });
      toast.success('Dépôt créé avec succès');
      navigate('/m/deposits');
    } catch {
      // Error handled by mutation
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'client':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Sélectionner un client</h2>
              <p className="text-sm text-muted-foreground">Choisissez le client pour ce dépôt</p>
            </div>

            <div className="px-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou téléphone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted border-0 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2">
              {clientsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.user_id}
                    onClick={() => {
                      setSelectedClient(client);
                      setStep('amount');
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98]",
                      selectedClient?.user_id === client.user_id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {client.first_name?.[0]}
                      {client.last_name?.[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">
                        {client.first_name} {client.last_name}
                      </p>
                      {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>
        );

      case 'amount':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Montant du dépôt</h2>
              <p className="text-sm text-muted-foreground">
                Pour {selectedClient?.first_name} {selectedClient?.last_name}
              </p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount ? parseInt(amount).toLocaleString('fr-FR') : ''}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                className="text-5xl font-bold text-center bg-transparent w-full focus:outline-none"
              />
              <span className="text-xl text-muted-foreground mt-2">XAF</span>
            </div>

            <div className="px-4 pb-6">
              <p className="text-xs text-muted-foreground text-center mb-3">Montants rapides</p>
              <div className="grid grid-cols-4 gap-2">
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={cn(
                      "h-12 rounded-xl font-medium transition-colors",
                      amount === preset.toString()
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}K`}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-6">
              <button
                onClick={() => setStep('method')}
                disabled={!amount || parseInt(amount) < 1000}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                Continuer
              </button>
            </div>
          </div>
        );

      case 'method':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Méthode de dépôt</h2>
              <p className="text-sm text-muted-foreground">{formatCurrency(parseInt(amount))}</p>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {methodFamilies.map((family) => {
                const Icon = METHOD_ICONS[family.icon] || Building2;
                return (
                  <button
                    key={family.family}
                    onClick={() => handleFamilySelected(family.family)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{family.label}</p>
                      <p className="text-sm text-muted-foreground">{family.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'submethod':
        const subMethods = selectedFamily ? getSubMethodsForFamily(selectedFamily) : [];
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Type de dépôt</h2>
              <p className="text-sm text-muted-foreground">
                {methodFamilies.find((f) => f.family === selectedFamily)?.label}
              </p>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {subMethods.map((sub) => (
                <button
                  key={sub.subMethod}
                  onClick={() => handleSubMethodSelected(sub.subMethod)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform"
                >
                  <div className="flex-1 text-left">
                    <p className="font-medium">{sub.label}</p>
                    <p className="text-sm text-muted-foreground">{sub.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        );

      case 'bank':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Sélectionner la banque</h2>
              <p className="text-sm text-muted-foreground">Banque utilisée pour le dépôt</p>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {banks.map((bank) => (
                <button
                  key={bank.bank}
                  onClick={() => {
                    setSelectedBank(bank.bank as BankOption);
                    setStep('proofs');
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{bank.label}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        );

      case 'agency':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Sélectionner l'agence</h2>
              <p className="text-sm text-muted-foreground">Agence Bonzini où le dépôt sera effectué</p>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {agencies.map((agency) => (
                <button
                  key={agency.agency}
                  onClick={() => {
                    setSelectedAgency(agency.agency as AgencyOption);
                    setStep('proofs');
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Store className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{agency.label}</p>
                    <p className="text-xs text-muted-foreground">{agency.address}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        );

      case 'proofs':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Preuves de dépôt</h2>
              <p className="text-sm text-muted-foreground">Ajoutez les justificatifs (optionnel)</p>
            </div>

            <div className="flex-1 px-4">
              {/* File upload area */}
              <label className="block w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Ajouter des photos</p>
                </div>
              </label>

              {/* File previews */}
              {proofFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {proofFiles.map((file, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Proof ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment */}
              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">Commentaire interne</label>
                <textarea
                  placeholder="Note pour l'équipe (optionnel)"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full h-24 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-4 pb-6 pt-4">
              <button
                onClick={() => setStep('summary')}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
              >
                Voir le récapitulatif
              </button>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Récapitulatif</h2>
              <p className="text-sm text-muted-foreground">Vérifiez les informations avant de créer</p>
            </div>

            <div className="flex-1 px-4 space-y-4">
              {/* Client */}
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Client</p>
                <p className="font-medium">
                  {selectedClient?.first_name} {selectedClient?.last_name}
                </p>
              </div>

              {/* Amount */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Montant</p>
                <p className="text-2xl font-bold">{formatCurrency(parseInt(amount))}</p>
              </div>

              {/* Method */}
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Méthode</p>
                <p className="font-medium">
                  {methodFamilies.find((f) => f.family === selectedFamily)?.label}
                  {selectedBank && ` - ${banks.find((b) => b.bank === selectedBank)?.label}`}
                  {selectedAgency && ` - ${agencies.find((a) => a.agency === selectedAgency)?.label}`}
                </p>
              </div>

              {/* Proofs count */}
              {proofFiles.length > 0 && (
                <div className="bg-card rounded-xl p-4 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Preuves</p>
                  <p className="font-medium">{proofFiles.length} fichier(s) joint(s)</p>
                </div>
              )}
            </div>

            <div className="px-4 pb-6 pt-4">
              <button
                onClick={handleSubmit}
                disabled={createDeposit.isPending}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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

  const canGoBack = step !== 'client';
  const handleBack = () => {
    const stepOrder: Step[] = ['client', 'amount', 'method', 'submethod', 'bank', 'agency', 'proofs', 'summary'];
    const currentIndex = stepOrder.indexOf(step);

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
    } else if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Nouveau dépôt"
        showBack
        onBack={canGoBack ? handleBack : undefined}
        backTo="/m/deposits"
      />

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {/* Selected client indicator */}
      {selectedClient && step !== 'client' && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              {selectedClient.first_name} {selectedClient.last_name}
            </span>
            {amount && step !== 'amount' && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-primary">
                  {formatCurrency(parseInt(amount))}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {renderStep()}

      {/* Back button for steps that need it */}
      {canGoBack && step !== 'amount' && step !== 'proofs' && step !== 'summary' && (
        <div className="px-4 pb-6">
          <button
            onClick={handleBack}
            className="w-full h-12 rounded-xl border border-border font-medium active:scale-[0.98] transition-transform"
          >
            Retour
          </button>
        </div>
      )}
    </div>
  );
}
