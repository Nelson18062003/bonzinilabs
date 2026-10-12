'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — Bonsoir, bonsoir (rush edit, 1080×1920, 30 fps) — THE SCORE. One source of truth for picture
// AND sound. Spec: rush1/STORYBOARD.md (§2 table, §5.4 time map, §5.5 anchors, §5.6 sound).
//
// TIMING CONTRACT OF THIS FILM (differs from the series): data/timing.json carries ONLY
//     { dur: {N1: s, …}, words: {N1: [{w, s, e}], …} }        (word times RELATIVE to that line's speech start)
// written by tools/make_timing.py from the chosen TTS takes. The score computes EVERY start itself with the storyboard's
// chain (§5.5): T.N1 fixed 2.15, A.stop = 7.00, T.N3 = A.stop + .10, A.rew = T.N3 + DUR.N3, … T.end = END(N6) + .30.
// DUR defaults = the §5.5 default column (they reproduce its default times exactly, 25.05 s).
//   T[id]   start of the SPEECH of narrator line id (N1…N6); for the real-voice clips R1 / R2 / R1b, T[id] = the film
//           time where the clip (source span REAL[id].src) starts.  T.end = film duration.
//   W(id, prefix, nth = 0, fb)  absolute time of the nth word of line id starting with prefix (accent / case / elision
//           insensitive, 'a|b' = either), else T[id] + fb.  WE(…) the same for the word END.  SYL(id, k, n) = k of n
//           syllables into the line (the fallbacks).
//   A       every action time, derived from T / W / DUR / the rush constants (no free-floating literal time).
//   r(t)    film time → rush time (§5.4); frameOf(t) = round(r × 30) clamped to 0…298.
//   cam(t)  the camera on the rush: screen = s·(P − F) + Q + shake, P in FRAME px (the 1080×1920 prepared frame).
//   label(t) the BONZINI label's SCREEN box for the frame shown at t (camera included), interpolated where ok = false.
//   chrono(t) / ring(t) / card(t) / gecko(t): the states the modules draw (MODULES.md).
//   soundCues() / music() / REAL: the sound plan (§5.6).
// Every state is a pure function of t (motion blur samples sub-frames). Deterministic: no Math.random, no Date, no
// ctx.filter. Loaded by the browser (window.SCORE; TIMING and LABEL_TRACK injected by render.mjs) AND by node
// (module.exports; reads data/timing.json and data/label_track.json itself):
//   node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.T, S.A, S.music())"
// =============================================================================================
(function () {                       // own scope: kit.js already declares FPS, W, H, C… as globals
const FPS = 30;
const isNode = typeof window === 'undefined';
const readJSON = rel => { const fs = require('fs'), p = require('path'); for (const r of rel) { const f = p.join(__dirname, ...r); if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`01_score.js: cannot parse ${f}: ${e.message} (defaults used)`); return null; } } } return null; };

// ---------- the rush (footage facts, RUSH seconds; BRIEF.md + STORYBOARD §5.4) ----------
const RUSH = {
  frames: 299, fps: 30, srcW: 464, srcH: 832, scale: 1080 / 464, cropY: 8,     // frame = source × 2.3276, y − 8
  pan1: [2.90, 3.40], walk: [3.40, 4.90], pan2: [4.90, 5.60],                    // the two whip pans (played ×2) and the walk
  stopR: 7.60, rew1: [7.60, 5.70], rew2: [2.80, 1.00], zoomR: 1.00, liveR: 7.62, liveLen: 2.00, ctaR: .55, ctaFreezeR: 2.00,
  never: [2.90, 5.60],                                                           // never shown reversed (§5.4, §5.7)
};

// ---------- voice keys (defaults = §5.5 default column) ----------
const T = { R1: 0, N1: 2.15, N2: 4.55, N3: 7.10, N4: 9.65, R2: 13.88, N5: 16.10, R1b: 20.60, N6: 22.00, end: 25.05 };
const DUR = { N1: 1.67, N2: 2.22, N3: 1.25, N4: 3.70, N5: 4.10, N6: 2.75 };
const DUR0 = Object.assign({}, DUR);
let TM = null, WORDS = {}, LT = null, ZJ = null;
if (!isNode) { TM = window.TIMING || null; LT = window.LABEL_TRACK || null; ZJ = (window.ZOOM && window.ZOOM.geo) || null; }
else { TM = readJSON([['..', '..', 'data', 'timing.json']]); LT = readJSON([['..', '..', 'data', 'label_track.json'], ['..', '..', '..', 'work', 'label_track.json']]); ZJ = readJSON([['..', '..', 'assets', 'zoom', 'r100_x4.json']]); }
if (TM && TM.dur) for (const k in TM.dur) if (typeof TM.dur[k] === 'number' && TM.dur[k] > 0) DUR[k] = TM.dur[k];
if (TM && TM.words) WORDS = Object.assign({}, TM.words);
// the WhatsApp-status variant (STORYBOARD §6): voice N6w « Réponds-lui en message : bonsoir. » + the pill « Réponds-lui en
// message : BONSOIR ↓ », timed on N6w. node: BZ_VARIANT=wa (lib/audio_rush.py --n6w sets it) · browser: window.VARIANT =
// 'wa' (render.mjs --n6w). Anything else = the main film.
const VARIANT = ((isNode ? (typeof process !== 'undefined' && process.env && process.env.BZ_VARIANT) : window.VARIANT) === 'wa') ? 'wa' : 'main';
if (VARIANT === 'wa') { if (DUR.N6w > 0) DUR.N6 = DUR.N6w; if (WORDS.N6w) WORDS.N6 = WORDS.N6w; }

