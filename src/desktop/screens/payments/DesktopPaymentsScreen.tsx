/**
 * Desktop admin — payments as a real data table.
 *
 * Same data layer as MobilePaymentsScreen (paginated hook, status buckets,
 * method/sort/period filters, debounced search, SLA, batch PDF export) — shown
 * as a wide table with a clickable stat strip and a toolbar.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, X, Paperclip, CreditCard, FileDown, Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, TO_PROCESS_STATUSES } from '@/types/payment';
import type { PaymentStatus } from '@/types/payment';
import { type FilterKey, METHOD_FILTERS, SORT_OPTIONS, logoMethod } from '@/lib/paymentsList';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { formatCurrencyRMB, formatRelativeDate } from '@/lib/formatters';
import { getPaymentSlaLevel, type SlaLevel } from '@/lib/paymentSla';
import { cn } from '@/lib/utils';
import { MobilePaymentDetail } from '@/mobile/screens/payments';
import {
  Inspector,
  DataTable,
  EMPTY_SELECTION,
  pruneSelection,
  type Column,
  type SelectionState,
} from '@/desktop/kit';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  type Tone,
  paymentStatusTone,
  StatusPill,
  Amount,
  Holder,
  TextInput,
  ScreenLoader,
  Card,
} from '@/mobile/designKit';

function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: 6, height: 6, background: color, animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined }}
      title={level === 'fresh' ? '< 4h' : level === 'aging' ? '4-12h' : '> 12h'}
    />
  );
}

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'processing', l: 'En cours' },
  { k: 'completed', l: 'Terminés' },
  { k: 'rejected', l: 'Rejetés' },
];

const STAT_TILES: { key: FilterKey; label: string; tone: Tone }[] = [
  { key: 'to_process', label: 'À traiter', tone: 'pending' },
  { key: 'processing', label: 'En cours', tone: 'info' },
  { key: 'completed', label: 'Terminés', tone: 'success' },
  { key: 'all', label: 'Total', tone: 'neutral' },
];

export function DesktopPaymentsScreen() {
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = usePaymentStats();

  const sortOption = SORT_OPTIONS.find((o) => o.key === sortKey) || SORT_OPTIONS[0];

  const filterParams = useMemo<PaymentFilters | undefined>(() => {
    const params: PaymentFilters = {};
    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES as string[];
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (methodFilter !== 'all') params.method = methodFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    params.sortField = sortOption.field;
    params.sortAscending = sortOption.ascending;
    const hasFilters = params.status || params.statuses || params.method || params.dateFrom || params.dateTo;
    const isDefaultSort = sortOption.key === 'newest';
    if (!hasFilters && isDefaultSort) return undefined;
    return params;
  }, [statusFilter, methodFilter, dateFrom, dateTo, sortOption]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedAdminPayments(filterParams);
  const handleLoadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const allPayments = useMemo(() => data?.pages.flatMap((page) => page.data) || [], [data]);
  const filteredPayments = useMemo(() => {
    if (!debouncedSearch) return allPayments;
    const search = debouncedSearch.toLowerCase();
    return allPayments.filter((payment) => {
      const clientName = `${payment.profiles?.first_name || ''} ${payment.profiles?.last_name || ''}`.toLowerCase();
      return (
        clientName.includes(search) ||
        payment.reference?.toLowerCase().includes(search) ||
        payment.profiles?.phone?.includes(search)
      );
    });
  }, [allPayments, debouncedSearch]);

  // A colleague may process a payment we had selected, or a filter change may
  // drop it: a bulk action must never fire against a row that is off screen.
  const visibleIds = useMemo(() => filteredPayments.map((p) => p.id), [filteredPayments]);
  useEffect(() => {
    setSelection((current) => pruneSelection(current, visibleIds));
  }, [visibleIds]);

  const columns = useMemo<Column<(typeof filteredPayments)[number]>[]>(() => [
    {
      key: 'reference',
      header: 'Référence',
      width: '11rem',
      render: (p) => (
        <span className={cn('rounded-lg px-2 py-1 font-mono text-[12px] font-bold', SURFACE.holder)}>
          {p.reference}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (p) => {
        const name = p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'Client inconnu';
        const proofCount = p.proof_count || 0;
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn('font-semibold', TEXT.strong)}>{name}</span>
            {proofCount > 0 && (
              <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                <Paperclip className="h-3 w-3" />
                {proofCount}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount_rmb',
      header: 'Montant',
      align: 'right',
      sortable: true,
      render: (p) => <Amount value={formatCurrencyRMB(p.amount_rmb)} size="md" />,
    },
    {
      key: 'method',
      header: 'Méthode',
      width: '11rem',
      render: (p) => (
        <div className="flex items-center gap-2">
          <PaymentMethodLogo method={logoMethod(p.method)} size={26} />
          <span className={TEXT.muted}>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Créé le',
      width: '9rem',
      sortable: true,
      render: (p) => <span className={TEXT.muted}>{formatRelativeDate(p.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '11rem',
      render: (p) => {
        const sla = getPaymentSlaLevel(p.created_at, p.status);
        return (
          <div className="flex items-center justify-end gap-1.5">
            {sla && <SlaDot level={sla} />}
            <StatusPill
              tone={paymentStatusTone(p.status)}
              label={PAYMENT_STATUS_LABELS[p.status as PaymentStatus] || p.status}
            />
          </div>
        );
      },
    },
  ], []);

  const counts = {
    toProcess: stats?.toProcess ?? 0,
    inProgress: stats?.inProgress ?? 0,
    completed: stats?.completed ?? 0,
    total: stats?.total ?? 0,
  };
  const countFor = (k: FilterKey): number | null => {
    switch (k) {
      case 'all': return counts.total;
      case 'to_process': return counts.toProcess;
      case 'processing': return counts.inProgress;
      case 'completed': return counts.completed;
      default: return null;
    }
  };

  const handleExportBatch = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count === 0) {
        toast.error('Aucun paiement en cours à exporter');
        return;
      }
      toast.success(`Export de ${count} paiement(s) téléchargé`);
    } catch (error) {
      console.error('Error exporting batch payments:', error);
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return (
    <Inspector
      detail={paymentId ? <MobilePaymentDetail /> : null}
      title={paymentId ? 'Fiche paiement' : undefined}
      onClose={() => navigate('/m/payments')}
    >
    <div className="space-y-6">
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Paiements</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {counts.total} paiement{counts.total > 1 ? 's' : ''} · {counts.toProcess} à traiter
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportBatch}
            disabled={isExporting}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold disabled:opacity-50', SOFT_PILL)}
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exporter (PDF)
          </button>
          <button
            onClick={() => navigate('/m/payments/batch/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}
          >
            <Layers className="h-4 w-4" /> Paiement groupé
          </button>
          <button
            onClick={() => navigate('/m/payments/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
          >
            <Plus className="h-4 w-4" /> Nouveau paiement
          </button>
        </div>
      </header>

      {/* Stat strip (clickable filters) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_TILES.map((tile) => {
          const active = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => setStatusFilter(active ? 'all' : tile.key)}
              className={cn(
                'rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                SURFACE.card,
                SURFACE.shadow,
                active && 'ring-2 ring-[#C9C2F0] dark:ring-[#4A4660]',
              )}
            >
              <p className={cn('text-[12px] font-medium', TEXT.muted)}>{tile.label}</p>
              <p className={cn('mt-1 text-[24px] font-extrabold leading-none tabular-nums', TEXT.strong)}>
                {countFor(tile.key) ?? 0}
              </p>
            </button>
          );
        })}
      </section>

      {/* Toolbar */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full max-w-sm">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder="Nom, téléphone ou référence…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 text-[14px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Effacer"
                className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((ch) => {
              const active = statusFilter === ch.k;
              const c = countFor(ch.k);
              return (
                <button
                  key={ch.k}
                  onClick={() => setStatusFilter(ch.k)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors',
                    active ? PRIMARY_PILL : SOFT_PILL,
                  )}
                >
                  {ch.l}
                  {c != null && c > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[9px] font-extrabold tabular-nums',
                        active ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#1B1A24]' : 'bg-black/[0.06] dark:bg-white/10',
                      )}
                    >
                      {c}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('mr-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Méthode</span>
            {METHOD_FILTERS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethodFilter(m.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  methodFilter === m.key ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('mr-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Tri</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  sortKey === opt.key ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Période</span>
            <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 text-[13px]" />
            <span className={cn('text-[13px]', TEXT.muted)}>→</span>
            <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 text-[13px]" />
          </div>
        </div>
      </section>

      {/* Selection bar — appears only when rows are marked. Phase 0 ships the
          selection primitive and the safe actions; the money actions (bulk
          validate / reject) land in Phase 2 behind a preview step. */}
      {selection.ids.size > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-[18px] px-5 py-3',
            SURFACE.card,
            SURFACE.shadow,
          )}
          style={{ boxShadow: 'inset 3px 0 0 0 #6B5BD2' }}
          role="status"
        >
          <span className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>
            {selection.ids.size} paiement{selection.ids.size > 1 ? 's' : ''} sélectionné
            {selection.ids.size > 1 ? 's' : ''}
          </span>
          <span className={cn('text-[12px]', TEXT.muted)}>
            X pour marquer · Maj+clic pour une plage · Échap pour vider
          </span>
          <span className="flex-1" />
          <button
            onClick={() => setSelection(EMPTY_SELECTION)}
            className={cn('px-3.5 py-1.5 text-[12px] font-bold', SOFT_PILL)}
          >
            Désélectionner
          </button>
        </div>
      )}

      {/* Queue */}
      {isLoading ? (
        <Card className="p-0"><ScreenLoader /></Card>
      ) : (
        <DataTable
          label="Paiements"
          rows={filteredPayments}
          columns={columns}
          rowId={(p) => p.id}
          activeId={paymentId ?? null}
          onOpen={(p) => navigate(`/m/payments/${p.id}`)}
          selection={selection}
          onSelectionChange={setSelection}
          sortKey={sortOption.field}
          sortDir={sortOption.ascending ? 'asc' : 'desc'}
          onSort={(key) => {
            // Toggle direction when the same column is clicked twice.
            const same = SORT_OPTIONS.filter((o) => o.field === key);
            if (same.length === 0) return;
            const current = same.find((o) => o.key === sortKey);
            const next = current ? same.find((o) => o.key !== current.key) ?? current : same[0];
            setSortKey(next.key);
          }}
          empty={
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Holder icon={CreditCard} size="lg" />
              <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun paiement trouvé</p>
              <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                {statusFilter !== 'all' || methodFilter !== 'all' || dateFrom || dateTo
                  ? 'Essayez de modifier vos filtres'
                  : 'Les paiements apparaîtront ici'}
              </p>
            </div>
          }
          footer={
            !debouncedSearch ? (
              <InfiniteScrollTrigger
                onLoadMore={handleLoadMore}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
            ) : undefined
          }
        />
      )}
    </div>
    </Inspector>
  );
}
