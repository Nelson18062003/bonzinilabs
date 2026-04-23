import * as React from 'react';
import { cn } from '@/lib/utils';
import { useKeyboardSafePadding } from '@/hooks/keyboard/useKeyboardSafePadding';

export interface KeyboardSafeAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra px always reserved at the bottom (for fixed action buttons). Default 0. */
  extraPadding?: number;
  /** Render as another element. Default `div`. */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Container that keeps its content scrollable above the on-screen keyboard.
 * Wrap long forms (or any scroll area containing inputs) in this component
 * so iOS / Android keyboards never hide the submit button.
 *
 * Combines two fixes:
 *   1. dynamic padding-bottom equal to keyboard height
 *   2. safe-area-inset-bottom for notched devices
 */
export const KeyboardSafeArea = React.forwardRef<HTMLDivElement, KeyboardSafeAreaProps>(
  function KeyboardSafeArea({ className, style, extraPadding = 0, as = 'div', children, ...rest }, ref) {
    const safeStyle = useKeyboardSafePadding(extraPadding);
    const Component = as as 'div';
    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn('transition-[padding] duration-150', className)}
        style={{ ...safeStyle, ...style }}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);
