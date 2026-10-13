'use strict';
// =============================================================================================
// « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » (film 1, 36,80 s) and its recut « DÉPOSÉ. REÇU. » (film 2, variant 'cut',
// 19,35 s) — THE SCORE. One source of truth for picture AND sound. Spec: rush2/SERIE.md §3 (the DUPLEX system), §4 (real
// voice, measured marks), §5.1 (film 1), §5.2 (film 2). The module contract (what 20_duplex.js / 40_map.js read) is
// MODULES.md; every state below is a pure function of the film time t (motion blur samples sub-frames).
//
// VARIANTS  main = film 1 · cut = film 2 (« Réponds COLIS ») · cut_tk = film 2 with film 1's pill (« Écris COLIS »).
//           node: BZ_VARIANT=cut · browser: window.VARIANT (render.mjs --variant cut).
// TIMING    The picture is locked to the REAL VOICE (§4: never stretched, cut in measured silences). Its word times come
//           from rush2/voice/real_words.json when present (forced alignment), else from the §4 energy marks (other words
//           interpolated by syllables). The NARRATOR lines (N1…) are placed at their SERIE windows; their durations come
//           from rush2/voice/takes.json when present (the chosen takes, as played), else = the window budgets. The chain:
//             T.N3b = max(8,80, END(N3a) + ,35) · A.pill = T0 + 4,00 · T.N5a = A.pill + ,15 · T.N5b = END(N5a) + ,35 ·
//             A.freeze = END(N5b) + ,35 · T.end = END(N5b) + ,65   (the film's length follows the call's takes)
//           and the text / stamp / glide anchors read the words: DÉPOSÉ = W('RV3', 'déposé'), REÇU = W('RV3', 'reçu'),
//           MERCI = W('RV1A', 'merci'), the « clients » glide = W('RV1B', 'clients') − ,18, C'EST FORT ! = W('RV4', 'fort')…
//           T[id] = film start of segment / line id (RV*: the segment's source `in`; N*: the first word of the take).
// GEOMETRY  §3.3: each shot = a source layer at scale s whose focal point F (source px) sits on the window's useful
//           centre Q: screen = s·(P − F) + Q. Windows are bounded by the band-route (band(t)). Crops are computed from
//           (s, F, Q, window) at every t (00_edl.js crop functions); Douala crops are bounded inside the source, v1–v3
//           crops are NOT (their F were chosen inside the sticker-free zones: tools/qa.js counts the mask pixels).
// HIDES     data/hides.json (tools/mkhide.py → tools/build_hides.py): gaussian blurs BAKED into the prepared frames by
//           tools/prep_clips.py (kind 'gauss', skipped by 05_footage.js), audited as must-hide regions.
// Loaded by node (module.exports; reads data/*.json and ../voice/*.json itself) and by the page (window.SCORE; TIMING,
// CLIPS, HIDES, TAKES, REAL_WORDS, VARIANT injected by render.mjs). No Math.random, no Date, no ctx.filter.
// =============================================================================================
(function () {
const isNode = typeof window === 'undefined';
const EDL = isNode ? require('./00_edl.js') : window.EDL;
const FPS = 30, SW = 1080, SH = 1920;
const readJSON = (...rel) => { const fs = require('fs'), p = require('path'); const f = p.join(__dirname, '..', '..', ...rel);
  if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`01_score.js: cannot parse ${f}: ${e.message}`); return null; } };
let TM, CLIPS, HIDES, TAKES, RWORDS, VARIANT;
if (isNode) {
  TM = readJSON('data', 'timing.json'); CLIPS = readJSON('data', 'clips.json'); HIDES = readJSON('data', 'hides.json');
  TAKES = readJSON('..', 'voice', 'takes.json'); RWORDS = readJSON('..', 'voice', 'real_words.json');
  VARIANT = typeof process !== 'undefined' && process.env.BZ_VARIANT;
} else {
  TM = window.TIMING || null; CLIPS = window.CLIPS || null; HIDES = window.HIDES || null; TAKES = window.TAKES || null;
  RWORDS = window.REAL_WORDS || null; VARIANT = window.VARIANT;
}
VARIANT = ['main', 'cut', 'cut_tk'].includes(VARIANT) ? VARIANT : 'main';
const CUT = VARIANT !== 'main';                     // film 2 (the recut)
if (!CLIPS) throw new Error('01_score.js: data/clips.json missing — run python3 tools/prep_clips.py --index');
const { kk, EASE, cl, lerp, R6 } = EDL;
const ease = EASE.inOut, easeOut = EASE.out, easeIn = EASE.in;
const backOut = (x, s = 1.70158) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;
const NOTES = [];                                   // what the loaders did (check() prints it)

