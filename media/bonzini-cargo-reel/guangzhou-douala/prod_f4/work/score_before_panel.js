'use strict';
// =============================================================================================
// « ELLE VA OÙ, CETTE MACHINE ? » (film 4 of the series, 24,65 s) — THE SCORE. One source of truth for picture AND sound.
// Spec: rush2/SERIE.md §3 (the DUPLEX system), §3.10 (signature), §4 (real voice RV4), §5.4 (film 4). The shared module
// contract (what 20_duplex.js reads) is MODULES.md; the film-specific graphics (5-stop progress line, numbered steps,
// the machine's light / trail / wind / light sweep, the felt check) live in 30_film4.js, which reads SCORE.F4.
//
// VARIANTS  main = « Écris MACHINE ↓ » (NEa + NEb) · wa = WhatsApp status « Réponds MACHINE ↓ » 72 px (NEa + NEw).
//           node: BZ_VARIANT=wa · browser: window.VARIANT (render.mjs --variant wa).
// MODE      Douala only, PLEIN (one full-screen window) with the band-route lying on the picture at BAS / HAUT; nothing is
//           ever darkened; the orange pill « ICI · DOUALA » stays at the top (y 170–230), §3.4.
// TIMING    Narrator lines at their SERIE windows (§5.4), durations = the chosen takes (rush2/voice/takes.json, as played;
//           T[id] = the take's first word). The signature is locked to the REAL VOICE RV4 (v2 18,80 → 22,665, never
//           stretched; word times rush2/voice/real_words.json): T0 = T.RV4 = 15,30, C'EST FORT ! on « FORT ».
//           T.NEb = max(22,70, END(NEa) + ,35) · A.freeze = max(24,35, END(NEb) + ,35) · T.end = A.freeze + ,30.
// GEOMETRY  §3.3 with Q = (540, 960) (PLEIN): each shot = a source layer at scale s whose focal point F (source px) sits
//           on the screen centre; Douala crops are bounded inside the source (done here: the EDL clamp never moves them).
// HIDES     data/hides.json (tools/mkhide.py → tools/build_hides.py): gaussian blurs BAKED by tools/prep_clips.py, audited
//           as must-hide regions; MUST_HIDE also lists what is proved OUT of frame (v38 « BOLOGNA », v3 line 6 / stickers).
// No Math.random, no Date, no ctx.filter; every state is a pure function of the film time t.
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
VARIANT = ['main', 'wa'].includes(VARIANT) ? VARIANT : 'main';
const WA = VARIANT === 'wa';
const CUT = false;                                  // (film 1's recut flag: never here)
if (!CLIPS) throw new Error('01_score.js: data/clips.json missing — run python3 tools/prep_clips.py --index');
const { kk, EASE, cl, lerp, R6 } = EDL;
const ease = EASE.inOut, easeOut = EASE.out, easeIn = EASE.in;
const backOut = (x, s = 1.70158) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;
const NOTES = [];

// =====================================================================================================================
// 1. VOICES
// =====================================================================================================================
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nrm = s => deacc(s).replace(/[^a-z0-9]/g, '');
// ---------- the real voice (§4): RV4 only (the signature). words: [token, syllables, start mark?, end mark?] ----------
const RV = {
  RV4: { clip: 'v2', in: 18.80, out: 22.665, end: 3.77,   // out 22,75 → 22,665: a faint bystander voice starts at 22,665 (voice/real_words.json)
    text: 'Bonzini Trading,|faites-nous confiance.',
    words: [['Voilà', 2, .44], ['c’est', 1, .72], ['fort', 1, .88], ['Bonzini', 3, 1.32], ['Trading', 2], ['faites-nous', 2, 2.67], ['confiance', 3]] },
};
const RV_IDS = ['RV4'];
function markWords(v) {
  const n = v.words.length, out = v.words.map(w => ({ w: w[0], syl: w[1], s: w[2], e: w[3] }));
  const anchors = []; out.forEach((w, i) => { if (w.s !== undefined) anchors.push(i); });
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k], b = k + 1 < anchors.length ? anchors[k + 1] : n;
    const ta = out[a].s, tb = b < n ? out[b].s : v.end, run = out.slice(a, b), tot = run.reduce((m, w) => m + w.syl, 0); let t = ta;
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
// ---------- the narrator (§5.4 windows = budgets; durations from rush2/voice/takes.json) ----------
const NARR = {
  H: { text: 'Elle va où, cette machine ?', syl: 7, budget: 2.20, win: .05 },
  S1: { text: 'Elle sort du conteneur.', syl: 6, budget: 1.95, win: 2.40 },
  S2: { text: 'La grue la soulève.', syl: 5, budget: 1.60, win: 4.75 },
  S3: { text: 'Elle passe au-dessus de la rue.', syl: 9, budget: 2.85, win: 6.90 },
  S4: { text: 'Elle arrive devant la boutique.', syl: 8, budget: 2.75, win: 10.15 },   // SERIE 10,15–12,75 → 12,90: re-stretched ×1,12 so that its
                                                                                    // AUDIBLE rate (energy, −30 dB) is 3,16 ≤ 3,2 (film 1 review 2 gate); S5 still 0,5 s after
  S5: { text: 'Et elle entre.', syl: 4, budget: 1.30, win: 13.40 },
  NEa: { text: 'Une machine à faire venir ?', syl: 9, budget: 2.85, win: 19.45 },
  NEb: { text: 'Écris : machine.', syl: 4, budget: 1.30, win: 22.70 },
  NEw: { text: 'Réponds : machine.', syl: 4, budget: 1.30, win: 22.70 },
};
const NC = 'NEa', NC2 = WA ? 'NEw' : 'NEb';
const N_IDS = ['H', 'S1', 'S2', 'S3', 'S4', 'S5', NC, NC2];
function parseTakes(J) {
  const out = {}; if (!J) return out;
  let ent = J.takes || J.lines || J.voices || J;
  if (Array.isArray(ent)) { const o = {}; for (const e of ent) if (e && (e.id || e.line)) o[e.id || e.line] = e; ent = o; }
  for (const k in ent) {
    let e = ent[k]; if (!e || typeof e !== 'object' || !NARR[k]) continue;
    if (Array.isArray(e.takes)) { const c = e.chosen ?? e.pick ?? e.best ?? 0; e = Object.assign({}, e, typeof c === 'number' ? e.takes[c] : e.takes.find(q => q.id === c || q.file === c) || {}); }
    const dur = +(e.dur ?? e.duration ?? e.speech_dur ?? e.played ?? e.len ?? e.seconds);
    if (!(dur > 0)) continue;
    const lead = +(e.on ?? e.lead ?? e.offset ?? 0) || 0;
    const wsrc = Array.isArray(e.words) ? e.words : (NWORDS && Array.isArray(NWORDS[k]) ? NWORDS[k] : null);
    const words = wsrc ? wsrc.map(w => ({ w: w.w || w.word, s: R6(+(w.s ?? w.start) - lead), e: R6(+(w.e ?? w.end) - lead) })).filter(w => w.w && isFinite(w.s)) : [];
    out[k] = { dur: R6(dur), words, lead, file: e.file || e.path || e.wav || null, wavDur: +(e.wav_dur || 0) || null, syl: +(e.syl || 0) || null,
      stretch: +(e.stretch || 1), sps: e.sps ?? e.rate ?? e.syl_per_s ?? null };
  }
  return out;
}
const TK = parseTakes(TAKES);
const sylOf = id => (TK[id] && TK[id].syl) || NARR[id].syl;
for (const id in NARR) { const tk = TK[id]; DUR[id] = tk ? tk.dur : NARR[id].budget; WORDS[id] = tk && tk.words.length ? tk.words : []; SRCW[id] = tk ? 'takes.json' : 'budget (no take yet)'; }
NOTES.push(TAKES ? `narrator takes: ${N_IDS.filter(k => TK[k]).join(' ') || 'none parsed'} (rush2/voice/takes.json)` : 'narrator: no rush2/voice/takes.json yet — durations = SERIE budgets');
NOTES.push(RWORDS ? 'real voice: word times from rush2/voice/real_words.json' : 'real voice: word times from the SERIE §4 marks');
const T = {};
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; let c = 0;
  const ks = String(prefix).split('|').map(nrm).filter(Boolean);
  for (const w of ws) { const f = nrm(w.w); if (ks.some(k => f.startsWith(k))) { if (c++ === nth) return w; } }
  return null;
}
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
function WS(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); if (!w) return T[id] + fb; const s = w.syl && w.syl.length ? w.syl[w.syl.length - 1] : (w.vowel !== null && w.vowel !== undefined ? w.vowel : w.s); return T[id] + s; }
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + (NARR[id] ? DUR[id] : (WORDS[id] && WORDS[id].length ? WORDS[id][WORDS[id].length - 1].e : DUR[id]));
const SYL = (id, k) => DUR[id] * k / sylOf(id);
const speech = id => NARR[id] ? [T[id], T[id] + DUR[id]] : [T[id] + WORDS[id][0].s, T[id] + WORDS[id][WORDS[id].length - 1].e];
const wordsOf = id => (WORDS[id] || []).map(w => ({ w: w.w, s: T[id] + w.s, e: T[id] + w.e }));

