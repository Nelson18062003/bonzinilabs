import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { LeftAddon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type'>;

export interface PhoneFieldProps extends BaseFieldProps, NativeInputProps {
  /** Country dial code (e.g. "+237" for Cameroon). Defaults to +237. */
  dialCode?: string;
  autoComplete?: 'tel' | 'tel-national' | 'off';
}

/**
 * Phone input optimised for African importer audience.
 * - `type="tel"` + `inputMode="tel"` for the tel keypad
 * - dial code displayed as a non-editable addon by default
 * - no autoCapitalize, no autoCorrect, no spellcheck
 */
export const PhoneField = React.forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  {
    label,
    hint,
    error,
    required,
    size = 'md',
    dialCode = '+237',
    wrapperClassName,
    labelClassName,
    controlClassName,
    className,
    id: idProp,
    autoComplete = 'tel',
    placeholder = '6 XX XX XX XX',
    enterKeyHint = 'next',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const keyboard = KEYBOARD.tel;

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
        {dialCode ? <LeftAddon>{dialCode}</LeftAddon> : null}
        <input
          ref={ref}
          type="tel"
          inputMode={keyboard.inputMode}
          autoCapitalize={keyboard.autoCapitalize}
          spellCheck={keyboard.spellCheck}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          className={cn(
            fieldControlVariants({ size, invalid: hasError }),
            dialCode && 'rounded-l-none',
            'tabular-nums',
            controlClassName,
          )}
          {...rest}
        />
      </div>
    </FormFieldWrapper>
  );
});
