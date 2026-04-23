import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { LeftAddon, LeftIcon, RightAddon, RightIcon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type' | 'value' | 'onChange'>;

export interface NumberFieldProps extends BaseFieldProps, NativeInputProps {
  /** Controlled numeric value. `null` represents empty. */
  value?: number | null;
  /** Called with a parsed number, or `null` when the field is empty. */
  onValueChange?: (value: number | null) => void;
  /** Allow decimals. Defaults to false (integer-only). */
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  /** Step is passed to the input for a11y but doesn't drive UI. */
  step?: number;
}

/**
 * Integer / decimal input without the quirky browser `type="number"`
 * behaviour (no scroll-wheel increments, no weird Safari arrows).
 * Accepts only digits (and one decimal separator when allowed).
 */
export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  {
    label,
    hint,
    error,
    required,
    size = 'md',
    leftIcon,
    rightIcon,
    leftAddon,
    rightAddon,
    wrapperClassName,
    labelClassName,
    controlClassName,
    className,
    id: idProp,
    value,
    onValueChange,
    allowDecimal = false,
    min,
    max,
    step,
    enterKeyHint = 'done',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const keyboard = allowDecimal ? KEYBOARD.decimal : KEYBOARD.numeric;

  const [raw, setRaw] = React.useState<string>(value == null ? '' : String(value));

  // Sync external value changes (e.g. form.reset).
  React.useEffect(() => {
    const incoming = value == null ? '' : String(value);
    setRaw((current) => (Number(current) === value && incoming !== '' ? current : incoming));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pattern = allowDecimal ? /[^0-9.,]/g : /[^0-9]/g;
    const cleaned = event.target.value.replace(pattern, '').replace(',', '.');
    setRaw(cleaned);
    if (!onValueChange) return;
    if (cleaned === '' || cleaned === '.') {
      onValueChange(null);
    } else {
      const parsed = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
      if (!Number.isNaN(parsed)) onValueChange(parsed);
    }
  };

  const control = (
    <div className={cn('relative', leftAddon || rightAddon ? 'flex' : undefined, className)}>
      {leftAddon ? <LeftAddon>{leftAddon}</LeftAddon> : null}
      <div className="relative flex-1">
        {leftIcon ? <LeftIcon>{leftIcon}</LeftIcon> : null}
        <input
          ref={ref}
          type="text"
          inputMode={keyboard.inputMode}
          autoCapitalize={keyboard.autoCapitalize}
          spellCheck={keyboard.spellCheck}
          enterKeyHint={enterKeyHint}
          value={raw}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className={cn(
            fieldControlVariants({
              size,
              invalid: hasError,
              withLeftAdornment: !!leftIcon,
              withRightAdornment: !!rightIcon,
            }),
            'tabular-nums',
            leftAddon && 'rounded-l-none',
            rightAddon && 'rounded-r-none',
            controlClassName,
          )}
          {...rest}
        />
        {rightIcon ? <RightIcon>{rightIcon}</RightIcon> : null}
      </div>
      {rightAddon ? <RightAddon>{rightAddon}</RightAddon> : null}
    </div>
  );

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
      {control}
    </FormFieldWrapper>
  );
});
