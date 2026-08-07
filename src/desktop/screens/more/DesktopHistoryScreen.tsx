/**
 * Journal d'audit — every privileged action, read-only.
 *
 * Rebuilt on the shared DataTable so it reads like the rest of the console.
 * Same data (`useAdminAuditLogs`) and same filters as MobileHistoryScreen.
 */
import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ScrollText, Search, Shield, TrendingUp, User, X } from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import type { Tone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Holder, Input, Ref } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
];

function actionIcon(actionType: string) {
  const a = actionType.toLowerCase();
  if (a.includes('deposit')) return ArrowDownToLine;
  if (a.includes('payment')) return ArrowUpFromLine;
  if (a.includes('rate')) return TrendingUp;
  if (a.includes('client')) return User;
  return Shield;
}

function targetTone(targetType: string): Tone {
  switch (targetType) {
    case 'deposit': return 'success';
    case 'payment': return 'info';
    case 'rate': return 'pending';
    default: return 'neutral';
  }
}

export function DesktopHistoryScreen() {
  const { data: logs, isLoading } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const debouncedSearch = useDebouncedValue(search);

  const rows = useMemo(
    () =>
      (logs ?? []).filter((log) => {
        if (typeFilter !== 'all' && log.target_type !== typeFilter) return false;
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        return (
          log.action_type.toLowerCase().includes(q) ||
          (log.adminProfile?.first_name?.toLowerCase().includes(q) ?? false) ||
          (log.description?.toLowerCase().includes(q) ?? false)
        );
      }),
    [logs, typeFilter, debouncedSearch],
  );

  const hasFilters = typeFilter !== 'all' || !!debouncedSearch;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'admin',
      header: 'Administrateur',
      width: '220px',
      cell: (log) => {
        const name = `${log.adminProfile?.first_name ?? ''} ${log.adminProfile?.last_name ?? ''}`.trim() || 'Système';
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className={cn('truncate font-semibold', DFG.strong)}>{name}</span>
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      width: '260px',
      cell: (log) => {
        const Icon = actionIcon(log.action_type);
        return (
          <span className="flex items-center gap-2">
            <Holder icon={Icon} tone={targetTone(log.target_type)} size="sm" />
            <Ref>{log.action_type}</Ref>
          </span>
        );
      },
    },
    {
      key: 'description',
      header: 'Détail',
      cell: (log) => <span className={cn('line-clamp-1', DFG.base)}>{log.description || '—'}</span>,
    },
    {
      key: 'target',
      header: 'Cible',
      width: '120px',
      cell: (log) => <Badge tone={targetTone(log.target_type)}>{log.target_type}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      width: '180px',
      cell: (log) => <span className={cn('whitespace-nowrap', DFG.muted)}>{formatDate(log.created_at, 'datetime')}</span>,
    },
  ];

  return (
    <Workbench
      head={
        <ScreenHead
          title="Journal d'audit"
          subtitle={`${rows.length} action${rows.length > 1 ? 's' : ''} enregistrée${rows.length > 1 ? 's' : ''} · lecture seule`}
        />
      }
      toolbar={
        <Toolbar
          trailing={
            hasFilters ? (
              <Button size="sm" variant="ghost" icon={X} onClick={() => { setTypeFilter('all'); setSearch(''); }}>
                Réinitialiser
              </Button>
            ) : undefined
          }
        >
          <div className="relative mr-1 w-72">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.faint)} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Action, administrateur ou détail…" className="pl-8" />
          </div>
          {FILTERS.map((f) => (
            <Chip key={f.value} active={typeFilter === f.value} onClick={() => setTypeFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </Toolbar>
      }
    >
      <DataTable
        label="Journal d'audit"
        rows={rows}
        columns={columns}
        getRowId={(log) => log.id}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon={ScrollText}
            title="Aucune action enregistrée"
            hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : undefined}
          />
        }
        footer={<p className={cn(DT.label, DFG.faint, 'text-center')}>Journal en lecture seule — les entrées ne peuvent pas être modifiées.</p>}
      />
    </Workbench>
  );
}