// ---------- word anchors ----------
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const forms = w => { const r = deacc(w); return [r.replace(/[^a-z0-9]/g, ''), r.replace(/^(?:[a-z]{1,2}|qu|jusqu)['’]/, '').replace(/[^a-z0-9]/g, '')]; };
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; let c = 0;
  const ks = String(prefix).split('|').map(p => deacc(p).replace(/[^a-z0-9]/g, '')).filter(Boolean);
  for (const w of ws) if (forms(w.w).some(x => ks.some(k => x.startsWith(k)))) { if (c++ === nth) return w; }
  return null;
}
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + DUR[id];
const SYL = (id, k, n) => DUR[id] * k / n;

// ---------- maths ----------
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
const ease = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => 1 - Math.pow(1 - cl(x), 3);
const easeIn = x => { x = cl(x); return x * x * x; };
const backOut = (x, s = 1.7) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const lerpv = (a, b, k) => a + (b - a) * k;
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;
function spr(t, w = 16, z = .45) { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }

// ---------- the music grid: the chrono seconds ARE the music's beats 1 and 3 (120 bpm, 1 s = 2 beats) ----------
const BPM = 120, BEAT = 60 / BPM, SEC = 2 * BEAT;
const TICK = k => A.chrono0 + k * SEC;            // chrono tic k (0 … 6); « 7 − k » is shown from TICK(k)

// ---------- DERIVED ACTION TIMES (§5.5 chain) ----------
const A = {};
A.chrono0 = 0;                                    // tic 0 = image 0 (the chrono starts on the cover)
A.musicIn = TICK(2);                              // 2.00: the tense makossa drops dry on a downbeat
A.stop = TICK(7);                                 // 7.00: a real 7-second hunt; the STOP
T.R1 = 0;                                         // the rush's own sound from r 0.00
T.N1 = A.musicIn + .15;                           // 2.15 (fixed, after the music hit)
// the picture of the hunt is the rush's own timeline: r = t, then the pans at ×2, the walk at ×1, the van again
A.pan1 = RUSH.pan1[0];                                          // 2.90 (r = t before)
A.pan1e = A.pan1 + (RUSH.pan1[1] - RUSH.pan1[0]) / 2;           // 3.15
A.pan2 = A.pan1e + (RUSH.walk[1] - RUSH.walk[0]);               // 4.65
A.pan2e = A.pan2 + (RUSH.pan2[1] - RUSH.pan2[0]) / 2;           // 5.00 (the « 2nd chance » on the van)
// N2 is fixed at 4.55 and must end before 6.85; a long take moves it earlier (never onto N1), else WARN
T.N2 = cl(6.85 - DUR.N2, END('N1') + .25, 4.55);
A.hint = T.N2;                                                  // « écrit sur un colis » joins the title plate
T.N3 = A.stop + .10;
A.rew = END('N3');                                              // 8.35 the rewind
A.splice = A.rew + .25;                                         // r 5.70 | r 2.80 — hidden by 2 frames of whip
A.zoom = A.rew + .50;                                           // 8.85 freeze r 1.00, the single push ×1 → ×4
A.ring = A.zoom + .60;                                          // 9.45 ×4 reached: ellipse, balafon signature
T.N4 = A.ring + .20;                                            // 9.65
A.answer = A.ring + .15;                                        // 9.60 the answer block
A.hand = A.ring + .45;                                          // « écrit à la main », once the ellipse is closed
// « Le mot Bonzini était là dès le début. » le·mot·bon·zi·ni·é·tait·là·dès·le·dé·but = 12 syllables
A.arrow = W('N4', 'bonz', 0, SYL('N4', 2, 12));                // the violet arrow title → ellipse, on « Bonzini »
A.pulse = W('N4', 'debut', 0, SYL('N4', 10, 12));              // the chrono « 6 » pulses once, on « début »
A.out = END('N4') + .20;                                        // 13.55 dezoom (.15 s) …
A.whip = A.out + .15;                                           // … then the whip (.10 s) …
A.live = A.out + .25;                                           // 13.80 … onto r 7.62: the video starts again
T.R2 = A.live + (7.70 - RUSH.liveR);                            // 13.88: R2 = source r 7.70 on its own pictures
A.sub2 = A.live + .05;
A.card = A.live + RUSH.liveLen;                                 // 15.80 the kraft sheet rises
A.plate = A.card + .15;                                         // 15.95 the enamel plate lands (tonk), major makossa
T.N5 = A.card + .30;                                            // 16.10
// « Avec Bonzini, tes colis vont de Chine à Douala. » a·vec·bon·zi·ni·tes·co·lis·vont·de·chine·à·doua·la = 14
A.chine = W('N5', 'chin', 0, SYL('N5', 10, 14));               // the boat pops on « Chine »
A.doua = W('N5', 'doua', 0, SYL('N5', 12, 14));                // the plane + the margouillat's nod on « Douala »
A.route = T.N5 + .35;                                           // the felt route starts to draw
A.by = T.N5 + 1.40;                                             // 17.50 « Par bateau ou par avion. »
A.cta = END('N5') + .40;                                        // 20.60 cut to r 0.55 (guitar motif in the gap)
T.R1b = A.cta;                                                  // R1b = source r 0.55 on its own pictures
A.sub3 = A.cta + .05;
A.ctaFreeze = A.cta + (RUSH.ctaFreezeR - RUSH.ctaR);            // 22.05 freeze on r 2.00
A.pill = A.cta + 1.25;                                          // 21.85 the amber pill
T.N6 = A.pill + .15;                                            // 22.00
T.end = END('N6') + .30;                                        // 25.05 cut to image 0 (the loop)
A.end = T.end;
A.stopPeel = A.rew + .10;                                       // « STOP ! » peels off at 8.45
A.question = A.stop + .15;                                      // « TU L'AS VU ? » 7.15 → A.ring
const R6 = x => Math.round(x * 1e6) / 1e6;                      // 25.049999… → 25.05 (N = 752, not 751)
for (const k in T) T[k] = R6(T[k]); for (const k in A) A[k] = R6(A[k]);
const N = Math.round(T.end * FPS);

// ---------- the real voice (source spans in audio48.wav, rush seconds) ----------
const REAL = {
  R1: { id: 'R1', t: T.R1, src: [0.00, 1.78], fadeIn: 0, fadeOut: .06, speech: [T.R1 + .60, T.R1 + 1.70], text: 'Bonsoir, bonsoir.' },
  R2: { id: 'R2', t: T.R2, src: [7.70, 9.60], fadeIn: .06, fadeOut: .08, speech: [T.R2 + .02, T.R2 + 1.87], text: 'Merci de faire confiance à Bonzini Trading.' },
  R1b: { id: 'R1b', t: T.R1b, src: [0.55, 1.78], fadeIn: .04, fadeOut: .06, speech: [T.R1b + .05, T.R1b + 1.15], text: 'Bonsoir, bonsoir.' },
};
for (const k in REAL) { const R_ = REAL[k]; R_.end = R6(R_.t + R_.src[1] - R_.src[0]); R_.speech = R_.speech.map(R6); }
A.sub1 = REAL.R1.speech[0] + .15;                               // 0.75
A.sub1out = REAL.R1.speech[1] + .65;                            // 2.35
A.sub2out = Math.max(A.card + .08, REAL.R2.speech[1] + .10);    // 15.88: gone before the plate lands (M2 note); after R2's speech
for (const k of ['sub1', 'sub1out', 'sub2out']) A[k] = R6(A[k]);

// ---------- the time map r(t) (§5.4) ----------
function r(t) {
  if (t < A.pan1) return Math.max(0, t);
  if (t < A.pan1e) return RUSH.pan1[0] + 2 * (t - A.pan1);
  if (t < A.pan2) return RUSH.walk[0] + (t - A.pan1e);
  if (t < A.pan2e) return RUSH.pan2[0] + 2 * (t - A.pan2);
  if (t < A.stop) return RUSH.pan2[1] + (t - A.pan2e);
  if (t < A.rew) return RUSH.stopR;                                                        // the STOP freeze
  if (t < A.splice) return lerpv(RUSH.rew1[0], RUSH.rew1[1], (k => k * k)(kk(t, A.rew, A.splice)));     // 7.60 → 5.70, accelerating
  if (t < A.zoom) return lerpv(RUSH.rew2[0], RUSH.rew2[1], (k => 1 - (1 - k) * (1 - k))(kk(t, A.splice, A.zoom)));   // 2.80 → 1.00, landing
  if (t < A.whip + .05) return RUSH.zoomR;                                                 // freeze r 1.00 + push + dezoom + whip (1st half)
  if (t < A.live) return RUSH.liveR;                                                       // whip (2nd half) lands on r 7.62
  if (t < A.card) return RUSH.liveR + (t - A.live);                                        // the video starts again
  if (t < A.cta) return RUSH.liveR + RUSH.liveLen;                                         // r 9.62 held under the kraft
  if (t < A.ctaFreeze) return RUSH.ctaR + (t - A.cta);                                     // r 0.55 → 2.00 (R1b on its pictures)
  return RUSH.ctaFreezeR;                                                                  // freeze r 2.00
}
const frameOfR = rr => Math.max(0, Math.min(RUSH.frames - 1, Math.round(rr * RUSH.fps)));
const frameOf = t => frameOfR(r(t));
/** is the rush hidden at t (the kraft card fully covers it)? */
const rushHidden = t => t >= A.card + .26 && t < A.cta;
/** rush frames the picture needs at t (render.mjs preloads them before each frame / motion-blur sub-sample) */
const rushNeed = t => rushHidden(t) ? [] : [frameOf(t)];

// ---------- the shutter: motion-blur sub-samples that never straddle a hard cut ----------
/** picture cuts (STOP freeze + stamp, the hidden splice of the rewind, the whip's frame switch, the cut back from the card) */
const CUTS = () => [A.stop, A.splice, A.whip + .05, A.cta];
/** the sub-sample times of film frame n (180° shutter, mb samples). A frame keeps all its samples on the side of each cut
 *  where its centre lies, so a cut is clean on frame boundaries (no half-and-half blend). The engine (window.subTimes) and
 *  render.mjs (PRELOAD) both call this. */
function shutter(n, mb) {
  const tc = n / FPS; if (!(mb > 1)) return [tc];
  return Array.from({ length: mb }, (_, k) => {
    let t = (n + (k / (mb - 1) - .5) * .5) / FPS;
    for (const c of CUTS()) { if (t < c && c <= tc) t = c; else if (tc < c && c <= t) t = c - 1e-4; }
    return Math.max(0, t);
  });
}

// ---------- the label track (source px → frame px; ok = cc ≥ .8; gaps interpolated) ----------
const LBL = (function () {
  const n = RUSH.frames, S_ = RUSH.scale, raw = (LT && LT.frames) || [];
  const X = new Float32Array(n), Y = new Float32Array(n), Wd = new Float32Array(n), Hd = new Float32Array(n), GAP = new Int16Array(n), OK = new Uint8Array(n);
  const byF = {}; for (const q of raw) byF[q.f] = q;
  const okIdx = []; for (let i = 0; i < n; i++) if (byF[i] && byF[i].ok) okIdx.push(i);
  const fb = { x: 151, y: 502, w: 53, h: 25 };                    // r 1.00 (in case the track is missing)
  // the tracked box is the matching template (53 × 25); the WHITE CARD inside it (what the ellipse surrounds and the zoom
  // centres) is offset by (+6, +.5) and measures 49 × 23.5 source px (assets/zoom/r100_x4.json « label », measured at r 1.00)
  const tr = ZJ && ZJ.label && ZJ.label.track_src, wc = ZJ && ZJ.label && ZJ.label.white_card_src;
  const ADJ = tr && wc ? { dx: wc[0] - tr[0], dy: wc[1] - tr[1], w: wc[2], h: wc[3] } : { dx: 6, dy: .5, w: 49, h: 23.5 };
  for (let i = 0; i < n; i++) {
    let q = byF[i];
    if (!(q && q.ok)) {
      let a = -1, b = -1; for (const j of okIdx) { if (j < i) a = j; else { b = j; break; } }
      const qa = a >= 0 ? byF[a] : null, qb = b >= 0 ? byF[b] : null;
      if (qa && qb) { const k = (i - a) / (b - a); q = { x: lerpv(qa.x, qb.x, k), y: lerpv(qa.y, qb.y, k), w: qa.w, h: qa.h }; }
      else q = qa || qb || fb;
      GAP[i] = Math.min(a >= 0 ? i - a : 999, b >= 0 ? b - i : 999);
    } else { GAP[i] = 0; OK[i] = 1; }
    X[i] = (q.x + ADJ.dx) * S_; Y[i] = (q.y + ADJ.dy) * S_ - RUSH.cropY; Wd[i] = ADJ.w * S_; Hd[i] = ADJ.h * S_;
  }
  // smoothed centre (Gaussian σ = 7 frames over ok + interpolated), for the ×1.10 framing of the live segment
  const SCX = new Float32Array(n), SCY = new Float32Array(n);
  for (let i = 0; i < n; i++) { let sx = 0, sy = 0, sw = 0; for (let j = Math.max(0, i - 21); j <= Math.min(n - 1, i + 21); j++) { const w = Math.exp(-((j - i) ** 2) / (2 * 49)); sx += w * (X[j] + Wd[j] / 2); sy += w * (Y[j] + Hd[j] / 2); sw += w; } SCX[i] = sx / sw; SCY[i] = sy / sw; }
  return { X, Y, Wd, Hd, GAP, OK, SCX, SCY, ADJ, has: raw.length > 0 };
})();
/** the label (white card) box in FRAME px (1080×1920 prepared frame) for rush frame f */
const labelFrame = f => ({ x: LBL.X[f], y: LBL.Y[f], w: LBL.Wd[f], h: LBL.Hd[f], cx: LBL.X[f] + LBL.Wd[f] / 2, cy: LBL.Y[f] + LBL.Hd[f] / 2, ok: !!LBL.OK[f], gap: LBL.GAP[f] });
const smoothCx = rr => { const q = cl(rr * RUSH.fps, 0, RUSH.frames - 1), i = Math.floor(q), j = Math.min(RUSH.frames - 1, i + 1); return lerpv(LBL.SCX[i], LBL.SCX[j], q - i); };

// ---------- geometry (screen px; safe zones: nothing at y < 150, no text at x > 960 for y 900–1560, nothing important below 1540) ----------
const G = {
  cx: 540, W: 1080, H: 1920,
  safe: { top: 150, bottom: 1540, rightX: 960, rightY0: 900, rightY1: 1560 },
  mention: { x: 64, y0: 160, y1: 214, size: 44 },
  title: { l1: { y0: 420, y1: 520, size: 100 }, l2: { y0: 530, y1: 680, size: 150 }, l3: { y0: 690, y1: 760, size: 64 } },
  chrono: { x0: 840, x1: 1010, y0: 160, y1: 350, cx: 925, cy: 255, r: 85, digitSize: 110, label: { y0: 355, y1: 400, size: 44 } },
  sub1: { x0: 80, x1: 940, y0: 1330, y1: 1460 }, sub2: { x0: 80, x1: 940, y0: 400, y1: 640 }, sub3: { x0: 80, x1: 940, y0: 400, y1: 600 },
  sub: { head: 44, line: 64 },
  stop: { cx: 540, y0: 700, y1: 860, size: 150, rot: -4 * Math.PI / 180 },
  question: { y0: 420, y1: 540, size: 104 },
  answer: { y0: 400, y1: 730, size: 96, sizeBZ: 120, maxW: 940 },
  hand: { x0: 300, x1: 780, y0: 1200, y1: 1260, size: 52 },
  zoomLabel: { cx: 540, cy: 1020, s: 4, sEnd: 4.12 },        // the label lands here at ×4 (≈ 495 × 233 px)
  live: { s: 1.10, push: .06, screenCx: 730 },              // ×1.10 → ×1.16, label kept right of centre (x 600–860)
  pill: { x0: 90, x1: 930, y0: 1370, y1: 1530, size1: 48, size2: 88 },
  card: {
    plate: { x0: 120, x1: 960, y0: 260, y1: 520 }, service: { y0: 580, y1: 860, size: 96 },
    route: { x0: 100, x1: 900, y0: 860, y1: 1180, size: 52, carton: { x: 180, y: 1030 }, chine: { x: 330, y: 1120 }, douala: { x: 790, y: 1120 } },
    by: { y0: 1210, y1: 1270, size: 52 },
  },
  gecko: { x: 150, y: 1440 },                                // the margouillat on the card (x 40–300, y 1360–1530)
};
const COL = { violet: '#A947FE', violetD: '#7B22D6', violetInk: '#6A1FC2', amber: '#F3A745', orange: '#FE560D', ink: '#231629',
  white: '#FFFFFF', grey: '#6B6470', kraft: '#C79E6C', outline: '#170A26' };

// ---------- the camera on the rush ----------
const LZ = labelFrame(frameOfR(RUSH.zoomR));                  // the label at r 1.00 (zoom centre)
const LC = labelFrame(frameOfR(RUSH.ctaFreezeR));             // the label at r 2.00 (end push centre)
/** zoom path: one continuous push; the label's screen point follows the log of the scale, so it reads as one move */
function zoomCam(s) {
  const k = cl(Math.log(Math.max(1, s)) / Math.log(G.zoomLabel.s));
  return { s, fx: LZ.cx, fy: LZ.cy, qx: lerpv(LZ.cx, G.zoomLabel.cx, k), qy: lerpv(LZ.cy, G.zoomLabel.cy, k) };
}
function liveCam(t) {
  // ×1.10, pushing gently to ×1.16 by the card: the extra crop is what lets the framing keep the card left of x ≈ 845
  // (at ×1.10 alone it reaches 870) without ever showing a frame edge
  const s = G.live.s + G.live.push * ease(kk(t, A.live, A.card)), rr = Math.min(r(t), RUSH.liveR + RUSH.liveLen), half = 540 / s;
  const fx = cl(smoothCx(rr) - (G.live.screenCx - 540) / s, half, 1080 - half);
  return { s, fx, fy: 960, qx: 540, qy: 960 };
}
function cam(t) {
  let c = { s: 1, fx: 540, fy: 960, qx: 540, qy: 960 }, sx = 0, sy = 0;
  if (t >= A.stop && t < A.zoom) {                          // the STOP: a 3 % punch-in + a 10 px damped shake (6 frames)
    const p = easeOut(kk(t, A.stop, A.stop + .07)) * (1 - easeOut(kk(t, A.rew, A.rew + .2)));
    c.s = 1 + .03 * p;
    const d = (t - A.stop) * FPS; if (d >= 0 && d < 7) { const a = 10 * Math.exp(-d * .5) * Math.cos(d * 2.3); sx = a * .7; sy = a; }
  } else if (t >= A.zoom && t < A.ring) c = zoomCam(Math.pow(G.zoomLabel.s, ease(kk(t, A.zoom, A.ring))));   // ×1 → ×4, accelerates then slows
  else if (t >= A.ring && t < A.out) c = zoomCam(G.zoomLabel.s * lerpv(1, G.zoomLabel.sEnd / G.zoomLabel.s, kk(t, A.ring, A.out)));   // ×4.00 → ×4.12
  else if (t >= A.out && t < A.whip) c = zoomCam(Math.pow(G.zoomLabel.sEnd, 1 - ease(kk(t, A.out, A.whip))));   // dezoom ×4.12 → ×1 (.15 s)
  else if (t >= A.whip + .05 && t < A.cta) c = liveCam(t);                                                      // ×1.10, follows the label
  else if (t >= A.ctaFreeze) { const s = 1 + .04 * ease(kk(t, A.ctaFreeze, T.end)); c = { s, fx: LC.cx, fy: LC.cy, qx: LC.cx, qy: LC.cy }; }
  c.sx = sx; c.sy = sy; return c;
}
/** frame px → screen px under cam c */
const toScreen = (c, x, y) => [c.s * (x - c.fx) + c.qx + c.sx, c.s * (y - c.fy) + c.qy + c.sy];
/** the BONZINI label on screen for the picture at t: {x, y, w, h, cx, cy, ok, vis, gap, f} */
function label(t) {
  const f = frameOf(t), L = labelFrame(f), c = cam(t), [x, y] = toScreen(c, L.x, L.y);
  const w = L.w * c.s, h = L.h * c.s;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, ok: L.ok, vis: L.gap <= 6 && !rushHidden(t), gap: L.gap, f };
}
/** horizontal smear (screen px) of the whip pans, the rewind (2 heavy frames at the splice) and the whip back */
function smear(t) {
  let px = Math.max(34 * bump(t, A.pan1 - .02, A.pan1e + .02), 34 * bump(t, A.pan2 - .02, A.pan2e + .02));
  if (t >= A.rew && t < A.zoom) px = Math.max(px, 90 * Math.pow(Math.sin(Math.PI * kk(t, A.rew, A.zoom)), .7));
  // the splice: its 2 frames (the last before, the first after) are smeared hard; a half-frame ramp either side
  const s0 = A.splice - 1.5 / FPS, s1 = A.splice + .5 / FPS, out = t < s0 ? (s0 - t) * FPS : t >= s1 ? (t - s1) * FPS : 0;
  px = Math.max(px, 210 * cl(1 - 2 * out));
  px = Math.max(px, 150 * bump(t, A.whip - .01, A.live + .01));
  return px;
}
/** the HD zoom layer's opacity (crossfade from the full frame between ×1.4 and ×1.6, only on the r 1.00 freeze) */
function zoomLayer(t) { if (t < A.zoom || t >= A.whip + .05) return 0; return kk(cam(t).s, 1.4, 1.6); }

// ---------- module states ----------
/** chrono (M1, 20_chrono.js): ring empties 7 → 0 on the music grid, orange for 2-1-0, rolls 0 → 6 in the rewind */
function chrono(t) {
  if (t >= A.out + .2 || t < 0) return null;
  let digit, ring, roll = 0;
  if (t < A.stop) { const e = (t - A.chrono0) / SEC; digit = 7 - Math.floor(e); ring = cl(1 - e / 7); }
  else if (t < A.rew) { digit = 0; ring = 0; }
  else if (t < A.rew + .5) { const k = ease(kk(t, A.rew, A.rew + .5)); digit = 6 * k; ring = 6 / 7 * k; roll = 1; }
  else { digit = 6; ring = 6 / 7; }
  const warmOn = Math.min(kk(t, TICK(5) - .04, TICK(5) + .04), 1 - kk(t, A.rew + .2, A.rew + .4));
  let tick = -1; for (let k = 0; k <= 6; k++) if (t >= TICK(k) && t < A.stop) tick = k;
  const out = easeIn(kk(t, A.out, A.out + .2));
  return { ...G.chrono, digit, ring, roll, warm: warmOn, tick, tickAge: tick >= 0 ? t - TICK(tick) : 9,
    stopAge: t >= A.stop ? t - A.stop : -1, pulse: bump(t, A.pulse, A.pulse + .35), a: 1 - out, dy: -40 * out, loud: tick >= 5 ? 1 : 0 };
}
/** ellipse + arrow (M1, 30_ring.js) */
function ring(t) {
  if (t >= A.ring && t < A.whip) {
    const a = 1 - kk(t, A.out, A.out + .1);
    const arrow = { p: ease(kk(t, A.arrow, A.arrow + .35)), a: a * kk(t, A.arrow, A.arrow + .02), t0: A.arrow };
    return { mode: 'answer', box: label(t), draw: ease(kk(t, A.ring, A.ring + .40)), a, lw: 14, halo: easeOut(kk(t, A.ring + .2, A.ring + .6)), arrow, t0: A.ring };
  }
  if (t >= A.live && t < A.card + .05) {
    const b = label(t); if (!b.vis) return null;
    return { mode: 'follow', box: b, draw: ease(kk(t, A.live + .08, A.live + .38)), a: 1 - kk(t, A.card - .05, A.card + .05), lw: 8, halo: .5, arrow: null, t0: A.live + .08 };
  }
  if (t >= A.cta && t < T.end) {
    const b = label(t); if (!b.vis) return null;
    return { mode: 'recall', box: b, draw: ease(kk(t, A.cta + .1, A.cta + .4)), a: 1, lw: 7, halo: .4, arrow: null, t0: A.cta + .1 };
  }
  return null;
}
/** the kraft Bonzini card (M2, 72_card.js), A.card → A.cta (hard cut back to the rush at A.cta) */
function card(t) {
  if (t < A.card || t >= A.cta) return null;
  return {
    cover: ease(kk(t, A.card, A.card + .25)),                       // the kraft sheet rises 15.80 → 16.05 and covers the picture
    plate: kk(t, A.plate - .18, A.plate), plateLand: A.plate,       // the violet enamel plate drops, lands at A.plate (tonk)
    service: easeOut(kk(t, T.N5 - .05, T.N5 + .30)),                // « TES COLIS VONT / DE CHINE À DOUALA. »
    route: ease(kk(t, A.route, A.doua)),                             // the felt route: carton → dots → CHINE … DOUALA
    chine: kk(t, A.chine - .05, A.chine + .2), boat: backOut(kk(t, A.chine, A.chine + .28)),
    douala: kk(t, A.doua - .05, A.doua + .2), plane: backOut(kk(t, A.doua, A.doua + .28)),
    by: easeOut(kk(t, A.by, A.by + .3)),
    nod: t >= A.doua ? t - A.doua : -1,
    t0: A.card, t1: A.cta,
  };
}
/** the margouillat on the card (40_gecko.js through geckoShim): looks at the plate, the sentence, the route; nods on « Douala » */
function gecko(t) {
  const R = G.card.route; let target = { x: 540, y: 390 }, act = 'idle', k = 0, n = -1;
  if (t >= T.N5) target = { x: 540, y: 720 };
  if (t >= A.route) target = { x: R.carton.x, y: R.carton.y };
  if (t >= A.chine - .3) target = { x: R.chine.x, y: R.chine.y };
  if (t >= A.doua - .3) target = { x: R.douala.x, y: R.douala.y };
  if (t >= A.plate && t < A.plate + .45) { act = 'hop'; k = kk(t, A.plate, A.plate + .45); }
  if (t >= A.doua && t < A.doua + 1.0) { act = 'pushups'; k = kk(t, A.doua, A.doua + 1.0); }
  if (t >= A.doua + 1.0) act = 'smug';
  return { target, act, k, n };
}
function light() { return { x: 300, y: 300, on: 1, violet: 0, day: 1 }; }
/** adapter for the validated margouillat (40_gecko.js binds to window.SCORE at load; 39_/41_gecko_*shim.js swap it in) */
function geckoShim() {
  const far = -50;
  const T2 = { slam: A.plate, falls: [], rebounds: [], proof: far, crush: far, stamp: A.plate, check: A.doua,
    letters: [far, far, far], gulps: [far, far, far], endcard: far, hic: far + 1, end: T.end };
  const G2 = { gecko: G.gecko, cx: G.cx, amberY: 720, steelHigh: 390 };
  const p = { x: G.card.route.douala.x, y: G.card.route.douala.y };
  return { DUR: T.end, N, T: T2, G: G2, gecko, light, LETTER_REST: [p, p, p] };
}

// ---------- texts: [t0, t1, id, text, style, takeover, opt] ----------
// takeover = the module function that draws this text itself (then 60_type.js skips it); '|' = line break; *…* = emphasis
// (violet for BONZINI / Bonzini Trading — violet only with Bonzini —, bigger for BONSOIR). French typography: no-break
// spaces inside « » and before : ? !
const NB = ' ';
const TEXTS = () => [
  [0, A.ring, 'mention', `VRAIE VIDÉO · EN CHINE`, 'mention', null],
  [A.ring, A.out, 'mentionZoom', `VRAIE IMAGE · ZOOM × 4`, 'mention', null],
  [A.out, A.card, 'mention2', `VRAIE VIDÉO · EN CHINE`, 'mention', null],
  [A.cta, T.end + .01, 'mention3', `VRAIE VIDÉO · EN CHINE`, 'mention', null],
  [0, A.stop + .2, 'title1', 'TROUVE LE MOT', 'title1', null],
  [0, A.stop + .2, 'title2', 'BONZINI', 'title2', null],
  [A.hint, A.stop + .2, 'title3', 'écrit sur un colis', 'title3', null],
  [0, A.out + .2, 'chronoLabel', 'secondes', 'chrono', 'CH_chrono'],
  [A.sub1, A.sub1out, 'sub1', `«${NB}Bonsoir, bonsoir.${NB}»`, 'sub', null, { head: 'vraie voix', box: G.sub1, voice: 'R1' }],
  [A.stop, A.stopPeel + .14, 'stop', `STOP${NB}!`, 'stop', null],
  [A.question, A.ring, 'question', `TU L'AS VU${NB}?`, 'question', null],
  [A.answer, A.out + .2, 'answer', `LE MOT *BONZINI*|ÉTAIT LÀ|DÈS LE DÉBUT${NB}!`, 'answer', null],
  [A.hand, A.out + .2, 'hand', 'écrit à la main', 'hand', null],
  [A.sub2, A.sub2out, 'sub2', `«${NB}Merci de faire confiance|à *Bonzini Trading*.${NB}»`, 'sub', null, { head: 'vraie voix', box: G.sub2, voice: 'R2' }],
  [A.plate - .18, A.cta, 'plate', 'BONZINI TRADING CARGO', 'card', 'BZ_card'],
  [T.N5 - .05, A.cta, 'service', 'TES COLIS VONT|DE CHINE À DOUALA.', 'card', 'BZ_card'],
  [A.chine - .05, A.cta, 'routeChine', 'CHINE', 'card', 'BZ_card'],
  [A.doua - .05, A.cta, 'routeDouala', 'DOUALA', 'card', 'BZ_card'],
  [A.by, A.cta, 'by', 'Par bateau ou par avion.', 'card', 'BZ_card'],
  [A.sub3, T.end + .01, 'sub3', `«${NB}Bonsoir, bonsoir.${NB}»`, 'sub', null, { head: 'vraie voix', box: G.sub3, voice: 'R1b' }],
  [A.pill, T.end + .01, 'cta', `Réponds-lui en ${VARIANT === 'wa' ? 'message' : 'commentaire'}${NB}:|*BONSOIR*`, 'cta', null],
];

// ---------- sound (§5.6; names = the storyboard's sound column) ----------
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0, d, note) => { if (t >= 0 && t < T.end) { const c = { t: +t.toFixed(4), name, g, pan }; if (d !== undefined) c.d = +d.toFixed(4); if (note) c.note = note; Q.push(c); } };
  for (let k = 0; k <= 6; k++) q(TICK(k), 'tic_wood', k >= 5 ? 1.0 : .6, .25, undefined, `chrono ${7 - k} → ${6 - k}`);   // beats 1 and 3
  q(A.musicIn - .25, 'shaker_rise', .5, 0, .25, 'petite montée de shaker 1.75–2.00');
  q(A.pan1, 'whoosh', .6, -.4, A.pan1e - A.pan1 + .1, 'filé ×2'); q(A.pan2, 'whoosh', .6, .4, A.pan2e - A.pan2 + .1, 'filé retour');
  q(A.stop, 'stamp_big', 1, 0, undefined, 'tampon STOP (sfx_big_stamp)'); q(A.stop + .02, 'buzzer_soft', .5);
  q(A.rew, 'rewind', .8, 0, A.zoom - A.rew, 'synthetic tape rewind (sfx_rewind): noise / music fed, NEVER the rush');
  q(A.zoom, 'swell_rise', .5, 0, A.ring - A.zoom, 'souffle montant'); q(A.ring - .02, 'focus_click', .6);
  q(A.ring, 'bonzini_sig', 1, 0, undefined, 'balafon signature (= music().sigAt)');
  q(A.ring, 'felt', .5, 0, .40, 'ellipse au feutre'); q(A.arrow, 'felt', .4, .1, .35, 'flèche au feutre');
  q(A.out, 'whoosh_back', .6, 0, A.live - A.out);
  q(A.card, 'paper_lift', .7, 0, undefined, 'sfx_paper_lift'); q(A.plate, 'tonk', .8);
  q(A.route, 'felt', .35, -.2, .5, 'trajet au feutre'); q(A.chine, 'pop', .45, -.25, undefined, 'bateau'); q(A.chine + .03, 'felt', .3, -.2, .25);
  q(A.doua, 'pop', .45, .25, undefined, 'avion'); q(A.doua + .03, 'felt', .3, .2, .25);
  q(A.pill, 'pill_drop', .6, 0, undefined, 'sfx_pill_drop');
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa 120 bpm; the chrono tics fall on beats 1 and 3: grid0 is a downbeat, ticks = grid0 + k·1 s) */
function music() {
  return { bpm: BPM, beat: BEAT, grid0: A.musicIn, ticks: [0, 1, 2, 3, 4, 5, 6].map(TICK),
    silentUntil: A.musicIn, tenseFrom: A.musicIn, cut: A.stop, sigAt: A.ring, majorFrom: A.plate,
    motifAt: R6(A.cta - .45), end: A.cta, voiceEndN5: R6(END('N5')),
    noMusic: [[REAL.R2.t, REAL.R2.end], [A.cta, T.end]],              // never music under the real voices nor the call
    duck: { narrator: 12 }, streetOnlyFrom: R6(T.end - .30) };
}

