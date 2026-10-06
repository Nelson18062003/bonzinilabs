/**
 * Formulaire « Nouveau client » — la logique, partagée par le rendu mobile
 * et le rendu desktop. Un seul endroit décide de ce qui est valide, de ce
 * qui est envoyé et de ce qui se passe après.
 *
 * Quatre sections :
 *   · Identité      : prénom*, nom*, sexe* (facultatif à la réception, qui
 *                     ne voit souvent que l'étiquette du colis), date de
 *                     naissance, entreprise
 *   · Contact       : WhatsApp* (+ autres numéros), e-mail
 *   · Localisation  : pays*, ville
 *   · Origine       : source FACULTATIVE (commercial, recommandation, réseau
 *                     social…, ou « Je ne sais pas » ; vide = « Non
 *                     renseignée ») — posée APRÈS la création par
 *                     `set_client_source`, seul chemin autorisé en base.
 *                     À la RÉCEPTION de Guangzhou, elle ne se choisit pas :
 *                     « Colis reçu · Entrepôt / Bureau de Guangzhou », selon
 *                     le lieu, par `reception_set_client_origin`.
 *
 * « Enregistré par » (qui a créé la fiche, son rôle, son site) se pose en
 * base, à la création, depuis la session : rien à faire ici.
 *
 * Numéros : le PREMIER est le principal — celui qui reçoit le mot de passe
 * et que `clients.phone` stocke. Les suivants vont dans `client_phones` par
 * `admin_set_client_phones`, APRÈS la création (le client doit exister).
 * Tout numéro commencé doit être complet : un numéro tronqué en base est
 * pire qu'un numéro absent.
 *
 * Sexe et date de naissance : le sexe part avec la création
 * (`admin_create_client`, 'OTHER' = non renseigné, réception seulement) ;
 * la date, facultative, se pose APRÈS par `admin_set_client_identity` (le
 * client doit exister). Un échec ne défait pas le client : `identityFailed`.
 *
 * Prospect : si le numéro principal est celui d'un prospect ouvert d'un
 * commercial (`prospect_lookup_phone`, 400 ms après la frappe), l'origine se
 * pré-remplit avec sa fiche — sauf si l'opérateur a déjà choisi lui-même :
 * un choix manuel n'est jamais écrasé (`prospect` le signale seulement).
 * Sa fiche remplit aussi les champs encore vides (nom, entreprise, ville,
 * sexe, date de naissance, autres numéros — `prospectPrefill.ts`), une
 * seule fois par prospect trouvé : un champ vidé ensuite le reste.
 * `prefill` dit ce qui a été repris, pour la note ; `prefillStale`, que le
 * numéro principal n'est plus le sien (les valeurs reprises restent : la
 * note devient un avertissement, à vérifier). Son EMAIL n'est que proposé
 * (`emailSuggestion`, `acceptEmailSuggestion`) : il deviendrait l'adresse de
 * connexion du client, déjà confirmée — l'opérateur la prend d'un geste,
 * après confirmation par le client.
 *
 * Pays : suit le pays de l'indicatif du numéro principal tant que
 * l'opérateur ne l'a pas choisi lui-même — un importateur camerounais a
 * presque toujours un numéro camerounais, autant ne pas le faire cliquer
 * deux fois. La base reçoit le libellé FRANÇAIS (`countryLabelFr`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreateClient } from '@/hooks/useClientManagement';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProspectLookup } from '@/hooks/useSales';
import { useSetClientPhones, type ClientPhoneInput } from '@/hooks/useClientPhones';
import { useSetClientSource, useSetReceptionOrigin } from '@/hooks/useClientSources';
import type { ReceptionLocation } from '@/lib/reception';
import { countryLabelFr, type CountryIso } from '@/data/countries';
import type { Gender } from '@/lib/people';
import { useSetClientIdentity } from '@/hooks/useClientManagement';
import { birthTextIssue, validBirthIso, type BirthIssue } from './clientIdentity';
import { mergeProspectPhones, planProspectPrefill, type ProspectPrefill } from './prospectPrefill';
import {
  EMPTY_PHONE,
  isPhoneComplete,
  toE164,
  type PhoneValue,
} from '@/components/form/PhoneNumberInput';

export const MAX_PHONES = 10;

export interface PhoneRow {
  /** Clé de rendu stable : l'index ne l'est pas quand on supprime au milieu. */
  key: string;
  value: PhoneValue;
  label: string;
}

const rowKey = () => Math.random().toString(36).slice(2);
const newPhoneRow = (country: CountryIso = EMPTY_PHONE.country): PhoneRow => ({
  key: rowKey(),
  value: { country, national: '' },
  label: '',
});

export interface CreateClientFields {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  city: string;
  /** La date de naissance telle qu'elle est tapée, « JJ/MM/AAAA » (facultative). */
  birthDate: string;
}

