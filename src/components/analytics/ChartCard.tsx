import * as React from 'react';
import { Info, AlertCircle, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TONE_PILL } from '@/mobile/designKit';

export interface ChartCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  /** Content rendered on the top-right (date filter, legend, export). */
  toolbar?: React.ReactNode;
  /** True while data is loading. */
  loading?: boolean;
  /** Error state renders a compact alert instead of children. */
  error?: Error | string | null;
  /** When true + `emptyState` is shown, children are hidden. */
  empty?: boolean;
  emptyState?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional footer — typically summary stats below the chart. */
  footer?: React.ReactNode;
}

/**
 * ChartCard — thin wrapper on shadcn `<Card>` that standardises title,
 * subtitle, tooltip description, toolbar, loading / error / empty states,
 * and footer. Inspired by the square-ui panel pattern: subtle border,
 * slight shadow, room to breathe.
 */
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
    <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow, className)}>
      <div className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className={cn('text-sm font-bold tracking-normal leading-snug line-clamp-2 break-words', TEXT.strong)}>
              {title}
            </h3>
            {description ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Définition de la métrique"
                    className="mt-0.5 flex-shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={6}
                  className="w-[280px] p-3 text-xs leading-relaxed"
                >
                  {description}
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          {subtitle ? (
            <p className={cn('mt-0.5 text-[11px] leading-snug', TEXT.muted)}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {toolbar ? <div className="flex-shrink-0">{toolbar}</div> : null}
      </div>

      <div className="p-4 pt-2">
        {error ? (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-xs', TONE_PILL.danger)}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{typeof error === 'string' ? error : error.message}</span>
          </div>
        ) : empty ? (
          <div className={cn('flex min-h-[160px] items-center justify-center text-sm', TEXT.muted)}>
            {emptyState ?? 'Aucune donnée sur la période sélectionnée.'}
          </div>
        ) : (
          <div className="relative">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            <div className={cn(loading && 'opacity-40 transition-opacity pointer-events-none')}>{children}</div>
          </div>
        )}
      </div>

      {footer && !error ? (
        <div className={cn('px-4 py-3 text-xs', TEXT.muted)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
