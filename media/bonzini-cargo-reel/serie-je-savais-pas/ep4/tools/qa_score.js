// ep4 « PATRON, ATTENDS ! » v2 — QA of the score (SCRIPT_V2.md §6, §7.1–§7.4): NaN, action order, key-text holds (≥ 1.4 s;
// the rule's 3-line sub-line ≥ 2 s; THE RULE alone ≥ 3.8 s), simultaneous text blocks (≤ 3), the re-timing constraints of the
// spec (the ding after « compte », the leap after T2 and the landing before « Ce n'est », no sound under C3, the steel in the
// silence after « Allô ? », FAUX MESSAGE before C4, the clinks after « message », the gloup after « numéro », the balafon and
// the enamel plate before « Ensuite », the ritual stamp in the pause before « Maintenant », the loop after « sais », `end`),
// the minimum silences of data/gaps.json, the 45 s limit, and « no loud cue starts inside a word » (§7.3's list; word
// windows of the timing, a line's last word counted up to END(id): the ASR stamps it early).
//
// Source: --timing x.json (a candidate timing) › data/timing.json › the score's DEFAULTS. On the defaults it checks twice:
// as they are (SYL fallbacks, no words) and with synthetic words (the v2 lines of data/script*.json spread by syllable over
// DUR, .54 syllable of silence per comma and 1.26 per sentence end inside a line = the .15 / .35 s of §6 at 3.6 syl/s).
// Rate scenarios (always): every take at 3.5 and 3.8 syl/s instead of 3.6 (durations × 3.6/rate), placed like retime.py --pauses.
// Jitter runs (N): every take ±15 % long, its inner word boundaries ±.06 s and its last word stamped up to .2 s early (the
// ASR), placed like serie/retime.py — by default its --pauses rule (start = end of the previous take + max(gap, the default
// pause, data/gaps.json)); --spacing = its default rule (the default spacing + the cumulative shift, ≥ max(gap, gaps.json));
// --harsh = every start ±.4 s (stress test, failures expected). The runs are tallied by issue.
// usage (from E): node tools/qa_score.js [runs=0] [--timing x.json] [--spacing | --harsh] [--gap 0.12] [--tail 0.7] [-v]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const E = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(E, 'overlay/scenes/01_score.js'), 'utf8');
const ARGS = process.argv.slice(2), opt = (k, d) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : d; };
const GAP = +opt('--gap', .12), TAIL = +opt('--tail', .7), HARSH = ARGS.includes('--harsh'), SPACING = ARGS.includes('--spacing'), VERBOSE = ARGS.includes('-v');
const runs = +(ARGS.find((a, i) => /^\d+$/.test(a) && !(i > 0 && /^--(timing|gap|tail)$/.test(ARGS[i - 1]))) || 0);
function load(tm) { const win = tm ? { TIMING: tm } : {}; const ctx = { window: win, console }; vm.createContext(ctx); vm.runInContext(SRC, ctx); return win.SCORE; }
const D0 = load(null);                                                  // the defaults (no timing at all)
const IDS = D0.LINES.slice();
const GAPS = (() => { try { return JSON.parse(fs.readFileSync(path.join(E, 'data/gaps.json'), 'utf8')); } catch (e) { return {}; } })();
// SCRIPT_V2.md §7.3: none of these may START inside a word (window [s − .03, e] of timing.json › words)
const LOUD = ['ding_msg', 'heart_pop', 'aww_guitar', 'boing_carton', 'bonk', 'phone_ring', 'plate_flip', 'phone_pickup', 'big_stamp',
  'glass_shatter', 'peel', 'stamp', 'clink', 'major', 'gloup', 'glass_tonk', 'ribbon_shimmer', 'label_slap', 'bonzini_sig', 'tonk', 'pop',
  'stamp_big', 'final_chord'];

