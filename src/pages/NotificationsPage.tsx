// ============================================================
// APP CLIENT — NotificationsPage · refonte « Direction A ».
// En-tête drill-in + « Tout marquer lu » · liste designKit (icône par
// type, non-lu = pleine opacité + point lilas, lu = estompé). Logique
// 100% PRÉSERVÉE (marquer lu / tout marquer, navigation au clic).
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Bell, CheckCircle2, XCircle, AlertCircle, Loader2, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { SURFACE, TEXT } from '@/mobile/designKit';
import {
  useMyNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  getNotificationStyle,
  getNotificationPath,
  type Notification,
} from '@/hooks/useNotifications';

const LILAC = '#8B5CF6';

// style.icon (getNotificationStyle) → tuile de ton designKit.
const TONE: Record<string, { box: string; Icon: typeof Bell }> = {
  'check-circle': { box: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]', Icon: CheckCircle2 },
  'x-circle': { box: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]', Icon: XCircle },
  'alert-circle': { box: 'bg-[#FDF1DD] text-[#9A6B12] dark:bg-[#3A2F1A] dark:text-[#E0B978]', Icon: AlertCircle },
  bell: { box: 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]', Icon: Bell },
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('client');
  const { data: notifications, isLoading, error } = useMyNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const hasUnread = notifications?.some((n) => !n.is_read);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) await markAsRead.mutateAsync(notification.id);
    navigate(getNotificationPath(notification));
  };

  const Header = (
    <div className="flex items-center gap-3 px-4 pb-1 pt-4">
      <button
        onClick={() => navigate(-1)}
        aria-label={t('notifications.title')}
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
      >
        <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
      </button>
      <span className={cn('flex-1 truncate text-[17px] font-black', TEXT.strong)}>{t('notifications.title')}</span>
      {hasUnread && (
        <button
          onClick={() => markAllAsRead.mutate()}
          disabled={markAllAsRead.isPending}
          className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#5B4CC4] active:opacity-70 disabled:opacity-50 dark:text-[#B5AAF0]"
        >
          <CheckCheck className="h-4 w-4" />
          {t('notifications.markAllRead')}
        </button>
      )}
    </div>
  );

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        {Header}

        <div className="space-y-2.5 px-4 py-4">
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className={cn('h-20 animate-pulse rounded-[18px]', SURFACE.card, SURFACE.shadow)} />
            ))
          ) : error ? (
            <div className={cn('mt-4 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
              <p className="text-[14px] text-[#C0504D] dark:text-[#E79A9A]">{t('notifications.loadError')}</p>
            </div>
          ) : notifications && notifications.length > 0 ? (
            notifications.map((n) => {
              const tone = TONE[getNotificationStyle(n.type).icon] ?? TONE.bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[18px] p-4 text-left transition active:scale-[0.99]',
                    SURFACE.card,
                    SURFACE.shadow,
                    n.is_read && 'opacity-60',
                  )}
                >
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone.box)}>
                    <tone.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[14px] font-bold', TEXT.strong)}>{n.title}</div>
                    <div className={cn('mt-0.5 line-clamp-2 text-[13px]', TEXT.muted)}>{n.message}</div>
                    <div className={cn('mt-1.5 text-[11px]', TEXT.muted)}>
                      {format(new Date(n.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: LILAC }} />}
                </button>
              );
            })
          ) : (
            <div className={cn('mt-4 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
              <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
                <Bell className="h-7 w-7" />
              </div>
              <p className={cn('text-[15px] font-bold', TEXT.strong)}>{t('notifications.noNotifications')}</p>
              <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('notifications.noNotificationsHint')}</p>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default NotificationsPage;
