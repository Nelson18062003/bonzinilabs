// supabase/functions/notify-admin-assignment/index.ts
// Notifie le groupe Telegram admin quand une conversation support est
// assignée/réassignée/désassignée.
//
// Appelée DIRECTEMENT depuis le frontend admin après une mutation
// claim/assign/unassign réussie (fire-and-forget). Pas besoin de
// configurer un webhook Supabase pour cette fonction.
//
// Payload attendu : {
//   conversation_id: uuid,
//   event_type: 'claim' | 'assign' | 'unassign',
//   new_admin_user_role_id: uuid | null,
//   changed_by_admin_user_id: uuid  (auth.uid de celui qui a fait l'action)
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_BASE_URL = Deno.env.get("ADMIN_BASE_URL") ?? "https://app.bonzini.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AssignmentPayload {
  conversation_id: string;
  event_type: "claim" | "assign" | "unassign";
  new_admin_user_role_id: string | null;
  changed_by_admin_user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as AssignmentPayload;
    if (!payload?.conversation_id || !payload?.event_type) {
      return new Response("bad payload", { status: 400, headers: corsHeaders });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupère le client de la conversation
    const { data: conv } = await sb
      .from("chat_conversations")
      .select("client_id, subject")
      .eq("id", payload.conversation_id)
      .single();

    if (!conv) {
      return new Response("conversation not found", { status: 404, headers: corsHeaders });
    }

    const { data: client } = await sb
      .from("clients")
      .select("first_name, last_name")
      .eq("id", conv.client_id)
      .single();

    const clientName = client
      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client"
      : "Client";

    // Récupère le nom de l'admin qui a fait l'action
    const { data: actorRole } = await sb
      .from("user_roles")
      .select("first_name, last_name")
      .eq("user_id", payload.changed_by_admin_user_id)
      .maybeSingle();

    const actorName = actorRole
      ? `${actorRole.first_name ?? ""} ${actorRole.last_name ?? ""}`.trim() || "Admin"
      : "Admin";

    // Récupère le nom du nouvel assigné (si applicable)
    let newAdminName: string | null = null;
    if (payload.new_admin_user_role_id) {
      const { data: newRole } = await sb
        .from("user_roles")
        .select("first_name, last_name")
        .eq("id", payload.new_admin_user_role_id)
        .maybeSingle();
      if (newRole) {
        newAdminName = `${newRole.first_name ?? ""} ${newRole.last_name ?? ""}`.trim() || "Admin";
      }
    }

    let text: string;
    switch (payload.event_type) {
      case "claim":
        text = `👤 *${escapeMd(actorName)}* a pris en charge la conv de *${escapeMd(clientName)}*`;
        break;
      case "assign":
        text = `📌 *${escapeMd(actorName)}* a assigné la conv de *${escapeMd(clientName)}* à *${escapeMd(newAdminName ?? "Admin")}*`;
        break;
      case "unassign":
        text = `↩️ *${escapeMd(actorName)}* a désassigné la conv de *${escapeMd(clientName)}*`;
        break;
    }

    if (conv.subject) {
      text += `\n📝 _${escapeMd(conv.subject)}_`;
    }
    text += `\n👉 ${ADMIN_BASE_URL}/m/support/${payload.conversation_id}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!tgRes.ok) {
      const body = await tgRes.text();
      console.error("Telegram API error", tgRes.status, body);
      return new Response(`telegram error: ${body}`, { status: 500, headers: corsHeaders });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("notify-admin-assignment error", e);
    return new Response(`error: ${(e as Error).message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function escapeMd(s: string): string {
  return s.replace(/([_*`[])/g, "\\$1");
}
