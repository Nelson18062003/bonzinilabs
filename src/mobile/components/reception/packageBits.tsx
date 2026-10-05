// ============================================================
// RÉCEPTION — les pièces visuelles des paquets avion de 32 kg : la jauge de
// poids et la ligne d'un paquet (liste /r/paquets). Les textes partagés :
// packageText.ts.
// ============================================================
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatKg } from '@/lib/reception';
import { weightGauge, type AirPackage, type WeightGauge } from '@/lib/airPackage';
import { TEXT, TONE_TEXT, TYPE, StatusPill } from '@/mobile/designKit';
import { useReceptionLabels } from './bits';
import { GAUGE_TONE, usePackageText } from './packageText';

const GAUGE_FILL: Record<WeightGauge['tone'], string> = { ok: 'bg-[#14AE5C]', near: 'bg-[#E8B931]', full: 'bg-[#EC221F]' };

/** La jauge du paquet : ce que pèsent ses colis sur ses 32 kg. Neutre (encre) une fois le paquet fermé. */
export function WeightBar({ gauge, neutral, className }: { gauge: WeightGauge; neutral?: boolean; className?: string }) {
  const { t } = useTranslation('agent');
  const pct = gauge.net > 0 ? Math.max(gauge.ratio * 100, 2) : 0;
  return (
    <div
      role="meter"
      aria-label={t('rc_pk_net')}
      aria-valuemin={0}
      aria-valuemax={gauge.max}
      aria-valuenow={gauge.net}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-[#E3E3E3] dark:bg-[#444444]', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', neutral ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : GAUGE_FILL[gauge.tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Une ligne de la liste des paquets : le numéro en grand, colis et clients, la jauge, l'état. */
export function PackageRow({ pkg, onClick }: { pkg: AirPackage; onClick: () => void }) {
  const { t } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const g = weightGauge(pkg);
  const st = tx.status(pkg.status);
  const open = pkg.status === 'open';
  const expedition = tx.expedition(pkg);
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col gap-3 py-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn('block text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums', TEXT.strong)}>{pkg.package_no}</span>
          <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>{labels.parcels(pkg.parcel_count)} · {tx.clients(pkg.client_count)}</span>
        </span>
        <StatusPill tone={st.tone} label={st.label} className="h-7 text-[14px]" />
      </span>
      <span className="block">
        <WeightBar gauge={g} neutral={!open} />
        <span className="mt-1.5 flex items-baseline justify-between gap-3 tabular-nums">
          <span className={cn(TYPE.smallStrong, TEXT.strong)}>{formatKg(g.net)} / {formatKg(g.max)}</span>
          {open
            ? <span className={cn(TYPE.smallStrong, TONE_TEXT[GAUGE_TONE[g.tone]])}>{tx.left(g)}</span>
            : pkg.gross_weight_kg != null && <span className={cn(TYPE.small, TEXT.muted)}>{t('rc_pk_weighed', { kg: formatKg(pkg.gross_weight_kg) })}</span>}
        </span>
      </span>
      {pkg.status === 'refused' && pkg.refusal_reason && (
        <span className={cn('block break-words', TYPE.smallStrong, TONE_TEXT.danger)}>{t('rc_pk_refusal', { reason: pkg.refusal_reason })}</span>
      )}
      {expedition && <span className={cn('block break-words tabular-nums', TYPE.small, TEXT.muted)}>{expedition}</span>}
    </button>
  );
}
