'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — the RUSH (real footage). Functions only; 50_compose.js calls RU_rush(t, n) first (bottom layer),
// the engine lays RU_grain(n) over everything once per frame.
//   RU_rush(t, n)  r(t) → rush frame (SCORE.frameOf, decoded beforehand by window.PRELOAD), the camera SCORE.cam(t)
//                  (STOP punch-in + damped shake, the single push ×1 → ×4 on the r 1.00 freeze, ×4.00 → ×4.12, the dezoom,
//                  the ×1.10 framing of the live segment, the ×1.00 → ×1.04 end push), the horizontal smear SCORE.smear(t)
//                  (whip pans, rewind, 2 heavy frames at the splice, the whip back), the HD zoom layer crossfaded in
//                  between ×1.4 and ×1.6 (feathered edges), the STOP darkening (25 %), the vignette (never on the label:
//                  centred on the screen during the hunt so it never points at the answer, on the label during the zoom,
//                  40 %), the top shade behind the titles (y 140 → 800, 45 %).
//   RU_grain(n)    film grain over the whole frame (drawings included): 6 precomputed tiles, tile + offset drawn by rnd(n).
// Pure functions of t (and n for the grain); no ctx.filter, no Math.random. Reads SCORE (01_score.js).
// Privacy: the zoom layer carries the mosaic under the BONZINI line (made by the frames agent, §5.3). Without the layer,
// the fallback pixelates that area itself from ×1.8 (fully from ×2). The real letters are never redrawn.
// =============================================================================================
const RU = (function () {
  const S = window.SCORE, A = S.A, T = S.T, R = S.RUSH, kk = S.kk, ease = S.ease;
  const DIAG = { draws: 0 };
  /** draw a rush image into FRAME px (the 1080×1920 prepared frame); the 464×832 source PNG is mapped ×2.3276, y − 8 */
  function drawImg(img, dx) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w === 1080 && h === 1920) { ctx.drawImage(img, dx, 0); return; }
    const s = 1080 / w, dy = h * s > 1921 ? -R.cropY * s / R.scale : 0;
    ctx.drawImage(img, dx, dy, w * s, h * s); DIAG.draws++;
  }
  /** frame-px rect → the image's own px */
  function imgRect(img, x, y, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (iw === 1080 && ih === 1920) return [x, y, w, h];
    const s = 1080 / iw, dy = ih * s > 1921 ? -R.cropY * s / R.scale : 0;
    return [x / s, (y - dy) / s, w / s, h / s];
  }
  // ---------- the HD zoom layer (r100_x4.png): geometry + a feathered copy, built once ----------
  let ZG = null, ZF = null;
  function zoomGeo() {
    if (ZG) return ZG;
    const Z = window.ZOOM, img = Z && Z.img, g = (Z && Z.geo) || {};
    const ar = img ? (img.naturalWidth / img.naturalHeight) : 180 / 170;
    if (Array.isArray(g.screen1_rect) && g.screen1_rect.length === 4) {          // frames agent: [x, y, w, h] in FRAME px
      const q = g.screen1_rect; ZG = { x: q[0], y: q[1], w: q[2], h: q[3], src: g.src_rect || null, frame: true }; return ZG;
    }
    let box = null; const arr = g.src_rect || g.src || g.crop || g.box || g.src_box || g.rect || g.source;
    if (g.src_rect && !g.format) g.format = 'xywh';
    const pick = (a) => {                                     // [x0, y0, x1, y1] or [x, y, w, h]: the one whose aspect matches the image
      const c1 = [a[0], a[1], a[2], a[3]], c2 = [a[0], a[1], a[0] + a[2], a[1] + a[3]];
      const ok = c => c[2] > c[0] && c[3] > c[1], err = c => Math.abs(Math.log(((c[2] - c[0]) / (c[3] - c[1])) / ar));
      if (g.format === 'xywh') return c2; if (g.format === 'xyxy') return c1;
      if (ok(c1) && (!ok(c2) || err(c1) <= err(c2))) return c1; return c2;
    };
    if (Array.isArray(arr) && arr.length === 4) box = pick(arr);
    else if (arr && typeof arr === 'object') box = [arr.x0 ?? arr.x, arr.y0 ?? arr.y, arr.x1 ?? (arr.x + arr.w), arr.y1 ?? (arr.y + arr.h)];
    else if (g.x0 !== undefined) box = [g.x0, g.y0, g.x1, g.y1];
    if (!box || !box.every(Number.isFinite)) box = [90, 430, 270, 600];          // STORYBOARD §5.3
    const frame = g.space === 'frame';                                          // default: SOURCE px (464×832)
    const s = frame ? 1 : R.scale, oy = frame ? 0 : -R.cropY;
    ZG = { x: box[0] * s, y: box[1] * s + oy, w: (box[2] - box[0]) * s, h: (box[3] - box[1]) * s, src: box };
    return ZG;
  }
  function zoomFeathered() {
    if (ZF) return ZF;
    const geo = window.ZOOM.geo || {};
    if (geo.alpha === true || /RGBA|alpha ramps/i.test(geo.how || '')) { ZF = window.ZOOM.img; return ZF; }   // already feathered
    const img = window.ZOOM.img, w = img.naturalWidth, h = img.naturalHeight, c = makeCanvas(w, h), g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'destination-out';
    const F = Math.round(Math.min(w, h) * .07);
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
    edge(0, 0, F, 0, 0, 0, F, h); edge(w, 0, w - F, 0, w - F, 0, F, h); edge(0, 0, 0, F, 0, 0, w, F); edge(0, h, 0, h - F, 0, h - F, w, F);
    ZF = c; return ZF;
  }
  // ---------- privacy fallback (no zoom layer): pixelate the lines under BONZINI on the zoomed r 1.00 freeze ----------
  const MOS = { dy0: .55, dy1: 1.12, dx0: -.06, dx1: 1.06, block: 22 };   // relative to the white card (49 × 23.5 source px)
  function mosaic(img, c, a) {
    if (a <= 0) return;
    const L = S.labelFrame(S.frameOfR(R.zoomR)), x = L.x + L.w * MOS.dx0, y = L.y + L.h * MOS.dy0, w = L.w * (MOS.dx1 - MOS.dx0), h = L.h * (MOS.dy1 - MOS.dy0);
    const blk = MOS.block / c.s, pw = Math.max(1, Math.ceil(w / blk)), ph = Math.max(1, Math.ceil(h / blk));
    const sm = makeCanvasCached('ru_mos', 64, 64), g = sm.getContext('2d'); g.clearRect(0, 0, 64, 64);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const [sx, sy, sw, sh] = imgRect(img, x, y, w, h); g.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
    ctx.save(); ctx.globalAlpha *= a; ctx.imageSmoothingEnabled = false; ctx.drawImage(sm, 0, 0, pw, ph, x, y, pw * blk, ph * blk); ctx.restore();
  }
  // ---------- shading (screen space) ----------
  function vignette(t) {
    // {cx, cy, r0, r1, a}: r0 = the clear radius (never reaches the label), a = darkness at r1
    if (t < A.stop) { const k = ease(kk(t, A.pan2e, A.stop)); return { cx: 540, cy: 1000, r0: 600 - 80 * k, r1: 1250, a: .20 + .20 * k }; }
    if (t < A.zoom) return { cx: 540, cy: 1000, r0: 520, r1: 1250, a: .40 - .12 * kk(t, A.rew, A.zoom) };
    if (t < A.whip) {
      const L = S.label(t), k = ease(kk(t, A.zoom, A.zoom + .45)) * (1 - kk(t, A.out, A.whip));
      const r0 = Math.max(L.w * .78, 140) + 20;
      return { cx: S.lerpv(540, L.cx, k), cy: S.lerpv(1000, L.cy, k), r0: S.lerpv(520, r0, k), r1: S.lerpv(1250, r0 + 760, k), a: S.lerpv(.28, .40, k) };
    }
    return { cx: 540, cy: 980, r0: 600, r1: 1250, a: .22 };
  }
  function topShade(t) {
    const title = 1 - kk(t, A.stop + .05, A.stop + .3);
    const qa = t >= A.stop ? Math.min(kk(t, A.stop, A.stop + .2), 1 - kk(t, A.out, A.out + .25)) : 0;
    return { a: .45 * Math.max(title, qa), y1: qa > title ? 840 : 800 };
  }
  function shade(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dk = .25 * Math.min(kk(t, A.stop, A.stop + .04), 1 - kk(t, A.rew, A.rew + .25));
    if (dk > 0) { ctx.fillStyle = `rgba(0,0,0,${dk.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    const v = vignette(t);
    if (v.a > 0) { const g = ctx.createRadialGradient(v.cx, v.cy, v.r0, v.cx, v.cy, v.r1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.6, `rgba(0,0,0,${(v.a * .55).toFixed(3)})`); g.addColorStop(1, `rgba(0,0,0,${v.a.toFixed(3)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // the zoom: the brown bag (a possible third-party pattern) stays in the shadow — left side, ends 30 px before the label
    if (t >= A.zoom && t < A.whip) {
      const L = S.label(t), k = ease(kk(t, A.zoom + .1, A.ring)) * (1 - kk(t, A.out, A.whip)), x1 = Math.max(0, L.x - 30);
      if (k > 0 && x1 > 40) { const g = ctx.createLinearGradient(0, 0, x1, 0); g.addColorStop(0, `rgba(0,0,0,${(.42 * k).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, x1, H); }
    }
    const ts = topShade(t);
    if (ts.a > 0) { const g = ctx.createLinearGradient(0, 0, 0, ts.y1); g.addColorStop(0, `rgba(8,4,14,${ts.a.toFixed(3)})`); g.addColorStop(140 / ts.y1, `rgba(8,4,14,${ts.a.toFixed(3)})`); g.addColorStop(1, 'rgba(8,4,14,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, ts.y1); }
    ctx.restore();
  }
  // ---------- the picture ----------
  function draw(t, n) {
    if (S.rushHidden(t)) return;
    const f = S.frameOf(t), img = window.rushImg ? window.rushImg(f) : null;
    if (!img) return;
    const c = S.cam(t), px = S.smear(t);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (px > 1) { const e = 1 + px / W; ctx.translate(540, 960); ctx.scale(e, e); ctx.translate(-540, -960); }   // the smear never shows an edge
    ctx.translate(c.qx + c.sx, c.qy + c.sy); ctx.scale(c.s, c.s); ctx.translate(-c.fx, -c.fy);
    if (px > 1) { const K = 7; for (let k = 0; k < K; k++) { ctx.globalAlpha = 1 / (k + 1); drawImg(img, (k / (K - 1) - .5) * px / c.s); } ctx.globalAlpha = 1; }
    else drawImg(img, 0);
    // the brown bag (a possible third-party pattern) darkened 25 % on the two freezes (STORYBOARD § 5.1): the prepared
    // full-frame shades of frames 228 (the STOP, r 7.60) and 60 (the end, r 2.00), ramped in over .2 s, same transform
    const bs = window.BAGSHADE || {};
    const bA = (f === 228 && t >= A.stop && t < A.rew + .03) ? kk(t, A.stop, A.stop + .2) * (1 - kk(t, A.rew, A.rew + .03))
      : (f === 60 && t >= A.ctaFreeze) ? kk(t, A.ctaFreeze, A.ctaFreeze + .2) : 0;
    if (bA > 0 && bs[f]) { ctx.globalAlpha = bA; ctx.drawImage(bs[f], 0, 0, 1080, 1920); ctx.globalAlpha = 1; }
    const za = S.zoomLayer(t), Z = window.ZOOM;
    if (za > 0 && Z && Z.img) { const g = zoomGeo(); ctx.globalAlpha = za; ctx.drawImage(zoomFeathered(), g.x, g.y, g.w, g.h); ctx.globalAlpha = 1; }
    else if (!(Z && Z.img) && t >= A.zoom && t < A.whip + .05) mosaic(img, c, kk(c.s, 1.8, 2.0));
    ctx.restore();
    shade(t);
  }
  // ---------- grain ----------
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
    const tiles = grainTiles(), i = Math.floor(rnd(n * 1.618 + 3.1) * tiles.length) % tiles.length;
    const ox = -Math.floor(rnd(n * 2.71 + 1.7) * 70), oy = -Math.floor(rnd(n * 3.33 + 5.9) * 22);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .16;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(tiles[i], ox, oy, 1152, 1944); ctx.restore();
  }
  return { draw, filmGrain, zoomGeo, vignette, topShade, DIAG, MOS };
})();
function RU_rush(t, n) { RU.draw(t, n); }
function RU_grain(n) { RU.filmGrain(n); }
