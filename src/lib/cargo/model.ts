/**
 * Bonzini Cargo — modèle partagé (desktop + mobile).
 *
 * Tout le vocabulaire visible à l'écran vient d'ici (voir
 * docs/cargo/module-app/01-vision-et-architecture.md §7) : un dossier se lit
 * « conteneur de GAUSS, sur le CMA CGM PRIDE, arrive à Kribi le 18 oct. »,
 * jamais en codes. Les codes restent dans cargo_events pour l'audit.
 */
import { differenceInCalendarDays, differenceInHours, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Tone } from '@/mobile/designKit';

export type CargoShipment = Database['public']['Tables']['cargo_shipments']['Row'];
export type CargoEvent = Database['public']['Tables']['cargo_events']['Row'];
export type CargoVesselPosition = Database['public']['Tables']['cargo_vessel_positions']['Row'];
export type CargoLookup = Database['public']['Tables']['cargo_lookups']['Row'];
export type CargoDocument = Database['public']['Tables']['cargo_documents']['Row'];
export type CargoCost = Database['public']['Tables']['cargo_costs']['Row'];
/** Un lot de colis identiques dans un conteneur — une ligne de packing list. */
export type CargoPackage = Database['public']['Tables']['cargo_packages']['Row'];

export type CargoStatus = 'BOOKED' | 'AT_ORIGIN' | 'AT_SEA' | 'ARRIVED' | 'DELIVERED' | 'UNKNOWN';

export const STATUS_META: Record<CargoStatus, { label: string; tone: Tone }> = {
  BOOKED: { label: 'Réservé', tone: 'pending' },
  AT_ORIGIN: { label: 'Au départ', tone: 'pending' },
  AT_SEA: { label: 'En mer', tone: 'info' },
  ARRIVED: { label: 'Arrivé', tone: 'success' },
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
  UNKNOWN: 'Inconnu',
};

/** Ce que la plateforme sait faire par armateur — dit tel quel à l'écran. */
export const CARRIER_SUPPORT: { carrier: string; label: string; state: 'live' | 'pending' | 'later'; note: string }[] = [
  { carrier: 'MAERSK', label: 'Maersk', state: 'live', note: 'Jalons et arrivée en direct (API Track & Trace)' },
  { carrier: 'CMA_CGM', label: 'CMA CGM', state: 'pending', note: 'Référence reconnue · accès API demandé' },
  { carrier: 'MSC', label: 'MSC', state: 'later', note: 'Via agrégateur, à brancher' },
  { carrier: 'COSCO', label: 'COSCO', state: 'later', note: 'Via agrégateur, à brancher' },
];

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  BL: 'Bill of lading',
  INVOICE: 'Facture',
  PACKING_LIST: 'Packing list',
  TELEX: 'Télex release',
  BESC: 'BESC',
  CUSTOMS: 'Douane',
  OTHER: 'Autre',
};

/* ── Dates ────────────────────────────────────────────────────────────── */

function fromDate(d: string | null): Date | null {
  return d ? new Date(d + 'T12:00:00') : null;
}

/** L'arrivée à afficher : celle de l'armateur si on l'a, sinon la promesse. */
export function bestEta(s: Pick<CargoShipment, 'eta_carrier' | 'eta_promised'>): { date: Date | null; source: 'carrier' | 'promised' | null } {
  if (s.eta_carrier) return { date: new Date(s.eta_carrier), source: 'carrier' };
  const p = fromDate(s.eta_promised);
  return p ? { date: p, source: 'promised' } : { date: null, source: null };
}

export function bestEtd(s: Pick<CargoShipment, 'etd_actual' | 'etd_promised'>): Date | null {
  if (s.etd_actual) return new Date(s.etd_actual);
  return fromDate(s.etd_promised);
}

/** Jours de glissement de l'armateur par rapport à la promesse (0 si aucun). */
export function etaSlipDays(s: Pick<CargoShipment, 'eta_carrier' | 'eta_promised'>): number {
  const p = fromDate(s.eta_promised);
  if (!s.eta_carrier || !p) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(s.eta_carrier), p));
}