// =====================================================================================================================
// 1. VOICES
// =====================================================================================================================
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nrm = s => deacc(s).replace(/[^a-z0-9]/g, '');
// ---------- the real voice (§4). words: [token, syllables, start mark?, end mark?] — marks relative to `in` ----------
const RV = {
  RV2: { clip: 'v2', in: 3.65, out: 7.35, end: 3.47, text: 'Voilà, ce véhicule doit être|chargé dans le conteneur.',
    words: [['Voilà', 2, .18], ['ce', 1, 1.32], ['véhicule', 3], ['doit', 1], ['être', 1], ['chargé', 2], ['dans', 1], ['le', 1], ['conteneur', 3]] },
  RV1A: { clip: 'v1', in: 8.85, out: 11.05, end: 1.97, text: 'Nous disons comme ça :|merci déjà…',
    words: [['Nous', 1, .21], ['disons', 2], ['comme', 1], ['ça', 1], ['merci', 2, .85], ['déjà', 2]] },
  RV1B: { clip: 'v1', in: 11.55, out: 13.70, end: 1.89, text: '…aux clients qui nous|ont fait confiance.',
    words: [['aux', 1, .27], ['clients', 2, .43], ['qui', 1], ['nous', 1], ['ont', 1], ['fait', 1], ['confiance', 3, 1.59]] },
  RV3: { clip: 'v2', in: 14.45, out: 18.62, end: 4.05, text: 'Voilà, directement déposé,|directement reçu.',
    words: [['Voilà', 2, .19], ['directement', 4, 1.19], ['déposé', 3, 1.89, 2.35], ['directement', 4, 3.15], ['reçu', 2, 3.81]] },
  RV4: { clip: 'v2', in: 18.80, out: 22.75, end: 3.77, text: 'Bonzini Trading,|faites-nous confiance.',
    words: [['Voilà', 2, .44], ['c’est', 1, .72], ['fort', 1, .88], ['Bonzini', 3, 1.32], ['Trading', 2], ['faites-nous', 2, 2.67], ['confiance', 3]] },
};
const RV_IDS = CUT ? ['RV3', 'RV4'] : ['RV2', 'RV1A', 'RV1B', 'RV3', 'RV4'];
/** §4 marks → every word's [s, e] (relative to `in`): unmarked words share the time between two marks by syllables */
function markWords(v) {
  const n = v.words.length, out = v.words.map(w => ({ w: w[0], syl: w[1], s: w[2], e: w[3] }));
  const anchors = []; out.forEach((w, i) => { if (w.s !== undefined) anchors.push(i); });
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k], b = k + 1 < anchors.length ? anchors[k + 1] : n;
    let ta = out[a].s, tb = b < n ? out[b].s : v.end;
    const run = out.slice(a, b), endFixed = run.findIndex(w => w.e !== undefined);
    if (endFixed >= 0 && endFixed < run.length - 1) tb = run[endFixed].e;          // (no case in §4; kept general)
    if (run.length === 1 && run[0].e !== undefined) tb = run[0].e;
    const tot = run.reduce((m, w) => m + w.syl, 0); let t = ta;
    for (const w of run) { w.s = R6(t); t += (tb - ta) * w.syl / tot; if (w.e === undefined) w.e = R6(t - .02); }
  }
  out[n - 1].e = Math.max(out[n - 1].e, v.end);
  return out.map(w => ({ w: w.w, s: w.s, e: w.e, src: 'marks' }));
}
/** real_words.json (forced alignment) → [{w, s, e}] relative to `in`; tolerant of the usual shapes */
function realWords(id, v) {
  if (!RWORDS) return null;
  const pool = RWORDS.segments || RWORDS.voices || RWORDS, key = Object.keys(pool).find(k => nrm(k) === nrm(id));
  let e = key ? pool[key] : null;                    // 'RV1-A' = 'RV1A'
  if (!e) return null;
  let ws = Array.isArray(e) ? e : e.words; if (!Array.isArray(ws) || !ws.length) return null;
  ws = ws.map(w => ({ w: w.w || w.word || w.text, s: +(w.s ?? w.start), e: +(w.e ?? w.end), syl: Array.isArray(w.syl) ? w.syl.map(Number) : null, vowel: w.vowel !== undefined ? +w.vowel : null })).filter(w => w.w && isFinite(w.s));
  const abs = (e.abs === true || e.relative === false) || (e.abs === undefined && ws[0].s >= v.in - .05 && v.in > 1);
  if (abs) ws = ws.map(w => ({ w: w.w, s: R6(w.s - v.in), e: R6(w.e - v.in), syl: w.syl ? w.syl.map(x => R6(x - v.in)) : null, vowel: w.vowel !== null ? R6(w.vowel - v.in) : null }));
  return ws;
}
const WORDS = {}, DUR = {}, SRCW = {};
for (const id in RV) {
  const v = RV[id], fb = markWords(v), rw = realWords(id, v);
  DUR[id] = R6(v.out - v.in);
  if (rw) {                                           // our tokens, timed by the alignment (in order, prefix match)
    let j = 0;
    WORDS[id] = fb.map(w => { const k = nrm(w.w); for (let q = j; q < Math.min(rw.length, j + 4); q++) { const r = nrm(rw[q].w); if (r && (r.startsWith(k.slice(0, 4)) || k.startsWith(r))) { j = q + 1; return { w: w.w, s: rw[q].s, e: rw[q].e, syl: rw[q].syl, vowel: rw[q].vowel, src: 'aligned' }; } } return w; });
    SRCW[id] = 'real_words.json';
  } else { WORDS[id] = fb; SRCW[id] = 'SERIE §4 marks'; }
}
// ---------- the narrator (§5.1 / §5.2 windows = budgets; durations from rush2/voice/takes.json when present) ----------
const NARR = {
  N1: { text: 'Là-bas, en Chine, on charge.', syl: 6, budget: 2.10 },
  N2: { text: 'Ici, à Douala, on reçoit.', syl: 9, budget: 3.00 },
  N3a: { text: 'Un conteneur part.', syl: 5, budget: 1.65 },
  N3b: { text: 'Un autre arrive.', syl: 5, budget: 1.60 },
  N4: { text: 'Ici, une autre voiture arrive.', syl: 10, budget: 3.20 },
  N5a: { text: 'Tes colis sont en Chine ?', syl: 6, budget: 1.95 },
  N5b: { text: 'Écris : colis.', syl: 4, budget: 1.40 },
  NCa: { text: 'Tes colis sont en Chine ?', syl: 6, budget: 1.95, alias: 'N5a' },
  NCb: { text: 'Réponds : colis.', syl: 4, budget: 1.40 },
};
const N_IDS = VARIANT === 'main' ? ['N1', 'N2', 'N3a', 'N3b', 'N4', 'N5a', 'N5b'] : VARIANT === 'cut' ? ['N1', 'N2', 'NCa', 'NCb'] : ['N1', 'N2', 'NCa', 'N5b'];
const ALIAS = { n1: 'N1', n2: 'N2', n3a: 'N3a', n3b: 'N3b', n4: 'N4', n5a: 'N5a', n5b: 'N5b', nca: 'NCa', ncuta: 'NCa', n5acut: 'NCa', ncb: 'NCb', ncutb: 'NCb', n5bcut: 'NCb', n5bwa: 'NCb', n5bw: 'NCb', ncutbwa: 'NCb' };
/** takes.json → {id: {dur, words, lead, file, sps}} (tolerant: {id: {…}}, {takes: {…}}, [{id, …}], chosen index) */
function parseTakes(J) {
  const out = {}; if (!J) return out;
  let ent = J.takes || J.lines || J.voices || J;
  if (Array.isArray(ent)) { const o = {}; for (const e of ent) if (e && (e.id || e.line)) o[e.id || e.line] = e; ent = o; }
  for (const k in ent) {
    let e = ent[k]; if (!e || typeof e !== 'object') continue;
    const id = ALIAS[nrm(k)] || (NARR[k] ? k : null); if (!id) continue;
    if (Array.isArray(e.takes)) { const c = e.chosen ?? e.pick ?? e.best ?? 0; e = Object.assign({}, e, typeof c === 'number' ? e.takes[c] : e.takes.find(q => q.id === c || q.file === c) || {}); }
    const dur = +(e.dur ?? e.duration ?? e.speech_dur ?? e.played ?? e.len ?? e.seconds);
    if (!(dur > 0)) continue;
    const words = Array.isArray(e.words) ? e.words.map(w => ({ w: w.w || w.word, s: +(w.s ?? w.start), e: +(w.e ?? w.end) })).filter(w => w.w && isFinite(w.s)) : [];
    out[id] = { dur: R6(dur), words, lead: +(e.lead ?? e.offset ?? 0) || 0, file: e.file || e.path || e.wav || null, sps: e.sps ?? e.syl_per_s ?? null };
  }
  return out;
}
const TK = parseTakes(TAKES);
if (!TK.NCa && TK.N5a) TK.NCa = TK.N5a;              // film 2 reuses the same line « Tes colis sont en Chine ? »
for (const id in NARR) {
  const tk = TK[id]; DUR[id] = tk ? tk.dur : NARR[id].budget;
  WORDS[id] = tk && tk.words.length ? tk.words : [];
  SRCW[id] = tk ? 'takes.json' : 'budget (no take yet)';
}
NOTES.push(TAKES ? `narrator takes: ${Object.keys(TK).join(' ') || 'none parsed'} (rush2/voice/takes.json)` : 'narrator: no rush2/voice/takes.json yet — durations = SERIE budgets');
NOTES.push(RWORDS ? 'real voice: word times from rush2/voice/real_words.json' : 'real voice: word times from the SERIE §4 marks (rush2/voice/real_words.json not present)');
const T = {};
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; let c = 0;
  const ks = String(prefix).split('|').map(nrm).filter(Boolean);
  for (const w of ws) { const f = nrm(w.w); if (ks.some(k => f.startsWith(k))) { if (c++ === nth) return w; } }
  return null;
}
/** absolute film time of the nth word of voice / line id starting with prefix ('a|b'), else T[id] + fb */
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
/** the STRESSED syllable of that word (last syllable onset of the alignment, else its vowel, else the word start): the
 *  hit of a stamp lands on the accent (« dépo-SÉ », « re-ÇU », « FORT ») */
function WS(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); if (!w) return T[id] + fb; const s = w.syl && w.syl.length ? w.syl[w.syl.length - 1] : (w.vowel !== null && w.vowel !== undefined ? w.vowel : w.s); return T[id] + s; }
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + (NARR[id] ? DUR[id] : (WORDS[id] && WORDS[id].length ? WORDS[id][WORDS[id].length - 1].e : DUR[id]));
const SYL = (id, k) => DUR[id] * k / NARR[id].syl;
const speech = id => NARR[id] ? [T[id], T[id] + DUR[id]] : [T[id] + WORDS[id][0].s, T[id] + WORDS[id][WORDS[id].length - 1].e];
const wordsOf = id => (WORDS[id] || []).map(w => ({ w: w.w, s: T[id] + w.s, e: T[id] + w.e }));

// =====================================================================================================================
// 2. ANCHORS (§5.1 film 1 · §5.2 film 2 = block A + block E + block F of film 1, E moved to 6,10)
// =====================================================================================================================
const A = {};
A.cover = 0;
T.N1 = .20;                                         // N1 « Là-bas, en Chine, on charge. » 0,20–2,30
A.glA = 2.55;                                       // MILIEU → BAS (the Douala window opens on « Ici »)
T.N2 = 2.95;                                        // N2 « Ici, à Douala, on reçoit. » 2,95–5,95
A.B = 6.10;                                         // film 1: the map (block B) · film 2: block E
if (!CUT) {
  A.pinG = A.B + .35; A.pinD = A.B + .50;           // 6,45 / 6,60 the pins drop
  A.route0 = A.B + .60; A.route1 = A.B + 1.40;      // 6,70–7,50 the route is drawn
  T.N3a = A.B + .70;                                // 6,80 « Un conteneur part. »
  A.txt1 = T.N3a - .05;                             // 6,75 line 1
  A.ringG = A.txt1;                                 // 6,75–7,35 amber ring around card G
  T.N3b = Math.max(A.B + 2.70, END('N3a') + .35);   // 8,80 « Un autre arrive. »
  A.txt2 = T.N3b - .05;                             // 8,75 line 2
  A.ringD = A.txt2;                                 // 8,75–9,35 orange ring around card D
  A.ul2 = W('N3b', 'autre', 0, .15);                // 8,95 the felt underline under « Un autre » (.30 s)
  A.flow0 = A.B + .90;                              // 7,00 the first parcel leaves Guangzhou (then every ,80 s)
  A.cardG = A.B + 2.60;                             // 8,70 card G freezes on r 86,50
  A.Bout = A.B + 4.30;                              // 10,40 cards fly back, text fades
  A.C = A.B + 4.80;                                 // 10,90 block C (band HAUT)
  T.RV2 = A.C + .10;                                // 11,00 « Voilà, ce véhicule doit être chargé dans le conteneur. »
  A.G4 = A.C + 2.25;                                // 13,15 G4 (v2 r 6,55)
  A.G6 = A.G4 + .98;                                // 14,13 G6 freeze r 1,20 (G4 cut at r 7,53: shirtless worker from r 7,57)
  A.glC = A.C + 3.85;                               // 14,75 HAUT → BAS (the camera « rises » onto the white SUV)
  A.txtC = A.glC + .35;                             // 15,10 « ICI, UNE AUTRE VOITURE ARRIVE. »
  T.N4 = A.glC + .45;                               // 15,20
  A.ulC = W('N4', 'autre', 0, SYL('N4', 2));        // 15,84 underline under « UNE AUTRE »
  A.D = A.C + 7.75;                                 // 18,65 block D (BAS → HAUT)
  T.RV1A = A.D + .35;                               // 19,00
  T.RV1B = T.RV1A + (RV.RV1A.out - RV.RV1A.in);     // 21,20 (pause brought back to ,49 s)
  A.sub1b = W('RV1B', 'aux') - .07;                 // 21,40 second card of RV1
  A.merci = W('RV1A', 'merci') - .06;               // 19,85 MERCI (2 frames before the onset: the eye leads the ear)
  A.merciEnd = Math.min(A.merci + 1.45, A.sub1b - .05);   // 21,30: lands in the subtitle's « merci » before its card leaves
  A.merciFly = A.merciEnd - .40;                    // 20,90 → 21,30 the flight
  A.glD2 = W('RV1B', 'clients') - .18;              // 21,45 HAUT → BAS: Douala opens on « clients »
  A.G8 = A.D + 2.15;                                // 20,80 G8 (v1 r 13,90)
  A.G9 = A.G8 + 1.55;                               // 22,35 G9 (v1 r 90,00)
  A.E = A.G9 + 1.20;                                // 23,55 block E
} else {
  A.E = A.B;                                        // film 2: 6,10 straight into the slogan
}
T.RV3 = A.E + .20;                                  // 23,75 · 6,30 « Voilà, directement déposé, directement reçu. »
A.depose = WS('RV3', 'depos', 0, 1.89);             // 25,64 · 8,19 DÉPOSÉ on « dépo-SÉ » (G10 freezes on it)
A.glE2 = W('RV3', 'directement', 1);                // 26,90 · 9,45 HAUT → BAS on the 2nd « directement »
A.recu = WS('RV3', 'recu', 0, 3.81);                // 27,56 · 10,11 REÇU on « re-ÇU »
A.musicCut = A.depose - .20;                        // 25,44 · 7,99 the makossa stops dead (back at the plate)
T.RV4 = T.RV3 + DUR.RV3 + .38;                      // 28,30 · 10,85 = T0 of the signature (§3.10)
A.T0 = T.RV4;
A.F = A.T0 - .35;                                   // 27,95 · 10,50 the band leaves by the bottom, Douala goes PLEIN
A.recuEnd = A.recu + 1.40;                          // 28,96 · 11,51 REÇU held 1,40 s; cut v40 → v38
A.fort = WS('RV4', 'fort', 0, .88);                 // 29,18 · 11,73 C'EST FORT ! on « FORT »
A.sigSub = A.T0 + 1.25;                             // 29,55 → 32,25 « Bonzini Trading, / faites-nous confiance. »
A.sigSubOut = A.T0 + 3.95;
A.whip = A.T0 + 2.40;                               // filé 30,60–30,80 (switch at 30,70)
A.panel = A.T0 + 2.50;                              // 30,80 the real Bonzini panel + violet plate + balafon
A.major = A.T0 + 3.10;                              // 31,40 the makossa back, in major
A.pill = A.T0 + 4.00;                               // 32,30 the amber pill
const NC = CUT ? 'NCa' : 'N5a', NC2 = VARIANT === 'cut' ? 'NCb' : 'N5b';
T[NC] = A.pill + .15;                               // 32,45 · 15,00 « Tes colis sont en Chine ? »
T[NC2] = END(NC) + .35;                             // 34,75 · 17,30 « Écris : colis. » / « Réponds : colis. »
A.freeze = END(NC2) + .35;                          // 36,50 · 19,05 everything holds, ambience only
T.end = END(NC2) + .65;                             // 36,80 · 19,35 cut to image 0 (loop)
for (const k in T) T[k] = R6(T[k]); for (const k in A) A[k] = R6(A[k]);
const N = Math.round(T.end * FPS);

