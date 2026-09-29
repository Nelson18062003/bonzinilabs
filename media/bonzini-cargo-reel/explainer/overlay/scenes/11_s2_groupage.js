'use strict';
// ============================================================================================
// s2 « 02 · LE GROUPAGE » — full-screen motion design (V04). Signature pedagogical animation.
//   V04 start        : an x-ray shipping container draws itself (teal, corrugated walls)
//   "groupage"       : its doors swing open
//   "colis"          : three colour-coded parcel stacks drop onto the quay
//   "plusieurs clients" : « Client A / B / C » plates (amber / violet / orange)
//   "réunis"         : the parcels fly in arcs into the container and stack, client by client
//   "conteneur"      : the doors slam shut — thud, dust, seal
//   "Chacun"         : each client's space lights up + headline « 3 clients · 1 conteneur »
//   "espace partagé" : the three plates merge into one shared split bar
// Content zone y 320–1110. Deterministic (rnd only). All times from TL.
// ============================================================================================
(function () {
  const K = window.MG12;
  const CHID = 's2', SEG = 'V04';

  // ---- container geometry (axonometric, long side almost frontal so the three zones read like a bar) ----
  const EU = [0.93, 0.30], EV = [-0.60, 0.42];
  const CT = { x: 548, y: 662, hw: 280, hd: 98, h: 200 };
  const TEAL = '#17A5AE', TEAL_D = '#0D5E68', TEAL_DD = '#082C35';
  const CL = [
    { name: 'Client A', col: AMBER, zc: -187, box: [88, 92, 80], quay: [212, 956], side: -1 },
    { name: 'Client B', col: VIOLET, zc: 0, box: [90, 92, 76], quay: [524, 970], side: 0 },
    { name: 'Client C', col: ORANGE, zc: 187, box: [88, 92, 86], quay: [832, 956], side: 1 },
  ];
  // local slots per client (u offset, v, layer) — container fill order (back row first, bottom first)
  const FILL = [
    [[-47, -50, 0], [47, -50, 0], [-47, -50, 1], [-47, 50, 0], [47, 50, 0]],
    [[-47, -50, 0], [47, -50, 0], [-47, -50, 1], [47, -50, 1], [-47, 50, 0], [47, 50, 0]],
    [[-47, -50, 0], [47, -50, 0], [47, -50, 1], [-47, 50, 0], [47, 50, 0]],
  ];
  const QS = 0.6; // quay scale
  const BAR = { x0: 135, x1: 935, y: 1048, h: 74 };

  function parcelBox(P, w, d, h, col, o = {}) {
    K.box(P, 0, 0, 0, w, d, h, col, { edge: K.shade(col, -0.62), lw: 2, alpha: o.alpha });
    ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
    const hw = w / 2, hd = d / 2, tw = d * 0.1;
    // tape band across the top (along u) and down the right face
    K.fillPoly([P(-hw, -tw, h + .5), P(hw, -tw, h + .5), P(hw, tw, h + .5), P(-hw, tw, h + .5)], 'rgba(255,255,255,.28)');
    K.fillPoly([P(hw, -tw, h), P(hw, tw, h), P(hw, tw, h * .55), P(hw, -tw, h * .55)], 'rgba(255,255,255,.22)');
    // white shipping label on the front face
    K.fillPoly([P(-hw + 12, hd, h * .28), P(-hw + 12 + w * .36, hd, h * .28), P(-hw + 12 + w * .36, hd, h * .6), P(-hw + 12, hd, h * .6)], 'rgba(255,255,255,.92)', 'rgba(0,0,0,.25)', 1);
    K.seg(P(-hw + 18, hd, h * .5), P(-hw + 6 + w * .36, hd, h * .5), 'rgba(40,30,60,.65)', 1.6);
    K.seg(P(-hw + 18, hd, h * .39), P(-hw + w * .3, hd, h * .39), 'rgba(40,30,60,.5)', 1.6);
    if (o.flash > 0) {
      const q = [P(-hw, hd, 0), P(-hw, hd, h), P(-hw, -hd, h), P(hw, -hd, h), P(hw, -hd, 0), P(hw, hd, 0)];
      ctx.globalAlpha *= o.flash; ctx.shadowColor = col; ctx.shadowBlur = 16; K.fillPoly(q, null, K.shade(col, .6), 2.5);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- container parts
  function ribs(P, a, b, n, face, z0, z1, col, lw) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const k = lerp(a, b, i / n); const p = face(k, z0), q = face(k, z1);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke(); ctx.restore();
  }
  function containerBack(P, a) {
    const { hw, hd, h } = CT;
    ctx.save(); ctx.globalAlpha *= a;
    // floor (wood)
    K.fillPoly([P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, hd, 0), P(-hw, hd, 0)], '#2B2030');
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let v = -hd + 22; v < hd; v += 22) { const p = P(-hw, v, 0), q = P(hw, v, 0); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke(); ctx.restore();
    // back long wall (inner side)
    const bw = [P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, -hd, h), P(-hw, -hd, h)];
    const g = ctx.createLinearGradient(0, bw[2][1], 0, bw[1][1]); g.addColorStop(0, '#0E4450'); g.addColorStop(1, TEAL_DD);
    K.fillPoly(bw, g);
    ribs(P, -hw, hw, 28, (u, z) => P(u, -hd, z), 6, h - 6, 'rgba(92,240,255,.13)', 3);
    ribs(P, -hw + 5, hw + 5, 28, (u, z) => P(u, -hd, z), 6, h - 6, 'rgba(0,0,0,.25)', 2);
    // far end wall (inner side)
    K.fillPoly([P(-hw, -hd, 0), P(-hw, hd, 0), P(-hw, hd, h), P(-hw, -hd, h)], '#0B3843');
    ribs(P, -hd, hd, 9, (v, z) => P(-hw, v, z), 6, h - 6, 'rgba(92,240,255,.12)', 3);
    ctx.restore();
  }
  function railQuad(P, pts, col, a = 1) { ctx.save(); ctx.globalAlpha *= a; K.fillPoly(pts.map(p => P(...p)), col, K.shade(col, -.5), 1.4); ctx.restore(); }
  function containerFront(P, a, glowK) {
    const { hw, hd, h } = CT;
    ctx.save(); ctx.globalAlpha *= a;
    // translucent front long wall (x-ray)
    const fw = [P(-hw, hd, 0), P(hw, hd, 0), P(hw, hd, h), P(-hw, hd, h)];
    K.fillPoly(fw, 'rgba(23,165,174,.13)');
    ribs(P, -hw, hw, 28, (u, z) => P(u, hd, z), 10, h - 10, 'rgba(120,245,255,.24)', 2.2);
    // translucent roof
    K.fillPoly([P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h)], 'rgba(23,165,174,.10)');
    ribs(P, -hw, hw, 24, (u, _z) => P(u, _z < 0 ? -hd : hd, h), -1, 1, 'rgba(120,245,255,.14)', 1.6);
    // frame: rails + posts (solid teal)
    const T = 11;
    railQuad(P, [[-hw, hd, 0], [hw, hd, 0], [hw, hd, T], [-hw, hd, T]], TEAL);
    railQuad(P, [[-hw, hd, h - T], [hw, hd, h - T], [hw, hd, h], [-hw, hd, h]], TEAL);
    railQuad(P, [[-hw, hd, 0], [-hw + T, hd, 0], [-hw + T, hd, h], [-hw, hd, h]], TEAL);
    railQuad(P, [[-hw, -hd, h], [hw, -hd, h], [hw, -hd + T, h], [-hw, -hd + T, h]], '#1BC0C9');
    railQuad(P, [[-hw, hd - T, h], [hw, hd - T, h], [hw, hd, h], [-hw, hd, h]], '#1BC0C9');
    railQuad(P, [[-hw, -hd, h], [-hw + T, -hd, h], [-hw + T, hd, h], [-hw, hd, h]], '#1BC0C9');
    // glowing silhouette edges
    ctx.save(); ctx.shadowColor = CYAN; ctx.shadowBlur = 12 + 10 * glowK; ctx.strokeStyle = K.rgba(CYAN, .55 + .35 * glowK); ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    K.path([P(-hw, hd, 0), P(-hw, hd, h), P(-hw, -hd, h), P(hw, -hd, h), P(hw, -hd, 0), P(hw, hd, 0)]); ctx.stroke();
    ctx.beginPath(); const e1 = P(-hw, hd, h), e2 = P(hw, hd, h), e3 = P(hw, -hd, h); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(e3[0], e3[1]);
    const e4 = P(hw, hd, 0); ctx.moveTo(e2[0], e2[1]); ctx.lineTo(e4[0], e4[1]); ctx.stroke();
    ctx.restore();
    // corner castings
    for (const [u, v, z] of [[-hw, hd, 0], [hw, hd, 0], [-hw, hd, h], [hw, hd, h], [hw, -hd, h], [-hw, -hd, h], [hw, -hd, 0]]) {
      const c = P(u, v, z); ctx.fillStyle = '#0A3C44'; ctx.strokeStyle = 'rgba(160,250,255,.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.rect(c[0] - 7, c[1] - 6, 14, 12); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // end frame (u = +hw) + doors
  function containerEnd(P, a, theta, lockK) {
    const { hw, hd, h } = CT, T = 11;
    ctx.save(); ctx.globalAlpha *= a;
    // opening seen when doors are open: dark interior with a warm light
    K.fillPoly([P(hw, hd, 0), P(hw, -hd, 0), P(hw, -hd, h), P(hw, hd, h)], K.rgba('#061A20', .35 * clamp(theta / .6)));
    // posts + header + sill
    railQuad(P, [[hw, hd, 0], [hw, hd - T, 0], [hw, hd - T, h], [hw, hd, h]], TEAL_D);
    railQuad(P, [[hw, -hd + T, 0], [hw, -hd, 0], [hw, -hd, h], [hw, -hd + T, h]], TEAL_D);
    railQuad(P, [[hw, hd, h - 16], [hw, -hd, h - 16], [hw, -hd, h], [hw, hd, h]], TEAL_D);
    railQuad(P, [[hw, hd, 0], [hw, -hd, 0], [hw, -hd, 8], [hw, hd, 8]], TEAL_D);
    const leaf = (hv, sgn, first) => {
      // hinge at (hw, hv); closed leaf points toward v = 0 (direction -sgn); opens outward (+u)
      const L = hd - 2, du = Math.sin(theta), dv = -sgn * Math.cos(theta);
      const F = [hw + du * L, hv + dv * L];
      const z0 = 8, z1 = h - 16;
      const quad = [P(hw, hv, z0), P(F[0], F[1], z0), P(F[0], F[1], z1), P(hw, hv, z1)];
      // outer normal (cos t, sgn*sin t) · view (1, 1.55)
      const outer = Math.cos(theta) + sgn * 1.55 * Math.sin(theta) > 0;
      K.fillPoly(quad, outer ? '#1592A0' : '#0E5B66', '#063840', 2);
      if (!outer) { // inner face: frame + braces
        ctx.save(); ctx.strokeStyle = 'rgba(120,230,240,.35)'; ctx.lineWidth = 2; ctx.beginPath();
        for (const zq of [.25, .5, .75]) { const a = P(hw, hv, lerp(z0, z1, zq)), b = P(F[0], F[1], lerp(z0, z1, zq)); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke(); ctx.restore();
      }
      if (outer) {
        // vertical corrugation
        ctx.save(); ctx.strokeStyle = 'rgba(160,250,255,.22)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 1; k < 6; k++) { const q = k / 6; const p1 = P(hw + du * L * q, hv + dv * L * q, z0 + 8), p2 = P(hw + du * L * q, hv + dv * L * q, z1 - 8); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
        ctx.stroke(); ctx.restore();
        // two lock rods + handles
        for (const q of [.3, .72]) {
          const bu = hw + du * L * q + Math.cos(theta) * 3, bv = hv + dv * L * q + sgn * Math.sin(theta) * 3;
          K.seg(P(bu, bv, z0 + 4), P(bu, bv, z1 - 4), '#D9FBFF', 3.2);
          const hz = z0 + (z1 - z0) * .42, q2 = q + (first ? -.14 : -.14);
          K.seg(P(bu, bv, hz), P(hw + du * L * q2, hv + dv * L * q2, hz - 4), '#D9FBFF', 3.2);
        }
      }
      return F;
    };
    leaf(-hd, -1, false); // far leaf first
    leaf(hd, 1, true);
    // seal / padlock once closed
    if (lockK > 0) {
      const c = P(hw, 0, h * .42);
      ctx.save(); ctx.globalAlpha *= clamp(lockK * 2); ctx.translate(c[0] + 4, c[1]); const s = .8 + .2 * eOutBack(clamp(lockK)); ctx.scale(s, s);
      ctx.shadowColor = AMBER; ctx.shadowBlur = 18; ctx.fillStyle = AMBER; rrect(-13, -6, 26, 22, 5); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = AMBER; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(0, -7, 8, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  // outline edges drawn progressively during the build-in
  function edgeBuild(P, p) {
    if (p <= 0 || p >= 1) return;
    const { hw, hd, h } = CT;
    const loops = [
      [P(-hw, hd, 0), P(hw, hd, 0), P(hw, -hd, 0)],
      [P(-hw, hd, 0), P(-hw, hd, h), P(hw, hd, h), P(hw, hd, 0)],
      [P(-hw, hd, h), P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h)],
      [P(hw, -hd, h), P(hw, -hd, 0)],
    ];
    loops.forEach((L, i) => polyline(L, clamp(p * 1.25 - i * .08), CYAN, 3, CYAN));
  }
  function zoneFrame(P, zc, top, col, k) {
    if (k <= 0) return;
    const { hd } = CT, u0 = zc - 96, u1 = zc + 96, v0 = -hd + 5, v1 = hd - 5, z1 = top;
    ctx.save(); ctx.globalAlpha *= k;
    K.fillPoly([P(u0, v0, 1), P(u1, v0, 1), P(u1, v1, 1), P(u0, v1, 1)], K.rgba(col, .30));
    ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.strokeStyle = K.shade(col, .25); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.setLineDash([12, 8]);
    const e = (a, b) => { const p = P(...a), q = P(...b); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
    ctx.beginPath();
    e([u0, v1, 0], [u1, v1, 0]); e([u1, v1, 0], [u1, v0, 0]);
    e([u0, v1, z1], [u1, v1, z1]); e([u1, v1, z1], [u1, v0, z1]); e([u1, v0, z1], [u0, v0, z1]); e([u0, v0, z1], [u0, v1, z1]);
    e([u0, v1, 0], [u0, v1, z1]); e([u1, v1, 0], [u1, v1, z1]); e([u1, v0, 0], [u1, v0, z1]);
    ctx.stroke(); ctx.restore();
  }

  // ---------------------------------------------------------------- scene
  let plan = null;
  function buildPlan() {
    // one entry per parcel: client, container slot, quay slot, order index
    plan = []; let order = 0;
    CL.forEach((c, ci) => {
      const slots = FILL[ci];
      // quay pile takes boxes from the top/front first; container fills back/bottom first
      const quayOrder = slots.map((s, i) => i).sort((a, b) => (slots[b][2] - slots[a][2]) || (slots[b][1] - slots[a][1]) || (slots[a][0] - slots[b][0]));
      slots.forEach((s, k) => plan.push({ ci, k, slot: s, q: slots[quayOrder[k]], order: order++ }));
    });
  }
  const sortKey = s => (s[1] + 200) * 1000 + (s[0] + 500) + s[2] * 0.1;

  registerScene({
    id: 's2_groupage', z: 10,
    when: t => TL.in(t, CHID),
    draw: (t) => {
      if (!plan) buildPlan();
      const ch = TL.ch(CHID), seg = TL.seg(SEG);
      const T0 = seg.start;
      const tG = K.wt(SEG, 'groupage', .16), tCo = K.wt(SEG, 'colis', .29), tPl = K.wt(SEG, 'plusieurs', .36), tCl = K.wt(SEG, 'clients', .41);
      const tR = K.wt(SEG, 'reunis', .48), tCn = K.wt(SEG, 'conteneur', .60), tCh = K.wt(SEG, 'chacun', .72), tEs = K.wt(SEG, 'lespace', .87);

      // background: continuous from s1 (no fade-in), fades out at the chapter end
      mgBackground(t, .88 * (1 - eInCubic(prog(t, ch.end - .35, ch.end))), { cy: 700 });
      if (t < T0 - .15) return;
      const out = 1 - eInCubic(prog(t, ch.end - .38, ch.end - .02));
      ctx.save(); ctx.globalAlpha *= out;

      // ---- timings of the loading choreography ----
      const FLY = .5, STAG = .05, WAVE = .1;
      const start = p => tR - .2 + p.ci * WAVE + p.order * STAG;
      const lastLand = Math.max(...plan.map(p => start(p) + FLY));
      const tClose = Math.max(lastLand + .06, tCn + .2);
      const tThud = tClose + .32;
      // door angle: opens on "groupage", slams on "conteneur"
      const OPEN = 1.7;
      let theta = OPEN * eOutBack(prog(t, tG, tG + .75));
      if (t >= tClose) {
        const c = prog(t, tClose, tThud);
        theta = OPEN * (1 - eInCubic(c));
        if (t > tThud) { const r = prog(t, tThud, tThud + .4); theta = .07 * Math.sin(r * Math.PI * 2) * (1 - r); }
      }
      theta = Math.max(0, theta);
      // thud shake + camera punch
      const th = prog(t, tThud, tThud + .45);
      const shake = th > 0 && th < 1 ? (1 - th) * (1 - th) : 0;
      const cam = 1 + .02 * prog(t, T0, ch.end) + .018 * shake + .05 * eInCubic(prog(t, ch.end - .38, ch.end));
      ctx.translate(540, 700); ctx.scale(cam, cam); ctx.translate(-540, -700);
      const sx = Math.sin(t * 90) * 5 * shake, sy = Math.cos(t * 73) * 4 * shake;

      // ---- container build-in ----
      const bIn = prog(t, T0 - .05, T0 + 1.15);
      const rise = eOutCubic(prog(t, T0 - .05, T0 + .9));
      const wallA = eOutCubic(prog(t, T0 + .45, T0 + 1.2));
      const P = K.proj(CT.x + sx, CT.y + sy + (1 - rise) * 60, 1, EU, EV);
      // ground: soft glow + iso grid
      ctx.save(); ctx.globalAlpha *= rise;
      K.glow(CT.x, CT.y + 40, 470, TEAL, .20, .45);
      K.shadow(CT.x + 40, CT.y + 70, 420, 120, .75);
      ctx.strokeStyle = 'rgba(92,240,255,.10)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const GP = K.proj(CT.x, CT.y, 1, EU, EV);
      for (let u = -420; u <= 420; u += 60) { const a = GP(u, -260, 0), b = GP(u, 260, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let v = -240; v <= 240; v += 60) { const a = GP(-440, v, 0), b = GP(440, v, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke(); ctx.restore();
      // thud shock ring on the ground at the doors
      if (th > 0 && th < 1) {
        const c = GP(CT.hw + 10, 0, 0);
        K.ripple(c[0], c[1], 40 + eOutCubic(th) * 190, .38, CYAN, (1 - th) * .9, 4);
        K.ripple(c[0], c[1], 20 + eOutCubic(th) * 150, .38, ICE, (1 - th) * .6, 2.5);
      }

      containerBack(P, wallA);

      // ---- parcels ----
      const fly = [], landed = [];
      const tChZ = i => tCh + .05 + i * .2;
      const flashAt = p => { const k = prog(t, tChZ(p.ci), tChZ(p.ci) + .5); return k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0; };
      for (const p of plan) {
        const c = CL[p.ci], [bw, bd, bh] = c.box;
        const t0 = start(p), f = prog(t, t0, t0 + FLY);
        const dropT = tCo + p.ci * .14 + (5 - Math.min(5, p.k)) * .035;
        const qd = prog(t, dropT, dropT + .45);
        if (qd <= 0) continue;
        const Q = K.proj(c.quay[0], c.quay[1] + Math.sin(t * 1.6 + p.ci) * 2.5 * (f <= 0 ? 1 : 0), QS, EU, EV);
        const qpos = Q(p.q[0], p.q[1], p.q[2] * bh);
        const cpos = P(c.zc + p.slot[0], p.slot[1], p.slot[2] * bh);
        if (f <= 0) {
          // on the quay (drop-in with a little bounce)
          const yOff = -(1 - eOutBack(qd)) * 140;
          fly.push({ key: 1e7 + p.ci * 1e5 + sortKey(p.q), draw: () => {
            ctx.save(); ctx.globalAlpha *= clamp(qd * 4); ctx.translate(qpos[0], qpos[1] + yOff);
            parcelBox(K.proj(0, 0, QS, EU, EV), bw, bd, bh, c.col); ctx.restore(); } });
          continue;
        }
        const e = eInOutCubic(f);
        const ctrl = [lerp(qpos[0], cpos[0], .5) + c.side * 150, Math.min(qpos[1], cpos[1]) - 250];
        const pos = K.qb(qpos, ctrl, cpos, e);
        const sc = lerp(QS, 1, eOutCubic(f));
        const lp = prog(t, t0 + FLY, t0 + FLY + .28);
        const sq = lp > 0 && lp < 1 ? Math.sin(lp * Math.PI) * (1 - lp) * .14 : 0;
        const rot = Math.sin(e * Math.PI) * .16 * (c.side || (p.k % 2 ? 1 : -1));
        const item = { key: sortKey([c.zc + p.slot[0], p.slot[1], p.slot[2]]), draw: () => {
          ctx.save(); ctx.translate(pos[0], pos[1]); ctx.rotate(rot); ctx.scale(sc * (1 + sq * .5) / 1, sc * (1 - sq));
          parcelBox(K.proj(0, 0, 1, EU, EV), bw, bd, bh, c.col, { flash: flashAt(p) }); ctx.restore();
          if (lp > 0 && lp < 1 && p.slot[2] === 0) K.puff(cpos[0], cpos[1] + 4, lp, 90 + p.order, 5, 46, '#9FE9F0');
        } };
        if (f < .65) fly.push(item); else landed.push(item);
      }
      landed.sort((a, b) => a.key - b.key);
      for (const it of landed) it.draw();

      // zone frames ("Chacun") — each client's share of the container lights up
      CL.forEach((c, i) => {
        const k = eOutCubic(prog(t, tChZ(i), tChZ(i) + .35));
        const top = FILL[i].some(s => s[2] === 1) ? c.box[2] * 2 + 8 : c.box[2] + 8;
        zoneFrame(P, c.zc, top, c.col, k * (.8 + .2 * Math.sin(t * 3.2 + i * 2.1)));
      });

      const glowK = shake;
      containerFront(P, wallA, glowK);
      // lock seal appears after the thud
      containerEnd(P, wallA, theta, prog(t, tThud + .08, tThud + .5));
      edgeBuild(P, bIn * 1.05);

      // thud dust at the door sill
      if (th > 0 && th < 1) {
        const c1 = P(CT.hw + 20, CT.hd - 10, 0), c2 = P(CT.hw + 20, -CT.hd + 10, 0);
        K.puff(c1[0], c1[1], th, 7, 8, 90, '#B8F4FA'); K.puff(c2[0], c2[1], th, 13, 7, 80, '#B8F4FA');
      }

      // flying + quay parcels on top
      fly.sort((a, b) => a.key - b.key);
      for (const it of fly) it.draw();

      // ---- texts ----
      // (1) client plates: appear on "plusieurs clients", merge into one split bar on "espace partagé"
      const tM = Math.min(tEs - .05, ch.end - .4 - 1.2);
      const mk = eInOutCubic(prog(t, tM, tM + .65));
      const counts = FILL.map(f => f.length), tot = counts.reduce((a, b) => a + b, 0);
      let acc = BAR.x0;
      const segs = counts.map(n => { const w = (BAR.x1 - BAR.x0) * n / tot, s = [acc, acc + w]; acc += w; return s; });
      const font = `800 46px ${FONT.body}`;
      CL.forEach((c, i) => {
        const pa = eOutCubic(prog(t, tPl + i * .13, tPl + i * .13 + .4));
        if (pa <= 0) return;
        const tw = measure(c.name, font), pw = tw + 60;
        const x0 = lerp(c.quay[0] - pw / 2, segs[i][0], mk), x1 = lerp(c.quay[0] + pw / 2, segs[i][1], mk);
        const y = BAR.y - BAR.h / 2 + (1 - pa) * 26;
        const r = lerp(18, 0, mk);
        ctx.save(); ctx.globalAlpha *= pa;
        // plate
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6; ctx.fillStyle = 'rgba(12,7,28,.92)';
        const rl = i === 0 ? 18 : r, rr = i === 2 ? 18 : r;
        ctx.beginPath(); ctx.moveTo(x0 + rl, y); ctx.lineTo(x1 - rr, y); ctx.arcTo(x1, y, x1, y + rr, rr); ctx.lineTo(x1, y + BAR.h - rr); ctx.arcTo(x1, y + BAR.h, x1 - rr, y + BAR.h, rr);
        ctx.lineTo(x0 + rl, y + BAR.h); ctx.arcTo(x0, y + BAR.h, x0, y + BAR.h - rl, rl); ctx.lineTo(x0, y + rl); ctx.arcTo(x0, y, x0 + rl, y, rl); ctx.closePath(); ctx.fill();
        ctx.restore();
        // colour band on top (becomes the split bar)
        const bh = lerp(10, 16, mk);
        ctx.save(); ctx.shadowColor = c.col; ctx.shadowBlur = 14 + 10 * mk; ctx.fillStyle = c.col;
        rrect(x0 + (i === 0 || mk < 1 ? 0 : 0), y - bh - 4, x1 - x0 - (mk > .99 && i < 2 ? 4 : 0), bh, bh / 2); ctx.fill(); ctx.restore();
        // outline per plate (fades as they merge)
        ctx.save(); ctx.globalAlpha *= 1 - mk; ctx.strokeStyle = K.rgba(c.col, .9); ctx.lineWidth = 2.5; rrect(x0, y, x1 - x0, BAR.h, 18); ctx.stroke(); ctx.restore();
        // divider between merged segments
        if (mk > 0 && i > 0) { ctx.save(); ctx.globalAlpha *= mk; ctx.fillStyle = 'rgba(234,246,255,.35)'; ctx.fillRect(x0 - 1, y + 14, 2, BAR.h - 28); ctx.restore(); }
        txt(c.name, (x0 + x1) / 2, y + BAR.h / 2 + 16, { font, color: '#FFFFFF', align: 'center', shadowBlur: 6 });
        ctx.restore();
      });
      if (mk > 0) { // merged outline
        ctx.save(); ctx.globalAlpha *= mk; ctx.strokeStyle = 'rgba(234,246,255,.55)'; ctx.lineWidth = 2.5; ctx.shadowColor = VIOLET; ctx.shadowBlur = 14;
        rrect(BAR.x0, BAR.y - BAR.h / 2, BAR.x1 - BAR.x0, BAR.h, 18); ctx.stroke(); ctx.restore();
        const sw = prog(t, tM + .55, tM + 1.35); // shimmer across the shared bar
        if (sw > 0 && sw < 1) {
          ctx.save(); rrect(BAR.x0, BAR.y - BAR.h / 2 - 24, BAR.x1 - BAR.x0, BAR.h + 24, 18); ctx.clip();
          const gx = lerp(BAR.x0 - 100, BAR.x1 + 100, eInOutCubic(sw)), g = ctx.createLinearGradient(gx - 90, 0, gx + 90, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(BAR.x0, BAR.y - 80, BAR.x1 - BAR.x0, 160); ctx.restore();
        }
      }
      // (2) headline « 3 clients · 1 conteneur »
      const tH = Math.min(tCh + .05, ch.end - .4 - 2.4);
      const hA = prog(t, tH, tH + .5);
      if (hA > 0) {
        const fN = `900 96px ${FONT.display}`, fW = `800 72px ${FONT.body}`;
        const parts = [['3', fN, AMBER], ['\u2009clients', fW, '#FFFFFF'], [' · ', fW, 'rgba(234,246,255,.6)'], ['1', fN, AMBER], [' conteneur', fW, '#FFFFFF']];
        const ws = parts.map(p => measure(p[0], p[1]));
        const tot2 = ws.reduce((a, b) => a + b, 0);
        let x = 540 - tot2 / 2; const y = 906;
        parts.forEach((p, i) => {
          const k = eOutCubic(prog(t, tH + (i < 2 ? 0 : .22), tH + .45 + (i < 2 ? 0 : .22)));
          if (k > 0) txt(p[0], x, y + (1 - k) * 22, { font: p[1], color: p[2], alpha: k, glow: i === 0 || i === 3 ? 'rgba(243,167,69,.55)' : null, glowBlur: 22 });
          x += ws[i];
        });
      }
      ctx.restore();
    },
  });
})();
