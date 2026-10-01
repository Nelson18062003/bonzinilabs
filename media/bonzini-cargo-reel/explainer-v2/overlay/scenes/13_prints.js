'use strict';
// =============================================================================================
// 13_prints — print FX vocabulary of « Le parcours de vos colis » V2 (final_storyboard §1.7, §2.3 T6, §5.2).
// Owner: FOUNDATION-2 (f2). Chapter packages only CALL these helpers.
//
//   hp_deal / hp_out            → move a print rect in / out (feed the result to hp_printAt)
//   hp_develop / hp_flash       → 0..1 values for videoPrint {develop, flash}
//   hp_rimClip                  → angular reveal clip (0 → 2π)
//   hp_container                → the B 9.0 container cut out as a paper sticker (s4 cut + lift, s5 drop + door flap)
//   hp_polyCut                  → any polygon sticker cut from a frozen frame (s5: the real cartons)
//   hp_peel                     → corner peel of a full-screen layer (T6), with the slide-up fallback
//
// Stickers live in their own local frame: origin = area centroid of the cut polygon, 1 unit = 1 screen px of
// the print they were cut from. `pose` = {x, y, s, r} on screen; the HOME pose lays the sticker exactly over its
// print (pixel-identical image), so cut → lift → fly never jumps.
// =============================================================================================

// ---- the container on B 9.0 (measured on foot/up/B/00270.jpg, see the measurement note at the bottom) ----------------------
const HP_CONT = {
  clip: 'B', t: 9.0,
  // framing of P4b (s4) and of the sticker: whole container visible (3 edges + the frame edge on the right),
  // shop sign at the far left cropped out (visible frame x 180–1080, y 12–1212).
  fr: { fx: .60, fy: .319, zoom: 1.2 },
  quad: [[.2565, .2521], [1.0, .0177], [1.0, .6208], [.2583, .5536]],     // TL, TR, BR, BL (frame-normalised)
  // « VOTRE COLIS » mini label: centred on the star-outline ghost (bbox below), ≥ 22 px margin all round at s 1.16
  label: { nx: .4255, ny: .367, s: 1.16, r: .02 },
  ghost: [.349, .254, .502, .480],                                         // ghost bbox x0, y0, x1, y1 (never visible)
};
const F2_RIM = 10;                       // white sticker rim (px at s 1)
const F2_PAPER = '#FBFAF6';              // print / sticker paper (same as videoPrint)

// ---------------------------------------------------------------- moves
/** deal a print in: slide from a side, rotation settles on a spring, lift 40 → 12; tape pressed 2 frames after landing.
 *  → {x, y, w, h, rot, k, lift, tape, landed} (pass rect → hp_printAt(rect, …, {lift: r.lift, tape: r.tape}))
 *  o.twos: pose on twos (stop-motion) instead of smooth; o.sfx === false: do not log `card_deal` */
