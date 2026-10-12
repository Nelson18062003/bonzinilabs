'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » — shared light API, DAY version (Kraft & Fil packing table, soft window light from the
// top-left). Same names and signatures as « PAS REÇU. » 02_light.js, so the validated modules (margouillat 40_gecko.js,
// a plates variant of 30_plates.js…) work unchanged. L = SCORE.light(t) = {x, y, on (1), violet (0..1, Bonzini only), day: 1}.
//   lit(hex, x, y, L, bias)      → 'rgb(r,g,b)' : the colour as seen at table point (x, y). Day: near-true colour,
//                                  slightly brighter towards the window (top-left), slightly warm; bias −1..1 = the face
//                                  turned away from / towards the light. During the brand moment (L.violet) the violet
//                                  light from above tints it.
//   lightAt(x, y, L)             → {k: 0..1 light amount, v: violet}
//   shadowOff(x, y, z, L)        → {x, y} cast-shadow offset for something z px above the table (falls down-right)
//   softPath(pathFn, blur, color[, stroke, lw]) blurred fill/stroke via a pushed shadow (NEVER ctx.filter: 25 ms a call)
//   castShadow(pathFn, x, y, z, L, strength)    soft cast shadow of a footprint
// =============================================================================================
const NIGHT = '#140C26', TUNG = '#FFB24A', VIOLET_L = '#8F6BFF';
const POOL_Y = 1010, POOL_R = 1400;                 // kept for modules that read them (the gecko aims its light this way)
function hexRgb(h) {
  if (h[0] !== '#') { const m = h.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }
  h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
/** day: a broad window light from the top-left; k stays high everywhere (≥ .78) */
function lightAt(x, y, L) {
  const d = Math.hypot(x - (L ? L.x : 300), (y - 300) / 1.3);
  const k = .78 + .22 * Math.max(0, 1 - d / 1900);
  return { k: Math.min(1, k * (L ? (L.on ?? 1) : 1)), v: L ? (L.violet || 0) : 0 };
}
function lit(hex, x, y, L, bias = 0) {
  const [r, g, b] = hexRgb(hex), [vr, vg, vb] = hexRgb(VIOLET_L);
  const { k, v } = lightAt(x, y, L);
  const e = .92 + .12 * k + .06 * bias;                         // exposure: ±6 % by orientation
  let R = r * e * 1.015, Gc = g * e, B = b * e * .975;          // a touch warm (paper studio)
  if (v > 0) { const vv = v * (.30 + .12 * bias); R += (r * .62 + vr * .38 - R) * vv; Gc += (g * .58 + vg * .42 - Gc) * vv; B += (b * .5 + vb * .5 - B) * vv; }
  return `rgb(${Math.max(0, Math.min(255, R)) | 0},${Math.max(0, Math.min(255, Gc)) | 0},${Math.max(0, Math.min(255, B)) | 0})`;
}
/** the window is top-left: shadows fall down-right; under the violet light (from above) they fall straight down */
function shadowOff(x, y, z, L) {
  const v = L ? (L.violet || 0) : 0, m = 6 + z * .38;
  return { x: m * .55 * (1 - v), y: m * .75 + z * .25 };
}
/** blurred fill/stroke via a pushed shadow (shadowBlur ≈ 0.3 ms; ctx.filter blur ≈ 25 ms in this Chromium) */
function softPath(path, blur, color, stroke, lw) {
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
  ctx.translate(push, 0); ctx.beginPath(); path();
  if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(); }
  ctx.restore();
}
function castShadow(pathFn, x, y, z, L, strength = 1) {
  const a = strength * .34 * (1 - Math.min(.6, z / 400));
  if (a <= .01) return;
  const o = shadowOff(x, y, z, L);
  ctx.save(); ctx.translate(o.x, o.y); softPath(pathFn, 4 + z * .08, `rgba(60,32,12,${a.toFixed(3)})`); ctx.restore();
}
