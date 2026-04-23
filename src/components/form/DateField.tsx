import * as React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type'>;

export interface DateFieldProps extends BaseFieldProps, NativeInputProps {
  /** 'date' | 'datetime-local' | 'time'. Default 'date'. */
  dateType?: 'date' | 'datetime-local' | 'time';
}

/**
 * Native date input — triggers the OS-native date picker. The HTML
 * `input[type=date]` is the most reliable mobile experience (iOS shows
 * the wheel picker, Android shows the calendar).
 *
 * Value is a string in ISO format: "YYYY-MM-DD" for date,
 * "YYYY-MM-DDTHH:mm" for datetime-local, "HH:mm" for time.
 */
export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
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
    dateType = 'date',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);

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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <Calendar className="h-4 w-4" />
        </span>
        <input
          ref={ref}
          type={dateType}
          className={cn(
            fieldControlVariants({
              size,
              invalid: hasError,
              withLeftAdornment: true,
            }),
            'tabular-nums',
            controlClassName,
          )}
          {...rest}
        />
      </div>
    </FormFieldWrapper>
  );
});
