// ============================================================
// RÉCEPTION — Nouveau client. LE MÊME formulaire que l'admin (drapeaux,
// indicatifs, plusieurs numéros, e-mail, pays, ville) : `ClientFormSections`
// sur `useCreateClientForm`. Après la création, le mot de passe provisoire
// et le bouton WhatsApp, puis on continue vers le dépôt avec ce client.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, PrimaryPill } from '@/mobile/designKit';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { useCreateClientForm, whatsappShareUrl } from '@/components/clients/useCreateClientForm';
import { ClientFormSections } from '@/components/clients/ClientFormSections';
import { useAssignDeposit } from '@/hooks/useReception';

export function ReceptionNewClient() {
  const { t: tc } = useTranslation('common');
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const assignId = params.get('assign');
  const form = useCreateClientForm();
  const assign = useAssignDeposit();
  const [copied, setCopied] = useState(false);

  if (form.created) {
    const c = form.created;
    const waMessage = tc('clientForm.whatsappMessage', { name: c.fullName.split(' ')[0], password: c.tempPassword });
    const copyPassword = async () => {
      try {
        await navigator.clipboard.writeText(c.tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(tc('clientForm.copyFailed'));
      }
    };
    const proceed = async () => {
      if (assignId) {
        const dep = await assign.mutateAsync({ depositId: assignId, clientUserId: c.clientId });
        navigate(`/r/deposit/${dep.id}`, { replace: true });
        return;
      }
      navigate(`/r/new/how?client=${c.clientId}&name=${encodeURIComponent(c.fullName)}`, { replace: true });
    };
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <MobileHeader title={t('rc_new_client')} />
        <div className="flex-1 space-y-6 px-5 pb-10 pt-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center"><Holder icon={Check} tone="success" size="lg" /></div>
            <h2 className={cn(TYPE.title, TEXT.strong)}>{tc('clientCreatedSuccess')}</h2>
            <p className={cn('mt-2', TYPE.body, TEXT.muted)}>{tc('clientForm.canLogin', { name: c.fullName })}</p>
          </div>
          <Card className="space-y-4">
            <div className={cn(TYPE.small, TEXT.muted)}>{tc('temporaryPassword')}</div>
            <div className={cn('flex items-center justify-between gap-3 rounded-lg p-3', SURFACE.inset)}>
              <code className={cn('text-[22px] font-semibold tracking-wide', TEXT.strong)}>{c.tempPassword}</code>
              <Holder icon={copied ? Check : Copy} tone={copied ? 'success' : 'neutral'} size="sm" onClick={copyPassword} ariaLabel={tc('clientForm.copyPassword')} />
            </div>
            <a href={whatsappShareUrl(c.primaryE164, waMessage)} target="_blank" rel="noreferrer" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 text-[16px] font-medium text-white active:bg-[#1DA851]">
              <MessageCircle className="h-5 w-5" />
              {tc('clientForm.sendOnWhatsapp', { number: formatE164ForDisplay(c.primaryE164) })}
            </a>
          </Card>
          <PrimaryPill onClick={() => void proceed()} loading={assign.isPending} className="h-14 w-full text-[17px]">{t('rc_continue')}</PrimaryPill>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={t('rc_new_client')} showBack backTo={`/r/new${assignId ? `?assign=${assignId}` : ''}`} />
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <ClientFormSections form={form} />
      </div>
      <div className={cn('shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting} className="h-14 w-full text-[17px]">
          {t('rc_create_and_continue')}
        </PrimaryPill>
      </div>
    </div>
  );
}
