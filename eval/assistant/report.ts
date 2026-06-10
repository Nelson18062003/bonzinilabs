// RAPPORT QUALITÉ Mola — transforme « Mola fait robot » (un ressenti) en :
//   1) un SCORE /100, 2) l'axe le plus FAIBLE, 3) les THÈMES robotiques classés,
//   4) la liste des pires échantillons à PROMOUVOIR en cas de régression (cases.ts).
//
// PUR (testable sous vitest), comme grade.ts / judge.ts.

import {
  type JudgeVerdict, type JudgeSample, type QualityDimension,
  DIMENSIONS, RUBRIC, weightedScore, aggregateQuality, QUALITY_FAIL_THRESHOLD,
} from "./judge.ts";

export interface ThemeCluster {
  theme: string;
  count: number;
  avgScore: number;       // score pondéré moyen des échantillons du thème
  severity: number;       // count × (100 - avgScore) → priorise fréquent ET mauvais
  exampleId: string;
  exampleCritique: string;
  exampleEvidence?: string;
}

/** Regroupe les verdicts par thème de défaut et classe par sévérité (impact). */
export function clusterThemes(verdicts: JudgeVerdict[]): ThemeCluster[] {
  const byTheme = new Map<string, JudgeVerdict[]>();
  for (const v of verdicts) {
    const arr = byTheme.get(v.theme) ?? [];
    arr.push(v);
    byTheme.set(v.theme, arr);
  }
  const clusters: ThemeCluster[] = [];
  for (const [theme, vs] of byTheme) {
    const avg = vs.reduce((s, v) => s + weightedScore(v.scores), 0) / vs.length;
    const worst = [...vs].sort((a, b) => weightedScore(a.scores) - weightedScore(b.scores))[0];
    clusters.push({
      theme,
      count: vs.length,
      avgScore: Math.round(avg * 10) / 10,
      severity: Math.round(vs.length * (100 - avg) * 10) / 10,
      exampleId: worst.id,
      exampleCritique: worst.critique,
      exampleEvidence: worst.evidence,
    });
  }
  return clusters.sort((a, b) => b.severity - a.severity);
}

/** Les pires échantillons (sous le seuil), à transformer en cas de régression. */
export function promotionCandidates(
  verdicts: JudgeVerdict[],
  samples: Map<string, JudgeSample>,
  limit = 10,
): Array<{ sample: JudgeSample; score: number; critique: string }> {
  return verdicts
    .map((v) => ({ v, score: weightedScore(v.scores) }))
    .filter((x) => x.score < QUALITY_FAIL_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => ({ sample: samples.get(x.v.id)!, score: x.score, critique: x.v.critique }))
    .filter((x) => x.sample);
}

function bar(scoreOn5: number): string {
  const filled = Math.round((scoreOn5 / 5) * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** Rend le rapport Markdown complet (le livrable hebdo que tu lis). */
export function renderReport(
  verdicts: JudgeVerdict[],
  samples: Map<string, JudgeSample>,
  meta: { generatedAt: string; corpus: string } = { generatedAt: new Date().toISOString(), corpus: "?" },
): string {
  const agg = aggregateQuality(verdicts);
  const clusters = clusterThemes(verdicts);
  const promote = promotionCandidates(verdicts, samples);
  const L: string[] = [];

  L.push(`# Rapport qualité Mola`);
  L.push(``);
  L.push(`- Généré : ${meta.generatedAt}`);
  L.push(`- Corpus : ${meta.corpus} (${agg.count} échantillons)`);
  L.push(`- **Score global : ${agg.overall}/100**  ·  Échantillons sous ${QUALITY_FAIL_THRESHOLD} : ${agg.failing}/${agg.count}`);
  if (agg.weakest) L.push(`- **Axe le plus faible : ${RUBRIC[agg.weakest].label}** (${agg.byDimension[agg.weakest]}/5) → à travailler en priorité`);
  L.push(``);

  L.push(`## Profil par axe`);
  L.push(``);
  for (const d of DIMENSIONS) {
    const s = agg.byDimension[d as QualityDimension];
    L.push(`- ${RUBRIC[d].label.padEnd(18)} ${bar(s)} ${s}/5`);
  }
  L.push(``);

  L.push(`## Ce qui fait « robot » — thèmes classés par impact`);
  L.push(``);
  if (clusters.length === 0) {
    L.push(`_(aucun échantillon)_`);
  } else {
    L.push(`| # | Thème | Occur. | Score moy. | Sévérité | Exemple |`);
    L.push(`|---|---|---|---|---|---|`);
    clusters.slice(0, 12).forEach((c, i) => {
      const ex = (c.exampleEvidence ?? c.exampleCritique).replace(/\|/g, "/").slice(0, 80);
      L.push(`| ${i + 1} | \`${c.theme}\` | ${c.count} | ${c.avgScore} | ${c.severity} | ${ex} |`);
    });
  }
  L.push(``);

  L.push(`## À promouvoir en cas de régression (cases.ts)`);
  L.push(``);
  L.push(`> Colle ces vrais ratés dans \`eval/assistant/cases.ts\` : ils deviennent des tests`);
  L.push(`> permanents. Le README le dit — « ajouter TES questions, c'est le plus important ».`);
  L.push(``);
  if (promote.length === 0) {
    L.push(`_(rien sous le seuil — 🎉)_`);
  } else {
    for (const p of promote) {
      L.push(`- **${p.score}/100** — _${p.critique}_`);
      L.push(`  - Q : « ${p.sample.question.slice(0, 160)} »`);
    }
  }
  L.push(``);
  L.push(`## Prochaine étape de la boucle`);
  L.push(``);
  L.push(`1. L'axe faible ci-dessus = la cible de la prochaine amélioration du prompt/des connaissances.`);
  L.push(`2. Proposer le changement (bloc de connaissance métier, règle de proactivité, ou nouvel outil).`);
  L.push(`3. Re-lancer \`quality-run.ts\` : ne livrer que si le score global MONTE (porte anti-régression).`);
  return L.join("\n");
}
