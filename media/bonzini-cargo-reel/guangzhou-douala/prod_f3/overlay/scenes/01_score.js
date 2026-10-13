'use strict';
// =============================================================================================
// FILM 3 « LA VOITURE SORT… ET LES TÉLÉPHONES AUSSI ! » (20,20 s, 606 images) — THE SCORE. One source of truth for picture
// AND sound. Spec: rush2/SERIE.md §3 (the DUPLEX system, PLEIN mode: Douala only, the band laid on the image), §3.7 (REC),
// §3.10 (signature, T0 = 10,85), §4 (RV5, RV4), §5.3 (film 3). The module contract (what 20_duplex.js reads) is MODULES.md
// (copied from prod_f1, unchanged); the film's own effects (the plunge into the phone, the band sucked in, the REC tags, the
// red/blue split) are 30_film3.js, which reads the states exported here (plunge, rec, PHONE_QUADS, suck render switch).
//
// VARIANTS  main  = « Une voiture à faire venir de Chine ? » / « Écris VOITURE ↓ » (42 / 84 px) + NDa, NDb
//           wa    = « Réponds VOITURE ↓ » (72 px) + NDa, NDw                      (WhatsApp status)
//           colis = « Tes colis sont en Chine ? » / « Écris COLIS ↓ » + N5a, N5b   (if the boss refuses the car call, §7.6)
//           node: BZ_VARIANT=wa · browser: window.VARIANT (render.mjs --variant wa). Same picture up to the pill (14,85).
// TIMING    Real voice (RV5, RV4) never stretched, cut in measured silences, words from rush2/voice/real_words.json; the
//           stamps hit the stressed syllable (WS). Narrator lines at their SERIE windows, durations = rush2/voice/takes.json
//           as played. The call: line 1 at the pill + ,15 (colis + ,45), line 2 ENDS at T.end − ,65 = 19,55 (SERIE window
//           18,25–19,55), so the film keeps its 20,20 s (606 frames) in every variant; the last ,30 s = ambience only.
// GEOMETRY  PLEIN (§3.3): every Douala shot fills the screen, its focal point F (source px) on Q = (540, 960) at scale s;
//           the band-route lies on the image at HAUT (1110–1300) or MILIEU (865–1055), nothing is darkened.
// HIDES     data/hides.json (tools/mkhide.py → tools/build_hides.py): gaussian blurs BAKED into the prepared frames by
//           tools/prep_clips.py (kind 'gauss'), audited as must-hide regions: the Toyota emblem (v7 r 3,70–9,80) and the
//           three shoulder stripes of the « BOGARD 22 » jersey (r 3,27–8,10 and r 17,10–18,10). Per-hide margin / feather.
// Loaded by node (module.exports; reads data/*.json and ../voice/*.json itself) and by the page (window.SCORE). Pure in t;
// no Math.random, no Date, no ctx.filter.
// =============================================================================================
(function () {
const isNode = typeof window === 'undefined';
const EDL = isNode ? require('./00_edl.js') : window.EDL;
const FPS = 30, SW = 1080, SH = 1920;
const readJSON = (...rel) => { const fs = require('fs'), p = require('path'); const f = p.join(__dirname, '..', '..', ...rel);
  if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`01_score.js: cannot parse ${f}: ${e.message}`); return null; } };
let TM, CLIPS, HIDES, TAKES, RWORDS, NWORDS, VARIANT;
if (isNode) {
  TM = readJSON('data', 'timing.json'); CLIPS = readJSON('data', 'clips.json'); HIDES = readJSON('data', 'hides.json');
  TAKES = readJSON('..', 'voice', 'takes.json'); RWORDS = readJSON('..', 'voice', 'real_words.json'); NWORDS = readJSON('..', 'voice', 'words.json');
  VARIANT = typeof process !== 'undefined' && process.env.BZ_VARIANT;
} else {
  TM = window.TIMING || null; CLIPS = window.CLIPS || null; HIDES = window.HIDES || null; TAKES = window.TAKES || null;
  RWORDS = window.REAL_WORDS || null; NWORDS = window.NARR_WORDS || null; VARIANT = window.VARIANT;
}
VARIANT = ['main', 'wa', 'colis'].includes(VARIANT) ? VARIANT : 'main';
const COLIS = VARIANT === 'colis';
if (!CLIPS) throw new Error('01_score.js: data/clips.json missing — run python3 tools/prep_clips.py --index');
const { kk, EASE, cl, lerp, R6 } = EDL;
const ease = EASE.inOut, easeOut = EASE.out, easeIn = EASE.in;
const backOut = (x, s = 1.70158) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;
const NOTES = [];
const NB = ' ';                                             // no-break space (French: before : ? !)

// =====================================================================================================================
// 0. HAND-KEYED TRACKS (work/f3_tracks.json, made by work/key_quads.py + tools/track_box.py, checked on sheets)
//    rec1: the phone of P1 (v7 r 17,00–18,70) · rec2: the single pink-case phone of P6 (v7 r 24,60–28,07): [[s, [x, y, w, h]]]
//    quads: the 4 corners (TL TR BR BL) of the P1 phone's front face, keyed by hand on EVERY frame r 18,40–18,70
// =====================================================================================================================
const TRACKS = {"rec1":[[17.0,[169.8,535.2,100.0,140.0]],[17.1,[145.0,531.8,100.0,140.0]],[17.2,[126.1,524.3,100.0,140.0]],[17.3,[111.0,518.2,100.0,140.0]],[17.4,[97.1,515.0,100.0,140.0]],[17.5,[86.8,512.2,100.0,140.0]],[17.6,[79.7,511.1,100.0,140.0]],[17.7,[76.3,510.8,100.0,140.0]],[17.8,[72.0,510.9,100.0,140.0]],[17.9,[67.7,511.2,100.0,140.0]],[18.0,[65.4,510.2,100.0,140.0]],[18.1,[69.4,509.2,100.0,140.0]],[18.2,[81.6,513.1,100.0,140.0]],[18.3,[98.6,521.0,100.0,140.0]],[18.4,[120.5,525.8,103.8,144.2]],[18.4333,[131.8,527.7,101.6,144.1]],[18.4667,[141.3,530.0,101.1,143.1]],[18.5,[150.6,531.7,101.5,142.5]],[18.5333,[162.7,533.0,99.7,142.4]],[18.5667,[174.5,534.6,98.8,142.1]],[18.6,[186.1,536.6,98.7,141.4]],[18.6333,[198.4,538.6,98.4,140.8]],[18.6667,[211.1,540.6,98.2,140.2]],[18.7,[223.3,542.9,99.0,139.1]]],"rec2":[[24.6,[115.4,764.8,68.0,132.0]],[24.7,[115.5,761.4,68.0,132.0]],[24.8,[119.0,758.0,68.0,132.0]],[24.9,[122.3,753.2,68.0,132.0]],[25.0,[127.0,748.0,68.0,132.0]],[25.1,[131.9,743.1,68.0,132.0]],[25.2,[135.0,740.8,68.0,132.0]],[25.3,[136.0,737.9,68.0,132.0]],[25.4,[138.1,734.0,68.0,132.0]],[25.5,[140.4,728.8,68.0,132.0]],[25.6,[140.7,726.1,68.0,132.0]],[25.7,[143.0,722.1,68.0,132.0]],[25.8,[150.1,711.8,68.0,132.0]],[25.9,[148.5,702.4,68.0,132.0]],[26.0,[140.7,699.1,68.0,132.0]],[26.1,[133.6,694.1,68.0,132.0]],[26.2,[131.5,686.0,68.0,132.0]],[26.3,[127.7,679.1,68.0,132.0]],[26.4,[120.8,675.0,68.0,132.0]],[26.5,[115.7,672.2,68.0,132.0]],[26.6,[110.4,670.0,68.0,132.0]],[26.7,[106.0,668.9,68.0,132.0]],[26.8,[99.9,668.4,68.0,132.0]],[26.9,[93.4,665.1,68.0,132.0]],[27.0,[88.9,661.0,68.0,132.0]],[27.1,[87.5,658.5,68.0,132.0]],[27.2,[87.6,657.3,68.0,132.0]],[27.3,[88.0,657.3,68.0,132.0]],[27.4,[94.3,656.2,68.0,132.0]],[27.5,[109.3,651.9,68.0,132.0]],[27.6,[126.6,649.1,68.0,132.0]],[27.7,[143.5,646.9,68.0,132.0]],[27.8,[160.1,644.1,68.0,132.0]],[27.9,[175.8,642.0,68.0,132.0]],[28.0,[189.0,640.2,68.0,132.0]],[28.0667,[198.4,639.7,68.0,132.0]]],"quads":{"18.4000":[[153.96,525.77],[224.31,544.38],[190.88,669.95],[120.53,651.34]],"18.4333":[[164.49,527.73],[233.39,546.74],[200.66,671.8],[131.76,652.79]],"18.4667":[[173.85,530.0],[242.47,549.25],[209.94,673.1],[141.33,653.84]],"18.5000":[[183.43,531.71],[252.05,550.43],[219.2,674.26],[150.58,655.53]],"18.5333":[[193.86,533.03],[262.36,551.54],[231.19,675.44],[162.69,656.93]],"18.5667":[[204.65,534.57],[273.29,552.95],[243.18,676.63],[174.54,658.25]],"18.6000":[[216.12,536.58],[284.85,554.43],[254.86,677.95],[186.14,660.11]],"18.6333":[[228.24,538.56],[296.85,556.04],[267.04,679.36],[198.43,661.88]],"18.6667":[[240.6,540.64],[309.31,557.82],[279.84,680.81],[211.13,663.63]],"18.7000":[[252.58,542.94],[322.27,560.24],[292.97,682.09],[223.29,664.79]]}};