export interface CreatedClient {
  clientId: string;
  tempPassword: string;
  fullName: string;
  primaryE164: string;
  /** Les numéros secondaires n'ont pas pu être enregistrés (le client, lui, existe). */
  extraPhonesFailed: boolean;
  /** L'origine n'a pas pu être enregistrée (le client existe ; elle se pose depuis sa fiche). */
  sourceFailed: boolean;
  /** La date de naissance n'a pas pu être enregistrée (le client existe ; elle se pose depuis sa fiche). */
  identityFailed: boolean;
  /** Réception : l'origine posée d'office (ou celle du prospect, gardée), sinon null. */
  originLabel: string | null;
}

/**
 * `reception` : le formulaire de la réception de Guangzhou — l'origine ne se
 * choisit pas, elle suit le lieu de réception (null : lieu pas encore choisi,
 * l'origine reste « Non renseignée »).
 */
export interface CreateClientFormOptions {
  reception?: { location: ReceptionLocation | null };
}

/** « Bureau de Guangzhou (avion) » / « Entrepôt de Guangzhou (bateau) » — les libellés des origines système. */
export function receptionOriginPlace(location: ReceptionLocation | null | undefined): string | null {
  if (location === 'office') return 'Bureau de Guangzhou (avion)';
  if (location === 'warehouse') return 'Entrepôt de Guangzhou (bateau)';
  return null;
}

/** Le numéro principal est celui d'un prospect ouvert : de quel commercial. */
export interface ProspectSourceMatch {
  sourceId: string;
  sourceLabel: string;
  prospectName: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateClientErrorKey = 'firstName' | 'lastName' | 'gender' | 'birthDate' | 'primaryPhone' | 'extraPhones' | 'email' | 'source';

export function useCreateClientForm(options: CreateClientFormOptions = {}) {
  const createClient = useCreateClient();
  const setPhones = useSetClientPhones();
  const setSource = useSetClientSource();
  const setReceptionOrigin = useSetReceptionOrigin();
  const setIdentity = useSetClientIdentity();
  const reception = options.reception ?? null;
  const receptionLocation = reception?.location ?? null;

  const [fields, setFields] = useState<CreateClientFields>({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    city: '',
    birthDate: '',
  });
  // Le sexe : aucun choix au départ (obligatoire au bureau, facultatif à la réception).
  const [gender, setGender] = useState<Gender | null>(null);
  const [phones, setPhonesState] = useState<PhoneRow[]>(() => [newPhoneRow()]);
  const [countryIso, setCountryIso] = useState<CountryIso>(EMPTY_PHONE.country);
  const [countryTouched, setCountryTouched] = useState(false);
  const [created, setCreated] = useState<CreatedClient | null>(null);
  // Origine du client (commercial, recommandation, réseau social…) :
  // FACULTATIVE — vide, elle reste « Non renseignée » (décision du 06/10).
  const [sourceId, setSourceIdState] = useState<string | null>(null);
  // Choisie à la main ? Alors le pré-remplissage par un prospect ne la touche plus.
  const [sourceTouched, setSourceTouched] = useState(false);
  const setSourceId = useCallback((id: string) => {
    setSourceTouched(true);
    setSourceIdState(id);
  }, []);

  const setField = useCallback(<K extends keyof CreateClientFields>(key: K, value: CreateClientFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setPhone = useCallback(
    (key: string, patch: Partial<PhoneRow>) => {
      setPhonesState((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
      // Le pays suit l'indicatif du numéro principal, tant qu'il n'a pas été choisi à la main.
      if (patch.value && !countryTouched && phones[0]?.key === key) {
        setCountryIso(patch.value.country);
      }
    },
    [countryTouched, phones],
  );

  const addPhone = useCallback(() => {
    setPhonesState((prev) => (prev.length >= MAX_PHONES ? prev : [...prev, newPhoneRow(prev[0]?.value.country)]));
  }, []);

  const removePhone = useCallback((key: string) => {
    setPhonesState((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)));
  }, []);

  const chooseCountry = useCallback((iso: CountryIso) => {
    setCountryTouched(true);
    setCountryIso(iso);
  }, []);

  // ── Prospect d'un commercial ? ────────────────────────────────────────
  // Le numéro principal, complet, 400 ms après la dernière frappe.
  const primaryE164 = toE164(phones[0].value);
  const lookupE164 = useDebouncedValue(primaryE164, 400);
  const lookup = useProspectLookup(lookupE164);
  // La réponse vaut pour le numéro affiché, et elle est arrivée (ou il n'y a rien à chercher).
  const lookupSettled = lookupE164 === primaryE164 && (!lookupE164 || lookup.isSuccess || lookup.isError);
  const hit = lookupSettled && lookup.data?.found && lookup.data.source_active && lookup.data.source_id ? lookup.data : null;
  const prospect = useMemo<ProspectSourceMatch | null>(
    () => (hit?.source_id ? { sourceId: hit.source_id, sourceLabel: hit.source_label ?? '', prospectName: hit.prospect_name ?? '' } : null),
    [hit?.source_id, hit?.source_label, hit?.prospect_name],
  );
  // La source posée d'office, pour la retirer si le numéro change ensuite.
  const autoSourceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lookupSettled || sourceTouched) return;
    if (prospect) {
      autoSourceRef.current = prospect.sourceId;
      setSourceIdState(prospect.sourceId);
    } else if (autoSourceRef.current) {
      const auto = autoSourceRef.current;
      autoSourceRef.current = null;
      setSourceIdState((cur) => (cur === auto ? null : cur));
    }
  }, [lookupSettled, sourceTouched, prospect]);

  // ── Reprise de la fiche prospect ──────────────────────────────────────
  // Les champs encore vides, une seule fois par prospect trouvé : si
  // l'opérateur vide ensuite un champ, il le reste. Le formulaire du moment
  // est lu dans une référence (l'effet ne doit pas repartir à chaque frappe).
  const [prefill, setPrefill] = useState<ProspectPrefill | null>(null);
  const prefilledRef = useRef<Set<string>>(new Set());
  const latest = useRef({ fields, gender, phones });
  // Déclaré AVANT l'effet de reprise : il s'exécute avant lui, au même rendu.
  useEffect(() => {
    latest.current = { fields, gender, phones };
  });
  const match = lookupSettled && lookup.data?.found ? lookup.data : null;
  useEffect(() => {
    if (!match?.prospect_id || prefilledRef.current.has(match.prospect_id)) return;
    prefilledRef.current.add(match.prospect_id);
    const now = latest.current;
    const plan = planProspectPrefill(match, now);
    const merged = mergeProspectPhones(now.phones, match, MAX_PHONES, rowKey);
    const filled = merged.added > 0 ? [...plan.filled, 'phones' as const] : plan.filled;
    if (filled.length === 0 && !plan.suggestedEmail) return; // base pas encore migrée, ou tout était déjà saisi
    if (Object.keys(plan.fields).length > 0) {
      // Revérifié sur l'état le plus frais : un champ tapé entre-temps n'est pas écrasé.
      setFields((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(plan.fields) as [keyof CreateClientFields, string][]) {
          if (prev[k].trim() === '') next[k] = v;
        }
        return next;
      });
    }
    if (plan.gender) setGender((cur) => cur ?? plan.gender);
    if (merged.added > 0) setPhonesState((prev) => mergeProspectPhones(prev, match, MAX_PHONES, rowKey).rows);
    setPrefill({
      prospectId: match.prospect_id,
      sourceLabel: match.source_label ?? '',
      prospectName: match.prospect_name ?? '',
      filled,
      suggestedEmail: plan.suggestedEmail,
    });
  }, [match]);

