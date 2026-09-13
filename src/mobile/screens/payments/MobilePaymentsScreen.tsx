// ============================================================
// MODULE PAIEMENTS — MobilePaymentsScreen
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · cartes à ombre douce · PaymentMethodLogo (vrais logos) ·
//   Amount · StatusPill toné (paymentStatusTone) · SlaDot · chips kit.
// Logique 100% préservée : stats, recherche debouncée, filtres
// (méthode/période/tri), chips statut, infinite scroll, SLA,
// export PDF batch (colonnes LEGACY/EXTENDED + signature QR).
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import { useTranslation } from 'react-i18next';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  TO_PROCESS_STATUSES,
} from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import { type FilterKey, METHOD_FILTERS, SORT_OPTIONS, logoMethod } from '@/lib/paymentsList';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  TOGGLE_ON,
  TOGGLE_OFF,
  Chip,
  paymentStatusTone,
  StatusPill,
  TextInput,
  Holder,
  Amount,
  Card,
} from '@/mobile/designKit';
import {
  Plus, Search, Paperclip, SlidersHorizontal, X, Calendar, CreditCard,
  FileDown, Loader2, Layers,
} from 'lucide-react';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { toast } from 'sonner';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatCurrencyRMB, formatRelativeDate } from '@/lib/formatters';
import { getPaymentSlaLevel, type SlaLevel } from '@/lib/paymentSla';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

// Filtres (FilterKey, METHOD_FILTERS, SORT_OPTIONS) et logoMethod sont partagés
// avec l'écran desktop — voir '@/lib/paymentsList'.

// ── Point SLA (calqué sur deposits V2) ───────────────────────
function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#14AE5C' : level === 'aging' ? '#E8B931' : '#EC221F';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 6,
        height: 6,
        background: color,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
      title={level === 'fresh' ? '< 4h' : level === 'aging' ? '4-12h' : '> 12h'}
    />
  );
}


// ── Composant principal ──────────────────────────────────────

