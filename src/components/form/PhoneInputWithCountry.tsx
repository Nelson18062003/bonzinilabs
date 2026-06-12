import * as React from 'react';
import { cn } from '@/lib/utils';
import { COUNTRY_CODES, joinPhone, splitPhone } from '@/data/countryCodes';
import { FormFieldWrapper } from './FormFieldWrapper';
import { fieldControlVariants } from './shared';
import type { BaseFieldProps } from './shared';

interface PhoneInputWithCountryProps extends Omit<BaseFieldProps, 'size'> {
  /** Canonical E.164-ish phone (e.g. "+237691234567"). null/empty for unset. */
  value?: string | null;
  onValueChange?: (next: string | null) => void;
  /** Default dial code when value is empty. */
  defaultDialCode?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Phone input with an inline country-code picker. Internal state tracks
 * the dial code (selected via dropdown) and the local digits separately;
 * the canonical "+237691234567" string is emitted to the parent.
 */
export function PhoneInputWithCountry({
  label,
  hint,
  error,
  required,
  size = 'md',
  wrapperClassName,
  labelClassName,
  value,
  onValueChange,
  defaultDialCode = '+237',
  placeholder = '6XX XX XX XX',
}: PhoneInputWithCountryProps) {
  const reactId = React.useId();
  const initial = React.useMemo(() => splitPhone(value, defaultDialCode), [value, defaultDialCode]);
  const [dialCode, setDialCode] = React.useState(initial.dialCode);
  const [local, setLocal] = React.useState(initial.local);

  // Sync from external value (form.reset).
  React.useEffect(() => {
    const next = splitPhone(value, defaultDialCode);
    setDialCode(next.dialCode);
    setLocal(next.local);
  }, [value, defaultDialCode]);

  const emit = (nextDial: string, nextLocal: string) => {
    if (!onValueChange) return;
    onValueChange(joinPhone(nextDial, nextLocal));
  };

  const handleDialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDialCode(e.target.value);
    emit(e.target.value, local);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setLocal(digitsOnly);
    emit(dialCode, digitsOnly);
  };

  const hasError = Boolean(error);

  return (
    <FormFieldWrapper
      id={reactId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      wrapperClassName={wrapperClassName}
      labelClassName={labelClassName}
    >
      <div className="flex gap-2">
        <select
          value={dialCode}
          onChange={handleDialChange}
          className={cn(
            fieldControlVariants({ size, invalid: hasError }),
            'w-[110px] flex-shrink-0 px-2 font-semibold',
          )}
          aria-label="Code pays"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={local}
          onChange={handleLocalChange}
          placeholder={placeholder}
          className={cn(
            fieldControlVariants({ size, invalid: hasError }),
            'flex-1 tabular-nums tracking-wide',
          )}
        />
      </div>
    </FormFieldWrapper>
  );
}
