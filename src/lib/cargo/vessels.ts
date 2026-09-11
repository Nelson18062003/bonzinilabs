import { isStalePosition } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';

export interface VesselOnMap {
  position: CargoVesselPosition;
  shipments: CargoShipment[];
  stale: boolean;
}

/** Regroupe les dossiers par navire : un marqueur par bateau, plusieurs boîtes dedans. */
export function groupVessels(shipments: CargoShipment[], positions: CargoVesselPosition[]): VesselOnMap[] {
  return positions
    .map((position) => ({
      position,
      shipments: shipments.filter((s) => s.vessel_imo === position.vessel_imo),
      stale: isStalePosition(position),
    }))
    .filter((v) => v.shipments.length > 0);
}