function hp_deal(t, t0, rect, from = 'left', dur = .35, o = {}) {
  if (o.sfx !== false) hp_sfx(o.sfxName || 'card_deal', t0);
  const tt = o.twos ? t0 + Math.floor(Math.max(0, t - t0) * 15) / 15 : t, k = clamp((tt - t0) / dur), e = eOutCubic(k);
  const dx = from === 'left' ? -1 : from === 'right' ? 1 : 0, dy = from === 'top' ? -1 : from === 'bottom' ? 1 : 0;
  const x0 = dx < 0 ? -rect.w * .8 - 60 : dx > 0 ? W + rect.w * .8 + 60 : rect.x + 60;
  const y0 = dy < 0 ? -rect.h * .8 - 80 : dy > 0 ? H + rect.h * .8 + 80 : rect.y + 90;
  const rOff = (dx || dy * -.6 || -1) * -.34;                         // from the left it arrives turned anticlockwise
  const sp = spring(Math.max(0, tt - t0) * (.35 / dur), 18, .45);
  return Object.assign({}, rect, {
    x: lerp(x0, rect.x, e), y: lerp(y0, rect.y, e) - (dx ? 26 * Math.sin(Math.PI * e) : 0),
    rot: (rect.rot || 0) + rOff * (1 - sp), k, lift: lerp(40, o.lift ?? 12, eOutCubic(clamp(k * 1.15))),
    tape: tt >= t0 + dur + 2 / 30, landed: k >= 1 });
}
/** slide a print out (picked up: lift 12 → 30, +0.15 rot toward the exit, accelerating). → rect + {k, lift, gone} */
function hp_out(t, t0, rect, to = 'right', dur = .4, o = {}) {
  if (o.sfx !== false) hp_sfx(o.sfxName || 'paper_slide', t0);
  const k = clamp((t - t0) / dur), e = k * k * (1.4 - .4 * k);
  const dx = to === 'left' ? -1 : to === 'right' ? 1 : 0, dy = to === 'top' ? -1 : to === 'bottom' ? 1 : 0;
  const x1 = dx < 0 ? -rect.w * .8 - 80 : dx > 0 ? W + rect.w * .8 + 80 : rect.x;
  const y1 = dy < 0 ? -rect.h * .8 - 100 : dy > 0 ? H + rect.h * .8 + 100 : rect.y;
  return Object.assign({}, rect, { x: lerp(rect.x, x1, e), y: lerp(rect.y, y1, e) - (dx ? 18 * Math.sin(Math.PI * e) : 0),
    rot: (rect.rot || 0) + (dx || dy || 1) * .15 * eOutCubic(k), k, lift: 12 + 18 * eOutCubic(clamp(k * 3)), tape: k < .08, gone: k >= 1 });
}
/** instant-film develop 0 → 1 (smooth, slow start, slow finish) — videoPrint {develop} */
function hp_develop(t, t0, dur = .6) { const k = prog(t, t0, t0 + dur); return k * k * (3 - 2 * k); }
/** white flash: 1 at t0, decays over dur — videoPrint {flash}; logs `shutter_click` unless sfx === false */
function hp_flash(t, t0, dur = .12, sfx = true) {
  if (sfx) hp_sfx('shutter_click', t0);
  if (t < t0) return 0; const k = (t - t0) / dur; return k >= 1 ? 0 : Math.pow(1 - k, 1.4);
}
/** angular reveal clip around (cx,cy): a pie wedge from a0 (top) sweeping k·2π clockwise. Call between save/restore. */
function hp_rimClip(cx, cy, k, a0 = -Math.PI / 2) {
  ctx.beginPath(); if (k >= 1) { ctx.rect(-1e4, -1e4, 2e4, 2e4); ctx.clip(); return; }
  ctx.moveTo(cx, cy); ctx.arc(cx, cy, 6000, a0, a0 + Math.PI * 2 * clamp(k)); ctx.closePath(); ctx.clip();
}