// =====================================================================================================================
// 2. ANCHORS (§5.4)
// =====================================================================================================================
const A = {};
A.cover = 0;
T.H = NARR.H.win;                                   // 0,05 « Elle va où, cette machine ? »
A.c2 = 1.25;                                        // M1 → M2 + the band BAS → HAUT. SERIE: 1,45 — the young man with the
                                                    // backpack (v38) turns his face to the camera from r 1,28 (profile at
                                                    // r 1,30, three-quarter from r 1,40): cut before. « machine » lands on M2.
T.S1 = NARR.S1.win; A.step1 = T.S1 - .20;           // 2,20 ① « ELLE SORT / DU CONTENEUR. » · S1 2,40
A.c3 = 4.38;                                        // M3a (v37: the machine hangs at the hook over the truck bed)
A.step2 = A.c3 + .07;                               // 4,45 ② « LA GRUE LA SOULÈVE. »
T.S2 = NARR.S2.win;                                 // 4,75
A.clonk = 4.90;                                     // the chain tightens, « clonk »
A.c3b = A.c3 + .95;                                 // 5,33 M3b (the machine alone, whole, « rising »)
A.c4 = 6.60;                                        // M4 (v38: it turns over the pavement) + the band HAUT → BAS
A.step3 = A.c4 + .10;                               // 6,70 ③ « ELLE PASSE / AU-DESSUS DE LA RUE. »
T.S3 = NARR.S3.win;                                 // 6,90
A.sweep0 = 8.00; A.sweep1 = 8.60;                   // the amber light sweep
A.c5 = 10.00;                                       // M5 (v39: in front of the shop) + BAS → HAUT; the makossa returns
A.step4 = A.c5 + .05;                               // 10,05 ④ « ELLE ARRIVE / DEVANT LA BOUTIQUE. »
T.S4 = NARR.S4.win;                                 // 10,15
A.c6 = 13.20;                                       // M6 (v40: pushed in through the door) + HAUT → BAS
A.step5 = A.c6 + .05;                               // 13,25 ⑤ « ET ELLE *ENTRE* ! »
A.check0 = A.c6 + .10; A.check1 = A.c6 + .40;       // 13,30–13,60 the orange felt check
T.S5 = NARR.S5.win;                                 // 13,40
A.thunk = 13.60;
T.RV4 = 15.30;                                      // T0 of the signature (§3.10)
A.T0 = T.RV4;
A.F = A.T0;                                         // 15,30–15,65 the band leaves by the bottom (already PLEIN)
A.fort = WS('RV4', 'fort', 0, .88);                 // 16,16 C'EST FORT ! on « FORT »
A.musicCut = A.fort - .20;                          // the makossa stops dead 0,2 s before the stamp (§3.11)
A.sigSub = A.T0 + 1.25;                             // 16,55 → 19,25 « Bonzini Trading, / faites-nous confiance. »
A.sigSubOut = A.T0 + 3.95;
A.whip = A.T0 + 2.40;                               // filé 17,60–17,80 (switch at 17,70)
A.panel = A.T0 + 2.50;                              // 17,80 the real Bonzini panel + violet plate + balafon
A.major = A.T0 + 3.10;                              // 18,40 the makossa back, in major
A.pill = A.T0 + 4.00;                               // 19,30 the amber pill
T[NC] = Math.max(NARR[NC].win, A.pill + .15);       // 19,45 « Une machine à faire venir ? »
T[NC2] = Math.max(NARR[NC2].win, END(NC) + .35);    // 22,70 « Écris : machine. » / « Réponds : machine. »
A.freeze = Math.max(24.35, END(NC2) + .35);         // everything holds, ambience only
T.end = A.freeze + .30;                             // 24,65 cut to image 0 (loop)
for (const k in T) T[k] = R6(T[k]); for (const k in A) A[k] = R6(A[k]);
const STEP_T = [A.step1, A.step2, A.step3, A.step4, A.step5];      // (an array: kept out of A, whose values are all numbers)
const N = Math.round(T.end * FPS);

