// ============================================================
// MODULE DEPOTS V2 — MobileNewDepositV2
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · header fixe + barre de progression · contenu
//   scrollable · footer CTA toujours visible · cartes à ombre douce ·
//   FormField/TextInput · Amount · écran succès en Holder.
// Logique 100% préservée : assistant client→montant→famille→
//   submethod→banque→agence→récap→création, useCountUp, copie
//   coordonnées, upload preuves, écran succès, validations.
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAllClients, useAdminCreateDeposit } from '@/hooks/useAdminDeposits';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency } from '@/lib/formatters';
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
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
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
import {
  SURFACE,
  TEXT,
  Card,
  Holder,
  Amount,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';

// ── Familles couleurs (identité de marque conservée) ─────────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean; name: string }> = {
  BANK: { letter: 'B', bg: '#1e3a5f', name: 'Banque' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE', name: 'Agence Bonzini' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600', name: 'Orange Money' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true, name: 'MTN MoMo' },
  WAVE: { letter: 'W', bg: '#1dc3e3', name: 'Wave' },
};

// Vert d'action = marque Dépôts (cohérent liste/détail).
const GREEN = '#10B981';

// ── Types ──────────────────────────────────────────────────
type Step = 'client' | 'amount' | 'family' | 'submethod' | 'bank' | 'agency' | 'recap' | 'creating';

// Nombre total d'étapes selon la famille
function getTotalSteps(family: DepositMethodFamily | null): number {
  if (!family || family === 'WAVE') return 4;
  if (family === 'AGENCY_BONZINI') return 5;
  if (family === 'BANK') return 6;
  return 5; // ORANGE_MONEY, MTN_MONEY
}

// Numéro d'étape actuelle (1-based)
function getStepNumber(step: Step, family: DepositMethodFamily | null): number {
  switch (step) {
    case 'client': return 1;
    case 'amount': return 2;
    case 'family': return 3;
    case 'submethod': return 4;
    case 'agency': return 4;
    case 'bank': return family === 'BANK' ? 5 : 4;
    case 'recap': return getTotalSteps(family);
    case 'creating': return getTotalSteps(family);
    default: return 1;
  }
}

