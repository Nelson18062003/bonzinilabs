// Profil — premium pass aligned with WalletPreviewPremium.
// Root tab → KEEPS the bottom tab bar (Profil active). Theme-aware.
// Mirrors ProfilePage + client.json copy + ClientStatus (PENDING_KYC).
import {
  ChevronRight, Bell, Shield, Smartphone, FileText, HelpCircle,
  Globe, Moon, LogOut, ShieldCheck, ShieldAlert, Check, Pencil,
  Home, ArrowDownToLine, Send, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const ACCENT = 'hsl(258 100% 60%)';

const menu = [
  { Icon: Bell, label: 'Notifications', desc: 'Gérer vos alertes', chipD: 'bg-sky-400/15 text-sky-300', chipL: 'bg-sky-50 text-sky-600' },
  { Icon: Shield, label: 'Sécurité', desc: 'Mot de passe, 2FA', chipD: 'bg-emerald-400/15 text-emerald-300', chipL: 'bg-emerald-50 text-emerald-600' },
  { Icon: Smartphone, label: 'Appareils connectés', desc: '2 appareils', chipD: 'bg-violet-400/15 text-violet-300', chipL: 'bg-violet-50 text-violet-600' },
  { Icon: FileText, label: 'Documents', desc: 'KYC, pièces justificatives', chipD: 'bg-amber-400/15 text-amber-300', chipL: 'bg-amber-50 text-amber-600' },
  { Icon: HelpCircle, label: 'Aide & Support', desc: 'FAQ, contact', chipD: 'bg-rose-400/15 text-rose-300', chipL: 'bg-rose-50 text-rose-600' },
];
const languages = [{ code: 'fr', label: 'Français', on: true }, { code: 'en', label: 'English', on: false }, { code: 'zh', label: '中文', on: false }];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique' },
  { Icon: MessageCircle, label: 'Support' }, { Icon: User, label: 'Profil', active: true },
];

