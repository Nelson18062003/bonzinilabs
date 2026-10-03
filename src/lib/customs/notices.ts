/**
 * La veille douane — le « regulatory watch » et la « disruptions layer » de
 * Flexport, pour un importateur camerounais (docs/douane/00-plan.md, étape 6).
 *
 * Un avis est soit un changement de texte (réglementation), soit un
 * événement qui retarde la marchandise (perturbation). Ce module dit :
 *   - où en est un avis aujourd'hui (en vigueur, annoncé, en cours, à venir…) ;
 *   - quels produits d'un client il vise (préfixes SH) ;
 *   - quels conteneurs il touche (lieu UN/LOCODE × date de départ ou d'arrivée).
 * Pur : aucune lecture de base. Les avis viennent de customs_notices
 * (migration 20260930090000).
 */
import type { Confidence } from './levies';
import { hsDigits } from './hsCode';

export type NoticeKind = 'regulation' | 'disruption';
export type NoticeStatus = 'in_force' | 'announced' | 'watch';

export interface Notice {
  id: string;
  slug: string;
  kind: NoticeKind;
  title: string;
  summary: string;
  advice: string | null;
  status: NoticeStatus;
  severity: 'low' | 'medium' | 'high';
  /** AAAA-MM-JJ */
  starts_on: string | null;
  ends_on: string | null;
  delay_days: number | null;
  hs_specs: string[];
  places: string[];
  source_label: string | null;
  source_url: string | null;
  confidence: Confidence;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Où en est l'avis :
 *   réglementation — in_force (en vigueur), announced (adopté ou annoncé, pas
 *                    encore appliqué, ou date future), watch (à confirmer) ;
 *   perturbation   — upcoming, ongoing, past.
 */
export type Phase = 'in_force' | 'announced' | 'watch' | 'upcoming' | 'ongoing' | 'past';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const todayUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const DAY = 86_400_000;

export function phaseOf(n: Pick<Notice, 'kind' | 'status' | 'starts_on' | 'ends_on'>, today = new Date()): Phase {
  const t = todayUtc(today);
  if (n.kind === 'regulation') {
    if (n.status === 'in_force' && n.starts_on && day(n.starts_on) > t) return 'announced';
    return n.status;
  }
  if (n.starts_on && day(n.starts_on) > t) return 'upcoming';
  if (n.ends_on && day(n.ends_on) < t) return 'past';
  return 'ongoing';
}

/** Jours avant le début (perturbation à venir), ou null. */
export function daysUntilStart(n: Pick<Notice, 'starts_on'>, today = new Date()): number | null {
  return n.starts_on ? Math.round((day(n.starts_on) - todayUtc(today)) / DAY) : null;
}

/** L'ordre d'un fil : ce qui se passe maintenant, puis ce qui arrive bientôt, puis le reste ; le passé à la fin. */
export function sortNotices(list: Notice[], today = new Date()): Notice[] {
  const rank: Record<Phase, number> = { ongoing: 0, upcoming: 1, announced: 2, in_force: 3, watch: 4, past: 5 };
  const sev = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => {
    const pa = phaseOf(a, today), pb = phaseOf(b, today);
    if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
    if (pa === 'upcoming') return (a.starts_on ?? '').localeCompare(b.starts_on ?? '');
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
    return (b.starts_on ?? '').localeCompare(a.starts_on ?? '');
  });
}

// ─── Les produits visés ─────────────────────────────────────────────────────

/** L'avis vise-t-il ce code ? Un avis sans code vise tout le monde, pas un produit en particulier. */
export function noticeMatchesCode(n: Pick<Notice, 'hs_specs'>, code: string | null | undefined): boolean {
  const d = hsDigits(code ?? '');
  return d.length >= 2 && n.hs_specs.some((s) => d.startsWith(s) || (s.length > d.length && s.startsWith(d) && d.length >= 6));
}

/** Les avis réglementaires qui visent au moins un des codes, avec les codes visés. */
export function noticesForCodes(list: Notice[], codes: (string | null | undefined)[]): { notice: Notice; codes: string[] }[] {
  const clean = [...new Set(codes.map((c) => hsDigits(c ?? '')).filter((c) => c.length >= 4))];
  return list
    .filter((n) => n.kind === 'regulation' && n.hs_specs.length > 0)
    .map((notice) => ({ notice, codes: clean.filter((c) => noticeMatchesCode(notice, c)) }))
    .filter((x) => x.codes.length > 0);
}

// ─── Les conteneurs touchés ─────────────────────────────────────────────────

export interface ShipmentLike {
  id: string;
  container_number: string;
  client_label?: string | null;
  pol_unlocode: string | null;
  pod_unlocode: string | null;
  status: string;
  /** Le départ et l'arrivée retenus (armateur si connu, sinon promesse). */
  etd: Date | null;
  eta: Date | null;
}

export type ShipmentHit = { shipment: ShipmentLike; where: 'origin' | 'destination' };

const NOT_LEFT = new Set(['BOOKED', 'AT_ORIGIN', 'UNKNOWN']);
const ARRIVED = new Set(['ARRIVED', 'DELIVERED']);
/** Un conteneur qui part dans les trois jours autour d'une perturbation au départ la subit aussi. */
const MARGIN = 3 * DAY;

const placeMatches = (place: string, locode: string | null) =>
  !!locode && !place.includes('-') && locode.toUpperCase().startsWith(place.toUpperCase());

/** Ce conteneur est-il touché, et où ? Une perturbation passée ne touche plus personne. */
export function shipmentHit(n: Notice, s: ShipmentLike, today = new Date()): ShipmentHit['where'] | null {
  if (n.kind !== 'disruption' || !n.places.length || phaseOf(n, today) === 'past') return null;
  const start = n.starts_on ? day(n.starts_on) : todayUtc(today);
  const end = n.ends_on ? day(n.ends_on) + DAY - 1 : start + 30 * DAY;
  if (NOT_LEFT.has(s.status) && n.places.some((p) => placeMatches(p, s.pol_unlocode))) {
    const etd = s.etd?.getTime();
    if (etd != null ? etd >= start - MARGIN && etd <= end + MARGIN : phaseOf(n, today) === 'ongoing') return 'origin';
  }
  if (!ARRIVED.has(s.status) && n.places.some((p) => placeMatches(p, s.pod_unlocode))) {
    const eta = s.eta?.getTime();
    if (eta != null && eta >= start && eta <= end) return 'destination';
  }
  return null;
}

export function affectedShipments(n: Notice, list: ShipmentLike[], today = new Date()): ShipmentHit[] {
  return list.flatMap((shipment) => {
    const where = shipmentHit(n, shipment, today);
    return where ? [{ shipment, where }] : [];
  });
}

/** Les lieux, lisibles : « Chine », « Douala », « Kribi »… Le code reste si on ne le connaît pas. */
export const PLACE_FR: Record<string, string> = {
  CN: 'Chine', CM: 'Cameroun', CNSHA: 'Shanghai', CNNGB: 'Ningbo', CNSZX: 'Shenzhen', CNYTN: 'Yantian', CNNSA: 'Nansha',
  CNCAN: 'Guangzhou', CNXMN: 'Xiamen', CNTAO: 'Qingdao', CNTSN: 'Tianjin', CMDLA: 'Douala', CMKBI: 'Kribi', CMNSI: 'Yaoundé-Nsimalen',
  'CM-TD': 'Corridor Douala – N’Djamena', 'CM-CF': 'Corridor Douala – Bangui',
};
