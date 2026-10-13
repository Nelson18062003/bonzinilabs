// ============================================================
// RÉCEPTION — Le dépôt, LA fiche du dépôt, qu'il soit en cours ou terminé.
//   · En cours, et à moi (je l'ai reçu, ou je suis de l'équipe cargo) : la
//     saisie — « Ajouter un colis », « Terminer le dépôt » (confirmation, puis
//     le reçu), retirer un colis (confirmation), changer le fournisseur ; un
//     dépôt ouvert par erreur et encore vide s'abandonne.
//   · En cours chez un collègue : en lecture, avec qui le saisit — le serveur
//     ne laisse compléter un dépôt qu'à celui qui l'a reçu (reception_can_edit) :
//     on ne fait plus remplir cinq étapes pour finir sur un refus.
//   · Terminé : la consultation — ses colis, leurs photos, la correction d'un
//     colis (s'il est à moi, pas encore parti, et que le devis n'est pas déjà
//     chez le client : sinon l'équipe cargo corrige), et « Imprimer les
//     étiquettes des colis » sur place.
// Un dépôt sans client se voit tout de suite, avec le bouton pour l'attribuer.
// La flèche ramène là d'où l'on vient (Aujourd'hui, la fiche client…).
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Printer, Trash2, UserSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, depositSupplier, formatCbm, formatKg, initials, parcelLockReason, quoteLocksParcels, supplierLine, type Parcel } from '@/lib/reception';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { useCancelDeposit, useCloseDeposit, useReceptionDeposit, useRemoveParcel } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TONE_PILL, TYPE, BottomSheet, Button, Card, Holder, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatusPill } from '@/mobile/designKit';
import { LocationMark, ParcelRow, StepHeader, useReceptionLabels } from '@/mobile/components/reception/bits';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { useReceptionBack, useStillHere } from '@/mobile/components/reception/useReceptionBack';

/** Le motif posé quand on abandonne un dépôt ouvert par erreur (la suppression exige un motif). */
const ABANDON_REASON = 'Ouvert par erreur à la réception (vide)';

