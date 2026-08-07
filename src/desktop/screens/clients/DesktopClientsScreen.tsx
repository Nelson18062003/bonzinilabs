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
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Users, Wallet, X } from 'lucide-react';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF } from '@/lib/formatters';
import { clientStatusTone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileClientDetail } from '@/mobile/screens/clients';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Figure, Input, Metric } from '@/desktop/ui/primitives';
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

export function DesktopClientsScreen() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const { data: clients, isLoading } = useClients({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const rows = useMemo(() => {
    let list = (clients ?? []).filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter));
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const pick = (c: (typeof list)[number]) =>
          sort.key === 'balance' ? c.walletBalance
          : sort.key === 'deposits' ? c.totalDeposits
          : sort.key === 'payments' ? c.totalPayments
          : `${c.firstName} ${c.lastName}`.toLowerCase();
        const av = pick(a);
        const bv = pick(b);
        return av === bv ? 0 : av > bv ? dir : -dir;
      });
    }
    return list;
  }, [clients, statusFilter, sort]);

  /* Portfolio context: what we hold and how concentrated it is. Neither number
     existed on desktop before, and both change how you read the list. */
  const portfolio = useMemo(() => {
    const total = rows.reduce((s, c) => s + (c.walletBalance || 0), 0);
    const top = [...rows].sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0)).slice(0, 5);
    const topShare = total > 0 ? Math.round((top.reduce((s, c) => s + (c.walletBalance || 0), 0) / total) * 100) : 0;
    const withBalance = rows.filter((c) => (c.walletBalance || 0) > 0).length;
    return { total, topShare, withBalance };
  }, [rows]);

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
      cell: (c) => <Figure value={formatXAF(c.walletBalance || 0)} className={c.walletBalance ? undefined : DFG.faint} />,
    },
    {
      key: 'deposits',
      header: 'Dépôts cumulés',
      align: 'right',
      width: '150px',
      sortable: true,
      cell: (c) => <span className={cn('tabular-nums', DFG.muted)}>{formatXAF(c.totalDeposits || 0)}</span>,
    },
    {
      key: 'payments',
      header: 'Paiements cumulés',
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
          title="Clients"
          subtitle={`${rows.length} client${rows.length > 1 ? 's' : ''} · ${portfolio.withBalance} avec un solde actif`}
          actions={
            <Button variant="primary" icon={Plus} onClick={() => navigate('/m/clients/new')}>
              Nouveau client
            </Button>
          }
        />
      }
      metrics={
        <div className="grid grid-cols-3 gap-2.5">
          <Metric icon={Wallet} tone="info" label="Encours total" value={formatXAF(portfolio.total)} hint="Somme des soldes wallet affichés" />
          <Metric icon={Users} tone="neutral" label="Clients listés" value={rows.length} hint="Après filtres et recherche" />
          <Metric label="Concentration top 5" value={`${portfolio.topShare} %`} tone="pending" hint="Part de l'encours détenue par les 5 plus gros soldes" />
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
          <EmptyState
            icon={Users}
            title="Aucun client trouvé"
            hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : 'Créez un premier client pour démarrer.'}
            action={<Button variant="primary" icon={Plus} onClick={() => navigate('/m/clients/new')}>Nouveau client</Button>}
          />
        }
        footer={<p className={cn(DT.label, DFG.faint, 'text-center')}>{rows.length} client{rows.length > 1 ? 's' : ''} affiché{rows.length > 1 ? 's' : ''} · 200 max par requête</p>}
      />
    </Workbench>
  );
}
