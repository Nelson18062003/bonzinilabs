/**
 * Le voyage d'un conteneur, escale par escale.
 *
 * Les escales viennent de cargo_shipments.route_calls, que l'équipe tient à
 * jour (Atlas, VesselFinder, consignataire). Sans escale saisie, on retombe
 * sur le départ et l'arrivée du dossier — jamais sur une ligne figée qui
 * mettrait Lekki avant Kribi quand la rotation a changé.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';
import { PORTS, bestEta, type CargoShipment, type LatLng } from '@/lib/cargo/model';

export interface RouteCall {
  id: string;
  name: string;
  unlocode?: string | null;
  /** Dates ISO (jour seul « 2026-10-03 » ou instant complet). */
  eta?: string | null;
  etd?: string | null;
  ata?: string | null;
  atd?: string | null;
  note?: string | null;
  /** Escale du navire APRÈS le déchargement de notre conteneur (contexte seulement). */
  after?: boolean | number | null;
}

export type CallState = 'done' | 'here' | 'next' | 'later' | 'after';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseCalls(json: Json | null | undefined): RouteCall[] {
  if (!Array.isArray(json)) return [];
  return (json as unknown[]).filter(isObj).map((c, i) => ({
    id: str(c.id) ?? `c${i}`,
    name: str(c.name) ?? '—',
    unlocode: str(c.unlocode),
    eta: str(c.eta), etd: str(c.etd), ata: str(c.ata), atd: str(c.atd),
    note: str(c.note),
    after: c.after === true || c.after === 1,
  }));
}

/** Une date d'escale : « 2026-10-03 » se lit à midi (pas de décalage de fuseau qui ferait reculer d'un jour). */
export function callDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
}

const day = (d: Date | null) => (d ? format(d, 'd MMM', { locale: fr }) : null);

/** Les escales du voyage : celles saisies, sinon départ + arrivée du dossier. */
export function voyageCalls(s: CargoShipment): RouteCall[] {
  const calls = parseCalls(s.route_calls);
  if (calls.length) return calls;
  const eta = bestEta(s);
  return [
    { id: 'pol', name: s.pol_name ?? 'Départ', unlocode: s.pol_unlocode, atd: s.etd_actual, etd: s.etd_promised },
    { id: 'pod', name: s.pod_name, unlocode: s.pod_unlocode, eta: eta.date ? eta.date.toISOString() : null },
  ];
}

/**
 * L'état de chaque escale : faite (départ constaté), en cours (arrivé, pas
 * reparti), prochaine, plus tard, ou après notre déchargement.
 */
export function callStates(calls: RouteCall[], now = new Date()): CallState[] {
  let nextGiven = false;
  return calls.map((c) => {
    if (c.after) return 'after';
    if (c.atd && (callDate(c.atd)?.getTime() ?? Infinity) <= now.getTime()) return 'done';
    if (c.ata && (callDate(c.ata)?.getTime() ?? Infinity) <= now.getTime() + 12 * 3600_000) { nextGiven = true; return 'here'; }
    if (!nextGiven) { nextGiven = true; return 'next'; }
    return 'later';
  });
}

/** La ligne de date d'une escale, en clair : « parti le 1 oct. », « arrivé le 3 oct. », « prévu 7 → 11 oct. ». */
export function callDateLine(c: RouteCall, state: CallState): string | null {
  if (state === 'done') return c.atd ? `parti le ${day(callDate(c.atd))}` : null;
  if (state === 'here') return `arrivé le ${day(callDate(c.ata))}${c.etd ? ` · départ prévu ${day(callDate(c.etd))}` : ''}`;
  const a = day(callDate(c.eta));
  const d = day(callDate(c.etd));
  if (a && d && a !== d) return `prévu ${a} → ${d}`;
  if (a) return `prévu le ${a}`;
  if (d) return `départ prévu ${d}`;
  return null;
}

export function callPos(c: RouteCall): LatLng | null {
  return c.unlocode && PORTS[c.unlocode] ? PORTS[c.unlocode].pos : null;
}

/** Jours depuis le départ et jours restants, pour la barre d'avancement. */
export function voyageDays(s: CargoShipment, now = new Date()): { sailed: number; left: number | null } | null {
  const start = s.etd_actual ? new Date(s.etd_actual) : s.etd_promised ? new Date(`${s.etd_promised}T12:00:00`) : null;
  if (!start) return null;
  const eta = bestEta(s).date;
  return { sailed: Math.max(0, differenceInCalendarDays(now, start)), left: eta ? differenceInCalendarDays(eta, now) : null };
}

export function newCallId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Le port d'arrivée en clair (« Kribi », « Douala ») — le même calcul que le
 * message envoyé aux clients par cargo_shipments_notify_parcels.
 */
export function arrivalPort(s: Pick<CargoShipment, 'pod_name' | 'pod_unlocode'>): string {
  if (s.pod_unlocode === 'CMKBI' || /kribi/i.test(s.pod_name ?? '')) return 'Kribi';
  if (s.pod_unlocode === 'CMDLA' || /douala/i.test(s.pod_name ?? '')) return 'Douala';
  return s.pod_name?.trim() || 'Douala';
}
