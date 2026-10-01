'use strict';
// =============================================================================================
// 11_hero — the hero carton « VOTRE COLIS » + the violet lead thread (final_storyboard §1.3, §2.4, §2.5).
// Package f1 (foundation). Chapter packages only REGISTER data here; they never draw the hero themselves:
//   hp_keys(ch, () => [{t, x, y, s, r, lift, dur, ease, twos}])   pose keyframes (arrival times, word-anchored)
//   hp_states(ch, t => ({visible, flaps, tapeK, tapeSnap, label, labelPose, chineK, vousK, contents, …}), pre)
//   hp_mood(ch, () => [{kind:'land'|'hop'|'peek'|'shiver'|'nod', t0, dir, hold}])
//   hp_anchor(ch, t => [x, y] | false | null)                     lead-thread lower end while the hero is hidden
//   hp_leadEnd(ch, t => [x, y] | false | null)                    (added) lead-thread UPPER end override (recap/outro)
//   hp_leadVia(ch, t => via | null, {fade})                        (added) lead-thread ROUTE: bend it round key images
//       via = [x, y] | [x, y, k] | [[x, y], …] (listed from the knot UP to the tab) | {via, k, alpha}
//       k 0..1 blends straight → bent (omit it: eased automatically over `fade` s at both ends of the window);
//       alpha multiplies the thread (e.g. .3 while another violet thread is the subject). A chapter's own
//       registration replaces f1's defaults for that chapter (bottom of this file).
// With zero registrations the hero is hidden and no lead thread is drawn.
// Unit carton = 560×420 at s = 1, top view, origin = carton centre. Knot (thread attach) = local (−190, −214).
// =============================================================================================
const HP_HERO = { w: 560, h: 420, bev: 14, tapeX: -190, tapeW: 64, knot: [-190, -214],
  label: { x: 60, y: 5, r: -0.035 }, flapL: 130, flapS: 110, lift: 6 };

// ---------- small shared utilities (f1) ----------
/** frame-stepped time (on twos) that is stable across motion-blur sub-frames */
function f1_twos(t) { const n = Math.round(t * FPS); return Math.floor(n / 2) * 2 / FPS; }
/** a value or a lazily evaluated function (registrations happen before the timeline is loaded) */
function f1_val(v, ...a) { return typeof v === 'function' ? v(...a) : v; }
const F1_EASE = { io: eInOutCubic, out: eOutCubic, in: eInCubic, lin: x => x, expo: eOutExpo, back: x => eOutBack(x), step: x => (x >= 1 ? 1 : 0) };
/** cream paper with fibres (pattern, built once) */
let _f1CreamPat = null;
function f1_cream() {
  if (_f1CreamPat) return _f1CreamPat;
  const c = makeCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = C.cream; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 520; i++) {
    const x = rnd(i * 3.17 + 1) * 256, y = rnd(i * 5.31 + 2) * 256, a = rnd(i * 7.7) * Math.PI, l = 3 + rnd(i * 1.9) * 9;
    g.strokeStyle = rnd(i * 2.3) > .55 ? 'rgba(150,115,75,.075)' : 'rgba(255,255,255,.55)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 14; i++) { const x = rnd(i * 9.3) * 256, y = rnd(i * 4.1) * 256, r = 20 + rnd(i * 6.6) * 50, rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(226,204,168,.10)'); rg.addColorStop(1, 'rgba(226,204,168,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  _f1CreamPat = ctx.createPattern(c, 'repeat'); return _f1CreamPat;
}
/** violet tape strip along local y from ya to yb at x (centre), width w; jagged ends; k = alpha */
function f1_violetTape(x, ya, yb, w, seed = 3, o = {}) {
  if (yb - ya < 2) return;
  const x0 = x - w / 2, x1 = x + w / 2;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.beginPath();
  const zig = (xa, xb, y, s, dir) => { const pts = []; const N = 7; for (let i = 0; i <= N; i++) pts.push([lerp(xa, xb, i / N), y + (i % 2 ? 3.5 : -1.5) * dir + (rnd(s + i) - .5) * 2]); return pts; };
  const top = o.cleanTop ? [[x0, ya], [x1, ya]] : zig(x0, x1, ya, seed, 1), bot = o.cleanBot ? [[x1, yb], [x0, yb]] : zig(x1, x0, yb, seed + 9, -1);
  const right = tornLine(x1, ya, x1, yb, seed + 21, .8, 14), left = tornLine(x0, yb, x0, ya, seed + 33, .8, 14);
  ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of right) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); for (const p of left) ctx.lineTo(...p);
  ctx.closePath(); ctx.fillStyle = 'rgba(169,71,254,.85)'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(x0 + 7, ya, 5, yb - ya);                       // 5 px sheen
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x0 + 16, ya, 14, yb - ya);
  ctx.fillStyle = 'rgba(60,10,110,.16)'; ctx.fillRect(x1 - 6, ya, 6, yb - ya);                          // edge density
  ctx.restore(); ctx.restore();
}

