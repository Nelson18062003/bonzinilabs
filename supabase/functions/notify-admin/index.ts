import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatXAF(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function formatRMB(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
      amount
    ) + " ¥"
  );
}

function translateDepositStatus(status: string): string {
  const map: Record<string, string> = {
    created: "Créé",
    awaiting_proof: "En attente de justificatif",
    proof_submitted: "Justificatif soumis",
    admin_review: "En cours de revue",
    validated: "Validé ✅",
    rejected: "Rejeté ❌",
    pending_correction: "Correction demandée",
    cancelled: "Annulé",
  };
  return map[status] ?? status;
}

function translatePaymentStatus(status: string): string {
  const map: Record<string, string> = {
    created: "Créé",
    waiting_beneficiary_info: "En attente d'infos bénéficiaire",
    ready_for_payment: "Prêt pour paiement",
    processing: "En traitement",
    completed: "Complété ✅",
    rejected: "Rejeté ❌",
    cash_pending: "Cash en attente",
    cash_scanned: "QR scanné",
  };
  return map[status] ?? status;
}

// ─── Telegram sender ──────────────────────────────────────────────────────────

async function sendTelegramMessage(message: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("Telegram API error:", resp.status, err);
  } else {
    console.log("Telegram message sent OK");
  }
}

// ─── Client name lookup ───────────────────────────────────────────────────────

async function getClientName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("clients")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
  }
  return `User ${userId.slice(0, 8)}…`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Validate optional webhook secret
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const incoming = auth.replace(/^Bearer\s+/i, "");
    if (incoming !== secret) {
      console.warn("Unauthorized webhook call — invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: {
    type: string;
    table: string;
    schema: string;
    record: Record<string, unknown>;
    old_record?: Record<string, unknown> | null;
  };

  try {
    payload = await req.json();
  } catch {
    console.error("Invalid JSON body");
    return new Response("Bad Request", { status: 400 });
  }

  const { type, table, record, old_record } = payload;

  console.log(`Webhook received: ${type} on ${table}`);

  // Only handle public schema events we care about
  if (payload.schema !== "public") {
    return new Response("OK", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  let message = "";

  try {
    // ── Nouveau client ────────────────────────────────────────────────────────
    if (table === "clients" && type === "INSERT") {
      const name =
        `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() ||
        "Inconnu";
      message =
        `🆕 <b>Nouveau client inscrit</b>\n` +
        `Nom : ${name}\n` +
        `Tél : ${record.phone ?? "N/A"}\n` +
        `Email : ${record.email ?? "N/A"}\n` +
        `Pays : ${record.country ?? "N/A"}`;
    }

    // ── Nouveau taux de change ────────────────────────────────────────────────
    else if (table === "exchange_rates" && type === "INSERT") {
      const rate = Number(record.rate_xaf_to_rmb);
      const xafPerRmb = rate > 0 ? Math.round(1 / rate) : "N/A";
      const date = record.created_at
        ? new Date(record.created_at as string).toLocaleString("fr-FR")
        : "N/A";
      message =
        `📈 <b>Nouveau taux de change défini</b>\n` +
        `1 RMB = ${xafPerRmb} XAF\n` +
        `Défini le : ${date}`;
    }

    // ── Nouvelle demande de dépôt ─────────────────────────────────────────────
    else if (table === "deposits" && type === "INSERT") {
      const clientName = await getClientName(supabase, record.user_id as string);
      message =
        `💰 <b>Nouvelle demande de dépôt</b>\n` +
        `Client : ${clientName}\n` +
        `Montant : ${formatXAF(Number(record.amount_xaf))}\n` +
        `Méthode : ${record.method ?? "N/A"}\n` +
        `Réf : <code>${record.reference}</code>`;
    }

    // ── Changement de statut dépôt ────────────────────────────────────────────
    else if (table === "deposits" && type === "UPDATE") {
      if (!old_record || old_record.status === record.status) {
        // Status didn't change — nothing to notify
        return new Response("OK", { status: 200 });
      }
      const clientName = await getClientName(supabase, record.user_id as string);
      const oldStatus = translateDepositStatus(old_record.status as string);
      const newStatus = translateDepositStatus(record.status as string);
      message =
        `🔄 <b>Dépôt mis à jour</b>\n` +
        `Réf : <code>${record.reference}</code>\n` +
        `Client : ${clientName}\n` +
        `Montant : ${formatXAF(Number(record.amount_xaf))}\n` +
        `Statut : ${oldStatus} → <b>${newStatus}</b>`;
    }

    // ── Nouvelle demande de paiement ──────────────────────────────────────────
    else if (table === "payments" && type === "INSERT") {
      const clientName = await getClientName(supabase, record.user_id as string);
      message =
        `💸 <b>Nouvelle demande de paiement</b>\n` +
        `Client : ${clientName}\n` +
        `Montant : ${formatXAF(Number(record.amount_xaf))} → ${formatRMB(Number(record.amount_rmb))}\n` +
        `Méthode : ${record.method ?? "N/A"}\n` +
        `Réf : <code>${record.reference}</code>`;
    }

    // ── Changement de statut paiement ─────────────────────────────────────────
    else if (table === "payments" && type === "UPDATE") {
      if (!old_record || old_record.status === record.status) {
        return new Response("OK", { status: 200 });
      }
      const clientName = await getClientName(supabase, record.user_id as string);
      const oldStatus = translatePaymentStatus(old_record.status as string);
      const newStatus = translatePaymentStatus(record.status as string);
      message =
        `🔄 <b>Paiement mis à jour</b>\n` +
        `Réf : <code>${record.reference}</code>\n` +
        `Client : ${clientName}\n` +
        `Montant : ${formatXAF(Number(record.amount_xaf))}\n` +
        `Statut : ${oldStatus} → <b>${newStatus}</b>`;
    }
  } catch (err) {
    console.error("Error building message:", err);
    return new Response("Internal Error", { status: 500 });
  }

  if (message) {
    await sendTelegramMessage(message);
  } else {
    console.log(`No handler for ${type} on ${table} — skipped`);
  }

  return new Response("OK", { status: 200 });
});
