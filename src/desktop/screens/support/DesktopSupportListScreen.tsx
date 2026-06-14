/**
 * Desktop admin — support inbox.
 *
 * Same data, filters and search as MobileSupportListScreen (conversations,
 * assign/status filters, full-text search with highlighted snippets) — laid out
 * as a wide 2-column grid of conversation cards. Opening a conversation still
 * navigates to the chat screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, BarChart3, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { HighlightedSnippet } from '@/components/support/HighlightedSnippet';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useSearchConversations, useSupportAdmins } from '@/hooks/useAdminChatTools';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL, Avatar, TextInput, Holder, ScreenLoader } from '@/mobile/designKit';

type StatusFilter = 'open' | 'all' | 'closed';
type AssignFilter = 'all' | 'mine' | 'unassigned';

export function DesktopSupportListScreen() {
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
    debouncedSearch.length >= 2 ? debouncedSearch : '',
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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Holder icon={MessageCircle} size="lg" />
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>Vous n'avez pas accès au support chat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>{t('admin.listTitle')}</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>{filtered.length} conversation{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/m/support/stats')}
          className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold', SOFT_PILL)}
        >
          <BarChart3 className="h-4 w-4" /> {t('admin.statsLink')}
        </button>
      </header>

      {/* Toolbar */}
      <section className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-sm">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.searchPlaceholder')} className="pl-10 pr-10 text-[14px]" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Effacer" className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {assignFilters.map((f) => (
            <button key={f.value} onClick={() => setAssignFilter(f.value)} className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', assignFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}>
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)} className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', statusFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* List */}
      {isLoading || (debouncedSearch.length >= 2 && isSearchLoading) ? (
        <ScreenLoader />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Holder icon={MessageCircle} size="lg" />
          <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
            {debouncedSearch.length >= 2 ? t('admin.noMatch') : t('admin.listEmpty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((c) => {
            const name = `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.trim() || t('admin.noClientName');
            const unread = c.unread_count_admin;
            const time = c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale }) : '';
            const assignedAdmin = admins?.find((a) => a.id === c.assigned_admin_id);
            const assignedName = assignedAdmin ? `${assignedAdmin.first_name ?? ''} ${assignedAdmin.last_name ?? ''}`.trim() : null;
            const subject = c.subject;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/m/support/${c.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition hover:-translate-y-0.5',
                  SURFACE.card,
                  SURFACE.shadow,
                  c.status === 'closed' && 'opacity-60',
                )}
              >
                <Avatar name={name} tone={unread > 0 ? 'info' : 'neutral'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-[14px]', unread > 0 ? 'font-bold' : 'font-semibold', TEXT.strong)}>{name}</span>
                    <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{time}</span>
                  </div>
                  {subject && <p className="truncate text-[11px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">{subject}</p>}
                  {isSearching && searchSnippetByConv.has(c.id) ? (
                    <HighlightedSnippet
                      text={searchSnippetByConv.get(c.id) ?? ''}
                      query={debouncedSearch}
                      maxLength={100}
                      className={cn('mt-0.5 truncate text-[12px]', unread > 0 ? TEXT.strong : TEXT.muted)}
                    />
                  ) : (
                    <p className={cn('mt-0.5 truncate text-[12px]', unread > 0 ? TEXT.strong : TEXT.muted)}>{c.last_message_preview || '—'}</p>
                  )}
                  {assignedName && <p className="mt-0.5 text-[10px] text-[#9A6B12] dark:text-[#E7C083]">{t('admin.assignedToLabel')} {assignedName}</p>}
                </div>
                {unread > 0 && <span className="shrink-0 rounded-full bg-[#FE560D] px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