// ---------- the label ----------
/** hero label 360×250 centred at (0,0); o {chineK 0..1 (stamp, hit at .3), vousK 0..1 (write-on), lift} */
function hp_label(o = {}) {
  const w = 360, h = 250, x0 = -w / 2, y0 = -h / 2;
  withShadow(o.lift ?? 2, () => { ctx.fillStyle = C.cream; rrect(x0, y0, w, h, 10); ctx.fill(); });
  ctx.save(); rrect(x0, y0, w, h, 10); ctx.clip();
  ctx.fillStyle = f1_cream(); ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = C.violetD; ctx.fillRect(x0, y0, w, 62);
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x0, y0, w, 5);
  ctx.fillStyle = 'rgba(35,10,60,.18)'; ctx.fillRect(x0, y0 + 59, w, 3);
  ctx.restore();
  // logo on a cream disc (the violet wings would vanish on the violetD band)
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(x0 + 36, y0 + 31, 24, 0, 7); ctx.fill();
  drawLogo(x0 + 36, y0 + 31, 40);
  const tf = font(FF.stencil, 48, 900), avail = w - 72 - 14, tw = measure('VOTRE COLIS', tf, 4), ts = Math.min(1, avail / tw);
  at(x0 + 72, y0 + 48, 0, ts, 1, () => text('VOTRE COLIS', 0, 0, { font: tf, color: C.cream, ls: 4 }));
  // fields
  const fm = font(FF.mono, 44, 700), r1 = y0 + 142, r2 = r1 + 90;
  // « DE : » / « À : » — a mono space is a full cell, so each colon is set by hand 9 px after its word; values aligned
  const c1 = x0 + 20 + measure('DE', fm) + 9, c2 = x0 + 20 + measure('À', fm) + 9, xv = Math.max(c1, c2) + measure(':', fm) + 22, xe = x0 + w - 18;
  text('DE', x0 + 20, r1, { font: fm, color: C.inkSoft }); text('À', x0 + 20, r2, { font: fm, color: C.inkSoft });
  text(':', c1, r1, { font: fm, color: C.inkSoft }); text(':', c2, r2, { font: fm, color: C.inkSoft });
  ctx.save(); ctx.strokeStyle = 'rgba(74,58,82,.35)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
  for (const y of [r1 + 12, r2 + 12]) { ctx.beginPath(); ctx.moveTo(xv - 4, y); ctx.lineTo(xe, y); ctx.stroke(); }
  ctx.restore();
  // DE : CHINE — stamped (Stencil 72 orange, starved); the hit lands at chineK = .3
  const ck = clamp(o.chineK || 0);
  if (ck > 0) {
    const sf = font(FF.stencil, 72, 900), cw = measure('CHINE', sf, 2), sc = Math.min(1, (xe - xv) / cw);
    let s = 1, a = 1; if (ck < .3) { const q = ck / .3; s = lerp(1.6, 1, eInCubic(q)); a = q; } else { const u = (ck - .3) * 1.2; s = 1 - Math.exp(-u * 12) * Math.cos(u * 34) * .05; }
    at(xv + cw * sc / 2, r1 - 27, -.03, s * sc, s * sc, () => stampText('CHINE', 0, 0, sf, C.orange, { box: false, starve: .45, alpha: a, ls: 2 }));
  }
  // À : VOUS — hand-written (Shantell 72 ink), pen visible while writing
  const vk = clamp(o.vousK || 0);
  if (vk > 0) {
    const vw = measure('VOUS', font(FF.hand, 72, 800)), size = Math.min(72, 72 * (xe - xv) / vw);
    handText('VOUS', xv, r2, size, { write: vk, align: 'left', color: C.ink, pen: vk < 1 });
  }
}
/** portrait mini label 150×280 « VOTRE / COLIS » centred at (0,0); o {lift, alpha} */
function hp_labelMini(o = {}) {
  const w = 150, h = 280, x0 = -w / 2, y0 = -h / 2;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  withShadow(o.lift ?? 2, () => { ctx.fillStyle = TEX.kraft || C.kraft; rrect(x0 - 4, y0 - 4, w + 8, h + 8, 10); ctx.fill(); });
  ctx.save(); rrect(x0, y0, w, h, 7); ctx.clip();
  ctx.fillStyle = f1_cream(); ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = C.violetD; ctx.fillRect(x0, y0, w, 54);
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x0, y0, w, 4);
  ctx.restore();
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, y0 + 27, 21, 0, 7); ctx.fill(); drawLogo(0, y0 + 27, 34);
  const f = font(FF.stencil, 50, 900), sc = Math.min(1, (w - 16) / Math.max(measure('VOTRE', f, 1), measure('COLIS', f, 1)));
  at(0, -5, 0, sc, 1, () => text('VOTRE', 0, 0, { font: f, color: C.ink, align: 'center', ls: 1 }));
  at(0, 55, 0, sc, 1, () => text('COLIS', 0, 0, { font: f, color: C.ink, align: 'center', ls: 1 }));
  f1_violetTape(0, 75, 97, w + 6, 41, { cleanTop: true, cleanBot: true });
  ctx.restore();
}

