// Edge Function: admin-assistant
// Version: 2026-06-03.6 — 73 outils (46 lecture + 27 écriture) + découverte de capacités (do_capability),
// top clients par volume, crédit/débit wallet, preuves auto, processLock.
// "Directeur des Opérations" IA — LECTURE (réponses) + ÉCRITURE (avec CONFIRMATION humaine).
//
// - Vérifie que l'appelant est un admin actif (via son JWT).
// - Détient la clé ANTHROPIC_API_KEY (secret) — jamais exposée au frontend.
// - LECTURE : nombreux outils filtrés par les permissions du rôle.
// - ÉCRITURE : l'IA ne fait que PROPOSER une action (carte de confirmation).
//   Rien n'est exécuté tant que l'admin n'a pas confirmé. L'exécution passe par
//   les RPC existantes, appelées avec le JWT de l'admin (is_admin(auth.uid())).
// - Pièces jointes : stockées comme PREUVES (non analysées par le modèle). Prompt caching.
// - Tout est journalisé (admin_audit_logs + assistant_pending_actions).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { maskForRole } from "../_shared/mask.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Sonnet par défaut (qualité de compréhension). Le streaming assure la rapidité
// ressentie. Surchargables par secret si besoin (ex. Haiku pour la vitesse pure).
const MODEL_FAST = Deno.env.get("ASSISTANT_MODEL_FAST") ?? "claude-sonnet-4-6";
const MODEL_SMART = Deno.env.get("ASSISTANT_MODEL_SMART") ?? "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 14;
const MIN_PAYMENT_XAF = 10_000;

// ─── Instrumentation coût (Lot 1) ─────────────────────────────────────────────
// Les COMPTES de tokens sont EXACTS (issus de l'API). Les tarifs ci-dessous sont
// un ORDRE DE GRANDEUR (USD / million de tokens) pour estimer le coût ; ajuste-les
// si la facturation réelle diffère. Surchargeables sans risque.
interface TokenUsage { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; }
const PRICING_USD_PER_MTOK: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-haiku-4-5":  { in: 1, out: 5, cacheRead: 0.10, cacheWrite: 1.25 },
};
function estimateCostUsd(model: string, u: TokenUsage): number {
  const p = PRICING_USD_PER_MTOK[model] ?? PRICING_USD_PER_MTOK["claude-sonnet-4-6"];
  const cost = (u.input_tokens * p.in + u.output_tokens * p.out + u.cache_read_input_tokens * p.cacheRead + u.cache_creation_input_tokens * p.cacheWrite) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6; // 6 décimales
}

