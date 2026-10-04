'use strict';
// =============================================================================================
// Shared light API — ONE bulb for every module. L = SCORE.light(f) = {x, y, on (0..1 tungsten), violet (0..1)}.
// The bulb hangs above the table, off the top of the light pool; the pool is centred on (L.x, POOL_Y).
// =============================================================================================
const NIGHT = '#140C26', TUNG = '#FFB24A', VIOLET_L = '#8F6BFF';
const POOL_Y = 1010, POOL_R = 760;
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
/** light at a table point: {k: tungsten 0..1 (with falloff), v: violet 0..1 (even, from above)} */
function lightAt(x, y, L) {
  const d = Math.hypot(x - L.x, (y - POOL_Y) / .82);
  const k = L.on * Math.pow(Math.max(0, 1 - d / POOL_R), 1.5);
  return { k: Math.min(1, k), v: L.violet };
}
/** the colour `hex` as seen at (x, y): lit by the bulb (warm), sinking into the night outside the pool,
 *  or bathed in the brand's violet light from above during the brand moment. bias: -1..1 (face orientation: +1 faces the bulb) */
function lit(hex, x, y, L, bias = 0) {
  const [r, g, b] = hexRgb(hex), [nr, ng, nb] = hexRgb(NIGHT), [vr, vg, vb] = hexRgb(VIOLET_L);
  const { k, v } = lightAt(x, y, L);
  const kk = Math.max(0, Math.min(1.15, k * (1 + .35 * bias)));
  const amb = .16;                                              // what the night still shows
  const w = amb + (1 - amb) * kk;                               // 0..1 visibility
  let R = nr + (r * (1 + .10 * kk) - nr) * w, Gc = ng + (g * (1 + .03 * kk) - ng) * w, B = nb + (b * (1 - .10 * kk) - nb) * w;  // warm tungsten
  if (v > 0) { const vv = v * (.55 + .25 * bias); R = R + (r * .55 + vr * .45 - R) * vv; Gc = Gc + (g * .5 + vg * .5 - Gc) * vv; B = B + (b * .45 + vb * .55 - B) * vv; }
  return `rgb(${Math.max(0, Math.min(255, R)) | 0},${Math.max(0, Math.min(255, Gc)) | 0},${Math.max(0, Math.min(255, B)) | 0})`;
}
/** shadow offset on the table for something at height z (screen px) standing at table point (x, y) */
function shadowOff(x, y, z, L) {
  const dx = x - L.x, dy = y - (POOL_Y - 330), len = Math.hypot(dx, dy) || 1;
  const m = 10 + z * .42;
  return { x: dx / len * m, y: dy / len * m * .55 + z * .62 };   // the bulb is high: shadows fall mostly "down" the table
}
/** soft contact shadow: pathFn() traces the footprint (in table coords, already placed); z = height of the caster;
 *  strength 0..1. The shadow softens and fades as z grows, and disappears with the light. */
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
  const { k, v } = lightAt(x, y, L);
  const a = strength * (.62 * Math.max(k, .25) + .25 * v) * (1 - Math.min(.6, z / 400));
  if (a <= .01) return;
  const o = v > .5 ? { x: 0, y: 10 + z * .5 } : shadowOff(x, y, z, L);
  ctx.save(); ctx.translate(o.x, o.y); softPath(pathFn, 4 + z * .08, `rgba(8,4,18,${a.toFixed(3)})`); ctx.restore();
}
