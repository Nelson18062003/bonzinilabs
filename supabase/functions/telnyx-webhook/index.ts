// ============================================================
// Webhook Telnyx — accusés de délivrance + messages entrants (STOP).
//
// DEUX RESPONSABILITÉS :
//  1. DLR : Telnyx confirme (ou non) la remise réelle au combiné. Le statut
//     'sent' de notre outbox ne veut dire que « accepté par Telnyx » ; c'est
//     ce webhook qui dit si le message est ARRIVÉ. Sans lui, on ne saurait
//     pas qu'un ID d'expéditeur non enregistré fait jeter tout le trafic
//     d'un pays.
//  2. STOP entrant : obligation opérateur. Un client qui répond STOP doit
//     être coupé pour TOUT envoi, transactionnel compris.
//
//     ⚠️ PORTÉE RÉELLE, vérifiée en production : quand le message part sous
//     l'expéditeur alphanumérique « Bonzini », il est À SENS UNIQUE et le
//     client ne PEUT PAS répondre — aucun STOP n'arrivera jamais ici pour
//     ces envois-là. Ce traitement ne couvre donc que les messages partis
//     d'un vrai numéro (destinations où l'alphanumérique est interdit :
//     États-Unis, Canada). Le retrait du consentement pour tout le reste
//     doit passer par un réglage dans l'application — ce n'est pas un
//     confort, c'est la seule voie de sortie qui existe.
//
// SÉCURITÉ :
//  - Signature Ed25519 vérifiée (fail-closed : sans clé publique
//    configurée, on refuse tout). Sans cette vérification, n'importe qui
//    pourrait poster un faux STOP et couper les alertes d'un client, ou
//    falsifier des accusés de délivrance.
//  - Anti-rejeu : horodatage refusé au-delà de 5 minutes.
//  - Le corps est une donnée EXTERNE non fiable : aucune valeur n'est
//    interpolée ailleurs que dans des requêtes paramétrées.
//
// BUDGET DE RÉPONSE : Telnyx attend un 2xx en moins de 2000 ms, sinon il
// retente. Le traitement se limite donc à une écriture indexée. Et comme
// toutes les opérations sont idempotentes (upsert sur la clé du numéro,
// UPDATE conditionnel sur telnyx_message_id), une retentative après un
// démarrage à froid trop lent est sans conséquence.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Au-delà, la requête est considérée comme un rejeu. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

const STOP_WORDS = /^\s*(stop|arret|arr[êe]t|unsubscribe|desabonner|d[ée]sabonner|cancel|quit|end)\b/i;
const START_WORDS = /^\s*(start|unstop|debut|d[ée]but|subscribe)\b/i;

/**
 * Statuts de remise de `data.payload.to[].status`.
 *
 * TERMINAL : le sort du message est scellé, plus rien ne doit l'écraser.
 * 'delivery_unconfirmed' en fait partie : l'opérateur n'a jamais confirmé et
 * ne confirmera pas — ce n'est ni un succès ni un échec, mais c'est définitif.
 */
const TERMINAL_STATUSES = new Set([
  "delivered",
  "delivery_failed",
  "sending_failed",
  "delivery_unconfirmed",
]);

/** Statuts intermédiaires, qu'un statut terminal a le droit de remplacer. */
const TRANSIENT_STATUSES = new Set(["queued", "sending", "sent"]);

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Vérifie la signature Ed25519 de Telnyx.
 * Charge utile signée : `${timestamp}|${rawBody}`.
 */
