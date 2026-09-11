// ============================================================
// Maersk — API publique Track & Trace (DCSA v2.2), partagée par
// cargo-sync (entretien des dossiers) et cargo-lookup (recherche libre).
//
// GET https://api.maersk.com/track-and-trace/public-events
//     ?transportDocumentReference=<B/L ou booking>  |  ?equipmentReference=<boîte>
//     header Consumer-Key. Quota d'essai : 20 appels / heure.
//
// Tout le vocabulaire visible à l'écran naît ici (labelOf) : un jalon DCSA
// devient une phrase française, et le statut du conteneur se déduit des
// jalons réels (ACT), jamais des prévus (EST).
// ============================================================

export const MAERSK_URL = "https://api.maersk.com/track-and-trace/public-events";

export interface DcsaEvent {
  eventID: string;
  eventType: "SHIPMENT" | "EQUIPMENT" | "TRANSPORT";
  eventDateTime: string;
  eventClassifierCode: "ACT" | "EST" | "PLN";
  shipmentEventTypeCode?: string;
  equipmentEventTypeCode?: string;
  transportEventTypeCode?: string;
  emptyIndicatorCode?: string;
  ISOEquipmentCode?: string;
  documentTypeCode?: string;
  documentID?: string;
  documentReferences?: { documentReferenceType: string; documentReferenceValue: string }[];
  eventLocation?: { locationName?: string; UNLocationCode?: string; latitude?: string; longitude?: string };
  transportCall?: {
    carrierVoyageNumber?: string;
    UNLocationCode?: string;
    location?: { locationName?: string; latitude?: string; longitude?: string };
    vessel?: { vesselName?: string; vesselIMONumber?: string; vesselCallSignNumber?: string };
  };
  references?: { referenceType: string; referenceValue: string }[];
}

export function codeOf(e: DcsaEvent): string {
  return e.shipmentEventTypeCode ?? e.equipmentEventTypeCode ?? e.transportEventTypeCode ?? "?";
}

/** Libellé humain d'un jalon — le même vocabulaire que l'écran. */
export function labelOf(e: DcsaEvent): string {
  const code = codeOf(e);
  const est = e.eventClassifierCode !== "ACT";
  switch (code) {
    case "CONF": return "Réservation confirmée";
    case "RECE": return "Instructions d'expédition reçues";
    case "DRFT": return "Bill of lading en brouillon";
    case "ISSU": return "Bill of lading émis";
    case "SURR": return "Bill of lading remis (télex)";
    case "GTOT": return e.emptyIndicatorCode === "EMPTY" ? "Boîte vide retirée du terminal" : "Boîte sortie du terminal";
    case "GTIN": return e.emptyIndicatorCode === "LADEN" ? "Boîte pleine rendue au terminal" : "Boîte entrée au terminal";
    case "LOAD": return "Chargé à bord";
    case "DISC": return "Déchargé du navire";
    case "DEPA": return est ? "Départ prévu du navire" : "Navire parti";
    case "ARRI": return est ? "Arrivée prévue du navire" : "Navire arrivé";
    case "STRP": return "Boîte dépotée";
    case "STUF": return "Boîte empotée";
    case "PICK": return "Boîte enlevée";
    case "DROP": return "Boîte déposée";
    default: return code;
  }
}

