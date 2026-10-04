// ep1 « TCHAC ! » v2 — QA of the score: SCRIPT_V2.md §6.3 constraints, key-text holds (≥ 1.4 s), action order, sound
// effects kept out of the speech (« bruitage seul »), NaN. On data/timing.json when it exists, else on the score's defaults;
// plus N simulated re-timings that replay serie/retime.py's placement (default spacing + cumulative shift, gap ≥ GAP s)
// with every take's duration × LO…HI (default 0.9…1.15) and no word list (fallbacks scaled) — they show which constraint a long take breaks.
// usage (from E): node tools/qa_score.js [runs=0] [gap=0.12] [lo=0.9] [hi=1.15] [--timing other_timing.json]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const E = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(E, 'overlay/scenes/01_score.js'), 'utf8');
const ARGS = process.argv.slice(2), TI = ARGS.indexOf('--timing'), TJ = TI >= 0 ? path.resolve(ARGS[TI + 1]) : path.join(E, 'data/timing.json');
if (TI >= 0) ARGS.splice(TI, 2);
const REAL = fs.existsSync(TJ) ? JSON.parse(fs.readFileSync(TJ, 'utf8')) : null;
function load(tm) { const win = tm ? { TIMING: tm } : {}; const ctx = { window: win, console }; vm.createContext(ctx); vm.runInContext(SRC, ctx); return win.SCORE; }
const IDS = ['N1', 'N2', 'T1', 'N3', 'N4', 'N5', 'N6', 'N7', 'T2', 'N8', 'N9', 'N10'];
// §6.3 minimum silences between consecutive lines
const SIL = { N2: .45, T1: .40, N3: .60, N4: .60, N5: .70, N6: .70, N7: .60, T2: .50, N8: .40, N9: .50, N10: .40 };
function check(S, tag) {
  const A = S.A, T = S.T, D = S.DUR, END = id => T[id] + D[id], bad = [], warn = [], f2 = x => x.toFixed(2);
  const flat = Object.entries(A).flatMap(([k, v]) => Array.isArray(v) ? v.map((x, i) => [k + '[' + i + ']', x]) : [[k, v]]);
  for (const [k, v] of flat) if (!Number.isFinite(v)) bad.push(`A.${k} not finite`);
  // 1 — §6.3 (silences = warnings: the lead's re-timing owns them; the action constraints = errors)
  if (T.N1 < .4 - 1e-6) warn.push(`T.N1 ${f2(T.N1)} < 0.40 (the two dry snips come before the voice)`);
  for (let i = 1; i < IDS.length; i++) { const a = IDS[i - 1], b = IDS[i], g = T[b] - END(a); if (g < SIL[b] - .005) warn.push(`silence ${a}→${b} ${f2(g)} s < ${SIL[b]}`); }
  const C = [['T.T1 ≥ challenge + .05', T.T1, A.challenge + .05], ['T.N3 ≥ tics[2] + .05', T.N3, A.tics[2] + .05],
    ['W(N6,cinq) − .5 ≥ feet', S.W('N6', 'cinq', 0, 1.11) - .5, A.feet], ['T.T2 ≥ coinSettle + .2', T.T2, A.coinSettle + .2],
    ['brandIn − priceTag ≥ 1.4', A.brandIn - A.priceTag, 1.4], ['T.end ≥ END(N10) + .5', T.end, END('N10') + .5], ['T.end ≥ ritual + 1.9', T.end, A.ritual + 1.9]];
  for (const [n, a, b] of C) if (a < b - 1e-6) bad.push(`§6.3 ${n}: ${f2(a)} < ${f2(b)}`);
  // 2 — key holds (s): what the eye gets before the thing leaves
  const H = [['PAYÉE stamp', A.challenge - A.stampBuy], ['NE SE VENDENT PAS stamp', A.musicCut + .3 - A.stampInv], ['strip −500 par paire vendue', A.musicCut + .3 - A.invSub],
    ['TON VRAI PRIX', A.brandIn - A.priceTag], ['band line 2 EN CHINE', A.endcard - A.bzLine2], ['ritual stamp', A.loop - A.ritual], ['= 0 before the impact', A.zeroStamp - A.zeroEq]];
  for (const [id, a, b] of S.TEXTS().map(r => [r[2], r[0], r[1]])) if (!['chip', 'exemple'].includes(id)) H.push([`text ${id}`, b - a]);
  for (const [n, h] of H) if (h < 1.4 - 1e-6 && n !== '= 0 before the impact') bad.push(`hold ${n} ${f2(h)} s`);
  // 3 — order of the actions (the film's moments, same order as v1)
  const O = ['snips[1]', 'cut1', 'slide1[1]', 'stampBuy', 'challenge', 'dare', 'tics[2]', 'envT', 'amtT', 'cutT', 'envD', 'amtD', 'sticker', 'cutD1', 'cutD2', 'envF', 'amtF',
    'cutF', 'boxIn', 'lid', 'feet', 'stampInv', 'invSub', 'cutI', 'zeroFall', 'zeroEq', 'zeroStamp', 'coinSettle', 'toiZeroEnd', 'stack[0]', 'rule1', 'rule2', 'arrow', 'priceTag',
    'brandIn', 'plate', 'cartonIn', 'scan', 'weigh', 'measure', 'endcard', 'cta', 'ritual', 'loop'];
  const val = k => { const m = k.match(/^(\w+)\[(\d)\]$/); return m ? A[m[1]][+m[2]] : A[k]; };
  for (let i = 1; i < O.length; i++) if (!(val(O[i - 1]) <= val(O[i]) + 1e-6)) bad.push(`order ${O[i - 1]} ${f2(val(O[i - 1]))} > ${O[i]} ${f2(val(O[i]))}`);
  if (A.stampInv < S.WE('N6', 'pas', 0, 2.8)) bad.push('stampInv before the end of « pas »');
  // 4 — sound effects alone: the impacts and cuts sit in silences (never inside a line); the box sounds end before « cinq paires »
  // onset window (s) that must sit in a silence (the tails may ring under the next line, on the ducked bus); the horn whole
  const LEN = { tchac: .06, tchac_big: .06, stamp_big: .06, ding: .06, tic: .03, ting: .06, snip: .06, horn: .34 };
  const inLine = (a, b) => IDS.find(id => a < END(id) - .02 && b > T[id] + .02);
  for (const c of S.soundCues()) if (LEN[c.name] != null) { const l = inLine(c.t, c.t + LEN[c.name]); if (l) bad.push(`cue ${c.name} ${f2(c.t)}–${f2(c.t + LEN[c.name])} inside ${l}`); }
  const cinq = S.W('N6', 'cinq', 0, 1.11);
  for (const [n, t0, len] of [['box_drop', A.boxIn + .2, .6], ['lid', A.lid, .35], ['boing', A.feet, .7]]) if (t0 + len > cinq + .01) warn.push(`${n} ends ${f2(t0 + len)} after « cinq » ${f2(cinq)}`);
  return { bad: bad.map(b => `[${tag}] ${b}`), warn: warn.map(w => `[${tag}] ${w}`) };
}
const runs = +(ARGS[0] || 0), GAP = +(ARGS[1] || .12), LO = +(ARGS[2] || .9), HI = +(ARGS[3] || 1.15);
const S0 = load(REAL), base = check(S0, REAL ? 'real' : 'defaults');
let bad = base.bad, warn = base.warn;
const D0 = load(null); let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tally = {};
for (let r = 0; r < runs; r++) {                       // replay retime.py on simulated takes (no word list: fallbacks)
  const tm = { dur: {} }; let shift = 0, prev = -1e9;
  for (const id of IDS) { const d = +(D0.DUR[id] * (LO + rnd() * (HI - LO))).toFixed(3), want = D0.T[id] + shift, st = Math.max(want, prev + GAP, .05);
    shift = st - D0.T[id]; prev = st + d; tm[id] = +st.toFixed(3); tm.dur[id] = d; }
  tm.end = +(prev + Math.max(1.2, D0.T.end - (D0.T.N10 + D0.DUR.N10))).toFixed(2);
  const o = check(load(tm), 'sim' + r);
  for (const x of o.bad.concat(o.warn)) { const k = x.replace(/^\[sim\d+\] /, '').replace(/[-\d.]+/g, '#'); tally[k] = (tally[k] || 0) + 1; }
}
console.log(`${REAL ? path.relative(E, TJ) : 'DEFAULTS (no data/timing.json)'}: N ${S0.N} frames, end ${S0.T.end} s`);
console.log(bad.length ? 'ERRORS\n  ' + bad.join('\n  ') : 'OK — no error');
if (warn.length) console.log('WARNINGS\n  ' + warn.join('\n  '));
if (runs) { console.log(`${runs} simulated re-timings (retime.py placement, gap ${GAP} s, takes × ${LO}…${HI}, no words):`);
  const ks = Object.entries(tally).sort((a, b) => b[1] - a[1]); console.log(ks.length ? ks.map(([k, n]) => `  ${n}/${runs}  ${k}`).join('\n') : '  no issue'); }