export function daysUntilArrival(s: Pick<CargoShipment, 'eta_carrier' | 'eta_promised'>, now = new Date()): number | null {
  const { date } = bestEta(s);
  return date ? differenceInCalendarDays(date, now) : null;
}

/** Avancement du voyage : jour courant / durée totale. */
export function voyageProgress(s: CargoShipment, now = new Date()): { day: number; total: number; pct: number } | null {
  const etd = bestEtd(s);
  const { date: eta } = bestEta(s);
  if (!etd || !eta) return null;
  const total = Math.max(1, differenceInCalendarDays(eta, etd));
  const day = Math.max(0, Math.min(total, differenceInCalendarDays(now, etd)));
  const pct = s.status === 'ARRIVED' || s.status === 'DELIVERED' ? 100 : Math.max(2, Math.min(98, Math.round((day / total) * 100)));
  return { day, total, pct };
}

export const fmtDay = (d: Date | null | undefined) => (d ? format(d, 'd MMM', { locale: fr }) : '—');
export const fmtDayFull = (d: Date | null | undefined) => (d ? format(d, 'd MMMM yyyy', { locale: fr }) : '—');
export const fmtDayTime = (d: Date | null | undefined) => (d ? format(d, 'd MMM HH:mm', { locale: fr }) : '—');
export const fmtUsd = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} $`);

/** Carte live du navire (VesselFinder) — la seule position « en direct » sans abonnement AIS. */
export function liveVesselUrl(imo: string | null | undefined): string | null {
  return imo ? `https://www.vesselfinder.com/?imo=${encodeURIComponent(imo)}` : null;
}

/** Une position AIS de plus de 3 jours est « ancienne » : navire en plein océan, hors couverture. */
export function isStalePosition(p: Pick<CargoVesselPosition, 'reported_at'>, now = new Date()): boolean {
  return differenceInCalendarDays(now, new Date(p.reported_at)) > 3;
}

export function positionAge(p: Pick<CargoVesselPosition, 'reported_at'>, now = new Date()): string {
  const h = differenceInHours(now, new Date(p.reported_at));
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

/** « 20,42° S · 9,92° E » */
export function fmtLatLng(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2).replace('.', ',')}° ${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')} · ${f(lon, 'E', 'O')}`;
}

/** La phrase d'état du dossier : où il est, en un souffle. */
export function whereIs(s: CargoShipment, pos: CargoVesselPosition | null): string {
  switch (s.status) {
    case 'DELIVERED': return 'Livré';
    case 'ARRIVED': return `Arrivé à ${s.pod_name}`;
    case 'AT_SEA':
      if (pos) return isStalePosition(pos) ? `En mer — dernière position ${positionAge(pos)}` : `En mer — position ${positionAge(pos)}`;
      return 'En mer';
    case 'AT_ORIGIN': return `Au port de départ${s.pol_name ? ` (${s.pol_name})` : ''}`;
    case 'BOOKED': return 'Réservé, pas encore chargé';
    default: return 'Aucune donnée de suivi';
  }
}

/* ── Référence saisie ─────────────────────────────────────────────────── */

