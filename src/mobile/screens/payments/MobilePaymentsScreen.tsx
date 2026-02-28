// ============================================================
// MODULE PAIEMENTS — MobilePaymentsScreen (Premium Rebuild)
// Admin payment queue: glass KPI cards, SLA indicators,
// premium list rows, smart filters, infinite scroll
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  TO_PROCESS_STATUSES,
} from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import {
  Plus, Search, Clock, PlayCircle, CheckCircle, TrendingUp,
  Paperclip, SlidersHorizontal, X, Calendar, CreditCard,
  FileDown, Loader2,
} from 'lucide-react';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { BatchPaymentsPDF } from '@/lib/pdf/templates/BatchPaymentsPDF';
import type { BatchPaymentEntry } from '@/lib/pdf/templates/BatchPaymentsPDF';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { formatCurrencyRMB, formatRelativeDate } from '@/lib/formatters';
import { getPaymentSlaLevel, type SlaLevel } from '@/lib/paymentSla';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ── Filter configuration ────────────────────────────────────

type FilterKey = PaymentStatus | 'all' | 'to_process';

const STATUS_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'to_process', label: 'À traiter' },
  { key: 'processing', label: 'En cours' },
  { key: 'completed', label: 'Terminés' },
  { key: 'rejected', label: 'Rejetés' },
];

const METHOD_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes méthodes' },
  ...Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label })),
];

const SORT_OPTIONS: { key: string; label: string; field: 'created_at' | 'amount_rmb'; ascending: boolean }[] = [
  { key: 'newest', label: 'Plus récent', field: 'created_at', ascending: false },
  { key: 'oldest', label: 'Plus ancien', field: 'created_at', ascending: true },
  { key: 'amount_desc', label: 'Montant ↓', field: 'amount_rmb', ascending: false },
  { key: 'amount_asc', label: 'Montant ↑', field: 'amount_rmb', ascending: true },
];

// ── SLA dot component ───────────────────────────────────────

function SlaDot({ level }: { level: SlaLevel }) {
  return (
    <span
      className={cn(
        'sla-dot',
        level === 'fresh' && 'sla-fresh',
        level === 'aging' && 'sla-aging',
        level === 'overdue' && 'sla-overdue animate',
      )}
      title={
        level === 'fresh' ? '< 4h' : level === 'aging' ? '4-12h' : '> 12h'
      }
    />
  );
}

// ── Main component ──────────────────────────────────────────

