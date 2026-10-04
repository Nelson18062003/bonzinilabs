'use strict';
// =============================================================================================
// « LE BONNETEAU DU FEYMAN » — the score. ONE source of truth for picture AND sound.
// 480 frames = 16.0 s = 8 bars of 12/8 at dotted-quarter = 120. 1 beat = 15 f, 1 triplet eighth = 5 f.
// Everything here is a pure function of the frame number f (float allowed for motion blur) and is
// periodic: state(f) === state(f + 480). Loaded by the browser engine AND by node (tools/dump_score.mjs).
// =============================================================================================
const LOOP = 480, BEATF = 15, BARF = 60;
const fmod = f => ((f % LOOP) + LOOP) % LOOP;

// ---------- table geometry (screen px; oblique view from the player's side, high angle) ----------
// A container is a 10-ft box seen from the doors' end: roof (corrugated) on top, door face below.
// Table coordinates: x = screen x of the centre, y = screen y of the FRONT bottom edge on the table.
// z = lift above the table (screen px, upward).
const G = {
  slotX: [272, 540, 808], tableY: 1120,
  cw: 200, cd: 176, ch: 118,          // container width, roof depth (foreshortened), door face height
  pw: 122, pd: 100, ph: 72,            // parcel
  arcBack: 190, arcFront: 110,        // swap paths
  shoulder: { L: { x: 215, y: -140 }, R: { x: 865, y: -140 } },
  rest: { L: { x: 392, y: 724 }, R: { x: 700, y: 716 } },   // wrists resting behind the containers
  gecko: { x: 130, y: 1200 },
  bulb: { x: 520, y: 330 },          // where the bulb hangs (off the top of the light pool), for shadows
};
// grip point on a container roof (where a hand holds it), table coords → screen
const gripOf = (x, y, z) => ({ x, y: y - G.ch - G.cd * .55 - z });

// ---------- shuffle choreography ----------
// containers c0 c1 c2 start in slots 0 1 2. The parcel goes under c1 (slot 1 = « le 2 »).
// swaps: [startFrame, frames, slotA, slotB]
const SWAPS = [
  // A — 4 swaps of one beat (followable)
  [105, 15, 1, 2], [120, 15, 0, 1], [135, 15, 0, 2], [150, 15, 0, 1],
  // B — 4 swaps of 10 frames
  [165, 10, 1, 2], [175, 10, 0, 2], [185, 10, 0, 1], [195, 10, 1, 2],
  // (205-219: THE STEAL — no swap, c1 sits in slot 2 under the right hand)
  // C — 4 swaps of one triplet eighth (decoy: the parcel is already up the sleeve)
  [220, 5, 0, 2], [225, 5, 1, 2], [230, 5, 0, 1], [235, 5, 0, 2],
];
const STEAL = { f0: 205, tilt0: 207, slide0: 210, slide1: 218, f1: 220, glint: 210 };
const REVEAL = [ // [frame, slot, hand, frames up]
  [270, 0, 'L', 9], [285, 2, 'R', 9], [300, 1, 'L', 22],
];

// slot occupancy over time: slotOf[c] at frame f (integer, before/after swaps) and the moving pose during a swap
function shuffleState(f) {
  f = fmod(f);
  const slot = [0, 1, 2];
  let moving = null;
  for (const [s0, d, a, b] of SWAPS) {
    if (f >= s0 + d) { const ca = slot.indexOf(a), cb = slot.indexOf(b); slot[ca] = b; slot[cb] = a; continue; }
    if (f >= s0) moving = { s0, d, a, b, k: (f - s0) / d, ca: slot.indexOf(a), cb: slot.indexOf(b) };
    break;
  }
  return { slot, moving };
}
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const kk = (f, a, b) => Math.min(1, Math.max(0, (f - a) / (b - a)));

