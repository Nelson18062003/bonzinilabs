// Registre de PARITÉ outil ↔ RPC + détecteur de DÉRIVE (Phase 3 / Lot 2).
// Idée : la vérité des paramètres RPC vit déjà dans src/integrations/supabase/types.ts
// (types générés). Ce module l'extrait et vérifie que CHAQUE param RPC est soit EXPOSÉ
// par l'outil agent, soit OMIS-avec-raison. Si une migration ajoute un param et qu'on
// oublie l'outil, le test casse → la dérive devient impossible à merger en silence.
//
// Pur, sans dépendance → testable (parity.test.ts) et exécutable en CI.

/** Lit le bloc { ... } équilibré à partir de l'index d'une accolade ouvrante. */
function balancedBlock(s: string, openIdx: number): string {
  let depth = 0, i = openIdx;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return s.slice(openIdx, i);
}

/**
 * Extrait les noms de paramètres (clés de `Args`) d'une RPC depuis le texte de types.ts.
 * Gère les 3 formats générés : `name: { Args: {...} }` (mono, multi-ligne),
 * `Args: { a: x; b: y }` (inline) et `name:\n | {Args...} | {Args...}` (SURCHARGES → union).
 */
export function extractRpcArgs(typesSource: string, fnName: string): string[] {
  const start = typesSource.indexOf(`\n      ${fnName}:`);
  if (start === -1) return [];
  const after = start + `\n      ${fnName}:`.length;
  // Section = jusqu'au prochain nom de fonction au même indent (6 espaces), sinon borne raisonnable.
  const rest = typesSource.slice(after);
  const nextRel = rest.search(/\n {6}[A-Za-z_]\w*:/);
  const section = nextRel === -1 ? rest.slice(0, 6000) : rest.slice(0, nextRel);
  const keys = new Set<string>();
  // Tous les blocs Args de la section (plusieurs si surcharges) → union des paramètres.
  let idx = 0;
  for (;;) {
    const a = section.indexOf("Args:", idx);
    if (a === -1) break;
    const bs = section.indexOf("{", a);
    if (bs === -1) break;
    const block = balancedBlock(section, bs);
    for (const m of block.matchAll(/(?:[{;\n]|^)\s*([A-Za-z_]\w*)\??:/g)) {
      if (m[1] !== "Args" && m[1] !== "Returns") keys.add(m[1]);
    }
    idx = bs + block.length;
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
  { tool: "create_client", rpc: "admin_create_client",
    exposes: ["p_first_name", "p_last_name", "p_phone", "p_email", "p_gender", "p_country", "p_city", "p_company"],
    omits: { p_password: "mot de passe non défini par l'agent (géré par le flux d'auth)" } },
  { tool: "create_deposit", rpc: "create_client_deposit",
    exposes: ["p_user_id", "p_amount_xaf", "p_method", "p_bank_name", "p_agency_name", "p_client_phone"], omits: {} },
  { tool: "validate_deposit", rpc: "validate_deposit",
    exposes: ["p_deposit_id", "p_admin_comment", "p_confirmed_amount", "p_send_notification"], omits: {} },
  { tool: "reject_deposit", rpc: "reject_deposit",
    exposes: ["p_deposit_id", "p_reason"],
    omits: { p_admin_note: "note interne non exposée (le motif suffit)", p_rejection_category: "catégorie non exposée (libre via le motif)" } },
  { tool: "create_payment", rpc: "create_admin_payment",
    exposes: ["p_user_id", "p_amount_xaf", "p_amount_rmb", "p_exchange_rate", "p_rate_is_custom", "p_method", "p_beneficiary_name", "p_beneficiary_phone", "p_beneficiary_bank_name", "p_beneficiary_bank_account", "p_beneficiary_qr_code_url"],
    omits: {
      p_beneficiary_email: "via create_beneficiary / update_payment_beneficiary",
      p_beneficiary_notes: "via update_payment_beneficiary",
      p_beneficiary_id: "l'outil passe les infos à plat, pas par id",
      p_beneficiary_details: "l'outil mappe des champs explicites",
      p_client_visible_comment: "à exposer plus tard si besoin",
      p_desired_date: "toujours 'maintenant' pour l'agent",
    } },
  { tool: "update_payment_beneficiary", rpc: "admin_update_payment_beneficiary",
    exposes: ["p_payment_id", "p_beneficiary_name", "p_beneficiary_phone", "p_beneficiary_email", "p_beneficiary_identifier", "p_beneficiary_identifier_type", "p_beneficiary_bank_name", "p_beneficiary_bank_account", "p_beneficiary_bank_extra", "p_beneficiary_qr_code_url", "p_beneficiary_notes"], omits: {} },
  { tool: "cancel_payment", rpc: "cancel_payment", exposes: ["p_payment_id"], omits: {} },
  { tool: "set_daily_rate", rpc: "create_daily_rates",
    exposes: ["p_rate_cash", "p_rate_alipay", "p_rate_wechat", "p_rate_virement"],
    omits: { p_effective_at: "toujours 'maintenant' (pas de taux futur planifié)" } },
  { tool: "set_rate_adjustment", rpc: "update_rate_adjustment", exposes: ["p_adjustment_id", "p_percentage"], omits: {} },
  { tool: "adjust_wallet", rpc: "admin_adjust_wallet", exposes: ["p_user_id", "p_amount", "p_adjustment_type", "p_reason"], omits: {} },
  { tool: "record_usdt_purchase", rpc: "record_usdt_purchase",
    exposes: ["p_supplier_id", "p_usdt_amount", "p_account_splits", "p_external_ref", "p_notes"],
    omits: { p_occurred_at: "toujours 'maintenant'" } },
  { tool: "record_usdt_sale", rpc: "record_usdt_sale",
    exposes: ["p_buyer_id", "p_usdt_amount", "p_cny_amount", "p_cny_account_id", "p_external_ref", "p_notes"],
    omits: { p_occurred_at: "toujours 'maintenant'" } },
  { tool: "create_treasury_counterparty", rpc: "create_treasury_counterparty",
    exposes: ["p_type", "p_display_name", "p_legal_name", "p_phone", "p_wechat_id", "p_notes"], omits: {} },
  { tool: "adjust_treasury_account", rpc: "adjust_treasury_account",
    exposes: ["p_account_id", "p_delta_amount", "p_reason"], omits: { p_occurred_at: "toujours 'maintenant'" } },
  { tool: "void_treasury_operation", rpc: "void_treasury_operation",
    exposes: ["p_source_table", "p_source_id", "p_void_reason"], omits: {} },
  { tool: "update_treasury_counterparty", rpc: "update_treasury_counterparty",
    exposes: ["p_id", "p_display_name", "p_legal_name", "p_phone", "p_wechat_id", "p_notes", "p_is_active"], omits: {} },
  { tool: "delete_treasury_counterparty", rpc: "delete_treasury_counterparty", exposes: ["p_id"], omits: {} },
  { tool: "record_inventory_snapshot", rpc: "record_inventory_snapshot",
    exposes: ["p_account_id", "p_actual_balance", "p_variance_reason"], omits: { p_snapshot_at: "toujours 'maintenant'" } },
  { tool: "delete_client", rpc: "admin_delete_client", exposes: ["p_user_id"], omits: {} },
];
