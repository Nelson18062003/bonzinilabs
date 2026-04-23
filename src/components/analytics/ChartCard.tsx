import * as React from 'react';
import { Info, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  /** Content rendered in the top-right corner (legend, filter, etc). */
  toolbar?: React.ReactNode;
  /** True while data is loading. Children are still rendered below. */
  loading?: boolean;
  /** Error state renders a compact alert instead of children. */
  error?: Error | string | null;
  /** When children would render an empty chart, pass true + an empty-state node. */
  empty?: boolean;
  emptyState?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional footer — goes below the chart (e.g. summary stats). */
  footer?: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  description,
  toolbar,
  loading,
  error,
  empty,
  emptyState,
  children,
  className,
  footer,
}: ChartCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/50 bg-card p-4 shadow-sm',
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            {description ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Définition" className="text-muted-foreground/50 hover:text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs" side="top">
                    {description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {toolbar ? <div className="flex-shrink-0">{toolbar}</div> : null}
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{typeof error === 'string' ? error : error.message}</span>
        </div>
      ) : empty ? (
        <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          {emptyState ?? 'Aucune donnée sur la période sélectionnée.'}
        </div>
      ) : (
        <div className={cn(loading && 'opacity-60 pointer-events-none transition-opacity')}>
          {children}
        </div>
      )}

      {footer && !error ? (
        <footer className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