function NavBar({ d }: { d: boolean }) {
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t ${d ? 'border-white/10 bg-[#0A0C12]/95' : 'border-slate-100 bg-white/95'} backdrop-blur-xl`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pt-2">
        {tabs.map((t) => (
          <li key={t.label} className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-1 py-1.5" style={t.active ? { color: ACCENT } : undefined}>
              <t.Icon className={`h-[21px] w-[21px] ${t.active ? '' : 'text-slate-400'}`} strokeWidth={t.active ? 2.4 : 1.9} />
              <span className={`max-w-full truncate text-[9.5px] ${t.active ? 'font-bold' : 'font-medium text-slate-400'}`}>{t.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function KycBanner({ verified, d }: { verified: boolean; d: boolean }) {
  if (verified) {
    return (
      <div className="mt-4 flex items-center gap-3 overflow-hidden rounded-2xl p-4" style={{ background: d ? 'hsl(152 60% 45% / 0.10)' : 'hsl(152 70% 45% / 0.08)', boxShadow: 'inset 0 0 0 1px hsl(152 60% 45% / 0.3)' }}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'hsl(152 65% 45% / 0.18)' }}><ShieldCheck className="h-[20px] w-[20px] text-emerald-400" /></span>
        <div className="flex-1"><p className="text-[14px] font-bold text-emerald-400">Compte vérifié</p><p className={`text-[12.5px] ${d ? 'text-emerald-100/60' : 'text-emerald-700/70'}`}>Votre identité (KYC) est validée.</p></div>
      </div>
    );
  }
  return (
    <button className="mt-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl p-4 text-left" style={{ background: d ? 'hsl(36 90% 50% / 0.10)' : 'hsl(36 95% 50% / 0.09)', boxShadow: 'inset 0 0 0 1px hsl(36 90% 50% / 0.35)' }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'hsl(36 90% 50% / 0.18)' }}><ShieldAlert className="h-[20px] w-[20px] text-amber-400" /></span>
      <div className="flex-1"><p className="text-[14px] font-bold text-amber-400">Vérification en attente</p><p className={`text-[12.5px] ${d ? 'text-amber-100/60' : 'text-amber-700/70'}`}>Complétez votre KYC pour débloquer tous les paiements.</p></div>
      <span className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: 'hsl(36 95% 48%)' }}>Compléter</span>
    </button>
  );
}

function ProfileScreen({ kycVerified = false, theme = 'dark' }: { kycVerified?: boolean; theme?: 'light' | 'dark' }) {
  const d = theme === 'dark';
  const card = d ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200/70 bg-white';
  const sub = d ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`min-h-[100dvh] ${d ? 'bg-[#0A0C12] text-slate-100' : 'bg-[#FCFCFD] text-slate-900'}`} style={{ fontFamily: fontStack }}>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2"><h1 className="text-[26px] font-extrabold tracking-tight">Profil</h1></header>

        {/* profile hero card — premium violet gradient */}
        <section className="relative mt-4 overflow-hidden rounded-[28px] p-6 text-white"
          style={{ background: 'linear-gradient(145deg, hsl(258 100% 64%) 0%, hsl(262 90% 54%) 55%, hsl(270 85% 44%) 100%)', boxShadow: '0 24px 60px -22px hsl(262 90% 48% / 0.7)' }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 text-[22px] font-extrabold ring-1 ring-white/30 backdrop-blur-md">AM</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[19px] font-bold leading-tight">Aristide Mballa</p>
              <p className="truncate text-[13px] text-white/80">aristide.mballa@exemple.com</p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-white/20 backdrop-blur-md">🇨🇲 Cameroun · +237 699 00 00 00</p>
            </div>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/25"><Pencil className="h-4 w-4" /></button>
          </div>
        </section>

        <KycBanner verified={kycVerified} d={d} />

        {/* menu */}
        <div className="mt-6 space-y-2.5">
          {menu.map((m) => (
            <button key={m.label} className={`flex w-full items-center gap-4 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${card}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${d ? m.chipD : m.chipL}`}><m.Icon className="h-[20px] w-[20px]" /></span>
              <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold leading-tight">{m.label}</p><p className={`mt-0.5 text-[12px] ${sub}`}>{m.desc}</p></div>
              <ChevronRight className={`h-5 w-5 ${d ? 'text-slate-600' : 'text-slate-400'}`} />
            </button>
          ))}
        </div>

        {/* preferences — language + theme grouped in one card */}
        <p className={`mt-6 mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${sub}`}>Préférences</p>
        <div className={`overflow-hidden rounded-2xl border ${card}`}>
          <div className="flex items-center gap-3 p-3.5">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${d ? 'bg-white/[0.06]' : 'bg-slate-100'}`}><Globe className="h-[20px] w-[20px]" /></span>
            <p className="flex-1 text-[14.5px] font-semibold">Langue</p>
            <div className="flex gap-1.5">
              {languages.map((l) => (
                <span key={l.code} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold"
                  style={l.on ? { background: ACCENT, color: '#fff' } : (d ? { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' } : { background: '#f1f5f9', color: '#64748b' })}>
                  {l.on && <Check className="h-3 w-3" />}{l.label}
                </span>
              ))}
            </div>
          </div>
          <div className={`flex items-center gap-3 border-t p-3.5 ${d ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${d ? 'bg-white/[0.06]' : 'bg-slate-100'}`}><Moon className="h-[20px] w-[20px]" /></span>
            <div className="flex-1"><p className="text-[14.5px] font-semibold leading-tight">Apparence</p><p className={`mt-0.5 text-[12px] ${sub}`}>Thème de l'application</p></div>
            {/* segmented light/dark */}
            <div className={`flex rounded-full p-0.5 ${d ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
              <span className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${!d ? 'text-slate-900' : 'text-slate-400'}`} style={!d ? { background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } : undefined}>Clair</span>
              <span className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${d ? 'text-white' : 'text-slate-400'}`} style={d ? { background: ACCENT } : undefined}>Sombre</span>
            </div>
          </div>
        </div>

        {/* logout */}
        <button className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[14.5px] font-bold text-rose-400" style={{ boxShadow: 'inset 0 0 0 1px hsl(352 80% 60% / 0.3)' }}>
          <LogOut className="h-[18px] w-[18px]" /> Se déconnecter
        </button>

        <p className={`mt-7 text-center text-[12px] ${sub}`}>Bonzini v1.0.0 · Fait avec 💜 au Cameroun</p>
      </div>
      <NavBar d={d} />
    </div>
  );
}

export default function ProfilePreviews({ screen = 'main' }: { screen?: string }) {
  if (screen === 'verified') return <ProfileScreen kycVerified theme="dark" />;
  if (screen === 'light') return <ProfileScreen kycVerified={false} theme="light" />;
  return <ProfileScreen kycVerified={false} theme="dark" />;
}
