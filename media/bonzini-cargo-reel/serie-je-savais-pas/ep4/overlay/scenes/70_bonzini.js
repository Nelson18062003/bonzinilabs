'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — M2, part 2: the brand (prefix BZ_). VIOLET APPEARS ONLY HERE (from A.cont).
// Functions only: 50_compose.js calls them with the states SCORE computed. Bonzini = cargo China → Douala (sea or air) and a
// warehouse at the Foyer Balengou; it never « protects » anyone (the protection was the call).
//
//   BZ_container(C, t, L, inside)  world  the violet-glass mini 10-ft container in a 3/4 VIEW (a long corrugated side + the
//        door end + the roof, mild perspective), C = SCORE.container(t). Its glowing amber edges trace themselves in at A.cont;
//        thick glass (the cloth behind is refracted, violet absorption), the far walls and floor seen through it, then
//        `inside()` (TA COMMANDE, seen through the glass), then the near panes (vertical corrugations, rails, roof ribs,
//        locking rods), glowing edges, corner castings, a slow caustic and a spark running along the edges. The two glass
//        DOOR LEAVES swing on their hinges: open while the parcel jumps in, they close gently with C.doors (A.doors), and
//        burst open again at A.loop0 when it pops out for the loop. A violet ripple on the roof where the parcel goes in.
//        Shadow: soft footprint, the violet light through the box and an amber line at its foot.
//   BZ_onParcel(P, face, t, L)     world  the violet sticker « BONZINI TRADING CARGO » (logo roundel) slapped on the parcel's
//        front face at A.bzLabel (squash, flash), right of « TA COMMANDE » over the ribbon; peels off in the loop (P.bzLabel).
//   BZ_plate(st, t, L)             hero   the series' violet enamel plate « BONZINI / TRADING CARGO » (ep. 1–2 design, 860 × 210)
//        relit for the night: thickness, soft shadow, the bulb's reflection, the sweep; lands .2 s before « Ensuite » (v2; st from the
//        score), two rising glints = the balafon signature (after the touchdown). It also carries the CAPTION (taken over for BZ_scene):
//        a cream enamel strip « DE LA CHINE À DOUALA / ⛴ MER OU AIR ✈ » hung under it by two rings, swinging in at A.service.
//   BZ_scene(t, L)                 world  the kraft luggage tag « Entrepôt · / Foyer Balengou » on a violet push pin by the
//        container (A.tagBZ → A.endcard): pinned with a jab, swings on its string and settles. Takes over 'tagBZ' and
//        'service' (the caption is drawn in the hero pass by BZ_plate so the night grade does not dim it).
// Every time is read from SCORE.A / SCORE.T; static looks are cached sprites; no ctx.filter.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T;
  const kk = S.kk, ease = S.ease, eOut = S.easeOut, eIn = S.easeIn, spr = S.spr, cl = S.cl, lerpv = S.lerpv;
  const TAU = Math.PI * 2;
  const P = { vio: '#7033FF', vioL: '#A947FE', vioD: '#5B2BDF', vioDD: '#3B17A8', vioEdge: '#22105A', vioInk: '#4A1FC2',
    orange: '#FE560D', amber: '#F3A745', ink: '#231629', cream: '#FBF6EC', creamW: '#FFF8EC', kraft: '#D9B482', kInk: '#2A1A0C' };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const nOf = t => Math.round(t * 30);

  // ------------------------------------------------------------------ sprite cache (ep. 1–2 pattern)
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  function shadowSprite(key, w, h, r, blur, col) {
    return sprite(key, w + blur * 5, h + blur * 5, () => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000; ctx.fillStyle = '#000';
      rrect(-w / 2 - 20000, -h / 2, w, h, r); ctx.fill(); ctx.restore();
    });
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
  /** amber glow along a path: nested additive strokes (P_K pattern), scaled by m */
  function glowStroke(pathFn, k, m = 1, rgb = '255,150,45') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col, a] of [[22, '255,110,20', .05], [14, '255,120,25', .075], [9, '255,135,35', .11], [5.5, rgb, .2], [3.2, '255,176,70', .4], [1.8, '255,206,120', .6], [1, '255,240,200', .85]]) {
      ctx.strokeStyle = `rgba(${col},${(a * k).toFixed(3)})`; ctx.lineWidth = w * m; pathFn(); ctx.stroke();
    }
    ctx.restore();
  }
  const lp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const polyPath = pts => () => { ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };
  const areaOf = q => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], n = q[(i + 1) % q.length]; a += p.x * n.y - n.x * p.y; } return a / 2; };
  function hull(Pts) {
    const p = Pts.slice().sort((a, b) => a.x - b.x || a.y - b.y), cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // =========================================================================================== THE CONTAINER
  // a box L × W × H (units at k = 1, ×0.8·C.k on screen), yaw PSI (the right end recedes: the door end faces us, left),
  // seen with the table's pitch (screen y = −(Y·SPH + Z·CPH)), weak perspective (FOC) about the floor centre.
  const CL = 236, CW = 168, CH = 168, PSI = 32 * Math.PI / 180, SPH = .68, CPH = .73, FOC = 1900, KF = .8;
  const ca = Math.cos(PSI), sa = Math.sin(PSI);
  const NRIB = 13, NROOF = 9;
  function projector(C) {
    const kf = C.k * KF, ox = C.x, oy = C.y - (G.ch * .5 + 10) * C.k + (C.z ? -C.z : 0);
    // plan (X right, Y away) from (along, across) metric offsets; Z up
    const W2 = (al, ac, z) => {
      const X = al * ca - ac * sa, Y = al * sa + ac * ca, depth = Y * CPH - z * SPH, p = FOC / (FOC + depth * kf);
      return { x: ox + X * kf * p, y: oy - (Y * SPH + z * CPH) * kf * p };
    };
    const Pp = (u, v, h) => W2(u * CL / 2, v * CW / 2, h * CH);    // normalised: u −1 door end … 1, v −1 front … 1 back, h 0 … 1
    Pp.W = W2; Pp.kf = kf; return Pp;
  }
  // ---- refraction: one copy of the canvas per call (what the thick glass bends) ----
  let SNAP = null;
  function refract(pts, cx, cy, mag, dy) {
    const cv = ctx.canvas, m = ctx.getTransform();
    if (!SNAP || SNAP.width !== cv.width || SNAP.height !== cv.height) SNAP = makeCanvas(cv.width, cv.height);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const q = m.transformPoint(new DOMPoint(p.x, p.y)); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    x0 = Math.max(0, Math.floor(x0 - 6)); y0 = Math.max(0, Math.floor(y0 - 6)); x1 = Math.min(cv.width, Math.ceil(x1 + 6)); y1 = Math.min(cv.height, Math.ceil(y1 + 6));
    if (x1 - x0 < 4 || y1 - y0 < 4) return;
    const g = SNAP.getContext('2d'); g.globalCompositeOperation = 'copy'; g.drawImage(cv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    const c = m.transformPoint(new DOMPoint(cx, cy));
    ctx.save(); ctx.beginPath(); polyPath(pts)(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(SNAP, x0, y0, x1 - x0, y1 - y0, c.x + (x0 - c.x) * mag, c.y + (y0 - c.y) * mag + dy * m.d, (x1 - x0) * mag, (y1 - y0) * mag);
    ctx.restore();
  }
  // the shadow layer under the box (soft footprint, contact, violet glow through the glass, amber line at the foot): baked
  // once at the reference scale (C.k = 1.85) around the floor centre — the brand light comes from straight above
  const KREF = 1.85;
  const shadowLayer = () => sprite('contSh', 900, 640, () => {
    const Pp = projector({ x: 0, y: (G.ch * .5 + 10) * KREF, k: KREF, z: 0 });
    const f = [Pp(-1, -1, 0), Pp(1, -1, 0), Pp(1, 1, 0), Pp(-1, 1, 0)];
    ctx.save(); ctx.translate(0, 5); softPath(polyPath(f.map(p => ({ x: p.x * 1.06, y: p.y * 1.1 }))), 14, 'rgba(6,3,14,.55)'); ctx.restore();
    softPath(polyPath(f), 3, 'rgba(4,2,10,.55)');
    ctx.globalCompositeOperation = 'lighter';
    softPath(() => ctx.ellipse(0, 6, 260, 120, -.18, 0, TAU), 26, 'rgba(130,90,255,.34)');
    softPath(() => { ctx.moveTo(f[3].x, f[3].y + 2); ctx.lineTo(f[0].x, f[0].y + 2); ctx.lineTo(f[1].x, f[1].y + 2); }, 4, 'rgba(255,140,40,.55)', true, 4);
  });
  function contShadow(Pp, C, L, a) {
    const o = Pp(0, 0, 0), s = C.k / KREF;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(o.x, o.y); ctx.scale(s, s); blit(shadowLayer()); ctx.restore();
  }
  /** the leaves' state: theta (rad) open angle, 0 = closed */
  function doorAngle(C, t) {
    let k = C.doors;
    if (t >= A.loop0 - .04) k *= 1 - eOut(kk(t, A.loop0 - .04, A.loop0 + .14));       // they burst open: the parcel pops out
    return 2.05 * (1 - k);
  }
  /** a door leaf (glass): hinge on the door end's near (v = −1) or far (v = +1) edge */
  function leafQuad(Pp, side, th) {
    const hv = side * CW / 2, al = -CL / 2;
    // closed direction: across, towards the middle; opens outward (−along)
    const dAc = -side * Math.cos(th), dAl = -Math.sin(th), w = CW / 2;
    const fa = al + dAl * w, fc = hv + dAc * w;
    return [Pp.W(al, hv, 0), Pp.W(al, hv, CH), Pp.W(fa, fc, CH), Pp.W(fa, fc, 0)];      // hinge bottom, hinge top, free top, free bottom
  }
  function drawLeaf(q, a, t, edgeK, mk) {
    const [hb, ht, ft, fb] = q, pts = [hb, ht, ft, fb];
    if (Math.abs(areaOf(pts)) < 30) {                              // edge-on: just the glowing edge
      glowStroke(() => { ctx.beginPath(); ctx.moveTo(hb.x, hb.y); ctx.lineTo(ft.x, ft.y); }, .8 * edgeK, 1); return;
    }
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); polyPath(pts)(); ctx.fillStyle = 'rgba(150,118,255,.2)'; ctx.fill();
    const g = ctx.createLinearGradient(ht.x, ht.y, hb.x, hb.y); g.addColorStop(0, 'rgba(226,212,255,.16)'); g.addColorStop(1, 'rgba(110,70,255,.06)');
    ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); polyPath(pts)(); ctx.fillStyle = g; ctx.fill();
    // two locking rods with their cam keepers, the handle, the hinge blocks
    for (const u of [.28, .7]) {
      const b = lp(hb, fb, u), tt = lp(ht, ft, u), p0 = lp(b, tt, .05), p1 = lp(b, tt, .95);
      ctx.strokeStyle = 'rgba(20,6,60,.35)'; ctx.lineWidth = 4.2 * mk; ctx.beginPath(); ctx.moveTo(p0.x + 1.5, p0.y + 1.5); ctx.lineTo(p1.x + 1.5, p1.y + 1.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(244,236,255,.8)'; ctx.lineWidth = 2.8 * mk; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      for (const v of [.06, .94]) { const c0 = lp(lp(hb, fb, u - .07), lp(ht, ft, u - .07), v), c1 = lp(lp(hb, fb, u + .07), lp(ht, ft, u + .07), v); ctx.lineWidth = 4 * mk; ctx.strokeStyle = 'rgba(255,214,160,.75)'; ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke(); }
    }
    const hp = lp(lp(hb, fb, .52), lp(ht, ft, .52), .42), hq = lp(lp(hb, fb, .86), lp(ht, ft, .86), .5);
    ctx.lineWidth = 3.4 * mk; ctx.strokeStyle = 'rgba(255,214,160,.85)'; ctx.beginPath(); ctx.moveTo(hp.x, hp.y); ctx.lineTo(hq.x, hq.y); ctx.stroke();
    for (const v of [.2, .5, .8]) { const h = lp(hb, ht, v), h2 = lp(lp(hb, fb, .07), lp(ht, ft, .07), v); ctx.lineWidth = 5 * mk; ctx.strokeStyle = 'rgba(220,200,255,.5)'; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h2.x, h2.y); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    glowStroke(() => { ctx.beginPath(); ctx.moveTo(hb.x, hb.y); ctx.lineTo(ht.x, ht.y); ctx.lineTo(ft.x, ft.y); ctx.lineTo(fb.x, fb.y); ctx.closePath(); }, .75 * edgeK * a, .8);
  }
  /** edges, revealed progressively at the start (each edge drawn from its first corner up to fraction r) */
  function edgePath(list, r) {
    return () => { ctx.beginPath(); for (const [p, q] of list) { const e = lp(p, q, cl(r)); ctx.moveTo(p.x, p.y); ctx.lineTo(e.x, e.y); } };
  }
  window.BZ_container = (C, t, L, inside) => {
    if (!C || C.a <= 0) return;
    C = { ...C, a: C.a * (1 - eIn(kk(t, A.loop0 + .05, A.out))) };   // the loop: fully gone by A.out (frame 0 has no container)
    if (C.a <= 0) return;
    const Pp = projector(C), kf = Pp.kf, m = kf / 1.48, f = nOf(t);
    const rev = eOut(kk(t, A.cont - .05, A.cont + .5)), glassA = cl(kk(t, A.cont - .02, A.cont + .4)) * C.a;
    const c = {}; for (const u of [-1, 1]) for (const v of [-1, 1]) for (const h of [0, 1]) c[`${u}${v}${h}`] = Pp(u, v, h);
    const K = (u, v, h) => c[`${u}${v}${h}`];
    const all = Object.values(c), sil = hull(all), silP = polyPath(sil);
    const front = [K(-1, -1, 0), K(1, -1, 0), K(1, -1, 1), K(-1, -1, 1)], end = [K(-1, 1, 0), K(-1, -1, 0), K(-1, -1, 1), K(-1, 1, 1)];
    const roof = [K(-1, -1, 1), K(1, -1, 1), K(1, 1, 1), K(-1, 1, 1)], floor = [K(-1, -1, 0), K(1, -1, 0), K(1, 1, 0), K(-1, 1, 0)];
    const back = [K(-1, 1, 0), K(1, 1, 0), K(1, 1, 1), K(-1, 1, 1)], rend = [K(1, -1, 0), K(1, 1, 0), K(1, 1, 1), K(1, -1, 1)];
    const th = doorAngle(C, t);
    ctx.save(); ctx.globalAlpha *= C.a;
    contShadow(Pp, C, L, glassA);
    // 1. thick glass: the cloth behind, bent; violet absorption; the glass's own violet, brighter at the top
    if (glassA > .02) {
      ctx.save(); ctx.globalAlpha *= glassA;
      const rc = lp(roof[0], roof[2], .5); refract(sil, rc.x, rc.y + 40 * m, 1.05, -3);
      ctx.beginPath(); silP(); ctx.clip();
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(176,146,246)'; ctx.fillRect(-2000, -2000, 5000, 6000);
      ctx.globalCompositeOperation = 'source-over';
      const top = Math.min(...sil.map(p => p.y)), bot = Math.max(...sil.map(p => p.y));
      let g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(150,112,255,.36)'); g.addColorStop(.5, 'rgba(118,76,255,.24)'); g.addColorStop(1, 'rgba(86,44,220,.34)');
      ctx.fillStyle = g; ctx.fillRect(-2000, top - 2, 5000, bot - top + 4);
      // far walls and floor, seen through the glass
      ctx.fillStyle = 'rgba(40,14,120,.22)'; ctx.beginPath(); polyPath(floor)(); ctx.fill();
      ctx.fillStyle = 'rgba(70,36,170,.16)'; ctx.beginPath(); polyPath(back)(); ctx.fill(); ctx.beginPath(); polyPath(rend)(); ctx.fill();
      ctx.strokeStyle = 'rgba(214,196,255,.10)'; ctx.lineWidth = 1.4 * m; ctx.beginPath();
      for (let i = 1; i < NRIB; i++) { const u = -1 + 2 * i / NRIB, a = Pp(u, 1, .06), b = Pp(u, 1, .94); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= glassA * .5;                    // hidden edges
      glowStroke(() => { ctx.beginPath(); for (const [p, q] of [[K(-1, 1, 0), K(1, 1, 0)], [K(1, 1, 0), K(1, -1, 0)], [K(1, 1, 0), K(1, 1, 1)]]) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); } }, .55, .7 * m);
      ctx.restore();
    }
    // 2. what's inside (TA COMMANDE), behind the near panes
    if (inside) { ctx.save(); inside(); ctx.restore(); }
    // 3. near panes
    if (glassA > .02) {
      ctx.save(); ctx.globalAlpha *= glassA;
      // the long side: tint, vertical corrugations (each rib refracts: a light and a dark line), top & bottom rails, posts
      ctx.save(); ctx.beginPath(); polyPath(front)(); ctx.clip();
      let g = ctx.createLinearGradient(front[3].x, front[3].y, front[0].x, front[0].y); g.addColorStop(0, 'rgba(196,176,255,.15)'); g.addColorStop(1, 'rgba(110,70,255,.08)');
      ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 5000, 6000);
      // trapezoidal corrugations: outer flats (lighter), recessed grooves (darker), a lit edge and a dark edge per rib
      const u0 = -.92, u1 = .92, pitch = (u1 - u0) / NRIB;
      // batched: one path per style (13 ribs → 7 draw calls)
      const bands = (fa, fb) => { ctx.beginPath(); for (let i = 0; i < NRIB; i++) { const ua = u0 + i * pitch; polyPath([Pp(ua + pitch * fa, -1, .075), Pp(ua + pitch * fb, -1, .075), Pp(ua + pitch * fb, -1, .925), Pp(ua + pitch * fa, -1, .925)])(); } };
      const edges = fa => { ctx.beginPath(); for (let i = 0; i < NRIB; i++) { const u = u0 + i * pitch + pitch * fa, a = Pp(u, -1, .075), b = Pp(u, -1, .925); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } };
      bands(0, .16); ctx.fillStyle = 'rgba(30,8,96,.12)'; ctx.fill();
      bands(.62, .78); ctx.fillStyle = 'rgba(30,8,96,.18)'; ctx.fill();
      bands(.78, 1); ctx.fillStyle = 'rgba(20,4,70,.1)'; ctx.fill();
      edges(.78); ctx.strokeStyle = 'rgba(26,6,80,.28)'; ctx.lineWidth = 1.2 * m; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      bands(.16, .62); ctx.fillStyle = 'rgba(176,150,255,.07)'; ctx.fill();
      edges(.16); ctx.strokeStyle = 'rgba(236,226,255,.32)'; ctx.lineWidth = 1.5 * m; ctx.stroke();
      edges(.62); ctx.strokeStyle = 'rgba(200,180,255,.16)'; ctx.lineWidth = 1 * m; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      for (const [h0, h1] of [[0, .075], [.925, 1]]) {              // rails, with a lit lip
        ctx.fillStyle = 'rgba(200,180,255,.2)'; ctx.beginPath(); polyPath([Pp(-1, -1, h0), Pp(1, -1, h0), Pp(1, -1, h1), Pp(-1, -1, h1)])(); ctx.fill();
        const a = Pp(-1, -1, h0 < .5 ? h1 : h0), b = Pp(1, -1, h0 < .5 ? h1 : h0); ctx.strokeStyle = 'rgba(236,226,255,.4)'; ctx.lineWidth = 1.4 * m; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const [u0, u1] of [[-1, -.94], [.94, 1]]) { ctx.fillStyle = 'rgba(200,180,255,.14)'; ctx.beginPath(); polyPath([Pp(u0, -1, 0), Pp(u1, -1, 0), Pp(u1, -1, 1), Pp(u0, -1, 1)])(); ctx.fill(); }
      ctx.restore();
      // the roof: tint, shallow transverse ribs, the bulb's sheen (the brand light from above)
      ctx.save(); ctx.beginPath(); polyPath(roof)(); ctx.clip();
      g = ctx.createLinearGradient(roof[3].x, roof[3].y, roof[0].x, roof[0].y); g.addColorStop(0, 'rgba(226,212,255,.26)'); g.addColorStop(.7, 'rgba(160,126,255,.10)'); g.addColorStop(1, 'rgba(255,206,150,.16)');
      ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 5000, 6000);
      ctx.strokeStyle = 'rgba(232,220,255,.17)'; ctx.lineWidth = 1.5 * m; ctx.beginPath();
      for (let i = 1; i < NROOF; i++) { const u = -1 + 2 * i / NROOF, a = Pp(u, -.94, 1), b = Pp(u, .94, 1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
      ctx.restore();
      // the door end: its frame (header, sill, posts); the leaves are drawn below
      ctx.save(); ctx.beginPath(); polyPath(end)(); ctx.clip();
      ctx.fillStyle = 'rgba(120,80,255,.07)'; ctx.fillRect(-2000, -2000, 5000, 6000);
      ctx.fillStyle = 'rgba(200,180,255,.16)';
      for (const [h0, h1] of [[0, .07], [.9, 1]]) { ctx.beginPath(); polyPath([Pp(-1, 1, h0), Pp(-1, -1, h0), Pp(-1, -1, h1), Pp(-1, 1, h1)])(); ctx.fill(); }
      ctx.restore();
      // 4. a slow caustic band drifting through the box
      ctx.save(); ctx.beginPath(); silP(); ctx.clip();
      const ph = ((f * .8) % 150) / 150, bx = lerpv(Math.min(...sil.map(p => p.x)) - 80, Math.max(...sil.map(p => p.x)) + 80, ph), top = Math.min(...sil.map(p => p.y)), bot = Math.max(...sil.map(p => p.y));
      g = ctx.createLinearGradient(bx - 40, 0, bx + 40, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(236,226,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx + 30, top); ctx.lineTo(bx + 110, top); ctx.lineTo(bx + 30, bot); ctx.lineTo(bx - 50, bot); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
    }
    // 5. glowing amber edges (traced in at A.cont), corner castings, a spark running along the front edges
    const vis = [[K(-1, -1, 0), K(1, -1, 0)], [K(1, -1, 0), K(1, -1, 1)], [K(-1, -1, 1), K(1, -1, 1)], [K(-1, -1, 0), K(-1, -1, 1)],
      [K(-1, -1, 1), K(-1, 1, 1)], [K(1, -1, 1), K(1, 1, 1)], [K(-1, 1, 1), K(1, 1, 1)], [K(-1, 1, 0), K(-1, 1, 1)], [K(-1, 1, 0), K(-1, -1, 0)]];
    glowStroke(edgePath(vis, rev), 1, m);
    if (rev > .98) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const q of [K(-1, -1, 0), K(1, -1, 0), K(-1, -1, 1), K(1, -1, 1), K(-1, 1, 1), K(1, 1, 1), K(-1, 1, 0)]) {
        const r = 13 * m, rg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); rg.addColorStop(0, 'rgba(255,236,200,.85)'); rg.addColorStop(.3, 'rgba(255,170,70,.42)'); rg.addColorStop(1, 'rgba(255,140,30,0)');
        ctx.fillStyle = rg; ctx.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
      }
      const loop = [K(-1, -1, 1), K(1, -1, 1), K(1, -1, 0), K(-1, -1, 0)], tp = ((f * 1.3) % 120) / 120, seg = Math.floor(tp * 3), sp = lp(loop[seg], loop[seg + 1], tp * 3 - seg);
      const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 20 * m); sg.addColorStop(0, 'rgba(255,244,220,.9)'); sg.addColorStop(.3, 'rgba(255,180,80,.35)'); sg.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = sg; ctx.fillRect(sp.x - 20 * m, sp.y - 20 * m, 40 * m, 40 * m);
      ctx.restore();
    } else {                                                          // the tracing heads
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [p, q] of vis) { const e = lp(p, q, rev), r = 16 * m, rg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r); rg.addColorStop(0, 'rgba(255,248,230,.95)'); rg.addColorStop(.35, 'rgba(255,170,70,.4)'); rg.addColorStop(1, 'rgba(255,140,30,0)'); ctx.fillStyle = rg; ctx.fillRect(e.x - r, e.y - r, 2 * r, 2 * r); }
      ctx.restore();
    }
    // 6. the two glass leaves (far one first), and the violet ripple where the parcel went through the roof
    const lv = [leafQuad(Pp, 1, th), leafQuad(Pp, -1, th)];
    for (const q of lv) drawLeaf(q, glassA, t, rev, m);
    const dl = t - A.loop0;                                          // the loop: a burst of violet light out of the doorway
    if (dl > -.02 && dl < .45) {
      const k = cl((dl + .02) / .47), a = Math.sin(Math.PI * Math.min(1, k * 2.2)) * Math.pow(1 - k, .6), ctr = lp(lp(end[0], end[2], .5), lp(end[1], end[3], .5), .5), r = (60 + 160 * eOut(k)) * m;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(ctr.x, ctr.y, 0, ctr.x, ctr.y, r); g.addColorStop(0, `rgba(246,240,255,${(.85 * a).toFixed(3)})`); g.addColorStop(.25, `rgba(170,130,255,${(.45 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(123,75,255,0)');
      ctx.fillStyle = g; ctx.fillRect(ctr.x - r, ctr.y - r, 2 * r, 2 * r); ctx.restore();
    }
    const dr = t - (A.enter - .06);
    if (dr > 0 && dr < .7) {
      const k = dr / .7, a = Math.pow(1 - k, 1.5), ctr = lp(roof[0], roof[2], .5), rx = (40 + 150 * eOut(k)) * m;
      ctx.save(); ctx.beginPath(); polyPath(roof)(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      for (const [d, al] of [[0, .7], [.12, .4], [.24, .22]]) {
        const rr = rx * (1 - d); if (rr <= 2) continue;
        ctx.strokeStyle = `rgba(226,210,255,${(al * a).toFixed(3)})`; ctx.lineWidth = (4 - 2 * k) * m;
        ctx.beginPath(); ctx.ellipse(ctr.x, ctr.y, rr, rr * .48, -.25, 0, TAU); ctx.stroke();
      }
      const fg = ctx.createRadialGradient(ctr.x, ctr.y, 0, ctr.x, ctr.y, 90 * m); fg.addColorStop(0, `rgba(236,226,255,${(.5 * Math.pow(1 - k, 3)).toFixed(3)})`); fg.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = fg; ctx.fillRect(ctr.x - 90 * m, ctr.y - 90 * m, 180 * m, 180 * m);
      ctx.restore();
    }
    ctx.restore();
  };

  // =========================================================================================== THE STICKER ON THE PARCEL
  const STK_W = 120, STK_H = 84;                                   // sprite units (drawn at ≈ 0.45× on the parcel)
  const stickerSprite = () => sprite('sticker', STK_W + 8, STK_H + 8, () => {
    const w = STK_W, h = STK_H;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#8456FF'); g.addColorStop(1, '#5A24E0');
    ctx.fillStyle = g; rrect(-w / 2, -h / 2, w, h, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,232,.85)'; ctx.lineWidth = 2.4; rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 6); ctx.stroke();
    const rx = -w / 2 + 25;
    ctx.fillStyle = '#FFF8EC'; circle(rx, -9, 15.5); ctx.fill();
    drawLogo(rx, -9, 25);
    ctx.fillStyle = '#FFF8EC'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 22px Satoshi'; ctx.fillText('BONZINI', rx + 21, -1);
    ctx.font = '900 11.5px Satoshi'; ctx.letterSpacing = '1.2px'; ctx.fillText('TRADING CARGO', -w / 2 + 12, 26); ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rrect(-w / 2 + 3, -h / 2 + 3, w - 6, h * .38, 7); ctx.fill();          // gloss
  }, 3);
  window.BZ_onParcel = (P, face, t, L) => {
    const k = cl(P.bzLabel || 0); if (k <= 0) return;
    const d = t - A.bzLabel, loopK = t >= A.loop0 ? 1 - k : 0;
    const w = face.w * .4, sc = w / STK_W, x = face.x0 + face.w * .8, y = face.y0 + face.h * .64;
    // the slap: comes down big and tilted, squashes flat, settles
    const land = t < A.bzLabel ? k : 1, big = 1 + .9 * (1 - eOut(land)), q = d > 0 ? Math.exp(-d * 10) * Math.cos(d * 34) * .14 : 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.07 - .3 * (1 - land) + .5 * loopK); ctx.scale(sc * big * (1 + q), sc * big * (1 - q));
    ctx.globalAlpha *= Math.min(1, land * 2) * (1 - loopK);
    if (loopK > 0) { ctx.translate(STK_W * .5, -STK_H * .5); ctx.rotate(-.9 * loopK); ctx.translate(-STK_W * .5, STK_H * .5); }   // peels off from a corner
    ctx.save(); ctx.translate(2.5, 4); ctx.fillStyle = 'rgba(30,14,4,.35)'; rrect(-STK_W / 2, -STK_H / 2, STK_W, STK_H, 9); ctx.fill(); ctx.restore();
    blit(stickerSprite());
    // relit: the box's light (the violet brand light from above) and a flash as it hits
    const tn = PL_tintAt(face.foot.x, face.foot.y, L);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${Math.min(255, 255 * (tn[0] * .3 + .72)) | 0},${Math.min(255, 255 * (tn[1] * .3 + .72)) | 0},${Math.min(255, 255 * (tn[2] * .3 + .72)) | 0})`;
    rrect(-STK_W / 2, -STK_H / 2, STK_W, STK_H, 9); ctx.fill();
    if (d > 0 && d < .35) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(236,226,255,${(.7 * Math.pow(1 - d / .35, 2)).toFixed(3)})`; rrect(-STK_W / 2, -STK_H / 2, STK_W, STK_H, 9); ctx.fill(); }
    ctx.restore();
    if (d > 0 && d < .45) {                                         // a ring of violet sparks around it
      const e = eOut(d / .45), a = 1 - d / .45;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,180,255,${(.8 * a).toFixed(3)})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + .3, r0 = w * (.45 + .5 * e), r1 = r0 + 9 * (1 - e) + 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * .75); ctx.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * .75); ctx.stroke(); }
      ctx.restore();
    }
  };

  // =========================================================================================== THE ENAMEL PLATE (+ the caption)
  const PW = 860, PH = 210, PR = 34, PD = 14;
  function rivet(x, y) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, '#CFCAD9'); g.addColorStop(1, '#6D6680');
    ctx.fillStyle = 'rgba(20,6,60,.45)'; circle(x + 1.5, y + 2.5, 10); ctx.fill();
    ctx.fillStyle = g; circle(x, y, 9.5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,60,.7)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 5.5, y + 3); ctx.lineTo(x + 5.5, y - 3); ctx.stroke();
  }
  const plateSprite = () => sprite('plate', PW + 12, PH + 24, () => {
    const g = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2);
    g.addColorStop(0, '#8450FF'); g.addColorStop(.5, '#6629F4'); g.addColorStop(1, '#4C1AD0');
    ctx.fillStyle = g; rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.fill();
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    for (let i = 0; i < 900; i++) { ctx.fillStyle = rnd(i * 3.3) > .5 ? 'rgba(255,255,255,.045)' : 'rgba(10,0,40,.06)'; ctx.fillRect(-PW / 2 + rnd(i * 1.7) * PW, -PH / 2 + rnd(i * 2.9) * PH, 2, 2); }
    const sh = ctx.createLinearGradient(0, PH / 2 - 56, 0, PH / 2); sh.addColorStop(0, 'rgba(15,0,50,0)'); sh.addColorStop(1, 'rgba(15,0,50,.28)');
    ctx.fillStyle = sh; ctx.fillRect(-PW / 2, PH / 2 - 56, PW, 56);
    // rolled enamel rim (light on top, deep below)
    for (let i = 0; i < 12; i++) {
      const f = Math.pow(1 - i / 12, 1.8), q = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2);
      q.addColorStop(0, `rgba(236,226,255,${(.5 * f).toFixed(3)})`); q.addColorStop(.4, 'rgba(236,226,255,0)'); q.addColorStop(.6, 'rgba(18,2,60,0)'); q.addColorStop(1, `rgba(18,2,60,${(.55 * f).toFixed(3)})`);
      ctx.lineWidth = 1.25; ctx.strokeStyle = q; rrect(-PW / 2 + i + .5, -PH / 2 + i + .5, PW - 2 * i - 1, PH - 2 * i - 1, Math.max(2, PR - i)); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.translate(0, 1.6); ctx.strokeStyle = 'rgba(20,4,70,.45)'; ctx.lineWidth = 6; rrect(-PW / 2 + 15, -PH / 2 + 15, PW - 30, PH - 30, PR - 13); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#F6EDDC'; ctx.lineWidth = 5; rrect(-PW / 2 + 15, -PH / 2 + 15, PW - 30, PH - 30, PR - 13); ctx.stroke();   // pinstripe
    // the logo on a cream enamel roundel
    const rx = -PW / 2 + 118;
    ctx.fillStyle = 'rgba(16,4,56,.42)'; circle(rx + 2, 6, 74); ctx.fill();
    const rg = ctx.createRadialGradient(rx - 20, -24, 10, rx, 0, 76); rg.addColorStop(0, '#FFFDF7'); rg.addColorStop(1, '#EFE5D1');
    ctx.fillStyle = rg; circle(rx, 0, 72); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 3; circle(rx, 0, 64); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(rx, 0, 71, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    drawLogo(rx, 0, 116);
    // lettering (fired cream enamel: a deep-violet seat under the cream)
    const tx = 98;
    text('BONZINI', tx, 16 + 5, { font: font('Satoshi', 104, 900), align: 'center', color: '#2A0C7E', ls: 5 });
    text('BONZINI', tx, 16, { font: font('Satoshi', 104, 900), align: 'center', color: P.creamW, ls: 5 });
    text('TRADING CARGO', tx, 70 + 3, { font: font('Satoshi', 44, 900), align: 'center', color: '#2A0C7E', ls: 10 });
    text('TRADING CARGO', tx, 70, { font: font('Satoshi', 44, 900), align: 'center', color: '#E6DBFF', ls: 10 });
    // glaze: the upper half catches the light
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    const hg = ctx.createLinearGradient(0, -PH / 2, 0, -8); hg.addColorStop(0, 'rgba(255,255,255,.26)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-PW / 2, -PH / 2); ctx.lineTo(PW / 2, -PH / 2); ctx.lineTo(PW / 2, -28); ctx.bezierCurveTo(PW / 4, -2, -PW / 4, -14, -PW / 2, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (const [x, y] of [[-PW / 2 + 34, -PH / 2 + 34], [PW / 2 - 34, -PH / 2 + 34], [-PW / 2 + 34, PH / 2 - 34], [PW / 2 - 34, PH / 2 - 34]]) rivet(x, y);
  }, 1.5);
  const plateShadow = () => shadowSprite('plateSh', PW, PH, PR, 26, 'rgba(4,2,12,1)');

  // the caption: a cream enamel strip hung under the plate by two rings
  const CAP_F = '900 62px Satoshi', CAP_W = 850, CAP_H = 178, CAP_R = 22;
  function icon(kind, col) {                                        // tiny sea / air pictograms (no text)
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'sea') {
      ctx.beginPath(); ctx.moveTo(-24, -2); ctx.lineTo(24, -2); ctx.lineTo(16, 11); ctx.lineTo(-17, 11); ctx.closePath(); ctx.fill();
      ctx.fillRect(-13, -13, 11, 10); ctx.fillRect(0, -13, 11, 10); ctx.fillRect(-6, -22, 11, 8);
      ctx.lineWidth = 3.2; ctx.beginPath(); for (let x = -26; x <= 26; x += 2) { const y = 19 + 2.6 * Math.sin(x * .36); x === -26 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    } else { ctx.scale(1.02, 1.02); iconPlane(col); }
    ctx.restore();
  }
  const captionSprite = () => sprite('caption', CAP_W + 40, CAP_H + 50, () => {
    const w = CAP_W, h = CAP_H;
    ctx.save(); ctx.shadowColor = 'rgba(4,2,12,.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 20000; ctx.shadowOffsetY = 12; ctx.fillStyle = '#000'; rrect(-w / 2 - 20000, -h / 2, w, h, CAP_R); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#C9BBA2'; rrect(-w / 2, -h / 2 + 7, w, h, CAP_R); ctx.fill();               // the enamel's thickness
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#FFFCF4'); g.addColorStop(1, '#EFE4CF');
    ctx.fillStyle = g; rrect(-w / 2, -h / 2, w, h, CAP_R); ctx.fill();
    ctx.strokeStyle = 'rgba(91,43,223,.85)'; ctx.lineWidth = 4; rrect(-w / 2 + 11, -h / 2 + 11, w - 22, h - 22, CAP_R - 9); ctx.stroke();
    // rings' eyelets
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 70), y = -h / 2 + 2; ctx.fillStyle = '#B9AFC9'; circle(x, y, 9); ctx.fill(); ctx.fillStyle = '#5A5470'; circle(x, y, 4); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = CAP_F; ctx.fillStyle = '#3F17B8'; ctx.fillText('DE LA CHINE À DOUALA', 0, -10);
    const l2 = 'MER OU AIR', w2 = ctx.measureText(l2).width;
    ctx.fillText(l2, 0, 62);
    ctx.save(); ctx.translate(-w2 / 2 - 52, 40); icon('sea', '#3F17B8'); ctx.restore();
    ctx.save(); ctx.translate(w2 / 2 + 52, 38); ctx.rotate(-.2); icon('air', '#3F17B8'); ctx.restore();
    ctx.save(); rrect(-w / 2, -h / 2, w, h, CAP_R); ctx.clip();
    const hg = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + 50); hg.addColorStop(0, 'rgba(255,255,255,.6)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fillRect(-w / 2, -h / 2, w, 50); ctx.restore();
  }, 1.5);
  function caption(st, t, L) {
    const s0 = A.service; if (t < s0 - .05 || t >= A.endcard) return;
    const d = t - s0, fade = 1 - kk(t, A.endcard - .16, A.endcard);
    const drop = eOut(kk(d, -.05, .22)), sw = .16 * Math.exp(-Math.max(0, d) * 3.2) * Math.cos(Math.max(0, d) * 9.5) * (d > 0 ? 1 : 0);
    const hangY = st.y + PH / 2 * st.sy - 6, cy = G.bz.serviceY, len = cy - CAP_H / 2 - hangY;
    ctx.save(); ctx.globalAlpha *= Math.min(1, drop * 1.6) * fade;
    ctx.translate(st.x, hangY); ctx.rotate(sw);
    ctx.translate(0, -(1 - drop) * 120);
    // the two rings (chains)
    for (const sx of [-1, 1]) {
      const x = sx * (CAP_W / 2 - 70);
      ctx.strokeStyle = 'rgba(10,4,24,.55)'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.ellipse(x + 1.5, len * .5 + 3, 9, len * .5 + 2, 0, 0, TAU); ctx.stroke();
      const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, '#8C87A0'); g.addColorStop(.45, '#F2F0F8'); g.addColorStop(1, '#6D6680');
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, len * .5, 9, len * .5 + 2, 0, 0, TAU); ctx.stroke();
    }
    ctx.translate(0, len + CAP_H / 2);
    blit(captionSprite());
    const tn = PL_tintAt(st.x, cy, L), I = .82 + .18 * Math.min(1, (tn[0] + tn[1] + tn[2]) / 3);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${255 * I | 0},${255 * I * .985 | 0},${255 * I * .97 | 0})`; rrect(-CAP_W / 2, -CAP_H / 2, CAP_W, CAP_H, CAP_R); ctx.fill();
    ctx.restore();
  }
  window.BZ_plate = (st, t, L) => {
    if (!st || st.a <= 0) return;
    const fallK = kk(t, A.plateBZ - .22, A.plateBZ), up = eIn(kk(t, A.endcard, A.endcard + .3)), air = Math.max(1 - eIn(fallK), .7 * up);
    const persp = 1 + .14 * air;
    ctx.save(); ctx.globalAlpha *= st.a * (1 - kk(t, A.endcard + .04, A.endcard + .24));
    // breath of brand light on the cloth below at touchdown
    const dl = t - A.plateBZ;
    if (dl > -.04 && dl < 1) {
      const a = Math.pow(cl((dl + .04) / .12), .7) * Math.pow(1 - cl(dl), 2) * .5;
      ctx.save(); ctx.translate(st.x, st.y + 160); ctx.scale(1, .4); ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(0, 0, 80, 0, 0, 560); rg.addColorStop(0, `rgba(140,96,255,${(.45 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(110,70,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(-560, -560, 1120, 1120); ctx.restore();
    }
    at(st.x + 8 + 50 * air, st.y + 22 + 130 * air, st.rot, st.sx * (1 + .25 * air), st.sy * (1 + .25 * air), () => { ctx.globalAlpha *= .6 * (1 - .6 * air); blit(plateShadow()); });
    caption(st, t, L);
    at(st.x, st.y, st.rot, st.s * st.sx * persp, st.s * st.sy * persp, () => {
      for (let i = PD; i >= 1; i--) { ctx.fillStyle = rgba(PL_mix([86, 46, 200], [24, 8, 70], Math.pow(i / PD, .7)), 1); rrect(-PW / 2, -PH / 2 + i, PW, PH, PR); ctx.fill(); }   // thickness
      blit(plateSprite());
      // the bulb mirrored in the glossy enamel (it sways), and the reflection sweep
      ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
      const bx = Math.max(-PW / 2 + 80, Math.min(PW / 2 - 80, (L.x - st.x) * .6));
      ctx.globalCompositeOperation = 'screen'; ctx.save(); ctx.translate(bx, -PH / 2 + 22); ctx.scale(1, .16);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 170); rg.addColorStop(0, `rgba(255,240,222,${(.55 * L.on).toFixed(3)})`); rg.addColorStop(.3, `rgba(255,226,200,${(.16 * L.on).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,220,190,0)');
      ctx.fillStyle = rg; ctx.fillRect(-170, -170, 340, 340); ctx.restore();
      const sw = st.sweep;
      if (sw > 0 && sw < 1) {
        const x = -PW / 2 - 260 + (PW + 520) * ease(sw), env = Math.sin(Math.PI * sw);
        ctx.globalCompositeOperation = 'lighter'; ctx.transform(1, 0, -.42, 1, 0, 0);
        const band = (x0, wd, a) => { const g = ctx.createLinearGradient(x0 - wd, 0, x0 + wd, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(250,246,255,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - wd, -PH, 2 * wd, 2 * PH); };
        band(x, 150, .1 * env); band(x, 60, .42 * env); band(x - 110, 18, .3 * env);
      }
      ctx.restore();
      // the balafon signature: two glints rising on the enamel (A.sig, then the second note). v2: the signature now plays
      // .3 s BEFORE the plate lands (both in the pause before « Ensuite »), so the glints wait for the touchdown
      const g0 = Math.max(A.sig, A.plateBZ + .04);
      for (let i = 0; i < 2; i++) {
        const d = t - (g0 + .2 * i); if (d < 0 || d > .5) continue;
        const k = d / .5, a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k), gx = PW / 2 - 150 + 70 * i, gy = -PH / 2 + 30 - 26 * i - 18 * k;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(gx, gy);
        const r = 46 * (.6 + .4 * Math.sin(Math.PI * Math.min(1, k * 1.4)));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(255,250,240,${(.95 * a).toFixed(3)})`); g.addColorStop(.2, `rgba(220,200,255,${(.4 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(160,120,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.strokeStyle = `rgba(255,250,240,${(.9 * a).toFixed(3)})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r * .9, 0); ctx.lineTo(r * .9, 0); ctx.moveTo(0, -r * .9); ctx.lineTo(0, r * .9); ctx.stroke();
        ctx.restore();
      }
    });
    // touchdown: a little enamel dust kicked out from under it
    const d = t - A.plateBZ;
    if (d >= 0 && d < .6) {
      const q = d / .6, e = 1 - Math.pow(1 - q, 2);
      for (let i = 0; i < 16; i++) {
        const side = i % 3 === 0 ? -1 : 1, x0 = st.x + (rnd(i * 4.1) - .5) * PW * .95, y0 = st.y + side * PH / 2;
        const vx = (x0 - st.x) / PW * 260 + (rnd(i * 7.7) - .5) * 90, vy = side * (50 + rnd(i * 2.3) * 110);
        ctx.fillStyle = `rgba(226,214,255,${(.7 * (1 - q)).toFixed(3)})`; circle(x0 + vx * e * .6, y0 + vy * e * .6, 2 + 3.5 * rnd(i * 5.3) * (1 - q * .5)); ctx.fill();
      }
    }
    ctx.restore();
  };

  // =========================================================================================== THE WAREHOUSE TAG
  // G.bz.tag (222, 1170) sits on the container's door end in this 3/4 view: the tag is pinned above-left of the box instead
  const TAG_X = 276, TAG_Y = 962, TAG_W = 450, TAG_H = 150, TAG_L1 = '700 44px Satoshi', TAG_L2 = '900 48px Satoshi';
  const tagSprite = () => sprite('tag', TAG_W + 30, TAG_H + 30, () => {
    const w = TAG_W, h = TAG_H, c = 30;                            // a die-cut luggage tag: clipped corners on the eyelet end (left)
    const shape = () => { ctx.beginPath(); ctx.moveTo(-w / 2 + c, -h / 2); ctx.lineTo(w / 2 - 8, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 8); ctx.lineTo(w / 2, h / 2 - 8); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 8, h / 2);
      ctx.lineTo(-w / 2 + c, h / 2); ctx.lineTo(-w / 2, h / 2 - c); ctx.lineTo(-w / 2, -h / 2 + c); ctx.closePath(); };
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#E2C28F'); g.addColorStop(1, '#C9A06A');
    shape(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    for (let i = 0; i < 700; i++) { const x = (rnd(i * 1.9 + 4) - .5) * w, y = (rnd(i * 2.3 + 8) - .5) * h, a = rnd(i * 3.1) * 3, l = 3 + rnd(i * 4.7) * 9;
      ctx.strokeStyle = rnd(i * 5.3) > .55 ? 'rgba(120,80,40,.14)' : 'rgba(255,236,200,.22)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(70,40,15,.35)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); rrect(-w / 2 + 52, -h / 2 + 10, w - 62, h - 20, 6); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    shape(); ctx.strokeStyle = 'rgba(90,56,22,.45)'; ctx.lineWidth = 1.6; ctx.stroke();
    // the reinforced eyelet
    const ex = -w / 2 + 26; ctx.fillStyle = '#B88A52'; circle(ex, 0, 15); ctx.fill(); ctx.fillStyle = '#E9D3AE'; circle(ex, 0, 11.5); ctx.fill(); ctx.fillStyle = 'rgba(20,10,30,.85)'; circle(ex, 0, 6); ctx.fill();
    ctx.fillStyle = P.kInk; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = TAG_L1; ctx.fillText('Entrepôt ·', -w / 2 + 64, -10);
    ctx.font = TAG_L2; ctx.fillText('Foyer Balengou', -w / 2 + 62, 48);
  }, 1.5);
  function tag(t, L) {
    const t0 = A.tagBZ, t1 = A.endcard; if (t < t0 - .25 || t >= t1) return;
    const pin = { x: TAG_X - TAG_W / 2 + 20, y: TAG_Y - 40 };          // the pin sits at the eyelet end
    const d = t - t0, fade = 1 - kk(t, t1 - .2, t1), arrive = eOut(kk(t, t0 - .25, t0));
    // swings on its pin: in from a steep angle, damped pendulum, settles a little tilted
    const ang = -.06 + (d < 0 ? .9 * (1 - arrive) : .55 * Math.exp(-d * 3.4) * Math.cos(d * 8.2));
    const tn = PL_tintAt(TAG_X, TAG_Y, L), I = [.74 + .26 * tn[0], .74 + .26 * tn[1], .74 + .26 * tn[2]];
    ctx.save(); ctx.globalAlpha *= Math.min(1, arrive * 1.5) * fade;
    ctx.translate(pin.x, pin.y); ctx.rotate(ang);
    // the string from the pin to the eyelet
    ctx.strokeStyle = 'rgba(232,214,180,.9)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, 26, 6, 40); ctx.stroke();
    ctx.translate(TAG_W / 2 - 20, 40);
    ctx.save(); ctx.translate(6, 12); ctx.globalAlpha *= .5; ctx.fillStyle = 'rgba(6,3,14,1)'; rrect(-TAG_W / 2, -TAG_H / 2, TAG_W, TAG_H, 10); ctx.fill(); ctx.restore();
    blit(tagSprite());
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${255 * I[0] | 0},${255 * I[1] | 0},${255 * I[2] | 0})`; rrect(-TAG_W / 2, -TAG_H / 2, TAG_W, TAG_H, 10); ctx.fill();
    ctx.restore();
    // the violet push pin (Bonzini), jabbed in at t0
    const jab = d < 0 ? 1.8 : 1 + .8 * Math.exp(-d * 14);
    ctx.save(); ctx.translate(pin.x, pin.y); ctx.globalAlpha *= Math.min(1, arrive * 2) * fade; ctx.scale(jab, jab);
    ctx.fillStyle = 'rgba(6,3,14,.5)'; circle(4, 7, 13); ctx.fill();
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 14); g.addColorStop(0, '#C9B4FF'); g.addColorStop(.45, '#7B4BFF'); g.addColorStop(1, '#3B17A8');
    ctx.fillStyle = g; circle(0, 0, 13); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; circle(-4.5, -5, 3.2); ctx.fill();
    ctx.restore();
  }
  window.BZ_scene = (t, L) => { tag(t, L); };
})();
