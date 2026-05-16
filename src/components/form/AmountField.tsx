import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { RightAddon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type' | 'value' | 'onChange'>;

export interface AmountFieldProps extends BaseFieldProps, NativeInputProps {
  /** Currency / unit shown as a right addon. Defaults to XAF. */
  currency?: string;
  /** Controlled amount (in currency base unit — i.e. XAF, RMB, etc). */
  value?: number | null;
  onValueChange?: (value: number | null) => void;
  /** Shortcut: enable decimals with 2-fractional precision. Prefer `decimals` for explicit control. */
  allowDecimal?: boolean;
  /** Number of fractional digits to display when formatted. Overrides allowDecimal when provided. */
  decimals?: number;
  /** Hard cap. Defaults are per-currency (50M for XAF). Pass `null` to disable. */
  max?: number | null;
  min?: number;
  /** Locale for thousands-separator formatting. Default 'fr-FR'. */
  locale?: string;
}

const DEFAULT_MAX: Record<string, number | undefined> = {
  XAF: 50_000_000,
  RMB: 500_000,
};

/**
 * Money input with thousands-separator formatting (rendered on blur so
 * partial inputs like "583," don't get clobbered mid-typing), comma OR
 * dot decimal separator, per-currency caps, and `Number.isSafeInteger`
 * guard when integer-only.
 *
 * Emits a plain number (or null) via `onValueChange`. The displayed
 * string while editing is whatever the user typed minus invalid chars;
 * on blur, it switches to the locale-formatted representation.
 */
export const AmountField = React.forwardRef<HTMLInputElement, AmountFieldProps>(function AmountField(
  {
    label,
    hint,
    error,
    required,
    size = 'md',
    wrapperClassName,
    labelClassName,
    controlClassName,
    className,
    id: idProp,
    currency = 'XAF',
    value,
    onValueChange,
    allowDecimal = false,
    decimals,
    max,
    min = 0,
    locale = 'fr-FR',
    enterKeyHint = 'done',
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const effectiveDecimals = decimals ?? (allowDecimal ? 2 : 0);
  const isDecimal = effectiveDecimals > 0;
  const keyboard = isDecimal ? KEYBOARD.decimal : KEYBOARD.numeric;
  const effectiveMax = max === undefined ? DEFAULT_MAX[currency] : max ?? undefined;

  const formatter = React.useMemo(() => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: effectiveDecimals,
      useGrouping: true,
    });
  }, [locale, effectiveDecimals]);

  const format = React.useCallback(
    (n: number | null | undefined) =>
      n == null || Number.isNaN(n) ? '' : formatter.format(n),
    [formatter],
  );

  const [display, setDisplay] = React.useState<string>(() => format(value));
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync from external value (form.reset, parent state change) only when not focused
  // so the user's in-flight typing isn't reformatted underneath them.
  React.useEffect(() => {
    if (isFocused) return;
    setDisplay(format(value));
  }, [value, isFocused, format]);

  const emit = (n: number | null) => {
    if (n != null && !isDecimal && !Number.isSafeInteger(n)) return;
    if (onValueChange) onValueChange(n);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    // Strip invalid chars but keep separators as-typed so partial input
    // (e.g. "583,") survives until blur.
    const cleaned = raw.replace(/[^\d.,\s-]/g, '');
    setDisplay(cleaned);

    const parsed = parseAmount(cleaned, isDecimal);
    if (parsed == null) {
      emit(null);
      return;
    }
    if (effectiveMax != null && parsed > effectiveMax) {
      emit(effectiveMax);
      setDisplay(format(effectiveMax));
      return;
    }
    if (parsed < min) {
      emit(min);
      setDisplay(format(min));
      return;
    }
    emit(parsed);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Re-format on blur so the user sees the canonical representation.
    const parsed = parseAmount(display, isDecimal);
    setDisplay(parsed == null ? '' : format(parsed));
    onBlur?.(e);
  };

  return (
    <FormFieldWrapper
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      wrapperClassName={wrapperClassName}
      labelClassName={labelClassName}
    >
      <div className={cn('flex', className)}>
        <input
          ref={ref}
          type="text"
          inputMode={keyboard.inputMode}
          autoCapitalize={keyboard.autoCapitalize}
          spellCheck={keyboard.spellCheck}
          enterKeyHint={enterKeyHint}
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0"
          className={cn(
            fieldControlVariants({ size, invalid: hasError }),
            'rounded-r-none text-right tabular-nums font-semibold',
            controlClassName,
          )}
          {...rest}
        />
        <RightAddon>{currency}</RightAddon>
      </div>
    </FormFieldWrapper>
  );
});

export function parseAmount(raw: string, allowDecimal: boolean): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '-.') return null;
  const parsed = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned.split('.')[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}
