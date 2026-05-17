import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { SearchField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getDateFnsLocale } from '@/i18n';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';

export function MobileSupportListScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data: conversations, isLoading } = useAdminConversations();
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => {
      if (!cancelled) setLocale(l);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = conversations ?? [];
    if (filter === 'unread') {
      list = list.filter((c) => c.unread_count_admin > 0);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((c) => {
        const name = `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.toLowerCase();
        const phone = (c.client_phone ?? '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    }
    return list;
  }, [conversations, filter, debouncedSearch]);

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader title={t('admin.listTitle')} />

      <div className="px-4 py-3 space-y-3 border-b border-border">
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder={t('admin.searchPlaceholder')}
        />

        <MobileFilterChips<'all' | 'unread'>
          filters={[
            { value: 'all', label: t('admin.filterAll') },
            { value: 'unread', label: t('admin.filterUnread') },
          ]}
          activeKey={filter}
          onChange={setFilter}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <MobileEmptyState
          icon={MessageCircle}
          title={t('admin.listEmpty')}
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
                      unread > 0
                        ? 'bg-bonzini-violet text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {(c.client_first_name?.[0] ?? '?').toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {time}
                      </span>
                    </div>
                    <p className={cn('truncate text-xs mt-0.5', unread > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                      {c.last_message_preview || '—'}
                    </p>
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
