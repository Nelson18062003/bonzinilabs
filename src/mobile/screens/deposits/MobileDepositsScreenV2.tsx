// ============================================================
// MODULE DEPOTS V2 — MobileDepositsScreenV2
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · cartes à ombre douce · MIcon méthode · Amount ·
//   StatusPill toné (depositStatusTone) · SlaDot · chips kit.
// Logique 100% préservée : stats, recherche debouncée, filtres
// (famille/période/tri), chips statut, infinite scroll, SLA.
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { QueryError } from '@/components/ui/QueryError';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS_SHORT,
} from '@/types/deposit';
import {
  FAMILIES_CONF,
  getFamilyFromMethod,
  FAMILY_TO_METHODS,
  TO_PROCESS_STATUSES,
  getPeriodDates,
  type FilterKey,
  type PeriodPreset,
} from '@/lib/depositsList';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { whenSentence } from '@/lib/plainTime';

/** Une phrase commence par une majuscule. */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
import { getDepositSlaLevel } from '@/lib/depositTimeline';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, SlidersHorizontal, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  TOGGLE_ON,
  TOGGLE_OFF,
  Chip,
  depositStatusTone,
  StatusPill,
  TextInput,
  Holder,
  Card,
} from '@/mobile/designKit';

// Méthode families, status buckets & period presets are shared with the desktop
// screen — see '@/lib/depositsList'.

// ── Composant MIcon (vignette méthode, couleur de marque) ────
function MIcon({ family, size = 38 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: f.bg,
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
      }}
    >
      {f.letter}
    </div>
  );
}



