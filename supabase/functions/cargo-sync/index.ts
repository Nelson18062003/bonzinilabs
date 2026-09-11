// supabase/functions/cargo-sync/index.ts
// ============================================================
// Bonzini Cargo — synchronisation des dossiers conteneurs.
//
// Appelée toutes les heures par pg_cron (run_cargo_sync) et à la demande
// depuis l'écran (request_cargo_sync). Elle ne fait confiance qu'au
// service role : le porteur du Bearer DOIT être la clé service.
//
// 1) Maersk — API publique Track & Trace (DCSA v2.2) :
//    GET https://api.maersk.com/track-and-trace/public-events
//        ?transportDocumentReference=<B/L>   header Consumer-Key
//    → jalons (booking, vide sorti, plein rendu, chargé, parti, arrivée
//      estimée…), navire, voyage, ETA. Quota d'essai : 20 appels/heure —
//      on ne synchronise que les dossiers non livrés, un appel par B/L.
//
// 2) Positions AIS — aisstream.io (gratuit, WebSocket). Facultatif : si
//    AISSTREAM_API_KEY est absent, les positions gardent leur dernière
//    valeur (source « manual » ou précédente). On écoute ~20 s les MMSI des
//    navires connus et on garde le dernier message par navire. Couverture
//    terrestre seulement : en plein océan, pas de message — c'est attendu.
//
// 3) CMA CGM — pas encore d'accès API (demande en cours). Les dossiers
//    CMA_CGM restent tels qu'ils ont été saisis.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAERSK_KEY = Deno.env.get("MAERSK_CONSUMER_KEY") ?? "";
const AISSTREAM_KEY = Deno.env.get("AISSTREAM_API_KEY") ?? "";
const AIS_LISTEN_MS = 20_000;

const MAERSK_URL = "https://api.maersk.com/track-and-trace/public-events";

type Shipment = {
  id: string;
  carrier: string;
  bl_number: string;
  container_number: string;
  pod_unlocode: string | null;
  vessel_imo: string | null;
  vessel_mmsi: string | null;
  vessel_name: string | null;
  status: string;
};

// ── Maersk (DCSA) ────────────────────────────────────────────────────────

interface DcsaEvent {
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
  eventLocation?: { locationName?: string; UNLocationCode?: string; latitude?: string; longitude?: string };
  transportCall?: {
    carrierVoyageNumber?: string;
    UNLocationCode?: string;
    location?: { locationName?: string; latitude?: string; longitude?: string };
    vessel?: { vesselName?: string; vesselIMONumber?: string; vesselCallSignNumber?: string };
  };
  references?: { referenceType: string; referenceValue: string }[];
}

/** Libellé humain d'un jalon — le même vocabulaire que l'écran. */
function labelOf(e: DcsaEvent): string {
  const code = e.shipmentEventTypeCode ?? e.equipmentEventTypeCode ?? e.transportEventTypeCode ?? "";
  const est = e.eventClassifierCode !== "ACT";
  switch (code) {
    case "CONF": return "Réservation confirmée";
    case "RECE": return "Instructions d'expédition reçues";
    case "DRFT": return "Bill of lading en brouillon";
    case "ISSU": return "Bill of lading émis";
    case "GTOT": return e.emptyIndicatorCode === "EMPTY" ? "Conteneur vide retiré du terminal" : "Conteneur sorti du terminal";
    case "GTIN": return e.emptyIndicatorCode === "LADEN" ? "Conteneur plein rendu au terminal" : "Conteneur entré au terminal";
    case "LOAD": return "Chargé à bord";
    case "DISC": return "Déchargé du navire";
    case "DEPA": return est ? "Départ prévu du navire" : "Navire parti";
    case "ARRI": return est ? "Arrivée prévue du navire" : "Navire arrivé";
    case "STRP": return "Conteneur dépoté";
    case "STUF": return "Conteneur empoté";
    default: return code || e.eventType;
  }
}