  // Le numéro principal (complet, réponse arrivée) n'est plus celui du
  // prospect repris : les valeurs restent, la note devient un avertissement.
  const prefillStale = !!prefill && lookupSettled && !!lookupE164 && match?.prospect_id !== prefill.prospectId;
  // L'email de sa fiche : proposé tant que le champ est vide et que le numéro est toujours le sien.
  const emailSuggestion = prefill?.suggestedEmail && !prefillStale && fields.email.trim() === '' ? prefill.suggestedEmail : null;
  const acceptEmailSuggestion = useCallback(() => {
    if (emailSuggestion) setFields((prev) => (prev.email.trim() === '' ? { ...prev, email: emailSuggestion } : prev));
  }, [emailSuggestion]);

  // ── Validation ────────────────────────────────────────────────────────
  const primary = phones[0];
  const extras = phones.slice(1);
  const filledExtras = extras.filter((row) => row.value.national.replace(/\D/g, '').length > 0);
  const emailTrim = fields.email.trim();
  const emailValid = emailTrim === '' || EMAIL_SHAPE.test(emailTrim);
  // La date de naissance : facultative, mais juste si elle est donnée.
  const birthIssue: BirthIssue | null = birthTextIssue(fields.birthDate);
  // Le sexe : obligatoire au bureau ; la réception ne voit souvent que l'étiquette du colis.
  const genderRequired = !reception;

  const errors = useMemo(() => {
    const e: Partial<Record<CreateClientErrorKey, true>> = {};
    if (fields.firstName.trim() === '') e.firstName = true;
    if (fields.lastName.trim() === '') e.lastName = true;
    if (genderRequired && gender === null) e.gender = true;
    if (birthIssue !== null) e.birthDate = true;
    if (!isPhoneComplete(primary.value)) e.primaryPhone = true;
    if (!filledExtras.every((row) => isPhoneComplete(row.value))) e.extraPhones = true;
    if (!emailValid) e.email = true;
    return e;
  }, [fields.firstName, fields.lastName, genderRequired, gender, birthIssue, primary.value, filledExtras, emailValid]);

