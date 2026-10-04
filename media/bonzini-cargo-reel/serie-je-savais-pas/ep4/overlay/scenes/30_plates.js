'use strict';
// ep4 « PATRON, ATTENDS ! » — copied from « PAS REÇU. » (SP/v3/overlay/scenes/30_plates.js), validated, with ONE extension
// by the lead: two new kinds and multi-line text ('|' = line break, one common size, the widest line fits maxText):
//   'toi'    = TOI's amber plate (satin amber, dark brown letterpress, 2 lines)  — v2: « IL A CHANGÉ|DE COMPTE. », « TROIS CŒURS,|C'EST LUI ! », « ALLÔ ? »…
//   'honest' = the real supplier's brushed-steel plate (cream stencil, 2 lines) — « JE N'AI|RIEN CHANGÉ. »
//   st.z (optional) = height above the cloth for the cast shadow (a plate hovering in the air).
// Everything else is unchanged.
// =============================================================================================
// MODULE PL — the plates, heroes of « PAS REÇU. ». Heavy, physical text objects lying on the counter.
//   PL_plate(kind, st, t, L)   kind 'steel' (« PAS REÇU. » → « REÇU ✓ »), 'amber' (« J'AI PAYÉ ! / !! / !!! / . »),
//                              'proof' (« LA PREUVE ? », steel, orange « ? »). st = SCORE.steel/amber/proofPlate(t).
//                              Centre (st.x, st.y), transform: translate, rotate st.rot, scale st.s·st.sx, st.s·st.sy.
//   PL_glyphs(kind, txt)       → [{ch, i, x, y, w, h, size, font, baseline}] one box per character, relative to the
//                              plate centre at s = 1 (no transform). (x, y) = CENTRE of the box: w = advance (kerning
//                              included), h = cap height, baseline = y of the baseline (plate coords).
//   PL_glyph(kind, ch, g)      draws one glyph of that plate's material centred on its box centre at (0, 0):
//                              steel → a jagged shard of the very metal it broke from, with its cream stencil letter;
//                              amber → a small satin amber tile with the dark letter. g = a box from PL_glyphs (best),
//                              optional extras g.hot 0..1 (orange glow on the broken edge), g.L (a light, else neutral).
// Materials: steel = brushed metal (directional grain, anisotropic sheen under the bulb), chamfered bevel, 4 dome
// rivets, cream stencil paint (Stencil 900); amber = thick satin paint, pillowed edge, dark brown letterpress letters
// (Satoshi 900), effort tremble (st.shake, on twos) and sweat beads (st.sweat). Thickness = layers offset away from the
// bulb; contact + cast shadows on the cloth. After the stamp (steel): cracks glowing orange (st.crack), P A S gone
// (st.lost), « REÇU » re-centres (st.recentre), violet enamel spreads from the impact (st.paint), ✓ stamped (st.tick).
// Text is always drawn live (vector, crisp at any scale); only the metal/paint faces are cached sprites (1.5×).
// Deterministic (rnd), no ctx.filter. Cost (flushed, this renderer): ≈ 3–5 ms per plate at rest, ≈ 8 ms for the steel
// while the enamel spreads over the cracks; PL_glyph ≈ 1.5 ms (2 ms hot). Shadows are stacked solid footprints, glows
// stacked strokes: a pushed-shadow blur (softPath) silently vanishes under rotation once ctx.filter has been set.
// =============================================================================================
const PL_ = { SS: 1.5, spr: {}, lay: {}, mc: null, cracks: null };
const PL_SPEC = {
  steel: { mat: 'steel', W: 760, H: 236, R: 12, depth: 18, bevel: 11, rivet: 27, rr: 10.5, fam: 'Stencil', size: 176, ls: -2, nudge: -6, txt: 'PAS REÇU.', seed: 3 },
  proof: { mat: 'steel', W: 744, H: 196, R: 12, depth: 16, bevel: 10, rivet: 24, rr: 9.5, fam: 'Stencil', size: 146, ls: -1, nudge: -2, txt: 'LA PREUVE ?', seed: 7 },
  amber: { mat: 'amber', W: 744, H: 186, R: 30, depth: 22, bevel: 16, fam: 'Satoshi', size: 130, ls: -1, nudge: 7, maxText: 650, txt: "J'AI PAYÉ !", seed: 5 },
  // ep4 kinds (multi-line)
  toi: { key: 'toi', mat: 'amber', W: 640, H: 236, R: 30, depth: 22, bevel: 16, fam: 'Satoshi', size: 112, ls: -1, nudge: 7, maxText: 560, lh: 1.0, txt: 'IL A CHANGÉ|DE COMPTE.', seed: 5 },
  honest: { key: 'honest', mat: 'steel', W: 760, H: 300, R: 12, depth: 18, bevel: 11, rivet: 27, rr: 10.5, fam: 'Stencil', size: 150, ls: -1, nudge: -2, maxText: 640, lh: 1.0, txt: "JE N'AI|RIEN CHANGÉ.", seed: 9 },
};
const PL_CREAM = [246, 238, 222], PL_ORANGE = [255, 92, 28], PL_BROWN = [42, 22, 6];
const PL_c01 = x => Math.max(0, Math.min(1, x));
const PL_kk = (t, a, b) => PL_c01((t - a) / (b - a));
const PL_mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const PL_rgb = (c, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0])) | 0},${Math.max(0, Math.min(255, c[1])) | 0},${Math.max(0, Math.min(255, c[2])) | 0},${a})`;
const PL_smooth = (a, b, x) => { const k = PL_c01((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// ---------- text layout (measured once per kind + text) ----------
function PL_m(font, s) { if (!PL_.mc) PL_.mc = makeCanvas(8, 8).getContext('2d'); const g = PL_.mc; g.font = font; g.letterSpacing = '0px'; return g.measureText(s); }
function PL_layout(kind, txt, forceSize) {
  const key = kind + '|' + txt + '|' + (forceSize || ''); if (PL_.lay[key]) return PL_.lay[key];
  const sp = PL_SPEC[kind] || PL_SPEC.steel, fontAt = z => `900 ${z.toFixed(2)}px ${sp.fam}`;
  if (!forceSize && txt.includes('|')) {               // ep4: several lines at one common size, block centred on the face
    const parts = txt.split('|'), n = parts.length, lhK = sp.lh || 1;
    let size = Math.min(...parts.map(q => PL_layout(kind, q).size));
    const cap0 = PL_m(fontAt(100), 'H').actualBoundingBoxAscent / 100;            // cap height per px of size
    size = Math.min(size, (sp.H - 64) / (cap0 * (1 + (n - 1) * 1.42 * lhK)));      // the block fits the face height
    const lines = parts.map(q => PL_layout(kind, q, size)), capH = lines[0].capH, lh = capH * 1.42 * lhK;
    const out = { multi: true, size, font: lines[0].font, capH, lh, fam: sp.fam, w: Math.max(...lines.map(l => l.w)),
      lines: lines.map((lo, i) => ({ lo, dy: (i - (n - 1) / 2) * lh })) };
    out.base = lines[0].base + out.lines[0].dy; out.glyphs = [];
    let gi = 0; for (const L of out.lines) for (const g of L.lo.glyphs) out.glyphs.push({ ...g, i: gi++, dy: L.dy });
    return (PL_.lay[key] = out);
  }
  const adv = z => {
    const f = fontAt(z), out = [];
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i], n = txt[i + 1];
      let a = n ? PL_m(f, c + n).width - PL_m(f, n).width : PL_m(f, c).width;   // advance incl. kerning with the next
      if (c === ' ' && (n === '!' || n === '?')) a *= .5;                        // tight French space before ! ?
      if (c === '!' && n === '!') a -= .075 * z;                                   // « !!! » packed like a shout
      if (n) a += sp.ls * z / sp.size;
      out.push(a);
    }
    return out;
  };
  let size = forceSize || sp.size, A = adv(size), w = A.reduce((p, q) => p + q, 0);
  if (!forceSize && sp.maxText && w > sp.maxText) { size = sp.size * sp.maxText / w; A = adv(size); w = A.reduce((p, q) => p + q, 0); }
  const font = fontAt(size), capH = PL_m(font, 'H').actualBoundingBoxAscent, base = capH / 2 + sp.nudge * size / sp.size;
  let x = -w / 2; const glyphs = [];
  for (let i = 0; i < txt.length; i++) { glyphs.push({ ch: txt[i], i, x0: x, adv: A[i], cx: x + A[i] / 2 }); x += A[i]; }
  return (PL_.lay[key] = { size, font, capH, base, w, glyphs, fam: sp.fam });
}
function PL_glyphs(kind, txt) {
  const sp = PL_SPEC[kind] || PL_SPEC.steel, lo = PL_layout(PL_SPEC[kind] ? kind : 'steel', txt || sp.txt);
  return lo.glyphs.map(g => ({ ch: g.ch, i: g.i, x: g.cx, y: lo.base + (g.dy || 0) - lo.capH / 2, w: g.adv, h: lo.capH, size: lo.size, font: lo.font, baseline: lo.base + (g.dy || 0) }));
}

// ---------- light ----------
/** multiply tint (0..1 rgb) for a tungsten intensity k and the brand violet v: plates are heroes, never sink in the night */
function PL_tintK(k, v) {
  const I = .62 + .38 * Math.min(1, k * 1.6);
  let r = I, g = I * (.965 - .045 * k), b = I * (.93 - .09 * k);
  const vv = v * .45; r += (.86 * I - r) * vv; g += (.78 * I - g) * vv; b += (1.0 * I - b) * vv;
  return [r, g, b];
}
function PL_tintAt(x, y, L) { const q = lightAt(x, y, L); return PL_tintK(q.k, q.v); }
/** the painted letters: brighter, and the brand violet only grazes them (cream must stay cream, readable) */
function PL_inkTint(x, y, L) { const q = lightAt(x, y, L), t = PL_tintK(Math.min(1, q.k * 1.4), q.v * .22); return [.3 + .7 * t[0], .3 + .7 * t[1], .28 + .7 * t[2]]; }
const PL_lit = (c, tn) => [c[0] * tn[0], c[1] * tn[1], c[2] * tn[2]];

// ---------- transform helpers ----------
function PL_apply(P, ox = 0, oy = 0) { ctx.translate(P.x + ox, P.y + oy); if (P.rot) ctx.rotate(P.rot); ctx.scale(P.sxx, P.syy); }
/** world → plate-local (no translation of the plate itself: dx, dy are world offsets from the plate centre) */
function PL_toLocal(P, dx, dy) { const c = Math.cos(P.rot), s = Math.sin(P.rot); return { x: (dx * c + dy * s) / P.sxx, y: (-dx * s + dy * c) / P.syy }; }
/** thickness vector (world px): away from the bulb, mostly "down" the table */
function PL_depthVec(P, sp, L) {
  const dx = P.x - L.x, dy = P.y - L.y, len = Math.hypot(dx, dy) || 1, d = sp.depth * Math.sqrt(Math.max(.02, Math.abs(P.sxx * P.syy)));
  return { x: dx / len * d * .5, y: Math.max(.35, dy / len) * d };
}

// ---------- procedural textures (sprites built once) ----------
function PL_brushed(w, h, seed) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  const N1 = new Float32Array(4096); for (let i = 0; i < 4096; i++) N1[i] = rnd(seed * 11.31 + i * .917);
  const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = N1[i & 4095]; return a + (N1[(i + 1) & 4095] - a) * u; };
  const rowA = new Float32Array(h), rowP = new Float32Array(h), rowF = new Float32Array(h);
  for (let y = 0; y < h; y++) { rowA[y] = rnd(seed + y * 1.7311) - .5; rowP[y] = rnd(seed * 3.1 + y * 7.17) * 3000; rowF[y] = .006 + rnd(seed + y * 3.37) * .03; }
  for (let y = 0; y < h; y++) {
    const ra = rowA[y] * .55 + (rowA[y - 1] || 0) * .25 + (rowA[y + 1] || 0) * .2;
    const band = (vn(y * .045 + seed * 5) - .5) * 22;                       // broad bands across the brushing
    for (let x = 0; x < w; x++) {
      const v = 128 + band + ra * 30 + (vn(x * rowF[y] + rowP[y]) - .5) * 34 + (rnd(x * 1.31 + y * 91.7 + seed) - .5) * 16;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0); return c;
}
function PL_noise(w, h, seed, amp) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  for (let i = 0; i < w * h; i++) { const v = 128 + (rnd(i * .713 + seed) - .5) * amp; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
function PL_rivets(sp) { const x = sp.W / 2 - sp.rivet, y = sp.H / 2 - sp.rivet; return [[-x, -y], [x, -y], [-x, y], [x, y]]; }
function PL_sprite(kind) {
  if (PL_.spr[kind]) return PL_.spr[kind];
  const sp = PL_SPEC[kind], S = PL_.SS, pad = 6, W = sp.W, H = sp.H;
  const cw = Math.ceil((W + 2 * pad) * S), chh = Math.ceil((H + 2 * pad) * S);
  const mk = () => { const c = makeCanvas(cw, chh), g = c.getContext('2d'); g.scale(S, S); g.translate(W / 2 + pad, H / 2 + pad); return [c, g]; };
  const out = { pad };
  if (sp.mat === 'steel') {
    let [c, g] = mk(); PL_paintSteel(g, sp); out.face = c; [c, g] = mk(); PL_paintRelief(g, sp); out.relief = c;
    [c, g] = mk(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(out.face, 0, 0); g.drawImage(out.relief, 0, 0); out.both = c;
  }
  else { const [c, g] = mk(); PL_paintAmber(g, sp); out.face = c; }
  return (PL_.spr[kind] = out);
}
function PL_paintSteel(g, sp) {
  const W = sp.W, H = sp.H, sd = sp.seed;
  g.save(); rrectOn(g, -W / 2, -H / 2, W, H, sp.R); g.clip();
  const lg = g.createLinearGradient(0, -H / 2, 0, H / 2);
  lg.addColorStop(0, '#87919D'); lg.addColorStop(.42, '#6C7581'); lg.addColorStop(1, '#525A65');
  g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = .85;
  g.drawImage(PL_brushed(Math.ceil(W * PL_.SS), Math.ceil(H * PL_.SS), sd), -W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {                       // mottling: the plate has lived
    const x = (rnd(sd * 9 + i * 3.1) - .5) * W, y = (rnd(sd * 7 + i * 5.3) - .5) * H, r = 40 + rnd(i * 2.9 + sd) * 140;
    const rg = g.createRadialGradient(x, y, 0, x, y, r), dark = rnd(i * 4.7 + sd) > .5;
    rg.addColorStop(0, dark ? 'rgba(20,24,30,.10)' : 'rgba(230,236,242,.07)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {                       // scratches, mostly along the brushing
    const x = (rnd(sd * 13 + i * 1.7) - .5) * W, y = (rnd(sd * 17 + i * 2.3) - .5) * H;
    const a = (rnd(i * 3.3 + sd) - .5) * (rnd(i * 5.1) > .85 ? 2.4 : .25), l = 8 + rnd(i * 6.7 + sd) * 70;
    g.strokeStyle = rnd(i * 8.1 + sd) > .4 ? `rgba(235,240,246,${.10 + rnd(i) * .14})` : `rgba(18,20,26,${.12 + rnd(i * 2) * .12})`;
    g.lineWidth = .5 + rnd(i * 9.3) * .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // worn edges: lighter specks along the rim
  for (let i = 0; i < 70; i++) {
    const side = i % 4, u = rnd(i * 4.4 + sd) - .5, e = 3 + rnd(i * 2.2) * 9;
    const x = side < 2 ? u * W : (side === 2 ? -W / 2 + e : W / 2 - e), y = side < 2 ? (side === 0 ? -H / 2 + e : H / 2 - e) : u * H;
    g.fillStyle = `rgba(225,230,236,${.08 + rnd(i * 7.7) * .14})`; g.fillRect(x, y, 1 + rnd(i) * 5, .8 + rnd(i * 3) * 1.2);
  }
  for (const [x, y] of PL_rivets(sp)) { g.fillStyle = '#8A929C'; g.beginPath(); g.arc(x, y, sp.rr, 0, 7); g.fill(); }
  g.restore();
}
/** bevel + rivet shading as pure light/shadow: valid on bare steel AND on the violet enamel */
function PL_paintRelief(g, sp) {
  const W = sp.W, H = sp.H, b = sp.bevel, x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2;
  g.save(); rrectOn(g, x0, y0, W, H, sp.R); g.clip();
  const vg = g.createRadialGradient(0, -H * .1, H * .4, 0, -H * .1, W * .62);              // the plate's own falloff: darker ends
  vg.addColorStop(0, 'rgba(8,8,20,0)'); vg.addColorStop(1, 'rgba(8,8,20,.3)'); g.fillStyle = vg; g.fillRect(x0, y0, W, H);
  const quad = (pts, fill) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); };
  let gr = g.createLinearGradient(0, y0, 0, y0 + b); gr.addColorStop(0, 'rgba(255,255,255,.66)'); gr.addColorStop(1, 'rgba(255,255,255,.30)');
  quad([[x0, y0], [x1, y0], [x1 - b, y0 + b], [x0 + b, y0 + b]], gr);
  gr = g.createLinearGradient(0, y1 - b, 0, y1); gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,.62)');
  quad([[x0, y1], [x1, y1], [x1 - b, y1 - b], [x0 + b, y1 - b]], gr);
  quad([[x0, y0], [x0 + b, y0 + b], [x0 + b, y1 - b], [x0, y1]], 'rgba(255,255,255,.16)');
  quad([[x1, y0], [x1 - b, y0 + b], [x1 - b, y1 - b], [x1, y1]], 'rgba(0,0,0,.30)');
  g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(x0 + sp.R, y0 + .9); g.lineTo(x1 - sp.R, y0 + .9); g.stroke();
  g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.30)'; rrectOn(g, x0 + b, y0 + b, W - 2 * b, H - 2 * b, Math.max(2, sp.R - b)); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.14)'; rrectOn(g, x0 + b + .5, y0 + b + 1.2, W - 2 * b - 1, H - 2 * b - 1, Math.max(2, sp.R - b)); g.stroke();
  for (const [x, y] of PL_rivets(sp)) {
    const r = sp.rr;
    const gs = g.createRadialGradient(x + 2.5, y + 3.5, r * .5, x + 2.5, y + 3.5, r * 1.75);
    gs.addColorStop(0, 'rgba(0,0,0,.55)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gs; g.fillRect(x - 3 * r, y - 3 * r, 6 * r, 6 * r);
    g.beginPath(); g.arc(x, y, r + 2.3, 0, 7); g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1.4; g.stroke();
    g.beginPath(); g.arc(x, y + .6, r + 2.3, Math.PI * .1, Math.PI * .9); g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.stroke();
    const gd = g.createRadialGradient(x - r * .38, y - r * .42, 0, x, y, r * 1.04);
    gd.addColorStop(0, 'rgba(255,255,255,.95)'); gd.addColorStop(.2, 'rgba(255,255,255,.48)'); gd.addColorStop(.52, 'rgba(255,255,255,0)');
    gd.addColorStop(.84, 'rgba(0,0,0,.24)'); gd.addColorStop(1, 'rgba(0,0,0,.58)');
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = gd; g.fill();
  }
  g.restore();
}
function PL_paintAmber(g, sp) {
  const W = sp.W, H = sp.H, R = sp.R, b = sp.bevel;
  g.save(); rrectOn(g, -W / 2, -H / 2, W, H, R); g.clip();
  const lg = g.createLinearGradient(0, -H / 2, 0, H / 2);
  lg.addColorStop(0, '#FFBA42'); lg.addColorStop(.5, '#FFA51E'); lg.addColorStop(1, '#F28F0C');
  g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = .22;                 // orange-peel of thick paint
  g.drawImage(PL_noise(Math.ceil(W * PL_.SS / 2), Math.ceil(H * PL_.SS / 2), sp.seed, 60), -W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // satin: broad soft sheen high on the face, a darker belly low
  g.save(); g.translate(-W * .08, -H * .28); g.scale(1, .32);
  let rg = g.createRadialGradient(0, 0, 0, 0, 0, W * .62); rg.addColorStop(0, 'rgba(255,248,226,.34)'); rg.addColorStop(.55, 'rgba(255,242,210,.12)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = rg; g.fillRect(-W, -W, 2 * W, 2 * W); g.restore();
  const bl = g.createLinearGradient(0, 0, 0, H / 2); bl.addColorStop(0, 'rgba(140,50,0,0)'); bl.addColorStop(1, 'rgba(140,50,0,.14)'); g.fillStyle = bl; g.fillRect(-W / 2, 0, W, H / 2);
  const ve = g.createRadialGradient(0, -H * .1, H * .45, 0, -H * .1, W * .62); ve.addColorStop(0, 'rgba(120,40,0,0)'); ve.addColorStop(1, 'rgba(120,40,0,.2)'); g.fillStyle = ve; g.fillRect(-W / 2, -H / 2, W, H);
  // pillowed edge: the paint rolls over the rim (light on top, shade below)
  const vg = (a1, a2) => { const q = g.createLinearGradient(0, -H / 2, 0, H / 2); q.addColorStop(0, `rgba(255,250,228,${a1})`); q.addColorStop(.42, 'rgba(255,250,228,0)'); q.addColorStop(.58, 'rgba(110,40,0,0)'); q.addColorStop(1, `rgba(110,40,0,${a2})`); return q; };
  const hg = (a1, a2) => { const q = g.createLinearGradient(-W / 2, 0, W / 2, 0); q.addColorStop(0, `rgba(255,248,224,${a1})`); q.addColorStop(.1, 'rgba(255,248,224,0)'); q.addColorStop(.9, 'rgba(110,40,0,0)'); q.addColorStop(1, `rgba(110,40,0,${a2})`); return q; };
  for (let i = 0; i < b; i++) {
    const f = Math.pow(1 - i / b, 1.7);
    g.lineWidth = 1.25; rrectOn(g, -W / 2 + i + .5, -H / 2 + i + .5, W - 2 * i - 1, H - 2 * i - 1, Math.max(2, R - i));
    g.strokeStyle = vg(.62 * f, .5 * f); g.stroke(); g.strokeStyle = hg(.2 * f, .26 * f); g.stroke();
  }
  g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,252,236,.7)'; g.beginPath(); g.moveTo(-W / 2 + R, -H / 2 + 1.2); g.lineTo(W / 2 - R, -H / 2 + 1.2); g.stroke();
  g.restore();
}

// ---------- cracks (steel, after the stamp) ----------
function PL_jag(ways, seed, amp, seg = 10) {
  const pts = [ways[0].slice()];
  for (let i = 1; i < ways.length; i++) {
    const [ax, ay] = ways[i - 1], [bx, by] = ways[i], L = Math.hypot(bx - ax, by - ay) || 1, n = Math.max(1, Math.round(L / seg)), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let k = 1; k <= n; k++) { const f = k / n, j = k === n ? 0 : (rnd(seed + i * 31.7 + k * 7.31) - .5) * 2 * amp; pts.push([ax + (bx - ax) * f + nx * j, ay + (by - ay) * f + ny * j]); }
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1], seed };
}
function PL_crackData() {
  if (PL_.cracks) return PL_.cracks;
  const sp = PL_SPEC.steel, lo = PL_layout('steel', sp.txt), g = lo.glyphs, H = sp.H, W = sp.W, base = lo.base, cap = lo.capH;
  const yB = H / 2, top = -H / 2, xPA = g[1].x0, xAS = g[2].x0, xSR = g[3].cx;
  // three cracks from the impact (bottom middle) cut P, A and S loose; the first one splits « PAS » from « REÇU »
  const mains = [
    [[0, yB], [-12, yB - 20], [-33, base + 13], [xSR + 3, base - 6], [xSR - 2, base - cap * .35], [xSR + 3, base - cap * .68], [xSR - 1, top]],
    [[0, yB], [-30, yB - 16], [-80, base + 7], [-118, base - cap * .22], [xAS + 2, base - cap * .5], [xAS - 3, base - cap * .8], [xAS + 3, top]],
    [[0, yB], [-52, yB - 9], [-140, base + 15], [-200, base - cap * .16], [xPA + 2, base - cap * .55], [xPA - 3, base - cap * .84], [xPA + 2, top]],
  ].map((w, i) => ({ ...PL_jag(w, 101 + i * 17, i === 0 ? 1.8 : 3.4, 9), delay: i * .14, w0: 12, w1: 3.6 }));
  const branches = [];
  const add = (i, f, ang, l, sd) => {
    const m = mains[i], k = Math.max(1, m.cum.findIndex(c => c >= f * m.len)), p = m.pts[k], q = m.pts[k - 1];
    const a = Math.atan2(p[1] - q[1], p[0] - q[0]) + ang;
    branches.push({ ...PL_jag([p, [p[0] + Math.cos(a) * l * .55 + 3, p[1] + Math.sin(a) * l * .55], [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]], sd, 2.2, 8), main: i, at: f, w0: 5, w1: 1.4 });
  };
  add(1, .3, .9, 30, 402); add(1, .62, -1.0, 26, 403); add(1, .86, .9, 20, 404);
  add(2, .22, .8, 34, 405); add(2, .45, -1.0, 36, 406); add(2, .9, -.9, 22, 407); add(0, .8, 1.0, 14, 408);
  // P also comes loose: a crack from the P|A seam runs through P's foot to the plate's left edge
  const m2 = mains[2], k2 = m2.cum.findIndex(c => c >= .62 * m2.len);
  branches.push({ ...PL_jag([m2.pts[k2], [g[0].cx, base - cap * .05], [-W / 2 + 2, base + 4]], 409, 3.4, 9), main: 2, at: .62, w0: 7, w1: 2.4 });
  return (PL_.cracks = { mains, branches });
}
/** a tapered, ragged ribbon along crack c up to length Lp (adds a closed sub-path); returns the tip */
function PL_ribbon(c, Lp, k = 1, grow = 0) {
  const { pts, cum } = c; if (Lp <= .5) return null;
  const Lf = [], Rt = []; let tip = null;
  for (let i = 0; i < pts.length; i++) {
    let p = pts[i], sv = cum[i];
    if (sv >= Lp) { const f = i ? (Lp - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1) : 0; p = i ? [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f] : p; sv = Lp; }
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (c.w0 + (c.w1 - c.w0) * sv / c.len) * (.7 + .6 * rnd(i * 3.71 + c.seed)) * .5 * k * Math.min(1, .12 + (Lp - sv) / 22) + grow;
    Lf.push([p[0] - dy * w, p[1] + dx * w]); Rt.push([p[0] + dy * w, p[1] - dx * w]);
    if (sv >= Lp) { tip = p; break; }
  }
  ctx.moveTo(Lf[0][0], Lf[0][1]); for (const q of Lf) ctx.lineTo(q[0], q[1]); for (let i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]); ctx.closePath();
  return tip || pts[pts.length - 1];
}
function PL_crackProg(crack) {
  const D = PL_crackData();
  const mp = D.mains.map(m => 1 - Math.pow(1 - PL_c01((crack - m.delay) / (1 - m.delay)), 2));
  const bp = D.branches.map(b => PL_c01((mp[b.main] - b.at) / .25));
  return { D, mp, bp };
}
function PL_crackPath(crack, k = 1, grow = 0) {
  const { D, mp, bp } = PL_crackProg(crack), tips = [];
  D.mains.forEach((m, i) => { if (mp[i] > 0) { const p = PL_ribbon(m, mp[i] * m.len, k, grow); if (p && mp[i] < 1) tips.push(p); } });
  D.branches.forEach((b, i) => { if (bp[i] > 0) PL_ribbon(b, bp[i] * b.len, k, grow); });
  return tips;
}
/** the fissures cut into the metal (under the enamel): dark gash, a lit lower lip, the impact dent */
function PL_crackGrooves(crack, H) {
  ctx.save();
  ctx.beginPath(); ctx.translate(0, 1.6); PL_crackPath(crack, 1, .6); ctx.translate(0, -1.6); ctx.fillStyle = 'rgba(235,240,248,.28)'; ctx.fill();
  ctx.beginPath(); PL_crackPath(crack, 1); ctx.fillStyle = 'rgba(8,5,10,.96)'; ctx.fill();
  const rg = ctx.createRadialGradient(0, H / 2, 0, 0, H / 2, 34); rg.addColorStop(0, 'rgba(6,4,8,.75)'); rg.addColorStop(1, 'rgba(6,4,8,0)');
  ctx.fillStyle = rg; ctx.fillRect(-40, H / 2 - 40, 80, 40);
  ctx.restore();
}
/** molten glow inside the fissures (emissive: drawn after the light pass, only where no enamel yet) */
function PL_crackGlow(crack, heat) {
  if (heat <= .01) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [g, a] of [[9, .1], [5.5, .14], [2.5, .2]]) {     // stacked halo (a pushed-shadow blur vanishes under rotation in this Chromium)
    ctx.beginPath(); PL_crackPath(crack, 1, g); ctx.fillStyle = `rgba(255,78,12,${(a * heat).toFixed(3)})`; ctx.fill();
  }
  ctx.beginPath(); PL_crackPath(crack, .55); ctx.fillStyle = `rgba(255,96,24,${(.95 * heat).toFixed(3)})`; ctx.fill();
  ctx.beginPath(); const tips = PL_crackPath(crack, .22); ctx.fillStyle = `rgba(255,214,150,${(.9 * heat).toFixed(3)})`; ctx.fill();
  for (const p of tips) {                                // the running tips are white-hot
    const rg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 16); rg.addColorStop(0, `rgba(255,244,220,${heat})`); rg.addColorStop(.3, `rgba(255,120,40,${.6 * heat})`); rg.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = rg; ctx.fillRect(p[0] - 16, p[1] - 16, 32, 32);
  }
  ctx.restore();
}

// ---------- violet enamel (steel, after the stamp) ----------
function PL_blob(cx, cy, R, t) {
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2;
    const r = R * (1 + .075 * Math.sin(5 * a + 2.1 + t * 1.6) + .05 * Math.sin(9 * a + .7 - t * 2.1) + .03 * Math.sin(17 * a + 4 + t));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .9; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function PL_enamelGrad(H, g = ctx) {
  const eg = g.createLinearGradient(0, -H / 2, 0, H / 2); eg.addColorStop(0, '#9C70FF'); eg.addColorStop(.45, '#7A42F8'); eg.addColorStop(1, '#5222CC'); return eg;
}
/** the fully painted face (enamel + bevel/rivet relief), cached */
function PL_enamel(kind) {
  const A = PL_sprite(kind); if (A.enamel) return A.enamel;
  const sp = PL_SPEC[kind], c = makeCanvas(A.relief.width, A.relief.height), g = c.getContext('2d'), S = PL_.SS;
  g.scale(S, S); g.translate(sp.W / 2 + A.pad, sp.H / 2 + A.pad); rrectOn(g, -sp.W / 2, -sp.H / 2, sp.W, sp.H, sp.R); g.fillStyle = PL_enamelGrad(sp.H, g); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(A.relief, 0, 0);
  return (A.enamel = c);
}

// ---------- the stencil ✓ ----------
/** two bars (stencil bridge between them); (x, y) = bottom-left of the tick's box */
function PL_tickPolys(x, y, w, h, th) {
  const P1 = [x + .04 * w, y - .5 * h], V = [x + .38 * w, y - .1 * h], P3 = [x + .97 * w, y - .93 * h], hw = th / 2, gap = 6;
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  const d2 = unit(V, P3), pp = [-d2[1], d2[0]], d1 = unit(P1, V), p1 = [-d1[1], d1[0]];
  const B = [V[0] - d2[0] * hw * .95, V[1] - d2[1] * hw * .95];
  const long = [[B[0] + pp[0] * hw, B[1] + pp[1] * hw], [P3[0] + pp[0] * hw, P3[1] + pp[1] * hw], [P3[0] - pp[0] * hw, P3[1] - pp[1] * hw], [B[0] - pp[0] * hw, B[1] - pp[1] * hw]];
  const c = -hw - gap, dd = d1[0] * pp[0] + d1[1] * pp[1];
  const end = A => { const s = (c - ((A[0] - V[0]) * pp[0] + (A[1] - V[1]) * pp[1])) / dd; return [A[0] + d1[0] * s, A[1] + d1[1] * s]; };
  const A1 = [P1[0] + p1[0] * hw, P1[1] + p1[1] * hw], A2 = [P1[0] - p1[0] * hw, P1[1] - p1[1] * hw];
  return [long, [A1, end(A1), end(A2), A2]];
}
function PL_tickPath(polys) {
  ctx.beginPath();
  for (const q of polys) { ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); }
}

// ---------- sweat (amber) ----------
function PL_drop(x, y, r, e, a) {
  if (r < .6 || a <= .01) return;
  ctx.save(); ctx.globalAlpha *= a;
  const tip = y - r * (1 + e * 1.1);
  const shape = (ox, oy, k = 1) => { ctx.beginPath(); ctx.moveTo(x + ox, tip + oy); ctx.bezierCurveTo(x + ox + r * .5 * k, y + oy - r * 1.05, x + ox + r * k, y + oy - r * .5, x + ox + r * k, y + oy);
    ctx.arc(x + ox, y + oy, r * k, 0, Math.PI); ctx.bezierCurveTo(x + ox - r * k, y + oy - r * .5, x + ox - r * .5 * k, y + oy - r * 1.05, x + ox, tip + oy); ctx.closePath(); };
  shape(1.4, 2.6); ctx.fillStyle = 'rgba(96,36,0,.30)'; ctx.fill();                                   // its shadow on the paint
  shape(0, 0); const rg = ctx.createRadialGradient(x + r * .25, y + r * .35, 0, x, y - r * .2, r * 1.5);
  rg.addColorStop(0, 'rgba(255,248,214,.8)'); rg.addColorStop(.45, 'rgba(255,206,100,.16)'); rg.addColorStop(.8, 'rgba(140,56,0,.38)'); rg.addColorStop(1, 'rgba(96,34,0,.7)');
  ctx.fillStyle = rg; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(86,30,0,.55)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(x - r * .36, y - r * .38, r * .26, r * .17, -.6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x + r * .42, y + r * .46, r * .1, 0, 7); ctx.fill();
  ctx.restore();
}
function PL_sweat(sp, sweat, t) {
  if (sweat <= .005) return;
  const W = sp.W, H = sp.H, N = 7, top = -H / 2 + 16, bot = H / 2 - 10;
  // beads forming along the top edge (the forehead)
  for (let i = 0; i < 5; i++) {
    const x = -W / 2 + 80 + (i + .3 + .4 * rnd(i * 4.1)) * (W - 160) / 5, a = PL_c01(sweat * 6 - i * .8);
    const r = (10 + 6 * rnd(i * 2.3)) * (.6 + .4 * a) * (1 + .06 * Math.sin(t * 3 + i));
    PL_drop(x, top + 2 + rnd(i * 6.6) * 5, r, .1, a);
  }
  // drops that run down the face, leave a wet trail, fall off the bottom edge and form again
  for (let i = 0; i < N; i++) {
    const vis = PL_c01(sweat * (N + 1) - i); if (vis <= 0) continue;
    const x = -W / 2 + 56 + (i + .2 + .6 * rnd(i * 7.1)) * (W - 112) / N;
    const rate = .22 + .16 * rnd(i * 5.3), u = ((t * rate + rnd(i * 9.7)) % 1 + 1) % 1;
    const y = top + (bot - top) * Math.pow(u, 1.9), grow = PL_c01(u / .16), fade = 1 - PL_c01((u - .9) / .1);
    const r = (12 + 7 * rnd(i * 2.9)) * (.35 + .65 * grow), e = .3 + 1.4 * Math.pow(u, 1.2);
    if (y - top > 6) {                                   // wet trail: darker, glossier paint
      ctx.save(); ctx.globalAlpha *= vis * fade; ctx.lineCap = 'round';
      const tg = ctx.createLinearGradient(0, top, 0, y); tg.addColorStop(0, 'rgba(150,64,0,0)'); tg.addColorStop(1, 'rgba(150,64,0,.20)');
      ctx.strokeStyle = tg; ctx.lineWidth = r * .75; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + Math.sin(y * .05 + i) * 1.5, y - r); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,225,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - r * .2, top + 4); ctx.lineTo(x - r * .2, y - r * 1.4); ctx.stroke();
      ctx.restore();
    }
    PL_drop(x, y, r, e, vis * fade);
  }
}

// ---------- shadows + thickness ----------
/** soft shadow from stacked translucent footprints (solid fills: ~10x cheaper than a blur or an image in this renderer) */
function PL_softFoot(sp, P, ox, oy, blur, a, n = 6) {
  if (a <= .005) return;
  const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n), W = sp.W, H = sp.H;
  ctx.save(); PL_apply(P, ox, oy); ctx.fillStyle = `rgba(6,3,14,${al.toFixed(4)})`;
  for (let i = 0; i < n; i++) { const g = -blur * .55 + blur * 1.6 * i / (n - 1); rrect(-W / 2 - g, -H / 2 - g, W + 2 * g, H + 2 * g, Math.max(2, sp.R + g)); ctx.fill(); }
  ctx.restore();
}
function PL_body(kind, sp, P, L, z, sideCols) {
  const W = sp.W, H = sp.H, R = sp.R;
  const q = lightAt(P.x, P.y, L), d = PL_depthVec(P, sp, L);
  // cast shadow: offset away from the bulb, softer and further with height; straight down under the brand light
  const o1 = shadowOff(P.x, P.y, z, L), o2 = { x: 0, y: 10 + z * .5 }, v = PL_c01(q.v);
  const ox = o1.x + (o2.x - o1.x) * v, oy = o1.y + (o2.y - o1.y) * v;
  const a1 = (.62 * Math.max(q.k, .35) + .3 * v + .16) * (1 - Math.min(.5, z / 300));
  PL_softFoot(sp, P, ox + d.x * .6, oy + d.y * .6, 9 + z * .22, Math.min(.8, a1), 6);
  // contact: tight and dark right under the slab
  PL_softFoot(sp, P, d.x, d.y + 3, 5, .72, 3);
  // thickness: the slab's side, layers marching away from the bulb
  const n = Math.max(4, Math.ceil(Math.hypot(d.x, d.y) / 1.3));
  for (let i = n; i >= 1; i--) {
    const f = i / n; ctx.save(); PL_apply(P, d.x * f, d.y * f);
    ctx.fillStyle = PL_rgb(PL_mix(sideCols[0], sideCols[1], Math.pow(f, .8))); rrect(-W / 2, -H / 2, W, H, R); ctx.fill(); ctx.restore();
  }
  // the lower lip of the side catches a thin rim of light
  ctx.save(); PL_apply(P, d.x, d.y); ctx.beginPath(); ctx.moveTo(-W / 2 + R, H / 2 - .8); ctx.lineTo(W / 2 - R, H / 2 - .8);
  ctx.lineWidth = 1.2 / Math.max(.3, P.syy); ctx.strokeStyle = PL_rgb(sideCols[2], .55); ctx.stroke(); ctx.restore();
}
/** tungsten / brand light: one solid multiply over the face with the light at the plate (in-plate falloff is baked) */
function PL_lightPass(sp, P, L) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = PL_rgb(PL_mul255(PL_tintAt(P.x, P.y, L)));
  rrect(-sp.W / 2, -sp.H / 2, sp.W, sp.H, sp.R); ctx.fill(); ctx.restore();
}
const PL_mul255 = c => [c[0] * 255, c[1] * 255, c[2] * 255];
function PL_devScale() { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }

// ---------- letters ----------
/** cream stencil paint: a soft dark under-shadow for separation, a crisp dark paint edge, the cream fill */
function PL_creamGlyphs(items, col, sc) {
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  ctx.shadowColor = 'rgba(6,3,12,.6)'; ctx.shadowBlur = 6 * sc; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3.5 * sc;
  for (const it of items) { if (it.a <= .01) continue; ctx.globalAlpha = it.a; ctx.font = it.font; ctx.fillStyle = 'rgba(10,6,16,.55)'; ctx.fillText(it.ch, it.x, it.y + 1.5); }
  ctx.shadowColor = 'transparent'; ctx.lineJoin = 'round';
  for (const it of items) {
    if (it.a <= .01) continue; ctx.globalAlpha = it.a; ctx.font = it.font;
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(16,12,22,.5)'; ctx.strokeText(it.ch, it.x, it.y);
    ctx.fillStyle = it.col || col; ctx.fillText(it.ch, it.x, it.y);
  }
  ctx.restore();
}

// ---------- steel family (« PAS REÇU. », « LA PREUVE ? ») ----------
function PL_steelFace(kind, sp, P, st, t, L) {
  const W = sp.W, H = sp.H, A = PL_sprite(kind), pad = A.pad, T = (window.SCORE || {}).T || {}, sc = PL_devScale();
  const isSteel = kind === 'steel', crack = isSteel ? PL_c01(st.crack || 0) : 0, paint = isSteel ? PL_c01(st.paint || 0) : 0;
  const tn = PL_tintAt(P.x, P.y, L), Rb = paint * 620, iy = H / 2, full = paint >= .999, part = paint > 0 && !full;
  const facePath = () => rrect(-W / 2, -H / 2, W, H, sp.R);
  const spr = c => ctx.drawImage(c, -W / 2 - pad, -H / 2 - pad, W + 2 * pad, H + 2 * pad);
  const bl = PL_toLocal(P, L.x - P.x, L.y - P.y), on = L.on * (.6 + .4 * lightAt(P.x, P.y, L).k);
  if (full) spr(PL_enamel(kind));                          // all violet: one cached sprite (enamel + relief)
  else {
    spr(part ? A.face : A.both);
    if (part) {                                            // violet enamel flowing from the impact point
      ctx.save(); facePath(); ctx.clip();
      ctx.beginPath(); PL_blob(0, iy, Rb, t); ctx.fillStyle = PL_enamelGrad(H); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(36,10,100,.5)'; ctx.stroke();                 // the wet lip of the flow
      ctx.translate(0, -1.5); ctx.beginPath(); PL_blob(0, iy, Math.max(0, Rb - 5), t); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(226,212,255,.6)'; ctx.stroke();
      ctx.restore();
      spr(A.relief);
    }
  }
  PL_lightPass(sp, P, L);
  if (!full) {                                             // anisotropic streak on the brushed steel, moving with the swaying bulb
    ctx.save(); if (part) { ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); PL_blob(0, iy, Rb, t); ctx.clip('evenodd'); }
    facePath(); ctx.clip();
    const shc = PL_mix([255, 246, 228], [214, 200, 255], PL_c01(L.violet) * .7), sg = ctx.createLinearGradient(bl.x - 300, 0, bl.x + 300, 0);
    sg.addColorStop(0, PL_rgb(shc, 0)); sg.addColorStop(.3, PL_rgb(shc, .05 * on)); sg.addColorStop(.44, PL_rgb(shc, .13 * on)); sg.addColorStop(.5, PL_rgb(shc, .3 * on));
    sg.addColorStop(.56, PL_rgb(shc, .13 * on)); sg.addColorStop(.7, PL_rgb(shc, .05 * on)); sg.addColorStop(1, PL_rgb(shc, 0));
    const x0s = Math.max(-W / 2, bl.x - 300), x1s = Math.min(W / 2, bl.x + 300);
    if (x1s > x0s) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = sg; ctx.fillRect(x0s, -H / 2, x1s - x0s, H); }
    ctx.restore();
  }
  if (paint > 0) {                                         // glossy enamel: a sharp reflection of the bulb, a glint as the ✓ lands
    ctx.save(); facePath(); ctx.clip(); if (part) { ctx.beginPath(); PL_blob(0, iy, Rb, t); ctx.clip(); }
    const gg = ctx.createLinearGradient(bl.x - 140, -H / 2, bl.x + 60, H / 2);
    gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.45, 'rgba(240,232,255,.2)'); gg.addColorStop(.52, 'rgba(250,246,255,.3)'); gg.addColorStop(.6, 'rgba(240,232,255,.12)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(-W / 2, -H / 2, W, H);
    const dt = t - (T.check ?? 1e9);
    if (dt > 0 && dt < .9) {
      const k = PL_smooth(0, 1, dt / .9), cx = -W / 2 - 160 + (W + 320) * k, sw = ctx.createLinearGradient(cx - 70, -40, cx + 70, 40);
      sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(.5, `rgba(255,255,255,${(.42 * Math.sin(Math.PI * k)).toFixed(3)})`); sw.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sw; ctx.fillRect(-W / 2, -H / 2, W, H);
    }
    ctx.restore();
  }
  if (isSteel && T.stamp !== undefined) {                 // the stamp's hit: a white-orange flash at the impact
    const dt = t - T.stamp;
    if (dt >= 0 && dt < .4) {
      const a = Math.pow(1 - dt / .4, 2), rg = ctx.createRadialGradient(0, iy - 4, 0, 0, iy - 4, 150);
      rg.addColorStop(0, `rgba(255,236,200,${(.9 * a).toFixed(3)})`); rg.addColorStop(.25, `rgba(255,130,50,${(.5 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.save(); facePath(); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(-150, iy - 154, 300, 160); ctx.restore();
    }
  }
  // ---- letters ----
  const txt = st.txt || sp.txt, lo = PL_layout(kind, txt), cream = PL_lit(PL_CREAM, PL_inkTint(P.x, P.y, L)), items = [];
  if (!isSteel) {
    const orange = PL_lit(PL_ORANGE, [Math.min(1, tn[0] * 1.08), Math.min(1, tn[1] * 1.04), tn[2]]);
    const LN = lo.multi ? lo.lines : [{ lo, dy: 0 }];
    for (const { lo: l1, dy } of LN) for (const g of l1.glyphs) if (g.ch !== ' ') items.push({ ch: g.ch, x: g.x0, y: l1.base + dy, font: l1.font, a: 1, col: g.ch === '?' ? PL_rgb(orange) : null, q: g.ch === '?', g, dy, l1 });
    const q = items.find(i => i.q);
    if (q) {
      const gq = q.g, cx = gq.cx, cy = q.l1.base + q.dy - q.l1.capH / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 1.35); const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 78);
      rg.addColorStop(0, 'rgba(255,92,24,.42)'); rg.addColorStop(.5, 'rgba(255,80,20,.14)'); rg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(-78, -78, 156, 156); ctx.restore();
    }
    PL_creamGlyphs(items, PL_rgb(cream), sc);
    return;
  }
  const lost = Math.max(0, Math.min(3, Math.floor(st.lost || 0))), rec = PL_c01(st.recentre || 0), tick = PL_c01(st.tick || 0);
  const F = PL_finalSteel(lo), size = lo.size * (1 + (F.TS - 1) * rec), font = `900 ${size.toFixed(2)}px Stencil`;
  const base = lo.base + (F.base - lo.base) * rec;
  for (const g of lo.glyphs) {
    if (g.ch === ' ' || (g.i < 3 && g.i < lost)) continue;
    const x = g.x0 + ((F.x0[g.i] ?? g.x0) - g.x0) * rec;
    items.push({ ch: g.ch, x, y: base, font, a: g.ch === '.' ? 1 - PL_smooth(0, .7, tick) : 1 });
  }
  PL_creamGlyphs(items, PL_rgb(cream), sc);
  if (crack > 0 && paint < .999) {                       // the fissures run through the metal and P, A, S — never where the enamel has flowed
    const heat = (1 - .5 * PL_kk(t, (T.stamp || 0) + .45, (T.check || 0) + .3)) * (.95 + .05 * Math.sin(t * 9));
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); if (paint > 0) PL_blob(0, iy, Rb, t); ctx.clip('evenodd'); facePath(); ctx.clip();
    PL_crackGrooves(crack, H); PL_crackGlow(crack, heat);
    ctx.restore();
  }
  if (tick > 0) {
    const k = PL_c01(tick), s = 1 + .45 * Math.pow(1 - k, 2), a = PL_c01(k * 2.2);
    const tx = F.tick.x + F.tick.w / 2, ty = F.base - F.tick.h / 2;
    ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-tx, -ty); ctx.globalAlpha *= a;
    const tp = PL_tickPolys(F.tick.x, F.base, F.tick.w, F.tick.h, F.tick.th);
    ctx.save(); ctx.translate(0, 1.5); ctx.shadowColor = 'rgba(6,3,12,.6)'; ctx.shadowBlur = 6 * sc; ctx.shadowOffsetY = 3.5 * sc; PL_tickPath(tp); ctx.fillStyle = 'rgba(10,6,16,.55)'; ctx.fill(); ctx.restore();
    PL_tickPath(tp); ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(16,12,22,.5)'; ctx.stroke();
    ctx.fillStyle = PL_rgb(cream); ctx.fill();
    ctx.restore();
  }
}
/** where « REÇU » + ✓ end up once P, A, S are gone: centred, a touch larger */
function PL_finalSteel(lo) {
  if (lo.fin) return lo.fin;
  const TS = 1.06, g = lo.glyphs, R = g[4], U = g[7], gap = .1 * lo.size * TS;
  const wordW = (U.x0 + U.adv - R.x0) * TS, tw = .86 * lo.capH * TS, th = .235 * lo.capH * TS;
  const left = -(wordW + gap + tw) / 2, x0 = {};
  for (let i = 4; i < g.length; i++) x0[i] = left + (g[i].x0 - R.x0) * TS;
  const capC = lo.base - lo.capH / 2 - 2, base = capC + lo.capH * TS / 2;
  return (lo.fin = { TS, x0, base, tick: { x: left + wordW + gap, w: tw, h: lo.capH * TS * .9, th } });
}

