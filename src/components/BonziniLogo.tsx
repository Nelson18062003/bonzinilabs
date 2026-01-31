import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * BONZINI Logo Component
 * Responsive logo with multiple size variants
 */

interface BonziniLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textPosition?: 'right' | 'bottom';
}

const sizeConfig = {
  xs: { logo: 'h-6 w-6', text: 'text-sm' },
  sm: { logo: 'h-8 w-8', text: 'text-base' },
  md: { logo: 'h-12 w-12', text: 'text-lg' },
  lg: { logo: 'h-16 w-16', text: 'text-xl' },
  xl: { logo: 'h-24 w-24', text: 'text-2xl' },
};

export const BonziniLogo = React.forwardRef<HTMLDivElement, BonziniLogoProps>(
  ({ size = 'md', showText = true, textPosition = 'right', className, ...props }, ref) => {
    const config = sizeConfig[size];

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 sm:gap-3',
          textPosition === 'bottom' && 'flex-col items-center gap-1',
          className
        )}
        {...props}
      >
        <img
          src="/assets/bonzini-logo.jpg"
          alt="Bonzini"
          className={cn('object-contain rounded-lg', config.logo)}
        />
        {showText && (
          <span className={cn('font-bold text-foreground', config.text)}>
            BONZINI
          </span>
        )}
      </div>
    );
  }
);

BonziniLogo.displayName = 'BonziniLogo';
