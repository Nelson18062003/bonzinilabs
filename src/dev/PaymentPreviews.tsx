// Paiements module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=pay-<screen>.
// Mirrors the real model: 4 methods (alipay/wechat/bank_transfer/cash),
// XAF↔RMB amounts, the 9 payment_status values, and the FR copy from
// src/i18n/locales/fr/payments.json. Activity = paying Chinese suppliers.
import {
  ArrowLeft, Plus, ChevronRight, Check, Send, Building2, Banknote,
  Delete, Wallet, ArrowUpDown, QrCode, Info, Users, CheckCircle2, FileText,
  Clock, ChevronDown, Download, AlertTriangle, X,
  Home, ArrowDownToLine, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

// Module accent: violet (logo wings) — distinguishes Paiements (money out
// to China) from Dépôts (orange, money in).
const ACCENT = 'hsl(258 100% 60%)';

// Single display rate for the whole module so list + amount screen agree.
// Headline 1 000 000 XAF = 11 765 CNY ≈ the FALLBACK_RATE in
// paymentRateLogic.ts and the walletFixtures rate line.
const RATE = 0.011765;
const groupFr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const xafToRmb = (xaf: number) => groupFr(xaf * RATE);

/* ── method marks ──────────────────────────────────────────────────
 * Alipay / WeChat: real brand SVGs from public/assets/methods. The files
 * are monochrome Simple Icons, so we render them white via CSS mask over
 * the brand-coloured gradient tile (keeps the logo crisp at any size).
 * Bank transfer / Cash are generic rails, not brands → lucide glyphs,
 * matching the real PaymentMethodLogo.tsx. */
type PMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
function BrandGlyph({ src, size }: { src: string; size: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, backgroundColor: '#fff',
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        WebkitMaskSize: 'contain', maskSize: 'contain',
      }}
    />
  );
}
function MethodMark({ method, size = 44 }: { method: PMethod; size?: number }) {
  const px = `${size}px`;
  const base = 'grid shrink-0 place-items-center rounded-xl shadow-sm';
  if (method === 'alipay') return <span className={base} style={{ width: px, height: px, background: 'linear-gradient(135deg,#1677FF,#0958d9)' }}><BrandGlyph src="/assets/methods/alipay.svg" size={size * 0.56} /></span>;
  if (method === 'wechat') return <span className={base} style={{ width: px, height: px, background: 'linear-gradient(135deg,#07C160,#06ae56)' }}><BrandGlyph src="/assets/methods/wechat.svg" size={size * 0.58} /></span>;
  if (method === 'bank_transfer') return <span className={`${base} bg-gradient-to-br from-slate-600 to-slate-800`} style={{ width: px, height: px }}><Building2 className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} /></span>;
  return <span className={base} style={{ width: px, height: px, background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}><Banknote className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} /></span>;
}

/* ── fixtures (FR, paying Chinese suppliers) ───────────────────────
 * xaf is the source of truth; ¥ is derived from the shared RATE so the
 * list and the amount screen never disagree. */
