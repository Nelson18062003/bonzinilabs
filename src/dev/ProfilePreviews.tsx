// Profil — premium pass aligned with WalletPreviewPremium.
// Root tab → KEEPS the bottom tab bar (Profil active). Theme-aware.
// Mirrors ProfilePage + client.json copy + ClientStatus (PENDING_KYC).
import {
  ChevronRight, ChevronLeft, Bell, Shield, Smartphone, FileText, HelpCircle,
  Globe, Moon, LogOut, ShieldCheck, ShieldAlert, Check, CheckCheck, Pencil,
  CreditCard, ArrowDownToLine as DepositIcon, AlertCircle, XCircle, TrendingUp,
  Download, Image as ImageIcon, Search, KeyRound, Fingerprint, Laptop, MoreVertical,
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

/* ── sub-page chrome (no tab bar — header + back) ─────────────────── */
function SubShell({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0A0C12] text-slate-100" style={{ fontFamily: fontStack }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-[#0A0C12]/85 px-4 backdrop-blur-xl" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ChevronLeft className="h-[19px] w-[19px] text-slate-200" /></button>
        <h1 className="flex-1 text-[17px] font-bold tracking-tight">{title}</h1>
        {action}
      </header>
      <div className="mx-auto max-w-[480px] px-5 pb-12 pt-4">{children}</div>
    </div>
  );
}

/* ════ NOTIFICATIONS — grouped by day, type icons, unread emphasis ════
 * Mirrors MobileNotificationsScreen types: deposit/payment/success/error/
 * warning/info, unread highlight + dot. */
