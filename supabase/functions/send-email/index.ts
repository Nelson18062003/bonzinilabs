// ============================================================
// Chantier B — Lot B4 — Drainer d'emails (Edge Function)
//
// Déclenché par pg_cron (toutes les minutes). Réserve un lot via
// claim_email_batch(), envoie chaque email via l'API REST Resend avec
// un Idempotency-Key, puis marque sent/failed/skipped.
//
// GARANTIES :
//  - Découplage : cette fonction est hors de la transaction métier. Si
//    Resend est down, les lignes restent 'failed' et seront retentées ;
//    aucun paiement/dépôt n'est impacté (déjà commité en amont).
//  - Idempotence : 2 couches — la contrainte UNIQUE de l'outbox (enqueue)
//    + l'en-tête Idempotency-Key de Resend (fenêtre 24 h) ci-dessous.
//  - Suppression : on n'envoie jamais à une adresse présente dans
//    email_suppressions (bounce/plainte).
//  - Backoff : next_attempt_at = now() + 2^attempts minutes en cas d'échec.
//
// Templates : rendus inline (HTML + texte). Volontairement sans dépendance
// react-email pour garder la fonction légère et rapide à froid ; les
// templates riches arrivent au lot B3 (preview front) et peuvent être
// portés ici ensuite si besoin.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";
const FROM = Deno.env.get("RESEND_FROM") ?? "Bonzini <noreply@bonzinilabs.com>";
const BATCH = Number(Deno.env.get("EMAIL_BATCH_SIZE") ?? "20");

// ─── Helpers de formatage (alignés sur notify-admin) ───────────────────────────

