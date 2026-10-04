'use strict';
// =============================================================================================
// MODULE RC — the Bonzini moment: a glossy violet enamel plate « BONZINI PAIE / TON FOURNISSEUR ✓ » that lands
// softly, catches a reflection, then opens like a folded card into the receipt « PREUVE DE PAIEMENT », which rises
// and stamps the steel from below, then shrinks and is pinned on the amber plate.
//   RC_draw(st, t, L)   st = SCORE.violetPlate(t) = {x, y, s, sx, sy, rot, a, unfold, pinned, sweep}
//     unfold 0      enamel plate 760×300 (s = 1): cream roundel with the logo, « BONZINI PAIE » (Satoshi 900),
//                   « TON FOURNISSEUR ✓ » (Satoshi 900, vector tick), « en Chine · Bénéficiaire payé » (Martian 500),
//                   cream pinstripe border with scalloped corners and 4 screw eyelets; sweep 0..1 = a reflection band.
//     0 < unfold < 1  fake 3D: the plate is the cover of a folded receipt hinged at its lower edge; it lifts toward
//                   the camera (perspective-widened slices, shading, glint, edge band), stands edge-on, and falls
//                   open below the hinge showing its inside (the receipt body); the header underneath is revealed.
//     unfold 1      receipt 640×410 (s = 1): violet header (logo roundel, « PREUVE » / « DE PAIEMENT »), body
//                   « Bénéficiaire payé ✓ » pill, 3 redacted grey rows (no amount, name, date or reference),
//                   a soft violet « PAYÉ » stamp mark, torn zig-zag foot. The top ~95 px of the header carry nothing
//                   to read: that strip slides under the steel when the receipt stamps it. Height 410 = the most that
//                   fits between the steel (G.steelSusp) and the « É » accent of « J'AI PAYÉ. » once it has stamped.
//     pinned        an amber push pin pressed into its top-left corner (fixed size in world px).
// All text is drawn live (vector, crisp at any scale), never baked — except during the 0.4 s unfold, where the
// panels are sliced sprites (2×). Shadows = stacked solid footprints (no ctx.filter, no pushed-shadow blur).
// Deterministic (rnd). Cost (flushed) ≈ 5 ms per call for the plate, 3 ms unfolding, 5–6 ms receipt, 2 ms pinned.
// =============================================================================================
const RC_ = { SS: 2, spr: {}, lay: null, mc: null };
const RC_P = { W: 760, H: 300, R: 26, depth: 16, inset: 18, rc: 17 };          // the enamel plate
const RC_R = { W: 640, H: 410, R: 16, hdr: 230, depth: 4, tooth: 16, td: 7 };   // the receipt: header 230 + body 180
const RC_CREAM = [255, 246, 230], RC_INK = [40, 20, 104];
const RC_c01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const RC_kk = (t, a, b) => RC_c01((t - a) / (b - a));
const RC_sm = (a, b, x) => { const k = RC_c01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const RC_lerp = (a, b, k) => a + (b - a) * k;
const RC_mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const RC_rgb = (c, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0])) | 0},${Math.max(0, Math.min(255, c[1])) | 0},${Math.max(0, Math.min(255, c[2])) | 0},${a})`;
const RC_mul = (c, tn) => [c[0] * tn[0], c[1] * tn[1], c[2] * tn[2]];

// ---------- light ----------
/** multiply tint (0..1) at a table point: the plates are heroes, they never sink into the night */
function RC_tint(x, y, L, floor = .68) {
  const q = lightAt(x, y, L), k = Math.min(1, q.k * 1.5), v = RC_c01(q.v);
  const I = floor + (1 - floor) * k;
  let r = I, g = I * (.972 - .04 * k), b = I * (.94 - .08 * k);
  const vv = v * .4; r += (.88 * I - r) * vv; g += (.82 * I - g) * vv; b += (1 * I - b) * vv;
  return [r, g, b];
}
/** printed / enamelled light inks: brighter floor, the brand violet only grazes them */
function RC_inkTint(x, y, L) { const q = RC_tint(x, y, L, .82); return [.25 + .75 * q[0], .25 + .75 * q[1], .25 + .75 * q[2]]; }
function RC_devScale() { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }

// ---------- text layout (measured once) ----------
function RC_m(font, s, ls = 0) { if (!RC_.mc) RC_.mc = makeCanvas(8, 8).getContext('2d'); const g = RC_.mc; g.font = font; g.letterSpacing = ls + 'px'; const m = g.measureText(s); g.letterSpacing = '0px'; return m; }
function RC_layout() {
  if (RC_.lay) return RC_.lay;
  const unit = (fam, w, s) => RC_m(`${w} 100px ${fam}`, s).width / 100;
  const cap = (fam, w) => RC_m(`${w} 100px ${fam}`, 'H').actualBoundingBoxAscent / 100;
  // --- plate: two lines justified to the same width (a solid block), the roundel opens line 1 ---
  const BW = 652, cS = cap('Satoshi', 900);
  const u2 = unit('Satoshi', 900, 'TON FOURNISSEUR'), gap2 = 16, tickR = .9;             // tick box = .9 cap wide
  const s2 = (BW - gap2) / (u2 + tickR * cS);
  const u1 = unit('Satoshi', 900, 'BONZINI PAIE'), dR = 1.36, gap1 = 22;                // roundel Ø = 1.36 cap1
  const s1 = (BW - gap1) / (u1 + dR * cS);
  const c1 = cS * s1, c2 = cS * s2, D1 = dR * c1, ms = 30, cM = cap('Martian', 500) * ms;
  const g12 = 26, g23 = 27, desc = .24 * ms, tot = D1 + g12 + c2 + g23 + cM + desc;
  const top = -tot / 2 + 3;
  const plate = {
    s1, s2, c1, c2, D1, f1: `900 ${s1.toFixed(2)}px Satoshi`, f2: `900 ${s2.toFixed(2)}px Satoshi`, fM: `500 ${ms}px Martian`,
    rx: -BW / 2 + D1 / 2, ry: top + D1 / 2, x1: -BW / 2 + D1 + gap1, b1: top + D1 / 2 + c1 / 2,
    x2: -BW / 2, b2: top + D1 + g12 + c2, tick: { x: BW / 2 - tickR * c2, w: tickR * c2, h: c2 },
    bM: top + D1 + g12 + c2 + g23 + cM, wM: RC_m(`500 ${ms}px Martian`, 'en Chine · Bénéficiaire payé').width,
  };
  // --- receipt header: roundel + « PREUVE » (big) over « DE PAIEMENT » (tracked to the same width) ---
  const RH = RC_R.H, hTop = -RH / 2, hBot = hTop + RC_R.hdr;
  const sP = 86, cP = cS * sP, wP = RC_m(`900 ${sP}px Satoshi`, 'PREUVE').width;
  const sD = 40, cD = cS * sD, wD0 = RC_m(`900 ${sD}px Satoshi`, 'DE PAIEMENT').width, lsD = (wP - wD0) / 10;
  const DR = 100, gR = 26, gw = DR + gR + wP, gx = -gw / 2;
  // the top ~95 px of the header slide under the steel when the receipt stamps it: nothing to read up there
  const vis0 = hTop + 96, vis1 = hBot - 14, blk = cP + 18 + cD, bt = (vis0 + vis1) / 2 - blk / 2;
  const sB = 31, wB = RC_m(`500 ${sB}px Martian`, 'Bénéficiaire payé').width, cB = cap('Martian', 500) * sB;
  const pillW = wB + 44 + 46 + 18, pillH = 60, pillY = hBot + 36;
  const receipt = {
    hTop, hBot, fP: `900 ${sP}px Satoshi`, fD: `900 ${sD}px Satoshi`, lsD, cP, cD, wP,
    rx: gx + DR / 2, ry: bt + blk / 2, DR, tx: gx + DR + gR, bP: bt + cP, bD: bt + cP + 18 + cD,
    fB: `500 ${sB}px Martian`, wB, cB, pillW, pillH, pillY,
  };
  return (RC_.lay = { plate, receipt });
}

// ---------- shapes ----------
function RC_receiptPath(g, W, H, R, toothed = true, top = -H / 2, bot = H / 2) {
  const x0 = -W / 2, x1 = W / 2, td = RC_R.td;
  g.beginPath(); g.moveTo(x0 + R, top); g.lineTo(x1 - R, top); g.arcTo(x1, top, x1, top + R, R);
  if (toothed) {
    g.lineTo(x1, bot - td); const n = Math.max(2, Math.round(W / RC_R.tooth)), st = W / n;
    for (let i = n; i > 0; i--) { g.lineTo(x0 + (i - .5) * st, bot); g.lineTo(x0 + (i - 1) * st, bot - td); }
  } else { g.lineTo(x1, bot); g.lineTo(x0, bot); }
  g.lineTo(x0, top + R); g.arcTo(x0, top, x0 + R, top, R); g.closePath();
}
/** enamel pinstripe with scalloped (concave) corners around the screw holes */
function RC_pinPath(g, W, H, ins, rc) {
  const x0 = -W / 2 + ins, x1 = W / 2 - ins, y0 = -H / 2 + ins, y1 = H / 2 - ins;
  g.beginPath(); g.moveTo(x0 + rc, y0); g.lineTo(x1 - rc, y0); g.arc(x1, y0, rc, Math.PI, Math.PI / 2, true);
  g.lineTo(x1, y1 - rc); g.arc(x1, y1, rc, -Math.PI / 2, -Math.PI, true);
  g.lineTo(x0 + rc, y1); g.arc(x0, y1, rc, 0, -Math.PI / 2, true);
  g.lineTo(x0, y0 + rc); g.arc(x0, y0, rc, Math.PI / 2, 0, true); g.closePath();
}

// ---------- sprites (built once, 2×) ----------
function RC_mk(w, h, pad = 4) { const S = RC_.SS, c = makeCanvas(Math.ceil((w + 2 * pad) * S), Math.ceil((h + 2 * pad) * S)), g = c.getContext('2d'); g.scale(S, S); g.translate(w / 2 + pad, h / 2 + pad); return { c, g, w, h, pad }; }
function RC_blit(o, x = 0, y = 0) { ctx.drawImage(o.c, x - o.w / 2 - o.pad, y - o.h / 2 - o.pad, o.w + 2 * o.pad, o.h + 2 * o.pad); }
function RC_noise(w, h, seed, amp, mid = 128) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  for (let i = 0; i < w * h; i++) { const v = mid + (rnd(i * .913 + seed) - .5) * amp; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
/** soft (blurred) fill on an offscreen context: the shape is pushed out of frame, only its blurred shadow lands */
function RC_softOn(g, path, blur, color) {
  g.save(); const push = 4000; g.shadowColor = color; g.shadowBlur = blur * RC_.SS; g.shadowOffsetX = -push * RC_.SS; g.shadowOffsetY = 0;
  g.translate(push, 0); path(); g.fillStyle = '#000'; g.fill(); g.restore();
}
/** the cream enamel roundel (base only; the logo is drawn live on top) */
function RC_roundelOn(g, x, y, D, rim = '#5A2AE0') {
  const r = D / 2;
  g.save();
  g.beginPath(); g.arc(x, y + 2.5, r + 1.5, 0, 7); g.fillStyle = 'rgba(16,4,50,.55)'; g.fill();          // seat shadow
  const rg = g.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
  rg.addColorStop(0, '#FFFDF7'); rg.addColorStop(.7, '#FBF3E3'); rg.addColorStop(1, '#E9DCC4');
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = rg; g.fill();
  g.beginPath(); g.arc(x, y, r - 5.5, 0, 7); g.lineWidth = 2.6; g.strokeStyle = rim; g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
  g.beginPath(); g.arc(x, y, r - .8, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
  g.restore();
}
function RC_plateFace() {
  if (RC_.spr.plate) return RC_.spr.plate;
  const P = RC_P, W = P.W, H = P.H, o = RC_mk(W, H), g = o.g, lo = RC_layout().plate;
  g.save(); rrectOn(g, -W / 2, -H / 2, W, H, P.R); g.clip();
  const lg = g.createLinearGradient(0, -H / 2, 0, H / 2);
  lg.addColorStop(0, '#8F62FF'); lg.addColorStop(.45, '#682CF3'); lg.addColorStop(1, '#3E10B2');
  g.fillStyle = lg; g.fillRect(-W / 2, -H / 2, W, H);
  let rg = g.createRadialGradient(-W * .12, -H * .05, 10, 0, 0, W * .62);                      // depth of the glass
  rg.addColorStop(0, 'rgba(180,150,255,.16)'); rg.addColorStop(.6, 'rgba(120,80,255,0)'); rg.addColorStop(1, 'rgba(20,4,70,.38)');
  g.fillStyle = rg; g.fillRect(-W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = .1;                                 // the faint orange-peel of fired enamel
  g.drawImage(RC_noise(Math.ceil(W / 2), Math.ceil(H / 2), 31, 70), -W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // rolled rim: the enamel flows over the edge (light on top, deep below)
  const b = 13, vg = (a1, a2) => { const q = g.createLinearGradient(0, -H / 2, 0, H / 2); q.addColorStop(0, `rgba(236,226,255,${a1})`); q.addColorStop(.4, 'rgba(236,226,255,0)'); q.addColorStop(.6, 'rgba(18,2,60,0)'); q.addColorStop(1, `rgba(18,2,60,${a2})`); return q; };
  const hg = (a1, a2) => { const q = g.createLinearGradient(-W / 2, 0, W / 2, 0); q.addColorStop(0, `rgba(236,226,255,${a1})`); q.addColorStop(.1, 'rgba(236,226,255,0)'); q.addColorStop(.9, 'rgba(18,2,60,0)'); q.addColorStop(1, `rgba(18,2,60,${a2})`); return q; };
  for (let i = 0; i < b; i++) {
    const f = Math.pow(1 - i / b, 1.8); g.lineWidth = 1.25; rrectOn(g, -W / 2 + i + .5, -H / 2 + i + .5, W - 2 * i - 1, H - 2 * i - 1, Math.max(2, P.R - i));
    g.strokeStyle = vg(.55 * f, .6 * f); g.stroke(); g.strokeStyle = hg(.22 * f, .3 * f); g.stroke();
  }
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(246,240,255,.85)'; g.beginPath(); g.moveTo(-W / 2 + P.R, -H / 2 + 1.2); g.lineTo(W / 2 - P.R, -H / 2 + 1.2); g.stroke();
  // cream pinstripe, scalloped around the screw eyelets
  g.save(); g.translate(0, 1.6); RC_pinPath(g, W, H, P.inset, P.rc); g.lineWidth = 4.2; g.strokeStyle = 'rgba(20,4,70,.45)'; g.stroke(); g.restore();
  RC_pinPath(g, W, H, P.inset, P.rc); g.lineWidth = 3.6; g.strokeStyle = '#F6ECDB'; g.stroke();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                               // screw eyelets
    const x = sx * (W / 2 - P.inset), y = sy * (H / 2 - P.inset), r = 6.2;
    g.beginPath(); g.arc(x + .8, y + 1.6, r + 1.6, 0, 7); g.fillStyle = 'rgba(14,2,50,.55)'; g.fill();
    const cg = g.createRadialGradient(x - 2, y - 2.4, .5, x, y, r + 1); cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(.35, '#D9D6E4'); cg.addColorStop(1, '#6E6A80');
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = cg; g.fill();
    g.save(); g.translate(x, y); g.rotate(.6 + sx * .5 + sy * .3); g.fillStyle = 'rgba(40,36,56,.75)'; g.fillRect(-r * .75, -.9, r * 1.5, 1.8); g.restore();
  }
  RC_roundelOn(g, lo.rx, lo.ry, lo.D1);
  g.restore();
  return (RC_.spr.plate = o);
}
/** receipt header background (violet, guilloche); the content is drawn live (or into the unfold sprite) */
function RC_hdrBg(g, W, top, bot, R) {
  g.save(); RC_receiptPath(g, W, bot - top, R, false, top, bot); g.clip();
  const lg = g.createLinearGradient(0, top, 0, bot); lg.addColorStop(0, '#8456FF'); lg.addColorStop(.55, '#6B31F4'); lg.addColorStop(1, '#5524DA');
  g.fillStyle = lg; g.fillRect(-W / 2, top, W, bot - top);
  g.lineWidth = 1.1; g.strokeStyle = 'rgba(255,255,255,.075)';                                 // guilloche: fine security waves
  for (let j = 0; j < 22; j++) {
    g.beginPath();
    for (let x = -W / 2; x <= W / 2; x += 6) { const y = top + 8 + j * 9.2 + 5.5 * Math.sin(x * .031 + j * .55) + 3 * Math.sin(x * .011 - j * .8); x === -W / 2 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
  const sh = g.createLinearGradient(0, top, 0, top + 70); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(-W / 2, top, W, 70);
  const lip = g.createLinearGradient(0, bot - 10, 0, bot); lip.addColorStop(0, 'rgba(20,0,80,0)'); lip.addColorStop(1, 'rgba(20,0,80,.35)');
  g.fillStyle = lip; g.fillRect(-W / 2, bot - 10, W, 10);
  g.restore();
}
/** the whole receipt face without its live text (paper, header, pill base, redacted rows, stamp mark) */
function RC_receiptFace() {
  if (RC_.spr.rec) return RC_.spr.rec;
  const W = RC_R.W, H = RC_R.H, o = RC_mk(W, H), g = o.g, lo = RC_layout().receipt;
  RC_paperOn(g, W, H, lo.hBot);
  RC_hdrBg(g, W, -H / 2, lo.hBot, RC_R.R);
  RC_roundelOn(g, lo.rx, lo.ry, lo.DR, '#6B31F4');
  RC_bodyDecorOn(g, W, H, lo);
  return (RC_.spr.rec = o);
}
function RC_paperOn(g, W, H, from) {
  g.save(); RC_receiptPath(g, W, H, RC_R.R); g.clip();
  g.fillStyle = '#FBF6EC'; g.fillRect(-W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = .5; g.drawImage(RC_noise(Math.ceil(W / 2), Math.ceil(H / 2), 57, 22, 238), -W / 2, -H / 2, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (let i = 0; i < 260; i++) {                                                               // paper fibres
    const x = (rnd(i * 1.37 + 5) - .5) * W, y = from + rnd(i * 2.71 + 9) * (H / 2 - from), a = rnd(i * 3.9) * Math.PI, l = 3 + rnd(i * 4.3) * 9;
    g.strokeStyle = rnd(i * 5.1) > .5 ? 'rgba(140,110,80,.07)' : 'rgba(255,255,255,.5)'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const cu = g.createLinearGradient(0, H / 2 - 60, 0, H / 2); cu.addColorStop(0, 'rgba(90,60,120,0)'); cu.addColorStop(1, 'rgba(90,60,120,.10)');   // a hint of curl at the foot
  g.fillStyle = cu; g.fillRect(-W / 2, H / 2 - 60, W, 60);
  g.restore();
}
function RC_tickPath(g, x, y, w, h) {             // a check mark in the box (x, y = bottom-left), stroke it
  g.beginPath(); g.moveTo(x + w * .06, y - h * .46); g.lineTo(x + w * .38, y - h * .1); g.lineTo(x + w * .96, y - h * .92);
}
function RC_bodyDecorOn(g, W, H, lo) {
  const pw = lo.pillW, ph = lo.pillH, py = lo.pillY;
  g.save(); RC_receiptPath(g, W, H, RC_R.R); g.clip();
  g.fillStyle = '#ECE4FF'; rrectOn(g, -pw / 2, py - ph / 2, pw, ph, ph / 2); g.fill();
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(107,49,244,.28)'; g.stroke();
  const cx = pw / 2 - 22 - 21, r = 21;                                                         // the ✓ disc closes the pill
  g.beginPath(); g.arc(cx, py, r, 0, 7); g.fillStyle = '#6B31F4'; g.fill();
  g.lineWidth = 5.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#FFF8EC'; RC_tickPath(g, cx - 11, py + 10, 22, 20); g.stroke();
  // perforation between the pill and the redacted rows
  g.fillStyle = 'rgba(80,60,110,.28)'; for (let x = -W / 2 + 34; x < W / 2 - 30; x += 13) { g.beginPath(); g.arc(x, py + 44, 2, 0, 7); g.fill(); }
  // three redacted rows: a label and a value, both blurred to nothing — no amount, no name, no date, no reference
  const rows = [[118, 236], [92, 184], [134, 214]];
  rows.forEach(([lw, vw], i) => {
    const y = py + 64 + i * 24;
    RC_softOn(g, () => { rrectOn(g, -W / 2 + 40, y - 7, lw, 14, 7); }, 4.5, 'rgba(120,108,140,.42)');
    RC_softOn(g, () => { rrectOn(g, W / 2 - 40 - vw, y - 8, vw, 16, 8); }, 5, 'rgba(96,84,120,.5)');
  });
  // a soft violet stamp mark, rotated, starved ink
  const sx = W / 2 - 122, sy = py + 84;
  g.save(); g.translate(sx, sy); g.rotate(-.22); g.scale(.82, .82); g.globalCompositeOperation = 'multiply';
  g.strokeStyle = 'rgba(107,49,244,.55)'; g.fillStyle = 'rgba(107,49,244,.55)';
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 48, 0, 7); g.stroke();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 53, Math.sin(a) * 53, 1.6, 0, 7); g.fill(); }
  g.font = '900 34px Stencil'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PAYÉ', 0, 2);
  g.lineWidth = 3; g.beginPath(); g.moveTo(-34, -22); g.lineTo(34, -22); g.moveTo(-34, 25); g.lineTo(34, 25); g.stroke();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { g.globalAlpha = .25 + rnd(i * 1.9 + 3) * .6; g.beginPath(); g.arc((rnd(i * 1.3) - .5) * 130, (rnd(i * 2.7) - .5) * 130, .6 + rnd(i * 3.1) * 1.8, 0, 7); g.fill(); }
  g.restore();
  g.restore();
}

// ---------- live content ----------
/** letters of fired cream enamel: a soft deep-violet seat for separation, then the crisp cream */
function RC_creamText(s, x, y, font, col, sc, ls = 0) {
  ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(14,2,52,.55)'; ctx.shadowBlur = 5 * sc; ctx.shadowOffsetY = 2.6 * sc;
  ctx.fillStyle = 'rgba(24,6,80,.6)'; ctx.fillText(s, x, y + 1.2);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = col; ctx.fillText(s, x, y);
  ctx.restore();
}
function RC_creamTick(x, y, w, h, col, sc, lw) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = lw;
  ctx.shadowColor = 'rgba(14,2,52,.55)'; ctx.shadowBlur = 5 * sc; ctx.shadowOffsetY = 2.6 * sc;
  ctx.strokeStyle = 'rgba(24,6,80,.6)'; RC_tickPath(ctx, x, y + 1.2, w, h); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = col; RC_tickPath(ctx, x, y, w, h); ctx.stroke();
  ctx.restore();
}
function RC_plateText(cream, sc, logoA = 1) {
  const lo = RC_layout().plate;
  drawLogo(lo.rx, lo.ry, lo.D1 * 1.04, { alpha: logoA });
  RC_creamText('BONZINI PAIE', lo.x1, lo.b1, lo.f1, cream, sc);
  RC_creamText('TON FOURNISSEUR', lo.x2, lo.b2, lo.f2, cream, sc);
  RC_creamTick(lo.tick.x, lo.b2, lo.tick.w, lo.tick.h, cream, sc, lo.c2 * .24);
  ctx.save(); ctx.globalAlpha *= .92; RC_creamText('en Chine · Bénéficiaire payé', -lo.wM / 2, lo.bM, lo.fM, cream, sc); ctx.restore();
  // fine cream rules on either side of the sub-line
  const x = lo.wM / 2 + 14, rl = Math.min(30, RC_P.W / 2 - RC_P.inset - 16 - x);
  if (rl > 8) { ctx.save(); ctx.strokeStyle = cream; ctx.globalAlpha *= .45; ctx.lineWidth = 2; const y = lo.bM - 10;
    ctx.beginPath(); ctx.moveTo(-x, y); ctx.lineTo(-x - rl, y); ctx.moveTo(x, y); ctx.lineTo(x + rl, y); ctx.stroke(); ctx.restore(); }
}
function RC_receiptText(cream, ink, sc) {
  const lo = RC_layout().receipt;
  drawLogo(lo.rx, lo.ry, lo.DR * 1.04);
  RC_creamText('PREUVE', lo.tx, lo.bP, lo.fP, cream, sc);
  RC_creamText('DE PAIEMENT', lo.tx, lo.bD, lo.fD, cream, sc, lo.lsD);
  ctx.save(); ctx.font = lo.fB; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = ink;
  ctx.fillText('Bénéficiaire payé', -lo.pillW / 2 + 26, lo.pillY + lo.cB / 2); ctx.restore();
}

// ---------- bodies: shadow + thickness ----------
/** stacked translucent footprints = a soft shadow (path() traces the footprint in local coords) */
function RC_softFoot(P, path, ox, oy, blur, a, n = 6, fw = 700, fh = 330) {
  if (a <= .005) return;
  const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n);
  for (let i = 0; i < n; i++) {
    const gg = -blur * .55 + blur * 1.6 * i / (n - 1), kx = 1 + 2 * gg / fw, ky = 1 + 2 * gg / fh;
    ctx.save(); ctx.translate(P.x + ox, P.y + oy); ctx.rotate(P.rot); ctx.scale(P.sxx * kx, P.syy * ky);
    ctx.fillStyle = `rgba(6,3,14,${al.toFixed(4)})`; path(); ctx.fill(); ctx.restore();
  }
}
function RC_shadowOff(P, z, L) {
  const q = lightAt(P.x, P.y, L), o1 = shadowOff(P.x, P.y, z, L), o2 = { x: 0, y: 10 + z * .5 }, v = RC_c01(q.v);
  return { x: o1.x + (o2.x - o1.x) * v, y: o1.y + (o2.y - o1.y) * v, a: (.6 * Math.max(q.k, .35) + .3 * v + .16) * (1 - Math.min(.55, z / 280)) };
}
function RC_depthVec(P, depth, L) {
  const dx = P.x - L.x, dy = P.y - L.y, len = Math.hypot(dx, dy) || 1, d = depth * Math.sqrt(Math.max(.02, Math.abs(P.sxx * P.syy)));
  return { x: dx / len * d * .5, y: Math.max(.35, dy / len) * d };
}
function RC_body(P, path, z, depth, sideA, sideB, rim, L, shadowK = 1, fw = 700, fh = 330) {
  const so = RC_shadowOff(P, z, L), d = RC_depthVec(P, depth, L);
  RC_softFoot(P, path, so.x + d.x * .6, so.y + d.y * .6, 9 + z * .22, Math.min(.8, so.a) * shadowK, 6, fw, fh);
  RC_softFoot(P, path, d.x, d.y + 2.5, 4, .7 * shadowK, 3, fw, fh);
  const n = Math.max(3, Math.ceil(Math.hypot(d.x, d.y) / 1.3));
  for (let i = n; i >= 1; i--) {
    const f = i / n; ctx.save(); ctx.translate(P.x + d.x * f, P.y + d.y * f); ctx.rotate(P.rot); ctx.scale(P.sxx, P.syy);
    ctx.fillStyle = RC_rgb(RC_mix(sideA, sideB, Math.pow(f, .8))); path(); ctx.fill(); ctx.restore();
  }
  if (rim) { ctx.save(); ctx.translate(P.x + d.x, P.y + d.y); ctx.rotate(P.rot); ctx.scale(P.sxx, P.syy); path(); ctx.lineWidth = 1.2 / Math.max(.3, P.syy); ctx.strokeStyle = RC_rgb(rim, .5); ctx.stroke(); ctx.restore(); }
}
const RC_apply = P => { ctx.translate(P.x, P.y); if (P.rot) ctx.rotate(P.rot); ctx.scale(P.sxx, P.syy); };

// ---------- the enamel plate ----------
function RC_plate(P, st, t, L) {
  const T = (window.SCORE || {}).T || {}, G = (window.SCORE || {}).G || { violetY: 1000 };
  const W = RC_P.W, H = RC_P.H, R = RC_P.R, path = () => rrect(-W / 2, -H / 2, W, H, R);
  const z = 14 + Math.min(220, Math.max(0, (G.violetY - P.y)) * .3);                            // high while it drops in
  const tn = RC_tint(P.x, P.y, L);
  const dl = T.violetIn !== undefined ? t - T.violetIn : -1;
  if (dl >= -.04 && dl < .9) {                                                                     // touchdown: a soft breath of brand light on the cloth
    const a = Math.pow(RC_c01((dl + .04) / .12), .7) * Math.pow(1 - RC_c01(dl / .9), 2) * .55;
    ctx.save(); ctx.translate(P.x, P.y + 14); ctx.scale(1, .42); ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(0, 0, 120, 0, 0, 560); rg.addColorStop(0, `rgba(140,96,255,${(.5 * a).toFixed(3)})`); rg.addColorStop(.45, `rgba(120,80,255,${(.18 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(110,70,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(-560, -560, 1120, 1120); ctx.restore();
  }
  RC_body(P, path, z, RC_P.depth, RC_mul([92, 50, 200], tn), RC_mul([30, 10, 84], tn), RC_mul([190, 160, 255], tn), L, 1, W, H);
  ctx.save(); RC_apply(P);
  const sc = RC_devScale();
  RC_blit(RC_plateFace());
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = RC_rgb(RC_mul([255, 255, 255], tn)); path(); ctx.fill(); ctx.restore();
  RC_plateText(RC_rgb(RC_mul(RC_CREAM, RC_inkTint(P.x, P.y, L))), sc);
  RC_gloss(P, W, H, path, L, st.sweep || 0, t);
  ctx.restore();
}
/** glassy enamel: a lens sheen on the upper half, the bulb's reflection (it sways), the reflection sweep */
function RC_gloss(P, W, H, path, L, sweep, t) {
  ctx.save(); path(); ctx.clip();
  ctx.save(); ctx.beginPath(); ctx.ellipse(-W * .04, -H * .98, W * .8, H * .84, 0, 0, 7); ctx.clip();   // glassy lens, its lower rim an arc
  const lens = ctx.createLinearGradient(0, -H / 2, 0, -H * .14);
  lens.addColorStop(0, 'rgba(255,255,255,.2)'); lens.addColorStop(.5, 'rgba(255,255,255,.075)'); lens.addColorStop(1, 'rgba(255,255,255,.035)');
  ctx.fillStyle = lens; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
  const c = Math.cos(P.rot), s = Math.sin(P.rot), dx = L.x - P.x, dy = L.y - P.y;
  const bx = Math.max(-W / 2 + 60, Math.min(W / 2 - 60, (dx * c + dy * s) / P.sxx * .55));       // the bulb, mirrored in the glass
  ctx.globalCompositeOperation = 'screen';
  ctx.save(); ctx.translate(bx, -H / 2 + 24); ctx.scale(1, .17);
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 150); rg.addColorStop(0, `rgba(255,240,222,${(.5 * L.on).toFixed(3)})`); rg.addColorStop(.3, `rgba(255,226,200,${(.14 * L.on).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,220,190,0)');
  ctx.fillStyle = rg; ctx.fillRect(-150, -150, 300, 300); ctx.restore();
  if (sweep > 0 && sweep < 1) {                                                                  // the reflection sweep, left to right
    const k = RC_sm(0, 1, sweep), env = Math.sin(Math.PI * RC_c01(sweep)), cx = -W / 2 - 220 + (W + 440) * k;
    ctx.globalCompositeOperation = 'lighter';
    const band = (x0, wd, a) => {
      const gr = ctx.createLinearGradient(x0 - wd, 0, x0 + wd, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, `rgba(236,226,255,${(a * .45).toFixed(3)})`); gr.addColorStop(.5, `rgba(255,252,255,${a.toFixed(3)})`);
      gr.addColorStop(.58, `rgba(236,226,255,${(a * .45).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.transform(1, 0, -.42, 1, 0, 0); ctx.fillStyle = gr; ctx.fillRect(x0 - wd, -H / 2 - 4, 2 * wd, H + 8); ctx.restore();
    };
    band(cx, 150, .1 * env); band(cx, 64, .5 * env); band(cx - 112, 20, .34 * env);
  }
  ctx.restore();
}

// ---------- the receipt (flat) ----------
function RC_receipt(P, st, t, L, z) {
  const W = RC_R.W, H = RC_R.H, path = () => RC_receiptPath(ctx, W, H, RC_R.R);
  const tn = RC_tint(P.x, P.y, L, .8);
  RC_body(P, path, z, RC_R.depth, RC_mul([214, 204, 226], tn), RC_mul([150, 136, 170], tn), null, L, 1, W, H);
  ctx.save(); RC_apply(P);
  const sc = RC_devScale();
  RC_blit(RC_receiptFace());
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = RC_rgb(RC_mul([255, 255, 255], tn)); path(); ctx.fill(); ctx.restore();
  RC_receiptText(RC_rgb(RC_mul(RC_CREAM, RC_inkTint(P.x, P.y, L))), RC_rgb(RC_mul(RC_INK, RC_tint(P.x, P.y, L, .9))), sc);
  ctx.save(); path(); ctx.clip();                                                                // a satin sheen on the paper
  const gg = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2); gg.addColorStop(0, 'rgba(255,255,255,.07)'); gg.addColorStop(.5, 'rgba(255,255,255,0)'); gg.addColorStop(1, 'rgba(40,10,90,.05)');
  ctx.fillStyle = gg; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
  ctx.restore();
}

// ---------- the unfold (fake 3D) ----------
/** unfold sprites: header (with its content) and body (with its content), and the enamel face with its text */
function RC_unfoldSprites() {
  if (RC_.spr.uf) return RC_.spr.uf;
  const W = RC_R.W, H = RC_R.H, lo = RC_layout().receipt, S = RC_.SS, hdrH = RC_R.hdr, bodyH = H - hdrH;
  const mkS = (w, h) => { const c = makeCanvas(Math.ceil(w * S), Math.ceil(h * S)), g = c.getContext('2d'); g.scale(S, S); return { c, g, w, h }; };
  const withCtx = (g, fn) => { const sv = ctx; ctx = g; try { fn(); } finally { ctx = sv; } };
  const cream = RC_rgb(RC_CREAM), ink = RC_rgb(RC_INK);
  // header (local y from hTop..hBot), translated so the sprite's top = hTop
  const hd = mkS(W, hdrH); hd.g.translate(W / 2, -lo.hTop);
  RC_hdrBg(hd.g, W, lo.hTop, lo.hBot, RC_R.R); RC_roundelOn(hd.g, lo.rx, lo.ry, lo.DR, '#6B31F4');
  withCtx(hd.g, () => { drawLogo(lo.rx, lo.ry, lo.DR * 1.04); RC_creamText('PREUVE', lo.tx, lo.bP, lo.fP, cream, S); RC_creamText('DE PAIEMENT', lo.tx, lo.bD, lo.fD, cream, S, lo.lsD); });
  // body (local y from hBot..H/2)
  const bd = mkS(W, bodyH); bd.g.translate(W / 2, -lo.hBot);
  bd.g.save(); bd.g.beginPath(); bd.g.rect(-W / 2, lo.hBot, W, bodyH); bd.g.clip(); RC_paperOn(bd.g, W, H, lo.hBot); RC_bodyDecorOn(bd.g, W, H, lo); bd.g.restore();
  withCtx(bd.g, () => { ctx.font = lo.fB; ctx.fillStyle = ink; ctx.textBaseline = 'alphabetic'; ctx.fillText('Bénéficiaire payé', -lo.pillW / 2 + 26, lo.pillY + lo.cB / 2); });
  // enamel face with its text
  const pw = RC_P.W, ph = RC_P.H, pe = mkS(pw, ph); pe.g.translate(pw / 2, ph / 2);
  pe.g.drawImage(RC_plateFace().c, -pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8);
  withCtx(pe.g, () => RC_plateText(cream, S));
  return (RC_.spr.uf = { hd, bd, pe });
}
/**
 * draw a panel hinged on the line y = hy (local coords), angle a: 0 = lying flat below the hinge, π = folded flat
 * above it, π/2 = standing up toward the camera. img (sprite) maps hinge → free edge along rows top → bottom when
 * a < π/2 (inside face), and bottom → top when a > π/2 (outside face: the hinge is its lower edge).
 */
function RC_panel(img, w, h, hy, a, F, shade, N = 22) {
  const ca = Math.cos(a), sa = Math.sin(a), outside = ca < 0, iw = img.c.width, ih = img.c.height;
  for (let i = 0; i < N; i++) {
    const d0 = h * i / N, d1 = h * (i + 1) / N, y0 = hy + d0 * ca, y1 = hy + d1 * ca, p = 1 + (d0 + d1) / 2 * sa / F;
    const ww = w * p, yt = Math.min(y0, y1), hh = Math.abs(y1 - y0) + .7;
    if (hh < .2) continue;
    const r0 = outside ? ih * (1 - (i + 1) / N) : ih * i / N;
    ctx.drawImage(img.c, 0, r0, iw, ih / N, -ww / 2, yt - .35, ww, hh);
  }
  if (shade > .002) {
    ctx.fillStyle = `rgba(10,4,26,${shade.toFixed(3)})`; RC_panelQuad(w, h, hy, a, F); ctx.fill();
  }
}
function RC_panelQuad(w, h, hy, a, F) {
  const p = 1 + h * Math.sin(a) / F, yf = hy + h * Math.cos(a);
  ctx.beginPath(); ctx.moveTo(-w / 2, hy); ctx.lineTo(w / 2, hy); ctx.lineTo(w * p / 2, yf); ctx.lineTo(-w * p / 2, yf); ctx.closePath();
}
function RC_unfold(P, st, t, L, k) {
  const U = RC_unfoldSprites(), F = 1150;
  const w = RC_lerp(RC_P.W, RC_R.W, k), hT = RC_lerp(RC_P.H, RC_R.hdr, k), hB = RC_lerp(RC_P.H, RC_R.H - RC_R.hdr, k);
  const hy = RC_lerp(RC_P.H / 2, -RC_R.H / 2 + RC_R.hdr, k), a = Math.PI * (1 - k), ca = Math.cos(a), sa = Math.sin(a);
  const tn = RC_tint(P.x, P.y, L, .8), dep = RC_lerp(RC_P.depth, RC_R.depth, RC_sm(0, .5, k));
  // shadows: the lying header panel, and the raised cover (falls straight down under the brand light)
  RC_body(P, () => rrect(-w / 2, hy - hT, w, hT, RC_R.R), 8, RC_R.depth + 2, RC_mul([120, 80, 220], tn), RC_mul([50, 24, 120], tn), null, L, 1, w, hT);
  const zc = hB * sa * .5, so = RC_shadowOff(P, zc + 6, L);
  ctx.save(); RC_apply(P); ctx.translate(so.x * .5, so.y * .6);
  for (const [g, al] of [[14, .1], [8, .12], [3, .14]]) { ctx.fillStyle = `rgba(6,3,14,${(al * (.4 + .6 * sa)).toFixed(3)})`; ctx.save(); ctx.scale(1 + g / w, 1); RC_panelQuad(w, hB, hy + g * .3, a, F); ctx.fill(); ctx.restore(); }
  ctx.restore();
  ctx.save(); RC_apply(P);
  // the header panel, revealed under the lifting cover: violet ground + the header (uniform scale, hinge-aligned)
  ctx.save(); rrect(-w / 2, hy - hT, w, hT, RC_R.R); ctx.clip();
  ctx.fillStyle = '#7A46FB'; ctx.fillRect(-w / 2, hy - hT, w, hT);
  const hs = w / RC_R.W; ctx.drawImage(U.hd.c, -w / 2, hy - RC_R.hdr * hs, w, RC_R.hdr * hs);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = RC_rgb(RC_mul([255, 255, 255], tn)); ctx.fillRect(-w / 2, hy - hT, w, hT);
  ctx.restore();
  // the cover: enamel face while it is above the hinge, the receipt body once it has passed vertical
  const outside = ca < 0, img = outside ? U.pe : U.bd, lit = Math.pow(Math.abs(ca), .55);
  if (outside) {                                                                                 // its thickness, while it still lies on top
    const th = dep * Math.max(0, -ca);
    for (let i = 4; i >= 1; i--) { ctx.save(); ctx.translate(0, th * i / 4); ctx.fillStyle = RC_rgb(RC_mul(RC_mix([92, 50, 200], [30, 10, 84], i / 4), tn)); RC_panelQuad(w, hB, hy, a, F); ctx.fill(); ctx.restore(); }
  }
  RC_panel(img, w, hB, hy, a, F, .62 * (1 - lit));
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = RC_rgb(RC_mul([255, 255, 255], tn)); RC_panelQuad(w, hB, hy, a, F); ctx.fill(); ctx.restore();
  if (outside) {                                                                                 // the enamel catches the bulb as it tilts toward it
    const gl = Math.exp(-Math.pow((k - .2) / .09, 2)) * .36;
    if (gl > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(230,214,255,${gl.toFixed(3)})`; RC_panelQuad(w, hB, hy, a, F); ctx.fill(); ctx.restore(); }
  }
  // the free edge: a band of thickness seen as the cover stands up
  const pf = 1 + hB * sa / F, yf = hy + hB * ca, eb = Math.max(1.2, dep * sa);
  ctx.fillStyle = outside ? RC_rgb(RC_mul([150, 120, 240], tn)) : RC_rgb(RC_mul([236, 228, 214], tn));
  ctx.fillRect(-w * pf / 2, yf - (outside ? eb : 0), w * pf, eb);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-w * pf / 2, yf - (outside ? eb : 0), w * pf, 1.2);
  ctx.restore();
}

// ---------- the push pin ----------
function RC_pin(P, t, L) {
  const T = (window.SCORE || {}).T || {}, t0 = (T.settle ?? 0) + .6, d = Math.max(0, t - t0);
  const lx = -RC_R.W / 2 + 34, ly = -RC_R.H / 2 + 34, c = Math.cos(P.rot), s = Math.sin(P.rot);
  const wx = P.x + (lx * P.sxx) * c - (ly * P.syy) * s, wy = P.y + (lx * P.sxx) * s + (ly * P.syy) * c;
  const k = RC_c01(d / .16), drop = 1 - k, r = 15 * (1 + .5 * drop * drop), h = 7 + 22 * drop;
  const tn = RC_tint(wx, wy, L, .8);
  ctx.save(); ctx.translate(wx, wy);
  ctx.save(); ctx.translate(h * .25, h * .55 + 3);                                              // its shadow on the paper
  for (const [g, a] of [[7, .12], [4, .16], [1.5, .22]]) { ctx.beginPath(); ctx.arc(0, 0, r + g, 0, 7); ctx.fillStyle = `rgba(10,4,24,${a})`; ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 2.5, r, 0, 7); ctx.fillStyle = RC_rgb(RC_mul([150, 80, 6], tn)); ctx.fill();   // the head's side
  const rg = ctx.createRadialGradient(-r * .38, -r * .42, r * .08, 0, 0, r);
  rg.addColorStop(0, RC_rgb(RC_mul([255, 236, 180], tn))); rg.addColorStop(.35, RC_rgb(RC_mul([255, 184, 72], tn))); rg.addColorStop(1, RC_rgb(RC_mul([214, 120, 10], tn)));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = rg; ctx.fill();
  ctx.beginPath(); ctx.arc(-r * .35, -r * .4, r * .22, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r - .6, 0, 7); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(90,40,0,.45)'; ctx.stroke();
  ctx.restore();
}

// ---------- public ----------
function RC_draw(st, t, L) {
  if (!st || (st.a ?? 1) <= 0) return;
  const S = window.SCORE, T = (S || {}).T || {};
  L = L || (S ? S.light(t) : { x: 540, y: 330, on: 1, violet: 0 });
  const s = st.s ?? 1, k = RC_c01(st.unfold || 0);
  let sx = s * (st.sx ?? 1), sy = s * (st.sy ?? 1);
  if (T.stamp !== undefined && t >= T.stamp && t < T.stamp + .5 && k >= 1) {                    // the stamp's hit: the receipt rams the steel
    const d = t - T.stamp, q = Math.exp(-d * 13) * Math.cos(d * 34) * .045; sy *= 1 - q; sx *= 1 + q * .5;
  }
  const P = { x: st.x, y: st.y, rot: st.rot || 0, sxx: sx, syy: sy };
  if (Math.abs(P.sxx) < 1e-3 || Math.abs(P.syy) < 1e-3) return;
  ctx.save(); ctx.globalAlpha *= (st.a ?? 1);
  if (k <= 0) {                                                                                  // dropping in: nearer the camera, larger
    const G = (S || {}).G || { violetY: 1000 }, hgt = RC_c01((G.violetY - P.y) / 1180) * .16;
    if (hgt > 0) { P.sxx *= 1 + hgt; P.syy *= 1 + hgt; }
    RC_plate(P, st, t, L);
  }
  else if (k < 1) RC_unfold(P, st, t, L, k);
  else {
    let z = 7;
    if (T.unfold !== undefined && T.stamp !== undefined) z += 16 * RC_sm(T.unfold + .4, T.stamp - .1, t) * (1 - RC_sm(T.stamp, T.stamp + .3, t));
    if (T.settle !== undefined && t >= T.settle) { const m = RC_kk(t, T.settle, T.settle + .6); z = 4 + 46 * Math.sin(Math.PI * m) * (m < 1 ? 1 : 0); }
    RC_receipt(P, st, t, L, z);
    if (st.pinned) RC_pin(P, t, L);
  }
  ctx.restore();
}
