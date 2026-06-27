// ============================================================
// Reusable status narrative card. Refonte « Direction A » (designKit) :
// cartes tonales DOUCES (sans filet/bordure dure), une teinte par sens.
// API inchangée (variants, props).
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

const LILAC = { container: 'bg-[#EAE7FA] dark:bg-[#272252]', icon: 'text-[#5B4CC4] dark:text-[#B5AAF0]', title: 'text-[#5B4CC4] dark:text-[#B5AAF0]', description: 'text-[#6E66A8] dark:text-[#9C93D6]' };
const GREEN = { container: 'bg-[#DEEFE5] dark:bg-[#1E3A2C]', icon: 'text-[#2E7D52] dark:text-[#7FCBA0]', title: 'text-[#2E7D52] dark:text-[#7FCBA0]', description: 'text-[#3E7D5E] dark:text-[#86C9A4]' };
const AMBER = { container: 'bg-[#FDF1DD] dark:bg-[#3A2F1A]', icon: 'text-[#9A6B12] dark:text-[#E0B978]', title: 'text-[#9A6B12] dark:text-[#E0B978]', description: 'text-[#8A6320] dark:text-[#D0AC78]' };
const RED = { container: 'bg-[#FBE7E7] dark:bg-[#3A2526]', icon: 'text-[#C0504D] dark:text-[#E79A9A]', title: 'text-[#C0504D] dark:text-[#E79A9A]', description: 'text-[#B0524F] dark:text-[#DDA0A0]' };

const VARIANT_STYLES: Record<StatusCardVariant, VariantStyle> = {
  info: { ...LILAC, defaultIcon: CheckCircle2 },
  success: { ...GREEN, defaultIcon: CheckCircle2 },
  progress: { ...LILAC, defaultIcon: Loader2 },
  pending: { ...AMBER, defaultIcon: Clock },
  scanned: { ...AMBER, defaultIcon: ScanLine },
  rejected: { ...RED, defaultIcon: XCircle },
  cancelled: {
    container: 'bg-black/[0.04] dark:bg-white/[0.06]',
    icon: 'text-[#8E8BA0]',
    title: 'text-[#1B1A24] dark:text-[#F2F1F7]',
    description: 'text-[#8E8BA0]',
    defaultIcon: Lock,
  },
  message: { ...LILAC, defaultIcon: MessageCircle },
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
    <div className={cn('rounded-2xl p-5', styles.container, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', styles.icon, spinIcon && 'animate-spin')} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-[15px] font-bold', styles.title)}>{title}</p>
          {description && <p className={cn('mt-1 text-[13px]', styles.description)}>{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// Re-export for callers that need a custom icon while keeping the
// import surface tidy.
export { AlertCircle, CheckCircle2, Clock, Loader2, Lock, MessageCircle, ScanLine, XCircle };
