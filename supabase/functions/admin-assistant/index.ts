// Edge Function: admin-assistant
// "Directeur des Opérations" IA — Phase 0 + Phase 1 (LECTURE SEULE).
//
// - Vérifie que l'appelant est un admin actif (via son JWT).
// - Détient la clé ANTHROPIC_API_KEY (secret) — jamais exposée au frontend.
// - Boucle agentique avec des OUTILS de LECTURE uniquement, filtrés par les
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
const MAX_TOOL_ITERATIONS = 6;

// Permissions par rôle — miroir (sous-ensemble lecture) de src/contexts/AdminAuthContext.tsx
type PermKey = "canViewClients" | "canViewDeposits" | "canViewPayments" | "canViewTreasury" | "canViewLogs";
const ROLE_PERMISSIONS: Record<string, Record<PermKey, boolean>> = {
  super_admin:      { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: true,  canViewLogs: true },
  ops:              { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: true },
  support:          { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: true },
  customer_success: { canViewClients: true,  canViewDeposits: true,  canViewPayments: true,  canViewTreasury: false, canViewLogs: false },
  cash_agent:       { canViewClients: false, canViewDeposits: false, canViewPayments: true,  canViewTreasury: false, canViewLogs: false },
  treasurer:        { canViewClients: false, canViewDeposits: false, canViewPayments: false, canViewTreasury: true,  canViewLogs: false },
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
  {
    name: "search_clients",
    permission: "canViewClients",
    description: "Rechercher des clients par nom, prénom, téléphone ou entreprise. Renvoie une liste (id, user_id, nom, téléphone, pays, statut KYC).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme de recherche (nom, prénom, téléphone, entreprise)" },
        limit: { type: "number", description: "Nombre max de résultats (défaut 10)" },
      },
      required: ["query"],
    },
    execute: async (admin, { query, limit }) => {
      const term = `%${String(query ?? "").trim()}%`;
      const { data, error } = await admin
        .from("clients")
        .select("id, user_id, first_name, last_name, phone, company_name, country, status, kyc_verified")
        .or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},company_name.ilike.${term}`)
        .limit(Math.min(Number(limit) || 10, 25));
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, clients: data ?? [] };
    },
  },
  {
    name: "get_wallet_balance",
    permission: "canViewClients",
    description: "Obtenir le solde du portefeuille (wallet) d'un client à partir de son user_id.",
    input_schema: {
      type: "object",
      properties: { client_user_id: { type: "string", description: "user_id du client" } },
      required: ["client_user_id"],
    },
    execute: async (admin, { client_user_id }) => {
      const { data, error } = await admin
        .from("wallets")
        .select("balance_xaf, user_id")
        .eq("user_id", client_user_id)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { found: false };
      return { found: true, balance_xaf: data.balance_xaf, balance_formatted: fmtXAF(data.balance_xaf) };
    },
  },
  {
    name: "list_deposits",
    permission: "canViewDeposits",
    description: "Lister les derniers dépôts, optionnellement filtrés par statut (created, awaiting_proof, proof_submitted, admin_review, validated, rejected, cancelled).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtre de statut (optionnel)" },
        limit: { type: "number", description: "Nombre max (défaut 10)" },
      },
    },
    execute: async (admin, { status, limit }) => {
      let q = admin
        .from("deposits")
        .select("reference, amount_xaf, confirmed_amount_xaf, method, status, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 10, 25));
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, deposits: data ?? [] };
    },
  },
  {
    name: "list_payments",
    permission: "canViewPayments",
    description: "Lister les derniers paiements fournisseurs, optionnellement filtrés par statut (created, waiting_beneficiary_info, ready_for_payment, processing, completed, rejected, cash_pending, cash_scanned).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtre de statut (optionnel)" },
        limit: { type: "number", description: "Nombre max (défaut 10)" },
      },
    },
    execute: async (admin, { status, limit }) => {
      let q = admin
        .from("payments")
        .select("reference, amount_xaf, amount_rmb, method, status, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 10, 25));
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length ?? 0, payments: data ?? [] };
    },
  },
  {
    name: "get_daily_rate",
    permission: "canViewPayments",
    description: "Obtenir le taux du jour actif. Les taux sont exprimés en CNY (¥) pour 1 000 000 XAF, par mode (cash, alipay, wechat, virement).",
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
        .from("deposits")
        .select("amount_xaf, confirmed_amount_xaf, status, created_at")
        .gte("created_at", since)
        .limit(2000);
      if (e1) return { error: e1.message };
      const { data: pays, error: e2 } = await admin
        .from("payments")
        .select("amount_xaf, status, created_at")
        .gte("created_at", since)
        .limit(2000);
      if (e2) return { error: e2.message };

      const validated = (deps ?? []).filter((d: AnyClient) => d.status === "validated");
      const depositVolume = validated.reduce(
        (s: number, d: AnyClient) => s + Number(d.confirmed_amount_xaf ?? d.amount_xaf ?? 0), 0);
      const paymentVolume = (pays ?? []).reduce(
        (s: number, p: AnyClient) => s + Number(p.amount_xaf ?? 0), 0);
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
];

function buildSystemPrompt(role: string): string {
  return [
    `Tu es l'assistant "Directeur des Opérations" de BonziniLabs, une fintech qui permet aux importateurs africains de régler leurs fournisseurs chinois en XAF.`,
    `Tu assistes un administrateur (rôle: ${role}). Réponds en français, de façon concise, claire et professionnelle.`,
    ``,
    `CAPACITÉS ACTUELLES : LECTURE SEULE. Tu peux consulter et répondre à toute question sur la plateforme (clients, dépôts, paiements, taux du jour, statistiques) grâce à tes outils. Tu ne peux PAS encore créer, modifier, valider ou supprimer quoi que ce soit — ces actions arriveront prochainement. Si on te demande une action d'écriture, explique poliment qu'elle n'est pas encore activée.`,
    ``,
    `RÈGLES :`,
    `- N'invente JAMAIS de chiffres ni de données : utilise systématiquement tes outils pour obtenir les valeurs réelles, puis cite-les.`,
    `- Formate les montants en XAF avec séparateurs (ex : 10 000 000 XAF).`,
    `- Les taux du jour sont exprimés en CNY (¥) pour 1 000 000 XAF.`,
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
        .from("assistant_conversations")
        .select("id, admin_user_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || conv.admin_user_id !== user.id) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await admin
        .from("assistant_conversations")
        .insert({ admin_user_id: user.id, title: message.slice(0, 60) })
        .select("id")
        .single();
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
        max_tokens: 1024,
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
