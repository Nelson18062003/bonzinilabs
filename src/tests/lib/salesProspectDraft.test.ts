/**
 * Le brouillon d'un prospect (src/components/sales/prospectDraft.ts) :
 *   · la mise en forme au fil de la frappe (nom, date, email, ville) ;
 *   · ce que chaque étape exige (nom, sexe, numéro, ville, problèmes) ;
 *   · la charge envoyée à la création, et SEULEMENT ce qui change à la
 *     modification ;
 *   · la fiche incomplète (d'avant le 06/10, ou sans « ses plus gros
 *     problèmes ») et les étapes qui la complètent ;
 *   · l'étape (et la ligne) où ramène un refus du serveur ;
 *   · le brouillon gardé dans le téléphone, À SON AUTEUR (un autre compte ne
 *     le lit pas ; illisible → ignoré ; tout s'efface à la déconnexion) ;
 *   · la modification en cours, reprise sans écraser ce qui a changé ailleurs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Prospect } from '@/hooks/useSales';
import { clearSalesDrafts } from '@/lib/sales';
import {
  COMPLETE,
  EMPTY_DRAFT,
  addIdea,
  birthError,
  birthIso,
  canonicalCity,
  capitalizeFirst,
  capitalizeName,
  citySuggestions,
  cleanFreeText,
  clearDraft,
  clearEditDraft,
  draftOf,
  editSession,
  emailCompletions,
  firstInvalidStep,
  formatBirthInput,
  hasIdea,
  ideaLineEnd,
  isDraftEmpty,
  loadDraft,
  loadEditDraft,
  missingOf,
  otherPhonesOf,
  removeIdea,
  saveDraft,
  saveEditDraft,
  stepCopy,
  stepErrors,
  stepOfServerError,
  toCreateInput,
  toPatch,
  type ProspectDraft,
} from '@/components/sales/prospectDraft';

const TODAY = new Date('2026-10-06T08:00:00Z');

const full: ProspectDraft = {
  ...EMPTY_DRAFT,
  firstName: 'Paul',
  lastName: 'Etoga',
  gender: 'MALE',
  birth: '12/03/1985',
  phone: { country: 'CM', national: '6 99 12 34 56' },
  others: [
    { key: 'a', value: { country: 'CN', national: '138 1234 5678' }, label: 'WeChat' },
    { key: 'b', value: { country: 'CM', national: '' }, label: '' },
  ],
  email: 'paul.etoga@gmail.com',
  company: 'Etoga Quincaillerie',
  city: 'douala',
  interests: ['payments', 'sea'],
  painPoints: 'Payer ses fournisseurs en Chine : deux semaines par règlement\nLa douane et sa procédure : ',
  helpNeeded: 'Régler ses fournisseurs de Yiwu',
  followUp: '2026-10-09',
  notes: '  Quincaillerie à Akwa  ',
};

const prospect = (o: Partial<Prospect> = {}): Prospect => ({
  id: 'p-1', source_id: 's', first_name: 'Paul', last_name: 'Etoga', company: 'Etoga Quincaillerie', phone: '+237699123456',
  phone_e164: '+237699123456', city: 'Douala', gender: 'MALE', birth_date: '1985-03-12', email: 'paul.etoga@gmail.com',
  pain_points: 'Payer ses fournisseurs en Chine', help_needed: null,
  phones: [{ phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat', position: 0 }],
  interests: ['payments'], notes: null, status: 'new', lost_reason: null, next_action_at: '2026-10-09T08:00:00Z',
  converted_user_id: null, converted_at: null, status_changed_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  ...o,
});

describe('mise en forme au fil de la frappe', () => {
  it('prénom et nom : majuscule initiale pendant la frappe, chaque mot à la sortie, particules et capitales respectées', () => {
    expect(capitalizeFirst('paul')).toBe('Paul');
    expect(capitalizeFirst('élise')).toBe('Élise');
    expect(capitalizeName('  jean-paul   etoga ')).toBe('Jean-Paul Etoga');
    expect(capitalizeName('paul de souza')).toBe('Paul de Souza');
    expect(capitalizeName('ETOGA McDonald')).toBe('ETOGA McDonald');
    expect(capitalizeName('Jean-paul')).toBe('Jean-Paul');
  });

  it('date de naissance : chiffres seulement, barres posées, jour et mois complétés d’un zéro', () => {
    expect(formatBirthInput('12031985')).toBe('12/03/1985');
    expect(formatBirthInput('12')).toBe('12');
    expect(formatBirthInput('121')).toBe('12/1');
    expect(formatBirthInput('123')).toBe('12/03');
    expect(formatBirthInput('12/')).toBe('12');
    expect(formatBirthInput('4')).toBe('04');
    expect(formatBirthInput('045')).toBe('04/05');
    expect(formatBirthInput('ab12-03-1985xyz99')).toBe('12/03/1985');
    // Collée au format de la base : retournée (la même saisie que côté client).
    expect(formatBirthInput('1988-02-14')).toBe('14/02/1988');
    expect(birthIso('12/03/1985')).toBe('1985-03-12');
    expect(birthIso('')).toBe('');
    expect(birthIso('12/03')).toBeNull();
  });

  it('date de naissance : facultative, mais complète et plausible si commencée', () => {
    expect(birthError('', TODAY)).toBeNull();
    expect(birthError('12/03/1985', TODAY)).toBeNull();
    expect(birthError('12/03', TODAY)).toMatch(/incomplète/);
    expect(birthError('31/02/1990', TODAY)).toBe('Date de naissance invalide');
    expect(birthError('01/01/2015', TODAY)).toMatch(/entre 16 et 110 ans/);
  });

  it('email : fins d’adresse proposées tant qu’elle n’est pas complète', () => {
    expect(emailCompletions('paul')).toEqual(['paul@gmail.com', 'paul@yahoo.fr', 'paul@yahoo.com']);
    expect(emailCompletions('paul@ya')).toEqual(['paul@yahoo.fr', 'paul@yahoo.com']);
    expect(emailCompletions('paul@gmail.com')).toEqual([]);
    expect(emailCompletions('')).toEqual([]);
  });

  it('ville : relue dans sa graphie, suggestions sans accents ni majuscules', () => {
    expect(canonicalCity('yaounde')).toBe('Yaoundé');
    expect(canonicalCity('  DOUALA ')).toBe('Douala');
    expect(canonicalCity('nkolbisson')).toBe('Nkolbisson');
    expect(citySuggestions('ba').slice(0, 3)).toEqual(['Bafoussam', 'Bamenda', 'Bafang']);
    expect(citySuggestions('ebol')).toEqual(['Ebolowa']);
    expect(citySuggestions('Douala')).toEqual([]);
  });

  it('idées de problèmes : une ligne « Idée : » à compléter ; retirée seulement si elle est restée nue', () => {
    const t = addIdea('', 'Manque de capital');
    expect(t).toBe('Manque de capital : ');
    expect(hasIdea(t, 'manque de capital')).toBe(true);
    const t2 = addIdea(t + 'trois mois de stock', 'Transport bateau');
    expect(t2).toBe('Manque de capital : trois mois de stock\nTransport bateau : ');
    expect(removeIdea(t2, 'Transport bateau')).toBe('Manque de capital : trois mois de stock');
    expect(removeIdea(t2, 'Manque de capital')).toBe(t2);
    // Complétée : retouchée, le curseur va au bout de SA ligne.
    expect(ideaLineEnd(t2, 'Manque de capital')).toBe('Manque de capital : trois mois de stock'.length);
    expect(ideaLineEnd(t2, 'Fixer ses prix de vente')).toBeNull();
    expect(cleanFreeText('A : \nB : détail\n\n\n\nC')).toBe('A\nB : détail\n\nC');
  });

  it('les titres suivent le prénom et le genre', () => {
    expect(stepCopy('reach', { firstName: 'Gaëlle Marie', gender: 'FEMALE' }).title).toBe('Comment joindre Gaëlle\u00a0?');
    expect(stepCopy('reach', { firstName: '', gender: 'FEMALE' }).title).toBe('Comment la joindre\u00a0?');
    expect(stepCopy('needs', { firstName: '', gender: 'MALE' }).title).toBe('Qu’est-ce qui le bloque aujourd’hui\u00a0?');
    expect(stepCopy('business', { firstName: '', gender: 'FEMALE' }).lead).toContain('si elle en a une');
    expect(stepCopy('help', { firstName: 'Paul', gender: 'MALE' }).title).toBe('Que pouvons-nous faire pour Paul\u00a0?');
    expect(stepCopy('help', { firstName: '', gender: 'FEMALE' }).title).toBe('Que pouvons-nous faire pour elle\u00a0?');
  });
});

describe('ce que chaque étape exige', () => {
  it('« Qui est-ce ? » : prénom, nom et sexe ; la date seulement si elle est commencée', () => {
    expect(Object.values(stepErrors(EMPTY_DRAFT, 'who'))).toEqual(['Le prénom est requis', 'Le nom est requis', 'Choisissez Homme ou Femme']);
    expect(stepErrors({ ...full, birth: '12/03' }, 'who', { today: TODAY })).toEqual({ 'pr-birth': expect.stringMatching(/incomplète/) });
    expect(stepErrors(full, 'who', { today: TODAY })).toEqual({});
  });

  it('« Comment le joindre ? » : le principal valide pour son pays, les autres complets et sans doublon, l’email bien formé', () => {
    expect(stepErrors(EMPTY_DRAFT, 'reach')).toEqual({ 'pr-phone': 'Le numéro est requis' });
    expect(stepErrors({ ...full, phone: { country: 'CM', national: '138 1234 5678' } }, 'reach')['pr-phone']).toMatch(/indicatif/);
    const dup: ProspectDraft = { ...full, others: [{ key: 'x', value: { country: 'CM', national: '699123456' }, label: '' }] };
    expect(stepErrors(dup, 'reach')).toEqual({ 'pr-phone-x': 'Ce numéro est déjà dans la liste' });
    const bad: ProspectDraft = { ...full, others: [{ key: 'y', value: { country: 'CN', national: '138' }, label: '' }] };
    expect(stepErrors(bad, 'reach')['pr-phone-y']).toMatch(/indicatif/);
    expect(stepErrors({ ...full, email: 'paul@' }, 'reach')).toEqual({ 'pr-email': 'Adresse email invalide' });
    expect(stepErrors(full, 'reach')).toEqual({});
  });

  it('un numéro principal inchangé (fiche) ou figé (devenu client) ne se revalide pas', () => {
    const old: ProspectDraft = { ...full, phone: { country: 'CM', national: '12' } };
    expect(stepErrors(old, 'reach', { original: old })).toEqual({});
    expect(stepErrors(old, 'reach', { won: true })).toEqual({});
  });

  it('la ville, puis « ses plus gros problèmes » (une idée nue ne suffit pas)', () => {
    expect(stepErrors({ ...full, city: ' ' }, 'business')).toEqual({ 'pr-city': 'La ville est requise' });
    expect(stepErrors({ ...full, painPoints: 'La douane : ' }, 'needs')).toEqual({});
    expect(stepErrors({ ...full, painPoints: ' : ' }, 'needs')['pr-pain']).toMatch(/plus gros problèmes/);
    expect(firstInvalidStep({ ...full, city: '' }, { today: TODAY })).toBe('business');
    expect(firstInvalidStep(full, { today: TODAY })).toBeNull();
  });

  it('« Que pouvons-nous faire pour lui ? » : tout y est facultatif', () => {
    expect(stepErrors(EMPTY_DRAFT, 'help')).toEqual({});
  });
});

describe('ce qui part au serveur', () => {
  it('création : tout, au format international, nettoyé', () => {
    expect(toCreateInput(full)).toEqual({
      firstName: 'Paul',
      lastName: 'Etoga',
      gender: 'MALE',
      birthDate: '1985-03-12',
      phone: '+237699123456',
      phones: [{ phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat' }],
      email: 'paul.etoga@gmail.com',
      company: 'Etoga Quincaillerie',
      city: 'Douala',
      interests: ['payments', 'sea'],
      painPoints: 'Payer ses fournisseurs en Chine : deux semaines par règlement\nLa douane et sa procédure',
      helpNeeded: 'Régler ses fournisseurs de Yiwu',
      notes: 'Quincaillerie à Akwa',
      nextActionAt: '2026-10-09T09:00:00+01:00',
    });
  });

  it('les autres numéros : sans ligne vide, sans doublon, jamais le principal', () => {
    const d: ProspectDraft = {
      ...full,
      others: [
        { key: '1', value: { country: 'CM', national: '6 99 12 34 56' }, label: 'Doublon du principal' },
        { key: '2', value: { country: 'CM', national: '677 55 12 09' }, label: ' WhatsApp ' },
        { key: '3', value: { country: 'CM', national: '677551209' }, label: 'Encore' },
      ],
    };
    expect(otherPhonesOf(d)).toEqual([{ phone_e164: '+237677551209', country_iso: 'CM', label: 'WhatsApp' }]);
  });

  it('modification : rien de changé → rien à envoyer', () => {
    const o = draftOf(prospect());
    expect(toPatch(o, o, 'p-1')).toBeNull();
  });

  it('modification : SEULEMENT ce qui a changé ; une date effacée part à null, un email effacé à ""', () => {
    const o = draftOf(prospect());
    const d: ProspectDraft = { ...o, helpNeeded: 'Un devis bateau', birth: '', email: '' };
    expect(toPatch(d, o, 'p-1')).toEqual({ id: 'p-1', helpNeeded: 'Un devis bateau', birthDate: null, email: '' });
  });

  it('modification : la liste des autres numéros part entière dès qu’elle change ; un principal changé part en E.164', () => {
    const o = draftOf(prospect());
    const d: ProspectDraft = {
      ...o,
      phone: { country: 'CM', national: '677 12 34 56' },
      others: [...o.others, { key: 'n', value: { country: 'CM', national: '655001122' }, label: 'Boutique' }],
    };
    expect(toPatch(d, o, 'p-1')).toEqual({
      id: 'p-1',
      phone: '+237677123456',
      phones: [
        { phone_e164: '+8613812345678', country_iso: 'CN', label: 'WeChat' },
        { phone_e164: '+237655001122', country_iso: 'CM', label: 'Boutique' },
      ],
    });
    // Devenu client : le principal ne part jamais.
    expect(toPatch({ ...o, phone: d.phone }, o, 'p-1', { won: true })).toBeNull();
  });
});

describe('fiche incomplète (d’avant le 06/10)', () => {
  it('dit ce qui manque — « ses plus gros problèmes » compris', () => {
    const old = prospect({ last_name: null, gender: null, city: null, pain_points: null });
    expect(missingOf(old).map((m) => m.label)).toEqual(['le nom', 'le sexe', 'la ville', 'ses plus gros problèmes']);
    expect(missingOf(prospect({ pain_points: ' : ' })).map((m) => m.field)).toEqual(['painPoints']);
    expect(missingOf(prospect())).toEqual([]);
  });

  it('« Modifier » une section : elle seule (noter une relance n’exige pas d’abord le sexe et la ville)', () => {
    const old = prospect({ last_name: null, gender: null, city: null, pain_points: null });
    expect(editSession('next', old)).toEqual(['next']);
    expect(editSession('needs', old)).toEqual(['needs']);
  });

  it('« Compléter » : toutes les étapes où il manque quelque chose, dans l’ordre', () => {
    expect(editSession(COMPLETE, prospect({ last_name: null, gender: null, city: null, pain_points: null }))).toEqual(['who', 'business', 'needs']);
    expect(editSession(COMPLETE, prospect({ pain_points: null }))).toEqual(['needs']);
    expect(editSession(COMPLETE, prospect())).toEqual(['who']);
  });
});

describe('refus du serveur → l’étape concernée', () => {
  it.each([
    ['Ce numéro est déjà celui d’un client Bonzini', 'reach', 'pr-phone'],
    ['Ce numéro est déjà suivi par un autre commercial', 'reach', 'pr-phone'],
    ['Ce prospect est déjà dans votre liste', 'reach', 'pr-phone'],
    ['Adresse email invalide', 'reach', 'pr-email'],
    ['Le nom est requis', 'who', 'pr-last'],
    ['Le prénom est requis', 'who', 'pr-first'],
    ['Indiquez le sexe : homme ou femme', 'who', 'pr-gender'],
    ['La ville est requise', 'business', 'pr-city'],
  ])('« %s »', (message, step, field) => {
    expect(stepOfServerError(message)).toEqual({ step, field });
  });

  it('un refus sans champ reste sur le récapitulatif', () => {
    expect(stepOfServerError('Un champ est trop long')).toEqual({ step: 'review' });
  });

  it('un refus qui NOMME un autre numéro va sous la ligne de ce numéro, pas sous le principal', () => {
    expect(stepOfServerError('Le numéro +8613812345678 est déjà suivi par un autre commercial', full)).toEqual({ step: 'reach', field: 'pr-phone-a' });
    expect(stepOfServerError('Pays inconnu pour le numéro +8613812345678', full)).toEqual({ step: 'reach', field: 'pr-phone-a' });
    // Le numéro nommé est le principal : sous le principal.
    expect(stepOfServerError('Le numéro +237699123456 est déjà celui d’un client Bonzini', full)).toEqual({ step: 'reach', field: 'pr-phone' });
    // Un libellé trop long : la ligne qui le porte.
    const long: ProspectDraft = { ...full, others: [full.others[0], { key: 'z', value: { country: 'CM', national: '655001122' }, label: 'x'.repeat(41) }] };
    expect(stepOfServerError('Libellé trop long (40 caractères au plus)', long)).toEqual({ step: 'reach', field: 'pr-phone-z' });
    // Toute la liste : l'étape, le message en tête.
    expect(stepOfServerError('Dix numéros au plus (le principal et neuf autres)', full)).toEqual({ step: 'reach' });
  });
});

describe('le brouillon gardé dans le téléphone', () => {
  beforeEach(() => localStorage.clear());

  it('se garde, se relit et s’efface — sous le compte de son auteur', () => {
    expect(loadDraft('u-jean')).toBeNull();
    saveDraft('u-jean', full, 'business');
    const back = loadDraft('u-jean');
    expect(back?.step).toBe('business');
    expect(back?.draft).toEqual(full);
    clearDraft('u-jean');
    expect(loadDraft('u-jean')).toBeNull();
  });

  it('un autre compte sur le même téléphone ne le voit pas ; sans compte, rien n’est gardé', () => {
    saveDraft('u-jean', full, 'business');
    expect(loadDraft('u-awa')).toBeNull();
    expect(loadDraft(null)).toBeNull();
    // Même recopié sous sa clé, un brouillon d'un autre auteur est ignoré.
    localStorage.setItem('bonzini.v.prospect-draft:u-awa', localStorage.getItem('bonzini.v.prospect-draft:u-jean') as string);
    expect(loadDraft('u-awa')).toBeNull();
    saveDraft(null, full, 'who');
    expect(Object.keys(localStorage).filter((k) => !k.endsWith(':u-jean') && !k.endsWith(':u-awa'))).toEqual([]);
  });

  it('à la déconnexion, tous les brouillons de l’espace commercial s’effacent (et rien d’autre)', () => {
    saveDraft('u-jean', full, 'business');
    saveEditDraft('u-jean', 'p-1', 'besoins', draftOf(prospect()), { ...draftOf(prospect()), helpNeeded: 'x' });
    localStorage.setItem('bonzini-admin-last-email', 'jean@bonzini.com');
    clearSalesDrafts();
    expect(Object.keys(localStorage)).toEqual(['bonzini-admin-last-email']);
  });

  it('un brouillon illisible ou d’une autre forme est ignoré, pas une panne', () => {
    localStorage.setItem('bonzini.v.prospect-draft:u-jean', '{pas du json');
    expect(loadDraft('u-jean')).toBeNull();
    localStorage.setItem(
      'bonzini.v.prospect-draft:u-jean',
      JSON.stringify({ v: 1, owner: 'u-jean', step: 'nulle-part', draft: { firstName: 'Awa', phone: 12, others: 'x', interests: ['x', 'air'] } }),
    );
    const d = loadDraft('u-jean');
    expect(d?.step).toBe('who');
    expect(d?.draft.firstName).toBe('Awa');
    expect(d?.draft.phone).toEqual(EMPTY_DRAFT.phone);
    expect(d?.draft.others).toEqual([]);
    expect(d?.draft.interests).toEqual(['air']);
  });

  it('vide = rien à garder', () => {
    expect(isDraftEmpty(EMPTY_DRAFT)).toBe(true);
    expect(isDraftEmpty({ ...EMPTY_DRAFT, gender: 'FEMALE' })).toBe(false);
  });
});

describe('une modification de la fiche en cours', () => {
  beforeEach(() => localStorage.clear());

  it('reprise : seuls les champs que le commercial avait changés, posés sur la fiche d’aujourd’hui', () => {
    const then = draftOf(prospect());
    saveEditDraft('u-jean', 'p-1', 'besoins', then, { ...then, painPoints: 'Long texte noté après l’appel' });
    // Entre-temps, la ville a changé ailleurs : elle n'est pas écrasée par l'ancienne.
    const now = draftOf(prospect({ city: 'Yaoundé' }));
    const back = loadEditDraft('u-jean', 'p-1', 'besoins', now);
    expect(back).toEqual({ ...now, painPoints: 'Long texte noté après l’appel' });
    // Ni pour un autre compte, ni pour une autre section, ni une fois effacée.
    expect(loadEditDraft('u-awa', 'p-1', 'besoins', now)).toBeNull();
    expect(loadEditDraft('u-jean', 'p-1', 'suite', now)).toBeNull();
    clearEditDraft('u-jean', 'p-1', 'besoins');
    expect(loadEditDraft('u-jean', 'p-1', 'besoins', now)).toBeNull();
  });

  it('rien de différent de la fiche actuelle : rien à reprendre', () => {
    const then = draftOf(prospect());
    saveEditDraft('u-jean', 'p-1', 'besoins', then, { ...then, helpNeeded: 'Un devis' });
    expect(loadEditDraft('u-jean', 'p-1', 'besoins', draftOf(prospect({ help_needed: 'Un devis' })))).toBeNull();
  });
});