// ── Bouton copie (logique conservée, habillage kit) ──────────
function CopyBtn({ text, fieldKey, copiedField, onCopy }: {
  text: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const copied = copiedField === fieldKey;
  return (
    <button
      onClick={() => onCopy(text, fieldKey)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition active:scale-95',
        copied
          ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
          : 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]',
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

// ── Composant principal ──────────────────────────────────────
export function MobileNewDepositV2() {
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

  // Écran succès V2
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdDepositId, setCreatedDepositId] = useState<string | null>(null);

  const amountNum = parseInt(amount) || 0;
  const animatedAmount = useCountUp(amountNum, { enabled: amountNum > 0 });

  const totalSteps = getTotalSteps(selectedFamily);
  const currentStepNum = getStepNumber(step, selectedFamily);

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
        if (familyRequiresSubMethod(selectedFamily!)) goTo('submethod', 'back');
        else goTo('family', 'back');
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
    setProofFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) => setProofFiles((prev) => prev.filter((_, idx) => idx !== i));

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
        bank_name: selectedBank ? banks.find((b) => b.bank === selectedBank)?.label : undefined,
        agency_name: selectedAgency ? agencies.find((a) => a.agency === selectedAgency)?.label : undefined,
        admin_comment: adminComment || undefined,
        proofFiles: proofFiles.length > 0 ? proofFiles : undefined,
      });
      // V2 : afficher l'écran succès avant navigation
      setCreatedDepositId(result.id);
      setIsSuccess(true);
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

  // ── Formatage montant ────────────────────────────────────
  function fmt(n: number) {
    return Math.abs(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Classe partagée pour une ligne label/valeur (sans filet, façon Row).
  const infoLineCls = 'flex items-center justify-between gap-3 py-[7px]';

  // ── Écran succès V2 ──────────────────────────────────────
  if (isSuccess) {
    const familyName = selectedFamily ? FAMILIES_CONF[selectedFamily]?.name || selectedFamily : '';
    return (
      <div className={cn('mx-auto flex h-[100dvh] max-w-[480px] flex-col items-center justify-center px-6 text-center', SURFACE.canvas)}>
        <Holder icon={Check} tone="success" size="lg" className="mb-4" />
        <div className={cn('text-[20px] font-extrabold', TEXT.strong)}>Dépôt créé</div>
        <div className="mt-1.5">
          <Amount value={fmt(amountNum)} unit="XAF" size="lg" />
        </div>
        <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
          pour {selectedClient?.first_name} {selectedClient?.last_name} via {familyName}
        </div>
        <div className={cn('mt-2 max-w-xs text-[12px] leading-relaxed', TEXT.muted)}>
          Le client peut maintenant ajouter ses preuves de dépôt depuis son application.
        </div>
        <div className="mt-7 flex w-full gap-2.5">
          <SoftPill onClick={() => navigate('/m/deposits')} className="flex-1">
            Retour
          </SoftPill>
          <PrimaryPill
            onClick={() => createdDepositId && navigate(`/m/deposits/${createdDepositId}`)}
            className="flex-1 bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
          >
            Voir la fiche
          </PrimaryPill>
        </div>
      </div>
    );
  }

  // ── Layout principal ─────────────────────────────────────
  return (
    <div className={cn('mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden', SURFACE.canvas)}>
      {/* ── Header + barre de progression ─────────────────── */}
      <div className={cn('shrink-0 px-5 pt-[env(safe-area-inset-top)]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex h-14 items-center gap-2">
          {step !== 'creating' && (
            <button
              onClick={handleHeaderBack}
              aria-label="Retour"
              className={cn('-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95', TEXT.muted)}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <span className={cn('flex-1 text-[15px] font-bold', TEXT.strong)}>Nouveau dépôt</span>
          {step !== 'creating' && (
            <span className="text-[12px] font-bold" style={{ color: GREEN }}>
              {currentStepNum}/{totalSteps}
            </span>
          )}
        </div>
        {step !== 'creating' && (
          <div className="flex gap-1 pb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full transition-colors"
                style={{ background: currentStepNum >= i + 1 ? GREEN : 'rgba(0,0,0,0.08)' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Contenu ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Étape 1 — Client */}
        {step === 'client' && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Quel client ?</div>
            <div className="relative mb-3">
              <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
              <input
                className={cn('h-12 w-full rounded-2xl pl-10 pr-10 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
                placeholder="Nom ou téléphone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                autoFocus
              />
              {clientSearch && (
                <button
                  onClick={() => setClientSearch('')}
                  aria-label="Effacer"
                  className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {clientsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: GREEN }} />
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="space-y-2.5">
                {filteredClients.map((client) => {
                  const isSelected = selectedClient?.user_id === client.user_id;
                  return (
                    <button
                      key={client.user_id}
                      onClick={() => { setSelectedClient(client); goTo('amount'); }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                        SURFACE.card,
                        SURFACE.shadow,
                        isSelected && 'ring-2',
                      )}
                      style={isSelected ? { boxShadow: `0 0 0 2px ${GREEN}` } : undefined}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                        style={{ background: `${FAMILIES_CONF.AGENCY_BONZINI.bg}14`, color: FAMILIES_CONF.AGENCY_BONZINI.bg }}
                      >
                        {client.first_name?.[0]}{client.last_name?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn('truncate text-[14px] font-bold', TEXT.strong)}>
                          {client.first_name} {client.last_name}
                        </div>
                        {client.phone && <div className={cn('truncate text-[11px]', TEXT.muted)}>{client.phone}</div>}
                      </div>
                      <ArrowRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10">
                <Holder icon={User} size="lg" />
                <p className={cn('mt-3 text-[13px]', TEXT.muted)}>Aucun client trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Étape 2 — Montant */}
        {step === 'amount' && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Combien ?</div>
            <Card className="mb-3.5 py-6 text-center">
              <div className="flex items-baseline justify-center gap-2">
                <input
                  className={cn('w-[65%] border-none bg-transparent text-right text-[44px] font-black tracking-tight outline-none', TEXT.strong)}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  type="tel"
                  autoFocus
                />
                <span className={cn('text-[20px] font-bold', TEXT.muted)}>XAF</span>
              </div>
              {amountNum > 0 && (
                <div className={cn('mt-1.5 text-[14px] tabular-nums', TEXT.muted)}>{fmt(animatedAmount)} XAF</div>
              )}
            </Card>
            <div className="flex gap-2">
              {[100000, 500000, 1000000, 2000000].map((preset) => {
                const active = amountNum === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={cn(
                      'flex-1 rounded-xl py-2.5 text-[12px] font-bold transition active:scale-95',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={active ? { boxShadow: `0 0 0 2px ${GREEN}`, color: GREEN } : undefined}
                  >
                    {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}K`}
                  </button>
                );
              })}
            </div>
            {amountNum > MOBILE_MONEY_TRANSACTION_LIMIT && (
              <div className="mt-3 flex items-start gap-2 rounded-r-2xl border-l-4 border-[#F3A745] bg-[#F8EFD8] p-3 dark:bg-[#372D14]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
                <p className="text-[11px] text-[#9A6B12] dark:text-[#E7C083]">
                  Le montant dépasse la limite mobile money ({formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)})
                </p>
              </div>
            )}
          </div>
        )}

        {/* Étape 3 — Famille */}
        {step === 'family' && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Comment ?</div>
            <div className="space-y-2.5">
              {methodFamilies.map((family) => {
                const isSelected = selectedFamily === family.family;
                const conf = FAMILIES_CONF[family.family];
                const color = conf?.bg || FAMILIES_CONF.AGENCY_BONZINI.bg;

                return (
                  <button
                    key={family.family}
                    onClick={() => handleFamilySelected(family.family)}
                    className={cn(
                      'flex w-full items-center gap-3.5 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[18px] font-extrabold"
                      style={{ background: conf?.bg || color, color: conf?.dark ? '#1a1028' : '#fff' }}
                    >
                      {conf?.letter || family.family[0]}
                    </div>
                    <div className="flex-1">
                      <div className={cn('text-[15px] font-bold', TEXT.strong)}>{family.label}</div>
                      <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{family.description}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0" style={{ color }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 4 — Sous-méthode */}
        {step === 'submethod' && selectedFamily && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Type d'opération</div>
            <div className="space-y-2.5">
              {getSubMethodsForFamily(selectedFamily).map((subMethod) => {
                const conf = FAMILIES_CONF[selectedFamily];
                const color = conf?.bg || FAMILIES_CONF.AGENCY_BONZINI.bg;
                const isSelected = selectedSubMethod === subMethod.subMethod;
                return (
                  <button
                    key={subMethod.subMethod}
                    onClick={() => handleSubMethodSelected(subMethod.subMethod)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                  >
                    <div className="flex-1">
                      <div className={cn('text-[14px] font-bold', TEXT.strong)}>{subMethod.label}</div>
                      <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{subMethod.description}</div>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0" style={{ color }} />
                    ) : (
                      <ArrowRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape banque */}
        {step === 'bank' && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Quelle banque ?</div>
            <div className="space-y-2.5">
              {banks.map((bank) => {
                const isSelected = selectedBank === bank.bank;
                const color = FAMILIES_CONF.BANK.bg;
                return (
                  <button
                    key={bank.bank}
                    onClick={() => handleBankSelected(bank.bank)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${color}14` }}
                    >
                      <Building2 className="h-[18px] w-[18px]" style={{ color }} />
                    </div>
                    <span className={cn('flex-1 text-[14px] font-bold', TEXT.strong)}>{bank.label}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0" style={{ color }} />
                    ) : (
                      <ArrowRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape agence */}
        {step === 'agency' && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Quelle agence ?</div>
            <div className="space-y-2.5">
              {agencies.map((agency) => {
                const isSelected = selectedAgency === agency.agency;
                const color = FAMILIES_CONF.AGENCY_BONZINI.bg;
                return (
                  <button
                    key={agency.agency}
                    onClick={() => handleAgencySelected(agency.agency)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${color}14` }}
                    >
                      <MapPin className="h-[18px] w-[18px]" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[14px] font-bold', TEXT.strong)}>{agency.label}</div>
                      <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{agency.address}</div>
                      <div className={cn('mt-0.5 flex items-center gap-1 text-[10px]', TEXT.muted)}>
                        <Clock className="h-2.5 w-2.5" />
                        {agency.hours}
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0" style={{ color }} />
                    ) : (
                      <ArrowRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape récap */}
        {step === 'recap' && (() => {
          const info = getRecapInfo();
          if (!info) return null;
          return (
            <div className="space-y-2.5 pb-4">
              <div className={cn('text-[22px] font-extrabold', TEXT.strong)}>Tout est bon ?</div>

              {/* Montant centré */}
              <Card className="py-5 text-center">
                <Amount value={fmt(amountNum)} unit="XAF" size="xl" />
              </Card>

              {/* Résumé */}
              <Card>
                {[
                  { l: 'Client', v: `${selectedClient?.first_name} ${selectedClient?.last_name}` },
                  { l: 'Méthode', v: info.title },
                  selectedBank
                    ? { l: 'Banque', v: banks.find((b) => b.bank === selectedBank)?.label || selectedBank }
                    : null,
                  selectedAgency
                    ? { l: 'Agence', v: agencies.find((a) => a.agency === selectedAgency)?.label || selectedAgency }
                    : null,
                ]
                  .filter(Boolean)
                  .map((r, i) => (
                    <div key={i} className={infoLineCls}>
                      <span className={cn('text-[13px]', TEXT.muted)}>{r!.l}</span>
                      <span className={cn('text-right text-[13px] font-semibold', TEXT.strong)}>{r!.v}</span>
                    </div>
                  ))}
              </Card>

              {/* Coordonnées */}
              <Card>
                <div className={cn('mb-2 flex items-center gap-1.5 text-[12px] font-bold', TEXT.strong)}>
                  <Info className="h-3.5 w-3.5" style={{ color: GREEN }} />
                  Coordonnées à communiquer
                </div>
                {info.fields.map((field) => (
                  <div key={field.key} className={infoLineCls}>
                    <span className={cn('text-[11px]', TEXT.muted)}>{field.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[11px] font-bold', TEXT.strong, field.mono && 'font-mono')}>
                        {field.value}
                      </span>
                      <CopyBtn text={field.value} fieldKey={field.key} copiedField={copiedField} onCopy={handleCopy} />
                    </div>
                  </div>
                ))}

                {/* Code marchand */}
                {info.merchantCode && (
                  <div className="mt-1 border-t border-black/[0.06] pt-2 dark:border-white/[0.06]">
                    <span className={cn('mb-1.5 block text-[11px]', TEXT.muted)}>Code Marchand</span>
                    <div className={cn('flex items-center justify-between gap-2 rounded-xl p-2.5', SURFACE.canvas)}>
                      <span className={cn('flex-1 break-all font-mono text-[11px] font-bold', TEXT.strong)}>
                        {info.merchantCode}
                      </span>
                      <CopyBtn text={info.merchantCode} fieldKey="merchant" copiedField={copiedField} onCopy={handleCopy} />
                    </div>
                  </div>
                )}

                {/* Montant */}
                <div className={cn(infoLineCls, 'mt-1 border-t border-black/[0.06] dark:border-white/[0.06]')}>
                  <span className={cn('text-[11px]', TEXT.muted)}>Montant à envoyer</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold" style={{ color: GREEN }}>{fmt(amountNum)} XAF</span>
                    <CopyBtn text={`${fmt(amountNum)} XAF`} fieldKey="amount" copiedField={copiedField} onCopy={handleCopy} />
                  </div>
                </div>
              </Card>

              {/* Instructions */}
              <Card>
                <div className={cn('mb-2 text-[12px] font-bold', TEXT.strong)}>Instructions</div>
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {info.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: `${GREEN}1A`, color: GREEN }}
                      >
                        {index + 1}
                      </span>
                      <span className={cn('pt-0.5 text-[12px]', TEXT.muted)}>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              {/* Upload preuves optionnel */}
              <Card>
                <div className={cn('mb-2.5 text-[12px] font-bold', TEXT.strong)}>Preuves (optionnel)</div>
                <label className="block w-full cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-black/10 p-5 dark:border-white/10">
                    <Upload className={cn('h-5 w-5', TEXT.muted)} />
                    <p className={cn('text-[11px]', TEXT.muted)}>Photos ou PDFs</p>
                  </div>
                </label>
                {proofFiles.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {proofFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className={cn('relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/[0.06] dark:ring-white/[0.06]', SURFACE.canvas)}
                      >
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <FileText className={cn('h-4 w-4', TEXT.muted)} />
                            <span className={cn('max-w-[50px] overflow-hidden text-center text-[8px]', TEXT.muted)}>{file.name}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(idx)}
                          aria-label="Retirer"
                          className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60"
                        >
                          <X className="h-2 w-2 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Commentaire admin optionnel */}
              <Card>
                <div className={cn('mb-2 text-[12px] font-bold', TEXT.strong)}>Commentaire admin (optionnel)</div>
                <textarea
                  placeholder="Note interne..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  rows={3}
                  className={cn('w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
                />
              </Card>

              {/* Note de confirmation */}
              <div className="rounded-2xl bg-[#DEEFE5] px-3.5 py-3 text-[12px] leading-relaxed text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]">
                Le dépôt sera créé pour le client.{' '}
                {proofFiles.length > 0
                  ? 'Les preuves seront téléchargées et le statut avancé à "Preuve envoyée".'
                  : 'Le client pourra ensuite ajouter ses preuves.'}
              </div>
            </div>
          );
        })()}

        {/* Écran creating */}
        {step === 'creating' && (
          <div className="flex flex-col items-center justify-center py-20">
            <Holder icon={Loader2} tone="success" size="lg" className="mb-5 [&_svg]:animate-spin" />
            <p className={cn('text-[15px] font-bold', TEXT.strong)}>Création du dépôt...</p>
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>Un instant</p>
          </div>
        )}
      </div>

      {/* ── Footer boutons (toujours visibles) ────────────── */}
      {step !== 'creating' && (
        <div className={cn('flex shrink-0 gap-2.5 px-5 pb-[calc(1.125rem+env(safe-area-inset-bottom))] pt-3', SURFACE.card, SURFACE.shadow)}>
          {step !== 'client' && (
            <SoftPill onClick={handleHeaderBack} className="flex-1">
              Retour
            </SoftPill>
          )}
          {step === 'recap' && (
            <PrimaryPill
              onClick={doCreateDeposit}
              loading={createDeposit.isPending}
              className="flex-[1.4] bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
            >
              <ShieldCheck className="h-[18px] w-[18px]" />
              Confirmer le dépôt
            </PrimaryPill>
          )}
          {step === 'client' && selectedClient && (
            <PrimaryPill
              onClick={() => goTo('amount')}
              className="flex-1 bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
            >
              Suivant
            </PrimaryPill>
          )}
          {step === 'amount' && (
            <PrimaryPill
              onClick={() => amountNum >= 1000 && goTo('family')}
              disabled={amountNum < 1000}
              className={cn('flex-[1.4]', amountNum >= 1000 && 'bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white')}
            >
              Suivant
            </PrimaryPill>
          )}
        </div>
      )}
    </div>
  );
}