// ---------- the carton ----------
/** one flap hinged on edge 'T'|'B'|'L'|'R'; a = fold 0 (closed, over the opening) → 1 (open, folded outward) */
function f1_flap(edge, a) {
  const W2 = HP_HERO.w / 2, H2 = HP_HERO.h / 2;
  const E = { T: [[-W2, -H2], [W2, -H2], [0, -1], HP_HERO.flapL, 16], B: [[W2, H2], [-W2, H2], [0, 1], HP_HERO.flapL, 16],
              L: [[-W2, H2], [-W2, -H2], [-1, 0], HP_HERO.flapS, 30], R: [[W2, -H2], [W2, H2], [1, 0], HP_HERO.flapS, 30] }[edge];
  const [h0, h1, nn, d, taper] = E, ang = a * Math.PI, c = Math.cos(ang), sn = Math.sin(ang);
  const e = -c * d + sn * d * .5, spread = 1 + sn * .12, ae = Math.min(1, Math.abs(e) / d);
  const mx = (h0[0] + h1[0]) / 2, my = (h0[1] + h1[1]) / 2, half = Math.hypot(h1[0] - h0[0], h1[1] - h0[1]) / 2;
  const shrink = spread * (1 - taper / half * ae);
  const f0 = [mx + (h0[0] - mx) * shrink + nn[0] * e, my + (h0[1] - my) * shrink + nn[1] * e], f1 = [mx + (h1[0] - mx) * shrink + nn[0] * e, my + (h1[1] - my) * shrink + nn[1] * e];
  const shape = () => { ctx.beginPath(); ctx.moveTo(...h0); ctx.lineTo(...h1); ctx.lineTo(...f1); ctx.lineTo(...f0); ctx.closePath(); };
  const outward = c < -.2, standing = Math.abs(c) <= .2;
  if (outward) withShadow(4, () => { shape(); ctx.fillStyle = C.kraftD; ctx.fill(); });
  shape(); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
  if (outward) { ctx.fillStyle = 'rgba(255,238,210,.16)'; ctx.fill(); }               // inner face: lighter, unprinted
  if (standing) { ctx.fillStyle = 'rgba(255,240,215,.26)'; ctx.fill(); }               // lit, facing the lens
  // crease shading at the hinge
  const g = ctx.createLinearGradient(mx, my, mx + nn[0] * e, my + nn[1] * e);
  g.addColorStop(0, outward ? 'rgba(70,40,15,.28)' : 'rgba(70,40,15,.12)'); g.addColorStop(1, 'rgba(70,40,15,0)'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,.40)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...f0); ctx.lineTo(...f1); ctx.stroke();   // cut edge
  ctx.strokeStyle = 'rgba(90,60,30,.40)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...h0); ctx.lineTo(...h1); ctx.stroke();     // crease
}
/**
 * The hero at local origin (call inside at(x, y, r, s, s)).
 * o { flaps 0..1 (3 poses), tapeK 0..1 (violet tape pulled top → bottom), tapeSnap 0..1 (cut tape retracts),
 *     label 'on'|'off', chineK, vousK, contents(n) (drawn inside the open box), lift, knot (bool: draw the thread knot), quant }
 */
