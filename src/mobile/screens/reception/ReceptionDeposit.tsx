// ============================================================
// RÉCEPTION — Le dépôt. Le client en haut, les colis déjà enregistrés en
// liste, deux gestes en bas : « Ajouter un colis » (un écran à lui) et
// « Terminer le dépôt » (confirmation, puis le reçu). Un dépôt sans client
// se voit tout de suite, avec le bouton pour l'attribuer.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, UserSearch } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatCbm, formatKg, initials } from '@/lib/reception';
import { useCloseDeposit, useReceptionDeposit, useRemoveParcel } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, Card, Holder, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatusPill } from '@/mobile/designKit';
import { LocationMark, ParcelRow, useReceptionLabels } from '@/mobile/components/reception/bits';

export function ReceptionDeposit() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const remove = useRemoveParcel();
  const close = useCloseDeposit();
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !deposit) return <ScreenError description={(error as Error | null)?.message ?? 'Dépôt introuvable'} onRetry={() => void refetch()} />;

  const editable = deposit.status === 'open';
  const name = deposit.client ? clientFullName(deposit.client) : t('rc_unknown_client');
  const st = labels.status(deposit);

  const finish = async () => {
    const dep = await close.mutateAsync({ depositId: deposit.id });
    setConfirm(false);
    navigate(`/r/deposit/${dep.id}/done`, { replace: true });
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={deposit.deposit_no} subtitle={labels.location(deposit.location)} showBack backTo="/r" />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        {/* Le client */}
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <Holder size="lg" tone={deposit.client ? 'neutral' : 'pending'}>{deposit.client ? initials(name) : '?'}</Holder>
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
              <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>
                {deposit.client ? [deposit.client.customer_code, deposit.client.phone, deposit.client.city].filter(Boolean).join(' · ') : t('rc_pending')}
              </span>
            </span>
            {deposit.client && <StatusPill tone={st.tone} label={st.label} />}
          </div>
          <div className={cn('flex items-center justify-between gap-3 border-t pt-4', SURFACE.divider, TYPE.body)}>
            <span className={TEXT.muted}>{t('rc_brought_by')}</span>
            <span className={cn('text-right font-semibold', TEXT.strong)}>
              {labels.broughtBy(deposit.brought_by)}
              {deposit.representative_name && <span className={cn('block font-normal', TYPE.small, TEXT.muted)}>{deposit.representative_name}{deposit.representative_phone ? ` · ${deposit.representative_phone}` : ''}</span>}
            </span>
          </div>
          <div className={cn('flex items-center justify-between gap-3 border-t pt-4', SURFACE.divider, TYPE.body)}>
            <span className={TEXT.muted}>{t('rc_mode')}</span>
            <span className={cn('inline-flex items-center gap-2 font-semibold', TEXT.strong)}><LocationMark location={deposit.location} size={24} />{labels.location(deposit.location)}</span>
          </div>
          {!deposit.client && (
            <Button variant="neutral" className="h-12 w-full" onClick={() => navigate(`/r/new?assign=${deposit.id}`)}>
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
                <ParcelRow key={p.id} parcel={p} onRemove={editable ? () => remove.mutate(p.id) : undefined} />
              ))}
            </Card>
          )}
        </section>
      </div>

      <div className={cn('shrink-0 space-y-3 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4', SURFACE.canvas, SURFACE.divider)}>
        <div className={cn('flex items-center justify-between', TYPE.body)}>
          <span className={TEXT.muted}>{t('rc_total')}</span>
          <span className={cn('font-semibold tabular-nums', TEXT.strong)}>
            {deposit.parcels.length} {t('rc_parcels').toLowerCase()} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}
          </span>
        </div>
        {editable ? (
          <div className="grid grid-cols-2 gap-3">
            <PrimaryPill onClick={() => navigate(`/r/deposit/${deposit.id}/parcel`)} className="h-14 text-[16px]"><Plus /> {t('rc_add_parcel')}</PrimaryPill>
            <SoftPill onClick={() => setConfirm(true)} disabled={deposit.parcels.length === 0} className="h-14 text-[16px]">{t('rc_finish')}</SoftPill>
          </div>
        ) : (
          <PrimaryPill onClick={() => navigate(`/r/deposit/${deposit.id}/done`)} className="h-14 w-full text-[16px]">{t('rc_print_labels')}</PrimaryPill>
        )}
      </div>

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title={t('rc_close_confirm')}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_close_hint')}</p>
          <Card className={cn(SURFACE.inset, 'border-0')}>
            <div className={cn('flex items-center justify-between', TYPE.body)}>
              <span className={TEXT.muted}>{name}</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{deposit.parcels.length} {t('rc_parcels').toLowerCase()} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}</span>
            </div>
          </Card>
          <PrimaryPill onClick={() => void finish()} loading={close.isPending} className="h-14 w-full text-[17px]">{t('rc_finish')}</PrimaryPill>
          <SoftPill onClick={() => setConfirm(false)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>
    </div>
  );
}
