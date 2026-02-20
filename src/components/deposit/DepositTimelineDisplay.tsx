// ============================================================
// MODULE DEPOTS — DepositTimelineDisplay
// Visual timeline with step indicators (default + compact variant)
// ============================================================
import {
  Check,
  Clock,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineStepUI } from '@/lib/depositTimeline';
import { getStepColors } from '@/lib/depositTimeline';

function getIcon(stepKey: string, status: 'completed' | 'current' | 'pending') {
  if (status === 'completed') return Check;

  switch (stepKey) {
    case 'created':
      return Clock;
    case 'proof_submitted':
      return FileText;
    case 'admin_review':
      return Search;
    case 'validated':
      return CheckCircle;
    case 'correction_requested':
      return AlertCircle;
    case 'rejected':
      return XCircle;
    case 'cancelled':
      return Ban;
    default:
      return Clock;
  }
}

interface DepositTimelineDisplayProps {
  steps: TimelineStepUI[];
  className?: string;
  variant?: 'default' | 'compact';
}

export function DepositTimelineDisplay({ steps, className, variant = 'default' }: DepositTimelineDisplayProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn('relative', className)}>
      {steps.map((step, index) => {
        const Icon = getIcon(step.key, step.status);
        const isLast = index === steps.length - 1;
        const colorClasses = getStepColors(step.key, step.status);

        return (
          <div
            key={step.id}
            className={cn(
              'flex',
              isCompact ? 'gap-3 pb-4 last:pb-0' : 'gap-4 pb-6 last:pb-0',
            )}
          >
            {/* Circle + connector line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'rounded-full flex items-center justify-center transition-all border-2',
                  isCompact ? 'w-7 h-7' : 'w-10 h-10',
                  colorClasses,
                )}
              >
                <Icon className={isCompact ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 mt-1.5',
                    isCompact ? 'w-px min-h-[16px]' : 'w-0.5 mt-2 min-h-[24px]',
                    step.status === 'completed' ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>

            {/* Label + description + date + badge */}
            <div className={cn('flex-1', isCompact ? 'pt-1' : 'pt-2')}>
              <p
                className={cn(
                  isCompact ? 'text-sm font-medium' : 'font-medium',
                  step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </p>

              {step.description && step.status !== 'pending' && (
                <p className={cn('text-muted-foreground mt-0.5', isCompact ? 'text-xs' : 'text-sm')}>
                  {step.description}
                </p>
              )}

              {step.formattedDate && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.formattedDate}</p>
              )}

              {/* Status badges */}
              {step.status === 'current' &&
                !['validated', 'rejected', 'correction_requested', 'cancelled'].includes(step.key) && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-primary font-medium mt-1 bg-primary/10 px-2 py-0.5 rounded-full',
                    isCompact ? 'text-[10px]' : 'text-xs',
                  )}>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    En cours
                  </span>
                )}

              {step.status === 'current' && step.key === 'validated' && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-emerald-600 font-medium mt-1 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full',
                    isCompact ? 'text-[10px]' : 'text-xs',
                  )}>
                    <CheckCircle className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                    Terminé
                  </span>
                )}

              {step.status === 'current' && step.key === 'rejected' && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-destructive font-medium mt-1 bg-destructive/10 px-2 py-0.5 rounded-full',
                  isCompact ? 'text-[10px]' : 'text-xs',
                )}>
                  <XCircle className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                  Rejeté
                </span>
              )}

              {step.status === 'current' && step.key === 'correction_requested' && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-amber-600 font-medium mt-1 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full',
                  isCompact ? 'text-[10px]' : 'text-xs',
                )}>
                  <AlertCircle className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                  Action requise
                </span>
              )}

              {step.status === 'current' && step.key === 'cancelled' && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-gray-500 font-medium mt-1 bg-gray-500/10 px-2 py-0.5 rounded-full',
                  isCompact ? 'text-[10px]' : 'text-xs',
                )}>
                  <Ban className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                  Annulé
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
