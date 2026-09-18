/**
 * Nouveau client — mobile.
 *
 * Une seule page qui défile, trois sections nettes (Identité · Contact ·
 * Localisation), un bouton d'envoi toujours visible. L'ancien assistant en
 * trois étapes cachait le pays derrière deux « Continuer », portait sa
 * propre liste de 42 indicatifs en emoji et acceptait n'importe quelle
 * suite de huit chiffres comme numéro WhatsApp.
 *
 * Ici le numéro est formaté et validé par libphonenumber pour le pays
 * choisi, tous les pays du monde sont proposés avec leur drapeau, plusieurs
 * numéros peuvent être saisis (le premier reçoit le mot de passe), et le
 * pays suit l'indicatif tant qu'on ne le choisit pas soi-même.
 *
 * La logique vit dans `useCreateClientForm` — même code que le desktop.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Plus, X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, Row, FormField, TextInput, PrimaryPill, SoftPill, Button } from '@/mobile/designKit';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PhoneNumberInput, formatE164ForDisplay, toE164 } from '@/components/form/PhoneNumberInput';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { CountryFlag } from '@/components/form/CountryFlag';
import { countryName, toCountryLang } from '@/data/countries';
import { useCreateClientForm, whatsappShareUrl, MAX_PHONES } from '@/components/clients/useCreateClientForm';

export function MobileCreateClient() {
  const { t, i18n } = useTranslation('common');
  const lang = toCountryLang(i18n.language);
  const navigate = useNavigate();
  const form = useCreateClientForm();
  const [passwordCopied, setPasswordCopied] = useState(false);

  const optional = <span className={cn('ml-1 font-normal', TEXT.muted)}>{t('clientForm.optional')}</span>;
  const required = <span className="ml-0.5 text-[#C00F0C] dark:text-[#FCB3AD]">*</span>;

  // ── Succès ────────────────────────────────────────────────────────────
  if (form.created) {
    const c = form.created;
    const waMessage = t('clientForm.whatsappMessage', {
      name: c.fullName.split(' ')[0],
      password: c.tempPassword,
    });
    const copyPassword = async () => {
      try {
        await navigator.clipboard.writeText(c.tempPassword);
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      } catch {
        toast.error(t('clientForm.copyFailed'));
      }
    };
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <MobileHeader title={t('newClient')} showBack backTo="/m/clients" />
        <div className="flex-1 space-y-4 px-4 pb-10 pt-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex justify-center">
              <Holder icon={Check} tone="success" size="lg" />
            </div>
            <h2 className={cn(TYPE.title, TEXT.strong)}>{t('clientCreatedSuccess')}</h2>
            <p className={cn('mt-1', TYPE.body, TEXT.muted)}>{t('clientForm.canLogin', { name: c.fullName })}</p>
          </div>

          <Card>
            <div className={cn(TYPE.small, TEXT.muted)}>{t('temporaryPassword')}</div>
            <div className={cn('mt-2 flex items-center justify-between gap-3 rounded-lg p-3', SURFACE.inset)}>
              <code className={cn('text-[22px] font-semibold tracking-wide', TEXT.strong)}>{c.tempPassword}</code>
              <Holder
                icon={passwordCopied ? Check : Copy}
                tone={passwordCopied ? 'success' : 'neutral'}
                size="sm"
                onClick={copyPassword}
                ariaLabel={t('clientForm.copyPassword')}
              />
            </div>
            <p className={cn('mt-3', TYPE.small, TEXT.muted)}>{t('clientForm.passwordOnce')}</p>
            <a
              href={whatsappShareUrl(c.primaryE164, waMessage)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 text-[16px] font-medium text-white active:bg-[#1DA851]"
            >
              <MessageCircle className="h-5 w-5" />
              {t('clientForm.sendOnWhatsapp', { number: formatE164ForDisplay(c.primaryE164) })}
            </a>
            {c.extraPhonesFailed && (
              <p className="mt-3 rounded-lg bg-[#FDD3D0] px-3 py-2.5 text-[14px] leading-relaxed text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
                {t('clientForm.extraPhonesFailed')}
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <PrimaryPill onClick={() => navigate(`/m/clients/${c.clientId}`)} className="w-full">
              {t('viewClientProfile')}
            </PrimaryPill>
            <SoftPill onClick={() => navigate('/m/clients')} className="w-full">
              {t('backToList')}
            </SoftPill>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulaire ────────────────────────────────────────────────────────
  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={t('newClient')} showBack backTo="/m/clients" />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Identité */}
        <Section title={t('clientForm.identity')} hint={t('clientForm.identityHint')}>
          <FormField label={<>{t('firstName')}{required}</>} htmlFor="cc-first">
            <TextInput id="cc-first" placeholder="Fabrice" value={form.fields.firstName} onChange={(e) => form.setField('firstName', e.target.value)} autoComplete="given-name" autoCapitalize="words" />
          </FormField>
          <FormField label={<>{t('lastName')}{required}</>} htmlFor="cc-last">
            <TextInput id="cc-last" placeholder="Bienvenue" value={form.fields.lastName} onChange={(e) => form.setField('lastName', e.target.value)} autoComplete="family-name" autoCapitalize="words" />
          </FormField>
          <FormField label={<>{t('company')}{optional}</>} htmlFor="cc-company">
            <TextInput id="cc-company" placeholder="Jako Cargo SARL" value={form.fields.company} onChange={(e) => form.setField('company', e.target.value)} autoComplete="organization" />
          </FormField>
        </Section>

        {/* Contact */}
        <Section title={t('clientForm.contact')} hint={t('clientForm.contactHint')}>
          <div className="space-y-3">
            {form.phones.map((row, index) => (
              <div key={row.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={`cc-phone-${index}`} className={cn(TYPE.bodyStrong, TEXT.strong)}>
                    {index === 0 ? <>{t('clientForm.whatsapp')}{required}</> : t('clientForm.otherNumber', { n: index + 1 })}
                  </label>
                  {index > 0 && (
                    <button type="button" onClick={() => form.removePhone(row.key)} className={cn('inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold', TEXT.muted)} aria-label={t('clientForm.removeNumber')}>
                      <X className="h-4 w-4" /> {t('clientForm.remove')}
                    </button>
                  )}
                </div>
                <PhoneNumberInput
                  id={`cc-phone-${index}`}
                  value={row.value}
                  onChange={(value) => form.setPhone(row.key, { value })}
                  aria-label={index === 0 ? t('clientForm.whatsapp') : t('clientForm.otherNumber', { n: index + 1 })}
                />
                {index > 0 && (
                  <TextInput
                    placeholder={t('clientForm.labelPlaceholder')}
                    value={row.label}
                    onChange={(e) => form.setPhone(row.key, { label: e.target.value })}
                    aria-label={t('clientForm.numberLabel')}
                  />
                )}
              </div>
            ))}
            {form.phones.length < MAX_PHONES && (
              <Button variant="subtle" size="sm" onClick={form.addPhone} className="-ml-2">
                <Plus /> {t('clientForm.addNumber')}
              </Button>
            )}
            <p className={cn(TYPE.small, TEXT.muted)}>{t('clientForm.primaryReceivesPassword')}</p>
          </div>

          <FormField label={<>{t('email')}{optional}</>} htmlFor="cc-email" error={form.errors.email ? t('clientForm.emailInvalid') : undefined}>
            <TextInput id="cc-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="fabrice@jakocargo.com" value={form.fields.email} onChange={(e) => form.setField('email', e.target.value)} />
          </FormField>
        </Section>

        {/* Localisation */}
        <Section title={t('clientForm.location')} hint={t('clientForm.locationHint')}>
          <FormField label={<>{t('country')}{required}</>} htmlFor="cc-country">
            <CountryCombobox id="cc-country" variant="country" value={form.countryIso} onChange={form.chooseCountry} />
          </FormField>
          <FormField label={<>{t('city')}{optional}</>} htmlFor="cc-city">
            <TextInput id="cc-city" placeholder="Douala" value={form.fields.city} onChange={(e) => form.setField('city', e.target.value)} autoComplete="address-level2" autoCapitalize="words" />
          </FormField>
        </Section>

        {/* Récapitulatif court, toujours visible en bas du formulaire */}
        <Card className={cn('space-y-1', SURFACE.inset, 'border-0')}>
          <Row label={t('clientForm.summaryClient')} value={`${form.fields.firstName} ${form.fields.lastName}`.trim() || '—'} />
          <Row
            label={t('clientForm.whatsapp')}
            value={form.errors.primaryPhone ? '—' : formatE164ForDisplay(toE164(form.phones[0].value))}
          />
          <Row
            label={t('country')}
            value={
              <span className="inline-flex items-center gap-2">
                <CountryFlag iso={form.countryIso} size={18} />
                {countryName(form.countryIso, lang)}
              </span>
            }
          />
        </Card>
      </div>

      <div className={cn('shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting} className="w-full">
          {t('createTheClient')}
        </PrimaryPill>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className={cn(TYPE.lead, TEXT.strong)}>{title}</h2>
        {hint && <p className={cn('mt-0.5', TYPE.small, TEXT.muted)}>{hint}</p>}
      </div>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}
