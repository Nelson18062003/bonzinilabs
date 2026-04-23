import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { LeftAddon, LeftIcon, RightAddon, RightIcon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size'>;

export interface TextFieldProps extends BaseFieldProps, NativeInputProps {
  /**
   * Semantic variant — drives inputMode, autoCapitalize, autoCorrect, spellCheck.
   * Defaults to 'text' (free-form sentences). Use 'name' for proper-case
   * fields, 'url' for URLs, etc.
   */
  variant?: 'text' | 'name' | 'url';
}

/**
 * Plain text input. Mobile-safe by construction (text-base md:text-sm).
 * Ideal for names, references, short free-form text, URLs.
 *
 * For emails/passwords/phones/amounts use the specialised primitives —
 * they ship with sane defaults (autocomplete, inputMode, validation).
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
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
    variant = 'text',
    type = 'text',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const keyboard = KEYBOARD[variant];

  const control = (
    <div className={cn('relative', leftAddon || rightAddon ? 'flex' : undefined, className)}>
      {leftAddon ? <LeftAddon>{leftAddon}</LeftAddon> : null}
      <div className="relative flex-1">
        {leftIcon ? <LeftIcon>{leftIcon}</LeftIcon> : null}
        <input
          ref={ref}
          type={type}
          inputMode={keyboard.inputMode}
          autoCapitalize={keyboard.autoCapitalize}
          {...('autoCorrect' in keyboard ? { autoCorrect: keyboard.autoCorrect } : {})}
          spellCheck={keyboard.spellCheck}
          className={cn(
            fieldControlVariants({
              size,
              invalid: hasError,
              withLeftAdornment: !!leftIcon,
              withRightAdornment: !!rightIcon,
            }),
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
