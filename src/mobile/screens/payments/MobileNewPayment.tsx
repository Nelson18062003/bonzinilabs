// ============================================================
// MODULE PAIEMENTS — MobileNewPayment (assistant 5 étapes)
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · header fixe + barre de progression violette ·
//   contenu scrollable · footer CTA toujours visible · cartes à
//   ombre douce · PaymentMethodLogo (vrais logos) · FormField/
//   TextInput · Amount · écran succès en Holder.
// Logique 100% préservée : étapes client→mode→montant→
//   bénéficiaire→récap, carnet du client (onglets enregistré/
//   nouveau), lock cash+client, toggle taux personnalisé,
//   upload QR, validations, useAdminCreatePayment + snapshot.
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toStoredPath } from '@/lib/signedUrls';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { clientCountryRate, formatCountryPct, teamPaymentFromCny, teamPaymentRate } from '@/lib/countryRates';
import { clientCountryToRateKey } from '@/components/payment-form/paymentRateLogic';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { useCountUp } from '@/hooks/useCountUp';
import {
  useAdminClientBeneficiaries,
  useAdminClientBeneficiaryNames,
  useAdminCreateBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import { getBaseRate } from '@/lib/rateCalculation';
import { MIN_PAYMENT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import type { PaymentMethodKey } from '@/types/rates';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import { nextSupplierName } from '@/lib/beneficiaries/defaultName';
import { draftErrors, draftPayload, emptyDraft, type BeneficiaryDraft } from '@/lib/beneficiaries/contact';
import { BeneficiaryContactFields } from '@/components/payment-form/BeneficiaryContactFields';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Search,
  Send,
  User,
  X,
} from 'lucide-react';
import {
  SURFACE,
  TEXT,
  Card,
  Holder,
  Amount,
  PrimaryPill,
  SoftPill,
  TextInput,
} from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

// Violet d'action = marque Paiements (cohérent liste/détail/FAB).
const VIOLET = 'var(--ink)'; // l'encre du kit, qui suit le thème (voir --ink dans index.css)
const FALLBACK_RATE = 11530;

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

// PaymentMethodLogo n'accepte que 4 clés (virement → bank_transfer).
function logoMethod(id: PaymentMethodKey): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  return id === 'virement' ? 'bank_transfer' : id;
}

// ── Constantes ─────────────────────────────────────────────────
const MODES = [
  { id: 'alipay' as PaymentMethodKey,   name: 'Alipay' },
  { id: 'wechat' as PaymentMethodKey,   name: 'WeChat Pay' },
  { id: 'virement' as PaymentMethodKey, name: 'Virement' },
  { id: 'cash' as PaymentMethodKey,     name: 'Cash' },
] as const;

type Mode = typeof MODES[number];

// ── Micro-composants ───────────────────────────────────────────