// =====================================================================================================================
// 3. THE BAND-ROUTE (§3.2): position of its top edge, glides .35 s ease-out-back with a 16 px overshoot
// =====================================================================================================================
const BAND_H = 190, POS = { H: 1110, M: 865, B: 590 }, GLIDE = .35, OVER = 16;
/** the back-out constant s whose overshoot is `ratio` of the travel: max overshoot of backOut = 4s³ / (27 (s+1)²) */
function backS(ratio) { let a = 0, b = 10; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (4 * m * m * m / (27 * (m + 1) * (m + 1)) < ratio) a = m; else b = m; } return (a + b) / 2; }
const BAND_KEYS = CUT ? [
  { t: 0, to: 'M' }, { t: A.glA, to: 'B' }, { t: A.E, to: 'H' }, { t: A.glE2, to: 'B' }, { t: A.F, to: 'off' },
] : [
  { t: 0, to: 'M' }, { t: A.glA, to: 'B' }, { t: A.B, to: 'hide', dur: .20 }, { t: A.Bout + .15, to: 'H', enter: true },
  { t: A.glC, to: 'B' }, { t: A.D, to: 'H' }, { t: A.glD2, to: 'B' }, { t: A.E, to: 'H' }, { t: A.glE2, to: 'B' }, { t: A.F, to: 'off' },
];
/** band(t) → {pos, y0 (top edge, overshoot included), y1 = y0 + 190, a (opacity of the band), glide: {from, to, t0, t1, p} | null} */
function band(t) {
  let i = 0; while (i < BAND_KEYS.length - 1 && t >= BAND_KEYS[i + 1].t) i++;
  const k = BAND_KEYS[i], prev = i > 0 ? BAND_KEYS[i - 1] : null;
  const fromPos = prev ? (prev.to === 'hide' || prev.to === 'off' ? null : prev.to) : k.to;
  if (i === 0) return { pos: k.to, y0: POS[k.to], y1: POS[k.to] + BAND_H, a: 1, glide: null };
  const d = k.dur || GLIDE, x = kk(t, k.t, k.t + d);
  if (k.to === 'hide') {                                     // block B: down 40 px and fade (6,10–6,30)
    const y = POS[fromPos] + 40 * easeOut(x);
    return { pos: x >= 1 ? null : fromPos, y0: y, y1: y + BAND_H, a: 1 - x, glide: x < 1 ? { from: fromPos, to: null, t0: k.t, t1: k.t + d, p: x } : null };
  }
  if (k.enter) {                                             // back at HAUT: rises 40 px + fades in (10,55–10,90)
    const s = backS(OVER / 40), y = POS[k.to] + 40 * (1 - backOut(x, s));
    return { pos: k.to, y0: y, y1: y + BAND_H, a: easeOut(kk(t, k.t, k.t + .25)), glide: x < 1 ? { from: null, to: k.to, t0: k.t, t1: k.t + d, p: x } : null };
  }
  if (k.to === 'off') {                                      // leaves by the bottom (same curve)
    const y0 = POS[fromPos], y1 = SH + 30, s = backS(OVER / (y1 - y0)), y = lerp(y0, y1, backOut(x, s));
    return { pos: x >= 1 ? null : fromPos, y0: y, y1: y + BAND_H, a: x >= 1 ? 0 : 1, glide: x < 1 ? { from: fromPos, to: 'off', t0: k.t, t1: k.t + d, p: x } : null };
  }
  const y0 = POS[fromPos], y1 = POS[k.to], s = backS(OVER / Math.abs(y1 - y0)), y = lerp(y0, y1, backOut(x, s));
  return { pos: x >= 1 ? k.to : (x < .5 ? fromPos : k.to), y0: y, y1: y + BAND_H, a: 1, glide: x < 1 ? { from: fromPos, to: k.to, t0: k.t, t1: k.t + d, p: x } : null };
}
/** the fold of block F: G folds up, Douala grows to PLEIN (A.F → A.F + ,35, ease-out, no overshoot) */
const foldP = t => easeOut(kk(t, A.F, A.F + .35));
// ---------- the darkening of the secondary window (§3.2: 35 %, .2 s fades; image 0 never darkened) ----------
const DARK_KEYS = CUT ? [[.15, 'D'], [A.glA, 'G'], [A.E, 'D'], [A.glE2, 'G'], [A.F, null]]
  : [[.15, 'D'], [A.glA, 'G'], [A.B, null], [A.Bout + .30, 'D'], [A.glC, 'G'], [A.D, 'D'], [A.glD2, 'G'], [A.E, 'D'], [A.glE2, 'G'], [A.F, null]];
function dark(side, t) {
  let prev = 0, v = 0;
  for (const [tc, sd] of DARK_KEYS) { if (t < tc) break; const tgt = sd === side ? .35 : 0; v = lerp(prev, tgt, kk(t, tc, tc + .2)); prev = tgt; }
  return v;
}
/** which window leads (the sound follows it, §3.11) */
const mainSide = t => { const b = band(t); return t >= A.F ? 'D' : b.pos === 'B' ? 'D' : b.pos === 'H' ? 'G' : (t < A.glA ? 'G' : 'D'); };

