// ============================================================
// « Nouveau client » : la reprise d'office de la fiche prospect.
//
// Quand le numéro principal est celui d'un prospect ouvert d'un commercial
// (`prospect_lookup_phone`, voir useCreateClientForm), sa fiche remplit les
// champs ENCORE VIDES du formulaire : prénom, nom, entreprise, ville, sexe,
// date de naissance et ses autres numéros. Ce que l'opérateur a déjà tapé ou
// choisi n'est jamais écrasé.
//
// L'EMAIL, lui, n'est jamais repris d'office : `admin_create_client` en fait
// l'adresse de CONNEXION du client, déjà confirmée. Une adresse saisie par
// un commercial (sans aucune vérification) donnerait à celui qui la contrôle
// « Mot de passe oublié » — et le compte. Elle est seulement PROPOSÉE
// (`suggestedEmail`) : l'opérateur la prend d'un geste, après l'avoir fait
// confirmer par le client.
//
// Numéros : le numéro tapé peut être l'un des AUTRES numéros du prospect ;
// son principal devient alors un numéro de plus du client. Ses autres
// numéros s'ajoutent aussi, sans doublon (ni avec ceux déjà saisis, ni entre
// eux), d'abord dans les lignes laissées vides, puis en nouvelles lignes,
// dans la limite de MAX_PHONES.
//
// Fonctions pures : le hook décide QUAND (une seule reprise par prospect
// trouvé), ici seulement QUOI.
//
// « Créer son compte client » (07/10) : depuis la fiche d'un prospect, la
// direction ouvre ce formulaire avec son numéro principal déjà saisi
// (`/m/clients/new?phone=+237…`, `newClientPathForPhone`) ; la reprise
// ci-dessus fait le reste, et le déclencheur clients_match_prospect le rend
// « devenu client » à la création.
// ============================================================
import { fromE164, toE164, type PhoneValue } from '@/components/form/PhoneNumberInput';
import { EMAIL_SHAPE, isGender, type Gender } from '@/lib/people';
import type { ProspectMatch } from '@/hooks/useSales';
import { isoToBirthText } from './clientIdentity';
import type { CreateClientFields, PhoneRow } from './useCreateClientForm';

/** Ce qui peut être repris, dans l'ordre où la note le dit (l'email n'en est pas : il se propose). */
export const PREFILL_KEYS = ['firstName', 'lastName', 'company', 'city', 'gender', 'birthDate', 'phones'] as const;
export type PrefillKey = (typeof PREFILL_KEYS)[number];

/** La note « Repris de la fiche prospect de … ». */
export interface ProspectPrefill {
  prospectId: string;
  sourceLabel: string;
  prospectName: string;
  /** Ce qui a VRAIMENT été repris (vide : pas de note, seulement la proposition d'email). */
  filled: PrefillKey[];
  /** L'email de sa fiche, PROPOSÉ sous le champ (jamais posé d'office), ou null. */
  suggestedEmail: string | null;
}

/** Le formulaire au moment de la reprise. */
export interface PrefillState {
  fields: CreateClientFields;
  gender: Gender | null;
  phones: PhoneRow[];
}

const TEXT_KEYS = ['firstName', 'lastName', 'company', 'city'] as const;
type TextKey = (typeof TEXT_KEYS)[number];
const FROM_MATCH: Record<TextKey, keyof ProspectMatch> = {
  firstName: 'first_name',
  lastName: 'last_name',
  company: 'company',
  city: 'city',
};

const digitsOf = (v: PhoneValue) => v.national.replace(/\D/g, '');

/** Les numéros du prospect (principal d'abord), au format international, lisibles et sans double. */
function prospectNumbers(m: ProspectMatch): { value: PhoneValue; label: string }[] {
  const raw = [
    ...(m.phone_e164 ? [{ phone_e164: m.phone_e164, label: null as string | null }] : []),
    ...(Array.isArray(m.phones) ? m.phones : []),
  ];
  const seen = new Set<string>();
  const out: { value: PhoneValue; label: string }[] = [];
  for (const p of raw) {
    const value = fromE164(p?.phone_e164);
    const e164 = toE164(value);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    out.push({ value, label: (p.label ?? '').trim() });
  }
  return out;
}

