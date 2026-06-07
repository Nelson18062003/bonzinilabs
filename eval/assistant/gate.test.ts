// Tests de la porte anti-régression (PURE → tourne ici sous vitest).
import { describe, it, expect } from "vitest";
import { compareToBaseline, makeBaseline, type Baseline } from "./gate";
import type { QualityAggregate } from "./judge";

function agg(overall: number, dims: Partial<Record<string, number>> = {}): QualityAggregate {
  return {
    count: 50,
    overall,
    byDimension: {
      business_depth: dims.business_depth ?? 3,
      proactivity: dims.proactivity ?? 3,
      grounding: dims.grounding ?? 3,
      tone: dims.tone ?? 3,
      actionability: dims.actionability ?? 3,
    },
    weakest: "proactivity",
    failing: 0,
  } as QualityAggregate;
}

const baseline: Baseline = { seeded: true, updatedAt: "2026-06-01", aggregate: agg(70, { business_depth: 3.5, proactivity: 3.0 }) };

describe("compareToBaseline", () => {
  it("référence non établie → informatif, ne bloque pas", () => {
    const unseeded: Baseline = { seeded: false, updatedAt: "", aggregate: agg(0) };
    const r = compareToBaseline(unseeded, agg(55));
    expect(r.pass).toBe(true);
    expect(r.seeded).toBe(false);
    expect(r.lines.join(" ")).toContain("non encore établie");
  });

  it("qualité stable → porte ouverte", () => {
    const r = compareToBaseline(baseline, agg(70.5, { business_depth: 3.5, proactivity: 3.0 }));
    expect(r.pass).toBe(true);
    expect(r.regressions).toEqual([]);
  });

  it("chute du score global → porte fermée", () => {
    const r = compareToBaseline(baseline, agg(64, { business_depth: 3.5, proactivity: 3.0 }));
    expect(r.pass).toBe(false);
    expect(r.overallDelta).toBe(-6);
    expect(r.regressions.some((s) => s.includes("global"))).toBe(true);
  });

  it("chute d'un axe → porte fermée même si le global tient", () => {
    const r = compareToBaseline(baseline, agg(69.5, { business_depth: 2.8, proactivity: 3.0 }));
    expect(r.pass).toBe(false);
    expect(r.regressions.some((s) => s.includes("Profondeur"))).toBe(true);
  });

  it("amélioration nette → porte ouverte + improvements listés", () => {
    const r = compareToBaseline(baseline, agg(78, { business_depth: 4.2, proactivity: 3.8 }));
    expect(r.pass).toBe(true);
    expect(r.improvements.length).toBeGreaterThan(0);
  });

  it("petite variation sous la tolérance → ni régression ni amélioration", () => {
    const r = compareToBaseline(baseline, agg(70.5, { business_depth: 3.4, proactivity: 3.1 }));
    expect(r.pass).toBe(true);
    expect(r.regressions).toEqual([]);
    expect(r.improvements).toEqual([]);
  });

  it("tolérance configurable", () => {
    const strict = compareToBaseline(baseline, agg(69, { business_depth: 3.5, proactivity: 3.0 }), { overallTolerance: 0.5 });
    expect(strict.pass).toBe(false); // -1 dépasse une tolérance de 0.5
  });
});

describe("makeBaseline", () => {
  it("crée une référence amorcée à partir d'une mesure", () => {
    const b = makeBaseline(agg(72), "premier vrai run");
    expect(b.seeded).toBe(true);
    expect(b.aggregate.overall).toBe(72);
    expect(b.note).toBe("premier vrai run");
  });
});
