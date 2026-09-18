/**
 * Saisie d'un numéro de téléphone — indicatif, formatage, validation.
 *
 * À NE PAS CONFONDRE avec `PhoneField` (même dossier), qui reste en place :
 * celui-là est un champ simple, à indicatif FIXE affiché en préfixe, et
 * convient là où le pays ne varie pas (formulaire bénéficiaire). Celui-ci
 * ajoute le choix du pays, le formatage pendant la frappe et la validation,
 * pour les cas où le numéro vient d'où il veut.
 *
 * Le pays se choisit dans `CountryCombobox` : TOUS les pays du monde, avec
 * leur drapeau (SVG, lisible sous Windows) et une recherche par nom, code
 * ISO ou indicatif. L'ancienne liste restreinte à 43 pays classés par zone
 * a disparu : un client de Sierra Leone existe, il doit pouvoir être saisi.
 *
 * `libphonenumber-js` fait le travail qu'il fait bien : `AsYouType` formate
 * pendant la frappe selon le pays choisi, `isValidPhoneNumber` valide la
 * longueur ET le préfixe opérateur du pays, et la valeur remontée est en
 * E.164, le seul format que les passerelles acceptent sans réinterpréter.
 */
import { useTranslation } from 'react-i18next';
import {
  AsYouType,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import type { CountryCode } from 'libphonenumber-js';
import { cn } from '@/lib/utils';
import { countryDialCode, countryName, toCountryLang, type CountryIso } from '@/data/countries';
import { CountryCombobox } from './CountryCombobox';

/** « +237 » — dérivé, jamais écrit à la main. */
export function callingCode(iso: CountryCode): string {
  return countryDialCode(iso);
}

/* ── Valeur ──────────────────────────────────────────────────────────── */

export interface PhoneValue {
  /** Pays choisi — décide du formatage ET des règles de validité. */
  country: CountryCode;
  /** Ce que l'utilisateur voit, formaté au fil de la frappe. */
  national: string;
}

export const EMPTY_PHONE: PhoneValue = { country: 'CM', national: '' };

/** Formate au fil de la frappe, sans jamais perdre un chiffre saisi. */
export function formatNational(input: string, country: CountryCode): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  // `AsYouType` n'ajoute une séparation qu'une fois le groupe complet ; il
  // rend donc la saisie stable, sans faire sauter le curseur.
  return new AsYouType(country).input(digits);
}

/** Le numéro est-il un vrai numéro de CE pays ? (longueur ET préfixe) */
export function isPhoneComplete(value: PhoneValue): boolean {
  const digits = value.national.replace(/\D/g, '');
  if (!digits) return false;
  try {
    return isValidPhoneNumber(digits, value.country);
  } catch {
    return false;
  }
}

/** Forme canonique « +237699000000 », ou `null` si le numéro est incomplet. */
export function toE164(value: PhoneValue): string | null {
  const digits = value.national.replace(/\D/g, '');
  if (!digits) return null;
  try {
    const parsed = parsePhoneNumberFromString(digits, value.country);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

/** Reconstruit une valeur éditable depuis un E.164 stocké. */
export function fromE164(e164: string | null | undefined): PhoneValue {
  if (!e164) return EMPTY_PHONE;
  try {
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed?.country) return EMPTY_PHONE;
    return {
      country: parsed.country,
      national: formatNational(parsed.nationalNumber, parsed.country),
    };
  } catch {
    return EMPTY_PHONE;
  }
}

/** Affichage lecture seule : « +237 6 99 00 00 00 ». */
export function formatE164ForDisplay(e164: string | null | undefined): string {
  if (!e164) return '—';
  try {
    return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
  } catch {
    return e164;
  }
}

/**
 * Un exemple de la BONNE longueur pour le pays choisi, tiré des exemples de
 * numéros mobiles de la bibliothèque : le placeholder « 6XX XXX XXX » était
 * figé sur le Cameroun et devenait faux dès qu'on changeait d'indicatif.
 */
export function examplePlaceholder(iso: CountryCode): string {
  try {
    const example = getExampleNumber(iso, examples);
    if (example) return formatNational(example.nationalNumber, iso);
  } catch {
    /* pays sans exemple connu */
  }
  return '';
}

/* ── Composant ───────────────────────────────────────────────────────── */

interface Props {
  id?: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  /** Placeholder ; par défaut, un exemple réel du pays choisi. */
  placeholder?: string;
  disabled?: boolean;
  /** Affiche l'état de validité sous le champ (dès que l'on a saisi). */
  showValidity?: boolean;
  /** Force l'état d'erreur (bord rouge) — ex. numéro déjà pris. */
  invalid?: boolean;
  className?: string;
  /** Classes communes au bouton d'indicatif et au champ (hauteur, rayon). */
  controlClassName?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

export function PhoneNumberInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  showValidity = true,
  invalid,
  className,
  controlClassName,
  autoFocus,
  'aria-label': ariaLabel,
}: Props) {
  const { t, i18n } = useTranslation('common');
  const lang = toCountryLang(i18n.language);
  const digits = value.national.replace(/\D/g, '');
  const complete = isPhoneComplete(value);
  const touched = digits.length > 0;
  const showWarn = touched && !complete;

  const handleCountry = (iso: CountryIso) => {
    // Reformater les chiffres déjà saisis selon le NOUVEAU pays plutôt que
    // de vider le champ : l'opérateur qui se trompe d'indicatif ne doit pas
    // ressaisir le numéro.
    onChange({ country: iso, national: formatNational(value.national, iso) });
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-2">
        <CountryCombobox
          variant="dial"
          value={value.country}
          onChange={handleCountry}
          disabled={disabled}
          invalid={invalid}
          className={controlClassName}
        />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          aria-label={ariaLabel ?? t('phone')}
          aria-invalid={invalid || showWarn}
          disabled={disabled}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-[16px] tabular-nums text-[#1E1E1E] outline-none transition-colors',
            'placeholder:text-[#B3B3B3] focus:border-[#2C2C2C] focus:ring-1 focus:ring-[#2C2C2C]',
            'dark:bg-[#2C2C2C] dark:text-[#F5F5F5] dark:placeholder:text-[#757575] dark:focus:border-[#E3E3E3] dark:focus:ring-[#E3E3E3]',
            'disabled:cursor-not-allowed disabled:border-[#B3B3B3] disabled:bg-[#D9D9D9] disabled:text-[#B3B3B3]',
            invalid
              ? 'border-[#EC221F]'
              : showWarn
                ? 'border-[#E8B931]'
                : 'border-[#949494] dark:border-[#6E6E6E]',
            controlClassName,
          )}
          placeholder={placeholder ?? examplePlaceholder(value.country)}
          value={value.national}
          onChange={(e) => onChange({ ...value, national: formatNational(e.target.value, value.country) })}
        />
      </div>

      {showValidity && touched && (
        <p className={cn('text-[14px]', complete ? 'text-[#009951] dark:text-[#14AE5C]' : 'text-[#975102] dark:text-[#E8B931]')}>
          {complete
            ? t('phoneField.valid', { number: toE164(value) })
            : t('phoneField.incompleteFor', { country: countryName(value.country, lang) })}
        </p>
      )}
    </div>
  );
}
