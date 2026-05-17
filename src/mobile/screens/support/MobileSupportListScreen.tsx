import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { SearchField } from '@/components/form';
import { HighlightedSnippet } from '@/components/support/HighlightedSnippet';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useSearchConversations, useSupportAdmins } from '@/hooks/useAdminChatTools';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';

type StatusFilter = 'open' | 'all' | 'closed';
type AssignFilter = 'all' | 'mine' | 'unassigned';

export function MobileSupportListScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');

  const { data: conversations, isLoading } = useAdminConversations(statusFilter);
  const { data: searchResults, isLoading: isSearchLoading } = useSearchConversations(
    debouncedSearch.length >= 2 ? debouncedSearch : ''
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

  const filtered = useMemo(() => {
    let list = conversations ?? [];

    if (assignFilter === 'mine' && myUserRoleId) {
      list = list.filter((c) => c.assigned_admin_id === myUserRoleId);
    } else if (assignFilter === 'unassigned') {
      list = list.filter((c) => !c.assigned_admin_id);
    }

    // Quand on recherche, on intersecte
    if (debouncedSearch.trim().length >= 2 && searchResults) {
      const matchingIds = new Set(searchResults.map((r) => r.conversation_id));
      list = list.filter((c) => matchingIds.has(c.id));
    }

    return list;
  }, [conversations, assignFilter, myUserRoleId, debouncedSearch, searchResults]);

  const isSearching = debouncedSearch.trim().length >= 2;

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader
        title={t('admin.listTitle')}
        rightElement={
          <button
            type="button"
            onClick={() => navigate('/m/support/stats')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-bonzini-violet hover:bg-bonzini-violet/10"
            aria-label={t('admin.statsLink')}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-4 py-3 space-y-3 border-b border-border">
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder={t('admin.searchPlaceholder')}
        />

        <MobileFilterChips<AssignFilter>
          filters={[
            { value: 'all', label: t('admin.filterAll') },
            { value: 'mine', label: t('admin.filterMine') },
            { value: 'unassigned', label: t('admin.filterUnassigned') },
          ]}
          activeKey={assignFilter}
          onChange={setAssignFilter}
        />

        <MobileFilterChips<StatusFilter>
          filters={[
            { value: 'open', label: t('admin.filterOpen') },
            { value: 'all', label: t('admin.filterAllStatus') },
            { value: 'closed', label: t('admin.filterClosed') },
          ]}
          activeKey={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {isLoading || (debouncedSearch.length >= 2 && isSearchLoading) ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <MobileEmptyState
          icon={MessageCircle}
          title={debouncedSearch.length >= 2 ? t('admin.noMatch') : t('admin.listEmpty')}
        />
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((c) => {
            const name =
              `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.trim() ||
              t('admin.noClientName');
            const unread = c.unread_count_admin;
            const time = c.last_message_at
              ? formatDistanceToNow(new Date(c.last_message_at), {
                  addSuffix: false,
                  locale,
                })
              : '';
            const assignedAdmin = admins?.find((a) => a.id === c.assigned_admin_id);
            const assignedName = assignedAdmin
              ? `${assignedAdmin.first_name ?? ''} ${assignedAdmin.last_name ?? ''}`.trim()
              : null;
            const subject = c.subject;

            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/m/support/${c.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/40"
                >
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold',
                      c.status === 'closed' && 'opacity-50',
                      unread > 0
                        ? 'bg-bonzini-violet text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {(c.client_first_name?.[0] ?? '?').toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', unread > 0 ? 'font-semibold' : 'font-medium', c.status === 'closed' && 'text-muted-foreground')}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
                    </div>
                    {subject && (
                      <p className="truncate text-[11px] font-medium text-bonzini-violet">
                        {subject}
                      </p>
                    )}
                    {isSearching && searchSnippetByConv.has(c.id) ? (
                      <HighlightedSnippet
                        text={searchSnippetByConv.get(c.id) ?? ''}
                        query={debouncedSearch}
                        maxLength={100}
                        className={cn(
                          'truncate text-xs mt-0.5',
                          unread > 0 ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      />
                    ) : (
                      <p className={cn('truncate text-xs mt-0.5', unread > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                        {c.last_message_preview || '—'}
                      </p>
                    )}
                    {assignedName && (
                      <p className="mt-0.5 text-[10px] text-bonzini-amber">
                        {t('admin.assignedToLabel')} {assignedName}
                      </p>
                    )}
                  </div>

                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-bonzini-orange px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
