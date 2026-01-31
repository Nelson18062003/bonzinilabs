import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BONZINI Button Component
 * Unified button system with brand-specific variants
 */

const buttonVariants = cva(
  // Base styles (applied to all buttons)
  'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-98',
  {
    variants: {
      variant: {
        // Admin variant (purple)
        admin: 'bg-[#9333ea] text-white hover:bg-[#7e22ce] focus-visible:ring-[#9333ea] shadow-sm hover:shadow-md',

        // Client variant (orange)
        client: 'bg-[#f97316] text-white hover:bg-[#ea580c] focus-visible:ring-[#f97316] shadow-sm hover:shadow-md',

        // Agent variant (red)
        agent: 'bg-[#ef4444] text-white hover:bg-[#dc2626] focus-visible:ring-[#ef4444] shadow-sm hover:shadow-md',

        // Secondary (outline)
        secondary: 'border-2 border-neutral-300 bg-transparent text-foreground hover:bg-neutral-50 focus-visible:ring-neutral-400',

        // Ghost (no background)
        ghost: 'bg-transparent text-foreground hover:bg-neutral-100 focus-visible:ring-neutral-400',

        // Destructive (for delete/cancel actions)
        destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',

        // Success (for validation actions)
        success: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500 shadow-sm',

        // Warning (for correction/attention actions)
        warning: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400 shadow-sm',

        // Link (text only)
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-13 px-6 text-lg',
        xl: 'h-16 px-8 text-xl',  // For hero CTAs
        icon: 'h-10 w-10',  // Square icon button
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'client',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface BonziniButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const BonziniButton = React.forwardRef<HTMLButtonElement, BonziniButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

BonziniButton.displayName = 'BonziniButton';

export { BonziniButton, buttonVariants };