// =====================================================================================================================
// 4. WINDOWS AND CARDS (§3.3)
// =====================================================================================================================
const CARD = {                                     // block B cards: CONTENT rects (screen px), tilt (°), source rects
  G: { x: 520, y: 300, w: 420, h: 300, tilt: -4, src: [188, 330, 464, 527] },   // v1 r 83,90 → 86,50 + freeze
  D: { x: 100, y: 1000, w: 420, h: 300, tilt: 3, src: [236, 280, 576, 523] },   // v24 r 3,20 → 8,00 (rect corrected, see MODULES.md)
};
const CARD_LOOK = { r: 24, border: 10, borderColor: '#FFFFFF', shadow: .69 };
/** card flight progress: out 6,10 → 6,55 (window → card), back 10,40 → 10,90 (card → HAUT window); 0 = window, 1 = card */
function cardU(t) {
  if (CUT) return null;
  if (t < A.B || t >= A.C) return null;
  if (t < A.B + .45) return { u: ease(kk(t, A.B, A.B + .45)), dir: 'out', p: kk(t, A.B, A.B + .45) };
  if (t < A.Bout) return { u: 1, dir: 'rest', p: 1 };
  return { u: 1 - ease(kk(t, A.Bout, A.C)), dir: 'back', p: kk(t, A.Bout, A.C) };
}
const lerpRect = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });
/** the window rect of side G / D at t (screen px) — duplex (band edges), cards (block B), fold (block F) */
function winRect(side, t) {
  const c = cardU(t);
  if (c) {
    const from = c.dir === 'back' ? (side === 'G' ? { x: 0, y: 0, w: SW, h: POS.H } : { x: 0, y: POS.H + BAND_H, w: SW, h: SH - POS.H - BAND_H })
      : (side === 'G' ? { x: 0, y: 0, w: SW, h: POS.B } : { x: 0, y: POS.B + BAND_H, w: SW, h: SH - POS.B - BAND_H });
    const C = CARD[side], r = lerpRect(from, C, c.u), lift = 1 + .05 * Math.sin(Math.PI * c.u) * (c.dir === 'rest' ? 0 : 1);
    return { kind: 'window', x: r.x + r.w * (1 - lift) / 2, y: r.y + r.h * (1 - lift) / 2, w: r.w * lift, h: r.h * lift, tilt: C.tilt * c.u,
      r: CARD_LOOK.r * c.u, border: CARD_LOOK.border * c.u, borderColor: CARD_LOOK.borderColor, shadow: CARD_LOOK.shadow * c.u, card: side, u: c.u };
  }
  if (t >= A.F) {                                            // the fold: G folds up to 0, D (from G's edge) grows to PLEIN
    const b0 = POS.B, yb = lerp(b0, 0, foldP(t));
    return side === 'G' ? { kind: 'window', x: 0, y: 0, w: SW, h: Math.max(1, yb), r: 0, border: 0, shadow: 0 }
      : { kind: 'window', x: 0, y: yb, w: SW, h: SH - yb, r: 0, border: 0, shadow: 0 };   // Douala opens under the leaving band at once
  }
  const b = band(t);
  return side === 'G' ? { kind: 'window', x: 0, y: 0, w: SW, h: Math.max(1, b.y0), r: 0, border: 0, shadow: 0 }
    : { kind: 'window', x: 0, y: b.y1, w: SW, h: Math.max(1, SH - b.y1), r: 0, border: 0, shadow: 0 };
}
/** the useful centre Q of a window (§3.3): top = its centre, bottom = (top edge + 1540) / 2, PLEIN = (540, 960) */
function qOf(side, t, R) {
  if (side === 'G') return { x: SW / 2, y: R.y + R.h / 2 };
  if (t >= A.F) return { x: SW / 2, y: lerp((POS.B + BAND_H + 1540) / 2, 960, foldP(t)) };
  return { x: SW / 2, y: (R.y + 1540) / 2 };
}
const GZ = { v1: true, v2: true, v3: true };                // Guangzhou: never bounded (the F are verified), audited
/** crop window (SOURCE px) putting F on Q at scale s in region R; Douala: bounded inside the source (§3.3) */
function cropFor(clip, R, Q, s, F, zoom = 1) {
  const D = CLIPS[clip], w = R.w / s / zoom, h = R.h / s / zoom;
  let cx = F.x + (R.x + R.w / 2 - Q.x) / s, cy = F.y + (R.y + R.h / 2 - Q.y) / s;
  if (!GZ[clip]) { cx = cl(cx, Math.min(w / 2, D.w / 2), Math.max(D.w - w / 2, D.w / 2)); cy = cl(cy, Math.min(h / 2, D.h / 2), Math.max(D.h - h / 2, D.h / 2)); }
  return { cx, cy, w };
}
const FOCUS = {};                                           // per shot: s, F(t) (MODULES.md: windows(t) reports them)

// =====================================================================================================================
// 5. THE SCREEN PUSH + SHAKE OF THE STAMPS (§3.6: ×1,03 of the whole screen, 10 px shake damped over 6 frames)
// =====================================================================================================================
const STAMP_T = [A.depose, A.recu, A.fort];
function screenFx(t) {
  let dx = 0, dy = 0, s = 1;
  for (const ts of STAMP_T) {
    const d = t - ts; if (d < 0 || d > .4) continue;
    const amp = 10 * Math.exp(-d * 15);                     // ≈ 5 % after 6 frames
    dx += amp * Math.sin(d * 2 * Math.PI * 14 + .4); dy += amp * .7 * Math.cos(d * 2 * Math.PI * 11 + 1.1);
    s *= 1 + .03 * bump(d, 0, .30);
  }
  return { dx, dy, s };
}
/** EDL cam of a shot: the whole-screen push (about (540, 960)) + shake, expressed in its region */
const camOf = layoutFn => t => { const f = screenFx(t); if (f.s === 1 && !f.dx && !f.dy) return null; const R = layoutFn(t);
  return { dx: f.dx + (R.x + R.w / 2 - SW / 2) * (f.s - 1), dy: f.dy + (R.y + R.h / 2 - SH / 2) * (f.s - 1), s: f.s }; };

// =====================================================================================================================
// 6. THE SHOTS (EDL)
// =====================================================================================================================
const GRADE = { vignette: .15 };                            // the rest of §3.1 is BAKED into the frames (prep_clips.py)
const BAKE = { gz: { exposure: -.10, contrast: .06 }, dla: { contrast: .08, sat: 1.05, warmth: .05 },
  of: clip => (GZ[clip] ? 'gz' : 'dla') };
/** a duplex shot: window of `side`, scale s, focal point F (constant or t → {x, y}), zoom (screen push, ≥ 1) */
function duplex(id, clip, side, t0, t1, src, s, F, o = {}) {
  const Ff = typeof F === 'function' ? F : () => F, zf = o.zoom || (() => 1);
  const layout = t => winRect(side, t);
  FOCUS[id] = { side, s, F: Ff };
  return Object.assign({ id, clip, t0, t1, src, layout, clamp: false,
    crop: t => { const R = winRect(side, t); return cropFor(clip, R, qOf(side, t, R), s, Ff(t), zf(t)); },
    grade: t => ({ tint: ['#000', dark(side, t)] }), cam: camOf(layout), side,
    amb: { mode: 'hold', g: 0 } }, o.extra || {});
}
const freezeAt = (t0, s0, tf) => ({ keys: [[t0, s0], [tf, s0 + (tf - t0)], [tf + 60, s0 + (tf - t0)]], interp: 'linear' });
const SHOTS = [];
// ---- A · 0,00–6,10 « LÀ-BAS, ON CHARGE. / ICI, ON REÇOIT. » ----
SHOTS.push(
  duplex('G1', 'v1', 'G', 0, 2.75, { in: 75.40 }, 3.913, { x: 326, y: 430 }),
  duplex('G2', 'v1', 'G', 2.75, A.B, { in: 16.00 }, 3.913, { x: 326, y: 470 }),
  duplex('D1', 'v31', 'D', 0, A.glA, { in: 5.00 }, 1.875, { x: 288, y: 340 }),     // SERIE F.y 170 put the machine under y 1540 on the cover
  duplex('D2', 'v31', 'D', A.glA, A.B, { in: 8.20 }, 1.875, { x: 288, y: 300 }),
);
if (!CUT) {
  // ---- B · 6,10–10,90 the map: the windows fly into two live cards, and back ----
  const cardCrop = side => t => {
    const C = CARD[side], R = winRect(side, t), c = cardU(t), [x0, y0, x1, y1] = C.src;
    const cw = x1 - x0, ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
    if (side === 'G') return { cx: ccx, cy: ccy, w: cw };                       // v1: the same 276 px wide, only the aspect changes
    const u = c ? c.u : 1, w = Math.exp(lerp(Math.log(576), Math.log(cw), u));  // v24: s 1,875 (window) → 1,235 (card)
    return { cx: lerp(288, ccx, u), cy: ccy, w };
  };
  SHOTS.push(
    { id: 'CG', clip: 'v1', t0: A.B, t1: A.C, src: freezeAt(A.B, 83.90, A.cardG), layout: t => winRect('G', t), crop: cardCrop('G'), clamp: false, amb: false, side: 'G' },
    { id: 'CD', clip: 'v24', t0: A.B, t1: A.C, src: { in: 3.20 }, layout: t => winRect('D', t), crop: cardCrop('D'), amb: { mode: 'hold', g: -6 }, side: 'D' },
  );
  // ---- C · 10,90–18,65 the cars ----
  const fy3 = t => ({ x: 235, y: lerp(760, 440, backOut(kk(t, A.glC, A.glC + GLIDE), backS(OVER / 520))) });
  SHOTS.push(
    duplex('G3', 'v2', 'G', A.C, A.G4, { in: 0.10 }, 2.3276, { x: 232, y: 450 }),
    duplex('G4', 'v2', 'G', A.G4, A.G6, { in: 6.55 }, 2.3276, { x: 232, y: 430 }),
    duplex('G6', 'v2', 'G', A.G6, A.D, { in: 1.20, speed: 0 }, 2.3276, { x: 232, y: 450 }, { zoom: t => 1 + .03 * ease(kk(t, A.G6, A.D)) }),
    duplex('D3', 'v7', 'D', A.C, A.D, { in: 0.70 }, 2.30, fy3),
  );
  // ---- D · 18,65–23,55 « merci déjà aux clients qui nous ont fait confiance » ----
  SHOTS.push(
    duplex('G7', 'v1', 'G', A.D, A.G8, { in: 9.10 }, 3.913, { x: 326, y: 450 }),
    duplex('G8', 'v1', 'G', A.G8, A.G9, { in: 13.90 }, 3.913, { x: 326, y: 470 }),
    duplex('G9', 'v1', 'G', A.G9, A.E, { in: 90.00 }, 3.913, { x: 326, y: 470 }),
    duplex('D4', 'v25', 'D', A.D, A.glD2, { in: 13.00 }, 1.875, { x: 288, y: 450 }),   // SERIE F.y 520 cut the two team-mates at the waist
    duplex('D5', 'v17', 'D', A.glD2, A.E + .35, { in: 0.20 }, 1.875, { x: 288, y: 420 }),   // its tail 23,55–23,90 = « D6 »
  );
}
// ---- E · « Voilà, directement déposé, directement reçu. » ----
const tD7 = CUT ? A.E : A.E + .35;                          // film 2: v40 from r 0 at 6,10 (D6 has no sense without D5)
SHOTS.push(
  duplex('G10', 'v1', 'G', A.E, A.F + .35, freezeAt(A.E, 19.40, A.depose), 3.913, { x: 326, y: 470 }),
  duplex('D7', 'v40', 'D', tD7, A.recuEnd, { in: 0.00 }, 1.875, { x: 288, y: 600 }),
);
// ---- F · the signature (§3.10) ----
const PANEL = { x: 24, y: 190, w: 1032, h: 527, r: 24, src: [0, 25, 464, 262], s: 2.224, F: { x: 232, y: 143.5 }, fix: { x: 250, y: 195 }, push: 1.04 };
const panelZoom = t => 1 + (PANEL.push - 1) * ease(kk(t, A.panel, T.end));
SHOTS.push(
  { id: 'P1', clip: 'v38', t0: A.recuEnd, t1: A.whip, src: { in: 5.50 }, layout: 'full', crop: { cx: 288, cy: 512, w: 576 }, cam: camOf(() => ({ x: 0, y: 0, w: SW, h: SH })), amb: { mode: 'hold', g: 0 }, side: 'D' },
  { id: 'PN', clip: 'v3', t0: A.whip, t1: T.end + 1 / FPS, layout: { kind: 'window', x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r, border: 0, shadow: .85 },
    src: { keys: [[A.whip, .40 - (A.panel - A.whip)], [A.panel + 2.00, 2.40], [T.end + 60, 2.40]], interp: 'linear' },
    crop: t => { const z = panelZoom(t), k0 = PANEL.s, k1 = k0 * z;      // the push keeps the title's source point fixed
      return { cx: PANEL.fix.x - (PANEL.fix.x - PANEL.F.x) * k0 / k1, cy: PANEL.fix.y - (PANEL.fix.y - PANEL.F.y) * k0 / k1, w: PANEL.w / k1 }; },
    clamp: false, in: { type: 'whip', dir: 'right', dur: .20, smear: .111 }, amb: { mode: 'hold', g: 0, in: 2.40 }, side: 'P' },
);
FOCUS.P1 = { side: 'D', s: 1.875, F: () => ({ x: 288, y: 512 }) };
FOCUS.PN = { side: 'P', s: PANEL.s, F: () => PANEL.F };
// ---------- what must never show, and the blurs (data/hides.json) ----------
const MUST_HIDE = {
  v1: [{ box: [24, 60, 416, 205], why: 'stickers (top)' }, { box: [40, 425, 135, 185], why: 'stickers (left column)' }],
  v2: [{ box: [86, 0, 312, 174], why: 'stickers (business card, plane / ship / truck / badge)' }],
  v3: [{ box: [45, 409, 390, 211], why: 'stickers' }, { box: [0, 283, 464, 120], why: 'line 6 « Foreign Exchange… », +86 numbers, QR codes' }],
  v7: [{ t0: 0, t1: .6, box: [440, 0, 136, 900], why: 'MAERSK star (container side)' }],
};
const HIDE = {};
const HP = (HIDES && HIDES.params) || { sigma: 18, feather: 8, margin: 10 };
if (HIDES && HIDES.hide) for (const clip in HIDES.hide) for (const h of HIDES.hide[clip]) {
  (HIDE[clip] = HIDE[clip] || []).push({ name: h.name, t0: h.t0, t1: h.t1, keys: h.keys, kind: 'gauss', shape: h.shape, why: h.why });
  (MUST_HIDE[clip] = MUST_HIDE[clip] || []).push({ t0: h.t0, t1: h.t1, keys: h.keys, why: h.why });
}
const E = EDL.build({ clips: CLIPS, shots: SHOTS, hide: HIDE, mustHide: MUST_HIDE, grade: GRADE, cuts: [], covered: t => QA.covered(t) });