// ---------------------------------------------------------------- sticker geometry
/** frame-normalised point → print-local px (picture centred at 0,0, no rotation) — same maths as hp_frameToPrint */
function f2_frameLocal(nx, ny, w, h, fr = {}) {
  const z = fr.zoom || 1, s = Math.max(w / 1080, h / 1920) * z, sw = w / s, sh = h / s;
  const sx = clamp((fr.fx ?? .5) * 1080 - sw / 2, 0, 1080 - sw), sy = clamp((fr.fy ?? .5) * 1920 - sh / 2, 0, 1920 - sh);
  return [(nx * 1080 - sx) * s - w / 2, (ny * 1920 - sy) * s - h / 2];
}
/** offset outline of a polygon by d (round corners), optionally with a tiny scissor wobble; closed polyline */
function f2_offsetPts(pts, d, jag = 0, seed = 1) {
  const n = pts.length; let A = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const sg = A > 0 ? 1 : -1, nor = [];
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; nor.push([sg * (q[1] - p[1]) / L, -sg * (q[0] - p[0]) / L]); }
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], nm = nor[i], a = [p[0] + nm[0] * d, p[1] + nm[1] * d], b = [q[0] + nm[0] * d, q[1] + nm[1] * d];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(L / 24));
    for (let j = 0; j < m; j++) { const k = j / m, o = j && jag ? (rnd(seed + i * 17.3 + j * 3.1) - .5) * 2 * jag : 0; out.push([lerp(a[0], b[0], k) + nm[0] * o, lerp(a[1], b[1], k) + nm[1] * o]); }
    out.push(b);
    const nn = nor[(i + 1) % n], a0 = Math.atan2(nm[1], nm[0]); let da = Math.atan2(nn[1], nn[0]) - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (da * sg > 0) { const st = Math.max(2, Math.ceil(Math.abs(da) / .22)); for (let s = 1; s < st; s++) { const aa = a0 + da * s / st; out.push([q[0] + Math.cos(aa) * d, q[1] + Math.sin(aa) * d]); } }
  }
  return out;
}
function f2_path(P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }
function f2_lens(P, closed = true) { const L = [0]; const m = closed ? P.length + 1 : P.length; for (let i = 1; i < m; i++) { const a = P[i - 1], b = P[i % P.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return L; }
/** first k (0..1) of a closed polyline → {pts, head, ang} */
function f2_partial(P, L, k) {
  const lim = L[L.length - 1] * clamp(k), out = [P[0]]; let head = P[0], ang = 0;
  for (let i = 1; i < L.length; i++) { const a = P[i - 1], b = P[i % P.length]; ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (L[i] <= lim) { out.push(b); head = b; } else { const f = (lim - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); head = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; out.push(head); break; } }
  return { pts: out, head, ang };
}
const _f2g = {};
/** sticker geometry for a frame polygon cut from a w×h print with framing fr (cached) */
function f2_geom(polyN, w, h, fr) {
  const key = JSON.stringify([polyN, w, h, fr]); if (_f2g[key]) return _f2g[key];
  const P = polyN.map(([nx, ny]) => f2_frameLocal(nx, ny, w, h, fr || {}));
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  const pts = P.map(([x, y]) => [x - cx, y - cy]);
  const g = { pts, c: [cx, cy], w, h, fr: fr || {}, pic: { x: -w / 2 - cx, y: -h / 2 - cy, w, h },
    outer: f2_offsetPts(pts, F2_RIM, 1.1, 7), mid: f2_offsetPts(pts, F2_RIM / 2, 0) };
  g.midL = f2_lens(g.mid); g.outL = f2_lens(g.outer);
  return (_f2g[key] = g);
}
/** home pose: the sticker lying exactly where it was cut, on print rect R */
function f2_home(g, R) { const r = R.rot || 0, c = Math.cos(r), s = Math.sin(r); return { x: R.x + g.c[0] * c - g.c[1] * s, y: R.y + g.c[0] * s + g.c[1] * c, s: 1, r }; }
/** home pose of any polygon sticker cut from print rect (for your own lerps: pose = lerp(home, target, k)) */
function hp_stickerHome(poly, rect = HP_PRINT, fr = {}) { return f2_home(f2_geom(poly, rect.w, rect.h, fr), rect); }
/** home pose of the container sticker on print rect */
function hp_contHome(rect = HP_PRINT) { return f2_home(f2_geom(HP_CONT.quad, rect.w, rect.h, HP_CONT.fr), rect); }
/** screen point of a frame-normalised point (nx, ny) of the container, on the sticker at `pose` (default: home on rect) */
function hp_contPt(nx, ny, pose = null, rect = HP_PRINT) {
  const g = f2_geom(HP_CONT.quad, rect.w, rect.h, HP_CONT.fr), p = pose || f2_home(g, rect), l = f2_frameLocal(nx, ny, rect.w, rect.h, HP_CONT.fr);
  const lx = (l[0] - g.c[0]) * p.s, ly = (l[1] - g.c[1]) * p.s, c = Math.cos(p.r || 0), s = Math.sin(p.r || 0);
  return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
}
/** where hp_container draws the mini label, in SCREEN space, for the label stuck on the blank print rect (s4 4.12):
 *  → {x, y, s, r}: at(x, y, r, s, s, () => hp_labelMini(…)) lands exactly where the sticker will carry it */
function hp_contLabelPose(rect = HP_PRINT) {
  const L = HP_CONT.label, p = hp_contPt(L.nx, L.ny, null, rect);
  return { x: p[0], y: p[1], s: L.s * rect.w / 600, r: (rect.rot || 0) + L.r };
}
function f2_labelMini() {                // fallback only (A's hp_labelMini wins when 11_hero.js is loaded)
  const w = 150, h = 280;
  withShadow(3, () => { ctx.fillStyle = C.kraft; rrect(-w / 2, -h / 2, w, h, 10); ctx.fill(); });
  ctx.fillStyle = C.cream; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 8); ctx.fill();
  ctx.save(); rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 8); ctx.clip(); ctx.fillStyle = C.violetD; ctx.fillRect(-w / 2, -h / 2, w, 58); ctx.restore();
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, -h / 2 + 31, 22, 0, 7); ctx.fill(); drawLogo(0, -h / 2 + 31, 34);
  text('VOTRE', 0, 14, { font: font(FF.stencil, 50, 900), align: 'center', color: C.ink, ls: 2 });
  text('COLIS', 0, 72, { font: font(FF.stencil, 50, 900), align: 'center', color: C.ink, ls: 2 });
}
function f2_mini() { if (typeof hp_labelMini === 'function') hp_labelMini({}); else f2_labelMini(); }

