import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  useMyNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  getNotificationStyle,
  getNotificationPath,
  type Notification,
} from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CheckCheck,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { data: notifications, isLoading, error } = useMyNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const { t, i18n } = useTranslation('notifications');
  const dateLocale = i18n.language?.startsWith('fr') ? fr : enUS;

  const hasUnread = notifications?.some((n) => !n.is_read);

  const getIcon = (type: string) => {
    const style = getNotificationStyle(type as Notification['type']);
    switch (style.icon) {
      case 'check-circle': return CheckCircle;
      case 'x-circle': return XCircle;
      case 'alert-circle': return AlertCircle;
      default: return Bell;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead.mutateAsync(notification.id);
    }
    const path = getNotificationPath(notification);
    navigate(path);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title={t('title')} showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-12 text-center">
          <p className="text-destructive">{t('loading_error')}</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader
        title={t('title')}
        showBack
        rightElement={
          hasUnread ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="text-primary"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              {t('mark_all_read')}
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 py-4 space-y-2">
        {notifications && notifications.length > 0 ? (
          notifications.map((notification, index) => {
            const style = getNotificationStyle(notification.type);
            const IconComponent = getIcon(notification.type);

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'card-elevated p-4 cursor-pointer transition-all animate-slide-up',
                  notification.is_read
                    ? 'opacity-60 hover:opacity-80'
                    : 'border-l-4 border-l-primary hover:border-primary/30'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      style.bgColor
                    )}
                  >
                    <IconComponent className={cn('w-5 h-5', style.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'font-semibold text-foreground',
                            !notification.is_read && 'text-primary'
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(notification.created_at), "dd MMM yyyy 'à' HH:mm", {
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                </div>

                {!notification.is_read && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('no_notifications')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('no_notifications_hint')}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default NotificationsPage;
