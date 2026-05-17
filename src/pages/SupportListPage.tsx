import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Plus, Loader2, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ResponseTimeBadge } from '@/components/support/ResponseTimeBadge';
import { useMyChatConversations, useCreateChatConversation } from '@/hooks/useClientChat';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Locale } from 'date-fns';

const SupportListPage = () => {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useMyChatConversations();
  const create = useCreateChatConversation();
  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => !cancelled && setLocale(l));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    const s = subject.trim();
    if (!s) return;
    try {
      const conv = await create.mutateAsync({ subject: s });
      setSubject('');
      setShowNewForm(false);
      navigate(`/support/${conv.id}`);
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  const list = conversations ?? [];

  return (
    <MobileLayout>
      <div className="flex min-h-[100dvh] flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div>
            <h1 className="text-base font-semibold text-foreground">{t('page.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('page.subtitle')}</p>
          </div>
          <ResponseTimeBadge compact />
        </header>

        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {showNewForm ? (
                <div className="border-b border-border bg-bonzini-violet/5 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {t('list.newSubjectLabel')}
                  </p>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('list.newSubjectPlaceholder')}
                    maxLength={80}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewForm(false);
                        setSubject('');
                      }}
                      className="flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      {t('list.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!subject.trim() || create.isPending}
                      className={cn(
                        'flex-1 rounded-xl bg-bonzini-violet px-3 py-2 text-sm font-medium text-white',
                        (!subject.trim() || create.isPending) && 'opacity-50'
                      )}
                    >
                      {create.isPending ? '…' : t('list.create')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewForm(true)}
                  className="flex w-full items-center gap-3 border-b border-border bg-bonzini-violet/5 p-4 text-left transition-colors active:bg-bonzini-violet/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bonzini-violet text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('list.newConversation')}</p>
                    <p className="text-xs text-muted-foreground">{t('list.newConversationHint')}</p>
                  </div>
                </button>
              )}

              {list.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((c) => {
                    const unread = c.unread_count_client;
                    const time = c.last_message_at
                      ? formatDistanceToNow(new Date(c.last_message_at), {
                          addSuffix: false,
                          locale,
                        })
                      : '';
                    const title = c.subject || t('list.defaultSubject');
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/support/${c.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/40"
                        >
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                              unread > 0 ? 'bg-bonzini-violet text-white' : 'bg-muted text-muted-foreground',
                              c.status === 'closed' && 'opacity-50'
                            )}
                          >
                            <MessageCircle className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={cn(
                                  'truncate text-sm',
                                  unread > 0 ? 'font-semibold' : 'font-medium',
                                  c.status === 'closed' && 'text-muted-foreground'
                                )}
                              >
                                {title}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
                            </div>
                            {c.status === 'closed' && (
                              <span className="text-[11px] text-muted-foreground">
                                {t('list.closedBadge')}
                              </span>
                            )}
                          </div>
                          {unread > 0 && (
                            <span className="shrink-0 rounded-full bg-bonzini-orange px-2 py-0.5 text-[11px] font-semibold text-white">
                              {unread}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default SupportListPage;
