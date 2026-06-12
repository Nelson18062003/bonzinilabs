import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Refined segmented control: a single muted track with the active segment
 * raised as an elevated `bg-card` chip. Replaces the heavy bordered "pill"
 * toggles (the generic look) with one calm, consistent control — same
 * language as the period chips on the lists. Supports an optional `hint`
 * sub-label and stays tidy down to 360px (min-w-0 + truncate).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-2xl bg-muted p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition-colors',
              active ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground active:bg-card/40',
            )}
          >
            <span className="w-full truncate text-[12px] font-semibold leading-tight">{o.label}</span>
            {o.hint && <span className="mt-0.5 truncate text-[10px] font-normal leading-tight text-muted-foreground">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
