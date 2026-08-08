/**
 * Journal d'audit — every privileged action, read-only.
 *
 * Four things this screen has to get right, because it is the record an
 * operator is judged on:
 *  · **It must be gated.** `canViewLogs` is checked here, not just on the rail
 *    entry — `cash_agent`, `customer_success` and `treasurer` don't have it.
 *  · **It must read the real column.** The payload lives in `details` (jsonb);
 *    there is no `description` column, so the "Détail" column used to be a
 *    permanent em dash and the search never matched anything.
 *  · **It must not lie when it fails.** A failed query renders an error state,
 *    never "aucune action enregistrée".
 *  · **It must be able to show its own primary data.** `details` is jsonb and
 *    the column that renders it is one clamped line, so anything longer than
 *    ~60 characters — which is most of what `adjust_wallet` or `set_daily_rate`
 *    record — was permanently unreadable on a screen that carried nine
 *    controls. Rows now open the inspector, which renders the payload key by
 *    key. That is the *only* thing this screen was missing, and it costs no
 *    toolbar control.
 *
 * The toolbar shed the six type chips for one `FilterPopover`: consultation of
 * an audit log is incident-driven, and once you are here you search by text
 * ("qui a touché BZ-DP-2291 ?"), not by category. The type axis survives behind
 * the popover, now carrying a count per type so an operator can see which axes
 * hold anything before they click.
 */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Coins, RefreshCw, ScrollText, Shield, TrendingUp, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import type { Tone } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, DataRow, EmptyState, GroupTitle, Holder, IconButton, Ref, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, MenuButton, type FilterOption } from '@/desktop/ui/Popover';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

