// Edge Function: admin-assistant
// "Directeur des Opérations" IA — LECTURE (réponses) + ÉCRITURE (avec CONFIRMATION humaine).
//
// - Vérifie que l'appelant est un admin actif (via son JWT).
// - Détient la clé ANTHROPIC_API_KEY (secret) — jamais exposée au frontend.
// - LECTURE : nombreux outils filtrés par les permissions du rôle.
// - ÉCRITURE : l'IA ne fait que PROPOSER une action (carte de confirmation).
//   Rien n'est exécuté tant que l'admin n'a pas confirmé. L'exécution passe par
//   les RPC existantes, appelées avec le JWT de l'admin (is_admin(auth.uid())).
// - Pièces jointes : images (vision) + PDF (documents). Prompt caching.
// - Tout est journalisé (admin_audit_logs + assistant_pending_actions).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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
const MAX_TOOL_ITERATIONS = 8;
const MIN_PAYMENT_XAF = 10_000;

// Pièces jointes (images analysées par vision + PDF lus comme documents)
const ATTACHMENT_BUCKET = "assistant-attachments";
const ALLOWED_ATTACHMENT_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const MAX_ATTACHMENTS = 5;

// Permissions par rôle — miroir de src/contexts/AdminAuthContext.tsx
type PermKey =
  | "canViewClients" | "canEditClients"
  | "canViewDeposits" | "canProcessDeposits"
  | "canViewPayments" | "canProcessPayments"
  | "canManageRates" | "canViewLogs" | "canManageUsers" | "canViewTreasury";
