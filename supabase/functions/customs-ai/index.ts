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
// Fichier autonome (sans _shared) : déployable depuis l'éditeur du dashboard.
// Secrets : ANTHROPIC_API_KEY. Optionnels : CUSTOMS_AI_MODEL, CUSTOMS_AI_EFFORT,
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

async function photoBlocks(admin: SupabaseClient, paths: string[]): Promise<Anthropic.Beta.BetaImageBlockParam[]> {
  const out: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const path of paths.slice(0, MAX_PHOTOS)) {
    const { data, error } = await admin.storage.from("customs-documents").download(path);
    if (error || !data) continue;
    const type = data.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(type) || data.size > 5 * 1024 * 1024) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out.push({ type: "image", source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/webp", data: btoa(bin) } });
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
    return json({ success: false, error: "L'assistant n'est pas disponible pour le moment. Envoyez la fiche au commissionnaire : il la classera lui-même." }, 503);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: "Connexion requise" }, 401);

  let body: { action?: string; classification_id?: string; hints?: unknown };
  try { body = await req.json(); } catch { return json({ success: false, error: "JSON invalide" }, 400); }
  if (body.action !== "classify" || !body.classification_id) return json({ success: false, error: "Action inconnue" }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