// ---------- synthetic words (SCRIPT_V2.md §1 syllable counts, as ep4v2/sim/mk_timing.py) ----------
const SYLL = { patron: 2, attends: 2, ne: 1, paie: 1, pas: 1, sur: 1, ce: 1, compte: 1, mon: 1, fournisseur: 3, mecrit: 2, quil: 1, a: 1,
  change: 2, de: 1, bancaire: 2, il: 1, mis: 1, trois: 1, coeurs: 1, cest: 1, lui: 1, je: 1, vite: 1, nest: 1, peutetre: 2, ton: 1,
  appellele: 3, le: 1, numero: 3, que: 1, tu: 1, connais: 2, deja: 2, allo: 2, dit: 1, na: 1, rien: 1, cetait: 2, un: 1, faux: 1, message: 2,
  avant: 2, payer: 2, nouveau: 2, appelle: 2, lancien: 2, on: 1, se: 1, voit: 1, douala: 3, ensuite: 2, bonzini: 3, trading: 2, cargo: 2,
  amene: 2, ta: 1, commande: 2, la: 1, chine: 1, ecris: 2, mot: 1, en: 1, commentaire: 3, maintenant: 3, sais: 1 };
const key = w => w.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
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
    const toks = m[id].replace(/[«»]/g, ' ').split(/\s+/).filter(Boolean), items = [];
    for (const tk of toks) {                                     // [word, syllables, pause units after]
      if (/^[!?.,:;…]+$/.test(tk)) { if (items.length) items[items.length - 1][2] += /[.!?…]/.test(tk) ? 1.26 : .54; continue; }
      items.push([tk.replace(/[!?.,:;…]+$/, ''), syll(tk), /[.!?…]$/.test(tk) ? 1.26 : /[,:;]$/.test(tk) ? .54 : 0]);
    }
    const units = items.reduce((a, [, n, p], i) => a + n + (i < items.length - 1 ? p : 0), 0), u = dur[id] / units; let x = 0;
    W[id] = items.map(([w, n, p]) => { const s = x; x += n * u; const r = { w, s: +s.toFixed(3), e: +x.toFixed(3) }; x += p * u; return r; });
  }
  return W;
}

