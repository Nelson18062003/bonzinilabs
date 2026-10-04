'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — M2 part 2: THE SAMPLE (prefix FS_). Functions only, called by 50_compose.js.
//
//   FS_parcel(p, t, L)     world. p = SCORE.parcel(t): the small kraft sample parcel (oblique 3/4 like every carton,
//                          kraft liner, kraft gummed tape — never violet: it comes from the supplier), a printed label
//                          « ÉCHANTILLON » on its front (Stencil 60 px); its flaps open with p.open (the tape tears).
//   FS_sampleBag(b, t, L)  world. b = SCORE.sampleBag(t): THE BAG OF THE PHOTO (the same black rigid tote, FS_lib.tote),
//                          rising out of the parcel (clipped by its front wall while inside), shown big next to the
//                          polaroid, the kraft tag « À GARDER » (Satoshi 900 46 px, world size) tied on its right handle
//                          from A.keep (b.keep), swinging with the bag's motion. During the taps (b.tapping) it goes UNDER
//                          the amber plate (clipped by it): its top knocks the plate from below.
//   FS_onPhoto(P, t, L)    world. The amber stamp « PAREIL ✓ » (Satoshi 900 66 px, the ✓ drawn) on the polaroid (P.pareil).
//   FS_gloves(g, t, L)     world. TOI's white cartoon gloves (the validated bonneteau glove, re-rigged): plain chambray
//                          shirt sleeves rolled once, NO ring, coming up from the bottom edge (POV). Poses 'rest', 'open',
//                          'grip', 'hold', 'press', 'pen' (+ the felt pen, whose tip rides the head of the scribble).
//   FS_letters(t, L)       world. P, A, S of the amber plate: each one breaks off at lettersPlan().detach[i] as a chip of
//                          the plate (OM_glyph when M1 provides it), falls, bounces twice, rolls one full tumble to rest[i]
//                          by the margouillat, waits, and is sucked into K_mouth(t) at gulps[i].
//   FS_CART (shared)       the oblique kraft carton (cartonGeo convention): 'back' / 'front' passes, used by 70_bonzini.js.
// =============================================================================================

