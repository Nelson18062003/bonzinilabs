// ============================================================
// Aperçu visuel des emails transactionnels (OUTIL DEV — pas de prod).
//
// ⚠️ MIROIR de supabase/functions/send-email/index.ts (fonctions layout/
// row/esc/format/render). À garder synchronisé si les templates changent.
// Raison de la copie : l'Edge Function est en Deno (imports https://…) et
// reste volontairement mono-fichier (déploiement dashboard sans terminal),
// donc non importable telle quelle depuis Node.
//
// Usage : node scripts/preview-emails.mjs
// Sortie : docs/email-previews/*.html  +  docs/email-previews/index.html
// ============================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "email-previews");

// ─── (miroir) helpers ───────────────────────────────────────────────────────
function formatXAF(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}
function formatRMB(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return "¥ " + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function layout(opts) {
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
function row(label, value) {
  return `<div style="margin:6px 0;"><span style="color:#888;">${esc(label)} :</span> <b>${value}</b></div>`;
}

// ─── (miroir) render ─────────────────────────────────────────────────────────
function render(template, payload) {
  const meta = payload.metadata ?? {};
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
      const first = esc(payload.first_name ?? meta.first_name ?? "");
      const greet = first ? `Bienvenue ${first} 👋` : "Bienvenue 👋";
      const body =
        `<p>Votre compte Bonzini est prêt.</p>` +
        `<p>Vous pouvez dès maintenant <b>régler vos fournisseurs chinois en XAF</b>, suivre vos paiements et consulter le taux du jour — directement depuis l'application.</p>` +
        `<div style="margin:20px 0 4px;"><a href="https://www.bonzinilabs.com/auth" style="display:inline-block;background:hsl(36 100% 55%);color:#1a1a1a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Accéder à mon espace</a></div>`;
      return { subject: first ? `Bienvenue chez Bonzini, ${first}` : "Bienvenue chez Bonzini",
        html: layout({ heading: greet, bodyHtml: body, accent: "hsl(36 100% 55%)" }),
        text: `${greet}\n\nVotre compte Bonzini est prêt.` };
    }
    default: {
      const body = `<p>${message || "Vous avez une nouvelle notification."}</p>` + refLine;
      return { subject: title, html: layout({ heading: title, bodyHtml: body }), text: message || title };
    }
  }
}

// ─── Jeux de données d'exemple (réalistes) ───────────────────────────────────
const samples = [
  ["welcome", { first_name: "Aminata" }],
  ["deposit_validated", { metadata: { reference: "DEP-2026-0412", amount_xaf: 2500000, new_balance: 7350000 } }],
  ["payment_created", { metadata: { reference: "PAY-2026-1180", amount_xaf: 1800000, amount_rmb: 23400 } }],
  ["payment_completed", { metadata: { reference: "PAY-2026-1180", beneficiary_name: "Shenzhen Hua Trading Co., Ltd", amount_rmb: 23400 } }],
  ["payment_rejected", { metadata: { reference: "PAY-2026-1181", reason: "Coordonnées du bénéficiaire invalides", refunded_xaf: 1800000 } }],
  ["deposit_rejected", { metadata: { reference: "DEP-2026-0413", reason: "Justificatif de virement illisible" } }],
];

const labels = {
  welcome: "③ Bienvenue (après onboarding)",
  deposit_validated: "④ Dépôt validé",
  payment_created: "⑤ Demande de paiement reçue",
  payment_completed: "⑥ Paiement effectué",
  payment_rejected: "⑦ Paiement rejeté / remboursé",
  deposit_rejected: "⑧ Dépôt rejeté",
};

mkdirSync(OUT, { recursive: true });

const cards = [];
for (const [template, payload] of samples) {
  const r = render(template, payload);
  const file = `${template}.html`;
  writeFileSync(join(OUT, file), r.html, "utf8");
  cards.push(
    `<section style="margin:0 0 34px;">
       <div style="font:600 14px/1.4 -apple-system,system-ui,sans-serif;color:#111;margin:0 0 2px;">${esc(labels[template] ?? template)}</div>
       <div style="font:500 12px/1.4 -apple-system,system-ui,sans-serif;color:#888;margin:0 0 10px;">Objet : « ${esc(r.subject)} »</div>
       <iframe title="${esc(template)}" style="width:100%;max-width:520px;height:560px;border:1px solid #e3e3e8;border-radius:12px;background:#fff;" srcdoc="${esc(r.html)}"></iframe>
     </section>`
  );
}

const gallery = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aperçu emails Bonzini</title></head>
<body style="margin:0;background:#fafafd;padding:28px 18px;font-family:-apple-system,system-ui,sans-serif;">
<div style="max-width:560px;margin:0 auto;">
<h1 style="font-size:22px;margin:0 0 4px;">Aperçu des emails Bonzini</h1>
<p style="color:#666;font-size:14px;margin:0 0 26px;">6 templates avec données d'exemple. C'est exactement ce que le client recevra (rendu mobile-first, version texte incluse côté serveur).</p>
${cards.join("\n")}
</div></body></html>`;
writeFileSync(join(OUT, "index.html"), gallery, "utf8");

console.log(`✅ ${samples.length} aperçus générés dans docs/email-previews/`);
console.log(`   - index.html (galerie unique, tout-en-un)`);
for (const [t] of samples) console.log(`   - ${t}.html`);
