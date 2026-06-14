/**
 * Desktop admin — deposits as a real data table.
 *
 * Same data layer and filters as MobileDepositsScreenV2 (paginated hook, status
 * buckets, method families, period presets, debounced search, SLA, infinite
 * scroll) — only the presentation differs: a wide table with a clickable stat
 * strip, a toolbar and inline filters instead of a stacked card list.
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, X, Paperclip, FileText } from 'lucide-react';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatRelativeDate } from '@/lib/formatters';
import { getDepositSlaLevel, type SlaLevel } from '@/lib/depositTimeline';
import {
  FAMILIES_CONF,
  getFamilyFromMethod,
  FAMILY_TO_METHODS,
  TO_PROCESS_STATUSES,
  getPeriodDates,
  type FilterKey,
  type PeriodPreset,
} from '@/lib/depositsList';
import { cn } from '@/lib/utils';
import { MobileDepositDetailV2 } from '@/mobile/screens/deposits';
import { MasterDetailLayout } from '@/desktop/components/MasterDetailLayout';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  type Tone,
  depositStatusTone,
  StatusPill,
  Amount,
  Holder,
  TextInput,
  ScreenLoader,
  Card,
} from '@/mobile/designKit';

function MIcon({ family, size = 32 }: { family: string; size?: number }) {
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

function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: 6, height: 6, background: color, animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined }}
    />
  );
}

function fmtAmount(n: number) {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'pending_correction', l: 'À corriger' },
  { k: 'validated', l: 'Validés' },
  { k: 'rejected', l: 'Rejetés' },
];

const STAT_TILES: { key: FilterKey; label: string; tone: Tone }[] = [
  { key: 'to_process', label: 'À traiter', tone: 'info' },
  { key: 'pending_correction', label: 'À corriger', tone: 'pending' },
  { key: 'validated', label: 'Validés', tone: 'success' },
  { key: 'rejected', label: 'Rejetés', tone: 'danger' },
];

const METHOD_CHIPS = [
  { k: 'all', l: 'Toutes' },
  { k: 'BANK', l: 'Banque' },
  { k: 'AGENCY_BONZINI', l: 'Agence' },
  { k: 'ORANGE_MONEY', l: 'Orange' },
  { k: 'MTN_MONEY', l: 'MTN' },
  { k: 'WAVE', l: 'Wave' },
];

const PERIOD_CHIPS: { k: PeriodPreset; l: string }[] = [
  { k: 'all', l: 'Toutes' },
  { k: 'today', l: "Aujourd'hui" },
  { k: 'yesterday', l: 'Hier' },
  { k: 'week', l: 'Cette semaine' },
  { k: 'month', l: 'Ce mois' },
  { k: 'custom', l: 'Personnalisé' },
];

export function DesktopDepositsScreen() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = useDepositStats();

  const { dateFrom, dateTo } = useMemo(() => {
    if (periodPreset === 'custom') return { dateFrom: customDateFrom, dateTo: customDateTo };
    return getPeriodDates(periodPreset);
  }, [periodPreset, customDateFrom, customDateTo]);

  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const params: DepositFilters = {};
    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES as string[];
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    params.sortField = 'created_at';
    params.sortAscending = false;
    const hasFilters = params.status || params.statuses || params.dateFrom || params.dateTo;
    return hasFilters ? params : undefined;
  }, [statusFilter, dateFrom, dateTo]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedAdminDeposits(filterParams);
  const handleLoadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const allDeposits = useMemo(() => data?.pages.flatMap((page) => page.data) || [], [data]);

  const filteredDeposits = useMemo(() => {
    let list = allDeposits;
    if (familyFilter !== 'all') {
      const methods = FAMILY_TO_METHODS[familyFilter] || [];
      list = list.filter((d) => methods.includes(d.method));
    }
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

  const counts = {
    toProcess: stats?.to_process ?? 0,
    correction: stats?.pending_correction ?? 0,
    validated: stats?.validated ?? 0,
    rejected: stats?.rejected ?? 0,
    total: stats?.total ?? 0,
  };
  const countFor = (k: FilterKey): number | null => {
    switch (k) {
      case 'all': return counts.total;
      case 'to_process': return counts.toProcess;
      case 'pending_correction': return counts.correction;
      case 'validated': return counts.validated;
      case 'rejected': return counts.rejected;
      default: return null;
    }
  };

  return (
    <MasterDetailLayout detail={depositId ? <MobileDepositDetailV2 /> : null}>
    <div className="space-y-6">
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Dépôts</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {counts.total} dépôt{counts.total > 1 ? 's' : ''} · {counts.toProcess} à traiter
          </p>
        </div>
        <button
          onClick={() => navigate('/m/deposits/new')}
          className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
        >
          <Plus className="h-4 w-4" /> Nouveau dépôt
        </button>
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
            {METHOD_CHIPS.map((m) => (
              <button
                key={m.k}
                onClick={() => setFamilyFilter(m.k)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  familyFilter === m.k ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {m.l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('mr-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Période</span>
            {PERIOD_CHIPS.map((p) => (
              <button
                key={p.k}
                onClick={() => setPeriodPreset(p.k)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  periodPreset === p.k ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2">
              <TextInput type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-10 text-[13px]" />
              <span className={cn('text-[13px]', TEXT.muted)}>→</span>
              <TextInput type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-10 text-[13px]" />
            </div>
          )}
        </div>
      </section>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <ScreenLoader />
        ) : filteredDeposits.length > 0 ? (
          <>
            <table className="w-full text-left">
              <thead>
                <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  <th className="px-5 py-3 font-bold">Référence</th>
                  <th className="px-2 py-3 font-bold">Client</th>
                  <th className="px-2 py-3 text-right font-bold">Montant XAF</th>
                  <th className="px-2 py-3 font-bold">Méthode</th>
                  <th className="px-2 py-3 font-bold">Créé le</th>
                  <th className="px-5 py-3 text-right font-bold">Statut</th>
                </tr>
              </thead>
              <tbody>
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
                    <tr
                      key={deposit.id}
                      onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                      className={cn(
                        'cursor-pointer border-t border-black/[0.05] transition hover:bg-[#EDEAFA]/40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]',
                        depositId === deposit.id && 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]',
                      )}
                    >
                      <td className="px-5 py-3">
                        <span className={cn('rounded-lg px-2 py-1 font-mono text-[12px] font-bold', SURFACE.holder)}>
                          {deposit.reference}
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
                        <Amount value={fmtAmount(deposit.amount_xaf)} size="md" />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <MIcon family={family} size={28} />
                          <span className={cn('text-[12px]', TEXT.muted)}>{methodShort}</span>
                        </div>
                      </td>
                      <td className={cn('px-2 py-3 text-[12px]', TEXT.muted)}>{formatRelativeDate(deposit.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {slaLevel && <SlaDot level={slaLevel} />}
                          <StatusPill tone={depositStatusTone(deposit.status)} label={statusLabel} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!debouncedSearch && (
              <div className="px-5 py-3">
                <InfiniteScrollTrigger
                  onLoadMore={handleLoadMore}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={FileText} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun dépôt trouvé</p>
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
              {statusFilter !== 'all' || familyFilter !== 'all' || periodPreset !== 'all'
                ? 'Essayez de modifier vos filtres'
                : 'Les dépôts apparaîtront ici'}
            </p>
          </div>
        )}
      </Card>
    </div>
    </MasterDetailLayout>
  );
}
