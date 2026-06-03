// Registre de PARITÉ outil ↔ RPC + détecteur de DÉRIVE (Phase 3 / Lot 2).
// Idée : la vérité des paramètres RPC vit déjà dans src/integrations/supabase/types.ts
// (types générés). Ce module l'extrait et vérifie que CHAQUE param RPC est soit EXPOSÉ
// par l'outil agent, soit OMIS-avec-raison. Si une migration ajoute un param et qu'on
// oublie l'outil, le test casse → la dérive devient impossible à merger en silence.
//
// Pur, sans dépendance → testable (parity.test.ts) et exécutable en CI.

/** Extrait les noms de paramètres (clés de `Args`) d'une RPC depuis le texte de types.ts. */
export function extractRpcArgs(typesSource: string, fnName: string): string[] {
  const fnIdx = typesSource.indexOf(`\n      ${fnName}: {`);
  if (fnIdx === -1) return [];
  const argsIdx = typesSource.indexOf("Args:", fnIdx);
  if (argsIdx === -1) return [];
  const braceStart = typesSource.indexOf("{", argsIdx);
  if (braceStart === -1) return [];
  // Lecture équilibrée des accolades du bloc Args (gère d'éventuels types imbriqués).
  let depth = 0, i = braceStart;
  for (; i < typesSource.length; i++) {
    const ch = typesSource[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  const block = typesSource.slice(braceStart, i);
  const keys = new Set<string>();
  // Clés délimitées par newline (Args multi-lignes) OU par { / ; (Args sur une seule ligne).
  for (const m of block.matchAll(/(?:[{;\n]|^)\s*([A-Za-z_]\w*)\??:/g)) {
    if (m[1] !== "Args" && m[1] !== "Returns") keys.add(m[1]);
  }
  return [...keys];
}

export interface ParityEntry { tool: string; rpc: string; exposes: string[]; omits: Record<string, string>; }

export interface ParityResult { tool: string; rpc: string; rpcFound: boolean; missing: string[] }

/** Vérifie qu'aucun param RPC n'est ni exposé ni omis-avec-raison. */
export function checkParity(typesSource: string, e: ParityEntry): ParityResult {
  const args = extractRpcArgs(typesSource, e.rpc);
  const covered = new Set([...e.exposes, ...Object.keys(e.omits)]);
  return { tool: e.tool, rpc: e.rpc, rpcFound: args.length > 0, missing: args.filter((a) => !covered.has(a)) };
}

// Registre des outils d'écriture adossés à une RPC (les outils sur TABLE directe — bénéficiaires —
// se vérifient contre les colonnes Insert, à ajouter ultérieurement). exposes/omits À COMPLÉTER
// après extraction réelle (cf. parity.test.ts qui vérifie la couverture).
export const WRITE_TOOL_PARITY: ParityEntry[] = [
  {
    tool: "create_payment",
    rpc: "create_admin_payment",
    exposes: ["p_user_id", "p_amount_xaf", "p_amount_rmb", "p_exchange_rate", "p_rate_is_custom", "p_method", "p_beneficiary_name", "p_beneficiary_phone", "p_beneficiary_bank_name", "p_beneficiary_bank_account", "p_beneficiary_qr_code_url"],
    omits: {
      p_beneficiary_email: "non collecté par l'outil paiement (utiliser create_beneficiary)",
      p_beneficiary_notes: "non exposé (simplicité)",
      p_beneficiary_id: "l'outil passe les infos bénéficiaire à plat, pas par id",
      p_beneficiary_details: "non exposé (l'outil mappe des champs explicites)",
      p_client_visible_comment: "à exposer plus tard si besoin",
      p_desired_date: "toujours 'maintenant' pour l'agent",
    },
  },
  {
    tool: "set_rate_adjustment",
    rpc: "update_rate_adjustment",
    exposes: ["p_adjustment_id", "p_percentage"],
    omits: {},
  },
  {
    tool: "set_daily_rate",
    rpc: "create_daily_rates",
    exposes: ["p_rate_cash", "p_rate_alipay", "p_rate_wechat", "p_rate_virement"],
    omits: { p_effective_at: "toujours 'maintenant' (l'agent ne planifie pas un taux futur)" },
  },
];
