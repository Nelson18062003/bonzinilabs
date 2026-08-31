import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClients } from '@/hooks/useClientManagement';
import { matchesClientSearch, compareClients, type ClientSortField } from '@/lib/clientSearch';
import { Search, Plus, User, ArrowUpDown, Check } from 'lucide-react';
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
  BottomSheet,
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

// Tri : mêmes options que le menu « Trier » desktop.
type SortKey = 'name-asc' | 'name-desc' | 'balance-desc' | 'balance-asc' | 'created-desc' | 'created-asc';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created-desc', label: 'Plus récents' },
  { value: 'created-asc', label: 'Plus anciens' },
  { value: 'name-asc', label: 'Nom A → Z' },
  { value: 'name-desc', label: 'Nom Z → A' },
  { value: 'balance-desc', label: 'Solde décroissant' },
  { value: 'balance-asc', label: 'Solde croissant' },
];

export function MobileClientsScreen() {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created-desc');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const navigate = useNavigate();

  const STATUS_FILTERS = STATUS_FILTER_KEYS.map(f => ({ value: f.value, label: t(f.labelKey, { defaultValue: f.defaultLabel }) }));

  const { data: clients, isLoading, refetch } = useClients();

  // Recherche + filtre + tri côté client (voir src/lib/clientSearch.ts) :
  // instantané, insensible aux accents, prénom+nom, téléphone, e-mail.
  const filteredClients = useMemo(() => {
    let list = clients ?? [];
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    const q = searchQuery.trim();
    if (q) list = list.filter((c) => matchesClientSearch(c, q));
    const [field, dir] = sortKey.split('-') as [ClientSortField, 'asc' | 'desc'];
    return [...list].sort(compareClients(field, dir === 'asc'));
  }, [clients, statusFilter, searchQuery, sortKey]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? '';

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

        {/* Status Filter Chips + tri */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => setSortSheetOpen(true)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
              sortKey !== 'created-desc' ? PRIMARY_PILL : SOFT_PILL,
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabel}
          </button>
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
        ) : filteredClients.length > 0 ? (
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

      {/* Sort sheet */}
      <BottomSheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-[#6B5BD2] dark:text-[#A99BF0]" />
            {t('sortBy', { defaultValue: 'Trier par' })}
          </span>
        }
      >
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSortKey(opt.value);
                setSortSheetOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-[15px] font-semibold transition',
                sortKey === opt.value ? cn('bg-[#EDEAFA]/70 dark:bg-white/[0.06]', TEXT.strong) : TEXT.strong,
              )}
            >
              {opt.label}
              {sortKey === opt.value && <Check className="h-4 w-4 text-[#6B5BD2] dark:text-[#A99BF0]" />}
            </button>
          ))}
        </div>
      </BottomSheet>

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
