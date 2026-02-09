import {
  Check,
  Clock,
  User,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  QrCode,
  ScanLine,
  Upload,
  Edit,
  Image,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentTimelineStepUI, getPaymentStepColors } from '@/lib/paymentTimeline';

interface PaymentTimelineDisplayProps {
  steps: PaymentTimelineStepUI[];
  className?: string;
}

function getIcon(stepKey: string, status: 'completed' | 'current' | 'pending') {
  if (status === 'completed') return Check;

  switch (stepKey) {
    case 'created': return Clock;
    case 'waiting_beneficiary_info': return User;
    case 'waiting_info': return User;
    case 'info_provided': return CheckCircle;
    case 'info_updated': return Edit;
    case 'instructions_uploaded': return Upload;
    case 'ready_for_payment': return CheckCircle;
    case 'processing': return Loader2;
    case 'proof_uploaded': return Image;
    case 'completed': return CheckCircle2;
    case 'cash_pending': return QrCode;
    case 'cash_scanned': return ScanLine;
    case 'rejected': return XCircle;
    default: return Clock;
  }
}

export function PaymentTimelineDisplay({ steps, className }: PaymentTimelineDisplayProps) {
  return (
    <div className={cn('relative', className)}>
      {steps.map((step, index) => {
        const Icon = getIcon(step.key, step.status);
        const isLast = index === steps.length - 1;
        const colorClasses = getPaymentStepColors(step.key, step.status, step.isExtraEvent);
        const isSpinning = step.status === 'current' && step.key === 'processing';

        return (
          <div key={step.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Line and Dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all border-2',
                colorClasses,
                step.isExtraEvent && step.status === 'completed' && 'w-8 h-8' // Slightly smaller for extra events
              )}>
                <Icon className={cn(
                  step.isExtraEvent ? 'w-4 h-4' : 'w-5 h-5',
                  isSpinning && 'animate-spin'
                )} />
              </div>
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 mt-2 min-h-[24px]',
                  step.status === 'completed' ? 'bg-primary' : 'bg-border',
                  step.isExtraEvent && 'bg-blue-300'
                )} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <p className={cn(
                'font-medium',
                step.status === 'pending'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
                step.isExtraEvent && 'text-sm text-blue-700'
              )}>
                {step.label}
              </p>
              {step.description && step.status !== 'pending' && (
                <p className={cn(
                  'text-sm text-muted-foreground mt-0.5',
                  step.isExtraEvent && 'text-xs'
                )}>
                  {step.description}
                </p>
              )}
              {step.formattedDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.formattedDate}
                </p>
              )}
              {step.status === 'current' && step.key !== 'completed' && step.key !== 'rejected' && (
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1 bg-primary/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  En cours
                </span>
              )}
              {step.status === 'current' && step.key === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Terminé
                </span>
              )}
              {step.status === 'current' && step.key === 'rejected' && (
                <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium mt-1 bg-destructive/10 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" />
                  Refusé
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
