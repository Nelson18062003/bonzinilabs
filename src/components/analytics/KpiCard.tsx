import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TONE_HOLDER } from '@/mobile/designKit';
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
  /** Small description shown in an info popover. Makes metric definition explicit. */
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

/**
 * Accent → kit tone holder. The design kit is intentionally restrained (colour
 * carries meaning only), so the brand accents map onto the unified semantic
 * tones: violet→info, amber/orange→pending, emerald→success, red→danger.
 * The `accent` prop API is unchanged so callers don't have to.
 */
const ACCENT_HOLDER: Record<NonNullable<KpiCardProps['accent']>, string> = {
  neutral: TONE_HOLDER.neutral,
  violet: TONE_HOLDER.info,
  amber: TONE_HOLDER.pending,
  orange: TONE_HOLDER.pending,
  emerald: TONE_HOLDER.success,
  red: TONE_HOLDER.danger,
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
  const holder = ACCENT_HOLDER[accent];

  return (
    <div className={cn('flex h-full flex-col rounded-[22px] p-4', SURFACE.card, SURFACE.shadow, className)}>
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col space-y-1">
          {/* min-h reserves 2 lines so values align vertically across cards */}
          <div className="flex min-h-[2.25rem] items-start gap-1.5 md:min-h-[2.5rem]">
            <p className={cn('text-xs md:text-sm leading-snug line-clamp-2 break-words', TEXT.muted)}>
              {label}
            </p>
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
                  className="w-[260px] p-3 text-xs leading-relaxed"
                >
                  {description}
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          {loading ? (
            <div className="h-7 w-28 animate-pulse rounded bg-muted" />
          ) : (
            <p
              className={cn('text-xl md:text-2xl font-extrabold tabular-nums leading-tight break-words', TEXT.strong)}
              title={typeof value === 'string' ? value : undefined}
            >
              {value}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {delta !== undefined ? <TrendBadge delta={delta ?? null} invertColor={invertColor} /> : null}
            {secondary ? (
              <p className={cn('text-[11px] md:text-xs tabular-nums leading-snug', TEXT.muted)}>
                {secondary}
              </p>
            ) : null}
          </div>
        </div>

        {icon ? (
          <div
            className={cn(
              'flex size-9 md:size-10 flex-shrink-0 items-center justify-center rounded-full',
              holder,
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