// ---------- the checks ----------
function check(S, words) {
  const A = S.A, T = S.T, D = S.DUR, END = id => T[id] + D[id], bad = [], warn = [], f2 = x => (+x).toFixed(2);
  const flat = Object.entries(A).flatMap(([k, v]) => Array.isArray(v) ? v.map((x, i) => [`${k}[${i}]`, x]) : [[k, v]]);
  for (const [k, v] of flat) if (!Number.isFinite(v)) bad.push(`A.${k} not finite`);
  for (const id of IDS) if (!Number.isFinite(T[id]) || !Number.isFinite(D[id])) bad.push(`T/DUR ${id} not finite`);
  const v = k => { const m = /^(\w+)\[(\d)\]$/.exec(k); return m ? A[m[1]][+m[2]] : A[k]; };
  // 1 — order of the actions (the same moments, in the same order as v1)
  // (the 3rd re-press, on « compte », falls after the dezoom: the parcel peels off the glass as « compte » starts — as in v1)
  const order = [['presses[1]', 'hook2'], ['hook2', 'presses[2]'], ['presses[2]', 'presses[3]'], ['presses[2]', 'dezoom'], ['dezoom', 'land'], ['land', 'bubble', .05],
    ['bubble', 'hookOut'], ['bubble', 'pillQ'], ['bubble', 'toiIn'], ['toiIn', 'hearts[0]'], ['hearts[2]', 'toiTxt1'], ['toiTxt1', 'heartsPulse'], ['heartsPulse', 'aww'],
    ['aww', 'toiTxt2'], ['toiTxt2', 'advance0'], ['advance0', 'jump'], ['jump', 'jumpLand'], ['jumpLand', 'bonk'], ['bonk', 'c2cap'], ['c2cap', 'c2capOut'],
    ['c2capOut', 'band'], ['band', 'allo'], ['allo', 'ring[0]'], ['ring[0]', 'aside'], ['aside', 'pickup'], ['pickup', 'bandOut'], ['bandOut', 'supIn0'],
    ['supIn0', 'supIn1'], ['supIn1', 'toiRien'], ['toiRien', 'toiOut'], ['toiOut', 'stamp'], ['stamp', 'shatter'], ['shatter', 'peel'], ['peel', 'fauxStamp'],
    ['fauxStamp', 'major'], ['major', 'roll[0]'], ['roll[0]', 'roll[1]'], ['roll[1]', 'roll[2]'], ['roll[2]', 'rule', .02], ['supOut', 'rule'], ['rule', 'ruleW[0]'],
    ['ruleW[0]', 'ruleW[1]'], ['ruleW[1]', 'ruleSub'], ['ruleSub', 'ruleW[2]'], ['ruleW[2]', 'ruleW[3]'], ['ruleW[3]', 'gulp'], ['gulp', 'ruleOut'], ['cont', 'leap'],
    ['leap', 'enter'], ['enter', 'ribbon'], ['ribbon', 'bzLabel'], ['ribbon', 'shimmer'], ['shimmer', 'sig', .001], ['sig', 'plateBZ'], ['plateBZ', 'service'],
    ['service', 'endcard'], ['endcard', 'cta'], ['cta', 'tagLine'], ['tagLine', 'stampEnd'], ['stampEnd', 'loop0'], ['loop0', 'out']];
  for (const [a, b, tol = 1e-6] of order) if (!(v(a) <= v(b) + tol)) bad.push(`order ${a} ${f2(v(a))} > ${b} ${f2(v(b))}`);
  if (A.out > T.end) bad.push('out after the end');
  // 2 — the re-timing constraints of SCRIPT_V2.md (§1 beats, §6 pauses, §7.2 anchors): [label, a, b] means a ≤ b
  const wCom = S.WE('N3', 'commentaire|comment', 0, S.SYL('N3', 10)), wMaint = S.W('N3', 'maintenant', 0, S.SYL('N3', 11.26));
  const C = [
    ['the ding after « compte » (bubble ≥ END(C1))', END('C1') - .005, A.bubble], ['the ding before T1 (bubble ≤ T1 − .1)', A.bubble, T.T1 - .1],
    ['the leap after T2 (jump ≥ END(T2))', END('T2') - .01, A.jump], ['landing + bonk + cut before « Ce n\'est » (bonk ≤ C2 − .15)', A.bonk, T.C2 - .15],
    ['no sound under C3: the flip and the ring after it (allo ≥ END(C3))', END('C3') - .005, A.allo], ['the ring before « Allô ? » (ring ≤ T3 − .3)', A.ring[0], T.T3 - .3],
    ['the pick-up click before « Allô ? »', A.pickup, T.T3 - .05], ['the steel in the silence after « Allô ? » (supIn0 ≥ END(T3))', END('T3') - .005, A.supIn0],
    ['the steel starts before T3b (supIn0 ≤ T3b − .3)', A.supIn0, T.T3b - .3], ['the stamp after T3b', END('T3b') + .05, A.stamp],
    ['the peel before C4', A.peel, T.C4 - .03], ['FAUX MESSAGE before C4 (fauxStamp ≤ C4 − .05)', A.fauxStamp, T.C4 - .05],
    ['the clinks after « message » (roll[0] ≥ END(C4))', END('C4') - .005, A.roll[0]], ['the major chord after « message »', END('C4') - .005, A.major],
    ['the gloup after « numéro » (gulp ≥ END(N1))', END('N1') - .005, A.gulp], ['the gloup before C5', A.gulp, T.C5 - .1],
    ['the container after N1 (cont ≥ END(N1) + .1)', END('N1') + .1, A.cont], ['the balafon after « Douala » (sig ≥ END(C5))', END('C5') - .005, A.sig],
    ['the balafon before « Ensuite » (sig ≤ N2 − .25)', A.sig, T.N2 - .25], ['the enamel plate after C5 (plateBZ ≥ END(C5) + .1)', END('C5') + .1, A.plateBZ],
    ['the enamel plate + tonk before « Ensuite » (plateBZ ≤ N2 − .1)', A.plateBZ, T.N2 - .1], ['the CTA pop after N2 (cta ≥ END(N2) + .05)', END('N2') + .05, A.cta],
    ['the CTA pop before « Écris »', A.cta, T.N3 - .05], ['the ritual stamp after « commentaire »', wCom - .005, A.stampEnd],
    ['the ritual stamp before « Maintenant » (≤ W − .05)', A.stampEnd, wMaint - .05], ['the loop after « sais » (loop0 ≥ END(N3) + .1)', END('N3') + .1, A.loop0],
    ['end ≥ max(END(N3) + .7, stampEnd + 1.5)', Math.max(END('N3') + .7, A.stampEnd + 1.5) - .005, T.end]];
  for (const [n, a, b] of C) if (!(a <= b)) bad.push(`§7 ${n}: ${f2(a)} > ${f2(b)}`);
  if (A.roll[2] > T.N1 - .05) warn.push(`3rd clink ${f2(A.roll[2])} not .05 s before N1 ${f2(T.N1)} (C4 → N1 pause ${f2(T.N1 - END('C4'))} s)`);
  if (T.end > 45.005) warn.push(`film ${f2(T.end)} s > 45 s (DICTION.md rule 6: apply SCRIPT_V2.md §6's cut plan)`);
  // 3 — minimum silences before a line (data/gaps.json) and the storyboard pauses (§6)
  for (let i = 1; i < IDS.length; i++) {
    const a = IDS[i - 1], b = IDS[i], g = T[b] - END(a);
    if (g < -.005) bad.push(`voices overlap ${a} / ${b}`);
    else if (GAPS[b] != null && g < GAPS[b] - .015) bad.push(`silence ${a} → ${b} ${f2(g)} s < ${GAPS[b]} (gaps.json)`);
  }
  // 4 — key texts held ≥ 1.4 s (raw, as tools/check_text.js); the sub-line ≥ 2 s; THE RULE alone
  const KEY = new Set(S.BLOCK_STYLES.concat(['pillPas', 'ruleSub'])), TX = S.TEXTS(); let minH = 1e9, minId = '';
  for (const [a, b, id, , st] of TX) if (KEY.has(st)) {
    const h = b - a, need = id === 'ruleSub' ? 2.0 : id === 'rule' ? 3.8 : 1.4;
    if (h < need - 1e-6) bad.push(`hold ${id} ${f2(h)} s < ${need}`);
    if (h < minH) { minH = h; minId = id; }
  }
  const rr = TX.find(r => r[2] === 'rule');
  for (const [a, b, id, , st] of TX) if (S.BLOCK_STYLES.includes(st) && id !== 'rule' && a < rr[1] - .14 && b > rr[0] + .14) bad.push(`THE RULE not alone: ${id} ${f2(a)}–${f2(b)}`);
  // 5 — ≤ 3 text blocks at once (TEXTS rows of BLOCK_STYLES, the plates' texts included)
  let maxB = 0, at = 0;
  for (let t = 0; t < T.end; t += 1 / 30) { const n = TX.filter(([a, b, , , st]) => t >= a && t < b && S.BLOCK_STYLES.includes(st)).length; if (n > maxB) { maxB = n; at = t; } }
  if (maxB > 3) bad.push(`${maxB} text blocks at ${f2(at)}`);
  // 6 — no loud cue starts inside a word ([s − .03, e]); a line's last word ends at END(id) at the earliest. A cue that
  // outOfWords() could not push out (the words touch for > .6 s) keeps its time at half gain: under .2 it is not loud
  // (the 3 heart pops .125 inside T1, which has no pause) — listed with -v only.
  if (words) for (const c of S.soundCues()) {
    if (!LOUD.includes(c.name) || c.g < .2) continue;
    for (const id of IDS) for (const [i, w] of (words[id] || []).entries()) {
      const s = T[id] + w.s, e = T[id] + (i === words[id].length - 1 ? Math.max(w.e, D[id]) : w.e);
      if (c.t > s - .03 + .005 && c.t < e - .005) bad.push(`loud cue ${c.name} @${f2(c.t)} inside « ${w.w} » (${id} ${f2(s)}–${f2(e)})`);
    }
  }
  return { bad, warn, minH, minId, maxB };
}