  const canSubmit = Object.keys(errors).length === 0 && !createClient.isPending;
  const isSubmitting = createClient.isPending || setPhones.isPending || setIdentity.isPending || setSource.isPending || setReceptionOrigin.isPending;

  // ── Envoi ─────────────────────────────────────────────────────────────
  const submit = useCallback(async (): Promise<CreatedClient | null> => {
    if (!canSubmit) return null;
    const primaryE164 = toE164(primary.value);
    if (!primaryE164) return null;

    const fullName = `${fields.firstName.trim()} ${fields.lastName.trim()}`;

    let result;
    try {
      result = await createClient.mutateAsync({
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        company: fields.company.trim() || undefined,
        whatsappNumber: primaryE164,
        email: emailTrim || undefined,
        country: countryLabelFr(countryIso),
        city: fields.city.trim() || undefined,
        // 'OTHER' = non renseigné (réception seulement : au bureau, il est obligatoire).
        gender: gender ?? 'OTHER',
      });
    } catch {
      return null; // la mutation a déjà affiché l'erreur
    }

    let extraPhonesFailed = false;
    const extraInputs: ClientPhoneInput[] = filledExtras.flatMap((row) => {
      const e164 = toE164(row.value);
      return e164 ? [{ phone_e164: e164, country_iso: row.value.country, label: row.label.trim() || null }] : [];
    });

    if (result.clientId && extraInputs.length > 0) {
      try {
        await setPhones.mutateAsync({
          userId: result.clientId, // `clientId` EST le user_id — voir admin_create_client
          phones: [
            { phone_e164: primaryE164, country_iso: primary.value.country, label: primary.label.trim() || null },
            ...extraInputs,
          ],
        });
      } catch {
        extraPhonesFailed = true;
      }
    }

    // La date de naissance : seulement si elle est saisie, après la création
    // (le client doit exister). Un échec ne défait pas le client.
    let identityFailed = false;
    const birthIso = validBirthIso(fields.birthDate);
    if (result.clientId && birthIso) {
      try {
        await setIdentity.mutateAsync({ userId: result.clientId, birthDate: birthIso });
      } catch {
        identityFailed = true;
      }
    }

    // L'origine se pose juste après la création (le client doit exister).
    let sourceFailed = false;
    let originLabel: string | null = null;
    if (result.clientId && reception) {
      // Réception : d'office, selon le lieu. Le prospect d'un commercial, déjà
      // attribué à la création, reste (`kept`).
      if (receptionLocation) {
        try {
          const r = await setReceptionOrigin.mutateAsync({ userId: result.clientId, location: receptionLocation });
          originLabel = r.kind === 'parcel' ? `Colis reçu · ${r.label}` : r.label;
        } catch {
          sourceFailed = true;
        }
      }
    } else if (result.clientId && sourceId) {
      try {
        await setSource.mutateAsync({ userId: result.clientId, sourceId, silent: true });
      } catch {
        sourceFailed = true;
      }
    }

    const done: CreatedClient = {
      clientId: result.clientId ?? '',
      tempPassword: result.tempPassword ?? '',
      fullName,
      primaryE164,
      extraPhonesFailed,
      sourceFailed,
      identityFailed,
      originLabel,
    };
    setCreated(done);
    return done;
  }, [canSubmit, primary, fields, gender, emailTrim, countryIso, filledExtras, createClient, setPhones, setIdentity, sourceId, setSource, reception, receptionLocation, setReceptionOrigin]);

  return {
    fields,
    setField,
    phones,
    setPhone,
    addPhone,
    removePhone,
    countryIso,
    chooseCountry,
    gender,
    setGender,
    /** Bureau : obligatoire ; réception : facultatif. */
    genderRequired,
    errors,
    sourceId,
    setSourceId,
    /** Réception : l'origine ne se choisit pas (elle suit le lieu). */
    originMode: (reception ? 'reception' : 'choose') as 'reception' | 'choose',
    receptionLocation,
    /** Le numéro est celui d'un prospect ouvert (fiche commercial active), sinon null. */
    prospect,
    /** Ce qui a été repris de la fiche du prospect (la note), sinon null. */
    prefill,
    /** Le numéro principal n'est plus celui du prospect repris : la note devient un avertissement. */
    prefillStale,
    /** L'email de la fiche du prospect, proposé sous le champ (jamais posé d'office), sinon null. */
    emailSuggestion,
    acceptEmailSuggestion,
    emailValid,
    canSubmit,
    isSubmitting,
    submit,
    created,
  };
}

/** Lien WhatsApp « clic pour écrire », avec le message d'accueil pré-rempli. */
export function whatsappShareUrl(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
