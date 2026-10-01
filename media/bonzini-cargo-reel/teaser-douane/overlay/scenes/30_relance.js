'use strict';
// =============================================================================================================
// SECTION b · master 6.0–10.0 s · bars M4–M5 + silence
//   P7  6.0–8.0  RELANCE  : 2.5D pull-back ×8 in 12 frames, then 40 % slow motion. The receipt is a ribbon of
//                           dozens of metres: column → arch → hanging accordion → fan-fold stacks on a kraft box,
//                           6 pre-rendered fold planes in parallax (DOF blur), dust in the single top light.
//                           Tag « MARGE » half covered at 7.5 (« MAR… »), gone at 7.875. Pinned white proverb.
//   P8  8.0–9.5  MONTÉE   : hard cut to the slot close-up, paper jets out as streaks, slot shakes on 16ths,
//                           « Et si / vous saviez / AVANT ? », the film's ONLY RGB split (f277–279) + stutter (f280–281).
//   P9  9.5–10.0 SILENCE  : freeze, a 4 px violet line traced left → right at the slot in 8 frames (« the cut »).
// Everything is written in MASTER time m = MT(t); the short cut (6.0–7.5 → master 8.0–9.5 …) follows automatically.
// Hand-off to section c at 10.0: frozen close-up, slot at y 880, violet cut line y 868–872 across x 0–1080.
// Brand: no top-left pill (as in section a): the nameplate printerPlate() rides on the printer — ×1/8 in the pull-back,
// ×1.5 on the body under the streaks in P8/P9 (its violet backlight swells with the roll).
// Perf note: offscreen canvases use the CPU raster path, and no canvas `filter` is applied to many small draws
// (a filtered draw re-blurs the whole layer: ~140 dither rects under blur cost minutes on the GPU path).
// =============================================================================================================
(() => {
  // ---------------------------------------------------------------------------------------------- tiny maths
  const sst = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const n3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const l3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const CPU = { willReadFrequently: true };
  function cpuCanvas(w, h) { const c = makeCanvas(w, h); return [c, c.getContext('2d', CPU)]; }
  function swap(g, fn) { const s = ctx; ctx = g; try { fn(); } finally { ctx = s; } }
  /** soft elliptic shadow (radial gradient, no filter) */
  function softEllipse(cx, cy, rx, ry, a, col = '0,0,0') {
    if (a <= 0) return; ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.55, `rgba(${col},${a * .55})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------- timing
  const PULL0 = 6.0 - 1 / 30, PULL1 = PULL0 + 0.4;           // 12 frames: f180 (u = 1/12) … f191 (u = 1)
  const WHIP = bezier(.52, 0, .16, 1);                        // accelerates for ~3 frames, decelerates into the slow-mo
  const tau = m => m < PULL1 ? m : PULL1 + (m - PULL1) * 0.4; // world clock: 40 % slow motion after the whip
  const T_TXT = [6.5, 7.0, 7.5];
  const CUTE = bezier(.4, 0, .2, 1);                          // the cut: a deliberate stroke
  const T_LAND = [6.625, 7.25];                               // fan-fold pairs landing (7.25 = half-time kick, step 11)
  const T_FLAP = [7.5, 7.875];                                // the fold thud (« MAR… ») · the tag is gone

  // ---------------------------------------------------------------------------------------------- camera (P7)
  // Stage coords = the final screen at d = 8. The printer slot (world ×1 point 540,880) sits at stage SLOT.
  const SLOT = [225, 1118], C0 = [540, 960];
  function camAt(m) {
    if (m < PULL1) {
      const u = clamp((m - PULL0) / (PULL1 - PULL0)), e = WHIP(u);
      const d = Math.exp(Math.log(8) * e), s = 8 / d;
      const P = [lerp(540, SLOT[0], e), lerp(880, SLOT[1], e)];        // the slot's screen position
      return { d, s, cam: [SLOT[0] - (P[0] - C0[0]) / s, SLOT[1] - (P[1] - C0[1]) / s] };
    }
    const k = (m - PULL1) / (8.0 - PULL1);                               // slow recede ×8 → ×8.45, slight truck right
    const d = 8 * (1 + 0.056 * k);
    return { d, s: 8 / d, cam: [540 + 12 * k, 960 - 4 * k] };
  }
  /** affine for a plane at depth dz whose content is authored in final screen coords: screen = o + S·k */
  function planeT(cs, dz) {
    const den = cs.d + dz; if (den <= 0.2) return null;
    const k = (8 + dz) / den, q = 8 / den;
    return { k, ox: 540 - 540 * k + (540 - cs.cam[0]) * q, oy: 960 - 960 * k + (960 - cs.cam[1]) * q };
  }

  // ---------------------------------------------------------------------------------------------- 2.5D ribbon renderer
  const DZ = [-0.12, -0.25];                    // depth z (stage px) is drawn at (x + DZ0·z, y + DZ1·z): camera slightly above-left
  const VIEW = n3([0.12, 0.25, 1]);             // projection direction
  const LIGHT = n3([0.2, -1, -0.36]);           // towards the single top light
  const pj = p => [p[0] + DZ[0] * p[2], p[1] + DZ[1] * p[2]];
  const PAPER = [247, 244, 236], SHD = [15, 15, 20];
  function paperRGB(L) {
    if (L <= 1) return [lerp(SHD[0], PAPER[0], L), lerp(SHD[1], PAPER[1], L), lerp(SHD[2], PAPER[2], L)];
    const k = clamp((L - 1) / .5) * .55; return [lerp(PAPER[0], 255, k), lerp(PAPER[1], 253, k), lerp(PAPER[2], 248, k)];
  }
  /** the single top light: a soft cone (stage coords), axis (690,-320) → (660,1290) */
  function beamI(x, y) {
    const k = clamp((y + 320) / 1610), ax = lerp(690, 660, k), hw = lerp(210, 620, k);
    return (1 - sst(hw * .25, hw, Math.abs(x - ax))) * lerp(.85, 1, k);
  }
  /** quads of a ribbon (centreline P, unit width directions Bv, width w) → Q.  o: {gain, amb, fill, bias, ticks, flow, seed, occ, I} */
  function ribbon(Q, P, Bv, w, o = {}) {
    let s = o.s0 || 0; const hw = w / 2;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i], p1 = P[i + 1], b0 = Bv[i], b1 = Bv[i + 1];
      const dv = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], len = Math.hypot(dv[0], dv[1], dv[2]); if (len < 1e-4) continue;
      const T = [dv[0] / len, dv[1] / len, dv[2] / len], bm = n3(add(b0, b1));
      const N = n3(crs(T, bm)), front = dot(N, VIEW) < 0, Nv = front ? N : [-N[0], -N[1], -N[2]];
      const mid = l3(p0, p1, .5), ms = pj(mid);
      const I = o.I ?? beamI(ms[0], ms[1]), df = dot(Nv, LIGHT);
      let L = (o.amb ?? .1) + I * (df > 0 ? df * 1.1 : -df * .26) + (o.fill ?? .2) * Math.max(0, -dot(Nv, VIEW));
      L *= (o.gain ?? 1) * (o.occ ? o.occ(mid) : 1);
      const q = [pj(add(p0, b0, -hw)), pj(add(p1, b1, -hw)), pj(add(p1, b1, hw)), pj(add(p0, b0, hw))];
      Q.push({ q, k: dot(mid, VIEW) + (o.bias || 0), c: paperRGB(L), L, front, s0: s, s1: s + len, p0, p1, b0, b1, hw, o, fs: Math.abs(dot(N, VIEW)) });
      s += len;
    }
    return s;
  }
  function drawQuads(Q, lw) {
    Q.sort((a, b) => b.k - a.k);
    for (const e of Q) {
      const c = `rgb(${e.c[0] | 0},${e.c[1] | 0},${e.c[2] | 0})`; ctx.globalAlpha = e.o.alpha ?? 1;
      ctx.beginPath(); ctx.moveTo(e.q[0][0], e.q[0][1]); ctx.lineTo(e.q[1][0], e.q[1][1]); ctx.lineTo(e.q[2][0], e.q[2][1]); ctx.lineTo(e.q[3][0], e.q[3][1]); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke();
      if (e.o.ticks && e.front) ticks(e);
    }
    ctx.globalAlpha = 1;
  }
  /** printed rows on the printed side: short ink bars (and the odd orange « ??? ») every `pitch` of arc length, flowing */
  function ticks(e) {
    const o = e.o, pitch = o.pitch || 16.5, off = o.flow || 0, a = clamp(e.fs * 1.5) * clamp(e.L * 1.2) * (o.tickA ?? .5);
    if (a < .03) return;
    for (let r = Math.ceil((e.s0 + off) / pitch); r * pitch - off < e.s1; r++) {
      const s = r * pitch - off, k = (s - e.s0) / (e.s1 - e.s0), p = l3(e.p0, e.p1, k), b = n3(l3(e.b0, e.b1, k));
      const h = hash(r * 3.17 + (o.seed || 0)), kind = h < .14 ? 2 : h < .22 ? 0 : 1;
      if (kind === 0) continue;
      const x0 = -.76, x1 = Math.min(.8, x0 + .3 + hash(r * 7.3 + 1.1) * 1.1);
      const A = pj(add(p, b, x0 * e.hw)), B = pj(add(p, b, x1 * e.hw));
      ctx.strokeStyle = `rgba(30,28,34,${a})`; ctx.lineWidth = o.tickW || 2.3; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      if (kind === 2) { const C = pj(add(p, b, .5 * e.hw)), D = pj(add(p, b, .78 * e.hw));
        ctx.strokeStyle = `rgba(254,86,13,${Math.min(1, a * 1.3)})`; ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.stroke(); }
    }
  }
  /** strand from control points [x,y,z?] (Catmull-Rom) with twist φ(u): 0 = width in the picture plane, π/2 = along depth */
  function strand(ctrl, phi, seg = 8) {
    const P2 = curve(ctrl.map(p => [p[0], p[1]]), seg), P = [], Bv = [], n = P2.length;
    for (let j = 0; j < n; j++) {
      const i = Math.min(ctrl.length - 2, Math.floor(j / seg)), f = (j - i * seg) / seg;
      P.push([P2[j][0], P2[j][1], lerp(ctrl[i][2] || 0, ctrl[i + 1][2] || 0, f * f * (3 - 2 * f))]);
    }
    for (let j = 0; j < n; j++) {
      const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const ph = typeof phi === 'function' ? phi(j / (n - 1)) : phi;
      Bv.push(n3([Math.cos(ph) * -ty, Math.cos(ph) * tx, Math.sin(ph)]));
    }
    return { P, Bv };
  }
  /** hanging accordion: from `top`, nf folds of height h, folding about B (default −x), zig-zag depth ±za, x drifting to x1 */
  function accordion(top, nf, h, za, x1, o = {}) {
    const ctrl = [top];
    for (let f = 1; f <= nf; f++) {
      const k = f / nf, sw = (o.sway || 0) * Math.sin(f * 1.7 + (o.ph || 0));
      ctrl.push([lerp(top[0], x1, k) + sw, top[1] + f * h * (1 + (hash(f * 9.1 + (o.seed || 0)) - .5) * .25), (top[2] || 0) + (f % 2 ? za : -za)]);
    }
    if (o.end) ctrl.push(o.end);
    const SEG = 6, P2 = curve(ctrl.map(p => [p[0], p[1]]), SEG), P = [], Bv = [];
    for (let j = 0; j < P2.length; j++) { const i = Math.min(ctrl.length - 2, Math.floor(j / SEG)), f = (j - i * SEG) / SEG;
      P.push([P2[j][0], P2[j][1], lerp(ctrl[i][2] || 0, ctrl[i + 1][2] || 0, .5 - .5 * Math.cos(f * Math.PI))]); Bv.push(o.B || [-1, 0, 0]); }
    return { P, Bv };
  }

  // ---------------------------------------------------------------------------------------------- the receipt texture (world ×1)
  const TW = 840, TH = 3600, YS = 2700;    // texture x 0..840 ↔ world x 120..960; texture y YS ↔ the slot line at 6.0
  let R = null;
  // Section a's receipt at its hand-off (6.0 s, paper at rest), y = screen y of each item's top (slot at 880).
  // Mirrors 20_printer.js item by item so that f180 continues f179 exactly; items further down are the paper still to come.
  const A_ITEMS = [
    ['text', -1366.2, 120, [['Douane' + NNBSP + ':', 'i']]], ['text', -1234.2, 120, [['combien' + NNBSP + '?', 'i']]],
    ['text', -1102.2, 120, [['On verra…', 'm']]], ['text', -970.2, 120, [['à l’arrivée.', 'm']]],
    ['due', -838.2, 0], ['due', -772.2, 1], ['due', -706.2, 2], ['due', -640.2, 3],
    ['text', -574.2, 120, [['Ça,', 'i']]], ['text', -442.2, 120, [['c’est dû.', 'i']]], ['duerule', -325.2],
    ['text', -310.2, 112, [['Code' + NNBSP, 'i'], ['?', 'o']]], ['row', -178.2, 50.48, 11], ['row', -127.8, 50.48, 12], ['row', -77.3, 50.48, 13],
    ['text', -26.8, 112, [['Valeur' + NNBSP, 'i'], ['?', 'o']]], ['row', 105.2, 58.73, 31], ['row', 163.9, 58.73, 32, 1], ['row', 222.7, 58.73, 33], ['row', 281.4, 58.73, 34],
    ['text', 340.1, 112, [['Papiers' + NNBSP, 'i'], ['?', 'o']]], ['doc', 472.1, 143.87], ['text', 616, 112, [['Jours' + NNBSP, 'i'], ['?', 'o']]], ['frieze', 748],
  ];
  const A_COL = { i: COL.ink, m: COL.mute, o: COL.orange };
  const RH = 64;
  function aRow(y, h, seed, sd) {            // « grey bar ……… ??? » / « SANS DÉTAIL ……… ??? » (as section a draws them)
    ctx.save(); ctx.translate(0, y + h / 2 - RH / 2);
    if (sd) textureRow('SANS DÉTAIL', 160, 46, { qx: 700 });
    else {
      const w1 = 120 + hash(seed * 3.1) * 150, w2 = hash(seed * 7.3) > .45 ? 50 + hash(seed * 5.7) * 90 : 0;
      ctx.fillStyle = 'rgba(110,110,120,.55)'; rrect(160, 21, w1, 20, 7); ctx.fill();
      if (w2) { rrect(160 + w1 + 14, 21, w2, 20, 7); ctx.fill(); }
      const x0 = 160 + w1 + (w2 ? w2 + 14 : 0) + 18; ctx.fillStyle = 'rgba(110,110,120,.6)';
      for (let x = x0; x < 700 - 16; x += 14) ctx.fillRect(x, 40, 5, 5);
      qMarks(700, 46, { size: 44, w: 700, color: COL.orange, ls: .02 });
    }
    ctx.restore();
  }
  const DUE_WORDS = [['Droit', 'de', 'douane'], ['Accises'], ['TVA', 'et', 'centimes'], ['Autres', 'taxes']], AMT_G = [[64, 76], [40, 76], [56, 76], [76]];
  function aDue(i, y) {                      // dot + illegible ink label + dithered amount (never digits)
    const cy = y + 36; ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(172, cy, 12, 0, 7); ctx.fill();
    let x = 204; ctx.fillStyle = 'rgba(13,13,18,.84)';
    for (const w of DUE_WORDS[i]) { const ww = satW(w, 50, 700); rrect(x, cy - 11, ww, 22, 7); ctx.fill(); x += ww + 13; }
    let ax = 900; for (const gw of AMT_G[i].slice().reverse()) { ax -= gw; ditherAmount(ax, cy - 16, gw, 32); ax -= 16; }
  }
  function aDoc(y, h) {                      // the missing paper: an empty dashed document
    const w = 100, hh = Math.min(124, h - 14), x = 160, top = y + (h - hh) / 2, d = 26;
    ctx.save(); ctx.strokeStyle = 'rgba(13,13,18,.62)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w - d, top); ctx.lineTo(x + w, top + d); ctx.lineTo(x + w, top + hh); ctx.lineTo(x, top + hh); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + w - d, top); ctx.lineTo(x + w - d, top + d); ctx.lineTo(x + w, top + d); ctx.stroke();
    ctx.restore();
  }
  function aFrieze(y) {                      // 5 amber · marker « franchise » · 3 orange, the track runs off the paper
    const by = y + 60, bh = 52, FB = 56, FP = 66, FMK = 496, boxX = k => k < 5 ? 160 + k * FP : 510 + (k - 5) * FP;
    ctx.fillStyle = COL.gold; ctx.fillRect(160, y + 121, FMK - 160, 3); ctx.fillStyle = COL.orange; ctx.fillRect(FMK, y + 121, 960 - FMK, 3);
    for (let k = 0; k < 8; k++) { ctx.fillStyle = k < 5 ? COL.gold : COL.orange; rrect(boxX(k), by, FB, bh, 9); ctx.fill(); }
    ctx.fillStyle = COL.ink; ctx.fillRect(FMK - 1.5, y + 6, 3, 118);
    sat('franchise', 510, y + 46, { size: 44, w: 500, color: COL.mute });
  }
  function aText(y, size, parts) {
    let x = 160; const base = y + (size >= 120 ? 104 : 102);
    for (const [str, c] of parts) { sat(str, x, base, { size, w: 900, color: A_COL[c] }); x += satW(str, size, 900); }
  }
  function buildReceipt() {
    const [c, g] = cpuCanvas(TW, TH);
    const [dc, dg] = cpuCanvas(256, 256), id = dg.createImageData(256, 256);   // the core's thermal dither, on this context
    for (let i = 0; i < id.data.length; i += 4) { const v = hash(i * .071) < .5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 10; }
    dg.putImageData(id, 0, 0);
    swap(g, () => {
      ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, TW, TH);
      ctx.fillStyle = g.createPattern(dc, 'repeat'); ctx.fillRect(0, 0, TW, TH);
      const eg = ctx.createLinearGradient(0, 0, TW, 0); eg.addColorStop(0, 'rgba(0,0,0,.06)'); eg.addColorStop(.12, 'rgba(0,0,0,0)'); eg.addColorStop(.88, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.08)');
      ctx.fillStyle = eg; ctx.fillRect(0, 0, TW, TH);
      ctx.translate(-120, YS - 880);                                           // world x, screen y at 6.0
      for (const it of A_ITEMS) {
        const [k, y] = it;
        if (k === 'text') aText(y, it[2], it[3]); else if (k === 'due') aDue(it[2], y); else if (k === 'row') aRow(y, it[2], it[3], it[4]);
        else if (k === 'doc') aDoc(y, it[2]); else if (k === 'frieze') aFrieze(y);
        else if (k === 'duerule') { ctx.fillStyle = COL.violet; ctx.fillRect(160, y, satW('c’est dû.', 120, 900) + 8, 4); }
      }
      for (let i = 0; i < 16; i++) aRow(880 + 8 + i * 60, 60, 60 + i, false);   // still printing: more unknowns
    });
    return c;
  }
  // streak texture for the close-up (×1.5): one period of receipt rows, smeared vertically into trails
  const SW = 1260, SP = 1980;
  function buildStreaks() {
    const [rows, g] = cpuCanvas(SW, SP);
    swap(g, () => {
      ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, SW, SP);
      ctx.scale(1.5, 1.5); ctx.translate(-120, 0);
      for (let i = 0; i < 10; i++) {
        const y = i * 132, h = hash(i * 5.3 + 2);
        for (const yy of [y, y - 1320, y + 1320]) {
          if (i % 3 === 0) { ctx.fillStyle = 'rgba(13,13,18,.5)'; rrect(160, yy + 40, 160 + h * 300, 44, 10); ctx.fill(); }
          else if (i % 3 === 1) { ctx.fillStyle = 'rgba(13,13,18,.34)'; rrect(160, yy + 50, 120 + h * 220, 22, 6); ctx.fill(); qMarks(800, yy + 80, { size: 48, w: 900, color: COL.orange }); }
          else { for (let k = 0; k < 6; k++) { ctx.fillStyle = k < 3 ? COL.gold : COL.orange; rrect(160 + k * 64, yy + 34, 46, 46, 7); ctx.fill(); } }
          ctx.globalAlpha = .7; ditherAmount(640 + h * 60, yy + 44, 140, 30); ctx.globalAlpha = 1;
        }
      }
    });
    const [sc, s] = cpuCanvas(SW, SP), N = 56, L = 520;
    for (let k = 0; k < N; k++) { const off = k / (N - 1) * L; s.globalAlpha = 1 / (k + 1); s.drawImage(rows, 0, off); s.drawImage(rows, 0, off - SP); }
    s.globalAlpha = 1;
    for (let i = 0; i < 420; i++) {                                  // fibres and speed sheen: thin vertical lines, the motion signature
      const x = hash(i * 1.7) * SW, w = .8 + hash(i * 2.9) * 2.4, a = .03 + hash(i * 4.1) * .07;
      s.fillStyle = hash(i * 3.3) > .45 ? `rgba(255,255,255,${a * 2.2})` : `rgba(50,46,44,${a})`; s.fillRect(x, 0, w, SP);
    }
    return sc;
  }

  // ---------------------------------------------------------------------------------------------- pre-rendered planes
  const PM = 300, PS = .5;    // plane canvases: margin 300 px, half resolution (they are blurred anyway)
  function planeCanvas(build, blur) {
    const w = (W + 2 * PM) * PS, h = (H + 2 * PM) * PS;
    const [raw, g] = cpuCanvas(w, h);
    swap(g, () => { ctx.scale(PS, PS); ctx.translate(PM, PM); build(); });
    if (!blur) return raw;
    const [c, b] = cpuCanvas(w, h); b.filter = `blur(${blur * PS}px)`; b.drawImage(raw, 0, 0); b.filter = 'none';
    return c;
  }
  function drawPlane(c, tr, a = 1, comp) {
    if (!tr || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; if (comp) ctx.globalCompositeOperation = comp;
    const k = tr.k / PS; ctx.setTransform(k, 0, 0, k, tr.ox - PM * tr.k, tr.oy - PM * tr.k);
    ctx.drawImage(c, 0, 0); ctx.restore();
  }
  function renderStrands(list) { const Q = []; for (const it of list) ribbon(Q, it.s.P, it.s.Bv, it.w, it.o); drawQuads(Q, 1.2); }
  const FAR = { amb: .02, fill: .05 };
  function buildPlanes() {
    const P = {};
    // F3 — far (dz 16): ribbons hanging from the dark in long festoons, catching the light where they twist
    P.F3 = planeCanvas(() => renderStrands([
      { s: strand([[180, -140, 0], [360, 260, 30], [620, 470, 50], [880, 330, 30], [1080, 60, 0], [1280, -120, 0]], u => .35 + u * 7.5, 14), w: 60, o: { ...FAR, gain: .7 } },
      { s: strand([[560, -200, 0], [600, 180, 20], [540, 560, 0], [610, 920, 20], [570, 1290, 0]], u => u * 12, 14), w: 54, o: { ...FAR, gain: .6 } },
      { s: strand([[1010, -200, 0], [960, 240, 0], [1020, 640, 10], [970, 1040, 0], [1000, 1290, 0]], u => .8 + u * 10, 14), w: 54, o: { ...FAR, gain: .55 } },
    ]), 10);
    // F2 — dz 7: a narrow accordion falling at the right onto a loose loop on the floor, a ribbon far left in the shade
    P.F2 = planeCanvas(() => renderStrands([
      { s: accordion([905, -80, 0], 24, 54, 14, 930, { seed: 9, sway: 5, end: [940, 1255, 20] }), w: 58, o: { ...FAR, gain: .75 } },
      { s: strand([[840, 1262, 0], [920, 1238, 30], [1010, 1262, 60], [1110, 1240, 40], [1250, 1262, 0]], u => 1.25 + u * 2, 10), w: 70, o: { ...FAR, gain: .7 } },
      { s: strand([[-60, -60, 0], [60, 300, 0], [20, 700, 0], [90, 1060, 0], [40, 1280, 0]], u => u * 10, 12), w: 64, o: { ...FAR, gain: .6 } },
    ]), 5);
    // F1 — dz 2.4: a twisting ribbon dropping from the top right behind the box, piling at its foot
    P.F1 = planeCanvas(() => renderStrands([
      { s: strand([[1120, 360, 0], [960, 520, 0], [930, 740, 10], [985, 930, 30], [930, 1120, 40], [990, 1236, 40], [1120, 1250, 30]], u => .2 + u * 6.4, 14), w: 84, o: { ...FAR, gain: .75, fill: .07 } },
    ]), 2.5);
    // N1 — near (dz −2.6): out-of-focus twisted ribbon across the bottom-left corner (silhouette + rim)
    P.N1 = planeCanvas(() => renderStrands([
      { s: strand([[-200, 1420, 0], [80, 1560, 0], [260, 1760, 0], [380, 2060, 0]], u => .3 + u * 2.2, 10), w: 230, o: { amb: .02, fill: .02, gain: .55, I: .55 } },
    ]), 26);
    // N2 — nearest (dz −4.2): a ribbon edge passing at the right
    P.N2 = planeCanvas(() => renderStrands([
      { s: strand([[1260, 1240, 0], [1130, 1450, 0], [1090, 1700, 0], [1160, 2000, 0], [1130, 2260, 0]], u => .6 + u * 2.4, 10), w: 220, o: { amb: .02, fill: .02, gain: .45, I: .5 } },
    ]), 34);
    // the light: volumetric cone (subtle) + floor pool
    P.beam = planeCanvas(() => {
      const g = ctx.createLinearGradient(0, -320, 0, 1290); g.addColorStop(0, 'rgba(255,250,238,.13)'); g.addColorStop(.6, 'rgba(255,248,232,.05)'); g.addColorStop(1, 'rgba(255,246,228,.035)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(690 - 110, -320); ctx.lineTo(690 + 110, -320); ctx.lineTo(660 + 470, 1290); ctx.lineTo(660 - 470, 1290); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,240,.045)'; ctx.beginPath(); ctx.moveTo(690 - 45, -320); ctx.lineTo(690 + 45, -320); ctx.lineTo(660 + 230, 1290); ctx.lineTo(660 - 230, 1290); ctx.closePath(); ctx.fill();
    }, 60);
    P.floor = planeCanvas(() => {
      softEllipse(660, 1252, 600, 110, .13, '255,246,228'); softEllipse(690, 1250, 330, 46, .10, '255,246,228');
    }, 0);
    return P;
  }

  // ---------------------------------------------------------------------------------------------- the kraft box + tag
  const BX0 = 520, BX1 = 900, BYT = 1015, BYB = 1240, BZ = 140;    // front face x 520–900, y 1015–1240; depth 140
  const TAG = { x0: 538, x1: 782, y0: 1040, y1: 1110 };              // widened from 200 px: « MARGE » is 225 px at 64 px
  let TAGC = null;
  function buildTag() {
    const w = TAG.x1 - TAG.x0, h = TAG.y1 - TAG.y0, S = 3, [c, g] = cpuCanvas(w * S, h * S);
    swap(g, () => {
      ctx.scale(S, S);
      ctx.fillStyle = '#E3C597'; rrect(0, 0, w, h, 5); ctx.fill();
      for (let i = 0; i < 420; i++) { const x = hash(i * 1.3) * w, y = hash(i * 2.7) * h, a = hash(i * 3.1) * Math.PI, l = 2 + hash(i * 4.7) * 7;
        ctx.strokeStyle = hash(i * 5.9) > .5 ? 'rgba(140,100,58,.28)' : 'rgba(255,240,214,.35)'; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(120,84,44,.35)'; ctx.lineWidth = 1.2; rrect(.6, .6, w - 1.2, h - 1.2, 5); ctx.stroke();
      // « MARGE » in felt marker: Satoshi 900 64 px, slightly bled, starved strokes
      const tw = satW('MARGE', 64, 900), x = (w - tw) / 2, base = h / 2 + 24;
      ctx.globalAlpha = .35; sat('MARGE', x + .8, base + .6, { size: 64, w: 900, color: '#1B1612' }); ctx.globalAlpha = 1;
      sat('MARGE', x, base, { size: 64, w: 900, color: '#1B1612' });
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { const px = x + hash(i * 1.9) * tw, py = base - 50 + hash(i * 2.3) * 54, r = .3 + hash(i * 3.7) * 1.1;
        ctx.fillStyle = `rgba(0,0,0,${.12 + hash(i * 6.1) * .35})`; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }
      for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, base - 52 + i * 6.3 + hash(i) * 2, tw, .9); }   // marker strokes
      ctx.globalCompositeOperation = 'source-over';
    });
    return c;
  }
  function drawBox(lw, by) {
    const dz = [DZ[0] * BZ, DZ[1] * BZ];
    softEllipse(BX0 + 150, BYB + 4, 300, 22, .85);                           // floor contact shadow (light from the upper right)
    softEllipse(BX0 + 190, BYB + 1, 230, 7, .9);
    // left side face
    ctx.fillStyle = TEX.kraft; ctx.beginPath(); ctx.moveTo(BX0, BYT + by); ctx.lineTo(BX0, BYB); ctx.lineTo(BX0 + dz[0], BYB + dz[1]); ctx.lineTo(BX0 + dz[0], BYT + dz[1] + by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(13,10,8,.66)'; ctx.fill();
    // front face
    ctx.fillStyle = TEX.kraft; ctx.fillRect(BX0, BYT + by, BX1 - BX0, BYB - BYT - by);
    let g = ctx.createLinearGradient(0, BYT, 0, BYB); g.addColorStop(0, 'rgba(255,236,205,.05)'); g.addColorStop(.35, 'rgba(13,10,8,.2)'); g.addColorStop(1, 'rgba(13,10,8,.66)');
    ctx.fillStyle = g; ctx.fillRect(BX0, BYT + by, BX1 - BX0, BYB - BYT - by);
    g = ctx.createLinearGradient(BX0, 0, BX1, 0); g.addColorStop(0, 'rgba(13,10,8,.28)'); g.addColorStop(.55, 'rgba(13,10,8,0)'); g.addColorStop(1, 'rgba(13,10,8,.16)');
    ctx.fillStyle = g; ctx.fillRect(BX0, BYT + by, BX1 - BX0, BYB - BYT - by);
    // top face (faces the light)
    ctx.fillStyle = TEX.kraft; ctx.beginPath(); ctx.moveTo(BX0, BYT + by); ctx.lineTo(BX1, BYT + by); ctx.lineTo(BX1 + dz[0], BYT + dz[1] + by); ctx.lineTo(BX0 + dz[0], BYT + dz[1] + by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,206,.14)'; ctx.fill();
    // edges: lit top-front edge, dark vertical corner
    ctx.strokeStyle = 'rgba(255,232,196,.55)'; ctx.lineWidth = 1.4 * lw; ctx.beginPath(); ctx.moveTo(BX0, BYT + by); ctx.lineTo(BX1, BYT + by); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,26,12,.55)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(BX0, BYT + by); ctx.lineTo(BX0, BYB); ctx.stroke();
    // the tag, stuck on the front face
    ctx.save(); ctx.translate((TAG.x0 + TAG.x1) / 2, (TAG.y0 + TAG.y1) / 2 + by * .6); ctx.rotate(-.018);
    const w = TAG.x1 - TAG.x0, h = TAG.y1 - TAG.y0;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; rrect(-w / 2 - 1, -h / 2 + 2, w + 2, h + 1, 6); ctx.fill();
    ctx.drawImage(TAGC, -w / 2, -h / 2, w, h);
    g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(13,10,8,.04)'); g.addColorStop(1, 'rgba(13,10,8,.26)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------- fan-fold stacks + flaps
  // Panels lie flat on the box top, width along x (B = −x), running alternately away from / towards the camera (z),
  // joined by rounded creases. The main stack receives the hanging accordion; two older stacks sit beside it.
  const STACKS = [
    { x: 700, n: 12, z0: -8, z1: 126, seed: 1, ox: 0 },
    { x: 812, n: 7, z0: 2, z1: 134, seed: 2, ox: 0 },
    { x: 590, n: 5, z0: -4, z1: 122, seed: 3, ox: 0 },
  ];
  for (const st of STACKS) {
    st.p = []; let y = BYT - 2;
    for (let k = 0; k < st.n; k++) { const gap = 6.2 + hash(st.seed * 31 + k * 3.3) * 3.4;
      const j = st.seed === 1 ? .35 : 1; st.p.push({ y: y - gap * .5, x: st.x + (hash(st.seed * 17 + k * 7.7) - .5) * 18 * j, bulge: 4 + hash(st.seed * 13 + k * 5.1) * 7, yaw: (hash(st.seed * 7 + k * 2.2) - .5) * .12 * j });
      y -= gap; }
  }
  const MAIN0 = 8;                                     // main-stack panels already there at 6.0 (+2 at each landing)
  function heapState(m) {
    let n = MAIN0, fallY = 0, squash = 0;
    T_LAND.forEach(tl => {
      const t0 = tl - .42;
      if (m >= tl) { n += 2; const s = m - tl; if (s < 1) squash = Math.max(squash, Math.exp(-s * 7) * Math.sin(s * 24) * .6); }
      else if (m >= t0) { n += 2; const p = (m - t0) / .42; fallY = -54 * (1 - p * p); }
    });
    return { n, fallY, squash };
  }
  function stackStrand(st, n, hs) {
    const P = [], Bv = [], B = [-1, 0, 0], base = BYT - 2;
    const Y = k => { const pk = st.p[k], top = hs && k >= n - 2;
      let y = base - (base - pk.y) * (top && hs.fallY < 0 ? 1.5 : 1) + (top ? (hs ? hs.fallY : 0) : 0);
      if (hs && k >= n - 4) y += hs.squash * (k - (n - 4)) * 1.5; return y; };
    for (let k = 0; k < n; k++) {
      const pk = st.p[k], y = Y(k), away = k % 2 === 0, za = away ? st.z0 : st.z1, zb = away ? st.z1 : st.z0;
      for (let i = 0; i <= 10; i++) {
        const f = i / 10, z = lerp(za, zb, f), bulge = pk.bulge * Math.sin(f * Math.PI) * (hs && k >= n - 2 && hs.fallY < 0 ? 1.8 : 1);
        P.push([pk.x + Math.sin(pk.yaw) * (z - 60), y - bulge, z]); Bv.push(B);
      }
      if (k < n - 1) {                                                      // crease: half loop up to the next panel
        const y2 = Y(k + 1), x0 = P[P.length - 1][0], nx = st.p[k + 1], x1 = nx.x + Math.sin(nx.yaw) * (zb - 60), out = away ? 1 : -1, r = Math.max(4.5, (y - y2) * .55 + 1.5);
        for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; P.push([lerp(x0, x1, i / 8), lerp(y, y2, .5 - .5 * Math.cos(a)), zb + out * Math.sin(a) * r]); Bv.push(B); }
      }
    }
    return { P, Bv };
  }
  /** a flap slumping over the front edge: path in hanging coords [dx, d (down from the hinge), dz]; p 0 (sticking out) → 1 (hanging) */
  function flapStrand(xc, p, bounce, path, root) {
    const th = -Math.PI / 2 * Math.cos(clamp(p) * Math.PI / 2) - bounce, c = Math.cos(th), s = Math.sin(th);
    const hinge = [xc, BYT + 2, -3];
    const ctrl = root.map(q => [xc + q[0], q[1], q[2]]).concat([hinge], path.map(([dx, d, dz]) => [xc + dx, hinge[1] + d * c, hinge[2] + d * s + dz]));
    const SEG = 6, P2 = curve(ctrl.map(q => [q[0], q[1]]), SEG), P = [], Bv = [];
    for (let j = 0; j < P2.length; j++) { const i = Math.min(ctrl.length - 2, Math.floor(j / SEG)), f = (j - i * SEG) / SEG; P.push([P2[j][0], P2[j][1], lerp(ctrl[i][2], ctrl[i + 1][2], f)]); Bv.push([-1, 0, 0]); }
    return { P, Bv };
  }
  function flapP(m, tl) {      // slump: starts .27 s before the thud, lands on it, small rebound off the box
    const p = clamp((m - (tl - .27)) / .27), s = m - tl;
    return { p, bounce: s > 0 ? Math.exp(-s * 9) * Math.abs(Math.sin(s * 20)) * .2 : 0, on: m >= tl - .27 };
  }
  const FLAP1 = { x: 740.5, w: 108, root: [[-10, 958, 52], [-4, 992, 20]], path: [[0, 30, -2], [0, 70, -4], [0, 112, -6], [1, 140, -6], [2, 152, -14]] };
  const FLAP2 = { x: 591, w: 110, root: [[30, 962, 60], [14, 995, 22]],
    path: [[-2, 40, -4], [-4, 90, -6], [-2, 128, -8], [14, 150, -9], [40, 154, -6], [60, 136, -3], [64, 90, -1], [62, 40, 0], [58, 12, 4]] };
  function flapShadow(xc, w, len, hang, skew = 0) {
    if (hang <= 0) return;
    for (const [dx, dy, a] of [[-3, 3, .2], [-7, 8, .14], [-12, 14, .08]]) {
      ctx.fillStyle = `rgba(20,12,4,${a * hang})`; ctx.beginPath();
      ctx.moveTo(xc - w / 2 + dx, BYT + 2); ctx.lineTo(xc + w / 2 + dx * .3, BYT + 2); ctx.lineTo(xc + w / 2 + skew + dx * .3, BYT + len * hang + dy); ctx.lineTo(xc - w / 2 + skew + dx, BYT + len * hang + dy); ctx.closePath(); ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------------------------- dust in the beam
  const DUST = [];
  for (let i = 0; i < 320; i++) {
    const dz = i < 22 ? -3.4 + hash(i * 1.1) * 2.4 : -0.6 + hash(i * 1.3) * 11;
    DUST.push({ x: hash(i * 2.1) * 1300 - 110, y: hash(i * 3.7) * 1500 - 120, dz, r: .7 + hash(i * 4.9) * 1.7, v: 6 + hash(i * 6.1) * 14, ph: hash(i * 8.3) * 6.28 });
  }
  function drawDust(cs, m, a) {
    const tw = tau(m);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const p of DUST) {
      const tr = planeT(cs, p.dz); if (!tr) continue;
      let y = p.y + p.v * tw * .9; y = ((y + 120) % 1500 + 1500) % 1500 - 120;
      const x = p.x + Math.sin(tw * .8 + p.ph) * 9, I = beamI(x, y); if (I < .05 && p.dz > -1) continue;
      const X = tr.ox + x * tr.k, Y = tr.oy + y * tr.k; if (X < -90 || X > W + 90 || Y < -90 || Y > H + 90) continue;
      const blur = Math.min(60, Math.abs(p.dz) * 1.5 * tr.k), r = Math.max(.8, p.r * Math.min(tr.k, 6)) + blur;
      const al = a * (p.dz < -1 ? .12 : .6) * Math.max(I, p.dz < -1 ? .3 : 0) / (1 + blur * .22);
      if (al < .004) continue;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(255,248,232,${al})`); g.addColorStop(blur > 2 ? .6 : .35, `rgba(255,248,232,${al * .5})`); g.addColorStop(1, 'rgba(255,248,232,0)');
      ctx.fillStyle = g; ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  /** a puff of paper dust where something lands (stage coords, inside the focal transform) */
  function puff(m, tl, x, y, w, seed) {
    const s = m - tl; if (s < 0 || s > 1.4) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 36; i++) {
      const h1 = hash(seed + i * 1.7), h2 = hash(seed + i * 2.9), h3 = hash(seed + i * 4.3), tt = s * .55;   // slow motion
      const X = x + (h1 - .5) * w + (h1 - .5) * 90 * tt, Y = y + (-18 - h2 * 46) * tt + 26 * tt * tt, r = .8 + h3 * 1.8;
      const al = (1 - s / 1.4) * (.35 + h3 * .45) * Math.max(.35, beamI(X, Y));
      ctx.fillStyle = `rgba(255,248,236,${al})`; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------- P7 · the pull-back
  const ARCH_END = [604, 792, 0];
  let ARCH = null;
  function arch() {
    return ARCH || (ARCH = strand([[225, 886, 0], [225, 860, 0], [229, 812, 0], [246, 772, 6], [284, 744, 14], [340, 730, 18], [410, 728, 18], [480, 738, 12], [540, 754, 6], [584, 772, 2], ARCH_END],
      u => 1.2 * Math.sin(clamp(u * 1.18) * Math.PI) ** .8, 10));
  }
  /** the nameplate's violet backlight (section a settles it at .22): a breath on the half-time kicks (6.0, 7.25),
   *  then it swells with the roll of P8 towards « AVANT ? » (frozen with the image at P9) */
  const plateGlowB = m => .22 + .12 * [6.0, 7.25].reduce((e, k) => m >= k ? Math.max(e, Math.exp(-(m - k) * 8)) : e, 0) + .38 * sst(8.0, 9.5, m);
  /** the LED row as section a leaves it (due steps white, every other step orange, a full orange ring on step 13);
   *  half time: steps 1 and 11 flash on the kicks (6.0, 7.25) */
  function ledsP7(m) {
    ctx.save();
    for (let k = 0; k < 16; k++) {
      const x = 220 + k * 34, col = k % 4 === 0 ? '#F4F4F6' : COL.orange, kt = k === 0 ? 6.0 : k === 10 ? 7.25 : -9, fl = m >= kt ? Math.max(0, 1 - (m - kt) / .125) : 0;
      ctx.globalAlpha = .8 + .2 * fl; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10 + 16 * fl; ctx.beginPath(); ctx.arc(x, 950, 11, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = COL.orange; ctx.lineWidth = 3.5; ctx.shadowColor = COL.orange; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(220 + 12 * 34, 950, 17, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function drawP7(m, cs) {
    const s = cs.s, lw = 1 / s, mix = sst(6.0, 6.33, m), tw = tau(m);
    const flowW = 520 * Math.max(0, tw - 6.0), flowS = flowW / 8;           // paper printed since 6.0 (world px / stage px)
    ctx.fillStyle = COL.dark; ctx.fillRect(0, 0, W, H);
    if (mix < 1) { const g = ctx.createRadialGradient(540, 470, 0, 540, 470, 980); g.addColorStop(0, `rgba(255,246,228,${.055 * (1 - mix)})`); g.addColorStop(1, 'rgba(255,246,228,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    drawPlane(R.P.F3, planeT(cs, 16), mix);
    drawPlane(R.P.F2, planeT(cs, 7), mix);
    drawPlane(R.P.beam, planeT(cs, .4), mix, 'screen');
    drawPlane(R.P.F1, planeT(cs, 2.4), mix);
    // ---- focal plane (stage coords)
    ctx.save(); ctx.setTransform(s, 0, 0, s, 540 - cs.cam[0] * s, 960 - cs.cam[1] * s);
    ctx.save(); ctx.globalAlpha = mix; ctx.drawImage(R.P.floor, -PM, -PM, W + 2 * PM, H + 2 * PM); ctx.restore();
    softEllipse(SLOT[0] - 10, 1257, 110, 12, .9 * mix);                        // printer contact shadow
    // the column: the receipt we were reading, seen from far
    const yTop = 880, hS = SLOT[1] - yTop, sh = hS * 8, sy = YS + flowW - sh;
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(R.tex, 0, sy, TW, sh, SLOT[0] - 52.5, yTop, 105, hS);
    const cg = ctx.createLinearGradient(0, yTop, 0, SLOT[1]);
    cg.addColorStop(0, `rgba(13,13,18,${mix * .4})`); cg.addColorStop(.55, `rgba(13,13,18,${mix * .5})`); cg.addColorStop(1, `rgba(13,13,18,${mix * .64})`);
    ctx.fillStyle = cg; ctx.fillRect(SLOT[0] - 52.5, yTop, 105, hS);
    const eg = ctx.createLinearGradient(SLOT[0] - 52.5, 0, SLOT[0] + 52.5, 0); eg.addColorStop(0, `rgba(13,13,18,${mix * .25})`); eg.addColorStop(.5, 'rgba(13,13,18,0)'); eg.addColorStop(1, `rgba(255,250,240,${mix * .07})`);
    ctx.fillStyle = eg; ctx.fillRect(SLOT[0] - 52.5, yTop, 105, hS);
    ctx.restore();
    // the printer (world ×1 geometry at ×1/8), finished exactly as section a leaves it
    ctx.save(); ctx.translate(SLOT[0], SLOT[1]); ctx.scale(1 / 8, 1 / 8); ctx.translate(-540, -880);
    { let g = ctx.createLinearGradient(0, -80, 0, 620); g.addColorStop(0, 'rgba(13,13,18,.16)'); g.addColorStop(1, 'rgba(13,13,18,0)');
      ctx.fillStyle = g; ctx.fillRect(120, -80, 840, 700);
      g = ctx.createLinearGradient(0, 846, 0, 880); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.2)'); ctx.fillStyle = g; ctx.fillRect(120, 846, 840, 34); }
    printerDark(880, new Array(16).fill(0));
    ctx.fillStyle = 'rgba(247,244,236,.16)'; ctx.fillRect(120, 876, 840, 5);                       // the paper inside the slot
    ctx.save(); ctx.translate(540, 894); ctx.scale(1, .2);
    let lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 520); lg.addColorStop(0, 'rgba(247,244,236,.07)'); lg.addColorStop(1, 'rgba(247,244,236,0)'); ctx.fillStyle = lg; ctx.fillRect(-520, 0, 1040, 520); ctx.restore();
    printerPlate(880, { glow: plateGlowB(m) });                             // the nameplate rides on the printer (×1/8 with it)
    ledsP7(m);
    ctx.globalAlpha = mix; ctx.strokeStyle = 'rgba(255,248,236,.24)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(80, 886); ctx.lineTo(1000, 886); ctx.stroke();   // rim light
    ctx.restore();
    if (s < 3.4) {                                                          // the rest of the world enters the frame from here
      const hs = heapState(m), fl = [flapP(m, T_FLAP[0]), flapP(m, T_FLAP[1])];
      let by = 0; T_FLAP.forEach(tl => { if (m >= tl && m < tl + .5) by += Math.exp(-(m - tl) * 12) * 2.2; });
      drawBox(lw, by + hs.squash * 1.2);
      for (const st of STACKS) softEllipse(st.x - 6, BYT - 16, 92, 20, .45, '30,18,8');      // contact shadows on the box top
      flapShadow(FLAP1.x, FLAP1.w, 150, fl[0].on ? Math.sin(fl[0].p * Math.PI / 2) : 0, 2);
      flapShadow(FLAP2.x + 30, FLAP2.w + 60, 150, fl[1].on ? Math.sin(fl[1].p * Math.PI / 2) : 0, 4);
      // ribbon: arch → hanging accordion → stacks → flaps (one depth-sorted pass)
      const Q = [], ar = arch();
      ribbon(Q, ar.P, ar.Bv, 105, { ticks: true, flow: flowS, seed: 1, fill: .28, amb: .12 });
      const main = stackStrand(STACKS[0], hs.n, hs), att = main.P[main.P.length - 1];
      const sw = Math.sin(tw * 2.2) * 5;
      const acc = accordion(ARCH_END, 2, (att[1] - 22 - ARCH_END[1]) / 2, 34, att[0] - 14 + sw, { seed: 2, sway: 9, ph: tw * 1.2, end: [att[0], att[1] - 3, att[2] - 6] });
      ribbon(Q, acc.P, acc.Bv, 105, { ticks: true, flow: flowS, seed: 2, fill: .24 });
      const occ = st => p => .5 + .5 * clamp((BYT - p[1]) / (st.n * 7.5));
      ribbon(Q, main.P, main.Bv, 108, { fill: .2, amb: .08, occ: occ({ n: hs.n }) });
      for (const st of STACKS.slice(1)) { const sS = stackStrand(st, st.n, null); ribbon(Q, sS.P, sS.Bv, 108, { fill: .2, amb: .08, occ: occ(st) }); }
      const fOcc = p => 1 - .42 * clamp((p[1] - BYT) / 150);
      if (fl[0].on) { const f = flapStrand(FLAP1.x, fl[0].p, fl[0].bounce, FLAP1.path, FLAP1.root); ribbon(Q, f.P, f.Bv, FLAP1.w, { ticks: true, seed: 5, fill: .5, amb: .14, bias: -40, occ: fOcc }); }
      if (fl[1].on) { const f = flapStrand(FLAP2.x, fl[1].p, fl[1].bounce, FLAP2.path, FLAP2.root); ribbon(Q, f.P, f.Bv, FLAP2.w, { ticks: true, seed: 9, fill: .5, amb: .14, bias: -44, occ: fOcc }); }
      drawQuads(Q, lw * .9);
      T_LAND.forEach((tl, j) => puff(m, tl, STACKS[0].x, BYT - 64 - j * 15, 150, 11 + j * 7));
      T_FLAP.forEach((tl, j) => puff(m, tl, j ? 630 : 750, BYT + 4, 150, 31 + j * 5));
    }
    ctx.restore();
    drawDust(cs, m, mix);
    drawPlane(R.P.N1, planeT(cs, -2.6), mix);
    drawPlane(R.P.N2, planeT(cs, -4.2), mix);
    const vg = ctx.createRadialGradient(600, 960, 360, 600, 960, 1260); vg.addColorStop(0, 'rgba(13,13,18,0)'); vg.addColorStop(1, `rgba(13,13,18,${.6 * mix})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  /** pinned white proverb (screen space) */
  function proverb(m) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 6;
    popText(m, T_TXT[0], 'Ce qu’on', 120, 452, { size: 120, w: 900, color: '#FFFFFF' });
    popText(m, T_TXT[1], 'ne sait pas…', 120, 572, { size: 120, w: 900, color: '#FFFFFF' });
    if (m >= T_TXT[2]) {
      const sc = popS(m, T_TXT[2], satW('ça se paie.', 120, 900) > 600 ? 1.06 : 1.15), a = 'ça se ', b = 'paie', wa = satW(a, 120, 900), wb = satW(b, 120, 900);
      ctx.translate(120, 692); ctx.scale(sc, sc);
      sat(a, 0, 0, { size: 120, w: 900, color: '#FFFFFF' }); sat(b, wa, 0, { size: 120, w: 900, color: COL.orange }); sat('.', wa + wb, 0, { size: 120, w: 900, color: '#FFFFFF' });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------- P8 · the slot close-up
  const CU = 1.5;                     // close-up scale about the slot (540, 880)
  function shake16(m) {               // 6 px jolt on every 16th, decaying within the 16th
    const q = Math.floor((m - 8.0) / .125 + 1e-6), s = m - (8.0 + q * .125), a = 6 * Math.exp(-s * 34) * Math.cos(s * 70);
    const ang = hash(q * 7.13 + 3) * Math.PI * 2;
    return [a * Math.cos(ang), a * Math.sin(ang) * .7];
  }
  function ledsP8(m) {                // the roll: a chase that fills the row with orange by 9.375
    const L = new Array(16).fill(0), q = Math.floor((m - 8.0) / .125 + 1e-6), lit = clamp(Math.floor((m - 8.0) / 1.375 * 16), 0, 16);
    for (let k = 0; k < lit; k++) L[k] = 2; L[((q % 16) + 16) % 16] = 1; return L;
  }
  function printerLEDs(leds) {       // the 16 step LEDs + status LED, as printerDark draws them (redrawn over the gloss)
    ctx.save(); ctx.fillStyle = COL.violet; ctx.shadowColor = COL.violet; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(160, 950, 11, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    for (let k = 0; k < 16; k++) { const st = leds[k] || 0, x = 220 + k * 34; ctx.beginPath(); ctx.arc(x, 950, 11, 0, 7);
      if (st === 0) { ctx.fillStyle = '#26262E'; ctx.fill(); }
      else { ctx.fillStyle = st === 1 ? '#F4F4F6' : st === 2 ? COL.orange : COL.violet; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0; } }
    ctx.restore();
  }
  function drawP8(m, frozen) {
    const pin = 1 + .055 * sst(8.0, 9.5, m), sk = frozen ? [0, 0] : shake16(m), sc = CU * pin;
    ctx.fillStyle = COL.dark; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(540 + sk[0], 880 + sk[1]); ctx.scale(sc, sc); ctx.translate(-540, -880);
    // the paper, x 120–960 (world), jetting out of the slot at 2 400 px/s → vertical trails
    const off = ((2400 * (m - 8.0) / sc) % (SP / CU) + SP / CU) % (SP / CU), ph = SP / CU;
    ctx.save(); ctx.beginPath(); ctx.rect(120, -500, 840, 1385); ctx.clip();
    for (let y = 880 - ph + off; y > -600 - ph; y -= ph) ctx.drawImage(R.streak, 120, y, TW, ph);
    let g = ctx.createLinearGradient(0, 600, 0, 880); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(.72, 'rgba(13,13,18,.10)'); g.addColorStop(1, 'rgba(13,13,18,.5)');
    ctx.fillStyle = g; ctx.fillRect(120, 600, 840, 290);
    g = ctx.createLinearGradient(120, 0, 960, 0); g.addColorStop(0, 'rgba(13,13,18,.2)'); g.addColorStop(.18, 'rgba(13,13,18,0)'); g.addColorStop(.82, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.22)');
    ctx.fillStyle = g; ctx.fillRect(120, -500, 840, 1390);
    ctx.restore();
    printerDark(880, ledsP8(frozen ? 9.49 : m));
    // the glossy lid catches the paper's light just under the slot; a hard specular on the slot lip
    g = ctx.createLinearGradient(0, 898, 0, 1010); g.addColorStop(0, 'rgba(247,244,236,.16)'); g.addColorStop(1, 'rgba(247,244,236,0)');
    ctx.fillStyle = g; ctx.fillRect(60, 898, 960, 112);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(110, 897, 860, 1.6);
    // a faint mirror of the paper in the black gloss of the lid (fades out in 150 px)
    ctx.save(); ctx.beginPath(); ctx.rect(70, 900, 940, 150); ctx.clip(); ctx.globalAlpha = .07;
    ctx.translate(0, 1800); ctx.scale(1, -1);
    for (let y = 880 - ph + off; y > 880 - 2 * ph; y -= ph) ctx.drawImage(R.streak, 120, y, TW, ph);
    ctx.restore();
    g = ctx.createLinearGradient(0, 900, 0, 1050); g.addColorStop(0, 'rgba(22,22,28,0)'); g.addColorStop(1, 'rgba(22,22,28,1)');
    ctx.fillStyle = g; ctx.fillRect(70, 900, 940, 150);
    printerPlate(880, { mirror: false, glow: plateGlowB(frozen ? 9.5 - 1 / 30 : m) });   // own mirror above
    printerLEDs(ledsP8(frozen ? 9.49 : m));
    ctx.restore();
    const vg = ctx.createRadialGradient(540, 820, 380, 540, 820, 1250); vg.addColorStop(0, 'rgba(13,13,18,0)'); vg.addColorStop(1, 'rgba(13,13,18,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // sharp ink captions over the cream blur
    popText(m, 8.0, 'Et si', 120, 492, { size: 120, w: 900, color: COL.ink });
    popText(m, 8.5, 'vous saviez', 120, 612, { size: 120, w: 900, color: COL.ink });
    popText(m, 9.0, 'AVANT' + NNBSP + '?', 120, 766, { size: 150, w: 900, color: COL.violet });
  }
  // RGB split (the film's only glitch): the frame's channels re-added with offsets, edges clamped
  let CH = null;
  function rgbSplit(src, sx, sy) {
    if (!CH) CH = cpuCanvas(W, H); const [cc, g] = CH;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const [col, dx, dy] of [['#FF0000', sx, sy], ['#00FF00', 0, 0], ['#0000FF', -sx, -sy]]) {
      g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(cc, dx, dy);
      if (dx > 0) ctx.drawImage(cc, 0, 0, 1, H, 0, dy, dx, H); if (dx < 0) ctx.drawImage(cc, W - 1, 0, 1, H, W + dx, dy, -dx, H);
      if (dy > 0) ctx.drawImage(cc, 0, 0, W, 1, dx, 0, W, dy); if (dy < 0) ctx.drawImage(cc, 0, H - 1, W, 1, dx, H + dy, W, -dy);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------- frame assembly
  let BUF = null;
  function init() { if (R) return; R = { tex: buildReceipt(), streak: buildStreaks(), P: buildPlanes() }; TAGC = buildTag(); BUF = cpuCanvas(W, H); }
  function intoBuf(fn) { const g = BUF[1]; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; swap(g, fn); return BUF[0]; }
  /** zoom motion blur of the whip (180° shutter): the frame re-drawn along the camera's own motion */
  function whipBlur(src, m, cs) {
    const sh = .5 / 30, cj = camAt(m - sh), a = cj.s / cs.s, bx = 540 + (cs.cam[0] - cj.cam[0]) * cj.s - 540 * a, by = 960 + (cs.cam[1] - cj.cam[1]) * cj.s - 960 * a;
    const disp = Math.max(Math.abs(bx), Math.abs(bx + (a - 1) * W), Math.abs(by), Math.abs(by + (a - 1) * H));
    const NL = clamp(Math.ceil(disp / 5), 1, 28);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(src, 0, 0);
    for (let j = 1; j < NL; j++) {
      const c2 = camAt(m - sh * j / (NL - 1)), a2 = c2.s / cs.s;
      ctx.globalAlpha = 1 / (j + 1);
      ctx.setTransform(a2, 0, 0, a2, 540 + (cs.cam[0] - c2.cam[0]) * c2.s - 540 * a2, 960 + (cs.cam[1] - c2.cam[1]) * c2.s - 960 * a2);
      ctx.drawImage(src, 0, 0);
    }
    ctx.restore();
  }

  registerScene({
    id: 'b_relance', z: 30,
    when: t => { const m = MT(t); return m >= 6.0 && m < 10.0; },
    draw(t, n) {
      init();
      const m = MT(t), mf = Math.round(m * 30);
      // ---------------- P7 · 6.0–8.0
      if (m < 8.0) {
        const cs = camAt(m);
        if (m < PULL1 + .02) whipBlur(intoBuf(() => drawP7(m, cs)), m, cs); else drawP7(m, cs);
        proverb(m); filmGrain(n, .02);
        return;
      }
      // ---------------- P8 · 8.0–9.5 (RGB split f277–279, stutter f280–281: the image hiccups back)
      if (m < 9.5) {
        const mc = mf === 280 ? 278 / 30 : mf === 281 ? 279 / 30 : m;
        if (mf >= 277 && mf <= 279) {
          const sp = { 277: [-8, 0], 278: [8, 2], 279: [-6, -1] }[mf];
          rgbSplit(intoBuf(() => drawP8(mc, false)), sp[0], sp[1]);
        } else drawP8(mc, false);
        filmGrain(n, .02);
        return;
      }
      // ---------------- P9 · 9.5–10.0: freeze (blur, grain and all) + the violet cut traced in 8 frames
      drawP8(9.5 - 1 / 30, true);
      const p = CUTE(clamp((m - 9.5 + 1 / 30) / (8 / 30)));                         // f285 … f292
      if (p > 0) { ctx.fillStyle = COL.violet; ctx.fillRect(0, 868, W * p, 4); }
      filmGrain(n - (mf - 285), .02);
    },
  });
})();
