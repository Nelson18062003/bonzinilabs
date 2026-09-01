/**
 * Saisie d'un numéro de téléphone — indicatif, formatage, validation.
 *
 * À NE PAS CONFONDRE avec `PhoneField` (même dossier), qui reste en place :
 * celui-là est un champ simple, à indicatif FIXE affiché en préfixe, et
 * convient là où le pays ne varie pas (formulaire bénéficiaire). Celui-ci
 * ajoute le choix du pays, le formatage pendant la frappe et la validation,
 * pour les cas où le numéro vient d'où il veut.
 *
 * Ce que remplaçait ce composant, dans le formulaire « Nouveau client » :
 *
 *   · un `<select>` NATIF pour l'indicatif, sans `appearance-none` ni
 *     chevron, à côté d'un champ « Pays » qui, lui, en avait un — deux
 *     listes déroulantes voisines qui ne se ressemblaient pas, et dont une
 *     seule montrait qu'elle était déroulable ;
 *   · un drapeau en emoji qui, faute de police correspondante sur le poste,
 *     s'affichait « CN » — les deux lettres de l'indicateur régional — au
 *     lieu de 🇨🇳. D'où l'étrange « CN +86 » à l'écran. Aucun drapeau ici :
 *     le code ISO et le nom du pays se lisent partout, sur tout poste ;
 *   · AUCUN formatage ni validation. « 6 99 00 00 00 », « 00237699… » et
 *     « 699000000 » entraient tous les trois en base tels quels, et
 *     partaient ensuite en échec silencieux à l'envoi WhatsApp.
 *
 * Ici, `libphonenumber-js` — déjà une dépendance du projet — fait le travail
 * qu'il fait bien : `AsYouType` formate pendant la frappe selon le pays
 * choisi, `isValidPhoneNumber` valide la longueur ET le préfixe opérateur du
 * pays, et la valeur remontée est en E.164, le seul format que les
 * passerelles acceptent sans réinterpréter.
 */
import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, getCountryCallingCode } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ── Pays proposés ───────────────────────────────────────────────────
 *
 * Liste RESTREINTE et ordonnée par pertinence métier, pas les 250 pays que
 * connaît la bibliothèque : les clients sont des importateurs africains,
 * leurs fournisseurs sont chinois. L'indicatif n'est jamais écrit à la main
 * ci-dessous — il est DÉRIVÉ du code ISO par la bibliothèque, donc il ne
 * peut pas dériver de la réalité (le code en dur « +236 » pour la RCA était
 * juste, mais rien ne le garantissait). */

interface CountryGroup {
  label: string;
  countries: { iso: CountryCode; name: string }[];
}

export const PHONE_COUNTRY_GROUPS: CountryGroup[] = [
  {
    label: 'Zone CEMAC',
    countries: [
      { iso: 'CM', name: 'Cameroun' },
      { iso: 'GA', name: 'Gabon' },
      { iso: 'TD', name: 'Tchad' },
      { iso: 'CF', name: 'République centrafricaine' },
      { iso: 'CG', name: 'Congo-Brazzaville' },
      { iso: 'GQ', name: 'Guinée équatoriale' },
    ],
  },
  {
    label: "Afrique de l'Ouest",
    countries: [
      { iso: 'CI', name: "Côte d'Ivoire" },
      { iso: 'SN', name: 'Sénégal' },
      { iso: 'ML', name: 'Mali' },
      { iso: 'BF', name: 'Burkina Faso' },
      { iso: 'TG', name: 'Togo' },
      { iso: 'BJ', name: 'Bénin' },
      { iso: 'NE', name: 'Niger' },
      { iso: 'GN', name: 'Guinée' },
      { iso: 'NG', name: 'Nigeria' },
      { iso: 'GH', name: 'Ghana' },
    ],
  },
  {
    label: 'Afrique centrale et de l’Est',
    countries: [
      { iso: 'CD', name: 'RD Congo' },
      { iso: 'RW', name: 'Rwanda' },
      { iso: 'BI', name: 'Burundi' },
      { iso: 'AO', name: 'Angola' },
      { iso: 'KE', name: 'Kenya' },
      { iso: 'TZ', name: 'Tanzanie' },
      { iso: 'UG', name: 'Ouganda' },
      { iso: 'ET', name: 'Éthiopie' },
    ],
  },
  {
    label: 'Afrique du Nord et australe',
    countries: [
      { iso: 'MA', name: 'Maroc' },
      { iso: 'TN', name: 'Tunisie' },
      { iso: 'DZ', name: 'Algérie' },
      { iso: 'ZA', name: 'Afrique du Sud' },
    ],
  },
  {
    label: 'Asie et Moyen-Orient',
    countries: [
      { iso: 'CN', name: 'Chine' },
      { iso: 'HK', name: 'Hong Kong' },
      { iso: 'AE', name: 'Émirats arabes unis' },
      { iso: 'SA', name: 'Arabie saoudite' },
      { iso: 'TR', name: 'Turquie' },
      { iso: 'IN', name: 'Inde' },
    ],
  },
  {
    label: 'Europe et Amérique',
    countries: [
      { iso: 'FR', name: 'France' },
      { iso: 'BE', name: 'Belgique' },
      { iso: 'CH', name: 'Suisse' },
      { iso: 'GB', name: 'Royaume-Uni' },
      { iso: 'DE', name: 'Allemagne' },
      { iso: 'ES', name: 'Espagne' },
      { iso: 'IT', name: 'Italie' },
      { iso: 'LU', name: 'Luxembourg' },
      { iso: 'US', name: 'États-Unis / Canada' },
    ],
  },
];

