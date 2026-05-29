// Paiements module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=pay-<screen>.
// Mirrors the real model: 4 methods (alipay/wechat/bank_transfer/cash),
// XAF↔RMB amounts, the 9 payment_status values, and the FR copy from
// src/i18n/locales/fr/payments.json. Activity = paying Chinese suppliers.
import {
  ArrowLeft, Plus, ChevronRight, Send, Building2, Banknote,
  Home, ArrowDownToLine, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

// Module accent: violet (logo wings) — distinguishes Paiements (money out
// to China) from Dépôts (orange, money in).
const ACCENT = 'hsl(258 100% 60%)';

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

/* ── fixtures (FR, paying Chinese suppliers) ───────────────── */
const payments: {
  method: PMethod; beneficiary: string; date: string; xaf: string; rmb: string;
  status: string; tone: string; dot: string;
}[] = [
  { method: 'alipay', beneficiary: 'Shenzhen Tech Co.', date: "Aujourd'hui · 16:42", xaf: '3 250 000', rmb: '18 950', status: 'En cours', tone: 'text-purple-300', dot: 'bg-purple-400' },
  { method: 'wechat', beneficiary: 'Guangzhou Textiles', date: '12 mai · 11:20', xaf: '1 800 000', rmb: '10 500', status: 'Effectué', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
  { method: 'bank_transfer', beneficiary: 'Ningbo Imp. & Exp.', date: '9 mai · 14:05', xaf: '7 400 000', rmb: '43 160', status: 'Prêt', tone: 'text-blue-300', dot: 'bg-blue-400' },
  { method: 'cash', beneficiary: 'Mei Lin (retrait)', date: '5 mai · 09:30', xaf: '900 000', rmb: '5 250', status: 'QR généré', tone: 'text-cyan-300', dot: 'bg-cyan-400' },
  { method: 'alipay', beneficiary: 'Yiwu Trading Ltd.', date: '2 mai · 17:48', xaf: '2 100 000', rmb: '12 250', status: 'Refusé', tone: 'text-rose-300', dot: 'bg-rose-400' },
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
                  <p className="text-[15.5px] font-bold tabular-nums">− {p.xaf}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">¥ {p.rmb}</p>
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

export default function PaymentPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  return <ListScreen />;
}