const ROLE_PERMISSIONS: Record<string, Record<PermKey, boolean>> = {
  super_admin:      { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: true,  canManageRates: true,  canViewLogs: true,  canManageUsers: true,  canViewTreasury: true },
  ops:              { canViewClients: true,  canEditClients: false, canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: true,  canManageRates: true,  canViewLogs: true,  canManageUsers: false, canViewTreasury: false },
  support:          { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: false, canViewPayments: true,  canProcessPayments: false, canManageRates: false, canViewLogs: true,  canManageUsers: false, canViewTreasury: false },
  customer_success: { canViewClients: true,  canEditClients: true,  canViewDeposits: true,  canProcessDeposits: true,  canViewPayments: true,  canProcessPayments: false, canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: false },
  cash_agent:       { canViewClients: false, canEditClients: false, canViewDeposits: false, canProcessDeposits: false, canViewPayments: true,  canProcessPayments: true,  canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: false },
  treasurer:        { canViewClients: false, canEditClients: false, canViewDeposits: false, canProcessDeposits: false, canViewPayments: false, canProcessPayments: false, canManageRates: false, canViewLogs: false, canManageUsers: false, canViewTreasury: true },
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
  else d.setDate(d.getDate() - 7);
  return d.toISOString();
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

// ════════════════════════ OUTILS DE LECTURE ════════════════════════
interface ReadTool {
  name: string;
  permission: PermKey;
  description: string;
  // deno-lint-ignore no-explicit-any
  input_schema: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  execute: (admin: AnyClient, args: any) => Promise<Record<string, unknown>>;
}

const READ_TOOLS: ReadTool[] = [
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
    description: "Lister les derniers dépôts. Filtres optionnels: status (created, awaiting_proof, proof_submitted, admin_review, validated, rejected, cancelled), client_user_id.",
    input_schema: { type: "object", properties: { status: { type: "string" }, client_user_id: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, { status, client_user_id, limit }) => {
      let q = admin.from("deposits")
        .select("reference, amount_xaf, confirmed_amount_xaf, method, status, bank_name, agency_name, created_at, user_id")
        .order("created_at", { ascending: false }).limit(clamp(limit, 10, 25));
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
    description: "Lister les derniers paiements fournisseurs. Filtres optionnels: status (created, waiting_beneficiary_info, ready_for_payment, processing, completed, rejected, cash_pending, cash_scanned), client_user_id.",
    input_schema: { type: "object", properties: { status: { type: "string" }, client_user_id: { type: "string" }, limit: { type: "number" } } },
    execute: async (admin, { status, client_user_id, limit }) => {
      let q = admin.from("payments")
        .select("reference, amount_xaf, amount_rmb, method, status, beneficiary_name, created_at, user_id")
        .order("created_at", { ascending: false }).limit(clamp(limit, 10, 25));
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
    description: "Créer un paiement fournisseur pour un client → DÉBITE son wallet (au taux du jour). Si l'admin a joint une capture (QR code, justificatif), elle est attachée comme preuve du paiement. Fournir client_user_id, amount_xaf, method (alipay|wechat|bank_transfer|cash). Optionnels: country_key (défaut cameroun), beneficiary_name, beneficiary_phone, beneficiary_bank_name, beneficiary_bank_account, beneficiary_qr_code_url. Le montant RMB est calculé automatiquement au taux du jour.",
    input_schema: {
      type: "object",
      properties: {
        client_user_id: { type: "string" }, amount_xaf: { type: "number" }, method: { type: "string", enum: ["alipay", "wechat", "bank_transfer", "cash"] },
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
      // Calculer le taux du jour (jamais inventé par l'IA)
      const { data: rate, error: rErr } = await admin.rpc("calculate_final_rate", { p_payment_method: rateMethod, p_country_key: countryKey, p_amount_xaf: amt });
      if (rErr) return { ok: false, error: `Calcul du taux: ${rErr.message}` };
      if (!rate?.success) return { ok: false, error: rate?.error || "Taux indisponible." };
      const amountRmb = Number(rate.amount_cny);
      const exchangeRate = Number(rate.final_rate);
      const args = {
        p_user_id: c.uid, p_amount_xaf: amt, p_amount_rmb: amountRmb, p_exchange_rate: exchangeRate, p_method: a.method,
        p_beneficiary_name: a.beneficiary_name || null, p_beneficiary_phone: a.beneficiary_phone || null,
        p_beneficiary_bank_name: a.beneficiary_bank_name || null, p_beneficiary_bank_account: a.beneficiary_bank_account || null,
        p_beneficiary_qr_code_url: a.beneficiary_qr_code_url || null,
      };
      const lines: Line[] = [
        { label: "Client", value: c.name },
        { label: "Mode", value: PAYMENT_METHOD_LABEL[a.method] || a.method },
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
    description: "Compléter/corriger les infos bénéficiaire d'un paiement non finalisé (par référence ou payment_id) : nom, téléphone, banque, compte, QR code. Si l'admin a joint une capture, elle est attachée comme preuve. Fait passer un paiement 'en attente d'infos' à 'prêt'.",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string" }, payment_id: { type: "string" },
        beneficiary_name: { type: "string" }, beneficiary_phone: { type: "string" },
        beneficiary_bank_name: { type: "string" }, beneficiary_bank_account: { type: "string" }, beneficiary_qr_code_url: { type: "string" },
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
      return { ok: true, args: { p_payment_id: pay.id, p_beneficiary_name: a.beneficiary_name || null, p_beneficiary_phone: a.beneficiary_phone || null, p_beneficiary_bank_name: a.beneficiary_bank_name || null, p_beneficiary_bank_account: a.beneficiary_bank_account || null, p_beneficiary_qr_code_url: a.beneficiary_qr_code_url || null }, summary: { title: "Compléter le bénéficiaire", subtitle: pay.reference, lines, confirmLabel: "Enregistrer" } };
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
];

function buildSystemPrompt(role: string): string {
  return [
    `Tu es l'assistant "Directeur des Opérations" de BonziniLabs, une fintech qui permet aux importateurs africains de régler leurs fournisseurs chinois en XAF.`,
    `Tu assistes un administrateur (rôle: ${role}). Réponds en français, de façon concise, claire et professionnelle.`,
    ``,
    `LECTURE : tu peux consulter et répondre à toute question (clients, dépôts, paiements, taux, statistiques, trésorerie, audit) via tes outils de lecture.`,
    ``,
    `ÉCRITURE (créer client, créer/valider/rejeter dépôt, créer/annuler paiement, compléter bénéficiaire, modifier client, définir le taux du jour, etc.) :`,
    `- Quand tu appelles un outil d'écriture, il N'EST PAS exécuté immédiatement : une CARTE DE CONFIRMATION est présentée à l'admin, qui valide d'un tap. C'est normal et voulu.`,
    `- Avant TOUTE action qui vise un client existant (dépôt, paiement, modification, suppression), tu DOIS d'abord appeler search_clients pour récupérer son user_id RÉEL (un UUID de la forme xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). N'invente JAMAIS un identifiant comme "user_cmr_jonas_002" — ça échoue. Si le client n'existe pas encore, propose d'abord de le créer.`,
    `- N'invente jamais un montant, un taux ou un user_id : récupère-les. Le taux RMB des paiements est calculé automatiquement par l'outil, ne le calcule pas toi-même.`,
    `- Si une demande est ambiguë (ex. plusieurs clients du même nom), demande une précision.`,
    `- Après avoir proposé une action, indique brièvement à l'admin de confirmer via la carte. Ne ré-appelle pas le même outil en boucle.`,
    ``,
    `Tu peux recevoir des images (captures, QR codes) et des PDF (relevés) joints par l'admin : analyse-les et exploite leur contenu (ex. lire un montant sur une capture).`,
    `IMPORTANT pièces jointes : si l'admin a DÉJÀ joint une capture/reçu dans le message, considère que la preuve est fournie — ne redemande JAMAIS le reçu. De toute façon la preuve est optionnelle pour valider un dépôt. Lis directement le montant/la référence sur l'image jointe.`,
    `WORKFLOW CAPTURE → DÉPÔT (très important) : quand l'admin joint une capture et te demande de créer le dépôt d'un client, tu DOIS : 1) lire le montant et le moyen de paiement sur la capture, 2) appeler search_clients pour retrouver le client (son user_id réel), 3) proposer directement l'action create_and_validate_deposit avec ces infos. NE CONTESTE PAS la capture, ne dis pas "la capture n'est pas bonne", ne demande pas d'autorisation pour la lire : l'admin te l'a donnée exprès. Si une info précise manque vraiment sur l'image (ex. montant illisible), demande UNIQUEMENT cette info, brièvement.`,
    `Si l'admin te dit explicitement un montant ou un moyen de paiement, fais-lui confiance même si la capture est ambiguë.`,
    ``,
    `STYLE : réponds en texte simple et naturel. N'utilise PAS de markdown lourd (pas de ** pour le gras, pas de # de titres, pas de tableaux). Des phrases courtes et des listes avec un tiret suffisent. Mets toujours un espace après les deux-points.`,
    ``,
    `RÈGLES :`,
    `- Formate les montants en XAF avec séparateurs (ex : 10 000 000 XAF). Les taux sont en CNY (¥) pour 1 000 000 XAF.`,
    `- Si un outil renvoie une erreur de permission, indique que ce rôle n'a pas accès à cette action.`,
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
async function streamAnthropic(apiKey: string, body: Record<string, unknown>, onText: (delta: string) => void): Promise<{ content: any[]; stop_reason: string }> {
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
      } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
        stopReason = ev.delta.stop_reason;
      }
    }
  }
  return { content: blocks.filter(Boolean), stop_reason: stopReason };
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

    const { data: roleRow, error: roleErr } = await admin.from("user_roles").select("role, is_disabled").eq("user_id", user.id).maybeSingle();
    if (roleErr) return json({ success: false, error: "Erreur de vérification des permissions" }, 500);
    if (!roleRow || roleRow.is_disabled) return json({ success: false, error: "Accès réservé aux administrateurs actifs" }, 403);

    const role = String(roleRow.role);
    const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["customer_success"];

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
      // Défense en profondeur : super_admin requis pour les actions les plus sensibles
      if (tool.superAdminOnly && role !== "super_admin") {
        return json({ success: false, error: "Action réservée au super administrateur." }, 403);
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

    const { data: hist } = await admin.from("assistant_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(20);
    // deno-lint-ignore no-explicit-any
    const history = (hist ?? []).filter((m: any) => m.role === "user" || m.role === "assistant").map((m: any) => {
      let text = typeof m.content?.text === "string" ? m.content.text : "";
      const atts = Array.isArray(m.content?.attachments) ? m.content.attachments : [];
      if (atts.length) text += `\n[pièces jointes : ${atts.map((a: any) => a?.name).filter(Boolean).join(", ")}]`;
      return { role: m.role, content: text || "(message vide)" };
    });

    // Pièces jointes → blocs multimodaux
    // deno-lint-ignore no-explicit-any
    const attachmentBlocks: any[] = [];
    const acceptedAttachments: Array<{ path: string; mime: string; name: string }> = [];
    for (const att of attachments) {
      if (!att?.path || !ALLOWED_ATTACHMENT_MIME.has(att?.mime)) continue;
      if (!String(att.path).startsWith(`${user.id}/`)) continue; // restreint au dossier de l'appelant
      try {
        const { data: blob, error: dlErr } = await admin.storage.from(ATTACHMENT_BUCKET).download(att.path);
        if (dlErr || !blob) continue;
        const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
        if (att.mime === "application/pdf") attachmentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
        else attachmentBlocks.push({ type: "image", source: { type: "base64", media_type: att.mime, data: b64 } });
        acceptedAttachments.push({ path: att.path, mime: att.mime, name: att.name });
      } catch (_) { /* illisible : ignorée */ }
    }

    // deno-lint-ignore no-explicit-any
    const userContent: any = attachmentBlocks.length > 0
      ? [...attachmentBlocks, { type: "text", text: message || "Analyse la ou les pièces jointes." }]
      : message;
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [...history, { role: "user", content: userContent }];

    // Outils autorisés pour ce rôle (lecture + écriture)
    const allowedRead = READ_TOOLS.filter((t) => perms[t.permission]);
    const allowedWrite = WRITE_TOOLS.filter((t) => perms[t.permission]);
    const toolDefs = [
      ...allowedRead.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      ...allowedWrite.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    ];

    const system = buildSystemPrompt(role);

    // ──────────── RÉPONSE EN STREAMING (SSE) ────────────
    // Haiku par défaut (rapide) ; on bascule sur Sonnet dès qu'une action
    // d'écriture est proposée (les opérations sensibles méritent plus de "réflexion").
    const convId = conversationId;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: Record<string, unknown>) => { try { controller.enqueue(sse(o)); } catch (_) { /* client parti */ } };
        let finalText = "";
        const usedTools: string[] = [];
        // deno-lint-ignore no-explicit-any
        const proposals: any[] = [];
        let model = MODEL_FAST;

        send({ type: "start", conversationId: convId });

        try {
          for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const resp = await streamAnthropic(
              apiKey,
              { model, max_tokens: 1500, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], tools: toolDefs, messages },
              (delta) => send({ type: "delta", text: delta }),
            );
            const content = resp.content ?? [];
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
                  try { result = await readTool.execute(admin, tu.input ?? {}); }
                  catch (e) { result = { error: String((e as Error)?.message ?? e) }; }
                } else if (writeTool) {
                  try {
                    const prep = await writeTool.prepare(admin, tu.input ?? {});
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
                results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
              }
              messages.push({ role: "user", content: results });
              continue;
            }

            // deno-lint-ignore no-explicit-any
            finalText = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
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
            details: { message: message.slice(0, 200), tools: usedTools, attachments: acceptedAttachments.length, proposals: proposals.length },
          }).then(() => {}, () => {});

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
