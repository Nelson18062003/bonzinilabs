import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Twilio WhatsApp + SMS notification for clients ──────────────────────────
// Triggered by a DB webhook on AFTER INSERT on public.notifications.
// Sends WhatsApp first, falls back to SMS if WhatsApp fails.
//
// Required env vars (set via `supabase secrets set`):
//   TWILIO_ACCOUNT_SID   — Twilio Account SID
//   TWILIO_AUTH_TOKEN     — Twilio Auth Token
//   TWILIO_WHATSAPP_FROM  — WhatsApp sender (e.g. "whatsapp:+14155238886")
//   TWILIO_SMS_FROM       — SMS sender (e.g. "+1234567890" or alphanumeric sender ID)
//   NOTIFY_WEBHOOK_SECRET — (optional) shared secret for webhook auth

serve(async (req) => {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (secret) {
    const incoming = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (incoming !== secret) return new Response("Unauthorized", { status: 401 });
  }

  // ── Parse payload ───────────────────────────────────────────────────────────
  let payload: {
    type: string;
    table: string;
    schema: string;
    record: Record<string, unknown>;
  };

  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { type, table, schema, record } = payload;
  console.log(`Webhook: ${type} on ${table}`);

  // Only handle INSERTs on the notifications table
  if (schema !== "public" || table !== "notifications" || type !== "INSERT") {
    return new Response("OK", { status: 200 });
  }

  // ── Get client phone number ─────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const userId = record.user_id as string;
  if (!userId) {
    console.error("No user_id in notification record");
    return new Response("OK", { status: 200 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("phone, first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!client?.phone) {
    console.log(`Client ${userId} has no phone — skipping WhatsApp/SMS`);
    return new Response("OK", { status: 200 });
  }

  // ── Build message ───────────────────────────────────────────────────────────
  const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client";
  const title = record.title as string ?? "Notification";
  const message = record.message as string ?? "";

  const body = `Bonjour ${clientName},\n\n${title}\n${message}\n\n— Bonzini`;

  // ── Normalize phone number ──────────────────────────────────────────────────
  let phone = client.phone.replace(/\s+/g, "");
  if (!phone.startsWith("+")) {
    // Assume Cameroon if no country code
    phone = phone.startsWith("237") ? `+${phone}` : `+237${phone}`;
  }

  // ── Twilio config ───────────────────────────────────────────────────────────
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
  const smsFrom = Deno.env.get("TWILIO_SMS_FROM");

  if (!accountSid || !authToken) {
    console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    return new Response("OK", { status: 200 });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

  // ── Try WhatsApp first ──────────────────────────────────────────────────────
  let sent = false;

  if (whatsappFrom) {
    try {
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: whatsappFrom,
          To: `whatsapp:${phone}`,
          Body: body,
        }),
      });

      if (resp.ok) {
        console.log(`WhatsApp sent to ${phone}`);
        sent = true;
      } else {
        const err = await resp.text();
        console.warn(`WhatsApp failed (${resp.status}): ${err}`);
      }
    } catch (err) {
      console.warn("WhatsApp fetch error:", err);
    }
  }

  // ── Fallback to SMS ─────────────────────────────────────────────────────────
  if (!sent && smsFrom) {
    try {
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: smsFrom,
          To: phone,
          Body: body,
        }),
      });

      if (resp.ok) {
        console.log(`SMS sent to ${phone}`);
        sent = true;
      } else {
        const err = await resp.text();
        console.error(`SMS failed (${resp.status}): ${err}`);
      }
    } catch (err) {
      console.error("SMS fetch error:", err);
    }
  }

  if (!sent) {
    console.error(`Failed to notify client ${userId} via WhatsApp or SMS`);
  }

  return new Response("OK", { status: 200 });
});
