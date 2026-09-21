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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, PrimaryPill, SoftPill } from '@/mobile/designKit';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { useCreateClientForm, whatsappShareUrl } from '@/components/clients/useCreateClientForm';
import { ClientFormSections } from '@/components/clients/ClientFormSections';

export function MobileCreateClient() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const form = useCreateClientForm();
  const [passwordCopied, setPasswordCopied] = useState(false);

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
        <ClientFormSections form={form} />
      </div>

      <div className={cn('shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting} className="w-full">
          {t('createTheClient')}
        </PrimaryPill>
      </div>
    </div>
  );
}
