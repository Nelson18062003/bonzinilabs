// supabase/functions/cargo-lookup/index.ts
// ============================================================
// Bonzini Cargo — recherche libre d'une référence (B/L, booking, conteneur).
//
// Déclenchée par request_cargo_lookup (pg_net, Bearer service role). Lit la
// ligne cargo_lookups, interroge l'armateur, écrit le résultat normalisé :
//   { carrier, reference, bl_number, containers: [NormalizedContainer…] }
// puis status = done | error. Le front sonde la ligne.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { containersIn, fetchMaerskEvents, summarizeContainer } from "../_shared/maersk.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAERSK_KEY = Deno.env.get("MAERSK_CONSUMER_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if ((req.headers.get("Authorization") ?? "") !== `Bearer ${SERVICE_KEY}`) return new Response("Unauthorized", { status: 401 });

  const { lookup_id } = await req.json().catch(() => ({}));
  if (!lookup_id) return Response.json({ success: false, error: "lookup_id manquant" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: lookup, error } = await sb.from("cargo_lookups").select("*").eq("id", lookup_id).single();
  if (error || !lookup) return Response.json({ success: false, error: "recherche introuvable" }, { status: 404 });

  const fail = async (msg: string) => {
    await sb.from("cargo_lookups").update({ status: "error", error: msg, completed_at: new Date().toISOString() }).eq("id", lookup_id);
    return Response.json({ success: false, error: msg });
  };

  if (lookup.carrier !== "MAERSK") return fail("Armateur non interrogeable pour l'instant");
  if (!MAERSK_KEY) return fail("Clé Maersk absente (MAERSK_CONSUMER_KEY)");

  try {
    const events = lookup.reference_type === "CONTAINER"
      ? await fetchMaerskEvents(MAERSK_KEY, { container: lookup.reference })
      : await fetchMaerskEvents(MAERSK_KEY, { bl: lookup.reference });
    if (events.length === 0) return fail("Maersk ne connaît pas cette référence (ou elle n'est plus sur le suivi public)");

    const numbers = containersIn(events);
    if (numbers.length === 0 && lookup.reference_type === "CONTAINER") numbers.push(lookup.reference);
    const containers = numbers.map((n) => summarizeContainer(n, events));
    const blRef = events.flatMap((e) => e.documentReferences ?? []).find((r) => r.documentReferenceType === "TRD")?.documentReferenceValue
      ?? (lookup.reference_type === "BL" ? lookup.reference : null);

    const result = { carrier: "MAERSK", reference: lookup.reference, bl_number: blRef, fetched_at: new Date().toISOString(), containers };
    await sb.from("cargo_lookups").update({ status: "done", result, error: null, completed_at: new Date().toISOString() }).eq("id", lookup_id);
    return Response.json({ success: true, containers: containers.length });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
});
