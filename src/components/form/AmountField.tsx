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
  /** Currency code shown as a right addon. Defaults to XAF. */
  currency?: 'XAF' | 'RMB' | 'USD' | 'EUR' | string;
  /** Controlled amount (in currency base unit — i.e. XAF, RMB, etc). */
  value?: number | null;
  onValueChange?: (value: number | null) => void;
  /** Whether to allow fractional amounts. XAF is integer-only, RMB can be decimal. */
  allowDecimal?: boolean;
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
 * Money input with live thousands-separator formatting, per-currency caps,
 * and `Number.isSafeInteger` guard (security rule from CLAUDE.md).
 *
 * Displays the amount as "1 234 567" while the user types; emits a plain
 * integer to `onValueChange` and to form libraries.
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
    max,
    min = 0,
    locale = 'fr-FR',
    enterKeyHint = 'done',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const keyboard = allowDecimal ? KEYBOARD.decimal : KEYBOARD.numeric;
  const effectiveMax = max === undefined ? DEFAULT_MAX[currency] : max ?? undefined;

  const formatter = React.useMemo(() => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: allowDecimal ? 2 : 0,
      useGrouping: true,
    });
  }, [locale, allowDecimal]);

  const format = (n: number | null | undefined) =>
    n == null || Number.isNaN(n) ? '' : formatter.format(n);

  const [display, setDisplay] = React.useState<string>(() => format(value));

  React.useEffect(() => {
    // Sync from external value (form.reset, parent state change).
    const externalFormatted = format(value);
    setDisplay((current) => {
      const currentNumeric = parseAmount(current, allowDecimal);
      return currentNumeric === value ? current : externalFormatted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (n: number | null) => {
    if (n != null && !allowDecimal && !Number.isSafeInteger(n)) return;
    if (onValueChange) onValueChange(n);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseAmount(event.target.value, allowDecimal);
    if (parsed == null) {
      setDisplay('');
      emit(null);
      return;
    }
    if (effectiveMax != null && parsed > effectiveMax) {
      // Clamp silently to the cap.
      setDisplay(format(effectiveMax));
      emit(effectiveMax);
      return;
    }
    if (parsed < min) {
      setDisplay(format(min));
      emit(min);
      return;
    }
    setDisplay(format(parsed));
    emit(parsed);
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

function parseAmount(raw: string, allowDecimal: boolean): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  const parsed = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned.split('.')[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}
