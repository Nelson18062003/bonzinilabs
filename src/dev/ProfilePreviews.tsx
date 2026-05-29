// Profil module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=prof-<screen>.
// Mirrors ProfilePage.tsx + client.json copy: profile card, KYC status
// (ClientStatus PENDING_KYC / kycVerified), menu, language, theme, logout.
// Profil is the 6th nav tab → shown active (violet).
import {
  User, ChevronRight, Bell, Shield, Smartphone, FileText, HelpCircle,
  Globe, Palette, LogOut, ShieldCheck, ShieldAlert, Check, Moon,
  Home, ArrowDownToLine, Send, History, MessageCircle,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const ACCENT = 'hsl(258 100% 60%)';

const menu = [
  { Icon: Bell, label: 'Notifications', desc: 'Gérer vos alertes' },
  { Icon: Shield, label: 'Sécurité', desc: 'Mot de passe, 2FA' },
  { Icon: Smartphone, label: 'Appareils connectés', desc: '2 appareils' },
  { Icon: FileText, label: 'Documents', desc: 'KYC, Pièces justificatives' },
  { Icon: HelpCircle, label: 'Aide & Support', desc: 'FAQ, Contact' },
];

const languages = [
  { code: 'fr', label: 'Français', on: true },
  { code: 'en', label: 'English', on: false },
  { code: 'zh', label: '中文', on: false },
];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique' },
  { Icon: MessageCircle, label: 'Support' }, { Icon: User, label: 'Profil', active: true },
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

/* KYC banner — verified vs pending (ClientStatus PENDING_KYC) */
function KycBanner({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)' }}>
        <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" />
        <div className="flex-1"><p className="text-[14px] font-bold text-emerald-300">Compte vérifié</p><p className="text-[12.5px] text-emerald-100/70">Votre identité (KYC) est validée.</p></div>
      </div>
    );
  }
  return (
    <button className="mt-4 flex w-full items-center gap-3 rounded-2xl border p-4 text-left" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)' }}>
      <ShieldAlert className="h-6 w-6 shrink-0 text-amber-400" />
      <div className="flex-1"><p className="text-[14px] font-bold text-amber-300">Vérification en attente</p><p className="text-[12.5px] text-amber-100/70">Complétez votre KYC pour débloquer tous les paiements.</p></div>
      <span className="rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-bold text-[#1a1206]">Compléter</span>
    </button>
  );
}

function ProfileScreen({ kycVerified = false }: { kycVerified?: boolean }) {
  return (
    <Shell>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2"><h1 className="text-[26px] font-extrabold tracking-tight">Profil</h1></header>

        {/* profile card */}
        <div className="relative mt-4 overflow-hidden rounded-[24px] p-5" style={{ background: 'linear-gradient(145deg, hsl(258 100% 64%) 0%, hsl(262 90% 54%) 55%, hsl(268 84% 46%) 100%)', boxShadow: '0 22px 50px -22px hsl(258 90% 50% / 0.7)' }}>
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 text-[22px] font-extrabold text-white">AS</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[19px] font-bold text-white">Aristide Soh</p>
              <p className="truncate text-[13px] text-white/80">aristide.soh@exemple.com</p>
              <p className="mt-0.5 text-[13px] text-white/80">+237 699 00 00 00 · 🇨🇲 Cameroun</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/80" />
          </div>
        </div>

        {/* KYC status */}
        <KycBanner verified={kycVerified} />

        {/* menu */}
        <div className="mt-6 space-y-2.5">
          {menu.map((m) => (
            <button key={m.label} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><m.Icon className="h-[19px] w-[19px] text-slate-200" /></span>
              <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold leading-tight">{m.label}</p><p className="mt-0.5 text-[12px] text-slate-400">{m.desc}</p></div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </button>
          ))}
        </div>

        {/* language */}
        <p className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Langue</p>
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Globe className="h-[19px] w-[19px] text-slate-200" /></span>
          <div className="flex flex-1 gap-2">
            {languages.map((l) => (
              <span key={l.code} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={l.on ? { background: ACCENT, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                {l.on && <Check className="h-3.5 w-3.5" />}{l.label}
              </span>
            ))}
          </div>
        </div>

        {/* appearance */}
        <p className="mt-4 mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Apparence</p>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]"><Palette className="h-[19px] w-[19px] text-slate-200" /></span>
          <div className="flex-1"><p className="text-[14.5px] font-semibold leading-tight">Thème de l'application</p><p className="mt-0.5 text-[12px] text-slate-400">Sombre</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-slate-200"><Moon className="h-4 w-4" /> Sombre</span>
        </div>

        {/* logout */}
        <button className="mt-6 flex w-full items-center gap-4 rounded-2xl border p-4 text-left" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(244,63,94,0.12)' }}><LogOut className="h-[19px] w-[19px] text-rose-400" /></span>
          <span className="text-[14.5px] font-bold text-rose-400">Se déconnecter</span>
        </button>

        <p className="mt-8 text-center text-[12px] text-slate-500">Bonzini v1.0.0 • Fait avec 💜 au Cameroun</p>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function ProfilePreviews({ screen = 'main' }: { screen?: string }) {
  if (screen === 'verified') return <ProfileScreen kycVerified />;
  return <ProfileScreen kycVerified={false} />;
}
