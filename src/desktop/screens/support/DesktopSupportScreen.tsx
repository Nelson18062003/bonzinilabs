/**
 * Support — the conversation queue.
 *
 * Rebuilt on the console's dimensional contract. It was the last screen still
 * dressed in the mobile kit (`SURFACE`, `TEXT`, `PRIMARY_PILL`, `SOFT_PILL`),
 * which is how it ended up with 29px filter pills next to a 16px separator, a
 * 34px "Stats" button — a fifth action height in a console that allows three —
 * and five type steps below the 12px floor.
 *
 * It is now a `Workbench`, like dépôts and clients: the list owns the viewport,
 * the conversation opens in the docked inspector as the same embedded
 * `MobileSupportConversationScreen`, and the list never unmounts — so an
 * operator answering ten conversations in a row keeps their place in the queue.
 * Below 1280px the chat becomes an overlay drawer rather than disappearing.
 *
 * Toolbar: five controls — search, three status buckets, one `FilterPopover`.
 * Status is the queue view an operator changes hourly, so it stays visible;
 * assignation is a once-a-day axis and folds into the popover, where its
 * options can also carry the counts that make its scope self-evident.
 *
 * Two honesty rules:
 *  · the status chips carry no counts, because the query only ever returns the
 *    bucket in force — a fabricated "0" on the other two would be a lie;
 *  · search runs server-side over messages but is intersected with the loaded
 *    bucket, so an empty result says which filter may be hiding the match
 *    instead of implying nothing was found anywhere.
 *
 * Data layer unchanged (`useAdminConversations`, `useSearchConversations`,
 * `useSupportAdmins`), shared with the mobile inbox.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { HighlightedSnippet } from '@/components/support/HighlightedSnippet';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useSearchConversations, useSupportAdmins } from '@/hooks/useAdminChatTools';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { MobileSupportConversationScreen } from '@/mobile/screens/support/MobileSupportConversationScreen';
import { DT, DFG, DACCENT, DBADGE } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, Count, EmptyState, Panel, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, type FilterAxis } from '@/desktop/ui/Popover';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench, Workspace } from '@/desktop/ui/layout';
import type { ChatConversationWithClient } from '@/types/chat';

type StatusFilter = 'open' | 'all' | 'closed';
type AssignFilter = 'all' | 'mine' | 'unassigned';

/** The full-text search only runs from two characters — same rule as mobile. */
const MIN_SEARCH = 2;

