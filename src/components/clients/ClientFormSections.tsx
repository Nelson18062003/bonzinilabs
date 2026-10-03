// ============================================================
// Les trois sections du formulaire « Nouveau client » — Identité · Contact ·
// Localisation — et le récapitulatif. Partagées par l'écran admin
// (MobileCreateClient) et par la réception des colis (ReceptionNewClient) :
// mêmes drapeaux, mêmes numéros multiples, même validation. La logique vit
// dans `useCreateClientForm` ; ici, seulement le rendu.
// ============================================================
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Row, FormField, TextInput, Button } from '@/mobile/designKit';
import { PhoneNumberInput, formatE164ForDisplay, toE164 } from '@/components/form/PhoneNumberInput';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { CountryFlag } from '@/components/form/CountryFlag';
import { countryName, toCountryLang } from '@/data/countries';
import { MAX_PHONES, type useCreateClientForm } from '@/components/clients/useCreateClientForm';

export function ClientFormSections({ form }: { form: ReturnType<typeof useCreateClientForm> }) {
  const { t, i18n } = useTranslation('common');
  const lang = toCountryLang(i18n.language);
  const optional = <span className={cn('ml-1 font-normal', TEXT.muted)}>{t('clientForm.optional')}</span>;
  const required = <span className="ml-0.5 text-[#C00F0C] dark:text-[#FCB3AD]">*</span>;

  return (
    <>
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
    </>
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