function hp_carton(o = {}) {
  const w = HP_HERO.w, h = HP_HERO.h, W2 = w / 2, H2 = h / 2, bev = HP_HERO.bev;
  const fl = o.quant === false ? clamp(o.flaps || 0) : Math.round(clamp(o.flaps || 0) * 3) / 3;
  const aL = clamp(fl * 1.5), aS = clamp(fl * 1.5 - .5), open = aL > .001;
  withShadow(o.lift ?? HP_HERO.lift, () => { ctx.fillStyle = C.kraftD; rrect(-W2 + bev * .4, -H2 + bev * .6, w, h, 6); ctx.fill(); });
  if (!open) {
    carton(w, h, { tape: false, seed: 7 });
    // wear: scuffed corners + a soft crease light along the seam
    ctx.save(); rrect(-W2, -H2, w, h, 5); ctx.clip();
    for (const [cx, cy] of [[-W2, -H2], [W2, -H2], [-W2, H2], [W2, H2]]) { const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70); rg.addColorStop(0, 'rgba(110,72,36,.22)'); rg.addColorStop(1, 'rgba(110,72,36,0)'); ctx.fillStyle = rg; ctx.fillRect(cx - 70, cy - 70, 140, 140); }
    ctx.fillStyle = 'rgba(255,240,210,.16)'; ctx.fillRect(-W2, 2, w, 3);
    ctx.restore();
    // violet tape (the hero's, and only the hero's)
    const tk = clamp(o.tapeK ?? 1), sn = clamp(o.tapeSnap || 0), ya = -H2 - 4, yb = H2 + bev - 2;
    if (sn > 0) {
      const r = 1 - eOutCubic(sn);
      f1_violetTape(HP_HERO.tapeX, ya, lerp(ya + 30, 0, r), HP_HERO.tapeW, 3, { cleanTop: true });
      f1_violetTape(HP_HERO.tapeX + 2 * sn, lerp(yb - 30, 0, r), yb, HP_HERO.tapeW, 17, { cleanBot: true });
    } else if (tk > 0) f1_violetTape(HP_HERO.tapeX, ya, lerp(ya, yb, tk), HP_HERO.tapeW, 3, { cleanTop: true, cleanBot: tk >= 1 });
    if (o.lidArt) o.lidArt(o.n || 0);   // added by B: optional state fn (hero-local) printed on the closed lid UNDER the label — s1's EMBALLÉ ink
    if (o.label === 'on' && !o.labelPose) at(HP_HERO.label.x, HP_HERO.label.y, HP_HERO.label.r, 1, 1, () => hp_label({ chineK: o.chineK, vousK: o.vousK }));
  } else {
    const flaps = [['T', aL], ['B', aL], ['L', aS], ['R', aS]];
    for (const [e, a] of flaps) if (a > .5) f1_flap(e, a);                                  // folded outward: under the walls
    ctx.fillStyle = C.kraftD; rrect(-W2 + bev * .4, -H2 + bev * .6, w, h, 6); ctx.fill();
    ctx.fillStyle = TEX.kraft || C.kraft; rrect(-W2, -H2, w, h, 5); ctx.fill();             // rim (top of the walls)
    const ix0 = -W2 + 12, iy0 = -H2 + 12, ix1 = W2 - 12, iy1 = H2 - 12, fx0 = ix0 + 22, fy0 = iy0 + 28;
    ctx.save(); ctx.beginPath(); ctx.rect(ix0, iy0, ix1 - ix0, iy1 - iy0); ctx.clip();
    ctx.fillStyle = C.kraftD; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);                   // floor
    const fg = ctx.createLinearGradient(0, iy0, 0, iy1); fg.addColorStop(0, 'rgba(40,22,8,.30)'); fg.addColorStop(.5, 'rgba(40,22,8,.06)'); fg.addColorStop(1, 'rgba(255,230,190,.06)');
    ctx.fillStyle = fg; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    ctx.strokeStyle = 'rgba(50,28,10,.30)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx0, (fy0 + iy1) / 2); ctx.lineTo(ix1, (fy0 + iy1) / 2); ctx.stroke();   // bottom seam
    ctx.fillStyle = '#6E4E2C'; ctx.beginPath(); ctx.moveTo(ix0, iy0); ctx.lineTo(ix1, iy0); ctx.lineTo(ix1, fy0); ctx.lineTo(fx0, fy0); ctx.closePath(); ctx.fill();   // far wall (shade)
    ctx.fillStyle = '#7F5D38'; ctx.beginPath(); ctx.moveTo(ix0, iy0); ctx.lineTo(fx0, fy0); ctx.lineTo(fx0, iy1); ctx.lineTo(ix0, iy1); ctx.closePath(); ctx.fill();   // left wall
    ctx.strokeStyle = 'rgba(40,22,8,.18)'; ctx.lineWidth = 1.5; for (let x = fx0 + 6; x < ix1; x += 9) { ctx.beginPath(); ctx.moveTo(x, iy0); ctx.lineTo(x, fy0); ctx.stroke(); }   // corrugation on the far wall
    if (o.contents) o.contents(o.n || 0);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.lineWidth = 2; rrect(-W2 + 2, -H2 + 2, w - 4, h - 4, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,34,12,.35)'; ctx.lineWidth = 2; ctx.strokeRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    for (const [e, a] of [['L', aS], ['R', aS], ['T', aL], ['B', aL]]) if (a <= .5) f1_flap(e, a);   // lying inward / standing: on top
  }
  if (o.knot) f1_knotMark(o.knotK ?? 1);
}
/** the little violet knot where the lead thread is tied (local hero coords) */
function f1_knotMark(k = 1) {
  const [kx, ky] = HP_HERO.knot;
  at(kx, ky, 0, k, k, () => {
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = C.violetD; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.quadraticCurveTo(-16, 14, -12, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 2); ctx.quadraticCurveTo(18, 10, 22, 26); ctx.stroke();
    ctx.fillStyle = C.violet; ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, -.3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-3, -3, 4, 3, -.3, 0, 7); ctx.fill();
    ctx.restore();
  });
}

// ---------- registries ----------
const _hpK = [], _hpS = [], _hpM = [], _hpA = [], _hpLE = [], _hpCinch = [], _hpLV = [];
let _hpTrackC = null, _hpMoodC = null, _hpOrderC = null;
function hp_keys(ch, fn) { _hpK.push({ ch, fn }); _hpTrackC = null; }
function hp_states(ch, fn, pre = 0) { _hpS.push({ ch, fn, pre }); _hpOrderC = null; }
function hp_mood(ch, list) { _hpM.push({ ch, list }); _hpMoodC = null; }
function hp_anchor(ch, fn) { _hpA.push({ ch, fn }); _hpOrderC = null; }
// added by f1: optional override of the lead thread's UPPER end (default = stepper tab / chapter tag grommet)
function hp_leadEnd(ch, fn) { _hpLE.push({ ch, fn }); _hpOrderC = null; }
// added by f1: knot cinch on the lead thread (4 frames) at t0 (number or () => number)
function hp_cinch(t0) { _hpCinch.push(t0); }
// added by f1 (review t 79.5): route the lead thread through via points so it skirts the key image instead of
// cutting across it. fn(t) → [x, y] | [x, y, k] | [[x, y], …] | {via, k, alpha} | null — see the header.
function hp_leadVia(ch, fn, o = {}) { _hpLV.push({ ch, fn, def: !!o.def, fade: o.fade ?? .35 }); _hpOrderC = null; }

