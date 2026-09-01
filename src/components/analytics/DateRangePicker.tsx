import * as React from 'react';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import { CalendarDays, ChevronDown, Check } from 'lucide-react';
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
  formatRangeLabel,
  toBusinessDayString,
  type DateRange,
  type PresetId,
  type Granularity,
} from '@/lib/analytics/dateRange';
import { useDateRange } from '@/lib/analytics/DateRangeContext';

const GRANULARITY_ORDER: Granularity[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

interface DateRangePickerProps {
  /**
   * Le réglage de granularité n'a de sens que pour des graphiques en SEAUX
   * (tableau de bord). Les courbes de trésorerie sont des séries
   * d'événements : on le cache là où il ne signifie rien.
   */
  showGranularity?: boolean;
  /** « Comparer à la période précédente » — idem, propre au tableau de bord. */
  showCompare?: boolean;
}

/**
 * Unique source of truth for the dashboard's time filter.
 * Renders a compact trigger that opens a popover with:
 *   - preset list grouped by horizon
 *   - "compare to previous" toggle
 *   - custom from/to range via the design-kit calendar (BzDateRangeField)
 *
 * Partagé par le tableau de bord ET la Trésorerie : deux sélecteurs, deux
 * calculs de bornes, c'est ainsi que l'un a régressé sans que l'autre ne le
 * voie.
 */
export function DateRangePicker({ showGranularity = true, showCompare = true }: DateRangePickerProps = {}) {
  const { range, setPreset, setCustom, setGranularity, setCompareToPrevious } = useDateRange();
  const [open, setOpen] = React.useState(false);

  // Formaté en jour civil de DOUALA. `format(range.from, …)` de date-fns
  // lisait les composants locaux : sur un navigateur à UTC, une plage qui
  // commence « minuit Douala » (23:00 UTC la veille) s'affichait à la veille.
  const label = formatRangeLabel(range);

  const handlePreset = (p: PresetId) => {
    setPreset(p);
    setOpen(false);
  };

  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const handleCustom = (from: string, to: string) => {
    // Les chaînes 'YYYY-MM-DD' du calendrier partent TELLES QUELLES : c'est
    // `buildCustomRange` qui les lit comme des jours civils. Le détour par
    // `new Date(from)` (= minuit UTC, relu en composants locaux) faisait
    // reculer toute la plage d'un jour à l'ouest de UTC.
    if (!DAY.test(from) || !DAY.test(to)) return;
    if (to < from) return;
    setCustom(from, to);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50"
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
            <CustomRangeInputs onApply={handleCustom} current={range} />
          </div>

          {showGranularity && (
          <div>
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Granularité (défaut)
            </div>
            <div className="grid grid-cols-3 gap-1">
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
                      'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
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
            <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/80 leading-snug">
              Chaque rapport peut overrider cette granularité par défaut via son propre sélecteur.
            </p>
          </div>
          )}

          {showCompare && (
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
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CustomRangeInputs({ onApply, current }: { onApply: (from: string, to: string) => void; current: DateRange }) {
  // Le popover démonte son contenu à la fermeture : sans amorçage, une plage
  // personnalisée active se rouvrait sur un calendrier VIDE, et l'utilisateur
  // devait la reposer pour l'ajuster d'un jour.
  const [range, setRange] = React.useState(() =>
    current.preset === 'custom'
      ? { from: toBusinessDayString(current.from), to: toBusinessDayString(current.to) }
      : { from: '', to: '' },
  );

  return (
    <div className="space-y-2">
      <BzDateRangeField value={range} onChange={setRange} accent="#8B5CF6" defaultOpen />
      <button
        type="button"
        disabled={!range.from || !range.to}
        onClick={() => onApply(range.from, range.to)}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}
