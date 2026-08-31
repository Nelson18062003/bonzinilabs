/**
 * Trésorerie — vue « Opérations » (archétype A + B, docs/admin-redesign/07 §3.2).
 *
 * Remplace la grille de cartes en 2 colonnes par une vraie table : colonnes
 * comparables, triables, montants alignés à droite en tabular-nums, pagination.
 * Le taux effectif de chaque opération devient une COLONNE — c'est le chiffre
 * qu'on vient comparer (« quel achat m'a coûté le plus cher ? »), il ne peut
 * pas rester caché dans un détail.
 *
 * Les opérations annulées restent visibles, barrées : une écriture annulée
 * fait partie de l'histoire comptable.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowDownToLine, ArrowUpFromLine, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Chip,
  DropChip,
  SearchField,
  Th,
  Td,
  PaginationBar,
  Holder,
  ScreenLoader,
  ScreenError,
  StatusPill,
} from '@/desktop/designKit';
import { useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { normalizeText } from '@/lib/clientSearch';
import { fmtAmount, fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryOperationPanel } from './TreasuryOperationPanel';

type Bucket = 'all' | 'purchase' | 'sale' | 'voided';
type SortKey = 'date' | 'usdt' | 'rate';
type Period = '7d' | '30d' | '90d' | '365d';

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '3 mois' },
  { value: '365d', label: '1 an' },
];

const PAGE_SIZE = 25;

function rangeOf(period: Period): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - Number(period.replace('d', '')));
  return { from, to };
}

/** Contre-valeur de l'opération dans sa devise « autre que USDT ». */
function counterValue(op: OperationRow): { amount: number; currency: 'XAF' | 'CNY' } {
  return op.kind === 'purchase'
    ? { amount: Number(op.xaf_amount), currency: 'XAF' }
    : { amount: Number(op.cny_amount), currency: 'CNY' };
}