function f1_track() {
  if (_hpTrackC) return _hpTrackC;
  const ks = [];
  _hpK.forEach((r, ri) => { const arr = f1_val(r.fn) || []; arr.forEach((k, ki) => { if (k && isFinite(k.t)) ks.push({ ...k, _o: ri * 1000 + ki }); }); });
  ks.sort((a, b) => a.t - b.t || a._o - b._o);
  const F = ['x', 'y', 's', 'r', 'lift'], out = [];
  let prev = { t: -1e9, x: 540, y: 1000, s: 1, r: 0, lift: HP_HERO.lift };
  for (const k of ks) {
    if (k.dur > 0 && out.length) { const th = Math.max(prev.t, k.t - k.dur); if (th > prev.t + 1e-4) { const hk = { ...prev, t: th, ease: 'lin', twos: false }; out.push(hk); prev = hk; } }
    const full = { t: k.t, ease: k.ease || 'io', twos: !!k.twos }; for (const f of F) full[f] = k[f] ?? prev[f];
    out.push(full); prev = full;
  }
  return (_hpTrackC = out);
}
function f1_trackAt(t) {
  const K = f1_track(); if (!K.length) return null;
  if (t <= K[0].t) return K[0];
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i]; if (t >= b.t) continue;
    const tt = b.twos ? f1_twos(t) : t, e = typeof b.ease === 'function' ? b.ease : (F1_EASE[b.ease] || eInOutCubic), k = e(clamp((tt - a.t) / Math.max(1e-6, b.t - a.t)));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k), r: lerp(a.r, b.r, k), lift: lerp(a.lift, b.lift, k) };
  }
  return K[K.length - 1];
}
function f1_order() {
  if (_hpOrderC) return _hpOrderC;
  const st = id => TL.ch(id).start, by = arr => arr.map((r, i) => ({ ...r, _i: i })).sort((a, b) => st(a.ch) - st(b.ch) || a._i - b._i);
  return (_hpOrderC = { S: by(_hpS), A: by(_hpA), LE: by(_hpLE), LV: by(_hpLV), LVown: new Set(_hpLV.filter(r => !r.def).map(r => r.ch)) });
}
const HP_STATE0 = { visible: true, flaps: 0, tapeK: 1, tapeSnap: 0, label: 'on', labelPose: null, chineK: 0, vousK: 0, contents: null,
  alpha: 1, dx: 0, dy: 0, dr: 0, sxMul: 1, syMul: 1, lift: 0, breathe: 1 };