// Liste blanche pour les actions wallet (crédit/débit manuel) : e-mails ou user_id
// autorisés EN PLUS des super_admin. Configuré via secret (ex. "jonas@bonzini.com").
const WALLET_ADMINS = (Deno.env.get("ASSISTANT_WALLET_ADMINS") ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function canAdjustWallet(role: string, email: string | undefined, userId: string): boolean {
  if (role === "super_admin") return true;
  const e = (email ?? "").toLowerCase();
  return WALLET_ADMINS.includes(e) || WALLET_ADMINS.includes(userId.toLowerCase());
}

// Pièces jointes (images analysées par vision + PDF lus comme documents)
const ATTACHMENT_BUCKET = "assistant-attachments";
const ALLOWED_ATTACHMENT_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const MAX_ATTACHMENTS = 5;

// Permissions par rôle — miroir de src/contexts/AdminAuthContext.tsx
type PermKey =
  | "canViewClients" | "canEditClients"
  | "canViewDeposits" | "canProcessDeposits"
  | "canViewPayments" | "canProcessPayments"
  | "canManageRates" | "canViewLogs" | "canManageUsers" | "canViewTreasury"
  | "canViewProcurement" | "canManageProcurement";
const ROLE_PERMISSIONS: Record<string, Record<PermKey, boolean>> = {
  super_admin:      { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: true,  canManageRates: true,  canViewLogs: true,  canManageUsers: true,  canViewTreasury: true,  canViewProcurement: true,  canManageProcurement: true },
  ops:              { canViewClients: true,  canEditClients: false, canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: true,  canManageRates: true,  canViewLogs: true,  canManageUsers: false, canViewTreasury: false, canViewProcurement: false, canManageProcurement: false },
  support:          { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: false, canViewPayments: true,  canProcessPayments: false, canManageRates: false, canViewLogs: true,  canManageUsers: false, canViewTreasury: false, canViewProcurement: false, canManageProcurement: false },
  customer_success: { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: false, canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: false, canViewProcurement: false, canManageProcurement: false },
  cash_agent:       { canViewClients: false, canEditClients: false, canViewDeposits: false, canProcessDeposits: false, canViewPayments: true,  canProcessPayments: true,  canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: false, canViewProcurement: false, canManageProcurement: false },
  treasurer:        { canViewClients: false, canEditClients: false, canViewDeposits: false, canProcessDeposits: false, canViewPayments: false, canProcessPayments: false, canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: true,  canViewProcurement: false, canManageProcurement: false },
  sourcing_agent:   { canViewClients: true,  canEditClients: false, canViewDeposits: false, canProcessDeposits: false, canViewPayments: false, canProcessPayments: false, canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: false, canViewProcurement: true,  canManageProcurement: true },
};
const ALL_PERM_KEYS = Object.keys(ROLE_PERMISSIONS.super_admin) as PermKey[];
// Un utilisateur peut cumuler plusieurs rôles (ex. père = treasurer + sourcing_agent).
const ROLE_PRIORITY = ["super_admin", "ops", "customer_success", "support", "treasurer", "sourcing_agent", "cash_agent"];
function pickPrimaryRole(roles: string[]): string {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return roles[0] ?? "customer_success";
}
function mergePerms(roles: string[]): Record<PermKey, boolean> {
  const merged = Object.fromEntries(ALL_PERM_KEYS.map((k) => [k, false])) as Record<PermKey, boolean>;
  for (const r of roles) {
    const p = ROLE_PERMISSIONS[r];
    if (!p) continue;
    for (const k of ALL_PERM_KEYS) if (p[k]) merged[k] = true;
  }
  return merged;
}

// Tables lisibles en SQL libre selon les permissions du rôle (Lot 4b — confidentialité).
function allowedTablesForRole(perms: Record<PermKey, boolean>): string[] {
  const t: string[] = [];
  if (perms.canViewClients) t.push("clients", "wallets", "ledger_entries");
  if (perms.canViewDeposits) t.push("deposits", "deposit_proofs", "deposit_timeline_events");
  if (perms.canViewPayments) t.push("payments", "beneficiaries", "daily_rates", "rate_adjustments");
  if (perms.canViewTreasury) t.push("treasury_accounts", "treasury_account_balances", "treasury_ledger_entries", "treasury_counterparties", "usdt_purchases", "usdt_sales", "treasury_inventory_snapshots");
  if (perms.canViewProcurement) t.push("proc_missions", "proc_suppliers", "proc_purchase_orders", "proc_order_lines", "proc_supplier_payments", "proc_production_events", "proc_qc_inspections", "proc_commissions", "proc_documents", "proc_expenses", "proc_po_balances");
  if (perms.canViewLogs) t.push("admin_audit_logs", "user_roles");
  return t;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtXAF(n: unknown): string {
  const v = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("fr-FR").format(v) + " XAF";
}

function clamp(v: unknown, def: number, max: number): number {
  const n = Number(v);
  if (!n || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

function periodStartISO(period?: string): string {
  const d = new Date();
  if (period === "today") d.setHours(0, 0, 0, 0);
  else if (period === "month") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 7);
  return d.toISOString();
}

/**
 * Résout une plage de dates flexible à partir de :
 *  - from_date / to_date explicites (ISO ou YYYY-MM-DD), OU
 *  - year + month (1-12) → le mois entier, OU
 *  - period nommée (today/week/month/year/all).
 * Renvoie { from, to } en ISO. Défaut : 30 derniers jours.
 */
function resolveRange(a: { from_date?: string; to_date?: string; year?: number; month?: number; period?: string }): { from: string; to: string; label: string } {
  // Mois précis (ex. avril 2026 → year=2026, month=4)
  if (a.year && a.month) {
    const y = Number(a.year), m = Number(a.month);
    const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // début du mois suivant
    return { from: from.toISOString(), to: to.toISOString(), label: `${String(m).padStart(2, "0")}/${y}` };
  }
  // Dates explicites
  if (a.from_date || a.to_date) {
    const from = a.from_date ? new Date(a.from_date) : new Date("2020-01-01");
    const to = a.to_date ? new Date(a.to_date) : new Date();
    return { from: from.toISOString(), to: to.toISOString(), label: `${a.from_date ?? "…"} → ${a.to_date ?? "auj."}` };
  }
  // Période nommée
  const to = new Date();
  const from = new Date();
  const p = a.period ?? "month";
  if (p === "today") from.setHours(0, 0, 0, 0);
  else if (p === "week") from.setDate(from.getDate() - 7);
  else if (p === "year") from.setFullYear(from.getFullYear() - 1);
  else if (p === "all") from.setFullYear(from.getFullYear() - 20);
  else from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString(), label: p };
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

// ════════════════════════ OUTILS DE LECTURE ════════════════════════
interface ReadTool {
  name: string;
  permission: PermKey;
  /** Si vrai, l'outil reçoit le client AUTHENTIFIÉ (JWT admin) en 2e arg —
   *  nécessaire pour les RPC qui vérifient auth.uid() (ex. trésorerie). */
  needsAuth?: boolean;
  /** Défense en profondeur : outil réservé au super_admin (ex. requête SQL libre). */
  superAdminOnly?: boolean;
  /** Toujours disponible (introspection des capacités) — bypass du filtre de permission. */
  always?: boolean;
  description: string;
  // deno-lint-ignore no-explicit-any
  input_schema: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  execute: (admin: AnyClient, args: any, userClient?: AnyClient) => Promise<Record<string, unknown>>;
}

/**
 * Retrouve des clients par NOM (gère "prénom nom", "nom prénom", un seul mot).
 * Utilisé par les outils "par nom de client". Renvoie au plus `max` clients.
 */
// deno-lint-ignore no-explicit-any
async function findClientsByName(admin: AnyClient, name: unknown, max = 10): Promise<any[]> {
  const clean = String(name ?? "").trim().replace(/[,():*%]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const cols = "user_id, first_name, last_name, phone";
  const words = clean.split(" ").filter(Boolean).slice(0, 4);
  // deno-lint-ignore no-explicit-any
  let q: any = admin.from("clients").select(cols);
  for (const w of words) {
    const t = `%${w}%`;
    q = q.or(`first_name.ilike.${t},last_name.ilike.${t},phone.ilike.${t}`);
  }
  const { data } = await q.limit(max);
  if ((data?.length ?? 0) > 0 || words.length <= 1) return data ?? [];
  // Filet : nom complet concaténé (ordre indifférent)
  const { data: all } = await admin.from("clients").select(cols).limit(500);
  const needle = clean.toLowerCase();
  // deno-lint-ignore no-explicit-any
  return (all ?? []).filter((c: any) => {
    const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
    const rev = `${c.last_name ?? ""} ${c.first_name ?? ""}`.toLowerCase();
    return full.includes(needle) || rev.includes(needle);
  }).slice(0, max);
}

// Carte des capacités (introspection) — sert what_can_i_do. tool=null = la plateforme
// le permet (via un écran) mais Mola n'a pas encore l'outil → dire l'état ⚠️, ne pas confabuler.
const CAPABILITY_MAP: Record<string, Array<{ capability: string; tool: string | null; note?: string }>> = {
  clients: [
    { capability: "créer / modifier un client", tool: "create_client / update_client" },
    { capability: "rechercher, fiche 360°, solde, grand livre", tool: "search_clients / get_client_full_activity / get_wallet_balance / get_ledger" },
    { capability: "supprimer définitivement", tool: "delete_client", note: "super_admin" },
  ],
  depots: [
    { capability: "créer / valider / rejeter un dépôt", tool: "create_deposit / create_and_validate_deposit / validate_deposit / reject_deposit" },
    { capability: "attacher une preuve (capture/PDF)", tool: "auto (pièces jointes du message)" },
  ],
  paiements: [
    { capability: "créer un paiement au taux du jour OU à un taux personnalisé", tool: "create_payment", note: "exchange_rate optionnel = taux personnalisé, comme l'écran admin" },
    { capability: "compléter le bénéficiaire d'UN paiement", tool: "update_payment_beneficiary" },
    { capability: "annuler un paiement non finalisé (rembourse)", tool: "cancel_payment", note: "super_admin" },
    { capability: "enregistrer / modifier / archiver un bénéficiaire RÉUTILISABLE", tool: "create_beneficiary / update_beneficiary / archive_beneficiary" },
    { capability: "joindre un QR à un bénéficiaire enregistré", tool: null, note: "pas encore d'outil — possible via l'écran Bénéficiaires" },
  ],
  taux: [
    { capability: "définir les 4 taux du jour", tool: "set_daily_rate" },
    { capability: "modifier un ajustement de taux par pays/palier (%)", tool: "set_rate_adjustment", note: "super_admin" },
    { capability: "générer le flyer du taux", tool: "generate_rate_flyer" },
  ],
  tresorerie: [
    { capability: "achats/ventes USDT, comptes, contreparties, inventaire, P&L", tool: "record_usdt_purchase / record_usdt_sale / treasury_*", note: "permission canViewTreasury" },
  ],
};

// Savoir métier détaillé — indexable en mémoire sémantique (reindex_knowledge) → récupéré just-in-time.
const BUSINESS_ONTOLOGY: Array<{ scope: string; content: string }> = [
  { scope: "depots", content: "Cycle d'un dépôt : created → proof_submitted → admin_review → validated ou rejected. Valider un dépôt CRÉDITE le solde XAF (wallet) du client du montant confirmé. Un dépôt peut être créé sans preuve (en attente) puis validé quand l'argent est reçu." },
  { scope: "paiements", content: "Cycle d'un paiement fournisseur : created → waiting_beneficiary_info → ready_for_payment → processing → completed (ou rejected, cash_pending, cash_scanned). Créer un paiement DÉBITE (réserve) le solde XAF du client. Minimum 10 000 XAF. Méthodes : alipay, wechat, bank_transfer, cash." },
  { scope: "taux", content: "Le taux est exprimé en CNY (¥) pour 1 000 000 XAF, par mode (cash, alipay, wechat, virement). Des ajustements en pourcentage par pays et par palier affinent le taux final. Un paiement utilise le taux du jour, ou un taux personnalisé si l'admin en fixe un." },
  { scope: "tresorerie", content: "Chaîne de valeur trésorerie : Bonzini achète des USDT (payés en XAF) auprès de fournisseurs, puis vend ces USDT contre des CNY à des acheteurs, pour régler les fournisseurs chinois. Le coût de revient de l'USDT est suivi en coût moyen pondéré (WAC). Le bénéfice vient du spread achat/vente." },
  { scope: "wallet", content: "Le wallet est le solde XAF d'un client, crédité par un dépôt validé et débité par un paiement. Il n'est jamais modifié à la main, sauf via un ajustement tracé (crédit/débit avec motif), réservé aux administrateurs autorisés." },
  { scope: "kyc", content: "Les clients ont un statut KYC (kyc_verified). Bonzini cible les importateurs africains qui règlent des fournisseurs chinois — ce ne sont pas des transferts d'argent entre particuliers." },
];

const READ_TOOLS: ReadTool[] = [
  {
    name: "what_can_i_do",
    permission: "canViewPayments",
    always: true,
    description: "INTROSPECTION : ce que TOI (l'assistant) peux faire, par domaine, et ce que la plateforme permet même sans outil dédié. À APPELER avant d'affirmer qu'une action est impossible. domain optionnel (clients|depots|paiements|taux|tresorerie).",
    input_schema: { type: "object", properties: { domain: { type: "string" } } },
    execute: (_admin, { domain }) => {
      const d = domain ? String(domain).toLowerCase() : null;
      const map = d && CAPABILITY_MAP[d] ? { [d]: CAPABILITY_MAP[d] } : CAPABILITY_MAP;
      return Promise.resolve({ capabilities: map, note: "Si tool=null : la plateforme le permet (écran) mais je n'ai pas encore l'outil — le dire honnêtement, ne pas confabuler." });
    },
  },
  {
    name: "reindex_knowledge",
    permission: "canViewLogs",
    superAdminOnly: true,
    description: "Indexer / réindexer le savoir métier de base dans la mémoire sémantique (rappelé just-in-time). À lancer une fois après déploiement, et après une évolution du savoir. Réservé super_admin.",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      let n = 0;
      try {
        await admin.from("mola_memory").delete().eq("source", "ontology").is("admin_user_id", null);
        for (const chunk of BUSINESS_ONTOLOGY) {
          const emb = await embedText(chunk.content);
          if (!emb) continue;
          const { error } = await admin.from("mola_memory").insert({ kind: "semantic", admin_user_id: null, scope: chunk.scope, content: chunk.content, embedding: emb, source: "ontology" });
          if (!error) n++;
        }
      } catch (e) { return { error: String((e as Error)?.message ?? e), indexed: n }; }
      return { indexed: n, total: BUSINESS_ONTOLOGY.length, note: n === 0 ? "Embeddings gte-small indisponibles — réessaie après déploiement." : "Savoir métier indexé en mémoire sémantique." };
    },
  },
  {
    name: "find_capability",
    permission: "canViewPayments",
    always: true,
    description: "DÉCOUVERTE : trouve dynamiquement les capacités (actions/lectures) de la plateforme, même celles sans outil dédié écrit à la main. Donne un terme (ex. « annuler dépôt », « confirmer cash »). Renvoie les opérations disponibles, leurs paramètres réels et si elles demandent une confirmation. À utiliser AVANT de dire que tu ne peux pas faire une action.",
    input_schema: { type: "object", properties: { search: { type: "string" } } },
    execute: async (admin, { search }) => {
      const { data, error } = await admin.rpc("mola_discover_capabilities", { p_search: search || null });
      if (error) return { error: error.message };
      return { capabilities: data ?? [], note: "Si la capacité a un champ 'tool' : UTILISE cet outil dédié (plus complet). Sinon, exécute-la via do_capability (name + params ; les références BZ-… sont résolues automatiquement)." };
    },
  },
  {
    name: "list_payment_proofs",
    permission: "canViewPayments",
    description: "Lister les preuves (justificatifs) d'un paiement, par référence (BZ-…) ou payment_id. Renvoie id, nom de fichier, type, date — utile avant de supprimer (delete_payment_proof) ou de remplacer une preuve.",
    input_schema: { type: "object", properties: { reference: { type: "string" }, payment_id: { type: "string" } } },
    execute: async (admin, { reference, payment_id }) => {
      let pid = payment_id;
      if (!pid && reference) { const { data } = await admin.from("payments").select("id").eq("reference", reference).maybeSingle(); pid = data?.id; }
      if (!pid) return { error: "Fournir reference ou payment_id." };
      const { data, error } = await admin.from("payment_proofs").select("id, file_name, file_type, uploaded_by_type, created_at").eq("payment_id", pid).order("created_at", { ascending: false });
      if (error) return { error: error.message };
      return { payment_id: pid, count: data?.length ?? 0, proofs: data ?? [] };
    },
  },
  {
    name: "search_clients",
    permission: "canViewClients",
    description: "Rechercher des clients par nom, prénom, nom complet, téléphone ou entreprise. Fonctionne avec 'Jonas', 'Jonas Boco', 'Boco Jonas', un numéro de téléphone, etc. Renvoie id, user_id, nom, téléphone, pays, statut KYC.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
    execute: async (admin, { query, limit }) => {
      // Nettoyage : retire les caractères de structure PostgREST du terme
      const clean = String(query ?? "").trim().replace(/[,():*%]/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) return { count: 0, clients: [] };
      const n = clamp(limit, 10, 25);
      const cols = "id, user_id, first_name, last_name, phone, company_name, country, city, status, kyc_verified";

      // Découpe en mots. Pour "Jonas Boco", chaque mot doit apparaître quelque part
      // (prénom, nom OU téléphone) → gère "prénom nom", "nom prénom", un seul mot, un numéro.
      const words = clean.split(" ").filter(Boolean).slice(0, 4);
      // deno-lint-ignore no-explicit-any
      let q: any = admin.from("clients").select(cols);
      for (const w of words) {
        const t = `%${w}%`;
        q = q.or(`first_name.ilike.${t},last_name.ilike.${t},phone.ilike.${t},company_name.ilike.${t}`);
      }
      const { data, error } = await q.limit(n);
      if (error) return { error: error.message };

      // Filet de sécurité : si rien (ex. ordre des mots), on retente sur le nom complet concaténé.
      if ((data?.length ?? 0) === 0 && words.length > 1) {
        const { data: all } = await admin.from("clients").select(cols).limit(500);
        const needle = clean.toLowerCase();
        // deno-lint-ignore no-explicit-any
        const hits = (all ?? []).filter((c: any) => {
          const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
          const rev = `${c.last_name ?? ""} ${c.first_name ?? ""}`.toLowerCase();
          return full.includes(needle) || rev.includes(needle);
        }).slice(0, n);
        return { count: hits.length, clients: hits };
      }
      return { count: data?.length ?? 0, clients: data ?? [] };
    },
  },
  {
    name: "get_client_details",
    permission: "canViewClients",
    description: "Fiche complète d'un client (profil, KYC, entreprise, pays) + solde du wallet + nombre de dépôts/paiements. Fournir client_user_id (recommandé) ou client_id.",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" }, client_id: { type: "string" } } },
    execute: async (admin, { client_user_id, client_id }) => {
      let q = admin.from("clients").select(
        "id, user_id, first_name, last_name, email, phone, company_name, country, city, gender, kyc_verified, activity_sector, status, notes, created_at",
      );
      if (client_user_id) q = q.eq("user_id", client_user_id);
      else if (client_id) q = q.eq("id", client_id);
      else return { error: "Fournir client_user_id ou client_id" };
      const { data: client, error } = await q.maybeSingle();
      if (error) return { error: error.message };
      if (!client) return { found: false };
      const uid = client.user_id;
      const { data: wallet } = await admin.from("wallets").select("balance_xaf").eq("user_id", uid).maybeSingle();
      const { count: depCount } = await admin.from("deposits").select("id", { count: "exact", head: true }).eq("user_id", uid);
      const { count: payCount } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", uid);
      return {
        found: true, client,
        wallet_balance_xaf: wallet?.balance_xaf ?? 0,
        wallet_balance_formatted: fmtXAF(wallet?.balance_xaf ?? 0),
        deposits_count: depCount ?? 0, payments_count: payCount ?? 0,
      };
    },
  },
  {
    name: "get_wallet_balance",
    permission: "canViewClients",
    description: "Solde du portefeuille (wallet) d'un client à partir de son user_id.",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" } }, required: ["client_user_id"] },
    execute: async (admin, { client_user_id }) => {
      const { data, error } = await admin.from("wallets").select("balance_xaf, user_id").eq("user_id", client_user_id).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { found: false };
      return { found: true, balance_xaf: data.balance_xaf, balance_formatted: fmtXAF(data.balance_xaf) };
    },
  },
  {
    name: "get_ledger",
    permission: "canViewClients",
    description: "Historique du grand livre (mouvements wallet) d'un client : dépôts crédités, paiements réservés, ajustements. Par user_id.",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" }, limit: { type: "number" } }, required: ["client_user_id"] },
    execute: async (admin, { client_user_id, limit }) => {
      const { data, error } = await admin
        .from("ledger_entries")
        .select("entry_type, amount_xaf, balance_before, balance_after, description, reference_type, created_at")
        .eq("user_id", client_user_id).order("created_at", { ascending: false }).limit(clamp(limit, 15, 50));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, entries: data ?? [] };
    },
  },
  {
    name: "list_deposits",
    permission: "canViewDeposits",
    description: "Lister les dépôts, filtrables par DATES. Filtres optionnels: status, client_user_id, et une période : from_date+to_date (YYYY-MM-DD) OU year+month (ex. avril 2026 = year 2026, month 4) OU period (today/week/month/year/all).",
    input_schema: { type: "object", properties: { status: { type: "string" }, client_user_id: { type: "string" }, from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, a) => {
      const hasRange = a.from_date || a.to_date || (a.year && a.month) || a.period;
      const max = clamp(a.limit, 50, 200);
      let q = admin.from("deposits")
        .select("reference, amount_xaf, confirmed_amount_xaf, method, status, bank_name, agency_name, created_at, user_id")
        .order("created_at", { ascending: false }).limit(max);
      if (a.status) q = q.eq("status", a.status);
      if (a.client_user_id) q = q.eq("user_id", a.client_user_id);
      let label: string | undefined;
      if (hasRange) { const r = resolveRange(a); label = r.label; q = q.gte("created_at", r.from).lt("created_at", r.to); }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const truncated = (data?.length ?? 0) >= max;
      return {
        period: label, count: data?.length ?? 0, truncated,
        note: truncated ? "⚠️ Liste TRONQUÉE (plus de lignes existent). N'additionne PAS ces lignes pour un total/volume — utilise get_operations_stats (exact, côté serveur)." : undefined,
        deposits: data ?? [],
      };
    },
  },
  {
    name: "list_depositing_clients",
    permission: "canViewDeposits",
    description: "Lister TOUS les CLIENTS (dédupliqués, AVEC LEUR NOM) ayant effectué des dépôts sur une période — c'est la liste des clients déposants, pas les dépôts un par un. Pour chaque client : nombre de dépôts, total déposé, date du dernier dépôt. Période : months (ex. 4 = les 4 derniers mois) OU from_date+to_date (YYYY-MM-DD) OU year+month OU period (week/month/year/all). Par défaut TOUS statuts confondus ; validated_only=true pour ne compter que les dépôts validés. N'est PAS tronqué : agrège tous les dépôts de la période côté serveur.",
    input_schema: { type: "object", properties: { months: { type: "number" }, from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" }, validated_only: { type: "boolean" }, limit: { type: "number" } } },
    execute: async (admin, a) => {
      // Période : "X derniers mois" prioritaire (le cas le plus courant), sinon resolveRange.
      let from: string, to: string, label: string;
      if (a.months && Number(a.months) > 0) {
        const t = new Date(); const f = new Date(); f.setMonth(f.getMonth() - Number(a.months));
        from = f.toISOString(); to = t.toISOString(); label = `${Number(a.months)} derniers mois`;
      } else {
        const r = resolveRange(a); from = r.from; to = r.to; label = r.label;
      }
      let q = admin.from("deposits")
        .select("user_id, amount_xaf, confirmed_amount_xaf, status, created_at")
        .gte("created_at", from).lt("created_at", to).limit(10000);
      if (a.validated_only) q = q.eq("status", "validated");
      const { data, error } = await q;
      if (error) return { error: error.message };
      // Dédup + agrégation par client (côté serveur, donc complet — pas de plafond à 50).
      // deno-lint-ignore no-explicit-any
      const agg: Record<string, any> = {};
      for (const d of data ?? []) {
        const id = d.user_id as string;
        const amt = Number(d.confirmed_amount_xaf ?? d.amount_xaf ?? 0);
        if (!agg[id]) agg[id] = { nb: 0, total: 0, last: d.created_at };
        agg[id].nb += 1; agg[id].total += amt;
        if (d.created_at > agg[id].last) agg[id].last = d.created_at;
      }
      const ids = Object.keys(agg);
      if (ids.length === 0) return { period: label, total_clients: 0, clients: [], note: "Aucun client n'a déposé sur cette période." };
      const { data: clients } = await admin.from("clients").select("user_id, first_name, last_name, phone").in("user_id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const c of clients ?? []) byId[c.user_id] = c;
      const rows = ids.map((id) => ({
        nom: byId[id] ? `${byId[id].first_name ?? ""} ${byId[id].last_name ?? ""}`.trim() : "(client inconnu)",
        telephone: byId[id]?.phone ?? null,
        nb_depots: agg[id].nb,
        total_xaf: agg[id].total,
        total_formatted: fmtXAF(agg[id].total),
        dernier_depot: String(agg[id].last).slice(0, 10),
        user_id: id,
      })).sort((x, y) => y.total_xaf - x.total_xaf).slice(0, clamp(a.limit, 200, 500));
      return { period: label, total_clients: ids.length, returned: rows.length, validated_only: !!a.validated_only, clients: rows };
    },
  },
  {
    name: "get_deposit",
    permission: "canViewDeposits",
    description: "Détail complet d'un dépôt (par référence BZ-DP-... ou par deposit_id), avec sa chronologie et le nombre de preuves jointes.",
    input_schema: { type: "object", properties: { reference: { type: "string" }, deposit_id: { type: "string" } } },
    execute: async (admin, { reference, deposit_id }) => {
      let q = admin.from("deposits").select(
        "id, reference, amount_xaf, confirmed_amount_xaf, method, bank_name, agency_name, status, admin_comment, rejection_reason, validated_by, validated_at, created_at, user_id",
      );
      if (reference) q = q.eq("reference", reference);
      else if (deposit_id) q = q.eq("id", deposit_id);
      else return { error: "Fournir reference ou deposit_id" };
      const { data: dep, error } = await q.maybeSingle();
      if (error) return { error: error.message };
      if (!dep) return { found: false };
      const { data: timeline } = await admin.from("deposit_timeline_events")
        .select("event_type, description, created_at").eq("deposit_id", dep.id).order("created_at", { ascending: true });
      const { count: proofCount } = await admin.from("deposit_proofs")
        .select("id", { count: "exact", head: true }).eq("deposit_id", dep.id).is("deleted_at", null);
      return { found: true, deposit: dep, proofs_count: proofCount ?? 0, timeline: timeline ?? [] };
    },
  },
  {
    name: "list_payments",
    permission: "canViewPayments",
    description: "Lister les paiements fournisseurs, filtrables par DATES. Filtres optionnels: status (created, waiting_beneficiary_info, ready_for_payment, processing, completed, rejected, cash_pending, cash_scanned), client_user_id, et une période : from_date+to_date OU year+month OU period (today/week/month/year/all).",
    input_schema: { type: "object", properties: { status: { type: "string" }, client_user_id: { type: "string" }, from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, a) => {
      const hasRange = a.from_date || a.to_date || (a.year && a.month) || a.period;
      const max = clamp(a.limit, 50, 200);
      let q = admin.from("payments")
        .select("reference, amount_xaf, amount_rmb, method, status, beneficiary_name, created_at, user_id")
        .order("created_at", { ascending: false }).limit(max);
      if (a.status) q = q.eq("status", a.status);
      if (a.client_user_id) q = q.eq("user_id", a.client_user_id);
      let label: string | undefined;
      if (hasRange) { const r = resolveRange(a); label = r.label; q = q.gte("created_at", r.from).lt("created_at", r.to); }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const truncated = (data?.length ?? 0) >= max;
      return {
        period: label, count: data?.length ?? 0, truncated,
        note: truncated ? "⚠️ Liste TRONQUÉE (plus de lignes existent). N'additionne PAS ces lignes pour un total/volume — utilise get_operations_stats (exact, côté serveur)." : undefined,
        payments: data ?? [],
      };
    },
  },
  {
    name: "get_operations_stats",
    permission: "canViewDeposits",
    description:
      "STATISTIQUES EXACTES dépôts + paiements sur une période : volumes, comptages, ventilation par statut, plus gros montant. Agrégé CÔTÉ SERVEUR sur TOUTES les lignes de la période (aucun plafond, aucun calcul approximatif). C'EST l'outil à utiliser pour toute question de VOLUME / TOTAL / COMBIEN / bilan du mois. Période : year+month (ex. mai 2026 = year 2026, month 5) OU from_date+to_date (YYYY-MM-DD) OU period (today/week/month/year/all). Renvoie aussi les bornes de dates EXACTES interrogées (pour vérification).",
    input_schema: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" } } },
    execute: async (admin, a) => {
      const r = resolveRange(a);
      const CAP = 50000;
      const [depRes, payRes] = await Promise.all([
        admin.from("deposits").select("amount_xaf, confirmed_amount_xaf, status, created_at").gte("created_at", r.from).lt("created_at", r.to).limit(CAP),
        admin.from("payments").select("amount_xaf, status, created_at").gte("created_at", r.from).lt("created_at", r.to).limit(CAP),
      ]);
      if (depRes.error) return { error: depRes.error.message };
      if (payRes.error) return { error: payRes.error.message };
      const deps = depRes.data ?? [], pays = payRes.data ?? [];
      // Agrégation déterministe (montants = entiers XAF, somme exacte en JS sous 2^53).
      const aggregate = (rows: Array<Record<string, unknown>>, amountKeys: string[], doneStatus: string) => {
        const byStatus: Record<string, { count: number; volume_xaf: number; volume: string }> = {};
        let total = 0, doneVol = 0, biggest = 0;
        for (const row of rows) {
          const st = String(row.status ?? "?");
          let amt = 0;
          for (const k of amountKeys) { const v = Number(row[k]); if (v) { amt = v; break; } }
          if (!byStatus[st]) byStatus[st] = { count: 0, volume_xaf: 0, volume: "" };
          byStatus[st].count += 1; byStatus[st].volume_xaf += amt;
          total += 1;
          if (st === doneStatus) { doneVol += amt; if (amt > biggest) biggest = amt; }
        }
        for (const st of Object.keys(byStatus)) byStatus[st].volume = fmtXAF(byStatus[st].volume_xaf);
        return { byStatus, total, doneVol, biggest };
      };
      const d = aggregate(deps, ["confirmed_amount_xaf", "amount_xaf"], "validated");
      const p = aggregate(pays, ["amount_xaf"], "completed");
      const truncated = deps.length >= CAP || pays.length >= CAP;
      return {
        periode: r.label,
        bornes_exactes: { from: r.from, to: r.to },
        note: "Chiffres EXACTS, agrégés côté serveur sur toutes les lignes. Présente ces nombres tels quels, ne recalcule rien à la main.",
        depots: {
          total_count: d.total,
          volume_valides_xaf: d.doneVol,
          volume_valides: fmtXAF(d.doneVol),
          plus_gros_valide: fmtXAF(d.biggest),
          par_statut: d.byStatus,
        },
        paiements: {
          total_count: p.total,
          volume_completes_xaf: p.doneVol,
          volume_completes: fmtXAF(p.doneVol),
          plus_gros_complete: fmtXAF(p.biggest),
          par_statut: p.byStatus,
        },
        ...(truncated ? { warning: `Période très large (≥ ${CAP} lignes) : chiffres possiblement plafonnés — restreins la période.` } : {}),
      };
    },
  },
  {
    name: "get_payment",
    permission: "canViewPayments",
    description: "Détail complet d'un paiement (par référence ou payment_id) : montants XAF/RMB, taux, méthode, bénéficiaire, statut, motif de rejet éventuel.",
    input_schema: { type: "object", properties: { reference: { type: "string" }, payment_id: { type: "string" } } },
    execute: async (admin, { reference, payment_id }) => {
      let q = admin.from("payments").select(
        "id, reference, amount_xaf, amount_rmb, exchange_rate, method, status, beneficiary_name, beneficiary_phone, beneficiary_bank_name, beneficiary_bank_account, beneficiary_identifier_type, rejection_reason, admin_comment, processed_at, created_at, user_id",
      );
      if (reference) q = q.eq("reference", reference);
      else if (payment_id) q = q.eq("id", payment_id);
      else return { error: "Fournir reference ou payment_id" };
      const { data, error } = await q.maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { found: false };
      return { found: true, payment: data };
    },
  },
  {
    name: "list_beneficiaries",
    permission: "canViewPayments",
    description: "Lister les bénéficiaires enregistrés d'un client (par user_id). Filtre optionnel: payment_method (alipay, wechat, bank_transfer, cash).",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" }, payment_method: { type: "string" }, limit: { type: "number" } }, required: ["client_user_id"] },
    execute: async (admin, { client_user_id, payment_method, limit }) => {
      let q = admin.from("beneficiaries")
        .select("id, alias, name, payment_method, identifier_type, phone, email, bank_name, is_active, created_at")
        .eq("client_id", client_user_id).order("created_at", { ascending: false }).limit(clamp(limit, 15, 50));
      if (payment_method) q = q.eq("payment_method", payment_method);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, beneficiaries: data ?? [] };
    },
  },
  {
    name: "get_daily_rate",
    permission: "canViewPayments",
    description: "Taux du jour actif. Exprimé en CNY (¥) pour 1 000 000 XAF, par mode (cash, alipay, wechat, virement).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data, error } = await admin.from("daily_rates")
        .select("rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at")
        .eq("is_active", true).order("effective_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { found: false };
      return { found: true, unit: "CNY pour 1 000 000 XAF", rate: data };
    },
  },
  {
    name: "generate_rate_flyer",
    permission: "canViewPayments",
    description: "Générer le FLYER (image PNG) du taux du jour, prêt à partager. Utilise le taux actif. Optionnel: dark (true pour la version sombre). L'image est renvoyée directement dans le chat, téléchargeable.",
    input_schema: { type: "object", properties: { dark: { type: "boolean" } } },
    execute: async (admin, { dark }) => {
      // 1) Taux du jour actif
      const { data: rate, error } = await admin.from("daily_rates")
        .select("rate_cash, rate_alipay, rate_wechat, rate_virement")
        .eq("is_active", true).order("effective_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return { error: error.message };
      if (!rate) return { error: "Aucun taux du jour actif. Définis d'abord le taux." };

      // 2) Appel de l'Edge Function generate-flyer (PNG). rates attendu: {alipay, wechat, bank, cash}
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const rates = { alipay: Number(rate.rate_alipay), wechat: Number(rate.rate_wechat), bank: Number(rate.rate_virement), cash: Number(rate.rate_cash) };
      let pngBytes: Uint8Array;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-flyer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": anonKey, "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify({ rates, dark: dark === true }),
        });
        if (!res.ok) return { error: `Génération du flyer échouée (${res.status}).` };
        pngBytes = new Uint8Array(await res.arrayBuffer());
      } catch (e) { return { error: `Génération du flyer: ${String((e as Error)?.message ?? e)}` }; }

      // 3) Dépose dans le bucket privé + URL signée (lecture temporaire) pour l'afficher au chat
      const path = `flyers/${Date.now()}-taux.png`;
      const up = await admin.storage.from(ATTACHMENT_BUCKET).upload(path, pngBytes, { contentType: "image/png", upsert: true });
      if (up.error) return { error: `Stockage du flyer: ${up.error.message}` };
      const signed = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 3600);
      if (signed.error || !signed.data?.signedUrl) return { error: "URL du flyer indisponible." };

      // __image renvoie l'image au chat ; le texte sert au modèle.
      return { success: true, rates, __image: { url: signed.data.signedUrl, name: "Flyer taux du jour", kind: "image" }, message: "Flyer du taux du jour généré et affiché dans le chat." };
    },
  },
  {
    name: "get_rate_history",
    permission: "canViewPayments",
    description: "Historique des taux du jour (les plus récents).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin.from("daily_rates")
        .select("rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at, is_active")
        .order("effective_at", { ascending: false }).limit(clamp(limit, 7, 30));
      if (error) return { error: error.message };
      return { unit: "CNY pour 1 000 000 XAF", count: data?.length ?? 0, rates: data ?? [] };
    },
  },
  {
    name: "get_rate_adjustments",
    permission: "canViewPayments",
    description: "Ajustements de taux par pays et par palier (type, clé, pourcentage).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data, error } = await admin.from("rate_adjustments")
        .select("type, key, label, percentage, is_reference, sort_order").order("type", { ascending: true });
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, adjustments: data ?? [] };
    },
  },
  {
    name: "get_stats",
    permission: "canViewDeposits",
    description: "Statistiques d'activité sur une période : nombre et volume des dépôts validés et des paiements. period = 'today' | 'week' | 'month' (défaut 'week').",
    input_schema: { type: "object", properties: { period: { type: "string", enum: ["today", "week", "month"] } } },
    execute: async (admin, { period }) => {
      const since = periodStartISO(period);
      const { data: deps, error: e1 } = await admin.from("deposits").select("amount_xaf, confirmed_amount_xaf, status, created_at").gte("created_at", since).limit(2000);
      if (e1) return { error: e1.message };
      const { data: pays, error: e2 } = await admin.from("payments").select("amount_xaf, status, created_at").gte("created_at", since).limit(2000);
      if (e2) return { error: e2.message };
      const validated = (deps ?? []).filter((d: AnyClient) => d.status === "validated");
      const depositVolume = validated.reduce((s: number, d: AnyClient) => s + Number(d.confirmed_amount_xaf ?? d.amount_xaf ?? 0), 0);
      const paymentVolume = (pays ?? []).reduce((s: number, p: AnyClient) => s + Number(p.amount_xaf ?? 0), 0);
      const payByStatus: Record<string, number> = {};
      for (const p of pays ?? []) payByStatus[p.status] = (payByStatus[p.status] ?? 0) + 1;
      return {
        period: period ?? "week", since, note: "Échantillon plafonné à 2000 lignes par table.",
        deposits: { total: deps?.length ?? 0, validated_count: validated.length, validated_volume_xaf: depositVolume, validated_volume_formatted: fmtXAF(depositVolume) },
        payments: { total: pays?.length ?? 0, by_status: payByStatus, volume_xaf: paymentVolume, volume_formatted: fmtXAF(paymentVolume) },
      };
    },
  },
  {
    name: "get_pending_summary",
    permission: "canViewDeposits",
    description: "Ce qui demande de l'attention MAINTENANT : dépôts à traiter (created, proof_submitted, admin_review) et paiements en cours (waiting_beneficiary_info, ready_for_payment, processing).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const deposits_pending: Record<string, number> = {};
      for (const s of ["created", "proof_submitted", "admin_review"]) {
        const { count } = await admin.from("deposits").select("id", { count: "exact", head: true }).eq("status", s);
        deposits_pending[s] = count ?? 0;
      }
      const payments_pending: Record<string, number> = {};
      for (const s of ["waiting_beneficiary_info", "ready_for_payment", "processing"]) {
        const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("status", s);
        payments_pending[s] = count ?? 0;
      }
      return { deposits_pending, payments_pending };
    },
  },
  {
    name: "get_treasury_summary",
    permission: "canViewTreasury",
    description: "Résumé trésorerie : soldes des comptes, stock USDT, totaux achats/ventes USDT.",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data: accounts } = await admin.from("treasury_account_balances").select("label, code, kind, currency, balance, is_active").eq("is_active", true);
      const { data: purchases } = await admin.from("usdt_purchases").select("usdt_amount, xaf_amount").is("voided_at", null).limit(5000);
      const { data: sales } = await admin.from("usdt_sales").select("usdt_amount").is("voided_at", null).limit(5000);
      const boughtUsdt = (purchases ?? []).reduce((s: number, p: AnyClient) => s + Number(p.usdt_amount ?? 0), 0);
      const soldUsdt = (sales ?? []).reduce((s: number, p: AnyClient) => s + Number(p.usdt_amount ?? 0), 0);
      const xafSpent = (purchases ?? []).reduce((s: number, p: AnyClient) => s + Number(p.xaf_amount ?? 0), 0);
      return { accounts: accounts ?? [], usdt_stock: boughtUsdt - soldUsdt, usdt_bought_total: boughtUsdt, usdt_sold_total: soldUsdt, xaf_spent_on_usdt: xafSpent, xaf_spent_formatted: fmtXAF(xafSpent) };
    },
  },
  {
    name: "list_treasury_operations",
    permission: "canViewTreasury",
    description: "Dernières opérations de trésorerie : achats USDT (XAF→USDT) et ventes USDT (USDT→CNY).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const n = clamp(limit, 10, 25);
      const { data: purchases } = await admin.from("usdt_purchases").select("usdt_amount, xaf_amount, implicit_rate, channel, occurred_at").is("voided_at", null).order("occurred_at", { ascending: false }).limit(n);
      const { data: sales } = await admin.from("usdt_sales").select("usdt_amount, cny_amount, implicit_rate, occurred_at").is("voided_at", null).order("occurred_at", { ascending: false }).limit(n);
      return { purchases: purchases ?? [], sales: sales ?? [] };
    },
  },
  {
    name: "list_audit_logs",
    permission: "canViewLogs",
    description: "Journal des actions admin (les plus récentes). Filtre optionnel: action_type.",
    input_schema: { type: "object", properties: { action_type: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, { action_type, limit }) => {
      let q = admin.from("admin_audit_logs").select("admin_user_id, action_type, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(clamp(limit, 15, 50));
      if (action_type) q = q.eq("action_type", action_type);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, logs: data ?? [] };
    },
  },
  {
    name: "list_admins",
    permission: "canManageUsers",
    description: "Lister les comptes administrateurs et leurs rôles (nom, email, rôle, désactivé ou non).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data, error } = await admin.from("user_roles").select("first_name, last_name, email, role, is_disabled, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, admins: data ?? [] };
    },
  },
  {
    name: "count_clients",
    permission: "canViewClients",
    description: "Compter le nombre total de clients. Optionnel: pays (filtre), kyc_verified (true/false).",
    input_schema: { type: "object", properties: { country: { type: "string" }, kyc_verified: { type: "boolean" } } },
    execute: async (admin, { country, kyc_verified }) => {
      let q = admin.from("clients").select("id", { count: "exact", head: true });
      if (country) q = q.ilike("country", `%${String(country).replace(/[,():*%]/g, "")}%`);
      if (typeof kyc_verified === "boolean") q = q.eq("kyc_verified", kyc_verified);
      const { count, error } = await q;
      if (error) return { error: error.message };
      return { total_clients: count ?? 0 };
    },
  },
  {
    name: "list_recent_clients",
    permission: "canViewClients",
    description: "Lister les clients les plus récemment créés (nouveaux clients).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin.from("clients")
        .select("user_id, first_name, last_name, phone, country, created_at")
        .order("created_at", { ascending: false }).limit(clamp(limit, 10, 30));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, clients: data ?? [] };
    },
  },
  {
    name: "top_clients_by_balance",
    permission: "canViewClients",
    description: "Lister les clients ayant les plus gros soldes de wallet (en XAF). Utile pour voir les principaux clients.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data: wallets } = await admin.from("wallets").select("user_id, balance_xaf").order("balance_xaf", { ascending: false }).limit(clamp(limit, 10, 25));
      const ids = (wallets ?? []).map((w: AnyClient) => w.user_id);
      if (!ids.length) return { count: 0, clients: [] };
      const { data: clients } = await admin.from("clients").select("user_id, first_name, last_name, phone").in("user_id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const c of clients ?? []) byId[c.user_id] = c;
      const rows = (wallets ?? []).map((w: AnyClient) => ({
        name: byId[w.user_id] ? `${byId[w.user_id].first_name} ${byId[w.user_id].last_name}` : "—",
        phone: byId[w.user_id]?.phone ?? null,
        balance_xaf: w.balance_xaf, balance_formatted: fmtXAF(w.balance_xaf), user_id: w.user_id,
      }));
      return { count: rows.length, clients: rows };
    },
  },
  {
    name: "search_deposit_by_amount",
    permission: "canViewDeposits",
    description: "Retrouver des dépôts par montant approximatif (à ±2%). Utile quand on connaît le montant mais pas la référence. Optionnel: status.",
    input_schema: { type: "object", properties: { amount_xaf: { type: "number" }, status: { type: "string" }, limit: { type: "number" } }, required: ["amount_xaf"] },
    execute: async (admin, { amount_xaf, status, limit }) => {
      const amt = Number(amount_xaf);
      if (!amt) return { error: "Montant invalide." };
      const lo = Math.floor(amt * 0.98), hi = Math.ceil(amt * 1.02);
      let q = admin.from("deposits").select("reference, amount_xaf, confirmed_amount_xaf, method, status, created_at, user_id")
        .gte("amount_xaf", lo).lte("amount_xaf", hi).order("created_at", { ascending: false }).limit(clamp(limit, 10, 25));
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, deposits: data ?? [] };
    },
  },
  {
    name: "get_client_full_activity",
    permission: "canViewClients",
    description: "Vue 360° d'un client (par user_id) : solde + ses derniers dépôts + ses derniers paiements + ses bénéficiaires. Idéal pour faire le point sur un client.",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" }, limit: { type: "number" } }, required: ["client_user_id"] },
    execute: async (admin, { client_user_id, limit }) => {
      const n = clamp(limit, 5, 15);
      const { data: client } = await admin.from("clients").select("first_name, last_name, phone, country, kyc_verified").eq("user_id", client_user_id).maybeSingle();
      if (!client) return { found: false };
      const { data: wallet } = await admin.from("wallets").select("balance_xaf").eq("user_id", client_user_id).maybeSingle();
      const { data: deposits } = await admin.from("deposits").select("reference, amount_xaf, method, status, created_at").eq("user_id", client_user_id).order("created_at", { ascending: false }).limit(n);
      const { data: payments } = await admin.from("payments").select("reference, amount_xaf, amount_rmb, method, status, created_at").eq("user_id", client_user_id).order("created_at", { ascending: false }).limit(n);
      const { data: beneficiaries } = await admin.from("beneficiaries").select("alias, name, payment_method").eq("client_id", client_user_id).limit(n);
      return {
        found: true, client,
        wallet_balance_xaf: wallet?.balance_xaf ?? 0, wallet_balance_formatted: fmtXAF(wallet?.balance_xaf ?? 0),
        deposits: deposits ?? [], payments: payments ?? [], beneficiaries: beneficiaries ?? [],
      };
    },
  },
  {
    name: "list_recent_proofs",
    permission: "canViewDeposits",
    description: "Lister les dernières preuves de dépôt ajoutées (qui les a ajoutées, sur quel dépôt, quand).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin.from("deposit_proofs")
        .select("deposit_id, file_name, file_type, uploaded_by_type, uploaded_at")
        .is("deleted_at", null).order("uploaded_at", { ascending: false }).limit(clamp(limit, 10, 25));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, proofs: data ?? [] };
    },
  },
  {
    name: "find_deposits_by_client_name",
    permission: "canViewDeposits",
    description: "Trouver les dépôts d'un client en donnant son NOM (ex. 'Jonas Boco'). Pratique quand on n'a pas l'user_id. Filtre optionnel: status.",
    input_schema: { type: "object", properties: { name: { type: "string" }, status: { type: "string" }, limit: { type: "number" } }, required: ["name"] },
    execute: async (admin, { name, status, limit }) => {
      const clients = await findClientsByName(admin, name, 10);
      if (clients.length === 0) return { found: false, message: "Aucun client à ce nom." };
      const ids = clients.map((c) => c.user_id);
      let q = admin.from("deposits").select("reference, amount_xaf, confirmed_amount_xaf, method, status, created_at, user_id")
        .in("user_id", ids).order("created_at", { ascending: false }).limit(clamp(limit, 15, 40));
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { matched_clients: clients.map((c) => ({ name: `${c.first_name} ${c.last_name}`, user_id: c.user_id })), count: data?.length ?? 0, deposits: data ?? [] };
    },
  },
  {
    name: "find_payments_by_client_name",
    permission: "canViewPayments",
    description: "Trouver les paiements d'un client en donnant son NOM (ex. 'Jonas Boco'), avec filtre de DATES. Optionnels: status, et période : from_date+to_date OU year+month OU period.",
    input_schema: { type: "object", properties: { name: { type: "string" }, status: { type: "string" }, from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" }, limit: { type: "number" } }, required: ["name"] },
    execute: async (admin, a) => {
      const clients = await findClientsByName(admin, a.name, 10);
      if (clients.length === 0) return { found: false, message: "Aucun client à ce nom." };
      const ids = clients.map((c) => c.user_id);
      let q = admin.from("payments").select("reference, amount_xaf, amount_rmb, method, status, beneficiary_name, created_at, user_id")
        .in("user_id", ids).order("created_at", { ascending: false }).limit(clamp(a.limit, 15, 50));
      if (a.status) q = q.eq("status", a.status);
      const hasRange = a.from_date || a.to_date || (a.year && a.month) || a.period;
      let label: string | undefined;
      if (hasRange) { const r = resolveRange(a); label = r.label; q = q.gte("created_at", r.from).lt("created_at", r.to); }
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { period: label, matched_clients: clients.map((c) => ({ name: `${c.first_name} ${c.last_name}`, user_id: c.user_id })), count: data?.length ?? 0, payments: data ?? [] };
    },
  },
  {
    name: "top_clients_by_volume",
    permission: "canViewClients",
    description: "Classement des clients par VOLUME de transactions sur une période (le vrai 'top clients'). metric = 'payments' (volume payé), 'deposits' (volume déposé validé) ou 'both' (défaut). Période : from_date+to_date OU year+month (ex. avril 2026) OU period (week/month/year/all). Renvoie les N premiers clients avec leur volume.",
    input_schema: { type: "object", properties: { metric: { type: "string", enum: ["payments", "deposits", "both"] }, from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, a) => {
      const r = resolveRange(a);
      const metric = a.metric ?? "both";
      const topN = clamp(a.limit, 5, 20);
      const vol: Record<string, number> = {};
      if (metric === "payments" || metric === "both") {
        const { data } = await admin.from("payments").select("user_id, amount_xaf, status, created_at").gte("created_at", r.from).lt("created_at", r.to).limit(10000);
        for (const p of data ?? []) { if (p.status !== "rejected" && p.status !== "cancelled_by_admin") vol[p.user_id] = (vol[p.user_id] ?? 0) + Number(p.amount_xaf ?? 0); }
      }
      if (metric === "deposits" || metric === "both") {
        const { data } = await admin.from("deposits").select("user_id, amount_xaf, confirmed_amount_xaf, status, created_at").eq("status", "validated").gte("created_at", r.from).lt("created_at", r.to).limit(10000);
        for (const d of data ?? []) vol[d.user_id] = (vol[d.user_id] ?? 0) + Number(d.confirmed_amount_xaf ?? d.amount_xaf ?? 0);
      }
      const sorted = Object.entries(vol).sort((x, y) => y[1] - x[1]).slice(0, topN);
      if (sorted.length === 0) return { period: r.label, metric, count: 0, clients: [], note: "Aucune transaction sur cette période." };
      const ids = sorted.map(([id]) => id);
      const { data: clients } = await admin.from("clients").select("user_id, first_name, last_name, phone").in("user_id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const c of clients ?? []) byId[c.user_id] = c;
      const rows = sorted.map(([id, v], i) => ({
        rank: i + 1,
        name: byId[id] ? `${byId[id].first_name} ${byId[id].last_name}` : "—",
        phone: byId[id]?.phone ?? null,
        volume_xaf: v, volume_formatted: fmtXAF(v), user_id: id,
      }));
      return { period: r.label, metric, count: rows.length, clients: rows };
    },
  },
  {
    name: "get_dashboard",
    permission: "canViewDeposits",
    description: "Tableau de bord global de la plateforme (vue d'ensemble) : nombre de clients, clients actifs, solde total des wallets, dépôts en attente, paiements en attente, taux actuel, volume du jour, volume de la semaine.",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data, error } = await admin.rpc("get_dashboard_stats");
      if (error) return { error: error.message };
      return { dashboard: data };
    },
  },
  {
    name: "treasury_report",
    permission: "canViewTreasury",
    needsAuth: true,
    description: "Rapport complet du module trésorerie sur une période (P&L) : soldes des comptes, achats/ventes USDT, taux implicites, spreads (chaîne et client), stock USDT, WAC, taux de revient, bénéfice total, capital immobilisé. Période flexible : from_date+to_date OU year+month (ex. avril 2026) OU period (today/week/month/year/all).",
    input_schema: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, year: { type: "number" }, month: { type: "number" }, period: { type: "string" } } },
    execute: async (admin, a, userClient) => {
      const db = userClient ?? admin;
      const r = resolveRange(a);
      const { data, error } = await db.rpc("get_treasury_dashboard", { p_from_date: r.from, p_to_date: r.to });
      if (error) return { error: error.message };
      if (data?.success === false) return { error: data.error };
      return { period: r.label, report: data };
    },
  },
  {
    name: "treasury_top_counterparties",
    permission: "canViewTreasury",
    needsAuth: true,
    description: "Top fournisseurs USDT ou acheteurs CNY par volume sur une période. type = 'usdt_supplier' | 'cny_buyer'. period = 'week' | 'month' | 'all' (défaut 'month').",
    input_schema: { type: "object", properties: { type: { type: "string", enum: ["usdt_supplier", "cny_buyer"] }, period: { type: "string", enum: ["week", "month", "all"] }, limit: { type: "number" } }, required: ["type"] },
    execute: async (admin, { type, period, limit }, userClient) => {
      const db = userClient ?? admin;
      const to = new Date();
      const from = new Date();
      if (period === "week") from.setDate(from.getDate() - 7);
      else if (period === "all") from.setFullYear(from.getFullYear() - 10);
      else from.setDate(from.getDate() - 30);
      const { data, error } = await db.rpc("get_top_counterparties", { p_type: type, p_from_date: from.toISOString(), p_to_date: to.toISOString(), p_limit: clamp(limit, 5, 20) });
      if (error) return { error: error.message };
      if (data?.success === false) return { error: data.error };
      return { type, period: period ?? "month", counterparties: data };
    },
  },
  {
    name: "treasury_list_counterparties",
    permission: "canViewTreasury",
    description: "Lister les contreparties de la trésorerie : fournisseurs USDT (type 'usdt_supplier') ou acheteurs CNY (type 'cny_buyer'). Donne nom, téléphone, WeChat, statut actif. Optionnel: query (filtre par nom), type.",
    input_schema: { type: "object", properties: { type: { type: "string", enum: ["usdt_supplier", "cny_buyer"] }, query: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, { type, query, limit }) => {
      let q = admin.from("treasury_counterparties")
        .select("short_id, display_name, legal_name, type, phone, wechat_id, is_active, notes, created_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(clamp(limit, 20, 100));
      if (type) q = q.eq("type", type);
      if (query) {
        const t = `%${String(query).replace(/[,():*%]/g, "")}%`;
        q = q.or(`display_name.ilike.${t},legal_name.ilike.${t},phone.ilike.${t},wechat_id.ilike.${t}`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, counterparties: data ?? [] };
    },
  },
  {
    name: "treasury_accounts_balances",
    permission: "canViewTreasury",
    description: "Soldes de TOUS les comptes de trésorerie (banque, mobile money, cash, crypto, Alipay, WeChat…) avec leur devise (XAF/USDT/CNY), le nombre d'écritures et la dernière activité.",
    input_schema: { type: "object", properties: { only_active: { type: "boolean" } } },
    execute: async (admin, { only_active }) => {
      let q = admin.from("treasury_account_balances").select("label, code, kind, currency, balance, entry_count, last_entry_at, is_active").order("sort_order", { ascending: true });
      if (only_active !== false) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) return { error: error.message };
      // Regroupe les totaux par devise pour un aperçu rapide
      const byCurrency: Record<string, number> = {};
      for (const a of data ?? []) byCurrency[a.currency] = (byCurrency[a.currency] ?? 0) + Number(a.balance ?? 0);
      return { count: data?.length ?? 0, totals_by_currency: byCurrency, accounts: data ?? [] };
    },
  },
  {
    name: "treasury_usdt_position",
    permission: "canViewTreasury",
    description: "Position USDT actuelle : stock en inventaire (get_usdt_stock) et coût moyen pondéré par USDT en XAF (get_wac_usdt). Pour savoir combien d'USDT on détient et à quel prix de revient.",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const now = new Date().toISOString();
      const { data: stock } = await admin.rpc("get_usdt_stock", { p_at: now });
      const { data: wac } = await admin.rpc("get_wac_usdt", { p_at: now });
      return { usdt_stock: Number(stock ?? 0), wac_xaf_per_usdt: Number(wac ?? 0), at: now };
    },
  },
  {
    name: "treasury_inventory_snapshots",
    permission: "canViewTreasury",
    description: "Derniers relevés d'inventaire de trésorerie (snapshots) : solde théorique vs réel, écart (variance) et raison. Pour suivre les contrôles d'inventaire.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin.from("treasury_inventory_snapshots")
        .select("account_id, theoretical_balance, actual_balance, variance, variance_reason, snapshot_at")
        .order("snapshot_at", { ascending: false }).limit(clamp(limit, 10, 30));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, snapshots: data ?? [] };
    },
  },
  {
    name: "treasury_ledger",
    permission: "canViewTreasury",
    description: "Grand livre de la trésorerie : dernières écritures comptables (achats/ventes USDT, ajustements, annulations) avec compte, devise, montant et date.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin.from("treasury_ledger_entries")
        .select("entry_kind, currency, amount, account_id, source_table, occurred_at")
        .order("occurred_at", { ascending: false }).limit(clamp(limit, 15, 50));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, entries: data ?? [] };
    },
  },
  {
    name: "query_database",
    permission: "canViewLogs",
    needsAuth: true, // l'RPC assistant_readonly_query vérifie is_admin(auth.uid()) → DOIT recevoir le client authentifié, pas le service-role (sinon auth.uid() = null → refus)
    description:
      "Outil PUISSANT de requête LIBRE en LECTURE SEULE. Écris une requête SQL SELECT (PostgreSQL) pour répondre à TOUTE question sur les données quand aucun autre outil ne convient — agrégations, regroupements, jointures, comptages par période, etc. UNIQUEMENT des SELECT (aucune modification possible, c'est bloqué côté serveur). Résultat limité à 1000 lignes.\n" +
      "Tables principales (colonnes utiles) :\n" +
      "- clients(user_id, first_name, last_name, phone, company_name, country, city, kyc_verified, status, created_at)\n" +
      "- wallets(user_id, balance_xaf, updated_at)\n" +
      "- deposits(reference, user_id, amount_xaf, confirmed_amount_xaf, method, status, bank_name, agency_name, created_at, validated_at)\n" +
      "- payments(reference, user_id, amount_xaf, amount_rmb, exchange_rate, method, status, beneficiary_name, created_at, processed_at)\n" +
      "- ledger_entries(user_id, entry_type, amount_xaf, balance_after, description, created_at)\n" +
      "- beneficiaries(client_id, alias, name, payment_method, phone, bank_name)\n" +
      "- daily_rates(rate_cash, rate_alipay, rate_wechat, rate_virement, is_active, effective_at)\n" +
      "- rate_adjustments(type, key, label, percentage)\n" +
      "- treasury_counterparties(id, short_id, type, display_name, phone, wechat_id, is_active)\n" +
      "- usdt_purchases(supplier_id, usdt_amount, xaf_amount, implicit_rate, occurred_at, voided_at)\n" +
      "- usdt_sales(buyer_id, usdt_amount, cny_amount, implicit_rate, occurred_at, voided_at)\n" +
      "- treasury_accounts(id, code, label, currency, kind), treasury_account_balances(label, code, currency, balance)\n" +
      "- treasury_ledger_entries(account_id, currency, amount, entry_kind, occurred_at)\n" +
      "- admin_audit_logs(admin_user_id, action_type, target_type, created_at)\n" +
      "Pour joindre un nom de client à une transaction : JOIN clients c ON c.user_id = d.user_id. Les montants sont en XAF (entiers). Pour un mois précis : WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'.",
    input_schema: { type: "object", properties: { sql: { type: "string", description: "Requête SELECT PostgreSQL (lecture seule)" } }, required: ["sql"] },
    execute: async (admin, { sql, __allowed_tables }, userClient) => {
      const db = userClient ?? admin; // l'RPC lit auth.uid() : on utilise le client authentifié (admin JWT)
      const { data, error } = await db.rpc("assistant_readonly_query", { p_sql: String(sql ?? ""), p_allowed_tables: __allowed_tables ?? null });
      if (error) return { error: error.message };
      if (data?.success === false) return { error: data.error };
      return { row_count: data?.row_count ?? 0, rows: data?.rows ?? [] };
    },
  },
  {
    name: "list_usdt_purchases",
    permission: "canViewTreasury",
    description: "Lister le DÉTAIL des achats USDT (chaque livraison : date, USDT, XAF payé, taux implicite). Optionnel: supplier (nom ou short_id F-00x pour un fournisseur précis, ex. Lizette), limit, include_voided.",
    input_schema: { type: "object", properties: { supplier: { type: "string" }, limit: { type: "number" }, include_voided: { type: "boolean" } } },
    execute: async (admin, { supplier, limit, include_voided }) => {
      let supplierId: string | null = null, supplierName: string | null = null;
      if (supplier) {
        const r = await resolveCounterparty(admin, supplier, "usdt_supplier");
        if (!r.ok) return { error: r.error };
        supplierId = r.id; supplierName = r.name;
      }
      let q = admin.from("usdt_purchases")
        .select("id, supplier_id, usdt_amount, xaf_amount, implicit_rate, channel, external_ref, occurred_at, voided_at")
        .order("occurred_at", { ascending: false }).limit(clamp(limit, 10, 50));
      if (supplierId) q = q.eq("supplier_id", supplierId);
      if (!include_voided) q = q.is("voided_at", null);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const ids = [...new Set((data ?? []).map((p: AnyClient) => p.supplier_id))];
      const { data: cps } = await admin.from("treasury_counterparties").select("id, short_id, display_name").in("id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const c of cps ?? []) byId[c.id] = c;
      const rows = (data ?? []).map((p: AnyClient) => ({
        id: p.id,
        fournisseur: byId[p.supplier_id] ? `${byId[p.supplier_id].short_id} ${byId[p.supplier_id].display_name}` : p.supplier_id,
        usdt: p.usdt_amount, xaf: p.xaf_amount, xaf_formatted: fmtXAF(p.xaf_amount),
        taux_implicite: p.implicit_rate, canal: p.channel, ref: p.external_ref, date: p.occurred_at, annule: p.voided_at ? true : undefined,
      }));
      return { supplier: supplierName, count: rows.length, purchases: rows };
    },
  },
  {
    name: "list_usdt_sales",
    permission: "canViewTreasury",
    description: "Lister le DÉTAIL des ventes USDT (chaque vente : date, USDT, CNY reçu, taux implicite, coût de revient). Optionnel: buyer (nom ou short_id de l'acheteur CNY), limit, include_voided.",
    input_schema: { type: "object", properties: { buyer: { type: "string" }, limit: { type: "number" }, include_voided: { type: "boolean" } } },
    execute: async (admin, { buyer, limit, include_voided }) => {
      let buyerId: string | null = null, buyerName: string | null = null;
      if (buyer) {
        const r = await resolveCounterparty(admin, buyer, "cny_buyer");
        if (!r.ok) return { error: r.error };
        buyerId = r.id; buyerName = r.name;
      }
      let q = admin.from("usdt_sales")
        .select("id, buyer_id, usdt_amount, cny_amount, implicit_rate, wac_at_sale, external_ref, occurred_at, voided_at")
        .order("occurred_at", { ascending: false }).limit(clamp(limit, 10, 50));
      if (buyerId) q = q.eq("buyer_id", buyerId);
      if (!include_voided) q = q.is("voided_at", null);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const ids = [...new Set((data ?? []).map((p: AnyClient) => p.buyer_id))];
      const { data: cps } = await admin.from("treasury_counterparties").select("id, short_id, display_name").in("id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const c of cps ?? []) byId[c.id] = c;
      const rows = (data ?? []).map((p: AnyClient) => ({
        id: p.id,
        acheteur: byId[p.buyer_id] ? `${byId[p.buyer_id].short_id} ${byId[p.buyer_id].display_name}` : p.buyer_id,
        usdt: p.usdt_amount, cny: p.cny_amount, taux_implicite: p.implicit_rate,
        cout_revient_usdt: p.wac_at_sale, ref: p.external_ref, date: p.occurred_at, annule: p.voided_at ? true : undefined,
      }));
      return { buyer: buyerName, count: rows.length, sales: rows };
    },
  },
  {
    name: "get_purchase_splits",
    permission: "canViewTreasury",
    description: "Détail de la répartition multi-comptes d'un achat USDT (quels comptes XAF ont payé, et combien chacun). Fournir purchase_id (UUID, depuis list_usdt_purchases).",
    input_schema: { type: "object", properties: { purchase_id: { type: "string" } }, required: ["purchase_id"] },
    execute: async (admin, { purchase_id }) => {
      if (!purchase_id) return { error: "purchase_id requis." };
      const { data, error } = await admin.from("treasury_ledger_entries")
        .select("account_id, amount, currency, occurred_at")
        .eq("source_table", "usdt_purchase").eq("source_id", purchase_id).eq("entry_kind", "usdt_purchase_debit_xaf");
      if (error) return { error: error.message };
      const ids = [...new Set((data ?? []).map((e: AnyClient) => e.account_id))];
      const { data: accs } = await admin.from("treasury_accounts").select("id, code, label").in("id", ids);
      // deno-lint-ignore no-explicit-any
      const byId: Record<string, any> = {};
      for (const ac of accs ?? []) byId[ac.id] = ac;
      const splits = (data ?? []).map((e: AnyClient) => ({ compte: byId[e.account_id] ? `${byId[e.account_id].code}/${byId[e.account_id].label}` : e.account_id, montant_xaf: Math.abs(Number(e.amount)), montant_formatted: fmtXAF(Math.abs(Number(e.amount))) }));
      return { count: splits.length, splits };
    },
  },
  {
    name: "list_treasury_accounts",
    permission: "canViewTreasury",
    description: "Lister les comptes de trésorerie configurés (code, libellé, devise, type/kind, actif). Pour connaître les comptes disponibles avant un achat/ajustement/inventaire.",
    input_schema: { type: "object", properties: { currency: { type: "string", enum: ["XAF", "USDT", "CNY"] } } },
    execute: async (admin, { currency }) => {
      let q = admin.from("treasury_accounts").select("code, label, currency, kind, is_active").order("sort_order", { ascending: true });
      if (currency) q = q.eq("currency", currency);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, accounts: data ?? [] };
    },
  },
];

