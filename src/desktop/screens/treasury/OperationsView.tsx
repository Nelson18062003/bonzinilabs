/**
 * Trésorerie — Opérations : tous les achats et ventes d'USDT de la période.
 *
 * Volontairement sobre : un filtre (Toutes / Achats / Ventes / Annulées), une
 * recherche, la période ; cinq colonnes. Un clic ouvre la fiche — le reçu à
 * copier. Les totaux ne comptent jamais une opération annulée.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { useTreasuryOperations } from '@/hooks/useTreasury';
import { BTN, PAGE_SIZE, TK } from './tstyle';
import { Card, Empty, ErrorState, Loading, RowButton, SearchInput, Segmented, SummaryBar, Td, Th } from './tkit';
import { useTreasuryBounds } from './treasuryPeriod';
import { treasuryPaths, type OperationFilter, type OperationKind } from './treasuryNav';
import { fmtNum, fmtWhen } from './treasuryFormat';
import { matchesQuery, totalsOf, viewOperation, type OperationView } from './operationView';
import { OpIcon } from './KindBadge';
import { OperationSheet } from './OperationSheet';

export function OperationsView({ filter, open }: { filter: OperationFilter; open: { kind: OperationKind; id: string } | null }) {
  const navigate = useNavigate();
  const { fromIso, toIso } = useTreasuryBounds();
  const ops = useTreasuryOperations(fromIso, toIso);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [filter, q, fromIso, toIso]);

  const rows = useMemo(() => (ops.data ?? []).map((op) => ({ op, v: viewOperation(op) })), [ops.data]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.v.id, r.op])), [rows]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      purchase: rows.filter((r) => r.v.kind === 'purchase').length,
      sale: rows.filter((r) => r.v.kind === 'sale').length,
      voided: rows.filter((r) => r.v.voided).length,
    }),
    [rows],
  );
  const shown = useMemo(
    () =>
      rows
        .map((r) => r.v)
        .filter((v) => (filter === 'voided' ? v.voided : filter === 'all' ? true : v.kind === filter))
        .filter((v) => matchesQuery(v, q.trim())),
    [rows, filter, q],
  );
  const active = useMemo(() => shown.filter((v) => !v.voided), [shown]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = shown.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const setFilter = (f: OperationFilter) => navigate(treasuryPaths.operations(f), { replace: true });
  const openOp = (v: OperationView) => navigate(treasuryPaths.operation(v.kind, v.id, filter));
  const closeOp = () => navigate(treasuryPaths.operations(filter));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Type d’opération"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Toutes', count: counts.all },
            { value: 'purchase', label: 'Achats', count: counts.purchase },
            { value: 'sale', label: 'Ventes', count: counts.sale },
            { value: 'voided', label: 'Annulées', count: counts.voided },
          ]}
        />
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Nom, compte, référence…" className="w-[260px]" />
          <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {ops.isLoading ? (
          <Loading rows={8} />
        ) : ops.isError ? (
          <ErrorState onRetry={() => void ops.refetch()} />
        ) : shown.length === 0 ? (
          <Empty
            icon={ArrowLeftRight}
            title={q ? 'Aucune opération ne correspond' : 'Aucune opération sur cette période'}
            action={q ? <button type="button" className={BTN.soft} onClick={() => setQ('')}>Effacer la recherche</button> : undefined}
          >
            {q ? 'Essayez un autre nom ou une autre période.' : 'Choisissez une autre période, ou enregistrez un achat ou une vente.'}
          </Empty>
        ) : (
          <>
            <div className="pt-5">
              <SummaryBar items={summary(filter, active, counts.voided)} />
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Opération</Th>
                  <Th>Date</Th>
                  <Th align="right">USDT</Th>
                  <Th align="right">Taux</Th>
                  <Th align="right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v) => (
                  <RowButton key={`${v.kind}-${v.id}`} muted={v.voided} onOpen={() => openOp(v)} label={`Ouvrir ${v.kind === 'purchase' ? 'l’achat' : 'la vente'} — ${v.counterparty}`}>
                    <Td className="py-3">
                      <span className="flex items-center gap-3">
                        <OpIcon kind={v.kind} voided={v.voided} />
                        <span className="min-w-0">
                          <span className="block max-w-[300px] truncate font-semibold">{v.counterpartyName}</span>
                          <span className="block text-[12.5px] text-muted-foreground">
                            {v.voided ? 'Annulée' : v.kind === 'purchase' ? 'Achat' : 'Vente'}
                            {v.accounts !== '—' && ` · ${v.accounts}`}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td muted>{fmtWhen(v.at)}</Td>
                    <Td align="right">
                      <span className={cn('font-semibold', TK.num, v.voided && 'line-through')}>{fmtNum(v.usdt, 2)}</span>
                    </Td>
                    <Td align="right" muted className={TK.num}>
                      {fmtNum(v.rate, v.rateDecimals)}
                    </Td>
                    <Td align="right">
                      <span className={cn(TK.num, v.voided && 'line-through')}>
                        {fmtNum(v.counter, v.counterCur === 'XAF' ? 0 : 2)} <span className="text-[12px] font-semibold text-muted-foreground">{v.counterCur}</span>
                      </span>
                    </Td>
                  </RowButton>
                ))}
              </tbody>
            </table>
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3 text-[13px] text-muted-foreground">
                <span className={TK.num}>
                  {safePage * PAGE_SIZE + 1}–{Math.min(shown.length, (safePage + 1) * PAGE_SIZE)} sur {shown.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className={BTN.icon} disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Page précédente">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" className={BTN.icon} disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Page suivante">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {open && <OperationSheet open={open} loaded={byId.get(open.id) ?? null} onClose={closeOp} />}
    </div>
  );
}

function summary(filter: OperationFilter, active: OperationView[], voided: number) {
  const buys = totalsOf(active.filter((o) => o.kind === 'purchase'));
  const sells = totalsOf(active.filter((o) => o.kind === 'sale'));
  if (filter === 'purchase')
    return [
      { label: 'Achetés', value: `${fmtNum(buys.usdt, 2)} USDT` },
      { label: 'Payés', value: `${fmtNum(buys.counter, 0)} XAF` },
      { label: 'Taux moyen', value: buys.avgRate ? `${fmtNum(buys.avgRate, 2)} XAF / USDT` : '—' },
    ];
  if (filter === 'sale')
    return [
      { label: 'Vendus', value: `${fmtNum(sells.usdt, 2)} USDT` },
      { label: 'Reçus', value: `${fmtNum(sells.counter, 2)} CNY` },
      { label: 'Taux moyen', value: sells.avgRate ? `${fmtNum(sells.avgRate, 4)} CNY / USDT` : '—' },
    ];
  if (filter === 'voided') return [{ label: 'Annulées', value: `${voided} — elles ne comptent dans aucun total` }];
  return [
    { label: 'Achetés', value: `${fmtNum(buys.usdt, 2)} USDT` },
    { label: 'Vendus', value: `${fmtNum(sells.usdt, 2)} USDT` },
  ];
}
