import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from './format';

export interface TrendBadgeProps {
  /** Relative delta as a decimal, e.g. 0.12 for +12%. */
  delta: number | null;
  /**
   * When true, DOWN = good (e.g. rejection rate, cycle time).
   * Default false — UP is good.
   */
  invertColor?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function TrendBadge({
  delta,
  invertColor = false,
  className,
  size = 'sm',
}: TrendBadgeProps) {
  if (delta == null) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground',
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
          className,
        )}
      >
        <Minus className="h-3 w-3" />
        N/D
      </span>
    );
  }

  const flat = Math.abs(delta) < 0.005; // <0.5%
  const up = delta > 0;
  const good = flat ? 'neutral' : (up ? (invertColor ? 'bad' : 'good') : (invertColor ? 'good' : 'bad'));

  const palette = {
    good: 'bg-emerald-500/10 text-emerald-600',
    bad: 'bg-red-500/10 text-red-600',
    neutral: 'bg-muted text-muted-foreground',
  }[good];

  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        palette,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {formatPercent(delta, { withSign: true })}
    </span>
  );
}
