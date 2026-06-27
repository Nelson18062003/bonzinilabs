// ============================================================
// MODULE DEPOTS — CountdownTimer
// 48h countdown with urgency levels + progress bar
// Supports default (card) and banner (left-accent) variants
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_DEADLINE_HOURS = 48;

type Urgency = 'normal' | 'warning' | 'critical' | 'expired';

interface TimerState {
  formattedTime: string;
  percentRemaining: number;
  isExpired: boolean;
  urgency: Urgency;
}

function computeTimer(createdAt: string, deadlineHours: number): TimerState {
  const created = new Date(createdAt).getTime();
  const deadline = created + deadlineHours * 3_600_000;
  const now = Date.now();
  const remaining = Math.max(0, deadline - now);
  const total = deadlineHours * 3_600_000;
  const percentRemaining = Math.max(0, Math.min(100, (remaining / total) * 100));
  const isExpired = remaining <= 0;

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const formattedTime = isExpired
    ? '00:00:00'
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let urgency: Urgency = 'normal';
  if (isExpired) urgency = 'expired';
  else if (hours < 4) urgency = 'critical';
  else if (hours < 12) urgency = 'warning';

  return { formattedTime, percentRemaining, isExpired, urgency };
}

interface CountdownTimerProps {
  createdAt: string;
  deadlineHours?: number;
  compact?: boolean;
  variant?: 'default' | 'banner';
  onExpire?: () => void;
}

const URGENCY_STYLES = {
  expired: {
    icon: XCircle,
    textColor: 'text-[#8E8BA0] dark:text-[#9B98AD]',
    bgColor: 'bg-[#F0EFF5] dark:bg-white/[0.04]',
    borderColor: 'border-transparent',
    progressColor: 'bg-[#C7C4D6]',
    iconColor: 'text-[#8E8BA0] dark:text-[#9B98AD]',
    bannerBorder: 'border-[#C7C4D6]',
    bannerBg: 'bg-[#F0EFF5] dark:bg-white/[0.04]',
  },
  critical: {
    icon: AlertTriangle,
    textColor: 'text-[#C0504D] dark:text-[#E79A9A]',
    bgColor: 'bg-[#FBE7E7] dark:bg-[#3A2526]',
    borderColor: 'border-[#C0504D]/25',
    progressColor: 'bg-[#C0504D]',
    iconColor: 'text-[#C0504D] dark:text-[#E79A9A]',
    bannerBorder: 'border-[#C0504D]',
    bannerBg: 'bg-[#FBE7E7] dark:bg-[#3A2526]',
  },
  warning: {
    icon: Clock,
    textColor: 'text-[#9A6B12] dark:text-[#E7C083]',
    bgColor: 'bg-[#F8EFD8] dark:bg-[#372D14]',
    borderColor: 'border-[#E8932A]/25',
    progressColor: 'bg-[#E8932A]',
    iconColor: 'text-[#9A6B12] dark:text-[#E7C083]',
    bannerBorder: 'border-[#E8932A]',
    bannerBg: 'bg-[#F8EFD8] dark:bg-[#372D14]',
  },
  normal: {
    icon: Clock,
    textColor: 'text-[#5B4CC4] dark:text-[#B5AAF0]',
    bgColor: 'bg-[#EAE7FA] dark:bg-[#272252]',
    borderColor: 'border-[#8B5CF6]/25',
    progressColor: 'bg-[#8B5CF6]',
    iconColor: 'text-[#5B4CC4] dark:text-[#B5AAF0]',
    bannerBorder: 'border-[#8B5CF6]',
    bannerBg: 'bg-[#EAE7FA] dark:bg-[#272252]',
  },
} as const;

export function CountdownTimer({
  createdAt,
  deadlineHours = DEFAULT_DEADLINE_HOURS,
  compact = false,
  variant = 'default',
  onExpire,
}: CountdownTimerProps) {
  const { t } = useTranslation('deposits');
  const [timer, setTimer] = useState<TimerState>(() =>
    computeTimer(createdAt, deadlineHours),
  );

  const tick = useCallback(() => {
    setTimer(computeTimer(createdAt, deadlineHours));
  }, [createdAt, deadlineHours]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    if (timer.isExpired && onExpire) onExpire();
  }, [timer.isExpired, onExpire]);

  const styles = URGENCY_STYLES[timer.urgency];
  const IconComponent = styles.icon;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', styles.textColor)}>
        <IconComponent className={cn('w-4 h-4', styles.iconColor)} />
        <span className="text-[13px] font-bold tabular-nums">{timer.formattedTime}</span>
      </div>
    );
  }

  // Banner variant: left-border accent style
  if (variant === 'banner') {
    return (
      <div className={cn('rounded-2xl border-l-4 p-4', styles.bannerBorder, styles.bannerBg)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconComponent className={cn('w-4 h-4', styles.iconColor)} />
            <span className={cn('text-sm font-medium', styles.textColor)}>
              {timer.isExpired ? t('countdown.expiredBanner') : t('countdown.remainingBanner')}
            </span>
          </div>
          <span className={cn('text-base font-bold tabular-nums', styles.textColor)}>
            {timer.formattedTime}
          </span>
        </div>

        <div className="relative h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-1000',
              styles.progressColor,
            )}
            style={{ width: `${timer.percentRemaining}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {timer.isExpired
            ? t('countdown.expiredBannerMessage')
            : timer.urgency === 'critical'
              ? t('countdown.criticalBannerWarning')
              : timer.urgency === 'warning'
                ? t('countdown.warningBannerMessage')
                : t('countdown.normalBannerMessage')}
        </p>
      </div>
    );
  }

  // Default variant: card style
  return (
    <div className={cn('rounded-2xl border p-4', styles.bgColor, styles.borderColor)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent className={cn('w-5 h-5', styles.iconColor)} />
          <span className={cn('font-medium', styles.textColor)}>
            {timer.isExpired ? t('countdown.expired') : t('countdown.remaining')}
          </span>
        </div>
        <span className={cn('text-lg font-bold tabular-nums', styles.textColor)}>
          {timer.formattedTime}
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-1000',
            styles.progressColor,
          )}
          style={{ width: `${timer.percentRemaining}%` }}
        />
      </div>

      {!timer.isExpired && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {timer.urgency === 'critical'
            ? t('countdown.criticalWarning')
            : timer.urgency === 'warning'
              ? t('countdown.warningMessage')
              : t('countdown.normalMessage')}
        </p>
      )}

      {timer.isExpired && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {t('countdown.expiredMessage')}
        </p>
      )}
    </div>
  );
}
