// Historique module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=hist-<screen>.
// Client-side unified ledger: mirrors LedgerEntryType + the colours/labels
// from MobileClientLedger.tsx. Each entry shows a signed amount and the
// running balance (balanceAfter). Deposits in, payments out.
import {
  ArrowDownCircle, ArrowUpCircle, XCircle, RefreshCw, PlusCircle, MinusCircle,
  Clock, Search, ChevronRight, FileText, Download, Calendar, Check, ArrowRight, Info,
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
        <header className="flex items-start justify-between gap-3 pt-2">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight">Historique</h1>
            <p className="mt-0.5 text-[13.5px] text-slate-400">Tous vos mouvements de solde</p>
          </div>
          <button className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[13px] font-semibold text-slate-100">
            <FileText className="h-[16px] w-[16px]" style={{ color: ACCENT }} /> Relevé
          </button>
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

/* ── statement — period picker + preview before PDF download ───────
 * Triggers the existing ClientStatementPDF (generateClientStatement.ts).
 * Reflects its real structure: brand palette (gold/violet/orange),
 * 3 summary blocks (deposits/payments/final balance), column preview. */
const PERIODS = ['30 derniers jours', 'Ce mois-ci', '3 derniers mois', 'Cette année', 'Personnalisée'];
function StatementScreen() {
  // Statement excludes informational rows (e.g. DEPOSIT_REFUSED), mirroring
  // shouldIncludeLedgerEntry — so totals here use the real-impact entries.
  const totalDeposits = 7_000_000;   // 2M + 5M validated deposits
  const totalPayments = 3_250_000;   // reserved payment
  const finalBalance = 12_450_000;
  return (
    <Shell>
      <header className="flex items-center gap-3 px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ChevronRight className="h-[19px] w-[19px] rotate-180 text-slate-200" /></button>
        <div className="pt-1"><h1 className="text-[19px] font-bold leading-none tracking-tight">Relevé de compte</h1><p className="mt-1 text-[12px] text-slate-500">Document officiel · PDF</p></div>
      </header>

      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* period selection */}
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Période</p>
          <div className="space-y-2.5">
            {PERIODS.map((p, i) => {
              const on = i === 0;
              return (
                <button key={p} className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left" style={on ? { borderColor: ACCENT, background: 'rgba(255,255,255,0.04)' } : { borderColor: 'rgba(255,255,255,0.10)' }}>
                  <Calendar className={`h-[18px] w-[18px] ${on ? '' : 'text-slate-500'}`} style={on ? { color: ACCENT } : undefined} />
                  <span className="flex-1 text-[14.5px] font-semibold">{p}</span>
                  {on
                    ? <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: ACCENT }}><Check className="h-3.5 w-3.5" /></span>
                    : <span className="h-5 w-5 rounded-full border-2 border-white/15" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* preview of what the PDF contains */}
        <div className="mt-6">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Aperçu du relevé</p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {/* brand header strip (gold/violet/orange — matches the PDF) */}
            <div className="flex items-center justify-between bg-[#1a1028] px-4 py-3">
              <div><p className="text-[13px] font-extrabold text-white">Bonzini</p><p className="text-[10px] text-white/45">Paiements CEMAC › Chine</p></div>
              <div className="text-right"><p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Document</p><p className="text-[11px] font-bold text-white">Relevé de compte</p></div>
            </div>
            <div className="flex h-[3px]"><span className="flex-[2]" style={{ background: '#f3a745' }} /><span className="flex-[3]" style={{ background: '#a64af7' }} /><span className="flex-[2]" style={{ background: '#fe560d' }} /></div>

            {/* 3 summary blocks */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
              <div className="px-2 py-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Dépôts</p><p className="mt-1 text-[14px] font-extrabold tabular-nums text-emerald-400">+{groupFr(totalDeposits)}</p></div>
              <div className="px-2 py-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Paiements</p><p className="mt-1 text-[14px] font-extrabold tabular-nums" style={{ color: '#fe560d' }}>-{groupFr(totalPayments)}</p></div>
              <div className="px-2 py-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Solde final</p><p className="mt-1 text-[14px] font-extrabold tabular-nums" style={{ color: '#a64af7' }}>{groupFr(finalBalance)}</p></div>
            </div>

            {/* column header + a couple of skeleton rows */}
            <div className="px-4 py-2.5">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-slate-500"><span>Date · Réf · Type</span><span>Débit / Crédit · Solde</span></div>
              {[
                { t: 'Dépôt', c: 'text-emerald-400', a: '+2 000 000' },
                { t: 'Paiement', c: 'text-orange-400', a: '-3 250 000' },
                { t: 'Dépôt', c: 'text-emerald-400', a: '+5 000 000' },
              ].map((r, i) => (
                <div key={i} className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[11px]">
                  <span className="text-slate-400">{r.t} · 29/05/2026</span>
                  <span className={`font-bold tabular-nums ${r.c}`}>{r.a}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-[11.5px] text-slate-500">PDF A4 · en-tête Bonzini, totaux et solde courant inclus.</p>
        </div>

        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white" style={{ background: ACCENT, boxShadow: '0 16px 36px -14px hsl(258 90% 55% / 0.7)' }}><Download className="h-[18px] w-[18px]" /> Télécharger le relevé (PDF)</button>
        <p className="mt-3 text-center text-[12px] text-slate-500">Les dépôts refusés et opérations de test sont exclus du relevé officiel.</p>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── movement detail (fiche d'une entrée du ledger) ────────────────
 * Shows the signed amount + type, balance-before → balance-after, the
 * description, date, source reference and a link to the related deposit
 * / payment. Informational rows (refused deposit, executed payment) get
 * the "aucun impact sur le solde" note (mirrors isInformational). */
type MovementKind = 'payment' | 'refused';
function MovementDetailScreen({ kind }: { kind: MovementKind }) {
  const isPayment = kind === 'payment';
  const type: LedgerType = isPayment ? 'PAYMENT_RESERVED' : 'DEPOSIT_REFUSED';
  const c = ENTRY[type];
  const amount = isPayment ? 3_250_000 : 900_000;
  const balanceBefore = isPayment ? 13_700_000 : 8_250_000;
  const balanceAfter = isPayment ? 10_450_000 : 8_250_000; // refused → unchanged
  const reference = isPayment ? 'PAY-2024-0117' : 'DEP-2024-0051';
  const linkLabel = isPayment ? 'Voir le paiement' : 'Voir le dépôt';
  const desc = isPayment ? 'Paiement Shenzhen Tech Co. · Alipay' : 'Dépôt cash — preuve illisible';

  return (
    <Shell>
      <header className="flex items-center gap-3 px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><ChevronRight className="h-[19px] w-[19px] rotate-180 text-slate-200" /></button>
        <div className="pt-1"><h1 className="text-[18px] font-bold leading-none tracking-tight">Mouvement</h1><p className="mt-1 font-mono text-[12px] text-slate-500">{reference}</p></div>
      </header>

      <div className="mx-auto max-w-[480px] px-5 pb-28">
        {/* amount card */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${c.tint}`}><c.Icon className={`h-7 w-7 ${c.ring}`} /></span>
          <p className={`mt-3 text-[36px] font-extrabold leading-none tracking-tight tabular-nums ${c.amount}`}>{c.prefix}{groupFr(amount)} <span className="text-[15px] font-semibold text-slate-500">XAF</span></p>
          <p className="mt-2 text-[14px] font-semibold text-slate-200">{c.label}</p>
          {c.informational && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-slate-400"><Info className="h-3.5 w-3.5" /> Aucun impact sur le solde</span>
          )}
        </div>

        {/* balance before → after (only when it impacts the balance) */}
        {!c.informational && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <div><p className="text-[11px] text-slate-500">Solde avant</p><p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-300">{groupFr(balanceBefore)}</p></div>
            <ArrowRight className="h-5 w-5 text-slate-500" />
            <div className="text-right"><p className="text-[11px] text-slate-500">Solde après</p><p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: ACCENT }}>{groupFr(balanceAfter)}</p></div>
          </div>
        )}

        {/* details */}
        <div className="mt-6">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Détails</p>
          <div className="divide-y divide-white/[0.06]">
            {[
              { k: 'Type', v: c.label },
              { k: 'Description', v: desc },
              { k: 'Référence', v: reference, mono: true },
              { k: 'Date', v: '29 mai 2026 · 09:14' },
            ].map((r) => (
              <div key={r.k} className="flex items-start justify-between gap-3 py-3"><span className="shrink-0 text-[13.5px] text-slate-400">{r.k}</span><span className={`text-right text-[14px] font-semibold ${r.mono ? 'font-mono' : ''}`}>{r.v}</span></div>
            ))}
          </div>
        </div>

        {/* link to the source operation */}
        <button className="mt-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-[14px] font-semibold">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${c.tint}`}><c.Icon className={`h-[18px] w-[18px] ${c.ring}`} /></span>
            {linkLabel}
          </span>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </button>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function HistoryPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  if (screen === 'statement') return <StatementScreen />;
  if (screen === 'detail-payment') return <MovementDetailScreen kind="payment" />;
  if (screen === 'detail-refused') return <MovementDetailScreen kind="refused" />;
  return <ListScreen />;
}
