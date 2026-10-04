'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (ep3): the « PAS REÇU. » wax counter, copied unchanged + a MORNING branch (L.day = 1, bulb off):
//   the cloth lit by the warm raking sun of the door (02_light.js sunAt / lightAt), the shop's back wall in daylight
//   beyond the far edge (shelves of folded wax), the sunbeam's dust and god rays in T_atmos. Night code untouched.
//   Day cost: maps built once (~1.5 s a page); per frame ≈ the night path (one cloth compose per integer frame).
// MODULE T — the table & the atmosphere (« Le Bonneteau du Feyman »).
//   T_table(f, L, cam)  night beyond the table + far edge + wax cloth + tungsten pool + violet wash (opaque: covers all)
//   T_atmos(f, L)       dust motes in the cone, warm haze, deep falloff around the pool, vignette, fine grain
//                       (screen space, on top of everything, before the texts)
//   T_glass(f)          the phone glass: dust print of the parcel hit at f4 + reflection streak (draws only for 4 <= f < 88)
//   T_edgeY(x)          far edge of the table (world y) at world x — for anyone who needs to tuck something behind it
// Coordinates: world = screen px of the score (SCORE.G). T_table follows the camera: if the ctx transform is the
// identity it applies `cam` itself (same maths as the animatic); if the caller already set the camera transform it
// draws as is. T_atmos / T_glass work in screen space (they reset the transform inside save/restore; T_atmos reads
// SCORE.camera(f / 30) itself to keep the pool and the motes on the table).
// Lighting matches 02_light.js: the cloth is veiled with night by 1 − w, w = .16 + .84·k (lightAt's exact curve) and
// tinted like lit(); the brand light mixes towards A·.55 + V·.45. T_atmos then deepens the falloff for everyone.
// Cost: static layers built once per page (~1 s, lazily); the lit cloth and the glass layer are composed once per
// integer frame and reused by the motion-blur sub-frames. Everything is deterministic and periodic over 480 frames.
// =============================================================================================
const T_ = {
  M: 44,                       // margin around the frame: the camera breath / shake never reveals an edge
  FAR: 584,                    // far edge of the table (screen y, centre)
  S0: .84, S1: 1.08, CV: .92,  // mild perspective: horizontal scale at the far edge / bottom; vertical = CV·s²
  ROT: -.024, RX: 540, RY: 700, // the cloth is thrown slightly askew
  U0: -340, V0: -150, FW: 1800, FH: 2010,   // flat cloth texture extent (cloth px)
  BULB: { x: -260, y: 560 },   // light direction used to bake the fold relief (ep3: the morning door, upper left)
  CY0: 560,                    // the cloth layers start at this world y (just above the far edge)
  built: false,
};
const T_TAU = Math.PI * 2;
// ep3: violet belongs to Bonzini only — in daylight the cloth's violet would read as brand colour, so this wax is
// printed navy indigo / wax green / amber / orange (the « violet » slot of the motifs now holds the green)
const T_INK = { ground: 'rgb(20,30,82)', pin: 'rgba(70,98,176,.5)', key: '#0A1030',
  violet: '#1C8C63', amber: '#F2A534', orange: '#EE5C27' };

