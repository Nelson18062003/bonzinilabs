import { Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useDepositTimer } from '@/hooks/useDepositTimer';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface CountdownTimerProps {
  /** ISO string of when the deposit was created */
  createdAt: string;
  /** Optional custom deadline in hours (defaults to 48) */
  deadlineHours?: number;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Optional callback when timer expires */
  onExpire?: () => void;
}

export function CountdownTimer({
  createdAt,
  deadlineHours,
  compact = false,
  onExpire
}: CountdownTimerProps) {
  const timer = useDepositTimer(createdAt, deadlineHours);

  // Call onExpire when timer expires
  if (timer.isExpired && onExpire) {
    onExpire();
  }

  // Get colors and icon based on urgency
  const getUrgencyStyles = () => {
    switch (timer.urgency) {
      case 'expired':
        return {
          icon: XCircle,
          textColor: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          borderColor: 'border-muted',
          progressColor: 'bg-muted',
          iconColor: 'text-muted-foreground',
        };
      case 'critical':
        return {
          icon: AlertTriangle,
          textColor: 'text-destructive',
          bgColor: 'bg-destructive/5',
          borderColor: 'border-destructive/30',
          progressColor: 'bg-destructive',
          iconColor: 'text-destructive',
        };
      case 'warning':
        return {
          icon: Clock,
          textColor: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          progressColor: 'bg-amber-500',
          iconColor: 'text-amber-600',
        };
      default:
        return {
          icon: Clock,
          textColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          progressColor: 'bg-emerald-500',
          iconColor: 'text-emerald-600',
        };
    }
  };

  const styles = getUrgencyStyles();
  const IconComponent = styles.icon;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', styles.textColor)}>
        <IconComponent className={cn('w-4 h-4', styles.iconColor)} />
        <span className="text-sm font-medium">{timer.formattedTime}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border p-4',
      styles.bgColor,
      styles.borderColor
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent className={cn('w-5 h-5', styles.iconColor)} />
          <span className={cn('font-medium', styles.textColor)}>
            {timer.isExpired ? 'Délai dépassé' : 'Délai restant'}
          </span>
        </div>
        <span className={cn('text-lg font-bold tabular-nums', styles.textColor)}>
          {timer.formattedTime}
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-1000',
            styles.progressColor
          )}
          style={{ width: `${timer.percentRemaining}%` }}
        />
      </div>

      {!timer.isExpired && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {timer.urgency === 'critical'
            ? 'Attention: délai presque écoulé !'
            : timer.urgency === 'warning'
            ? 'Pensez à envoyer votre preuve rapidement'
            : 'Effectuez le dépôt et envoyez la preuve'}
        </p>
      )}

      {timer.isExpired && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Le délai recommandé est dépassé, mais vous pouvez toujours envoyer votre preuve
        </p>
      )}
    </div>
  );
}
