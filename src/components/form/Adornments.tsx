import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Positioned icons inside the control (overlay).
 * Use for lucide icons. Input padding is already offset by
 * `withLeftAdornment` / `withRightAdornment` variants in shared.ts.
 */
export function LeftIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RightIcon({
  children,
  className,
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  /** When true, becomes clickable (e.g. password toggle). */
  interactive?: boolean;
}) {
  return (
    <span
      className={cn(
        'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground',
        interactive ? 'cursor-pointer' : 'pointer-events-none',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Full-height visual add-on (e.g. "+237", "XAF"). Rendered outside the
 * input so the control itself keeps `text-base md:text-sm` intact.
 */
export function LeftAddon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-base md:text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function RightAddon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-base md:text-sm text-muted-foreground">
      {children}
    </div>
  );
}
