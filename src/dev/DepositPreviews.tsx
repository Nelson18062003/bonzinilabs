// Dépôts module — rich (like home) + real method logos + keypad + nav always.
// Deposit FICHE inspired by the admin detail: amount card + method + proofs +
// info rows + a COLLAPSIBLE "Suivi" (collapsed by default → complete yet clean).
import {
  ArrowLeft, Plus, ChevronRight, ChevronDown, Clock, Check, Camera, Upload,
  Delete, Banknote, Landmark, FileText, Download, Copy, ArrowLeftRight, X, CheckCircle, AlertTriangle,
  Home, ArrowDownToLine, Send, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const ACCENT = 'hsl(16 100% 55%)';
const WAVE_CYAN = '#4DC5E8';
const LOGO: Record<string, string> = {
  orange: '/assets/methods/orange.svg',
  mtn: '/assets/methods/mtn.png',
};

function MethodMark({ kind, size = 44 }: { kind: string; size?: number }) {
  const px = `${size}px`;
  const tile = 'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5';
  if (kind === 'wave') return <span className="grid shrink-0 place-items-center rounded-xl font-extrabold lowercase text-white shadow-sm" style={{ width: px, height: px, background: WAVE_CYAN, fontSize: size * 0.3 }}>wave</span>;
  if (kind === 'cash') return <span className={tile} style={{ width: px, height: px }}><Banknote className="text-emerald-600" style={{ width: size * 0.56, height: size * 0.56 }} /></span>;
  if (kind === 'bank') return <span className={tile} style={{ width: px, height: px }}><Landmark className="text-slate-700" style={{ width: size * 0.52, height: size * 0.52 }} /></span>;
  return <span className={tile} style={{ width: px, height: px }}><img src={LOGO[kind]} alt="" className="object-contain" style={{ width: size * 0.66, height: size * 0.66 }} /></span>;
}

const deposits = [
  { kind: 'orange', method: 'Orange Money', date: "Aujourd'hui · 09:14", amount: '2 000 000', status: 'En vérification', tone: 'text-amber-300', dot: 'bg-amber-400' },
  { kind: 'bank', method: 'Virement bancaire', date: '12 mai · 14:20', amount: '5 000 000', status: 'Validé', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
  { kind: 'wave', method: 'Wave', date: '8 mai · 11:05', amount: '1 500 000', status: 'Validé', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
  { kind: 'cash', method: 'Cash en agence', date: '2 mai · 16:30', amount: '3 000 000', status: 'Rejeté', tone: 'text-rose-300', dot: 'bg-rose-400' },
];

const methods = [
  { kind: 'bank', label: 'Banque / Microfinance', desc: 'Virement ou dépôt cash en agence' },
  { kind: 'cash', label: 'Cash en agence Bonzini', desc: 'Dépôt cash dans nos locaux' },
  { kind: 'orange', label: 'Orange Money', desc: 'Transfert UV ou code marchand' },
  { kind: 'mtn', label: 'MTN Mobile Money', desc: 'Transfert Float ou code marchand' },
  { kind: 'wave', label: 'Wave', desc: 'Transfert via Wave' },
];

const presets = ['100 000', '500 000', '1 000 000'];
const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'];
const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts', active: true },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique', badge: 2 },
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
function AppBar({ title, progress }: { title: string; progress?: number }) {
  return (
    <header className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
      <div className="flex items-center gap-3 pt-1">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ArrowLeft className="h-[19px] w-[19px] text-slate-200" /></button>
        <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
      </div>
      {progress !== undefined && <div className="mt-4 flex gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= progress ? ACCENT : 'rgba(255,255,255,0.10)' }} />)}</div>}
    </header>
  );
}

/* ── list ──────────────────────────────────────────────────── */
function ListScreen() {
  return (
    <Shell>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2"><h1 className="text-[26px] font-extrabold tracking-tight">Dépôts</h1></header>
        <button className="relative mt-4 flex w-full items-center gap-4 overflow-hidden rounded-[26px] p-5 text-left text-white" style={{ background: 'linear-gradient(145deg, hsl(24 96% 53%) 0%, hsl(14 88% 46%) 60%, hsl(6 82% 41%) 100%)', boxShadow: '0 22px 50px -20px hsl(16 90% 45% / 0.75)' }}>
          <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/20"><Plus className="h-7 w-7" /></span>
          <div className="relative flex-1"><p className="text-[17px] font-bold leading-tight">Ajouter de l'argent</p><p className="mt-0.5 text-[13px] text-white/85">Rechargez votre compte en quelques minutes</p></div>
          <ChevronRight className="relative h-6 w-6 text-white/80" />
        </button>
        <div className="mt-8">
          <SectionLabel>Récents</SectionLabel>
          <ul className="divide-y divide-white/[0.06]">
            {deposits.map((dp, i) => (
              <li key={i} className="flex items-center gap-4 py-4">
                <MethodMark kind={dp.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold leading-tight">{dp.method}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${dp.dot}`} /><span className={dp.tone}>{dp.status}</span><span className="text-slate-600">·</span>{dp.date}</p>
                </div>
                <p className="text-[15.5px] font-bold tabular-nums">+ {dp.amount}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── amount ────────────────────────────────────────────────── */
function AmountScreen() {
  return (
    <Shell>
      <AppBar title="Ajouter de l'argent" progress={0} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <div className="mt-6 text-center">
          <p className="text-[13px] font-medium text-slate-400">Montant à ajouter</p>
          <p className="mt-2 text-[46px] font-extrabold leading-none tracking-tight tabular-nums">2 000 000 <span className="text-[18px] font-semibold text-slate-500">XAF</span></p>
          <p className="mt-2 text-[13px] text-slate-500">Solde : <span className="font-semibold text-slate-300">12 450 000 XAF</span></p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">{presets.map((p) => { const on = p === '1 000 000'; return <button key={p} className="rounded-xl py-2.5 text-center text-[13px] font-bold" style={on ? { background: 'hsl(16 100% 55% / 0.16)', color: ACCENT, boxShadow: 'inset 0 0 0 1.5px hsl(16 100% 55% / 0.4)' } : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>{p}</button>; })}</div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">{keypad.map((k) => <button key={k} className="grid h-[52px] place-items-center rounded-2xl bg-white/[0.06] text-[21px] font-semibold text-white active:bg-white/[0.12]">{k === 'back' ? <Delete className="h-[22px] w-[22px] text-slate-300" /> : k}</button>)}</div>
        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(16 90% 50% / 0.7)' }}>Continuer <ChevronRight className="h-[18px] w-[18px]" /></button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── method ────────────────────────────────────────────────── */
function MethodScreen() {
  return (
    <Shell>
      <AppBar title="Ajouter de l'argent" progress={1} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <p className="mt-6 mb-1 text-[15px] font-semibold">Choisissez un moyen de dépôt</p>
        <p className="text-[13px] text-slate-400">Vous recevrez les coordonnées juste après.</p>
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {methods.map((m) => (
            <li key={m.label}>
              <button className="flex w-full items-center gap-4 py-3.5 text-left">
                <MethodMark kind={m.kind} size={48} />
                <div className="min-w-0 flex-1"><p className="text-[15.5px] font-semibold leading-tight">{m.label}</p><p className="mt-0.5 text-[13px] text-slate-400">{m.desc}</p></div>
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── detail (fiche) — complete, admin-inspired, 4 statuses ─── */
type DStatus = 'awaiting' | 'verifying' | 'validated' | 'rejected';
const STATUS_CFG: Record<DStatus, { label: string; pill: string; Icon: typeof Clock }> = {
  awaiting: { label: 'Preuve à envoyer', pill: 'bg-white/[0.06] text-slate-300', Icon: Clock },
  verifying: { label: 'En vérification', pill: 'bg-amber-400/15 text-amber-300', Icon: Clock },
  validated: { label: 'Validé', pill: 'bg-emerald-400/15 text-emerald-300', Icon: Check },
  rejected: { label: 'Rejeté', pill: 'bg-rose-400/15 text-rose-300', Icon: X },
};
function DetailScreen({ status = 'awaiting' }: { status?: DStatus }) {
  const c = STATUS_CFG[status];
  const dateLabel = status === 'validated' ? 'Validé le' : status === 'rejected' ? 'Rejeté le' : 'Date';
  return (
    <Shell>
      <header className="flex items-center justify-between px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <div className="flex items-center gap-3 pt-1">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ArrowLeft className="h-[19px] w-[19px] text-slate-200" /></button>
          <div><h1 className="text-[18px] font-bold leading-none tracking-tight">Dépôt</h1><p className="mt-1 text-[12px] font-medium text-slate-500">DEP-2024-0042</p></div>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><Download className="h-[18px] w-[18px] text-slate-200" /></button>
      </header>

      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* Amount card */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-300"><MethodMark kind="orange" size={22} /> Orange Money</span>
          <p className="mt-3 text-[40px] font-extrabold leading-none tracking-tight tabular-nums">2 000 000 <span className="text-[16px] font-semibold text-slate-400">XAF</span></p>
          <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${c.pill}`}><c.Icon className="h-3.5 w-3.5" /> {c.label}</span>
        </div>

        {/* Status banner */}
        {status === 'validated' && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)' }}>
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div><p className="text-[14px] font-bold text-emerald-300">Compte crédité</p><p className="mt-0.5 text-[12.5px] text-emerald-100/70">Votre solde a été augmenté de 2 000 000 XAF.</p></div>
          </div>
        )}
        {status === 'rejected' && (
          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.08)' }}>
            <div className="flex items-center gap-2"><AlertTriangle className="h-[18px] w-[18px] text-rose-400" /><p className="text-[14px] font-bold text-rose-300">Dépôt rejeté</p></div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-rose-100/80"><span className="font-semibold text-rose-200">Motif :</span> la preuve fournie est illisible. Merci de renvoyer une capture nette du reçu.</p>
          </div>
        )}

        {/* Preuve */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <SectionLabel>Preuve de paiement</SectionLabel>
            {status === 'verifying' && <span className="mb-2 text-[12px] font-semibold text-emerald-300">Envoyée</span>}
            {status === 'validated' && <span className="mb-2 text-[12px] font-semibold text-emerald-300">Validée</span>}
            {status === 'rejected' && <span className="mb-2 text-[12px] font-semibold text-rose-300">Refusée</span>}
          </div>
          {status === 'awaiting' ? (
            <div className="rounded-3xl border-2 border-dashed p-6 text-center" style={{ borderColor: 'hsl(16 100% 55% / 0.45)', background: 'hsl(16 100% 55% / 0.06)' }}>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: 'hsl(16 100% 55% / 0.16)', color: ACCENT }}><Camera className="h-7 w-7" /></span>
              <p className="mt-3 text-[15.5px] font-bold text-white">Ajoutez votre preuve de paiement</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[12.5px] text-slate-400">Capture d'écran ou reçu de votre transfert.</p>
              <div className="mt-4 flex gap-3">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-bold text-white" style={{ background: ACCENT }}><Camera className="h-[17px] w-[17px]" /> Photo</button>
                <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-[13.5px] font-semibold text-slate-200"><Upload className="h-[17px] w-[17px]" /> Importer</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className={`grid h-[76px] w-[76px] place-items-center rounded-2xl bg-white/[0.06] text-slate-400 ${status === 'rejected' ? 'ring-1 ring-rose-400/50' : ''}`}><FileText className="h-7 w-7" /></div>
              {status === 'rejected'
                ? <button className="flex h-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-[12px] font-bold" style={{ borderColor: 'hsl(16 100% 55% / 0.5)', color: ACCENT }}><Camera className="h-5 w-5" /> Renvoyer</button>
                : <button className="grid h-[76px] w-[76px] place-items-center rounded-2xl border-2 border-dashed border-white/15 text-slate-400"><Plus className="h-6 w-6" /></button>}
            </div>
          )}
        </div>

        {/* Informations */}
        <div className="mt-7">
          <SectionLabel>Informations</SectionLabel>
          <div className="divide-y divide-white/[0.06]">
            {[
              { k: 'Méthode', v: 'Orange Money' },
              { k: 'Référence', v: 'DEP-2024-0042', mono: true },
              { k: 'Montant', v: '2 000 000 XAF' },
              { k: dateLabel, v: '29 mai 2026 · 09:14' },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between py-3"><span className="text-[13.5px] text-slate-400">{r.k}</span><span className={`text-[14px] font-semibold ${r.mono ? 'font-mono' : ''}`}>{r.v}</span></div>
            ))}
          </div>
        </div>

        {/* Primary action by status */}
        {status === 'validated' && (
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14.5px] font-bold text-white" style={{ background: '#059669' }}><Download className="h-[18px] w-[18px]" /> Télécharger le reçu</button>
        )}
        {status === 'rejected' && (
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14.5px] font-bold text-white" style={{ background: ACCENT }}><Camera className="h-[18px] w-[18px]" /> Renvoyer une preuve</button>
        )}

        {/* Suivi — collapsible */}
        <button className="mt-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-[14px] font-semibold"><Clock className="h-[18px] w-[18px] text-amber-300" /> Suivi du dépôt</span>
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </button>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── bank sub-flow: sous-méthode (Virement / Dépôt cash) ───── */
function SubMethodScreen() {
  const opts = [
    { Icon: ArrowLeftRight, title: 'Virement bancaire', desc: 'Depuis votre compte ou appli bancaire' },
    { Icon: Banknote, title: 'Dépôt cash en agence', desc: 'Espèces au guichet de la banque' },
  ];
  return (
    <Shell>
      <AppBar title="Ajouter de l'argent" progress={1} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/[0.06] py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-semibold text-slate-200"><MethodMark kind="bank" size={24} /> Banque / Microfinance</span>
        <p className="mt-5 text-[16px] font-semibold">Comment souhaitez-vous déposer ?</p>
        <div className="mt-4 space-y-3">
          {opts.map((o) => (
            <button key={o.title} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: 'hsl(16 100% 55% / 0.14)', color: ACCENT }}><o.Icon className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1"><p className="text-[15.5px] font-semibold leading-tight">{o.title}</p><p className="mt-0.5 text-[13px] text-slate-400">{o.desc}</p></div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </button>
          ))}
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── bank sub-flow: coordonnées (RIB + instructions) ───────── */
function CoordinatesScreen() {
  const rows = [
    { k: 'Titulaire', v: 'BONZINI SARL' },
    { k: 'Banque', v: 'Ecobank Cameroun' },
    { k: 'N° de compte', v: '10005 00012 49500012345 67', copy: true },
    { k: 'Code SWIFT', v: 'ECOCCMCX', copy: true },
  ];
  const steps = [
    'Effectuez le virement vers ce compte depuis votre banque.',
    'Indiquez la référence ci-dessous en motif du virement.',
    'Revenez ajouter votre preuve (capture ou reçu).',
  ];
  return (
    <Shell>
      <AppBar title="Coordonnées de paiement" progress={2} />
      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* amount reminder */}
        <div className="mt-5 rounded-2xl border p-4 text-center" style={{ borderColor: 'hsl(16 100% 55% / 0.25)', background: 'linear-gradient(135deg, hsl(16 100% 55% / 0.14), hsl(16 100% 55% / 0.04))' }}>
          <p className="text-[12px] font-medium text-slate-400">Montant à déposer</p>
          <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">2 000 000 <span className="text-[14px] font-semibold text-slate-400">XAF</span></p>
        </div>

        {/* beneficiary account */}
        <div className="mt-6">
          <SectionLabel>Compte bénéficiaire</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5"><img src="/assets/methods/ecobank.png" alt="" className="h-6 w-6 object-contain" /></span>
              <span className="text-[14.5px] font-semibold">Ecobank Cameroun</span>
            </div>
            <div className="divide-y divide-white/[0.06] px-4">
              {rows.map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="text-[12px] text-slate-500">{r.k}</p><p className={`mt-0.5 text-[14px] font-semibold ${r.copy ? 'font-mono' : ''}`}>{r.v}</p></div>
                  {r.copy && <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-slate-300"><Copy className="h-[15px] w-[15px]" /></button>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* reference */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed p-4" style={{ borderColor: 'hsl(36 100% 55% / 0.45)', background: 'hsl(36 100% 55% / 0.06)' }}>
          <div className="min-w-0"><p className="text-[12px] font-medium text-amber-200/80">Référence à indiquer (obligatoire)</p><p className="mt-0.5 font-mono text-[15px] font-bold text-amber-200">DEP-2024-0042</p></div>
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-amber-200"><Copy className="h-[15px] w-[15px]" /></button>
        </div>

        {/* instructions */}
        <div className="mt-6">
          <SectionLabel>Comment faire</SectionLabel>
          <ol className="space-y-3.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: ACCENT }}>{i + 1}</span>
                <span className="text-[13.5px] leading-snug text-slate-300">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(16 90% 50% / 0.7)' }}>J'ai effectué le virement <ChevronRight className="h-[18px] w-[18px]" /></button>
        <p className="mt-3 text-center text-[12px] text-slate-500">Vous pourrez ajouter votre preuve juste après.</p>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function DepositPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'amount') return <AmountScreen />;
  if (screen === 'method') return <MethodScreen />;
  if (screen === 'submethod') return <SubMethodScreen />;
  if (screen === 'coordinates') return <CoordinatesScreen />;
  if (screen === 'detail') return <DetailScreen status="awaiting" />;
  if (screen === 'detail-sent') return <DetailScreen status="verifying" />;
  if (screen === 'detail-validated') return <DetailScreen status="validated" />;
  if (screen === 'detail-rejected') return <DetailScreen status="rejected" />;
  return <ListScreen />;
}
