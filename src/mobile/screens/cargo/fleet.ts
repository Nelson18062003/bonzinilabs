/**
 * La flotte, lue pour la refonte v2 (maquettes 04/01 et 10/30) : les files
 * de l'ordinateur (Tous · En mer · Sous 7 j · À régler · Sans suivi · Livré),
 * le tag d'une ligne, l'export CSV. Une seule définition pour l'accueil Cargo
 * et la liste complète.
 */
import { CARRIER_LABEL, arrivalPort, bestEta, daysUntilArrival, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { exportToCSV } from '@/lib/exportCSV';
import type { Tone } from '@/mobile/designKit';

export type Bucket = 'all' | 'route' | 'soon' | 'unpaid' | 'untracked' | 'delivered';
export const BUCKETS: ReadonlyArray<{ value: Bucket; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'route', label: 'En mer' },
  { value: 'soon', label: 'Sous 7 j' },
  { value: 'unpaid', label: 'À régler' },
  { value: 'untracked', label: 'Sans suivi' },
  { value: 'delivered', label: 'Livré' },
];

/** Même définition que le tableau de l'ordinateur (DesktopCargoScreen). */
export function inBucket(s: CargoShipment, b: Bucket): boolean {
  if (b === 'delivered') return s.status === 'DELIVERED';
  if (s.status === 'DELIVERED' && b !== 'all') return false;
  switch (b) {
    case 'route': return s.status === 'AT_SEA';
    case 'soon': { const d = daysUntilArrival(s); return d != null && d >= 0 && d <= 7; }
    case 'unpaid': return !s.freight_paid || !s.telex_released;
    case 'untracked': return s.status === 'UNKNOWN';
    default: return true;
  }
}

/** Le tag d'une ligne : ce qui compte d'abord (retard, télex, fret), sinon l'état. */
export function shipmentTag(s: CargoShipment): { tone: Tone; label: string } {
  if (s.status === 'DELIVERED') return { tone: 'neutral', label: 'Livré' };
  if (s.status === 'ARRIVED') return { tone: 'success', label: 'Arrivé' };
  if (s.status === 'UNKNOWN') return { tone: 'neutral', label: 'Sans suivi' };
  const slip = etaSlipDays(s);
  if (slip > 0) return { tone: 'danger', label: `+${slip} j` };
  const days = daysUntilArrival(s);
  if (!s.freight_paid) return { tone: 'pending', label: 'Fret à régler' };
  if (!s.telex_released && days != null && days <= 10) return { tone: 'pending', label: 'Télex' };
  return { tone: 'success', label: 'À l’heure' };
}

/** « Groupage · Douala 28 oct. » ou « pas encore parti ». */
export function shipmentLine(s: CargoShipment): string {
  if (s.status === 'UNKNOWN' && !s.etd_actual) return `${s.client_label} · pas encore parti`;
  return `${s.client_label} · ${arrivalPort(s)} ${fmtDay(bestEta(s).date)}`;
}

/** « MIEU 3611115 » : le préfixe du propriétaire, puis le numéro. */
export const boxNo = (n: string): string => (/^[A-Z]{4}\d+$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4)}` : n);

export function exportFleetCsv(rows: CargoShipment[]): void {
  exportToCSV(
    rows.map((s) => ({ client: s.client_label, conteneur: s.container_number, bl: s.bl_number, armateur: CARRIER_LABEL[s.carrier] ?? s.carrier, navire: s.vessel_name ?? '', voyage: s.voyage ?? '', depart_promis: s.etd_promised ?? '', depart_reel: s.etd_actual?.slice(0, 10) ?? '', arrivee_promise: s.eta_promised ?? '', arrivee_armateur: s.eta_carrier?.slice(0, 10) ?? '', destination: s.pod_name, statut: statusMeta(s.status).label, fret_usd: s.freight_usd ?? '', fret_regle: s.freight_paid ? 'oui' : 'non', telex: s.telex_released ? 'oui' : 'non' })),
    [{ key: 'client', header: 'Client' }, { key: 'conteneur', header: 'Conteneur' }, { key: 'bl', header: 'B/L' }, { key: 'armateur', header: 'Armateur' }, { key: 'navire', header: 'Navire' }, { key: 'voyage', header: 'Voyage' }, { key: 'depart_promis', header: 'Départ promis' }, { key: 'depart_reel', header: 'Départ réel' }, { key: 'arrivee_promise', header: 'Arrivée promise' }, { key: 'arrivee_armateur', header: 'Arrivée armateur' }, { key: 'destination', header: 'Destination' }, { key: 'statut', header: 'Statut' }, { key: 'fret_usd', header: 'Fret (USD)' }, { key: 'fret_regle', header: 'Fret réglé' }, { key: 'telex', header: 'Télex' }],
    `bonzini-cargo-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}
