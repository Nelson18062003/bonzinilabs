/**
 * Dépôts — the validation queue.
 *
 * Rebuilt as a Workbench: the list owns the viewport, the record opens in a
 * docked inspector, and nothing about the operator's position in the queue is
 * lost when they open, act on and close a deposit.
 *
 * The toolbar is deliberately seven controls wide — search, the five status
 * buckets, and one `FilterPopover`. The audit measured eighteen here, of which
 * twelve were the Méthode and Période axes spelled out as chips: axes an
 * operator touches once a day, sitting permanently at the same visual weight as
 * the queue view they use every minute. Folding them into the popover is a
 * hierarchy fix, not a capability cut — every option survives.
 *
 * Three honesty rules this screen enforces:
 *  · a failed query renders an **error** state, never "aucun dépôt" — telling
 *    an operator the queue is empty when the backend is down is the worst
 *    possible lie in a money product;
 *  · search and the Méthode axis only cover the pages already fetched, and both
 *    say so instead of letting the operator believe they filtered the whole
 *    history (status and période *do* go to the server);
 *  · a bucket holding zero deposits renders "0", never a blank — a blank is how
 *    "the counters failed to load" looks, and the two must not be confusable.
 *    `countFor` returns `null` for unknown and `0` for known-empty, which is
 *    exactly the distinction `Chip`'s `count` prop is documented to draw.
 *
 * Data layer is unchanged and still shared with MobileDepositsScreenV2
 * (`@/lib/depositsList`), so mobile and desktop can never disagree on what
 * "à traiter" means.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FileText, Paperclip, Plus, RefreshCw, Search } from 'lucide-react';
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
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Field, Figure, Input, Ref, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, MenuButton, type FilterAxis } from '@/desktop/ui/Popover';
import { SlaDot } from '@/desktop/ui/SlaDot';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** Method family glyph — the same colour key as the mobile list. */
function MethodGlyph({ family }: { family: string }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-black ring-1 ring-inset ring-black/10 dark:ring-white/25"
      style={{ background: f.bg, color: f.dark ? '#1a1028' : '#fff' }}
    >
      {f.letter}
    </span>
  );
}

/** Status buckets — server-side, and the one filter axis that stays visible. */
const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'pending_correction', l: 'À corriger' },
  { k: 'validated', l: 'Validés' },
  { k: 'rejected', l: 'Rejetés' },
];

