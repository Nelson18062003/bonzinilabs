// node tools/qa.js — storyboard constraints checked on the REAL timing (data/timing.json). Exit code 1 on any ERROR.
// What it checks (STORYBOARD §2, §3, §5.4–5.7):
//   • the timing contract: timing.json = {dur, words} only; the score reads it in node AND in the browser (01_score.js is
//     re-evaluated in a sandbox with window.TIMING, the way render.mjs injects it: same N, T, A); the word anchors resolve
//   • voices: N2 ends ≤ 6.85; no two voices overlap; the CTA pill and N6 come after R1b; T.end = END(N6) + .30
//   • picture: the STOP at 7.00 (freeze r 7.60, chrono « 0 », stamp, music cut); the chrono digit changes only on tics that
//     are frame-exact and on beats 1 and 3 of the 120 bpm grid; the zoom freeze is r 1.00 (frame 30) and lands ×4 on
//     (540, 1020); R1 / R2 / R1b play on their own pictures at real speed; the employee spans (r 0–0.4, 2.9–5.6) are never
//     frozen, slowed or reversed; the rewind never shows r 2.80–5.70
//   • type: every string exactly as the storyboard writes it; each text held ≥ 1.4 s; ≤ 3 text blocks + the mention at
//     every frame; the mention covers 0 → A.card and A.cta → end; the safe zones of §2
//   • code hygiene: no Math.random, no ctx.filter in the scenes; data/timeline_main.json = N; audio/mix.wav = T.end AND
//     built on this very timing (audio/score_cues.json = the score now: a stale mix is an ERROR, not a warning)
//   • narrator rate ≤ 3.85 syl/s as played (takes.json « stretch » counted), DICTION 6
// The WhatsApp variant (STORYBOARD §6): BZ_VARIANT=wa node tools/qa.js (pill « en message », N6w timing, audio_wa/).
const fs = require('fs'), path = require('path'), vm = require('vm');
const P = path.resolve(__dirname, '..'), SC = path.join(P, 'overlay', 'scenes');
const S = require(path.join(SC, '01_score.js'));
const { T, A, DUR, REAL, G, FPS, N } = S;
const ERR = [], WARN = [], OK = [];
const err = m => ERR.push(m), warn = m => WARN.push(m), ok = m => OK.push(m);
const f3 = x => (+x).toFixed(3), eq = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

