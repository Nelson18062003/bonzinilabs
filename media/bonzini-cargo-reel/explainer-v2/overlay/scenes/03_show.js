'use strict';
// Game-show props (paper version): buzzer, marquee bulbs, round card, comment bubble, countdown dial.
/** big arcade buzzer (top 3/4 view), p = press depth 0..1, lit = glow */
function buzzer(p = 0, o = {}) {
  const col = o.color || M.red; ctx.save();
  withShadow(10, () => { ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.ellipse(0, 40, 170, 70, 0, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#3A3040'; ctx.fillRect(-170, 0, 340, 40); ctx.beginPath(); ctx.ellipse(0, 0, 170, 70, 0, 0, 7); ctx.fill();
  const up = 46 * (1 - p);
  ctx.fillStyle = '#8E1510'; ctx.fillRect(-120, -up, 240, up); ctx.beginPath(); ctx.ellipse(0, 0, 120, 48, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -up, 120, 48, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-40, -up - 14, 44, 14, -.2, 0, 7); ctx.fill();
  if (o.lit) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, -up, 10, 0, -up, 300); g.addColorStop(0, `rgba(255,80,40,${.45 * o.lit})`); g.addColorStop(1, 'rgba(255,80,40,0)'); ctx.fillStyle = g; ctx.fillRect(-300, -up - 300, 600, 600); }
  ctx.restore();
}
/** chasing marquee bulbs around a w×h rectangle centred at (0,0); t drives the chase */
function marquee(w, h, t, o = {}) {
  const step = o.step || 54, pts = [];
  for (let x = -w / 2; x < w / 2; x += step) pts.push([x, -h / 2]);
  for (let y = -h / 2; y < h / 2; y += step) pts.push([w / 2, y]);
  for (let x = w / 2; x > -w / 2; x -= step) pts.push([x, h / 2]);
  for (let y = h / 2; y > -h / 2; y -= step) pts.push([-w / 2, y]);
  const ph = Math.floor(t * (o.speed || 12));
  ctx.save();
  pts.forEach(([x, y], i) => { const on = (i + ph) % 3 === 0 || o.all;
    ctx.fillStyle = on ? '#FFE9A8' : '#B98A3A'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(255,214,120,.35)'; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill(); } });
  ctx.restore();
}
/** "MANCHE 3" card with a title under it */
function roundCard(num, title, o = {}) {
  const w = o.w || 760, h = o.h || 250; ctx.save();
  withShadow(14, () => { ctx.fillStyle = o.fill || C.ink; rrect(-w / 2, -h / 2, w, h, 26); ctx.fill(); });
  ctx.strokeStyle = C.amber; ctx.lineWidth = 6; rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 18); ctx.stroke();
  text('MANCHE ' + num, 0, -h / 2 + 112, { font: font(FF.stencil, 84, 900), align: 'center', color: C.amber, ls: 8 });
  text(title, 0, h / 2 - 48, { font: font(FF.body, o.titleSize || 64, 800), align: 'center', color: C.cream });
  ctx.restore();
}
/** comment bubble (social-app style, paper) with typed text; k = typing progress, cursor blinks with n */
function commentBubble(w, str, k, n, o = {}) {
  const h = o.h || 150; ctx.save();
  withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, 36); ctx.fill(); ctx.beginPath(); ctx.moveTo(-w / 2 + 60, h / 2 - 4); ctx.lineTo(-w / 2 + 40, h / 2 + 34); ctx.lineTo(-w / 2 + 100, h / 2 - 4); ctx.fill(); });
  ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(-w / 2 + 70, 0, 38, 0, 7); ctx.fill();
  text('?', -w / 2 + 70, 18, { font: font(FF.brand, 50, 900), align: 'center', color: '#fff' });
  const shown = str.slice(0, Math.round(str.length * clamp(k)));
  const f = font(FF.body, o.size || 54, 800); text(shown, -w / 2 + 130, 18, { font: f, color: C.ink });
  if (Math.floor(n / 12) % 2 === 0) { const x = -w / 2 + 134 + measure(shown, f); ctx.fillStyle = C.violetD; ctx.fillRect(x, -26, 6, 56); }
  ctx.restore();
}
/** countdown dial / progress ring, k 0..1 filled, label in the middle */
function dial(r, k, label, o = {}) {
  ctx.save();
  withShadow(8, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); });
  ctx.strokeStyle = 'rgba(35,22,41,.15)'; ctx.lineWidth = r * .22; ctx.beginPath(); ctx.arc(0, 0, r * .74, 0, 7); ctx.stroke();
  ctx.strokeStyle = o.color || C.orange; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * .74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k)); ctx.stroke();
  if (label) text(label, 0, r * .16, { font: font(FF.brand, r * .5, 900), align: 'center', color: C.ink });
  ctx.restore();
}
/** confetti burst of paper bits from (0,0) at local time s (seconds since burst) */
function confetti(s, count = 40, seed = 1) {
  if (s < 0 || s > 2.2) return; ctx.save();
  const cols = [C.violet, C.amber, C.orange, M.gain, C.cream];
  for (let i = 0; i < count; i++) {
    const a = rnd(seed + i * 1.7) * Math.PI * 2, v = 500 + rnd(seed + i * 2.3) * 700;
    const x = Math.cos(a) * v * s, y = Math.sin(a) * v * s * .7 + 900 * s * s, r = rnd(seed + i) * 6 + s * (rnd(seed + i * 3.1) - .5) * 12;
    at(x, y, r, 1, 1, () => { ctx.globalAlpha = clamp((2.2 - s) / .6); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-10, -6, 20, 12); });
  }
  ctx.restore();
}