export function cleanReference(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Miroir client de cargo_detect_carrier — uniquement pour l'aide à la saisie. */
export function guessCarrier(ref: string): { carrier: string; type: 'BL' | 'CONTAINER' } | null {
  const r = cleanReference(ref);
  if (r.length < 6) return null;
  if (/^[0-9]{9}$/.test(r)) return { carrier: 'MAERSK', type: 'BL' };
  if (/^(MAEU|MRKU|MRSU|MSKU|MIEU|SUDU|SEAU|MWCU|MNBU|HASU|TCNU)[0-9]{7}$/.test(r)) return { carrier: 'MAERSK', type: 'CONTAINER' };
  if (/^(CMAU|ECMU|CGMU|APZU|APHU|APRU|CMCU|ANNU)[0-9]{7}$/.test(r)) return { carrier: 'CMA_CGM', type: 'CONTAINER' };
  if (/^(MSCU|MEDU|MSMU|MSDU)[0-9]{7}$/.test(r)) return { carrier: 'MSC', type: 'CONTAINER' };
  if (/^(COSU|CBHU|CCLU|CSNU|CSLU|OOLU|OOCU)[0-9]{7}$/.test(r)) return { carrier: 'COSCO', type: 'CONTAINER' };
  if (/^[A-Z]{4}[0-9]{7}$/.test(r)) return { carrier: 'MAERSK', type: 'CONTAINER' };
  if (/^[A-Z]{3}[0-9]{7}$/.test(r)) return { carrier: 'CMA_CGM', type: 'BL' };
  return { carrier: 'UNKNOWN', type: 'BL' };
}

/* ── Résultat normalisé d'une recherche (écrit par l'edge cargo-lookup) ── */

export interface LookupEvent {
  id: string; type: string; code: string; classifier: string; time: string; label: string;
  location: string | null; unlocode: string | null; lat: number | null; lon: number | null;
  vessel: string | null; imo: string | null; voyage: string | null;
}
export interface LookupContainer {
  number: string; iso: string | null; status: CargoStatus;
  vessel: { name: string | null; imo: string | null } | null; voyage: string | null;
  pol: { name: string | null; unlocode: string | null } | null;
  pod: { name: string | null; unlocode: string | null } | null;
  etd_actual: string | null; eta_carrier: string | null;
  last_event_at: string | null; last_event_label: string | null;
  events: LookupEvent[];
}
export interface LookupResult {
  carrier: string; reference: string; bl_number: string | null; fetched_at: string; containers: LookupContainer[];
}
export function parseLookupResult(json: Json | null): LookupResult | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const r = json as unknown as LookupResult;
  return Array.isArray(r.containers) ? r : null;
}

/** Un jalon, quel que soit son origine (dossier enregistré ou recherche libre). */
export interface TimelineItem {
  id: string; time: string; label: string; classifier: string; location: string | null; vessel: string | null;
}
export function timelineFromEvents(events: CargoEvent[]): TimelineItem[] {
  return events.map((e) => ({
    id: e.id, time: e.event_time, classifier: e.classifier,
    label: labelFromCode(e.event_code, e.classifier, e.raw),
    location: e.location_name, vessel: e.vessel_name,
  }));
}
export function timelineFromLookup(events: LookupEvent[]): TimelineItem[] {
  return events.map((e) => ({ id: e.id, time: e.time, classifier: e.classifier, label: e.label, location: e.location, vessel: e.vessel }));
}

function labelFromCode(code: string, classifier: string, raw: Json | null): string {
  const est = classifier !== 'ACT';
  const empty = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>).emptyIndicatorCode : null;
  switch (code) {
    case 'CONF': return 'Réservation confirmée';
    case 'RECE': return "Instructions d'expédition reçues";
    case 'DRFT': return 'Bill of lading en brouillon';
    case 'ISSU': return 'Bill of lading émis';
    case 'SURR': return 'Bill of lading remis (télex)';
    case 'GTOT': return empty === 'EMPTY' ? 'Boîte vide retirée du terminal' : 'Boîte sortie du terminal';
    case 'GTIN': return empty === 'LADEN' ? 'Boîte pleine rendue au terminal' : 'Boîte entrée au terminal';
    case 'LOAD': return 'Chargé à bord';
    case 'DISC': return 'Déchargé du navire';
    case 'DEPA': return est ? 'Départ prévu du navire' : 'Navire parti';
    case 'ARRI': return est ? 'Arrivée prévue du navire' : 'Navire arrivé';
    case 'STRP': return 'Boîte dépotée';
    case 'STUF': return 'Boîte empotée';
    case 'PICK': return 'Boîte enlevée';
    case 'DROP': return 'Boîte déposée';
    default: return code;
  }
}

