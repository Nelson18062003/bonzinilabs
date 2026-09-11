/**
 * Géométrie de la carte Cargo : projection d'un navire sur la tournée,
 * portion parcourue / restante, statut vivant du navire, compteurs par port.
 */
import { PORTS, WAX1_ROUTE, isStalePosition } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition, LatLng } from '@/lib/cargo/model';

const R = 6371;
/** Distance grand-cercle en km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Index du point de la tournée le plus proche d'une position. */
export function nearestRouteIndex(p: LatLng, route: LatLng[] = WAX1_ROUTE): number {
  let best = 0;
  let bestD = Infinity;
  route.forEach((r, i) => {
    const d = distanceKm(p, r);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Index de la tournée où se trouve un port (par code UN/LOCODE). */
function portRouteIndex(unlocode: string | null | undefined, route: LatLng[]): number | null {
  const port = unlocode ? PORTS[unlocode] : null;
  if (!port) return null;
  return nearestRouteIndex(port.pos, route);
}

/** Trait plein (parcouru) et pointillé (restant) d'un navire sur la tournée. */
export function vesselTrack(
  position: LatLng,
  podUnlocode: string | null | undefined,
  route: LatLng[] = WAX1_ROUTE,
): { sailed: LatLng[]; remaining: LatLng[] } {
  const i = nearestRouteIndex(position, route);
  const end = portRouteIndex(podUnlocode, route) ?? route.length - 1;
  const sailed = [...route.slice(0, i + 1), position];
  const remaining = i < end ? [position, ...route.slice(i + 1, end + 1)] : [position];
  return { sailed, remaining };
}

export type VesselLiveStatus = 'underway' | 'moored' | 'anchored' | 'stale';

/** Statut vivant, façon Atlas : en route / à quai / au mouillage / hors couverture. */
export function vesselLiveStatus(p: CargoVesselPosition): VesselLiveStatus {
  if (isStalePosition(p)) return 'stale';
  const speed = p.speed_kn == null ? null : Number(p.speed_kn);
  if (speed == null || speed >= 1) return 'underway';
  const here: LatLng = [p.latitude, p.longitude];
  const nearPort = Object.values(PORTS).some((port) => distanceKm(here, port.pos) < 25);
  return nearPort ? 'moored' : 'anchored';
}

export const LIVE_STATUS_LABEL: Record<VesselLiveStatus, string> = {
  underway: 'En route',
  moored: 'À quai',
  anchored: 'Au mouillage',
  stale: 'Hors couverture',
};

/** Port le plus proche d'un navire, avec la distance (pour « prochain port »). */
export function nearestPort(p: LatLng): { code: string; name: string; km: number } {
  let best = { code: '', name: '', km: Infinity };
  for (const [code, port] of Object.entries(PORTS)) {
    const km = distanceKm(p, port.pos);
    if (km < best.km) best = { code, name: port.name, km };
  }
  return best;
}

/** Combien de nos conteneurs arrivent dans chaque port (et en partent). */
export function portCounts(shipments: CargoShipment[]): Record<string, { arriving: CargoShipment[]; departing: CargoShipment[] }> {
  const out: Record<string, { arriving: CargoShipment[]; departing: CargoShipment[] }> = {};
  for (const code of Object.keys(PORTS)) out[code] = { arriving: [], departing: [] };
  for (const s of shipments) {
    if (s.pod_unlocode && out[s.pod_unlocode]) out[s.pod_unlocode].arriving.push(s);
    if (s.pol_unlocode && out[s.pol_unlocode]) out[s.pol_unlocode].departing.push(s);
  }
  return out;
}
