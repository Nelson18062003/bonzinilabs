import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, Plus, User } from 'lucide-react';
import { SkeletonClientItem } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { formatCurrency, formatXAF } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ClientStatus } from '@/types/admin';

// Filter labels are static since they're defined outside the component.
// For i18n, we re-create them inside the component.
const STATUS_FILTER_KEYS: { value: ClientStatus | 'all'; labelKey: string; defaultLabel: string }[] = [
  { value: 'all', labelKey: 'all', defaultLabel: 'Tous' },
  { value: 'ACTIVE', labelKey: 'activeUsers', defaultLabel: 'Actifs' },
  { value: 'INACTIVE', labelKey: 'inactiveUsers', defaultLabel: 'Inactifs' },
  { value: 'SUSPENDED', labelKey: 'suspended', defaultLabel: 'Suspendus' },
  { value: 'PENDING_KYC', labelKey: 'kyc', defaultLabel: 'KYC' },
];

const STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400',
  INACTIVE: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  SUSPENDED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  PENDING_KYC: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function MobileClientsScreen() {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const navigate = useNavigate();

  const STATUS_FILTERS = STATUS_FILTER_KEYS.map(f => ({ value: f.value, label: t(f.labelKey, { defaultValue: f.defaultLabel }) }));

  const { data: clients, isLoading, refetch } = useClients({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Apply status filter client-side (since useClients may not fully support it yet)
  const filteredClients = clients?.filter(client => {
    if (statusFilter === 'all') return true;
    return client.status === statusFilter;
  });

  return (
    <div className="flex flex-col min-h-full pb-20">
      <MobileHeader title={t('clients', { defaultValue: 'Clients' })} />

      <PullToRefresh onRefresh={refetch} className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchByNamePhone', { defaultValue: 'Rechercher par nom, téléphone...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Status Filter Chips */}
        <MobileFilterChips
          filters={STATUS_FILTERS}
          activeKey={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Clients List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonClientItem key={i} />
            ))}
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => navigate(`/m/clients/${client.id}`)}
                className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm sm:text-base font-medium text-primary flex-shrink-0">
                    {client.firstName?.[0] || '?'}
                    {client.lastName?.[0] || ''}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {client.firstName} {client.lastName}
                      </p>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        STATUS_BADGE_STYLES[client.status]
                      )}>
                        {client.status === 'ACTIVE' ? 'Actif' :
                         client.status === 'INACTIVE' ? 'Inactif' :
                         client.status === 'SUSPENDED' ? 'Suspendu' : 'KYC'}
                      </span>
                    </div>
                    {client.phone && (
                      <p className="text-sm text-muted-foreground truncate">
                        {client.phone}
                      </p>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-primary">
                      {formatXAF(client.walletBalance || 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">XAF</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>Dépôts: {formatCurrency(client.totalDeposits || 0)}</span>
                  <span>Paiements: {formatCurrency(client.totalPayments || 0)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <MobileEmptyState
            icon={User}
            title={searchQuery ? 'Aucun client trouvé' : 'Aucun client pour le moment'}
            action={{ label: 'Créer un client', onClick: () => navigate('/m/clients/new') }}
          />
        )}
      </PullToRefresh>

      {/* FAB - Create Client */}
      <button
        onClick={() => navigate('/m/clients/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
