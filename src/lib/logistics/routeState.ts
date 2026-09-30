/**
 * L'état de la page Routes tient dans l'URL (comme le simulateur) : un trajet
 * se partage sur WhatsApp tel quel. Tout ce qui arrive de l'URL est vérifié.
 *   ?m=sea&o=CNNSA&p=CMKBI&d=yaounde&i=road&w=1000
 */
import { AIR_ORIGINS, DESTINATIONS, SEA_ORIGINS, TO_AIR, TO_SEA, railAvailable, type Destination, type Inland, type Mode, type SeaPort } from './atlas';

export interface RouteState { mode: Mode; origin: string; port: SeaPort; destination: Destination; inland: Inland; weight: string }

export const DEFAULT_ROUTE: RouteState = { mode: 'sea', origin: 'CNNSA', port: 'CMKBI', destination: 'douala', inland: 'road', weight: '1000' };
/** Au-delà, ce n'est plus un envoi mais une flotte : on borne pour que l'écran reste lisible. */
export const MAX_WEIGHT_KG = 100_000;

const origins = (mode: Mode) => (mode === 'sea' ? SEA_ORIGINS : AIR_ORIGINS).map((o) => o.code);

export function parseRouteState(p: URLSearchParams): RouteState {
  const mode: Mode = p.get('m') === 'air' ? 'air' : 'sea';
  const o = (p.get('o') ?? '').toUpperCase();
  const origin = origins(mode).includes(o) ? o : mode === 'sea' ? DEFAULT_ROUTE.origin : 'CAN';
  const port: SeaPort = p.get('p') === 'CMDLA' ? 'CMDLA' : 'CMKBI';
  const d = p.get('d') ?? '';
  const destination = (d in DESTINATIONS ? d : DEFAULT_ROUTE.destination) as Destination;
  const inland: Inland = p.get('i') === 'rail' ? 'rail' : 'road';
  const w = (p.get('w') ?? '').replace(/\D/g, '').slice(0, 6);
  return { mode, origin, port, destination, inland, weight: w || DEFAULT_ROUTE.weight };
}

export function serializeRouteState(s: RouteState): string {
  const q = new URLSearchParams({ m: s.mode, o: s.origin, d: s.destination, w: s.weight || '0' });
  if (s.mode === 'sea') q.set('p', s.port);
  if (s.inland === 'rail') q.set('i', 'rail');
  return q.toString();
}

/** Le poids saisi, en kg : entier, borné, 0 si vide. */
export const weightKg = (s: RouteState) => Math.min(MAX_WEIGHT_KG, Number.parseInt(s.weight || '0', 10) || 0);

/** L'arrivée au Cameroun que prendra ce trajet (port, ou aéroport de Douala / Nsimalen). */
export const arrivalOf = (s: Pick<RouteState, 'mode' | 'port' | 'destination'>) =>
  s.mode === 'sea' ? s.port : s.destination === 'yaounde' ? 'NSI' : 'DLA';

/** Le rail est-il proposable pour cet état ? */
export const canRail = (s: Pick<RouteState, 'mode' | 'port' | 'destination'>) => railAvailable(arrivalOf(s), s.destination);

/** Changer de mode garde la même ville de départ quand elle existe dans l'autre mode. */
export function switchMode(s: RouteState, mode: Mode): RouteState {
  if (mode === s.mode) return s;
  return { ...s, mode, origin: (mode === 'air' ? TO_AIR : TO_SEA)[s.origin] ?? origins(mode)[0] };
}
