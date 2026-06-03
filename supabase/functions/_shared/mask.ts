// Masquage PII avant envoi au LLM (Lot 4 — sécurité/exposition).
// Conception : docs/assistant-ops/refonte/05-SECURITE-EXPOSITION.md §3-4.
// Règle : le LLM ne reçoit que le nécessaire. Numéros de compte/IBAN masqués pour TOUS
// (l'humain les voit dans l'app, pas le modèle). Téléphone/email masqués pour les rôles
// hors "PII complète". Appliqué à CHAQUE tool_result avant de l'ajouter à la conversation.

const FULL_PII_ROLES = new Set(["super_admin", "support", "customer_success"]);
const ACCOUNT_KEYS = /(?:^|_)(?:bank_account|account|iban|account_number|rib)$/i;
const PHONE_KEYS = /(?:^|_)(?:phone|telephone|tel|wechat_id|whatsapp)$/i;
const EMAIL_KEYS = /(?:^|_)email$/i;

function maskTail(s: unknown, keep = 4): string {
  const str = String(s ?? "");
  return str.length <= keep ? "****" : "****" + str.slice(-keep);
}
function maskEmail(s: unknown): string {
  const [u, d] = String(s ?? "").split("@");
  return d ? `${u?.[0] ?? ""}***@${d}` : "****";
}

/** Renvoie une COPIE de `value` avec les champs sensibles masqués selon le rôle. */
export function maskForRole(role: string, value: unknown): unknown {
  const full = FULL_PII_ROLES.has(role);
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val && typeof val === "object") out[k] = walk(val);
        else if (val == null) out[k] = val;
        else if (ACCOUNT_KEYS.test(k)) out[k] = maskTail(val);            // toujours masqué
        else if (!full && PHONE_KEYS.test(k)) out[k] = maskTail(val, 2);  // par rôle
        else if (!full && EMAIL_KEYS.test(k)) out[k] = maskEmail(val);    // par rôle
        else out[k] = val;
      }
      return out;
    }
    return v;
  };
  return walk(value);
}
