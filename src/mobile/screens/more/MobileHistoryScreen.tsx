import { useState } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  Search,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Shield,
  Loader2,
} from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
];

export function MobileHistoryScreen() {
  const { data: logs, isLoading } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.action_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.adminProfile?.first_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesType = typeFilter === 'all' || log.target_type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('deposit') || actionType.includes('DEPOSIT')) {
      return <ArrowDownToLine className="w-4 h-4" />;
    }
    if (actionType.includes('payment') || actionType.includes('PAYMENT')) {
      return <ArrowUpFromLine className="w-4 h-4" />;
    }
    if (actionType.includes('rate') || actionType.includes('RATE')) {
      return <TrendingUp className="w-4 h-4" />;
    }
    if (actionType.includes('client') || actionType.includes('CLIENT')) {
      return <User className="w-4 h-4" />;
    }
    return <Shield className="w-4 h-4" />;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('validate') || actionType.includes('VALIDATE')) {
      return 'bg-emerald-500/10 text-emerald-600';
    }
    if (actionType.includes('reject') || actionType.includes('REJECT')) {
      return 'bg-red-500/10 text-red-600';
    }
    return 'bg-gray-500/10 text-gray-600';
  };

  const getTargetColor = (targetType: string) => {
    switch (targetType) {
      case 'deposit':
        return 'bg-emerald-100 text-emerald-700';
      case 'payment':
        return 'bg-blue-100 text-blue-700';
      case 'client':
        return 'bg-purple-100 text-purple-700';
      case 'rate':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <MobileHeader title="Historique" backTo="/m/more" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title="Historique" backTo="/m/more" showBack />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted border-0 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  typeFilter === filter.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-3 px-4 py-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {log.adminProfile
                      ? `${log.adminProfile.first_name[0]}${log.adminProfile.last_name[0]}`
                      : 'AD'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.adminProfile
                          ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}`
                          : 'Admin'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {log.action_type}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px] px-2 py-1 rounded-full flex-shrink-0',
                        getTargetColor(log.target_type)
                      )}
                    >
                      {getActionIcon(log.action_type)}
                      {log.target_type}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDate(log.created_at)}
                  </p>
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Aucun log trouvé
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
