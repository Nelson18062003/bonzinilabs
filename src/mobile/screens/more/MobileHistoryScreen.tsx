import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  Search,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Shield,
  History,
} from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  type Tone,
  Card,
  Avatar,
  StatusPill,
  TextInput,
  Holder,
} from '@/mobile/designKit';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
];

export function MobileHistoryScreen() {
  const { t } = useTranslation('common');
  const { data: logs, isLoading, refetch } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.action_type.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (log.adminProfile?.first_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false);
    const matchesType = typeFilter === 'all' || log.target_type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('deposit') || actionType.includes('DEPOSIT')) {
      return <ArrowDownToLine className="h-3 w-3" />;
    }
    if (actionType.includes('payment') || actionType.includes('PAYMENT')) {
      return <ArrowUpFromLine className="h-3 w-3" />;
    }
    if (actionType.includes('rate') || actionType.includes('RATE')) {
      return <TrendingUp className="h-3 w-3" />;
    }
    if (actionType.includes('client') || actionType.includes('CLIENT')) {
      return <User className="h-3 w-3" />;
    }
    return <Shield className="h-3 w-3" />;
  };

  // Target type → unified tone (color carries meaning only).
  const getTargetTone = (targetType: string): Tone => {
    switch (targetType) {
      case 'deposit':
        return 'success';
      case 'payment':
        return 'info';
      case 'rate':
        return 'pending';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MobileHeader title={t('history', { defaultValue: 'Historique' })} backTo="/m/more" showBack />

      <PullToRefresh onRefresh={refetch} className={cn('flex-1 overflow-y-auto', SURFACE.canvas)}>
        <div className="space-y-4 px-4 py-5">
          {/* Search */}
          <div className="relative">
            <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              type="text"
              placeholder={t('searchAction', { defaultValue: 'Rechercher une action...' })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter chips */}
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value)}
                className={cn(
                  'whitespace-nowrap px-4 py-2 text-[13px] font-semibold transition-colors',
                  typeFilter === filter.value ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs list */}
        <div className="px-4 pb-5">
          {isLoading ? (
            <SkeletonListScreen count={8} />
          ) : filteredLogs.length > 0 ? (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const name = log.adminProfile
                  ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}`
                  : 'Admin';
                return (
                  <Card key={log.id} className="flex gap-3 p-3.5">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>{name}</p>
                          <p className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>
                            {log.action_type}
                          </p>
                        </div>
                        <StatusPill
                          tone={getTargetTone(log.target_type)}
                          label={
                            <span className="flex items-center gap-1">
                              {getActionIcon(log.action_type)}
                              {log.target_type}
                            </span>
                          }
                        />
                      </div>
                      <p className={cn('mt-1 text-[10px]', TEXT.muted)}>
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Holder icon={History} size="lg" />
              <p className={cn('mt-4', TEXT.muted)}>{t('noLogsFound', { defaultValue: 'Aucun log trouvé' })}</p>
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
