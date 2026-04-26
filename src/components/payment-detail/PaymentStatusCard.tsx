// ============================================================
// Reusable status narrative card.
// Drives the "what's happening / what's next" panel that sits
// under the hero on the client payment detail page. Each variant
// maps to a small palette and a default icon; callers can pass
// title + description + optional inline children (e.g. signature).
// ============================================================
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, CheckCircle2, Clock, Loader2, Lock, MessageCircle, ScanLine, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusCardVariant =
  | 'info'        // ready_for_payment, generic infos
  | 'success'     // completed
  | 'progress'    // processing (admin handling)
  | 'pending'     // waiting_beneficiary_info, cash_pending
  | 'scanned'     // cash_scanned
  | 'rejected'    // rejected
  | 'cancelled'   // cancelled_by_admin
  | 'message';    // generic Bonzini message

interface VariantStyle {
  container: string;
  icon: string;
  title: string;
  description: string;
  defaultIcon: LucideIcon;
}

const VARIANT_STYLES: Record<StatusCardVariant, VariantStyle> = {
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    icon: 'text-primary',
    title: 'text-primary',
    description: 'text-muted-foreground',
    defaultIcon: CheckCircle2,
  },
  success: {
    container: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    title: 'text-green-600 dark:text-green-400',
    description: 'text-muted-foreground',
    defaultIcon: CheckCircle2,
  },
  progress: {
    container: 'bg-bonzini-violet/10 dark:bg-bonzini-violet/15 border-bonzini-violet/30 dark:border-bonzini-violet/40',
    icon: 'text-bonzini-violet',
    title: 'text-bonzini-violet',
    description: 'text-muted-foreground',
    defaultIcon: Loader2,
  },
  pending: {
    container: 'bg-bonzini-amber/10 dark:bg-bonzini-amber/15 border-bonzini-amber/30 dark:border-bonzini-amber/40',
    icon: 'text-bonzini-amber',
    title: 'text-bonzini-amber',
    description: 'text-muted-foreground',
    defaultIcon: Clock,
  },
  scanned: {
    container: 'bg-bonzini-orange/10 dark:bg-bonzini-orange/15 border-bonzini-orange/30 dark:border-bonzini-orange/40',
    icon: 'text-bonzini-orange',
    title: 'text-bonzini-orange',
    description: 'text-muted-foreground',
    defaultIcon: ScanLine,
  },
  rejected: {
    container: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    title: 'text-red-800 dark:text-red-400',
    description: 'text-red-700 dark:text-red-300',
    defaultIcon: XCircle,
  },
  cancelled: {
    container: 'bg-muted/60 border-border',
    icon: 'text-muted-foreground',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    defaultIcon: Lock,
  },
  message: {
    container: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-400',
    description: 'text-green-700 dark:text-green-300',
    defaultIcon: MessageCircle,
  },
};

interface Props {
  variant: StatusCardVariant;
  title: string;
  description?: string;
  /** Override the default icon for the variant. */
  icon?: LucideIcon;
  /** Spin the icon (e.g. processing / loading). */
  spinIcon?: boolean;
  /** Render arbitrary content underneath the description (e.g. signature image). */
  children?: React.ReactNode;
  /** Tailwind utility classes for the outer container (no semantics). */
  className?: string;
}

export function PaymentStatusCard({
  variant,
  title,
  description,
  icon,
  spinIcon = false,
  children,
  className,
}: Props) {
  const styles = VARIANT_STYLES[variant];
  const Icon = icon ?? styles.defaultIcon;

  return (
    <div
      className={cn(
        'rounded-2xl p-5 border',
        styles.container,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            'w-5 h-5 mt-0.5 flex-shrink-0',
            styles.icon,
            spinIcon && 'animate-spin',
          )}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium', styles.title)}>{title}</p>
          {description && (
            <p className={cn('text-sm mt-1', styles.description)}>{description}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// Re-export for callers that need a custom icon while keeping the
// import surface tidy.
export { AlertCircle, CheckCircle2, Clock, Loader2, Lock, MessageCircle, ScanLine, XCircle };
