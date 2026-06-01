// ============================================================
// Aperçu visuel des emails Bonzini — REFONTE DESIGN (outil dev).
//
// Design system email : logo réel hébergé, barre tri-couleur de marque
// (violet/amber/orange), boutons « bulletproof » (table+td, jamais image),
// carte de détails, pré-en-tête caché, version mobile-first, dark-mode-aware.
// Réf. bonnes pratiques : single-column, CTA explicite, ton fintech rassurant.
//
// ⚠️ Phase design : on itère ICI. Une fois validé, on porte layout/render
// dans supabase/functions/send-email/index.ts (mono-fichier).
//
// Usage : node scripts/preview-emails.mjs
// ============================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "email-previews");
const LOGO = "https://www.bonzinilabs.com/assets/bonzini-logo.jpg";
const APP  = "https://www.bonzinilabs.com/m";

// ─── Palette de marque (frontend.md) ─────────────────────────────────────────
const VIOLET = "#7033FF";  // ailes du logo
const AMBER  = "#FFA31A";  // « U » du logo
const ORANGE = "#FF571A";  // « n » du logo
const SLATE  = "#5B5B6B";  // neutre (rejets : attention, sans alarmer)
const INK    = "#1A1A22";
const MUTED  = "#6B6B76";
const BG     = "#F4F4F7";
const LINE   = "#ECECF1";

// Texte lisible sur l'accent (amber = clair → texte foncé ; sinon blanc).
const onAccentText = (a) => (a === AMBER ? INK : "#FFFFFF");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatXAF(a) {
  const n = Number(a);
  return Number.isFinite(n) ? new Intl.NumberFormat("fr-FR").format(n) + " XAF" : "—";
}
function formatRMB(a) {
  const n = Number(a);
  return Number.isFinite(n) ? "¥ " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n) : "—";
}

// ─── Briques réutilisables ───────────────────────────────────────────────────
const preheader = (txt) =>
  `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${BG};">${esc(txt)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>`;

const brandBar = () =>
  `<tr><td style="padding:0;font-size:0;line-height:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="38%" style="height:6px;background:${VIOLET};"></td>
      <td width="31%" style="height:6px;background:${AMBER};"></td>
      <td width="31%" style="height:6px;background:${ORANGE};"></td>
    </tr></table>
  </td></tr>`;

const badge = (emoji, accent) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;"><tr>
    <td width="56" height="56" align="center" valign="middle"
        style="width:56px;height:56px;background:${accent};border-radius:16px;font-size:26px;line-height:56px;">${emoji}</td>
  </tr></table>`;

const button = (label, href, accent) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 4px;"><tr>
    <td align="center" bgcolor="${accent}" style="border-radius:12px;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;font-weight:700;color:${onAccentText(accent)};text-decoration:none;border-radius:12px;">${esc(label)}</a>
    </td>
  </tr></table>`;

