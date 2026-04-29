import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  GRANULARITY_LABELS,
  granularityIsCompatible,
  type DateRange,
  type Granularity,
} from '@/lib/analytics/dateRange';

const ORDER: Granularity[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

export interface GranularityPickerProps {
  /** The current effective granularity (local override OR global). */
  value: Granularity;
  onChange: (g: Granularity) => void;
  /** Global granularity from the DateRange context — used to detect override + reset. */
  globalGranularity: Granularity;
  /** The active date range — used to disable incompatible options. */
  range: DateRange;
  className?: string;
}

/**
 * Compact per-chart granularity picker. Lets the user view a single
 * report at a different temporal granularity than the global default.
 *
 * - Shows the active granularity inline.
 * - When the value differs from the global, a small "·" indicator and
 *   a "Suivre la période" reset action appear.
 * - Incompatible granularities (e.g. hourly on a 1-year range) are
 *   disabled.
 */
export function GranularityPicker({
  value,
  onChange,
  globalGranularity,
  range,
  className,
}: GranularityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const isOverride = value !== globalGranularity;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Changer la granularité de ce rapport"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted/40',
            isOverride && 'border-primary/40 text-primary',
            className,
          )}
        >
          {isOverride ? (
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
            />
          ) : null}
          <span>{GRANULARITY_LABELS[value]}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[180px] p-1.5">
        <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Granularité du rapport
        </div>
        <div className="flex flex-col">
          {ORDER.map((g) => {
            const compatible = granularityIsCompatible(g, range);
            const active = value === g;
            const isDefault = g === globalGranularity;
            return (
              <button
                key={g}
                type="button"
                disabled={!compatible}
                onClick={() => {
                  onChange(g);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : compatible
                      ? 'hover:bg-muted'
                      : 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {GRANULARITY_LABELS[g]}
                  {isDefault ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[9px] uppercase tracking-wide',
                        active
                          ? 'bg-primary-foreground/20'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      défaut
                    </span>
                  ) : null}
                </span>
                {active ? <Check className="h-3 w-3" /> : null}
              </button>
            );
          })}
        </div>
        {isOverride ? (
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => {
                onChange(globalGranularity);
                setOpen(false);
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Suivre la période ({GRANULARITY_LABELS[globalGranularity]})
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hook that holds the local granularity for a single chart, defaulting
 * to the current global granularity. Re-syncs to the global value
 * whenever the global changes (new period selected) — so a user
 * picking "30 derniers jours" doesn't see their old "weekly" override
 * leak. Manual overrides are kept as long as the global stays the
 * same.
 */
export function useReportGranularity(globalGranularity: Granularity) {
  const [local, setLocal] = React.useState<Granularity>(globalGranularity);
  const [pinnedTo, setPinnedTo] = React.useState<Granularity>(globalGranularity);

  React.useEffect(() => {
    if (globalGranularity !== pinnedTo) {
      setLocal(globalGranularity);
      setPinnedTo(globalGranularity);
    }
  }, [globalGranularity, pinnedTo]);

  return [local, setLocal] as const;
}
