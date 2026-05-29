// Option 1 (retravaillée) — thème SOMBRE, accent ROUGE, navigation complète.
// Neutral dark foundation + ONE accent (warm red) used with precision.
// Home CTA "Payer un fournisseur"; "Ajouter de l'argent" opens the deposit
// module. Bottom nav mirrors the real client IA (6 tabs + badges).
import {
  Bell, Eye, Send, Plus, Users, TrendingUp, ChevronRight,
  ArrowDownLeft, ArrowUpRight,
  Home, ArrowDownToLine, History, MessageCircle, User,
} from 'lucide-react';
import { fx, fontStack } from './walletFixtures';

const ACCENT = 'hsl(16 100% 55%)';            // brand orange (logo "n")
const ACCENT_DEEP_DARK = 'hsl(18 92% 47%)';   // balance card on dark
const ACCENT_DEEP_LIGHT = 'hsl(20 92% 52%)';  // balance card on light

const secondary = [
  { icon: Plus, label: "Ajouter de l'argent" },
  { icon: Users, label: 'Bénéficiaires' },
  { icon: TrendingUp, label: 'Taux du jour' },
];

// Full client navigation (matches src/components/layout/BottomNav.tsx)
const tabs = [
  { icon: Home, label: 'Accueil', active: true },
  { icon: ArrowDownToLine, label: 'Dépôts' },
  { icon: Send, label: 'Paiements' },
  { icon: History, label: 'Historique', badge: 2 },
  { icon: MessageCircle, label: 'Support', badge: 1 },
  { icon: User, label: 'Profil' },
];

export default function WalletPreviewS1({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const d = theme === 'dark';
  return (
    <div className={`min-h-[100dvh] ${d ? 'bg-[#0A0C12] text-slate-100' : 'bg-[#FCFCFD] text-slate-900'}`} style={{ fontFamily: fontStack }}>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        {/* Header */}
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <img src="/assets/bonzini-logo.jpg" alt="Bonzini" className="h-full w-full object-cover" />
            </span>
            <div>
              <p className="text-[12px] font-medium leading-none text-slate-400">Bonjour,</p>
              <h1 className="mt-1 text-[17px] font-bold leading-none tracking-tight">Aristide Mballa</h1>
            </div>
          </div>
          <button className={`relative grid h-11 w-11 place-items-center rounded-full border ${d ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <Bell className={`h-[18px] w-[18px] ${d ? 'text-slate-300' : 'text-slate-600'}`} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full" style={{ background: ACCENT }} />
          </button>
        </header>

        {/* Balance — single calm brand card (red) */}
        <section className="mt-5 rounded-3xl p-6 text-white" style={{ background: d ? ACCENT_DEEP_DARK : ACCENT_DEEP_LIGHT }}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/75">Solde disponible</span>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15"><Eye className="h-4 w-4 text-white/90" /></button>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums">{fx.balanceXAF}</span>
            <span className="pb-1 text-[15px] font-semibold text-white/70">XAF</span>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-3">
            <span className="text-[13px] text-white/85">Taux Alipay · {fx.rateLine}</span>
            <ChevronRight className="h-4 w-4 text-white/65" />
          </div>
        </section>

        {/* Primary action */}
        <button className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold ${d ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
          <Send className="h-[18px] w-[18px]" /> Payer un fournisseur
        </button>

        {/* Secondary tiles */}
        <section className="mt-3 grid grid-cols-3 gap-3">
          {secondary.map((s) => (
            <button key={s.label} className={`flex flex-col items-center gap-2 rounded-2xl border py-3.5 ${d ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200/70 bg-white'}`}>
              <s.icon className={`h-[20px] w-[20px] ${d ? 'text-slate-200' : 'text-slate-700'}`} />
              <span className={`px-1 text-center text-[11px] font-medium leading-tight ${d ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
            </button>
          ))}
        </section>

        {/* Activity — hairline list */}
        <section className="mt-7">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight">Activité</h2>
            <button className="text-[13px] font-semibold" style={{ color: ACCENT }}>Tout voir</button>
          </div>
          <ul className={`divide-y ${d ? 'divide-white/5' : 'divide-slate-100'}`}>
            {fx.operations.slice(0, 4).map((op) => {
              const credit = op.type === 'CREDIT';
              return (
                <li key={op.id} className="flex items-center gap-3.5 py-3.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${credit ? (d ? 'bg-emerald-400/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (d ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-500')}`}>
                    {credit ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{op.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-400">{op.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-semibold tabular-nums ${credit ? (d ? 'text-emerald-400' : 'text-emerald-600') : ''}`}>{op.amount}</p>
                    <p className="text-[11px] text-slate-400">XAF</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Bottom nav — full client IA (6 tabs + badges) */}
      <nav className={`fixed inset-x-0 bottom-0 z-50 border-t ${d ? 'border-white/10 bg-[#0A0C12]/95' : 'border-slate-100 bg-white/95'} backdrop-blur-xl`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pt-2">
          {tabs.map((t) => (
            <li key={t.label} className="min-w-0 flex-1">
              <div className="flex flex-col items-center gap-1 py-1.5" style={t.active ? { color: ACCENT } : undefined}>
                <span className="relative">
                  <t.icon className={`h-[21px] w-[21px] ${t.active ? '' : 'text-slate-400'}`} strokeWidth={t.active ? 2.4 : 1.9} />
                  {t.badge ? (
                    <span className="absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9px] font-bold text-white ring-2" style={{ background: ACCENT, ['--tw-ring-color' as string]: d ? '#0A0C12' : '#ffffff' }}>{t.badge}</span>
                  ) : null}
                </span>
                <span className={`max-w-full truncate text-[9.5px] ${t.active ? 'font-bold' : 'font-medium text-slate-400'}`}>{t.label}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