const detailsCard = (rows) => {
  const trs = rows.filter(Boolean).map(([k, v]) =>
    `<tr>
       <td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:13px;color:${MUTED};">${esc(k)}</td>
       <td align="right" style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:700;color:${INK};">${v}</td>
     </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="margin:18px 0;background:#FAFAFC;border:1px solid ${LINE};border-radius:14px;">
            <tr><td style="padding:6px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table></td></tr>
          </table>`;
};

// ─── Layout maître ───────────────────────────────────────────────────────────
function layout({ preview, accent, emoji, heading, subhead, bodyHtml }) {
  return `<!doctype html><html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>Bonzini</title>
<style>
  @media (max-width:620px){ .card{width:100%!important;border-radius:0!important;} .pad{padding-left:22px!important;padding-right:22px!important;} }
</style></head>
<body style="margin:0;padding:0;background:${BG};">
${preheader(preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:26px 12px;">

<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0"
       style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${LINE};border-radius:18px;overflow:hidden;">
${brandBar()}

  <tr><td class="pad" align="center" style="padding:30px 36px 6px;">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
      <td width="46" height="46" align="center" valign="middle" style="background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;">
        <img src="${LOGO}" width="34" height="34" alt="Bonzini" style="display:block;border-radius:7px;">
      </td>
      <td style="padding-left:11px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:19px;font-weight:800;letter-spacing:-0.3px;color:${INK};">Bonzini</td>
    </tr></table>
  </td></tr>

  <tr><td class="pad" align="center" style="padding:22px 36px 4px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    ${badge(emoji, accent)}
    <h1 style="margin:0 0 6px;font-size:23px;line-height:1.25;font-weight:800;color:${INK};">${esc(heading)}</h1>
    ${subhead ? `<p style="margin:0;font-size:15px;line-height:1.5;color:${MUTED};">${esc(subhead)}</p>` : ""}
  </td></tr>

  <tr><td class="pad" style="padding:14px 36px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3A3A44;">
    ${bodyHtml}
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

// ─── Catalogue (copy soignée par cas) ────────────────────────────────────────
function render(template, p = {}) {
  const m = p.metadata ?? {};
  const ref = esc(m.reference ?? "");
  const refRow = ref ? ["Référence", `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${ref}</span>`] : null;

  switch (template) {
    case "welcome": {
      const first = esc(p.first_name ?? "");
      return layout({
        preview: "Votre compte Bonzini est prêt — réglez vos fournisseurs chinois en toute simplicité.",
        accent: VIOLET, emoji: "👋",
        heading: first ? `Bienvenue, ${first}` : "Bienvenue chez Bonzini",
        subhead: "Votre compte est prêt à l'emploi.",
        bodyHtml:
          `<p style="margin:0 0 16px;">Vous pouvez dès maintenant <b>régler vos fournisseurs chinois en XAF</b>, suivre chaque paiement en temps réel et profiter du meilleur taux du jour — le tout depuis une seule application.</p>
           ${button("Accéder à mon espace", APP, VIOLET)}
           <p style="margin:18px 0 0;font-size:13.5px;color:${MUTED};">Une question pour bien démarrer ? Nous sommes joignables directement depuis l'application.</p>`,
      });
    }
    case "deposit_validated": {
      return layout({
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
      });
    }
    case "payment_created": {
      return layout({
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
      });
    }
    case "payment_completed": {
      return layout({
        preview: `Votre fournisseur${m.beneficiary_name ? ` ${m.beneficiary_name}` : ""} a été réglé.`,
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
      });
    }
    case "payment_rejected": {
      return layout({
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
      });
    }
    case "deposit_rejected": {
      return layout({
        preview: `Votre dépôt${ref ? ` ${ref}` : ""} n'a pas pu être validé.`,
        accent: SLATE, emoji: "⚠️",
        heading: "Dépôt non validé", subhead: "Une vérification est nécessaire.",
        bodyHtml:
          `<p style="margin:0 0 4px;">Nous n'avons pas pu valider votre dépôt. Vérifiez les informations et le justificatif, puis soumettez-le à nouveau depuis l'application.</p>
           ${detailsCard([
             m.reason ? ["Motif", esc(m.reason)] : null,
             refRow,
           ])}
           ${button("Reprendre mon dépôt", APP, VIOLET)}`,
      });
    }
    case "reset_password": {
      // Email Auth (Supabase) — {{ .ConfirmationURL }} est remplacé par Supabase.
      return layout({
        preview: "Réinitialisez votre mot de passe Bonzini (lien valable 1 heure).",
        accent: VIOLET, emoji: "🔐",
        heading: "Réinitialisation du mot de passe", subhead: "Vous avez demandé à le changer.",
        bodyHtml:
          `<p style="margin:0 0 16px;">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <b>1 heure</b>.</p>
           ${button("Réinitialiser mon mot de passe", "{{ .ConfirmationURL }}", VIOLET)}
           <p style="margin:18px 0 0;font-size:13.5px;color:${MUTED};">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé. Pour votre sécurité, ne partagez jamais ce lien.</p>`,
      });
    }
    case "confirm_signup": {
      // Email Auth (Supabase) — {{ .Token }} = code à 6 chiffres remplacé par Supabase.
      return layout({
        preview: "Votre code de vérification Bonzini (valable 1 heure).",
        accent: VIOLET, emoji: "🔢",
        heading: "Vérifiez votre adresse email",
        subhead: "Saisissez ce code dans l'application pour activer votre compte.",
        bodyHtml:
          `<p style="margin:0 0 6px;">Bienvenue ! Pour finaliser votre inscription, entrez le code ci-dessous dans l'application Bonzini :</p>
           <div style="margin:20px 0;text-align:center;">
             <div style="display:inline-block;padding:16px 28px;background:#FAFAFC;border:1px solid ${LINE};border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:800;letter-spacing:8px;color:${INK};">{{ .Token }}</div>
           </div>
           <p style="margin:6px 0 0;font-size:13.5px;color:${MUTED};">Ce code est valable <b>1 heure</b>. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.</p>`,
      });
    }
    case "support_message": {
      const snippet = esc(p.message_preview ?? "");
      return layout({
        preview: "Notre équipe support vous a répondu sur Bonzini.",
        accent: VIOLET, emoji: "💬",
        heading: "Nouveau message du support", subhead: "Notre équipe vous a répondu.",
        bodyHtml:
          `<p style="margin:0 0 4px;">Vous avez reçu un nouveau message de l'équipe Bonzini :</p>
           ${snippet ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>
             <td style="padding:14px 16px;background:#FAFAFC;border-left:3px solid ${VIOLET};border-radius:8px;font-size:14.5px;line-height:1.55;color:#3A3A44;font-style:italic;">${snippet}</td></tr></table>` : ""}
           ${button("Lire et répondre", APP, VIOLET)}
           <p style="margin:18px 0 0;font-size:13.5px;color:${MUTED};">Répondez directement depuis l'application pour poursuivre la conversation.</p>`,
      });
    }
    default:
      return layout({ preview: "Notification Bonzini", accent: VIOLET, emoji: "🔔",
        heading: esc(p.title ?? "Notification"), subhead: "", bodyHtml: `<p>${esc(p.message ?? "")}</p>` });
  }
}