// =====================================================================================================================
// 3. THE BAND-ROUTE (§3.2): top edge, glides .35 s ease-out-back with a 16 px overshoot
// =====================================================================================================================
const BAND_H = 190, POS = { H: 1110, M: 865, B: 590 }, GLIDE = .35, OVER = 16;
function backS(ratio) { let a = 0, b = 10; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (4 * m * m * m / (27 * (m + 1) * (m + 1)) < ratio) a = m; else b = m; } return (a + b) / 2; }
const BAND_KEYS = [{ t: 0, to: 'B' }, { t: A.c2, to: 'H' }, { t: A.c4, to: 'B' }, { t: A.c5, to: 'H' }, { t: A.c6, to: 'B' }, { t: A.F, to: 'off' }];
function band(t) {
  let i = 0; while (i < BAND_KEYS.length - 1 && t >= BAND_KEYS[i + 1].t) i++;
  const k = BAND_KEYS[i], prev = i > 0 ? BAND_KEYS[i - 1] : null, fromPos = prev ? prev.to : k.to;
  if (i === 0) return { pos: k.to, y0: POS[k.to], y1: POS[k.to] + BAND_H, a: 1, glide: null };
  const d = GLIDE, x = kk(t, k.t, k.t + d);
  if (k.to === 'off') {
    const y0 = POS[fromPos], y1 = SH + 30, s = backS(OVER / (y1 - y0)), y = lerp(y0, y1, backOut(x, s));
    return { pos: x >= 1 ? null : fromPos, y0: y, y1: y + BAND_H, a: x >= 1 ? 0 : 1, glide: x < 1 ? { from: fromPos, to: 'off', t0: k.t, t1: k.t + d, p: x } : null };
  }
  const y0 = POS[fromPos], y1 = POS[k.to], s = backS(OVER / Math.abs(y1 - y0)), y = lerp(y0, y1, backOut(x, s));
  return { pos: x >= 1 ? k.to : (x < .5 ? fromPos : k.to), y0: y, y1: y + BAND_H, a: 1, glide: x < 1 ? { from: fromPos, to: k.to, t0: k.t, t1: k.t + d, p: x } : null };
}
const foldP = () => 1;                               // (film 1's fold: always PLEIN here)
const DARK_KEYS = [];
const dark = () => 0;                                // nothing is ever darkened (§3.2 « En mode PLEIN… rien n'est assombri »)
const mainSide = t => (t >= A.whip ? 'P' : 'D');

// =====================================================================================================================
// 4. THE SCREEN PUSH + SHAKE OF THE STAMP (§3.6)
// =====================================================================================================================
const STAMP_T = [A.fort];
function screenFx(t) {
  let dx = 0, dy = 0, s = 1;
  for (const ts of STAMP_T) {
    const d = t - ts; if (d < 0 || d > .4) continue;
    const amp = 10 * Math.exp(-d * 15);
    dx += amp * Math.sin(d * 2 * Math.PI * 14 + .4); dy += amp * .7 * Math.cos(d * 2 * Math.PI * 11 + 1.1);
    s *= 1 + .03 * bump(d, 0, .30);
  }
  // the push is anchored on y 160 (not on the screen's centre): the top chrome (pill, logo) never climbs above y 150
  return { dx, dy: dy + (960 - 160) * (s - 1), s };
}
const camFull = t => { const f = screenFx(t); if (f.s === 1 && !f.dx && !f.dy) return null; return { dx: f.dx, dy: f.dy, s: f.s }; };

// =====================================================================================================================
// 5. THE SHOTS (EDL) — PLEIN: crop = (s, F) bounded inside the source
// =====================================================================================================================
const GRADE = { vignette: .15 };
const BAKE = { gz: { exposure: -.10, contrast: .06 }, dla: { contrast: .08, sat: 1.05, warmth: .05 }, of: clip => (GZ[clip] ? 'gz' : 'dla') };
const GZ = { v1: true, v2: true, v3: true };
/** linear keys [[t, v]…] → value at t (held outside) */
const lin = keys => t => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return lerp(va, vb, ease(kk(t, a, b))); } return keys[keys.length - 1][1]; };
const FOCUS = {};
/** a PLEIN shot: scale s(t), focal point F(t) on (540, 960); the crop is bounded inside the source (no EDL clamp) */
function full(id, clip, t0, t1, src, sF, FF, o = {}) {
  const D = CLIPS[clip], sf = typeof sF === 'function' ? sF : () => sF, Ff = typeof FF === 'function' ? FF : () => FF;
  const fpos = t => { const s = sf(t), F = Ff(t), w = SW / s, h = SH / s; return { s, x: cl(F.x, w / 2, D.w - w / 2), y: cl(F.y, h / 2, D.h - h / 2), w }; };
  FOCUS[id] = { side: 'D', s: sf, F: t => { const q = fpos(t); return { x: q.x, y: q.y }; } };
  return Object.assign({ id, clip, t0, t1, src, layout: 'full', clamp: false, side: 'D', cam: camFull,
    crop: t => { const q = fpos(t); return { cx: q.x, cy: q.y, w: q.w }; }, amb: { mode: 'hold', g: 0 } }, o);
}
const SHOTS = [
  // M1 · the cover: over the shoulders of two spectators (from the back), the green machine up in the air at the crane.
  //      SERIE s 2,204 F (288, 435,5) → s 2,25, F.x 330: the machine whole (it reached x 568 at r 1,2) and « BOLOGNA »
  //      (y ≥ 869) out of the frame (crop y 0–853) — the band BAS lies on the sky and the crane arm
  full('M1', 'v38', 0, A.c2, { in: 0 }, t => 2.25 + .05 * ease(kk(t, 0, A.c2)), { x: 330, y: 0 }),
  // M2 · the worker pulls the machine out of the open container (its red and blue blades at the door). SERIE s 1,875 →
  //      2,20 → 2,32 (slow push): at 1,875 the worker was 85 px tall on a 360-px phone; F.y 495 keeps the machine above
  //      the band HAUT (its blades end at y 1110). In r 14,12 so that it ends on the clip's last frame (r 17,25).
  full('M2', 'v36', A.c2, A.c3, { in: 17.25 - (A.c3 - A.c2) }, t => 2.20 + .12 * ease(kk(t, A.c2, A.c3)), { x: 330, y: 495 }),
  // M3a · the machine hangs at the hook over the truck bed, the worker holds it (s 1,5 = the whole 720 × 1280 frame)
  full('M3a', 'v37', A.c3, A.c3b, { in: 0 }, 1.5, { x: 360, y: 640 }),
  // M3b · the machine alone, whole: SERIE r 4,40 → 5,67 F (360, 600 → 560) cut its right end until r 5,3 (green extent
  //      x 284–719 at r 5,0): r 5,20 → 6,47; F.y 600 → 640 (the machine RISES on screen, its bottom stays above the band)
  full('M3b', 'v37', A.c3b, A.c4, { in: 5.20 }, t => lerp(1.65, 1.73, ease(kk(t, A.c3b, A.c4))), t => ({ x: lerp(392, 400, kk(t, A.c3b, A.c4)), y: lerp(600, 640, ease(kk(t, A.c3b, A.c4))) })),
  // M4 · contre-plongée: it turns over the pavement, the kiosk at left, the worker's hands at right (real speed). SERIE
  //      r 5,50 → 8,90 s 1,875 → r 6,00 → 9,40, s 2,00 → 2,06: until r 5,9 the red-and-white jersey of a spectator runs
  //      down the left edge (and a head at the bottom left, r 5,6–5,8); the A-frame clears the band BAS (590–780)
  full('M4', 'v38', A.c4, A.c5, { in: 6.00 }, t => 2.00 + .06 * ease(kk(t, A.c4, A.c5)), { x: 306, y: 480 }),
  // M5 · under the crane arm the machine arrives in front of the shop; the man in the striped polo (from the back) walks
  //      to it, the man in the tie-dye polo signals the crane operator (s 1,70, F (318, 715): source x 0–635)
  full('M5', 'v39', A.c5, A.c6, { in: 0.40 }, 1.70, { x: 318, y: 715 }),
  // M6 + M7 · from inside: two men push the hanging machine through the door, the yellow crane truck in the street; live
  //      to the filé (no frozen person): r 1,50 → 6,00
  full('M6', 'v40', A.c6, A.whip, { in: 1.50 }, 1.875, { x: 288, y: 512 }),
];
// ---- the signature panel (§3.10, identical in the 4 films) ----
const PANEL = { x: 24, y: 240, w: 1032, h: 527, r: 24, src: [0, 25, 464, 262], s: 2.224, F: { x: 232, y: 143.5 }, fix: { x: 250, y: 195 }, push: 1.04 };
const panelZoom = t => 1 + (PANEL.push - 1) * ease(kk(t, A.panel, T.end));
SHOTS.push({ id: 'PN', clip: 'v3', t0: A.whip, t1: T.end + 1 / FPS, layout: { kind: 'window', x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r, border: 0, shadow: .85 },
  src: { keys: [[A.whip, .40 - (A.panel - A.whip)], [A.panel + 2.00, 2.40], [T.end + 60, 2.40]], interp: 'linear' },
  crop: t => { const z = panelZoom(t), k0 = PANEL.s, k1 = k0 * z;
    return { cx: PANEL.fix.x - (PANEL.fix.x - PANEL.F.x) * k0 / k1, cy: PANEL.fix.y - (PANEL.fix.y - PANEL.F.y) * k0 / k1, w: PANEL.w / k1 }; },
  clamp: false, in: { type: 'whip', dir: 'right', dur: .20, smear: .111 }, amb: { mode: 'hold', g: 0, in: 2.40 }, side: 'P',
  // the panel against the night: deeper, contrasted and a little saturated (a « milky » sign was film 1's review note)
  grade: { exposure: -.16, contrast: .34, sat: 1.25, vignette: .26 } });
