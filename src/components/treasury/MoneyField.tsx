import * as React from 'react';
import { parseAmount } from '@/components/form/AmountField';
import { cn } from '@/lib/utils';

/**
 * Soft money input — the SAME shell as SelectField (filled bg-muted, rounded-2xl,
 * 54px, focus ring) so every control in Treasury speaks one visual language.
 * Reuses the proven parseAmount() logic; formats on blur. Font ≥16px (iOS guard).
 *
 * Drop-in for the old AmountField (accepts/ignores `allowDecimal` and `max`).
 */
export function MoneyField({
  label,
  currency,
  value,
  onValueChange,
  decimals = 0,
  placeholder = '0',
  className,
}: {
  label?: string;
  currency: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  decimals?: number;
  placeholder?: string;
  className?: string;
  /** Accepted for drop-in compatibility with AmountField (no-ops here). */
  allowDecimal?: boolean;
  max?: number | null;
}) {
  const isDecimal = decimals > 0;
  const formatter = React.useMemo(
    () => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals, useGrouping: true }),
    [decimals],
  );
  const format = React.useCallback(
    (n: number | null) => (n == null || Number.isNaN(n) ? '' : formatter.format(n)),
    [formatter],
  );
  const [display, setDisplay] = React.useState(() => format(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDisplay(format(value));
  }, [value, focused, format]);

  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-[13px] font-semibold text-muted-foreground">{label}</label>}
      <div className="flex h-[54px] items-center rounded-2xl bg-muted/70 px-4 transition focus-within:ring-2 focus-within:ring-bonzini-violet/40">
        {/* eslint-disable-next-line no-restricted-syntax -- text is 18px (≥16) so the iOS auto-zoom this rule guards against cannot occur; the soft shell needs a raw transparent input */}
        <input
          type="text"
          inputMode={isDecimal ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          value={display}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseAmount(display, isDecimal);
            setDisplay(parsed == null ? '' : format(parsed));
          }}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.,\s-]/g, '');
            setDisplay(cleaned);
            onValueChange(parseAmount(cleaned, isDecimal));
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-right text-[18px] font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <span className="ml-2 shrink-0 text-[13px] font-semibold text-muted-foreground">{currency}</span>
      </div>
    </div>
  );
}
