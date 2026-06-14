/**
 * Desktop admin — clients as a data table.
 *
 * Same data layer as MobileClientsScreen (useClients with search + status),
 * presented as a wide table: client, status, phone, wallet balance and totals,
 * with a row → detail. Search + status filter chips in a toolbar.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, User, X } from 'lucide-react';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCurrency, formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  clientStatusTone,
  Avatar,
  StatusPill,
  TextInput,
  Holder,
  ScreenLoader,
  Card,
} from '@/mobile/designKit';
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
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');

  const { data: clients, isLoading } = useClients({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const filteredClients = clients?.filter((client) =>
    statusFilter === 'all' ? true : client.status === statusFilter,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Clients</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {filteredClients ? `${filteredClients.length} client${filteredClients.length > 1 ? 's' : ''}` : '—'}
          </p>
        </div>
        <button
          onClick={() => navigate('/m/clients/new')}
          className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
        >
          <Plus className="h-4 w-4" /> Nouveau client
        </button>
      </header>

      {/* Toolbar */}
      <section className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-sm">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            placeholder="Rechercher par nom, téléphone…"
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
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors',
                statusFilter === f.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <ScreenLoader />
        ) : filteredClients && filteredClients.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                <th className="px-5 py-3 font-bold">Client</th>
                <th className="px-2 py-3 font-bold">Téléphone</th>
                <th className="px-2 py-3 text-right font-bold">Solde XAF</th>
                <th className="px-2 py-3 text-right font-bold">Dépôts</th>
                <th className="px-5 py-3 text-right font-bold">Paiements</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const name = `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || '?';
                return (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/m/clients/${client.id}`)}
                    className="cursor-pointer border-t border-black/[0.05] transition hover:bg-[#EDEAFA]/40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                            <StatusPill tone={clientStatusTone(client.status)} label={STATUS_LABEL[client.status] ?? client.status} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cn('px-2 py-3 text-[13px]', TEXT.muted)}>{client.phone || '—'}</td>
                    <td className={cn('px-2 py-3 text-right text-[14px] font-bold tabular-nums', TEXT.strong)}>
                      {formatXAF(client.walletBalance || 0)}
                    </td>
                    <td className={cn('px-2 py-3 text-right text-[13px] tabular-nums', TEXT.muted)}>
                      {formatCurrency(client.totalDeposits || 0)}
                    </td>
                    <td className={cn('px-5 py-3 text-right text-[13px] tabular-nums', TEXT.muted)}>
                      {formatCurrency(client.totalPayments || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={User} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
              {searchQuery || statusFilter !== 'all' ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
            </p>
            <button
              onClick={() => navigate('/m/clients/new')}
              className={cn('mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
            >
              <Plus className="h-4 w-4" /> Créer un client
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
