// ============================================================================
// customs-ai — l'assistant de classement douanier (docs/douane/00-plan.md, étape 4).
//
// Le « AI customs classification engine » de Flexport, pour le Cameroun : le
// client décrit son produit (et le photographie), l'IA pose UNE question quand
// un fait décide du code (matière, usage, neuf/usagé, puissance…), puis propose
// deux ou trois codes SH vérifiés dans la nomenclature, avec les règles
// générales d'interprétation (RGI) qui les fondent. Elle ne signe jamais : le
// commissionnaire agréé en douane (CAD) valide ou change le code
// (customs_classification_decide, migration 20260929120000).
//
// POST { action: "classify", classification_id }
//   Appelant : le client propriétaire de la fiche, ou l'équipe (canViewCustoms).
//   Statut : draft ou needs_info — l'IA se tait pendant que le CAD relit.
//   Écrit (clé de service) : un message « assistant » ; sur proposition, les
//   candidats et le code proposé.
//
// Les codes proposés sont VÉRIFIÉS dans la nomenclature publiée par le site
// (public/data/customs/nomenclature-cm.v1.json) ; un code inventé est écarté.
// Le taux de chaque candidat vient de la nomenclature, jamais du modèle.
//
// POST { action: "read_dau", audit_id }  (étape 5 — « Vérifier ma déclaration »)
//   L'IA RECOPIE la DAU (PDF ou photos) article par article : code, désignation,
//   valeur, taxes imprimées. Elle ne juge rien : le moteur de l'app
//   (src/lib/customs/audit.ts) recalcule, et le CAD relit.
//   Appelant : le client propriétaire, ou l'équipe (canViewCustoms).
//   Statut : uploaded, read ou failed (ou reading bloqué depuis 7 min).
//   Répond 202 tout de suite ; la lecture continue (EdgeRuntime.waitUntil) et
//   écrit reading → read (extraction, n°, bureau, dates) ou failed (error).
//
// Fichier autonome (sans _shared) : déployable depuis l'éditeur du dashboard.
// Secrets : ANTHROPIC_API_KEY. Optionnels : CUSTOMS_AI_MODEL, CUSTOMS_AI_EFFORT,
// CUSTOMS_AI_READ_EFFORT (défaut medium : recopier n'est pas raisonner),
// SITE_URL (défaut https://www.bonzinilabs.com).
// ============================================================================
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = Deno.env.get("CUSTOMS_AI_MODEL") ?? "claude-opus-5-5";
const EFFORT = (Deno.env.get("CUSTOMS_AI_EFFORT") ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
const SITE = (Deno.env.get("SITE_URL") ?? "https://www.bonzinilabs.com").replace(/\/+$/, "");
/** Garde-fou de coût : tours de l'assistant par fiche. */
const MAX_ASSISTANT_TURNS = 30;
/** Tours d'outils par appel (recherche, lecture d'une position) avant de conclure. */
const MAX_TOOL_ROUNDS = 8;
const MAX_PHOTOS = 4;
const READ_EFFORT = (Deno.env.get("CUSTOMS_AI_READ_EFFORT") ?? "medium") as typeof EFFORT;
/** Les pièces d'une DAU, toutes ensemble : sous la limite d'une requête (32 Mo encodés). */
const MAX_DAU_BYTES = 18 * 1024 * 1024;
/** Une lecture qui n'a rien écrit depuis 7 min est morte (limite d'exécution dépassée). */
const STALE_READING_MS = 7 * 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ─── La nomenclature ────────────────────────────────────────────────────────

export interface Line { code: string; fr: string; en: string; rateMin: number | null; rateMax: number | null }
export interface Nomenclature {
  lines: Line[];
  byCode: Map<string, Line>;
  headings: Map<string, string>;
  chapters: Map<string, string>;
  words: Map<string, Set<number>>;
  vocab: string[];
}

const STOP = new Set(["de", "du", "des", "la", "le", "les", "en", "et", "ou", "pour", "a", "au", "aux", "un", "une", "d", "l", "the", "of", "for", "and", "with", "avec", "sans", "sur", "par", "autres", "autre", "other"]);
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const stem = (w: string) => (w.length > 4 && w.endsWith("aux") ? w.slice(0, -1) : w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
const tokens = (s: string) => normalize(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

type RawNomenclature = {
  chapters: [string, string, string, string][];
  headings: [string, string, string][];
  lines: [string, string, string, number | null, number | null, number | null][];
};

export function buildNomenclature(raw: RawNomenclature): Nomenclature {
  const lines = raw.lines.map(([code, fr, en, rateMin, rateMax]) => ({ code, fr, en, rateMin, rateMax }));
  const headings = new Map(raw.headings.map(([c, fr]) => [c, fr]));
  const words = new Map<string, Set<number>>();
  lines.forEach((l, i) => {
    for (const w of new Set(tokens(`${l.fr} ${l.en} ${headings.get(l.code.slice(0, 4)) ?? ""}`))) {
      let set = words.get(w);
      if (!set) words.set(w, (set = new Set()));
      set.add(i);
    }
  });
  return {
    lines, byCode: new Map(lines.map((l) => [l.code, l])), headings,
    chapters: new Map(raw.chapters.map(([c, fr]) => [c, fr])), words, vocab: [...words.keys()],
  };
}

let nomPromise: Promise<Nomenclature> | null = null;
function loadNomenclature(): Promise<Nomenclature> {
  nomPromise ??= (async () => {
    const res = await fetch(`${SITE}/data/customs/nomenclature-cm.v1.json`);
    if (!res.ok) throw new Error(`nomenclature HTTP ${res.status}`);
    return buildNomenclature(await res.json() as RawNomenclature);
  })().catch((e) => { nomPromise = null; throw e; });
  return nomPromise;
}

const rateText = (l: Line) => l.rateMax == null ? "taux non publié" : l.rateMin !== l.rateMax ? `${l.rateMin}–${l.rateMax} %` : `${l.rateMax} %`;
const lineOut = (nom: Nomenclature, l: Line) => ({
  code: l.code, libelle: l.fr, position: `${l.code.slice(0, 4)} — ${nom.headings.get(l.code.slice(0, 4)) ?? ""}`, droit_de_douane: rateText(l),
});

export function searchTariff(nom: Nomenclature, query: string, limit = 15) {
  const digits = query.replace(/[\s.]/g, "");
  if (/^\d{2,12}$/.test(digits)) {
    const p = digits.slice(0, 6);
    return nom.lines.filter((l) => l.code.startsWith(p)).slice(0, limit * 2).map((l) => lineOut(nom, l));
  }
  const q = [...new Set(tokens(query))];
  const scores = new Map<number, { n: number; w: number }>();
  for (const t of q) {
    const docs = new Set<number>();
    for (const w of t.length >= 3 ? nom.vocab.filter((v) => v.startsWith(t)) : [t]) nom.words.get(w)?.forEach((i) => docs.add(i));
    if (!docs.size) continue;
    const idf = Math.log(1 + nom.lines.length / docs.size);
    docs.forEach((i) => { const s = scores.get(i) ?? { n: 0, w: 0 }; s.n++; s.w += idf; scores.set(i, s); });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].w - a[1].w)
    .slice(0, limit)
    .map(([i]) => lineOut(nom, nom.lines[i]));
}

export function listHeading(nom: Nomenclature, heading: string) {
  const h = heading.replace(/\D/g, "").slice(0, 4);
  if (h.length !== 4 || !nom.headings.has(h)) return { erreur: `Position ${heading} inconnue du SH 2022.` };
  return {
    position: h, libelle: nom.headings.get(h), chapitre: `${h.slice(0, 2)} — ${nom.chapters.get(h.slice(0, 2)) ?? ""}`,
    sous_positions: nom.lines.filter((l) => l.code.startsWith(h)).map((l) => ({ code: l.code, libelle: l.fr, droit_de_douane: rateText(l) })),
  };
}

// ─── Le modèle ──────────────────────────────────────────────────────────────

const SYSTEM = `Tu es l'assistant de classement douanier de Bonzini Labs, au service d'importateurs camerounais qui achètent en Chine.

Ta mission : trouver la sous-position du Système harmonisé (SH 2022, 6 chiffres) de la marchandise décrite, telle que la douane camerounaise (CAMCIS, tarif CEMAC/CEEAC) la classerait. Tu ne signes jamais : un commissionnaire agréé en douane (CAD) validera ou changera ton code. Dis-le quand c'est utile, sans t'excuser.

Méthode, dans cet ordre :
1. Identifie ce qu'est RÉELLEMENT la marchandise (fonction, matière, état neuf ou usagé, présentation), pas le mot commercial. Les erreurs qui coûtent au Cameroun viennent du classement par ressemblance de mots : un « régulateur » de tension n'est pas un réfrigérateur (85.04, pas 84.18) ; une chaise est un siège (94.01), jamais un « autre meuble » (94.03) ; des vêtements NEUFS ne sont pas de la friperie (6309 = usagés) ; un tracteur AGRICOLE a sa ligne propre (le CGI nomme 870190.11) ; mèches et perruques relèvent du 67.04.
2. Applique les règles générales d'interprétation (RGI) : RGI 1 (libellés des positions et notes de section et de chapitre) d'abord ; RGI 2 a) articles incomplets ou non montés, 2 b) mélanges ; RGI 3 a) la position la plus spécifique, 3 b) le caractère essentiel, 3 c) la dernière dans l'ordre numérique ; RGI 4 analogie ; RGI 5 emballages ; RGI 6 pour choisir la sous-position. Cite celles que tu utilises.
3. VÉRIFIE avec les outils : search_tariff pour trouver les positions, list_heading pour lire toutes les sous-positions d'une position avant de choisir. N'avance jamais un code que les outils ne t'ont pas montré.
4. Conclus par UN appel d'outil final :
   - ask_client si un fait qui CHANGE le code manque (matière, usage, source d'énergie, puissance en kW, cylindrée, neuf ou usagé, composition, présentation au détail…). Une seule question, courte, avec 2 à 5 réponses possibles quand c'est un choix. Ne pose pas de question dont la réponse ne changerait pas le code.
   - propose_codes sinon : 1 à 3 candidats, le plus probable d'abord, chacun avec son raisonnement (2 à 4 phrases, en citant les RGI et les notes utiles) et une confiance entre 0 et 1 honnête. Si un fait manque encore mais que deux codes restent possibles, propose les deux et nomme le fait dans missing_facts.

Règles d'écriture : phrases courtes, vocabulaire d'un importateur, pas de jargon sans l'expliquer. Ne donne aucun montant de droits (l'application les calcule). Réponds dans la langue demandée dans la fiche.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_tariff",
    description: "Cherche dans la nomenclature SH 2022 du Cameroun, par mots (français ou anglais) ou par début de code (2 à 6 chiffres). Renvoie les sous-positions à 6 chiffres, leur position, et le droit de douane appliqué.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Mots du libellé (« stabilisateur tension », « sièges ») ou code (« 8504 »)." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_heading",
    description: "Liste TOUTES les sous-positions d'une position à 4 chiffres, avec le libellé de la position et du chapitre. À utiliser avant de choisir une sous-position (RGI 6).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { heading: { type: "string", description: "Position à 4 chiffres, ex. « 8504 »." } },
      required: ["heading"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_client",
    description: "Outil final : pose au client UNE question sur un fait qui change le code. Termine le tour.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "La question, courte, dans la langue du client." },
        options: { type: "array", items: { type: "string" }, description: "0 à 5 réponses possibles, courtes. Vide pour une réponse libre." },
        why: { type: "string", description: "En une phrase : pourquoi ce fait change le code." },
      },
      required: ["question", "options", "why"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_codes",
    description: "Outil final : propose 1 à 3 codes SH à 6 chiffres vérifiés avec search_tariff ou list_heading. Termine le tour.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Deux ou trois phrases pour le client : ce qu'est la marchandise pour la douane, et le code retenu." },
        candidates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string", description: "Sous-position à 6 chiffres, sans point." },
              confidence: { type: "number", description: "Entre 0 et 1." },
              reasoning: { type: "string", description: "2 à 4 phrases : pourquoi ce code, en citant les RGI et notes." },
              rules: { type: "array", items: { type: "string" }, description: "Ex. « RGI 1 », « RGI 3 b) », « Note 2 du chapitre 85 »." },
            },
            required: ["code", "confidence", "reasoning", "rules"],
            additionalProperties: false,
          },
        },
        missing_facts: { type: "array", items: { type: "string" }, description: "Les faits qui départageraient encore les candidats. Vide si aucun." },
      },
      required: ["summary", "candidates", "missing_facts"],
      additionalProperties: false,
    },
    cache_control: { type: "ephemeral" },
  },
];

export interface Proposal { summary: string; candidates: { code: string; confidence: number; reasoning: string; rules: string[] }[]; missing_facts: string[] }
export interface Question { question: string; options: string[]; why: string }

const LANG_NAME: Record<string, string> = { fr: "français", en: "anglais", zh: "chinois simplifié" };

// ─── La conversation, lue en base ───────────────────────────────────────────

export interface Classification {
  id: string; ref: string; client_user_id: string; product_name: string; description: string | null;
  facts: Record<string, unknown>; photo_paths: string[]; status: string;
}
export interface Msg { author: string; body: string; payload: Record<string, unknown> | null }

/** Les pistes du vocabulaire du marché, calculées par l'app (src/lib/customs/marketTerms.ts). */
export interface Hint { code: string; tip?: string }

export function renderFile(c: Classification, msgs: Msg[], lang: string, hints: Hint[] = []): string {
  const who: Record<string, string> = { client: "Client", assistant: "Assistant", broker: "Commissionnaire agréé", system: "Système" };
  const convo = msgs.map((m) => {
    let line = `- ${who[m.author] ?? m.author} : ${m.body}`;
    const opts = m.payload && Array.isArray((m.payload as { options?: unknown }).options) ? (m.payload as { options: string[] }).options : [];
    if (opts.length) line += ` (choix proposés : ${opts.join(" / ")})`;
    return line;
  }).join("\n");
  const facts = Object.keys(c.facts ?? {}).length ? JSON.stringify(c.facts) : "aucun";
  return [
    `Fiche produit ${c.ref}`,
    `Produit : ${c.product_name}`,
    c.description ? `Description du client : ${c.description}` : null,
    `Faits établis : ${facts}`,
    hints.length
      ? `Pistes du vocabulaire du marché camerounais (à vérifier, jamais à recopier sans contrôle) :\n${hints.map((h) => `  · ${h.code}${h.tip ? ` — ${h.tip}` : ""}`).join("\n")}`
      : null,
    c.photo_paths.length ? `Photos : ${c.photo_paths.length} jointe(s) ci-dessus.` : "Photos : aucune.",
    "",
    "Conversation jusqu'ici :",
    convo || "- (aucun message)",
    "",
    `Langue de réponse : ${LANG_NAME[lang] ?? "français"}.`,
    "Termine par ask_client ou propose_codes.",
  ].filter((l) => l != null).join("\n");
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function photoBlocks(admin: SupabaseClient, paths: string[]): Promise<Anthropic.Beta.BetaImageBlockParam[]> {
  const out: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const path of paths.slice(0, MAX_PHOTOS)) {
    const { data, error } = await admin.storage.from("customs-documents").download(path);
    if (error || !data) continue;
    const type = data.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(type) || data.size > 5 * 1024 * 1024) continue;
    out.push({ type: "image", source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/webp", data: toBase64(new Uint8Array(await data.arrayBuffer())) } });
  }
  return out;
}

// ─── Un tour de classement ──────────────────────────────────────────────────

export type Outcome =
  | { kind: "question"; question: Question }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "refusal" };

export async function runClassification(anthropic: Anthropic, nom: Nomenclature, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<Outcome> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const last = round === MAX_TOOL_ROUNDS - 1;
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      tool_choice: { type: "auto" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: last
        ? [...messages, { role: "user", content: "Tu as assez cherché : conclus maintenant par ask_client ou propose_codes." }]
        : messages,
    });
    if (res.stop_reason === "refusal") return { kind: "refusal" };

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const final = uses.find((u) => u.name === "propose_codes") ?? uses.find((u) => u.name === "ask_client");
    if (final?.name === "propose_codes") return { kind: "proposal", proposal: final.input as Proposal };
    if (final?.name === "ask_client") return { kind: "question", question: final.input as Question };
    if (!uses.length) {
      // Pas d'outil final : le texte devient une question au client.
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { kind: "question", question: { question: text || "Pouvez-vous décrire la marchandise plus précisément (matière, usage, neuf ou usagé) ?", options: [], why: "" } };
    }
    // Les recherches : on répond à TOUS les outils du tour, dans un seul message.
    messages.push({ role: "assistant", content: res.content });
    messages.push({
      role: "user",
      content: uses.map((u) => {
        const input = u.input as { query?: string; heading?: string };
        const result = u.name === "search_tariff" ? searchTariff(nom, String(input.query ?? ""))
          : u.name === "list_heading" ? listHeading(nom, String(input.heading ?? ""))
          : { erreur: "Outil inconnu." };
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result) } as Anthropic.Beta.BetaToolResultBlockParam;
      }),
    });
  }
  return { kind: "question", question: { question: "Pouvez-vous préciser la matière et l'usage de la marchandise ?", options: [], why: "" } };
}

/** Ne garde que des codes qui existent ; le taux vient de la nomenclature. */
export function cleanProposal(nom: Nomenclature, p: Proposal) {
  const seen = new Set<string>();
  const candidates = (Array.isArray(p.candidates) ? p.candidates : [])
    .map((c) => ({ ...c, code: String(c.code ?? "").replace(/\D/g, "").slice(0, 6) }))
    .filter((c) => c.code.length === 6 && nom.byCode.has(c.code) && !seen.has(c.code) && seen.add(c.code))
    .slice(0, 3)
    .map((c) => {
      const line = nom.byCode.get(c.code)!;
      return {
        code: c.code,
        title: line.fr,
        heading: nom.headings.get(c.code.slice(0, 4)) ?? null,
        rate_min: line.rateMin,
        rate_max: line.rateMax,
        confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
        reasoning: String(c.reasoning ?? "").slice(0, 1500),
        rules: (Array.isArray(c.rules) ? c.rules : []).map(String).slice(0, 6),
      };
    });
  return {
    summary: String(p.summary ?? "").slice(0, 2000),
    candidates,
    missing_facts: (Array.isArray(p.missing_facts) ? p.missing_facts : []).map(String).slice(0, 5),
  };
}

// ─── Lire une DAU (étape 5) ──────────────────────────────────────────────────

const READ_SYSTEM = `Tu lis des déclarations en douane camerounaises (DAU imprimées par CAMCIS, ou bulletins de liquidation) pour Bonzini Labs.

Ta seule tâche : RECOPIER ce qui est imprimé, article par article, avec record_dau. Tu ne juges rien et ne corriges rien : un moteur de calcul, puis un commissionnaire agréé en douane, s'en chargent.

Règles :
- Recopie les chiffres EXACTEMENT. Montants en francs CFA, entiers, sans espaces ni séparateurs de milliers. Un chiffre illisible : null, et dis-le dans unreadable. N'invente jamais un montant.
- Le code SH de chaque article : tous ses chiffres (souvent 11 ou 12), sans points ni espaces.
- La désignation commerciale, telle qu'elle est saisie (« REGULATEUR », « CHAISE DE SALLE A MANGER »).
- La valeur en douane de l'article (valeur CAF, valeur imposable), en francs CFA.
- Les taxes de l'article : une ligne par code imprimé (DDI, DAC, DEA, TVA, CAM, CAD, CAF, TCI, TIB, CCI, CCB, CIA, CIB, PRO, DEV, DEW, DEX, DEY…), avec le taux en % quand il est imprimé et le montant. Une taxe à zéro : ne la recopie pas.
- Le code additionnel de l'article s'il y en a un (A30, E00…).
- Dates au format AAAA-MM-JJ : l'enregistrement de la déclaration ; le paiement (quittance) s'il figure.
- released : true si la DAU porte un bon à enlever ou une mainlevée ; false si elle dit qu'elle n'est pas accordée ; null sinon.
- Plusieurs pièces peuvent former une seule DAU (pages photographiées) : fusionne-les, sans doublon d'article.
- Si le document n'est pas une déclaration en douane, renvoie une liste d'articles vide et explique-le dans unreadable.

Termine par UN appel à record_dau.`;

const orNull = (type: "string" | "number" | "boolean", description?: string) =>
  ({ anyOf: [{ type }, { type: "null" }], ...(description ? { description } : {}) });

const READ_TOOL = {
  name: "record_dau",
  description: "Enregistre le contenu de la déclaration, tel qu'imprimé. Termine la lecture.",
  strict: true,
  // La requête est diffusée (stream) : l'entrée arrive sans validation par l'API, on la vérifie ici.
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    properties: {
      dau_number: orNull("string", "Numéro de la déclaration, ex. SDSD2-2026-IMP-020399-I."),
      office: orNull("string", "Bureau de douane."),
      regime: orNull("string", "Régime douanier imprimé."),
      registered_on: orNull("string", "Date d'enregistrement, AAAA-MM-JJ."),
      paid_on: orNull("string", "Date de paiement, AAAA-MM-JJ."),
      released: orNull("boolean", "Mainlevée ou bon à enlever mentionné."),
      importer_name: orNull("string"),
      importer_niu: orNull("string"),
      declarant: orNull("string", "Le déclarant ou commissionnaire en douane."),
      total_taxes_xaf: orNull("number", "Total des droits et taxes de la déclaration."),
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "Numéro de l'article." },
            code: { type: "string", description: "Code SH, chiffres seuls." },
            description: { type: "string" },
            origin: orNull("string"),
            quantity: orNull("number"),
            gross_kg: orNull("number"),
            net_kg: orNull("number"),
            customs_value_xaf: orNull("number"),
            additional_code: orNull("string"),
            taxes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string", description: "Code imprimé : DDI, DAC, DEA, TVA, CAM…" },
                  rate_pct: orNull("number"),
                  amount_xaf: { type: "number" },
                },
                required: ["code", "rate_pct", "amount_xaf"],
                additionalProperties: false,
              },
            },
          },
          required: ["n", "code", "description", "origin", "quantity", "gross_kg", "net_kg", "customs_value_xaf", "additional_code", "taxes"],
          additionalProperties: false,
        },
      },
      unreadable: { type: "array", items: { type: "string" }, description: "Ce qui n'a pas pu être lu. Vide si tout est lisible." },
    },
    required: ["dau_number", "office", "regime", "registered_on", "paid_on", "released", "importer_name", "importer_niu", "declarant", "total_taxes_xaf", "articles", "unreadable"],
    additionalProperties: false,
  },
} as unknown as Anthropic.Beta.BetaTool;

export type ReadOutcome =
  | { kind: "extraction"; extraction: Extraction }
  | { kind: "refusal" | "truncated" | "invalid" };

export interface Extraction {
  dau_number: string | null; office: string | null; regime: string | null; registered_on: string | null; paid_on: string | null;
  released: boolean | null; importer_name: string | null; importer_niu: string | null; declarant: string | null;
  total_taxes_xaf: number | null; unreadable: string[];
  articles: {
    n: number; code: string; description: string; origin: string | null; quantity: number | null; gross_kg: number | null;
    net_kg: number | null; customs_value_xaf: number | null; additional_code: string | null;
    taxes: { code: string; base_xaf: null; rate_pct: number | null; amount_xaf: number }[];
  }[];
}

const n0 = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s0 = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const d0 = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * L'entrée du modèle, vérifiée champ par champ (l'API ne l'a pas validée : voir
 * eager_input_streaming). Même règles que cleanExtraction côté app
 * (src/lib/customs/audit.ts), qui la nettoie encore avant de juger.
 * null : ce n'est pas une lecture exploitable.
 */
export function sanitizeExtraction(raw: unknown): Extraction | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { articles?: unknown }).articles)) return null;
  const r = raw as Record<string, unknown>;
  const articles = (r.articles as unknown[]).slice(0, 200).flatMap((x, i) => {
    if (!x || typeof x !== "object") return [];
    const a = x as Record<string, unknown>;
    const code = String(a.code ?? "").replace(/\D/g, "").slice(0, 12);
    if (code.length < 6) return [];
    const value = n0(a.customs_value_xaf);
    return [{
      n: Math.round(n0(a.n) ?? i + 1), code, description: s0(a.description, 400) ?? "", origin: s0(a.origin, 40),
      quantity: n0(a.quantity), gross_kg: n0(a.gross_kg), net_kg: n0(a.net_kg),
      customs_value_xaf: value != null && value > 0 ? Math.round(value) : null,
      additional_code: s0(a.additional_code, 8)?.toUpperCase() ?? null,
      taxes: (Array.isArray(a.taxes) ? a.taxes : []).slice(0, 40).flatMap((t) => {
        const tx = (t ?? {}) as Record<string, unknown>;
        const c = String(tx.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        const amount = n0(tx.amount_xaf);
        return c && amount != null && amount >= 0 ? [{ code: c, base_xaf: null, rate_pct: n0(tx.rate_pct), amount_xaf: Math.round(amount) }] : [];
      }),
    }];
  });
  const total = n0(r.total_taxes_xaf);
  return {
    dau_number: s0(r.dau_number, 80), office: s0(r.office, 80), regime: s0(r.regime, 40),
    registered_on: d0(r.registered_on), paid_on: d0(r.paid_on),
    released: typeof r.released === "boolean" ? r.released : null,
    importer_name: s0(r.importer_name, 160), importer_niu: s0(r.importer_niu, 40), declarant: s0(r.declarant, 160),
    total_taxes_xaf: total != null && total >= 0 ? Math.round(total) : null,
    articles,
    unreadable: (Array.isArray(r.unreadable) ? r.unreadable : []).map((u) => s0(u)).filter((u): u is string => !!u).slice(0, 20),
  };
}

/** Une lecture : un appel, diffusé ; une seconde chance si l'entrée est illisible. */
export async function runReading(anthropic: Anthropic, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<ReadOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await anthropic.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        thinking: { type: "adaptive" },
        output_config: { effort: READ_EFFORT },
        system: [{ type: "text", text: READ_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [READ_TOOL],
        tool_choice: { type: "auto" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content }],
      }).finalMessage();
    } catch (e) {
      // Les erreurs de l'API (quota, clé, surcharge) remontent ; seul un JSON d'outil illisible est rejoué.
      if (e instanceof Anthropic.APIError) throw e;
      if (attempt === 0) continue;
      return { kind: "invalid" };
    }
    if (res.stop_reason === "refusal") return { kind: "refusal" };
    if (res.stop_reason === "max_tokens") return { kind: "truncated" };
    const use = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "record_dau");
    const extraction = use ? sanitizeExtraction(use.input) : null;
    if (extraction) return { kind: "extraction", extraction };
  }
  return { kind: "invalid" };
}

async function dauBlocks(admin: SupabaseClient, paths: string[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  let total = 0;
  for (const path of paths.slice(0, 10)) {
    const { data, error } = await admin.storage.from("customs-documents").download(path);
    if (error || !data) continue;
    total += data.size;
    if (total > MAX_DAU_BYTES) throw new ReadError("Les pièces sont trop lourdes pour une lecture (18 Mo au plus) : envoyez la déclaration au commissionnaire.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const type = data.type || (path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (type === "application/pdf") {
      out.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) } });
    } else if (["image/jpeg", "image/png", "image/webp"].includes(type)) {
      out.push({ type: "image", source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/webp", data: toBase64(bytes) } });
    }
  }
  return out;
}

class ReadError extends Error {}

interface AuditRow {
  id: string; ref: string; client_user_id: string; file_paths: string[]; status: string; updated_at: string;
  dau_number: string | null; paid_on: string | null; claim_deadline: string | null;
}

const plusYears = (iso: string, years: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
};

/** La lecture complète, jusqu'à l'écriture en base — lancée en arrière-plan du runtime. */
export async function readJob(admin: SupabaseClient, anthropic: Anthropic, a: AuditRow): Promise<void> {
  const fail = async (message: string) => {
    await admin.from("customs_audits").update({ status: "failed", error: message.slice(0, 500) }).eq("id", a.id).eq("status", "reading");
  };
  try {
    const blocks = await dauBlocks(admin, a.file_paths ?? []);
    if (!blocks.length) return await fail("Aucune pièce lisible : déposez la DAU en PDF, JPG, PNG ou WebP.");
    const outcome = await runReading(anthropic, [...blocks, { type: "text", text: `Déclaration ${a.ref} : ${blocks.length} pièce(s). Recopie-la avec record_dau.` }]);
    if (outcome.kind !== "extraction") {
      return await fail({
        refusal: "L'assistant n'a pas pu lire ce document. Envoyez-le au commissionnaire.",
        truncated: "La déclaration est trop longue pour une lecture automatique : envoyez-la au commissionnaire.",
        invalid: "La lecture n'a pas abouti. Réessayez, ou envoyez la déclaration au commissionnaire.",
      }[outcome.kind]);
    }
    const ext = outcome.extraction;
    if (!ext.articles.length) return await fail(ext.unreadable[0] ?? "Aucun article n'a été trouvé : est-ce bien une déclaration en douane ?");
    const today = new Date().toISOString().slice(0, 10);
    const paidOn = a.paid_on ?? (ext.paid_on && ext.paid_on <= today ? ext.paid_on : null);
    const start = paidOn ?? (ext.registered_on && ext.registered_on <= today ? ext.registered_on : null);
    const { error } = await admin.from("customs_audits").update({
      status: "read", extraction: ext, ai_model: MODEL, error: null,
      // Une relecture remet les constats à zéro : l'app les recalcule sur la nouvelle lecture.
      findings: [], total_paid_xaf: null, overpaid_xaf: null,
      dau_number: a.dau_number ?? ext.dau_number, customs_office: ext.office,
      registered_on: ext.registered_on && ext.registered_on <= today ? ext.registered_on : null,
      paid_on: paidOn,
      claim_deadline: a.claim_deadline ?? (start ? plusYears(start, 3) : null),
    }).eq("id", a.id).eq("status", "reading");
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("customs-ai read_dau:", e);
    await fail(e instanceof ReadError ? e.message
      : e instanceof Anthropic.RateLimitError ? "L'assistant est très sollicité : réessayez dans une minute."
      : "La lecture a échoué. Réessayez, ou envoyez la déclaration au commissionnaire.");
  }
}

async function readDau(admin: SupabaseClient, userId: string, auditId: string, anthropic: Anthropic): Promise<Response> {
  const { data: a } = await admin.from("customs_audits")
    .select("id, ref, client_user_id, file_paths, status, updated_at, dau_number, paid_on, claim_deadline")
    .eq("id", auditId).maybeSingle<AuditRow>();
  if (!a) return json({ success: false, error: "Audit introuvable" }, 404);
  if (a.client_user_id !== userId) {
    const { data: staff } = await admin.rpc("admin_has_permission", { _user_id: userId, _permission: "canViewCustoms" });
    if (staff !== true) return json({ success: false, error: "Audit introuvable" }, 404);
  }
  const stale = a.status === "reading" && Date.now() - Date.parse(a.updated_at) > STALE_READING_MS;
  if (!["uploaded", "read", "failed"].includes(a.status) && !stale) {
    return json({ success: false, error: a.status === "reading" ? "La déclaration est en cours de lecture." : "La déclaration est entre les mains du commissionnaire." }, 409);
  }
  // Verrou : un seul lecteur. La mise à jour ne passe que si personne n'a changé le statut entre-temps.
  const { data: locked } = await admin.from("customs_audits").update({ status: "reading", error: null }).eq("id", a.id).eq("status", a.status).select("id");
  if (!locked?.length) return json({ success: false, error: "Une lecture est déjà en cours." }, 409);

  const job = readJob(admin, anthropic, a);
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(job);
    return json({ success: true, status: "reading" }, 202);
  }
  await job;
  const { data: after } = await admin.from("customs_audits").select("status, error").eq("id", a.id).maybeSingle<{ status: string; error: string | null }>();
  return json({ success: after?.status === "read", status: after?.status ?? null, error: after?.error ?? undefined });
}

// ─── Le serveur ─────────────────────────────────────────────────────────────

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST uniquement" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!apiKey) {
    // Le détail de configuration reste dans les journaux ; le client, lui, a une issue.
    console.error("customs-ai: ANTHROPIC_API_KEY manquante (secret Supabase Edge Functions)");
    return json({ success: false, error: "L'assistant n'est pas disponible pour le moment. Envoyez le dossier au commissionnaire : il s'en chargera lui-même." }, 503);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: "Connexion requise" }, 401);

  let body: { action?: string; classification_id?: string; audit_id?: string; hints?: unknown };
  try { body = await req.json(); } catch { return json({ success: false, error: "JSON invalide" }, 400); }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (body.action === "read_dau" && body.audit_id) {
    return await readDau(admin, user.id, body.audit_id, new Anthropic({ apiKey, timeout: 600_000, maxRetries: 1 }));
  }
  if (body.action !== "classify" || !body.classification_id) return json({ success: false, error: "Action inconnue" }, 400);

  const { data: c } = await admin.from("customs_classifications")
    .select("id, ref, client_user_id, product_name, description, facts, photo_paths, status")
    .eq("id", body.classification_id).maybeSingle<Classification>();
  if (!c) return json({ success: false, error: "Fiche introuvable" }, 404);
  if (c.client_user_id !== user.id) {
    const { data: staff } = await admin.rpc("admin_has_permission", { _user_id: user.id, _permission: "canViewCustoms" });
    if (staff !== true) return json({ success: false, error: "Fiche introuvable" }, 404);
  }
  if (!["draft", "needs_info"].includes(c.status)) {
    return json({ success: false, error: "La fiche est entre les mains du commissionnaire" }, 409);
  }

  const { data: msgs } = await admin.from("customs_classification_messages")
    .select("author, body, payload").eq("classification_id", c.id).order("created_at");
  const history = (msgs ?? []) as Msg[];
  if (history.filter((m) => m.author === "assistant").length >= MAX_ASSISTANT_TURNS) {
    return json({ success: false, error: "Cette fiche a atteint sa limite d'échanges : envoyez-la au commissionnaire." }, 429);
  }

  const { data: client } = await admin.from("clients").select("preferred_locale").eq("user_id", c.client_user_id).maybeSingle<{ preferred_locale: string | null }>();
  const lang = (client?.preferred_locale ?? "fr").slice(0, 2);

  let nom: Nomenclature;
  try { nom = await loadNomenclature(); } catch (e) {
    console.error("customs-ai: nomenclature", e);
    return json({ success: false, error: "Le tarif n'a pas pu être chargé. Réessayez." }, 503);
  }

  // Des pistes, pas des ordres : seuls des codes du SH 2022, huit au plus, conseil tronqué.
  const hints: Hint[] = (Array.isArray(body.hints) ? body.hints : [])
    .map((h) => ({ code: String((h as Hint)?.code ?? "").replace(/\D/g, "").slice(0, 6), tip: (h as Hint)?.tip ? String((h as Hint).tip).slice(0, 300) : undefined }))
    .filter((h) => nom.byCode.has(h.code))
    .slice(0, 8);

  const images = await photoBlocks(admin, c.photo_paths ?? []);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [...images, { type: "text", text: renderFile(c, history, lang, hints) }];

  const anthropic = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
  let outcome: Outcome;
  try {
    outcome = await runClassification(anthropic, nom, content);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ success: false, error: "L'assistant est très sollicité : réessayez dans une minute." }, 429);
    if (e instanceof Anthropic.APIError) {
      console.error("customs-ai: API", e.status, e.message);
      return json({ success: false, error: "L'assistant n'a pas pu répondre. Réessayez." }, 502);
    }
    console.error("customs-ai:", e);
    return json({ success: false, error: "Erreur inattendue" }, 500);
  }

  if (outcome.kind === "refusal") {
    return json({ success: false, error: "L'assistant ne peut pas traiter cette demande. Décrivez le produit autrement, ou envoyez la fiche au commissionnaire." }, 422);
  }

  if (outcome.kind === "question") {
    const q = outcome.question;
    const options = (Array.isArray(q.options) ? q.options : []).map(String).filter(Boolean).slice(0, 5);
    const { error } = await admin.from("customs_classification_messages").insert({
      classification_id: c.id, author: "assistant", body: String(q.question).slice(0, 4000),
      payload: { type: "question", options, why: String(q.why ?? "").slice(0, 600), model: MODEL },
    });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, kind: "question", question: q.question, options });
  }

  const proposal = cleanProposal(nom, outcome.proposal);
  if (!proposal.candidates.length) {
    const text = "Je n'ai pas trouvé de code sûr avec ces informations. Décrivez la matière, l'usage et l'état (neuf ou usagé) de la marchandise.";
    await admin.from("customs_classification_messages").insert({ classification_id: c.id, author: "assistant", body: text, payload: { type: "question", options: [], model: MODEL } });
    return json({ success: true, kind: "question", question: text, options: [] });
  }
  const { error: msgErr } = await admin.from("customs_classification_messages").insert({
    classification_id: c.id, author: "assistant", body: proposal.summary || `Code proposé : ${proposal.candidates[0].code}`,
    payload: { type: "proposal", candidates: proposal.candidates, missing_facts: proposal.missing_facts, model: MODEL },
  });
  if (msgErr) return json({ success: false, error: msgErr.message }, 500);
  const { error: upErr } = await admin.from("customs_classifications")
    .update({ candidates: proposal.candidates, proposed_code: proposal.candidates[0].code, ai_model: MODEL })
    .eq("id", c.id).in("status", ["draft", "needs_info"]);
  if (upErr) return json({ success: false, error: upErr.message }, 500);
  return json({ success: true, kind: "proposal", ...proposal });
}

// Les tests (index.test.ts) importent le module sans démarrer le serveur.
if (!Deno.env.get("CUSTOMS_AI_TEST")) Deno.serve(handler);