const NOTIF_STYLE: Record<string, { Icon: typeof Bell; color: string; tint: string }> = {
  deposit:  { Icon: DepositIcon, color: '#34d399', tint: 'bg-emerald-400/12' },
  payment:  { Icon: CreditCard,  color: '#a78bfa', tint: 'bg-violet-400/12' },
  success:  { Icon: ShieldCheck, color: '#34d399', tint: 'bg-emerald-400/12' },
  error:    { Icon: XCircle,     color: '#fb7185', tint: 'bg-rose-400/12' },
  warning:  { Icon: AlertCircle, color: '#fbbf24', tint: 'bg-amber-400/12' },
  info:     { Icon: TrendingUp,  color: '#fbbf24', tint: 'bg-amber-400/12' },
};
const notifGroups: { day: string; items: { type: string; title: string; body: string; time: string; unread?: boolean }[] }[] = [
  { day: "Aujourd'hui", items: [
    { type: 'payment', title: 'Paiement effectué', body: 'Shenzhen Tech Co. a bien reçu ¥ 38 236.', time: '09:41', unread: true },
    { type: 'deposit', title: 'Dépôt validé', body: 'Votre dépôt de 2 000 000 XAF a été crédité sur votre solde.', time: '09:14', unread: true },
    { type: 'info', title: 'Nouveau taux du jour', body: 'Le taux Alipay est passé à 11 765 CNY pour 1M XAF.', time: '07:30' },
  ] },
  { day: 'Hier', items: [
    { type: 'error', title: 'Paiement refusé', body: 'Compte bénéficiaire incorrect. Le montant a été recrédité.', time: '16:20' },
    { type: 'warning', title: 'Action requise', body: 'Complétez votre vérification KYC pour débloquer tous les paiements.', time: '11:05' },
  ] },
  { day: 'Cette semaine', items: [
    { type: 'success', title: 'Compte vérifié', body: 'Votre identité a été validée. Bienvenue chez Bonzini !', time: 'Lun.' },
  ] },
];
function NotificationsScreen() {
  return (
    <SubShell title="Notifications" action={<button className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-slate-200"><CheckCheck className="h-[14px] w-[14px]" style={{ color: ACCENT }} /> Tout lire</button>}>
      {notifGroups.map((g) => (
        <div key={g.day} className="mb-5">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{g.day}</p>
          <div className="space-y-2">
            {g.items.map((n, i) => {
              const s = NOTIF_STYLE[n.type];
              return (
                <div key={i} className="relative flex gap-3 rounded-2xl border p-3.5" style={n.unread ? { borderColor: 'hsl(258 100% 60% / 0.25)', background: 'hsl(258 100% 60% / 0.06)' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${s.tint}`}><s.Icon className="h-[20px] w-[20px]" style={{ color: s.color }} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-bold leading-tight">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-500">{n.time}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{n.body}</p>
                  </div>
                  {n.unread && <span className="absolute right-3 top-3 h-2 w-2 rounded-full" style={{ background: ACCENT }} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </SubShell>
  );
}

/* ════ DOCUMENTS — KYC card + proofs grid (deposits/payments) ════════
 * Mirrors MobileProofsScreen (image/file, filters) + KYC pieces. */
const docFilters = ['Tous', 'Dépôts', 'Paiements', 'KYC'];
const proofs: { kind: 'image' | 'pdf'; name: string; ref: string; date: string; cat: string }[] = [
  { kind: 'pdf', name: 'Reçu de dépôt', ref: 'DEP-2024-0042', date: '29 mai 2026', cat: 'Dépôts' },
  { kind: 'image', name: 'Preuve de virement', ref: 'DEP-2024-0039', date: '12 mai 2026', cat: 'Dépôts' },
  { kind: 'pdf', name: 'Reçu de paiement', ref: 'PAY-2024-0117', date: '29 mai 2026', cat: 'Paiements' },
  { kind: 'image', name: 'QR bénéficiaire', ref: 'PAY-2024-0124', date: '24 mai 2026', cat: 'Paiements' },
];
function DocumentsScreen() {
  return (
    <SubShell title="Mes documents" action={<button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><Search className="h-[18px] w-[18px] text-slate-200" /></button>}>
      {/* KYC block */}
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Vérification d'identité</p>
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'hsl(152 60% 45% / 0.3)', background: 'hsl(152 60% 45% / 0.07)' }}>
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: 'hsl(152 65% 45% / 0.18)' }}><ShieldCheck className="h-[20px] w-[20px] text-emerald-400" /></span>
          <div className="flex-1"><p className="text-[14px] font-bold text-emerald-400">Identité vérifiée</p><p className="text-[12px] text-emerald-100/60">Pièces validées le 5 mai 2026</p></div>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">KYC ✓</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 border-t border-white/[0.06] p-3">
          {['CNI · Recto', 'CNI · Verso'].map((label) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]"><ImageIcon className="h-[17px] w-[17px] text-slate-300" /></span>
              <div className="min-w-0"><p className="truncate text-[12.5px] font-semibold">{label}</p><p className="text-[10.5px] text-slate-500">Vérifié</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {docFilters.map((f, i) => (
          <span key={f} className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold" style={i === 0 ? { background: ACCENT, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{f}</span>
        ))}
      </div>

      {/* proofs grid */}
      <p className="mb-2.5 mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reçus & preuves</p>
      <div className="grid grid-cols-2 gap-3">
        {proofs.map((p, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="relative grid aspect-[4/3] place-items-center bg-gradient-to-br from-white/[0.07] to-white/[0.02]">
              {p.kind === 'image' ? <ImageIcon className="h-9 w-9 text-slate-500" /> : <FileText className="h-9 w-9 text-slate-500" />}
              <span className="absolute left-2 top-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/80 backdrop-blur">{p.kind}</span>
              <button className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur"><Download className="h-[15px] w-[15px]" /></button>
            </div>
            <div className="p-3">
              <p className="truncate text-[13px] font-semibold leading-tight">{p.name}</p>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">{p.ref}</p>
              <p className="mt-1 text-[10.5px] text-slate-500">{p.date}</p>
            </div>
          </div>
        ))}
      </div>
    </SubShell>
  );
}

/* ════ SECURITY — password, 2FA, biometrics, devices ════════════════
 * Mirrors MobileSettingsScreen switches + "Appareils connectés". */
function Toggle({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition" style={{ background: on ? ACCENT : 'rgba(255,255,255,0.12)' }}>
      <span className="absolute h-[20px] w-[20px] rounded-full bg-white shadow transition-all" style={{ left: on ? 21 : 3 }} />
    </span>
  );
}
function SecurityScreen() {
  const devices = [
    { name: 'iPhone 14 · Douala', meta: 'Cet appareil · actif maintenant', current: true },
    { name: 'Chrome · Windows', meta: 'Yaoundé · il y a 2 jours', current: false },
  ];
  return (
    <SubShell title="Sécurité">
      {/* auth methods */}
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Authentification</p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <button className="flex w-full items-center gap-3.5 p-4 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/12"><KeyRound className="h-[20px] w-[20px] text-sky-300" /></span>
          <div className="flex-1"><p className="text-[14.5px] font-semibold leading-tight">Mot de passe</p><p className="mt-0.5 text-[12px] text-slate-400">Modifié il y a 3 mois</p></div>
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-3.5 border-t border-white/[0.06] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/12"><ShieldCheck className="h-[20px] w-[20px] text-emerald-300" /></span>
          <div className="flex-1"><p className="text-[14.5px] font-semibold leading-tight">Double authentification (2FA)</p><p className="mt-0.5 text-[12px] text-slate-400">Code SMS à chaque connexion</p></div>
          <Toggle on={true} />
        </div>
        <div className="flex items-center gap-3.5 border-t border-white/[0.06] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-400/12"><Fingerprint className="h-[20px] w-[20px] text-violet-300" /></span>
          <div className="flex-1"><p className="text-[14.5px] font-semibold leading-tight">Déverrouillage biométrique</p><p className="mt-0.5 text-[12px] text-slate-400">Face ID / empreinte</p></div>
          <Toggle on={false} />
        </div>
      </div>

      {/* devices */}
      <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Appareils connectés</p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {devices.map((dev, i) => (
          <div key={dev.name} className={`flex items-center gap-3.5 p-4 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06]">{dev.current ? <Smartphone className="h-[20px] w-[20px] text-slate-200" /> : <Laptop className="h-[20px] w-[20px] text-slate-200" />}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[14px] font-semibold leading-tight">{dev.name}{dev.current && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Actuel</span>}</p>
              <p className="mt-0.5 text-[12px] text-slate-400">{dev.meta}</p>
            </div>
            {!dev.current && <button className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400"><MoreVertical className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      <button className="mt-4 w-full rounded-2xl py-3.5 text-[14px] font-bold text-rose-400" style={{ boxShadow: 'inset 0 0 0 1px hsl(352 80% 60% / 0.3)' }}>
        Déconnecter tous les autres appareils
      </button>
    </SubShell>
  );
}

export default function ProfilePreviews({ screen = 'main' }: { screen?: string }) {
  if (screen === 'verified') return <ProfileScreen kycVerified theme="dark" />;
  if (screen === 'light') return <ProfileScreen kycVerified={false} theme="light" />;
  if (screen === 'notifications') return <NotificationsScreen />;
  if (screen === 'documents') return <DocumentsScreen />;
  if (screen === 'security') return <SecurityScreen />;
  return <ProfileScreen kycVerified={false} theme="dark" />;
}
