'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — M1 · 30_ring.js — the violet FELT-PEN ellipse around the real label + the violet arrow.
//   RG_ring(t, n, st)   screen space, called by 50_compose.js right after the rush (under the type), st = SCORE.ring(t):
//   • answer (A.ring → A.whip, the ×4 freeze): a felt ellipse traced AROUND the white card (never on the letters: the
//     margins of MODULES.md + a slight tilt that follows the card's own slant, so even its corners stay inside), drawn in
//     st.draw (.4 s), closing with an overshoot that passes just outside its start (darker ink where it re-passes), a soft
//     violet halo (shadowBlur) growing with st.halo — the first violet on the real image. Its bottom is kept ≤ 1183 so it
//     clears « écrit à la main ». On W(N4,'bonz') (st.arrow.p) a felt arrow leaves the answer's BONZINI (TY_wordBox),
//     swings around the right of « ÉTAIT LÀ / DÈS LE DÉBUT ! » and lands on the ellipse's upper right, square to it;
//     shaft first, then the head as one V stroke (ink pools at the tip).
//   • follow (A.live → A.card) and recall (A.cta → T.end): the same pen, thinner (st.lw), around label(t) — st.box is
//     the box of the very picture shown at t (every motion-blur sample), so the ellipse sticks to the hand-held label.
//   Felt look: a filled ribbon (one polygon, round caps) whose width follows the pen pressure (touch-down blob, lift-off
//   taper, speed wobble, a held-at-an-angle nib), a wobbly radius (4 slow harmonics + a small spiral), an on-twos boil from n, ink pooled at the
//   edges, light nib streaks along the stroke, a faint dark contact shade so the violet holds on bright footage.
// Pure function of (t, n, st); deterministic (seeded sines, no Math.random); never ctx.filter. Violet only (Bonzini).
// The stroke is drawn into an offscreen layer when st.a < 1, so the stacked passes fade as one.
// =============================================================================================
(function () {
  const S = window.SCORE, COL = S.COL, G = S.G, cl = S.cl, kk = S.kk;
  const TAU = Math.PI * 2;
  const SM = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const BOTTOM_MAX = 1183;                                             // « écrit à la main » starts at y 1200 (G.hand.y0)

  // ---------- polyline helpers ----------
  function lens(p) { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; }
  /** even resampling (step px) */
  function resample(p, step) {
    const L = lens(p), tot = L[L.length - 1], n = Math.max(2, Math.ceil(tot / step)), out = []; let j = 1;
    for (let i = 0; i <= n; i++) { const d = tot * i / n; while (j < p.length - 1 && L[j] < d) j++; const k = L[j] > L[j - 1] ? (d - L[j - 1]) / (L[j] - L[j - 1]) : 0; out.push([p[j - 1][0] + (p[j][0] - p[j - 1][0]) * k, p[j - 1][1] + (p[j][1] - p[j - 1][1]) * k]); }
    return out;
  }
  /** first `lim` px of a polyline (+ its widths), the last point interpolated */
  function head(p, wd, L, lim) {
    const P = [p[0]], Wd = [wd[0]];
    for (let i = 1; i < p.length; i++) {
      if (L[i] <= lim) { P.push(p[i]); Wd.push(wd[i]); continue; }
      const k = (lim - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      if (k > 1e-3) { P.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]); Wd.push(wd[i - 1] + (wd[i] - wd[i - 1]) * k); }
      break;
    }
    return [P, Wd];
  }
  const normals = p => p.map((_, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  /** the ribbon outline: left side forward, round head cap, right side back, round tail cap — one closed path */
  function ribbon(g, p, wd) {
    g.beginPath();
    if (p.length < 2) { g.arc(p[0][0], p[0][1], wd[0] / 2, 0, TAU); return; }
    const N = normals(p), m = p.length - 1;
    for (let i = 0; i <= m; i++) { const h = wd[i] / 2, x = p[i][0] + N[i][0] * h, y = p[i][1] + N[i][1] * h; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    const fe = Math.atan2(N[m][1], N[m][0]); g.arc(p[m][0], p[m][1], wd[m] / 2, fe, fe - Math.PI, true);
    for (let i = m; i >= 0; i--) { const h = wd[i] / 2; g.lineTo(p[i][0] - N[i][0] * h, p[i][1] - N[i][1] * h); }
    const f0 = Math.atan2(N[0][1], N[0][0]); g.arc(p[0][0], p[0][1], wd[0] / 2, f0 + Math.PI, f0, true);
    g.closePath();
  }
  /** offset polyline (fraction f of the local width, along the normal) */
  const offset = (p, wd, f) => { const N = normals(p); return p.map((q, i) => [q[0] + N[i][0] * wd[i] * f, q[1] + N[i][1] * wd[i] * f]); };
  function poly(g, p) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); }

  // ---------- the felt pen ----------
  /** pressure along the stroke (d px of tot): touch-down blob, a speed wobble, the lift-off taper over the last `tail` */
  function pressure(d, tot, lw, seed, o = {}) {
    const blob = 1 + (o.blob ?? .32) * Math.exp(-d / (.8 * lw)) - .08 * Math.exp(-Math.pow((d - 2.2 * lw) / (1.4 * lw), 2));
    const tail = o.tail ?? .12, lift = 1 - (o.lift ?? .66) * SM((d - tot * (1 - tail)) / (tot * tail));
    const wob = 1 + .07 * Math.sin(d / (5.5 * lw) + seed * 2.3) + .04 * Math.sin(d / (2.1 * lw) + seed * 5.1);
    return Math.max(.22, blob * lift * wob);
  }
  /** the nib is held at an angle: strokes across it (the ellipse's sides) come out a little wider than along it */
  const NIB = -.6;
  const nib = (p, wd) => wd.map((w, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dir = Math.atan2(b[1] - a[1], b[0] - a[0]); return w * (1 + .13 * Math.cos(2 * (dir - NIB))); });
  /** one felt stroke: contact shade, halo (wide + tight), the ink, pooled edges, nib streaks; `re` = the re-passed part */
  function felt(g, p, wd, o) {
    if (p.length < 1) return;
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    ribbon(g, p, wd); g.fillStyle = COL.violet;
    g.shadowColor = `rgba(14,3,26,${(.42 * (o.under ?? 1)).toFixed(3)})`; g.shadowBlur = o.lw * .9; g.shadowOffsetY = o.lw * .2; g.fill();
    if (o.glow > 0) {
      g.shadowOffsetY = 0;
      g.shadowColor = `rgba(169,71,254,${(.48 * o.glow).toFixed(3)})`; g.shadowBlur = o.glowBlur; g.fill();
      g.shadowColor = `rgba(190,120,255,${(.32 * o.glow).toFixed(3)})`; g.shadowBlur = o.glowBlur * .32; g.fill();
    }
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.strokeStyle = 'rgba(86,16,160,.50)'; g.lineWidth = Math.max(.8, o.lw * .1); g.stroke();          // ink pooled at the edges
    if (p.length > 3 && o.lw >= 6) {                                                                     // nib streaks
      g.lineWidth = Math.max(.7, o.lw * .08); g.strokeStyle = 'rgba(232,212,255,.20)';
      g.setLineDash([o.lw * 3.1, o.lw * 1.3, o.lw * 1.7, o.lw * .9]); g.lineDashOffset = o.seed * 13 + o.boil * 4;
      poly(g, offset(p, wd, .2)); g.stroke();
      g.strokeStyle = 'rgba(232,212,255,.11)'; g.lineDashOffset = o.seed * 29 + o.boil * 7; poly(g, offset(p, wd, -.24)); g.stroke();
      g.setLineDash([]);
    }
    // ink build-up: the touch-down dot, and the part the pen passes twice
    g.fillStyle = 'rgba(92,20,168,.34)'; g.beginPath(); g.arc(p[0][0], p[0][1], wd[0] * .26, 0, TAU); g.fill();
    if (o.re && o.re[0].length > 1) { ribbon(g, o.re[0], o.re[1].map(w => w * .58)); g.fillStyle = 'rgba(92,20,168,.30)'; g.fill(); }
    g.restore();
  }

  // ---------- the ellipse ----------
  const SEED = { answer: 1, follow: 2, recall: 3 }, TH0 = -.62 * Math.PI, OVER = .52, SPAN = TAU + OVER;
  // the hand's shape per mode. answer: measured on the ×4 layer (white paper corners TL 324,978 · TR 754,923; the mosaic
  // reaches 19 px left of the card, down to 293,1134): a margin of .15 w, a slight tilt with the paper's slant, the 2nd
  // harmonic leaning the ellipse along the card's diagonal and its centre .02 w to the left keep the paper ≥ 11 px inside
  // the stroke and the mosaic's far corner just at its edge, while the bottom stays ≤ BOTTOM_MAX (tools: m1 probe)
  const SHAPE = { 1: { rxk: .15, ryk: .2, tilt: -.05, a2: .04, ph2: 3.0, ox: -.02 }, 2: { rxk: .13, ryk: .2, tilt: -.07, a2: .016, ph2: 3.4, ox: 0 },
    3: { rxk: .13, ryk: .2, tilt: -.07, a2: .016, ph2: 5.1, ox: 0 } };
  /** the hand's radius factor at angle th, path fraction u: 4 slow harmonics (an egg, a flat side), a small spiral (the end
   *  passes just outside the start), the on-twos boil, and the nib landing just inside */
  const radK = (th, u, seed, boil) => 1 + .012 * Math.sin(th + seed * 3.3) + SHAPE[seed].a2 * Math.sin(2 * th + SHAPE[seed].ph2) + .010 * Math.sin(3 * th + seed * 4.1 + .5)
    + .005 * Math.sin(4 * th + seed) + .048 * (u - .5) + .0035 * Math.sin(5 * th + boil * 2.09 + seed) - .05 * (1 - SM(u / .045));
  /** the full centreline of the hand-drawn ellipse around box b (screen px) + its widths; `boil` = on-twos state */
  function ellipseLine(b, mode, lw, boil) {
    const seed = SEED[mode] || 1;
    const SH = SHAPE[seed], rx = b.w / 2 + Math.max(26, SH.rxk * b.w), ry = b.h / 2 + Math.max(18, SH.ryk * b.h);
    const tilt = SH.tilt, ca = Math.cos(tilt), sa = Math.sin(tilt);
    const th0 = TH0, span = SPAN, M = mode === 'answer' ? 220 : 120, ox = SH.ox * b.w;
    let pts = [];
    for (let i = 0; i <= M; i++) {
      const u = i / M, th = th0 + span * u;
      const k = radK(th, u, seed, boil), x = rx * k * Math.cos(th), y = ry * k * Math.sin(th);
      pts.push([b.cx + ox + x * ca - y * sa, b.cy + x * sa + y * ca]);
    }
    let dy = 0;
    if (mode === 'answer') {                                           // keep the bottom clear of « écrit à la main »
      const yMax = Math.max(...pts.map(q => q[1])) + lw * .7; if (yMax > BOTTOM_MAX) { dy = yMax - BOTTOM_MAX; pts = pts.map(q => [q[0], q[1] - dy]); }
    }
    const closeD = lens(pts)[Math.round(M * TAU / span)];              // where the pen comes back over its start
    pts = resample(pts, Math.max(2, lw * .35));
    const L = lens(pts), tot = L[L.length - 1];
    const wd = nib(pts, L.map(d => lw * pressure(d, tot, lw, seed, { tail: .1, lift: .62 })));
    return { pts, wd, L, tot, closeD, rx, ry, tilt, cx: b.cx + ox, cy: b.cy, dy, seed };
  }
  /** a point on the drawn ellipse's frame (angle th) + its outward normal (for the arrow) */
  function ellipseAt(E, th, dyFix, boil) {
    const u = (((th - TH0) % TAU) + TAU) % TAU / SPAN, k = radK(th, u, E.seed, boil);
    const ca = Math.cos(E.tilt), sa = Math.sin(E.tilt), x = E.rx * k * Math.cos(th), y = E.ry * k * Math.sin(th);
    let nx = Math.cos(th) / E.rx, ny = Math.sin(th) / E.ry; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    return { x: E.cx + x * ca - y * sa, y: E.cy + x * sa + y * ca - dyFix, nx: nx * ca - ny * sa, ny: nx * sa + ny * ca };
  }

  // ---------- the arrow: answer's BONZINI → the ellipse ----------
  function arrowLines(E, dyFix, lwE, boil) {
    const wb = typeof TY_wordBox === 'function' ? TY_wordBox('BONZINI') : null; if (!wb) return null;
    // the right ends of the answer's lines 2 and 3 (centred on G.cx), measured with their own font
    let r2 = 760, r3 = 910, b3 = wb.base + 205;
    if (typeof TY !== 'undefined' && TY.answerLayout) {
      const Lo = TY.answerLayout(); ctx.save(); ctx.font = `900 ${Lo.z}px Satoshi`;
      r2 = G.cx + ctx.measureText(Lo.L[1].replace(/\*/g, '')).width / 2; r3 = G.cx + ctx.measureText(Lo.L[2].replace(/\*/g, '')).width / 2; ctx.restore();
      b3 = Lo.base[2];
    }
    const lw = 11, e = ellipseAt(E, -.42, dyFix, boil), gap = lwE / 2 + 15;
    const tip = [e.x + e.nx * gap, e.y + e.ny * gap];
    const xR = Math.min(1030, Math.max(r2 + 150, r3 + 85, wb.x + wb.w + 18));
    const ctrl = [
      [wb.x + wb.w - 62, wb.base + 30],                                  // just under « …NI » of BONZINI
      [Math.min(1030, wb.x + wb.w + 20), wb.base + 102],                 // out to the right of « ÉTAIT LÀ »
      [xR, b3 + 44],                                                     // past the end of « DÈS LE DÉBUT ! »
      [tip[0] + e.nx * 92, tip[1] + e.ny * 92],                          // the approach, square to the ellipse
      tip,
    ];
    const shaft = resample(curve(ctrl, 16), 3);
    const L = lens(shaft), tot = L[L.length - 1];
    const wd = nib(shaft, L.map(d => lw * pressure(d, tot, lw, 7, { blob: .1, tail: .08, lift: .2 }) * (.62 + .38 * SM(d / 26))));
    // the head: one V stroke barb → tip → barb, square to the shaft's last direction
    const q0 = shaft[Math.max(0, shaft.length - 9)], ang = Math.atan2(tip[1] - q0[1], tip[0] - q0[0]), Lh = 42, sp = .5;
    const bA = [tip[0] - Lh * Math.cos(ang - sp), tip[1] - Lh * Math.sin(ang - sp)], bB = [tip[0] - Lh * Math.cos(ang + sp), tip[1] - Lh * Math.sin(ang + sp)];
    const hd = resample([bA, tip, bB], 2.5), HL = lens(hd), ht = HL[HL.length - 1];
    const hw = HL.map(d => lw * (.6 + .55 * Math.exp(-Math.pow((d - ht / 2) / 7, 2)) + .25 * SM(d / 10) - .45 * SM((d - ht * .78) / (ht * .22))));
    return { lw, shaft, wd, L, tot, hd, hw, HL, ht };
  }

  // ---------- draw ----------
  function paint(g, t, n, st) {
    const b = st.box, boil = Math.floor(n / 2) % 3, lw = st.lw;
    const E = ellipseLine(b, st.mode, lw, boil);
    const dyFix = E.dy;                                                // the bottom guard's lift: the arrow lands on the lifted ellipse
    if (st.draw > 0) {
      const lim = E.tot * cl(st.draw), [P, Wd] = head(E.pts, E.wd, E.L, lim);
      let re = null;
      if (lim > E.closeD) { const i0 = E.L.findIndex(d => d >= E.closeD); const [P2, W2] = head(E.pts.slice(i0), E.wd.slice(i0), E.L.slice(i0).map(d => d - E.L[i0]), lim - E.L[i0]); re = [P2, W2]; }
      const big = st.mode === 'answer';
      felt(g, P, Wd, { lw, glow: cl(st.halo), glowBlur: big ? 40 : 16, under: big ? 1 : .8, seed: E.seed, boil, re });
    }
    const ar = st.arrow;
    if (ar && ar.p > 0 && ar.a > 0) {
      const R = arrowLines(E, dyFix, lw, boil); if (!R) return;
      g.save(); g.globalAlpha *= cl(ar.a);
      const ps = cl(ar.p / .74), ph = cl((ar.p - .76) / .24);
      const [P, Wd] = head(R.shaft, R.wd, R.L, R.tot * ps);
      felt(g, P, Wd, { lw: R.lw, glow: .45 * cl(st.halo), glowBlur: 22, under: 1, seed: 7, boil });
      if (ph > 0) { const [Ph, Wh] = head(R.hd, R.hw, R.HL, R.ht * ph); felt(g, Ph, Wh, { lw: R.lw, glow: .45 * cl(st.halo), glowBlur: 22, under: 1, seed: 8, boil }); }
      g.restore();
    }
  }
  function draw(t, n, st) {
    if (!st || st.a <= 0 || !st.box) return;
    if (st.a >= .999) { paint(ctx, t, n, st); return; }
    const L = makeCanvasCached('rg_layer', W, H), g = L.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    paint(g, t, n, st);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= cl(st.a); ctx.drawImage(L, 0, 0); ctx.restore();
  }
  window.RG_M1 = { draw, ellipseLine, arrowLines };
})();
function RG_ring(t, n, st) { window.RG_M1.draw(t, n, st); }
