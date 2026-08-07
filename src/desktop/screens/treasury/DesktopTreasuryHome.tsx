/**
 * Trésorerie — vue d'ensemble.
 *
 * The old desktop home was a launcher: three balance cards followed by ten
 * navigation tiles duplicating what the sidebar could not show. Now that every
 * treasury screen has its own rail entry, the tiles are gone and the page does
 * the job its name promises — state of the treasury at a glance:
 *
 *   · position per currency (XAF / USDT / CNY) and the current WAC
 *   · the two numbers that can hurt: negative USDT stock, immobilised capital
 *   · every account with its balance, grouped by currency, so a treasurer can
 *     reconcile without opening a second screen
 *
 * Same hooks as MobileTreasuryHome; guarded on `canViewTreasury`.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, Coins, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, EmptyState, Figure, Metric, Panel, PanelHead, Spinner } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

const CURRENCY_META: Record<string, { label: string; decimals: number; icon: typeof Wallet }> = {
  XAF: { label: 'Franc CFA', decimals: 0, icon: Wallet },
  USDT: { label: 'Tether', decimals: 2, icon: Coins },
  CNY: { label: 'Yuan', decimals: 2, icon: Building2 },
};

/** Human label for a `treasury_account_kind` enum value. */
const KIND_LABEL: Record<string, string> = {
  bank: 'Banque',
  mobile_money: 'Mobile money',
  crypto_pool: 'Pool crypto',
  cash: 'Caisse',
  alipay: 'Alipay',
  wechat: 'WeChat',
  other: 'Autre',
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function DesktopTreasuryHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: balances, isLoading } = useTreasuryAccountBalances();
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;
  if (isLoading) return <Spinner className="py-32" />;

  const rows = balances ?? [];
  const byCurrency = (cur: string) => rows.filter((b) => b.currency === cur);
  const totalFor = (cur: string) => byCurrency(cur).reduce((s, b) => s + (b.balance ?? 0), 0);

  const stockNegative = (stock ?? 0) < 0;
  /** Capital parked in USDT at its weighted average cost. */
  const immobilised = (stock ?? 0) * (wac ?? 0);

  return (
    <Workspace
      head={
        <ScreenHead
          title="Trésorerie"
          subtitle="Position par devise, coût moyen pondéré et soldes de comptes"
          actions={
            hasPermission('canManageTreasury') ? (
              <>
                <Button icon={TrendingUp} onClick={() => navigate('/m/more/treasury/purchase')}>
                  Nouvel achat USDT
                </Button>
                <Button variant="primary" icon={TrendingDown} onClick={() => navigate('/m/more/treasury/sale')}>
                  Nouvelle vente USDT
                </Button>
              </>
            ) : undefined
          }
        />
      }
    >
      {stockNegative && (
        <div className={cn('mb-4 flex items-start gap-3 rounded-xl border border-[#C0504D]/30 bg-[#FBE7E7] px-4 py-3 dark:bg-[#3A2526]')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
          <div>
            <p className="text-[13px] font-bold text-[#C0504D] dark:text-[#E79A9A]">Stock USDT négatif</p>
            <p className={cn(DT.label, DFG.base, 'mt-0.5')}>
              Plus d'USDT ont été vendus qu'achetés ({fmt(stock, 2)} USDT). Enregistrez l'achat manquant ou corrigez
              l'opération fautive avant de publier un taux de revient.
            </p>
          </div>
        </div>
      )}

      {/* Position */}
      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          icon={Wallet}
          tone="info"
          label="Position XAF"
          value={fmt(totalFor('XAF'), 0)}
          unit="XAF"
          hint={`${byCurrency('XAF').length} compte(s)`}
        />
        <Metric
          icon={Coins}
          tone={stockNegative ? 'danger' : 'pending'}
          label="Stock USDT"
          value={fmt(stock, 2)}
          unit="USDT"
          hint={`WAC ${fmt(wac, 4)} XAF/USDT`}
        />
        <Metric
          icon={Building2}
          tone="success"
          label="Position CNY"
          value={fmt(totalFor('CNY'), 2)}
          unit="CNY"
          hint={`${byCurrency('CNY').length} compte(s)`}
        />
        <Metric
          icon={TrendingUp}
          tone="neutral"
          label="Capital immobilisé"
          value={fmt(immobilised, 0)}
          unit="XAF"
          hint="Stock USDT valorisé au coût moyen pondéré"
        />
      </section>

      {/* Accounts */}
      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        {(['XAF', 'USDT', 'CNY'] as const).map((cur) => {
          const meta = CURRENCY_META[cur];
          const accounts = byCurrency(cur);
          return (
            <Panel key={cur} className="overflow-hidden">
              <PanelHead
                title={
                  <span className="flex items-center gap-2">
                    {cur}
                    <span className={cn(DT.label, DFG.faint, 'font-normal')}>{meta.label}</span>
                  </span>
                }
                actions={<Figure value={fmt(totalFor(cur), meta.decimals)} size="md" />}
              />
              {accounts.length === 0 ? (
                <EmptyState icon={meta.icon} title="Aucun compte" hint={`Aucun compte ${cur} actif.`} />
              ) : (
                accounts.map((a) => (
                  <div key={a.id} className={cn('flex items-center gap-3 border-b px-4 py-2.5 last:border-0', DS.line)}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12.5px] font-semibold', DFG.strong)}>{a.label}</span>
                      <span className={cn('block truncate text-[11px]', DFG.faint)}>
                        {KIND_LABEL[a.kind ?? ''] ?? a.kind} · {a.entry_count ?? 0} écriture
                        {(a.entry_count ?? 0) > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Figure
                      value={fmt(a.balance, meta.decimals)}
                      size="md"
                      tone={(a.balance ?? 0) < 0 ? 'negative' : undefined}
                    />
                  </div>
                ))
              )}
              <div className={cn('border-t px-4 py-2', DS.line)}>
                <Button size="sm" variant="ghost" onClick={() => navigate('/m/more/treasury/accounts')}>
                  Ajuster les soldes →
                </Button>
              </div>
            </Panel>
          );
        })}
      </section>

      <p className={cn(DT.label, DFG.faint, 'mt-4')}>
        <Badge tone="info">Rappel</Badge>{' '}
        Le WAC est recalculé à chaque achat ; le taux de revient XAF/CNY publié dans <strong>Analyse</strong> en découle
        directement.
      </p>
    </Workspace>
  );
}
