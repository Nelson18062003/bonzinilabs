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

const TYPE_CONFIG: Record<AdminNotificationType, {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}> = {
  deposit_needs_review: {
    icon: ArrowDownToLine,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  deposit_needs_correction: {
    icon: AlertCircle,
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  payment_ready: {
    icon: ArrowUpFromLine,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  payment_processing: {
    icon: Clock,
    iconColor: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
};

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "'Aujourd''hui à' HH:mm", { locale: fr });
  if (isYesterday(date)) return format(date, "'Hier à' HH:mm", { locale: fr });
  return format(date, "dd MMM 'à' HH:mm", { locale: fr });
}

export function MobileNotificationsScreen() {
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
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Notifications" backTo="/m/more" showBack />

      <PullToRefresh onRefresh={refetch} className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {isLoading ? (
          <SkeletonListScreen count={6} />
        ) : groupKeys.length > 0 ? (
          <div className="space-y-6">
            {groupKeys.map((dateKey) => (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {dateKey}
                </p>
                <div className="space-y-2">
                  {grouped![dateKey].map((notif) => {
                    const config = TYPE_CONFIG[notif.type];
                    const Icon = config.icon;

                    return (
                      <button
                        key={notif.id}
                        onClick={() => navigate(notif.targetPath)}
                        className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            config.bgColor,
                          )}>
                            <Icon className={cn('w-5 h-5', config.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{notif.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {notif.subtitle}
                                </p>
                              </div>
                              <p className="font-semibold text-sm flex-shrink-0">
                                {formatXAF(notif.amount)}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">{t('allUpToDate', { defaultValue: 'Tout est à jour' })}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('noPendingItems', { defaultValue: "Aucun élément en attente d'action" })}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