// ---------- small deterministic helpers ----------
function T_hash32(a) { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
let T_NZ = null;
function T_vn(x, y) {                       // value noise in [0,1], smooth, lattice 256x256 (wraps)
  const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = T_NZ[y0 | x0], b = T_NZ[y0 | x1], c = T_NZ[y1 | x0], d = T_NZ[y1 | x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const T_kk = (f, a, b) => Math.min(1, Math.max(0, (f - a) / (b - a)));
const T_io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const T_fm = f => ((f % 480) + 480) % 480;
/** far edge of the table at screen x (world px) — exported for the other modules */
function T_edgeY(x) { return T_.FAR + 1.5 * Math.sin(x * .021 + .4) + 1.0 * Math.sin(x * .057 + 2.1) - .7 * T_foldH(x, T_.FAR + 6); }

// ---------- folds of the cloth (screen px): soft drapes + one broad swell ----------
const T_FOLDS = [
  // [x0, y0, x1, y1, sigma, height]
  [-60, 1600, 330, 1310, 30, 10], [-50, 1740, 250, 1530, 20, 6], [-40, 1400, 170, 1270, 16, 4],
  [1130, 1620, 850, 1420, 26, 9], [1120, 1790, 920, 1650, 17, 6], [1120, 1450, 990, 1350, 14, 4],
  [150, 570, 185, 720, 15, 6], [425, 570, 418, 660, 11, 4], [705, 570, 716, 700, 13, 5], [935, 570, 905, 740, 17, 7],
  [60, 760, 250, 960, 24, 4], [1060, 820, 930, 1000, 22, 4],
  [560, 1190, 1010, 1300, 22, 5], [-20, 1180, 300, 1150, 18, 4], [640, 640, 900, 800, 20, 4], [300, 1250, 520, 1420, 16, 3.5],
];
function T_foldH(x, y) {
  let h = 2.6 * Math.sin(x * .0047 + y * .0012 + 1.3) * Math.sin(y * .0033 - .8);   // broad swell
  for (const [x0, y0, x1, y1, sg, a] of T_FOLDS) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, t = ((x - x0) * dx + (y - y0) * dy) / l2;
    if (t <= 0 || t >= 1) continue;
    const px = x0 + dx * t - x, py = y0 + dy * t - y, d2 = px * px + py * py;
    if (d2 > 16 * sg * sg) continue;
    h += a * Math.exp(-d2 / (2 * sg * sg)) * Math.pow(Math.sin(Math.PI * t), .8);
  }
  return h;
}

// ---------- the wax print (flat, in cloth px) ----------
// Two printing layers like a real wax: the colour blocks (gc, off-register, dye bleeds a little) and the dark « key »
// printed through the wax resist (gk, crisp). mr = misregistration offset, drifting slowly across the cloth.
function T_ring(g, r1, r2, col) { g.fillStyle = col; g.beginPath(); g.arc(0, 0, r2, 0, T_TAU); g.arc(0, 0, r1, 0, T_TAU, true); g.fill(); }
function T_disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, T_TAU); g.fill(); }
function T_leafPath(g, r0, r1, w) {
  const L = r1 - r0; g.beginPath(); g.moveTo(r0, 0);
  g.bezierCurveTo(r0 + L * .22, -w * .64, r0 + L * .74, -w * .5, r1, 0);
  g.bezierCurveTo(r0 + L * .74, w * .5, r0 + L * .22, w * .64, r0, 0); g.closePath();
}
/** « target » medallion: dot ring + 3 concentric bands, sunburst cuts. k rotates the colour order. */
function T_target(gc, gk, x, y, k, mr) {
  const C = T_INK, pal = [[C.orange, C.violet, C.amber], [C.violet, C.amber, C.orange], [C.amber, C.orange, C.violet]][k];
  gc.save(); gc.translate(x + mr.x, y + mr.y);
  for (let i = 0; i < 20; i++) { const a = i / 20 * T_TAU; T_disc(gc, Math.cos(a) * 82, Math.sin(a) * 82, 5.6, pal[2]); }
  T_ring(gc, 57, 71, pal[0]); T_ring(gc, 31, 47, pal[1]); T_disc(gc, 0, 0, 23, pal[2]);
  gc.restore();
  gk.save(); gk.translate(x, y); gk.strokeStyle = C.key; gk.lineCap = 'round';
  gk.lineWidth = 2.6; for (const r of [23, 31, 47, 57, 71]) { gk.beginPath(); gk.arc(0, 0, r, 0, T_TAU); gk.stroke(); }
  gk.lineWidth = 3.4; for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * T_TAU; gk.beginPath(); gk.moveTo(Math.cos(a) * 33, Math.sin(a) * 33); gk.lineTo(Math.cos(a) * 45, Math.sin(a) * 45); gk.stroke(); }
  gk.lineWidth = 2.2; for (let i = 0; i < 30; i++) { const a = i / 30 * T_TAU; gk.beginPath(); gk.moveTo(Math.cos(a) * 59, Math.sin(a) * 59); gk.lineTo(Math.cos(a) * 64, Math.sin(a) * 64); gk.stroke(); }
  T_disc(gk, 0, 0, 10, C.key); T_disc(gk, 0, 0, 4, pal[1]);
  gk.restore();
}
/** rosette of 4 almond leaves pointing diagonally, amber heart and dots */
function T_rosette(gc, gk, x, y, k, mr) {
  const C = T_INK, cA = k ? C.orange : C.violet, cB = k ? C.violet : C.orange;
  gc.save(); gc.translate(x + mr.x, y + mr.y);
  for (let q = 0; q < 4; q++) { gc.save(); gc.rotate(Math.PI / 4 + q * Math.PI / 2); gc.fillStyle = q & 1 ? cB : cA; T_leafPath(gc, 15, 94, 38); gc.fill(); gc.restore(); }
  T_disc(gc, 0, 0, 13, C.amber);
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; T_disc(gc, Math.cos(a) * 42, Math.sin(a) * 42, 6.8, C.amber); T_disc(gc, Math.cos(a) * 60, Math.sin(a) * 60, 4.2, k ? C.violet : C.orange); }
  gc.restore();
  gk.save(); gk.translate(x, y); gk.strokeStyle = C.key; gk.lineCap = 'round';
  for (let q = 0; q < 4; q++) {
    gk.save(); gk.rotate(Math.PI / 4 + q * Math.PI / 2);
    gk.strokeStyle = C.key; gk.lineWidth = 2.4; T_leafPath(gk, 15, 94, 38); gk.stroke();
    gk.strokeStyle = T_INK.ground; gk.lineWidth = 3.6; gk.beginPath(); gk.moveTo(22, 0); gk.lineTo(86, 0); gk.stroke();   // midrib: the ground shows through
    gk.strokeStyle = C.key; gk.lineWidth = 1.8;
    for (let j = 1; j <= 5; j++) { const t = j / 6, px = 15 + 79 * t, w = 38 * .36 * (1 - Math.abs(t - .42) * 1.2);
      gk.beginPath(); gk.moveTo(px - 4, 0); gk.lineTo(px + 7, -w); gk.moveTo(px - 4, 0); gk.lineTo(px + 7, w); gk.stroke(); }
    gk.restore();
  }
  gk.lineWidth = 2.2; gk.beginPath(); gk.arc(0, 0, 13, 0, T_TAU); gk.stroke(); T_disc(gk, 0, 0, 4.5, C.key);
  gk.restore();
}
/** 4 cowries (cauris — the old money of the coast) pointing diagonally around an orange heart */
function T_cowries(gc, gk, x, y, k, mr) {
  const C = T_INK, body = k ? C.amber : C.orange, ring = k ? C.violet : C.amber;
  gc.save(); gc.translate(x + mr.x, y + mr.y);
  T_ring(gc, 70, 78, ring);
  for (let q = 0; q < 4; q++) { gc.save(); gc.rotate(Math.PI / 4 + q * Math.PI / 2); gc.translate(46, 0);
    gc.fillStyle = body; gc.beginPath(); gc.ellipse(0, 0, 27, 17, 0, 0, T_TAU); gc.fill(); gc.restore(); }
  T_disc(gc, 0, 0, 12, k ? C.orange : C.violet);
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; T_disc(gc, Math.cos(a) * 46, Math.sin(a) * 46, 4.6, C.amber); }
  gc.restore();
  gk.save(); gk.translate(x, y); gk.strokeStyle = C.key; gk.lineCap = 'round';
  gk.lineWidth = 2.2; gk.beginPath(); gk.arc(0, 0, 70, 0, T_TAU); gk.stroke(); gk.beginPath(); gk.arc(0, 0, 78, 0, T_TAU); gk.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * T_TAU; gk.beginPath(); gk.moveTo(Math.cos(a) * 71.5, Math.sin(a) * 71.5); gk.lineTo(Math.cos(a) * 76.5, Math.sin(a) * 76.5); gk.stroke(); }
  for (let q = 0; q < 4; q++) {
    gk.save(); gk.rotate(Math.PI / 4 + q * Math.PI / 2); gk.translate(46, 0);
    gk.lineWidth = 2.4; gk.beginPath(); gk.ellipse(0, 0, 27, 17, 0, 0, T_TAU); gk.stroke();
    gk.lineWidth = 3; gk.beginPath(); gk.moveTo(-21, 0); gk.bezierCurveTo(-8, -3.5, 8, 3.5, 21, 0); gk.stroke();     // the slit
    gk.lineWidth = 1.7; for (let j = -3; j <= 3; j++) { const xx = j * 5.4, yy = Math.sin(j * .9) * 1.2; gk.beginPath(); gk.moveTo(xx, yy - 3.2); gk.lineTo(xx, yy - 6.4); gk.moveTo(xx, yy + 3.2); gk.lineTo(xx, yy + 6.4); gk.stroke(); }
    gk.restore();
  }
  gk.lineWidth = 2.2; gk.beginPath(); gk.arc(0, 0, 12, 0, T_TAU); gk.stroke(); T_disc(gk, 0, 0, 4, C.key);
  gk.restore();
}
function T_seeds(gc, x, y, i, mr) {            // little 3-dot seeds in the diagonal gaps
  const a0 = rnd(i * 3.3) * T_TAU;
  for (let q = 0; q < 3; q++) { const a = a0 + q * T_TAU / 3; T_disc(gc, x + mr.x + Math.cos(a) * 9, y + mr.y + Math.sin(a) * 9, 4, q ? T_INK.amber : T_INK.orange); }
}
function T_buildFlat() {
  const { U0, V0, FW, FH } = T_;
  const c = makeCanvas(FW, FH), g = c.getContext('2d'), cl = makeCanvas(FW, FH), gc = cl.getContext('2d');
  g.translate(-U0, -V0); gc.translate(-U0, -V0);
  g.fillStyle = T_INK.ground; g.fillRect(U0, V0, FW, FH);
  g.fillStyle = T_INK.pin;                                            // pin-dot ground
  for (let y = V0, r = 0; y < V0 + FH; y += 17, r++) for (let x = U0 + (r & 1) * 8.5; x < U0 + FW; x += 17) { g.beginPath(); g.arc(x, y, 1.8, 0, T_TAU); g.fill(); }
  const P = 190, cells = [];
  for (let gy = Math.floor(V0 / P) - 1; gy * P < V0 + FH + P; gy++)
    for (let gx = Math.floor(U0 / P) - 1; gx * P < U0 + FW + P; gx++) {
      const x = gx * P, y = gy * P;
      const mr = { x: 3.2 + 1.8 * Math.sin(x * .004 + y * .002), y: 2.2 + 1.5 * Math.cos(y * .0035 - x * .001) };   // misregistration drifts
      cells.push([gx, gy, x, y, mr]);
    }
  // colour blocks on their own layer (gc), laid down with a little bleed; then the crisp key on top (g)
  const none = makeCanvas(4, 4).getContext('2d');
  const motif = (gcx, gkx) => { for (const [gx, gy, x, y, mr] of cells) {
    if (((gx + gy) & 1) === 0) T_target(gcx, gkx, x, y, ((((gx - gy) / 2) % 3) + 3) % 3, mr);
    else if ((gy & 1) === 0) T_rosette(gcx, gkx, x, y, (gx + 4096) & 1, mr);
    else T_cowries(gcx, gkx, x, y, ((gx + 4096) >> 1) & 1, mr);
    if (gcx !== none) T_seeds(gcx, x + P / 2, y + P / 2, gx * 131 + gy * 17, mr);
  } };
  motif(gc, none);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(.9px)'; g.drawImage(cl, 0, 0); g.filter = 'none'; g.globalAlpha = .55; g.drawImage(cl, 0, 0); g.restore();
  motif(none, g);
  // wax crackle: dye seeped into the cracked wax — fine dark veins
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 900; i++) {
    let x = U0 + rnd(i * 3.1 + 7) * FW, y = V0 + rnd(i * 5.7 + 3) * FH, a = rnd(i * 1.3) * T_TAU;
    g.strokeStyle = `rgba(19,11,46,${(.35 + rnd(i * 8.1) * .45).toFixed(2)})`; g.lineWidth = .8 + rnd(i * 4.4) * 1;
    g.beginPath(); g.moveTo(x, y);
    const n = 5 + Math.floor(rnd(i * 2.9) * 26);
    for (let k = 0; k < n; k++) { a += (rnd(i * 31 + k * 7.7) - .5) * 1.2; const st = 4 + rnd(i * 13 + k) * 6; x += Math.cos(a) * st; y += Math.sin(a) * st; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

// ---------- flat print → the table as seen by the camera (perspective, askew, folds, weave, creases) ----------
function T_buildCloth(flat) {
  const { M, FAR, S0, S1, CV, ROT, RX, RY, U0, V0, FW, FH } = T_;
  const BW = 1080 + 2 * M, BH = 1920 + 2 * M;
  const fd = flat.getContext('2d').getImageData(0, 0, FW, FH).data;
  const out = makeCanvas(BW, BH), og = out.getContext('2d'), id = og.createImageData(BW, BH), od = id.data;
  const m = (S1 - S0) / (1920 - FAR), iCm = 1 / (CV * m), iS0 = 1 / S0, cr = Math.cos(ROT), sr = Math.sin(ROT);
  // fold height on a coarse grid (4 px) + its relief shading
  const GS = 4, GW = Math.ceil(BW / GS) + 2, gy0 = FAR - 60, GH = Math.ceil((1920 + M - gy0) / GS) + 2;
  const HG = new Float32Array(GW * GH), SG = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) HG[j * GW + i] = T_foldH(i * GS - M, gy0 + j * GS);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * GS - M, y = gy0 + j * GS;
    const hx = (HG[j * GW + Math.min(GW - 1, i + 1)] - HG[j * GW + Math.max(0, i - 1)]) / (2 * GS);
    const hy = (HG[Math.min(GH - 1, j + 1) * GW + i] - HG[Math.max(0, j - 1) * GW + i]) / (2 * GS);
    let lx = T_.BULB.x - x, ly = T_.BULB.y - y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    SG[j * GW + i] = -(hx * lx + hy * ly) * 1.6;
  }
  const edge = new Float32Array(BW); for (let px = 0; px < BW; px++) edge[px] = T_edgeY(px - M);
  // weave (screen space, stable): rows and columns of thread, a little slub, a little tooth
  const rowv = new Float32Array(BH), colv = new Float32Array(BW);
  for (let i = 0; i < BH; i++) rowv[i] = (T_hash32(i >> 1) - .5) * 1.3 + (T_hash32(i + 7777) - .5) * .7 + (T_vn(i * .02, 3.7) - .5) * 1.2;
  for (let i = 0; i < BW; i++) colv[i] = (T_hash32((i >> 1) + 99991) - .5) * 1.3 + (T_hash32(i + 5555) - .5) * .7;
  const VC = 1010, UC = 676;                // storage creases (cloth px): one horizontal (valley), one vertical (ridge)
  for (let py = 0; py < BH; py++) {
    const y = py - M; if (y < FAR - 12) continue;
    const gj = (y - gy0) / GS, j0 = Math.max(0, Math.min(GH - 2, gj | 0)), fj = Math.min(1, Math.max(0, gj - j0));
    for (let px = 0; px < BW; px++) {
      const x = px - M, a = y - edge[px] + .5; if (a <= 0) continue;
      const al = a >= 1 ? 1 : a;
      const gi = (x + M) / GS, i0 = Math.min(GW - 2, gi | 0), fi = gi - i0, q0 = j0 * GW + i0, q1 = q0 + GW;
      const h = (HG[q0] * (1 - fi) + HG[q0 + 1] * fi) * (1 - fj) + (HG[q1] * (1 - fi) + HG[q1 + 1] * fi) * fj;
      let sh = (SG[q0] * (1 - fi) + SG[q0 + 1] * fi) * (1 - fj) + (SG[q1] * (1 - fi) + SG[q1 + 1] * fi) * fj;
      const ys = y + .7 * h, s = S0 + m * (ys - FAR), iS = 1 / s;
      const u0 = 540 + (x - 540) * iS, v0 = iCm * (iS0 - iS);
      const u = RX + (u0 - RX) * cr - (v0 - RY) * sr, v = RY + (u0 - RX) * sr + (v0 - RY) * cr;
      // creases (in cloth space, amplitude varies along their length)
      let lx = T_.BULB.x - x, ly = T_.BULB.y - y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
      const qu = (u - UC - 5 * (T_vn(v * .004 + 3, 9.1) - .5)) / 3.4; if (qu > -4 && qu < 4) { const am = Math.max(0, T_vn(v * .007 + 40, 1.5) * 1.6 - .45); sh -= .75 * (-2 * qu * Math.exp(-qu * qu)) * lx * am; }
      const qv = (v - VC - 6 * (T_vn(u * .0035 + 7, 2.2) - .5)) / 3.2; if (qv > -4 && qv < 4) { const am = Math.max(0, T_vn(u * .006 + 9, 7.5) * 1.6 - .45); sh += .65 * (-2 * qv * Math.exp(-qv * qv)) * ly * am; }
      // bilinear sample of the print
      const fu = u - U0, fv = v - V0, ui = fu | 0, vi = fv | 0, au = fu - ui, av = fv - vi;
      const i00 = (vi * FW + ui) * 4, i01 = i00 + 4, i10 = i00 + FW * 4, i11 = i10 + 4;
      let r = (fd[i00] * (1 - au) + fd[i01] * au) * (1 - av) + (fd[i10] * (1 - au) + fd[i11] * au) * av;
      let gg = (fd[i00 + 1] * (1 - au) + fd[i01 + 1] * au) * (1 - av) + (fd[i10 + 1] * (1 - au) + fd[i11 + 1] * au) * av;
      let b = (fd[i00 + 2] * (1 - au) + fd[i01 + 2] * au) * (1 - av) + (fd[i10 + 2] * (1 - au) + fd[i11 + 2] * au) * av;
      // wax « bubbles »: pale specks inside the colours; indigo dye unevenness
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx - mn > 70) { const bb = T_vn(u * .085 + 31, v * .085 + 17); if (bb > .66) { const t = Math.min(1, (bb - .66) * 3.2) * .22; r += (246 - r) * t; gg += (226 - gg) * t; b += (196 - b) * t; } }
      const mot = 1 + .09 * (T_vn(u * .0068 + 5, v * .0068 + 9) - .5) * 2 + .05 * (T_vn(u * .0024 + 2, v * .0024) - .5) * 2;
      const wv = 1 + .028 * rowv[py] + .028 * colv[px] + .022 * (T_hash32(px * 7919 + py * 104729) - .5) + ((((px >> 1) + (py >> 1)) & 1) ? .01 : -.01);
      const shc = Math.max(-.4, Math.min(.4, sh)); let k = mot * wv * (1 + shc);
      if (shc > .04) { const sp = Math.pow(shc - .04, 1.4) * 150; r += sp; gg += sp * .86; b += sp * .7; }   // the glaze catches the bulb on ridges
      const de = y - edge[px]; if (de < 6) k *= 1 + .5 * Math.exp(-((de - 1.6) * (de - 1.6)) / 2.2);   // rim where the cloth turns over the edge
      const o = (py * BW + px) * 4;
      od[o] = Math.min(255, r * k); od[o + 1] = Math.min(255, gg * k); od[o + 2] = Math.min(255, b * k); od[o + 3] = al * 255;
    }
  }
  og.putImageData(id, 0, 0);
  return out;
}

