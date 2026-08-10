// ============================================================
// Drainer SMS — Edge Function, déclenchée par pg_cron toutes les minutes.
//
// Réserve un lot via claim_sms_batch(), résout l'expéditeur selon le pays de
// destination, rend le gabarit dans la langue du client, puis envoie via
// l'API Telnyx v2. Jumeau exact de send-email : mêmes garanties.
//
// GARANTIES :
//  - Découplage : hors de la transaction métier. Telnyx en panne ⇒ lignes
//    'failed' retentées ; aucun paiement ni dépôt impacté.
//  - Idempotence : contrainte UNIQUE sur sms_outbox.idempotency_key + bail
//    de 2 min posé par claim_sms_batch (aucun run concurrent ne double).
//  - Suppression : jamais d'envoi vers un numéro ayant répondu STOP. La
//    vérification a lieu AVANT l'envoi, pas après.
//  - Backoff : next_attempt_at = now() + 2^attempts minutes, plafonné.
//  - Erreurs 4xx définitives : on cesse de retenter (attempts = max) plutôt
//    que de brûler cinq tentatives sur un numéro structurellement invalide.
//
// EXPÉDITEUR : resolve_sms_sender() renvoie 'long_code' tant que l'ID
// alphanumérique n'est pas enregistré chez l'opérateur — un « Bonzini » non
// enregistré serait réécrit ou jeté (MTN Cameroun notamment). Le message
// part donc du numéro acheté et ARRIVE, ce qui est toujours préférable.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { renderSms, resolveLocale } from "../_shared/sms-templates.ts";

const TELNYX_API = "https://api.telnyx.com/v2/messages";
const BATCH = Number(Deno.env.get("SMS_BATCH_SIZE") ?? "20");

/** Numéro Telnyx acheté — expéditeur de repli, et seul choix aux US/Canada. */
const LONG_CODE = Deno.env.get("TELNYX_PHONE_NUMBER") ?? "";
/** Obligatoire dès qu'on envoie depuis un ID alphanumérique. */
const PROFILE_ID = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID") ?? "";

interface SendResult {
  ok: boolean;
  id?: string;
  parts?: number;
  error?: string;
  /** true ⇒ erreur définitive : inutile de retenter. */
  permanent?: boolean;
}

