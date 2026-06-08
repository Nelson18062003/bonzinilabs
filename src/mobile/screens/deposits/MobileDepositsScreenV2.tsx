// ============================================================
// MODULE DEPOTS V2 — MobileDepositsScreenV2
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · cartes à ombre douce · MIcon méthode · Amount ·
//   StatusPill toné (depositStatusTone) · SlaDot · chips kit.
// Logique 100% préservée : stats, recherche debouncée, filtres
// (famille/période/tri), chips statut, infinite scroll, SLA.
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS_SHORT,
} from '@/types/deposit';
import type { DepositStatus, DepositMethod } from '@/types/deposit';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatRelativeDate } from '@/lib/formatters';
import { getDepositSlaLevel, type SlaLevel } from '@/lib/depositTimeline';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, SlidersHorizontal, Paperclip, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  type Tone,
  depositStatusTone,
  StatusPill,
  TextInput,
  Holder,
  Amount,
  Card,
} from '@/mobile/designKit';

// ── Familles de méthode (identité de marque conservée) ───────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean; name: string }> = {
  BANK: { letter: 'B', bg: '#1e3a5f', name: 'Banque' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE', name: 'Agence' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600', name: 'Orange' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true, name: 'MTN' },
  WAVE: { letter: 'W', bg: '#1dc3e3', name: 'Wave' },
};

function getFamilyFromMethod(method: string): string {
  if (['bank_transfer', 'bank_cash'].includes(method)) return 'BANK';
  if (method === 'agency_cash') return 'AGENCY_BONZINI';
  if (['om_transfer', 'om_withdrawal'].includes(method)) return 'ORANGE_MONEY';
  if (['mtn_transfer', 'mtn_withdrawal'].includes(method)) return 'MTN_MONEY';
  if (method === 'wave') return 'WAVE';
  return 'BANK';
}

// Mapping famille → méthodes DB (pour filtrage)
const FAMILY_TO_METHODS: Record<string, DepositMethod[]> = {
  BANK: ['bank_transfer', 'bank_cash'],
  AGENCY_BONZINI: ['agency_cash'],
  ORANGE_MONEY: ['om_transfer', 'om_withdrawal'],
  MTN_MONEY: ['mtn_transfer', 'mtn_withdrawal'],
  WAVE: ['wave'],
};

// ── Composant MIcon (vignette méthode, couleur de marque) ────
function MIcon({ family, size = 38 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-black"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: f.bg,
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
      }}
    >
      {f.letter}
    </div>
  );
}

// ── Point SLA ────────────────────────────────────────────────
function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 6,
        height: 6,
        background: color,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
    />
  );
}

// ── Filtres statut ───────────────────────────────────────────
type FilterKey = DepositStatus | 'all' | 'to_process';
const TO_PROCESS_STATUSES: DepositStatus[] = ['proof_submitted', 'admin_review'];

// ── Présets période ──────────────────────────────────────────
type PeriodPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function getPeriodDates(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    return { dateFrom: ymd(now), dateTo: ymd(now) };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { dateFrom: ymd(y), dateTo: ymd(y) };
  }
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { dateFrom: ymd(monday), dateTo: '' };
  }
  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: ymd(first), dateTo: '' };
  }
  return { dateFrom: '', dateTo: '' };
}

// KPI rapides → tone unifié (la couleur porte le statut).
const KPI_TILES: { label: string; key: FilterKey; tone: Tone; figure: string; ring: string }[] = [
  { label: 'À traiter', key: 'to_process', tone: 'info', figure: 'text-[#5B4CC4] dark:text-[#B5AAF0]', ring: 'ring-[#C9C2F0] dark:ring-[#4A4660]' },
  { label: 'À corriger', key: 'pending_correction', tone: 'pending', figure: 'text-[#9A6B12] dark:text-[#E7C083]', ring: 'ring-[#E7C083]' },
  { label: 'Validés', key: 'validated', tone: 'success', figure: 'text-[#2E7D52] dark:text-[#7FCBA0]', ring: 'ring-[#7FCBA0]' },
];

