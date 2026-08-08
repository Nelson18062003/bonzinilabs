/**
 * Paiements — the execution queue (règlements fournisseurs vers la Chine).
 *
 * Same Workbench shape as Dépôts, which is the point: an operator who has
 * learned one queue has learned all of them. Payment-specific affordances are
 * the batch entry point, the RMB column and the "réglés aujourd'hui" pulse in
 * the subtitle.
 *
 * Density pass (the console's worst offender: 26 controls on one screen):
 *  · The head keeps three elements — `Nouveau paiement` (primary), `Paiement
 *    groupé`, and a `…` menu holding the export and the refresh. The two
 *    widest labels were the two least-used actions.
 *  · Sorting moved onto the table header, where the Clients screen already
 *    puts it. One gesture, one mental model: the trailing `Segment` and the
 *    column headers were two ways to do the same thing.
 *  · Méthode and Période collapsed into a single `FilterPopover`, so the
 *    toolbar carries the search, the five status buckets and one trigger.
 *
 * Filters and status buckets come from `@/lib/paymentsList`, shared with the
 * mobile screen.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Download, Layers, Paperclip, Plus, RefreshCw, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, TO_PROCESS_STATUSES, type PaymentStatus } from '@/types/payment';
import { METHOD_FILTERS, logoMethod, type FilterKey } from '@/lib/paymentsList';
import { getPeriodDates, type PeriodPreset } from '@/lib/depositsList';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { formatRelativeDate, formatCurrencyRMB } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { paymentStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobilePaymentDetail } from '@/mobile/screens/payments';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, Input, Ref, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, MenuButton, type FilterAxis, type MenuItem } from '@/desktop/ui/Popover';
import { SlaDot } from '@/desktop/ui/SlaDot';
import { DataTable, type Column, type SortState } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** Same presets as the deposits queue — one period vocabulary for both. */
const PERIOD_OPTIONS: { k: PeriodPreset; l: string }[] = [
  { k: 'all', l: 'Toutes périodes' },
  { k: 'today', l: "Aujourd'hui" },
  { k: 'yesterday', l: 'Hier' },
  { k: 'week', l: 'Cette semaine' },
  { k: 'month', l: 'Ce mois-ci' },
  { k: 'custom', l: 'Dates personnalisées…' },
];

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'processing', l: 'En cours' },
  { k: 'completed', l: 'Terminés' },
  { k: 'rejected', l: 'Rejetés' },
];

/**
 * The sort the queue opens on. Column key + direction *is* the sort state now:
 * `created_at`/desc = plus récent, `created_at`/asc = plus ancien,
 * `amount_rmb`/desc = montant décroissant, `amount_rmb`/asc = montant croissant.
 */
const DEFAULT_SORT: SortState = { key: 'created_at', dir: 'desc' };

