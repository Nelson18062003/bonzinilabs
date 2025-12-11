import { Check, Clock, Upload, Search, AlertCircle, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimelineStep {
  id: string;
  status: string;
  description: string;
  createdAt: Date;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface DepositTimelineProps {
  steps: TimelineStep[];
}

const getStepIcon = (status: string, isCompleted: boolean, isCurrent: boolean) => {
  if (isCompleted) return Check;
  
  const icons: Record<string, typeof Check> = {
    SUBMITTED: FileCheck,
    AWAITING_DEPOSIT: Clock,
    PROOF_UPLOADED: Upload,
    UNDER_VERIFICATION: Search,
    VALIDATED: Check,
    REJECTED: AlertCircle,
  };
  return icons[status] || Clock;
};

export const DepositTimeline = ({ steps }: DepositTimelineProps) => {
  return (
    <div className="relative">
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.status, step.isCompleted, step.isCurrent);
        const isLast = index === steps.length - 1;
        const showDate = step.isCompleted || step.isCurrent;
        
        return (
          <div key={step.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Line and Dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all border-2',
                step.isCompleted 
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step.isCurrent
                    ? 'bg-primary/10 text-primary border-primary animate-pulse'
                    : 'bg-muted text-muted-foreground border-muted'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 mt-2 min-h-[24px]',
                  step.isCompleted ? 'bg-primary' : 'bg-border'
                )} />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 pt-2">
              <p className={cn(
                'font-medium',
                step.isCompleted || step.isCurrent
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}>
                {step.description}
              </p>
              {showDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(step.createdAt, 'dd MMM yyyy, HH:mm', { locale: fr })}
                </p>
              )}
              {step.isCurrent && (
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1 bg-primary/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  En cours
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
