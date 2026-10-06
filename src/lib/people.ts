// ============================================================
// L'identité d'une personne — prospect (espace commercial) ou client
// (fiche, création par l'équipe). Une seule source pour :
//   · le sexe : « Homme » / « Femme ». En base, `MALE` / `FEMALE` ; chez les
//     clients, `OTHER` (la valeur par défaut historique) se lit « non
//     renseigné » et ne se choisit plus ;
//   · la date de naissance : facultative, « AAAA-MM-JJ », de 16 à 110 ans
//     (la même règle qu'au serveur : prospect_create / prospect_update /
//     admin_set_client_identity) ;
//   · les villes du Cameroun proposées à la saisie (la saisie reste libre) ;
//   · la forme d'une adresse email.
// ============================================================

export type Gender = 'MALE' | 'FEMALE';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Homme' },
  { value: 'FEMALE', label: 'Femme' },
];

export function isGender(v: unknown): v is Gender {
  return v === 'MALE' || v === 'FEMALE';
}

/** « Homme » / « Femme » ; null pour `OTHER`, vide ou inconnu (= non renseigné). */
export function genderLabel(g: string | null | undefined): string | null {
  return GENDER_OPTIONS.find((o) => o.value === g)?.label ?? null;
}

/** Les villes proposées (les plus fréquentes d'abord) — la saisie reste libre. */
export const CAMEROON_CITIES = [
  'Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Ngaoundéré', 'Bertoua', 'Ebolowa', 'Kribi',
  'Limbé', 'Buea', 'Kumba', 'Edéa', 'Nkongsamba', 'Dschang', 'Foumban', 'Mbouda', 'Bafang', 'Bangangté',
  'Loum', 'Mbalmayo', 'Sangmélima', 'Kousséri', 'Mokolo', 'Guider', 'Meiganga', 'Batouri', 'Abong-Mbang', 'Tiko',
] as const;

export const BIRTH_MIN_AGE = 16;
export const BIRTH_MAX_AGE = 110;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « AAAA-MM-JJ » → Date (UTC, midi) si la date existe vraiment, sinon null. */
function parseDay(iso: string): Date | null {
  const m = ISO_DAY.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

/** L'âge révolu à `today` (null si la date est illisible). */
export function ageOn(iso: string | null | undefined, today: Date = new Date()): number | null {
  if (!iso) return null;
  const b = parseDay(iso.slice(0, 10));
  if (!b) return null;
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < b.getUTCMonth() || (today.getUTCMonth() === b.getUTCMonth() && today.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** '' → null (facultative) ; sinon le message à afficher, ou null si elle est bonne. */
export function birthDateError(iso: string, today: Date = new Date()): string | null {
  if (iso.trim() === '') return null;
  const age = ageOn(iso.trim(), today);
  if (age === null) return 'Date de naissance invalide';
  if (age < BIRTH_MIN_AGE || age > BIRTH_MAX_AGE) return `Date de naissance invalide (âge entre ${BIRTH_MIN_AGE} et ${BIRTH_MAX_AGE} ans)`;
  return null;
}

/**
 * La date de naissance au fil de la frappe — la MÊME saisie partout (fiche
 * prospect de « /v », création et fiche client) : chiffres seulement,
 * « 12031985 » → « 12/03/1985 ». La barre n'apparaît qu'avec le chiffre qui
 * la suit (effacer reste naturel, jamais coincé derrière une barre) ; un
 * jour qui commence par 4 à 9 devient « 04 », un mois qui commence par 2 à 9
 * devient « 02 » ; une date collée au format « AAAA-MM-JJ » est retournée.
 */
export function formatBirthInput(raw: string): string {
  const iso = ISO_DAY.exec(raw.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  let dd = '';
  let mm = '';
  let yy = '';
  for (const ch of raw.replace(/\D/g, '')) {
    if (dd.length < 2) dd = dd === '' && ch > '3' ? `0${ch}` : dd + ch;
    else if (mm.length < 2) mm = mm === '' && ch > '1' ? `0${ch}` : mm + ch;
    else if (yy.length < 4) yy += ch;
  }
  return [dd, mm, yy].filter(Boolean).join('/');
}

/** « AAAA-MM-JJ » (ou un horodatage qui commence ainsi) → « JJ/MM/AAAA » ; '' si absente ou illisible. */
export function isoToBirthText(iso: string | null | undefined): string {
  const m = ISO_DAY.exec((iso ?? '').slice(0, 10));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 12 mars 1985 (41 ans) » ; null si absente ou illisible. */
export function formatBirthDate(iso: string | null | undefined, today: Date = new Date()): string | null {
  if (!iso) return null;
  const b = parseDay(iso.slice(0, 10));
  if (!b) return null;
  const age = ageOn(iso, today);
  return `${b.getUTCDate() === 1 ? '1er' : b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}${age !== null ? ` (${age} ans)` : ''}`;
}

/** La forme d'une adresse (la même qu'au serveur) ; '' est accepté (facultative). */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(email: string): string | null {
  const e = email.trim();
  if (e === '') return null;
  if (e.length > 254 || !EMAIL_SHAPE.test(e)) return 'Adresse email invalide';
  return null;
}