/** merged state at t: chapters in timeline order from (start − pre); a field returned as undefined does not override */
function f1_state(t) {
  const st = { ...HP_STATE0 };
  for (const r of f1_order().S) { if (t < TL.ch(r.ch).start - (r.pre || 0)) continue; const o = r.fn(t); if (!o) continue; for (const k in o) if (o[k] !== undefined) st[k] = o[k]; }
  return st;
}
function f1_moods() {
  if (_hpMoodC) return _hpMoodC;
  const out = []; for (const r of _hpM) for (const m of (f1_val(r.list) || [])) if (m && isFinite(m.t0)) out.push(m);
  return (_hpMoodC = out);
}
/** mood deltas at t (all moods but breathe are on twos) */
function f1_moodAt(t) {
  const d = { dx: 0, dy: 0, r: 0, s: 1, sx: 1, sy: 1, lift: 0 }, ts = f1_twos(t);
  const squash = (u, amp) => { if (u < 0 || u > .5) return; const q = Math.exp(-u * 11) * Math.cos(u * 38) * amp; d.sx *= 1 + q; d.sy *= 1 - q * .8; };
  for (const m of f1_moods()) {
    const u = ts - m.t0; if (u < 0) continue;
    if (m.kind === 'land') {
      if (u < .22) { const k = eInCubic(u / .22); d.s *= lerp(1.25, 1, k); d.lift += lerp(40, 0, k); }
      else squash(u - .22, .06);
    } else if (m.kind === 'hop') {
      if (u < .08) d.s *= lerp(1, .95, eOutCubic(u / .08));
      else if (u < .26) { const k = eOutCubic((u - .08) / .18); d.s *= lerp(.95, 1.10, k); d.lift += 28 * k; d.dy -= 16 * k; }
      else if (u < .42) { const k = eInCubic((u - .26) / .16); d.s *= lerp(1.10, 1, k); d.lift += 28 * (1 - k); d.dy -= 16 * (1 - k); }
      else squash(u - .42, .04);
    } else if (m.kind === 'peek') {
      const hold = m.hold ?? .5, v = Array.isArray(m.dir) ? m.dir : [m.dir ?? 1, 0], L = Math.hypot(v[0], v[1]) || 1;
      const k = u < .2 ? eOutCubic(u / .2) : u < .2 + hold ? 1 : 1 - eInOutCubic(clamp((u - .2 - hold) / .4));
      d.dx += v[0] / L * 26 * k; d.dy += v[1] / L * 26 * k; d.r += .10 * Math.sign(v[0] || 1) * k;
    } else if (m.kind === 'shiver') {
      if (u < 8 / 30) { const s = Math.round(u * 15); d.dx += (rnd(s * 3.1 + m.t0) - .5) * 8; d.dy += (rnd(s * 5.3 + m.t0) - .5) * 8; }
    } else if (m.kind === 'nod') {
      const f = Math.round(u * 30); if ((f >= 0 && f < 4) || (f >= 8 && f < 12)) { d.s *= .97; d.dy += 3; }
    }
  }
  return d;
}
let _hpPoseT = NaN, _hpPoseC = null;
/** full hero pose at t: track + states + moods + breathe → {x, y, s, sx, sy, r, lift, visible, …state} */
function hp_pose(t) {
  if (t === _hpPoseT && _hpPoseC) return _hpPoseC;
  const tr = f1_trackAt(t), st = f1_state(t);
  let p;
  if (!tr) p = { ...st, visible: false, x: 540, y: 1000, s: 1, sx: 1, sy: 1, r: 0, lift: HP_HERO.lift };
  else {
    const m = f1_moodAt(t), dr = drift(t, 7, 3), br = 1 + .006 * Math.sin(t * Math.PI * 2 / (2.4 * (st.breathe || 1)));
    p = { ...st, x: tr.x + m.dx + st.dx + dr.x, y: tr.y + m.dy + st.dy + dr.y, s: tr.s * m.s * br, sx: m.sx * st.sxMul, sy: m.sy * st.syMul,
      r: tr.r + m.r + st.dr + dr.r, lift: tr.lift + m.lift + st.lift };
  }
  _hpPoseT = t; _hpPoseC = p; return p;
}
/** hero-local point → screen */
function f1_heroPt(p, lx, ly) {
  const ax = lx * p.s * p.sx, ay = ly * p.s * p.sy, c = Math.cos(p.r), s = Math.sin(p.r);
  return [p.x + ax * c - ay * s, p.y + ax * s + ay * c];
}
/** screen point of the thread knot */
function hp_knot(t) { return f1_heroPt(hp_pose(t), HP_HERO.knot[0], HP_HERO.knot[1]); }
/** added by f1: screen pose of the label when it sits on the lid (for peel / slap-back flights) */
function hp_labelHome(t) {
  const p = hp_pose(t), [x, y] = f1_heroPt(p, HP_HERO.label.x, HP_HERO.label.y);
  return { x, y, s: p.s * p.sx, r: p.r + HP_HERO.label.r };
}
/** added by f1: draw the hero with pose p (from hp_pose, or any {x,y,s,r,…state}) — e.g. in a character's hands */
function hp_drawHero(p, n = 0, o = {}) {
  if (!p) return;
  ctx.save(); ctx.globalAlpha *= (p.alpha ?? 1);
  at(p.x, p.y, p.r || 0, p.s * (p.sx ?? 1), p.s * (p.sy ?? 1), () => hp_carton({ ...p, n, knot: o.knot, knotK: o.knotK }));
  ctx.restore();
}
/** lead-thread ends: {bottom:[x,y], top:[x,y], p, viaKnot} | null */
function hp_leadEnds(t) {
  const O = f1_order(), p = hp_pose(t);
  let bottom = null, viaKnot = false;
  for (let i = O.A.length - 1; i >= 0; i--) { const r = O.A[i], c = TL.ch(r.ch); if (t < c.start - 1 || t > c.end + 1) continue; const v = r.fn(t); if (v === false) return null; if (v) { bottom = v; break; } }
  if (!bottom && p.visible && f1_track().length) { bottom = hp_knot(t); viaKnot = true; }
  if (!bottom) return null;
  let top = null, prog_ = 1;
  for (let i = O.LE.length - 1; i >= 0; i--) { const r = O.LE[i]; if (t < TL.ch(r.ch).start - 1) continue; const v = r.fn(t); if (v === false) return null; if (v) { top = v; break; } }
  if (!top && typeof hp_threadTop === 'function') { const v = hp_threadTop(t); if (v) { top = [v[0], v[1]]; prog_ = v[2] ?? 1; } }
  if (!top) return null;
  return { bottom, top, p: prog_, viaKnot };
}
/** pluck displacement at u (0 = bottom, 1 = top) for the frame-stepped time ts */
function f1_pluckOff(u, ts, plucks) {
  let off = 0;
  for (const t0 of plucks) { const a = ts - t0; if (a < 0 || a > .8) continue;
    const c = a / .25; off += 22 * Math.exp(-Math.pow((u - c) / .09, 2)) * (c < 1.1 ? 1 : 0);                        // bump running up
    off += 10 * Math.sin(Math.PI * u) * Math.exp(-a * 6) * Math.sin(a * 42); }                                       // string ring
  return off;
}
/**
 * the lead thread polyline (bottom → top) with sag and pluck waves.
 * added by f1 (review t 79.5): optional `via` {pts:[[x,y],…] (bottom → top), k 0..1} — the thread runs along a
 * centripetal Catmull-Rom spline B → via… → T (gravity sag per span, same plucks) and k blends the straight thread
 * into it point by point, so a route never pops in. Without `via` the result is exactly the straight thread.
 */
