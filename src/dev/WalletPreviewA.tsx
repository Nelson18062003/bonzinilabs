// Direction A — "Élever l'existant" : violet premium, fond clair.
// Keeps the current brand DNA (violet gradient hero, glass) but pushed
// to a polished, consistent, production-grade level.
import {
  Bell, Eye, ArrowDownToLine, Send, Users, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Home, ReceiptText, Clock, User, ChevronRight,
} from 'lucide-react';
import { fx, fontStack } from './walletFixtures';

const actions = [
  { icon: ArrowDownToLine, label: 'Déposer', cls: 'bg-emerald-50 text-emerald-600' },
  { icon: Send, label: 'Payer', cls: 'bg-violet-100 text-violet-600' },
  { icon: Users, label: 'Bénéficiaires', cls: 'bg-amber-50 text-amber-600' },
  { icon: TrendingUp, label: 'Taux', cls: 'bg-orange-50 text-orange-600' },
];

const tabs = [
  { icon: Home, label: 'Accueil', active: true },
  { icon: ArrowDownToLine, label: 'Dépôts' },
  { icon: Send, label: 'Payer' },
  { icon: Clock, label: 'Activité' },
  { icon: User, label: 'Profil' },
];

export default function WalletPreviewA() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB] text-slate-900" style={{ fontFamily: fontStack }}>
      <div className="mx-auto max-w-[480px] px-5 pb-32" style={{ paddingTop: 'max(env(safe-area-inset-top), 18px)' }}>
        {/* Header */}
        <header className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] font-medium text-slate-400">Bonjour 👋</p>
            <h1 className="text-[20px] font-bold tracking-tight leading-tight">{fx.firstName} Mballa</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative grid h-11 w-11 place-items-center rounded-full bg-white border border-slate-200/80 shadow-sm">
              <Bell className="h-[18px] w-[18px] text-slate-600" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            </button>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-violet-600 text-white text-[15px] font-bold">A</div>
          </div>
        </header>

        {/* Balance hero */}
        <section
          className="relative mt-5 overflow-hidden rounded-[28px] p-6 text-white"
          style={{
            background: 'linear-gradient(135deg, hsl(258 100% 60%), hsl(272 90% 52%) 55%, hsl(284 85% 48%))',
            boxShadow: '0 22px 50px -18px hsl(258 90% 50% / 0.55)',
          }}
        >
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-orange-400/25 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-white/75">Solde disponible</span>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <Eye className="h-4 w-4 text-white/90" />
              </button>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums">{fx.balanceXAF}</span>
              <span className="pb-1 text-[15px] font-semibold text-white/70">XAF</span>
            </div>
            <p className="mt-1.5 text-[15px] font-medium text-white/80">≈ {fx.rmbApprox} pour vos fournisseurs</p>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/12 px-3.5 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400/90 text-[#3a2a00]">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11px] text-white/65">Taux Alipay du jour</p>
                  <p className="text-[13px] font-semibold">{fx.rateLine}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60" />
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-5 grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button key={a.label} className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-slate-200/70 py-3.5 shadow-sm active:scale-95 transition">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${a.cls}`}>
                <a.icon className="h-[20px] w-[20px]" />
              </span>
              <span className="text-[11px] font-semibold text-slate-700">{a.label}</span>
            </button>
          ))}
        </section>

        {/* Recent operations */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold tracking-tight">Activité récente</h2>
            <button className="text-[13px] font-semibold text-violet-600">Voir tout</button>
          </div>
          <div className="space-y-2.5">
            {fx.operations.slice(0, 3).map((op) => {
              const credit = op.type === 'CREDIT';
              return (
                <div key={op.id} className="flex items-center gap-3.5 rounded-2xl bg-white border border-slate-200/60 p-3.5 shadow-sm">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{op.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-400">{op.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-bold tabular-nums ${credit ? 'text-emerald-600' : 'text-slate-900'}`}>{op.amount}</p>
                    <p className="text-[11px] text-slate-400">XAF</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom nav — liquid pill */}
      <nav
        className="fixed inset-x-3 bottom-0 z-50 rounded-[22px] border border-slate-200/70 bg-white/85 px-2 py-2 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.2)] backdrop-blur-xl"
        style={{ marginBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
      >
        <ul className="flex items-center justify-between">
          {tabs.map((t) => (
            <li key={t.label}>
              {t.active ? (
                <div className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-white">
                  <t.icon className="h-[18px] w-[18px]" />
                  <span className="text-[12px] font-semibold">{t.label}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-slate-400">
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