// =====================================================================================================================
// 1. VOICES
// =====================================================================================================================
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nrm = s => deacc(s).replace(/[^a-z0-9]/g, '');
const RV = {
  RV5: { clip: 'v1', in: 87.95, out: 88.75, end: .63, text: 'C’est fort' + NB + '!',
    words: [['C’est', 1, .15], ['fort', 1, .29]] },
  RV4: { clip: 'v2', in: 18.80, out: 22.665, end: 3.77,   // out 22,665: a faint bystander voice starts there (voice/real_words.json)
    text: 'Bonzini Trading,|faites-nous confiance.',
    words: [['Voilà', 2, .44], ['c’est', 1, .72], ['fort', 1, .88], ['Bonzini', 3, 1.32], ['Trading', 2], ['faites-nous', 2, 2.67], ['confiance', 3]] },
};
const RV_IDS = ['RV5', 'RV4'];
function markWords(v) {
  const n = v.words.length, out = v.words.map(w => ({ w: w[0], syl: w[1], s: w[2], e: w[3] }));
  const anchors = []; out.forEach((w, i) => { if (w.s !== undefined) anchors.push(i); });
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k], b = k + 1 < anchors.length ? anchors[k + 1] : n;
    let ta = out[a].s, tb = b < n ? out[b].s : v.end;
    const run = out.slice(a, b), endFixed = run.findIndex(w => w.e !== undefined);
    if (endFixed >= 0 && endFixed < run.length - 1) tb = run[endFixed].e;
    if (run.length === 1 && run[0].e !== undefined) tb = run[0].e;
    const tot = run.reduce((m, w) => m + w.syl, 0); let t = ta;
    for (const w of run) { w.s = R6(t); t += (tb - ta) * w.syl / tot; if (w.e === undefined) w.e = R6(t - .02); }
  }
  out[n - 1].e = Math.max(out[n - 1].e, v.end);
  return out.map(w => ({ w: w.w, s: w.s, e: w.e, src: 'marks' }));
}
function realWords(id, v) {
  if (!RWORDS) return null;
  const pool = RWORDS.segments || RWORDS.voices || RWORDS, key = Object.keys(pool).find(k => nrm(k) === nrm(id));
  const e = key ? pool[key] : null; if (!e) return null;
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
  if (rw) {
    let j = 0;
    WORDS[id] = fb.map(w => { const k = nrm(w.w); for (let q = j; q < Math.min(rw.length, j + 4); q++) { const r = nrm(rw[q].w); if (r && (r.startsWith(k.slice(0, 4)) || k.startsWith(r))) { j = q + 1; return { w: w.w, s: rw[q].s, e: rw[q].e, syl: rw[q].syl, vowel: rw[q].vowel, src: 'aligned' }; } } return w; });
    SRCW[id] = 'real_words.json';
  } else { WORDS[id] = fb; SRCW[id] = 'SERIE §4 marks'; }
}
// ---------- the narrator (§5.3 windows = budgets; durations from rush2/voice/takes.json) ----------
const NARR = {
  NA: { text: 'Ils filment quoi' + NB + '?', syl: 4, budget: 1.30 },
  NB: { text: 'Une voiture sort du conteneur' + NB + '!', syl: 9, budget: 2.85 },
  NC: { text: 'Et les téléphones sortent aussi' + NB + '!', syl: 9, budget: 2.85 },
  NDa: { text: 'Une voiture à faire venir' + NB + '?', syl: 9, budget: 2.85 },
  NDb: { text: 'Écris' + NB + ': voiture.', syl: 4, budget: 1.45 },       // window 18,10–19,55 (SERIE 18,25: the slower take)
  NDw: { text: 'Réponds' + NB + ': voiture.', syl: 4, budget: 1.45 },
  N5a: { text: 'Tes colis sont en Chine' + NB + '?', syl: 6, budget: 2.70 },
  N5b: { text: 'Écris' + NB + ': colis.', syl: 4, budget: 1.40 },
};
const CALL = VARIANT === 'colis' ? ['N5a', 'N5b'] : VARIANT === 'wa' ? ['NDa', 'NDw'] : ['NDa', 'NDb'];
const N_IDS = ['NA', 'NB', 'NC', ...CALL];
function parseTakes(J) {
  const out = {}; if (!J) return out;
  let ent = J.takes || J.lines || J.voices || J;
  if (Array.isArray(ent)) { const o = {}; for (const e of ent) if (e && (e.id || e.line)) o[e.id || e.line] = e; ent = o; }
  for (const k in ent) {
    let e = ent[k]; if (!e || typeof e !== 'object' || !NARR[k]) continue;
    if (Array.isArray(e.takes)) { const c = e.chosen ?? e.pick ?? e.best ?? 0; e = Object.assign({}, e, typeof c === 'number' ? e.takes[c] : e.takes.find(q => q.id === c || q.file === c) || {}); }
    const dur = +(e.dur ?? e.duration ?? e.played); if (!(dur > 0)) continue;
    const lead = +(e.on ?? e.lead ?? 0) || 0;
    const wsrc = Array.isArray(e.words) ? e.words : (NWORDS && Array.isArray(NWORDS[k]) ? NWORDS[k] : null);
    const words = wsrc ? wsrc.map(w => ({ w: w.w || w.word, s: R6(+(w.s ?? w.start) - lead), e: R6(+(w.e ?? w.end) - lead) })).filter(w => w.w && isFinite(w.s)) : [];
    out[k] = { dur: R6(dur), words, lead, file: e.file || null, wavDur: +(e.wav_dur || 0) || null, syl: +(e.syl || 0) || null, stretch: +(e.stretch || 1), sps: e.rate ?? null };
  }
  return out;
}
// film 3: NDb / NDw re-stretched from their source takes (×1,10 / ×1,08, Rubber Band crisp, prod_f3/voice_f3/, tools: see
// voice_f3/takes_f3.json): measured on the ENERGY (span within −30 dB of the line's peak) the shared takes read 3,48 / 3,39 syl/s
const TAKE_F3 = {"NDb":{"file":"../prod_f3/voice_f3/NDb.wav","dur":1.383,"syl":4,"on":0.03,"stretch":1.1,"wav_dur":1.443,"words":[{"w":"Écris :","s":0.03,"e":0.541},{"w":"voiture.","s":0.769,"e":1.432}],"sps30":3.2},"NDw":{"file":"../prod_f3/voice_f3/NDw.wav","dur":1.394,"syl":4,"on":0.03,"stretch":1.08,"wav_dur":1.454,"words":[{"w":"Réponds :","s":0.03,"e":0.538},{"w":"voiture.","s":0.797,"e":1.422}],"sps30":3.15}};
const TK = parseTakes(TAKES ? Object.assign({}, TAKES, TAKE_F3) : TAKES);
const sylOf = id => (TK[id] && TK[id].syl) || NARR[id].syl;
for (const id in NARR) { const tk = TK[id]; DUR[id] = tk ? tk.dur : NARR[id].budget; WORDS[id] = tk && tk.words.length ? tk.words : []; SRCW[id] = tk ? 'takes.json' : 'budget (no take yet)'; }
NOTES.push(TAKES ? `narrator takes: ${Object.keys(TK).join(' ')} (rush2/voice/takes.json)` : 'narrator: no rush2/voice/takes.json yet — durations = SERIE budgets');
NOTES.push(RWORDS ? 'real voice: word times from rush2/voice/real_words.json' : 'real voice: word times from the SERIE §4 marks');
const T = {};
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; let c = 0;
  const ks = String(prefix).split('|').map(nrm).filter(Boolean);
  for (const w of ws) { const f = nrm(w.w); if (ks.some(k => f.startsWith(k))) { if (c++ === nth) return w; } }
  return null;
}
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
/** the STRESSED syllable of that word: the stamps hit « FORT » on its accent */
function WS(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); if (!w) return T[id] + fb; const s = w.syl && w.syl.length ? w.syl[w.syl.length - 1] : (w.vowel !== null && w.vowel !== undefined ? w.vowel : w.s); return T[id] + s; }
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + (NARR[id] ? DUR[id] : (WORDS[id] && WORDS[id].length ? WORDS[id][WORDS[id].length - 1].e : DUR[id]));
const SYL = (id, k) => DUR[id] * k / sylOf(id);
const speech = id => NARR[id] ? [T[id], T[id] + DUR[id]] : [T[id] + WORDS[id][0].s, T[id] + WORDS[id][WORDS[id].length - 1].e];
const wordsOf = id => (WORDS[id] || []).map(w => ({ w: w.w, s: T[id] + w.s, e: T[id] + w.e }));

