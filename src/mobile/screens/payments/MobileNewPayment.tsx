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
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toStoredPath } from '@/lib/signedUrls';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { useCountUp } from '@/hooks/useCountUp';
import {
  useAdminClientBeneficiaries,
  useAdminCreateBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import { getBaseRate } from '@/lib/rateCalculation';
import type { PaymentMethodKey } from '@/types/rates';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Search,
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
  FormField,
  TextInput,
} from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

// Violet d'action = marque Paiements (cohérent liste/détail/FAB).
const VIOLET = '#8B5CF6';
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

interface Benef {
  name: string;
  ident: string;
  phone: string;
  email: string;
  bank: string;
  account: string;
  isClient: boolean;
}

const BENEF0: Benef = {
  name: '', ident: '', phone: '', email: '', bank: '', account: '', isClient: false,
};

// ── Micro-composants ───────────────────────────────────────────
function Opt() {
  return <span className={cn('text-[12px] font-medium', TEXT.muted)}> optionnel</span>;
}
function Req() {
  return <span className="text-[#C0504D] dark:text-[#E79A9A]"> *</span>;
}

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
        'flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition active:scale-[0.99]',
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
        <div className={cn('text-[13px] font-bold', TEXT.strong)}>{title}</div>
        {desc != null && <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{desc}</div>}
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
  const createPayment = useAdminCreatePayment();

  // Tous les wallets en une seule requête admin
  const { data: walletsMap = new Map<string, number>() } = useQuery({
    queryKey: ['all-wallets-for-new-payment'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('user_id, balance_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, w.balance_xaf as number]));
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

  // Bénéficiaire
  const [benef, setBenef] = useState<Benef>(BENEF0);
  const [skipBenef, setSkipBenef] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const qrRef = useRef<HTMLInputElement>(null);
  // Carnet du client (Lot 4): onglet "enregistré" vs "nouveau", + sélection.
  const [benefTab, setBenefTab] = useState<'existing' | 'new'>('existing');
  const [selectedBenef, setSelectedBenef] = useState<Beneficiary | null>(null);
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

  // Succès
  const [done, setDone] = useState<{ paymentId: string; cny: number; xaf: number } | null>(null);

  // ── Calculs ───────────────────────────────────────────────────
  const clientBalance = client ? (walletsMap.get(client.user_id) ?? 0) : 0;
  const baseRate = rateData && mode ? getBaseRate(rateData, mode.id) : FALLBACK_RATE;
  const rate = useCustomRate ? (parseInt(customRateStr) || FALLBACK_RATE) : baseRate;
  const raw = parseInt(rawAmount) || 0;
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
  const benef4Valid =
    skipBenef
      ? true
      : benefTab === 'existing'
      ? !!selectedBenef
      : mode?.id === 'cash' && benef.isClient
      ? true
      : benef.name.trim().length > 0 &&
        (mode?.id !== 'virement' ||
          (benef.bank.trim().length > 0 && benef.account.trim().length > 0));

  const hasEnoughBalance = xaf <= clientBalance;
  const canNext =
    step === 1 ? !!client :
    step === 2 ? !!mode :
    step === 3 ? (xaf >= 10_000 && hasEnoughBalance) :
    step === 4 ? benef4Valid :
    true;

  // ── Reset ─────────────────────────────────────────────────────
  function reset() {
    setStep(1); setSearch(''); setClient(null); setMode(null);
    setInputCurrency('xaf'); setRawAmount('');
    setUseCustomRate(false); setCustomRateStr(String(FALLBACK_RATE));
    setBenef(BENEF0); setSkipBenef(false);
    setBenefTab('existing'); setSelectedBenef(null); setSaveToCarnet(true);
    setQrFile(null); setQrPreview(null); setDone(null);
  }

  // ── QR code ───────────────────────────────────────────────────
  function handleQrChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    setQrPreview(URL.createObjectURL(file));
  }

  function removeQr() {
    setQrFile(null);
    setQrPreview(null);
    if (qrRef.current) qrRef.current.value = '';
  }

  // ── Soumission ────────────────────────────────────────────────
  async function handleConfirm() {
    if (!client || !mode || !dbMode) return;

    // virement → bank_transfer pour la DB
    const dbMethod = dbMode;

    const autoName =
      mode.id === 'cash' && benef.isClient
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
        // New beneficiary typed by the admin.
        const isCashSelf = mode.id === 'cash' && benef.isClient;
        const resolvedName = autoName ?? (benef.name || undefined);

        // Save to the CLIENT's carnet (unless cash+self — that's the client).
        if (saveToCarnet && !isCashSelf && benef.name.trim()) {
          try {
            const created = await createBeneficiary.mutateAsync({
              client_id: client.user_id,
              payment_method: dbMode,
              alias: benef.name.trim(),
              name: benef.name.trim(),
              identifier: benef.ident || undefined,
              identifier_type: benef.ident ? 'id' : undefined,
              phone: benef.phone || undefined,
              email: benef.email || undefined,
              bank_name: benef.bank || undefined,
              bank_account: benef.account || undefined,
              qr_code_file: qrFile || undefined,
            });
            beneficiaryId = created.id;
          } catch {
            // Non-silent (hook toasts); the payment still proceeds.
          }
        }

        snapshot = {
          relation_type: isCashSelf ? 'self' : 'other',
          name: resolvedName,
          identifier: benef.ident || undefined,
          identifier_type: benef.ident ? 'id' : undefined,
          phone: benef.phone || undefined,
          email: benef.email || undefined,
          bank_name: benef.bank || undefined,
          bank_account: benef.account || undefined,
        };
        benefPayload = {
          beneficiary_name: resolvedName,
          beneficiary_phone: benef.phone || undefined,
          beneficiary_email: benef.email || undefined,
          beneficiary_bank_name: benef.bank || undefined,
          beneficiary_bank_account: benef.account || undefined,
          beneficiary_identifier: benef.ident || undefined,
          beneficiary_identifier_type: benef.ident ? ('id' as const) : undefined,
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
      : benef.isClient
      ? clientName
      : benef.name || '';

    return (
      <div className={cn('mx-auto flex flex-col items-center justify-center px-6 text-center', desktop ? 'h-[calc(100vh-120px)] min-h-[560px] max-w-xl rounded-[24px] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]' : 'h-[100dvh] max-w-[480px]', SURFACE.canvas)}>
        <Holder icon={Check} tone="success" size="lg" className="mb-4" />
        <div className={cn('text-[20px] font-extrabold', TEXT.strong)}>Paiement créé</div>

        {/* ¥ en premier */}
        <div className="mt-2">
          <Amount value={`¥${fmt(done.cny)}`} size="xl" />
        </div>
        <div className={cn('mt-1.5 text-[14px]', TEXT.muted)}>
          {fmt(done.xaf)} XAF via {mode?.name}
        </div>
        <div className={cn('mt-1 text-[12px]', TEXT.muted)}>
          pour {clientName}
          {benefLabel ? ` → ${benefLabel}` : ''}
        </div>

        <div className="mt-7 flex w-full max-w-[360px] gap-2.5">
          <SoftPill onClick={reset} className="flex-1">
            Nouveau
          </SoftPill>
          <PrimaryPill
            onClick={() => navigate(`/m/payments/${done.paymentId}`)}
            className="flex-[1.4] bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white"
          >
            Voir la fiche
          </PrimaryPill>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORMULAIRE MULTI-ÉTAPES
  // ══════════════════════════════════════════════════════════════
  return (
    <div className={cn('mx-auto flex flex-col overflow-hidden', desktop ? 'h-[calc(100vh-120px)] min-h-[560px] max-w-xl rounded-[24px] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]' : 'h-[100dvh] max-w-[480px]', SURFACE.canvas)}>
      {/* ── Header + barre de progression ─────────────────── */}
      <div className={cn('shrink-0 px-5 pt-[env(safe-area-inset-top)]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex h-14 items-center gap-2">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            aria-label="Retour"
            className={cn('-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95', TEXT.muted)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className={cn('flex-1 text-[15px] font-bold', TEXT.strong)}>Nouveau paiement</span>
          <span className="text-[12px] font-bold" style={{ color: VIOLET }}>{step}/5</span>
        </div>
        <div className="flex gap-1 pb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{ background: step >= n ? VIOLET : 'rgba(0,0,0,0.08)' }}
            />
          ))}
        </div>
      </div>

      {/* ── Contenu ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* ══════ ÉTAPE 1 — QUEL CLIENT ? ══════ */}
        {step === 1 && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Quel client ?</div>

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
                const bal = walletsMap.get(c.user_id) ?? null;
                const sel = client?.user_id === c.user_id;

                return (
                  <button
                    key={c.user_id}
                    onClick={() => setClient(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                    )}
                    style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                      style={{ background: `${VIOLET}14`, color: VIOLET }}
                    >
                      {ini}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{name}</div>
                      <div className={cn('truncate text-[11px]', TEXT.muted)}>{c.phone ?? '—'}</div>
                    </div>
                    {bal !== null ? (
                      <span className={cn('shrink-0 text-[13px] font-extrabold tabular-nums', bal > 0 ? TEXT.strong : TEXT.muted)}>
                        {fmt(bal)} XAF
                      </span>
                    ) : (
                      <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>—</span>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-10">
                  <Holder icon={User} size="lg" />
                  <p className={cn('mt-3 text-[13px]', TEXT.muted)}>Aucun client trouvé</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ ÉTAPE 2 — COMMENT PAYER ? ══════ */}
        {step === 2 && (
          <div>
            <div className={cn('mb-3.5 text-[22px] font-extrabold', TEXT.strong)}>Comment payer ?</div>
            <div className="space-y-2.5">
              {MODES.map((m) => {
                const sel = mode?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m)}
                    className={cn(
                      'flex w-full items-center gap-3.5 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
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
            <div className={cn('mb-1 text-[22px] font-extrabold', TEXT.strong)}>Combien ?</div>
            <div className={cn('mb-4 text-[13px]', TEXT.muted)}>
              Solde de {client?.first_name} :{' '}
              <strong className={cn('font-bold', clientBalance > 0 ? TEXT.strong : 'text-[#C0504D] dark:text-[#E79A9A]')}>
                {fmt(clientBalance)} XAF
              </strong>
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
                      'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
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
              <div className={cn('mb-2 text-[11px] font-semibold', TEXT.muted)}>
                {inputCurrency === 'xaf' ? 'Montant débité du client' : 'Montant reçu par le fournisseur'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <input
                  className={cn('w-full border-none bg-transparent text-[40px] font-black tracking-tight outline-none', TEXT.strong)}
                  placeholder="0"
                  value={rawAmount}
                  onChange={(e) => setRawAmount(e.target.value.replace(/\D/g, ''))}
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                />
                <span className={cn('shrink-0 text-[18px] font-bold', TEXT.muted)}>
                  {inputCurrency === 'xaf' ? 'XAF' : '¥'}
                </span>
              </div>

              <div className="my-3.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />

              <div className="flex items-center justify-between">
                <span className={cn('text-[12px]', TEXT.muted)}>
                  {inputCurrency === 'xaf' ? 'Le fournisseur reçoit' : 'Le client paie'}
                </span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: VIOLET }}>
                  {inputCurrency === 'xaf' ? `¥${fmt(animatedConverted)}` : `${fmt(animatedConverted)} XAF`}
                </span>
              </div>
            </Card>

            {/* Alerte solde insuffisant */}
            {xaf > 0 && !hasEnoughBalance && (
              <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-[#FBE7E7] p-3 dark:bg-[#3A2526]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
                <div>
                  <div className="text-[13px] font-bold text-[#C0504D] dark:text-[#E79A9A]">Solde insuffisant</div>
                  <div className={cn('text-[11px]', TEXT.muted)}>
                    Solde disponible : {fmt(clientBalance)} XAF
                  </div>
                </div>
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
                      'flex-1 rounded-xl py-2.5 text-[12px] font-bold transition active:scale-95',
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
                const allXAF = clientBalance;
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
                      'flex-1 rounded-xl py-2.5 text-[12px] font-bold transition active:scale-95 disabled:opacity-40',
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
                  <div className={cn('text-[13px] font-bold', TEXT.strong)}>Taux personnalisé</div>
                  {!useCustomRate && (
                    <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>
                      Taux du jour : 1M XAF = ¥{fmt(baseRate)}
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
                    className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.18)] transition-all"
                    style={{ left: useCustomRate ? 20 : 2 }}
                  />
                </button>
              </div>

              {useCustomRate && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
                  <span className={cn('shrink-0 text-[12px]', TEXT.muted)}>1M XAF =</span>
                  <input
                    className={cn('h-11 flex-1 rounded-xl px-3 text-center text-[16px] font-extrabold outline-none', SURFACE.canvas, TEXT.strong, 'focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
                    value={customRateStr}
                    onChange={(e) => setCustomRateStr(e.target.value.replace(/\D/g, ''))}
                    type="tel"
                    inputMode="numeric"
                  />
                  <span className={cn('shrink-0 text-[12px]', TEXT.muted)}>¥</span>
                </div>
              )}
            </Card>

            {/* Alertes montant */}
            {xaf > 0 && xaf < 10_000 && (
              <div className="mt-2.5 rounded-xl bg-[#FBE7E7] px-3.5 py-2.5 text-center text-[12px] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                Minimum : 10 000 XAF
              </div>
            )}
            {xaf > clientBalance && xaf > 0 && (
              <div className="mt-2.5 rounded-xl bg-[#FBE7E7] px-3.5 py-2.5 text-center text-[12px] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                Solde insuffisant ({fmt(clientBalance)} XAF)
              </div>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 4 — QUI REÇOIT ? ══════ */}
        {step === 4 && (
          <div className="pb-4">
            <div className={cn('mb-1 text-[22px] font-extrabold', TEXT.strong)}>Qui reçoit ?</div>
            <div className={cn('mb-4 text-[13px]', TEXT.muted)}>
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
                  if (!skipBenef) setBenef(BENEF0);
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
                        onClick={() => setBenefTab(tab)}
                        className={cn(
                          'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
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
                        <div className={cn('mt-3 text-[13px]', TEXT.muted)}>
                          Aucun bénéficiaire {mode?.name} enregistré pour ce client
                        </div>
                        <button
                          onClick={() => setBenefTab('new')}
                          className="mt-2 text-[13px] font-bold"
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
                                'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                                SURFACE.card,
                                SURFACE.shadow,
                              )}
                              style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                            >
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-extrabold"
                                style={{ background: `${VIOLET}14`, color: VIOLET }}
                              >
                                {(b.alias || b.name)[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                {/* alias-first : repère lisible en titre */}
                                <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>
                                  {b.alias || b.name}
                                </div>
                                <div className={cn('truncate text-[12px]', TEXT.muted)}>
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

            {!skipBenef && benefTab === 'new' && (
              <div className="space-y-4">
                {/* CASH : choix "le client lui-même" ou "quelqu'un d'autre" */}
                {mode?.id === 'cash' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setBenef({
                          ...benef,
                          isClient: true,
                          name: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim(),
                          phone: '',
                        })
                      }
                      className={cn(
                        'flex-1 rounded-xl py-3 text-[13px] font-bold transition active:scale-95',
                        SURFACE.card,
                        SURFACE.shadow,
                      )}
                      style={benef.isClient ? { boxShadow: `0 0 0 2px ${VIOLET}`, color: VIOLET } : undefined}
                    >
                      Le client lui-même
                    </button>
                    <button
                      onClick={() => setBenef({ ...benef, isClient: false, name: '', phone: '' })}
                      className={cn(
                        'flex-1 rounded-xl py-3 text-[13px] font-bold transition active:scale-95',
                        SURFACE.card,
                        SURFACE.shadow,
                      )}
                      style={!benef.isClient ? { boxShadow: `0 0 0 2px ${VIOLET}`, color: VIOLET } : undefined}
                    >
                      Quelqu'un d'autre
                    </button>
                  </div>
                )}

                {/* CASH : carte du client (quand "le client lui-même") */}
                {mode?.id === 'cash' && benef.isClient && client && (
                  <Card className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                      style={{ background: `${VIOLET}14`, color: VIOLET }}
                    >
                      {getInitials(client.first_name ?? '', client.last_name ?? '')}
                    </div>
                    <div className="min-w-0">
                      <div className={cn('text-[15px] font-bold', TEXT.strong)}>
                        {`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()}
                      </div>
                      <div className={cn('text-[12px]', TEXT.muted)}>{client.phone ?? '—'}</div>
                    </div>
                  </Card>
                )}

                {/* Nom du bénéficiaire — tous modes sauf cash+isClient */}
                {!(mode?.id === 'cash' && benef.isClient) && (
                  <FormField label={<>Nom du bénéficiaire<Req /></>}>
                    <TextInput
                      placeholder="Ex: Zhang Wei"
                      value={benef.name}
                      onChange={(e) => setBenef({ ...benef, name: e.target.value })}
                    />
                  </FormField>
                )}

                {/* CASH autre : téléphone */}
                {mode?.id === 'cash' && !benef.isClient && (
                  <FormField label={<>Téléphone<Opt /></>}>
                    <TextInput
                      placeholder="Ex: +86 138 0000 0000"
                      value={benef.phone}
                      onChange={(e) => setBenef({ ...benef, phone: e.target.value })}
                      type="tel"
                    />
                  </FormField>
                )}

                {/* ALIPAY / WECHAT */}
                {(mode?.id === 'alipay' || mode?.id === 'wechat') && (
                  <>
                    {/* QR Code upload */}
                    <FormField label={<>QR Code {mode.name}<Opt /></>}>
                      <input
                        ref={qrRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleQrChange}
                      />
                      {qrPreview ? (
                        <div className="relative overflow-hidden rounded-2xl ring-2" style={{ boxShadow: `inset 0 0 0 2px ${VIOLET}40` }}>
                          <img
                            src={qrPreview}
                            alt="QR code"
                            className="block h-[180px] w-full object-cover"
                          />
                          <button
                            onClick={removeQr}
                            aria-label="Retirer"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => qrRef.current?.click()}
                          className={cn(
                            'flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-black/10 py-5 text-center dark:border-white/10',
                            SURFACE.card,
                          )}
                        >
                          <div className={cn('text-[24px] leading-none', TEXT.muted)}>+</div>
                          <div className={cn('text-[13px] font-bold', TEXT.strong)}>
                            Ajouter une photo du QR code
                          </div>
                          <div className={cn('text-[11px]', TEXT.muted)}>
                            Capture d'écran ou photo
                          </div>
                        </button>
                      )}
                    </FormField>

                    {/* Séparateur "et / ou" */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-px flex-1 bg-black/[0.06] dark:bg-white/[0.08]" />
                      <span className={cn('text-[12px]', TEXT.muted)}>et / ou</span>
                      <div className="h-px flex-1 bg-black/[0.06] dark:bg-white/[0.08]" />
                    </div>

                    {/* Identifiant */}
                    <FormField label={<>Identifiant {mode.name}<Opt /></>}>
                      <TextInput
                        placeholder={`ID ${mode.name} du bénéficiaire`}
                        value={benef.ident}
                        onChange={(e) => setBenef({ ...benef, ident: e.target.value })}
                      />
                    </FormField>

                    {/* Téléphone */}
                    <FormField label={<>Téléphone<Opt /></>}>
                      <TextInput
                        placeholder="Ex: +86 138 0000 0000"
                        value={benef.phone}
                        onChange={(e) => setBenef({ ...benef, phone: e.target.value })}
                        type="tel"
                      />
                    </FormField>

                    {/* Email */}
                    <FormField label={<>Email<Opt /></>}>
                      <TextInput
                        placeholder="Ex: zhangwei@mail.com"
                        value={benef.email}
                        onChange={(e) => setBenef({ ...benef, email: e.target.value })}
                        type="email"
                      />
                    </FormField>
                  </>
                )}

                {/* VIREMENT */}
                {mode?.id === 'virement' && (
                  <>
                    <FormField label={<>Banque<Req /></>}>
                      <TextInput
                        placeholder="Ex: Bank of China"
                        value={benef.bank}
                        onChange={(e) => setBenef({ ...benef, bank: e.target.value })}
                      />
                    </FormField>
                    <FormField label={<>Numéro de compte<Req /></>}>
                      <TextInput
                        placeholder="Ex: 6214 8888 1234 5678"
                        value={benef.account}
                        onChange={(e) => setBenef({ ...benef, account: e.target.value })}
                        type="tel"
                      />
                    </FormField>
                  </>
                )}

                {/* Enregistrer au carnet du client (sauf cash + client lui-même) */}
                {!(mode?.id === 'cash' && benef.isClient) && (
                  <CheckRow
                    checked={saveToCarnet}
                    title="Enregistrer dans le carnet du client"
                    onClick={() => setSaveToCarnet(!saveToCarnet)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 5 — TOUT EST BON ? ══════ */}
        {step === 5 && (
          <div className="space-y-2.5 pb-4">
            <div className={cn('text-[22px] font-extrabold', TEXT.strong)}>Tout est bon ?</div>

            {/* Montant principal : ¥ en premier */}
            <Card className="py-5 text-center">
              <Amount value={`¥${fmt(cny)}`} size="xl" />
              <div className={cn('mt-1 text-[15px]', TEXT.muted)}>{fmt(xaf)} XAF</div>
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
                  : mode?.id === 'cash' && benef.isClient
                  ? { l: 'Bénéficiaire', v: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() + ' (le client)' }
                  : benef.name
                  ? { l: 'Bénéficiaire', v: benef.name }
                  : null,
                // Détails : bénéficiaire enregistré sélectionné OU saisi manuellement
                !skipBenef && (selectedBenef?.identifier || (!selectedBenef && benef.ident))
                  ? { l: `ID ${mode?.name}`, v: selectedBenef?.identifier || benef.ident }
                  : null,
                !skipBenef && (selectedBenef?.bank_name || (!selectedBenef && benef.bank))
                  ? { l: 'Banque', v: selectedBenef?.bank_name || benef.bank }
                  : null,
                !skipBenef && (selectedBenef?.bank_account || (!selectedBenef && benef.account))
                  ? { l: 'Compte', v: selectedBenef?.bank_account || benef.account }
                  : null,
                !skipBenef && (selectedBenef?.phone || (!selectedBenef && benef.phone))
                  ? { l: 'Téléphone', v: selectedBenef?.phone || benef.phone }
                  : null,
                !skipBenef && (selectedBenef?.email || (!selectedBenef && benef.email))
                  ? { l: 'Email', v: selectedBenef?.email || benef.email }
                  : null,
                { l: 'Taux', v: `1M XAF = ¥${fmt(rate)}${useCustomRate ? ' (perso.)' : ''}` },
              ] as ({ l: string; v: string | undefined } | null)[])
                .filter((r): r is { l: string; v: string } => !!r && !!r.v)
                .map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-[9px]">
                    <span className={cn('shrink-0 text-[13px]', TEXT.muted)}>{r.l}</span>
                    <span className={cn('max-w-[65%] text-right text-[13px] font-semibold', TEXT.strong)}>
                      {r.v}
                    </span>
                  </div>
                ))}
            </Card>

            {/* Alerte solde insuffisant (récap) */}
            {xaf > clientBalance && (
              <div className="rounded-xl bg-[#FBE7E7] px-3.5 py-2.5 text-center text-[12px] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                Solde insuffisant ({fmt(clientBalance)} XAF disponibles)
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
            canNext && !createPayment.isPending && 'bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white',
          )}
        >
          {step === 5 ? 'Confirmer le paiement' : 'Suivant'}
        </PrimaryPill>
      </div>
    </div>
  );
}
