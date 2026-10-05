/**
 * Trésorerie — Vue d'ensemble : trois chiffres et les dernières opérations.
 *
 * Rien de plus. Ce que j'ai en XAF, en USDT (et ce qu'il m'a coûté), en CNY ;
 * puis ce qui vient de se passer. Le détail est un clic plus loin.
 * Ne dépend pas de la période choisie ailleurs.
 */
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildRangeFromPreset, toSupabaseBounds } from '@/lib/analytics/dateRange';
import { useTreasuryAccountBalances, useTreasuryOperations, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { Card, CardHead, Empty, ErrorState, Loading, Money, MoreLink } from './tkit';
import { TK } from './tstyle';
import { treasuryPaths } from './treasuryNav';
import { fmtNum, fmtWhen, type TreasuryCurrency } from './treasuryFormat';
import { plural } from './treasuryLabels';
import { viewOperation } from './operationView';
import { OpIcon } from './KindBadge';

export function OverviewView() {
  const navigate = useNavigate();
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const wac = useUsdtWac();
  const recent = useMemo(() => toSupabaseBounds(buildRangeFromPreset('last_90_days')), []);
  const ops = useTreasuryOperations(recent.fromISO, recent.toISO);

  const total = (cur: TreasuryCurrency) => {
    const rows = (balances.data ?? []).filter((b) => b.currency === cur && b.is_active !== false);
    return { value: rows.reduce((s, r) => s + Number(r.balance ?? 0), 0), count: rows.length };
  };
  const xaf = total('XAF');
  const cny = total('CNY');

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Figure
          label="Comptes XAF"
          loading={balances.isLoading}
          error={balances.isError}
          onRetry={() => void balances.refetch()}
          value={<Money value={xaf.value} cur="XAF" size="xl" />}
          foot={<MoreLink onClick={() => navigate(treasuryPaths.accounts)}>{plural(xaf.count, 'compte')}</MoreLink>}
        />
        <Figure
          label="Stock USDT"
          loading={stock.isLoading}
          error={stock.isError}
          onRetry={() => void stock.refetch()}
          value={<Money value={stock.data} cur="USDT" size="xl" decimals={0} />}
          foot={
            <span className="text-[13.5px] text-muted-foreground">
              Coût moyen <span className={cn('font-semibold text-foreground', TK.num)}>{wac.data ? fmtNum(wac.data, 2) : '—'}</span> XAF
            </span>
          }
        />
        <Figure
          label="Comptes CNY"
          loading={balances.isLoading}
          error={balances.isError}
          onRetry={() => void balances.refetch()}
          value={<Money value={cny.value} cur="CNY" size="xl" />}
          foot={<MoreLink onClick={() => navigate(treasuryPaths.accounts)}>{plural(cny.count, 'compte')}</MoreLink>}
        />
      </section>

      <Card className="overflow-hidden">
        <CardHead title="Dernières opérations" action={<MoreLink onClick={() => navigate(treasuryPaths.operations())}>Tout voir</MoreLink>} />
        {ops.isLoading ? (
          <Loading rows={5} />
        ) : ops.isError ? (
          <ErrorState onRetry={() => void ops.refetch()} />
        ) : (ops.data ?? []).length === 0 ? (
          <Empty icon={ArrowLeftRight} title="Aucune opération récente">
            Enregistrez un achat ou une vente d’USDT pour commencer.
          </Empty>
        ) : (
          <ul className="px-3 pb-3">
            {(ops.data ?? []).slice(0, 7).map(viewOperation).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate(treasuryPaths.operation(o.kind, o.id))}
                  className={cn('flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50', TK.focus, o.voided && 'opacity-60')}
                >
                  <OpIcon kind={o.kind} voided={o.voided} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{o.counterpartyName}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {o.voided ? 'Annulée' : o.kind === 'purchase' ? 'Achat' : 'Vente'} · {fmtWhen(o.at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={cn('block text-[15px] font-semibold', TK.num, o.voided && 'line-through')}>
                      {o.kind === 'purchase' ? '+' : '−'} {fmtNum(o.usdt, 2)} <span className="text-[12px] text-muted-foreground">USDT</span>
                    </span>
                    <span className={cn('block text-[13px] text-muted-foreground', TK.num)}>
                      {fmtNum(o.counter, o.counterCur === 'XAF' ? 0 : 2)} {o.counterCur}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  foot,
  loading,
  error,
  onRetry,
}: {
  label: string;
  value: ReactNode;
  foot: ReactNode;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="flex min-h-[156px] flex-col justify-between p-6">
      <div className={TK.label}>{label}</div>
      {loading ? (
        <div className="my-3 h-9 w-48 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <button type="button" onClick={onRetry} className="my-3 text-left text-[14px] font-medium text-red-700 hover:underline dark:text-red-400">
          Indisponible — réessayer
        </button>
      ) : (
        <div className="my-3">{value}</div>
      )}
      <div>{foot}</div>
    </Card>
  );
}