// containers: {x, y, z, tilt, rust} for c0..c2
function containers(f) {
  f = fmod(f);
  const { slot, moving } = shuffleState(f);
  const out = [0, 1, 2].map(c => ({ id: c, x: G.slotX[slot[c]], y: G.tableY, z: 0, tilt: 0 }));
  if (moving) {
    const { a, b, ca, cb } = moving;
    const k = ease(moving.k), dir = (moving.s0 / 5) % 2 ? 1 : -1;   // alternate which one passes behind
    const go = (c, from, to, side) => {
      const o = out[c]; o.x = G.slotX[from] + (G.slotX[to] - G.slotX[from]) * k;
      const arc = Math.sin(Math.PI * k) * (side > 0 ? G.arcFront : -G.arcBack);
      o.y = G.tableY + arc; o.z = Math.sin(Math.PI * k) * 10;
    };
    go(ca, a, b, dir); go(cb, b, a, -dir);
  }
  // opening: L lifts c1 (slot 1) so R can slide the parcel under; CLAC at f30
  if (f >= 14 && f < 31) { const c = out[1]; c.z = f < 22 ? 90 * easeOut(kk(f, 14, 21)) : 90 * (1 - ease(kk(f, 22, 30))); }
  // the steal: right hand tilts c1 (back edge up) — slot 2 at that time
  if (f >= STEAL.tilt0 && f < STEAL.f1) {
    const c = out[1]; const k = f < 214 ? easeOut(kk(f, STEAL.tilt0, 212)) : 1 - ease(kk(f, 214, 219));
    c.tilt = k; c.z = 8 * k;
  }
  // reveal lifts
  for (const [r0, s, , up] of REVEAL) {
    if (f < r0 || f >= r0 + up + 14) continue;
    const c = out[slot.indexOf(s)];
    const lift = f < r0 + up ? easeOut(kk(f, r0, r0 + up)) : 1 - ease(kk(f, r0 + up + 4, r0 + up + 13));
    c.z = Math.max(c.z, (s === 1 ? 150 : 120) * lift);
  }
  // after the reveal the containers sit a little off their marks; L squares them up 420-445
  if (f >= 315 && f < 446) {
    const off = [[-14, 10], [8, -12], [16, 6]];
    const k = f < 420 ? easeOut(kk(f, 315, 322)) : 1 - ease(kk(f, 420, 445));
    for (const o of out) { const s = slot[o.id]; o.x += off[s][0] * k; o.y += off[s][1] * k; }
  }
  return out;
}

// ---------- the parcel ----------
// returns {mode:'hand'|'glass'|'under'|'sleeve'|'slide', x, y, z, s (scale), squash, vis}
function parcel(f) {
  f = fmod(f);
  const c1 = containers(f)[1];
  if (f < 15) {                                     // out of the sleeve → up to the lens → THOK at f4
    const r = G.rest.R;
    if (f < 4) { const k = easeOut(f / 4); return { mode: 'rise', x: r.x + (540 - r.x) * k, y: r.y + 70 + (880 - r.y - 70) * k, s: .55 + (3.4 - .55) * k, squash: 0, vis: 1 }; }
    const sq = f < 6 ? kk(f, 4, 5.2) : 1 - kk(f, 10, 15);
    return { mode: 'glass', x: 540, y: 880, s: 3.4, squash: .18 * Math.min(1, sq * 1.2), vis: 1 };
  }
  if (f < 28) {                                     // back down, slid under the lifted c1
    const k = ease(kk(f, 15, 27));
    const tx = G.slotX[1], ty = G.tableY - G.cd * .5 - 4;
    return { mode: 'hand', x: 540 + (tx - 540) * k, y: 880 + (ty - 880) * k, s: 3.4 + (1 - 3.4) * ease(kk(f, 15, 22)), squash: 0, vis: 1 };
  }
  if (f < STEAL.slide0) return { mode: 'under', x: c1.x, y: c1.y - G.cd * .5 - 4, s: 1, vis: 0 };
  if (f < STEAL.slide1) {                           // 8 frames: pinched out over the roof's back edge, into the right cuff (screen coords)
    const k = kk(f, STEAL.slide0, STEAL.slide1 - .5);           // linear: it never rests, so it mostly reads as a blur
    const cuff = cuffOf('R', f), sx = c1.x - 26, sy = c1.y - G.ch - G.cd - c1.z - 14;
    return { mode: 'slide', x: sx + (cuff.x - sx) * k, y: sy + (cuff.y - sy) * k, s: .74 - .26 * k, squash: 0, vis: 1 };
  }
  return { mode: 'sleeve', vis: 0 };
}