// ---------------------------------------------------------------- sticker drawing
/** the hole a lifted sticker leaves in its print: the table shows through, with the print's own edge shadow */
function f2_hole(g, R) {
  at(R.x, R.y, R.rot || 0, 1, 1, () => {
    ctx.translate(g.c[0], g.c[1]);
    ctx.save(); f2_path(g.outer); ctx.clip();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TEX.table, 0, 0); ctx.restore();   // exact table behind (shake-proof)
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000); for (let i = g.outer.length - 1; i >= 0; i--) i === g.outer.length - 1 ? ctx.moveTo(...g.outer[i]) : ctx.lineTo(...g.outer[i]); ctx.closePath(); ctx.fill('evenodd');
    ctx.restore(); ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; f2_path(g.outer); ctx.stroke();      // white paper core of the cut
    ctx.strokeStyle = 'rgba(35,22,41,.22)'; ctx.lineWidth = 1.2; f2_path(g.outer); ctx.stroke();
  });
}
/** container interior (s5 door flap open): a box seen through the opening — far wall, ceiling, floor, side walls, ribs */
function f2_interior(g) {
  const P = g.pts, kf = .62, VP = [0, -14], F = P.map(([x, y]) => [VP[0] + (x - VP[0]) * kf, VP[1] + (y - VP[1]) * kf]);
  const [TL, TR, BR, BL] = P, [fTL, fTR, fBR, fBL] = F, L = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  const plane = (Q, col) => { ctx.fillStyle = col; f2_path(Q); ctx.fill(); };
  const lines = (a0, a1, b0, b1, step, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; for (let u = step; u < 1 - step * .3; u += step) { ctx.beginPath(); ctx.moveTo(...L(a0, a1, u)); ctx.lineTo(...L(b0, b1, u)); ctx.stroke(); } };
  ctx.save(); f2_path(P); ctx.clip();
  plane(F, '#3E2915'); lines(fTL, fTR, fBL, fBR, .035, 'rgba(0,0,0,.32)', 3); lines(fTL, fTR, fBL, fBR, .035, 'rgba(255,210,160,.06)', 1.5);
  plane([TL, TR, fTR, fTL], '#21150A');
  plane([TL, fTL, fBL, BL], '#4A321D'); lines(TL, fTL, BL, fBL, .2, 'rgba(0,0,0,.3)', 3);
  plane([TR, BR, fBR, fTR], '#583B20'); lines(TR, fTR, BR, fBR, .12, 'rgba(0,0,0,.28)', 3);
  plane([BL, BR, fBR, fBL], '#80593A'); lines(BL, BR, fBL, fBR, .07, 'rgba(40,22,8,.35)', 2);
  const lg = ctx.createRadialGradient(...L(BL, BR, .55), 0, ...L(BL, BR, .55), Math.hypot(BR[0] - BL[0], BR[1] - BL[1]) * .7);   // daylight from the opening
  lg.addColorStop(0, 'rgba(255,214,160,.22)'); lg.addColorStop(1, 'rgba(255,214,160,0)'); ctx.fillStyle = lg; f2_path(P); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(...P[i]); ctx.lineTo(...F[i]); ctx.stroke(); }
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 12;    // lip shadow
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000); for (let i = P.length - 1; i >= 0; i--) i === P.length - 1 ? ctx.moveTo(...P[i]) : ctx.lineTo(...P[i]); ctx.closePath(); ctx.fill('evenodd');
  ctx.restore(); ctx.restore();
}
/** scissors sprite with a cream halo (reads on dark footage and on paper), cached open / closed */
const _f2sc = {};
function f2_scissorSprite(open) {
  const key = open ? 'o' : 'c'; if (_f2sc[key]) return _f2sc[key];
  const a = makeCanvas(400, 240), out = makeCanvas(400, 240), prev = ctx;
  try { ctx = a.getContext('2d'); ctx.translate(150, 120); scissors(open ? .5 : .1, '#2B2230'); } finally { ctx = prev; }
  const g = out.getContext('2d'); g.filter = 'brightness(0) invert(1)';
  for (let i = 0; i < 12; i++) g.drawImage(a, Math.cos(i * Math.PI / 6) * 7, Math.sin(i * Math.PI / 6) * 7);
  g.filter = 'none'; g.drawImage(a, 0, 0);
  return (_f2sc[key] = out);
}
function f2_scissors(head, ang, k) {
  const sp = f2_scissorSprite(Math.floor(k * 14) % 2 === 0);
  at(head[0], head[1], ang, .36, .36, () => { ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 22; ctx.shadowOffsetY = 40;
    ctx.drawImage(sp, -190, -120); ctx.restore(); });
}
/** shared sticker engine (container + polygons). o: {clip, srcT, fr, rimK, lift, x, y, s, r, liftScale, hole, sticker,
 *  alpha, clipQuad, flapK, label(pose|null), develop, blend, over(g), scissors} */
