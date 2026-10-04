'use strict';
// =============================================================================================
// P — PROPS of « Le Bonneteau du Feyman »: the three mini 10-ft containers (the shells), the parcel
// (« MA MARCHANDISE »), the ring glint, the dust puff and the 1 · 2 · 3 painted on the cloth.
// Functions only (no registerScene). Reads SCORE (01_score.js) and the light API (02_light.js).
//
//   P_container(c, f, L, o)        c = SCORE.containers(f)[i]; o = {glass 0..1, inside(cx,cy,w,h), insideClip (default true),
//                                  number (optional stencil on the roof), shadow (false = skip its own shadow)}
//   P_containerShadow(c, f, L, o)  the container's own shadow alone (P_container draws it unless o.shadow === false)
//   P_parcel(p, f, L, o)           p = SCORE.parcel(f); o = {noShadow}. Anchor as in 50_compose / the animatic:
//                                  front bottom edge at p.y + 40·p.s (p.y ≈ middle of the parcel's footprint)
//   P_glint(x, y, k)               ring glint, k 0..1 (1 = peak), additive
//   P_dust(x, y, k[, L])           dust puff spilling from the footprint centred on (x, y), k 0..1 = life of the puff
//   P_tableNumbers(f, L, on)       1 · 2 · 3 painted on the cloth at y = G.tableY + 60; on 0..1 lights them up
//
// Lighting: every surface is an albedo texture (baked once, procedural, seeded by c.id) re-lit per frame with the exact
// per-channel affine response of lit(): lit(c) = A·c + B, A and B sampled from lit('#000') / lit('#fff') at two
// points of each face (a gradient towards the pool) — so rust, paint and kraft all go through lit().
// Speed: no ctx.filter at draw time (a canvas blur filter costs ~25 ms a call in this Chromium). Shadows use the same
// maths as castShadow() but are drawn with shadowBlur (castShadowFast, ~0.3 ms). Glass refraction copies the canvas once
// per (sub)frame. Typical cost: steel container ~3 ms, glass ~3-6 ms, parcel ~1-3 ms, numbers ~1.5 ms.
// =============================================================================================
const P_K = (function () {
  const S = window.SCORE, G = S.G;
  const TAU = Math.PI * 2;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const css = (a, al) => al === undefined ? `rgb(${cl(a[0], 0, 255) | 0},${cl(a[1], 0, 255) | 0},${cl(a[2], 0, 255) | 0})`
    : `rgba(${cl(a[0], 0, 255) | 0},${cl(a[1], 0, 255) | 0},${cl(a[2], 0, 255) | 0},${cl(al).toFixed(3)})`;
  const hex = a => '#' + a.map(v => (cl(Math.round(v), 0, 255) | 0).toString(16).padStart(2, '0')).join('');
  const sstep = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------- deterministic hash / value noise (integer hash: stable, no Math.random) ----------
  function hh(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function vn(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hh(xi, yi, s), b = hh(xi + 1, yi, s), c = hh(xi, yi + 1, s), d = hh(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, o = 4) { let a = 0, m = .5, n = 0; for (let i = 0; i < o; i++) { a += m * vn(x, y, s + i * 31); n += m; m *= .5; x *= 2.03; y *= 2.03; } return a / n; }

  // ---------- light: lit() as a per-channel affine map ----------
  const parse = s => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
  function ab(x, y, L, bias) { const b = parse(lit('#000000', x, y, L, bias)), w = parse(lit('#ffffff', x, y, L, bias)); return { A: [(w[0] - b[0]) / 255, (w[1] - b[1]) / 255, (w[2] - b[2]) / 255], B: b }; }
  const litA = (a, x, y, L, bias) => parse(lit(hex(a), x, y, L, bias));
  /** relight what was just painted inside `path` (opaque albedo) like lit() would: multiply by A, add B.
   *  The response is sampled at p0 and p1 (two screen points) and interpolated along the segment. */
  function relight(path, p0, p1, L, bias) {
    const a0 = ab(p0.x, p0.y, L, bias), a1 = ab(p1.x, p1.y, L, bias);
    ctx.save(); ctx.beginPath(); path(); ctx.clip();
    const gm = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y); gm.addColorStop(0, css(mul(a0.A, 255))); gm.addColorStop(1, css(mul(a1.A, 255)));
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gm; ctx.fillRect(-2000, -2000, 5000, 6000);
    const ga = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y); ga.addColorStop(0, css(a0.B)); ga.addColorStop(1, css(a1.B));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ga; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.restore();
  }
  /** two sample points around (x,y) along the direction of the light pool (where the falloff is steepest) */
  function poolAxis(x, y, L, r) {
    let dx = L.x - x, dy = (POOL_Y - y) / .82; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    return [{ x: x - dx * r, y: y - dy * r * .82 }, { x: x + dx * r, y: y + dy * r * .82 }];
  }

  // ---------- image on a quad, in horizontal strips (keystone / tilt without a WebGL) ----------
  const lp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function quadImg(img, q, n) {      // q = [TL, TR, BL, BR]; the whole image, clipped to the exact quad
    const sw = img.width, sh = img.height;
    ctx.save(); ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y); ctx.lineTo(q[3].x, q[3].y); ctx.lineTo(q[2].x, q[2].y); ctx.closePath(); ctx.clip();
    for (let i = 0; i < n; i++) {
      const v0 = i / n, v1 = (i + 1) / n;
      const t0 = lp(q[0], q[2], v0), t1 = lp(q[1], q[3], v0), u0 = lp(q[0], q[2], v1), u1 = lp(q[1], q[3], v1);
      const a = { x: Math.min(t0.x, u0.x) - .3, y: t0.y }, b = { x: Math.max(t1.x, u1.x) + .3, y: t1.y }, c = { x: a.x + (u0.x - t0.x) * 0, y: u0.y };   // widened: no stair-steps
      const sy = sh * v0, hgt = sh / n, ov = i < n - 1 ? Math.min(2, sh - sy - hgt) : 0;
      ctx.setTransform(ctx._P_base);
      ctx.transform((b.x - a.x) / sw, (b.y - a.y) / sw, (c.x - a.x) / hgt, (c.y - a.y) / hgt, a.x, a.y);
      ctx.drawImage(img, 0, sy, sw, hgt + ov, 0, 0, sw, hgt + ov);
    }
    ctx.restore(); ctx.setTransform(ctx._P_base);
  }
  function hull(P) {               // convex hull (monotone chain) of screen points
    const p = P.slice().sort((a, b) => a.x - b.x || a.y - b.y), cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // ---------- soft shapes WITHOUT ctx.filter (a canvas blur filter costs ~25 ms a call here; shadowBlur ~0.3 ms) ----------
  // only the blurred "shadow" of the shape is drawn: the shape itself is pushed far off-canvas. blur = CSS-blur radius (σ).
  function soft(path, blur, color, stroke, lw) {
    // the push must stay modest: with a far push (30 000 px) Chromium still reads back right but composites a stale canvas
    const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
    ctx.translate(push, 0); ctx.beginPath(); path();
    if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(); }
    ctx.restore();
  }
  /** amber glow along a path, built from nested strokes (additive): cheap and smooth enough at these widths */
  function glowStroke(pathFn, k) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col, a] of [[22, '255,110,20', .05], [15, '255,120,25', .07], [10, '255,135,35', .1], [6.5, '255,150,45', .16], [3.6, '255,170,60', .34], [2, '255,200,110', .55], [1.1, '255,236,190', .8]]) {
      ctx.strokeStyle = `rgba(${col},${(a * k).toFixed(3)})`; ctx.lineWidth = w; pathFn(); ctx.stroke();
    }
    ctx.restore();
  }
  /** castShadow() of 02_light.js, same maths (alpha, offset, softness), drawn with shadowBlur instead of ctx.filter */
  function castShadowFast(pathFn, x, y, z, L, strength = 1) {
    const { k, v } = lightAt(x, y, L);
    const a = strength * (.62 * Math.max(k, .25) + .25 * v) * (1 - Math.min(.6, z / 400));
    if (a <= .01) return;
    const o = v > .5 ? { x: 0, y: 10 + z * .5 } : shadowOff(x, y, z, L);
    ctx.save(); ctx.translate(o.x, o.y); soft(pathFn, 4 + z * .08, `rgba(8,4,18,${a.toFixed(3)})`); ctx.restore();
  }
  const polyPath = pts => () => { ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };

  // =============================================================================================
  // CONTAINERS
  // =============================================================================================
  // camera model: orthographic pitch PHI (so that a G.ch-tall door face and a G.cd-deep roof come out right),
  // plus a gentle wide-lens keystone around x = 540 (backs converge, tops splay) and growth when lifted.
  const PHI = 50 * Math.PI / 180, SP = Math.sin(PHI), CP = Math.cos(PHI);
  const DL = G.cd / SP, HL = G.ch / CP, TILT = 12 * Math.PI / 180, KD = .075, KH = .045, VX = 540;
  function projector(c) {
    const a = (c.tilt || 0) * TILT, ca = Math.cos(a), sa = Math.sin(a), z = c.z || 0, gr = 1 + z * .0009;
    const ay = c.y - z - (G.ch + G.cd) * .5;
    const P = (u, d, h) => {
      const D = d * DL * ca - h * HL * sa, Hh = d * DL * sa + h * HL * ca;
      const per = 1 - KD * D / DL + KH * Hh / HL;
      const X = VX + (c.x + u * G.cw / 2 - VX) * per, Y = c.y - z - (D * SP + Hh * CP);
      return { x: c.x + (X - c.x) * gr, y: ay + (Y - ay) * gr };
    };
    P.gr = gr; return P;
  }

  // ---- palettes: three slightly different steels (sharp eyes can tell them apart) ----
  const PAL = [
    { paint: [78, 108, 140], roofTint: [118, 134, 150], seed: 11 },   // c0: the bluest
    { paint: [88, 106, 124], roofTint: [126, 134, 140], seed: 23 },   // c1: greyer, a dent and a patched roof
    { paint: [74, 106, 122], roofTint: [114, 132, 138], seed: 37 },   // c2: teal-grey, the rustiest sill
  ];
  const cid = c => (((c.id | 0) % 3) + 3) % 3;
  const RUST = { dark: [70, 32, 16], mid: [128, 58, 24], hi: [176, 92, 40], stain: [150, 84, 46] };

  // door face layout, screen px at scale 1 (x 0..200 from the left, y 0..118 from the top)
  const DOOR = { post: 13, head: 11, sill: 10, rods: [30, 70, 130, 170], handleY: 63, bands: [[17, 30], [37, 50], [57, 70], [77, 90]] };
  // roof ribs (x 0..200)
  const RIB = { n: 9, x0: 9, x1: 191 };
  const ribW = (RIB.x1 - RIB.x0) / RIB.n;

  const TS = 2;   // texture px per screen px
  const TEXC = {};

  function rustPass(g, w, h, sc, seed, weightFn, o = {}) {
    // per-pixel: mottled paint, grime, rust where weight × noise passes a threshold (in px of the layout, /sc)
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = i / sc, Y = j / sc, k = (j * w + i) * 4;
      let r = d[k], gg = d[k + 1], b = d[k + 2];
      // paint mottling + fine grain
      const m = .9 + .17 * fbm(X * .045, Y * .045, seed + 1, 3) + .07 * (vn(X * .9, Y * .9, seed + 2) - .5);
      r *= m; gg *= m; b *= m;
      // sun-bleach / grime (low frequency)
      const gr = fbm(X * .02 + 3, Y * .03, seed + 3, 2);
      const bleach = (o.bleach || 0) * sstep(.45, .8, gr);
      r += (o.bleachCol[0] - r) * bleach; gg += (o.bleachCol[1] - gg) * bleach; b += (o.bleachCol[2] - b) * bleach;
      // rust
      const wgt = weightFn(X, Y);
      if (wgt > .02) {
        const n1 = fbm(X * .16, Y * .16, seed + 5, 4), n2 = fbm(X * .5, Y * (o.streakY || .5), seed + 7, 3);
        const v = wgt * (.55 + .9 * n1) + .25 * (n2 - .5);
        const a = sstep(.42, .62, v), core = sstep(.62, .85, v);
        if (a > 0) {
          const t = fbm(X * .3, Y * .3, seed + 9, 2);
          let rc = mixv(RUST.hi, RUST.mid, sstep(.3, .7, t)); rc = mixv(rc, RUST.dark, core * .85);
          const aa = a * .92;
          r += (rc[0] - r) * aa; gg += (rc[1] - gg) * aa; b += (rc[2] - b) * aa;
        }
        // raised, bubbled paint just at the edge of the rust
        const rim = sstep(.33, .42, v) * (1 - a);
        r *= 1 + .1 * rim; gg *= 1 + .08 * rim; b *= 1 + .05 * rim;
      }
      d[k] = r; d[k + 1] = gg; d[k + 2] = b;
    }
    g.putImageData(im, 0, 0);
  }
  /** chips of paint along a segment (screen px of the layout), bare metal with a rusty halo */
  function chips(g, x0, y0, x1, y1, n, seed, size = 1.3) {
    n = Math.round(n * .7);
    for (let i = 0; i < n; i++) {
      const t = hh(i, 3, seed), x = x0 + (x1 - x0) * t + (hh(i, 5, seed) - .5) * 2.2, y = y0 + (y1 - y0) * t + (hh(i, 7, seed) - .5) * 2.2;
      const r = size * (.5 + hh(i, 9, seed));
      const pts = []; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = r * (.6 + .7 * hh(i * 7 + k, 11, seed)); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr]); }
      const draw = () => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.closePath(); };
      g.save(); g.translate(.45, .55); g.fillStyle = 'rgba(70,30,12,.6)'; draw(); g.fill(); g.restore();   // rusty halo below
      g.fillStyle = hh(i, 13, seed) > .45 ? 'rgba(150,154,152,.8)' : 'rgba(120,62,34,.9)'; draw(); g.fill();   // bare steel / primer
    }
  }

  function buildDoor(id) {
    const p = PAL[id], s = p.seed, w = G.cw * TS, h = G.ch * TS, cv = makeCanvas(w, h), g = cv.getContext('2d');
    const P = p.paint, dk = k => css(mul(P, k)), D = DOOR;
    g.scale(TS, TS);
    g.fillStyle = css(P); g.fillRect(0, 0, G.cw, G.ch);
    // horizontal corrugations of the two doors (recessed bands: upper bevel in shade, lower bevel lit)
    for (const [y0, y1] of D.bands) {
      g.fillStyle = dk(.86); g.fillRect(D.post, y0, G.cw - 2 * D.post, y1 - y0);
      let gr = g.createLinearGradient(0, y0, 0, y0 + 4.5); gr.addColorStop(0, dk(.42)); gr.addColorStop(1, dk(.84));
      g.fillStyle = gr; g.fillRect(D.post, y0, G.cw - 2 * D.post, 4.5);
      gr = g.createLinearGradient(0, y1 - 3.5, 0, y1); gr.addColorStop(0, dk(.92)); gr.addColorStop(1, dk(1.5));
      g.fillStyle = gr; g.fillRect(D.post, y1 - 3.5, G.cw - 2 * D.post, 3.5);
      g.fillStyle = dk(1.3); g.fillRect(D.post, y0 - 1, G.cw - 2 * D.post, 1);
    }
    // header + sill
    let gr = g.createLinearGradient(0, 0, 0, D.head); gr.addColorStop(0, dk(1.18)); gr.addColorStop(.3, dk(.96)); gr.addColorStop(1, dk(.78));
    g.fillStyle = gr; g.fillRect(0, 0, G.cw, D.head);
    gr = g.createLinearGradient(0, D.head, 0, D.head + 5); gr.addColorStop(0, 'rgba(10,8,16,.55)'); gr.addColorStop(1, 'rgba(10,8,16,0)');
    g.fillStyle = gr; g.fillRect(0, D.head, G.cw, 5);                                             // the header's shadow on the doors
    gr = g.createLinearGradient(0, G.ch - D.sill, 0, G.ch); gr.addColorStop(0, dk(1.25)); gr.addColorStop(.25, dk(.92)); gr.addColorStop(1, dk(.7));
    g.fillStyle = gr; g.fillRect(0, G.ch - D.sill, G.cw, D.sill);
    // corner posts (channel profile)
    for (const x0 of [0, G.cw - D.post]) {
      gr = g.createLinearGradient(x0, 0, x0 + D.post, 0);
      gr.addColorStop(0, dk(1.2)); gr.addColorStop(.18, dk(1)); gr.addColorStop(.42, dk(.62)); gr.addColorStop(.62, dk(.86)); gr.addColorStop(1, dk(.74));
      g.fillStyle = gr; g.fillRect(x0, 0, D.post, G.ch);
    }
    // door seam + gaskets
    g.fillStyle = 'rgba(14,10,20,.9)'; g.fillRect(99.2, D.head, 1.6, G.ch - D.head - D.sill);
    g.fillStyle = 'rgba(20,18,26,.55)'; g.fillRect(97.6, D.head, 1.6, G.ch - D.head - D.sill); g.fillRect(100.8, D.head, 1.6, G.ch - D.head - D.sill);
    g.fillStyle = dk(1.22); g.fillRect(96.8, D.head, .8, G.ch - D.head - D.sill); g.fillRect(102.4, D.head, .6, G.ch - D.head - D.sill);
    // door frames (vertical edge channels next to the posts)
    for (const x of [D.post, G.cw - D.post - 2]) { g.fillStyle = dk(.72); g.fillRect(x, D.head, 2, G.ch - D.head - D.sill); }
    // hinges on the posts
    for (const y of [20, 44, 70, 94]) for (const x of [9, G.cw - 17]) {
      g.fillStyle = 'rgba(8,6,12,.35)'; g.fillRect(x + .5, y + 1.6, 8, 7);
      g.fillStyle = dk(.92); g.fillRect(x, y, 8, 7); g.fillStyle = dk(1.25); g.fillRect(x, y, 8, 1.2); g.fillStyle = dk(.6); g.fillRect(x, y + 6, 8, 1);
      g.fillStyle = dk(.5); g.beginPath(); g.arc(x + 4, y + 3.5, 1.3, 0, TAU); g.fill();
    }
    // corner castings (with their oval holes)
    for (const [x, y] of [[0, 0], [G.cw - 15, 0], [0, G.ch - 12], [G.cw - 15, G.ch - 12]]) {
      g.fillStyle = dk(.8); g.fillRect(x, y, 15, 12); g.fillStyle = dk(1.15); g.fillRect(x, y, 15, 1.4);
      g.fillStyle = dk(.55); g.fillRect(x, y + 11, 15, 1);
      g.fillStyle = 'rgba(8,6,12,.95)'; g.beginPath(); g.ellipse(x + 7.5, y + 6.2, 4.2, 2.6, 0, 0, TAU); g.fill();
      g.strokeStyle = dk(1.2); g.lineWidth = .6; g.beginPath(); g.ellipse(x + 7.5, y + 6.6, 4.2, 2.6, 0, .2, Math.PI - .2); g.stroke();
    }
    // locking rods: guides, cam keepers, rods, handles + retainers
    D.rods.forEach((rx, i) => {
      const dir = rx < 100 ? 1 : -1;                     // handles point towards the door seam
      // soft occlusion behind the rod
      g.fillStyle = 'rgba(8,6,12,.22)'; g.fillRect(rx - 3.4, 4, 6.8, G.ch - 8);
      // rod
      gr = g.createLinearGradient(rx - 1.9, 0, rx + 1.9, 0);
      gr.addColorStop(0, dk(.45)); gr.addColorStop(.32, dk(1.15)); gr.addColorStop(.42, dk(1.55)); gr.addColorStop(.62, dk(.95)); gr.addColorStop(1, dk(.42));
      g.fillStyle = gr; g.fillRect(rx - 1.9, 5, 3.8, G.ch - 10);
      // guides (brackets)
      for (const y of [27, 96]) {
        g.fillStyle = 'rgba(8,6,12,.35)'; g.fillRect(rx - 5, y + 1.4, 10, 3.6);
        g.fillStyle = dk(.86); g.fillRect(rx - 5, y, 10, 3.4); g.fillStyle = dk(1.3); g.fillRect(rx - 5, y, 10, .8);
        g.fillStyle = dk(.45); for (const bx of [rx - 3.8, rx + 3.8]) { g.beginPath(); g.arc(bx, y + 1.8, .7, 0, TAU); g.fill(); }
      }
      // cam keepers (top on the header, bottom on the sill)
      for (const [y, up] of [[2.2, 1], [G.ch - 9.4, -1]]) {
        g.fillStyle = 'rgba(8,6,12,.4)'; g.fillRect(rx - 4.4, y + 1.2, 8.8, 7.6);
        g.fillStyle = dk(.82); rrectOn(g, rx - 4.4, y, 8.8, 7.2, 1.4); g.fill();
        g.fillStyle = dk(1.28); g.fillRect(rx - 4, y + .3, 8, .9);
        g.fillStyle = 'rgba(8,6,12,.8)'; g.fillRect(rx - 2.4, y + (up > 0 ? 3.6 : 1.4), 4.8, 2.2);
        g.fillStyle = dk(1.05); g.beginPath(); g.arc(rx, y + 3.6, 1.6, 0, TAU); g.fill();
      }
      // handle: hub on the rod, lever towards the seam, retainer catch at its end
      const hy = D.handleY + (i % 2 ? 1.5 : 0), len = 21, ex = rx + dir * len;
      g.fillStyle = 'rgba(8,6,12,.55)'; g.fillRect(Math.min(rx, ex) - 1, hy + 2.4, len + 3, 4.2);
      g.fillStyle = 'rgba(8,6,12,.45)'; g.fillRect(ex - 3, hy - 3, 6, 9.5);
      g.fillStyle = dk(.8); g.fillRect(ex - 2.8, hy - 4, 5.6, 9); g.fillStyle = dk(1.2); g.fillRect(ex - 2.8, hy - 4, 5.6, .9);
      g.fillStyle = 'rgba(8,6,12,.85)'; g.fillRect(ex - 1.6, hy - 2.4, 3.2, 5.6);
      gr = g.createLinearGradient(0, hy - 2, 0, hy + 2.4); gr.addColorStop(0, dk(1.9)); gr.addColorStop(.3, dk(1.25)); gr.addColorStop(1, dk(.45));
      g.fillStyle = gr; g.beginPath(); g.moveTo(rx, hy - 2); g.lineTo(ex - dir * 4, hy - 1.8); g.lineTo(ex + dir * 1.5, hy - 2.6); g.lineTo(ex + dir * 1.5, hy + 2.8); g.lineTo(ex - dir * 4, hy + 2); g.lineTo(rx, hy + 2.2); g.closePath(); g.fill();
      g.fillStyle = dk(.85); g.fillRect(rx - 3, hy - 4.5, 6, 9); g.fillStyle = dk(1.3); g.fillRect(rx - 3, hy - 4.5, 6, .9);
      g.fillStyle = dk(.5); g.beginPath(); g.arc(rx, hy, 1.1, 0, TAU); g.fill();
    });
    // blank plate (no text: a bare riveted plate) on the left door
    g.fillStyle = 'rgba(8,6,12,.35)'; g.fillRect(39.5, 101.3 - 9, 21, 8.6);
    gr = g.createLinearGradient(38, 0, 60, 0); gr.addColorStop(0, '#8E979B'); gr.addColorStop(.5, '#B4BBBD'); gr.addColorStop(1, '#868E92');
    g.fillStyle = gr; g.fillRect(38.5, 91.5, 20.5, 8.2); g.fillStyle = 'rgba(40,40,46,.6)';
    for (const [x, y] of [[40, 93], [57.5, 93], [40, 98.2], [57.5, 98.2]]) { g.beginPath(); g.arc(x, y, .55, 0, TAU); g.fill(); }
    // painted-out marking panel (top right): fresher paint, roller texture, no marking
    g.save(); g.globalAlpha = .55; g.fillStyle = css(mixv(P, [60, 92, 128], .55));
    g.beginPath(); g.moveTo(110, 14.5); g.lineTo(182, 13.8); g.lineTo(183, 33.5); g.lineTo(109, 34.2); g.closePath(); g.fill(); g.restore();
    rustPass(g, w, h, TS, s, (X, Y) => {
      let wv = 0;
      wv += .62 * sstep(G.ch - 16, G.ch - 2, Y) * (id === 2 ? 1.25 : 1);                             // sill & door bottoms
      wv += .55 * Math.exp(-((X < 100 ? X : G.cw - X) ** 2 + (Y < 59 ? Y : G.ch - Y) ** 2) / 90);     // corners
      wv += .35 * Math.exp(-((X - 100) ** 2) / 3) * sstep(G.ch - 40, G.ch - 8, Y);                   // seam bottom
      for (const rx of DOOR.rods) {                                                                // bleeding under keepers / guides / handles
        for (const [y0, len, st] of [[9, 26, .55], [30, 16, .4], [99, 9, .4], [67, 22, .42]]) {
          if (Y < y0 || Y > y0 + len) continue; const t = (Y - y0) / len;
          const ww = 1.4 + 2.2 * t, xx = X - rx - 2.2 * Math.sin(Y * .3 + rx);
          wv += st * Math.exp(-(xx * xx) / (ww * ww)) * (1 - t) ** 1.2;
        }
      }
      // id-specific streaks (track them!)
      const ST = [[[58, 11, 78, 2.6, .9], [146, 11, 40, 2, .5], [186, 12, 50, 2.2, .55]], [[112, 35, 30, 2.2, .45], [24, 12, 36, 2, .55], [160, 11, 26, 1.8, .45]], [[88, 11, 64, 2.4, .7], [176, 11, 88, 2.8, .85], [40, 11, 34, 2, .45], [120, 11, 22, 1.6, .4]]][id];
      for (const [sx, y0, len, ww0, st] of ST) {
        if (Y < y0 || Y > y0 + len) continue; const t = (Y - y0) / len, ww = ww0 * (1 + 1.4 * t), xx = X - sx - 1.6 * Math.sin(Y * .21 + sx);
        wv += st * Math.exp(-(xx * xx) / (ww * ww)) * (1 - t) ** .9;
      }
      return wv;
    }, { bleach: .12, bleachCol: mixv(P, [150, 150, 146], .5), streakY: .08 });
    // chips along the edges (bare steel, primer)
    chips(g, 1, 2, 1, G.ch - 2, 8, s + 1); chips(g, G.cw - 1, 2, G.cw - 1, G.ch - 2, 8, s + 2);
    chips(g, 14, D.head - .5, G.cw - 14, D.head - .5, 9, s + 3, 1.2); chips(g, 14, G.ch - D.sill + .4, G.cw - 14, G.ch - D.sill + .4, 10, s + 4, 1.4);
    chips(g, 97, 14, 97, 104, 5, s + 5, 1.1); chips(g, 103, 14, 103, 104, 4, s + 6, 1.1);
    for (const [y0] of D.bands) chips(g, 16, y0, G.cw - 16, y0, 4, s + 7 + y0, 1);
    // scratches
    g.strokeStyle = 'rgba(200,205,205,.22)'; g.lineWidth = .35;
    for (let i = 0; i < 18; i++) { const x = 15 + hh(i, 1, s + 40) * 170, y = 14 + hh(i, 2, s + 40) * 90, a = (hh(i, 3, s + 40) - .5) * .9, l = 3 + hh(i, 4, s + 40) * 10;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    // a tiny yellow bolt seal on c0's inner right handle (only c0: a tell)
    if (id === 0) { const x = 130 - 21, y = DOOR.handleY + 1.5; g.fillStyle = '#E8B21E'; rrectOn(g, x - 1.6, y + 3, 3.2, 6, 1); g.fill(); g.fillStyle = '#FFF0A0'; g.fillRect(x - 1.2, y + 3.4, .8, 4.4); }
    return cv;
  }

  function buildRoof(id) {
    const p = PAL[id], s = p.seed + 100, w = G.cw * TS, h = G.cd * TS, cv = makeCanvas(w, h), g = cv.getContext('2d');
    const R = mixv(p.paint, p.roofTint, .22), dk = k => css(mul(R, k));
    g.scale(TS, TS);
    g.fillStyle = css(R); g.fillRect(0, 0, G.cw, G.cd);
    // ribs (front-to-back): valley | slope | crest | slope — baked neutral (the bulb is added per frame)
    for (let i = 0; i < RIB.n; i++) {
      const x0 = RIB.x0 + i * ribW;
      const gr = g.createLinearGradient(x0, 0, x0 + ribW, 0);
      gr.addColorStop(0, dk(.58)); gr.addColorStop(.12, dk(.7)); gr.addColorStop(.3, dk(.92)); gr.addColorStop(.37, dk(1.1));
      gr.addColorStop(.63, dk(1.1)); gr.addColorStop(.7, dk(.92)); gr.addColorStop(.88, dk(.7)); gr.addColorStop(1, dk(.58));
      g.fillStyle = gr; g.fillRect(x0, 0, ribW + .3, G.cd);
    }
    // top side rails, front & rear headers
    for (const x0 of [0, G.cw - RIB.x0]) { const gr = g.createLinearGradient(x0, 0, x0 + RIB.x0, 0);
      gr.addColorStop(0, dk(x0 ? .9 : 1.2)); gr.addColorStop(.5, dk(1.05)); gr.addColorStop(1, dk(x0 ? 1.15 : .8)); g.fillStyle = gr; g.fillRect(x0, 0, RIB.x0, G.cd); }
    let gr = g.createLinearGradient(0, G.cd - 9, 0, G.cd); gr.addColorStop(0, dk(.7)); gr.addColorStop(.3, dk(1.08)); gr.addColorStop(1, dk(1.22));
    g.fillStyle = gr; g.fillRect(0, G.cd - 9, G.cw, 9);
    gr = g.createLinearGradient(0, 0, 0, 8); gr.addColorStop(0, dk(1.15)); gr.addColorStop(.7, dk(1)); gr.addColorStop(1, dk(.66));
    g.fillStyle = gr; g.fillRect(0, 0, G.cw, 8);
    // top corner castings
    for (const [x, y] of [[0, 0], [G.cw - 16, 0], [0, G.cd - 12], [G.cw - 16, G.cd - 12]]) {
      g.fillStyle = dk(.84); g.fillRect(x, y, 16, 12); g.fillStyle = dk(1.2); g.fillRect(x, y, 16, 1.2); g.fillRect(x, y, 1.2, 12);
      g.fillStyle = 'rgba(8,6,12,.95)'; g.beginPath(); g.ellipse(x + 8, y + 6, 2.6, 4.4, 0, 0, TAU); g.fill();
    }
    // c1: a dent; c0: a patched square of fresher paint
    if (id === 1) {   // c1's tell: two ribs repainted, fresher and a touch bluer, with a ragged roller edge
      g.save(); g.globalAlpha = .26; g.fillStyle = css(mixv(R, [64, 98, 150], .55));
      const x0 = RIB.x0 + 5 * ribW + 1, x1 = RIB.x0 + 7 * ribW - 1;
      g.beginPath(); g.moveTo(x0, 22); for (let y = 22; y <= 150; y += 4) g.lineTo(x0 + (hh(y, 1, 9) - .5) * 1.6, y); g.lineTo(x1, 152); for (let y = 150; y >= 22; y -= 4) g.lineTo(x1 + (hh(y, 2, 9) - .5) * 1.6, y); g.closePath(); g.fill(); g.restore();
    }
    rustPass(g, w, h, TS, s, (X, Y) => {
      let wv = 0;
      const rx = (X - RIB.x0) / ribW, fr = rx - Math.floor(rx), valley = Math.exp(-((Math.min(fr, 1 - fr)) ** 2) / .012);
      wv += .3 * valley * (.4 + .6 * fbm(X * .01, Y * .05, s + 3, 2));                                       // rust in the valleys
      wv += .6 * Math.exp(-(Math.min(X, G.cw - X) ** 2 + Math.min(Y, G.cd - Y) ** 2) / 260);                  // corners
      wv += .22 * sstep(9, 0, Math.min(X, G.cw - X));                                                        // along the rails
      const POOLS = [[[60, 40, 16, .6], [150, 120, 12, .45]], [[150, 50, 14, .5], [80, 140, 10, .4]], [[40, 120, 22, .75], [140, 30, 12, .5], [170, 150, 16, .55]]][id];
      for (const [px, py, pr, st] of POOLS) wv += st * Math.exp(-((X - px) ** 2 + (Y - py) ** 2 * .5) / (pr * pr));
      return wv;
    }, { bleach: .16, bleachCol: mixv(R, [160, 162, 158], .5), streakY: .5 });
    chips(g, 1, 2, 1, G.cd - 2, 10, s + 1, 1.3); chips(g, G.cw - 1, 2, G.cw - 1, G.cd - 2, 10, s + 2, 1.3);
    chips(g, 4, G.cd - 1, G.cw - 4, G.cd - 1, 12, s + 3, 1.2); chips(g, 4, 1, G.cw - 4, 1, 8, s + 4, 1.1);
    // dust & grime collected towards the back
    gr = g.createLinearGradient(0, 0, 0, G.cd); gr.addColorStop(0, 'rgba(40,30,22,.22)'); gr.addColorStop(.5, 'rgba(40,30,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, G.cw, G.cd);
    return cv;
  }
  function tex(id) {
    if (!TEXC[id]) TEXC[id] = { door: buildDoor(id), roof: buildRoof(id) };
    return TEXC[id];
  }

  // ---------- shadow ----------
  function containerShadow(c, f, L, o = {}) {
    const z = c.z || 0, gl = o.glass || 0;
    const sg = 1 + z * .0016, cx = c.x, cy = c.y - G.cd * .5, tb = (c.tilt || 0) * 16;
    const ft = (u, d) => { const X = VX + (c.x + u * G.cw / 2 - VX) * (1 - KD * d), Y = c.y - d * (G.cd + tb); return { x: cx + (X - cx) * sg, y: cy + (Y - cy) * sg }; };
    const pts = [ft(-1.02, -.03), ft(1.02, -.03), ft(1.02, 1), ft(-1.02, 1)];
    // body shadow: the bulb is high and a little behind: the box throws a short shadow towards us
    const so = shadowOff(c.x, c.y, G.ch * .55, L), s0 = shadowOff(c.x, c.y, 0, L);
    const ex = (so.x - s0.x) * .5, ey = (so.y - s0.y) * .5;
    const shp = hull(pts.concat(pts.map(p => ({ x: p.x + ex, y: p.y + ey }))));
    castShadowFast(polyPath(shp), cx, c.y, z, L, 1 - .55 * gl);
    const lk = Math.max(lightAt(cx, c.y, L).k, L.violet * .8);
    // a lifted box: castShadow fades with height — keep a soft umbra that still reads on the busy wax
    if (z > 2) {
      const so = L.violet > .5 ? { x: 0, y: 10 + z * .5 } : shadowOff(cx, c.y, z, L), a = (.18 + .3 * lk) * cl(z / 40) * (1 - .5 * gl);
      ctx.save(); ctx.translate(so.x, so.y); soft(polyPath(pts.map(p => ({ x: cx + (p.x - cx) * .92, y: cy + (p.y - cy) * .92 }))), 9 + z * .1, `rgba(6,3,14,${a.toFixed(3)})`); ctx.restore();
    }
    // glass: the violet light through the box and the amber edges glow on the cloth around its foot
    if (gl > .01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fl = ft(-1, 0), fr = ft(1, 0), mid = lp(fl, fr, .5);
      soft(() => ctx.ellipse(mid.x, mid.y + 14, G.cw * .62, 30, 0, 0, TAU), 16, `rgba(140,100,255,${(.3 * gl).toFixed(3)})`);
      soft(() => { ctx.moveTo(fl.x, fl.y + 3); ctx.lineTo(fr.x, fr.y + 3); }, 5, `rgba(255,140,40,${(.5 * gl).toFixed(3)})`, true, 4);
      ctx.restore();
    }
    // contact occlusion (only when it sits on the cloth): a wide soft one and a tight dark line
    const ca = (1 - cl(z / 22)) * (1 - .5 * gl) * (.5 + .4 * lk);
    if (ca > .01) {
      soft(polyPath([ft(-1.09, -.07), ft(1.09, -.07), ft(1.09, .7), ft(-1.09, .7)]), 7, `rgba(6,3,14,${(ca * .6).toFixed(3)})`);
      soft(polyPath([ft(-1.025, -.022), ft(1.025, -.022), ft(1.025, .5), ft(-1.025, .5)]), 2, `rgba(4,2,10,${Math.min(1, ca * 1.3).toFixed(3)})`);
    }
  }

  // ---------- steel ----------
  function drawSteel(c, f, L, o, P) {
    const T = tex(cid(c));
    // corners
    const fbl = P(-1, 0, 0), fbr = P(1, 0, 0), ftl = P(-1, 0, 1), ftr = P(1, 0, 1), btl = P(-1, 1, 1), btr = P(1, 1, 1), bbl = P(-1, 1, 0), bbr = P(1, 1, 0);
    const pal = PAL[cid(c)], paint = pal.paint, roofC = mixv(paint, pal.roofTint, .22);
    // visible side face (inner side of the outer containers): signed area of its quad
    const area = q => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], n = q[(i + 1) % q.length]; a += p.x * n.y - n.x * p.y; } return a; };
    const sideR = [fbr, bbr, btr, ftr], sideL = [fbl, ftl, btl, bbl];
    for (const q of [sideR, sideL]) {
      if (area(q) > -40) continue;
      const mid = lp(q[0], q[2], .5);
      ctx.fillStyle = css(mul(paint, .82)); ctx.beginPath(); polyPath(q)(); ctx.fill();
      // vertical corrugations of the side wall
      ctx.save(); ctx.beginPath(); polyPath(q)(); ctx.clip();
      for (let i = 1; i < 8; i++) { const t = i / 8, a = lp(q[0], q[1], t), b = lp(q[3], q[2], t);
        ctx.strokeStyle = i % 2 ? css(mul(paint, .62)) : css(mul(paint, 1.05)); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      const rg = ctx.createLinearGradient(q[0].x, q[0].y, q[1].x, q[1].y); rg.addColorStop(0, 'rgba(120,52,20,.0)'); rg.addColorStop(.8, 'rgba(120,52,20,.25)'); rg.addColorStop(1, 'rgba(90,40,16,.5)');
      ctx.fillStyle = rg; ctx.fillRect(-2000, -2000, 5000, 6000);
      ctx.restore();
      relight(polyPath(q), lp(q[0], q[3], .5), lp(q[1], q[2], .5), L, .15);
    }
    // roof
    quadImg(T.roof, [btl, btr, ftl, ftr], 22);
    const rc = lp(btl, ftr, .5), [r0, r1] = poolAxis(rc.x, rc.y, L, 120);
    relight(polyPath([btl, btr, ftr, ftl]), r0, r1, L, .75);
    roofLight(c, f, L, P, roofC);
    // door face
    quadImg(T.door, [ftl, ftr, fbl, fbr], 12);
    const dc = lp(ftl, fbr, .5), [d0, d1] = poolAxis(dc.x, dc.y, L, 120);
    relight(polyPath([ftl, ftr, fbr, fbl]), d0, d1, L, -.45);
    doorLight(c, f, L, P, paint);
    if (o.number !== undefined && o.number !== null) roofNumber(c, L, P, String(o.number));
  }

  // per-frame light on the roof: rib facets turned to the bulb, a specular streak on the crests, the lit front edge
  function roofLight(c, f, L, P, roofC) {
    const k = lightAt(c.x, c.y - G.cd * .6, L).k, v = L.violet;
    const side = cl((L.x - c.x) / 160, -1, 1);                     // +1: bulb to the right of the container
    const base = litA(roofC, c.x, c.y - 200, L, .75), hiC = litA(roofC, c.x, c.y - 200, L, 1.15);
    const dl = [Math.max(0, hiC[0] - base[0]), Math.max(0, hiC[1] - base[1]), Math.max(0, hiC[2] - base[2])];
    ctx.save();
    for (let i = 0; i < RIB.n; i++) {
      const u0 = (RIB.x0 + i * ribW) / 100 - 1, uw = ribW / 100;
      // facet facing the bulb brightens, the other one sinks
      const lit1 = side > 0 ? [u0 + uw * .64, u0 + uw * .86] : [u0 + uw * .14, u0 + uw * .36];
      const dim1 = side > 0 ? [u0 + uw * .14, u0 + uw * .36] : [u0 + uw * .64, u0 + uw * .86];
      const q1 = [P(lit1[0], .96, 1), P(lit1[1], .96, 1), P(lit1[1], .05, 1), P(lit1[0], .05, 1)];
      const q2 = [P(dim1[0], .96, 1), P(dim1[1], .96, 1), P(dim1[1], .05, 1), P(dim1[0], .05, 1)];
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = css(mul(dl, 1.6 * Math.abs(side) + .4)); ctx.beginPath(); polyPath(q1)(); ctx.fill();
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${(255 * (1 - .22 * Math.abs(side) * (k + .2))) | 0},${(255 * (1 - .2 * Math.abs(side) * (k + .2))) | 0},${(255 * (1 - .16 * Math.abs(side) * (k + .2))) | 0})`;
      ctx.beginPath(); polyPath(q2)(); ctx.fill();
      // specular: the bulb reflected on each crest — a short bright dash around the reflection depth
      const uc = u0 + uw * (.5 + .12 * side), ux = c.x + uc * 100, spec = Math.exp(-(((ux - L.x) / 130) ** 2)) * L.on * (.2 + .8 * k);
      if (spec > .02) {
        const dS = .74 + .04 * Math.sin(i * 1.7 + c.id), a = P(uc, cl(dS + .2), 1), b = P(uc, cl(dS - .22), 1);
        const gs = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gs.addColorStop(0, 'rgba(255,200,130,0)'); gs.addColorStop(.48, `rgba(255,222,170,${(.48 * spec).toFixed(3)})`); gs.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = gs; ctx.lineWidth = 1.5 * P.gr; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (v > .02) {   // violet light from straight above: even sheen on every crest
        const a = P(u0 + uw * .5, .96, 1), b = P(u0 + uw * .5, .05, 1);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(190,170,255,${(.16 * v).toFixed(3)})`; ctx.lineWidth = 1.4 * P.gr;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // broad soft sheen where the bulb reflects
    const sh = Math.exp(-(((c.x - L.x) / 220) ** 2)) * L.on * (.2 + .8 * k);
    if (sh > .02) {
      const q = P(cl((L.x - c.x) / 100, -.7, .7), .74, 1), r = 90 * P.gr;
      ctx.save(); ctx.beginPath(); polyPath([P(-1, 1, 1), P(1, 1, 1), P(1, 0, 1), P(-1, 0, 1)])(); ctx.clip();
      ctx.translate(q.x, q.y); ctx.scale(1, 1.5); const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      rg.addColorStop(0, `rgba(255,214,160,${(.09 * sh).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,214,160,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.restore();
    }
    // the lit front edge of the roof + the rear edge (thin highlights)
    const fe = .5 * (k + .15) * (1 - v) + .35 * v;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
    let a = P(-1, 0, 1), b = P(1, 0, 1);
    ctx.strokeStyle = `rgba(255,214,160,${(.55 * fe).toFixed(3)})`; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + .6); ctx.lineTo(b.x - 2, b.y + .6); ctx.stroke();
    a = P(-1, 1, 1); b = P(1, 1, 1);
    ctx.strokeStyle = `rgba(255,214,160,${(.35 * fe).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + .5); ctx.lineTo(b.x - 2, b.y + .5); ctx.stroke();
    // side rail highlight on the side facing the bulb
    const su = side > 0 ? .97 : -.97; a = P(su, .98, 1); b = P(su, .03, 1);
    ctx.strokeStyle = `rgba(255,214,160,${(.4 * fe * (.3 + Math.abs(side))).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  // per-frame light on the door face: rods & handle tops catch the bulb, a rim along the bottom of the header
  function doorLight(c, f, L, P, paint) {
    const k = lightAt(c.x, c.y, L).k, v = L.violet, e = .55 * (k + .1) * (1 - v) + .25 * v;
    // occlusion towards the cloth + a little bounce of the wax on the lowest band (fades when lifted)
    const near = 1 - cl((c.z || 0) / 70), top = P(0, 0, 1), bot = P(0, 0, 0);
    ctx.save(); ctx.beginPath(); polyPath([P(-1, 0, 1), P(1, 0, 1), P(1, 0, 0), P(-1, 0, 0)])(); ctx.clip();
    let gr = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
    gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(.55, 'rgb(240,240,244)'); gr.addColorStop(1, `rgb(${(255 - 70 * near) | 0},${(255 - 74 * near) | 0},${(255 - 62 * near) | 0})`);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    const bc = parse(lit('#6A3BE0', c.x, c.y + 30, L, 0)), ba = .22 * near * (k + .3 * v);
    gr = ctx.createLinearGradient(bot.x, bot.y, top.x, top.y); gr.addColorStop(0, css(bc, ba)); gr.addColorStop(.3, css(bc, 0));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.restore();
    if (e < .02) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const side = cl((L.x - c.x) / 160, -1, 1);
    for (const u of [-.992, .992]) {                       // the corner posts' outer edges
      const a = P(u, 0, .98), b = P(u, 0, .04), sideLit = u * side > 0 ? 1 : .45;
      ctx.strokeStyle = `rgba(255,214,160,${(.38 * e * sideLit).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const rx of DOOR.rods) {
      const u = (rx - 100) / 100 + side * .006, a = P(u, 0, (G.ch - 6) / G.ch), b = P(u, 0, 6 / G.ch);
      const gr = ctx.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, `rgba(255,220,170,${(.5 * e).toFixed(3)})`); gr.addColorStop(1, `rgba(255,220,170,${(.12 * e).toFixed(3)})`);
      ctx.strokeStyle = gr; ctx.lineWidth = .9 * P.gr; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const a = P(-1, 0, 1), b = P(1, 0, 1);
    ctx.strokeStyle = `rgba(255,220,170,${(.3 * e).toFixed(3)})`; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + 1.4); ctx.lineTo(b.x - 2, b.y + 1.4); ctx.stroke();
    ctx.restore();
  }
  function roofNumber(c, L, P, s) {
    const a = P(-.3, .75, 1), b = P(.3, .75, 1), d = P(-.3, .25, 1);
    ctx.save(); ctx.setTransform(ctx._P_base);
    ctx.transform((b.x - a.x) / 60, (b.y - a.y) / 60, (d.x - a.x) / 60, (d.y - a.y) / 60, a.x, a.y);
    ctx.font = '800 62px Stencil'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = .8; ctx.fillStyle = lit('#E9E1CF', c.x, c.y - 200, L, .7); ctx.fillText(s, 30, 32);
    ctx.restore();
  }

  // ---------- glass (brand moment) ----------
  // one copy of the canvas per (sub)frame, taken when the first glass is drawn (a canvas drawn onto itself costs a full
  // copy every call). The three slots never overlap, so the table under each glass box is in it.
  let SNAP = null, SNAPK = null;
  function snapshot(f) {
    const cv = ctx.canvas, key = f + '|' + cv.width + 'x' + cv.height;
    if (!SNAP || SNAP.width !== cv.width || SNAP.height !== cv.height) { SNAP = makeCanvas(cv.width, cv.height); SNAPK = null; }
    if (SNAPK !== key) {
      const g = SNAP.getContext('2d'); g.globalCompositeOperation = 'copy'; g.drawImage(cv, 0, 0);
      SNAPK = key;
    }
    return SNAP;
  }
  /** thick-glass refraction: re-draw what is already on the canvas behind `path`, magnified about (cx, cy) and nudged by dy */
  function refract(path, pts, cx, cy, mag, dy, f) {
    const m = ctx.getTransform(), cv = snapshot(f);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const q = m.transformPoint(new DOMPoint(p.x, p.y)); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    x0 = Math.max(0, Math.floor(x0 - 4)); y0 = Math.max(0, Math.floor(y0 - 4)); x1 = Math.min(cv.width, Math.ceil(x1 + 4)); y1 = Math.min(cv.height, Math.ceil(y1 + 4));
    if (x1 - x0 < 4 || y1 - y0 < 4) return;
    const c = m.transformPoint(new DOMPoint(cx, cy));
    ctx.save(); ctx.beginPath(); path(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, c.x + (x0 - c.x) * mag, c.y + (y0 - c.y) * mag + dy * m.d, (x1 - x0) * mag, (y1 - y0) * mag);
    ctx.restore();
  }
  function drawGlass(c, f, L, o, P) {
    const fbl = P(-1, 0, 0), fbr = P(1, 0, 0), ftl = P(-1, 0, 1), ftr = P(1, 0, 1), btl = P(-1, 1, 1), btr = P(1, 1, 1), bbl = P(-1, 1, 0), bbr = P(1, 1, 0);
    const all = [fbl, fbr, ftl, ftr, btl, btr, bbl, bbr], sil = hull(all), silP = polyPath(sil);
    const roofZ = hull([btl, btr, ftl, ftr, bbl, bbr]), door = [ftl, ftr, fbr, fbl];
    const tint = litA([124, 88, 255], c.x, c.y - 150, L, .6), rc = lp(btl, ftr, .5), dc = lp(ftl, fbr, .5);
    // 1. what's behind, bent by the thick glass (roof and door bend it differently: a break at the edge)
    refract(polyPath(roofZ), roofZ, rc.x, rc.y, 1.045, -2, f);
    refract(polyPath(door), door, dc.x, dc.y, 1.07, 3, f);
    ctx.save();
    ctx.beginPath(); silP(); ctx.clip();
    // 2. violet body: absorb (multiply), then the glass's own violet (lit from above: brighter at the top)
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(170,140,240)'; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.globalCompositeOperation = 'source-over';
    let gr = ctx.createLinearGradient(btl.x, btl.y, fbl.x, fbl.y);
    gr.addColorStop(0, css(tint, .42)); gr.addColorStop(.55, css(tint, .26)); gr.addColorStop(.62, css(mul(tint, .85), .34)); gr.addColorStop(1, css(mul(tint, .62), .42));
    ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.globalCompositeOperation = 'lighter';
    gr = ctx.createRadialGradient(rc.x, rc.y - 20, 4, rc.x, rc.y, 150 * P.gr); gr.addColorStop(0, 'rgba(150,110,255,.16)'); gr.addColorStop(1, 'rgba(150,110,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    // 3. hidden edges, seen through the glass
    ctx.strokeStyle = 'rgba(255,170,80,.3)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); for (const [a, b] of [[bbl, bbr], [bbl, btl], [bbr, btr], [bbl, fbl], [bbr, fbr]]) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
    for (const q of [bbl, bbr]) { const rg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 8); rg.addColorStop(0, 'rgba(255,190,110,.45)'); rg.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = rg; ctx.fillRect(q.x - 8, q.y - 8, 16, 16); }
    ctx.restore();
    // 4. what's inside (the caller's content), behind the front panes
    if (o.inside) {
      ctx.save(); if (o.insideClip !== false) { ctx.beginPath(); silP(); ctx.clip(); }
      o.inside(dc.x, dc.y, (fbr.x - fbl.x) * .7, (fbl.y - ftl.y) * .8);
      ctx.restore(); ctx.setTransform(ctx._P_base);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // 5. front panes: the roof catches the light from above; the door pane is thinner, with a fresnel sheen
    ctx.save(); ctx.beginPath(); polyPath([btl, btr, ftr, ftl])(); ctx.clip();
    gr = ctx.createLinearGradient(btl.x, btl.y, ftl.x, ftl.y);
    gr.addColorStop(0, 'rgba(220,204,255,.20)'); gr.addColorStop(.75, 'rgba(160,126,255,.07)'); gr.addColorStop(1, 'rgba(255,206,150,.18)');
    ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.strokeStyle = 'rgba(226,212,255,.11)'; ctx.lineWidth = 1.3 * P.gr;
    for (let i = 0; i <= RIB.n; i++) { const u = (RIB.x0 + i * ribW) / 100 - 1, a = P(u, .97, 1), b = P(u, .04, 1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.beginPath(); polyPath(door)(); ctx.clip();
    gr = ctx.createLinearGradient(ftl.x, ftl.y, fbl.x, fbl.y); gr.addColorStop(0, 'rgba(200,180,255,.14)'); gr.addColorStop(1, 'rgba(120,90,255,.04)');
    ctx.fillStyle = gr; ctx.fillRect(-2000, -2000, 5000, 6000);
    ctx.strokeStyle = 'rgba(226,212,255,.16)'; ctx.lineWidth = 1.5 * P.gr;      // ghost of the locking rods and the door seam
    ctx.beginPath(); for (const rx of DOOR.rods.concat([100])) { const u = (rx - 100) / 100, a = P(u, 0, .94), b = P(u, 0, .06); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
    ctx.strokeStyle = 'rgba(226,212,255,.07)'; ctx.beginPath(); for (const [y0] of DOOR.bands) { const hy = 1 - y0 / G.ch, a = P(-.87, 0, hy), b = P(.87, 0, hy); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
    ctx.restore();
    // 6. inner refraction: a slanted caustic band drifting across + the thickness of the panes (inset rims)
    ctx.save(); ctx.beginPath(); silP(); ctx.clip();
    const ph = ((f * .9 + c.id * 47) % 160) / 160, bx = lp(fbl, fbr, ph).x - 60, top = btl.y, bot = fbl.y;
    gr = ctx.createLinearGradient(bx - 34, 0, bx + 34, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(236,226,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(bx + 26, top); ctx.lineTo(bx + 94, top); ctx.lineTo(bx + 34, bot); ctx.lineTo(bx - 34, bot); ctx.closePath(); ctx.fill();
    ctx.restore();
    const inset = (q, k) => { const m = { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 }; return q.map(p => lp(p, m, k)); };
    ctx.strokeStyle = 'rgba(255,214,170,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); polyPath(inset([btl, btr, ftr, ftl], .05))(); polyPath(inset(door, .07))(); ctx.stroke();
    // 7. glowing amber edges (glow, crisp line, hot core) + the corner castings as glowing knots
    const edges = () => { ctx.beginPath(); silP(); for (const [a, b] of [[ftl, ftr], [ftl, fbl], [ftr, fbr], [ftl, btl], [ftr, btr]]) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } };
    ctx.lineJoin = 'round';
    glowStroke(edges, 1);
    for (const q of [ftl, ftr, fbl, fbr, btl, btr]) {
      const rg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 13); rg.addColorStop(0, 'rgba(255,236,200,.85)'); rg.addColorStop(.25, 'rgba(255,170,70,.45)'); rg.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = rg; ctx.fillRect(q.x - 13, q.y - 13, 26, 26);
    }
    // a spark travelling along the front edges
    const tp = ((f * 1.6 + c.id * 33) % 90) / 90, spk = tp < .5 ? lp(ftl, ftr, tp * 2) : lp(ftr, fbr, (tp - .5) * 2);
    const sg = ctx.createRadialGradient(spk.x, spk.y, 0, spk.x, spk.y, 18); sg.addColorStop(0, 'rgba(255,244,220,.9)'); sg.addColorStop(.3, 'rgba(255,180,80,.35)'); sg.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = sg; ctx.fillRect(spk.x - 18, spk.y - 18, 36, 36);
    ctx.restore();
  }

  function container(c, f, L, o = {}) {
    ctx._P_base = ctx.getTransform();
    const g = cl(o.glass || 0), P = projector(c);
    if (g > 0) snapshot(f);                  // what the glass refracts: the cloth before any of the boxes' own shadows
    if (o.shadow !== false) containerShadow(c, f, L, o);
    if (g <= 0) { drawSteel(c, f, L, o, P); return; }
    if (g >= 1) { drawGlass(c, f, L, o, P); return; }
    // dissolve: the steel melts away left → right behind a noisy, glowing front
    const btl = P(-1, 1, 1), fbl = P(-1, 0, 0), y0 = btl.y - 20, y1 = fbl.y + 10, N = 56, sd = PAL[cid(c)].seed;
    const front = []; for (let i = 0; i <= N; i++) { const t = i / N, y = y0 + (y1 - y0) * t;
      const n = .5 * (fbm(t * 3.2, 3, sd + 55, 3) - .5) + .1 * (vn(t * 26, 5, sd + 56) - .5);
      front.push({ x: c.x + (-1.42 + 2.84 * g + n + .22 * (t - .5)) * 100 * P.gr, y }); }
    ctx.save(); ctx.beginPath(); ctx.moveTo(front[0].x, front[0].y); for (const p of front) ctx.lineTo(p.x, p.y); ctx.lineTo(-500, y1); ctx.lineTo(-500, y0); ctx.closePath(); ctx.clip();
    drawGlass(c, f, L, o, P); ctx.restore(); ctx.setTransform(ctx._P_base);
    ctx.save(); ctx.beginPath(); ctx.moveTo(front[0].x, front[0].y); for (const p of front) ctx.lineTo(p.x, p.y); ctx.lineTo(2000, y1); ctx.lineTo(2000, y0); ctx.closePath(); ctx.clip();
    drawSteel(c, f, L, o, P); ctx.restore(); ctx.setTransform(ctx._P_base);
    // the burning front (clipped to the box)
    const fbr = P(1, 0, 0), ftl = P(-1, 0, 1), ftr = P(1, 0, 1), btr = P(1, 1, 1);
    ctx.save(); ctx.beginPath(); polyPath(hull([btl, btr, ftr, fbr, fbl, ftl, P(-1, 1, 0), P(1, 1, 0)]))(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const env = Math.sin(Math.PI * g);
    glowStroke(() => { ctx.beginPath(); ctx.moveTo(front[0].x, front[0].y); for (const p of front) ctx.lineTo(p.x, p.y); }, 1.6 * env);
    ctx.restore();
  }

  // =============================================================================================
  // THE PARCEL — kraft box, violet ribbon, hand-written label « MA MARCHANDISE »
  // Anchor (same as the animatic / 50_compose): (p.x, p.y) = middle of its footprint; the FRONT bottom edge sits at
  // p.y + PARCEL_FRONT·s. Front face G.pw × G.ph, top face G.pd deep (×s). Near the lens (rise / glass / big hand)
  // the box turns its label to us: the top face flattens, and p.squash presses it flat against the phone glass.
  // =============================================================================================
  const PARCEL_FRONT = 40, PTS = 4;                 // texture px per parcel unit (crisp up to ×3.4 + squash)
  const KRAFT = [198, 156, 108], RIBBON = [118, 56, 238], INK = '#221A33';
  let PTEX = null;
  function kraftPass(g, w, h, seed, o = {}) {
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4, X = i / PTS, Y = j / PTS;
      const m = .93 + .12 * fbm(X * .05, Y * .05, seed, 3) + .08 * (vn(X * 1.4, Y * .35, seed + 3) - .5) + .05 * (hh(i, j, seed + 5) - .5);
      // only the kraft (keep the label and the ribbon clean): kraft-ish pixels are warm and mid-bright
      const isK = d[k] > d[k + 2] + 40 && d[k + 1] > 80 && Math.abs(d[k] - d[k + 1]) < 70 ? 1 : o.all ? .5 : .25;
      const mm = 1 + (m - 1) * isK;
      d[k] *= mm; d[k + 1] *= mm; d[k + 2] *= mm;
    }
    g.putImageData(im, 0, 0);
    // fibres
    for (let i = 0; i < w * h / 900; i++) {
      const x = hh(i, 1, seed + 9) * w, y = hh(i, 2, seed + 9) * h, a = (hh(i, 3, seed + 9) - .5) * .8, l = 3 + hh(i, 4, seed + 9) * 10;
      g.strokeStyle = hh(i, 5, seed + 9) > .5 ? 'rgba(120,80,40,.16)' : 'rgba(240,210,170,.16)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }
  function ribbonV(g, x, y0, y1, w) {             // a vertical satin ribbon band
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, css(mul(RIBBON, .62))); gr.addColorStop(.18, css(RIBBON)); gr.addColorStop(.42, css(mixv(RIBBON, [255, 255, 255], .28)));
    gr.addColorStop(.58, css(mul(RIBBON, 1.05))); gr.addColorStop(.86, css(RIBBON)); gr.addColorStop(1, css(mul(RIBBON, .6)));
    g.fillStyle = gr; g.fillRect(x - w / 2, y0, w, y1 - y0);
    g.fillStyle = 'rgba(30,10,60,.25)'; g.fillRect(x - w / 2 - .6, y0, .6, y1 - y0); g.fillRect(x + w / 2, y0, .6, y1 - y0);
  }
  function ribbonH(g, y, x0, x1, w) {
    const gr = g.createLinearGradient(0, y - w / 2, 0, y + w / 2);
    gr.addColorStop(0, css(mul(RIBBON, .62))); gr.addColorStop(.2, css(RIBBON)); gr.addColorStop(.42, css(mixv(RIBBON, [255, 255, 255], .3)));
    gr.addColorStop(.6, css(mul(RIBBON, 1.05))); gr.addColorStop(.86, css(RIBBON)); gr.addColorStop(1, css(mul(RIBBON, .6)));
    g.fillStyle = gr; g.fillRect(x0, y - w / 2, x1 - x0, w);
    g.fillStyle = 'rgba(30,10,60,.25)'; g.fillRect(x0, y - w / 2 - .6, x1 - x0, .6); g.fillRect(x0, y + w / 2, x1 - x0, .6);
  }
  const RIB_X = 86, RIB_W = 15;
  function buildParcel() {
    const W = G.pw, Hf = G.ph, D = G.pd;
    // ---- front face ----
    const fc = makeCanvas(W * PTS, Hf * PTS), g = fc.getContext('2d');
    g.scale(PTS, PTS);
    g.fillStyle = css(KRAFT); g.fillRect(0, 0, W, Hf);
    let gr = g.createLinearGradient(0, 0, 0, Hf); gr.addColorStop(0, 'rgba(255,236,200,.18)'); gr.addColorStop(.12, 'rgba(255,236,200,0)'); gr.addColorStop(.85, 'rgba(60,30,10,0)'); gr.addColorStop(1, 'rgba(60,30,10,.22)');
    g.fillStyle = gr; g.fillRect(0, 0, W, Hf);
    for (const x0 of [0, W - 5]) { gr = g.createLinearGradient(x0, 0, x0 + 5, 0); gr.addColorStop(x0 ? 0 : 1, 'rgba(70,40,15,0)'); gr.addColorStop(x0 ? 1 : 0, 'rgba(70,40,15,.25)'); g.fillStyle = gr; g.fillRect(x0, 0, 5, Hf); }
    // "this way up" pictogram (no text)
    g.fillStyle = 'rgba(34,26,51,.72)';
    for (const ax of [100, 109]) { g.beginPath(); g.moveTo(ax, 9); g.lineTo(ax + 3.4, 13.5); g.lineTo(ax + 1.2, 13.5); g.lineTo(ax + 1.2, 19); g.lineTo(ax - 1.2, 19); g.lineTo(ax - 1.2, 13.5); g.lineTo(ax - 3.4, 13.5); g.closePath(); g.fill(); }
    g.fillRect(96, 20.5, 17, 1.1);
    kraftPass(g, W * PTS, Hf * PTS, 301);
    g.setTransform(PTS, 0, 0, PTS, 0, 0);
    ribbonV(g, RIB_X, 0, Hf, RIB_W);
    // a little wrinkle in the ribbon
    g.fillStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.moveTo(RIB_X - 7, 40); g.quadraticCurveTo(RIB_X, 37, RIB_X + 7, 41); g.lineTo(RIB_X + 7, 42); g.quadraticCurveTo(RIB_X, 38.5, RIB_X - 7, 41.2); g.fill();
    // the label: cream paper, slightly askew, taped corners, hand-written in marker
    g.save(); g.translate(39, 37); g.rotate(-.045);
    const lw = 66, lh = 48;
    g.fillStyle = 'rgba(40,20,5,.28)'; g.beginPath(); rrectOn(g, -lw / 2 + .8, -lh / 2 + 1.4, lw, lh, 1.6); g.fill();
    gr = g.createLinearGradient(-lw / 2, -lh / 2, lw / 2, lh / 2); gr.addColorStop(0, '#F6F0E2'); gr.addColorStop(1, '#E9DFCB');
    g.fillStyle = gr; g.beginPath(); rrectOn(g, -lw / 2, -lh / 2, lw, lh, 1.6); g.fill();
    g.strokeStyle = 'rgba(120,90,60,.25)'; g.lineWidth = .4; g.stroke();
    // faint ruled lines
    g.strokeStyle = 'rgba(90,110,170,.16)'; g.lineWidth = .35; for (const y of [-6, 12]) { g.beginPath(); g.moveTo(-lw / 2 + 3, y); g.lineTo(lw / 2 - 3, y); g.stroke(); }
    // handwriting, on its own layer (marker texture eats the ink only)
    const ic = makeCanvas(lw * PTS, lh * PTS), ig = ic.getContext('2d'); ig.scale(PTS, PTS); ig.translate(lw / 2, lh / 2);
    ig.fillStyle = INK; ig.textAlign = 'center'; ig.textBaseline = 'alphabetic';
    ig.font = '400 19px CaveatBrush'; let tw = ig.measureText('MARCHANDISE').width; const fs = Math.min(19, 19 * (lw - 7) / tw);
    ig.save(); ig.translate(-1.5, -3.5); ig.rotate(.025); ig.font = `400 ${(fs * 1.45).toFixed(2)}px CaveatBrush`; ig.fillText('MA', 0, 0); ig.restore();
    ig.font = `400 ${fs.toFixed(2)}px CaveatBrush`;
    ig.save(); ig.translate(.5, 13.5); ig.rotate(-.015); ig.fillText('MARCHANDISE', 0, 0); ig.restore();
    tw = ig.measureText('MARCHANDISE').width;
    ig.strokeStyle = INK; ig.lineWidth = 1.1; ig.lineCap = 'round'; ig.beginPath(); ig.moveTo(-tw / 2 + 2, 18); ig.quadraticCurveTo(0, 16.1, tw / 2 - 1, 18.3); ig.stroke();
    ig.setTransform(1, 0, 0, 1, 0, 0); ig.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) { ig.fillStyle = `rgba(0,0,0,${(.15 + .35 * hh(i, 4, 77)).toFixed(2)})`; ig.beginPath(); ig.arc(hh(i, 1, 77) * lw * PTS, hh(i, 2, 77) * lh * PTS, .4 + hh(i, 3, 77) * .9, 0, TAU); ig.fill(); }
    g.drawImage(ic, -lw / 2, -lh / 2, lw, lh);
    // clear tape over two corners
    for (const [x, y, a] of [[-lw / 2 + 2, -lh / 2 + 2, -.7], [lw / 2 - 2, lh / 2 - 2, -.7]]) {
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(255,250,235,.32)'; g.fillRect(-7, -3, 14, 6);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-7, -3, 14, .8); g.restore();
    }
    g.restore();
    // scuffs on the bottom corners
    g.fillStyle = 'rgba(240,215,180,.35)'; for (const x of [1, W - 3]) for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + hh(i, x, 3) * 2, Hf - 1 - hh(i, x, 4) * 5, .5 + hh(i, x, 5), 0, TAU); g.fill(); }
    // ---- top face (v = 0 back, v = D front) ----
    const tc = makeCanvas(W * PTS, D * PTS), t = tc.getContext('2d');
    t.scale(PTS, PTS);
    t.fillStyle = css(mul(KRAFT, 1.04)); t.fillRect(0, 0, W, D);
    // the two flaps meet across the middle; they bulge a little
    for (const [y0, y1] of [[0, D / 2], [D / 2, D]]) { const gg = t.createLinearGradient(0, y0, 0, y1); gg.addColorStop(0, 'rgba(255,238,205,.10)'); gg.addColorStop(.5, 'rgba(255,238,205,.0)'); gg.addColorStop(1, 'rgba(70,40,15,.14)'); t.fillStyle = gg; t.fillRect(0, y0, W, y1 - y0); }
    t.fillStyle = 'rgba(60,32,12,.6)'; t.fillRect(2, D / 2 - .5, W - 4, 1);
    kraftPass(t, W * PTS, D * PTS, 302, { all: true });
    t.setTransform(PTS, 0, 0, PTS, 0, 0);
    // clear tape along the seam
    t.fillStyle = 'rgba(255,246,225,.22)'; t.fillRect(0, D / 2 - 7, W, 14); t.fillStyle = 'rgba(255,255,255,.22)'; t.fillRect(0, D / 2 - 7, W, 1.2);
    // violet ribbon: front-to-back band + a band across, crossing on a crimp seal
    ribbonV(t, RIB_X, 0, D, RIB_W); ribbonH(t, D * .5, 0, W, RIB_W * .9);
    t.fillStyle = 'rgba(20,6,40,.35)'; t.fillRect(RIB_X - 8.5, D / 2 - 6.6, 17, 14.4);
    gr = t.createLinearGradient(0, D / 2 - 7, 0, D / 2 + 7); gr.addColorStop(0, '#B9A6E8'); gr.addColorStop(.45, '#E6DDF8'); gr.addColorStop(1, '#7D6BB4');
    t.fillStyle = gr; t.fillRect(RIB_X - 8, D / 2 - 7, 16, 13.4);
    t.strokeStyle = 'rgba(60,40,110,.6)'; t.lineWidth = .5; for (const x of [-4, 0, 4]) { t.beginPath(); t.moveTo(RIB_X + x, D / 2 - 6.4); t.lineTo(RIB_X + x, D / 2 + 5.8); t.stroke(); }
    // edges of the top: worn lighter rims
    t.strokeStyle = 'rgba(255,236,200,.35)'; t.lineWidth = 1; t.strokeRect(.5, .5, W - 1, D - 1);
    PTEX = { front: fc, top: tc };
    return PTEX;
  }

  function parcel(p, f, L, o = {}) {
    if (!p || !p.vis) return;
    ctx._P_base = ctx.getTransform();
    const T = PTEX || buildParcel();
    const s = p.s || 1, sq = cl(p.squash || 0, 0, .5);
    const near = cl((s - 1) / 2.4);                          // 0 on the table … 1 at the lens
    const W = G.pw * s * (1 + .5 * sq), Hf = G.ph * s * (1 + .22 * sq);
    const Dt = G.pd * s * (1 - .66 * near) * Math.max(.06, 1 - 3.6 * sq);
    const x = p.x, yb = p.y + PARCEL_FRONT * s + .12 * Hf * sq;     // squashed: it spreads around its contact centre
    const z = p.mode === 'slide' ? (1 - s) * 260 : p.mode === 'hand' ? Math.max(0, (s - 1) * 150) : 0;
    // table perspective (back converges towards x = 540), stronger near the lens
    const kd = KD * (G.pd / G.cd) * (1 - near) + .12 * near;
    const bx = VX + (x - VX) * (1 - kd * .4), bw = W * (1 - kd);
    const ftl = { x: x - W / 2, y: yb - Hf }, ftr = { x: x + W / 2, y: yb - Hf }, fbl = { x: x - W / 2, y: yb }, fbr = { x: x + W / 2, y: yb };
    const btl = { x: bx - bw / 2, y: yb - Hf - Dt }, btr = { x: bx + bw / 2, y: yb - Hf - Dt };
    // contact shadow on the cloth
    if (!o.noShadow && (p.mode === 'slide' || p.mode === 'hand' || p.mode === 'under')) {
      const sw = G.pw * s, ty = p.y + PARCEL_FRONT * s, sc = 1 + z * .002;
      castShadowFast(() => { ctx.moveTo(x - sw / 2 * sc, ty); ctx.lineTo(x + sw / 2 * sc, ty); ctx.lineTo(x + sw / 2 * .93 * sc, ty - G.pd * s); ctx.lineTo(x - sw / 2 * .93 * sc, ty - G.pd * s); ctx.closePath(); }, x, ty, z, L, .9);
      const ca = (1 - cl(z / 20)) * .55;
      if (ca > .01) soft(() => ctx.rect(x - sw / 2 - 2, ty - G.pd * s * .5, sw + 4, G.pd * s * .5 + 3), 2, `rgba(6,3,14,${ca.toFixed(3)})`);
    }
    const lx = x, ly = p.mode === 'glass' || p.mode === 'rise' ? Math.max(p.y, 860) : p.y;   // where the light is sampled
    // top face
    if (Dt > .8) {
      quadImg(T.top, [btl, btr, ftl, ftr], 12);
      const [a0, a1] = poolAxis(lx, ly, L, 60 * s);
      relight(polyPath([btl, btr, ftr, ftl]), a0, a1, L, .7);
    }
    // front face (rounded a little when pressed against the glass)
    const rad = Math.min(W, Hf) * (.02 + .25 * sq);
    ctx.save(); ctx.beginPath(); rrect(fbl.x, ftl.y, W, Hf, rad); ctx.clip();
    ctx.drawImage(T.front, fbl.x, ftl.y, W, Hf);
    const [b0, b1] = poolAxis(lx, ly, L, 60 * s);
    relight(() => rrect(fbl.x, ftl.y, W, Hf, rad), b0, b1, L, -.15 + .25 * near);
    if (sq > .005) {
      // pressed flat on the glass: the contact patch is flatter and paler, the rim rolls away into shadow
      const cx = x, cy = yb - Hf * .5, rr = Math.max(W, Hf) * .62;
      ctx.translate(cx, cy); ctx.scale(1, Hf / W);
      let rg = ctx.createRadialGradient(0, 0, rr * .2, 0, 0, rr);
      rg.addColorStop(0, `rgba(255,240,215,${(.5 * sq).toFixed(3)})`); rg.addColorStop(.7, `rgba(255,240,215,${(.2 * sq).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(-rr, -rr, 2 * rr, 2 * rr);
      rg = ctx.createRadialGradient(0, 0, rr * .62, 0, 0, rr * 1.0); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.55, `rgb(255,${(255 * (1 - .4 * sq)) | 0},${(255 * (1 - .6 * sq)) | 0})`);
      rg.addColorStop(1, `rgb(${(255 * (1 - 3.6 * sq)) | 0},${(255 * (1 - 3.9 * sq)) | 0},${(255 * (1 - 3.4 * sq)) | 0})`);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rg; ctx.fillRect(-rr * 1.2, -rr * 1.2, 2.4 * rr, 2.4 * rr);
      // the fold where the face leaves the glass: a thin bright rim just inside the dark roll-off
      ctx.setTransform(ctx._P_base); ctx.globalCompositeOperation = 'lighter';
      soft(() => { ctx.moveTo(fbl.x + W * .08, ftl.y + Hf * .06); ctx.lineTo(fbr.x - W * .08, ftl.y + Hf * .06); }, 3, `rgba(255,236,200,${(.35 * sq).toFixed(3)})`, true, 3);
    }
    ctx.restore(); ctx.setTransform(ctx._P_base);
    // edges: the top/front fold catches the light; a thin dark outline grounds the box
    const e = lightAt(lx, ly, L).k;
    ctx.save(); ctx.lineJoin = 'round';
    if (Dt > .8) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,226,180,${(.35 * (e + .2)).toFixed(3)})`; ctx.lineWidth = 1 + .6 * near; ctx.beginPath(); ctx.moveTo(ftl.x + 2, ftl.y + .5); ctx.lineTo(ftr.x - 2, ftr.y + .5); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(30,16,8,.45)'; ctx.lineWidth = .8 + .8 * near;
    ctx.beginPath(); if (Dt > .8) { ctx.moveTo(ftl.x, ftl.y); ctx.lineTo(btl.x, btl.y); ctx.lineTo(btr.x, btr.y); ctx.lineTo(ftr.x, ftr.y); } rrect(fbl.x, ftl.y, W, Hf, rad); ctx.stroke();
    ctx.restore();
  }

  // =============================================================================================
  // RING GLINT — 4-branch star + additive halo (k 0..1, peak at 1)
  // =============================================================================================
  function glint(x, y, k) {
    k = cl(k); if (k <= .001) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = 50 + 150 * k;
    let rg = ctx.createRadialGradient(x, y, 0, x, y, R);
    rg.addColorStop(0, `rgba(255,246,220,${(.95 * k).toFixed(3)})`); rg.addColorStop(.08, `rgba(255,214,140,${(.6 * k).toFixed(3)})`);
    rg.addColorStop(.3, `rgba(255,170,70,${(.2 * k).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    // anamorphic streak
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .045);
    rg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.4); rg.addColorStop(0, `rgba(255,220,170,${(.55 * k).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = rg; ctx.fillRect(-R * 2.4, -R * 2.4, R * 4.8, R * 4.8); ctx.restore();
    // rays
    const rot = -.21 + .08 * k;
    const ray = (a, len, w0, al) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, `rgba(255,250,235,${al.toFixed(3)})`); lg.addColorStop(.25, `rgba(255,222,160,${(al * .7).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, -w0); ctx.quadraticCurveTo(len * .2, -w0 * .25, len, 0); ctx.quadraticCurveTo(len * .2, w0 * .25, 0, w0); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    const L1 = 70 + 280 * k;
    for (let i = 0; i < 4; i++) ray(rot + i * Math.PI / 2, L1 * (i % 2 ? .82 : 1), 2.2 + 4 * k, k);
    for (let i = 0; i < 4; i++) ray(rot + Math.PI / 4 + i * Math.PI / 2, L1 * .3, 1.4 + 2 * k, .7 * k);
    // hot core
    rg = ctx.createRadialGradient(x, y, 0, x, y, 7 + 9 * k); rg.addColorStop(0, `rgba(255,255,255,${k.toFixed(3)})`); rg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - 20, y - 20, 40, 40);
    // a few sparks thrown off
    for (let i = 0; i < 7; i++) {
      const a = hh(i, 1, 900) * TAU, d = (24 + 70 * hh(i, 2, 900)) * (.4 + .9 * k), r = 1.2 + 1.8 * hh(i, 3, 900);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      rg = ctx.createRadialGradient(px, py, 0, px, py, r * 3); rg.addColorStop(0, `rgba(255,236,200,${(.8 * k).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = rg; ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }

  // =============================================================================================
  // DUST PUFF — breath of dust off the cloth when the empty « 2 » is lifted (k 0..1 = life of the puff)
  // =============================================================================================
  function dust(x, y, k, L) {
    // (x, y) = middle of the footprint the box just left (as 50_compose passes it); the dust spills out of the
    // footprint's front and sides — under the lifted box it stays hidden by the box itself, so nothing is drawn there
    k = cl(k); if (k <= 0 || k >= 1) return;
    L = L || S.light(Math.round(k * 26 + 302));
    const y0 = y + G.cd * .45, grow = 1 - Math.pow(1 - k, 2.4), fade = Math.pow(1 - k, 1.2) * cl(k * 12);
    ctx.save();
    for (let i = 0; i < 20; i++) {
      const a = (-.12 + 1.24 * (i + .5) / 20) * Math.PI + (hh(i, 1, 51) - .5) * .18;          // 0 = right, π/2 = towards us
      const sp = .55 + .6 * hh(i, 2, 51), ca = Math.cos(a), sa = Math.sin(a);
      const px = x + ca * (G.cw * .5 + 6 + 60 * sp * grow), py = y0 - 36 * (1 - Math.max(0, sa)) + sa * (8 + 34 * sp * grow) - 16 * grow * hh(i, 3, 51);
      const rad = 12 + 24 * grow * (.6 + .6 * hh(i, 4, 51)), al = .36 * fade * (.55 + .45 * hh(i, 5, 51));
      const col = parse(lit('#DCCBB0', px, py, L, .4));
      const rg = ctx.createRadialGradient(px, py - rad * .15, 0, px, py, rad);
      rg.addColorStop(0, css(mixv(col, [255, 255, 255], .08), al)); rg.addColorStop(.55, css(col, al * .55)); rg.addColorStop(1, css(col, 0));
      ctx.fillStyle = rg; ctx.fillRect(px - rad, py - rad, 2 * rad, 2 * rad);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {                                    // specks catching the bulb
      const a = (-.15 + 1.3 * hh(i, 11, 52)) * Math.PI, d = G.cw * .5 + 10 + 80 * hh(i, 12, 52) * grow + 20 * grow;
      const px = x + Math.cos(a) * d, py = y0 - 30 * (1 - Math.max(0, Math.sin(a))) + Math.sin(a) * d * .35 - 50 * grow * hh(i, 13, 52);
      const tw = .5 + .5 * Math.sin(k * 30 + i * 2.1), al = .75 * fade * tw * (.4 + .6 * hh(i, 14, 52));
      const col = parse(lit('#FFE8C4', px, py, L, 1)), sz = 1.2 + 1.4 * hh(i, 15, 52);
      ctx.fillStyle = css(col, al); ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.restore();
  }

  // =============================================================================================
  // 1 · 2 · 3 painted on the cloth in front of the slots (spray-stencil paint, worn); `on` lights them up
  // =============================================================================================
  let NUMS = null, NTMP = null, NHOT = null, NGLOW = null;
  function buildNums() {
    NUMS = ['1', '2', '3'].map((n, i) => {
      const w = 220, h = 220, c = makeCanvas(w, h), g = c.getContext('2d');
      g.translate(w / 2, h / 2);
      // hand-painted ring (brush, uneven, left open)
      g.strokeStyle = '#fff'; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        g.lineWidth = 7 - k * 1.6; g.globalAlpha = .55 + k * .15;
        g.beginPath(); const a0 = -1.2 + i * .7 + k * .05, a1 = a0 + TAU - .5 - k * .1;
        for (let a = a0; a <= a1; a += .05) { const r = 78 + 3 * Math.sin(a * 3 + i) + k * 1.5 * Math.sin(a * 7); const px = Math.cos(a) * r, py = Math.sin(a) * r; a === a0 ? g.moveTo(px, py) : g.lineTo(px, py); }
        g.stroke();
      }
      g.globalAlpha = 1;
      // overspray halo of the stencil
      g.filter = 'blur(5px)'; g.globalAlpha = .28; g.fillStyle = '#fff'; g.font = '800 132px Stencil'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 6);
      g.filter = 'none'; g.globalAlpha = 1; g.fillText(n, 0, 6);
      // dry paint: eaten by the weave
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out';
      const im = g.getImageData(0, 0, w, h), d = im.data;
      for (let j = 0; j < h; j++) for (let ii = 0; ii < w; ii++) {
        const kx = (j * w + ii) * 4, nz = .55 * fbm(ii * .06, j * .06, 600 + i, 3) + .3 * vn(ii * .5, j * .5, 610 + i) + .15 * ((ii + j) % 4 < 2 ? 1 : 0);
        d[kx + 3] *= cl(1.25 - nz * 1.1);
      }
      g.globalCompositeOperation = 'source-over'; g.putImageData(im, 0, 0);
      return c;
    });
    NTMP = [0, 1, 2].map(() => makeCanvas(220, 220));
    // emissive versions, baked once: hot cream glyph + amber bloom
    NHOT = NUMS.map(m => { const c = makeCanvas(220, 220), g = c.getContext('2d'); g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#FFE7B8'; g.fillRect(0, 0, 220, 220); return c; });
    NGLOW = NUMS.map(m => { const t = makeCanvas(220, 220), tg = t.getContext('2d'); tg.drawImage(m, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#FFA31A'; tg.fillRect(0, 0, 220, 220);
      const c = makeCanvas(220, 220), g = c.getContext('2d'); g.filter = 'blur(9px)'; g.drawImage(t, 0, 0); g.filter = 'blur(3px)'; g.globalAlpha = .6; g.drawImage(t, 0, 0); return c; });
  }
  function tableNumbers(f, L, on) {
    if (!NUMS) buildNums();
    on = cl(on || 0);
    for (let i = 0; i < 3; i++) {
      const tg = NTMP[i].getContext('2d');
      const x = G.slotX[i], y = G.tableY + 60, oi = cl((on - i * .12) / .76), e = oi * oi * (3 - 2 * oi);
      const paint = lit('#E6DAC2', x, y, L, 0);
      const fl = e > 0 && e < 1 ? .85 + .15 * Math.sin(f * 2.7 + i * 2) : 1;     // a little flicker while it ignites
      ctx.save(); ctx.translate(x, y); ctx.rotate([-.05, .03, -.02][i]); ctx.scale(.54, .54 * .68);
      // the worn paint, lit like the cloth
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, 220, 220); tg.drawImage(NUMS[i], 0, 0);
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = paint; tg.fillRect(0, 0, 220, 220);
      ctx.globalAlpha = .62 + .3 * e; ctx.drawImage(NTMP[i], -110, -110);
      if (e > 0) {
        // lit up: warm emissive paint + bloom on the cloth
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .85 * e * fl; ctx.drawImage(NHOT[i], -110, -110);
        ctx.globalAlpha = .9 * e * fl; ctx.drawImage(NGLOW[i], -110, -110);
        const rg = ctx.createRadialGradient(0, 0, 10, 0, 0, 150); rg.addColorStop(0, `rgba(255,163,26,${(.28 * e * fl).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = rg; ctx.fillRect(-150, -150, 300, 300);
      }
      ctx.restore();
    }
  }

  return { container, containerShadow, parcel, glint, dust, tableNumbers, projector, hull, tex, ab, relight, quadImg, polyPath, litA, hh, vn, fbm, cl, css, mixv, mul, hex, sstep, lp, poolAxis };
})();

function P_container(c, f, L, o) { return P_K.container(c, f, L, o || {}); }
function P_containerShadow(c, f, L, o) { const b = ctx.getTransform(); ctx._P_base = b; P_K.containerShadow(c, f, L, o || {}); ctx.setTransform(b); }
function P_parcel(p, f, L, o) { return P_K.parcel(p, f, L, o || {}); }
function P_glint(x, y, k) { return P_K.glint(x, y, k); }
function P_dust(x, y, k, L) { return P_K.dust(x, y, k, L); }
function P_tableNumbers(f, L, on) { return P_K.tableNumbers(f, L, on); }
