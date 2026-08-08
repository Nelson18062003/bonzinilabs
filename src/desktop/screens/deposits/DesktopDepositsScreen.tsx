/**
 * Dépôts — the validation queue.
 *
 * Rebuilt as a Workbench: the list owns the viewport, the record opens in a
 * docked inspector, and nothing about the operator's position in the queue is
 * lost when they open, act on and close a deposit. Filters collapse into one
 * strip instead of three stacked rows, and the status chips carry their own
 * counts — so the queue state and the way to filter it are a single control
 * rather than a KPI row duplicating the chips underneath it.
 *
 * Two honesty rules the first pass got wrong and this one enforces:
 *  · a failed query renders an **error** state, never "aucun dépôt" — telling
 *    an operator the queue is empty when the backend is down is the worst
 *    possible lie in a money product;
 *  · search only covers the pages already fetched, and the screen says so
 *    instead of letting the operator believe they searched the whole history.
 *
 * Data layer is unchanged and still shared with MobileDepositsScreenV2
 * (`@/lib/depositsList`), so mobile and desktop can never disagree on what
 * "à traiter" means.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FileText, Paperclip, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatRelativeDate, formatXAF } from '@/lib/formatters';
import { getDepositSlaLevel } from '@/lib/depositTimeline';
import {
  FAMILIES_CONF,
  getFamilyFromMethod,
  FAMILY_TO_METHODS,
  TO_PROCESS_STATUSES,
  getPeriodDates,
  type FilterKey,
  type PeriodPreset,
} from '@/lib/depositsList';
import { depositStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileDepositDetailV2 } from '@/mobile/screens/deposits';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, IconButton, Input, Ref } from '@/desktop/ui/primitives';
import { SlaDot } from '@/desktop/ui/SlaDot';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { FilterGroup, ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** Method family glyph — the same colour key as the mobile list. */
function MethodGlyph({ family }: { family: string }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black ring-1 ring-inset ring-black/10 dark:ring-white/25"
      style={{ background: f.bg, color: f.dark ? '#1a1028' : '#fff' }}
    >
      {f.letter}
    </span>
  );
}

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'pending_correction', l: 'À corriger' },
  { k: 'validated', l: 'Validés' },
  { k: 'rejected', l: 'Rejetés' },
];

const METHOD_CHIPS = [
  { k: 'all', l: 'Toutes' },
  { k: 'BANK', l: 'Banque' },
  { k: 'AGENCY_BONZINI', l: 'Agence' },
  { k: 'ORANGE_MONEY', l: 'Orange' },
  { k: 'MTN_MONEY', l: 'MTN' },
  { k: 'WAVE', l: 'Wave' },
];

const PERIOD_CHIPS: { k: PeriodPreset; l: string }[] = [
  { k: 'all', l: 'Tout' },
  { k: 'today', l: "Auj." },
  { k: 'yesterday', l: 'Hier' },
  { k: 'week', l: 'Semaine' },
  { k: 'month', l: 'Mois' },
  { k: 'custom', l: 'Période…' },
];

