/**
 * Trésorerie — Opérations : la table des achats et ventes d'USDT, et la fiche
 * de l'opération ouverte à droite (maquette 2).
 *
 *   · le filtre Toutes / Achats / Ventes / Annulées est dans l'URL ;
 *   · une table d'achats parle en XAF / USDT, une table de ventes en
 *     CNY / USDT — l'ancienne mêlait les deux taux dans une colonne sans unité ;
 *   · les totaux du bandeau ne comptent JAMAIS une opération annulée ;
 *   · la fiche montre les écritures du grand livre : d'où vient l'argent,
 *     où il est allé.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft, ChevronRight, ChevronsUpDown, Ban, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import {
  useCounterparties,
  useOperationEntries,
  usePurchase,
  useSale,
  useTreasuryAccounts,
  useTreasuryOperations,
  type OperationRow,
} from '@/hooks/useTreasury';
import { BTN, PAGE_SIZE, TK } from './tstyle';
import { Card, Empty, ErrorState, IdTag, Loading, Money, Picker, Rate, RowButton, SearchInput, Segmented, SummaryBar, Td, Th } from './tkit';
import { useTreasuryBounds } from './treasuryPeriod';
import { useTreasuryActions } from './treasuryActions';
import { treasuryPaths, type OperationFilter, type OperationKind } from './treasuryNav';
import { fmtLongDate, fmtNum, fmtWhen, type TreasuryCurrency } from './treasuryFormat';
import { entryKindLabel } from './treasuryLabels';
import { matchesQuery, totalsOf, viewOperation, type OperationView } from './operationView';
import { KindBadge } from './KindBadge';

type SortKey = 'date' | 'usdt' | 'rate';

export function OperationsView({ filter, open }: { filter: OperationFilter; open: { kind: OperationKind; id: string } | null }) {
  const navigate = useNavigate();
  const { fromIso, toIso } = useTreasuryBounds();
  const ops = useTreasuryOperations(fromIso, toIso);
  const counterparties = useCounterparties(undefined, true);
  const accounts = useTreasuryAccounts();

  const [cpId, setCpId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'date', asc: false });
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [filter, cpId, accountId, q, fromIso, toIso]);
  // Le taux d'un achat (XAF) et celui d'une vente (CNY) ne se comparent pas.
  useEffect(() => {
    if ((filter === 'all' || filter === 'voided') && sort.key === 'rate') setSort({ key: 'date', asc: false });
  }, [filter, sort.key]);

  const rows = useMemo(() => (ops.data ?? []).map((op) => ({ op, v: viewOperation(op) })), [ops.data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      purchase: rows.filter((r) => r.v.kind === 'purchase').length,
      sale: rows.filter((r) => r.v.kind === 'sale').length,
      voided: rows.filter((r) => r.v.voided).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const out = rows.filter(({ op, v }) => {
      if (filter === 'voided' && !v.voided) return false;
      if ((filter === 'purchase' || filter === 'sale') && v.kind !== filter) return false;
      if (cpId && v.counterpartyId !== cpId) return false;
      if (accountId && !touchesAccount(op, accountId)) return false;
      return matchesQuery(v, q.trim());
    });
    const dir = sort.asc ? 1 : -1;
    return out.sort((a, b) => {
      if (sort.key === 'usdt') return (a.v.usdt - b.v.usdt) * dir;
      if (sort.key === 'rate') return ((a.v.rate ?? 0) - (b.v.rate ?? 0)) * dir;
      return a.v.at.localeCompare(b.v.at) * dir;
    });
  }, [rows, filter, cpId, accountId, q, sort]);

  const active = useMemo(() => shown.map((r) => r.v).filter((v) => !v.voided), [shown]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.v.id, r.op])), [rows]);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  // Une liste qui rétrécit (actualisation) ne laisse pas sur une page vide.
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = shown.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const cpType = filter === 'purchase' ? 'usdt_supplier' : filter === 'sale' ? 'cny_buyer' : null;
  const cpOptions = (counterparties.data ?? [])
    .filter((c) => !cpType || c.type === cpType)
    .map((c) => ({ value: c.id, label: c.display_name, tag: c.short_id ?? undefined, hint: c.is_active ? undefined : 'archivé' }));
  const accountOptions = (accounts.data ?? [])
    .filter((a) => a.currency !== 'USDT')
    .filter((a) => (filter === 'purchase' ? a.currency === 'XAF' : filter === 'sale' ? a.currency === 'CNY' : true))
    .map((a) => ({ value: a.id, label: a.label, hint: a.currency }));

  const setFilter = (f: OperationFilter) => navigate(treasuryPaths.operations(f), { replace: true });
  const openOp = (v: OperationView) => navigate(treasuryPaths.operation(v.kind, v.id, filter));
  const closeOp = () => navigate(treasuryPaths.operations(filter));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: false }));

  const summary = summaryItems(filter, active, counts.voided);
  const single = filter === 'purchase' || filter === 'sale';
  const filtered = !!(cpId || accountId || q);

  return (
    <div className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
          <div className="w-[230px]">
            <Picker
              value={cpId}
              onChange={setCpId}
              options={cpOptions}
              allLabel="tous"
              prefix={filter === 'purchase' ? 'Fournisseur :' : filter === 'sale' ? 'Acheteur :' : 'Contrepartie :'}
              searchable
              ariaLabel="Filtrer par contrepartie"
            />
          </div>
          <div className="w-[200px]">
            <Picker value={accountId} onChange={setAccountId} options={accountOptions} allLabel="tous" prefix="Compte :" ariaLabel="Filtrer par compte" />
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher…" className="w-[220px]" />
        </div>
      </div>

      <div className={cn('grid grid-cols-1 items-start gap-4', open && 'xl:grid-cols-[minmax(0,1fr)_400px]')}>
        <Card className="overflow-hidden">
          {ops.isLoading ? (
            <Loading rows={8} />
          ) : ops.isError ? (
            <ErrorState onRetry={() => void ops.refetch()} />
          ) : shown.length === 0 ? (
            <Empty icon={ArrowLeftRight} title={filtered ? 'Aucune opération ne correspond' : 'Aucune opération sur cette période'}
              action={filtered ? (
                <button type="button" className={BTN.soft} onClick={() => { setCpId(''); setAccountId(''); setQ(''); }}>
                  Effacer les filtres
                </button>
              ) : undefined}
            >
              {filtered ? 'Changez de filtre ou de période.' : 'Choisissez une autre période, ou enregistrez un achat ou une vente.'}
            </Empty>
          ) : (
            <>
              <SummaryBar items={summary} />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <SortTh label="Date" k="date" sort={sort} onSort={toggleSort} />
                      {!single && <Th>Type</Th>}
                      <Th>{filter === 'purchase' ? 'Fournisseur' : filter === 'sale' ? 'Acheteur' : 'Contrepartie'}</Th>
                      <Th>{filter === 'purchase' ? 'Payé depuis' : filter === 'sale' ? 'Encaissé sur' : 'Compte'}</Th>
                      <SortTh label="USDT" k="usdt" sort={sort} onSort={toggleSort} align="right" />
                      {single ? (
                        <SortTh label={filter === 'purchase' ? 'Taux XAF / USDT' : 'Taux CNY / USDT'} k="rate" sort={sort} onSort={toggleSort} align="right" />
                      ) : (
                        <Th align="right">Taux</Th>
                      )}
                      <Th align="right">{filter === 'purchase' ? 'XAF' : filter === 'sale' ? 'CNY' : 'Contre-valeur'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(({ v }) => (
                      <RowButton
                        key={`${v.kind}-${v.id}`}
                        selected={open?.id === v.id}
                        muted={v.voided}
                        onOpen={() => openOp(v)}
                        label={`Ouvrir ${v.kind === 'purchase' ? 'l’achat' : 'la vente'} du ${fmtWhen(v.at)}`}
                      >
                        <Td muted>{fmtWhen(v.at)}</Td>
                        {!single && (
                          <Td>
                            <KindBadge kind={v.kind} voided={v.voided} />
                          </Td>
                        )}
                        <Td className="max-w-[240px] truncate font-semibold">
                          {v.counterparty}
                          {single && v.voided && <span className="ml-2 rounded bg-muted px-1.5 text-[11.5px] font-semibold text-muted-foreground">Annulée</span>}
                        </Td>
                        <Td className="max-w-[200px] truncate" muted={v.accounts === '—'}>{v.accounts}</Td>
                        <Td align="right">
                          <span className={cn('font-bold', TK.num, v.voided && 'line-through')}>{fmtNum(v.usdt, 2)}</span>
                        </Td>
                        <Td align="right">
                          {single ? (
                            <span className={TK.num}>{fmtNum(v.rate, v.rateDecimals)}</span>
                          ) : (
                            <Rate value={v.rate} unit={v.rateUnit} decimals={v.rateDecimals} />
                          )}
                        </Td>
                        <Td align="right">
                          <Money value={v.counter} cur={v.counterCur} size="sm" showCur={!single} className={v.voided ? 'line-through' : ''} />
                        </Td>
                      </RowButton>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-muted-foreground">
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

        {open && <OperationPanel open={open} loaded={byId.get(open.id) ?? null} onClose={closeOp} />}
      </div>
    </div>
  );
}

function touchesAccount(op: OperationRow, accountId: string): boolean {
  if (op.kind === 'sale') return op.cny_account?.id === accountId || op.cny_account_id === accountId;
  if ((op.debit_accounts ?? []).some((d) => d.id === accountId)) return true;
  return op.xaf_account_id === accountId;
}

function summaryItems(filter: OperationFilter, active: OperationView[], voided: number) {
  const buys = totalsOf(active.filter((o) => o.kind === 'purchase'));
  const sells = totalsOf(active.filter((o) => o.kind === 'sale'));
  if (filter === 'purchase')
    return [
      { label: 'Achats', value: buys.count },
      { label: 'USDT achetés', value: fmtNum(buys.usdt, 2) },
      { label: 'XAF payés', value: fmtNum(buys.counter, 0) },
      { label: 'Taux moyen', value: buys.avgRate ? `${fmtNum(buys.avgRate, 2)} XAF / USDT` : '—' },
    ];
  if (filter === 'sale')
    return [
      { label: 'Ventes', value: sells.count },
      { label: 'USDT vendus', value: fmtNum(sells.usdt, 2) },
      { label: 'CNY reçus', value: fmtNum(sells.counter, 2) },
      { label: 'Taux moyen', value: sells.avgRate ? `${fmtNum(sells.avgRate, 4)} CNY / USDT` : '—' },
    ];
  if (filter === 'voided') return [{ label: 'Opérations annulées', value: voided }, { label: 'Elles ne comptent dans aucun total', value: '' }];
  return [
    { label: 'Achats', value: `${buys.count} · ${fmtNum(buys.usdt, 2)} USDT` },
    { label: 'Ventes', value: `${sells.count} · ${fmtNum(sells.usdt, 2)} USDT` },
    { label: 'Variation du stock', value: `${buys.usdt - sells.usdt >= 0 ? '+' : '−'} ${fmtNum(Math.abs(buys.usdt - sells.usdt), 2)} USDT` },
    ...(voided > 0 ? [{ label: 'Annulées (hors totaux)', value: voided }] : []),
  ];
}

function SortTh({ label, k, sort, onSort, align = 'left' }: { label: string; k: SortKey; sort: { key: SortKey; asc: boolean }; onSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const on = sort.key === k;
  return (
    <Th align={align}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 rounded hover:text-foreground', TK.focus, on && 'text-foreground')}
        aria-label={`Trier par ${label}`}
      >
        {label}
        {on ? <span aria-hidden>{sort.asc ? '↑' : '↓'}</span> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </Th>
  );
}

/* ── La fiche d'une opération ─────────────────────────────────────────── */

