/**
 * Aides autour des numéros « +237691234567 » (trésorerie : contreparties).
 *
 * L'ancienne table `COUNTRY_CODES` (42 indicatifs recopiés à la main) a
 * disparu : la liste des pays vit dans `@/data/countries` et les indicatifs
 * sont dérivés de libphonenumber-js. Ces trois fonctions gardent leur
 * signature pour les écrans qui les utilisent encore.
 */
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import { COUNTRY_ISOS, countryDialCode } from './countries';

const DIAL_CODES_LONGEST_FIRST: string[] = Array.from(new Set(COUNTRY_ISOS.map(countryDialCode))).sort(
  (a, b) => b.length - a.length,
);

/**
 * Splits an E.164-ish phone number "+237691234567" into dial code
 * and the local number "691234567". Falls back to the default
 * dial code when the value doesn't start with a recognised prefix.
 */
export function splitPhone(value: string | null | undefined, defaultDialCode = '+237'): { dialCode: string; local: string } {
  if (!value) return { dialCode: defaultDialCode, local: '' };
  try {
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.countryCallingCode) {
      return { dialCode: `+${parsed.countryCallingCode}`, local: parsed.nationalNumber };
    }
  } catch {
    /* on retombe sur le préfixe le plus long */
  }
  for (const code of DIAL_CODES_LONGEST_FIRST) {
    if (value.startsWith(code)) {
      return { dialCode: code, local: value.slice(code.length).replace(/\D/g, '') };
    }
  }
  // Best-effort: assume default + numeric part.
  return { dialCode: defaultDialCode, local: value.replace(/\D/g, '') };
}

/**
 * Combines dial code + local number into the canonical "+237691234567" form,
 * stripping spaces and non-digits from the local portion.
 */
export function joinPhone(dialCode: string, local: string): string | null {
  const cleaned = local.replace(/\D/g, '');
  if (!cleaned) return null;
  return `${dialCode}${cleaned}`;
}

/**
 * Pretty-prints a phone number: "+237 6 91 23 45 67".
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const parsed = parsePhoneNumberFromString(value);
    if (parsed) return parsed.formatInternational();
  } catch {
    /* valeur non parsable : formatage approché */
  }
  const { dialCode, local } = splitPhone(value);
  return `${dialCode} ${new AsYouType().input(local)}`.trim();
}