function f2_sticker(g, R, o) {
  const a = o.alpha ?? 1; if (a <= 0) return null;
  const home = f2_home(g, R), rimK = o.rimK ?? 1, lift = Math.max(0, o.lift || 0);
  const pose = { x: o.x ?? home.x, y: o.y ?? home.y, r: o.r ?? home.r, s: (o.s ?? 1) * (o.liftScale === false ? 1 : 1 + .05 * clamp(lift / 30)) };
  ctx.save(); ctx.globalAlpha *= a;
  if (o.clipQuad) { f2_path(o.clipQuad); ctx.clip(); }
  if (o.hole) f2_hole(g, R);
  if (o.sticker !== false) at(pose.x, pose.y, pose.r, pose.s, pose.s, () => {
    const P = g.pic, flapK = clamp(o.flapK || 0);
    if (rimK >= 1) {                                                    // the white paper the image sits on
      ctx.save(); ctx.lineJoin = 'round';
      if (lift > .3) { const hh = lift; ctx.shadowColor = C.shadow + (.32 - .1 * clamp(hh / 200)) + ')'; ctx.shadowBlur = 6 + .5 * hh; ctx.shadowOffsetX = 4 + .35 * hh; ctx.shadowOffsetY = 7 + .6 * hh; }
      ctx.fillStyle = F2_PAPER; f2_path(g.outer); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 1.4; f2_path(g.outer); ctx.stroke();
    }
    const face = () => {
      ctx.save(); f2_path(g.pts); ctx.clip();
      (o.blend ? vidBlend : vidCover)(o.clip, o.srcT, P.x, P.y, P.w, P.h, o.fr || {});
      if (o.develop != null && o.develop < 1) { const d = clamp(o.develop), cx = P.x + P.w / 2, cy = P.y + P.h / 2, gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(P.w, P.h) / 2);
        gg.addColorStop(0, `rgba(240,234,220,${clamp(1.25 - d * 1.6)})`); gg.addColorStop(1, `rgba(236,228,210,${clamp(1.05 - d * 1.05)})`); ctx.fillStyle = gg; ctx.fillRect(P.x, P.y, P.w, P.h); }
      const gl = ctx.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h); gl.addColorStop(0, 'rgba(255,255,255,.12)'); gl.addColorStop(.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.10)');
      ctx.fillStyle = gl; ctx.fillRect(P.x, P.y, P.w, P.h);
      if (lift > .3) { ctx.fillStyle = `rgba(255,250,240,${.07 * clamp(lift / 30)})`; ctx.fillRect(P.x, P.y, P.w, P.h); }   // closer to the lamp
      ctx.restore();
      if (o.label) at(o.label.x, o.label.y, o.label.r, o.label.s, o.label.s, f2_mini);
      if (o.over) o.over(g);
    };
    if (flapK <= 0) face();
    else {                                                              // door flap hinged on the bottom edge (BL → BR)
      f2_interior(g);
      const B = g.pts[3], E = g.pts[2], an = Math.atan2(E[1] - B[1], E[0] - B[0]), sY = lerp(1, -.35, flapK);
      ctx.save(); ctx.translate(B[0], B[1]); ctx.rotate(an); ctx.scale(1, Math.abs(sY) < .02 ? .02 * Math.sign(sY || 1) : sY); ctx.rotate(-an); ctx.translate(-B[0], -B[1]);
      if (sY > 0) { face(); ctx.fillStyle = `rgba(20,10,4,${.38 * (1 - sY)})`; f2_path(g.pts); ctx.fill(); }
      else {
        ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = -10;
        ctx.fillStyle = '#FAF7F0'; f2_path(g.pts); ctx.fill(); ctx.restore();
        const mx = (g.pts[0][0] + g.pts[1][0]) / 2, my = (g.pts[0][1] + g.pts[1][1]) / 2, bx = (B[0] + E[0]) / 2, by = (B[1] + E[1]) / 2;
        const sh = ctx.createLinearGradient(bx, by, mx, my); sh.addColorStop(0, 'rgba(60,32,12,.30)'); sh.addColorStop(.35, 'rgba(60,32,12,.06)'); sh.addColorStop(1, 'rgba(255,255,255,.18)');
        ctx.fillStyle = sh; f2_path(g.pts); ctx.fill();
        ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 2; f2_path(g.pts); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...B); ctx.lineTo(...E); ctx.stroke();   // hinge crease
    }
    if (rimK > 0 && rimK < 1) {                                        // the cut running round: white rim band + cut line + scissors
      const pm = f2_partial(g.mid, g.midL, rimK), po = f2_partial(g.outer, g.outL, rimK);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.strokeStyle = F2_PAPER; ctx.lineWidth = F2_RIM; ctx.beginPath(); ctx.moveTo(...pm.pts[0]); for (const p of pm.pts) ctx.lineTo(...p); ctx.stroke();
      ctx.strokeStyle = 'rgba(35,22,41,.38)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(...po.pts[0]); for (const p of po.pts) ctx.lineTo(...p); ctx.stroke();
      ctx.restore();
      if (o.scissors !== false) f2_scissors(pm.head, pm.ang, rimK);
    }
  });
  ctx.restore();
  return pose;
}

