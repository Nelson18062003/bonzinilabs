/**
 * Clients — the customer base as a workbench.
 *
 * The screen an operator lives in: they arrive by name, so the toolbar is a
 * search field first and everything else folded behind one filter trigger. The
 * client file opens in the inspector, so walking a list of accounts never costs
 * the scroll position.
 *
 * One number, one home. `rows.length` used to be printed three times on this
 * page (subtitle, a "Clients listés" tile, the table footer); it now lives only
 * in the footer, next to the 200-row query ceiling that explains it.
 *
 * Data layer unchanged (`useClients`), shared with MobileClientsScreen.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF } from '@/lib/formatters';
import { clientStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileClientDetail } from '@/mobile/screens/clients';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, EmptyState, Figure, Metric, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, MenuButton, type FilterOption } from '@/desktop/ui/Popover';
import { DataTable, type Column, type SortState } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';
import type { ClientStatus } from '@/types/admin';

type StatusFilter = ClientStatus | 'all';

/** `all` first: `FilterPopover` treats the first option as the neutral value. */
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'INACTIVE', label: 'Inactifs' },
  { value: 'SUSPENDED', label: 'Suspendus' },
  { value: 'PENDING_KYC', label: 'KYC en attente' },
];

const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SUSPENDED: 'Suspendu',
  PENDING_KYC: 'KYC',
};

