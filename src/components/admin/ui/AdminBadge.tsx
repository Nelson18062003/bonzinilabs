import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

interface AdminBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: LucideIcon;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'admin-badge-success',
  warning: 'admin-badge-warning',
  error: 'admin-badge-error',
  info: 'admin-badge-info',
  neutral: 'admin-badge-neutral',
  primary: 'admin-badge-primary',
};

export function AdminBadge({
  children,
  variant = 'neutral',
  icon: Icon,
  className,
}: AdminBadgeProps) {
  return (
    <span className={cn('admin-badge', variantClasses[variant], className)}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

// Preset status badges
interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Deposit status badge
export function DepositStatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    SUBMITTED: { variant: 'neutral', label: 'Soumis' },
    PROOF_UPLOADED: { variant: 'info', label: 'Preuve reçue' },
    UNDER_VERIFICATION: { variant: 'warning', label: 'En vérification' },
    VALIDATED: { variant: 'success', label: 'Validé' },
    REJECTED: { variant: 'error', label: 'Rejeté' },
  };

  const { variant, label } = config[status] || { variant: 'neutral', label: status };

  return <AdminBadge variant={variant} className={className}>{label}</AdminBadge>;
}

// Payment status badge
export function PaymentStatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    SUBMITTED: { variant: 'neutral', label: 'Soumis' },
    INFO_RECEIVED: { variant: 'info', label: 'Infos reçues' },
    READY_TO_PAY: { variant: 'primary', label: 'Prêt à payer' },
    PROCESSING: { variant: 'warning', label: 'En cours' },
    COMPLETED: { variant: 'success', label: 'Effectué' },
    PROOF_AVAILABLE: { variant: 'success', label: 'Preuve dispo' },
    CANCELLED: { variant: 'error', label: 'Annulé' },
  };

  const { variant, label } = config[status] || { variant: 'neutral', label: status };

  return <AdminBadge variant={variant} className={className}>{label}</AdminBadge>;
}

// Client status badge
export function ClientStatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Actif' },
    INACTIVE: { variant: 'neutral', label: 'Inactif' },
    SUSPENDED: { variant: 'error', label: 'Suspendu' },
    PENDING_KYC: { variant: 'warning', label: 'KYC en attente' },
  };

  const { variant, label } = config[status] || { variant: 'neutral', label: status };

  return <AdminBadge variant={variant} className={className}>{label}</AdminBadge>;
}

// Wallet operation type badge
export function WalletOperationBadge({ type, className }: { type: string; className?: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    CREDIT: { variant: 'success', label: 'Crédit' },
    DEBIT: { variant: 'error', label: 'Débit' },
    ADJUSTMENT: { variant: 'warning', label: 'Ajustement' },
  };

  const { variant, label } = config[type] || { variant: 'neutral', label: type };

  return <AdminBadge variant={variant} className={className}>{label}</AdminBadge>;
}