async function sendViaTelnyx(
  apiKey: string,
  from: string,
  to: string,
  text: string,
): Promise<SendResult> {
  const body: Record<string, unknown> = { to, text, type: "SMS" };

  if (from) body.from = from;
  // messaging_profile_id est requis pour un expéditeur alphanumérique ; le
  // fournir systématiquement quand il est configuré ne coûte rien.
  if (PROFILE_ID) body.messaging_profile_id = PROFILE_ID;

  let resp: Response;
  try {
    resp = await fetch(TELNYX_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Panne réseau : toujours retentable.
    return { ok: false, error: `network: ${String(e).slice(0, 200)}` };
  }

  if (resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const payload = data?.data ?? {};
    return {
      ok: true,
      id: payload?.id,
      parts: typeof payload?.parts === "number" ? payload.parts : undefined,
    };
  }

  const detail = await resp.text().catch(() => "");
  // 429 et 5xx : transitoires. Les autres 4xx (numéro invalide, profil mal
  // configuré, ID d'expéditeur refusé) ne s'arrangeront pas tout seuls.
  const permanent = resp.status >= 400 && resp.status < 500 && resp.status !== 429;
  return {
    ok: false,
    permanent,
    error: `${resp.status} ${detail}`.slice(0, 500),
  };
}

/** Comparaison à temps constant — évite un canal temporel sur le secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

serve(async (req) => {
  // POST uniquement : un GET ne doit jamais déclencher un run d'envoi.
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Auth interne obligatoire, fail-closed : sans secret configuré, on refuse.
  const secret = Deno.env.get("SMS_DRAINER_SECRET");
  if (!secret) return new Response("Missing SMS_DRAINER_SECRET", { status: 500 });
  const incoming = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(incoming, secret)) return new Response("Unauthorized", { status: 401 });

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) return new Response("Missing TELNYX_API_KEY", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: batch, error: claimErr } = await supabase.rpc("claim_sms_batch", { p_limit: BATCH });
  if (claimErr) {
    console.error("claim_sms_batch error:", claimErr.message);
    return new Response("claim error", { status: 500 });
  }

  const rows = (batch ?? []) as Array<Record<string, unknown>>;
  let sent = 0, failed = 0, skipped = 0;

  for (const row of rows) {
    const id = row.id as string;
    const to = ((row.recipient_phone as string) ?? "").trim();
    const country = (row.recipient_country as string) ?? "";
    const template = row.template as string;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const attempts = Number(row.attempts ?? 0);
    const locale = resolveLocale(row.locale);

    // a. Pas de numéro exploitable.
    if (!to) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: "no phone" }).eq("id", id);
      skipped++; continue;
    }

    // b. Numéro supprimé (STOP, invalide, injoignable) → jamais d'envoi.
    const { data: supp } = await supabase
      .from("sms_suppressions").select("phone_e164").eq("phone_e164", to).maybeSingle();
    if (supp) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: "suppressed" }).eq("id", id);
      skipped++; continue;
    }

    // c. Rendu. Gabarit inconnu ⇒ on saute cette ligne sans faire tomber le lot.
    const rendered = renderSms(template, locale, payload);
    if (!rendered) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: `unknown template: ${template}` }).eq("id", id);
      skipped++; continue;
    }

    // d. Expéditeur selon le pays de destination.
    const { data: senderRows } = await supabase.rpc("resolve_sms_sender", { p_country: country });
    const sender = Array.isArray(senderRows) ? senderRows[0] : senderRows;
    const useAlpha = sender?.sender_type === "alphanumeric" && !!sender?.sender_id;
    const from = useAlpha ? String(sender.sender_id) : LONG_CODE;

    if (!from) {
      // Ni ID alphanumérique utilisable, ni numéro long configuré : rien à
      // présenter à Telnyx. Erreur de configuration, pas de donnée.
      await supabase.from("sms_outbox").update({
        status: "failed",
        attempts: Number(row.max_attempts ?? 5),
        last_error: "no sender configured (TELNYX_PHONE_NUMBER manquant)",
      }).eq("id", id);
      failed++; continue;
    }

    const result = await sendViaTelnyx(apiKey, from, to, rendered.text);

    if (result.ok) {
      const update: Record<string, unknown> = {
        status: "sent",
        sent_at: new Date().toISOString(),
        telnyx_message_id: result.id ?? null,
        sender_used: from,
        segments: result.parts ?? rendered.measure.segments,
        attempts: attempts + 1,
        last_error: null,
      };

      // Les messages de sécurité transportent un code à usage unique dans
      // leur payload. Une fois parti, ce code n'a plus aucune raison de
      // rester au repos dans une table que les admins peuvent lire : on le
      // purge, en gardant la ligne pour la traçabilité.
      if (row.category === "security") update.payload = {};

      await supabase.from("sms_outbox").update(update).eq("id", id);
      sent++;

      // Un segment > 1 signifie qu'un gabarit a basculé en UCS-2 : le coût a
      // doublé sans que personne ne l'ait décidé. On le journalise fort.
      const parts = result.parts ?? rendered.measure.segments;
      if (parts > 1) {
        console.warn(
          `send-sms ${id}: ${parts} segments (${rendered.measure.encoding}) — gabarit ${template}/${locale} à corriger`,
        );
      }
    } else {
      const nextAttempts = attempts + 1;
      const backoffMin = Math.min(2 ** nextAttempts, 120); // 2,4,8… plafonné à 2 h
      await supabase.from("sms_outbox").update({
        status: "failed",
        // Erreur définitive : on épuise le compteur pour ne plus retenter.
        attempts: result.permanent ? Number(row.max_attempts ?? 5) : nextAttempts,
        sender_used: from,
        last_error: result.error ?? "unknown",
        next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      }).eq("id", id);
      failed++;
      console.error(
        `send-sms ${id}: ${(result.error ?? "").replace(/[\r\n\t]/g, " ").slice(0, 200)}`,
      );
    }
  }

  const summary = { claimed: rows.length, sent, failed, skipped };
  console.log("send-sms run:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
