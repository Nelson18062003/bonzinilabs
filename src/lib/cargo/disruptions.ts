/**
 * Un conteneur tel que la veille douane le lit (src/lib/customs/notices.ts) :
 * ses ports, son statut, et le départ et l'arrivée qu'on retient.
 */
import { bestEta, bestEtd, type CargoShipment } from './model';
import type { ShipmentLike } from '@/lib/customs/notices';

export function toShipmentLike(s: CargoShipment): ShipmentLike {
  return {
    id: s.id,
    container_number: s.container_number,
    client_label: s.client_label,
    pol_unlocode: s.pol_unlocode,
    pod_unlocode: s.pod_unlocode,
    status: s.status,
    etd: bestEtd(s),
    eta: bestEta(s).date,
  };
}