/**
 * The B 9.0 container as a paper sticker (s4: cut + lift + fly into the door; s5: drop, door flap, slide out).
 * o: rect (print it was cut from, default HP_PRINT — pass the print's CURRENT rect incl. drift),
 *    x, y, s, r (pose; each defaults to the home pose on rect), lift (0 → 30; shadow + auto scale ×1.05 at 30, liftScale:false to stop it),
 *    rimK (0..1 cut running round, 1 = cut done; default 1), flapK (0..1 door folds down: scaleY 1 → −0.35 about the bottom edge),
 *    hole (true: also draw the container-shaped hole in the print at rect), sticker (false: hole only),
 *    alpha, clipQuad (screen polygon clip, e.g. the doorway), label (default true: « VOTRE COLIS » mini label over the ghost),
 *    develop (0..1, same fog as the print), scissors (default true while cutting).
 * Returns the pose drawn {x, y, s, r} (for the lead thread / arrows use hp_contPt(nx, ny, pose)).
 */
function hp_container(t, o = {}) {
  const R = o.rect || HP_PRINT, g = f2_geom(HP_CONT.quad, R.w, R.h, HP_CONT.fr), L = HP_CONT.label, l = f2_frameLocal(L.nx, L.ny, R.w, R.h, HP_CONT.fr);
  const label = o.label === false ? null : { x: l[0] - g.c[0], y: l[1] - g.c[1], s: L.s * R.w / 600, r: L.r };
  return f2_sticker(g, R, Object.assign({}, o, { clip: HP_CONT.clip, srcT: HP_CONT.t, fr: HP_CONT.fr, label }));
}
/**
 * Polygon sticker cut from a frozen frame (s5: the real 2-box stack). poly = frame-normalised [[nx,ny]…] (convex, clockwise
 * or not), rect = the print it lies on (current rect), fr = that print's framing, rimK 0..1 cut, lift 0 → 24–30.
 * o: x, y, s, r (pose, default home), liftScale, hole, sticker, alpha, clipQuad, develop, blend, scissors,
 *    over(g) — drawn on top in sticker-local coords (g.pts = polygon) e.g. the violet tape strips.
 */
