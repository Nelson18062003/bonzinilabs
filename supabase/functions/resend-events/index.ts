// ============================================================
// Chantier B — Lot B5 — Réception des webhooks Resend (Edge Function)
//
// Resend signe ses webhooks via Svix. On vérifie la signature sur le
// CORPS BRUT (jamais re-sérialiser : casserait la signature), puis :
//   - email.delivered  → delivery_status='delivered'
//   - email.bounced     → delivery_status='bounced'  + ajout suppression
//   - email.complained  → delivery_status='complained'+ ajout suppression
//
// Déduplication : Svix garantit une livraison "at-least-once". On se
// repose sur l'idempotence des UPDATE (par resend_message_id) et des
// INSERT suppression (PRIMARY KEY email, ON CONFLICT DO NOTHING).
//
// config.toml : verify_jwt=false (appel externe par Resend, pas de JWT).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.24.0";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return new Response("Missing RESEND_WEBHOOK_SECRET", { status: 500 });

  // 1. Corps BRUT (indispensable pour la vérif Svix).
  const raw = await req.text();

  // 2. Vérifier la signature.
  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as { type: string; data: Record<string, unknown> };
  } catch (err) {
    console.error("Svix verify failed:", (err as Error).message);
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const data = evt.data ?? {};
  const messageId = (data.email_id ?? data.id) as string | undefined;
  // Resend met le(s) destinataire(s) dans `to` (string | string[]).
  const toRaw = data.to as string | string[] | undefined;
  const recipient = (Array.isArray(toRaw) ? toRaw[0] : toRaw)?.toLowerCase();

  const mapStatus: Record<string, string> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
  };
  const deliveryStatus = mapStatus[evt.type];

  try {
    // 3. MAJ du statut de livraison sur l'outbox (par message_id si dispo).
    if (deliveryStatus && messageId) {
      await supabase.from("email_outbox")
        .update({ delivery_status: deliveryStatus })
        .eq("resend_message_id", messageId);
    }

    // 4. Suppression sur bounce/plainte.
    if ((evt.type === "email.bounced" || evt.type === "email.complained") && recipient) {
      await supabase.from("email_suppressions")
        .upsert(
          {
            email: recipient,
            reason: evt.type === "email.bounced" ? "bounced" : "complained",
            source: evt.type,
          },
          { onConflict: "email", ignoreDuplicates: true },
        );
    }
  } catch (err) {
    console.error("resend-events DB error:", (err as Error).message);
    return new Response("DB error", { status: 500 });
  }

  console.log(`resend-events: ${evt.type} ${messageId ?? ""} ${recipient ?? ""}`);
  return new Response("OK", { status: 200 });
});
