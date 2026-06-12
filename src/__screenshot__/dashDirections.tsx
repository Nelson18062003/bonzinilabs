/**
 * DEV-ONLY mockups — 3 from-scratch directions for the admin home dashboard.
 * Static data; rendered by the screenshot harness so the user can choose a
 * structural direction before we build the real screen.
 */
import {
  Wallet, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Users, BarChart3,
  Bell, ChevronRight, Plus, Send, Eye, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── fixtures ────────────────────────────────────────────────
const D = {
  greeting: 'Bonjour, Demo',
  role: 'Super Admin',
  balance: 48_750_000,
  volume7j: 86_200_000,
  depositsToday: 8_200_000,
  paymentsToday: 12_400_000,
  pendingDeposits: 3,
  pendingPayments: 2,
  rates: { alipay: 92_100, wechat: 91_800, virement: 90_500, cash: 86_500 },
  recent: [
    { name: 'Awa Diop', when: 'Il y a 1 h', amount: 2_500_000, status: 'review' as const },
    { name: 'Jean Kamga', when: 'Il y a 2 h', amount: 1_800_000, status: 'ok' as const },
    { name: 'Marie Nkolo', when: 'Il y a 4 h', amount: 950_000, status: 'ok' as const },
  ],
};
const full = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const compact = (n: number) => n.toLocaleString('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

// ── shared bits ─────────────────────────────────────────────
function Greeting() {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">{D.greeting}</h1>
        <span className="mt-1 inline-flex rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-bonzini-violet">{D.role}</span>
      </div>
      <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bonzini-orange px-1 text-[9px] font-bold text-white">5</span>
      </button>
    </header>
  );
}

const ACTIONS = [
  { icon: Plus, label: 'Dépôt', tone: 'emerald' },
  { icon: Send, label: 'Paiement', tone: 'violet' },
  { icon: Users, label: 'Clients', tone: 'orange' },
  { icon: BarChart3, label: 'Analytics', tone: 'amber' },
] as const;
const TONE: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600',
  violet: 'bg-violet-500/10 text-bonzini-violet',
  orange: 'bg-orange-500/10 text-bonzini-orange',
  amber: 'bg-amber-500/10 text-bonzini-amber',
};
function QuickActions({ boxed }: { boxed?: boolean }) {
  const inner = (
    <div className="grid grid-cols-4 gap-2">
      {ACTIONS.map((a) => (
        <div key={a.label} className="flex flex-col items-center gap-2">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', TONE[a.tone])}>
            <a.icon className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">{a.label}</span>
        </div>
      ))}
    </div>
  );
  return boxed ? <div className="rounded-3xl border border-border bg-card p-4">{inner}</div> : inner;
}