// =============================================================================================
// THE OBLIQUE KRAFT CARTON (ep. 2's material, re-written compact): foot (x, y) = middle of the front bottom edge,
// 3D frame X right, Y depth, Z up; screen = foot + (X + .30·Y, −Z − .50·Y) (SCORE.OBL). Kraft liner tile mapped on
// every face (flutes follow the walls), shaded per face normal (sun from the door, upper left) through lit().
// draw(st, pass, t, L, o): pass 'back' = cast shadow, back + left flaps, the interior, o.inside(geo) | 'front' = right
// wall, right + front flaps (or the closed top under kraft tape), the front wall + o.ink(geo) (local front-face coords).
// st: {x, y, w, h, d, s, sx, sy, rot, flaps 0..1, tape 0..1 (closed top tape), torn 0..1, a}.
// =============================================================================================
const FS_CART = (function () {
  const B = FS_lib, S = B.S, OB = S.OBL, { cl, kk, mix, R } = B;
  const DEG = Math.PI / 180, FLAP_MAX = 114 * DEG, FL = { front: 1.2, back: .92, side: 1.03 };
  const VIEW = [OB.x, -1, -OB.y];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pv = v => [v[0] + v[1] * OB.x, -v[2] + v[1] * OB.y];
  const shadeN = n => cl(.86 - .14 * n[0] + .14 * n[2] + .03 * n[1], .3, 1.04);
  const add3 = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
  const neg = v => [-v[0], -v[1], -v[2]];
  const litA = (c, x, y, L, bias = 0) => lit(`rgb(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0})`, x, y, L, bias);
  function poly(Q) { ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) ctx.lineTo(Q[i][0], Q[i][1]); ctx.closePath(); }
  let LIN = null, PAT = null;
  function liner() {
    if (LIN) return LIN;
    const N = 512, c = makeCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#DDB680'; g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x++) { const v = Math.sin(x / 16 * Math.PI * 2); g.fillStyle = v > 0 ? `rgba(255,238,206,${(.07 * v).toFixed(3)})` : `rgba(96,58,22,${(-.07 * v).toFixed(3)})`; g.fillRect(x, 0, 1, N); }
    for (let i = 0; i < 70; i++) {
      const x = rnd(i * 9.1 + 3) * N, y = rnd(i * 7.7 + 1) * N, r = 30 + rnd(i * 6.3) * 110, dark = rnd(i * 2.2) > .5;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > N || cy + r < 0 || cy - r > N) continue;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, dark ? 'rgba(120,76,30,.05)' : 'rgba(255,240,210,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = rnd(i * 1.9 + 3) * N, y = rnd(i * 2.7 + 5) * N, a = rnd(i * 3.1) * Math.PI, l = 3 + rnd(i * 4.3) * 11;
      g.strokeStyle = rnd(i * 6.1) > .55 ? `rgba(118,78,38,${(.18 + rnd(i * 8.3) * .2).toFixed(2)})` : `rgba(246,224,186,${(.22 + rnd(i * 5.9) * .25).toFixed(2)})`;
      g.lineWidth = rnd(i) > .8 ? 1.3 : .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(${rnd(i * 4.4) > .5 ? '70,44,20' : '40,28,18'},${(.25 + rnd(i * 3.3) * .4).toFixed(2)})`; g.beginPath(); g.arc(rnd(i * 1.37 + 9) * N, rnd(i * 2.71 + 4) * N, .5 + rnd(i * 5.5) * 1.1, 0, 7); g.fill(); }
    return (LIN = c);
  }
  function face(Pts, O, a, b, k, L, o = {}) {
    const ea = pv(a), eb = pv(b), sc = o.ts || .9, det = ea[0] * eb[1] - ea[1] * eb[0];
    poly(Pts);
    if (Math.abs(det) > .02) { if (!PAT) PAT = ctx.createPattern(liner(), 'repeat'); PAT.setTransform(new DOMMatrix([ea[0] * sc, ea[1] * sc, eb[0] * sc, eb[1] * sc, O[0], O[1]])); ctx.fillStyle = PAT; }
    else ctx.fillStyle = '#C9A473';
    ctx.fill();
    const tn = o.tint || [1, 1, 1];
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = litA([255 * k * tn[0], 255 * k * tn[1], 255 * k * tn[2]], O[0], O[1], L, o.bias || 0); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  function cutEdge(p0, p1, tv, L) {
    const tl = Math.hypot(tv[0], tv[1]); if (tl < .6) return;
    poly([p0, p1, [p1[0] + tv[0], p1[1] + tv[1]], [p0[0] + tv[0], p0[1] + tv[1]]]); ctx.fillStyle = litA([224, 192, 146], p0[0], p0[1], L); ctx.fill();
    if (tl < 2.2) return;
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (len > 10) { const n = Math.max(2, Math.round(len / (tl * 1.5))), m = n * 6; ctx.beginPath();
      for (let i = 0; i <= m; i++) { const f = i / m, a = .5 + .34 * Math.sin(f * n * Math.PI * 2); const x = p0[0] + (p1[0] - p0[0]) * f + tv[0] * a, y = p0[1] + (p1[1] - p0[1]) * f + tv[1] * a; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = Math.max(.8, tl * .13); ctx.strokeStyle = 'rgba(122,82,40,.6)'; ctx.stroke(); }
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function softPoly(Pp, blur, a, n = 5, col = '40,24,30') {
    if (a <= .004) return;
    let cx = 0, cy = 0; for (const q of Pp) { cx += q[0]; cy += q[1]; } cx /= Pp.length; cy /= Pp.length;
    const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n);
    ctx.fillStyle = `rgba(${col},${al.toFixed(4)})`;
    for (let i = 0; i < n; i++) { const e = -blur * .5 + blur * 1.5 * i / (n - 1); poly(Pp.map(q => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * e, q[1] + dy / l * e]; })); ctx.fill(); }
  }
  // per-call state
  let o = { x: 0, y: 0 }, w = 400, h = 200, d = 200, s = 1, th = 7, TS = .9;
  const P = (X, Y, Z) => [o.x + X + Y * OB.x, o.y - Z + Y * OB.y];
  const PP = p => P(p[0], p[1], p[2]);
  function shadow(st, L) {
    const v = L.violet || 0, kx = .62 * (1 - .8 * v), ky = .34 * (1 - .8 * v);           // long, down-right (raking sun)
    const foot = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)];
    const top = foot.map(p => [p[0] + kx * h, p[1] + ky * h]);
    softPoly(hull(foot.concat(top)), 30 * s, .3, 5);
    softPoly(foot.map(p => [p[0] + 5 * s, p[1] + 4 * s]), 10 * s, .34, 3);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(40,20,20,.35)'; ctx.lineWidth = 7 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, 0, 0)); ctx.lineTo(...P(w / 2, 0, 0)); ctx.lineTo(...P(w / 2, d, 0)); ctx.stroke(); ctx.restore();
  }
  function flapDef(which) {
    switch (which) {
      case 'front': return { A: [-w / 2, 0, h], B: [w / 2, 0, h], c: [0, 1, 0], len: d / 2, ax: [1, 0, 0], seed: 1 };
      case 'back': return { A: [-w / 2, d, h], B: [w / 2, d, h], c: [0, -1, 0], len: d / 2, ax: [1, 0, 0], seed: 2 };
      case 'left': return { A: [-w / 2, 0, h], B: [-w / 2, d, h], c: [1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 3 };
      default: return { A: [w / 2, 0, h], B: [w / 2, d, h], c: [-1, 0, 0], len: d / 2 * .94, ax: [0, 1, 0], seed: 4 };
    }
  }
  function flap(which, a, L, st) {
    const F = flapDef(which), c = F.c, ct = Math.cos(a), sn = Math.sin(a);
    const u = [c[0] * ct, c[1] * ct, sn], nOut = [-c[0] * sn, -c[1] * sn, ct];
    const len = F.len, minor = which === 'left' || which === 'right', ch = minor ? Math.min(len * .35, 26 * s) : 0;
    const vis = dot(nOut, VIEW) >= 0, n = vis ? nOut : neg(nOut);
    const pA = PP(F.A), pB = PP(F.B);
    const tA = PP(add3(add3(F.A, u, len), F.ax, ch)), tB = PP(add3(add3(F.B, u, len), F.ax, -ch));
    const mA = PP(add3(F.A, u, len - ch)), mB = PP(add3(F.B, u, len - ch));
    cutEdge(tA, tB, pv(n.map(x => -x * th)), L);
    const pts = minor ? [pA, pB, mB, tB, tA, mA] : [pA, pB, PP(add3(F.B, u, len)), PP(add3(F.A, u, len))];
    face(pts, pA, F.ax, u, shadeN(n) * (vis ? 1.04 : .97), L, { ts: TS, tint: vis ? [1, .97, .9] : [1.03, 1, .95] });
    ctx.save(); ctx.strokeStyle = 'rgba(70,40,12,.35)'; ctx.lineWidth = 1.6 * s; ctx.lineJoin = 'round'; poly(pts); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,240,212,.45)'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(...pA); ctx.lineTo(...pB); ctx.stroke(); ctx.restore();
    // the torn half of the kraft tape on a major flap's tip
    if (!minor && vis && (st.torn || 0) > 0) {
      const tw = 22 * s, base = add3(F.A, u, len - tw), ex = F.ax;
      const p = (x, v) => PP(add3(add3(base, ex, x), u, v));
      ctx.save(); ctx.beginPath(); const M = 18;
      for (let i = 0; i <= M; i++) { const x = -6 * s + (w + 12 * s) * i / M, q = p(x, 0); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }
      for (let i = M * 2; i >= 0; i--) { const x = -6 * s + (w + 12 * s) * i / (M * 2), q = p(x, Math.min(tw + 6 * s, tw * (.62 + .5 * R(i, F.seed * 7)))); ctx.lineTo(...q); }
      ctx.closePath(); ctx.fillStyle = litA([168, 116, 62], pA[0], pA[1], L); ctx.fill(); ctx.restore();
    }
  }
  function interior(st, t, L) {
    const occ = .6;
    const bw = [P(-w / 2, d, h), P(w / 2, d, h), P(w / 2, d, 0), P(-w / 2, d, 0)];
    face(bw, bw[0], [1, 0, 0], [0, 0, -1], .86 * occ, L, { ts: TS, tint: [1, .97, .93] });
    const lw = [P(-w / 2, 0, h), P(-w / 2, d, h), P(-w / 2, d, 0), P(-w / 2, 0, 0)];
    face(lw, lw[0], [0, 1, 0], [0, 0, -1], .7 * occ, L, { ts: TS, tint: [1, .97, .93] });
    const fl = [P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, d, 0), P(-w / 2, d, 0)];
    face(fl, fl[0], [1, 0, 0], [0, 1, 0], .95 * occ, L, { ts: TS, tint: [1, .98, .94] });
    ctx.save();
    let gr = ctx.createLinearGradient(...P(0, d, h), ...P(0, d, 0)); gr.addColorStop(0, 'rgba(36,18,4,0)'); gr.addColorStop(1, 'rgba(36,18,4,.5)'); ctx.fillStyle = gr; poly(bw); ctx.fill();
    gr = ctx.createLinearGradient(...P(-w / 2, d * .5, 0), ...P(-w / 2 + Math.min(w * .5, 220 * s), d * .5, 0)); gr.addColorStop(0, 'rgba(40,20,4,.38)'); gr.addColorStop(1, 'rgba(40,20,4,0)'); ctx.fillStyle = gr; poly(fl); ctx.fill(); poly(bw); ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(46,24,6,.35)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, d, h)); ctx.lineTo(...P(-w / 2, d, 0)); ctx.lineTo(...P(w / 2, d, 0)); ctx.stroke();
    ctx.restore();
  }
  function rightWall(st, t, L) {
    const q = [P(w / 2, 0, h), P(w / 2, d, h), P(w / 2, d, 0), P(w / 2, 0, 0)];
    face(q, q[0], [0, 1, 0], [0, 0, -1], .74, L, { ts: TS, tint: [1, .95, .86] });
    ctx.save();
    const gr = ctx.createLinearGradient(...P(w / 2, d / 2, h), ...P(w / 2, d / 2, 0)); gr.addColorStop(0, 'rgba(255,236,200,.10)'); gr.addColorStop(.7, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.24)');
    ctx.fillStyle = gr; poly(q); ctx.fill();
    // printed « this way up » arrows (no text)
    const O = P(w / 2, 0, h), ex = pv([0, 1, 0]), ey = pv([0, 0, -1]);
    ctx.transform(ex[0], ex[1], ey[0], ey[1], O[0], O[1]);
    if (d > 110 * s && h > 140 * s) {
      const cx = d * .5, cy = h * .36, a = 30 * s;
      ctx.strokeStyle = 'rgba(35,22,41,.45)'; ctx.lineWidth = 5.5 * s; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.beginPath(); for (const dx of [-a * .55, a * .55]) { ctx.moveTo(cx + dx, cy + a); ctx.lineTo(cx + dx, cy - a * .5); ctx.moveTo(cx + dx - a * .42, cy - a * .1); ctx.lineTo(cx + dx, cy - a * .62); ctx.lineTo(cx + dx + a * .42, cy - a * .1); }
      ctx.moveTo(cx - a * 1.2, cy + a * 1.25); ctx.lineTo(cx + a * 1.2, cy + a * 1.25); ctx.stroke();
    }
    ctx.restore();
    // the kraft tape tab down the right wall (closed: whole; open: its torn stub)
    const tw = 46 * s, len = (st.flaps > .02 ? 46 : 70) * s, Y = d / 2;
    if ((st.tape || 0) > 0 || (st.torn || 0) > 0) {
      const a = P(w / 2, Y - tw / 2, h), b = P(w / 2, Y + tw / 2, h), c2 = P(w / 2, Y + tw / 2, h - len), e = P(w / 2, Y - tw / 2, h - len);
      ctx.save(); ctx.beginPath(); ctx.moveTo(...e); ctx.lineTo(...c2);
      if (st.flaps > .02) { const M = 8; for (let i = 0; i <= M; i++) ctx.lineTo(...P(w / 2, Y + tw / 2 - tw * i / M, h - 4 * s - R(i, 31) * 9 * s)); }
      else { ctx.lineTo(...b); ctx.lineTo(...a); }
      const M2 = 7; for (let i = 0; i <= M2; i++) ctx.lineTo(...P(w / 2, Y - tw / 2 + tw * i / M2, h - len - (i % 2 ? 3 : 0) * s));
      ctx.closePath(); ctx.fillStyle = litA([156, 106, 54], a[0], a[1], L, -.3); ctx.fill(); ctx.restore();
    }
  }
  function frontWall(st, t, L, ink) {
    const O = P(-w / 2, 0, h), Q = [O, P(w / 2, 0, h), P(w / 2, 0, 0), P(-w / 2, 0, 0)];
    face(Q, O, [1, 0, 0], [0, 0, -1], shadeN([0, -1, 0]) * 1.02, L, { ts: TS, tint: [1, .97, .9] });
    ctx.save(); poly(Q); ctx.clip(); ctx.translate(O[0], O[1]);
    const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,238,206,.12)'); gr.addColorStop(.75, 'rgba(40,20,4,0)'); gr.addColorStop(1, 'rgba(40,20,4,.22)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    const sg = ctx.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(255,236,196,.14)'); sg.addColorStop(.5, 'rgba(255,236,196,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);   // warm on the door side
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(70,44,18,.14)'; ctx.lineWidth = 3 * s;   // scuffs of a carton that travelled
    for (let i = 0; i < 4; i++) { const x = (.12 + .2 * i + .08 * R(i, 9)) * w, y = (.72 + .2 * R(i, 4)) * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (16 + 20 * R(i, 6)) * s, y - 6 * s * R(i, 2)); ctx.stroke(); }
    if ((st.tape || 0) > 0 && st.flaps <= .02) {                 // closed: the tape comes down the front a little
      const tw = 46 * s; ctx.fillStyle = litA([156, 106, 54], O[0], O[1], L, .1); ctx.beginPath(); ctx.moveTo(w / 2 - tw / 2, 0); ctx.lineTo(w / 2 + tw / 2, 0); ctx.lineTo(w / 2 + tw / 2, 50 * s); for (let i = 0; i <= 6; i++) ctx.lineTo(w / 2 + tw / 2 - tw * i / 6, 50 * s + (i % 2 ? 3 : 0) * s); ctx.closePath(); ctx.fill();
    }
    if (ink) ink({ w, h, s });
    ctx.restore();
  }
  function closedTop(st, t, L) {
    const top = [P(-w / 2, 0, h), P(w / 2, 0, h), P(w / 2, d, h), P(-w / 2, d, h)];
    face(top, top[0], [1, 0, 0], [0, 1, 0], shadeN([0, 0, 1]), L, { ts: TS, tint: [1.02, .99, .93] });
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(52,28,8,.5)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(...P(-w / 2, d / 2, h)); ctx.lineTo(...P(w / 2, d / 2, h)); ctx.stroke();
    if ((st.tape || 0) > 0) {                                    // the kraft gummed tape along the seam
      const tw = 46 * s, c1 = P(-w / 2 - 2, d / 2 - tw / 2 / OB.y * -.5, h);
      const q = [P(-w / 2, d / 2 - tw / 2, h), P(w / 2, d / 2 - tw / 2, h), P(w / 2, d / 2 + tw / 2, h), P(-w / 2, d / 2 + tw / 2, h)];
      poly(q); ctx.fillStyle = litA([166, 113, 58], c1[0], c1[1], L, .1); ctx.fill();
      ctx.strokeStyle = 'rgba(255,228,184,.3)'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(...P(-w / 2, d / 2 - tw * .18, h)); ctx.lineTo(...P(w / 2, d / 2 - tw * .18, h)); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,38,10,.4)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(...q[0]); ctx.lineTo(...q[1]); ctx.moveTo(...q[3]); ctx.lineTo(...q[2]); ctx.stroke();
    }
    ctx.restore();
  }
  /** the carton's own transform: squash about the foot (sx, sy), st.rot about (cx, foot y), the hand-placed jitter */
  function xf(st, t) {
    const g = S.cartonGeo(st), n = Math.floor(t * 15), a = (st.shake || 0) * 3;
    const jx = (rnd(st.y * .13 + n * 1.3) - .5) * 2 * a, jy = (rnd(st.x * .07 + n * 2.1) - .5) * 2 * a, jr = (rnd(n * .7 + 5) - .5) * .008 * a;
    ctx.translate(jx, jy);
    if (st.rot || jr) { ctx.translate(g.cx, st.y); ctx.rotate((st.rot || 0) + jr); ctx.translate(-g.cx, -st.y); }
    return g;
  }
  function draw(st, pass, t, L, op = {}) {
    if (!st || (st.a ?? 1) <= .003) return;
    const g = S.cartonGeo({ ...st, sx: 1, sy: 1 });
    o = { x: st.x, y: st.y }; w = g.w; h = g.h; d = g.d; s = g.s; th = 7 * s; TS = .9 * s;
    ctx.save(); ctx.globalAlpha *= st.a ?? 1;
    if (!op.noXf) xf(st, t);
    if ((st.sx ?? 1) !== 1 || (st.sy ?? 1) !== 1) { ctx.translate(st.x, st.y); ctx.scale(st.sx ?? 1, st.sy ?? 1); ctx.translate(-st.x, -st.y); }
    const fa = Math.max(0, st.flaps || 0) * FLAP_MAX, open = (st.flaps || 0) > .02;
    if (pass === 'back') {
      if (!op.noShadow) shadow(st, L);
      if (open) { flap('back', fa * FL.back, L, st); flap('left', fa * FL.side, L, st); interior(st, t, L); }
      if (op.inside) op.inside({ P, w, h, d, s });
    } else {
      rightWall(st, t, L);
      if (open) { flap('right', fa * FL.side, L, st); flap('front', fa * FL.front, L, st); }
      else closedTop(st, t, L);
      frontWall(st, t, L, op.ink);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,238,206,.42)'; ctx.lineWidth = 2 * s; ctx.beginPath();
      ctx.moveTo(...P(w / 2, 0, 1)); ctx.lineTo(...P(w / 2, 0, h - 1)); if (!open) { ctx.lineTo(...P(-w / 2, 0, h)); ctx.moveTo(...P(w / 2, 0, h)); ctx.lineTo(...P(w / 2, d, h)); }
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  return { draw, xf, P: () => P };
})();

// =============================================================================================
// TOI'S GLOVES — the validated « Bonneteau » glove (bonneteau-feyman/overlay/scenes/30_hands.js: rubber-hose 4-finger
// glove, rolled cuff, living ink line, gouache shading, smear frames, arm-end sprite per frame), re-rigged for this film:
// · POV: our own hands come up from the bottom edge (shoulders G.shoulder, below the frame), fingers pointing away, the
//   right thumb on the left; the hand aligns towards « up » (not « down » as across the bonneteau table);
// · plain chambray shirt sleeves rolled once (no wax print), NO signet ring, no ribbon;
// · lit by the morning sun from the door (L.x, L.y); poses 'rest' 'open' 'grip' 'hold' 'press' 'pen' (+ the felt pen);
// · hands come from SCORE.gloves(t) through an adapter (frame-based API kept inside).
// =============================================================================================
const FS_HK = (function () {
  const S0 = window.SCORE, G = S0.G, A0 = S0.A, TAU = Math.PI * 2, DEG = 180 / Math.PI;
  const wrapA = a => { while (a > Math.PI) a -= TAU; while (a <= -Math.PI) a += TAU; return a; };
  // ---- adapter: the bonneteau glove reads hands by frame number f; ours come from SCORE.gloves(t) in seconds.
  //      A 'pen' hand is moved so that the felt pen's TIP rides the head of the scribble FS_fiche draws.
  const HC = new Map();
  const OFFY = 2240;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
  function penTarget(t, g) {
    const F = S0.fiche(t); if (!F) return null;
    let line = -1;
    A0.lines.forEach((lt, i) => { if (t >= lt + .2 && t <= lt + .7) line = i; });
    if (line < 0) return null;
    const hd = FS_F.scribHead(line, S0.ease(F.lines[line].scrib));
    return S0.place(F, hd[0], hd[1]);
  }
  function penShift(side, W, target) {           // move the wrist so the pen tip (analytic, no stretch) lands on target
    let x = W.x, y = W.y;
    for (let it = 0; it < 3; it++) {
      const tip = penTipAt(side, { x, y }); x += target.x - tip.x; y += target.y - tip.y;
    }
    return { x, y };
  }
  function hand(side, f) {
    const key = side + f.toFixed(4); const hit = HC.get(key); if (hit) return hit;
    const t = f / 30, g = S0.gloves(t)[side];
    let h;
    if (!g) h = { x: G.shoulder[side].x + (side === 'L' ? 60 : -60), y: OFFY, pose: 'rest', s: 1, off: 1 };
    else {
      h = { x: g.x, y: g.y, pose: g.pose, s: g.s || 1, rot: g.rot || 0, a: g.a ?? 1, dw: 0 };
      if (side === 'L') {                       // pushing the sample from below (the taps): the hand sits under its base
        const b = S0.sampleBag(t);
        if (b) h.y += 122 * (b.tapping || 0);
        if (b && t >= A0.check + .35) { h.x = b.x - 10; h.y = b.y - 150 * b.s + 250 + 122; h.pose = 'hold'; }   // kept: it carries it away from below (no jump to the handles)
      }
      const pc = S0.parcel(t);
      if (pc) {                                 // opening the parcel: the hands take it by its sides and top, clear of its label
        const ox = pc.x + (side === 'L' ? -130 : 130), oy = pc.y + 60, w = Math.max(0, 1 - Math.hypot(g.x - ox, g.y - oy) / 160);
        h.x += (side === 'L' ? -66 : 66) * w; h.y -= 64 * w;
      }
      if (g.pose === 'pen') {
        const tg = penTarget(t, g) || { x: g.x, y: g.y - 40 };
        const w = penShift(side, h, tg); h.x = w.x; h.y = w.y;
      }
    }
    if (HC.size > 400) HC.clear();
    HC.set(key, h); return h;
  }
  const S = { hand, light: f => S0.light(f / 30) };
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
  let GOU = null;
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
      case 'grip_bonneteau':
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
      case 'open_bonneteau':   // (unused here) magician's « voilà »: palm up, fingers spread
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
      case 'pen': {         // a felt pen pinched between thumb and index, the other fingers curled under
        P.align = .3; P.z = 6; P.fy = .97; P.bend = .08;
        P.f = [Fb(-.12, .5, { yaw2: -.1 }), Fb(.02, .8), Fb(.13, .9)];
        P.t = thumb({ yaw: -.42, yaw2: .2, F1: .9, F2: .8, sh1: -.05, sh2: -.1 });
        P.fx.pen = 1;
        break;
      }
      case 'press':         // flat hand pressing (the « À GARDER » tag onto the sample)
        P.align = .4; P.z = 2; P.fy = 1.02;
        P.f = [Fs(-.2), Fs(-.03), Fs(.14)].map(x => Object.assign(x, { sh1: -.04, sh2: -.08 }));
        P.t = thumb({ yaw: -.95, yaw2: .25 });
        break;
      case 'open': {        // the fingers hook the parcel's flaps and pull them open
        P.align = .5; P.z = 8; P.bend = .1;
        P.f = [Fb(-.14, .48, { yaw2: -.05 }), Fb(-.01, .5), Fb(.12, .56, { yaw2: .05 })];
        P.t = thumb({ yaw: -.7, yaw2: .15, F1: .95, F2: .9 });
        break;
      }
      case 'grip':          // a fist round the tote's two handles
        P.align = .6; P.z = 12; P.fy = .98;
        P.f = [Fb(-.06, .92), Fb(.01, .97), Fb(.09, .95)];
        P.t = thumb({ yaw: -.25, yaw2: .25, F1: .85, F2: .78, sh1: -.15, sh2: -.25 });
        break;
      case 'hold':          // under the sample: fingers up, spread, pushing it (the taps)
        P.align = .65; P.z = 4; P.fy = 1;
        P.f = [Fb(-.16, .26, { yaw2: -.04 }), Fb(-.02, .22), Fb(.12, .28, { yaw2: .04 })];
        P.t = thumb({ yaw: -.9, yaw2: .25, F1: .98, F2: .92 });
        break;
      case 'hold_bonneteau': {   // (unused)
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
    const stealR = false;
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
    const key = [f, h.x, h.y, h.s, h.cuffIn, h.pose, h.dw || 0, o.bump || 0, o.flinch || 0, L.x, L.on, L.violet].join('|');
    const c = CACHE[side]; if (c && c.key === key) return c;
    const { P, smear } = poseAt(side, h, f);
    const s = (h.s || 1) * P.sc, sg = side === 'L' ? 1 : -1;      // P.sc < 1: the whole arm end is smaller (held behind the parcel)
    const W = { x: h.x, y: h.y - 300 * (o.flinch || 0) };
    const SH = G.shoulder[side], dv = { x: (W.x - SH.x) * .8, y: W.y - SH.y }, dl = Math.hypot(dv.x, dv.y) || 1;
    let d = { x: dv.x / dl, y: dv.y / dl };
    if (h.dw > 0) { const nx = mix(d.x, h.dir.x, h.dw), ny = mix(d.y, h.dir.y, h.dw), nl = Math.hypot(nx, ny) || 1; d = { x: nx / nl, y: ny / nl }; }
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
    const pu = P.palmUp, flip = pu > .5, m = ((side === 'R') !== flip) ? -1 : 1;
    const fl = Math.max(.3, Math.abs(Math.cos(Math.PI * pu)));
    const zs = 1 + P.z / 900, handAng = armAng + wrapA(Math.PI - armAng) * P.align;
    const Mh = Mga.translate(0, HOFF).rotateSelf((handAng - armAng) * DEG).scaleSelf(m * fl * zs * HS, zs * HS).rotateSelf(-P.bend * DEG).translateSelf(P.dx || 0, 0);
    // light, in the hand's local frame (screen direction towards the bulb)
    const hc = Mh.transformPoint(new DOMPoint(0, 40)), bx = L.x - hc.x, by = L.y - hc.y, bl = Math.hypot(bx, by) || 1;
    const inv = Mh.inverse(), lx0 = inv.a * bx / bl + inv.c * by / bl, ly0 = inv.b * bx / bl + inv.d * by / bl, ll = Math.hypot(lx0, ly0) || 1;
    const lightL = { x: lx0 / ll, y: ly0 / ll };
    const invA = Ma.inverse(), ax0 = invA.a * bx / bl + invA.c * by / bl, ay0 = invA.b * bx / bl + invA.d * by / bl, al = Math.hypot(ax0, ay0) || 1;
    const lightA = { x: ax0 / al, y: ay0 / al };
    // colours of the glove (white kid, warm under the bulb, cool in its shadows)
    const sx = hc.x, sy = hc.y + 30;
    const lc = (hx, b) => litc(hx, sx, sy, L, b);
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
  function roofUnder() { return null; }

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

  // ======================= the sleeve =======================
  /** centreline from the opening (u = 0) up to the shoulder, with radius on each side, normals and texture u */
  function tube(R) {
    if (R.tube) return R.tube;
    const sh = R.o.shoulder || G.shoulder[R.side], C = R.C, d = R.d, s = R.s;
    const Dl = Math.hypot(sh.x - C.x, sh.y - C.y);
    const P1 = { x: C.x - d.x * Dl * .42, y: C.y - d.y * Dl * .42 }, P2 = { x: sh.x, y: sh.y + Math.sign(C.y - sh.y) * Dl * .36 };
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
      const r = 47 * k * (1 + .32 * sstep(0, 900, u));
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
  // ======================= the sleeve: TOI's plain cotton shirt (chambray), rolled once — no wax, no jewel =======================
  const SLV = '#86A3C9', SLV_D = '#3D557D', SLV_L = '#D3DFEE';
  let TW = null;
  function twill() {
    if (TW) return TW;
    const N = 24, c = makeCanvas(N, N), g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = 1.2;
    for (let k = -N; k < 2 * N; k += 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke(); }
    g.strokeStyle = 'rgba(10,20,50,.13)'; g.lineWidth = 1;
    for (let k = -N + 2; k < 2 * N; k += 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${(.04 + .06 * hh(i, 3, 5)).toFixed(3)})`; g.fillRect(hh(i, 1, 5) * N, hh(i, 2, 5) * N, 1.5, 1); }
    TW = ctx.createPattern(c, 'repeat'); return TW;
  }
  function drawSleeve(R, B) {
    const { pts: all } = tube(R), L = R.L;
    let last = all.length - 1; for (let i = 0; i < all.length; i++) if (all[i].y - Math.max(all[i].rP, all[i].rM) > H + 260) { last = i; break; }
    const pts = all.slice(0, Math.max(2, last + 1));
    const q = pts[Math.min(pts.length - 1, Math.round(pts.length * .6))];
    const c0 = litc(SLV, R.C.x, R.C.y + 40, L, .5), c1 = litc(SLV, q.x, q.y, L, .2);
    ctx.save(); ctx.setTransform(B);
    ctx.beginPath(); tubePath(pts);
    const g = ctx.createLinearGradient(R.C.x, R.C.y, q.x, q.y); g.addColorStop(0, css(c0)); g.addColorStop(1, css(mixc(c1, [16, 22, 44], .32)));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = twill(); ctx.fill();
    // a round hose: dark flank away from the door, a warm sheen on the side facing it
    const bx = L.x - R.C.x, by = L.y - R.C.y, bl = Math.hypot(bx, by) || 1, p0 = pts[0];
    const lp = (bx * p0.nx + by * p0.ny) / bl, kL = lightAt(R.C.x, R.C.y + 40, L).k;
    const line = (sgn, fr) => () => { pts.forEach((p, i) => { const rr = sgn > 0 ? p.rP : p.rM, x = p.x + p.nx * rr * fr * sgn, y = p.y + p.ny * rr * fr * sgn; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const band = (fn, layers, rgb) => { for (const [w, a] of layers) { ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`; ctx.lineWidth = w * R.s; ctx.beginPath(); fn(); ctx.stroke(); } };
    band(line(lp >= 0 ? -1 : 1, 1.02), [[44, .16], [26, .2]], '8,12,32');
    const ls = lp >= 0 ? 1 : -1;
    band(line(ls, .5), [[22, .06 + .08 * kL], [10, .05 + .1 * kL]], '255,232,190');
    // folds bunching above the cuff (tapered dark creases with a lit ridge)
    const fl = [[22, 1, .85], [50, -1, .7], [84, 1, .62], [126, -1, .55], [190, 1, .5]];
    const folds = fl.map(([uf, side, ln]) => {
      const target = uf * R.s; let p = pts[0];
      for (const pp of pts) { if (pp.u >= target) { p = pp; break; } }
      const r = (p.rP + p.rM) / 2, sx = side;
      const ax = p.x + p.nx * r * .98 * sx, ay = p.y + p.ny * r * .98 * sx;
      const ex = p.x - p.nx * r * (1.9 * ln - .98) * sx + p.tx * 4 * R.s, ey = p.y - p.ny * r * (1.9 * ln - .98) * sx + p.ty * 4 * R.s;
      return { p, ax, ay, ex, ey, mx: (ax + ex) / 2 - p.tx * 9 * R.s, my: (ay + ey) / 2 - p.ty * 9 * R.s };
    });
    batch('rgba(10,16,40,.30)', () => { for (const q2 of folds) taperPath(q2.ax, q2.ay, q2.mx, q2.my, q2.ex, q2.ey, 6.5 * R.s); });
    batch(`rgba(255,240,214,${(.08 + .14 * kL).toFixed(3)})`, () => { for (const { p, ax, ay, mx, my, ex, ey } of folds) { const o = 4 * R.s; taperPath(ax + p.tx * o, ay + p.ty * o, mx + p.tx * o * .75, my + p.ty * o * .75, ex + p.tx * o, ey + p.ty * o, 2.6 * R.s); } });
    ctx.restore();
    // ink outline (heavier on the side away from the light)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    for (const sgn of [-1, 1]) {
      ctx.lineWidth = (sgn * lp < 0 ? 4.4 : 2.8) * Math.sqrt(R.s);
      ctx.beginPath(); pts.forEach((p, i) => { const q2 = sidePt(p, sgn); i ? ctx.lineTo(q2.x, q2.y) : ctx.moveTo(q2.x, q2.y); }); ctx.stroke();
    }
    ctx.restore();
  }
  /** the rolled shirt cuff: the lighter inside of the chambray turned out, a stitched hem. part: 'lower' (+ the dark opening) | 'upper' */
  function drawRoll(R, B, part) {
    const L = R.L, A = ROLL.A, Bv = ROLL.B, a = ROLL.a, b = ROLL.b, cy = -OPEN;
    const wc = R.Ma.transformPoint(new DOMPoint(0, cy));
    const fab = litc(SLV_L, wc.x, wc.y + 30, L, .6), fabD = litc(SLV_D, wc.x, wc.y + 30, L, -.2);
    const l = R.lightA;
    ctx.save(); setM(B, R.Ma);
    ctx.beginPath(); if (part === 'upper') ctx.rect(-200, cy - 200, 400, 200); else ctx.rect(-200, cy, 400, 300); ctx.clip();
    const ring = () => { ctx.ellipse(0, cy, A, Bv, 0, 0, TAU); ctx.moveTo(a, cy + 1.5); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU, true); };
    ctx.beginPath(); ring(); ctx.fillStyle = css(fab); ctx.fill('evenodd');
    ctx.save(); ctx.beginPath(); ring(); ctx.clip('evenodd');
    ctx.fillStyle = twill(); ctx.fillRect(-A - 4, cy - Bv - 4, 2 * A + 8, 2 * Bv + 8);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = css(fabD, .55); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, cy + .8, (A + a) / 2 + 3, (Bv + b) / 2 + 1, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    let g = ctx.createRadialGradient(l.x * 14, cy - 10 + l.y * 4, 4, 0, cy, A * 1.05);
    g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(.55, 'rgba(255,240,210,.16)'); g.addColorStop(.8, 'rgba(10,16,40,.06)'); g.addColorStop(1, 'rgba(10,16,40,.5)');
    ctx.fillStyle = g; ctx.fillRect(-A - 4, cy - Bv - 4, 2 * A + 8, 2 * Bv + 8);
    ctx.strokeStyle = 'rgba(10,16,40,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, cy + 1.5, a + 2, b + 2, 0, 0, TAU); ctx.stroke();
    g = ctx.createLinearGradient(0, cy - Bv, 0, cy + Bv); g.addColorStop(0, 'rgba(255,248,230,.3)'); g.addColorStop(.35, 'rgba(255,248,230,0)'); g.addColorStop(.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = g; ctx.fillRect(-A - 4, cy - Bv - 4, 2 * A + 8, 2 * Bv + 8);
    ctx.restore();
    if (part !== 'upper') {
      g = ctx.createLinearGradient(0, cy - b, 0, cy + b);
      g.addColorStop(0, '#05060C'); g.addColorStop(.7, '#0B0F1C'); g.addColorStop(1, css(mixc([12, 16, 30], fabD, .5)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(0, cy, A, Bv, 0, 0, TAU); ctx.moveTo(a, cy + 1.5); ctx.ellipse(0, cy + 1.5, a, b, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // ======================= TOI's felt pen (pose 'pen'): pinched between thumb and index, the tip on the paper =======================
  const PEN = { a: [18, -40], b: [-62, 166], w: 13 };          // back end, felt tip (hand local units, R-canonical)
  const PEN_BOX = [[-80, 184], [30, -56]];
  function penTipAt(side, W) {
    const SH = G.shoulder[side], dv = { x: (W.x - SH.x) * .8, y: W.y - SH.y }, dl = Math.hypot(dv.x, dv.y) || 1, d = { x: dv.x / dl, y: dv.y / dl };
    const P = posePar('pen', side, 0, null), armAng = Math.atan2(-d.x, d.y), handAng = armAng + wrapA(Math.PI - armAng) * P.align, zs = 1 + P.z / 900;
    const m = side === 'R' ? -1 : 1;
    const M = new DOMMatrix().translateSelf(W.x, W.y).rotateSelf(armAng * DEG).translateSelf(0, HOFF).rotateSelf((handAng - armAng) * DEG).scaleSelf(m * zs * HS, zs * HS).rotateSelf(-P.bend * DEG);
    const q = M.transformPoint(new DOMPoint(PEN.b[0], PEN.b[1])); return { x: q.x, y: q.y };
  }
  function penDraw(R, B) {
    setM(B, R.Mh);
    const [ax, ay] = PEN.a, [bx, by] = PEN.b, dx = bx - ax, dy = by - ay, L0 = Math.hypot(dx, dy), ux = dx / L0, uy = dy / L0, nx = -uy, ny = ux, w = PEN.w;
    const at2 = (u, v) => [ax + ux * u + nx * v, ay + uy * u + ny * v];
    const quad = (u0, u1, w0, w1) => { const p = [at2(u0, -w0), at2(u1, -w1), at2(u1, w1), at2(u0, w0)]; ctx.beginPath(); ctx.moveTo(...p[0]); for (const q of p.slice(1)) ctx.lineTo(...q); ctx.closePath(); };
    ctx.lineJoin = 'round';
    // the barrel (navy), a pale band, the conical front, the felt nib
    quad(0, L0 - 30, w / 2, w / 2); ctx.fillStyle = '#1F2B66'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
    quad(4, L0 - 34, w * .16, w * .16); ctx.fillStyle = 'rgba(160,180,255,.35)'; ctx.fill();
    quad(L0 * .55, L0 * .55 + 20, w / 2, w / 2); ctx.fillStyle = '#D9DDE8'; ctx.fill();
    quad(L0 - 30, L0 - 10, w / 2, w * .3); ctx.fillStyle = '#3A3F55'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    quad(L0 - 10, L0, w * .22, w * .14); ctx.fillStyle = '#16205A'; ctx.fill(); ctx.stroke();
  }
  // ======================= public =======================
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
    if (R.P.fx && R.P.fx.pen) penDraw(R, B);
    if (!dbg.noGlove) drawGlove(R, B, 'all');
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
    if (Rc.P.fx && Rc.P.fx.pen) for (const [x, y] of PEN_BOX) { const q = toA.transformPoint(new DOMPoint(x, y)); bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); by0 = Math.min(by0, q.y); by1 = Math.max(by1, q.y); }
    const mg = 24;
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
    let vis = pts.length; for (let i = 0; i < pts.length; i++) if (pts[i].y > H + 260) { vis = i + 1; break; }
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
  return { arm, armShadow, posePar, frame, dbg, penTipAt, PEN, hand };
})();

// =============================================================================================
// THE SAMPLE: parcel, bag, « À GARDER », « PAREIL ✓ », the falling P A S
// =============================================================================================
const FS_S = (function () {
  const B = FS_lib, S = B.S, G = B.G, A = B.A, P = B.P, { cl, kk, mix, eo, sst, R, rgba } = B;
  const TAU = Math.PI * 2, has = n => typeof window[n] === 'function';
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };

  // ---------------------------------------------------------------- the sample parcel
  const PC = { w: 340, h: 170, d: 150 };
  const parcelSt = p => ({ x: p.x, y: p.y + PC.h / 2, w: PC.w, h: PC.h, d: PC.d, s: p.s ?? 1, sx: p.sx ?? 1, sy: p.sy ?? 1, rot: p.rot || 0, a: p.a ?? 1,
    flaps: p.open, tape: 1, torn: p.open > .02 ? 1 : 0, shake: 0 });
  const LBW = 306, LBH = 92;
  const labelSprite = () => B.sprite('echLabel', LBW + 30, LBH + 30, () => {
    const l = txt('parcelLbl') || 'ÉCHANTILLON';
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 20000 + 2; ctx.shadowOffsetY = 3; ctx.translate(-20000, 0);
    rrect(-LBW / 2, -LBH / 2, LBW, LBH, 6); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -LBH / 2, 0, LBH / 2); g.addColorStop(0, '#FFFDF7'); g.addColorStop(1, '#F1EBDF');
    rrect(-LBW / 2, -LBH / 2, LBW, LBH, 6); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(26,20,38,.8)'; ctx.lineWidth = 3; rrect(-LBW / 2 + 8, -LBH / 2 + 8, LBW - 16, LBH - 16, 3); ctx.stroke();
    const z = B.fit(l, '900 #px Stencil', 64, LBW - 40, 52, 2);
    text(l, 0, z * .36, { font: `900 ${z}px Stencil`, align: 'center', color: '#1A1426', ls: 2 });
  }, 2);
  function parcel(p, t, L) {
    if (!p) return;
    const st = parcelSt(p);
    FS_CART.draw(st, 'back', t, L);
    FS_CART.draw(st, 'front', t, L, { ink: g => {
      const lift = kk(t, A.parcel - .3, A.parcel);                  // already on it when it lands
      ctx.save(); ctx.translate(g.w / 2, g.h * .54); ctx.rotate(-.025); ctx.globalAlpha *= lift;
      B.blit(labelSprite()); ctx.restore();
    } });
    // the landing puffs a little dust from under it
    const dk = kk(t, A.parcel, A.parcel + .55);
    if (dk > 0 && dk < 1) B.puffs([{ x: st.x - PC.w / 2, y: st.y, nx: -1, ny: .2 }, { x: st.x + PC.w / 2 + 30, y: st.y - 20, nx: 1, ny: .1 }, { x: st.x, y: st.y + 4, nx: 0, ny: 1 }], dk,
      { n: 5, seed: 210, dist: 70, size: 24, a: .4, rise: 10, tj: PC.w * .6 });
  }

  // ---------------------------------------------------------------- the sample bag + « À GARDER »
  const TG = { w: 300, h: 88, str: 54 };
  const keepSprite = () => B.sprite('keepTag', TG.w + 30, TG.h + 30, () => {
    const l = txt('keep') || 'À GARDER', w = TG.w, h = TG.h, c = 16;
    const path = () => { ctx.beginPath(); ctx.moveTo(-w / 2 + c, -h / 2); ctx.lineTo(w / 2 - c, -h / 2); ctx.lineTo(w / 2, -h / 2 + c); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h / 2 + c); ctx.closePath(); };
    ctx.save(); ctx.translate(0, 3); path(); ctx.fillStyle = '#7E5A30'; ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#E1BE8B'); g.addColorStop(1, '#CFA56C');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 500; i++) { const x = -w / 2 + R(i, 91) * w, y = -h / 2 + R(i, 92) * h, a = R(i, 93) * 3, l2 = 2 + R(i, 94) * 7;
      ctx.strokeStyle = R(i, 95) > .5 ? 'rgba(120,80,36,.22)' : 'rgba(255,236,200,.3)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l2, y + Math.sin(a) * l2); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#F2E6D0'; ctx.beginPath(); ctx.arc(0, -h / 2 + 15, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2A1A12'; ctx.beginPath(); ctx.arc(0, -h / 2 + 15, 3.6, 0, TAU); ctx.fill();
    const z = B.fit(l, '900 #px Satoshi', 48, w - 36, 46);
    text(l, 0, h / 2 - 16, { font: `900 ${z}px Satoshi`, align: 'center', color: 'rgba(255,240,214,.5)' });
    text(l, 0, h / 2 - 18, { font: `900 ${z}px Satoshi`, align: 'center', color: '#2A1A12' });
  }, 2);
  /** the world point of a tote-local point (body centre origin, s, rot) */
  const tp = (b, dx, dy) => { const c = Math.cos(b.rot || 0), s2 = Math.sin(b.rot || 0); return { x: b.x + (dx * c - dy * s2) * b.s, y: b.y + (dx * s2 + dy * c) * b.s }; };
  function sampleBag(b, t, L) {
    if (!b) return;
    const T0 = B.TOTE;
    // its shadow: on the cloth, lifted (it is held), long down-right
    const gl = S.gloves(t); if (gl.L) { const f = t * 30, h = FS_HK.hand('L', f); FS_HK.armShadow('L', h, f, L, {}); FS_HK.arm('L', h, f, L, {}); }
    const z = 70 + 40 * (1 - b.tapping), so = shadowOff(b.x, b.y + T0.h / 2 * b.s, z, L);
    B.softShadow(b.x + so.x, b.y + T0.h * .42 * b.s + so.y * .6, T0.w * .55 * b.s, 30 * b.s, .34 * (1 - .4 * b.tapping));
    ctx.save();
    // inside the parcel: its front and right walls hide the bag's lower part
    const pc = S.parcel(t);
    if (pc && t < A.unbox + .4) {
      const st = parcelSt(pc), g = S.cartonGeo(st);
      ctx.beginPath(); ctx.rect(-400, -400, W + 800, H + 800);
      const Q = [g.FTL, g.FTR, g.BTR, g.BBR, g.FBR, g.FBL]; ctx.moveTo(Q[0][0], Q[0][1] + 4); for (const q of Q.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath();
      ctx.clip('evenodd');
    }
    // the taps: it goes under the amber plate (clipped by it) and knocks it from below
    const Am = t >= A.taps[0] - .5 ? S.amber(t) : null;            // under the plate from the taps until it is carried away
    if (Am) {
      const hw = G.plateW.amber / 2 * Am.s * Am.sx, hh = G.plateH.amber / 2 * Am.s * Am.sy;
      ctx.beginPath(); ctx.rect(-400, -400, W + 800, H + 800); ctx.roundRect(Am.x - hw - 4, Am.y - hh - 6, 2 * hw + 8, 2 * hh + 26, 30); ctx.clip('evenodd');
    }
    B.tote(b.x, b.y, b.s, b.rot);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lit('#FFFFFF', b.x, b.y, L, .5);
    ctx.fillRect(b.x - 200 * b.s, b.y - 200 * b.s, 400 * b.s, 400 * b.s);
    ctx.restore();
    const front = 1 - kk(t, A.unbox + .02, A.unbox + .22);
    if (gl.L && front > 0) { const f = t * 30, h = FS_HK.hand('L', f); ctx.save(); ctx.globalAlpha *= front; FS_HK.arm('L', h, f, L, {}); ctx.restore(); }
    // a knock flash where it meets the plate (each tap)
    if (Am) for (const tq of A.taps) {
      const k = kk(t, tq - .02, tq + .22); if (k <= 0 || k >= 1) continue;
      const x = b.x, y = Am.y + G.plateH.amber / 2 * Am.s * Am.sy + 12;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * .8;
      ctx.strokeStyle = '#FFE7B0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let j = 0; j < 6; j++) { const a = Math.PI + .3 + j * (Math.PI - .6) / 5, r0 = 30 + 40 * k, r1 = r0 + 26; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0 * 1.6, y + 6 + Math.sin(a) * r0 * -.5); ctx.lineTo(x + Math.cos(a) * r1 * 1.6, y + 6 + Math.sin(a) * r1 * -.5); ctx.stroke(); }
      ctx.restore();
    }
    // « À GARDER »: a kraft tag tied on the right handle's tab, hanging down the bag's front (world size: always ≥ 46 px)
    if (b.keep > 0) {
      const pv = tp(b, T0.w * .26, -T0.h / 2 + 10);
      const v = (() => { const a = S.sampleBag(t - .04), c = S.sampleBag(t + .04); return a && c ? (c.x - a.x) / .08 : 0; })();
      const dk = t - A.keep, land = dk > 0 ? .22 * Math.exp(-dk * 4.5) * Math.sin(dk * 13) : 0;
      const jolt = A.taps.reduce((m, tq) => m + .25 * Math.exp(-Math.max(0, t - tq) * 6) * Math.sin(Math.max(0, t - tq) * 18) * (t > tq ? 1 : 0), 0);
      const th = -.2 + .28 * Math.tanh(-v / 700) + .05 * Math.sin(t * 2.1) + land + (b.rot || 0) * .5 - .14 * b.tapping + jolt;
      const k = b.keep, e = eo(k), sc = 1.25 - .25 * e;
      const top = { x: pv.x + Math.sin(-th) * TG.str, y: pv.y + Math.cos(th) * TG.str };
      ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2.5);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(30,16,8,.6)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(top.x, top.y + 14); ctx.stroke();
      ctx.strokeStyle = '#E8DCC2'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(top.x, top.y + 14); ctx.stroke();
      ctx.translate(top.x, top.y); ctx.rotate(th); ctx.scale(sc, sc);
      B.softShadow(10, TG.h / 2 + 14, TG.w * .5, 18, .25);
      B.blit(keepSprite(), 0, TG.h / 2);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lit('#FFFFFF', top.x, top.y + 40, L, .5); ctx.fillRect(-TG.w / 2, 0, TG.w, TG.h + 4);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- « PAREIL ✓ » on the polaroid
  const pareilSp = () => B.stampSprite('pareil', [(txt('pareil') || 'PAREIL ✓').replace(/\s*✓\s*$/, '')], { font: '900 #px Satoshi', size: 62, ls: 1, color: '#C86400', tick: true, pad: 28, padY: 16, border: 8 });   // QA: deeper amber (#E58A00 read faint on the light photo)
  function onPhoto(Pp, t, L) {
    if (!Pp || Pp.pareil <= 0) return;
    const s = Pp.s;
    B.stampAt(pareilSp(), Pp.x - 30 * s, Pp.y + 40 * s, Pp.rot - .12, Pp.pareil, { since: t - A.pareil, comp: 'source-over', ink: 1 });
  }

  // ---------------------------------------------------------------- P, A, S
  const PL = S.lettersPlan(), AMB_TXT = S.plateText('amber');
  const PASP = { g: 4600, pop: -220, e: .32, sF: .68, roll: .66, thick: 12 };
  let BOX = null;
  function boxes() {
    if (BOX) return BOX;
    let res = null;
    if (has('OM_glyphs')) {
      try {
        const gs = OM_glyphs(AMB_TXT) || [];
        if (gs.length > 8) res = [6, 7, 8].map(j => { const g = gs[j], tl = Math.abs(g.y + g.h / 2) < Math.abs(g.y) && Math.abs(g.y) > 2; return { ch: g.ch, x: tl ? g.x + g.w / 2 : g.x, y: tl ? g.y + g.h / 2 : g.y, w: g.w, h: g.h, src: g, om: 1 }; });
      } catch (e) { res = null; }
    }
    if (!res && window.__amberLayout) {
      const lo = window.__amberLayout(AMB_TXT);
      res = [6, 7, 8].map(j => { const g = lo.xs[j]; return { ch: g.ch, x: g.x0 + g.w / 2, y: 0, w: g.w, h: lo.capH, z: lo.z }; });
    }
    if (!res) res = ['P', 'A', 'S'].map((ch, j) => ({ ch, x: -20 + 70 * j, y: 0, w: 70, h: 80, z: 108 }));
    BOX = res; return BOX;
  }
  // a chip of the amber plate carrying its letter (fallback when M1's OM_glyph is not there): cached per letter
  const chipSprite = (box) => B.sprite('chip_' + box.ch, box.w + 70, box.h + 90, () => {
    const w = box.w + 30, h = box.h + 44, z = box.z || Math.round(box.h / .72);
    const pts = []; const N = 14;
    for (let i = 0; i < N; i++) { const a = i / N * TAU, rr = .5 + .08 * (R(i, box.ch.charCodeAt(0)) - .5); pts.push([Math.cos(a) * w * rr * 1.05, Math.sin(a) * h * rr]); }
    const path = (dy = 0) => { ctx.beginPath(); pts.forEach((p, i) => { const x = cl(p[0], -w / 2, w / 2), y = cl(p[1], -h / 2, h / 2) + dy; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
    path(PASP.thick); ctx.fillStyle = '#A9620A'; ctx.fill();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#FFC75E'); g.addColorStop(.5, '#FBAA2A'); g.addColorStop(1, '#EE931A');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,222,.6)'; ctx.lineWidth = 2; ctx.stroke();
    const f = `900 ${z}px Satoshi`;
    text(box.ch, 0, box.h / 2 + 2, { font: f, align: 'center', color: 'rgba(255,232,170,.7)' });
    text(box.ch, 0, box.h / 2, { font: f, align: 'center', color: '#2A1606' });
  }, 2);
  const PCN = [];
  function pasConst(i) {
    if (PCN[i]) return PCN[i];
    const box = boxes()[i], td = PL.detach[i];
    const st = S.amber(td) || { x: G.cx, y: G.amberY, s: 1, sx: 1, sy: 1, rot: 0 };
    const rot0 = st.rot || 0, c = Math.cos(rot0), s = Math.sin(rot0), ksx = st.s * st.sx, ksy = st.s * st.sy;
    const X = st.x + c * box.x * ksx - s * box.y * ksy, Y = st.y + s * box.x * ksx + c * box.y * ksy;
    const sc0 = st.s * (st.sx + st.sy) / 2, rest = PL.rest[i], sF = PASP.sF;
    const bw = box.w + 30, bh = box.h + 44;
    const hcf = (th, sc) => sc * (bw / 2 * Math.abs(Math.sin(th)) + bh / 2 * Math.abs(Math.cos(th)));
    const yFL = rest.y + bh * sF / 2;
    const h0 = Math.max(40, yFL - hcf(rot0, sc0) - Y), g = PASP.g, pop = PASP.pop;
    const t1 = (pop + Math.sqrt(pop * pop + 2 * g * h0)) / g;
    const v1 = PASP.e * (g * t1 - pop), d1 = 2 * v1 / g, v2 = PASP.e * v1, d2 = 2 * v2 / g;
    const xL = X - [40, 60, 80][i] , w = [.9, -.7, .8][i];
    const tr = t1 + d1 + d2 + .06;
    PCN[i] = { box, bw, bh, X, Y, sc0, rot0, rest, sF, hcf, yFL, h0, g, pop, t1, v1, d1, v2, d2, xL, w, tr, th1: rot0 + w * t1 };
    return PCN[i];
  }
  function pasPre(i, t) {
    const tau = t - PL.detach[i]; if (tau < 0) return null;
    const Q = pasConst(i);
    let hA, x, rot, phase, pr = 0;
    if (tau < Q.t1) { hA = Q.h0 + Q.pop * tau - Q.g * tau * tau / 2; x = mix(Q.X, Q.xL, tau / Q.t1); rot = Q.rot0 + Q.w * tau; phase = 'fall'; }
    else {
      const tb = tau - Q.t1;
      if (tb < Q.d1) hA = Q.v1 * tb - Q.g * tb * tb / 2;
      else if (tb < Q.d1 + Q.d2) { const q = tb - Q.d1; hA = Q.v2 * q - Q.g * q * q / 2; }
      else hA = 0;
      pr = sst(kk(tau, Q.tr, Q.tr + PASP.roll));
      x = mix(Q.xL - 14 * (1 - Math.exp(-tb / .15)), Q.rest.x, pr);
      rot = Q.th1 * Math.exp(-tb / .11) * Math.cos(tb * 16) * (1 - pr) - TAU * pr;   // rights itself, then one full tumble left
      phase = tau < Q.tr ? 'bounce' : pr < 1 ? 'roll' : 'rest';
    }
    hA = Math.max(0, hA);
    const sc = (Q.sF + (Q.sc0 - Q.sF) * cl(hA / Q.h0, 0, 1.5)) * (1 + .12 * Math.sin(Math.PI * kk(tau, 0, .2)));
    // a little life while it waits: it rocks when the next one lands next to it
    if (phase === 'rest') for (let j = i + 1; j < 3; j++) { const dj = t - (PL.detach[j] + pasConst(j).tr + PASP.roll); if (dj > 0 && dj < .6) rot += .12 * Math.exp(-dj * 7) * Math.sin(dj * 30); }
    return { x, y: Q.yFL - Q.hcf(rot, sc) - hA, sc, rot, hA, fy: Q.yFL, phase, sx: 1, sy: 1, Q, hot: 1 - kk(tau, .05, .8) };
  }
  function mouth(t) {
    if (has('K_mouth')) { try { const m = K_mouth(t); if (m && isFinite(m.x) && isFinite(m.y)) return m; } catch (e) { /* fallback */ } }
    return { x: G.gecko.x + 40, y: G.gecko.y - 70 };
  }
  function pasState(i, t) {
    const tg = PL.gulps[i], t0 = tg - .17, ta = tg + .03, tv = tg + .1;
    if (t >= tv) return null;
    if (t < t0) {
      const s = pasPre(i, t); if (!s) return null;
      for (let j = 0; j < i; j++) { const d = t - PL.gulps[j]; if (d > 0 && d < .5) { const a = Math.exp(-d * 7); s.rot += .1 * Math.sin(d * 34) * a; s.x += 5 * Math.sin(Math.PI * kk(d, 0, .25)); } }
      return s;
    }
    const o = pasPre(i, t0) || { x: PL.rest[i].x, y: PL.rest[i].y, sc: PASP.sF, rot: 0, fy: PL.rest[i].y, Q: pasConst(i) };
    const m = mouth(t), u = kk(t, t0, ta), ant = kk(u, 0, .32), p = Math.pow(kk(u, .32, 1), 2.1), lift = 26 * 4 * p * (1 - p), sq = Math.sin(Math.PI * p);
    let sc = o.sc * (1 - .5 * p); if (t > ta) sc *= 1 - kk(t, ta, tv);
    return { x: mix(o.x, m.x, p) + 7 * Math.sin(Math.PI * ant) * (1 - p), y: mix(o.y, m.y, p) - lift, sc, rot: .2 * Math.sin(Math.PI * ant) * (1 - p) - 1.15 * p, hA: lift,
      fy: mix(o.fy, m.y + 8, p), phase: 'gulp', sx: 1 + .32 * sq, sy: 1 - .16 * sq, Q: o.Q, hot: 0 };
  }
  function letter(q, L) {
    const box = q.Q.box;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(q.sc * q.sx, q.sc * q.sy);
    if (q.hot > .01) {                                        // the broken edges still glow: a cheap additive halo
      const R0 = Math.max(q.Q.bw, q.Q.bh) * .7, hg = ctx.createRadialGradient(0, 0, R0 * .3, 0, 0, R0);
      hg.addColorStop(0, `rgba(255,170,40,${(.6 * q.hot).toFixed(3)})`); hg.addColorStop(1, 'rgba(255,120,10,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg; ctx.fillRect(-R0, -R0, 2 * R0, 2 * R0); ctx.restore();
    }
    let done = false;
    if (box.om && has('OM_glyph')) { try { OM_glyph(box.ch, box.src, L); done = true; } catch (e) { done = false; } }
    if (!done) B.blit(chipSprite(box));
    ctx.restore();
  }
  function letterShadow(q, L) {
    const h = q.hA, a = (.5 / (1 + h * .01)) * cl(q.sc * 3); if (a < .01) return;
    const sc = q.Q.sF * (q.phase === 'gulp' ? q.sc / q.Q.sF : 1);
    B.softShadow(q.x + 10 + h * .25, q.fy - 4 + h * .05, q.Q.bw * sc * .6 * (1 + h * .004), q.Q.bh * sc * .22 * (1 + h * .004), a);
  }
  function letters(t, L) {
    if (t < PL.detach[0] - .02) return;
    const qs = [0, 1, 2].map(i => pasState(i, t));
    qs.forEach(q => { if (q && q.sc > .01) letterShadow(q, L); });
    // landing puffs, chips at each detach
    for (let i = 0; i < 3; i++) {
      if (t < PL.detach[i]) continue;
      const Q = pasConst(i), kd = kk(t, PL.detach[i] - .01, PL.detach[i] + .4);
      if (kd > 0 && kd < 1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 10; j++) { const r1 = R(j, 60 + i), r2 = R(j, 70 + i), s = kd * .38, vx = (r1 - .5) * 520, vy = -(80 + 240 * r2);
          const px = Q.X + (r1 - .5) * Q.box.w * .8 + vx * s, py = Q.Y + Q.box.h * .5 + vy * s + 2600 * s * s, al = (1 - kd) * (.55 + .45 * r2);
          ctx.fillStyle = rgba(j % 3 ? [255, 176, 60] : [255, 232, 180], al); ctx.fillRect(px - 2, py - 2, 4, 4); }
        ctx.restore();
      }
      [[Q.t1, 1], [Q.t1 + Q.d1, .55]].forEach(([dt, s], j) => {
        const te = PL.detach[i] + dt, k = kk(t, te, te + .5); if (k <= 0 || k >= 1) return;
        const q = pasPre(i, te); if (!q) return;
        B.puffs([{ x: q.x - 18, y: Q.yFL, nx: -1, ny: .1, s }, { x: q.x + 18, y: Q.yFL, nx: 1, ny: .1, s }], k, { n: 5, seed: 140 + i * 3 + j, dist: 46, size: 15, a: .5, rise: 12, tj: 16, out: 2 });
      });
    }
    [0, 1, 2].filter(i => qs[i] && qs[i].sc > .01).sort((a, b) => (qs[a].phase === 'fall') - (qs[b].phase === 'fall') || qs[a].fy - qs[b].fy).forEach(i => letter(qs[i], L));
  }

  return { parcel, sampleBag, onPhoto, letters, pasState };
})();
function FS_parcel(p, t, L) { FS_S.parcel(p, t, L); }
function FS_sampleBag(b, t, L) { FS_S.sampleBag(b, t, L); }
function FS_onPhoto(P, t, L) { FS_S.onPhoto(P, t, L); }
function FS_letters(t, L) { FS_S.letters(t, L); }
const FS_SB = t => window.SCORE.sampleBag(t);
function FS_gloves(g, t, L) {
  if (!g) return;
  const f = t * 30, hs = { L: g.L && !FS_SB(t) ? FS_HK.hand('L', f) : null, R: g.R ? FS_HK.hand('R', f) : null };   // L holds the sample: drawn behind it by FS_sampleBag
  for (const sd of ['L', 'R']) if (hs[sd]) FS_HK.armShadow(sd, hs[sd], f, L, {});
  for (const sd of ['L', 'R']) if (hs[sd]) FS_HK.arm(sd, hs[sd], f, L, {});
}
