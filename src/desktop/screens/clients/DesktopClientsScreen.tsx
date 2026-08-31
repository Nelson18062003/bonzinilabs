/**
 * Desktop admin — Clients workbench (archetype surface A, docs/admin-redesign).
 *
 * Remplace la première table : recherche instantanée côté client (accents,
 * prénom+nom, téléphone chiffres-à-chiffres, e-mail, entreprise — voir
 * src/lib/clientSearch.ts), chips de statut avec compteurs, filtre de solde,
 * tri par en-têtes de colonnes ET menu « Trier » (Nom A→Z / Z→A, solde,
 * ancienneté), pagination numérotée. La sélection d'une ligne ouvre le
 * panneau desktop DesktopClientPanel (la fiche mobile n'est plus écrasée
 * dans l'aside) ; la liste reste vivante.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, User } from 'lucide-react';
import { useClients } from '@/hooks/useClientManagement';
import { matchesClientSearch, compareClients, type ClientSortField } from '@/lib/clientSearch';
import { formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  clientStatusTone,
  Avatar,
  StatusPill,
  Holder,
  ScreenLoader,
  Card,
  Amount,
  Chip,
  DropChip,
  SearchField,
  CardHeader,
  Th,
  Td,
  PaginationBar,
  Age,
} from '@/desktop/designKit';
import type { ClientStatus } from '@/types/admin';
import { DesktopClientPanel } from './DesktopClientPanel';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SUSPENDED: 'Suspendu',
  PENDING_KYC: 'KYC',
};

const VIEW_TITLE: Record<ClientStatus, string> = {
  ACTIVE: 'Clients actifs',
  INACTIVE: 'Clients inactifs',
  SUSPENDED: 'Clients suspendus',
  PENDING_KYC: 'Clients en attente KYC',
};

const BALANCE_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'positive', label: 'Avec solde' },
  { value: 'zero', label: 'Solde nul' },
] as const;
type BalanceFilter = (typeof BALANCE_OPTIONS)[number]['value'];

// Tri : les en-têtes de colonnes et le menu « Trier » pilotent le même état.
type SortKey = `${ClientSortField}-${'asc' | 'desc'}`;
const SORT_LABELS: Record<SortKey, string> = {
  'name-asc': 'Nom A → Z',
  'name-desc': 'Nom Z → A',
  'balance-desc': 'Solde décroissant',
  'balance-asc': 'Solde croissant',
  'deposits-desc': 'Dépôts décroissants',
  'deposits-asc': 'Dépôts croissants',
  'payments-desc': 'Paiements décroissants',
  'payments-asc': 'Paiements croissants',
  'created-desc': 'Plus récents',
  'created-asc': 'Plus anciens',
};
const BASE_SORT_KEYS: SortKey[] = [
  'name-asc',
  'name-desc',
  'balance-desc',
  'balance-asc',
  'created-desc',
  'created-asc',
];

export function DesktopClientsScreen() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const compact = !!clientId;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [sortField, setSortField] = useState<ClientSortField>('created');
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);

  const { data: clients, isLoading } = useClients();

  // Compteurs par statut — sur le roster complet, indépendants de la recherche.
  const statusCounts = useMemo(() => {
    const counts: Record<ClientStatus, number> = { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0, PENDING_KYC: 0 };
    for (const c of clients ?? []) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    let list = clients ?? [];
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    if (balanceFilter === 'positive') list = list.filter((c) => (c.walletBalance || 0) > 0);
    if (balanceFilter === 'zero') list = list.filter((c) => (c.walletBalance || 0) === 0);
    const q = searchQuery.trim();
    if (q) list = list.filter((c) => matchesClientSearch(c, q));
    return [...list].sort(compareClients(sortField, sortAscending));
  }, [clients, statusFilter, balanceFilter, searchQuery, sortField, sortAscending]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, balanceFilter, searchQuery, sortField, sortAscending]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeLabel = total === 0 ? '0' : `${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + paged.length}`;

  const toggleSort = (field: ClientSortField) => {
    if (sortField === field) setSortAscending((v) => !v);
    else {
      setSortField(field);
      // Premier clic : l'ordre attendu du champ (nom A→Z, montants décroissants).
      setSortAscending(field === 'name');
    }
  };
  const sortedMark = (field: ClientSortField) => (sortField === field ? (sortAscending ? 'asc' : 'desc') : null);

  const sortKey: SortKey = `${sortField}-${sortAscending ? 'asc' : 'desc'}`;
  const sortOptions = useMemo(() => {
    const keys = BASE_SORT_KEYS.includes(sortKey) ? BASE_SORT_KEYS : [...BASE_SORT_KEYS, sortKey];
    return keys.map((k) => ({ value: k, label: SORT_LABELS[k] }));
  }, [sortKey]);

  const hasFiltersActive = statusFilter !== 'all' || balanceFilter !== 'all' || !!searchQuery.trim();

  return (
    <div className={cn('flex flex-col', compact ? 'h-[calc(100vh-120px)] min-h-[560px]' : 'min-h-[calc(100vh-120px)]')}>
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Clients</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {clients ? (
              <>
                {clients.length} client{clients.length > 1 ? 's' : ''} ·{' '}
                <span className="font-bold text-[#2E7D52] dark:text-[#7FCBA0]">{statusCounts.ACTIVE} actifs</span>
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/m/clients/new')}
          className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
        >
          <Plus className="h-4 w-4" /> Nouveau client
        </button>
      </header>

      {/* ── Barre d'outils — UNE ligne, hauteur 36px ────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="Tous" count={clients?.length ?? null} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <Chip label="Actifs" count={statusCounts.ACTIVE || null} active={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')} />
          <Chip label="Inactifs" count={statusCounts.INACTIVE || null} active={statusFilter === 'INACTIVE'} onClick={() => setStatusFilter('INACTIVE')} />
          <Chip label="Suspendus" count={statusCounts.SUSPENDED || null} active={statusFilter === 'SUSPENDED'} onClick={() => setStatusFilter('SUSPENDED')} />
          <Chip label="KYC" count={statusCounts.PENDING_KYC || null} active={statusFilter === 'PENDING_KYC'} onClick={() => setStatusFilter('PENDING_KYC')} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={compact ? 'Rechercher…' : 'Nom, téléphone, e-mail, entreprise…'}
            className={compact ? 'w-[200px]' : 'w-[300px]'}
          />
          <DropChip label="Solde" value={balanceFilter} options={BALANCE_OPTIONS} onChange={setBalanceFilter} />
          <DropChip
            label="Trier"
            value={sortKey}
            options={sortOptions}
            onChange={(k) => {
              const [field, dir] = k.split('-') as [ClientSortField, 'asc' | 'desc'];
              setSortField(field);
              setSortAscending(dir === 'asc');
            }}
          />
        </div>
      </section>

      {/* ── Table + panneau ─────────────────────────────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-5">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CardHeader
            title={statusFilter === 'all' ? 'Tous les clients' : VIEW_TITLE[statusFilter]}
            meta={`${total} résultat${total > 1 ? 's' : ''} · ${SORT_LABELS[sortKey]}`}
          />
          {isLoading ? (
            <ScreenLoader />
          ) : paged.length > 0 ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
                    <tr>
                      <Th first sortable sorted={sortedMark('name')} onSort={() => toggleSort('name')}>
                        Client
                      </Th>
                      {!compact && <Th>Contact</Th>}
                      <Th align="right" sortable sorted={sortedMark('balance')} onSort={() => toggleSort('balance')}>
                        Solde XAF
                      </Th>
                      {!compact && (
                        <Th align="right" sortable sorted={sortedMark('deposits')} onSort={() => toggleSort('deposits')}>
                          Dépôts
                        </Th>
                      )}
                      {!compact && (
                        <Th align="right" sortable sorted={sortedMark('payments')} onSort={() => toggleSort('payments')}>
                          Paiements
                        </Th>
                      )}
                      <Th last sortable sorted={sortedMark('created')} onSort={() => toggleSort('created')}>
                        Depuis
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((client) => {
                      const name = `${client.firstName} ${client.lastName}`.trim() || '?';
                      const open = () => navigate(`/m/clients/${client.id}`);
                      return (
                        <tr
                          key={client.id}
                          onClick={open}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              open();
                            }
                          }}
                          className={cn(
                            'cursor-pointer outline-none transition',
                            clientId === client.id
                              ? 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]'
                              : 'hover:bg-[#EDEAFA]/40 focus-visible:bg-[#EDEAFA]/60 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]',
                          )}
                        >
                          <Td first>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name} size="sm" />
                              <div className="min-w-0 leading-[16px]">
                                <div className="flex items-center gap-2">
                                  <span className={cn('truncate text-[13px] font-semibold', TEXT.strong, compact && 'max-w-[150px]')}>
                                    {name}
                                  </span>
                                  <StatusPill tone={clientStatusTone(client.status)} label={STATUS_LABEL[client.status] ?? client.status} />
                                </div>
                                {!compact && client.companyName && (
                                  <div className={cn('truncate text-[11px]', TEXT.muted)}>{client.companyName}</div>
                                )}
                              </div>
                            </div>
                          </Td>
                          {!compact && (
                            <Td>
                              <div className="leading-[16px]">
                                <div className={cn('text-[12px] tabular-nums', TEXT.muted)}>{client.phone || '—'}</div>
                                {client.email && <div className={cn('max-w-[200px] truncate text-[11px]', TEXT.muted)}>{client.email}</div>}
                              </div>
                            </Td>
                          )}
                          <Td align="right">
                            <Amount value={formatXAF(client.walletBalance || 0)} size="md" className="!text-[15px]" />
                          </Td>
                          {!compact && (
                            <Td align="right" className={cn('text-[13px] tabular-nums', TEXT.muted)}>
                              {formatXAF(client.totalDeposits || 0)}
                            </Td>
                          )}
                          {!compact && (
                            <Td align="right" className={cn('text-[13px] tabular-nums', TEXT.muted)}>
                              {formatXAF(client.totalPayments || 0)}
                            </Td>
                          )}
                          <Td last>
                            <Age date={client.createdAt} relOnly={compact} />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={safePage} pages={pages} rangeLabel={rangeLabel} total={String(total)} onPage={setPage} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Holder icon={User} size="lg" />
              <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
                {hasFiltersActive ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
              </p>
              {hasFiltersActive ? (
                <p className={cn('mt-1 text-[12px]', TEXT.muted)}>Essayez de modifier votre recherche ou vos filtres</p>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/m/clients/new')}
                  className={cn('mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
                >
                  <Plus className="h-4 w-4" /> Créer un client
                </button>
              )}
            </div>
          )}
        </Card>

        {clientId && <DesktopClientPanel key={clientId} clientId={clientId} />}
      </div>
    </div>
  );
}
