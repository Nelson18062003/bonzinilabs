/**
 * Cargo en français de tous les jours.
 *
 * L'admin qui sort son téléphone n'est pas un logisticien : « POD · ETA ·
 * +14 j vs promesse » ne lui dit rien, « Arrive à Kribi le 11 octobre, dans
 * 28 jours. Retard de 14 jours. » lui dit tout. Ces phrases sont la seule
 * façon d'écrire l'état d'un conteneur sur mobile — le jargon (B/L, télex,
 * BESC) reste parce que ce sont les vrais noms des papiers, mais toujours
 * accompagné de ce qu'il sert à faire.
 */
import { differenceInHours, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { bestEta, bestEtd, daysUntilArrival, DOCUMENT_KINDS, etaSlipDays, fmtUsd, voyageProgress } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { nextSteps } from '@/lib/cargo/todo';

/** « 11 octobre » — le jour et le mois en toutes lettres, sans l'année. */
export const fmtDayLong = (d: Date | null | undefined): string | null => (d ? format(d, 'd MMMM', { locale: fr }) : null);

/** Une phrase en milieu de phrase : seule la première lettre baisse (« arrive à Kribi… »). */
export const uncap = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/** « 1 jour » / « 14 jours ». */
export const plural = (n: number, one: string, many: string = one + 's'): string => `${n} ${Math.abs(n) <= 1 ? one : many}`;

/** « Arrive à Kribi le 11 octobre, dans 28 jours ». */
export function arrivalSentence(s: CargoShipment, now = new Date()): string {
  const place = s.pod_name ?? 'destination inconnue';
  if (s.status === 'DELIVERED') return 'Livré';
  if (s.status === 'ARRIVED') return `Arrivé à ${place}`;
  const eta = bestEta(s).date;
  if (!eta) return `Arrivée à ${place} : date inconnue`;
  const days = daysUntilArrival(s, now);
  const when = days == null ? '' : days > 0 ? `, dans ${plural(days, 'jour')}` : days === 0 ? ", aujourd'hui" : `, il y a ${plural(-days, 'jour')}`;
  return `Arrive à ${place} le ${fmtDayLong(eta)}${when}`;
}

/** « Retard de 14 jours sur la date promise », ou rien. */
export function delaySentence(s: CargoShipment): string | null {
  const slip = etaSlipDays(s);
  return slip > 0 ? `Retard de ${plural(slip, 'jour')} sur la date promise` : null;
}

/** « Parti de Nansha le 15 août ». */
export function departureSentence(s: CargoShipment): string {
  const etd = bestEtd(s);
  const place = s.pol_name ? `de ${s.pol_name}` : '';
  if (!etd) return `Départ ${place} : date inconnue`.replace('  ', ' ');
  return `${s.etd_actual ? 'Parti' : 'Part'} ${place} le ${fmtDayLong(etd)}`.replace('  ', ' ');
}

/** « Nansha → Kribi, jour 29 sur 57 ». */
export function journeySentence(s: CargoShipment, now = new Date()): string {
  const legs = [s.pol_name, s.pod_name].filter(Boolean).join(' → ') || 'Trajet inconnu';
  const p = voyageProgress(s, now);
  return p ? `${legs}, jour ${p.day} sur ${p.total}` : legs;
}

/** « En mer, position d'il y a 2 jours ». */
export function whereSentence(s: CargoShipment, pos: CargoVesselPosition | null, now = new Date()): string {
  switch (s.status) {
    case 'DELIVERED': return 'Livré au client';
    case 'ARRIVED': return `Arrivé au port de ${s.pod_name ?? 'destination'}`;
    case 'AT_SEA': return pos ? `En mer, position relevée ${agoSentence(pos.reported_at, now)}` : 'En mer, sans position connue';
    case 'AT_ORIGIN': return `Encore au port de départ${s.pol_name ? ` (${s.pol_name})` : ''}`;
    case 'BOOKED': return 'Réservé, pas encore chargé sur le navire';
    default: return "Pas de suivi : l'armateur ne nous répond pas encore";
  }
}

/** « il y a 2 jours » / « il y a 3 heures » / « à l'instant ». */
export function agoSentence(iso: string, now = new Date()): string {
  const h = differenceInHours(now, new Date(iso));
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${plural(h, 'heure')}`;
  return `il y a ${plural(Math.floor(h / 24), 'jour')}`;
}

/** « 6 choses à faire avant l'arrivée » / « Rien à faire, tout est prêt ». */
export function todoSentence(s: CargoShipment, docs?: CargoDocument[]): string {
  const open = nextSteps(s, docs).filter((t) => t.level !== 'done').length;
  if (open === 0) return 'Rien à faire, tout est prêt';
  return `${plural(open, 'chose')} à faire avant l'arrivée`;
}

/** « À faire : régler le fret au transitaire » — la prochaine, une seule. */
export function nextActionSentence(s: CargoShipment, docs?: CargoDocument[]): string | null {
  const next = nextSteps(s, docs).find((t) => t.level !== 'done');
  if (!next) return null;
  const label = next.label.charAt(0).toLowerCase() + next.label.slice(1);
  return `À faire : ${label}`;
}

/** « Fret 6 550 $, pas encore payé. Télex pas encore reçu. » */
export function moneySentence(s: CargoShipment): string {
  const freight = s.freight_usd == null ? 'Fret : montant inconnu' : `Fret ${fmtUsd(s.freight_usd)}, ${s.freight_paid ? 'payé' : 'pas encore payé'}`;
  const telex = s.telex_released ? 'Télex reçu' : 'Télex pas encore reçu';
  return `${freight}. ${telex}.`;
}

/** « 5 pièces manquantes sur 5 » / « Toutes les pièces obligatoires sont là ». */
export function papersSentence(docs: CargoDocument[] | undefined): string {
  const required = DOCUMENT_KINDS.filter((k) => k.required);
  const missing = required.filter((k) => !(docs ?? []).some((d) => d.kind === k.kind)).length;
  if (missing === 0) return 'Toutes les pièces obligatoires sont là';
  return `${plural(missing, 'pièce manquante', 'pièces manquantes')} sur ${required.length}`;
}

/** L'étape camerounaise en cours, en une phrase. */
export function customsSentence(s: CargoShipment): string {
  if (s.empty_returned_at) return 'Terminé : le conteneur vide est restitué';
  if (s.gate_out_at) return 'Sorti du port, sur camion';
  if (s.delivery_order_at) return 'Bon à enlever obtenu, la boîte peut sortir';
  if (s.customs_cleared_at) return 'Douane liquidée, en attente du bon à enlever';
  if (s.arrival_notice_at) return 'Avis d’arrivée reçu, douane en cours';
  if (s.status === 'ARRIVED') return 'Arrivé, pas encore dédouané';
  return 'Pas encore arrivé';
}

/** « Téléphones et accessoires — 860 colis, 18 400 kg ». */
export function contentSentence(s: CargoShipment): string {
  const bits: string[] = [];
  if (s.packages_count != null) bits.push(plural(s.packages_count, 'colis', 'colis'));
  if (s.gross_weight_kg != null) bits.push(`${Number(s.gross_weight_kg).toLocaleString('fr-FR')} kg`);
  const what = s.goods_description ?? 'Marchandise non renseignée';
  return bits.length ? `${what} — ${bits.join(', ')}` : what;
}
