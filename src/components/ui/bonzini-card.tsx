import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * BONZINI Card Component System
 * Unified card components with consistent styling
 */

const cardVariants = cva('rounded-lg transition-all', {
  variants: {
    variant: {
      default: 'bg-white shadow-sm border border-border',
      elevated: 'bg-white shadow-md hover:shadow-lg',
      outlined: 'bg-white border-2 border-border',
      ghost: 'bg-transparent',
      gradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
    clickable: {
      true: 'cursor-pointer hover:shadow-lg active:scale-98',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
    clickable: false,
  },
});

export interface BonziniCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const BonziniCard = React.forwardRef<HTMLDivElement, BonziniCardProps>(
  ({ className, variant, padding, clickable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, clickable }), className)}
        {...props}
      />
    );
  }
);
BonziniCard.displayName = 'BonziniCard';

/**
 * Card Header
 */
const BonziniCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5', className)} {...props} />
));
BonziniCardHeader.displayName = 'BonziniCardHeader';

/**
 * Card Title
 */
const BonziniCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-xl font-semibold leading-none tracking-tight text-foreground', className)}
    {...props}
  >
    {children}
  </h3>
));
BonziniCardTitle.displayName = 'BonziniCardTitle';

/**
 * Card Description
 */
const BonziniCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
BonziniCardDescription.displayName = 'BonziniCardDescription';

/**
 * Card Content
 */
const BonziniCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
BonziniCardContent.displayName = 'BonziniCardContent';

/**
 * Card Footer
 */
const BonziniCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-2 mt-4', className)} {...props} />
));
BonziniCardFooter.displayName = 'BonziniCardFooter';

export {
  BonziniCard,
  BonziniCardHeader,
  BonziniCardTitle,
  BonziniCardDescription,
  BonziniCardContent,
  BonziniCardFooter,
  cardVariants,
};
