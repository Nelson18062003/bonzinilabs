'use strict';
// =============================================================================================
// 05_footage.js — draws the EDL of the score (00_edl.js): every visible shot, its transitions, the overlays.
// Functions only; 50_compose.js calls FT_draw(t, n) first (bottom layer); the engine lays FT_grain(n) over everything
// once per frame (through window.COMPOSE_GRAIN).
//
// Per shot and per motion-blur sub-sample (SCORE.active(t) → {shot, fx, R, crop, frames}):
//   1. CONTENT LAYER (region-sized offscreen): the frame(s) through the crop window (SOURCE px → region px, rotation),
//      slow-motion blend of the two neighbour frames, the HIDE boxes in source px under the same transform (so they stay
//      glued to the pixels under any crop / zoom / rotation): 'mosaic' (box → tiny canvas, area-averaged, back up
//      nearest-neighbour; cells fixed in SOURCE px), 'blur' (box + pad → 96 px → 32 → 6–16 px → back up with smoothing,
//      feathered with a gaussian mask that stays opaque on the box), 'cover' (solid); then the GRADE with canvas
//      compositing only (exposure: 'lighter' self-add / black; contrast: 'overlay' self-blend; saturation > 1: 'lighter'
//      self-add then 'luminosity' restores the light; < 1: 'saturation' grey; warmth: 'soft-light' tint; vignette).
//   2. COMPOSITE onto the film with the transition motion: offset + mirrored tiles (a whip never shows an edge),
//      directional motion blur by repeated doubling (2^n taps in n passes, half resolution for big smears), zoom, alpha,
//      exposure lift / darkening, iris clip + ring, slide drop shadow; 'card' (tilted photo, white border, shadow) and
//      'window' (rounded inset, border, shadow) layouts.
//   3. OVERLAYS (SCORE.overlays(t)): pane seams, the white FLASH, the container DOORS — two swinging steel doors drawn in
//      perspective (36 vertical strips per door), procedural ribbed texture (corrugations, lock rods, cams, handles,
//      hinges, seal, rust streaks), the inside going dark as they close, slam shake, optional Bonzini logo + stencil split
//      on the seam (violet only because it IS the Bonzini mark).
// Pure functions of t (n only for the grain); no ctx.filter, no Math.random (rnd() from kit.js).
// =============================================================================================
const FT = (function () {
  const S = window.SCORE, EDL = window.EDL, kk = EDL.kk, cl = EDL.cl, lerp = EDL.lerp;
  const DIAG = { layers: 0, smears: 0 };
  // ---------- offscreen canvas pool (by role and size; sequential reuse inside a frame) ----------
  const POOL = {};
  function cnv(role, w, h) {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); const k = `${role}:${w}x${h}`;
    return POOL[k] || (POOL[k] = makeCanvas(w, h));
  }
  function ctx2(c) { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.shadowColor = 'transparent'; return g; }
  function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // =====================================================================================================================
  // 1. content layer
  // =====================================================================================================================
  function content(a, t) {
    const s = a.shot, R = a.R, c = a.crop, lw = Math.round(R.w), lh = Math.round(R.h);
    const L = cnv('L', lw, lh), g = ctx2(L);
    g.fillStyle = '#000'; g.fillRect(0, 0, lw, lh);
    const k = lw / c.w, rot = c.rot * Math.PI / 180;
    const xf = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.translate(lw / 2, lh / 2); if (rot) g.rotate(rot); g.scale(k, k); g.translate(-c.cx, -c.cy); };
    for (const q of a.frames) {
      const img = window.clipImg(s.clip, q.f); if (!img) continue;
      xf(); g.globalAlpha = q.a; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, s.dims.w, s.dims.h);
      hides(g, img, s, q.f / EDL.FPS, a, t, xf);
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    grade(L, g, s.gradeAt(t), lw, lh);
    DIAG.layers++;
    return L;
  }
  // ---------- hide boxes (SOURCE px, drawn under the shot's own transform) ----------
  function hides(g, img, s, sf, a, t, xf) {
    for (const h of s.hides) {
      if (h.kind === 'gauss') continue;                 // baked into the prepared frames by tools/prep_clips.py (SERIE §3.8)
      if (!h.activeAt(sf, t)) continue;
      const b0 = h.boxAt(sf); if (!b0) continue;
      const x0 = Math.max(0, b0[0]), y0 = Math.max(0, b0[1]), x1 = Math.min(s.dims.w, b0[0] + b0[2]), y1 = Math.min(s.dims.h, b0[1] + b0[3]);
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      const b = [x0, y0, x1 - x0, y1 - y0], ip = img.width / s.dims.w;            // image px per source px
      const ga = g.globalAlpha;
      if (h.kind === 'cover') { xf(); g.fillStyle = h.color || '#231629'; rr(g, b[0], b[1], b[2], b[3], h.r || 0); g.fill(); }
      else if (h.kind === 'blur') blurBox(g, img, b, ip, h, xf, s);
      else mosaic(g, img, b, ip, h, xf);
      g.globalAlpha = ga; g.imageSmoothingEnabled = true;
    }
  }
  function mosaic(g, img, b, ip, h, xf) {
    const long = Math.max(b[2], b[3]), n = h.cells || cl(Math.round(long / 6), 4, 12), cell = long / n;
    const nx = Math.max(1, Math.round(b[2] / cell)), ny = Math.max(1, Math.round(b[3] / cell));
    const cw = nx * cell, ch = ny * cell, X = b[0] + b[2] / 2 - cw / 2, Y = b[1] + b[3] / 2 - ch / 2;
    const tiny = cnv('mos', nx, ny), tg = ctx2(tiny); tg.clearRect(0, 0, nx, ny);
    const sx = Math.max(0, X * ip), sy = Math.max(0, Y * ip), sw = Math.min(img.width - sx, cw * ip), sh = Math.min(img.height - sy, ch * ip);
    tg.drawImage(img, sx, sy, sw, sh, 0, 0, nx, ny);
    xf(); g.imageSmoothingEnabled = false; g.drawImage(tiny, 0, 0, nx, ny, X, Y, cw, ch); g.imageSmoothingEnabled = true;
  }
  function blurBox(g, img, b, ip, h, xf, s) {
    const pad = Math.max(b[2], b[3]) * .35;
    const X0 = Math.max(0, b[0] - pad), Y0 = Math.max(0, b[1] - pad), X1 = Math.min(s.dims.w, b[0] + b[2] + pad), Y1 = Math.min(s.dims.h, b[1] + b[3] + pad);
    const bw = X1 - X0, bh = Y1 - Y0, s1 = 96 / Math.max(bw, bh), w1 = Math.max(2, Math.round(bw * s1)), h1 = Math.max(2, Math.round(bh * s1));
    const c1 = cnv('bl1', w1, h1), g1 = ctx2(c1); g1.clearRect(0, 0, w1, h1);
    g1.drawImage(img, X0 * ip, Y0 * ip, bw * ip, bh * ip, 0, 0, w1, h1);
    const L2 = lerp(16, 6, cl(h.strength !== undefined ? h.strength : .6)), q = L2 / 96;          // the smallest pass (long side px)
    const w3 = Math.max(2, Math.round(w1 / 3)), h3 = Math.max(2, Math.round(h1 / 3)), w2 = Math.max(2, Math.round(w1 * q)), h2 = Math.max(2, Math.round(h1 * q));
    const c3 = cnv('bl3', w3, h3), g3 = ctx2(c3); g3.clearRect(0, 0, w3, h3); g3.drawImage(c1, 0, 0, w3, h3);
    const c2 = cnv('bl2', w2, h2), g2 = ctx2(c2); g2.clearRect(0, 0, w2, h2); g2.drawImage(c3, 0, 0, w2, h2);
    g3.clearRect(0, 0, w3, h3); g3.drawImage(c2, 0, 0, w3, h3);                                       // back up in two smooth steps
    g1.clearRect(0, 0, w1, h1); g1.drawImage(c3, 0, 0, w1, h1);
    // feather: a gaussian mask (shadow of an off-canvas rect), opaque on the box, gone at the pad's edge
    const m = cnv('blm', w1, h1), gm = ctx2(m); gm.clearRect(0, 0, w1, h1);
    const B = Math.max(1, pad * s1 / 2), ix = (b[0] - X0) * s1 - B, iy = (b[1] - Y0) * s1 - B, iw = b[2] * s1 + 2 * B, ihh = b[3] * s1 + 2 * B;
    gm.shadowColor = '#000'; gm.shadowBlur = B; gm.shadowOffsetX = 4000; gm.fillStyle = '#000'; gm.fillRect(ix - 4000, iy, iw, ihh);
    g1.globalCompositeOperation = 'destination-in'; g1.drawImage(m, 0, 0); g1.globalCompositeOperation = 'source-over';
    xf(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c1, 0, 0, w1, h1, X0, Y0, bw, bh);
  }
  // ---------- grade (compositing only) ----------
  function grade(L, g, gr, w, h) {
    if (!gr) return;
    const copy = () => { const c = cnv('G', w, h), cg = ctx2(c); cg.globalCompositeOperation = 'copy'; cg.drawImage(L, 0, 0); return c; };
    const reset = () => { g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; };
    const e = gr.exposure || 0, c = gr.contrast || 0, sat = gr.sat !== undefined ? gr.sat : 1, wm = gr.warmth || 0, vg = gr.vignette || 0;
    if (Math.abs(e) > 1e-3) {
      const m = Math.pow(2, e);
      if (m > 1) { const cp = copy(); g.globalCompositeOperation = 'lighter'; for (let r = m - 1; r > 1e-3; r -= 1) { g.globalAlpha = Math.min(1, r); g.drawImage(cp, 0, 0); } }
      else { g.globalAlpha = 1 - m; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
      reset();
    }
    if (c > 1e-3) { const cp = copy(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = Math.min(1, c); g.drawImage(cp, 0, 0); reset(); }
    else if (c < -1e-3) { g.globalAlpha = Math.min(1, -c * .6); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); reset(); }
    if (sat > 1.002) {
      const cp = copy(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, sat - 1); g.drawImage(cp, 0, 0);
      g.globalCompositeOperation = 'luminosity'; g.globalAlpha = 1; g.drawImage(cp, 0, 0); reset();
    } else if (sat < .998) { g.globalCompositeOperation = 'saturation'; g.globalAlpha = Math.min(1, 1 - sat); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); reset(); }
    if (Math.abs(wm) > 1e-3) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = Math.min(1, Math.abs(wm) * 1.6); g.fillStyle = wm > 0 ? '#FF9A3C' : '#3C8CFF'; g.fillRect(0, 0, w, h); reset(); }
    if (gr.tint) { g.globalAlpha = gr.tint[1]; g.fillStyle = gr.tint[0]; g.fillRect(0, 0, w, h); reset(); }
    if (vg > 0) {
      const hy = Math.hypot(w, h) / 2, v = g.createRadialGradient(w / 2, h / 2, hy * .38, w / 2, h / 2, hy * 1.02);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.55, `rgba(0,0,0,${(vg * .45).toFixed(3)})`); v.addColorStop(1, `rgba(0,0,0,${vg.toFixed(3)})`);
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    }
  }

  // =====================================================================================================================
  // 2. composite with the transition motion
  // =====================================================================================================================
  /** directional motion blur: 2^n taps along (ux, uy) spanning px, in n doubling passes; half resolution beyond 120 px.
   *  The work canvas is padded by px/2 along the motion, so a blurred edge fades out fully instead of being cut at 50 %.
   *  Returns {c, s (draw scale), px, py (the padding, in source px: draw at ox − px, oy − py)} */
  function dirBlur(src, px, ux, uy, sw, sh) {
    const half = px > 120, q = half ? .5 : 1, padX = Math.ceil(Math.abs(ux) * (px / 2 + 3)), padY = Math.ceil(Math.abs(uy) * (px / 2 + 3));
    const w = Math.ceil((sw + 2 * padX) * q), h = Math.ceil((sh + 2 * padY) * q), P = px * q;
    let A = cnv('dbA', w, h), B = cnv('dbB', w, h);
    const ga = ctx2(A); ga.clearRect(0, 0, w, h); ga.drawImage(src, 0, 0, sw, sh, padX * q, padY * q, sw * q, sh * q);
    const n = cl(Math.ceil(Math.log2(P / 2.5 + 1)), 1, 7), step = P / (Math.pow(2, n) - 1);
    for (let i = 0; i < n; i++) {
      const d = step * Math.pow(2, i) / 2, gb = ctx2(B); gb.clearRect(0, 0, w, h);
      gb.drawImage(A, -ux * d, -uy * d); gb.globalAlpha = .5; gb.drawImage(A, ux * d, uy * d);
      const T_ = A; A = B; B = T_;
    }
    DIAG.smears++;
    return { c: A, s: 1 / q, px: padX, py: padY };
  }
  /** the content extended by mirrored tiles on the side(s) the motion reveals (+ the blur's reach) */
  function mirrorStrip(L, w, h, fx) {
    const hor = Math.abs(fx.dx) >= Math.abs(fx.dy), m = Math.min(hor ? w : h, Math.abs(hor ? fx.dx : fx.dy) + fx.smear / 2 + 2), r = fx.smear / 2 + 2;
    const d = hor ? fx.dx : fx.dy;
    const eA = Math.min(hor ? w : h, d > 0 ? m : r), eB = Math.min(hor ? w : h, d < 0 ? m : r);   // before / after the layer on the axis
    const SW_ = hor ? w + eA + eB : w, SH_ = hor ? h : h + eA + eB, C = cnv('strip', SW_, SH_), g = ctx2(C);
    g.clearRect(0, 0, SW_, SH_);
    if (hor) {
      g.drawImage(L, eA, 0);
      g.save(); g.translate(eA, 0); g.scale(-1, 1); g.drawImage(L, 0, 0); g.restore();                // mirrored, left
      g.save(); g.translate(eA + 2 * w, 0); g.scale(-1, 1); g.drawImage(L, 0, 0); g.restore();        // mirrored, right
      return { c: C, ox: -eA, oy: 0, w: SW_, h: SH_ };
    }
    g.drawImage(L, 0, eA);
    g.save(); g.translate(0, eA); g.scale(1, -1); g.drawImage(L, 0, 0); g.restore();
    g.save(); g.translate(0, eA + 2 * h); g.scale(1, -1); g.drawImage(L, 0, 0); g.restore();
    return { c: C, ox: 0, oy: -eA, w: SW_, h: SH_ };
  }
  function composite(a, L, t) {
    const R = a.R, fx = a.fx;
    if (R.kind === 'card' || R.kind === 'window') return compositeFramed(a, L, t);
    const w = L.width, h = L.height;
    let src = { c: L, ox: 0, oy: 0, w, h, s: 1 };
    if (fx.mirror && (Math.abs(fx.dx) > .5 || Math.abs(fx.dy) > .5 || fx.smear > 1.5)) src = Object.assign({ s: 1 }, mirrorStrip(L, w, h, fx));
    if (fx.smear > 1.5) { const b = dirBlur(src.c, fx.smear, fx.ux, fx.uy, src.w, src.h); src = Object.assign({}, src, { c: b.c, s: b.s, ox: src.ox - b.px, oy: src.oy - b.py }); }
    ctx.save();
    ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    if (fx.iris) { ctx.beginPath(); ctx.arc(fx.iris.cx, fx.iris.cy, Math.max(.1, fx.iris.r), 0, Math.PI * 2); ctx.clip(); }
    ctx.translate(R.x + R.w / 2 + fx.dx, R.y + R.h / 2 + fx.dy);
    if (fx.rot) ctx.rotate(fx.rot * Math.PI / 180);
    if (fx.sc !== 1) ctx.scale(fx.sc, fx.sc);
    ctx.translate(-R.w / 2, -R.h / 2);
    ctx.globalAlpha = fx.alpha;
    if (fx.edge && fx.edge.off > 1) {                       // a sliding pane casts a soft shadow on what it covers
      // only the shadow is drawn (the rect itself is 9000 px away): the pane's blurred, semi-transparent edge stays clean
      ctx.save(); ctx.shadowColor = `rgba(0,0,0,${(.55 * Math.min(1, fx.edge.a * 3)).toFixed(3)})`; ctx.shadowBlur = 46;
      ctx.shadowOffsetX = 9000 + fx.edge.ux * 16; ctx.shadowOffsetY = fx.edge.uy * 16; ctx.fillStyle = '#000'; ctx.fillRect(-9000, 0, w, h); ctx.restore();
    }
    const draw = () => ctx.drawImage(src.c, 0, 0, src.c.width, src.c.height, src.ox, src.oy, src.c.width * src.s, src.c.height * src.s);
    draw();
    if (fx.expo > 1e-3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fx.alpha * Math.min(1, fx.expo); draw(); }
    else if (fx.expo < -1e-3) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fx.alpha * Math.min(1, -fx.expo); ctx.fillStyle = '#000'; ctx.fillRect(src.ox, src.oy, src.w, src.h); }
    ctx.restore();
    if (fx.iris && fx.iris.ring && fx.iris.r > 2 && fx.iris.p < .995) {
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 7; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24;
      ctx.globalAlpha = 1 - kk(fx.iris.p, .8, .995); ctx.beginPath(); ctx.arc(fx.iris.cx, fx.iris.cy, fx.iris.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  function compositeFramed(a, L, t) {
    const R = a.R, fx = a.fx, card = R.kind === 'card', w = R.w, h = R.h, bw = R.border || 0;
    let src = { c: L, s: 1, px: 0, py: 0 };
    if (fx.smear > 1.5) src = dirBlur(L, fx.smear, fx.ux, fx.uy, L.width, L.height);
    const dw = src.c.width * src.s, dh = src.c.height * src.s, dx0 = -w / 2 - src.px, dy0 = -h / 2 - src.py;
    ctx.save();
    if (fx.iris) { ctx.beginPath(); ctx.arc(fx.iris.cx, fx.iris.cy, Math.max(.1, fx.iris.r), 0, Math.PI * 2); ctx.clip(); }   // frame included
    ctx.translate(R.x + w / 2 + fx.dx, R.y + h / 2 + fx.dy); ctx.rotate(((R.tilt || 0) + fx.rot) * Math.PI / 180); ctx.scale(fx.sc, fx.sc);
    ctx.globalAlpha = fx.alpha;
    const outer = (o = 0) => rr(ctx, -w / 2 - bw + o, -h / 2 - bw, w + 2 * bw, h + 2 * bw, card ? 6 : R.r + bw);
    if (R.shadow) {                                         // the shadow only (its shape is 9000 px away): nothing dark shows inside
      // shadowOffset is in DEVICE space: move the shape by (−9000, 0) in device space, i.e. R(−θ)·(−9000, 0)/sc locally
      // (the old outer(−9000) was wrong under a tilt: the shadow landed 9000·sin θ px away)
      const th = ((R.tilt || 0) + fx.rot) * Math.PI / 180, sc_ = fx.sc || 1;
      ctx.save(); ctx.shadowColor = `rgba(0,0,0,${(.65 * R.shadow).toFixed(3)})`; ctx.shadowBlur = 54; ctx.shadowOffsetY = 22; ctx.shadowOffsetX = 9000;
      ctx.translate(-9000 * Math.cos(th) / sc_, 9000 * Math.sin(th) / sc_); ctx.fillStyle = '#000'; outer(0); ctx.fill(); ctx.restore();
    }
    if (card) { ctx.fillStyle = '#F4EFE6'; outer(); ctx.fill(); }
    ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, card ? 3 : R.r); ctx.clip();
    ctx.drawImage(src.c, 0, 0, src.c.width, src.c.height, dx0, dy0, dw, dh);
    if (fx.expo > 1e-3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fx.alpha * Math.min(1, fx.expo); ctx.drawImage(src.c, 0, 0, src.c.width, src.c.height, dx0, dy0, dw, dh); ctx.globalCompositeOperation = 'source-over'; }
    if (card) {                                             // a faint gloss across the print
      const gl = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.08)');
      ctx.globalAlpha = fx.alpha; ctx.fillStyle = gl; ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
    if (!card && bw > 0) { ctx.strokeStyle = R.borderColor || 'rgba(255,255,255,.9)'; ctx.lineWidth = bw; rr(ctx, -w / 2 - bw / 2, -h / 2 - bw / 2, w + bw, h + bw, R.r + bw / 2); ctx.stroke(); }
    ctx.restore();
  }

  // =====================================================================================================================
  // 3. overlays
  // =====================================================================================================================
  function seam(o) {
    const R = o.R; ctx.save();
    if (R.kind === 'right') {
      const g = ctx.createLinearGradient(R.x, 0, R.x + 30, 0); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(R.x, R.y, 30, R.h); ctx.fillStyle = '#0D0912'; ctx.fillRect(R.x - 3, R.y, 6, R.h);
    } else {
      const g = ctx.createLinearGradient(0, R.y, 0, R.y + 34); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, 34); ctx.fillStyle = '#0D0912'; ctx.fillRect(R.x, R.y - 3, R.w, 6);
      ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(R.x, R.y + 3, R.w, 1);
    }
    ctx.restore();
  }
  function flash(o) {
    const R = o.R; ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = cl(o.a); ctx.fillStyle = o.color || '#FFF4E2'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = cl(o.a) * .35; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.restore();
  }
  // ---------- the container doors ----------
  const hexRgb_ = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (rgb, k, a = 1) => `rgba(${rgb.map(v => Math.round(cl(v * k, 0, 255))).join(',')},${a})`;
  const TEX = {};
  /** one door leaf (procedural, cached): side −1 = left leaf (hinge on its left), +1 = right leaf (hinge on its right) */
  function doorTex(w, h, color, logo, label, side) {
    const key = [w, h, color, logo, label, side].join('|'); if (TEX[key]) return TEX[key];
    const c = makeCanvas(w, h), g = c.getContext('2d'), base = hexRgb_(color || '#3D4650'), hingeX = side < 0 ? 0 : w;
    // body: lit from the top-left
    const bg = g.createLinearGradient(0, 0, w * .4, h); bg.addColorStop(0, shade(base, 1.18)); bg.addColorStop(1, shade(base, .82));
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const fr = Math.round(w * .045), top = Math.round(h * .035), bot = Math.round(h * .035);
    // horizontal corrugations: high flat, slope in shadow, low flat, lit slope
    const ribs = 7, y0 = top + fr * .5, H_ = h - top - bot - fr, P = H_ / ribs;
    for (let i = 0; i < ribs; i++) {
      const y = y0 + i * P, a1 = P * .36, s1 = P * .14, a2 = P * .36, s2 = P * .14;
      const band = (yy, hh, k, k2) => { const gr = g.createLinearGradient(0, yy, 0, yy + hh); gr.addColorStop(0, shade(base, k)); gr.addColorStop(1, shade(base, k2 ?? k)); g.fillStyle = gr; g.fillRect(fr, yy, w - 2 * fr, hh + .5); };
      band(y, a1, 1.10, 1.02); band(y + a1, s1, .70, .55); band(y + a1 + s1, a2, .86, .80); band(y + a1 + s1 + a2, s2, 1.32, 1.10);
    }
    // frame: darker steel with a bevel
    g.fillStyle = shade(base, .74); g.fillRect(0, 0, w, top); g.fillRect(0, h - bot, w, bot); g.fillRect(0, 0, fr, h); g.fillRect(w - fr, 0, fr, h);
    g.fillStyle = shade(base, 1.35, .55); g.fillRect(0, top - 2, w, 2); g.fillRect(fr - 2, 0, 2, h);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h - bot, w, 2); g.fillRect(w - fr, 0, 2, h);
    // hinges on the hinge edge
    for (const yy of [.12, .37, .63, .88]) {
      const hx = side < 0 ? 0 : w - fr * 1.25, hy = h * yy;
      g.fillStyle = shade(base, .55); g.fillRect(hx, hy - h * .025, fr * 1.25, h * .05);
      g.fillStyle = shade(base, 1.4, .6); g.fillRect(hx, hy - h * .025, fr * 1.25, 3);
    }
    // rubber seal on the free edge
    g.fillStyle = '#121418'; g.fillRect(side < 0 ? w - w * .022 : 0, 0, w * .022, h);
    // two lock rods with guides, cams top and bottom, a handle at mid height
    for (const fx_ of [.30, .72]) {
      const rx = side < 0 ? w * fx_ : w * (1 - fx_), rw = Math.max(6, w * .03);
      const rg = g.createLinearGradient(rx - rw / 2, 0, rx + rw / 2, 0);
      rg.addColorStop(0, '#22262B'); rg.addColorStop(.35, '#B8BEC6'); rg.addColorStop(.6, '#7C838C'); rg.addColorStop(1, '#1C1F23');
      g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10; g.shadowOffsetX = 5 * -side; g.shadowOffsetY = 4;
      g.fillStyle = rg; g.fillRect(rx - rw / 2, h * .025, rw, h * .95); g.restore();
      for (const yy of [.10, .30, .70, .90]) { g.fillStyle = shade(base, .62); g.fillRect(rx - rw * 1.1, h * yy - h * .012, rw * 2.2, h * .024); g.fillStyle = shade(base, 1.3, .5); g.fillRect(rx - rw * 1.1, h * yy - h * .012, rw * 2.2, 2); }
      for (const yy of [.04, .96]) { g.fillStyle = '#2A2E33'; g.fillRect(rx - rw * 1.4, h * yy - h * .016, rw * 2.8, h * .032); }
      // the handle: a lever from the rod towards the free edge, in its retainer
      const hy = h * .66, hl = w * .17 * (side < 0 ? 1 : -1);
      g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
      g.strokeStyle = '#9AA1A9'; g.lineWidth = Math.max(5, w * .016); g.lineCap = 'round'; g.beginPath(); g.moveTo(rx, hy); g.lineTo(rx + hl, hy + h * .006); g.stroke(); g.restore();
      g.fillStyle = '#2B2F35'; g.fillRect(rx + hl * .78 - w * .02, hy - h * .018, w * .04, h * .036);
    }
    // grime: rust runs under the ribs, speckles (deterministic)
    for (let i = 0; i < 220; i++) {
      const x = fr + rnd(i * 3.1 + side * 7) * (w - 2 * fr), y = top + rnd(i * 5.7 + side * 3) * (h - top - bot), l = 8 + rnd(i * 1.9) * h * .06;
      g.fillStyle = rnd(i * 2.3) > .5 ? `rgba(120,70,40,${(.05 + rnd(i * 4.4) * .12).toFixed(3)})` : `rgba(10,10,12,${(.04 + rnd(i * 6.1) * .08).toFixed(3)})`;
      g.fillRect(x, y, 1 + rnd(i * 8.2) * 2.2, l);
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd(i) > .5 ? '255,255,255' : '0,0,0'},${(.03 + rnd(i * 1.7) * .05).toFixed(3)})`; g.fillRect(rnd(i * 2.9 + side) * w, rnd(i * 3.3 + side) * h, 2, 2); }
    // the Bonzini mark + stencil, centred on the seam (each leaf carries its half; they split as the doors open)
    if (logo) {
      const seamX = side < 0 ? w : 0, sz = w * .66, ly = h * .36;
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
      const prev = ctx; ctx = g; drawLogo(seamX, ly, sz, { alpha: .94 }); ctx = prev;      // drawLogo: (x, y) = centre
      if (label) { g.font = `900 ${Math.round(w * .2)}px Stencil`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,240,232,.93)';
        g.letterSpacing = `${Math.round(w * .012)}px`; g.fillText(label, seamX, ly + sz * .58 + w * .17); g.letterSpacing = '0px'; }
      // paint wear over the mark
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { g.globalAlpha = .25 + rnd(i * 7.7) * .5; g.beginPath(); g.arc(seamX + (rnd(i * 1.3 + 2) - .5) * sz * 1.4, ly + (rnd(i * 2.1 + 5) - .3) * sz * 1.3, .6 + rnd(i * 3.9) * 2.4, 0, 7); g.fill(); }
      g.restore();
    }
    TEX[key] = c; return c;
  }
  /** draws both leaves for one door state into g (region-local px) */
  function leaves(g, R, tr, st) {
    const th = st.theta, cx = R.w / 2, cy = R.h / 2, F = 1.35 * Math.max(R.w, R.h);        // strong perspective: the
    const wd = R.w / 2 + 1, hd = R.h * 1.1, TW = Math.round(wd), TH = Math.round(hd);       // leaves swing at the lens
    const label = tr.logo ? (tr.label !== undefined ? tr.label : 'BONZINI') : '';
    g.save(); g.translate(st.shakeX, st.shakeY);
    for (const side of [-1, 1]) {
      const tex = doorTex(TW, TH, tr.color, !!tr.logo, label, side), hingeX = side < 0 ? 0 : R.w, N_ = 40;
      const X = u => hingeX - side * u * wd * Math.cos(th), Z = u => u * wd * Math.sin(th), Pp = u => F / (F - Z(u));
      const sx = u => cx + (X(u) - cx) * Pp(u);
      for (let i = 0; i < N_; i++) {
        const u0 = i / N_, u1 = (i + 1) / N_, x0 = sx(u0), x1 = sx(u1), p = Pp((u0 + u1) / 2), hh = hd * p;
        const xa = Math.min(x0, x1), ww = Math.abs(x1 - x0) + .8; if (ww < .3 || xa > R.w || xa + ww < 0) continue;
        const tx = side < 0 ? u0 * TW : TW - u1 * TW;
        g.drawImage(tex, tx, 0, TW / N_, TH, xa, cy - hh / 2, ww, hh);
        const sh = .55 * Math.sin(th) * (.7 + .3 * u0);                                // the leaf turns away from the light
        if (sh > .01) { g.fillStyle = `rgba(0,0,0,${sh.toFixed(3)})`; g.fillRect(xa, cy - hh / 2, ww, hh); }
      }
      if (th > .02) {                                                                   // the leaf's thickness at its free edge
        const xe = sx(1), pe = Pp(1), tw = Math.max(2, wd * .035 * Math.sin(th) * pe);
        g.fillStyle = '#121418'; g.fillRect(side < 0 ? xe : xe - tw, cy - hd * pe / 2, tw, hd * pe);
      }
    }
    // light on the steel: a soft key from the top-left, falloff to the corners; the seam's shadow when closed
    const k = 1 - Math.min(1, th / (Math.PI / 2));
    if (k > .01) {
      g.globalAlpha = k;
      const v = g.createRadialGradient(R.w * .35, R.h * .3, R.h * .1, R.w * .5, R.h * .55, R.h * .85);
      v.addColorStop(0, 'rgba(255,240,215,.10)'); v.addColorStop(.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
      g.fillStyle = v; g.fillRect(-20, -20, R.w + 40, R.h + 40);
      if (th < .01) { const sg = g.createLinearGradient(cx - 26, 0, cx + 26, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(.5, 'rgba(0,0,0,.75)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(cx - 26, 0, 52, R.h); }
      g.globalAlpha = 1;
    }
    g.restore();
  }
  function doors(o, t) {
    const R = o.R, tr = o.tr, w = Math.round(R.w), h = Math.round(R.h);
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    if (o.dark > 0) { ctx.fillStyle = `rgba(4,3,6,${(.82 * Math.pow(o.dark, 1.5)).toFixed(3)})`; ctx.fillRect(R.x, R.y, R.w, R.h); }
    // in-frame motion blur: the leaves move fast near the slam; K states spread over the gap between two motion-blur
    // sub-samples (the whole 180° shutter for a still), averaged additively on a transparent layer (exact for alpha)
    const MB = window.MB || 1, span = MB > 1 ? .5 / 30 / (MB - 1) : .5 / 30;
    const a0 = o.at ? o.at(t - span / 2) : null, a1 = o.at ? o.at(t + span / 2) : null;
    const fast = a0 && a1 && (Math.abs(a1.theta - a0.theta) > .004 || Math.abs(a1.shakeX - a0.shakeX) > .8);
    const K = fast ? 6 : 1;
    if (K === 1) { ctx.translate(R.x, R.y); leaves(ctx, R, tr, o); }
    else {
      const D = cnv('doorsD', w, h), gd = ctx2(D), Tm = cnv('doorsT', w, h);
      gd.clearRect(0, 0, w, h);
      for (let k = 0; k < K; k++) {
        const st = o.at(t + (k / (K - 1) - .5) * span) || o, gt = ctx2(Tm); gt.clearRect(0, 0, w, h);
        leaves(gt, R, tr, st);
        gd.globalCompositeOperation = 'lighter'; gd.globalAlpha = 1 / K; gd.drawImage(Tm, 0, 0);
      }
      ctx.drawImage(D, R.x, R.y);
    }
    ctx.restore();
  }

  // =====================================================================================================================
  // the frame
  // =====================================================================================================================
  function draw(t, n) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const a of S.active(t)) { const L = content(a, t); composite(a, L, t); }
    for (const o of S.overlays(t)) { if (o.kind === 'seam') seam(o); else if (o.kind === 'flash') flash(o); else if (o.kind === 'doors') doors(o, t); }
    ctx.restore();
  }
  // ---------- grain (6 precomputed tiles, tile + offset by rnd(n)) ----------
  let GT = null;
  function grainTiles() {
    if (GT) return GT; GT = [];
    for (let v = 0; v < 6; v++) {
      const gc = makeCanvas(640, 1080), g = gc.getContext('2d'), id = g.createImageData(640, 1080);
      for (let i = 0; i < id.data.length; i += 4) { const q = (rnd(i * .173 + v * 977.3) + rnd(i * .311 + v * 31.7)) * 127.5; id.data[i] = id.data[i + 1] = id.data[i + 2] = q; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); GT.push(gc);
    }
    return GT;
  }
  function filmGrain(n) {
    const amt = S.GRAIN !== undefined ? S.GRAIN : .15; if (amt <= 0) return;
    const tiles = grainTiles(), i = Math.floor(rnd(n * 1.618 + 3.1) * tiles.length) % tiles.length;
    const ox = -Math.floor(rnd(n * 2.71 + 1.7) * 70), oy = -Math.floor(rnd(n * 3.33 + 5.9) * 22);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = amt;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(tiles[i], ox, oy, 1152, 1944); ctx.restore();
  }
  return { draw, filmGrain, content, composite, dirBlur, doorTex, DIAG };
})();
function FT_draw(t, n) { FT.draw(t, n); }
function FT_grain(n) { FT.filmGrain(n); }
