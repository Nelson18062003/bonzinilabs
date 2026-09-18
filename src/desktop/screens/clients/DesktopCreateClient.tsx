/**
 * Formulaire « Nouveau client » — desktop.
 *
 * Même logique que le mobile (`useCreateClientForm`), mise en page en deux
 * colonnes dans la fenêtre ouverte au-dessus de la liste des clients
 * (`DesktopCreateClientDialog`). Trois sections : Identité · Contact ·
 * Localisation. Tous les pays du monde avec leur drapeau, numéros validés
 * par libphonenumber, plusieurs numéros possibles (le premier est le
 * principal, celui qui reçoit le mot de passe).
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, UserPlus, Plus, X, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, FormField, TextInput, PrimaryPill, SoftPill } from '@/desktop/designKit';
import { PhoneNumberInput, formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { useCreateClientForm, whatsappShareUrl, MAX_PHONES } from '@/components/clients/useCreateClientForm';

interface CreateClientProps {
  /**
   * Rendu à l'intérieur d'une fenêtre : la largeur et les marges viennent
   * alors de la fenêtre, pas du formulaire.
   */
  embedded?: boolean;
}

const CONTROL = 'h-12 rounded-2xl';

export function DesktopCreateClient({ embedded = false }: CreateClientProps = {}) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const form = useCreateClientForm();
  const [passwordCopied, setPasswordCopied] = useState(false);

  const optional = <span className={cn('ml-1 text-[13px] font-normal', TEXT.muted)}>{t('clientForm.optional')}</span>;
  const required = <span className="ml-0.5 text-destructive">*</span>;

  // ── Succès ────────────────────────────────────────────────────────────
  if (form.created) {
    const c = form.created;
    const waMessage = t('clientForm.whatsappMessage', { name: c.fullName.split(' ')[0], password: c.tempPassword });
    const copyPassword = async () => {
      await navigator.clipboard.writeText(c.tempPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    };
    return (
      <div className={cn('space-y-6', embedded ? '' : 'mx-auto max-w-xl')}>
        <header className="text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <Holder icon={Check} tone="success" size="lg" />
          </div>
          <h2 className={cn('text-[22px] font-extrabold tracking-tight', TEXT.strong)}>{t('clientCreatedSuccess')}</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>{t('clientForm.canLogin', { name: c.fullName })}</p>
        </header>

        <Card className="p-5">
          <div className={cn('mb-2 text-[13px]', TEXT.muted)}>{t('temporaryPassword')}</div>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-3.5', SURFACE.canvas)}>
            <code className={cn('text-[20px] font-bold tracking-wide', TEXT.strong)}>{c.tempPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={copyPassword} ariaLabel={t('clientForm.copyPassword')} />
          </div>
          <p className={cn('mt-3 text-[13px] leading-relaxed', TEXT.muted)}>{t('clientForm.passwordOnce')}</p>
          <a
            href={whatsappShareUrl(c.primaryE164, waMessage)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#25D366] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1DA851]"
          >
            <MessageCircle className="size-4" />
            {t('clientForm.sendOnWhatsapp', { number: formatE164ForDisplay(c.primaryE164) })}
          </a>
          {c.extraPhonesFailed && (
            <div className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
              {t('clientForm.extraPhonesFailed')}
            </div>
          )}
        </Card>

        <div className="flex gap-2.5">
          <SoftPill onClick={() => navigate('/m/clients')} className="flex-1">{t('backToList')}</SoftPill>
          <PrimaryPill onClick={() => navigate(`/m/clients/${c.clientId}`)} className="flex-[1.5]">{t('viewClientProfile')}</PrimaryPill>
        </div>
      </div>
    );
  }

  // ── Formulaire ────────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-6', embedded ? '' : 'mx-auto max-w-3xl')}>
      <header className="flex items-center gap-3">
        <Holder icon={UserPlus} tone="info" />
        <div>
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>{t('newClient')}</h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>{t('clientForm.subtitle')}</p>
        </div>
      </header>

      <div className="space-y-6">
        <Section title={t('clientForm.identity')} hint={t('clientForm.identityHint')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={<>{t('firstName')}{required}</>} htmlFor="cc-first">
              <TextInput id="cc-first" className={CONTROL} placeholder="Fabrice" value={form.fields.firstName} onChange={(e) => form.setField('firstName', e.target.value)} autoComplete="given-name" />
            </FormField>
            <FormField label={<>{t('lastName')}{required}</>} htmlFor="cc-last">
              <TextInput id="cc-last" className={CONTROL} placeholder="Bienvenue" value={form.fields.lastName} onChange={(e) => form.setField('lastName', e.target.value)} autoComplete="family-name" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={<>{t('company')}{optional}</>} htmlFor="cc-company">
                <TextInput id="cc-company" className={CONTROL} placeholder="Jako Cargo SARL" value={form.fields.company} onChange={(e) => form.setField('company', e.target.value)} autoComplete="organization" />
              </FormField>
            </div>
          </div>
        </Section>

        <Section title={t('clientForm.contact')} hint={t('clientForm.contactHint')}>
          <div className="space-y-3">
            {form.phones.map((row, index) => (
              <div key={row.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {index === 0 && (
                    <label htmlFor="cc-phone-0" className={cn('mb-2 block', TYPE.bodyStrong, TEXT.strong)}>
                      {t('clientForm.whatsapp')}{required}
                    </label>
                  )}
                  <PhoneNumberInput
                    id={`cc-phone-${index}`}
                    value={row.value}
                    onChange={(value) => form.setPhone(row.key, { value })}
                    controlClassName={CONTROL}
                    aria-label={index === 0 ? t('clientForm.whatsapp') : t('clientForm.otherNumber', { n: index + 1 })}
                  />
                </div>
                {index > 0 && (
                  <>
                    <TextInput
                      className={cn(CONTROL, 'w-[160px] shrink-0')}
                      placeholder={t('clientForm.labelPlaceholder')}
                      value={row.label}
                      onChange={(e) => form.setPhone(row.key, { label: e.target.value })}
                      aria-label={t('clientForm.numberLabel')}
                    />
                    <button
                      type="button"
                      onClick={() => form.removePhone(row.key)}
                      aria-label={t('clientForm.removeNumber')}
                      className="flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <p className={cn('text-[13px]', TEXT.muted)}>{t('clientForm.primaryReceivesPassword')}</p>
              {form.phones.length < MAX_PHONES && (
                <button type="button" onClick={form.addPhone} className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                  <Plus className="size-3.5" />
                  {t('clientForm.addNumber')}
                </button>
              )}
            </div>
          </div>

          <FormField label={<>{t('email')}{optional}</>} htmlFor="cc-email" error={form.errors.email ? t('clientForm.emailInvalid') : undefined}>
            <TextInput id="cc-email" className={CONTROL} type="email" placeholder="fabrice@jakocargo.com" value={form.fields.email} onChange={(e) => form.setField('email', e.target.value)} autoComplete="email" />
          </FormField>
        </Section>

        <Section title={t('clientForm.location')} hint={t('clientForm.locationHint')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={<>{t('country')}{required}</>} htmlFor="cc-country">
              <CountryCombobox id="cc-country" variant="country" value={form.countryIso} onChange={form.chooseCountry} className={CONTROL} />
            </FormField>
            <FormField label={<>{t('city')}{optional}</>} htmlFor="cc-city">
              <TextInput id="cc-city" className={CONTROL} placeholder="Douala" value={form.fields.city} onChange={(e) => form.setField('city', e.target.value)} autoComplete="address-level2" />
            </FormField>
          </div>
        </Section>
      </div>

      <p className={cn('text-[13px] leading-relaxed', TEXT.muted)}>{t('clientForm.passwordWillBeSent')}</p>

      <div className="flex items-center justify-end gap-2.5">
        <SoftPill onClick={() => navigate('/m/clients')}>{t('cancel')}</SoftPill>
        <PrimaryPill onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting}>
          {t('createTheClient')}
        </PrimaryPill>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
      <div>
        <h3 className={cn('text-[16px] font-bold', TEXT.strong)}>{title}</h3>
        {hint && <p className={cn('mt-1 text-[13px] leading-relaxed', TEXT.muted)}>{hint}</p>}
      </div>
      <Card className="space-y-4 rounded-2xl p-5">{children}</Card>
    </section>
  );
}
