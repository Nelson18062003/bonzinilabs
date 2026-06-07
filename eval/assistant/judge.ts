// JUGE QUALITÉ de Mola — la MESURE MANQUANTE.
//
// grade.ts note la CORRECTION MÉCANIQUE (bon outil, bons params, refus, sous-chaînes).
// Un Mola "robot" peut passer grade.ts à 100 % et rester nul. Ce fichier ajoute la
// dimension absente : la PROFONDEUR (juge-LLM sur une grille métier Bonzini).
//
// Comme grade.ts : PUR, aucune dépendance, aucun import relatif non-type → chargeable
// par vitest (node) ET Deno (quality-run.ts). L'appel au modèle vit dans le runner ;
// ici on ne fait que CONSTRUIRE le prompt du juge et PARSER/AGRÉGER son verdict.

/** Les 5 axes de « directeur des opérations qui comprend VRAIMENT Bonzini ». */
export type QualityDimension =
  | "business_depth"   // raisonne comme un DO qui connaît le modèle XAF→USDT→CNY, le spread, les statuts — pas un chatbot générique
  | "proactivity"      // surface l'info utile suivante (anomalie, prochaine étape) au lieu de répondre au pied de la lettre puis s'arrêter
  | "grounding"        // chiffres adossés aux données/SQL, zéro invention
  | "tone"             // chaleureux, concis, partenaire humain — pas templaté/robotique
  | "actionability";   // fait avancer l'admin (étape suivante claire, carte d'action quand pertinent)

export const DIMENSIONS: QualityDimension[] = [
  "business_depth", "proactivity", "grounding", "tone", "actionability",
];

/** Pondération (somme = 1). C'est ICI qu'on encode « ce qui compte pour Bonzini ».
 *  La profondeur métier et la proactivité pèsent le plus : c'est ce qui fait
 *  la différence entre un robot et un directeur des opérations. */
export const WEIGHTS: Record<QualityDimension, number> = {
  business_depth: 0.30,
  proactivity:    0.25,
  grounding:      0.20,
  tone:           0.15,
  actionability:  0.10,
};

/** Libellés FR + critère de notation, injectés dans le prompt du juge. */
export const RUBRIC: Record<QualityDimension, { label: string; criterion: string }> = {
  business_depth: {
    label: "Profondeur métier",
    criterion:
      "Raisonne-t-il comme un directeur des opérations qui MAÎTRISE Bonzini (importateurs africains réglant des fournisseurs chinois ; on achète des USDT en XAF puis on les vend en CNY ; le bénéfice = le spread ; cycle dépôt→validé→wallet→paiement→completed) ? 5 = montre une vraie compréhension du modèle et de ses implications ; 1 = répond comme un chatbot générique sans contexte métier.",
  },
  proactivity: {
    label: "Proactivité",
    criterion:
      "Va-t-il au-delà de la question littérale pour signaler l'info VRAIMENT utile (un dépôt bloqué en admin_review depuis 3 jours, une marge anormale, la prochaine étape évidente) ? 5 = anticipe le besoin réel ; 1 = répond au pied de la lettre puis s'arrête.",
  },
  grounding: {
    label: "Ancrage factuel",
    criterion:
      "Les chiffres/affirmations sont-ils adossés à une lecture de données (et non inventés/estimés) ? 5 = tout est sourcé, montre le SQL/la fenêtre si utile ; 1 = invente ou se défausse (« je n'ai pas accès »).",
  },
  tone: {
    label: "Ton",
    criterion:
      "Chaleureux, concis, naturel — un partenaire humain ? 5 = on dirait un collègue compétent ; 1 = robotique, templaté, verbeux ou condescendant.",
  },
  actionability: {
    label: "Actionnabilité",
    criterion:
      "Fait-il avancer l'admin (étape suivante claire, carte d'action quand pertinent) ? 5 = l'admin sait exactement quoi faire ensuite ; 1 = cul-de-sac.",
  },
};

/** Un tour de conversation à juger (question admin → réponse Mola). */
export interface JudgeSample {
  id: string;
  role: string;            // rôle de l'admin (super_admin, ops, support…)
  question: string;        // dernier message utilisateur
  answer: string;          // réponse finale de Mola
  toolsUsed?: string[];    // outils réellement appelés (contexte d'ancrage)
}

/** Verdict du juge pour un échantillon. */
export interface JudgeVerdict {
  id: string;
  scores: Record<QualityDimension, number>; // 1..5 par axe
  /** Thème de défaut dominant (slug court) pour le clustering, ex. "reponse_taux_mecanique". */
  theme: string;
  /** Critique d'une phrase (ce qui fait « robot » ici, ou ce qui est bon). */
  critique: string;
  /** Citation courte de la réponse illustrant le problème (pour le rapport). */
  evidence?: string;
}