function hp_polyCut(clip, srcT, poly, rect, fr, rimK, lift, o = {}) {
  const R = rect || HP_PRINT, g = f2_geom(poly, R.w, R.h, fr || {});
  return f2_sticker(g, R, Object.assign({}, o, { clip, srcT, fr: fr || {}, rimK, lift }));
}

// ---------------------------------------------------------------- T6 peel
function f2_halfPlane(poly, f, sg) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = sg * f(a[0], a[1]), fb = sg * f(b[0], b[1]);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); }
  }
  return out;
}
/**
 * Corner peel of a full-screen layer (§2.3 T6). drawFront() draws the layer in screen coords; what is peeled away is simply
 * not drawn, so the layers below (s5 table) show through. Bottom-right corner C = (1080, 1920) travels to P(k) with a lift
 * −220·sin(πk); fold = perpendicular bisector of C→P; flap = bare paper back (nothing mirrored), shadow on the table.
 * The end point is (−1240, −2200) (not the storyboard's (−240, −320), which leaves a triangle of the sheet on screen at k = 1);
 * o.to overrides it. o.mode = 'slide' → fallback: the sheet slides up off-frame with a curl shadow. Logs `paper_peel`.
 * Returns k (0..1). Before t0 the front is drawn whole; after t0 + dur nothing is drawn.
 */
