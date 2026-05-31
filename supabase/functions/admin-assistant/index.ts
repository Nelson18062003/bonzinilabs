// Edge Function: admin-assistant
// "Directeur des Opérations" IA — Phase 1 (LECTURE SEULE, large couverture).
//
// - Vérifie que l'appelant est un admin actif (via son JWT).
// - Détient la clé ANTHROPIC_API_KEY (secret) — jamais exposée au frontend.
// - Boucle agentique avec de nombreux OUTILS de LECTURE, filtrés par les
//   permissions du rôle de l'appelant.
// - Persiste la conversation (audit + historique).
//
// Appelée depuis le frontend via fetch() avec l'en-tête Authorization (JWT admin),
// PAS via supabaseAdmin.functions.invoke() (qui casse à cause des conflits GoTrue).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("ASSISTANT_MODEL") ?? "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 8;

// Permissions par rôle — miroir (lecture) de src/contexts/AdminAuthContext.tsx
type PermKey = "canViewClients" | "canViewDeposits" | "canViewPayments" | "canViewTreasury" | "canViewLogs" | "canManageUsers";
const ROLE_PERMISSIONS: Record<string, Record<PermKey, boolean>> = {
  super_admin:      { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: true,  canViewLogs: true,  canManageUsers: true },
  ops:              { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: true,  canManageUsers: false },
  support:          { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: true,  canManageUsers: false },
  customer_success: { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: false, canManageUsers: false },
  cash_agent:       { canViewClients: false, canViewDeposits: false, canViewPayments: true,  canViewTreasury: false, canViewLogs: false, canManageUsers: false },
  treasurer:        { canViewClients: false, canViewDeposits: false, canViewPayments: false, canViewTreasury: true,  canViewLogs: false, canManageUsers: false },
};

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
  else d.setDate(d.getDate() - 7); // défaut: semaine
  return d.toISOString();
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

interface Tool {
  name: string;
  permission: PermKey;
  description: string;
  // deno-lint-ignore no-explicit-any
  input_schema: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  execute: (admin: AnyClient, args: any) => Promise<Record<string, unknown>>;
}

