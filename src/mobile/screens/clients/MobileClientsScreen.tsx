import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClients } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, Plus, User } from 'lucide-react';
import { SkeletonClientItem } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { formatCurrency, formatXAF } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
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
  PrimaryPill,
} from '@/mobile/designKit';
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
    <div className="flex min-h-full flex-col pb-20">
      <MobileHeader title={t('clients', { defaultValue: 'Clients' })} />

      <PullToRefresh
        onRefresh={refetch}
        className={cn('flex-1 space-y-4 overflow-y-auto px-4 py-5', SURFACE.canvas)}
      >
        {/* Search */}
        <div className="relative">
          <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            type="text"
            placeholder={t('searchByNamePhone', { defaultValue: 'Rechercher par nom, téléphone...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                statusFilter === filter.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Clients List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonClientItem key={i} />
            ))}
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="space-y-3">
            {filteredClients.map((client) => {
              const name = `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || '?';
              return (
                <button
                  key={client.id}
                  onClick={() => navigate(`/m/clients/${client.id}`)}
                  className={cn(
                    'w-full rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                          {client.firstName} {client.lastName}
                        </p>
                        <StatusPill
                          tone={clientStatusTone(client.status)}
                          label={client.status === 'ACTIVE' ? t('active', { defaultValue: 'Actif' }) :
                            client.status === 'INACTIVE' ? t('inactive', { defaultValue: 'Inactif' }) :
                            client.status === 'SUSPENDED' ? t('suspendedStatus', { defaultValue: 'Suspendu' }) : 'KYC'}
                        />
                      </div>
                      {client.phone && (
                        <p className={cn('truncate text-[13px]', TEXT.muted)}>{client.phone}</p>
                      )}
                    </div>

                    {/* Balance */}
                    <div className="shrink-0 text-right">
                      <p className={cn('text-[15px] font-bold tabular-nums', TEXT.strong)}>
                        {formatXAF(client.walletBalance || 0)}
                      </p>
                      <p className={cn('text-[10px]', TEXT.muted)}>XAF</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className={cn('mt-3 flex items-center gap-4 text-[12px]', TEXT.muted)}>
                    <span>{t('deposits', { defaultValue: 'Dépôts' })}: {formatCurrency(client.totalDeposits || 0)}</span>
                    <span>{t('payments', { defaultValue: 'Paiements' })}: {formatCurrency(client.totalPayments || 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Holder icon={User} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
              {searchQuery ? t('noClientFound', { defaultValue: 'Aucun client trouvé' }) : t('noClientsYet', { defaultValue: 'Aucun client pour le moment' })}
            </p>
            <PrimaryPill onClick={() => navigate('/m/clients/new')} className="mt-4">
              {t('createClient', { defaultValue: 'Créer un client' })}
            </PrimaryPill>
          </div>
        )}
      </PullToRefresh>

      {/* FAB - Create Client */}
      <button
        onClick={() => navigate('/m/clients/new')}
        className={cn(
          'fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
          PRIMARY_PILL,
        )}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
