import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useAvgResponseTime } from '@/hooks/useClientChat';
import { cn } from '@/lib/utils';

interface ResponseTimeBadgeProps {
  className?: string;
  compact?: boolean;
}

export function ResponseTimeBadge({ className, compact = false }: ResponseTimeBadgeProps) {
  const { t } = useTranslation('support');
  const { data: seconds, isLoading } = useAvgResponseTime();

  if (isLoading || seconds == null) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground',
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          className
        )}
      >
        <Clock className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        <span>—</span>
      </div>
    );
  }

  const clamped = Math.min(seconds, 60 * 60);
  let label: string;
  if (clamped < 30) {
    label = t('responseTime.veryFast');
  } else if (clamped < 60) {
    label = t('responseTime.seconds', { count: Math.round(clamped) });
  } else {
    label = t('responseTime.minutes', { count: Math.round(clamped / 60) });
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted font-medium text-muted-foreground',
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      title={t('responseTime.label')}
    >
      <Clock className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{compact ? label : `${t('responseTime.label')} : ${label}`}</span>
    </div>
  );
}