export function TreasuryOperationsWorkbench({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState<Period>('30d');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const range = useMemo(() => rangeOf(period), [period]);
  const { data, isLoading, isError } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());

  const all = data ?? [];
  const counts = useMemo(
    () => ({
      all: all.length,
      purchase: all.filter((o) => o.kind === 'purchase').length,
      sale: all.filter((o) => o.kind === 'sale').length,
      voided: all.filter((o) => !!o.voided_at).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const tokens = normalizeText(search).split(' ').filter(Boolean);
    const inBucket = (op: OperationRow) => {
      if (bucket === 'all') return true;
      if (bucket === 'voided') return !!op.voided_at;
      return op.kind === bucket;
    };
    const filtered = all.filter((op) => {
      if (!inBucket(op)) return false;
      if (tokens.length === 0) return true;
      const cp = op.kind === 'purchase' ? op.supplier : op.buyer;
      const hay = normalizeText(
        `${cp?.display_name ?? ''} ${cp?.wechat_id ?? ''} ${cp?.phone ?? ''} ${op.external_ref ?? ''} ${op.notes ?? ''}`,
      );
      return tokens.every((t) => hay.includes(t));
    });

    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort === 'usdt') return (Number(a.usdt_amount) - Number(b.usdt_amount)) * dir;
      if (sort === 'rate') return (Number(a.implicit_rate ?? 0) - Number(b.implicit_rate ?? 0)) * dir;
      return (a.occurred_at ?? '').localeCompare(b.occurred_at ?? '') * dir;
    });
  }, [all, bucket, search, sort, asc]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = rows.find((o) => o.id === selectedId) ?? null;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(false);
    }
    setPage(1);
  };
  const sortedOf = (key: SortKey) => (sort === key ? (asc ? 'asc' : 'desc') : null);

  return (
    <div className={cn('grid min-h-0 items-start gap-4', selected ? 'xl:grid-cols-[minmax(0,1fr)_minmax(560px,42%)]' : 'grid-cols-1')}>
      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <CardHeader
          title="Opérations"
          meta={`${rows.length} opération${rows.length > 1 ? 's' : ''} · tri ${sort === 'date' ? 'par date' : sort === 'usdt' ? 'par volume' : 'par taux'} ${asc ? '↑' : '↓'}`}
        />

        {/* Filtres — une seule ligne, contrôles 36px (règle §1.5-1) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
          <Chip label="Tout" count={counts.all} active={bucket === 'all'} onClick={() => { setBucket('all'); setPage(1); }} />
          <Chip label="Achats" count={counts.purchase} active={bucket === 'purchase'} onClick={() => { setBucket('purchase'); setPage(1); }} />
          <Chip label="Ventes" count={counts.sale} active={bucket === 'sale'} onClick={() => { setBucket('sale'); setPage(1); }} />
          <Chip label="Annulées" count={counts.voided} active={bucket === 'voided'} onClick={() => { setBucket('voided'); setPage(1); }} />
          <SearchField
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Contrepartie, référence, note…"
            className="ml-auto w-[260px]"
          />
          <DropChip label="Période" value={period} options={PERIODS} onChange={(v) => { setPeriod(v); setPage(1); }} />
        </div>

        {isLoading ? (
          <ScreenLoader />
        ) : isError ? (
          <ScreenError title="Erreur de chargement" description="Impossible de charger les opérations." />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={Inbox} size="lg" />
            <p className={cn('mt-3 text-[13px]', TEXT.muted)}>
              {search || bucket !== 'all' ? 'Aucune opération pour ce filtre.' : 'Aucune opération sur cette période.'}
            </p>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead className={cn('sticky top-0 z-10', SURFACE.inset)}>
                  <tr>
                    <Th first sortable sorted={sortedOf('date')} onSort={() => toggleSort('date')}>Date</Th>
                    <Th>Type</Th>
                    <Th>Contrepartie</Th>
                    <Th align="right" sortable sorted={sortedOf('usdt')} onSort={() => toggleSort('usdt')}>USDT</Th>
                    <Th align="right">Contre-valeur</Th>
                    <Th align="right" sortable sorted={sortedOf('rate')} onSort={() => toggleSort('rate')}>Taux</Th>
                    <Th last>Compte</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((op) => {
                    const isPurchase = op.kind === 'purchase';
                    const cv = counterValue(op);
                    const cp = isPurchase ? op.supplier : op.buyer;
                    const voided = !!op.voided_at;
                    const account = isPurchase ? op.xaf_account?.label : op.cny_account?.label;
                    return (
                      <tr
                        key={`${op.kind}-${op.id}`}
                        onClick={() => setSelectedId(op.id === selectedId ? null : op.id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          op.id === selectedId ? 'bg-[#EDEAFA]/60 dark:bg-white/[0.05]' : 'hover:bg-[#F6F5FB] dark:hover:bg-white/[0.03]',
                          voided && 'opacity-60',
                        )}
                      >
                        <Td first>
                          <div className={cn('text-[12.5px] font-semibold', TEXT.strong)}>
                            {op.occurred_at ? format(parseISO(op.occurred_at), 'dd MMM yyyy', { locale: fr }) : '—'}
                          </div>
                          <div className={cn('text-[10.5px] tabular-nums', TEXT.muted)}>
                            {op.occurred_at ? format(parseISO(op.occurred_at), 'HH:mm') : ''}
                          </div>
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold',
                              isPurchase
                                ? 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]'
                                : 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]',
                            )}
                          >
                            {isPurchase ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                            {isPurchase ? 'Achat' : 'Vente'}
                          </span>
                        </Td>
                        <Td>
                          <div className={cn('max-w-[190px] truncate text-[13px] font-semibold', voided && 'line-through', TEXT.strong)}>
                            {cp?.display_name ?? '—'}
                          </div>
                          {voided && <StatusPill tone="danger" label="Annulée" className="mt-0.5" />}
                        </Td>
                        <Td align="right" className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>
                          {fmtAmount(Number(op.usdt_amount), 'USDT')}
                        </Td>
                        <Td align="right" className={cn('text-[13px] tabular-nums', TEXT.body)}>
                          {fmtAmount(cv.amount, cv.currency)}
                          <span className={cn('ml-1 text-[10.5px]', TEXT.muted)}>{cv.currency}</span>
                        </Td>
                        <Td align="right" className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>
                          {fmtNum(Number(op.implicit_rate), isPurchase ? RATE_DECIMALS.xafPerUsdt : RATE_DECIMALS.cnyPerUsdt)}
                          <div className={cn('text-[10px] font-normal', TEXT.muted)}>{isPurchase ? 'XAF/USDT' : 'CNY/USDT'}</div>
                        </Td>
                        <Td last className={cn('max-w-[150px] truncate text-[12px]', TEXT.muted)}>
                          {account ?? (isPurchase ? 'Plusieurs' : 'Aucun')}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <PaginationBar
                page={safePage}
                pages={pages}
                rangeLabel={`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)}`}
                total={String(rows.length)}
                onPage={setPage}
              />
            )}
          </>
        )}
      </Card>

      {selected && (
        <TreasuryOperationPanel
          key={`${selected.kind}-${selected.id}`}
          op={selected}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