// ════════════════════════ OUTILS D'ÉCRITURE (proposition → confirmation) ════════════════════════
interface Line { label: string; value: string; }
interface Proposal { title: string; subtitle?: string; amount?: string; lines: Line[]; confirmLabel: string; danger?: boolean; }
interface PrepareOk { ok: true; summary: Proposal; args: Record<string, unknown>; }
interface PrepareErr { ok: false; error: string; }

interface ExecCtx {
  admin: AnyClient;          // client service-role (pour copier les pièces jointes)
  adminUserId: string;       // l'admin qui confirme (uploaded_by)
}

interface WriteTool {
  name: string;
  permission: PermKey;
  /** Défense en profondeur : action réservée au super_admin (en plus de la garde DB). */
  superAdminOnly?: boolean;
  /** Réservé aux super_admin + liste blanche WALLET_ADMINS (ex. ajustement de wallet). */
  walletAdminsOnly?: boolean;
  /** Si vrai, les pièces jointes du message (captures/PDF) sont attachées comme preuve. */
  acceptsProof?: boolean;
  description: string;
  // deno-lint-ignore no-explicit-any
  input_schema: Record<string, any>;
  /** Valide les arguments + construit la carte de confirmation. Peut lire la base (admin/service) pour calculer un taux, vérifier un solde, etc. */
  // deno-lint-ignore no-explicit-any
  prepare: (admin: AnyClient, args: any) => Promise<PrepareOk | PrepareErr>;
  /** Exécute réellement, APRÈS confirmation. Utilise le client AUTHENTIFIÉ de l'admin (is_admin(auth.uid())). */
  // deno-lint-ignore no-explicit-any
  execute: (userClient: AnyClient, args: any, ctx: ExecCtx) => Promise<Record<string, unknown>>;
}

