'use strict';
// =============================================================================================
// H — GLOVES & SLEEVES of « Le Bonneteau du Feyman »: the feyman's two white 1930s cartoon gloves (rubber-hose era:
// chunky 4-finger glove, rolled cuff, living ink line, soft gouache shading, gold signet ring on L) coming out of
// wax-print sleeves (bottle green · mustard · black — never the brand colours) that hang from off-frame shoulders.
// Functions only (no registerScene). Reads SCORE (01_score.js) and the light API (02_light.js).
//
//   H_arm(side, h, f, L, o)        side 'L' | 'R'; h = SCORE.hand(side, f); o = {bump 0..1 (square parcel bulge in the R
//                                  sleeve), ribbon 0..1 (violet ribbon end out of the R cuff), flinch 0..1 (optional pull-up)}
//   H_armShadow(side, h, f, L, o)  shadow of sleeve + glove on the cloth (call BEFORE the props). Pass the R arm's {bump}
//                                  too, so the parcel's square bump also shows in the sleeve's shadow.
//   H_holdFront(h, f, L)           pose 'hold' with the parcel near the lens ('rise' / 'glass'): the right hand is BEHIND the
//                                  box (H_arm draws it, P_parcel covers it); this draws only the fingers that come over the
//                                  box's top edge, clipped to the box — call it right after P_parcel.
//   H_ringPos(h, f)                {x, y} of the gold signet on the L glove, same space as h — use it for P_glint.
//
// The glove is parametric: palm + thumb + 3 fingers, each finger = two tapered capsules (proximal / distal phalanx) with
// a yaw (spread) and a projected length (curl under / raise / curl toward the palm). A pose is a set of those numbers
// (posePar); tap, count, flourish, slide, wave, beckon animate inside the pose from f. Pose switches (SCORE: h.k = .5)
// are bridged by a ~1.7-frame blend + a stretch along the motion (the smear frame); fast moves stretch a little too.
// During the steal (f 207-218) the R hand always shows the 'slide' thumb (the score keys it 'grip' from 212).
//
// Speed (this headless Chromium raster: gradients and rotated patterns are the costly ops, ctx.filter ~25 ms a call):
// the arm end (roll + contact shadow + glove + ribbon) is rigid within a frame, so it is rendered ONCE per frame into a
// 1.25× sprite and placed with each motion-blur sub-frame's forearm matrix; the sleeve is drawn per sub-frame (rotated
// wax strips only on its lit lower part). Measured in the real render (MB 6): ~8 ms per sub-frame for both arms +
// shadows. H_K.dbg.direct = 1 draws without the sprite (debug).
// =============================================================================================
const H_K = (function () {
  const S = window.SCORE, G = S.G, TAU = Math.PI * 2, DEG = 180 / Math.PI;
  const INK = '#1A1426';
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const parse = s => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
  const css = (c, a) => a === undefined ? `rgb(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0})`
    : `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${cl(a).toFixed(3)})`;
  const litc = (hex, x, y, L, b) => parse(lit(hex, x, y, L, b));
  const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const hex = a => '#' + a.map(v => (cl(Math.round(v), 0, 255) | 0).toString(16).padStart(2, '0')).join('');
  function hh(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function pvn(x, y, s, P) {            // periodic value noise (lattice period P)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = q => ((q % P) + P) % P;
    const a = hh(m(xi), m(yi), s), b = hh(m(xi + 1), m(yi), s), c = hh(m(xi), m(yi + 1), s), d = hh(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const wob = (f, k, ph) => Math.sin(TAU * f * k / 480 + ph);            // periodic over the loop (k integer)

  // ======================= soft shapes WITHOUT ctx.filter: only the blurred shadow of the shape is drawn =======================
  const dbg = {};
  function soft(pathFn, blur, color, ox = 0, oy = 0, stroke = 0) {
    if (dbg.noSoft) return;
    const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 1e-9) return;
    const sc = Math.sqrt(Math.abs(det)), push = ctx.canvas.width + 700 + 6 * blur * sc;
    const ux = (m.d * push) / det, uy = (-m.b * push) / det;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc);
    ctx.shadowOffsetX = -push + m.a * ox + m.c * oy; ctx.shadowOffsetY = m.b * ox + m.d * oy;
    ctx.translate(ux, uy); ctx.beginPath(); pathFn();
    if (stroke) { ctx.lineWidth = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); }
    else { ctx.fillStyle = '#000'; ctx.fill(); }
    ctx.restore();
  }
  /** tapered ink stroke along a quadratic curve a → b (control c): width 0 at the ends, w in the middle */
  function taper(ax, ay, cx, cy, bx, by, w, color) { ctx.beginPath(); taperPath(ax, ay, cx, cy, bx, by, w); ctx.fillStyle = color; ctx.fill(); }
  /** batch: everything drawn by fn with taperPath / ellipses becomes ONE fill (draw calls are what costs here) */
  function batch(color, fn) { ctx.beginPath(); fn(); ctx.fillStyle = color; ctx.fill(); }
  function taperPath(ax, ay, cx, cy, bx, by, w) {
    const N = 8, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, it = 1 - t;
      const x = it * it * ax + 2 * it * t * cx + t * t * bx, y = it * it * ay + 2 * it * t * cy + t * t * by;
      let tx = 2 * it * (cx - ax) + 2 * t * (bx - cx), ty = 2 * it * (cy - ay) + 2 * t * (by - cy); const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      const ww = w * .5 * Math.pow(Math.sin(Math.PI * (.08 + .84 * t)), .8);
      L.push([x - ty * ww, y + tx * ww]); R.push([x + ty * ww, y - tx * ww]);
    }
    ctx.moveTo(L[0][0], L[0][1]);
    for (const p of L) ctx.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  /** tapered capsule (two circles + outer tangents), CLOCKWISE on screen (all glove parts share the winding: union fills/clips) */
  function capsule(x0, y0, r0, x1, y1, r1) {
    const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy);
    if (D < Math.abs(r0 - r1) + .05) { const big = r0 >= r1, r = big ? r0 : r1, x = big ? x0 : x1, y = big ? y0 : y1; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); ctx.closePath(); return; }
    const th = Math.atan2(dy, dx), ph = Math.acos(cl((r0 - r1) / D, -1, 1));
    ctx.moveTo(x1 + r1 * Math.cos(th - ph), y1 + r1 * Math.sin(th - ph));
    ctx.arc(x1, y1, r1, th - ph, th + ph);
    ctx.arc(x0, y0, r0, th + ph, th - ph + TAU);
    ctx.closePath();
  }

  // ======================= textures (built once, deterministic) =======================
  let WAX = null, GOU = null;
  /** wax print « bulles »: mustard rings of several sizes (black inner ring, green eye, black pupil, off-register), black seeds,
   *  a few black leaves, uneven dye and the wax crackle. Tile 128 × 128 units at 4 px / unit, seamless; texture y runs along the sleeve. */
  function waxTex() {
    if (WAX) return WAX;
    const U = 128, K = 4, cv = makeCanvas(U * K, U * K), g = cv.getContext('2d');
    g.setTransform(K, 0, 0, K, 0, 0);
    const GREEN = [27, 72, 50], MUST = '#CBA53B', MUST_D = '#9E7C25', BLACK = '#100E0E';
    g.fillStyle = css(GREEN); g.fillRect(0, 0, U, U);
    const wrap = fn => { for (const ox of [-U, 0, U]) for (const oy of [-U, 0, U]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    // dye unevenness first (under the print)
    for (let b2 = 0; b2 < 14; b2++) {
      const x = hh(b2, 1, 41) * U, y = hh(b2, 2, 41) * U, r = 12 + 26 * hh(b2, 3, 41), dark = hh(b2, 4, 41) > .4;
      wrap(() => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, dark ? 'rgba(0,10,4,.28)' : 'rgba(90,140,90,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); });
    }
    // bubbles: dart-throwing with toroidal distance (deterministic)
    const B = [], dist = (a, b) => { let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); dx = Math.min(dx, U - dx); dy = Math.min(dy, U - dy); return Math.hypot(dx, dy); };
    for (const [r, n] of [[15, 5], [11, 7], [8, 9], [5.5, 14]]) {
      let placed = 0;
      for (let t = 0; t < 400 && placed < n; t++) {
        const c = { x: hh(t, r * 10, 91) * U, y: hh(t, r * 10 + 1, 91) * U, r };
        if (B.every(q => dist(q, c) > q.r + c.r + 3.5)) { B.push(c); placed++; }
      }
    }
    for (const c of B) {
      const k = hh(Math.round(c.x * 7), Math.round(c.y * 7), 5), dark = c.r < 12 && k > .72;
      wrap(() => {
        g.fillStyle = dark ? BLACK : MUST; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill();
        if (!dark) {
          g.strokeStyle = MUST_D; g.lineWidth = .7; g.beginPath(); g.arc(c.x, c.y, c.r - .5, 0, TAU); g.stroke();
          g.strokeStyle = BLACK; g.lineWidth = Math.max(1.2, c.r * .16); g.beginPath(); g.arc(c.x + .5, c.y + .4, c.r * .66, 0, TAU); g.stroke();
          g.fillStyle = css(GREEN); g.beginPath(); g.arc(c.x + .5, c.y + .4, c.r * .44, 0, TAU); g.fill();
          g.fillStyle = BLACK; g.beginPath(); g.arc(c.x + .5, c.y + .4, c.r * .2, 0, TAU); g.fill();
          if (c.r > 10) { g.fillStyle = MUST; g.beginPath(); g.arc(c.x + .5, c.y + .4, c.r * .08, 0, TAU); g.fill(); }
        } else { g.fillStyle = MUST; g.beginPath(); g.arc(c.x, c.y, c.r * .32, 0, TAU); g.fill(); }
      });
    }
    // seeds and leaves in the gaps
    for (let t = 0, n = 0; t < 900 && n < 70; t++) {
      const c = { x: hh(t, 3, 17) * U, y: hh(t, 4, 17) * U, r: 1.1 + 1.2 * hh(t, 5, 17) };
      if (B.every(q => dist(q, c) > q.r + 2.5)) { n++; wrap(() => { g.fillStyle = hh(t, 6, 17) > .8 ? MUST : BLACK; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill(); }); }
    }
    for (let t = 0, n = 0; t < 600 && n < 9; t++) {
      const c = { x: hh(t, 7, 23) * U, y: hh(t, 8, 23) * U, r: 6 }, a = hh(t, 9, 23) * TAU;
      if (B.every(q => dist(q, c) > q.r + 6.5)) { n++; wrap(() => {
        g.save(); g.translate(c.x, c.y); g.rotate(a); g.fillStyle = BLACK;
        g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(0, -4.2, 7, 0); g.quadraticCurveTo(0, 4.2, -7, 0); g.fill();
        g.strokeStyle = MUST_D; g.lineWidth = .6; g.beginPath(); g.moveTo(-5.5, 0); g.lineTo(5.5, 0); g.stroke(); g.restore();
      }); }
    }
    // the wax crackle: fine dark veins over everything
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let v = 0; v < 34; v++) {
      let x = hh(v, 1, 77) * U, y = hh(v, 2, 77) * U, a = hh(v, 3, 77) * TAU; const pts = [[x, y]];
      for (let k = 0; k < 9; k++) { a += (hh(v, k + 10, 77) - .5) * 1.3; x += Math.cos(a) * 4.5; y += Math.sin(a) * 4.5; pts.push([x, y]); }
      const w = .3 + .4 * hh(v, 5, 77), al = .18 + .22 * hh(v, 6, 77);
      wrap(() => { g.strokeStyle = `rgba(6,8,6,${al.toFixed(2)})`; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); });
    }
    // weave
    g.globalAlpha = .05; g.fillStyle = '#000';
    for (let y = 0; y < U; y += 1.25) g.fillRect(0, y, U, .45);
    g.fillStyle = '#fff'; g.globalAlpha = .025; for (let x = 0; x < U; x += 1.25) g.fillRect(x, 0, .45, U);
    g.globalAlpha = 1;
    const pat = ctx.createPattern(cv, 'repeat'); pat.setTransform(new DOMMatrix().scaleSelf(1 / K, 1 / K));
    const k2 = 1.25, c2 = makeCanvas(U * k2, U * k2), g2 = c2.getContext('2d');
    g2.imageSmoothingQuality = 'high'; g2.drawImage(cv, 0, 0, U * k2, U * k2);
    // the round hose baked in: across the tile (one tile width = one hose width) the flanks turn away and darken
    const shaded = (src, kk) => {
      const c = makeCanvas(U * kk, U * kk), g3 = c.getContext('2d'); g3.drawImage(src, 0, 0, U * kk, U * kk);
      const gr = g3.createLinearGradient(0, 0, U * kk, 0);
      for (let i = 0; i <= 16; i++) { const t = i / 16, d = Math.pow(Math.abs(2 * t - 1), 2.3); gr.addColorStop(t, `rgba(3,2,8,${(.62 * d).toFixed(3)})`); }
      g3.fillStyle = gr; g3.fillRect(0, 0, U * kk, U * kk);
      const pt = ctx.createPattern(c, 'repeat'); pt.setTransform(new DOMMatrix().scaleSelf(1 / kk, 1 / kk)); return pt;
    };
    WAX = { cv, c2, pat: shaded(c2, k2), patHi: shaded(cv, K), U };
    return WAX;
  }
  /** gouache: soft paint blotches + fine tooth, multiplied at low alpha over the glove (anchored to the hand) */
  function gouTex() {
    if (GOU) return GOU;
    const N = 160, cv = makeCanvas(N, N), g = cv.getContext('2d'), im = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const n = .55 * pvn(i / 20, j / 20, 7, 8) + .3 * pvn(i / 8, j / 8, 11, 20) + .15 * hh(i, j, 5);
      const v = 255 - 60 * n, k = (j * N + i) * 4;
      im.data[k] = v; im.data[k + 1] = v - 3 * n; im.data[k + 2] = v + 4 * n; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    GOU = { cv, pat: ctx.createPattern(cv, 'repeat') };
    return GOU;
  }

  // ======================= the glove: dimensions (px at scale 1) =======================
  // R-canonical local frame: wrist at (0,0), +y towards the fingertips, thumb on −x (the L glove and palm-up views are mirrors)
  const FB = [{ x: -21.5, y: 51 }, { x: 0, y: 55 }, { x: 21.5, y: 51 }];   // finger bases: index, middle, ring
  const FL1 = [29, 32, 28], FL2 = [26, 29, 24.5], FR = [12.6, 13.1, 12.4];
  const TB = { x: -27, y: 21 }, TL1 = 22, TL2 = 19.5, TR = 13.6;
  const HOFF = -15, HS = 1.24;   // the hand's wrist joint sits a little up the cuff; the hand is drawn 10 % larger than its units
  const OPEN = 69;            // sleeve opening centre behind the wrist along the forearm (= |cuffOf − wrist| at s = 1)
  const ROLL = { A: 60, B: 23, a: 43, b: 14.5 };   // sleeve roll: outer / hole semi-axes (across, along the arm)
  const RETRACT = 205;
  const HERO = .5;          // the gloves and the sleeve ends are up in the air, nearer the bulb than the cloth: half-way to the pool's light        // how far the glove slides back into the sleeve at cuffIn = 1

  function palmPath(fy, noDisc) {     // clockwise; + a wrist disc so a bent wrist never shows a notch
    const Y = v => v * fy;
    ctx.moveTo(-26, Y(-2));
    ctx.bezierCurveTo(-11, Y(-9), 11, Y(-9), 26, Y(-2));
    ctx.bezierCurveTo(31, Y(4), 37.5, Y(14), 38.5, Y(28));
    ctx.bezierCurveTo(39.5, Y(41), 37, Y(53), 31.5, Y(59));
    ctx.bezierCurveTo(18, Y(68), -18, Y(68), -31.5, Y(59));
    ctx.bezierCurveTo(-37.5, Y(54), -40.5, Y(44), -40.5, Y(30));
    ctx.bezierCurveTo(-40.5, Y(16), -31, Y(7), -26, Y(-2));
    ctx.closePath();
    if (!noDisc) { ctx.moveTo(27, 12); ctx.ellipse(0, 12, 27, 16, 0, 0, TAU); ctx.closePath(); }   // fills the wrist when the hand bends, never shows above the seam
  }
  function cuffPath() {        // glove cuff (forearm frame): flares from the wrist into the sleeve; clockwise
    ctx.moveTo(-28, -4);
    ctx.bezierCurveTo(-30, -20, -36, -36, -43, -50);
    ctx.lineTo(-44.5, -72); ctx.lineTo(44.5, -72); ctx.lineTo(43, -50);
    ctx.bezierCurveTo(36, -36, 30, -20, 28, -4);
    ctx.bezierCurveTo(10, 0, -10, 0, -28, -4);
    ctx.closePath();
  }
  const RIMC = { y: -57, A: 43, B: 8, h: 7.4 };   // the glove's rolled cuff: a band round the cuff (forearm frame)
  function rimArc(off) { const { y, A, B } = RIMC, pts = []; for (let i = 0; i <= 20; i++) { const t = Math.PI * i / 20; let nx = Math.cos(t) * B, ny = Math.sin(t) * A; const nl = Math.hypot(nx, ny) || 1; pts.push([Math.cos(t) * A + nx / nl * off, y + Math.sin(t) * B + ny / nl * off]); } return pts; }
  function rimPath() {
    const { y, A, h } = RIMC, out = rimArc(h), inn = rimArc(-h);
    ctx.moveTo(out[0][0], out[0][1]); for (const q of out) ctx.lineTo(q[0], q[1]);
    ctx.arc(-A, y, h, Math.PI, TAU);
    for (let i = inn.length - 1; i >= 0; i--) ctx.lineTo(inn[i][0], inn[i][1]);
    ctx.arc(A, y, h, Math.PI, TAU);
    ctx.closePath();
  }

  // ======================= poses =======================
  const spec = o => Object.assign({ yaw: 0, yaw2: 0, F1: 1, F2: 1, sh1: 0, sh2: 0, crease: 0, cp: 0, w: 1, tipW: 1, lift: 0, layer: 0 }, o || {});
  const proj = p => p >= 0 ? Math.cos(p) - .5 * Math.sin(p) : Math.cos(p) + .25 * Math.sin(-p);   // readable fore-shortening
  /** back view, curl under (c 0 flat … 1 fist) */
  const Fb = (yaw, c, o) => { const p1 = -c * 1.45, p2 = -c * 1.62; return spec(Object.assign({ yaw, F1: proj(p1), F2: proj(p1 + p2), sh1: -.32 * c, sh2: -.55 * c, crease: sstep(.12, .45, c), w: 1 + .05 * c }, o)); };
  /** back view, finger raised towards the camera (u 0 … 1) */
  const Fr = (yaw, u, o) => { const p = u * .82; return spec(Object.assign({ yaw, F1: proj(p), F2: proj(p * 1.1), sh1: .25 * u, sh2: .45 * u, tipW: 1 + .24 * u, w: 1 + .06 * u, lift: u }, o)); };
  /** palm view, curl towards the palm / the camera (c 0 … 1 fist) */
  const Fp = (yaw, c, o) => { const p1 = c * 1.4, p2 = c * 1.65, F1 = proj(p1), F2 = proj(p1 + p2); return spec(Object.assign({ yaw, F1, F2, sh1: F1 < 0 ? .1 : -.2 * c, sh2: F2 < 0 ? .16 : -.28 * c, crease: sstep(.05, .3, c), tipW: 1 + .1 * Math.min(1, c * 2) }, o)); };
  /** straight, presented */
  const Fs = (yaw, o) => spec(Object.assign({ yaw, F1: 1.02, F2: 1, sh1: .03, sh2: .05, crease: .1 }, o));
  const thumb = o => spec(Object.assign({ yaw: -.8, yaw2: .22, F1: .96, F2: .92, sh1: -.04, sh2: -.04, layer: 0 }, o));
  const keyed = (f, K) => {   // piecewise, eased: K = [[f, v], ...]
    if (f <= K[0][0]) return K[0][1]; if (f >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (K[i + 1][0] < f) i++;
    const [f0, v0] = K[i], [f1, v1] = K[i + 1], t = (f - f0) / (f1 - f0);
    return mix(v0, v1, v1 < v0 ? t * t : 1 - (1 - t) * (1 - t));     // strikes accelerate, rises decelerate
  };
  const TAPK = [[36, 0], [40, .9], [43.7, 1], [45, 0], [46.4, 0], [48.6, .85], [51.3, .95], [52, 0], [53.6, 0], [56.5, .45], [60, .35], [64, 0]];
  const TAPS = [45, 52];

  function posePar(name, side, f, h) {
    const P = { name, bend: 0, fy: 1, palmUp: 0, z: 0, align: .35, sc: 1, dx: 0, f: null, t: thumb(), fx: {} };
    const br = .035 * wob(f, 16, side === 'L' ? 0 : 2);          // idle breathing of the fingers
    switch (name) {
      default:
      case 'rest':
        P.align = .35; P.z = 3;
        P.f = [Fb(-.17, .2 + br, { yaw2: .09 }), Fb(-.02, .15 + br, { yaw2: .03 }), Fb(.16, .26 + br, { yaw2: -.07 })];
        P.t = thumb({ yaw: -.84, yaw2: .3 });
        break;
      case 'grip':          // palm on the roof, fingers hooked over its front edge (the part down the door face is darker)
        P.align = .8; P.fy = 1.05;
        P.f = [-.05, 0, .06].map(y => spec({ yaw: y, F1: 1, F2: .96, sh1: .03, sh2: -.3, crease: .8, cp: .4, w: 1.03 }));
        P.t = thumb({ yaw: -.3, yaw2: .12, F1: .92, F2: .86, sh1: -.15, sh2: -.25 });
        break;
      case 'tap': {
        const u = keyed(f, TAPK);
        P.align = .55; P.fx.tap = 1;
        P.f = [Fr(-.07, u), Fb(.05, .58), Fb(.14, .64)];
        P.t = thumb({ yaw: -.62, F1: .9, F2: .85 });
        break;
      }
      case 'count3': case 'count2': case 'count1': {
        P.bend = .42; P.z = 46; P.align = 0; P.fy = .98;
        const tk = thumb({ yaw: .95, yaw2: .45, F1: .5, F2: .4, sh1: -.35, sh2: -.4 });
        if (name === 'count3') P.f = [Fs(-.34, { yaw2: -.06 }), Fs(-.03), Fs(.29, { yaw2: .06 })];
        else if (name === 'count2') P.f = [Fs(-.26, { yaw2: -.05 }), Fs(.1, { yaw2: .04 }), Fb(.2, 1)];
        else P.f = [Fs(-.05), Fb(.05, 1), Fb(.17, 1)];
        P.t = tk;
        break;
      }
      case 'flourish': {    // the diversion: lifted, fingers fanned with a twirl, the ring turned to the bulb
        const k = side === 'L' ? sstep(206.5, 211, f) : 1;
        P.z = 100; P.align = 0; P.fy = .9; P.bend = mix(-.75, -.32, k);
        P.f = [spec({ yaw: mix(-.2, -.62, k), yaw2: -.3 * k, F1: .97, F2: .9, sh1: .1, sh2: .16 }),
          spec({ yaw: mix(-.06, -.2, k), yaw2: -.16 * k, F1: 1, F2: .95, sh1: .06, sh2: .08 }),
          spec({ yaw: mix(.08, .3, k), yaw2: .16 * k, F1: 1, F2: .93, sh1: .14, sh2: .1 })];
        P.t = thumb({ yaw: mix(-.8, -1.05, k), yaw2: -.55 * k, F1: .9, F2: .85, sh1: .05, sh2: .05 });
        break;
      }
      case 'slide': {       // the thumb pushes sideways (towards the centre of the table)
        const steal = side === 'R' && f > 150, k = steal ? sstep(209, 216.5, f) : sstep(20, 27, f);
        P.align = .5; P.bend = .14;
        P.f = [Fb(-.04, .3), Fb(.02, .28), Fb(.1, .34)];
        P.t = steal ? thumb({ yaw: mix(-1.3, -2.45, k), yaw2: mix(-.15, -.45, k), F1: 1.08, F2: 1.04, sh1: .08, sh2: .12 })
          : thumb({ yaw: mix(-.95, -1.55, k), yaw2: -.18, F1: 1.08, F2: 1.04, sh1: .05, sh2: .08 });
        break;
      }
      case 'open':          // magician's « voilà »: palm up, fingers spread
        P.palmUp = 1; P.bend = -.7; P.z = 40; P.align = 0; P.fy = .97;
        P.f = [Fp(-.42, .1, { yaw2: -.08 }), Fp(-.07, .08), Fp(.32, .13, { yaw2: .08 })];
        P.t = thumb({ yaw: -1.15, yaw2: -.25, F1: .96, F2: .9, layer: 2 });
        break;
      case 'wave': {        // bye-bye: palm up, the hand rocks at the wrist and the fingers flap
        const ph = TAU * (f - 330) / 10;
        P.palmUp = 1; P.bend = -.18 + .42 * Math.sin(ph); P.z = 60; P.align = 0;
        const c = .05 + .16 * (.5 + .5 * Math.sin(ph + 1.4));
        P.f = [Fp(-.1, c), Fp(0, c), Fp(.09, c)];
        P.t = thumb({ yaw: -.62, F1: .95, F2: .9, layer: 2 });
        P.fx.wave = ph;
        break;
      }
      case 'beckon': {      // « come here »: palm up, the index curls in, again and again
        const cI = .5 - .5 * Math.cos(TAU * (f - 430) / 11);
        P.palmUp = 1; P.bend = .16; P.z = 34; P.align = .2;
        P.f = [Fp(-.03, cI), Fp(.02, 1), Fp(.09, 1)];
        P.t = thumb({ yaw: .78, yaw2: .25, F1: .78, F2: .7, sh1: .06, sh2: .1, layer: 2 });
        break;
      }
      case 'hold': {        // near the lens: palm on the parcel's top face, fingers draped down its front face
        const near = cl(((h && h.s) || 1) - 1.15);
        P.align = mix(.3, .4, near); P.fy = mix(.9, .62, near); P.z = 30; P.bend = mix(-.05, .1, near); P.sc = mix(1, .7, near); P.dx = 7 * near;
        P.f = [-.04, .03, .1].map(y => spec({ yaw: y, F1: mix(.92, .8, near), F2: mix(.55, .62, near), sh1: mix(-.12, .02, near), sh2: mix(-.42, -.22, near),
          crease: .72, cp: 0, w: 1 + .04 * near }));
        P.t = thumb({ yaw: mix(-.5, -.3, near), F1: .8, F2: .66, sh1: -.3, sh2: -.35 });
        P.fx.hold = near;
        break;
      }
    }
    return P;
  }
  function blendSpec(a, b, t) {
    const o = {};
    for (const k in a) o[k] = typeof a[k] === 'number' ? mix(a[k], b[k], t) : (t < .5 ? a[k] : b[k]);
    o.layer = t < .5 ? a.layer : b.layer;
    return o;
  }
  function blendPose(a, b, t) {
    const o = { name: t < .5 ? a.name : b.name, fx: t < .5 ? a.fx : b.fx };
    for (const k of ['bend', 'fy', 'palmUp', 'z', 'align', 'sc', 'dx']) o[k] = mix(a[k], b[k], t);
    o.f = a.f.map((x, i) => blendSpec(x, b.f[i], t)); o.t = blendSpec(a.t, b.t, t);
    return o;
  }
  /** the pose at f, with a short blend + stretch across the score's pose switches (the smear frame) */
  function poseAt(side, h, f) {
    let name = h.pose;
    // the steal: the score keys the right hand in 'grip' for most of 212-217; the thumb must be seen pushing (slide)
    const stealR = side === 'R' && f >= S.STEAL.tilt0 && f < S.STEAL.slide1 + 1;
    if (stealR) name = 'slide';
    let P = posePar(name, side, f, h), smear = 0;
    const SW = .85;
    if (!stealR && !h.noSmear) {
      const ha = S.hand(side, f - SW), hb = S.hand(side, f + SW);
      if (ha.pose !== hb.pose) {
        let lo = f - SW, hi = f + SW;
        for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (S.hand(side, m).pose === ha.pose) lo = m; else hi = m; }
        const fs = (lo + hi) / 2, t = sstep(fs - SW, fs + SW, f);
        P = blendPose(posePar(ha.pose, side, f, ha), posePar(hb.pose, side, f, hb), t);
        smear = 1 - Math.abs(f - fs) / SW;
      }
    }
    return { P, smear: cl(smear) };
  }

  // ======================= per-call frame: matrices, light, colours, parts =======================
  const CACHE = { L: null, R: null };
  function frame(side, h, f, L, o) {
    o = o || {};
    const key = [f, h.x, h.y, h.s, h.cuffIn, h.pose, o.bump || 0, o.flinch || 0, L.x, L.on, L.violet].join('|');
    const c = CACHE[side]; if (c && c.key === key) return c;
    const { P, smear } = poseAt(side, h, f);
    const s = (h.s || 1) * P.sc, sg = side === 'L' ? 1 : -1;      // P.sc < 1: the whole arm end is smaller (held behind the parcel)
    const W = { x: h.x, y: h.y - 300 * (o.flinch || 0) };
    const dv = { x: sg * 26, y: 64 * s }, dl = Math.hypot(dv.x, dv.y), d = { x: dv.x / dl, y: dv.y / dl };
    const C = { x: W.x - d.x * OPEN * s, y: W.y - d.y * OPEN * s };
    // velocity (px / frame) → stretch along the motion; + the smear pop on a pose switch
    const a = S.hand(side, f - .5), b = S.hand(side, f + .5);
    let vx = h.noSmear ? 0 : b.x - a.x, vy = h.noSmear ? 0 : b.y - a.y; const sp = Math.hypot(vx, vy);
    const armAng = Math.atan2(-d.x, d.y);
    let stretch = 1 + Math.min(.13, sp / 380) + .13 * smear * Math.min(1, .35 + sp / 30), sAng = sp > .5 ? Math.atan2(vy, vx) : armAng + Math.PI / 2;
    if ((h.cuffIn || 0) > .02 && (h.cuffIn || 0) < .98) stretch += .06;
    const Str = new DOMMatrix().rotateSelf(sAng * DEG).scaleSelf(stretch, 1 / Math.sqrt(stretch)).rotateSelf(-sAng * DEG);
    const Ma = new DOMMatrix().translateSelf(W.x, W.y).multiplySelf(Str).rotateSelf(armAng * DEG).scaleSelf(s, s);
    const ret = RETRACT * (h.cuffIn || 0);
    const Mga = Ma.translate(0, -ret);
    const pu = P.palmUp, flip = pu > .5, m = ((side === 'L') !== flip) ? -1 : 1;
    const fl = Math.max(.3, Math.abs(Math.cos(Math.PI * pu)));
    const zs = 1 + P.z / 900, handAng = armAng * (1 - P.align);
    const Mh = Mga.translate(0, HOFF).rotateSelf((handAng - armAng) * DEG).scaleSelf(m * fl * zs * HS, zs * HS).rotateSelf(-P.bend * DEG).translateSelf(P.dx || 0, 0);
    // light, in the hand's local frame (screen direction towards the bulb)
    const hc = Mh.transformPoint(new DOMPoint(0, 40)), bx = L.x - hc.x, by = G.bulb.y - hc.y, bl = Math.hypot(bx, by) || 1;
    const inv = Mh.inverse(), lx0 = inv.a * bx / bl + inv.c * by / bl, ly0 = inv.b * bx / bl + inv.d * by / bl, ll = Math.hypot(lx0, ly0) || 1;
    const lightL = { x: lx0 / ll, y: ly0 / ll };
    const invA = Ma.inverse(), ax0 = invA.a * bx / bl + invA.c * by / bl, ay0 = invA.b * bx / bl + invA.d * by / bl, al = Math.hypot(ax0, ay0) || 1;
    const lightA = { x: ax0 / al, y: ay0 / al };
    // colours of the glove (white kid, warm under the bulb, cool in its shadows)
    const sx = hc.x, sy = Math.max(hc.y + 30, s > 1.2 ? 860 : 0);
    const lc = (hx, b) => mixc(litc(hx, sx, sy, L, b), litc(hx, L.x, POOL_Y - 80, L, b), HERO);
    const col = {
      base: lc('#F4EFE6', .85), hi: lc('#FFFDF6', 1.3), shade: lc('#B9ACC6', -.3),
      core: lc('#7D6F94', -1), bounce: lc('#F2C496', .3), crease: lc('#6E6084', -.6),
      k: lightAt(sx, sy, L).k, v: L.violet,
    };
    const boil = 1 + .07 * wob(f, 47, sg) + .04 * wob(f, 113, 2 * sg);
    const lw = { out: 2.55 * boil, thick: 1.75, inn: 1.55 * boil };
    const R = { key, side, h, f, L, o, s, W, d, C, P, smear, Ma, Mga, Mh, m, flip, lightL, lightA, col, lw, ret, zs };
    R.parts = buildParts(P, flip);
    R.roof = h.noSmear ? null : roofUnder(W, f);
    CACHE[side] = R;
    return R;
  }
  /** is the wrist on a container roof? → that container (hand height = its roof) */
  function roofUnder(W, f) {
    for (const c of S.containers(f)) {
      const top = c.y - G.ch - G.cd - c.z - c.tilt * 30, bot = c.y - G.ch - c.z;
      if (Math.abs(W.x - c.x) < G.cw / 2 + 6 && W.y > top - 8 && W.y < bot + 4) return c;
    }
    return null;
  }

  /** the parts of the glove in local coordinates (R-canonical); each part has a capsule list or is the palm */
  function buildParts(P, flip) {
    const parts = [], fy = P.fy;
    for (let i = 0; i < 3; i++) {
      const F = P.f[i], B = { x: FB[i].x, y: FB[i].y * fy }, w = F.w, tw = F.tipW;
      const r0 = FR[i] * w, r1 = FR[i] * .95 * w * (1 + (tw - 1) * .5), r2 = FR[i] * .99 * w * tw;
      const a1 = F.yaw, a2 = F.yaw + F.yaw2;
      const J = { x: B.x + Math.sin(a1) * FL1[i] * F.F1, y: B.y + Math.cos(a1) * FL1[i] * F.F1 };
      const T = { x: J.x + Math.sin(a2) * FL2[i] * F.F2, y: J.y + Math.cos(a2) * FL2[i] * F.F2 };
      const s1 = [B.x, B.y, r0, J.x, J.y, r1], s2 = [J.x, J.y, r1, T.x, T.y, r2];
      const base = { kind: 'finger', i, spec: F, B, J, T, r0, r1, r2, lift: F.lift };
      if (!flip) {                               // back view: what folds under the palm is hidden
        if (F.F1 <= 0) continue;
        parts.push(Object.assign({}, base, { caps: F.F2 > 0 ? [s1, s2] : [s1], layer: 0, order: 10 + (F.F2 > 0 ? 0 : -5) + (i === 1 ? 2 : 0) + (F.lift > .05 ? 6 : 0) }));
      } else {                                   // palm view: what curls towards the palm lies over it
        const front1 = F.F1 < 0, front2 = F.F2 < 0 || front1;
        if (!front1 && !front2) parts.push(Object.assign({}, base, { caps: [s1, s2], layer: 0, order: 10 + (i === 1 ? 2 : 0) }));
        else if (!front1) { parts.push(Object.assign({}, base, { caps: [s1], layer: 0, order: 10 })); parts.push(Object.assign({}, base, { caps: [s2], layer: 2, order: 40 + i, seg2: 1 })); }
        else parts.push(Object.assign({}, base, { caps: [s1, s2], layer: 2, order: 40 + i }));
      }
    }
    // thumb
    {
      const F = P.t, B = { x: TB.x, y: TB.y * fy }, a1 = F.yaw, a2 = F.yaw + F.yaw2;
      const J = { x: B.x + Math.sin(a1) * TL1 * F.F1, y: B.y + Math.cos(a1) * TL1 * F.F1 };
      const T = { x: J.x + Math.sin(a2) * TL2 * F.F2, y: J.y + Math.cos(a2) * TL2 * F.F2 };
      const r0 = TR * F.w, r1 = TR * .93 * F.w, r2 = TR * .85 * F.w * F.tipW;
      parts.push({ kind: 'thumb', spec: F, B, J, T, r0, r1, r2, caps: [[B.x, B.y, r0, J.x, J.y, r1], [J.x, J.y, r1, T.x, T.y, r2]], layer: F.layer, order: F.layer ? 60 : 2 });
    }
    parts.push({ kind: 'palm', layer: 1, order: 30, fy });
    parts.sort((p, q) => p.order - q.order);
    for (const p of parts) p.path = p.kind === 'palm' ? () => palmPath(fy) : () => { for (const c of p.caps) capsule(...c); };
    return parts;
  }

  // ======================= drawing: the glove =======================
  const setM = (B, M) => ctx.setTransform(B.multiply(M));
  function unionPath(R, filter) { for (const p of R.parts) if (!filter || filter(p)) p.path(); }

  /** colour of a part's along-axis tone: sh < 0 → towards the cool shade, sh > 0 → towards the warm light */
  function shadeCapsule(c, R, sh0, sh1, cp, crease, pathFn) {
    const fillIt = () => { ctx.beginPath(); pathFn ? pathFn() : capsule(...c); ctx.fill(); };
    const [x0, y0, r0, x1, y1, r1] = c, col = R.col, l = R.lightL;
    const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy);
    const r = Math.max(r0, r1), ux = D > .01 ? dx / D : 0, uy = D > .01 ? dy / D : 1, nx = -uy, ny = ux;
    const lp = cl(l.x * nx + l.y * ny, -1, 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    // across: a lit crown shifted to the bulb, cool flanks, the warm bounce of the cloth on the far rim
    const g = ctx.createLinearGradient(mx - nx * r, my - ny * r, mx + nx * r, my + ny * r);
    const cpos = .5 + .2 * lp, far = lp >= 0 ? 0 : 1;
    const edge = (p, isFar) => isFar ? [[p, css(col.bounce, .3)], [p === 0 ? .08 : .92, css(col.core, .62)], [p === 0 ? .24 : .76, css(col.shade, .38)]]
      : [[p, css(col.shade, .42)], [p === 0 ? .14 : .86, css(col.shade, .08)]];
    const stops = [...edge(0, far === 0), [cpos, css(col.hi, .7)], ...edge(1, far === 1)].sort((a, b) => a[0] - b[0]);
    for (const [p, cc] of stops) g.addColorStop(cl(p), cc);
    ctx.fillStyle = g; fillIt();
    // along: the tip turns away from (sh < 0) or towards (sh > 0) the bulb; a fold makes the step sharper
    if (Math.abs(sh0) + Math.abs(sh1) > .14 && D > .5) {
      const ga = ctx.createLinearGradient(x0 - ux * r0, y0 - uy * r0, x1 + ux * r1, y1 + uy * r1);
      const tone = v => v < 0 ? css(col.core, -v * .75) : css(col.hi, v * .7);
      if (crease > .5 && cp > 0) { ga.addColorStop(0, tone(sh0)); ga.addColorStop(cl(cp - .06), tone(sh0)); ga.addColorStop(cl(cp + .05), tone(sh1)); ga.addColorStop(1, tone(sh1 * 1.1)); }
      else { ga.addColorStop(0, tone(sh0)); ga.addColorStop(1, tone(sh1)); }
      ctx.fillStyle = ga; fillIt();
    }
  }
  function paintPart(p, R, B) {
    const col = R.col;
    setM(B, R.Mh);
    if (p.kind === 'palm') {
      ctx.fillStyle = css(col.base); ctx.beginPath(); p.path(); ctx.fill();
      // dome: lit crown towards the bulb, the far side and the wrist side sink into a cool shade
      const l = R.lightL;
      if (!R.flip) {          // the back of the hand: a dome, crown towards the bulb
        const cx = l.x * 13, cy = 30 * p.fy + l.y * 12;
        const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy - 6 * p.fy, 64);
        rg.addColorStop(0, css(col.hi, .75)); rg.addColorStop(.4, css(col.base, 0)); rg.addColorStop(.74, css(col.shade, .4)); rg.addColorStop(1, css(col.core, .6));
        ctx.fillStyle = rg; ctx.beginPath(); p.path(); ctx.fill();
      } else {                // the palm: a shallow cup — shade in the hollow, lit mounds (thumb mound, heel, under the fingers)
        const cx = 5 + l.x * 4, cy = 33 * p.fy + l.y * 4;
        let rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46);
        rg.addColorStop(0, css(col.shade, .62)); rg.addColorStop(.5, css(col.shade, .2)); rg.addColorStop(.82, css(col.base, 0)); rg.addColorStop(1, css(col.hi, .3));
        ctx.fillStyle = rg; ctx.beginPath(); p.path(); ctx.fill();
        for (const [x, y, r, a] of [[-24, 20, 19, .5], [8, 4, 20, .35], [22, 50, 13, .25]]) {
          rg = ctx.createRadialGradient(x, y * p.fy, 1, x, y * p.fy, r); rg.addColorStop(0, css(col.hi, a)); rg.addColorStop(1, css(col.hi, 0));
          ctx.fillStyle = rg; ctx.beginPath(); p.path(); ctx.fill();
        }
        const g2 = ctx.createLinearGradient(0, 64 * p.fy, 0, 40 * p.fy); g2.addColorStop(0, css(col.core, .35)); g2.addColorStop(1, css(col.core, 0));
        ctx.fillStyle = g2; ctx.beginPath(); p.path(); ctx.fill();
      }
      return;
    }
    const F = p.spec;
    ctx.lineJoin = 'round';
    ctx.beginPath(); p.path(); ctx.lineWidth = R.lw.inn * 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = css(col.base); ctx.fill();
    const front = p.layer === 2 && R.flip, c0 = p.caps[0], cN = p.caps[p.caps.length - 1];
    let s0, s1, foldT = 0;
    if (p.caps.length === 2) {
      const d1 = Math.hypot(c0[3] - c0[0], c0[4] - c0[1]), d2 = Math.hypot(cN[3] - cN[0], cN[4] - cN[1]);
      s0 = F.sh1; s1 = F.sh2; foldT = F.crease > .5 && F.cp > 0 ? (d1 + F.cp * d2) / (d1 + d2 || 1) : 0;
    } else if (p.seg2) { s0 = F.sh2 * .8; s1 = F.sh2; } else { s0 = F.sh1; s1 = F.sh1 * .6 + F.sh2 * .4; }
    if (front) { s0 = Math.max(s0, .05); s1 = Math.max(s1, .1); }
    let axis = [c0[0], c0[1], c0[2], cN[3], cN[4], cN[5]];
    if (Math.hypot(axis[3] - axis[0], axis[4] - axis[1]) < 2) { const yw = F.yaw || 0; axis = [axis[0], axis[1], axis[2], axis[0] + Math.sin(yw) * 4, axis[1] + Math.cos(yw) * 4, axis[5]]; }
    shadeCapsule(axis, R, s0, s1, foldT, F.crease, p.path);
  }
  /** occlusion line: stroke part p's outline only where it covers part q */
  function occlusion(p, q, R, B, w) {
    ctx.save();
    if (q.kind === 'cuff') { setM(B, R.Mga); ctx.beginPath(); cuffPath(); rimPath(); ctx.clip(); }
    else { setM(B, R.Mh); ctx.beginPath(); q.path(); ctx.clip(); }
    setM(B, R.Mh); ctx.beginPath(); if (p.kind === 'palm') palmPath(p.fy, true); else p.path(); ctx.lineWidth = w * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  function drawCuff(R, B) {
    const col = R.col, l = R.lightA;
    setM(B, R.Mga);
    ctx.beginPath(); cuffPath(); ctx.lineWidth = R.lw.inn * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = css(col.base); ctx.fill();
    // a flared tube: lit crown, cool flanks; the sleeve's own shadow falls on its far end
    const cpos = .5 + .18 * cl(l.x, -1, 1);
    let g = ctx.createLinearGradient(-44, 0, 44, 0);
    g.addColorStop(0, css(col.core, .45)); g.addColorStop(.16, css(col.shade, .25)); g.addColorStop(cpos, css(col.hi, .5)); g.addColorStop(.84, css(col.shade, .25)); g.addColorStop(1, css(col.core, .45));
    ctx.fillStyle = g; ctx.beginPath(); cuffPath(); ctx.fill();
    g = ctx.createLinearGradient(0, -12, 0, -74);
    g.addColorStop(0, css(col.shade, .18)); g.addColorStop(.3, css(col.shade, 0)); g.addColorStop(.55, css(col.core, .2)); g.addColorStop(1, css(col.core, .85));
    ctx.fillStyle = g; ctx.beginPath(); cuffPath(); ctx.fill();
    // a soft fold on the flare
    taper(-15 * R.m, -16, -22 * R.m, -28, -19 * R.m, -42, 3, css(col.crease, .5));
    // the rolled edge
    ctx.beginPath(); rimPath(); ctx.lineWidth = R.lw.inn * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = css(col.base); ctx.fill();
    ctx.save(); ctx.beginPath(); rimPath(); ctx.clip();
    // a rolled band: lit along its crown, shaded where it turns under (towards the hand) and into the sleeve
    const arcLine = off => () => rimArc(off).forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const st = (fn, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); fn(); ctx.stroke(); };
    st(arcLine(-1.2), 7, css(col.hi, .3)); st(arcLine(-1.5), 3.6, css(col.hi, .45));
    st(arcLine(RIMC.h + 1.5), 9, css(col.core, .3)); st(arcLine(RIMC.h + 1), 4.5, css(col.core, .3));
    st(arcLine(-RIMC.h - 1.5), 6, css(col.core, .3));
    g = ctx.createLinearGradient(-48, 0, 48, 0);
    g.addColorStop(0, css(col.core, .55)); g.addColorStop(.22, css(col.core, 0)); g.addColorStop(.78, css(col.core, 0)); g.addColorStop(1, css(col.core, .55));
    ctx.fillStyle = g; ctx.fillRect(-60, RIMC.y - 20, 120, 40);
    ctx.restore();
  }

  /** the whole glove. which: 'all' | 'thumb' (the thumb only, behind a held box) | 'nothumb' */
  function drawGlove(R, B, which = 'all') {
    const col = R.col, P = R.P, l = R.lightL;
    const sel = p => which === 'all' || (which === 'thumb' ? p.kind === 'thumb' : which === 'fingers' ? p.kind === 'finger' : p.kind !== 'thumb');
    const withCuff = which === 'all' || which === 'nothumb';
    ctx.save();
    // the glove only exists beyond the sleeve opening (cuffIn slides it back in)
    if (R.ret > .5 || Math.abs(R.P.bend) > 1.2) { setM(B, R.Ma); ctx.beginPath(); ctx.rect(-400, -OPEN - 4, 800, 1200); ctx.clip(); }
    // 1 — ink underlay: the outer silhouette, thin towards the bulb, thick on the far side
    ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    for (const pass of dbg.noUnder ? [] : [0, 1]) {
      const ox = pass ? -l.x * R.lw.thick : 0, oy = pass ? -l.y * R.lw.thick : 0;
      ctx.beginPath();
      if (withCuff) { setM(B, R.Mga.translate(pass ? -R.lightA.x * R.lw.thick : 0, pass ? -R.lightA.y * R.lw.thick : 0)); cuffPath(); rimPath(); }
      setM(B, R.Mh.translate(ox, oy)); unionPath(R, sel);
      setM(B, R.Mga); ctx.lineWidth = R.lw.out * 2 * HS * R.zs; ctx.stroke();
    }
    // 2 — the glove cuff, then the parts back to front
    if (withCuff && !dbg.noCuff) drawCuff(R, B);
    const palm = R.parts.find(p => p.kind === 'palm'), th = R.parts.find(p => p.kind === 'thumb');
    for (const p of R.parts) {
      if (!sel(p)) continue;
      if (p.layer === 2 && R.flip) {            // lies over the palm: a soft cast shadow on what is under it first
        ctx.save(); setM(B, R.Mh); ctx.beginPath(); palm.path(); ctx.clip();
        soft(p.path, 2.6, css(col.core, .5), -l.x * 3.2, -l.y * 3.2 + 1.5); ctx.restore();
      }
      if (!dbg.noParts) paintPart(p, R, B);
      if (p.kind === 'palm' && !dbg.noPalmX) {
        if (withCuff) occlusion(p, { kind: 'cuff' }, R, B, R.lw.inn * .9);
        if (th && th.layer === 0 && sel(th)) occlusion(p, th, R, B, R.lw.inn);
        if (!R.flip) knuckles(R, B);
      }
    }
    // 3 — gouache tooth on the back of the hand (the film grain does the rest)
    if (palm && sel(palm)) {
      setM(B, R.Mh); ctx.save(); ctx.beginPath(); palmPath(palm.fy, true); ctx.clip();
      const gt = gouTex(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .3; ctx.fillStyle = gt.pat; ctx.fillRect(-42, -10, 84, 80 * palm.fy);
      ctx.restore();
    }
    // 4 — creases and details
    if (!dbg.noDetails) details(R, B, sel, which);
    if (R.side === 'L' && sel(R.parts.find(p => p.kind === 'finger' && p.i === 2) || {})) ring(R, B);
    ctx.restore();
  }
  /** back of the hand: the knuckle ridge catches the light, soft dips between the fingers */
  function knuckles(R, B) {
    const col = R.col, fy = R.P.fy;
    setM(B, R.Mh);
    ctx.save(); ctx.beginPath(); palmPath(fy); ctx.clip();
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(col.hi, .26); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-28, 46 * fy); ctx.quadraticCurveTo(0, 57 * fy, 28, 46 * fy); ctx.stroke();
    ctx.strokeStyle = css(col.core, .24); ctx.lineWidth = 4.5; ctx.beginPath();
    for (const x of [-10.5, 10.5]) { ctx.moveTo(x, 51 * fy); ctx.lineTo(x * .9, 61 * fy); }
    ctx.stroke();
    ctx.restore();
  }
  function details(R, B, sel, which) {
    const col = R.col, P = R.P, fy = P.fy, inkc = INK_A(col);
    setM(B, R.Mh);
    const ink = [], inkU = [], soft2 = [], hi = [];          // batched: ink creases (free / under the palm), crease tone, light
    if (!R.flip) {
      if (!(P.fx.hold > .5)) { soft2.push([-14, 7 * fy, -5, 11 * fy, 5, 8 * fy, 2.0]); soft2.push([-1, 14 * fy, 6, 17 * fy, 13, 13.5 * fy, 1.5]); }
    } else {                    // the palm: thumb-mound line + one crease under the fingers
      ink.push([-25, 47 * fy, -5, 34 * fy, -9, 6 * fy, 2.6]); ink.push([33, 43 * fy, 14, 52 * fy, -9, 47 * fy, 2.1]);
    }
    const palmP = R.parts.find(q => q.kind === 'palm');
    for (const p of R.parts) {
      if (p.kind === 'palm' || !sel(p)) continue;
      const under = p.layer === 0 && palmP && which !== 'fingers';     // under the palm: only its creases outside the palm show
      const out = under ? inkU : ink;
      const crease = (X, Y, u, w, width, bow = 3) => { const nx = -u.y, ny = u.x; out.push([X - nx * w, Y - ny * w, X + u.x * bow, Y + u.y * bow, X + nx * w, Y + ny * w, width]); };
      const F = p.spec;
      const d1 = Math.hypot(p.J.x - p.B.x, p.J.y - p.B.y), d2 = Math.hypot(p.T.x - p.J.x, p.T.y - p.J.y);
      const a = d1 > .5 ? { x: (p.J.x - p.B.x) / d1, y: (p.J.y - p.B.y) / d1 } : { x: Math.sin(F.yaw), y: Math.cos(F.yaw) };
      const b = d2 > .5 ? { x: (p.T.x - p.J.x) / d2, y: (p.T.y - p.J.y) / d2 } : a;
      const gloss = () => {     // kid leather: a soft sheen near the fingertip, on the side that faces the bulb
        const l = R.lightL, nx = -b.y, ny = b.x, side = Math.sign(l.x * nx + l.y * ny) || 1;
        hi.push([p.T.x - b.x * p.r2 * .45 + nx * side * p.r2 * .38, p.T.y - b.y * p.r2 * .45 + ny * side * p.r2 * .38, p.r2 * .42, p.r2 * .2, Math.atan2(b.y, b.x)]);
      };
      if (p.kind === 'thumb') { if (d1 > 3) crease(p.J.x, p.J.y, a, p.r1 * .55, 1.5); if (!under) gloss(); continue; }
      const showJ = p.caps.length === 2 || p.seg2;
      if (showJ && d1 > 4 && d2 > 2) {
        const cp = F.cp || 0, X = p.J.x + b.x * d2 * cp, Y = p.J.y + b.y * d2 * cp;
        crease(X, Y, cp ? b : a, p.r1 * .62, 1.4 + 1.7 * F.crease);
      } else if (!R.flip && F.crease > .3) crease(p.J.x + a.x * p.r1 * .3, p.J.y + a.y * p.r1 * .3, a, p.r1 * .68, 2.3, 4);   // curled under: the fold
      if (R.flip && !p.seg2 && p.layer === 0) {   // palm side: a crease at the base, a lit pad at the tip
        crease(p.B.x + a.x * (p.r0 + 4), p.B.y + a.y * (p.r0 + 4), a, p.r0 * .55, 1.2, 2);
        if (showJ && d2 > 6) hi.push([p.T.x - b.x * 3.5, p.T.y - b.y * 3.5, p.r2 * .55, p.r2 * .42, Math.atan2(b.y, b.x)]);
      }
      if (!R.flip && F.lift > .3) crease(p.B.x + a.x * (p.r0 + 5), p.B.y + a.y * (p.r0 + 5), a, p.r0 * .5, 1.3, -2);
      if (showJ && d2 > 4 && !(R.flip && p.layer === 0)) gloss();
    }
    if (soft2.length) batch(css(col.crease, .55), () => soft2.forEach(t => taperPath(...t)));
    if (hi.length) batch(css(col.hi, .55), () => hi.forEach(([x, y, rx, ry, a]) => { ctx.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx); ctx.ellipse(x, y, rx, ry, a, 0, TAU); }));
    if (ink.length) batch(css(inkc, .78), () => ink.forEach(t => taperPath(...t)));
    if (inkU.length) { ctx.save(); ctx.beginPath(); ctx.rect(-300, -300, 600, 600); palmPath(palmP.fy, true); ctx.clip('evenodd'); batch(css(inkc, .78), () => inkU.forEach(t => taperPath(...t))); ctx.restore(); }
    // the tap: three little ink rays round the index tip as it strikes the roof
    if (P.fx.tap) for (const ft of TAPS) {
      const e = R.f - ft; if (e < -.2 || e > 2.6) continue;
      const k = cl(1 - e / 2.6), p = R.parts.find(q => q.kind === 'finger' && q.i === 0); if (!p) break;
      const d2 = Math.hypot(p.T.x - p.J.x, p.T.y - p.J.y) || 1, ux = (p.T.x - p.J.x) / d2, uy = (p.T.y - p.J.y) / d2;
      batch(css([26, 20, 38], .95 * k), () => { for (const [ang, len] of [[-1.25, 12], [0, 15], [1.25, 12]]) {
        const ca = Math.cos(ang), sa = Math.sin(ang), dx = ux * ca - uy * sa, dy = ux * sa + uy * ca;
        const r0 = p.r2 + 3 + 9 * (1 - k), x0 = p.T.x + dx * r0, y0 = p.T.y + dy * r0, ll = len * (.6 + .4 * k);
        taperPath(x0, y0, x0 + dx * ll * .5, y0 + dy * ll * .5, x0 + dx * ll, y0 + dy * ll, 4.6 * k);
      } });
    }
  }
  const INK_A = col => mixc([26, 20, 38], col.crease, .25);
  const F_SH = p => p.spec.sh2 || 0;

  /** gold signet ring on the ring finger of the L glove */
  function ringAt(R) {
    const p = R.parts.find(q => q.kind === 'finger' && q.i === 2); if (!p) return null;
    const D1 = Math.hypot(p.J.x - p.B.x, p.J.y - p.B.y), t = D1 > 9 ? .52 : .95;
    const ux = D1 > .5 ? (p.J.x - p.B.x) / D1 : 0, uy = D1 > .5 ? (p.J.y - p.B.y) / D1 : 1;
    const x = p.B.x + (p.J.x - p.B.x) * t + ux * (D1 > 9 ? 0 : 6), y = p.B.y + (p.J.y - p.B.y) * t + uy * (D1 > 9 ? 0 : 6);
    return { x, y, ux, uy, r: mix(p.r0, p.r1, t) };
  }
  function ring(R, B) {
    const g0 = ringAt(R); if (!g0) return;
    const { x, y, ux, uy, r } = g0, nx = -uy, ny = ux, L = R.L, hc = R.Mh.transformPoint(new DOMPoint(x, y));
    const gold = litc('#D9A43C', hc.x, hc.y, L, 1), dark = litc('#6E420E', hc.x, hc.y, L, 0), lite = litc('#FFE7A0', hc.x, hc.y, L, 1.3);
    setM(B, R.Mh);
    const bw = 4.2, ext = r + 1.6, bow = 3.2;
    const band = () => {
      ctx.moveTo(x - nx * ext - ux * bw, y - ny * ext - uy * bw);
      ctx.quadraticCurveTo(x + ux * (bow - bw), y + uy * (bow - bw), x + nx * ext - ux * bw, y + ny * ext - uy * bw);
      ctx.lineTo(x + nx * ext + ux * bw, y + ny * ext + uy * bw);
      ctx.quadraticCurveTo(x + ux * (bow + bw), y + uy * (bow + bw), x - nx * ext + ux * bw, y - ny * ext + uy * bw);
      ctx.closePath();
    };
    ctx.beginPath(); band(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    const g = ctx.createLinearGradient(x - nx * ext, y - ny * ext, x + nx * ext, y + ny * ext);
    g.addColorStop(0, css(dark)); g.addColorStop(.3, css(gold)); g.addColorStop(.5, css(lite)); g.addColorStop(.68, css(gold)); g.addColorStop(1, css(dark));
    ctx.fillStyle = g; ctx.fill();
    if (!R.flip) {          // the signet on the back of the finger
      const sx = x + ux * bow * .6, sy = y + uy * bow * .6, rx = 7.2, ry = 5.6, ang = Math.atan2(ny, nx);
      ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, ang, 0, TAU); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
      const l = R.lightL, rg = ctx.createRadialGradient(sx + l.x * 2.5, sy + l.y * 2.5, .5, sx, sy, 8);
      rg.addColorStop(0, css(lite)); rg.addColorStop(.45, css(gold)); rg.addColorStop(1, css(dark));
      ctx.fillStyle = rg; ctx.fill();
      ctx.fillStyle = 'rgba(255,253,240,.95)'; ctx.beginPath(); ctx.ellipse(sx + l.x * 2.8, sy + l.y * 2.8, 1.8, 1.2, ang, 0, TAU); ctx.fill();
      // 2.0-3.2 s: the ring catches the bulb on the beats of the count (a small twinkle; the big glint at 7.0 s is P_glint)
      const f = R.f, tw = f > 58 && f < 98 ? Math.max(...[60, 75, 90].map(b => Math.exp(-Math.pow((f - b - 1) / 2.6, 2)))) * sstep(58, 62, f) * (1 - sstep(94, 98, f)) : 0;
      if (tw > .02) {
        const hx = sx + l.x * 2.8, hy = sy + l.y * 2.8, Rr = 16 * tw + 4;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, Rr * 1.6); rg.addColorStop(0, `rgba(255,236,190,${(.7 * tw).toFixed(3)})`); rg.addColorStop(.25, `rgba(255,190,90,${(.25 * tw).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(hx - Rr * 1.6, hy - Rr * 1.6, Rr * 3.2, Rr * 3.2);
        ctx.fillStyle = `rgba(255,248,225,${(.9 * tw).toFixed(3)})`;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .35, ca = Math.cos(a), sa = Math.sin(a), w = 1.3; ctx.beginPath(); ctx.moveTo(hx - sa * w, hy + ca * w); ctx.lineTo(hx + ca * Rr * (i % 2 ? .7 : 1), hy + sa * Rr * (i % 2 ? .7 : 1)); ctx.lineTo(hx + sa * w, hy - ca * w); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
  }

  // ======================= the sleeve =======================
  /** centreline from the opening (u = 0) up to the shoulder, with radius on each side, normals and texture u */
  function tube(R) {
    if (R.tube) return R.tube;
    const sh = R.o.shoulder || G.shoulder[R.side], C = R.C, d = R.d, s = R.s;
    const Dl = Math.hypot(sh.x - C.x, sh.y - C.y);
    const P1 = { x: C.x - d.x * Dl * .42, y: C.y - d.y * Dl * .42 }, P2 = { x: sh.x, y: sh.y + Dl * .36 };
    const N = 34, pts = [];
    let u = 0, tu = 0, prev = null;
    const bump = R.side === 'R' ? (R.o.bump || 0) : 0, ph = R.side === 'L' ? .7 : 2.3;
    for (let i = 0; i <= N; i++) {
      const t = i / N, it = 1 - t;
      const x = it * it * it * C.x + 3 * it * it * t * P1.x + 3 * it * t * t * P2.x + t * t * t * sh.x;
      const y = it * it * it * C.y + 3 * it * it * t * P1.y + 3 * it * t * t * P2.y + t * t * t * sh.y;
      let tx = 3 * it * it * (P1.x - C.x) + 6 * it * t * (P2.x - P1.x) + 3 * t * t * (sh.x - P2.x);
      let ty = 3 * it * it * (P1.y - C.y) + 6 * it * t * (P2.y - P1.y) + 3 * t * t * (sh.y - P2.y);
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      if (prev) { const du = Math.hypot(x - prev.x, y - prev.y); u += du; tu += du / prev.k; }
      const k = mix(s, 1, sstep(0, Dl * .85, u));                       // perspective scale along the arm
      const r = 49 * k * (1 + .1 * sstep(0, 420, u));
      const rip = 2.1 * k * Math.sin(u / (17 * k) + ph) * Math.exp(-u / (160 * k));   // fabric bunching near the cuff
      // the parcel up the sleeve: a SQUARE bulge on the outer (screen-right) side, a little way up from the cuff
      const bu = (u - 98 * s) / (42 * s), prof = sstep(-1.16, -.84, bu) * (1 - sstep(.84, 1.16, bu));
      const p = { x, y, tx, ty, nx: -ty, ny: tx, u, tu, k, rP: r + rip + bump * 33 * s * prof, rM: r - rip * .6 };
      pts.push(p); prev = p;
    }
    R.tube = { pts, Dl };
    return R.tube;
  }
  const sidePt = (p, sgn) => sgn > 0 ? { x: p.x + p.nx * p.rP, y: p.y + p.ny * p.rP } : { x: p.x - p.nx * p.rM, y: p.y - p.ny * p.rM };
  function tubePath(pts, off) {
    const o = off || (() => ({ x: 0, y: 0 }));
    let q = sidePt(pts[0], 1), oo = o(pts[0]); ctx.moveTo(q.x + oo.x, q.y + oo.y);
    for (let i = 1; i < pts.length; i++) { q = sidePt(pts[i], 1); oo = o(pts[i]); ctx.lineTo(q.x + oo.x, q.y + oo.y); }
    for (let i = pts.length - 1; i >= 0; i--) { q = sidePt(pts[i], -1); oo = o(pts[i]); ctx.lineTo(q.x + oo.x, q.y + oo.y); }
    ctx.closePath();
  }
  function drawSleeve(R, B) {
    const { pts: all } = tube(R), L = R.L, wx = waxTex();
    // only what can be on screen (the camera zooms ≤ 6 %): from the cuff up to just past the top edge
    let last = all.length - 1; for (let i = 0; i < all.length; i++) if (all[i].y + Math.max(all[i].rP, all[i].rM) < -70) { last = i; break; }
    const pts = all.slice(0, Math.max(2, last + 1));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const r = Math.max(p.rP, p.rM) + 4; x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r); }
    ctx.save(); ctx.setTransform(B);
    ctx.beginPath(); tubePath(pts); ctx.clip();
    // 1 — the wax, in strips along the tube (the print follows the hose); strips overlap a little, no per-strip clip
    const phase = R.side === 'L' ? 37 : 91;
    // where the rotated print stops: past the table's far edge (the night eats the print) or 420 px up the hose
    let cut = pts.length - 1;
    for (let i = 3; i < pts.length; i += 3) if (pts[i].u > 420 * R.s || (pts[i].y < 600 && pts[i].u > 160 * R.s)) { cut = i; break; }
    if (cut < pts.length - 1 && !dbg.noStrips) {
      const c = pts[cut], kv = c.k, T = 1.25;     // upright print in the upper hose, anchored at the cut point (moves with the arm)
      const ox = Math.round(c.x), oy = Math.round(c.y);
      ctx.setTransform(B.a, B.b, B.c, B.d, B.e + ox * B.a + oy * B.c, B.f + ox * B.b + oy * B.d);
      const p2 = wx.pat2 || (wx.pat2 = ctx.createPattern(wx.c2, 'repeat'));
      ctx.fillStyle = p2; ctx.fillRect(x0 - ox, y0 - oy, x1 - x0, Math.min(y1, c.y + 60) - y0);
      ctx.setTransform(B);
    }
    const r0 = (pts[0].rP + pts[0].rM) / 2 / pts[0].k, kap = wx.U / (2 * r0);      // tile units per hose unit
    for (let i = 0; i < cut && !dbg.noStrips; i += 3) {
      const a = pts[i], b = pts[Math.min(pts.length - 1, i + 3)];
      const seg = Math.hypot(b.x - a.x, b.y - a.y), dtu = b.tu - a.tu || 1, ku = seg / dtu, kv = (a.k + b.k) / 2;
      const Tx = (b.x - a.x) / (seg || 1), Ty = (b.y - a.y) / (seg || 1), Nx = -Ty, Ny = Tx;
      // tile (X, Y) → hose (v = (X − U/2)/κ, tu = Y/κ − phase) → screen
      ctx.setTransform(B); ctx.transform(Nx * kv / kap, Ny * kv / kap, Tx * ku / kap, Ty * ku / kap,
        a.x - Nx * kv * wx.U / 2 / kap - Tx * ku * (a.tu + phase), a.y - Ny * kv * wx.U / 2 / kap - Ty * ku * (a.tu + phase));
      const vm = (Math.max(a.rM, b.rM) / kv + 3) * kap, vp = (Math.max(a.rP, b.rP) / kv + 3) * kap, y0 = (a.tu + phase - (i ? 3 : 40)) * kap;
      ctx.fillStyle = kv > 1.35 ? wx.patHi : wx.pat; ctx.fillRect(wx.U / 2 - vm, y0, vm + vp, (dtu + (i ? 6 : 43)) * kap);
    }
    ctx.setTransform(B);
    // 2 — relight the albedo exactly like lit(): ×A + B, sampled at the cuff and up the arm (the arm sinks into the night)
    const q = all[Math.min(all.length - 1, Math.round(all.length * .45))];
    const ab = (x, y, bias) => { const b0 = litc('#000000', x, y, L, bias), w0 = litc('#ffffff', x, y, L, bias); return { A: [(w0[0] - b0[0]), (w0[1] - b0[1]), (w0[2] - b0[2])], B: b0 }; };
    const abm = (x, y, bias, k) => { const a = ab(x, y, bias), c = ab(L.x, POOL_Y - 80, bias); return { A: mixc(a.A, c.A, k), B: mixc(a.B, c.B, k) }; };
    const A0 = abm(R.C.x, R.C.y + 40, .4, HERO * .8), A1 = abm(q.x, q.y + 40, .4, HERO * .25);
    let g = ctx.createLinearGradient(R.C.x, R.C.y, q.x, q.y);
    g.addColorStop(0, css(A0.A)); g.addColorStop(1, css(A1.A));
    if (!dbg.noRelight) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.beginPath(); tubePath(pts); ctx.fill(); }
    if (!dbg.noRelight) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = css(mixc(A0.B, A1.B, .5)); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    // 3 — a round hose: dark flanks, a warm sheen on the side that faces the bulb
    const bx = L.x - R.C.x, by = G.bulb.y - R.C.y, bl = Math.hypot(bx, by) || 1, p0 = pts[0];
    const lp = (bx * p0.nx + by * p0.ny) / bl, kL = lightAt(R.C.x, R.C.y + 40, L).k;
    const line = (sgn, fr) => () => { pts.forEach((p, i) => { const rr = sgn > 0 ? p.rP : p.rM, x = p.x + p.nx * rr * fr * sgn, y = p.y + p.ny * rr * fr * sgn; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
    // layered plain strokes (a canvas blur over the whole hose costs several ms in this raster)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const band = (fn, layers, rgb) => { if (dbg.noBands) return; for (const [w, a] of layers) { ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`; ctx.lineWidth = w * R.s; ctx.beginPath(); fn(); ctx.stroke(); } };
    band(line(lp >= 0 ? -1 : 1, 1.02), [[30, .2]], '4,3,10');
    const ls = lp >= 0 ? 1 : -1, ka = .06 + .12 * kL;
    band(line(ls, .46), [[12, ka * .9]], '255,214,150');
    // 4 — folds bunching above the cuff (tapered dark creases with a lit ridge)
    const fl = [[24, 1, .85], [52, -1, .7], [86, 1, .6], [128, -1, .55]];
    if (cut < pts.length - 1) fl.push([pts[cut].u / R.s, 1, 1.05], [pts[cut].u / R.s + 7, -1, .7]);   // a full crease hides where the print changes mapping
    const folds = fl.map(([uf, side, ln]) => {
      const target = uf * R.s; let p = pts[0];
      for (const pp of pts) { if (pp.u >= target) { p = pp; break; } }
      const r = (p.rP + p.rM) / 2, sx = side;
      const ax = p.x + p.nx * r * .98 * sx, ay = p.y + p.ny * r * .98 * sx;
      const ex = p.x - p.nx * r * (1.9 * ln - .98) * sx + p.tx * 4 * R.s, ey = p.y - p.ny * r * (1.9 * ln - .98) * sx + p.ty * 4 * R.s;
      return { p, ax, ay, ex, ey, mx: (ax + ex) / 2 - p.tx * 9 * R.s, my: (ay + ey) / 2 - p.ty * 9 * R.s };
    });
    batch('rgba(6,4,10,.42)', () => { for (const q of folds) taperPath(q.ax, q.ay, q.mx, q.my, q.ex, q.ey, 6 * R.s); });
    batch(`rgba(255,226,170,${(.05 + .14 * kL).toFixed(3)})`, () => { for (const { p, ax, ay, mx, my, ex, ey } of folds) { const o = 4 * R.s; taperPath(ax + p.tx * o, ay + p.ty * o, mx + p.tx * o * .75, my + p.ty * o * .75, ex + p.tx * o, ey + p.ty * o, 2.6 * R.s); } });
    // the parcel pressing through the cloth: a flat lit face, hard corners, tension folds pulling from the corners
    const bump = R.side === 'R' ? (R.o.bump || 0) : 0;
    if (bump > .05) {
      const at = u => { let p = pts[0]; for (const pp of pts) { if (pp.u >= u) { p = pp; break; } } return p; };
      const ss = R.s, pa = at(60 * ss), pb = at(136 * ss), pm = at(98 * ss);
      const edge = (p, inset) => ({ x: p.x + p.nx * (p.rP - inset * ss), y: p.y + p.ny * (p.rP - inset * ss) });
      // the flat face of the box under the cloth: lit band + darker underside
      const e0 = edge(pa, 4), e1 = edge(pb, 4), i0 = edge(pa, 26 * bump + 4), i1 = edge(pb, 26 * bump + 4);
      ctx.fillStyle = `rgba(255,226,170,${(bump * (.08 + .16 * kL)).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(i1.x, i1.y); ctx.lineTo(i0.x, i0.y); ctx.closePath(); ctx.fill();
      // tension folds from the two corners, slanting back to the middle of the hose
      const tf = [[pa, -1], [pb, 1]].map(([p, dir]) => { const c0 = edge(p, 2), q = at(p.u + dir * 26 * ss), c1 = { x: q.x - q.nx * q.rM * .25, y: q.y - q.ny * q.rM * .25 };
        return { p, dir, c0, c1, mx: (c0.x + c1.x) / 2 + p.nx * 4 * ss, my: (c0.y + c1.y) / 2 + p.ny * 4 * ss }; });
      batch(`rgba(4,3,10,${(.55 * bump).toFixed(3)})`, () => { for (const t of tf) taperPath(t.c0.x, t.c0.y, t.mx, t.my, t.c1.x, t.c1.y, 5.5 * ss * bump); });
      batch(`rgba(255,226,170,${(bump * (.08 + .2 * kL)).toFixed(3)})`, () => {
        taperPath(e0.x, e0.y, (e0.x + e1.x) / 2, (e0.y + e1.y) / 2, e1.x, e1.y, 3 * ss);
        for (const { p, dir, c0, c1, mx, my } of tf) { const o = -3 * ss * dir; taperPath(c0.x + p.tx * o, c0.y + p.ty * o, mx + p.tx * o, my + p.ty * o, c1.x, c1.y, 2.2 * ss * bump); }
      });
      // the shade under the bulge (it turns away from the bulb)
      const u0 = edge(pm, -2);
      ctx.strokeStyle = `rgba(4,3,10,${(.36 * bump).toFixed(3)})`; ctx.lineWidth = 9 * ss; ctx.beginPath(); ctx.moveTo(edge(pa, 0).x, edge(pa, 0).y); ctx.lineTo(u0.x, u0.y); ctx.lineTo(edge(pb, 0).x, edge(pb, 0).y); ctx.stroke();
    }
    ctx.restore();
    // 5 — ink outline (heavier on the side away from the bulb)
    ctx.save(); ctx.setTransform(B); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    for (const sgn of [-1, 1]) {
      ctx.lineWidth = (sgn * lp < 0 ? 4.2 : 2.6) * Math.sqrt(R.s);
      ctx.beginPath(); pts.forEach((p, i) => { const q = sidePt(p, sgn); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke();
    }
    ctx.restore();
  }
  /** the rolled cuff of the sleeve: mustard hem rolled over, twisted black stripes. part: 'lower' (+ the dark opening) | 'upper' */
  function drawRoll(R, B, part) {
    const L = R.L, A = ROLL.A, Bv = ROLL.B, a = ROLL.a, b = ROLL.b, cy = -OPEN;
    const wc = R.Ma.transformPoint(new DOMPoint(0, cy));
    const must = litc('#C9A23C', wc.x, wc.y + 30, L, .7), mustD = litc('#7A5E1C', wc.x, wc.y + 30, L, -.4), blk = litc('#15100E', wc.x, wc.y + 30, L, .3);
    const l = R.lightA;
    ctx.save(); setM(B, R.Ma);
    ctx.beginPath(); if (part === 'upper') ctx.rect(-200, cy - 200, 400, 200); else ctx.rect(-200, cy, 400, 300); ctx.clip();
    const ring = () => { ctx.ellipse(0, cy, A, Bv, 0, 0, TAU); ctx.moveTo(a, cy + 1.5); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU, true); };
    ctx.beginPath(); ring(); ctx.fillStyle = css(must); ctx.fill('evenodd');
    ctx.save(); ctx.beginPath(); ring(); ctx.clip('evenodd');
    // twisted stripes around the roll
    ctx.strokeStyle = css(blk); ctx.lineWidth = 3.2; ctx.lineCap = 'butt'; ctx.beginPath();
    for (let k = 0; k < 22; k++) {
      const t = k / 22 * TAU + .1, ca = Math.cos(t), sa = Math.sin(t);
      ctx.moveTo(ca * a * .96, cy + 1.5 + sa * b * .96); ctx.lineTo(ca * A * 1.02 + sa * 6, cy + sa * Bv * 1.02 - ca * 2);
    }
    ctx.stroke();
    // torus light: the top of the roll faces the bulb, its outer rim and the inner lip turn away
    let g = ctx.createRadialGradient(l.x * 14, cy - 10 + l.y * 4, 4, 0, cy, A * 1.05);
    g.addColorStop(0, 'rgba(255,236,190,.0)'); g.addColorStop(.55, 'rgba(255,236,190,.18)'); g.addColorStop(.8, 'rgba(10,6,4,.05)'); g.addColorStop(1, 'rgba(10,6,4,.6)');
    ctx.fillStyle = g; ctx.fillRect(-A - 4, cy - Bv - 4, 2 * A + 8, 2 * Bv + 8);
    ctx.strokeStyle = 'rgba(8,4,2,.42)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, cy + 1.5, a + 2, b + 2, 0, 0, TAU); ctx.stroke();
    g = ctx.createLinearGradient(0, cy - Bv, 0, cy + Bv); g.addColorStop(0, 'rgba(255,240,200,.30)'); g.addColorStop(.35, 'rgba(255,240,200,0)'); g.addColorStop(.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(-A - 4, cy - Bv - 4, 2 * A + 8, 2 * Bv + 8);
    ctx.restore();
    if (part !== 'upper') {
      // the dark inside of the sleeve
      g = ctx.createLinearGradient(0, cy - b, 0, cy + b);
      g.addColorStop(0, '#05030A'); g.addColorStop(.7, '#0C0812'); g.addColorStop(1, css(mixc([12, 8, 18], mustD, .5)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU); ctx.fill();
    }
    // ink
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(0, cy, A, Bv, 0, 0, TAU); ctx.moveTo(a, cy + 1.5); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  /** the violet ribbon end peeking out of the right cuff (the parcel is up that sleeve) */
  function drawRibbon(R, B, k) {
    if (k <= 0) return;
    const L = R.L, cy = -OPEN, wc = R.Ma.transformPoint(new DOMPoint(14, cy + 24));
    const v = litc('#7A3CF2', wc.x, wc.y + 20, L, .9), vd = litc('#3A1784', wc.x, wc.y + 20, L, -.2), vl = litc('#C8B4FF', wc.x, wc.y + 20, L, 1.3);
    setM(B, R.Ma);
    const e = .55 + .45 * k;
    const tail = (ctrl, w0, w1, twist, seed) => {
      // centre line (quadratic), width narrowing through a twist, swallow-tail end
      const N = 12, Lp = [], Rp = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, it = 1 - t, [a0, a1, a2] = ctrl;
        const x = it * it * a0[0] + 2 * it * t * a1[0] + t * t * a2[0], y = it * it * a0[1] + 2 * it * t * a1[1] + t * t * a2[1];
        let tx = 2 * it * (a1[0] - a0[0]) + 2 * t * (a2[0] - a1[0]), ty = 2 * it * (a1[1] - a0[1]) + 2 * t * (a2[1] - a1[1]); const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
        const w = mix(w0, w1, t) * (.35 + .65 * Math.abs(Math.cos(Math.PI * (t - twist) * 1.1))) / 2;
        Lp.push([x - ty * w, y + tx * w, tx, ty]); Rp.push([x + ty * w, y - tx * w]);
      }
      const end = Lp[N], ex = (end[0] + Rp[N][0]) / 2 - end[2] * 5, ey = (end[1] + Rp[N][1]) / 2 - end[3] * 5;
      const path = () => { ctx.moveTo(Lp[0][0], Lp[0][1]); for (const q of Lp) ctx.lineTo(q[0], q[1]); ctx.lineTo(ex, ey); for (let i = N; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]); ctx.closePath(); };
      ctx.beginPath(); path(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      const [a0, , a2] = ctrl, g = ctx.createLinearGradient(a0[0], a0[1], a2[0], a2[1]);
      g.addColorStop(0, css(vd)); g.addColorStop(cl(twist - .12), css(v)); g.addColorStop(cl(twist), css(vd)); g.addColorStop(cl(twist + .1), css(vl)); g.addColorStop(cl(twist + .3), css(v)); g.addColorStop(1, css(mixc(v, vd, .4)));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'screen';
      soft(() => { ctx.moveTo(Lp[2][0] * .6 + Rp[2][0] * .4, Lp[2][1] * .6 + Rp[2][1] * .4); ctx.lineTo(Lp[N - 2][0] * .55 + Rp[N - 2][0] * .45, Lp[N - 2][1] * .55 + Rp[N - 2][1] * .45); }, 1.6, css(vl, .7), 0, 0, 2.2);
      ctx.restore();
    };
    tail([[2, cy - 6], [-2, cy + 22 * e], [-10, cy + 44 * e]], 13, 12, .55, 1);
    tail([[12, cy - 6], [24, cy + 16 * e], [27, cy + 40 * e]], 14, 13, .35, 2);
  }

  // ======================= public =======================
  function nearParcel(f) { const p = S.parcel(f); return p.vis && (p.mode === 'rise' || p.mode === 'glass'); }
  function contactShadow(R, B) {
    // tight soft shadow where the glove touches a container roof (the cloth case is in armShadow)
    const c = R.roof; if (!c || R.P.z > 20) return;
    const L = R.L, { k, v } = lightAt(c.x, c.y - G.cd / 2, L), a = (.55 * Math.max(k, .2) + .2 * v) * (1 - (R.h.cuffIn || 0));
    if (a < .02) return;
    const l = R.lightL;
    ctx.save(); setM(B, R.Mh);
    soft(() => unionPath(R, p => !(p.kind === 'finger' && p.lift > .05)), 2.8, `rgba(8,4,16,${a.toFixed(3)})`, -l.x * 3.5, -l.y * 3.5 + 2);
    for (const p of R.parts) if (p.kind === 'finger' && p.lift > .05) {   // a raised finger's shadow lands further away
      const off = 4 + 17 * p.lift, Lf = FL1[p.i] + FL2[p.i] - 4, cps = [[p.B.x, p.B.y, p.r0, p.B.x + Math.sin(p.spec.yaw) * Lf, p.B.y + Math.cos(p.spec.yaw) * Lf, FR[p.i]]];
      soft(() => capsule(...cps[0]), 2.4 + 2.2 * p.lift, `rgba(8,4,16,${Math.min(.7, a * 1.15 * (1 - .25 * p.lift)).toFixed(3)})`, -l.x * off, -l.y * off + 3);
    }
    ctx.restore();
  }
  /** the arm end (sleeve roll, contact shadow, glove, ribbon) in the forearm frame, drawn with base transform B */
  function drawEnd(R, B, o) {
    if (!dbg.noRoll) drawRoll(R, B, 'lower');
    if (!dbg.noContact) contactShadow(R, B);
    if (!dbg.noGlove) drawGlove(R, B, 'all');
    if (R.side === 'R') drawRibbon(R, B, (o && o.ribbon) || 0);
    drawRoll(R, B, 'upper');
  }
  // The arm end is rigid within one frame: it is rendered ONCE per frame into a sprite (1.25× oversampled, in the forearm
  // frame) and placed with each motion-blur sub-frame's own forearm matrix. The sleeve itself is drawn per sub-frame.
  const SPR = { L: null, R: null, F: null }, SQ = 1.25;
  function endSprite(side, h, f, L, o, camS, mode) {
    const n = Math.round(f), still = !!h.noSmear, slot = mode === 'fingers' ? 'F' : side;
    camS = Math.round(camS * 20) / 20;     // the camera breathes ±3 % within a frame: the oversampled sprite absorbs it
    const key = [side, mode || 'end', still ? f : n, still ? h.x + ',' + h.y + ',' + h.s : '', o.bump || 0, o.ribbon || 0, camS].join('|');
    let sp = SPR[slot]; if (sp && sp.key === key) return sp;
    const hn = still ? h : S.hand(side, n), Ln = still ? L : S.light(n);
    const Rc = frame(side, hn, still ? f : n, Ln, o);
    // content box in forearm units: the roll, the cuff and every part of the hand (+ ink, shadow, rays, ribbon)
    let bx0 = -64, by0 = -96, bx1 = 64, by1 = 4;
    const toA = Rc.Ma.inverse().multiply(Rc.Mh);
    for (const p of Rc.parts) {
      const pts2 = p.kind === 'palm' ? [[-42, -10], [42, -10], [-42, 70 * p.fy], [42, 70 * p.fy]] : p.caps.flatMap(c => [[c[0] - c[2], c[1] - c[2]], [c[0] + c[2], c[1] + c[2]], [c[3] - c[5], c[4] - c[5]], [c[3] + c[5], c[4] + c[5]]]);
      for (const [x, y] of pts2) { const q = toA.transformPoint(new DOMPoint(x, y)); bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); by0 = Math.min(by0, q.y); by1 = Math.max(by1, q.y); }
    }
    const mg = 24 + (o.ribbon ? 30 : 0);
    const SX = Math.floor(bx0 - mg), SY = Math.floor(by0 - 8), SWc = Math.ceil(bx1 + mg) - SX, SHc = Math.ceil(by1 + mg + 8) - SY;
    const k = Rc.s * camS * SQ, w = Math.ceil(SWc * k), hh2 = Math.ceil(SHc * k);
    if (!sp || sp.cv.width < w || sp.cv.height < hh2) sp = SPR[slot] = { cv: makeCanvas(Math.max(w, sp ? sp.cv.width : 0), Math.max(hh2, sp ? sp.cv.height : 0)) };
    const g = sp.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w + 2, hh2 + 2);
    const Spr = new DOMMatrix().scaleSelf(k, k).translateSelf(-SX, -SY);
    const Bs = Spr.multiply(Rc.Ma.inverse());
    const saved = ctx; ctx = g;
    try {
      g.save();
      if (mode === 'fingers') {       // the fingers that come over the parcel's top edge, with their contact shadow on the kraft
        const l = Rc.lightL; setM(Bs, Rc.Mh);
        soft(() => unionPath(Rc, q => q.kind === 'finger'), 3.5, 'rgba(40,20,6,.45)', -l.x * 4, -l.y * 4 + 3);
        drawGlove(Rc, Bs, 'fingers');
      } else drawEnd(Rc, Bs, o);
      g.restore();
    } finally { ctx = saved; }
    sp.key = key; sp.inv = Spr.inverse(); sp.w = w; sp.h = hh2;
    return sp;
  }
  function arm(side, h, f, L, o) {
    if (!h) return;
    o = o || {};
    const R = frame(side, h, f, L, o), B = ctx.getTransform();
    ctx.save();
    if (!dbg.noSleeve) drawSleeve(R, B);
    if (dbg.direct) drawEnd(R, B, o);
    else {
      const sp = endSprite(side, h, f, L, o, Math.sqrt(Math.abs(B.a * B.d - B.b * B.c)));
      ctx.setTransform(B.multiply(R.Ma).multiply(sp.inv)); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(sp.cv, 0, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
    }
    ctx.restore(); ctx.setTransform(B);
  }
  /** the parcel's silhouette near the lens (same maths as P_parcel): x0..x1, top (back edge of the top face)..bottom */
  function parcelBox(p) {
    const s = p.s || 1, sq = cl(p.squash || 0, 0, .5), near = cl((s - 1) / 2.4);
    const Wd = G.pw * s * (1 + .5 * sq), Hf = G.ph * s * (1 + .22 * sq), Dt = G.pd * s * (1 - .66 * near) * Math.max(.06, 1 - 3.6 * sq);
    const yb = p.y + 40 * s + .12 * Hf * sq;
    return { x0: p.x - Wd / 2, x1: p.x + Wd / 2, top: yb - Hf - Dt, front: yb - Hf, bot: yb };
  }
  function holdFront(h, f, L) {
    if (!h || h.pose !== 'hold') return;
    const p = S.parcel(f); if (!p.vis) return;
    const R = frame('R', h, f, L, {}), B = ctx.getTransform(), bx = parcelBox(p);
    ctx.save(); ctx.setTransform(B);
    // the hand is behind the box: only the fingers that come over its top edge are in front of it
    ctx.beginPath(); ctx.rect(bx.x0 - 2, bx.top + 1, bx.x1 - bx.x0 + 4, bx.bot - bx.top + 2); ctx.clip();
    // same timing as the arm-end sprite (frozen at the frame, placed at this sub-frame) so the two always agree
    const sp = endSprite('R', h, f, L, {}, Math.sqrt(Math.abs(B.a * B.d - B.b * B.c)), 'fingers');
    ctx.setTransform(B.multiply(R.Ma).multiply(sp.inv)); ctx.drawImage(sp.cv, 0, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
    ctx.restore(); ctx.setTransform(B);
  }
  function armShadow(side, h, f, L, o) {
    if (!h) return;
    const R = frame(side, h, f, L, o), B = ctx.getTransform();
    const { pts } = tube(R);
    const zH = R.roof ? G.ch + R.roof.z : (R.P.z || 3);
    const { k, v } = lightAt(R.W.x, R.W.y + 60, L);
    const zA = zH + 55, a = (.62 * Math.max(k, .25) + .25 * v) * (1 - Math.min(.6, zA / 400)) * 1.1;
    if (a < .01) return;
    ctx.save(); ctx.setTransform(B);
    const off = p => { const z = zA + p.u * .2, o2 = v > .5 ? { x: 0, y: 10 + z * .5 } : shadowOff(p.x, p.y + 60, z, L); return o2; };
    // two-step feather (no blur): crisp enough to show the parcel's square bump
    let vis = pts.length; for (let i = 0; i < pts.length; i++) if (pts[i].y < -90) { vis = i + 1; break; }
    const sp = pts.slice(0, Math.max(2, vis)), fw = 7 + zA * .03;
    feather(() => tubePath(sp, off), fw, a);
    // the glove (skipped up near the lens: far above the cloth)
    if (R.s < 1.25) {
      const o2 = v > .5 ? { x: 0, y: 10 + zH * .5 } : shadowOff(R.W.x, R.W.y + 50, zH, L);
      const ag = (.62 * Math.max(k, .25) + .25 * v) * (1 - Math.min(.6, zH / 400)) * (1 - (h.cuffIn || 0));
      ctx.setTransform(B.translate(o2.x, o2.y).multiply(R.Mh));
      if (ag > .01) feather(() => unionPath(R), 0, ag, true);
    }
    ctx.restore(); ctx.setTransform(B);
  }
  /** a soft-edged shadow without a blur: a wide faint rim outside + the body; both under one alpha (no double darkening) */
  function feather(pathFn, w, a, lite) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,4,18,1)'; ctx.fillStyle = 'rgba(8,4,18,1)';
    ctx.beginPath(); pathFn();
    if (lite) { ctx.globalAlpha = a * .8; ctx.fill(); ctx.restore(); return; }
    ctx.globalAlpha = a * .4; ctx.lineWidth = w; ctx.stroke();
    ctx.globalAlpha = a * .62; ctx.fill();
    ctx.restore();
  }
  function ringPos(h, f) {
    const L = S.light(f), R = frame('L', h, f, L, {});
    const g = ringAt(R); if (!g) return { x: h.x, y: h.y + 66 * (h.s || 1) };
    const q = R.Mh.transformPoint(new DOMPoint(g.x, g.y));
    return { x: q.x, y: q.y };
  }
  return { arm, armShadow, holdFront, ringPos, posePar, frame, waxTex, dbg };
})();
function H_arm(side, h, f, L, o) { return H_K.arm(side, h, f, L, o || {}); }
function H_armShadow(side, h, f, L, o) { return H_K.armShadow(side, h, f, L, o || {}); }
function H_holdFront(h, f, L) { return H_K.holdFront(h, f, L); }
function H_ringPos(h, f) { return H_K.ringPos(h, f); }
