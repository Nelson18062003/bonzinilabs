import * as React from 'react';
import { CalendarDays, ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  PRESET_GROUPS,
  PRESET_LABELS,
  GRANULARITY_LABELS,
  granularityIsCompatible,
  type PresetId,
  type Granularity,
} from '@/lib/analytics/dateRange';
import { useDateRange } from '@/lib/analytics/DateRangeContext';

const GRANULARITY_ORDER: Granularity[] = ['hour', 'day', 'week', 'month', 'quarter'];

/**
 * Unique source of truth for the dashboard's time filter.
 * Renders a compact trigger that opens a popover with:
 *   - preset list grouped by horizon
 *   - "compare to previous" toggle
 *   - custom from/to inputs (native date picker — iOS-safe)
 */
export function DateRangePicker() {
  const { range, setPreset, setCustom, setGranularity, setCompareToPrevious } = useDateRange();
  const [open, setOpen] = React.useState(false);

  const label =
    range.preset === 'custom'
      ? `${format(range.from, 'd MMM yyyy', { locale: fr })} → ${format(range.to, 'd MMM yyyy', { locale: fr })}`
      : PRESET_LABELS[range.preset];

  const handlePreset = (p: PresetId) => {
    setPreset(p);
    setOpen(false);
  };

  const handleCustom = (from: string, to: string) => {
    if (!from || !to) return;
    const f = new Date(from);
    const t = new Date(to);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return;
    if (t < f) return;
    setCustom(f, t);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted/50"
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[340px] p-0" sideOffset={8}>
        <div className="p-3 space-y-3">
          {PRESET_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map((preset) => {
                  const active = range.preset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className={cn(
                        'flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      <span>{PRESET_LABELS[preset]}</span>
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personnalisé
            </div>
            <CustomRangeInputs onApply={handleCustom} />
          </div>

          <div>
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Granularité
            </div>
            <div className="grid grid-cols-5 gap-1">
              {GRANULARITY_ORDER.map((g) => {
                const compatible = granularityIsCompatible(g, range);
                const active = range.granularity === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={!compatible}
                    onClick={() => setGranularity(g)}
                    className={cn(
                      'rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : compatible
                          ? 'bg-muted/50 text-foreground hover:bg-muted'
                          : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed',
                    )}
                    title={
                      compatible
                        ? `Agréger par ${GRANULARITY_LABELS[g].toLowerCase()}`
                        : `Incompatible avec la période sélectionnée`
                    }
                  >
                    {GRANULARITY_LABELS[g]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-sm font-medium">Comparer à la période précédente</div>
              <div className="text-[11px] text-muted-foreground">
                Affiche Δ % sur chaque KPI
              </div>
            </div>
            <Switch
              checked={range.compareToPrevious}
              onCheckedChange={setCompareToPrevious}
              aria-label="Activer la comparaison à la période précédente"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CustomRangeInputs({ onApply }: { onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 text-[11px] font-medium text-muted-foreground">
        Du
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-base md:text-sm"
        />
      </label>
      <label className="flex-1 text-[11px] font-medium text-muted-foreground">
        Au
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-base md:text-sm"
        />
      </label>
      <button
        type="button"
        disabled={!from || !to}
        onClick={() => onApply(from, to)}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}
