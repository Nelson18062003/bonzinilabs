'use strict';
// =============================================================================================
// M1 « the order & the meme » · 32_plates.js — the three text plates of « C'EST PAS ÇA. » and their effects.
//
//   OM_plate(kind, P, t, L)  P = an entry of SCORE.plates(t) (back to front: order, steel, amber). Centre (P.x, P.y);
//                            translate, rotate P.rot, scale P.s·P.sx, P.s·P.sy; P.z = height above the cloth (cast shadow).
//     amber  TOI's satin amber slab, « C'EST PAS ÇA ! » (Satoshi 900, dark-brown letterpress): crushes the subtitle,
//            trembles and sweats while the steel speaks (P.shake, P.sweat), comes back for the key moment: three glowing
//            cracks from the bottom edge through P, A, S (one per tap, A.taps), P A S gone (P.lost, M2 flies them), « C'EST »
//            and « ÇA » spring together (P.recentre, overshoot), the « ! » fades (P.bang) as a letterpress ✓ is stamped
//            (P.tick) → « C'EST ÇA ✓ ».
//     steel  the supplier's brushed-steel plate, 4 dome rivets, cream stencil paint « IL A FAIT CE QUE / TU AS ÉCRIT. » (v2: the words of N1):
//            lands calmly (no crack, no crush).
//     order  TOI's thin amber card « SACS NOIRS. / BONNE QUALITÉ. / COMME LA PHOTO. »: drawn in strips so it bends
//            under its own weight (P.sag: the ends droop, overshoot then settle); « BONNE QUALITÉ. » (P.soggyLine) goes
//            soggy like wet cardboard (P.soggy 0..1: a spreading wet stain, ink bleeding, the line sags, wrinkles and
//            flattens into a crêpe — still readable half-way), drips run down the card.
//   OM_glyphs(txt)           → [{ch, i, x, y, w, h, size, font, baseline}] one box per character of the amber text,
//                            relative to the plate centre at s = 1 (x, y = box centre; w = advance; h = cap height).
//   OM_glyph(ch, box, L)     draws one glyph of the amber material (a small satin amber tile + the dark letter) centred
//                            on its box centre at (0, 0). box from OM_glyphs (best); L optional (light at box.L or L).
//   OM_fx(t, L)              world, after everything: the « pouf » of frame 0 (kraft dust, torn tape shreds), dust spilling
//                            from under the amber plate at the slam, a breath under the steel, the card's flop, sweat
//                            drops falling off the amber slab, the soggy line's drips on the cloth, sparks at each tap,
//                            amber chips at each detach, a stamp ring at the ✓.
// Light: 02_light.js morning (sun from the door, upper left): every face is multiplied by a gradient of lightAt() taken
// ACROSS the sunbeam, so the beam's soft edge lies across a plate; long soft shadows down-right (shadowOff); a warm rim on
// the door side. Materials are cached sprites at 1.5×; the text is drawn live (crisp at any camera scale). Deterministic
// (rnd), no ctx.filter. Anchors: only SCORE.A / SCORE.G / the state passed in. Static plates go through OM_cached
// (30_meme.js). Cost (flushed, steady state): amber/steel/card at rest ≈ 2.5–3 ms each (cached), the amber slab live
// (sweat, key moment) ≈ 5–8 ms, steel + sweating amber ≈ 8 ms, the soggy card ≈ 15 ms (re-composed each frame).
// =============================================================================================
const OM_PL = (function () {
  const S = window.SCORE, G = S.G, A = S.A;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const mixC = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const rgb = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${a})`;
  const mulC = (c, tn) => [c[0] * tn[0], c[1] * tn[1], c[2] * tn[2]];
  const SS = 1.5;
  const SPEC = {
    amber: { mat: 'amber', W: G.plateW.amber, H: G.plateH.amber, R: 34, depth: 24, bevel: 17, fam: 'Satoshi', size: 112, maxText: 744, nudge: 6, seed: 5 },
    steel: { mat: 'steel', W: G.plateW.steel, H: G.plateH.steel, R: 14, depth: 18, bevel: 11, rivet: 30, rr: 10.5, fam: 'Stencil', size: 122, maxText: 640, lh: 112, seed: 3 },
    order: { mat: 'card', W: G.plateW.order, H: G.plateH.order, R: 9, depth: 5, fam: 'Satoshi', size: 84, maxText: 764, lh: 102, seed: 9 },
  };
  const BROWN = [42, 22, 6], CREAM = [246, 238, 222], INKC = [52, 26, 6];
  const SH = '6,4,18';                                          // shadow colour on the navy wax (cool, deep)
  const BN = { x: -.327, y: .945 };                             // normal of the sunbeam (02_light.js SUN axis), pointing down-left

  // ------------------------------------------------------------------ measuring
  let MC = null;
  const mctx = () => MC || (MC = makeCanvas(8, 8).getContext('2d'));
  function mw(font, s) { const g = mctx(); g.font = font; g.letterSpacing = '0px'; return g.measureText(s).width; }
  function capOf(font) { const g = mctx(); g.font = font; return g.measureText('H').actualBoundingBoxAscent; }

  // ------------------------------------------------------------------ light
  /** multiply tint (0..1) of the morning light at a world point: warm in the beam, a touch cool in the shade; violet = brand */
  function tintQ(q) {
    const I = .66 + .34 * q.k, s = q.s;
    let r = I, g = I * (.972 - .004 * s), b = I * (.95 - .085 * s + .04 * (1 - q.k));
    const vv = q.v * .42; r += (.86 * I - r) * vv; g += (.78 * I - g) * vv; b += (1.0 * I - b) * vv;
    return [Math.min(1, r), Math.min(1, g), Math.min(1, b)];
  }
  const tintAt = (x, y, L) => tintQ(lightAt(x, y, L));
  /** the letters/paint: brighter, the violet only grazes them (they must stay readable) */
  function inkTint(x, y, L) { const q = lightAt(x, y, L), tn = tintQ({ k: Math.min(1, q.k * 1.3), s: q.s, v: q.v * .3 }); return [.32 + .68 * tn[0], .32 + .68 * tn[1], .3 + .68 * tn[2]]; }
  /** world offset (dx, dy) from the plate centre → plate-local */
  function toLocal(P, dx, dy) { const c = Math.cos(P.rot), s = Math.sin(P.rot); return { x: (dx * c + dy * s) / P.sxx, y: (-dx * s + dy * c) / P.syy }; }
  /** one multiply over the face with a 3-stop gradient of the light taken across the sunbeam (its soft edge lies across the plate) */
  function lightPass(path, P, L, span) {
    const t0 = tintAt(P.x - BN.x * span, P.y - BN.y * span, L), t1 = tintAt(P.x, P.y, L), t2 = tintAt(P.x + BN.x * span, P.y + BN.y * span, L);
    const a = toLocal(P, -BN.x * span, -BN.y * span), b = toLocal(P, BN.x * span, BN.y * span);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, rgb(mulC([255, 255, 255], t0))); g.addColorStop(.5, rgb(mulC([255, 255, 255], t1))); g.addColorStop(1, rgb(mulC([255, 255, 255], t2)));
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; path(); ctx.fill(); ctx.restore();
  }
  /** warm grazing sheen of the sun on the door side (upper left) of a face, 'screen' */
  function sunSheen(path, W, H, q, amt) {
    const a = amt * (.25 + .75 * q.s) * (1 - .6 * q.v); if (a <= .01) return;
    ctx.save(); path(); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    ctx.translate(-W * .3, -H * .55); ctx.scale(1, .42);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, W * .62);
    rg.addColorStop(0, `rgba(255,236,196,${(.32 * a).toFixed(3)})`); rg.addColorStop(.5, `rgba(255,226,180,${(.1 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,226,180,0)');
    ctx.fillStyle = rg; ctx.fillRect(-W, -W, 2 * W, 2 * W); ctx.restore();
  }
  function apply(P, ox = 0, oy = 0) { ctx.translate(P.x + ox, P.y + oy); if (P.rot) ctx.rotate(P.rot); ctx.scale(P.sxx, P.syy); }
  function devScale() { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }

  // ------------------------------------------------------------------ procedural textures (built once)
  function brushed(w, h, seed) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    const N1 = new Float32Array(4096); for (let i = 0; i < 4096; i++) N1[i] = rnd(seed * 11.31 + i * .917);
    const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = N1[i & 4095]; return a + (N1[(i + 1) & 4095] - a) * u; };
    const rowA = new Float32Array(h), rowP = new Float32Array(h), rowF = new Float32Array(h);
    for (let y = 0; y < h; y++) { rowA[y] = rnd(seed + y * 1.7311) - .5; rowP[y] = rnd(seed * 3.1 + y * 7.17) * 3000; rowF[y] = .006 + rnd(seed + y * 3.37) * .03; }
    for (let y = 0; y < h; y++) {
      const ra = rowA[y] * .55 + (rowA[y - 1] || 0) * .25 + (rowA[y + 1] || 0) * .2, band = (vn(y * .045 + seed * 5) - .5) * 22;
      for (let x = 0; x < w; x++) {
        const v = 128 + band + ra * 30 + (vn(x * rowF[y] + rowP[y]) - .5) * 34 + (rnd(x * 1.31 + y * 91.7 + seed) - .5) * 16;
        const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0); return c;
  }
  function noise(w, h, seed, amp) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    for (let i = 0; i < w * h; i++) { const v = 128 + (rnd(i * .713 + seed) - .5) * amp; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); return c;
  }
  /** a sprite canvas for a W×H face (pad around), drawing in face-centred coords at SS */
  function faceCanvas(W, H, pad, fn) {
    const c = makeCanvas(Math.ceil((W + 2 * pad) * SS), Math.ceil((H + 2 * pad) * SS)), g = c.getContext('2d');
    g.scale(SS, SS); g.translate(W / 2 + pad, H / 2 + pad); fn(g); c._pad = pad; return c;
  }
  const blit = (c, W, H) => ctx.drawImage(c, -W / 2 - c._pad, -H / 2 - c._pad, W + 2 * c._pad, H + 2 * c._pad);

  // ------------------------------------------------------------------ AMBER: face sprite
  const SPR = {};
  function amberFace() {
    if (SPR.amber) return SPR.amber;
    const sp = SPEC.amber, W = sp.W, H = sp.H, Rr = sp.R, b = sp.bevel;
    return (SPR.amber = faceCanvas(W, H, 6, g => {
      g.save(); rrectOn(g, -W / 2, -H / 2, W, H, Rr); g.clip();
      const lg = g.createLinearGradient(0, -H / 2, 0, H / 2); lg.addColorStop(0, '#FFBD48'); lg.addColorStop(.5, '#FFA823'); lg.addColorStop(1, '#F2900E');
      g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = .22;                       // orange-peel of thick paint
      g.drawImage(noise(Math.ceil(W * SS / 2), Math.ceil(H * SS / 2), sp.seed, 60), -W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.save(); g.translate(-W * .1, -H * .28); g.scale(1, .32);                         // satin: soft sheen high, darker belly low
      let rg = g.createRadialGradient(0, 0, 0, 0, 0, W * .62); rg.addColorStop(0, 'rgba(255,248,226,.32)'); rg.addColorStop(.55, 'rgba(255,242,210,.11)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = rg; g.fillRect(-W, -W, 2 * W, 2 * W); g.restore();
      const bl = g.createLinearGradient(0, 0, 0, H / 2); bl.addColorStop(0, 'rgba(140,50,0,0)'); bl.addColorStop(1, 'rgba(140,50,0,.15)'); g.fillStyle = bl; g.fillRect(-W / 2, 0, W, H / 2);
      const ve = g.createRadialGradient(0, -H * .1, H * .45, 0, -H * .1, W * .62); ve.addColorStop(0, 'rgba(120,40,0,0)'); ve.addColorStop(1, 'rgba(120,40,0,.2)'); g.fillStyle = ve; g.fillRect(-W / 2, -H / 2, W, H);
      // pillowed edge: the paint rolls over the rim (light on the door side: top + left; shade bottom + right)
      const vg = (a1, a2) => { const q = g.createLinearGradient(0, -H / 2, 0, H / 2); q.addColorStop(0, `rgba(255,250,228,${a1})`); q.addColorStop(.42, 'rgba(255,250,228,0)'); q.addColorStop(.58, 'rgba(110,40,0,0)'); q.addColorStop(1, `rgba(110,40,0,${a2})`); return q; };
      const hg = (a1, a2) => { const q = g.createLinearGradient(-W / 2, 0, W / 2, 0); q.addColorStop(0, `rgba(255,248,224,${a1})`); q.addColorStop(.1, 'rgba(255,248,224,0)'); q.addColorStop(.9, 'rgba(110,40,0,0)'); q.addColorStop(1, `rgba(110,40,0,${a2})`); return q; };
      for (let i = 0; i < b; i++) {
        const f = Math.pow(1 - i / b, 1.7);
        g.lineWidth = 1.25; rrectOn(g, -W / 2 + i + .5, -H / 2 + i + .5, W - 2 * i - 1, H - 2 * i - 1, Math.max(2, Rr - i));
        g.strokeStyle = vg(.62 * f, .5 * f); g.stroke(); g.strokeStyle = hg(.26 * f, .26 * f); g.stroke();
      }
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,252,236,.75)'; g.beginPath(); g.moveTo(-W / 2 + Rr, -H / 2 + 1.2); g.lineTo(W / 2 - Rr, -H / 2 + 1.2); g.stroke();
      g.restore();
    }));
  }

  // ------------------------------------------------------------------ AMBER: text layout + the final « C'EST ÇA ✓ »
  const LAY = {};
  function amberLayout(txt) {
    if (LAY[txt]) return LAY[txt];
    const sp = SPEC.amber, fontAt = z => `900 ${z.toFixed(2)}px Satoshi`;
    const adv = z => {
      const f = fontAt(z), out = [];
      for (let i = 0; i < txt.length; i++) {
        const c = txt[i], n = txt[i + 1];
        let a = n ? mw(f, c + n) - mw(f, n) : mw(f, c);           // advance incl. kerning with the next glyph
        if (c === ' ' && (n === '!' || n === '?')) a *= .55;      // French thin space before ! ?
        if (n) a -= .01 * z;                                       // a hair tighter: a slab of type
        out.push(a);
      }
      return out;
    };
    let size = sp.size, Ad = adv(size), w = Ad.reduce((p, q) => p + q, 0);
    if (w > sp.maxText) { size = size * sp.maxText / w; Ad = adv(size); w = Ad.reduce((p, q) => p + q, 0); }
    const font = fontAt(size), capH = capOf(font), base = capH / 2 + sp.nudge * size / sp.size;
    let x = -w / 2; const gl = [];
    for (let i = 0; i < txt.length; i++) { gl.push({ ch: txt[i], i, x0: x, adv: Ad[i], cx: x + Ad[i] / 2 }); x += Ad[i]; }
    // the final « C'EST ÇA ✓ » (P, A, S and the « ! » gone; « C'EST » and « ÇA » centred, a ✓ the width of a cap after)
    let fin = null;
    if (txt === S.plateText('amber')) {
      const keep = [0, 1, 2, 3, 4, 10, 11], sp1 = mw(font, ' ') * .95, tickW = capH * 1.02, gapT = capH * .42;
      const wk = keep.reduce((q, i) => q + gl[i].adv, 0) + sp1 + gapT + tickW; let fx = -wk / 2; const x0 = {};
      keep.forEach((i, j) => { x0[i] = fx; fx += gl[i].adv; if (j === 4) fx += sp1; });
      fin = { x0, tick: { x: fx + gapT, w: tickW, h: capH * 1.04 } };
    }
    return (LAY[txt] = { size, font, capH, base, w, gl, fin });
  }

  // ------------------------------------------------------------------ AMBER: cracks (one per tap, from the bottom edge through P, A, S)
  function jag(ways, seed, amp, seg = 9) {
    const pts = [ways[0].slice()];
    for (let i = 1; i < ways.length; i++) {
      const [ax, ay] = ways[i - 1], [bx, by] = ways[i], Lg = Math.hypot(bx - ax, by - ay) || 1, n = Math.max(1, Math.round(Lg / seg)), nx = -(by - ay) / Lg, ny = (bx - ax) / Lg;
      for (let k = 1; k <= n; k++) { const f = k / n, j = k === n ? 0 : (rnd(seed + i * 31.7 + k * 7.31) - .5) * 2 * amp; pts.push([ax + (bx - ax) * f + nx * j, ay + (by - ay) * f + ny * j]); }
    }
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1], seed };
  }
  let CRK = null;
  function crackData() {
    if (CRK) return CRK;
    const sp = SPEC.amber, lo = amberLayout(S.plateText('amber')), H = sp.H, top = lo.base - lo.capH;
    CRK = [0, 1, 2].map(c => {
      const g = lo.gl[6 + c], x = g.cx, wv = g.adv;
      const main = jag([[x + (c - 1) * 10, H / 2], [x - wv * .12, lo.base + 14], [x + wv * .14, lo.base - lo.capH * .3], [x - wv * .1, lo.base - lo.capH * .66], [x + wv * .06, top - 10], [x + wv * .2, -H / 2 + 14]], 211 + c * 19, 3.2, 8);
      const br = (f, ang, l, sd) => {
        const k = Math.max(1, main.cum.findIndex(q => q >= f * main.len)), p = main.pts[k], q = main.pts[k - 1], a = Math.atan2(p[1] - q[1], p[0] - q[0]) + ang;
        return { ...jag([p, [p[0] + Math.cos(a) * l * .55 + 2, p[1] + Math.sin(a) * l * .55], [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]], sd, 2.2, 7), at: f };
      };
      return { main: { ...main, w0: 11, w1: 3.2 }, branches: [{ ...br(.22, .95, 34, 501 + c), w0: 5, w1: 1.3 }, { ...br(.5, -1.0, 28, 521 + c), w0: 4.5, w1: 1.2 }, { ...br(.78, .85, 22, 541 + c), w0: 4, w1: 1.1 }] };
    });
    return CRK;
  }
  /** tapered ribbon along crack c up to length Lp (adds a closed sub-path); returns the tip */
  function ribbon(c, Lp, k = 1, grow = 0) {
    const { pts, cum } = c; if (Lp <= .5) return null;
    const Lf = [], Rt = []; let tip = null;
    for (let i = 0; i < pts.length; i++) {
      let p = pts[i], sv = cum[i];
      if (sv >= Lp) { const f = i ? (Lp - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1) : 0; p = i ? [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f] : p; sv = Lp; }
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = (c.w0 + (c.w1 - c.w0) * sv / c.len) * (.7 + .6 * rnd(i * 3.71 + c.seed)) * .5 * k * Math.min(1, .15 + (Lp - sv) / 20) + grow;
      Lf.push([p[0] - dy * w, p[1] + dx * w]); Rt.push([p[0] + dy * w, p[1] - dx * w]);
      if (sv >= Lp) { tip = p; break; }
    }
    ctx.moveTo(Lf[0][0], Lf[0][1]); for (const q of Lf) ctx.lineTo(q[0], q[1]); for (let i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]); ctx.closePath();
    return tip || pts[pts.length - 1];
  }
  /** progress of crack c at t (0..1): it runs up fast on its tap */
  const crackProg = (c, t) => 1 - Math.pow(1 - kk(t, A.taps[c] - .015, A.taps[c] + .17), 2.2);
  function crackPath(c, p, k = 1, grow = 0) {
    const D = crackData()[c], tips = [];
    const tp = ribbon(D.main, p * D.main.len, k, grow); if (tp && p < 1) tips.push(tp);
    for (const b of D.branches) { const bp = cl((p - b.at) / .3); if (bp > 0) ribbon(b, bp * b.len, k, grow); }
    return tips;
  }
  function drawCracks(P, t, H) {
    for (let c = 0; c < 3; c++) {
      if ((P.cracks || 0) <= c && t < A.taps[c]) continue;
      const p = crackProg(c, t); if (p <= 0) continue;
      const gone = kk(t, A.letters[c], A.letters[c] + .22), vis = 1 - gone; if (vis <= .01) continue;
      const heat = (1 - .45 * kk(t, A.taps[c] + .15, A.taps[c] + .9)) * (.94 + .06 * Math.sin(t * 23 + c)) * vis;
      ctx.save(); ctx.globalAlpha *= vis;
      ctx.beginPath(); ctx.translate(0, 1.8); crackPath(c, p, 1, .7); ctx.translate(0, -1.8); ctx.fillStyle = 'rgba(255,236,190,.42)'; ctx.fill();   // lit lower lip
      ctx.beginPath(); crackPath(c, p, 1); ctx.fillStyle = 'rgba(46,16,0,.95)'; ctx.fill();                                                          // the gash
      ctx.globalCompositeOperation = 'lighter';                                                                                                         // warm light from inside
      for (const [gw, a] of [[8, .09], [4.5, .14], [2, .2]]) { ctx.beginPath(); crackPath(c, p, 1, gw); ctx.fillStyle = `rgba(255,150,30,${(a * heat).toFixed(3)})`; ctx.fill(); }
      ctx.beginPath(); crackPath(c, p, .5); ctx.fillStyle = `rgba(255,190,70,${(.9 * heat).toFixed(3)})`; ctx.fill();
      ctx.beginPath(); const tips = crackPath(c, p, .2); ctx.fillStyle = `rgba(255,246,200,${(.95 * heat).toFixed(3)})`; ctx.fill();
      for (const q of tips) { const rg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 18); rg.addColorStop(0, `rgba(255,248,220,${heat})`); rg.addColorStop(.35, `rgba(255,160,50,${.55 * heat})`); rg.addColorStop(1, 'rgba(255,120,20,0)'); ctx.fillStyle = rg; ctx.fillRect(q[0] - 18, q[1] - 18, 36, 36); }
      // the impact dent where the sample hit, under the bottom edge
      const D = crackData()[c].main.pts[0], dg = ctx.createRadialGradient(D[0], H / 2, 0, D[0], H / 2, 30);
      ctx.globalCompositeOperation = 'source-over'; dg.addColorStop(0, `rgba(60,20,0,${(.5 * vis).toFixed(3)})`); dg.addColorStop(1, 'rgba(60,20,0,0)'); ctx.fillStyle = dg; ctx.fillRect(D[0] - 30, H / 2 - 30, 60, 30);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ AMBER: sweat beads
  function drop(x, y, r, e, a) {
    if (r < .6 || a <= .01) return;
    ctx.save(); ctx.globalAlpha *= a;
    const tip = y - r * (1 + e * 1.1);
    const shape = (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox, tip + oy); ctx.bezierCurveTo(x + ox + r * .5, y + oy - r * 1.05, x + ox + r, y + oy - r * .5, x + ox + r, y + oy);
      ctx.arc(x + ox, y + oy, r, 0, Math.PI); ctx.bezierCurveTo(x + ox - r, y + oy - r * .5, x + ox - r * .5, y + oy - r * 1.05, x + ox, tip + oy); ctx.closePath(); };
    shape(1.6, 2.6); ctx.fillStyle = 'rgba(96,36,0,.3)'; ctx.fill();
    shape(0, 0); const rg = ctx.createRadialGradient(x + r * .25, y + r * .35, 0, x, y - r * .2, r * 1.5);
    rg.addColorStop(0, 'rgba(255,248,214,.8)'); rg.addColorStop(.45, 'rgba(255,206,100,.16)'); rg.addColorStop(.8, 'rgba(140,56,0,.38)'); rg.addColorStop(1, 'rgba(96,34,0,.7)');
    ctx.fillStyle = rg; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(86,30,0,.55)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(x - r * .36, y - r * .38, r * .26, r * .17, -.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function sweat(sp, sw, t) {
    if (sw <= .005) return;
    const W = sp.W, H = sp.H, N = 7, top = -H / 2 + 16, bot = H / 2 - 10;
    for (let i = 0; i < 5; i++) {
      const x = -W / 2 + 80 + (i + .3 + .4 * R(i, 4)) * (W - 160) / 5, a = cl(sw * 6 - i * .8);
      const r = (10 + 6 * R(i, 2)) * (.6 + .4 * a) * (1 + .06 * Math.sin(t * 3 + i));
      drop(x, top + 2 + R(i, 6) * 5, r, .1, a);
    }
    for (let i = 0; i < N; i++) {
      const vis = cl(sw * (N + 1) - i); if (vis <= 0) continue;
      const x = -W / 2 + 56 + (i + .2 + .6 * R(i, 7)) * (W - 112) / N;
      const rate = .3 + .2 * R(i, 5), u = ((t * rate + R(i, 9)) % 1 + 1) % 1;
      const y = top + (bot - top) * Math.pow(u, 1.9), grow = cl(u / .16), fade = 1 - cl((u - .9) / .1);
      const r = (12 + 7 * R(i, 3)) * (.35 + .65 * grow), e = .3 + 1.4 * Math.pow(u, 1.2);
      if (y - top > 6) {
        ctx.save(); ctx.globalAlpha *= vis * fade; ctx.lineCap = 'round';
        const tg = ctx.createLinearGradient(0, top, 0, y); tg.addColorStop(0, 'rgba(150,64,0,0)'); tg.addColorStop(1, 'rgba(150,64,0,.2)');
        ctx.strokeStyle = tg; ctx.lineWidth = r * .75; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + Math.sin(y * .05 + i) * 1.5, y - r); ctx.stroke(); ctx.restore();
      }
      drop(x, y, r, e, vis * fade);
    }
  }

  // ------------------------------------------------------------------ shadows + thickness (stacked solid footprints: cheap, rotation-safe)
  function softFoot(sp, P, ox, oy, blur, a, n = 6, Wd = sp.W, Hd = sp.H) {
    if (a <= .005) return;
    const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n);
    ctx.save(); apply(P, ox, oy); ctx.fillStyle = `rgba(${SH},${al.toFixed(4)})`;
    for (let i = 0; i < n; i++) { const g = -blur * .55 + blur * 1.6 * i / (n - 1); rrect(-Wd / 2 - g / P.sxx, -Hd / 2 - g / P.syy, Wd + 2 * g / P.sxx, Hd + 2 * g / P.syy, Math.max(2, sp.R + g)); ctx.fill(); }
    ctx.restore();
  }
  function depthVec(P, sp) { const k = Math.sqrt(Math.max(.02, Math.abs(P.sxx * P.syy))); return { x: sp.depth * .3 * k, y: sp.depth * k }; }
  function body(sp, P, L, z, sideCols, noCast) {
    const W = sp.W, H = sp.H, Rr = sp.R, q = lightAt(P.x, P.y, L), d = depthVec(P, sp);
    const o = shadowOff(P.x, P.y, z, L);
    const a1 = (.5 + .32 * q.s + .2 * q.v) * (1 - Math.min(.55, z / 320));
    if (!noCast) { softFoot(sp, P, o.x + d.x * .6, o.y + d.y * .6, 9 + z * .24, Math.min(.78, a1), 6); softFoot(sp, P, d.x + 1, d.y + 3, 5, .7, 3); }   // cast + contact
    const n = Math.max(4, Math.ceil(Math.hypot(d.x, d.y) / 2.2));
    for (let i = n; i >= 1; i--) {
      const f = i / n; ctx.save(); apply(P, d.x * f, d.y * f);
      ctx.fillStyle = rgb(mixC(sideCols[0], sideCols[1], Math.pow(f, .8))); rrect(-W / 2, -H / 2, W, H, Rr); ctx.fill(); ctx.restore();
    }
    ctx.save(); apply(P, d.x, d.y); ctx.beginPath(); ctx.moveTo(-W / 2 + Rr, H / 2 - .8); ctx.lineTo(W / 2 - Rr, H / 2 - .8);
    ctx.lineWidth = 1.2 / Math.max(.3, P.syy); ctx.strokeStyle = rgb(sideCols[2], .55); ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------ AMBER: draw
  function amberDraw(P, st, t, L) {
    const sp = SPEC.amber, W = sp.W, H = sp.H, sc = devScale(), lo = amberLayout(st.txt || S.plateText('amber')), fin = lo.fin;
    const face = () => rrect(-W / 2, -H / 2, W, H, sp.R), q = lightAt(P.x, P.y, L);
    blit(amberFace(), W, H);
    lightPass(face, P, L, 160);
    sunSheen(face, W, H, q, 1);
    // the letters: dark brown letterpress (a lit lip below, the ink on top); P A S lost, the rest springs together
    const tn = inkTint(P.x, P.y, L), ink = mulC(BROWN, tn), lip = mulC([255, 222, 150], tn);
    const lost = Math.max(0, Math.min(3, Math.floor(st.lost || 0)));
    const rr = cl(st.recentre || 0), dj = t - (A.check - .04);                           // « C'EST » and « ÇA » close up, then jiggle like a spring (no overlap)
    const jig = fin && rr >= 1 && dj > 0 ? 1 + .07 * Math.exp(-dj * 8) * Math.sin(dj * 34) : 1;
    const items = [];
    for (const g of lo.gl) {
      if (g.ch === ' ') continue;
      if (fin && g.i >= 6 && g.i <= 8 && g.i - 6 < lost) continue;
      let x = g.x0, a = 1;
      if (fin && fin.x0[g.i] !== undefined) x = (g.x0 + (fin.x0[g.i] - g.x0) * rr) * jig;
      if (g.ch === '!') { a = cl(st.bang ?? 1); if (fin) x = g.x0 + (fin.tick.x + fin.tick.w * .5 - g.adv / 2 - g.x0) * rr * jig; }   // the « ! » rides along, then turns into the ✓
      if (a > .01) items.push({ ch: g.ch, x, a });
    }
    ctx.save(); ctx.font = lo.font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    for (const it of items) { ctx.globalAlpha = it.a * .75; ctx.fillStyle = rgb(lip); ctx.fillText(it.ch, it.x, lo.base + 2.8); }
    for (const it of items) { ctx.globalAlpha = it.a * .45; ctx.fillStyle = 'rgb(110,40,0)'; ctx.fillText(it.ch, it.x, lo.base - 1.2); }   // the pressed-in top edge
    for (const it of items) { ctx.globalAlpha = it.a; ctx.fillStyle = rgb(ink); ctx.fillText(it.ch, it.x, lo.base); }
    ctx.restore();
    // pop where a letter just left the plate (a warm flash, then nothing: no hole)
    if (fin) for (let c = 0; c < 3; c++) {
      const dt = t - A.letters[c]; if (dt < 0 || dt > .3) continue;
      const g = lo.gl[6 + c], a = Math.pow(1 - dt / .3, 2), rg = ctx.createRadialGradient(g.cx, lo.base - lo.capH / 2, 0, g.cx, lo.base - lo.capH / 2, 90);
      rg.addColorStop(0, `rgba(255,244,200,${(.75 * a).toFixed(3)})`); rg.addColorStop(.4, `rgba(255,180,60,${(.3 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.save(); face(); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(g.cx - 90, -H / 2, 180, H); ctx.restore();
    }
    if (fin) { ctx.save(); face(); ctx.clip(); drawCracks(st, t, H); ctx.restore(); }
    // the stamped ✓ (letterpress, same ink)
    const tick = cl(st.tick || 0);
    if (fin && tick > 0) {
      const tk = fin.tick, s = 1 + .55 * Math.pow(1 - tick, 2), a = cl(tick * 2.4), cx = tk.x + tk.w / 2, cy = lo.base - lo.capH / 2;
      const path = () => { ctx.beginPath(); ctx.moveTo(tk.x + tk.w * .04, lo.base - tk.h * .5); ctx.lineTo(tk.x + tk.w * .38, lo.base - tk.h * .08); ctx.lineTo(tk.x + tk.w * .98, lo.base - tk.h * .98); };
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.translate(0, 2.8); path(); ctx.strokeStyle = rgb(lip, .75); ctx.lineWidth = lo.capH * .27; ctx.stroke(); ctx.translate(0, -2.8);
      path(); ctx.strokeStyle = rgb(ink); ctx.lineWidth = lo.capH * .27; ctx.stroke();
      ctx.restore();
      const dt = t - A.check;                                                                                        // a glint sweeps the satin
      if (dt > 0 && dt < .8) {
        const k = sst(dt / .8), x = -W / 2 - 160 + (W + 320) * k, sw = ctx.createLinearGradient(x - 80, -50, x + 80, 50);
        sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(.5, `rgba(255,252,236,${(.45 * Math.sin(Math.PI * k)).toFixed(3)})`); sw.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); face(); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sw; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
      }
    }
    sweat(sp, cl(st.sweat || 0), t);
  }

  // ------------------------------------------------------------------ STEEL
  function steelFace() {
    if (SPR.steel) return SPR.steel;
    const sp = SPEC.steel, W = sp.W, H = sp.H, sd = sp.seed, b = sp.bevel;
    const rv = () => { const x = W / 2 - sp.rivet, y = H / 2 - sp.rivet; return [[-x, -y], [x, -y], [-x, y], [x, y]]; };
    return (SPR.steel = faceCanvas(W, H, 6, g => {
      g.save(); rrectOn(g, -W / 2, -H / 2, W, H, sp.R); g.clip();
      const lg = g.createLinearGradient(0, -H / 2, 0, H / 2); lg.addColorStop(0, '#8C96A2'); lg.addColorStop(.42, '#717A86'); lg.addColorStop(1, '#565E69');
      g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = .85; g.drawImage(brushed(Math.ceil(W * SS), Math.ceil(H * SS), sd), -W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      for (let i = 0; i < 16; i++) {
        const x = (R(i, 21) - .5) * W, y = (R(i, 22) - .5) * H, r = 40 + R(i, 23) * 140, dark = R(i, 24) > .5, rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, dark ? 'rgba(20,24,30,.10)' : 'rgba(230,236,242,.07)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      g.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const x = (R(i, 25) - .5) * W, y = (R(i, 26) - .5) * H, a = (R(i, 27) - .5) * (R(i, 28) > .85 ? 2.4 : .25), l = 8 + R(i, 29) * 70;
        g.strokeStyle = R(i, 30) > .4 ? `rgba(235,240,246,${(.10 + R(i, 31) * .14).toFixed(3)})` : `rgba(18,20,26,${(.12 + R(i, 32) * .12).toFixed(3)})`;
        g.lineWidth = .5 + R(i, 33) * .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      // relief: bevel (light on the door side), the plate's falloff, dome rivets
      const vg = g.createRadialGradient(0, -H * .1, H * .4, 0, -H * .1, W * .62); vg.addColorStop(0, 'rgba(8,8,20,0)'); vg.addColorStop(1, 'rgba(8,8,20,.3)'); g.fillStyle = vg; g.fillRect(-W / 2, -H / 2, W, H);
      const x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2;
      const quad = (p, f) => { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); g.fillStyle = f; g.fill(); };
      let gr = g.createLinearGradient(0, y0, 0, y0 + b); gr.addColorStop(0, 'rgba(255,255,255,.66)'); gr.addColorStop(1, 'rgba(255,255,255,.30)');
      quad([[x0, y0], [x1, y0], [x1 - b, y0 + b], [x0 + b, y0 + b]], gr);
      gr = g.createLinearGradient(0, y1 - b, 0, y1); gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,.62)');
      quad([[x0, y1], [x1, y1], [x1 - b, y1 - b], [x0 + b, y1 - b]], gr);
      quad([[x0, y0], [x0 + b, y0 + b], [x0 + b, y1 - b], [x0, y1]], 'rgba(255,255,255,.2)');
      quad([[x1, y0], [x1 - b, y0 + b], [x1 - b, y1 - b], [x1, y1]], 'rgba(0,0,0,.30)');
      g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(x0 + sp.R, y0 + .9); g.lineTo(x1 - sp.R, y0 + .9); g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.30)'; rrectOn(g, x0 + b, y0 + b, W - 2 * b, H - 2 * b, Math.max(2, sp.R - b)); g.stroke();
      for (const [x, y] of rv()) {
        const r = sp.rr; g.fillStyle = '#8A929C'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        const gs = g.createRadialGradient(x + 2.5, y + 3.5, r * .5, x + 2.5, y + 3.5, r * 1.75); gs.addColorStop(0, 'rgba(0,0,0,.55)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gs; g.fillRect(x - 3 * r, y - 3 * r, 6 * r, 6 * r);
        g.beginPath(); g.arc(x, y, r + 2.3, 0, 7); g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1.4; g.stroke();
        const gd = g.createRadialGradient(x - r * .38, y - r * .42, 0, x, y, r * 1.04);
        gd.addColorStop(0, 'rgba(255,255,255,.95)'); gd.addColorStop(.2, 'rgba(255,255,255,.48)'); gd.addColorStop(.52, 'rgba(160,168,178,.2)'); gd.addColorStop(.84, 'rgba(0,0,0,.24)'); gd.addColorStop(1, 'rgba(0,0,0,.58)');
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = gd; g.fill();
      }
      g.restore();
    }));
  }
  const STL = {};
  function steelLayout(lines) {
    const key = lines.join('|'); if (STL[key]) return STL[key];
    const sp = SPEC.steel; let z = sp.size; const f = zz => `900 ${zz}px Stencil`;
    const wmax = Math.max(...lines.map(l => mw(f(z), l))); if (wmax > sp.maxText) z = Math.floor(z * sp.maxText / wmax);
    const font = f(z), cap = capOf(font), lh = Math.min(sp.lh, z * .95), y0 = -(lines.length - 1) * lh / 2;
    return (STL[key] = { font, cap, z, rows: lines.map((l, i) => ({ s: l, x: -mw(font, l) / 2, base: y0 + i * lh + cap / 2 })) });
  }
  function steelDraw(P, st, t, L) {
    const sp = SPEC.steel, W = sp.W, H = sp.H, sc = devScale(), q = lightAt(P.x, P.y, L);
    const face = () => rrect(-W / 2, -H / 2, W, H, sp.R);
    blit(steelFace(), W, H);
    lightPass(face, P, L, 200);
    // anisotropic streak of the brushed metal: a soft vertical band of sun on the door side, drifting with the plate
    ctx.save(); face(); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    const bx = -W * .22 + (P.x - G.cx) * .25, sg = ctx.createLinearGradient(bx - 260, 0, bx + 260, 0), on = (.35 + .65 * q.s) * (1 - .6 * q.v);
    sg.addColorStop(0, 'rgba(255,240,214,0)'); sg.addColorStop(.38, `rgba(255,240,214,${(.06 * on).toFixed(3)})`); sg.addColorStop(.5, `rgba(255,244,222,${(.24 * on).toFixed(3)})`);
    sg.addColorStop(.62, `rgba(255,240,214,${(.06 * on).toFixed(3)})`); sg.addColorStop(1, 'rgba(255,240,214,0)');
    ctx.fillStyle = sg; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    // cream stencil paint: a soft dark under-shadow, a crisp paint edge, the cream fill
    const lo = steelLayout(st.lines || S.plateText('steel')), cream = rgb(mulC(CREAM, inkTint(P.x, P.y, L)));
    ctx.save(); ctx.font = lo.font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    for (const [oy, a] of [[6, .14], [4, .2], [2.2, .3]]) { ctx.fillStyle = `rgba(8,5,14,${a})`; for (const r of lo.rows) ctx.fillText(r.s, r.x + oy * .2, r.base + oy); }   // soft under-shadow (stacked)
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(16,12,22,.5)';
    for (const r of lo.rows) ctx.strokeText(r.s, r.x, r.base);
    ctx.fillStyle = cream; for (const r of lo.rows) ctx.fillText(r.s, r.x, r.base);
    ctx.restore();
  }

  // ------------------------------------------------------------------ ORDER: the thin amber card (strip-warped)
  const ORD = {};
  function ordLayout(lines) {
    const key = lines.join('|'); if (ORD['lay' + key]) return ORD['lay' + key];
    const sp = SPEC.order; let z = sp.size; const f = zz => `900 ${zz}px Satoshi`;
    const wmax = Math.max(...lines.map(l => mw(f(z), l))); if (wmax > sp.maxText) z = Math.floor(z * sp.maxText / wmax);
    const font = f(z), cap = capOf(font), lh = sp.lh * z / sp.size, y0 = -(lines.length - 1) * lh / 2 + 4;
    return (ORD['lay' + key] = { font, cap, z, rows: lines.map((l, i) => ({ s: l, w: mw(font, l), cy: y0 + i * lh, base: y0 + i * lh + cap / 2 })) });
  }
  /** the card stock, without text */
  function cardStock() {
    if (ORD.stock) return ORD.stock;
    const sp = SPEC.order, W = sp.W, H = sp.H;
    return (ORD.stock = faceCanvas(W, H, 4, g => {
      g.save(); rrectOn(g, -W / 2, -H / 2, W, H, sp.R); g.clip();
      const lg = g.createLinearGradient(0, -H / 2, 0, H / 2); lg.addColorStop(0, '#F9C873'); lg.addColorStop(1, '#EFB257'); g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = .28; g.drawImage(noise(Math.ceil(W * SS / 2), Math.ceil(H * SS / 2), sp.seed, 50), -W / 2, -H / 2, W, H);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.lineCap = 'round';
      for (let i = 0; i < 900; i++) {                                                 // paper fibres
        const x = (R(i, 41) - .5) * W, y = (R(i, 42) - .5) * H, a = R(i, 43) * Math.PI, l = 3 + R(i, 44) * 9;
        g.strokeStyle = R(i, 45) > .5 ? `rgba(150,92,20,${(.12 + R(i, 46) * .12).toFixed(2)})` : `rgba(255,236,190,${(.16 + R(i, 47) * .16).toFixed(2)})`;
        g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      g.strokeStyle = 'rgba(255,246,220,.6)'; g.lineWidth = 2; rrectOn(g, -W / 2 + 1, -H / 2 + 1, W - 2, H - 2, sp.R); g.stroke();
      g.strokeStyle = 'rgba(150,84,10,.45)'; g.lineWidth = 2.5; g.setLineDash([16, 10]); rrectOn(g, -W / 2 + 22, -H / 2 + 22, W - 44, H - 44, 6); g.stroke(); g.setLineDash([]);   // a printed order-form border
      g.restore();
    }));
  }
  /** text sprite of one line (ink), for the card */
  function lineSprite(lo, i) {
    const k = 'ln' + i + lo.font; if (ORD[k]) return ORD[k];
    const r = lo.rows[i], w = Math.ceil(r.w + 40), h = Math.ceil(lo.z * 1.5), c = makeCanvas(Math.ceil(w * SS), Math.ceil(h * SS)), g = c.getContext('2d');
    g.scale(SS, SS); g.font = lo.font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = rgb(INKC); g.fillText(r.s, w / 2, h / 2 + lo.cap / 2);
    c._w = w; c._h = h; return (ORD[k] = c);
  }
  /** the composed face (stock + lines; the soggy line warped, stain, drips) into a reusable canvas */
  let OC = null, OCkey = '';
  function cardFace(st, t) {
    const sp = SPEC.order, W = sp.W, H = sp.H, pad = 4, lo = ordLayout(st.lines || S.plateText('order')), sg = cl(st.soggy || 0), sl = st.soggyLine ?? 1;
    const key = sg > 0 ? 'sog' + Math.round(sg * 300) + '|' + Math.floor(t * 30) : 'dry';
    if (!OC) { OC = makeCanvas(Math.ceil((W + 2 * pad) * SS), Math.ceil((H + 2 * pad) * SS)); OC._pad = pad; }
    if (key === OCkey) return OC;
    OCkey = key;
    const g = OC.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, OC.width, OC.height);
    g.drawImage(cardStock(), 0, 0); g.setTransform(SS, 0, 0, SS, (W / 2 + pad) * SS, (H / 2 + pad) * SS);
    lo.rows.forEach((r, i) => {
      const sp2 = lineSprite(lo, i), w = sp2._w, h = sp2._h;
      if (i !== sl || sg <= 0) { g.drawImage(sp2, -w / 2, r.cy - h / 2, w, h); return; }
      // ---- the soggy line: wet stain under it, then the line squashed (crêpe), sagging, wrinkled, bleeding
      const cy = r.cy, sw = r.w * (1 + .12 * sg), wet = sst(sg * 1.4);
      g.save(); rrectOn(g, -W / 2, -H / 2, W, H, sp.R); g.clip();
      for (let j = 0; j < 11; j++) {                                                    // the stain: irregular, darker brown, spreading sideways
        const bx = (R(j, 61) - .5) * r.w * 1.0, by = cy + 8 + (R(j, 62) - .5) * 18 + 8 * sg, br = (50 + R(j, 63) * 60) * (.3 + .9 * wet);
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, br); rg.addColorStop(0, `rgba(146,72,4,${(.46 * wet).toFixed(3)})`); rg.addColorStop(.65, `rgba(156,80,8,${(.3 * wet).toFixed(3)})`); rg.addColorStop(1, 'rgba(160,84,10,0)');
        g.save(); g.translate(bx, by); g.scale(1, .6); g.fillStyle = rg; g.fillRect(-br, -br, 2 * br, 2 * br); g.restore();
      }
      if (sg > .35) {                                                                   // the crêpe: wet pulp spreading under the flattened word
        const k2 = sst((sg - .35) / .65), pw = r.w * (.56 + .1 * k2), ph = 30 + 16 * k2, py = cy + 14 + 12 * sg;
        g.beginPath(); for (let a = 0; a <= 48; a++) { const th = a / 48 * Math.PI * 2, rr = 1 + .07 * Math.sin(th * 5 + 1) + .05 * Math.sin(th * 9 + 2); g.lineTo(Math.cos(th) * pw * rr, py + Math.sin(th) * ph * rr); }
        g.closePath(); g.fillStyle = `rgba(122,58,4,${(.28 * k2).toFixed(3)})`; g.fill(); g.strokeStyle = `rgba(255,232,180,${(.25 * k2).toFixed(3)})`; g.lineWidth = 2; g.stroke();
      }
      g.lineCap = 'round';                                                              // drips running down the card
      const dxs = [-r.w * .27, r.w * .07, r.w * .36];                                    // short drips under the word, between the letters' gaps
      for (let j = 0; j < 3; j++) {
        const dx = dxs[j], len = (14 + 20 * R(j, 72)) * sst((sg - .2 - .12 * j) * 1.8), y0 = cy + 16 + 14 * sg;
        if (len < 2) continue;
        const dg = g.createLinearGradient(0, y0, 0, y0 + len); dg.addColorStop(0, 'rgba(120,58,4,.45)'); dg.addColorStop(1, 'rgba(120,58,4,.25)');
        g.strokeStyle = dg; g.lineWidth = 7 + 3 * R(j, 73); g.beginPath(); g.moveTo(dx, y0); g.lineTo(dx, y0 + len); g.stroke();
        g.fillStyle = 'rgba(110,52,4,.42)'; g.beginPath(); g.ellipse(dx, y0 + len, 5, 6.5, 0, 0, 7); g.fill();
      }
      g.restore();
      const N = 34, sy = 1 - .64 * sst(sg), sx = sw / r.w;
      for (let k = 0; k < N; k++) {                                                     // the line itself, in vertical strips
        const u0 = k / N, u1 = (k + 1) / N, x0 = -w / 2 + w * u0, uc = (u0 + u1) / 2 - .5;
        const sag = sg * (26 * (1 - 4 * uc * uc)) + sg * 7 * Math.sin(uc * 19 + 1.3) + sg * sg * 5 * Math.sin(uc * 43);
        const hh = h * sy * (1 + .1 * sg * Math.sin(uc * 31 + 2)), dx = x0 * sx, dw = w / N * sx + .6;
        g.drawImage(sp2, u0 * sp2.width, 0, (u1 - u0) * sp2.width + .5, sp2.height, dx, cy - hh / 2 + sag + (h - hh) * .18, dw, hh);
      }
      if (sg > .15) {                                                                   // the ink bleeds: a soft halo of wet ink + wrinkles
        g.save(); g.globalAlpha = .35 * sst((sg - .15) / .6); g.shadowColor = 'rgba(80,36,4,.9)'; g.shadowBlur = 10 * SS;
        g.font = lo.font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(80,36,4,.0)';
        g.translate(0, cy + sg * 16); g.scale(sx, sy); g.fillStyle = 'rgba(80,36,4,.35)'; g.fillText(r.s, 0, lo.cap / 2); g.restore();
        g.save(); g.strokeStyle = `rgba(255,236,190,${(.22 * sg).toFixed(3)})`; g.lineWidth = 1.5;                               // wet sheen
        for (let j = 0; j < 6; j++) { const bx = (R(j, 81) - .5) * sw * .9, by = cy + sg * 12 + (R(j, 82) - .5) * 30; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 18 + 20 * R(j, 83), by - 3); g.stroke(); }
        g.restore();
      }
    });
    return OC;
  }
  function orderDraw(P, st, t, L) {
    const sp = SPEC.order, W = sp.W, H = sp.H, pad = 4, sag = cl(st.sag || 0, 0, 1.2), droop = 44 * sag, q = lightAt(P.x, P.y, L);
    const prof = u => u * u;                                                           // u ∈ [-1, 1]: the ends droop
    const face = cardFace(st, t), N = 30;
    // shadow: the raised middle casts further; the drooping ends touch the cloth
    const z = (P.z ?? 6) + 26 * sag, o = shadowOff(P.x, P.y, z, L);
    ctx.save(); ctx.fillStyle = `rgba(${SH},${(.16 * (1 - Math.min(.5, z / 400))).toFixed(3)})`;
    for (let i = 0; i < 5; i++) { const g = -6 + 6 * i; ctx.beginPath();
      for (let k = 0; k <= 12; k++) { const u = k / 6 - 1, x = u * (W / 2 + g), y = -H / 2 - g + droop * prof(u) * .7; k ? ctx.lineTo(x + o.x * (1 - .5 * prof(u)), y + o.y * (1 - .5 * prof(u))) : ctx.moveTo(x + o.x, y + o.y); }
      for (let k = 12; k >= 0; k--) { const u = k / 6 - 1, x = u * (W / 2 + g), y = H / 2 + g + droop * prof(u); ctx.lineTo(x + o.x * (1 - .5 * prof(u)), y + o.y * (1 - .5 * prof(u))); }
      ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // thickness (the card's edge), then the face in strips
    const strip = (k, fn) => { const u0 = k / N * 2 - 1, u1 = (k + 1) / N * 2 - 1, uc = (u0 + u1) / 2; fn(u0, u1, uc); };
    ctx.save();
    const shear = (u0, u1, fn) => { const x0 = u0 * W / 2, x1 = u1 * W / 2, d0 = droop * prof(u0), d1 = droop * prof(u1), m = (d1 - d0) / (x1 - x0);
      ctx.save(); ctx.transform(1, m, 0, 1, 0, d0 - m * x0); fn(x0, x1); ctx.restore(); };
    const edgeCol = rgb(mulC([176, 108, 26], tintAt(P.x, P.y, L)));
    for (let k = 0; k < N; k++) strip(k, (u0, u1) => shear(u0, u1, (x0, x1) => { ctx.fillStyle = edgeCol; ctx.fillRect(x0 - .4, H / 2 - 1, x1 - x0 + .8, sp.depth + 1); }));
    const sx = face.width / (W + 2 * pad);
    for (let k = 0; k < N; k++) strip(k, (u0, u1) => shear(u0, u1, (x0, x1) => {
      const srcX = (x0 + W / 2 + pad) * sx, srcW = (x1 - x0) * sx;
      ctx.drawImage(face, srcX, 0, srcW + .8, face.height, x0, -H / 2 - pad, x1 - x0 + .5, H + 2 * pad);
    }));
    // light: the beam across the card, the drooping right end turns away from the door (darker), the left towards it
    const pth = () => { ctx.beginPath();
      for (let k = 0; k <= N; k++) { const u = k / N * 2 - 1; ctx.lineTo(u * W / 2, -H / 2 + droop * prof(u)); }
      for (let k = N; k >= 0; k--) { const u = k / N * 2 - 1; ctx.lineTo(u * W / 2, H / 2 + droop * prof(u)); } ctx.closePath(); };
    lightPass(pth, P, L, 200);
    ctx.save(); pth(); ctx.clip();
    const gx = ctx.createLinearGradient(-W / 2, 0, W / 2, 0), s2 = sag * .5;
    gx.addColorStop(0, `rgba(255,240,210,${(.18 * s2).toFixed(3)})`); gx.addColorStop(.25, 'rgba(255,240,210,0)'); gx.addColorStop(.75, 'rgba(60,24,0,0)'); gx.addColorStop(1, `rgba(60,24,0,${(.3 * s2).toFixed(3)})`);
    ctx.fillStyle = gx; ctx.fillRect(-W / 2, -H / 2 - 10, W, H + droop + 20);
    ctx.restore();
    sunSheen(pth, W, H, q, .6);
    ctx.restore();
  }

  // ------------------------------------------------------------------ public: one plate
  function plate(kind, st, t, L) {
    const sp = SPEC[kind]; if (!st || !sp || (st.a ?? 1) <= 0) return;
    L = L || S.light(t);
    let x = st.x, y = st.y, rot = st.rot || 0;
    const shake = st.shake || 0;
    if (shake > 0) { const n = Math.floor(Math.round(t * 30) / 2); x += (rnd(n * 1.73 + 11) - .5) * 10 * shake; y += (rnd(n * 2.31 + 5) - .5) * 7 * shake; rot += (rnd(n * 3.17 + 7) - .5) * .016 * shake; }
    const s = st.s ?? 1, P = { x, y, rot, sxx: s * (st.sx ?? 1), syy: s * (st.sy ?? 1) };
    if (kind === 'amber') { const r = P.syy / Math.max(1e-3, P.sxx); if (r < .5) P.sxx *= 1 + (.5 - r) * 2.2; }
    if (Math.abs(P.sxx) < 1e-3 || Math.abs(P.syy) < 1e-3) return;
    const z = st.z ?? (kind === 'amber' ? 13 : 10), tn = tintAt(x, y, L);
    // static plates are cached (OM_cached, 30_meme.js); anything animated by t itself is drawn live
    const live = (st.sweat || 0) > .005 || shake > 0 || (st.soggy || 0) > 0 || (kind === 'amber' && ((t >= A.taps[0] - .05 && t < A.check + .85) || (t > A.slam - .25 && t < A.slam + .05)));
    if (!live && typeof OM_cached === 'function' && !st._nc) {
      const hw = sp.W / 2 * Math.abs(P.sxx) + 90, hh = sp.H / 2 * Math.abs(P.syy) + 110, o = shadowOff(x, y, z, L);
      const key = OM_key(kind, x, y, rot, P.sxx, P.syy, z, st.a ?? 1, st.sag ?? 0, st.lost ?? 0, st.recentre ?? 0, st.tick ?? 0, st.bang ?? 1, st.cracks ?? 0, L.sun, L.violet, L.dim, (st.lines || [st.txt]).join('|'));
      OM_cached('plate_' + kind, key, [x - hw - 20, y - hh - 20, x + hw + o.x + 40, y + hh + o.y + 60], 1.25, () => plate(kind, { ...st, _nc: 1 }, t, L));
      return;
    }
    ctx.save(); ctx.globalAlpha *= (st.a ?? 1);
    if (kind === 'order') { ctx.save(); apply(P); orderDraw(P, st, t, L); ctx.restore(); ctx.restore(); return; }
    const side = kind === 'amber' ? [mulC([214, 116, 10], tn), mulC([120, 52, 4], tn), mulC([255, 196, 110], tn)] : [mulC([82, 88, 98], tn), mulC([30, 33, 39], tn), mulC([176, 184, 194], tn)];
    body(sp, P, L, z, side, kind === 'amber' && t < A.slam);           // falling: its shadow is on the subtitle (OM_subtitle)
    ctx.save(); apply(P);
    if (kind === 'amber') amberDraw(P, st, t, L); else steelDraw(P, st, t, L);
    ctx.restore(); ctx.restore();
  }

  // ------------------------------------------------------------------ glyph boxes + one amber glyph tile (for M2's P, A, S)
  function glyphs(txt) {
    const lo = amberLayout(txt || S.plateText('amber'));
    return lo.gl.map(g => ({ ch: g.ch, i: g.i, x: g.cx, y: lo.base - lo.capH / 2, w: g.adv, h: lo.capH, size: lo.size, font: lo.font, baseline: lo.base }));
  }
  function glyph(ch, box, L) {
    const lo = amberLayout(S.plateText('amber'));
    let b = box && box.w ? box : glyphs().find(q => q.ch === ch) || { x: 0, y: lo.base - lo.capH / 2, w: mw(lo.font, ch), h: lo.capH, font: lo.font, baseline: lo.base };
    const w = b.w, h = b.h, font = b.font || lo.font, Lx = (box && box.L) || L;
    const tn = Lx ? tintAt(Lx.px ?? 540, Lx.py ?? 1250, Lx) : [1, .97, .9];
    const mx = w / 2 + 14, my = h / 2 + 18, d = 9;
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    for (const [o, a] of [[15, .12], [11, .16], [8, .22]]) { ctx.fillStyle = `rgba(${SH},${a})`; rrect(-mx + o * .35, -my + o, 2 * mx, 2 * my, 14); ctx.fill(); }
    for (let i = 6; i >= 1; i--) { ctx.fillStyle = rgb(mulC(mixC([214, 116, 10], [120, 52, 4], i / 6), tn)); rrect(-mx + d * .3 * i / 6, -my + d * i / 6, 2 * mx, 2 * my, 14); ctx.fill(); }
    const lg = ctx.createLinearGradient(0, -my, 0, my); lg.addColorStop(0, rgb(mulC([255, 192, 80], tn))); lg.addColorStop(1, rgb(mulC([242, 143, 12], tn)));
    ctx.fillStyle = lg; rrect(-mx, -my, 2 * mx, 2 * my, 14); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,248,226,.65)'; ctx.beginPath(); ctx.moveTo(-mx + 12, -my + 1.2); ctx.lineTo(mx - 12, -my + 1.2); ctx.stroke();
    const by = h / 2 + (b.baseline - (b.y + h / 2));
    ctx.font = font; ctx.fillStyle = rgb(mulC([255, 222, 150], tn), .75); ctx.fillText(ch, -w / 2, by + 2.6);
    ctx.fillStyle = rgb(mulC(BROWN, tn)); ctx.fillText(ch, -w / 2, by);
    ctx.restore();
  }

  return { plate, glyphs, glyph, amberLayout, crackData, SPEC, tintAt, lightPass, softFoot };
})();

// =============================================================================================
// OM_fx — dust, drops, sparks, chips (world, after everything)
// =============================================================================================
const OM_FX = (function () {
  const S = window.SCORE, G = S.G, A = S.A;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  let DS = null;
  function dustSprites() {
    if (DS) return DS;
    const mk = (seed, col) => {
      const N = 96, c = makeCanvas(N, N), g = c.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const x = N / 2 + (R(i, seed) - .5) * N * .34, y = N / 2 + (R(i, seed + 1) - .5) * N * .34, r = N * (.2 + .2 * R(i, seed + 2)), rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${col},${(.3 + .3 * R(i, seed + 3)).toFixed(2)})`); rg.addColorStop(.6, `rgba(${col},${(.12 + .1 * R(i, seed + 4)).toFixed(2)})`); rg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, N, N);
      }
      return c;
    };
    return (DS = { warm: [0, 1, 2].map(k => mk(300 + k * 7, '214,178,128')), light: [0, 1, 2].map(k => mk(400 + k * 7, '252,240,220')) });
  }
  /** dust puffs from emitters [{x, y, nx, ny, s}] at progress k (0..1) */
  function puffs(ems, k, o = {}) {
    if (k <= 0 || k >= 1) return;
    const grow = 1 - Math.pow(1 - k, 3.2), fade = Math.pow(1 - k, 1.4) * cl(k * 16);
    const out = o.out ?? 10, n = o.n || 6, seed = o.seed || 1, dist = o.dist || 90, size = o.size || 34, A0 = o.a ?? .6, spread = o.spread ?? .9, rise = o.rise ?? 26, tj = o.tj ?? 30;
    const D = dustSprites(), spr = o.light ? D.light : D.warm; let id = 0;
    ctx.save();
    for (const e of ems) {
      const nl = Math.hypot(e.nx, e.ny) || 1, nx = e.nx / nl, ny = e.ny / nl, base = Math.atan2(ny, nx), str = e.s ?? 1;
      for (let j = 0; j < n; j++, id++) {
        const r1 = R(id, seed), r2 = R(id, seed + 1), r3 = R(id, seed + 2), r4 = R(id, seed + 3), r5 = R(id, seed + 4);
        const a = base + (r1 - .5) * spread, dd = dist * (.25 + .75 * r2) * str * grow, tg = (r5 - .5) * tj;
        const px = e.x + nx * out - ny * tg + Math.cos(a) * dd, py = e.y + ny * out + nx * tg + Math.sin(a) * dd * .75 - rise * grow * (.3 + .7 * r3);
        const rad = size * (.55 + 1.1 * grow) * (.65 + .55 * r3) * Math.sqrt(str), al = A0 * fade * (.55 + .45 * r4);
        if (al < .01) continue;
        ctx.globalAlpha = al; ctx.drawImage(spr[id % 3], px - rad, py - rad, 2 * rad, 2 * rad);
      }
    }
    ctx.restore();
  }
  /** emitters along the edges of a rectangle (centre x, y, half sizes hw, hh) */
  function rectEms(x, y, hw, hh, nTop, nBot, nSide, s = 1) {
    const e = [];
    for (let i = 0; i < nTop; i++) e.push({ x: x + (i + .5) / nTop * 2 * hw - hw, y: y - hh, nx: 0, ny: -1, s: s * .8 });
    for (let i = 0; i < nBot; i++) e.push({ x: x + (i + .5) / nBot * 2 * hw - hw, y: y + hh, nx: 0, ny: 1, s });
    for (let i = 0; i < nSide; i++) { const yy = y - hh + (i + .5) / nSide * 2 * hh; e.push({ x: x - hw, y: yy, nx: -1, ny: .1, s }, { x: x + hw, y: yy, nx: 1, ny: .1, s }); }
    return e;
  }
  /** small hot sparks / chips: n particles from (x, y), launched in a fan around angle a0 */
  function burst(x, y, t0, t, o) {
    const dt = t - t0, dur = o.dur || .4; if (dt < 0 || dt > dur) return;
    ctx.save();
    for (let i = 0; i < o.n; i++) {
      const a = o.a0 + (R(i, o.seed) - .5) * o.spread, v = o.v * (.5 + .7 * R(i, o.seed + 1)), g = o.g ?? 1400;
      const px = x + Math.cos(a) * v * dt, py = y + Math.sin(a) * v * dt + .5 * g * dt * dt, life = 1 - dt / (dur * (.6 + .4 * R(i, o.seed + 2)));
      if (life <= 0) continue;
      if (o.kind === 'spark') {
        const vx = Math.cos(a) * v, vy = Math.sin(a) * v + g * dt, sp = Math.hypot(vx, vy) || 1, l = 9 + 10 * life;
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,${190 + 50 * life | 0},${90 + 120 * life | 0},${(.9 * life).toFixed(3)})`; ctx.lineWidth = 2.6 * life + .6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - vx / sp * l, py - vy / sp * l); ctx.stroke();
      } else {
        const r = (4 + 6 * R(i, o.seed + 3)) * (.6 + .4 * life), rt = dt * (8 + 10 * R(i, o.seed + 4)) * (R(i, o.seed + 5) > .5 ? 1 : -1);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, life * 1.6);
        ctx.save(); ctx.translate(px, py); ctx.rotate(rt);
        ctx.fillStyle = `rgba(${SHc},.35)`; ctx.beginPath(); ctx.moveTo(-r + 3, -r * .5 + 4); ctx.lineTo(r + 3, -r * .2 + 4); ctx.lineTo(r * .3 + 3, r + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = R(i, o.seed + 6) > .4 ? '#FFAE2E' : '#C6700C'; ctx.beginPath(); ctx.moveTo(-r, -r * .5); ctx.lineTo(r, -r * .2); ctx.lineTo(r * .3, r); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  const SHc = '6,4,18';
  function fx(t, L) {
    // 0. frame 0: the « pouf » of the bag jumping out of the torn carton (kraft dust, tape shreds)
    const rc = S.recvCarton(Math.max(0, t));
    if (t < .9 && rc) {
      const g = S.cartonGeo(rc), mx = (g.FTL[0] + g.BTR[0]) / 2, my = (g.FTL[1] + g.BTR[1]) / 2;
      const k = kk(t, -.25, .85), e = [];
      for (let i = 0; i < 7; i++) { const u = i / 6 - .5; e.push({ x: mx + u * g.w * .8, y: my + 10, nx: u * 1.4, ny: -1, s: 1 }); }
      puffs(e, k, { n: 3, seed: 11, dist: 130, size: 38, a: .3, spread: 1.4, rise: 30, out: 24 });
      for (let i = 0; i < 3; i++) {                                                    // torn kraft tape shreds flung sideways, fluttering down
        const u = kk(t, -.3, .9), a0 = [-2.6, -.5, -.2][i], v = 620 + 140 * R(i, 5);
        const x = mx + [-120, 120, 150][i] + Math.cos(a0) * v * u * .5, y = my - 20 + Math.sin(a0) * v * u * .6 + 520 * u * u, rot = u * (4 + 3 * R(i, 6)) * (i % 2 ? 1 : -1) + i;
        const al = 1 - kk(u, .7, 1); if (al <= 0) continue;
        ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(.7, .35 + .35 * Math.abs(Math.sin(u * 14 + i)));
        ctx.fillStyle = lit('#B58650', x, y, L, .3); ctx.beginPath(); ctx.moveTo(-22, -9); ctx.lineTo(20, -10); ctx.lineTo(16, -2); ctx.lineTo(23, 3); ctx.lineTo(18, 10); ctx.lineTo(-20, 9); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // 1. the slam: dust spilling out from under the amber plate, all round (more at the ends and below)
    if (t >= A.slam && t < A.slam + 1.1) {
      const P = S.amber(A.slam + .02); if (P) { const hw = G.plateW.amber / 2 * 1.08, hh = G.plateH.amber / 2 * .9;
        puffs(rectEms(P.x, P.y, hw, hh, 5, 6, 2, 1.1), kk(t, A.slam, A.slam + 1.1), { n: 4, seed: 23, dist: 160, size: 44, a: .42, spread: 1.0, rise: 30, out: 26 }); }
    }
    // 2. the steel: a breath (it lands without violence)
    if (t >= A.steel && t < A.steel + .8) {
      const P = S.steel(A.steel + .01); if (P) puffs(rectEms(P.x, P.y, G.plateW.steel / 2, G.plateH.steel / 2 * .92, 0, 5, 1, .55), kk(t, A.steel, A.steel + .8), { n: 3, seed: 31, dist: 60, size: 26, a: .26, spread: .7, rise: 14, out: 16 });
    }
    // 3. the order card flops on the cloth
    if (t >= A.order && t < A.order + .9) {
      const P = S.order(A.order + .02); if (P) puffs(rectEms(P.x, P.y + 18, G.plateW.order / 2 * 1.02, G.plateH.order / 2, 3, 5, 2, .8), kk(t, A.order, A.order + .9), { n: 3, seed: 41, dist: 90, size: 34, a: .34, spread: 1.1, rise: 20, out: 18 });
    }
    // 4. sweat drops falling off the amber slab's lower edge (while the steel speaks)
    const Am = S.amber(t);
    if (Am && Am.sweat > .2 && t < A.clear) {
      for (let i = 0; i < 4; i++) {
        const per = .9 + .4 * R(i, 51), ph = ((t - A.steel - .5 - i * .37) / per % 1 + 1) % 1, tt = ph * per;
        if (t < A.steel + .5 + i * .37) continue;
        const x0 = Am.x + (-300 + i * 190 + 40 * R(i, 52)) * Am.s, y0 = Am.y + G.plateH.amber / 2 * Am.s + 6, fallT = .22;
        if (tt < fallT) { const y = y0 + 700 * tt * tt; ctx.save(); ctx.fillStyle = 'rgba(255,214,140,.75)'; ctx.beginPath(); ctx.ellipse(x0, y, 4, 6.5, 0, 0, 7); ctx.fill(); ctx.restore(); }
        else { const k = kk(tt, fallT, fallT + .45); if (k < 1) { const y = y0 + 700 * fallT * fallT; ctx.save(); ctx.strokeStyle = `rgba(255,220,160,${(.6 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x0, y, 6 + 18 * k, 2.5 + 6 * k, 0, 0, 7); ctx.stroke(); ctx.restore(); } }
      }
    }
    // 5. the soggy line drips on the cloth below the card
    const Od = S.order(t);
    if (Od && Od.soggy > .3 && t < A.next) {
      for (let i = 0; i < 3; i++) {
        const per = .8 + .3 * R(i, 61), st0 = A.soggy0 + .7 + i * .4; if (t < st0) continue;
        const tt = ((t - st0) % per), x0 = Od.x + (-200 + i * 170 + 40 * R(i, 62)), y0 = Od.y + G.plateH.order / 2 + 40 * Od.sag + 4;
        if (tt < .2) { const y = y0 + 900 * tt * tt; ctx.save(); ctx.fillStyle = 'rgba(150,80,10,.8)'; ctx.beginPath(); ctx.ellipse(x0, y, 4, 6, 0, 0, 7); ctx.fill(); ctx.restore(); }
        const nSpots = Math.floor((t - st0) / per) + 1;                                // the wet spots grow on the cloth
        ctx.save(); ctx.fillStyle = `rgba(4,8,30,${(.28 * Math.min(1, nSpots / 3)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x0 + 4, y0 + 36, 10 + 4 * Math.min(4, nSpots), 4 + 1.5 * Math.min(4, nSpots), 0, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    // 6. the key moment: sparks at each tap (from the crack's root), amber chips at each detach, a ring at the ✓
    if (t >= A.taps[0] - .05 && t < A.check + .8) {
      const P = S.amber(t); if (P) {
        const gl = OM_PL.glyphs(), D = OM_PL.crackData(), s = P.s * (P.sx || 1);
        for (let c = 0; c < 3; c++) {
          const r0 = D[c].main.pts[0], x = P.x + r0[0] * s, y = P.y + G.plateH.amber / 2 * P.s * (P.sy || 1);
          burst(x, y, A.taps[c], t, { kind: 'spark', n: 12, seed: 70 + c * 9, a0: -Math.PI / 2, spread: 2.6, v: 620, g: 2600, dur: .35 });
          const g = gl[6 + c], gx = P.x + g.x * s, gy = P.y + g.y * P.s;
          burst(gx, gy, A.letters[c], t, { kind: 'chip', n: 7, seed: 90 + c * 9, a0: -Math.PI / 2, spread: 2.8, v: 420, g: 2200, dur: .55 });
        }
        const dt = t - A.check;
        if (dt > 0 && dt < .5) {
          const lo = OM_PL.amberLayout(S.plateText('amber')), tk = lo.fin.tick, cx = P.x + (tk.x + tk.w / 2) * s, cy = P.y + (lo.base - lo.capH / 2) * P.s, k = dt / .5;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,214,140,${(.55 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 5 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(cx, cy, 40 + 120 * Math.sqrt(k), 30 + 80 * Math.sqrt(k), 0, 0, 7); ctx.stroke(); ctx.restore();
          puffs(rectEms(P.x, P.y, G.plateW.amber / 2, G.plateH.amber / 2 * .9, 3, 4, 1, .7), kk(t, A.check, A.check + .7), { n: 3, seed: 97, dist: 70, size: 30, a: .3, spread: 1, rise: 18, out: 18 });
        }
      }
    }
  }
  return { fx, puffs, rectEms, burst };
})();

function OM_plate(kind, P, t, L) { OM_PL.plate(kind, P, t, L); }
function OM_glyphs(txt) { return OM_PL.glyphs(txt); }
function OM_glyph(ch, box, L) { OM_PL.glyph(ch, box, L); }
function OM_fx(t, L) { OM_FX.fx(t, L); }