FOCUS.PN = { side: 'P', s: () => PANEL.s, F: () => PANEL.F };
// ---------- what must never show, and the blurs (data/hides.json) ----------
const MUST_HIDE = {
  v3: [{ box: [45, 409, 390, 211], why: 'stickers' }, { box: [0, 283, 464, 120], why: 'line 6 « Foreign Exchange… », +86 numbers, QR codes' }],
  // the « BOLOGNA » lettering on the striped jersey (v38 r 0–1,47, measured on extracted frames): below the crop of M1
  v38: [{ t0: 0, t1: 1.5, keys: [[0, [295, 888, 60, 36]], [.40, [284, 880, 62, 32]], [.80, [272, 880, 66, 32]], [1.20, [259, 872, 66, 32]], [1.47, [228, 862, 62, 36]]], why: '« BOLOGNA » (jersey print)' }],
};
const HIDE = {};
const HP = (HIDES && HIDES.params) || { sigma: 18, feather: 8, margin: 10 };
if (HIDES && HIDES.hide) for (const clip in HIDES.hide) for (const h of HIDES.hide[clip]) {
  (HIDE[clip] = HIDE[clip] || []).push({ name: h.name, t0: h.t0, t1: h.t1, keys: h.keys, kind: 'gauss', shape: h.shape, why: h.why });
  (MUST_HIDE[clip] = MUST_HIDE[clip] || []).push({ t0: h.t0, t1: h.t1, keys: h.keys, why: h.why });
}
const E = EDL.build({ clips: CLIPS, shots: SHOTS, hide: HIDE, mustHide: MUST_HIDE, grade: GRADE, cuts: [], covered: t => QA.covered(t) });
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
const G = {
  W: SW, H: SH, cx: SW / 2,
  safe: { top: 150, bottom: 1540, rightX: 960, rightY0: 900, rightY1: 1560 },
  band: { h: BAND_H, pos: POS, glide: GLIDE, overshoot: OVER, alpha: .92, dash: [14, 10], line: 4, textX: 64, textMaxX: 960, size: 60, lead: 72 },
  sub: { headDy: 18, headSize: 36, size: 54, lead: 62, line1Dy: 104, line2Dy: 166, waveX0: 850, waveX1: 946, bars: 16 },   // = film 1 review 2 (shared signature)
  pillG: { x: 60, y0: 170, y1: 230, size: 40, flag: [54, 36], r: 30 },
  pillD: { x: 60, dy: 18, h: 60, size: 40 },
  logo: { x0: 856, x1: 1020, y0: 164, y1: 228, textX1: 1020, textY0: 236, textY1: 270, textSize: 30 },
  mention: { x0: 856, x1: 1020, y0: 164, y1: 270 },
  stamp: { fort: { size: 170, rot: -3, color: 'orange', cx: 540, cy: 620, lines: 2 } },
  sigSub: { x0: 64, x1: 960, y0: 1040, y1: 1230, r: 20 },        // = film 1 review 2: panel, plate and call read as one block
  panel: { x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.h, r: PANEL.r },
  pillPanel: { x: 48, y0: 264, y1: 324 },
  plate: { x0: 90, x1: 930, y0: 800, y1: 1010, logoX0: 120, logoX1: 200, size1: 50, size2: 40, route: true },   // = film 1 review 2 (+ the Chine → Douala route row)
  // §5.4: line 1 at 42 px (736 px measured; 46 px overflowed the pill), « Écris MACHINE » 84 px · wa « Réponds MACHINE » 72 px
  cta: { x0: 90, x1: 930, y0: 1040, y1: 1270, size1: 42, size2: WA ? 72 : 84, arrowX0: 860, arrowX1: 920 },
  parcel: { w: 28, h: 22, x0: 64, x1: 1016 },
  // film 4: the 5 stops on the dashed line (§5.4), the numbered discs, the step texts
  stops: { x: [120, 300, 480, 660, 840], d: 18, hop: .25, hopH: 34, startX: 40 },
  step: { disc: 56, discX: 64, num: 40, textX: 136, size: 60, lead: 72, hSize: 64 },
};
const NB = ' ';
const KEYCOL = { bonzini: 'violet', trading: 'violet' };
const SUBS = [{ id: 'sub4', voice: 'RV4', t0: A.sigSub, t1: A.sigSubOut, text: RV.RV4.text, mode: 'box', head: 'vraie voix · l’équipe Bonzini à Guangzhou' }];
// ---------- the band phrases of film 4 (drawn by 30_film4.js: crisp, frame-locked on the band) ----------
const STEPS = [
  { id: 'bandH', k: 0, t0: -1, t1: A.step1, lines: ['ELLE VA *OÙ*,', 'CETTE MACHINE' + NB + '?'], size: G.step.hSize, x: 64 },
  { id: 'step1', k: 1, t0: A.step1, t1: A.step2, lines: ['ELLE SORT', 'DU CONTENEUR.'] },          // 2 lines: 843 px on one (x 136 → 979 > 960)
  { id: 'step2', k: 2, t0: A.step2, t1: A.step3, lines: ['LA GRUE LA SOULÈVE.'] },
  { id: 'step3', k: 3, t0: A.step3, t1: A.step4, lines: ['ELLE PASSE', 'AU-DESSUS DE LA RUE.'] },
  { id: 'step4', k: 4, t0: A.step4, t1: A.step5, lines: ['ELLE ARRIVE', 'DEVANT LA BOUTIQUE.'] },
  { id: 'step5', k: 5, t0: A.step5, t1: A.F, lines: ['ET ELLE *ENTRE*' + NB + '!'], check: { t0: A.check0, t1: A.check1 } },
].map(s => Object.assign({ size: G.step.size, x: G.step.textX }, s));
// each phrase is gone BEFORE the next one appears (no double exposure): it fades over the last ,10 s before the next
// step — or before the band's glide when the next step lands inside that glide (6,60 / 10,00 / 13,20): the old phrase
// never rides a glide out (the question does ride the 1,25 glide: step 1 comes 0,95 s later)
for (const s of STEPS) { const g = BAND_KEYS.find(k => k.t > s.t1 - .35 && k.t <= s.t1 + 1e-6 && k.to !== 'off'); s.out1 = g ? g.t : s.t1; s.out0 = s.out1 - .10; }
const CTA = WA ? ['Une machine à faire venir de Chine' + NB + '?', 'Réponds *MACHINE*'] : ['Une machine à faire venir de Chine' + NB + '?', 'Écris *MACHINE*'];
const BANDBOX = { x0: 64, x1: 960, y0: POS.B, y1: POS.H + BAND_H };
const TEXTS = () => {
  const L = [];
  for (const s of STEPS) L.push([s.t0, s.out1, s.id, s.lines.join('|'), 'band', 'F4_draw', { box: BANDBOX }]);
  for (const s of SUBS) L.push([s.t0, s.t1, s.id, s.text, 'sub2', 'DX_draw', { voice: s.voice, box: G.sigSub, covers: [W('RV4', 'bonzini'), speech('RV4')[1]] }]);
  L.push([A.fort, A.whip + .10, 'fort', 'C’EST|FORT' + NB + '!', 'stamp2', 'DX_draw', { box: { x0: 170, x1: 910, y0: 440, y1: 800 }, color: COL.orange }]);
  L.push([A.panel, T.end + .01, 'plate', 'BONZINI TRADING CARGO|Chine → Douala · bateau ou avion', 'plate', 'DX_draw', { box: G.plate }]);
  L.push([A.pill, T.end + .01, 'cta', CTA.join('|'), 'cta2', 'DX_draw', { box: G.cta }]);
  L.push([-1, T.end + .01, 'logo', 'VRAIES IMAGES', 'logo', 'DX_draw', { box: G.mention }]);
  for (const p of pillSpans()) L.push([p.t0, p.t1, p.id, p.text, 'pill', 'DX_draw', { box: p.box }]);
  return L;
};
function pillSpans() {
  return [
    { id: 'pillD1', t0: -1, t1: A.whip, text: 'ICI · DOUALA', box: { x0: 60, x1: 420, y0: 170, y1: 230 } },   // gone at the switch of the filé
    { id: 'pillG3', t0: A.panel + .05, t1: T.end + .01, text: 'LÀ-BAS · GUANGZHOU', box: { x0: 48, x1: 548, y0: G.pillPanel.y0, y1: G.pillPanel.y1 } },   // after the filé's tail
  ];
}