export function MobilePaymentsScreen() {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
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
      params.statuses = TO_PROCESS_STATUSES as string[];
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
      // Fetch processing payments (non-cash) — must use supabaseAdmin (admin session)
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('id, reference, amount_rmb, method, beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_bank_name, beneficiary_bank_account, beneficiary_qr_code_url')
        .eq('status', 'processing')
        .neq('method', 'cash');

      if (error) throw error;

      if (!payments || payments.length === 0) {
        toast.error('Aucun paiement en cours à exporter');
        return;
      }

      // Generate signed URLs for QR codes
      const entries: BatchPaymentEntry[] = await Promise.all(
        payments.map(async (p) => {
          let qrUrl = p.beneficiary_qr_code_url;
          if (qrUrl && qrUrl.startsWith('payment-proofs/')) {
            const storagePath = qrUrl.replace('payment-proofs/', '');
            const { data: signedData } = await supabaseAdmin.storage
              .from('payment-proofs')
              .createSignedUrl(storagePath, 3600);
            qrUrl = signedData?.signedUrl || null;
          }
          return {
            id: p.id,
            reference: p.reference,
            amount_rmb: p.amount_rmb,
            method: p.method,
            beneficiary_name: p.beneficiary_name,
            beneficiary_phone: p.beneficiary_phone,
            beneficiary_email: p.beneficiary_email,
            beneficiary_bank_name: p.beneficiary_bank_name,
            beneficiary_bank_account: p.beneficiary_bank_account,
            beneficiary_qr_code_url: qrUrl,
          };
        }),
      );

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await downloadPDF(
        <BatchPaymentsPDF payments={entries} generatedAt={new Date()} />,
        `Paiements_en_cours_${dateStr}.pdf`,
      );
      toast.success(`Export de ${entries.length} paiement(s) téléchargé`);
    } catch (error) {
      console.error('Error exporting batch payments:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader
        title="Paiements"
        rightElement={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBatch}
              disabled={isExporting}
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Exporter
            </button>
            <button
              onClick={() => navigate('/m/payments/new')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <PullToRefresh onRefresh={refetch} className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
        {/* ── KPI Stats Row ───────────────────────────────────── */}
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-hide">
          {/* À traiter */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'to_process' ? 'all' : 'to_process')}
            className={cn(
              'deposit-stat-card min-w-[110px] sm:min-w-[130px] flex-shrink-0 border-blue-500/20 bg-blue-500/5',
              statusFilter === 'to_process' && 'active ring-blue-500',
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">À traiter</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.toProcess}</p>
          </button>

          {/* En cours */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')}
            className={cn(
              'deposit-stat-card min-w-[110px] sm:min-w-[130px] flex-shrink-0 border-purple-500/20 bg-purple-500/5',
              statusFilter === 'processing' && 'active ring-purple-500',
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <PlayCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium">En cours</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{counts.inProgress}</p>
          </button>

          {/* Terminés */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            className={cn(
              'deposit-stat-card min-w-[110px] sm:min-w-[130px] flex-shrink-0 border-green-500/20 bg-green-500/5',
              statusFilter === 'completed' && 'active ring-green-500',
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600/70 dark:text-green-400/70 font-medium">Terminés</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.completed}</p>
          </button>

          {/* Aujourd'hui */}
          {stats && stats.today_completed > 0 && (
            <div className="deposit-stat-card min-w-[110px] sm:min-w-[140px] flex-shrink-0 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary/70 font-medium">Aujourd'hui</span>
              </div>
              <p className="text-2xl font-bold text-primary">{stats.today_completed}</p>
              <p className="text-[10px] text-primary/60 mt-0.5">{formatCurrencyRMB(stats.today_amount_rmb)}</p>
            </div>
          )}
        </div>

        {/* ── Export batch button ──────────────────────────────── */}
        <button
          onClick={handleExportBatch}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Exporter paiements en cours (PDF)
        </button>

        {/* ── Search + filter toggle ──────────────────────────── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nom, téléphone ou référence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Advanced filters panel ──────────────────────────── */}
        {showFilters && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Filtres avancés</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-xs text-primary font-medium"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Method filter */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Méthode</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {METHOD_FILTERS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethodFilter(m.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      methodFilter === m.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tri</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortKey(opt.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      sortKey === opt.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                <Calendar className="w-3 h-3 inline mr-1" />
                Période
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-muted border-0 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-muted border-0 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Status filter chips ─────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-hide">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.key === 'to_process'
                ? counts.toProcess
                : filter.key === 'processing'
                  ? counts.inProgress
                  : filter.key === 'completed'
                    ? counts.completed
                    : filter.key === 'all'
                      ? counts.total
                      : null;
            return (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5',
                  statusFilter === filter.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {filter.label}
                {count !== null && count > 0 && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                      statusFilter === filter.key
                        ? 'bg-primary-foreground/20'
                        : 'bg-background',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Payments list ───────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredPayments.length > 0 ? (
          <div className="space-y-2.5">
            {filteredPayments.map((payment) => {
              const initials = `${payment.profiles?.first_name?.[0] || '?'}${payment.profiles?.last_name?.[0] || ''}`;
              const clientName = payment.profiles
                ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
                : 'Client inconnu';
              const proofCount = payment.proof_count || 0;
              const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);

              return (
                <button
                  key={payment.id}
                  onClick={() => navigate(`/m/payments/${payment.id}`)}
                  className="deposit-row"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Avatar + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{clientName}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {payment.reference}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method}
                          </span>
                          {proofCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Paperclip className="w-2.5 h-2.5" />
                              {proofCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount + status + SLA + date */}
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="font-bold text-sm tabular-nums">{formatCurrencyRMB(payment.amount_rmb)}</p>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
                          PAYMENT_STATUS_COLORS[payment.status as PaymentStatus] || 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] || payment.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {slaLevel && <SlaDot level={slaLevel} />}
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeDate(payment.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Infinite scroll trigger - only when not searching */}
            {!debouncedSearch && (
              <InfiniteScrollTrigger
                onLoadMore={handleLoadMore}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
            )}
          </div>
        ) : (
          <MobileEmptyState
            icon={CreditCard}
            title="Aucun paiement trouvé"
            description={statusFilter !== 'all' || activeFilterCount > 0 ? 'Essayez de modifier vos filtres' : 'Les paiements apparaîtront ici'}
          />
        )}
      </PullToRefresh>
    </div>
  );
}
