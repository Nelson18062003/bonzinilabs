// node tools/check_score.js   — prints the score's anchors (on data/timing.json, else the §5.5 defaults), the contract
// warnings (SCORE.check()), a safe-zone audit of the text geometry, the real-voice placements, the music plan and the cues.
const path = require('path');
const S = require(path.join(__dirname, '..', 'overlay', 'scenes', '01_score.js'));
const f = x => typeof x === 'number' ? x.toFixed(3) : x;
console.log(`N = ${S.N} frames · T.end = ${S.T.end} s · DUR ${JSON.stringify(S.DUR)}${JSON.stringify(S.DUR) === JSON.stringify(S.DUR0) ? ' (defaults)' : ''}`);
console.log('T  ', Object.entries(S.T).map(([k, v]) => `${k} ${f(v)}`).join(' · '));
console.log('A  ', Object.entries(S.A).map(([k, v]) => `${k} ${f(v)}`).join(' · '));
const w = S.check(); console.log(w.length ? 'WARN\n  ' + w.join('\n  ') : 'contract: OK (N2 ends ≤ 6.85, lip sync R2/R1b, no reversed r 2.9–5.6, no overlapping voices)');
// safe zones: nothing above y 150; no text right of x 960 for y 900–1560; nothing important below y 1540
const G = S.G, z = []; const box = (id, x0, y0, x1, y1, text = true) => {
  if (y0 < G.safe.top) z.push(`${id}: y0 ${y0} < 150`); if (y1 > G.safe.bottom) z.push(`${id}: y1 ${y1} > 1540`);
  if (text && x1 > G.safe.rightX && y1 > G.safe.rightY0 && y0 < G.safe.rightY1) z.push(`${id}: x1 ${x1} > 960 within y 900–1560`); };
box('mention', G.mention.x, G.mention.y0, 700, G.mention.y1); box('chrono', G.chrono.x0, G.chrono.y0, G.chrono.x1, G.chrono.label.y1);
for (const k of ['sub1', 'sub2', 'sub3']) box(k, G[k].x0, G[k].y0, G[k].x1, G[k].y1);
box('pill', G.pill.x0, G.pill.y0, G.pill.x1, G.pill.y1); box('hand', G.hand.x0, G.hand.y0, G.hand.x1, G.hand.y1);
box('card.by', 240, G.card.by.y0, 840, G.card.by.y1); box('card.route', G.card.route.x0, G.card.route.y0, G.card.route.x1, G.card.route.y1);
console.log(z.length ? 'SAFE ZONES\n  ' + z.join('\n  ') : 'safe zones: OK (geometry of §2)');
console.log('REAL', Object.values(S.REAL).map(r => `${r.id} film ${f(r.t)}–${f(r.end)} src ${r.src.join('–')} fades ${r.fadeIn}/${r.fadeOut} speech ${r.speech.map(f).join('–')}`).join('\n     '));
console.log('music', JSON.stringify(S.music()));
console.log('cues ', S.soundCues().map(c => `${f(c.t)} ${c.name}`).join(' | '));
console.log('texts', S.TEXTS().map(q => `${f(q[0])}–${f(q[1])} ${q[2]}`).join(' | '));
