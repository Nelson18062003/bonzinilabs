/**
 * Formulaire « Nouveau client » — la logique, partagée par le rendu mobile
 * et le rendu desktop. Un seul endroit décide de ce qui est valide, de ce
 * qui est envoyé et de ce qui se passe après.
 *
 * Quatre sections :
 *   · Identité      : prénom*, nom*, entreprise
 *   · Contact       : WhatsApp* (+ autres numéros), e-mail
 *   · Localisation  : pays*, ville
 *   · Origine       : source* (commercial, recommandation, réseau social…,
 *                     ou « Je ne sais pas ») — posée APRÈS la création par
 *                     `set_client_source`, seul chemin autorisé en base.
 *
 * Numéros : le PREMIER est le principal — celui qui reçoit le mot de passe
 * et que `clients.phone` stocke. Les suivants vont dans `client_phones` par
 * `admin_set_client_phones`, APRÈS la création (le client doit exister).
 * Tout numéro commencé doit être complet : un numéro tronqué en base est
 * pire qu'un numéro absent.
 *
 * Pays : suit le pays de l'indicatif du numéro principal tant que
 * l'opérateur ne l'a pas choisi lui-même — un importateur camerounais a
 * presque toujours un numéro camerounais, autant ne pas le faire cliquer
 * deux fois. La base reçoit le libellé FRANÇAIS (`countryLabelFr`).
 */
import { useCallback, useMemo, useState } from 'react';
import { useCreateClient } from '@/hooks/useClientManagement';
import { useSetClientPhones, type ClientPhoneInput } from '@/hooks/useClientPhones';
import { useSetClientSource } from '@/hooks/useClientSources';
import { countryLabelFr, type CountryIso } from '@/data/countries';
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

const newPhoneRow = (country: CountryIso = EMPTY_PHONE.country): PhoneRow => ({
  key: Math.random().toString(36).slice(2),
  value: { country, national: '' },
  label: '',
});

export interface CreateClientFields {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  city: string;
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
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useCreateClientForm() {
  const createClient = useCreateClient();
  const setPhones = useSetClientPhones();
  const setSource = useSetClientSource();

  const [fields, setFields] = useState<CreateClientFields>({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    city: '',
  });
  const [phones, setPhonesState] = useState<PhoneRow[]>(() => [newPhoneRow()]);
  const [countryIso, setCountryIso] = useState<CountryIso>(EMPTY_PHONE.country);
  const [countryTouched, setCountryTouched] = useState(false);
  const [created, setCreated] = useState<CreatedClient | null>(null);
  // Origine du client (commercial, recommandation, réseau social…) :
  // OBLIGATOIRE — « Je ne sais pas » est une réponse acceptée.
  const [sourceId, setSourceId] = useState<string | null>(null);

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

  // ── Validation ────────────────────────────────────────────────────────
  const primary = phones[0];
  const extras = phones.slice(1);
  const filledExtras = extras.filter((row) => row.value.national.replace(/\D/g, '').length > 0);
  const emailTrim = fields.email.trim();
  const emailValid = emailTrim === '' || EMAIL_SHAPE.test(emailTrim);

  const errors = useMemo(() => {
    const e: Partial<Record<'firstName' | 'lastName' | 'primaryPhone' | 'extraPhones' | 'email' | 'source', true>> = {};
    if (fields.firstName.trim() === '') e.firstName = true;
    if (fields.lastName.trim() === '') e.lastName = true;
    if (!isPhoneComplete(primary.value)) e.primaryPhone = true;
    if (!filledExtras.every((row) => isPhoneComplete(row.value))) e.extraPhones = true;
    if (!emailValid) e.email = true;
    if (!sourceId) e.source = true;
    return e;
  }, [fields.firstName, fields.lastName, primary.value, filledExtras, emailValid, sourceId]);

  const canSubmit = Object.keys(errors).length === 0 && !createClient.isPending;
  const isSubmitting = createClient.isPending || setPhones.isPending || setSource.isPending;

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

    // L'origine se pose juste après la création (le client doit exister).
    let sourceFailed = false;
    if (result.clientId && sourceId) {
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
    };
    setCreated(done);
    return done;
  }, [canSubmit, primary, fields, emailTrim, countryIso, filledExtras, createClient, setPhones, sourceId, setSource]);

  return {
    fields,
    setField,
    phones,
    setPhone,
    addPhone,
    removePhone,
    countryIso,
    chooseCountry,
    errors,
    sourceId,
    setSourceId,
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
