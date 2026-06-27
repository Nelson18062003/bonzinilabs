// ============================================================
// MODULE DEPOTS — DepositTimelineDisplay (refonte « Direction A »).
// Suivi en jalons cycle de vie : vert = fait · lilas = en cours côté
// Bonzini · rouge = action requise / refusé / annulé · gris = à venir.
// API inchangée (steps issus de buildDepositTimelineSteps, variant).
// ============================================================
import { Check, AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineStepUI } from '@/lib/depositTimeline';
import { TEXT } from '@/mobile/designKit';

const GREEN = '#2E7D52', LILAC = '#8B5CF6', RED = '#C0504D';

interface DepositTimelineDisplayProps {
  steps: TimelineStepUI[];
  className?: string;
  variant?: 'default' | 'compact';
}

/** Couleur + icône du jalon courant selon sa nature. */
function currentTone(key: string): { color: string; Icon: typeof Check; spin?: boolean } {
  if (key === 'validated') return { color: GREEN, Icon: Check };
  if (key === 'rejected' || key === 'cancelled') return { color: RED, Icon: X };
  if (key === 'correction_requested') return { color: RED, Icon: AlertCircle };
  return { color: LILAC, Icon: Loader2, spin: true };
}

export function DepositTimelineDisplay({ steps, className }: DepositTimelineDisplayProps) {
  return (
    <div className={cn('relative', className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const done = step.status === 'completed';
        const current = step.status === 'current';
        const tone = current ? currentTone(step.key) : null;
        const dotColor = done ? GREEN : tone?.color;
        const Icon = done ? Check : tone?.Icon;
        const next = steps[index + 1];
        const lineColor = done && next && (next.status === 'completed' || next.status === 'current') ? GREEN : undefined;

        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              {dotColor && Icon ? (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: dotColor }}>
                  <Icon className={cn('h-3 w-3 text-white', tone?.spin && 'animate-spin')} strokeWidth={3} />
                </div>
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full border-2 border-black/[0.10] dark:border-white/[0.12]" />
              )}
              {!last && (
                <div
                  className={cn('my-1 w-0.5 flex-1', !lineColor && 'bg-black/[0.08] dark:bg-white/[0.10]')}
                  style={{ minHeight: 16, ...(lineColor ? { background: lineColor } : {}) }}
                />
              )}
            </div>

            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-3')}>
              <p className={cn('text-[14px] font-bold', step.status === 'pending' ? TEXT.muted : TEXT.strong)}>{step.label}</p>
              {step.description && step.status !== 'pending' && (
                <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{step.description}</p>
              )}
              {step.formattedDate && <p className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{step.formattedDate}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