// ---------- self-check (tools/check_score.js prints it) ----------
function check() {
  const W_ = [];
  if (END('N2') > 6.85 + 1e-6) W_.push(`N2 ends at ${END('N2').toFixed(2)} > 6.85: take a shorter N2 take`);
  if (END('N1') > T.N2 - .2 + 1e-6) W_.push(`N1 ends at ${END('N1').toFixed(2)}, too close to N2 (${T.N2.toFixed(2)})`);
  if (Math.abs(r(T.R2) - REAL.R2.src[0]) > 1e-6) W_.push('R2 lip sync');
  if (Math.abs(r(T.R1b) - REAL.R1b.src[0]) > 1e-6) W_.push('R1b lip sync');
  for (let t = A.rew; t < A.zoom; t += 1 / 240) { const rr = r(t); if (rr > RUSH.never[0] + 1e-6 && rr < RUSH.never[1] - 1e-6) { W_.push(`rewind shows r ${rr.toFixed(3)} at ${t.toFixed(3)}`); break; } }
  for (let t = 0; t < T.end; t += 1 / 240) { const rr = r(t), rr2 = r(t + 1 / 240); if (rr2 < rr - 1e-9 && !(t + 1 / 240 > A.rew - 1e-6 && t < A.zoom) && !(t + 1 / 240 >= A.whip) && !(t + 1 / 240 >= A.cta)) { W_.push(`r goes backwards at ${t.toFixed(3)} outside the rewind`); break; } }
  const ivals = [['N1'], ['N2'], ['N3'], ['N4'], ['N5'], ['N6']].map(([k]) => [T[k], END(k), k]).concat(Object.values(REAL).map(R => [R.speech[0], R.speech[1], R.id])).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ivals.length; i++) if (ivals[i][0] < ivals[i - 1][1] - 1e-6) W_.push(`voices overlap: ${ivals[i - 1][2]} / ${ivals[i][2]}`);
  return W_;
}

const SCORE = { FPS, N, T, DUR, DUR0, A, W, WE, END, SYL, RUSH, REAL, G, COL, BPM, BEAT, SEC, TICK, VARIANT,
  r, frameOf, frameOfR, rushNeed, shutter, CUTS, rushHidden, cam, toScreen, label, labelFrame, smear, zoomLayer, LBL,
  chrono, ring, card, gecko, light, geckoShim, TEXTS, soundCues, music, check,
  kk, ease, easeOut, easeIn, backOut, spr, bump, lerpv, cl };
if (!isNode) window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
