// ============================================================
// Chantier B — Lot B4 — Drainer d'emails (Edge Function)
//
// Déclenché par pg_cron (toutes les minutes). Réserve un lot via
// claim_email_batch(), envoie chaque email via l'API REST Resend avec
// un Idempotency-Key, puis marque sent/failed/skipped.
//
// GARANTIES :
//  - Découplage : hors de la transaction métier. Resend down ⇒ lignes
//    'failed' retentées ; aucun paiement/dépôt impacté.
//  - Idempotence : contrainte UNIQUE outbox + en-tête Idempotency-Key Resend.
//  - Suppression : jamais d'envoi à une adresse de email_suppressions.
//  - Backoff : next_attempt_at = now() + 2^attempts minutes.
//
// DESIGN templates (refonte validée) : logo réel hébergé sur pastille blanche
// (dark-mode safe), barre tri-couleur de marque (violet/amber/orange), boutons
// « bulletproof » (table+td bgcolor, jamais image), carte de détails,
// pré-en-tête caché, mobile-first. Rendu inline (HTML+texte), aucune dépendance
// react-email → fonction légère et rapide à froid. Miroir : scripts/preview-emails.mjs.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";
const FROM = Deno.env.get("RESEND_FROM") ?? "Bonzini <noreply@bonzinilabs.com>";
const BATCH = Number(Deno.env.get("EMAIL_BATCH_SIZE") ?? "20");

const LOGO = "https://www.bonzinilabs.com/assets/bonzini-logo.jpg";
const APP = "https://www.bonzinilabs.com/m";

