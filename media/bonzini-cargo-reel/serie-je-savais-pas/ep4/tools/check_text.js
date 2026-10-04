// Readability check of the score's texts: hold time of every key text (≥ 1.4 s), blocks on screen at once (≤ 3),
// and the voice lines (never two at once). usage (from E): node tools/check_text.js
const S = require('../overlay/scenes/01_score.js');
const TX = S.TEXTS(), KEY = new Set(S.BLOCK_STYLES.concat(['pillPas']));
console.log(`film ${S.T.end} s, ${S.N} frames`);
for (const [a, b, id, s, st] of TX) {
  const d = b - a, flag = KEY.has(st) && d < 1.4 ? '  <<< SHORT' : '';
  console.log(`${a.toFixed(2).padStart(6)} → ${b.toFixed(2).padStart(6)}  ${d.toFixed(2).padStart(5)} s  ${id.padEnd(11)} ${st.padEnd(10)} ${s.replace(/\|/g, ' / ')}${flag}`);
}
let worst = 0, at = 0, prev = '';
for (let t = 0; t < S.T.end; t += 1 / 30) {
  const on = TX.filter(([a, b, , , st]) => t >= a && t < b && S.BLOCK_STYLES.includes(st)).map(x => x[2]);
  if (on.length > worst) { worst = on.length; at = t; }
  const key = on.join(',');
  if (on.length > 3 && key !== prev) console.log(`  >3 blocks at ${t.toFixed(2)}: ${key}`);
  prev = key;
}
console.log(`max blocks ${worst} at ${at.toFixed(2)}`);
const L = S.LINES.map(id => [id, S.T[id], S.END(id)]);
for (let i = 1; i < L.length; i++) if (L[i][1] < L[i - 1][2]) console.log(`VOICE OVERLAP ${L[i - 1][0]} / ${L[i][0]}`);
