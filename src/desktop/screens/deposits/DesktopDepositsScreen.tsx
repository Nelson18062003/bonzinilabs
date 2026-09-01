/**
 * Desktop admin — Dépôts workbench (archetype surface A, docs/admin-redesign).
 *
 * Replaces the first-pass table: ONE 36px toolbar line (queue chips with live
 * counts + server-side search + method/period menus), a named table card with
 * sortable headers, an SLA-tinted age column, hover quick-actions on
 * actionable rows, and numbered pagination (no infinite scroll). The queue
 * view is sorted oldest-first — the SLA discipline the dots always implied.
 * Selecting a row opens the desktop detail panel; the list stays live.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Paperclip, FileText } from 'lucide-react';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePagedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DEPOSIT_STATUS_LABELS } from '@/types/deposit';
import { formatXAF } from '@/lib/formatters';
import { getDepositSlaLevel } from '@/lib/depositTimeline';
import { getFamilyFromMethod, FAMILY_TO_METHODS, TO_PROCESS_STATUSES, getPeriodDates, type PeriodPreset } from '@/lib/depositsList';
import { DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  depositStatusTone,
  StatusPill,
  Card,
  Amount,
  Holder,
  ScreenLoader,
  MIcon,
  Age,
  Chip,
  DropChip,
  SearchField,
  CardHeader,
  Th,
  Td,
  PaginationBar,
  RefChip,
  EMERALD_PILL,
  DANGER_SOFT_PILL,
} from '@/desktop/designKit';
import { DesktopDepositPanel } from './DesktopDepositPanel';

type Bucket = 'queue' | 'correction' | 'all';
type SortField = 'created_at' | 'amount_xaf';

const METHOD_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'BANK', label: 'Banque' },
  { value: 'AGENCY_BONZINI', label: 'Agence' },
  { value: 'ORANGE_MONEY', label: 'Orange' },
  { value: 'MTN_MONEY', label: 'MTN' },
  { value: 'WAVE', label: 'Wave' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'validated', label: 'Validés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'awaiting_proof', label: 'En attente de preuve' },
] as const;

export function DesktopDepositsScreen() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const compact = !!depositId;

  const [bucket, setBucket] = useState<Bucket>('queue');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all');
  const [familyFilter, setFamilyFilter] = useState<(typeof METHOD_OPTIONS)[number]['value']>('all');
  const [periodPreset, setPeriodPreset] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAscending, setSortAscending] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = useDepositStats();

  // Queue reads oldest-first by default; « Tous » newest-first.
  const effectiveAscending = sortAscending ?? (bucket === 'queue' && sortField === 'created_at');

  const filters = useMemo<DepositFilters>(() => {
    const f: DepositFilters = { sortField, sortAscending: effectiveAscending };
    if (bucket === 'queue') f.statuses = TO_PROCESS_STATUSES as string[];
    else if (bucket === 'correction') f.status = 'pending_correction';
    else if (statusFilter !== 'all') f.status = statusFilter;
    if (familyFilter !== 'all') f.methods = FAMILY_TO_METHODS[familyFilter] || [];
    if (periodPreset !== 'all') {
      const { dateFrom, dateTo } = getPeriodDates(periodPreset as PeriodPreset);
      if (dateFrom) f.dateFrom = dateFrom;
      if (dateTo) f.dateTo = dateTo;
    }
    if (debouncedSearch.trim()) f.search = debouncedSearch;
    return f;
  }, [bucket, statusFilter, familyFilter, periodPreset, debouncedSearch, sortField, effectiveAscending]);

  useEffect(() => {
    setPage(1);
  }, [bucket, statusFilter, familyFilter, periodPreset, debouncedSearch, sortField, effectiveAscending]);

  const { data, isLoading } = usePagedAdminDeposits(filters, page);
  const deposits = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + deposits.length}`;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAscending(!effectiveAscending);
    else {
      setSortField(field);
      setSortAscending(field === 'created_at' ? bucket !== 'queue' ? false : true : false);
    }
  };
  const sortedMark = (field: SortField) => (sortField === field ? (effectiveAscending ? 'asc' : 'desc') : null);

  const counts = {
    toProcess: stats?.to_process ?? 0,
    correction: stats?.pending_correction ?? 0,
    total: stats?.total ?? 0,
  };

  const hasFiltersActive = bucket !== 'queue' || familyFilter !== 'all' || periodPreset !== 'all' || !!debouncedSearch;

  return (
    <div className={cn('flex flex-col', compact ? 'h-[calc(100vh-120px)] min-h-[560px]' : 'min-h-[calc(100vh-120px)]')}>
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Dépôts</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {counts.total} dépôt{counts.total > 1 ? 's' : ''} ·{' '}
            <span className="font-bold text-amber-700 dark:text-amber-400">{counts.toProcess} à traiter</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/m/deposits/new')}
          className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
        >
          <Plus className="h-4 w-4" /> Nouveau dépôt
        </button>
      </header>

      {/* ── Barre d'outils — UNE ligne, hauteur 36px ────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="À traiter" count={counts.toProcess} active={bucket === 'queue'} onClick={() => setBucket('queue')} />
          <Chip label="À corriger" count={counts.correction || null} active={bucket === 'correction'} onClick={() => setBucket('correction')} />
          <Chip label="Tous" count={counts.total} active={bucket === 'all'} onClick={() => setBucket('all')} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={compact ? 'Rechercher…' : 'Nom, téléphone ou référence…'}
            className={compact ? 'w-[200px]' : 'w-[280px]'}
          />
          {bucket === 'all' && (
            <DropChip label="Statut" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
          )}
          <DropChip label="Méthode" value={familyFilter} options={METHOD_OPTIONS} onChange={setFamilyFilter} />
          <DropChip label="Période" value={periodPreset} options={PERIOD_OPTIONS} onChange={setPeriodPreset} />
        </div>
      </section>

      {/* ── Table + panneau ─────────────────────────────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-5">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CardHeader
            title={bucket === 'queue' ? "File d'attente" : bucket === 'correction' ? 'À corriger' : 'Tous les dépôts'}
            meta={
              sortField === 'created_at'
                ? effectiveAscending
                  ? 'Triés du plus ancien au plus récent'
                  : 'Triés du plus récent au plus ancien'
                : `Triés par montant ${effectiveAscending ? 'croissant' : 'décroissant'}`
            }
          />
          {isLoading ? (
            <ScreenLoader />
          ) : deposits.length > 0 ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
                    <tr>
                      {!compact && <Th first>Référence</Th>}
                      <Th first={compact}>Client</Th>
                      <Th align="right" sortable sorted={sortedMark('amount_xaf')} onSort={() => toggleSort('amount_xaf')}>
                        Montant XAF
                      </Th>
                      {!compact && <Th>Méthode</Th>}
                      <Th sortable sorted={sortedMark('created_at')} onSort={() => toggleSort('created_at')}>
                        Reçu
                      </Th>
                      <Th last={compact}>Statut</Th>
                      {!compact && <Th last className="w-[176px]" />}
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((deposit) => {
                      const clientName = deposit.profiles
                        ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
                        : 'Client inconnu';
                      const proofCount = deposit.proof_count || 0;
                      const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
                      const family = getFamilyFromMethod(deposit.method);
                      const actionable = TO_PROCESS_STATUSES.includes(deposit.status as (typeof TO_PROCESS_STATUSES)[number]);
                      const open = () => navigate(`/m/deposits/${deposit.id}`);
                      return (
                        <tr
                          key={deposit.id}
                          onClick={open}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              open();
                            }
                          }}
                          className={cn(
                            'group cursor-pointer outline-none transition',
                            depositId === deposit.id
                              ? 'bg-accent'
                              : 'hover:bg-muted/40 focus-visible:bg-muted/60 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]',
                          )}
                        >
                          {!compact && (
                            <Td first>
                              <span className="inline-flex items-center gap-1.5">
                                <RefChip>{deposit.reference}</RefChip>
                                {proofCount > 0 && (
                                  <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                                    <Paperclip className="h-3 w-3" />
                                    {proofCount}
                                  </span>
                                )}
                              </span>
                            </Td>
                          )}
                          <Td first={compact}>
                            <div className="leading-[16px]">
                              <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', TEXT.strong)}>
                                <span className={cn(compact && 'inline-block max-w-[140px] truncate')}>{clientName}</span>
                                {compact && proofCount > 0 && (
                                  <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                                    <Paperclip className="h-3 w-3" />
                                    {proofCount}
                                  </span>
                                )}
                              </div>
                              {!compact && (
                                <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{deposit.profiles?.phone ?? '—'}</div>
                              )}
                            </div>
                          </Td>
                          <Td align="right">
                            <Amount value={formatXAF(deposit.amount_xaf)} size="md" className="!text-[15px]" />
                          </Td>
                          {!compact && (
                            <Td>
                              <div className="flex items-center gap-2">
                                <MIcon family={family} size={28} />
                                <span className={cn('text-[12px]', TEXT.muted)}>
                                  {DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method}
                                </span>
                              </div>
                            </Td>
                          )}
                          <Td>
                            <Age date={deposit.created_at} level={slaLevel} relOnly={compact} />
                          </Td>
                          <Td last={compact}>
                            <StatusPill tone={depositStatusTone(deposit.status)} label={DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status} />
                          </Td>
                          {!compact && (
                            <Td last align="right">
                              {actionable ? (
                                <span
                                  className="inline-flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/m/deposits/${deposit.id}?action=validate`)}
                                    className={cn('px-3 py-1.5 text-[12px]', EMERALD_PILL)}
                                  >
                                    Valider
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/m/deposits/${deposit.id}?action=reject`)}
                                    className={cn('px-3 py-1.5 text-[12px]', DANGER_SOFT_PILL)}
                                  >
                                    Rejeter
                                  </button>
                                </span>
                              ) : (
                                <span className="inline-flex h-8 items-center opacity-0" aria-hidden>
                                  ·
                                </span>
                              )}
                            </Td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={page} pages={pages} rangeLabel={rangeLabel} total={String(total)} onPage={setPage} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Holder icon={FileText} size="lg" />
              <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun dépôt trouvé</p>
              <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                {hasFiltersActive ? 'Essayez de modifier vos filtres' : 'La file est vide — tout est traité'}
              </p>
            </div>
          )}
        </Card>

        {depositId && <DesktopDepositPanel key={depositId} depositId={depositId} />}
      </div>
    </div>
  );
}
