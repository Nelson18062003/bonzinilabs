/**
 * Desktop admin — audit log ("Journaux").
 *
 * Same data and filtering as MobileHistoryScreen (useAdminAuditLogs, debounced
 * search + target-type chips) presented as a wide table instead of a stacked
 * card list. Read-only.
 */
import { useState } from 'react';
import { Search, X, User, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Shield, History } from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { TEXT, PRIMARY_PILL, SOFT_PILL, type Tone, Card, Avatar, StatusPill, TextInput, Holder, ScreenLoader } from '@/mobile/designKit';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
];

function actionIcon(actionType: string) {
  const a = actionType.toLowerCase();
  if (a.includes('deposit')) return <ArrowDownToLine className="h-3 w-3" />;
  if (a.includes('payment')) return <ArrowUpFromLine className="h-3 w-3" />;
  if (a.includes('rate')) return <TrendingUp className="h-3 w-3" />;
  if (a.includes('client')) return <User className="h-3 w-3" />;
  return <Shield className="h-3 w-3" />;
}

function targetTone(targetType: string): Tone {
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
}

export function DesktopHistoryScreen() {
  const { data: logs, isLoading } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredLogs =
    logs?.filter((log) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch =
        log.action_type.toLowerCase().includes(q) ||
        (log.adminProfile?.first_name?.toLowerCase().includes(q) ?? false);
      const matchesType = typeFilter === 'all' || log.target_type === typeFilter;
      return matchesSearch && matchesType;
    }) || [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Journaux</h2>
        <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
          {filteredLogs.length} action{filteredLogs.length > 1 ? 's' : ''} d'administration
        </p>
      </header>

      {/* Toolbar */}
      <section className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-sm">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une action…" className="pl-10 pr-10 text-[14px]" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Effacer" className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)} className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', typeFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <ScreenLoader />
        ) : filteredLogs.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                <th className="px-5 py-3 font-bold">Administrateur</th>
                <th className="px-2 py-3 font-bold">Action</th>
                <th className="px-2 py-3 font-bold">Cible</th>
                <th className="px-5 py-3 text-right font-bold">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const name = log.adminProfile ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}` : 'Admin';
                return (
                  <tr key={log.id} className="border-t border-black/[0.05] dark:border-white/[0.05]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="sm" />
                        <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                      </div>
                    </td>
                    <td className={cn('px-2 py-3 text-[12.5px]', TEXT.muted)}>{log.action_type}</td>
                    <td className="px-2 py-3">
                      <StatusPill
                        tone={targetTone(log.target_type)}
                        label={
                          <span className="flex items-center gap-1">
                            {actionIcon(log.action_type)}
                            {log.target_type}
                          </span>
                        }
                      />
                    </td>
                    <td className={cn('px-5 py-3 text-right text-[12px]', TEXT.muted)}>{formatDate(log.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={History} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun log trouvé</p>
          </div>
        )}
      </Card>
    </div>
  );
}
