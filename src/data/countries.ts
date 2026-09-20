/**
 * Pays du monde — LA source unique de l'application.
 *
 * Avant ce module, quatre listes écrites à la main (42, 34, 43 et 42 pays)
 * vivaient dans quatre fichiers, aucune ne se ressemblait, et aucune ne
 * connaissait la Sierra Leone. Ici :
 *
 *   · la liste des pays vient de libphonenumber-js (245 codes ISO 3166-1
 *     alpha-2), donc TOUT pays qui a un plan de numérotation est proposé,
 *     et l'indicatif est DÉRIVÉ, jamais recopié ;
 *   · les noms viennent des données CLDR figées dans
 *     `countryNames.generated.ts` (fr / en / zh), sans dépendre de l'ICU du
 *     navigateur ;
 *   · les drapeaux sont des SVG (`CountryFlag`), parce que les emojis de
 *     drapeau n'existent pas sous Windows — l'opérateur y voyait « CN » au
 *     lieu de 🇨🇳 ;
 *   · pas de classement par zone : une liste alphabétique complète, avec
 *     les pays fréquents épinglés en tête, et une recherche qui comprend
 *     « sierra », « SL », « 232 » ou « +232 ».
 *
 * La base stocke `clients.country` sous forme de libellé FRANÇAIS
 * (« Cameroun ») : `countryLabelFr` produit ce libellé, `isoFromCountryLabel`
 * retrouve l'ISO à partir de n'importe quel libellé historique.
 */
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { COUNTRY_NAMES } from './countryNames.generated';

export type CountryIso = CountryCode;
export type CountryLang = 'fr' | 'en' | 'zh';

export interface Country {
  iso: CountryIso;
  /** « +237 » — dérivé de la bibliothèque. */
  dialCode: string;
  /** Nom dans la langue demandée. */
  name: string;
  /** Nom français — celui que la base stocke. */
  nameFr: string;
  /** Clé de recherche normalisée : noms fr/en/zh + ISO + indicatif. */
  searchKey: string;
}

/** Tous les pays que la bibliothèque sait numéroter. */
export const COUNTRY_ISOS: readonly CountryIso[] = getCountries();

/**
 * Épinglés en tête de liste : la zone CEMAC (nos clients) et la Chine (leurs
 * fournisseurs). Ce n'est PAS un classement par zone — le reste du monde suit,
 * par ordre alphabétique, sans rubrique.
 */
export const PRIORITY_COUNTRIES: readonly CountryIso[] = ['CM', 'GA', 'TD', 'CF', 'CG', 'GQ', 'CN'];

const LANG_INDEX: Record<CountryLang, 0 | 1 | 2> = { fr: 0, en: 1, zh: 2 };

/** Langue de l'interface, ramenée à fr / en / zh. */
export function toCountryLang(language: string | undefined | null): CountryLang {
  const short = (language ?? 'fr').slice(0, 2).toLowerCase();
  return short === 'en' || short === 'zh' ? short : 'fr';
}

/** « +237 » — dérivé, jamais écrit à la main. */
export function countryDialCode(iso: CountryIso): string {
  return `+${getCountryCallingCode(iso)}`;
}

/** Nom d'un pays dans une langue ; retombe sur l'ISO si inconnu. */
export function countryName(iso: string, lang: CountryLang = 'fr'): string {
  const triple = COUNTRY_NAMES[iso.toUpperCase()];
  return triple ? triple[LANG_INDEX[lang]] : iso;
}

/** Le libellé français, tel que la base le stocke dans `clients.country`. */
export function countryLabelFr(iso: CountryIso): string {
  return countryName(iso, 'fr');
}

/**
 * Minuscules, sans accents, apostrophes et tirets aplatis : « Côte d'Ivoire »
 * et « cote divoire » se retrouvent. Sert à la recherche ET à la résolution
 * des libellés historiques.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[-–—_.,()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drapeau emoji (Windows ne l'affiche pas — réservé aux contextes où un SVG est impossible, comme un `<option>`). */