/** French names sort by accent-insensitive collation, not UTF-16 code points. */
const COLLATOR = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function DesktopClientsScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { clientId } = useParams<{ clientId: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  /* `useClients` ignores a `status` filter but still keys the cache on it, so
     passing one only bought an extra 200-row round-trip per chip click. The
     filtering below is the real one. */
  const { data: clients, isLoading, isError, isFetching, refetch } = useClients({
    search: debouncedSearch || undefined,
  });

  const rows = useMemo(() => {
    let list = (clients ?? []).filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter));
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (sort.key === 'name') {
          return COLLATOR.compare(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`) * dir;
        }
        const pick = (c: (typeof list)[number]) =>
          sort.key === 'balance' ? c.walletBalance
          : sort.key === 'deposits' ? c.totalDeposits
          : c.totalPayments;
        return (pick(a) - pick(b)) * dir;
      });
    }
    return list;
  }, [clients, statusFilter, sort]);

  /**
   * Counts for the statut axis, over the set that axis selects from — `clients`
   * (the search result), *before* the statut filter narrows it. Deliberately
   * NOT `rows`: a count narrowed by its own axis would report the selection
   * back to itself, so every option but the selected one would read 0.
   *
   * The rule this follows is written out in full in DesktopAdminsScreen, which
   * has two axes to keep consistent. Short form: the number beside an option is
   * a promise about what clicking it returns, in every filter state.
   *
   * The chips here carried no counts at all while Dépôts and Paiements carried
   * them; folding the axis into the popover is where that information returns.
   */
  const statusCounts = useMemo(() => {
    const pool = clients ?? [];
    const map = new Map<StatusFilter, number>([['all', pool.length]]);
    for (const c of pool) map.set(c.status, (map.get(c.status) ?? 0) + 1);
    return map;
  }, [clients]);

  /* Portfolio context: how much of our clients' money the listed set holds.
     The concentration ratio that used to sit beside it was analytics, not an
     operational number, and belongs on the analytics screen. */
  const heldTotal = useMemo(() => rows.reduce((s, c) => s + (c.walletBalance || 0), 0), [rows]);

  if (!hasPermission('canViewClients')) return <Navigate to="/m" replace />;

  /* Raw `search`, not the debounced value: a control must not disappear from
     under the cursor during the debounce window. */
  const hasFilters = statusFilter !== 'all' || search.trim() !== '';
  /* An empty roster with no filter applied has nothing to filter or summarise.
     Held through the loading pass too, so the tile never flashes "0 XAF". */
  const showStrip = rows.length > 0 || hasFilters;
  /* Sorting three ways through a single row is theatre — and a live control
     that cannot change anything. */
  const canSort = rows.length > 1;
  const canCreate = hasPermission('canEditClients');
  /* The EmptyState already offers `Nouveau client`; two identical primaries on
     one screen is the operator asking which one is the real one. */
  const emptyOffersCreate = !isLoading && !isError && rows.length === 0 && canCreate;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Client',
      width: '26%',
      sortable: canSort,
      cell: (c) => {
        const name = `${c.firstName} ${c.lastName}`.trim();
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} />
            <span className={cn('min-w-0 truncate font-semibold', DFG.strong)}>{name || '—'}</span>
          </span>
        );
      },
    },
    {
      key: 'phone',
      header: 'Téléphone',
      width: '190px',
      cell: (c) => <span className={cn('whitespace-nowrap tabular-nums', DFG.muted)}>{c.phone || '—'}</span>,
    },
    {
      key: 'balance',
      header: 'Solde',
      align: 'right',
      width: '150px',
      sortable: canSort,
      cell: (c) => <Figure value={formatXAF(c.walletBalance || 0)} unit="XAF" className={c.walletBalance ? undefined : DFG.muted} />,
    },
    {
      key: 'deposits',
      header: 'Dépôts cumulés (XAF)',
      align: 'right',
      width: '150px',
      sortable: canSort,
      cell: (c) => <span className={cn('tabular-nums', DFG.muted)}>{formatXAF(c.totalDeposits || 0)}</span>,
    },
    {
      key: 'payments',
      header: 'Paiements cumulés (XAF)',
      align: 'right',
      width: '160px',
      sortable: canSort,
      cell: (c) => <span className={cn('tabular-nums', DFG.muted)}>{formatXAF(c.totalPayments || 0)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '110px',
      cell: (c) => <Badge tone={clientStatusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>,
    },
  ];

  const statusOptions: FilterOption<string>[] = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    meta: statusCounts.get(f.value) ?? 0,
    disabled: f.value !== 'all' && f.value !== statusFilter && (statusCounts.get(f.value) ?? 0) === 0,
  }));

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('clients', { defaultValue: 'Clients' })}
          subtitle="Soldes et cumuls par compte client"
          actions={
            <>
              <MenuButton
                items={[
                  {
                    label: 'Actualiser',
                    icon: RefreshCw,
                    onSelect: () => void refetch(),
                    disabled: isFetching,
                    hint: 'Actualisation déjà en cours',
                  },
                ]}
              />
              {canCreate && !emptyOffersCreate && (
                <Button variant="primary" icon={Plus} onClick={() => navigate('/m/clients/new')}>
                  Nouveau client
                </Button>
              )}
            </>
          }
        />
      }
      metrics={
        showStrip ? (
          <Metric
            icon={Wallet}
            tone="info"
            label="Encours affiché"
            value={formatXAF(heldTotal)}
            unit="XAF"
            hint="Somme des soldes des clients listés"
            className="max-w-xs"
          />
        ) : undefined
      }
      toolbar={
        showStrip ? (
          <Toolbar>
            <SearchField
              aria-label="Rechercher un client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou téléphone…"
              width={288}
            />
            <FilterPopover
              axes={[
                {
                  id: 'status',
                  label: 'Statut',
                  value: statusFilter,
                  onChange: (v) => setStatusFilter(v as StatusFilter),
                  options: statusOptions,
                  neutral: 'all',
                },
              ]}
              /* Raw `search`, like `hasFilters`: the reset has to be offered on
                 the keystroke, not one debounce later. The popover owns only the
                 statut axis, so without this a list narrowed by name alone would
                 have no single reset. */
              clearable={!!search}
              onClear={() => {
                setStatusFilter('all');
                setSearch('');
              }}
            />
          </Toolbar>
        ) : undefined
      }
      inspector={clientId ? <MobileClientDetail /> : null}
      onCloseInspector={() => navigate('/m/clients')}
    >
      <DataTable
        label="Liste des clients"
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        activeId={clientId ?? null}
        onRowClick={(c) => navigate(`/m/clients/${c.id}`)}
        sort={sort}
        onSortChange={setSort}
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les clients"
              hint="La requête a échoué — la liste n'est pas vide, elle n'a pas pu être lue."
              action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Aucun client trouvé"
              hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : 'Créez un premier client pour démarrer.'}
              action={
                canCreate ? (
                  <Button variant="primary" icon={Plus} onClick={() => navigate('/m/clients/new')}>Nouveau client</Button>
                ) : undefined
              }
            />
          )
        }
        footer={<p className={cn(DT.label, DFG.muted, 'text-center')}>{rows.length} client{rows.length > 1 ? 's' : ''} affiché{rows.length > 1 ? 's' : ''} · 200 max par requête</p>}
      />
    </Workbench>
  );
}
