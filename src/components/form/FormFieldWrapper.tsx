import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldWrapperProps {
  id: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode | boolean;
  required?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared label / hint / error shell used by every form primitive.
 * Wires up aria-describedby for a11y.
 */
export function FormFieldWrapper({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  labelClassName,
  children,
}: FormFieldWrapperProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const errorMessage = typeof error === 'string' ? error : undefined;
  const hasError = Boolean(error);
  const describedBy =
    [hasError ? errorId : null, hint && !hasError ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium leading-none text-foreground',
            hasError && 'text-destructive',
            labelClassName,
          )}
        >
          {label}
          {required ? <span aria-hidden="true" className="ml-0.5 text-destructive">*</span> : null}
        </label>
      ) : null}

      {/* Inject id + aria onto the inner control via child props. */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{
            id?: string;
            'aria-describedby'?: string;
            'aria-invalid'?: boolean;
            'aria-required'?: boolean;
          }>, {
            id,
            'aria-describedby': describedBy,
            'aria-invalid': hasError,
            'aria-required': required,
          })
        : children}

      {hasError && errorMessage ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
