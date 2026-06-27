// Barre de progression du wizard — Direction A (designKit). Segment fait =
// violet (accent de progression, comme le module Taux) ; à venir = piste ténue.
import { cn } from '@/lib/utils';
import { TEXT } from '@/mobile/designKit';

interface StepProgressBarProps {
  steps: { key: string; label: string }[];
  currentStepIndex: number;
}

export function StepProgressBar({ steps, currentStepIndex }: StepProgressBarProps) {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-1.5">
        {steps.map((step, i) => {
          const done = i <= currentStepIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors duration-300',
                  done ? 'bg-[#8B5CF6]' : 'bg-black/[0.07] dark:bg-white/[0.09]',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-bold transition-colors',
                  done ? 'text-[#5B4CC4] dark:text-[#B5AAF0]' : TEXT.muted,
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