export function DesktopDepositsScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission } = useAdminAuth();

  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data: stats, isError: statsError, refetch: refetchStats } = useDepositStats();

  const { dateFrom, dateTo } = useMemo(
    () => (periodPreset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : getPeriodDates(periodPreset)),
    [periodPreset, customFrom, customTo],
  );

  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const p: DepositFilters = {};
    if (statusFilter === 'to_process') p.statuses = TO_PROCESS_STATUSES as string[];
    else if (statusFilter !== 'all') p.status = statusFilter;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    p.sortField = 'created_at';
    p.sortAscending = false;
    return p.status || p.statuses || p.dateFrom || p.dateTo ? p : undefined;
  }, [statusFilter, dateFrom, dateTo]);

  const { data, isLoading, isError, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaginatedAdminDeposits(filterParams);
  const loadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const loaded = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const rows = useMemo(() => {
    let list = loaded;
    if (familyFilter !== 'all') {
      const methods = FAMILY_TO_METHODS[familyFilter] || [];
      list = list.filter((d) => methods.includes(d.method));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((d) => {
        const name = `${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.toLowerCase();
        return name.includes(q) || d.reference?.toLowerCase().includes(q) || d.profiles?.phone?.includes(q);
      });
    }
    return list;
  }, [loaded, familyFilter, debouncedSearch]);

  const countFor = (k: FilterKey): number => {
    switch (k) {
      case 'all': return stats?.total ?? 0;
      case 'to_process': return stats?.to_process ?? 0;
      case 'pending_correction': return stats?.pending_correction ?? 0;
      case 'validated': return stats?.validated ?? 0;
      case 'rejected': return stats?.rejected ?? 0;
      default: return 0;
    }
  };

  const hasFilters = statusFilter !== 'all' || familyFilter !== 'all' || periodPreset !== 'all' || !!debouncedSearch;
  const searching = !!debouncedSearch;
  const total = countFor('all');
  const pending = countFor('to_process');

  const resetFilters = () => {
    setStatusFilter('all');
    setFamilyFilter('all');
    setPeriodPreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSearch('');
  };

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'reference',
      header: 'Référence',
      width: '150px',
      cell: (d) => <Ref>{d.reference}</Ref>,
    },
    {
      key: 'client',
      header: 'Client',
      cell: (d) => {
        const name = d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Client inconnu';
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className={cn('truncate font-semibold', DFG.strong)}>{name}</span>
            {d.proof_count ? (
              <span className={cn('inline-flex shrink-0 items-center gap-0.5', DT.label, DFG.muted)} title={`${d.proof_count} justificatif(s)`}>
                <Paperclip className="h-3 w-3" aria-hidden />
                {d.proof_count}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      width: '150px',
      cell: (d) => <Figure value={formatXAF(d.amount_xaf)} unit="XAF" />,
    },
    {
      key: 'method',
      header: 'Méthode',
      width: '150px',
      hideBelow: 900,
      cell: (d) => (
        <span className="flex items-center gap-2">
          <MethodGlyph family={getFamilyFromMethod(d.method)} />
          <span className={cn('truncate', DFG.muted)}>{DEPOSIT_METHOD_LABELS_SHORT[d.method] || d.method}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Créé',
      width: '120px',
      hideBelow: 760,
      cell: (d) => <span className={DFG.muted}>{formatRelativeDate(d.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '160px',
      cell: (d) => {
        const sla = getDepositSlaLevel(d.created_at, d.status);
        return (
          <span className="flex items-center justify-end gap-1.5">
            {sla && <SlaDot level={sla} />}
            <Badge tone={depositStatusTone(d.status)}>{DEPOSIT_STATUS_LABELS[d.status] || d.status}</Badge>
          </span>
        );
      },
    },
  ];

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('deposits', { defaultValue: 'Dépôts' })}
          subtitle={
            statsError
              ? 'Compteurs indisponibles'
              : `${total} dépôt${total > 1 ? 's' : ''} · ${pending} en attente de validation`
          }
          actions={
            <>
              <IconButton
                icon={RefreshCw}
                label="Actualiser"
                loading={isFetching && !isFetchingNextPage}
                onClick={() => { refetch(); refetchStats(); }}
              />
              {hasPermission('canProcessDeposits') && (
                <Button variant="primary" icon={Plus} onClick={() => navigate('/m/deposits/new')}>
                  Nouveau dépôt
                </Button>
              )}
            </>
          }
        />
      }
      toolbar={
        <Toolbar
          trailing={
            hasFilters ? (
              <Button variant="ghost" icon={X} onClick={resetFilters}>
                Réinitialiser
              </Button>
            ) : undefined
          }
        >
          <div className="relative mr-1 w-64">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.muted)} />
            <Input
              type="search"
              aria-label="Rechercher dans les dépôts chargés"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8"
            />
          </div>

          {STATUS_CHIPS.map((c) => (
            <Chip key={c.k} active={statusFilter === c.k} count={countFor(c.k)} onClick={() => setStatusFilter(c.k)}>
              {c.l}
            </Chip>
          ))}

          <span className={cn('mx-1 h-4 w-px border-l', DS.line)} />

          <FilterGroup label="Méthode">
            {METHOD_CHIPS.map((m) => (
              <Chip key={m.k} active={familyFilter === m.k} onClick={() => setFamilyFilter(m.k)}>
                {m.l}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Période">
            {PERIOD_CHIPS.map((p) => (
              <Chip key={p.k} active={periodPreset === p.k} onClick={() => setPeriodPreset(p.k)}>
                {p.l}
              </Chip>
            ))}
          </FilterGroup>

          {periodPreset === 'custom' && (
            <span className="flex items-center gap-1.5">
              <Input type="date" aria-label="Date de début" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[140px]" />
              <span className={cn(DT.label, DFG.muted)} aria-hidden>→</span>
              <Input type="date" aria-label="Date de fin" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[140px]" />
            </span>
          )}
        </Toolbar>
      }
      inspector={depositId ? <MobileDepositDetailV2 /> : null}
      onCloseInspector={() => navigate('/m/deposits')}
    >
      <DataTable
        label="Liste des dépôts"
        rows={rows}
        columns={columns}
        getRowId={(d) => d.id}
        activeId={depositId ?? null}
        onRowClick={(d) => navigate(`/m/deposits/${d.id}`)}
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les dépôts"
              hint="La requête a échoué — la file n'est pas vide, elle n'a pas pu être lue."
              action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
            />
          ) : searching ? (
            <EmptyState
              icon={Search}
              title="Aucun résultat parmi les dépôts chargés"
              hint={`La recherche ne porte que sur les ${loaded.length} dépôts déjà chargés. Filtrez par statut ou par période pour chercher plus loin.`}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="Aucun dépôt trouvé"
              hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : 'Les dépôts déclarés apparaîtront ici.'}
            />
          )
        }
        footer={
          searching ? (
            <p className={cn(DT.label, DFG.muted, 'text-center')}>
              {rows.length} résultat{rows.length > 1 ? 's' : ''} sur {loaded.length} dépôt{loaded.length > 1 ? 's' : ''} déjà chargé
              {loaded.length > 1 ? 's' : ''} — la recherche ne remonte pas les dépôts plus anciens.
            </p>
          ) : (
            <InfiniteScrollTrigger onLoadMore={loadMore} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
          )
        }
      />
    </Workbench>
  );
}
