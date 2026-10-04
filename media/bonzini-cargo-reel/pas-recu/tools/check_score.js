const S = require('../overlay/scenes/01_score.js');
let worst = {};
const objs = { steel: S.steel, amber: S.amber, proof: S.proofPlate, violet: S.violetPlate };
for (let n = 0; n < S.N; n++) { const t = n / 30, t2 = (n + 1) / 30;
  for (const [k, fn] of Object.entries(objs)) { const a = fn(t), b = fn(t2); if (!a || !b) continue; const d = Math.hypot(b.x - a.x, b.y - a.y); if (!worst[k] || d > worst[k][0]) worst[k] = [Math.round(d), +t.toFixed(2)]; } }
console.log('max px/frame', JSON.stringify(worst));
for (const t of [0.5, 1.25, 1.9, 2.3, 2.68, 3.2, 5.0, 6.5, 8.3, 9.5, 11.5, 13.2, 13.6, 14.8, 16, 21]) {
  const st = S.steel(t), am = S.amber(t);
  console.log(t, 'steel', st ? Math.round(st.y) : '-', 'amber', am ? `${Math.round(am.y)} s${am.s.toFixed(2)} sy${am.sy.toFixed(2)} ${am.txt}` : '-', 'gecko', S.gecko(t).act, 'day', (S.day(t) || {}).s || '-');
}
console.log('cues', S.soundCues().length);