/** Method families. `all` is the neutral value — the axis' default, not a filter. */
const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Toutes les méthodes' },
  { value: 'BANK', label: 'Banque' },
  { value: 'AGENCY_BONZINI', label: 'Agence Bonzini' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'MTN_MONEY', label: 'MTN Money' },
  { value: 'WAVE', label: 'Wave' },
];

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Toute la période' },
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'custom', label: 'Dates personnalisées…' },
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

  /** `null` = the counters have not answered yet (or failed) — not "zero". */
  const countFor = (k: FilterKey): number | null => {
    if (!stats) return null;
    switch (k) {
      case 'all': return stats.total;
      case 'to_process': return stats.to_process;
      case 'pending_correction': return stats.pending_correction;
      case 'validated': return stats.validated;
      case 'rejected': return stats.rejected;
      default: return 0;
    }
  };

  /* How many *loaded* rows each method family holds. The Méthode axis filters
     client-side, so this is the only count that can honestly be shown next to
     it — and showing it is what makes the axis' scope self-evident. */
  const loadedByFamily = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of loaded) {
      const f = getFamilyFromMethod(d.method);
      m[f] = (m[f] ?? 0) + 1;
    }
    return m;
  }, [loaded]);

  const hasFilters = statusFilter !== 'all' || familyFilter !== 'all' || periodPreset !== 'all' || !!debouncedSearch;
  const searching = !!debouncedSearch;
  const total = countFor('all');

  const resetFilters = () => {
    setStatusFilter('all');
    setFamilyFilter('all');
    setPeriodPreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSearch('');
  };

  /* A filter strip above an empty queue is eighteen dead targets. Show it only
     once there is something to narrow — or a filter to undo. `null` means the
     counters are still in flight, so the strip stays. */
  const showToolbar = hasFilters || total === null || total > 0;

  /* ── Filter axes (folded into one popover) ─────────────────────────── */

  const methodAxis: FilterAxis<string> = {
    id: 'method',
    // The scope caveat is in the axis label, not a tooltip: this axis narrows
    // the pages already fetched, while status and période go to the server.
    // `usePaginatedAdminDeposits` filters method with `eq`, and a family maps to
    // up to two DB methods, so it cannot carry this axis without an `in`.
    label: 'Méthode · dépôts chargés',
    value: familyFilter,
    onChange: setFamilyFilter,
    neutral: 'all',
    options: METHOD_OPTIONS.map((o) => {
      const n = o.value === 'all' ? loaded.length : loadedByFamily[o.value] ?? 0;
      return {
        value: o.value,
        label: o.label,
        meta: n,
        // Nothing loaded matches → selecting it can only yield an empty list.
        // Never disable the value currently in force, or it cannot be undone.
        disabled: o.value !== 'all' && loaded.length > 0 && n === 0 && familyFilter !== o.value,
      };
    }),
  };

  const periodAxis: FilterAxis<string> = {
    id: 'period',
    label: 'Période',
    value: periodPreset,
    onChange: (v) => setPeriodPreset(v as PeriodPreset),
    neutral: 'all',
    options: PERIOD_OPTIONS,
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
              <span className={cn('inline-flex shrink-0 items-center gap-1', DT.label, DFG.muted)} title={`${d.proof_count} justificatif(s)`}>
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
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
          <span className="flex items-center justify-end gap-2">
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
          // The queue totals used to be recited here *and* on the chips. They
          // belong on the chips, which is the control that acts on them. What is
          // left is the one thing with nowhere else to go: the fact that the
          // chips have no counts because the counters failed.
          subtitle={statsError ? 'Compteurs indisponibles' : undefined}
          actions={
            <>
              <MenuButton
                items={[
                  {
                    label: 'Actualiser',
                    icon: RefreshCw,
                    disabled: isFetching && !isFetchingNextPage,
                    hint: 'Actualisation en cours…',
                    onSelect: () => { refetch(); refetchStats(); },
                  },
                ]}
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
        showToolbar ? (
          <Toolbar>
            <SearchField
              aria-label="Rechercher dans les dépôts chargés"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
            />

            {STATUS_CHIPS.map((c) => {
              const n = countFor(c.k);
              return (
                <Chip
                  key={c.k}
                  active={statusFilter === c.k}
                  // `null` while the counters are in flight, a real `0` once
                  // they answer — `Chip` renders the two differently on purpose.
                  count={n}
                  // Empty bucket → nothing to open. Never disable the bucket
                  // currently in force, or the operator is trapped inside it.
                  disabled={n === 0 && statusFilter !== c.k}
                  onClick={() => setStatusFilter(c.k)}
                >
                  {c.l}
                </Chip>
              );
            })}

            <FilterPopover
              axes={[methodAxis, periodAxis]}
              onClear={resetFilters}
              // Search and the status chips narrow the list without touching
              // these axes, so without this the popover's reset was unreachable
              // in exactly the states an operator most wants one. Raw `search`,
              // not the debounced value: the action must appear on the first
              // keystroke rather than a beat later.
              clearable={!!search || statusFilter !== 'all'}
              extra={
                periodPreset === 'custom' ? (
                  <div className="space-y-2">
                    <Field label="Du">
                      <Input type="date" aria-label="Date de début" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    </Field>
                    <Field label="Au">
                      <Input type="date" aria-label="Date de fin" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                    </Field>
                  </div>
                ) : undefined
              }
            />
          </Toolbar>
        ) : undefined
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
