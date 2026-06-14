/**
 * Desktop admin — payments as a real data table.
 *
 * Same data layer as MobilePaymentsScreen (paginated hook, status buckets,
 * method/sort/period filters, debounced search, SLA, batch PDF export) — shown
 * as a wide table with a clickable stat strip and a toolbar.
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, X, Paperclip, CreditCard, FileDown, Loader2 } from 'lucide-react';
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
import { MasterDetailLayout } from '@/desktop/components/MasterDetailLayout';
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
    <MasterDetailLayout detail={paymentId ? <MobilePaymentDetail /> : null}>
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

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <ScreenLoader />
        ) : filteredPayments.length > 0 ? (
          <>
            <table className="w-full text-left">
              <thead>
                <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  <th scope="col" className="px-5 py-3 font-bold">Référence</th>
                  <th scope="col" className="px-2 py-3 font-bold">Client</th>
                  <th scope="col" className="px-2 py-3 text-right font-bold">Montant</th>
                  <th scope="col" className="px-2 py-3 font-bold">Méthode</th>
                  <th scope="col" className="px-2 py-3 font-bold">Créé le</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const clientName = payment.profiles
                    ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
                    : 'Client inconnu';
                  const proofCount = payment.proof_count || 0;
                  const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
                  const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] || payment.status;
                  const methodLabel = PAYMENT_METHOD_LABELS[payment.method] || payment.method;
                  return (
                    <tr
                      key={payment.id}
                      onClick={() => navigate(`/m/payments/${payment.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/m/payments/${payment.id}`); } }}
                      className={cn(
                        'cursor-pointer border-t border-black/[0.05] outline-none transition hover:bg-[#EDEAFA]/40 focus-visible:bg-[#EDEAFA]/60 dark:border-white/[0.05] dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]',
                        paymentId === payment.id && 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]',
                      )}
                    >
                      <td className="px-5 py-3">
                        <span className={cn('rounded-lg px-2 py-1 font-mono text-[12px] font-bold', SURFACE.holder)}>
                          {payment.reference}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{clientName}</span>
                          {proofCount > 0 && (
                            <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                              <Paperclip className="h-3 w-3" />
                              {proofCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="md" />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <PaymentMethodLogo method={logoMethod(payment.method)} size={26} />
                          <span className={cn('text-[12px]', TEXT.muted)}>{methodLabel}</span>
                        </div>
                      </td>
                      <td className={cn('px-2 py-3 text-[12px]', TEXT.muted)}>{formatRelativeDate(payment.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {slaLevel && <SlaDot level={slaLevel} />}
                          <StatusPill tone={paymentStatusTone(payment.status)} label={statusLabel} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!debouncedSearch && (
              <div className="px-5 py-3">
                <InfiniteScrollTrigger onLoadMore={handleLoadMore} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={CreditCard} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun paiement trouvé</p>
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
              {statusFilter !== 'all' || methodFilter !== 'all' || dateFrom || dateTo
                ? 'Essayez de modifier vos filtres'
                : 'Les paiements apparaîtront ici'}
            </p>
          </div>
        )}
      </Card>
    </div>
    </MasterDetailLayout>
  );
}
