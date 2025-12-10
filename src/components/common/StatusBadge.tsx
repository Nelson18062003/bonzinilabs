import { cn } from '@/lib/utils';

type StatusType = 'pending' | 'processing' | 'success' | 'error' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  pending: 'bg-warning/10 text-warning',
  processing: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-muted text-muted-foreground',
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  return (
    <span className={cn('status-badge', statusStyles[status], className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {label}
    </span>
  );
};

export const getStatusType = (status: string): StatusType => {
  const statusMap: Record<string, StatusType> = {
    SUBMITTED: 'pending',
    PROOF_UPLOADED: 'pending',
    UNDER_VERIFICATION: 'processing',
    VALIDATED: 'success',
    REJECTED: 'error',
    INFO_RECEIVED: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'success',
    PROOF_AVAILABLE: 'success',
    CANCELLED: 'error',
  };
  return statusMap[status] || 'info';
};