function hp_peel(t, t0, dur, drawFront, o = {}) {
  if (o.sfx !== false) hp_sfx('paper_peel', t0);
  const k = prog(t, t0, t0 + dur);
  if (k <= 0) { ctx.save(); drawFront(); ctx.restore(); return 0; }
  if (k >= 1) return 1;
  if (o.mode === 'slide') {
    const e = eInCubic(k), dy = -(H + 320) * e, by = H + dy, cl = 70 * Math.sin(Math.PI * clamp(k * 1.4));
    const sg = ctx.createLinearGradient(0, by, 0, by + 70); sg.addColorStop(0, `rgba(60,32,12,${.34 * (1 - e)})`); sg.addColorStop(1, 'rgba(60,32,12,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, by, W, 70);
    ctx.save(); ctx.translate(0, dy); ctx.beginPath(); ctx.rect(-40, -40, W + 80, H + 40 - cl); ctx.clip(); drawFront(); ctx.restore();
    if (cl > 1) { const g2 = ctx.createLinearGradient(0, by - cl, 0, by); g2.addColorStop(0, 'rgba(60,32,12,.25)'); g2.addColorStop(.4, '#F4EEDC'); g2.addColorStop(1, '#FBF7EC');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(-40, by - cl); ctx.quadraticCurveTo(W / 2, by - cl * 1.25, W + 40, by - cl); ctx.lineTo(W + 40, by - cl * .2); ctx.quadraticCurveTo(W / 2, by + cl * .1, -40, by - cl * .2); ctx.closePath(); ctx.fill(); }
    return k;
  }
  const e = eInOutCubic(k), to = o.to || [-1240, -2200], Cx = W, Cy = H;
  const Px = lerp(Cx, to[0], e), Py = lerp(Cy, to[1], e) - 220 * Math.sin(Math.PI * k);
  const Mx = (Cx + Px) / 2, My = (Cy + Py) / 2; let dx = Px - Cx, dy = Py - Cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const side = (x, y) => (x - Mx) * dx + (y - My) * dy;               // > 0 : still lying (spine side)
  const sheet = [[-60, -60], [W + 60, -60], [W + 60, H + 60], [-60, H + 60]];
  const keep = f2_halfPlane(sheet, side, 1), gone = f2_halfPlane(sheet, side, -1);
  const curlW = o.curl ?? lerp(140, 320, clamp(k * 3));                // the flap curls up toward the lens beyond this band
  const flap = f2_halfPlane(gone.map(([x, y]) => { const s = side(x, y); return [x - 2 * s * dx, y - 2 * s * dy]; }), (x, y) => curlW - side(x, y), 1);
  if (gone.length > 2) {                                               // (3) soft shadow on the revealed table along the fold
    const g1 = ctx.createLinearGradient(Mx, My, Mx - dx * 170, My - dy * 170);
    g1.addColorStop(0, 'rgba(60,32,12,.52)'); g1.addColorStop(.1, 'rgba(60,32,12,.28)'); g1.addColorStop(.4, 'rgba(60,32,12,.08)'); g1.addColorStop(1, 'rgba(60,32,12,0)');
    ctx.fillStyle = g1; f2_path(gone); ctx.fill();
  }
  if (keep.length > 2) {                                               // (1) the front, clipped to the spine side
    ctx.save(); f2_path(keep); ctx.clip(); drawFront();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; const ex = -dy * 3000, ey = dx * 3000;
    ctx.beginPath(); ctx.moveTo(Mx - ex, My - ey); ctx.lineTo(Mx + ex, My + ey); ctx.stroke();
    ctx.restore();
  }
  if (flap.length > 2) {                                               // (2) the flap: bare paper back, curl shading
    const g2 = ctx.createLinearGradient(Mx, My, Mx + dx * curlW, My + dy * curlW);                    // a rolled cylinder
    g2.addColorStop(0, '#C8B99E'); g2.addColorStop(.07, '#E6DCC6'); g2.addColorStop(.3, '#FFFFFB'); g2.addColorStop(.62, '#F4EDDF'); g2.addColorStop(1, '#D3C5AB');
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.38)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = 18; ctx.shadowOffsetY = 30;
    ctx.fillStyle = g2; f2_path(flap); ctx.fill(); ctx.restore();
    ctx.save(); f2_path(flap); ctx.clip(); ctx.globalAlpha *= .3; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(TEX.table, 0, 0); ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.2)'; ctx.lineWidth = 1.5; f2_path(flap); ctx.stroke();
  }
  return k;
}

// ---------------------------------------------------------------- measurement note (HP_CONT, gate G2)
// Measured on foot/up/B/00270.jpg (1080×1920) by colour key + visual check:
//   container: TL (277, 484) · TR (1080, 34) · BR (1080, 1192) · BL (279, 1063) px — the right end is the frame edge.
//   star-outline ghost: x 377–542, y 487–922 px → normalised [.349, .254, .502, .480]; centre (.4255, .367).
// HP_CONT.fr differs from the storyboard's {fx .62, fy .50, zoom 1.25}: that crop cut the container's top edge (the sticker
// became a pentagon chopped by the print border) and left the label only ~3 px of margin over the ghost. With
// {fx .60, fy .319, zoom 1.2} the whole container is in P4b (frame x 180–1080, y 12–1212, shop sign still cropped) and
// the label (s 1.16 → 183×334 incl. its kraft rim) covers the ghost (110×290 on screen) with ≥ 22 px all round.
// P4b MUST be drawn with HP_CONT.fr (hp_printAt(rect, 'B', HP_CONT.t, Object.assign({}, HP_CONT.fr, {…}))).
