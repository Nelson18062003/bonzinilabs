import * as React from 'react';
import { cn } from '@/lib/utils';

export interface KpiRowProps {
  /**
   * Number of columns on desktop (md+). On mobile always stacks to 2 cols.
   * Default 4.
   */
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export function KpiRow({ columns = 4, children, className }: KpiRowProps) {
  const desktop = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[columns];

  return (
    <div className={cn('grid grid-cols-2 gap-3', desktop, className)}>
      {children}
    </div>
  );
}
