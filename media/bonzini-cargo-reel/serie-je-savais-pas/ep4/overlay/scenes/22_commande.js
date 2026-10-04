'use strict';
// =============================================================================================
// M1 « TA COMMANDE & the fake message » · 22_commande.js — TA COMMANDE, the talking parcel (the only object that speaks
// in the whole series). No face, no arms: it acts with its whole body (squash-and-stretch on the syllables, anticipation,
// overshoot, settle) and throws little cream « shout lines » off its top corners on every syllable it says.
// Functions only (no registerScene). Reads SCORE (01_score.js), the light API (02_light.js) and P_parcel (20_props.js).
//
//   CM_pose(P, t) → P'          P = SCORE.parcel(t). Returns a modified COPY; x, y, s, mode, ribbon, bzLabel, inside are
//                               kept (the pills, the gecko and the container read the score's path), only the acting
//                               changes: z (lift), sx / sy (squash-stretch about the foot — about the face centre on the
//                               phone glass, through a z / x compensation), rot. Beats, all from SCORE.A / SCORE.T / talk:
//       glass  frame 0 = max press (+ a centred impact wobble); between the strong syllables (A.presses) one side peels
//              off the glass first (alternating tilt) and the face swells a little on every syllable of C1;
//       air    peeling off the glass at A.dezoom: stretched along the fall, a twist, then the landing squash at A.land;
//       table  breathing at rest; a nervous tremble (on twos) that grows while TOI falls for it (A.toiTxt1 → A.jump);
//              the interruption: crouch → stretched leap (leaning into it) → big squash at A.jumpLand, then the jolt of
//              TOI's plate at A.bonk; talking hops on every word of C2 / C3 / C4 / C5 (anticipation crouch read from the
//              talk envelope 70 ms ahead, landing squash 110 ms behind; bigger on PATRON, ATTENDS, PAS, FOURNISSEUR,
//              APPELLE, NUMÉRO, CONNAIS, DÉJÀ, FAUX, MESSAGE, DOUALA); the step aside at A.aside (crouch, hop, settle); the 3 joy
//              jumps A.joy (crouch, stretch, tilt left / tilt right / a wiggle in the air, squash);
//              the crouch before the leap into the container (A.leap), stretched flight, squash inside at A.enter;
//       inside talking hops (small), the crouch before it pops out for the loop (A.loop0);
//       lens   the loop: launched with a stretch, a tumble that settles to 0, and at the last frame the frame-0 pose
//              (rot 0, sx = sy = 1, squash from the score) so frame 0 is the THOK.
//   CM_parcel(P, t, L)          the body (character transform already applied by compose): P_parcel with the hand-written
//                               label « TA|COMMANDE » and the kraft → violet ribbon (P.ribbon), plus on the phone glass the
//                               pressure creases of the flattened face, and the shout lines (P.talk) off its top corners.
//   CM_parcelShadow(P, t, L)    its shadow on the cloth (world): footprint of the box base (widened by sx), offset and
//                               softened by the lift — the effective lift adds (s − G.pS)·150 so the big parcel coming
//                               back from the glass casts a faint, far, soft shadow that sharpens as it lands — plus a
//                               tight contact shadow at rest. Not called on the glass / at the lens / inside.
// Deterministic (rnd on frame-quantised indices), no ctx.filter. Cost ≈ P_parcel (1–3 ms) + ≈ 0.3 ms.
// =============================================================================================
const CM_ = (function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, TAU = Math.PI * 2;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const ease = S.ease, easeOut = S.easeOut;
  const deacc = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const EMPH = /^(patron|attend|pas$|fournisseur|appelle|numero|connais|deja|faux|message|douala)/;   // v2: « ouf » → « faux message »
  /** damped landing squash after t0 (same law as the score's): {sx, sy} */
  const squash = (t, t0, amt, freq = 28, damp = 8) => {
    if (t < t0) return { sx: 1, sy: 1 };
    const s = t - t0, q = Math.exp(-s * damp) * Math.cos(s * freq) * amt; return { sx: 1 + q * .8, sy: 1 - q };
  };
  /** anticipation crouch before a take-off at t0 (0 → 1 → released through t0) */
  const crouch = (t, t0, d = .14) => {
    if (t < t0 - d || t > t0 + .06) return 0;
    return t < t0 - .02 ? sst(kk(t, t0 - d, t0 - .02)) : 1 - kk(t, t0 - .02, t0 + .06);
  };
  const pulse = (t, t0, att = .045, rel = .3) => t < t0 ? 0 : t < t0 + att ? (t - t0) / att : Math.exp(-(t - t0 - att) / rel * 2.2);
  const q2 = t => Math.floor(Math.round(t * 30) / 2);          // on twos (sub-frames of one frame agree)

  /** the parcel's syllable hops while it speaks: {z, sx, sy, k} */
  function hops(t, scale = 1) {
    const s = S.speaking(t, 'cm'); const k = s ? s.k : 0;
    if (!s && S.talk(t + .07) <= 0 && S.talk(t - .11) <= 0) return { z: 0, sx: 1, sy: 1, k: 0 };
    const kf = S.talk(t + .07), kb = S.talk(t - .11);
    const ant = cl((kf - k) * 1.4) * (1 - k), land = cl((kb - k) * 1.2) * (1 - k);
    const e = s && EMPH.test(deacc(s.w)) ? 1 : 0, H = (20 + 18 * e) * scale;
    return { z: H * Math.pow(k, .85), sy: 1 + (.1 + .04 * e) * k - .14 * ant - .1 * land, sx: 1 - (.06 + .03 * e) * k + .1 * ant + .08 * land, k };
  }
  /** a hop from t0 to t1 with an arc of height H: {z, sx, sy, k} (crouch before, stretch on the way up, squash after) */
  function leap(t, t0, t1, H, o = {}) {
    let z = 0, sx = 1, sy = 1;
    const c = crouch(t, t0, o.crouch || .14); sy *= 1 - (o.cAmt || .18) * c; sx *= 1 + (o.cAmt || .18) * .7 * c;
    const k = kk(t, t0, t1);
    if (t > t0 && t < t1) {
      z = H * Math.sin(Math.PI * k);
      const st = Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - .5 * k);   // stretched leaving the ground, rounder at the top
      sy *= 1 + (o.st || .22) * st; sx *= 1 - (o.st || .22) * .55 * st;
    }
    const q = squash(t, t1, o.land || .24, o.freq || 28, o.damp || 8); sx *= q.sx; sy *= q.sy;
    return { z, sx, sy, k };
  }

  // =============================================================================================
  // ACTING
  // =============================================================================================
  function pose(P, t) {
    if (!P || !P.vis) return P;
    const Q = { ...P };
    const s = P.s || 1, sq = cl(P.squash || 0, 0, .5), hh = G.ph * s * (1 + .22 * sq) / 2;   // half the front face (screen px)
    // ---------------------------------------------------------------- 1. on the phone glass (hook)
    if (P.mode === 'glass') {
      let pr = 0, idx = 0;
      A.presses.forEach((p, i) => { const v = pulse(t, p, .045, .3); if (v > pr) { pr = v; idx = i; } });
      if (t < .1) { pr = 1; idx = 0; }
      const off = 1 - pr, side = idx % 2 ? 1 : -1;
      let sx = 1, sy = 1, rot = side * .045 * off;                         // one side peels off the glass first
      for (const p of A.presses) { const q = squash(t, p, p === A.thok ? .06 : .045, 34, 10); sx *= q.sx; sy *= q.sy; }
      const tk = S.talk(t); sx *= 1 + .022 * tk; sy *= 1 + .03 * tk;       // it swells on every syllable
      sy *= 1 + .02 * off;                                                  // a little rounder when it breathes off the glass
      Q.sx = sx; Q.sy = sy; Q.rot = rot;
      Q.z = hh * (1 - sy);                                                  // scale about the face centre, not the foot
      Q.x = P.x - hh * Math.sin(rot);
      return Q;
    }
    // ---------------------------------------------------------------- 7. the loop (flying at the lens)
    if (t >= A.loop0) {
      const k = kk(t, A.loop0, T.end);
      const st = Math.sin(Math.PI * Math.min(1, k * 2)) * (1 - k);          // launched stretched, rounder as it nears us
      Q.sy = 1 + .2 * st; Q.sx = 1 - .1 * st;
      Q.rot = (P.rot || 0) - .55 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * Math.pow(1 - k, 1.5);   // a tumble that settles to 0
      Q.z = hh * (1 - Q.sy) * kk(k, .3, .9);
      return Q;
    }
    // ---------------------------------------------------------------- 6. inside the violet container
    if (P.mode === 'inside') {
      let sx = P.sx || 1, sy = P.sy || 1, z = 0;
      const h = hops(t, .55); z = h.z; sx *= h.sx; sy *= h.sy;
      const c = crouch(t, A.loop0, .16); sy *= 1 - .2 * c; sx *= 1 + .14 * c;   // it gets ready to pop out for the loop
      Q.sx = sx; Q.sy = sy; Q.z = z; Q.rot = 0;
      return Q;
    }
    // ---------------------------------------------------------------- 2. peeling off the glass, falling back to the cloth
    if (P.mode === 'air' && t < A.land) {
      const k = kk(t, A.dezoom, A.land), st = Math.sin(Math.PI * k);
      Q.sy = (P.sy || 1) * (1 + .14 * st * (1 - k)); Q.sx = (P.sx || 1) * (1 - .07 * st);
      Q.rot = -.32 * Math.sin(Math.PI * Math.pow(k, .8));
      return Q;
    }
    // ---------------------------------------------------------------- 6'. the leap into the container (air)
    if (t >= A.leap) {
      const k = kk(t, A.leap, A.enter), st = Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - .5 * k);
      Q.sy = 1 + .24 * st; Q.sx = 1 - .12 * st;
      Q.rot = -.55 * Math.sin(Math.PI * k) * (1 - .3 * k);                  // dives in head first, rights itself
      return Q;
    }
    // ---------------------------------------------------------------- 3–5. on the cloth
    let z = 0, sx = 1, sy = 1, rot = 0, dx = 0;
    // back on the cloth: the landing squash and a wobble
    { const q = squash(t, A.land, .24, 24, 7.5); sx *= q.sx; sy *= q.sy; if (t >= A.land) rot += .07 * Math.exp(-(t - A.land) * 6) * Math.sin((t - A.land) * 19); }
    // breathing at rest
    sy *= 1 + .012 * Math.sin(t * TAU * .7); sx *= 1 - .006 * Math.sin(t * TAU * .7);
    // nervous while TOI falls for it (« trois cœurs… c'est lui ! … je paie »), on twos
    if (t >= A.toiTxt1 - .2 && t < A.jump - .14) {
      const a = (.25 + .75 * sst(kk(t, A.toiTxt2 - .5, A.jump - .2))) * kk(t, A.toiTxt1 - .2, A.toiTxt1 + .2), n = q2(t);
      dx += (rnd(n * 1.73 + 3) - .5) * 5 * a; rot += (rnd(n * 2.91 + 7) - .5) * .05 * a; sy *= 1 + (rnd(n * 3.7 + 1) - .5) * .03 * a;
    }
    // THE INTERRUPTION: one leap from its place to the middle, leaning into it; TOI's plate bonks into it
    if (t >= A.jump - .16) {
      const j = leap(t, A.jump, A.jumpLand, 230, { crouch: .16, cAmt: .22, st: .3, land: .3, freq: 26, damp: 7 });
      sx *= j.sx; sy *= j.sy; z = Math.max(z, j.z);
      if (j.k > 0 && j.k < 1) rot += .3 * Math.sin(Math.PI * j.k) - .12 * Math.sin(TAU * j.k);
      if (t >= A.bonk) { const d = t - A.bonk; rot += -.13 * Math.exp(-d * 6.5) * Math.sin(d * 21); dx += -10 * Math.exp(-d * 9) * Math.sin(Math.min(Math.PI, d * 30)); }
    }
    // steps aside for the call (back to its place): crouch, a small hop, settle
    if (t >= A.aside - .14) {
      const j = leap(t, A.aside, A.aside + .45, 80, { crouch: .14, cAmt: .14, st: .18, land: .16, freq: 28, damp: 9 });
      sx *= j.sx; sy *= j.sy; if (j.k > 0 && j.k < 1) { z = j.z; rot += -.16 * Math.sin(Math.PI * j.k); }
    }
    // three joy jumps around « C'était un faux message ! » (silent, v2): tilt left, tilt right, then a wiggle in the air
    A.joy.forEach((jt, i) => {
      const t0 = jt - .16, t1 = jt + .16, gap = i ? t0 - (A.joy[i - 1] + .16) : .2;
      const j = leap(t, t0, t1, 85, { crouch: Math.max(.06, Math.min(.12, gap * .8)), cAmt: .16, st: .2, land: .16, freq: 30, damp: 10 });
      sx *= j.sx; sy *= j.sy; z = Math.max(z, j.z);
      if (j.k > 0 && j.k < 1) rot += i < 2 ? (i ? .2 : -.2) * Math.sin(Math.PI * j.k) : .26 * Math.sin(TAU * j.k);   // the third: a happy wiggle (a fast spin smears under the motion blur)
    });
    // talking hops on the syllables (C2, C3, C4 at its place, C5 before the leap)
    const h = hops(t, 1); sx *= h.sx; sy *= h.sy; z = Math.max(z, h.z);
    // the crouch before the leap into the container
    { const c = crouch(t, A.leap, .16); sy *= 1 - .22 * c; sx *= 1 + .15 * c; }
    // a full turn is drawn about its centre (the character transform turns about the foot)
    const hc = G.ph * s / 2 * sy;
    Q.x = P.x + dx - hc * Math.sin(rot); Q.z = z + hc * (1 - Math.cos(rot)); Q.zl = z;
    Q.sx = sx; Q.sy = sy; Q.rot = rot;
    return Q;
  }

  // =============================================================================================
  // THE BODY
  // =============================================================================================
  /** front-face geometry (same maths as P_parcel / SCORE.parcelFace), before the character transform */
  function geo(P) {
    const s = P.s || 1, sq = cl(P.squash || 0, 0, .5), near = cl((s - 1) / 2.4);
    const W = G.pw * s * (1 + .5 * sq), Hf = G.ph * s * (1 + .22 * sq), yb = P.y + 40 * s + .12 * Hf * sq;
    const Dt = G.pd * s * (1 - .66 * near) * Math.max(.06, 1 - 3.6 * sq);
    return { s, sq, near, W, Hf, yb, Dt, x: P.x, top: yb - Hf - Dt * .55 };
  }
  /** pressure creases on the face flattened against the phone glass (soft dark fold + its lit lip) */
  function creases(P, t) {
    const g = geo(P), sq = g.sq; if (sq < .02) return;
    const k = cl((sq - .02) / .25), x0 = g.x - g.W / 2, y0 = g.yb - g.Hf, W = g.W, Hh = g.Hf, cx = g.x, cy = g.yb - Hh * .5;
    ctx.save(); ctx.beginPath(); rrect(x0, y0, W, Hh, Math.min(W, Hh) * (.02 + .25 * sq)); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const corners = [[x0, y0, 1, 1], [x0 + W, y0, -1, 1], [x0, y0 + Hh, 1, -1], [x0 + W, y0 + Hh, -1, -1]];
    corners.forEach(([px, py, ux, uy], i) => {
      for (let j = 0; j < 2; j++) {
        const len = (.18 + .1 * rnd(i * 5 + j)) * Math.min(W, Hh) * (.6 + .4 * k), a = Math.atan2(cy - py, cx - px) + (j ? .35 : -.28) * (rnd(i * 3 + j * 7) - .2);
        const sx0 = px + ux * (6 + 18 * j), sy0 = py + uy * (4 + 14 * (1 - j)), ex = sx0 + Math.cos(a) * len, ey = sy0 + Math.sin(a) * len;
        const mx = (sx0 + ex) / 2 + (rnd(i * 11 + j) - .5) * 14, my = (sy0 + ey) / 2 + (rnd(i * 13 + j) - .5) * 14;
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.strokeStyle = `rgba(60,32,10,${(.22 * k).toFixed(3)})`; ctx.lineWidth = 7; ctx.stroke();
        ctx.translate(-1.5, -2); ctx.strokeStyle = `rgba(255,236,200,${(.2 * k).toFixed(3)})`; ctx.lineWidth = 2.2; ctx.stroke(); ctx.translate(1.5, 2);
      }
    });
    ctx.restore();
  }
  /** cream shout lines off the two top corners, popping on every syllable it says */
  function shout(P, t) {
    const k = cl(P.talk || 0); if (k < .04 || P.mode === 'inside' || P.mode === 'lens') return;
    const g = geo(P), u = 7 + 6.5 * g.s, pop = easeOut(k);
    const yTop = P.mode === 'glass' ? g.yb - g.Hf + g.Hf * .12 : g.top;
    const sideX = g.W / 2 - (P.mode === 'glass' ? g.W * .02 : 0);
    ctx.save(); ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const cx = g.x + side * sideX, cy = yTop;
      for (let i = 0; i < 3; i++) {
        const a = side < 0 ? (-170 + 27 * i) * Math.PI / 180 : (-10 - 27 * i) * Math.PI / 180;
        const r0 = u * (.9 + .6 * pop), len = u * (1.25 + .5 * (i === 1)) * (.45 + .55 * pop);
        const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a) * (r0 + len), y1 = cy + Math.sin(a) * (r0 + len);
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.strokeStyle = 'rgba(26,14,6,.55)'; ctx.lineWidth = u * .42 + 3; ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x1, y1 + 2); ctx.stroke();
        ctx.strokeStyle = '#FFF1D6'; ctx.lineWidth = u * .42; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function body(P, t, L) {
    if (!P || !P.vis) return;
    if (typeof P_parcel === 'function') P_parcel({ ...P, z: 0 }, t * 30, L, { noShadow: true, label: 'TA|COMMANDE', ribbon: P.ribbon || 0 });
    if (P.mode === 'glass' || P.mode === 'lens') creases(P, t);
    shout(P, t);
  }

  // =============================================================================================
  // THE SHADOW (world, on the cloth)
  // =============================================================================================
  function shadow(P, t, L) {
    if (!P || !P.vis || P.mode === 'glass' || P.mode === 'lens' || P.inside) return;
    const s = P.s || 1, sxx = P.sx || 1, zEff = Math.max(0, P.zl ?? P.z ?? 0) + Math.max(0, s - G.pS) * 150;
    const sw = G.pw * s * sxx, d = G.pd * s, ty = P.y + 40 * s, x = P.x, grow = 1 + zEff * .0016;
    const path = () => { ctx.moveTo(x - sw / 2 * grow, ty); ctx.lineTo(x + sw / 2 * grow, ty); ctx.lineTo(x + sw / 2 * .93 * grow, ty - d); ctx.lineTo(x - sw / 2 * .93 * grow, ty - d); ctx.closePath(); };
    castShadow(path, x, ty, zEff, L, .95);
    const ca = (1 - cl(zEff / 24)) * .6;                                        // contact: dark and tight right under the box
    if (ca > .01) softPath(() => ctx.rect(x - sw / 2 - 3, ty - d * .45, sw + 6, d * .45 + 4), 2.2, `rgba(6,3,14,${ca.toFixed(3)})`);
  }

  return { pose, body, shadow, hops, geo };
})();
function CM_pose(P, t) { return CM_.pose(P, t); }
function CM_parcel(P, t, L) { CM_.body(P, t, L); }
function CM_parcelShadow(P, t, L) { CM_.shadow(P, t, L); }
