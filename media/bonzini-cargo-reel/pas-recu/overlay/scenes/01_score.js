'use strict';
// =============================================================================================
// « PAS REÇU. » — the score. ONE source of truth for picture AND sound. 22.0 s = 660 frames at 30 fps,
// makossa 120 BPM (beat 0.5 s, bar 2 s). Times in SECONDS. Every key moment lives in T (re-timed on the
// real voice takes by tools/retime.js → data/timing.json, loaded by render.mjs as window.TIMING).
// Plate states are pure functions of t. Loaded by the browser AND by node (audio cues).
// =============================================================================================
(function () {                       // own scope: kit.js already declares FPS, W, H… as globals
const FPS = 30;
const T = {
  // voices (start times; the audio engine places the takes here)
  T1: .15, T2: 1.55, T3: 3.05, T4: 4.05, T5: 6.0, T6: 15.5, N1: 8.05, N2: 9.4, N3: 11.0, N4: 13.1, N5: 16.8, N6: 20.1,
  // action
  shadow0: 0, slam: 1.20, amberForm: 1.55, amberUp: 2.0, day0: 1.6,
  falls: [2.5, 3.5, 4.5], rebounds: [3.0, 4.0, 5.0],
  proof: 5.5, gars: 5.9, crush: 8.0, rewind: 9.3, rewindEnd: 9.8, violetIn: 10.9, unfold: 12.9, stamp: 13.5,
  letters: [13.9, 14.25, 14.6], check: 15.0, settle: 15.3, clink: 15.9, endcard: 16.6, gulps: [17.5, 18.0, 18.5], hic: 19.0, cta: 20.0,
  end: 22,
};
if (typeof window !== 'undefined' && window.TIMING) Object.assign(T, window.TIMING);
else if (typeof require !== 'undefined') { try { Object.assign(T, JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'timing.json'), 'utf8'))); } catch (e) { } }
const DUR = T.end, N = Math.round(DUR * FPS);

// ---------- layout (screen px) ----------
const G = {
  cx: 540, tableEdge: 584,
  amberY: 1250, steelHigh: 840, steelSusp: 700, proofY: 985, violetY: 1000,
  sub: { x: 540, y: 1250 },                     // the opening subtitle sits where the amber plate will be
  pillToi: { dy: 118 }, pillSup: { dy: 132 },   // speaker pills under their plate (offset from the plate centre)
  days: { x: 292, y: 300 }, label: { x: 812, y: 650 },        // days: stamped in the night zone, clear of the plates
  band: { y: 470 }, logo: { y: 262 }, slogan: { y: 380 }, cta: { y: 1470 },
  gecko: { x: 112, y: 1420 },
  plateH: { steel: 236, amber: 186, proof: 196, violet: 300 },   // nominal heights (modules may refine)
};