const TOOLS: Tool[] = [
  // ───────────────────────── CLIENTS ─────────────────────────
  {
    name: "search_clients",
    permission: "canViewClients",
    description: "Rechercher des clients par nom, prénom, téléphone ou entreprise. Renvoie id, user_id, nom, téléphone, pays, statut KYC.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
    execute: async (admin, { query, limit }) => {
      const term = `%${String(query ?? "").trim()}%`;
      const { data, error } = await admin
        .from("clients")
        .select("id, user_id, first_name, last_name, phone, company_name, country, city, status, kyc_verified")
        .or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},company_name.ilike.${term}`)
        .limit(clamp(limit, 10, 25));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, clients: data ?? [] };
    },
  },
  {
    name: "get_client_details",
    permission: "canViewClients",
    description: "Fiche complète d'un client (profil, KYC, entreprise, pays) + solde du wallet + nombre de dépôts/paiements. Fournir client_user_id (recommandé) ou client_id.",
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string" }, client_id: { type: "string" } },
    },
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
        found: true,
        client,
        wallet_balance_xaf: wallet?.balance_xaf ?? 0,
        wallet_balance_formatted: fmtXAF(wallet?.balance_xaf ?? 0),
        deposits_count: depCount ?? 0,
        payments_count: payCount ?? 0,
      };
    },
  },
  {
    name: "get_wallet_balance",
    permission: "canViewClients",
    description: "Solde du portefeuille (wallet) d'un client à partir de son user_id.",
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string" } },
      required: ["client_user_id"],
    },
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
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string" }, limit: { type: "number" } },
      required: ["client_user_id"],
    },
    execute: async (admin, { client_user_id, limit }) => {
      const { data, error } = await admin
        .from("ledger_entries")
        .select("entry_type, amount_xaf, balance_before, balance_after, description, reference_type, created_at")
        .eq("user_id", client_user_id)
        .order("created_at", { ascending: false })
        .limit(clamp(limit, 15, 50));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, entries: data ?? [] };
    },
  },
  // ───────────────────────── DÉPÔTS ─────────────────────────
  {
    name: "list_deposits",
    permission: "canViewDeposits",
    description: "Lister les derniers dépôts. Filtres optionnels: status (created, awaiting_proof, proof_submitted, admin_review, validated, rejected, cancelled), client_user_id.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string" }, client_user_id: { type: "string" }, limit: { type: "number" } },
    },
    execute: async (admin, { status, client_user_id, limit }) => {
      let q = admin
        .from("deposits")
        .select("reference, amount_xaf, confirmed_amount_xaf, method, status, bank_name, agency_name, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(clamp(limit, 10, 25));
      if (status) q = q.eq("status", status);
      if (client_user_id) q = q.eq("user_id", client_user_id);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, deposits: data ?? [] };
    },
  },
  {
    name: "get_deposit",
    permission: "canViewDeposits",
    description: "Détail complet d'un dépôt (par référence BZ-DP-... ou par deposit_id), avec sa chronologie et le nombre de preuves jointes.",
    input_schema: {
      type: "object",
      properties: { reference: { type: "string" }, deposit_id: { type: "string" } },
    },
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
      const { data: timeline } = await admin
        .from("deposit_timeline_events")
        .select("event_type, description, created_at")
        .eq("deposit_id", dep.id)
        .order("created_at", { ascending: true });
      const { count: proofCount } = await admin
        .from("deposit_proofs")
        .select("id", { count: "exact", head: true })
        .eq("deposit_id", dep.id)
        .is("deleted_at", null);
      return { found: true, deposit: dep, proofs_count: proofCount ?? 0, timeline: timeline ?? [] };
    },
  },
  // ──────────────────────── PAIEMENTS ────────────────────────
  {
    name: "list_payments",
    permission: "canViewPayments",
    description: "Lister les derniers paiements fournisseurs. Filtres optionnels: status (created, waiting_beneficiary_info, ready_for_payment, processing, completed, rejected, cash_pending, cash_scanned), client_user_id.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string" }, client_user_id: { type: "string" }, limit: { type: "number" } },
    },
    execute: async (admin, { status, client_user_id, limit }) => {
      let q = admin
        .from("payments")
        .select("reference, amount_xaf, amount_rmb, method, status, beneficiary_name, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(clamp(limit, 10, 25));
      if (status) q = q.eq("status", status);
      if (client_user_id) q = q.eq("user_id", client_user_id);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, payments: data ?? [] };
    },
  },
  {
    name: "get_payment",
    permission: "canViewPayments",
    description: "Détail complet d'un paiement (par référence ou payment_id) : montants XAF/RMB, taux, méthode, bénéficiaire, statut, motif de rejet éventuel.",
    input_schema: {
      type: "object",
      properties: { reference: { type: "string" }, payment_id: { type: "string" } },
    },
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
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string" }, payment_method: { type: "string" }, limit: { type: "number" } },
      required: ["client_user_id"],
    },
    execute: async (admin, { client_user_id, payment_method, limit }) => {
      let q = admin
        .from("beneficiaries")
        .select("alias, name, payment_method, identifier_type, phone, email, bank_name, is_active, created_at")
        .eq("client_id", client_user_id)
        .order("created_at", { ascending: false })
        .limit(clamp(limit, 15, 50));
      if (payment_method) q = q.eq("payment_method", payment_method);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, beneficiaries: data ?? [] };
    },
  },
  // ────────────────────────── TAUX ──────────────────────────
  {
    name: "get_daily_rate",
    permission: "canViewPayments",
    description: "Taux du jour actif. Exprimé en CNY (¥) pour 1 000 000 XAF, par mode (cash, alipay, wechat, virement).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data, error } = await admin
        .from("daily_rates")
        .select("rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at")
        .eq("is_active", true)
        .order("effective_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { found: false };
      return { found: true, unit: "CNY pour 1 000 000 XAF", rate: data };
    },
  },
  {
    name: "get_rate_history",
    permission: "canViewPayments",
    description: "Historique des taux du jour (les plus récents).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin
        .from("daily_rates")
        .select("rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at, is_active")
        .order("effective_at", { ascending: false })
        .limit(clamp(limit, 7, 30));
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
      const { data, error } = await admin
        .from("rate_adjustments")
        .select("type, key, label, percentage, is_active")
        .order("type", { ascending: true });
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, adjustments: data ?? [] };
    },
  },
  // ─────────────────────── STATISTIQUES ───────────────────────
  {
    name: "get_stats",
    permission: "canViewDeposits",
    description: "Statistiques d'activité sur une période : nombre et volume des dépôts validés et des paiements. period = 'today' | 'week' | 'month' (défaut 'week').",
    input_schema: {
      type: "object",
      properties: { period: { type: "string", enum: ["today", "week", "month"] } },
    },
    execute: async (admin, { period }) => {
      const since = periodStartISO(period);
      const { data: deps, error: e1 } = await admin
        .from("deposits").select("amount_xaf, confirmed_amount_xaf, status, created_at").gte("created_at", since).limit(2000);
      if (e1) return { error: e1.message };
      const { data: pays, error: e2 } = await admin
        .from("payments").select("amount_xaf, status, created_at").gte("created_at", since).limit(2000);
      if (e2) return { error: e2.message };

      const validated = (deps ?? []).filter((d: AnyClient) => d.status === "validated");
      const depositVolume = validated.reduce((s: number, d: AnyClient) => s + Number(d.confirmed_amount_xaf ?? d.amount_xaf ?? 0), 0);
      const paymentVolume = (pays ?? []).reduce((s: number, p: AnyClient) => s + Number(p.amount_xaf ?? 0), 0);
      const payByStatus: Record<string, number> = {};
      for (const p of pays ?? []) payByStatus[p.status] = (payByStatus[p.status] ?? 0) + 1;

      return {
        period: period ?? "week",
        since,
        note: "Volumes calculés sur un échantillon plafonné à 2000 lignes par table.",
        deposits: {
          total: deps?.length ?? 0,
          validated_count: validated.length,
          validated_volume_xaf: depositVolume,
          validated_volume_formatted: fmtXAF(depositVolume),
        },
        payments: {
          total: pays?.length ?? 0,
          by_status: payByStatus,
          volume_xaf: paymentVolume,
          volume_formatted: fmtXAF(paymentVolume),
        },
      };
    },
  },
  {
    name: "get_pending_summary",
    permission: "canViewDeposits",
    description: "Ce qui demande de l'attention MAINTENANT : nombre de dépôts à traiter (created, proof_submitted, admin_review) et de paiements en cours (waiting_beneficiary_info, ready_for_payment, processing).",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const depStatuses = ["created", "proof_submitted", "admin_review"];
      const payStatuses = ["waiting_beneficiary_info", "ready_for_payment", "processing"];
      const deposits_pending: Record<string, number> = {};
      for (const s of depStatuses) {
        const { count } = await admin.from("deposits").select("id", { count: "exact", head: true }).eq("status", s);
        deposits_pending[s] = count ?? 0;
      }
      const payments_pending: Record<string, number> = {};
      for (const s of payStatuses) {
        const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("status", s);
        payments_pending[s] = count ?? 0;
      }
      return { deposits_pending, payments_pending };
    },
  },
  // ─────────────────────── TRÉSORERIE ───────────────────────
  {
    name: "get_treasury_summary",
    permission: "canViewTreasury",
    description: "Résumé trésorerie : inventaire USDT (quantité, coût moyen) et comptes actifs.",
    input_schema: { type: "object", properties: {} },
    execute: async (admin) => {
      const { data: inv } = await admin
        .from("treasury_inventory")
        .select("total_usdt, average_cost_xaf, total_cost_xaf, last_updated")
        .maybeSingle();
      const { data: accounts } = await admin
        .from("treasury_accounts")
        .select("name, type, currency, balance, is_active")
        .eq("is_active", true);
      return { inventory: inv ?? null, accounts: accounts ?? [] };
    },
  },
  {
    name: "list_treasury_transactions",
    permission: "canViewTreasury",
    description: "Dernières opérations de trésorerie (achats/ventes USDT).",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
    execute: async (admin, { limit }) => {
      const { data, error } = await admin
        .from("treasury_transactions")
        .select("transaction_type, usdt_amount, xaf_amount, rate, status, payment_status, reference, transaction_date")
        .order("transaction_date", { ascending: false })
        .limit(clamp(limit, 10, 25));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, transactions: data ?? [] };
    },
  },
  // ─────────────────────── AUDIT / ADMINS ───────────────────────
  {
    name: "list_audit_logs",
    permission: "canViewLogs",
    description: "Journal des actions admin (les plus récentes). Filtre optionnel: action_type.",
    input_schema: {
      type: "object",
      properties: { action_type: { type: "string" }, limit: { type: "number" } },
    },
    execute: async (admin, { action_type, limit }) => {
      let q = admin
        .from("admin_audit_logs")
        .select("admin_user_id, action_type, target_type, target_id, created_at")
        .order("created_at", { ascending: false })
        .limit(clamp(limit, 15, 50));
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
      const { data, error } = await admin
        .from("user_roles")
        .select("first_name, last_name, email, role, is_disabled, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, admins: data ?? [] };
    },
  },
];

function buildSystemPrompt(role: string): string {
  return [
    `Tu es l'assistant "Directeur des Opérations" de BonziniLabs, une fintech qui permet aux importateurs africains de régler leurs fournisseurs chinois en XAF.`,
    `Tu assistes un administrateur (rôle: ${role}). Réponds en français, de façon concise, claire et professionnelle.`,
    ``,
    `CAPACITÉS ACTUELLES : LECTURE SEULE sur toute la plateforme. Grâce à tes outils tu peux consulter :`,
    `- Clients : recherche, fiche complète (profil/KYC/entreprise), solde du wallet, grand livre (mouvements).`,
    `- Dépôts : liste filtrable, détail complet + chronologie + preuves.`,
    `- Paiements : liste filtrable, détail complet (montants XAF/RMB, taux, bénéficiaire, statut).`,
    `- Bénéficiaires enregistrés d'un client.`,
    `- Taux : taux du jour, historique, ajustements pays/paliers.`,
    `- Statistiques (volumes par période) et "ce qui demande attention" (en attente).`,
    `- Trésorerie (inventaire USDT, comptes, opérations) et journal d'audit, comptes admin.`,
    `(Selon les permissions du rôle : certains outils peuvent être indisponibles.)`,
    ``,
    `Tu ne peux PAS encore créer, modifier, valider ou supprimer quoi que ce soit — ces actions arriveront prochainement. Si on te demande une action d'écriture, explique poliment qu'elle n'est pas encore activée.`,
    ``,
    `RÈGLES :`,
    `- N'invente JAMAIS de chiffres ni de données : utilise systématiquement tes outils, puis cite les valeurs réelles.`,
    `- Enchaîne plusieurs outils si nécessaire (ex. trouver un client puis lire ses dépôts).`,
    `- Formate les montants en XAF avec séparateurs (ex : 10 000 000 XAF). Les taux sont en CNY (¥) pour 1 000 000 XAF.`,
    `- Si une demande est ambiguë (ex. plusieurs clients du même nom), demande une précision plutôt que de deviner.`,
    `- Si un outil renvoie une erreur de permission, indique que ce rôle n'a pas accès à cette information.`,
    `- Va à l'essentiel.`,
  ].join("\n");
}