function f1_leadPts(B, T, t, slack = .05, via = null) {
  const dx = T[0] - B[0], dy = T[1] - B[1], L = Math.hypot(dx, dy); if (L < 6) return null;
  let nx = -dy / L, ny = dx / L; if (ny < 0 || (Math.abs(ny) < .15 && nx < 0)) { nx = -nx; ny = -ny; }
  const sag = slack * L, plucks = typeof f1_pluckTimes === 'function' ? f1_pluckTimes() : [], ts = f1_twos(t), pts = [];
  const vk = via && via.pts && via.pts.length ? clamp(via.k ?? 1) : 0, route = vk > 0 ? f1_viaPath(B, T, via.pts, slack) : null;
  const N = route ? Math.max(8, Math.round(route.len / 24)) : Math.max(8, Math.round(L / 28));
  for (let i = 0; i <= N; i++) {
    const u = i / N, off = sag * 4 * u * (1 - u) + f1_pluckOff(u, ts, plucks);
    pts.push([B[0] + dx * u + nx * off, B[1] + dy * u + ny * off]);
  }
  if (!route) return pts;
  const q = f1_resample(route.pts, N);
  return pts.map((p, i) => {
    const a = q[Math.max(0, i - 1)], b = q[Math.min(N, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const off = f1_pluckOff(i / N, ts, plucks), rx = -(b[1] - a[1]) / tl, ry = (b[0] - a[0]) / tl;   // local normal (right of an upward thread)
    return [lerp(p[0], q[i][0] + rx * off, vk), lerp(p[1], q[i][1] + ry * off, vk)];
  });
}
/** dense centripetal Catmull-Rom through B → via… → T; each span sags under gravity by its horizontal extent */
function f1_viaPath(B, T, via, slack) {
  const P = [B, ...via, T], n = P.length, mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const ext = i => (i < 0 ? mix(P[1], P[0], 2) : i >= n ? mix(P[n - 2], P[n - 1], 2) : P[i]);
  const dd = (a, b) => Math.max(1e-3, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const out = []; let len = 0;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ext(i - 1), p1 = P[i], p2 = P[i + 1], p3 = ext(i + 2);
    const t1 = dd(p0, p1), t2 = t1 + dd(p1, p2), t3 = t2 + dd(p2, p3);
    const span = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(4, Math.ceil(span / 8)), sg = slack * .5 * Math.abs(p2[0] - p1[0]);
    for (let j = 0; j < m; j++) {
      const s = j / m, tt = lerp(t1, t2, s);
      const a1 = mix(p0, p1, tt / t1), a2 = mix(p1, p2, (tt - t1) / (t2 - t1)), a3 = mix(p2, p3, (tt - t2) / (t3 - t2));
      const b1 = mix(a1, a2, tt / t2), b2 = mix(a2, a3, (tt - t1) / (t3 - t1)), c = mix(b1, b2, (tt - t1) / (t2 - t1));
      out.push([c[0], c[1] + sg * 4 * s * (1 - s)]);
    }
  }
  out.push([T[0], T[1]]);
  for (let i = 1; i < out.length; i++) len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
  return { pts: out, len };
}
/** polyline resampled to N + 1 points evenly spaced along its length */
function f1_resample(pts, N) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = cum[cum.length - 1] || 1, out = []; let j = 1;
  for (let i = 0; i <= N; i++) {
    const d = tot * i / N; while (j < pts.length - 1 && cum[j] < d) j++;
    const a = pts[j - 1], b = pts[j], k = clamp((d - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]));
    out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]);
  }
  return out;
}
/** a hp_leadVia result → {pts|null, k?, alpha?} */
function f1_viaNorm(v) {
  if (!v) return null;
  if (Array.isArray(v)) return typeof v[0] === 'number' ? { pts: [[v[0], v[1]]], k: v[2] } : { pts: v.filter(Boolean).length ? v.filter(Boolean) : null };
  const w = v.via, pts = !w ? null : typeof w[0] === 'number' ? [[w[0], w[1]]] : w.filter(Boolean);
  return { pts: pts && pts.length ? pts : null, k: v.k, alpha: v.alpha };
}
/** lead-thread route at t: {pts|null, k, alpha} | null — the latest chapter's registration wins; f1 defaults yield */
function hp_leadRoute(t) {
  const O = f1_order();
  for (let i = O.LV.length - 1; i >= 0; i--) {
    const r = O.LV[i], c = TL.ch(r.ch); if (t < c.start - 1 || t > c.end + 1) continue;
    if (r.def && O.LVown.has(r.ch)) continue;
    const v = f1_viaNorm(r.fn(t)); if (!v) continue;
    if (v.pts && v.k === undefined) {                       // auto ease at both ends of the window (probed on twos)
      const on = tt => { const w = f1_viaNorm(r.fn(tt)); return !!(w && w.pts); }, M = Math.max(1, Math.ceil(r.fade * 15));
      let a = 0, b = 0; while (a < M && on(t - (a + 1) / 15)) a++; while (b < M && on(t + (b + 1) / 15)) b++;
      v.k = eInOutCubic(clamp(Math.min(a, b) / M));
    }
    return v;
  }
  return null;
}
function f1_cinchK(t) {
  let k = 1; for (const c of _hpCinch) { const t0 = f1_val(c), u = f1_twos(t) - t0; if (u >= 0 && u < 4 / 30) k = Math.max(k, lerp(1.7, 1, u / (4 / 30))); }
  return k;
}

(() => {
  registerScene({
    id: 'lead', z: 38,
    draw(t, n) {
      const L = hp_leadEnds(t); if (!L) return;
      const R = hp_leadRoute(t), al = clamp(R && R.alpha != null ? R.alpha : 1);   // added by f1: route + alpha (review t 79.5)
      if (al <= 0) return;
      const pts = f1_leadPts(L.bottom, L.top, t, .05, R); if (!pts) return;
      ctx.save(); ctx.globalAlpha *= .8 * al; thread(pts, L.p, n, { w: 6 }); ctx.restore();
      if (!L.viaKnot && L.p >= 1) { ctx.save(); ctx.globalAlpha *= al; ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(L.bottom[0], L.bottom[1], 6, 0, 7); ctx.fill(); ctx.restore(); }
    },
  });
  registerScene({
    id: 'hero', z: 40,
    draw(t, n) {
      if (!f1_track().length) return;
      const p = hp_pose(t);
      if (p.visible) { const L = hp_leadEnds(t); hp_drawHero(p, n, { knot: !!(L && L.viaKnot && L.p > .02), knotK: f1_cinchK(t) }); }
      if (p.labelPose && p.label !== 'off') {                     // the label in flight / hovering, screen coords
        const q = p.labelPose, d = drift(t, 13, q.bob ?? 3); ctx.save(); ctx.globalAlpha *= (q.alpha ?? 1);   // hovering paper: gentle bob
        at(q.x + d.x, q.y + d.y, (q.r || 0) + d.r * 4, q.s ?? 1, q.s ?? 1, () => hp_label({ chineK: p.chineK, vousK: p.vousK, lift: q.lift ?? 10 })); ctx.restore();
      }
    },
  });
})();