/** depth of field, baked: focus on the containers' row; the far edge and the near cloth go soft */
function T_dof(src) {
  const { M, FAR } = T_, BW = src.width, BH = src.height;
  const out = makeCanvas(BW, BH), g = out.getContext('2d');
  g.drawImage(src, 0, 0);
  const layer = (blur, stops) => {
    const t = makeCanvas(BW, BH), tg = t.getContext('2d');
    tg.filter = `blur(${blur}px)`; tg.drawImage(src, 0, 0); tg.filter = 'none';
    tg.globalCompositeOperation = 'destination-in';
    const y0 = stops[0][0], y1 = stops[stops.length - 1][0], lg = tg.createLinearGradient(0, y0 + M, 0, y1 + M);
    for (const [y, a] of stops) lg.addColorStop((y - y0) / (y1 - y0), `rgba(0,0,0,${a})`);
    tg.fillStyle = lg; tg.fillRect(0, 0, BW, BH);
    g.drawImage(t, 0, 0);
  };
  layer(2.6, [[FAR - 40, 1], [FAR + 40, .85], [720, .3], [830, 0]]);
  layer(3.2, [[1300, 0], [1520, .55], [1760, 1], [2000, 1]]);
  layer(6.5, [[1640, 0], [1900, .8], [2000, 1]]);
  return out;
}

