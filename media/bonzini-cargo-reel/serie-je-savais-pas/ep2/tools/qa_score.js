// QA of the score: key-text holds, simultaneous text blocks, action ordering, NaN, and (v2, SCRIPT_V2.md §7.3) « no loud cue
// starts inside a word » — on the real data/timing.json and on N jittered re-timings. Jitter = what retime.py can produce:
// every take ±15 % long (words scaled with it), ±.1 s of onset noise, placed by retime's rule (the default spacing + the
// cumulative shift, ≥ .12 s between two voices) — so a slow take SHORTENS the pause after it. --harsh: the stage-3 jitter
// (every start ±.4 s, pauses down to .1 s), a stress test whose failures are expected.
// Without data/timing.json (before the lead re-times on the v2 takes) it checks the score's DEFAULTS twice: as they are
// (the SYL fallbacks, no words) and with synthetic words (the v2 lines spread by syllable over DUR, a short pause at each comma).
// usage (from E): node tools/qa_score.js [jitterRuns=0] [--harsh]
const fs = require('fs'), path = require('path'), vm = require('vm');
const E = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(E, 'overlay/scenes/01_score.js'), 'utf8');
function load(tm) { const win = tm ? { TIMING: tm } : {}; const ctx = { window: win, console }; vm.createContext(ctx); vm.runInContext(SRC, ctx); return win.SCORE; }
const D0 = load(null);                                                  // the defaults (no timing at all)
const IDS = Object.keys(D0.T).filter(k => k !== 'end').sort((a, b) => D0.T[a] - D0.T[b]);
const LOUD = ['pouf_air', 'boum_carton', 'letters_splash', 'stamp', 'clac', 'scotch_scriiitch', 'gloup', 'hic', 'bubble_plop',
  'bonzini_sig', 'tonk', 'label_slap', 'stamp_big', 'kaching_soft', 'sweat_drop'];

// ---------- synthetic words for the defaults ----------
const SYLL = { dans: 1, ce: 1, carton: 2, cartons: 2, tu: 1, paies: 1, de: 1, lair: 1, mais: 1, mon: 1, est: 1, leger: 2, le: 1, bateau: 2,
  meme: 1, la: 1, place: 1, se: 1, mesure: 2, en: 1, metres: 2, cubes: 1, on: 1, entier: 2, aussi: 2, vide: 1, dedans: 2, donc: 1, jai: 1,
  paye: 2, pour: 1, transporter: 3, parle: 1, a: 1, ton: 1, fournisseur: 3, demande: 2, des: 1, bien: 1, remplis: 2, un: 1, plus: 1,
  petit: 2, cest: 1, moins: 1, protege: 2, qui: 1, peut: 1, casser: 2, chez: 1, bonzini: 3, trading: 2, cargo: 2, tes: 1, sont: 1,
  mesures: 3, chine: 1, ecris: 2, mot: 1, commentaire: 3, maintenant: 3, sais: 1 };
const key = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const syll = w => SYLL[key(w)] ?? Math.max(1, (key(w).replace(/e?s?$/, '').match(/[aeiouy]+/g) || []).length);
function lines() {
  for (const f of ['script.json', 'script_v2.json']) {
    try { const j = JSON.parse(fs.readFileSync(path.join(E, 'data', f), 'utf8')); const m = {}; for (const s of j.segments) m[s.id] = s.text;
      if (IDS.every(id => m[id])) return { m, f }; } catch (e) { }
  }
  throw new Error('no data/script*.json with the score ids ' + IDS.join(' '));
}
function synthWords(dur) {
  const { m } = lines(), W = {};
  for (const id of IDS) {
    const ws = m[id].split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w)), PAUSE = .6;          // a comma = .6 syllable of silence
    const units = ws.reduce((a, w) => a + syll(w) + (/,$/.test(w) ? PAUSE : 0), 0), u = dur[id] / units; let x = 0;
    W[id] = ws.map(w => { const s = x; x += syll(w) * u; const r = { w, s: +s.toFixed(3), e: +x.toFixed(3) }; if (/,$/.test(w)) x += PAUSE * u; return r; });
  }
  return W;
}