async function callAnthropic(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 400)}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return json({ success: false, error: "ANTHROPIC_API_KEY non configurée. Ajoute-la dans les secrets Supabase (Edge Functions)." }, 500);
    }

    // 1) Authentifier l'appelant
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Non authentifié" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Non authentifié" }, 401);

    // 2) Vérifier le rôle admin (et qu'il n'est pas désactivé)
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role, is_disabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (roleErr) return json({ success: false, error: "Erreur de vérification des permissions" }, 500);
    if (!roleRow || roleRow.is_disabled) return json({ success: false, error: "Accès réservé aux administrateurs actifs" }, 403);

    const role = String(roleRow.role);
    const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["customer_success"];

    // 3) Corps de la requête
    let body: { conversationId?: string | null; message?: string };
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Corps de requête invalide" }, 400);
    }
    const message = String(body.message ?? "").trim();
    if (!message) return json({ success: false, error: "Message vide" }, 400);

    // 4) Conversation (créer ou vérifier la propriété)
    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const { data: conv } = await admin
        .from("assistant_conversations").select("id, admin_user_id").eq("id", conversationId).maybeSingle();
      if (!conv || conv.admin_user_id !== user.id) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await admin
        .from("assistant_conversations").insert({ admin_user_id: user.id, title: message.slice(0, 60) }).select("id").single();
      if (error) return json({ success: false, error: "Impossible de créer la conversation" }, 500);
      conversationId = conv.id;
    }

    // 5) Charger l'historique récent (texte uniquement)
    const { data: hist } = await admin
      .from("assistant_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    // deno-lint-ignore no-explicit-any
    const history = (hist ?? [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content?.text === "string" ? m.content.text : JSON.stringify(m.content),
      }));

    // 6) Outils autorisés pour ce rôle
    const allowedTools = TOOLS.filter((t) => perms[t.permission]);
    const toolDefs = allowedTools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));

    // 7) Boucle agentique
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [...history, { role: "user", content: message }];
    const system = buildSystemPrompt(role);
    let finalText = "";
    const usedTools: string[] = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await callAnthropic(apiKey, {
        model: MODEL,
        max_tokens: 1500,
        system,
        tools: toolDefs,
        messages,
      });
      const content = resp.content ?? [];
      // deno-lint-ignore no-explicit-any
      const toolUses = content.filter((b: any) => b.type === "tool_use");

      if (resp.stop_reason === "tool_use" && toolUses.length > 0) {
        messages.push({ role: "assistant", content });
        // deno-lint-ignore no-explicit-any
        const results: any[] = [];
        for (const tu of toolUses) {
          usedTools.push(tu.name);
          const tool = allowedTools.find((t) => t.name === tu.name);
          let result: Record<string, unknown>;
          if (!tool) result = { error: "outil indisponible pour ce rôle" };
          else {
            try { result = await tool.execute(admin, tu.input ?? {}); }
            catch (e) { result = { error: String((e as Error)?.message ?? e) }; }
          }
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      // deno-lint-ignore no-explicit-any
      finalText = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      break;
    }

    if (!finalText) finalText = "Je n'ai pas pu formuler de réponse. Peux-tu reformuler ta demande ?";

    // 8) Persistance + audit
    await admin.from("assistant_messages").insert([
      { conversation_id: conversationId, role: "user", content: { text: message } },
      { conversation_id: conversationId, role: "assistant", content: { text: finalText } },
    ]);
    await admin.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    try {
      await admin.from("admin_audit_logs").insert({
        admin_user_id: user.id,
        action_type: "assistant_query",
        target_type: "assistant",
        target_id: conversationId,
        details: { message: message.slice(0, 200), tools: usedTools },
      });
    } catch (_) { /* audit non bloquant */ }

    return json({ success: true, conversationId, reply: finalText, tools: usedTools });
  } catch (error) {
    console.error("admin-assistant error:", (error as Error)?.message ?? error);
    return json({ success: false, error: "Erreur inattendue de l'assistant" }, 500);
  }
});
