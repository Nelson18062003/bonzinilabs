// Runner d'eval LIVE — DÉPLOIEMENT / CI UNIQUEMENT.
// Rejoue chaque cas contre la fonction `admin-assistant` DÉPLOYÉE, puis note via le grader pur.
// ⚠️ Ne tourne PAS dans le sandbox de conception : nécessite la fonction déployée + des JWT de test.
//
// Lancer :  deno run --allow-net --allow-env eval/assistant/run.ts
// Env requis :
//   SUPABASE_URL                 (ex. https://fmhsohrgbznqmcvqktjw.supabase.co)
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY    (pour lire audit + assistant_pending_actions)
//   EVAL_JWTS                    JSON { "super_admin":"<jwt>", "ops":"<jwt>", "support":"<jwt>", ... }
//                                (JWT d'admins de TEST par rôle ; un cas dont le rôle manque est SKIP)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cases } from "./cases.ts";
import { gradeCase, summarize, type ActualRun, type ProposalView } from "./grade.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/admin-assistant`;
const JWTS: Record<string, string> = JSON.parse(Deno.env.get("EVAL_JWTS") ?? "{}");

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

interface TurnResult { conversationId: string | null; finalText: string; proposals: { id: string; tool: string }[]; }

async function sendTurn(jwt: string, conversationId: string | null, message: string): Promise<TurnResult> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}`, "apikey": ANON },
    body: JSON.stringify({ conversationId, message, attachments: [] }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let finalText = "";
  let convId: string | null = conversationId;
  const proposals: { id: string; tool: string }[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload) continue;
      let ev: { type: string; text?: string; conversationId?: string; proposal?: { id: string; tool: string } };
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "start" && ev.conversationId) convId = ev.conversationId;
      else if (ev.type === "delta" && ev.text) finalText += ev.text;
      else if (ev.type === "proposal" && ev.proposal?.id) proposals.push({ id: ev.proposal.id, tool: ev.proposal.tool });
    }
  }
  return { conversationId: convId, finalText, proposals };
}

/** Reconstruit l'ActualRun depuis la base (audit → outils/coût ; pending_actions → args). */
async function collectActual(convId: string, finalText: string, proposalRefs: { id: string; tool: string }[]): Promise<{ actual: ActualRun; costUsd: number }> {
  const { data: logs } = await admin.from("admin_audit_logs")
    .select("details").eq("target_id", convId).eq("action_type", "assistant_query");
  const toolsUsed = new Set<string>();
  let costUsd = 0;
  for (const row of logs ?? []) {
    const d = (row.details ?? {}) as { tools?: string[]; est_cost_usd?: number };
    for (const t of d.tools ?? []) toolsUsed.add(t);
    costUsd += Number(d.est_cost_usd ?? 0);
  }
  const proposals: ProposalView[] = [];
  if (proposalRefs.length) {
    const { data: pas } = await admin.from("assistant_pending_actions")
      .select("id, tool, args").in("id", proposalRefs.map((p) => p.id));
    for (const pa of pas ?? []) proposals.push({ tool: pa.tool as string, args: (pa.args ?? {}) as Record<string, unknown> });
  }
  return { actual: { finalText, toolsUsed: [...toolsUsed], proposals }, costUsd };
}

async function main() {
  const results = [];
  let totalCost = 0, skipped = 0;
  for (const c of cases) {
    const jwt = JWTS[c.role];
    if (!jwt) { console.warn(`SKIP ${c.id} — pas de JWT pour le rôle "${c.role}"`); skipped++; continue; }
    try {
      let convId: string | null = null;
      let lastText = "";
      const proposalRefs: { id: string; tool: string }[] = [];
      for (const turn of c.turns) {
        const tr = await sendTurn(jwt, convId, turn);
        convId = tr.conversationId; lastText = tr.finalText;
        proposalRefs.push(...tr.proposals);
      }
      const { actual, costUsd } = await collectActual(convId!, lastText, proposalRefs);
      totalCost += costUsd;
      const g = gradeCase(c, actual);
      results.push(g);
      console.log(`${g.pass ? "✅" : "❌"} ${c.id} [${c.family}]` + (g.pass ? "" : `\n   ${g.failures.join("\n   ")}`));
    } catch (e) {
      results.push({ id: c.id, family: c.family, pass: false, failures: [`erreur runner: ${String((e as Error)?.message ?? e)}`] });
      console.log(`❌ ${c.id} — erreur: ${String((e as Error)?.message ?? e)}`);
    }
  }
  const s = summarize(results);
  console.log("\n──────── RÉSUMÉ ────────");
  console.log(`Total: ${s.total}  ✅ ${s.passed}  ❌ ${s.failed}  (skip: ${skipped})`);
  for (const [fam, v] of Object.entries(s.byFamily)) console.log(`  ${fam}: ${v.passed}/${v.total}`);
  console.log(`Coût estimé du run : ~$${totalCost.toFixed(4)}`);
  if (s.failed > 0) Deno.exit(1);
}

if (import.meta.main) main();