// =====================================================================================================================
// 2. ANCHORS (§5.3)
// =====================================================================================================================
const A = {};
A.cover = 0;
T.NA = .23;                                         // « Ils filment quoi ? » 0,23–1,49 (review: off the REC beep at 0,15, which
                                                    // masked « Ils »; still ends before the plunge 1,70)
A.rec1 = .15;                                       // the REC on P1's phone clicks (beep), shown from the cover on
A.plunge = 1.70;                                    // P1 frozen r 18,70: the plunge into the phone's screen
A.suck1 = A.plunge + .20;                           // 1,90 the band and its text are sucked into the screen
A.P2 = 2.00;                                        // P2 (v7 r 3,40) full screen; the band re-enters at HAUT 2,00–2,30
A.txtB = A.P2 + .05;                                // 2,05 « UNE VOITURE / SORT DU CONTENEUR ! »
T.NB = 2.10;                                        // « Une voiture sort du conteneur ! » 2,10–4,65
A.P3 = 3.00;                                        // P3 r 4,40 → 8,40 at ×2 (4-frame ramps)
A.P4 = 5.00;                                        // P4 r 8,40 → 9,80 real speed: the guide raises his hand
A.pulseRoll = 6.10; A.pulseCut = 6.20;              // the pulse rolls, then stops (0,08 s of silence before the voice)
T.RV5 = 6.29;                                       // « C'est fort ! » (v1 87,95 → 88,75)
A.txtBEnd = T.RV5 - .12;                            // the phrase leaves as the real-voice card comes in (no double)
A.P5 = 6.40;                                        // P5 freeze v7 r 9,80 (the guide from behind, hand raised)
A.fort1 = WS('RV5', 'fort', 0, .29);                // 6,54 C'EST FORT ! (140 px, −4°) on « FORT »
A.fort1End = Math.max(A.fort1 + 1.42, 8.00);        // held 1,46 s, over the start of P6 (§3.6)
A.P6 = 7.85;                                        // P6 v7 r 24,60 → 28,05; the band glides HAUT → MILIEU 7,85–8,20
A.rec2 = A.P6 + .10;                                // 7,95 REC on the pink-case phone
T.NC = A.P6 + .17;                                  // « Et les téléphones sortent aussi ! » 8,02–10,56 (review: off the REC beep at
                                                    // 7,95 and further from the 7,85 music hit; ends before the band phrase 10,73)
A.txtC = A.P6 + .05;                                // 7,90 (SERIE) — the type is drawn in 20_duplex's crisp pass: sharp on the glide
A.musicIn = A.P6;                                   // the makossa groove comes in (−18)
A.T0 = 10.85;                                       // signature (§3.10): RV4, the band leaves 10,85–11,20
T.RV4 = A.T0;
A.F = A.T0;
A.P6F = A.P6 + (28.05 - 24.60);                     // 11,30 P6 has reached r 28,05: freeze (push ×1,00 → 1,05)
A.fort2 = WS('RV4', 'fort', 0, .88);                // 11,71 C'EST FORT ! (170 px, −3°)
A.musicCut = A.fort2 - .20;                         // the makossa stops dead 0,2 s before the stamp
A.sigSub = A.T0 + 1.25;                             // 12,10 → 14,80 « Bonzini Trading, / faites-nous confiance. »
A.sigSubOut = A.T0 + 4.00 - .12;                   // 14,73: its fade ENDS as the pill starts (14,85) — no cross-fade of two texts in one place
A.rec2End = A.sigSub - .15;                         // review: the REC's fade ENDS (12,07) before the subtitle box fades in (12,10):
                                                    // for 3 frames « ● REC » sat on « vraie voix · l’équipe » and its corners on « Bonzini Trading »
A.whip = A.T0 + 2.40;                               // filé 13,15–13,35 (switch at 13,25)
A.panel = A.T0 + 2.50;                              // 13,35 the real Bonzini panel + violet plate + balafon
A.major = A.T0 + 3.10;                              // 13,95 the makossa back, in major
A.pill = A.T0 + 4.00;                               // 14,85 the amber pill
T.end = 20.20;                                      // 606 frames (SERIE)
A.freeze = T.end - .30;                             // 19,90 everything holds, the ambience alone
const [C1, C2] = CALL;
T[C1] = A.pill + (COLIS ? .45 : .20);               // 15,05 (review: ≥ 0,35 s after RV4's last word 14,695, §3.11; colis 15,30: at 15,15
                                                    // the weak listener fused RV4's « faites » with « Tes »
                                                    // colis… and dropped RV5 + RV4 on the mix; 15,25 / 15,30 / 15,35 all heard)
T[C2] = T.end - .65 - DUR[C2];                      // ends at 19,55
for (const k in T) T[k] = R6(T[k]); for (const k in A) A[k] = R6(A[k]);
const N = Math.round(T.end * FPS);

// =====================================================================================================================
// 3. THE BAND-ROUTE (§3.2): HAUT from the cover, sucked into the phone (1,70–1,90), back at HAUT (2,00), MILIEU (7,85),
//    out by the bottom (10,85). The suck itself is drawn by 30_film3.js from a frozen render of the band (ONLY_BAND).
// =====================================================================================================================
const BAND_H = 190, POS = { H: 1110, M: 865, B: 590 }, GLIDE = .35, OVER = 16;
function backS(ratio) { let a = 0, b = 10; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (4 * m * m * m / (27 * (m + 1) * (m + 1)) < ratio) a = m; else b = m; } return (a + b) / 2; }
const BAND_KEYS = [{ t: 0, to: 'H' }, { t: A.plunge, to: 'suck', dur: A.suck1 - A.plunge }, { t: A.P2, to: 'H', enter: true }, { t: A.P6, to: 'M' }, { t: A.T0, to: 'off', dur: .30 }];
let ONLY_BAND = false;                              // 30_film3.js renders the band alone (the suck) with DX_draw
function band(t) {
  if (ONLY_BAND) return { pos: 'H', y0: POS.H, y1: POS.H + BAND_H, a: 1, glide: null };
  let i = 0; while (i < BAND_KEYS.length - 1 && t >= BAND_KEYS[i + 1].t) i++;
  const k = BAND_KEYS[i], prev = i > 0 ? BAND_KEYS[i - 1] : null;
  if (i === 0) return { pos: k.to, y0: POS[k.to], y1: POS[k.to] + BAND_H, a: 1, glide: null };
  const d = k.dur || GLIDE, x = kk(t, k.t, k.t + d);
  if (k.to === 'suck') return { pos: 'H', y0: POS.H, y1: POS.H + BAND_H, a: 0, glide: null, suck: { p: x, t0: k.t, t1: k.t + d } };
  if (k.enter) {                                    // back at HAUT: rises 40 px + fades in
    const s = backS(OVER / 40), y = POS[k.to] + 40 * (1 - backOut(x, s));
    return { pos: k.to, y0: y, y1: y + BAND_H, a: easeOut(kk(t, k.t, k.t + .25)), glide: x < 1 ? { from: null, to: k.to, t0: k.t, t1: k.t + d, p: x } : null };
  }
  const fromPos = prev.to === 'suck' ? 'H' : prev.to;
  if (k.to === 'off') {                             // leaves by the bottom
    // review (f325 → f326 read as a pop + a dark veil): a 0,30-s EASE-IN drop (x²: 3 → 30 → 84 → 164 → 271 → 405 → 563 px…),
    // body at full alpha, fading only over the last 30 % and exactly 0 once out; the body is FRAME-LOCKED (G.band.lock), so
    // its smear is capped at 40 px — no low-alpha smear left over the guide's shirt
    const y0 = POS[fromPos], y1 = SH + 30, y = lerp(y0, y1, x * x);
    const fa = x >= 1 ? 0 : 1 - (u => u * u * (3 - 2 * u))(cl((x - .70) / .30));
    return { pos: x >= 1 ? null : fromPos, y0: y, y1: y + BAND_H, a: fa, glide: x < 1 ? { from: fromPos, to: 'off', t0: k.t, t1: k.t + d, p: x } : null };
  }
  const y0 = POS[fromPos], y1 = POS[k.to], s = backS(OVER / Math.abs(y1 - y0)), y = lerp(y0, y1, backOut(x, s));
  return { pos: x >= 1 ? k.to : (x < .5 ? fromPos : k.to), y0: y, y1: y + BAND_H, a: 1, glide: x < 1 ? { from: fromPos, to: k.to, t0: k.t, t1: k.t + d, p: x } : null };
}

// =====================================================================================================================
// 4. THE SCREEN PUSH + SHAKE OF THE STAMPS (§3.6: ×1,03 of the whole screen, 10 px shake damped over 6 frames)
// =====================================================================================================================
const STAMP_T = [A.fort1, A.fort2];
function screenFx(t) {
  if (ONLY_BAND) return { dx: 0, dy: 0, s: 1 };
  let dx = 0, dy = 0, s = 1;
  for (const ts of STAMP_T) {
    const d = t - ts; if (d < 0 || d > .4) continue;
    const amp = 10 * Math.exp(-d * 15);
    dx += amp * Math.sin(d * 2 * Math.PI * 14 + .4); dy += amp * .7 * Math.cos(d * 2 * Math.PI * 11 + 1.1);
    s *= 1 + .03 * bump(d, 0, .30);
  }
  return { dx, dy, s };
}
const camOf = layoutFn => t => { const f = screenFx(t); if (f.s === 1 && !f.dx && !f.dy) return null; const R = layoutFn(t);
  return { dx: f.dx + (R.x + R.w / 2 - SW / 2) * (f.s - 1), dy: f.dy + (R.y + R.h / 2 - SH / 2) * (f.s - 1), s: f.s }; };

