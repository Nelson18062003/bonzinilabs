import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatInteger, formatCurrency } from './format';

export interface BreakdownItem {
  key: string;
  label: React.ReactNode;
  count: number;
  amount: number;
  color?: string;
}

export interface BreakdownBarProps {
  items: BreakdownItem[];
  /** Which unit to show as the big %. Default 'amount'. Count can be surfaced as secondary. */
  mode?: 'amount' | 'count';
  /** Currency for amount formatting. */
  currency?: 'XAF' | 'RMB';
  className?: string;
}

/**
 * Progress-bar-style breakdown that ALWAYS shows both count and amount.
 * The headline percentage is explicitly labelled so there's no confusion
 * about whether we're looking at volume share or operation-count share —
 * the single biggest ambiguity we're fixing in the rewritten dashboards.
 */
export function BreakdownBar({
  items,
  mode = 'amount',
  currency = 'XAF',
  className,
}: BreakdownBarProps) {
  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);
  const totalCount = items.reduce((acc, i) => acc + i.count, 0);

  if (items.length === 0 || (totalAmount === 0 && totalCount === 0)) {
    return (
      <div className="text-xs text-muted-foreground">Aucune donnée sur la période.</div>
    );
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {items.map((item) => {
        const pctAmount = totalAmount === 0 ? 0 : (item.amount / totalAmount) * 100;
        const pctCount = totalCount === 0 ? 0 : (item.count / totalCount) * 100;
        const mainPct = mode === 'amount' ? pctAmount : pctCount;
        const color = item.color ?? 'hsl(258 100% 60%)';

        return (
          <div key={item.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {item.label}
              </span>
              <span className="tabular-nums font-semibold">{mainPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${mainPct}%`, background: color }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{formatInteger(item.count)} opérations ({pctCount.toFixed(1)}%)</span>
              <span>{formatCurrency(item.amount, currency, { compact: true })}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
