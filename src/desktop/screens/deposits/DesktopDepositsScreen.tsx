/**
 * Dépôts — the validation queue.
 *
 * Rebuilt as a Workbench: the list owns the viewport, the record opens in a
 * docked inspector, and nothing about the operator's position in the queue is
 * lost when they open, act on and close a deposit. Filters collapse into one
 * strip instead of three stacked rows, and the status chips carry their own
 * counts — so the queue state and the way to filter it are a single control
 * rather than a KPI row duplicating the chips underneath it.
 *
 * Data layer is unchanged and still shared with MobileDepositsScreenV2
 * (`@/lib/depositsList`), so mobile and desktop can never disagree on what
 * "à traiter" means.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Paperclip, Plus, Search, X } from 'lucide-react';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatRelativeDate, formatXAF } from '@/lib/formatters';
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
import { depositStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileDepositDetailV2 } from '@/mobile/screens/deposits';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, Input, Ref } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { FilterGroup, ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** Method family glyph — the same colour key as the mobile list. */
function MethodGlyph({ family }: { family: string }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
      style={{ background: f.bg, color: f.dark ? '#1a1028' : '#fff' }}
    >
      {f.letter}
    </span>
  );
}

/** Ageing indicator: green under SLA, amber approaching, red past. */
function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      title={level === 'fresh' ? 'Dans les délais' : level === 'aging' ? 'Bientôt hors délai' : 'Hors délai'}
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color, animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined }}
    />
  );
}

const STATUS_CHIPS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: 'Tous' },
  { k: 'to_process', l: 'À traiter' },
  { k: 'pending_correction', l: 'À corriger' },
  { k: 'validated', l: 'Validés' },
  { k: 'rejected', l: 'Rejetés' },
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
  { k: 'all', l: 'Tout' },
  { k: 'today', l: "Auj." },
  { k: 'yesterday', l: 'Hier' },
  { k: 'week', l: 'Semaine' },
  { k: 'month', l: 'Mois' },
  { k: 'custom', l: 'Période…' },
];

export function DesktopDepositsScreen() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();

  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data: stats } = useDepositStats();

  const { dateFrom, dateTo } = useMemo(
    () => (periodPreset === 'custom' ? { dateFrom: customFrom, dateTo: customTo } : getPeriodDates(periodPreset)),
    [periodPreset, customFrom, customTo],
  );

  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const p: DepositFilters = {};
    if (statusFilter === 'to_process') p.statuses = TO_PROCESS_STATUSES as string[];
    else if (statusFilter !== 'all') p.status = statusFilter;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    p.sortField = 'created_at';
    p.sortAscending = false;
    return p.status || p.statuses || p.dateFrom || p.dateTo ? p : undefined;
  }, [statusFilter, dateFrom, dateTo]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedAdminDeposits(filterParams);
  const loadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const rows = useMemo(() => {
    let list = data?.pages.flatMap((p) => p.data) ?? [];
    if (familyFilter !== 'all') {
      const methods = FAMILY_TO_METHODS[familyFilter] || [];
      list = list.filter((d) => methods.includes(d.method));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((d) => {
        const name = `${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.toLowerCase();
        return name.includes(q) || d.reference?.toLowerCase().includes(q) || d.profiles?.phone?.includes(q);
      });
    }
    return list;
  }, [data, familyFilter, debouncedSearch]);

  const countFor = (k: FilterKey): number => {
    switch (k) {
      case 'all': return stats?.total ?? 0;
      case 'to_process': return stats?.to_process ?? 0;
      case 'pending_correction': return stats?.pending_correction ?? 0;
      case 'validated': return stats?.validated ?? 0;
      case 'rejected': return stats?.rejected ?? 0;
      default: return 0;
    }
  };

  const hasFilters = statusFilter !== 'all' || familyFilter !== 'all' || periodPreset !== 'all' || !!debouncedSearch;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'reference',
      header: 'Référence',
      width: '150px',
      cell: (d) => <Ref>{d.reference}</Ref>,
    },
    {
      key: 'client',
      header: 'Client',
      cell: (d) => {
        const name = d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Client inconnu';
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className={cn('truncate font-semibold', DFG.strong)}>{name}</span>
            {d.proof_count ? (
              <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[10.5px]', DFG.faint)}>
                <Paperclip className="h-3 w-3" />
                {d.proof_count}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      width: '140px',
      cell: (d) => <Figure value={formatXAF(d.amount_xaf)} />,
    },
    {
      key: 'method',
      header: 'Méthode',
      width: '150px',
      cell: (d) => (
        <span className="flex items-center gap-2">
          <MethodGlyph family={getFamilyFromMethod(d.method)} />
          <span className={cn('truncate', DFG.muted)}>{DEPOSIT_METHOD_LABELS_SHORT[d.method] || d.method}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Créé',
      width: '120px',
      cell: (d) => <span className={DFG.muted}>{formatRelativeDate(d.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '150px',
      cell: (d) => {
        const sla = getDepositSlaLevel(d.created_at, d.status);
        return (
          <span className="flex items-center justify-end gap-1.5">
            {sla && <SlaDot level={sla} />}
            <Badge tone={depositStatusTone(d.status)}>{DEPOSIT_STATUS_LABELS[d.status] || d.status}</Badge>
          </span>
        );
      },
    },
  ];

  return (
    <Workbench
      head={
        <>
          <style>{'@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }'}</style>
          <ScreenHead
            title="Dépôts"
            subtitle={`${countFor('all')} dépôts · ${countFor('to_process')} en attente de validation`}
            actions={
              <Button variant="primary" icon={Plus} onClick={() => navigate('/m/deposits/new')}>
                Nouveau dépôt
              </Button>
            }
          />
        </>
      }
      toolbar={
        <Toolbar
          trailing={
            hasFilters ? (
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                onClick={() => {
                  setStatusFilter('all');
                  setFamilyFilter('all');
                  setPeriodPreset('all');
                  setSearch('');
                }}
              >
                Réinitialiser
              </Button>
            ) : undefined
          }
        >
          <div className="relative mr-1 w-64">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.faint)} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, téléphone ou référence…"
              className="pl-8"
            />
          </div>

          {STATUS_CHIPS.map((c) => (
            <Chip key={c.k} active={statusFilter === c.k} count={countFor(c.k)} onClick={() => setStatusFilter(c.k)}>
              {c.l}
            </Chip>
          ))}

          <span className={cn('mx-1 h-4 w-px', DS.line, 'border-l')} />

          <FilterGroup label="Méthode">
            {METHOD_CHIPS.map((m) => (
              <Chip key={m.k} active={familyFilter === m.k} onClick={() => setFamilyFilter(m.k)}>
                {m.l}
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
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[140px]" />
              <span className={DT.label}>→</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[140px]" />
            </span>
          )}
        </Toolbar>
      }
      inspector={depositId ? <MobileDepositDetailV2 /> : null}
    >
      <DataTable
        label="Liste des dépôts"
        rows={rows}
        columns={columns}
        getRowId={(d) => d.id}
        activeId={depositId ?? null}
        onRowClick={(d) => navigate(`/m/deposits/${d.id}`)}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon={FileText}
            title="Aucun dépôt trouvé"
            hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : 'Les dépôts déclarés apparaîtront ici.'}
          />
        }
        footer={
          !debouncedSearch ? (
            <InfiniteScrollTrigger onLoadMore={loadMore} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
          ) : (
            <p className={cn(DT.label, DFG.faint, 'text-center')}>
              {rows.length} résultat{rows.length > 1 ? 's' : ''} dans les pages chargées
            </p>
          )
        }
      />
    </Workbench>
  );
}
