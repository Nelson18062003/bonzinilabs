// ============================================================
// MODULE DEPOTS V2 — MobileNewDepositV2
// UI selon maquette v3 : barre de progression step-by-step,
// écran succès avant navigation vers la fiche.
// Logique 100% identique à MobileNewDeposit.tsx
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

// ── Couleurs maquette ────────────────────────────────────────
const GR = '#34d399';
const V = '#A947FE';
const t = {
  bg: '#f5f3f7',
  card: '#ffffff',
  text: '#1a1028',
  sub: '#7a7290',
  dim: '#c4bdd0',
  border: '#ebe6f0',
};

// ── Familles couleurs ────────────────────────────────────────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean; name: string }> = {
  BANK: { letter: 'B', bg: '#1e3a5f', name: 'Banque' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE', name: 'Agence Bonzini' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600', name: 'Orange Money' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true, name: 'MTN MoMo' },
  WAVE: { letter: 'W', bg: '#1dc3e3', name: 'Wave' },
};

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

// ── Bouton copie ─────────────────────────────────────────────
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 8px',
        borderRadius: 5,
        background: copied ? `${GR}15` : t.bg,
        border: `1px solid ${copied ? GR : t.border}`,
        fontSize: 10,
        fontWeight: 700,
        color: copied ? GR : t.sub,
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
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
      .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  // ── Écran succès V2 ──────────────────────────────────────
  if (isSuccess) {
    const familyName = selectedFamily ? FAMILIES_CONF[selectedFamily]?.name || selectedFamily : '';
    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: t.bg,
          maxWidth: 480,
          margin: '0 auto',
          fontFamily: "'DM Sans', sans-serif",
          padding: '0 24px',
          color: t.text,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `${GR}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: GR,
            marginBottom: 16,
          }}
        >
          ✓
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Dépôt créé</div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: t.text,
            letterSpacing: '-1.5px',
            marginTop: 6,
          }}
        >
          {fmt(amountNum)} XAF
        </div>
        <div style={{ fontSize: 14, color: t.sub, marginTop: 4 }}>
          pour {selectedClient?.first_name} {selectedClient?.last_name} via {familyName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.dim,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Le client peut maintenant ajouter ses preuves de dépôt depuis son application.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 28, width: '100%' }}>
          <button
            onClick={() => navigate('/m/deposits')}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 12,
              background: 'none',
              border: `1px solid ${t.border}`,
              fontSize: 14,
              fontWeight: 700,
              color: t.sub,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Retour
          </button>
          <button
            onClick={() => createdDepositId && navigate(`/m/deposits/${createdDepositId}`)}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 12,
              background: GR,
              border: 'none',
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Voir la fiche
          </button>
        </div>
      </div>
    );
  }

  // ── Layout principal ─────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: t.bg,
        fontFamily: "'DM Sans', sans-serif",
        color: t.text,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* ── Header + barre de progression ─────────────── */}
      <div
        style={{
          flexShrink: 0,
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
          padding: '12px 20px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          {step !== 'creating' && (
            <span
              onClick={handleHeaderBack}
              style={{
                fontSize: 20,
                color: t.sub,
                cursor: 'pointer',
                marginRight: 12,
                fontWeight: 300,
              }}
            >
              ‹
            </span>
          )}
          <span style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Nouveau dépôt</span>
          {step !== 'creating' && (
            <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>
              {currentStepNum}/{totalSteps}
            </span>
          )}
        </div>
        {step !== 'creating' && (
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: currentStepNum >= i + 1 ? GR : t.border,
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Contenu ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px 20px 0' }}>
        {/* Étape 1 — Client */}
        {step === 'client' && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quel client ?</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 14px',
                height: 44,
                borderRadius: 10,
                background: t.card,
                border: `1px solid ${t.border}`,
                marginBottom: 12,
              }}
            >
              <Search style={{ width: 14, height: 14, color: t.dim }} />
              <input
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.text,
                  width: '100%',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                placeholder="Nom ou téléphone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                autoFocus
              />
              {clientSearch && (
                <button
                  onClick={() => setClientSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.dim }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
            {clientsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 style={{ width: 24, height: 24, color: GR, animation: 'spin 1s linear infinite' }} />
              </div>
            ) : filteredClients.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredClients.map((client) => (
                  <button
                    key={client.user_id}
                    onClick={() => { setSelectedClient(client); goTo('amount'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 12,
                      width: '100%',
                      background: selectedClient?.user_id === client.user_id ? `${GR}05` : t.card,
                      border: `1.5px solid ${selectedClient?.user_id === client.user_id ? GR : t.border}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: `${V}08`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                        color: V,
                        flexShrink: 0,
                      }}
                    >
                      {client.first_name?.[0]}{client.last_name?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                        {client.first_name} {client.last_name}
                      </div>
                      {client.phone && (
                        <div style={{ fontSize: 11, color: t.sub }}>{client.phone}</div>
                      )}
                    </div>
                    <ArrowRight style={{ width: 16, height: 16, color: t.dim, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                <User style={{ width: 32, height: 32, color: t.dim, marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: t.sub }}>Aucun client trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Étape 2 — Montant */}
        {step === 'amount' && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Combien ?</div>
            <div
              style={{
                padding: '24px 20px',
                borderRadius: 16,
                background: t.card,
                border: `1.5px solid ${t.border}`,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                <input
                  style={{
                    border: 'none',
                    background: 'none',
                    outline: 'none',
                    fontSize: 44,
                    fontWeight: 900,
                    color: t.text,
                    fontFamily: "'DM Sans', sans-serif",
                    width: '65%',
                    textAlign: 'right',
                    letterSpacing: '-1.5px',
                  }}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  type="tel"
                  autoFocus
                />
                <span style={{ fontSize: 20, fontWeight: 700, color: t.sub }}>XAF</span>
              </div>
              {amountNum > 0 && (
                <div style={{ fontSize: 14, color: t.sub, marginTop: 6 }}>
                  {fmt(animatedAmount)} XAF
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[100000, 500000, 1000000, 2000000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 8,
                    background: amountNum === preset ? `${GR}08` : t.card,
                    border: `1px solid ${amountNum === preset ? GR : t.border}`,
                    fontSize: 12,
                    fontWeight: 700,
                    color: amountNum === preset ? GR : t.text,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}K`}
                </button>
              ))}
            </div>
            {amountNum > MOBILE_MONEY_TRANSACTION_LIMIT && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderLeft: `4px solid #F3A745`,
                  background: `#F3A74510`,
                  borderRadius: '0 10px 10px 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14, color: '#F3A745', marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: '#b37d2a', margin: 0 }}>
                  Le montant dépasse la limite mobile money ({formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)})
                </p>
              </div>
            )}
          </div>
        )}

        {/* Étape 3 — Famille */}
        {step === 'family' && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Comment ?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {methodFamilies.map((family) => {
                const IconComponent =
                  (Icons as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[family.icon] ||
                  Icons.Banknote;
                const isSelected = selectedFamily === family.family;
                const conf = FAMILIES_CONF[family.family];
                const color = conf?.bg || V;

                return (
                  <button
                    key={family.family}
                    onClick={() => handleFamilySelected(family.family)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 16,
                      borderRadius: 14,
                      width: '100%',
                      background: isSelected ? `${color}06` : t.card,
                      border: `1.5px solid ${isSelected ? color : t.border}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: conf?.bg || V,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: conf?.dark ? '#1a1028' : '#fff',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {conf?.letter || family.family[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{family.label}</div>
                      <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{family.description}</div>
                    </div>
                    {isSelected && (
                      <span style={{ color: color, fontSize: 16, fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 4 — Sous-méthode */}
        {step === 'submethod' && selectedFamily && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Type d'opération</div>
            {getSubMethodsForFamily(selectedFamily).map((subMethod) => {
              const conf = FAMILIES_CONF[selectedFamily];
              const color = conf?.bg || V;
              const isSelected = selectedSubMethod === subMethod.subMethod;
              return (
                <button
                  key={subMethod.subMethod}
                  onClick={() => handleSubMethodSelected(subMethod.subMethod)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    width: '100%',
                    marginBottom: 6,
                    background: isSelected ? `${color}06` : t.card,
                    border: `1.5px solid ${isSelected ? color : t.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{subMethod.label}</div>
                    <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{subMethod.description}</div>
                  </div>
                  {isSelected ? (
                    <span style={{ color: color, fontSize: 16 }}>✓</span>
                  ) : (
                    <ArrowRight style={{ width: 16, height: 16, color: t.dim }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Étape banque */}
        {step === 'bank' && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quelle banque ?</div>
            {banks.map((bank) => {
              const isSelected = selectedBank === bank.bank;
              return (
                <button
                  key={bank.bank}
                  onClick={() => handleBankSelected(bank.bank)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    width: '100%',
                    marginBottom: 6,
                    background: isSelected ? `${FAMILIES_CONF.BANK.bg}06` : t.card,
                    border: `1.5px solid ${isSelected ? FAMILIES_CONF.BANK.bg : t.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#f0f0f8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Building2 style={{ width: 18, height: 18, color: FAMILIES_CONF.BANK.bg }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: 1, textAlign: 'left' }}>
                    {bank.label}
                  </span>
                  {isSelected ? (
                    <span style={{ color: FAMILIES_CONF.BANK.bg, fontSize: 16 }}>✓</span>
                  ) : (
                    <ArrowRight style={{ width: 16, height: 16, color: t.dim }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Étape agence */}
        {step === 'agency' && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quelle agence ?</div>
            {agencies.map((agency) => {
              const isSelected = selectedAgency === agency.agency;
              return (
                <button
                  key={agency.agency}
                  onClick={() => handleAgencySelected(agency.agency)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    width: '100%',
                    marginBottom: 6,
                    background: isSelected ? `${V}06` : t.card,
                    border: `1.5px solid ${isSelected ? V : t.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `${V}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MapPin style={{ width: 18, height: 18, color: V }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{agency.label}</div>
                    <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{agency.address}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: t.dim,
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock style={{ width: 10, height: 10 }} />
                      {agency.hours}
                    </div>
                  </div>
                  {isSelected ? (
                    <span style={{ color: V, fontSize: 16 }}>✓</span>
                  ) : (
                    <ArrowRight style={{ width: 16, height: 16, color: t.dim }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Étape récap */}
        {step === 'recap' && (() => {
          const info = getRecapInfo();
          if (!info) return null;
          return (
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Tout est bon ?</div>

              {/* Montant centré */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 14,
                  textAlign: 'center',
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: t.text }}>
                  {fmt(amountNum)}{' '}
                  <span style={{ fontSize: 16, fontWeight: 600, color: t.sub }}>XAF</span>
                </div>
              </div>

              {/* Résumé */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
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
                  .map((r, i, a) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '9px 0',
                        borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: t.sub }}>{r!.l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{r!.v}</span>
                    </div>
                  ))}
              </div>

              {/* Coordonnées */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info style={{ width: 14, height: 14, color: GR }} />
                  Coordonnées à communiquer
                </div>
                {info.fields.map((field, i, a) => (
                  <div
                    key={field.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 11, color: t.sub }}>{field.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: t.text,
                          fontFamily: field.mono ? 'monospace' : "'DM Sans', sans-serif",
                        }}
                      >
                        {field.value}
                      </span>
                      <CopyBtn
                        text={field.value}
                        fieldKey={field.key}
                        copiedField={copiedField}
                        onCopy={handleCopy}
                      />
                    </div>
                  </div>
                ))}

                {/* Code marchand */}
                {info.merchantCode && (
                  <div style={{ paddingTop: 8, borderTop: `1px solid ${t.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: t.sub, display: 'block', marginBottom: 6 }}>Code Marchand</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: t.bg,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: t.text,
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          flex: 1,
                        }}
                      >
                        {info.merchantCode}
                      </span>
                      <CopyBtn
                        text={info.merchantCode}
                        fieldKey="merchant"
                        copiedField={copiedField}
                        onCopy={handleCopy}
                      />
                    </div>
                  </div>
                )}

                {/* Montant */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderTop: `1px solid ${t.border}`,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: t.sub }}>Montant à envoyer</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: GR }}>
                      {fmt(amountNum)} XAF
                    </span>
                    <CopyBtn
                      text={`${fmt(amountNum)} XAF`}
                      fieldKey="amount"
                      copiedField={copiedField}
                      onCopy={handleCopy}
                    />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 8 }}>Instructions</div>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {info.instructions.map((instruction, index) => (
                    <li key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: `${GR}15`,
                          color: GR,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ fontSize: 12, color: t.sub, paddingTop: 2 }}>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Upload preuves optionnel */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 10 }}>
                  Preuves (optionnel)
                </div>
                <label style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      border: `2px dashed ${t.border}`,
                      borderRadius: 10,
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Upload style={{ width: 20, height: 20, color: t.dim }} />
                    <p style={{ fontSize: 11, color: t.sub, margin: 0 }}>Photos ou PDFs</p>
                  </div>
                </label>
                {proofFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {proofFiles.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 60,
                          height: 60,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: t.bg,
                          border: `1px solid ${t.border}`,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <FileText style={{ width: 16, height: 16, color: t.sub }} />
                            <span style={{ fontSize: 8, color: t.dim, textAlign: 'center', maxWidth: 50, overflow: 'hidden' }}>
                              {file.name}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(idx)}
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X style={{ width: 8, height: 8, color: '#fff' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Commentaire admin optionnel */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: t.card,
                  border: `1.5px solid ${t.border}`,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 8 }}>
                  Commentaire admin (optionnel)
                </div>
                <textarea
                  placeholder="Note interne..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  style={{
                    width: '100%',
                    height: 72,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.bg,
                    resize: 'none',
                    // iOS Safari auto-zooms any control with font-size < 16px on focus.
                    fontSize: 16,
                    fontFamily: "'DM Sans', sans-serif",
                    color: t.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Note de confirmation */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: `${GR}06`,
                  border: `1px solid ${GR}15`,
                  fontSize: 12,
                  color: t.sub,
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `${GR}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Loader2 style={{ width: 40, height: 40, color: GR, animation: 'spin 1s linear infinite' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Création du dépôt...</p>
            <p style={{ fontSize: 12, color: t.sub, marginTop: 4 }}>Un instant</p>
          </div>
        )}
      </div>

      {/* ── Footer boutons ────────────────────────────── */}
      {step !== 'creating' && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px 18px',
            background: t.card,
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            gap: 10,
          }}
        >
          {step !== 'client' && (
            <button
              onClick={handleHeaderBack}
              style={{
                flex: 1,
                padding: 15,
                borderRadius: 12,
                background: 'none',
                border: `1.5px solid ${t.border}`,
                fontSize: 14,
                fontWeight: 700,
                color: t.sub,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Retour
            </button>
          )}
          {step === 'recap' && (
            <button
              onClick={doCreateDeposit}
              disabled={createDeposit.isPending}
              style={{
                flex: step !== 'client' ? 1.4 : 1,
                padding: 15,
                borderRadius: 12,
                background: createDeposit.isPending ? `${GR}80` : GR,
                border: 'none',
                fontSize: 14,
                fontWeight: 800,
                color: '#fff',
                cursor: createDeposit.isPending ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {createDeposit.isPending ? (
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
              ) : (
                <ShieldCheck style={{ width: 18, height: 18 }} />
              )}
              Confirmer le dépôt
            </button>
          )}
          {step === 'client' && selectedClient && (
            <button
              onClick={() => goTo('amount')}
              style={{
                flex: 1,
                padding: 15,
                borderRadius: 12,
                background: GR,
                border: 'none',
                fontSize: 14,
                fontWeight: 800,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Suivant
            </button>
          )}
          {step === 'amount' && (
            <button
              onClick={() => amountNum >= 1000 && goTo('family')}
              disabled={amountNum < 1000}
              style={{
                flex: 1.4,
                padding: 15,
                borderRadius: 12,
                background: amountNum >= 1000 ? GR : t.border,
                border: 'none',
                fontSize: 14,
                fontWeight: 800,
                color: amountNum >= 1000 ? '#fff' : t.dim,
                cursor: amountNum >= 1000 ? 'pointer' : 'not-allowed',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Suivant
            </button>
          )}
        </div>
      )}
    </div>
  );
}
