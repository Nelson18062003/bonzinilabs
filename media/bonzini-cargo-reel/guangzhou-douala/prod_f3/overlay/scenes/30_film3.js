'use strict';
// =============================================================================================
// 30_film3.js — the effects that belong to FILM 3 only (rush2/SERIE.md §3.7, §3.9, §5.3). The shared modules
// (20_duplex.js: band, pills, subtitles, stamps, signature) are untouched; this file only reads window.SCORE and adds
// layers to window.LAYERS (50_compose.js draws them: z < 60 over the footage and under the DUPLEX graphics, z ≥ 60 on top).
//
//   z 10  THE PLUNGE (1,70–2,00): the phone of P1 (frozen r 18,70) is entered through its own screen. The 4 corners of the
//         screen (keyed by hand on every frame r 18,40–18,70, SCORE.phoneQuad) are carried by a spiral path (zoom ×≈6 and the
//         phone's −14° tilt undone about one fixed point, + the perspective / aspect residual blended in) to the 4 corners of
//         the frame. P1 is warped by the homography quad → path(u); P2's first image (P2pre, r 3,40) is pinned into the
//         quad by the homography frame → path(u) and grows to the full frame — exactly the EDL's P2 at 2,00 (no seam).
//         Both warps are TRUE perspective maps drawn as a fine triangle mesh (affine texture per triangle, each triangle
//         clipped to itself grown by .75 px: no seam, no crack). The hand and the bald head leave through the edges.
//         The original screen content cross-fades to P2 in the first 0,10 s, a glass glint crosses the small screen.
//         In-layer motion blur: the composite is laid K times along the spiral motion between two engine sub-samples
//         (the zoom is fast: no ghost copies). The band and its text (a frozen render of the shared DX_draw, band only)
//         are sucked into the screen's centre, stretched along their path, 1 → 0 (1,70–1,90), with their own blur.
//   z 50  THE REC TAGS (§3.7): four white corners (6 px, 28 px) around a REAL phone + 10 px, the orange « ● REC » pill
//         above the top-left corner, the dot blinking at 2 Hz, 1,15 → 1 in 4 frames; the boxes are SCORE.rec(t) (tracked
//         every 3 frames, smoothed σ 2 frames) projected through the shot; during the plunge they ride the homography.
//   z 90  The ±6 px red / blue split of 2 frames of the plunge (SCORE.plunge(t).rgbFrames), the whole frame.
// Pure in t (n only picks the split frames); no Math.random, no ctx.filter; static images cached.
// =============================================================================================
(function () {
  const S = window.SCORE; if (!S || !S.plunge) return;
  const kk = S.kk, cl = S.cl, lp = S.lerp, easeOut = S.easeOut, easeIn = S.easeIn, ease = S.ease, COL = S.COL, G = S.G;
  const PI = Math.PI, TAU = 2 * PI;
  const W_ = 1080, H_ = 1920;

  // ---------------------------------------------------------------------------------------------------------------
  // linear algebra: homography from 4 point pairs, apply, invert; affine of a triangle pair
  // ---------------------------------------------------------------------------------------------------------------
  function solve(A, b) {                                   // Gaussian elimination with partial pivoting (8×8)
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }
  /** H (3×3, row-major array of 9) with H·src_i ∝ dst_i */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  const hApply = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };

  // ---------------------------------------------------------------------------------------------------------------
  // the mesh renderer: image `img` (iw × ih, drawn in its own px) mapped by the homography H onto the context g
  // ---------------------------------------------------------------------------------------------------------------
  const GROW = .75;                                        // px each triangle's clip is grown by (covers the AA crack)
  function triangle(g, img, s0, s1, s2, d0, d1, d2) {
    // affine m with m(s_k) = d_k: [a c e; b d f]
    const x0 = s0[0], y0 = s0[1], x1 = s1[0], y1 = s1[1], x2 = s2[0], y2 = s2[1];
    const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1); if (Math.abs(den) < 1e-9) return;
    const a = (d0[0] * (y1 - y2) + d1[0] * (y2 - y0) + d2[0] * (y0 - y1)) / den;
    const c = (d0[0] * (x2 - x1) + d1[0] * (x0 - x2) + d2[0] * (x1 - x0)) / den;
    const e = (d0[0] * (x1 * y2 - x2 * y1) + d1[0] * (x2 * y0 - x0 * y2) + d2[0] * (x0 * y1 - x1 * y0)) / den;
    const b = (d0[1] * (y1 - y2) + d1[1] * (y2 - y0) + d2[1] * (y0 - y1)) / den;
    const d = (d0[1] * (x2 - x1) + d1[1] * (x0 - x2) + d2[1] * (x1 - x0)) / den;
    const f = (d0[1] * (x1 * y2 - x2 * y1) + d1[1] * (x2 * y0 - x0 * y2) + d2[1] * (x0 * y1 - x1 * y0)) / den;
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const gr = p => { const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * GROW, p[1] + dy / L * GROW]; };
    const p0 = gr(d0), p1 = gr(d1), p2 = gr(d2);
    g.save(); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.clip();
    g.transform(a, b, c, d, e, f); g.drawImage(img, 0, 0); g.restore();
  }
  /** draw img warped by H as an nx × ny mesh; triangles wholly outside the frame are skipped; `skip(q)` can drop cells */
  function meshWarp(g, img, iw, ih, H, nx, ny, skip) {
    const P = []; for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) { const sx = iw * i / nx, sy = ih * j / ny; row.push({ s: [sx, sy], d: hApply(H, sx, sy) }); } P.push(row); }
    const out = (a, b, c, d) => { const xs = [a.d[0], b.d[0], c.d[0], d.d[0]], ys = [a.d[1], b.d[1], c.d[1], d.d[1]];
      return Math.max(...xs) < -2 || Math.min(...xs) > W_ + 2 || Math.max(...ys) < -2 || Math.min(...ys) > H_ + 2; };
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const A = P[j][i], B = P[j][i + 1], C = P[j + 1][i + 1], D = P[j + 1][i];
      if (out(A, B, C, D) || (skip && skip([A.d, B.d, C.d, D.d]))) continue;
      triangle(g, img, A.s, B.s, C.s, A.d, B.d, C.d);
      triangle(g, img, A.s, C.s, D.s, A.d, C.d, D.d);
    }
  }
  const inQuad = (q, x, y) => {                            // point inside a convex quad (either winding)
    let pos = 0, neg = 0;
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c > 0) pos++; else if (c < 0) neg++; }
    return !(pos && neg);
  };

  // ---------------------------------------------------------------------------------------------------------------
  // cached canvases
  // ---------------------------------------------------------------------------------------------------------------
  const CV = {};
  const canvas = (k, w = W_, h = H_) => { if (!CV[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; CV[k] = c; } return CV[k]; };
  const ctxOf = c => { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowColor = 'transparent'; return g; };
  const FRAME_CACHE = {};
  /** the full-frame content layer of an active shot (crop, baked blurs, grade), copied once per (shot, source frame) */
  function shotImage(a, t) {
    const key = a.shot.id + '/' + a.frames.map(q => q.f).join(',');
    if (FRAME_CACHE[key]) return FRAME_CACHE[key];
    const L = FT.content(a, t), c = document.createElement('canvas'); c.width = L.width; c.height = L.height;
    c.getContext('2d').drawImage(L, 0, 0); FRAME_CACHE[key] = c; return c;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // THE PLUNGE geometry at t: the screen quad (screen px, P1 at the freeze), the spiral path, the homographies
  // ---------------------------------------------------------------------------------------------------------------
  const RECT = [[0, 0], [W_, 0], [W_, H_], [0, H_]];
  const INSET = .045;                                      // the glass sits inside the body's outline (bezel)
  const GEO = {};
  /** the path's fixed data (once): the screen quad q, the similarity q → frame (s_e, θ_e, fixed point), the residual */
  function plungeBase(t) {
    if (GEO.base) return GEO.base;
    const pl = S.plunge(t), a1 = S.active(t).find(a => a.shot.id === pl.from); if (!a1 || !pl.quad) return null;
    const body = pl.quad.map(p => S.project(a1, p[0], p[1]));
    const cx = body.reduce((m, p) => m + p[0], 0) / 4, cy = body.reduce((m, p) => m + p[1], 0) / 4;
    const q = body.map(p => [cx + (p[0] - cx) * (1 - INSET), cy + (p[1] - cy) * (1 - INSET)]);
    // least-squares similarity q → RECT (complex numbers: z' = α z + β)
    const qc = [cx, cy], Tc = [W_ / 2, H_ / 2];
    let nr = 0, ni = 0, dd = 0;
    for (let i = 0; i < 4; i++) { const zx = q[i][0] - qc[0], zy = q[i][1] - qc[1], wx = RECT[i][0] - Tc[0], wy = RECT[i][1] - Tc[1]; nr += wx * zx + wy * zy; ni += wy * zx - wx * zy; dd += zx * zx + zy * zy; }
    const ar = nr / dd, ai = ni / dd, se = Math.hypot(ar, ai), te = Math.atan2(ai, ar);
    // fixed point f of the end similarity: f = (Tc − α qc) / (1 − α)
    const nx_ = Tc[0] - (ar * qc[0] - ai * qc[1]), ny_ = Tc[1] - (ar * qc[1] + ai * qc[0]), dr = 1 - ar, di = -ai, dm = dr * dr + di * di;
    const f = [(nx_ * dr + ny_ * di) / dm, (ny_ * dr - nx_ * di) / dm];
    const sim = (u, x, y) => { const s = Math.pow(se, u), th = te * u, c = Math.cos(th) * s, sn = Math.sin(th) * s, dx = x - f[0], dy = y - f[1]; return [f[0] + c * dx - sn * dy, f[1] + sn * dx + c * dy]; };
    const resid = q.map((p, i) => { const m = sim(1, p[0], p[1]); return [RECT[i][0] - m[0], RECT[i][1] - m[1]]; });
    GEO.base = { body, q, f, se, te, sim, resid, a1id: pl.from, a2id: pl.into };
    return GEO.base;
  }
  /** the path parameter: slow start (the eye finds the screen), fast middle, soft landing on P2 */
  const pathU = p => { const x = cl(p); return x * x * x * (x * (6 * x - 15) + 10); };   // smootherstep
  /** the screen corners at path value e ∈ [0, 1] */
  function corners(B, e) {
    const w = e * e;                                       // the residual (aspect, perspective) lands with the end
    return B.q.map((p, i) => { const m = B.sim(e, p[0], p[1]); return [m[0] + w * B.resid[i][0], m[1] + w * B.resid[i][1]]; });
  }

  function drawPlunge(ctx_, t, n) {
    const pl = S.plunge(t); if (!pl) return;
    const B = plungeBase(t); if (!B) return;
    const act = S.active(t), a1 = act.find(a => a.shot.id === B.a1id), a2 = act.find(a => a.shot.id === B.a2id); if (!a1 || !a2) return;
    const img1 = shotImage(a1, t), img2 = shotImage(a2, t);
    // one composite per in-layer sample along the motion (between two engine sub-samples)
    const mb = window.MB || 1, gap = mb > 1 ? .5 / (mb - 1) / 30 : .5 / 30;
    const dE = Math.abs(pathU(kk(t + gap / 2, pl.t0, pl.t1)) - pathU(kk(t - gap / 2, pl.t0, pl.t1)));
    const K = t < S.A.suck1 + .02 ? 8 : dE * Math.log(B.se) > .004 ? 5 : 1;   // the band in flight (8) or a visible zoom (5) inside the shutter gap
    const C = canvas('pl_comp'), g = ctxOf(C), acc = canvas('pl_acc'), ga = ctxOf(acc);
    if (K > 1) { ga.clearRect(0, 0, W_, H_); }
    for (let k = 0; k < K; k++) {
      const tk = K > 1 ? t + (k / (K - 1) - .5) * gap : t;
      const e = pathU(kk(tk, pl.t0, pl.t1)), Q = corners(B, e);
      g.fillStyle = '#000'; g.fillRect(0, 0, W_, H_);
      // P1 (frozen) carried by the same map: screen quad → Q. Cells wholly inside the screen are hidden by P2: skipped
      const H1 = homography(B.q, Q), qIn = Q;
      const full = kk(tk, pl.t0, pl.t0 + .10) >= 1;
      meshWarp(g, img1, W_, H_, H1, 14, 24, full ? (c => c.every(p => inQuad(qIn, p[0], p[1]))) : null);
      // the band, sucked into the screen: it passes UNDER the screen's picture (swallowed by it)
      suckInto(g, tk, B, pl);
      // P2 pinned into the screen: frame → Q (cross-fade from the phone's own picture in the first 0,10 s)
      const H2 = homography(RECT, Q), sw = ease(kk(tk, pl.t0, pl.t0 + .10));
      if (sw >= .999) meshWarp(g, img2, W_, H_, H2, 12, 20, null);
      else if (sw > .001) {                                // a partly transparent mesh would show its overlaps: warp opaque, then fade
        const P2c = canvas('pl_p2'), g2 = ctxOf(P2c); g2.clearRect(0, 0, W_, H_); meshWarp(g2, img2, W_, H_, H2, 12, 20, null);
        g.save(); g.globalAlpha = sw; g.drawImage(P2c, 0, 0); g.restore();
      }
      // the glass: a soft glint across the small screen + a dark rim (fades as the screen fills the frame)
      const gl = 1 - kk(e, .25, .65);
      if (gl > 0) {
        g.save(); g.beginPath(); g.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(Q[i][0], Q[i][1]); g.closePath(); g.clip();
        const x0 = Math.min(...Q.map(p => p[0])), x1 = Math.max(...Q.map(p => p[0])), y0 = Math.min(...Q.map(p => p[1])), y1 = Math.max(...Q.map(p => p[1]));
        const sweep = lp(-.4, 1.2, kk(tk, pl.t0 + .02, pl.t0 + .22)), gx = lp(x0, x1, sweep), gy = lp(y0, y1, sweep);
        const lg = g.createLinearGradient(gx - (x1 - x0) * .35, gy - (y1 - y0) * .2, gx + (x1 - x0) * .35, gy + (y1 - y0) * .2);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, `rgba(255,255,255,${(.22 * gl).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = lg; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.restore();
        g.save(); g.globalAlpha = .55 * gl; g.strokeStyle = 'rgba(8,8,12,1)'; g.lineWidth = Math.max(1.5, (x1 - x0) * .012); g.lineJoin = 'round';
        g.beginPath(); g.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(Q[i][0], Q[i][1]); g.closePath(); g.stroke(); g.restore();
      }
      if (K > 1) { ga.globalAlpha = 1 / (k + 1); ga.drawImage(C, 0, 0); }
    }
    ctx_.save(); ctx_.setTransform(1, 0, 0, 1, 0, 0); ctx_.drawImage(K > 1 ? acc : C, 0, 0); ctx_.restore();
    drawRecWarped(ctx_, t, B, pl);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // the band sucked into the screen: a frozen render of the shared DX_draw (band only), carried to the screen centre
  // ---------------------------------------------------------------------------------------------------------------
  let BAND_IMG = null;
  function bandImage(t, n) {
    if (BAND_IMG) return BAND_IMG;
    const c = canvas('band_only'), g = ctxOf(c); g.clearRect(0, 0, W_, H_);
    const main = ctx; ctx = g; S.setOnlyBand(true);
    try { ctx.save(); window.DX_draw(S.A.plunge - 1e-3, n); ctx.restore(); } finally { S.setOnlyBand(false); ctx = main; }
    BAND_IMG = c; return c;
  }
  const BAND_Y0 = () => G.band.pos.H - 40, BAND_Y1 = () => G.band.pos.H + G.band.h + 36;
  /** one sample of the band on its way into the screen (the plunge's own K samples give it its motion blur) */
  function suckInto(g, tk, B, pl) {
    if (typeof window.DX_draw !== 'function') return;
    const d = S.A.suck1 - S.A.plunge, p = kk(tk, pl.t0, pl.t0 + d); if (p >= 1) return;
    const img = bandImage(tk, 0), y0 = BAND_Y0(), y1 = BAND_Y1(), bc = [W_ / 2, G.band.pos.H + G.band.h / 2];
    const e = pathU(kk(tk, pl.t0, pl.t1)), Q = corners(B, e), target = [(Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4];
    const m = easeIn(p), mv = Math.pow(m, .7), pos = [lp(bc[0], target[0], mv), lp(bc[1], target[1], mv)];
    const sc = Math.max(.001, 1 - Math.pow(p, 1.6)), dir = Math.atan2(target[1] - bc[1], target[0] - bc[0]);   // a slow start, then it rushes in
    const stretch = 1 + .8 * Math.sin(PI * p) * p * p, squash = 1 / Math.sqrt(stretch);   // stretched along its path, late (no jerk at the start)
    g.save(); g.globalAlpha = 1 - kk(p, .80, 1);
    g.translate(pos[0], pos[1]); g.rotate(dir); g.scale(stretch, squash); g.rotate(-dir); g.rotate(B.te * e); g.scale(sc, sc);
    g.drawImage(img, 0, y0, W_, y1 - y0, -bc[0], y0 - bc[1], W_, y1 - y0);
    g.restore();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // THE REC TAG (§3.7)
  // ---------------------------------------------------------------------------------------------------------------
  const MONO = (z, w = 600) => `${w} ${z}px Martian`;
  function recPillWidth() { const c = canvas('rec_m', 4, 4).getContext('2d'); c.font = MONO(G.rec.font); return c.measureText('REC').width; }
  let PW = null;
  /** draw the tag on the 4 screen corners c (TL TR BR BL, the box already grown by the margin), alpha a, scale sc */
  function drawTag(g, c, a, sc, dot) {
    if (!(a > .003)) return;
    const R = G.rec, L = R.corner, cx = (c[0][0] + c[2][0]) / 2, cy = (c[0][1] + c[2][1]) / 2;
    const q = c.map(p => [cx + (p[0] - cx) * sc, cy + (p[1] - cy) * sc]);
    g.save(); g.globalAlpha *= a; g.lineCap = 'round'; g.lineJoin = 'round';
    const leg = (p, toward) => { const dx = toward[0] - p[0], dy = toward[1] - p[1], d = Math.hypot(dx, dy) || 1, l = Math.min(L, d * .4); return [p[0] + dx / d * l, p[1] + dy / d * l]; };
    const path = () => { g.beginPath(); for (let i = 0; i < 4; i++) { const p = q[i], A = leg(p, q[(i + 3) % 4]), Bq = leg(p, q[(i + 1) % 4]); g.moveTo(A[0], A[1]); g.lineTo(p[0], p[1]); g.lineTo(Bq[0], Bq[1]); } };
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetY = 1.5;
    g.strokeStyle = '#FFFFFF'; g.lineWidth = R.stroke; path(); g.stroke();
    g.shadowColor = 'transparent';
    // the « ● REC » pill above the top-left corner (Martian Mono 36 px, white on orange)
    if (PW === null) PW = recPillWidth();
    const h = 54, dotR = 9, padL = 18, gap = 12, padR = 20, w = padL + 2 * dotR + gap + PW + padR;
    const x = q[0][0] - R.stroke / 2, y = q[0][1] - 14 - h;
    g.shadowColor = 'rgba(30,8,0,.45)'; g.shadowBlur = 12; g.shadowOffsetY = 3;
    g.fillStyle = COL.orange; rr(g, x, y, w, h, R.r); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; rr(g, x + .75, y + .75, w - 1.5, h - 1.5, R.r - .75); g.stroke();
    if (dot) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x + padL + dotR, y + h / 2, dotR, 0, TAU); g.fill(); }
    else { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x + padL + dotR, y + h / 2, dotR - 1, 0, TAU); g.stroke(); }
    g.fillStyle = '#FFFFFF'; g.font = MONO(G.rec.font); g.textAlign = 'left'; g.textBaseline = 'middle'; g.letterSpacing = '1px';
    g.fillText('REC', x + padL + 2 * dotR + gap, y + h / 2 + 1); g.letterSpacing = '0px';
    g.restore();
  }
  function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /** a source box → its 4 screen corners grown by the margin, through the active shot */
  function boxCorners(a, b) {
    const pts = [[b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], [b[0], b[1] + b[3]]].map(p => S.project(a, p[0], p[1]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), m = G.rec.margin;
    const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m, y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  function drawRec(ctx_, t) {
    // film 3 review: the tag is drawn in the crisp pass, i.e. over everything — the band now drops slowly through the phone at
    // 10,85–11,15 (an ease-in exit), so the band (frame-locked, opaque) masks the tag while it passes over it
    const b = S.band(Math.round(t * S.FPS) / S.FPS), clip = b && b.a >= .5 && b.y1 > 0 && b.y0 < H_;
    if (clip) { ctx_.save(); ctx_.beginPath(); ctx_.rect(-W_, -H_, 3 * W_, 3 * H_); ctx_.rect(-W_, b.y0, 3 * W_, b.y1 - b.y0); ctx_.clip('evenodd'); }
    for (const r of S.rec(t)) {
      if (r.warp) continue;                                 // drawn by the plunge, on the homography
      const a = S.active(t).find(q => q.shot.id === r.shot); if (!a) continue;
      drawTag(ctx_, boxCorners(a, r.box), r.a, 1.15 - .15 * easeOut(r.pop), r.dot);
    }
    if (clip) ctx_.restore();
  }
  function drawRecWarped(ctx_, t, B, pl) {
    const r = S.rec(t).find(q => q.warp); if (!r) return;
    const a1 = S.active(t).find(q => q.shot.id === B.a1id); if (!a1) return;
    const c0 = boxCorners(a1, r.box), e = pathU(kk(t, pl.t0, pl.t1)), H1 = homography(B.q, corners(B, e));
    drawTag(ctx_, c0.map(p => hApply(H1, p[0], p[1])), r.a, 1, r.dot);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // the red / blue split (±6 px, whole frame) on 2 frames of the plunge
  // ---------------------------------------------------------------------------------------------------------------
  function rgbSplit(ctx_, d) {
    ctx_.save(); ctx_.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx_.getImageData(0, 0, W_, H_), a = img.data, src = a.slice(), row = W_ * 4;
    for (let y = 0; y < H_; y++) { const o = y * row; for (let x = 0; x < W_; x++) { const i = o + x * 4; a[i] = src[o + Math.min(W_ - 1, x + d) * 4]; a[i + 2] = src[o + Math.max(0, x - d) * 4 + 2]; } }
    ctx_.putImageData(img, 0, 0); ctx_.restore();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // the layers (window.LAYERS: 50_compose.js)
  // ---------------------------------------------------------------------------------------------------------------
  const L = window.LAYERS = window.LAYERS || [];
  L.push({ id: 'f3_plunge', z: 10, t0: S.A.plunge, t1: S.A.P2, draw: (g, t, n) => drawPlunge(g, t, n) });
  // the REC tags are TYPE: drawn once per frame in the crisp pass of 20_duplex / engine.html (window.COMPOSE_CRISP, defined by
  // 50_compose.js after this file loads: chained here on the first frame), never smeared; they move with the footage's shake
  function hookCrisp() {
    const f = window.COMPOSE_CRISP; if (typeof f !== 'function' || f.__f3) return;
    const g = (t, n) => { f(t, n); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fx = S.screenFx(t); if (fx.s !== 1 || fx.dx || fx.dy) { ctx.translate(540 + fx.dx, 960 + fx.dy); ctx.scale(fx.s, fx.s); ctx.translate(-540, -960); }
      drawRec(ctx, t); ctx.restore(); };
    g.__f3 = true; window.COMPOSE_CRISP = g;
  }
  L.push({ id: 'f3_rec', z: 50, draw: (g, t, n) => { hookCrisp(); if (typeof window.COMPOSE_CRISP !== 'function') drawRec(g, t); } });
  L.push({ id: 'f3_rgb', z: 90, t0: S.A.plunge, t1: S.A.P2, draw: (g, t, n) => { const pl = S.plunge(t); if (pl && pl.rgbFrames.includes(n)) rgbSplit(g, 6); } });
  window.F3_draw = () => { };                               // the takeover name of the 'rec' rows of SCORE.TEXTS()
  window.F3 = { homography, hApply, meshWarp, corners, plungeBase, pathU };
})();
