import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ───────────────────────────────────────────────────────────────────

const TZ = "Africa/Douala"; // WAT UTC+1

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatXAF(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function formatRMB(amount: number): string {
  return "¥\u202F" + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount);
}

function formatDate(iso: unknown): string {
  if (!iso) return "";
  return new Date(iso as string).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function depositMethod(m: unknown): string {
  const map: Record<string, string> = {
    bank_transfer:   "🏦 Virement bancaire",
    bank_cash:       "🏧 Dépôt bancaire (espèces)",
    agency_cash:     "🏪 Agence (espèces)",
    om_transfer:     "🟠 Orange Money",
    om_withdrawal:   "🟠 Orange Money (retrait)",
    mtn_transfer:    "🟡 MTN MoMo",
    mtn_withdrawal:  "🟡 MTN MoMo (retrait)",
    wave:            "🌊 Wave",
  };
  return map[m as string] ?? String(m ?? "N/A");
}

function paymentMethod(m: unknown): string {
  const map: Record<string, string> = {
    alipay:        "🔵 Alipay",
    wechat:        "💚 WeChat Pay",
    bank_transfer: "🏦 Virement bancaire",
    cash:          "💵 Cash",
  };
  return map[m as string] ?? String(m ?? "N/A");
}

const DEPOSIT_STATUS: Record<string, string> = {
  created:            "✨ Créé",
  awaiting_proof:     "⏳ En attente de justificatif",
  proof_submitted:    "📄 Justificatif soumis",
  admin_review:       "🔍 En cours de revue",
  validated:          "✅ Validé",
  rejected:           "❌ Rejeté",
  pending_correction: "✏️ Correction demandée",
  cancelled:          "🚫 Annulé",
};

const PAYMENT_STATUS: Record<string, string> = {
  created:                  "✨ Créé",
  waiting_beneficiary_info: "⏳ Infos bénéficiaire manquantes",
  ready_for_payment:        "🟢 Prêt pour paiement",
  processing:               "⚙️ En traitement",
  completed:                "✅ Complété",
  rejected:                 "❌ Rejeté",
  cash_pending:             "💵 Cash en attente",
  cash_scanned:             "📷 QR scanné",
};

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegramMessage(text: string): Promise<void> {
  const token  = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) { console.error("Missing Telegram env vars"); return; }

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!resp.ok) console.error("Telegram error:", resp.status, await resp.text());
  else console.log("Telegram OK");
}

// ─── DB lookup ────────────────────────────────────────────────────────────────