export function DesktopSupportScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');

  const { data: conversations, isLoading } = useAdminConversations(statusFilter);
  const { data: searchResults, isLoading: isSearchLoading } = useSearchConversations(
    debouncedSearch.length >= MIN_SEARCH ? debouncedSearch : '',
  );
  const { data: admins } = useSupportAdmins();
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => !cancelled && setLocale(l));
    return () => {
      cancelled = true;
    };
  }, []);

  const myUserRoleId = admins?.find((a) => a.user_id === currentUser?.id)?.id ?? null;

  const searchSnippetByConv = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of searchResults ?? []) map.set(r.conversation_id, r.snippet);
    return map;
  }, [searchResults]);

  const loaded = useMemo(() => conversations ?? [], [conversations]);

  const filtered = useMemo(() => {
    let list = loaded;
    if (assignFilter === 'mine' && myUserRoleId) {
      list = list.filter((c) => c.assigned_admin_id === myUserRoleId);
    } else if (assignFilter === 'unassigned') {
      list = list.filter((c) => !c.assigned_admin_id);
    }
    if (debouncedSearch.trim().length >= MIN_SEARCH && searchResults) {
      const matchingIds = new Set(searchResults.map((r) => r.conversation_id));
      list = list.filter((c) => matchingIds.has(c.id));
    }
    return list;
  }, [loaded, assignFilter, myUserRoleId, debouncedSearch, searchResults]);

  const isSearching = debouncedSearch.trim().length >= MIN_SEARCH;
  const hasFilters = statusFilter !== 'open' || assignFilter !== 'all' || isSearching;

  const resetFilters = () => {
    setStatusFilter('open');
    setAssignFilter('all');
    setSearch('');
  };

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: t('admin.filterOpen') },
    { value: 'all', label: t('admin.filterAllStatus') },
    { value: 'closed', label: t('admin.filterClosed') },
  ];

  /* How many *loaded* conversations each assignation bucket holds. The axis
     filters client-side, so this is the only count that can honestly sit next
     to it — and showing it is what makes the axis' scope self-evident. */
  const assignCounts = useMemo(() => {
    let mine = 0;
    let unassigned = 0;
    for (const c of loaded) {
      if (myUserRoleId && c.assigned_admin_id === myUserRoleId) mine += 1;
      if (!c.assigned_admin_id) unassigned += 1;
    }
    return { all: loaded.length, mine, unassigned };
  }, [loaded, myUserRoleId]);

  const assignAxis: FilterAxis<string> = {
    id: 'assign',
    label: 'Assignation · conversations chargées',
    value: assignFilter,
    onChange: (v) => setAssignFilter(v as AssignFilter),
    neutral: 'all',
    options: [
      { value: 'all', label: t('admin.filterAll'), meta: assignCounts.all },
      {
        value: 'mine',
        label: t('admin.filterMine'),
        meta: assignCounts.mine,
        // Without a resolved user_role id "Mes convs" cannot filter at all and
        // would silently return everything. Never disable the value in force.
        disabled: !myUserRoleId && assignFilter !== 'mine',
      },
      { value: 'unassigned', label: t('admin.filterUnassigned'), meta: assignCounts.unassigned },
    ],
  };

  const columns: Column<ChatConversationWithClient>[] = [
    {
      key: 'client',
      header: 'Client',
      width: '240px',
      cell: (c) => {
        const name = `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.trim() || t('admin.noClientName');
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className={cn('truncate', DFG.strong, c.unread_count_admin > 0 ? 'font-bold' : 'font-semibold')}>
              {name}
            </span>
          </span>
        );
      },
    },
    {
      key: 'conversation',
      header: 'Conversation',
      cell: (c) => (
        <span className="block min-w-0">
          {c.subject ? <span className={cn('block truncate', DT.label, DACCENT.text)}>{c.subject}</span> : null}
          {isSearching && searchSnippetByConv.has(c.id) ? (
            <HighlightedSnippet
              text={searchSnippetByConv.get(c.id) ?? ''}
              query={debouncedSearch}
              maxLength={96}
              className={cn('truncate', DT.body, c.unread_count_admin > 0 ? DFG.strong : DFG.muted)}
            />
          ) : (
            <span className={cn('block truncate', DT.body, c.unread_count_admin > 0 ? DFG.strong : DFG.muted)}>
              {c.last_message_preview || '—'}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'assigned',
      header: t('admin.assignedToLabel'),
      width: '160px',
      hideBelow: 1100,
      cell: (c) => {
        if (!c.assigned_admin_id) return <span className={cn('block truncate', DFG.faint)}>Non assignée</span>;
        const a = admins?.find((x) => x.id === c.assigned_admin_id);
        const assignedName = a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '';
        // Assigned but the admin list has not answered (or the admin was
        // removed): say so, never fall back to "non assignée" — the two are
        // different facts and one of them is a claim nobody made.
        return assignedName ? (
          <span className={cn('block truncate', DFG.base)}>{assignedName}</span>
        ) : (
          <span className={cn('block truncate', DFG.faint)}>Admin inconnu</span>
        );
      },
    },
    {
      key: 'last_message_at',
      header: t('admin.lastActivity'),
      width: '130px',
      hideBelow: 900,
      cell: (c) => (
        <span className={cn('truncate', DFG.muted)}>
          {c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale }) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'right',
      width: '150px',
      cell: (c) => (
        <span className="flex items-center justify-end gap-2">
          {c.unread_count_admin > 0 ? (
            <>
              <Count value={c.unread_count_admin} className={DBADGE} />
              {/* The badge is a bare number; what it counts has to reach a
                  screen reader as words. */}
              <span className="sr-only">
                {c.unread_count_admin} message{c.unread_count_admin > 1 ? 's' : ''} non lu
                {c.unread_count_admin > 1 ? 's' : ''}
              </span>
            </>
          ) : null}
          {c.status === 'closed' ? <Badge tone="neutral">{t('admin.filterClosed')}</Badge> : null}
        </span>
      ),
    },
  ];

  if (!canAccess) {
    return (
      <Workspace head={<ScreenHead title={t('admin.listTitle')} />}>
        <Panel>
          <EmptyState
            icon={MessageCircle}
            title={t('admin.noChatAccess', { defaultValue: "Vous n'avez pas accès au support chat." })}
          />
        </Panel>
      </Workspace>
    );
  }

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('admin.listTitle')}
          actions={
            <Button icon={BarChart3} onClick={() => navigate('/m/support/stats')}>
              {t('admin.statsLink')}
            </Button>
          }
        />
      }
      toolbar={
        <Toolbar>
          <SearchField
            aria-label={t('admin.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchPlaceholder')}
          />

          {statusChips.map((f) => (
            <Chip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </Chip>
          ))}

          <FilterPopover
            axes={[assignAxis]}
            onClear={resetFilters}
            // Search and the status chips narrow the list without touching this
            // axis, so without `clearable` the reset would be unreachable in
            // exactly the states an operator most wants one. Raw `search`, so
            // the action appears on the first keystroke.
            clearable={!!search || statusFilter !== 'open'}
          />
        </Toolbar>
      }
      inspector={conversationId ? <MobileSupportConversationScreen embedded /> : null}
      onCloseInspector={() => navigate('/m/support')}
    >
      <DataTable
        label={t('admin.listTitle')}
        rows={filtered}
        columns={columns}
        getRowId={(c) => c.id}
        activeId={conversationId ?? null}
        onRowClick={(c) => navigate(`/m/support/${c.id}`)}
        isLoading={isLoading || (isSearching && isSearchLoading)}
        empty={
          <EmptyState
            icon={MessageCircle}
            title={isSearching ? t('admin.noMatch') : t('admin.listEmpty')}
            hint={
              isSearching
                ? 'La recherche ne remonte que les conversations du filtre de statut actif — élargissez-le pour chercher plus loin.'
                : hasFilters
                  ? 'Essayez de modifier ou de réinitialiser vos filtres.'
                  : undefined
            }
          />
        }
        footer={
          <p className={cn(DT.label, DFG.muted, 'text-center')}>
            {filtered.length} conversation{filtered.length > 1 ? 's' : ''}
            {isSearching ? ` pour « ${debouncedSearch} »` : ''}
          </p>
        }
      />
    </Workbench>
  );
}