export function ReceptionDeposit() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const stillHere = useStillHere();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { t: ti } = useTranslation('agent');
  const { currentUser, hasPermission } = useAdminAuth();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const { data: settings } = useAdminShippingSettings();
  const viewer = useParcelViewer();
  const remove = useRemoveParcel();
  const close = useCloseDeposit();
  const cancel = useCancelDeposit();
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState<Parcel | null>(null);
  const [abandon, setAbandon] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const leave = () => back('/r');

  // Chargement et erreur gardent l'en-tête et sa flèche : jamais d'écran sans sortie.
  if (isLoading || error || !deposit) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <MobileHeader title={t('rc_deposits')} showBack onBack={leave} />
        {isLoading ? <ScreenLoader /> : <ScreenError title={t('error')} retryLabel={t('rc_retry')} description={(error as Error | null)?.message ?? t('rc_deposit_not_found')} onRetry={() => void refetch()} />}
      </div>
    );
  }

  // Le miroir de reception_can_edit : le dépôt est à moi, ou je suis de l'équipe cargo.
  const mine = deposit.received_by === currentUser?.id || hasPermission('canManageCargo');
  const cancelled = deposit.status === 'cancelled';
  const editable = deposit.status === 'open' && mine;
  // Terminé, devis déjà chez le client ou encaissé : le serveur ne laisse plus corriger qu'à l'équipe cargo.
  const quoteLocked = mine && quoteLocksParcels(deposit, hasPermission('canManageCargo'));
  const name = deposit.client ? clientFullName(deposit.client) : t('rc_unknown_client');
  const st = labels.status(deposit);

  const finish = async () => {
    if (close.isPending) return;
    const dep = await close.mutateAsync({ depositId: deposit.id }).catch(() => null);
    if (!dep || !stillHere()) return; // refus (le hook l'a dit) : on reste sur le dépôt ; écran quitté : on n'y revient pas
    setConfirm(false);
    navigate(`/r/deposit/${dep.id}/done`, { replace: true });
  };
  const doRemove = () => {
    if (!removing || remove.isPending) return;
    remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
  };
  const doAbandon = () => {
    if (cancel.isPending) return;
    cancel.mutate({ depositId: deposit.id, reason: ABANDON_REASON }, { onSuccess: () => { setAbandon(false); leave(); } });
  };
  /** Toucher un colis : le corriger s'il est à moi, pas encore parti, devis pas engagé ; sinon, ses photos. */
  const openParcel = (p: Parcel) => {
    if (mine && !cancelled && !quoteLocked && !parcelLockReason(p)) navigate(`/r/deposit/${deposit.id}/parcel/${p.id}`);
    else viewer.open(deposit.parcels.indexOf(p));
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={deposit.deposit_no} subtitle={labels.location(deposit.location)} showBack onBack={leave} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        {editable && <StepHeader step={4} total={4} title={t('rc_s3_title')} help={t('rc_s3_help')} />}

        {cancelled && (
          <p className={cn('rounded-lg px-4 py-3', TYPE.bodyStrong, TONE_PILL.danger)}>{t('rc_dep_cancelled')}</p>
        )}
        {quoteLocked && (
          <p className={cn('rounded-lg px-4 py-3', TYPE.body, TONE_PILL.pending)}>{t('rc_dep_quote_locked')}</p>
        )}
        {deposit.status === 'open' && !mine && (
          <p className={cn('rounded-lg px-4 py-3', TYPE.body, TONE_PILL.pending)}>
            {ti('rc_dep_other_open', { name: deposit.received_by_name || t('rc_dep_colleague') })}
          </p>
        )}

        {/* Le client, en une ligne — la fiche complète n'a rien à faire ici. */}
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <Holder size="lg" tone={deposit.client ? 'neutral' : 'pending'}>{deposit.client ? initials(name) : '?'}</Holder>
            <span className="min-w-0 flex-1">
              <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
              <span className={cn('mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums', TYPE.small, TEXT.muted)}>
                {deposit.client ? <span>{deposit.client.customer_code}{deposit.client.account_name ? ` · ${deposit.client.account_name}` : ''}</span> : <span>{t('rc_pending')}</span>}
                <span>· {labels.broughtBy(deposit.brought_by)}{deposit.representative_name ? ` (${deposit.representative_name})` : ''}</span>
                <span className="inline-flex items-center gap-1">· <LocationMark location={deposit.location} size={18} />{deposit.location === 'warehouse' ? t('rc_warehouse_short') : t('rc_office_short')}</span>
              </span>
            </span>
            {deposit.client && <StatusPill tone={st.tone} label={st.label} className="shrink-0" />}
          </div>
          {editable ? (
            <button type="button" onClick={() => navigate(`/r/deposit/${deposit.id}/supplier?edit`)} className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left', SURFACE.inset)}>
              <span className={cn('shrink-0', TYPE.small, TEXT.muted)}>{t('rc_sup_label')}</span>
              <span className={cn('min-w-0 flex-1 break-words', TYPE.smallStrong, depositSupplier(deposit) ? TEXT.strong : TEXT.muted)}>{depositSupplier(deposit) ? supplierLine(depositSupplier(deposit)) : t('rc_sup_none')}</span>
              <span className={cn('shrink-0', TYPE.smallStrong, TEXT.muted)}>{depositSupplier(deposit) ? t('rc_change') : t('rc_sup_add')}</span>
            </button>
          ) : (
            <p className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2', SURFACE.inset)}>
              <span className={cn('shrink-0', TYPE.small, TEXT.muted)}>{t('rc_sup_label')}</span>
              <span className={cn('min-w-0 flex-1 break-words', TYPE.smallStrong, depositSupplier(deposit) ? TEXT.strong : TEXT.muted)}>{depositSupplier(deposit) ? supplierLine(depositSupplier(deposit)) : t('rc_sup_none')}</span>
            </p>
          )}
          {!deposit.client && !cancelled && (
            <Button variant="neutral" className="h-12 w-full" onClick={() => navigate(`/r/new?assign=${deposit.id}&from=deposit`)}>
              <UserSearch /> {t('rc_assign')}
            </Button>
          )}
        </Card>

        {/* Les colis */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('rc_parcels')}</h2>
            <span className={cn('tabular-nums', TYPE.smallStrong, TEXT.muted)}>{deposit.parcels.length}</span>
          </div>
          {deposit.parcels.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
              <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_no_parcel_yet')}</p>
            </Card>
          ) : (
            <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
              {deposit.parcels.map((p) => (
                <ParcelRow key={p.id} parcel={p} onClick={() => openParcel(p)} onPhoto={() => viewer.open(deposit.parcels.indexOf(p))} onRemove={editable && !parcelLockReason(p) ? () => setRemoving(p) : undefined} />
              ))}
            </Card>
          )}
          {editable && deposit.parcels.length === 0 && (
            <button type="button" onClick={() => setAbandon(true)} className={cn('mt-4 flex h-11 w-full items-center justify-center gap-2', TYPE.smallStrong, 'text-[#C00F0C] dark:text-[#FCB3AD]')}>
              <Trash2 className="h-4 w-4" /> {t('rc_dep_abandon')}
            </button>
          )}
        </section>
      </div>

      <div className={cn('shrink-0 space-y-3 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4', SURFACE.canvas, SURFACE.divider)}>
        {/* Le total sur deux lignes : l'étiquette, puis les chiffres — ça tient sur 320 px comme sur 430. */}
        {deposit.parcels.length > 0 && <div>
          <span className={cn('block', TYPE.small, TEXT.muted)}>{t('rc_total')}</span>
          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>
            {labels.parcels(deposit.parcels.length)} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}
          </span>
        </div>}
        {editable ? (
          <div className="space-y-3">
            {/* Le geste principal, en pleine largeur ; « Terminer » n'apparaît qu'une fois qu'il y a quelque chose à terminer. */}
            <PrimaryPill onClick={() => navigate(`/r/deposit/${deposit.id}/parcel`)} className="h-14 w-full text-[17px]"><Plus /> {t('rc_add_parcel')}</PrimaryPill>
            {deposit.parcels.length > 0 && (
              <SoftPill onClick={() => setConfirm(true)} className="h-14 w-full text-[17px]">{ti('rc_finish_n', { count: deposit.parcels.length })}</SoftPill>
            )}
          </div>
        ) : deposit.status === 'closed' && deposit.client && deposit.parcels.length > 0 ? (
          // Terminé : les étiquettes des colis se réimpriment ici même.
          <PrimaryPill onClick={() => setLabelsOpen(true)} className="h-14 w-full text-[17px]"><Printer /> {t('rc_print_labels')} ({deposit.parcels.length})</PrimaryPill>
        ) : (
          <SoftPill onClick={leave} className="h-12 w-full">{t('rc_back')}</SoftPill>
        )}
      </div>

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title={t('rc_close_confirm')}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_close_hint')}</p>
          <Card className={cn(SURFACE.inset, 'border-0')}>
            <div className={cn('flex items-center justify-between', TYPE.body)}>
              <span className={TEXT.muted}>{name}</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{labels.parcels(deposit.parcels.length)} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}</span>
            </div>
          </Card>
          <PrimaryPill onClick={() => void finish()} loading={close.isPending} className="h-14 w-full text-[17px]">{t('rc_finish')}</PrimaryPill>
          <SoftPill onClick={() => setConfirm(false)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>

      <BottomSheet open={removing !== null} onClose={() => setRemoving(null)} title={ti('rc_remove_confirm_title', { no: removing?.parcel_no ?? '' })}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_remove_confirm_hint')}</p>
          <PrimaryPill danger onClick={doRemove} loading={remove.isPending} className="h-14 w-full text-[17px]"><Trash2 /> {t('rc_remove')}</PrimaryPill>
          <SoftPill onClick={() => setRemoving(null)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>

      <BottomSheet open={abandon} onClose={() => setAbandon(false)} title={t('rc_dep_abandon')}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{ti('rc_dep_abandon_hint', { no: deposit.deposit_no })}</p>
          <PrimaryPill danger onClick={doAbandon} loading={cancel.isPending} className="h-14 w-full text-[17px]"><Trash2 /> {t('rc_dep_abandon')}</PrimaryPill>
          <SoftPill onClick={() => setAbandon(false)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>

      {deposit.client && <InternalLabelSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
      <ParcelPhotoViewer parcels={deposit.parcels} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={deposit.deposit_no} />
    </div>
  );
}
