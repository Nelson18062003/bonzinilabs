import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, BarChart3, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { HighlightedSnippet } from '@/components/support/HighlightedSnippet';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useSearchConversations, useSupportAdmins } from '@/hooks/useAdminChatTools';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  Avatar,
  TextInput,
  Holder,
  ScreenLoader,
} from '@/mobile/designKit';

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

  const assignFilters: { value: AssignFilter; label: string }[] = [
    { value: 'all', label: t('admin.filterAll') },
    { value: 'mine', label: t('admin.filterMine') },
    { value: 'unassigned', label: t('admin.filterUnassigned') },
  ];
  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: t('admin.filterOpen') },
    { value: 'all', label: t('admin.filterAllStatus') },
    { value: 'closed', label: t('admin.filterClosed') },
  ];

  if (!canAccess) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center', SURFACE.canvas)}>
        <Holder icon={MessageCircle} size="lg" />
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>
          Vous n'avez pas accès au support chat.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={t('admin.listTitle')}
        rightElement={
          <button
            type="button"
            onClick={() => navigate('/m/support/stats')}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full', TEXT.muted)}
            aria-label={t('admin.statsLink')}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        }
      />

      <div className="space-y-3 px-4 py-4">
        {/* Search */}
        <div className="relative">
          <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchPlaceholder')}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className={cn('absolute right-3 top-1/2 z-10 -translate-y-1/2', TEXT.muted)}
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Assign filter chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {assignFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setAssignFilter(filter.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                assignFilter === filter.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Status filter chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {statusFilters.map((filter) => (
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
      </div>

      {isLoading || (debouncedSearch.length >= 2 && isSearchLoading) ? (
        <ScreenLoader />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <Holder icon={MessageCircle} size="lg" />
          <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
            {debouncedSearch.length >= 2 ? t('admin.noMatch') : t('admin.listEmpty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-6">
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
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/m/support/${c.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]',
                  SURFACE.card,
                  SURFACE.shadow,
                  c.status === 'closed' && 'opacity-60',
                )}
              >
                <div className="relative">
                  <Avatar name={name} tone={unread > 0 ? 'info' : 'neutral'} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-[14px]', unread > 0 ? 'font-bold' : 'font-semibold', TEXT.strong)}>
                      {name}
                    </span>
                    <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{time}</span>
                  </div>
                  {subject && (
                    <p className="truncate text-[11px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                      {subject}
                    </p>
                  )}
                  {isSearching && searchSnippetByConv.has(c.id) ? (
                    <HighlightedSnippet
                      text={searchSnippetByConv.get(c.id) ?? ''}
                      query={debouncedSearch}
                      maxLength={100}
                      className={cn('mt-0.5 truncate text-[12px]', unread > 0 ? TEXT.strong : TEXT.muted)}
                    />
                  ) : (
                    <p className={cn('mt-0.5 truncate text-[12px]', unread > 0 ? TEXT.strong : TEXT.muted)}>
                      {c.last_message_preview || '—'}
                    </p>
                  )}
                  {assignedName && (
                    <p className="mt-0.5 text-[10px] text-[#9A6B12] dark:text-[#E7C083]">
                      {t('admin.assignedToLabel')} {assignedName}
                    </p>
                  )}
                </div>

                {unread > 0 && (
                  <span className="shrink-0 rounded-full bg-[#FE560D] px-2 py-0.5 text-[11px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
