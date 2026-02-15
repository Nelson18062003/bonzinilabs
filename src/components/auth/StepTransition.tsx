import { cn } from '@/lib/utils';

interface StepTransitionProps {
  stepKey: number | string;
  direction: 'forward' | 'back';
  children: React.ReactNode;
  className?: string;
}

export function StepTransition({ stepKey, direction, children, className }: StepTransitionProps) {
  return (
    <div
      key={stepKey}
      className={cn(
        'w-full',
        direction === 'forward' ? 'step-enter-right' : 'step-enter-left',
        className
      )}
    >
      {children}
    </div>
  );
}