function OperationPanel({ open, loaded, onClose }: { open: { kind: OperationKind; id: string }; loaded: OperationRow | null; onClose: () => void }) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  // Ouverte par un lien vers une opération HORS de la période affichée : on
  // la lit seule plutôt que de dire « introuvable ».
  const purchase = usePurchase(!loaded && open.kind === 'purchase' ? open.id : undefined);
  const sale = useSale(!loaded && open.kind === 'sale' ? open.id : undefined);
  const entries = useOperationEntries(open.id);

  const fetched = open.kind === 'purchase' ? purchase : sale;
  const op: OperationRow | null =
    loaded ?? (fetched.data ? ({ ...fetched.data, kind: open.kind } as OperationRow) : null);

  if (!op) {
    return (
      <Card as="aside" className="xl:sticky xl:top-4">
        <div className="flex justify-end p-3">
          <button type="button" className={BTN.icon} onClick={onClose} aria-label="Fermer la fiche">
            <X className="h-4 w-4" />
          </button>
        </div>
        {fetched.isLoading ? (
          <Loading rows={5} />
        ) : fetched.isError ? (
          <ErrorState onRetry={() => void fetched.refetch()} />
        ) : (
          <Empty title="Opération introuvable">Elle a peut-être été supprimée, ou le lien est incomplet.</Empty>
        )}
      </Card>
    );
  }

  const v = viewOperation(op);
  const purchaseSide = v.kind === 'purchase';
  const voidReason = op.void_reason;
  const original = (entries.data ?? []).filter((e) => e.entry_kind !== 'void');
  const accountsTouched = original.filter((e) => e.currency !== 'USDT');

  return (
    <Card as="aside" className="overflow-hidden xl:sticky xl:top-4">
      <div className="border-b border-border px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <KindBadge kind={v.kind} voided={v.voided} />
          <button type="button" className={BTN.icon} onClick={onClose} aria-label="Fermer la fiche">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">
          <Money value={v.usdt} cur="USDT" size="xl" className={v.voided ? 'text-muted-foreground line-through' : ''} />
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {fmtLongDate(v.at)}
          {v.ref && <> · réf. {v.ref}</>}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {v.voided && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <div className="font-semibold">Opération annulée {op.voided_at ? `· ${fmtWhen(op.voided_at)}` : ''}</div>
            <div className="mt-0.5">{voidReason || 'Sans motif'}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className={cn(TK.inset, 'p-3.5')}>
            <div className="text-[12.5px] text-muted-foreground">{purchaseSide ? 'Montant payé' : 'Montant reçu'}</div>
            <div className="mt-1">
              <Money value={v.counter} cur={v.counterCur} size="lg" />
            </div>
          </div>
          <div className={cn(TK.inset, 'p-3.5')}>
            <div className="text-[12.5px] text-muted-foreground">Taux</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className={cn('text-[20px] font-bold tracking-tight', TK.num)}>{fmtNum(v.rate, v.rateDecimals)}</span>
              <span className="whitespace-nowrap text-[11.5px] font-semibold text-muted-foreground">{v.rateUnit}</span>
            </div>
          </div>
        </div>

        <PanelBlock title={purchaseSide ? 'Fournisseur' : 'Acheteur'}>
          {v.counterpartyId ? (
            <button
              type="button"
              onClick={() => navigate(treasuryPaths.counterparty(v.counterpartyId!))}
              className={cn('flex w-full items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-left hover:bg-accent', TK.focus)}
            >
              {v.counterpartyShort && <IdTag>{v.counterpartyShort}</IdTag>}
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {(purchaseSide ? (op.kind === 'purchase' ? op.supplier : null) : op.kind === 'sale' ? op.buyer : null)?.display_name ?? v.counterparty}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="text-[13.5px] text-muted-foreground">—</div>
          )}
        </PanelBlock>

        <PanelBlock title={purchaseSide ? 'Payé depuis' : 'Encaissé sur'}>
          {entries.isLoading ? (
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
          ) : accountsTouched.length === 0 ? (
            <div className="text-[13.5px] text-muted-foreground">{purchaseSide ? '—' : 'Aucun compte CNY indiqué'}</div>
          ) : (
            <ul className="divide-y divide-border/70 rounded-lg border border-border">
              {accountsTouched.map((e) => (
                <li key={e.id}>
                  <AccountLine label={e.account?.label ?? '—'} onOpen={e.account ? () => navigate(treasuryPaths.account(e.account!.id)) : undefined}>
                    <Money value={Math.abs(Number(e.amount))} cur={e.currency as TreasuryCurrency} size="sm" />
                  </AccountLine>
                </li>
              ))}
            </ul>
          )}
        </PanelBlock>

        <PanelBlock title="Écritures au grand livre">
          {entries.isLoading ? (
            <Loading rows={2} className="p-0" />
          ) : entries.isError ? (
            <ErrorState onRetry={() => void entries.refetch()} className="py-4" />
          ) : (entries.data ?? []).length === 0 ? (
            <div className="text-[13.5px] text-muted-foreground">Aucune écriture.</div>
          ) : (
            <ul className="divide-y divide-border/70 rounded-lg border border-border">
              {(entries.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.account?.label ?? '—'}</div>
                    <div className="text-[12px] text-muted-foreground">{entryKindLabel(e.entry_kind)}</div>
                  </div>
                  <Money value={Number(e.amount)} cur={e.currency as TreasuryCurrency} size="sm" sign tone />
                </li>
              ))}
            </ul>
          )}
        </PanelBlock>

        {v.notes && (
          <PanelBlock title="Note">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{v.notes}</p>
          </PanelBlock>
        )}

        {actions.canVoid && !v.voided && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              className={cn(BTN.danger, 'w-full')}
              onClick={() => actions.voidOperation({ kind: v.kind, id: v.id, label: `${purchaseSide ? 'Achat' : 'Vente'} de ${fmtNum(v.usdt, 2)} USDT · ${v.counterparty}` })}
            >
              <Ban className="h-4 w-4" /> Annuler cette opération
            </button>
            <p className="mt-2 text-center text-[12px] text-muted-foreground">Contre-passe les écritures. L’opération reste visible, barrée.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className={cn(TK.label, 'mb-2')}>{title}</h4>
      {children}
    </section>
  );
}

function AccountLine({ label, onOpen, children }: { label: string; onOpen?: () => void; children: ReactNode }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{label}</span>
      {children}
    </>
  );
  if (!onOpen) return <div className="flex items-center gap-3 px-3.5 py-3">{inner}</div>;
  return (
    <button type="button" onClick={onOpen} className={cn('flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-accent', TK.focus)}>
      {inner}
    </button>
  );
}
