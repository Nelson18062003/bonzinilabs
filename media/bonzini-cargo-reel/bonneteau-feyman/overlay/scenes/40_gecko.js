'use strict';
// =============================================================================================
// K — THE MARGOUILLAT of « Le Bonneteau du Feyman »: Agama agama, male in breeding colours (fire-orange head,
// cobalt / blue-violet body, banded tail), seen from above, lying on the left edge of the wax cloth.
// Functions only (no registerScene). Reads SCORE (01_score.js) and the light API (02_light.js).
//
//   K_gecko(f, L, target)    draws the lizard at SCORE.G.gecko (world px — call it inside the camera transform),
//                            its own soft shadow included. f = frame (float ok, periodic over 480), L = SCORE.light(f),
//                            target = {x, y} world px: the head turns to it in jerky lizard saccades (clamped ±70° from
//                            the body axis), the pupils do the fine tracking (side-eye when the head is clamped).
//   K_geckoPose(f, target)   the pose alone (debug / sync): {fr, yaw, look, lid, wide, brow, push, bob, zHead, zChest, zAll, ...}
//
// Acting (all periodic over 480 frames):
//   f4–24    THOK on the glass: a startled hop, head up, eyes wide.         f210–228  the steal: head snaps to the sleeve, eyes wide.
//   f236–298 suspicious squint at the sleeve (brows down).                  f300–330  push-ups facing the sleeve: front legs extend,
//   f330–362 smug half-lids.                                                          3 head bobs peaking at f305, f315, f325.
//   idle: a blink every ~3.2 s (f52, 150, 250, 352, 440), tail-tip flicks (f96, 186, 270, 334, 404, 455), breathing (1.6 s),
//   slow tail sway.
// Look: ink #1A1426 with a heavier line on the side away from the bulb, gouache body (flank darkening, form shadow away
// from the light, dorsal sheen, warm rim on the edge facing the bulb, scale texture), every colour through lit() sampled
// where the part sits (bias +1 on the back: it faces the bulb). Shadows use castShadow()'s maths drawn with shadowBlur
// (ctx.filter costs ~25 ms a call here), a little denser than castShadow so the push-ups read on the dark cloth.
// Geometry: body units are px on the table plane; the table plane goes to the screen with a depth foreshortening of
// SQ = .77 (same pitch as the props); lifts (z) are screen px up, like the rest of the film. Cost ≈ 1.5 ms a call.
// =============================================================================================
const K_ = (function () {
  const S = window.SCORE, G = S.G, TAU = Math.PI * 2, D2R = Math.PI / 180;
  const fm = f => ((f % 480) + 480) % 480;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const sst = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const since = (fr, t0) => fm(fr - t0);                          // frames elapsed since t0 (periodic)

  const SQ = .77;                       // table plane → screen (depth foreshortening)
  const SC = 1.1;                       // body units → px
  const TH = -56 * D2R, CTH = Math.cos(TH), STH = Math.sin(TH);   // body heading on the table (screen ≈ −49°, up-right)
  const LEN = 190, DS = 2, NS = LEN / DS + 1, S_ANCHOR = 70, I_ANCHOR = S_ANCHOR / DS;   // anchor = mid-trunk
  const INK = '#1A1426';
  const COL = {
    snout: '#FFC23A', head: '#FF8526', jowl: '#FF5520', neck: '#E85030',
    body: '#5282FF', bodyHi: '#B2C8FF', leg: '#5A7CF6', toe: '#3A50C0', fleck: '#CCDAFF',
    pale: '#EEF3FF', band: '#FF7A2A', ring: '#24185A', tip: '#1D1636',
    eye: '#F8EDCF', iris: '#D88A24', pupil: '#120A1C', hi: '#FFF1D8', rim: '#FFC07A',
  };

  // ---------- half-width profile (units), Catmull-Rom through keys ----------
  const WK = [[0, 0], [1.2, 3.4], [5, 6.8], [11, 9.4], [18, 11.4], [25, 12.9], [30, 12.6], [35, 10.0], [41, 8.8], [49, 10.8],
    [59, 13.4], [70, 14.4], [82, 13.6], [92, 11.4], [100, 8.8], [110, 6.8], [130, 4.9], [152, 3.4], [172, 2.0], [190, .6]];
  function wAt(s) {
    let i = 0; while (i < WK.length - 2 && WK[i + 1][0] < s) i++;
    const p0 = WK[Math.max(0, i - 1)], p1 = WK[i], p2 = WK[i + 1], p3 = WK[Math.min(WK.length - 1, i + 2)];
    const h = p2[0] - p1[0], t = cl((s - p1[0]) / h);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * h;
    const t2 = t * t, t3 = t2 * t;
    return Math.max(0, (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2);
  }
  let W0 = null, TEXC = null, PAT = null, FLECKS = null;
  const A = { u: new Float64Array(NS), v: new Float64Array(NS), ph: new Float64Array(NS), z: new Float64Array(NS), w: new Float64Array(NS),
    lx: new Float64Array(NS), ly: new Float64Array(NS), rx: new Float64Array(NS), ry: new Float64Array(NS), cx: new Float64Array(NS), cy: new Float64Array(NS) };

  // ---------- gouache + scale texture (one 128² tile, neutral grey 128 = no change under 'overlay') ----------
  function hp(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function pn(x, y, P, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = q => ((q % P) + P) % P;
    const a = hp(m(xi), m(yi), s), b = hp(m(xi + 1), m(yi), s), c = hp(m(xi), m(yi + 1), s), d = hp(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function build() {
    if (W0) return;
    W0 = new Float64Array(NS); for (let i = 0; i < NS; i++) W0[i] = wAt(i * DS);
    const N = 128; TEXC = makeCanvas(N, N); const g = TEXC.getContext('2d'), id = g.createImageData(N, N), d = id.data;
    const RH = 128 / 40, CW = 128 / 34;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const row = Math.floor(y / RH), off = (row & 1) ? CW / 2 : 0;
      const sx = ((x + off) % CW) / CW - .5, sy = (y % RH) / RH - .5;
      const e = Math.max(Math.abs(sx) * 1.05, Math.abs(sy));
      const scale = -26 * sst(.3, .5, e) + 12 * (.45 - Math.hypot(sx, sy)) + (hp(row, Math.floor((x + off) / CW), 9) - .5) * 10;
      const blot = (pn(x / 16, y / 16, 8, 3) - .5) * 34 + (pn(x / 8, y / 8, 16, 5) - .5) * 16;
      const n = 128 + scale + blot + (hp(x, y, 11) - .5) * 10, i = (y * N + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = cl(n, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    PAT = ctx.createPattern(TEXC, 'repeat');
    FLECKS = []; for (let i = 0; i < 14; i++) FLECKS.push({ s: 50 + rnd(i * 3.1 + 7) * 48, l: (rnd(i * 5.7 + 2) - .5) * 1.3, r: .55 + rnd(i * 2.3 + 1) * .6 });
  }

  // ---------- acting ----------
  const BLINKS = [52, 150, 250, 352, 440], FLICKS = [96, 186, 270, 334, 404, 455];
  function blinkK(fr) {
    let c = 0;
    for (const t0 of BLINKS) { const d = since(fr, t0); if (d < 7) c = Math.max(c, d < 2 ? d / 2 : d < 3.5 ? 1 : 1 - (d - 3.5) / 3.5); }
    return c;
  }
  const bump = (d, len) => d < len ? Math.sin(Math.PI * d / len) : 0;
  function pose(f, tg) {
    const fr = fm(f), P = { fr };
    // aim from the neck pivot (rest position), in the table plane
    const nx = G.gecko.x + CTH * 36 * SC, ny = G.gecko.y + STH * 36 * SC * SQ;
    const t = (tg && isFinite(tg.x) && isFinite(tg.y)) ? tg : { x: G.slotX[1], y: G.tableY - 90 };
    let raw = Math.atan2((t.y - ny) / SQ, t.x - nx) - TH; raw = Math.atan2(Math.sin(raw), Math.cos(raw));
    const lim = 70 * D2R, cr = cl(raw, -lim, lim);
    const STEP = 11 * D2R, q = cr / STEP, n = Math.floor(q);
    P.yaw = STEP * (n + sst(.36, .64, q - n));                     // lizard saccades: hold, snap, hold
    P.look = cl(raw - P.yaw, -1.5, 1.5);                           // the eyes do the rest
    // startle on the THOK (f4) and at the steal (f210)
    const d4 = since(fr, 4), d210 = since(fr, 210);
    const wideA = d4 < 24 ? cl(d4 / 1.5) * (1 - sst(10, 24, d4)) : 0, wideB = d210 < 18 ? cl(d210 / 1.5) * (1 - sst(8, 18, d210)) : 0;
    P.wide = Math.max(wideA, wideB);
    P.zAll = 7 * bump(d4, 8);
    // push-ups: stance 299–333, bobs peaking at 305, 315, 325
    P.push = sst(298.5, 302.5, fr) * (1 - sst(327, 333, fr));
    P.bob = fr >= 300 && fr < 330 ? Math.pow(Math.sin(Math.PI * (((fr - 300) / 10) % 1)), .75) : 0;
    P.zChest = P.push * (7 + 9 * P.bob);
    P.zHead = P.push * (-3 + 13 * P.bob * P.bob) + 9 * (d4 < 22 ? cl(d4 / 3) * (1 - sst(8, 22, d4)) : 0) + 5 * bump(d210, 6);
    // lids & brows
    const squint = sst(232, 240, fr) * (1 - sst(293, 299, fr)), smug = sst(331, 337, fr) * (1 - sst(354, 364, fr));
    let lid = Math.max(.12, .5 * squint, .38 * smug);
    lid *= (1 - P.wide) * (1 - .85 * P.push);
    P.lid = Math.max(lid, blinkK(fr));
    P.brow = cl(.95 * squint + .5 * smug - 1.1 * P.wide - .4 * P.push, -1, 1);   // + = frown (suspicious), − = raised
    // body
    P.breath = Math.sin(TAU * fr * 10 / 480);
    P.trunkBend = .05 * Math.sin(TAU * fr / 480 + 1.3);
    let flick = 0; for (const t0 of FLICKS) { const d = since(fr, t0); if (d < 24) flick += Math.sin(d * .95) * Math.exp(-d / 5) * (1 - d / 24); }
    P.flick = 1.2 * flick;
    P.sway = .10 * Math.sin(TAU * fr * 2 / 480 + .6) + .05 * Math.sin(TAU * fr * 5 / 480 + 2.1) - .18 * P.push;   // tail curls up on the push-ups
    return P;
  }

  // ---------- the spine ----------
  function bendAt(s, P) {
    const ysh = .16 * P.yaw;
    if (s <= 33) return P.yaw;
    if (s <= 54) return ysh + (P.yaw - ysh) * (1 - sst(33, 54, s));
    if (s <= 100) return ysh * (1 - sst(54, 84, s)) + P.trunkBend * Math.sin(Math.PI * (s - 54) / 46);
    const u = (s - 100) / (LEN - 100);
    return -.35 * u - 1.5 * u * u + P.sway * u + P.flick * u * u * u;   // the tail sweeps to the lizard's right (towards the pool), tip curling
  }
  function zAt(s, P) { return P.zAll + P.zChest * (1 - sst(50, 92, s)) + P.zHead * (1 - sst(28, 44, s)); }
  function spine(P) {
    const { u, v, ph, z, w } = A;
    for (let i = 0; i < NS; i++) { const s = i * DS; ph[i] = TH + bendAt(s, P); z[i] = zAt(s, P); }
    u[I_ANCHOR] = 0; v[I_ANCHOR] = 0;
    for (let i = I_ANCHOR; i > 0; i--) {   // a lifted front pitches up: its plan view shortens (it rises instead of reaching)
      const a = (ph[i] + ph[i - 1]) / 2, dz = Math.max(0, z[i - 1] - z[i]) - P.zAll * 0, sh = DS - Math.min(DS * .8, dz * .55);
      u[i - 1] = u[i] + sh * Math.cos(a); v[i - 1] = v[i] + sh * Math.sin(a);
    }
    for (let i = I_ANCHOR; i < NS - 1; i++) { const a = (ph[i] + ph[i + 1]) / 2; u[i + 1] = u[i] - DS * Math.cos(a); v[i + 1] = v[i] - DS * Math.sin(a); }
    for (let i = 0; i < NS; i++) {
      const s = i * DS, br = 1 + .05 * P.breath * sst(46, 60, s) * (1 - sst(88, 100, s));
      w[i] = W0[i] * br * (1 + .011 * (z[i] - P.zAll));
    }
  }
  function project() {
    const { u, v, ph, z, w, lx, ly, rx, ry, cx, cy } = A, X0 = G.gecko.x, Y0 = G.gecko.y;
    for (let i = 0; i < NS; i++) {
      const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]);
      cx[i] = X0 + SC * u[i]; cy[i] = Y0 + SC * v[i] * SQ - z[i];
      lx[i] = X0 + SC * (u[i] - nu * w[i]); ly[i] = Y0 + SC * (v[i] - nv * w[i]) * SQ - z[i];
      rx[i] = X0 + SC * (u[i] + nu * w[i]); ry[i] = Y0 + SC * (v[i] + nv * w[i]) * SQ - z[i];
    }
  }
  const scr = (uu, vv, zz) => ({ x: G.gecko.x + SC * uu, y: G.gecko.y + SC * vv * SQ - zz });
  function at(arr, s) { const q = cl(s / DS, 0, NS - 1), i = Math.min(NS - 2, Math.floor(q)), t = q - i; return arr[i] + (arr[i + 1] - arr[i]) * t; }

  // ---------- paths ----------
  function smoothTo(xs, ys, first) {      // quadratic through midpoints
    if (first) ctx.moveTo(xs[0], ys[0]); else ctx.lineTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
  }
  /** outline of the stretch [a, b] of the body (s units), width scaled by k, shifted by (ox, oy) */
  function bodyPath(a, b, k = 1, ox = 0, oy = 0) {
    const { cx, cy, lx, ly, rx, ry } = A, Lx = [], Ly = [], Rx = [], Ry = [];
    // adaptive sampling: fine round the snout and the tail tip, coarse along the trunk (the path cost is what matters)
    const ss = [a]; for (let q = a; q < b;) { q += q < 12 ? 1.5 : q > LEN - 10 ? 2.5 : 4.5; ss.push(Math.min(q, b)); }
    for (const s of ss) {
      const c0 = at(cx, s), c1 = at(cy, s);
      Lx.push(c0 + (at(lx, s) - c0) * k + ox); Ly.push(c1 + (at(ly, s) - c1) * k + oy);
      Rx.push(c0 + (at(rx, s) - c0) * k + ox); Ry.push(c1 + (at(ry, s) - c1) * k + oy);
    }
    smoothTo(Lx, Ly, true); Rx.reverse(); Ry.reverse(); smoothTo(Rx, Ry, false); ctx.closePath();
  }
  const silhouette = (k, ox, oy) => bodyPath(0, LEN, k, ox, oy);
  /** soft (blurred) fill / stroke via a pushed shadow — castShadow()'s look without ctx.filter */
  function soft(path, blur, color, stroke, lw, rule) {
    const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
    ctx.translate(push, 0); ctx.beginPath(); path();
    if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(rule || 'nonzero'); }
    ctx.restore();
  }
  const parse = s => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
  const rgba = (s, a) => { const c = parse(s); return `rgba(${c[0]},${c[1]},${c[2]},${cl(a).toFixed(3)})`; };
  /** capsule from a (radius ra) to b (radius rb), added to the current path */
  function capsule(a, b, ra, rb) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3, ang = Math.atan2(dy, dx), al = Math.asin(cl((ra - rb) / d, -1, 1));
    ctx.moveTo(a.x + Math.cos(ang + Math.PI / 2 + al) * ra, a.y + Math.sin(ang + Math.PI / 2 + al) * ra);
    ctx.arc(a.x, a.y, ra, ang + Math.PI / 2 + al, ang - Math.PI / 2 - al);
    ctx.arc(b.x, b.y, rb, ang - Math.PI / 2 - al, ang + Math.PI / 2 + al); ctx.closePath();
  }

  // ---------- legs ----------
  // base frame: x forward along the heading, y to the lizard's right. Joint at spine s; knee (bent); foot; toe fan (deg) & lengths
  const LEGS = [
    { s: 94, front: false, knee: [-12, 26], foot: [-35, 29], fan: [-52, -26, -4, 18, 42], len: [4.6, 7.6, 10.2, 13, 7], r: [4.2, 2.9, 2.1] },
    { s: 52, front: true, knee: [6, 24], foot: [28, 29], fan: [-60, -29, -3, 24, 52], len: [4.8, 7.2, 8.8, 7.8, 5.4], r: [3.6, 2.5, 1.9] },
  ];
  const b2t = (x, y) => ({ u: x * CTH - y * STH, v: x * STH + y * CTH });
  function legGeo(P, lg, side) {
    const i = lg.s / DS, { u, v, ph, z, w } = A;
    const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]);
    const J = { u: u[i] + nu * side * w[i] * .45, v: v[i] + nv * side * w[i] * .45, z: z[i] };
    const F0 = b2t(lg.foot[0], lg.foot[1] * side), F = { u: F0.u, v: F0.v, z: P.zAll };
    const K0 = b2t(lg.knee[0], lg.knee[1] * side);
    // push-up: the front legs straighten (the elbow slides to the middle of shoulder–hand and rises with them)
    const ext = lg.front ? P.push * (.6 + .4 * P.bob) : 0;
    const mid = { u: (J.u + F.u) / 2 + nu * side * 2, v: (J.v + F.v) / 2 + nv * side * 2 };
    const K = { u: K0.u + (mid.u - K0.u) * ext, v: K0.v + (mid.v - K0.v) * ext, z: P.zAll + (J.z - P.zAll) * (.3 + .3 * ext) };
    const base = Math.atan2(F.v - K0.v, F.u - K0.u), toes = [];
    for (let t = 0; t < 5; t++) {
      const a = base + lg.fan[t] * D2R * side * (lg.front ? 1 : -1), L = lg.len[t], c = (t - 2) * .14 * side * (lg.front ? 1 : -1);
      toes.push({ m: { u: F.u + Math.cos(a - c) * L * .55, v: F.v + Math.sin(a - c) * L * .55 }, e: { u: F.u + Math.cos(a) * L, v: F.v + Math.sin(a) * L } });
    }
    return { J, K, F, toes };
  }
  /** all four legs in batched passes (one path per pass: a few canvas calls instead of ~80) */
  function drawLegs(legs, C) {
    const o = C.lo, sp = [];
    for (const [lg, g] of legs) {
      const J = scr(g.J.u, g.J.v, g.J.z), K = scr(g.K.u, g.K.v, g.K.z), F = scr(g.F.u, g.F.v, g.F.z);
      sp.push({ lg, g, J, K, F, r: lg.r, toes: g.toes.map(t => ({ m: scr(t.m.u, t.m.v, g.F.z), e: scr(t.e.u, t.e.v, g.F.z) })) });
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // toes: ink, then a lit core
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.beginPath();
    for (const q of sp) for (const t of q.toes) { ctx.moveTo(q.F.x, q.F.y); ctx.quadraticCurveTo(t.m.x, t.m.y, t.e.x, t.e.y); }
    ctx.stroke();
    ctx.strokeStyle = C.toe; ctx.lineWidth = 1.0; ctx.beginPath();
    for (const q of sp) for (const t of q.toes) { ctx.moveTo(q.F.x, q.F.y); ctx.quadraticCurveTo(t.m.x, t.m.y, t.e.x + (t.m.x - t.e.x) * .2, t.e.y + (t.m.y - t.e.y) * .2); }
    ctx.stroke();
    // limbs: ink capsules (heavier away from the bulb), shade, the lit body of the limb pushed towards the bulb, a sheen
    const off = (q, k) => ({ x: q.x - o.x * k, y: q.y - o.y * k });
    const sh = (q, k) => ({ x: q.x + o.x * k, y: q.y + o.y * k - (1 - Math.hypot(o.x, o.y)) * k * .6 });
    ctx.fillStyle = C.ink; ctx.beginPath();
    for (const { J, K, F, r } of sp) { capsule(off(J, .8), off(K, .8), r[0] + 1.5, r[1] + 1.4); capsule(off(K, .8), off(F, .8), r[1] + 1.4, r[2] + 1.3); }
    ctx.fill();
    ctx.fillStyle = C.legD; ctx.beginPath();
    for (const { J, K, F, r } of sp) { capsule(J, K, r[0], r[1]); capsule(K, F, r[1], r[2]); }
    ctx.fill();
    ctx.fillStyle = C.leg; ctx.beginPath();
    for (const { J, K, F, r } of sp) { capsule(sh(J, r[0] * .3), sh(K, r[1] * .3), r[0] * .72, r[1] * .72); capsule(sh(K, r[1] * .3), sh(F, r[2] * .3), r[1] * .72, r[2] * .7); }
    ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = C.sheen; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const { J, K, F, r } of sp) { const a1 = sh(J, r[0] * .55), a2 = sh(K, r[1] * .55), a3 = sh({ x: (K.x + F.x) / 2, y: (K.y + F.y) / 2 }, r[2] * .5); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.lineTo(a3.x, a3.y); }
    ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(C.ink, .35); ctx.lineWidth = .7; ctx.beginPath();
    for (const { K, r } of sp) { ctx.moveTo(K.x + r[1] * .9, K.y); ctx.arc(K.x, K.y, r[1] * .9, 0, TAU); }
    ctx.stroke();
  }

  // ---------- draw ----------
  function draw(f, L, tg) {
    build();
    const P = pose(f, tg);
    spine(P); project();
    const { cx, cy } = A, X0 = G.gecko.x, Y0 = G.gecko.y;
    const lk = lightAt(X0 + 30, Y0 - 30, L).k, lv = cl(L.violet || 0), on = cl(L.on);
    // light direction on screen (from the lizard towards the bulb); the brand light comes from straight above
    let ldx = L.x - X0, ldy = (POOL_Y - 330) - Y0; const ln = Math.hypot(ldx, ldy) || 1; ldx /= ln; ldy /= ln;
    const dirW = on * (1 - lv), lo = { x: ldx * dirW, y: ldy * dirW };
    const hx = at(cx, 16), hy = at(cy, 16), tx = at(cx, 145), ty = at(cy, 145);
    const c = (hex, x, y, b = 1) => lit(hex, x, y, L, b);
    const ink = c(INK, X0, Y0, 0);
    const legs = []; for (const lg of LEGS) for (const side of [-1, 1]) legs.push([lg, legGeo(P, lg, side)]);

    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';

    // 1 — shadows on the cloth: the flat body (lifted parts fall further away) + legs; then a tight contact shadow
    const so = z => lv > .5 ? { x: 0, y: 2 + z * .55 } : { x: -ldx * (2.4 + .42 * z), y: -ldy * (2.4 + .42 * z) * .55 + z * .62 };
    {
      const sa = cl(.5 + .4 * lk + .2 * lv) * Math.max(on, lv, .35);
      const { u, v, ph, w, z } = A, Lx = [], Ly = [], Rx = [], Ry = [];
      for (let i = 0; i < NS; i++) {
        const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]), o = so(z[i]), ww = w[i] * .92;
        Lx.push(X0 + SC * (u[i] - nu * ww) + o.x); Ly.push(Y0 + SC * (v[i] - nv * ww) * SQ + o.y);
        Rx.push(X0 + SC * (u[i] + nu * ww) + o.x); Ry.push(Y0 + SC * (v[i] + nv * ww) * SQ + o.y);
      }
      Rx.reverse(); Ry.reverse();
      const T = (q, zz) => { const o = so(zz); return { x: X0 + SC * q.u + o.x, y: Y0 + SC * q.v * SQ + o.y }; };
      soft(() => {
        smoothTo(Lx, Ly, true); smoothTo(Rx, Ry, false); ctx.closePath();
        for (const [lg, g] of legs) { const J = T(g.J, g.J.z), K = T(g.K, g.K.z), F = T(g.F, 0); capsule(J, K, lg.r[0] * .9, lg.r[1] * .9); capsule(K, F, lg.r[1] * .9, lg.r[2] + 1.2); }
      }, 2.6, `rgba(8,4,18,${sa.toFixed(3)})`);
      // contact shadow right under the belly where it touches the table
      const ca = .42 * (1 - cl(P.zAll / 5));
      if (ca > .01) {
        const { lx, ly, rx, ry } = A, Ax = [], Ay = [], Bx = [], By = [];
        for (let i = 20; i < NS; i++) { const zz = A.z[i]; if (zz > 3) continue; Ax.push((lx[i] + cx[i]) / 2); Ay.push((ly[i] + cy[i]) / 2 + zz + 2.5); Bx.push((rx[i] + cx[i]) / 2); By.push((ry[i] + cy[i]) / 2 + zz + 2.5); }
        if (Ax.length > 2) { Bx.reverse(); By.reverse(); soft(() => { smoothTo(Ax, Ay, true); smoothTo(Bx, By, false); ctx.closePath(); }, 2.6, `rgba(6,3,14,${ca.toFixed(3)})`); }
      }
    }
    // 2 — legs, under the body
    drawLegs(legs, { ink, lo, legD: c(COL.toe, X0, Y0, .2), leg: c(COL.leg, X0, Y0, 1), toe: c(COL.leg, X0, Y0, .7),
      sheen: rgba(c(COL.bodyHi, X0, Y0, 1), cl(.15 + 1.2 * lk * on + .3 * lv)) });

    // 3 — body ink underlay: heavier on the side away from the bulb (a brushed, living line — boils on twos)
    const boil = Math.floor(Math.round(fm(f)) / 2), bj = (rnd(boil * 1.7 + 3) - .5) * .45;
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineJoin = 'round';
    ctx.beginPath(); silhouette(1, -lo.x * 1.2 + bj * .4, -lo.y * 1.2 + .4); ctx.lineWidth = 2.5 + bj; ctx.stroke();

    // 4 — colour zones (gouache base), each lit where it sits
    const body = c(COL.body, X0, Y0, .9);
    ctx.fillStyle = body; ctx.beginPath(); silhouette(1); ctx.fill();
    {
      const p0x = at(cx, 0), p0y = at(cy, 0), p1x = at(cx, 56), p1y = at(cy, 56);
      const g = ctx.createLinearGradient(p0x, p0y, p1x, p1y);
      g.addColorStop(0, c(COL.snout, p0x, p0y, 1)); g.addColorStop(.28, c(COL.head, hx, hy, 1)); g.addColorStop(.55, c(COL.jowl, hx, hy, .9));
      g.addColorStop(.7, c(COL.neck, at(cx, 40), at(cy, 40), .8)); g.addColorStop(.86, body); g.addColorStop(1, body);
      ctx.fillStyle = g; ctx.beginPath(); bodyPath(0, 58); ctx.fill();
    }
    {
      const zone = (a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); bodyPath(a, b, 1.04); ctx.fill(); };
      const ax = at(cx, 116), ay = at(cy, 116), pale = c(COL.pale, ax, ay, 1.2), band = c(COL.band, tx, ty, 1.45);
      const gp = ctx.createLinearGradient(at(cx, 102), at(cy, 102), at(cx, 113), at(cy, 113));
      gp.addColorStop(0, body); gp.addColorStop(1, pale);
      ctx.fillStyle = gp; ctx.beginPath(); bodyPath(102, 128, 1.04); ctx.fill();
      const gb = ctx.createLinearGradient(at(cx, 125), at(cy, 125), at(cx, 132), at(cy, 132));
      gb.addColorStop(0, pale); gb.addColorStop(1, band);
      ctx.fillStyle = gb; ctx.beginPath(); bodyPath(125, 178, 1.04); ctx.fill();
      zone(178, LEN, c(COL.tip, at(cx, 184), at(cy, 184), .9));
      const ringB = rgba(c(COL.body, ax, ay, .8), .85), ring = c(COL.ring, tx, ty, .8);
      ctx.fillStyle = ringB; ctx.beginPath(); for (const s0 of [110, 118]) bodyPath(s0, s0 + 2.2, 1.04); ctx.fill();
      ctx.fillStyle = ring; ctx.beginPath(); for (const s0 of [143, 154, 165]) bodyPath(s0, s0 + 2.4, 1.04); ctx.fill();
    }

    // 5 — gouache modelling, clipped to the body: flank darkening, form shadow away from the bulb, dorsal sheen, rim, texture
    ctx.save(); ctx.beginPath(); silhouette(1); ctx.clip();
    // flank darkening: two even-odd bands along the edge (cheaper than wide strokes or a blur, invisible steps at 1x)
    ctx.fillStyle = 'rgba(12,6,30,.26)'; ctx.beginPath(); silhouette(1); silhouette(.8); ctx.fill('evenodd');
    // form shadow: the light comes from the front-right, the far side of the body sinks (a gradient, not a blur)
    {
      const fx = X0 - lo.x * 70, fy = Y0 - lo.y * 70, nx = X0 + lo.x * 50, ny = Y0 + lo.y * 50, fa = .42 * Math.max(dirW, .2);
      const gfs = ctx.createLinearGradient(fx, fy, nx, ny); gfs.addColorStop(0, `rgba(10,5,26,${fa.toFixed(3)})`); gfs.addColorStop(1, 'rgba(10,5,26,0)');
      ctx.fillStyle = gfs; ctx.fillRect(X0 - 90, Y0 - 110, 180, 230);
      ctx.fillStyle = `rgba(10,5,26,${(fa * .45).toFixed(3)})`; ctx.beginPath(); silhouette(1); silhouette(1, lo.x * 4, lo.y * 4); ctx.fill('evenodd');
    }
    // dorsal sheen: stacked inner fills (a soft ridge of light along the back), the tail a little less
    ctx.globalCompositeOperation = 'screen';
    const shA = cl(.3 + 1.6 * lk * on + .7 * lv, 0, 1), shC = c(COL.bodyHi, X0, Y0, 1);
    for (const [k, a] of [[.46, .16], [.22, .22]]) {
      ctx.fillStyle = rgba(shC, a * shA); ctx.beginPath(); bodyPath(4, 104, k, lo.x * 1.4, lo.y * 1.4); bodyPath(106, 176, k * .85, lo.x * 1.1, lo.y * 1.1); ctx.fill();
    }
    // warm rim on the edge facing the bulb (grazing light on glossy scales) — what separates him from the cloth
    if (dirW > .02) {
      const rimA = cl(.35 + 2.2 * lk) * dirW;
      ctx.fillStyle = rgba(c(COL.rim, hx, hy, 1.15), .7 * rimA); ctx.beginPath(); silhouette(1); silhouette(1, -lo.x * 2.6, -lo.y * 2.6); ctx.fill('evenodd');
    }
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .45;
    PAT.setTransform(new DOMMatrix().translate(X0, Y0).scale(SC, SC * SQ).rotate(TH / D2R));
    ctx.fillStyle = PAT; ctx.fillRect(X0 - 80, Y0 - 105, 170, 225);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(c(COL.fleck, X0, Y0, 1), .38);                // pale cobalt flecks on the back
    ctx.beginPath();
    for (const fl of FLECKS) {
      const s = fl.s, x = at(cx, s), y = at(cy, s), ww = at(A.w, s) * fl.l, a = at(A.ph, s), ex = x - Math.sin(a) * ww * SC, ey = y + Math.cos(a) * ww * SC * SQ;
      ctx.moveTo(ex + fl.r * 1.4, ey); ctx.ellipse(ex, ey, fl.r * 1.4, fl.r, a, 0, TAU);
    }
    ctx.fill();
    ctx.restore();

    // 6 — the thin top ink line
    ctx.strokeStyle = rgba(ink, .9); ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    ctx.beginPath(); silhouette(1); ctx.stroke();

    // 7 — nuchal crest + neck folds (screen space, along the spine)
    ctx.fillStyle = ink; ctx.strokeStyle = rgba(ink, .75); ctx.lineCap = 'round';
    // the nuchal crest: a soft dark ridge down the nape with a few tiny spines catching the light
    ctx.beginPath(); for (let k = 0; k <= 12; k++) { const s = 33 + k * 1.8; k ? ctx.lineTo(at(cx, s), at(cy, s)) : ctx.moveTo(at(cx, s), at(cy, s)); }
    ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = rgba(c(COL.snout, at(cx, 40), at(cy, 40), 1.1), .32); ctx.beginPath();
    for (let k = 0; k < 5; k++) { const s = 35 + k * 4, x = at(cx, s) + lo.x * .5, y = at(cy, s) + lo.y * .5, r = .75 - k * .08; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fill();
    ctx.lineWidth = .8; ctx.strokeStyle = rgba(ink, .32);
    for (const s of [41]) for (const sd of [-1, 1]) {
      const x = at(cx, s), y = at(cy, s), a = at(A.ph, s), ww = at(A.w, s) * .95 * SC, nx = -Math.sin(a) * sd, ny = Math.cos(a) * sd * SQ, fx = Math.cos(a), fy = Math.sin(a) * SQ;
      ctx.beginPath(); ctx.moveTo(x + nx * ww * .5, y + ny * ww * .5); ctx.quadraticCurveTo(x + nx * ww * .82 - fx * 1.6, y + ny * ww * .82 - fy * 1.6, x + nx * ww, y + ny * ww); ctx.stroke();
    }

    // 8 — head details in the head's own frame (rigid head: x forward, y to the lizard's right)
    const s0 = 15, HX = at(cx, s0), HY = at(cy, s0), HA = at(A.ph, s0), hs = 1 + .011 * (at(A.z, s0) - P.zAll);
    ctx.save();
    ctx.translate(HX, HY); ctx.scale(SC * hs, SC * hs * SQ); ctx.rotate(HA);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // nostrils + ears (one fill), spiny ear tufts (one stroke)
    ctx.fillStyle = rgba(ink, .82); ctx.beginPath();
    for (const sd of [-1, 1]) { ctx.ellipse(12.4, sd * 3.4, 1.15, .7, sd * .5, 0, TAU); ctx.closePath(); ctx.ellipse(-15.2, sd * 10.6, 2.4, 1.6, sd * .25, 0, TAU); ctx.closePath(); }
    ctx.fill();
    ctx.strokeStyle = rgba(ink, .85); ctx.lineWidth = .9; ctx.beginPath();
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.moveTo(-16.5 - k * 1.4, sd * (11.9 + k * .15)); ctx.lineTo(-18.2 - k * 1.5, sd * (13.9 + k * .3)); }
    ctx.stroke();
    // a glint of the bulb on the top of the head
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(c(COL.hi, HX, HY, 1.15), .45 * shA); ctx.beginPath(); ctx.ellipse(1 + lo.x * 2, 0, 7, 2.6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // the eyes: bulging domes on the sides of the head; pupils on the target; lids & brows act (both eyes per pass)
    const eyeC = c(COL.eye, HX, HY, 1.15), irisC = c(COL.iris, HX, HY, .9), pupC = c(COL.pupil, HX, HY, 0), lidC = c(COL.head, HX, HY, .9), lidHi = c(COL.snout, HX, HY, 1.15);
    const catch_ = cl(.45 + 1.8 * lk * on + .6 * lv), es = 1 + .2 * P.wide, rx = 4.7 * es, ry = 4.1 * es, ex = .3;
    const la2 = P.look * .9, pr = 2.5 * (1 - .3 * P.wide), pd = 1.9 * es, SDS = [-1, 1];
    const pup = sd => ({ x: ex + Math.cos(la2) * pd, y: sd * 9.6 + Math.sin(la2) * pd + sd * .45 });
    const pass = (fill, fn) => { ctx.beginPath(); for (const sd of SDS) fn(sd, sd * 9.6); fill ? ctx.fill() : ctx.stroke(); };
    ctx.fillStyle = lidC; pass(1, (sd, ey) => { ctx.ellipse(ex - .3, ey + sd * .3, rx + 1.7, ry + 1.5, 0, 0, TAU); ctx.closePath(); });     // skin bulge
    ctx.strokeStyle = rgba(ink, .75); ctx.lineWidth = 1.1;
    pass(0, (sd, ey) => { const a0 = sd * Math.PI / 2 - 1.4; ctx.moveTo(ex - .3 + Math.cos(a0) * (rx + 1.7), ey + sd * .3 + Math.sin(a0) * (ry + 1.5)); ctx.ellipse(ex - .3, ey + sd * .3, rx + 1.7, ry + 1.5, 0, a0, a0 + 2.8); });
    ctx.save(); ctx.beginPath(); for (const sd of SDS) { ctx.ellipse(ex, sd * 9.6, rx, ry, 0, 0, TAU); ctx.closePath(); } ctx.clip();
    ctx.fillStyle = eyeC; ctx.fillRect(ex - rx - 1, -9.6 - ry - 1, 2 * rx + 2, 19.2 + 2 * ry + 2);
    ctx.fillStyle = irisC; pass(1, sd => { const q = pup(sd); ctx.moveTo(q.x + pr + .9, q.y); ctx.arc(q.x, q.y, pr + .9, 0, TAU); });
    ctx.fillStyle = pupC; pass(1, sd => { const q = pup(sd); ctx.moveTo(q.x + pr, q.y); ctx.arc(q.x, q.y, pr, 0, TAU); });
    ctx.fillStyle = 'rgba(30,14,30,.28)'; pass(1, (sd, ey) => { ctx.ellipse(ex - 1.3, ey - sd * 2.6, rx, ry * .65, 0, 0, TAU); ctx.closePath(); });   // the dome's own shade
    ctx.fillStyle = `rgba(255,250,236,${(.95 * catch_).toFixed(3)})`;
    pass(1, sd => { const q = pup(sd), x = q.x + 1.1 + lo.x * .4, y = q.y - sd * .2 - .9; ctx.moveTo(x + .95, y); ctx.arc(x, y, .95, 0, TAU); });
    if (P.lid > .01) {   // the upper lid slides over the top of the eyeball: from above, from the inner side outwards
      const L1 = cl(P.lid), bow = 1.8 * (1 - L1);
      const e0 = (sd, ey) => ey - sd * (ry + .5), e1 = (sd, ey) => e0(sd, ey) + sd * (2 * ry + 1) * L1;
      ctx.fillStyle = lidC;
      pass(1, (sd, ey) => { const a = e0(sd, ey), b = e1(sd, ey); ctx.moveTo(ex - rx - 2, a - sd * 2); ctx.lineTo(ex + rx + 2, a - sd * 2); ctx.lineTo(ex + rx + 2, b - sd * .5); ctx.quadraticCurveTo(ex, b + sd * bow, ex - rx - 2, b - sd * .5); ctx.closePath(); });
      ctx.strokeStyle = rgba(lidHi, .5); ctx.lineWidth = 1;
      pass(0, (sd, ey) => { const b = e1(sd, ey); ctx.moveTo(ex - rx * .55, b - sd * 1.6); ctx.quadraticCurveTo(ex, b - sd * 1.6 + sd * bow * .8, ex + rx * .55, b - sd * 1.6); });
      ctx.strokeStyle = ink; ctx.lineWidth = 1.25;
      pass(0, (sd, ey) => { const b = e1(sd, ey); ctx.moveTo(ex - rx - 2, b - sd * .5); ctx.quadraticCurveTo(ex, b + sd * bow, ex + rx + 2, b - sd * .5); });
    }
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.05; pass(0, (sd, ey) => { ctx.moveTo(ex + rx, ey); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); });
    // brow ridges arching over the back of the eyes (the snout reads as "down"): the acting. Frown: the inner end slides
    // forward onto the eye (suspicious); raised: it lifts back off the eye, rounder (startled)
    const bf = Math.max(0, P.brow), bu = Math.max(0, -P.brow);
    ctx.lineWidth = 1.5 + .8 * bf;
    pass(0, (sd, ey) => {
      ctx.moveTo(ex + 1.2 + 2.6 * bf - 1.6 * bu, ey - sd * (ry + 1.0 - 1.6 * bf + .6 * bu));
      ctx.quadraticCurveTo(ex - rx - 1.6 - 1.8 * bu, ey - sd * (ry + .9 + .4 * bu), ex - rx - 1.2 - 1.2 * bu, ey + sd * (ry * .55 - .2 * bf));
    });
    ctx.restore();
    ctx.restore();
    return P;
  }

  /** frames where the lizard itself moves fast enough to deserve its own 2-tap motion blur (head snaps stay crisp) */
  function moving(n) {
    if (n >= 297 && n <= 334) return true;
    if (since(n, 3) < 16 || since(n, 209) < 9) return true;
    for (const t0 of FLICKS) if (since(n, t0) < 14) return true;
    return false;
  }

  return { draw, pose, moving };
})();

