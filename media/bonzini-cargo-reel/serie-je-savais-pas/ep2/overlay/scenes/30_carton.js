'use strict';
// =============================================================================================
// M1 « carton & air » · 30_carton.js — THE CARTON of « TU PAIES DE L'AIR. » and the packing-table dressing.
//
//   CA_carton(st, pass, t, L)  st = an entry of SCORE.cartons(t) ('hero' | 'before' | 'loop'); compose calls it twice:
//     pass 'back'  : soft cast + contact shadow on the table; the open back and left flaps; the interior (back wall, left
//                    wall, floor); in cut-away mode (st.lid > 0) the light-blue void (sweep st.hatch, label « VIDE »
//                    st.vide) and the 3 unbranded pairs of slides (heap in the left corner → head-to-tail stack that the
//                    small carton hugs, st.sandals, stepped on twos).
//     pass 'front' : the right wall (this-way-up print, felt mark « LARGEUR », tape tab), the front wall or the lifted
//                    cut-paper lid (st.lid, cut edges with their flutes) with its ink (stamp « AU m³ » st.m3/m3k, felt
//                    marks st.marks), the top: open flaps (st.flaps, the kraft tape torn at the burst) or closed flaps
//                    (bulging with st.tremble) under the kraft tape (st.tape, laid by a tape roll that rolls along it).
//   CA_table(t, L, n)          the cream table + dressing (tape roll, cutter, pencil, offcuts): one cached sprite, the
//                              tape roll is live (it leaves its spot to tape the carton on pose 3).
//
// Geometry = SCORE.cartonGeo(st) exactly (foot = middle of the front bottom edge; oblique: depth Y → (+.30, −.50)·Y),
// SCORE.cartonJit(st, t) applied first (translate, rotate about the foot), then st.rot about (cx, foot y), like every
// module that draws on a carton. 3D frame: X right (from the foot), Y depth, Z up; screen = foot + (X + .3Y, −Z − .5Y).
// Material: one cached kraft-liner tile (fibres, flute washboard, recycled specks) mapped on every face through an affine
// pattern transform (flutes follow walls and flaps), shaded per face normal (window top-left) through lit(), so the
// brand's violet tints it. Deterministic (rnd), no ctx.filter. Measured (whole frame, flushed, min of 6): the hook ≈ 46 ms vs 21 ms with the fallbacks; M1 adds ≈ 25 ms there, mostly the
// texture-mapped big carton (≈ 15 ms raster); the split (2 cut-aways) ≈ 28 ms whole frame; closed small carton ≈ 2 ms.
// Shared M1 helpers live in CA_ (this file loads first): projection, liner, faces, dust puffs, soft blob, text fit.
// =============================================================================================
const CA_ = (function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, OB = S.OBL;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const ei = x => { x = cl(x); return x * x * x; };
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const tq = t => Math.floor(t * 15 + 1e-6) / 15;                  // stop-motion time, on twos
  const rgbA = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${a})`;
  const litA = (c, x, y, L, bias = 0) => lit(`rgb(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0})`, x, y, L, bias);
  const litRGB = (c, x, y, L, bias = 0) => { const m = litA(c, x, y, L, bias).match(/\d+/g); return [+m[0], +m[1], +m[2]]; };
  const VIEW = [OB.x, -1, -OB.y];                                    // towards the viewer (oblique projection)
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pv = v => [v[0] + v[1] * OB.x, -v[2] + v[1] * OB.y];        // screen vector of a 3D vector
  /** shade of a face by its (visible) normal: window light from the top-left, soft */
  const shadeN = n => cl(.86 - .14 * n[0] + .14 * n[2] + .03 * n[1], .3, 1.04);
  function poly(P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }

  // ---------- the kraft liner (one 512 tile, flutes vertical = along v) ----------
  let LIN = null, PAT = null;
  function liner() {
    if (LIN) return LIN;
    const N = 512, c = makeCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#DDB680'; g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x++) {                                     // washboard: the flutes under the liner (period 16)
      const v = Math.sin(x / 16 * Math.PI * 2);
      g.fillStyle = v > 0 ? `rgba(255,238,206,${(.07 * v).toFixed(3)})` : `rgba(96,58,22,${(-.07 * v).toFixed(3)})`; g.fillRect(x, 0, 1, N);
    }
    for (let i = 0; i < 70; i++) {                                    // mottling (wraps)
      const x = rnd(i * 9.1 + 3) * N, y = rnd(i * 7.7 + 1) * N, r = 30 + rnd(i * 6.3) * 110, dark = rnd(i * 2.2) > .5;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > N || cy + r < 0 || cy - r > N) continue;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, dark ? 'rgba(120,76,30,.05)' : 'rgba(255,240,210,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {                                  // fibres
      const x = rnd(i * 1.9 + 3) * N, y = rnd(i * 2.7 + 5) * N, a = rnd(i * 3.1) * Math.PI, l = 3 + rnd(i * 4.3) * 11;
      g.strokeStyle = rnd(i * 6.1) > .55 ? `rgba(118,78,38,${(.18 + rnd(i * 8.3) * .2).toFixed(2)})` : `rgba(246,224,186,${(.22 + rnd(i * 5.9) * .25).toFixed(2)})`;
      g.lineWidth = rnd(i) > .8 ? 1.3 : .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 320; i++) {                                   // recycled specks
      g.fillStyle = `rgba(${rnd(i * 4.4) > .5 ? '70,44,20' : '40,28,18'},${(.25 + rnd(i * 3.3) * .4).toFixed(2)})`;
      g.beginPath(); g.arc(rnd(i * 1.37 + 9) * N, rnd(i * 2.71 + 4) * N, .5 + rnd(i * 5.5) * 1.1, 0, 7); g.fill();
    }
    return (LIN = c);
  }
  function pat() { if (!PAT) PAT = ctx.createPattern(liner(), 'repeat'); return PAT; }
  /** fill polygon Pts with the liner (3D axes a = along the face, b = the flutes; origin O = screen) then multiply by the
   *  face shade k lit at O. o.ts = texture scale (world px per tile px), o.tint = rgb multipliers */
  function face(Pts, O, a, b, k, L, o = {}) {
    const ea = pv(a), eb = pv(b), sc = o.ts || .9, det = ea[0] * eb[1] - ea[1] * eb[0];
    poly(Pts);
    if (Math.abs(det) > .02) { const p = pat(); p.setTransform(new DOMMatrix([ea[0] * sc, ea[1] * sc, eb[0] * sc, eb[1] * sc, O[0], O[1]])); ctx.fillStyle = p; }
    else ctx.fillStyle = '#C9A473';
    ctx.fill();
    const tn = o.tint || [1, 1, 1];
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = litA([255 * k * tn[0], 255 * k * tn[1], 255 * k * tn[2]], O[0], O[1], L, o.bias || 0); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  /** a raw cut cardboard edge: strip p0→p1 extruded by the screen vector tv; flutes = a wave between the two liners */
  function cutEdge(p0, p1, tv, L, wave = true) {
    const tl = Math.hypot(tv[0], tv[1]); if (tl < .6) return;
    poly([p0, p1, [p1[0] + tv[0], p1[1] + tv[1]], [p0[0] + tv[0], p0[1] + tv[1]]]); ctx.fillStyle = litA([224, 192, 146], p0[0], p0[1], L); ctx.fill();
    if (tl < 2.2) return;
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (wave && len > 10) {
      const n = Math.max(2, Math.round(len / (tl * 1.5))), m = n * 6; ctx.beginPath();
      for (let i = 0; i <= m; i++) { const f = i / m, a = .5 + .34 * Math.sin(f * n * Math.PI * 2); const x = p0[0] + (p1[0] - p0[0]) * f + tv[0] * a, y = p0[1] + (p1[1] - p0[1]) * f + tv[1] * a; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = Math.max(.8, tl * .13); ctx.strokeStyle = 'rgba(122,82,40,.6)'; ctx.stroke();
    }
    ctx.lineWidth = Math.max(.7, tl * .12); ctx.strokeStyle = 'rgba(112,72,34,.5)';
    for (const a of [.1, .9]) { ctx.beginPath(); ctx.moveTo(p0[0] + tv[0] * a, p0[1] + tv[1] * a); ctx.lineTo(p1[0] + tv[0] * a, p1[1] + tv[1] * a); ctx.stroke(); }
    ctx.restore();
  }
  function hull(pts) {                                                // monotone chain
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /** soft fill of a convex polygon: stacked inflated copies (solid fills: ~10× cheaper than a blur) */
  function softPoly(P, blur, a, n = 5, col = '52,30,10') {
    if (a <= .004) return;
    let cx = 0, cy = 0; for (const q of P) { cx += q[0]; cy += q[1]; } cx /= P.length; cy /= P.length;
    const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n);
    ctx.fillStyle = `rgba(${col},${al.toFixed(4)})`;
    for (let i = 0; i < n; i++) {
      const e = -blur * .5 + blur * 1.5 * i / (n - 1);
      poly(P.map(q => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * e, q[1] + dy / l * e]; })); ctx.fill();
    }
  }
  // ---------- a soft round blob sprite (shadows, glows) ----------
  let BLOB = null;
  function blob() {
    if (BLOB) return BLOB;
    const c = makeCanvas(128, 128), g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(.45, 'rgba(0,0,0,.62)'); rg.addColorStop(.75, 'rgba(0,0,0,.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128); return (BLOB = c);
  }
  /** soft dark ellipse (cast shadow of a floating thing) */
  function softShadow(x, y, rx, ry, a) { if (a <= .004) return; ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(blob(), x - rx, y - ry, 2 * rx, 2 * ry); ctx.restore(); }

  // ---------- paper dust (sprites, like « PAS REÇU. ») ----------
  let DS = null;
  function dustSprites() {
    if (DS) return DS;
    const mk = (seed, col) => {
      const N = 96, c = makeCanvas(N, N), g = c.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const x = N / 2 + (R(i, seed) - .5) * N * .34, y = N / 2 + (R(i, seed + 1) - .5) * N * .34, r = N * (.2 + .2 * R(i, seed + 2));
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${col},${(.3 + .3 * R(i, seed + 3)).toFixed(2)})`); rg.addColorStop(.6, `rgba(${col},${(.12 + .1 * R(i, seed + 4)).toFixed(2)})`); rg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, N, N);
      }
      return c;
    };
    DS = { warm: [0, 1, 2].map(k => mk(300 + k * 7, '176,138,92')), light: [0, 1, 2].map(k => mk(400 + k * 7, '250,244,232')) };
    return DS;
  }
  /** dust puffs from emitters [{x, y, nx, ny, s}] at progress k (0..1); o {n, seed, dist, size, a, spread, rise, tj, out, light} */
  function puffs(ems, k, o = {}) {
    if (k <= 0 || k >= 1) return;
    const grow = 1 - Math.pow(1 - k, 3.2), fade = Math.pow(1 - k, 1.4) * cl(k * 16);
    const out = o.out ?? 10, n = o.n || 6, seed = o.seed || 1, dist = o.dist || 90, size = o.size || 34, A0 = o.a ?? .6, spread = o.spread ?? .9, rise = o.rise ?? 26, tj = o.tj ?? 30;
    const D = dustSprites(), spr = o.light ? D.light : D.warm; let id = 0;
    ctx.save();
    for (const e of ems) {
      const nl = Math.hypot(e.nx, e.ny) || 1, nx = e.nx / nl, ny = e.ny / nl, base = Math.atan2(ny, nx), str = e.s ?? 1;
      for (let j = 0; j < n; j++, id++) {
        const r1 = R(id, seed), r2 = R(id, seed + 1), r3 = R(id, seed + 2), r4 = R(id, seed + 3), r5 = R(id, seed + 4);
        const a = base + (r1 - .5) * spread, dd = dist * (.25 + .75 * r2) * str * grow, tg = (r5 - .5) * tj;
        const px = e.x + nx * out - ny * tg + Math.cos(a) * dd, py = e.y + ny * out + nx * tg + Math.sin(a) * dd * .75 - rise * grow * (.3 + .7 * r3);
        const rad = size * (.55 + 1.1 * grow) * (.65 + .55 * r3) * Math.sqrt(str), al = A0 * fade * (.55 + .45 * r4);
        if (al < .01) continue;
        ctx.globalAlpha = al; ctx.drawImage(spr[id % 3], px - rad, py - rad, 2 * rad, 2 * rad);
      }
    }
    ctx.restore();
  }
  // ---------- text helpers ----------
  let MC = null;
  function measureW(s, f) { if (!MC) MC = makeCanvas(8, 8).getContext('2d'); MC.font = f; MC.letterSpacing = '0px'; return MC.measureText(s).width; }

  return { S, G, A, T, OB, cl, kk, mix, sst, eo, ei, R, tq, rgbA, litA, litRGB, VIEW, dot, pv, shadeN, poly, liner, pat, face, cutEdge, hull, softPoly,
    blob, softShadow, dustSprites, puffs, measureW };
})();

