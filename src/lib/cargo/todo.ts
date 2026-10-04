/**
 * « Ce qu'il reste à faire » pour récupérer un conteneur — déduit des données
 * du dossier, jamais saisi. C'est la liste que l'ops coche avant l'arrivée.
 */
import { differenceInCalendarDays } from 'date-fns';
import { bestEta, etaSlipDays } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';

export type TodoLevel = 'now' | 'soon' | 'later' | 'done';
export interface TodoItem { id: string; label: string; detail?: string; level: TodoLevel }

const HAS = (docs: CargoDocument[] | undefined, kind: string) => (docs ?? []).some((d) => d.kind === kind);

export function nextSteps(s: CargoShipment, docs?: CargoDocument[], now = new Date()): TodoItem[] {
  const eta = bestEta(s).date;
  const days = eta ? differenceInCalendarDays(eta, now) : null;
  const urgent = days != null && days <= 7;
  const level = (done: boolean): TodoLevel => (done ? 'done' : urgent ? 'now' : days != null && days <= 21 ? 'soon' : 'later');
  const items: TodoItem[] = [];
  if (s.status !== 'DELIVERED') {
    const freight = s.freight_usd != null ? `${Math.round(s.freight_usd).toLocaleString('fr-FR')} $` : undefined;
    items.push({
      id: 'freight', label: 'Régler le fret au transitaire',
      detail: s.freight_paid ? undefined : [freight, s.freight_note ? 'montant à confirmer' : null].filter(Boolean).join(' · ') || undefined,
      level: level(s.freight_paid),
    });
    items.push({ id: 'telex', label: 'Obtenir le télex release', detail: 'sans lui, le conteneur reste au port', level: s.freight_paid ? level(s.telex_released) : s.telex_released ? 'done' : urgent ? 'now' : 'later' });
    items.push({ id: 'bl', label: 'Classer le bill of lading dans le dossier', level: level(HAS(docs, 'BL')) });
    items.push({ id: 'invoice', label: 'Réunir les factures commerciales', detail: 'à demander à nos clients, base de la valeur en douane', level: level(HAS(docs, 'INVOICE')) });
    if (s.pod_unlocode === 'CMKBI' || s.pod_unlocode === 'CMDLA') {
      // Le BESC est fait dès qu'on a son numéro (ou sa pièce) : la liste ne le redemande plus.
      const besc = !!s.besc_number || HAS(docs, 'BESC');
      items.push({
        id: 'besc', label: besc ? `BESC obtenu${s.besc_number ? ` (${s.besc_number})` : ''}` : 'Obtenir le BESC',
        detail: besc ? undefined : 'obligatoire à l’import au Cameroun, avant l’arrivée', level: level(besc),
      });
    }
    if (s.status === 'UNKNOWN') items.push({ id: 'vessel', label: 'Renseigner le navire', detail: 'pour placer la boîte sur la carte', level: s.vessel_imo ? 'done' : 'soon' });
    // Prévenir le client : urgent seulement quand l'arrivée est proche, sinon « bientôt ».
    const slip = etaSlipDays(s);
    if (slip > 3) items.push({ id: 'client', label: `Prévenir ${s.client_label} du retard`, detail: `${slip} jours de plus que la date promise`, level: days != null && days <= 14 ? 'now' : 'soon' });
  }
  return items;
}

export function todoCounts(s: CargoShipment, docs?: CargoDocument[]): { open: number; now: number } {
  const items = nextSteps(s, docs);
  return { open: items.filter((i) => i.level !== 'done').length, now: items.filter((i) => i.level === 'now').length };
}
