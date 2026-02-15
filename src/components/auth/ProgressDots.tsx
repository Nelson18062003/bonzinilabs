import { cn } from '@/lib/utils';

interface ProgressDotsProps {
  totalSteps: number;
  currentStep: number;
  className?: string;
}

export function ProgressDots({ totalSteps, currentStep, className }: ProgressDotsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            i === currentStep
              ? 'w-8 bg-primary'
              : 'w-2 bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}