// ---------- amber (« J'AI PAYÉ ! » …) ----------
function PL_amberFace(sp, P, st, t, L) {
  const W = sp.W, H = sp.H, A = PL_sprite(sp.key || 'amber'), pad = A.pad, sc = PL_devScale(), tn = PL_tintAt(P.x, P.y, L);
  ctx.drawImage(A.face, -W / 2 - pad, -H / 2 - pad, W + 2 * pad, H + 2 * pad);
  PL_lightPass(sp, P, L);
  // live satin sheen under the bulb
  const bl = PL_toLocal(P, L.x - P.x, L.y - P.y), on = L.on * (.6 + .4 * lightAt(P.x, P.y, L).k);
  ctx.save(); rrect(-W / 2, -H / 2, W, H, sp.R); ctx.clip();
  const sg = ctx.createLinearGradient(bl.x - 260, 0, bl.x + 260, 0);
  sg.addColorStop(0, 'rgba(255,248,230,0)'); sg.addColorStop(.5, `rgba(255,248,230,${(.13 * on).toFixed(3)})`); sg.addColorStop(1, 'rgba(255,248,230,0)');
  ctx.fillStyle = sg; ctx.fillRect(-W / 2, -H / 2, W / 1, H * .55);
  ctx.restore();
  // letters: dark brown letterpress (a lit lip below each letter, the ink on top)
  const txt = st.txt || sp.txt, lo = PL_layout(sp.key || 'amber', txt), ink = PL_lit(PL_BROWN, tn), lip = PL_lit([255, 222, 150], tn);
  const LN = lo.multi ? lo.lines : [{ lo, dy: 0 }];
  ctx.save(); ctx.font = lo.font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  ctx.fillStyle = PL_rgb(lip, .75); for (const { lo: l1, dy } of LN) for (const g of l1.glyphs) if (g.ch !== ' ') ctx.fillText(g.ch, g.x0, l1.base + dy + 2.6);
  ctx.fillStyle = PL_rgb(ink); for (const { lo: l1, dy } of LN) for (const g of l1.glyphs) if (g.ch !== ' ') ctx.fillText(g.ch, g.x0, l1.base + dy);
  ctx.restore();
  PL_sweat(sp, PL_c01(st.sweat || 0), t);
}

