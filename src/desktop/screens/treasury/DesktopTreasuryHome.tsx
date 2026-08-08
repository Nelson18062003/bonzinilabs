/**
 * Trésorerie — vue d'ensemble.
 *
 * The old desktop home was a launcher: three balance cards followed by ten
 * navigation tiles duplicating what the sidebar could not show. Now that every
 * treasury screen has its own rail entry, the tiles are gone and the page does
 * the job its name promises — state of the treasury at a glance:
 *
 *   · the two USDT numbers that have no other home (stock, stock au CMP)
 *   · the one number that can hurt: a negative USDT stock
 *   · every account with its balance, grouped by currency, so a treasurer can
 *     reconcile without opening a second screen
 *
 * Density notes (the audit this rewrite answers):
 *   · the XAF / CNY positions are NOT tiles any more — each currency total is
 *     already printed in its panel head, and a number printed twice on one
 *     screen makes an operator check which of the two is stale.
 *   · there is no per-panel "Ajuster les soldes" button. It was the same button
 *     three times over, all pointing at the same screen; the account rows are
 *     the through-line instead, so the target is "this account" and not "the
 *     balances in general".
 *   · the three panels are fed by one query, so a failure is reported once with
 *     one retry — not three times with three.
 *
 * Same hooks as MobileTreasuryHome; guarded on `canViewTreasury`.
 */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, ChevronRight, Coins, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS, DACCENT } from '@/desktop/ui/tokens';
import { Badge, Button, EmptyState, Figure, Metric, Panel, PanelHead, Skeleton } from '@/desktop/ui/primitives';
import { MenuButton } from '@/desktop/ui/Popover';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

/** Adjustments live here. The route takes no account id — see ACCOUNTS_ROUTE use. */
const ACCOUNTS_ROUTE = '/m/more/treasury/accounts';
/** Bénéfice, taux de revient, capital immobilisé, évolution du CMP. */
const ANALYSE_ROUTE = '/m/more/treasury/dashboard';
/** Every achat / vente USDT — the movements the stock is the net of. */
const OPERATIONS_ROUTE = '/m/more/treasury/operations';

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

/**
 * Placeholder with the exact geometry of a `Metric`, so the KPI strip does not
 * jump when the figures land — and, more importantly, so a loading screen never
 * prints `0` or `—` where a treasurer expects a balance.
 */
function MetricSkeleton() {
  return (
    <div className={cn('rounded-xl border p-3', DS.card, DS.line)} aria-hidden>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mt-2 h-7 w-32" />
      <Skeleton className="mt-1 h-4 w-40" />
    </div>
  );
}

