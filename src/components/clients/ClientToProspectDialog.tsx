/**
 * « Repasser en prospect » — super admin seulement (canManageUsers ET
 * canManageSales), décision du 07/10 : garder le contrôle sur un compte
 * client créé trop tôt, ou par erreur.
 *
 * Seulement pour un client qui n'a fait AUCUNE opération : le serveur le dit
 * (`admin_client_prospect_eligibility`) et la fenêtre montre, en clair, ce
 * qui bloque (« 3 dépôts », « Solde de 25 000 XAF »…) — sans bouton. Ce qui
 * partirait AUSSI avec le compte sans bloquer (bénéficiaires, conversation
 * avec le support, KYC, notes : `warnings`) est listé, pour décider en
 * connaissance de cause — tout est gardé au journal. Sinon :
 * ce qui va se passer, sans ambiguïté (son compte est SUPPRIMÉ, il ne peut
 * plus se connecter ; ses informations deviennent une fiche prospect), le
 * commercial qui le suivra (celui proposé par le serveur d'abord), un motif
 * facultatif et une case à cocher. `admin_client_to_prospect` revérifie tout
 * sous verrou.
 *
 * Même contenu en feuille basse (téléphone) et en fenêtre centrée
 * (ordinateur). Après : retour à la liste des clients, et UN toast (le hook
 * n'en fait pas) avec le lien vers la page du commercial.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Ban, UserRoundSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientProspectEligibility, useClientToProspect } from '@/hooks/useSales';
import { useClientSources } from '@/hooks/useClientSources';
import { TextArea } from '@/components/form';
import { SURFACE, TEXT, TYPE, BottomSheet, PrimaryPill, SoftPill } from '@/mobile/designKit';
import { CenterDialog } from '@/desktop/designKit';

interface ClientToProspectDialogProps {
  open: boolean;
  onClose: () => void;
  /** Le user_id du client. */
  userId: string;
  clientName: string;
  variant?: 'sheet' | 'dialog';
}

