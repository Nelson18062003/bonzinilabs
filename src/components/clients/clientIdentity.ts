// ============================================================
// Le sexe et la date de naissance d'un CLIENT, côté écran — création
// (bureau, réception) et modification de la fiche. Les règles elles-mêmes
// (16 à 110 ans, Homme / Femme) vivent dans `@/lib/people`, comme au
// serveur ; ici, seulement la saisie :
//   · la date se tape « JJ/MM/AAAA », les barres se posent au fil de la
//     frappe (clavier numérique sur téléphone), et se lit en « AAAA-MM-JJ »
//     pour la base ;
//   · ce qui ne va pas avec elle, en code (`BirthIssue`) : l'écran le dit
//     dans la langue de l'opérateur.
// ============================================================
import { ageOn, birthDateError, formatBirthInput, isGender, isoToBirthText, type Gender } from '@/lib/people';

// La saisie elle-même (barres, zéros, date collée « AAAA-MM-JJ ») est
// commune à « /v » et aux clients : `@/lib/people`.
export { formatBirthInput, isoToBirthText };

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « JJ/MM/AAAA » complet → « AAAA-MM-JJ » (forme seulement : `birthTextIssue` dit si elle existe). */
export function birthTextToIso(text: string): string | null {
  const d = text.replace(/\D/g, '');
  if (d.length !== 8) return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** incomplete : moins de 8 chiffres · invalid : ce jour n'existe pas · age : hors de 16 à 110 ans. */
export type BirthIssue = 'incomplete' | 'invalid' | 'age';

/** '' → null (la date est facultative) ; sinon ce qui ne va pas, ou null si elle est bonne. */
export function birthTextIssue(text: string, today: Date = new Date()): BirthIssue | null {
  if (text.trim() === '') return null;
  const iso = birthTextToIso(text);
  if (!iso) return 'incomplete';
  if (birthDateError(iso, today) === null) return null;
  return ageOn(iso, today) === null ? 'invalid' : 'age';
}

/** La date bonne, prête pour la base (« AAAA-MM-JJ »), sinon null. */
export function validBirthIso(text: string, today: Date = new Date()): string | null {
  return birthTextIssue(text, today) === null ? birthTextToIso(text) : null;
}

/** « 12 mars 1985 » dans la langue de l'écran (fuseau UTC : le jour ne glisse jamais). */
export function longBirthDate(iso: string, lang: string): string {
  const m = ISO_DAY.exec(iso.slice(0, 10));
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  } catch {
    return isoToBirthText(iso);
  }
}

/**
 * « Modifier le profil » : ce qu'il faut envoyer à `admin_set_client_identity`,
 * ou null si ni le sexe ni la date n'ont changé (rien à appeler).
 *   · le sexe ne revient jamais à « non renseigné » : sans choix, il est inchangé ;
 *   · la date vidée s'efface (null) ; elle doit être bonne (voir `birthTextIssue`
 *     AVANT d'appeler) — une date invalide est ignorée ici.
 */
export function identityPatch(
  saved: { gender: string | null | undefined; dateOfBirth: string | null | undefined },
  draft: { gender: Gender | null; birthText: string },
  today: Date = new Date(),
): { gender?: Gender; birthDate?: string | null } | null {
  const patch: { gender?: Gender; birthDate?: string | null } = {};
  if (draft.gender !== null && draft.gender !== (isGender(saved.gender) ? saved.gender : null)) {
    patch.gender = draft.gender;
  }
  const before = isoToBirthText(saved.dateOfBirth) ? (saved.dateOfBirth ?? '').slice(0, 10) : null;
  if (draft.birthText.trim() === '') {
    if (before !== null) patch.birthDate = null;
  } else {
    const iso = validBirthIso(draft.birthText, today);
    if (iso && iso !== before) patch.birthDate = iso;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