/**
 * Attache les pièces jointes du message (captures/PDF) comme PREUVES d'un dépôt :
 * copie depuis le bucket assistant-attachments vers deposit-proofs et insère la
 * ligne deposit_proofs (uploaded_by_type='admin'). Best-effort : n'échoue pas le dépôt.
 */
async function attachDepositProofs(
  svc: AnyClient,
  depositId: string,
  adminUserId: string,
  attachments: Array<{ path: string; mime: string; name: string }>,
): Promise<number> {
  let attached = 0;
  for (const att of attachments) {
    try {
      const { data: blob, error: dlErr } = await svc.storage.from(ATTACHMENT_BUCKET).download(att.path);
      if (dlErr || !blob) continue;
      const ext = (att.name.split(".").pop() || (att.mime === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
      const filePath = `admin/${depositId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await svc.storage.from("deposit-proofs").upload(filePath, blob, { contentType: att.mime, upsert: false });
      if (upErr) continue;
      const { error: insErr } = await svc.from("deposit_proofs").insert({
        deposit_id: depositId,
        file_url: `deposit-proofs/${filePath}`,
        file_name: att.name,
        file_type: att.mime,
        uploaded_by: adminUserId,
        uploaded_by_type: "admin",
        is_visible_to_client: true,
      });
      if (!insErr) attached++;
    } catch (_) { /* preuve best-effort */ }
  }
  return attached;
}

/**
 * Attache les pièces jointes du message comme PREUVES d'un paiement (QR code,
 * justificatif) : copie vers payment-proofs et insère dans payment_proofs.
 */
async function attachPaymentProofs(
  svc: AnyClient,
  paymentId: string,
  adminUserId: string,
  attachments: Array<{ path: string; mime: string; name: string }>,
): Promise<number> {
  let attached = 0;
  for (const att of attachments) {
    try {
      const { data: blob, error: dlErr } = await svc.storage.from(ATTACHMENT_BUCKET).download(att.path);
      if (dlErr || !blob) continue;
      const ext = (att.name.split(".").pop() || (att.mime === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
      const filePath = `admin/${paymentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await svc.storage.from("payment-proofs").upload(filePath, blob, { contentType: att.mime, upsert: false });
      if (upErr) continue;
      const { error: insErr } = await svc.from("payment_proofs").insert({
        payment_id: paymentId,
        uploaded_by: adminUserId,
        uploaded_by_type: "admin",
        file_name: att.name,
        file_url: `payment-proofs/${filePath}`,
        file_type: att.mime,
      });
      if (!insErr) attached++;
    } catch (_) { /* preuve best-effort */ }
  }
  return attached;
}

// payment_method (enum DB) → clé attendue par calculate_final_rate
const PAYMENT_METHOD_TO_RATE: Record<string, string> = { alipay: "alipay", wechat: "wechat", cash: "cash", bank_transfer: "virement" };
const PAYMENT_METHOD_LABEL: Record<string, string> = { alipay: "Alipay", wechat: "WeChat", cash: "Cash", bank_transfer: "Virement" };

function validIntAmount(v: unknown): number | null {
  // Vérif minimale anti-saisie cassée (pas une limite de montant) : entier positif.
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vérifie qu'un client_user_id est un VRAI UUID existant dans `clients`.
 * Empêche l'IA d'inventer un identifiant (ex. "user_cmr_jonas_002").
 * Renvoie le nom du client si trouvé, sinon un message qui pousse l'IA
 * à d'abord retrouver le client via search_clients.
 */
async function resolveClient(admin: AnyClient, rawId: unknown): Promise<{ ok: true; uid: string; name: string } | { ok: false; error: string }> {
  const id = String(rawId ?? "").trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, error: `client_user_id invalide ("${id}"). N'invente pas d'identifiant : utilise d'abord l'outil search_clients pour récupérer le vrai user_id (un UUID) du client.` };
  }
  const { data, error } = await admin.from("clients").select("first_name, last_name").eq("user_id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: `Aucun client avec ce user_id. Utilise search_clients pour trouver le bon client puis reprends avec son user_id réel.` };
  return { ok: true, uid: id, name: `${data.first_name} ${data.last_name}` };
}

/** Résout une contrepartie trésorerie (fournisseur USDT / acheteur CNY) par nom, short_id (F-00x) ou UUID. */
async function resolveCounterparty(admin: AnyClient, raw: unknown, type: "usdt_supplier" | "cny_buyer"): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const q = String(raw ?? "").trim();
  if (!q) return { ok: false, error: "Fournisseur/acheteur manquant." };
  if (UUID_RE.test(q)) {
    const { data } = await admin.from("treasury_counterparties").select("id, display_name, type").eq("id", q).maybeSingle();
    if (data) return { ok: true, id: data.id, name: data.display_name };
  }
  const term = `%${q.replace(/[,():*%]/g, "")}%`;
  const { data, error } = await admin.from("treasury_counterparties")
    .select("id, display_name, short_id, type, is_active")
    .eq("type", type).is("archived_at", null)
    .or(`display_name.ilike.${term},short_id.ilike.${term},legal_name.ilike.${term}`)
    .limit(8);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: `Aucun ${type === "usdt_supplier" ? "fournisseur USDT" : "acheteur CNY"} trouvé pour "${q}". Utilise treasury_list_counterparties pour voir la liste.` };
  if (data.length > 1) return { ok: false, error: `Plusieurs correspondances pour "${q}" : ${data.map((c: AnyClient) => `${c.short_id} ${c.display_name}`).join(", ")}. Précise lequel (short_id).` };
  return { ok: true, id: data[0].id, name: `${data[0].short_id} ${data[0].display_name}` };
}

/** Résout un compte de trésorerie par nom, code ou UUID. currency optionnel pour filtrer. */
async function resolveTreasuryAccount(admin: AnyClient, raw: unknown, currency: string | null): Promise<{ ok: true; id: string; label: string; currency: string | null } | { ok: false; error: string }> {
  const q = String(raw ?? "").trim();
  if (!q) return { ok: false, error: "Compte manquant (xaf_account/account). Utilise treasury_accounts_balances pour voir les comptes." };
  // deno-lint-ignore no-explicit-any
  let query: any = admin.from("treasury_accounts").select("id, code, label, currency, is_active").eq("is_active", true);
  if (currency) query = query.eq("currency", currency);
  if (UUID_RE.test(q)) query = query.eq("id", q);
  else {
    const term = `%${q.replace(/[,():*%]/g, "")}%`;
    query = query.or(`label.ilike.${term},code.ilike.${term}`);
  }
  const { data, error } = await query.limit(8);
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: `Aucun compte ${currency ?? ""} trouvé pour "${q}". Utilise treasury_accounts_balances pour voir les comptes.` };
  if (data.length > 1) return { ok: false, error: `Plusieurs comptes pour "${q}" : ${data.map((c: AnyClient) => `${c.code}/${c.label}`).join(", ")}. Précise le code.` };
  return { ok: true, id: data[0].id, label: `${data[0].label} (${data[0].code})`, currency: data[0].currency };
}


/** Résout une RÉFÉRENCE (BZ-DP-…, BZ-…, ou nom de client) ou un UUID → UUID de la cible.
 *  Utilisé par le gateway générique do_capability (capacités auto-découvertes). */
async function resolveRef(admin: AnyClient, type: string, value: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const v = String(value ?? "").trim();
  if (!v) return { ok: false, error: "Référence manquante." };
  if (UUID_RE.test(v)) return { ok: true, id: v };
  if (type === "deposit") {
    const { data } = await admin.from("deposits").select("id").eq("reference", v).maybeSingle();
    return data ? { ok: true, id: data.id } : { ok: false, error: `Dépôt « ${v} » introuvable.` };
  }
  if (type === "payment") {
    const { data } = await admin.from("payments").select("id").eq("reference", v).maybeSingle();
    return data ? { ok: true, id: data.id } : { ok: false, error: `Paiement « ${v} » introuvable.` };
  }
  if (type === "client") {
    const clients = await findClientsByName(admin, v, 5);
    if (clients.length === 0) return { ok: false, error: `Client « ${v} » introuvable.` };
    if (clients.length > 1) return { ok: false, error: `Plusieurs clients « ${v} » : ${clients.map((c: AnyClient) => `${c.first_name} ${c.last_name}`).join(", ")}. Précise.` };
    return { ok: true, id: clients[0].user_id };
  }
  // ── Centrale d'achat (références BZ-MS / BZ-PO / BZ-SP, ou nom de fournisseur) ──
  if (type === "mission") {
    const { data } = await admin.from("proc_missions").select("id").eq("reference", v).maybeSingle();
    return data ? { ok: true, id: data.id } : { ok: false, error: `Mission « ${v} » introuvable.` };
  }
  if (type === "purchase_order") {
    const { data } = await admin.from("proc_purchase_orders").select("id").eq("reference", v).maybeSingle();
    return data ? { ok: true, id: data.id } : { ok: false, error: `Commande « ${v} » introuvable.` };
  }
  if (type === "supplier_payment") {
    const { data } = await admin.from("proc_supplier_payments").select("id").eq("reference", v).maybeSingle();
    return data ? { ok: true, id: data.id } : { ok: false, error: `Paiement fournisseur « ${v} » introuvable.` };
  }
  if (type === "supplier") {
    const { data } = await admin.from("proc_suppliers").select("id, display_name").ilike("display_name", `%${v}%`).eq("is_active", true).limit(5);
    const rows = (data ?? []) as AnyClient[];
    if (rows.length === 0) return { ok: false, error: `Fournisseur « ${v} » introuvable.` };
    if (rows.length > 1) return { ok: false, error: `Plusieurs fournisseurs « ${v} » : ${rows.map((r: AnyClient) => r.display_name).join(", ")}. Précise.` };
    return { ok: true, id: rows[0].id };
  }
  return { ok: false, error: `Type de référence inconnu : ${type}.` };
}