/** source px of an active shot → screen px (crop, rotation, region, transition motion) */
function project(a, x, y) {
  const c = a.crop, R = a.R, fx = a.fx, k = R.w / c.w * fx.sc, r = ((c.rot || 0) + (fx.rot || 0) + (R.tilt || 0)) * Math.PI / 180;
  const dx = (x - c.cx) * k, dy = (y - c.cy) * k;
  return [R.x + R.w / 2 + fx.dx + dx * Math.cos(r) - dy * Math.sin(r), R.y + R.h / 2 + fx.dy + dx * Math.sin(r) + dy * Math.cos(r)];
}

// =====================================================================================================================
// 7. GEOMETRY, COLOURS, TEXTS
// =====================================================================================================================
const COL = { violet: '#A947FE', violetD: '#7B22D6', amber: '#F3A745', orange: '#FE560D', night: '#10142B', ink: '#231629',
  white: '#FFFFFF', grey: '#B9B3C2', kraft: '#C79E6C', kraftLine: '#E9D7B5' };
const G = {
  W: SW, H: SH, cx: SW / 2,
  safe: { top: 150, bottom: 1540, rightX: 960, rightY0: 900, rightY1: 1560 },
  band: { h: BAND_H, pos: POS, glide: GLIDE, overshoot: OVER, alpha: .92, dash: [14, 10], line: 4, textX: 64, textMaxX: 960, size: 60, lead: 72 },
  sub: { headDy: 18, headSize: 30, size: 54, lead: 62, line1Dy: 98, line2Dy: 160, waveX0: 850, waveX1: 946, bars: 16 },
  pillG: { x: 60, y0: 170, y1: 230, size: 40, flag: [54, 36], r: 30 },
  pillD: { x: 60, dy: 18, h: 60, size: 40 },
  logo: { x0: 856, x1: 1020, y0: 164, y1: 228, textX1: 1020, textY0: 236, textY1: 270, textSize: 30 },
  mention: { x0: 856, x1: 1020, y0: 164, y1: 270 },
  stamp: { depose: { size: 150, rot: -4, color: 'amber' }, recu: { size: 150, rot: 4, color: 'orange' }, fort: { size: 170, rot: -3, color: 'orange', cx: 540, cy: 620, lines: 2 } },
  sigSub: { x0: 64, x1: 960, y0: 1240, y1: 1430, r: 20 },
  panel: { x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r },
  pillPanel: { x: 48, y0: 214, y1: 274 },
  plate: { x0: 90, x1: 930, y0: 770, y1: 950, logoX0: 120, logoX1: 200, size1: 50, size2: 40 },
  cta: { x0: 90, x1: 930, y0: 1240, y1: 1470, size1: 48, size2: 88, arrowX0: 860, arrowX1: 920 },
  map: { k: 7.833, x0: 60, y0: 600, lat0: 40, pushC: [540, 800], push: 1.03, cards: CARD,
    pins: { GZ: { lon: 113.26, lat: 23.13, x: 947, y: 732, color: 'amber' }, DLA: { lon: 9.70, lat: 4.05, x: 136, y: 882, color: 'orange' } },
    labels: { GZ: { text: 'GUANGZHOU', x1: 940, y0: 770, y1: 816, size: 44, color: 'amber', align: 'right' }, DLA: { text: 'DOUALA', x0: 165, y0: 905, y1: 951, size: 44, color: 'orange', align: 'left' } },
    route: { p0: [947, 732], c: [560, 470], p1: [136, 882], width: 8, dash: [20, 14] },
    block: { x0: 64, x1: 960, y0: 1360, y1: 1500, size: 64 }, parcel: [26, 20] },
  merci: { size: 190, cx: 540, cy: 560, halo: 40 },
  parcel: { w: 28, h: 22, x0: 64, x1: 1016 },
};
const geoXY = (lon, lat) => [G.map.x0 + G.map.k * lon, G.map.y0 + G.map.k * (G.map.lat0 - lat)];
const NB = ' ';                                            // no-break space (French: before : ? !)
const sub = (id, voice, t0, t1, text, o = {}) => ({ id, voice, t0, t1, text, mode: o.mode || 'band', head: 'vraie voix · l’équipe Bonzini à Guangzhou' });
// keywords that keep their colour once said (§3.5); « Bonzini Trading » is always violet
const KEYCOL = { merci: 'amber', depose: 'amber', recu: 'orange', bonzini: 'violet', trading: 'violet' };
const SUBS = CUT ? [
  sub('sub3', 'RV3', T.RV3, A.F, RV.RV3.text),
  sub('sub4', 'RV4', A.sigSub, A.sigSubOut, RV.RV4.text, { mode: 'box' }),
] : [
  sub('sub2', 'RV2', T.RV2, A.glC, RV.RV2.text),
  sub('sub1a', 'RV1A', T.RV1A, A.sub1b, RV.RV1A.text),
  sub('sub1b', 'RV1B', A.sub1b, A.E, RV.RV1B.text),
  sub('sub3', 'RV3', T.RV3, A.F, RV.RV3.text),
  sub('sub4', 'RV4', A.sigSub, A.sigSubOut, RV.RV4.text, { mode: 'box' }),
];
// band texts (§3.2): words → colours, line opacities keyed in time
const BANDTXT = [
  { id: 'bandA', t0: -1, t1: A.B, lines: ['*LÀ-BAS*, ON CHARGE.', '*ICI*, ON REÇOIT.'], cols: ['amber', 'orange'], size: 60,
    alpha: t => [t < A.glA ? 1 : lerp(1, .4, kk(t, A.glA, A.glA + .2)), t < A.glA ? lerp(1, .4, kk(t, .15, .35)) : lerp(.4, 1, kk(t, A.glA, A.glA + .2))] },
];
if (!CUT) BANDTXT.push({ id: 'bandC', t0: A.txtC, t1: A.D, lines: ['*ICI*, UNE AUTRE VOITURE', 'ARRIVE.'], cols: ['orange'], size: 60,
  underline: { word: 'UNE AUTRE', line: 0, t0: A.ulC, t1: A.ulC + .30, color: 'orange' }, alpha: () => [1, 1] });
