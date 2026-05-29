// Taux module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=rate-<screen>.
// Client-side, read-only rate view: mirrors DailyRate + PAYMENT_METHODS /
// COUNTRIES / TIERS from src/types/rates.ts. Accent = amber (the repo's
// "exchange rate display" colour, per .claude/rules/frontend.md).
import {
  ArrowLeft, ArrowUpDown, TrendingUp, Info,
  Home, ArrowDownToLine, Send, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const AMBER = 'hsl(36 100% 55%)';
const groupFr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ── methods (real keys + brand colours from PAYMENT_METHODS) ─────── */
type MethodKey = 'cash' | 'alipay' | 'wechat' | 'virement';
const METHODS: { key: MethodKey; label: string; color: string; ratePerM: number }[] = [
  { key: 'cash', label: 'Cash', color: '#10b981', ratePerM: 11_900 },
  { key: 'alipay', label: 'Alipay', color: '#1677ff', ratePerM: 11_765 },
  { key: 'wechat', label: 'WeChat', color: '#07c160', ratePerM: 11_720 },
  { key: 'virement', label: 'Virement', color: '#8b5cf6', ratePerM: 11_540 },
];

const COUNTRIES = [
  { key: 'cameroun', label: 'Cameroun', flag: '🇨🇲' },
  { key: 'gabon', label: 'Gabon', flag: '🇬🇦' },
  { key: 'tchad', label: 'Tchad', flag: '🇹🇩' },
  { key: 'rca', label: 'Centrafrique', flag: '🇨🇫' },
  { key: 'congo', label: 'Congo', flag: '🇨🇬' },
  { key: 'guinee', label: 'Guinée Éq.', flag: '🇬🇶' },
];

const QUICK = [100_000, 250_000, 500_000, 1_000_000, 2_000_000];

// 7-day trend for the active method (CNY per 1M XAF), for the sparkline.
const TREND = [11_690, 11_705, 11_700, 11_730, 11_748, 11_752, 11_765];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique' },
  { Icon: MessageCircle, label: 'Support' }, { Icon: User, label: 'Profil' },
];

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#0A0C12] text-slate-100" style={{ fontFamily: fontStack }}>{children}</div>;
}
function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0A0C12]/95 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pt-2">
        {tabs.map((t) => (
          <li key={t.label} className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-1 py-1.5">
              <t.Icon className="h-[21px] w-[21px] text-slate-400" strokeWidth={1.9} />
              <span className="max-w-full truncate text-[9.5px] font-medium text-slate-400">{t.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── sparkline (inline SVG) ────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 300, h = 64, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 64 }}>
      <defs>
        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rateGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
    </svg>
  );
}

/* ── main client rates screen ──────────────────────────────────── */
function RatesScreen() {
  const method = METHODS[1]; // Alipay active
  const amountXAF = 1_000_000;
  const amountCNY = Math.round((amountXAF / 1_000_000) * method.ratePerM);
  const country = COUNTRIES[0];

  return (
    <Shell>
      <header className="flex items-center gap-3 px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ArrowLeft className="h-[19px] w-[19px] text-slate-200" /></button>
        <h1 className="pt-1 text-[19px] font-bold tracking-tight">Taux de change</h1>
      </header>

      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* hero rate card (amber) */}
        <div className="relative mt-4 overflow-hidden rounded-[26px] p-6" style={{ background: 'linear-gradient(150deg, hsl(36 100% 52%) 0%, hsl(28 95% 48%) 55%, hsl(20 90% 44%) 100%)', boxShadow: '0 22px 50px -20px hsl(32 95% 48% / 0.7)' }}>
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">Taux du jour · {method.label}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white"><TrendingUp className="h-3 w-3" /> +0.6 %</span>
          </div>
          <p className="relative mt-3 text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums">{groupFr(method.ratePerM)} <span className="text-[15px] font-semibold text-white/80">CNY</span></p>
          <p className="relative mt-1.5 text-[13px] text-white/85">pour 1 000 000 XAF · {country.flag} {country.label}</p>
        </div>

        {/* country selector */}
        <p className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pays</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {COUNTRIES.map((c, i) => {
            const on = i === 0;
            return (
              <span key={c.key} className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold" style={on ? { background: AMBER, color: '#1a1206' } : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                <span className="text-[15px]">{c.flag}</span>{c.label}
              </span>
            );
          })}
        </div>

        {/* method selector */}
        <p className="mt-5 mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mode de paiement</p>
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map((m) => {
            const on = m.key === method.key;
            return (
              <div key={m.key} className="rounded-2xl border-2 p-2.5 text-center" style={on ? { borderColor: m.color, background: 'rgba(255,255,255,0.04)' } : { borderColor: 'rgba(255,255,255,0.10)' }}>
                <span className="mx-auto block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                <p className="mt-1.5 text-[12px] font-semibold">{m.label}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{groupFr(m.ratePerM)}</p>
              </div>
            );
          })}
        </div>

        {/* converter */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Convertisseur</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: AMBER }}><ArrowUpDown className="h-3.5 w-3.5" /> XAF → CNY</span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
            <span className="text-[13px] text-slate-400">Vous payez</span>
            <span className="text-[18px] font-bold tabular-nums">{groupFr(amountXAF)} <span className="text-[12px] text-slate-500">XAF</span></span>
          </div>
          <div className="my-1.5 flex justify-center"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06]"><ArrowUpDown className="h-3.5 w-3.5 text-slate-400" /></span></div>
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'hsl(36 100% 55% / 0.10)' }}>
            <span className="text-[13px] text-slate-300">Fournisseur reçoit</span>
            <span className="text-[18px] font-extrabold tabular-nums" style={{ color: AMBER }}>¥ {groupFr(amountCNY)}</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {QUICK.map((q) => (
              <span key={q} className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={q === amountXAF ? { background: 'hsl(36 100% 55% / 0.16)', color: AMBER, boxShadow: 'inset 0 0 0 1.5px hsl(36 100% 55% / 0.4)' } : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>{groupFr(q)}</span>
            ))}
          </div>
        </div>

        {/* trend */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Tendance · 7 jours</p>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> +0.6 %</span>
          </div>
          <div className="mt-3"><Sparkline data={TREND} color={method.color} /></div>
        </div>

        {/* info banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border p-3.5" style={{ borderColor: 'hsl(36 100% 55% / 0.3)', background: 'hsl(36 100% 55% / 0.06)' }}>
          <Info className="mt-0.5 h-[16px] w-[16px] shrink-0" style={{ color: AMBER }} />
          <p className="text-[12.5px] leading-snug text-slate-300">Taux indicatif, mis à jour quotidiennement. Le taux définitif est figé au moment de la confirmation de votre paiement.</p>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function RatesPreviews(_props: { screen?: string }) {
  return <RatesScreen />;
}
