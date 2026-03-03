import { cn } from '@/lib/utils';

interface StepProgressBarProps {
  steps: { key: string; label: string }[];
  currentStepIndex: number;
}

export function StepProgressBar({ steps, currentStepIndex }: StepProgressBarProps) {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-1.5">
        {steps.map((step, i) => (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={cn(
                'h-1 w-full rounded-full transition-colors duration-300',
                i <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium transition-colors',
                i <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
