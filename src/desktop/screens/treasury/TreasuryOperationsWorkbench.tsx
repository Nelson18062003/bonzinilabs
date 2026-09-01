/**
 * Trésorerie — vue « Opérations » (docs/admin-redesign/07 §3.2), habillage
 * « salle des marchés ».
 *
 * Une vraie table : colonnes comparables, triables, chiffres en mono aligné à
 * droite, pagination. Le taux effectif de chaque opération est une COLONNE —
 * c'est le chiffre qu'on vient comparer (« quel achat m'a coûté le plus
 * cher ? »), il ne peut pas rester caché dans un détail.
 *
 * Les opérations annulées restent visibles, barrées : une écriture annulée
 * fait partie de l'histoire comptable.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tray as Inbox } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { normalizeText } from '@/lib/clientSearch';
import {
  M,
  T,
  NUM,
  MCard,
  MCardHeader,
  MChip,
  MDropdown,
  MSearch,
  MTh,
  MTd,
  MTable,
  MTableHead,
  MTableBody,
  MTableRow,
  MTypeTag,
  MTag,
  MPagination,
  MEmpty,
  MLoading,
} from './marketKit';
import { fmtAmount, fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryOperationPanel } from './TreasuryOperationPanel';

type Bucket = 'all' | 'purchase' | 'sale' | 'voided';
type SortKey = 'date' | 'usdt' | 'rate';
type Period = '7d' | '30d' | '90d' | '365d';

const PERIODS = [
  { value: '7d' as const, label: '7 jours' },
  { value: '30d' as const, label: '30 jours' },
  { value: '90d' as const, label: '3 mois' },
  { value: '365d' as const, label: '1 an' },
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
    <div className={cn('grid min-h-0 items-start gap-4', selected ? 'xl:grid-cols-[minmax(0,1fr)_minmax(540px,40%)]' : 'grid-cols-1')}>
      <MCard className="flex min-h-0 flex-col overflow-hidden">
        <MCardHeader
          title="Opérations"
          meta={`${rows.length} · tri ${sort === 'date' ? 'date' : sort === 'usdt' ? 'volume' : 'taux'} ${asc ? '↑' : '↓'}`}
        />

        {/* Filtres — une ligne, contrôles 26px */}
        <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5', M.border)}>
          <MChip label="Tout" count={counts.all} active={bucket === 'all'} onClick={() => { setBucket('all'); setPage(1); }} />
          <MChip label="Achats" count={counts.purchase} active={bucket === 'purchase'} onClick={() => { setBucket('purchase'); setPage(1); }} />
          <MChip label="Ventes" count={counts.sale} active={bucket === 'sale'} onClick={() => { setBucket('sale'); setPage(1); }} />
          <MChip label="Annulées" count={counts.voided} active={bucket === 'voided'} onClick={() => { setBucket('voided'); setPage(1); }} />
          <MSearch
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Rechercher…"
            className="ml-auto w-[210px]"
          />
          <MDropdown value={period} options={PERIODS} onChange={(v) => { setPeriod(v); setPage(1); }} />
        </div>

        {isLoading ? (
          <MLoading />
        ) : isError ? (
          <MEmpty icon={Inbox}>Impossible de charger les opérations.</MEmpty>
        ) : rows.length === 0 ? (
          <MEmpty icon={Inbox}>
            {search || bucket !== 'all' ? 'Aucune opération pour ce filtre.' : 'Aucune opération sur cette période.'}
          </MEmpty>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <MTable className="text-left">
                <MTableHead className={cn('sticky top-0 z-10', M.inset)}>
                  <MTableRow className="hover:bg-transparent">
                    <MTh sortable sorted={sortedOf('date')} onSort={() => toggleSort('date')}>Date</MTh>
                    <MTh>Type</MTh>
                    <MTh>Contrepartie</MTh>
                    <MTh align="right" sortable sorted={sortedOf('usdt')} onSort={() => toggleSort('usdt')}>USDT</MTh>
                    <MTh align="right">Contre-valeur</MTh>
                    <MTh align="right" sortable sorted={sortedOf('rate')} onSort={() => toggleSort('rate')}>Taux</MTh>
                    <MTh>Compte</MTh>
                  </MTableRow>
                </MTableHead>
                <MTableBody>
                  {pageRows.map((op) => {
                    const isPurchase = op.kind === 'purchase';
                    const cv = counterValue(op);
                    const cp = isPurchase ? op.supplier : op.buyer;
                    const voided = !!op.voided_at;
                    const account = isPurchase ? op.xaf_account?.label : op.cny_account?.label;
                    return (
                      <MTableRow
                        key={`${op.kind}-${op.id}`}
                        onClick={() => setSelectedId(op.id === selectedId ? null : op.id)}
                        data-state={op.id === selectedId ? 'selected' : undefined}
                        className={cn(
                          'cursor-pointer',
                          op.id === selectedId && 'shadow-[inset_2px_0_0_hsl(var(--primary))]',
                          voided && 'opacity-45',
                        )}
                      >
                        <MTd className="text-[12.5px]">
                          <span className={cn('font-medium', T.ink)}>
                            {op.occurred_at ? format(parseISO(op.occurred_at), 'dd MMM yyyy', { locale: fr }) : '—'}
                          </span>
                          <span className={cn('ml-1.5 text-[11px]', NUM, T.faint)}>
                            {op.occurred_at ? format(parseISO(op.occurred_at), 'HH:mm') : ''}
                          </span>
                        </MTd>
                        <MTd><MTypeTag kind={op.kind} /></MTd>
                        <MTd>
                          <span className={cn('block max-w-[190px] truncate text-[12.5px] font-semibold', voided && 'line-through', T.ink)}>
                            {cp?.display_name ?? '—'}
                          </span>
                          {voided && <MTag tone="danger">Annulée</MTag>}
                        </MTd>
                        <MTd align="right" className={cn('text-[12.5px] font-bold', NUM, T.ink)}>
                          {fmtAmount(Number(op.usdt_amount), 'USDT')}
                        </MTd>
                        <MTd align="right" className={cn('text-[12.5px]', NUM, T.body)}>
                          {fmtAmount(cv.amount, cv.currency)}
                          <span className={cn('ml-1 text-[10.5px]', T.faint)}>{cv.currency}</span>
                        </MTd>
                        <MTd align="right" className={cn('text-[12.5px] font-semibold', NUM, T.ink)}>
                          {fmtNum(Number(op.implicit_rate), isPurchase ? RATE_DECIMALS.xafPerUsdt : RATE_DECIMALS.cnyPerUsdt)}
                        </MTd>
                        <MTd className={cn('max-w-[150px] truncate text-[11.5px]', T.muted)}>
                          {account ?? (isPurchase ? 'Plusieurs' : 'Aucun')}
                        </MTd>
                      </MTableRow>
                    );
                  })}
                </MTableBody>
              </MTable>
            </div>
            {pages > 1 && (
              <MPagination
                page={safePage}
                pages={pages}
                rangeLabel={`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)}`}
                total={String(rows.length)}
                onPage={setPage}
              />
            )}
          </>
        )}
      </MCard>

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
