'use strict';
// Places & vehicles (paper cut-out): Mboppi market stall, bendskin (moto-taxi), Chinese truck, paper cargo boat, waves.
function poly(pts, fill, o = {}) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.stroke(); } }
const _BOAT = [[-150, -10], [150, -10], [100, 70], [-100, 70]], _SAIL = [[-10, -20], [-10, -170], [90, -20]];
/** folded-paper cargo boat (same as the freight episode), cargo 0..1 drops containers on deck */
function paperBoat(cargo = 1) {
  if (cargo > 0) { const cols = [C.sea, C.orange, C.violetD, C.amber, C.sea];
    cols.forEach((c, i) => { const d = spring(cargo * 2 - i * .12, 12, .5); if (d <= 0) return;
      ctx.fillStyle = c; rrect(-120 + i * 48, -52 - (1 - clamp(d)) * 120, 44, 42, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-116 + i * 48, -46 - (1 - clamp(d)) * 120, 36, 4); }); }
  poly(_SAIL, '#FFFFFF', { stroke: 'rgba(35,22,41,.15)' }); poly([[-10, -20], [-10, -170], [30, -20]], '#EDE7F3');
  poly(_BOAT, C.cream, { stroke: 'rgba(35,22,41,.18)' });
  ctx.fillStyle = C.sea; ctx.fillRect(-118, 18, 236, 22);
  poly([[-150, -10], [-100, 70], [-60, -10]], 'rgba(35,22,41,.08)'); poly([[150, -10], [100, 70], [60, -10]], 'rgba(35,22,41,.12)');
}
/** torn blue paper waves across the frame at y0 (parallax, on twos) */
function paperWaves(n, y0, amp = 1, x0 = -20, x1 = W + 20, depth = 4) {
  const ts = stepT(n); const cols = ['#9CC3E6', '#5E9ED6', '#2F78BD', C.sea].slice(0, depth);
  cols.forEach((c, L) => {
    const y = y0 + L * 60, sp = 40 + L * 30, ph = ts * sp * .02 + L;
    const Y = x => y + Math.sin(x * .012 + ph) * 14 * amp + (rnd(x * .3 + L * 7) - .5) * 5;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x0, y + 400); for (let x = x0; x <= x1; x += 18) ctx.lineTo(x, Y(x)); ctx.lineTo(x1, y + 400); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = x0; x <= x1; x += 18) x === x0 ? ctx.moveTo(x, Y(x)) : ctx.lineTo(x, Y(x)); ctx.stroke();
  });
}
/** market stall front (Mboppi): striped awning, sign, counter with shoe boxes. w ≈ 900. origin = counter top centre */
function stall(w, o = {}) {
  const h = o.h || 300; ctx.save();
  // back posts + awning
  ctx.fillStyle = C.kraftD; ctx.fillRect(-w / 2 + 20, -560, 26, 560); ctx.fillRect(w / 2 - 46, -560, 26, 560);
  const aw = w + 60, ay = -600;
  withShadow(10, () => { ctx.save(); ctx.beginPath(); ctx.moveTo(-aw / 2, ay); ctx.lineTo(aw / 2, ay); ctx.lineTo(aw / 2, ay + 110);
    for (let x = aw / 2; x > -aw / 2; x -= aw / 8) ctx.quadraticCurveTo(x - aw / 16, ay + 150, x - aw / 8, ay + 110); ctx.closePath(); ctx.clip();
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? C.cream : (o.stripe || C.orange); ctx.fillRect(-aw / 2 + i * aw / 16, ay, aw / 16 + 1, 170); } ctx.restore(); });
  // sign board
  if (o.sign) at(0, ay - 70, (o.signRot || -.02), 1, 1, () => { withShadow(8, () => { ctx.fillStyle = C.ink; rrect(-260, -52, 520, 104, 12); ctx.fill(); });
    text(o.sign, 0, 22, { font: font(FF.hand, 62, 800), align: 'center', color: C.amber }); });
  // shelf with shoe boxes behind
  if (o.boxes !== false) { ctx.fillStyle = C.kraftD; ctx.fillRect(-w / 2 + 40, -250, w - 80, 16);
    for (let i = 0; i < 6; i++) at(-w / 2 + 120 + i * (w - 240) / 5, -300, 0, 1, 1, () => shoeBox(120, 90, { band: [C.orange, C.violet, C.amber][i % 3], lift: 3 })); }
  if (o.behind) o.behind();                         // e.g. the trader, drawn between shelf and counter
  // counter
  withShadow(12, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(-w / 2, 0, w, h); });
  ctx.fillStyle = C.kraftD; ctx.fillRect(-w / 2, 0, w, 18);
  ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 3; for (let x = -w / 2 + 90; x < w / 2; x += 90) { ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, h); ctx.stroke(); }
  if (o.onTop) o.onTop();
  ctx.restore();
}
/** bendskin (moto-taxi) side view with rider + parcels; wheel spin by t; origin = ground under the engine */
function bendskin(t, o = {}) {
  ctx.save();
  const wheel = (x) => { at(x, -52, t * 12, 1, 1, () => { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill(); ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
    ctx.strokeStyle = '#231629'; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.57) * 24, Math.sin(i * 1.57) * 24); ctx.stroke(); } }); };
  wheel(-150); wheel(150);
  ctx.fillStyle = o.color || C.air; poly([[-170, -110], [60, -110], [120, -150], [175, -150], [150, -70], [-120, -70]], o.color || C.air);
  ctx.fillStyle = '#231629'; rrect(-120, -140, 170, 36, 14); ctx.fill();                       // seat
  ctx.strokeStyle = '#6A6070'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(150, -52); ctx.lineTo(120, -190); ctx.lineTo(90, -200); ctx.stroke();
  // rider (simple)
  ctx.fillStyle = o.shirt || C.amber; rrect(-40, -300, 90, 170, 30); ctx.fill();
  ctx.fillStyle = SKIN[2]; ctx.beginPath(); ctx.arc(10, -340, 42, 0, 7); ctx.fill();
  ctx.fillStyle = o.helmet || C.violetD; ctx.beginPath(); ctx.arc(10, -350, 46, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = SKIN[2]; ctx.lineWidth = 24; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(20, -260); ctx.lineTo(100, -200); ctx.stroke();
  ctx.strokeStyle = '#231629'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(60, -90); ctx.lineTo(50, -40); ctx.stroke();
  // parcels strapped on the back
  const n = o.parcels ?? 3; for (let i = 0; i < n; i++) at(-150 + (i % 2) * 18, -190 - i * 70, (i % 2 ? .05 : -.04), 1, 1, () => carton(130, 72, { seed: 40 + i, tape: true, bev: 8 }));
  ctx.restore();
}
/** small Chinese delivery truck (side view), origin = ground centre; t spins wheels */
function truck(t, o = {}) {
  ctx.save();
  const wheel = (x) => at(x, -40, t * 12, 1, 1, () => { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill(); ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); });
  withShadow(8, () => { ctx.fillStyle = o.box || '#2F78BD'; rrect(-260, -300, 360, 250, 10); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-248, -288, 336, 12);
  if (o.label) text(o.label, -80, -160, { font: `${o.labelSize || 56}px ${FF.cjk}`, align: 'center', color: '#fff' });
  ctx.fillStyle = o.cab || '#E9E1D2'; poly([[110, -220], [210, -220], [260, -140], [260, -50], [110, -50]], o.cab || '#E9E1D2');
  ctx.fillStyle = '#9CC3E6'; poly([[128, -205], [200, -205], [238, -145], [128, -145]], '#9CC3E6');
  ctx.fillStyle = '#231629'; ctx.fillRect(-270, -60, 540, 18);
  wheel(-170); wheel(-60); wheel(190);
  ctx.restore();
}