/** the margouillat. With motion blur on (window.MB > 1) it is rendered into a small offscreen canvas at two taps per
 *  frame (n − ¼ and n + ¼: a 2-tap blur of his own) and every sub-frame blits it under the current camera; stills
 *  (MB = 1) draw directly at f. Returns the pose. */
const K_C = { cv: null, g: null, key: null, P: null, RS: 1, X0: -80, Y0: -94, W: 168, H: 214 };
function K_gecko(f, L, target) {
  if (!(window.MB > 1)) return K_.draw(f, L, target);
  const C = K_C, G = SCORE.G;
  if (!C.cv) { C.cv = makeCanvas(C.W * C.RS, C.H * C.RS); C.g = C.cv.getContext('2d'); }
  const fq = K_.moving(Math.round(f)) ? Math.floor(2 * f) / 2 + .25 : Math.round(f);   // 2 taps only while he moves
  const key = `${SCORE.fmod(fq)}|${(+L.on).toFixed(3)}|${(+L.violet).toFixed(3)}|${G.gecko.x}|${G.gecko.y}`;
  if (key !== C.key) {
    const main = ctx; ctx = C.g;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, C.cv.width, C.cv.height);
      ctx.setTransform(C.RS, 0, 0, C.RS, -C.RS * (G.gecko.x + C.X0), -C.RS * (G.gecko.y + C.Y0));
      C.P = K_.draw(fq, L, target); C.key = key;
    } finally { ctx = main; }
  }
  ctx.drawImage(C.cv, G.gecko.x + C.X0, G.gecko.y + C.Y0, C.W, C.H);
  return C.P;
}
function K_geckoPose(f, target) { return K_.pose(f, target); }
