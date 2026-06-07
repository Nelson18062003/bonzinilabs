// Tests du juge qualité + du rapport (PURS → tournent ici sous vitest).
import { describe, it, expect } from "vitest";
import {
  parseJudgeVerdict, weightedScore, aggregateQuality, slugifyTheme,
  buildJudgeSystem, DIMENSIONS, WEIGHTS, type JudgeVerdict, type JudgeSample,
} from "./judge";
import { clusterThemes, promotionCandidates, renderReport } from "./report";

describe("WEIGHTS", () => {
  it("somme des pondérations = 1", () => {
    const sum = DIMENSIONS.reduce((s, d) => s + WEIGHTS[d], 0);
    expect(Math.round(sum * 1000) / 1000).toBe(1);
  });
});

describe("weightedScore", () => {
  it("tout à 5 → 100", () => {
    expect(weightedScore({ business_depth: 5, proactivity: 5, grounding: 5, tone: 5, actionability: 5 })).toBe(100);
  });
  it("tout à 1 → 20", () => {
    expect(weightedScore({ business_depth: 1, proactivity: 1, grounding: 1, tone: 1, actionability: 1 })).toBe(20);
  });
  it("clampe les valeurs hors bornes", () => {
    expect(weightedScore({ business_depth: 9, proactivity: 0, grounding: 5, tone: 5, actionability: 5 } as never)).toBeLessThanOrEqual(100);
  });
});

describe("parseJudgeVerdict", () => {
  it("parse un JSON propre", () => {
    const v = parseJudgeVerdict("c1", `{"business_depth":4,"proactivity":2,"grounding":5,"tone":3,"actionability":4,"theme":"Réponse taux mécanique","critique":"sec","evidence":"le taux est X"}`);
    expect(v.scores.business_depth).toBe(4);
    expect(v.scores.proactivity).toBe(2);
    expect(v.theme).toBe("reponse_taux_mecanique");
    expect(v.evidence).toBe("le taux est X");
  });
  it("tolère du texte autour du JSON", () => {
    const v = parseJudgeVerdict("c2", `Voici mon verdict: {"business_depth":3,"proactivity":3,"grounding":3,"tone":3,"actionability":3,"theme":"ok"} merci`);
    expect(v.scores.grounding).toBe(3);
    expect(v.theme).toBe("ok");
  });
  it("JSON cassé → défauts neutres (3) sans crash", () => {
    const v = parseJudgeVerdict("c3", "le modèle a déraillé, pas de json");
    for (const d of DIMENSIONS) expect(v.scores[d]).toBe(3);
    expect(v.theme).toBe("autre");
  });
});

describe("slugifyTheme", () => {
  it("normalise accents/espaces/casse", () => {
    expect(slugifyTheme("Pas de Proactivité !")).toBe("pas_de_proactivite");
    expect(slugifyTheme(undefined)).toBe("autre");
  });
});

describe("aggregateQuality", () => {
  const verdicts: JudgeVerdict[] = [
    { id: "a", theme: "t1", critique: "", scores: { business_depth: 2, proactivity: 1, grounding: 4, tone: 3, actionability: 3 } },
    { id: "b", theme: "t1", critique: "", scores: { business_depth: 2, proactivity: 2, grounding: 5, tone: 4, actionability: 4 } },
    { id: "c", theme: "t2", critique: "", scores: { business_depth: 5, proactivity: 5, grounding: 5, tone: 5, actionability: 5 } },
  ];
  it("identifie l'axe le plus faible", () => {
    const agg = aggregateQuality(verdicts);
    expect(agg.weakest).toBe("proactivity"); // moy (1+2+5)/3 = 2.67, le plus bas
    expect(agg.count).toBe(3);
  });
  it("corpus vide → ne crashe pas", () => {
    const agg = aggregateQuality([]);
    expect(agg.overall).toBe(0);
    expect(agg.weakest).toBeNull();
  });
});

describe("report : clustering & promotion", () => {
  const verdicts: JudgeVerdict[] = [
    { id: "a", theme: "robot_taux", critique: "réponse sèche", evidence: "le taux est 78", scores: { business_depth: 1, proactivity: 1, grounding: 4, tone: 2, actionability: 2 } },
    { id: "b", theme: "robot_taux", critique: "aucune nuance", scores: { business_depth: 2, proactivity: 1, grounding: 4, tone: 2, actionability: 2 } },
    { id: "c", theme: "bon", critique: "excellent", scores: { business_depth: 5, proactivity: 5, grounding: 5, tone: 5, actionability: 5 } },
  ];
  const samples = new Map<string, JudgeSample>([
    ["a", { id: "a", role: "ops", question: "quel est le taux alipay ?", answer: "Le taux est 78." }],
    ["b", { id: "b", role: "ops", question: "et le taux wechat ?", answer: "78." }],
    ["c", { id: "c", role: "ops", question: "bilan du mois ?", answer: "..." }],
  ]);

  it("classe le pire thème en tête (sévérité)", () => {
    const clusters = clusterThemes(verdicts);
    expect(clusters[0].theme).toBe("robot_taux");
    expect(clusters[0].count).toBe(2);
  });
  it("ne promeut que les échantillons sous le seuil", () => {
    const promote = promotionCandidates(verdicts, samples);
    const ids = promote.map((p) => p.sample.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
  });
  it("rend un Markdown non vide avec le score global", () => {
    const md = renderReport(verdicts, samples, { generatedAt: "2026-06-07", corpus: "test" });
    expect(md).toContain("# Rapport qualité Mola");
    expect(md).toContain("Score global");
    expect(md).toContain("robot_taux");
  });
});

describe("buildJudgeSystem", () => {
  it("inclut les 5 axes et impose un JSON de sortie", () => {
    const sys = buildJudgeSystem();
    for (const d of DIMENSIONS) expect(sys).toContain(d);
    expect(sys).toContain("JSON");
  });
});
