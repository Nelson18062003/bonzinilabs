// ============================================================
// SupportListPage — liste des conversations client (refonte « Direction A »).
// En-tête + badge temps de réponse · carte/formulaire « Nouvelle
// conversation » · liste (non-lu lilas + compteur, fermé estompé) · vide.
// Logique 100% PRÉSERVÉE (conversations, création, nav). Le CHAT lui-même
// reste le design partagé admin↔client.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Plus, Loader2, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, type Locale } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ResponseTimeBadge } from '@/components/support/ResponseTimeBadge';
import { useMyChatConversations, useCreateChatConversation } from '@/hooks/useClientChat';
import { getDateFnsLocale } from '@/i18n';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';

const LILAC = '#8B5CF6';

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
      <div className={cn('min-h-[100dvh] space-y-5 px-4 pb-6 pt-6', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('page.title')}</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('page.subtitle')}</p>
          </div>
          <ResponseTimeBadge compact className="mt-1 px-2.5 py-1.5 text-[11px]" />
        </div>

        {/* Nouvelle conversation — carte ou formulaire */}
        {showNewForm ? (
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <p className={cn('mb-2 text-[13px] font-semibold', TEXT.strong)}>{t('list.newSubjectLabel')}</p>
            {/* input nu volontaire 16px (anti auto-zoom iOS) */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('list.newSubjectPlaceholder')}
              maxLength={80}
              autoFocus
              className={cn('h-12 w-full rounded-2xl px-4 text-[16px] outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD]')}
            />
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => { setShowNewForm(false); setSubject(''); }}
                className={cn('flex-1 py-[13px] text-[14px] font-semibold', SOFT_PILL)}
              >
                {t('list.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!subject.trim() || create.isPending}
                className={cn('flex flex-1 items-center justify-center gap-2 py-[13px] text-[14px] font-bold transition active:scale-[0.99]', !subject.trim() || create.isPending ? 'rounded-full bg-muted text-muted-foreground' : PRIMARY_PILL)}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('list.create')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
              <Plus className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('text-[17px] font-black', TEXT.strong)}>{t('list.newConversation')}</div>
              <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{t('list.newConversationHint')}</div>
            </div>
            <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
          </button>
        )}

        {/* Conversations */}
        {isLoading ? (
          <div className="space-y-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('h-[68px] animate-pulse rounded-[18px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className={cn('mt-2 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <MessageCircle className="h-7 w-7" />
            </div>
            <p className={cn('text-[15px] font-bold', TEXT.strong)}>{t('list.empty')}</p>
          </div>
        ) : (
          <section>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('list.sectionTitle', { defaultValue: 'Mes conversations' })}</h2>
            <div className="space-y-2.5">
              {list.map((c) => {
                const unread = c.unread_count_client;
                const time = c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale }) : '';
                const title = c.subject || t('list.defaultSubject');
                const closed = c.status === 'closed';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/support/${c.id}`)}
                    className={cn('flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow, closed && 'opacity-60')}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={unread > 0 ? { background: LILAC } : undefined}
                    >
                      <MessageCircle className={cn('h-5 w-5', unread > 0 ? 'text-white' : TEXT.muted)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[15px]', unread > 0 ? 'font-black' : 'font-bold', TEXT.strong)}>{title}</span>
                        {time && <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{time}</span>}
                      </div>
                      {closed && <span className={cn('mt-0.5 block text-[11px]', TEXT.muted)}>{t('list.closedBadge')}</span>}
                    </div>
                    {unread > 0 ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: LILAC }}>{unread}</span>
                    ) : (
                      <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </MobileLayout>
  );
};

export default SupportListPage;