const payments: {
  method: PMethod; beneficiary: string; date: string; xaf: number;
  status: string; tone: string; dot: string;
}[] = [
  { method: 'alipay', beneficiary: 'Shenzhen Tech Co.', date: "Aujourd'hui · 16:42", xaf: 3_250_000, status: 'En cours', tone: 'text-purple-300', dot: 'bg-purple-400' },
  { method: 'wechat', beneficiary: 'Guangzhou Textiles', date: '12 mai · 11:20', xaf: 1_800_000, status: 'Effectué', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
  { method: 'bank_transfer', beneficiary: 'Ningbo Imp. & Exp.', date: '9 mai · 14:05', xaf: 7_400_000, status: 'Prêt', tone: 'text-blue-300', dot: 'bg-blue-400' },
  { method: 'cash', beneficiary: 'Mei Lin (retrait)', date: '5 mai · 09:30', xaf: 900_000, status: 'QR généré', tone: 'text-cyan-300', dot: 'bg-cyan-400' },
  { method: 'alipay', beneficiary: 'Yiwu Trading Ltd.', date: '2 mai · 17:48', xaf: 2_100_000, status: 'Refusé', tone: 'text-rose-300', dot: 'bg-rose-400' },
];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements', active: true }, { Icon: History, label: 'Historique', badge: 2 },
  { Icon: MessageCircle, label: 'Support', badge: 1 }, { Icon: User, label: 'Profil' },
];

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#0A0C12] text-slate-100" style={{ fontFamily: fontStack }}>{children}</div>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</p>;
}
function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0A0C12]/95 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pt-2">
        {tabs.map((t) => (
          <li key={t.label} className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-1 py-1.5" style={t.active ? { color: ACCENT } : undefined}>
              <span className="relative">
                <t.Icon className={`h-[21px] w-[21px] ${t.active ? '' : 'text-slate-400'}`} strokeWidth={t.active ? 2.4 : 1.9} />
                {t.badge ? <span className="absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-[#0A0C12]" style={{ background: ACCENT }}>{t.badge}</span> : null}
              </span>
              <span className={`max-w-full truncate text-[9.5px] ${t.active ? 'font-bold' : 'font-medium text-slate-400'}`}>{t.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── list ──────────────────────────────────────────────────── */
function ListScreen() {
  return (
    <Shell>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Mes Paiements</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-400">Règlements fournisseurs en Chine</p>
        </header>

        <button className="relative mt-4 flex w-full items-center gap-4 overflow-hidden rounded-[26px] p-5 text-left text-white" style={{ background: 'linear-gradient(145deg, hsl(258 100% 64%) 0%, hsl(262 90% 54%) 60%, hsl(268 84% 46%) 100%)', boxShadow: '0 22px 50px -20px hsl(258 90% 50% / 0.75)' }}>
          <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/20"><Send className="h-7 w-7" /></span>
          <div className="relative flex-1"><p className="text-[17px] font-bold leading-tight">Nouveau paiement</p><p className="mt-0.5 text-[13px] text-white/85">Réglez votre fournisseur en quelques minutes</p></div>
          <ChevronRight className="relative h-6 w-6 text-white/80" />
        </button>

        <div className="mt-8">
          <SectionLabel>Récents</SectionLabel>
          <ul className="divide-y divide-white/[0.06]">
            {payments.map((p, i) => (
              <li key={i} className="flex items-center gap-4 py-4">
                <MethodMark method={p.method} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold leading-tight">{p.beneficiary}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} /><span className={p.tone}>{p.status}</span><span className="text-slate-600">·</span>{p.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15.5px] font-bold tabular-nums">− {groupFr(p.xaf)}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">¥ {xafToRmb(p.xaf)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── empty list ────────────────────────────────────────────── */
function EmptyScreen() {
  return (
    <Shell>
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Mes Paiements</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-400">Règlements fournisseurs en Chine</p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl" style={{ background: 'hsl(258 100% 60% / 0.12)', color: ACCENT }}><Send className="h-9 w-9" /></span>
          <p className="mt-5 text-[18px] font-bold">Aucun paiement pour le moment</p>
          <p className="mx-auto mt-1.5 max-w-[290px] text-[13.5px] leading-snug text-slate-400">Réglez vos fournisseurs chinois via Alipay, WeChat, virement ou cash.</p>
          <button className="mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[14.5px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}><Plus className="h-[18px] w-[18px]" /> Nouveau paiement</button>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard chrome ─────────────────────────────────────────────────
 * 4 named steps mirror form.steps in payments.json:
 * Mode · Montant · Bénéf. · Résumé. */
const WIZARD_STEPS = ['Mode', 'Montant', 'Bénéf.', 'Résumé'] as const;
function WizardBar({ current }: { current: number }) {
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {WIZARD_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                style={
                  active ? { background: ACCENT, color: '#fff' }
                  : done ? { background: 'hsl(258 100% 60% / 0.18)', color: ACCENT }
                  : { background: 'rgba(255,255,255,0.06)', color: '#64748b' }
                }
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {i < WIZARD_STEPS.length - 1 && (
                <span className="h-[2px] flex-1 rounded-full" style={{ background: i < current ? ACCENT : 'rgba(255,255,255,0.10)' }} />
              )}
            </div>
            <span className={`text-[10.5px] ${active ? 'font-bold' : 'font-medium'}`} style={{ color: active ? ACCENT : done ? '#94a3b8' : '#64748b' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
function WizardHeader({ title, step }: { title: string; step: number }) {
  return (
    <header className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
      <div className="flex items-center gap-3 pt-1">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ArrowLeft className="h-[19px] w-[19px] text-slate-200" /></button>
        <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
      </div>
      <WizardBar current={step} />
    </header>
  );
}

/* ── shared wizard bits (beneficiary context, fields, toggle) ── */
function ContextChip({ method, name, sub }: { method: PMethod; name: string; sub: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <MethodMark method={method} size={36} />
      <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold leading-tight">{name}</p><p className="text-[12px] text-slate-400">{sub}</p></div>
    </div>
  );
}
function Field({ label, value, optional, placeholder }: { label: string; value?: string; optional?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-slate-400">{label}{optional && <span className="text-slate-600"> (optionnel)</span>}</span>
      <div className="mt-1.5 flex h-[50px] items-center rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[14.5px]">
        {value ? <span className="font-medium text-white">{value}</span> : <span className="text-slate-500">{placeholder}</span>}
      </div>
    </label>
  );
}
function BenefToggle({ tab }: { tab: 'existing' | 'new' }) {
  return (
    <div className="mt-5 inline-flex w-full rounded-2xl bg-white/[0.06] p-1">
      {(['existing', 'new'] as const).map((t) => {
        const on = t === tab;
        return (
          <span key={t} className="flex-1 rounded-xl py-2 text-center text-[13.5px] font-semibold" style={on ? { background: ACCENT, color: '#fff' } : { color: '#94a3b8' }}>
            {t === 'existing' ? 'Enregistré' : 'Nouveau'}
          </span>
        );
      })}
    </div>
  );
}

/* ── wizard ① — method (real labels/desc + brand selection border) ── */
const methodCards: { method: PMethod; label: string; desc: string; ring: string }[] = [
  { method: 'alipay', label: 'Alipay', desc: 'Paiement via Alipay', ring: '#1677FF' },
  { method: 'wechat', label: 'WeChat Pay', desc: 'Paiement via WeChat', ring: '#07C160' },
  { method: 'bank_transfer', label: 'Virement bancaire', desc: 'Transfert vers compte bancaire', ring: '#64748b' },
  { method: 'cash', label: 'Cash', desc: 'Retrait au bureau Bonzini', ring: '#dc2626' },
];
function MethodScreen() {
  const selected: PMethod = 'alipay';
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={0} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 mb-1 text-[15px] font-semibold">Comment votre fournisseur reçoit-il l'argent ?</p>
        <p className="text-[13px] text-slate-400">Choisissez un mode de paiement.</p>
        <div className="mt-4 space-y-3">
          {methodCards.map((m) => {
            const on = m.method === selected;
            return (
              <button
                key={m.method}
                className="flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all"
                style={on
                  ? { borderColor: m.ring, background: 'rgba(255,255,255,0.04)' }
                  : { borderColor: 'rgba(255,255,255,0.10)' }}
              >
                <MethodMark method={m.method} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-semibold leading-tight">{m.label}</p>
                  <p className="mt-0.5 text-[13px] text-slate-400">{m.desc}</p>
                </div>
                {on
                  ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ background: m.ring }}><Check className="h-4 w-4" /></span>
                  : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-white/15" />}
              </button>
            );
          })}
        </div>
        <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ② — amount (XAF↔RMB, rate, balance, keypad) ────────────
 * Mirrors paymentRateLogic.ts: user types in one currency, the other is
 * derived from RATE; cap 50M XAF; balance check. Scenario: paying
 * Shenzhen Tech Co. via Alipay, entering XAF. */
const QUICK_XAF = [100_000, 250_000, 500_000, 1_000_000];
const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'];
const WALLET_XAF = 12_450_000;
function AmountScreen() {
  const amountXAF = 3_250_000;             // typed amount
  const balanceAfter = WALLET_XAF - amountXAF;
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={1} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <ContextChip method="alipay" name="Shenzhen Tech Co." sub="Alipay" />

        {/* currency toggle */}
        <div className="mt-5 flex justify-center">
          <div className="inline-flex rounded-full bg-white/[0.06] p-1">
            <span className="rounded-full px-5 py-1.5 text-[13px] font-bold text-white" style={{ background: ACCENT }}>En XAF</span>
            <span className="flex items-center gap-1 px-5 py-1.5 text-[13px] font-semibold text-slate-400"><ArrowUpDown className="h-3.5 w-3.5" /> En RMB</span>
          </div>
        </div>

        {/* amount + derived supplier-receives */}
        <div className="mt-5 text-center">
          <p className="text-[13px] font-medium text-slate-400">Vous payez</p>
          <p className="mt-1.5 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">{groupFr(amountXAF)} <span className="text-[18px] font-semibold text-slate-500">XAF</span></p>
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5" style={{ background: 'hsl(258 100% 60% / 0.12)' }}>
            <span className="text-[12.5px] text-slate-300">Fournisseur reçoit</span>
            <span className="text-[14px] font-bold tabular-nums" style={{ color: ACCENT }}>¥ {xafToRmb(amountXAF)}</span>
          </div>
        </div>

        {/* rate + balance line */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[12.5px]">
          <span className="text-slate-400">Taux appliqué</span>
          <span className="font-semibold tabular-nums">1 000 000 XAF = {xafToRmb(1_000_000)} CNY</span>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[12.5px]">
          <span className="flex items-center gap-1.5 text-slate-400"><Wallet className="h-[15px] w-[15px]" /> Solde après débit</span>
          <span className="font-semibold tabular-nums text-slate-200">{groupFr(balanceAfter)} XAF</span>
        </div>

        {/* quick amounts */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {QUICK_XAF.map((q) => {
            const on = q === 500_000;
            return <button key={q} className="rounded-xl py-2 text-center text-[12px] font-bold" style={on ? { background: 'hsl(258 100% 60% / 0.16)', color: ACCENT, boxShadow: 'inset 0 0 0 1.5px hsl(258 100% 60% / 0.4)' } : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>{groupFr(q)}</button>;
          })}
        </div>

        {/* keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {keypad.map((k) => <button key={k} className="grid h-[52px] place-items-center rounded-2xl bg-white/[0.06] text-[21px] font-semibold text-white active:bg-white/[0.12]">{k === 'back' ? <Delete className="h-[22px] w-[22px] text-slate-300" /> : k}</button>)}
        </div>

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ③ — beneficiary (saved list) ───────────────────────────
 * "Enregistré" tab: pick a saved supplier or skip ("Compléter plus
 * tard"). Real copy from form.beneficiary.* */
const savedBenefs: { method: PMethod; name: string; sub: string }[] = [
  { method: 'alipay', name: 'Shenzhen Tech Co.', sub: 'Alipay · 138****8821' },
  { method: 'wechat', name: 'Guangzhou Textiles', sub: 'WeChat · wxid_g7t2x' },
  { method: 'bank_transfer', name: 'Ningbo Imp. & Exp.', sub: 'Bank of China · ****4011' },
];
function BeneficiaryExistingScreen() {
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={2} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 text-[16px] font-semibold">À qui voulez-vous payer ?</p>
        <p className="mt-1 text-[13px] text-slate-400">Choisissez un bénéficiaire enregistré ou créez-en un nouveau.</p>
        <BenefToggle tab="existing" />
        <ul className="mt-4 space-y-2.5">
          {savedBenefs.map((b) => {
            const on = b.name === 'Shenzhen Tech Co.';
            return (
              <li key={b.name}>
                <button className="flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left" style={on ? { borderColor: ACCENT, background: 'rgba(255,255,255,0.04)' } : { borderColor: 'rgba(255,255,255,0.10)' }}>
                  <MethodMark method={b.method} size={42} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-semibold leading-tight">{b.name}</p><p className="mt-0.5 truncate text-[12px] text-slate-400">{b.sub}</p></div>
                  {on
                    ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ background: ACCENT }}><Check className="h-4 w-4" /></span>
                    : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-white/15" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
        <button className="mt-3 w-full text-center text-[13.5px] font-semibold text-slate-400">Compléter plus tard</button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ③ — new beneficiary, Alipay/WeChat variant ─────────────
 * QR upload OR id/phone/email — at least one channel
 * (validateBeneficiaryStep: alipay/wechat). */
function BeneficiaryAlipayScreen() {
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={2} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 text-[16px] font-semibold">À qui voulez-vous payer ?</p>
        <BenefToggle tab="new" />

        <ContextChip method="alipay" name="Nouveau bénéficiaire Alipay" sub="Indiquez au moins un canal" />

        {/* QR upload */}
        <div className="mt-5">
          <SectionLabel>Ajouter le QR Code</SectionLabel>
          <div className="rounded-3xl border-2 border-dashed p-6 text-center" style={{ borderColor: 'hsl(258 100% 60% / 0.45)', background: 'hsl(258 100% 60% / 0.06)' }}>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: 'hsl(258 100% 60% / 0.16)', color: ACCENT }}><QrCode className="h-7 w-7" /></span>
            <p className="mt-3 text-[15px] font-bold text-white">Ajouter le QR Code du bénéficiaire</p>
            <p className="mx-auto mt-1 max-w-[250px] text-[12.5px] text-slate-400">Capture du QR Alipay ou WeChat de votre fournisseur.</p>
            <button className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: ACCENT }}><Plus className="h-[16px] w-[16px]" /> Ajouter</button>
          </div>
        </div>

        {/* OR separator */}
        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="text-[12px] font-medium text-slate-500">ou renseignez ses coordonnées</span><span className="h-px flex-1 bg-white/10" /></div>

        {/* manual channels */}
        <div className="space-y-3.5">
          <Field label="Identifiant Alipay ou WeChat" placeholder="ex. shenzhen_tech" />
          <Field label="Numéro de téléphone" placeholder="+86 138 0000 0000" />
          <Field label="Email" optional placeholder="contact@exemple.com" />
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <Info className="mt-0.5 h-[16px] w-[16px] shrink-0" style={{ color: ACCENT }} />
          <p className="text-[12.5px] leading-snug text-slate-400">Fournissez au moins un canal (QR Code, téléphone ou email) pour que Bonzini puisse régler votre fournisseur.</p>
        </div>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
        <button className="mt-3 w-full text-center text-[13.5px] font-semibold text-slate-400">Compléter plus tard</button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ③ — new beneficiary, bank-transfer variant ─────────────
 * name + bank + account required, SWIFT/IBAN optional
 * (validateBeneficiaryStep: bank_transfer). */
function BeneficiaryBankScreen() {
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={2} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 text-[16px] font-semibold">À qui voulez-vous payer ?</p>
        <BenefToggle tab="new" />

        <ContextChip method="bank_transfer" name="Nouveau bénéficiaire" sub="Virement bancaire" />

        <div className="mt-5 space-y-3.5">
          <Field label="Nom du titulaire du compte" value="Ningbo Imp. & Exp. Co." />
          <Field label="Nom de la banque" value="Bank of China" />
          <Field label="Numéro de compte" value="6217 0000 1234 4011" />
          <Field label="SWIFT / IBAN / agence" optional placeholder="BKCHCNBJ" />
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <Info className="mt-0.5 h-[16px] w-[16px] shrink-0" style={{ color: ACCENT }} />
          <p className="text-[12.5px] leading-snug text-slate-400">Renseignez les coordonnées bancaires complètes pour que Bonzini puisse régler votre fournisseur.</p>
        </div>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
        <button className="mt-3 w-full text-center text-[13.5px] font-semibold text-slate-400">Compléter plus tard</button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ③ — cash variant: who picks up the funds ───────────────
 * self / other; if other → name + phone. QR presented at the office
 * (validateBeneficiaryStep: cash). */
function BeneficiaryCashScreen() {
  const choices = [
    { key: 'self', Icon: User, title: 'Moi-même', desc: 'Je retire les fonds au bureau Bonzini' },
    { key: 'other', Icon: Users, title: 'Une autre personne', desc: 'Indiquez son nom et son téléphone' },
  ];
  const picked = 'other';
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={2} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 text-[16px] font-semibold">Qui retire les fonds ?</p>
        <p className="mt-1 text-[13px] text-slate-400">Le bénéficiaire devra présenter un QR Code à l'agent Bonzini.</p>

        <div className="mt-5 space-y-3">
          {choices.map((c) => {
            const on = c.key === picked;
            return (
              <button key={c.key} className="flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left" style={on ? { borderColor: ACCENT, background: 'rgba(255,255,255,0.04)' } : { borderColor: 'rgba(255,255,255,0.10)' }}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: 'hsl(258 100% 60% / 0.14)', color: ACCENT }}><c.Icon className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1"><p className="text-[15.5px] font-semibold leading-tight">{c.title}</p><p className="mt-0.5 text-[13px] text-slate-400">{c.desc}</p></div>
                {on
                  ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ background: ACCENT }}><Check className="h-4 w-4" /></span>
                  : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-white/15" />}
              </button>
            );
          })}
        </div>

        {/* other-person fields appear when "Une autre personne" is picked */}
        <div className="mt-5 space-y-3.5">
          <Field label="Nom complet" value="Mei Lin" />
          <Field label="Téléphone" value="+86 139 8888 8821" />
          <Field label="Email" optional placeholder="contact@exemple.com" />
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border p-3.5" style={{ borderColor: 'hsl(258 100% 60% / 0.3)', background: 'hsl(258 100% 60% / 0.06)' }}>
          <QrCode className="mt-0.5 h-[16px] w-[16px] shrink-0" style={{ color: ACCENT }} />
          <p className="text-[12.5px] leading-snug text-slate-300">Un QR Code sera généré dès la validation. Le bénéficiaire devra le présenter à l'agent Bonzini pour retirer les fonds.</p>
        </div>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── wizard ④ — confirm (summary before creating the payment) ──────
 * Real copy from form.confirm.*: méthode, bénéficiaire, montant débité,
 * nouveau solde + debit notice. Scenario: Shenzhen Tech / Alipay. */
function ConfirmScreen() {
  const amountXAF = 3_250_000;
  const balanceAfter = WALLET_XAF - amountXAF;
  return (
    <Shell>
      <WizardHeader title="Nouveau paiement" step={3} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 text-[16px] font-semibold">Récapitulatif</p>

        {/* hero conversion */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-[13px] font-medium text-slate-400">Vous payez</p>
          <p className="mt-1.5 text-[36px] font-extrabold leading-none tracking-tight tabular-nums">{groupFr(amountXAF)} <span className="text-[16px] font-semibold text-slate-500">XAF</span></p>
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5" style={{ background: 'hsl(258 100% 60% / 0.12)' }}>
            <span className="text-[12.5px] text-slate-300">Fournisseur reçoit</span>
            <span className="text-[14px] font-bold tabular-nums" style={{ color: ACCENT }}>¥ {xafToRmb(amountXAF)}</span>
          </div>
        </div>

        {/* details */}
        <div className="mt-5 divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.04] px-4">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="text-[13.5px] text-slate-400">Mode de paiement</span>
            <span className="flex items-center gap-2 text-[14px] font-semibold"><MethodMark method="alipay" size={24} /> Alipay</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="text-[13.5px] text-slate-400">Bénéficiaire</span>
            <span className="truncate text-[14px] font-semibold">Shenzhen Tech Co.</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="text-[13.5px] text-slate-400">Taux appliqué</span>
            <span className="text-[14px] font-semibold tabular-nums">1 000 000 XAF = {xafToRmb(1_000_000)} CNY</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="text-[13.5px] text-slate-400">Montant débité</span>
            <span className="text-[14px] font-bold tabular-nums">{groupFr(amountXAF)} XAF</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="text-[13.5px] text-slate-400">Nouveau solde</span>
            <span className="text-[14px] font-semibold tabular-nums text-slate-200">{groupFr(balanceAfter)} XAF</span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <Info className="mt-0.5 h-[16px] w-[16px] shrink-0" style={{ color: ACCENT }} />
          <p className="text-[12.5px] leading-snug text-slate-400">Votre solde sera débité à la confirmation.</p>
        </div>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}><Check className="h-[18px] w-[18px]" /> Confirmer le paiement</button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── success — payment created (success.* copy) ───────────────────── */
function SuccessScreen() {
  const amountXAF = 3_250_000;
  return (
    <Shell>
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-5 pb-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full" style={{ background: 'hsl(258 100% 60% / 0.14)', color: ACCENT }}><CheckCircle2 className="h-12 w-12" /></span>
          <p className="mt-6 text-[24px] font-extrabold tracking-tight">Paiement créé !</p>
          <p className="mt-1.5 text-[14px] text-slate-400">Votre demande a été enregistrée</p>

          <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-center gap-2">
              <MethodMark method="alipay" size={28} />
              <span className="text-[14px] font-semibold">Shenzhen Tech Co.</span>
            </div>
            <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{groupFr(amountXAF)} <span className="text-[14px] font-semibold text-slate-500">XAF</span></p>
            <p className="mt-1.5 text-[12.5px] text-slate-400">débités · fournisseur reçoit <span className="font-semibold" style={{ color: ACCENT }}>¥ {xafToRmb(amountXAF)}</span></p>
          </div>
        </div>

        <div className="space-y-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}><FileText className="h-[18px] w-[18px]" /> Voir la fiche</button>
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-4 text-[14.5px] font-semibold text-slate-200"><Plus className="h-[17px] w-[17px]" /> Nouveau paiement</button>
          <button className="flex w-full items-center justify-center gap-2 py-1.5 text-[13.5px] font-semibold text-slate-400"><Home className="h-[16px] w-[16px]" /> Retour à l'accueil</button>
        </div>
      </div>
    </Shell>
  );
}

/* ── payment detail (fiche) — standard statuses ────────────────────
 * Mirrors the real payment_status values + detail.* copy. Scenario:
 * paying Shenzhen Tech Co. via Alipay, 3 250 000 XAF. */
type PStatus = 'ready' | 'processing' | 'completed' | 'rejected';
const P_STATUS_CFG: Record<PStatus, { label: string; pill: string; Icon: typeof Clock }> = {
  ready: { label: 'Prêt à payer', pill: 'bg-purple-400/15 text-purple-300', Icon: Check },
  processing: { label: 'En cours', pill: 'bg-amber-400/15 text-amber-300', Icon: Clock },
  completed: { label: 'Effectué', pill: 'bg-emerald-400/15 text-emerald-300', Icon: Check },
  rejected: { label: 'Refusé', pill: 'bg-rose-400/15 text-rose-300', Icon: X },
};
function PaymentDetailScreen({ status }: { status: PStatus }) {
  const c = P_STATUS_CFG[status];
  const amountXAF = 3_250_000;
  const dateLabel = status === 'completed' ? 'Traité le' : status === 'rejected' ? 'Refusé le' : 'Créé le';
  return (
    <Shell>
      <header className="flex items-center justify-between px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <div className="flex items-center gap-3 pt-1">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ArrowLeft className="h-[19px] w-[19px] text-slate-200" /></button>
          <div><h1 className="text-[18px] font-bold leading-none tracking-tight">Paiement</h1><p className="mt-1 text-[12px] font-medium text-slate-500">PAY-2024-0117</p></div>
        </div>
        {status === 'completed' && <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><Download className="h-[18px] w-[18px] text-slate-200" /></button>}
      </header>

      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* amount card */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-300"><MethodMark method="alipay" size={22} /> Shenzhen Tech Co.</span>
          <p className="mt-3 text-[38px] font-extrabold leading-none tracking-tight tabular-nums">{groupFr(amountXAF)} <span className="text-[16px] font-semibold text-slate-400">XAF</span></p>
          <p className="mt-2 text-[12.5px] text-slate-400">Fournisseur reçoit <span className="font-bold" style={{ color: ACCENT }}>¥ {xafToRmb(amountXAF)}</span></p>
          <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${c.pill}`}><c.Icon className="h-3.5 w-3.5" /> {c.label}</span>
        </div>

        {/* status banner */}
        {status === 'ready' && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'hsl(258 100% 60% / 0.35)', background: 'hsl(258 100% 60% / 0.08)' }}>
            <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ACCENT }} />
            <div><p className="text-[14px] font-bold text-purple-200">Prêt à être traité</p><p className="mt-0.5 text-[12.5px] text-purple-100/70">Bonzini va régler votre fournisseur rapidement.</p></div>
          </div>
        )}
        {status === 'processing' && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)' }}>
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div><p className="text-[14px] font-bold text-amber-300">Règlement en cours</p><p className="mt-0.5 text-[12.5px] text-amber-100/70">Bonzini prépare le paiement de votre fournisseur.</p></div>
          </div>
        )}
        {status === 'completed' && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)' }}>
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div><p className="text-[14px] font-bold text-emerald-300">Fournisseur payé</p><p className="mt-0.5 text-[12.5px] text-emerald-100/70">Le règlement a été effectué. Consultez les preuves ci-dessous.</p></div>
          </div>
        )}
        {status === 'rejected' && (
          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.08)' }}>
            <div className="flex items-center gap-2"><AlertTriangle className="h-[18px] w-[18px] text-rose-400" /><p className="text-[14px] font-bold text-rose-300">Paiement refusé</p></div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-rose-100/80"><span className="font-semibold text-rose-200">Motif :</span> compte bancaire incorrect. Le montant a été recrédité sur votre solde.</p>
          </div>
        )}

        {/* Bonzini proofs (completed only) */}
        {status === 'completed' && (
          <div className="mt-6">
            <SectionLabel>Preuves Bonzini (2)</SectionLabel>
            <div className="flex gap-3">
              <div className="grid h-[76px] w-[76px] place-items-center rounded-2xl bg-white/[0.06] text-slate-400"><FileText className="h-7 w-7" /></div>
              <div className="grid h-[76px] w-[76px] place-items-center rounded-2xl bg-white/[0.06] text-slate-400"><FileText className="h-7 w-7" /></div>
            </div>
          </div>
        )}

        {/* beneficiary */}
        <div className="mt-6">
          <SectionLabel>Bénéficiaire</SectionLabel>
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.04] px-4">
            {[
              { k: 'Nom', v: 'Shenzhen Tech Co.' },
              { k: 'Identifiant', v: 'shenzhen_tech', mono: true },
              { k: 'Téléphone', v: '+86 138 0000 8821' },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between py-3"><span className="text-[13.5px] text-slate-400">{r.k}</span><span className={`text-[14px] font-semibold ${r.mono ? 'font-mono' : ''}`}>{r.v}</span></div>
            ))}
          </div>
        </div>

        {/* informations */}
        <div className="mt-6">
          <SectionLabel>Informations</SectionLabel>
          <div className="divide-y divide-white/[0.06]">
            {[
              { k: 'Mode', v: 'Alipay' },
              { k: 'Référence', v: 'PAY-2024-0117', mono: true },
              { k: 'Taux de change', v: `1 000 000 XAF = ${xafToRmb(1_000_000)} CNY` },
              { k: 'Montant XAF', v: `${groupFr(amountXAF)} XAF` },
              { k: 'Montant RMB', v: `¥ ${xafToRmb(amountXAF)}` },
              { k: dateLabel, v: '29 mai 2026 · 09:14' },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between py-3"><span className="text-[13.5px] text-slate-400">{r.k}</span><span className={`text-[14px] font-semibold ${r.mono ? 'font-mono' : ''}`}>{r.v}</span></div>
            ))}
          </div>
        </div>

        {/* primary action by status */}
        {status === 'completed' && (
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14.5px] font-bold text-white" style={{ background: '#059669' }}><Download className="h-[18px] w-[18px]" /> Télécharger le reçu</button>
        )}
        {status === 'rejected' && (
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14.5px] font-bold text-white" style={{ background: ACCENT }}><Send className="h-[17px] w-[17px]" /> Refaire ce paiement</button>
        )}

        {/* suivi — collapsible */}
        <button className="mt-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-[14px] font-semibold"><Clock className="h-[18px] w-[18px] text-purple-300" /> Suivi du paiement</span>
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </button>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function PaymentPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  if (screen === 'method') return <MethodScreen />;
  if (screen === 'amount') return <AmountScreen />;
  if (screen === 'beneficiary-existing') return <BeneficiaryExistingScreen />;
  if (screen === 'beneficiary-alipay') return <BeneficiaryAlipayScreen />;
  if (screen === 'beneficiary-bank') return <BeneficiaryBankScreen />;
  if (screen === 'beneficiary-cash') return <BeneficiaryCashScreen />;
  if (screen === 'confirm') return <ConfirmScreen />;
  if (screen === 'success') return <SuccessScreen />;
  if (screen === 'detail-ready') return <PaymentDetailScreen status="ready" />;
  if (screen === 'detail-processing') return <PaymentDetailScreen status="processing" />;
  if (screen === 'detail-completed') return <PaymentDetailScreen status="completed" />;
  if (screen === 'detail-rejected') return <PaymentDetailScreen status="rejected" />;
  return <ListScreen />;
}
