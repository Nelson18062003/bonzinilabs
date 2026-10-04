'use strict';
// =============================================================================================
// M1 « the order & the meme » · 30_meme.js — the frame-0 hook of « C'EST PAS ÇA. » (the meme « commandé / reçu »).
//
//   OM_memeBand(mb, t)        screen. The meme header « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU »: a white paper strip
//                             taped on the shop's back wall (two columns over the two objects, an ink divider, a marker
//                             arrow down to each object). mb = SCORE.memeBand(t) = {k, out}: it flips up about its top
//                             edge and is gone at mb.out = 1 (showing its back as it turns). Takes over 'meme'.
//   OM_photo(P, t, L)         world. The polaroid « LA PHOTO »: studio product photo of the black RIGID tote (two
//                             handles, seamless light backdrop, softbox reflections), white polaroid frame, « LA PHOTO »
//                             in felt pen on the margin, an amber push-pin while P.pin. P = SCORE.polaroid(t).
//   OM_recv(C, B, t, L)       world. The received kraft carton (oblique 3/4, flaps torn open, torn kraft tape, crumpled
//                             tissue) and the received bag: smaller, SOFT, slouching (B.sag), creased, ONE thin strap that
//                             lags behind the jump. Carton back → bag → carton front. C = SCORE.recvCarton(t), B = recvBag(t).
//   OM_subtitle(sb, t, L)     world. TOI's subtitle « Mes sacs / sont arrivés ! » (Satoshi 900 88 px, white, black
//                             outline, contact shadow on the wax) and the amber plate's shadow sliding in from the sun's
//                             side and tightening on it (sb.shadow), the words flinch just before A.slam. Takes over 'sub'.
//   OM_fxUnder(t, L)          world, before every object: at A.slam the subtitle's letters squirt out from under the plate
//                             and roll away like marbles (closed-form: a hop, then a rolling spin), out of frame before
//                             A.steel.
// Deterministic (rnd), no ctx.filter, sprites cached lazily (fonts are loaded by then). Anchors: SCORE.A / G / states.
// Also global: OM_cached(slot, key, bb, k, draw) + OM_key(...) — the render cache of static objects (used by 32_plates.js
// too); OM_rigidTote(g, w, h) — the photo's black rigid tote (two handles), for anyone who needs the same bag.
// Cost (flushed, this renderer, steady state): ≈ 10–13 ms for the whole hook (photo ≈ 2.5, carton + bag ≈ 5, band ≈ 1.6,
// subtitle ≈ 1, splash ≤ 1); a cache rebuild (first still frame of a pose) costs ≈ 1.5× a direct draw.
// =============================================================================================
/** M1 render cache: draws `draw` (world coords, using the global ctx) into an offscreen canvas covering bb = [x0, y0, x1, y1]
 *  at k× and blits it. A slot is rendered into the cache only when the same key is asked twice in a row (a static object:
 *  the motion-blur sub-frames, the still passages); a moving object (new key every call) is drawn directly. */