async function verifySignature(
  publicKeyB64: string,
  signatureB64: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(publicKeyB64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      base64ToBytes(signatureB64),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (e) {
    console.error("telnyx-webhook: échec de vérification de signature:", String(e).slice(0, 200));
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const publicKey = Deno.env.get("TELNYX_PUBLIC_KEY");
  if (!publicKey) {
    // Fail-closed : mieux vaut perdre des accusés de délivrance que
    // d'accepter des STOP falsifiés.
    console.error("telnyx-webhook: TELNYX_PUBLIC_KEY absent — requête refusée");
    return new Response("Missing TELNYX_PUBLIC_KEY", { status: 500 });
  }

  const signature = req.headers.get("telnyx-signature-ed25519") ?? "";
  const timestamp = req.headers.get("telnyx-timestamp") ?? "";
  if (!signature || !timestamp) return new Response("Missing signature headers", { status: 401 });

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) {
    return new Response("Stale signature", { status: 401 });
  }

  const rawBody = await req.text();
  if (!(await verifySignature(publicKey, signature, timestamp, rawBody))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const data = (event?.data ?? {}) as Record<string, unknown>;
  const eventType = String(data?.event_type ?? "");
  const payload = (data?.payload ?? {}) as Record<string, unknown>;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── 1. Message entrant : STOP / START ──────────────────────────────────
  if (eventType === "message.received") {
    const from = (payload?.from ?? {}) as Record<string, unknown>;
    const phone = String(from?.phone_number ?? "").trim();
    const text = String(payload?.text ?? "");

    if (phone) {
      if (STOP_WORDS.test(text)) {
        await supabase.from("sms_suppressions")
          .upsert(
            { phone_e164: phone, reason: "stop", source: "telnyx:message.received" },
            { onConflict: "phone_e164" },
          );
        console.log(`telnyx-webhook: STOP enregistré pour ${phone.slice(0, 5)}***`);
      } else if (START_WORDS.test(text)) {
        // Réabonnement explicite : on lève UNIQUEMENT une suppression issue
        // d'un STOP. Un numéro invalide ou injoignable le reste.
        await supabase.from("sms_suppressions")
          .delete().eq("phone_e164", phone).eq("reason", "stop");
        console.log(`telnyx-webhook: START enregistré pour ${phone.slice(0, 5)}***`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // ── 2. Accusé de délivrance sur un message sortant ─────────────────────
  //
  // Telnyx émet DEUX événements par message sortant : 'message.sent' puis
  // 'message.finalized'. Les webhooks sont au mieux-effort et peuvent arriver
  // DANS LE DÉSORDRE — un 'message.sent' en retard écraserait alors le
  // 'delivered' déjà enregistré, et le tableau de bord afficherait un message
  // « en cours » alors qu'il est arrivé depuis longtemps.
  //
  // On n'écrase donc jamais un statut terminal par un statut intermédiaire.
  // Le filtre est appliqué côté SQL (et non lu-puis-écrit) pour rester correct
  // même si deux webhooks sont traités en parallèle.
  const messageId = String(payload?.id ?? "");
  if (messageId) {
    const recipients = Array.isArray(payload?.to) ? payload.to as Array<Record<string, unknown>> : [];
    const deliveryStatus = String(recipients[0]?.status ?? eventType);

    let query = supabase.from("sms_outbox")
      .update({ delivery_status: deliveryStatus })
      .eq("telnyx_message_id", messageId);

    if (!TERMINAL_STATUSES.has(deliveryStatus)) {
      query = query.or(
        `delivery_status.is.null,delivery_status.in.(${[...TRANSIENT_STATUSES].join(",")})`,
      );
    }

    const { error } = await query;

    if (error) {
      console.error("telnyx-webhook: mise à jour du DLR impossible:", error.message);
    }

    // Échec définitif de remise : on note le numéro pour éviter de repayer
    // le même échec à chaque événement futur.
    // 'sending_failed' (Telnyx n'a pas pu remettre à l'opérateur) compte
    // autant que 'delivery_failed' (l'opérateur n'a pas pu remettre au combiné).
    if (deliveryStatus === "delivery_failed" || deliveryStatus === "sending_failed") {
      const phone = String(recipients[0]?.phone_number ?? "").trim();
      const errors = Array.isArray(payload?.errors) ? payload.errors as Array<Record<string, unknown>> : [];
      const detail = String(errors[0]?.detail ?? errors[0]?.title ?? "").slice(0, 200);
      console.warn(`telnyx-webhook: remise échouée pour ${messageId}: ${detail}`);

      // Uniquement pour un numéro structurellement invalide — pas pour un
      // combiné éteint ou un réseau momentanément indisponible.
      //
      // ⚠️ ignoreDuplicates : on n'ÉCRASE JAMAIS une suppression existante.
      // Un accusé d'échec arrivant après un STOP écrasait sinon le motif
      // 'stop' par 'invalid' — et comme un START ne lève que les lignes
      // marquées 'stop', le client restait bloqué pour toujours, sans
      // moyen de se réabonner autrement qu'à la main.
      if (phone && /invalid|not a valid|unallocated|unknown subscriber/i.test(detail)) {
        await supabase.from("sms_suppressions").upsert(
          { phone_e164: phone, reason: "invalid", source: `telnyx:${messageId}` },
          { onConflict: "phone_e164", ignoreDuplicates: true },
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