async function getClient(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ name: string; company?: string }> {
  const { data } = await supabase
    .from("clients")
    .select("first_name, last_name, company_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { name: `ID: ${userId.slice(0, 8)}…` };
  const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Client inconnu";
  return { name, company: data.company_name ?? undefined };
}

function clientLine(c: { name: string; company?: string }): string {
  return c.company
    ? `👤 <b>${c.name}</b>\n🏢 ${c.company}`
    : `👤 <b>${c.name}</b>`;
}

// ─── Header emoji for status transitions ─────────────────────────────────────

function headerEmoji(status: string, kind: "deposit" | "payment"): string {
  if (status === "validated" || status === "completed") return "✅";
  if (status === "rejected") return "❌";
  if (status === "pending_correction") return "✏️";
  if (status === "processing") return "⚙️";
  if (status === "cancelled") return "🚫";
  if (kind === "deposit") return "🔄";
  return "🔄";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (secret) {
    const incoming = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (incoming !== secret) return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    type: string; table: string; schema: string;
    record: Record<string, unknown>;
    old_record?: Record<string, unknown> | null;
  };

  try { payload = await req.json(); }
  catch { return new Response("Bad Request", { status: 400 }); }

  const { type, table, record, old_record } = payload;
  console.log(`Webhook: ${type} on ${table}`);

  if (payload.schema !== "public") return new Response("OK", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  let message = "";

  try {

    // ── 1. Nouveau client ─────────────────────────────────────────────────────
    if (table === "clients" && type === "INSERT") {
      const name = `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "Inconnu";
      const company = record.company_name ? `\n🏢 <b>${record.company_name}</b>` : "";
      const location = [record.city, record.country].filter(Boolean).join(" · ") || "N/A";
      const kyc = record.kyc_verified ? "✅ Vérifié" : "⚠️ Non vérifié";

      message =
        `👤 <b>NOUVEAU CLIENT INSCRIT</b>\n\n` +
        `Nom : <b>${name}</b>${company}\n` +
        `📱 ${record.phone ?? "N/A"}\n` +
        `📧 ${record.email ?? "N/A"}\n` +
        `🌍 ${location}\n\n` +
        `🔐 KYC : ${kyc}\n` +
        `🕐 ${formatDate(record.created_at)}`;
    }

    // ── 2. Nouveau taux de change ─────────────────────────────────────────────
    else if (table === "exchange_rates" && type === "INSERT") {
      const rate = Number(record.rate_xaf_to_rmb);
      const xafPerRmb = rate > 0 ? Math.round(1 / rate) : 0;

      // Fetch previous rate for comparison
      const { data: prev } = await supabase
        .from("exchange_rates")
        .select("rate_xaf_to_rmb")
        .lt("created_at", record.created_at as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let variation = "";
      if (prev) {
        const prevXaf = Math.round(1 / Number(prev.rate_xaf_to_rmb));
        const diff = xafPerRmb - prevXaf;
        const pct = ((diff / prevXaf) * 100).toFixed(1);
        const arrow = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
        variation =
          `\n${arrow} Variation : ${diff > 0 ? "+" : ""}${diff} XAF (${diff > 0 ? "+" : ""}${pct}%)\n` +
          `💱 Ancien taux : 1 RMB = ${new Intl.NumberFormat("fr-FR").format(prevXaf)} XAF`;
      }

      message =
        `📈 <b>NOUVEAU TAUX DE CHANGE</b>\n\n` +
        `💱 <b>1 RMB = ${new Intl.NumberFormat("fr-FR").format(xafPerRmb)} XAF</b>` +
        `${variation}\n\n` +
        `🕐 ${formatDate(record.created_at ?? record.effective_at)}`;
    }

    // ── 3. Nouvelle demande de dépôt ──────────────────────────────────────────
    else if (table === "deposits" && type === "INSERT") {
      const client = await getClient(supabase, record.user_id as string);
      const method = depositMethod(record.method);
      let extra = "";
      if (record.bank_name)   extra += `\n🏦 Banque : ${record.bank_name}`;
      if (record.agency_name) extra += `\n🏪 Agence : ${record.agency_name}`;

      message =
        `💰 <b>NOUVELLE DEMANDE DE DÉPÔT</b>\n\n` +
        `${clientLine(client)}\n` +
        `💵 Montant : <b>${formatXAF(Number(record.amount_xaf))}</b>\n` +
        `${method}${extra}\n` +
        `📋 Réf : <code>${record.reference}</code>\n\n` +
        `🕐 ${formatDate(record.created_at)}`;
    }

    // ── 4. Statut dépôt modifié ───────────────────────────────────────────────
    else if (table === "deposits" && type === "UPDATE") {
      if (!old_record || old_record.status === record.status) {
        return new Response("OK", { status: 200 });
      }
      const client   = await getClient(supabase, record.user_id as string);
      const oldLabel = DEPOSIT_STATUS[old_record.status as string] ?? String(old_record.status);
      const newLabel = DEPOSIT_STATUS[record.status as string]     ?? String(record.status);
      const emoji    = headerEmoji(record.status as string, "deposit");

      let extra = "";
      if (record.admin_comment)    extra += `\n💬 Note : <i>${record.admin_comment}</i>`;
      if (record.rejection_reason) extra += `\n🚫 Motif : <i>${record.rejection_reason}</i>`;
      if (record.confirmed_amount_xaf && record.confirmed_amount_xaf !== record.amount_xaf) {
        extra += `\n⚠️ Montant confirmé : <b>${formatXAF(Number(record.confirmed_amount_xaf))}</b>`;
      }

      message =
        `${emoji} <b>DÉPÔT — STATUT MODIFIÉ</b>\n\n` +
        `${clientLine(client)}\n` +
        `💵 ${formatXAF(Number(record.amount_xaf))} · <code>${record.reference}</code>\n\n` +
        `${oldLabel}\n` +
        `      ⬇️\n` +
        `<b>${newLabel}</b>${extra}\n\n` +
        `🕐 ${formatDate(record.updated_at)}`;
    }

    // ── 5. Nouvelle demande de paiement ───────────────────────────────────────
    else if (table === "payments" && type === "INSERT") {
      const client = await getClient(supabase, record.user_id as string);
      const method = paymentMethod(record.method);
      const beneficiary = record.beneficiary_name
        ? `\n👨‍💼 Bénéficiaire : <b>${record.beneficiary_name}</b>`
        : "";

      message =
        `💸 <b>NOUVELLE DEMANDE DE PAIEMENT</b>\n\n` +
        `${clientLine(client)}\n` +
        `💵 <b>${formatXAF(Number(record.amount_xaf))}</b> → <b>${formatRMB(Number(record.amount_rmb))}</b>\n` +
        `${method}${beneficiary}\n` +
        `📋 Réf : <code>${record.reference}</code>\n\n` +
        `🕐 ${formatDate(record.created_at)}`;
    }

    // ── 6. Statut paiement modifié ────────────────────────────────────────────
    else if (table === "payments" && type === "UPDATE") {
      if (!old_record || old_record.status === record.status) {
        return new Response("OK", { status: 200 });
      }
      const client   = await getClient(supabase, record.user_id as string);
      const oldLabel = PAYMENT_STATUS[old_record.status as string] ?? String(old_record.status);
      const newLabel = PAYMENT_STATUS[record.status as string]     ?? String(record.status);
      const emoji    = headerEmoji(record.status as string, "payment");

      let extra = "";
      if (record.client_visible_comment) extra += `\n💬 Note : <i>${record.client_visible_comment}</i>`;
      if (record.rejection_reason)       extra += `\n🚫 Motif : <i>${record.rejection_reason}</i>`;

      message =
        `${emoji} <b>PAIEMENT — STATUT MODIFIÉ</b>\n\n` +
        `${clientLine(client)}\n` +
        `💵 ${formatXAF(Number(record.amount_xaf))} → ${formatRMB(Number(record.amount_rmb))} · <code>${record.reference}</code>\n\n` +
        `${oldLabel}\n` +
        `      ⬇️\n` +
        `<b>${newLabel}</b>${extra}\n\n` +
        `🕐 ${formatDate(record.updated_at)}`;
    }

  } catch (err) {
    console.error("Error building message:", err);
    return new Response("Internal Error", { status: 500 });
  }

  if (message) await sendTelegramMessage(message);
  else console.log(`No handler for ${type} on ${table} — skipped`);

  return new Response("OK", { status: 200 });
});