// =============================================================================================
// THE CARTON
// =============================================================================================
const CA_K = (function () {
  const H = CA_, S = H.S, A = H.A, T = H.T, G = H.G, OB = H.OB;
  const { cl, kk, mix, sst, eo, R, tq, pv, dot, VIEW, shadeN, face, poly, litA, rgbA, cutEdge } = H;
  const DEG = Math.PI / 180, FLAP_MAX = 114 * DEG, LID_MAX = 150 * DEG;
  const FL = { front: 1.2, back: .92, side: 1.03 };                // per flap: the front one falls further out (the opening reads)
  let M3WIN = null;                                                  // the « AU m³ » stamp's life, from SCORE.TEXTS()
  const m3Win = () => M3WIN || (M3WIN = (S.TEXTS().find(x => x[2] === 'm3') || [A.stampM3 - .14, A.flank + .15]).slice(0, 2));
  const INK = '#231629', ORANGE = '#FE560D', SEA = '#0B5FA5';
  // per-call state (set by draw)
  let o = { x: 0, y: 0 }, w = 600, h = 340, d = 300, s = 1, th = 7, TS = .9;
  const P = (X, Y, Z) => [o.x + X + Y * OB.x, o.y - Z + Y * OB.y];
  const PP = p => P(p[0], p[1], p[2]);
  const add3 = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
  const neg = v => [-v[0], -v[1], -v[2]];

  // ------------------------------------------------------------------ shadow on the table
  function shadow(st, L) {
    const v = L.violet || 0, kx = .26 * (1 - .8 * v), ky = .15 * (1 - .8 * v);
    const foot = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)];
    const top = foot.map(p => [p[0] + kx * h, p[1] + ky * h]);
    const hl = H.hull(foot.concat(top));
    H.softPoly(hl, 26 * s, .26, 5);
    H.softPoly(foot.map(p => [p[0] + 4 * s, p[1] + 3 * s]), 9 * s, .3, 3);
    // contact: a tight dark seam where the walls meet the table
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(52,28,8,.32)'; ctx.lineWidth = 7 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, 0, 0)); ctx.lineTo(...P(w / 2, 0, 0)); ctx.lineTo(...P(w / 2, d, 0)); ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------ flaps
  function flapDef(which) {
    switch (which) {
      case 'front': return { A: [-w / 2, 0, h], B: [w / 2, 0, h], c: [0, 1, 0], len: d / 2, ax: [1, 0, 0], seed: 1 };
      case 'back': return { A: [-w / 2, d, h], B: [w / 2, d, h], c: [0, -1, 0], len: d / 2, ax: [1, 0, 0], seed: 2 };
      case 'left': return { A: [-w / 2, 0, h], B: [-w / 2, d, h], c: [1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 3 };
      default: return { A: [w / 2, 0, h], B: [w / 2, d, h], c: [-1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 4 };
    }
  }
  /** one flap at angle a (0 shut … FLAP_MAX wide open, leaning out); returns its frame for decorations */
  function flap(which, a, L, st, deco = true) {
    const F = flapDef(which), c = F.c, ct = Math.cos(a), sn = Math.sin(a);
    const u = [c[0] * ct, c[1] * ct, sn], nOut = [-c[0] * sn, -c[1] * sn, ct];
    const len = F.len, minor = which === 'left' || which === 'right';
    const ch = minor ? Math.min(len * .35, 26 * s) : 0;                 // minor flaps: chamfered tips
    const A2 = add3(F.A, u, len), B2 = add3(F.B, u, len);
    const vis = dot(nOut, VIEW) >= 0, n = vis ? nOut : neg(nOut);
    const pA = PP(F.A), pB = PP(F.B);
    const tA = PP(add3(add3(F.A, u, len), F.ax, ch)), tB = PP(add3(add3(F.B, u, len), F.ax, -ch));
    const mA = PP(add3(F.A, u, len - ch)), mB = PP(add3(F.B, u, len - ch));
    // the tip's cut edge: corrugation, towards the hidden side
    cutEdge(tA, tB, pv(n.map(x => -x * th)), L, true);
    const pts = minor ? [pA, pB, mB, tB, tA, mA] : [pA, pB, PP(B2), PP(A2)];
    face(pts, pA, F.ax, u, shadeN(n) * (vis ? 1.04 : .97), L, { ts: TS, tint: vis ? [1, .97, .9] : [1.03, 1, .95] });
    // the flap's side edges, a fine dark line: it reads as a separate panel
    ctx.save(); ctx.strokeStyle = 'rgba(70,40,12,.35)'; ctx.lineWidth = 1.6 * s; ctx.lineJoin = 'round'; poly(pts); ctx.stroke(); ctx.restore();
    // the crease along the hinge catches the light; a soft shade at the tip side away from the light
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,240,212,.45)'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(...pA); ctx.lineTo(...pB); ctx.stroke(); ctx.restore();
    const fr = { vis, u, nOut, n, F, len, pA, pB, a, deco };
    if (deco && vis && !minor && (st.id === 'hero' || st.id === 'before') && st.flaps > .02 && st.tape <= 0) tornTape(fr, L);
    return fr;
  }
  /** the half of the burst kraft tape left on a major flap's tip (torn edge at the tip) */
  function tornTape(fr, L) {
    const tw = 24 * s, F = fr.F, u = fr.u, len = fr.len;
    const ex = [F.ax[0], F.ax[1], F.ax[2]], X0 = -6 * s, X1 = w + 6 * s;
    const base = add3(F.A, u, len - tw);
    const p = (x, v) => PP(add3(add3(base, ex, x), u, v));
    ctx.save(); ctx.beginPath(); let first = true;
    const M = 26;
    for (let i = 0; i <= M; i++) { const x = X0 + (X1 - X0) * i / M, q = p(x, 0); first ? ctx.moveTo(...q) : ctx.lineTo(...q); first = false; }
    for (let i = M * 2; i >= 0; i--) { const x = X0 + (X1 - X0) * i / (M * 2), jag = tw * (.62 + .5 * R(i, F.seed * 7)), q = p(x, Math.min(tw + 6 * s, jag)); ctx.lineTo(...q); }
    ctx.closePath();
    ctx.fillStyle = litA([168, 116, 62], fr.pA[0], fr.pA[1], L); ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,180,.35)'; ctx.lineWidth = 1.4 * s; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ interior
  function interior(st, t, L) {
    const lk = sst(st.lid), occ = mix(.58, .78, lk);
    const bw = [P(-w / 2, d, h), P(w / 2, d, h), P(w / 2, d, 0), P(-w / 2, d, 0)];
    face(bw, bw[0], [1, 0, 0], [0, 0, -1], .86 * occ, L, { ts: TS, tint: [1, .97, .93] });
    const lw = [P(-w / 2, 0, h), P(-w / 2, d, h), P(-w / 2, d, 0), P(-w / 2, 0, 0)];
    face(lw, lw[0], [0, 1, 0], [0, 0, -1], .7 * occ, L, { ts: TS, tint: [1, .97, .93] });
    const fl = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)];
    face(fl, fl[0], [1, 0, 0], [0, 1, 0], .95 * occ, L, { ts: TS, tint: [1, .98, .94] });
    // occlusion: the inside corners darken, the left wall's shade on the floor and the back wall
    ctx.save();
    let gr = ctx.createLinearGradient(...P(-w / 2, d * .5, 0), ...P(-w / 2 + Math.min(w * .5, 220 * s), d * .5, 0));
    gr.addColorStop(0, 'rgba(40,20,4,.38)'); gr.addColorStop(1, 'rgba(40,20,4,0)'); ctx.fillStyle = gr; poly(fl); ctx.fill(); poly(bw); ctx.fill();
    gr = ctx.createLinearGradient(...P(0, d, 0), ...P(0, d, Math.min(h * .5, 120 * s))); gr.addColorStop(0, 'rgba(40,20,4,.34)'); gr.addColorStop(1, 'rgba(40,20,4,0)'); ctx.fillStyle = gr; poly(bw); ctx.fill();
    gr = ctx.createLinearGradient(...P(0, d, 0), ...P(0, d * .45, 0)); gr.addColorStop(0, 'rgba(40,20,4,.3)'); gr.addColorStop(1, 'rgba(40,20,4,0)'); ctx.fillStyle = gr; poly(fl); ctx.fill();
    // without the front open, the depth is a dark well
    if (lk < 1) { gr = ctx.createLinearGradient(...P(0, d, h), ...P(0, d, 0)); gr.addColorStop(0, 'rgba(36,18,4,0)'); gr.addColorStop(1, `rgba(36,18,4,${(.45 * (1 - lk)).toFixed(3)})`); ctx.fillStyle = gr; poly(bw); ctx.fill(); }
    // corner lines and the bottom flaps' seam
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(46,24,6,.35)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, d, h)); ctx.lineTo(...P(-w / 2, d, 0)); ctx.lineTo(...P(w / 2, d, 0)); ctx.moveTo(...P(-w / 2, d, 0)); ctx.lineTo(...P(-w / 2, 0, 0)); ctx.stroke();
    ctx.strokeStyle = 'rgba(46,24,6,.22)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(...P(-w / 2, d / 2, 0)); ctx.lineTo(...P(w / 2, d / 2, 0)); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ the void (light-blue hatching) + « VIDE »
  function voidBox(st, t, L) {
    const k = st.hatch; if (k <= 0) return;
    const hex = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(w / 2, d, h), P(-w / 2, d, h), P(-w / 2, 0, h)];
    const x0 = P(-w / 2, 0, 0)[0] - 4, x1 = P(w / 2, d, h)[0] + 6, xs = mix(x0, x1, sst(k)), yT = P(0, d, h)[1] - 10, yB = o.y + 10;
    ctx.save(); poly(hex); ctx.clip(); ctx.beginPath(); ctx.rect(x0 - 40, yT - 40, xs - x0 + 40, yB - yT + 80); ctx.clip();
    ctx.fillStyle = litA([168, 205, 236], o.x, o.y - h / 2, L); ctx.globalAlpha *= .62; poly(hex); ctx.fill(); ctx.globalAlpha /= .62;
    // the volume's top face a touch lighter
    ctx.fillStyle = 'rgba(232,244,255,.28)'; poly([P(-w / 2, 0, h), P(w / 2, 0, h), P(w / 2, d, h), P(-w / 2, d, h)]); ctx.fill();
    // diagonal hatching, crawling on twos
    const sp = 30 * s, off = (tq(t) * 45 * s) % sp, H0 = yB - yT + 40;
    ctx.strokeStyle = 'rgba(47,120,189,.62)'; ctx.lineWidth = 5.5 * s; ctx.lineCap = 'butt'; ctx.beginPath();
    for (let x = x0 - H0; x < xs + 10; x += sp) { ctx.moveTo(x + off, yB + 20); ctx.lineTo(x + off + H0, yB + 20 - H0); }
    ctx.stroke();
    ctx.restore();
    // the void's outline (dashed), the sweep's wet edge
    ctx.save(); ctx.setLineDash([14 * s, 10 * s]); ctx.strokeStyle = 'rgba(47,120,189,.55)'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.rect(x0, yT, xs - x0, 1); ctx.restore();
    if (k < 1) { ctx.save(); poly(hex); ctx.clip(); ctx.fillStyle = 'rgba(240,250,255,.75)'; ctx.fillRect(xs - 5 * s, yT - 20, 7 * s, yB - yT + 40); ctx.restore(); }
  }
  function videLabel(st, t, L) {                                      // high in the void: the cloud settles below it
    const v = st.vide; if (v <= .01) return;
    const z = Math.round(108 * s), X = (-w / 2 + 380 * s + w / 2) / 2 + 6 * s, Z = h - 50 * s, p = P(X, 0, Z), sc = .55 + .45 * H.eo(v) + .12 * Math.sin(Math.PI * cl(v));
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-.04); ctx.scale(sc, sc); ctx.globalAlpha *= cl(v * 1.6);
    ctx.font = `900 ${z}px Stencil`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${Math.round(6 * s)}px`; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(226,240,252,.92)'; ctx.lineWidth = 16 * s; ctx.strokeText('VIDE', 0, 0);
    ctx.fillStyle = SEA; ctx.fillText('VIDE', 0, 0);
    ctx.restore();
  }

  // ------------------------------------------------------------------ the slides (3 unbranded pairs)
  const SL = { L: 320, W: 82, sole: 30, strap: 20, pitch: 56 };
  const PAIRS = [
    { strap: [30, 140, 126], bed: [241, 236, 226], edge: [214, 206, 192] },     // teal / off-white
    { strap: [44, 74, 142], bed: [62, 62, 72], edge: [36, 36, 43] },            // navy / charcoal
    { strap: [191, 74, 46], bed: [234, 211, 166], edge: [205, 178, 131] },      // brick / sand
  ];
  // heap: [dx from the left wall, Y, Z, angle, mirror] in px at s = 1 (a tumbled pile in the left corner)
  const HEAP = [[170, 84, 0, .1, 1, 0], [182, 212, 0, -.22, -1, 1], [196, 148, 30, 2.9, 1, 0], [236, 128, 62, -.62, -1, 0], [162, 196, 60, .46, 1, 1], [214, 108, 92, 3.62, -1, 0]];   // [dx, Y, Z, angle, mirror, upside-down]
  let SOLE = null, STRAP = null, BEDIN = null;
  function solePaths() {
    if (SOLE) return;
    // unit length 1 (heel −.5 → toe +.5), y = width; outer side y > 0, the arch on the inner side
    const out = [[-.5, 0], [-.47, .08], [-.36, .112], [-.18, .108], [0, .112], [.2, .13], [.36, .128], [.46, .09], [.5, .02]];
    const inn = [[.5, -.02], [.47, -.07], [.38, -.118], [.2, -.122], [.05, -.09], [-.1, -.074], [-.28, -.094], [-.44, -.084], [-.5, 0]];
    const pts = out.concat(inn), p = new Path2D();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    p.moveTo(...mid(pts[pts.length - 1], pts[0]));
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; p.quadraticCurveTo(a[0], a[1], ...mid(a, b)); }
    p.closePath(); SOLE = p;
    const b = new Path2D(); const sc = .84; b.moveTo(...mid(pts[pts.length - 1], pts[0]).map(v => v * sc));
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; b.quadraticCurveTo(a[0] * sc + .005, a[1] * sc, ...mid(a, c).map(v => v * sc)); }
    b.closePath(); BEDIN = b;
    const st = new Path2D(); st.moveTo(-.1, -.15); st.quadraticCurveTo(.05, -.17, .2, -.155); st.quadraticCurveTo(.24, 0, .2, .155); st.quadraticCurveTo(.05, .17, -.1, .15); st.quadraticCurveTo(-.13, 0, -.1, -.15); st.closePath(); STRAP = st;
  }
  /** one slide lying on the floor at (X, Y, Z) (carton coords), angle a, mirror m */
  function slide(pair, X, Y, Z, a, m, L, flip = 0) {
    solePaths();
    const C = PAIRS[pair], ls = SL.L * s, so = SL.sole * s, sh = SL.strap * s, cx = P(X, Y, Z);
    const at = (z, fn) => { ctx.save(); ctx.translate(0, -z); ctx.transform(1, 0, OB.x, OB.y, o.x, o.y); ctx.translate(X, Y); ctx.rotate(a); ctx.scale(ls, ls * m); fn(); ctx.restore(); };
    const edge = litA(C.edge, cx[0], cx[1], L, -.4), edgeD = litA(C.edge.map(v => v * .78), cx[0], cx[1], L, -.6), bed = litA(C.bed, cx[0], cx[1], L, .3);
    const strap = litA(C.strap, cx[0], cx[1], L, .2), strapD = litA(C.strap.map(v => v * .7), cx[0], cx[1], L, -.4);
    at(Z - 1, () => { ctx.fillStyle = 'rgba(40,20,4,.32)'; ctx.translate(.012, -.02); ctx.fill(SOLE); });          // contact shade
    at(Z, () => { ctx.fillStyle = edgeD; ctx.fill(SOLE); });
    at(Z + so * .5, () => { ctx.fillStyle = edge; ctx.fill(SOLE); });
    if (flip) {                                                       // upside down: the tread shows, the strap is underneath
      at(Z + so, () => { ctx.fillStyle = edgeD; ctx.fill(SOLE); ctx.save(); ctx.clip(SOLE); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .022; ctx.beginPath();
        for (let x = -.5; x < .55; x += .07) { ctx.moveTo(x, -.15); ctx.lineTo(x + .035, 0); ctx.lineTo(x, .15); } ctx.stroke(); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .012; ctx.stroke(SOLE); });
      return;
    }
    at(Z + so, () => {
      ctx.fillStyle = bed; ctx.fill(SOLE);
      ctx.fillStyle = 'rgba(40,24,10,.10)'; ctx.fill(BEDIN);                                        // the moulded footbed
      ctx.fillStyle = 'rgba(40,24,10,.10)'; ctx.beginPath(); ctx.ellipse(-.36, 0, .09, .065, 0, 0, 7); ctx.ellipse(.3, .02, .1, .08, 0, 0, 7); ctx.fill();   // heel & ball imprints
    });
    at(Z + so + sh * .45, () => { ctx.fillStyle = strapD; ctx.fill(STRAP); });
    at(Z + so + sh, () => {
      ctx.fillStyle = strap; ctx.fill(STRAP);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = .012; ctx.beginPath(); ctx.moveTo(-.07, -.12); ctx.quadraticCurveTo(-.1, 0, -.07, .12); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.setLineDash([.012, .012]); ctx.beginPath(); ctx.moveTo(.17, -.13); ctx.quadraticCurveTo(.2, 0, .17, .13); ctx.stroke(); ctx.setLineDash([]);
    });
  }
  function slides(st, t, L) {
    // stepped on twos (stop-motion): the heap → stack progress at the stop-motion time
    const k0 = st.id === 'hero' ? kk(tq(t), A.pose1 - .1, A.pose1 + .2) * (st.sandals > 0 ? 1 : 0) + (st.sandals >= 1 ? 1 : 0) : st.sandals;
    const kS = cl(k0);
    const XL = -w / 2, list = [];
    for (let i = 0; i < 6; i++) {
      const hp = HEAP[i], pair = i >> 1, row = i & 1, layer = pair;
      const ki = sst(kk(kS, i * .09, .55 + i * .09));
      const hx = XL + hp[0] * s, hy = hp[1] * s, hz = hp[2] * s;
      const tx = XL + 175 * s, ty = (row ? 132 : 46) * s, tz = layer * SL.pitch * s, ta = row ? Math.PI : 0;
      let da = ta - hp[3]; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const X = mix(hx, tx, ki), Y = mix(hy, ty, ki), Z = mix(hz, tz, ki) + Math.sin(Math.PI * ki) * 70 * s, a = hp[3] + da * ki;
      list.push({ pair, X, Y, Z, a, m: hp[4], flip: hp[5] && ki < .5 ? 1 : 0 });
    }
    list.sort((p, q) => (p.Z - q.Z) * 1.4 - (p.Y - q.Y) * .6 + (p.Z === q.Z ? 0 : 0));
    for (const q of list) slide(q.pair, q.X, q.Y, q.Z, q.a, q.m, L, q.flip);
  }

  // ------------------------------------------------------------------ walls
  function rightWall(st, t, L) {
    const q = [P(w / 2, 0, h), P(w / 2, d, h), P(w / 2, d, 0), P(w / 2, 0, 0)];
    face(q, q[0], [0, 1, 0], [0, 0, -1], .74, L, { ts: TS, tint: [1, .95, .86] });
    ctx.save();
    const gr = ctx.createLinearGradient(...P(w / 2, d / 2, h), ...P(w / 2, d / 2, 0)); gr.addColorStop(0, 'rgba(255,236,200,.10)'); gr.addColorStop(.7, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.22)');
    ctx.fillStyle = gr; poly(q); ctx.fill();
    // printed « this way up » arrows (no text), on the wall's affine
    const O = P(w / 2, 0, h), ex = pv([0, 1, 0]), ey = pv([0, 0, -1]);
    ctx.transform(ex[0], ex[1], ey[0], ey[1], O[0], O[1]);
    if (d > 120 * s && h > 150 * s) {
      const cx = d * .5, cy = h * .36, a = 34 * s;
      ctx.strokeStyle = 'rgba(35,22,41,.5)'; ctx.lineWidth = 6 * s; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.beginPath(); for (const dx of [-a * .55, a * .55]) { ctx.moveTo(cx + dx, cy + a); ctx.lineTo(cx + dx, cy - a * .5); ctx.moveTo(cx + dx - a * .42, cy - a * .1); ctx.lineTo(cx + dx, cy - a * .62); ctx.lineTo(cx + dx + a * .42, cy - a * .1); }
      ctx.moveTo(cx - a * 1.2, cy + a * 1.25); ctx.lineTo(cx + a * 1.2, cy + a * 1.25); ctx.stroke();
    }
    ctx.restore();
    // the tape: torn tab of the burst tape (open flaps), or the tab of the new tape (closed)
    const tw = 50 * s;
    if (st.flaps > .02 && st.tape <= 0 && st.id !== 'loop') tab(d / 2, tw, 64 * s, true, L);
    else if (st.tape > 0) { const head = st.tape * (w + 70 * s); if (head > w) tab(d / 2, tw, Math.min(70 * s, head - w), false, L); }
    // felt mark « LARGEUR » along the top
    if (st.marks && st.marks[1] > 0) feltLine([w / 2, 8 * s, h - 18 * s], [w / 2, d - 8 * s, h - 18 * s], st.marks[1], [0, 0, 1], L);
  }
  /** a tape tab on the right wall, centred at depth Y, down from the top by len; torn = jagged top end */
  function tab(Y, tw, len, torn, L) {
    if (len <= 1) return;
    const a = P(w / 2, Y - tw / 2, h), b = P(w / 2, Y + tw / 2, h), c = P(w / 2, Y + tw / 2, h - len), e = P(w / 2, Y - tw / 2, h - len);
    ctx.save(); ctx.beginPath(); ctx.moveTo(...e); ctx.lineTo(...c);
    if (torn) { const M = 8; for (let i = 0; i <= M; i++) { const yy = Y + tw / 2 - tw * i / M, zz = h - 4 * s - (R(i, 31) * 9 * s); ctx.lineTo(...P(w / 2, yy, zz)); } }
    else { ctx.lineTo(...b); ctx.lineTo(...a); }
    // serrated cut at the free end
    const M2 = 7; for (let i = 0; i <= M2; i++) { const yy = Y - tw / 2 + tw * i / M2; ctx.lineTo(...P(w / 2, yy, h - len - (i % 2 ? 3 : 0) * s)); }
    ctx.closePath();
    ctx.fillStyle = litA([150, 102, 52], a[0], a[1], L, -.3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,.25)'; ctx.lineWidth = 1.2 * s; ctx.stroke(); ctx.restore();
  }
  /** felt-pen dimension line from p0 to p1 (3D) with end ticks (along the face normal-ish direction tk), progress k */
  function feltLine(p0, p1, k, tk, L) {
    const a = PP(p0), b = PP(p1), e = [mix(a[0], b[0], k), mix(a[1], b[1], k)], tv = pv(tk), tl = Math.hypot(tv[0], tv[1]) || 1, tx = tv[0] / tl * 11 * s, ty = tv[1] / tl * 11 * s;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(35,22,41,.86)'; ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(a[0] - tx, a[1] - ty); ctx.lineTo(a[0] + tx, a[1] + ty);
    const M = 10; ctx.moveTo(...a); for (let i = 1; i <= M; i++) { const f = k * i / M; ctx.lineTo(mix(a[0], b[0], f) + (R(i, 3) - .5) * 1.6 * s, mix(a[1], b[1], f) + (R(i, 5) - .5) * 1.6 * s); }
    if (k >= 1) { ctx.moveTo(b[0] - tx, b[1] - ty); ctx.lineTo(b[0] + tx, b[1] + ty); }
    ctx.stroke(); ctx.restore();
    if (k > 0 && k < 1 && typeof marker === 'function') marker(e[0], e[1], -.5, INK);
  }
  /** the front wall's ink (local coords: x right 0..w, y down 0..h, origin top-left) */
  function frontInk(st, t, L) {
    // scuffs of a carton that has travelled
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(70,44,18,.14)'; ctx.lineWidth = 3 * s;
    for (let i = 0; i < 4; i++) { const x = (.12 + .2 * i + .08 * R(i, 9)) * w, y = (.7 + .2 * R(i, 4)) * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (16 + 20 * R(i, 6)) * s, y - 6 * s * R(i, 2)); ctx.stroke(); }
    ctx.restore();
    // « AU m³ »: orange starved ink, hits on « cube »
    if ((st.m3k > 0 || st.m3 > 0) && t < m3Win()[1] + .3) {
      const k = st.m3 > 0 ? 1 : st.m3k, sc = (k < 1 ? 1.7 - .7 * H.eo(k) : 1) * s;
      const al = k < 1 ? .25 + .5 * k : .95;
      ctx.save(); ctx.translate(w / 2, h * .5); ctx.rotate(-.09); ctx.scale(sc, sc); ctx.globalAlpha *= al; ctx.globalCompositeOperation = 'multiply';
      const c = stampM3(); ctx.drawImage(c, -c.width / 4, -c.height / 4, c.width / 2, c.height / 2); ctx.restore();
    }
  }
  let STM = null;
  function stampM3() {
    if (STM) return STM;
    const SS = 2, Wd = 380, Hd = 170, c = makeCanvas(Wd * SS * 2 / 2 * 2, Hd * SS * 2 / 2 * 2), g = c.getContext('2d');
    g.scale(SS, SS); g.translate(Wd, Hd);
    const col = ORANGE, f = '900 112px Stencil';
    g.font = f; g.letterSpacing = '5px'; const tw = g.measureText('AU m').width; g.letterSpacing = '0px';
    const bw = tw + 46 + 70, bh = 142, x0 = -bw / 2, y0 = -bh / 2;
    g.strokeStyle = col; g.lineWidth = 10; rrectOn(g, x0, y0, bw, bh, 14); g.stroke();
    g.fillStyle = col; g.textBaseline = 'middle'; g.letterSpacing = '5px'; g.fillText('AU m', x0 + 34, 6); g.letterSpacing = '0px';
    g.font = '900 54px Satoshi'; g.fillText('3', x0 + 34 + tw + 6, -26);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1400; i++) { g.globalAlpha = .22 + rnd(i * 1.7 + 3) * .6; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .5 + rnd(i * 3.3) * 2.3, 0, 7); g.fill(); }
    g.globalAlpha = .5; for (let i = 0; i < 9; i++) { g.lineWidth = 2 + rnd(i * 5) * 4; g.beginPath(); const y = y0 + rnd(i * 7.7) * bh; g.moveTo(x0, y); g.lineTo(x0 + bw, y + (rnd(i) - .5) * 20); g.stroke(); }
    return (STM = c);
  }
  /** the front wall: shut (lid = 0) or lifted like a cut-paper lid hinged at the top */
  function frontWall(st, t, L) {
    const ph = st.lid * LID_MAX, sn = Math.sin(ph), cs = Math.cos(ph);
    const u = [0, -sn, -cs], nOut = [0, -cs, sn], vis = dot(nOut, VIEW) >= 0, n = vis ? nOut : neg(nOut);
    const O = P(-w / 2, 0, h), ey = pv(u), Q = [O, [O[0] + w, O[1]], [O[0] + w + ey[0] * h, O[1] + ey[1] * h], [O[0] + ey[0] * h, O[1] + ey[1] * h]];
    if (st.lid > .02) {
      // the opening's cut edges (left wall, right wall, floor)
      cutEdge(P(-w / 2, 0, 0), P(-w / 2, 0, h), [th, 0], L, false);
      cutEdge(P(w / 2, 0, 0), P(w / 2, 0, h), [-th, 0], L, false);
      cutEdge(P(-w / 2, 0, 0), P(w / 2, 0, 0), [0, -th], L, true);
      // the lid's free edge, corrugated
      const tv = pv(neg(nOut).map(x => x * th));
      cutEdge(Q[3], Q[2], tv, L, true);
    }
    face(Q, O, [1, 0, 0], u, shadeN(n) * (vis ? 1.02 : .97), L, { ts: TS, tint: vis ? [1, .97, .9] : [1.03, 1.01, .98] });
    ctx.save();
    poly(Q); ctx.clip();
    ctx.transform(1, 0, ey[0], ey[1], O[0], O[1]);
    if (vis) {
      // light from the top, occlusion at the table
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,238,206,.12)'); gr.addColorStop(.75, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.2)');
      if (st.lid <= .02) { ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
      frontInk(st, t, L);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,20,4,.16)'); gr.addColorStop(1, 'rgba(255,240,214,.1)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    if (st.lid <= .02 && st.marks) {
      if (st.marks[0] > 0) feltLine([-w / 2 + 10 * s, 0, 18 * s], [w / 2 - 10 * s, 0, 18 * s], st.marks[0], [0, 0, 1], L);
      if (st.marks[2] > 0) feltLine([w / 2 - 18 * s, 0, 10 * s], [w / 2 - 18 * s, 0, h - 10 * s], st.marks[2], [1, 0, 0], L);
    }
  }

  // ------------------------------------------------------------------ the closed top + the kraft tape
  function closedTop(st, t, L) {
    const tr = st.tremble || 0, bul = tr * tr, a = bul * 7 * DEG + (bul > 0 ? Math.sin(t * 47) * .9 * DEG * bul : 0);
    const fb = flap('back', a, L, st, false), ff = flap('front', a, L, st, false);
    // the seam where the flaps meet
    const zr = h + d / 2 * Math.sin(a), yr = d / 2 * Math.cos(a);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(52,28,8,.5)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, yr, zr)); ctx.lineTo(...P(w / 2, yr, zr)); ctx.stroke();
    if (a > 0) { ctx.strokeStyle = 'rgba(30,14,2,.55)'; ctx.lineWidth = (2 + 6 * bul) * s; ctx.beginPath(); ctx.moveTo(...P(-w / 2, yr + 2, zr)); ctx.lineTo(...P(w / 2, yr + 2, zr)); ctx.stroke(); }
    ctx.restore();
    if (st.tape > 0) tapeTop(st, t, L, a, zr, yr);
  }
  function tapeTop(st, t, L, a, zr, yr) {
    const tw = 50 * s, tot = w + 70 * s, head = st.tape * tot, Xe = -w / 2 + Math.min(head, w) + (head >= w ? 2 * s : 0), X0 = -w / 2 - 2 * s;
    if (Xe <= X0 + 1) return;
    const slope = Math.tan(a), zf = Y => zr - Math.abs(Y - d / 2) * slope;
    const c1 = P(X0, d / 2 - tw / 2, zf(d / 2 - tw / 2)), c2 = P(Xe, d / 2 - tw / 2, zf(d / 2 - tw / 2)), c3 = P(Xe, d / 2 + tw / 2, zf(d / 2 + tw / 2)), c4 = P(X0, d / 2 + tw / 2, zf(d / 2 + tw / 2));
    const m1 = P(X0, d / 2, zr), m2 = P(Xe, d / 2, zr);
    ctx.save();
    poly([c1, c2, m2, c3, c4, m1]); ctx.fillStyle = litA([166, 113, 58], c1[0], c1[1], L, .1); ctx.fill();
    // gloss + fibres of gummed kraft tape
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,228,184,.30)'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(...P(X0, d / 2 - tw * .18, zr)); ctx.lineTo(...P(Xe, d / 2 - tw * .18, zr)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,214,.16)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(...P(X0, d / 2 + tw * .22, zr)); ctx.lineTo(...P(Xe, d / 2 + tw * .22, zr)); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,52,18,.25)'; ctx.lineWidth = 1.4 * s;
    for (let i = 0; i < 14; i++) { const x = X0 + (Xe - X0) * R(i, 21), y = d / 2 + (R(i, 22) - .5) * tw * .9; ctx.beginPath(); ctx.moveTo(...P(x, y, zr)); ctx.lineTo(...P(x + 10 * s, y + 2 * s, zr)); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(70,38,10,.45)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(...c1); ctx.lineTo(...c2); ctx.moveTo(...c4); ctx.lineTo(...c3); ctx.stroke(); ctx.restore();
    // fresh tape: a wet glint just behind the roll while it runs
    if (st.tape > 0 && st.tape < 1 && head < w) { const g0 = Math.max(X0, Xe - 90 * s);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; poly([P(g0, d / 2 - tw / 2, zr), P(Xe, d / 2 - tw / 2, zr), P(Xe, d / 2 + tw / 2, zr), P(g0, d / 2 + tw / 2, zr)]);
      const gg = ctx.createLinearGradient(...P(g0, d / 2, zr), ...P(Xe, d / 2, zr)); gg.addColorStop(0, 'rgba(255,230,190,0)'); gg.addColorStop(1, 'rgba(255,230,190,.55)'); ctx.fillStyle = gg; ctx.fill(); ctx.restore(); }
    // the loop: under the pressure the tape starts to split at the middle
    const tr = st.tremble || 0;
    if (tr > .6) {
      const k = kk(tr, .6, 1), c = P(0, d / 2, zr), gw = (4 + 18 * k * k) * s;
      ctx.save(); ctx.fillStyle = 'rgba(40,18,2,.75)'; ctx.beginPath(); ctx.moveTo(c[0] - gw, c[1]); ctx.lineTo(c[0] - gw * .3, c[1] - 4 * s); ctx.lineTo(c[0] + gw * .4, c[1] + 3 * s); ctx.lineTo(c[0] + gw, c[1]); ctx.lineTo(c[0] + gw * .2, c[1] + 5 * s); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  /** the tape roll (also a table prop): standing on its edge (rolling), centre c (screen), radius r, roll angle ang */
  function rollStanding(c, r, ang, L, tw) {
    const bk = pv([0, tw, 0]);
    ctx.save();
    const side = litA([128, 82, 38], c[0], c[1], L, -.4);
    for (let i = 4; i >= 1; i--) { const f = i / 4; ctx.fillStyle = side; ctx.beginPath(); ctx.arc(c[0] + bk[0] * f, c[1] + bk[1] * f, r, 0, 7); ctx.fill(); }
    // front face: tape layers, cardboard core, the hole
    ctx.fillStyle = litA([176, 122, 64], c[0], c[1], L, .1); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(90,52,18,.35)'; ctx.lineWidth = 1.2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(c[0], c[1], r * (.66 + .07 * i), 0, 7); ctx.stroke(); }
    ctx.fillStyle = litA([214, 184, 140], c[0], c[1], L, .2); ctx.beginPath(); ctx.arc(c[0], c[1], r * .64, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,4,.78)'; ctx.beginPath(); ctx.arc(c[0], c[1], r * .5, 0, 7); ctx.fill();
    ctx.fillStyle = litA([200, 166, 120], c[0], c[1], L, -.2); ctx.beginPath(); ctx.arc(c[0] + bk[0], c[1] + bk[1], r * .5, Math.PI * .1, Math.PI * 1.1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,200,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c[0], c[1], r - 2, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,30,6,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0] + Math.cos(ang) * r * .52, c[1] + Math.sin(ang) * r * .52); ctx.lineTo(c[0] + Math.cos(ang) * r * .64, c[1] + Math.sin(ang) * r * .64); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ the loop: air escaping from the seam
  function wisps(st, t, L) {
    const tr = st.tremble || 0; if (tr < .25) return;
    const k = kk(tr, .25, 1), zr = h + d / 2 * Math.sin(tr * tr * 7 * DEG);
    ctx.save();
    const D = H.dustSprites().light;
    for (let i = 0; i < 6; i++) {
      const ph = ((t * (1.6 + R(i, 41)) + R(i, 42)) % 1), X = (R(i, 43) - .5) * w * .8, p = P(X, d / 2, zr);
      const r = (14 + 30 * ph) * s * (.6 + .6 * k);
      ctx.globalAlpha = (1 - ph) * .9 * k; ctx.drawImage(D[i % 3], p[0] + (R(i, 44) - .5) * 30 * ph * s - r, p[1] - 60 * ph * s - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ the tape roll's life (hero only)
  // rest on the table at ROLL (left of the carton) → hops onto the seam → rolls along it, laying the tape (st.tape) →
  // hops back to its spot, behind the fleeing cloud. Times from A.pose3 only.
  const ROLL = { x: 300, y: 1640, r: 46, tw: 48 };
  function rollState(t) {
    const t0 = A.pose3 - .42, t1 = A.pose3 - .05, t2 = A.pose3 + .3, t3 = A.pose3 + .72;
    if (t < t0 || t >= t3) return null;
    return { t0, t1, t2, t3 };
  }
  function rollOnCarton(st, t, L) {
    const rs = rollState(t); if (!rs) return;
    const r = ROLL.r * s, tw = ROLL.tw * s, tot = w + 70 * s, tqq = tq(t);
    const head = st.tape * tot;
    const onTop = X => { const c = P(X, d / 2 - tw / 2, h); return [c[0], c[1] - r]; };
    const startC = onTop(-w / 2), endRest = [ROLL.x, ROLL.y - r];
    let c, ang;
    if (t < rs.t1) {                                         // hop up onto the carton (stop-motion arc)
      const k = sst(kk(tqq, rs.t0, rs.t1)); c = [mix(endRest[0], startC[0], k), mix(endRest[1], startC[1], k) - Math.sin(Math.PI * k) * 160]; ang = -k * 6;
    } else if (t < rs.t2) {                                  // rolling along the seam, then down the right wall
      if (head <= w) { c = onTop(-w / 2 + head); ang = head / r; }
      else { const q = P(w / 2, d / 2 - tw / 2, h - (head - w)); c = [q[0] + r, q[1]]; ang = (w + (head - w)) / r; }
    } else {                                                 // hops back to its spot, chasing the cloud
      const from = (() => { const q = P(w / 2, d / 2 - tw / 2, h - 70 * s); return [q[0] + r, q[1]]; })(), k = sst(kk(tqq, rs.t2, rs.t3));
      c = [mix(from[0], endRest[0], k), mix(from[1], endRest[1], k) - Math.sin(Math.PI * k) * 120]; ang = (w + 70 * s) / r + k * 8;
    }
    H.softShadow(c[0] + 14, c[1] + r + 10, r * 1.1, r * .4, .22);
    rollStanding(c, r, ang, L, tw);
  }

  // ------------------------------------------------------------------ draw
  function draw(st, pass, t, L) {
    if (!st || (st.a ?? 1) <= .003) return;
    const g = S.cartonGeo(st), j = S.cartonJit(st, t);
    o = { x: st.x, y: st.y }; w = g.w; h = g.h; d = g.d; s = g.s; th = 7 * s; TS = .9 * s;
    ctx.save(); ctx.globalAlpha *= st.a ?? 1;
    ctx.translate(j.x, j.y); if (j.r) { ctx.translate(st.x, st.y); ctx.rotate(j.r); ctx.translate(-st.x, -st.y); }
    if (st.rot) { ctx.translate(g.cx, st.y); ctx.rotate(st.rot); ctx.translate(-g.cx, -st.y); }
    const fa = Math.max(0, st.flaps) * FLAP_MAX, open = st.flaps > .02 || st.lid > .02;
    if (pass === 'back') {
      shadow(st, L);
      if (st.flaps > .02) { flap('back', fa * FL.back, L, st); flap('left', fa * FL.side, L, st); }
      if (open) {
        interior(st, t, L);
        if (st.lid > .02) {
          voidBox(st, t, L);
          if (st.sandalsOn) slides(st, t, L);
          videLabel(st, t, L);
        }
      }
    } else {
      rightWall(st, t, L);
      if (st.flaps > .02) { flap('right', fa * FL.side, L, st); flap('front', fa * FL.front, L, st); }
      else closedTop(st, t, L);
      frontWall(st, t, L);                                  // last: the lifted lid covers the top
      // edges catching the light
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,238,206,.42)'; ctx.lineWidth = 2 * s; ctx.beginPath();
      ctx.moveTo(...P(w / 2, 0, 1)); ctx.lineTo(...P(w / 2, 0, h - 1)); if (st.flaps <= .02 && st.lid <= .02) { ctx.lineTo(...P(-w / 2, 0, h)); ctx.moveTo(...P(w / 2, 0, h)); ctx.lineTo(...P(w / 2, d, h)); }
      ctx.stroke(); ctx.restore();
      if (st.id === 'loop') wisps(st, t, L);
      if (st.id === 'hero') rollOnCarton(st, t, L);
    }
    ctx.restore();
  }
  return { draw, rollState, rollStanding, ROLL, slide, PAIRS, SL };
})();
function CA_carton(st, pass, t, L) { CA_K.draw(st, pass, t, L); }

// =============================================================================================
// THE PACKING TABLE (cream paper + dressing, one cached sprite; the tape roll is live)
// =============================================================================================
const CA_TB = (function () {
  const H = CA_, A = H.A, { cl, kk, R, tq, litA } = H;
  let SPR = null;
  function build() {
    if (SPR) return SPR;
    const c = makeCanvas(W + 120, 1920 + 120), g = c.getContext('2d');
    g.drawImage(TEX.table, 0, 0, W + 120, 1920 + 120);
    const prev = ctx; ctx = g; g.translate(60, 60);
    try {
      const L0 = { x: 300, y: 300, on: 1, violet: 0, day: 1 };
      // a utility cutter (generic), bottom right, on the diagonal
      at(760, 1770, -.32, 1, 1, () => {
        ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.22)'; rrect(-150 + 8, -24 + 12, 300, 48, 18); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#C9CCD1'; ctx.beginPath(); ctx.moveTo(150, -14); ctx.lineTo(214, -14); ctx.lineTo(236, 6); ctx.lineTo(150, 12); ctx.closePath(); ctx.fill();   // blade
        ctx.strokeStyle = 'rgba(80,86,96,.6)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(166 + i * 16, -14); ctx.lineTo(176 + i * 16, 12); ctx.stroke(); }
        ctx.fillStyle = '#34323A'; rrect(-150, -24, 304, 48, 16); ctx.fill();
        ctx.fillStyle = '#4A4852'; rrect(-140, -24, 280, 18, 9); ctx.fill();
        ctx.fillStyle = '#8E9098'; rrect(-30, -30, 56, 14, 6); ctx.fill();                       // slider
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-120 + i * 12, 4); ctx.lineTo(-120 + i * 12, 18); ctx.stroke(); }
      });
      // a pencil, top left (outside the action)
      at(110, 760, 1.18, 1, 1, () => {
        ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.2)'; ctx.fillRect(-120 + 6, -11 + 9, 240, 22); ctx.restore();
        ctx.fillStyle = '#E8B63C'; ctx.fillRect(-120, -11, 200, 22); ctx.fillStyle = '#C99428'; ctx.fillRect(-120, 4, 200, 7);
        ctx.fillStyle = '#EAD2A8'; ctx.beginPath(); ctx.moveTo(80, -11); ctx.lineTo(120, 0); ctx.lineTo(80, 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3A3340'; ctx.beginPath(); ctx.moveTo(108, -3.5); ctx.lineTo(120, 0); ctx.lineTo(108, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#B9B9C0'; ctx.fillRect(-132, -11, 14, 22); ctx.fillStyle = '#D98C8C'; ctx.fillRect(-150, -10, 18, 20);
      });
      // kraft offcuts and a curl of tape (right edge, low and high)
      const scrap = (x, y, r, pts, col) => at(x, y, r, 1, 1, () => {
        ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.translate(5, 8); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = H.pat(); ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,240,214,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      scrap(1010, 660, .4, [[-40, -30], [46, -22], [30, 34], [-34, 26]], '#C79E6C');
      scrap(1040, 1520, -.2, [[-36, -18], [40, -30], [22, 30]], '#B58C5A');
      scrap(60, 1780, .3, [[-44, -22], [40, -26], [48, 20], [-30, 30]], '#C9A06C');
      scrap(980, 1880, .1, [[-50, -20], [50, -24], [44, 22], [-46, 18]], '#D2AB78');
    } finally { ctx = prev; }
    return (SPR = c);
  }
  /** the roll lying flat on the table (axis up), seen in the oblique: two ellipses + the side */
  function rollFlat(x, y, r, tw, L) {
    const at2 = (z, fn) => { ctx.save(); ctx.translate(0, -z); ctx.transform(1, 0, H.OB.x, H.OB.y, x, y); fn(); ctx.restore(); };
    H.softShadow(x + 16, y + 8, r * 1.35, r * .62, .28);
    const side = litA([128, 82, 38], x, y, L, -.4), top = litA([178, 124, 66], x, y, L, .2);
    for (let i = 0; i <= 4; i++) at2(tw * i / 4, () => { ctx.fillStyle = i < 4 ? side : top; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); });
    at2(tw, () => {
      ctx.strokeStyle = 'rgba(90,52,18,.35)'; ctx.lineWidth = 1.2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (.66 + .07 * i), 0, 7); ctx.stroke(); }
      ctx.fillStyle = litA([214, 184, 140], x, y, L, .2); ctx.beginPath(); ctx.arc(0, 0, r * .64, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(70,40,12,.55)'; ctx.beginPath(); ctx.arc(0, 0, r * .5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,236,200,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - 2, Math.PI * .9, Math.PI * 1.6); ctx.stroke();
    });
    // the loose end of the tape on the table
    ctx.save(); ctx.fillStyle = litA([166, 113, 58], x, y, L); ctx.translate(x + r * .7, y + r * .1); ctx.rotate(.5);
    ctx.beginPath(); ctx.moveTo(0, -tw * .28); ctx.lineTo(48, -tw * .3); for (let i = 0; i <= 5; i++) ctx.lineTo(48 + (i % 2) * 4, -tw * .3 + tw * .6 * i / 5); ctx.lineTo(0, tw * .28); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function draw(t, L, n) {
    ctx.drawImage(build(), -60, -60);
    const R0 = CA_K.ROLL;
    if (!CA_K.rollState(t)) rollFlat(R0.x, R0.y, R0.r, 30, L);
  }
  return { draw };
})();
function CA_table(t, L, n) { CA_TB.draw(t, L, n); }
