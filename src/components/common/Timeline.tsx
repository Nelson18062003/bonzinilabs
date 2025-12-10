import { Check, Clock, Upload, Search, AlertCircle } from 'lucide-react';
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

interface TimelineProps {
  steps: TimelineStep[];
}

const getStepIcon = (status: string) => {
  const icons: Record<string, typeof Check> = {
    SUBMITTED: Clock,
    PROOF_UPLOADED: Upload,
    UNDER_VERIFICATION: Search,
    VALIDATED: Check,
    REJECTED: AlertCircle,
    INFO_RECEIVED: Check,
    PROCESSING: Clock,
    COMPLETED: Check,
    PROOF_AVAILABLE: Check,
  };
  return icons[status] || Clock;
};

export const Timeline = ({ steps }: TimelineProps) => {
  return (
    <div className="relative">
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.status);
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Line and Dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                step.isCompleted || step.isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                <Icon className="w-4 h-4" />
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 mt-2',
                  step.isCompleted ? 'bg-primary' : 'bg-border'
                )} />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 pt-1">
              <p className={cn(
                'font-medium',
                step.isCompleted || step.isCurrent
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}>
                {step.description}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(step.createdAt, 'dd MMM yyyy, HH:mm', { locale: fr })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
