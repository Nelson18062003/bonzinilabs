import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import type { AdminNotificationType } from '@/hooks/useAdminNotifications';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { formatXAF } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  Clock,
  Bell,
} from 'lucide-react';
import { SURFACE, TEXT, type Tone, Card, Holder, SectionTitle } from '@/mobile/designKit';

// Notification type → icon + unified tone (color carries meaning only).
const TYPE_CONFIG: Record<AdminNotificationType, { icon: React.ElementType; tone: Tone }> = {
  deposit_needs_review: { icon: ArrowDownToLine, tone: 'info' },
  deposit_needs_correction: { icon: AlertCircle, tone: 'pending' },
  payment_ready: { icon: ArrowUpFromLine, tone: 'info' },
  payment_processing: { icon: Clock, tone: 'info' },
};

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "'Aujourd''hui à' HH:mm", { locale: fr });
  if (isYesterday(date)) return format(date, "'Hier à' HH:mm", { locale: fr });
  return format(date, "dd MMM 'à' HH:mm", { locale: fr });
}

export function MobileNotificationsScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const { data: notifications, isLoading, refetch } = useAdminNotifications();
  const navigate = useNavigate();

  // Group by date
  const grouped = notifications?.reduce<Record<string, typeof notifications>>((acc, notif) => {
    const date = new Date(notif.createdAt);
    let key: string;
    if (isToday(date)) key = "Aujourd'hui";
    else if (isYesterday(date)) key = 'Hier';
    else key = format(date, 'dd MMMM yyyy', { locale: fr });

    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {});

  const groupKeys = grouped ? Object.keys(grouped) : [];

  return (
    <div className={desktop ? 'mx-auto max-w-3xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-5">
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Notifications</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>Éléments en attente d'action</p>
        </header>
      ) : (
        <MobileHeader title="Notifications" backTo="/m/more" showBack />
      )}

      <PullToRefresh onRefresh={refetch} className={desktop ? 'space-y-6' : cn('flex-1 space-y-4 overflow-y-auto px-4 py-5', SURFACE.canvas)}>
        {isLoading ? (
          <SkeletonListScreen count={6} />
        ) : groupKeys.length > 0 ? (
          <div className="space-y-6">
            {groupKeys.map((dateKey) => (
              <div key={dateKey}>
                <SectionTitle>{dateKey}</SectionTitle>
                <div className="space-y-2">
                  {grouped![dateKey].map((notif) => {
                    const config = TYPE_CONFIG[notif.type];
                    return (
                      <button
                        key={notif.id}
                        onClick={() => navigate(notif.targetPath)}
                        className={cn('w-full rounded-[22px] p-4 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
                      >
                        <div className="flex items-start gap-3">
                          <Holder icon={config.icon} tone={config.tone} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{notif.title}</p>
                                <p className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>
                                  {notif.subtitle}
                                </p>
                              </div>
                              <p className={cn('shrink-0 text-[14px] font-bold tabular-nums', TEXT.strong)}>
                                {formatXAF(notif.amount)}
                              </p>
                            </div>
                            <p className={cn('mt-1 text-[10px]', TEXT.muted)}>
                              {formatRelativeDate(notif.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={Bell} size="lg" />
            <p className={cn('mt-4 font-semibold', TEXT.strong)}>{t('allUpToDate', { defaultValue: 'Tout est à jour' })}</p>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>
              {t('noPendingItems', { defaultValue: "Aucun élément en attente d'action" })}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