// ---------- run ----------
const TJ = opt('--timing') ? path.resolve(opt('--timing')) : path.join(E, 'data/timing.json');
let BASE = null, src;
if (fs.existsSync(TJ)) { BASE = JSON.parse(fs.readFileSync(TJ, 'utf8')); src = path.relative(E, TJ) || TJ; }
else if (opt('--timing')) throw new Error('no such timing: ' + TJ);
const out = [];   // [tag, result]
if (BASE) {
  const miss = IDS.filter(id => !Number.isFinite(BASE[id]) || !(BASE.dur && Number.isFinite(BASE.dur[id])));
  if (miss.length) console.log(`WARNING ${src} has no start/dur for ${miss.join(' ')} (the score keeps its defaults for them)`);
  out.push(['real', check(load(BASE), BASE.words)]);
} else {
  out.push(['defaults', check(D0, null)]);                                          // SYL fallbacks, no words
  const T0 = {}; for (const k in D0.T) T0[k] = D0.T[k];
  BASE = { ...T0, dur: { ...D0.DUR }, words: synthWords(D0.DUR) }; src = `score DEFAULTS + synthetic words (${lines().f})`;
  out.push(['default+words', check(load(BASE), BASE.words)]);
}
const P0 = {}; IDS.forEach((id, i) => { if (i) P0[id] = D0.T[id] - (D0.T[IDS[i - 1]] + D0.DUR[IDS[i - 1]]); });   // the storyboard's pauses
const TAIL0 = D0.T.end - (D0.T[IDS[IDS.length - 1]] + D0.DUR[IDS[IDS.length - 1]]);
/** place the takes like retime.py: --pauses (default) or --spacing (default spacing + cumulative shift); harsh = ±.4 s */
function place(tm, rnd, mode) {
  let prevEnd = -1e9, shift = 0;
  IDS.forEach((id, i) => {
    let st;
    if (mode === 'harsh') st = i ? Math.max(tm[id] + (rnd() - .5) * .8, prevEnd + .1) : tm[id];
    else if (mode === 'spacing') { const want = BASE[id] + shift + (rnd() - .5) * .2; st = Math.max(want, prevEnd + Math.max(GAP, GAPS[id] || 0), .05); shift = st - BASE[id]; }
    else st = i ? prevEnd + Math.max(GAP, P0[id], GAPS[id] || 0) : tm[id];      // retime.py --pauses
    tm[id] = +st.toFixed(3); prevEnd = st + tm.dur[id];
  });
  tm.end = +(prevEnd + Math.max(TAIL, TAIL0)).toFixed(2);
  return tm;
}
const scale = (tm, id, k) => { tm.dur[id] = +(tm.dur[id] * k).toFixed(3); if (tm.words && tm.words[id]) tm.words[id] = tm.words[id].map(w => ({ w: w.w, s: +(w.s * k).toFixed(3), e: +(w.e * k).toFixed(3) })); };
// rate scenarios: every take at 3.5 / 3.8 syl/s (the spec's simulation), --pauses placement
const rates = [];
for (const r of [3.5, 3.8]) {
  const tm = JSON.parse(JSON.stringify(BASE)); for (const id of IDS) scale(tm, id, 3.6 / r);
  place(tm, () => .5, 'pauses'); const res = check(load(tm), tm.words); out.push([`${r} syl/s`, res]); rates.push([r, tm.end, res]);
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tally = {}, ends = [];
for (let r = 0; r < runs; r++) {
  const tm = JSON.parse(JSON.stringify(BASE));
  for (const id of IDS) {
    scale(tm, id, .85 + rnd() * .3);
    const ws = tm.words && tm.words[id]; if (!ws || !ws.length) continue;      // inner boundaries ±.06 s, the last word stamped early
    for (let j = 1; j < ws.length; j++) { const b = Math.max(ws[j - 1].s + .05, Math.min(ws[j].e - .05, ws[j].s + (rnd() - .5) * .12)); ws[j].s = +b.toFixed(3); if (ws[j - 1].e > b) ws[j - 1].e = +b.toFixed(3); }
    const L = ws[ws.length - 1]; L.e = +Math.max(L.s + .05, tm.dur[id] - rnd() * .2).toFixed(3);
  }
  place(tm, rnd, HARSH ? 'harsh' : SPACING ? 'spacing' : 'pauses'); ends.push(tm.end);
  const res = check(load(tm), tm.words);
  for (const [kind, list] of [['ERR', res.bad], ['warn', res.warn]]) for (const x of new Set(list.map(s => s.replace(/-?\d+\.\d+/g, '#')))) tally[kind + ' ' + x] = (tally[kind + ' ' + x] || 0) + 1;
}
const S = load(src.startsWith('score DEFAULTS') ? null : BASE);
console.log(`source: ${src} · ${IDS.length} ids ${IDS.join(' ')} · N ${S.N} · end ${S.T.end} s · ${S.soundCues().length} cues · gaps.json ${Object.keys(GAPS).length ? JSON.stringify(GAPS) : 'NONE'}`);
let nb = 0;
for (const [tag, r] of out) {
  console.log(`[${tag}] shortest key text ${r.minId} ${r.minH.toFixed(2)} s · max ${r.maxB} blocks`);
  if (r.warn.length) console.log(`WARN [${tag}]\n  ` + r.warn.join('\n  '));
  if (r.bad.length) { nb += r.bad.length; console.log(`ERRORS [${tag}]\n  ` + r.bad.join('\n  ')); }
}
console.log(`rate scenarios (retime --pauses, tail ≥ ${TAIL}): ` + rates.map(([r, e]) => `${r} syl/s → ${e.toFixed(2)} s`).join(' · '));
console.log(nb ? `${nb} error(s)` : 'OK — no issue');
process.exitCode = nb ? 1 : 0;
if (runs) {
  console.log(`${runs} simulated re-timings (${HARSH ? 'harsh: starts ±.4 s' : SPACING ? 'retime.py default spacing + gaps.json' : 'retime.py --pauses + gaps.json'}, takes ±15 %, words ±.06 s, tail ≥ ${TAIL} s; film ${Math.min(...ends).toFixed(2)}–${Math.max(...ends).toFixed(2)} s):`);
  const ks = Object.entries(tally).sort((a, b) => b[1] - a[1]); console.log(ks.length ? ks.map(([k, n]) => `  ${n}/${runs}  ${k}`).join('\n') : '  no issue');
}
if (VERBOSE) {
  const f = x => Array.isArray(x) ? x.map(v => v.toFixed(2)).join('/') : x.toFixed(2);
  console.log('A: ' + Object.entries(S.A).map(([k, v]) => `${k} ${f(v)}`).join(' · '));
  console.log('voices: ' + IDS.map(id => `${id} ${S.T[id].toFixed(2)}→${(S.T[id] + S.DUR[id]).toFixed(2)}`).join(' · '));
  console.log('music: ' + JSON.stringify(S.music()));
  console.log('soft cues (g < .2): ' + S.soundCues().filter(c => c.g < .2).map(c => `${c.name} ${c.t.toFixed(2)} g ${c.g}`).join(' · '));
}
