/**
 * Bonzini Cargo — modèle partagé (desktop + mobile).
 *
 * Tout le vocabulaire visible à l'écran vient d'ici : un dossier se lit
 * « conteneur de GAUSS, sur le CMA CGM PRIDE, arrive à Kribi le 18 oct. »,
 * jamais en codes DCSA. Les codes restent dans cargo_events pour l'audit.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import type { Tone } from '@/mobile/designKit';

export type CargoShipment = Database['public']['Tables']['cargo_shipments']['Row'];
export type CargoEvent = Database['public']['Tables']['cargo_events']['Row'];
export type CargoVesselPosition = Database['public']['Tables']['cargo_vessel_positions']['Row'];

export type CargoStatus = 'BOOKED' | 'AT_ORIGIN' | 'AT_SEA' | 'ARRIVED' | 'DELIVERED' | 'UNKNOWN';

export const STATUS_META: Record<CargoStatus, { label: string; tone: Tone }> = {
  BOOKED: { label: 'Réservé', tone: 'pending' },
  AT_ORIGIN: { label: 'Au port de départ', tone: 'pending' },
  AT_SEA: { label: 'En mer', tone: 'info' },
  ARRIVED: { label: 'Arrivé au port', tone: 'success' },
  DELIVERED: { label: 'Livré', tone: 'neutral' },
  UNKNOWN: { label: 'Sans suivi', tone: 'danger' },
};

export function statusMeta(status: string): { label: string; tone: Tone } {
  return STATUS_META[(status as CargoStatus) in STATUS_META ? (status as CargoStatus) : 'UNKNOWN'];
}

export const CARRIER_LABEL: Record<string, string> = {
  MAERSK: 'Maersk',
  CMA_CGM: 'CMA CGM',
  MSC: 'MSC',
  COSCO: 'COSCO',
  OTHER: 'Autre',
};

/** La date d'arrivée à afficher : celle de l'armateur si on l'a, sinon la promesse. */
export function bestEta(s: CargoShipment): { date: Date | null; source: 'carrier' | 'promised' | null } {
  if (s.eta_carrier) return { date: new Date(s.eta_carrier), source: 'carrier' };
  if (s.eta_promised) return { date: new Date(s.eta_promised + 'T12:00:00'), source: 'promised' };
  return { date: null, source: null };
}

export function bestEtd(s: CargoShipment): Date | null {
  if (s.etd_actual) return new Date(s.etd_actual);
  if (s.etd_promised) return new Date(s.etd_promised + 'T12:00:00');
  return null;
}

/** Jours de retard de l'armateur par rapport à la promesse du transitaire (0 si aucun). */
export function etaSlipDays(s: CargoShipment): number {
  if (!s.eta_carrier || !s.eta_promised) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(s.eta_carrier), new Date(s.eta_promised + 'T12:00:00')));
}

/** Avancement du voyage : jour courant / durée totale, borné pour rester lisible. */
export function voyageProgress(s: CargoShipment, now = new Date()): { day: number; total: number; pct: number } | null {
  const etd = bestEtd(s);
  const { date: eta } = bestEta(s);
  if (!etd || !eta) return null;
  const total = Math.max(1, differenceInCalendarDays(eta, etd));
  const day = Math.max(0, Math.min(total, differenceInCalendarDays(now, etd)));
  const pct = s.status === 'ARRIVED' || s.status === 'DELIVERED' ? 100 : Math.max(3, Math.min(97, Math.round((day / total) * 100)));
  return { day, total, pct };
}

export function fmtDay(d: Date | null | undefined): string {
  return d ? format(d, 'd MMM', { locale: fr }) : '—';
}

export function fmtDayTime(d: Date | null | undefined): string {
  return d ? format(d, 'd MMM HH:mm', { locale: fr }) : '—';
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Math.round(n).toLocaleString('fr-FR')} $`;
}

/** Carte live du navire (VesselFinder, gratuit) — la seule vraie « position en direct » sans abonnement AIS. */
export function liveVesselUrl(imo: string | null | undefined): string | null {
  return imo ? `https://www.vesselfinder.com/?imo=${encodeURIComponent(imo)}` : null;
}

/** Une position AIS de plus de 3 jours est « ancienne » : le navire est en plein océan, hors couverture. */
export function isStalePosition(p: CargoVesselPosition, now = new Date()): boolean {
  return differenceInCalendarDays(now, new Date(p.reported_at)) > 3;
}

/* ── Géographie de la ligne Chine → Cameroun (WAX1) ────────────────────────
 * Tournée : Nansha → Singapour → (Colombo) → cap de Bonne-Espérance → Abidjan
 * → Lekki → Kribi. Tracé indicatif pour la carte : les positions réelles des
 * navires, elles, viennent de cargo_vessel_positions. */
export type LatLng = [number, number];

export const PORTS: Record<string, { name: string; pos: LatLng }> = {
  CNNSA: { name: 'Nansha', pos: [22.637, 113.676] },
  SGSIN: { name: 'Singapour', pos: [1.29, 103.8] },
  CIABJ: { name: 'Abidjan', pos: [5.33, -4.02] },
  NGLKK: { name: 'Lekki', pos: [6.43, 3.98] },
  CMKBI: { name: 'Kribi', pos: [2.936, 9.909] },
  CMDLA: { name: 'Douala', pos: [4.05, 9.7] },
};

export const WAX1_ROUTE: LatLng[] = [
  [22.637, 113.676], [21.8, 113.6], [19.0, 112.5], [15.0, 110.5], [8.0, 107.5], [1.5, 104.6],
  [2.8, 101.0], [5.5, 98.0], [5.0, 93.0], [0.0, 80.0], [-15.0, 60.0], [-28.0, 48.0], [-33.0, 35.0],
  [-36.0, 22.0], [-34.3, 17.5], [-28.0, 13.5], [-20.4, 9.9], [-12.0, 8.5], [-3.0, 6.0], [2.0, 2.0],
  [4.5, -3.5], [5.33, -4.02], [4.2, -1.5], [5.4, 2.5], [6.43, 3.98], [4.6, 5.0], [2.8, 8.0], [2.6, 9.5], [2.936, 9.909],
];
