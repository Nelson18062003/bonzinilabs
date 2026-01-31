import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * BONZINI Status Badge Component
 * Semantic status indicators with consistent styling
 */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        // Deposit statuses
        created: 'bg-blue-100 text-blue-700 border border-blue-200',
        waiting_validation: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
        validated: 'bg-green-100 text-green-700 border border-green-200',
        rejected: 'bg-red-100 text-red-700 border border-red-200',

        // Payment statuses
        waiting_beneficiary_info: 'bg-purple-100 text-purple-700 border border-purple-200',
        ready_for_payment: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
        waiting_cash_proof: 'bg-orange-100 text-orange-700 border border-orange-200',
        agent_delivered: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
        completed: 'bg-green-100 text-green-700 border border-green-200',
        cancelled: 'bg-gray-100 text-gray-700 border border-gray-200',

        // General statuses
        pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
        active: 'bg-green-100 text-green-700 border border-green-200',
        inactive: 'bg-gray-100 text-gray-700 border border-gray-200',
        error: 'bg-red-100 text-red-700 border border-red-200',
        success: 'bg-green-100 text-green-700 border border-green-200',
        warning: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
        info: 'bg-blue-100 text-blue-700 border border-blue-200',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'md',
    },
  }
);

export interface BonziniStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  label: string;
  showDot?: boolean;
  icon?: React.ReactNode;
}

const BonziniStatusBadge = React.forwardRef<HTMLSpanElement, BonziniStatusBadgeProps>(
  ({ className, status, size, label, showDot = true, icon, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ status, size }), className)} {...props}>
        {showDot && !icon && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {icon && icon}
        <span>{label}</span>
      </span>
    );
  }
);

BonziniStatusBadge.displayName = 'BonziniStatusBadge';

/**
 * Helper function to get French label for status
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // Deposit statuses
    created: 'Créé',
    waiting_validation: 'En attente',
    validated: 'Validé',
    rejected: 'Rejeté',

    // Payment statuses
    waiting_beneficiary_info: 'Attente infos',
    ready_for_payment: 'Prêt',
    waiting_cash_proof: 'Attente preuve',
    agent_delivered: 'Livré',
    completed: 'Terminé',
    cancelled: 'Annulé',

    // General
    pending: 'En attente',
    active: 'Actif',
    inactive: 'Inactif',
    error: 'Erreur',
    success: 'Succès',
    warning: 'Attention',
    info: 'Information',
  };

  return labels[status] || status;
}

export { BonziniStatusBadge, badgeVariants };
