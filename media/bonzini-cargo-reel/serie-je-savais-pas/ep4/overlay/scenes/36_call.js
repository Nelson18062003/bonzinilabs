'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — M2, part 1: TOI's plate, the call, the honest supplier (prefix BZ_).
// Functions only (50_compose.js calls them with the states the score computed). Every time comes from SCORE.A / SCORE.T.
//
//   BZ_toi(st, t, L)   world  TOI's amber plate (st = SCORE.toiPlate(t)), base PL_plate('toi'). Adds:
//                            · a REAL TURN to « ALLÔ ? » (st.flip 0..1): the plate lifts off the cloth and turns about its
//                              horizontal axis — perspective-sliced face (the near edge wider), its amber edge face catching
//                              the bulb at mid-turn, the face darkening as it turns away, its shadow squeezed under it; the
//                              text swaps at mid-turn (score) and the new face comes up from behind;
//                            · it BUZZES on each ring (A.ring, like a phone on a table, on twos);
//                            · a bead of sweat at « IL N'A RIEN CHANGÉ ! » (surprise, never humiliation).
//   BZ_call(t, L)      world  the call: « ((( ALLÔ ? ))) » — hand-drawn amber ring waves leaving both ends of TOI's plate
//                            on each ring (3 tapered arcs per ring, boiled on twos); then a dotted amber line climbs from
//                            TOI's plate up the right edge to where the honest steel plate comes down (A.supIn0 → supIn1):
//                            a signal pulse goes up, the answer pulse comes back down after the steel has landed, on
//                            « Il dit… » (T3b, A.toiRien). v2: ONE ring (A.ring has one entry), in the pause after C3.
//   BZ_sup(st, t, L)   world + hero  the honest brushed-steel plate « JE N'AI RIEN CHANGÉ. » (st = SCORE.supPlate(t)),
//                            base PL_plate('honest') — calm (no squash): a cool rim light while it hovers, and at A.stamp a
//                            metal « clang »: a bright shimmer runs across the steel and it rings out (tiny decaying shake).
// Deterministic (rnd, frame-quantised boil), no ctx.filter; the flip face is re-rendered into one cached offscreen canvas.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, kk = S.kk, ease = S.ease, eOut = S.easeOut, cl = S.cl, lerpv = S.lerpv;
  const AMB = [243, 167, 69], STEEL = [196, 206, 220];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const nOf = t => Math.round(t * 30);
  const twos = t => Math.floor(nOf(t) / 2);

  // ------------------------------------------------------------------ TOI's plate
  const FS = 1.25, PADF = 10;                       // flip face offscreen: 1.25× (the plate is ≈ 1× on screen)
  let FC = null, FG = null;
  /** the plate's face (no body, no shadow) rendered into the offscreen canvas, upright, centred */
  function faceCanvas(sp, st, t, L, P) {
    const w = Math.ceil((sp.W + 2 * PADF) * FS), h = Math.ceil((sp.H + 2 * PADF) * FS);
    if (!FC) { FC = makeCanvas(w, h); FG = FC.getContext('2d'); }
    FG.setTransform(1, 0, 0, 1, 0, 0); FG.globalAlpha = 1; FG.globalCompositeOperation = 'source-over'; FG.clearRect(0, 0, w, h);
    FG.setTransform(FS, 0, 0, FS, (sp.W / 2 + PADF) * FS, (sp.H / 2 + PADF) * FS);
    const prev = ctx; ctx = FG;
    try { PL_amberFace(sp, { x: P.x, y: P.y, rot: 0, sxx: 1, syy: 1 }, { ...st, sweat: 0 }, t, L); } finally { ctx = prev; }
    return FC;
  }
  function amberSides(x, y, L) {
    const tn = PL_tintAt(x, y, L);
    return [PL_lit([214, 116, 10], tn), PL_lit([120, 52, 4], tn), PL_lit([255, 196, 110], tn)];
  }
  /** the turn: theta = π·flip about the plate's horizontal axis (top edge comes towards us first) */
  function flipPlate(st, t, L) {
    const sp = PL_SPEC.toi, W = sp.W, H = sp.H, R = sp.R, f = cl(st.flip), th = Math.PI * f, c = Math.cos(th), s = Math.sin(th);
    const sc = st.s ?? 1, lift = 34 * s * sc, x = st.x, y = st.y - lift, rot = st.rot || 0;
    const side = amberSides(x, y, L);
    // body: shadow (squeezed footprint, further away while it is lifted), contact, the resting thickness (fades as it turns)
    const P = { x, y, rot, sxx: sc * (st.sx ?? 1), syy: sc * Math.max(.04, Math.abs(c)) };
    PL_body('toi', sp, P, L, (st.z ?? 14) + lift, side);
    // the face: front (first half) shifted down by d/2·sinθ, back (second half) shifted up; perspective slices
    const d = sp.depth * sc, F = 1500, face = faceCanvas(sp, st, t, L, P), front = c >= 0;
    const fy = (front ? 1 : -1) * d / 2 * s;
    const ac = Math.abs(c), sg = front ? 1 : -1;
    const pt = F / (F - sg * (H / 2) * s * sc), pb = F / (F + sg * (H / 2) * s * sc);
    const topY = fy - H / 2 * ac * sc * pt, botY = fy + H / 2 * ac * sc * pb;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    if (ac > .02) {
      const N = 30, srcH = (H + 2 * PADF) * FS;
      for (let i = 0; i < N; i++) {
        const v0 = i / N, v1 = (i + 1) / N, ly0 = -H / 2 - PADF + (H + 2 * PADF) * v0, ly1 = -H / 2 - PADF + (H + 2 * PADF) * v1, lm = (ly0 + ly1) / 2;
        const zc = -(front ? 1 : -1) * lm * s * sc, p = F / (F - zc);
        const y0 = fy + ly0 * ac * sc * (F / (F + (front ? 1 : -1) * ly0 * s * sc)), y1 = fy + ly1 * ac * sc * (F / (F + (front ? 1 : -1) * ly1 * s * sc));
        const hw = (W / 2 + PADF) * sc * p;
        ctx.drawImage(face, 0, srcH * v0, face.width, srcH * (v1 - v0) + (i < N - 1 ? .6 : 0), -hw, y0, 2 * hw, (y1 - y0) + (i < N - 1 ? .5 : 0));
      }
      // light: the face darkens as it turns away from the bulb; the bulb's reflection slides across it
      const quad = () => { ctx.beginPath(); ctx.moveTo(-W / 2 * sc * pt, topY); ctx.lineTo(W / 2 * sc * pt, topY); ctx.lineTo(W / 2 * sc * pb, botY); ctx.lineTo(-W / 2 * sc * pb, botY); ctx.closePath(); };
      ctx.save(); quad(); ctx.clip();
      const shade = .58 + .42 * ac; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${255 * shade | 0},${255 * (shade * .97) | 0},${255 * (shade * .93) | 0})`; ctx.fillRect(-W, topY - 2, 2 * W, botY - topY + 4);
      ctx.globalCompositeOperation = 'screen';
      const hy = lerpv(topY, botY, front ? 1 - ac : ac), g = ctx.createLinearGradient(0, hy - 40, 0, hy + 40);
      g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(.5, `rgba(255,244,220,${(.45 * s).toFixed(3)})`); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g; ctx.fillRect(-W, hy - 40, 2 * W, 80);
      ctx.restore();
    }
    // the top edge face (thickness d·sinθ): above the front face in the first half, below the back face in the second
    const eh = d * s, eTop = front ? topY - eh : botY, pe = front ? pt : pb;
    if (eh > .4) {
      const ew = (W - 2 * R * .35) * sc * pe, er = Math.min(eh / 2, 10);
      const g = ctx.createLinearGradient(0, eTop, 0, eTop + eh);
      const hot = Math.pow(s, 3);                     // faces the bulb at mid-turn
      g.addColorStop(0, rgba(PL_mix(side[1], [255, 214, 140], .5 * hot), 1)); g.addColorStop(.45, rgba(PL_mix(side[0], [255, 236, 190], .55 * hot), 1));
      g.addColorStop(1, rgba(PL_mix(side[1], side[0], .3), 1));
      ctx.fillStyle = g; rrect(-ew / 2, eTop, ew, eh, er); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,236,190,${(.55 * hot).toFixed(3)})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-ew / 2 + er, eTop + eh * .35); ctx.lineTo(ew / 2 - er, eTop + eh * .35); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  /** the phone buzz: TOI's plate shakes on twos for ≈ .45 s after each ring */
  function buzz(t) { let b = 0; for (const r of A.ring) if (t >= r && t < r + .5) b = Math.max(b, Math.exp(-(t - r) * 4.5)); return b; }
  window.BZ_toi = (st, t, L) => {
    if (!st || (st.a ?? 1) <= 0) return;
    const q = { ...st };
    q.shake = Math.max(q.shake || 0, .9 * buzz(t));
    // QA (stage 3): PL_sweat at .2 drew 2 beads + 2 running drops ACROSS « IL A RIEN » (one sat on the L). One bead only,
    // in the plate's right margin (clear of the text), forming then sliding a little: surprise, never humiliation.
    q.sweat = 0;
    if (q.flip > 0 && q.flip < 1) { flipPlate(q, t, L); return; }
    PL_plate('toi', q, t, L);
    const sw = t >= A.toiRien ? kk(t, A.toiRien + .1, A.toiRien + .45) : 0;
    if (sw > 0 && typeof PL_drop === 'function') {
      const sp = PL_SPEC.toi, s = q.s ?? 1, run = ease(kk(t, A.toiRien + .5, A.toiRien + 1.7));
      ctx.save(); ctx.translate(q.x, q.y); if (q.rot) ctx.rotate(q.rot); ctx.scale(s * (q.sx ?? 1), s * (q.sy ?? 1));
      PL_drop(sp.W / 2 - 34, -sp.H / 2 + 34 + 46 * run, 12 * (.5 + .5 * sw), .3 + .9 * run, sw);
      ctx.restore();
    }
  };

  // ------------------------------------------------------------------ the call
  /** a hand-drawn tapered arc: centre (cx, cy), radius r, from angle a0 to a1, max width w, a slow wobble seeded by seed */
  function inkArc(cx, cy, r, a0, a1, w, seed, col, alpha) {
    const n = 24, out = [], inn = [], mid = [], ph = rnd(seed) * 6.28, ph2 = rnd(seed + 3.3) * 6.28;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, jr = r + 1.8 * Math.sin(u * 5 + ph) + 1.1 * Math.sin(u * 11 + ph2), ww = w * Math.pow(Math.sin(Math.PI * cl(u * .94 + .03)), .6);
      out.push([cx + Math.cos(a) * (jr + ww / 2), cy + Math.sin(a) * (jr + ww / 2)]); inn.push([cx + Math.cos(a) * (jr - ww / 2), cy + Math.sin(a) * (jr - ww / 2)]);
      mid.push([cx + Math.cos(a) * (jr - ww * .12), cy + Math.sin(a) * (jr - ww * .12)]);
    }
    const path = () => { ctx.beginPath(); ctx.moveTo(...out[0]); for (const p of out) ctx.lineTo(...p); for (let i = inn.length - 1; i >= 0; i--) ctx.lineTo(...inn[i]); ctx.closePath(); };
    const line = (pts, i0, i1) => { ctx.beginPath(); ctx.moveTo(...pts[i0]); for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(...pts[i]); };
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';                                     // warm glow (two soft strokes, cheap)
    for (const [m, q] of [[2.6, .07], [1.7, .13]]) { ctx.strokeStyle = rgba(col, q); ctx.lineWidth = w * m; line(mid, 2, n - 2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(2, 4); path(); ctx.fillStyle = 'rgba(24,10,4,.4)'; ctx.fill(); ctx.restore();   // its dark seat on the cloth
    path(); ctx.fillStyle = rgba(col, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,204,.75)'; ctx.lineWidth = Math.max(1.2, w * .16); line(mid, 4, n - 4); ctx.stroke();   // the wet ink's highlight
    ctx.restore();
  }
  function rings(t, L) {
    const tp = S.toiPlate(t); if (!tp) return;
    const sp = PL_SPEC.toi, hw = sp.W / 2 * (tp.s ?? 1), cy = tp.y - 4, b = twos(t);
    for (let i = 0; i < A.ring.length; i++) {
      const r0 = A.ring[i];
      for (let j = 0; j < 3; j++) {                   // « ))) »: three nested arcs, inner first, drifting out a little
        const born = r0 + j * .09, k = kk(t, born, born + .78); if (k <= 0 || k >= 1) continue;
        const a = Math.min(1, k * 9) * Math.pow(1 - k, 1.6), R = 56 + 32 * j + 20 * eOut(k), w = 14 - 2 * j - 3 * k;
        for (const sd of [-1, 1]) {
          const cx = tp.x + sd * (hw - 34), sp2 = .52 - .06 * j, a0 = sd > 0 ? -sp2 : Math.PI - sp2, a1 = sd > 0 ? sp2 : Math.PI + sp2;
          inkArc(cx, cy, R, a0, a1, w, b * 7.3 + i * 31 + j * 11 + (sd > 0 ? 0 : 5), AMB, a);
        }
      }
    }
  }
  /** the line to the real supplier: TOI's plate → up the right edge → the steel plate (dotted, hand-drawn) */
  function callLine(t, L) {
    if (t < A.supIn0 - .1 || t > A.toiOut + .3) return;
    const tp = S.toiPlate(t), su = S.supPlate(t); if (!tp) return;
    const grow = eOut(kk(t, A.supIn0 - .1, A.supIn1)), fade = 1 - kk(t, A.toiOut - .05, A.toiOut + .25);
    if (grow <= 0 || fade <= 0) return;
    const sp = PL_SPEC.toi, x0 = tp.x + sp.W / 2 * (tp.s ?? 1) - 46, y0 = tp.y - sp.H / 2 * (tp.s ?? 1) + 8;
    const sx = su ? su.x + 330 : 870, sy = su ? su.y + 150 * (su.sy ?? 1) - 12 : -100;
    const pts = curve([[x0, y0], [x0 + 70, y0 - 140], [1012, lerpv(y0, sy, .45)], [1000, sy + 120], [sx, sy]], 18);
    const Ls = [0]; for (let i = 1; i < pts.length; i++) Ls.push(Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = Ls[Ls.length - 1], lim = tot * grow, at = d => { let i = 1; while (i < Ls.length - 1 && Ls[i] < d) i++; const k = (d - Ls[i - 1]) / ((Ls[i] - Ls[i - 1]) || 1); return [lerpv(pts[i - 1][0], pts[i][0], k), lerpv(pts[i - 1][1], pts[i][1], k)]; };
    const b = twos(t);
    ctx.save(); ctx.globalAlpha *= fade; ctx.lineCap = 'round';
    // dots, amber near TOI, cooling to steel near the supplier
    for (let dd = 0, i = 0; dd < lim; dd += 19, i++) {
      const p = at(dd), u = dd / tot, col = PL_mix(AMB, STEEL, u), r = 3.4 + .8 * rnd(i * 3.1 + b * .7);
      ctx.fillStyle = 'rgba(8,4,16,.45)'; ctx.beginPath(); ctx.arc(p[0] + 1.5, p[1] + 3, r + 1, 0, 7); ctx.fill();
      ctx.fillStyle = rgba(col, .95); ctx.beginPath(); ctx.arc(p[0] + (rnd(i * 1.7 + b) - .5) * 1.4, p[1] + (rnd(i * 2.3 + b) - .5) * 1.4, r, 0, 7); ctx.fill();
    }
    // the signal: up while the supplier comes down, back down with his answer
    const pulse = (k, col) => { if (k <= 0 || k >= 1) return; const p = at(tot * k), a = Math.sin(Math.PI * k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 34);
      g.addColorStop(0, rgba([255, 250, 236], .95 * a)); g.addColorStop(.3, rgba(col, .45 * a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(p[0] - 34, p[1] - 34, 68, 68); ctx.restore(); };
    pulse(Math.min(grow, 1) < 1 ? grow : 2, AMB);
    pulse(1 - kk(t, A.toiRien - .45, A.toiRien + .05), STEEL);
    ctx.restore();
  }
  window.BZ_call = (t, L) => { rings(t, L); callLine(t, L); };

  // ------------------------------------------------------------------ the honest supplier
  window.BZ_sup = (st, t, L) => {
    if (!st || (st.a ?? 1) <= 0) return;
    const q = { ...st }, d = t - A.stamp;
    if (d >= 0 && d < .7) {                           // the metal rings out after the stamp (fast, decaying, frame-quantised)
      const n = nOf(t), e = Math.exp(-d * 7);
      q.x += Math.sin(n * 2.9) * 3.2 * e; q.rot = (q.rot || 0) + Math.sin(n * 3.7 + 1) * .006 * e;
    }
    PL_plate('honest', q, t, L);
    const sp = PL_SPEC.honest, W = sp.W * (q.s ?? 1) * (q.sx ?? 1), H = sp.H * (q.s ?? 1) * (q.sy ?? 1);
    ctx.save(); ctx.translate(q.x, q.y); if (q.rot) ctx.rotate(q.rot);
    rrect(-W / 2, -H / 2, W, H, sp.R); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    // a calm cool rim light on the top edge while it hovers (it came from above, unhurried)
    const hov = kk(t, A.supIn0 + .2, A.supIn1 + .3) * (1 - kk(t, A.stamp - .3, A.stamp - .1));
    if (hov > 0) {
      const g = ctx.createLinearGradient(0, -H / 2, 0, -H / 2 + 26); g.addColorStop(0, `rgba(214,228,255,${(.32 * hov).toFixed(3)})`); g.addColorStop(1, 'rgba(214,228,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2, W, 26);
    }
    // the clang: a bright shimmer runs across the brushed steel at the impact
    if (d >= 0 && d < .55) {
      const k = d / .55, x = -W / 2 - 160 + (W + 320) * ease(k), a = Math.sin(Math.PI * k);
      ctx.transform(1, 0, -.35, 1, 0, 0);
      const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, `rgba(236,244,255,${(.22 * a).toFixed(3)})`); g.addColorStop(.5, `rgba(255,255,255,${(.5 * a).toFixed(3)})`);
      g.addColorStop(.55, `rgba(236,244,255,${(.22 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 100, -H, 200, 2 * H);
    }
    ctx.restore();
  };
})();