// ---------- maths ----------
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const kk = (t, a, b) => cl((t - a) / (b - a));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - cl(x), 3);
const easeIn = x => x * x * x;
const lerpv = (a, b, k) => a + (b - a) * k;
/** damped spring response 0→1 */
function spr(t, w = 16, z = .45) { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
/** landing squash after an impact at t0: returns {sx, sy} */
function squash(t, t0, amt = .22, freq = 30, damp = 9) {
  if (t < t0) return { sx: 1, sy: 1 };
  const s = t - t0, q = Math.exp(-s * damp) * Math.cos(s * freq) * amt; return { sx: 1 + q * .8, sy: 1 - q };
}
/** gravity fall from y0 to y1 over dur, ending exactly at t1 */
const fall = (t, t1, dur, y0, y1) => lerpv(y0, y1, easeIn(kk(t, t1 - dur, t1)));
const lastBefore = (arr, t) => { let r = -1; for (let i = 0; i < arr.length; i++) if (arr[i] <= t) r = i; return r; };

// ---------- the plates ----------
// each returns null (hidden) or {x, y, s (scale), sx, sy, rot, a (alpha), ...extra}
function steel(t) {
  if (t < T.slam - .16) return null;
  const amberTop = () => { const A = amber(t); return A ? A.y - G.plateH.amber / 2 * A.s * A.sy : G.amberY; };
  let y, sq = { sx: 1, sy: 1 }, rot = 0, extra = {};
  const restOnAmber = () => amberTop() - G.plateH.steel / 2 + 6;
  if (t < T.slam) y = fall(t, T.slam, .16, -260, G.sub.y);
  else if (t < T.amberUp) {                       // crushed the subtitle; the regrouping letters lift it onto the amber plate
    const restFull = G.amberY - G.plateH.amber / 2 - G.plateH.steel / 2 + 6;
    y = lerpv(G.sub.y, restFull, ease(kk(t, T.amberForm, T.amberForm + .45))); sq = squash(t, T.slam, .26); rot = -.015 * Math.exp(-(t - T.slam) * 4);
  }
  else if (t < T.falls[0] - .18) {                // the amber plate shoves it up, trembling with effort
    const restFull = G.amberY - G.plateH.amber / 2 - G.plateH.steel / 2 + 6;
    const k = ease(kk(t, T.amberUp, T.amberUp + .45)); y = lerpv(restFull, G.steelHigh, k); rot = .02 * Math.sin(t * 40) * (1 - k);
  }
  else if (t < T.proof) {
    const i = lastBefore(T.falls, t + .18), j = lastBefore(T.rebounds, t);
    const fallT = T.falls[i], rebT = T.rebounds[i];
    if (j >= i && t >= rebT) { const k = spr(t - rebT, 13, .5); y = lerpv(restOnAmber(), G.steelHigh, k); }
    else if (t < fallT) y = fall(t, fallT, .18, G.steelHigh, restOnAmber());
    else { y = restOnAmber(); sq = squash(t, fallT, .14); }
  }
  else if (t < T.crush) { const k = easeOut(kk(t, T.proof, T.proof + .25)); y = lerpv(G.steelHigh, G.steelSusp, k); }
  else if (t < T.rewind) { const k = ease(kk(t, T.crush, T.crush + .4)); y = lerpv(G.steelSusp, restOnAmber(), k); sq = t > T.crush + .4 ? squash(t, T.crush + .4, .08) : sq; }
  else if (t < T.rewindEnd) { const k = ease(kk(t, T.rewind, T.rewindEnd)); y = lerpv(restOnAmber(), G.steelSusp, k); extra.rewind = 1; }
  else if (t < T.settle) {
    y = G.steelSusp + 6 * Math.sin((t - T.rewindEnd) * 2.4);
    if (t >= T.stamp) { const d = t - T.stamp; y -= 34 * Math.exp(-d * 7) * Math.cos(d * 22); sq = squash(t, T.stamp, .1); }
  }
  else { const k = spr(t - T.settle, 7, .55); y = lerpv(G.steelSusp + 6 * Math.sin((T.settle - T.rewindEnd) * 2.4), restOnAmber(), k); }
  // after the stamp: cracks, letters P A S fall out one by one, the rest re-centres, violet paint, tick
  extra.crack = kk(t, T.stamp, T.stamp + .35);
  extra.lost = T.letters.filter(x => t >= x).length;                       // 0..3 letters gone (P, A, S in that order)
  extra.recentre = ease(kk(t, T.letters[2] + .05, T.check - .02));             // « REÇU. » slides to the centre
  extra.paint = ease(kk(t, T.stamp + .5, T.check));                      // violet paint flows from the impact point
  extra.tick = easeOut(kk(t, T.check, T.check + .12));                   // ✓ stamped at the right
  extra.shadow = 1;
  return { x: G.cx, y, s: 1, sx: sq.sx, sy: sq.sy, rot, a: 1, txt: 'PAS REÇU.', ...extra };
}
function amber(t) {
  if (t < T.amberForm + .3) return null;                                 // before: the subtitle letters (letters module)
  let s = easeOut(kk(t, T.amberForm + .3, T.amberForm + .45)) * (1 + .12 * Math.exp(-(t - T.amberForm - .45) * 8));
  let sx = 1, sy = 1, txt = "J'AI PAYÉ !", sweat = 0, shake = 0, y = G.amberY;
  if (t >= T.amberUp && t < T.falls[0]) shake = 1 - kk(t, T.amberUp + .4, T.falls[0]);  // effort while pushing the steel up
  if (t >= T.rebounds[0]) txt = "J'AI PAYÉ !!";
  if (t >= T.rebounds[1]) txt = "J'AI PAYÉ !!!";
  const grow = t >= T.rebounds[1] ? 1.16 : t >= T.rebounds[0] ? 1.08 : 1;
  s *= grow;
  for (const f of T.falls) if (t >= f && t < f + .6) { const q = squash(t, f, .2); sx = q.sx; sy = q.sy; }
  for (const r of T.rebounds) if (t >= r - .08 && t < r + .1) { sy *= 1 + .1 * Math.sin(Math.PI * kk(t, r - .08, r + .1)); }
  if (t >= T.proof && t < T.rewind) {                                       // the awkward moment: shrinks and sweats
    s = lerpv(grow, .6, easeOut(kk(t, T.proof, T.proof + .35))); sweat = kk(t, T.proof + .3, T.proof + .8); shake = .25;
    if (t >= T.crush) { const k = ease(kk(t, T.crush + .05, T.crush + .45)); sy = lerpv(1, .25, k); sx = lerpv(1, 1.25, k); }
  }
  if (t >= T.rewind) {                                                      // rewind: re-inflates, calm
    const k = ease(kk(t, T.rewind, T.rewindEnd)); s = lerpv(.6, 1, k); sy = lerpv(.25, 1, k); sx = lerpv(1.25, 1, k); sweat = 1 - k;
    txt = t < T.rewind + .25 ? "J'AI PAYÉ !!!" : "J'AI PAYÉ.";
    if (t >= T.settle) { const q = squash(t, T.settle + .3, .06); sx *= q.sx; sy *= q.sy; }
  }
  return { x: G.cx, y, s, sx, sy, rot: 0, a: 1, txt, sweat, shake, shadow: 1, rewind: t >= T.rewind && t < T.rewindEnd ? 1 : 0 };
}
function proofPlate(t) {
  if (t < T.proof - .14 || t >= T.crush + .4) return null;
  let y = G.proofY, x = G.cx, sq = { sx: 1, sy: 1 };
  if (t < T.proof) y = fall(t, T.proof, .14, -200, G.proofY); else sq = squash(t, T.proof, .18);
  if (t >= T.crush) x = lerpv(G.cx, 1500, easeIn(kk(t, T.crush, T.crush + .35)));
  return { x, y, s: 1, sx: sq.sx, sy: sq.sy, rot: t >= T.crush ? .1 * kk(t, T.crush, T.crush + .35) : 0, a: 1, txt: 'LA PREUVE ?', shadow: 1 };
}
// the Bonzini enamel plate, which unfolds into the receipt
function violetPlate(t) {
  if (t < T.violetIn - .3) return null;
  let y, sq = { sx: 1, sy: 1 };
  if (t < T.violetIn) y = lerpv(-180, G.violetY, ease(kk(t, T.violetIn - .3, T.violetIn)));       // soft drop
  else { y = G.violetY - 14 * Math.exp(-(t - T.violetIn) * 6) * Math.abs(Math.sin((t - T.violetIn) * 9)); sq = squash(t, T.violetIn, .05); }
  const unfold = ease(kk(t, T.unfold, T.unfold + .4));                     // 0 = enamel plate, 1 = full receipt
  let rx = G.cx, ry = y, rs = 1;
  if (t >= T.unfold + .4) ry = lerpv(y, 960, easeOut(kk(t, T.unfold + .4, T.stamp)));             // rises to stamp the steel from below
  if (t >= T.stamp) { const d = t - T.stamp; ry = 960 + 18 * (1 - Math.exp(-d * 9)); }
  if (t >= T.settle) {                                                       // shrinks and pins to the amber plate's corner
    const k = ease(kk(t, T.settle, T.settle + .6)); rx = lerpv(G.cx, 826, k); ry = lerpv(978, G.amberY + 122, k); rs = lerpv(1, .29, k);   // hangs off the amber plate's corner: hides nothing
  }
  return { x: rx, y: ry, s: rs, sx: sq.sx, sy: sq.sy, rot: t >= T.settle ? .09 * ease(kk(t, T.settle, T.settle + .6)) : 0, a: 1,
    unfold, pinned: t >= T.settle + .6 ? 1 : 0, sweep: kk(t, T.violetIn + .1, T.violetIn + .8), shadow: 1 };
}

// ---------- texts (bands, pills, stamps, labels, end card) ----------
// [t0, t1, id, text, style]  styles handled by the type module
const TEXTS = () => [
  [0, T.slam, 'sub', "J'ai payé mon fournisseur.", 'subtitle'],
  [T.gars, T.crush, 'gars', "…LE GARS M'A DIT QUE C'EST FAIT.", 'gars'],
  [T.crush, T.rewind, 'band1', 'QUAND TU PAIES SANS PREUVE, C’EST ÇA.', 'bandDark'],
  [T.rewind, T.unfold, 'band2', 'LA MÊME COMMANDE, AVEC L’APPLI BONZINI :', 'bandCream'],
  [T.settle, T.endcard, 'band3', 'TU AS LA PREUVE.', 'bandCream'],
  [T.endcard, DUR + 1, 'slogan', 'PAIE TES FOURNISSEURS|CHINOIS EN XAF.|AVEC LA PREUVE.', 'slogan'],
  [T.cta, DUR + 1, 'cta', 'Écris REÇU en commentaire', 'cta'],
  [T.cta, DUR + 1, 'url', 'bonzinilabs.com', 'url'],
  [0, T.proof, 'label', 'Boutique · Mboppi', 'label'],          // leaves before the steel is hung up there
];
const DAYS = () => [[T.day0, 'LUNDI'], [T.falls[0], 'MARDI'], [T.falls[1], 'MERCREDI'], [T.falls[2], 'JEUDI']];
function day(t) {             // the day stamp exists only in the « before »; it is wiped at the rewind
  if (t < T.day0 || t >= T.rewind + .15) return null;
  let cur = null; for (const [d, s] of DAYS()) if (t >= d) cur = { s, t0: d };
  return { ...cur, a: t >= T.rewind ? 1 - kk(t, T.rewind, T.rewind + .15) : 1 };
}
// speaker pills follow their plate
function pills(t) {
  const out = [];
  const A = amber(t), S = steel(t), P = proofPlate(t);
  if (t >= .1 && t < T.slam) out.push({ who: 'toi', x: G.sub.x, y: G.sub.y + 104 });   // under the 2-line subtitle
  if (A) out.push({ who: 'toi', x: A.x, y: A.y + G.plateH.amber / 2 * A.s * A.sy + 36, a: kk(t, T.amberForm + .35, T.amberForm + .5) });
  if (S && t >= T.slam + .15) out.push({ who: 'sup', x: S.x, y: S.y - G.plateH.steel / 2 * S.sy - 30, a: kk(t, T.slam + .15, T.slam + .3) });   // always above the steel: below, it would sit on the amber plate
  if (P) out.push({ who: 'sup', x: P.x, y: P.y + G.plateH.proof / 2 + 30 });
  return out;
}

// ---------- light / camera ----------
function light(t) {
  const sway = Math.sin(2 * Math.PI * t / 2.6) * 18;
  const violet = t < T.rewind ? 0 : t < T.settle ? easeOut(kk(t, T.rewind, T.rewind + .6)) : lerpv(1, .55, ease(kk(t, T.settle, T.settle + 1)));
  return { x: 520 + sway, y: 330, on: 1, violet };
}
function camera(t) {
  let s = 1 + .04 * ease(kk(t, 0, T.slam));
  if (t >= T.slam) s = 1.04 - .04 * ease(kk(t, T.slam, T.slam + .5));
  if (t >= T.proof && t < T.crush + .3) s += .06 * ease(kk(t, T.proof, T.crush)) * (1 - kk(t, T.crush, T.crush + .3));
  let sx = 0, sy = 0;
  const hit = (t0, amp, dur = .2) => { if (t >= t0 && t < t0 + dur) { const d = (t - t0) * 30; const a = amp * Math.exp(-d * .55) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(T.slam, 11); T.falls.forEach(f => hit(f, 6)); hit(T.proof, 4); hit(T.crush + .4, 5); hit(T.stamp, 10); hit(T.check, 2);
  return { s, cx: 540, cy: 1060, sx, sy };
}

// ---------- the margouillat ----------
// {target:{x,y}, act:'idle'|'hop'|'tennis'|'squint'|'pushups'|'gulp'|'hic'|'smug', k (0..1 progress of the act), n (gulp index)}
function gecko(t) {
  const A = amber(t), S = steel(t);
  let target = { x: G.sub.x, y: G.sub.y }, act = 'idle', k = 0, n = -1;
  if (t >= T.slam && t < T.slam + .45) { act = 'hop'; k = kk(t, T.slam, T.slam + .45); }
  if (t >= T.slam + .45 && t < T.proof) {                    // tennis: watch whichever plate is moving
    act = 'tennis';
    const i = lastBefore(T.falls.concat(T.rebounds).sort((a, b) => a - b), t);
    const ev = T.falls.concat(T.rebounds).sort((a, b) => a - b);
    const isFall = i >= 0 && T.falls.includes(ev[i]);
    target = isFall || !S ? (A ? { x: A.x, y: A.y } : target) : { x: S.x, y: S.y };
  }
  if (t >= T.proof && t < T.crush + .5) { act = 'squint'; target = A ? { x: A.x, y: A.y } : target; }
  if (t >= T.rewind && t < T.stamp) target = { x: G.cx, y: G.violetY };
  if (t >= T.stamp && t < T.check) target = { x: 320, y: 1330 };
  if (t >= T.check && t < T.check + 1) { act = 'pushups'; k = kk(t, T.check, T.check + 1); target = S ? { x: S.x, y: S.y } : target; }
  for (let i = 0; i < 3; i++) if (t >= T.gulps[i] - .15 && t < T.gulps[i] + .35) { act = 'gulp'; n = i; k = kk(t, T.gulps[i] - .15, T.gulps[i] + .35); }
  if (t >= T.hic && t < T.hic + .4) { act = 'hic'; k = kk(t, T.hic, T.hic + .4); }
  if (t >= T.hic + .4) act = 'smug';
  return { target, act, k, n };
}
// where the fallen letters wait for the lizard (table, left), in gulp order P, A, S
const LETTER_REST = [{ x: 262, y: 1352 }, { x: 318, y: 1368 }, { x: 372, y: 1384 }];

// ---------- sound cues (for the audio engine) ----------
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => Q.push({ t: +t.toFixed(4), name, g, pan });
  q(.35, 'fall_whistle'); q(T.slam, 'boum'); q(T.slam + .02, 'aie', .7); q(T.slam + .05, 'marbles', .8);
  DAYS().forEach(([d]) => q(d + .02, 'day_stamp', .32));
  T.falls.forEach(f => { q(f, 'clac'); q(f + .01, 'ding_msg', .55); }); T.rebounds.forEach(r => q(r, 'slap'));
  q(T.amberUp, 'creak', .6); q(T.proof, 'cut'); q(T.proof + .05, 'clac', .8); q(T.proof + .2, 'cricket', .5); q(T.proof + 1.3, 'plic', .7);
  q(T.crush, 'squish'); q(T.crush + .6, 'mock'); q(T.rewind, 'rewind'); q(T.rewind + .3, 'riser', .7);
  q(T.violetIn - .1, 'bonzini_sig'); q(T.violetIn + .05, 'tonk'); q(T.unfold, 'paper', .8); q(T.stamp, 'big_stamp');
  T.letters.forEach((l, i) => q(l, 'clink', .8, -.3 - .2 * i)); q(T.check, 'major'); q(T.clink, 'buddy');
  T.gulps.forEach(g => q(g, 'gloup', .8, -.5)); q(T.hic, 'hic', .6, -.5); q(T.cta, 'pop', .7); q(DUR - .5, 'final_chord');
  return Q.sort((a, b) => a.t - b.t);
}

const SCORE = { FPS, N, DUR, T, G, steel, amber, proofPlate, violetPlate, TEXTS, day, pills, light, camera, gecko, LETTER_REST, soundCues, kk, ease, easeOut, spr, squash };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
