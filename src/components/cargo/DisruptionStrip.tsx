/**
 * La couche « perturbations » sur l'écran Cargo : les avis de la veille douane
 * (en cours, ou qui commencent dans le mois) qui touchent au moins un
 * conteneur de la flotte. Un toucher mène à l'avis. Session supabaseAdmin.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { affectedShipments, daysUntilStart, phaseOf } from '@/lib/customs/notices';
import { toShipmentLike } from '@/lib/cargo/disruptions';
import type { CargoShipment } from '@/lib/cargo/model';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { plural } from '@/lib/cargo/plain';

export function DisruptionStrip({ shipments, className }: { shipments: CargoShipment[]; className?: string }) {
  const navigate = useNavigate();
  const notices = useAdminNotices(shipments.length > 0);
  const rows = useMemo(() => {
    const fleet = shipments.map(toShipmentLike);
    return (notices.data ?? [])
      .filter((n) => n.published && n.kind === 'disruption')
      .filter((n) => phaseOf(n) === 'ongoing' || (phaseOf(n) === 'upcoming' && (daysUntilStart(n) ?? 99) <= 30))
      .map((n) => ({ n, hits: affectedShipments(n, fleet) }))
      .filter((x) => x.hits.length > 0);
  }, [notices.data, shipments]);

  if (!rows.length) return null;
  return (
    <div className={cn('space-y-2 px-4 pt-3', className)}>
      {rows.map(({ n, hits }) => {
        const inDays = phaseOf(n) === 'upcoming' ? daysUntilStart(n) : null;
        return (
          <button key={n.id} type="button" onClick={() => navigate(`/m/douane/veille#${n.slug}`)}
            className={cn('flex w-full items-center gap-3 rounded-lg border border-[#E8B931] p-3 text-left', SURFACE.card)}>
            <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-[#975102] dark:text-[#E8B931]" />
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{n.title}</span>
              <span className={cn('block', TYPE.small, TEXT.muted)}>
                {plural(hits.length, 'conteneur')} {hits.length > 1 ? 'concernés' : 'concerné'}
                {inDays != null ? ` · dans ${plural(inDays, 'jour')}` : ' · en cours'}
                {n.delay_days ? ` · ≈ ${plural(n.delay_days, 'jour')} de retard` : ''}
              </span>
            </span>
            <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
          </button>
        );
      })}
    </div>
  );
}
