/**
 * Un dossier conteneur, lu comme une phrase : QUI (client), QUOI (n° de boîte),
 * OÙ (navire + statut), QUAND (arrivée, et l'écart avec la promesse), et ce
 * qu'il reste à régler (fret, télex).
 */
import { ExternalLink, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TONE_PILL, RefChip } from '@/desktop/designKit';
import {
  CARRIER_LABEL,
  bestEta,
  bestEtd,
  etaSlipDays,
  fmtDay,
  fmtUsd,
  liveVesselUrl,
  statusMeta,
  voyageProgress,
} from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';

export function CargoShipmentCard({
  shipment: s,
  selected,
  onSelect,
}: {
  shipment: CargoShipment;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const meta = statusMeta(s.status);
  const eta = bestEta(s);
  const etd = bestEtd(s);
  const slip = etaSlipDays(s);
  const progress = voyageProgress(s);
  const live = liveVesselUrl(s.vessel_imo);
  const unknown = s.status === 'UNKNOWN';

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'rounded-xl p-4 text-left transition-colors',
        SURFACE.card,
        selected ? 'ring-2 ring-primary' : SURFACE.shadow,
        onSelect && 'cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('text-[15px] font-bold leading-tight', TEXT.strong)}>Conteneur de {s.client_label}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RefChip>{s.container_number}</RefChip>
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TONE_PILL.neutral)}>
              {CARRIER_LABEL[s.carrier] ?? s.carrier}
            </span>
          </div>
        </div>
        <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-bold', TONE_PILL[meta.tone])}>{meta.label}</span>
      </div>

      <div className={cn('mt-3 flex items-center gap-2 text-[13px]', TEXT.body)}>
        <Ship className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
        {s.vessel_name ? (
          <span className="truncate">
            Sur le <b className={TEXT.strong}>{s.vessel_name}</b>
            {s.voyage && <span className={TEXT.muted}> · {s.voyage}</span>}
          </span>
        ) : (
          <span className={TEXT.muted}>Navire inconnu — suivi {CARRIER_LABEL[s.carrier] ?? s.carrier} non branché</span>
        )}
      </div>

      {progress && (
        <div className="mt-3">
          <div className={cn('flex justify-between text-[11px]', TEXT.muted)}>
            <span>{s.pol_name ?? 'Chine'} · {fmtDay(etd)}</span>
            <span className={cn('font-semibold', TEXT.strong)}>
              {unknown ? `Jour ${progress.day} (non vérifié)` : `Jour ${progress.day} sur ${progress.total}`}
            </span>
            <span>{s.pod_name} · {fmtDay(eta.date)}</span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full', unknown ? 'bg-muted-foreground/40' : 'bg-gradient-to-r from-bonzini-violet to-bonzini-amber')}
              style={{ width: `${progress.pct}%` }}
            />
            <span
              className={cn(
                'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card',
                unknown ? 'bg-muted-foreground' : 'bg-bonzini-orange',
              )}
              style={{ left: `${progress.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('text-[13px]', TEXT.body)}>
          Arrive à <b className={TEXT.strong}>{s.pod_name}</b> le <b className={TEXT.strong}>{fmtDay(eta.date)}</b>
        </span>
        {slip > 0 && (
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', TONE_PILL.pending)}>+{slip} j vs promesse</span>
        )}
        {eta.source === 'promised' && <span className={cn('text-[11px]', TEXT.muted)}>date du transitaire, non vérifiée</span>}
      </div>

      <div className={cn('mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3 text-[12px] dark:border-white/[0.06]', TEXT.muted)}>
        <span className="tabular-nums">
          Fret {fmtUsd(s.freight_usd)} ·{' '}
          <span className={s.freight_paid ? 'text-emerald-600 dark:text-emerald-400' : 'font-semibold text-destructive'}>
            {s.freight_paid ? 'réglé' : 'non réglé'}
          </span>{' '}
          · télex{' '}
          <span className={s.telex_released ? 'text-emerald-600 dark:text-emerald-400' : 'font-semibold text-destructive'}>
            {s.telex_released ? 'oui' : 'non'}
          </span>
        </span>
        {live && (
          <a
            href={live}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-bonzini-orange hover:underline"
          >
            En direct <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