export function flagEmoji(iso: string): string {
  const code = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

const CACHE: Partial<Record<CountryLang, Country[]>> = {};

function buildCountry(iso: CountryIso, lang: CountryLang): Country {
  const triple = COUNTRY_NAMES[iso];
  const dialCode = countryDialCode(iso);
  const names = triple ? [...triple] : [iso, iso, iso];
  return {
    iso,
    dialCode,
    name: triple ? triple[LANG_INDEX[lang]] : iso,
    nameFr: triple ? triple[0] : iso,
    searchKey: normalizeText([...names, iso, dialCode, dialCode.slice(1)].join(' ')),
  };
}

/** Tous les pays, triés par nom dans la langue demandée. Mémoïsé par langue. */
export function listCountries(lang: CountryLang = 'fr'): Country[] {
  const cached = CACHE[lang];
  if (cached) return cached;
  const collator = new Intl.Collator(lang === 'zh' ? 'zh-CN' : lang, { sensitivity: 'base' });
  const list = COUNTRY_ISOS.map((iso) => buildCountry(iso, lang)).sort((a, b) => collator.compare(a.name, b.name));
  CACHE[lang] = list;
  return list;
}

export function findCountry(iso: string | null | undefined, lang: CountryLang = 'fr'): Country | undefined {
  if (!iso) return undefined;
  const upper = iso.toUpperCase();
  return listCountries(lang).find((c) => c.iso === upper);
}

/**
 * Recherche : chaque mot de la saisie doit apparaître dans la clé du pays.
 * Un indicatif se tape avec ou sans « + ». Les pays épinglés sortent en
 * premier, puis l'ordre alphabétique.
 */
export function searchCountries(query: string, lang: CountryLang = 'fr'): Country[] {
  const all = listCountries(lang);
  const tokens = normalizeText(query.replace(/^\+/, '')).split(' ').filter(Boolean);
  const matches = tokens.length === 0 ? all : all.filter((c) => tokens.every((t) => c.searchKey.includes(t)));
  if (matches.length === all.length) return matches;
  const pinned = matches.filter((c) => PRIORITY_COUNTRIES.includes(c.iso));
  const rest = matches.filter((c) => !PRIORITY_COUNTRIES.includes(c.iso));
  return [...pinned, ...rest];
}

/* ── Libellés historiques → ISO ─────────────────────────────────────────
 * `clients.country` a reçu, au fil des formulaires, « RCA », « Congo »,
 * « États-Unis / Canada », « Centrafrique »… On les reconnaît tous. */
const LEGACY_LABELS: Record<string, CountryIso> = {
  rca: 'CF',
  centrafrique: 'CF',
  'republique centrafricaine': 'CF',
  congo: 'CG',
  'congo brazzaville': 'CG',
  'rd congo': 'CD',
  'rdc': 'CD',
  'congo kinshasa': 'CD',
  'republique democratique du congo': 'CD',
  usa: 'US',
  'etats unis': 'US',
  'etats unis canada': 'US',
  'cote divoire': 'CI',
  'guinee equatoriale': 'GQ',
  'cap vert': 'CV',
  'royaume uni': 'GB',
  uk: 'GB',
  'emirats arabes unis': 'AE',
  'arabie saoudite': 'SA',
  chine: 'CN',
  china: 'CN',
  'hong kong': 'HK',
  macao: 'MO',
  tchad: 'TD',
  chad: 'TD',
  birmanie: 'MM',
  vietnam: 'VN',
  'coree du sud': 'KR',
};

let REVERSE: Map<string, CountryIso> | null = null;

function reverseIndex(): Map<string, CountryIso> {
  if (REVERSE) return REVERSE;
  const map = new Map<string, CountryIso>();
  for (const iso of COUNTRY_ISOS) {
    const triple = COUNTRY_NAMES[iso];
    if (!triple) continue;
    for (const name of triple) {
      const key = normalizeText(name);
      if (!map.has(key)) map.set(key, iso);
    }
  }
  for (const [key, iso] of Object.entries(LEGACY_LABELS)) map.set(key, iso);
  REVERSE = map;
  return map;
}

/**
 * Retrouve l'ISO d'un libellé de pays — français, anglais, chinois ou
 * historique. Un code ISO passe tel quel. `undefined` si inconnu : l'appelant
 * ne doit surtout pas se rabattre sur un pays par défaut.
 */
export function isoFromCountryLabel(label: unknown): CountryIso | undefined {
  if (typeof label !== 'string') return undefined;
  const raw = label.trim();
  if (raw === '') return undefined;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const upper = raw.toUpperCase() as CountryIso;
    return COUNTRY_ISOS.includes(upper) ? upper : undefined;
  }
  const index = reverseIndex();
  const key = normalizeText(raw);
  const direct = index.get(key);
  if (direct) return direct;
  // « États-Unis / Canada » et consorts : on retient le premier segment.
  const first = normalizeText(raw.split('/')[0] ?? '');
  return index.get(first);
}