// ─── Palette de marque (frontend.md) ───────────────────────────────────────────
const VIOLET = "#7033FF"; // ailes du logo
const AMBER = "#FFA31A";  // « U » du logo
const ORANGE = "#FF571A"; // « n » du logo
const SLATE = "#5B5B6B";  // neutre (rejets : attention, sans alarmer)
const INK = "#1A1A22";
const MUTED = "#6B6B76";
const BG = "#F4F4F7";
const LINE = "#ECECF1";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatXAF(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function formatRMB(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return "¥ " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Texte lisible sur l'accent (amber clair ⇒ texte foncé ; sinon blanc).
const onAccentText = (a: string): string => (a === AMBER ? INK : "#FFFFFF");

// ─── Briques réutilisables ──────────────────────────────────────────────────────

const preheader = (txt: string): string =>
  `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${BG};">${esc(txt)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>`;

const brandBar = (): string =>
  `<tr><td style="padding:0;font-size:0;line-height:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="38%" style="height:6px;background:${VIOLET};"></td>
      <td width="31%" style="height:6px;background:${AMBER};"></td>
      <td width="31%" style="height:6px;background:${ORANGE};"></td>
    </tr></table>
  </td></tr>`;

const badge = (emoji: string, accent: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;"><tr>
    <td width="56" height="56" align="center" valign="middle"
        style="width:56px;height:56px;background:${accent};border-radius:16px;font-size:26px;line-height:56px;">${emoji}</td>
  </tr></table>`;

const button = (label: string, href: string, accent: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 4px;"><tr>
    <td align="center" bgcolor="${accent}" style="border-radius:12px;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;font-weight:700;color:${onAccentText(accent)};text-decoration:none;border-radius:12px;">${esc(label)}</a>
    </td>
  </tr></table>`;

const detailsCard = (rows: Array<[string, string] | null>): string => {
  const trs = rows.filter(Boolean).map((r) => {
    const [k, v] = r as [string, string];
    return `<tr>
       <td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:13px;color:${MUTED};">${esc(k)}</td>
       <td align="right" style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:700;color:${INK};">${v}</td>
     </tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="margin:18px 0;background:#FAFAFC;border:1px solid ${LINE};border-radius:14px;">
            <tr><td style="padding:6px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table></td></tr>
          </table>`;
};

// ─── Layout maître ──────────────────────────────────────────────────────────────

type LayoutOpts = { preview: string; accent: string; emoji: string; heading: string; subhead?: string; bodyHtml: string };

function layout(o: LayoutOpts): string {
  return `<!doctype html><html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>Bonzini</title>
<style>@media (max-width:620px){.card{width:100%!important;border-radius:0!important;}.pad{padding-left:22px!important;padding-right:22px!important;}}</style></head>
<body style="margin:0;padding:0;background:${BG};">
${preheader(o.preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:26px 12px;">

<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0"
       style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${LINE};border-radius:18px;overflow:hidden;">
${brandBar()}

  <tr><td class="pad" align="center" style="padding:32px 36px 6px;">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
      <td align="center" style="background:#FFFFFF;border:1px solid ${LINE};border-radius:18px;padding:12px;">
        <img src="${LOGO}" width="56" height="56" alt="Bonzini" style="display:block;border-radius:12px;">
      </td>
    </tr></table>
    <div style="margin-top:12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${INK};">Bonzini</div>
  </td></tr>

  <tr><td class="pad" align="center" style="padding:22px 36px 4px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    ${badge(o.emoji, o.accent)}
    <h1 style="margin:0 0 6px;font-size:23px;line-height:1.25;font-weight:800;color:${INK};">${esc(o.heading)}</h1>
    ${o.subhead ? `<p style="margin:0;font-size:15px;line-height:1.5;color:${MUTED};">${esc(o.subhead)}</p>` : ""}
  </td></tr>

  <tr><td class="pad" style="padding:14px 36px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3A3A44;">
    ${o.bodyHtml}
  </td></tr>

  <tr><td style="padding:22px 36px;background:#FAFAFB;border-top:1px solid ${LINE};font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="font-size:14px;font-weight:800;color:${INK};letter-spacing:-0.2px;">Bonzini</div>
    <div style="font-size:12.5px;color:${MUTED};line-height:1.5;margin-top:3px;">Réglez vos fournisseurs chinois en XAF — paiements rapides, taux du jour, suivi en temps réel.</div>
    <div style="font-size:11.5px;color:#9A9AA4;line-height:1.5;margin-top:12px;">
      Vous recevez cet email suite à une action sur votre compte Bonzini.<br>
      Une question ? <a href="${APP}" style="color:${VIOLET};text-decoration:none;font-weight:600;">Contactez-nous depuis l'application</a>.
    </div>
  </td></tr>
</table>

</td></tr></table></body></html>`;
}

// ─── Rendu par template (event_type) ────────────────────────────────────────────
// payload = { notification_id, title, message, metadata:{ reference, amount_xaf, ... } }
// ou, pour 'welcome', { first_name }.

type Rendered = { subject: string; html: string; text: string };

function render(template: string, payload: Record<string, unknown>): Rendered {
  const m = (payload.metadata ?? {}) as Record<string, unknown>;
  const ref = esc(m.reference ?? m.deposit_reference ?? m.payment_reference ?? "");
  const refSuffix = ref ? ` · ${ref}` : "";
  const refRow: [string, string] | null = ref
    ? ["Référence", `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${ref}</span>`]
    : null;

  switch (template) {
    case "welcome": {
      const first = esc((payload.first_name as string) ?? m.first_name ?? "");
      return {
        subject: first ? `Bienvenue chez Bonzini, ${first}` : "Bienvenue chez Bonzini",
        html: layout({
          preview: "Votre compte Bonzini est prêt — réglez vos fournisseurs chinois en toute simplicité.",
          accent: VIOLET, emoji: "👋",
          heading: first ? `Bienvenue, ${first}` : "Bienvenue chez Bonzini",
          subhead: "Votre compte est prêt à l'emploi.",
          bodyHtml:
            `<p style="margin:0 0 16px;">Vous pouvez dès maintenant <b>régler vos fournisseurs chinois en XAF</b>, suivre chaque paiement en temps réel et profiter du meilleur taux du jour — le tout depuis une seule application.</p>
             ${button("Accéder à mon espace", APP, VIOLET)}
             <p style="margin:18px 0 0;font-size:13.5px;color:${MUTED};">Une question pour bien démarrer ? Nous sommes joignables directement depuis l'application.</p>`,
        }),
        text: `Bienvenue chez Bonzini${first ? `, ${first}` : ""} !\n\nVotre compte est prêt. Vous pouvez désormais régler vos fournisseurs chinois en XAF depuis l'application : ${APP}`,
      };
    }
    case "deposit_validated": {
      return {
        subject: `Dépôt crédité${refSuffix}`,
        html: layout({
          preview: `Votre dépôt${m.amount_xaf ? ` de ${formatXAF(m.amount_xaf)}` : ""} a été crédité sur votre solde.`,
          accent: AMBER, emoji: "✅",
          heading: "Dépôt crédité", subhead: "Votre solde vient d'être mis à jour.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Bonne nouvelle — votre dépôt a été validé et <b>crédité sur votre compte</b>. Il est disponible immédiatement pour régler vos fournisseurs.</p>
             ${detailsCard([
               m.amount_xaf ? ["Montant crédité", formatXAF(m.amount_xaf)] : null,
               m.new_balance != null ? ["Nouveau solde", formatXAF(m.new_balance)] : null,
               refRow,
             ])}
             ${button("Voir mon solde", APP, AMBER)}`,
        }),
        text: `Votre dépôt a été crédité sur votre compte Bonzini.${m.amount_xaf ? ` Montant : ${formatXAF(m.amount_xaf)}.` : ""} ${APP}`,
      };
    }
    case "deposit_rejected": {
      return {
        subject: `Dépôt non validé${refSuffix}`,
        html: layout({
          preview: `Votre dépôt${ref ? ` ${ref}` : ""} n'a pas pu être validé.`,
          accent: SLATE, emoji: "⚠️",
          heading: "Dépôt non validé", subhead: "Une vérification est nécessaire.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Nous n'avons pas pu valider votre dépôt. Vérifiez les informations et le justificatif, puis soumettez-le à nouveau depuis l'application.</p>
             ${detailsCard([m.reason ? ["Motif", esc(m.reason)] : null, refRow])}
             ${button("Reprendre mon dépôt", APP, VIOLET)}`,
        }),
        text: `Votre dépôt n'a pas pu être validé.${m.reason ? ` Motif : ${esc(m.reason)}.` : ""} Reprenez depuis l'application : ${APP}`,
      };
    }
    case "payment_created": {
      return {
        subject: `Paiement reçu${refSuffix}`,
        html: layout({
          preview: `Nous avons bien reçu votre demande de paiement${ref ? ` ${ref}` : ""}.`,
          accent: VIOLET, emoji: "🧾",
          heading: "Demande de paiement reçue", subhead: "Nous traitons votre règlement fournisseur.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Votre demande a bien été enregistrée. Nos équipes la traitent ; vous serez notifié dès que votre fournisseur sera réglé.</p>
             ${detailsCard([
               m.amount_xaf ? ["Montant", formatXAF(m.amount_xaf)] : null,
               m.amount_rmb ? ["Équivalent", formatRMB(m.amount_rmb)] : null,
               refRow,
             ])}
             ${button("Suivre mon paiement", APP, VIOLET)}`,
        }),
        text: `Nous avons bien reçu votre demande de paiement.${m.amount_xaf ? ` Montant : ${formatXAF(m.amount_xaf)}.` : ""} ${APP}`,
      };
    }
    case "payment_completed": {
      return {
        subject: `Paiement effectué${refSuffix}`,
        html: layout({
          preview: `Votre fournisseur${m.beneficiary_name ? ` ${esc(m.beneficiary_name)}` : ""} a été réglé.`,
          accent: ORANGE, emoji: "🚀",
          heading: "Paiement effectué", subhead: "Votre fournisseur a bien été réglé.",
          bodyHtml:
            `<p style="margin:0 0 4px;">C'est fait — votre règlement a été transmis et votre fournisseur a été payé. Merci de votre confiance.</p>
             ${detailsCard([
               m.beneficiary_name ? ["Bénéficiaire", esc(m.beneficiary_name)] : null,
               m.amount_rmb ? ["Montant réglé", formatRMB(m.amount_rmb)] : null,
               refRow,
             ])}
             ${button("Voir le reçu", APP, ORANGE)}`,
        }),
        text: `Votre paiement fournisseur a été effectué.${m.beneficiary_name ? ` Bénéficiaire : ${esc(m.beneficiary_name)}.` : ""} ${APP}`,
      };
    }
    case "payment_rejected": {
      return {
        subject: `Paiement non abouti${refSuffix}`,
        html: layout({
          preview: `Votre paiement${ref ? ` ${ref}` : ""} n'a pas abouti — le montant a été recrédité.`,
          accent: SLATE, emoji: "↩️",
          heading: "Paiement non abouti", subhead: "Le montant a été recrédité sur votre solde.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Votre paiement n'a pas pu être finalisé. <b>Rassurez-vous : le montant a été intégralement recrédité</b> sur votre solde Bonzini. Vous pouvez réessayer quand vous le souhaitez.</p>
             ${detailsCard([
               m.reason ? ["Motif", esc(m.reason)] : null,
               m.refunded_xaf ? ["Montant recrédité", formatXAF(m.refunded_xaf)] : null,
               refRow,
             ])}
             ${button("Réessayer le paiement", APP, VIOLET)}`,
        }),
        text: `Votre paiement n'a pas abouti et le montant a été recrédité sur votre solde.${m.reason ? ` Motif : ${esc(m.reason)}.` : ""} ${APP}`,
      };
    }
    case "deposit_created": {
      return {
        subject: `Demande de dépôt reçue${refSuffix}`,
        html: layout({
          preview: `Nous avons bien reçu votre demande de dépôt${m.amount_xaf ? ` de ${formatXAF(m.amount_xaf)}` : ""}.`,
          accent: AMBER, emoji: "📥",
          heading: "Demande de dépôt reçue", subhead: "Nous vérifions votre dépôt.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Nous avons bien reçu votre demande de dépôt. Notre équipe la vérifie ; vous serez notifié dès qu'il sera <b>crédité sur votre solde</b>.</p>` +
            detailsCard([m.amount_xaf ? ["Montant", formatXAF(m.amount_xaf)] : null, refRow]) +
            button("Suivre mon dépôt", APP, AMBER),
        }),
        text: `Nous avons bien reçu votre demande de dépôt${m.amount_xaf ? ` de ${formatXAF(m.amount_xaf)}` : ""}. Vous serez notifié dès qu'il sera crédité. ${APP}`,
      };
    }
    case "payment_processing": {
      return {
        subject: `Paiement en cours${refSuffix}`,
        html: layout({
          preview: `Votre paiement${ref ? ` ${ref}` : ""} est en cours de traitement.`,
          accent: VIOLET, emoji: "⏳",
          heading: "Paiement en cours", subhead: "Votre règlement est en cours de traitement.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Bonne nouvelle : votre paiement est passé en traitement. Vous recevrez une confirmation dès que votre fournisseur aura été réglé.</p>` +
            detailsCard([m.amount_rmb ? ["Montant", formatRMB(m.amount_rmb)] : null, refRow]) +
            button("Suivre mon paiement", APP, VIOLET),
        }),
        text: `Votre paiement est en cours de traitement. Vous serez notifié dès qu'il sera effectué. ${APP}`,
      };
    }
    case "password_changed": {
      const when = esc((payload.changed_at as string) ?? m.changed_at ?? "");
      return {
        subject: "Votre mot de passe Bonzini a été modifié",
        html: layout({
          preview: "Le mot de passe de votre compte Bonzini vient d'être modifié.",
          accent: SLATE, emoji: "🔑",
          heading: "Mot de passe modifié", subhead: "La modification a bien été prise en compte.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Le mot de passe de votre compte Bonzini vient d'être modifié.</p>` +
            (when ? detailsCard([["Date", when]]) : "") +
            `<p style="margin:14px 0 0;font-size:14px;">Si vous êtes à l'origine de ce changement, aucune action n'est nécessaire.</p>` +
            `<p style="margin:8px 0 14px;font-size:13.5px;color:${MUTED};"><b>Ce n'était pas vous ?</b> Contactez-nous immédiatement pour sécuriser votre compte.</p>` +
            button("Ouvrir l'application", APP, VIOLET),
        }),
        text: `Le mot de passe de votre compte Bonzini vient d'être modifié${when ? ` (${when})` : ""}. Si ce n'était pas vous, contactez-nous immédiatement.`,
      };
    }
    case "support_message": {
      const snippet = esc((payload.message_preview as string) ?? m.message_preview ?? "");
      return {
        subject: "Nouveau message de l'équipe Bonzini",
        html: layout({
          preview: "Notre équipe support vous a répondu sur Bonzini.",
          accent: VIOLET, emoji: "💬",
          heading: "Nouveau message du support", subhead: "Notre équipe vous a répondu.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Vous avez reçu un nouveau message de l'équipe Bonzini :</p>` +
            (snippet
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="padding:14px 16px;background:#FAFAFC;border-left:3px solid ${VIOLET};border-radius:8px;font-size:14.5px;line-height:1.55;color:#3A3A44;font-style:italic;">${snippet}</td></tr></table>`
              : "") +
            button("Lire et répondre", APP, VIOLET) +
            `<p style="margin:18px 0 0;font-size:13.5px;color:${MUTED};">Répondez directement depuis l'application pour poursuivre la conversation.</p>`,
        }),
        text: `Vous avez un nouveau message de l'équipe Bonzini. Ouvrez l'application pour le lire et répondre : ${APP}`,
      };
    }
    case "deposit_reminder": {
      return {
        subject: `Finalisez votre dépôt${refSuffix}`,
        html: layout({
          preview: "Votre dépôt n'est pas encore finalisé — il ne manque qu'une étape.",
          accent: AMBER, emoji: "⏰",
          heading: "Finalisez votre dépôt", subhead: "Il ne manque qu'une étape.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Vous avez commencé un dépôt qui n'est pas encore finalisé. Ajoutez votre <b>preuve de virement</b> pour qu'on puisse le créditer sur votre solde.</p>` +
            detailsCard([m.amount_xaf ? ["Montant", formatXAF(m.amount_xaf)] : null, refRow]) +
            button("Finaliser mon dépôt", APP, AMBER),
        }),
        text: `Votre dépôt n'est pas encore finalisé. Ajoutez votre preuve de virement pour le créditer : ${APP}`,
      };
    }
    case "onboarding_reminder": {
      const first = esc((payload.first_name as string) ?? m.first_name ?? "");
      return {
        subject: "Complétez votre profil Bonzini",
        html: layout({
          preview: "Une dernière étape pour activer tous vos paiements.",
          accent: VIOLET, emoji: "👤",
          heading: first ? `${first}, complétez votre profil` : "Complétez votre profil",
          subhead: "Une dernière étape pour démarrer.",
          bodyHtml:
            `<p style="margin:0 0 4px;">Il ne manque qu'une étape pour profiter pleinement de Bonzini : complétez votre profil (téléphone, pays) afin de pouvoir <b>régler vos fournisseurs chinois</b>.</p>` +
            button("Compléter mon profil", APP, VIOLET),
        }),
        text: `Complétez votre profil Bonzini (téléphone, pays) pour commencer à régler vos fournisseurs : ${APP}`,
      };
    }
    default: {
      // Fallback robuste : title/message déjà localisés par la RPC.
      const title = esc(payload.title ?? "Notification Bonzini");
      const message = esc(payload.message ?? "");
      return {
        subject: title,
        html: layout({
          preview: message || title, accent: VIOLET, emoji: "🔔",
          heading: title, subhead: "",
          bodyHtml: `<p style="margin:0;">${message || "Vous avez une nouvelle notification."}</p>${refRow ? detailsCard([refRow]) : ""}`,
        }),
        text: message || title,
      };
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

    // a. Adresse manquante / non joignable → skipped.
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
