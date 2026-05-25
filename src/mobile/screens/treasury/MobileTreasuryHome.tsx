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
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useTreasuryAccountBalances,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';
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
  tone: 'violet' | 'amber' | 'orange';
  warning?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    violet: 'border-violet-200 bg-violet-50',
    amber: 'border-amber-200 bg-amber-50',
    orange: 'border-orange-200 bg-orange-50',
  };
  const accentClasses: Record<string, string> = {
    violet: 'text-violet-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
  };

  return (
    <div className={cn('rounded-2xl border p-3.5', toneClasses[tone])}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', accentClasses[tone])}>{label}</span>
        {warning && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
      </div>
      <div className={cn('text-[20px] font-extrabold', warning ? 'text-red-600' : 'text-foreground')}>
        {formatNumber(amount, unit === 'USDT' ? 2 : 0)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {unit} · {accountCount} compte{accountCount > 1 ? 's' : ''}
      </div>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  description,
  onClick,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  tone: 'violet' | 'amber' | 'orange' | 'neutral';
}) {
  const toneBg: Record<string, string> = {
    violet: 'bg-violet-600',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    neutral: 'bg-slate-600',
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-border rounded-2xl p-4 text-left active:bg-muted/40 transition-colors flex items-center gap-3"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0', toneBg[tone])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-foreground text-[15px]">{label}</div>
        <div className="text-[12px] text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

export function MobileTreasuryHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: balances } = useTreasuryAccountBalances();
  const { data: wac } = useUsdtWac();
  const { data: stockUsdt } = useUsdtStock();

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const totals = (balances ?? []).reduce<Record<string, { total: number; count: number }>>(
    (acc, b) => {
      const cur = b.currency ?? 'XAF';
      if (!acc[cur]) acc[cur] = { total: 0, count: 0 };
      acc[cur].total += Number(b.balance ?? 0);
      acc[cur].count += 1;
      return acc;
    },
    {},
  );

  const stockNegative = (stockUsdt ?? 0) < 0;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Trésorerie" showBack backTo="/m/more" />

      <div className="px-4 py-4 space-y-5">
        {/* Balances */}
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Soldes</h2>
          <div className="grid grid-cols-3 gap-2">
            <CurrencyCard
              label="XAF"
              amount={totals.XAF?.total ?? 0}
              unit="XAF"
              accountCount={totals.XAF?.count ?? 0}
              tone="violet"
            />
            <CurrencyCard
              label="USDT"
              amount={totals.USDT?.total ?? 0}
              unit="USDT"
              accountCount={totals.USDT?.count ?? 0}
              tone="amber"
              warning={stockNegative}
            />
            <CurrencyCard
              label="CNY"
              amount={totals.CNY?.total ?? 0}
              unit="CNY"
              accountCount={totals.CNY?.count ?? 0}
              tone="orange"
            />
          </div>
          {stockNegative && (
            <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-[12px] text-red-700 font-medium">
                Stock USDT négatif : {formatNumber(stockUsdt)} — enregistrez un achat manquant.
              </span>
            </div>
          )}
        </section>

        {/* WAC banner */}
        <section className="bg-gradient-to-br from-amber-50 to-violet-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1">WAC USDT courant</div>
              <div className="text-2xl font-extrabold text-foreground">
                {formatNumber(wac, 4)} <span className="text-sm font-semibold text-muted-foreground">XAF / USDT</span>
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-500" />
          </div>
        </section>

        {/* Analytics */}
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Analyse</h2>
          <div className="space-y-2.5">
            <ActionTile
              icon={BarChart3}
              label="Dashboard analytique"
              description="Volumes, taux moyens, bénéfice, top contreparties"
              onClick={() => navigate('/m/more/treasury/dashboard')}
              tone="violet"
            />
            <ActionTile
              icon={History}
              label="Historique opérations"
              description="Toutes les opérations + voiding"
              onClick={() => navigate('/m/more/treasury/operations')}
              tone="neutral"
            />
            <ActionTile
              icon={ImageIcon}
              label="Dashboard soldes (PNG/PDF)"
              description="Générer le visuel des soldes par compte"
              onClick={() => navigate('/m/more/treasury/balance-dashboard')}
              tone="orange"
            />
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Actions</h2>
          <div className="space-y-2.5">
            <ActionTile
              icon={ArrowDownToLine}
              label="Nouvel achat USDT"
              description="Saisir un achat XAF → USDT auprès d'un fournisseur"
              onClick={() => navigate('/m/more/treasury/purchase')}
              tone="violet"
            />
            <ActionTile
              icon={ArrowDownToLine}
              label="Mes achats USDT"
              description="Liste, total, suppression"
              onClick={() => navigate('/m/more/treasury/purchases')}
              tone="neutral"
            />
            <ActionTile
              icon={ArrowUpFromLine}
              label="Nouvelle vente USDT"
              description="Saisir une vente USDT → CNY auprès d'un acheteur"
              onClick={() => navigate('/m/more/treasury/sale')}
              tone="amber"
            />
            <ActionTile
              icon={ArrowUpFromLine}
              label="Mes ventes USDT"
              description="Liste, total, suppression"
              onClick={() => navigate('/m/more/treasury/sales')}
              tone="neutral"
            />
            <ActionTile
              icon={Users}
              label="Contreparties"
              description="Fournisseurs USDT et acheteurs CNY"
              onClick={() => navigate('/m/more/treasury/counterparties')}
              tone="orange"
            />
            <ActionTile
              icon={Wallet}
              label="Comptes & soldes"
              description="Soldes par compte, historique"
              onClick={() => navigate('/m/more/treasury/accounts')}
              tone="neutral"
            />
            <ActionTile
              icon={ClipboardCheck}
              label="Inventaire des comptes"
              description="Réconciliation cash / Alipay / WeChat"
              onClick={() => navigate('/m/more/treasury/inventory')}
              tone="neutral"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