const ALL_COUNTRIES = PHONE_COUNTRY_GROUPS.flatMap((g) => g.countries);

/** « +237 » — dérivé, jamais écrit à la main. */
export function callingCode(iso: CountryCode): string {
  return `+${getCountryCallingCode(iso)}`;
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
  className?: string;
  'aria-label'?: string;
}

export function PhoneNumberInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  showValidity = true,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const digits = value.national.replace(/\D/g, '');
  const complete = isPhoneComplete(value);
  const touched = digits.length > 0;

  const handleCountry = (iso: string) => {
    const country = iso as CountryCode;
    // Reformater les chiffres déjà saisis selon le NOUVEAU pays plutôt que
    // de vider le champ : l'opérateur qui se trompe d'indicatif ne doit pas
    // ressaisir le numéro.
    onChange({ country, national: formatNational(value.national, country) });
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-2">
        <Select value={value.country} onValueChange={handleCountry} disabled={disabled}>
          {/* Le chevron vient de `SelectTrigger` : même composant, donc même
              affordance que le champ « Pays » juste en dessous. */}
          <SelectTrigger className="h-12 w-[132px] shrink-0 rounded-2xl" aria-label="Indicatif pays">
            <SelectValue>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">{value.country}</span>
                <span className="tabular-nums">{callingCode(value.country)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {PHONE_COUNTRY_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </SelectLabel>
                {group.countries.map((c) => (
                  <SelectItem key={c.iso} value={c.iso}>
                    <span className="flex w-full items-baseline gap-2">
                      <span className="tabular-nums text-muted-foreground">{callingCode(c.iso)}</span>
                      <span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={ariaLabel}
          aria-invalid={touched && !complete}
          disabled={disabled}
          className={cn(
            'h-12 flex-1 rounded-2xl border bg-card px-4 text-[14px] tabular-nums outline-none transition',
            'focus:ring-2 focus:ring-ring',
            touched && !complete ? 'border-amber-400 dark:border-amber-600' : 'border-border',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          placeholder={placeholder ?? examplePlaceholder(value.country)}
          value={value.national}
          onChange={(e) => onChange({ ...value, national: formatNational(e.target.value, value.country) })}
        />
      </div>

      {showValidity && touched && (
        <p className={cn('text-[12px]', complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500')}>
          {complete
            ? `Numéro valide · ${toE164(value)}`
            : `Numéro incomplet pour ${countryName(value.country)}`}
        </p>
      )}
    </div>
  );
}

function countryName(iso: CountryCode): string {
  return ALL_COUNTRIES.find((c) => c.iso === iso)?.name ?? iso;
}

/**
 * Un exemple de la BONNE longueur pour le pays choisi, construit depuis la
 * bibliothèque : le placeholder « 6XX XXX XXX » était figé sur le Cameroun
 * et devenait faux dès qu'on changeait d'indicatif.
 */
function examplePlaceholder(iso: CountryCode): string {
  const samples: Partial<Record<CountryCode, string>> = {
    CM: '699000000',
    CN: '13022045608',
    FR: '612345678',
    US: '2015550123',
  };
  const sample = samples[iso];
  if (sample) return formatNational(sample, iso);
  return 'Numéro national';
}