export function MobilePaymentsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [sortKey, setSortKey] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = usePaymentStats();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  const sortOption = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];

  // ── Build filter params ─────────────────────────────────────

  const filterParams = useMemo<PaymentFilters | undefined>(() => {
    const params: PaymentFilters = {};

    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES;
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    if (methodFilter !== 'all') {
      params.method = methodFilter;
    }

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    params.sortField = sortOption.field;
    params.sortAscending = sortOption.ascending;

    const hasFilters = params.status || params.statuses || params.method || params.dateFrom || params.dateTo;
    const isDefaultSort = sortOption.key === 'newest';

    if (!hasFilters && isDefaultSort) return undefined;
    return params;
  }, [statusFilter, methodFilter, dateFrom, dateTo, sortOption]);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedAdminPayments(filterParams);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const allPayments = useMemo(
    () => data?.pages.flatMap((page) => page.data) || [],
    [data],
  );

  // Client-side search over loaded items
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

  // ── Computed values ─────────────────────────────────────────

  const counts = useMemo(() => {
    if (stats) {
      return {
        toProcess: stats.toProcess,
        inProgress: stats.inProgress,
        completed: stats.completed,
        total: stats.total,
      };
    }
    return { toProcess: 0, inProgress: 0, completed: 0, total: 0 };
  }, [stats]);


  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (methodFilter !== 'all') count++;
    if (dateFrom || dateTo) count++;
    if (sortKey !== 'newest') count++;
    return count;
  }, [methodFilter, dateFrom, dateTo, sortKey]);

  const clearAdvancedFilters = useCallback(() => {
    setMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortKey('newest');
  }, []);

  const handleExportBatch = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count === 0) {
        toast.error(t('noPaymentsToExport', { defaultValue: 'Aucun paiement en cours à exporter' }));
        return;
      }
      toast.success(t('exportDownloaded', { defaultValue: `Export de ${count} paiement(s) téléchargé`, count }));
    } catch (error) {
      console.error('Error exporting batch payments:', error);
      toast.error(t('exportError', { defaultValue: "Erreur lors de l'export" }));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const hasActiveFilters = activeFilterCount > 0;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      {!embedded && (
      <header
        className={cn(
          'sticky top-0 z-40 flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top)]',
          SURFACE.canvas,
        )}
      >
        <div className="flex h-14 w-full items-center justify-between">
          <h1 className={cn('text-[20px] font-bold', TEXT.strong)}>
            {t('payments', { defaultValue: 'Paiements' })}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBatch}
              disabled={isExporting}
              aria-label="Exporter"
              className={cn(
                'flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-[14px] font-bold transition active:scale-95 disabled:opacity-50',
                SOFT_PILL,
              )}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exporter
            </button>
            <button
              onClick={() => navigate('/m/payments/batch/new')}
              aria-label="Paiement groupé"
              title="Paiement groupé"
              className={cn(
                'flex h-10 w-10 items-center justify-center transition active:scale-95',
                SOFT_PILL,
              )}
            >
              <Layers className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            <button
              onClick={() => navigate('/m/payments/new')}
              aria-label="Nouveau paiement"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2C2C2C] text-white transition active:scale-95"
            >
              <Plus className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </header>
      )}

      <PullToRefresh
        onRefresh={refetch}
        className="flex-1 space-y-3 overflow-y-auto px-5 pb-28 pt-1"
      >
        {/* ── Bandeau « aujourd'hui » (si activité) ─────────── */}
        {stats && stats.today_completed > 0 && (
          <Card className="flex items-center justify-between py-3">
            <div>
              <div className={cn('text-[14px] font-medium', TEXT.muted)}>Réglés aujourd'hui</div>
              <div className={cn('mt-0.5 text-[14px]', TEXT.muted)}>{formatCurrencyRMB(stats.today_amount_rmb)}</div>
            </div>
            <Amount value={stats.today_completed} size="md" />
          </Card>
        )}

        {/* ── Export batch (PDF) ───────────────────────────── */}
        {!embedded && (
        <button
          onClick={handleExportBatch}
          disabled={isExporting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[14px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
            SOFT_PILL,
          )}
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exporter paiements en cours (PDF)
        </button>
        )}

        {/* ── Recherche + bouton filtres ─────────────────────── */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder={t('searchNamePhoneRef', { defaultValue: 'Nom, téléphone ou référence...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filtres avancés"
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
              SURFACE.card,
              SURFACE.shadow,
              (showFilters || hasActiveFilters) && 'border-[#2C2C2C] dark:border-[#E3E3E3]',
            )}
          >
            <SlidersHorizontal className={cn('h-[18px] w-[18px]', showFilters || hasActiveFilters ? TEXT.strong : TEXT.muted)} />
            {hasActiveFilters && (
              <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-lg bg-[#2C2C2C] px-1 text-[14px] font-bold text-white dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ────────────────────────── */}
        {showFilters && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={cn('text-[14px] font-semibold', TEXT.strong)}>Filtres avancés</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-[14px] font-semibold text-[#1E1E1E] underline dark:text-[#F5F5F5]"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Filtre méthode */}
            <div>
              <div className={cn('mb-2 text-[14px] font-semibold', TEXT.strong)}>Méthode</div>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {METHOD_FILTERS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethodFilter(m.key)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center whitespace-nowrap px-2 text-[14px] font-semibold transition-colors',
                      methodFilter === m.key ? TOGGLE_ON : TOGGLE_OFF,
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tri */}
            <div>
              <div className={cn('mb-2 text-[14px] font-semibold', TEXT.strong)}>Tri</div>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortKey(opt.key)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center whitespace-nowrap px-2 text-[14px] font-semibold transition-colors',
                      sortKey === opt.key ? TOGGLE_ON : TOGGLE_OFF,
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Période */}
            <div>
              <div className={cn('mb-2 flex items-center gap-1 text-[14px] font-semibold', TEXT.strong)}>
                <Calendar className="h-3 w-3" />
                Période
              </div>
              <BzDateRangeField
                value={{ from: dateFrom, to: dateTo }}
                onChange={(r) => { setDateFrom(r.from); setDateTo(r.to); }}
                accent="#2C2C2C"
              />
            </div>
          </Card>
        )}

        {/* ── Chips statut ───────────────────────────────────── */}
        <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {[
            { k: 'all' as FilterKey, l: 'Tous', c: counts.total },
            { k: 'to_process' as FilterKey, l: 'À traiter', c: counts.toProcess },
            { k: 'processing' as FilterKey, l: 'En cours', c: counts.inProgress },
            { k: 'completed' as FilterKey, l: 'Terminés', c: counts.completed },
            { k: 'rejected' as FilterKey, l: 'Rejetés', c: null },
          ].map((ch) => {
            const active = statusFilter === ch.k;
            return (
              <Chip key={ch.k} label={ch.l} count={ch.c} active={active} onClick={() => setStatusFilter(ch.k)} />
            );
          })}
        </div>

        {/* ── Liste paiements ────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredPayments.length > 0 ? (
          <div className="space-y-2.5">
            {filteredPayments.map((payment) => {
              const clientName = payment.profiles
                ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
                : 'Client inconnu';
              const proofCount = payment.proof_count || 0;
              const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
              const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] || payment.status;
              const methodLabel = PAYMENT_METHOD_LABELS[payment.method] || payment.method;

              return (
                <button
                  key={payment.id}
                  onClick={() => navigate(`/m/payments/${payment.id}`)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <PaymentMethodLogo method={logoMethod(payment.method)} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className={cn('min-w-0 flex-1 truncate text-[16px] font-semibold', TEXT.strong)}>{clientName}</span>
                      <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="md" />
                    </div>
                    <div className={cn('mt-0.5 flex items-center justify-between gap-3 text-[14px]', TEXT.muted)}>
                      <span className="min-w-0 truncate">{payment.reference} · {methodLabel}</span>
                      <span className="shrink-0">{formatRelativeDate(payment.created_at)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {slaLevel && <SlaDot level={slaLevel} />}
                      <StatusPill tone={paymentStatusTone(payment.status)} label={statusLabel} />
                      {proofCount > 0 && (
                        <span className={cn('inline-flex items-center gap-1 text-[14px] font-semibold', TEXT.muted)}>
                          <Paperclip className="h-4 w-4" />
                          {proofCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Infinite scroll — uniquement si pas de recherche en cours */}
            {!debouncedSearch && (
              <InfiniteScrollTrigger
                onLoadMore={handleLoadMore}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Holder icon={CreditCard} size="lg" />
            <p className={cn('mt-4 text-[16px] font-semibold', TEXT.strong)}>
              {t('noPaymentFound', { defaultValue: 'Aucun paiement trouvé' })}
            </p>
            <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
              {statusFilter !== 'all' || activeFilterCount > 0
                ? 'Essayez de modifier vos filtres'
                : 'Les paiements apparaîtront ici'}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