/* ── Géographie de la ligne Chine → Cameroun (WAX1) ────────────────────── */
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

/* ── Coûts du dossier ─────────────────────────────────────────────────────
 * L'ordre est celui où les coûts tombent dans la chaîne (manuel cargo,
 * chapitre « anatomie complète d'un coût »). */
export const COST_KINDS = [
  'FREIGHT', 'SURCHARGE', 'THC', 'BESC', 'INSURANCE', 'CUSTOMS_DUTY', 'CUSTOMS_FEE',
  'DEMURRAGE', 'STORAGE', 'TRANSIT', 'TRUCKING', 'OTHER',
] as const;

export const COST_KIND_LABEL: Record<string, string> = {
  FREIGHT: 'Fret maritime',
  SURCHARGE: 'Surcharges (BAF, CAF…)',
  THC: 'Manutention portuaire (THC)',
  BESC: 'BESC',
  INSURANCE: 'Assurance',
  CUSTOMS_DUTY: 'Droits de douane',
  CUSTOMS_FEE: 'Frais de douane et taxes',
  DEMURRAGE: 'Surestaries / détention',
  STORAGE: 'Stockage au port',
  TRANSIT: 'Transitaire (honoraires)',
  TRUCKING: 'Transport final',
  OTHER: 'Autre',
};

export const CURRENCY_LABEL: Record<string, string> = { XAF: 'XAF', USD: '$', EUR: '€', CNY: '¥' };

export function fmtMoney(amount: number | null | undefined, currency = 'XAF'): string {
  if (amount == null) return '—';
  const n = Math.round(amount).toLocaleString('fr-FR');
  return currency === 'XAF' ? `${n} XAF` : `${n} ${CURRENCY_LABEL[currency] ?? currency}`;
}

/* ── Documents : ce qu'un dossier d'import camerounais exige ───────────────
 * `required` = pièce sans laquelle on ne sort pas le conteneur (manuel cargo,
 * « le dossier documentaire, pièce par pièce »). */
export const DOCUMENT_KINDS: { kind: string; label: string; required: boolean; who: string }[] = [
  { kind: 'BL', label: 'Bill of lading', required: true, who: "émis par l'armateur — titre de la marchandise" },
  { kind: 'TELEX', label: 'Télex release', required: true, who: "libération du B/L par l'armateur, après paiement du fret" },
  { kind: 'INVOICE', label: 'Facture commerciale', required: true, who: 'émise par le fournisseur — base de la valeur en douane' },
  { kind: 'PACKING_LIST', label: 'Packing list', required: true, who: 'émise par le fournisseur — détail des colis et des poids' },
  { kind: 'BESC', label: 'BESC', required: true, who: 'Conseil national des chargeurs — obligatoire à l’import au Cameroun' },
  { kind: 'CUSTOMS', label: 'Pièces de douane', required: false, who: 'déclaration, quittance, bon à enlever' },
  { kind: 'OTHER', label: 'Autre pièce', required: false, who: 'certificat d’origine, assurance, ANOR/PECAE…' },
];

/* ── Jalons camerounais après l'arrivée ───────────────────────────────────
 * Ces dates sont saisies à la main : aucun armateur ne les publie. */
export const ARRIVAL_STEPS: { key: keyof CargoShipment; label: string; hint: string }[] = [
  { key: 'arrival_notice_at', label: 'Avis d’arrivée reçu', hint: 'le consignataire annonce le déchargement' },
  { key: 'free_time_ends_on', label: 'Fin de franchise', hint: 'au-delà, les surestaries courent' },
  { key: 'customs_cleared_at', label: 'Douane liquidée', hint: 'déclaration acceptée et droits payés' },
  { key: 'delivery_order_at', label: 'Bon à enlever', hint: 'le port autorise la sortie' },
  { key: 'gate_out_at', label: 'Conteneur sorti du port', hint: 'chargé sur camion' },
  { key: 'empty_returned_at', label: 'Vide restitué', hint: 'fin de la détention' },
];