// ─── Échantillons ────────────────────────────────────────────────────────────
const samples = [
  ["welcome", { first_name: "Aminata" }],
  ["deposit_validated", { metadata: { reference: "DEP-2026-0412", amount_xaf: 2500000, new_balance: 7350000 } }],
  ["payment_created", { metadata: { reference: "PAY-2026-1180", amount_xaf: 1800000, amount_rmb: 23400 } }],
  ["payment_completed", { metadata: { reference: "PAY-2026-1180", beneficiary_name: "Shenzhen Hua Trading Co., Ltd", amount_rmb: 23400 } }],
  ["payment_rejected", { metadata: { reference: "PAY-2026-1181", reason: "Coordonnées du bénéficiaire invalides", refunded_xaf: 1800000 } }],
  ["deposit_rejected", { metadata: { reference: "DEP-2026-0413", reason: "Justificatif de virement illisible" } }],
  ["reset_password", {}],
  ["confirm_signup", {}],
  ["support_message", { message_preview: "Bonjour, nous avons bien reçu votre dépôt. Pourriez-vous nous confirmer le nom exact du bénéficiaire afin de finaliser votre paiement ? Merci." }],
];
const labels = {
  welcome: "① Bienvenue", deposit_validated: "② Dépôt crédité", payment_created: "③ Demande de paiement reçue",
  payment_completed: "④ Paiement effectué", payment_rejected: "⑤ Paiement non abouti (recrédité)",
  deposit_rejected: "⑥ Dépôt non validé", reset_password: "⑦ Mot de passe oublié (sécurité)",
  confirm_signup: "⑧ Vérification email — code OTP (inscription)", support_message: "⑨ Nouveau message support",
};

mkdirSync(OUT, { recursive: true });
const cards = [];
for (const [t, p] of samples) {
  const html = render(t, p);
  writeFileSync(join(OUT, `${t}.html`), html, "utf8");
  cards.push(`<section style="margin:0 0 36px;">
    <div style="font:700 14px/1.4 -apple-system,system-ui,sans-serif;color:#111;margin:0 0 10px;">${esc(labels[t] ?? t)}</div>
    <iframe title="${esc(t)}" style="width:100%;max-width:620px;height:660px;border:1px solid #e3e3e8;border-radius:14px;background:#fff;" srcdoc="${esc(html)}"></iframe>
  </section>`);
}
writeFileSync(join(OUT, "index.html"), `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu emails Bonzini</title></head>
<body style="margin:0;background:#fafafd;padding:30px 18px;font-family:-apple-system,system-ui,sans-serif;">
<div style="max-width:620px;margin:0 auto;">
<h1 style="font-size:23px;margin:0 0 4px;">Emails Bonzini — refonte design</h1>
<p style="color:#666;font-size:14px;margin:0 0 28px;">Logo réel · barre tri-couleur de marque · vrais boutons · copy soignée · mobile-first. 7 cas, dont le mot de passe oublié.</p>
${cards.join("\n")}</div></body></html>`, "utf8");

console.log(`✅ ${samples.length} aperçus régénérés (refonte) dans docs/email-previews/`);
