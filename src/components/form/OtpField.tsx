import * as React from 'react';
import { cn } from '@/lib/utils';
import { BaseFieldProps } from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';

export interface OtpFieldProps extends Omit<BaseFieldProps, 'leftIcon' | 'rightIcon' | 'leftAddon' | 'rightAddon' | 'size'> {
  /** Number of digits. Default 6. */
  length?: number;
  value: string;
  onValueChange: (value: string) => void;
  /** Called once the last slot is filled. */
  onComplete?: (value: string) => void;
  id?: string;
  disabled?: boolean;
  /** Default `one-time-code` so iOS offers autofill from SMS. */
  autoComplete?: 'one-time-code' | 'off';
  name?: string;
}

/**
 * OTP input — each slot is a 1-char box with paste support, backspace
 * focus shift, and iOS SMS autofill (`autocomplete="one-time-code"`).
 * Slot `font-size` is `text-lg md:text-base` so iOS never zooms.
 */
export function OtpField({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  labelClassName,
  length = 6,
  value,
  onValueChange,
  onComplete,
  id: idProp,
  disabled,
  autoComplete = 'one-time-code',
  name,
}: OtpFieldProps) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(() => {
    const arr = Array.from({ length }, (_, i) => value[i] ?? '');
    return arr;
  }, [value, length]);

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join('');
    onValueChange(joined);
    if (joined.length === length && !joined.includes('') && onComplete) {
      onComplete(joined);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, '');
      return;
    }
    // When the user pastes or iOS autofills, multiple chars arrive at once.
    if (raw.length > 1) {
      const slice = raw.slice(0, length - index);
      const next = digits.slice();
      for (let i = 0; i < slice.length; i++) next[index + i] = slice[i];
      const joined = next.join('');
      onValueChange(joined);
      const lastIndex = Math.min(index + slice.length, length - 1);
      refs.current[lastIndex]?.focus();
      if (joined.length === length && !joined.includes('') && onComplete) onComplete(joined);
      return;
    }
    setDigit(index, raw);
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
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
      <div className="flex gap-2 justify-center" role="group" aria-label={typeof label === 'string' ? label : 'Code de vérification'}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            name={name ? `${name}-${i}` : undefined}
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            autoComplete={i === 0 ? autoComplete : 'off'}
            disabled={disabled}
            value={digit}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={`Chiffre ${i + 1} sur ${length}`}
            className={cn(
              'h-12 w-11 md:h-11 md:w-10 rounded-md border bg-background',
              // iOS zoom guard.
              'text-xl md:text-lg font-semibold text-center tabular-nums',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
              hasError ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
            )}
          />
        ))}
      </div>
    </FormFieldWrapper>
  );
}
