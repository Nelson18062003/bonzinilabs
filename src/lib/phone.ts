// ============================================================
// Normalisation des numéros de téléphone au format E.164.
//
// POURQUOI CE MODULE : Telnyx exige du E.164 strict (+237677889900) et
// rejette — ou pire, achemine mal — tout le reste. Or `clients.phone` est
// une colonne texte libre : les comptes récents créés via PhoneCountryInput
// contiennent bien « +237… », mais rien ne garantit la validité du numéro
// (le composant tronque à maxDigits, il ne valide pas), et les lignes
// historiques peuvent contenir n'importe quoi.
//
// ⚠️ UN NUMÉRO LOCAL NE SE DEVINE PAS. « 677889900 » est un mobile
// camerounais valide, mais la même suite de chiffres est valide ailleurs.
// Sans indication de pays, on NE TENTE RIEN : on renvoie null et la ligne
// part en revue manuelle. Deviner un pays sur un numéro de téléphone lié à
// des mouvements d'argent est exactement le genre de raccourci qui envoie
// la notification « votre solde est de X » au mauvais destinataire.
//
// S'appuie sur libphonenumber-js, qui connaît le plan de numérotation réel
// de chaque pays (longueurs, préfixes mobiles) — là où une regex maison ne
// ferait que compter les chiffres.
// ============================================================

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Format E.164 : « + », indicatif non nul, 8 à 15 chiffres au total. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export interface NormalizedPhone {
  /** Forme canonique stockée en base et envoyée à Telnyx. */
  e164: string;
  /** Pays ISO 3166-1 alpha-2 déduit du numéro (sert au routage expéditeur). */
  country: CountryCode;
  /** Forme lisible pour l'affichage : « +237 6 77 88 99 00 ». */
  international: string;
}

// ─── Nom de pays → ISO ──────────────────────────────────────────────────────
//
// L'application stocke `clients.country` sous forme de libellé français
// (« Cameroun », « Chine »), issu des listes de PhoneCountryInput et de
// countryCodes.ts. Cette table sert UNIQUEMENT d'indice pour reprendre les
// numéros historiques saisis au format local ; un numéro déjà en E.164 est
// résolu directement par libphonenumber et n'a pas besoin d'elle.

const COUNTRY_NAME_TO_ISO: Record<string, CountryCode> = {
  // CEMAC
  cameroun: 'CM', cameroon: 'CM',
  gabon: 'GA',
  tchad: 'TD', chad: 'TD',
  centrafrique: 'CF', rca: 'CF',
  congo: 'CG',
  'guinee equatoriale': 'GQ',
  // Afrique de l'Ouest
  "cote d'ivoire": 'CI', 'cote divoire': 'CI',
  senegal: 'SN',
  mali: 'ML',
  'burkina faso': 'BF',
  niger: 'NE',
  togo: 'TG',
  benin: 'BJ',
  guinee: 'GN',
  nigeria: 'NG',
  ghana: 'GH',
  'cap-vert': 'CV', 'cap vert': 'CV',
  // Afrique centrale et de l'Est
  'rd congo': 'CD',
  rwanda: 'RW',
  burundi: 'BI',
  angola: 'AO',
  kenya: 'KE',
  tanzanie: 'TZ',
  ouganda: 'UG',
  ethiopie: 'ET',
  'afrique du sud': 'ZA',
  // Afrique du Nord
  maroc: 'MA',
  tunisie: 'TN',
  algerie: 'DZ',
  // Europe
  france: 'FR',
  belgique: 'BE',
  suisse: 'CH',
  allemagne: 'DE',
  'royaume-uni': 'GB', 'royaume uni': 'GB',
  italie: 'IT',
  espagne: 'ES',
  portugal: 'PT',
  pologne: 'PL',
  roumanie: 'RO',
  luxembourg: 'LU',
  // Asie et Moyen-Orient
  chine: 'CN', china: 'CN',
  inde: 'IN', india: 'IN',
  turquie: 'TR',
  'arabie saoudite': 'SA',
  'emirats arabes unis': 'AE',
  // Amériques
  usa: 'US', 'etats-unis': 'US', 'etats unis': 'US',
  canada: 'CA',
  bresil: 'BR',
};

/** minuscules, sans accents, ponctuation resserrée — pour un lookup tolérant. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Résout un libellé de pays (ou un code ISO déjà propre) vers ISO alpha-2.
 * Renvoie undefined si le libellé est inconnu — l'appelant ne doit surtout
 * pas se rabattre sur un pays par défaut.
 */
export function countryNameToIso(value: unknown): CountryCode | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (raw === '') return undefined;

  // Déjà un code ISO alpha-2 ?
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase() as CountryCode;

  const key = normalizeKey(raw);
  if (COUNTRY_NAME_TO_ISO[key]) return COUNTRY_NAME_TO_ISO[key];

  // « États-Unis / Canada » et consorts : on retient le premier segment.
  const firstSegment = normalizeKey(raw.split('/')[0] ?? '');
  return COUNTRY_NAME_TO_ISO[firstSegment];
}

/** Contrôle de forme pur — n'atteste pas que le numéro existe. */
export function isValidE164(value: unknown): boolean {
  return typeof value === 'string' && E164_PATTERN.test(value);
}

/**
 * Normalise une saisie quelconque vers E.164, en validant contre le plan de
 * numérotation du pays.
 *
 * @param input       numéro brut (E.164, format local, avec espaces/tirets…)
 * @param countryHint libellé ou code ISO du pays — indispensable pour un
 *                    numéro local, ignoré pour un numéro déjà en « + ».
 * @returns null si le numéro est invalide ou si le pays reste indéterminable.
 */
export function normalizePhone(
  input: unknown,
  countryHint?: unknown,
): NormalizedPhone | null {
  if (typeof input !== 'string') return null;

  // Espaces insécables, tirets typographiques, parenthèses : tout part.
  const cleaned = input
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .trim();
  if (cleaned === '') return null;

  // Préfixe international « 00 » → « + » (très courant en Afrique de l'Ouest).
  const withPlus = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;

  const iso = countryNameToIso(countryHint);

  // Sans « + » ET sans pays connu : indevinable. On s'arrête là.
  if (!withPlus.startsWith('+') && !iso) return null;

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(withPlus, iso);
  } catch {
    return null;
  }

  if (!parsed || !parsed.isValid()) return null;

  const e164 = parsed.number;
  if (!isValidE164(e164)) return null;

  // Un numéro valide sans pays résolu ne doit pas être stocké : le routage
  // de l'expéditeur (alphanumérique vs numéro long) en dépend entièrement.
  const country = parsed.country ?? iso;
  if (!country) return null;

  return { e164, country, international: parsed.formatInternational() };
}

/** Affichage lisible. Retombe sur la valeur brute si elle n'est pas parsable. */
export function formatPhoneForDisplay(e164: unknown): string {
  if (typeof e164 !== 'string') return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.isValid() ? parsed.formatInternational() : e164;
}