// ---------- 1. timing contract ----------
const TM = readJ(path.join(P, 'data', 'timing.json'));
if (!TM) err('data/timing.json missing: the film runs on the default durations');
else {
  const extra = Object.keys(TM).filter(k => !['dur', 'words', 'note'].includes(k));
  if (extra.length) err(`timing.json carries more than {dur, words}: ${extra.join(', ')}`);
  for (const id0 of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6']) {
    const id = (S.VARIANT === 'wa' && id0 === 'N6') ? 'N6w' : id0;     // the WhatsApp variant is timed on N6w
    if (!(TM.dur && TM.dur[id] > 0)) err(`timing.json: no dur for ${id}`);
    else if (!eq(DUR[id0], TM.dur[id])) err(`score DUR.${id0} ${DUR[id0]} ≠ timing.json ${id} ${TM.dur[id]} (node does not read timing.json)`);
    if (!(TM.words && TM.words[id] && TM.words[id].length)) err(`timing.json: no words for ${id}`);
  }
  // the browser path: evaluate 01_score.js exactly as the page does (window.TIMING injected before the script)
  const ctxB = { window: { VARIANT: S.VARIANT, TIMING: TM, LABEL_TRACK: readJ(path.join(P, 'data', 'label_track.json')), ZOOM: { geo: readJ(path.join(P, 'assets', 'zoom', 'r100_x4.json')) } }, console };
  vm.createContext(ctxB); vm.runInContext(fs.readFileSync(path.join(SC, '01_score.js'), 'utf8'), ctxB);
  const SB = ctxB.window.SCORE;
  if (!SB) err('01_score.js does not set window.SCORE in the browser path');
  else {
    const dT = Object.keys(T).filter(k => !eq(T[k], SB.T[k])), dA = Object.keys(A).filter(k => !eq(A[k], SB.A[k]));
    if (SB.N !== N || dT.length || dA.length) err(`browser score ≠ node score (N ${SB.N}/${N}; T ${dT.join(',')}; A ${dA.join(',')})`);
    else ok(`browser path (window.TIMING) = node path: N ${N}, ${Object.keys(T).length} T keys, ${Object.keys(A).length} A keys identical`);
  }
  const rm = fs.readFileSync(path.join(P, 'overlay', 'render.mjs'), 'utf8');
  if (!/data\/timing\.json/.test(rm) || !/window\.TIMING\s*=/.test(rm)) err('render.mjs does not inject data/timing.json as window.TIMING');
}
// word anchors resolve on real words (not the syllable fallbacks)
const wordOf = (id, pre) => (TM && TM.words && TM.words[id] || []).find(w => w.w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').startsWith(pre));
for (const [k, id, pre] of [['arrow', 'N4', 'bonz'], ['pulse', 'N4', 'debut'], ['chine', 'N5', 'chin'], ['doua', 'N5', 'doua']]) {
  const w = wordOf(id, pre);
  if (!w) err(`A.${k}: no word « ${pre}… » in ${id}: the syllable fallback is used`);
  else if (!eq(A[k], T[id] + w.s, 1e-4)) err(`A.${k} = ${f3(A[k])} ≠ T.${id} + ${w.w}.s = ${f3(T[id] + w.s)}`);
}
// takes
const TK = readJ(path.join(P, 'data', 'takes.json'));
if (!TK) err('data/takes.json missing');
else for (const id of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N6w']) {
  const tk = TK[id]; if (!tk) { err(`takes.json: no take for ${id}`); continue; }
  if (!fs.existsSync(path.join(P, 'audio', 'vo', tk.file))) err(`take file missing: audio/vo/${tk.file}`);
  const st = tk.stretch || 1, rate = tk.rate / st;               // takes.json « stretch »: played × st slower
  if (TM && TM.dur && !eq(TM.dur[id], tk.dur * st, 2e-3)) err(`timing.json dur.${id} ${TM.dur[id]} ≠ takes.json ${tk.dur} × ${st}`);
  if (rate > 3.85) warn(`${id} (${tk.file}${st !== 1 ? ` ×${st}` : ''}) speaks at ${rate.toFixed(2)} syl/s (> 3.85; DICTION 6 aims at 3.5–3.8)`);
}

// ---------- 2. voices ----------
const END = id => T[id] + DUR[id];
if (END('N2') > 6.85 + 1e-6) err(`N2 ends at ${f3(END('N2'))} > 6.85`); else ok(`N2 ${f3(T.N2)}–${f3(END('N2'))} ends ≤ 6.85`);
if (!eq(T.N1, 2.15)) err(`T.N1 = ${T.N1} ≠ 2.15 (fixed)`);
const voices = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'].map(k => [T[k], END(k), k]).concat(Object.values(REAL).map(R => [R.t, R.end, R.id])).sort((a, b) => a[0] - b[0]);
for (let i = 1; i < voices.length; i++) if (voices[i][0] < voices[i - 1][1] - 1e-6) err(`voices overlap: ${voices[i - 1][2]} (→ ${f3(voices[i - 1][1])}) / ${voices[i][2]} (${f3(voices[i][0])} →)`);
ok('voices in order: ' + voices.map(v => `${v[2]} ${f3(v[0])}–${f3(v[1])}`).join(' · '));
if (!(A.pill >= REAL.R1b.speech[1] - 1e-6)) err(`the CTA pill (${f3(A.pill)}) lands before R1b's speech ends (${f3(REAL.R1b.speech[1])})`);
if (!(T.N6 >= REAL.R1b.end - 1e-6)) err(`N6 (${f3(T.N6)}) starts before the R1b clip ends (${f3(REAL.R1b.end)})`);
else ok(`CTA after R1b: R1b speech ends ${f3(REAL.R1b.speech[1])}, clip ${f3(REAL.R1b.end)} → pill ${f3(A.pill)} → N6 ${f3(T.N6)}`);
if (!eq(T.end, END('N6') + .30)) err(`T.end ${T.end} ≠ END(N6) + .30 = ${f3(END('N6') + .3)}`);
if (N !== Math.round(T.end * FPS)) err(`N ${N} ≠ round(T.end × 30)`);
if (T.end < 20 || T.end > 45) err(`T.end ${T.end} outside 20–45 s`);
ok(`T.end = END(N6) + .30 = ${T.end} s · N = ${N} frames`);
const M = S.music();
if (REAL.R1.end > M.silentUntil + 1e-6) err('music starts under R1');
for (const R of [REAL.R2, REAL.R1b]) if (!M.noMusic.some(([a, b]) => a <= R.t + 1e-6 && b >= R.end - 1e-6)) err(`music not cleared under ${R.id}`);

// ---------- 3. picture ----------
const r = S.r, step = 1 / 240;
// the STOP
if (!eq(A.stop, 7.00)) err(`A.stop = ${A.stop} ≠ 7.00`);
for (let t = A.stop; t < A.rew; t += step) if (!eq(r(t), S.RUSH.stopR)) { err(`STOP freeze is not r 7.60 at ${f3(t)}`); break; }
if (S.chrono(A.stop).digit !== 0) err('chrono is not « 0 » at the STOP');
if (!S.soundCues().some(c => eq(c.t, A.stop) && c.name === 'stamp_big')) err('no stamp at the STOP');
if (!eq(M.cut, A.stop)) err(`music cut ${M.cut} ≠ A.stop`);
ok(`STOP at ${f3(A.stop)}: freeze r 7.60 until ${f3(A.rew)}, chrono « 0 », stamp + music cut`);
// the chrono digit changes only on the music grid (tics frame-exact, beats 1 and 3)
const changes = []; let prev = null;
for (let n = 0; n <= Math.round(A.stop * FPS); n++) { const d = S.chrono(n / FPS).digit; if (prev !== null && d !== prev) changes.push(n / FPS); prev = d; }
const onGrid = t => { const b = (t - M.grid0) / M.beat; return eq(b, Math.round(b), 1e-6) && Math.round(b) % 2 === 0; };
const ticks = M.ticks;
if (changes.length !== 7) err(`chrono digit changes ${changes.length}× during the hunt (expected 7: 7→6 … 1→0)`);
for (const t of changes) if (![...ticks, A.stop].some(k => eq(k, t, 1e-6)) || !onGrid(t) || !eq(t * FPS, Math.round(t * FPS), 1e-6)) err(`chrono digit changes at ${f3(t)}: not a frame-exact tic on beats 1/3`);
const tics = S.soundCues().filter(c => c.name === 'tic_wood').map(c => c.t);
if (tics.length !== 7 || tics.some((t, i) => !eq(t, ticks[i], 1e-4))) err('tic_wood cues ≠ the chrono tics');
if (!eq(S.chrono(T.N4 + .1).digit, 6)) err('chrono is not « 6 » during the answer');
ok(`chrono digit changes at ${changes.map(x => x.toFixed(2)).join(', ')} = tics on beats 1/3 of the 120 bpm grid (downbeat ${M.grid0})`);
// the zoom freeze on r 1.00
for (let t = A.zoom; t < A.whip + .05; t += step) if (!eq(r(t), S.RUSH.zoomR) || S.frameOf(t) !== 30) { err(`zoom freeze is not r 1.00 / frame 30 at ${f3(t)}`); break; }
const cz = S.cam(A.ring), lz = S.label(A.ring);
if (!eq(cz.s, 4, 1e-3) || Math.abs(lz.cx - 540) > 1 || Math.abs(lz.cy - 1020) > 1) err(`×4 landing: s ${cz.s.toFixed(3)}, label centre (${lz.cx.toFixed(1)}, ${lz.cy.toFixed(1)})`);
if (S.zoomLayer(A.ring) < 1) err('the HD zoom layer is not fully in at ×4');
if (!fs.existsSync(path.join(P, 'assets', 'zoom', 'r100_x4.png'))) err('assets/zoom/r100_x4.png missing (no mosaic)');
ok(`zoom freeze r 1.00 (frame 30) ${f3(A.zoom)}–${f3(A.whip + .05)}, ×4 at ${f3(A.ring)} with the label at (${lz.cx.toFixed(0)}, ${lz.cy.toFixed(0)}), ${lz.w.toFixed(0)}×${lz.h.toFixed(0)} px`);
// the real voices on their own pictures, real speed
for (const R of Object.values(REAL)) {
  let bad = null; for (let t = R.t; t <= R.end + 1e-9; t += step) if (!eq(r(t), R.src[0] + (t - R.t), 1e-6)) { bad = t; break; }
  if (bad !== null) err(`${R.id} not on its own pictures at ${f3(bad)} (r ${r(bad).toFixed(3)} ≠ ${(R.src[0] + bad - R.t).toFixed(3)})`);
}
ok(`R1 / R2 / R1b on their own pictures at ×1: ${Object.values(REAL).map(R => `${R.id} film ${f3(R.t)} = r ${R.src[0]}`).join(' · ')}`);
// the employee (r 0–0.4 and 2.9–5.6): never frozen, slowed, reversed; the rewind skips him
const EMP = [[0, .4], [2.9, 5.6]], inEmp = x => EMP.some(([a, b]) => x > a + 1e-6 && x < b - 1e-6);
for (let t = 0; t < T.end; t += step) {
  const a = r(t), b = r(t + step), v = (b - a) / step;
  if (inEmp(a) && inEmp(b) && Math.abs(b - a) < 1 && v < 1 - 1e-6) { err(`employee span r ${a.toFixed(3)} played at ×${v.toFixed(2)} at ${f3(t)} (frozen / slowed / reversed)`); break; }
}
for (let t = A.rew; t < A.zoom; t += step) if (r(t) > 2.80 + 1e-6 && r(t) < 5.70 - 1e-6) { err(`rewind shows r ${r(t).toFixed(3)}`); break; }
const w0 = S.check(); for (const m of w0) err('SCORE.check: ' + m);
ok('employee spans only at ×1 or ×2 forward; rewind 7.60→5.70 | 2.80→1.00; SCORE.check() clean');

// ---------- 4. type ----------
const NB = /[  ]/g, txt = {}; for (const q of S.TEXTS()) txt[q[2]] = q;
const WANT = { mention: 'VRAIE VIDÉO · EN CHINE', mentionZoom: 'VRAIE IMAGE · ZOOM × 4', mention2: 'VRAIE VIDÉO · EN CHINE', mention3: 'VRAIE VIDÉO · EN CHINE',
  title1: 'TROUVE LE MOT', title2: 'BONZINI', title3: 'écrit sur un colis', chronoLabel: 'secondes', sub1: '« Bonsoir, bonsoir. »', stop: 'STOP !',
  question: "TU L'AS VU ?", answer: 'LE MOT *BONZINI*|ÉTAIT LÀ|DÈS LE DÉBUT !', hand: 'écrit à la main', sub2: '« Merci de faire confiance|à *Bonzini Trading*. »',
  plate: 'BONZINI TRADING CARGO', service: 'TES COLIS VONT|DE CHINE À DOUALA.', routeChine: 'CHINE', routeDouala: 'DOUALA', by: 'Par bateau ou par avion.',
  sub3: '« Bonsoir, bonsoir. »', cta: S.VARIANT === 'wa' ? 'Réponds-lui en message :|*BONSOIR*' : 'Réponds-lui en commentaire :|*BONSOIR*' };
for (const [id, s] of Object.entries(WANT)) { const q = txt[id]; if (!q) err(`text ${id} missing`); else if (q[3].replace(NB, ' ') !== s) err(`text ${id}: « ${q[3]} » ≠ « ${s} »`); }
if (Object.keys(txt).some(k => !WANT[k])) err('texts not in the storyboard: ' + Object.keys(txt).filter(k => !WANT[k]).join(', '));
ok(`${Object.keys(WANT).length} strings exactly as the storyboard (NBSP before : ? ! and inside « »)`);
// holds ≥ 1.4 s (the storyboard's list, on the real timing): visible window = [t0, t1) minus the exit animation
const vis = { title1: [0, A.stop], title2: [0, A.stop], title3: [A.hint, A.stop], stop: [A.stop, A.stopPeel], answer: [A.answer, A.out], hand: [A.hand, A.out] };
const HOLD = ['title1', 'title3', 'sub1', 'stop', 'question', 'answer', 'hand', 'sub2', 'plate', 'service', 'by', 'sub3', 'cta'];
const span = id => vis[id] || [txt[id][0], Math.min(txt[id][1], T.end)];
for (const id of HOLD) { const [a, b] = span(id); if (b - a < 1.4 - 1e-6) err(`${id} held ${(b - a).toFixed(2)} s < 1.4 (${f3(a)}–${f3(b)})`); }
ok('holds ≥ 1.4 s: ' + HOLD.map(id => { const [a, b] = span(id); return `${id} ${(b - a).toFixed(2)}`; }).join(' · '));
for (const id of ['routeChine', 'routeDouala']) { const [a, b] = span(id); if (b - a < 1.4) warn(`${id} (route label, spoken-word anchored, also in the 3.8 s sentence) shows ${(b - a).toFixed(2)} s`); }
// ≤ 3 blocks + the mention, every frame (a block = the texts that read as one: the title plate, the route + its by-line)
const BLOCK = { title1: 'title', title2: 'title', title3: 'title', chronoLabel: 'chrono', routeChine: 'route', routeDouala: 'route', by: 'route' };
const gone = { title1: A.stop + .12, title2: A.stop + .12, title3: A.stop + .12, stop: A.stopPeel + .14 };   // alpha 0 from there (60_type)
let maxB = 0, at = 0, list = [];
for (let n = 0; n < N; n++) {
  const t = n / FPS, on = new Set();
  for (const q of S.TEXTS()) { const id = q[2]; if (q[4] === 'mention') continue; if (t >= q[0] && t < Math.min(q[1], gone[id] ?? 1e9)) on.add(BLOCK[id] || id); }
  if (on.size > maxB) { maxB = on.size; at = t; list = [...on]; }
  if (on.size > 3) { err(`${on.size} text blocks at ${f3(t)}: ${[...on].join(', ')}`); break; }
}
ok(`≤ 3 blocks + the mention at every frame (max ${maxB} at ${f3(at)}: ${list.join(', ')})`);
// the mention: 0 → A.card and A.cta → T.end
const mspans = S.TEXTS().filter(q => q[4] === 'mention').map(q => [q[0], q[1]]);
const covered = t => mspans.some(([a, b]) => t >= a && t < b);
for (let n = 0; n < N; n++) { const t = n / FPS; const want = t < A.card || t >= A.cta; if (want && !covered(t)) { err(`no mention at ${f3(t)}`); break; } if (!want && covered(t) && t >= A.card + .3) { err(`mention over the card at ${f3(t)}`); break; } }
// safe zones (§2 geometry)
const box = (id, x0, y0, x1, y1) => { if (y0 < G.safe.top) err(`${id}: y ${y0} < 150`); if (y1 > G.safe.bottom) err(`${id}: y ${y1} > 1540`);
  if (x1 > G.safe.rightX && y1 > G.safe.rightY0 && y0 < G.safe.rightY1) err(`${id}: x ${x1} > 960 within y 900–1560`); };
box('mention', G.mention.x, G.mention.y0, 700, G.mention.y1); box('chrono', G.chrono.x0, G.chrono.y0, G.chrono.x1, G.chrono.label.y1);
for (const k of ['sub1', 'sub2', 'sub3']) box(k, G[k].x0, G[k].y0, G[k].x1, G[k].y1);
box('pill', G.pill.x0, G.pill.y0, G.pill.x1, G.pill.y1); box('hand', G.hand.x0, G.hand.y0, G.hand.x1, G.hand.y1);
box('card.route', G.card.route.x0, G.card.route.y0, G.card.route.x1, G.card.route.y1); box('card.by', 240, G.card.by.y0, 840, G.card.by.y1);
if (G.chrono.label.y1 > 400) err('chrono below y 400');
ok('safe zones: nothing above y 150, no text right of x 960 in y 900–1560, nothing important below y 1540');

// ---------- 5. hygiene + outputs ----------
for (const f of fs.readdirSync(SC).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(SC, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/Math\.random\s*\(/.test(src)) err(`${f}: Math.random`);
  if (/\.filter\s*=(?!=)(?!\s*['"`]none['"`])/.test(src)) err(`${f}: ctx.filter`);
}
const WA = S.VARIANT === 'wa', AUD = path.join(P, WA ? 'audio_wa' : 'audio'), TLF = WA ? 'timeline_wa.json' : 'timeline_main.json';
const TL = readJ(path.join(P, 'data', TLF));
if (!TL || TL.frames !== N) warn(`data/${TLF} frames ${TL && TL.frames} ≠ N ${N} (render.mjs rewrites it on its next run)`);
// the mix must have been built on THIS timing: lib/audio_rush.py dumps the score it read next to the mix
const CU = readJ(path.join(AUD, 'score_cues.json'));
if (!CU) err(`${path.relative(P, AUD)}/score_cues.json missing: run lib/audio_rush.py${WA ? ' --n6w' : ''}`);
else {
  const dT = Object.keys(T).filter(k => !(k in CU.T) || !eq(T[k], CU.T[k], 1e-4)), dA = Object.keys(A).filter(k => (k in CU.A) && !eq(A[k], CU.A[k], 1e-4));
  if (dT.length || dA.length) err(`${path.relative(P, AUD)}/mix.wav was built on another timing (T ${dT.join(',')} · A ${dA.join(',')}): re-run lib/audio_rush.py${WA ? ' --n6w' : ''}`);
  else ok(`${path.relative(P, AUD)}/mix.wav built on this timing (score_cues.json: ${Object.keys(T).length} T + ${Object.keys(CU.A).length} A keys equal)`);
}
try {
  const b = fs.readFileSync(path.join(AUD, 'mix.wav')); let o = 12, sr = 0, ch = 0, bits = 0, len = 0;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); } if (id === 'data') { len = sz; break; } o += 8 + sz + (sz & 1); }
  const d = len / (ch * bits / 8) / sr;
  const rel = path.relative(P, AUD);
  if (Math.abs(d - T.end) > 1 / sr * 2) err(`${rel}/mix.wav lasts ${d.toFixed(4)} s ≠ T.end ${T.end} (re-run lib/audio_rush.py${WA ? ' --n6w' : ''})`); else ok(`${rel}/mix.wav = ${d.toFixed(4)} s = T.end`);
} catch (e) { err(`${path.relative(P, AUD)}/mix.wav not readable`); }

// ---------- report ----------
console.log(`QA « TROUVE LE MOT. »${S.VARIANT === 'wa' ? ' [WhatsApp variant: BZ_VARIANT=wa]' : ''} — real timing: T.end ${T.end} s, N ${N} frames, takes ${TK ? Object.entries(TK).filter(([k]) => /^N\d$/.test(k)).map(([k, v]) => `${k} ${v.file}`).join(' ') : '—'}`);
for (const m of OK) console.log('  ok    ' + m);
for (const m of WARN) console.log('  WARN  ' + m);
for (const m of ERR) console.log('  ERROR ' + m);
console.log(ERR.length ? `FAILED: ${ERR.length} error(s), ${WARN.length} warning(s)` : `PASSED (${WARN.length} warning(s))`);
process.exit(ERR.length ? 1 : 0);
