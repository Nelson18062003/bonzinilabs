'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) — THE SCORE. One source of truth for picture AND sound.
// Kraft & Fil packing table (day), 1080×1920, 30 fps. Times in SECONDS (float: motion blur samples sub-frames).
//
// CONTRACT (serie/PIPELINE.md):
//   T[id]   = start of the SPEECH of voice line id (ids of data/script.json); T.end = film duration.
//   DUR[id] = speech duration of line id.         Both overwritten by data/timing.json (window.TIMING / require):
//             TIMING = { N1: s, …, end: s, dur: {N1: s, …}, words: {N1: [{w, s, e}], …} (word times RELATIVE to the
//             line start), A: {optional hand overrides of derived action times} }.
//   W(id, prefix, nth = 0, fb)  → absolute time of the nth word of line id starting with prefix (accent/case/elision
//             insensitive), else T[id] + fb.            WE(…) the same for the word END.
//   A       = every action time, DERIVED from T / W / DUR after the merge (no free-floating literal time).
//   Every object state below is a pure function of t. Deterministic. Loaded by the browser AND by node (audio cues):
//   node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.A, S.soundCues(), S.music())"
// =============================================================================================
(function () {                       // own scope: kit.js already declares FPS, W, H, C… as globals
const FPS = 30;
// ---------- voice keys (defaults = storyboard SERIE.md « Épisode 2 », ≈16 chars/s) ----------
const T = { N1: .1, T1: 2.4, N2: 4.2, N3: 9.1, T2: 12.0, N4: 15.3, N5: 18.8, N6: 21.3, N7: 24.4, N8: 29.3, end: 32.5 };
const DUR = { N1: 2.2, T1: 1.7, N2: 2.7, N3: 2.6, T2: 3.1, N4: 3.2, N5: 2.3, N6: 2.3, N7: 4.7, N8: 2.9 };
let WORDS = {}, TM = null;
if (typeof window !== 'undefined' && window.TIMING) TM = window.TIMING;
else if (typeof require !== 'undefined') { try { TM = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'timing.json'), 'utf8')); } catch (e) { } }
if (TM) { for (const k in TM) if (typeof TM[k] === 'number') T[k] = TM[k]; if (TM.dur) Object.assign(DUR, TM.dur); if (TM.words) WORDS = TM.words; }
const N = Math.round(T.end * FPS);