// ---------- public ----------
function PL_plate(kind, st, t, L) {
  const sp = PL_SPEC[kind]; if (!st || !sp || (st.a ?? 1) <= 0) return;
  const S = window.SCORE;
  L = L || (S ? S.light(t) : { x: 540, y: 330, on: 1, violet: 0 });
  let x = st.x, y = st.y, rot = st.rot || 0;
  const shake = st.shake || 0;
  if (shake > 0) {                                        // effort tremble, on twos (frame-quantised: sub-frames agree)
    const n = Math.floor(Math.round(t * 30) / 2);
    x += (rnd(n * 1.73 + 11) - .5) * 10 * shake; y += (rnd(n * 2.31 + 5) - .5) * 7 * shake; rot += (rnd(n * 3.17 + 7) - .5) * .016 * shake;
  }
  const s = st.s ?? 1, P = { x, y, rot, sxx: s * (st.sx ?? 1), syy: s * (st.sy ?? 1) };
  if (kind === 'amber') {                                 // flattened like a crêpe: the paint squeezes out wider than what sits on it
    const r = P.syy / Math.max(1e-3, P.sxx); if (r < .5) P.sxx *= 1 + (.5 - r) * 2.2;
  }
  if (Math.abs(P.sxx) < 1e-3 || Math.abs(P.syy) < 1e-3) return;
  // height above the cloth (drives the cast shadow): the steel floats when suspended / bounced up
  let z = st.z != null ? st.z : kind === 'amber' ? 13 : kind === 'proof' ? 20 : 22;
  if (kind === 'steel' && S) {
    const A = S.amber(t);
    if (A) { const gap = (A.y - S.G.plateH.amber / 2 * A.s * A.sy) - (y + sp.H / 2 * P.syy); z += PL_c01(gap / 260) * 60; }
    else z += 40;
  }
  const tn = PL_tintAt(x, y, L);
  let sideCols;
  if (sp.mat === 'amber') sideCols = [PL_lit([214, 116, 10], tn), PL_lit([120, 52, 4], tn), PL_lit([255, 196, 110], tn)];
  else {
    const pk = kind === 'steel' ? PL_smooth(.6, .98, st.paint || 0) : 0;
    sideCols = [PL_lit(PL_mix([78, 84, 94], [86, 46, 196], pk), tn), PL_lit(PL_mix([30, 33, 39], [36, 16, 92], pk), tn), PL_lit(PL_mix([170, 178, 188], [170, 140, 255], pk), tn)];
  }
  ctx.save(); ctx.globalAlpha *= (st.a ?? 1);
  PL_body(kind, sp, P, L, z, sideCols);
  ctx.save(); PL_apply(P);
  if (sp.mat === 'amber') PL_amberFace(sp, P, st, t, L); else PL_steelFace(kind, sp, P, st, t, L);
  ctx.restore();
  ctx.restore();
}