// =====================================================================================================================
// 5. THE SHOTS (EDL) — §5.3. PLEIN: crop = a 9:16 window of width 1080 / (s · push) centred on F (source px)
// =====================================================================================================================
const GRADE = { vignette: .15 };
const BAKE = { gz: { exposure: -.10, contrast: .06 }, dla: { contrast: .08, sat: 1.05, warmth: .05 },
  // the real panel (v3, PN only) — series review 2 (film 1): black point +0,08, contrast +0,25, saturation ×1,1, −0,4 EV fading out
  // over the top 40 % of the panel rectangle (source y 25 → 120: the blown sky)
  panel: { exposure: -.10, contrast: .31, sat: 1.10, black: .08, sky: { y0: 25, y1: 120, ev: -.40 } },
  of: clip => (clip === 'v3' ? 'panel' : ['v1', 'v2'].includes(clip) ? 'gz' : 'dla') };
const FULL = { x: 0, y: 0, w: SW, h: SH };
const full = { kind: 'full', x: 0, y: 0, w: SW, h: SH };
const plein = (s, F, push = () => 1) => t => { const f = typeof F === 'function' ? F(t) : F, sc = typeof s === 'function' ? s(t) : s; return { cx: f.x, cy: f.y, w: SW / (sc * push(t)) }; };
const freezeAt = (t0, s0, tf) => ({ keys: [[t0, s0], [tf, s0 + (tf - t0)], [tf + 60, s0 + (tf - t0)]], interp: 'linear' });
/** P3: r 4,40 → 8,40 in 2,00 s — ×1 → ×V in 4 frames, ×V, ×V → ×1 in 4 frames (V = 2,07 so it lands on r 8,40) */
const RAMP = 4 / FPS, P3_IN = 4.40, P3_OUT = 8.40, P3_D = A.P4 - A.P3;
const P3_V = ((P3_OUT - P3_IN) - RAMP) / (P3_D - RAMP);       // area: 2·RAMP·(1+V)/2 + (D − 2·RAMP)·V = OUT − IN
function p3src(t) {
  const u = t - A.P3, D = P3_D, V = P3_V;
  if (u <= 0) return P3_IN + u;
  if (u < RAMP) return P3_IN + u + (V - 1) * u * u / (2 * RAMP);
  const sA = P3_IN + RAMP * (1 + V) / 2;
  if (u < D - RAMP) return sA + V * (u - RAMP);
  const sB = sA + V * (D - 2 * RAMP), w = u - (D - RAMP);
  if (u < D) return sB + V * w - (V - 1) * w * w / (2 * RAMP);
  return P3_OUT + (u - D);
}
// F.y 480 → 505 (SERIE 460): at 460 the guide's raised hand (P4–P5, source y ≈ 500) fell behind the band at HAUT; at 505 the hand and
// forearm stand above the band (screen y ≈ 945), the SUV stays whole between the chrome and the band
const FY45 = 505;
const s3 = t => lerp(2.30, 2.48, ease(kk(t, A.P3, A.P4))), f3 = t => ({ x: 235, y: lerp(480, FY45, ease(kk(t, A.P3, A.P4))) });
const FOCUS = {};
const SHOTS = [];
const shot = (o) => { const L = o.layout || full; SHOTS.push(Object.assign({ layout: L, cam: camOf(() => FULL), side: 'D', amb: false }, o)); };
// ---- 0,00–2,00 P1: the hand lifts a phone that films the SUV (REC on it); frozen r 18,70 for the plunge ----
shot({ id: 'P1', clip: 'v7', t0: 0, t1: A.P2, src: freezeAt(0, 17.00, A.plunge), crop: plein(2.50, { x: 246, y: 640 }), amb: { mode: 'hold', g: 0 } });
// ---- the image pinned into the phone's screen during the plunge (P2's first frame, r 3,40, held): drawn by 30_film3.js
//      through a homography; listed here (under P1) so the engine decodes it and the audits see it ----
shot({ id: 'P2pre', clip: 'v7', t0: A.plunge, t1: A.P2, src: { in: 3.40, speed: 0 }, crop: plein(2.30, { x: 235, y: 480 }), z: -1 });
// ---- 2,00–3,00 P2: the white SUV in the container's mouth starts to move ----
shot({ id: 'P2', clip: 'v7', t0: A.P2, t1: A.P3, src: { in: 3.40 }, crop: plein(2.30, { x: 235, y: 480 }), amb: { mode: 'hold', g: 0 } });
// ---- 3,00–5,00 P3: ×2 (ramps of 4 frames). Each film frame shows ONE source frame (the time map is sampled at the frame's
//      centre for all its motion-blur sub-samples): blending 2–3 source frames of a hand-held shot gave ghost doubles
//      (the pole, the headlight); a clean fast-forward reads better than a fake motion blur (no optical flow, §2.2) ----
shot({ id: 'P3', clip: 'v7', t0: A.P3, t1: A.P4, src: t => p3src(Math.round(t * FPS) / FPS), crop: plein(s3, f3) });
// ---- 5,00–6,40 P4: real speed, the guide lifts his hand ----
shot({ id: 'P4', clip: 'v7', t0: A.P4, t1: A.P5, src: { in: 8.40 }, crop: plein(t => lerp(2.48, 2.53, kk(t, A.P4, A.P5)), { x: 235, y: FY45 }), amb: { mode: 'hold', g: 0 } });
// ---- 6,40–7,85 P5: freeze r 9,80, slow push ×1,00 → 1,03 (+ the stamp's push and shake) ----
shot({ id: 'P5', clip: 'v7', t0: A.P5, t1: A.P6, src: { in: 9.80, speed: 0 }, crop: plein(2.53, { x: 235, y: FY45 }, t => 1 + .03 * ease(kk(t, A.P5, A.P6))),
  amb: { mode: 'hold', g: 0, in: 9.80 } });   // review: a crowd bed after « C’est fort ! » (no dead air over the freeze), see ambience()
// ---- 7,85–11,30 P6: the phones; then the freeze r 28,05 under the signature (push ×1,00 → 1,05) ----
shot({ id: 'P6', clip: 'v7', t0: A.P6, t1: A.P6F, src: { in: 24.60 }, crop: plein(1.875, { x: 288, y: 512 }), amb: { mode: 'hold', g: 0 } });
// integration: the freeze PUNCHES IN (0,30 s, ease) towards the raised phone: s 1,875 → 2,35, F (288, 512) → (346, 560), the crop
// right-aligned on the source (x 116–576), then the slow push ×1,00 → 1,04. At s 1,875 the frozen frame kept, for 1,95 s, the
// green-jersey man's face in profile at the left edge (source x 67–100, y 330–370): he now leaves the frame within the punch-in
// review: EASE-OUT over 0,45 s (was ease-in-out 0,30 s): the frame moves from the first frozen frame on (the profile was held
// 3 frames at zero velocity), peak speed 6,7 instead of 10 × the range per second, and the shutter is halved over it (shutter())
const P6F_IN = .45, P6F_U = t => easeOut(kk(t, A.P6F, A.P6F + P6F_IN));
shot({ id: 'P6F', clip: 'v7', t0: A.P6F, t1: A.whip, src: { in: 28.05, speed: 0 },
  crop: plein(t => lerp(1.875, 2.35, P6F_U(t)), t => ({ x: lerp(288, 346, P6F_U(t)), y: lerp(512, 560, P6F_U(t)) }), t => 1 + .04 * ease(kk(t, A.P6F + P6F_IN, A.whip))),
  amb: { mode: 'hold', g: 0, in: 25.10 } });           // the crowd goes on under the freeze (v7 ends at r 28,10): its own sound from r 25,10
for (const s of SHOTS) FOCUS[s.id] = { side: 'D', s: null, F: () => null };
// ---- the signature panel (§3.10): v3 r 0,40 → 2,40 then frozen, push ×1,04 about the title ----
const PANEL = { x: 24, y: 240, w: 1032, h: 527, r: 24, src: [0, 25, 464, 262], s: 2.224, F: { x: 232, y: 143.5 }, fix: { x: 250, y: 195 }, push: 1.04 };
const panelZoom = t => 1 + (PANEL.push - 1) * ease(kk(t, A.panel, T.end));
SHOTS.push({ id: 'PN', clip: 'v3', t0: A.whip, t1: T.end + 1 / FPS, layout: { kind: 'window', x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r, border: 0, shadow: .85 },
  src: { keys: [[A.whip, .40 - (A.panel - A.whip)], [A.panel + 2.00, 2.40], [T.end + 60, 2.40]], interp: 'linear' },
  crop: t => { const z = panelZoom(t), k0 = PANEL.s, k1 = k0 * z;
    return { cx: PANEL.fix.x - (PANEL.fix.x - PANEL.F.x) * k0 / k1, cy: PANEL.fix.y - (PANEL.fix.y - PANEL.F.y) * k0 / k1, w: PANEL.w / k1 }; },
  clamp: false, in: { type: 'whip', dir: 'right', dur: .20, smear: .111 }, amb: { mode: 'hold', g: 0, in: 2.40 }, side: 'P' });