const OM_CACHE = {};
function OM_cached(slot, key, bb, k, draw) {
  const c = OM_CACHE[slot] || (OM_CACHE[slot] = { last: null, key: null, cv: null });
  if (c.key === key && c.cv) { ctx.drawImage(c.cv, 0, 0, c.w, c.h, c.bb[0], c.bb[1], c.w / c.k, c.h / c.k); return; }
  if (c.last !== key) { c.last = key; draw(); return; }
  const w = Math.ceil((bb[2] - bb[0]) * k), h = Math.ceil((bb[3] - bb[1]) * k);
  if (!c.cv || c.cv.width < w || c.cv.height < h) c.cv = makeCanvas(Math.max(w, c.cv ? c.cv.width : 0), Math.max(h, c.cv ? c.cv.height : 0));
  const g = c.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, c.cv.width, c.cv.height);
  g.setTransform(k, 0, 0, k, -bb[0] * k, -bb[1] * k);
  const saved = ctx; ctx = g; try { draw(); } finally { ctx = saved; }
  Object.assign(c, { key, bb: bb.slice(), k, w, h });
  ctx.drawImage(c.cv, 0, 0, w, h, bb[0], bb[1], w / k, h / k);
}
/** a cache key from numbers (rounded) */
function OM_key(...v) { return v.map(x => typeof x === 'number' ? Math.round(x * 100) : String(x)).join(','); }
const OM_M = (function () {
  const S = window.SCORE, G = S.G, A = S.A;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const rgb = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${a})`;
  const INK = '#1A1426', ORANGE = '#FE560D', AMBER = '#F3A745';
  const SH = '6,4,18';
  const BN = { x: -.327, y: .945 };
  const poly = P => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
  let MC = null;
  const mw = (f, s) => { if (!MC) MC = makeCanvas(8, 8).getContext('2d'); MC.font = f; MC.letterSpacing = '0px'; return MC.measureText(s).width; };
  function tintQ(q) {
    const I = .66 + .34 * q.k, s = q.s;
    let r = I, g = I * (.972 - .004 * s), b = I * (.95 - .085 * s + .04 * (1 - q.k));
    const vv = q.v * .42; r += (.86 * I - r) * vv; g += (.78 * I - g) * vv; b += (1.0 * I - b) * vv;
    return [Math.min(1, r), Math.min(1, g), Math.min(1, b)];
  }
  const tintAt = (x, y, L) => tintQ(lightAt(x, y, L));
  const mulW = tn => rgb([255 * tn[0], 255 * tn[1], 255 * tn[2]]);
  function noiseC(w, h, seed, amp, mean = 128) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    for (let i = 0; i < w * h; i++) { const v = mean + (rnd(i * .713 + seed) - .5) * amp; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); return c;
  }
  /** soft fill of a convex polygon (stacked inflated copies) */
  function softPoly(P, blur, a, n = 5, col = SH) {
    if (a <= .004) return;
    let cx = 0, cy = 0; for (const q of P) { cx += q[0]; cy += q[1]; } cx /= P.length; cy /= P.length;
    const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n); ctx.fillStyle = `rgba(${col},${al.toFixed(4)})`;
    for (let i = 0; i < n; i++) { const e = -blur * .5 + blur * 1.5 * i / (n - 1); poly(P.map(q => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * e, q[1] + dy / l * e]; })); ctx.fill(); }
  }

  // =============================================================================================
  // 1. THE MEME BAND (screen)
  // =============================================================================================
  const MB = { x0: 34, x1: 1046, SS: 2 };
  let BAND = null;
  function bandSprite() {
    if (BAND) return BAND;
    const y = G.meme.y, h = G.meme.h, W0 = MB.x1 - MB.x0, SS = MB.SS, padT = 30, padB = 110, padX = 16;
    const c = makeCanvas(Math.ceil((W0 + 2 * padX) * SS), Math.ceil((h + padT + padB) * SS)), g = c.getContext('2d');
    g.scale(SS, SS); g.translate(padX - MB.x0, padT - (y - h / 2));          // draw in screen coords
    const top = y - h / 2, bot = y + h / 2, x0 = MB.x0, x1 = MB.x1;
    // marker arrows hanging below each column, down to its object (drawn first: the paper covers their roots)
    for (const [ax, i] of [[G.meme.xL, 0], [G.meme.xR, 1]]) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      const path = () => { g.beginPath(); g.moveTo(ax - 6, bot - 6); g.bezierCurveTo(ax + 16, bot + 26, ax - 18, bot + 50, ax + 2, bot + 82);
        g.moveTo(ax - 20, bot + 58); g.lineTo(ax + 3, bot + 86); g.lineTo(ax + 24, bot + 60); };
      g.strokeStyle = 'rgba(10,6,14,.55)'; g.lineWidth = 15; g.translate(2, 4); path(); g.stroke(); g.translate(-2, -4);
      g.strokeStyle = '#FFF8EC'; g.lineWidth = 9; path(); g.stroke(); g.restore();
    }
    // the paper strip: soft shadow on the wall, slightly torn bottom edge, paper grain
    const edge = []; for (let x = x0; x <= x1; x += 12) edge.push([x, bot + (R(x, 3) - .5) * 3.2]); edge[edge.length - 1][0] = x1;
    const shape = (ox = 0, oy = 0) => { g.beginPath(); g.moveTo(x0 + ox, top + oy); g.lineTo(x1 + ox, top + oy); for (let i = edge.length - 1; i >= 0; i--) g.lineTo(edge[i][0] + ox, edge[i][1] + oy); g.closePath(); };
    g.save(); g.shadowColor = 'rgba(8,4,2,.55)'; g.shadowBlur = 26 * SS; g.shadowOffsetY = 12 * SS; shape(); g.fillStyle = '#FBF8F2'; g.fill(); g.restore();
    g.save(); shape(); g.clip();
    const pg = g.createLinearGradient(0, top, 0, bot); pg.addColorStop(0, '#FFFDF8'); pg.addColorStop(1, '#F1ECE2'); g.fillStyle = pg; g.fillRect(x0, top, W0, h + 6);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .6; g.drawImage(noiseC(512, 128, 77, 22, 240), x0, top, W0, h + 6); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(150,130,100,${(.06 + R(i, 5) * .08).toFixed(3)})`; g.lineWidth = .7; const x = x0 + R(i, 6) * W0, yy = top + R(i, 7) * h, a = R(i, 8) * 3; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + Math.cos(a) * 6, yy + Math.sin(a) * 6); g.stroke(); }
    const sh = g.createLinearGradient(0, bot - 26, 0, bot); sh.addColorStop(0, 'rgba(120,100,70,0)'); sh.addColorStop(1, 'rgba(120,100,70,.14)'); g.fillStyle = sh; g.fillRect(x0, bot - 26, W0, 30);   // the strip curls a little off the wall
    g.restore();
    // the divider: one bold ink stroke (the meme's split), hand-drawn
    g.save(); g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(G.cx + 1, top + 20);
    for (let k = 1; k <= 8; k++) g.lineTo(G.cx + (R(k, 9) - .5) * 2.4, top + 20 + (h - 40) * k / 8); g.stroke(); g.restore();
    // the two columns: « CE QUE J'AI » + the big word
    const colW = 452, f1 = '700 46px Satoshi';
    [['COMMANDÉ', G.meme.xL, INK], ['REÇU', G.meme.xR, ORANGE]].forEach(([word, x, col]) => {
      let z = 100; while (z > 60 && mw(`900 ${z}px Satoshi`, word) > colW) z -= 2;
      g.font = f1; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK; g.fillText("CE QUE J'AI", x, top + 72);
      g.font = `900 ${z}px Satoshi`; g.fillStyle = col; g.fillText(word, x, top + 74 + z * .9);
    });
    // masking tape: two strips at the top corners, one at the middle (translucent, torn ends)
    const tape = (cx, cy, w, hh, rot, seed) => {
      g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.moveTo(-w / 2, -hh / 2);
      for (let i = 0; i <= 5; i++) g.lineTo(-w / 2 + w * i / 5, -hh / 2 + (i % 2 ? 2 : -1) * R(i, seed));
      for (let i = 0; i <= 4; i++) g.lineTo(w / 2 + (R(i, seed + 1) - .5) * 6, -hh / 2 + hh * i / 4);
      for (let i = 5; i >= 0; i--) g.lineTo(-w / 2 + w * i / 5, hh / 2 + (i % 2 ? -1 : 2) * R(i, seed + 2));
      for (let i = 4; i >= 0; i--) g.lineTo(-w / 2 + (R(i, seed + 3) - .5) * 6, -hh / 2 + hh * i / 4);
      g.closePath(); g.fillStyle = 'rgba(236,222,186,.78)'; g.fill(); g.strokeStyle = 'rgba(160,140,100,.25)'; g.lineWidth = 1; g.stroke();
      g.globalAlpha = .25; g.fillStyle = '#fff'; g.fillRect(-w / 2 + 6, -hh / 2 + 4, w - 12, 4); g.restore();
    };
    tape(x0 + 34, top + 2, 120, 38, -.62, 11); tape(x1 - 34, top + 2, 120, 38, .6, 13); tape(G.cx, top - 2, 96, 34, .04, 17);
    BAND = { c, padT, padB, padX };
    return BAND;
  }
  function memeBand(mb, t) {
    if (!mb) return;
    const B = bandSprite(), y = G.meme.y, h = G.meme.h, top = y - h / 2, SS = MB.SS, out = cl(mb.out || 0);
    const th = out * Math.PI / 2 * 1.02, sy = Math.cos(th), lift = -26 * out * out;
    if (sy <= .01) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = cl(mb.k ?? 1);
    ctx.translate(0, top + lift); ctx.scale(1, sy); ctx.translate(0, -top);
    ctx.drawImage(B.c, MB.x0 - B.padX, top - B.padT, B.c.width / SS, B.c.height / SS);
    if (out > 0) { ctx.fillStyle = `rgba(30,20,10,${(.5 * Math.sin(th)).toFixed(3)})`; ctx.fillRect(MB.x0, top, MB.x1 - MB.x0, h + 4); }   // turning away from the light
    ctx.restore();
  }

  // =============================================================================================
  // 2. THE POLAROID « LA PHOTO » (world)
  // =============================================================================================
  const PH = { SS: 2, side: 18, top: 22, img: 324 };
  /** the black RIGID tote, studio-lit, centred on its body (0, 0): body w×h; to any 2D context g */
  function rigidTote(g, w, h, o = {}) {
    const tw = w * .9, hb = h, top = -hb / 2, bot = hb / 2, gus = w * .1;      // trapezoid: a touch narrower at the top
    const handle = (dx0, dx1, ht, wid, col, hi, y0 = top + 4) => {
      g.save(); g.lineCap = 'butt';
      const p = () => { g.beginPath(); g.moveTo(dx0, y0); g.bezierCurveTo(dx0, y0 - ht * 1.08, dx1, y0 - ht * 1.08, dx1, y0); };
      g.strokeStyle = col; g.lineWidth = wid; p(); g.stroke();
      g.strokeStyle = hi; g.lineWidth = wid * .22; g.translate(-wid * .18, -wid * .12); p(); g.stroke(); g.restore();
    };
    // back handle (behind the front panel): darker, slightly higher and right
    handle(-tw * .24 + w * .17, tw * .24 + w * .17, hb * .66, w * .072, '#141218', 'rgba(255,255,255,.16)', top - gus * .55 + 2);
    // the side gusset (right): a narrow darker plane receding
    g.beginPath(); g.moveTo(tw / 2, top); g.lineTo(tw / 2 + gus, top - gus * .55); g.lineTo(w / 2 + gus * .8, bot - gus * .5); g.lineTo(w / 2, bot); g.closePath();
    let gr = g.createLinearGradient(tw / 2, 0, w / 2 + gus, 0); gr.addColorStop(0, '#0C0B10'); gr.addColorStop(1, '#1D1B22'); g.fillStyle = gr; g.fill();
    // the opening: the back panel's top edge seen above the front's
    g.beginPath(); g.moveTo(-tw / 2, top); g.lineTo(-tw / 2 + gus, top - gus * .55); g.lineTo(tw / 2 + gus, top - gus * .55); g.lineTo(tw / 2, top); g.closePath(); g.fillStyle = '#050407'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-tw / 2 + gus, top - gus * .55); g.lineTo(tw / 2 + gus, top - gus * .55); g.stroke();
    // the front panel: glossy structured black
    const front = () => { g.beginPath(); g.moveTo(-tw / 2, top); g.lineTo(tw / 2, top); g.lineTo(w / 2, bot); g.quadraticCurveTo(0, bot + 3, -w / 2, bot); g.closePath(); };
    front(); gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, '#2B2833'); gr.addColorStop(.18, '#17151C'); gr.addColorStop(.6, '#0E0D12'); gr.addColorStop(.92, '#1A1820'); gr.addColorStop(1, '#2A2731'); g.fillStyle = gr; g.fill();
    g.save(); front(); g.clip();
    // softbox reflections: a broad soft band on the left, a thin crisp strip on the right
    gr = g.createLinearGradient(-w * .42, 0, -w * .1, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(235,238,245,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-w * .42, top); g.lineTo(-w * .12, top); g.lineTo(-w * .08, bot); g.lineTo(-w * .4, bot); g.closePath(); g.fill();
    g.fillStyle = 'rgba(240,242,250,.32)'; g.beginPath(); g.moveTo(tw * .36, top); g.lineTo(tw * .39, top); g.lineTo(w * .41, bot); g.lineTo(w * .38, bot); g.closePath(); g.fill();
    gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(-w, top, 2 * w, hb);
    // top hem + stitching, side piping
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w, top, 2 * w, hb * .1);
    g.strokeStyle = 'rgba(200,200,210,.45)'; g.lineWidth = 1.3; g.setLineDash([4, 3.5]); g.beginPath(); g.moveTo(-tw / 2 + 6, top + hb * .1); g.lineTo(tw / 2 - 6, top + hb * .1); g.stroke(); g.setLineDash([]);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-tw / 2, top); g.lineTo(tw / 2, top); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-tw / 2, top); g.lineTo(-w / 2, bot); g.stroke();
    // front handle, riveted with plain black tabs (no metal, no logo)
    handle(-tw * .24, tw * .24, hb * .7, w * .08, '#121016', 'rgba(255,255,255,.2)');
    for (const sx of [-1, 1]) { const x = sx * tw * .24; g.fillStyle = '#0D0C11'; g.fillRect(x - w * .055, top - 1, w * .11, hb * .16); g.strokeStyle = 'rgba(200,200,210,.35)'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(x - w * .045, top + 2, w * .09, hb * .12); g.setLineDash([]); }
  }
  let PSPR = null;
  function photoSprite() {
    if (PSPR) return PSPR;
    const w = G.photo.w, h = G.photo.h, SS = PH.SS, pad = 10, c = makeCanvas(Math.ceil((w + 2 * pad) * SS), Math.ceil((h + 2 * pad) * SS)), g = c.getContext('2d');
    g.scale(SS, SS); g.translate(w / 2 + pad, h / 2 + pad);
    // frame paper
    let gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, '#FFFFFC'); gr.addColorStop(1, '#F3F1EA'); g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .5; g.drawImage(noiseC(180, 220, 31, 18, 242), -w / 2, -h / 2, w, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // the image window
    const iw = PH.img, ix = -iw / 2, iy = -h / 2 + PH.top;
    g.save(); g.beginPath(); g.rect(ix, iy, iw, iw); g.clip();
    gr = g.createLinearGradient(0, iy, 0, iy + iw); gr.addColorStop(0, '#F4F2EE'); gr.addColorStop(.55, '#E7E4DE'); gr.addColorStop(.63, '#F1EEE9'); gr.addColorStop(1, '#E2DED7');   // seamless sweep
    g.fillStyle = gr; g.fillRect(ix, iy, iw, iw);
    let rg = g.createRadialGradient(0, iy + iw * .42, 10, 0, iy + iw * .42, iw * .75); rg.addColorStop(0, 'rgba(255,255,255,.4)'); rg.addColorStop(1, 'rgba(90,84,76,.18)'); g.fillStyle = rg; g.fillRect(ix, iy, iw, iw);
    const by = iy + iw * .62;                                                                        // the tote's body centre
    rg = g.createRadialGradient(0, by + 78, 4, 0, by + 78, 120); rg.addColorStop(0, 'rgba(20,16,12,.5)'); rg.addColorStop(.5, 'rgba(20,16,12,.16)'); rg.addColorStop(1, 'rgba(20,16,12,0)');
    g.save(); g.translate(0, by + 78); g.scale(1, .16); g.translate(0, -(by + 78)); g.fillStyle = rg; g.fillRect(-140, by - 60, 280, 280); g.restore();
    g.save(); g.translate(-6, by); rigidTote(g, 178, 150); g.restore();
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .3; g.drawImage(noiseC(162, 162, 41, 24, 238), ix, iy, iw, iw); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.restore();
    g.strokeStyle = 'rgba(60,54,44,.35)'; g.lineWidth = 1.2; g.strokeRect(ix + .5, iy + .5, iw - 1, iw - 1);   // the window's pressed edge
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(ix, iy + iw + 1.2); g.lineTo(ix + iw, iy + iw + 1.2); g.stroke();
    // « LA PHOTO » in felt pen on the margin
    const my = iy + iw + (h / 2 - (iy + iw)) / 2;
    g.save(); g.translate(0, my + 4); g.rotate(-.025); g.font = '700 60px Kalam'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(26,20,38,.18)'; g.fillText('LA PHOTO', 1.2, 2.4); g.fillStyle = '#1C1830'; g.fillText('LA PHOTO', 0, 0); g.restore();
    // edges
    g.strokeStyle = 'rgba(120,110,95,.35)'; g.lineWidth = 1; g.strokeRect(-w / 2 + .5, -h / 2 + .5, w - 1, h - 1);
    PSPR = { c, pad, SS }; return PSPR;
  }
  function pin(x, y, L) {
    const o = shadowOff(x, y, 16, L);
    ctx.save();
    ctx.fillStyle = `rgba(${SH},.35)`; ctx.beginPath(); ctx.ellipse(x + o.x * .8, y + o.y * .8, 13, 9, .5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,205,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + o.x * .5, y + o.y * .5); ctx.stroke();
    const rg = ctx.createRadialGradient(x - 5, y - 6, 1, x, y, 15); rg.addColorStop(0, lit('#FFE2A6', x, y, L, .5)); rg.addColorStop(.35, lit('#F3A745', x, y, L, .3)); rg.addColorStop(1, lit('#9A5A08', x, y, L, -.3));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - 5, y - 6, 4.5, 2.6, -.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function photo(P, t, L) {
    if (!P || (P.a ?? 1) <= 0) return;
    const r = 330 * (P.s ?? 1) + 40;
    OM_cached('photo', OM_key(P.x, P.y, P.rot, P.s ?? 1, P.sx ?? 1, P.sy ?? 1, P.a ?? 1, P.pin ? 1 : 0, L.sun, L.violet, L.dim), [P.x - r, P.y - r, P.x + r + 30, P.y + r + 30], 1.25, () => photoDraw(P, t, L));
  }
  function photoDraw(P, t, L) {
    const w = P.w || G.photo.w, h = P.h || G.photo.h, sp = photoSprite(), s = P.s ?? 1, sx = s * (P.sx ?? 1), sy = s * (P.sy ?? 1);
    ctx.save(); ctx.globalAlpha *= P.a ?? 1;
    // shadow on the cloth: a print lying flat (lifts a little when it slides)
    const z = 3 + (P.pin ? 0 : 6), o = shadowOff(P.x, P.y, z, L), q = lightAt(P.x, P.y, L);
    ctx.save(); ctx.translate(P.x + o.x, P.y + o.y); ctx.rotate(P.rot); ctx.scale(sx, sy);
    const al = .3 + .25 * q.s; ctx.fillStyle = `rgba(${SH},${(1 - Math.pow(1 - al, 1 / 4)).toFixed(4)})`;
    for (let i = 0; i < 4; i++) { const e = -3 + 4 * i; ctx.fillRect(-w / 2 - e, -h / 2 - e, w + 2 * e, h + 2 * e); }
    ctx.restore();
    ctx.translate(P.x, P.y); ctx.rotate(P.rot); ctx.scale(sx, sy);
    ctx.drawImage(sp.c, -w / 2 - sp.pad, -h / 2 - sp.pad, w + 2 * sp.pad, h + 2 * sp.pad);
    // light across the beam (multiply), then the gloss of the print (a soft diagonal sheen, moving with the print)
    const c = Math.cos(P.rot), sn = Math.sin(P.rot), loc = (dx, dy) => ({ x: (dx * c + dy * sn) / sx, y: (-dx * sn + dy * c) / sy }), span = 240;
    const a0 = loc(-BN.x * span, -BN.y * span), a1 = loc(BN.x * span, BN.y * span), gr = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
    const soft = tn => tn.map(v => .45 + .55 * v);
    gr.addColorStop(0, mulW(soft(tintAt(P.x - BN.x * span, P.y - BN.y * span, L)))); gr.addColorStop(.5, mulW(soft(tintAt(P.x, P.y, L)))); gr.addColorStop(1, mulW(soft(tintAt(P.x + BN.x * span, P.y + BN.y * span, L))));
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    const iw = PH.img, ix = -iw / 2, iy = -h / 2 + PH.top, gx = -60 + (P.x - G.photo.x) * .4;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, iw); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    const sg = ctx.createLinearGradient(gx - 140, iy, gx + 60, iy + iw), ga = .12 + .16 * q.s;
    sg.addColorStop(0, 'rgba(255,250,236,0)'); sg.addColorStop(.45, `rgba(255,250,236,${(ga * .6).toFixed(3)})`); sg.addColorStop(.5, `rgba(255,252,242,${ga.toFixed(3)})`); sg.addColorStop(.58, 'rgba(255,250,236,0)');
    ctx.fillStyle = sg; ctx.fillRect(ix, iy, iw, iw); ctx.restore();
    ctx.restore();
    if (P.pin) { const p = S.place({ x: P.x, y: P.y, rot: P.rot, s }, 0, -h / 2 + 12); pin(p.x, p.y, L); }
  }

  // =============================================================================================
  // 3. THE RECEIVED CARTON (kraft, oblique) + THE RECEIVED BAG (soft, one strap)
  // =============================================================================================
  const OB = S.OBL, VIEW = [OB.x, -1, -OB.y];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pv = v => [v[0] + v[1] * OB.x, -v[2] + v[1] * OB.y];
  const shadeN = n => cl(.86 - .14 * n[0] + .14 * n[2] + .03 * n[1], .3, 1.04);
  const litA = (c, x, y, L, bias = 0) => lit(`rgb(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0})`, x, y, L, bias);
  let LIN = null, PAT = null;
  function liner() {
    if (LIN) return LIN;
    const N = 512, c = makeCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#DDB680'; g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x++) { const v = Math.sin(x / 16 * Math.PI * 2); g.fillStyle = v > 0 ? `rgba(255,238,206,${(.07 * v).toFixed(3)})` : `rgba(96,58,22,${(-.07 * v).toFixed(3)})`; g.fillRect(x, 0, 1, N); }
    for (let i = 0; i < 70; i++) {
      const x = rnd(i * 9.1 + 3) * N, y = rnd(i * 7.7 + 1) * N, r = 30 + rnd(i * 6.3) * 110, dark = rnd(i * 2.2) > .5;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > N || cy + r < 0 || cy - r > N) continue;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, dark ? 'rgba(120,76,30,.05)' : 'rgba(255,240,210,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = rnd(i * 1.9 + 3) * N, y = rnd(i * 2.7 + 5) * N, a = rnd(i * 3.1) * Math.PI, l = 3 + rnd(i * 4.3) * 11;
      g.strokeStyle = rnd(i * 6.1) > .55 ? `rgba(118,78,38,${(.18 + rnd(i * 8.3) * .2).toFixed(2)})` : `rgba(246,224,186,${(.22 + rnd(i * 5.9) * .25).toFixed(2)})`;
      g.lineWidth = rnd(i) > .8 ? 1.3 : .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(${rnd(i * 4.4) > .5 ? '70,44,20' : '40,28,18'},${(.25 + rnd(i * 3.3) * .4).toFixed(2)})`; g.beginPath(); g.arc(rnd(i * 1.37 + 9) * N, rnd(i * 2.71 + 4) * N, .5 + rnd(i * 5.5) * 1.1, 0, 7); g.fill(); }
    return (LIN = c);
  }
  function pat() { if (!PAT) PAT = ctx.createPattern(liner(), 'repeat'); return PAT; }
  function face(Pts, O, a, b, k, L, o = {}) {
    const ea = pv(a), eb = pv(b), sc = o.ts || .9, det = ea[0] * eb[1] - ea[1] * eb[0];
    poly(Pts);
    if (Math.abs(det) > .02) { const p = pat(); p.setTransform(new DOMMatrix([ea[0] * sc, ea[1] * sc, eb[0] * sc, eb[1] * sc, O[0], O[1]])); ctx.fillStyle = p; } else ctx.fillStyle = '#C9A473';
    ctx.fill();
    const tn = o.tint || [1, 1, 1];
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = litA([255 * k * tn[0], 255 * k * tn[1], 255 * k * tn[2]], O[0], O[1], L, o.bias || 0); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  function cutEdge(p0, p1, tv, L) {
    const tl = Math.hypot(tv[0], tv[1]); if (tl < .6) return;
    poly([p0, p1, [p1[0] + tv[0], p1[1] + tv[1]], [p0[0] + tv[0], p0[1] + tv[1]]]); ctx.fillStyle = litA([224, 192, 146], p0[0], p0[1], L); ctx.fill();
    if (tl < 2.2) return;
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (len > 10) { const n = Math.max(2, Math.round(len / (tl * 1.5))), m = n * 6; ctx.beginPath();
      for (let i = 0; i <= m; i++) { const f = i / m, a = .5 + .34 * Math.sin(f * n * Math.PI * 2); const x = p0[0] + (p1[0] - p0[0]) * f + tv[0] * a, y = p0[1] + (p1[1] - p0[1]) * f + tv[1] * a; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = Math.max(.8, tl * .13); ctx.strokeStyle = 'rgba(122,82,40,.6)'; ctx.stroke(); }
    ctx.restore();
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const CK = (function () {
    const DEG = Math.PI / 180, FLAP_MAX = 114 * DEG, FL = { front: 1.2, back: .92, side: 1.03 };
    let o = { x: 0, y: 0 }, w = 330, h = 190, d = 170, s = 1, th = 7, TS = .9;
    const P = (X, Y, Z) => [o.x + X + Y * OB.x, o.y - Z + Y * OB.y], PP = p => P(p[0], p[1], p[2]);
    const add3 = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k], neg = v => [-v[0], -v[1], -v[2]];
    function shadow(L) {
      const sh = shadowOff(o.x, o.y, h, L), kx = sh.x / h, ky = sh.y / h;
      const foot = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)], top = foot.map(p => [p[0] + kx * h, p[1] + ky * h]);
      softPoly(hull(foot.concat(top)), 30 * s, .34, 5); softPoly(foot.map(p => [p[0] + 4 * s, p[1] + 3 * s]), 9 * s, .34, 3);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(${SH},.4)`; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(...P(-w / 2, 0, 0)); ctx.lineTo(...P(w / 2, 0, 0)); ctx.lineTo(...P(w / 2, d, 0)); ctx.stroke(); ctx.restore();
    }
    function flapDef(which) {
      switch (which) {
        case 'front': return { A: [-w / 2, 0, h], B: [w / 2, 0, h], c: [0, 1, 0], len: d / 2, ax: [1, 0, 0], seed: 1 };
        case 'back': return { A: [-w / 2, d, h], B: [w / 2, d, h], c: [0, -1, 0], len: d / 2, ax: [1, 0, 0], seed: 2 };
        case 'left': return { A: [-w / 2, 0, h], B: [-w / 2, d, h], c: [1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 3 };
        default: return { A: [w / 2, 0, h], B: [w / 2, d, h], c: [-1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 4 };
      }
    }
    function flap(which, a, L, torn) {
      const F = flapDef(which), c = F.c, ct = Math.cos(a), sn = Math.sin(a), u = [c[0] * ct, c[1] * ct, sn], nOut = [-c[0] * sn, -c[1] * sn, ct];
      const len = F.len, minor = which === 'left' || which === 'right', ch = minor ? Math.min(len * .35, 26 * s) : 0;
      const A2 = add3(F.A, u, len), B2 = add3(F.B, u, len), vis = dot(nOut, VIEW) >= 0, n = vis ? nOut : neg(nOut), pA = PP(F.A), pB = PP(F.B);
      const tA = PP(add3(add3(F.A, u, len), F.ax, ch)), tB = PP(add3(add3(F.B, u, len), F.ax, -ch)), mA = PP(add3(F.A, u, len - ch)), mB = PP(add3(F.B, u, len - ch));
      cutEdge(tA, tB, pv(n.map(x => -x * th)), L);
      const pts = minor ? [pA, pB, mB, tB, tA, mA] : [pA, pB, PP(B2), PP(A2)];
      face(pts, pA, F.ax, u, shadeN(n) * (vis ? 1.04 : .97), L, { ts: TS, tint: vis ? [1, .97, .9] : [1.03, 1, .95] });
      ctx.save(); ctx.strokeStyle = 'rgba(70,40,12,.35)'; ctx.lineWidth = 1.6 * s; ctx.lineJoin = 'round'; poly(pts); ctx.stroke();
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,240,212,.45)'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(...pA); ctx.lineTo(...pB); ctx.stroke(); ctx.restore();
      if (torn && vis && !minor) {                                                      // half of the burst kraft tape left on the tip
        const tw = 24 * s, base = add3(F.A, u, len - tw), p = (x, v) => PP(add3(add3(base, F.ax, x), u, v)), M = 26, X0 = -6 * s, X1 = w + 6 * s;
        ctx.save(); ctx.beginPath(); for (let i = 0; i <= M; i++) { const q = p(X0 + (X1 - X0) * i / M, 0); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }
        for (let i = M * 2; i >= 0; i--) { const x = X0 + (X1 - X0) * i / (M * 2), jag = tw * (.62 + .5 * R(i, F.seed * 7)); ctx.lineTo(...p(x, Math.min(tw + 6 * s, jag))); }
        ctx.closePath(); ctx.fillStyle = litA([168, 116, 62], pA[0], pA[1], L); ctx.fill(); ctx.strokeStyle = 'rgba(255,226,180,.35)'; ctx.lineWidth = 1.4 * s; ctx.stroke(); ctx.restore();
      }
    }
    function interior(L) {
      const bw = [P(-w / 2, d, h), P(w / 2, d, h), P(w / 2, d, 0), P(-w / 2, d, 0)], lw = [P(-w / 2, 0, h), P(-w / 2, d, h), P(-w / 2, d, 0), P(-w / 2, 0, 0)], fl = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)];
      face(bw, bw[0], [1, 0, 0], [0, 0, -1], .5, L, { ts: TS, tint: [1, .97, .93] });
      face(lw, lw[0], [0, 1, 0], [0, 0, -1], .42, L, { ts: TS, tint: [1, .97, .93] });
      face(fl, fl[0], [1, 0, 0], [0, 1, 0], .55, L, { ts: TS, tint: [1, .98, .94] });
      ctx.save(); const gr = ctx.createLinearGradient(...P(0, d, h), ...P(0, d, 0)); gr.addColorStop(0, 'rgba(36,18,4,0)'); gr.addColorStop(1, 'rgba(36,18,4,.5)'); ctx.fillStyle = gr; poly(bw); ctx.fill(); ctx.restore();
    }
    /** crumpled tissue paper along the back wall's rim (the bag was wrapped in it) */
    function tissue(L) {
      const pts = []; const M = 14;
      for (let i = 0; i <= M; i++) { const X = -w / 2 + 6 + (w - 12) * i / M; pts.push(P(X, d * .78, h + 12 * s + 14 * s * R(i, 41))); }
      for (let i = M; i >= 0; i--) { const X = -w / 2 + 6 + (w - 12) * i / M; pts.push(P(X, d * .45, h - 30 * s)); }
      ctx.save(); poly(pts); ctx.fillStyle = litA([236, 232, 222], o.x, o.y - h, L, .2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,140,125,.45)'; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const X = -w / 2 + 20 + (w - 40) * R(i, 43), p0 = P(X, d * .7, h + 8 * s), p1 = P(X + (R(i, 44) - .5) * 40, d * .5, h - 18 * s); ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke(); }
      ctx.restore();
    }
    function rightWall(L, torn) {
      const q = [P(w / 2, 0, h), P(w / 2, d, h), P(w / 2, d, 0), P(w / 2, 0, 0)];
      face(q, q[0], [0, 1, 0], [0, 0, -1], .74, L, { ts: TS, tint: [1, .95, .86] });
      ctx.save(); const gr = ctx.createLinearGradient(...P(w / 2, d / 2, h), ...P(w / 2, d / 2, 0)); gr.addColorStop(0, 'rgba(255,236,200,.10)'); gr.addColorStop(.7, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.22)');
      ctx.fillStyle = gr; poly(q); ctx.fill();
      const O = P(w / 2, 0, h), ex = pv([0, 1, 0]), ey = pv([0, 0, -1]); ctx.transform(ex[0], ex[1], ey[0], ey[1], O[0], O[1]);
      if (d > 120 * s && h > 150 * s) {                                                   // printed « this way up » arrows (no text)
        const cx = d * .5, cy = h * .36, a = 30 * s; ctx.strokeStyle = 'rgba(35,22,41,.5)'; ctx.lineWidth = 6 * s; ctx.beginPath();
        for (const dx of [-a * .55, a * .55]) { ctx.moveTo(cx + dx, cy + a); ctx.lineTo(cx + dx, cy - a * .5); ctx.moveTo(cx + dx - a * .42, cy - a * .1); ctx.lineTo(cx + dx, cy - a * .62); ctx.lineTo(cx + dx + a * .42, cy - a * .1); }
        ctx.moveTo(cx - a * 1.2, cy + a * 1.25); ctx.lineTo(cx + a * 1.2, cy + a * 1.25); ctx.stroke();
      }
      ctx.restore();
      if (torn) {                                                                         // the torn tab of the burst tape
        const Y = d / 2, tw = 50 * s, len = 64 * s, e = P(w / 2, Y - tw / 2, h - len), c = P(w / 2, Y + tw / 2, h - len);
        ctx.save(); ctx.beginPath(); ctx.moveTo(...e); ctx.lineTo(...c);
        for (let i = 0; i <= 8; i++) ctx.lineTo(...P(w / 2, Y + tw / 2 - tw * i / 8, h - 4 * s - R(i, 31) * 9 * s));
        for (let i = 0; i <= 7; i++) ctx.lineTo(...P(w / 2, Y - tw / 2 + tw * i / 7, h - len - (i % 2 ? 3 : 0) * s));
        ctx.closePath(); ctx.fillStyle = litA([150, 102, 52], e[0], e[1], L, -.3); ctx.fill(); ctx.restore();
      }
    }
    function frontWall(L) {
      const Q = [P(-w / 2, 0, h), P(w / 2, 0, h), P(w / 2, 0, 0), P(-w / 2, 0, 0)];
      face(Q, Q[0], [1, 0, 0], [0, 0, -1], shadeN([0, -1, 0]) * 1.02, L, { ts: TS, tint: [1, .97, .9] });
      ctx.save(); poly(Q); ctx.clip(); ctx.transform(1, 0, 0, 1, Q[0][0], Q[0][1]);
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,238,206,.12)'); gr.addColorStop(.75, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.22)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(70,44,18,.16)'; ctx.lineWidth = 3 * s;            // scuffs of a carton that has travelled
      for (let i = 0; i < 5; i++) { const x = (.1 + .18 * i + .08 * R(i, 9)) * w, y = (.62 + .25 * R(i, 4)) * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (16 + 20 * R(i, 6)) * s, y - 6 * s * R(i, 2)); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(70,44,18,.22)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(w * .7, h * .25); ctx.lineTo(w * .78, h * .32); ctx.lineTo(w * .74, h * .4); ctx.stroke();   // a dent
      ctx.restore();
    }
    function draw(st, pass, t, L) {
      const g = S.cartonGeo(st); o = { x: st.x, y: st.y }; w = g.w; h = g.h; d = g.d; s = g.s; th = 7 * s; TS = .9 * s;
      const n = Math.round(t * 30), sk = st.shake || 0, jx = sk ? (rnd(Math.floor(n / 2) * 1.37 + 3) - .5) * 9 * sk : 0, jr = sk ? (rnd(Math.floor(n / 2) * 2.11 + 7) - .5) * .05 * sk : 0;
      ctx.save(); ctx.globalAlpha *= st.a ?? 1;
      ctx.translate(jx, 0); const rot = (st.rot || 0) + jr; if (rot) { ctx.translate(g.cx, st.y); ctx.rotate(rot); ctx.translate(-g.cx, -st.y); }
      const fa = Math.max(0, st.flaps) * FLAP_MAX;
      if (pass === 'back') { shadow(L); flap('back', fa * FL.back, L, st.torn); flap('left', fa * FL.side, L, st.torn); interior(L); tissue(L); }
      else {
        rightWall(L, st.torn); flap('right', fa * FL.side, L, st.torn); frontWall(L); flap('front', fa * FL.front, L, st.torn);
        ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,238,206,.42)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(...P(w / 2, 0, 1)); ctx.lineTo(...P(w / 2, 0, h - 1)); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,236,200,.55)'; ctx.beginPath(); ctx.moveTo(...P(-w / 2, 0, h)); ctx.lineTo(...P(-w / 2, 0, 2)); ctx.stroke(); ctx.restore();   // rim on the door side
      }
      ctx.restore();
    }
    return { draw };
  })();

  // ---------- the received bag: soft, slouching, creased, ONE thin strap ----------
  let FAB = null;
  function fabric() { if (!FAB) FAB = ctx.createPattern(noiseC(128, 128, 57, 46), 'repeat'); return FAB; }
  /** the received bag, local frame (centre 0, 0, nominal w×h): a soft slouchy pouch whose front edge droops in a U.
   *  outline(): the whole silhouette (back edge on top); front(): the front panel (its top edge sags with B.sag) */
  function bagGeo(w, h, sag) {
    const d = 1 + .35 * sag;
    return {
      outline() {
        ctx.beginPath(); ctx.moveTo(-w * .4, -h * .44);
        ctx.bezierCurveTo(-w * .26, -h * .58, -w * .08, -h * .5, w * .02, -h * .56);                     // the back panel's wavy top edge
        ctx.bezierCurveTo(w * .14, -h * .62, w * .3, -h * .52, w * .42, -h * .46);
        ctx.bezierCurveTo(w * (.52 + .04 * sag), -h * .2, w * (.55 + .05 * sag), h * .12, w * .42, h * .44);   // bulging sides, heavy round bottom
        ctx.bezierCurveTo(w * .2, h * .56, -w * .22, h * .56, -w * .44, h * .44);
        ctx.bezierCurveTo(-w * (.57 + .05 * sag), h * .12, -w * (.52 + .03 * sag), -h * .22, -w * .4, -h * .44); ctx.closePath();
      },
      front() {
        ctx.beginPath(); ctx.moveTo(-w * .4, -h * .44);
        ctx.bezierCurveTo(-w * .28, -h * (.34 - .1 * d), -w * .12, -h * (.3 - .12 * d), w * .02, -h * (.31 - .13 * d));   // the front edge droops (soft)
        ctx.bezierCurveTo(w * .16, -h * (.32 - .12 * d), w * .32, -h * (.36 - .08 * d), w * .42, -h * .46);
        ctx.bezierCurveTo(w * (.52 + .04 * sag), -h * .2, w * (.55 + .05 * sag), h * .12, w * .42, h * .44);
        ctx.bezierCurveTo(w * .2, h * .56, -w * .22, h * .56, -w * .44, h * .44);
        ctx.bezierCurveTo(-w * (.57 + .05 * sag), h * .12, -w * (.52 + .03 * sag), -h * .22, -w * .4, -h * .44); ctx.closePath();
      },
    };
  }
  function softBag(B, t, L) {
    const w = G.bag.w, h = G.bag.h, sag = cl(B.sag ?? .6), gb = bagGeo(w, h, sag);
    const sx = (B.s ?? 1) * (B.sx ?? 1), sy = (B.s ?? 1) * (B.sy ?? 1), q = lightAt(B.x, B.y, L);
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.rot || 0); ctx.scale(sx, sy); ctx.transform(1, 0, .1, 1, 0, 0);   // the top slouches to the left
    // the back panel + the dark inside seen over the drooping front edge
    gb.outline(); let gr = ctx.createLinearGradient(0, -h * .6, 0, -h * .2); gr.addColorStop(0, lit('#3A3741', B.x, B.y, L, .3)); gr.addColorStop(1, '#0B0A0D'); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); gb.outline(); ctx.clip(); ctx.strokeStyle = 'rgba(190,186,206,.28)'; ctx.lineWidth = 2.4;          // the back edge's lit lip
    ctx.beginPath(); ctx.moveTo(-w * .38, -h * .45); ctx.bezierCurveTo(-w * .26, -h * .57, -w * .08, -h * .49, w * .02, -h * .55); ctx.bezierCurveTo(w * .14, -h * .61, w * .3, -h * .51, w * .41, -h * .45); ctx.stroke(); ctx.restore();
    // the front panel: matte charcoal fabric
    gb.front(); gr = ctx.createLinearGradient(-w * .5, -h * .4, w * .45, h * .4);
    gr.addColorStop(0, lit('#5A5663', B.x, B.y, L, .5)); gr.addColorStop(.45, lit('#302D37', B.x, B.y, L)); gr.addColorStop(1, lit('#18161C', B.x, B.y, L, -.4)); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); gb.front(); ctx.clip();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .4; ctx.fillStyle = fabric(); ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // drape folds hanging from the two top corners towards the sagging middle (a hammock), deeper as it slouches
    ctx.lineCap = 'round'; const dd = .8 + .5 * sag;
    const folds = [[-.36, -.4, -.2, -.18 * dd, -.02, -.02], [-.38, -.3, -.24, .02, -.06, .16], [.38, -.42, .22, -.2 * dd, .06, -.04], [.4, -.3, .26, 0, .1, .18], [-.12, .08, -.02, .22, .04, .4]];
    folds.forEach((f, i) => {
      const path = (ox, oy) => { ctx.beginPath(); ctx.moveTo(w * f[0] + ox, h * f[1] + oy); ctx.quadraticCurveTo(w * f[2] + ox, h * f[3] + oy, w * f[4] + ox, h * f[5] + oy); };
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 9 + 4 * R(i, 3); path(2, 4); ctx.stroke();
      ctx.strokeStyle = `rgba(222,216,232,${(.15 + .12 * q.s).toFixed(3)})`; ctx.lineWidth = 3.4; path(-2, -3); ctx.stroke();
    });
    const sh = ctx.createRadialGradient(-w * .26, -h * .2, 4, -w * .26, -h * .2, w * .6);                    // a dull broad sheen on the door side
    sh.addColorStop(0, `rgba(200,196,216,${(.16 + .12 * q.s).toFixed(3)})`); sh.addColorStop(1, 'rgba(200,196,216,0)'); ctx.fillStyle = sh; ctx.fillRect(-w, -h, 2 * w, 2 * h);
    const bt = ctx.createLinearGradient(0, -h * .1, 0, h * .5); bt.addColorStop(0, 'rgba(0,0,0,0)'); bt.addColorStop(1, 'rgba(0,0,0,.42)'); ctx.fillStyle = bt; ctx.fillRect(-w, -h, 2 * w, 2 * h);
    ctx.restore();
    // the front edge: a rolled, uneven hem catching the light, a crooked seam under it
    ctx.save(); ctx.lineCap = 'round';
    const hem = (oy) => { ctx.beginPath(); ctx.moveTo(-w * .4, -h * .44 + oy); ctx.bezierCurveTo(-w * .28, -h * (.34 - .1 * dd) + oy, -w * .12, -h * (.3 - .12 * dd) + oy, w * .02, -h * (.31 - .13 * dd) + oy);
      ctx.bezierCurveTo(w * .16, -h * (.32 - .12 * dd) + oy, w * .32, -h * (.36 - .08 * dd) + oy, w * .42, -h * .46 + oy); };
    hem(0); ctx.strokeStyle = lit('#6A6674', B.x, B.y, L, .4); ctx.lineWidth = 4; ctx.stroke();
    hem(12); ctx.strokeStyle = 'rgba(170,166,180,.4)'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // warm rim of the morning sun on the door side (separates it from the dark back wall)
    ctx.save(); gb.outline(); ctx.clip(); ctx.translate(7, 6); gb.outline(); ctx.translate(-7, -6);
    ctx.lineWidth = 7; ctx.strokeStyle = `rgba(255,214,160,${(.22 + .25 * q.s).toFixed(3)})`; ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  /** ONE thin strap (a cheap long cord): a loop that whips above the bag in the jump, then drapes over the carton's right
   *  rim and dangles down its side (drawn after the carton's front). Catmull-Rom through key points (bag-local, unscaled). */
  const STRAP_AIR = [[-74, -100], [-120, -190], [-74, -290], [30, -306], [112, -236], [104, -156], [80, -104]];
  const STRAP_REST = [[-74, -100], [-20, -176], [104, -150], [176, -56], [194, 56], [204, 150], [214, 66], [206, -48], [80, -104]];
  function strapPts(B, t) {
    const k = cl(S.spr(t - A.bagLand + .06, 14, .32), 0, 1.25), n = 24, out = [];
    const cr = (P, u) => {                                                                // centripetal-ish Catmull-Rom on a polyline
      const m = P.length - 1, x = u * m, i = Math.min(m - 1, Math.floor(x)), f = x - i, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(m, i + 2)];
      const c = (a, b, c2, d) => .5 * ((2 * b) + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
      return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
    };
    for (let i = 0; i <= n; i++) { const u = i / n, a = cr(STRAP_AIR, u), r = cr(STRAP_REST, u), sw = 4 * Math.sin(t * 2.3 + u * 5) * u * (1 - u), yy = mix(a[1], r[1], k); out.push([mix(a[0], r[0], k) + sw + .1 * Math.min(0, yy), yy]); }
    const c = Math.cos(B.rot || 0), sn = Math.sin(B.rot || 0), sx = (B.s ?? 1) * (B.sx ?? 1), sy = (B.s ?? 1) * (B.sy ?? 1);
    return out.map(([x, y]) => [B.x + (x * sx) * c - (y * sy) * sn, B.y + (x * sx) * sn + (y * sy) * c]);
  }
  function strap(B, t, L) {
    const pts = strapPts(B, t), line = (ox, oy) => { ctx.beginPath(); ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy); for (const p of pts) ctx.lineTo(p[0] + ox, p[1] + oy); };
    const o = shadowOff(B.x + 150, B.y, 8, L);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    line(o.x, o.y); ctx.strokeStyle = `rgba(${SH},.35)`; ctx.lineWidth = 7; ctx.stroke();
    line(0, 0); ctx.strokeStyle = lit('#2A2730', B.x, B.y, L); ctx.lineWidth = 6.5; ctx.stroke();
    line(-1.5, -1.5); ctx.strokeStyle = 'rgba(255,232,200,.3)'; ctx.lineWidth = 1.6; ctx.stroke();
    for (const p of [pts[0], pts[pts.length - 1]]) { ctx.fillStyle = lit('#151318', p[0], p[1], L); ctx.beginPath(); ctx.ellipse(p[0], p[1] + 3, 7, 9, B.rot || 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function recv(C, B, t, L) {
    if (!C) return;
    const n = Math.round(t * 30), g = S.cartonGeo(C), key = OM_key(C.x, C.y, C.sx ?? 1, C.sy ?? 1, C.rot || 0, C.a ?? 1, (C.shake || 0) > .002 ? Math.floor(n / 2) : -1, Math.round((C.shake || 0) * 50), L.sun, L.violet, L.dim);
    const bb = [g.FBL[0] - 150, g.BTL[1] - 190, g.BBR[0] + 190, C.y + 150];
    OM_cached('recvBack', key, bb, 1.25, () => CK.draw(C, 'back', t, L));
    if (B && B.jump > 0) {                                                              // the bag's shadow inside the carton while it is in the air
      ctx.save(); ctx.fillStyle = `rgba(${SH},${(.3 * (1 - .5 * B.jump)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(B.x + 20, C.y - C.h + 4, 90 - 30 * B.jump, 24, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    if (B && (B.a ?? 1) > 0) {
      const sq = Math.round((B.sag ?? .6) * 25) / 25, Bq = { ...B, sag: sq };                // the slouch breathes in small steps: the body is cached between them
      OM_cached('recvBag', OM_key(B.x, B.y, B.rot || 0, B.s ?? 1, B.sx ?? 1, B.sy ?? 1, sq, L.sun, L.violet, L.dim), [B.x - 230, B.y - 230, B.x + 230, B.y + 190], 1.25, () => softBag(Bq, t, L));
    }
    OM_cached('recvFront', key, bb, 1.25, () => CK.draw(C, 'front', t, L));
    if (B && (B.a ?? 1) > 0) strap(B, t, L);
  }

  // =============================================================================================
  // 4. TOI'S SUBTITLE + the incoming plate's shadow (world)
  // =============================================================================================
  const SUB = { px: 88, lh: 96, ow: 8, lines: ['Mes sacs', 'sont arrivés !'] };
  let SUBL = null;
  function subLayout() {
    if (SUBL) return SUBL;
    const f = `900 ${SUB.px}px Satoshi`, gl = [], lines = [];
    const cap = (() => { if (!MC) MC = makeCanvas(8, 8).getContext('2d'); MC.font = f; return MC.measureText('H').actualBoundingBoxAscent; })();
    SUB.lines.forEach((s, li) => {
      const w = mw(f, s), x0 = G.sub.x - w / 2, base = G.sub.y - SUB.lh / 2 + li * SUB.lh + cap / 2;
      lines.push({ s, x0, base, w });
      for (let j = 0; j < s.length; j++) { const ch = s[j]; if (ch === ' ') continue; const xl = x0 + mw(f, s.slice(0, j)), cw = mw(f, ch); gl.push({ ch, x: xl + cw / 2, y: base - cap / 2, dy: cap / 2, w: cw, li, k: gl.length }); }
    });
    return (SUBL = { f, gl, lines, cap });
  }
  /** the amber plate's shadow before the plate itself is on screen: a virtual height that continues into its fall */
  function incomingShadow(t, L, str) {
    const t1 = A.slam; if (t < A.shadow0 || t >= t1) return;
    const k = kk(t, A.shadow0, t1), e = Math.pow(k, 1.6), sway = 12 * Math.sin(t * 4.2) * (1 - e);
    const o = shadowOff(G.sub.x, G.sub.y, mix(170, 13, e), L), sc = mix(1.4, 1, e);      // it slides in from the sun's side, grows sharp
    const W0 = G.plateW.amber * sc, H0 = G.plateH.amber * sc, blur = mix(70, 8, e), a = mix(.3, .86, Math.pow(k, 1.3)) * str;
    ctx.save(); ctx.translate(G.sub.x + o.x + sway, G.sub.y + o.y);
    softPath(() => ctx.rect(-W0 / 2, -H0 / 2, W0, H0), blur, `rgba(${SH},${a.toFixed(3)})`);
    ctx.restore();
  }
  function subtitle(sb, t, L) {
    if (!sb) return;
    if (sb.a > 0) {
      const { f, lines } = subLayout();
      incomingShadow(t, L, 1);
      const crouch = 1 - .07 * sst(kk(t, A.slam - .12, A.slam));
      ctx.save(); ctx.globalAlpha *= sb.a; ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.letterSpacing = '0px';
      if (crouch < 1) { const yb = lines[1].base; ctx.translate(0, yb); ctx.scale(1, crouch); ctx.translate(0, -yb); }
      const o = shadowOff(G.sub.x, G.sub.y, 6, L);
      softPath(() => { ctx.fillStyle = ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * SUB.ow; for (const l of lines) { ctx.strokeText(l.s, l.x0 + o.x * .6, l.base + o.y * .6); ctx.fillText(l.s, l.x0 + o.x * .6, l.base + o.y * .6); } }, 5, `rgba(${SH},.6)`);
      ctx.lineWidth = 2 * SUB.ow; ctx.strokeStyle = '#08050C'; for (const l of lines) ctx.strokeText(l.s, l.x0, l.base);
      ctx.fillStyle = '#FFFFFF'; for (const l of lines) ctx.fillText(l.s, l.x0, l.base);
      ctx.restore();
      incomingShadow(t, L, .3);                                                          // the shadow also falls on the words
    }
  }

  // =============================================================================================
  // 5. THE SPLASH: the subtitle's letters squirt out from under the plate and roll away like marbles (world, under)
  // =============================================================================================
  let SPL = null;
  function splashParams() {
    if (SPL) return SPL;
    const { gl } = subLayout();
    SPL = gl.map((g, k) => {
      const u = cl((g.x - G.sub.x) / 330, -1, 1), sd = u < 0 ? -1 : 1;
      let dir, out;
      if (g.li === 0) { dir = [sd * (.96 + .04 * R(k, 1)), -.16 - .14 * R(k, 2)]; out = [0, -1]; }                         // top line: out of the top edge, then along the counter
      else { const a = Math.PI / 2 - u * 1.15 + (R(k, 3) - .5) * .25; dir = [Math.cos(a), Math.sin(a)]; out = [0, 1]; }   // bottom line: fans out downwards
      const l = Math.hypot(dir[0], dir[1]); dir = [dir[0] / l, dir[1] / l];
      return { g, dir, out, emerge: 70 + 40 * R(k, 4), v: 820 + 420 * R(k, 5), vz: 520 + 300 * R(k, 6), spin: (R(k, 7) > .5 ? 1 : -1) * (dir[0] >= 0 ? 1 : -1), delay: .02 * R(k, 8) };
    });
    return SPL;
  }
  function hop(vz, tau, gr, e, nb) { let v = vz; for (let b = 0; b <= nb; b++) { const d = 2 * v / gr; if (tau < d) return v * tau - gr * tau * tau / 2; tau -= d; v *= e; } return 0; }
  function fxUnder(t, L) {
    const sb = S.subtitle(t); if (!sb || t < A.slam) return;
    const tau0 = t - A.slam, { f } = subLayout(), list = [];
    for (const p of splashParams()) {
      const tau = tau0 - p.delay; if (tau <= 0) continue;
      const em = p.emerge * (1 - Math.exp(-tau / .05));                               // squeezed out from under the edge
      const roll = p.v * (tau - .04) * (1 - .18 * Math.min(1, tau)); const rl = Math.max(0, roll);
      const x = p.g.x + p.out[0] * em + p.dir[0] * rl, y = p.g.y + p.out[1] * em + p.dir[1] * rl;
      const hh = hop(p.vz, tau, 6000, .32, 2), a = 1 - kk(tau0, 1.0, 1.18);
      if (a <= 0) continue;
      list.push({ g: p.g, x, y, h: hh, rot: p.spin * rl / 44, s: 1 + hh * .0024, a });
    }
    if (!list.length) return;
    ctx.save(); ctx.font = f; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.letterSpacing = '0px';
    for (const q of list) {                                                            // shadows on the cloth (down-right, sharper as they land)
      const o = shadowOff(q.x, q.y, q.h * .4 + 4, L);
      ctx.save(); ctx.globalAlpha = q.a * .5 / (1 + q.h * .01); ctx.translate(q.x + o.x, q.y + o.y); ctx.rotate(q.rot); ctx.fillStyle = `rgb(${SH})`;
      ctx.lineWidth = 2 * SUB.ow; ctx.strokeStyle = `rgb(${SH})`; ctx.strokeText(q.g.ch, 0, q.g.dy); ctx.fillText(q.g.ch, 0, q.g.dy); ctx.restore();
    }
    for (const q of list) {
      ctx.save(); ctx.globalAlpha = q.a; ctx.translate(q.x, q.y - q.h * .45); ctx.rotate(q.rot); ctx.scale(q.s, q.s);
      ctx.lineWidth = 2 * SUB.ow; ctx.strokeStyle = '#08050C'; ctx.strokeText(q.g.ch, 0, q.g.dy); ctx.fillStyle = '#FFFFFF'; ctx.fillText(q.g.ch, 0, q.g.dy);
      ctx.restore();
    }
    ctx.restore();
  }

  return { memeBand, photo, recv, subtitle, fxUnder, rigidTote, subLayout };
})();

function OM_memeBand(mb, t) { OM_M.memeBand(mb, t); }
function OM_photo(P, t, L) { OM_M.photo(P, t, L); }
function OM_recv(C, B, t, L) { OM_M.recv(C, B, t, L); }
function OM_subtitle(sb, t, L) { OM_M.subtitle(sb, t, L); }
function OM_fxUnder(t, L) { OM_M.fxUnder(t, L); }
/** bonus for M2 (same look as the photo): the black rigid tote, body w×h centred at (0, 0), into any 2D context g */
function OM_rigidTote(g, w, h) { OM_M.rigidTote(g || ctx, w, h); }
