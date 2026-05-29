// Option 2 — "Tout en typographie". The most minimal: no colored card, the
// balance is pure typography on white. ONE accent (violet) appears only on the
// primary "Payer" action. Calm, premium-bank, Wave/Mercury-clean.
import {
  Settings, Send, Plus, Users, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Home, Clock, User,
} from 'lucide-react';
import { fx, fontStack } from './walletFixtures';

const tabs = [
  { icon: Home, label: 'Accueil', active: true },
  { icon: Send, label: 'Payer' },
  { icon: Clock, label: 'Historique' },
  { icon: User, label: 'Profil' },
];

export default function WalletPreviewS2() {
  return (
    <div className="min-h-[100dvh] bg-white text-[#0B1220]" style={{ fontFamily: fontStack }}>
      <div className="mx-auto max-w-[480px] px-6 pb-32" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        {/* Header */}
        <header className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] font-medium text-slate-400">Bonjour,</p>
            <h1 className="text-[18px] font-bold tracking-tight leading-tight">Aristide Mballa</h1>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><Settings className="h-[19px] w-[19px]" /></button>
        </header>

        {/* Balance — typographic */}
        <section className="mt-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">Solde disponible</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[44px] font-bold leading-none tracking-tight tabular-nums">{fx.balanceXAF}</span>
            <span className="pb-1.5 text-[16px] font-semibold text-slate-400">XAF</span>
          </div>
          <p className="mt-2 text-[14px] text-slate-500">≈ {fx.rmbApprox} disponibles pour régler vos fournisseurs</p>
          <div className="mt-3 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] font-medium text-slate-500">Taux Alipay à jour · {fx.rateLine}</span>
          </div>
        </section>

        {/* Primary actions */}
        <section className="mt-7 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-[15px] font-semibold text-white active:scale-[0.98] transition">
            <Send className="h-[18px] w-[18px]" /> Payer
          </button>
          <button className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3.5 text-[15px] font-semibold text-slate-800 active:scale-[0.98] transition">
            <Plus className="h-[18px] w-[18px]" /> Ajouter de l'argent
          </button>
        </section>

        {/* Secondary quiet links */}
        <section className="mt-3 flex items-center gap-6 px-1">
          <button className="flex items-center gap-2 text-[13px] font-medium text-slate-500"><Users className="h-[16px] w-[16px]" /> Bénéficiaires</button>
          <button className="flex items-center gap-2 text-[13px] font-medium text-slate-500"><TrendingUp className="h-[16px] w-[16px]" /> Taux du jour</button>
        </section>

        {/* Activity — hairline list */}
        <section className="mt-8">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight">Activité</h2>
            <button className="text-[13px] font-semibold text-violet-600">Tout voir</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {fx.operations.map((op) => {
              const credit = op.type === 'CREDIT';
              return (
                <li key={op.id} className="flex items-center gap-3.5 py-3.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${credit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {credit ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{op.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-400">{op.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-semibold tabular-nums ${credit ? 'text-emerald-600' : 'text-[#0B1220]'}`}>{op.amount}</p>
                    <p className="text-[11px] text-slate-400">XAF</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Bottom nav — minimal */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/90 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-6 pt-2">
          {tabs.map((t) => (
            <li key={t.label} className="flex-1">
              <div className={`flex flex-col items-center gap-1 py-1.5 ${t.active ? 'text-violet-600' : 'text-slate-400'}`}>
                <t.icon className="h-[22px] w-[22px]" strokeWidth={t.active ? 2.4 : 1.9} />
                <span className={`text-[10px] ${t.active ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
