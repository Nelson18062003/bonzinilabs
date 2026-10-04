'use strict';
// =============================================================================================
// Shared light API — DAYLIGHT version for the Kraft & Fil paper table (same signatures as « PAS REÇU. » 02_light.js,
// so the margouillat rig and any lit module work unchanged). L = SCORE.light(t) = {x, y, on (soft daylight), violet}.
// The day: colours stay true (a touch warm where the window light falls), shadows are soft and warm-brown.
// The brand: L.violet 0..1 tints everything towards the Bonzini violet from above (only during the Bonzini sequence).
// =============================================================================================
const NIGHT = '#3B2A1E', TUNG = '#FFE6B8', VIOLET_L = '#8F6BFF';
const POOL_Y = 900, POOL_R = 1500;                       // a wide, soft window light centred on the table
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
/** light at a table point: {k: daylight 0..1 (gentle falloff), v: violet 0..1 (even, from above)} */
function lightAt(x, y, L) {
  const d = Math.hypot(x - L.x, (y - POOL_Y) / .82);
  const k = L.on * (.55 + .45 * Math.max(0, 1 - d / POOL_R));
  return { k: Math.min(1, k), v: L.violet || 0 };
}
/** the colour `hex` as seen at (x, y): true colour in daylight (slightly lifted where lit, a hair darker away from it),
 *  bathed in violet from above during the brand moment. bias −1..1 (+1 faces the light) */
function lit(hex, x, y, L, bias = 0) {
  const [r, g, b] = hexRgb(hex), [vr, vg, vb] = hexRgb(VIOLET_L);
  const { k, v } = lightAt(x, y, L);
  const e = .9 + .16 * Math.max(0, Math.min(1.1, k * (1 + .35 * bias)));   // ≈ 0.9 … 1.07
  let R = r * e * 1.01, Gc = g * e, B = b * e * .97;
  if (v > 0) { const vv = v * (.32 + .14 * bias); R = R + (r * .6 + vr * .4 - R) * vv; Gc = Gc + (g * .55 + vg * .45 - Gc) * vv; B = B + (b * .5 + vb * .5 - B) * vv; }
  return `rgb(${Math.max(0, Math.min(255, R)) | 0},${Math.max(0, Math.min(255, Gc)) | 0},${Math.max(0, Math.min(255, B)) | 0})`;
}
/** shadow offset on the table for something at height z standing at (x, y): daylight from the top-left window */
function shadowOff(x, y, z, L) { const m = 6 + z * .38; return { x: m * .55, y: m * .9 }; }
/** blurred fill/stroke via a pushed shadow (shadowBlur ≈ 0.3 ms; ctx.filter blur ≈ 25 ms in this Chromium — never use it) */
function softPath(path, blur, color, stroke, lw) {
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
  ctx.translate(push, 0); ctx.beginPath(); path();
  if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(); }
  ctx.restore();
}
/** soft contact shadow: pathFn() traces the footprint (table coords, already placed); z = height of the caster */
function castShadow(pathFn, x, y, z, L, strength = 1) {
  const a = strength * (.26 + .1 * (L.violet || 0)) * (1 - Math.min(.6, z / 400));
  if (a <= .01) return;
  const o = (L.violet || 0) > .5 ? { x: 0, y: 8 + z * .5 } : shadowOff(x, y, z, L);
  ctx.save(); ctx.translate(o.x, o.y); softPath(pathFn, 4 + z * .08, `rgba(60,32,12,${a.toFixed(3)})`); ctx.restore();
}