// ── Composant principal ──────────────────────────────────────
export function MobileDepositsScreenV2({ embedded = false }: { embedded?: boolean } = {}) {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = useDepositStats();
  const navigate = useNavigate();

  // Dates effectives selon preset
  const { dateFrom, dateTo } = useMemo(() => {
    if (periodPreset === 'custom') return { dateFrom: customDateFrom, dateTo: customDateTo };
    return getPeriodDates(periodPreset);
  }, [periodPreset, customDateFrom, customDateTo]);

  // filterParams
  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const params: DepositFilters = {};

    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES;
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    // Note: DepositFilters supporte method (string unique) — on filtre par famille côté client
    // Pas besoin d'envoyer le filtre méthode au serveur ici

    // Famille filtrée côté serveur : filtrée côté client, une première page
    // sans Wave affichait « Aucun dépôt » alors que la suite en contenait.
    if (familyFilter !== 'all') params.methods = FAMILY_TO_METHODS[familyFilter] ?? [];

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    params.sortField = 'created_at';
    // La file « À traiter » se lit comme une file : le plus ancien en tête.
    params.sortAscending = statusFilter === 'to_process';

    const hasFilters = params.status || params.statuses || params.dateFrom || params.dateTo;
    const isDefault = !hasFilters;
    if (isDefault) return undefined;
    return params;
  }, [statusFilter, familyFilter, dateFrom, dateTo]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedAdminDeposits(filterParams);

  const handleLoadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const allDeposits = useMemo(
    () => data?.pages.flatMap((page) => page.data) || [],
    [data],
  );

  // Filtrage côté client : recherche + famille
  const filteredDeposits = useMemo(() => {
    let list = allDeposits;
    // Recherche
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      list = list.filter((deposit) => {
        const clientName = `${deposit.profiles?.first_name || ''} ${deposit.profiles?.last_name || ''}`.toLowerCase();
        return (
          clientName.includes(search) ||
          deposit.reference?.toLowerCase().includes(search) ||
          deposit.profiles?.phone?.includes(search)
        );
      });
    }
    return list;
  }, [allDeposits, debouncedSearch]);

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


  const hasActiveFilters = familyFilter !== 'all' || periodPreset !== 'all';

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
          <h1 className={cn('text-[20px] font-bold', TEXT.strong)}>Dépôts</h1>
          <button
            onClick={() => navigate('/m/deposits/new')}
            aria-label="Nouveau dépôt"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2C2C2C] text-white transition active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
      </header>
      )}

      <PullToRefresh
        onRefresh={refetch}
        className="flex-1 space-y-3 overflow-y-auto px-5 pb-28 pt-1"
      >
        {/* ── Recherche + bouton filtres ─────────────────────── */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder="Nom ou téléphone"
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
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" />
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ────────────────────────── */}
        {showFilters && (
          <Card className="space-y-3">
            {/* Filtre méthode par famille */}
            <div>
              <div className={cn('mb-2 text-[14px] font-semibold', TEXT.strong)}>Méthode</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: 'all', l: 'Toutes' },
                  { k: 'BANK', l: 'Banque' },
                  { k: 'AGENCY_BONZINI', l: 'Agence' },
                  { k: 'ORANGE_MONEY', l: 'Orange' },
                  { k: 'MTN_MONEY', l: 'MTN' },
                  { k: 'WAVE', l: 'Wave' },
                ].map((m) => (
                  <button
                    key={m.k}
                    onClick={() => setFamilyFilter(m.k)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center whitespace-nowrap px-2 text-[14px] font-semibold transition-colors',
                      familyFilter === m.k ? TOGGLE_ON : TOGGLE_OFF,
                    )}
                  >
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre période */}
            <div>
              <div className={cn('mb-2 text-[14px] font-semibold', TEXT.strong)}>Période</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: 'all' as PeriodPreset, l: 'Toutes' },
                  { k: 'today' as PeriodPreset, l: "Aujourd'hui" },
                  { k: 'yesterday' as PeriodPreset, l: 'Hier' },
                  { k: 'week' as PeriodPreset, l: 'Cette semaine' },
                  { k: 'month' as PeriodPreset, l: 'Ce mois' },
                  { k: 'custom' as PeriodPreset, l: 'Personnalisé' },
                ].map((p) => (
                  <button
                    key={p.k}
                    onClick={() => setPeriodPreset(p.k)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center whitespace-nowrap px-2 text-[14px] font-semibold transition-colors',
                      periodPreset === p.k ? TOGGLE_ON : TOGGLE_OFF,
                    )}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {periodPreset === 'custom' && (
              <BzDateRangeField
                value={{ from: customDateFrom, to: customDateTo }}
                onChange={(r) => { setCustomDateFrom(r.from); setCustomDateTo(r.to); }}
                accent="#2C2C2C"
                defaultOpen
              />
            )}
          </Card>
        )}

        {/* ── Chips statut ───────────────────────────────────── */}
        <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {[
            { k: 'all' as FilterKey, l: 'Tous', c: counts.total },
            { k: 'to_process' as FilterKey, l: 'À traiter', c: counts.toProcess },
            { k: 'pending_correction' as FilterKey, l: 'À corriger', c: counts.correction },
            { k: 'validated' as FilterKey, l: 'Validés', c: counts.validated },
            { k: 'rejected' as FilterKey, l: 'Rejetés', c: counts.rejected },
          ].map((ch) => {
            const active = statusFilter === ch.k;
            return (
              <Chip key={ch.k} label={ch.l} count={ch.c} active={active} onClick={() => setStatusFilter(ch.k)} />
            );
          })}
        </div>

        {/* ── Liste dépôts ───────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : isError ? (
          <QueryError what="les dépôts" onRetry={() => { void refetch(); }} />
        ) : filteredDeposits.length > 0 ? (
          <div className="space-y-2.5">
            {filteredDeposits.map((deposit) => {
              const clientName = deposit.profiles
                ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
                : 'Client inconnu';
              const proofCount = deposit.proof_count || 0;
              const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
              const family = getFamilyFromMethod(deposit.method);
              const statusLabel = DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status;
              const methodShort = DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method;

              return (
                <button
                  key={deposit.id}
                  onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <MIcon family={family} size={40} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className={cn('break-words text-[20px] font-semibold leading-tight', TEXT.strong)}>{clientName}</span>
                      <StatusPill tone={depositStatusTone(deposit.status)} label={statusLabel} />
                    </div>
                    <p className={cn('text-[16px] leading-snug', TEXT.strong)}><b className="tabular-nums">{fmtAmount(deposit.amount_xaf)} XAF</b> par {methodShort}</p>
                    <p className={cn('text-[16px] leading-snug', slaLevel === 'overdue' ? 'font-semibold text-[#C00F0C] dark:text-[#EC221F]' : slaLevel === 'aging' ? 'font-semibold text-[#975102] dark:text-[#E8B931]' : TEXT.muted)}>
                      {cap(whenSentence(deposit.created_at))}{proofCount > 0 ? ` · ${proofCount} ${proofCount > 1 ? 'preuves' : 'preuve'}` : ''}
                    </p>
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
            <Holder icon={FileText} size="lg" />
            <p className={cn('mt-4 text-[16px] font-semibold', TEXT.strong)}>Aucun dépôt trouvé</p>
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>
              {statusFilter !== 'all' || hasActiveFilters
                ? 'Essayez de modifier vos filtres'
                : 'Les dépôts apparaîtront ici'}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

// ── Formatage montant (espaces fines insécables) ─────────────
function fmtAmount(n: number) {
  return Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