// Case à cocher au langage kit (logique conservée par les parents).
function CheckRow({
  checked,
  title,
  desc,
  onClick,
}: {
  checked: boolean;
  title: React.ReactNode;
  desc?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-3.5 text-left transition active:scale-[0.99]',
        SURFACE.card,
        SURFACE.shadow,
      )}
      style={checked ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition"
        style={{
          background: checked ? VIOLET : 'transparent',
          boxShadow: checked ? 'none' : 'inset 0 0 0 2px rgba(0,0,0,0.18)',
        }}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className={cn('text-[16px] font-bold', TEXT.strong)}>{title}</div>
        {desc != null && <div className={cn('mt-0.5 text-[16px]', TEXT.muted)}>{desc}</div>}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export function MobileNewPayment({ desktop = false }: { desktop?: boolean } = {}) {
  const navigate = useNavigate();

  // ── Data ─────────────────────────────────────────────────────
  const { data: clients = [] } = useAllClients();
  const { data: rateData } = useActiveDailyRate();
  const { data: adjustments } = useRateAdjustments();
  const createPayment = useAdminCreatePayment();

  // Tous les wallets en une seule requête admin
  const { data: walletsMap = new Map<string, { balance: number; overdraft: number }>() } = useQuery({
    queryKey: ['all-wallets-for-new-payment'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('user_id, balance_xaf, overdraft_limit_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, { balance: w.balance_xaf as number, overdraft: (w.overdraft_limit_xaf as number) ?? 0 }]));
    },
    staleTime: 30_000,
  });

  // ── State formulaire ─────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<typeof clients[0] | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  // Montant
  const [inputCurrency, setInputCurrency] = useState<'xaf' | 'cny'>('xaf');
  const [rawAmount, setRawAmount] = useState('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRateStr, setCustomRateStr] = useState(String(FALLBACK_RATE));
  // Date de l'opération — « maintenant » par défaut, antidatable
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState('');

  // Bénéficiaire
  const [draft, setDraft] = useState<BeneficiaryDraft>(() => emptyDraft(null));
  const [skipBenef, setSkipBenef] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  // Carnet du client (Lot 4): onglet "enregistré" vs "nouveau", + sélection.
  const [benefTab, setBenefTab] = useState<'existing' | 'new'>('existing');
  const [selectedBenef, setSelectedBenef] = useState<Beneficiary | null>(null);
  // Bénéficiaire déjà ajouté au carnet lors d'une tentative précédente : un
  // second essai (paiement en échec) ne le recrée pas en double.
  const carnetIdRef = useRef<string | null>(null);
  const [saveToCarnet, setSaveToCarnet] = useState(true);
  const createBeneficiary = useAdminCreateBeneficiary();

  // mode.id 'virement' → 'bank_transfer' (valeur canonique DB du carnet).
  const dbMode: BeneficiaryMode | null = mode
    ? mode.id === 'virement'
      ? 'bank_transfer'
      : (mode.id as BeneficiaryMode)
    : null;
  // Bénéficiaires enregistrés DE CE CLIENT, scopés (client_id + RLS admin).
  const { data: clientBeneficiaries } = useAdminClientBeneficiaries(
    client?.user_id,
    dbMode ?? undefined,
  );
  // Noms/alias tous modes confondus — numérote le nom par défaut
  // « Supplier NN » sans dupliquer un numéro déjà pris sur un autre mode.
  const { data: beneficiaryNames } = useAdminClientBeneficiaryNames(client?.user_id);
  // Dernier nom posé automatiquement — permet de le recaler quand la liste
  // arrive après coup (sans jamais écraser une saisie de l'admin).
  const autoNameRef = useRef<string | null>(null);

  // Ouverture de l'onglet bénéficiaire : sur « Nouveau » en Alipay/WeChat,
  // le nom (requis) est prérempli « Supplier NN » — l'admin peut le modifier.
  function openBenefTab(tab: 'existing' | 'new') {
    setBenefTab(tab);
    if (tab === 'new' && (mode?.id === 'alipay' || mode?.id === 'wechat') && !draft.name.trim()) {
      const auto = nextSupplierName(beneficiaryNames);
      autoNameRef.current = auto;
      setDraft((b) => ({ ...b, name: auto }));
    }
  }

  // Si le nom auto a été posé avant que la liste ne soit chargée, on le
  // renumérote à l'arrivée des données — uniquement s'il est resté intact.
  useEffect(() => {
    if (!autoNameRef.current) return;
    setDraft((b) => {
      if (b.name !== autoNameRef.current) return b;
      const next = nextSupplierName(beneficiaryNames);
      if (next === b.name) return b;
      autoNameRef.current = next;
      return { ...b, name: next };
    });
  }, [beneficiaryNames]);

  // Succès
  const [done, setDone] = useState<{ paymentId: string; cny: number; xaf: number } | null>(null);

  // ── Calculs ───────────────────────────────────────────────────
  const clientBalance = client ? (walletsMap.get(client.user_id)?.balance ?? 0) : 0;
  const clientOverdraft = client ? (walletsMap.get(client.user_id)?.overdraft ?? 0) : 0;
  // Ce que l'équipe peut débiter : le solde, plus le découvert autorisé par le super admin.
  const clientAvailable = clientBalance + clientOverdraft;
  // Taux du jour de la méthode (référence Cameroun), puis celui du PAYS du
  // client (Gabon −1 %…) et de la TRANCHE du montant (petits paiements, en
  // rouge sur le flyer) — même règle que l'app client et que la RPC
  // calculate_final_rate, arrondie à l'entier.
  const refRate = rateData && mode ? getBaseRate(rateData, mode.id) : FALLBACK_RATE;
  const raw = parseInt(rawAmount) || 0;
  const clientKey = client ? clientCountryToRateKey(client.country) : null;
  // Jamais d'écart pays ni de tranche sur la constante de secours : elle n'est pas un taux publié.
  const published = !!(rateData && mode);
  const fromCny = published && inputCurrency !== 'xaf' ? teamPaymentFromCny(refRate, clientKey, adjustments, raw) : null;
  const baseRate = !published ? refRate : fromCny ? fromCny.rate : teamPaymentRate(refRate, clientKey, adjustments, raw);
  // Pour les libellés : l'écart du pays, et si la tranche « petits paiements » s'applique.
  const countryRate = published ? clientCountryRate(refRate, clientKey, adjustments) : null;
  const smallPayment = published && baseRate !== teamPaymentRate(refRate, clientKey, adjustments, 1_000_000);
  const rateNote = [countryRate ? `${countryRate.label} ${formatCountryPct(countryRate.percentage)}` : '', smallPayment ? 'petit paiement' : ''].filter(Boolean).join(' · ');
  // Champ perso vidé pour retaper : on retombe sur le taux du jour, jamais
  // sur la constante de secours (le paiement partait à 11 530).
  const rate = useCustomRate ? (parseInt(customRateStr) || baseRate) : baseRate;
  const customRateValid = !useCustomRate || parseInt(customRateStr) > 0;
  const xaf = inputCurrency === 'xaf' ? raw : Math.round(raw * 1_000_000 / rate);
  const cny = inputCurrency === 'xaf' ? Math.round(raw * rate / 1_000_000) : raw;
  // Animation du montant converti (kit cohérent avec l'assistant dépôt).
  const convertedTarget = inputCurrency === 'xaf' ? cny : xaf;
  const animatedConverted = useCountUp(convertedTarget, { enabled: convertedTarget > 0 });

  // ── Filtrage ──────────────────────────────────────────────────
  const filtered = clients.filter((c) => {
    const fullName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
    );
  });

  // ── Validation par étape ──────────────────────────────────────
  // Le nouveau bénéficiaire : ses coordonnées AVEC leur format (src/lib/beneficiaries/contact.ts).
  const benefErrors = dbMode && !skipBenef && benefTab === 'new' ? draftErrors(dbMode, draft, { hasQr: !!qrFile }) : {};
  const benefFirstError = Object.values(benefErrors)[0] ?? null;
  // Ce qui partira, mis en forme — pour le récapitulatif de l'étape 5.
  const typed = dbMode && !selectedBenef ? draftPayload(dbMode, draft) : {};
  const benef4Valid =
    skipBenef
      ? true
      : benefTab === 'existing'
      ? !!selectedBenef
      : !benefFirstError;

  const hasEnoughBalance = xaf <= clientAvailable;
  const willOverdraw = xaf > 0 && xaf > clientBalance && hasEnoughBalance;
  // Pas de plafond : entier positif, dans la limite du solde du client.
  const amountValid = isValidXafAmount(xaf, MIN_PAYMENT_XAF);
  const canNext =
    step === 1 ? !!client :
    step === 2 ? !!mode :
    step === 3 ? (amountValid && hasEnoughBalance && customRateValid) :
    step === 4 ? benef4Valid :
    true;

  // ── Reset ─────────────────────────────────────────────────────
  function reset() {
    setStep(1); setSearch(''); setClient(null); setMode(null);
    setInputCurrency('xaf'); setRawAmount('');
    setUseCustomRate(false); setCustomRateStr(String(FALLBACK_RATE));
    setUseCustomDate(false); setCustomDateStr('');
    setDraft(emptyDraft(null)); setSkipBenef(false); carnetIdRef.current = null;
    setBenefTab('existing'); setSelectedBenef(null); setSaveToCarnet(true);
    removeQr(); setDone(null);
  }

  // ── QR code ───────────────────────────────────────────────────
  // Revokes the previous blob URL before minting the next one: pasting a
  // second QR over a first would otherwise leak the original.
  const setQrFromFiles = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setQrFile(file);
    setQrPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }, []);

  const removeQr = useCallback(() => {
    setQrFile(null);
    setQrPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  // Changer de client ou de mode invalide le bénéficiaire choisi : il vient du
  // carnet de CE client pour CE mode. Sans cela « Suivant » restait actif et
  // le paiement partait avec le bénéficiaire d'un autre client.
  const chooseClient = (c: NonNullable<typeof client>) => {
    if (c.user_id !== client?.user_id) { setSelectedBenef(null); setDraft(emptyDraft(dbMode)); removeQr(); carnetIdRef.current = null; }
    setClient(c);
  };
  const chooseMode = (m: NonNullable<typeof mode>) => {
    if (m.id !== mode?.id) { setSelectedBenef(null); setDraft(emptyDraft(m.id === 'virement' ? 'bank_transfer' : (m.id as BeneficiaryMode))); removeQr(); carnetIdRef.current = null; }
    setMode(m);
  };

  // ── Soumission ────────────────────────────────────────────────
  async function handleConfirm() {
    if (!client || !mode || !dbMode) return;
    // Re-check at the call site: the step guard is UI, this one protects the RPC.
    if (!amountValid || !hasEnoughBalance) {
      toast.error(
        amountValid
          ? 'Solde insuffisant pour ce paiement.'
          : 'Montant invalide.',
      );
      return;
    }

    const opDate = resolveOperationDate(useCustomDate, customDateStr);
    if (opDate.error) {
      toast.error(opDate.error);
      return;
    }

    // virement → bank_transfer pour la DB
    const dbMethod = dbMode;

    const autoName =
      mode.id === 'cash' && draft.isClient
        ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()
        : undefined;

    // ── Build the beneficiary payload + frozen snapshot ──────────
    let benefPayload: Record<string, unknown> = {};
    let beneficiaryId: string | undefined;
    let snapshot: Record<string, unknown> | undefined;

    if (!skipBenef) {
      if (benefTab === 'existing' && selectedBenef) {
        // Pick from the client's carnet → snapshot copies the saved record.
        beneficiaryId = selectedBenef.id;
        snapshot = {
          id: selectedBenef.id,
          alias: selectedBenef.alias ?? selectedBenef.name,
          name: selectedBenef.name,
          payment_method: selectedBenef.payment_method,
          identifier: selectedBenef.identifier,
          identifier_type: selectedBenef.identifier_type,
          phone: selectedBenef.phone,
          email: selectedBenef.email,
          bank_name: selectedBenef.bank_name,
          bank_account: selectedBenef.bank_account,
          bank_extra: selectedBenef.bank_extra,
          relation_type: selectedBenef.relation_type,
        };
        benefPayload = {
          beneficiary_name: selectedBenef.name || undefined,
          beneficiary_phone: selectedBenef.phone || undefined,
          beneficiary_email: selectedBenef.email || undefined,
          beneficiary_bank_name: selectedBenef.bank_name || undefined,
          beneficiary_bank_account: selectedBenef.bank_account || undefined,
          beneficiary_bank_extra: selectedBenef.bank_extra || undefined,
          beneficiary_identifier: selectedBenef.identifier || undefined,
          beneficiary_identifier_type: selectedBenef.identifier_type || undefined,
          // Snapshot the durable path, NOT the temporary signed URL the list
          // hook injected for display (otherwise the QR breaks after ~1h).
          beneficiary_qr_code_url: toStoredPath(selectedBenef.qr_code_url) || undefined,
        };
      } else {
        // New beneficiary typed by the admin — coordonnées mises en forme
        // (téléphone à indicatif, email en minuscules, ID WeChat vérifié).
        const p = draftPayload(dbMode, draft);
        const isCashSelf = mode.id === 'cash' && draft.isClient;
        const resolvedName = autoName ?? p.name;

        // Save to the CLIENT's carnet (unless cash+self — that's the client).
        if (carnetIdRef.current) {
          beneficiaryId = carnetIdRef.current;
        } else if (saveToCarnet && !isCashSelf && p.name) {
          try {
            const created = await createBeneficiary.mutateAsync({
              client_id: client.user_id,
              payment_method: dbMode,
              alias: p.name,
              name: p.name,
              identifier: p.identifier,
              identifier_type: p.identifier_type,
              phone: p.phone,
              email: p.email,
              bank_name: p.bank_name,
              bank_account: p.bank_account,
              bank_extra: p.bank_extra,
              qr_code_file: qrFile || undefined,
            });
            beneficiaryId = created.id;
            carnetIdRef.current = created.id;
          } catch {
            // Non-silent (hook toasts); the payment still proceeds.
          }
        }

        snapshot = {
          relation_type: isCashSelf ? 'self' : 'other',
          name: resolvedName,
          identifier: p.identifier,
          identifier_type: p.identifier_type,
          phone: p.phone,
          email: p.email,
          bank_name: p.bank_name,
          bank_account: p.bank_account,
          bank_extra: p.bank_extra,
        };
        benefPayload = {
          beneficiary_name: resolvedName,
          beneficiary_phone: p.phone,
          beneficiary_email: p.email,
          beneficiary_bank_name: p.bank_name,
          beneficiary_bank_account: p.bank_account,
          beneficiary_bank_extra: p.bank_extra,
          beneficiary_identifier: p.identifier,
          beneficiary_identifier_type: p.identifier_type,
          qr_code_files: qrFile ? [qrFile] : undefined,
        };
      }
    }

    try {
      const res = await createPayment.mutateAsync({
        user_id: client.user_id,
        amount_xaf: xaf,
        amount_rmb: cny,
        exchange_rate: rate,
        method: dbMethod,
        rate_is_custom: useCustomRate,
        desired_date: opDate.date,
        beneficiary_id: beneficiaryId,
        beneficiary_details: snapshot,
        ...benefPayload,
      });
      setDone({ paymentId: res.payment_id ?? '', cny, xaf });
    } catch {
      // Toast géré par le hook onError
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ÉCRAN SUCCÈS
  // ══════════════════════════════════════════════════════════════
  if (done) {
    const clientName = `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim();
    const benefLabel = skipBenef
      ? ''
      : selectedBenef
      ? selectedBenef.alias || selectedBenef.name
      : draft.isClient
      ? clientName
      : draft.name.trim() || '';
    const canSendInstruction = !!done.paymentId && mode?.id !== 'cash' && !skipBenef;

    return (
      <div className={cn('mx-auto flex flex-col items-center justify-center px-6 text-center', desktop ? 'h-[calc(100vh-120px)] min-h-[560px] max-w-xl rounded-lg shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]' : 'h-[100dvh] max-w-[480px]', SURFACE.canvas)}>
        <Holder icon={Check} tone="success" size="lg" className="mb-4" />
        <div className={cn('text-[20px] font-bold', TEXT.strong)}>Paiement créé</div>

        {/* ¥ en premier */}
        <div className="mt-2">
          <Amount value={`¥${fmt(done.cny)}`} size="xl" />
        </div>
        <div className={cn('mt-1.5 text-[16px]', TEXT.muted)}>
          {fmt(done.xaf)} XAF via {mode?.name}
        </div>
        <div className={cn('mt-1 text-[16px]', TEXT.muted)}>
          pour {clientName}
          {benefLabel ? ` → ${benefLabel}` : ''}
        </div>

        {/* Le geste qui suit la création : envoyer l'instruction au
            partenaire en Chine. La fiche s'ouvre avec la feuille dépliée
            (« ?instruction=1 »). Pas pour le cash, ni sans bénéficiaire. */}
        {canSendInstruction && (
          <PrimaryPill
            onClick={() => navigate(`/m/payments/${done.paymentId}?instruction=1`)}
            className="mt-7 w-full max-w-[360px] bg-[#2C2C2C] text-white dark:bg-[#2C2C2C] dark:text-white"
          >
            <Send />
            Envoyer l'instruction au partenaire
          </PrimaryPill>
        )}

        <div className={cn('flex w-full max-w-[360px] gap-2.5', canSendInstruction ? 'mt-2.5' : 'mt-7')}>
          <SoftPill onClick={reset} className="flex-1">
            Nouveau
          </SoftPill>
          {canSendInstruction ? (
            <SoftPill onClick={() => navigate(`/m/payments/${done.paymentId}`)} className="flex-1">
              Voir la fiche
            </SoftPill>
          ) : (
            <PrimaryPill
              onClick={() => navigate(`/m/payments/${done.paymentId}`)}
              className="flex-[1.4] bg-[#2C2C2C] text-white dark:bg-[#2C2C2C] dark:text-white"
            >
              Voir la fiche
            </PrimaryPill>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORMULAIRE MULTI-ÉTAPES
  // ══════════════════════════════════════════════════════════════
  return (
    <div className={cn('mx-auto flex flex-col overflow-hidden', desktop ? 'h-[calc(100vh-120px)] min-h-[560px] max-w-xl rounded-lg shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]' : 'h-[100dvh] max-w-[480px]', SURFACE.canvas)}>
      {/* ── Header + barre de progression ─────────────────── */}
      <div className={cn('shrink-0 px-5 pt-[env(safe-area-inset-top)]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex h-14 items-center gap-2">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            aria-label="Retour"
            className={cn('-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95', TEXT.muted)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className={cn('flex-1 text-[16px] font-bold', TEXT.strong)}>Nouveau paiement</span>
          <span className={cn('text-[16px] font-bold', TEXT.strong)}>{step}/5</span>
        </div>
        <div className="flex gap-1 pb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{ background: step >= n ? VIOLET : 'rgba(128,128,128,0.25)' }}
            />
          ))}
        </div>
      </div>

      {/* ── Contenu ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* ══════ ÉTAPE 1 — QUEL CLIENT ? ══════ */}
        {step === 1 && (
          <div>
            <div className={cn('mb-3.5 text-[20px] font-bold', TEXT.strong)}>Quel client ?</div>

            <div className="relative mb-3">
              <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
              <TextInput
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Effacer"
                  className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {filtered.map((c) => {
                const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
                const ini = getInitials(c.first_name ?? '', c.last_name ?? '');
                const bal = walletsMap.get(c.user_id)?.balance ?? null;
                const sel = client?.user_id === c.user_id;

                return (
                  <button
                    key={c.user_id}
                    onClick={() => chooseClient(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px] font-bold"
                      style={{ background: 'rgba(128,128,128,0.16)' }}
                    >
                      {ini}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[16px] font-bold leading-snug', TEXT.strong)}>{name}</div>
                      <div className={cn('text-[16px]', TEXT.muted)}>{c.phone ?? '—'}</div>
                      {/* Le solde sous le nom : à côté, il coupait les noms en deux sur un petit écran. */}
                      <div className={cn('text-[16px] font-bold tabular-nums', bal !== null && bal > 0 ? TEXT.strong : TEXT.muted)}>
                        {bal !== null ? `Solde : ${fmt(bal)} XAF` : 'Solde inconnu'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-10">
                  <Holder icon={User} size="lg" />
                  <p className={cn('mt-3 text-[16px]', TEXT.muted)}>Aucun client trouvé</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ ÉTAPE 2 — COMMENT PAYER ? ══════ */}
        {step === 2 && (
          <div>
            <div className={cn('mb-3.5 text-[20px] font-bold', TEXT.strong)}>Comment payer ?</div>
            <div className="space-y-2.5">
              {MODES.map((m) => {
                const sel = mode?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => chooseMode(m)}
                    className={cn(
                      'flex w-full items-center gap-3.5 rounded-lg p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                  >
                    <PaymentMethodLogo method={logoMethod(m.id)} size={44} />
                    <span className={cn('flex-1 text-[16px] font-bold', TEXT.strong)}>{m.name}</span>
                    {sel && <Check className="h-5 w-5 shrink-0" style={{ color: VIOLET }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ ÉTAPE 3 — COMBIEN ? ══════ */}
        {step === 3 && (
          <div>
            <div className={cn('mb-1 text-[20px] font-bold', TEXT.strong)}>Combien ?</div>
            <div className={cn('mb-4 text-[16px]', TEXT.muted)}>
              Solde de {client?.first_name} :{' '}
              <strong className={cn('font-bold', clientBalance > 0 ? TEXT.strong : 'text-[#900B09] dark:text-[#FDD3D0]')}>
                {fmt(clientBalance)} XAF
              </strong>
              {clientOverdraft > 0 && (
                <span className="block text-[14px]">Découvert autorisé {fmt(clientOverdraft)} XAF · disponible {fmt(clientAvailable)} XAF</span>
              )}
            </div>

            {/* Toggle XAF / ¥ */}
            <div className={cn('mb-4 inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
              {(['xaf', 'cny'] as const).map((cur) => {
                const active = inputCurrency === cur;
                return (
                  <button
                    key={cur}
                    onClick={() => { setInputCurrency(cur); setRawAmount(''); }}
                    className={cn(
                      'flex-1 rounded-lg py-2 text-[16px] font-semibold transition-colors',
                      active ? 'text-white' : TEXT.muted,
                    )}
                    style={active ? { background: VIOLET } : undefined}
                  >
                    {cur === 'xaf' ? 'Je saisis en XAF' : 'Je saisis en ¥'}
                  </button>
                );
              })}
            </div>

            {/* Bloc saisie + conversion */}
            <Card className="mb-3 p-5">
              <div className={cn('mb-2 text-[16px] font-semibold', TEXT.muted)}>
                {inputCurrency === 'xaf' ? 'Montant débité du client' : 'Montant reçu par le fournisseur'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <input
                  className={cn('w-full border-none bg-transparent text-[32px] font-bold tracking-tight outline-none', TEXT.strong)}
                  placeholder="0"
                  value={rawAmount}
                  onChange={(e) => setRawAmount(e.target.value.replace(/\D/g, ''))}
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                />
                <span className={cn('shrink-0 text-[20px] font-bold', TEXT.muted)}>
                  {inputCurrency === 'xaf' ? 'XAF' : '¥'}
                </span>
              </div>

              <div className="my-3.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />

              <div className="flex items-center justify-between">
                <span className={cn('text-[16px]', TEXT.muted)}>
                  {inputCurrency === 'xaf' ? 'Le fournisseur reçoit' : 'Le client paie'}
                </span>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: VIOLET }}>
                  {inputCurrency === 'xaf' ? `¥${fmt(animatedConverted)}` : `${fmt(animatedConverted)} XAF`}
                </span>
              </div>
            </Card>

            {/* Alerte solde insuffisant */}
            {xaf > 0 && !hasEnoughBalance && (
              <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-[#FDD3D0] p-3 dark:bg-[#900B09]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#900B09] dark:text-[#FDD3D0]" />
                <div>
                  <div className="text-[16px] font-bold text-[#900B09] dark:text-[#FDD3D0]">Solde insuffisant</div>
                  <div className={cn('text-[16px]', TEXT.muted)}>
                    Disponible : {fmt(clientAvailable)} XAF{clientOverdraft > 0 ? ' (découvert compris)' : ''}
                  </div>
                </div>
              </div>
            )}
            {willOverdraw && (
              <div className="mb-3 rounded-lg bg-[#FFF1C2] p-3 text-[16px] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
                <b>Le client passe en découvert.</b> Solde après ce paiement : {fmt(clientBalance - xaf)} XAF.
              </div>
            )}

            {/* Raccourcis */}
            <div className="mb-3.5 flex gap-2">
              {(inputCurrency === 'xaf'
                ? [['100K', 100_000], ['250K', 250_000], ['500K', 500_000], ['1M', 1_000_000]] as [string, number][]
                : [['¥1K', 1_000], ['¥2.5K', 2_500], ['¥5K', 5_000], ['¥10K', 10_000]] as [string, number][]
              ).map(([label, val]) => {
                const active = raw === val;
                return (
                  <button
                    key={label}
                    onClick={() => setRawAmount(String(val))}
                    className={cn(
                      'flex-1 rounded-lg py-2.5 text-[16px] font-bold transition active:scale-95',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={active ? { boxShadow: `0 0 0 2px ${VIOLET}`, color: VIOLET } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
              {(() => {
                // "Tout" — solde complet du client converti dans la devise saisie.
                // Pas de plafond admin (les paiements opérés par admin peuvent
                // dépasser le cap client de 50M XAF).
                const allXAF = clientAvailable;
                const allValue =
                  inputCurrency === 'xaf'
                    ? allXAF
                    : rate > 0
                      ? Math.floor((allXAF * rate) / 1_000_000)
                      : 0;
                const allStr = allValue > 0 ? String(allValue) : '';
                const isActive = allStr !== '' && raw === allValue;
                const disabled = !client || allValue <= 0;
                return (
                  <button
                    onClick={() => allStr && setRawAmount(allStr)}
                    disabled={disabled}
                    className={cn(
                      'flex-1 rounded-lg py-2.5 text-[16px] font-bold transition active:scale-95 disabled:opacity-40',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={isActive ? { boxShadow: `0 0 0 2px ${VIOLET}`, color: VIOLET } : undefined}
                  >
                    Tout
                  </button>
                );
              })()}
            </div>

            {/* Bloc taux personnalisé */}
            <Card className="p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className={cn('text-[16px] font-bold', TEXT.strong)}>Taux personnalisé</div>
                  {!useCustomRate && (
                    <div className={cn('mt-0.5 text-[16px]', TEXT.muted)}>
                      {countryRate
                        ? <>Taux {countryRate.label} ({formatCountryPct(countryRate.percentage)}){smallPayment ? ' · petit paiement' : ''} : 1M XAF = ¥{fmt(baseRate)} · Cameroun ¥{fmt(refRate)}</>
                        : <>Taux du jour{smallPayment ? ' · petit paiement' : ''} : 1M XAF = ¥{fmt(baseRate)}</>}
                    </div>
                  )}
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => {
                    setUseCustomRate(!useCustomRate);
                    if (!useCustomRate) setCustomRateStr(String(baseRate));
                  }}
                  aria-label="Activer le taux personnalisé"
                  className="relative h-[26px] w-11 shrink-0 rounded-full transition-colors"
                  style={{ background: useCustomRate ? VIOLET : 'rgba(0,0,0,0.18)' }}
                >
                  <span
                    className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white ring-1 ring-black/[0.10] transition-all"
                    style={{ left: useCustomRate ? 20 : 2 }}
                  />
                </button>
              </div>

              {useCustomRate && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
                  <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>1M XAF =</span>
                  <input
                    className={cn('h-11 flex-1 rounded-lg px-3 text-center text-[16px] font-bold outline-none', SURFACE.canvas, TEXT.strong, 'focus:ring-2 focus:ring-[#2C2C2C] dark:focus:ring-[#E3E3E3]')}
                    value={customRateStr}
                    onChange={(e) => setCustomRateStr(e.target.value.replace(/\D/g, ''))}
                    type="tel"
                    inputMode="numeric"
                  />
                  <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>¥</span>
                </div>
              )}
            </Card>

            {/* Bloc date de l'opération */}
            <OperationDateCard
              className="mt-2.5"
              enabled={useCustomDate}
              value={customDateStr}
              onToggle={(on, nowLocal) => {
                setUseCustomDate(on);
                if (on && !customDateStr) setCustomDateStr(nowLocal);
              }}
              onChange={setCustomDateStr}
              accent={VIOLET}
            />

            {/* Alertes montant */}
            {xaf > clientAvailable && xaf > 0 && (
              <div className="mt-2.5 rounded-lg bg-[#FDD3D0] px-3.5 py-2.5 text-center text-[16px] font-semibold text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
                Solde insuffisant ({fmt(clientAvailable)} XAF disponibles)
              </div>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 4 — QUI REÇOIT ? ══════ */}
        {step === 4 && (
          <div className="pb-4">
            <div className={cn('mb-1 text-[20px] font-bold', TEXT.strong)}>Qui reçoit ?</div>
            <div className={cn('mb-4 text-[16px]', TEXT.muted)}>
              ¥{fmt(cny)} via {mode?.name}
            </div>

            {/* Option "Remplir plus tard" */}
            <div className="mb-4">
              <CheckRow
                checked={skipBenef}
                title="Remplir plus tard"
                desc="Les infos du bénéficiaire seront ajoutées après"
                onClick={() => {
                  setSkipBenef(!skipBenef);
                  if (!skipBenef) setDraft(emptyDraft(dbMode));
                }}
              />
            </div>

            {!skipBenef && (
              <>
                {/* Onglets : carnet du client (enregistré) vs nouveau */}
                <div className={cn('mb-4 inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
                  {(['existing', 'new'] as const).map((tab) => {
                    const active = benefTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => openBenefTab(tab)}
                        className={cn(
                          'flex-1 rounded-lg py-2 text-[16px] font-semibold transition-colors',
                          active ? 'text-white' : TEXT.muted,
                        )}
                        style={active ? { background: VIOLET } : undefined}
                      >
                        {tab === 'existing' ? 'Enregistré' : 'Nouveau'}
                      </button>
                    );
                  })}
                </div>

                {/* CARNET DU CLIENT — liste scopée (client_id + RLS admin) */}
                {benefTab === 'existing' && (
                  <div className="mb-2">
                    {!clientBeneficiaries || clientBeneficiaries.length === 0 ? (
                      <div className="flex flex-col items-center py-7 text-center">
                        <Holder icon={User} size="lg" />
                        <div className={cn('mt-3 text-[16px]', TEXT.muted)}>
                          Aucun bénéficiaire {mode?.name} enregistré pour ce client
                        </div>
                        <button
                          onClick={() => openBenefTab('new')}
                          className="mt-2 text-[16px] font-bold"
                          style={{ color: VIOLET }}
                        >
                          + Créer un bénéficiaire
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {clientBeneficiaries.map((b) => {
                          const sel = selectedBenef?.id === b.id;
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBenef(sel ? null : b)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg p-4 text-left transition active:scale-[0.99]',
                                SURFACE.card,
                                SURFACE.shadow,
                              )}
                              style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                            >
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px] font-bold"
                                style={{ background: 'rgba(128,128,128,0.16)' }}
                              >
                                {(b.alias || b.name)[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                {/* alias-first : repère lisible en titre */}
                                <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>
                                  {b.alias || b.name}
                                </div>
                                <div className={cn('truncate text-[16px]', TEXT.muted)}>
                                  {b.identifier || b.phone || b.bank_account || b.name || ''}
                                </div>
                              </div>
                              {sel && <Check className="h-5 w-5 shrink-0" style={{ color: VIOLET }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!skipBenef && benefTab === 'new' && dbMode && (
              <div className="space-y-4">
                <BeneficiaryContactFields
                  mode={dbMode}
                  draft={draft}
                  onChange={setDraft}
                  errors={benefErrors}
                  showErrors={false}
                  idPrefix="mnp"
                  clientName={client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : undefined}
                  qr={
                    dbMode === 'alipay' || dbMode === 'wechat'
                      ? { preview: qrPreview, onFiles: setQrFromFiles, onRemove: removeQr, pasteEnabled: step === 4 }
                      : undefined
                  }
                />

                {/* Enregistrer au carnet du client (sauf cash + client lui-même) */}
                {!(mode?.id === 'cash' && draft.isClient) && (
                  <CheckRow
                    checked={saveToCarnet}
                    title="Enregistrer dans le carnet du client"
                    onClick={() => setSaveToCarnet(!saveToCarnet)}
                  />
                )}

                {/* « Suivant » est grisé : dire pourquoi, plutôt que laisser deviner. */}
                {benefFirstError && (
                  <p className="text-[14px] font-medium text-[#975102] dark:text-[#E8B931]">Pour continuer : {benefFirstError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 5 — TOUT EST BON ? ══════ */}
        {step === 5 && (
          <div className="space-y-2.5 pb-4">
            <div className={cn('text-[20px] font-bold', TEXT.strong)}>Tout est bon ?</div>

            {/* Montant principal : ¥ en premier */}
            <Card className="py-5 text-center">
              <Amount value={`¥${fmt(cny)}`} size="xl" />
              <div className={cn('mt-1 text-[16px]', TEXT.muted)}>{fmt(xaf)} XAF</div>
            </Card>

            {/* Tableau récap */}
            <Card>
              {([
                { l: 'Client', v: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() },
                { l: 'Mode', v: mode?.name },
                skipBenef
                  ? { l: 'Bénéficiaire', v: 'À remplir plus tard' }
                  : selectedBenef
                  ? { l: 'Bénéficiaire', v: selectedBenef.alias || selectedBenef.name }
                  : mode?.id === 'cash' && draft.isClient
                  ? { l: 'Bénéficiaire', v: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() + ' (le client)' }
                  : typed.name
                  ? { l: 'Bénéficiaire', v: typed.name }
                  : null,
                // Détails : bénéficiaire enregistré sélectionné OU saisi (mis en forme)
                !skipBenef && (selectedBenef?.identifier || (!selectedBenef && typed.identifier))
                  ? { l: `Compte ${mode?.name}`, v: selectedBenef?.identifier || typed.identifier }
                  : null,
                !skipBenef && (selectedBenef?.bank_name || (!selectedBenef && typed.bank_name))
                  ? { l: 'Banque', v: selectedBenef?.bank_name || typed.bank_name }
                  : null,
                !skipBenef && (selectedBenef?.bank_account || (!selectedBenef && typed.bank_account))
                  ? { l: 'Compte', v: selectedBenef?.bank_account || typed.bank_account }
                  : null,
                !skipBenef && (selectedBenef?.bank_extra || (!selectedBenef && typed.bank_extra))
                  ? { l: 'SWIFT', v: selectedBenef?.bank_extra || typed.bank_extra }
                  : null,
                !skipBenef && (selectedBenef?.phone || (!selectedBenef && typed.phone))
                  ? { l: 'Téléphone', v: selectedBenef?.phone || typed.phone }
                  : null,
                !skipBenef && (selectedBenef?.email || (!selectedBenef && typed.email))
                  ? { l: 'Email', v: selectedBenef?.email || typed.email }
                  : null,
                { l: 'Taux', v: `1M XAF = ¥${fmt(rate)}${useCustomRate ? ' (perso.)' : rateNote ? ` (${rateNote})` : ''}` },
                useCustomDate && customDateStr
                  ? { l: 'Date', v: new Date(customDateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
                  : null,
              ] as ({ l: string; v: string | undefined } | null)[])
                .filter((r): r is { l: string; v: string } => !!r && !!r.v)
                .map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-[9px]">
                    <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>{r.l}</span>
                    <span className={cn('max-w-[65%] text-right text-[16px] font-semibold', TEXT.strong)}>
                      {r.v}
                    </span>
                  </div>
                ))}
            </Card>

            {/* Alerte solde insuffisant (récap) */}
            {xaf > clientAvailable && (
              <div className="rounded-lg bg-[#FDD3D0] px-3.5 py-2.5 text-center text-[16px] font-semibold text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
                Solde insuffisant ({fmt(clientAvailable)} XAF disponibles)
              </div>
            )}
            {willOverdraw && (
              <div className="rounded-lg bg-[#FFF1C2] px-3.5 py-2.5 text-center text-[16px] font-semibold text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
                Découvert : solde après paiement {fmt(clientBalance - xaf)} XAF
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer — toujours visible ────────────────── */}
      <div className={cn('flex shrink-0 gap-2.5 px-5 pb-[calc(1.125rem+env(safe-area-inset-bottom))] pt-3', SURFACE.card, SURFACE.shadow)}>
        {step > 1 && (
          <SoftPill onClick={() => setStep(step - 1)} className="flex-1">
            Retour
          </SoftPill>
        )}
        <PrimaryPill
          onClick={() => {
            if (step < 5) setStep(step + 1);
            else handleConfirm();
          }}
          disabled={!canNext}
          loading={createPayment.isPending}
          className={cn(
            step === 1 ? 'flex-1' : 'flex-[1.4]',
            canNext && !createPayment.isPending && 'bg-[#2C2C2C] text-white dark:bg-[#2C2C2C] dark:text-white',
          )}
        >
          {step === 5 ? 'Confirmer le paiement' : 'Suivant'}
        </PrimaryPill>
      </div>
    </div>
  );
}
