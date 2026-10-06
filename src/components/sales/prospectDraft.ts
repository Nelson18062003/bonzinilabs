// ============================================================
// ESPACE COMMERCIAL — le brouillon d'un prospect, sans rendu.
//
// L'assistant « Nouveau prospect » (et la modification d'une section de la
// fiche) travaille sur ce qui est TAPÉ : le numéro tel qu'il s'affiche, la
// date « JJ/MM/AAAA » à moitié saisie, la ville comme elle vient. Ce module
// dit :
//   · les étapes, et ce que chacune exige : prénom, nom, sexe (« Qui
//     est-ce ? »), numéro principal (« Comment le joindre ? »), ville
//     (« Où est installée son activité ? ») — obligatoires au serveur —, et
//     « ses plus gros problèmes », exigés par le formulaire seulement ; « Que
//     pouvons-nous faire pour lui ? » a son propre écran, tout facultatif ;
//   · la mise en forme au fil de la frappe : majuscule initiale, date,
//     email en minuscules, ville relue dans sa graphie (« yaounde » →
//     « Yaoundé ») ;
//   · ce qui part au serveur : tout à la création (useCreateProspect),
//     SEULEMENT ce qui a changé à la modification (useUpdateProspect) ;
//   · le brouillon gardé dans le téléphone (localStorage, dans un
//     try/catch : navigation privée, stockage plein), pour qu'une fermeture
//     accidentelle ne perde rien ; effacé à l'enregistrement. Il est À SON
//     AUTEUR : rangé sous son identifiant, relu seulement par lui, effacé à
//     la déconnexion (`clearSalesDrafts`) — sur un téléphone partagé, un
//     collègue ne voit ni ne s'attribue le prospect d'un autre. De même
//     pour une modification de la fiche en cours ;
//   · l'étape (et la ligne) à rouvrir quand le serveur refuse (doublon,
//     client existant, un AUTRE numéro déjà suivi).
// ============================================================
import { EMPTY_PHONE, fromE164, toE164, type PhoneValue } from '@/components/form/PhoneNumberInput';
import { normalizeText } from '@/lib/clientSearch';
import { CAMEROON_CITIES, birthDateError, emailError, formatBirthInput, isGender, isoToBirthText, type Gender } from '@/lib/people';
import { SALES_DRAFT_PREFIX, type Interest } from '@/lib/sales';
import type { Prospect, ProspectInput, ProspectPatch, ProspectPhone } from '@/hooks/useSales';
import { doualaDay, followUpIso } from './salesHelpers';

/* ── Les étapes ────────────────────────────────────────────────────────── */

export type StepId = 'who' | 'reach' | 'business' | 'needs' | 'help' | 'next' | 'review';

export interface StepMeta {
  id: StepId;
  /** Dans l'adresse de la fiche : « ?modifier=besoins ». */
  slug: string;
  /** Le nom de la section (fiche, récapitulatif). */
  label: string;
}

export const STEPS: StepMeta[] = [
  { id: 'who', slug: 'identite', label: 'Identité' },
  { id: 'reach', slug: 'joindre', label: 'Pour le joindre' },
  { id: 'business', slug: 'activite', label: 'Activité' },
  { id: 'needs', slug: 'besoins', label: 'Ses problèmes' },
  { id: 'help', slug: 'aide', label: 'Comment l’aider' },
  { id: 'next', slug: 'suite', label: 'La suite' },
  { id: 'review', slug: 'recap', label: 'Récapitulatif' },
];

export const stepIndex = (id: StepId): number => STEPS.findIndex((s) => s.id === id);
export const stepMeta = (id: StepId): StepMeta => STEPS[stepIndex(id)];
export const stepBySlug = (slug: string | null | undefined): StepMeta | null => STEPS.find((s) => s.slug === slug) ?? null;

/**
 * Le titre et la phrase d'une étape — au prénom et au genre du prospect dès
 * qu'on les connaît (« Comment joindre Gaëlle ? », « Qu'est-ce qui la bloque
 * aujourd'hui ? »).
 */
export function stepCopy(step: StepId, d: Pick<ProspectDraft, 'firstName' | 'gender'>): { title: string; lead: string } {
  const c = copyOf(step, d);
  return { title: nbsp(c.title), lead: nbsp(c.lead) };
}

