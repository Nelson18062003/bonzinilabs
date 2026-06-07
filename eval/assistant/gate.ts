// PORTE ANTI-RÉGRESSION qualité de Mola.
//
// Principe : on garde une RÉFÉRENCE (la dernière qualité acceptée, dans
// quality-baseline.json). À chaque modif du prompt/du playbook, on re-mesure et on
// COMPARE. Si la note baisse (globale ou sur un axe), la porte se ferme → la régression
// ne peut pas être livrée en silence. Si la note monte, on met à jour la référence.
//
// PUR (testable sous vitest), comme judge.ts / report.ts.

import {
  type QualityAggregate, type QualityDimension, DIMENSIONS, RUBRIC,
} from "./judge.ts";

/** Fichier de référence (quality-baseline.json). */
export interface Baseline {
  /** false tant qu'aucune vraie mesure n'a été enregistrée → la porte n'aboie pas. */
  seeded: boolean;
  updatedAt: string;
  note?: string;
  aggregate: QualityAggregate;
}

export interface GateOptions {
  /** Baisse tolérée du score global /100 avant de fermer la porte (défaut 1.0). */
  overallTolerance?: number;
  /** Baisse tolérée par axe /5 avant de la signaler comme régression (défaut 0.2). */
  dimensionTolerance?: number;
}

export interface GateResult {
  pass: boolean;
  seeded: boolean;
  overallDelta: number;          // candidat − référence
  regressions: string[];         // axes qui ont trop baissé
  improvements: string[];        // axes/global qui ont monté
  lines: string[];               // résumé lisible (console / commentaire PR)
}

const DEFAULTS: Required<GateOptions> = { overallTolerance: 1.0, dimensionTolerance: 0.2 };

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Compare une mesure candidate à la référence et décide d'ouvrir/fermer la porte. */
export function compareToBaseline(
  baseline: Baseline,
  candidate: QualityAggregate,
  opts: GateOptions = {},
): GateResult {
  const o = { ...DEFAULTS, ...opts };
  const overallDelta = round1(candidate.overall - baseline.aggregate.overall);
  const regressions: string[] = [];
  const improvements: string[] = [];
  const lines: string[] = [];

  // Référence pas encore établie : on informe, on ne bloque pas.
  if (!baseline.seeded) {
    lines.push(`Référence qualité non encore établie — porte en mode informatif.`);
    lines.push(`Score candidat : ${candidate.overall}/100 (${candidate.count} échantillons).`);
    lines.push(`→ Valider ce score comme première référence : lancer en mode --update-baseline.`);
    return { pass: true, seeded: false, overallDelta, regressions, improvements, lines };
  }

  lines.push(`Score : ${baseline.aggregate.overall} → ${candidate.overall} (${overallDelta >= 0 ? "+" : ""}${overallDelta})`);

  // Global
  if (overallDelta < -o.overallTolerance) {
    regressions.push(`global ${baseline.aggregate.overall} → ${candidate.overall} (${overallDelta})`);
  } else if (overallDelta > o.overallTolerance) {
    improvements.push(`global +${overallDelta}`);
  }

  // Par axe
  for (const d of DIMENSIONS as QualityDimension[]) {
    const before = baseline.aggregate.byDimension[d] ?? 0;
    const after = candidate.byDimension[d] ?? 0;
    const delta = round2(after - before);
    const label = RUBRIC[d].label;
    if (delta < -o.dimensionTolerance) {
      regressions.push(`${label} ${before} → ${after} (${delta})`);
      lines.push(`  ⚠️ ${label} : ${before} → ${after} (${delta})`);
    } else if (delta > o.dimensionTolerance) {
      improvements.push(`${label} +${delta}`);
      lines.push(`  ✅ ${label} : ${before} → ${after} (+${delta})`);
    }
  }

  const pass = regressions.length === 0;
  lines.push(pass
    ? (improvements.length ? `PORTE OUVERTE — amélioration nette. Pense à mettre à jour la référence.` : `PORTE OUVERTE — qualité stable.`)
    : `PORTE FERMÉE — ${regressions.length} régression(s) : ${regressions.join(" ; ")}`);

  return { pass, seeded: true, overallDelta, regressions, improvements, lines };
}

/** Fabrique une nouvelle référence à partir d'une mesure (mode --update-baseline). */
export function makeBaseline(aggregate: QualityAggregate, note?: string): Baseline {
  return { seeded: true, updatedAt: new Date().toISOString(), note, aggregate };
}
