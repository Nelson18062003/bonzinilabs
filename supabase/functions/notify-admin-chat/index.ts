// supabase/functions/notify-admin-chat/index.ts
// Reçoit les webhooks Supabase déclenchés sur INSERT chat_messages
// (filter sender_type=client) et notifie le groupe Telegram admin.
//
// Configuration Supabase Dashboard:
//   Database → Webhooks → New Webhook
//   Table: chat_messages
//   Events: Insert
//   Type: HTTP Request → POST
//   URL: https://<project>.functions.supabase.co/notify-admin-chat
//   HTTP Headers: Authorization = Bearer <SERVICE_ROLE_KEY>
//
// Le payload Supabase Webhook a la forme:
//   { type: 'INSERT', table: 'chat_messages', record: {...}, schema: 'public' }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_BASE_URL = Deno.env.get("ADMIN_BASE_URL") ?? "https://app.bonzini.com";

const SPAM_WINDOW_SECONDS = 30;

interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  sender_type: "client" | "admin";
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ChatMessageRecord;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;

    if (payload.type !== "INSERT" || payload.table !== "chat_messages") {
      return new Response("ignored", { status: 200 });
    }

    const msg = payload.record;
    if (msg.sender_type !== "client") {
      return new Response("not a client message", { status: 200 });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Anti-spam: si un autre message client de cette conv a été reçu
    // dans les SPAM_WINDOW_SECONDS dernières secondes, on n'envoie pas
    // de nouvelle notif Telegram (les admins en ont déjà eu une).
    const windowStart = new Date(
      new Date(msg.created_at).getTime() - SPAM_WINDOW_SECONDS * 1000
    ).toISOString();

    const { data: recent } = await sb
      .from("chat_messages")
      .select("id")
      .eq("conversation_id", msg.conversation_id)
      .eq("sender_type", "client")
      .gte("created_at", windowStart)
      .lt("created_at", msg.created_at)
      .limit(1);

    if (recent && recent.length > 0) {
      return new Response("debounced", { status: 200 });
    }

    // Récupère le client
    const { data: conv } = await sb
      .from("chat_conversations")
      .select("client_id")
      .eq("id", msg.conversation_id)
      .single();

    if (!conv) {
      return new Response("conversation not found", { status: 404 });
    }

    const { data: client } = await sb
      .from("clients")
      .select("first_name, last_name, phone")
      .eq("id", conv.client_id)
      .single();

    const clientName = client
      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client"
      : "Client";
    const clientPhone = client?.phone ? ` (${client.phone})` : "";

    const mediaEmoji: Record<string, string> = {
      image: "🖼️ Photo",
      voice: "🎤 Message vocal",
      video: "🎥 Vidéo",
      file: "📎 Fichier",
    };
    const preview = msg.content
      ? msg.content.length > 120
        ? msg.content.slice(0, 117) + "..."
        : msg.content
      : (msg.media_type && mediaEmoji[msg.media_type]) || "📎 Pièce jointe";

    const text = [
      "💬 *Nouveau message support*",
      "",
      `👤 ${escapeMd(clientName)}${escapeMd(clientPhone)}`,
      `💭 ${escapeMd(preview)}`,
      "",
      `👉 ${ADMIN_BASE_URL}/m/support/${msg.conversation_id}`,
    ].join("\n");

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
      return new Response(`telegram error: ${body}`, { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("notify-admin-chat error", e);
    return new Response(`error: ${(e as Error).message}`, { status: 500 });
  }
});

// Échappe les caractères spéciaux Markdown V1 utilisés par sendMessage.
function escapeMd(s: string): string {
  return s.replace(/([_*`[])/g, "\\$1");
}
