import { differenceInCalendarDays } from 'date-fns';
import { bestEta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';

/** Les quatre chiffres de la flotte, calculés une fois pour desktop et mobile. */
export function computeKpis(shipments: CargoShipment[], now = new Date()) {
  const active = shipments.filter((s) => s.status !== 'DELIVERED');
  const atSea = active.filter((s) => s.status === 'AT_SEA').length;
  const soon = active.filter((s) => {
    const { date } = bestEta(s);
    if (!date) return false;
    const d = differenceInCalendarDays(date, now);
    return d >= 0 && d <= 7;
  }).length;
  const unpaid = active.filter((s) => !s.freight_paid).reduce((sum, s) => sum + (s.freight_usd ?? 0), 0);
  const noTelex = active.filter((s) => !s.telex_released).length;
  const untracked = active.filter((s) => s.status === 'UNKNOWN').length;
  return { total: active.length, atSea, soon, unpaid, noTelex, untracked };
}

