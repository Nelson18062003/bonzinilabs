// RUNNER QUALITÉ Mola — la BOUCLE, en un script. DÉPLOIEMENT / CI uniquement (Deno).
//
//   HARVEST (vraies conversations, LECTURE SEULE)
//        → JUDGE (juge-LLM sur la grille métier)
//        → REPORT (Markdown : score, axe faible, thèmes robotiques, à promouvoir)
//
// ⚠️ Ne tourne PAS dans le sandbox de conception : nécessite la base + une clé Anthropic.
// La logique notée (judge.ts / report.ts) est PURE et testée ici via judge.test.ts.
//
// Lancer :
//   export SUPABASE_URL=https://fmhsohrgbznqmcvqktjw.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=...     # lecture assistant_messages + audit
//   export ANTHROPIC_API_KEY=...             # le juge
//   export JUDGE_MODEL=claude-sonnet-4-6     # optionnel (défaut ci-dessous)
//   export HARVEST_DAYS=14                    # optionnel : fenêtre de récolte
//   export HARVEST_LIMIT=120                  # optionnel : nb max d'échantillons
//   deno run --allow-net --allow-env --allow-write eval/assistant/quality-run.ts
//
// Sortie : eval/assistant/reports/quality-<date>.md (+ résumé console).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildJudgeSystem, buildJudgeUser, parseJudgeVerdict,
  type JudgeSample, type JudgeVerdict,
} from "./judge.ts";
import { renderReport } from "./report.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const JUDGE_MODEL = Deno.env.get("JUDGE_MODEL") ?? "claude-sonnet-4-6";
const HARVEST_DAYS = Number(Deno.env.get("HARVEST_DAYS") ?? "14");
const HARVEST_LIMIT = Number(Deno.env.get("HARVEST_LIMIT") ?? "120");

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

/** Texte lisible depuis le content jsonb d'un assistant_message (formats tolérés). */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === "string" ? b : (b?.text ?? ""))).join(" ").trim();
  }
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.text === "string") return c.text;
    if (typeof c.content === "string") return c.content;
  }
  return "";
}

/** HARVEST : reconstruit des paires (question admin → réponse Mola) depuis la base. */
async function harvest(): Promise<{ samples: JudgeSample[]; corpus: string }> {
  const since = new Date(Date.now() - HARVEST_DAYS * 86400_000).toISOString();

  // Rôles des admins (pour contextualiser le juge).
  const { data: roles } = await admin.from("user_roles").select("user_id, role");
  const roleOf = new Map<string, string>((roles ?? []).map((r: Record<string, unknown>) => [String(r.user_id), String(r.role ?? "admin")]));

  // Outils réellement appelés par conversation (depuis l'audit).
  const { data: logs } = await admin.from("admin_audit_logs")
    .select("target_id, details").eq("action_type", "assistant_query").gte("created_at", since);
  const toolsOf = new Map<string, Set<string>>();
  for (const row of logs ?? []) {
    const conv = String((row as Record<string, unknown>).target_id ?? "");
    const d = ((row as Record<string, unknown>).details ?? {}) as { tools?: string[] };
    const set = toolsOf.get(conv) ?? new Set<string>();
    for (const t of d.tools ?? []) set.add(t);
    toolsOf.set(conv, set);
  }

  const { data: convs } = await admin.from("assistant_conversations")
    .select("id, admin_user_id").gte("updated_at", since)
    .order("updated_at", { ascending: false }).limit(400);

  const samples: JudgeSample[] = [];
  for (const c of convs ?? []) {
    const convId = String((c as Record<string, unknown>).id);
    const role = roleOf.get(String((c as Record<string, unknown>).admin_user_id)) ?? "admin";
    const { data: msgs } = await admin.from("assistant_messages")
      .select("role, content, created_at").eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    // Apparier chaque message user avec la réponse assistant qui suit.
    let pendingQ: string | null = null;
    let turn = 0;
    for (const m of msgs ?? []) {
      const r = String((m as Record<string, unknown>).role);
      const text = extractText((m as Record<string, unknown>).content);
      if (r === "user") pendingQ = text;
      else if (r === "assistant" && pendingQ && text) {
        samples.push({
          id: `${convId}:${turn++}`,
          role,
          question: pendingQ,
          answer: text,
          toolsUsed: [...(toolsOf.get(convId) ?? [])],
        });
        pendingQ = null;
      }
      if (samples.length >= HARVEST_LIMIT) break;
    }
    if (samples.length >= HARVEST_LIMIT) break;
  }
  return { samples, corpus: `${HARVEST_DAYS}j derniers, ${samples.length} tours réels` };
}

async function judgeOne(s: JudgeSample): Promise<JudgeVerdict> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 400,
      system: [{ type: "text", text: buildJudgeSystem(), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildJudgeUser(s) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = (data.content ?? []).map((b: Record<string, unknown>) => b.text ?? "").join("");
  return parseJudgeVerdict(s.id, raw);
}

async function main() {
  console.log(`Récolte (${HARVEST_DAYS}j, max ${HARVEST_LIMIT})…`);
  const { samples, corpus } = await harvest();
  if (samples.length === 0) { console.log("Aucun échantillon — rien à juger."); return; }
  console.log(`${samples.length} tours à juger via ${JUDGE_MODEL}…`);

  const byId = new Map(samples.map((s) => [s.id, s]));
  const verdicts: JudgeVerdict[] = [];
  // Concurrence modérée pour ne pas saturer l'API.
  const BATCH = 5;
  for (let i = 0; i < samples.length; i += BATCH) {
    const slice = samples.slice(i, i + BATCH);
    const out = await Promise.all(slice.map((s) => judgeOne(s).catch((e) => {
      console.warn(`  juge KO ${s.id}: ${e.message}`);
      return parseJudgeVerdict(s.id, ""); // verdict neutre, ne casse pas le run
    })));
    verdicts.push(...out);
    console.log(`  ${Math.min(i + BATCH, samples.length)}/${samples.length}`);
  }

  const md = renderReport(verdicts, byId, { generatedAt: new Date().toISOString(), corpus });
  const date = new Date().toISOString().slice(0, 10);
  try { await Deno.mkdir(new URL("./reports/", import.meta.url), { recursive: true }); } catch { /* existe déjà */ }
  const out = new URL(`./reports/quality-${date}.md`, import.meta.url);
  await Deno.writeTextFile(out, md);
  console.log(`\nRapport écrit : ${out.pathname}`);
  console.log(md.split("\n").slice(0, 12).join("\n"));
}

if (import.meta.main) main();
