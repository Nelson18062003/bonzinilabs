// Direction B — "Refonte fraîche" : dark premium, aurora néon.
// Brings the polished dark aesthetic of the marketing landing INTO the
// app (marketing → product cohesion). Bold, modern, high-contrast.
import {
  Bell, Eye, ArrowDownToLine, Send, Users, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Home, Clock, User, ChevronRight,
} from 'lucide-react';
import { fx, fontStack } from './walletFixtures';

const actions = [
  { icon: ArrowDownToLine, label: 'Déposer', ring: 'ring-emerald-400/30', glow: 'text-emerald-300', bg: 'bg-emerald-400/10' },
  { icon: Send, label: 'Payer', ring: 'ring-violet-400/40', glow: 'text-violet-300', bg: 'bg-violet-400/10' },
  { icon: Users, label: 'Bénéficiaires', ring: 'ring-amber-400/30', glow: 'text-amber-300', bg: 'bg-amber-400/10' },
  { icon: TrendingUp, label: 'Taux', ring: 'ring-orange-400/30', glow: 'text-orange-300', bg: 'bg-orange-400/10' },
];

const tabs = [
  { icon: Home, label: 'Accueil', active: true },
  { icon: ArrowDownToLine, label: 'Dépôts' },
  { icon: Send, label: 'Payer' },
  { icon: Clock, label: 'Activité' },
  { icon: User, label: 'Profil' },
];

export default function WalletPreviewB() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#08060F] text-white" style={{ fontFamily: fontStack }}>
      {/* Aurora background */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-600/30 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-28 h-64 w-64 rounded-full bg-orange-500/20 blur-[90px]" />

      <div className="relative mx-auto max-w-[480px] px-5 pb-32" style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)' }}>
        {/* Header */}
        <header className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] font-medium text-violet-300/70">Bonjour 👋</p>
            <h1 className="text-[20px] font-bold tracking-tight leading-tight">{fx.firstName} Mballa</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative grid h-11 w-11 place-items-center rounded-full bg-white/5 border border-white/10">
              <Bell className="h-[18px] w-[18px] text-white/80" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-orange-400 ring-2 ring-[#08060F]" />
            </button>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-orange-400 text-white text-[15px] font-bold ring-1 ring-white/20">A</div>
          </div>
        </header>

        {/* Balance hero — dark glass */}
        <section className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-violet-500/25 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-white/55">Solde disponible</span>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                <Eye className="h-4 w-4 text-white/80" />
              </button>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[42px] font-extrabold leading-none tracking-tight tabular-nums">{fx.balanceXAF}</span>
              <span className="pb-1 text-[15px] font-semibold text-white/55">XAF</span>
            </div>
            <p className="mt-1.5 text-[15px] font-medium text-white/60">≈ {fx.rmbApprox} pour vos fournisseurs</p>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_10px_2px_rgba(251,146,60,0.7)]" />
                <div className="leading-tight">
                  <p className="text-[11px] text-white/45">Taux Alipay du jour</p>
                  <p className="text-[13px] font-semibold text-violet-200">{fx.rateLine}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-5 grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button key={a.label} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 active:scale-95 transition">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${a.ring} ${a.bg} ${a.glow}`}>
                <a.icon className="h-[20px] w-[20px]" />
              </span>
              <span className="text-[11px] font-semibold text-white/75">{a.label}</span>
            </button>
          ))}
        </section>

        {/* Recent operations */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold tracking-tight">Activité récente</h2>
            <button className="text-[13px] font-semibold text-violet-300">Voir tout</button>
          </div>
          <div className="space-y-2.5">
            {fx.operations.slice(0, 3).map((op) => {
              const credit = op.type === 'CREDIT';
              return (
                <div key={op.id} className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${credit ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25' : 'bg-rose-400/10 text-rose-300 ring-rose-400/20'}`}>
                    {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight text-white/90">{op.title}</p>
                    <p className="mt-0.5 text-[12px] text-white/40">{op.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-bold tabular-nums ${credit ? 'text-emerald-300' : 'text-white'}`}>{op.amount}</p>
                    <p className="text-[11px] text-white/35">XAF</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom nav — dark glass */}
      <nav
        className="fixed inset-x-3 bottom-0 z-50 rounded-[22px] border border-white/10 bg-white/[0.06] px-2 py-2 backdrop-blur-2xl"
        style={{ marginBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
      >
        <ul className="flex items-center justify-between">
          {tabs.map((t) => (
            <li key={t.label}>
              {t.active ? (
                <div className="flex items-center gap-1.5 rounded-full bg-violet-500 px-3.5 py-2 text-white shadow-[0_0_18px_2px_rgba(139,92,246,0.5)]">
                  <t.icon className="h-[18px] w-[18px]" />
                  <span className="text-[12px] font-semibold">{t.label}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-white/45">
                  <t.icon className="h-[20px] w-[20px]" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
