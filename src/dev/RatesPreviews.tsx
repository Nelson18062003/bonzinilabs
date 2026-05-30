// Taux — client rate view, premium pass aligned with WalletPreviewPremium.
// Sub-page (reached from Accueil) → header with back, NO bottom tab bar.
// Theme-aware (light + dark). Mirrors rates.ts (DailyRate, PAYMENT_METHODS,
// COUNTRIES). Amber is the brand "exchange rate" colour (frontend.md).
import {
  ArrowLeft, TrendingUp, ArrowDown, Info, Share2,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const groupFr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

type MethodKey = 'cash' | 'alipay' | 'wechat' | 'virement';
const METHODS: { key: MethodKey; label: string; color: string; ratePerM: number; delta: string; up: boolean }[] = [
  { key: 'cash', label: 'Cash', color: '#10b981', ratePerM: 11_900, delta: '+0,3 %', up: true },
  { key: 'alipay', label: 'Alipay', color: '#1677ff', ratePerM: 11_765, delta: '+0,6 %', up: true },
  { key: 'wechat', label: 'WeChat', color: '#07c160', ratePerM: 11_720, delta: '-0,2 %', up: false },
  { key: 'virement', label: 'Virement', color: '#8b5cf6', ratePerM: 11_540, delta: '+0,1 %', up: true },
];
const COUNTRIES = [
  { key: 'cameroun', label: 'Cameroun', flag: '🇨🇲' },
  { key: 'gabon', label: 'Gabon', flag: '🇬🇦' },
  { key: 'tchad', label: 'Tchad', flag: '🇹🇩' },
  { key: 'rca', label: 'Centrafrique', flag: '🇨🇫' },
  { key: 'congo', label: 'Congo', flag: '🇨🇬' },
  { key: 'guinee', label: 'Guinée Éq.', flag: '🇬🇶' },
];
const QUICK = [250_000, 500_000, 1_000_000, 2_000_000];
const TREND = [11_640, 11_705, 11_688, 11_730, 11_712, 11_752, 11_765];

/* Sparkline with gradient fill + glow dot */
function Sparkline({ data, color, h = 76 }: { data: number[]; color: string; h?: number }) {
  const w = 320, pad = 6;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (w - pad * 2), pad + (1 - (v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }}>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="6" fill={color} opacity="0.25" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function RatesScreen({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const d = theme === 'dark';
  const method = METHODS[1]; // Alipay
  const country = COUNTRIES[0];
  const amountXAF = 1_000_000;
  const amountCNY = Math.round((amountXAF / 1_000_000) * method.ratePerM);

  const card = d ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200/70 bg-white';
  const sub = d ? 'text-slate-400' : 'text-slate-500';
  const faint = d ? 'bg-white/[0.05]' : 'bg-slate-100';

  return (
    <div className={`min-h-[100dvh] ${d ? 'bg-[#0A0C12] text-slate-100' : 'bg-[#FCFCFD] text-slate-900'}`} style={{ fontFamily: fontStack }}>
      <div className="mx-auto max-w-[480px] px-5 pb-10" style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)' }}>
        {/* header — back + share, no tab bar (sub-page) */}
        <header className="flex items-center justify-between pt-2">
          <button className={`grid h-10 w-10 place-items-center rounded-full border ${d ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <h1 className="text-[16px] font-bold tracking-tight">Taux de change</h1>
          <button className={`grid h-10 w-10 place-items-center rounded-full border ${d ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}><Share2 className="h-[17px] w-[17px]" /></button>
        </header>

        {/* hero — premium amber market card */}
        <section className="relative mt-5 overflow-hidden rounded-[28px] p-6 text-white"
          style={{ background: 'linear-gradient(145deg, hsl(38 98% 54%) 0%, hsl(28 92% 48%) 55%, hsl(18 86% 43%) 100%)', boxShadow: '0 24px 60px -22px hsl(30 92% 46% / 0.7)' }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 text-[12px] font-semibold ring-1 ring-white/25 backdrop-blur-md">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/25 text-[10px]">{country.flag}</span> {country.label}
              </span>
              <span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-950">{method.delta}</span>
            </div>
            <p className="mt-5 text-[13px] font-medium text-white/80">Taux du jour · {method.label}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-[44px] font-extrabold leading-[0.85] tracking-tight tabular-nums">{groupFr(method.ratePerM)}</span>
              <span className="pb-1.5 text-[16px] font-semibold text-white/75">CNY</span>
            </div>
            <p className="mt-1.5 text-[13px] text-white/80">pour 1 000 000 XAF</p>

            {/* inline sparkline on the hero — frosted */}
            <div className="mt-5 rounded-2xl bg-white/12 p-3 ring-1 ring-white/20 backdrop-blur-md">
              <div className="mb-1 flex items-center justify-between text-[11px] text-white/80">
                <span>7 derniers jours</span>
                <span className="inline-flex items-center gap-1 font-semibold"><TrendingUp className="h-3 w-3" /> {method.delta}</span>
              </div>
              <Sparkline data={TREND} color="#ffffff" h={48} />
            </div>
          </div>
        </section>

        {/* country chips */}
        <p className={`mt-6 mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${sub}`}>Pays</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {COUNTRIES.map((c, i) => {
            const on = i === 0;
            return (
              <span key={c.key} className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition"
                style={on
                  ? { background: 'hsl(36 100% 55%)', color: '#1a1206', boxShadow: '0 8px 20px -8px hsl(36 100% 50% / 0.6)' }
                  : (d ? { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' } : { background: '#f1f5f9', color: '#64748b' })}>
                <span className="text-[15px]">{c.flag}</span>{c.label}
              </span>
            );
          })}
        </div>

        {/* method cards — active one wears its brand colour */}
        <p className={`mt-6 mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${sub}`}>Mode de paiement</p>
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((m) => {
            const on = m.key === method.key;
            return (
              <div key={m.key} className="relative overflow-hidden rounded-2xl border p-4 transition"
                style={on
                  ? { borderColor: m.color, background: d ? `${m.color}14` : `${m.color}0f`, boxShadow: `0 12px 28px -14px ${m.color}80` }
                  : (d ? { borderColor: 'rgba(255,255,255,0.10)' } : { borderColor: 'rgba(15,23,42,0.10)' })}>
                {on && <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl" style={{ background: m.color, opacity: 0.4 }} />}
                <div className="relative flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="text-[13.5px] font-semibold">{m.label}</span>
                  </span>
                  <span className={`text-[11px] font-bold ${m.up ? 'text-emerald-400' : 'text-rose-400'}`}>{m.delta}</span>
                </div>
                <p className="relative mt-2 text-[20px] font-extrabold leading-none tracking-tight tabular-nums">{groupFr(m.ratePerM)}</p>
                <p className={`relative mt-1 text-[11px] ${sub}`}>CNY / 1M XAF</p>
              </div>
            );
          })}
        </div>

        {/* converter — the interactive heart */}
        <div className={`mt-6 rounded-3xl border p-5 ${card}`} style={d ? { boxShadow: '0 20px 50px -30px rgba(0,0,0,0.6)' } : { boxShadow: '0 18px 44px -28px rgba(15,23,42,0.25)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold tracking-tight">Convertisseur</p>
            <span className="text-[12px] font-semibold" style={{ color: 'hsl(36 100% 50%)' }}>Taux {method.label}</span>
          </div>
          <div className={`mt-3 rounded-2xl px-4 py-3.5 ${faint}`}>
            <p className={`text-[11px] font-medium ${sub}`}>Vous payez</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[26px] font-extrabold tracking-tight tabular-nums">{groupFr(amountXAF)}</span>
              <span className={`text-[13px] font-semibold ${sub}`}>XAF</span>
            </div>
          </div>
          <div className="relative my-1 flex justify-center">
            <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: 'hsl(36 100% 52%)', boxShadow: '0 8px 18px -6px hsl(36 100% 50% / 0.7)' }}><ArrowDown className="h-4 w-4" /></span>
          </div>
          <div className="rounded-2xl px-4 py-3.5" style={{ background: d ? 'hsl(36 100% 55% / 0.12)' : 'hsl(36 100% 55% / 0.10)' }}>
            <p className="text-[11px] font-medium" style={{ color: d ? 'hsl(36 90% 70%)' : 'hsl(28 80% 42%)' }}>Votre fournisseur reçoit</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: 'hsl(32 95% 50%)' }}>¥ {groupFr(amountCNY)}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {QUICK.map((q) => (
              <span key={q} className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                style={q === amountXAF
                  ? { background: 'hsl(36 100% 55% / 0.18)', color: 'hsl(32 95% 50%)', boxShadow: 'inset 0 0 0 1.5px hsl(36 100% 55% / 0.45)' }
                  : (d ? { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' } : { background: '#f1f5f9', color: '#475569' })}>{groupFr(q)}</span>
            ))}
          </div>
        </div>

        {/* info — quiet, single line */}
        <div className={`mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 ${d ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
          <Info className="mt-0.5 h-[15px] w-[15px] shrink-0" style={{ color: 'hsl(36 100% 50%)' }} />
          <p className={`text-[12px] leading-snug ${sub}`}>Taux indicatif, actualisé chaque jour. Le taux définitif est figé à la confirmation de votre paiement.</p>
        </div>
      </div>
    </div>
  );
}

export default function RatesPreviews({ screen = 'main' }: { screen?: string }) {
  return <RatesScreen theme={screen === 'light' ? 'light' : 'dark'} />;
}
