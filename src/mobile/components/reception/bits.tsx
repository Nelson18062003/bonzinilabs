// ============================================================
// RÉCEPTION — les petites pièces que plusieurs écrans partagent : la marque
// du lieu (Sea / Air, la même que sur l'étiquette), la ligne d'un dépôt, la
// ligne d'un colis, le libellé d'un mode d'arrivée ou d'un type de colis.
// ============================================================
import { Camera, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentLocale } from '@/i18n';
import { DESTINATION_THEME } from '@/lib/customerCode';
import { ICON_PATHS } from '@/lib/shippingLabelCanvas';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Holder, StatusPill, type Tone } from '@/mobile/designKit';
import { useParcelPhotoUrl } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatDims, formatKg, initials, isParcelIncomplete, type BroughtBy, type Deposit, type Parcel, type ParcelKind, type ReceptionLocation } from '@/lib/reception';

/** Sea (bateau bleu) ou Air (avion rouge) : exactement la silhouette de l'étiquette. */
export function LocationMark({ location, size = 28, className }: { location: ReceptionLocation; size?: number; className?: string }) {
  const theme = DESTINATION_THEME[location];
  const icon = ICON_PATHS[theme.icon];
  return (
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center rounded-lg', className)} style={{ width: size, height: size, background: theme.color }}>
      <svg viewBox={`0 0 ${icon.grid} ${icon.grid}`} width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} fill="#FFFFFF"><path d={icon.d} /></svg>
    </span>
  );
}

export function useReceptionLabels() {
  const { t } = useTranslation('agent');
  return {
    location: (l: ReceptionLocation) => (l === 'warehouse' ? t('rc_warehouse') : t('rc_office')),
    broughtBy: (b: BroughtBy) => t(`rc_by_${b}`),
    kind: (k: ParcelKind) => t(`kind_${k}`),
    status: (d: Deposit): { tone: Tone; label: string } =>
      !d.client ? { tone: 'pending', label: t('rc_status_unassigned') }
      : d.status === 'open' ? { tone: 'info', label: t('rc_status_open') }
      : { tone: 'success', label: t('rc_status_closed') },
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(getCurrentLocale(), { hour: '2-digit', minute: '2-digit' });
}
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(getCurrentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Une ligne de dépôt dans une liste : qui, combien, quand, dans quel état. */
export function DepositRow({ deposit, onClick }: { deposit: Deposit; onClick?: () => void }) {
  const { t } = useTranslation('agent');
  const labels = useReceptionLabels();
  const name = deposit.client ? clientFullName(deposit.client) : t('rc_unknown_client');
  const st = labels.status(deposit);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cn('flex w-full items-center gap-4 py-4 text-left', onClick && 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
      <Holder size="lg" tone={deposit.client ? 'neutral' : 'pending'}>{deposit.client ? initials(name) : '?'}</Holder>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className={cn('truncate', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
          <span className={cn('shrink-0 tabular-nums', TYPE.small, TEXT.muted)}>{formatTime(deposit.opened_at)}</span>
        </span>
        <span className={cn('mt-1 flex items-center justify-between gap-3', TYPE.small, TEXT.muted)}>
          <span className="truncate tabular-nums">
            {deposit.parcel_count} {t('rc_parcels').toLowerCase()} · {formatKg(deposit.total_weight_kg)} · {formatCbm(deposit.total_cbm)}
          </span>
          <StatusPill tone={st.tone} label={st.label} className="h-7 text-[14px]" />
        </span>
      </span>
    </Tag>
  );
}

function ParcelThumb({ path }: { path: string | null }) {
  const { data: url } = useParcelPhotoUrl(path);
  return (
    <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg', SURFACE.inset)}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Camera className={cn('h-5 w-5', TEXT.faint)} />}
    </span>
  );
}

/** Une ligne de colis : photo, numéro, description, poids × dimensions = volume. */
export function ParcelRow({ parcel, onRemove }: { parcel: Parcel; onRemove?: () => void }) {
  const { t } = useTranslation('agent');
  const labels = useReceptionLabels();
  const incomplete = isParcelIncomplete(parcel);
  return (
    <div className="flex items-center gap-4 py-4">
      <ParcelThumb path={parcel.photo_path} />
      <span className="min-w-0 flex-1">
        <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>
          <span className={cn('mr-2 tabular-nums', TEXT.muted)}>{String(parcel.seq).padStart(2, '0')}</span>
          {parcel.description || labels.kind(parcel.kind)}
        </span>
        <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>
          {formatKg(parcel.weight_kg)} · {formatDims(parcel)} · {formatCbm(parcel.cbm)}
        </span>
        {incomplete && <StatusPill tone="pending" label={t('rc_incomplete')} className="mt-2 h-7 text-[14px]" />}
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('rc_remove')} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
          <Trash2 className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
