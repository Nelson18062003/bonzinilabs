/**
 * Clients — the customer base as a workbench.
 *
 * Adds what the old table lacked on desktop: a portfolio summary (how much of
 * our clients' money we are holding, how concentrated it is), sortable money
 * columns, and the client file opening in the inspector so an operator can walk
 * a list of accounts without losing their place.
 *
 * Data layer unchanged (`useClients`), shared with MobileClientsScreen.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw, Search, Users, Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF } from '@/lib/formatters';
import { clientStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileClientDetail } from '@/mobile/screens/clients';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, IconButton, Input, Metric } from '@/desktop/ui/primitives';
import { DataTable, type Column, type SortState } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';
import type { ClientStatus } from '@/types/admin';

const STATUS_FILTERS: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'INACTIVE', label: 'Inactifs' },
  { value: 'SUSPENDED', label: 'Suspendus' },
  { value: 'PENDING_KYC', label: 'KYC' },
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
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
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

  /* Portfolio context: what we hold and how concentrated it is. Neither number
     existed on desktop before, and both change how you read the list. */
  const portfolio = useMemo(() => {
    const total = rows.reduce((s, c) => s + (c.walletBalance || 0), 0);
    const withBalance = rows.filter((c) => (c.walletBalance || 0) > 0).length;
    /* Below six clients the "top 5" is everyone, so the share is always 100 %
       and says nothing — show it only when it can carry information. */
    if (rows.length <= 5 || total <= 0) return { total, topShare: null as number | null, withBalance };
    const top = [...rows].sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0)).slice(0, 5);
    const topShare = Math.round((top.reduce((s, c) => s + (c.walletBalance || 0), 0) / total) * 100);
    return { total, topShare, withBalance };
  }, [rows]);

  if (!hasPermission('canViewClients')) return <Navigate to="/m" replace />;

  const hasFilters = statusFilter !== 'all' || !!debouncedSearch;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Client',
      width: '26%',
      sortable: true,
      cell: (c) => {
        const name = `${c.firstName} ${c.lastName}`.trim();
        return (
          <span className="flex items-center gap-2.5">
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
      sortable: true,
      cell: (c) => <Figure value={formatXAF(c.walletBalance || 0)} unit="XAF" className={c.walletBalance ? undefined : DFG.muted} />,
    },
    {
      key: 'deposits',
      header: 'Dépôts cumulés (XAF)',
      align: 'right',
      width: '150px',
      sortable: true,
      cell: (c) => <span className={cn('tabular-nums', DFG.muted)}>{formatXAF(c.totalDeposits || 0)}</span>,
    },
    {
      key: 'payments',
      header: 'Paiements cumulés (XAF)',
      align: 'right',
      width: '160px',
      sortable: true,
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

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('clients', { defaultValue: 'Clients' })}
          subtitle={`${rows.length} client${rows.length > 1 ? 's' : ''} · ${portfolio.withBalance} avec un solde actif`}
          actions={
            <>
              <IconButton icon={RefreshCw} label="Actualiser" loading={isFetching} onClick={() => refetch()} />
              {hasPermission('canEditClients') && (
                <Button variant="primary" icon={Plus} onClick={() => navigate('/m/clients/new')}>
                  Nouveau client
                </Button>
              )}
            </>
          }
        />
      }
      metrics={
        <div className="grid grid-cols-3 gap-2.5">
          <Metric icon={Wallet} tone="info" label="Encours affiché" value={formatXAF(portfolio.total)} unit="XAF" hint="Somme des soldes des clients listés (200 max par requête)" />
          <Metric icon={Users} tone="neutral" label="Clients listés" value={rows.length} hint="Après filtres et recherche" />
          <Metric
            label="Part des 5 plus gros soldes"
            value={portfolio.topShare === null ? '—' : `${portfolio.topShare} %`}
            tone="pending"
            hint={portfolio.topShare === null ? 'Disponible à partir de 6 clients listés' : "Part de l'encours affiché détenue par les 5 plus gros soldes"}
          />
        </div>
      }
      toolbar={
        <Toolbar
          trailing={
            hasFilters ? (
              <Button size="sm" variant="ghost" icon={X} onClick={() => { setStatusFilter('all'); setSearch(''); }}>
                Réinitialiser
              </Button>
            ) : undefined
          }
        >
          <div className="relative mr-1 w-72">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.faint)} />
            <Input
              type="search"
              aria-label="Rechercher un client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou téléphone…"
              className="pl-8"
            />
          </div>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </Toolbar>
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
                hasPermission('canEditClients') ? (
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