// ---------- f1 default lead routes (review t 79.5) — a chapter's own hp_leadVia(ch, …) replaces these ----------
// Word-anchored; geometry = storyboard §3 (HP_PRINT, polaroid row). Via points are listed from the knot UP to the tab.
(() => {
  // S5 · P5a / P5b (Q3 · Q4): the thread drops from behind the tab's bottom-right corner and runs down OUTSIDE the print's
  // right border (x ≥ 870) to the knot — clear of the cut-out « vos colis » stack. Bends as the print grows to HP_PRINT,
  // lets go during the V08 desk sweep.
  // S5 · V08 polaroids: as polaroid 3 is dealt in, the thread is pushed into the gap between polaroids 2 and 3 (following
  // their deal poses and the « rangé » snap), leaves the gap past polaroid 3's bottom-left corner (above EN SÉCURITÉ)
  // and drops to the knot; it rides the T7 follow-drop up while it straightens.
  const PAPER = { hw: 156, top: -202.5, bot: 272.5 };                       // polaroid paper round its picture centre (280×373 + 16, band 70)
  const POL2 = { x: 540, y: 570, r: .03, i: 1 }, POL3 = { x: 880, y: 610, r: .06, i: 2 }, ROW_Y = 600;
  const pt = (P, lx, ly) => [P.x + lx * Math.cos(P.r) - ly * Math.sin(P.r), P.y + lx * Math.sin(P.r) + ly * Math.cos(P.r)];
  const polAt = (P, t, range) => { const k = spring(Math.max(0, f1_twos(t) - range - P.i * .05), 16, .5); return { x: lerp(P.x, 200 + 340 * P.i, k), y: lerp(P.y, ROW_Y, k), r: lerp(P.r, 0, k) }; };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // the 05 tab's bottom-right corner, tucked 18 × 10 px inside it: the thread runs hidden BEHIND the tab from its grommet and
  // drops from that corner, so it never lies across the print's taped top-right corner
  const tabCorner = t => { if (typeof hp_tabRect !== 'function') return null; const R = hp_tabRect(4, t), lx = R.w / 2 - 18, ly = R.h / 2 - 10;
    return [R.x + lx * Math.cos(R.r) - ly * Math.sin(R.r), R.y + lx * Math.sin(R.r) + ly * Math.cos(R.r)]; };
  hp_leadVia('s5', t => {
    const flip = W_('Q3', 'Voilà'), cartons = W_('V08', 'Cartons');
    if (t >= flip + .2 && t < cartons + .3) {
      const k = Math.min(eInOutCubic(prog(t, flip + .2, flip + .7)), 1 - eInOutCubic(prog(t, cartons, cartons + .3)));
      return { via: [[899, 830], [895, 480], tabCorner(t)].filter(Boolean), k };
    }
    const march = W_('V08', 'marchandises'), fw = typeof hp_followWin === 'function' ? hp_followWin('s6') : [TL.ch('s6').start - .35];
    if (t >= march && t < fw[0] + .3) {
      const range = W_('V08', 'rangé'), p2 = polAt(POL2, t, range), p3 = polAt(POL3, t, range);
      const k = Math.min(eInOutCubic(prog(t, march, march + .4)), 1 - eInOutCubic(prog(t, fw[0], fw[0] + .3)));
      const dy = typeof hp_followY === 'function' ? hp_followY(t, 's6', 'out') : 0;
      const gTop = mid(pt(p2, PAPER.hw, PAPER.top), pt(p3, -PAPER.hw, PAPER.top)), gMid = mid(pt(p2, PAPER.hw, 40), pt(p3, -PAPER.hw, 40));
      const gBot = mid(pt(p2, PAPER.hw, PAPER.bot), pt(p3, -PAPER.hw, PAPER.bot)), c3 = pt(p3, -PAPER.hw, PAPER.bot);
      return { via: [[c3[0] + 40, c3[1] + 34], gBot, gMid, gTop].map(p => [p[0], p[1] + dy]), k };
    }
    return null;
  }, { def: true });

  // S3 · the map (pull-back → tear): the violet ROUTE thread is the subject; the lead recedes to α .3 so it no longer
  // reads as a second route across Africa, and comes back as the map tears to reveal P4.
  hp_leadVia('s3', t => {
    const pb0 = hp_after(W_('V05', 'Étape'), W_('V05', 'conteneur')), tear0 = hp_after(W_('V05', 'Afrique'), W_('V05', 'route') + .26);
    const k = Math.min(eInOutCubic(prog(t, pb0, pb0 + .5)), 1 - eInOutCubic(prog(t, tear0, tear0 + .45)));
    return k > 0 ? { alpha: lerp(1, .3, k) } : null;
  }, { def: true });
})();
