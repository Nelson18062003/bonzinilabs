// ============================================================
// BONZINI ADMIN — NOUVEAU PAIEMENT (5 étapes)
// Maquette de référence : maquette_admin_nouveau_paiement_v3.jsx
// ============================================================
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { getBaseRate } from '@/lib/rateCalculation';
import type { PaymentMethodKey } from '@/types/rates';

// ── Design tokens ─────────────────────────────────────────────
const V = '#A947FE';
const G = '#F3A745';
const O = '#FE560D';
const GR = '#34d399';
const AL = '#1677ff';
const WC = '#07c160';

const t = {
  bg: '#f8f6fa',
  card: '#ffffff',
  text: '#1a1028',
  sub: '#7a7290',
  dim: '#c4bdd0',
  border: '#ebe6f0',
};

const FONT = "'DM Sans', sans-serif";
const FALLBACK_RATE = 11530;

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

// ── Constantes ─────────────────────────────────────────────────
const MODES = [
  { id: 'alipay' as PaymentMethodKey,   name: 'Alipay',     icon: '支', color: AL },
  { id: 'wechat' as PaymentMethodKey,   name: 'WeChat Pay', icon: '微', color: WC },
  { id: 'virement' as PaymentMethodKey, name: 'Virement',   icon: 'B',  color: V  },
  { id: 'cash' as PaymentMethodKey,     name: 'Cash',       icon: '¥',  color: O  },
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

// ── Style partagé pour les inputs ─────────────────────────────
const inp: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: `1.5px solid ${t.border}`,
  background: '#fff',
  fontSize: 16,
  fontWeight: 600,
  color: t.text,
  fontFamily: FONT,
  outline: 'none',
  boxSizing: 'border-box',
};