FOCUS.PN = { side: 'P', s: PANEL.s, F: () => PANEL.F };
// ---------- what must never show, and the blurs (data/hides.json) ----------
const MUST_HIDE = {
  v3: [{ box: [45, 409, 390, 211], why: 'stickers' }, { box: [0, 283, 464, 120], why: 'line 6 « Foreign Exchange… », +86 numbers, QR codes' }],
  v7: [{ t0: 0, t1: .6, box: [440, 0, 136, 900], why: 'MAERSK star (container side)' }],
};
const HIDE = {};
const HP = (HIDES && HIDES.params) || { sigma: 18, feather: 8, margin: 10 };
if (HIDES && HIDES.hide) for (const clip in HIDES.hide) for (const h of HIDES.hide[clip]) {
  const o = { name: h.name, t0: h.t0, t1: h.t1, keys: h.keys, kind: 'gauss', shape: h.shape, why: h.why };
  // film 3 review: σ and keep_dark now reach prep_clips.py (the score dropped them: v7_toyota_a was baked at the default σ 18,
  // a flat grey disc on the jumping man's head, although work/h_v7_toyota_a.json asked σ 7)
  for (const k of ['margin', 'feather', 'sigma', 'sigma_keys', 'margin_keys', 'feather_keys', 'keep_dark']) if (h[k] !== undefined) o[k] = h[k];
  (HIDE[clip] = HIDE[clip] || []).push(o);
  (MUST_HIDE[clip] = MUST_HIDE[clip] || []).push({ t0: h.t0, t1: h.t1, keys: h.keys, why: h.why });
}
const E = EDL.build({ clips: CLIPS, shots: SHOTS, hide: HIDE, mustHide: MUST_HIDE, grade: GRADE, cuts: [], covered: t => QA.covered(t) });

// ---------- (kept for a shot flagged mblur — none now: P3 shows one source frame per film frame, see P3) the time filter:
//            every source frame a 360° shutter crosses, averaged (running-mean alphas) ----
function timeFilter(a, t) {
  const s = a.shot; if (!s.mblur) return a;
  const h = .5 / FPS, lo = s.srcAt(t - h), hi = s.srcAt(t + h), f0 = Math.round(Math.min(lo, hi) * FPS), f1 = Math.round(Math.max(lo, hi) * FPS);
  if (f1 <= f0) return a;
  const top = s.nf - 1, fr = [];
  for (let f = f0, k = 1; f <= f1; f++, k++) fr.push({ f: Math.min(top, Math.max(0, f)), a: 1 / k });
  return Object.assign({}, a, { frames: fr });
}
const active = t => E.active(t).map(a => timeFilter(a, t));
/** series review 2: 16 motion-blur sub-samples on the filé, the panel's entry and the plate's drop (copies showed as steps) */
const HEAVY = [[A.whip - .12, A.whip + .17], [A.panel - .01, A.panel + .28]];
/** review: the punch-in on the frozen r 28,05 frame smeared like a missed focus pull: HALF shutter (90°) over it */
const HALF = [[A.P6F - .5 / FPS, A.P6F + P6F_IN]];
const shutter = (n, mb) => { const t = n / FPS, ts = E.shutter(n, mb > 1 && HEAVY.some(([a_, b_]) => t >= a_ && t <= b_) ? Math.max(mb, 16) : mb);
  return HALF.some(([a_, b_]) => t >= a_ && t <= b_) ? ts.map(x => Math.max(A.P6F, t + (x - t) * .5)) : ts; };
const need = t => { const o = []; for (const a of active(t)) for (const q of a.frames) o.push({ clip: a.shot.clip, f: q.f }); return o; };
function frameSet(n_, mb = 6) { const o = {}; for (let n = 0; n < n_; n++) for (const t of shutter(n, mb)) for (const q of need(t)) (o[q.clip] = o[q.clip] || new Set()).add(q.f); return o; }

/** source px of an active shot → screen px (crop, rotation, region, transition motion) */
function project(a, x, y) {
  const c = a.crop, R = a.R, fx = a.fx, k = R.w / c.w * fx.sc, r = ((c.rot || 0) + (fx.rot || 0) + (R.tilt || 0)) * Math.PI / 180;
  const dx = (x - c.cx) * k, dy = (y - c.cy) * k;
  return [R.x + R.w / 2 + fx.dx + dx * Math.cos(r) - dy * Math.sin(r), R.y + R.h / 2 + fx.dy + dx * Math.sin(r) + dy * Math.cos(r)];
}

// =====================================================================================================================
// 6. GEOMETRY, COLOURS, TEXTS
// =====================================================================================================================
const COL = { violet: '#A947FE', violetD: '#7B22D6', amber: '#F3A745', orange: '#FE560D', night: '#10142B', ink: '#231629',
  white: '#FFFFFF', grey: '#B9B3C2', kraft: '#C79E6C', kraftLine: '#E9D7B5' };
const CTA_SZ = VARIANT === 'colis' ? [48, 88] : VARIANT === 'wa' ? [42, 72] : [42, 84];
const G = {
  W: SW, H: SH, cx: SW / 2,
  safe: { top: 150, bottom: 1540, rightX: 960, rightY0: 900, rightY1: 1560 },
  band: { h: BAND_H, pos: POS, glide: GLIDE, overshoot: OVER, alpha: .92, dash: [14, 10], line: 4, textX: 64, textMaxX: 960, size: 64, lead: 72,
    lock: { cap: 40, frames: .3, parcel: true } },   // review: the glides (2,00 · 7,85) printed a comb of 6 sub-sample copies of the
    // dashed route / band edge over the guide's head for 4 frames: body, route and parcel drawn at the FRAME's time (film 4 review 4)
  sub: { headDy: 18, headSize: 36, size: 54, lead: 62, line1Dy: 104, line2Dy: 166, waveX0: 850, waveX1: 946, bars: 16 },   // header Satoshi 700 36 px (series review 2)
  pillG: { x: 60, y0: 170, y1: 230, size: 40, flag: [54, 36], r: 30 },
  pillD: { x: 60, dy: 18, h: 60, size: 40 },
  logo: { x0: 856, x1: 1020, y0: 164, y1: 228, textX1: 1020, textY0: 236, textY1: 270, textSize: 30 },
  mention: { x0: 856, x1: 1020, y0: 164, y1: 270 },
  stamp: { fort1: { size: 140, rot: -4, color: 'orange', cx: 540, cy: 470, lines: 2 }, fort2: { size: 170, rot: -3, color: 'orange', cx: 540, cy: 620, lines: 2 } },
  sigSub: { x0: 64, x1: 960, y0: 1040, y1: 1230, r: 20 },        // series review 2: panel, plate and call read as one block
  panel: { x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r },
  pillPanel: { x: 48, y0: 264, y1: 324 },
  plate: { x0: 90, x1: 930, y0: 800, y1: 1010, logoX0: 120, logoX1: 200, size1: 50, size2: 40, route: true },   // + the Chine → Douala route row
  cta: { x0: 90, x1: 930, y0: 1040, y1: 1270, size1: CTA_SZ[0], size2: CTA_SZ[1], arrowX0: 860, arrowX1: 920 },
  rec: { corner: 28, stroke: 6, margin: 10, font: 36, r: 20, blink: 2 },
  parcel: { w: 28, h: 22, x0: 64, x1: 1016 },
};
const sub = (id, voice, t0, t1, text, o = {}) => ({ id, voice, t0, t1, text, mode: o.mode || 'band', head: 'vraie voix · l’équipe Bonzini à Guangzhou' });
const KEYCOL = { fort: 'orange', bonzini: 'violet', trading: 'violet' };
const SUBS = [
  sub('sub5', 'RV5', T.RV5, A.P6 - .12, RV.RV5.text),            // gone before the band glides to MILIEU (no text on a moving band)
  sub('sub4', 'RV4', A.sigSub, A.sigSubOut, RV.RV4.text, { mode: 'box' }),
];
// band phrases (§3.2): `*word*` = emphasis in orange (ICI / the key word of the line), the rest white
const BANDTXT = [
  { id: 'bandA', t0: -1, t1: A.suck1, lines: ['ILS FILMENT *QUOI*' + NB + '?'], size: 72 },
  { id: 'bandB', t0: A.txtB, t1: A.txtBEnd, lines: ['UNE VOITURE', '*SORT* DU CONTENEUR' + NB + '!'], size: 64 },
  { id: 'bandC', t0: A.txtC, t1: A.T0 - .12, lines: ['…ET LES *TÉLÉPHONES*', 'SORTENT AUSSI' + NB + '!'], size: 64 },
];
const CTA = VARIANT === 'colis' ? ['Tes colis sont en Chine' + NB + '?', 'Écris *COLIS*']
  : VARIANT === 'wa' ? ['Une voiture à faire venir de Chine' + NB + '?', 'Réponds *VOITURE*'] : ['Une voiture à faire venir de Chine' + NB + '?', 'Écris *VOITURE*'];
