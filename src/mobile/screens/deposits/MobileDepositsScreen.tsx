// ============================================================
// MODULE DEPOTS — MobileDepositsScreen (Premium Rebuild)
// Admin deposit queue: glass KPI cards, SLA indicators,
// premium list rows, smart filters, infinite scroll
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_STATUS_COLORS,
} from '@/types/deposit';
import type { DepositStatus, DepositMethod } from '@/types/deposit';
import {
  Plus, Search, Clock, AlertCircle, CheckCircle, TrendingUp,
  Paperclip, SlidersHorizontal, X, Calendar, FileText,
} from 'lucide-react';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { formatXAF, formatRelativeDate, formatCurrency } from '@/lib/formatters';
import { getDepositSlaLevel, type SlaLevel } from '@/lib/depositTimeline';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ── Filter configuration ────────────────────────────────────

type FilterKey = DepositStatus | 'all' | 'to_process';

const STATUS_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'to_process', label: 'À traiter' },
  { key: 'pending_correction', label: 'À corriger' },
  { key: 'validated', label: 'Validés' },
  { key: 'rejected', label: 'Rejetés' },
  { key: 'cancelled', label: 'Annulés' },
];

const TO_PROCESS_STATUSES: DepositStatus[] = ['proof_submitted', 'admin_review'];

const METHOD_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes méthodes' },
  ...Object.entries(DEPOSIT_METHOD_LABELS).map(([key, label]) => ({ key, label })),
];

const SORT_OPTIONS: { key: string; label: string; field: 'created_at' | 'amount_xaf'; ascending: boolean }[] = [
  { key: 'newest', label: 'Plus récent', field: 'created_at', ascending: false },
  { key: 'oldest', label: 'Plus ancien', field: 'created_at', ascending: true },
  { key: 'amount_desc', label: 'Montant ↓', field: 'amount_xaf', ascending: false },
  { key: 'amount_asc', label: 'Montant ↑', field: 'amount_xaf', ascending: true },
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
        level === 'fresh' ? '< 2h' : level === 'aging' ? '2-8h' : '> 8h'
      }
    />
  );
}

// ── Main component ──────────────────────────────────────────

export function MobileDepositsScreen() {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = useDepositStats();
  const navigate = useNavigate();

  const sortOption = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];

  // ── Build filter params ─────────────────────────────────────

  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const params: DepositFilters = {};

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
  } = usePaginatedAdminDeposits(filterParams);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const allDeposits = useMemo(
    () => data?.pages.flatMap((page) => page.data) || [],
    [data],
  );

  // Client-side search over loaded items
  const filteredDeposits = useMemo(() => {
    if (!debouncedSearch) return allDeposits;
    const search = debouncedSearch.toLowerCase();
    return allDeposits.filter((deposit) => {
      const clientName = `${deposit.profiles?.first_name || ''} ${deposit.profiles?.last_name || ''}`.toLowerCase();
      return (
        clientName.includes(search) ||
        deposit.reference?.toLowerCase().includes(search) ||
        deposit.profiles?.phone?.includes(search)
      );
    });
  }, [allDeposits, debouncedSearch]);

  // ── Computed values ─────────────────────────────────────────

  const counts = useMemo(() => {
    if (stats) {
      return {
        toProcess: stats.to_process,
        correction: stats.pending_correction,
        validated: stats.validated,
        rejected: stats.rejected,
        total: stats.total,
      };
    }
    return { toProcess: 0, correction: 0, validated: 0, rejected: 0, total: 0 };
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

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader
        title="Dépôts"
        rightElement={
          <button
            onClick={() => navigate('/m/deposits/new')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
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

          {/* À corriger */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'pending_correction' ? 'all' : 'pending_correction')}
            className={cn(
              'deposit-stat-card min-w-[110px] sm:min-w-[130px] flex-shrink-0 border-orange-500/20 bg-orange-500/5',
              statusFilter === 'pending_correction' && 'active ring-orange-500',
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs text-orange-600/70 dark:text-orange-400/70 font-medium">À corriger</span>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{counts.correction}</p>
          </button>

          {/* Validés */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'validated' ? 'all' : 'validated')}
            className={cn(
              'deposit-stat-card min-w-[110px] sm:min-w-[130px] flex-shrink-0 border-green-500/20 bg-green-500/5',
              statusFilter === 'validated' && 'active ring-green-500',
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600/70 dark:text-green-400/70 font-medium">Validés</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.validated}</p>
          </button>

          {/* Aujourd'hui */}
          {stats && stats.today_validated > 0 && (
            <div className="deposit-stat-card min-w-[110px] sm:min-w-[140px] flex-shrink-0 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary/70 font-medium">Aujourd'hui</span>
              </div>
              <p className="text-2xl font-bold text-primary">{stats.today_validated}</p>
              <p className="text-[10px] text-primary/60 mt-0.5">{formatCurrency(stats.today_amount)}</p>
            </div>
          )}
        </div>

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
                : filter.key === 'pending_correction'
                  ? counts.correction
                  : filter.key === 'validated'
                    ? counts.validated
                    : filter.key === 'rejected'
                      ? counts.rejected
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

        {/* ── Deposits list ───────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredDeposits.length > 0 ? (
          <div className="space-y-2.5">
            {filteredDeposits.map((deposit) => {
              const initials = `${deposit.profiles?.first_name?.[0] || '?'}${deposit.profiles?.last_name?.[0] || ''}`;
              const clientName = deposit.profiles
                ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
                : 'Client inconnu';
              const proofCount = deposit.proof_count || 0;
              const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);

              return (
                <button
                  key={deposit.id}
                  onClick={() => navigate(`/m/deposits/${deposit.id}`)}
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
                          {deposit.reference}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
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
                      <p className="font-bold text-sm tabular-nums">{formatXAF(deposit.amount_xaf)}</p>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
                          DEPOSIT_STATUS_COLORS[deposit.status] || 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {slaLevel && <SlaDot level={slaLevel} />}
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeDate(deposit.created_at)}
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
            icon={FileText}
            title="Aucun dépôt trouvé"
            description={statusFilter !== 'all' || activeFilterCount > 0 ? 'Essayez de modifier vos filtres' : 'Les dépôts apparaîtront ici'}
          />
        )}
      </PullToRefresh>
    </div>
  );
}
