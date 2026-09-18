/**
 * Champ téléphone à valeur canonique (« +237691234567 » ou `null`) — utilisé
 * par la trésorerie (contreparties, ventes, achats). Façade au-dessus de
 * `PhoneNumberInput` : tous les pays, drapeaux, formatage et validation.
 */
import * as React from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { FormFieldWrapper } from './FormFieldWrapper';
import type { BaseFieldProps } from './shared';
import { PhoneNumberInput, fromE164, formatNational, toE164, type PhoneValue } from './PhoneNumberInput';
import { COUNTRY_ISOS, countryDialCode, type CountryIso } from '@/data/countries';
import { splitPhone } from '@/data/countryCodes';

interface PhoneInputWithCountryProps extends Omit<BaseFieldProps, 'size'> {
  /** Canonical E.164-ish phone (e.g. "+237691234567"). null/empty for unset. */
  value?: string | null;
  onValueChange?: (next: string | null) => void;
  /** Default dial code when value is empty. */
  defaultDialCode?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

function isoForDialCode(dialCode: string): CountryIso {
  const found = COUNTRY_ISOS.find((iso) => countryDialCode(iso) === dialCode);
  // « +1 » vaut pour plusieurs pays : le premier de la bibliothèque (US) fait foi.
  return found ?? 'CM';
}

function fromValue(value: string | null | undefined, defaultIso: CountryIso): PhoneValue {
  if (!value) return { country: defaultIso, national: '' };
  const strict = fromE164(value);
  if (strict.national) return strict;
  // Valeur incomplète : retrouver l'indicatif puis formater le reste.
  try {
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country) return { country: parsed.country, national: formatNational(parsed.nationalNumber, parsed.country) };
  } catch {
    /* on retombe sur l'indicatif le plus long */
  }
  const { dialCode, local } = splitPhone(value, countryDialCode(defaultIso));
  const iso = isoForDialCode(dialCode);
  return { country: iso, national: formatNational(local, iso) };
}

/** Canonique quand le numéro est valide ; concaténation brute sinon (jamais vide → null). */
function toValue(value: PhoneValue): string | null {
  const digits = value.national.replace(/\D/g, '');
  if (!digits) return null;
  return toE164(value) ?? `${countryDialCode(value.country)}${digits}`;
}

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
  placeholder,
}: PhoneInputWithCountryProps) {
  const reactId = React.useId();
  const defaultIso = React.useMemo(() => isoForDialCode(defaultDialCode), [defaultDialCode]);
  const [phone, setPhone] = React.useState<PhoneValue>(() => fromValue(value, defaultIso));
  const lastEmitted = React.useRef<string | null>(value ?? null);

  // Sync from external value (form.reset).
  React.useEffect(() => {
    const next = value ?? null;
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    setPhone(fromValue(next, defaultIso));
  }, [value, defaultIso]);

  const handleChange = (next: PhoneValue) => {
    setPhone(next);
    const emitted = toValue(next);
    lastEmitted.current = emitted;
    onValueChange?.(emitted);
  };

  const control = size === 'lg' ? 'h-12 rounded-md' : size === 'sm' ? 'h-9 rounded-md text-[14px]' : 'h-11 md:h-10 rounded-md';

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
      <PhoneNumberInput
        id={reactId}
        value={phone}
        onChange={handleChange}
        placeholder={placeholder}
        invalid={Boolean(error)}
        showValidity={false}
        controlClassName={control}
      />
    </FormFieldWrapper>
  );
}