const BANDBOX = { x0: 64, x1: 960, y0: POS.M, y1: POS.H + BAND_H };
const TEXTS = () => {
  const L = [];
  for (const b of BANDTXT) L.push([b.t0, b.t1 + .12, b.id, b.lines.join('|'), 'band', 'DX_draw', { box: BANDBOX }]);
  for (const s of SUBS) L.push([s.t0, s.t1, s.id, s.text, 'sub2', 'DX_draw', { voice: s.voice, box: s.mode === 'box' ? G.sigSub : BANDBOX,
    covers: s.voice === 'RV4' ? [W('RV4', 'bonzini'), speech('RV4')[1]] : null }]);   // « Voilà, c'est fort » (RV4) is said by the stamp
  L.push([A.fort1, A.fort1End + .12, 'fort1', 'C’EST|FORT' + NB + '!', 'stamp2', 'DX_draw', { box: { x0: 220, x1: 860, y0: 280, y1: 680 }, color: COL.orange }]);
  L.push([A.fort2, A.whip + .10, 'fort2', 'C’EST|FORT' + NB + '!', 'stamp2', 'DX_draw', { box: { x0: 170, x1: 910, y0: 440, y1: 800 }, color: COL.orange }]);
  L.push([A.panel, T.end + .01, 'plate', 'BONZINI TRADING CARGO|Chine → Douala · bateau ou avion', 'plate', 'DX_draw', { box: G.plate }]);
  L.push([A.pill, T.end + .01, 'cta', CTA.join('|'), 'cta2', 'DX_draw', { box: G.cta }]);
  L.push([-1, A.whip - .10, 'logo', 'VRAIES IMAGES', 'logo', 'DX_draw', { box: G.mention }]);
  L.push([A.whip - .10, T.end + .01, 'logo2', 'VRAIES IMAGES', 'logo', 'DX_draw', { box: { x0: 560, x1: 1020, y0: 164, y1: 270 } }]);   // the chip slides left of the logo
  for (const p of pillSpans()) L.push([p.t0, p.t1, p.id, p.text, 'pill', 'DX_draw', { box: p.box }]);
  L.push([-1, A.plunge + .07, 'rec1', '● REC', 'rec', 'F3_draw', { box: { x0: 60, x1: 560, y0: 520, y1: 1080 } }]);
  L.push([A.rec2, A.rec2End + .12, 'rec2', '● REC', 'rec', 'F3_draw', { box: { x0: 60, x1: 620, y0: 1060, y1: 1540 } }]);
  return L;
};
function pillSpans() {
  return [
    { id: 'pillD1', t0: -1, t1: A.whip - .10, text: 'ICI · DOUALA', box: { x0: 60, x1: 420, y0: 170, y1: 230 } },
    { id: 'pillG3', t0: A.panel, t1: T.end + .01, text: 'LÀ-BAS · GUANGZHOU', box: { x0: 48, x1: 548, y0: 214, y1: 274 } },
  ];
}