// ── Micro-composants ───────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: 'block' }}>
      {children}
    </label>
  );
}
function Opt() {
  return <span style={{ fontSize: 12, fontWeight: 500, color: t.dim }}> optionnel</span>;
}
function Req() {
  return <span style={{ color: O }}> *</span>;
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function MobileNewPayment() {
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

  // Succès
  const [done, setDone] = useState<{ paymentId: string; cny: number; xaf: number } | null>(null);

  // ── Calculs ───────────────────────────────────────────────────
  const clientBalance = client ? (walletsMap.get(client.user_id) ?? 0) : 0;
  const baseRate = rateData && mode ? getBaseRate(rateData, mode.id) : FALLBACK_RATE;
  const rate = useCustomRate ? (parseInt(customRateStr) || FALLBACK_RATE) : baseRate;
  const raw = parseInt(rawAmount) || 0;
  const xaf = inputCurrency === 'xaf' ? raw : Math.round(raw * 1_000_000 / rate);
  const cny = inputCurrency === 'xaf' ? Math.round(raw * rate / 1_000_000) : raw;

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
      : mode?.id === 'cash' && benef.isClient
      ? true
      : benef.name.trim().length > 0 &&
        (mode?.id !== 'virement' ||
          (benef.bank.trim().length > 0 && benef.account.trim().length > 0));

  const canNext =
    step === 1 ? !!client :
    step === 2 ? !!mode :
    step === 3 ? xaf >= 10_000 :
    step === 4 ? benef4Valid :
    true;

  // ── Reset ─────────────────────────────────────────────────────
  function reset() {
    setStep(1); setSearch(''); setClient(null); setMode(null);
    setInputCurrency('xaf'); setRawAmount('');
    setUseCustomRate(false); setCustomRateStr(String(FALLBACK_RATE));
    setBenef(BENEF0); setSkipBenef(false);
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
    if (!client || !mode) return;

    // virement → bank_transfer pour la DB
    const dbMethod = (mode.id === 'virement' ? 'bank_transfer' : mode.id) as
      'alipay' | 'wechat' | 'bank_transfer' | 'cash';

    const autoName =
      mode.id === 'cash' && benef.isClient
        ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()
        : undefined;

    const benefPayload = skipBenef
      ? {}
      : {
          beneficiary_name: autoName ?? benef.name || undefined,
          beneficiary_phone: benef.phone || undefined,
          beneficiary_email: benef.email || undefined,
          beneficiary_bank_name: benef.bank || undefined,
          beneficiary_bank_account: benef.account || undefined,
          beneficiary_notes: benef.ident ? `ID ${mode.name}: ${benef.ident}` : undefined,
          qr_code_files: qrFile ? [qrFile] : undefined,
        };

    try {
      const res = await createPayment.mutateAsync({
        user_id: client.user_id,
        amount_xaf: xaf,
        amount_rmb: cny,
        exchange_rate: rate,
        method: dbMethod,
        rate_is_custom: useCustomRate,
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
    const benefLabel =
      !skipBenef && benef.name
        ? benef.isClient ? clientName : benef.name
        : !skipBenef && mode?.id === 'cash' && benef.isClient
        ? clientName
        : '';

    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          fontFamily: FONT,
          padding: '0 24px',
        }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${GR}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: GR, marginBottom: 20,
          }}
        >
          ✓
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Paiement créé</div>

        {/* ¥ en premier */}
        <div
          style={{
            fontSize: 38, fontWeight: 900, color: t.text,
            letterSpacing: '-1.5px', marginTop: 8,
          }}
        >
          ¥{fmt(done.cny)}
        </div>
        <div style={{ fontSize: 15, color: t.sub, marginTop: 4 }}>
          {fmt(done.xaf)} XAF via {mode?.name}
        </div>
        <div style={{ fontSize: 13, color: t.dim, marginTop: 4 }}>
          pour {clientName}
          {benefLabel ? ` → ${benefLabel}` : ''}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 32, width: '100%', maxWidth: 360 }}>
          <button
            onClick={reset}
            style={{
              flex: 1, padding: 15, borderRadius: 12,
              background: 'none', border: `1.5px solid ${t.border}`,
              fontSize: 14, fontWeight: 700, color: t.sub,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Nouveau
          </button>
          <button
            onClick={() => navigate(`/m/payments/${done.paymentId}`)}
            style={{
              flex: 1.4, padding: 15, borderRadius: 12,
              background: V, border: 'none',
              fontSize: 14, fontWeight: 800, color: '#fff',
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Voir la fiche
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORMULAIRE MULTI-ÉTAPES
  // ══════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: t.bg,
        fontFamily: FONT,
        color: t.text,
      }}
    >
      {/* ────────────────── HEADER ────────────────── */}
      <div
        style={{
          flexShrink: 0,
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
          padding: '12px 20px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            style={{
              background: 'none', border: 'none', fontSize: 24,
              color: t.sub, cursor: 'pointer', marginRight: 12,
              padding: 0, fontWeight: 300, fontFamily: FONT, lineHeight: 1,
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text, flex: 1 }}>
            Nouveau paiement
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: V }}>{step}/5</span>
        </div>

        {/* Progress bar 5 segments */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                background: step >= n ? V : t.border,
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
      </div>

      {/* ────────────────── CONTENT ────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 16px' }}>

        {/* ══════ ÉTAPE 1 — QUEL CLIENT ? ══════ */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quel client ?</div>

            <input
              style={{ ...inp, background: t.bg, marginBottom: 12 }}
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map((c) => {
                const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
                const ini = getInitials(c.first_name ?? '', c.last_name ?? '');
                const bal = walletsMap.get(c.user_id) ?? null;
                const sel = client?.user_id === c.user_id;

                return (
                  <button
                    key={c.user_id}
                    onClick={() => setClient(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12, width: '100%',
                      background: sel ? `${V}08` : t.card,
                      border: `1.5px solid ${sel ? V : t.border}`,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: `${V}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: V, flexShrink: 0,
                      }}
                    >
                      {ini}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15, fontWeight: 700, color: t.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: t.sub }}>{c.phone ?? '—'}</div>
                    </div>
                    {bal !== null ? (
                      <span style={{ fontSize: 13, fontWeight: 800, color: bal > 0 ? t.text : t.dim, flexShrink: 0 }}>
                        {fmt(bal)} XAF
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: t.dim, flexShrink: 0 }}>—</span>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: t.dim, fontSize: 13 }}>
                  Aucun client trouvé
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ ÉTAPE 2 — COMMENT PAYER ? ══════ */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Comment payer ?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MODES.map((m) => {
                const sel = mode?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px', borderRadius: 14, width: '100%',
                      background: sel ? `${m.color}08` : t.card,
                      border: `1.5px solid ${sel ? m.color : t.border}`,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `${m.color}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 800, color: m.color, flexShrink: 0,
                      }}
                    >
                      {m.icon}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{m.name}</span>
                    {sel && <span style={{ marginLeft: 'auto', fontSize: 16, color: m.color }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ ÉTAPE 3 — COMBIEN ? ══════ */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>Combien ?</div>
            <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>
              Solde de {client?.first_name} :{' '}
              <strong style={{ color: clientBalance > 0 ? t.text : O }}>
                {fmt(clientBalance)} XAF
              </strong>
            </div>

            {/* Toggle XAF / ¥ */}
            <div
              style={{
                display: 'flex', borderRadius: 10, overflow: 'hidden',
                border: `1.5px solid ${t.border}`, marginBottom: 16,
              }}
            >
              {(['xaf', 'cny'] as const).map((cur) => (
                <button
                  key={cur}
                  onClick={() => { setInputCurrency(cur); setRawAmount(''); }}
                  style={{
                    flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer',
                    background: inputCurrency === cur ? V : t.card,
                    color: inputCurrency === cur ? '#fff' : t.sub,
                    fontSize: 14, fontWeight: 700,
                    fontFamily: FONT, transition: 'all 0.2s',
                  }}
                >
                  {cur === 'xaf' ? 'Je saisis en XAF' : 'Je saisis en ¥'}
                </button>
              ))}
            </div>

            {/* Bloc saisie + conversion */}
            <div
              style={{
                padding: 20, borderRadius: 16,
                background: t.card, border: `1.5px solid ${t.border}`,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, color: t.sub, fontWeight: 600, marginBottom: 8 }}>
                {inputCurrency === 'xaf' ? 'Montant débité du client' : 'Montant reçu par le fournisseur'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <input
                  style={{
                    border: 'none', background: 'none', outline: 'none',
                    fontSize: 40, fontWeight: 900, color: t.text,
                    fontFamily: FONT, width: '100%', letterSpacing: '-1px',
                  }}
                  placeholder="0"
                  value={rawAmount}
                  onChange={(e) => setRawAmount(e.target.value.replace(/\D/g, ''))}
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                />
                <span style={{ fontSize: 18, fontWeight: 700, color: t.sub, flexShrink: 0 }}>
                  {inputCurrency === 'xaf' ? 'XAF' : '¥'}
                </span>
              </div>

              <div style={{ height: 1, background: t.border, margin: '14px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.sub }}>
                  {inputCurrency === 'xaf' ? 'Le fournisseur reçoit' : 'Le client paie'}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: V }}>
                  {inputCurrency === 'xaf' ? `¥${fmt(cny)}` : `${fmt(xaf)} XAF`}
                </span>
              </div>
            </div>

            {/* Raccourcis */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(inputCurrency === 'xaf'
                ? [['100K', 100_000], ['250K', 250_000], ['500K', 500_000], ['1M', 1_000_000]] as [string, number][]
                : [['¥1K', 1_000], ['¥2.5K', 2_500], ['¥5K', 5_000], ['¥10K', 10_000]] as [string, number][]
              ).map(([label, val]) => (
                <button
                  key={label}
                  onClick={() => setRawAmount(String(val))}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    background: raw === val ? `${V}10` : t.card,
                    border: `1px solid ${raw === val ? V : t.border}`,
                    fontSize: 12, fontWeight: 700,
                    color: raw === val ? V : t.text,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Bloc taux personnalisé */}
            <div
              style={{
                padding: '12px 14px', borderRadius: 12,
                background: t.card, border: `1.5px solid ${t.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Taux personnalisé</div>
                  {!useCustomRate && (
                    <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>
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
                  style={{
                    width: 44, height: 26, borderRadius: 13,
                    border: 'none', cursor: 'pointer',
                    background: useCustomRate ? V : `${t.dim}80`,
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: useCustomRate ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,.18)',
                    }}
                  />
                </button>
              </div>

              {useCustomRate && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: t.sub, flexShrink: 0 }}>1M XAF =</span>
                  <input
                    style={{ ...inp, flex: 1, padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}
                    value={customRateStr}
                    onChange={(e) => setCustomRateStr(e.target.value.replace(/\D/g, ''))}
                    type="tel"
                    inputMode="numeric"
                  />
                  <span style={{ fontSize: 12, color: t.sub, flexShrink: 0 }}>¥</span>
                </div>
              )}
            </div>

            {/* Alertes montant */}
            {xaf > 0 && xaf < 10_000 && (
              <div
                style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 10,
                  background: `${O}08`, border: `1px solid ${O}25`,
                  fontSize: 12, fontWeight: 600, color: O, textAlign: 'center',
                }}
              >
                Minimum : 10 000 XAF
              </div>
            )}
            {xaf > clientBalance && xaf > 0 && (
              <div
                style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 10,
                  background: `${O}08`, border: `1px solid ${O}25`,
                  fontSize: 12, fontWeight: 600, color: O, textAlign: 'center',
                }}
              >
                Solde insuffisant ({fmt(clientBalance)} XAF)
              </div>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 4 — QUI REÇOIT ? ══════ */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>Qui reçoit ?</div>
            <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>
              ¥{fmt(cny)} via {mode?.name}
            </div>

            {/* Option "Remplir plus tard" */}
            <button
              onClick={() => {
                setSkipBenef(!skipBenef);
                if (!skipBenef) setBenef(BENEF0);
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12, marginBottom: 16,
                background: skipBenef ? `${G}10` : t.card,
                border: `1.5px solid ${skipBenef ? G : t.border}`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: `2px solid ${skipBenef ? G : t.dim}`,
                  background: skipBenef ? G : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0,
                }}
              >
                {skipBenef ? '✓' : ''}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Remplir plus tard</div>
                <div style={{ fontSize: 11, color: t.sub }}>
                  Les infos du bénéficiaire seront ajoutées après
                </div>
              </div>
            </button>

            {!skipBenef && (
              <>
                {/* CASH : choix "le client lui-même" ou "quelqu'un d'autre" */}
                {mode?.id === 'cash' && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                    <button
                      onClick={() =>
                        setBenef({
                          ...benef,
                          isClient: true,
                          name: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim(),
                          phone: '',
                        })
                      }
                      style={{
                        flex: 1, padding: 12, borderRadius: 10,
                        background: benef.isClient ? `${V}10` : t.card,
                        border: `1.5px solid ${benef.isClient ? V : t.border}`,
                        fontSize: 13, fontWeight: 700,
                        color: benef.isClient ? V : t.sub,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      Le client lui-même
                    </button>
                    <button
                      onClick={() => setBenef({ ...benef, isClient: false, name: '', phone: '' })}
                      style={{
                        flex: 1, padding: 12, borderRadius: 10,
                        background: !benef.isClient ? `${V}10` : t.card,
                        border: `1.5px solid ${!benef.isClient ? V : t.border}`,
                        fontSize: 13, fontWeight: 700,
                        color: !benef.isClient ? V : t.sub,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      Quelqu'un d'autre
                    </button>
                  </div>
                )}

                {/* CASH : carte du client (quand "le client lui-même") */}
                {mode?.id === 'cash' && benef.isClient && client && (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 12, marginBottom: 16,
                      background: `${V}06`, border: `1.5px solid ${V}20`,
                    }}
                  >
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 10, background: `${V}14`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: V,
                      }}
                    >
                      {getInitials(client.first_name ?? '', client.last_name ?? '')}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                        {`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()}
                      </div>
                      <div style={{ fontSize: 12, color: t.sub }}>{client.phone ?? '—'}</div>
                    </div>
                  </div>
                )}

                {/* Nom du bénéficiaire — tous modes sauf cash+isClient */}
                {!(mode?.id === 'cash' && benef.isClient) && (
                  <div style={{ marginBottom: 16 }}>
                    <Label>Nom du bénéficiaire<Req /></Label>
                    <input
                      style={inp}
                      placeholder="Ex: Zhang Wei"
                      value={benef.name}
                      onChange={(e) => setBenef({ ...benef, name: e.target.value })}
                    />
                  </div>
                )}

                {/* CASH autre : téléphone */}
                {mode?.id === 'cash' && !benef.isClient && (
                  <div style={{ marginBottom: 16 }}>
                    <Label>Téléphone<Opt /></Label>
                    <input
                      style={inp}
                      placeholder="Ex: +86 138 0000 0000"
                      value={benef.phone}
                      onChange={(e) => setBenef({ ...benef, phone: e.target.value })}
                      type="tel"
                    />
                  </div>
                )}

                {/* ALIPAY / WECHAT */}
                {(mode?.id === 'alipay' || mode?.id === 'wechat') && (
                  <>
                    {/* QR Code upload */}
                    <div style={{ marginBottom: 14 }}>
                      <Label>QR Code {mode.name}<Opt /></Label>
                      <input
                        ref={qrRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleQrChange}
                      />
                      {qrPreview ? (
                        <div
                          style={{
                            position: 'relative', borderRadius: 12,
                            overflow: 'hidden', border: `1.5px solid ${V}35`,
                          }}
                        >
                          <img
                            src={qrPreview}
                            alt="QR code"
                            style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                          />
                          <button
                            onClick={removeQr}
                            style={{
                              position: 'absolute', top: 8, right: 8,
                              width: 28, height: 28, borderRadius: '50%',
                              background: 'rgba(0,0,0,.55)', border: 'none',
                              color: '#fff', fontSize: 18, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: FONT,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => qrRef.current?.click()}
                          style={{
                            width: '100%', padding: '22px 0', borderRadius: 12,
                            border: `2px dashed ${t.border}`, background: t.card,
                            cursor: 'pointer', textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 24, color: t.dim, marginBottom: 4 }}>+</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                            Ajouter une photo du QR code
                          </div>
                          <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>
                            Capture d'écran ou photo
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Séparateur "et / ou" */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 10, marginBottom: 12,
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: t.border }} />
                      <span style={{ fontSize: 12, color: t.dim }}>et / ou</span>
                      <div style={{ flex: 1, height: 1, background: t.border }} />
                    </div>

                    {/* Identifiant */}
                    <div style={{ marginBottom: 14 }}>
                      <Label>Identifiant {mode.name}<Opt /></Label>
                      <input
                        style={inp}
                        placeholder={`ID ${mode.name} du bénéficiaire`}
                        value={benef.ident}
                        onChange={(e) => setBenef({ ...benef, ident: e.target.value })}
                      />
                    </div>

                    {/* Téléphone */}
                    <div style={{ marginBottom: 14 }}>
                      <Label>Téléphone<Opt /></Label>
                      <input
                        style={inp}
                        placeholder="Ex: +86 138 0000 0000"
                        value={benef.phone}
                        onChange={(e) => setBenef({ ...benef, phone: e.target.value })}
                        type="tel"
                      />
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: 14 }}>
                      <Label>Email<Opt /></Label>
                      <input
                        style={inp}
                        placeholder="Ex: zhangwei@mail.com"
                        value={benef.email}
                        onChange={(e) => setBenef({ ...benef, email: e.target.value })}
                        type="email"
                      />
                    </div>
                  </>
                )}

                {/* VIREMENT */}
                {mode?.id === 'virement' && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <Label>Banque<Req /></Label>
                      <input
                        style={inp}
                        placeholder="Ex: Bank of China"
                        value={benef.bank}
                        onChange={(e) => setBenef({ ...benef, bank: e.target.value })}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <Label>Numéro de compte<Req /></Label>
                      <input
                        style={inp}
                        placeholder="Ex: 6214 8888 1234 5678"
                        value={benef.account}
                        onChange={(e) => setBenef({ ...benef, account: e.target.value })}
                        type="tel"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════ ÉTAPE 5 — TOUT EST BON ? ══════ */}
        {step === 5 && (
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Tout est bon ?</div>

            {/* Montant principal : ¥ en premier */}
            <div
              style={{
                padding: 20, borderRadius: 14, textAlign: 'center',
                background: t.card, border: `1.5px solid ${t.border}`,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 38, fontWeight: 900, color: t.text, letterSpacing: '-1.5px' }}>
                ¥{fmt(cny)}
              </div>
              <div style={{ fontSize: 15, color: t.sub, marginTop: 4 }}>{fmt(xaf)} XAF</div>
            </div>

            {/* Tableau récap */}
            <div
              style={{
                padding: '14px 16px', borderRadius: 14,
                background: t.card, border: `1.5px solid ${t.border}`,
              }}
            >
              {([
                { l: 'Client', v: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() },
                { l: 'Mode', v: mode?.name },
                skipBenef
                  ? { l: 'Bénéficiaire', v: 'À remplir plus tard' }
                  : mode?.id === 'cash' && benef.isClient
                  ? { l: 'Bénéficiaire', v: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() + ' (le client)' }
                  : benef.name
                  ? { l: 'Bénéficiaire', v: benef.name }
                  : null,
                !skipBenef && benef.ident ? { l: `ID ${mode?.name}`, v: benef.ident } : null,
                !skipBenef && benef.bank ? { l: 'Banque', v: benef.bank } : null,
                !skipBenef && benef.account ? { l: 'Compte', v: benef.account } : null,
                !skipBenef && benef.phone ? { l: 'Téléphone', v: benef.phone } : null,
                !skipBenef && benef.email ? { l: 'Email', v: benef.email } : null,
                { l: 'Taux', v: `1M XAF = ¥${fmt(rate)}${useCustomRate ? ' (perso.)' : ''}` },
              ] as ({ l: string; v: string | undefined } | null)[])
                .filter((r): r is { l: string; v: string } => !!r && !!r.v)
                .map((r, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '9px 0',
                      borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: t.sub, flexShrink: 0 }}>{r.l}</span>
                    <span
                      style={{
                        fontSize: 13, fontWeight: 700, color: t.text,
                        textAlign: 'right', maxWidth: '65%',
                      }}
                    >
                      {r.v}
                    </span>
                  </div>
                ))}
            </div>

            {/* Alerte solde insuffisant (récap) */}
            {xaf > clientBalance && (
              <div
                style={{
                  marginTop: 8, padding: '10px 14px', borderRadius: 10,
                  background: `${O}08`, border: `1px solid ${O}25`,
                  fontSize: 12, fontWeight: 600, color: O, textAlign: 'center',
                }}
              >
                Solde insuffisant ({fmt(clientBalance)} XAF disponibles)
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────── FOOTER — toujours visible ────────────────── */}
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
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              flex: 1, padding: '15px 0', borderRadius: 12,
              background: 'none', border: `1.5px solid ${t.border}`,
              fontSize: 14, fontWeight: 700, color: t.sub,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Retour
          </button>
        )}
        <button
          onClick={() => {
            if (step < 5) setStep(step + 1);
            else handleConfirm();
          }}
          disabled={!canNext || createPayment.isPending}
          style={{
            flex: step === 1 ? 1 : 1.4,
            padding: '15px 0',
            borderRadius: 12,
            background: canNext && !createPayment.isPending ? V : t.border,
            border: 'none',
            fontSize: 14,
            fontWeight: 800,
            color: canNext && !createPayment.isPending ? '#fff' : t.dim,
            cursor: canNext && !createPayment.isPending ? 'pointer' : 'not-allowed',
            fontFamily: FONT,
            transition: 'background 0.2s',
          }}
        >
          {createPayment.isPending
            ? 'Traitement...'
            : step === 5
            ? 'Confirmer le paiement'
            : 'Suivant'}
        </button>
      </div>
    </div>
  );
}
