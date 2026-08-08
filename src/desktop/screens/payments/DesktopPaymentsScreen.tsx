/**
 * Paiements — the execution queue (règlements fournisseurs vers la Chine).
 *
 * Same Workbench shape as Dépôts, which is the point: an operator who has
 * learned one queue has learned all of them. Payment-specific affordances are
 * the batch entry point, the RMB column and the "réglés aujourd'hui" pulse in
 * the subtitle.
 *
 * Filters and status buckets come from `@/lib/paymentsList`, shared with the
 * mobile screen.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Download, Layers, Paperclip, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, TO_PROCESS_STATUSES, type PaymentStatus } from '@/types/payment';
import { METHOD_FILTERS, SORT_OPTIONS, logoMethod, type FilterKey } from '@/lib/paymentsList';
import { getPeriodDates, type PeriodPreset } from '@/lib/depositsList';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { formatRelativeDate, formatCurrencyRMB } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { paymentStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobilePaymentDetail } from '@/mobile/screens/payments';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, IconButton, Input, Ref, Segment } from '@/desktop/ui/primitives';
import { SlaDot } from '@/desktop/ui/SlaDot';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { FilterGroup, ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** Same presets as the deposits queue — one period vocabulary for both. */
const PERIOD_CHIPS: { k: PeriodPreset; l: string }[] = [
  { k: 'all', l: 'Tout' },
  { k: 'today', l: 'Auj.' },
  { k: 'yesterday', l: 'Hier' },
  { k: 'week', l: 'Semaine' },
  { k: 'month', l: 'Mois' },
  { k: 'custom', l: 'Période…' },
];

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'processing', l: 'En cours' },
  { k: 'completed', l: 'Terminés' },
  { k: 'rejected', l: 'Rejetés' },
];

export function DesktopPaymentsScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const { hasPermission } = useAdminAuth();

  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
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
    const sort = SORT_OPTIONS.find((s) => s.key === sortKey) ?? SORT_OPTIONS[0];
    const p: PaymentFilters = { sortField: sort.field, sortAscending: sort.ascending };
    if (statusFilter === 'to_process') p.statuses = TO_PROCESS_STATUSES;
    else if (statusFilter !== 'all') p.status = statusFilter as PaymentStatus;
    if (methodFilter !== 'all') p.method = methodFilter;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    return p;
  }, [statusFilter, methodFilter, sortKey, dateFrom, dateTo]);


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

  const hasFilters =
    statusFilter !== 'all' || methodFilter !== 'all' || periodPreset !== 'all' || sortKey !== 'newest' || !!debouncedSearch;
  const searching = !!debouncedSearch;

  const resetFilters = () => {
    setStatusFilter('all');
    setMethodFilter('all');
    setPeriodPreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSortKey('newest');
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
              <span className={cn('inline-flex shrink-0 items-center gap-0.5', DT.tiny, DFG.muted)} title={`${p.proof_count} justificatif(s)`}>
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
      cell: (p) => <Figure value={formatCurrencyRMB(p.amount_rmb)} />,
    },
    {
      key: 'method',
      header: 'Méthode',
      width: '140px',
      cell: (p) => (
        <span className="flex items-center gap-2">
          <PaymentMethodLogo method={logoMethod(p.method)} size={22} />
          <span className={cn('truncate', DFG.muted)}>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Créé',
      width: '120px',
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
          <span className="flex items-center justify-end gap-1.5">
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

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('payments', { defaultValue: 'Paiements' })}
          subtitle={
            statsError
              ? 'Compteurs indisponibles'
              : `${total} paiement${total > 1 ? 's' : ''} · ${queued} à exécuter` +
                (todaySettled > 0
                  ? ` · ${todaySettled} réglé${todaySettled > 1 ? 's' : ''} aujourd'hui (${formatCurrencyRMB(stats?.today_amount_rmb ?? 0)})`
                  : '')
          }
          actions={
            <>
              <IconButton
                icon={RefreshCw}
                label="Actualiser"
                loading={isFetching && !isFetchingNextPage}
                onClick={() => { refetch(); refetchStats(); }}
              />
              {hasPermission('canViewPayments') && (
                <Button
                  icon={Download}
                  loading={exporting}
                  disabled={queued === 0 && (stats?.inProgress ?? 0) === 0}
                  onClick={handleExport}
                  title="Exporte les paiements en cours, indépendamment des filtres affichés"
                >
                  Export des paiements en cours
                </Button>
              )}
              {hasPermission('canProcessPayments') && (
                <>
                  <Button icon={Layers} onClick={() => navigate('/m/payments/batch/new')}>
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
        <Toolbar
          trailing={
            <>
              <Segment
                value={sortKey}
                onChange={setSortKey}
                options={SORT_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
              />
              {hasFilters ? (
                <Button size="sm" variant="ghost" icon={X} onClick={resetFilters}>
                  Réinitialiser
                </Button>
              ) : null}
            </>
          }
        >
          <div className="relative mr-1 w-64">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.muted)} />
            <Input
              type="search"
              aria-label="Rechercher dans les paiements chargés"
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
            {METHOD_FILTERS.map((m) => (
              <Chip key={m.key} active={methodFilter === m.key} onClick={() => setMethodFilter(m.key)}>
                {m.label}
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
