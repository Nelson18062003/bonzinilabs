// ============================================================================
// Tests Deno de la lecture d'une DAU (action read_dau) — sans réseau ni clé :
// un faux client Anthropic (stream().finalMessage()) et un faux Supabase.
//
//   CUSTOMS_AI_TEST=1 deno test --allow-env --allow-read --node-modules-dir=none \
//     supabase/functions/customs-ai/read.deno.ts
// ============================================================================
import type Anthropic from "npm:@anthropic-ai/sdk@0.129.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readJob, runReading, sanitizeExtraction } from "./index.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const ARTICLE_9 = {
  n: 9, code: "8418.21.00.0000", description: "REGULATEUR", origin: "CN", quantity: 1, gross_kg: 30, net_kg: null,
  customs_value_xaf: 150000, additional_code: null,
  taxes: [
    { code: "DDI", rate_pct: 30, amount_xaf: 45000 }, { code: "DEA", rate_pct: 1, amount_xaf: 1500 },
    { code: "TVA", rate_pct: 17.5, amount_xaf: 34388 }, { code: "cam", rate_pct: null, amount_xaf: 963 },
  ],
};
const DAU = {
  dau_number: "SDSD2-2026-IMP-020399-I", office: "SDSD2", regime: null, registered_on: "2026-09-17", paid_on: null,
  released: true, importer_name: "AWA IMPORT", importer_niu: null, declarant: "BNG TRANS SARL", total_taxes_xaf: 86202,
  articles: [ARTICLE_9], unreadable: [],
};