// =====================================================================================================================
// 7. MODULE STATES (MODULES.md) — pure in t
// =====================================================================================================================
function windows(t) {
  const o = {};
  for (const a of E.active(t)) {
    const side = a.shot.side; if (!side) continue;
    const f = FOCUS[a.shot.id], R = a.R, Fp = f ? f.F(t) : null;
    o[side] = { side, rect: { x: R.x, y: R.y, w: R.w, h: R.h, tilt: R.tilt || 0, r: R.r || 0 }, shot: a.shot.id, clip: a.shot.clip, src: a.src,
      s: f ? f.s(t) : null, F: Fp, fscreen: Fp ? project(a, Fp.x, Fp.y) : null, dark: 0, Q: { x: R.x + R.w / 2, y: R.y + R.h / 2 },
      mode: side === 'P' ? 'panel' : 'full', card: null, u: null };
  }
  return o;
}
function pills(t) {
  const o = { G: null, D: null }, inA = (t0, t1, fi = .2, fo = .15) => Math.min(t0 < 0 ? 1 : easeOut(kk(t, t0, t0 + fi)), 1 - kk(t, t1 - fo, t1));
  const ent = t0 => t0 < 0 ? 0 : 20 * (1 - easeOut(kk(t, t0, t0 + .2)));
  for (const p of pillSpans()) {
    if (t < p.t0 || t >= p.t1) continue;
    const a = inA(p.t0, p.t1); if (a <= 0) continue;
    if (p.id === 'pillG3') o.G = { x: G.pillPanel.x, y0: G.pillPanel.y0, y1: G.pillPanel.y1, a, dy: ent(p.t0), text: p.text, color: 'amber', flag: 'CN', textColor: COL.ink };
    else o.D = { x: G.pillD.x, y0: G.pillG.y0, y1: G.pillG.y1, a, dy: ent(p.t0), text: p.text, color: 'orange', flag: 'CM', textColor: COL.white };
  }
  return o;
}
/** texts(t): the band phrases of the shared module — none here (30_film4.js draws the film-4 steps, SCORE.F4) */
const texts = () => [];
function subtitles(t) {
  for (const s of SUBS) {
    if (t < s.t0 - .001 || t >= s.t1 + .12) continue;
    const ws = wordsOf(s.voice), a = Math.min(easeOut(kk(t, s.t0, s.t0 + .15)), 1 - kk(t, s.t1, s.t1 + .12));
    let j = 0;
    const lines = s.text.split('|').map(l => l.split(' ').filter(Boolean).map(tok => {
      const k = nrm(tok); let w = null;
      for (let q = j; q < ws.length && k; q++) { const r = nrm(ws[q].w); if (r && (r === k || r.startsWith(k) || k.startsWith(r))) { w = ws[q]; j = q + 1; break; } }
      const said = w ? t >= w.s : true, cur = w ? t >= w.s && t < w.e + .06 : false;
      const kc = Object.keys(KEYCOL).find(q => k.startsWith(q)), col = kc ? 'violet' : 'white';
      return { w: tok, s: w ? w.s : null, e: w ? w.e : null, state: cur ? 'current' : said ? 'said' : 'coming', color: col };
    }));
    const box = Object.assign({}, G.sigSub);
    return { id: s.id, voice: s.voice, mode: s.mode, box, head: s.head, a, lines, t0: s.t0, t1: s.t1,
      layout: { headY: box.y0 + G.sub.headDy, line1Y: box.y0 + G.sub.line1Dy, line2Y: box.y0 + G.sub.line2Dy, size: G.sub.size, lead: G.sub.lead }, env: { voice: s.voice, u: t - T[s.voice] } };
  }
  return null;
}
function stamps(t) {
  const o = [];
  if (t >= A.fort && t < A.whip + .10) {                    // C'EST FORT ! leaves with the image in the filé
    const m = E.active(t).find(a => a.shot.id === 'M6');
    o.push({ id: 'fort', text: 'C’EST FORT' + NB + '!', lines: ['C’EST', 'FORT' + NB + '!'], size: 170, rot: -3, color: 'orange', cx: 540 + (m ? m.fx.dx : 0), cy: 620,
      scale: 1, age: t - A.fort, a: m ? cl(1 - m.fx.smear / 140) : 0, ride: 'M6', smear: m ? m.fx.smear : 0 });
  }
  return o;
}
const merci = () => null;
const map = () => null;
function signature(t) {
  if (t < A.F) return null;
  const wp = kk(t, A.whip - .10, A.whip + .10);
  return { T0: A.T0, bandOut: kk(t, A.F, A.F + GLIDE), full: 1,
    sub: { t0: A.sigSub, t1: A.sigSubOut, box: G.sigSub, a: Math.min(easeOut(kk(t, A.sigSub, A.sigSub + .15)), 1 - kk(t, A.sigSubOut, A.sigSubOut + .12)) },
    whip: { t0: A.whip - .10, t1: A.whip + .10, p: wp, switchAt: A.whip, rgb: 6, trail: 120 },
    panel: Object.assign({ on: t >= A.whip, a: t >= A.whip ? 1 : 0, push: panelZoom(t), fix: PANEL.fix, src: PANEL.src, freezeAt: A.panel + 2.0 }, G.panel),
    background: { on: t >= A.whip, color: COL.night },
    plate: Object.assign({ t0: A.panel, p: kk(t, A.panel, A.panel + .25), drop: backOut(kk(t, A.panel, A.panel + .25), 2.2), a: t >= A.panel ? 1 : 0,
      line1: 'BONZINI TRADING CARGO', line2: 'Chine → Douala · bateau ou avion' }, G.plate),
    cta: Object.assign({ t0: A.pill, p: kk(t, A.pill, A.pill + .32), a: t >= A.pill ? 1 : 0, line1: CTA[0], line2: CTA[1] }, G.cta),
    freeze: t >= A.freeze, freezeAt: A.freeze, ambOnly: A.freeze, route0: T[NC] };   // route0: the plate's parcel travels during the call
}
// ---------- film 4: the 5 stops and the hopping parcel (§5.4) ----------
/** stop k (1…5) filled at STEP_T[k−1]; the parcel hops 0,25 s from the previous stop (or the start) onto it */
function stopsState(t) {
  const S = G.stops, out = [];
  for (let k = 0; k < 5; k++) { const t0 = STEP_T[k], land = t0 + S.hop; out.push({ k: k + 1, x: S.x[k], t0, land, fill: kk(t, land - .04, land + .06), burst: t >= land ? kk(t, land, land + .45) : 0 }); }
  return out;
}
function parcelHop(t) {
  const S = G.stops; let k = -1; for (let i = 0; i < 5; i++) if (t >= STEP_T[i]) k = i;
  if (k < 0) return { x: S.startX, lift: 0, squash: 0, p: 1, k: 0 };
  const t0 = STEP_T[k], p = kk(t, t0, t0 + S.hop), x0 = k ? S.x[k - 1] : S.startX, x1 = S.x[k];
  const d = t - (t0 + S.hop), squash = d > 0 && d < .30 ? .22 * Math.exp(-d * 14) * Math.cos(d * 38) : 0;
  return { x: lerp(x0, x1, ease(p)), lift: S.hopH * 4 * p * (1 - p), squash, p, k: k + 1, land: t0 + S.hop };
}
/** progress(t): the shared parcel is HIDDEN (a = 0: 30_film4.js draws the hopping one); x lights the travelled route */
function progress(t) { const b = band(t), h = parcelHop(t); return { p: h.x / SW, x: h.x, y: b.y0, a: 0, w: G.parcel.w, h: G.parcel.h }; }
const logo = t => Object.assign({ a: 1, text: 'VRAIES IMAGES' }, G.logo);
// ---------- film 4: the machine's light (M2) and trail (M4) — machine centres, SOURCE px, keyed every 3 frames (6 for the
// light), checked on sheets (tools/green_centre.py: the centre of the machine's green extent; work/c_v36.json, c_v38.json)
const C_M2 = [[14.10, 470, 455], [14.50, 470, 468], [14.90, 444, 466], [15.30, 432, 466], [15.70, 418, 462], [16.10, 414, 460], [16.50, 412, 456], [16.90, 418, 445], [17.27, 425, 434]];
const C_M4 = [[5.9, 364.5, 523.0], [6.0, 353.5, 526.5], [6.1, 344.5, 533.5], [6.2, 336.5, 535.0], [6.3, 328.5, 536.5], [6.4, 322.5, 534.5],
  [6.5, 316.5, 533.5], [6.6, 312.0, 532.5], [6.7, 307.5, 533.5], [6.8, 302.5, 532.5], [6.9, 299.5, 541.0], [7.0, 295.5, 540.0], [7.1, 292.5, 538.0],
  [7.2, 291.0, 536.0], [7.3, 290.5, 533.0], [7.4, 289.5, 531.0], [7.5, 289.0, 529.5], [7.6, 289.5, 525.5], [7.7, 291.0, 522.5], [7.8, 293.5, 522.5],
  [7.9, 297.5, 521.0], [8.0, 300.5, 519.5], [8.1, 306.0, 516.5], [8.2, 311.5, 516.5], [8.3, 316.5, 515.5], [8.4, 323.5, 517.0], [8.5, 328.5, 516.0],
  [8.6, 334.5, 517.0], [8.7, 338.5, 518.0], [8.8, 341.5, 517.5], [8.9, 342.5, 519.0], [9.0, 340.5, 524.0], [9.1, 338.5, 527.5], [9.2, 336.5, 529.5],
  [9.3, 330.5, 532.5], [9.4, 326.5, 535.5], [9.5, 321.0, 536.5]];   // (y at r 6,9–7,2 hand-smoothed: the lower plate swings into the extent)
