// ============================================================================
// Tests Deno de customs-ai — sans réseau ni clé : un faux client Anthropic
// rejoue des réponses écrites à l'avance, la nomenclature est lue sur disque.
//
//   CUSTOMS_AI_TEST=1 deno test --allow-env --allow-read --node-modules-dir=none \
//     supabase/functions/customs-ai/classify.deno.ts
//
// (Nommé *.deno.ts pour que Vitest ne le ramasse pas.)
// ============================================================================
import type Anthropic from "npm:@anthropic-ai/sdk@0.129.0";
import {
  buildNomenclature, cleanProposal, listHeading, renderFile, runClassification, searchTariff,
  type Classification, type Nomenclature,
} from "./index.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const raw = JSON.parse(await Deno.readTextFile(new URL("../../../public/data/customs/nomenclature-cm.v1.json", import.meta.url)));
const nom: Nomenclature = buildNomenclature(raw);

/** Un faux client : chaque appel rend la réponse suivante, et garde la requête. */
function scripted(responses: Partial<Anthropic.Beta.BetaMessage>[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: (params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("plus de réponse scriptée");
          return Promise.resolve({ stop_reason: "tool_use", content: [], ...next });
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as Anthropic.Beta.BetaContentBlock;

Deno.test("la nomenclature : 5 612 sous-positions, recherche par mots et par code", () => {
  assert(nom.lines.length === 5612, `lignes : ${nom.lines.length}`);
  const words = searchTariff(nom, "convertisseurs statiques").map((r) => r.code);
  assert(words.includes("850440"), `8504.40 attendu dans ${words}`);
  const byCode = searchTariff(nom, "8504").map((r) => r.code);
  assert(byCode.every((c) => c.startsWith("8504")) && byCode.length > 5, "recherche par code");
  const h = listHeading(nom, "9401") as { sous_positions: { code: string }[] };
  assert(h.sous_positions.some((l) => l.code === "940180"), "list_heading 9401");
  assert("erreur" in listHeading(nom, "9999"), "position inconnue signalée");
});

Deno.test("le tour : recherche → lecture de la position → proposition", async () => {
  const { client, calls } = scripted([
    { content: [toolUse("t1", "search_tariff", { query: "convertisseurs statiques" })] },
    { content: [toolUse("t2", "list_heading", { heading: "8504" })] },
    {
      content: [toolUse("t3", "propose_codes", {
        summary: "Un stabilisateur de tension est un convertisseur statique (85.04), pas un appareil frigorifique.",
        candidates: [
          { code: "8504.40", confidence: 0.82, reasoning: "RGI 1 : fonction électrique.", rules: ["RGI 1", "RGI 6"] },
          { code: "903289", confidence: 0.3, reasoning: "Si c'est un régulateur automatique.", rules: ["RGI 1"] },
          { code: "999999", confidence: 0.9, reasoning: "inventé", rules: [] },
        ],
        missing_facts: ["Est-ce un stabilisateur à servomoteur ?"],
      })],
    },
  ]);
  const out = await runClassification(client, nom, [{ type: "text", text: "Fiche" }]);
  assert(out.kind === "proposal", `proposition attendue, reçu ${out.kind}`);
  assert(calls.length === 3, `3 appels, reçu ${calls.length}`);

  // Chaque appel : Opus, pensée adaptative, effort explicite, secours serveur, pas d'outil forcé.
  const first = calls[0] as { model: string; thinking: { type: string }; output_config: { effort: string }; tool_choice: { type: string }; fallbacks: string; betas: string[] };
  assert(first.thinking.type === "adaptive", "pensée adaptative");
  assert(first.output_config.effort === "high", "effort explicite");
  assert(first.tool_choice.type === "auto", "jamais de tool_choice forcé (400 sur Opus 5.5)");
  assert(first.fallbacks === "default" && first.betas.includes("server-side-fallback-2026-07-01"), "secours serveur activé");

  // Le deuxième appel porte le résultat de la recherche, en tool_result.
  const second = calls[1] as { messages: { role: string; content: { type: string; tool_use_id?: string; content?: string }[] }[] };
  const results = second.messages[second.messages.length - 1];
  assert(results.role === "user" && results.content[0].type === "tool_result" && results.content[0].tool_use_id === "t1", "tool_result du tour 1");
  assert(String(results.content[0].content).includes("850440"), "la recherche a trouvé 8504.40");

  const clean = cleanProposal(nom, out.proposal);
  assert(clean.candidates.length === 2, "le code inventé est écarté");
  assert(clean.candidates[0].code === "850440", "le point est retiré du code");
  assert(clean.candidates[0].rate_max === 10, "le taux vient de la nomenclature, pas du modèle");
  assert(clean.candidates[0].heading?.startsWith("Transformateurs"), "la position est jointe");
});

Deno.test("une question au client termine le tour", async () => {
  const { client } = scripted([{ content: [toolUse("q", "ask_client", { question: "Les chaises sont-elles rembourrées ?", options: ["Oui", "Non"], why: "9401.71 contre 9401.79" })] }]);
  const out = await runClassification(client, nom, [{ type: "text", text: "Fiche" }]);
  assert(out.kind === "question" && out.question.options.length === 2, "question avec deux choix");
});

Deno.test("une réponse sans outil final devient une question", async () => {
  const { client } = scripted([{ stop_reason: "end_turn", content: [{ type: "text", text: "Quelle est la matière ?" } as Anthropic.Beta.BetaContentBlock] }]);
  const out = await runClassification(client, nom, [{ type: "text", text: "Fiche" }]);
  assert(out.kind === "question" && out.question.question === "Quelle est la matière ?", "texte → question");
});

Deno.test("un refus du modèle est rendu tel quel, sans code", async () => {
  const { client } = scripted([{ stop_reason: "refusal", content: [] }]);
  const out = await runClassification(client, nom, [{ type: "text", text: "Fiche" }]);
  assert(out.kind === "refusal", "refus");
});

Deno.test("la fiche rendue au modèle : produit, faits, conversation, langue", () => {
  const c: Classification = {
    id: "x", ref: "CL-000042", client_user_id: "u", product_name: "Régulateur", description: "5 kVA, 30 kg",
    facts: { usage: "domestique" }, photo_paths: [], status: "draft",
  };
  const text = renderFile(c, [
    { author: "client", body: "5 kVA, 30 kg", payload: null },
    { author: "assistant", body: "Est-ce à servomoteur ?", payload: { options: ["Oui", "Non"] } },
    { author: "broker", body: "Précisez la marque.", payload: null },
  ], "en", [{ code: "850440", tip: "Un régulateur n'est pas un réfrigérateur." }]);
  for (const piece of ["CL-000042", "Régulateur", "domestique", "choix proposés : Oui / Non", "Commissionnaire agréé", "anglais", "850440 — Un régulateur", "à vérifier"]) {
    assert(text.includes(piece), `la fiche contient « ${piece} »`);
  }
});