/** Un faux client : chaque lecture rend le message suivant (ou lève l'erreur donnée). */
function scripted(responses: (Partial<Anthropic.Beta.BetaMessage> | Error)[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const next = responses.shift();
          return {
            finalMessage: () => {
              if (!next) return Promise.reject(new Error("plus de réponse scriptée"));
              if (next instanceof Error) return Promise.reject(next);
              return Promise.resolve({ stop_reason: "tool_use", content: [], ...next });
            },
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const record = (input: unknown) => ({ content: [{ type: "tool_use", id: "t1", name: "record_dau", input }] }) as unknown as Partial<Anthropic.Beta.BetaMessage>;

Deno.test("la lecture nettoyée : codes en chiffres, taxes en majuscules, rien d'inventé", () => {
  const e = sanitizeExtraction({
    ...DAU, registered_on: "17/09/2026",
    articles: [ARTICLE_9, { ...ARTICLE_9, n: 10, code: "63" }, { ...ARTICLE_9, n: 11, taxes: [{ code: "DDI", rate_pct: 30, amount_xaf: -3 }] }],
  })!;
  assert(e.registered_on === null, "date non ISO refusée");
  assert(e.articles.length === 2, `un code de 2 chiffres n'est pas un article (${e.articles.length})`);
  assert(e.articles[0].code === "841821000000", `code : ${e.articles[0].code}`);
  assert(e.articles[0].taxes.some((t) => t.code === "CAM"), "codes de taxe en majuscules");
  assert(e.articles[1].taxes.length === 0, "montant négatif écarté");
  assert(sanitizeExtraction("pas une DAU") === null && sanitizeExtraction({ articles: "x" }) === null, "entrée inexploitable → null");
});

Deno.test("un appel diffusé, un seul outil, validé ici (eager_input_streaming)", async () => {
  const { client, calls } = scripted([record(DAU)]);
  const out = await runReading(client, [{ type: "text", text: "DAU" }]);
  assert(out.kind === "extraction" && out.extraction.articles[0].description === "REGULATEUR", "extraction");
  const req = calls[0] as { tools: { name: string; strict: boolean; eager_input_streaming: boolean }[]; tool_choice: { type: string }; max_tokens: number };
  assert(req.tools.length === 1 && req.tools[0].name === "record_dau" && req.tools[0].strict && req.tools[0].eager_input_streaming, "outil strict, diffusé");
  assert(req.tool_choice.type === "auto", "tool_choice auto (forcer est refusé avec la réflexion)");
});

Deno.test("refus et coupure : jamais d'extraction partielle", async () => {
  assert((await runReading(scripted([{ stop_reason: "refusal", content: [] }]).client, [])).kind === "refusal", "refus");
  // Une entrée coupée par max_tokens se lit souvent comme un objet valide : c'est stop_reason qui l'attrape.
  assert((await runReading(scripted([{ ...record(DAU), stop_reason: "max_tokens" }]).client, [])).kind === "truncated", "coupure");
});

Deno.test("une entrée illisible : une seconde lecture, puis on s'arrête", async () => {
  const ok = scripted([record({ articles: "illisible" }), record(DAU)]);
  assert((await runReading(ok.client, [])).kind === "extraction", "la seconde lecture passe");
  assert(ok.calls.length === 2, "deux appels");
  const ko = scripted([new SyntaxError("Unexpected token in tool input"), record({})]);
  assert((await runReading(ko.client, [])).kind === "invalid", "deux échecs → invalid");
});

/** Un faux Supabase : une pièce PDF dans le seau, et les mises à jour gardées. */
function fakeAdmin(files: Record<string, Blob>) {
  const updates: { values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const admin = {
    storage: { from: () => ({ download: (path: string) => Promise.resolve(files[path] ? { data: files[path], error: null } : { data: null, error: new Error("absent") }) }) },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const u = { values, filters: [] as [string, unknown][] };
        updates.push(u);
        const chain = { eq: (k: string, v: unknown) => { u.filters.push([k, v]); return chain; }, then: (r: (x: { error: null }) => void) => r({ error: null }) };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, updates };
}
const ROW = { id: "au-1", ref: "AU-000001", client_user_id: "u", file_paths: ["u/dau.pdf"], status: "reading", updated_at: "", dau_number: null, paid_on: null, claim_deadline: null };

Deno.test("la lecture complète : read, n° et dates recopiés, délai de 3 ans, constats remis à zéro", async () => {
  const { admin, updates } = fakeAdmin({ "u/dau.pdf": new Blob(["%PDF-1.4"], { type: "application/pdf" }) });
  const { client, calls } = scripted([record(DAU)]);
  await readJob(admin, client, ROW);
  const content = (calls[0] as { messages: { content: { type: string }[] }[] }).messages[0].content;
  assert(content[0].type === "document", "le PDF part en bloc document");
  const u = updates.at(-1)!;
  assert(u.values.status === "read", `statut : ${u.values.status}`);
  assert(u.values.dau_number === "SDSD2-2026-IMP-020399-I" && u.values.registered_on === "2026-09-17", "n° et date");
  assert(u.values.claim_deadline === "2029-09-17", `délai : ${u.values.claim_deadline}`);
  assert(Array.isArray(u.values.findings) && (u.values.findings as unknown[]).length === 0 && u.values.overpaid_xaf === null, "constats remis à zéro");
  assert(u.filters.some(([k, v]) => k === "status" && v === "reading"), "n'écrit que sur une lecture en cours");
});

Deno.test("sans pièce lisible ou sans article : failed, avec une phrase pour le client", async () => {
  const empty = fakeAdmin({ "u/dau.pdf": new Blob(["x"], { type: "application/zip" }) });
  await readJob(empty.admin, scripted([]).client, ROW);
  assert(empty.updates.at(-1)!.values.status === "failed" && String(empty.updates.at(-1)!.values.error).includes("PDF"), "pièce illisible");

  const noArticle = fakeAdmin({ "u/dau.pdf": new Blob(["%PDF"], { type: "application/pdf" }) });
  await readJob(noArticle.admin, scripted([record({ ...DAU, articles: [], unreadable: ["Ce document est une facture, pas une DAU."] })]).client, ROW);
  assert(noArticle.updates.at(-1)!.values.error === "Ce document est une facture, pas une DAU.", "la raison du modèle est rendue");
});