// ---------- beyond the far edge: night, the ground behind the stall, far lamps ----------
function T_buildBg() {
  const { M, FAR } = T_, BW = 1080 + 2 * M, BH = FAR + M + 40;
  const c = makeCanvas(BW, BH), g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, BH);
  lg.addColorStop(0, '#0F0921'); lg.addColorStop(.42, '#130B27'); lg.addColorStop(.8, '#0E0820'); lg.addColorStop(.93, '#0A0617'); lg.addColorStop(1, '#06030E');
  g.fillStyle = lg; g.fillRect(0, 0, BW, BH);
  const id = g.getImageData(0, 0, BW, BH), d = id.data, edge = new Float32Array(BW);
  for (let px = 0; px < BW; px++) edge[px] = T_edgeY(px - M);
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const x = px - M, y = py - M, o = (py * BW + px) * 4;
    const n = (T_vn(x * .012, y * .02 + 50) - .5) * 5 + (T_hash32(px * 31 + py * 7717) - .5) * 2.2;   // packed earth, barely there
    d[o] += n; d[o + 1] += n * .8; d[o + 2] += n * 1.1;
    const e = edge[px], a = e - y + .5;                               // transparent under the cloth
    d[o + 3] = a >= 1 ? 255 : a <= 0 ? 0 : a * 255;
    if (a > 0 && y > e - 26) { const t = 1 - (e - y) / 26; d[o] *= 1 - .45 * t; d[o + 1] *= 1 - .45 * t; d[o + 2] *= 1 - .4 * t; }   // shadow line under the drape
  }
  g.putImageData(id, 0, 0);
  return c;
}
function T_sprite(r, g, b, kind) {
  const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 63);
  if (kind === 'bokeh') { gr.addColorStop(0, `rgba(${r},${g},${b},.55)`); gr.addColorStop(.78, `rgba(${r},${g},${b},.62)`); gr.addColorStop(.92, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); }
  else { gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.25, `rgba(${r},${g},${b},.75)`); gr.addColorStop(.6, `rgba(${r},${g},${b},.18)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); }
  x.fillStyle = gr; x.fillRect(0, 0, S, S); return c;
}

// ---------- the glass print (parcel hit at f4): edge dust, inner film, outward splash ----------
function T_buildGlass() {
  const W2 = 1000, H2 = 760, cx = 500, cy = 380, RW = 222, RH = 128, CR = 22;   // print of the box face ~444 x 256
  const mk = () => { const c = makeCanvas(W2, H2); return [c, c.getContext('2d')]; };
  const [edge, ge] = mk(), [inner, gi] = mk(), [spl, gs] = mk();
  // point on the rounded-rect perimeter (param t 0..1) + outward normal
  const per = t => {
    const sx = RW - CR, sy = RH - CR, L = 4 * (sx + sy) + T_TAU * CR; let d = t * L;
    const segs = [[2 * sx, (k) => [-sx + k, -RH, 0, -1]], [Math.PI / 2 * CR, (k) => { const a = -Math.PI / 2 + k / CR; return [sx + Math.cos(a) * CR, -sy + Math.sin(a) * CR, Math.cos(a), Math.sin(a)]; }],
      [2 * sy, (k) => [RW, -sy + k, 1, 0]], [Math.PI / 2 * CR, (k) => { const a = k / CR; return [sx + Math.cos(a) * CR, sy + Math.sin(a) * CR, Math.cos(a), Math.sin(a)]; }],
      [2 * sx, (k) => [sx - k, RH, 0, 1]], [Math.PI / 2 * CR, (k) => { const a = Math.PI / 2 + k / CR; return [-sx + Math.cos(a) * CR, sy + Math.sin(a) * CR, Math.cos(a), Math.sin(a)]; }],
      [2 * sy, (k) => [-RW, sy - k, -1, 0]], [Math.PI / 2 * CR, (k) => { const a = Math.PI + k / CR; return [-sx + Math.cos(a) * CR, -sy + Math.sin(a) * CR, Math.cos(a), Math.sin(a)]; }]];
    for (const [l, fn] of segs) { if (d <= l) return fn(d); d -= l; }
    return segs[0][1](0);
  };
  const DUST = (a) => `rgba(224,206,178,${a.toFixed(3)})`;
  const dens = t => Math.pow(T_vn(t * 46, 3.3) * .7 + T_vn(t * 130, 8.1) * .3, 1.6) * 1.9;   // clumps and gaps along the edge
  const gauss = i => (rnd(i) + rnd(i + .37) + rnd(i + .71) - 1.5) * 1.41;
  // a soft film where the face pressed: broken, uneven (no clean outline)
  const soft = (blur, fn) => { const t = makeCanvas(W2, H2), tg = t.getContext('2d'); fn(tg); return [t, blur]; };
  const lay = (g, [t, blur]) => { g.save(); g.filter = `blur(${blur}px)`; g.drawImage(t, 0, 0); g.restore(); };
  lay(ge, soft(14, tg => { tg.translate(cx, cy); for (let i = 0; i < 90; i++) {
    const t = i / 90, [x, y, nx, ny] = per(t), d = dens(t);
    tg.fillStyle = `rgba(226,206,178,${(.03 + .05 * d).toFixed(3)})`; tg.beginPath(); tg.arc(x - nx * 6, y - ny * 6, 26, 0, T_TAU); tg.fill(); } }));
  lay(ge, soft(30, tg => { tg.translate(cx, cy); tg.fillStyle = 'rgba(226,206,178,.03)'; rrectOn(tg, -RW + 20, -RH + 20, 2 * RW - 40, 2 * RH - 40, 40); tg.fill(); }));
  // dust packed along the carton's edges, in clumps
  for (let i = 0, n = 0; i < 9000 && n < 3000; i++) {
    const t = rnd(i * 1.37 + .5); if (rnd(i * 9.91 + .2) > dens(t)) continue; n++;
    const [x, y, nx, ny] = per(t), o = gauss(i * 2.71) * 7 - 4;
    const r = .4 + Math.pow(rnd(i * 3.9), 3) * 1.5;
    ge.fillStyle = DUST(.14 + rnd(i * 7.7) * .4); ge.beginPath(); ge.arc(cx + x + nx * o + gauss(i * 5.5) * 2, cy + y + ny * o + gauss(i * 6.6) * 2, r, 0, T_TAU); ge.fill();
  }
  // inner film: sparse fine dust + faint fibres (kept light: the label must stay readable at f4–14)
  for (let i = 0; i < 1300; i++) {
    const x = (rnd(i * 4.13 + 9) * 2 - 1) * (RW - 8), y = (rnd(i * 6.07 + 2) * 2 - 1) * (RH - 8), r = .4 + Math.pow(rnd(i * 2.2), 4) * 1.4;
    const cl = T_vn(x * .02 + 40, y * .02 + 40); if (rnd(i * 8.8) > cl * 1.5) continue;
    gi.fillStyle = DUST(.12 + rnd(i * 3.3) * .28); gi.beginPath(); gi.arc(cx + x, cy + y, r, 0, T_TAU); gi.fill();
  }
  gi.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const x = (rnd(i * 9.1) * 2 - 1) * (RW - 20), y = (rnd(i * 8.3) * 2 - 1) * (RH - 20), a = rnd(i * 7.9) * T_TAU, l = 5 + rnd(i * 6.6) * 16;
    gi.strokeStyle = DUST(.16 + rnd(i * 5.5) * .2); gi.lineWidth = .7; gi.beginPath(); gi.moveTo(cx + x, cy + y);
    gi.quadraticCurveTo(cx + x + Math.cos(a + .6) * l * .6, cy + y + Math.sin(a + .6) * l * .6, cx + x + Math.cos(a) * l, cy + y + Math.sin(a) * l); gi.stroke();
  }
  // outward splash: streaks thrown away from the impact, in bursts (jets) rather than a ring
  gs.lineCap = 'round';
  for (let i = 0, n = 0; i < 9000 && n < 2600; i++) {
    const t = rnd(i * 2.17 + .3), jet = T_vn(t * 22, 11.7); if (rnd(i * 4.04) > jet * jet * 1.8) continue; n++;
    const [x, y, nx, ny] = per(t), d = -Math.log(1 - rnd(i * 3.17) * .985) * (26 + 40 * jet) + 4;
    const jx = gauss(i * 5.1) * .32, dx = nx + jx * ny, dy = ny - jx * nx, nn = Math.hypot(dx, dy);
    const px = cx + x + dx / nn * d, py = cy + y + dy / nn * d, len = .6 + d * .08 * rnd(i * 8.8), a = Math.max(.05, .55 - d / 260) * (.35 + rnd(i * 6.2) * .65);
    gs.strokeStyle = DUST(a); gs.lineWidth = .45 + Math.pow(rnd(i * 4.6), 3) * 1.3;
    gs.beginPath(); gs.moveTo(px, py); gs.lineTo(px + dx / nn * len, py + dy / nn * len); gs.stroke();
  }
  lay(gs, soft(18, tg => { for (let i = 0; i < 40; i++) { const t = i / 40, [x, y, nx, ny] = per(t), j = T_vn(t * 22, 11.7), d = 30 + 50 * j;   // the puff, settled as haze
    tg.fillStyle = `rgba(226,206,178,${(.02 + .045 * j).toFixed(3)})`; tg.beginPath(); tg.arc(cx + x + nx * d, cy + y + ny * d, 34 + 20 * j, 0, T_TAU); tg.fill(); } }));
  for (let i = 0; i < 26; i++) {                    // a few bigger flecks of kraft
    const [x, y, nx, ny] = per(rnd(i * 11.3)), d = 6 + rnd(i * 12.7) * 90, px = cx + x + nx * d, py = cy + y + ny * d;
    gs.fillStyle = `rgba(214,182,140,${(.3 + rnd(i * 2.9) * .3).toFixed(2)})`; gs.beginPath(); gs.ellipse(px, py, 1.4 + rnd(i * 3.1) * 2.2, 1 + rnd(i * 4.2) * 1.4, rnd(i) * 3, 0, T_TAU); gs.fill();
  }
  // reflection streak: a long soft band + a thin twin, faded along its length (no hard ends)
  const sk = makeCanvas(1200, 240), gk = sk.getContext('2d'), ac = gk.createLinearGradient(0, 0, 0, 240);
  for (const [t, a] of [[0, 0], [.22, .05], [.36, .32], [.44, 1], [.5, .55], [.6, .12], [.7, 0], [1, 0]]) ac.addColorStop(t, `rgba(255,250,242,${a})`);
  gk.fillStyle = ac; gk.fillRect(0, 0, 1200, 240);
  gk.fillStyle = 'rgba(255,250,242,.55)'; gk.fillRect(0, 186, 1200, 2.2);
  gk.globalCompositeOperation = 'destination-in'; const al = gk.createLinearGradient(0, 0, 1200, 0);
  for (const [t, a] of [[0, 0], [.18, .25], [.42, 1], [.62, .85], [.85, .2], [1, 0]]) al.addColorStop(t, `rgba(0,0,0,${a})`);
  gk.fillStyle = al; gk.fillRect(0, 0, 1200, 240);
  const puff = makeCanvas(W2, H2), gp = puff.getContext('2d');
  lay(gp, soft(22, tg => { for (let i = 0; i < 70; i++) { const t = i / 70, [x, y, nx, ny] = per(t), j = T_vn(t * 22, 11.7), d = 10 + 46 * j;
    tg.fillStyle = `rgba(230,212,186,${(.03 + .07 * j).toFixed(3)})`; tg.beginPath(); tg.arc(cx + x + nx * d, cy + y + ny * d, 30 + 26 * j, 0, T_TAU); tg.fill(); }
    tg.fillStyle = 'rgba(230,212,186,.045)'; rrectOn(tg, cx - RW, cy - RH, 2 * RW, 2 * RH, 30); tg.fill(); }));
  return { edge, inner, spl, puff, streak: sk, cx, cy };
}

// ---------- light maps: smooth layers prebuilt once, drawn pixel-aligned (cheap) and slid with the bulb ----------
// Table maps live in the lit-cloth cache (world px, origin (−M, CY0)); atmosphere maps live in screen px.
const T_MX = 72, T_MY = 28;              // screen maps: slack for the sway (±52 px), camera push and shake
const T_TX = 60;                         // table maps: slack for the sway on each side
function T_mapCanvas(w, h, fn) { const c = makeCanvas(w, h), g = c.getContext('2d'); fn(g, w, h); return c; }
function T_radial(g, cx, cy, sx, sy, R, stops) {
  g.save(); g.translate(cx, cy); g.scale(sx, sy);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); for (const [r, c] of stops) gr.addColorStop(r, c);
  g.fillStyle = gr; g.fillRect(-8000, -8000, 16000, 16000); g.restore();          // clipped by the canvas, whatever the transform
}
/** collapse a stack of layers (any mix of source-over / screen) into ONE equivalent source-over image:
 *  render it over black and over white; out = backdrop·P + Q  ⇒  alpha = 1 − mean(P), colour = Q / alpha */
function T_solve(W, H, ops) {                // solved at half resolution (the layers are smooth), upscaled once
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  const run = bgc => { const c = makeCanvas(w, h), g = c.getContext('2d'); g.fillStyle = bgc; g.fillRect(0, 0, w, h); g.scale(.5, .5); ops(g); return g.getImageData(0, 0, w, h).data; };
  const q = run('#000'), wv = run('#fff'), half = makeCanvas(w, h), og = half.getContext('2d'), id = og.createImageData(w, h), d = id.data;
  for (let i = 0; i < q.length; i += 4) {
    const A = 1 - (wv[i] - q[i] + wv[i + 1] - q[i + 1] + wv[i + 2] - q[i + 2]) / 765;
    if (A < .002) { d[i + 3] = 0; continue; }
    d[i] = q[i] / A; d[i + 1] = q[i + 1] / A; d[i + 2] = q[i + 2] / A; d[i + 3] = A * 255 + .5;
  }
  og.putImageData(id, 0, 0);
  return T_mapCanvas(W, H, g => { g.imageSmoothingQuality = 'high'; g.drawImage(half, 0, 0, W, H); });
}
function T_buildMaps() {
  const { M, CY0 } = T_, N = 24;
  const curve = fn => Array.from({ length: N + 1 }, (_, i) => { const r = i / N; return [r, fn(Math.pow(1 - r, 1.5))]; });
  // --- table (world px in the cache): pool centre of the reference bulb (x 520) at (TPX, TPY)
  const TW = 1080 + 2 * M + 2 * T_TX, TH = T_.cloth.height, TPX = 520 + M + T_TX, TPY = POOL_Y - CY0;
  // tungsten tint (multiply): lit() pushes R up and B down where the bulb dominates
  T_.mTint = T_mapCanvas(TW, TH, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
    T_radial(g, TPX, TPY, 1, .82, POOL_R, curve(k => { k = Math.pow(k, .6); return `rgb(255,${(255 - 50 * k) | 0},${(255 - 118 * k) | 0})`; })); });
  // the night veil: alpha 1 − w, w = .16 + .84·k — lightAt()'s exact curve
  T_.mVeil = T_mapCanvas(TW, TH, g => T_radial(g, TPX, TPY, 1, .82, POOL_R, curve(k => `rgba(20,12,38,${(.84 * (1 - k)).toFixed(4)})`)));
  // hot spot on the glossy wax (overlay) + its core (screen), a touch towards us
  T_.mHot = T_mapCanvas(1100, 760, g => T_radial(g, 550, 380, 1.3, .8, 410, [[0, 'rgba(255,182,92,.5)'], [.35, 'rgba(255,164,80,.28)'], [.7, 'rgba(255,150,70,.08)'], [1, 'rgba(255,150,70,0)']]));
  T_.mHot2 = T_mapCanvas(440, 440, g => T_radial(g, 220, 220, 1, 1, 200, [[0, 'rgba(255,196,120,.13)'], [1, 'rgba(255,170,90,0)']]));
  // --- atmosphere (screen px): warm haze in the cone + deep falloff around the pool (+ frame vignette), one image each
  const W2 = 1080 + 2 * T_MX, H2 = 1920 + 2 * T_MY, PX = 520 + T_MX, PY = POOL_Y + T_MY;
  const haze = g => { g.globalCompositeOperation = 'screen'; T_radial(g, PX, 760 + T_MY, 1, 1.55, 520, [[0, 'rgba(255,168,88,.085)'], [.5, 'rgba(255,150,80,.03)'], [1, 'rgba(255,140,70,0)']]); g.globalCompositeOperation = 'source-over'; };
  const fall = g => T_radial(g, PX, PY - 20, 1, .9, 1000,
    [[0, 'rgba(8,4,18,0)'], [.3, 'rgba(8,4,18,0)'], [.42, 'rgba(8,4,18,.1)'], [.55, 'rgba(8,4,18,.27)'], [.7, 'rgba(8,4,18,.48)'], [.85, 'rgba(8,4,18,.63)'], [1, 'rgba(8,4,18,.72)']]);
  const vig = (g, x, y) => T_radial(g, x, y, 1, 1.5, 840, [[0, 'rgba(5,2,12,0)'], [.5, 'rgba(5,2,12,0)'], [.7, 'rgba(5,2,12,.2)'], [.86, 'rgba(5,2,12,.42)'], [1, 'rgba(5,2,12,.66)']]);
  T_.mGrade = T_solve(W2, H2, g => { haze(g); fall(g); vig(g, 540 + T_MX, 1000 + T_MY); });
  T_.mGradeNV = T_solve(W2, H2, g => { haze(g); fall(g); });
  T_.mVig = T_mapCanvas(1080, 1920, g => vig(g, 540, 1000));
  // brand light: violet air from above + soft frame falloff, one image
  T_.mViolet = T_solve(1080, 1920, g => {
    const lg = g.createLinearGradient(0, 0, 0, 1920); lg.addColorStop(0, 'rgba(150,120,255,.07)'); lg.addColorStop(.55, 'rgba(130,100,255,.03)'); lg.addColorStop(1, 'rgba(120,90,255,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = lg; g.fillRect(0, 0, 1080, 1920); g.globalCompositeOperation = 'source-over';
    T_radial(g, 540, 980, 1, 1.25, 1000, [[0, 'rgba(10,5,26,0)'], [.3, 'rgba(10,5,26,0)'], [.5, 'rgba(10,5,26,.16)'], [.72, 'rgba(10,5,26,.4)'], [1, 'rgba(10,5,26,.6)']]); });
  // the ground beyond the edge under the brand light
  T_.bgV = T_mapCanvas(T_.bg.width, T_.bg.height, g => { g.drawImage(T_.bg, 0, 0); g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, 0, 0, g.canvas.height); lg.addColorStop(0, 'rgba(96,70,210,.13)'); lg.addColorStop(1, 'rgba(60,40,150,.05)'); g.fillStyle = lg; g.fillRect(0, 0, g.canvas.width, g.canvas.height); });
  // film grain: two oversized plates, slid by a random integer offset every frame
  T_.grain = [0, 1].map(v => T_mapCanvas(1080 + 256, 1920 + 256, (g, w, h) => {
    const id = g.createImageData(w, h), d = id.data; let x = 0x9E3779B9 ^ (v * 0x85EBCA6B);
    for (let i = 0; i < w * h; i++) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const a = (x >>> 0) & 255; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const b = (x >>> 0) & 255;
      const n = 128 + (a + b - 255) * .62; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = n; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }));
  T_.lc = makeCanvas(T_.cloth.width, T_.cloth.height); T_.lcg = T_.lc.getContext('2d'); T_.ckey = null;
}

// ---------- build everything once ----------
function T_build() {
  if (T_.built) return; T_.built = true;
  T_NZ = new Float32Array(65536); for (let i = 0; i < 65536; i++) T_NZ[i] = T_hash32(i * 2654435761 + 12345);
  const full = T_dof(T_buildCloth(T_buildFlat()));          // world origin (−M, −M) → crop to the cloth band (−M, CY0)
  T_.cloth = T_mapCanvas(full.width, 1920 + T_.M - T_.CY0, g => g.drawImage(full, 0, -(T_.CY0 + T_.M)));
  T_.bg = T_buildBg();
  T_buildMaps();
  T_.bokeh = [T_sprite(255, 178, 92, 'bokeh'), T_sprite(255, 118, 60, 'bokeh'), T_sprite(206, 218, 255, 'bokeh'), T_sprite(255, 214, 150, 'bokeh')];
  T_.moteW = T_sprite(255, 214, 166, 'dot'); T_.moteV = T_sprite(196, 176, 255, 'dot');
  T_.lamps = [];                                   // far lamps of the neighbouring stalls (out of focus)
  for (let i = 0; i < 15; i++) {
    const x = -20 + rnd(i * 7.3 + 1) * 1120, r = 12 + Math.pow(rnd(i * 3.9 + 2), 1.6) * 32, y = 70 + rnd(i * 5.1 + 3) * (T_.FAR - 110 - r - 70);
    T_.lamps.push({ x, y, r, s: i % 7 === 3 ? 2 : i % 5 === 1 ? 1 : i % 4 === 2 ? 3 : 0, a: .08 + rnd(i * 2.2) * .14, n: 2 + Math.floor(rnd(i * 4.4) * 8), p: rnd(i * 6.6) * T_TAU });
  }
  T_.motes = [];
  for (let i = 0; i < 170; i++) {
    const z = rnd(i * 9.7 + 4), rr = Math.sqrt(rnd(i * 3.3 + 1)), aa = rnd(i * 4.7 + 2) * T_TAU;
    T_.motes.push({ x: 520 + Math.cos(aa) * rr * 470, y: 900 + Math.sin(aa) * rr * 560, z,
      ax: 6 + rnd(i * 5.9) * 22, ay: 4 + rnd(i * 6.1) * 12, n1: 1 + Math.floor(rnd(i * 7.3) * 3), n2: 2 + Math.floor(rnd(i * 8.1) * 4), p1: rnd(i * 2.3) * T_TAU, p2: rnd(i * 1.9) * T_TAU,
      nd: 1 + Math.floor(rnd(i * 2.7) * 2), pd: rnd(i * 3.7), D: (60 + rnd(i * 4.9) * 120) * (rnd(i * 5.3) > .3 ? 1 : -1),
      nt: 4 + Math.floor(rnd(i * 6.7) * 12), pt: rnd(i * 7.9) * T_TAU, big: i % 23 === 7 });
  }
  T_.glass = T_buildGlass();
}

// ---------- camera ----------
function T_isIdentity(m) { return Math.abs(m.a - 1) < 1e-9 && Math.abs(m.d - 1) < 1e-9 && Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && Math.abs(m.e) < 1e-9 && Math.abs(m.f) < 1e-9; }
function T_applyCam(cam) { ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy); }
const T_c01 = x => Math.max(0, Math.min(1, x));

// =============================================================================================
/** the cloth as the bulb (or the brand light) lights it — world px, origin (−M, CY0). Built once per integer frame
 *  (key: frame, on, violet): the motion-blur sub-frames reuse it, a flicker inside a frame gets its own build. */
function T_litCloth(f, L) {
  if (L.day) return T_litClothDay(f, L);
  const on = T_c01(L.on), v = T_c01(L.violet), key = `${T_fm(Math.round(f))}|${on.toFixed(3)}|${v.toFixed(3)}`;
  if (T_.ckey === key) return T_.lc;
  T_.ckey = key;
  const { M, CY0 } = T_, g = T_.lcg, W = T_.lc.width, H = T_.lc.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  g.globalCompositeOperation = 'copy'; g.drawImage(T_.cloth, 0, 0); g.globalCompositeOperation = 'source-over';
  const ox = Math.round(L.x - 520) - T_TX, px = Math.round(L.x + M), py = POOL_Y - CY0;
  // the bulb: warm tint (multiply), the falloff veil (lightAt()'s curve), the hot spot on the glossy wax
  if (on > .002) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = on; g.drawImage(T_.mTint, ox, 0); g.globalCompositeOperation = 'source-over'; }
  if (on < .998) { g.globalAlpha = (1 - on) * .84; g.fillStyle = NIGHT; g.fillRect(0, 0, W, H); }
  if (on > .002) {
    g.globalAlpha = on; g.drawImage(T_.mVeil, ox, 0);
    g.globalCompositeOperation = 'overlay'; g.drawImage(T_.mHot, px - 550, py + 46 - 380);
    g.globalCompositeOperation = 'screen'; g.drawImage(T_.mHot2, px - 220, py + 36 - 220);
    g.globalCompositeOperation = 'source-over';
  }
  // the brand light: even violet from above (lit(): towards A·.55 + V·.45 by .55·v; the dark cloth drinks a little)
  if (v > .002) {
    const vv = .55 * v, x2 = .3 * vv, x1 = .4 * vv / (1 - x2);
    g.globalAlpha = x1; g.drawImage(T_.cloth, 0, 0);
    g.globalAlpha = x2; g.fillStyle = VIOLET_L; g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(T_.cloth, 0, 0);   // keep the cloth's own edge
  g.globalCompositeOperation = 'source-over';
  return T_.lc;
}

/** the whole stage. f frame (float ok), L = SCORE.light(f), cam = SCORE.camera(f / 30) */
function T_table(f, L, cam) {
  T_build();
  if (L.day) return T_tableDay(f, L, cam);
  const { M, CY0 } = T_, v = T_c01(L.violet);
  const lc = T_litCloth(f, L);
  ctx.save();
  if (cam && T_isIdentity(ctx.getTransform())) T_applyCam(cam);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.drawImage(lc, -M, CY0);                        // the lit wax cloth
  ctx.drawImage(T_.bg, -M, -M);                      // beyond the far edge
  if (v > .002) { ctx.globalAlpha = v; ctx.drawImage(T_.bgV, -M, -M); }
  ctx.globalCompositeOperation = 'lighter';          // lamps of the far stalls, out of focus
  const fr = T_fm(f);
  for (const p of T_.lamps) {
    const tw = .82 + .18 * Math.sin(T_TAU * p.n * fr / 480 + p.p) + .06 * Math.sin(T_TAU * (p.n * 3 + 1) * fr / 480 + p.p * 2);
    ctx.globalAlpha = Math.max(0, p.a * tw * (1 - .35 * v)); ctx.drawImage(T_.bokeh[p.s], p.x - p.r, p.y - p.r, 2 * p.r, 2 * p.r);
  }
  ctx.restore();
}

/** dust in the light cone, haze, deep falloff + vignette, fine grain (screen space, over everything but the texts) */
function T_atmos(f, L) {
  T_build();
  if (L.day) return T_atmosDay(f, L);
  const fr = T_fm(f), on = T_c01(L.on), v = T_c01(L.violet);
  const cam = (typeof SCORE !== 'undefined') ? SCORE.camera(f / 30) : { s: 1, cx: 540, cy: 980, sx: 0, sy: 0 };
  const SX = x => (x - cam.cx) * cam.s + cam.cx + cam.sx, SY = y => (y - cam.cy) * cam.s + cam.cy + cam.sy;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // 1. dust motes (periodic over 480 f: integer frequencies, the wrap hidden by a fade)
  ctx.globalCompositeOperation = 'lighter';
  const w = T_TAU / 480;
  for (const p of T_.motes) {
    const ph = ((fr * p.nd / 480 + p.pd) % 1 + 1) % 1, env = Math.pow(Math.sin(Math.PI * ph), 1.3);
    if (env < .01) continue;
    const wx = p.x + p.ax * Math.sin(w * p.n1 * fr + p.p1) + 7 * Math.sin(w * p.n2 * fr + p.p2);
    const wy = p.y + (ph - .5) * p.D + p.ay * Math.sin(w * p.n2 * fr + p.p1);
    const par = 1 + .5 * p.z;                       // nearer motes drift more with the camera
    const x = (wx - cam.cx) * (1 + (cam.s - 1) * par) + cam.cx + cam.sx * par, y = (wy - cam.cy) * (1 + (cam.s - 1) * par) + cam.cy + cam.sy * par;
    const lk = lightAt(wx, wy + 60, L).k;
    const tw = .5 + .5 * Math.sin(w * p.nt * fr + p.pt), spark = .25 + .75 * tw * tw * tw;
    let r = 1.1 + 2.7 * p.z * p.z, a = env * spark;
    if (p.big) { r = 7 + 9 * p.z; a *= .2; }
    const aw = a * Math.pow(lk, .7) * 1.35, av = a * v * .55;
    if (aw > .004) { ctx.globalAlpha = Math.min(1, aw); ctx.drawImage(T_.moteW, x - r * 2, y - r * 2, r * 4, r * 4); }
    if (av > .004) { ctx.globalAlpha = Math.min(1, av); ctx.drawImage(T_.moteV, x - r * 2, y - r * 2, r * 4, r * 4); }
  }
  // 2. the grade: warm haze of the cone + deep falloff around the pool + frame vignette (one image); the brand light's own
  ctx.globalCompositeOperation = 'source-over';
  const gx = Math.round(SX(L.x)) - 520 - T_MX, gy = Math.round(SY(POOL_Y)) - POOL_Y - T_MY;
  if (on >= .998) { ctx.globalAlpha = 1; ctx.drawImage(T_.mGrade, gx, gy); }
  else { ctx.globalAlpha = 1; ctx.drawImage(T_.mVig, 0, 0); if (on > .002) { ctx.globalAlpha = on; ctx.drawImage(T_.mGradeNV, gx, gy); } }
  if (v > .002) { ctx.globalAlpha = v; ctx.drawImage(T_.mViolet, 0, 0); }
  // 3. fine film grain (seeded by the integer frame mod 480: the motion-blur sub-frames share it)
  const n = T_fm(Math.round(f));
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .13;
  ctx.drawImage(T_.grain[n & 1], -Math.floor(T_hash32(n * 13 + 5) * 256), -Math.floor(T_hash32(n * 17 + 11) * 256));
  ctx.restore();
}

/** the glass layer of one integer frame, composed once (the motion-blur sub-frames reuse it). Screen px, origin (0, GY0). */
const T_GY0 = 380;
function T_glassLayer(fr) {
  if (T_.gkey === fr) return T_.gl;
  T_.gkey = fr;
  const G2 = T_.glass, g = T_.glg || (T_.gl = makeCanvas(1080, 1000), T_.glg = T_.gl.getContext('2d'));
  const fade = 1 - T_io(T_kk(fr, 20, 88)), sp = .3 + .7 * (1 - Math.pow(1 - T_kk(fr, 4, 10), 3));
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1080, 1000);
  g.translate(0, -T_GY0); g.globalCompositeOperation = 'screen';
  const X = 540 - G2.cx, Y = 880 - G2.cy;
  // edge print + film (pressed at f4, slightly heavier for the first frames)
  g.globalAlpha = fade * (.55 + .45 * T_kk(fr, 4, 12)); g.drawImage(G2.edge, X, Y);
  // inner film: light while the carton still covers it (label readable), full once it leaves
  g.globalAlpha = fade * (.35 + .65 * T_kk(fr, 12, 18)); g.drawImage(G2.inner, X, Y);
  // splash: flies outwards for 6 frames then sticks
  const sc = .8 + .2 * sp; g.globalAlpha = fade * Math.min(1, sp * 1.3);
  g.save(); g.translate(540, 880); g.scale(sc, sc); g.drawImage(G2.spl, -G2.cx, -G2.cy); g.restore();
  // the puff itself: a soft cloud thrown out at the hit, settling into a faint smudge
  const pk = T_kk(fr, 4, 16), pa = fade * (fr < 6 ? .8 + .5 * T_kk(fr, 4, 5.5) : .35 + .95 * (1 - pk)), ps = 1 + .16 * (1 - Math.pow(1 - pk, 2));
  g.save(); g.translate(540, 880); g.scale(ps, ps); g.globalAlpha = Math.min(1, pa); g.drawImage(G2.puff, -G2.cx, -G2.cy);
  if (pa > 1) { g.globalAlpha = Math.min(1, pa - 1); g.drawImage(G2.puff, -G2.cx, -G2.cy); } g.restore();
  // impact bloom on the glass (f4–8)
  if (fr < 9) {
    const k = 1 - T_kk(fr, 4, 9), bl = g.createRadialGradient(540, 880, 120, 540, 880, 330);
    bl.addColorStop(0, 'rgba(255,236,210,0)'); bl.addColorStop(.6, `rgba(255,236,210,${(.06 * k).toFixed(3)})`); bl.addColorStop(1, 'rgba(255,236,210,0)');
    g.globalAlpha = 1; g.fillStyle = bl; g.fillRect(180, 520, 720, 720);
  }
  // reflection streak across the glass (the room light on the phone), slides a little while it lives
  const sl = 18 * T_kk(fr, 4, 90);
  g.translate(560 + sl, 850 - sl * .4); g.rotate(-.62);
  g.globalAlpha = fade * (.16 + .1 * (1 - T_kk(fr, 4, 12))); g.drawImage(G2.streak, -600, -120);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return T_.gl;
}
/** the phone glass: the dust print of the parcel (THOK at f4), gone by f90; one soft reflection streak. Screen space. */
function T_glass(f) {
  const fr = T_fm(f); if (fr < 4 || fr >= 88) return;          // fade reaches 0 at f88: clean glass from there to f479
  T_build();
  const gl = T_glassLayer(T_fm(Math.round(f)));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(gl, 0, T_GY0);
  ctx.restore();
}


// =============================================================================================
// MORNING (ep3): bulb off, warm raking sun through the door (upper left). Everything below is new; it reuses the night
// path's cloth, grain and violet maps.
// =============================================================================================
/** the shop's back wall in the morning, beyond the far edge: warm plaster in shade, three shelves of folded wax bolts,
 *  the door's daylight spilling from the left; out of focus (baked blur). Same footprint and alpha edge as T_buildBg. */
function T_buildBgDay() {
  const { M, FAR } = T_, BW = 1080 + 2 * M, BH = FAR + M + 40;
  const c = makeCanvas(BW, BH), g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, BH);
  lg.addColorStop(0, '#24170F'); lg.addColorStop(.5, '#33221A'); lg.addColorStop(.86, '#3C2A20'); lg.addColorStop(1, '#2A1C14');
  g.fillStyle = lg; g.fillRect(0, 0, BW, BH);
  // plaster mottling
  for (let i = 0; i < 60; i++) { const x = rnd(i * 4.1 + 2) * BW, y = rnd(i * 6.3 + 1) * BH, r = 40 + rnd(i * 2.7) * 140;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); const lt = rnd(i * 9.1) > .5; rg.addColorStop(0, lt ? 'rgba(120,86,60,.10)' : 'rgba(10,6,4,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  // shelves of folded wax (sharp first, blurred below)
  const sh = makeCanvas(BW, BH), q = sh.getContext('2d');
  const PAL = [['#2B2A7A', '#F2A534'], ['#E8622A', '#2A1A4A'], ['#F2C14E', '#7A2E8C'], ['#1F6B5A', '#F4E6C8'], ['#B8322A', '#F2A534'], ['#3A2C8E', '#EE5C27'], ['#F4E6C8', '#1E1A3A'], ['#7448EE', '#F2C14E']];
  [[150, 92], [318, 104], [470, 96]].forEach(([y, hh], r) => {
    q.fillStyle = '#5A3F2C'; q.fillRect(0, y, BW, 12); q.fillStyle = 'rgba(0,0,0,.45)'; q.fillRect(0, y + 12, BW, 10);   // plank + its shadow
    let x = -20 + rnd(r * 7.7) * 40;
    while (x < BW) {
      const w = 70 + rnd(x * .13 + r) * 60, n = 3 + Math.floor(rnd(x * .71 + r * 3) * 3), bh = hh / n;
      for (let k = 0; k < n; k++) {
        const p = PAL[Math.floor(rnd(x * 1.7 + k * 3.1 + r * 11) * PAL.length)], yy = y - (k + 1) * bh, ww = w - 6 * rnd(k + x);
        q.fillStyle = p[0]; q.fillRect(x, yy, ww, bh - 2);
        q.fillStyle = p[1]; for (let m = 0; m < 3; m++) q.fillRect(x + 6 + m * ww / 3, yy + bh * .3, ww / 7, bh * .38);       // the print, a hint
        q.fillStyle = 'rgba(255,240,220,.18)'; q.fillRect(x, yy, ww, 2);
      }
      x += w + 8 + rnd(x * .37) * 26;
    }
  });
  g.save(); g.filter = 'blur(9px) saturate(.55) brightness(.62)'; g.globalAlpha = .85; g.drawImage(sh, 0, 0); g.filter = 'none'; g.restore();
  // the daylight from the door: a warm spill on the left, the right side deeper in shade
  const sp = g.createRadialGradient(-120, 300, 40, -120, 300, 900); sp.addColorStop(0, 'rgba(255,200,130,.75)'); sp.addColorStop(.35, 'rgba(255,176,104,.30)'); sp.addColorStop(1, 'rgba(255,160,90,0)');
  g.globalCompositeOperation = 'screen'; g.fillStyle = sp; g.fillRect(0, 0, BW, BH); g.globalCompositeOperation = 'source-over';
  const rd = g.createLinearGradient(0, 0, BW, 0); rd.addColorStop(0, 'rgba(10,5,3,0)'); rd.addColorStop(.55, 'rgba(10,5,3,.05)'); rd.addColorStop(1, 'rgba(10,5,3,.42)'); g.fillStyle = rd; g.fillRect(0, 0, BW, BH);
  // alpha edge on the cloth's far edge + the shadow line under the drape (as T_buildBg)
  const id = g.getImageData(0, 0, BW, BH), d = id.data;
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const x = px - M, y = py - M, o = (py * BW + px) * 4, e = T_edgeY(x), a = e - y + .5;
    d[o + 3] = a >= 1 ? 255 : a <= 0 ? 0 : a * 255;
    if (a > 0 && y > e - 30) { const t = 1 - (e - y) / 30; d[o] *= 1 - .5 * t; d[o + 1] *= 1 - .5 * t; d[o + 2] *= 1 - .45 * t; }
  }
  g.putImageData(id, 0, 0);
  return c;
}
/** day maps (once): the cloth's light (multiply: cool dim shade → warm sun), the beam's glare on the glossy wax (screen),
 *  the god rays + haze of the door's light and a soft vignette (screen space, one image), the sunbeam motes */
function T_buildDay() {
  if (T_.dayBuilt) return; T_.dayBuilt = true;
  const { M, CY0 } = T_, CW = T_.cloth.width, CH = T_.cloth.height;
  const half = (w, h, fn) => { const c = makeCanvas(Math.ceil(w / 2), Math.ceil(h / 2)), g = c.getContext('2d'), id = g.createImageData(c.width, c.height), d = id.data;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) { const v = fn(i * 2 + 1, j * 2 + 1), o = (j * c.width + i) * 4; d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = v[3] ?? 255; }
    g.putImageData(id, 0, 0); return T_mapCanvas(w, h, gg => { gg.imageSmoothingQuality = 'high'; gg.drawImage(c, 0, 0, w, h); }); };
  // cloth light: shade (cool, ≈ 64 %) → sun (warm, full); a slow fall-off away from the door
  T_.mDay = half(CW, CH, (px, py) => {
    const x = px - M, y = py + CY0, s = sunAt(x, y), fx = T_c01((x - 200) / 900);
    const sh = [118 - 16 * fx, 124 - 16 * fx, 150 - 14 * fx], sn = [255, 238, 200];
    return [sh[0] + (sn[0] - sh[0]) * s, sh[1] + (sn[1] - sh[1]) * s, sh[2] + (sn[2] - sh[2]) * s];
  });
  // glare: the wax is glossy; the beam's core catches a warm sheen (strongest towards the door)
  T_.mGlare = half(CW, CH, (px, py) => {
    const x = px - M, y = py + CY0, s = sunAt(x, y), u = T_c01((x + 140) / 1360);
    const a = Math.pow(s, 1.6) * (.55 - .30 * u) * (.6 + .4 * T_vn(x * .004 + 3, y * .004 + 7));
    return [255, 214, 160, a * 255];
  });
  // screen space: two god rays from the door (upper left) down to the beam, warm haze, soft vignette (solved to one image)
  const W2 = 1080, H2 = 1920;
  T_.mRays = T_solve(W2, H2, g => {
    g.globalCompositeOperation = 'screen';
    const ray = (x0, y0, x1, y1, w0, w1, a) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      const lg = g.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, `rgba(255,206,140,${a})`); lg.addColorStop(.6, `rgba(255,196,130,${a * .55})`); lg.addColorStop(1, 'rgba(255,190,120,0)');
      for (let k = 0; k < 7; k++) {                       // soft edges: stacked, widening, fainter
        const f = 1 + k * .12; g.globalAlpha = .22; g.fillStyle = lg; g.beginPath();
        g.moveTo(x0 + nx * w0 * f, y0 + ny * w0 * f); g.lineTo(x1 + nx * w1 * f, y1 + ny * w1 * f); g.lineTo(x1 - nx * w1 * f, y1 - ny * w1 * f); g.lineTo(x0 - nx * w0 * f, y0 - ny * w0 * f); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
    };
    ray(-160, 140, 760, 1100, 70, 260, .22); ray(-200, 430, 980, 1320, 46, 200, .15); ray(-120, -60, 520, 760, 34, 130, .10);
    g.globalCompositeOperation = 'source-over';
    T_radial(g, 540, 1000, 1, 1.5, 860, [[0, 'rgba(18,8,4,0)'], [.55, 'rgba(18,8,4,0)'], [.75, 'rgba(18,8,4,.16)'], [.9, 'rgba(18,8,4,.32)'], [1, 'rgba(18,8,4,.5)']]);
    const rd = g.createLinearGradient(0, 0, 1080, 0); rd.addColorStop(0, 'rgba(18,8,4,0)'); rd.addColorStop(.7, 'rgba(18,8,4,0)'); rd.addColorStop(1, 'rgba(18,8,4,.16)');
    g.fillStyle = rd; g.fillRect(0, 0, 1080, 1920);
  });
  T_.bgDay = T_buildBgDay();
  T_.bgDayV = T_mapCanvas(T_.bgDay.width, T_.bgDay.height, g => { g.drawImage(T_.bgDay, 0, 0); g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, 0, 0, g.canvas.height); lg.addColorStop(0, 'rgba(96,70,210,.16)'); lg.addColorStop(1, 'rgba(60,40,150,.07)'); g.fillStyle = lg; g.fillRect(0, 0, g.canvas.width, g.canvas.height); });
  // motes in the sunbeam (air), drifting on closed periodic paths (480 f)
  T_.dmotes = [];
  for (let i = 0; i < 150; i++) {
    const u = rnd(i * 3.7 + 9), v = (rnd(i * 5.1 + 4) - .5) * 2;
    const x0 = -160 + u * 1140, y0 = 120 + u * 1100;                 // along the main ray
    T_.dmotes.push({ x: x0 + v * 170 * (1 - .3 * u) * .7, y: y0 - v * 170 * .7, z: rnd(i * 2.3 + 1), ax: 8 + rnd(i * 6.1) * 22, ay: 6 + rnd(i * 4.9) * 14,
      n1: 1 + Math.floor(rnd(i * 7.3) * 3), n2: 2 + Math.floor(rnd(i * 8.1) * 3), p1: rnd(i * 2.3) * T_TAU, p2: rnd(i * 1.9) * T_TAU,
      nt: 3 + Math.floor(rnd(i * 6.7) * 9), pt: rnd(i * 7.9) * T_TAU, big: i % 19 === 5 });
  }
}
function T_litClothDay(f, L) {
  T_buildDay();
  const sun = T_c01(L.sun ?? 1), v = T_c01(L.violet), dm = T_c01(L.dim || 0), key = `D|${sun.toFixed(3)}|${v.toFixed(3)}|${dm.toFixed(3)}`;
  if (T_.ckey === key) return T_.lc;
  T_.ckey = key;
  const g = T_.lcg, W = T_.lc.width, H = T_.lc.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  g.globalCompositeOperation = 'copy'; g.drawImage(T_.cloth, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.drawImage(T_.mDay, 0, 0);
  if (sun < .999) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = (1 - sun) * .5; g.fillStyle = '#2A1E30'; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'screen'; g.globalAlpha = sun; g.drawImage(T_.mGlare, 0, 0);
  g.globalCompositeOperation = 'source-over';
  if (dm > .002) { g.globalAlpha = dm * .22; g.fillStyle = NIGHT; g.fillRect(0, 0, W, H); }
  if (v > .002) {                                     // the brand light: even violet from above (as the night path)
    const vv = .5 * v, x2 = .28 * vv, x1 = .4 * vv / (1 - x2);
    g.globalAlpha = x1; g.drawImage(T_.cloth, 0, 0);
    g.globalAlpha = x2; g.fillStyle = VIOLET_L; g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(T_.cloth, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return T_.lc;
}
function T_tableDay(f, L, cam) {
  T_buildDay();
  const { M, CY0 } = T_, v = T_c01(L.violet), lc = T_litCloth(f, L);
  ctx.save();
  if (cam && T_isIdentity(ctx.getTransform())) T_applyCam(cam);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.drawImage(lc, -M, CY0);
  ctx.drawImage(T_.bgDay, -M, -M);
  if (v > .002) { ctx.globalAlpha = v; ctx.drawImage(T_.bgDayV, -M, -M); }
  const dm = T_c01(L.dim || 0); if (dm > .002) { ctx.globalAlpha = dm * .3; ctx.fillStyle = NIGHT; ctx.fillRect(-M, -M, 1080 + 2 * M, T_.FAR + M + 6); }
  ctx.restore();
}
function T_atmosDay(f, L) {
  T_buildDay();
  const fr = T_fm(f), v = T_c01(L.violet), sun = T_c01(L.sun ?? 1);
  const cam = (typeof SCORE !== 'undefined') ? SCORE.camera(f / 30) : { s: 1, cx: 540, cy: 1000, sx: 0, sy: 0 };
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // 1. god rays + vignette (one image), weaker when the sun dips and under the brand light
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .55 + .45 * sun * (1 - .5 * v); ctx.drawImage(T_.mRays, 0, 0);
  // 2. motes sparkling in the rays
  ctx.globalCompositeOperation = 'lighter';
  const w = T_TAU / 480;
  for (const p of T_.dmotes) {
    const wx = p.x + p.ax * Math.sin(w * p.n1 * fr + p.p1) + 6 * Math.sin(w * p.n2 * fr + p.p2), wy = p.y + p.ay * Math.sin(w * p.n2 * fr + p.p1) - 10 * Math.sin(w * fr + p.p2);
    const par = 1 + .5 * p.z, x = (wx - cam.cx) * (1 + (cam.s - 1) * par) + cam.cx + cam.sx * par, y = (wy - cam.cy) * (1 + (cam.s - 1) * par) + cam.cy + cam.sy * par;
    const tw = .5 + .5 * Math.sin(w * p.nt * fr + p.pt), spark = .2 + .8 * tw * tw * tw;
    let r = 1.1 + 2.6 * p.z * p.z, a = spark * .75 * sun * (1 - .6 * v);
    if (p.big) { r = 6 + 8 * p.z; a *= .18; }
    if (a > .004) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(T_.moteW, x - r * 2, y - r * 2, r * 4, r * 4); }
    if (v > .01) { ctx.globalAlpha = Math.min(1, spark * v * .5); ctx.drawImage(T_.moteV, x - r * 2, y - r * 2, r * 4, r * 4); }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (v > .002) { ctx.globalAlpha = v * .85; ctx.drawImage(T_.mViolet, 0, 0); }
  // 3. fine film grain (as the night path)
  const n = T_fm(Math.round(f));
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .11;
  ctx.drawImage(T_.grain[n & 1], -Math.floor(T_hash32(n * 13 + 5) * 256), -Math.floor(T_hash32(n * 17 + 11) * 256));
  ctx.restore();
}
