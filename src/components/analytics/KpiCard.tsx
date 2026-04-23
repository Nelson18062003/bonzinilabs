import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
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
  /** Icon rendered in a bordered badge on the top-right of the card. */
  icon?: React.ReactNode;
  /** When true, shows a skeleton shimmer instead of the value. */
  loading?: boolean;
  className?: string;
  /**
   * Subtle colour hint on the icon badge and value. Defaults to 'neutral'
   * — most KPIs should use neutral for a calm, professional look.
   */
  accent?: 'neutral' | 'violet' | 'amber' | 'orange' | 'emerald' | 'red';
}

const ACCENT_STYLES: Record<NonNullable<KpiCardProps['accent']>, { iconBg: string; iconText: string }> = {
  neutral: { iconBg: 'bg-muted', iconText: 'text-muted-foreground' },
  violet: { iconBg: 'bg-[hsl(258_100%_60%/0.1)]', iconText: 'text-[hsl(258_100%_60%)]' },
  amber: { iconBg: 'bg-[hsl(36_100%_55%/0.1)]', iconText: 'text-[hsl(36_100%_55%)]' },
  orange: { iconBg: 'bg-[hsl(16_100%_55%/0.1)]', iconText: 'text-[hsl(16_100%_55%)]' },
  emerald: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600' },
  red: { iconBg: 'bg-red-500/10', iconText: 'text-red-600' },
};

/**
 * KPI card inspired by the `ln-dev7/square-ui` dashboard pattern, built
 * on the shadcn `<Card>` primitive. Deliberately restrained: one value,
 * optional trend, optional icon in a discreet bordered badge. No colored
 * accent borders, no heavy shadows — the data is the content.
 */
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
  const accentStyle = ACCENT_STYLES[accent];

  return (
    <Card className={cn('p-4 shadow-sm transition-shadow hover:shadow-md', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            {description ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Définition"
                      className="text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs" side="top">
                    {description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>

          {loading ? (
            <div className="h-8 w-28 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-semibold text-foreground tabular-nums leading-tight">{value}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {delta !== undefined ? <TrendBadge delta={delta ?? null} invertColor={invertColor} /> : null}
            {secondary ? (
              <p className="text-xs text-muted-foreground tabular-nums">{secondary}</p>
            ) : null}
          </div>
        </div>

        {icon ? (
          <div
            className={cn(
              'flex size-10 flex-shrink-0 items-center justify-center rounded-lg border border-border',
              accentStyle.iconBg,
              accentStyle.iconText,
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
