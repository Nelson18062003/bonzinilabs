import * as React from 'react';
import { cn } from '@/lib/utils';
import { BaseFieldProps, KEYBOARD } from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';

type NativeTextareaProps = Omit<React.ComponentPropsWithoutRef<'textarea'>, 'size'>;

export interface TextAreaProps extends Omit<BaseFieldProps, 'leftIcon' | 'rightIcon' | 'leftAddon' | 'rightAddon'>, NativeTextareaProps {
  /** Shows "current/max" counter under the field when `maxLength` is set. */
  showCounter?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    label,
    hint,
    error,
    required,
    wrapperClassName,
    labelClassName,
    controlClassName,
    className,
    id: idProp,
    rows = 4,
    maxLength,
    showCounter,
    value,
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const length = typeof value === 'string' ? value.length : undefined;

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
      <div className={cn('relative', className)}>
        <textarea
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          value={value}
          inputMode={KEYBOARD.text.inputMode}
          autoCapitalize={KEYBOARD.text.autoCapitalize}
          spellCheck={KEYBOARD.text.spellCheck}
          className={cn(
            'flex w-full min-h-[96px] rounded-md border bg-background',
            // The iOS zoom guard — never text-sm by itself.
            'text-base md:text-sm',
            'px-3 py-2',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            hasError ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
            controlClassName,
          )}
          {...rest}
        />
        {showCounter && maxLength ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-muted-foreground"
          >
            {length ?? 0}/{maxLength}
          </div>
        ) : null}
      </div>
    </FormFieldWrapper>
  );
});