// ---------- hands ----------
// pose names: rest, grip, tap, count3, count2, count1, flourish, slide, open, wave, beckon, dive, hold
// returns {x, y (wrist), rot, pose, s, holding, cuffIn (0 = hand out, 1 = withdrawn into the cuff), alpha}
function handKeys(side) {
  const K = [];   // [frame, target, pose]   target: {x,y} | {c: id, dx, dy} (grip on container c)
  const r = G.rest[side];
  if (side === 'R') {
    K.push([0, { x: 650, y: 820 }, 'hold'], [4, { x: 560, y: 880 }, 'hold'], [14, { x: 560, y: 880 }, 'hold'],
      [26, { x: G.slotX[1] + 50, y: 960 }, 'slide'], [32, r, 'rest'], [44, { c: 1, dx: 40, dy: -10 }, 'tap'], [58, { c: 1, dx: 40, dy: -10 }, 'tap'],
      [70, r, 'rest'], [92, r, 'grip']);
  } else {
    K.push([0, r, 'rest'], [11, { c: 1, dx: -10, dy: 0 }, 'grip'], [30, { c: 1, dx: -10, dy: 0 }, 'grip'], [40, r, 'rest'],
      [58, { x: 236, y: 690 }, 'count3'], [74, { x: 236, y: 690 }, 'count3'], [75, { x: 236, y: 690 }, 'count2'],
      [89, { x: 236, y: 690 }, 'count2'], [90, { x: 236, y: 690 }, 'count1'], [96, r, 'grip']);
  }
  // swaps: each hand grabs one of the two containers (choose the closer pairing), travels in the first 30 %
  for (const [s0, d, a, b] of SWAPS) {
    const { slot } = shuffleState(s0);
    const ca = slot.indexOf(a), cb = slot.indexOf(b);
    let left = G.slotX[a] < G.slotX[b] ? ca : cb, right = left === ca ? cb : ca;
    if (s0 === 195) { right = 1; left = ca === 1 ? cb : ca; }   // R must end on c1 for the steal: the hands cross
    const c = side === 'L' ? left : right;
    const pre = Math.max(2, Math.round(d * .3));
    K.push([s0 - pre, { c, dx: 0, dy: 0 }, 'grip'], [s0 + d - 1, { c, dx: 0, dy: 0 }, 'grip']);
    if (s0 === 195 && side === 'R') K.push([STEAL.f0, { c: 1, dx: 0, dy: 0 }, 'grip']);
  }
  if (side === 'R') K.push([STEAL.tilt0, { c: 1, dx: 6, dy: -6 }, 'slide'], [STEAL.slide1, { c: 1, dx: 18, dy: -26 }, 'slide'], [216, { c: 1, dx: 0, dy: 0 }, 'grip']);
  else K.push([STEAL.f0, { x: 420, y: 760 }, 'grip'], [STEAL.glint, { x: 250, y: 610 }, 'flourish'], [215, { x: 250, y: 616 }, 'flourish'], [219, { x: 430, y: 760 }, 'grip']);
  // reveal
  K.push([241, r, 'rest'], [265, r, 'rest']);
  for (const [r0, s, h, up] of REVEAL) if (h === side) {
    const { slot } = shuffleState(r0); const c = slot.indexOf(s);
    K.push([r0 - 4, { c, dx: 0, dy: 0 }, 'grip'], [r0 + up + 13, { c, dx: 0, dy: 0 }, 'grip']);
    if (r0 !== 300) K.push([r0 + up + 22, r, 'rest']);   // after the last lift, L goes straight into « voilà »
  }
  if (side === 'L') K.push([343, { x: 330, y: 820 }, 'open'], [357, { x: 330, y: 820 }, 'open']);
  else K.push([326, { x: 750, y: 820 }, 'open'], [334, { x: 760, y: 800 }, 'wave'], [356, { x: 760, y: 800 }, 'wave']);
  // brand moment: the violet light comes on, the feyman's arms flinch back into the dark
  K.push([362, { x: r.x, y: -260 }, 'rest'], [419, { x: r.x, y: -260 }, 'rest'], [428, r, 'rest']);
  if (side === 'L') K.push([430, { x: 330, y: 830 }, 'grip'], [446, { x: 330, y: 830 }, 'grip'], [455, r, 'rest']);
  else K.push([432, { x: 735, y: 760 }, 'beckon'], [452, { x: 735, y: 760 }, 'beckon'], [462, r, 'rest']);
  // last key = the frame-0 pose, so frame 480 is frame 0 (R: where the parcel-holding hand pops out of the cuff)
  K.push([LOOP, side === 'R' ? { x: r.x + 34 * .55, y: r.y + 70 - 52 * .55 } : r, side === 'R' ? 'hold' : 'rest']);
  return K.sort((p, q) => p[0] - q[0]);
}
const HK = { L: null, R: null };
function resolve(tg, f) {
  if (tg.c === undefined) return { x: tg.x, y: tg.y };
  const c = containers(f)[tg.c]; const g = gripOf(c.x, c.y, c.z); return { x: g.x + (tg.dx || 0), y: g.y + (tg.dy || 0) };
}
function hand(side, f) {
  f = fmod(f);
  const K = HK[side] || (HK[side] = handKeys(side));
  let i = 0; while (i < K.length - 1 && K[i + 1][0] <= f) i++;
  const [f0, t0, p0] = K[i], [f1, t1, p1] = K[Math.min(i + 1, K.length - 1)];
  const a = resolve(t0, f), b = resolve(t1, f);
  const k = f1 > f0 ? ease(kk(f, f0, f1)) : 0;
  const pose = k < .5 ? p0 : p1;
  const out = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, pose, k, cuffIn: 0, s: 1 };
  // the right hand retracts into its own sleeve at the very end, and pops out with the parcel at f0
  if (side === 'R') {
    if (f >= 466) out.cuffIn = ease(kk(f, 466, 477));
    if (f < 3) out.cuffIn = 1 - easeOut(kk(f, 0, 3));
    if (f < 28) { const pp = parcel(f); out.x = pp.x + 34 * pp.s; out.y = pp.y - 52 * pp.s; out.s = Math.max(1, pp.s * .82); out.pose = f < 21 ? 'hold' : 'slide'; }
    else if (f < 32) { const pp = parcel(27.99); const a = { x: pp.x + 34, y: pp.y - 52 }, k = ease(kk(f, 28, 32)); out.x = a.x + (G.rest.R.x - a.x) * k; out.y = a.y + (G.rest.R.y - a.y) * k; }
  }
  return out;
}
// wrist / cuff position (the sleeve opening the hand comes out of)
function cuffOf(side, f) { const h = hand(side, f); return { x: h.x + (side === 'R' ? 26 : -26), y: h.y - 64 * h.s }; }