export function DesktopPaymentsScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const { hasPermission } = useAdminAuth();

  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { data: stats, isError: statsError, refetch: refetchStats } = usePaymentStats();

  const { dateFrom, dateTo } = useMemo(
    () => (periodPreset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : getPeriodDates(periodPreset)),
    [periodPreset, customFrom, customTo],
  );

  const filters = useMemo<PaymentFilters>(() => {
    const p: PaymentFilters = {
      sortField: sort.key === 'amount_rmb' ? 'amount_rmb' : 'created_at',
      sortAscending: sort.dir === 'asc',
    };
    if (statusFilter === 'to_process') p.statuses = TO_PROCESS_STATUSES;
    else if (statusFilter !== 'all') p.status = statusFilter as PaymentStatus;
    if (methodFilter !== 'all') p.method = methodFilter;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    return p;
  }, [statusFilter, methodFilter, sort, dateFrom, dateTo]);


  const { data, isLoading, isError, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaginatedAdminPayments(filters);
  const loadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const loaded = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const rows = useMemo(() => {
    if (!debouncedSearch) return loaded;
    const q = debouncedSearch.toLowerCase();
    return loaded.filter((p) => {
      const name = `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.toLowerCase();
      return name.includes(q) || p.reference?.toLowerCase().includes(q) || p.profiles?.phone?.includes(q);
    });
  }, [loaded, debouncedSearch]);

  const countFor = (k: FilterKey): number => {
    switch (k) {
      case 'all': return stats?.total ?? 0;
      case 'to_process': return stats?.toProcess ?? 0;
      case 'processing': return stats?.inProgress ?? 0;
      case 'completed': return stats?.completed ?? 0;
      case 'rejected': return stats?.rejected ?? 0;
      default: return 0;
    }
  };

  /* Counts only mean something once the stats query has answered: before that
     every bucket reads 0, and disabling five chips on a number nobody has
     confirmed yet is worse than showing them enabled. */
  const countsKnown = !!stats;

  const hasFilters =
    statusFilter !== 'all' || methodFilter !== 'all' || periodPreset !== 'all' || !!debouncedSearch;
  const searching = !!debouncedSearch;

  const resetFilters = () => {
    setStatusFilter('all');
    setMethodFilter('all');
    setPeriodPreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSort(DEFAULT_SORT);
    setSearch('');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count) toast.success(`Export de ${count} paiement${count > 1 ? 's' : ''} téléchargé`);
      else toast.info('Aucun paiement en cours à exporter');
    } catch (error) {
      console.error('Export des paiements en cours:', error);
      toast.error("L'export a échoué");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'reference', header: 'Référence', width: '150px', cell: (p) => <Ref>{p.reference}</Ref> },
    {
      key: 'client',
      header: 'Client',
      cell: (p) => {
        const name = p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'Client inconnu';
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className={cn('truncate font-semibold', DFG.strong)}>{name}</span>
            {p.proof_count ? (
              <span className={cn('inline-flex shrink-0 items-center gap-1', DT.label, DFG.muted)} title={`${p.proof_count} justificatif(s)`}>
                <Paperclip className="h-3 w-3" aria-hidden />
                {p.proof_count}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'amount_rmb',
      header: 'Montant',
      align: 'right',
      width: '130px',
      sortable: true,
      cell: (p) => <Figure value={formatCurrencyRMB(p.amount_rmb)} />,
    },
    {
      key: 'method',
      header: 'Méthode',
      width: '140px',
      cell: (p) => (
        <span className="flex items-center gap-2">
          {/* 24, not 22: the Cash tile renders its ¥ mark at `size * 0.5`, so
              22 put an 11px glyph on screen — below the console's 12px floor
              and off its type scale. 24 lands the mark exactly on 12. */}
          <PaymentMethodLogo method={logoMethod(p.method)} size={24} />
          <span className={cn('truncate', DFG.muted)}>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Créé',
      width: '120px',
      sortable: true,
      cell: (p) => <span className={DFG.muted}>{formatRelativeDate(p.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '160px',
      cell: (p) => {
        const sla = getPaymentSlaLevel(p.created_at, p.status);
        return (
          <span className="flex items-center justify-end gap-1">
            {sla && <SlaDot level={sla} />}
            <Badge tone={paymentStatusTone(p.status)}>{PAYMENT_STATUS_LABELS[p.status] || p.status}</Badge>
          </span>
        );
      },
    },
  ];

  const todaySettled = stats?.today_completed ?? 0;
  const total = countFor('all');
  const queued = countFor('to_process');

  /* The export ignores the visible filters on purpose — it always ships the
     work in flight — so its empty state is the only honest way to say "there
     is nothing in flight". Keep the reason attached to the item. */
  const nothingToExport = queued === 0 && (stats?.inProgress ?? 0) === 0;

  const menuItems: MenuItem[] = [
    {
      label: 'Actualiser',
      icon: RefreshCw,
      onSelect: () => { refetch(); refetchStats(); },
      disabled: isFetching && !isFetchingNextPage,
      hint: 'Chargement déjà en cours…',
    },
    ...(hasPermission('canViewPayments')
      ? [{
          label: 'Export des paiements en cours',
          icon: Download,
          onSelect: () => { void handleExport(); },
          disabled: nothingToExport || exporting,
          hint: nothingToExport
            ? "Aucun paiement en cours à exporter — l'export porte sur la file en cours, indépendamment des filtres affichés."
            : 'Export en cours…',
        } satisfies MenuItem]
      : []),
  ];

  const filterAxes: FilterAxis<string>[] = [
    {
      id: 'method',
      label: 'Méthode',
      value: methodFilter,
      neutral: 'all',
      onChange: setMethodFilter,
      options: METHOD_FILTERS.map((m) => ({ value: m.key, label: m.label })),
    },
    {
      id: 'period',
      label: 'Période',
      value: periodPreset,
      neutral: 'all',
      onChange: (v) => setPeriodPreset(v as PeriodPreset),
      options: PERIOD_OPTIONS.map((p) => ({ value: p.k, label: p.l })),
    },
  ];

  /* Nothing to filter and nothing filtered: the strip would only be noise
     above an empty state. Wait for the counts before deciding, so the toolbar
     does not appear a beat after the screen. */
  const showToolbar = !countsKnown || total > 0 || hasFilters;

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('payments', { defaultValue: 'Paiements' })}
          subtitle={
            statsError
              ? 'Compteurs indisponibles'
              : todaySettled > 0
                ? `${todaySettled} réglé${todaySettled > 1 ? 's' : ''} aujourd'hui (${formatCurrencyRMB(stats?.today_amount_rmb ?? 0)})`
                : undefined
          }
          actions={
            <>
              <MenuButton items={menuItems} />
              {hasPermission('canProcessPayments') && (
                <>
                  <Button
                    icon={Layers}
                    disabled={queued === 0}
                    title={queued === 0 ? 'Aucun paiement à exécuter dans la file' : undefined}
                    onClick={() => navigate('/m/payments/batch/new')}
                  >
                    Paiement groupé
                  </Button>
                  <Button variant="primary" icon={Plus} onClick={() => navigate('/m/payments/new')}>
                    Nouveau paiement
                  </Button>
                </>
              )}
            </>
          }
        />
      }
      toolbar={
        showToolbar ? (
          <Toolbar>
            <SearchField
              aria-label="Rechercher dans les paiements chargés"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
            />

            {STATUS_CHIPS.map((c) => {
              const n = countFor(c.k);
              const active = statusFilter === c.k;
              return (
                <Chip
                  key={c.k}
                  active={active}
                  // `null` while the counters are in flight, the real number
                  // once they land — the two are different facts (see `Chip`).
                  count={countsKnown ? n : null}
                  // Never disable the *active* bucket: a disabled chip is
                  // unclickable, so doing so would strand the operator in a
                  // filter they cannot leave through the chips.
                  disabled={countsKnown && n === 0 && !active}
                  onClick={() => setStatusFilter(c.k)}
                >
                  {c.l}
                </Chip>
              );
            })}

            <FilterPopover
              axes={filterAxes}
              onClear={resetFilters}
              extra={
                periodPreset === 'custom' ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className={cn(DT.label, DFG.muted, 'mb-1 block')}>Du</span>
                      <Input
                        type="date"
                        aria-label="Date de début"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className={cn(DT.label, DFG.muted, 'mb-1 block')}>Au</span>
                      <Input
                        type="date"
                        aria-label="Date de fin"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </label>
                  </div>
                ) : undefined
              }
            />
          </Toolbar>
        ) : undefined
      }
      inspector={paymentId ? <MobilePaymentDetail /> : null}
      onCloseInspector={() => navigate('/m/payments')}
    >
      <DataTable
        label="Liste des paiements"
        rows={rows}
        columns={columns}
        getRowId={(p) => p.id}
        activeId={paymentId ?? null}
        onRowClick={(p) => navigate(`/m/payments/${p.id}`)}
        sort={sort}
        onSortChange={setSort}
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les paiements"
              hint="La requête a échoué — la file n'est pas vide, elle n'a pas pu être lue."
              action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
            />
          ) : searching ? (
            <EmptyState
              icon={Search}
              title="Aucun résultat parmi les paiements chargés"
              hint={`La recherche ne porte que sur les ${loaded.length} paiements déjà chargés. Filtrez par statut ou par période pour chercher plus loin.`}
            />
          ) : (
            <EmptyState
              icon={Send}
              title="Aucun paiement trouvé"
              hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : 'Les règlements fournisseurs apparaîtront ici.'}
            />
          )
        }
        footer={
          searching ? (
            <p className={cn(DT.label, DFG.muted, 'text-center')}>
              {rows.length} résultat{rows.length > 1 ? 's' : ''} sur {loaded.length} paiement{loaded.length > 1 ? 's' : ''} déjà chargé
              {loaded.length > 1 ? 's' : ''} — la recherche ne remonte pas les paiements plus anciens.
            </p>
          ) : (
            <InfiniteScrollTrigger onLoadMore={loadMore} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
          )
        }
      />
    </Workbench>
  );
}
