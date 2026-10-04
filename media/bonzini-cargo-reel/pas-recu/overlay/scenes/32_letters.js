'use strict';
// =============================================================================================
// LX — « PAS REÇU. » : the words come alive (letters & effects). Functions only (no registerScene).
// Reads SCORE (01_score.js) and the light API (02_light.js); uses PL_glyphs / PL_glyph (30_plates.js) and
// K_mouth (40_gecko.js) when they exist, with its own fallbacks (Big Shoulders Stencil 900 190 px, G.gecko + (40, −70)).
//
//   LX_under(t, L)  camera space, after the cloth and the lizard, BEFORE the plates:
//                   · the opening subtitle « J’ai payé / mon fournisseur. » (Satoshi 900 76 px, white, 8 px black
//                     outline, 2 lines over G.sub) with the incoming plate's shadow tightening on it (140 % → 100 %,
//                     blur 40 → 8, drifting in from the bulb side), crisp and still from t = 0 to T.slam;
//                   · its letters splashed out from under the steel at T.slam (closed-form arcs, bounces, spin; the top
//                     line fans out above the supplier's pill, the bottom line below the plate), then from T.amberForm
//                     they roll back in two hops under the rising steel, turning amber, and vanish into the amber plate
//                     by T.amberForm + .34 (a soft amber bloom where it forms);
//                   · the splash crowns and wet spots of the sweat drops.
//   LX_over(t, L)   camera space, AFTER the plates:
//                   · P, A, S: detach at T.letters[i] from their place on the steel, fall (they shrink towards the
//                     cloth), bounce, roll to SCORE.LETTER_REST[i] (one full tumble, ends upright), wait, and at
//                     T.gulps[i] are sucked into the lizard's mouth (K_mouth(t)) and shrink to nothing;
//                   · the dust puffs (slam, falls, proof, crush, stamp), spilling out of the seams just outside the plates' edges;
//                   · their landing puffs, the orange chips at each detach, the violet specks of the stamp,
//                     the sweat drops in the air, the amber spark of the « check » at T.clink.
//   LX_rewind(t)    screen space, T.rewind…T.rewindEnd: video grain specks, 2 tracking tears (never across a plate), a ◀◀ made of shapes.
//   LX_pas(i, t)    (sync/debug) state of the fallen letter i: {x, y, sc, rot, phase} or null.
// Every motion is a closed-form function of t (seconds): continuous, so motion-blur sub-frames interpolate cleanly.
// Determinism: rnd() with fixed seeds only. Cost (this Chromium, software canvas): ≤ 1.6 ms before the slam, 3–5 ms during
// the splash, ≈ 3.5 ms while P A S fall (PL_glyph included), ≈ 1.6 ms for the rewind overlay, ~0 the rest of the time.
// Perf notes: blurred plain rects are analytic here (≈ 0.3 ms) but blurred rrects cost ≈ 4 ms and rotated drawImage 3–6 ms;
// PL_glyph's own g.hot glow costs ≈ 26 ms a call, so it is not used (a cheap additive halo replaces it).
// =============================================================================================
const LX_ = (function () {
  const S = window.SCORE, G = S.G, T = S.T, TAU = Math.PI * 2;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => cl((t - a) / (b - a));
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const has = n => typeof window[n] === 'function';
  const AMBER = [255, 163, 26], AMBER_L = [255, 196, 92], WHITE = [255, 255, 255], CREAM = '#F4EBDA';

  // ---------- colour helpers ----------
  const rgbOf = s => { const m = s.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; };
  const rgba = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${cl(a).toFixed(3)})`;
  const mixC = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
  const litC = (hex, x, y, L, bias) => rgbOf(lit(hex, x, y, L, bias));

  /** blurred silhouette of whatever draw() fills, in the current transform (pushed shadow, rotation-safe; no ctx.filter) */
  function soft(draw, blur, color) {
    const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1, P = ctx.canvas.width + 400 + 8 * blur * sc, inv = m.inverse();
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -P; ctx.shadowOffsetY = 0;
    ctx.translate(inv.a * P, inv.b * P); ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; draw(); ctx.restore();
  }

  // =============================================================================================
  // 1. THE OPENING SUBTITLE
  // =============================================================================================
  const SUB = { px: 76, lh: 92, outline: 8, lines: ['J’ai payé', 'mon fournisseur.'] };
  let SUBL = null;
  function subLayout() {                       // per-glyph boxes (prefix measures: kerning kept), built once fonts are in
    if (SUBL) return SUBL;
    const f = `900 ${SUB.px}px Satoshi`, b0 = G.sub.y - 62, gl = [], lines = [];
    ctx.save(); ctx.font = f; ctx.letterSpacing = '0px';
    SUB.lines.forEach((s, li) => {
      const w = ctx.measureText(s).width, x0 = G.sub.x - w / 2, base = b0 + li * SUB.lh;
      lines.push({ s, x0, base, w });
      for (let j = 0; j < s.length; j++) {
        const ch = s[j]; if (ch === ' ') continue;
        const xl = x0 + ctx.measureText(s.slice(0, j)).width, cw = ctx.measureText(ch).width;
        gl.push({ ch, x: xl + cw / 2, y: base - SUB.px * .3, dy: SUB.px * .3, w: cw, li, k: gl.length });
      }
    });
    ctx.restore();
    SUBL = { f, gl, lines }; return SUBL;
  }

  /** the falling plate's shadow, from frame 0: large and soft, offset towards us, tightening and darkening
   *  (axis-aligned plain rects: Skia blurs them analytically, ≈ 0.3 ms; a blurred rrect costs ≈ 4 ms, a rotated sprite 3–6 ms) */
  function plateShadow(t, L, part) {
    const k = kk(t, T.shadow0 || 0, T.slam), e = k * k * (3 - 2 * k) * .35 + k * k * .65;     // accelerating approach
    const sc = mix(1.4, 1, e), blur = mix(40, 8, e), a = mix(.6, .92, Math.pow(k, 1.2));
    const off = mix(46, 0, e), sway = 10 * Math.sin(t * 4.2) * (1 - e);                              // the plate sways as it falls
    const w = 760 * sc, h = G.plateH.steel * sc, str = part === 'under' ? 1 : .1;
    ctx.save(); ctx.translate(G.sub.x + off * .25 + sway, G.sub.y + off);                              // axis-aligned: Skia's fast blurred-rrect path
    soft(() => ctx.fillRect(-w / 2, -h / 2, w, h), blur, `rgba(7,3,16,${(a * .62 * str).toFixed(3)})`);        // penumbra
    const w2 = w * mix(.8, .97, e), h2 = h * mix(.7, .94, e);
    soft(() => ctx.fillRect(-w2 / 2, -h2 / 2, w2, h2), blur * .55, `rgba(5,2,12,${(a * .55 * str).toFixed(3)})`);   // umbra
    ctx.restore();
  }

  function drawSubtitleRest(t, L) {
    const { f, lines } = subLayout();
    plateShadow(t, L, 'under');
    const crouch = 1 - .07 * sst(kk(t, T.slam - .12, T.slam));      // the words flinch as the steel arrives
    ctx.save(); ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.letterSpacing = '0px';
    if (crouch < 1) { const yb = lines[1].base; ctx.translate(0, yb); ctx.scale(1, crouch); ctx.translate(0, -yb); }
    // contact shadow on the cloth (lifts the caption off the busy wax pattern)
    soft(() => { ctx.lineWidth = 2 * SUB.outline; ctx.lineJoin = 'round'; for (const l of lines) { ctx.strokeText(l.s, l.x0 + 3, l.base + 7); ctx.fillText(l.s, l.x0 + 3, l.base + 7); } },
      5, 'rgba(4,2,10,.55)');
    ctx.lineWidth = 2 * SUB.outline; ctx.strokeStyle = '#000';
    for (const l of lines) ctx.strokeText(l.s, l.x0, l.base);
    ctx.fillStyle = '#fff';
    for (const l of lines) ctx.fillText(l.s, l.x0, l.base);
    ctx.restore();
    plateShadow(t, L, 'over');                                         // the shadow falls on the words too (lightly)
  }

  // ---------- the splash: letters squirt out from under the steel, bounce, and fly back into the amber plate ----------
  const GS = 11000, ES = .34, LIFT = .45;          // LIFT: share of the height shown as a screen offset (the rest reads as scale)
  let SPL = null;
  function splashParams() {
    if (SPL) return SPL;
    const { gl } = subLayout(), n = gl.length;
    SPL = gl.map((g, k) => {
      // where each letter ends up on the cloth: the short top line fans out above the plate, the bottom line below
      // it (clear of the supplier's pill) and off its ends — always outside the steel's footprint
      const r1 = R(k, 1), r2 = R(k, 2);
      let ex, ey;
      if (g.li === 0) { const u = cl((g.x - G.sub.x) / 250, -1, 1); ex = G.sub.x + u * 500 + (r1 - .5) * 40; ey = G.sub.y - 226 - 50 * (1 - Math.abs(u)) - (k % 2) * 62 - 24 * r2; }   // above the supplier's pill
      else {
        const u = cl((g.x - G.sub.x) / 300, -1, 1), side = Math.abs(u) > .8;
        ex = G.sub.x + u * (side ? 500 : 470) + (r1 - .5) * (side ? 40 : 34);           // zig-zag rows: no letter lands on another
        ey = side ? G.sub.y + 20 + 150 * r2 : G.sub.y + 212 + 36 * (1 - Math.abs(u)) + (k % 2) * 60 + 22 * r2;
      }
      return {
        g, ex: cl(ex, 60, 1020), ey: cl(ey, 660, 1560),
        vz: 1150 + 560 * R(k, 3), w: (R(k, 4) - .5) * 2 * 10, tau: .08 + .035 * R(k, 5),
        tr0: (T.amberForm) + .1 * k / Math.max(1, n - 1),
      };
    });
    return SPL;
  }
  function hop(vz, tau, g, e, nb) {           // bouncing height ≥ 0 (closed form, nb bounces)
    let v = vz;
    for (let b = 0; b <= nb; b++) { const d = 2 * v / g; if (tau < d) return v * tau - g * tau * tau / 2; tau -= d; v *= e; }
    return 0;
  }
  function splashFloor(sp, t) {
    const tau = Math.max(0, t - T.slam), p = 1 - Math.exp(-tau / sp.tau);
    const h = hop(sp.vz, tau, GS, ES, 2);
    return { g: sp.g, x: mix(sp.g.x, sp.ex, p), y: mix(sp.g.y, sp.ey, p), h, rot: sp.w * .2 * (1 - Math.exp(-tau / .2)), s: 1 + h * .0032, col: 0 };
  }
  function splashState(sp, t) {               // null when gone; .fly = drawn above the plates
    if (t < T.slam) return null;
    const tr1 = Math.min(sp.tr0 + .24, T.amberForm + .34);
    if (t < sp.tr0) return splashFloor(sp, t);
    if (t >= tr1) return null;
    const b = splashFloor(sp, sp.tr0), u = kk(t, sp.tr0, tr1), p = u * u * (3 - 2 * u);
    const tx = G.cx + (sp.g.x - G.sub.x) * .3, ty = G.amberY + 18 + (sp.g.li ? 8 : -8);
    const h = b.h * (1 - p) + 44 * Math.abs(Math.sin(TAU * p));                       // they roll back in two hops
    return { g: sp.g, x: mix(b.x, tx, p), y: mix(b.y, ty, p), h, rot: b.rot * (1 - p) + (tx - b.x) / 50 * p, s: (1 + h * .0032) * (1 - sst(kk(u, .55, 1))), col: sst(kk(u, .05, .55)), fly: 1 };
  }
  function drawSubGlyphs(list, L) {
    if (!list.length) return;
    const { f } = subLayout();
    ctx.save(); ctx.font = f; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.letterSpacing = '0px';
    const ow = 2 * SUB.outline;
    for (const q of list) {                                           // shadows on the cloth (sharper as they land)
      if (q.s < .05) continue;
      const a = .5 / (1 + q.h * .011), blur = 2.5 + q.h * .07, o = 5 + q.h * .1, ss = Math.max(.05, q.s * (1 - q.h * .0012));
      ctx.save(); ctx.translate(q.x + o * .25, q.y + o); ctx.rotate(q.rot); ctx.scale(ss, ss);
      soft(() => { ctx.lineWidth = ow; ctx.strokeText(q.g.ch, 0, q.g.dy); ctx.fillText(q.g.ch, 0, q.g.dy); }, blur, `rgba(5,2,12,${a.toFixed(3)})`);
      ctx.restore();
    }
    const tr = (q, d) => { ctx.save(); ctx.translate(q.x, q.y - q.h * LIFT); ctx.rotate(q.rot); ctx.scale(q.s, q.s); d(); ctx.restore(); };
    ctx.lineWidth = ow; ctx.strokeStyle = '#000';
    for (const q of list) if (q.s > .02) tr(q, () => ctx.strokeText(q.g.ch, 0, q.g.dy));
    for (const q of list) if (q.s > .02) { ctx.fillStyle = q.col > 0 ? rgba(mixC(WHITE, AMBER, q.col)) : '#fff'; tr(q, () => ctx.fillText(q.g.ch, 0, q.g.dy)); }
    ctx.restore();
  }

  // =============================================================================================
  // 2. P, A, S — detach, fall, bounce, roll to the lizard, wait, get swallowed
  // =============================================================================================
  const PASP = { g: 5200, pop: -260, e: .3, sF: .48, roll: .62, thick: 15 };   // pop < 0: knocked off downwards by the crack
  let SG = null;
  function steelBoxes() {                     // centres of P, A, S relative to the steel centre at s = 1
    if (SG) return SG;
    let res = null;
    if (has('PL_glyphs')) {
      try {
        const gs = (PL_glyphs('steel', 'PAS REÇU.') || []).filter(g => g && g.ch && g.ch.trim());
        if (gs.length >= 3 && isFinite(gs[0].x) && isFinite(gs[0].w)) {
          res = gs.slice(0, 3).map(g => {                           // accept centre or top-left boxes
            const tl = Math.abs(g.y + g.h / 2) < Math.abs(g.y);
            return { ch: g.ch, x: tl ? g.x + g.w / 2 : g.x, y: tl ? g.y + g.h / 2 : g.y, w: g.w, h: g.h, src: g };
          });
        }
      } catch (e) { res = null; }
    }
    if (!res) {                                                      // fallback: « PAS REÇU. » centred on the plate
      ctx.save(); ctx.font = '900 190px Stencil'; ctx.letterSpacing = '0px';
      const s = 'PAS REÇU.', x0 = -ctx.measureText(s).width / 2;
      res = [0, 1, 2].map(j => { const xl = x0 + ctx.measureText(s.slice(0, j)).width, w = ctx.measureText(s[j]).width; return { ch: s[j], x: xl + w / 2, y: 0, w, h: 152 }; });
      ctx.restore();
    }
    SG = res; return SG;
  }
  const PC = [];
  function pasConst(i) {
    if (PC[i]) return PC[i];
    const box = steelBoxes()[i], td = T.letters[i];
    const st = S.steel(td) || { x: G.cx, y: G.steelSusp, s: 1, sx: 1, sy: 1, rot: 0 };
    const rot0 = st.rot || 0, c = Math.cos(rot0), s = Math.sin(rot0), ksx = st.s * st.sx, ksy = st.s * st.sy;
    const X = st.x + c * box.x * ksx - s * box.y * ksy, Y = st.y + s * box.x * ksx + c * box.y * ksy;
    const sc0 = st.s * (st.sx + st.sy) / 2, rest = S.LETTER_REST[i], sF = PASP.sF;
    const shard = has('PL_glyph'), bw = box.w + (shard ? 22 : 0), bh = box.h + (shard ? 30 : 0);   // PL draws a jagged shard around the letter
    const hcf = (th, sc) => sc * (bw / 2 * Math.abs(Math.sin(th)) + bh / 2 * Math.abs(Math.cos(th)));   // centre height when standing on a corner
    const yFL = rest.y + bh * sF / 2;                                         // the floor line (letter base at rest)
    const h0 = Math.max(40, yFL - hcf(rot0, sc0) - Y), g = PASP.g, pop = PASP.pop;
    const t1 = (pop + Math.sqrt(pop * pop + 2 * g * h0)) / g;
    const v1 = PASP.e * (g * t1 - pop), d1 = 2 * v1 / g, v2 = PASP.e * v1, d2 = 2 * v2 / g;
    const xL = Math.min(rest.x + [130, 105, 80][i % 3], 452), w = [.85, .6, .75][i % 3];
    const tr = t1 + d1 + d2 + .08;
    PC[i] = { box, bw, bh, shard, X, Y, sc0, rot0, rest, sF, hcf, yFL, h0, g, pop, t1, v1, d1, v2, d2, xL, w, tr, th1: rot0 + w * t1 };
    return PC[i];
  }
  function pasPre(i, t) {                     // state without the gulp
    const tau = t - T.letters[i]; if (tau < 0) return null;
    const P = pasConst(i);
    let hA, x, rot, phase, pr = 0;
    if (tau < P.t1) { hA = P.h0 + P.pop * tau - P.g * tau * tau / 2; x = mix(P.X, P.xL, tau / P.t1); rot = P.rot0 + P.w * tau; phase = 'fall'; }
    else {
      const tb = tau - P.t1;
      if (tb < P.d1) hA = P.v1 * tb - P.g * tb * tb / 2;
      else if (tb < P.d1 + P.d2) { const q = tb - P.d1; hA = P.v2 * q - P.g * q * q / 2; }
      else hA = 0;
      pr = sst(kk(tau, P.tr, P.tr + PASP.roll));
      x = mix(P.xL + 16 * (1 - Math.exp(-tb / .15)), P.rest.x, pr);
      rot = P.th1 * Math.exp(-tb / .11) * Math.cos(tb * 16) * (1 - pr) - TAU * pr;   // rights itself, then one full tumble left
      phase = tau < P.tr ? 'bounce' : pr < 1 ? 'roll' : 'rest';
    }
    hA = Math.max(0, hA);
    const sc = (P.sF + (P.sc0 - P.sF) * cl(hA / P.h0, 0, 1.5)) * (1 + .1 * Math.sin(Math.PI * kk(tau, 0, .2)));   // jumps at us as it breaks off
    return { x, y: P.yFL - P.hcf(rot, sc) - hA, sc, rot, hA, fy: P.yFL, phase, sx: 1, sy: 1, P, hot: 1 - kk(tau, .05, .9) };
  }
  function mouth(t) {
    if (has('K_mouth')) { try { const m = K_mouth(t); if (m && isFinite(m.x) && isFinite(m.y)) return m; } catch (e) { /* fallback */ } }
    return { x: G.gecko.x + 40, y: G.gecko.y - 70 };
  }
  function pasState(i, t) {
    const tg = T.gulps[i], t0 = tg - .17, ta = tg + .03, tv = tg + .1;
    if (t >= tv) return null;
    if (t < t0) {
      const s = pasPre(i, t); if (!s) return null;
      for (let j = 0; j < i; j++) {                                 // the next ones flinch when one is eaten
        const d = t - T.gulps[j]; if (d > 0 && d < .5) { const a = Math.exp(-d * 7); s.rot += .1 * Math.sin(d * 34) * a; s.x += 5 * Math.sin(Math.PI * kk(d, 0, .25)); }
      }
      return s;
    }
    const o = pasPre(i, t0) || { x: S.LETTER_REST[i].x, y: S.LETTER_REST[i].y, sc: PASP.sF, rot: 0, fy: S.LETTER_REST[i].y, P: pasConst(i) };
    const m = mouth(t), u = kk(t, t0, ta), ant = kk(u, 0, .32), p = Math.pow(kk(u, .32, 1), 2.1), lift = 26 * 4 * p * (1 - p);
    const sq = Math.sin(Math.PI * p);
    let sc = o.sc * (1 - .5 * p);
    if (t > ta) sc *= 1 - kk(t, ta, tv);
    return {
      x: mix(o.x, m.x, p) + 7 * Math.sin(Math.PI * ant) * (1 - p), y: mix(o.y, m.y, p) - lift,
      sc, rot: .2 * Math.sin(Math.PI * ant) * (1 - p) - 1.15 * p, hA: lift, fy: mix(o.fy, m.y + 8, p), phase: 'gulp',
      sx: 1 + .32 * sq, sy: 1 - .16 * sq, P: o.P, hot: 0,
    };
  }

  /** a P, A or S: the cream painted letter cut out of the steel (extruded, steel edge) — or PL_glyph when available */
  function steelLetter(q, L) {
    const box = q.P.box, ch = box.ch;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(q.sc * q.sx, q.sc * q.sy);
    if (q.hot > .01) {                                               // the broken edges still glow: a cheap additive halo behind the shard
      const R0 = Math.max(q.P.bw, q.P.bh) * .62, hg = ctx.createRadialGradient(0, 0, R0 * .35, 0, 0, R0);
      hg.addColorStop(0, `rgba(255,96,24,${(.55 * q.hot).toFixed(3)})`); hg.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg; ctx.fillRect(-R0, -R0, 2 * R0, 2 * R0); ctx.restore();
    }
    if (has('PL_glyph')) { try { PL_glyph('steel', ch, { ...(box.src || box), L }); ctx.restore(); return; } catch (e) { /* fallback below */ } }   // (g.hot is not used: ~26 ms a call)
    // extrusion away from the bulb, expressed in the letter's local frame
    let ex = q.x - L.x, ey = q.y - 330; const n0 = Math.hypot(ex, ey) || 1; ex /= n0; ey /= n0;
    const c = Math.cos(-q.rot), s = Math.sin(-q.rot), lx = (c * ex - s * ey) * PASP.thick, ly = (s * ex + c * ey) * PASP.thick;
    ctx.font = '900 190px Stencil'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px'; ctx.lineJoin = 'round';
    const by = box.h / 2, N = 6;
    // dark contour around the whole solid (reads on the wax pattern)
    ctx.strokeStyle = 'rgba(10,6,22,.72)'; ctx.lineWidth = 12;
    ctx.strokeText(ch, lx, by + ly); ctx.strokeText(ch, 0, by);
    const side = litC('#6B7380', q.x, q.y, L, -.2), sideD = litC('#3B404B', q.x, q.y, L, -.6);
    for (let k = N; k >= 1; k--) { ctx.fillStyle = rgba(mixC(side, sideD, k / N)); ctx.fillText(ch, lx * k / N, by + ly * k / N); }
    const face = mixC(litC(CREAM, q.x, q.y, L, 1), hexRgb(CREAM), .5);
    const gr = ctx.createLinearGradient(0, -by, 0, by);
    gr.addColorStop(0, rgba(mixC(face, WHITE, .3))); gr.addColorStop(.55, rgba(face)); gr.addColorStop(1, rgba(mixC(face, [150, 120, 95], .18)));
    ctx.fillStyle = gr; ctx.fillText(ch, 0, by);
    ctx.strokeStyle = 'rgba(255,250,235,.55)'; ctx.lineWidth = 2.2;                    // bevel catch-light on the face edge
    ctx.save(); ctx.translate(-.8, -1.2); ctx.globalCompositeOperation = 'source-atop'; ctx.strokeText(ch, 0, by); ctx.restore();
    ctx.restore();
  }
  function steelLetterShadow(q, L) {
    const box = q.P.box, h = q.hA, a = (.62 / (1 + h * .01)) * cl(q.sc * 3), blur = 2 + h * .05;
    if (a < .01) return;
    // the glyph's shadow lies on the cloth under the letter (the floor line), sharpening as it lands
    const sc = q.P.sF * (q.phase === 'gulp' ? q.sc / q.P.sF : 1) * (1 + h * .0006);
    const fx = q.x + 6 + h * .03, fy = q.fy - q.P.bh * sc / 2 + 9;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(q.rot * cl(1 - h / 200)); ctx.scale(sc * q.sx, sc * q.sy);
    ctx.font = '900 190px Stencil'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (q.P.shard) soft(() => ctx.fillRect(-q.P.bw / 2, -box.h / 2 - 15, q.P.bw, q.P.bh), blur / sc, `rgba(6,3,14,${a.toFixed(3)})`);
    else soft(() => { ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.strokeText(box.ch, 0, box.h / 2); ctx.fillText(box.ch, 0, box.h / 2); }, blur / sc, `rgba(6,3,14,${a.toFixed(3)})`);
    ctx.restore();
  }

  // =============================================================================================
  // 3. DUST, SPARKS, SWEAT
  // =============================================================================================
  /** dust spilling from emitters [{x, y, nx, ny, s}] (outward normals), k 0..1 = life of the puff. Each particle is a
   *  baked cloud sprite (no rotation → cheap), warm under the bulb, cooler in the brand's violet light */
  let DS = null;
  function dustSprites() {
    if (DS) return DS;
    const mk = (seed, col) => {
      const N = 96, c = makeCanvas(N, N), g = c.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const x = N / 2 + (R(i, seed) - .5) * N * .34, y = N / 2 + (R(i, seed + 1) - .5) * N * .34, r = N * (.2 + .2 * R(i, seed + 2));
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${col},${(.3 + .3 * R(i, seed + 3)).toFixed(2)})`); rg.addColorStop(.6, `rgba(${col},${(.12 + .1 * R(i, seed + 4)).toFixed(2)})`); rg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, N, N);
      }
      return c;
    };
    DS = { warm: [0, 1, 2].map(k => mk(300 + k * 7, '238,216,180')), cool: [0, 1, 2].map(k => mk(400 + k * 7, '218,204,246')) };
    return DS;
  }
  function puffs(ems, k, L, o = {}) {
    if (k <= 0 || k >= 1) return;
    const grow = 1 - Math.pow(1 - k, 3.2), fade = Math.pow(1 - k, 1.4) * cl(k * 16);
    const out = o.out ?? 14, n = o.n || 6, seed = o.seed || 1, dist = o.dist || 90, size = o.size || 34, A = o.a ?? .6, spread = o.spread ?? .9, rise = o.rise ?? 30, tj = o.tj ?? 40;
    const D = dustSprites(), v = cl(L.violet || 0);
    let id = 0;
    ctx.save();
    for (const e of ems) {
      const nl = Math.hypot(e.nx, e.ny) || 1, nx = e.nx / nl, ny = e.ny / nl, base = Math.atan2(ny, nx), str = e.s ?? 1;
      for (let j = 0; j < n; j++, id++) {
        const r1 = R(id, seed), r2 = R(id, seed + 1), r3 = R(id, seed + 2), r4 = R(id, seed + 3), r5 = R(id, seed + 4);
        const a = base + (r1 - .5) * spread, d = dist * (.25 + .75 * r2) * str * grow, tg = (r5 - .5) * tj;
        const px = e.x + nx * out - ny * tg + Math.cos(a) * d, py = e.y + ny * out + nx * tg + Math.sin(a) * d * .75 - rise * grow * (.3 + .7 * r3);
        const rad = size * (.55 + 1.1 * grow) * (.65 + .55 * r3) * Math.sqrt(str);
        const lk = lightAt(px, py, L).k, al = A * fade * (.55 + .45 * r4) * (.45 + .55 * Math.min(1, lk * 1.5 + v));
        if (al < .01) continue;
        const q = id % 3;
        if (v < 1) { ctx.globalAlpha = al * (1 - v); ctx.drawImage(D.warm[q], px - rad, py - rad, 2 * rad, 2 * rad); }
        if (v > 0) { ctx.globalAlpha = al * v; ctx.drawImage(D.cool[q], px - rad, py - rad, 2 * rad, 2 * rad); }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';     // specks catching the bulb
    id = 0;
    for (const e of ems) {
      const nl = Math.hypot(e.nx, e.ny) || 1, nx = e.nx / nl, ny = e.ny / nl, base = Math.atan2(ny, nx), str = e.s ?? 1;
      for (let j = 0; j < n; j++, id++) {
        const r1 = R(id, seed + 9), r2 = R(id, seed + 10), r3 = R(id, seed + 11), r5 = R(id, seed + 12);
        const a = base + (r1 - .5) * spread * 1.3, d = dist * (.5 + .9 * r2) * str * grow, tg = (r5 - .5) * tj;
        const px = e.x + nx * out - ny * tg + Math.cos(a) * d, py = e.y + ny * out + nx * tg + Math.sin(a) * d * .7 - rise * 1.6 * grow * r3 + 30 * k * k;
        const tw = .55 + .45 * Math.sin(k * 26 + id * 2.3), al = .9 * fade * tw * (.35 + .65 * r3), sz = 1.5 + 1.8 * r2;
        ctx.fillStyle = rgba(litC(o.speck || '#FFE6BE', px, py, L, 1), al); ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.restore();
  }
  const amberHW = A => 350 * A.s * A.sx, amberHH = A => G.plateH.amber / 2 * A.s * A.sy;
  function dust(t, L) {                      // drawn above the plates (the dust is in the air, in front of their cast shadows), starting just outside their edges
    // the slam: dust squeezed out all around the steel's footprint
    { const k = kk(t, T.slam, T.slam + 1); if (k > 0 && k < 1) {
      const em = [], hw = 380, hh = G.plateH.steel / 2, cx = G.sub.x, cy = G.sub.y;
      for (let j = 0; j < 9; j++) { const x = cx - hw + 2 * hw * (j + .5) / 9; em.push({ x, y: cy - hh, nx: (x - cx) / hw * .5, ny: -1, s: .8 }, { x, y: cy + hh, nx: (x - cx) / hw * .5, ny: 1, s: .9 }); }
      for (const sd of [-1, 1]) { em.push({ x: cx + sd * hw, y: cy - hh * .5, nx: sd, ny: -.25, s: 1.35 }, { x: cx + sd * hw, y: cy + hh * .5, nx: sd, ny: .25, s: 1.35 }, { x: cx + sd * hw, y: cy, nx: sd, ny: 0, s: 1.5 }); }
      puffs(em, k, L, { n: 5, seed: 11, dist: 120, size: 40, a: .6, rise: 34, tj: 90, out: 28 });
    } }
    // each fall of the steel on the amber plate: dust from the seam's ends and from the amber's base
    T.falls.forEach((f, j) => {
      const k = kk(t, f, f + .75); if (k <= 0 || k >= 1) return;
      const A = S.amber(f + .001); if (!A) return;
      const hw = Math.min(amberHW(A), 380), y = A.y - amberHH(A), yb = A.y + amberHH(A);
      puffs([{ x: G.cx - hw, y, nx: -1, ny: -.35 }, { x: G.cx + hw, y, nx: 1, ny: -.35 },
        { x: G.cx - hw, y: yb, nx: -1, ny: .3, s: .7 }, { x: G.cx + hw, y: yb, nx: 1, ny: .3, s: .7 }], k, L, { n: 7, seed: 31 + j * 7, dist: 100, size: 32, a: .55, tj: 26 });
    });
    // « LA PREUVE ? » lands
    { const k = kk(t, T.proof, T.proof + .8); if (k > 0 && k < 1) {
      const P = S.proofPlate(T.proof + .001); if (P) { const yb = P.y + G.plateH.proof / 2;
        puffs([{ x: G.cx - 340, y: yb, nx: -1, ny: .25 }, { x: G.cx + 340, y: yb, nx: 1, ny: .25 }, { x: G.cx - 170, y: yb, nx: -.2, ny: 1, s: .7 }, { x: G.cx + 170, y: yb, nx: .2, ny: 1, s: .7 }],
          k, L, { n: 6, seed: 57, dist: 90, size: 30, a: .5, tj: 60 }); }
    } }
    // the crush: the amber plate is flattened, air and dust burst sideways
    { const tc = T.crush + .4, k = kk(t, tc - .06, tc + .9); if (k > 0 && k < 1) {
      const A = S.amber(tc); if (A) { const hw = amberHW(A);
        puffs([{ x: G.cx - hw, y: A.y, nx: -1, ny: -.1, s: 1.8 }, { x: G.cx + hw, y: A.y, nx: 1, ny: -.1, s: 1.8 },
          { x: G.cx - hw * .6, y: A.y + 20, nx: -.3, ny: 1, s: .7 }, { x: G.cx + hw * .6, y: A.y + 20, nx: .3, ny: 1, s: .7 }], k, L, { n: 8, seed: 71, dist: 130, size: 34, a: .7, spread: .7, tj: 20 }); }
    } }
    // the stamp: the receipt hits the steel from below, dust from the contact's ends
    { const k = kk(t, T.stamp, T.stamp + .8); if (k > 0 && k < 1) {
      const St = S.steel(T.stamp + .001); if (St) { const y = St.y + G.plateH.steel / 2 * St.sy;
        puffs([{ x: G.cx - 315, y, nx: -1, ny: .2, s: 1.1 }, { x: G.cx + 315, y, nx: 1, ny: .2, s: 1.1 }, { x: G.cx - 360, y: y - 30, nx: -1, ny: -.4, s: .8 }, { x: G.cx + 360, y: y - 30, nx: 1, ny: -.4, s: .8 }],
          k, L, { n: 6, seed: 91, dist: 100, size: 30, a: .5, tj: 40, speck: '#F0E6FF' }); }
    } }
  }

  // ---------- sweat: drops flicked off the amber plate during the awkward moment, squeezed out at the crush ----------
  let DROPS = null;
  function drops() {
    if (DROPS) return DROPS;
    const P = T.proof, C = T.crush, out = [];
    [[.6, -1, .44], [.9, 1, .4], [1.62, -1, .4], [2.02, 1, .42]].forEach(([dt, side, dur], j) => {   // #2 lands on the « plic » (T.proof + 1.3)
      const t0 = P + dt; if (t0 + dur < C - .02) out.push({ t0, side, dur, seed: j + 1, arc: 92, r: 11.5 });
    });
    [[.1, -1, .3], [.13, 1, .32], [.17, -1, .26], [.21, 1, .28]].forEach(([dt, side, dur], j) => out.push({ t0: C + dt, side, dur, seed: 11 + j, arc: 34, r: 8.5, sq: 1 }));
    for (const d of out) {
      const A = S.amber(d.t0); if (!A) { d.skip = 1; continue; }
      const hw = amberHW(A), hh = amberHH(A);
      if (d.sq) { d.x0 = A.x + d.side * hw * .97; d.y0 = A.y + (R(d.seed, 3) - .5) * hh; d.x1 = d.x0 + d.side * (80 + 70 * R(d.seed, 4)); d.y1 = A.y + 26 + 26 * R(d.seed, 5); }
      else { d.x0 = A.x + d.side * hw * (.7 + .16 * R(d.seed, 1)); d.y0 = A.y - hh * .55; d.x1 = A.x + d.side * (hw + 70 + 50 * R(d.seed, 2)); d.y1 = A.y + hh + 6 + 22 * R(d.seed, 6); }
    }
    DROPS = out.filter(d => !d.skip); return DROPS;
  }
  function dropShape(r) {
    ctx.beginPath(); ctx.moveTo(-r * 2.5, 0);
    ctx.bezierCurveTo(-r * 1.3, -r * .25, -r * .7, -r, 0, -r); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.bezierCurveTo(-r * .7, r, -r * 1.3, r * .25, -r * 2.5, 0); ctx.closePath();
  }
  function dropsAir(t, L) {
    for (const d of drops()) {
      const u = (t - d.t0) / d.dur; if (u <= 0 || u >= 1) continue;
      const x = mix(d.x0, d.x1, u), y = d.y0 + (d.y1 - d.y0) * u - d.arc * 4 * u * (1 - u);
      const vx = d.x1 - d.x0, vy = (d.y1 - d.y0) - d.arc * 4 * (1 - 2 * u), a = Math.atan2(vy, vx);
      const r = d.r * (1 + .2 * 4 * u * (1 - u)) * cl(u * 8), hi = litC('#FFF4E0', x, y, L, 1);
      ctx.save();
      ctx.translate(x + 5, y + 9); ctx.rotate(a); soft(() => { dropShape(r); ctx.fill(); }, 2.5, 'rgba(6,3,14,.35)'); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      dropShape(r);
      const g = ctx.createRadialGradient(r * .2, -r * .3, 0, 0, 0, r * 1.3);
      g.addColorStop(0, 'rgba(240,248,255,.85)'); g.addColorStop(.5, 'rgba(160,195,240,.55)'); g.addColorStop(1, 'rgba(30,40,100,.8)');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      ctx.rotate(-a); ctx.fillStyle = rgba(hi, .95); ctx.beginPath(); ctx.arc(-r * .28, -r * .38, r * .3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  function dropsGround(t, L) {                                    // splash crown + wet spot where each drop lands
    for (const d of drops()) {
      const tl = d.t0 + d.dur, s = t - tl; if (s < 0 || s > 1.8) continue;
      const fade = 1 - kk(s, .4, 1.8);
      ctx.save(); ctx.translate(d.x1, d.y1 + 2);
      const sp = .6 + .4 * eo(s * 8), rx = d.r * 1.7 * sp, ry = d.r * .75 * sp;
      ctx.fillStyle = `rgba(6,3,14,${(.5 * fade).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(litC('#CFE0FF', d.x1, d.y1, L, 1), .45 * fade); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = rgba(litC('#FFF4E0', d.x1, d.y1, L, 1), .8 * fade); ctx.beginPath(); ctx.ellipse(-rx * .35, -ry * .3, rx * .28, ry * .22, 0, 0, TAU); ctx.fill();
      if (s < .22) {                                              // crown: a ring and 5 droplets
        const k = s / .22, rr = d.r * (1 + 2.4 * eo(k));
        ctx.strokeStyle = `rgba(220,235,255,${(.6 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * .45, 0, 0, TAU); ctx.stroke();
        for (let j = 0; j < 5; j++) {
          const a = Math.PI + (j + .5) / 5 * Math.PI + (R(j, d.seed) - .5) * .4, dd = d.r * 3 * eo(k);
          ctx.fillStyle = `rgba(225,238,255,${(.85 * (1 - k)).toFixed(3)})`; ctx.beginPath();
          ctx.arc(Math.cos(a) * dd, Math.sin(a) * dd * .5 - 18 * 4 * k * (1 - k), 2.2, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ---------- small light effects ----------
  function star(x, y, lx, ly, a, core, glow) {                  // 4-point glint: long horizontal, short vertical rays
    if (a <= .01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(lx, ly) * .5);
    rg.addColorStop(0, rgba(glow, .55 * a)); rg.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(x - lx, y - lx, 2 * lx, 2 * lx);
    ctx.globalCompositeOperation = 'source-over';
    const ray = (dx, dy, len, w) => {
      const g = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
      g.addColorStop(0, rgba(glow, 0)); g.addColorStop(.35, rgba(glow, .8 * a)); g.addColorStop(.5, rgba(core, a)); g.addColorStop(.65, rgba(glow, .8 * a)); g.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(x - dx * len, y - dy * len); ctx.lineTo(x - dy * w, y + dx * w); ctx.lineTo(x + dx * len, y + dy * len); ctx.lineTo(x + dy * w, y - dx * w); ctx.closePath(); ctx.fill();
    };
    ray(1, 0, lx, 3.4); ray(0, 1, ly, 2.8);
    ctx.fillStyle = rgba(core, a); ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /** the « check »: REÇU ✓ touches J'AI PAYÉ. — a glint runs along the seam, two stars at its ends, amber embers */
  function clink(t, L) {
    const t0 = T.clink, k = kk(t, t0 - .03, t0 + .6); if (k <= 0 || k >= 1) return;
    const A = S.amber(t), St = S.steel(t); if (!A || !St) return;
    const y = St.y + G.plateH.steel / 2 * St.s * St.sy + 15;              // the visible contact: the steel's bottom edge (its thickness included)
    const hw = Math.min(amberHW(A), 370), run = eo(kk(t, t0 - .03, t0 + .15)), fade = 1 - sst(kk(t, t0 + .12, t0 + .55));
    ctx.save();
    const V = S.violetPlate(t);                                            // the pinned receipt sits in front: keep the glint behind it
    if (V && t >= T.settle) {
      ctx.beginPath(); ctx.rect(-200, -200, W + 400, H + 400);
      ctx.save(); ctx.translate(V.x, V.y); ctx.rotate(V.rot || 0); const rw = 330 * V.s, rh = 230 * V.s;
      ctx.moveTo(-rw, -rh); ctx.lineTo(-rw, rh); ctx.lineTo(rw, rh); ctx.lineTo(rw, -rh); ctx.closePath(); ctx.restore();
      ctx.clip('evenodd');
    }
    const half = hw * run;
    if (half > 2) {
      ctx.globalCompositeOperation = 'lighter';                            // warm bloom along the seam
      const lg = ctx.createLinearGradient(G.cx - half, 0, G.cx + half, 0);
      lg.addColorStop(0, rgba(AMBER, 0)); lg.addColorStop(.5, rgba(AMBER, .45 * fade)); lg.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = lg; ctx.fillRect(G.cx - half, y - 13, 2 * half, 26);
      ctx.globalCompositeOperation = 'source-over';                        // the hot gold line itself
      const lc = ctx.createLinearGradient(G.cx - half, 0, G.cx + half, 0);
      lc.addColorStop(0, rgba(AMBER, 0)); lc.addColorStop(.18, rgba(AMBER, .9 * fade)); lc.addColorStop(.5, rgba([255, 236, 190], fade));
      lc.addColorStop(.82, rgba(AMBER, .9 * fade)); lc.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = lc; ctx.fillRect(G.cx - half, y - 2.5, 2 * half, 5);
    }
    const c0 = 1 - kk(t, t0, t0 + .3);
    star(G.cx, y, 200 * eo(kk(t, t0 - .03, t0 + .06)), 48, c0 * cl((t - t0 + .03) * 20), [255, 244, 214], AMBER);
    const ke = kk(t, t0 + .1, t0 + .55);
    if (ke > 0 && ke < 1) for (const sd of [-1, 1]) {
      const ex = G.cx + sd * hw, ea = Math.sin(Math.PI * Math.min(1, ke * 1.6)) * (1 - ke * .5);
      star(ex, y, 64 + 30 * ke, 24, ea, [255, 244, 214], AMBER);
      for (let j = 0; j < 8; j++) {                                // embers popping off the corners
        const r1 = R(j, sd + 40), r2 = R(j, sd + 41), s = ke * .45, vx = sd * (140 + 260 * r1), vy = -(160 + 300 * r2);
        const px = ex + vx * s, py = y + vy * s + 1600 * s * s, al = (1 - ke) * (.7 + .3 * r2);
        ctx.fillStyle = rgba(j % 2 ? AMBER : [255, 226, 160], al); ctx.beginPath(); ctx.arc(px, py, 2 + 1.5 * r1, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  /** detach of a letter: orange chips from the crack + a breath of metal dust */
  function chips(t, L) {
    T.letters.forEach((td, i) => {
      const k = kk(t, td - .01, td + .38); if (k <= 0 || k >= 1) return;
      const P = pasConst(i), x0 = P.X, y0 = P.Y + P.box.h * P.sc0 * .45;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 9; j++) {
        const r1 = R(j, 60 + i), r2 = R(j, 70 + i), s = k * .38, vx = (r1 - .5) * 520, vy = -(80 + 260 * r2);
        const px = x0 + (r1 - .5) * P.box.w * .8 + vx * s, py = y0 + vy * s + 2600 * s * s, al = (1 - k) * (.55 + .45 * r2);
        ctx.fillStyle = rgba(j % 3 ? [255, 120, 50] : [255, 220, 170], al); ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      ctx.restore();
      puffs([{ x: x0, y: y0, nx: 0, ny: 1, s: .55 }], k, L, { n: 5, seed: 120 + i, dist: 60, size: 16, a: .35, rise: 10, tj: 30 });
    });
  }
  /** the stamp: a violet-white burst of specks from the impact point (middle of the steel's bottom edge) */
  function stampSpecks(t, L) {
    const k = kk(t, T.stamp - .01, T.stamp + .4); if (k <= 0 || k >= 1) return;
    const St = S.steel(T.stamp + .001); if (!St) return;
    const x0 = St.x, y0 = St.y + G.plateH.steel / 2 * St.sy;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ring = eo(k), ra = (1 - k) * .55;
    ctx.strokeStyle = rgba([196, 170, 255], ra); ctx.lineWidth = 3 * (1 - k) + .5;
    ctx.beginPath(); ctx.ellipse(x0, y0, 30 + 240 * ring, 10 + 60 * ring, 0, 0, TAU); ctx.stroke();
    for (let j = 0; j < 22; j++) {
      const r1 = R(j, 80), r2 = R(j, 81), a = Math.PI * (r1 - .5) * 1.8 + (j % 2 ? 0 : Math.PI), sp = 280 + 520 * r2, s = k * .4;
      const px = x0 + Math.cos(a) * sp * s, py = y0 + Math.sin(a) * sp * s * .5 + 900 * s * s, al = (1 - k) * (.5 + .5 * r2);
      ctx.fillStyle = rgba(j % 3 ? [205, 185, 255] : [255, 250, 255], al); ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    ctx.restore();
  }
  /** the amber pop where the splashed letters vanish into the forming plate */
  function amberPop(t) {
    const k = kk(t, T.amberForm + .2, T.amberForm + .5); if (k <= 0 || k >= 1) return;
    const a = Math.sin(Math.PI * k) * .3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(G.cx, G.amberY); ctx.scale(1.9, .62);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 170); rg.addColorStop(0, rgba(AMBER_L, a)); rg.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = rg; ctx.fillRect(-170, -170, 340, 340); ctx.restore();
  }
  function landingPuffs(t, L) {
    for (let i = 0; i < 3; i++) {
      if (t < T.letters[i]) continue;
      const P = pasConst(i);
      [[P.t1, 1], [P.t1 + P.d1, .55]].forEach(([dt, s], j) => {
        const te = T.letters[i] + dt, k = kk(t, te, te + .5); if (k <= 0 || k >= 1) return;
        const q = pasPre(i, te); if (!q) return;
        puffs([{ x: q.x - 16, y: P.yFL, nx: -1, ny: .1, s }, { x: q.x + 16, y: P.yFL, nx: 1, ny: .1, s }], k, L, { n: 5, seed: 140 + i * 3 + j, dist: 46, size: 15, a: .5, rise: 12, tj: 16, out: 2 });
      });
    }
  }

  // =============================================================================================
  // 4. PUBLIC DRAWS
  // =============================================================================================
  function under(t, L) {
    dropsGround(t, L);
    if (t < T.slam) { drawSubtitleRest(t, L); return; }
    if (t < T.amberForm + .4) { drawSubGlyphs(splashParams().map(sp => splashState(sp, t)).filter(Boolean), L); amberPop(t); }
  }
  function over(t, L) {
    dust(t, L);
    if (t >= T.proof && t < T.crush + .6) dropsAir(t, L);
    if (t >= T.stamp - .02 && t < T.stamp + .5) stampSpecks(t, L);
    if (t >= T.letters[0] - .02) {
      chips(t, L);
      const qs = [0, 1, 2].map(i => pasState(i, t));
      qs.forEach(q => { if (q && q.sc > .01) steelLetterShadow(q, L); });
      landingPuffs(t, L);
      // draw the ones higher on screen first (further back), the falling one last
      [0, 1, 2].filter(i => qs[i] && qs[i].sc > .01).sort((a, b) => (qs[a].phase === 'fall') - (qs[b].phase === 'fall') || qs[a].fy - qs[b].fy).forEach(i => steelLetter(qs[i], L));
    }
    if (t >= T.clink - .05 && t < T.clink + .65) clink(t, L);
  }

  // ---------- the tape rewind (screen space) ----------
  let RW = null;
  function rewind(t) {
    const a = T.rewind, b = T.rewindEnd; if (t < a - .03 || t > b + .03) return;
    const e = Math.min(sst(kk(t, a - .03, a + .08)), 1 - sst(kk(t, b - .12, b + .03))); if (e <= .001) return;
    const n = Math.round(t * 30), tt = t - a, dur = Math.max(.1, b - a);
    if (!RW) RW = { strip: makeCanvas(W, 32) };
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    // two tracking tears: a strip of the picture slips sideways, with noise in it. They roll through the night above
    // the cloth and below the plates only (y 140→560 and 1430→1880): no plate text is ever torn
    const sg = RW.strip.getContext('2d');
    for (let j = 0; j < 2; j++) {
      const hh = [22, 16][j], yy = Math.round(mix([140, 1430][j], [560, 1880][j], cl(tt / dur))), dx = [12, -9][j] * e;
      sg.clearRect(0, 0, W, 32); sg.drawImage(ctx.canvas, 0, yy, W, hh, 0, 0, W, hh);
      ctx.globalAlpha = 1; ctx.drawImage(RW.strip, 0, 0, W, hh, dx, yy, W, hh);
      ctx.fillStyle = `rgba(255,255,255,${(.22 * e).toFixed(3)})`; ctx.fillRect(0, yy, W, 1.5);
      ctx.fillStyle = `rgba(0,0,0,${(.25 * e).toFixed(3)})`; ctx.fillRect(0, yy + hh, W, 2);
      for (let q = 0; q < 34; q++) {
        const r1 = rnd(n * 31.7 + q * 7.3 + j * 101), r2 = rnd(n * 13.1 + q * 3.9 + j * 57), r3 = rnd(n * 5.3 + q * 11.1 + j * 23);
        ctx.fillStyle = `rgba(255,255,255,${((.18 + .45 * r2) * e).toFixed(3)})`; ctx.fillRect(r1 * W, yy + r3 * hh, 14 + 90 * r2, 1.4);
      }
    }
    // light video grain: specks that change every frame (frame-locked, so motion-blur sub-frames agree)
    for (let q = 0; q < 700; q++) {
      const r1 = rnd(n * 17.3 + q * 1.37), r2 = rnd(n * 5.9 + q * 2.71), r3 = rnd(n * 9.1 + q * .53);
      ctx.fillStyle = q & 1 ? `rgba(255,255,255,${(.16 + .22 * r3) * e})` : `rgba(0,0,0,${(.2 + .25 * r3) * e})`;
      ctx.fillRect(r1 * W, r2 * H, 1.5 + r3 * 1.5, 1.5 + r3);
    }
    // ◀◀ (shapes, not a font glyph), top-left, with a soft shadow and a hint of chroma bleed
    const gx = 92, gy = 318, tw = 40, th = 25, blink = .85 + .15 * Math.cos(tt * 18);
    const tri = (x, dx) => { ctx.moveTo(x + dx, gy); ctx.lineTo(x + tw + dx, gy - th); ctx.lineTo(x + tw + dx, gy + th); ctx.closePath(); };
    const both = dx => { ctx.beginPath(); tri(gx, dx); tri(gx + tw - 4, dx); };
    ctx.globalAlpha = e;
    soft(() => { both(0); ctx.fill(); }, 8, 'rgba(0,0,0,.55)');
    ctx.globalAlpha = e * .55 * blink;
    ctx.fillStyle = 'rgba(255,60,90,1)'; both(-3); ctx.fill();
    ctx.fillStyle = 'rgba(60,220,255,1)'; both(3); ctx.fill();
    ctx.globalAlpha = e * blink; ctx.fillStyle = '#FFFFFF'; both(0); ctx.fill();
    ctx.restore();
  }

  return { under, over, rewind, pasState, subLayout, steelBoxes };
})();
function LX_under(t, L) { LX_.under(t, L); }
function LX_over(t, L) { LX_.over(t, L); }
function LX_rewind(t) { LX_.rewind(t); }
function LX_pas(i, t) { const q = LX_.pasState(i, t); return q && { x: q.x, y: q.y, sc: q.sc, rot: q.rot, phase: q.phase }; }
