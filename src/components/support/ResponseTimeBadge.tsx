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
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
          'bg-bonzini-amber/10 text-bonzini-amber',
          className
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>—</span>
      </div>
    );
  }

  // Plafonnement et formatage humain.
  const clamped = Math.min(seconds, 60 * 60); // ≤ 60 min affiché
  let label: string;
  let tone: 'fast' | 'medium' | 'slow';
  if (clamped < 30) {
    label = t('responseTime.veryFast');
    tone = 'fast';
  } else if (clamped < 60) {
    label = t('responseTime.seconds', { count: Math.round(clamped) });
    tone = 'fast';
  } else if (clamped < 10 * 60) {
    label = t('responseTime.minutes', { count: Math.round(clamped / 60) });
    tone = 'fast';
  } else if (clamped < 30 * 60) {
    label = t('responseTime.minutes', { count: Math.round(clamped / 60) });
    tone = 'medium';
  } else {
    label = t('responseTime.minutes', { count: Math.round(clamped / 60) });
    tone = 'slow';
  }

  const toneClasses: Record<typeof tone, string> = {
    fast: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    medium: 'bg-bonzini-amber/10 text-bonzini-amber',
    slow: 'bg-bonzini-orange/10 text-bonzini-orange',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        toneClasses[tone],
        className
      )}
      title={t('responseTime.label')}
    >
      <Clock className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{compact ? label : `${t('responseTime.label')} : ${label}`}</span>
    </div>
  );
}
