// ============================================================
// Tableau de bord des ventes — la plage : 3 mois · 6 mois · 12 mois ·
// 12 semaines, période en cours comprise (rangeForPreset, heure de Douala).
// Un segmenté, posé UNE fois au-dessus de tout ce qu'il règle.
// ============================================================
import { cn } from '@/lib/utils';
import { RANGE_PRESETS, type SalesRangePreset } from '@/lib/salesSeries';
import { SegmentedControl } from './primitives';

export interface PeriodPickerProps {
  value: SalesRangePreset;
  onChange: (preset: SalesRangePreset) => void;
  /** Les préréglages proposés (défaut : les quatre). */
  options?: SalesRangePreset[];
  className?: string;
}

export function PeriodPicker({ value, onChange, options, className }: PeriodPickerProps) {
  const list = RANGE_PRESETS.filter((p) => !options || options.includes(p.value));
  return (
    <SegmentedControl
      ariaLabel="Période"
      value={value}
      onChange={onChange}
      className={cn('w-full sm:w-auto sm:min-w-[380px]', className)}
      options={list.map((p) => ({
        value: p.value,
        ariaLabel: p.label,
        label:
          p.short === p.label ? (
            p.label
          ) : (
            <>
              <span className="sm:hidden" aria-hidden>
                {p.short}
              </span>
              <span className="hidden sm:inline" aria-hidden>
                {p.label}
              </span>
            </>
          ),
      }))}
    />
  );
}