// =====================================================================================================================
// 7. MODULE STATES (MODULES.md) — every function is pure in t
// =====================================================================================================================
function windows(t) {
  const o = {};
  for (const a of active(t)) {
    const side = a.shot.side, R = a.R; if (!side || a.shot.id === 'P2pre') continue;
    o[side] = { side, rect: { x: R.x, y: R.y, w: R.w, h: R.h, tilt: R.tilt || 0, r: R.r || 0 }, shot: a.shot.id, clip: a.shot.clip, src: a.src,
      s: R.w / a.crop.w, F: { x: a.crop.cx, y: a.crop.cy }, fscreen: [R.x + R.w / 2, R.y + R.h / 2], dark: 0, Q: { x: R.x + R.w / 2, y: R.y + R.h / 2 },
      mode: side === 'P' ? 'panel' : 'full', card: null };
  }
  return o;
}
function pills(t) {
  const o = { G: null, D: null }; if (ONLY_BAND) return o;
  const inA = (t0, t1, fi = .2, fo = .15) => Math.min(t0 < 0 ? 1 : easeOut(kk(t, t0, t0 + fi)), 1 - kk(t, t1 - fo, t1));
  const ent = t0 => t0 < 0 ? 0 : 20 * (1 - easeOut(kk(t, t0, t0 + .2)));
  for (const p of pillSpans()) {
    if (t < p.t0 || t >= p.t1) continue;
    const a = inA(p.t0, p.t1); if (a <= 0) continue;
    if (p.id === 'pillG3') o.G = { x: G.pillPanel.x, y0: G.pillPanel.y0, y1: G.pillPanel.y1, a, dy: ent(p.t0), text: p.text, color: 'amber', flag: 'CN', textColor: COL.ink };
    else o.D = { x: G.pillD.x, y0: G.pillG.y0, y1: G.pillG.y1, a, dy: ent(p.t0), text: p.text, color: 'orange', flag: 'CM', textColor: COL.white };
  }
  return o;
}
function texts(t) {
  const b = band(t), out = [];
  for (const x of BANDTXT) {
    if (ONLY_BAND ? x.id !== 'bandA' : (t < x.t0 || t >= x.t1 + .12)) continue;
    const a = ONLY_BAND || x.t0 < 0 ? 1 : easeOut(kk(t, x.t0, x.t0 + .15)), ao = ONLY_BAND ? 1 : 1 - kk(t, x.t1, x.t1 + .12);
    const lines = x.lines.map(l => l.split(' ').map(w => ({ w: w.replace(/\*/g, ''),
      segs: w.split('*').map((q, i) => ({ s: q, color: i % 2 ? 'orange' : 'white' })).filter(q => q.s.length) })));
    const lead = G.band.lead, h = lead * lines.length, y0 = b.y0 + (BAND_H - h) / 2 + 4;
    out.push({ id: x.id, lines, size: x.size, lead, x: G.band.textX, maxX: G.band.textMaxX, y0, alpha: lines.map(() => 1), a: a * ao * b.a, dy: 24 * (1 - a), underline: null });
  }
  return out;
}
function subtitles(t) {
  if (ONLY_BAND) return null;
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
function stamps(t) {
  if (ONLY_BAND) return [];
  const o = [];
  if (t >= A.fort1 && t < A.fort1End + .12) {
    const S1 = G.stamp.fort1;
    o.push({ id: 'fort1', text: 'C’EST FORT' + NB + '!', lines: ['C’EST', 'FORT' + NB + '!'], size: S1.size, rot: S1.rot, color: 'orange', cx: S1.cx, cy: S1.cy,
      scale: 1, age: t - A.fort1, a: 1 - kk(t, A.fort1End, A.fort1End + .12), ride: 'P5' });
  }
  if (t >= A.fort2 && t < A.whip + .10) {                 // leaves with the image in the filé
    const S2 = G.stamp.fort2, p = E.active(t).find(a => a.shot.id === 'P6F');
    o.push({ id: 'fort2', text: 'C’EST FORT' + NB + '!', lines: ['C’EST', 'FORT' + NB + '!'], size: S2.size, rot: S2.rot, color: 'orange', cx: S2.cx + (p ? p.fx.dx : 0), cy: S2.cy,
      scale: 1, age: t - A.fort2, a: p ? cl(1 - p.fx.smear / 140) : 0, ride: 'P6F', smear: p ? p.fx.smear : 0 });
  }
  return o;
}
const merci = () => null, map = () => null;
function signature(t) {
  if (t < A.F || ONLY_BAND) return null;
  const wp = kk(t, A.whip - .10, A.whip + .10);
  return { T0: A.T0, bandOut: kk(t, A.F, A.F + GLIDE), full: 1,
    sub: { t0: A.sigSub, t1: A.sigSubOut, box: G.sigSub, a: Math.min(easeOut(kk(t, A.sigSub, A.sigSub + .15)), 1 - kk(t, A.sigSubOut, A.sigSubOut + .12)) },
    whip: { t0: A.whip - .10, t1: A.whip + .10, p: wp, switchAt: A.whip, rgb: 6, trail: 120 },
    panel: Object.assign({ on: t >= A.whip, a: t >= A.whip ? 1 : 0, push: panelZoom(t), fix: PANEL.fix, src: PANEL.src, freezeAt: A.panel + 2.0 }, G.panel),
    background: { on: t >= A.whip, color: COL.night },
    plate: Object.assign({ t0: A.panel, p: kk(t, A.panel, A.panel + .25), drop: backOut(kk(t, A.panel, A.panel + .25), 2.2), a: t >= A.panel ? 1 : 0,
      line1: 'BONZINI TRADING CARGO', line2: 'Chine → Douala · bateau ou avion' }, G.plate),
    cta: Object.assign({ t0: A.pill, p: kk(t, A.pill, A.pill + .32), a: t >= A.pill ? 1 : 0, line1: CTA[0], line2: CTA[1] }, G.cta),
    freeze: t >= A.freeze, freezeAt: A.freeze, ambOnly: A.freeze, route0: T[C1] };   // route0: the plate's parcel travels during the call
}
function progress(t) {
  const b = band(t), p = cl((ONLY_BAND ? A.plunge : t) / T.end);
  return { p, x: G.parcel.x0 + (G.parcel.x1 - G.parcel.x0) * p, y: b.y0, a: b.a, w: G.parcel.w, h: G.parcel.h };
}
// review: under the logo (y 233–273) the chip straddled the panel's top border (y 240) for the whole end card; during the panel
// it slides (in the filé, 13,15–13,35) to the LEFT of the logo on the top row (x ≈ 571–840, y 176–216), clear of the panel
// (left first, under the logo, then up: it never crosses the logo pill — a straight diagonal grazed it for 3 frames)
const CHIP_PANEL = { textX1: 830, textY0: 179, textY1: 213 };
const logo = t => { const ux = ease(kk(t, A.whip - .10, A.whip + .03)), uy = ease(kk(t, A.whip - .03, A.whip + .10));
  const L = Object.assign({ a: ONLY_BAND ? 0 : 1, text: 'VRAIES IMAGES' }, G.logo);
  if (ux > 0) L.textX1 = lerp(G.logo.textX1, CHIP_PANEL.textX1, ux);
  if (uy > 0) { L.textY0 = lerp(G.logo.textY0, CHIP_PANEL.textY0, uy); L.textY1 = lerp(G.logo.textY1, CHIP_PANEL.textY1, uy); }
  return L; };
/** 30_film3.js: render the band alone (bandA as it stood at the plunge) with the shared DX_draw */
const setOnlyBand = v => { ONLY_BAND = !!v; };

// ---------- the plunge (1,70–2,00) and the REC tags (§3.7): states read by 30_film3.js ----------
const QUADS = TRACKS ? Object.entries(TRACKS.quads).map(([s, q]) => ({ s: +s, q })).sort((a, b) => a.s - b.s) : [];
/** the phone screen's 4 corners (TL TR BR BL, source px) at source time s (r 18,40–18,70, keyed every frame) */
function phoneQuad(s) {
  if (!QUADS.length) return null;
  if (s <= QUADS[0].s) return QUADS[0].q; if (s >= QUADS[QUADS.length - 1].s) return QUADS[QUADS.length - 1].q;
  let i = 0; while (i < QUADS.length - 2 && s >= QUADS[i + 1].s) i++;
  const u = (s - QUADS[i].s) / (QUADS[i + 1].s - QUADS[i].s);
  return QUADS[i].q.map((p, k) => [lerp(p[0], QUADS[i + 1].q[k][0], u), lerp(p[1], QUADS[i + 1].q[k][1], u)]);
}
function plunge(t) {
  if (t < A.plunge || t >= A.P2) return null;
  const p = kk(t, A.plunge, A.P2);
  return { t0: A.plunge, t1: A.P2, p, quad: phoneQuad(18.70), from: 'P1', into: 'P2pre', suck: kk(t, A.plunge, A.suck1),
    swap: kk(t, A.plunge, A.plunge + .10), rgbFrames: [Math.round((A.plunge + .17) * FPS), Math.round((A.plunge + .20) * FPS)] };
}
/** a box track → per-frame boxes, gaussian-smoothed σ 2 frames (ends padded linearly): t → [x, y, w, h] at source time s */
function smoothTrack(keys, sigma = 2) {
  const f0 = Math.round(keys[0][0] * FPS), f1 = Math.round(keys[keys.length - 1][0] * FPS), raw = [];
  const at = s => { if (s <= keys[0][0]) return keys[0][1]; if (s >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
    let i = 0; while (i < keys.length - 2 && s >= keys[i + 1][0]) i++; const u = (s - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return keys[i][1].map((v, j) => lerp(v, keys[i + 1][1][j], u)); };
  for (let f = f0; f <= f1; f++) raw.push(at(f / FPS));
  const P = 3 * sigma, n = raw.length, pad = k => k < 0 ? raw[0].map((v, j) => v + (raw[0][j] - raw[Math.min(n - 1, 2)][j]) * (-k) / 2) : k >= n ? raw[n - 1].map((v, j) => v + (raw[n - 1][j] - raw[Math.max(0, n - 3)][j]) * (k - n + 1) / 2) : raw[k];
  const sm = raw.map((_, i) => { const acc = [0, 0, 0, 0]; let wsum = 0; for (let d = -P; d <= P; d++) { const w = Math.exp(-.5 * (d / sigma) * (d / sigma)), b = pad(i + d); for (let j = 0; j < 4; j++) acc[j] += w * b[j]; wsum += w; } return acc.map(v => v / wsum); });
  return s => { const q = cl(s * FPS - f0, 0, n - 1), i = Math.floor(q), u = q - i, b = sm[Math.min(n - 1, i + 1)]; return sm[i].map((v, j) => lerp(v, b[j], u)); };
}
const REC_TRACK = TRACKS ? { rec1: smoothTrack(TRACKS.rec1), rec2: smoothTrack(TRACKS.rec2) } : {};
/** rec(t) → [{id, shot, box (source px, smoothed), a, pop (0 → 1 over 4 frames: scale 1,15 → 1), dot (blink 2 Hz)}] */
function rec(t) {
  const o = [];
  if (ONLY_BAND || !TRACKS) return o;
  const blink = (t0) => (Math.floor((t - t0) * 2 * G.rec.blink) % 2 === 0) || t < t0;
  if (t < A.P2) {
    const a = 1 - kk(t, A.plunge, A.plunge + .07), sh = 'P1';   // integration: gone in 2 frames (its 6 sub-sample copies ghosted on the zoom)
    const s = Math.min(18.70, 17.00 + Math.max(0, t));
    if (a > 0) o.push({ id: 'rec1', shot: sh, box: REC_TRACK.rec1(s), a, pop: t < A.rec1 ? 1 : kk(t, A.rec1, A.rec1 + 4 / FPS), dot: blink(A.rec1), warp: t >= A.plunge });
  }
  if (t >= A.rec2 && t < A.rec2End + .12) {
    const s = Math.min(28.05, 24.60 + (t - A.P6));
    o.push({ id: 'rec2', shot: t < A.P6F ? 'P6' : 'P6F', box: REC_TRACK.rec2(s), a: 1 - kk(t, A.rec2End, A.rec2End + .12), pop: kk(t, A.rec2, A.rec2 + 4 / FPS), dot: blink(A.rec2) });
  }
  return o;
}

// =====================================================================================================================
// 8. SOUND (§3.11, §5.3 « son »)
// =====================================================================================================================
/** RV4 as in the series' signature (film 1, review 2): presence +4,5 dB at 3,2 kHz, the faint bystander voice before « Voilà »
 *  (source 18,80–19,20) at −15 dB — env = [[source s, dB]…], raised-cosine between keys (gain only: timing untouched) */
const RV_FX = { RV4: { presence: { hz: 3200, db: 4.5 }, air: { src: 'accomp', g: -24 }, env: [[18.80, -15], [19.19, -15], [19.21, 0]] } };
function voices() {
  return RV_IDS.map(id => { const v = RV[id]; return Object.assign({ id, clip: v.clip, in: v.in, out: v.out, t: T[id], end: R6(T[id] + DUR[id]),
    speech: speech(id).map(R6), src: 'vocals', denoise: 0, fadeIn: .02, fadeOut: .02, gain: 0, text: v.text.replace('|', ' '),
    hp: 120, presence: { hz: 3000, db: 2.5 }, air: { src: 'accomp', g: -24 } }, RV_FX[id] || {}); });
}
function narration() {
  return N_IDS.map(id => { const n = NARR[id], tk = TK[id]; return { id, text: n.text, t: T[id], end: R6(T[id] + DUR[id]), dur: DUR[id], budget: n.budget,
    syl: sylOf(id), sps: R6(sylOf(id) / DUR[id]), file: tk ? tk.file : null, lead: tk ? tk.lead : 0, wavDur: tk ? tk.wavDur : null, stretch: tk ? tk.stretch : 1,
    wav: tk ? R6(T[id] - tk.lead) : null, source: SRCW[id] }; });
}
/** each shot's own sound (SERIE levels, voice ≈ −14): the crowd −16; P1 through a « phone speaker » (band-pass
 *  300 Hz–3 kHz) from 1,55 to 1,85, then the full sound of P2 (§5.3); P3's own sound is cut (the engine replaces it);
 *  P5 is silent (the real voice brings its air); the panel's Guangzhou street −18 */
const AMB_LVL = { P1: -16, P2: -16, P4: -16, P5: -16, P6: -15, P6F: -17, PN: -18 };
function ambience() {
  return E.ambience().map(seg => {
    const o = Object.assign(seg, { keys: [], lvl: AMB_LVL[seg.shot] ?? -16, gz: seg.clip === 'v3' });
    if (seg.shot === 'P1') { o.filt = { type: 'phone', lo: 300, hi: 3000, keys: [[1.55, 0], [1.85, 1]] };
      o.keys = [[0, -4], [END('NA') + .05, -4], [END('NA') + .20, 0], [1.80, 0], [2.00, -12]]; }   // the brouhaha a step under « Ils filment quoi ? »
    if (seg.shot === 'P2') o.keys = [[2.00, -4], [2.12, 0]];
    if (seg.shot === 'P4') o.keys = [[A.pulseCut - .08, 0], [A.pulseCut, -60]];   // the crowd stops with the pulse: 0,08 s of silence, then RV5
    // review: P5 had no sound after RV5 (7,10–7,80 fell to −45 → −66 dBFS over a frozen picture: a stall): the crowd comes back
    // as « fort » ends — silent under the voice and the stamp, then up to its level before the phones (P6, 7,85)
    if (seg.shot === 'P5') o.keys = [[A.P5, -60], [END('RV5') - .06, -60], [END('RV5') + .14, -6], [A.P6, 0]];
    return o;
  });
}
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0, d, note) => { if (t >= 0 && t < T.end) { const c = { t: R6(t), name, g, pan }; if (d !== undefined) c.d = R6(d); if (note) c.note = note; Q.push(c); } };
  q(A.rec1, 'beep', .6, -.3, .06, 'REC on the phone (1 kHz, 60 ms)');
  q(A.plunge - .30, 'riser', .7, 0, A.P2 - A.plunge + .30, 'souffle montant into the phone');
  q(A.plunge, 'suck', .8, 0, A.suck1 - A.plunge + .06, 'the band is sucked into the screen (reverse whoosh)');
  q(A.P2, 'whoosh', .45, 0, GLIDE, 'band glide → H (enter)');
  q(A.P2, 'engine', .8, 0, A.P4 + .50 - A.P2, 'synthetic low engine: idle 2,00–3,00, revs with the ×2 (3,00–5,00), fades as the crowd returns (5,00–5,50)');
  for (const tc of [3.15, 3.75]) q(tc, 'creak', .5, -.2 + .3 * (tc - 3.15), .40, 'planks creak under the wheels (clear of « conteneur », 4,18)');
  q(A.fort1, 'stamp_big', .75, 0, undefined, 'C’EST FORT ! (1) — 2,5 dB under the signature’s: « fort » stays over it');
  q(A.P6, 'whoosh', .55, 0, GLIDE, 'band glide → M');
  q(A.rec2, 'beep', .6, -.3, .06, 'REC on the pink phone');
  q(A.T0, 'whoosh', .45, 0, GLIDE, 'band out');
  q(A.fort2, 'stamp_big', 1, 0, undefined, 'C’EST FORT ! (2, signature)');
  q(A.whip - .10, 'whip', .8, 0, .20, 'filé');
  q(A.panel, 'tonk', .8, 0, undefined, 'the violet plate lands');
  q(A.panel, 'bonzini_sig', .85, 0, undefined, 'balafon signature');
  q(A.pill, 'pop', .6, 0, undefined, 'the amber pill');
  return Q.sort((a, b) => a.t - b.t);
}
const BPM = 100, BEAT = 60 / BPM, BAR = 4 * BEAT, GRID0 = A.musicIn;
const B = k => R6(GRID0 + k * BEAT);
function music() {
  const sec = [
    { t0: A.musicIn, t1: A.musicCut, level: 'bass', db: -18, duckUnderVoice: -28, prog: 'major', shaker: true, grid0: A.musicIn, note: 'the groove comes in with the phones (7,85)' },
    { t0: A.major, t1: A.freeze, level: 'full', db: -16, duckUnderVoice: -26, prog: 'major', shaker: true, congas: true, balafon: true, grid0: A.major,
      // review: the groove re-enters at 13,95 under RV4 (« faites-nous confiance »), ducked to −40 under the voice while RV4 speaks
      // (lib/mix.py `duckOver`: [t0, t1, duckUnderVoice]; −32 left « confiance »'s decaying tail only 4,6 dB over the groove — the
      // acceptance is ≥ 10 dB in every 50-ms window 13,70–14,70); the re-entry ACCENT moved to the pill (hits below)
      duckOver: [[A.major - .05, speech('RV4')[1] + .10, -40]],
      // review: the button chord on « the last downbeat ≤ end − ,15 » fell at 18,75, in the colon pause « Écris : voiture »
      // (heard « écrite voiture »): it lands on the off-beat after the call's last word (19,55) — 13,95 + 9,5 beats = 19,65
      button: R6(A.major + 9.5 * BEAT),
      note: 'back in major after the balafon signature; button after the call, before the freeze' },
  ];
  // review: the re-entry hit at 13,95 sat 4 dB OVER RV4 (« -nous », −14,2 vs −18,2 dB): the hits are the phones' entry (7,85)
  // and the pill (14,85, after RV4 ends at 14,695)
  return { bpm: BPM, beat: BEAT, grid0: GRID0, prog: 'major', sections: sec, hits: [A.musicIn, A.pill], stops: [[A.musicCut, A.major]], end: A.freeze,
    duck: { voice: 12, amb: 9 }, ambOnly: [A.freeze, T.end],
    // integration 2: the ambience ducks 13 dB under every voice (lib/mix.py default 10): at 10 dB the weak listener dropped
    // RV5 + RV4 on 2 of 11 AAC round trips of the main mix (incl. the share file's 192 k) — 13 dB: 11/11 in every variant
    ambDuck: 13,
    // integration 2: limiter ceiling −2,0 dBTP (lib/mix.py default −1,3): the AAC overshoots up to ≈ 0,8 dB on the engine's
    // low saw (2,51 s); the delivered files must stay ≤ −1 dBTP too
    ceil: -2.0,
    pulse: { t0: .30, t1: A.pulseCut, db: -24, bpm: [[.30, 84], [A.P3, 84], [A.P4, 150], [A.pulseRoll, 150]], roll: [A.pulseRoll, A.pulseCut],
      note: 'pulsation grave −24 dB from 0,30, accelerates with the ×2, rolls at 6,10, stops at 6,20 (0,08 s of silence before RV5)' },
    note: 'no makossa before the phones; coupée net 0,2 s avant le 2e C’EST FORT ! ; reprise en majeur (§3.11)' };
}

// =====================================================================================================================
// 9. SELF-CHECK
// =====================================================================================================================
function check() {
  const Wn = NOTES.slice();
  for (const id of N_IDS) {
    const n = NARR[id], sps = sylOf(id) / DUR[id];
    if (!TK[id]) Wn.push(`${id}: no take in rush2/voice/takes.json (budget used)`);
    if (DUR[id] > n.budget + 1e-6) Wn.push(`${id}: take ${DUR[id].toFixed(2)} s > window ${n.budget.toFixed(2)} s (SERIE budget)`);
    if (sps > 3.2 + 1e-6) Wn.push(`${id}: ${sps.toFixed(2)} syl/s > 3,2`);
  }
  const sp = [...voices().map(v => [v.speech[0], v.speech[1], v.id]), ...narration().map(n => [n.t, n.end, n.id])].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1] - 1e-6) Wn.push(`voices overlap: ${sp[i - 1][2]} (→ ${sp[i - 1][1].toFixed(2)}) / ${sp[i][2]} (${sp[i][0].toFixed(2)} →)`);
  if (END('NA') > A.plunge + .05) Wn.push('NA runs into the plunge');
  if (END('NB') > T.RV5 - .3) Wn.push('NB too close to RV5');
  if (END('NC') > A.T0 + .3) Wn.push('NC runs into the signature');
  if (END(C1) > T[C2] - .35 + 1e-6) Wn.push(`pause ${C1} → ${C2} < ,35 s`);
  if (T[C2] < END(C1)) Wn.push(`${C2} before ${C1} ends`);
  return Wn;
}
const QA = { minHold: 1.4, notBlocks: ['mention', 'logo', 'pill'], masks: ['v3'],
  covered: t => { const r = [], b = band(t); if (b.a > .5) r.push({ x: 0, y: b.y0 - 2, w: SW, h: BAND_H + 4 }); if (t >= A.whip) r.push({ x: 0, y: 0, w: SW, h: SH }); return r; } };

