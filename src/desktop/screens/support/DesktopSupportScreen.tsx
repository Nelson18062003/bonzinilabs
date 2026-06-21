/**
 * Desktop admin — support console (side-by-side).
 *
 * Replaces the single-route inbox with a true working console: the conversation
 * list (same data, filters and full-text search as the mobile inbox) lives in a
 * fixed left column, and the selected conversation opens in an embedded live
 * chat on the right — so an operator scans, picks and replies without leaving
 * the page. The chat is the exact MobileSupportConversationScreen rendered in
 * `embedded` mode (no full-viewport ViewportShell), driven by the route param.
 *
 * Mounted at both /m/support and /m/support/:conversationId; with no param the
 * right pane shows a placeholder.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { MobileSupportConversationScreen } from '@/mobile/screens/support/MobileSupportConversationScreen';

type StatusFilter = 'open' | 'all' | 'closed';
type AssignFilter = 'all' | 'mine' | 'unassigned';

// Soft frame shared with MasterDetailLayout, so the chat panel matches the rest
// of the desktop admin's detail surfaces.
const PANEL_FRAME =
  'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]';

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
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>{t('admin.noChatAccess', { defaultValue: "Vous n'avez pas accès au support chat." })}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[520px] gap-5">
      {/* Left — conversation list */}
      <div className="flex w-[372px] shrink-0 flex-col">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 className={cn('text-[20px] font-extrabold tracking-tight', TEXT.strong)}>{t('admin.listTitle')}</h2>
            <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>
              {filtered.length} conversation{filtered.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate('/m/support/stats')}
            className={cn('inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold', SOFT_PILL)}
          >
            <BarChart3 className="h-4 w-4" /> {t('admin.statsLink')}
          </button>
        </header>

        {/* Search + filters */}
        <div className="mt-3 space-y-2.5">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.searchPlaceholder')} className="pl-10 pr-10 text-[14px]" />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Effacer" className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {statusFilters.map((f) => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)} className={cn('rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors', statusFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}>
                {f.label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-black/10 dark:bg-white/10" />
            {assignFilters.map((f) => (
              <button key={f.value} onClick={() => setAssignFilter(f.value)} className={cn('rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors', assignFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className={cn('mt-3 flex-1 overflow-y-auto rounded-[22px] p-2', SURFACE.card, PANEL_FRAME)}>
          {isLoading || (debouncedSearch.length >= 2 && isSearchLoading) ? (
            <ScreenLoader />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Holder icon={MessageCircle} size="lg" />
              <p className={cn('mt-4 text-[13px] font-medium', TEXT.muted)}>
                {debouncedSearch.length >= 2 ? t('admin.noMatch') : t('admin.listEmpty')}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => {
                const name = `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.trim() || t('admin.noClientName');
                const unread = c.unread_count_admin;
                const time = c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale }) : '';
                const subject = c.subject;
                const assignedAdmin = admins?.find((a) => a.id === c.assigned_admin_id);
                const assignedName = assignedAdmin ? `${assignedAdmin.first_name ?? ''} ${assignedAdmin.last_name ?? ''}`.trim() : null;
                const selected = c.id === conversationId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/m/support/${c.id}`)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition',
                      selected ? 'bg-[#EDEAFA]/80 dark:bg-white/[0.07]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                      c.status === 'closed' && !selected && 'opacity-60',
                    )}
                  >
                    <Avatar name={name} tone={unread > 0 ? 'info' : 'neutral'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[13.5px]', unread > 0 ? 'font-bold' : 'font-semibold', TEXT.strong)}>{name}</span>
                        <span className={cn('shrink-0 text-[10.5px]', TEXT.muted)}>{time}</span>
                      </div>
                      {subject && <p className="truncate text-[10.5px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">{subject}</p>}
                      {isSearching && searchSnippetByConv.has(c.id) ? (
                        <HighlightedSnippet
                          text={searchSnippetByConv.get(c.id) ?? ''}
                          query={debouncedSearch}
                          maxLength={64}
                          className={cn('mt-0.5 truncate text-[11.5px]', unread > 0 ? TEXT.strong : TEXT.muted)}
                        />
                      ) : (
                        <p className={cn('mt-0.5 truncate text-[11.5px]', unread > 0 ? TEXT.strong : TEXT.muted)}>{c.last_message_preview || '—'}</p>
                      )}
                      {assignedName && (
                        <p className="mt-0.5 truncate text-[10px] text-[#9A6B12] dark:text-[#E7C083]">
                          {t('admin.assignedToLabel')} {assignedName}
                        </p>
                      )}
                    </div>
                    {unread > 0 && <span className="shrink-0 rounded-full bg-[#FE560D] px-2 py-0.5 text-[10.5px] font-bold text-white">{unread}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right — active conversation or placeholder */}
      <div className={cn('min-w-0 flex-1 overflow-hidden rounded-[24px]', SURFACE.card, PANEL_FRAME)}>
        {conversationId ? (
          <MobileSupportConversationScreen embedded />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Holder icon={MessageCircle} size="lg" />
            <p className={cn('mt-4 text-[15px] font-bold', TEXT.strong)}>{t('admin.listTitle')}</p>
            <p className={cn('mt-1 max-w-xs text-[13px]', TEXT.muted)}>{t('admin.consoleEmptyHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
