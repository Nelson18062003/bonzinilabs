'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » — shared light API, MORNING version of « PAS REÇU. » 02_light.js (same names and signatures, so the
// validated modules — margouillat 40_gecko.js, the plates of 30_plates.js and their variants — work unchanged).
// The bulb is OFF. Warm, raking morning sun comes in through the shop door (off-frame, left, high) and lies across the
// wax counter as a broad soft-edged beam (SUN below); everything outside the beam gets the cooler, dimmer daylight of the
// shop. L = SCORE.light(t) = {x, y (where the light comes from, world px: the gecko and the plates aim their rims at it),
//   on: 0 (bulb), day: 1, sun: 0..1 (beam strength; dips during the lesson), violet: 0..1 (Bonzini only), dim: 0..1}.
//   lightAt(x, y, L)            → {k: 0..1 light amount (≥ .5 everywhere: never night), v: violet, s: 0..1 inside the beam}
//   lit(hex, x, y, L, bias)     → 'rgb()' : the colour as seen at table point (x, y): warm and bright in the beam, a touch
//                                 cool in the shade; bias −1..1 = face turned away from / towards the door.
//                                 Brand moment (L.violet): the violet light from above tints it.
//   shadowOff(x, y, z, L)       → {x, y} cast-shadow offset for something z px above the cloth: long, down-RIGHT (raking
//                                 sun from the upper left); straight down under the violet light
//   softPath(pathFn, blur, color[, stroke, lw])  blurred fill/stroke via a pushed shadow (NEVER ctx.filter: 25 ms a call)
//   castShadow(pathFn, x, y, z, L, strength)     soft cast shadow of a footprint (crisper and darker in the beam)
//   sunAt(x, y)                  → 0..1 the beam footprint alone (soft edges), for anyone who wants a sun patch / glint
// Constants kept for the modules that read them: NIGHT, TUNG, VIOLET_L, POOL_Y, POOL_R.
// =============================================================================================
const NIGHT = '#140C26', TUNG = '#FFB24A', VIOLET_L = '#8F6BFF';
const POOL_Y = 1010, POOL_R = 1400;             // the gecko aims its rim light at (L.x, POOL_Y − 330): up-left, the door
// the beam on the cloth: an axis from the door side (left) descending to the right, wider far from the door
const SUN = { x0: -140, y0: 760, x1: 1220, y1: 1230, w0: 250, w1: 430, pen: 110 };
function hexRgb(h) {
  if (h[0] !== '#') { const m = h.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }
  h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function sunAt(x, y) {
  const dx = SUN.x1 - SUN.x0, dy = SUN.y1 - SUN.y0, L2 = dx * dx + dy * dy, u = ((x - SUN.x0) * dx + (y - SUN.y0) * dy) / L2;
  const px = SUN.x0 + dx * u, py = SUN.y0 + dy * u, d = Math.hypot(x - px, y - py), hw = SUN.w0 + (SUN.w1 - SUN.w0) * Math.max(0, Math.min(1, u));
  const e = Math.max(0, Math.min(1, (hw + SUN.pen / 2 - d) / SUN.pen));
  return e * e * (3 - 2 * e) * (1 - .22 * Math.max(0, Math.min(1, u)));       // a little weaker far from the door
}
/** {k: light 0..1, v: violet 0..1, s: beam 0..1} */
function lightAt(x, y, L) {
  const sun = L ? (L.sun ?? 1) : 1, s = sunAt(x, y) * sun;
  const amb = .56 - .10 * Math.max(0, Math.min(1, (x - 200) / 900)) - (L ? (L.dim || 0) * .12 : 0);   // shop daylight, a bit darker away from the door
  return { k: Math.max(0, Math.min(1, amb + (1 - amb) * s)), v: L ? (L.violet || 0) : 0, s };
}
function lit(hex, x, y, L, bias = 0) {
  const [r, g, b] = hexRgb(hex), [vr, vg, vb] = hexRgb(VIOLET_L);
  const { k, v, s } = lightAt(x, y, L);
  const e = .74 + .34 * k + .07 * bias;                         // exposure: never night, ±7 % by orientation
  let R = r * e * (1 + .06 * s), Gc = g * e * (1 + .015 * s), B = b * e * (1 - .08 * s + .05 * (1 - k));   // warm sun, cool shade
  if (v > 0) { const vv = v * (.42 + .18 * bias); R += (r * .55 + vr * .45 - R) * vv; Gc += (g * .5 + vg * .5 - Gc) * vv; B += (b * .45 + vb * .55 - B) * vv; }
  return `rgb(${Math.max(0, Math.min(255, R)) | 0},${Math.max(0, Math.min(255, Gc)) | 0},${Math.max(0, Math.min(255, B)) | 0})`;
}
/** the sun rakes in from the upper left: long shadows down-right; under the violet light (from above) straight down */
function shadowOff(x, y, z, L) {
  const v = L ? (L.violet || 0) : 0, m = 8 + z * .52;
  const o = { x: m * .78, y: m * .40 + z * .30 }, d = { x: 0, y: 10 + z * .5 };
  return { x: o.x + (d.x - o.x) * v, y: o.y + (d.y - o.y) * v };
}
/** blurred fill/stroke via a pushed shadow (shadowBlur ≈ 0.3 ms; ctx.filter blur ≈ 25 ms in this Chromium) */
function softPath(path, blur, color, stroke, lw) {
  // the push must stay modest: with a far push (30 000 px) Chromium still reads back right but composites a stale canvas
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
  ctx.translate(push, 0); ctx.beginPath(); path();
  if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(); }
  ctx.restore();
}
function castShadow(pathFn, x, y, z, L, strength = 1) {
  const { s, v } = lightAt(x, y, L);
  const a = strength * (.30 + .30 * s + .15 * v) * (1 - Math.min(.6, z / 400));
  if (a <= .01) return;
  const o = shadowOff(x, y, z, L);
  ctx.save(); ctx.translate(o.x, o.y); softPath(pathFn, (4 + z * .08) * (1.25 - .35 * s), `rgba(30,14,10,${a.toFixed(3)})`); ctx.restore();
}
