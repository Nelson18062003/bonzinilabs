/**
 * Le parcours en une ligne : les escales de la tournée, ce qui est passé,
 * où est le navire, ce qui reste — la lecture la plus simple d'un voyage.
 */
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';
import { PORTS, WAX1_ROUTE, bestEta, fmtDay } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { nearestRouteIndex } from '@/lib/cargo/geo';

// Escales de la ligne WAX1, dans l'ordre, avec leur index sur la tournée.
const STOPS: { code: string; short: string }[] = [
  { code: 'CNNSA', short: 'Nansha' },
  { code: 'SGSIN', short: 'Singapour' },
  { code: 'CIABJ', short: 'Abidjan' },
  { code: 'NGLKK', short: 'Lekki' },
  { code: 'CMKBI', short: 'Kribi' },
];

export function CargoJourney({ shipment: s, position }: { shipment: CargoShipment; position: CargoVesselPosition | null }) {
  const stops = STOPS.filter((st) => st.code !== 'CMKBI' || s.pod_unlocode !== 'CMDLA').concat(s.pod_unlocode === 'CMDLA' ? [{ code: 'CMDLA', short: 'Douala' }] : []);
  const idx = stops.map((st) => nearestRouteIndex(PORTS[st.code].pos, WAX1_ROUTE));
  const vesselIdx = position ? nearestRouteIndex([position.latitude, position.longitude], WAX1_ROUTE) : s.status === 'ARRIVED' || s.status === 'DELIVERED' ? WAX1_ROUTE.length : s.status === 'AT_SEA' ? 1 : -1;
  const eta = bestEta(s);
  return (
    <ol className="flex items-start gap-0">
      {stops.map((st, i) => {
        const passed = vesselIdx > idx[i] + 1;
        const here = !passed && vesselIdx >= idx[i] - 1 && vesselIdx <= idx[i] + 1 && position != null;
        const last = i === stops.length - 1;
        const between = !last && vesselIdx > idx[i] + 1 && vesselIdx < idx[i + 1] - 1;
        return (
          <li key={st.code} className="relative flex min-w-0 flex-1 flex-col items-start">
            <div className="flex w-full items-center">
              <span className={cn('h-3 w-3 shrink-0 rounded-full border-2', passed ? 'border-foreground bg-foreground' : here ? 'border-primary bg-primary ring-4 ring-primary/20' : 'border-black/[0.25] bg-card dark:border-white/[0.3]')} />
              {!last && (
                <span className="relative mx-1 h-0.5 flex-1 rounded bg-black/[0.1] dark:bg-white/[0.12]">
                  {passed && vesselIdx >= idx[i + 1] - 1 && <span className="absolute inset-0 rounded bg-foreground" />}
                  {between && (
                    <>
                      <span className="absolute inset-y-0 left-0 rounded bg-foreground" style={{ width: `${Math.round(((vesselIdx - idx[i]) / Math.max(1, idx[i + 1] - idx[i])) * 100)}%` }} />
                      <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/20" style={{ left: `calc(${Math.round(((vesselIdx - idx[i]) / Math.max(1, idx[i + 1] - idx[i])) * 100)}% - 6px)` }} />
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="mt-1.5 pr-2">
              <div className={cn('text-[12px] font-semibold', passed || here ? TEXT.strong : TEXT.muted)}>{st.short}</div>
              <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>
                {i === 0 && (s.etd_actual ? fmtDay(new Date(s.etd_actual)) : s.etd_promised ? fmtDay(new Date(s.etd_promised + 'T12:00:00')) : '')}
                {last && (eta.date ? fmtDay(eta.date) : '')}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