/** The type axis. `all` is the neutral value. */
const TYPE_FILTERS = [
  { value: 'all', label: 'Tous les types' },
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

/** The one human sentence the payload carries, if it carries one. */
function detailSentence(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  for (const key of ['description', 'reason', 'comment', 'admin_comment', 'note', 'message']) {
    const v = d[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/** Best one-line summary available in the `details` payload. */
function detailText(details: unknown): string {
  const sentence = detailSentence(details);
  if (sentence) return sentence;
  if (!details || typeof details !== 'object') return '—';
  const d = details as Record<string, unknown>;
  const entries = Object.entries(d).filter(([, v]) => v !== null && typeof v !== 'object');
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(' · ') : '—';
}

/** Every top-level key of the payload, flattened for display. */
function detailEntries(details: unknown): { key: string; value: string; block: boolean }[] {
  if (!details || typeof details !== 'object') return [];
  return Object.entries(details as Record<string, unknown>).map(([key, v]) => {
    if (v === null || v === undefined) return { key, value: '—', block: false };
    if (typeof v === 'object') return { key, value: JSON.stringify(v, null, 2), block: true };
    const value = String(v);
    return { key, value, block: value.length > 80 };
  });
}

/* ── Inspector ───────────────────────────────────────────────────────── */

type AuditLog = NonNullable<ReturnType<typeof useAdminAuditLogs>['data']>[number];

/**
 * The full record, rendered where the table cannot: the payload key by key,
 * nested values as formatted JSON, nothing clamped.
 *
 * The close control is `xl:` only because `Workbench` renders its own dismiss
 * bar below 1280px, where the panel is an overlay — showing both would be two
 * close buttons stacked on one surface.
 */
function LogInspector({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const Icon = actionIcon(log.action_type);
  const label = ACTION_LABEL[log.action_type];
  const sentence = detailSentence(log.details);
  const entries = detailEntries(log.details);
  const admin = `${log.adminProfile?.first_name ?? ''} ${log.adminProfile?.last_name ?? ''}`.trim();

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Holder icon={Icon} tone={targetTone(log.target_type)} />
        <div className="min-w-0 flex-1">
          <h3 className={cn(DT.title, DFG.strong)}>{label ?? log.action_type}</h3>
          <p className="mt-1">
            <Ref>{log.action_type}</Ref>
          </p>
        </div>
        <IconButton icon={X} label="Fermer le détail" onClick={onClose} className="hidden xl:inline-flex" />
      </div>

      {sentence ? <p className={cn('mt-4', DT.body, DFG.base)}>{sentence}</p> : null}

      <div className={cn('mt-4 border-t', DS.line)}>
        <DataRow
          label="Administrateur"
          value={
            <span className="flex items-center justify-end gap-2">
              <Avatar name={admin || 'Système'} size="sm" />
              {admin || 'Système'}
            </span>
          }
        />
        <DataRow label="Cible" value={<Badge tone={targetTone(log.target_type)}>{TARGET_LABEL[log.target_type] ?? log.target_type}</Badge>} />
        {log.target_id ? <DataRow label="Identifiant cible" value={<Ref>{log.target_id}</Ref>} /> : null}
        <DataRow label="Horodatage" value={formatDate(log.created_at, 'datetime')} />
      </div>

      <div className="mt-4">
        <GroupTitle>Charge utile</GroupTitle>
        {entries.length === 0 ? (
          <p className={cn('mt-2', DT.body, DFG.faint)}>Aucune donnée enregistrée avec cette action.</p>
        ) : (
          <dl className="mt-2">
            {entries.map((e) => (
              <div key={e.key} className={cn('border-b py-2 last:border-0', DS.line)}>
                <dt className={cn(DT.mono, DFG.muted)}>{e.key}</dt>
                <dd className="mt-1">
                  {e.block ? (
                    <pre className={cn('overflow-x-auto whitespace-pre-wrap break-words rounded-lg p-3', DS.well, DT.mono, DFG.base)}>
                      {e.value}
                    </pre>
                  ) : (
                    <span className={cn('break-words', DT.body, DFG.strong)}>{e.value}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function DesktopHistoryScreen() {
  const { t } = useTranslation('common');
  const { hasPermission } = useAdminAuth();
  const { data: logs, isLoading, isError, refetch, isFetching } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  /* Search first, type second — so the per-type counts in the popover report
     what selecting that type would actually show, not what it would show on an
     unsearched list. */
  const searched = useMemo(
    () =>
      (logs ?? []).filter((log) => {
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        return [
          log.action_type,
          ACTION_LABEL[log.action_type] ?? '',
          log.adminProfile?.first_name ?? '',
          log.adminProfile?.last_name ?? '',
          detailText(log.details),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      }),
    [logs, debouncedSearch],
  );

  const rows = useMemo(
    () => searched.filter((log) => typeFilter === 'all' || log.target_type === typeFilter),
    [searched, typeFilter],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of searched) counts[log.target_type] = (counts[log.target_type] ?? 0) + 1;
    return counts;
  }, [searched]);

  const selected = useMemo(() => (logs ?? []).find((log) => log.id === selectedId) ?? null, [logs, selectedId]);

  if (!hasPermission('canViewLogs')) return <Navigate to="/m" replace />;

  const hasFilters = typeFilter !== 'all' || !!debouncedSearch;
  const total = logs?.length ?? 0;

  /* An axis value with nothing behind it says so before it is clicked. */
  const typeOptions: FilterOption<string>[] = TYPE_FILTERS.map((f) =>
    f.value === 'all'
      ? { value: f.value, label: f.label, meta: searched.length }
      : { value: f.value, label: f.label, meta: typeCounts[f.value] ?? 0, disabled: (typeCounts[f.value] ?? 0) === 0 },
  );

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
      /* Still one clamped line — but the row now opens the full payload. */
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

  /* Nothing to filter on an empty log — the toolbar would be three controls
     over a permanent empty state. */
  const showToolbar = total > 0 || hasFilters;

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('history', { defaultValue: "Journal d'audit" })}
          subtitle={
            hasFilters
              ? `${rows.length} sur ${total} action${total > 1 ? 's' : ''}`
              : `${total} action${total > 1 ? 's' : ''} enregistrée${total > 1 ? 's' : ''}`
          }
          actions={
            <MenuButton
              label="Actions du journal"
              items={[
                {
                  label: 'Actualiser',
                  icon: RefreshCw,
                  disabled: isFetching,
                  hint: 'Actualisation en cours…',
                  onSelect: () => void refetch(),
                },
              ]}
            />
          }
        />
      }
      toolbar={
        showToolbar ? (
          <Toolbar>
            <SearchField
              width={288}
              aria-label="Rechercher dans le journal d'audit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Action, administrateur ou détail…"
            />
            <FilterPopover
              label="Type"
              axes={[
                {
                  id: 'type',
                  label: 'Type de cible',
                  value: typeFilter,
                  onChange: setTypeFilter,
                  options: typeOptions,
                  neutral: 'all',
                },
              ]}
              onClear={() => setTypeFilter('all')}
            />
          </Toolbar>
        ) : undefined
      }
      inspector={selected ? <LogInspector log={selected} onClose={() => setSelectedId(null)} /> : null}
      onCloseInspector={() => setSelectedId(null)}
    >
      <DataTable
        label="Journal d'audit"
        rows={rows}
        columns={columns}
        getRowId={(log) => log.id}
        isLoading={isLoading}
        activeId={selectedId}
        onRowClick={(log) => setSelectedId(log.id)}
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
        /* The read-only guarantee is asserted once, next to the data it
           applies to — it used to be in the subtitle as well. */
        footer={rows.length > 0 ? <p className={cn(DT.label, DFG.muted, 'text-center')}>Journal en lecture seule — les entrées ne peuvent pas être modifiées.</p> : undefined}
      />
    </Workbench>
  );
}