function keyAt(K, s) {
  if (s <= K[0][0]) return [K[0][1], K[0][2]]; if (s >= K[K.length - 1][0]) return [K[K.length - 1][1], K[K.length - 1][2]];
  let i = 0; while (i < K.length - 2 && s >= K[i + 1][0]) i++;
  const u = (s - K[i][0]) / (K[i + 1][0] - K[i][0]); return [lerp(K[i][1], K[i + 1][1], u), lerp(K[i][2], K[i + 1][2], u)];
}
/** a gaussian-smoothed key track (σ = 2 frames) */
const keySm = (K, s) => { let x = 0, y = 0, w = 0; for (let j = -6; j <= 6; j++) { const g = Math.exp(-j * j / 8), p = keyAt(K, s + j / FPS); x += g * p[0]; y += g * p[1]; w += g; } return [x / w, y / w]; };
/** screen position of a source point of shot id at film time t (null when the shot is not drawn) */
function onScreen(id, t, x, y) { const a = E.active(t).find(q => q.shot.id === id); return a ? project(a, x, y) : null; }
/** M4 · the TRAIL as the band's own route, drawn through the air: an amber dashed arc from off-screen right (the crane
 *  truck's side, v38/v39) to off-screen left (the shop's side, v39), bent through the machine's centre (hand-checked keys
 *  every 3 frames): the part behind the machine solid, the part ahead at 45 % (the band's « travelled / to come »). It
 *  draws itself in 0,8 s (SERIE: « sur 0,8 s »), then its middle follows the machine. (SERIE's literal 0,8-s track of the
 *  centre is ≈ 100 screen px long, under the machine itself: 3 dashes nobody sees.) */
