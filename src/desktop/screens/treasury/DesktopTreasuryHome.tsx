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
import { AlertTriangle, Building2, Coins, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, EmptyState, Figure, IconButton, Metric, Panel, PanelHead, Skeleton } from '@/desktop/ui/primitives';
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
  crypto_pool: 'Portefeuille crypto',
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
  const { data: balances, isLoading, isError, isFetching, refetch } = useTreasuryAccountBalances();
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();

  /* Mobile sends a denied treasurer back to /m/more; match it so the same
     refusal doesn't land in two different places depending on window width. */
  if (!hasPermission('canViewTreasury')) return <Navigate to="/m/more" replace />;

  const rows = balances ?? [];
  const byCurrency = (cur: string) => rows.filter((b) => b.currency === cur);
  const totalFor = (cur: string) => byCurrency(cur).reduce((s, b) => s + (b.balance ?? 0), 0);

  const stockNegative = (stock ?? 0) < 0;
  const positionReady = stock !== undefined && wac !== undefined;
  /**
   * USDT stock valued at its weighted average cost. Deliberately NOT labelled
   * "capital immobilisé": the treasury analytics RPC adds the CNY leg and
   * clamps a negative stock to zero, so two screens showing the same label with
   * different formulas would be worse than two honest labels.
   */
  const usdtAtCost = positionReady ? Math.max(0, stock as number) * (wac as number) : null;

  return (
    <Workspace
      head={
        <ScreenHead
          title="Trésorerie"
          subtitle="Position par devise, coût moyen pondéré (CMP) et soldes de comptes"
          actions={
            <>
              <IconButton icon={RefreshCw} label="Actualiser" loading={isFetching} onClick={() => refetch()} />
              {hasPermission('canManageTreasury') && (
                <>
                  <Button icon={TrendingUp} onClick={() => navigate('/m/more/treasury/purchase')}>
                    Nouvel achat USDT
                  </Button>
                  <Button variant="primary" icon={TrendingDown} onClick={() => navigate('/m/more/treasury/sale')}>
                    Nouvelle vente USDT
                  </Button>
                </>
              )}
            </>
          }
        />
      }
    >
      {stockNegative && (
        <div className={cn('mb-4 flex items-start gap-3 rounded-xl border border-[#C0504D]/30 bg-[#FBE7E7] px-4 py-3 dark:border-[#E79A9A]/30 dark:bg-[#3A2526]')}>
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
          hint={`${byCurrency('XAF').length} compte${byCurrency('XAF').length > 1 ? 's' : ''}`}
        />
        <Metric
          icon={Coins}
          tone={stockNegative ? 'danger' : 'pending'}
          label="Stock USDT"
          value={stock === undefined ? '—' : fmt(stock, 2)}
          unit="USDT"
          hint={`CMP ${fmt(wac, 4)} XAF/USDT`}
        />
        <Metric
          icon={Building2}
          tone="success"
          label="Position CNY"
          value={fmt(totalFor('CNY'), 2)}
          unit="CNY"
          hint={`${byCurrency('CNY').length} compte${byCurrency('CNY').length > 1 ? 's' : ''}`}
        />
        <Metric
          icon={TrendingUp}
          tone="neutral"
          label="Stock USDT valorisé"
          value={usdtAtCost === null ? '—' : fmt(usdtAtCost, 0)}
          unit="XAF"
          hint="Au CMP · capital immobilisé complet dans Analyse"
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
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : isError ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Soldes indisponibles"
                  hint="La requête a échoué — ce compte n'est pas à zéro, il n'a pas pu être lu."
                  action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
                />
              ) : accounts.length === 0 ? (
                <EmptyState icon={meta.icon} title="Aucun compte" hint={`Aucun compte ${cur} actif.`} />
              ) : (
                accounts.map((a) => (
                  <div key={a.id} className={cn('flex items-center gap-3 border-b px-4 py-2.5 last:border-0', DS.line)}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12.5px] font-semibold', DFG.strong)}>{a.label}</span>
                      <span className={cn('block truncate text-[11px]', DFG.faint)}>
                        {KIND_LABEL[a.kind ?? ''] ?? a.kind} · {a.entry_count ?? 0} mouvement
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
                <Button variant="ghost" onClick={() => navigate('/m/more/treasury/accounts')}>
                  Ajuster les soldes →
                </Button>
              </div>
            </Panel>
          );
        })}
      </section>

      <p className={cn(DT.label, DFG.faint, 'mt-4')}>
        <Badge tone="info">Rappel</Badge>{' '}
        Le coût moyen pondéré est recalculé à chaque achat ; le taux de revient XAF/CNY publié dans{' '}
        <strong>Analyse</strong> en découle directement.
      </p>
    </Workspace>
  );
}
