import { Check, Clock, AlertCircle, Play, CheckCircle2, XCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentStatus = 'created' | 'waiting_beneficiary_info' | 'ready_for_payment' | 'processing' | 'completed' | 'rejected';

interface PaymentStepperProps {
  currentStatus: PaymentStatus;
}

interface Step {
  key: string;
  label: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  { key: 'created', label: 'Créé', icon: Clock },
  { key: 'beneficiary', label: 'Infos bénéficiaire', icon: User },
  { key: 'ready', label: 'Prêt à payer', icon: AlertCircle },
  { key: 'processing', label: 'En cours', icon: Play },
  { key: 'completed', label: 'Effectué', icon: CheckCircle2 },
];

const getStepIndex = (status: PaymentStatus): number => {
  switch (status) {
    case 'created':
      return 0;
    case 'waiting_beneficiary_info':
      return 1;
    case 'ready_for_payment':
      return 2;
    case 'processing':
      return 3;
    case 'completed':
      return 4;
    case 'rejected':
      return -1; // Special case
    default:
      return 0;
  }
};

export function PaymentStepper({ currentStatus }: PaymentStepperProps) {
  const currentStepIndex = getStepIndex(currentStatus);
  const isRejected = currentStatus === 'rejected';

  if (isRejected) {
    return (
      <div className="flex items-center justify-center p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <XCircle className="w-5 h-5 text-destructive mr-2" />
        <span className="font-medium text-destructive">Paiement refusé</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted mx-8" />
        
        {/* Progress line active */}
        <div 
          className="absolute top-5 left-0 h-0.5 bg-primary mx-8 transition-all duration-500"
          style={{ 
            width: `calc(${(currentStepIndex / (steps.length - 1)) * 100}% - 4rem)`,
          }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          const StepIcon = step.icon;

          return (
            <div 
              key={step.key} 
              className="flex flex-col items-center relative z-10"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className={cn("w-5 h-5", isCurrent && "animate-pulse")} />
                )}
              </div>
              <span 
                className={cn(
                  "text-xs mt-2 text-center max-w-[70px] leading-tight",
                  isCompleted && "text-primary font-medium",
                  isCurrent && "text-foreground font-semibold",
                  isPending && "text-muted-foreground"
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