const TRAIL = { draw0: A.c4 + .15, draw1: A.c4 + .95, p0: [1180, 1000], p2: [-110, 1320] };   // the centre rides ≈ 100 px above the chord: an arc
const F4 = {
  steps: STEPS, stops: stopsState, parcel: parcelHop,
  /** M2: the soft light on the machine (+0,4 EV in a radial mask, source radius 150) */
  light: t => {
    if (t < A.c2 || t >= A.c3) return null;
    const a = E.active(t).find(q => q.shot.id === 'M2'); if (!a) return null;
    const [sx, sy] = keySm(C_M2, a.src), p = project(a, sx, sy), k = a.R.w / a.crop.w;
    return { x: p[0], y: p[1], r: 150 * k, ev: .4, a: easeOut(kk(t, A.c2 + .15, A.c2 + .60)) * (1 - kk(t, A.c3 - .12, A.c3)) };
  },
  /** M4: the route arc (screen px), its draw-in, the machine's centre and velocity (screen px / s), the wind's frame */
  trail: t => {
    if (t < A.c4 || t >= A.c5) return null;
    const a = E.active(t).find(q => q.shot.id === 'M4'); if (!a) return null;
    const c = keySm(C_M4, a.src), C = project(a, c[0], c[1]), k = a.R.w / a.crop.w;
    const c0 = keySm(C_M4, a.src - .25), v = [(c[0] - c0[0]) * k / .25, (c[1] - c0[1]) * k / .25];
    return { C, v, k, p0: TRAIL.p0, p2: TRAIL.p2, draw: ease(kk(t, TRAIL.draw0, TRAIL.draw1)), ahead: easeOut(kk(t, TRAIL.draw1 - .1, TRAIL.draw1 + .35)),
      a: 1 - kk(t, A.c5 - .15, A.c5), age: t - A.c4, dash: [20, 12], w: 10,
      bbox: [project(a, c[0] - 190, c[1] - 140), project(a, c[0] + 190, c[1] + 160)] };
  },
  sweep: t => (t >= A.sweep0 - .05 && t < A.sweep1 + .05) ? { p: kk(t, A.sweep0, A.sweep1) } : null,
  /** the stamp's backing (C'EST FORT ! over the bright street of v40): a soft night plate under the stamp */
  A, T,
};

// =====================================================================================================================
// 8. SOUND (§3.11, §5.4 « son »)
// =====================================================================================================================
/** RV4 as film 1 review 2 treats it (the same segment ends the 4 films; gain only, no time change: karaoke and stamp stay
 *  put): presence +4,5 dB at 3,2 kHz (the brand words through a phone), and the bystander's murmur before « Voilà » (source
 *  18,80–19,19) at −15 dB. env = [[source s, dB]…], raised cosine between keys. Film 4 keeps its +2,5 dB lift (RV4 alone after
 *  the stamp). */
const RV_FX = {
  RV4: { gain: 2.5, presence: { hz: 3200, db: 4.5 }, air: { src: 'accomp', g: -24 }, env: [[18.80, -15], [19.19, -15], [19.21, 0]] },
};
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
/** each shot's own sound (SERIE level, voice ≈ −14): Douala −16, M4 « son du rush à −20 », the panel's street −18 */
const AMB_LVL = { M1: -17, M2: -18, M3a: -17, M3b: -17, M4: -20, M5: -17, M6: -17, PN: -18 };   // the crowd under the steps a little lower (listen test: « conteneur »)
/** M6's street (v40: a busy street through the door) steps down 8 dB under RV4 (« Bonzini Trading, faites-nous confiance »)
 *  — the weak listener lost « Bonzini » under it */
