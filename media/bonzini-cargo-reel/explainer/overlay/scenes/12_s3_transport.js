'use strict';
// ============================================================================================
// s3 « 03 · LE TRANSPORT » — animated dot-matrix map (Natural Earth, Mercator) China -> Gulf of
// Guinea by sea, then a continuous "dive" into a local last-mile view: truck -> warehouse.
// Data: 12_map_data.js (window.BZ_MAP, baked by tools/map/bake.py). All times from TL.
// Also exposes window.BZICON (ship / truck / warehouse) for 18_recap.js.
// ============================================================================================
(() => {
  const M = window.BZ_MAP;
  if (!M) { console.error('BZ_MAP missing'); return; }
  const Q = 0.1;
  const AX = 540, AY = 715;                 // camera anchor on screen (centre of content zone)
  const MASK_Y = [296, 400, 1050, 1146];    // map layer vertical fade (0 -> 1 -> 1 -> 0)
  const merc = lat => -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;

  // ---------------- decode map data ----------------
  const mkPath = rings => {
    const p = new Path2D();
    for (const r of rings) { p.moveTo(r[0] * Q, r[1] * Q); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i] * Q, r[i + 1] * Q); p.closePath(); }
    return p;
  };
  const LAND = mkPath(M.land), CHINA = mkPath(M.china);
  const cset = new Set();
  for (const r of M.cdots) for (let k = 1; k < r.length; k += 2) for (let i = r[k]; i <= r[k + 1]; i++) cset.add(r[0] * 100000 + i);
  const DXa = [], DYa = [], DCa = [];
  for (const r of M.dots) for (let k = 1; k < r.length; k += 2) for (let i = r[k]; i <= r[k + 1]; i++) {
    DXa.push(M.grid.x0 + i * M.grid.step); DYa.push(M.grid.y0 + r[0] * M.grid.step); DCa.push(cset.has(r[0] * 100000 + i) ? 1 : 0);
  }
  const ND = DXa.length, DX = Float32Array.from(DXa), DY = Float32Array.from(DYa), DC = Uint8Array.from(DCa);
  const DS = Float32Array.from({ length: ND }, (_, i) => rnd(i * 1.37 + 5.1));
  // China label anchor: centroid of China dots, biased south (the populated, visible part)
  let ccx = 0, ccy = 0, cn = 0; for (let i = 0; i < ND; i++) if (DC[i]) { ccx += DX[i]; ccy += DY[i]; cn++; }
  const CHN = [ccx / cn + 3, ccy / cn + 5];
  // route
  const RP = []; for (let i = 0; i < M.route.length; i += 2) RP.push([M.route[i] * .01, M.route[i + 1] * .01]);
  const RL = [0]; for (let i = 1; i < RP.length; i++) RL.push(RL[i - 1] + Math.hypot(RP[i][0] - RP[i - 1][0], RP[i][1] - RP[i - 1][1]));
  const RT = RL[RL.length - 1];
  function routeAt(f) {
    const d = clamp(f) * RT; let lo = 0, hi = RL.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RL[m] <= d) lo = m; else hi = m; }
    const k = RL[hi] > RL[lo] ? (d - RL[lo]) / (RL[hi] - RL[lo]) : 0;
    return [lerp(RP[lo][0], RP[hi][0], k), lerp(RP[lo][1], RP[hi][1], k)];
  }
  // smoothed heading along the route -> facing (+1 right / -1 left, with hysteresis) and tilt
  const FACE = []; { let f = -1; for (let i = 0; i < RP.length; i++) {
    const a = RP[Math.max(0, i - 6)], b = RP[Math.min(RP.length - 1, i + 6)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) / L > .66) f = Math.sign(dx); FACE.push(f); } }
  function headingAt(f) {
    const a = routeAt(f - .012), b = routeAt(f + .012); const dx = b[0] - a[0], dy = b[1] - a[1];
    let face = 0, n = 0; for (let k = -8; k <= 8; k++) { const d = clamp(f + k * .0022) * RT; let i = 0; while (i < RL.length - 1 && RL[i] < d) i++; face += FACE[i]; n++; }
    face /= n; const sf = Math.sign(face) || 1;
    return { face: sf * Math.max(.18, Math.abs(face)), tilt: clamp(Math.atan2(dy, Math.abs(dx) + 1e-6), -.3, .3) };
  }
  const ORIGIN = [M.pts.origin[0] * Q, M.pts.origin[1] * Q];
  const DEST = [M.pts.dest[0] * Q, M.pts.dest[1] * Q];
  const ANCH = RP[RP.length - 1];           // ship's final position = dive anchor

  // ---------------- offscreen layers ----------------
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [LC, lctx] = mk(W, H);              // map / local layer (masked)
  const [BC, bctx] = mk(W / 4, H / 4);      // bloom
  function onLayer(fn) { const main = ctx; ctx = lctx; ctx.save(); try { fn(); } finally { ctx.restore(); ctx = main; } }

  // ---------------- timing (all from TL) ----------------
  function times() {
    const ch = TL.ch('s3'), sg = TL.seg('V05'); const w = (s, d) => TL.wt('V05', s, sg.start + d);
    const T = { ch0: ch.start, ch1: ch.end, v0: sg.start, v1: sg.end,
      transport: w('transport', 1.2), conteneur: w('conteneur', 2.3), traverse: w('traverse', 2.8), ocean: w('locean', 3.2), bateau: w('bateau', 3.8),
      chine: w('chine', 4.7), afrique: w('afrique', 5.4), puis: w('puis', 6.1), camion: w('camion', 7.7), entrepot: w('entrepot', 8.8) };
    T.prev0 = T.conteneur + .35; T.prev1 = T.traverse + .55;          // dashed course preview
    T.dep = T.traverse + .25; T.arr = T.afrique + .3;                 // ship voyage
    T.d0 = T.puis - .06; T.d1 = T.d0 + 1.08;                           // dive
    T.x0 = Math.max(T.d1 - .05, T.camion - .62); T.x1 = Math.max(T.camion - .04, T.x0 + .45); // container transfer ship -> truck
    T.tr0 = Math.max(T.camion, T.x1 + .02); T.tr1 = Math.max(T.entrepot + .12, T.tr0 + 1.0);      // truck drive
    return T;
  }

  // ---------------- camera ----------------
  function camKeys(T) {
    return [
      { t: T.v0, lon: 64, lat: -5, z: 7.6 },
      { t: T.transport + .75, lon: 61, lat: -8, z: 8.3 },
      { t: T.conteneur + .95, lon: 95, lat: 12, z: 11.6 },
      { t: T.bateau + .8, lon: 60, lat: -9, z: 8.35 },
      { t: T.afrique + .5, lon: 15, lat: -1, z: 17.5 },
      { t: T.d0, lon: 14.2, lat: -.2, z: 18.6 },
    ].map(k => ({ t: k.t, x: k.lon, y: merc(k.lat), l: Math.log(k.z) }))
     .map((k, i, a) => { if (i) k.t = Math.max(k.t, a[i - 1].t + .2); return k; });
  }
  function spline(K, t) {
    if (t <= K[0].t) return K[0]; if (t >= K[K.length - 1].t) return K[K.length - 1];
    let i = 0; while (t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], h = b.t - a.t, s = (t - a.t) / h;
    const tan = (k, f) => (k <= 0 || k >= K.length - 1) ? 0 : (K[k + 1][f] - K[k - 1][f]) / (K[k + 1].t - K[k - 1].t) * .85;
    const h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s, h11 = s ** 3 - s * s;
    const o = {}; for (const f of ['x', 'y', 'l']) o[f] = h00 * a[f] + h10 * h * tan(i, f) + h01 * b[f] + h11 * h * tan(i + 1, f);
    return o;
  }
  const DIVE = 24;
  // local (last-mile) view, screen coordinates at the end of the dive
  const L = {
    dock: [196, 1004],          // ship waterline centre (= dive anchor)
    coast: [[-3200, 850], [-600, 866], [-80, 884], [110, 898], [262, 922], [372, 960], [446, 1022], [492, 1100], [516, 1190], [534, 1300], [600, 1700], [760, 3400]],
    pier: [[96, 897], [262, 922], [376, 961], [388, 945], [270, 904], [100, 880]],
    crane: [318, 928],
    road: [[418, 944], [470, 922], [520, 880], [578, 850], [650, 840], [736, 840]],
    wh: [868, 826], whW: 290,
    truck0: 184, pinTip: [868, 590],
  };
  function camera(t, T) {
    const K = camKeys(T);
    if (t < T.d0) { const c = spline(K, t); return { cx: c.x, cy: c.y, z: Math.exp(c.l), u: 0 }; }
    const c0 = spline(K, T.d0), z0 = Math.exp(c0.l);
    const pa0 = [AX + (ANCH[0] - c0.x) * z0, AY + (ANCH[1] - c0.y) * z0];
    const u = eInOutCubic(prog(t, T.d0, T.d1)), up = eInOutCubic(prog(t, T.d0, T.d1 - .1));
    const z = z0 * Math.pow(DIVE, u);
    const pa = [lerp(pa0[0], L.dock[0], up), lerp(pa0[1], L.dock[1], up)];
    return { cx: ANCH[0] - (pa[0] - AX) / z, cy: ANCH[1] - (pa[1] - AY) / z, z, u, pa, pa0 };
  }
  const S = (c, x, y) => [AX + (x - c.cx) * c.z, AY + (y - c.cy) * c.z];

  // ---------------- icons (exported for the recap) ----------------
  function containerBox(x, y, w, h, fill, o = {}) {
    ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 18; }
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(10,5,25,.55)'; ctx.lineWidth = Math.max(1, w * .05);
    const n = Math.max(3, Math.round(w / (h * .32)));
    ctx.beginPath(); for (let i = 1; i < n; i++) { const xx = x + w * i / n; ctx.moveTo(xx, y + h * .16); ctx.lineTo(xx, y + h * .84); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = Math.max(1, h * .07); ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  /** side-view container ship; (x,y) = waterline centre; L = length; o.face ±1, o.tilt, o.our (0..1 our container on board), o.drop (0..1 drop-in) */
  function drawShip(x, y, Ls, o = {}) {
    const s = Ls; ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.translate(x, y); ctx.scale(o.face ?? 1, 1); ctx.rotate(o.tilt || 0);
    // containers
    const cw = s * .098, chh = s * .085, x0 = -s * .29, deck = -s * .055;
    const pal = ['#7C44D8', '#3D2A86', '#C9D8F2', '#F3A745', '#5B34B0', '#8E5BEA', '#2E2466', '#D7C3FF'];
    for (let c = 0; c < 6; c++) for (let r = 0; r < (c === 0 || c === 5 ? 1 : 2); r++) {
      if (c === 3 && r === 1) continue;                      // slot of our container
      containerBox(x0 + c * (cw + s * .006), deck - (r + 1) * chh, cw, chh - s * .006, pal[(c * 3 + r * 5) % pal.length]);
    }
    const our = o.our ?? 1;
    if (our > 0) {
      const d = o.drop ?? 1, e = eOutCubic(d), oy = -(1 - e) * s * .75, k = lerp(2.6, 1, e);
      const bx = x0 + 3 * (cw + s * .006) + cw / 2, by = deck - 2 * chh + (chh - s * .006) / 2 + oy;
      containerBox(bx - cw * k / 2, by - (chh - s * .006) * k / 2, cw * k, (chh - s * .006) * k, ORANGE, { alpha: our * clamp(d * 4), glow: ORANGE, glowBlur: s * (.22 + .3 * (1 - e)) });
    }
    // hull
    ctx.beginPath(); ctx.moveTo(-s * .49, -s * .06); ctx.lineTo(s * .40, -s * .06); ctx.lineTo(s * .53, -s * .135);
    ctx.quadraticCurveTo(s * .49, s * .04, s * .41, s * .125); ctx.lineTo(-s * .40, s * .125); ctx.lineTo(-s * .495, s * .02); ctx.closePath();
    const g = ctx.createLinearGradient(0, -s * .1, 0, s * .13); g.addColorStop(0, '#2A1B54'); g.addColorStop(1, '#120B28');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(169,71,254,.9)'; ctx.shadowBlur = s * .16; ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.clip(); ctx.fillStyle = VIOLET; ctx.fillRect(-s * .6, s * .062, s * 1.2, s * .07); ctx.restore();
    ctx.strokeStyle = ICE; ctx.lineWidth = Math.max(1.5, s * .018); ctx.lineJoin = 'round'; ctx.stroke();
    // bridge + funnel
    ctx.fillStyle = '#EAF6FF'; rrect(-s * .47, -s * .31, s * .14, s * .25, s * .015); ctx.fill();
    ctx.fillStyle = '#231648'; ctx.fillRect(-s * .455, -s * .28, s * .11, s * .035);
    ctx.fillStyle = ORANGE; ctx.fillRect(-s * .445, -s * .37, s * .05, s * .06);
    // bow mast
    ctx.strokeStyle = 'rgba(234,246,255,.85)'; ctx.lineWidth = Math.max(1, s * .01);
    ctx.beginPath(); ctx.moveTo(s * .43, -s * .07); ctx.lineTo(s * .43, -s * .2); ctx.stroke();
    ctx.restore();
  }
  /** side-view truck, facing right; (x,y) = road contact centre; L = length; o.box (0..1 container on trailer), o.roll (wheel angle) */
  function drawTruck(x, y, Lt, o = {}) {
    const s = Lt; ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.translate(x, y); ctx.scale(o.face ?? 1, 1); ctx.rotate(o.tilt || 0);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, s * .52, s * .035, 0, 0, Math.PI * 2); ctx.fill();
    // chassis
    ctx.fillStyle = '#140C2C'; rrect(-s * .5, -s * .15, s * .99, s * .06, s * .02); ctx.fill();
    ctx.strokeStyle = 'rgba(234,246,255,.5)'; ctx.lineWidth = Math.max(1, s * .012); ctx.stroke();
    // container
    if ((o.box ?? 1) > 0) containerBox(-s * .48, -s * .43, s * .70, s * .28, ORANGE, { alpha: o.box ?? 1, glow: ORANGE, glowBlur: s * .12 });
    // cab
    ctx.beginPath(); ctx.moveTo(s * .25, -s * .15); ctx.lineTo(s * .25, -s * .40); ctx.lineTo(s * .40, -s * .40); ctx.lineTo(s * .495, -s * .25); ctx.lineTo(s * .50, -s * .15); ctx.closePath();
    const g = ctx.createLinearGradient(0, -s * .4, 0, -s * .15); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#BFD2EE');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(169,71,254,.8)'; ctx.shadowBlur = s * .1; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#261A4E'; ctx.beginPath(); ctx.moveTo(s * .36, -s * .37); ctx.lineTo(s * .40, -s * .37); ctx.lineTo(s * .47, -s * .26); ctx.lineTo(s * .36, -s * .26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = AMBER; ctx.fillRect(s * .25, -s * .215, s * .25, s * .022);
    ctx.fillStyle = '#FFE7B0'; ctx.shadowColor = AMBER; ctx.shadowBlur = s * .08; ctx.fillRect(s * .485, -s * .2, s * .02, s * .03); ctx.shadowBlur = 0;
    // wheels
    for (const wx of [-.38, -.25, .05, .37]) {
      const cx = s * wx, cy = -s * .075, r = s * .072;
      ctx.fillStyle = '#0B0718'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ICE; ctx.lineWidth = Math.max(1, s * .014); ctx.stroke();
      ctx.strokeStyle = 'rgba(234,246,255,.6)'; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const a = (o.roll || 0) + k * Math.PI * 2 / 3; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * .7, cy + Math.sin(a) * r * .7); }
      ctx.stroke();
    }
    ctx.restore();
  }
  /** front-view warehouse; (x,y) = base centre; w = width; o.door (0..1 lit), o.alpha */
  function drawWarehouse(x, y, w, o = {}) {
    const h = w * .56, rh = w * .2; ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.translate(x, y);
    // body
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h); ctx.lineTo(0, -h - rh); ctx.lineTo(w / 2, -h); ctx.lineTo(w / 2, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h - rh, 0, 0); g.addColorStop(0, '#3B2380'); g.addColorStop(1, '#170D35');
    ctx.fillStyle = g; ctx.shadowColor = VIOLET; ctx.shadowBlur = w * .12; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = ICE; ctx.lineWidth = Math.max(2, w * .016); ctx.lineJoin = 'round'; ctx.stroke();
    // roof band
    ctx.strokeStyle = 'rgba(234,246,255,.45)'; ctx.lineWidth = Math.max(1, w * .008);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h + w * .05); ctx.lineTo(0, -h - rh + w * .05); ctx.lineTo(w / 2, -h + w * .05); ctx.stroke();
    // door
    const dw = w * .44, dh = h * .66, dl = o.door || 0;
    ctx.fillStyle = '#0B0718'; ctx.fillRect(-dw / 2, -dh, dw, dh);
    if (dl > 0) { const dg = ctx.createLinearGradient(0, -dh, 0, 0); dg.addColorStop(0, `rgba(243,167,69,${.25 * dl})`); dg.addColorStop(1, `rgba(254,170,80,${.95 * dl})`);
      ctx.fillStyle = dg; ctx.shadowColor = AMBER; ctx.shadowBlur = w * .2 * dl; ctx.fillRect(-dw / 2, -dh, dw, dh); ctx.shadowBlur = 0; }
    ctx.strokeStyle = 'rgba(234,246,255,.35)'; ctx.lineWidth = Math.max(1, w * .007); ctx.beginPath();
    for (let i = 1; i < 7; i++) { const yy = -dh + dh * i / 7 * (1 - .0); ctx.moveTo(-dw / 2 + 2, yy); ctx.lineTo(dw / 2 - 2, yy); } ctx.stroke();
    ctx.strokeStyle = ICE; ctx.lineWidth = Math.max(1.5, w * .012); ctx.strokeRect(-dw / 2, -dh, dw, dh);
    // windows
    for (const sx of [-1, 1]) { ctx.fillStyle = 'rgba(243,167,69,.85)'; ctx.shadowColor = AMBER; ctx.shadowBlur = w * .05;
      ctx.fillRect(sx * w * .36 - w * .05, -h * .72, w * .1, h * .16); ctx.shadowBlur = 0; }
    ctx.restore();
  }
  window.BZICON = { drawShip, drawTruck, drawWarehouse, containerBox };

  // ---------------- small helpers ----------------
  function label(s, x, y, a, o = {}) {       // plate label centred at (x, y centre)
    if (a <= 0) return;
    const size = o.size || 54, font = `800 ${size}px ${FONT.body}`, tw = measure(s, font, o.ls ?? 1);
    const pw = tw + (o.padX ?? 30) * 2 + (o.icon ? size * 1.05 : 0), ph = o.h || size * 1.62;
    let px = x - pw / 2; px = clamp(px, 38, W - 38 - pw);
    const k = eOutBack(clamp(a)), py = y - ph / 2 + (1 - eOutCubic(clamp(a))) * 18;
    ctx.save(); ctx.globalAlpha *= clamp(a * 1.4);
    ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(.86 + .14 * k, .86 + .14 * k); ctx.translate(-(px + pw / 2), -(py + ph / 2));
    plate(px, py, pw, ph, { r: ph / 2, border: o.border || AMBER, lw: 3, fill: 'rgba(12,7,28,.9)' });
    let tx = px + (o.padX ?? 30);
    if (o.icon) { o.icon(tx + size * .42, py + ph / 2, size * .82); tx += size * 1.05; }
    txt(s, tx, py + ph / 2 + size * .36, { font, color: o.color || '#FFFFFF', ls: o.ls ?? 1 });
    ctx.restore();
    return { px, py, pw, ph };
  }
  const shipGlyph = (x, y, s) => drawShip(x, y + s * .12, s * 1.05, { face: 1 });
  const truckGlyph = (x, y, s) => drawTruck(x, y + s * .22, s * 1.05, {});

  // ---------------- local (last-mile) scene ----------------
  const SEA = new Path2D(); { const c = L.coast; SEA.moveTo(c[0][0], c[0][1]); for (const p of c.slice(1)) SEA.lineTo(p[0], p[1]); SEA.lineTo(-3200, 3400); SEA.closePath(); }
  const LANDL = new Path2D(); LANDL.rect(-3200, -3200, 7000, 6600); LANDL.addPath(SEA);
  const DOTPAT = (() => { const [c, x] = mk(24, 24); x.fillStyle = 'rgba(196,170,255,.5)'; x.beginPath(); x.arc(6, 6, 2.6, 0, Math.PI * 2); x.arc(18, 18, 2.6, 0, Math.PI * 2); x.fill(); return lctx.createPattern(c, "repeat"); })();
  const WAVES = []; { const [, tx] = mk(8, 8); for (let i = 0; i < 40 && WAVES.length < 14; i++) { const wx = -40 + rnd(i * 3.3) * 470, wy = 930 + rnd(i * 5.1) * 200;
    if (tx.isPointInPath(SEA, wx - 20, wy - 12) && tx.isPointInPath(SEA, wx + 20, wy - 12) && Math.hypot(wx - L.dock[0], wy - L.dock[1]) > 90) WAVES.push([wx, wy, i * 1.7]); } }
  // road as dense polyline
  const ROAD = (() => { const P = L.road, out = []; const Pp = [P[0], ...P, P[P.length - 1]];
    for (let i = 1; i < Pp.length - 2; i++) for (let k = 0; k < 12; k++) { const t = k / 12, p0 = Pp[i - 1], p1 = Pp[i], p2 = Pp[i + 1], p3 = Pp[i + 2];
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t))); }
    out.push(P[P.length - 1]); return out; })();
  const RDL = [0]; for (let i = 1; i < ROAD.length; i++) RDL.push(RDL[i - 1] + Math.hypot(ROAD[i][0] - ROAD[i - 1][0], ROAD[i][1] - ROAD[i - 1][1]));
  const RDT = RDL[RDL.length - 1], TD0 = L.truck0 * .5 + 6, TD1 = RDT - L.truck0 * .5 - 20;
  const truckD = (t, T) => lerp(TD0, TD1, eInOutCubic(prog(t, T.tr0, T.tr1)));
  function roadAt(f) { const d = clamp(f) * RDL[RDL.length - 1]; let i = 1; while (i < RDL.length - 1 && RDL[i] < d) i++;
    const k = (d - RDL[i - 1]) / (RDL[i] - RDL[i - 1] || 1); const a = ROAD[i - 1], b = ROAD[i];
    return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }

  function drawLocal(t, T, a, sc) {       // in local coordinates (the caller sets the transform; sc = its scale)
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    // land (faint fill + dot-matrix pattern) and sea
    ctx.fillStyle = 'rgba(14,8,34,.94)'; ctx.fillRect(-3200, -3200, 7000, 6600);
    ctx.fillStyle = 'rgba(150,80,255,.14)'; ctx.fill(LANDL, 'evenodd');
    ctx.save(); ctx.globalAlpha *= clamp((sc - .12) / .35); ctx.fillStyle = DOTPAT; ctx.fill(LANDL, 'evenodd'); ctx.restore();
    const sg = ctx.createLinearGradient(0, 860, 0, 1150); sg.addColorStop(0, 'rgba(40,90,160,.20)'); sg.addColorStop(1, 'rgba(20,40,110,.30)');
    ctx.fillStyle = sg; ctx.fill(SEA);
    // waves
    ctx.strokeStyle = 'rgba(92,240,255,.28)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
    for (const w of WAVES) { const dx = Math.sin(t * 1.4 + w[2]) * 8; ctx.moveTo(w[0] - 14 + dx, w[1]); ctx.quadraticCurveTo(w[0] + dx, w[1] - 7, w[0] + 14 + dx, w[1]); }
    ctx.stroke();
    // coast
    ctx.save(); ctx.strokeStyle = 'rgba(234,246,255,.75)'; ctx.lineWidth = 3 / Math.max(.35, sc); ctx.shadowColor = VIOLET; ctx.shadowBlur = 14; ctx.beginPath();
    L.coast.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    // pier (quay platform) + yard pad in front of the warehouse
    ctx.save(); ctx.beginPath(); L.pier.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = '#1C1240'; ctx.fill(); ctx.strokeStyle = 'rgba(234,246,255,.8)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = AMBER; for (let i = 0; i < 5; i++) { const k = (i + .5) / 5, x = lerp(110, 370, k), y = lerp(899, 958, k * k * .6 + k * .4) + 1; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    { const g = ctx.createRadialGradient(L.wh[0], L.wh[1] + 4, 0, L.wh[0], L.wh[1] + 4, L.whW * .75); g.addColorStop(0, 'rgba(8,5,20,.7)'); g.addColorStop(1, 'rgba(8,5,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(L.wh[0], L.wh[1] + 4, L.whW * .75, 34, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // road
    const rp = ROAD;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); rp.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = 'rgba(234,246,255,.5)'; ctx.lineWidth = 46; ctx.stroke();
    ctx.strokeStyle = '#0D0820'; ctx.lineWidth = 40; ctx.stroke();
    ctx.setLineDash([16, 14]); ctx.lineDashOffset = 0; ctx.strokeStyle = 'rgba(234,246,255,.55)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // progress glow on the road
    const pr = truckD(t, T) / RDT;
    if (t > T.tr0) polyline(rp, pr, AMBER, 7, AMBER);
    ctx.restore();
  }

  // ---------------- the scene ----------------
  registerScene({
    id: 's3_transport', z: 10,
    when: t => { const c = TL.ch('s3'); return t >= c.start && t < c.end; },
    draw(t) {
      const T = times(); const A = env(t, T.ch0, T.ch1, .35, .35);
      mgBackground(t, .88 * A, { cy: 715 });
      if (t < T.v0 - .02) return;
      const C = camera(t, T), u = C.u;
      const kMap = 1 - Math.max(prog(u, .75, 1), prog(irisR(t, T), 750, 1250)), kLoc = u > .12 ? 1 : 0;
      const reveal = prog(t, T.v0, T.transport + .9);

      // ===== layer: map + route + local scene (masked, bloomed) =====
      lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
      onLayer(() => {
        if (kMap > 0) {
          ctx.globalAlpha = kMap;
          // graticule
          const gA = .09 * eOutCubic(prog(t, T.v0, T.v0 + 1));
          if (gA > 0) {
            ctx.strokeStyle = `rgba(169,71,254,${gA})`; ctx.lineWidth = 1; ctx.beginPath();
            for (let lon = -40; lon <= 170; lon += 10) { const x = S(C, lon, 0)[0]; if (x > -2 && x < W + 2) { ctx.moveTo(x, 250); ctx.lineTo(x, 1180); } }
            for (let lat = -60; lat <= 70; lat += 10) { const y = S(C, 0, merc(lat))[1]; if (y > 250 && y < 1180) { ctx.moveTo(0, y); ctx.lineTo(W, y); } }
            ctx.stroke();
            ctx.strokeStyle = `rgba(234,246,255,${gA * 1.6})`; ctx.lineWidth = 1.5; ctx.beginPath();
            for (let lon = -40; lon <= 170; lon += 10) for (let lat = -60; lat <= 70; lat += 10) { const p = S(C, lon, merc(lat)); if (p[0] > 0 && p[0] < W && p[1] > 250 && p[1] < 1180) { ctx.moveTo(p[0] - 5, p[1]); ctx.lineTo(p[0] + 5, p[1]); ctx.moveTo(p[0], p[1] - 5); ctx.lineTo(p[0], p[1] + 5); } }
            ctx.stroke();
          }
          // land fill + coast (map units)
          const lr = eOutCubic(prog(t, T.v0 + .2, T.transport + .6));
          if (lr > 0) {
            ctx.save(); ctx.setTransform(C.z, 0, 0, C.z, AX - C.cx * C.z, AY - C.cy * C.z);
            ctx.globalAlpha = kMap * lr; ctx.fillStyle = 'rgba(150,80,255,.13)'; ctx.fill(LAND, 'evenodd');
            ctx.strokeStyle = 'rgba(214,196,255,.55)'; ctx.lineWidth = 1.3 / C.z; ctx.lineJoin = 'round'; ctx.stroke(LAND);
            const ch = eOutCubic(prog(t, T.conteneur - .1, T.conteneur + .7));
            if (ch > 0) { ctx.globalAlpha = kMap * ch; ctx.fillStyle = 'rgba(243,167,69,.20)'; ctx.fill(CHINA, 'evenodd');
              ctx.strokeStyle = AMBER; ctx.lineWidth = 2.2 / C.z; ctx.stroke(CHINA); }
            ctx.restore();
          }
          // dots
          const r0 = Math.max(1.4, Math.min(C.z * .27, 5.2)), ox = ORIGIN[0], oy = ORIGIN[1];
          const pN = new Path2D(), pB = new Path2D(), pC = new Path2D(), pW = new Path2D();
          const t0 = T.v0 + .1, spanR = Math.max(.8, T.transport + .2 - T.v0), tc = T.conteneur - .15;
          for (let i = 0; i < ND; i++) {
            const sx = AX + (DX[i] - C.cx) * C.z, sy = AY + (DY[i] - C.cy) * C.z;
            if (sx < -r0 * 2 || sx > W + r0 * 2 || sy < 250 - r0 * 2 || sy > 1180 + r0 * 2) continue;
            const dd = Math.hypot(DX[i] - ox, (DY[i] - oy) * 1.1) / 150;
            const a = prog(t, t0 + dd * spanR + DS[i] * .25, t0 + dd * spanR + DS[i] * .25 + .35);
            if (a <= 0) continue;
            const r = r0 * (a < 1 ? eOutBack(a) : 1) * (.82 + .3 * DS[i]);
            let tgt = a < 1 ? pW : pN;
            if (DC[i]) { const cd = Math.hypot(DX[i] - ox, DY[i] - oy) / 30, c = prog(t, tc + cd * .45, tc + cd * .45 + .3); if (c >= 1) tgt = pC; else if (c > 0) tgt = pW; }
            else if (a >= 1 && DS[i] > .965 && Math.sin(t * 2.3 + DS[i] * 90) > .6) tgt = pB;
            tgt.moveTo(sx + r, sy); tgt.arc(sx, sy, r, 0, Math.PI * 2);
          }
          ctx.fillStyle = 'rgba(186,150,255,.62)'; ctx.fill(pN);
          ctx.fillStyle = 'rgba(234,246,255,.75)'; ctx.fill(pB);
          ctx.fillStyle = 'rgba(255,238,210,1)'; ctx.fill(pW);
          ctx.fillStyle = AMBER; ctx.fill(pC);

          // route: dashed preview
          const rs = RP.map(p => S(C, p[0], p[1]));
          const pv = eInOutCubic(prog(t, T.prev0, T.prev1));
          if (pv > 0) { ctx.save(); ctx.globalAlpha *= .85; polyline(rs, pv, 'rgba(234,246,255,.8)', 3, null, [2, 11]); ctx.restore(); }
          // travelled trail
          const sf = shipF(t, T);
          if (sf > 0) {
            ctx.save(); ctx.globalAlpha *= .35; polyline(rs, sf, ORANGE, 14, ORANGE); ctx.restore();
            polyline(rs, sf, AMBER, 5, ORANGE);
            polyline(rs, sf, '#FFF4DE', 1.8, null);
          }
          // origin port pulse
          const op = S(C, ORIGIN[0], ORIGIN[1]), oa = prog(t, T.conteneur - .1, T.conteneur + .3);
          if (oa > 0) { ctx.save(); ctx.globalAlpha *= oa; ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(op[0], op[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            for (let k = 0; k < 2; k++) { const ph = ((t - T.conteneur) * .9 + k * .5) % 1; if (t > T.conteneur) ring(op[0], op[1], 8 + ph * 34, AMBER, 3, oa * (1 - ph) * .9); } }
        }
        // local last-mile view (continuation of the zoom)
        if (u > .12) {
          const sL = Math.pow(DIVE, u - 1), pa = C.pa, R = irisR(t, T);
          ctx.save(); ctx.globalAlpha = 1;
          if (R < 1399) { ctx.beginPath(); ctx.arc(pa[0], pa[1], R, 0, Math.PI * 2); ctx.clip(); }
          ctx.translate(pa[0], pa[1]); ctx.scale(sL, sL); ctx.translate(-L.dock[0], -L.dock[1]);
          drawLocal(t, T, 1, sL); ctx.restore();
          if (R < 1399) { const ra = 1 - prog(R, 700, 1150); ring(pa[0], pa[1], R, ICE, 4, ra * .9, VIOLET); ring(pa[0], pa[1], R + 10, VIOLET, 10, ra * .35, VIOLET); }
        }
      });
      // mask the layer to the content zone
      lctx.save(); lctx.globalCompositeOperation = 'destination-in';
      const mg = lctx.createLinearGradient(0, MASK_Y[0], 0, MASK_Y[3]); const my = v => (v - MASK_Y[0]) / (MASK_Y[3] - MASK_Y[0]);
      mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(my(MASK_Y[1]), 'rgba(0,0,0,1)'); mg.addColorStop(my(MASK_Y[2]), 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = mg; lctx.fillRect(0, 0, W, H);
      const hg = lctx.createLinearGradient(0, 0, W, 0); hg.addColorStop(0, 'rgba(0,0,0,.15)'); hg.addColorStop(.06, 'rgba(0,0,0,1)'); hg.addColorStop(.94, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,.15)');
      lctx.fillStyle = hg; lctx.fillRect(0, 0, W, H); lctx.restore();
      // bloom
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, BC.width, BC.height); bctx.filter = 'blur(3px)'; bctx.drawImage(LC, 0, 0, BC.width, BC.height); bctx.filter = 'none';
      ctx.save(); ctx.globalAlpha = A; ctx.drawImage(LC, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = A * .55; ctx.drawImage(BC, 0, 0, W, H); ctx.restore();

      // ===== dive speed lines =====
      if (u > 0 && u < 1) {
        const k = Math.sin(Math.PI * u), pa = C.pa; ctx.save(); ctx.globalAlpha = A * k * .55; ctx.strokeStyle = ICE; ctx.lineCap = 'round';
        for (let i = 0; i < 26; i++) { const an = rnd(i * 7.7) * Math.PI * 2, r1 = 140 + rnd(i * 3.1) * 260 + u * 380, len = 60 + rnd(i * 5.3) * 160 * k;
          const x1 = pa[0] + Math.cos(an) * r1, y1 = pa[1] + Math.sin(an) * r1; if (y1 < 320 || y1 > 1110) continue;
          ctx.lineWidth = 1.5 + rnd(i) * 2.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(an) * len, y1 + Math.sin(an) * len); ctx.stroke(); }
        const fl = Math.max(0, 1 - Math.abs(u - .55) / .2); if (fl > 0) { const rg = ctx.createRadialGradient(pa[0], pa[1], 0, pa[0], pa[1], 520);
          rg.addColorStop(0, `rgba(255,240,225,${.55 * fl})`); rg.addColorStop(.4, `rgba(169,71,254,${.25 * fl})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = A; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(0, 300, W, 830); }
        ctx.restore();
      }

      ctx.save(); ctx.globalAlpha = A;
      // ===== local objects (crane, warehouse, truck) =====
      if (kLoc > 0) {
        const sL = Math.pow(DIVE, u - 1), pa = C.pa, LP = (x, y) => [pa[0] + (x - L.dock[0]) * sL, pa[1] + (y - L.dock[1]) * sL];
        ctx.save(); if (irisR(t, T) < 1399) { ctx.beginPath(); ctx.arc(pa[0], pa[1], irisR(t, T), 0, Math.PI * 2); ctx.clip(); }
        ctx.translate(pa[0], pa[1]); ctx.scale(sL, sL); ctx.translate(-L.dock[0], -L.dock[1]);
        drawCrane(L.crane[0], L.crane[1], 150, t, T);
        const door = eOutCubic(prog(t, T.tr1 - .35, T.tr1 + .2));
        drawWarehouse(L.wh[0], L.wh[1], L.whW, { door });
        // truck
        const dist = truckD(t, T), rp = roadAt(dist / RDT);
        const boxOn = prog(t, T.x1 - .02, T.x1);
        const tIn = 1;
        const tl = clamp(rp.ang, -.5, .5) * .6;
        drawTruck(rp.x, rp.y + 4, L.truck0, { box: boxOn, roll: dist / (L.truck0 * .072), tilt: tl, alpha: tIn });
        ctx.restore();
        // arrival pulse
        if (t > T.tr1 - .15) {
          const wp = LP(L.wh[0], L.wh[1] - L.whW * .38);
          for (let k = 0; k < 3; k++) { const ph = (t - T.tr1 + .15 - k * .42); if (ph > 0 && ph < 1.2) ring(wp[0], wp[1], 30 + eOutCubic(ph / 1.2) * 230, ORANGE, 5 * (1 - ph / 1.2) + 1, (1 - ph / 1.2) * .9); }
          const ca = eOutBack(prog(t, T.tr1 - .1, T.tr1 + .25)); const cp = LP(L.wh[0] + L.whW * .44, L.wh[1] - L.whW * .6);
          if (ca > 0) { ctx.save(); ctx.translate(cp[0], cp[1]); ctx.scale(ca, ca); ctx.fillStyle = 'rgba(12,7,28,.95)'; ctx.strokeStyle = AMBER; ctx.lineWidth = 4; ctx.shadowColor = AMBER; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); checkMark(cp[0], cp[1] + 2, 36, prog(t, T.tr1 + .05, T.tr1 + .35), AMBER, 7); }
        }
      }

      // ===== ship =====
      const sf = shipF(t, T);
      if (t >= T.conteneur - .05) {
        let p, Ls, hd;
        const appear = eOutBack(prog(t, T.conteneur - .05, T.conteneur + .35));
        if (u <= 0) { p = S(C, ...routeAt(sf)); hd = headingAt(sf); Ls = 94 + 10 * clamp((C.z - 8.3) / 6); }
        else { p = C.pa; hd = headingAt(1); Ls = lerp(104, 196, eInOutCubic(u)); }
        const kv = prog(t, T.dep, T.arr), mv = Math.min(1, kv / .06, (1 - kv) / .06);
        const face = hd.face, tilt = hd.tilt * clamp(mv) * (u > 0 ? 1 - eInOutCubic(u) : 1);
        const bob = Math.sin(t * 3.1) * 2.2;
        // wake
        if (sf > .002 && sf < .999 && u <= 0) { ctx.save(); for (let k = 1; k <= 7; k++) { const q = S(C, ...routeAt(sf - k * .0045)); ctx.globalAlpha = A * (1 - k / 8) * .7; ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(q[0] + (rnd(k) - .5) * 6, q[1] + 6 + (rnd(k + 9) - .5) * 6, 3.4 - k * .3, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
        // glow under the ship
        ctx.save(); const gl = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], Ls * .8); gl.addColorStop(0, 'rgba(254,86,13,.35)'); gl.addColorStop(1, 'rgba(254,86,13,0)');
        ctx.fillStyle = gl; ctx.globalAlpha *= appear > 0 ? 1 : 0; ctx.fillRect(p[0] - Ls, p[1] - Ls, Ls * 2, Ls * 2); ctx.restore();
        const our = t < T.x0 ? 1 : 0, drop = prog(t, T.conteneur + .08, T.conteneur + .62);
        const lf = prog(t, T.conteneur + .6, T.conteneur + 1.2);
        if (lf > 0 && lf < 1) { const q = [p[0] + face * Ls * -.07, p[1] + bob - Ls * .19]; ring(q[0], q[1], 8 + 46 * eOutCubic(lf), ORANGE, 4 * (1 - lf) + 1, (1 - lf) * .95); }
        ctx.save(); ctx.translate(p[0], p[1] + bob); ctx.scale(Math.max(.001, appear), Math.max(.001, appear));
        drawShip(0, 0, Ls, { face, tilt, our, drop }); ctx.restore();
        // container transfer ship -> truck (crane lift)
        if (t >= T.x0 && t < T.x1 && kLoc > 0) {
          const sL = Math.pow(DIVE, u - 1), pa = C.pa, LP = (x, y) => [pa[0] + (x - L.dock[0]) * sL, pa[1] + (y - L.dock[1]) * sL];
          const fr = [p[0] + face * Ls * (-.29 + 3 * .104 + .049), p[1] + bob - Ls * .055 - Ls * .085 * 1.5];
          const r0 = roadAt(TD0 / RDT), to = LP(r0.x - L.truck0 * .13, r0.y + 4 - L.truck0 * .29);
          const k = eInOutCubic(prog(t, T.x0, T.x1)), hx = lerp(fr[0], to[0], k), hy = lerp(fr[1], to[1], k) - Math.sin(Math.PI * k) * 120;
          const bw = L.truck0 * .70 * lerp(Ls * .098 / (L.truck0 * .70), 1, k), bh = bw * .4;
          const cTop = LP(L.crane[0], L.crane[1] - 150 + 12)[1];
          ctx.save(); ctx.strokeStyle = 'rgba(234,246,255,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx, hy - bh / 2); ctx.lineTo(hx, Math.min(cTop, hy - bh / 2)); ctx.stroke(); ctx.restore();
          containerBox(hx - bw / 2, hy - bh / 2, bw, bh, ORANGE, { glow: ORANGE, glowBlur: 20 });
        }
      }

      // ===== destination pin (map) / warehouse pin (local) + label =====
      const pinA = eOutBack(prog(t, T.prev1 - .1, T.prev1 + .3));
      if (pinA > 0) {
        let pp = S(C, DEST[0], DEST[1]), ps = 38;
        if (u > 0) { const sL = Math.pow(DIVE, u - 1), pa = C.pa, lp = [pa[0] + (L.pinTip[0] - L.dock[0]) * sL, pa[1] + (L.pinTip[1] - L.dock[1]) * sL];
          const e = eInOutCubic(u); pp = [lerp(pp[0], lp[0], e), lerp(pp[1], lp[1], e)]; ps = lerp(38, 62, e); }
        const drop = (1 - pinA) * 40;
        ctx.save(); ctx.globalAlpha *= clamp(pinA * 2);
        ctx.fillStyle = 'rgba(254,86,13,.35)'; ctx.beginPath(); ctx.ellipse(pp[0], pp[1], ps * .38, ps * .12, 0, 0, Math.PI * 2); ctx.fill();
        pin(pp[0], pp[1] - ps * .55 - drop, ps, ORANGE); ctx.restore();
        if (t > T.arr - .15 && t < T.d0) { const ph = (t - T.arr + .15) % .9 / .9; ring(pp[0], pp[1], 10 + ph * 50, ORANGE, 3, (1 - ph) * .9); }
        // label NOTRE ENTREPÔT
        const la = prog(t, T.afrique - .05, T.afrique + .35);
        if (la > 0) {
          const e = eInOutCubic(u);
          const lx = lerp(pp[0] + 262, W - 44 - 246, e), ly = lerp(pp[1] - 78, 380, e);
          label('NOTRE ENTREPÔT', lx, ly, la, { size: 48, padX: 26, border: ORANGE, h: 88 });
        }
      }

      // ===== CHINE label =====
      const ca = prog(t, T.conteneur + .05, T.conteneur + .45) * (1 - prog(t, T.afrique - .35, T.afrique + .05));
      if (ca > 0 && u <= 0) { const cp = S(C, CHN[0], CHN[1]); label('CHINE', clamp(cp[0], 200, 880), clamp(cp[1], 400, 1000), ca, { size: 60, ls: 4, color: '#FFFFFF', border: AMBER }); }

      // ===== transport mode chip (PAR BATEAU -> PAR CAMION) =====
      const chipA = prog(t, T.bateau - .1, T.bateau + .3);
      if (chipA > 0) {
        const sw = prog(t, T.camion - .16, T.camion + .16), isTruck = sw >= .5, sq = Math.abs(Math.cos(sw * Math.PI));
        const s = isTruck ? 'PAR CAMION' : 'PAR BATEAU';
        ctx.save(); const cy = 378; ctx.translate(0, cy); ctx.scale(1, Math.max(.02, sq)); ctx.translate(0, -cy);
        chip(s, 44, cy, chipA, isTruck ? truckGlyph : shipGlyph); ctx.restore();
      }
      ctx.restore();
    },
  });

  function chip(s, x, cy, a, glyph) {
    const size = 48, font = `700 ${size}px ${FONT.ui}`, tw = measure(s, font, 3), ph = 88, pw = tw + 146;
    const k = eOutCubic(clamp(a)); ctx.save(); ctx.globalAlpha *= clamp(a * 1.5); ctx.translate((1 - k) * -40, 0);
    plate(x, cy - ph / 2, pw, ph, { r: 22, border: 'rgba(243,167,69,.95)', lw: 3, fill: 'rgba(12,7,28,.9)' });
    ctx.save(); ctx.fillStyle = 'rgba(243,167,69,.14)'; rrect(x + 8, cy - ph / 2 + 8, 108, ph - 16, 16); ctx.fill(); ctx.restore();
    glyph(x + 62, cy, 82);
    txt(s, x + 130, cy + size * .36, { font, color: '#FFFFFF', ls: 3 });
    ctx.restore();
  }
  function drawCrane(x, y, s, t, T) {  // ship-to-shore gantry crane standing on the quay, boom over the water (left)
    ctx.save(); ctx.strokeStyle = ICE; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = VIOLET; ctx.shadowBlur = 12;
    const top = y - s;
    ctx.beginPath();
    ctx.moveTo(x - s * .12, y); ctx.lineTo(x - s * .12, top); ctx.moveTo(x + s * .22, y); ctx.lineTo(x + s * .22, top);
    ctx.moveTo(x - s * .12, y - s * .45); ctx.lineTo(x + s * .22, y - s * .45);
    ctx.moveTo(x - s * .12, y - s * .45); ctx.lineTo(x + s * .22, top + s * .02);
    ctx.moveTo(x - s * .75, top + s * .08); ctx.lineTo(x + s * .42, top + s * .08);
    ctx.moveTo(x + s * .05, top - s * .22); ctx.lineTo(x - s * .7, top + s * .08); ctx.moveTo(x + s * .05, top - s * .22); ctx.lineTo(x + s * .4, top + s * .08);
    ctx.moveTo(x + s * .05, top - s * .22); ctx.lineTo(x + s * .05, top + s * .08);
    ctx.stroke();
    ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.fillRect(x + s * .3, top + s * .02, s * .12, s * .12);
    ctx.restore();
  }
  function irisR(t, T) { return 1400 * Math.pow(eInOutCubic(prog(t, T.d0 + .3, T.d1 + .12)), 1.25); }
  function shipF(t, T) { const k = prog(t, T.dep, T.arr); return (1 - Math.cos(Math.PI * k)) / 2; }
})();