const CTA = VARIANT === 'cut' ? ['Tes colis sont en Chine' + NB + '?', 'Réponds *COLIS*'] : ['Tes colis sont en Chine' + NB + '?', 'Écris *COLIS*'];
/** TEXTS() — every text block with its life and box (tools/audit.js: safe zones, holds ≥ 1,4 s, ≤ 3 blocks) */
const TEXTS = () => {
  const L = [];
  for (const b of BANDTXT) L.push([b.t0, b.t1 + .12, b.id, b.lines.join('|'), 'band', 'DX_draw', { box: { x0: 64, x1: 960, y0: POS.B, y1: POS.H + BAND_H } }]);
  for (const s of SUBS) L.push([s.t0, s.t1, s.id, s.text, 'sub2', 'DX_draw', { voice: s.voice, box: s.mode === 'box' ? G.sigSub : { x0: 64, x1: 960, y0: POS.B, y1: POS.H + BAND_H },
    covers: s.voice === 'RV4' ? [W('RV4', 'bonzini'), speech('RV4')[1]] : null }]);   // « Voilà, c'est fort » is not subtitled (§3.10): the stamp says it
  L.push([A.depose, A.F + .35, 'depose', 'DÉPOSÉ', 'stamp2', 'DX_draw', { box: { x0: 290, x1: 790, y0: 180, y1: 650 }, color: COL.amber }]);
  L.push([A.recu, A.recuEnd + .12, 'recu', 'REÇU', 'stamp2', 'DX_draw', { box: { x0: 290, x1: 790, y0: 1020, y1: 1260 }, color: COL.orange }]);
  L.push([A.fort, A.whip + .10, 'fort', 'C’EST|FORT' + NB + '!', 'stamp2', 'DX_draw', { box: { x0: 170, x1: 910, y0: 440, y1: 800 }, color: COL.orange }]);
  L.push([A.panel, T.end + .01, 'plate', 'BONZINI TRADING CARGO|Chine → Douala · bateau ou avion', 'plate', 'DX_draw', { box: G.plate }]);
  L.push([A.pill, T.end + .01, 'cta', CTA.join('|'), 'cta2', 'DX_draw', { box: G.cta }]);
  L.push([-1, T.end + .01, 'logo', 'VRAIES IMAGES', 'logo', 'DX_draw', { box: G.mention }]);
  for (const p of pillSpans()) L.push([p.t0, p.t1, p.id, p.text, 'pill', 'DX_draw', { box: p.box }]);
  if (!CUT) {
    L.push([A.pinG, A.Bout + .15, 'labGZ', 'GUANGZHOU', 'maplabel', 'MP_draw', { box: { x0: 600, x1: 940, y0: 770, y1: 816 } }]);
    L.push([A.pinD, A.Bout + .15, 'labDLA', 'DOUALA', 'maplabel', 'MP_draw', { box: { x0: 165, x1: 335, y0: 905, y1: 951 } }]);
    L.push([A.txt1, A.Bout + .15, 'blockB', 'Un conteneur *part*.|*Un autre* arrive.', 'mapblock', 'MP_draw', { box: G.map.block }]);
    L.push([A.merci, A.merciEnd, 'merci', 'MERCI', 'merci', 'MP_draw', { box: { x0: 64, x1: 960, y0: 440, y1: 1300 }, color: COL.amber }]);
  }
  return L;
};
function pillSpans() {
  const o = [];
  o.push({ id: 'pillG1', t0: -1, t1: CUT ? A.F + .2 : A.B + .15, text: 'LÀ-BAS · GUANGZHOU', box: { x0: 60, x1: 560, y0: 170, y1: 230 } });
  if (!CUT) o.push({ id: 'pillG2', t0: A.Bout + .35, t1: A.F + .2, text: 'LÀ-BAS · GUANGZHOU', box: { x0: 60, x1: 560, y0: 170, y1: 230 } });
  o.push({ id: 'pillG3', t0: A.panel, t1: T.end + .01, text: 'LÀ-BAS · GUANGZHOU', box: { x0: 48, x1: 548, y0: 214, y1: 274 } });
  o.push({ id: 'pillD1', t0: -1, t1: CUT ? A.whip + .1 : A.B + .15, text: 'ICI · DOUALA', box: { x0: 60, x1: 420, y0: 170, y1: POS.H + BAND_H + 18 + 60 } });
  if (!CUT) o.push({ id: 'pillD2', t0: A.Bout + .35, t1: A.whip + .1, text: 'ICI · DOUALA', box: { x0: 60, x1: 420, y0: 170, y1: POS.H + BAND_H + 18 + 60 } });
  return o;
}