/** Typographie française : une espace insécable avant « ? : ! » et à l'intérieur des guillemets (pas de « ? » seul à la ligne). */
export const nbsp = (s: string): string => s.replace(/ ([?:!;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

function copyOf(step: StepId, d: Pick<ProspectDraft, 'firstName' | 'gender'>): { title: string; lead: string } {
  const her = d.gender === 'FEMALE';
  const le = her ? 'la' : 'le';
  const lui = her ? 'elle' : 'lui';
  const il = her ? 'elle' : 'il';
  const sil = her ? 'si elle' : 's’il';
  const first = d.firstName.trim().split(/\s+/)[0] ?? '';
  switch (step) {
    case 'who':
      return { title: 'Qui est-ce ?', lead: 'Son nom comme sur ses papiers, son sexe, et sa date de naissance si vous la connaissez.' };
    case 'reach':
      return {
        title: first ? `Comment joindre ${first} ?` : `Comment ${le} joindre ?`,
        lead: `Son numéro principal d’abord : ${sil} ouvre un compte, c’est par lui qu’${il} sera reconnu${her ? 'e' : ''}.`,
      };
    case 'business':
      return { title: 'Où est installée son activité ?', lead: `La ville où ${il} travaille au Cameroun, et son entreprise ${sil} en a une.` };
    case 'needs':
      return {
        title: first ? `Qu’est-ce qui bloque ${first} aujourd’hui ?` : `Qu’est-ce qui ${le} bloque aujourd’hui ?`,
        lead: 'Ses plus gros problèmes, avec ses mots : c’est le cœur de l’entretien.',
      };
    case 'help':
      return {
        title: `Que pouvons-nous faire pour ${first || lui} ?`,
        lead: `Ce qu’${il} attend de Bonzini, et ce qui l’intéresse chez nous.`,
      };
    case 'next':
      return { title: 'Et maintenant ?', lead: `Quand ${le} relancer, et ce qu’il faut retenir.` };
    case 'review':
      return { title: 'Tout est juste ?', lead: 'Relisez avant d’enregistrer. « Modifier » rouvre une section.' };
  }
}

/** Les identifiants des champs (le focus va au premier en défaut). */
export const FIELD_ID = {
  firstName: 'pr-first',
  lastName: 'pr-last',
  gender: 'pr-gender',
  birth: 'pr-birth',
  phone: 'pr-phone',
  email: 'pr-email',
  city: 'pr-city',
  company: 'pr-company',
  interests: 'pr-interests',
  pain: 'pr-pain',
  help: 'pr-help',
  follow: 'pr-follow',
  notes: 'pr-notes',
} as const;

export const otherPhoneId = (key: string) => `pr-phone-${key}`;

/* ── Le brouillon ──────────────────────────────────────────────────────── */

/** Un numéro de plus, tel qu'il est tapé, avec son libellé facultatif (« WhatsApp »…). */
export interface PhoneRow {
  key: string;
  value: PhoneValue;
  label: string;
}

export interface ProspectDraft {
  firstName: string;
  lastName: string;
  /** '' tant qu'il n'est pas choisi (et pour un prospect saisi avant le 06/10). */
  gender: Gender | '';
  /** « JJ/MM/AAAA », tel que tapé (éventuellement incomplet) ; '' = pas de date. */
  birth: string;
  /** Le numéro principal. */
  phone: PhoneValue;
  /** Les autres numéros, dans l'ordre. */
  others: PhoneRow[];
  email: string;
  company: string;
  city: string;
  interests: Interest[];
  painPoints: string;
  helpNeeded: string;
  /** « AAAA-MM-JJ » à Douala, ou '' (pas de relance). */
  followUp: string;
  notes: string;
}

export const EMPTY_DRAFT: ProspectDraft = {
  firstName: '',
  lastName: '',
  gender: '',
  birth: '',
  phone: EMPTY_PHONE,
  others: [],
  email: '',
  company: '',
  city: '',
  interests: [],
  painPoints: '',
  helpNeeded: '',
  followUp: '',
  notes: '',
};

/** Neuf numéros de plus au plus (dix en tout, comme un client). */
export const MAX_OTHER_PHONES = 9;

let seq = 0;
export const newRowKey = (): string => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

const digitsOf = (v: PhoneValue) => v.national.replace(/\D/g, '');
export const samePhone = (a: PhoneValue, b: PhoneValue) => a.country === b.country && digitsOf(a) === digitsOf(b);
const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));

/** La fiche relue en brouillon (pour la modifier). */
export function draftOf(p: Prospect): ProspectDraft {
  return {
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    gender: isGender(p.gender) ? p.gender : '',
    birth: birthFromIso(p.birth_date),
    phone: fromE164(p.phone_e164),
    others: (p.phones ?? []).map((x, i) => ({ key: `s${i}`, value: fromE164(x.phone_e164), label: x.label ?? '' })),
    email: p.email ?? '',
    company: p.company ?? '',
    city: p.city ?? '',
    interests: [...(p.interests ?? [])],
    painPoints: p.pain_points ?? '',
    helpNeeded: p.help_needed ?? '',
    followUp: p.next_action_at ? doualaDay(p.next_action_at) : '',
    notes: p.notes ?? '',
  };
}

export function isDraftEmpty(d: ProspectDraft): boolean {
  const text = [d.firstName, d.lastName, d.birth, d.email, d.company, d.city, d.painPoints, d.helpNeeded, d.followUp, d.notes];
  return (
    text.every((s) => s.trim() === '') &&
    d.gender === '' &&
    !digitsOf(d.phone) &&
    d.others.every((r) => !digitsOf(r.value) && !r.label.trim()) &&
    d.interests.length === 0
  );
}

/* ── Mise en forme au fil de la frappe ─────────────────────────────────── */

/** La première lettre en majuscule (pendant la frappe) : « paul » → « Paul ». Le reste tel quel. */
export function capitalizeFirst(s: string): string {
  return s.replace(/^(\s*)(\p{Ll})/u, (_m, sp: string, ch: string) => sp + ch.toLocaleUpperCase('fr-FR'));
}

/** Les particules qu'on laisse en minuscules au milieu d'un nom (« Paul de Souza »). */
const PARTICLES = new Set(['de', 'du', 'des', 'da', 'di', 'van', 'von', 'der', 'le', 'la', 'ben', 'bin', 'el', 'al']);

/**
 * À la sortie du champ : la majuscule initiale de chaque mot (« jean-paul
 * etoga » → « Jean-Paul Etoga »). Un mot qui a déjà une majuscule
 * (« McDonald », « ETOGA ») et une particule après le premier mot ne
 * bougent pas. Les espaces en trop disparaissent.
 */
export function capitalizeName(s: string): string {
  const words = s.trim().replace(/\s+/g, ' ').split(' ');
  return words
    .map((w, i) => {
      // Une capitale ailleurs qu'en tête (« McDonald », « ETOGA ») : écrit ainsi exprès.
      const rest = w.slice(1);
      if (rest !== rest.toLocaleLowerCase('fr-FR')) return w;
      if (i > 0 && PARTICLES.has(w)) return w;
      return w.replace(/(^|-)(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR'));
    })
    .join(' ');
}

/** La date de naissance au fil de la frappe : la même saisie que côté client (`@/lib/people`). */
export { formatBirthInput };

/** « JJ/MM/AAAA » complet → « AAAA-MM-JJ » ; '' si vide ; null si commencé mais incomplet. */
export function birthIso(birth: string): string | null {
  const d = birth.replace(/\D/g, '');
  if (!d) return '';
  if (d.length < 8) return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » (vide si absente ou illisible). */
export const birthFromIso = isoToBirthText;

/** Facultative : vide → aucune erreur ; commencée → complète et plausible (16 à 110 ans, comme au serveur). */
export function birthError(birth: string, today: Date = new Date()): string | null {
  const iso = birthIso(birth);
  if (iso === '') return null;
  if (iso === null) return 'Date incomplète : jour, mois et année (JJ/MM/AAAA)';
  return birthDateError(iso, today);
}

/** Une adresse se tape sans espace et en minuscules. */
export const normalizeEmail = (s: string): string => s.replace(/\s+/g, '').toLowerCase();

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.fr', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

/** Les fins d'adresse proposées sous le champ : « paul » → « paul@gmail.com »… ; « paul@ya » → « paul@yahoo.fr »… */
export function emailCompletions(value: string, limit = 3): string[] {
  const v = normalizeEmail(value);
  if (!v || v.startsWith('@')) return [];
  const at = v.indexOf('@');
  if (at === -1) return EMAIL_DOMAINS.slice(0, limit).map((d) => `${v}@${d}`);
  const local = v.slice(0, at);
  const partial = v.slice(at + 1);
  if (partial.includes('.') && EMAIL_DOMAINS.some((d) => d === partial)) return [];
  return EMAIL_DOMAINS.filter((d) => d.startsWith(partial) && d !== partial)
    .slice(0, limit)
    .map((d) => `${local}@${d}`);
}

/** La ville dans sa graphie : une ville connue (« yaounde » → « Yaoundé »), sinon la saisie, majuscules posées. */
export function canonicalCity(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const n = normalizeText(t);
  return CAMEROON_CITIES.find((c) => normalizeText(c) === n) ?? capitalizeName(t);
}

/** Les villes proposées pendant la frappe (accents et majuscules ignorés) : celles qui commencent ainsi, puis celles qui contiennent. */
export function citySuggestions(q: string, limit = 5): string[] {
  const n = normalizeText(q);
  if (!n) return [];
  const all = [...CAMEROON_CITIES] as string[];
  const starts = all.filter((c) => normalizeText(c).startsWith(n));
  const contains = all.filter((c) => !normalizeText(c).startsWith(n) && normalizeText(c).includes(n));
  return [...starts, ...contains].filter((c) => normalizeText(c) !== n).slice(0, limit);
}

/* ── Les idées de problèmes ────────────────────────────────────────────── */

export const hasIdea = (text: string, idea: string): boolean => normalizeText(text).includes(normalizeText(idea));

/** Une idée touchée : une nouvelle ligne « Idée : », que le commercial complète avec les mots du prospect. */
export function addIdea(text: string, idea: string): string {
  const base = text.replace(/\s+$/, '');
  return base ? `${base}\n${idea} : ` : `${idea} : `;
}

/**
 * Une idée touchée une seconde fois : sa ligne s'en va si elle est restée
 * nue (« Manque de capital : »). Complétée par le commercial, elle reste —
 * on n'efface jamais ce qu'il a écrit.
 */
export function removeIdea(text: string, idea: string): string {
  const n = normalizeText(idea);
  return text
    .split('\n')
    .filter((l) => normalizeText(l.replace(/\s*:?\s*$/, '')) !== n)
    .join('\n');
}

/** La fin de la ligne d'une idée (là où le commercial reprend sa phrase), ou null si elle n'y est pas. */
export function ideaLineEnd(text: string, idea: string): number | null {
  const n = normalizeText(idea);
  let pos = 0;
  for (const line of text.split('\n')) {
    if (normalizeText(line).includes(n)) return pos + line.length;
    pos += line.length + 1;
  }
  return null;
}

/** Ce qui part au serveur : lignes nettoyées, sans « : » laissé en suspens (une idée touchée sans détail). */
export function cleanFreeText(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+$/, '').replace(/\s*:$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── Ce que chaque étape exige ─────────────────────────────────────────── */

/** Identifiant du champ → message, dans l'ordre de l'écran. */
export type StepErrors = Record<string, string>;

export interface ValidateOptions {
  /** La fiche avant modification : un numéro principal inchangé ne se revalide pas (il est déjà enregistré). */
  original?: ProspectDraft;
  /** Devenu client : le numéro principal est figé. */
  won?: boolean;
  today?: Date;
}

export const PHONE_INVALID = 'Numéro invalide : vérifiez l’indicatif et les chiffres';

export function stepErrors(d: ProspectDraft, step: StepId, o: ValidateOptions = {}): StepErrors {
  const e: StepErrors = {};
  switch (step) {
    case 'who': {
      if (!d.firstName.trim()) e[FIELD_ID.firstName] = 'Le prénom est requis';
      if (!d.lastName.trim()) e[FIELD_ID.lastName] = 'Le nom est requis';
      if (!isGender(d.gender)) e[FIELD_ID.gender] = 'Choisissez Homme ou Femme';
      const b = birthError(d.birth, o.today);
      if (b) e[FIELD_ID.birth] = b;
      break;
    }
    case 'reach': {
      const mainKept = o.won || (!!o.original && samePhone(d.phone, o.original.phone));
      if (!mainKept) {
        if (!digitsOf(d.phone)) e[FIELD_ID.phone] = 'Le numéro est requis';
        else if (!toE164(d.phone)) e[FIELD_ID.phone] = PHONE_INVALID;
      }
      const seen = new Set<string>();
      const main = toE164(d.phone);
      if (main) seen.add(main);
      for (const r of d.others) {
        if (!digitsOf(r.value)) continue; // une ligne laissée vide est ignorée
        const x = toE164(r.value);
        if (!x) e[otherPhoneId(r.key)] = PHONE_INVALID;
        else if (seen.has(x)) e[otherPhoneId(r.key)] = 'Ce numéro est déjà dans la liste';
        else seen.add(x);
      }
      const em = emailError(d.email);
      if (em) e[FIELD_ID.email] = em;
      break;
    }
    case 'business':
      if (!d.city.trim()) e[FIELD_ID.city] = 'La ville est requise';
      break;
    case 'needs':
      if (cleanFreeText(d.painPoints).length < 3) e[FIELD_ID.pain] = 'Dites en quelques mots ses plus gros problèmes';
      break;
    case 'help':
      break; // tout y est facultatif
    case 'next':
      if (d.followUp && !/^\d{4}-\d{2}-\d{2}$/.test(d.followUp)) e[FIELD_ID.follow] = 'Date de relance invalide';
      break;
    case 'review':
      for (const s of STEPS) if (s.id !== 'review') Object.assign(e, stepErrors(d, s.id, o));
      break;
  }
  return e;
}

/** La première étape (avant le récapitulatif) qui n'est pas en règle, ou null. */
export function firstInvalidStep(d: ProspectDraft, o: ValidateOptions = {}): StepId | null {
  return STEPS.find((s) => s.id !== 'review' && Object.keys(stepErrors(d, s.id, o)).length > 0)?.id ?? null;
}

/* ── Ce qui part au serveur ────────────────────────────────────────────── */

/** Les autres numéros complets, au format international, sans doublon (ni le principal). */
export function otherPhonesOf(d: ProspectDraft): ProspectPhone[] {
  const main = toE164(d.phone);
  const seen = new Set<string>(main ? [main] : []);
  return d.others.flatMap((r) => {
    const x = toE164(r.value);
    if (!x || seen.has(x)) return [];
    seen.add(x);
    return [{ phone_e164: x, country_iso: r.value.country, label: r.label.trim() || null }];
  });
}

const phonesSignature = (list: ProspectPhone[]) => JSON.stringify(list.map((p) => [p.phone_e164, p.label ?? '']));

/** Création : tout (le brouillon a été validé étape par étape). */
export function toCreateInput(d: ProspectDraft): ProspectInput {
  return {
    firstName: capitalizeName(d.firstName),
    lastName: capitalizeName(d.lastName),
    gender: d.gender as Gender,
    birthDate: birthIso(d.birth) || null,
    phone: toE164(d.phone) as string,
    phones: otherPhonesOf(d),
    email: normalizeEmail(d.email),
    company: d.company.trim(),
    city: canonicalCity(d.city),
    interests: d.interests,
    painPoints: cleanFreeText(d.painPoints),
    helpNeeded: cleanFreeText(d.helpNeeded),
    notes: d.notes.trim(),
    nextActionAt: d.followUp ? followUpIso(d.followUp) : null,
  };
}

/**
 * Modification : SEULEMENT ce qui a changé (null si rien). '' efface un champ
 * facultatif ; une date de naissance effacée part à null ; la liste des
 * autres numéros part entière dès qu'elle change. Le numéro principal d'un
 * prospect devenu client ne part jamais.
 */
export function toPatch(d: ProspectDraft, o: ProspectDraft, id: string, { won = false }: { won?: boolean } = {}): ProspectPatch | null {
  const p: ProspectPatch = { id };
  const t = (s: string) => s.trim().replace(/\s+/g, ' ');
  if (t(d.firstName) !== t(o.firstName)) p.firstName = capitalizeName(d.firstName);
  if (t(d.lastName) !== t(o.lastName)) p.lastName = capitalizeName(d.lastName);
  if (d.gender !== o.gender && isGender(d.gender)) p.gender = d.gender;
  const b = birthIso(d.birth);
  if (b !== null && b !== birthIso(o.birth)) p.birthDate = b === '' ? null : b;
  if (!won && !samePhone(d.phone, o.phone)) {
    const x = toE164(d.phone);
    if (x) p.phone = x;
  }
  const phones = otherPhonesOf(d);
  if (phonesSignature(phones) !== phonesSignature(otherPhonesOf(o))) p.phones = phones;
  if (normalizeEmail(d.email) !== normalizeEmail(o.email)) p.email = normalizeEmail(d.email);
  if (t(d.company) !== t(o.company)) p.company = d.company.trim();
  if (canonicalCity(d.city) !== canonicalCity(o.city)) p.city = canonicalCity(d.city);
  if (!sameSet(d.interests, o.interests)) p.interests = d.interests;
  if (cleanFreeText(d.painPoints) !== cleanFreeText(o.painPoints)) p.painPoints = cleanFreeText(d.painPoints);
  if (cleanFreeText(d.helpNeeded) !== cleanFreeText(o.helpNeeded)) p.helpNeeded = cleanFreeText(d.helpNeeded);
  if (d.notes.trim() !== o.notes.trim()) p.notes = d.notes.trim();
  if (d.followUp !== o.followUp) p.nextActionAt = d.followUp ? followUpIso(d.followUp) : null;
  return Object.keys(p).length > 1 ? p : null;
}

/* ── Fiche incomplète (prospect saisi avant le 06/10) ──────────────────── */

export interface MissingField {
  field: 'lastName' | 'gender' | 'city' | 'painPoints';
  /** « le nom », pour « il manque le nom, le sexe et la ville ». */
  label: string;
  step: StepId;
}

/**
 * Ce qui manque à une fiche : le nom, le sexe, la ville (exigés au serveur
 * depuis le 06/10) et « ses plus gros problèmes » — ce que le directeur veut
 * SURTOUT savoir, exigé par le formulaire. Tout le pipeline saisi avant le
 * 06/10 est dans ce cas : le bandeau et la pastille « À compléter » y poussent.
 */
export function missingOf(p: Pick<Prospect, 'last_name' | 'gender' | 'city' | 'pain_points'>): MissingField[] {
  const m: MissingField[] = [];
  if (!p.last_name?.trim()) m.push({ field: 'lastName', label: 'le nom', step: 'who' });
  if (!isGender(p.gender)) m.push({ field: 'gender', label: 'le sexe', step: 'who' });
  if (!p.city?.trim()) m.push({ field: 'city', label: 'la ville', step: 'business' });
  if (cleanFreeText(p.pain_points ?? '').length < 3) m.push({ field: 'painPoints', label: 'ses plus gros problèmes', step: 'needs' });
  return m;
}

/** « le nom, le sexe et la ville ». */
export function joinFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** « Compléter » la fiche : toutes les étapes où il manque quelque chose, dans l'ordre. */
export const COMPLETE = 'complete' as const;

/**
 * Les étapes d'une modification. Une section (« Modifier » sur la fiche) :
 * elle seule — noter une relance ou les besoins après un appel ne doit pas
 * exiger d'abord le sexe et la ville qu'on ne connaît pas encore (le serveur
 * ne les exige qu'à la création). « Compléter » : toutes les étapes où il
 * manque quelque chose, dans l'ordre de l'assistant.
 */
export function editSession(requested: StepId | typeof COMPLETE, p: Pick<Prospect, 'last_name' | 'gender' | 'city' | 'pain_points'>): StepId[] {
  if (requested !== COMPLETE) return [requested];
  const missing = missingOf(p);
  const steps = STEPS.filter((s) => missing.some((m) => m.step === s.id)).map((s) => s.id);
  return steps.length ? steps : ['who'];
}

/* ── Refus du serveur ──────────────────────────────────────────────────── */

const E164_IN_TEXT = /\+\d{6,15}/;

/**
 * L'étape (et le champ) qu'un refus du serveur concerne : on y ramène le
 * commercial, avec le message sous le champ en cause. Un refus qui NOMME un
 * numéro (« Le numéro +86… est déjà suivi par un autre commercial », « Pays
 * inconnu pour le numéro … ») va sous la ligne de ce numéro — pas sous le
 * principal, qui est bon ; « Ce numéro … » parle du principal.
 */
export function stepOfServerError(message: string, d?: ProspectDraft): { step: StepId; field?: string } {
  const m = normalizeText(message);
  if (/e-?mail|adresse/.test(m)) return { step: 'reach', field: FIELD_ID.email };
  if (/numero|telephone|indicatif|libelle|deja dans votre liste/.test(m)) {
    const named = E164_IN_TEXT.exec(message)?.[0];
    if (named && d) {
      if (toE164(d.phone) === named) return { step: 'reach', field: FIELD_ID.phone };
      const row = d.others.find((r) => toE164(r.value) === named);
      if (row) return { step: 'reach', field: otherPhoneId(row.key) };
    }
    if (/libelle/.test(m) && d) {
      const row = d.others.find((r) => r.label.trim().length > 40) ?? d.others[0];
      if (row) return { step: 'reach', field: otherPhoneId(row.key) };
    }
    // « Dix numéros au plus », « Liste de numéros invalide » : l'étape, le message en tête.
    if (/dix numeros|liste de numeros/.test(m)) return { step: 'reach' };
    return { step: 'reach', field: FIELD_ID.phone };
  }
  if (/prenom/.test(m)) return { step: 'who', field: FIELD_ID.firstName };
  if (/\bnom\b/.test(m)) return { step: 'who', field: FIELD_ID.lastName };
  if (/sexe|genre/.test(m)) return { step: 'who', field: FIELD_ID.gender };
  if (/naissance|\bage\b/.test(m)) return { step: 'who', field: FIELD_ID.birth };
  if (/ville/.test(m)) return { step: 'business', field: FIELD_ID.city };
  if (/probleme/.test(m)) return { step: 'needs', field: FIELD_ID.pain };
  if (/relance/.test(m)) return { step: 'next', field: FIELD_ID.follow };
  return { step: 'review' };
}

/* ── Le brouillon gardé dans le téléphone ──────────────────────────────── */

// À SON AUTEUR : l'identifiant du compte est dans la clé ET dans le
// brouillon. Un autre compte sur le même téléphone (l'app BONZINI HQ
// partage le stockage de sa WebView) ne le lit pas, ne le reprend pas, ne
// se l'attribue pas ; tout s'efface à la déconnexion (`clearSalesDrafts`).
const draftKey = (owner: string) => `${SALES_DRAFT_PREFIX}draft:${owner}`;

export interface StoredDraft {
  v: 1;
  owner: string;
  draft: ProspectDraft;
  step: StepId;
  savedAt: string;
}

function isPhoneValue(v: unknown): v is PhoneValue {
  return !!v && typeof (v as PhoneValue).country === 'string' && typeof (v as PhoneValue).national === 'string';
}

/** Un brouillon relu du stockage, champ par champ (un champ illisible reprend sa valeur vide). */
function reviveDraft(raw: unknown): ProspectDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<ProspectDraft>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    firstName: text(d.firstName),
    lastName: text(d.lastName),
    gender: isGender(d.gender) ? d.gender : '',
    birth: text(d.birth),
    phone: isPhoneValue(d.phone) ? d.phone : EMPTY_PHONE,
    others: Array.isArray(d.others)
      ? d.others.filter((r) => r && isPhoneValue(r.value)).map((r) => ({ key: String(r.key ?? newRowKey()), value: r.value, label: String(r.label ?? '') }))
      : [],
    email: text(d.email),
    company: text(d.company),
    city: text(d.city),
    interests: Array.isArray(d.interests) ? d.interests.filter((i): i is Interest => i === 'payments' || i === 'air' || i === 'sea') : [],
    painPoints: text(d.painPoints),
    helpNeeded: text(d.helpNeeded),
    followUp: text(d.followUp),
    notes: text(d.notes),
  };
}

/** Le brouillon que CE compte a laissé là (null s'il n'y en a pas, s'il est illisible, ou sans compte). */
export function loadDraft(owner: string | null | undefined): StoredDraft | null {
  if (!owner) return null;
  try {
    const raw = localStorage.getItem(draftKey(owner));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<StoredDraft>;
    if (s?.v !== 1 || s.owner !== owner) return null;
    const draft = reviveDraft(s.draft);
    if (!draft) return null;
    const step = STEPS.some((x) => x.id === s.step) ? (s.step as StepId) : 'who';
    return { v: 1, owner, draft, step, savedAt: String(s.savedAt ?? '') };
  } catch {
    return null;
  }
}

export function saveDraft(owner: string | null | undefined, draft: ProspectDraft, step: StepId): void {
  if (!owner) return; // sans compte connu, le brouillon vit seulement en mémoire
  try {
    localStorage.setItem(draftKey(owner), JSON.stringify({ v: 1, owner, draft, step, savedAt: new Date().toISOString() } satisfies StoredDraft));
  } catch {
    /* stockage indisponible : le brouillon vit seulement en mémoire */
  }
}

export function clearDraft(owner: string | null | undefined): void {
  if (!owner) return;
  try {
    localStorage.removeItem(draftKey(owner));
  } catch {
    /* rien à effacer */
  }
}

/* ── Une modification de la fiche en cours ─────────────────────────────── */

// La modification d'une section garde aussi ce qui est tapé : un retour du
// téléphone (qui quitte l'écran sans rien demander) ne perd pas un long
// « ses plus gros problèmes » noté après un appel. Gardé : la fiche AU
// MOMENT de la saisie (`base`) et le brouillon ; repris : seulement les
// champs que le commercial avait changés, posés sur la fiche d'aujourd'hui
// (ce qui a changé ailleurs entre-temps n'est pas écrasé).
const editKey = (owner: string, prospectId: string, step: string) => `${SALES_DRAFT_PREFIX}edit:${owner}:${prospectId}:${step}`;

interface StoredEdit {
  v: 1;
  owner: string;
  base: ProspectDraft;
  draft: ProspectDraft;
  savedAt: string;
}

const DRAFT_FIELDS = Object.keys(EMPTY_DRAFT) as (keyof ProspectDraft)[];
const sameField = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** La modification laissée en cours sur cette section, posée sur la fiche actuelle ; null s'il n'y en a pas (ou plus rien de changé). */
export function loadEditDraft(owner: string | null | undefined, prospectId: string, step: string, current: ProspectDraft): ProspectDraft | null {
  if (!owner) return null;
  try {
    const raw = localStorage.getItem(editKey(owner, prospectId, step));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<StoredEdit>;
    if (s?.v !== 1 || s.owner !== owner) return null;
    const base = reviveDraft(s.base);
    const draft = reviveDraft(s.draft);
    if (!base || !draft) return null;
    const changed = DRAFT_FIELDS.filter((k) => !sameField(draft[k], base[k]));
    if (changed.length === 0) return null;
    const merged = { ...current };
    for (const k of changed) (merged as Record<string, unknown>)[k] = draft[k];
    return sameField(merged, current) ? null : merged;
  } catch {
    return null;
  }
}

export function saveEditDraft(owner: string | null | undefined, prospectId: string, step: string, base: ProspectDraft, draft: ProspectDraft): void {
  if (!owner) return;
  try {
    localStorage.setItem(editKey(owner, prospectId, step), JSON.stringify({ v: 1, owner, base, draft, savedAt: new Date().toISOString() } satisfies StoredEdit));
  } catch {
    /* stockage indisponible */
  }
}

export function clearEditDraft(owner: string | null | undefined, prospectId: string, step: string): void {
  if (!owner) return;
  try {
    localStorage.removeItem(editKey(owner, prospectId, step));
  } catch {
    /* rien à effacer */
  }
}