const WRITE_TOOLS: WriteTool[] = [
  {
    name: "create_client",
    permission: "canEditClients",
    description: "Créer un nouveau compte client (et son wallet à 0). Requiert prénom, nom, téléphone. Optionnels: email, pays (défaut Cameroun), ville, entreprise, genre (MALE/FEMALE/OTHER).",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" }, last_name: { type: "string" }, phone: { type: "string" },
        email: { type: "string" }, country: { type: "string" }, city: { type: "string" },
        company: { type: "string" }, gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
      },
      required: ["first_name", "last_name", "phone"],
    },
    prepare: (_admin, a) => {
      if (!a.first_name || !a.last_name || !a.phone) return Promise.resolve({ ok: false, error: "Prénom, nom et téléphone sont obligatoires." });
      const args = {
        p_first_name: String(a.first_name).trim(), p_last_name: String(a.last_name).trim(), p_phone: String(a.phone).trim(),
        p_email: a.email ? String(a.email).trim() : null, p_gender: a.gender || "OTHER",
        p_country: a.country || "Cameroun", p_city: a.city || "", p_company: a.company || "",
      };
      const lines: Line[] = [
        { label: "Nom", value: `${args.p_first_name} ${args.p_last_name}` },
        { label: "Téléphone", value: args.p_phone },
        { label: "Pays", value: args.p_country },
      ];
      if (args.p_email) lines.push({ label: "Email", value: args.p_email });
      if (args.p_company) lines.push({ label: "Entreprise", value: String(args.p_company) });
      return Promise.resolve({ ok: true, args, summary: { title: "Créer un client", subtitle: `${args.p_first_name} ${args.p_last_name}`, lines, confirmLabel: "Créer le client" } });
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("admin_create_client", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "update_client",
    permission: "canEditClients",
    description: "Modifier les informations d'un client existant (par client_user_id). Champs modifiables: first_name, last_name, phone, email, company_name, country, city, kyc_verified (bool), notes, status.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" },
        first_name: { type: "string" }, last_name: { type: "string" }, phone: { type: "string" },
        email: { type: "string" }, company_name: { type: "string" }, country: { type: "string" },
        city: { type: "string" }, kyc_verified: { type: "boolean" }, notes: { type: "string" }, status: { type: "string" },
      },
      required: ["client_user_id"],
    },
    prepare: async (admin, a) => {
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      const editable = ["first_name", "last_name", "phone", "email", "company_name", "country", "city", "kyc_verified", "notes", "status"];
      const fields: Record<string, unknown> = {};
      const lines: Line[] = [{ label: "Client", value: c.name }];
      for (const k of editable) {
        if (a[k] !== undefined && a[k] !== null) { fields[k] = a[k]; lines.push({ label: k, value: String(a[k]) }); }
      }
      if (Object.keys(fields).length === 0) return { ok: false, error: "Aucun champ à modifier fourni." };
      return { ok: true, args: { client_user_id: c.uid, fields }, summary: { title: "Modifier un client", subtitle: c.name, lines, confirmLabel: "Enregistrer les modifications" } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.from("clients").update(args.fields).eq("user_id", args.client_user_id).select("id");
      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) return { success: false, error: "Aucune ligne modifiée (client introuvable ou accès refusé)." };
      return { success: true };
    },
  },
  {
    name: "create_deposit",
    permission: "canProcessDeposits",
    acceptsProof: true,
    description: "Créer un dépôt EN ATTENTE pour un client (statut 'created', SANS créditer le wallet — utile si la preuve viendra plus tard). Si l'admin a joint une capture, elle est attachée comme preuve. method ∈ bank_transfer, bank_cash, agency_cash, om_transfer, om_withdrawal, mtn_transfer, mtn_withdrawal, wave.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" }, amount_xaf: { type: "number" }, method: { type: "string" },
        bank_name: { type: "string" }, agency_name: { type: "string" }, client_phone: { type: "string" },
      },
      required: ["client_user_id", "amount_xaf", "method"],
    },
    prepare: async (admin, a) => {
      const amt = validIntAmount(a.amount_xaf);
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      if (!amt) return { ok: false, error: "Montant invalide." };
      const args = { p_user_id: c.uid, p_amount_xaf: amt, p_method: a.method, p_bank_name: a.bank_name || null, p_agency_name: a.agency_name || null, p_client_phone: a.client_phone || null };
      const lines: Line[] = [{ label: "Client", value: c.name }, { label: "Moyen", value: String(a.method) }];
      if (a.bank_name) lines.push({ label: "Banque", value: String(a.bank_name) });
      if (a.agency_name) lines.push({ label: "Agence", value: String(a.agency_name) });
      lines.push({ label: "Wallet", value: "non crédité (en attente)" });
      return { ok: true, args, summary: { title: "Créer un dépôt (en attente)", subtitle: c.name, amount: fmtXAF(amt), lines, confirmLabel: "Créer le dépôt" } };
    },
    execute: async (userClient, args, ctx) => {
      const { data, error } = await userClient.rpc("create_client_deposit", args);
      if (error) return { success: false, error: error.message };
      const depId = data?.deposit_id;
      const proofs = depId && args.proofAttachments?.length ? await attachDepositProofs(ctx.admin, depId, ctx.adminUserId, args.proofAttachments) : 0;
      return { ...data, proofs_attached: proofs };
    },
  },
  {
    name: "create_and_validate_deposit",
    permission: "canProcessDeposits",
    acceptsProof: true,
    description: "Créer un dépôt ET le valider immédiatement → CRÉDITE le wallet du client. C'est l'action typique quand l'argent a déjà été reçu. Si l'admin a joint une capture/reçu, elle est AUTOMATIQUEMENT attachée comme preuve du dépôt — pas besoin de la remettre après. method ∈ bank_transfer, bank_cash, agency_cash, om_transfer, om_withdrawal, mtn_transfer, mtn_withdrawal, wave.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" }, amount_xaf: { type: "number" }, method: { type: "string" },
        bank_name: { type: "string" }, agency_name: { type: "string" }, client_phone: { type: "string" }, comment: { type: "string" },
      },
      required: ["client_user_id", "amount_xaf", "method"],
    },
    prepare: async (admin, a) => {
      const amt = validIntAmount(a.amount_xaf);
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      if (!amt) return { ok: false, error: "Montant invalide." };
      const args = { create: { p_user_id: c.uid, p_amount_xaf: amt, p_method: a.method, p_bank_name: a.bank_name || null, p_agency_name: a.agency_name || null, p_client_phone: a.client_phone || null }, comment: a.comment || null, amount: amt };
      const lines: Line[] = [{ label: "Client", value: c.name }, { label: "Moyen", value: String(a.method) }, { label: "Effet", value: "✅ crédite le wallet du client" }];
      return { ok: true, args, summary: { title: "Créer & valider un dépôt", subtitle: c.name, amount: fmtXAF(amt), lines, confirmLabel: "Confirmer & créditer" } };
    },
    execute: async (userClient, args, ctx) => {
      const r1 = await userClient.rpc("create_client_deposit", args.create);
      if (r1.error) return { success: false, error: r1.error.message };
      const depId = r1.data?.deposit_id;
      if (!depId) return { success: false, error: "Échec de création du dépôt." };
      const r2 = await userClient.rpc("validate_deposit", { p_deposit_id: depId, p_admin_comment: args.comment, p_confirmed_amount: args.amount, p_send_notification: true });
      if (r2.error) return { success: false, error: `Dépôt créé mais validation échouée: ${r2.error.message}` };
      // Attache automatiquement les captures jointes comme preuve
      const proofs = args.proofAttachments?.length ? await attachDepositProofs(ctx.admin, depId, ctx.adminUserId, args.proofAttachments) : 0;
      return { ...r2.data, deposit_id: depId, proofs_attached: proofs };
    },
  },
  {
    name: "validate_deposit",
    permission: "canProcessDeposits",
    acceptsProof: true,
    description: "Valider un dépôt EXISTANT (par référence BZ-DP-... ou deposit_id) → crédite le wallet. Si l'admin a joint une capture, elle est attachée comme preuve. Optionnel: confirmed_amount (si le montant réel diffère), comment.",
    input_schema: { type: "object", properties: { reference: { type: "string" }, deposit_id: { type: "string" }, confirmed_amount: { type: "number" }, comment: { type: "string" } } },
    prepare: async (admin, a) => {
      let q = admin.from("deposits").select("id, reference, amount_xaf, status, user_id");
      if (a.deposit_id) q = q.eq("id", a.deposit_id);
      else if (a.reference) q = q.eq("reference", a.reference);
      else return { ok: false, error: "Fournir reference ou deposit_id." };
      const { data: dep } = await q.maybeSingle();
      if (!dep) return { ok: false, error: "Dépôt introuvable." };
      const confirmed = a.confirmed_amount != null ? validIntAmount(a.confirmed_amount) : Number(dep.amount_xaf);
      if (confirmed == null) return { ok: false, error: "Montant confirmé invalide." };
      const lines: Line[] = [{ label: "Référence", value: dep.reference }, { label: "Statut actuel", value: dep.status }, { label: "Effet", value: "✅ crédite le wallet" }];
      return { ok: true, args: { p_deposit_id: dep.id, p_admin_comment: a.comment || null, p_confirmed_amount: confirmed, p_send_notification: true }, summary: { title: "Valider un dépôt", amount: fmtXAF(confirmed), lines, confirmLabel: "Confirmer & créditer" } };
    },
    execute: async (userClient, args, ctx) => {
      const { data, error } = await userClient.rpc("validate_deposit", args);
      if (error) return { success: false, error: error.message };
      const proofs = args.proofAttachments?.length ? await attachDepositProofs(ctx.admin, args.p_deposit_id, ctx.adminUserId, args.proofAttachments) : 0;
      return { ...data, proofs_attached: proofs };
    },
  },
  {
    name: "reject_deposit",
    permission: "canProcessDeposits",
    description: "Rejeter un dépôt (par référence ou deposit_id) avec un motif. Ne touche pas au wallet.",
    input_schema: { type: "object", properties: { reference: { type: "string" }, deposit_id: { type: "string" }, reason: { type: "string" } }, required: ["reason"] },
    prepare: async (admin, a) => {
      if (!a.reason) return { ok: false, error: "Motif requis." };
      let q = admin.from("deposits").select("id, reference, status");
      if (a.deposit_id) q = q.eq("id", a.deposit_id);
      else if (a.reference) q = q.eq("reference", a.reference);
      else return { ok: false, error: "Fournir reference ou deposit_id." };
      const { data: dep } = await q.maybeSingle();
      if (!dep) return { ok: false, error: "Dépôt introuvable." };
      return { ok: true, args: { p_deposit_id: dep.id, p_reason: a.reason }, summary: { title: "Rejeter un dépôt", subtitle: dep.reference, lines: [{ label: "Motif", value: a.reason }], confirmLabel: "Rejeter le dépôt", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("reject_deposit", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "create_payment",
    permission: "canProcessPayments",
    acceptsProof: true,
    description: "Créer un paiement fournisseur pour un client → DÉBITE son wallet (au taux du jour, OU à un taux personnalisé si l'admin le demande). Si l'admin a joint une capture (QR code, justificatif), elle est attachée comme preuve du paiement. Fournir client_user_id, amount_xaf, method (alipay|wechat|bank_transfer|cash). Optionnels: country_key (défaut cameroun), beneficiary_name, beneficiary_phone, beneficiary_bank_name, beneficiary_bank_account, beneficiary_qr_code_url, et exchange_rate (taux personnalisé en CNY ¥ pour 1 000 000 XAF — la plateforme l'autorise, comme l'écran de paiement admin). Sans exchange_rate, le montant RMB est calculé automatiquement au taux du jour ; avec, il utilise le taux fourni.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" }, amount_xaf: { type: "number" }, method: { type: "string", enum: ["alipay", "wechat", "bank_transfer", "cash"] },
        exchange_rate: { type: "number", description: "Taux personnalisé optionnel (CNY ¥ pour 1 000 000 XAF). Si fourni, remplace le taux du jour." },
        country_key: { type: "string" }, beneficiary_name: { type: "string" }, beneficiary_phone: { type: "string" },
        beneficiary_bank_name: { type: "string" }, beneficiary_bank_account: { type: "string" }, beneficiary_qr_code_url: { type: "string" },
      },
      required: ["client_user_id", "amount_xaf", "method"],
    },
    prepare: async (admin, a) => {
      const amt = validIntAmount(a.amount_xaf);
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      if (!amt) return { ok: false, error: "Montant invalide." };
      if (amt < MIN_PAYMENT_XAF) return { ok: false, error: `Montant minimum ${fmtXAF(MIN_PAYMENT_XAF)}.` };
      const rateMethod = PAYMENT_METHOD_TO_RATE[a.method];
      if (!rateMethod) return { ok: false, error: "Méthode de paiement invalide." };
      const countryKey = (a.country_key || "cameroun").toLowerCase();
      // Vérifier le solde du client
      const { data: wallet } = await admin.from("wallets").select("balance_xaf").eq("user_id", c.uid).maybeSingle();
      if (!wallet) return { ok: false, error: "Wallet du client introuvable." };
      if (Number(wallet.balance_xaf) < amt) return { ok: false, error: `Solde insuffisant (${fmtXAF(wallet.balance_xaf)} disponible).` };
      // Taux : personnalisé si l'admin le fournit (parité avec l'écran admin MobileNewPayment),
      // sinon taux du jour calculé côté base (jamais inventé par l'IA).
      let amountRmb: number;
      let exchangeRate: number;
      let rateIsCustom = false;
      const customRate = a.exchange_rate != null ? Number(a.exchange_rate) : null;
      if (customRate != null && Number.isFinite(customRate) && customRate > 0) {
        // exchange_rate = CNY (¥) pour 1 000 000 XAF (même unité que rate.final_rate)
        exchangeRate = customRate;
        amountRmb = Math.round((amt * customRate) / 1_000_000);
        rateIsCustom = true;
      } else {
        const { data: rate, error: rErr } = await admin.rpc("calculate_final_rate", { p_payment_method: rateMethod, p_country_key: countryKey, p_amount_xaf: amt });
        if (rErr) return { ok: false, error: `Calcul du taux: ${rErr.message}` };
        if (!rate?.success) return { ok: false, error: rate?.error || "Taux indisponible." };
        amountRmb = Number(rate.amount_cny);
        exchangeRate = Number(rate.final_rate);
      }
      const args = {
        p_user_id: c.uid, p_amount_xaf: amt, p_amount_rmb: amountRmb, p_exchange_rate: exchangeRate, p_rate_is_custom: rateIsCustom, p_method: a.method,
        p_beneficiary_name: a.beneficiary_name || null, p_beneficiary_phone: a.beneficiary_phone || null,
        p_beneficiary_bank_name: a.beneficiary_bank_name || null, p_beneficiary_bank_account: a.beneficiary_bank_account || null,
        p_beneficiary_qr_code_url: a.beneficiary_qr_code_url || null,
      };
      const lines: Line[] = [
        { label: "Client", value: c.name },
        { label: "Mode", value: PAYMENT_METHOD_LABEL[a.method] || a.method },
        { label: "Taux", value: rateIsCustom ? `¥ ${exchangeRate} / 1M XAF (personnalisé)` : `¥ ${exchangeRate} / 1M XAF (taux du jour)` },
        { label: "Montant fournisseur", value: `≈ ¥ ${amountRmb.toLocaleString("fr-FR")}` },
        { label: "Solde après", value: fmtXAF(Number(wallet.balance_xaf) - amt) },
      ];
      if (a.beneficiary_name) lines.push({ label: "Bénéficiaire", value: String(a.beneficiary_name) });
      lines.push({ label: "Effet", value: "⚠️ débite le wallet du client" });
      return { ok: true, args, summary: { title: "Créer un paiement fournisseur", subtitle: c.name, amount: fmtXAF(amt), lines, confirmLabel: "Confirmer le paiement" } };
    },
    execute: async (userClient, args, ctx) => {
      const { data, error } = await userClient.rpc("create_admin_payment", args);
      if (error) return { success: false, error: error.message };
      const payId = data?.payment_id;
      const proofs = payId && args.proofAttachments?.length ? await attachPaymentProofs(ctx.admin, payId, ctx.adminUserId, args.proofAttachments) : 0;
      return { ...data, proofs_attached: proofs };
    },
  },
  {
    name: "update_payment_beneficiary",
    permission: "canProcessPayments",
    acceptsProof: true,
    description: "Compléter/corriger les infos bénéficiaire d'un paiement non finalisé (par référence ou payment_id) : nom, téléphone, email, identifiant (+ type), banque, compte, complément bancaire, QR code, notes. Si l'admin a joint une capture, elle est attachée comme preuve. Fait passer un paiement 'en attente d'infos' à 'prêt'.",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string" }, payment_id: { type: "string" },
        beneficiary_name: { type: "string" }, beneficiary_phone: { type: "string" }, beneficiary_email: { type: "string" },
        beneficiary_identifier: { type: "string" }, beneficiary_identifier_type: { type: "string" },
        beneficiary_bank_name: { type: "string" }, beneficiary_bank_account: { type: "string" }, beneficiary_bank_extra: { type: "string" },
        beneficiary_qr_code_url: { type: "string" }, beneficiary_notes: { type: "string" },
      },
    },
    prepare: async (admin, a) => {
      let q = admin.from("payments").select("id, reference, status");
      if (a.payment_id) q = q.eq("id", a.payment_id);
      else if (a.reference) q = q.eq("reference", a.reference);
      else return { ok: false, error: "Fournir reference ou payment_id." };
      const { data: pay } = await q.maybeSingle();
      if (!pay) return { ok: false, error: "Paiement introuvable." };
      const lines: Line[] = [{ label: "Paiement", value: pay.reference }];
      if (a.beneficiary_name) lines.push({ label: "Bénéficiaire", value: String(a.beneficiary_name) });
      if (a.beneficiary_bank_name) lines.push({ label: "Banque", value: String(a.beneficiary_bank_name) });
      if (a.beneficiary_qr_code_url) lines.push({ label: "QR code", value: "fourni" });
      return { ok: true, args: { p_payment_id: pay.id, p_beneficiary_name: a.beneficiary_name || null, p_beneficiary_phone: a.beneficiary_phone || null, p_beneficiary_email: a.beneficiary_email || null, p_beneficiary_identifier: a.beneficiary_identifier || null, p_beneficiary_identifier_type: a.beneficiary_identifier_type || null, p_beneficiary_bank_name: a.beneficiary_bank_name || null, p_beneficiary_bank_account: a.beneficiary_bank_account || null, p_beneficiary_bank_extra: a.beneficiary_bank_extra || null, p_beneficiary_qr_code_url: a.beneficiary_qr_code_url || null, p_beneficiary_notes: a.beneficiary_notes || null }, summary: { title: "Compléter le bénéficiaire", subtitle: pay.reference, lines, confirmLabel: "Enregistrer" } };
    },
    execute: async (userClient, args, ctx) => {
      const { data, error } = await userClient.rpc("admin_update_payment_beneficiary", args);
      if (error) return { success: false, error: error.message };
      const proofs = args.proofAttachments?.length ? await attachPaymentProofs(ctx.admin, args.p_payment_id, ctx.adminUserId, args.proofAttachments) : 0;
      return { ...data, proofs_attached: proofs };
    },
  },
  {
    name: "cancel_payment",
    permission: "canProcessPayments",
    superAdminOnly: true,
    description: "Annuler un paiement non finalisé (par référence ou payment_id) → REMBOURSE le wallet du client. Réservé au super_admin (vérifié côté serveur).",
    input_schema: { type: "object", properties: { reference: { type: "string" }, payment_id: { type: "string" } } },
    prepare: async (admin, a) => {
      let q = admin.from("payments").select("id, reference, amount_xaf, status");
      if (a.payment_id) q = q.eq("id", a.payment_id);
      else if (a.reference) q = q.eq("reference", a.reference);
      else return { ok: false, error: "Fournir reference ou payment_id." };
      const { data: pay } = await q.maybeSingle();
      if (!pay) return { ok: false, error: "Paiement introuvable." };
      return { ok: true, args: { p_payment_id: pay.id }, summary: { title: "Annuler un paiement", subtitle: pay.reference, amount: fmtXAF(pay.amount_xaf), lines: [{ label: "Statut", value: pay.status }, { label: "Effet", value: "↩️ rembourse le wallet" }], confirmLabel: "Annuler & rembourser", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("cancel_payment", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "set_daily_rate",
    permission: "canManageRates",
    description: "Définir le taux du jour (en CNY ¥ pour 1 000 000 XAF), par mode. Désactive l'ancien taux. ⚠️ S'applique à TOUS les nouveaux paiements. Requiert les 4 taux: rate_cash, rate_alipay, rate_wechat, rate_virement.",
    input_schema: { type: "object", properties: { rate_cash: { type: "number" }, rate_alipay: { type: "number" }, rate_wechat: { type: "number" }, rate_virement: { type: "number" } }, required: ["rate_cash", "rate_alipay", "rate_wechat", "rate_virement"] },
    prepare: (_admin, a) => {
      const keys = ["rate_cash", "rate_alipay", "rate_wechat", "rate_virement"];
      for (const k of keys) { if (!(Number(a[k]) > 0)) return Promise.resolve({ ok: false, error: `Taux ${k} invalide.` }); }
      return Promise.resolve({
        ok: true,
        args: { p_rate_cash: Number(a.rate_cash), p_rate_alipay: Number(a.rate_alipay), p_rate_wechat: Number(a.rate_wechat), p_rate_virement: Number(a.rate_virement) },
        summary: { title: "Définir le taux du jour", subtitle: "⚠️ s'applique à tous les nouveaux paiements", lines: [
          { label: "Cash", value: `¥ ${a.rate_cash}` }, { label: "Alipay", value: `¥ ${a.rate_alipay}` },
          { label: "WeChat", value: `¥ ${a.rate_wechat}` }, { label: "Virement", value: `¥ ${a.rate_virement}` },
        ], confirmLabel: "Publier le taux", danger: true },
      });
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("create_daily_rates", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "adjust_wallet",
    permission: "canProcessDeposits",
    walletAdminsOnly: true,
    description: "Créditer ou débiter MANUELLEMENT le wallet d'un client, avec un motif obligatoire. type = 'credit' (ajoute) ou 'debit' (retire, refusé si solde insuffisant). Action réservée (super_admin + liste autorisée). À utiliser pour corriger/ajuster un solde.",
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string" }, type: { type: "string", enum: ["credit", "debit"] }, amount_xaf: { type: "number" }, reason: { type: "string" } },
      required: ["client_user_id", "type", "amount_xaf", "reason"],
    },
    prepare: async (admin, a) => {
      const amt = validIntAmount(a.amount_xaf);
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      if (!amt) return { ok: false, error: "Montant invalide." };
      if (a.type !== "credit" && a.type !== "debit") return { ok: false, error: "type doit être 'credit' ou 'debit'." };
      if (!a.reason || String(a.reason).trim().length < 3) return { ok: false, error: "Motif obligatoire." };
      const { data: wallet } = await admin.from("wallets").select("balance_xaf").eq("user_id", c.uid).maybeSingle();
      if (!wallet) return { ok: false, error: "Wallet du client introuvable." };
      if (a.type === "debit" && Number(wallet.balance_xaf) < amt) return { ok: false, error: `Solde insuffisant (${fmtXAF(wallet.balance_xaf)} disponible).` };
      const after = a.type === "credit" ? Number(wallet.balance_xaf) + amt : Number(wallet.balance_xaf) - amt;
      const lines: Line[] = [
        { label: "Client", value: c.name },
        { label: "Type", value: a.type === "credit" ? "Crédit (ajout)" : "Débit (retrait)" },
        { label: "Solde actuel", value: fmtXAF(wallet.balance_xaf) },
        { label: "Solde après", value: fmtXAF(after) },
        { label: "Motif", value: String(a.reason) },
      ];
      return { ok: true, args: { p_user_id: c.uid, p_amount: amt, p_adjustment_type: a.type, p_reason: String(a.reason) }, summary: { title: a.type === "credit" ? "Créditer un wallet" : "Débiter un wallet", subtitle: c.name, amount: fmtXAF(amt), lines, confirmLabel: a.type === "credit" ? "Confirmer le crédit" : "Confirmer le débit", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("admin_adjust_wallet", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "record_usdt_purchase",
    permission: "canViewTreasury",
    description: "Enregistrer un ACHAT d'USDT auprès d'un fournisseur (trésorerie). Débite le(s) compte(s) XAF et crédite le pool USDT. Fournir supplier (nom ou short_id F-00x), usdt_amount, et soit xaf_amount + xaf_account (nom/code du compte qui a payé), soit account_splits pour répartir sur plusieurs comptes. Optionnels: occurred_at, external_ref, notes.",
    input_schema: {
      type: "object",
      properties: {
        supplier: { type: "string", description: "Nom ou short_id (F-00x) du fournisseur USDT" },
        usdt_amount: { type: "number" },
        xaf_amount: { type: "number", description: "Montant XAF payé (si un seul compte)" },
        xaf_account: { type: "string", description: "Nom ou code du compte XAF qui a payé" },
        external_ref: { type: "string" }, notes: { type: "string" },
      },
      required: ["supplier", "usdt_amount"],
    },
    prepare: async (admin, a) => {
      const sup = await resolveCounterparty(admin, a.supplier, "usdt_supplier");
      if (!sup.ok) return { ok: false, error: sup.error };
      const usdt = Number(a.usdt_amount);
      if (!(usdt > 0)) return { ok: false, error: "Quantité USDT invalide." };
      const xaf = Number(a.xaf_amount);
      if (!(xaf > 0)) return { ok: false, error: "Montant XAF payé manquant ou invalide (xaf_amount)." };
      const acc = await resolveTreasuryAccount(admin, a.xaf_account, "XAF");
      if (!acc.ok) return { ok: false, error: acc.error };
      const splits = [{ account_id: acc.id, xaf_amount: Math.round(xaf) }];
      const implied = (xaf / usdt).toFixed(2);
      const lines: Line[] = [
        { label: "Fournisseur", value: sup.name },
        { label: "USDT acheté", value: `${usdt} USDT` },
        { label: "Payé", value: `${fmtXAF(xaf)} (${acc.label})` },
        { label: "Taux implicite", value: `${implied} XAF/USDT` },
      ];
      if (a.notes) lines.push({ label: "Notes", value: String(a.notes) });
      return { ok: true, args: { p_supplier_id: sup.id, p_usdt_amount: usdt, p_account_splits: splits, p_external_ref: a.external_ref || null, p_notes: a.notes || null }, summary: { title: "Enregistrer un achat USDT", subtitle: sup.name, amount: `${usdt} USDT`, lines, confirmLabel: "Confirmer l'achat", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("record_usdt_purchase", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "record_usdt_sale",
    permission: "canViewTreasury",
    description: "Enregistrer une VENTE d'USDT à un acheteur CNY (trésorerie). Débite le pool USDT et crédite éventuellement un compte CNY. Fournir buyer (nom ou short_id), usdt_amount, cny_amount. Optionnels: cny_account (nom/code), external_ref, notes.",
    input_schema: {
      type: "object",
      properties: {
        buyer: { type: "string" }, usdt_amount: { type: "number" }, cny_amount: { type: "number" },
        cny_account: { type: "string" }, external_ref: { type: "string" }, notes: { type: "string" },
      },
      required: ["buyer", "usdt_amount", "cny_amount"],
    },
    prepare: async (admin, a) => {
      const buyer = await resolveCounterparty(admin, a.buyer, "cny_buyer");
      if (!buyer.ok) return { ok: false, error: buyer.error };
      const usdt = Number(a.usdt_amount), cny = Number(a.cny_amount);
      if (!(usdt > 0)) return { ok: false, error: "Quantité USDT invalide." };
      if (!(cny > 0)) return { ok: false, error: "Montant CNY invalide." };
      let cnyAccountId: string | null = null, cnyAccLabel = "non précisé";
      if (a.cny_account) {
        const acc = await resolveTreasuryAccount(admin, a.cny_account, "CNY");
        if (!acc.ok) return { ok: false, error: acc.error };
        cnyAccountId = acc.id; cnyAccLabel = acc.label;
      }
      const lines: Line[] = [
        { label: "Acheteur", value: buyer.name },
        { label: "USDT vendu", value: `${usdt} USDT` },
        { label: "Reçu", value: `¥ ${cny.toLocaleString("fr-FR")} (${cnyAccLabel})` },
        { label: "Taux implicite", value: `${(cny / usdt).toFixed(3)} CNY/USDT` },
      ];
      return { ok: true, args: { p_buyer_id: buyer.id, p_usdt_amount: usdt, p_cny_amount: cny, p_cny_account_id: cnyAccountId, p_external_ref: a.external_ref || null, p_notes: a.notes || null }, summary: { title: "Enregistrer une vente USDT", subtitle: buyer.name, amount: `${usdt} USDT`, lines, confirmLabel: "Confirmer la vente", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("record_usdt_sale", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "create_treasury_counterparty",
    permission: "canViewTreasury",
    description: "Créer un fournisseur USDT (type 'usdt_supplier') ou un acheteur CNY (type 'cny_buyer') dans la trésorerie. Fournir type et display_name. Optionnels: legal_name, phone, wechat_id, notes.",
    input_schema: {
      type: "object",
      properties: { type: { type: "string", enum: ["usdt_supplier", "cny_buyer"] }, display_name: { type: "string" }, legal_name: { type: "string" }, phone: { type: "string" }, wechat_id: { type: "string" }, notes: { type: "string" } },
      required: ["type", "display_name"],
    },
    prepare: (_admin, a) => {
      if (a.type !== "usdt_supplier" && a.type !== "cny_buyer") return Promise.resolve({ ok: false, error: "type doit être 'usdt_supplier' ou 'cny_buyer'." });
      if (!a.display_name) return Promise.resolve({ ok: false, error: "Nom (display_name) requis." });
      const lines: Line[] = [
        { label: "Type", value: a.type === "usdt_supplier" ? "Fournisseur USDT" : "Acheteur CNY" },
        { label: "Nom", value: String(a.display_name) },
      ];
      if (a.phone) lines.push({ label: "Téléphone", value: String(a.phone) });
      if (a.wechat_id) lines.push({ label: "WeChat", value: String(a.wechat_id) });
      return Promise.resolve({ ok: true, args: { p_type: a.type, p_display_name: String(a.display_name).trim(), p_legal_name: a.legal_name || null, p_phone: a.phone || null, p_wechat_id: a.wechat_id || null, p_notes: a.notes || null }, summary: { title: "Créer une contrepartie", subtitle: a.type === "usdt_supplier" ? "Fournisseur USDT" : "Acheteur CNY", lines, confirmLabel: "Créer" } });
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("create_treasury_counterparty", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "adjust_treasury_account",
    permission: "canViewTreasury",
    superAdminOnly: true,
    description: "Ajuster manuellement le solde d'un compte de trésorerie (crédit ou débit) avec un motif. Pour réconciliation, frais, financement initial. Fournir account (nom/code), delta_amount (positif = crédit, négatif = débit), reason. Réservé super_admin.",
    input_schema: {
      type: "object",
      properties: { account: { type: "string" }, delta_amount: { type: "number" }, reason: { type: "string" } },
      required: ["account", "delta_amount", "reason"],
    },
    prepare: async (admin, a) => {
      const acc = await resolveTreasuryAccount(admin, a.account, null);
      if (!acc.ok) return { ok: false, error: acc.error };
      const delta = Number(a.delta_amount);
      if (!delta || !Number.isFinite(delta)) return { ok: false, error: "Montant d'ajustement invalide." };
      if (!a.reason || String(a.reason).trim().length < 3) return { ok: false, error: "Motif obligatoire." };
      const lines: Line[] = [
        { label: "Compte", value: acc.label },
        { label: "Sens", value: delta > 0 ? "Crédit (+)" : "Débit (−)" },
        { label: "Montant", value: `${delta > 0 ? "+" : ""}${delta.toLocaleString("fr-FR")} ${acc.currency ?? ""}` },
        { label: "Motif", value: String(a.reason) },
      ];
      return { ok: true, args: { p_account_id: acc.id, p_delta_amount: delta, p_reason: String(a.reason) }, summary: { title: "Ajuster un compte trésorerie", subtitle: acc.label, lines, confirmLabel: "Confirmer l'ajustement", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("adjust_treasury_account", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "void_treasury_operation",
    permission: "canViewTreasury",
    superAdminOnly: true,
    description: "ANNULER / contre-passer une opération de trésorerie (achat USDT, vente USDT, ajustement). Crée des écritures inverses traçables (pas de suppression). C'est ainsi qu'on 'corrige' une opération : on l'annule puis on la recrée. source_type ∈ usdt_purchase | usdt_sale | manual_adjustment. Fournir source_type, et source_ref (référence externe ou identifiant) OU on retrouve via les outils de liste. reason obligatoire (≥10 caractères). Réservé super_admin.",
    input_schema: {
      type: "object",
      properties: {
        source_type: { type: "string", enum: ["usdt_purchase", "usdt_sale", "manual_adjustment", "inventory_snapshot"] },
        source_id: { type: "string", description: "UUID de l'opération (depuis list_usdt_purchases/list_usdt_sales/treasury_ledger)" },
        reason: { type: "string" },
      },
      required: ["source_type", "source_id", "reason"],
    },
    prepare: (_admin, a) => {
      if (!a.source_id || !UUID_RE.test(String(a.source_id))) return Promise.resolve({ ok: false, error: "source_id (UUID) requis. Récupère-le via list_usdt_purchases / list_usdt_sales / treasury_ledger." });
      if (!["usdt_purchase", "usdt_sale", "manual_adjustment", "inventory_snapshot"].includes(a.source_type)) return Promise.resolve({ ok: false, error: "source_type invalide." });
      if (!a.reason || String(a.reason).trim().length < 10) return Promise.resolve({ ok: false, error: "Motif obligatoire (≥10 caractères)." });
      const label: Record<string, string> = { usdt_purchase: "Achat USDT", usdt_sale: "Vente USDT", manual_adjustment: "Ajustement", inventory_snapshot: "Inventaire" };
      return Promise.resolve({ ok: true, args: { p_source_table: a.source_type, p_source_id: a.source_id, p_void_reason: String(a.reason) }, summary: { title: "Annuler une opération trésorerie", subtitle: label[a.source_type], lines: [{ label: "Type", value: label[a.source_type] }, { label: "Effet", value: "↩️ écritures inverses (traçable)" }, { label: "Motif", value: String(a.reason) }], confirmLabel: "Annuler l'opération", danger: true } });
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("void_treasury_operation", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "update_treasury_counterparty",
    permission: "canViewTreasury",
    description: "Modifier un fournisseur USDT / acheteur CNY (nom, nom légal, téléphone, WeChat, notes) OU l'archiver/réactiver (is_active). Fournir counterparty (nom/short_id/UUID) + les champs à changer.",
    input_schema: {
      type: "object",
      properties: {
        counterparty: { type: "string" }, type: { type: "string", enum: ["usdt_supplier", "cny_buyer"] },
        display_name: { type: "string" }, legal_name: { type: "string" }, phone: { type: "string" }, wechat_id: { type: "string" }, notes: { type: "string" }, is_active: { type: "boolean" },
      },
      required: ["counterparty"],
    },
    prepare: async (admin, a) => {
      // type optionnel : on tente fournisseur puis acheteur si non précisé
      let cp = await resolveCounterparty(admin, a.counterparty, a.type || "usdt_supplier");
      if (!cp.ok && !a.type) cp = await resolveCounterparty(admin, a.counterparty, "cny_buyer");
      if (!cp.ok) return { ok: false, error: cp.error };
      const lines: Line[] = [{ label: "Contrepartie", value: cp.name }];
      const fields: Record<string, unknown> = { p_id: cp.id };
      const map: Record<string, string> = { display_name: "p_display_name", legal_name: "p_legal_name", phone: "p_phone", wechat_id: "p_wechat_id", notes: "p_notes" };
      for (const k of Object.keys(map)) { if (a[k] != null) { fields[map[k]] = a[k]; lines.push({ label: k, value: String(a[k]) }); } }
      if (typeof a.is_active === "boolean") { fields.p_is_active = a.is_active; lines.push({ label: "Statut", value: a.is_active ? "Actif" : "Archivé" }); }
      if (Object.keys(fields).length === 1) return { ok: false, error: "Aucun champ à modifier fourni." };
      return { ok: true, args: fields, summary: { title: "Modifier une contrepartie", subtitle: cp.name, lines, confirmLabel: "Enregistrer" } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("update_treasury_counterparty", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "delete_treasury_counterparty",
    permission: "canViewTreasury",
    superAdminOnly: true,
    description: "Supprimer définitivement un fournisseur/acheteur — UNIQUEMENT s'il n'a AUCUNE opération (sinon la base refuse, utilise plutôt l'archivage via update_treasury_counterparty). Fournir counterparty (nom/short_id/UUID).",
    input_schema: { type: "object", properties: { counterparty: { type: "string" }, type: { type: "string", enum: ["usdt_supplier", "cny_buyer"] } }, required: ["counterparty"] },
    prepare: async (admin, a) => {
      let cp = await resolveCounterparty(admin, a.counterparty, a.type || "usdt_supplier");
      if (!cp.ok && !a.type) cp = await resolveCounterparty(admin, a.counterparty, "cny_buyer");
      if (!cp.ok) return { ok: false, error: cp.error };
      return { ok: true, args: { p_id: cp.id }, summary: { title: "Supprimer une contrepartie", subtitle: cp.name, lines: [{ label: "Contrepartie", value: cp.name }, { label: "Condition", value: "refusé si elle a des opérations" }], confirmLabel: "Supprimer", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("delete_treasury_counterparty", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "record_inventory_snapshot",
    permission: "canViewTreasury",
    description: "Enregistrer un inventaire physique (comptage réel) d'un compte de trésorerie. La base calcule l'écart vs le solde théorique et crée l'ajustement si besoin. Fournir account (nom/code), actual_balance (montant compté). Optionnel: variance_reason.",
    input_schema: { type: "object", properties: { account: { type: "string" }, actual_balance: { type: "number" }, variance_reason: { type: "string" } }, required: ["account", "actual_balance"] },
    prepare: async (admin, a) => {
      const acc = await resolveTreasuryAccount(admin, a.account, null);
      if (!acc.ok) return { ok: false, error: acc.error };
      const bal = Number(a.actual_balance);
      if (!Number.isFinite(bal) || bal < 0) return { ok: false, error: "Solde compté invalide." };
      const lines: Line[] = [
        { label: "Compte", value: acc.label },
        { label: "Solde compté", value: `${bal.toLocaleString("fr-FR")} ${acc.currency ?? ""}` },
        { label: "Effet", value: "écart calculé + ajustement auto si besoin" },
      ];
      if (a.variance_reason) lines.push({ label: "Raison écart", value: String(a.variance_reason) });
      return { ok: true, args: { p_account_id: acc.id, p_actual_balance: bal, p_variance_reason: a.variance_reason || null }, summary: { title: "Enregistrer un inventaire", subtitle: acc.label, lines, confirmLabel: "Confirmer l'inventaire", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("record_inventory_snapshot", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  {
    name: "delete_client",
    permission: "canManageUsers",
    superAdminOnly: true,
    description: "⚠️ SUPPRESSION DÉFINITIVE d'un client et de tout son historique (wallet, dépôts, paiements). Irréversible. Réservé au super_admin. À n'utiliser qu'en dernier recours.",
    input_schema: { type: "object", properties: { client_user_id: { type: "string" } }, required: ["client_user_id"] },
    prepare: async (admin, a) => {
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      return { ok: true, args: { p_user_id: c.uid }, summary: { title: "SUPPRIMER un client", subtitle: "⚠️ irréversible — efface tout l'historique", lines: [{ label: "Client", value: c.name }], confirmLabel: "Supprimer définitivement", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("admin_delete_client", args);
      if (error) return { success: false, error: error.message };
      return data;
    },
  },
  // ─── Parité (Lot 2) : bénéficiaires réutilisables + ajustements de taux ───
  {
    name: "create_beneficiary",
    permission: "canProcessPayments",
    description: "Enregistrer un bénéficiaire RÉUTILISABLE pour un client (registre des bénéficiaires, comme l'écran Bénéficiaires). Différent de update_payment_beneficiary (qui ne touche qu'UN paiement). Fournir client_user_id, payment_method (alipay|wechat|bank_transfer|cash), alias et name. Optionnels: identifier, identifier_type, phone, email, bank_name, bank_account, bank_extra, relation_type, notes.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" }, payment_method: { type: "string", enum: ["alipay", "wechat", "bank_transfer", "cash"] },
        alias: { type: "string" }, name: { type: "string" }, identifier: { type: "string" }, identifier_type: { type: "string" },
        phone: { type: "string" }, email: { type: "string" }, bank_name: { type: "string" }, bank_account: { type: "string" },
        bank_extra: { type: "string" }, relation_type: { type: "string" }, notes: { type: "string" },
      },
      required: ["client_user_id", "payment_method", "alias", "name"],
    },
    prepare: async (admin, a) => {
      const c = await resolveClient(admin, a.client_user_id);
      if (!c.ok) return { ok: false, error: c.error };
      if (!["alipay", "wechat", "bank_transfer", "cash"].includes(a.payment_method)) return { ok: false, error: "payment_method invalide (alipay|wechat|bank_transfer|cash)." };
      if (!a.alias || !a.name) return { ok: false, error: "alias et name sont requis." };
      const row = {
        client_id: c.uid, payment_method: a.payment_method, alias: String(a.alias).trim(), name: String(a.name).trim(),
        identifier: a.identifier || null, identifier_type: a.identifier_type || null, phone: a.phone || null, email: a.email || null,
        bank_name: a.bank_name || null, bank_account: a.bank_account || null, bank_extra: a.bank_extra || null,
        relation_type: a.relation_type || null, notes: a.notes || null, qr_code_url: null,
      };
      const lines: Line[] = [
        { label: "Client", value: c.name }, { label: "Bénéficiaire", value: `${row.alias} — ${row.name}` },
        { label: "Mode", value: PAYMENT_METHOD_LABEL[a.payment_method] || a.payment_method },
      ];
      if (row.phone) lines.push({ label: "Téléphone", value: String(row.phone) });
      if (row.bank_name) lines.push({ label: "Banque", value: String(row.bank_name) });
      return { ok: true, args: { row }, summary: { title: "Enregistrer un bénéficiaire", subtitle: c.name, lines, confirmLabel: "Enregistrer le bénéficiaire" } };
    },
    execute: async (userClient, args, ctx) => {
      const { error } = await userClient.from("beneficiaries").insert({ ...(args.row as Record<string, unknown>), created_by: ctx.adminUserId, created_by_role: "admin" });
      if (error) {
        if ((error as AnyClient)?.code === "23505") return { success: false, error: "Ce bénéficiaire est déjà enregistré pour ce client." };
        return { success: false, error: error.message };
      }
      return { success: true };
    },
  },
  {
    name: "update_beneficiary",
    permission: "canProcessPayments",
    description: "Modifier un bénéficiaire enregistré (par beneficiary_id, obtenu via list_beneficiaries). Champs: alias, name, identifier, identifier_type, phone, email, bank_name, bank_account, bank_extra, relation_type, notes.",
    input_schema: {
      type: "object",
      properties: {
        beneficiary_id: { type: "string" }, alias: { type: "string" }, name: { type: "string" }, identifier: { type: "string" },
        identifier_type: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, bank_name: { type: "string" },
        bank_account: { type: "string" }, bank_extra: { type: "string" }, relation_type: { type: "string" }, notes: { type: "string" },
      },
      required: ["beneficiary_id"],
    },
    prepare: async (admin, a) => {
      if (!UUID_RE.test(String(a.beneficiary_id ?? ""))) return { ok: false, error: "beneficiary_id (UUID) requis. Utilise list_beneficiaries pour le récupérer." };
      const { data: ben } = await admin.from("beneficiaries").select("id, alias, name").eq("id", a.beneficiary_id).maybeSingle();
      if (!ben) return { ok: false, error: "Bénéficiaire introuvable." };
      const editable = ["alias", "name", "identifier", "identifier_type", "phone", "email", "bank_name", "bank_account", "bank_extra", "relation_type", "notes"];
      const fields: Record<string, unknown> = {};
      const lines: Line[] = [{ label: "Bénéficiaire", value: `${ben.alias} — ${ben.name}` }];
      for (const k of editable) { if (a[k] !== undefined && a[k] !== null) { fields[k] = a[k]; lines.push({ label: k, value: String(a[k]) }); } }
      if (Object.keys(fields).length === 0) return { ok: false, error: "Aucun champ à modifier fourni." };
      return { ok: true, args: { beneficiary_id: ben.id, fields }, summary: { title: "Modifier un bénéficiaire", subtitle: `${ben.alias} — ${ben.name}`, lines, confirmLabel: "Enregistrer" } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.from("beneficiaries").update(args.fields).eq("id", args.beneficiary_id).select("id");
      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) return { success: false, error: "Aucune ligne modifiée (introuvable ou accès refusé)." };
      return { success: true };
    },
  },
  {
    name: "archive_beneficiary",
    permission: "canProcessPayments",
    description: "Archiver (désactiver) un bénéficiaire enregistré (par beneficiary_id) → is_active=false. Réversible (réactivable via update direct). Il disparaît des listes actives sans être supprimé.",
    input_schema: { type: "object", properties: { beneficiary_id: { type: "string" } }, required: ["beneficiary_id"] },
    prepare: async (admin, a) => {
      if (!UUID_RE.test(String(a.beneficiary_id ?? ""))) return { ok: false, error: "beneficiary_id (UUID) requis (via list_beneficiaries)." };
      const { data: ben } = await admin.from("beneficiaries").select("id, alias, name").eq("id", a.beneficiary_id).maybeSingle();
      if (!ben) return { ok: false, error: "Bénéficiaire introuvable." };
      return { ok: true, args: { beneficiary_id: ben.id }, summary: { title: "Archiver un bénéficiaire", subtitle: `${ben.alias} — ${ben.name}`, lines: [{ label: "Effet", value: "désactivé (réversible)" }], confirmLabel: "Archiver", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.from("beneficiaries").update({ is_active: false }).eq("id", args.beneficiary_id).select("id");
      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) return { success: false, error: "Aucune ligne modifiée." };
      return { success: true };
    },
  },
  {
    name: "set_rate_adjustment",
    permission: "canManageRates",
    superAdminOnly: true,
    description: "Modifier le POURCENTAGE d'un ajustement de taux existant (par pays/palier), comme l'écran Taux. ⚠️ Impacte le calcul de TOUS les nouveaux paiements concernés. Fournir key (la clé de l'ajustement, via get_rate_adjustments) et percentage (nouveau %). Optionnel: type (pour désambiguïser). Ne crée pas d'ajustement (la plateforme ne fait que les modifier).",
    input_schema: { type: "object", properties: { key: { type: "string" }, percentage: { type: "number" }, type: { type: "string" } }, required: ["key", "percentage"] },
    prepare: async (admin, a) => {
      if (a.percentage == null || !Number.isFinite(Number(a.percentage))) return { ok: false, error: "percentage invalide." };
      let q = admin.from("rate_adjustments").select("id, type, key, label, percentage").eq("key", String(a.key));
      if (a.type) q = q.eq("type", String(a.type));
      const { data: rows } = await q;
      if (!rows || rows.length === 0) return { ok: false, error: `Aucun ajustement pour key="${a.key}". Utilise get_rate_adjustments pour voir les clés.` };
      if (rows.length > 1) return { ok: false, error: `Plusieurs ajustements pour "${a.key}" : ${rows.map((r: AnyClient) => `${r.type}/${r.key}`).join(", ")}. Précise type.` };
      const adj = rows[0];
      const lines: Line[] = [
        { label: "Ajustement", value: `${adj.label ?? adj.key} (${adj.type})` },
        { label: "Actuel", value: `${adj.percentage} %` },
        { label: "Nouveau", value: `${Number(a.percentage)} %` },
        { label: "Effet", value: "⚠️ s'applique aux nouveaux paiements" },
      ];
      return { ok: true, args: { p_adjustment_id: adj.id, p_percentage: Number(a.percentage) }, summary: { title: "Modifier un ajustement de taux", subtitle: String(adj.label ?? adj.key), lines, confirmLabel: "Appliquer l'ajustement", danger: true } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc("update_rate_adjustment", args);
      if (error) return { success: false, error: error.message };
      if (data?.success === false) return { success: false, error: data.error };
      return data;
    },
  },
  {
    name: "remember",
    permission: "canViewPayments",
    description: "Mémoriser durablement une préférence ou un fait utile sur l'admin ou son activité (ex. « fournisseur USDT habituel = Lizette », « répondre en français »). Rappelé automatiquement aux prochaines conversations. Fournir key (court) et value. À utiliser quand l'admin dit « retiens que… ».",
    input_schema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] },
    prepare: (_admin, a) => {
      if (!a.key || !a.value) return Promise.resolve({ ok: false, error: "key et value requis." });
      const key = String(a.key).trim().slice(0, 80);
      const value = String(a.value).trim().slice(0, 500);
      return Promise.resolve({ ok: true, args: { key, value }, summary: { title: "Mémoriser", lines: [{ label: key, value }], confirmLabel: "Mémoriser" } });
    },
    execute: async (_userClient, args, ctx) => {
      const { error } = await ctx.admin.from("mola_user_memory").upsert(
        { admin_user_id: ctx.adminUserId, key: args.key, value: args.value, updated_at: new Date().toISOString() },
        { onConflict: "admin_user_id,key" },
      );
      if (error) return { success: false, error: error.message };
      return { success: true };
    },
  },
  {
    // GATEWAY générique : exécute une capacité AUTO-DÉCOUVERTE (étiquetée @mola en base),
    // SANS outil dédié. C'est la preuve « AI-native » : une RPC étiquetée devient utilisable
    // par Mola sans réécriture. Sécurité : permission de la capacité + carte de confirmation.
    name: "do_capability",
    permission: "canViewPayments",
    description: "EXÉCUTE une capacité WRITE découverte via find_capability (par son name exact), même sans outil dédié. Fournir capability (le name) et params (objet). Les références (BZ-DP-…, BZ-…) sont résolues automatiquement. Une carte de confirmation s'affiche.",
    input_schema: { type: "object", properties: { capability: { type: "string" }, params: { type: "object" } }, required: ["capability"] },
    prepare: async (admin, a) => {
      const name = String(a.capability ?? "").trim();
      if (!name) return { ok: false, error: "capability (name) requis." };
      const { data: caps } = await admin.rpc("mola_discover_capabilities", { p_search: name });
      // deno-lint-ignore no-explicit-any
      const cap = (caps ?? []).find((c: any) => c.name === name);
      if (!cap) return { ok: false, error: `Capacité « ${name} » introuvable/non exposée. Utilise find_capability d'abord.` };
      const meta = (cap.meta ?? {}) as AnyClient;
      if (meta.expose !== true) return { ok: false, error: `Capacité « ${name} » non exposée.` };
      if (meta.tool) return { ok: false, error: `Pour cette action, utilise l'outil dédié « ${meta.tool} » (plus complet : calcul du taux, vérif du solde, carte de confirmation). Ne passe pas par do_capability.` };
      if (meta.kind === "read") return { ok: false, error: `« ${name} » est une lecture : utilise find_capability/query_database, pas do_capability.` };
      // Garde de permission (rôle injecté par la boucle dans __perms).
      const perms = (a.__perms ?? {}) as Record<string, boolean>;
      if (meta.permission && !perms[meta.permission]) return { ok: false, error: `Ton rôle n'a pas la permission requise (${meta.permission}) pour « ${name} ».` };
      // Résolution des références + construction des arguments RPC.
      const inParams = (a.params ?? {}) as Record<string, unknown>;
      const resolveMap = (meta.resolve ?? {}) as Record<string, string>;
      const rpcArgs: Record<string, unknown> = {};
      const lines: Line[] = [{ label: "Action", value: String(meta.label ?? name) }];
      for (const [k, v] of Object.entries(inParams)) {
        if (resolveMap[k]) {
          const r = await resolveRef(admin, resolveMap[k], v);
          if (!r.ok) return { ok: false, error: r.error };
          rpcArgs[k] = r.id;
          lines.push({ label: k, value: `${String(v)} → ${r.id.slice(0, 8)}…` });
        } else {
          rpcArgs[k] = v;
          lines.push({ label: k, value: String(v) });
        }
      }
      return { ok: true, args: { __rpc: name, __perm: meta.permission ?? null, rpcArgs }, summary: { title: String(meta.label ?? name), subtitle: "capacité découverte", lines, confirmLabel: meta.danger ? "Confirmer (sensible)" : "Confirmer", danger: !!meta.danger } };
    },
    execute: async (userClient, args) => {
      const { data, error } = await userClient.rpc(String(args.__rpc), (args.rpcArgs ?? {}) as Record<string, unknown>);
      if (error) return { success: false, error: error.message };
      if (data?.success === false) return { success: false, error: data.error };
      return data ?? { success: true };
    },
  },
  {
    name: "replace_payment_proof",
    permission: "canProcessPayments",
    acceptsProof: true,
    description: "Remplacer la/les preuve(s) d'un paiement : supprime les preuves existantes ET attache la nouvelle capture jointe au message. Fournir reference (BZ-…) ou payment_id, et JOINDRE la nouvelle preuve. (Pour seulement supprimer, utilise delete_payment_proof.)",
    input_schema: { type: "object", properties: { reference: { type: "string" }, payment_id: { type: "string" } } },
    prepare: async (admin, a) => {
      let q = admin.from("payments").select("id, reference");
      if (a.payment_id) q = q.eq("id", a.payment_id);
      else if (a.reference) q = q.eq("reference", a.reference);
      else return { ok: false, error: "Fournir reference ou payment_id." };
      const { data: pay } = await q.maybeSingle();
      if (!pay) return { ok: false, error: "Paiement introuvable." };
      const { data: proofs } = await admin.from("payment_proofs").select("id").eq("payment_id", pay.id);
      const ids = (proofs ?? []).map((p: AnyClient) => p.id);
      return { ok: true, args: { p_payment_id: pay.id, proof_ids: ids }, summary: { title: "Remplacer la preuve d'un paiement", subtitle: pay.reference, lines: [{ label: "Preuves existantes", value: `${ids.length} (supprimées)` }, { label: "Nouvelle preuve", value: "capture jointe au message" }], confirmLabel: "Remplacer la preuve", danger: true } };
    },
    execute: async (userClient, args, ctx) => {
      let deleted = 0;
      for (const pid of ((args.proof_ids ?? []) as string[])) {
        const { data } = await userClient.rpc("delete_payment_proof", { p_proof_id: pid });
        if (data?.success !== false) deleted++;
      }
      const attached = args.proofAttachments?.length ? await attachPaymentProofs(ctx.admin, args.p_payment_id, ctx.adminUserId, args.proofAttachments) : 0;
      return { success: true, deleted, attached, note: attached === 0 ? "Aucune nouvelle preuve jointe — preuves supprimées seulement." : undefined };
    },
  },
];

function buildSystemPrompt(role: string, firstName: string): string {
  return [
    `Tu es Mola, le directeur des opérations IA de BonziniLabs, une fintech qui permet aux importateurs africains de régler leurs fournisseurs chinois en XAF. Ton nom est Mola — si on te demande qui tu es, réponds que tu es Mola.`,
    `Tu parles à ${firstName || "un administrateur"} (rôle: ${role}). Réponds en français : concis, clair, professionnel et chaleureux. Quand c'est naturel, adresse-toi à lui/elle par son prénom${firstName ? " (" + firstName + ")" : ""} de temps en temps — PAS à chaque phrase, juste à l'occasion (ex. « C'est noté${firstName ? ", " + firstName : ""}. », « J'ai validé${firstName ? ", " + firstName : ""}. »).`,
    ``,
    `CONNAISSANCE MÉTIER (socle — complète toujours par tes outils pour les chiffres réels) :`,
    `- DÉPÔT : created → proof_submitted → admin_review → validated (crédite le wallet XAF du client) ou rejected.`,
    `- PAIEMENT fournisseur : created → waiting_beneficiary_info → ready_for_payment → processing → completed (ou rejected). Débite le wallet. Minimum 10 000 XAF. Modes : alipay, wechat, bank_transfer, cash.`,
    `- TAUX : en CNY (¥) pour 1 000 000 XAF, par mode ; ajustements en % par pays/palier ; un paiement utilise le taux du jour OU un taux personnalisé.`,
    `- TRÉSORERIE : on achète des USDT en XAF puis on les vend en CNY pour régler les fournisseurs chinois. Coût de revient en WAC ; le bénéfice = le spread achat/vente.`,
    `- WALLET : solde XAF du client (crédité par dépôt validé, débité par paiement) ; jamais modifié à la main sauf ajustement tracé.`,
    ``,
    `ACCÈS BASE DE DONNÉES — TON RÉFLEXE N°1. Tu as un accès LECTURE COMPLET à la base Bonzini via query_database (SQL SELECT PostgreSQL). Pour TOUTE question chiffrée ou factuelle sur les données, tu VAS LIRE LA BASE TOI-MÊME et tu réponds avec des chiffres EXACTS issus de la requête. Tu n'inventes RIEN, tu n'estimes RIEN, tu ne dis JAMAIS « je n'ai pas accès » / « je ne peux pas calculer » : tu écris la requête SQL. Une seule limite, volontaire et dans l'intérêt de l'argent : c'est de la LECTURE SEULE (aucune requête ne peut modifier la base). Les modifications passent par les actions à confirmation. À part ça : tu lis absolument tout ce que tu veux, librement.`,
    `TRANSPARENCE / CONFIANCE : quand l'admin doute d'un chiffre ou le demande, MONTRE-lui la requête SQL exacte que tu as exécutée et la fenêtre de dates utilisée — qu'il puisse vérifier lui-même la source. Un chiffre accompagné de sa requête, c'est ça la confiance. Ne te défausse jamais sur « mes outils sont limités » : si un chiffre te paraît douteux, recoupe-le par une 2e requête SQL.`,
    `SCHÉMA RÉEL DE BONZINI (utilise-le pour écrire un SQL juste — colonnes et statuts EXACTS) :`,
    `- deposits = une DEMANDE de dépôt. Colonnes clés : user_id, amount_xaf (demandé), confirmed_amount_xaf (montant réellement validé), status, method, reference, created_at, validated_at. status ∈ created, awaiting_proof, proof_submitted, admin_review, validated, rejected, pending_correction, cancelled, cancelled_by_admin. → VOLUME de dépôts d'une période = sum(coalesce(confirmed_amount_xaf, amount_xaf)) where status = 'validated' and created_at >= début and created_at < fin.`,
    `- payments = un PAIEMENT fournisseur. Colonnes clés : user_id, amount_xaf, amount_rmb, exchange_rate, rate_is_custom, status, method, reference, created_at, processed_at. status ∈ created, waiting_beneficiary_info, ready_for_payment, processing, completed, rejected, cash_pending, cash_scanned, cancelled_by_admin. → VOLUME payé d'une période = sum(amount_xaf) where status = 'completed'.`,
    `- wallets(user_id, balance_xaf) = solde courant du client. ledger_entries(user_id, wallet_id, entry_type, amount_xaf, balance_before, balance_after, created_at) = le GRAND LIVRE des mouvements d'argent réels sur les wallets. entry_type ∈ DEPOSIT_VALIDATED, DEPOSIT_REFUSED, PAYMENT_RESERVED, PAYMENT_EXECUTED, PAYMENT_CANCELLED_REFUNDED, ADMIN_CREDIT, ADMIN_DEBIT.`,
    `- clients(user_id, first_name, last_name, phone, company_name, country, city, status). Pour afficher des NOMS : join clients c on c.user_id = x.user_id.`,
    `DISTINCTION À MAÎTRISER : deposits/payments = le CYCLE OPÉRATIONNEL (compté par created_at) ; ledger_entries = l'ARGENT effectivement entré/sorti des wallets (compté à la date du mouvement). « Combien de dépôts/paiements » → deposits/payments. « Combien d'argent est entré/sorti d'un wallet » → ledger_entries. En cas de doute, précise quelle source tu utilises. Pour un raccourci EXACT et déjà calculé (volumes + ventilation par statut), get_operations_stats fait l'agrégation côté serveur ; sinon écris ton propre SQL.`,
    ``,
    `LECTURE : tu peux consulter et répondre à toute question (clients, dépôts, paiements, taux, statistiques, dashboard global, trésorerie complète, audit) via tes outils de lecture.`,
    `CAPACITÉS À NE PAS SOUS-ESTIMER : tu PEUX classer les clients par volume de transactions sur une période (outil top_clients_by_volume), filtrer dépôts/paiements par dates (from_date/to_date, ou year+month comme "avril 2026", ou period), faire le rapport trésorerie sur une période, etc. Ne réponds JAMAIS "mes outils ne permettent pas" ou "contacte l'équipe technique" sans avoir d'abord ESSAYÉ l'outil approprié. Pour un mois précis, utilise year+month. Pour une plage, utilise from_date+to_date (YYYY-MM-DD). Si une demande couvre 2 mois (ex. avril ET mai), fais 2 appels ou utilise from_date/to_date couvrant les deux.`,
    `STATISTIQUES / VOLUMES / TOTAUX (RÈGLE ABSOLUE) : pour TOUTE question chiffrée d'ensemble — « quel volume de dépôts/paiements », « combien de dépôts en mai », « bilan du mois », totaux, ventilation par statut — utilise get_operations_stats (year+month, ou from_date+to_date, ou period). Il agrège EXACTEMENT côté serveur (aucun plafond, aucune approximation) et renvoie les bornes de dates exactes. N'ADDITIONNE JAMAIS toi-même les lignes de list_deposits/list_payments : elles sont tronquées et te donneraient un total FAUX. Si un résultat d'outil contient "truncated": true, NE calcule pas de total à partir de ses lignes — repasse par get_operations_stats (ou query_database avec un GROUP BY). Présente les nombres exacts tels quels ; ne « corrige » pas un chiffre à la louche.`,
    `LISTE DES CLIENTS DÉPOSANTS : pour "tous les clients ayant effectué des dépôts sur une période" (ex. les 4 derniers mois), utilise list_depositing_clients (months=4, ou from_date/to_date, ou year+month). Il renvoie la liste COMPLÈTE et dédupliquée des clients AVEC LEURS NOMS (+ nb de dépôts, total, dernier dépôt), sans troncature. N'utilise PAS list_deposits pour ça (ses lignes brutes sont tronquées et il ne donne pas les noms).`,
    `OUTIL UNIVERSEL query_database : si AUCUN outil dédié ne répond exactement à une question de DONNÉES, écris toi-même une requête SQL SELECT (PostgreSQL) via query_database. Tu peux interroger LIBREMENT toutes les tables (jointures, agrégations, filtres par date avec created_at/occurred_at, regroupements…). C'est en lecture seule garanti côté base : aucune requête ne peut modifier les données, donc n'hésite pas à l'utiliser largement. Ne dis JAMAIS "la requête est restreinte/bloquée" : si une requête échoue, lis le message d'erreur et corrige ta requête (ex. nom de colonne), puis réessaie.`,
    `INTROSPECTION & HONNÊTETÉ : avant d'affirmer qu'une action est IMPOSSIBLE, appelle what_can_i_do. Trois réponses honnêtes : (1) je le fais (j'ai l'outil) ; (2) la plateforme le permet via un écran mais je n'ai pas encore l'outil — je le dis franchement et je le signale ; (3) ce n'est pas supporté. Ne confabule JAMAIS une fausse règle métier (ex. « le taux est fixé ») pour masquer l'absence d'un outil.`,
    `DÉCOUVERTE DE CAPACITÉS : si aucun de tes outils dédiés ne correspond à une action demandée, appelle d'abord find_capability (ex. « annuler dépôt », « confirmer cash ») — la plateforme expose peut-être déjà cette action, prête à l'emploi. Puis exécute-la via do_capability (son name + les paramètres ; donne une référence BZ-…, l'identifiant est résolu, et une carte de confirmation s'affiche). Ne dis « je ne peux pas » qu'APRÈS avoir cherché une capacité.`,
    `MÉMOIRE : un bloc « MÉMOIRE » (profil de l'admin, résumé du début de la conversation, souvenirs pertinents) peut t'être fourni en tête — appuie-toi dessus, ne le redis pas inutilement. Quand l'admin dit « retiens que… » ou exprime une préférence durable, utilise l'outil remember (key courte + value). Ne mémorise pas de données sensibles (soldes, numéros de compte) : celles-ci se lisent en direct via tes outils.`,
    `Détail trésorerie : pour les achats USDT par fournisseur (ex. "3 derniers achats chez Lizette"), utilise list_usdt_purchases avec supplier="Lizette". Pour les ventes, list_usdt_sales avec buyer=... . Ces outils joignent déjà le nom du fournisseur/acheteur.`,
    ``,
    `ÉCRITURE (créer client, créer/valider/rejeter dépôt, créer/annuler paiement, compléter le bénéficiaire d'un paiement, enregistrer/modifier/archiver un bénéficiaire RÉUTILISABLE, modifier client, définir le taux du jour, modifier un ajustement de taux par pays, créditer/débiter un wallet, et TRÉSORERIE : enregistrer un achat USDT, une vente USDT, créer un fournisseur/acheteur, ajuster un compte, etc.) :`,
    `- Quand tu appelles un outil d'écriture, il N'EST PAS exécuté immédiatement : une CARTE DE CONFIRMATION est présentée à l'admin, qui valide d'un tap. C'est normal et voulu.`,
    `- Avant TOUTE action qui vise un client existant (dépôt, paiement, modification, suppression), tu DOIS d'abord appeler search_clients pour récupérer son user_id RÉEL (un UUID de la forme xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). N'invente JAMAIS un identifiant comme "user_cmr_jonas_002" — ça échoue. Si le client n'existe pas encore, propose d'abord de le créer.`,
    `- N'invente jamais un montant ou un user_id : récupère-les. Par défaut, le taux RMB est calculé automatiquement par l'outil au taux du jour — ne calcule pas le taux toi-même. EXCEPTION : si l'admin demande explicitement un taux personnalisé (ex. « au taux 78 »), passe-le dans le paramètre exchange_rate de create_payment ; la plateforme autorise les paiements à taux personnalisé, exactement comme l'écran de paiement admin. Ne dis donc JAMAIS que « le taux est fixé » : c'est faux.`,
    `- Si une demande est ambiguë (ex. plusieurs clients du même nom), demande une précision.`,
    `- Après avoir proposé une action, indique brièvement à l'admin de confirmer via la carte. Ne ré-appelle pas le même outil en boucle.`,
    ``,
    `PIÈCES JOINTES — RÈGLE ABSOLUE : NE LIS PAS, N'ANALYSE PAS les captures. Tu n'as pas à savoir ce qu'il y a dessus. L'admin te donne lui-même les infos (client, montant, mode de paiement) dans son message. Les captures servent UNIQUEMENT de preuves à attacher. Ne commente jamais le contenu d'une image, ne dis jamais "la capture n'est pas bonne", ne demande jamais à quoi elle correspond. Il peut y en avoir plusieurs : toutes sont attachées automatiquement.`,
    `Exemple : "Dépôt de 5M pour Jonas Boco par Orange Money, voici les preuves" → tu retrouves Jonas via search_clients, puis tu proposes create_and_validate_deposit avec montant=5000000 et method=om_transfer. Les captures jointes deviennent automatiquement les preuves. Tu ne regardes pas les images.`,
    `Fie-toi TOUJOURS aux montants et infos donnés par l'admin dans le texte, jamais à une image.`,
    ``,
    `STYLE : réponds en texte simple et naturel. N'utilise PAS de markdown lourd (pas de ** pour le gras, pas de # de titres, pas de tableaux). Des phrases courtes et des listes avec un tiret suffisent. Mets toujours un espace après les deux-points.`,
    ``,
    `RÈGLES :`,
    `- Formate les montants en XAF avec séparateurs (ex : 10 000 000 XAF). Les taux sont en CNY (¥) pour 1 000 000 XAF.`,
    `- Si un outil renvoie une erreur de permission, indique que ce rôle n'a pas accès à cette action.`,
    `- VÉRIFIE-toi sur l'argent et les chiffres : avant toute proposition financière, recoupe montant, solde et taux ; sur une réponse chiffrée (volumes, totaux), contrôle la cohérence. Un appel d'outil de plus vaut mieux qu'un chiffre faux.`,
    `- Va à l'essentiel.`,
  ].join("\n");
}

async function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 400)}`);
  }
  return await res.json();
}

/**
 * Appel Anthropic en STREAMING. Reconstruit le message complet (texte + tool_use)
 * tout en invoquant onText(delta) à chaque fragment de texte — pour l'affichage
 * mot-à-mot côté client.
 */
// deno-lint-ignore no-explicit-any
async function streamAnthropic(apiKey: string, body: Record<string, unknown>, onText: (delta: string) => void): Promise<{ content: any[]; stop_reason: string; usage: TokenUsage }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) {
    const txt = res.body ? await res.text() : "";
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 400)}`);
  }

  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [];
  let stopReason = "end_turn";
  const usage: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const jsonBuf: Record<number, string> = {}; // accumulation des input_json_delta par index

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev: AnyClient;
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "content_block_start") {
        blocks[ev.index] = ev.content_block?.type === "tool_use"
          ? { type: "tool_use", id: ev.content_block.id, name: ev.content_block.name, input: {} }
          : { type: "text", text: "" };
        if (ev.content_block?.type === "tool_use") jsonBuf[ev.index] = "";
      } else if (ev.type === "content_block_delta") {
        if (ev.delta?.type === "text_delta") {
          blocks[ev.index].text += ev.delta.text;
          onText(ev.delta.text);
        } else if (ev.delta?.type === "input_json_delta") {
          jsonBuf[ev.index] = (jsonBuf[ev.index] ?? "") + (ev.delta.partial_json ?? "");
        }
      } else if (ev.type === "content_block_stop") {
        const b = blocks[ev.index];
        if (b?.type === "tool_use") {
          try { b.input = jsonBuf[ev.index] ? JSON.parse(jsonBuf[ev.index]) : {}; } catch { b.input = {}; }
        }
      } else if (ev.type === "message_start") {
        const u = ev.message?.usage;
        if (u) {
          usage.input_tokens += Number(u.input_tokens ?? 0);
          usage.cache_read_input_tokens += Number(u.cache_read_input_tokens ?? 0);
          usage.cache_creation_input_tokens += Number(u.cache_creation_input_tokens ?? 0);
        }
      } else if (ev.type === "message_delta") {
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.usage?.output_tokens != null) usage.output_tokens = Number(ev.usage.output_tokens);
      }
    }
  }
  return { content: blocks.filter(Boolean), stop_reason: stopReason, usage };
}

// ─── MÉMOIRE (Lot 3) — TOUT best-effort : ne casse JAMAIS le flux principal ───
// Embeddings gte-small (384) générés DANS l'edge runtime (Supabase.ai) → rien ne sort de l'infra.
async function embedText(text: string): Promise<number[] | null> {
  try {
    // deno-lint-ignore no-explicit-any
    const S = (globalThis as any).Supabase;
    if (!S?.ai?.Session) return null;
    const session = new S.ai.Session("gte-small");
    const out = await session.run(String(text ?? "").slice(0, 2000), { mean_pool: true, normalize: true });
    return Array.isArray(out) ? (out as number[]) : null;
  } catch (_) { return null; }
}

// Bloc de contexte mémoire : profil (toujours) + résumé roulant + souvenirs récupérés (best-effort).
async function buildMemoryContext(admin: AnyClient, adminUserId: string, conversationId: string, message: string): Promise<string> {
  const parts: string[] = [];
  try {
    const { data: prof } = await admin.from("mola_user_memory").select("key, value").eq("admin_user_id", adminUserId).limit(40);
    if (prof?.length) parts.push(`Profil de cet admin (ce que tu sais déjà) :\n` + prof.map((p: AnyClient) => `- ${p.key}: ${typeof p.value === "string" ? p.value : JSON.stringify(p.value)}`).join("\n"));
  } catch (_) { /* best-effort */ }
  try {
    const { data: conv } = await admin.from("assistant_conversations").select("rolling_summary").eq("id", conversationId).maybeSingle();
    if (conv?.rolling_summary) parts.push(`Résumé du début de cette conversation :\n${conv.rolling_summary}`);
  } catch (_) { /* best-effort */ }
  try {
    const emb = await embedText(message);
    if (emb) {
      const { data: hits } = await admin.rpc("mola_search_memory", { p_embedding: emb, p_admin: adminUserId, p_limit: 6 });
      if (hits?.length) parts.push(`Souvenirs pertinents (mémoire) :\n` + hits.map((h: AnyClient) => `- ${h.content}`).join("\n"));
    }
  } catch (_) { /* best-effort */ }
  return parts.length ? `MÉMOIRE (contexte rappelé — appuie-toi dessus si pertinent, ne l'invente pas) :\n${parts.join("\n\n")}` : "";
}

// Compaction (conversation longue) + épisodique inter-conversations — best-effort, throttlé.
async function maybeCompact(admin: AnyClient, apiKey: string, adminUserId: string, conversationId: string): Promise<void> {
  try {
    const { count } = await admin.from("assistant_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
    const n = count ?? 0;
    if (n < 30 || n % 8 !== 0) return; // seulement les conversations longues, périodiquement
    const { data: old } = await admin.from("assistant_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(Math.max(0, n - 20));
    const text = (old ?? []).map((m: AnyClient) => `${m.role}: ${typeof m.content?.text === "string" ? m.content.text : ""}`).filter(Boolean).join("\n").slice(0, 12000);
    if (!text) return;
    const resp = await callAnthropic(apiKey, { model: MODEL_FAST, max_tokens: 400, system: "Résume en 4-6 puces les faits DURABLES de cette conversation (clients, montants, décisions). Concis, factuel, en français.", messages: [{ role: "user", content: text }] });
    // deno-lint-ignore no-explicit-any
    const summary = (resp?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (!summary) return;
    await admin.from("assistant_conversations").update({ rolling_summary: summary, summary_through: new Date().toISOString() }).eq("id", conversationId);
    const emb = await embedText(summary);
    if (emb) await admin.from("mola_memory").insert({ kind: "episodic", admin_user_id: adminUserId, scope: `conversation:${conversationId}`, content: summary, embedding: emb, source: "compaction", expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
  } catch (_) { /* best-effort */ }
}

// Encode un événement SSE pour notre propre flux vers le client.
function sse(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) return json({ success: false, error: "ANTHROPIC_API_KEY non configurée (secret Supabase Edge Functions)." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Non authentifié" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Non authentifié" }, 401);

    const { data: roleRows, error: roleErr } = await admin.from("user_roles").select("role, is_disabled, first_name").eq("user_id", user.id);
    if (roleErr) return json({ success: false, error: "Erreur de vérification des permissions" }, 500);
    // Un utilisateur peut cumuler plusieurs rôles (ex. père = treasurer + sourcing_agent) :
    // on ne garde que les rôles actifs et on FUSIONNE leurs permissions (OR).
    const activeRows = ((roleRows ?? []) as AnyClient[]).filter((r) => !r.is_disabled);
    if (activeRows.length === 0) return json({ success: false, error: "Accès réservé aux administrateurs actifs" }, 403);
    const roles = activeRows.map((r: AnyClient) => String(r.role));
    const role = pickPrimaryRole(roles);
    const firstName = String(activeRows.find((r: AnyClient) => r.first_name)?.first_name ?? "").trim();
    const perms = mergePerms(roles);

    // deno-lint-ignore no-explicit-any
    let body: any;
    try { body = await req.json(); } catch { return json({ success: false, error: "Corps de requête invalide" }, 400); }

    // ──────────── BRANCHE CONFIRMATION / ANNULATION D'UNE ACTION ────────────
    if (body.confirmAction || body.cancelAction) {
      const actionId = String(body.confirmAction || body.cancelAction);
      const { data: pa } = await admin.from("assistant_pending_actions").select("*").eq("id", actionId).maybeSingle();
      if (!pa || pa.admin_user_id !== user.id) return json({ success: false, error: "Action introuvable" }, 404);
      if (pa.status !== "pending") return json({ success: false, error: "Cette action a déjà été traitée." }, 409);

      if (body.cancelAction) {
        await admin.from("assistant_pending_actions").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", actionId);
        return json({ success: true, status: "cancelled" });
      }

      // Confirmation → vérifier la permission (encore) puis exécuter avec le JWT admin
      const tool = WRITE_TOOLS.find((t) => t.name === pa.tool);
      if (!tool) return json({ success: false, error: "Outil inconnu" }, 400);
      if (!perms[tool.permission]) return json({ success: false, error: "Permission insuffisante pour exécuter cette action." }, 403);
      // Gateway générique : re-vérifie la permission de la CAPACITÉ (pas seulement de l'outil do_capability).
      if (pa.tool === "do_capability") {
        const capPerm = (pa.args as AnyClient)?.__perm as PermKey | undefined;
        if (capPerm && !perms[capPerm]) return json({ success: false, error: "Permission insuffisante pour cette capacité." }, 403);
      }
      // Défense en profondeur : super_admin requis pour les actions les plus sensibles
      if (tool.superAdminOnly && role !== "super_admin") {
        return json({ success: false, error: "Action réservée au super administrateur." }, 403);
      }
      // Actions wallet : super_admin OU liste blanche (ex. Jonas)
      if (tool.walletAdminsOnly && !canAdjustWallet(role, user.email, user.id)) {
        return json({ success: false, error: "Action réservée aux administrateurs autorisés (ajustement de wallet)." }, 403);
      }

      // Prise ATOMIQUE de l'action (pending → executing) : empêche le double-tap concurrent
      const { data: claimed } = await admin
        .from("assistant_pending_actions")
        .update({ status: "executing" })
        .eq("id", actionId).eq("status", "pending")
        .select("id");
      if (!claimed || claimed.length === 0) {
        return json({ success: false, error: "Cette action est déjà en cours ou traitée." }, 409);
      }

      let result: Record<string, unknown>;
      try { result = await tool.execute(userClient, pa.args, { admin, adminUserId: user.id }); }
      catch (e) { result = { success: false, error: String((e as Error)?.message ?? e) }; }

      const ok = result?.success !== false;
      await admin.from("assistant_pending_actions").update({ status: ok ? "executed" : "failed", result, resolved_at: new Date().toISOString() }).eq("id", actionId);
      await admin.from("admin_audit_logs").insert({ admin_user_id: user.id, action_type: `assistant_exec_${pa.tool}`, target_type: "assistant_action", target_id: actionId, details: { ok, tool: pa.tool } }).then(() => {}, () => {});
      // Trace dans la conversation pour la cohérence des tours suivants
      if (pa.conversation_id) {
        const note = ok ? `✅ Action exécutée : ${pa.summary?.title ?? pa.tool}.` : `❌ Échec : ${result?.error ?? "erreur"}.`;
        await admin.from("assistant_messages").insert({ conversation_id: pa.conversation_id, role: "assistant", content: { text: note } }).then(() => {}, () => {});
      }
      return json({ success: ok, result, error: ok ? undefined : (result?.error ?? "Échec de l'exécution") });
    }

    // ──────────── BRANCHE CHAT (proposition d'actions + lecture) ────────────
    const message = String(body.message ?? "").trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];
    if (!message && attachments.length === 0) return json({ success: false, error: "Message vide" }, 400);

    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const { data: conv } = await admin.from("assistant_conversations").select("id, admin_user_id").eq("id", conversationId).maybeSingle();
      if (!conv || conv.admin_user_id !== user.id) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await admin.from("assistant_conversations").insert({ admin_user_id: user.id, title: message.slice(0, 60) || "Conversation" }).select("id").single();
      if (error) return json({ success: false, error: "Impossible de créer la conversation" }, 500);
      conversationId = conv.id;
    }

    // Les N derniers messages (les plus RÉCENTS), remis dans l'ordre chronologique pour le modèle.
    const { data: histRaw } = await admin.from("assistant_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(40);
    const hist = (histRaw ?? []).reverse();
    // deno-lint-ignore no-explicit-any
    const history = (hist ?? []).filter((m: any) => m.role === "user" || m.role === "assistant").map((m: any) => {
      let text = typeof m.content?.text === "string" ? m.content.text : "";
      const atts = Array.isArray(m.content?.attachments) ? m.content.attachments : [];
      if (atts.length) text += `\n[pièces jointes : ${atts.map((a: any) => a?.name).filter(Boolean).join(", ")}]`;
      return { role: m.role, content: text || "(message vide)" };
    });

    // Pièces jointes : on NE LES ENVOIE PAS au modèle (pas d'analyse demandée).
    // On valide juste qu'elles existent et appartiennent à l'admin, puis on les
    // garde pour les attacher comme preuves. → bien plus rapide et moins cher.
    const acceptedAttachments: Array<{ path: string; mime: string; name: string }> = [];
    for (const att of attachments) {
      if (!att?.path || !ALLOWED_ATTACHMENT_MIME.has(att?.mime)) continue;
      if (!String(att.path).startsWith(`${user.id}/`)) continue; // restreint au dossier de l'appelant
      acceptedAttachments.push({ path: att.path, mime: att.mime, name: att.name });
    }

    // Le modèle reçoit seulement le texte + une note sur le nombre de preuves jointes.
    const attachNote = acceptedAttachments.length
      ? `\n[${acceptedAttachments.length} preuve(s) jointe(s) par l'admin — à attacher à l'action, NE PAS analyser]`
      : "";
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [...history, { role: "user", content: (message || "(pièces jointes)") + attachNote }];

    // Outils autorisés pour ce rôle (lecture + écriture)
    const allowedRead = READ_TOOLS.filter((t) => t.always || (perms[t.permission] && !(t.superAdminOnly && role !== "super_admin")));
    const allowedWrite = WRITE_TOOLS.filter((t) => {
      if (!perms[t.permission]) return false;
      if (t.superAdminOnly && role !== "super_admin") return false;
      if (t.walletAdminsOnly && !canAdjustWallet(role, user.email, user.id)) return false;
      return true;
    });
    // deno-lint-ignore no-explicit-any
    const toolDefs: any[] = [
      ...allowedRead.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      ...allowedWrite.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    ];
    // Cache du bloc d'outils (gros préfixe stable) → tours suivants plus rapides/moins chers.
    if (toolDefs.length) toolDefs[toolDefs.length - 1].cache_control = { type: "ephemeral" };

    const system = buildSystemPrompt(role, firstName);
    // Mémoire (Lot 3) : contexte rappelé (profil + résumé roulant + souvenirs), best-effort.
    const memoryContext = await buildMemoryContext(admin, user.id, String(conversationId), message);
    // deno-lint-ignore no-explicit-any
    const systemBlocks: any[] = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
    if (memoryContext) systemBlocks.push({ type: "text", text: memoryContext });

    // ──────────── RÉPONSE EN STREAMING (SSE) ────────────
    // MODEL_FAST par défaut (Sonnet 4.6) ; bascule sur MODEL_SMART dès qu'une action
    // d'écriture est proposée (les deux surchargeables par secret ASSISTANT_MODEL_*).
    const convId = conversationId;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: Record<string, unknown>) => { try { controller.enqueue(sse(o)); } catch (_) { /* client parti */ } };
        let finalText = "";
        const usedTools: string[] = [];
        // deno-lint-ignore no-explicit-any
        const proposals: any[] = [];
        let model = MODEL_FAST;
        const totalUsage: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

        send({ type: "start", conversationId: convId });

        try {
          for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const resp = await streamAnthropic(
              apiKey,
              { model, max_tokens: 4000, system: systemBlocks, tools: toolDefs, messages },
              (delta) => send({ type: "delta", text: delta }),
            );
            const content = resp.content ?? [];
            totalUsage.input_tokens += resp.usage.input_tokens;
            totalUsage.output_tokens += resp.usage.output_tokens;
            totalUsage.cache_read_input_tokens += resp.usage.cache_read_input_tokens;
            totalUsage.cache_creation_input_tokens += resp.usage.cache_creation_input_tokens;
            // deno-lint-ignore no-explicit-any
            const toolUses = content.filter((b: any) => b.type === "tool_use");

            if (resp.stop_reason === "tool_use" && toolUses.length > 0) {
              messages.push({ role: "assistant", content });
              // Si une action d'ÉCRITURE est demandée, on passe au modèle "smart" pour la suite.
              if (toolUses.some((tu: AnyClient) => allowedWrite.find((t) => t.name === tu.name))) model = MODEL_SMART;
              // deno-lint-ignore no-explicit-any
              const results: any[] = [];
              for (const tu of toolUses) {
                usedTools.push(tu.name);
                const readTool = allowedRead.find((t) => t.name === tu.name);
                const writeTool = allowedWrite.find((t) => t.name === tu.name);
                let result: Record<string, unknown>;
                if (readTool) {
                  // Les outils needsAuth (ex. trésorerie via auth.uid()) reçoivent le client authentifié.
                  const toolInput = (tu.input ?? {}) as Record<string, unknown>;
                  // SQL libre : injecte l'allowlist de tables du rôle (sauf super_admin = accès complet).
                  if (tu.name === "query_database" && role !== "super_admin") toolInput.__allowed_tables = allowedTablesForRole(perms);
                  try { result = await readTool.execute(admin, toolInput, readTool.needsAuth ? userClient : undefined); }
                  catch (e) { result = { error: String((e as Error)?.message ?? e) }; }
                  // Si l'outil a produit une image (ex. flyer), on l'envoie au chat.
                  // deno-lint-ignore no-explicit-any
                  const img = (result as any)?.__image;
                  if (img?.url) {
                    send({ type: "image", image: { url: img.url, name: img.name ?? "Image" } });
                    // On retire l'image du résultat transmis au modèle (inutile en texte).
                    // deno-lint-ignore no-explicit-any
                    delete (result as any).__image;
                  }
                } else if (writeTool) {
                  try {
                    const wInput = (tu.input ?? {}) as Record<string, unknown>;
                    // Gateway générique : on injecte les permissions du rôle pour la garde par capacité.
                    if (tu.name === "do_capability") wInput.__perms = perms;
                    const prep = await writeTool.prepare(admin, wInput);
                    if (!prep.ok) { result = { error: prep.error }; }
                    else {
                      // Outils acceptant une preuve : on rattache les captures du message à l'action.
                      const argsToStore = writeTool.acceptsProof && acceptedAttachments.length
                        ? { ...prep.args, proofAttachments: acceptedAttachments }
                        : prep.args;
                      if (writeTool.acceptsProof && acceptedAttachments.length) {
                        prep.summary.lines.push({ label: "Preuve", value: `${acceptedAttachments.length} pièce(s) jointe(s) ✅` });
                      }
                      const { data: pa } = await admin.from("assistant_pending_actions").insert({
                        conversation_id: convId, admin_user_id: user.id, tool: writeTool.name, args: argsToStore, summary: prep.summary, status: "pending",
                      }).select("id").single();
                      const proposal = { id: pa?.id, tool: writeTool.name, summary: prep.summary };
                      proposals.push(proposal);
                      send({ type: "proposal", proposal });
                      result = { status: "proposition_creee", message: "Carte de confirmation présentée à l'admin. En attente de son tap. Ne ré-exécute pas." };
                    }
                  } catch (e) { result = { error: String((e as Error)?.message ?? e) }; }
                } else {
                  result = { error: "outil indisponible pour ce rôle" };
                }
                // Masquage PII par rôle AVANT envoi au LLM (numéros de compte pour tous ; tél/email selon rôle).
                results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(maskForRole(role, result)) });
              }
              messages.push({ role: "user", content: results });
              continue;
            }

            // deno-lint-ignore no-explicit-any
            const turnText = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
            finalText += (finalText && turnText ? "\n" : "") + turnText;
            // Réponse tronquée par la limite de tokens → on POURSUIT la génération (QW-2b).
            if (resp.stop_reason === "max_tokens") { messages.push({ role: "assistant", content }); continue; }
            break;
          }

          if (!finalText) {
            finalText = proposals.length ? "J'ai préparé l'action ci-dessous — confirme pour l'exécuter." : "Je n'ai pas pu formuler de réponse. Peux-tu reformuler ?";
            send({ type: "delta", text: finalText });
          }

          // Persistance + audit (après le stream)
          await admin.from("assistant_messages").insert([
            { conversation_id: convId, role: "user", content: { text: message, attachments: acceptedAttachments } },
            { conversation_id: convId, role: "assistant", content: { text: finalText } },
          ]);
          await admin.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
          await admin.from("admin_audit_logs").insert({
            admin_user_id: user.id, action_type: "assistant_query", target_type: "assistant", target_id: convId,
            details: {
              message: message.slice(0, 200), tools: usedTools, attachments: acceptedAttachments.length, proposals: proposals.length,
              model, usage: totalUsage, est_cost_usd: estimateCostUsd(model, totalUsage),
            },
          }).then(() => {}, () => {});

          // Compaction + mémoire épisodique (best-effort, après persistance).
          await maybeCompact(admin, apiKey, user.id, convId);
          send({ type: "done", conversationId: convId });
        } catch (e) {
          console.error("admin-assistant stream error:", (e as Error)?.message ?? e);
          send({ type: "error", error: "Erreur de l'assistant" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (error) {
    console.error("admin-assistant error:", (error as Error)?.message ?? error);
    return json({ success: false, error: "Erreur inattendue de l'assistant" }, 500);
  }
});