// ── Composant principal ──────────────────────────────────────
export function MobileDepositsScreenV2() {
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
      params.statuses = TO_PROCESS_STATUSES as string[];
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    // Note: DepositFilters supporte method (string unique) — on filtre par famille côté client
    // Pas besoin d'envoyer le filtre méthode au serveur ici

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    params.sortField = 'created_at';
    params.sortAscending = false;

    const hasFilters = params.status || params.statuses || params.dateFrom || params.dateTo;
    const isDefault = !hasFilters;
    if (isDefault) return undefined;
    return params;
  }, [statusFilter, dateFrom, dateTo]);

  const {
    data,
    isLoading,
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
    // Filtre famille côté client
    if (familyFilter !== 'all') {
      const methods = FAMILY_TO_METHODS[familyFilter] || [];
      list = list.filter((d) => methods.includes(d.method));
    }
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
  }, [allDeposits, debouncedSearch, familyFilter]);

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

  const kpiValue: Record<FilterKey, number> = {
    to_process: counts.toProcess,
    pending_correction: counts.correction,
    validated: counts.validated,
  } as Record<FilterKey, number>;

  const hasActiveFilters = familyFilter !== 'all' || periodPreset !== 'all';

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-40 flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top)]',
          SURFACE.canvas,
        )}
      >
        <div className="flex h-14 w-full items-center justify-between">
          <h1 className={cn('text-[20px] font-extrabold', TEXT.strong)}>Dépôts</h1>
          <button
            onClick={() => navigate('/m/deposits/new')}
            aria-label="Nouveau dépôt"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10B981] text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.55)] transition active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
      </header>

      <PullToRefresh
        onRefresh={refetch}
        className="flex-1 space-y-3 overflow-y-auto px-5 pb-28 pt-1"
      >
        {/* ── KPIs compacts (tap = filtre statut) ───────────── */}
        <div className="flex gap-2.5">
          {KPI_TILES.map((k) => {
            const active = statusFilter === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setStatusFilter(active ? 'all' : k.key)}
                className={cn(
                  'flex-1 rounded-[18px] py-3 text-center transition active:scale-[0.98]',
                  SURFACE.card,
                  SURFACE.shadow,
                  active && cn('ring-2', k.ring),
                )}
              >
                <div className={cn('text-[22px] font-extrabold leading-none tabular-nums', k.figure)}>
                  {kpiValue[k.key] ?? 0}
                </div>
                <div className={cn('mt-1.5 text-[9px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  {k.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Recherche + bouton filtres ─────────────────────── */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder="Nom, téléphone ou référence..."
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
              'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95',
              SURFACE.card,
              SURFACE.shadow,
              (showFilters || hasActiveFilters) && 'ring-2 ring-[#C9C2F0] dark:ring-[#4A4660]',
            )}
          >
            <SlidersHorizontal className={cn('h-[18px] w-[18px]', showFilters || hasActiveFilters ? 'text-[#6B5BD2] dark:text-[#A99BF0]' : TEXT.muted)} />
            {hasActiveFilters && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#6B5BD2] dark:bg-[#A99BF0]" />
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ────────────────────────── */}
        {showFilters && (
          <Card className="space-y-3">
            {/* Filtre méthode par famille */}
            <div>
              <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Méthode</div>
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
                      'rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                      familyFilter === m.k ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre période */}
            <div>
              <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Période</div>
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
                      'rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                      periodPreset === p.k ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <TextInput
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="flex-1"
                />
                <span className={cn('text-[13px]', TEXT.muted)}>→</span>
                <TextInput
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="flex-1"
                />
              </div>
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
              <button
                key={ch.k}
                onClick={() => setStatusFilter(ch.k)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors',
                  active ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {ch.l}
                {ch.c != null && ch.c > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[9px] font-extrabold tabular-nums',
                      active ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#1B1A24]' : 'bg-black/[0.06] dark:bg-white/10',
                    )}
                  >
                    {ch.c}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Liste dépôts ───────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
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
                    'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <MIcon family={family} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                        {clientName}
                      </span>
                      {proofCount > 0 && (
                        <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                          <Paperclip className="h-3 w-3" />
                          {proofCount}
                        </span>
                      )}
                    </div>
                    <div className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>
                      {deposit.reference} · {methodShort}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Amount value={fmtAmount(deposit.amount_xaf)} unit="XAF" size="md" />
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      {slaLevel && <SlaDot level={slaLevel} />}
                      <StatusPill tone={depositStatusTone(deposit.status)} label={statusLabel} />
                    </div>
                    <div className={cn('mt-1 text-[10px]', TEXT.muted)}>
                      {formatRelativeDate(deposit.created_at)}
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
            <Holder icon={FileText} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun dépôt trouvé</p>
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
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