// =====================================================================================================================
// 8. MODULE STATES (MODULES.md) — every function is pure in t
// =====================================================================================================================
/** windows(t) → {G, D, P?}: rect, Q, dark, shot id, s, F, fscreen (F projected), mode */
function windows(t) {
  const o = {}, act = E.active(t);
  for (const a of act) {
    const side = a.shot.side; if (!side) continue;
    const f = FOCUS[a.shot.id], R = a.R, Fp = f ? f.F(t) : null;
    o[side] = { side, rect: { x: R.x, y: R.y, w: R.w, h: R.h, tilt: R.tilt || 0, r: R.r || 0 }, shot: a.shot.id, clip: a.shot.clip, src: a.src,
      s: f ? f.s : null, F: Fp, fscreen: Fp ? project(a, Fp.x, Fp.y) : null, dark: side === 'P' ? 0 : dark(side, t),
      Q: side === 'P' ? { x: R.x + R.w / 2, y: R.y + R.h / 2 } : (R.card ? { x: R.x + R.w / 2, y: R.y + R.h / 2 } : qOf(side, t, R)),
      mode: R.card ? 'card' : side === 'P' ? 'panel' : (R.y <= 0 && R.h >= SH - 1 ? 'full' : 'window'), card: R.card || null, u: R.u };
  }
  return o;
}
/** pills(t) → {G, D}: {x, y0, y1, a, dy (entry slide), text, color, flag ('CN' | 'CM')} or null */
function pills(t) {
  const b = band(t), o = { G: null, D: null }, inA = (t0, t1, fi = .2, fo = .15) => Math.min(t0 < 0 ? 1 : easeOut(kk(t, t0, t0 + fi)), 1 - kk(t, t1 - fo, t1));
  const ent = (t0) => t0 < 0 ? 0 : 20 * (1 - easeOut(kk(t, t0, t0 + .2)));
  for (const p of pillSpans()) {
    if (t < p.t0 || t >= p.t1) continue;
    const a = inA(p.t0, p.t1); if (a <= 0) continue;
    if (p.id.startsWith('pillG')) {
      const pan = p.id === 'pillG3', fo = !pan && t >= A.F ? 1 - kk(t, A.F, A.F + .2) : 1;
      o.G = { x: pan ? G.pillPanel.x : G.pillG.x, y0: pan ? G.pillPanel.y0 : G.pillG.y0, y1: pan ? G.pillPanel.y1 : G.pillG.y1, a: a * fo, dy: ent(p.t0),
        text: p.text, color: 'amber', flag: 'CN', textColor: COL.ink };
    } else {
      const full = t >= A.F, yb = band(t).y1 + G.pillD.dy, yTop = G.pillG.y0;
      const y0 = full ? lerp(POS.B + BAND_H + G.pillD.dy, yTop, easeOut(kk(t, A.F, A.F + .35))) : yb;
      o.D = { x: G.pillD.x, y0, y1: y0 + G.pillD.h, a: a * (full ? 1 : (b.a > 0 ? 1 : 0)), dy: ent(p.t0), text: p.text, color: 'orange', flag: 'CM', textColor: COL.white };
    }
  }
  return o;
}
const emCol = q => /LÀ-BAS/.test(q) ? 'amber' : /ICI/.test(q) ? 'orange' : 'amber';
/** texts(t) → band texts visible at t: [{id, lines: [[{w, segs: [{s, color}]}]…], size, lead, x, y0 (first line top), alpha: [per line], a, dy, underline}] */
function texts(t) {
  const b = band(t), out = [];
  for (const x of BANDTXT) {
    if (t < x.t0 || t >= x.t1 + .12) continue;
    const a = x.t0 < 0 ? 1 : easeOut(kk(t, x.t0, x.t0 + .15)), ao = 1 - kk(t, x.t1, x.t1 + .12);
    const lines = x.lines.map((l, li) => l.split(' ').map(w => ({ w: w.replace(/\*/g, ''),
      segs: w.split('*').map((q, i) => ({ s: q, color: i % 2 ? emCol(q) : 'white' })).filter(q => q.s.length) })));
    const lead = G.band.lead, h = lead * lines.length, y0 = b.y0 + (BAND_H - h) / 2 + 4;
    out.push({ id: x.id, lines, size: x.size, lead, x: G.band.textX, maxX: G.band.textMaxX, y0, alpha: x.alpha(t), a: a * ao * b.a, dy: 24 * (1 - a),
      underline: x.underline ? Object.assign({ p: kk(t, x.underline.t0, x.underline.t1) }, x.underline) : null });
  }
  return out;
}
/** subtitles(t) → the real-voice subtitle at t: {id, voice, mode: 'band' | 'box', box, head, a, lines: [[{w, s, e, state, color}]], env: {voice, u}} */
function subtitles(t) {
  for (const s of SUBS) {
    if (t < s.t0 - .001 || t >= s.t1 + .12) continue;
    const ws = wordsOf(s.voice), a = Math.min(easeOut(kk(t, s.t0, s.t0 + .15)), 1 - kk(t, s.t1, s.t1 + .12));
    let j = 0;
    const lines = s.text.split('|').map(l => l.split(' ').filter(Boolean).map(tok => {
      const k = nrm(tok); let w = null;
      for (let q = j; q < ws.length && k; q++) { const r = nrm(ws[q].w); if (r && (r === k || r.startsWith(k) || k.startsWith(r))) { w = ws[q]; j = q + 1; break; } }
      const said = w ? t >= w.s : true, cur = w ? t >= w.s && t < w.e + .06 : false;
      const kc = Object.keys(KEYCOL).find(q => k.startsWith(q)), col = kc === 'bonzini' || kc === 'trading' ? 'violet' : (kc && said ? KEYCOL[kc] : 'white');
      return { w: tok, s: w ? w.s : null, e: w ? w.e : null, state: cur ? 'current' : said ? 'said' : 'coming', color: col };
    }));
    const b = band(t), box = s.mode === 'box' ? Object.assign({}, G.sigSub) : { x0: 64, x1: 960, y0: b.y0, y1: b.y1 };
    return { id: s.id, voice: s.voice, mode: s.mode, box, head: s.head, a: a * (s.mode === 'band' ? b.a : 1), lines, t0: s.t0, t1: s.t1,
      layout: { headY: box.y0 + G.sub.headDy, line1Y: box.y0 + G.sub.line1Dy, line2Y: box.y0 + G.sub.line2Dy, size: G.sub.size, lead: G.sub.lead }, env: { voice: s.voice, u: t - T[s.voice] } };
  }
  return null;
}
/** stamps(t) → [{id, text, lines, size, rot, color, cx, cy, scale, age (s since the hit), a, ride}] */
function stamps(t) {
  const o = [], w = windows(t);
  if (t >= A.depose && t < A.F + .35) {                     // DÉPOSÉ follows the G window (centre Q; scale 1 → ,75 at BAS)
    const g = w.G, y0 = band(t).y0, sc = t < A.F ? lerp(.75, 1, kk(y0, POS.B, POS.H)) : .75 * (1 - foldP(t));
    if (g) o.push({ id: 'depose', text: 'DÉPOSÉ', lines: ['DÉPOSÉ'], size: 150, rot: -4, color: 'amber', cx: g.Q.x, cy: g.Q.y, scale: sc, age: t - A.depose, a: t < A.F ? 1 : 1 - foldP(t), ride: 'G' });
  }
  if (t >= A.recu && t < A.recuEnd + .12) {                 // REÇU on the machine (the projected focal point of the D window)
    const d = w.D, p = d && d.fscreen ? d.fscreen : [540, 1160];
    o.push({ id: 'recu', text: 'REÇU', lines: ['REÇU'], size: 150, rot: 4, color: 'orange', cx: 540, cy: p[1], scale: 1, age: t - A.recu, a: 1 - kk(t, A.recuEnd, A.recuEnd + .12), ride: 'D' });
  }
  if (t >= A.fort && t < A.whip + .10) {                    // C'EST FORT ! leaves with the image in the filé
    const p1 = E.active(t).find(a => a.shot.id === 'P1');
    o.push({ id: 'fort', text: 'C’EST FORT' + NB + '!', lines: ['C’EST', 'FORT' + NB + '!'], size: 170, rot: -3, color: 'orange', cx: 540 + (p1 ? p1.fx.dx : 0), cy: 620,
      scale: 1, age: t - A.fort, a: p1 ? cl(1 - p1.fx.smear / 140) : 0, ride: 'P1', smear: p1 ? p1.fx.smear : 0 });
  }
  return o;
}
/** merci(t) (film 1) → {a, x, y, scale, size, color, halo, phase: 'hit' | 'hold' | 'fly', fly: {p, from, to, toSize}} */
function merci(t) {
  if (CUT || t < A.merci || t >= A.merciEnd) return null;
  const hit = easeOut(kk(t, A.merci, A.merci + 5 / FPS)), from = [G.merci.cx, G.merci.cy];
  const to = [64 + 75, band(A.merciEnd).y0 + G.sub.line2Dy];       // fallback: « merci » = 1st word of line 2 (20_duplex: DX_wordBox)
  const p = ease(kk(t, A.merciFly, A.merciEnd));
  return { a: 1, x: lerp(from[0], to[0], p), y: lerp(from[1], to[1], p) - 220 * Math.sin(Math.PI * p), scale: lerp(1.5, 1, hit) * lerp(1, G.sub.size / G.merci.size, p),
    size: G.merci.size, color: 'amber', halo: G.merci.halo, phase: t < A.merci + 5 / FPS ? 'hit' : t < A.merciFly ? 'hold' : 'fly',
    fly: { p, t0: A.merciFly, t1: A.merciEnd, from, to, toSize: G.sub.size, toWord: { sub: 'sub1a', word: 'merci' } } };
}
/** map(t) (film 1, block B) → the whole state of the map; null outside 6,10–10,90 */
function map(t) {
  if (CUT || t < A.B || t >= A.C) return null;
  const a = Math.min(easeOut(kk(t, A.B, A.B + .30)), 1 - kk(t, A.Bout + .05, A.Bout + .35));
  const push = lerp(1, G.map.push, kk(t, A.B, A.Bout));
  const pin = (t0, P) => ({ x: P.x, y: P.y, color: P.color, t0, p: kk(t, t0, t0 + .35), a: t >= t0 ? 1 : 0, fall: 120 });
  const flows = []; for (let k = 0; k < 5; k++) { const t0 = A.flow0 + .80 * k, p = kk(t, t0, t0 + 2.4);
    if (t >= t0 && t < t0 + 2.4 + .3) flows.push({ k, t0, t1: t0 + 2.4, p: ease(p), arrived: p >= 1, ring: p >= 1 ? kk(t, t0 + 2.4, t0 + 2.7) : 0 }); }
  const w = windows(t);
  const bg = Math.min(easeOut(kk(t, A.B, A.B + .30)), 1 - kk(t, A.C - .12, A.C));   // the night ground stays under the flight back
  return { a, bg, push, pushC: G.map.pushC, k: G.map.k, x0: G.map.x0, y0: G.map.y0, lat0: G.map.lat0,
    pins: { GZ: pin(A.pinG, G.map.pins.GZ), DLA: pin(A.pinD, G.map.pins.DLA) },
    labels: { GZ: Object.assign({ a: easeOut(kk(t, A.pinG + .1, A.pinG + .3)) * (1 - kk(t, A.Bout, A.Bout + .15)) }, G.map.labels.GZ),
      DLA: Object.assign({ a: easeOut(kk(t, A.pinD + .1, A.pinD + .3)) * (1 - kk(t, A.Bout, A.Bout + .15)) }, G.map.labels.DLA) },
    route: Object.assign({ p: kk(t, A.route0, A.route1) }, G.map.route),
    flows, rings: { G: { p: kk(t, A.ringG, A.ringG + .60) }, D: { p: kk(t, A.ringD, A.ringD + .60) } },
    cards: { G: w.G || null, D: w.D || null, look: CARD_LOOK, flight: cardU(t) },
    links: { G: { from: 'card', to: 'GZ', a: easeOut(kk(t, A.pinG, A.pinG + .3)) * (1 - kk(t, A.Bout, A.Bout + .1)) }, D: { from: 'card', to: 'DLA', a: easeOut(kk(t, A.pinD, A.pinD + .3)) * (1 - kk(t, A.Bout, A.Bout + .1)) } },
    block: Object.assign({ line1: { t0: A.txt1, a: easeOut(kk(t, A.txt1, A.txt1 + .15)), dy: 24 * (1 - easeOut(kk(t, A.txt1, A.txt1 + .15))) },
      line2: { t0: A.txt2, a: easeOut(kk(t, A.txt2, A.txt2 + .15)), dy: 24 * (1 - easeOut(kk(t, A.txt2, A.txt2 + .15))) },
      underline: { word: 'Un autre', p: kk(t, A.ul2, A.ul2 + .30), color: 'orange' }, out: 1 - kk(t, A.Bout, A.Bout + .15),
      lines: [[{ w: 'Un', color: 'white' }, { w: 'conteneur', color: 'white' }, { w: 'part.', color: 'amber' }], [{ w: 'Un', color: 'orange' }, { w: 'autre', color: 'orange' }, { w: 'arrive.', color: 'white' }]] }, G.map.block),
    geo: geoXY };
}
/** signature(t) (§3.10) → {bandOut, full, sub, whip, panel, plate, cta, pillG, freeze, ambOnly}; null before A.F */
function signature(t) {
  if (t < A.F) return null;
  const wp = kk(t, A.whip - .10, A.whip + .10);
  return { T0: A.T0, bandOut: kk(t, A.F, A.T0), full: foldP(t),
    sub: { t0: A.sigSub, t1: A.sigSubOut, box: G.sigSub, a: Math.min(easeOut(kk(t, A.sigSub, A.sigSub + .15)), 1 - kk(t, A.sigSubOut, A.sigSubOut + .12)) },
    whip: { t0: A.whip - .10, t1: A.whip + .10, p: wp, switchAt: A.whip, rgb: 6, trail: 120 },
    panel: Object.assign({ on: t >= A.whip, a: t >= A.whip ? 1 : 0, push: panelZoom(t), fix: PANEL.fix, src: PANEL.src, freezeAt: A.panel + 2.0 }, G.panel),
    background: { on: t >= A.whip, color: COL.night },
    plate: Object.assign({ t0: A.panel, p: kk(t, A.panel, A.panel + .25), drop: backOut(kk(t, A.panel, A.panel + .25), 2.2), a: t >= A.panel ? 1 : 0,
      line1: 'BONZINI TRADING CARGO', line2: 'Chine → Douala · bateau ou avion' }, G.plate),
    cta: Object.assign({ t0: A.pill, p: kk(t, A.pill, A.pill + .32), a: t >= A.pill ? 1 : 0, line1: CTA[0], line2: CTA[1] }, G.cta),
    freeze: t >= A.freeze, freezeAt: A.freeze, ambOnly: A.freeze };
}
/** progress(t) → the drawn parcel on the dashed line: {x, y (line), a, p} */
function progress(t) {
  const b = band(t), p = cl(t / T.end);
  return { p, x: G.parcel.x0 + (G.parcel.x1 - G.parcel.x0) * p, y: b.y0, a: b.a, w: G.parcel.w, h: G.parcel.h };
}
/** logo(t) → the Bonzini pill + « VRAIES IMAGES » (top right, always) */
const logo = t => Object.assign({ a: 1, text: 'VRAIES IMAGES' }, G.logo);