const AMB_KEYS = { M6: [[A.c6, 0], [T.RV4 + .30, 0], [T.RV4 + .45, -8]] };
function ambience() { return E.ambience().map(seg => Object.assign(seg, { keys: AMB_KEYS[seg.shot] || [], lvl: AMB_LVL[seg.shot] ?? -16, gz: !!GZ[seg.clip] })); }
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0, d, note) => { if (t >= 0 && t < T.end) { const c = { t: R6(t), name, g, pan }; if (d !== undefined) c.d = R6(d); if (note) c.note = note; Q.push(c); } };
  for (const k of BAND_KEYS) if (k.t > 0) q(k.t, 'whoosh', .55, 0, .35, `band glide → ${k.to}`);
  // M1 the question: a low pulse, the crane's hydraulic hiss, the chain rattling
  q(0, 'pulse', .8, 0, A.step1, 'low pulse under the question (100 bpm)');
  q(0, 'hydraulic', .55, .25, A.c2 + .10, 'hydraulic hiss of the crane');
  q(.40, 'chain', .6, .3, .70, 'chain rattle');
  // M2 it comes out of the container
  // (SFX are placed in the narrator's pauses: the listen test lost « conteneur » under a clank at 3,20 and the scrape)
  q(A.c2 + .05, 'scrape', .6, .2, T.S1 - A.c2 - .10, 'metal scraping on the container floor (until S1)');
  q(END('H') + .15, 'clank', .75, .25, undefined, 'clank (the blades hit the door frame) — SERIE 3,20, moved into the pause before S1');
  // M3 the crane lifts it: the hydraulics rise a tone, the chain tightens
  q(A.c3, 'hydraulic', .7, -.15, A.c4 - A.c3, 'hydraulic, a tone up (pitch rises)');
  q(A.clonk - .25, 'chain', .55, -.2, .35, 'the chain tightens');
  q(A.clonk, 'clonk', .8, -.1, undefined, 'clonk');
  // M4 over the street: wind, a deep whoom on the rotation, creaks (the music is suspended: a pad)
  q(A.c4 + .05, 'wind', .7, 0, A.c5 - A.c4 - .05, 'wind over the street');
  q(A.c4 + .02, 'whoom', .8, -.2, T.S3 - A.c4 + .25, 'deep whoom of the rotation (as the band glides, before S3)');
  q(END('S3') + .03, 'whoom', .7, .2, A.c5 - END('S3') + .10, 'deep whoom of the rotation (after « rue »)');
  q(END('S3') + .08, 'creak', .45, -.3, .40, 'chain creak');
  q(A.sweep0, 'shimmer', .5, -.4, A.sweep1 - A.sweep0 + .2, 'the amber light sweep');
  // M5 in front of the shop: hydraulics (soft)
  q(A.c5 + .10, 'hydraulic', .45, .3, A.c6 - A.c5 - .30, 'hydraulic (soft)');
  // M6 it goes in: scraping on the concrete, the chain stops, a deep thunk
  q(A.c6 + .02, 'scrape', .5, -.1, A.thunk - A.c6 + .05, 'scraping on the concrete');
  q(A.thunk - .12, 'chain', .4, .1, .18, 'the chain stops');
  q(A.thunk, 'thunk', .9, 0, undefined, 'deep thunk');
  // the steps: each stop fills when the parcel lands (tick), the check is drawn with a felt pen
  for (let k = 0; k < 5; k++) q(STEP_T[k] + G.stops.hop, 'tick', .55, -.6 + .3 * k, undefined, `parcel lands on stop ${k + 1}`);
  q(A.check0, 'felt', .5, .1, A.check1 - A.check0, 'the orange felt check');
  // the signature (§3.10)
  q(A.fort, 'stamp_big', 1, 0, undefined, 'C’EST FORT ! (the biggest)');
  q(A.whip - .10, 'whip', .8, 0, .20, 'filé');
  q(A.panel, 'tonk', .8, 0, undefined, 'the violet plate lands');
  q(A.panel, 'bonzini_sig', .85, 0, undefined, 'balafon signature');
  q(A.pill, 'pop', .6, 0, undefined, 'the amber pill');
  return Q.sort((a, b) => a.t - b.t || (a.name < b.name ? -1 : 1));
}
const BPM = 100, BEAT = 60 / BPM, BAR = 4 * BEAT, GRID0 = A.c2;
const B = k => R6(GRID0 + k * BEAT);
function music() {
  const sec = [
    { t0: A.c2, t1: A.c4, level: 'lite', db: -18, duckUnderVoice: -29, prog: 'major', shaker: true, grid0: A.c2, note: 'steps 1–2: the groove starts on the first cut (a hit)' },
    { t0: A.c4, t1: A.c5, level: 'pad', db: -24, duckUnderVoice: -28, prog: 'major', pad: { name: 'nappe', db: -24 }, groove: false, note: 'step 3: the music is SUSPENDED — a held pad (nappe), no groove' },
    { t0: A.c5, t1: A.musicCut, level: 'bass', db: -18, duckUnderVoice: -26, prog: 'major', shaker: true, grid0: A.c5, note: 'step 4: the groove returns on the cut (a hit)' },
    { t0: A.major, t1: A.freeze, level: 'full', db: -16, duckUnderVoice: -22, prog: 'major', shaker: true, congas: true, balafon: true, grid0: A.major,
      note: 'back in major after the balafon signature (grid restarts on the reprise), button before the freeze' },
  ];
  return { bpm: BPM, beat: BEAT, grid0: GRID0, prog: 'major', sections: sec, hits: [A.c2, A.c5, A.major], stops: [[A.musicCut, A.major]], end: A.freeze,
    duck: { voice: 12, amb: 9 }, ambOnly: [A.freeze, T.end], note: 'no music under the question (pulse SFX); suspended at step 3; cut 0,2 s before C’EST FORT ! (§3.11)' };
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
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1] + .35 - 1e-6 && NARR[sp[i][2]] && NARR[sp[i - 1][2]]) Wn.push(`pause ${sp[i - 1][2]} → ${sp[i][2]} < ,35 s`);
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1] - 1e-6) Wn.push(`voices overlap: ${sp[i - 1][2]} (→ ${sp[i - 1][1].toFixed(2)}) / ${sp[i][2]} (${sp[i][0].toFixed(2)} →)`);
  for (let k = 0; k < 5; k++) { const id = 'S' + (k + 1); if (STEP_T[k] > T[id] + 1e-6) Wn.push(`step ${k + 1} text after its voice ${id}`); }
  if (A.step1 < END('H') - .3) Wn.push('step 1 replaces the question before it is asked');
  return Wn;
}
const QA = { minHold: 1.4, notBlocks: ['mention', 'logo', 'pill'], masks: ['v1', 'v2', 'v3'], names: { main: 'MACHINE', wa: 'MACHINE_WA' },   // out/<name>_share|whatsapp.mp4 (tools/qa.js, tools/mux.sh)
  covered: t => { const r = [], b = band(t); if (b.a > .5) r.push({ x: 0, y: b.y0 - 2, w: SW, h: BAND_H + 4 }); if (t >= A.whip) r.push({ x: 0, y: 0, w: SW, h: SH }); return r; } };

const SCORE = { FPS, N, T, A, DUR, W, WE, WS, END, SYL, VOICES: Object.fromEntries(RV_IDS.map(id => [id, Object.assign({ id }, RV[id])])), RV, NARR, N_IDS, RV_IDS,
  WORDS, SRCW, wordsOf, speech, BPM, BEAT, BAR, B, G, COL, VARIANT, CUT, CLIPS, HIDE, MUST_HIDE, HP, BAKE, LAYERS: [], QA,
  shots: E.shots, byId: E.byId, active: E.active, need: E.need, needs: E.needs, frameSet: E.frameSet, overlays: E.overlays, shutter: E.shutter,
  CUTS: E.CUTS, cropAt: E.cropAt, project, ambience, audit: E.audit,
  band, windows, dark, pills, texts, subtitles, stamps, merci, map, signature, progress, logo, screenFx, foldP, mainSide, onScreen,
  TEXTS, voices, narration, soundCues, music, check, BAND_KEYS, DARK_KEYS, FOCUS, PANEL, KEYCOL, F4, STEPS, STEP_T,
  kk, ease, easeOut, easeIn, backOut, backS, bump, lerp, cl, EASE };
if (!isNode) window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
