'use strict';
// ============================================================================================
// s1 « 01 · L'ACHAT » — full-screen motion design (V03).
//   V03 start : a dotted globe turns from Africa to China
//   "Chine"   : the camera dives in — China's dots unfold into an extruded China map, outline traces, « CHINE 中国 » + coast pin
//   "fournisseurs" : 3 factories rise on the coast, « Vos fournisseurs »
//   "marchandises" : open cartons leave the factories and land on a pallet
//   "emballées"    : flaps fold down, tape runs across
//   "préparées"    : amber ✓ badge « Emballé · Prêt pour le voyage » lands
// Content zone y 320–1110. Deterministic (rnd only). All times from TL.
// ============================================================================================
(function () {
  const K = window.MG12;
  const CHID = 's1', SEG = 'V03';

  // ---- map placement (equirectangular, lat squashed for a tilted-table feel) ----
  const MAP = { x0: 92, y0: 352, kx: 14.6, ky: 14.3, lon0: 73.63, lat0: 53.55, T: 22 };
  const mp = (lon, lat) => [MAP.x0 + (lon - MAP.lon0) * MAP.kx, MAP.y0 + (MAP.lat0 - lat) * MAP.ky];
  const PIN = mp(119.2, 29.0);
  // factories on the east coast (drawn back to front)
  const FACT = [
    { p: mp(115.6, 34.4), s: 0.62, seed: 3 },
    { p: mp(119.4, 28.0), s: 0.68, seed: 7 },
    { p: mp(111.8, 23.6), s: 0.72, seed: 11 },
  ];
  const CHINE_AT = mp(89.0, 38.4);
  const PAL = { x: 420, y: 905 };                 // pallet ground centre
  const CARD = '#C98D4C';
  const D2R = Math.PI / 180;
  // globe (orthographic) — rotates from Africa to China, then China's dots unfold into the flat map
  const GLB = { x: 540, y: 700, R: 300 };
  function orth(lon, lat, l0, p0, R) {
    const cl = Math.cos(lat), dl = lon - l0, cd = Math.cos(dl);
    const cosc = Math.sin(p0) * Math.sin(lat) + Math.cos(p0) * cl * cd;
    return [R * cl * Math.sin(dl), -R * (Math.cos(p0) * Math.sin(lat) - Math.sin(p0) * cl * cd), cosc];
  }

  let G = null;
  function build() {
    const C = window.MG12_CHINA;
    const main = C.main.map(p => mp(p[0], p[1])), hai = C.hainan.map(p => mp(p[0], p[1]));
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const [x, y] of main.concat(hai)) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const dots = []; const sx = 15, sy = 13;
    let row = 0;
    for (let y = miny + 5; y < maxy; y += sy, row++) {
      for (let x = minx + 4 + (row % 2) * sx / 2; x < maxx; x += sx) {
        if (!(K.inside(main, x, y) || K.inside(hai, x, y))) continue;
        const i = dots.length, d = Math.hypot(x - PIN[0], y - PIN[1]);
        const k = Math.pow(clamp(1 - d / 430), 1.7);
        const lon = MAP.lon0 + (x - MAP.x0) / MAP.kx, lat = MAP.lat0 - (y - MAP.y0) / MAP.ky;
        dots.push({ x, y, i, k, lon: lon * D2R, lat: lat * D2R, delay: 0.3 * rnd(i * 7.7 + 3) + 0.25 * clamp(d / 700),
          col: K.mix('#9A6BFF', AMBER, k * .95), r: 2.5 + 0.9 * k });
      }
    }
    const GL = window.MG12_GLOBE || [], globe = [];
    for (let j = 0; j < GL.length; j += 2) {
      // skip the China box (China is drawn by the map dots themselves)
      const lo = GL[j], la = GL[j + 1];
      if (lo > 74 && lo < 134 && la > 20 && la < 53 && K.inside(C.main, lo, la)) continue;
      globe.push({ lon: lo * D2R, lat: la * D2R, j });
    }
    // outline traced from the coast (nearest point to the pin) in both directions, meeting in the far west
    let i0 = 0, bd = 1e9;
    main.forEach((q, i) => { const d = Math.hypot(q[0] - PIN[0], q[1] - PIN[1]); if (d < bd) { bd = d; i0 = i; } });
    const rot = main.slice(i0).concat(main.slice(0, i0)), closed = rot.concat([rot[0]]), mid = Math.floor(closed.length / 2);
    const trace = [closed.slice(0, mid + 1), closed.slice(mid).reverse()];
    G = { main, hai, dots, globe, trace, bbox: [minx, miny, maxx, maxy] };
  }

  // ---------------------------------------------------------------- factory
  function factory(x, y, s, t, seed, alive) {
    const P = K.proj(x, y, s);
    K.shadow(x + 6 * s, y + 8 * s, 120 * s, 44 * s, .55);
    // concrete pad
    K.box(P, 0, 0, 0, 150, 110, 7, '#3B2C69', { lw: 1.5, hi: 'rgba(200,170,255,.5)' });
    const w = 104, d = 70, h = 46, hw = w / 2, hd = d / 2, z0 = 7;
    // side annex (office)
    K.box(P, -hw - 12, 12, z0, 26, 44, 30, '#B7ACE6', { lw: 1.6 });
    // chimney (behind hall)
    const chx = -30, chy = -hd + 9;
    K.box(P, chx, chy, z0, 14, 14, 96, '#E4DEFF', { lw: 1.6, front: '#D9D1FA', right: '#A99BDC' });
    K.box(P, chx, chy, z0 + 78, 15, 15, 9, ORANGE, { lw: 1.4, hi: '#FFB08A' });
    // hall walls
    K.box(P, 0, 0, z0, w, d, h, '#DCD4F6', { lw: 2, front: '#E2DBFA', right: '#A596D8', top: '#CFC5F2' });
    // lit windows on the front wall (face v = +hd)
    for (let k = 0; k < 4; k++) {
      const u0 = -hw + 10 + k * 23, u1 = u0 + 15, lit = 0.75 + 0.25 * Math.sin(t * 3 + seed + k * 1.7);
      K.fillPoly([P(u0, hd, z0 + 16), P(u1, hd, z0 + 16), P(u1, hd, z0 + 32), P(u0, hd, z0 + 32)], K.rgba(AMBER, 0.55 + 0.45 * lit * alive), 'rgba(80,50,20,.6)', 1.2);
    }
    // loading door on the right wall (face u = +hw)
    K.fillPoly([P(hw, 14, z0), P(hw, -14, z0), P(hw, -14, z0 + 30), P(hw, 14, z0 + 30)], '#2A1D4E', '#1A1033', 1.5);
    for (let k = 1; k < 5; k++) K.seg(P(hw, 14, z0 + k * 6), P(hw, -14, z0 + k * 6), 'rgba(160,140,220,.55)', 1.2);
    // saw-tooth roof: 3 teeth along u, glazing faces +u (cyan glow)
    const n = 3, tw = w / n, th = 24, zr = z0 + h;
    for (let k = 0; k < n; k++) {
      const u0 = -hw + k * tw, u1 = u0 + tw;
      K.fillPoly([P(u0, -hd, zr), P(u1, -hd, zr + th), P(u1, hd, zr + th), P(u0, hd, zr)], '#7E45E8', '#3B1A7A', 1.6);
      K.fillPoly([P(u0, hd, zr), P(u1, hd, zr + th), P(u1, hd, zr)], '#C9BEF2', '#3B1A7A', 1.4);
      const gl = 0.55 + 0.35 * alive * (0.7 + 0.3 * Math.sin(t * 2.2 + k + seed));
      K.fillPoly([P(u1, hd, zr), P(u1, hd, zr + th), P(u1, -hd, zr + th), P(u1, -hd, zr)], K.rgba(CYAN, gl), '#1F6C80', 1.4);
      K.seg(P(u0, hd, zr), P(u1, hd, zr + th), 'rgba(230,215,255,.9)', 1.4);
    }
    // smoke from chimney
    if (alive > 0) {
      const top = P(chx, chy, z0 + 96 + 6);
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.55 + k / 4 + rnd(seed) * .5) % 1;
        ctx.save(); ctx.globalAlpha *= alive * (1 - ph) * 0.7 * clamp(ph * 6);
        ctx.fillStyle = '#E8E0FF';
        ctx.beginPath(); ctx.arc(top[0] + ph * 22 * s + Math.sin(ph * 5 + k) * 4, top[1] - ph * 70 * s, (5 + ph * 16) * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- carton (open flaps / tape)
  function carton(P, w, d, h, phi, tape, o = {}) {
    const hw = w / 2, hd = d / 2, L = d / 2;
    const top = phi > 0.03 ? '#4B2E12' : '#DDA766';
    K.box(P, 0, 0, 0, w, d, h, CARD, { front: '#CF9352', right: '#A9723A', top, edge: '#5C3A16', lw: 2, hi: phi > 0.03 ? 'rgba(255,220,170,.6)' : '#F6CD95' });
    // inner back wall hint when open
    if (phi > 0.03) {
      const k = clamp(phi / 0.4);
      K.fillPoly([P(-hw, -hd, h), P(hw, -hd, h), P(hw, -hd + 6, h - 18 * k), P(-hw, -hd + 6, h - 18 * k)], 'rgba(40,22,8,.55)');
    }
    // label sticker on the front face
    K.fillPoly([P(-hw + 12, hd, h * .30), P(-hw + 12 + w * .34, hd, h * .30), P(-hw + 12 + w * .34, hd, h * .62), P(-hw + 12, hd, h * .62)], 'rgba(250,246,240,.92)', 'rgba(90,60,30,.5)', 1);
    K.seg(P(-hw + 18, hd, h * .52), P(-hw + 8 + w * .34, hd, h * .52), 'rgba(90,70,60,.7)', 1.6);
    K.seg(P(-hw + 18, hd, h * .41), P(-hw + 2 + w * .30, hd, h * .41), 'rgba(90,70,60,.55)', 1.6);
    // flaps (hinged along the long u edges)
    const flap = (hv, sgn, col) => {
      const fv = hv + sgn * L * Math.cos(phi), fz = h + L * Math.sin(phi);
      K.fillPoly([P(-hw, hv, h), P(hw, hv, h), P(hw, fv, fz), P(-hw, fv, fz)], col, '#5C3A16', 1.8);
    };
    flap(-hd, 1, phi > 0.9 ? '#B67C40' : '#D59C5C');
    flap(hd, -1, '#E2AE6E');
    // tape along the seam, then down the right face
    if (tape > 0 && phi < 0.05) {
      const tw = d * 0.11, a = clamp(tape / 0.72), b = clamp((tape - 0.72) / 0.28);
      const u1 = -hw + w * eOutCubic(a);
      K.fillPoly([P(-hw, -tw, h + .5), P(u1, -tw, h + .5), P(u1, tw, h + .5), P(-hw, tw, h + .5)], 'rgba(244,226,186,.95)', 'rgba(150,110,60,.5)', 1);
      if (b > 0) K.fillPoly([P(hw, -tw, h), P(hw, tw, h), P(hw, tw, h - h * .42 * b), P(hw, -tw, h - h * .42 * b)], 'rgba(236,214,170,.95)', 'rgba(150,110,60,.5)', 1);
      if (a < 1) K.glow(...P(u1, 0, h), 14, '#FFF3D6', .8);
    }
    if (o.flash > 0) { // validation rim flash
      const q = [P(-hw, hd, 0), P(-hw, hd, h), P(-hw, -hd, h), P(hw, -hd, h), P(hw, -hd, 0), P(hw, hd, 0)];
      ctx.save(); ctx.globalAlpha *= o.flash; ctx.shadowColor = AMBER; ctx.shadowBlur = 18; K.fillPoly(q, null, '#FFE3A8', 3); ctx.restore();
    }
  }

  // ---------------------------------------------------------------- pallet
  function pallet(P, a) {
    ctx.save(); ctx.globalAlpha *= a;
    K.shadow(...P(0, 0, 0), 190, 60, .6);
    const wood = '#9A6A36';
    for (const u of [-95, 0, 95]) K.box(P, u, 0, 0, 22, 146, 9, '#6E4822', { lw: 1.4, hi: false });
    K.box(P, 0, 0, 9, 222, 146, 9, wood, { lw: 1.6, front: '#A87540', right: '#80552A', top: '#B8854C', hi: '#D9A870' });
    for (let k = -2; k <= 2; k++) K.seg(P(-111, k * 28, 18), P(111, k * 28, 18), 'rgba(70,40,15,.55)', 1.3);
    ctx.restore();
  }

  // ---------------------------------------------------------------- scene
  registerScene({
    id: 's1_achat', z: 10,
    when: t => TL.in(t, CHID),
    draw: (t) => {
      if (!G) build();
      const ch = TL.ch(CHID), seg = TL.seg(SEG);
      const T0 = seg.start;
      const tC = K.wt(SEG, 'chine', .30), tF = K.wt(SEG, 'fournisseurs', .42), tM = K.wt(SEG, 'marchandises', .60);
      const tE = K.wt(SEG, 'emballees', .73), tP = K.wt(SEG, 'preparees', .83), tV = K.wt(SEG, 'voyage', .92);
      const tB = Math.min(tP, ch.end - .4 - 2.1); // badge lands on "préparées" but always holds ≥ 2 s

      // background: fades in at the chapter start, stays solid into s2 (same background -> seamless)
      mgBackground(t, .88 * eOutCubic(prog(t, ch.start, ch.start + .35)), { cy: 700 });
      if (t < T0 - .1) return;

      const out = 1 - eInCubic(prog(t, ch.end - .38, ch.end - .02));
      ctx.save(); ctx.globalAlpha *= out;
      // slow camera push-in + exit push
      const cam = 1 + .025 * prog(t, T0, ch.end) + .05 * eInCubic(prog(t, ch.end - .38, ch.end));
      ctx.translate(540, 720); ctx.scale(cam, cam); ctx.translate(-540, -720);

      // ------------------------------ map ------------------------------
      const bob = Math.sin(t * 1.25) * 3;
      const slab = eOutCubic(prog(t, tC + .3, tC + .9));
      const dim = 1 - .38 * eOutCubic(prog(t, tF, tF + .7));
      // ---- globe: Africa -> China rotation, then zoom-through ----
      const gIn = eOutCubic(prog(t, T0 - .1, T0 + .7));
      const rot = eInOutCubic(prog(t, T0 + .15, tC - .05));
      const l0 = lerp(12, 106, rot) * D2R, p0 = lerp(6, 32, rot) * D2R;
      const zoom = eInCubic(prog(t, tC - .15, tC + .5));
      const gA = gIn * (1 - zoom);
      const GR = GLB.R * lerp(.9, 1, gIn) * (1 + 1.4 * zoom);
      if (gA > 0.01) {
        // atmosphere + limb
        K.glow(GLB.x, GLB.y, GR * 1.25, VIOLET, .30 * gA);
        ctx.save(); ctx.globalAlpha *= gA;
        const sg = ctx.createRadialGradient(GLB.x - GR * .3, GLB.y - GR * .35, GR * .1, GLB.x, GLB.y, GR);
        sg.addColorStop(0, 'rgba(60,30,120,.55)'); sg.addColorStop(1, 'rgba(18,8,42,.85)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(GLB.x, GLB.y, GR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ring(GLB.x, GLB.y, GR, 'rgba(190,150,255,.55)', 2.5, gA, VIOLET);
        // equator / meridian hint
        ctx.save(); ctx.globalAlpha *= gA * .22; ctx.strokeStyle = '#B99CFF'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(GLB.x, GLB.y - GR * Math.sin(p0) * 0, GR, GR * Math.sin(p0) + .01, 0, 0, Math.PI); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#B596FF';
        for (const D of G.globe) {
          const q = orth(D.lon, D.lat, l0, p0, GR);
          if (q[2] <= 0.02) continue;
          ctx.globalAlpha = out * gA * (.18 + .62 * q[2]);
          ctx.beginPath(); ctx.arc(GLB.x + q[0], GLB.y + q[1], (1.3 + 1.7 * q[2]) * (1 + zoom), 0, Math.PI * 2); ctx.fill();
        }
        // Africa glow (where the viewer is) — fades as the globe turns away
        const af = orth(8 * D2R, 5 * D2R, l0, p0, GR);
        if (af[2] > 0) { ctx.globalAlpha = out; K.glow(GLB.x + af[0], GLB.y + af[1], 26, ORANGE, gA * af[2] * .9); }
        ctx.globalAlpha = out;
      }
      ctx.save(); ctx.translate(0, bob * slab);
      // underglow
      K.glow(PIN[0] - 120, PIN[1] - 40, 520, VIOLET, .22 * slab, .55);
      if (slab > 0) {
        ctx.save(); ctx.globalAlpha *= slab;
        for (let dz = MAP.T; dz > 0; dz -= 2) {
          ctx.save(); ctx.translate(0, dz); K.path(G.main); ctx.fillStyle = dz > MAP.T - 3 ? '#12082A' : '#2A1358'; ctx.fill();
          K.path(G.hai); ctx.fill(); ctx.restore();
        }
        K.path(G.main); ctx.fillStyle = 'rgba(38,18,86,.92)'; ctx.fill();
        K.path(G.hai); ctx.fill();
        ctx.restore();
      }
      // China halftone dots: on the globe -> unfold into the flat map
      const hot = eOutCubic(prog(t, tC - .7, tC - .1));
      if (gA > .01 && hot > 0) { // China lights up on the globe just before the dive
        const cq = orth(104 * D2R, 34 * D2R, l0, p0, GR);
        if (cq[2] > 0) K.glow(GLB.x + cq[0], GLB.y + cq[1], 120 * (1 + zoom), AMBER, .32 * hot * gA * cq[2], .8);
      }
      for (const D of G.dots) {
        const k = eInOutCubic(prog(t, tC - .2 + D.delay, tC + .5 + D.delay));
        let x = D.x, y = D.y, gv = 1;
        if (k < 1) {
          const q = orth(D.lon, D.lat, l0, p0, GR);
          if (q[2] <= 0 && k <= 0) continue;
          gv = k > 0 ? 1 : q[2];
          x = lerp(GLB.x + q[0], D.x, k); y = lerp(GLB.y + q[1] - bob * slab, D.y, k);
        }
        const tw = .82 + .18 * Math.sin(t * 2.6 + D.i * .7);
        const onGlobe = (1 - k) * gIn * gv * (.35 + .65 * hot);
        const a = (k > 0 ? Math.max(onGlobe, k) : onGlobe) * (.55 + .45 * D.k) * tw * (D.k > .25 ? 1 : dim);
        if (a <= .01) continue;
        ctx.globalAlpha = out * a;
        ctx.fillStyle = k < .5 ? K.mix(D.col, AMBER, .8 * hot * (1 - k * 2)) : D.col;
        ctx.beginPath(); ctx.arc(x, y, D.r * lerp(.55, 1, k), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = out;
      // outline trace
      const op = eInOutCubic(prog(t, tC + .15, tC + 1.15));
      if (op > 0) {
        for (const half of G.trace) {
          const head = polyline(half, op, VIOLET, 4.5, VIOLET);
          polyline(half, op, 'rgba(234,246,255,.55)', 1.6);
          if (head && op < 1) K.glow(head[0], head[1], 22, '#E6D4FF', .9);
        }
        if (op > .8) { ctx.save(); ctx.globalAlpha *= (op - .8) / .2; polyline(G.hai.concat([G.hai[0]]), 1, VIOLET, 3.5, VIOLET); ctx.restore(); }
      }
      // coast pin (until the factories take over)
      const pinIn = eOutCubic(prog(t, tC + .45, tC + .8)), pinOut = eInCubic(prog(t, tF + .1, tF + .5));
      if (pinIn > 0 && pinOut < 1) {
        const pa = clamp(pinIn * 1.5) * (1 - pinOut);
        for (let r = 0; r < 2; r++) {
          const ph = ((t - tC - .45) * 1.1 + r * .5) % 1;
          if (t > tC + .45) K.ripple(PIN[0], PIN[1], 10 + ph * 90, .45, ORANGE, pa * (1 - ph) * .9, 3);
        }
        K.glow(PIN[0], PIN[1], 30, ORANGE, pa * .9);
      }
      // factories
      FACT.forEach((F, i) => {
        const t0 = tF + [.18, 0, .09][i] * 1.6;
        const g = prog(t, t0, t0 + .6);
        if (g <= 0) return;
        const sy = eOutBack(g), sx = lerp(.6, 1, eOutCubic(g));
        K.ripple(F.p[0], F.p[1], 20 + eOutCubic(g) * 90, .42, AMBER, (1 - g) * .9, 3);
        ctx.save(); ctx.globalAlpha *= clamp(g * 3);
        ctx.translate(F.p[0], F.p[1]); ctx.scale(sx, Math.max(.01, sy)); ctx.translate(-F.p[0], -F.p[1]);
        factory(F.p[0], F.p[1], F.s, t, F.seed, clamp((t - t0 - .4) / .5));
        ctx.restore();
      });
      ctx.restore(); // bob

      // ------------------------------ pallet + cartons ------------------------------
      const PP = K.proj(PAL.x, PAL.y, 1);
      const palA = eOutCubic(prog(t, tM - .25, tM + .2));
      if (palA > 0) { ctx.save(); ctx.translate(0, (1 - palA) * 40); pallet(PP, palA); ctx.restore(); }
      const SLOTS = [{ u: -54, v: 0, z: 18, w: 104, d: 128, h: 84 }, { u: 58, v: 0, z: 18, w: 100, d: 124, h: 80 }, { u: 2, v: 2, z: 98, w: 104, d: 118, h: 76 }];
      const FROM = [2, 1, 0]; // which factory each slot's carton comes from
      const flashK = prog(t, tB + .1, tB + .6);
      const flash = flashK > 0 && flashK < 1 ? Math.sin(flashK * Math.PI) : 0;
      SLOTS.forEach((S, i) => {
        const t0 = tM + i * .17, fp = prog(t, t0, t0 + .62);
        if (fp <= 0) return;
        const F = FACT[FROM[i]];
        const end = PP(S.u, S.v, S.z), start = [F.p[0] + 10, F.p[1] - 10 + bob];
        const e = eInOutCubic(fp);
        const ctrl = [lerp(start[0], end[0], .5), Math.min(start[1], end[1]) - 170];
        const pos = K.qb(start, ctrl, end, e);
        const sc = lerp(.35, 1, eOutCubic(fp));
        // landing squash
        const lp = prog(t, t0 + .62, t0 + .95);
        const sq = lp > 0 && lp < 1 ? Math.sin(lp * Math.PI) * (1 - lp) * .16 : 0;
        const phiOpen = 0.8 * Math.PI + Math.sin(t * 5 + i) * .04;
        const ce = eInOutCubic(prog(t, tE + i * .1, tE + i * .1 + .34));
        const phi = lerp(phiOpen, 0, ce);
        const tape = prog(t, tE + i * .1 + .34, tE + i * .1 + .72);
        ctx.save();
        ctx.globalAlpha *= clamp(fp * 4);
        ctx.translate(pos[0], pos[1]); ctx.scale(sc * (1 + sq * .6), sc * (1 - sq)); ctx.rotate(Math.sin(e * Math.PI) * (i % 2 ? -.12 : .12));
        carton(K.proj(0, 0, 1), S.w, S.d, S.h, phi, tape, { flash });
        ctx.restore();
        if (lp > 0 && lp < 1 && i < 2) K.puff(end[0], end[1] + 30, lp, 40 + i, 6, 70);
      });

      // ------------------------------ texts (max two blocks) ------------------------------
      // « CHINE 中国 »
      const cA = eOutCubic(prog(t, tC + .35, tC + .75));
      if (cA > 0) {
        const s = lerp(.86, 1, eOutBack(prog(t, tC + .35, tC + .8)));
        const f1 = `900 70px ${FONT.display}`, f2 = `700 58px "WenQuanYi Zen Hei", sans-serif`;
        const w1 = measure('CHINE', f1, 6), w2 = measure('中国', f2, 2), gap = 34;
        const W0 = w1 + gap + w2 + 70, H0 = 112;
        ctx.save(); ctx.translate(CHINE_AT[0], CHINE_AT[1] + bob); ctx.scale(s, s);
        plate(-W0 / 2, -H0 / 2, W0, H0, { alpha: cA, r: 22, border: 'rgba(169,71,254,.9)', lw: 3 });
        const x0 = -W0 / 2 + 35;
        txt('CHINE', x0, 25, { font: f1, ls: 6, color: '#FFFFFF', alpha: cA, glow: 'rgba(169,71,254,.9)', glowBlur: 18 });
        ctx.save(); ctx.globalAlpha *= cA; ctx.fillStyle = 'rgba(234,246,255,.35)'; ctx.fillRect(x0 + w1 + gap / 2 - 1.5, -30, 3, 60); ctx.restore();
        txt('中国', x0 + w1 + gap, 21, { font: f2, ls: 2, color: AMBER, alpha: cA });
        ctx.restore();
      }
      // « Vos fournisseurs » — leaves when the badge lands
      const fA = eOutCubic(prog(t, tF + .3, tF + .7)) * (1 - eInCubic(prog(t, tB - .2, tB + .12)));
      if (fA > 0) {
        const fx = 752, fy = 462 + bob;
        ctx.save(); ctx.translate(0, (1 - eOutCubic(prog(t, tF + .3, tF + .7))) * 18);
        const r = K.label('Vos fournisseurs', fx, fy, { size: 48, weight: 800, alpha: fA, accent: AMBER, color: '#FFFFFF', pad: 28 });
        // leader ticks down to the three factories
        ctx.globalAlpha *= fA;
        FACT.forEach((F, i) => {
          const lp = eOutCubic(prog(t, tF + .5 + i * .1, tF + .9 + i * .1));
          const a = [r.x + r.w * (.3 + .2 * i), r.y + r.h + 4], b = [F.p[0] - 6, F.p[1] - 92 * F.s + bob];
          if (lp > 0) { polyline([a, b], lp, 'rgba(243,167,69,.9)', 3, null, [3, 8]); if (lp > .95) K.glow(b[0], b[1], 12, AMBER, .9); }
        });
        ctx.restore();
      }
      // ✓ badge — lands on "préparées"
      const bIn = prog(t, tB, tB + .5);
      if (bIn > 0) {
        const f1 = `800 58px ${FONT.body}`, f2 = `700 46px ${FONT.body}`;
        const w1 = measure('Emballé', f1), w2 = measure('Prêt pour le voyage', f2);
        const disc = 50, W0 = 34 + disc * 2 + 30 + Math.max(w1, w2) + 40, H0 = 150;
        const bx = 540, by = 1030;
        const s = lerp(1.35, 1, eOutBack(bIn)), a = clamp(bIn * 3.5);
        ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
        plate(-W0 / 2, -H0 / 2, W0, H0, { alpha: a, r: 26, border: 'rgba(243,167,69,.95)', lw: 3.5 });
        const dx = -W0 / 2 + 34 + disc;
        ctx.save(); ctx.globalAlpha *= a; ctx.shadowColor = AMBER; ctx.shadowBlur = 26; ctx.fillStyle = AMBER;
        ctx.beginPath(); ctx.arc(dx, 0, disc, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.globalAlpha *= a; checkMark(dx + 2, 2, disc * 1.15, eOutCubic(prog(t, tB + .15, tB + .5)), INK, 11); ctx.restore();
        const tx = dx + disc + 30;
        txt('Emballé', tx, -12, { font: f1, color: AMBER, alpha: a });
        txt('Prêt pour le voyage', tx, 46, { font: f2, color: ICE, alpha: a });
        ctx.restore();
        const sh = prog(t, tB + .12, tB + .8);
        if (sh > 0 && sh < 1) ring(bx - W0 / 2 + 34 + disc, by, disc + eOutCubic(sh) * 110, AMBER, 4 * (1 - sh), (1 - sh) * .9);
      }
      // gentle "ready" shimmer across the stack on "voyage"
      const shp = prog(t, tV, tV + .8);
      if (shp > 0 && shp < 1) K.glow(PAL.x - 150 + shp * 300, PAL.y - 130, 70, '#FFE7B8', .35 * Math.sin(shp * Math.PI), 1.6);

      ctx.restore();
    },
  });
})();
