// QA of the score (stage 3): key-text holds, simultaneous text blocks, action ordering, NaN — on the real timing.json
// and on N jittered re-timings (every voice start moved by −0.4…+0.4 s, durations ±15 %).
// usage (from E): node tools/qa_score.js [jitterRuns=0]
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'overlay/scenes/01_score.js'), 'utf8');
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/timing.json'), 'utf8'));
function load(tm) { const win = { TIMING: tm }; const ctx = { window: win, console }; vm.createContext(ctx); vm.runInContext(SRC, ctx); return win.SCORE; }
function check(S, tag) {
  const A = S.A, T = S.T, bad = [];
  for (const k in A) if (!Number.isFinite(A[k])) bad.push(`A.${k} not finite`);
  const order = [['titleOut', 'toiUp'], ['bateauFall', 'stampM3'], ['bateauOut', 'mes0'], ['mes2', 'formula'], ['formula', 'formulaOut'], ['formulaOut', 'capVide'],
    ['flank', 'hatch0'], ['hatch0', 'hatch1'], ['cut', 'toiSmall'], ['toiSmallOut', 'repack'], ['pose1', 'pose2'], ['pose2', 'pose3'], ['chase', 'gulp'], ['gulp', 'split'],
    ['split', 'splitOut'], ['glass', 'wrap0'], ['wrap0', 'wrap1'], ['ensuite', 'ensuiteOut'], ['ensuite', 'violet'], ['violet', 'plateBZ', .2], ['scan', 'tape'], ['tape', 'volume'],
    ['volume', 'airStrike'], ['airStrike', 'measured'], ['measured', 'endcard'], ['endcard', 'cta'], ['cta', 'stampEnd'], ['stampEnd', 'loop'], ['loop', 'out']];
  for (const [a, b, tol = 1e-6] of order) if (!(A[a] <= A[b] + tol)) bad.push(`order ${a} ${A[a].toFixed(2)} > ${b} ${A[b].toFixed(2)}`);
  if (A.mes0 < T.N2 + S.DUR.N2) bad.push('measure starts under N2 voice'); if (A.formula > T.N3 + .3) bad.push(`formula ${A.formula.toFixed(2)} late vs N3 ${T.N3}`);
  // key texts: [label, t0, t1(read-end)] (≥ 1.4 s)
  const holds = [['title', 0, A.titleOut], ['toi', A.toiUp + .3, A.bateauFall], ['bateau', A.bateauFall, A.bateauOut], ['AU m3', A.stampM3, A.flank],
    ['formula full', A.mes2, A.formulaOut], ['toiSmall', A.toiSmall + .35, A.toiSmallOut], ['MESURÉ', A.measured, A.endcard], ['MAINTENANT', A.stampEnd, A.out], ['BONZINI plate', A.plateBZ, A.endcard]];
  for (const [id, a, b] of S.TEXTS().map(r => [r[2], r[0], r[1]])) if (!['formula', 'formulaSub', 'm3', 'ensuite', 'measured', 'stampEnd'].includes(id)) holds.push([id, a + .14, b - .14]);
  for (const [id, a, b] of holds) if (b - a < 1.4) bad.push(`hold ${id} ${(b - a).toFixed(2)} s`);
  // simultaneous text blocks (texts + plates + bz plate), legal/example + chip excluded, end card counted as storyboard
  let maxB = 0, at = 0;
  for (let t = 0; t < T.end; t += 1 / 30) {
    const tx = S.TEXTS().filter(r => t >= r[0] + .14 && t < r[1] - .14).map(r => r[2]).filter(id => !['formulaSub', 'tag', 'service', 'measured'].includes(id))   // the stamp sits on the readout slip: one block;
    const n = tx.length + S.plates(t).filter(p => p.s > .5 && p.a > .5).length + (S.bzPlate(t) ? 1 : 0);
    if (n > maxB && t < A.endcard) { maxB = n; at = t; }
  }
  if (maxB > 3) bad.push(`${maxB} text blocks at ${at.toFixed(2)}`);
  return bad.map(b => `[${tag}] ${b}`);
}
let all = check(load(BASE), 'real');
const runs = +(process.argv[2] || 0); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let r = 0; r < runs; r++) {
  const tm = JSON.parse(JSON.stringify(BASE)); const ids = ['N1', 'T1', 'N2', 'N3', 'T2', 'N4', 'N5', 'N6', 'N7', 'N8'];
  for (const id of ids.slice(1)) tm[id] = +(tm[id] + (rnd() - .5) * .8).toFixed(3);
  for (const id of ids) tm.dur[id] = +(tm.dur[id] * (.85 + rnd() * .3)).toFixed(3);
  for (let i = 1; i < ids.length; i++) tm[ids[i]] = Math.max(tm[ids[i]], tm[ids[i - 1]] + tm.dur[ids[i - 1]] + .1);   // never two voices at once
  tm.end = Math.max(tm.end, tm.N8 + tm.dur.N8 + .9);
  all = all.concat(check(load(tm), 'jit' + r));
}
const S = load(BASE); console.log('real: N', S.N, 'end', S.T.end); console.log(all.length ? all.join('\n') : 'OK — no issue');