export function DesktopTreasuryHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: balances, isLoading, isError, isFetching, refetch } = useTreasuryAccountBalances();
  const { data: wac, isError: wacError } = useUsdtWac();
  const { data: stock, isError: stockError } = useUsdtStock();

  /* Mobile sends a denied treasurer back to /m/more; match it so the same
     refusal doesn't land in two different places depending on window width. */
  if (!hasPermission('canViewTreasury')) return <Navigate to="/m/more" replace />;

  const rows = balances ?? [];
  const byCurrency = (cur: string) => rows.filter((b) => b.currency === cur);
  const totalFor = (cur: string) => byCurrency(cur).reduce((s, b) => s + (b.balance ?? 0), 0);

  const stockNegative = (stock ?? 0) < 0;
  const positionReady = stock !== undefined && wac !== undefined;
  /* Never pulse forever: if either RPC failed the tiles fall back to "—". */
  const positionPending = !positionReady && !stockError && !wacError;
  /**
   * USDT stock valued at its weighted average cost. Deliberately NOT labelled
   * "capital immobilisé": the treasury analytics RPC adds the CNY leg and
   * clamps a negative stock to zero, so two screens showing the same label with
   * different formulas would be worse than two honest labels.
   */
  const usdtAtCost = positionReady ? Math.max(0, stock as number) * (wac as number) : null;

  /**
   * A vente USDT with no stock is precisely what produces the negative-stock
   * banner this screen exists to raise, so the action is closed at the source
   * rather than left to be regretted. The reason rides on a wrapper `<span>`:
   * a disabled `Button` sets `pointer-events-none`, so its own `title` would
   * never surface.
   */
  const canManage = hasPermission('canManageTreasury');
  const saleBlocked = stock !== undefined && stock <= 0;
  const saleBlockedReason = stockNegative
    ? `Stock USDT négatif (${fmt(stock, 2)} USDT) : régularisez l'achat manquant avant d'enregistrer une vente.`
    : "Stock USDT à zéro : enregistrez d'abord un achat USDT.";

  return (
    <Workspace
      head={
        <ScreenHead
          title="Trésorerie"
          subtitle="Position par devise, coût moyen pondéré (CMP) et soldes de comptes"
          actions={
            <>
              <MenuButton
                items={[
                  {
                    label: 'Actualiser',
                    icon: RefreshCw,
                    onSelect: () => { void refetch(); },
                    disabled: isFetching,
                    hint: 'Actualisation en cours…',
                  },
                ]}
              />
              {canManage && (
                <>
                  <Button icon={TrendingUp} onClick={() => navigate('/m/more/treasury/purchase')}>
                    Nouvel achat USDT
                  </Button>
                  <span title={saleBlocked ? saleBlockedReason : undefined}>
                    <Button
                      variant="primary"
                      icon={TrendingDown}
                      disabled={saleBlocked}
                      onClick={() => navigate('/m/more/treasury/sale')}
                    >
                      Nouvelle vente USDT
                    </Button>
                  </span>
                </>
              )}
            </>
          }
        />
      }
    >
      {/* The single place this screen explains a negative stock. The Stock USDT
          tile deliberately carries no danger tone: it would restate this banner
          in a colour, four centimetres away, with none of the explanation. */}
      {stockNegative && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#C0504D]/30 bg-[#FBE7E7] px-4 py-3 dark:border-[#E79A9A]/30 dark:bg-[#3A2526]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
          <div>
            <p className={cn(DT.body, 'font-bold text-[#C0504D] dark:text-[#E79A9A]')}>Stock USDT négatif</p>
            <p className={cn(DT.label, DFG.base, 'mt-1')}>
              Plus d'USDT ont été vendus qu'achetés ({fmt(stock, 2)} USDT). Enregistrez l'achat manquant ou corrigez
              l'opération fautive avant de publier un taux de revient. La vente USDT reste fermée d'ici là.
            </p>
          </div>
        </div>
      )}

      {/* Position — only the numbers with no other home on this screen. The XAF
          and CNY totals are printed by their panel heads below. */}
      <section className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {positionPending ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <Metric
              icon={Coins}
              label="Stock USDT"
              value={stock === undefined ? '—' : fmt(stock, 2)}
              unit="USDT"
              hint={`CMP ${fmt(wac, 4)} XAF/USDT · voir les mouvements`}
              onClick={() => navigate(OPERATIONS_ROUTE)}
            />
            <Metric
              icon={TrendingUp}
              label="Stock USDT valorisé"
              value={usdtAtCost === null ? '—' : fmt(usdtAtCost, 0)}
              unit="XAF"
              hint="Au CMP · capital immobilisé complet"
              onClick={() => navigate(ANALYSE_ROUTE)}
            />
          </>
        )}
      </section>

      {/* Accounts — one query, so one failure and one retry. */}
      {isError ? (
        <Panel>
          <EmptyState
            icon={AlertTriangle}
            title="Soldes des comptes indisponibles"
            hint="La requête a échoué — aucun compte n'est à zéro, les soldes n'ont simplement pas pu être lus."
            action={
              <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                Réessayer
              </Button>
            }
          />
        </Panel>
      ) : (
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
                      <span className={cn(DT.label, DFG.faint)}>{meta.label}</span>
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
                ) : accounts.length === 0 ? (
                  <EmptyState icon={meta.icon} title="Aucun compte" hint={`Aucun compte ${cur} actif.`} />
                ) : (
                  accounts.map((a) => (
                    /* The row IS the affordance: it names the account, so it can
                       carry the account through to its adjustment. This is a list
                       row, not a control — its geometry comes from the density
                       ladder (44px min, 4px grid), not from CONTROL. */
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate(ACCOUNTS_ROUTE)}
                      title={`Ouvrir « ${a.label} » dans Comptes & soldes`}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 border-b px-4 py-2 text-left transition-colors last:border-0',
                        DS.line,
                        DS.hover,
                        DFOCUS,
                        // The panel clips, so an outset ring would be invisible.
                        'focus-visible:ring-inset',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>{a.label}</span>
                        <span className={cn('block truncate', DT.label, DFG.faint)}>
                          {KIND_LABEL[a.kind ?? ''] ?? a.kind} · {a.entry_count ?? 0} mouvement
                          {(a.entry_count ?? 0) > 1 ? 's' : ''}
                        </span>
                      </span>
                      <Figure
                        value={fmt(a.balance, meta.decimals)}
                        size="md"
                        tone={(a.balance ?? 0) < 0 ? 'negative' : undefined}
                      />
                      <ChevronRight className={cn('h-4 w-4 shrink-0', DFG.faint)} aria-hidden />
                    </button>
                  ))
                )}
              </Panel>
            );
          })}
        </section>
      )}

      <p className={cn(DT.label, DFG.faint, 'mt-4')}>
        <Badge tone="info">Rappel</Badge>{' '}
        Le coût moyen pondéré est recalculé à chaque achat ; le taux de revient XAF/CNY publié dans{' '}
        <Link to={ANALYSE_ROUTE} className={cn(DACCENT.text, 'font-bold underline underline-offset-2', DFOCUS)}>
          Analyse
        </Link>{' '}
        en découle directement.
      </p>
    </Workspace>
  );
}