/**
 * Ajoute aux lignes les numéros du prospect qui n'y sont pas encore : d'abord
 * dans les lignes secondaires vides, puis en nouvelles lignes (au plus `max`).
 * Renvoie les lignes (les mêmes si rien n'est ajouté) et combien l'ont été.
 */
export function mergeProspectPhones(
  rows: PhoneRow[],
  m: ProspectMatch,
  max: number,
  newKey: () => string,
): { rows: PhoneRow[]; added: number } {
  const present = new Set(rows.map((r) => toE164(r.value)).filter((e): e is string => !!e));
  const todo = prospectNumbers(m).filter((p) => !present.has(toE164(p.value) as string));
  if (todo.length === 0) return { rows, added: 0 };

  const next = rows.map((r) => ({ ...r }));
  let added = 0;
  for (const p of todo) {
    // Une ligne secondaire laissée vide d'abord (jamais la principale).
    const empty = next.findIndex((r, i) => i > 0 && digitsOf(r.value) === '');
    if (empty > 0) {
      next[empty] = { ...next[empty], value: p.value, label: next[empty].label.trim() || p.label };
    } else if (next.length < max) {
      next.push({ key: newKey(), value: p.value, label: p.label });
    } else {
      break;
    }
    added += 1;
  }
  return { rows: added > 0 ? next : rows, added };
}

/**
 * Ce que la fiche du prospect remplit dans le formulaire : seulement les
 * champs vides, seulement des valeurs non vides. Une réponse sans détails
 * (base pas encore migrée) ne remplit rien. L'email n'est que proposé
 * (`suggestedEmail`), et seulement si le champ est vide et l'adresse bien formée.
 */
export function planProspectPrefill(
  m: ProspectMatch,
  state: PrefillState,
): { fields: Partial<CreateClientFields>; gender: Gender | null; filled: Exclude<PrefillKey, 'phones'>[]; suggestedEmail: string | null } {
  const fields: Partial<CreateClientFields> = {};
  const filled: Exclude<PrefillKey, 'phones'>[] = [];
  for (const key of TEXT_KEYS) {
    const v = m[FROM_MATCH[key]];
    const incoming = typeof v === 'string' ? v.trim() : '';
    if (incoming && state.fields[key].trim() === '') {
      fields[key] = incoming;
      filled.push(key);
    }
  }
  const email = typeof m.email === 'string' ? m.email.trim().toLowerCase() : '';
  const suggestedEmail = email && EMAIL_SHAPE.test(email) && state.fields.email.trim() === '' ? email : null;
  let gender: Gender | null = null;
  if (state.gender === null && isGender(m.gender)) {
    gender = m.gender;
    filled.push('gender');
  }
  const birth = isoToBirthText(m.birth_date);
  if (birth && state.fields.birthDate.trim() === '') {
    fields.birthDate = birth;
    filled.push('birthDate');
  }
  // Dans l'ordre de la note.
  filled.sort((a, b) => PREFILL_KEYS.indexOf(a) - PREFILL_KEYS.indexOf(b));
  return { fields, gender, filled, suggestedEmail };
}

/** « Nouveau client » avec ce numéro principal déjà saisi (le « + » encodé : il se lirait comme une espace). */
export function newClientPathForPhone(e164: string): string {
  return `/m/clients/new?phone=${encodeURIComponent(e164)}`;
}

/**
 * Le numéro de `?phone=`, au format international, ou null s'il est absent
 * ou illisible. Un « + » laissé tel quel dans l'adresse arrive comme une
 * espace (`URLSearchParams`) : il est remis.
 */
export function prefillPhoneFromQuery(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const candidate = v.startsWith('+') ? v : `+${v.replace(/^0+/, '')}`;
  return toE164(fromE164(candidate.replace(/[^\d+]/g, '')));
}
