/**
 * Trésorerie — Vue d'ensemble : ce que j'ai, ce qui s'est passé.
 *
 * L'ancien module n'avait pas de vue d'ensemble (prévue par le doc 08, jamais
 * faite) : on arrivait sur une table d'opérations. Ici, d'un coup d'œil :
 * les soldes par devise, le stock d'USDT et son coût moyen, les dernières
 * opérations, et les raccourcis. Chaque bloc mène à son détail.
 *
 * La vue d'ensemble ne dépend PAS de la période choisie ailleurs : « ce mois »
 * et « les 90 derniers jours » y sont fixes, pour qu'elle dise toujours la
 * même chose en arrivant.
 */
import { useMemo, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ChevronRight, ClipboardCheck, FileImage, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildRangeFromPreset, toSupabaseBounds } from '@/lib/analytics/dateRange';
import { useTreasuryAccountBalances, useTreasuryOperations, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { Card, CardHead, Empty, ErrorState, Loading, Money, MoreLink, RowButton, Td, Th } from './tkit';
import { TK } from './tstyle';
import { useTreasuryActions } from './treasuryActions';
import { treasuryPaths } from './treasuryNav';
import { fmtNum, fmtWhen, type TreasuryCurrency } from './treasuryFormat';
import { plural } from './treasuryLabels';
import { totalsOf, viewOperation } from './operationView';
import { KindBadge } from './KindBadge';

function useBounds(preset: 'this_month' | 'last_90_days') {
  return useMemo(() => toSupabaseBounds(buildRangeFromPreset(preset)), [preset]);
}

export function OverviewView() {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const wac = useUsdtWac();
  const month = useBounds('this_month');
  const recent = useBounds('last_90_days');
  const monthOps = useTreasuryOperations(month.fromISO, month.toISO);
  const recentOps = useTreasuryOperations(recent.fromISO, recent.toISO);

  const monthViews = (monthOps.data ?? []).map(viewOperation).filter((o) => !o.voided);
  const bought = totalsOf(monthViews.filter((o) => o.kind === 'purchase'));
  const sold = totalsOf(monthViews.filter((o) => o.kind === 'sale'));

  const accountsOf = (cur: TreasuryCurrency) => (balances.data ?? []).filter((b) => b.currency === cur && b.is_active !== false);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BalanceCard title="Comptes XAF" cur="XAF" rows={accountsOf('XAF')} query={balances} onOpen={(id) => navigate(treasuryPaths.account(id))} onAll={() => navigate(treasuryPaths.accounts)} />

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <div className={TK.label}>Stock USDT</div>
          </div>
          {stock.isLoading ? (
            <div className="mt-3 h-9 w-40 animate-pulse rounded-md bg-muted" />
          ) : stock.isError ? (
            <div className="mt-3 text-[13.5px] text-red-700">Stock indisponible</div>
          ) : (
            <div className="mt-2">
              <Money value={stock.data} cur="USDT" size="xl" decimals={0} />
            </div>
          )}
          <div className="text-[13px] text-muted-foreground">dans le pool USDT</div>
          <div className={cn(TK.inset, 'mt-4 p-3.5')}>
            <div className="text-[12.5px] text-muted-foreground">Coût moyen d’un USDT</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={cn('text-[20px] font-bold', TK.num)}>{wac.data ? fmtNum(wac.data, 2) : '—'}</span>
              {!!wac.data && <span className="text-[13px] font-semibold text-muted-foreground">XAF</span>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-muted-foreground">Achetés ce mois</div>
              <div className={cn('font-semibold', TK.num)}>{monthOps.isLoading ? '…' : `${fmtNum(bought.usdt, 0)} USDT`}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Vendus ce mois</div>
              <div className={cn('font-semibold', TK.num)}>{monthOps.isLoading ? '…' : `${fmtNum(sold.usdt, 0)} USDT`}</div>
            </div>
          </div>
          <div className="mt-auto pt-4">
            <MoreLink onClick={() => navigate(treasuryPaths.operations())}>Voir les opérations</MoreLink>
          </div>
        </Card>

        <BalanceCard title="Comptes CNY" cur="CNY" rows={accountsOf('CNY')} query={balances} onOpen={(id) => navigate(treasuryPaths.account(id))} onAll={() => navigate(treasuryPaths.accounts)} />
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHead
            title="Dernières opérations"
            meta="Les 90 derniers jours"
            action={<MoreLink onClick={() => navigate(treasuryPaths.operations())}>Toutes les opérations</MoreLink>}
          />
          {recentOps.isLoading ? (
            <Loading rows={6} />
          ) : recentOps.isError ? (
            <ErrorState onRetry={() => void recentOps.refetch()} />
          ) : (recentOps.data ?? []).length === 0 ? (
            <Empty icon={ArrowLeftRight} title="Aucune opération sur les 90 derniers jours">
              Enregistrez un achat ou une vente d’USDT pour commencer.
            </Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Contrepartie</Th>
                  <Th align="right">USDT</Th>
                  <Th align="right">Contre-valeur</Th>
                </tr>
              </thead>
              <tbody>
                {(recentOps.data ?? []).slice(0, 8).map(viewOperation).map((o) => (
                  <RowButton key={o.id} muted={o.voided} onOpen={() => navigate(treasuryPaths.operation(o.kind, o.id))} label={`Ouvrir ${o.kind === 'purchase' ? 'l’achat' : 'la vente'}`}>
                    <Td muted>{fmtWhen(o.at)}</Td>
                    <Td>
                      <KindBadge kind={o.kind} voided={o.voided} />
                    </Td>
                    <Td className="max-w-[260px] truncate font-medium">{o.counterparty}</Td>
                    <Td align="right">
                      <span className={cn('font-semibold', TK.num, o.voided && 'line-through')}>{fmtNum(o.usdt, 2)}</span>
                    </Td>
                    <Td align="right">
                      <Money value={o.counter} cur={o.counterCur} size="sm" className={o.voided ? 'line-through' : ''} />
                    </Td>
                  </RowButton>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-4">
          {actions.canManage && (
            <Card className="p-5">
              <h3 className="text-[15px] font-bold">Raccourcis</h3>
              <div className="mt-3 space-y-2">
                <Shortcut icon={ArrowDownToLine} label="Enregistrer un achat d’USDT" onClick={actions.newPurchase} />
                <Shortcut icon={ArrowUpFromLine} label="Enregistrer une vente d’USDT" onClick={actions.newSale} />
                <Shortcut icon={SlidersHorizontal} label="Ajuster le solde d’un compte" onClick={() => actions.adjust()} />
                <Shortcut icon={ClipboardCheck} label="Faire un inventaire" onClick={() => actions.inventory()} />
                <Shortcut icon={FileImage} label="Visuel des soldes (image)" onClick={() => navigate(treasuryPaths.visual)} />
              </div>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="text-[15px] font-bold">Ce mois-ci</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MonthStat label="Achats" count={bought.count} loading={monthOps.isLoading} />
              <MonthStat label="Ventes" count={sold.count} loading={monthOps.isLoading} />
            </div>
            {!monthOps.isLoading && bought.count > 0 && (
              <div className="mt-3 text-[13px] text-muted-foreground">
                Taux d’achat moyen :{' '}
                <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(bought.avgRate, 2)} XAF / USDT</span>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function BalanceCard({
  title,
  cur,
  rows,
  query,
  onOpen,
  onAll,
}: {
  title: string;
  cur: TreasuryCurrency;
  rows: Array<{ id: string | null; label: string | null; balance: number | null; entry_count: number | null }>;
  query: { isLoading: boolean; isError: boolean; refetch: () => unknown };
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const total = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0);
  const moving = rows.filter((r) => (r.entry_count ?? 0) > 0).length;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <div className={TK.label}>{title}</div>
      </div>
      {query.isLoading ? (
        <Loading rows={4} className="px-0" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} className="py-6" />
      ) : (
        <>
          <div className="mt-2">
            <Money value={total} cur={cur} size="xl" />
          </div>
          <div className="text-[13px] text-muted-foreground">
            {plural(rows.length, 'compte')}
            {moving === 0 && rows.length > 0 ? ' · aucun mouvement' : ''}
          </div>
          <ul className="mt-4 divide-y divide-border/70 border-t border-border/70">
            {rows.map((r) => (
              <li key={r.id ?? r.label}>
                <button
                  type="button"
                  onClick={() => r.id && onOpen(r.id)}
                  className={cn('flex w-full items-center justify-between gap-3 py-2 text-left text-[13.5px] hover:underline', TK.focus)}
                >
                  <span className="truncate">{r.label}</span>
                  <Money value={Number(r.balance ?? 0)} cur={cur} size="sm" showCur={false} className={(r.entry_count ?? 0) === 0 ? 'text-muted-foreground' : ''} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-4">
            <MoreLink onClick={onAll}>Voir les comptes</MoreLink>
          </div>
        </>
      )}
    </Card>
  );
}

function Shortcut({ icon: Icon, label, onClick }: { icon: ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex h-11 w-full items-center gap-3 rounded-lg border border-border/70 px-3 text-left text-[14px] font-medium transition-colors hover:bg-accent', TK.focus)}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4" />
      </span>
      {label}
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function MonthStat({ label, count, loading }: { label: string; count: number; loading: boolean }) {
  return (
    <div className={cn(TK.inset, 'p-3')}>
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className={cn('text-[20px] font-bold', TK.num)}>{loading ? '…' : count}</div>
    </div>
  );
}