/** one glyph of a plate's material, centred on its box centre at (0, 0) — for the falling / flying letters */
function PL_glyph(kind, ch, g) {
  const k = PL_SPEC[kind] ? kind : 'steel', sp = PL_SPEC[k], lo = PL_layout(k, sp.txt);
  let box = g && g.w ? g : null;
  if (!box) { const f = PL_glyphs(k, sp.txt).find(q => q.ch === ch); box = f || { x: 0, y: lo.base - lo.capH / 2, w: PL_m(lo.font, ch).width, h: lo.capH, font: lo.font, baseline: lo.base }; }
  const w = box.w, h = box.h, font = box.font || lo.font, hot = PL_c01((g && g.hot) || 0), sc = PL_devScale();
  const tn = g && g.L ? PL_tintAt(g.L.x, g.L.y + 400, g.L) : [1, .96, .9];
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  if (sp.mat === 'steel') {
    const seed = ch.charCodeAt(0) * 13.7 + (box.i || 0) * 3.1, mx = w / 2 + 11, my = h / 2 + 15, pts = [];
    const edge = (x0, y0, x1, y1, n0) => { const L2 = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L2 / 13)); for (let i = 0; i < n; i++) { const f = i / n, j = (rnd(seed + n0 + i * 1.91) - .5) * 9; pts.push([x0 + (x1 - x0) * f + (y1 - y0) / L2 * j, y0 + (y1 - y0) * f - (x1 - x0) / L2 * j]); } };
    const cx = (rnd(seed) - .5) * 8, cy = (rnd(seed + 1) - .5) * 8;
    edge(-mx + cx, -my, mx, -my + cy, 10); edge(mx, -my + cy, mx - cx, my, 30); edge(mx - cx, my, -mx, my - cy, 50); edge(-mx, my - cy, -mx + cx, -my, 70);
    const poly = (ox = 0, oy = 0) => { ctx.beginPath(); ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy); for (const p of pts) ctx.lineTo(p[0] + ox, p[1] + oy); ctx.closePath(); };
    for (const [o, a] of [[13, .12], [10, .16], [7, .22]]) { poly(o * .35, o); ctx.fillStyle = `rgba(5,2,12,${a})`; ctx.fill(); }      // soft drop shadow (stacked, cheap)
    for (let i = 7; i >= 1; i--) { poly(i * .3, i * 1.1); ctx.fillStyle = PL_rgb(PL_lit(PL_mix([80, 86, 96], [32, 35, 41], i / 7), tn)); ctx.fill(); }
    const A = PL_sprite(k), pad = A.pad;
    ctx.save(); poly(); ctx.clip();
    {                                                     // only the patch of metal the letter broke from
      const S = PL_.SS, x0 = Math.max(0, (box.x - mx - 12 + sp.W / 2 + pad) * S), y0 = Math.max(0, (box.y - my - 12 + sp.H / 2 + pad) * S);
      const w0 = Math.min(A.face.width - x0, (2 * mx + 24) * S), h0 = Math.min(A.face.height - y0, (2 * my + 24) * S);
      ctx.drawImage(A.face, x0, y0, w0, h0, x0 / S - box.x - sp.W / 2 - pad, y0 / S - box.y - sp.H / 2 - pad, w0 / S, h0 / S);
    }
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = PL_rgb(PL_mul255(tn)); ctx.fillRect(-mx - 10, -my - 10, 2 * mx + 20, 2 * my + 20);
    ctx.restore();
    poly(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(8,6,12,.55)'; ctx.stroke();
    ctx.save(); ctx.translate(0, .9); ctx.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p[1] < 0) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke(); ctx.restore();
    if (hot > 0) {                                        // the fresh break still glows (stacked strokes: robust under rotation)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; poly();
      for (const [lw, a] of [[16, .1], [9, .16], [4.5, .3]]) { ctx.lineWidth = lw; ctx.strokeStyle = `rgba(255,84,16,${(a * hot).toFixed(3)})`; ctx.stroke(); }
      ctx.lineWidth = 1.1; ctx.strokeStyle = `rgba(255,214,160,${hot})`; ctx.stroke(); ctx.restore();
    }
    PL_creamGlyphs([{ ch, x: -w / 2, y: h / 2 + (box.baseline - (box.y + h / 2)), font, a: 1 }], PL_rgb(PL_lit(PL_CREAM, tn)), sc);
  } else {
    const mx = w / 2 + 14, my = h / 2 + 18, d = 9;
    for (const [o, a] of [[15, .12], [11, .16], [8, .22]]) { ctx.fillStyle = `rgba(5,2,12,${a})`; rrect(-mx + o * .35, -my + o, 2 * mx, 2 * my, 14); ctx.fill(); }
    for (let i = 6; i >= 1; i--) { ctx.fillStyle = PL_rgb(PL_lit(PL_mix([214, 116, 10], [120, 52, 4], i / 6), tn)); rrect(-mx, -my + d * i / 6, 2 * mx, 2 * my, 14); ctx.fill(); }
    const lg = ctx.createLinearGradient(0, -my, 0, my); lg.addColorStop(0, PL_rgb(PL_lit([255, 190, 76], tn))); lg.addColorStop(1, PL_rgb(PL_lit([242, 143, 12], tn)));
    ctx.fillStyle = lg; rrect(-mx, -my, 2 * mx, 2 * my, 14); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,248,226,.6)'; ctx.beginPath(); ctx.moveTo(-mx + 12, -my + 1.2); ctx.lineTo(mx - 12, -my + 1.2); ctx.stroke();
    const by = h / 2 + (box.baseline - (box.y + h / 2));
    ctx.font = font; ctx.fillStyle = PL_rgb(PL_lit([255, 222, 150], tn), .75); ctx.fillText(ch, -w / 2, by + 2.6);
    ctx.fillStyle = PL_rgb(PL_lit(PL_BROWN, tn)); ctx.fillText(ch, -w / 2, by);
  }
  ctx.restore();
}
