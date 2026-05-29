// Historique module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=hist-<screen>.
// Client-side unified ledger: mirrors LedgerEntryType + the colours/labels
// from MobileClientLedger.tsx. Each entry shows a signed amount and the
// running balance (balanceAfter). Deposits in, payments out.
import {
  ArrowDownCircle, ArrowUpCircle, XCircle, RefreshCw, PlusCircle, MinusCircle,
  Clock, Search, ChevronRight,
  Home, ArrowDownToLine, Send, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const groupFr = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ── ledger entry config — mirrors ENTRY_TYPE_CONFIG (dark-tuned) ── */
type LedgerType =
  | 'DEPOSIT_VALIDATED' | 'DEPOSIT_REFUSED' | 'PAYMENT_RESERVED' | 'PAYMENT_EXECUTED'
  | 'PAYMENT_CANCELLED_REFUNDED' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT';

const ENTRY: Record<LedgerType, {
  Icon: typeof ArrowDownCircle; ring: string; tint: string; amount: string;
  prefix: '+' | '-' | ''; label: string; informational?: boolean;
}> = {
  DEPOSIT_VALIDATED:          { Icon: ArrowDownCircle, ring: 'text-emerald-400', tint: 'bg-emerald-400/12', amount: 'text-emerald-300', prefix: '+', label: 'Dépôt validé' },
  DEPOSIT_REFUSED:            { Icon: XCircle,         ring: 'text-slate-400',   tint: 'bg-white/[0.06]',   amount: 'text-slate-400',   prefix: '',  label: 'Dépôt refusé', informational: true },
  PAYMENT_RESERVED:           { Icon: Clock,           ring: 'text-amber-400',   tint: 'bg-amber-400/12',   amount: 'text-amber-300',   prefix: '-', label: 'Paiement réservé' },
  PAYMENT_EXECUTED:           { Icon: ArrowUpCircle,   ring: 'text-rose-400',    tint: 'bg-rose-400/12',    amount: 'text-rose-300',    prefix: '-', label: 'Paiement exécuté', informational: true },
  PAYMENT_CANCELLED_REFUNDED: { Icon: RefreshCw,       ring: 'text-emerald-400', tint: 'bg-emerald-400/12', amount: 'text-emerald-300', prefix: '+', label: 'Paiement remboursé' },
  ADMIN_CREDIT:               { Icon: PlusCircle,      ring: 'text-emerald-400', tint: 'bg-emerald-400/12', amount: 'text-emerald-300', prefix: '+', label: 'Crédit admin' },
  ADMIN_DEBIT:                { Icon: MinusCircle,     ring: 'text-rose-400',    tint: 'bg-rose-400/12',    amount: 'text-rose-300',    prefix: '-', label: 'Débit admin' },
};

/* ── fixtures: running balance is internally consistent ───────────── */
const entries: { type: LedgerType; desc: string; amount: number; date: string; balanceAfter: number }[] = [
  { type: 'DEPOSIT_VALIDATED',          desc: 'Dépôt Orange Money',                 amount: 2_000_000, date: "Aujourd'hui · 09:14", balanceAfter: 12_450_000 },
  { type: 'PAYMENT_RESERVED',           desc: 'Paiement Shenzhen Tech Co. · Alipay', amount: 3_250_000, date: 'Hier · 16:42',        balanceAfter: 10_450_000 },
  { type: 'PAYMENT_EXECUTED',           desc: 'Règlement Guangzhou Textiles',        amount: 1_800_000, date: '12 mai · 11:20',      balanceAfter: 13_700_000 },
  { type: 'DEPOSIT_VALIDATED',          desc: 'Virement bancaire Ecobank',           amount: 5_000_000, date: '10 mai · 08:30',      balanceAfter: 15_500_000 },
  { type: 'PAYMENT_CANCELLED_REFUNDED', desc: 'Remboursement Yiwu Trading Ltd.',     amount: 2_100_000, date: '8 mai · 14:05',       balanceAfter: 10_500_000 },
  { type: 'ADMIN_CREDIT',               desc: 'Ajustement commercial',               amount: 150_000,   date: '5 mai · 10:00',       balanceAfter: 8_400_000 },
  { type: 'DEPOSIT_REFUSED',            desc: 'Dépôt cash — preuve illisible',       amount: 900_000,   date: '2 mai · 16:30',       balanceAfter: 8_250_000 },
];

const FILTERS = ['Tous', 'Dépôts', 'Paiements', 'Crédits', 'Débits'];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique', active: true },
  { Icon: MessageCircle, label: 'Support', badge: 1 }, { Icon: User, label: 'Profil' },
];

const ACCENT = 'hsl(258 100% 60%)';

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

/* ── list ──────────────────────────────────────────────────── */
function ListScreen() {
  return (
    <Shell>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Historique</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-400">Tous vos mouvements de solde</p>
        </header>

        {/* search */}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <Search className="h-[18px] w-[18px] text-slate-500" />
          <span className="text-[14px] text-slate-500">Rechercher un mouvement…</span>
        </div>

        {/* filter chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f, i) => (
            <span key={f} className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold" style={i === 0 ? { background: ACCENT, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{f}</span>
          ))}
        </div>

        {/* entries */}
        <ul className="mt-3 space-y-2.5">
          {entries.map((e, i) => {
            const c = ENTRY[e.type];
            return (
              <li key={i}>
                <button className="flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${c.tint}`}><c.Icon className={`h-[22px] w-[22px] ${c.ring}`} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14.5px] font-semibold leading-tight">{c.label}</p>
                      <p className={`shrink-0 text-[14.5px] font-bold tabular-nums ${c.amount}`}>{c.prefix}{groupFr(e.amount)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-400">{e.desc}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-slate-500">
                      <span>{e.date}</span>
                      <span>Solde : <span className="font-semibold text-slate-300 tabular-nums">{groupFr(e.balanceAfter)}</span></span>
                    </div>
                    {c.informational && <p className="mt-1 text-[10.5px] italic text-slate-600">Informatif — aucun impact sur le solde</p>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── empty ─────────────────────────────────────────────────── */
function EmptyScreen() {
  return (
    <Shell>
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Historique</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-400">Tous vos mouvements de solde</p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl" style={{ background: 'hsl(258 100% 60% / 0.12)', color: ACCENT }}><History className="h-9 w-9" /></span>
          <p className="mt-5 text-[18px] font-bold">Aucun mouvement enregistré</p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[13.5px] leading-snug text-slate-400">Vos dépôts et paiements apparaîtront ici au fur et à mesure.</p>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function HistoryPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  return <ListScreen />;
}