// ---------- light ----------
// bulb sway (periodic over 2 s with a 16-s envelope); bulbOn: 1 = tungsten, 0 = off; violet: brand light
function light(f) {
  f = fmod(f); const t = f / 30;
  const amp = 22 + 30 * Math.max(0, Math.sin(Math.PI * (t - 3.5) / 4.5)) * (t > 3.5 && t < 8 ? 1 : 0);
  const sway = Math.sin(2 * Math.PI * t / 2) * amp;
  let on = 1, violet = 0;
  if (f >= 358 && f < 364) on = 1 - kk(f, 358, 363);
  if (f >= 364 && f < 420) on = 0;
  if (f >= 420 && f < 432) on = [0, 1, .2, 1, 1, .1, .8, 1, 1, 1, 1, 1][Math.floor(f) - 420];   // two flickers (< 3 per second)
  if (f >= 360 && f < 424) violet = f < 368 ? easeOut(kk(f, 360, 367)) : 1 - ease(kk(f, 418, 424));
  return { x: G.bulb.x + sway, y: G.bulb.y, on, violet };
}

// ---------- camera ----------
function camera(f) {
  f = fmod(f); const t = f / 30;
  let s = 1 + .02 * (.5 - .5 * Math.cos(2 * Math.PI * t / 16));
  if (f >= 240 && f < 420) s += .04 * (f < 270 ? ease(kk(f, 240, 270)) : 1 - ease(kk(f, 330, 420)));
  let sx = 0, sy = 0;
  const hit = (f0, amp, dur) => { if (f >= f0 && f < f0 + dur) { const d = f - f0; const a = amp * Math.exp(-d * .55) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(4, 7, 8); hit(90, 3, 6); for (const sw of SWAPS.filter(s => s[0] >= 165 && s[0] < 205)) hit(sw[0] + sw[1] - 1, 1.6, 4);
  return { s, cx: 540, cy: 980, sx, sy };
}

// ---------- texts (band y 1300-1500, except the brand moment) ----------
// [f0, f1, text, style]   styles: order (Satoshi 900 caps), tease (Bricolage), stamp (orange stamp), shake (trembling)
const TEXTS = [
  [3, 27, 'SUIS TA MARCHANDISE.', 'order'],
  [32, 59, 'Elle est sous le 2.', 'tease'],
  [60, 85, 'Ne cligne pas des yeux, mbom.', 'tease'],
  [87, 104, 'TU VAS PERDRE.', 'stamp'],   // slams over 3 frames: lands ON frame 90 (the cover frame, the stamp sound)
  [108, 138, 'Facile…', 'tease'],
  [165, 204, 'Plus vite.', 'shake'],
  [220, 239, 'PLUS VITE.', 'shake2'],
  [240, 269, 'Elle est sous lequel ?', 'order'],
  [272, 284, 'Vide.', 'tease'], [287, 299, 'Vide.', 'tease'], [304, 329, '…Vide.', 'tease'],
  [330, 344, 'Tu l’as vue partir ?', 'order'], [345, 359, 'Écris où. En UN mot.', 'order'],
  [420, 449, 'On rejoue ?', 'tease'],
  [450, 476, 'Cette fois, ne regarde pas la bague.', 'tease'],
];

// ---------- sound cues (for the audio engine) ----------
function soundCues() {
  const Q = [];
  const q = (f, name, g = 1) => Q.push({ f, t: +(f / 30).toFixed(4), name, g });
  q(4, 'thok'); q(30, 'clac'); q(18, 'cloth', .6); q(45, 'tap'); q(52, 'tap', .8);
  q(90, 'stamp');
  for (const [s0, d] of SWAPS) q(s0, s0 < 220 ? 'slide' : 'slide_fast', d >= 15 ? 1 : .8);
  q(STEAL.glint, 'ting'); q(STEAL.slide0 + 1, 'rustle', .12);
  for (const [r0, s] of REVEAL) q(r0 + 2, s === 1 ? 'tok_low' : 'tok');
  q(306, 'dust', .7); q(300, 'cricket', .5); q(333, 'mock');
  q(358, 'bulb_off'); q(360, 'shimmer'); q(372, 'ding'); q(387, 'ding'); q(402, 'ding');
  q(420, 'bulb_on'); q(423, 'bulb_on', .5); q(468, 'whoosh', .5);
  return Q.sort((a, b) => a.f - b.f);
}

const SCORE = { LOOP, BEATF, BARF, G, SWAPS, STEAL, REVEAL, TEXTS, containers, parcel, hand, cuffOf, light, camera, shuffleState, soundCues, fmod, kk, ease, easeOut };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
