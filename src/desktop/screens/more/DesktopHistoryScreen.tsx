/**
 * Journal d'audit — every privileged action, read-only.
 *
 * Three things this screen has to get right, because it is the record an
 * operator is judged on:
 *  · **It must be gated.** `canViewLogs` is checked here, not just on the rail
 *    entry — `cash_agent`, `customer_success` and `treasurer` don't have it.
 *  · **It must read the real column.** The payload lives in `details` (jsonb);
 *    there is no `description` column, so the "Détail" column used to be a
 *    permanent em dash and the search never matched anything.
 *  · **It must not lie when it fails.** A failed query renders an error state,
 *    never "aucune action enregistrée".
 */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Coins, RefreshCw, ScrollText, Search, Shield, TrendingUp, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import type { Tone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, Holder, IconButton, Input, Ref } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
  { value: 'treasury', label: 'Trésorerie' },
];

/** Machine identifiers are for logs, not for operators. */
const ACTION_LABEL: Record<string, string> = {
  validate_deposit: 'Dépôt validé',
  reject_deposit: 'Dépôt rejeté',
  cancel_deposit: 'Dépôt annulé',
  start_deposit_review: 'Vérification démarrée',
  create_deposit_for_client: 'Dépôt créé pour un client',
  process_payment: 'Paiement traité',
  complete_payment: 'Paiement effectué',
  cancel_payment: 'Paiement annulé',
  create_admin_payment: 'Paiement créé',
  create_client: 'Client créé',
  update_client: 'Client modifié',
  delete_client: 'Client supprimé',
  adjust_wallet: 'Wallet ajusté',
  set_daily_rate: 'Taux du jour publié',
  set_rate_adjustment: 'Ajustement de taux modifié',
  record_usdt_purchase: 'Achat USDT enregistré',
  record_usdt_sale: 'Vente USDT enregistrée',
  adjust_treasury_account: 'Compte de trésorerie ajusté',
  toggle_admin_status: 'Statut administrateur modifié',
  admin_create_admin: 'Administrateur créé',
  admin_reset_password: 'Mot de passe réinitialisé',
};

const TARGET_LABEL: Record<string, string> = {
  deposit: 'Dépôt',
  payment: 'Paiement',
  client: 'Client',
  rate: 'Taux',
  treasury: 'Trésorerie',
  admin: 'Admin',
  wallet: 'Wallet',
};

function actionIcon(actionType: string) {
  const a = actionType.toLowerCase();
  if (a.includes('deposit')) return ArrowDownToLine;
  if (a.includes('payment')) return ArrowUpFromLine;
  if (a.includes('rate')) return TrendingUp;
  if (a.includes('treasury') || a.includes('usdt')) return Coins;
  if (a.includes('client') || a.includes('wallet')) return User;
  return Shield;
}

function targetTone(targetType: string): Tone {
  switch (targetType) {
    case 'deposit': return 'success';
    case 'payment': return 'info';
    case 'rate': return 'pending';
    case 'treasury': return 'pending';
    default: return 'neutral';
  }
}

/** Best human sentence available in the `details` payload. */
function detailText(details: unknown): string {
  if (!details || typeof details !== 'object') return '—';
  const d = details as Record<string, unknown>;
  for (const key of ['description', 'reason', 'comment', 'admin_comment', 'note', 'message']) {
    const v = d[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  const entries = Object.entries(d).filter(([, v]) => v !== null && typeof v !== 'object');
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(' · ') : '—';
}

export function DesktopHistoryScreen() {
  const { t } = useTranslation('common');
  const { hasPermission } = useAdminAuth();
  const { data: logs, isLoading, isError, refetch, isFetching } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const debouncedSearch = useDebouncedValue(search);

  const rows = useMemo(
    () =>
      (logs ?? []).filter((log) => {
        if (typeFilter !== 'all' && log.target_type !== typeFilter) return false;
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        const haystack = [
          log.action_type,
          ACTION_LABEL[log.action_type] ?? '',
          log.adminProfile?.first_name ?? '',
          log.adminProfile?.last_name ?? '',
          detailText(log.details),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      }),
    [logs, typeFilter, debouncedSearch],
  );

  if (!hasPermission('canViewLogs')) return <Navigate to="/m" replace />;

  const hasFilters = typeFilter !== 'all' || !!debouncedSearch;
  const total = logs?.length ?? 0;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'admin',
      header: 'Administrateur',
      width: '210px',
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
      width: '250px',
      cell: (log) => {
        const Icon = actionIcon(log.action_type);
        const label = ACTION_LABEL[log.action_type];
        return (
          <span className="flex items-center gap-2" title={log.action_type}>
            <Holder icon={Icon} tone={targetTone(log.target_type)} size="sm" />
            {label ? (
              <span className={cn('truncate font-medium', DFG.base)}>{label}</span>
            ) : (
              <Ref>{log.action_type}</Ref>
            )}
          </span>
        );
      },
    },
    {
      key: 'details',
      header: 'Détail',
      cell: (log) => <span className={cn('line-clamp-1', DFG.base)}>{detailText(log.details)}</span>,
    },
    {
      key: 'target',
      header: 'Cible',
      width: '110px',
      cell: (log) => <Badge tone={targetTone(log.target_type)}>{TARGET_LABEL[log.target_type] ?? log.target_type}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      width: '170px',
      cell: (log) => <span className={cn('whitespace-nowrap', DFG.muted)}>{formatDate(log.created_at, 'datetime')}</span>,
    },
  ];

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('history', { defaultValue: "Journal d'audit" })}
          subtitle={
            hasFilters
              ? `${rows.length} sur ${total} action${total > 1 ? 's' : ''} · lecture seule`
              : `${total} action${total > 1 ? 's' : ''} enregistrée${total > 1 ? 's' : ''} · lecture seule`
          }
          actions={<IconButton icon={RefreshCw} label="Actualiser" loading={isFetching} onClick={() => refetch()} />}
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
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.muted)} />
            <Input
              type="search"
              aria-label="Rechercher dans le journal d'audit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Action, administrateur ou détail…"
              className="pl-8"
            />
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
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger le journal"
              hint="La requête a échoué. Le journal n'est pas vide — il n'a pas pu être lu."
              action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
            />
          ) : (
            <EmptyState
              icon={ScrollText}
              title="Aucune action enregistrée"
              hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : undefined}
            />
          )
        }
        footer={<p className={cn(DT.label, DFG.muted, 'text-center')}>Journal en lecture seule — les entrées ne peuvent pas être modifiées.</p>}
      />
    </Workbench>
  );
}