function formatXAF(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function formatRMB(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return "¥ " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Layout commun (mobile-first, sobre, accents logo) ─────────────────────────
// Couleurs logo (frontend.md) : violet 258/amber 36/orange 16.

function layout(opts: { heading: string; bodyHtml: string; accent?: string }): string {
  const accent = opts.accent ?? "hsl(258 100% 60%)";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececf0;">
<tr><td style="height:4px;background:${accent};"></td></tr>
<tr><td style="padding:28px 28px 8px;">
<div style="font-weight:800;font-size:20px;letter-spacing:-0.3px;">Bonzini</div>
</td></tr>
<tr><td style="padding:8px 28px 4px;">
<h1 style="margin:0 0 4px;font-size:19px;line-height:1.3;">${esc(opts.heading)}</h1>
</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#333;">
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#fafafa;border-top:1px solid #ececf0;font-size:12px;color:#888;line-height:1.5;">
Bonzini — Réglez vos fournisseurs chinois en XAF.<br>
Cet email vous est envoyé suite à une action sur votre compte.
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function row(label: string, value: string): string {
  return `<div style="margin:6px 0;"><span style="color:#888;">${esc(label)} :</span> <b>${value}</b></div>`;
}

// ─── Rendu par template (event_type) ───────────────────────────────────────────
// Retourne { subject, html, text }. Le payload provient de l'outbox :
// { notification_id, title, message, metadata:{ reference, amount_xaf, ... } }.

type Rendered = { subject: string; html: string; text: string };

function render(template: string, payload: Record<string, unknown>): Rendered {
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;
  const ref = esc(meta.reference ?? meta.deposit_reference ?? meta.payment_reference ?? "");
  const title = esc(payload.title ?? "Notification Bonzini");
  const message = esc(payload.message ?? "");

  const refLine = ref ? row("Référence", `<code>${ref}</code>`) : "";

  switch (template) {
    case "deposit_validated": {
      const body =
        `<p>Votre dépôt a été validé. ✅</p>` +
        (meta.amount_xaf ? row("Montant", formatXAF(meta.amount_xaf)) : "") +
        (meta.new_balance != null ? row("Nouveau solde", formatXAF(meta.new_balance)) : "") +
        refLine;
      return { subject: `Dépôt validé${ref ? ` · ${ref}` : ""}`,
        html: layout({ heading: "Dépôt validé", bodyHtml: body, accent: "hsl(16 100% 55%)" }),
        text: `Votre dépôt a été validé.\n${message}` };
    }
    case "deposit_rejected": {
      const body =
        `<p>Votre dépôt n'a pas pu être validé.</p>` +
        (meta.reason ? row("Motif", esc(meta.reason)) : "") + refLine +
        `<p style="margin-top:14px;">Vous pouvez réessayer depuis l'application.</p>`;
      return { subject: `Dépôt non validé${ref ? ` · ${ref}` : ""}`,
        html: layout({ heading: "Dépôt non validé", bodyHtml: body, accent: "hsl(16 100% 55%)" }),
        text: `Votre dépôt n'a pas pu être validé.\n${message}` };
    }
    case "payment_created": {
      const body =
        `<p>Nous avons bien reçu votre demande de paiement.</p>` +
        (meta.amount_xaf ? row("Montant", formatXAF(meta.amount_xaf)) : "") +
        (meta.amount_rmb ? row("Équivalent", formatRMB(meta.amount_rmb)) : "") +
        refLine;
      return { subject: `Paiement reçu${ref ? ` · ${ref}` : ""}`,
        html: layout({ heading: "Demande de paiement reçue", bodyHtml: body, accent: "hsl(258 100% 60%)" }),
        text: `Nous avons bien reçu votre demande de paiement.\n${message}` };
    }
    case "payment_completed": {
      const body =
        `<p>Votre paiement fournisseur a été effectué. ✅</p>` +
        (meta.beneficiary_name ? row("Bénéficiaire", esc(meta.beneficiary_name)) : "") +
        (meta.amount_rmb ? row("Montant", formatRMB(meta.amount_rmb)) : "") +
        refLine;
      return { subject: `Paiement effectué${ref ? ` · ${ref}` : ""}`,
        html: layout({ heading: "Paiement effectué", bodyHtml: body, accent: "hsl(16 100% 55%)" }),
        text: `Votre paiement fournisseur a été effectué.\n${message}` };
    }
    case "payment_rejected": {
      const body =
        `<p>Votre paiement a été rejeté et le montant remboursé sur votre solde.</p>` +
        (meta.reason ? row("Motif", esc(meta.reason)) : "") +
        (meta.refunded_xaf ? row("Remboursé", formatXAF(meta.refunded_xaf)) : "") +
        refLine;
      return { subject: `Paiement rejeté${ref ? ` · ${ref}` : ""}`,
        html: layout({ heading: "Paiement rejeté", bodyHtml: body, accent: "hsl(258 100% 60%)" }),
        text: `Votre paiement a été rejeté et remboursé.\n${message}` };
    }
    case "welcome": {
      // Le payload de bienvenue porte first_name à la racine (cf. enqueue_welcome_email).
      const first = esc((payload.first_name as string) ?? meta.first_name ?? "");
      const greet = first ? `Bienvenue ${first} 👋` : "Bienvenue 👋";
      const body =
        `<p>Votre compte Bonzini est prêt.</p>` +
        `<p>Vous pouvez dès maintenant <b>régler vos fournisseurs chinois en XAF</b>, suivre vos paiements et consulter le taux du jour — directement depuis l'application.</p>` +
        `<div style="margin:20px 0 4px;"><a href="https://www.bonzinilabs.com/auth" style="display:inline-block;background:hsl(36 100% 55%);color:#1a1a1a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Accéder à mon espace</a></div>`;
      return { subject: first ? `Bienvenue chez Bonzini, ${first}` : "Bienvenue chez Bonzini",
        html: layout({ heading: greet, bodyHtml: body, accent: "hsl(36 100% 55%)" }),
        text: `${greet}\n\nVotre compte Bonzini est prêt. Vous pouvez désormais régler vos fournisseurs chinois en XAF depuis l'application : https://www.bonzinilabs.com/auth` };
    }
    default: {
      // Fallback robuste : utilise title/message déjà localisés par la RPC.
      const body = `<p>${message || "Vous avez une nouvelle notification."}</p>` + refLine;
      return { subject: title,
        html: layout({ heading: title, bodyHtml: body }),
        text: message || title };
    }
  }
}

// ─── Envoi Resend ───────────────────────────────────────────────────────────────

async function sendViaResend(
  apiKey: string,
  to: string,
  r: Rendered,
  idempotencyKey: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resp = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from: FROM, to, subject: r.subject, html: r.html, text: r.text }),
  });
  if (resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { ok: true, id: data?.id };
  }
  return { ok: false, error: `${resp.status} ${await resp.text().catch(() => "")}`.slice(0, 500) };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// Comparaison à temps constant (évite un canal temporel sur le secret).
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
  // POST uniquement (un GET ne doit pas déclencher un run d'envoi).
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Auth interne OBLIGATOIRE : le cron passe le secret en Bearer.
  // Si le secret n'est pas configuré, on refuse (fail-closed) — jamais ouvert.
  const secret = Deno.env.get("EMAIL_DRAINER_SECRET");
  if (!secret) return new Response("Missing EMAIL_DRAINER_SECRET", { status: 500 });
  const incoming = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(incoming, secret)) return new Response("Unauthorized", { status: 401 });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return new Response("Missing RESEND_API_KEY", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Réserver un lot (concurrence sûre via RPC).
  const { data: batch, error: claimErr } = await supabase.rpc("claim_email_batch", { p_limit: BATCH });
  if (claimErr) {
    console.error("claim_email_batch error:", claimErr.message);
    return new Response("claim error", { status: 500 });
  }

  const rows = (batch ?? []) as Array<Record<string, unknown>>;
  let sent = 0, failed = 0, skipped = 0;

  for (const rowRec of rows) {
    const id = rowRec.id as string;
    const to = (rowRec.recipient_email as string) ?? "";
    const template = rowRec.template as string;
    const payload = (rowRec.payload ?? {}) as Record<string, unknown>;
    const attempts = Number(rowRec.attempts ?? 0);

    // a. Adresse manquante / non joignable → skipped (ne devrait pas arriver,
    //    l'enqueue filtre déjà, mais ceinture-bretelles).
    if (!to || to.toLowerCase().endsWith("@bonzini-client.local")) {
      await supabase.from("email_outbox").update({ status: "skipped" }).eq("id", id);
      skipped++; continue;
    }

    // b. Adresse supprimée (bounce/plainte) → skipped.
    const { data: supp } = await supabase
      .from("email_suppressions").select("email").eq("email", to.toLowerCase()).maybeSingle();
    if (supp) {
      await supabase.from("email_outbox")
        .update({ status: "skipped", last_error: "suppressed" }).eq("id", id);
      skipped++; continue;
    }

    // c. Rendu + envoi.
    const rendered = render(template, payload);
    const idemKey = (rowRec.idempotency_key as string) ?? `outbox:${id}`;
    const result = await sendViaResend(apiKey, to, rendered, idemKey);

    if (result.ok) {
      await supabase.from("email_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_message_id: result.id ?? null,
        attempts: attempts + 1,
        last_error: null,
      }).eq("id", id);
      sent++;
    } else {
      const nextAttempts = attempts + 1;
      const backoffMin = Math.min(2 ** nextAttempts, 120); // 2,4,8,... plafonné 2h
      await supabase.from("email_outbox").update({
        status: "failed",
        attempts: nextAttempts,
        last_error: result.error ?? "unknown",
        next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      }).eq("id", id);
      failed++;
      console.error(`send-email ${id}: ${(result.error ?? "").replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
    }
  }

  const summary = { claimed: rows.length, sent, failed, skipped };
  console.log("send-email run:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