export function num(v?: string): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchMaerskEvents(key: string, params: { bl?: string; container?: string }): Promise<DcsaEvent[]> {
  const q = params.bl
    ? `transportDocumentReference=${encodeURIComponent(params.bl)}`
    : `equipmentReference=${encodeURIComponent(params.container ?? "")}`;
  const res = await fetch(`${MAERSK_URL}?${q}`, { headers: { "Consumer-Key": key, Accept: "application/json" } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Maersk HTTP ${res.status}`);
  const json = await res.json();
  return (json.events ?? []) as DcsaEvent[];
}

/** Numéros de conteneur portés par un lot de jalons. */
export function containersIn(events: DcsaEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) for (const r of e.references ?? []) if (r.referenceType === "EQ") set.add(r.referenceValue);
  return [...set];
}

/** Jalons d'UN conteneur (les jalons de dossier, sans référence EQ, sont partagés). */
export function eventsFor(events: DcsaEvent[], container: string): DcsaEvent[] {
  return events.filter((e) => {
    const eq = (e.references ?? []).filter((r) => r.referenceType === "EQ").map((r) => r.referenceValue);
    return eq.length === 0 || eq.includes(container);
  });
}

export interface NormalizedEvent {
  id: string; type: string; code: string; classifier: string; time: string; label: string;
  location: string | null; unlocode: string | null; lat: number | null; lon: number | null;
  vessel: string | null; imo: string | null; voyage: string | null; raw: DcsaEvent;
}

export interface NormalizedContainer {
  number: string;
  iso: string | null;
  status: "BOOKED" | "AT_ORIGIN" | "AT_SEA" | "ARRIVED" | "DELIVERED" | "UNKNOWN";
  vessel: { name: string | null; imo: string | null } | null;
  voyage: string | null;
  pol: { name: string | null; unlocode: string | null } | null;
  pod: { name: string | null; unlocode: string | null } | null;
  etd_actual: string | null;
  eta_carrier: string | null;
  last_event_at: string | null;
  last_event_label: string | null;
  events: NormalizedEvent[];
}

export function normalizeEvent(e: DcsaEvent): NormalizedEvent {
  const tc = e.transportCall;
  const loc = e.eventLocation ?? tc?.location;
  return {
    id: e.eventID, type: e.eventType, code: codeOf(e), classifier: e.eventClassifierCode ?? "ACT",
    time: e.eventDateTime, label: labelOf(e),
    location: loc?.locationName ?? null, unlocode: e.eventLocation?.UNLocationCode ?? tc?.UNLocationCode ?? null,
    lat: num(loc?.latitude), lon: num(loc?.longitude),
    vessel: tc?.vessel?.vesselName ?? null, imo: tc?.vessel?.vesselIMONumber ?? null, voyage: tc?.carrierVoyageNumber ?? null,
    raw: e,
  };
}

/**
 * Résume les jalons d'un conteneur : navire, départ réel, arrivée prévue au
 * port de déchargement (le dernier ARRI de la chaîne), statut.
 */
export function summarizeContainer(container: string, all: DcsaEvent[]): NormalizedContainer {
  const mine = eventsFor(all, container).sort((a, b) => a.eventDateTime.localeCompare(b.eventDateTime));
  const actual = mine.filter((e) => e.eventClassifierCode === "ACT");
  const lastActual = actual[actual.length - 1];
  const depa = actual.find((e) => e.transportEventTypeCode === "DEPA");
  const firstLoad = mine.find((e) => e.equipmentEventTypeCode === "LOAD" || e.transportEventTypeCode === "DEPA");
  const arri = mine.filter((e) => e.transportEventTypeCode === "ARRI").pop();
  const withVessel = mine.filter((e) => e.transportCall?.vessel?.vesselName).pop();
  const codes = new Set(actual.map(codeOf));
  const gtotCount = actual.filter((e) => e.equipmentEventTypeCode === "GTOT").length;

  let status: NormalizedContainer["status"] = "UNKNOWN";
  if (codes.has("STRP") || (codes.has("DISC") && gtotCount >= 2)) status = "DELIVERED";
  else if (codes.has("DISC") || (arri && arri.eventClassifierCode === "ACT")) status = "ARRIVED";
  else if (codes.has("DEPA") || codes.has("LOAD")) status = "AT_SEA";
  else if (codes.has("GTIN") || codes.has("GTOT")) status = "AT_ORIGIN";
  else if (codes.has("CONF")) status = "BOOKED";

  const polLoc = firstLoad?.transportCall;
  const podLoc = arri?.transportCall;
  return {
    number: container,
    iso: mine.find((e) => e.ISOEquipmentCode)?.ISOEquipmentCode ?? null,
    status,
    vessel: withVessel?.transportCall?.vessel ? { name: withVessel.transportCall.vessel.vesselName ?? null, imo: withVessel.transportCall.vessel.vesselIMONumber ?? null } : null,
    voyage: withVessel?.transportCall?.carrierVoyageNumber ?? null,
    pol: polLoc ? { name: polLoc.location?.locationName ?? null, unlocode: polLoc.UNLocationCode ?? null } : null,
    pod: podLoc ? { name: podLoc.location?.locationName ?? null, unlocode: podLoc.UNLocationCode ?? null } : null,
    etd_actual: depa?.eventDateTime ?? null,
    eta_carrier: arri?.eventDateTime ?? null,
    last_event_at: lastActual?.eventDateTime ?? null,
    last_event_label: lastActual ? labelOf(lastActual) : null,
    events: mine.map(normalizeEvent),
  };
}
