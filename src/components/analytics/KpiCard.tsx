import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TrendBadge } from './TrendBadge';

export interface KpiCardProps {
  label: React.ReactNode;
  /** Primary value, pre-formatted. */
  value: React.ReactNode;
  /** Secondary line (e.g. absolute delta, context). */
  secondary?: React.ReactNode;
  /**
   * Delta vs previous period as a decimal. When provided, a TrendBadge
   * is shown. Omit to hide the trend (e.g. when comparison is disabled
   * or the metric doesn't have a meaningful "previous").
   */
  delta?: number | null;
  /** When true, DOWN is good (e.g. rejection rate). */
  invertColor?: boolean;
  /** Small description shown in an info tooltip. Makes metric definition explicit. */
  description?: React.ReactNode;
  /** Icon shown in the top-right corner of the card. */
  icon?: React.ReactNode;
  /** When true, shows a skeleton shimmer instead of the value. */
  loading?: boolean;
  className?: string;
  /**
   * Accent color — changes the left border / icon color.
   * Defaults to 'neutral'.
   */
  accent?: 'neutral' | 'violet' | 'amber' | 'orange' | 'emerald' | 'red';
}

const ACCENT_MAP: Record<NonNullable<KpiCardProps['accent']>, string> = {
  neutral: 'border-l-border',
  violet: 'border-l-[hsl(258_100%_60%)]',
  amber: 'border-l-[hsl(36_100%_55%)]',
  orange: 'border-l-[hsl(16_100%_55%)]',
  emerald: 'border-l-emerald-500',
  red: 'border-l-red-500',
};

export function KpiCard({
  label,
  value,
  secondary,
  delta,
  invertColor,
  description,
  icon,
  loading,
  className,
  accent = 'neutral',
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-border/50 bg-card p-4 shadow-sm',
        'border-l-[4px]',
        ACCENT_MAP[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
          {description ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Définition" className="text-muted-foreground/50 hover:text-muted-foreground">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs" side="top">
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {icon ? <div className="flex-shrink-0 text-muted-foreground">{icon}</div> : null}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
        )}
        {delta !== undefined ? <TrendBadge delta={delta ?? null} invertColor={invertColor} /> : null}
      </div>

      {secondary ? (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{secondary}</div>
      ) : null}
    </div>
  );
}
