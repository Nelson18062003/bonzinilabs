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
// Refonte v2 (gabarit 04/07, sans l'encaissement) : le client en carte, les
// colis avec leur photo ; toucher un colis = le corriger, voir ses photos ou
// le retirer ; le fournisseur et le reste dans « … ».
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Images, Pencil, Plus, Printer, Store, Trash2, UserSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, depositSupplier, formatCbm, formatKg, isParcelIncomplete, parcelLockReason, quoteLocksParcels, supplierLine, type Parcel } from '@/lib/reception';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { useCancelDeposit, useCloseDeposit, useReceptionDeposit, useRemoveParcel } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import {
  ActionSheet, BigButton, ConfirmSheet, Dock, EmptyLine, IconCircle, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenTop, SURFACE, TEXT, TONE_PILL, Tag, useSheet,
  type SheetAction,
} from '@/mobile/designKit';
import { DepositLoadState, ParcelLine, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { CapsLabel } from '@/mobile/components/cargo/v2';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { assignPath } from '@/mobile/components/reception/useAssignFlow';
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
  const [parcelMenu, setParcelMenu] = useState<Parcel | null>(null);
  const more = useSheet();

  const leave = () => back('/r');

  // Chargement et erreur gardent l'en-tête et sa flèche : jamais d'écran sans sortie. Une relecture
  // ratée en arrière-plan (retour d'appli, réseau faible) garde la fiche déjà affichée.
  if (!deposit) {
    return <DepositLoadState title={t('rc_deposits')} onBack={leave} isLoading={isLoading} error={error} onRetry={() => void refetch()} />;
  }

  // Le miroir de reception_can_edit : le dépôt est à moi, ou je suis de l'équipe cargo.
  const cargo = hasPermission('canManageCargo');
  const mine = deposit.received_by === currentUser?.id || cargo;
  const cancelled = deposit.status === 'cancelled';
  const editable = deposit.status === 'open' && mine;
  // Terminé, devis déjà chez le client ou encaissé : le serveur ne laisse plus corriger qu'à l'équipe cargo.
  const quoteLocked = mine && quoteLocksParcels(deposit, cargo);
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
  /** Corriger un colis : s'il est à moi, pas encore parti, devis pas engagé. */
  const canEditParcel = (p: Parcel) => mine && !cancelled && !quoteLocked && !parcelLockReason(p);
  /** Toucher un colis : ses gestes s'il y en a, sinon ses photos. */
  const openParcel = (p: Parcel) => {
    if (canEditParcel(p) || (editable && !parcelLockReason(p))) setParcelMenu(p);
    else viewer.open(deposit.parcels.indexOf(p));
  };
  const supplier = depositSupplier(deposit);
  const actions: SheetAction[] = [
    { label: t('rc_sup_edit'), hint: supplier ? supplierLine(supplier) : t('rc_sup_none'), icon: Store, onClick: () => navigate(`/r/deposit/${deposit.id}/supplier?edit`), hidden: !editable },
    { label: t('rc_assign'), icon: UserSearch, onClick: () => navigate(assignPath(deposit.id, true)), hidden: !!deposit.client || cancelled },
    { label: t('rc_print_labels'), icon: Printer, onClick: () => setLabelsOpen(true), hidden: !deposit.client || deposit.parcels.length === 0 },
    { label: t('rc_dep_abandon'), icon: Trash2, danger: true, onClick: () => setAbandon(true), hidden: !(editable && deposit.parcels.length === 0) },
  ];
  const hasMore = actions.some((x) => !x.hidden);
  const placeLabel = deposit.location === 'warehouse' ? t('rc_warehouse_short') : t('rc_office_short');

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={deposit.deposit_no} onBack={leave} step={editable ? '4/4' : undefined} right={hasMore ? <MoreButton onClick={more.show} /> : undefined} />

      <div className="flex-1 px-5 pb-6 pt-4">
        {cancelled && <p className={cn('mb-4 rounded-lg px-4 py-3 text-[16px] font-semibold', TONE_PILL.danger)}>{t('rc_dep_cancelled')}</p>}
        {quoteLocked && <p className={cn('mb-4 rounded-lg px-4 py-3 text-[16px]', TONE_PILL.pending)}>{t('rc_dep_quote_locked')}</p>}
        {deposit.status === 'open' && !mine && (
          <p className={cn('mb-4 rounded-lg px-4 py-3 text-[16px]', TONE_PILL.pending)}>{ti('rc_dep_other_open', { name: deposit.received_by_name || t('rc_dep_colleague') })}</p>
        )}

        {/* Le client, en une carte ; sans client, un toucher l'attribue. */}
        <button
          type="button"
          disabled={!!deposit.client || cancelled}
          onClick={() => navigate(assignPath(deposit.id, true))}
          className="flex w-full items-center gap-3.5 rounded-lg border border-[#D9D9D9] px-4 py-3.5 text-left disabled:cursor-default dark:border-[#444444]"
        >
          {deposit.client ? <Initials name={name} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1C2] text-[18px] font-semibold text-[#682D03]">?</span>}
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{name}</span>
            <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{[deposit.client?.customer_code, deposit.client?.account_name, placeLabel].filter(Boolean).join(' · ')}</span>
          </span>
          <Tag tone={st.tone === 'info' ? 'pending' : st.tone}>{st.label}</Tag>
        </button>

        <CapsLabel className="mt-6">{labels.parcels(deposit.parcels.length)} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}</CapsLabel>
        {deposit.parcels.length === 0 ? (
          <EmptyLine>{t('rc_no_parcel_yet')}</EmptyLine>
        ) : (
          <div className="mt-1">
            {deposit.parcels.map((p) => (
              <ParcelLine
                key={p.id}
                parcel={p}
                onClick={() => openParcel(p)}
                right={isParcelIncomplete(p) ? <Tag tone="pending">{t('rc_incomplete')}</Tag> : undefined}
              />
            ))}
          </div>
        )}
        {editable && (
          <ItemList className="-mx-5">
            <ItemRow leading={<IconCircle icon={Plus} />} title={t('rc_add_parcel')} onClick={() => navigate(`/r/deposit/${deposit.id}/parcel`)} />
          </ItemList>
        )}

        <KVBox
          className="mt-5"
          rows={[
            { label: t('rc_sup_label'), value: supplier ? supplier.name : t('rc_sup_none'), onClick: editable ? () => navigate(`/r/deposit/${deposit.id}/supplier?edit`) : undefined },
            { label: t('rc_brought_by'), value: `${labels.broughtBy(deposit.brought_by)}${deposit.representative_name ? ` · ${deposit.representative_name}` : ''}` },
            { label: t('rc_received_by'), value: `${deposit.received_by_name ?? '—'} · ${formatDateTime(deposit.opened_at)}` },
          ]}
        />
      </div>

      {editable ? (
        <Dock>
          {deposit.parcels.length > 0
            ? <BigButton onClick={() => setConfirm(true)}>{ti('rc_finish_n', { count: deposit.parcels.length })}</BigButton>
            : <BigButton onClick={() => navigate(`/r/deposit/${deposit.id}/parcel`)}>{t('rc_add_parcel')}</BigButton>}
        </Dock>
      ) : deposit.status === 'closed' && deposit.client && deposit.parcels.length > 0 ? (
        <Dock><BigButton onClick={() => setLabelsOpen(true)}>{t('rc_print_labels')} ({deposit.parcels.length})</BigButton></Dock>
      ) : null}

      <ActionSheet open={more.open} onClose={more.hide} title={deposit.deposit_no} actions={actions} />
      <ActionSheet
        open={parcelMenu != null}
        onClose={() => setParcelMenu(null)}
        title={parcelMenu?.parcel_no}
        actions={parcelMenu ? [
          { label: t('rc_edit_parcel'), icon: Pencil, onClick: () => navigate(`/r/deposit/${deposit.id}/parcel/${parcelMenu.id}`), hidden: !canEditParcel(parcelMenu) },
          { label: t('rc_v2_photos'), icon: Images, onClick: () => viewer.open(deposit.parcels.indexOf(parcelMenu)) },
          { label: t('rc_remove'), icon: Trash2, danger: true, onClick: () => setRemoving(parcelMenu), hidden: !(editable && !parcelLockReason(parcelMenu)) },
        ] : []}
      />

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('rc_close_confirm')}
        subtitle={name}
        rows={[{ label: t('rc_parcels'), value: labels.parcels(deposit.parcels.length) }, { label: t('rc_weight'), value: formatKg(deposit.total_weight_kg) }, { label: t('rc_volume'), value: formatCbm(deposit.total_cbm) }]}
        confirmLabel={t('rc_finish')}
        cancelLabel={t('rc_cancel')}
        loading={close.isPending}
        onConfirm={() => void finish()}
      />
      <ConfirmSheet
        open={removing !== null}
        danger
        onClose={() => setRemoving(null)}
        title={ti('rc_remove_confirm_title', { no: removing?.parcel_no ?? '' })}
        subtitle={removing ? `${removing.description ?? labels.kind(removing.kind)} · ${formatKg(removing.weight_kg)}` : undefined}
        confirmLabel={t('rc_remove')}
        cancelLabel={t('rc_cancel')}
        loading={remove.isPending}
        onConfirm={doRemove}
      />
      <ConfirmSheet
        open={abandon}
        danger
        onClose={() => setAbandon(false)}
        title={t('rc_dep_abandon')}
        subtitle={deposit.deposit_no}
        confirmLabel={t('rc_dep_abandon')}
        cancelLabel={t('rc_cancel')}
        loading={cancel.isPending}
        onConfirm={doAbandon}
      />

      {deposit.client && <InternalLabelSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
      <ParcelPhotoViewer parcels={deposit.parcels} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={deposit.deposit_no} />
    </div>
  );
}
