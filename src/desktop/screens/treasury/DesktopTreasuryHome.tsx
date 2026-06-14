/**
 * Desktop admin — Treasury home.
 *
 * Same data and treasury design-kit primitives as MobileTreasuryHome
 * (balances, WAC, USDT stock + ActionTile navigation), laid out for a wide
 * screen: balances + WAC on one row, navigation tiles in a grid.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Wallet,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  History,
  Image as ImageIcon,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import {
  ActionTile,
  IconChip,
  SectionTitle,
  SOFT_CARD,
  TONE_DOT,
  TONE_TEXT,
  type Tone,
} from '@/components/treasury/ui';
import { PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';
import { cn } from '@/lib/utils';

function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function CurrencyCard({
  label,
  amount,
  unit,
  accountCount,
  tone,
  warning,
}: {
  label: string;
  amount: number;
  unit: string;
  accountCount: number;
  tone: Exclude<Tone, 'neutral' | 'danger'>;
  warning?: boolean;
}) {
  const display =
    Math.abs(amount) >= 1_000_000
      ? `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
      : formatNumber(amount, 0);
  return (
    <div className={cn(SOFT_CARD, 'p-4')}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', warning ? 'bg-red-500' : TONE_DOT[tone])} />
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', warning ? 'text-red-600 dark:text-red-400' : TONE_TEXT[tone])}>
          {label}
        </span>
        {warning && <AlertTriangle className="ml-auto h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
      </div>
      <div className={cn('text-[24px] font-extrabold leading-none tracking-tight tabular-nums', warning ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
        {display}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {unit} · {accountCount} compte{accountCount > 1 ? 's' : ''}
      </div>
    </div>
  );
}

export function DesktopTreasuryHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: balances } = useTreasuryAccountBalances();
  const { data: wac } = useUsdtWac();
  const { data: stockUsdt } = useUsdtStock();

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const totals = (balances ?? []).reduce<Record<string, { total: number; count: number }>>((acc, b) => {
    const cur = b.currency ?? 'XAF';
    if (!acc[cur]) acc[cur] = { total: 0, count: 0 };
    acc[cur].total += Number(b.balance ?? 0);
    acc[cur].count += 1;
    return acc;
  }, {});
  const stockNegative = (stockUsdt ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Trésorerie</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Soldes, coût moyen et opérations USDT</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/m/more/treasury/purchase')}
            className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}
          >
            <ArrowDownToLine className="h-4 w-4" /> Nouvel achat
          </button>
          <button
            onClick={() => navigate('/m/more/treasury/sale')}
            className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
          >
            <ArrowUpFromLine className="h-4 w-4" /> Nouvelle vente
          </button>
        </div>
      </header>

      {/* Balances + WAC */}
      <section>
        <SectionTitle>Soldes & coût</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CurrencyCard label="XAF" amount={totals.XAF?.total ?? 0} unit="XAF" accountCount={totals.XAF?.count ?? 0} tone="violet" />
          <CurrencyCard label="USDT" amount={totals.USDT?.total ?? 0} unit="USDT" accountCount={totals.USDT?.count ?? 0} tone="amber" warning={stockNegative} />
          <CurrencyCard label="CNY" amount={totals.CNY?.total ?? 0} unit="CNY" accountCount={totals.CNY?.count ?? 0} tone="orange" />
          <div className={cn(SOFT_CARD, 'flex items-center gap-3.5 p-4')}>
            <IconChip icon={TrendingUp} tone="amber" size="lg" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WAC USDT</div>
              <div className="text-[20px] font-extrabold leading-tight tracking-tight tabular-nums text-foreground">
                {formatNumber(wac, 4)}
              </div>
              <div className="text-[10px] text-muted-foreground">XAF/USDT</div>
            </div>
          </div>
        </div>
        {stockNegative && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="text-[12px] font-medium text-red-600 dark:text-red-300">
              Stock USDT négatif : {formatNumber(stockUsdt)} — enregistrez un achat manquant.
            </span>
          </div>
        )}
      </section>

      {/* Analyse */}
      <section>
        <SectionTitle>Analyse</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ActionTile icon={BarChart3} label="Dashboard analytique" description="Volumes, taux moyens, bénéfice, top contreparties" onClick={() => navigate('/m/more/treasury/dashboard')} tone="violet" />
          <ActionTile icon={History} label="Historique opérations" description="Toutes les opérations + annulation" onClick={() => navigate('/m/more/treasury/operations')} tone="neutral" />
          <ActionTile icon={ImageIcon} label="Dashboard soldes (PNG/PDF)" description="Générer le visuel des soldes par compte" onClick={() => navigate('/m/more/treasury/balance-dashboard')} tone="orange" />
        </div>
      </section>

      {/* Actions */}
      <section>
        <SectionTitle>Actions</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionTile icon={ArrowDownToLine} label="Nouvel achat USDT" description="Saisir un achat XAF → USDT" onClick={() => navigate('/m/more/treasury/purchase')} tone="violet" />
          <ActionTile icon={ArrowDownToLine} label="Mes achats USDT" description="Liste, total, suppression" onClick={() => navigate('/m/more/treasury/purchases')} tone="neutral" />
          <ActionTile icon={ArrowUpFromLine} label="Nouvelle vente USDT" description="Saisir une vente USDT → CNY" onClick={() => navigate('/m/more/treasury/sale')} tone="amber" />
          <ActionTile icon={ArrowUpFromLine} label="Mes ventes USDT" description="Liste, total, suppression" onClick={() => navigate('/m/more/treasury/sales')} tone="neutral" />
          <ActionTile icon={Users} label="Contreparties" description="Fournisseurs USDT et acheteurs CNY" onClick={() => navigate('/m/more/treasury/counterparties')} tone="orange" />
          <ActionTile icon={Wallet} label="Comptes & soldes" description="Soldes par compte, historique" onClick={() => navigate('/m/more/treasury/accounts')} tone="neutral" />
          <ActionTile icon={ClipboardCheck} label="Inventaire des comptes" description="Réconciliation cash / Alipay / WeChat" onClick={() => navigate('/m/more/treasury/inventory')} tone="neutral" />
        </div>
      </section>
    </div>
  );
}