// ---------- the checks ----------
function check(S, tag, words) {
  const A = S.A, T = S.T, bad = [], warn = [], END = id => T[id] + S.DUR[id];
  for (const k in A) if (!Number.isFinite(A[k])) bad.push(`A.${k} not finite`);
  const order = [['hop', 'burstPeak'], ['titleOut', 'toiUp'], ['bateauShadow', 'bateauFall'], ['bateauFall', 'stampM3'], ['stampM3', 'bateauOut'],
    ['bateauOut', 'mes0'], ['mes2', 'formula'], ['formula', 'formulaOut'], ['formulaOut', 'capVide'], ['flank', 'capVide'],
    ['flank', 'hatch0'], ['hatch0', 'hatch1'], ['vide', 'videTic'], ['cut', 'toiSmall'], ['toiSmallOut', 'repack'], ['pose1', 'pose2'], ['pose2', 'pose3'],
    ['pose3', 'chase'], ['chase', 'gulp'], ['gulp', 'split'], ['split', 'splitOut'], ['hic', 'glass'], ['glass', 'wrap0'], ['wrap0', 'wrap1'], ['wrap1', 'ensuite'],
    ['ensuite', 'ensuiteOut'], ['ensuite', 'violet'], ['violet', 'plateBZ', .2], ['plateBZ', 'label'], ['label', 'scan'], ['scan', 'tape'], ['tape', 'volume'],
    ['volume', 'airStrike'], ['airStrike', 'measured'], ['measured', 'endcard'], ['endcard', 'cta'], ['cta', 'stampEnd'], ['stampEnd', 'loop'], ['loop', 'out']];
  for (const [a, b, tol = 1e-6] of order) if (!(A[a] <= A[b] + tol)) bad.push(`order ${a} ${A[a].toFixed(2)} > ${b} ${A[b].toFixed(2)}`);
  if (A.mes0 < END('N2b')) bad.push('measure starts under N2b voice');
  if (!(A.kaching < T.T1 - .02)) bad.push(`ka-ching ${A.kaching.toFixed(2)} not before T1 ${T.T1}`);
  if (!(A.videTic < T.T2 - .02)) bad.push(`tic ${A.videTic.toFixed(2)} not before T2 ${T.T2}`);
  if (!(A.sig < T.N7 - .02)) bad.push(`balafon signature ${A.sig.toFixed(2)} not before « Chez » (N7 ${T.N7})`);
  if (A.formula > T.N3 + .3) bad.push(`formula ${A.formula.toFixed(2)} late vs N3 ${T.N3}`);
  if (A.bateauFall >= T.N2) bad.push(`LE BATEAU falls after N2 starts (${A.bateauFall.toFixed(2)} ≥ ${T.N2})`);
  if (A.stampEnd >= T.N8b) bad.push(`ritual stamp after N8b starts (${A.stampEnd.toFixed(2)} ≥ ${T.N8b})`);
  if (T.end < Math.max(END('N8b') + .5, A.stampEnd + 1.45) - 1e-6) bad.push(`end ${T.end} < max(END(N8b)+.5, stampEnd+1.45) = ${Math.max(END('N8b') + .5, A.stampEnd + 1.45).toFixed(2)}`);
  const carton = S.W('N8', 'carton', 0, S.DUR.N8 * 4 / 10);                         // « Écris le mot | carton »: 4 of 10 syllables
  if (A.cta > carton - .05) warn.push(`CTA pill ${A.cta.toFixed(2)} not before « carton » (${carton.toFixed(2)}): END(N7) → N8 ${(T.N8 - END('N7')).toFixed(2)} s (keep ≳ .8)`);
  if (T.N7 - END('N6') < .5) warn.push(`END(N6) → N7 only ${(T.N7 - END('N6')).toFixed(2)} s (keep ≥ .5: ENSUITE band + violet before « Chez »)`);
  // key texts: [label, t0, t1(read-end)] (≥ 1.4 s)
  const holds = [['title', 0, A.titleOut], ['toi', A.toiUp + .3, A.bateauFall], ['bateau', A.bateauFall, A.bateauOut], ['EN MÈTRES CUBES', A.stampM3, A.flank],
    ['formula full', A.mes2, A.formulaOut], ['toiSmall', A.toiSmall + .35, A.toiSmallOut], ['MESURÉ', A.measured, A.endcard], ['MAINTENANT', A.stampEnd, A.out], ['BONZINI plate', A.plateBZ, A.endcard]];
  for (const [id, a, b] of S.TEXTS().map(r => [r[2], r[0], r[1]])) if (!['formula', 'formulaSub', 'm3', 'ensuite', 'measured', 'stampEnd'].includes(id)) holds.push([id, a + .14, b - .14]);
  for (const [id, a, b] of holds) if (b - a < 1.4) bad.push(`hold ${id} ${(b - a).toFixed(2)} s`);
  // simultaneous text blocks (texts + plates + bz plate), legal/example + chip excluded, end card counted as storyboard
  let maxB = 0, at = 0;
  for (let t = 0; t < T.end; t += 1 / 30) {
    const tx = S.TEXTS().filter(r => t >= r[0] + .14 && t < r[1] - .14).map(r => r[2]).filter(id => !['formulaSub', 'tag', 'service', 'measured'].includes(id));   // the stamp sits on the readout slip: one block
    const n = tx.length + S.plates(t).filter(p => p.s > .5 && p.a > .5).length + (S.bzPlate(t) ? 1 : 0);
    if (n > maxB && t < A.endcard) { maxB = n; at = t; }
  }
  if (maxB > 3) bad.push(`${maxB} text blocks at ${at.toFixed(2)}`);
  // v2: no loud cue starts inside a word (word windows [s, e] of the timing; 10 ms tolerance at the edges). A line's last
  // word ends at the measured speech end END(id) at the earliest (the ASR stamps it ≈ .1–.2 s early)
  if (words) for (const c of S.soundCues()) {
    if (!LOUD.includes(c.name)) continue;
    for (const id of IDS) for (const [i, w] of (words[id] || []).entries()) {
      const s = T[id] + w.s, e = T[id] + (i === words[id].length - 1 ? Math.max(w.e, S.DUR[id]) : w.e);
      if (c.t > s + .01 && c.t < e - .01) bad.push(`loud cue ${c.name} @${c.t.toFixed(2)} inside « ${w.w} » (${id} ${s.toFixed(2)}–${e.toFixed(2)})`);
    }
  }
  return { bad: bad.map(b => `[${tag}] ${b}`), warn: warn.map(b => `[${tag}] ${b}`) };
}