/** the deliverables (tools/mux.sh NAME, tools/qa.js): out/VOITURE_TELEPHONES[_wa|_colis]_{share,whatsapp}.mp4 */
const OUT_NAME = 'VOITURE_TELEPHONES' + (VARIANT === 'main' ? '' : '_' + VARIANT);
const SCORE = { FPS, N, T, A, DUR, OUT_NAME, STAMP_T, W, WE, WS, END, SYL, VOICES: Object.fromEntries(RV_IDS.map(id => [id, Object.assign({ id }, RV[id])])), RV, NARR, N_IDS, RV_IDS,
  WORDS, SRCW, wordsOf, speech, BPM, BEAT, BAR, B, G, COL, VARIANT, CUT: false, CLIPS, HIDE, MUST_HIDE, HP, BAKE, LAYERS: [], QA,
  shots: E.shots, byId: E.byId, active, need, needs: E.needs, frameSet, overlays: E.overlays, shutter,
  CUTS: E.CUTS, cropAt: E.cropAt, project, ambience, audit: E.audit,
  band, windows, pills, texts, subtitles, stamps, merci, map, signature, progress, logo, screenFx, setOnlyBand, plunge, phoneQuad, rec, TRACKS,
  TEXTS, voices, narration, soundCues, music, check, BAND_KEYS, FOCUS, PANEL, KEYCOL, P3_V,
  kk, ease, easeOut, easeIn, backOut, backS, bump, lerp, cl, EASE };
if (!isNode) window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
