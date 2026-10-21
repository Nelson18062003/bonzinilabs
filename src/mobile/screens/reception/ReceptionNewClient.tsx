// ============================================================
// RÉCEPTION — Nouveau client. LE MÊME formulaire que l'admin (drapeaux,
// indicatifs, plusieurs numéros, e-mail, pays, ville, sexe, date de
// naissance) : `ClientFormSections` sur `useCreateClientForm`. Le sexe y
// est facultatif : la réception ne voit souvent que l'étiquette du colis. Après la création, le mot de passe provisoire
// et le bouton WhatsApp, puis la suite selon d'où l'on vient :
//   · un dépôt en cours de création → « Continuer le dépôt » ;
//   · l'onglet Clients (?from=clients) → « Commencer un dépôt pour lui » ou
//     « Voir sa fiche et son étiquette » ;
//   · une attribution (?assign=) → « Attribuer le dépôt à ce client », puis
//     retour là d'où l'on venait ; un refus laisse des sorties visibles.
// L'écran de succès a toujours sa flèche.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Copy, MessageCircle, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { BigButton, Dock, ScreenTop, SURFACE, TEXT, TONE_PILL, TYPE, Button, Card, Holder } from '@/mobile/designKit';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { useCreateClientForm, whatsappShareUrl } from '@/components/clients/useCreateClientForm';
import { ClientFormSections } from '@/components/clients/ClientFormSections';
import { useAssignDeposit } from '@/hooks/useReception';
import { useReceptionLocation } from './useReceptionLocation';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { useAssignFlow } from '@/mobile/components/reception/useAssignFlow';

export function ReceptionNewClient() {
  const { t: tc } = useTranslation('common');
  const { t } = useLanguage();
  const navigate = useNavigate();
  const back = useReceptionBack();
  const flow = useAssignFlow();
  const { assignId } = flow;
  const [params] = useSearchParams();
  const fromClients = params.get('from') === 'clients';
  // Le lieu de réception décide de l'origine du client (« Colis reçu · Bureau / Entrepôt de Guangzhou ») : on ne la choisit pas ici.
  const { location } = useReceptionLocation();
  const form = useCreateClientForm({ reception: { location } });
  const assign = useAssignDeposit();
  const [copied, setCopied] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  /** Quitter : l'onglet Clients, l'attribution abandonnée, ou le début du dépôt. */
  const leave = () => (fromClients ? back('/r/clients') : assignId ? flow.leave() : back('/r'));

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
    const startDeposit = () => navigate(`/r/new/how?client=${c.clientId}&name=${encodeURIComponent(c.fullName)}`, { replace: true });
    const seeCard = () => navigate(`/r/clients/${c.clientId}`, { replace: true });
    const doAssign = async () => {
      if (!assignId || assign.isPending) return;
      try {
        await assign.mutateAsync({ depositId: assignId, clientUserId: c.clientId });
      } catch (e) {
        setRefused((e as Error).message); // le hook l'a dit ; ici, les sorties
        return;
      }
      flow.assigned(c.fullName);
    };
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title={t('rc_new_client')} onBack={leave} />
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
            {c.originLabel && (
              <p className={cn(TYPE.small, TEXT.muted)}>{tc('clientForm.sourceSummary')} : <b className={TEXT.strong}>{c.originLabel}</b></p>
            )}
            {c.extraPhonesFailed && (
              <p className={cn('mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive', TYPE.small)}>{tc('clientForm.extraPhonesFailed')}</p>
            )}
            {c.sourceFailed && (
              <p className={cn('mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive', TYPE.small)}>{tc('clientForm.sourceFailed')}</p>
            )}
            {c.identityFailed && (
              <p className={cn('mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive', TYPE.small)}>{tc('clientForm.identityFailedReception')}</p>
            )}
          </Card>
          {refused && (
            <div role="alert" className={cn('space-y-3 rounded-lg px-4 py-4', TONE_PILL.danger)}>
              <p className={cn('flex items-start gap-2', TYPE.bodyStrong)}><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {refused}</p>
              <div className="flex flex-wrap gap-2">
                {assignId && <Button variant="neutral" className="h-11 px-4" onClick={flow.seeDeposit}>{t('rc_see_deposit')}</Button>}
                <Button variant="neutral" className="h-11 px-4" onClick={seeCard}>{t('rc_see_client_card')}</Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {assignId ? (
              <BigButton onClick={() => void doAssign()} loading={assign.isPending} disabled={!!refused}>{t('rc_assign_to_client')}</BigButton>
            ) : (
              <BigButton onClick={startDeposit}>{fromClients ? t('rc_start_deposit_for') : t('rc_continue_deposit')}</BigButton>
            )}
            {!assignId && <BigButton variant="soft" onClick={seeCard}><Tag className="h-5 w-5" /> {t('rc_see_client_card')}</BigButton>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={t('rc_new_client')} onBack={() => (fromClients ? back('/r/clients') : navigate(`/r/new/search${flow.qs}`, { replace: true }))} />
      <div className="flex-1 space-y-6 px-5 pb-6 pt-5">
        <ClientFormSections form={form} />
      </div>
      <Dock>
        <BigButton onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.isSubmitting}>{t('rc_create_and_continue')}</BigButton>
      </Dock>
    </div>
  );
}