// ---------- word anchors ----------
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const forms = w => { const r = deacc(w); return [r.replace(/[^a-z0-9]/g, ''), r.replace(/^(?:[a-z]{1,2}|qu|jusqu)['’]/, '').replace(/[^a-z0-9]/g, '')]; };
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; const k = deacc(prefix).replace(/[^a-z0-9]/g, ''); let c = 0;
  for (const w of ws) if (forms(w.w).some(x => x.startsWith(k))) { if (c++ === nth) return w; }
  return null;
}
/** absolute START time of the nth word of line id beginning with prefix, else T[id] + fb */
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
/** absolute END time of that word, else T[id] + fb */
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + DUR[id];

// ---------- maths ----------
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - cl(x), 3);
const easeIn = x => x * x * x;
const backOut = (x, s = 1.7) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const lerpv = (a, b, k) => a + (b - a) * k;
/** damped spring response 0→1 */
function spr(t, w = 16, z = .45) { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
/** landing squash after an impact at t0: {sx, sy} */
function squash(t, t0, amt = .22, freq = 30, damp = 9) {
  if (t < t0) return { sx: 1, sy: 1 };
  const s = t - t0, q = Math.exp(-s * damp) * Math.cos(s * freq) * amt; return { sx: 1 + q * .8, sy: 1 - q };
}
const fall = (t, t1, dur, y0, y1) => lerpv(y0, y1, easeIn(kk(t, t1 - dur, t1)));
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;

// ---------- DERIVED ACTION TIMES (after the merge) ----------
const A = {};
// hook (0 → T1): the AIR cloud is already bursting out at frame 0, peaks 0.4 s into N1
A.hop = T.N1 + .05;                                   // the margouillat startles at the burst
A.burstPeak = T.N1 + .4;
A.titleOut = T.T1 - .25;                              // the orange title plate leaves as TOI's amber plate rises
A.toiUp = T.T1 - .1;
// N2: LE BATEAU crushes TOI's plate on « place », « AU m³ » stamps the carton on « cube »
A.bateauShadow = T.N2 + .15;
A.bateauFall = W('N2', 'place', 0, 1.0);
A.stampM3 = W('N2', 'cube', 0, 2.15);
// LA MESURE (silent): 3 tape snaps after N2, formula stamped; compressed if N3 comes early.
// QA (stage 3): the key plate « AU BATEAU, ON PAIE LA PLACE : LE MÈTRE CUBE. » is held ≥ 1.45 s after it lands on
// « place » (it was ≈ 1.0 s on the real N2 take); the silent measure starts .35 s after it leaves.
A.bateauOut = Math.max(END('N2') - .05, A.bateauFall + 1.45);
A.mes0 = A.bateauOut + .35;
const GAP = cl((T.N3 - .45 - A.mes0) / 2.8, .3, .5);
A.mes1 = A.mes0 + GAP; A.mes2 = A.mes0 + 2 * GAP; A.formula = A.mes0 + 2.8 * GAP;
// N3: the flank lifts, the void is hatched « VIDE », the cloud settles in it, pleased
A.flank = T.N3 - .1;
A.hatch0 = W('N3', 'carton', 0, .15) + .15;
A.vide = W('N3', 'vide', 0, 1.68);
A.hatch1 = Math.max(A.hatch0 + .6, A.vide - .1);
A.formulaOut = Math.max(A.hatch0 + .35, A.mes2 + 1.45);           // QA: the full formula is read ≥ 1.45 s
A.capVide = Math.max(A.hatch0 + .45, A.formulaOut + .18);          // QA: never cross-fades over the formula (same zone)
A.cloudSettle = A.vide + .2;
// T2: « It's a clock » — everything stops, the music cuts, TOI's small plate sweats
A.cut = T.T2 - .2;
A.toiSmall = T.T2 - .05;
A.toiSmallOut = T.N4 - .15;
// N4: the repack in 3 HELD poses under the fixed pill « CHEZ TON FOURNISSEUR »
A.repack = T.N4 - .15;
A.pose1 = W('N4', 'ton', 0, .55);                                   // the sandals line up head-to-tail
A.pose2 = Math.max(W('N4', 'cartons', 0, 1.6), A.pose1 + .75);       // the walls close in, smaller carton
A.pose3 = Math.max(W('N4', 'remplis', 0, 2.45), A.pose2 + .75);      // the kraft tape runs across
A.split = T.N5 - .1;                                                 // AVANT / APRÈS (music back, major)
A.chase = Math.min(A.pose3 + .2, A.split - .45);                    // the AIR cloud is chased out…
A.gulp = A.chase + .55;                                              // …and the margouillat gulps it
// N5: gauges (no figure)
A.gauge0 = T.N5 + .1; A.gauge1 = A.gauge0 + .7;
A.hic = A.gauge1 + .55;                                              // a tiny air burp
// N6: bubble-wrapped glass
A.splitOut = T.N6 - .15;
A.glass = T.N6 + .05;
A.wrap0 = W('N6', 'pas', 0, 1.2) - .15;
A.wrap1 = Math.max(A.wrap0 + .5, W('N6', 'protection', 0, 1.55) + .35);
// ENSUITE : (silent band), the fixed pill drops off
A.ensuite = END('N6') + .1;
A.ensuiteOut = Math.max(A.ensuite + .45, T.N7 - .05);
// N7: BONZINI — violet light, label, scan, tape, « VOLUME : • m³ », AIR struck, « MESURÉ ✓ », enamel plate
A.violet = Math.max(T.N7 - .15, A.ensuite + .25);                   // QA: violet never before the ENSUITE band (Bonzini only)
A.arrive = T.N7 - .1;
A.label = A.violet + .3;
A.sig = W('N7', 'bonzini', 0, .25) - .05;                           // balafon signature
A.plateBZ = W('N7', 'bonzini', 0, .25);
A.capBZ = W('N7', 'tes', 0, 1.7) - .1;
A.scan = W('N7', 'cartons', 0, 1.9);
A.tape = W('N7', 'sont', 0, 2.35) - .1;                           // the tape runs on « sont mesurés »
A.volume = Math.max(W('N7', 'mesures', 0, 2.55) + .1, A.tape + .3);
A.airStrike = A.volume + .3;
A.measured = Math.max(WE('N7', 'mesures', 0, 3.0) + .1, A.airStrike + .3);   // « MESURÉ ✓ » right after the word
// N8: end card, CTA on « Écris », ritual stamp on « Maintenant », loop
A.endcard = Math.max(T.N8 - .15, A.measured + 1.45);                // QA: « MESURÉ ✓ » is held ≥ 1.45 s
A.cta = Math.max(T.N8, A.endcard + .15);
A.stampEnd = W('N8', 'maintenant', 0, 1.9) - .1;
A.loop = T.end - .55;                                               // the big closed carton starts trembling
A.out = T.end - .12;                                                // texts gone: last frames = the trembling carton
if (TM && TM.A) Object.assign(A, TM.A);

// ---------- layout (world px = screen px at camera 1) ----------
const G = {
  cx: 540,
  chip: { x: 56, y: 184 },                       // series chip (screen), left edge x, centre y
  plateY: 420, plateW: 880,                      // text-plate zone (y 215–625)
  plateH: { title: 410, toi: 250, bateau: 360, toiSmall: 300 },
  capY: 430, capBZY: 602,                        // caption strips (screen): top zone; Bonzini line under the enamel plate
  pillFix: { x: 540, y: 262 },                   // « CHEZ TON FOURNISSEUR »
  carton: { x: 520, y: 1430, w: 600, h: 340, d: 300 },   // FOOT = middle of the front face's bottom edge (table contact)
  small: { w: 350, h: 220, d: 180 },
  cloud: { x: 565, y: 815 }, cloudAside: { x: 290, y: 850 },
  gecko: { x: 112, y: 1470 }, gulpAt: { x: 178, y: 1422 },
  split: { L: 290, R: 790, foot: 1330, sL: .52, sR: .92, labelY: 770, gaugeY: 880, gaugeL: 360, gaugeR: 150 },
  glass: { x: 800, y: 1330 }, smallN6X: 420,
  bz: { foot: { x: 470, y: 1425 }, s: 1.3, plateY: 330, readout: { x: 320, y: 850 }, air: { x: 820, y: 850 }, scanner: { x: 905, y: 1240 } },
  end: { logoY: 300, serviceY: 404, stampY: 676, ctaX: 540, ctaY: 908, loopS: .82 },
};
// oblique 3/4 view of a carton: front face w×h standing on its foot (x, y); the top face recedes up-right by d·OBL
const OBL = { x: .30, y: -.50 };
/** corners (world px) of a carton state: front FTL FTR FBR FBL, back-top BTL BTR, back-bottom-right BBR */
function cartonGeo(st) {
  const s = st.s ?? 1, w = st.w * s * (st.sx ?? 1), h = st.h * s * (st.sy ?? 1), d = st.d * s, x = st.x, y = st.y;
  const ox = d * OBL.x, oy = d * OBL.y;
  const FBL = [x - w / 2, y], FBR = [x + w / 2, y], FTL = [x - w / 2, y - h], FTR = [x + w / 2, y - h];
  return { FTL, FTR, FBR, FBL, BTL: [FTL[0] + ox, FTL[1] + oy], BTR: [FTR[0] + ox, FTR[1] + oy], BBR: [FBR[0] + ox, FBR[1] + oy],
    w, h, d, ox, oy, s, cx: x, cy: y - h / 2, top: [x + ox / 2, y - h + oy / 2] };
}

// ---------- the cartons ----------
// each: {id, x, y (foot), w, h, d, s, sx, sy, rot, a, flaps (0 shut → 1 wide open), lid (front flank lifted 0..1),
//        hatch (light-blue « VIDE » hatching sweep 0..1), vide (label 0..1), sandals (0 heaped in a corner → 1 head-to-tail,
//        tight), sandalsOn (interior visible), tape (kraft tape across the top 0..1), m3 (« AU m³ » ink 0..1, on the front
//        face), marks [3× 0..1] (felt lines of the measure on L, l, H), label (Bonzini sea label 0..1), shake 0..1, burst}
function sizeAt(k) { return { w: lerpv(G.carton.w, G.small.w, k), h: lerpv(G.carton.h, G.small.h, k), d: lerpv(G.carton.d, G.small.d, k) }; }
function heroCarton(t) {
  if (t >= A.endcard + .4) return null;
  const sq = easeOut(kk(t, A.pose2 - .08, A.pose2 + .22));            // walls close in (pose 2)
  const sz = sizeAt(sq);
  let x = G.carton.x, y = G.carton.y, s = 1, a = 1, rot = 0;
  // flaps: already flipping open at frame 0 (burst), wide open at the peak; shut at pose 2 (+.45)
  let flaps = lerpv(.78, 1, backOut(kk(t, -.05, A.burstPeak)));
  flaps *= 1 - ease(kk(t, A.pose2 + .3, A.pose2 + .55));
  // the burst jolt
  const bq = squash(t, -.08, .16, 26, 7);
  let shake = Math.exp(-Math.max(0, t) * 5) * .9;
  shake += .5 * Math.exp(-Math.max(0, t - A.bateauFall) * 8) * (t >= A.bateauFall ? 1 : 0);
  // the front flank lifts like a lid (N3), shuts after the squeeze; re-opened as a cut-away for AVANT / APRÈS
  let lid = backOut(kk(t, A.flank, A.flank + .4)) * (1 - ease(kk(t, A.pose2 + .25, A.pose2 + .5)));
  lid = Math.max(lid, ease(kk(t, A.split, A.split + .3)) * (1 - ease(kk(t, A.splitOut, A.splitOut + .25))));
  const hatch = ease(kk(t, A.hatch0, A.hatch1)) * (1 - sq);
  const vide = easeOut(kk(t, A.hatch0 + .5, A.hatch0 + .7)) * (1 - kk(t, A.pose2 - .1, A.pose2 + .1));
  const sandals = kk(t, A.pose1 - .1, A.pose1 + .2);                 // stop-motion module should step it (on twos)
  const tape = easeOut(kk(t, A.pose3 - .05, A.pose3 + .3));
  const m3 = t >= A.stampM3 ? 1 : 0, m3k = kk(t, A.stampM3 - .14, A.stampM3);
  const marks = [kk(t, A.mes0, A.mes0 + .2), kk(t, A.mes1, A.mes1 + .2), kk(t, A.mes2, A.mes2 + .2)];
  // N5: slides to the right half (APRÈS); N6: back left of the glass; N7: to the reception spot
  if (t >= A.split) { const k = ease(kk(t, A.split, A.split + .35)); x = lerpv(x, G.split.R, k); y = lerpv(y, G.split.foot, k); s = lerpv(1, G.split.sR, k); }
  if (t >= A.splitOut) { const k = ease(kk(t, A.splitOut, A.splitOut + .35)); x = lerpv(G.split.R, G.smallN6X, k); y = lerpv(G.split.foot, G.carton.y - 40, k); s = lerpv(G.split.sR, 1, k); }
  if (t >= A.ensuite) { const k = ease(kk(t, A.ensuite + .1, A.arrive + .2)); x = lerpv(G.smallN6X, G.bz.foot.x, k); y = lerpv(G.carton.y - 40, G.bz.foot.y, k); s = lerpv(1, G.bz.s, k); }
  if (t >= A.endcard) { const k = easeIn(kk(t, A.endcard, A.endcard + .4)); x += 900 * k; rot = .12 * k; }
  // pose holds: a little squash on each pose (stop-motion « clunk »)
  let sx = bq.sx, sy = bq.sy;
  for (const p of [A.pose1, A.pose2, A.pose3, A.arrive + .2]) { const q = squash(t, p + .2, .05, 30, 10); sx *= q.sx; sy *= q.sy; }
  const label = easeOut(kk(t, A.label, A.label + .15));
  return { id: 'hero', x, y, ...sz, s, sx, sy, rot, a, flaps, lid, hatch, vide, sandals, sandalsOn: lid > .02 ? 1 : 0, tape, m3, m3k,
    marks: t < A.flank ? marks : [0, 0, 0], label, shake: cl(shake), squeeze: sq, code: 'BZ-482913' };
}
/** AVANT: the big carton again, cut away, its void hatched (N5) */
function beforeCarton(t) {
  if (t < A.split - .05 || t >= A.splitOut + .4) return null;
  const kin = easeOut(kk(t, A.split - .05, A.split + .3)), kout = easeIn(kk(t, A.splitOut, A.splitOut + .35));
  return { id: 'before', x: lerpv(-300, G.split.L, kin) - 700 * kout, y: G.split.foot, ...sizeAt(0), s: G.split.sL, sx: 1, sy: 1, rot: 0, a: 1,
    flaps: 1, lid: 1, hatch: 1, vide: 1, sandals: 0, sandalsOn: 1, tape: 0, m3: 0, m3k: 0, marks: [0, 0, 0], label: 0, shake: 0, squeeze: 0 };
}
/** the loop: the big carton of frame 0, closed with kraft tape, back at its place for the end card; trembles at the end */
function loopCarton(t) {
  if (t < A.endcard + .15) return null;
  const k = easeOut(kk(t, A.endcard + .15, A.endcard + .6));
  const sh = kk(t, A.loop, T.end);
  const grow = ease(kk(t, A.loop, T.end)), s = lerpv(G.end.loopS, 1, grow);   // last beat: back to its frame-0 size and place
  return { id: 'loop', x: G.carton.x, y: G.carton.y + (1 - k) * 760, ...sizeAt(0), s, sx: 1, sy: 1, rot: 0, a: 1,
    flaps: 0, lid: 0, hatch: 0, vide: 0, sandals: 0, sandalsOn: 0, tape: 1, m3: 0, m3k: 0, marks: [0, 0, 0], label: 0,
    shake: .15 + .85 * sh * sh, tremble: sh, squeeze: 0, writeTag: easeOut(kk(t, A.cta + .35, A.cta + 1.15)) };
}
function cartons(t) { return [beforeCarton(t), heroCarton(t), loopCarton(t)].filter(Boolean); }
/** the hand-placed stop-motion jitter of a carton (changes on twos, amplitude from st.shake): EVERY module drawing on a
 *  carton (its label, the stamp, the tag line) applies the same offset: translate(j.x, j.y), rotate j.r about the foot */
function cartonJit(st, t) {
  const sd = { hero: 11, before: 13, loop: 17 }[st.id] || 7, s = Math.floor(t * 15), a = (st.shake || 0) * 3;
  const r = i => Math.sin(i * 12.9898 + 78.233) * 43758.5453 % 1;
  return { x: r(sd * 7.1 + s * 1.3) * 3 * a, y: r(sd * 3.7 + s * 2.1) * 3 * a, r: r(sd * 5.3 + s * .7) * .01 * a };
}

// ---------- the AIR cloud (hero) and its « À PAYER » tag ----------
// {x, y, s, sx, sy, rot, a, burst 0..1 (emerging puff), mood 'proud'|'content'|'nervous'|'fleeing', frozen, deflate 0..1,
//  inside (sits in the carton's void: draw it between the carton's back and front passes), tag {sw, a}}
function air(t) {
  if (t >= A.gulp + .08) return null;
  const C0 = G.cloud, geo = cartonGeo(heroCarton(Math.min(t, A.endcard)) || { x: G.carton.x, y: G.carton.y, ...sizeAt(0) });
  const mouth = { x: geo.top[0], y: geo.top[1] + 40 };
  const b = cl((t + .42) / (A.burstPeak + .42));                     // ≈ .5 at frame 0: already half out
  const bs = Math.sin(b * Math.PI / 2), pk = bump(t, A.burstPeak - .12, A.burstPeak + .32);   // ≈ .66 of the way at frame 0, a puff-up at the peak
  let x = lerpv(mouth.x, C0.x, bs), y = lerpv(mouth.y, C0.y, bs) - 14 * pk, s = lerpv(.55, 1, bs) * (1 + .07 * pk);
  let sx = 1, sy = 1, rot = 0, mood = 'proud', inside = false, deflate = 0, a = 1;
  const frozen = t >= A.cut && t < T.N4 - .2;
  const tb = frozen ? A.cut : t;                                    // « tout s'arrête »: the bob freezes too
  const bob = Math.sin(tb * 2.4) * 8, sway = Math.sin(tb * 1.7 + .6) * .03;
  y += bob * kk(t, A.burstPeak, A.burstPeak + .3); rot += sway;
  // jolts: TOI's plate, the crush, the stamp
  for (const [t0, amt] of [[A.toiUp, .06], [A.bateauFall, .16], [A.stampM3, .08]]) { const q = squash(t, t0, amt, 26, 8); sx *= q.sx; sy *= q.sy; }
  // the measure: it drifts aside (left), watching
  if (t >= A.mes0 - .4) { const k = ease(kk(t, A.mes0 - .4, A.mes0)); x = lerpv(x, G.cloudAside.x, k); y = lerpv(y, G.cloudAside.y, k); s = lerpv(s, .82, k); }
  // N3: it settles into the void, content
  const vd = { x: geo.FBL[0] + geo.w * .62, y: geo.FBL[1] - geo.h * .48 };
  if (t >= A.cloudSettle - .35) { const k = ease(kk(t, A.cloudSettle - .35, A.cloudSettle + .2)); x = lerpv(x, vd.x, k); y = lerpv(y, vd.y, k); s = lerpv(s, .5, k); mood = 'content'; inside = k > .6; }
  // N4: nervous while the sandals line up, squeezed out by the walls (pose 2), chased, gulped
  if (t >= A.pose1 - .1) mood = 'nervous';
  if (t >= A.pose2 - .05) {
    const k = easeOut(kk(t, A.pose2 - .05, A.pose2 + .3)); inside = k < .35;
    x = lerpv(vd.x, geo.top[0] + 40, k); y = lerpv(vd.y, 845, k); s = lerpv(.5, .62, k);
    const q = bump(t, A.pose2 - .05, A.pose2 + .3); sx *= 1 - .3 * q; sy *= 1 + .25 * q;
    x += Math.sin(t * 31) * 3 * kk(t, A.pose2 + .3, A.chase);            // trembling
  }
  if (t >= A.chase) {
    mood = 'fleeing'; const k = kk(t, A.chase, A.gulp - .04), e = ease(k);
    const p0 = { x: geo.top[0] + 40, y: 845 }, p1 = G.gulpAt;
    x = lerpv(p0.x, p1.x, e); y = lerpv(p0.y, p1.y, e) - Math.sin(Math.PI * e) * 140; s = lerpv(.62, .16, e); deflate = e;
    rot = -.5 * e;
  }
  if (t >= A.gulp - .04) { a = 1 - kk(t, A.gulp - .04, A.gulp + .08); s *= 1 - .7 * kk(t, A.gulp - .04, A.gulp + .08); }
  const sw = .14 * Math.exp(-Math.max(0, t - A.bateauFall) * 2) * Math.sin((t - A.bateauFall) * 8) * (t > A.bateauFall ? 1 : 0) + .05 * Math.sin(tb * 2.1);
  return { x, y, s, sx, sy, rot, a, burst: 1 - b, mood, frozen, deflate, inside, tag: { sw, a: 1 - deflate } };
}
/** the struck mini-cloud of the Bonzini sequence (« AIR » barré, the measured carton holds none) */
function airMini(t) {
  if (t < A.volume - .1 || t >= A.endcard) return null;
  const k = backOut(kk(t, A.volume - .1, A.volume + .2));
  return { x: G.bz.air.x, y: G.bz.air.y + Math.sin(t * 2.2) * 5, s: .42 * k, a: 1, strike: easeOut(kk(t, A.airStrike, A.airStrike + .2)) };
}

// ---------- the plates (thick cardboard) ----------
// {kind, x, y, s, sx, sy, rot, a, lines: [..], emph (index of the big line or -1), crush 0..1, sweat 0..1, shake 0..1}
const PLATE_TXT = {
  title: { lines: ['DANS CE CARTON,', 'TU PAIES', "DE L'AIR."], emph: 2 },           // orange, « DE L'AIR. » 170 px
  toi: { lines: ['MAIS MON CARTON', 'EST LÉGER !'], emph: -1 },                       // amber (TOI)
  bateau: { lines: ['AU BATEAU, ON PAIE', 'LA PLACE :', 'LE MÈTRE CUBE.'], emph: 1 }, // thick kraft-grey, pill « LE BATEAU »
  toiSmall: { lines: ["…J'AI PAYÉ LE BATEAU", 'POUR TRANSPORTER', "DE L'AIR ?!"], emph: -1 }, // amber, small, sweating
};
function plates(t) {
  const out = [], Y = G.plateY;
  // title: at rest from frame 0 (a last settle), leaves up-left as TOI's plate rises
  if (t < A.titleOut + .32) {
    const q = squash(t, -.12, .12, 24, 7), k = easeIn(kk(t, A.titleOut, A.titleOut + .3));
    out.push({ kind: 'title', ...PLATE_TXT.title, x: G.cx - 700 * k, y: Y - 260 * k, s: 1, sx: q.sx, sy: q.sy, rot: -.35 * k, a: 1, crush: 0, sweat: 0, shake: 0 });
  }
  // TOI: pops up (rebound), trembles under the incoming shadow, crushed on « place »
  if (t >= A.toiUp && t < A.bateauFall + .5) {
    let s = backOut(kk(t, A.toiUp, A.toiUp + .3), 2.4), sx = 1, sy = 1;
    const shake = kk(t, A.bateauShadow, A.bateauFall) * .6;
    const crush = ease(kk(t, A.bateauFall, A.bateauFall + .12));
    if (crush > 0) { sy = lerpv(1, .18, crush); sx = lerpv(1, 1.18, crush); }
    out.push({ kind: 'toi', ...PLATE_TXT.toi, x: G.cx, y: Y + (G.plateH.toi / 2) * (1 - sy) * .8, s, sx, sy, rot: 0, a: 1 - kk(t, A.bateauFall + .3, A.bateauFall + .5), crush, sweat: 0, shake });
  }
  // LE BATEAU: falls on « place », squashes, holds; leaves before the measure
  if (t >= A.bateauFall - .2 && t < A.bateauOut + .3) {
    let y = t < A.bateauFall ? fall(t, A.bateauFall, .2, -420, Y) : Y; const q = squash(t, A.bateauFall, .16);
    const k = easeIn(kk(t, A.bateauOut, A.bateauOut + .3));
    out.push({ kind: 'bateau', ...PLATE_TXT.bateau, x: G.cx + 900 * k, y, s: 1, sx: q.sx, sy: q.sy, rot: .2 * k, a: 1, crush: 0, sweat: 0, shake: 0 });
  }
  // TOI, small and sweating (T2)
  if (t >= A.toiSmall && t < A.toiSmallOut + .3) {
    const s = backOut(kk(t, A.toiSmall, A.toiSmall + .35), 1.6) * (1 - easeIn(kk(t, A.toiSmallOut, A.toiSmallOut + .3)));
    out.push({ kind: 'toiSmall', ...PLATE_TXT.toiSmall, x: G.cx, y: Y + 20, s: .86 * s, sx: 1, sy: 1, rot: 0, a: 1, crush: 0,
      sweat: kk(t, A.toiSmall + .4, A.toiSmall + 1.2), shake: .35 });
  }
  return out;
}
/** the plate's text, for the letters that gush out when it is crushed */
const plateText = kind => PLATE_TXT[kind];

// ---------- the measure (silent) ----------
// tape(t) → null | {edges: [{name, p0, p1, k (tape extended 0..1), mark (felt line 0..1), on}], cur, head [x,y]}
const EDGE_NAMES = ['LONGUEUR', 'LARGEUR', 'HAUTEUR'];
function tape(t) {
  if (t < A.mes0 - .25 || t >= A.formulaOut) return null;
  const g = cartonGeo(heroCarton(t));
  const E = [[g.FBL, g.FBR, [0, 30]], [g.FTR, g.BTR, [26, 8]], [g.FBR, g.FTR, [30, 0]]];
  const times = [A.mes0, A.mes1, A.mes2];
  let cur = -1, head = null;
  const edges = E.map(([p0, p1, off], i) => {
    const t0 = times[i], ext = easeOut(kk(t, t0 - .2, t0)), back = easeIn(kk(t, t0 + .18, t0 + .3));
    const k = ext * (1 - back);
    if (t >= t0 - .2 && t < t0 + .3) { cur = i; head = [lerpv(p0[0], p1[0], k) + off[0], lerpv(p0[1], p1[1], k) + off[1]]; }
    return { name: EDGE_NAMES[i], p0: [p0[0] + off[0], p0[1] + off[1]], p1: [p1[0] + off[0], p1[1] + off[1]], k, mark: kk(t, t0 + .02, t0 + .2), on: t >= t0 ? 1 : 0, t0 };
  });
  return { edges, cur, head };
}
/** the formula: words appear on each snap (stamped), the whole is boxed at A.formula; « le carton entier » written */
function formula(t) {
  if (t < A.mes0 - .05 || t >= A.formulaOut + .2) return null;
  return { words: [A.mes0, A.mes1, A.mes2].map(t0 => kk(t, t0, t0 + .1)), box: kk(t, A.formula, A.formula + .1), sub: kk(t, A.formula + .1, A.formula + .55),
    a: 1 - kk(t, A.formulaOut, A.formulaOut + .2) };
}

// ---------- AVANT / APRÈS, the glass ----------
function split(t) {
  if (t < A.split - .05 || t >= A.splitOut + .4) return null;
  const k = easeOut(kk(t, A.split - .05, A.split + .3)) * (1 - easeIn(kk(t, A.splitOut, A.splitOut + .35)));
  return { k, x: G.cx, gaugeL: ease(kk(t, A.gauge0, A.gauge1)), gaugeR: ease(kk(t, A.gauge0, A.gauge0 + .45)), labels: k };
}
function glass(t) {
  if (t < A.glass - .05 || t >= A.ensuite + .35) return null;
  const k = backOut(kk(t, A.glass - .05, A.glass + .3)) * (1 - easeIn(kk(t, A.ensuite, A.ensuite + .35)));
  return { x: G.glass.x, y: G.glass.y, s: k, wrap: ease(kk(t, A.wrap0, A.wrap1)), pop: t >= A.wrap1 ? kk(t, A.wrap1, A.wrap1 + .6) : 0 };
}

// ---------- Bonzini ----------
function band(t) {                                  // « ENSUITE : » kraft band (screen space), slides across, leaves
  if (t < A.ensuite - .1 || t >= A.ensuiteOut + .25) return null;
  return { in: easeOut(kk(t, A.ensuite - .1, A.ensuite + .15)), out: easeIn(kk(t, A.ensuiteOut, A.ensuiteOut + .25)) };
}
function bzPlate(t) {                               // the violet enamel plate « BONZINI TRADING CARGO »
  if (t < A.plateBZ - .22 || t >= A.endcard + .3) return null;
  let y = t < A.plateBZ ? fall(t, A.plateBZ, .22, -260, G.bz.plateY) : G.bz.plateY; const q = squash(t, A.plateBZ, .08, 26, 9);
  const k = easeIn(kk(t, A.endcard, A.endcard + .3));
  return { x: G.cx, y: y - 500 * k, s: 1, sx: q.sx, sy: q.sy, rot: 0, a: 1, sweep: kk(t, A.plateBZ + .1, A.plateBZ + .8) };
}
function bz(t) {                                    // the reception: scan, tape, readout, struck AIR, MESURÉ ✓
  if (t < A.violet - .1 || t >= A.endcard + .3) return null;
  const C0 = heroCarton(Math.min(t, A.endcard - .01));
  return {
    carton: C0, geo: C0 ? cartonGeo(C0) : null,
    scanner: { x: G.bz.scanner.x + 300 * (1 - easeOut(kk(t, A.scan - .45, A.scan - .1))), y: G.bz.scanner.y, k: easeOut(kk(t, A.scan - .45, A.scan - .1)) * (1 - kk(t, A.tape + .4, A.tape + .7)) },
    beam: (t >= A.scan && t < A.scan + .55) ? 1 : 0, beep: A.scan + .05,
    tape: easeOut(kk(t, A.tape - .05, A.tape + .3)) * (1 - easeIn(kk(t, A.volume + .4, A.volume + .55))),
    readout: easeOut(kk(t, A.volume - .1, A.volume + .15)), air: airMini(t), measured: kk(t, A.measured - .12, A.measured),
    out: easeIn(kk(t, A.endcard, A.endcard + .3)),
  };
}
function endcard(t) {
  if (t < A.endcard) return null;
  return { k: easeOut(kk(t, A.endcard, A.endcard + .35)), service: easeOut(kk(t, A.endcard + .25, A.endcard + .55)),
    cta: kk(t, A.cta, A.cta + .25), stamp: kk(t, A.stampEnd - .12, A.stampEnd), tag: easeOut(kk(t, A.cta + .35, A.cta + 1.15)),
    out: kk(t, A.out, T.end) };
}

// ---------- texts: [t0, t1, id, text, style, takeover] ----------
// takeover = name of the module function that draws this text itself (then the type layer skips it); '|' = line break;
// *…* = emphasis (orange). Captions/bands/end card live in screen space (60_type.js), stamps/readouts in the world.
const TEXTS = () => [
  [A.mes0 - .05, A.formulaOut + .2, 'formula', 'LONGUEUR|× LARGEUR|× HAUTEUR', 'formula', 'CA_measure'],
  [A.formula + .1, A.formulaOut + .2, 'formulaSub', 'le carton entier', 'formulaSub', 'CA_measure'],
  [A.stampM3 - .14, A.flank + .15, 'm3', 'AU m³', 'stampM3', 'CA_carton'],
  [A.capVide, T.T2 + .05, 'capVide', 'LE *VIDE*,|TU LE PAIES AUSSI.', 'caption', null],
  [T.N4 - .05, A.split - .05, 'capN4', 'DEMANDE À TON FOURNISSEUR :|^DES CARTONS|^*BIEN REMPLIS*.', 'caption', null],
  [A.split + .05, A.splitOut + .1, 'avantApres', 'AVANT|APRÈS', 'splitLabels', 'CA_split'],
  [T.N5 - .05, T.N6 - .1, 'capN5', 'MOINS DE VIDE|= *MOINS DE m³*', 'caption', null],
  [T.N6 - .05, A.ensuite, 'capN6', 'ENLÈVE LE VIDE,|*PAS LA PROTECTION*.', 'caption', null],
  [A.ensuite - .1, A.ensuiteOut + .25, 'ensuite', 'ENSUITE :', 'band', 'BZ_band'],
  [A.capBZ, A.endcard, 'capBZ', 'TES CARTONS, *MESURÉS*|DÈS LA RÉCEPTION EN CHINE', 'captionBZ', null],
  [A.volume - .1, A.endcard, 'volume', 'VOLUME : • m³', 'readout', 'BZ_scene'],
  [A.measured - .12, A.endcard, 'measured', 'MESURÉ', 'stampCheck', 'BZ_scene'],
  [A.endcard, A.out, 'brand', 'Bonzini Trading Cargo', 'brand', 'BZ_end'],
  [A.endcard + .25, A.out, 'service', 'Groupage mer et air · Chine → Douala|Entrepôt : Foyer Balengou', 'service', 'BZ_end'],
  [A.stampEnd - .12, A.out, 'stampEnd', 'MAINTENANT,|TU SAIS.', 'stampEnd', 'BZ_end'],
  [A.cta, A.out, 'cta', 'Écris CBM en commentaire', 'cta', 'BZ_end'],
  [A.cta + .35, A.out, 'tag', 'Tague celui qui|remplit ses cartons|de papier', 'tagHand', 'BZ_end'],
];
/** speaker / role pills (world, follow their plate): {who: 'toi'|'bateau'|'fournisseur', x, y, a, rot} */
function pills(t) {
  const out = [];
  for (const P of plates(t)) {
    const hh = G.plateH[P.kind] / 2 * P.s * P.sy;
    if (P.kind === 'toi') out.push({ who: 'toi', x: P.x, y: P.y + hh + 36, a: kk(t, A.toiUp + .2, A.toiUp + .35) * (1 - kk(t, A.bateauFall - .1, A.bateauFall)) });
    if (P.kind === 'toiSmall') out.push({ who: 'toi', x: P.x, y: P.y + hh + 34, a: kk(t, A.toiSmall + .25, A.toiSmall + .4) * P.s / .86 });
    if (P.kind === 'bateau') out.push({ who: 'bateau', x: P.x + 170, y: P.y - G.plateH.bateau / 2 * P.sy - 22, a: kk(t, A.bateauFall + .05, A.bateauFall + .2), rot: P.rot });
  }
  if (t >= A.repack && t < A.ensuite + .45) {     // the fixed pill: CHEZ TON FOURNISSEUR; drops off at ENSUITE
    const k = easeOut(kk(t, A.repack, A.repack + .2)), d = easeIn(kk(t, A.ensuite, A.ensuite + .4));
    out.push({ who: 'fournisseur', x: G.pillFix.x - 80 * d, y: G.pillFix.y + 900 * d * d, a: k, rot: -.5 * d, fixed: 1 });
  }
  return out;
}

// ---------- light / camera ----------
function light(t) {
  const v = ease(kk(t, A.violet, A.violet + .4)) * (1 - .55 * ease(kk(t, A.endcard, A.endcard + .5))) * (1 - kk(t, A.out - .2, T.end));
  return { x: 300, y: 300, on: 1, violet: v, day: 1 };
}
function camera(t) {
  let s = 1 + .05 * ease(kk(t, 0, A.toiUp)) - .05 * ease(kk(t, A.toiUp, A.toiUp + .5)), cx = 540, cy = 900;
  // T2: everything stops, a slow push onto TOI's small plate
  const p = ease(kk(t, A.cut, T.N4 - .3)) * (1 - ease(kk(t, T.N4 - .3, T.N4 + .2)));
  s += .07 * p; cy = lerpv(cy, G.plateY + 120, p);
  let sx = 0, sy = 0;
  const hit = (t0, amp, dur = .25) => { if (t >= t0 && t < t0 + dur) { const d = (t - t0) * 30; const a = amp * Math.exp(-d * .5) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(-.05, 7); hit(A.bateauFall, 12); hit(A.stampM3, 6); hit(A.mes0, 2); hit(A.mes1, 2); hit(A.mes2, 2); hit(A.formula, 4);
  hit(A.pose1 + .2, 2); hit(A.pose2 + .2, 3); hit(A.pose3 + .2, 2); hit(A.plateBZ, 6); hit(A.measured, 5); hit(A.stampEnd, 7);
  return { s, cx, cy, sx, sy };
}

// ---------- the margouillat ----------
// {target:{x,y}, act:'idle'|'hop'|'tennis'|'squint'|'gulp'|'hic'|'pushups'|'smug', k, n}
function gecko(t) {
  let target = { x: G.cloud.x, y: G.cloud.y }, act = 'idle', k = 0, n = -1;
  if (t >= A.hop && t < A.hop + .45) { act = 'hop'; k = kk(t, A.hop, A.hop + .45); }
  if (t >= A.toiUp && t < A.mes0 - .3) target = { x: G.cx, y: G.plateY + 60 };
  if (t >= A.stampM3 - .1 && t < A.mes0 - .3) target = { x: G.carton.x, y: G.carton.y - 160 };
  if (t >= A.mes0 - .3 && t < A.formula + .3) {                    // the snaps: a little tennis match on the tape's head
    act = 'tennis'; const tp = tape(t); if (tp && tp.head) target = { x: tp.head[0], y: tp.head[1] };
    else target = { x: G.carton.x, y: G.carton.y - 160 };
  }
  if (t >= A.formula + .3 && t < A.cut) target = { x: G.carton.x + 60, y: G.carton.y - 150 };     // the void
  if (t >= A.cut && t < T.N4 - .2) { act = 'squint'; target = { x: G.cx, y: G.plateY + 40 }; }      // TOI's small plate
  if (t >= T.N4 - .2 && t < A.chase) target = { x: G.carton.x + 40, y: G.carton.y - 220 };
  if (t >= A.chase && t < A.gulp - .15) { const c = air(t); if (c) target = { x: c.x, y: c.y }; }
  if (t >= A.gulp - .15 && t < A.gulp + .35) { act = 'gulp'; n = 0; k = kk(t, A.gulp - .15, A.gulp + .35); }
  if (t >= A.gulp + .35 && t < A.violet) target = { x: G.cx, y: G.split.gaugeY + 200 };
  if (t >= A.hic && t < A.hic + .4) { act = 'hic'; k = kk(t, A.hic, A.hic + .4); }
  if (t >= A.violet && t < A.measured) target = { x: G.bz.foot.x + 80, y: G.bz.foot.y - 150 };
  if (t >= A.measured && t < A.measured + 1) { act = 'pushups'; k = kk(t, A.measured, A.measured + 1); target = { x: G.bz.readout.x, y: G.bz.readout.y }; }
  if (t >= A.measured + 1) { act = 'smug'; target = { x: G.cx, y: G.end.stampY }; }
  return { target, act, k, n };
}
/** adapter for the validated « PAS REÇU. » lizard (40_gecko.js reads window.SCORE at load): its beat names → ours */
function geckoShim() {
  const T2 = {
    slam: A.hop, falls: [A.mes0, A.mes1, A.mes2], rebounds: [A.mes0 + .25, A.mes1 + .25, A.mes2 + .25],
    proof: A.cut, crush: A.bateauFall - .4, stamp: A.stampM3, check: A.measured,
    letters: [A.formula - .22, A.plateBZ - .22, A.stampEnd - .22],          // flinches: formula stamp, enamel plate, end stamp
    gulps: [A.gulp, T.end + 50, T.end + 51], endcard: A.gulp - .25, hic: A.hic, end: T.end,
  };
  const G2 = { gecko: G.gecko, cx: G.cx, amberY: G.carton.y - 20, steelHigh: G.carton.y - G.carton.h - 60 };
  return { DUR: T.end, N, T: T2, G: G2, gecko, light, LETTER_REST: [G.gulpAt, { x: G.cx, y: G.split.gaugeY + 200 }, G.gulpAt] };
}

// ---------- sound (names = the storyboard's sound column) ----------
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => { if (t >= 0 && t < T.end) Q.push({ t: +t.toFixed(4), name, g, pan }); };
  q(0, 'pouf_air'); q(.02, 'carton_creak', .7); q(A.burstPeak - .1, 'kaching_soft', .55, -.2); q(A.hop, 'gecko_skitter', .35, -.6);
  q(A.toiUp, 'boing', .6); q(A.bateauShadow, 'whoosh_low', .4); q(A.bateauFall, 'boum_carton'); q(A.bateauFall + .03, 'letters_splash', .7);
  q(A.stampM3, 'stamp');
  [A.mes0, A.mes1, A.mes2].forEach((m, i) => { q(m, 'clac', .9, -.2 + .2 * i); q(m + .04, 'felt', .45); }); q(A.formula, 'stamp', .8);
  q(A.flank, 'paper_lift', .7); q(A.hatch0, 'fill_fffff', .6); q(A.vide, 'tic', .6);
  q(A.cut, 'music_cut'); q(A.cut + .1, 'cricket', .5); q(A.toiSmall + 1.1, 'sweat_drop', .7); q(A.toiSmall + 2.1, 'sweat_drop', .5);
  q(A.pose1, 'carton_fold', .8); q(A.pose2, 'cutter', .7); q(A.pose2 + .05, 'carton_fold', .8); q(A.pose2 + .1, 'pffuit', .6); q(A.pose3, 'scotch_scriiitch', 1.1);
  q(A.chase, 'pffuit', .8, -.3); q(A.gulp, 'gloup', .9, -.6); q(A.hic, 'hic', .5, -.6);
  q(A.split, 'whoosh', .5); q(A.gauge0, 'gauge_fill', .4, -.3); q(A.gauge0 + .05, 'gauge_fill', .3, .3);
  q(A.glass, 'pop_soft', .5, .3); q(A.wrap0 + .1, 'bubble_wrap', .6, .3); q(A.wrap1, 'bubble_plop', .8, .3);
  q(A.ensuite, 'whoosh', .8); q(A.ensuite + .05, 'pill_drop', .4);
  q(A.violet, 'violet_hum', .4); q(A.sig, 'bonzini_sig'); q(A.plateBZ, 'tonk', .8); q(A.label, 'label_slap', .5);
  q(A.scan, 'bip', .8, .3); q(A.tape, 'tape_measure', .8); q(A.volume, 'tic', .6); q(A.airStrike, 'marker_strike', .6, .3); q(A.measured, 'stamp');
  q(A.endcard, 'whoosh_soft', .5); q(A.cta, 'pop', .7); q(A.stampEnd, 'stamp_big'); q(A.loop, 'carton_rattle', .6);
  q(T.end - .5, 'final_chord'); q(T.end - .02, 'cut_dry');
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa, pas-recu/lib/makossa.py): silent hook, tense, dead cut on TOI's realisation, major after */
function music() { return { silentUntil: A.toiUp - .1, tenseFrom: A.toiUp - .1, cut: A.cut, majorFrom: A.split, sigAt: A.sig, end: T.end }; }

const SCORE = { FPS, N, T, DUR, A, W, WE, G, OBL, cartonGeo, cartonJit, cartons, heroCarton, beforeCarton, loopCarton, air, airMini, plates, plateText,
  tape, formula, split, glass, band, bzPlate, bz, endcard, TEXTS, pills, light, camera, gecko, geckoShim, soundCues, music,
  kk, ease, easeOut, easeIn, backOut, spr, squash, lerpv, cl };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