// =====================================================================================================================
// 9. SOUND (§3.11, §5.1 « Son », §5.2)
// =====================================================================================================================
function voices() {
  return RV_IDS.map(id => { const v = RV[id]; return { id, clip: v.clip, in: v.in, out: v.out, t: T[id], end: R6(T[id] + DUR[id]),
    speech: speech(id).map(R6), src: 'vocals', denoise: 0, fadeIn: .02, fadeOut: .02, gain: 0, text: v.text.replace('|', ' '),
    hp: 120, presence: { hz: 3000, db: 2.5 }, air: { src: 'accomp', g: -24 } }; });
}
/** the narrator lines as placed: {id, text, t (speech start), end, dur, budget, syl, sps, take} */
function narration() {
  return N_IDS.map(id => { const n = NARR[id], tk = TK[id]; return { id, text: n.text, t: T[id], end: R6(T[id] + DUR[id]), dur: DUR[id], budget: n.budget,
    syl: n.syl, sps: R6(n.syl / DUR[id]), file: tk ? tk.file : null, lead: tk ? tk.lead : 0, source: SRCW[id] }; });
}
/** ambience: the EDL's segments + gain keys (main window 0 dB, secondary −12 dB, 150 ms crossfades at the glides) */
function ambience() {
  return E.ambience().map(seg => {
    const s = E.byId[seg.shot], side = s.side, keys = [];
    if (side === 'G' || side === 'D') {
      const g = t => (mainSide(t) === side ? 0 : -12);
      let last = null;
      for (let t = seg.t0; t <= seg.t1 + 1e-9; t += .05) { const v = g(t); if (v !== last) { if (last !== null) keys.push([R6(t - .075), last]); keys.push([R6(t + .075), v]); last = v; } }
      if (!keys.length || keys[keys.length - 1][0] < seg.t1) keys.push([R6(seg.t1), last]);
    }
    return Object.assign(seg, { keys });
  });
}
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0, d, note) => { if (t >= 0 && t < T.end) { const c = { t: R6(t), name, g, pan }; if (d !== undefined) c.d = R6(d); if (note) c.note = note; Q.push(c); } };
  for (const k of BAND_KEYS) if (k.t > 0 && k.to !== 'hide' && !k.enter) q(k.t, 'whoosh', .55, 0, .35, `band glide → ${k.to}`);
  if (!CUT) {
    q(A.B, 'whoosh', .7, 0, .45, 'the windows fly into cards');
    q(A.pinG, 'pop', .6, .4, undefined, 'pin Guangzhou'); q(A.pinD, 'pop', .6, -.4, undefined, 'pin Douala');
    q(A.route0, 'felt', .5, 0, A.route1 - A.route0, 'the route is drawn');
    for (let k = 0; k < 5; k++) { q(A.flow0 + .8 * k, 'tick', .4, .3, undefined, `parcel ${k + 1} leaves`); if (A.flow0 + .8 * k + 2.4 < A.Bout + .05) q(A.flow0 + .8 * k + 2.4, 'ping', .35, -.3, undefined, `parcel ${k + 1} arrives`); }
    q(A.ul2, 'felt', .45, 0, .30, 'underline « Un autre »');
    q(A.Bout, 'whoosh', .65, 0, .45, 'cards fly back to the windows');
    q(A.ulC, 'felt', .45, 0, .30, 'underline « UNE AUTRE »');
    q(A.merci, 'balafon_note', .6, 0, undefined, 'MERCI: one warm balafon note');
    q(A.merciFly, 'whoosh', .3, -.3, .40, 'MERCI flies into the subtitle');
  }
  q(A.depose, 'stamp', .85, -.1, undefined, 'DÉPOSÉ (medium)');
  q(A.recu, 'stamp_low', .9, .1, undefined, 'REÇU (lower)');
  q(A.fort, 'stamp_big', 1, 0, undefined, 'C’EST FORT ! (the biggest)');
  q(A.whip - .10, 'whip', .8, 0, .20, 'filé');
  q(A.panel, 'tonk', .8, 0, undefined, 'the violet plate lands');
  q(A.panel, 'bonzini_sig', .85, 0, undefined, 'balafon signature');
  q(A.pill, 'pop', .6, 0, undefined, 'the amber pill');
  return Q.sort((a, b) => a.t - b.t);
}
const BPM = 100, BEAT = 60 / BPM, BAR = 4 * BEAT, GRID0 = 0;
const B = k => R6(GRID0 + k * BEAT);
function music() {
  const sec = [];
  if (!CUT) {
    sec.push({ t0: 0, t1: A.B, level: 'lite', db: -18, prog: 'major', shaker: true, note: 'groove after the opening hit' });
    sec.push({ t0: A.B, t1: A.C, level: 'lite', db: -20, lowpass: 900, prog: 'major', note: 'map: filtered makossa + soft wind pad −30 dB', pad: { name: 'wind', db: -30 } });
    sec.push({ t0: A.C, t1: A.musicCut, level: 'bass', db: -18, duckUnderVoice: -26, prog: 'major', shaker: true });
  } else {
    sec.push({ t0: 0, t1: A.B, level: 'lite', db: -18, prog: 'major', shaker: true });
    sec.push({ t0: A.B, t1: A.musicCut, level: 'bass', db: -18, duckUnderVoice: -26, prog: 'major', shaker: true });
  }
  sec.push({ t0: A.major, t1: A.freeze, level: 'full', db: -16, duckUnderVoice: -22, prog: 'major', shaker: true, congas: true, balafon: true, note: 'back in major after the balafon signature' });
  return { bpm: BPM, beat: BEAT, grid0: GRID0, prog: 'major', sections: sec, hits: [0], stops: [[A.musicCut, A.major]], end: A.freeze,
    duck: { voice: 12, amb: 9 }, ambOnly: [A.freeze, T.end], note: 'coupée net 0,2 s avant DÉPOSÉ, absente jusqu’à la plaque (§3.11)' };
}

// =====================================================================================================================
// 10. SELF-CHECK
// =====================================================================================================================
function check() {
  const Wn = NOTES.slice();
  for (const id of N_IDS) {
    const n = NARR[id], sps = n.syl / DUR[id];
    if (DUR[id] > n.budget + 1e-6) Wn.push(`${id}: take ${DUR[id].toFixed(2)} s > window ${n.budget.toFixed(2)} s (SERIE budget)`);
    if (sps > 3.2 + 1e-6) Wn.push(`${id}: ${sps.toFixed(2)} syl/s > 3,2`);
  }
  const sp = [...voices().map(v => [v.speech[0], v.speech[1], v.id]), ...narration().map(n => [n.t, n.end, n.id])].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1] - 1e-6) Wn.push(`voices overlap: ${sp[i - 1][2]} (→ ${sp[i - 1][1].toFixed(2)}) / ${sp[i][2]} (${sp[i][0].toFixed(2)} →)`);
  if (!CUT) {
    if (END('N2') > A.B - .1) Wn.push('N2 runs into the map (6,10)');
    if (END('N3b') > A.Bout + .05) Wn.push('N3b runs past the cards’ return (10,40)');
    if (END('N4') > W('RV1A', 'nous') - .3) Wn.push('N4 too close to RV1A');
  }
  if (END(NC) > T[NC2] - .35 + 1e-6) Wn.push('pause N5a → N5b < ,35 s');
  return Wn;
}
const QA = { minHold: 1.4, notBlocks: ['mention', 'logo', 'pill', 'maplabel'], masks: ['v1', 'v2', 'v3'],
  /** rects drawn opaque by the modules at t (the band, the map, the signature background): the hole check skips them */
  covered: t => { const r = [], b = band(t); if (b.a > .5) r.push({ x: 0, y: b.y0 - 2, w: SW, h: BAND_H + 4 }); if (map(t) && map(t).bg > .5) r.push({ x: 0, y: 0, w: SW, h: SH });
    if (t >= A.whip) r.push({ x: 0, y: 0, w: SW, h: SH }); return r; } };

const SCORE = { FPS, N, T, A, DUR, W, WE, WS, END, SYL, VOICES: Object.fromEntries(RV_IDS.map(id => [id, Object.assign({ id }, RV[id])])), RV, NARR, N_IDS, RV_IDS,
  WORDS, SRCW, wordsOf, speech, BPM, BEAT, BAR, B, G, COL, VARIANT, CUT, CLIPS, HIDE, MUST_HIDE, HP, BAKE, LAYERS: [], QA,
  shots: E.shots, byId: E.byId, active: E.active, need: E.need, needs: E.needs, frameSet: E.frameSet, overlays: E.overlays, shutter: E.shutter,
  CUTS: E.CUTS, cropAt: E.cropAt, project, ambience, audit: E.audit,
  band, windows, winRect, qOf, dark, pills, texts, subtitles, stamps, merci, map, signature, progress, logo, screenFx, foldP, cardU, mainSide,
  TEXTS, voices, narration, soundCues, music, check, BAND_KEYS, DARK_KEYS, FOCUS, PANEL, CARD, KEYCOL, geoXY,
  kk, ease, easeOut, easeIn, backOut, backS, bump, lerp, cl, EASE };
if (!isNode) window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
