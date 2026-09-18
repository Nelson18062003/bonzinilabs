/**
 * Champ téléphone de l'app client (inscription, onboarding) et des fiches
 * client admin — version « tous les pays ».
 *
 * L'ancien composant portait sa propre liste de 34 pays, des masques de
 * saisie écrits à la main (« # ## ## ## ##») et des drapeaux emoji invisibles
 * sous Windows. Il devient une façade au-dessus de `PhoneNumberInput` :
 * même API (`value` = chaîne « +237699… » émise à chaque frappe,
 * `onCountryChange`, `selectedCountryName`), mais 245 pays, drapeaux SVG,
 * formatage et validation par libphonenumber.
 *
 * `COUNTRIES` et `Country` restent exportés pour les écrans qui listent les
 * pays eux-mêmes ; `name` est le libellé FRANÇAIS (celui que la base
 * stocke), `flag` un emoji de repli.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  countryLabelFr,
  flagEmoji,
  isoFromCountryLabel,
  listCountries,
  type CountryIso,
} from '@/data/countries';
import { PhoneNumberInput, EMPTY_PHONE, fromE164, formatNational, type PhoneValue } from '@/components/form/PhoneNumberInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface Country {
  iso: CountryIso;
  /** Libellé français — celui que `clients.country` stocke. */
  name: string;
  flag: string;
  /** Sans le « + » (compatibilité avec l'ancien composant). */
  dialCode: string;
}

/** Tous les pays, triés par nom français. */
export const COUNTRIES: Country[] = listCountries('fr').map((c) => ({
  iso: c.iso,
  name: c.nameFr,
  flag: flagEmoji(c.iso),
  dialCode: c.dialCode.slice(1),
}));

function toCountry(iso: CountryIso): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? { iso, name: countryLabelFr(iso), flag: flagEmoji(iso), dialCode: '' };
}

/** « +237699000000 » ou, si incomplet, l'indicatif suivi des chiffres saisis. */
function toRawValue(value: PhoneValue): string {
  const digits = value.national.replace(/\D/g, '');
  if (!digits) return '';
  try {
    const parsed = parsePhoneNumberFromString(digits, value.country);
    if (parsed?.isValid()) return parsed.number;
  } catch {
    /* incomplet : on émet la concaténation brute, comme avant */
  }
  return `+${toCountry(value.country).dialCode}${digits}`;
}

function fromRawValue(raw: string, fallbackCountry: CountryIso): PhoneValue {
  if (!raw) return { country: fallbackCountry, national: '' };
  const strict = fromE164(raw);
  if (strict.national) return strict;
  // Valeur incomplète « +2376990 » : retrouver le pays par son indicatif —
  // SEULEMENT si la valeur annonce un indicatif (« + » ou « 00 »). Un numéro
  // local historique « 677889900 » commence par 677 : sans cette garde, il
  // s'ouvrait en Îles Salomon (+677) et repartait faux au premier caractère.
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  const digitsOnly = (trimmed.startsWith('00') ? trimmed.slice(2) : trimmed).replace(/\D/g, '');
  if (international) {
    const match = [...COUNTRIES]
      .filter((c) => c.dialCode && digitsOnly.startsWith(c.dialCode))
      .sort((a, b) => b.dialCode.length - a.dialCode.length)[0];
    if (match) {
      return { country: match.iso, national: formatNational(digitsOnly.slice(match.dialCode.length), match.iso) };
    }
  }
  return { country: fallbackCountry, national: formatNational(digitsOnly, fallbackCountry) };
}

interface PhoneCountryInputProps {
  value: string;
  onChange: (val: string) => void;
  /** Libellé de pays (français ou autre) imposé de l'extérieur. */
  selectedCountryName?: string;
  onCountryChange?: (country: Country) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Masque le libellé interne (ex. l'onboarding fournit le sien). */
  hideLabel?: boolean;
  /** Classes du bouton d'indicatif et du champ (hauteur, rayon). */
  controlClassName?: string;
}

export function PhoneCountryInput({
  value,
  onChange,
  selectedCountryName,
  onCountryChange,
  error,
  disabled,
  autoFocus,
  hideLabel,
  controlClassName,
}: PhoneCountryInputProps) {
  const { t } = useTranslation('common');
  const [phone, setPhone] = useState<PhoneValue>(() => fromRawValue(value, EMPTY_PHONE.country));
  const lastEmitted = useRef(value);

  // Valeur externe modifiée ailleurs que par nous (reset de formulaire).
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setPhone(fromRawValue(value, phone.country));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Pays imposé par le champ « Pays » du formulaire.
  useEffect(() => {
    const iso = isoFromCountryLabel(selectedCountryName);
    if (!iso || iso === phone.country) return;
    const next = { country: iso, national: formatNational(phone.national, iso) };
    setPhone(next);
    const raw = toRawValue(next);
    lastEmitted.current = raw;
    onChange(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryName]);

  const handleChange = (next: PhoneValue) => {
    const countryChanged = next.country !== phone.country;
    setPhone(next);
    const raw = toRawValue(next);
    lastEmitted.current = raw;
    onChange(raw);
    if (countryChanged) onCountryChange?.(toCountry(next.country));
  };

  const errorText = useMemo(() => error?.trim() || '', [error]);

  return (
    <div className="w-full">
      {!hideLabel && (
        <label className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">
          <Phone className="h-4 w-4" />
          {t('phone')} *
        </label>
      )}
      <PhoneNumberInput
        value={phone}
        onChange={handleChange}
        disabled={disabled}
        autoFocus={autoFocus}
        invalid={Boolean(errorText)}
        showValidity={!errorText}
        controlClassName={cn('h-12 rounded-2xl', controlClassName)}
      />
      {errorText && <p className="mt-1 text-xs text-[#C0504D] dark:text-[#E79A9A]">{errorText}</p>}
    </div>
  );
}