// ---------- run ----------
let BASE, src, out = { bad: [], warn: [] };
const add = r => { out.bad = out.bad.concat(r.bad); out.warn = out.warn.concat(r.warn); };
try { BASE = JSON.parse(fs.readFileSync(path.join(E, 'data/timing.json'), 'utf8')); src = 'data/timing.json'; } catch (e) { BASE = null; }
if (BASE) add(check(load(BASE), 'real', BASE.words));
else {
  const T0 = {}; for (const k in D0.T) T0[k] = D0.T[k];
  add(check(D0, 'defaults'));                                                       // SYL fallbacks, no words
  BASE = { ...T0, dur: { ...D0.DUR }, words: synthWords(D0.DUR) }; src = `score defaults + synthetic words (${lines().f})`;
  add(check(load(BASE), 'default+words', BASE.words));
}
const runs = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 0), HARSH = process.argv.includes('--harsh');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let r = 0; r < runs; r++) {
  const tm = JSON.parse(JSON.stringify(BASE)), ids = IDS.filter(id => tm[id] !== undefined);
  for (const id of ids) { const k = .85 + rnd() * .3; tm.dur[id] = +(tm.dur[id] * k).toFixed(3); if (tm.words && tm.words[id]) tm.words[id] = tm.words[id].map(w => ({ w: w.w, s: +(w.s * k).toFixed(3), e: +(w.e * k).toFixed(3) })); }
  if (HARSH) {
    for (const id of ids.slice(1)) tm[id] = +(tm[id] + (rnd() - .5) * .8).toFixed(3);
    for (let i = 1; i < ids.length; i++) tm[ids[i]] = Math.max(tm[ids[i]], tm[ids[i - 1]] + tm.dur[ids[i - 1]] + .1);   // never two voices at once
  } else {                                                                       // retime.py's rule on the base spacing
    let shift = 0, prevEnd = -1e9;
    for (const id of ids) { const want = BASE[id] + shift + (rnd() - .5) * .2, st = Math.max(want, prevEnd + .12, .05); shift = st - BASE[id]; tm[id] = +st.toFixed(3); prevEnd = st + tm.dur[id]; }
  }
  const last = ids[ids.length - 1];
  tm.end = +Math.max(tm.end + (tm[last] - BASE[last]), tm[last] + tm.dur[last] + .5).toFixed(3);
  const res = check(load(tm), (HARSH ? 'harsh' : 'jit') + r, tm.words); add(res);
}
const S = load(src === 'data/timing.json' ? BASE : null);
console.log(`source: ${src} · ids ${IDS.join(' ')} · N ${S.N} · end ${S.T.end} s · ${S.soundCues().length} cues`);
if (out.warn.length) console.log('WARN\n' + out.warn.join('\n'));
console.log(out.bad.length ? out.bad.join('\n') : 'OK — no issue');