function RateMini() {
  const rows = [
    { k: 'Alipay', v: D.rates.alipay, c: '#1677ff' },
    { k: 'WeChat', v: D.rates.wechat, c: '#07c160' },
    { k: 'Virement', v: D.rates.virement, c: '#8b5cf6' },
    { k: 'Cash', v: D.rates.cash, c: '#dc2626' },
  ];
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taux du jour</div>
          <div className="text-[13px] font-extrabold text-foreground">1 000 000 XAF =</div>
        </div>
        <span className="rounded-xl bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-bonzini-violet">Détails →</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2">
            <span className="h-2 w-2 rounded-full" style={{ background: r.c }} />
            <span className="text-[11px] text-muted-foreground">{r.k}</span>
            <span className="ml-auto text-[13px] font-bold tabular-nums text-foreground">¥{full(Math.round(r.v))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Recent() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Activité récente</h2>
        <span className="text-[12px] font-semibold text-bonzini-violet">Voir tout</span>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {D.recent.map((r, i) => (
          <div key={r.name} className={cn('flex items-center gap-3 p-4', i < D.recent.length - 1 && 'border-b border-border/60')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[12px] font-bold text-bonzini-violet">{initials(r.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-foreground">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">{r.when}</div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-bold tabular-nums text-foreground">{full(r.amount)}</div>
              <span className={cn('text-[10px] font-semibold', r.status === 'ok' ? 'text-emerald-600' : 'text-orange-600')}>
                {r.status === 'ok' ? 'Validé' : 'En revue'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-background px-5 py-6 space-y-6" style={{ paddingTop: 'max(env(safe-area-inset-top,0px), 1.25rem)' }}>{children}</div>;
}

// ════════════════════════════════════════════════════════════
// Direction A — "Hero sombre" : un seul gros chiffre, focus, type private-bank
// ════════════════════════════════════════════════════════════
export function DashDirA() {
  return (
    <Shell>
      <Greeting />

      {/* Hero balance — full width so the exact number fits big, on one line */}
      <div className="rounded-[28px] bg-foreground p-6 text-background">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-background/60">Solde plateforme</span>
          <Eye className="h-4 w-4 text-background/50" />
        </div>
        <div className="mt-2 text-[34px] font-extrabold leading-none tracking-tight tabular-nums">
          {full(D.balance)} <span className="text-base font-semibold text-background/60">XAF</span>
        </div>
        <div className="mt-5 flex gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-background/50">Volume 7 j</div>
            <div className="text-[15px] font-bold tabular-nums">{compact(D.volume7j)}</div>
          </div>
          <div className="border-l border-background/15 pl-6">
            <div className="text-[10px] uppercase tracking-wider text-background/50">Dépôts auj.</div>
            <div className="text-[15px] font-bold tabular-nums text-emerald-400">+{compact(D.depositsToday)}</div>
          </div>
          <div className="border-l border-background/15 pl-6">
            <div className="text-[10px] uppercase tracking-wider text-background/50">Paiements auj.</div>
            <div className="text-[15px] font-bold tabular-nums">{compact(D.paymentsToday)}</div>
          </div>
        </div>
      </div>

      {/* Priority — single soft strip */}
      <button className="flex w-full items-center gap-3 rounded-3xl bg-orange-500/10 p-4 text-left">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-orange text-[14px] font-bold text-white">{D.pendingDeposits}</span>
        <span className="flex-1 text-[14px] font-semibold text-orange-700 dark:text-orange-300">dépôts à valider</span>
        <span className="text-[12px] font-semibold text-orange-700/70 dark:text-orange-300/70">{D.pendingPayments} paiements ·</span>
        <ChevronRight className="h-4 w-4 text-orange-600" />
      </button>

      <QuickActions />
      <RateMini />
      <Recent />
    </Shell>
  );
}

// ════════════════════════════════════════════════════════════
// Direction B — "Clarté en lignes" : pas de tuiles, des lignes pleine largeur
// ════════════════════════════════════════════════════════════
export function DashDirB() {
  const rows = [
    { icon: TrendingUp, label: 'Volume 7 jours', value: full(D.volume7j), tone: 'violet' },
    { icon: ArrowDownToLine, label: "Dépôts aujourd'hui", value: full(D.depositsToday), tone: 'emerald' },
    { icon: ArrowUpFromLine, label: "Paiements aujourd'hui", value: full(D.paymentsToday), tone: 'amber' },
  ];
  return (
    <Shell>
      <Greeting />

      {/* Balance — no card, just a clean block; number has the full width */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Solde plateforme</div>
        <div className="mt-1 text-[36px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
          {full(D.balance)}
        </div>
        <div className="mt-1 text-[13px] font-semibold text-muted-foreground">XAF · engagement total wallets</div>
      </div>

      {/* Secondary stats as full-width rows — nothing truncates, values right-aligned */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {rows.map((r, i) => (
          <div key={r.label} className={cn('flex items-center gap-3 p-4', i < rows.length - 1 && 'border-b border-border/60')}>
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', TONE[r.tone])}>
              <r.icon className="h-[18px] w-[18px]" />
            </div>
            <span className="flex-1 text-[14px] font-medium text-foreground">{r.label}</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">{r.value} <span className="text-[11px] font-medium text-muted-foreground">XAF</span></span>
          </div>
        ))}
      </div>

      <button className="flex w-full items-center gap-3 rounded-3xl bg-orange-500/10 p-4 text-left">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-orange text-[14px] font-bold text-white">{D.pendingDeposits}</span>
        <span className="flex-1 text-[14px] font-semibold text-orange-700 dark:text-orange-300">dépôts à valider · {D.pendingPayments} paiements</span>
        <ChevronRight className="h-4 w-4 text-orange-600" />
      </button>

      <QuickActions boxed />
      <RateMini />
      <Recent />
    </Shell>
  );
}

// ════════════════════════════════════════════════════════════
// Direction C — "Bento" : grille de tailles variées, moderne et structurée
// ════════════════════════════════════════════════════════════
export function DashDirC() {
  return (
    <Shell>
      <Greeting />

      {/* Bento: balance large (full) + 2 accent stats + today net */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-bonzini-violet"><Wallet className="h-[18px] w-[18px]" /></div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Solde plateforme</span>
          </div>
          <div className="mt-3 text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
            {full(D.balance)} <span className="text-base font-semibold text-muted-foreground">XAF</span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-bonzini-amber">Volume 7 j</div>
          <div className="mt-2 text-[20px] font-extrabold leading-none tabular-nums text-foreground">{compact(D.volume7j)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">XAF</div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Net aujourd'hui</div>
          <div className="mt-2 text-[20px] font-extrabold leading-none tabular-nums text-emerald-600">+{compact(D.depositsToday - 0)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">dépôts − paiements</div>
        </div>
      </div>

      {/* Priority bento row */}
      <div className="grid grid-cols-2 gap-3">
        <button className="flex items-center gap-2.5 rounded-3xl bg-orange-500/10 p-4 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-orange text-[14px] font-bold text-white">{D.pendingDeposits}</span>
          <span className="text-[12px] font-semibold leading-tight text-orange-700 dark:text-orange-300">dépôts à valider</span>
        </button>
        <button className="flex items-center gap-2.5 rounded-3xl bg-violet-500/10 p-4 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-violet text-[14px] font-bold text-white">{D.pendingPayments}</span>
          <span className="text-[12px] font-semibold leading-tight text-bonzini-violet">paiements en attente</span>
        </button>
      </div>

      <QuickActions boxed />
      <RateMini />
      <Recent />
    </Shell>
  );
}