function num(v?: string): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function syncMaersk(sb: ReturnType<typeof createClient>, s: Shipment) {
  const res = await fetch(`${MAERSK_URL}?transportDocumentReference=${encodeURIComponent(s.bl_number)}`, {
    headers: { "Consumer-Key": MAERSK_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Maersk HTTP ${res.status}`);
  const json = await res.json();
  const events: DcsaEvent[] = json.events ?? [];

  // Ne garder que les jalons de CE conteneur (un B/L peut en porter plusieurs).
  const mine = events.filter((e) => {
    const eq = (e.references ?? []).filter((r) => r.referenceType === "EQ").map((r) => r.referenceValue);
    return eq.length === 0 || eq.includes(s.container_number);
  });

  const rows = mine.map((e) => {
    const tc = e.transportCall;
    const loc = e.eventLocation ?? tc?.location;
    return {
      shipment_id: s.id,
      carrier_event_id: e.eventID,
      event_type: e.eventType,
      event_code: e.shipmentEventTypeCode ?? e.equipmentEventTypeCode ?? e.transportEventTypeCode ?? "?",
      classifier: e.eventClassifierCode ?? "ACT",
      event_time: e.eventDateTime,
      location_name: loc?.locationName ?? null,
      unlocode: e.eventLocation?.UNLocationCode ?? tc?.UNLocationCode ?? null,
      latitude: num(loc?.latitude),
      longitude: num(loc?.longitude),
      vessel_name: tc?.vessel?.vesselName ?? null,
      vessel_imo: tc?.vessel?.vesselIMONumber ?? null,
      voyage: tc?.carrierVoyageNumber ?? null,
      raw: e,
    };
  });
  if (rows.length) {
    const { error } = await sb.from("cargo_events").upsert(rows, { onConflict: "shipment_id,carrier_event_id" });
    if (error) throw error;
  }

  // Dérivés : navire, départ réel, ETA au port de déchargement, statut.
  const sorted = [...mine].sort((a, b) => a.eventDateTime.localeCompare(b.eventDateTime));
  const actual = sorted.filter((e) => e.eventClassifierCode === "ACT");
  const lastActual = actual[actual.length - 1];
  const depa = actual.find((e) => e.transportEventTypeCode === "DEPA");
  const arri = sorted.filter((e) => e.transportEventTypeCode === "ARRI")
    .filter((e) => !s.pod_unlocode || e.transportCall?.UNLocationCode === s.pod_unlocode)
    .pop();
  const withVessel = sorted.filter((e) => e.transportCall?.vessel?.vesselName).pop();
  const codes = new Set(actual.map((e) => e.shipmentEventTypeCode ?? e.equipmentEventTypeCode ?? e.transportEventTypeCode));

  let status = s.status;
  if (codes.has("STRP") || (codes.has("GTOT") && codes.has("DISC") && actual.filter((e) => e.equipmentEventTypeCode === "GTOT").length >= 2)) status = "DELIVERED";
  else if (codes.has("DISC") || (arri && arri.eventClassifierCode === "ACT")) status = "ARRIVED";
  else if (codes.has("DEPA") || codes.has("LOAD")) status = "AT_SEA";
  else if (codes.has("GTIN") || codes.has("GTOT")) status = "AT_ORIGIN";
  else if (codes.has("CONF")) status = "BOOKED";

  const iso = mine.find((e) => e.ISOEquipmentCode)?.ISOEquipmentCode ?? null;
  const patch: Record<string, unknown> = {
    status,
    last_synced_at: new Date().toISOString(),
    sync_error: null,
    last_event_at: lastActual?.eventDateTime ?? null,
    last_event_label: lastActual ? labelOf(lastActual) : null,
  };
  if (iso) patch.container_iso = iso;
  if (depa) patch.etd_actual = depa.eventDateTime;
  if (arri) patch.eta_carrier = arri.eventDateTime;
  if (withVessel?.transportCall?.vessel) {
    patch.vessel_name = withVessel.transportCall.vessel.vesselName ?? null;
    patch.vessel_imo = withVessel.transportCall.vessel.vesselIMONumber ?? null;
    patch.voyage = withVessel.transportCall.carrierVoyageNumber ?? null;
  }
  const { error } = await sb.from("cargo_shipments").update(patch).eq("id", s.id);
  if (error) throw error;
  return rows.length;
}

// ── AIS (aisstream.io) ───────────────────────────────────────────────────

interface AisPosition {
  mmsi: string; lat: number; lon: number; sog: number | null; cog: number | null; at: string; name?: string;
}

function listenAis(mmsis: string[]): Promise<Map<string, AisPosition>> {
  return new Promise((resolve) => {
    const found = new Map<string, AisPosition>();
    let ws: WebSocket;
    try {
      ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    } catch {
      resolve(found);
      return;
    }
    const done = () => { try { ws.close(); } catch { /* déjà fermé */ } resolve(found); };
    const timer = setTimeout(done, AIS_LISTEN_MS);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        APIKey: AISSTREAM_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: mmsis,
        FilterMessageTypes: ["PositionReport"],
      }));
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        const meta = m.MetaData ?? {};
        const pr = m.Message?.PositionReport;
        if (!pr) return;
        const mmsi = String(meta.MMSI ?? pr.UserID ?? "");
        found.set(mmsi, {
          mmsi,
          lat: Number(meta.latitude ?? pr.Latitude),
          lon: Number(meta.longitude ?? pr.Longitude),
          sog: pr.Sog != null ? Number(pr.Sog) : null,
          cog: pr.Cog != null ? Number(pr.Cog) : null,
          at: meta.time_utc ? new Date(String(meta.time_utc).replace(" +0000 UTC", "Z").replace(" ", "T")).toISOString() : new Date().toISOString(),
          name: typeof meta.ShipName === "string" ? meta.ShipName.trim() : undefined,
        });
        if (found.size >= mmsis.length) { clearTimeout(timer); done(); }
      } catch { /* message ignoré */ }
    };
    ws.onerror = () => { clearTimeout(timer); done(); };
    ws.onclose = () => { clearTimeout(timer); resolve(found); };
  });
}

async function syncPositions(sb: ReturnType<typeof createClient>, shipments: Shipment[]) {
  const byMmsi = new Map<string, Shipment>();
  for (const s of shipments) if (s.vessel_mmsi && s.vessel_imo) byMmsi.set(s.vessel_mmsi, s);
  if (byMmsi.size === 0) return 0;
  const found = await listenAis([...byMmsi.keys()]);
  let n = 0;
  for (const [mmsi, p] of found) {
    const s = byMmsi.get(mmsi);
    if (!s || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const { error } = await sb.from("cargo_vessel_positions").upsert({
      vessel_imo: s.vessel_imo,
      vessel_mmsi: mmsi,
      vessel_name: s.vessel_name ?? p.name ?? null,
      latitude: p.lat,
      longitude: p.lon,
      speed_kn: p.sog,
      course_deg: p.cog,
      reported_at: p.at,
      source: "aisstream",
    }, { onConflict: "vessel_imo" });
    if (!error) n++;
  }
  return n;
}

// ── Point d'entrée ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) return new Response("Unauthorized", { status: 401 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("cargo_shipments")
    .select("id, carrier, bl_number, container_number, pod_unlocode, vessel_imo, vessel_mmsi, vessel_name, status")
    .neq("status", "DELIVERED");
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  const shipments = (data ?? []) as Shipment[];

  const report: Record<string, unknown> = { maersk: {}, positions: 0, skipped: [] as string[] };
  const maersk = shipments.filter((s) => s.carrier === "MAERSK");
  if (MAERSK_KEY) {
    for (const s of maersk) {
      try {
        (report.maersk as Record<string, unknown>)[s.container_number] = await syncMaersk(sb, s);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        (report.maersk as Record<string, unknown>)[s.container_number] = `erreur: ${msg}`;
        await sb.from("cargo_shipments").update({ sync_error: msg, last_synced_at: new Date().toISOString() }).eq("id", s.id);
      }
    }
  } else {
    (report.skipped as string[]).push("MAERSK_CONSUMER_KEY absent");
  }
  for (const s of shipments) if (s.carrier !== "MAERSK") (report.skipped as string[]).push(`${s.container_number} (${s.carrier}: pas d'API)`);

  if (AISSTREAM_KEY) {
    try { report.positions = await syncPositions(sb, shipments); }
    catch (e) { report.positionsError = e instanceof Error ? e.message : String(e); }
  } else {
    (report.skipped as string[]).push("AISSTREAM_API_KEY absent");
  }

  return Response.json({ success: true, ...report });
});