export function ClientToProspectDialog({ open, onClose, userId, clientName, variant = 'sheet' }: ClientToProspectDialogProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const eligibility = useClientProspectEligibility(userId, open);
  const sources = useClientSources();
  const toProspect = useClientToProspect();
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setPicked(null);
      setReason('');
      setConfirmed(false);
    }
  }, [open]);

  const commercials = (sources.data ?? []).filter((s) => s.kind === 'commercial' && s.is_active);
  const data = eligibility.data;
  const suggested = data?.suggested_source_id && commercials.some((c) => c.id === data.suggested_source_id) ? data.suggested_source_id : null;
  const sourceId = picked ?? suggested;
  const chosen = commercials.find((c) => c.id === sourceId) ?? null;
  const ready = !!data?.eligible && !!chosen && confirmed && !toProspect.isPending;

  const submit = () => {
    if (!ready || !chosen) return;
    const commercial = chosen.label;
    const target = chosen.id;
    toProspect.mutate(
      { userId, sourceId: target, reason },
      {
        onSuccess: () => {
          onClose();
          // Le compte n'existe plus : sa fiche non plus.
          navigate('/m/clients', { replace: true });
          toast(t('clientToProspect.done', { name: clientName, commercial }), {
            action: { label: t('clientToProspect.openCommercial'), onClick: () => navigate(`/m/equipe/ventes/${target}`) },
          });
        },
      },
    );
  };

  const close = () => {
    if (!toProspect.isPending) onClose();
  };

  let body: ReactNode;
  if (eligibility.isLoading || (data?.eligible && sources.isLoading)) {
    body = (
      <div className="space-y-2" aria-busy="true">
        <p className={cn(TYPE.small, TEXT.muted)}>{t('clientToProspect.checking')}</p>
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  } else if (eligibility.isError || !data) {
    body = (
      <div role="alert" className="space-y-3">
        <p className={cn('text-[15px]', TEXT.strong)}>{t('clientToProspect.loadError')}</p>
        {eligibility.error && <p className={cn(TYPE.small, TEXT.muted)}>{(eligibility.error as Error).message}</p>}
        <SoftPill onClick={() => void eligibility.refetch()}>{t('retry')}</SoftPill>
      </div>
    );
  } else if (!data.eligible) {
    body = (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-[#FDD3D0] p-3.5 text-[#900B09] dark:bg-[#900B09]/40 dark:text-[#FDD3D0]">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t('clientToProspect.blockedTitle', { name: clientName })}</p>
            <p className="mt-0.5 text-[14px] leading-relaxed">{t('clientToProspect.blockedBody')}</p>
          </div>
        </div>
        <div>
          <p className={cn('mb-2', TYPE.bodyStrong, TEXT.strong)}>{t('clientToProspect.blockersTitle')}</p>
          <ul className="space-y-1.5" aria-label={t('clientToProspect.blockersTitle')}>
            {(data.blockers ?? []).map((b) => (
              <li key={b} className={cn('flex items-start gap-2 text-[15px]', TEXT.strong)}>
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C00F0C] dark:bg-[#FCB3AD]" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-[#FFF1C2] p-3.5 text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 space-y-1 text-[14px] leading-relaxed">
            <p className="font-semibold">{t('clientToProspect.explain')}</p>
            <p>{data.reopen_prospect_id ? t('clientToProspect.reopen') : t('clientToProspect.create')}</p>
          </div>
        </div>

        {(data.warnings ?? []).length > 0 && (
          <div>
            <p className={cn('mb-2', TYPE.bodyStrong, TEXT.strong)}>{t('clientToProspect.warningsTitle')}</p>
            <ul className="space-y-1.5" aria-label={t('clientToProspect.warningsTitle')}>
              {(data.warnings ?? []).map((w) => (
                <li key={w} className={cn('flex items-start gap-2 text-[15px]', TEXT.strong)}>
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B86E00] dark:bg-[#FFD27A]" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className={cn('mb-2', TYPE.bodyStrong, TEXT.strong)}>{t('clientToProspect.commercial')}</p>
          {commercials.length === 0 ? (
            <p className={cn('rounded-lg p-3 text-[14px]', SURFACE.inset, TEXT.muted)}>{t('clientToProspect.noCommercial')}</p>
          ) : (
            <div role="radiogroup" aria-label={t('clientToProspect.commercial')} className="space-y-1.5">
              {commercials.map((c) => {
                const on = sourceId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(c.id)}
                    className={cn(
                      'flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left ring-1 transition',
                      on ? 'ring-2 ring-primary' : 'ring-black/10 hover:bg-black/[0.03] dark:ring-white/15 dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ring-2', on ? 'bg-primary ring-primary' : 'ring-black/25 dark:ring-white/30')}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold', TEXT.strong)}>{c.label}</span>
                    {c.id === suggested && <span className={cn('shrink-0 text-[13px]', TEXT.muted)}>{t('clientToProspect.suggested')}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <TextArea
          id="to-prospect-reason"
          label={t('clientToProspect.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('clientToProspect.reasonPlaceholder')}
          maxLength={300}
          rows={2}
          controlClassName="min-h-[72px]"
        />

        <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg p-3', SURFACE.inset)}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#C00F0C]"
          />
          <span className={cn('text-[14px] leading-relaxed', TEXT.strong)}>{t('clientToProspect.confirm', { name: clientName })}</span>
        </label>
      </div>
    );
  }

  const canAct = !!data?.eligible && !eligibility.isLoading && !eligibility.isError;
  const primary = canAct ? (
    <PrimaryPill danger onClick={submit} disabled={!ready} loading={toProspect.isPending} className={variant === 'dialog' ? 'flex-1' : 'w-full'}>
      {t('clientToProspect.submit')}
    </PrimaryPill>
  ) : null;
  const secondary = (
    <SoftPill onClick={close} disabled={toProspect.isPending} className={variant === 'dialog' ? 'flex-1' : 'w-full'}>
      {canAct ? t('cancel') : t('close')}
    </SoftPill>
  );
  const title = (
    <span className="flex items-center gap-2">
      <UserRoundSearch className="h-5 w-5 shrink-0" />
      {t('clientToProspect.title', { name: clientName })}
    </span>
  );

  if (variant === 'dialog') {
    return (
      <CenterDialog open={open} onClose={close} title={title} width={520} footer={<>{primary}{secondary}</>}>
        {body}
      </CenterDialog>
    );
  }
  return (
    <BottomSheet open={open} onClose={close} title={title}>
      {body}
      <div className="mt-5 flex flex-col gap-2">
        {primary}
        {secondary}
      </div>
    </BottomSheet>
  );
}
