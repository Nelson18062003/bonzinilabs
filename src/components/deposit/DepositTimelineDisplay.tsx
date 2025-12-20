import { Check, Clock, Upload, FileText, Search, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineStepUI, getStepColors } from '@/lib/depositTimeline';

interface DepositTimelineDisplayProps {
  steps: TimelineStepUI[];
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Check,
  Clock,
  Upload,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Wallet,
};

function getIcon(stepKey: string, status: 'completed' | 'current' | 'pending') {
  if (status === 'completed') return Check;
  
  switch (stepKey) {
    case 'created': return Clock;
    case 'awaiting_proof': return Upload;
    case 'proof_submitted': return FileText;
    case 'admin_review': return Search;
    case 'validated': return CheckCircle;
    case 'wallet_credited': return Wallet;
    case 'rejected': return XCircle;
    default: return Clock;
  }
}

export function DepositTimelineDisplay({ steps, className }: DepositTimelineDisplayProps) {
  return (
    <div className={cn('relative', className)}>
      {steps.map((step, index) => {
        const Icon = getIcon(step.key, step.status);
        const isLast = index === steps.length - 1;
        const colorClasses = getStepColors(step.key, step.status);
        
        return (
          <div key={step.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Line and Dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all border-2',
                colorClasses
              )}>
                <Icon className="w-5 h-5" />
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 mt-2 min-h-[24px]',
                  step.status === 'completed' ? 'bg-primary' : 'bg-border'
                )} />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 pt-2">
              <p className={cn(
                'font-medium',
                step.status === 'pending' 
                  ? 'text-muted-foreground' 
                  : 'text-foreground'
              )}>
                {step.label}
              </p>
              {step.description && step.status !== 'pending' && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              )}
              {step.formattedDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.formattedDate}
                </p>
              )}
              {step.status === 'current' && step.key !== 'validated' && step.key !== 'rejected' && (
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1 bg-primary/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  En cours
                </span>
              )}
              {step.status === 'current' && step.key === 'validated' && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Terminé
                </span>
              )}
              {step.status === 'current' && step.key === 'rejected' && (
                <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium mt-1 bg-destructive/10 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" />
                  Rejeté
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