export const QUALITY_FAIL_THRESHOLD = 60; // /100 — en dessous = candidat à promouvoir en cas de régression

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v));
}

/** Score pondéré 0..100 d'un verdict. */
export function weightedScore(scores: Record<QualityDimension, number>): number {
  let s = 0;
  for (const d of DIMENSIONS) s += (clampScore(scores[d]) / 5) * WEIGHTS[d];
  return Math.round(s * 1000) / 10; // une décimale
}

/** Slugifie un thème libre du juge en clé stable de clustering. */
export function slugifyTheme(raw: unknown): string {
  return String(raw ?? "autre")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "autre";
}

/** Construit le prompt SYSTÈME du juge (réutilisable, mis en cache côté API). */
export function buildJudgeSystem(): string {
  const axes = DIMENSIONS
    .map((d, i) => `${i + 1}. ${RUBRIC[d].label} (${d}) : ${RUBRIC[d].criterion}`)
    .join("\n");
  return [
    "Tu es un évaluateur EXIGEANT de la qualité de « Mola », l'assistant directeur des opérations IA de BonziniLabs.",
    "BonziniLabs : fintech qui permet aux importateurs africains de régler leurs fournisseurs chinois en XAF.",
    "On t'envoie une question d'admin et la réponse de Mola. Note la réponse sur 5 axes, de 1 (mauvais) à 5 (excellent) :",
    axes,
    "",
    "Sois SÉVÈRE sur business_depth et proactivity : c'est ce qui distingue un directeur des opérations d'un robot générique.",
    "Renvoie UNIQUEMENT un objet JSON sur une ligne, sans texte autour, de la forme :",
    `{"business_depth":N,"proactivity":N,"grounding":N,"tone":N,"actionability":N,"theme":"slug_court_du_defaut_dominant","critique":"une phrase","evidence":"courte citation de la réponse"}`,
  ].join("\n");
}

/** Construit le message UTILISATEUR du juge pour un échantillon. */
export function buildJudgeUser(s: JudgeSample): string {
  return [
    `RÔLE ADMIN : ${s.role}`,
    `OUTILS APPELÉS PAR MOLA : ${(s.toolsUsed ?? []).join(", ") || "(aucun)"}`,
    `QUESTION DE L'ADMIN :`,
    s.question,
    ``,
    `RÉPONSE DE MOLA :`,
    s.answer,
  ].join("\n");
}

/** Parse robuste du verdict JSON renvoyé par le juge (tolère le texte autour). */
export function parseJudgeVerdict(id: string, raw: string): JudgeVerdict {
  let obj: Record<string, unknown> = {};
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { /* défauts ci-dessous */ }
  }
  const scores = {} as Record<QualityDimension, number>;
  for (const d of DIMENSIONS) scores[d] = clampScore(obj[d]);
  return {
    id,
    scores,
    theme: slugifyTheme(obj.theme),
    critique: String(obj.critique ?? "").slice(0, 280),
    evidence: obj.evidence ? String(obj.evidence).slice(0, 200) : undefined,
  };
}

export interface QualityAggregate {
  count: number;
  overall: number;                                  // moyenne des scores pondérés /100
  byDimension: Record<QualityDimension, number>;    // moyenne /5 par axe
  weakest: QualityDimension | null;                 // axe le plus faible (à travailler en premier)
  failing: number;                                  // nb d'échantillons sous le seuil
}

/** Agrège un lot de verdicts → tableau de bord qualité. */
export function aggregateQuality(verdicts: JudgeVerdict[]): QualityAggregate {
  const n = verdicts.length;
  const byDimension = {} as Record<QualityDimension, number>;
  for (const d of DIMENSIONS) byDimension[d] = 0;
  let overall = 0, failing = 0;
  for (const v of verdicts) {
    const ws = weightedScore(v.scores);
    overall += ws;
    if (ws < QUALITY_FAIL_THRESHOLD) failing++;
    for (const d of DIMENSIONS) byDimension[d] += clampScore(v.scores[d]);
  }
  let weakest: QualityDimension | null = null;
  if (n > 0) {
    for (const d of DIMENSIONS) {
      byDimension[d] = Math.round((byDimension[d] / n) * 100) / 100;
      if (weakest === null || byDimension[d] < byDimension[weakest]) weakest = d;
    }
  }
  return {
    count: n,
    overall: n ? Math.round((overall / n) * 10) / 10 : 0,
    byDimension,
    weakest,
    failing,
  };
}
