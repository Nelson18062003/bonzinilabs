/**
 * Nouveau client — refonte v2 (maquettes 03/09 et 03/10).
 *
 * L'essentiel d'abord : prénom et nom, Femme / Homme, WhatsApp avec son
 * indicatif, pays, origine. Le reste (email, ville, entreprise, naissance,
 * autres numéros) derrière « + Email, ville, entreprise, naissance ».
 * Après : le mot de passe provisoire en grand, Copier, « Envoyer sur
 * WhatsApp » et « Voir la fiche » ; ce qui n'a pas pu s'enregistrer
 * (numéros, identité, origine) en tags sous le mot de passe.
 *
 * Toute la logique (validation, prospect reconnu, RPC) reste dans
 * `useCreateClientForm`, partagé avec l'ordinateur et la réception.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, MessageCircle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { prefillPhoneFromQuery } from '@/components/clients/prospectPrefill';
import { MAX_PHONES, useCreateClientForm, whatsappShareUrl } from '@/components/clients/useCreateClientForm';
import { ClientSourcePicker } from '@/components/clients/ClientSourcePicker';
import { ProspectEmailSuggestion, ProspectPrefillNote, ProspectSourceNote } from '@/components/clients/ProspectSourceNote';
import { PhoneNumberInput } from '@/components/form/PhoneNumberInput';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { formatBirthInput } from '@/components/clients/clientIdentity';
import type { Gender } from '@/lib/people';
import { BigButton, BoxSegmented, Dock, ScreenTop, Tag, TEXT, FOCUS_RING } from '@/mobile/designKit';
import { BIG_FIELD, BigInput, FieldLabel, SecretCard } from './parts';

export function MobileCreateClient() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useCreateClientForm({ initialPhone: prefillPhoneFromQuery(params.get('phone')) });
  const [more, setMore] = useState(false);

  if (form.created) {
    const c = form.created;
    const message = t('clientForm.whatsappMessage', { name: c.fullName.split(' ')[0], password: c.tempPassword });
    const failed = [
      c.extraPhonesFailed && 'Numéros en plus non enregistrés',
      c.identityFailed && 'Naissance non enregistrée',
      c.sourceFailed && 'Origine non enregistrée',
    ].filter(Boolean) as string[];
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+56px)] dark:bg-[#1E1E1E]">
        <div className="text-center">
          <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]">
            <Check className="h-9 w-9" strokeWidth={2.5} />
          </div>
          <h2 className={cn('mt-5 text-[26px] font-semibold leading-tight', TEXT.strong)}>Client créé</h2>
          <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{c.fullName}</p>
        </div>
        <SecretCard secret={c.tempPassword} />
        {failed.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {failed.map((f) => <Tag key={f} tone="danger">{f}</Tag>)}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <a
            href={whatsappShareUrl(c.primaryE164, message)}
            target="_blank"
            rel="noreferrer"
            className={cn('flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#2C2C2C] text-[18px] font-semibold text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]', FOCUS_RING)}
          >
            <MessageCircle className="h-5 w-5" /> Envoyer sur WhatsApp
          </a>
          <BigButton variant="soft" onClick={() => navigate(`/m/clients/${c.clientId}`, { replace: true })}>Voir la fiche</BigButton>
        </div>
      </div>
    );
  }

  const primary = form.phones[0];
  const extras = form.phones.slice(1);

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title="Nouveau client" backTo="/m/clients" />
      <div className="px-5 pb-4 pt-5">
        <FieldLabel>Nom</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <BigInput aria-label="Prénom" placeholder="Prénom" value={form.fields.firstName} onChange={(e) => form.setField('firstName', e.target.value)} autoComplete="given-name" autoCapitalize="words" />
          <BigInput aria-label="Nom" placeholder="Nom" value={form.fields.lastName} onChange={(e) => form.setField('lastName', e.target.value)} autoComplete="family-name" autoCapitalize="words" />
        </div>
        <BoxSegmented<Gender>
          className="mt-2.5"
          ariaLabel="Sexe"
          options={[{ value: 'FEMALE', label: 'Femme' }, { value: 'MALE', label: 'Homme' }]}
          value={(form.gender ?? '') as Gender}
          onChange={form.setGender}
        />

        <FieldLabel htmlFor="cc-phone-0">WhatsApp</FieldLabel>
        <PhoneNumberInput id="cc-phone-0" value={primary.value} onChange={(value) => form.setPhone(primary.key, { value })} controlClassName={BIG_FIELD} aria-label="WhatsApp" />
        <ProspectPrefillNote prefill={form.prefill} stale={form.prefillStale} />

        <FieldLabel htmlFor="cc-country">Pays</FieldLabel>
        <CountryCombobox id="cc-country" variant="country" value={form.countryIso} onChange={form.chooseCountry} className={cn(BIG_FIELD, 'w-full')} />

        <FieldLabel htmlFor="cc-source">Origine</FieldLabel>
        <ClientSourcePicker id="cc-source" value={form.sourceId} onChange={form.setSourceId} controlClassName={BIG_FIELD} />
        <ProspectSourceNote prospect={form.prospect} sourceId={form.sourceId} />

        {!more ? (
          <button type="button" onClick={() => setMore(true)} className={cn('mt-5 flex h-11 items-center gap-2.5 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
            <Plus className="h-6 w-6" /> Email, ville, entreprise, naissance
          </button>
        ) : (
          <>
            <FieldLabel htmlFor="cc-email">Email</FieldLabel>
            <BigInput id="cc-email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="Facultatif" value={form.fields.email} onChange={(e) => form.setField('email', e.target.value)} />
            {form.errors.email && <p className="mt-1.5 text-[15px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">{t('clientForm.emailInvalid')}</p>}
            <ProspectEmailSuggestion email={form.emailSuggestion} onUse={form.acceptEmailSuggestion} />
            <div className="grid grid-cols-2 gap-2.5">
              <div className="mt-5">
                <FieldLabel htmlFor="cc-city">Ville</FieldLabel>
                <BigInput id="cc-city" placeholder="Douala" value={form.fields.city} onChange={(e) => form.setField('city', e.target.value)} autoCapitalize="words" />
              </div>
              <div className="mt-5">
                <FieldLabel htmlFor="cc-birth">Naissance</FieldLabel>
                <BigInput id="cc-birth" inputMode="numeric" placeholder="JJ/MM/AAAA" maxLength={10} value={form.fields.birthDate} onChange={(e) => form.setField('birthDate', formatBirthInput(e.target.value))} />
                {form.errors.birthDate && form.fields.birthDate.length >= 10 && <p className="mt-1.5 text-[15px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">Date invalide</p>}
              </div>
            </div>
            <FieldLabel htmlFor="cc-company">Entreprise</FieldLabel>
            <BigInput id="cc-company" placeholder="Facultatif" value={form.fields.company} onChange={(e) => form.setField('company', e.target.value)} autoComplete="organization" />

            {extras.map((row, i) => (
              <div key={row.key}>
                <div className="mt-5 flex items-center justify-between">
                  <FieldLabel htmlFor={`cc-phone-${i + 1}`}>Autre numéro</FieldLabel>
                  <button type="button" onClick={() => form.removePhone(row.key)} aria-label="Retirer ce numéro" className={cn('-my-2 flex h-11 w-11 items-center justify-center', TEXT.muted)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <PhoneNumberInput id={`cc-phone-${i + 1}`} value={row.value} onChange={(value) => form.setPhone(row.key, { value })} controlClassName={BIG_FIELD} />
                <BigInput className="mt-2" placeholder="Libellé (boutique, Chine…)" value={row.label} onChange={(e) => form.setPhone(row.key, { label: e.target.value })} aria-label="Libellé du numéro" />
              </div>
            ))}
            {form.phones.length < MAX_PHONES && (
              <button type="button" onClick={form.addPhone} className={cn('mt-4 flex h-11 items-center gap-2.5 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
                <Plus className="h-6 w-6" /> Un autre numéro
              </button>
            )}
          </>
        )}
      </div>
      <Dock>
        <BigButton onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting}>Créer le client</BigButton>
      </Dock>
    </div>
  );
}
