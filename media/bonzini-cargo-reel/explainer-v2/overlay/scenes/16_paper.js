'use strict';
// =============================================================================================
// 16_paper — cut-paper props of « Le parcours de vos colis » V2 (final_storyboard §1.3, §2.3 T3/T7, §5.2).
// Owner: FOUNDATION-2 (f2). Chapter packages only CALL these. Every prop draws around the current origin
// (call it inside at(x, y, r, s, s, …)); origins are given per function. No lettering on any prop except the
// client tags. Deterministic: rnd() only; stepping (on twos) is done with t quantised to 15 poses/s.
// =============================================================================================

// ---------------------------------------------------------------- paper helpers
let _f2fib = null;
/** fibre texture over the current path (any coloured paper), a = strength */
function f2_fibres(pathFn, a = .55) {
  if (!_f2fib) {
    const c = makeCanvas(384, 384), g = c.getContext('2d');
    for (let i = 0; i < 1100; i++) {
      const x = rnd(i * 1.7 + 11) * 384, y = rnd(i * 2.9 + 5) * 384, an = rnd(i * 3.3) * Math.PI, l = 3 + rnd(i * 4.7) * 10;
      g.strokeStyle = rnd(i * 6.1) > .5 ? 'rgba(255,255,255,.24)' : 'rgba(40,20,0,.12)'; g.lineWidth = rnd(i) > .8 ? 1.3 : .8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
    }
    for (let i = 0; i < 40; i++) { const x = rnd(i * 9.3) * 384, y = rnd(i * 7.1) * 384, r = 20 + rnd(i * 5.5) * 50, rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rnd(i) > .5 ? 'rgba(255,255,255,.07)' : 'rgba(40,20,0,.05)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    _f2fib = ctx.createPattern(c, 'repeat');
  }
  ctx.save(); pathFn(); ctx.clip(); ctx.globalAlpha *= a; ctx.fillStyle = _f2fib; ctx.fillRect(-3000, -3000, 6000, 6000); ctx.restore();
}
/** light cut-edge line just inside a path (paper thickness catching the light) */
function f2_edge(pathFn, a = .28, w = 2) { ctx.save(); pathFn(); ctx.clip(); ctx.strokeStyle = `rgba(255,248,232,${a})`; ctx.lineWidth = w * 2; pathFn(); ctx.stroke(); ctx.restore(); }
function f2_poly(P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }
const f2_tw = t => Math.floor(t * 15) / 15;                    // time on twos
const F2_TAPE = { A: 'rgba(243,167,69,.88)', B: 'rgba(254,86,13,.80)' };

// ---------------------------------------------------------------- client cartons + tags (s2, s5)
/** client carton, top view, centred. tapeCol: 'A' (amber, Client A) | 'B' (orange, Client B) | any CSS colour. Never violet. */
function hp_clientCarton(w = 180, h = 135, tapeCol = 'A', seed = 1) {
  const tc = F2_TAPE[tapeCol] || tapeCol || C.tape, bev = 9;
  withShadow(6, () => { ctx.fillStyle = C.kraftD; rrect(-w / 2 + bev * .4, -h / 2 + bev * .6, w, h, 6); ctx.fill(); });
  carton(w, h, { tape: false, seed, bev });
  ctx.save();
  // handling marks (ink stamp, no lettering): two « this way up » arrows
  const side = rnd(seed * 3.3) > .5 ? 1 : -1;
  at(-side * w * .3, -h * .26, 0, w / 180, w / 180, () => { ctx.globalAlpha *= .55; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const dx of [-9, 9]) { ctx.beginPath(); ctx.moveTo(dx, 12); ctx.lineTo(dx, -10); ctx.moveTo(dx - 6, -4); ctx.lineTo(dx, -11); ctx.lineTo(dx + 6, -4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-17, 16); ctx.lineTo(17, 16); ctx.stroke(); });
  // blank address label (lines only)
  at(side * w * .22, h * .25, (rnd(seed * 5.1) - .5) * .14, 1, 1, () => {
    const lw = w * .34, lh = h * .26;
    ctx.fillStyle = 'rgba(60,32,12,.14)'; rrect(-lw / 2 + 2, -lh / 2 + 3, lw, lh, 3); ctx.fill();
    ctx.fillStyle = '#FFFDF6'; rrect(-lw / 2, -lh / 2, lw, lh, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.38)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    [.7, .5, .6].forEach((f, i) => { const y = -lh / 2 + lh * (i + 1) / 4; ctx.beginPath(); ctx.moveTo(-lw / 2 + 6, y); ctx.lineTo(-lw / 2 + 6 + (lw - 12) * f, y); ctx.stroke(); });
  });
  // tape along the flap seam, wrapping over both edges
  const tw = Math.min(40, h * .3);
  ctx.fillStyle = tc; ctx.beginPath(); const top = tornLine(-w / 2 - 7, -tw / 2, w / 2 + 7, -tw / 2, 11 + seed, 1.1, 8), bot = tornLine(w / 2 + 7, tw / 2, -w / 2 - 7, tw / 2, 19 + seed, 1.1, 8);
  ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-w / 2 - 4, -tw / 2 + 3, w + 8, 3);
  ctx.fillStyle = 'rgba(60,32,12,.10)'; ctx.fillRect(-w / 2 - 4, tw / 2 - 4, w + 8, 3);
  ctx.restore();
}
/** kraft mini-tag with a cream insert (« Client A », « Client B », « Vous »), centred at (x, y) in screen coords.
 *  o: {color (ink; violetD for « Vous »), size 46, rot, s, k (pop 0..1), from:[x,y] string attach point, w, lift} */
function hp_clientTag(str, x, y, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return;
  const f = font(FF.body, o.size || 46, 800), tw = measure(str, f), w = Math.max(o.w || 230, tw + 100), h = o.h || 76;
  const s = (o.s || 1) * (.7 + .3 * eOutBack(clamp(k))), r = o.rot ?? -.02, gx = -w / 2 + 25;
  if (o.from) {                                                 // the string: attach point → grommet, slight sag
    const c = Math.cos(r), sn = Math.sin(r), ex = x + gx * s * c, ey = y + gx * s * sn, [fx, fy] = o.from;
    ctx.save(); ctx.globalAlpha *= clamp(k * 3); ctx.strokeStyle = '#4A3A30'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + ex) / 2 - 10, Math.max(fy, ey) + 18, ex, ey); ctx.stroke(); ctx.restore();
  }
  at(x, y, r, s, s, () => {
    ctx.globalAlpha *= clamp(k * 3);
    const body = () => { ctx.beginPath(); ctx.moveTo(-w / 2 + 22, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 22, h / 2); ctx.lineTo(-w / 2, h / 2 - 22); ctx.lineTo(-w / 2, -h / 2 + 22); ctx.closePath(); };
    withShadow(o.lift ?? 6, () => { ctx.fillStyle = TEX.kraft || C.kraft; body(); ctx.fill(); });
    f2_edge(body, .25);
    ctx.fillStyle = C.cream; rrect(-w / 2 + 50, -h / 2 + 9, w - 60, h - 18, 7); ctx.fill();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(gx, 0, 12, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(gx, 0, 5, 0, 7); ctx.fill();
    text(str, (-w / 2 + 50 + w / 2 - 10) / 2, (o.size || 46) * .35, { font: f, align: 'center', color: o.color || C.ink });
  });
}

// ---------------------------------------------------------------- the paper container (matches the real teal one)
function f2_ribs(x0, y0, w, h, pitch, a = .55, vertical = true) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  const n = Math.ceil((vertical ? w : h) / pitch) + 1;
  for (let i = 0; i < n; i++) {
    const p = (vertical ? x0 : y0) + i * pitch;
    ctx.fillStyle = `rgba(44,111,140,${a})`; vertical ? ctx.fillRect(p, y0, pitch * .42, h) : ctx.fillRect(x0, p, w, pitch * .42);
    ctx.fillStyle = 'rgba(255,255,255,.13)'; vertical ? ctx.fillRect(p + pitch * .42, y0, 2, h) : ctx.fillRect(x0, p + pitch * .42, w, 2);
  }
  ctx.restore();
}
function f2_casting(x, y, s = 14) { ctx.fillStyle = '#1F4E63'; rrect(x - s / 2, y - s / 2, s, s, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, 2); }
/**
 * Paper container (C.box, ribs C.boxRib, never lettering). view 'top' (820×340, open box seen from above, door end RIGHT) |
 * 'side' (300×128, side view). Origin = centre of the top / of the side face.
 * o: lid 0..1 (top: ribbed lid slides on from the right; pass it eased), label (true | 0..1 pop: mini label on the lid's right
 *    end / near the door on 'side'), fill (colour override, default C.box), inside() (top: contents drawn on the floor, under
 *    the walls), part ('all' | 'base' | 'lid' — base at z 20, lid above the hero at z 50), lift (shadow height).
 */
function hp_paperContainer(view = 'top', o = {}) {
  if (view === 'side') return f2_contSide(o);
  const col = typeof o.fill === 'string' ? o.fill : C.box, part = o.part || 'all', hw = 410, hh = 170, wall = 16;
  if (part !== 'lid') {
    withShadow(o.lift ?? 8, () => { ctx.fillStyle = C.boxRib; rrect(-hw, -hh, 2 * hw + 10, 2 * hh + 30, 6); ctx.fill(); });
    // front face (long wall seen at an angle): corrugated
    const face = [[-hw, hh], [hw, hh], [hw + 10, hh + 30], [-hw + 4, hh + 30]];
    ctx.save(); f2_poly(face); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(-hw, hh, 2 * hw + 12, 32); f2_ribs(-hw, hh, 2 * hw + 12, 32, 22, .7);
    ctx.fillStyle = 'rgba(20,50,64,.35)'; ctx.fillRect(-hw, hh + 24, 2 * hw + 12, 8); ctx.restore();
    // door end face (right), two lock rods
    const dface = [[hw, -hh], [hw + 10, -hh + 6], [hw + 10, hh + 30], [hw, hh]];
    ctx.fillStyle = '#2A6A86'; f2_poly(dface); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; for (const y of [-hh * .5, hh * .5]) { ctx.beginPath(); ctx.moveTo(hw + 5, y - 52); ctx.lineTo(hw + 5, y + 52); ctx.stroke(); }
    // floor
    const fx0 = -hw + wall, fy0 = -hh + wall, fw = 2 * hw - wall - 20, fh = 2 * hh - 2 * wall;
    ctx.fillStyle = C.kraftL; ctx.fillRect(fx0, fy0, fw, fh);
    f2_fibres(() => { ctx.beginPath(); ctx.rect(fx0, fy0, fw, fh); }, .7);
    ctx.strokeStyle = 'rgba(156,116,71,.32)'; ctx.lineWidth = 2; for (let y = fy0 + 44; y < fy0 + fh - 4; y += 44) { ctx.beginPath(); ctx.moveTo(fx0, y); ctx.lineTo(fx0 + fw, y); ctx.stroke(); }
    ctx.fillStyle = C.boxRib; ctx.fillRect(fx0, fy0, fw, 22); f2_ribs(fx0, fy0, fw, 22, 22, .55);          // inner face of the far wall
    ctx.fillStyle = 'rgba(20,50,64,.3)'; ctx.fillRect(fx0, fy0 + 19, fw, 3);
    let g = ctx.createLinearGradient(0, fy0 + 22, 0, fy0 + 52); g.addColorStop(0, 'rgba(60,32,12,.30)'); g.addColorStop(1, 'rgba(60,32,12,0)'); ctx.fillStyle = g; ctx.fillRect(fx0, fy0 + 22, fw, 30);
    g = ctx.createLinearGradient(fx0, 0, fx0 + 20, 0); g.addColorStop(0, 'rgba(60,32,12,.24)'); g.addColorStop(1, 'rgba(60,32,12,0)'); ctx.fillStyle = g; ctx.fillRect(fx0, fy0, 20, fh);
    if (typeof o.inside === 'function') o.inside();
    // wall tops
    ctx.fillStyle = col;
    ctx.fillRect(-hw, -hh, 2 * hw, wall); ctx.fillRect(-hw, hh - wall, 2 * hw, wall); ctx.fillRect(-hw, -hh, wall, 2 * hh);
    ctx.fillRect(hw - 20, -hh, 20, 2 * hh);                                       // door end: two leaves
    ctx.fillStyle = 'rgba(44,111,140,.85)'; for (let x = -hw + 22; x < hw - 24; x += 22) { ctx.fillRect(x, -hh + 2, 3, wall - 4); ctx.fillRect(x, hh - wall + 2, 3, wall - 4); }
    for (let y = -hh + 22; y < hh - 10; y += 22) ctx.fillRect(-hw + 2, y, wall - 4, 3);
    ctx.fillStyle = 'rgba(20,50,64,.55)'; ctx.fillRect(hw - 11, -hh + wall, 2, 2 * hh - 2 * wall);   // leaves' seam
    ctx.fillStyle = C.ink; for (const y of [-hh * .5, hh * .5]) { rrect(hw - 17, y - 22, 6, 44, 3); ctx.fill(); ctx.beginPath(); ctx.arc(hw - 14, y + 26, 5, 0, 7); ctx.fill(); }
    f2_casting(-hw + 7, -hh + 7); f2_casting(hw - 7, -hh + 7); f2_casting(-hw + 7, hh - 7); f2_casting(hw - 7, hh - 7);
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.strokeRect(-hw + 1, -hh + 1, 2 * hw - 2, 2 * hh - 2);
  }
  const lid = clamp(o.lid ?? 0);
  if (part !== 'base' && lid > 0) {
    at((1 - lid) * 880, 0, 0, 1, 1, () => {
      const lw = hw + 4, lh = hh + 4, body = () => rrect(-lw, -lh, 2 * lw, 2 * lh, 7);
      withShadow(6 + 16 * (1 - lid), () => { ctx.fillStyle = col; body(); ctx.fill(); });
      ctx.save(); body(); ctx.clip(); f2_ribs(-lw, -lh, 2 * lw, 2 * lh, 22, .55); ctx.restore();
      ctx.strokeStyle = C.boxRib; ctx.lineWidth = 12; rrect(-lw + 6, -lh + 6, 2 * lw - 12, 2 * lh - 12, 4); ctx.stroke();
      f2_fibres(body, .45); f2_edge(body, .3);
      f2_casting(-lw + 9, -lh + 9); f2_casting(lw - 9, -lh + 9); f2_casting(-lw + 9, lh - 9); f2_casting(lw - 9, lh - 9);
      const lk = o.label === true ? 1 : +o.label || 0;
      if (lk > 0) { const s = .55 * (.6 + .4 * eOutBack(clamp(lk))); ctx.save(); ctx.globalAlpha *= clamp(lk * 4); at(lw - 92, 0, -.04, s, s, f2_mini); ctx.restore(); }
    });
  }
}
function f2_contSide(o) {
  const col = typeof o.fill === 'string' ? o.fill : C.box, w = 300, h = 128, body = () => rrect(-w / 2, -h / 2, w, h, 4);
  withShadow(o.lift ?? 6, () => { ctx.fillStyle = col; body(); ctx.fill(); });
  ctx.save(); body(); ctx.clip();
  f2_ribs(-w / 2, -h / 2, w, h, 12, .6);
  ctx.fillStyle = C.boxRib; ctx.fillRect(-w / 2, -h / 2, w, 11); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-w / 2, -h / 2 + 2, w, 2);
  ctx.fillStyle = '#245A72'; ctx.fillRect(-w / 2, h / 2 - 9, w, 9);
  ctx.fillStyle = '#4C9DBD'; ctx.fillRect(w / 2 - 44, -h / 2 + 11, 40, h - 20);            // door end
  ctx.fillStyle = 'rgba(20,50,64,.5)'; ctx.fillRect(w / 2 - 25, -h / 2 + 11, 2, h - 20);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  for (const x of [w / 2 - 36, w / 2 - 13]) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + 15); ctx.lineTo(x, h / 2 - 13); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x - 7, 12); ctx.stroke(); }
  ctx.restore();
  f2_fibres(body, .45); f2_edge(body, .28);
  for (const [x, y] of [[-w / 2 + 7, -h / 2 + 6], [w / 2 - 7, -h / 2 + 6], [-w / 2 + 7, h / 2 - 6], [w / 2 - 7, h / 2 - 6]]) f2_casting(x, y, 12);
  const lk = o.label === false ? 0 : o.label == null || o.label === true ? 1 : +o.label;
  if (lk > 0) { const s = .3 * (.6 + .4 * eOutBack(clamp(lk))); ctx.save(); ctx.globalAlpha *= clamp(lk * 4); at(w / 2 - 80, 2, -.03, s, s, f2_mini); ctx.restore(); }
}

// ---------------------------------------------------------------- paper truck (orange cab, C.box box) — kit truck() geometry
function f2_wheel(x, y, a) {
  at(x, y, a, 1, 1, () => {
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 33, 0, 7); ctx.stroke();
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 22); g.addColorStop(0, '#E4E7EA'); g.addColorStop(1, '#9A9FA6');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
    ctx.fillStyle = '#4A4F57'; for (let i = 0; i < 5; i++) { const b = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(b) * 12, Math.sin(b) * 12, 2.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#6A6F76'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(29, 0, 3.2, 0, 7); ctx.fill();          // valve: shows the spin
  });
}
/**
 * Cut-paper truck carrying our container: orange cab, C.box ribbed box, mini label (s .7) on the box, wheels on twos.
 * Origin = ground centre (kit truck geometry: box x −260…100, y −300…−50; cab x 110…264; wheels at −170, −60, 190).
 * o: label (true | 0..1 pop | false), wheel (rad: pass distance/40 for a true roll; default spins with t), bob (suspension
 *    bob on twos while driving), lift (shadow height of the body).
 */
function hp_paperTruck(t, o = {}) {
  const tw = f2_tw(t), wa = o.wheel ?? tw * 12, bob = o.bob ? (Math.floor(t * 15) % 2 ? -2 : 0) : 0;
  ctx.save();
  const gs = ctx.createRadialGradient(0, 0, 10, 0, 0, 300); gs.addColorStop(0, 'rgba(60,32,12,.22)'); gs.addColorStop(1, 'rgba(60,32,12,0)');
  ctx.save(); ctx.scale(1, .06); ctx.fillStyle = gs; ctx.beginPath(); ctx.arc(0, 0, 300, 0, 7); ctx.fill(); ctx.restore();
  ctx.translate(0, bob);
  // box (container)
  const box = () => rrect(-260, -300, 360, 250, 8);
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = C.box; box(); ctx.fill(); });
  ctx.save(); box(); ctx.clip();
  f2_ribs(-252, -290, 344, 230, 18, .5);
  ctx.fillStyle = C.boxRib; ctx.fillRect(-260, -300, 360, 13); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-260, -298, 360, 2);
  ctx.fillStyle = '#245E78'; ctx.fillRect(-260, -68, 360, 18);
  ctx.fillStyle = '#2A6A86'; ctx.fillRect(-260, -300, 12, 250); ctx.fillRect(88, -300, 12, 250);
  ctx.restore();
  f2_fibres(box, .45); f2_edge(box, .3);
  for (const [x, y] of [[-253, -293], [93, -293], [-253, -57], [93, -57]]) f2_casting(x, y, 12);
  const lk = o.label === false ? 0 : o.label == null || o.label === true ? 1 : +o.label;
  if (lk > 0) { const s = .7 * (.6 + .4 * eOutBack(clamp(lk))); ctx.save(); ctx.globalAlpha *= clamp(lk * 4); at(-80, -175, -.03, s, s, f2_mini); ctx.restore(); }
  // chassis
  ctx.fillStyle = '#2B2230'; rrect(-272, -62, 544, 18, 5); ctx.fill();
  // cab
  const cab = () => { f2_poly([[106, -222], [200, -222], [226, -190], [256, -152], [264, -136], [264, -56], [106, -56]]); };
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = C.orange; ctx.lineJoin = 'round'; ctx.strokeStyle = C.orange; ctx.lineWidth = 8; cab(); ctx.fill(); ctx.stroke(); });
  f2_fibres(cab, .5); f2_edge(cab, .3);
  ctx.fillStyle = '#9CC3E6'; f2_poly([[126, -206], [194, -206], [236, -148], [126, -148]]); ctx.fill();
  ctx.save(); f2_poly([[126, -206], [194, -206], [236, -148], [126, -148]]); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)';
  f2_poly([[150, -210], [172, -210], [140, -144], [118, -144]]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; f2_poly([[182, -210], [190, -210], [158, -144], [150, -144]]); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(35,22,41,.28)'; ctx.lineWidth = 2.5; rrect(120, -140, 98, 80, 6); ctx.stroke();
  ctx.fillStyle = 'rgba(35,22,41,.7)'; rrect(194, -126, 16, 6, 3); ctx.fill();
  ctx.fillStyle = C.amber; rrect(252, -116, 13, 22, 4); ctx.fill(); ctx.fillStyle = '#FFF6DE'; ctx.beginPath(); ctx.arc(258, -108, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#2B2230'; rrect(238, -66, 34, 14, 4); ctx.fill();
  ctx.strokeStyle = '#2B2230'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, -196); ctx.lineTo(96, -200); ctx.stroke(); rrect(88, -214, 10, 22, 3); ctx.fillStyle = '#2B2230'; ctx.fill();
  ctx.restore();
  // mudguards + wheels (wheels don't bob)
  ctx.save(); ctx.strokeStyle = '#1E1622'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const x of [-170, -60, 190]) { ctx.beginPath(); ctx.arc(x, -40 + bob, 47, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
  ctx.restore();
  for (const x of [-170, -60, 190]) f2_wheel(x, -40, wa);
}

// ---------------------------------------------------------------- footprints (s6)
const _f2sole = {};
function f2_soleSprite(left) {
  const key = left ? 'L' : 'R'; if (_f2sole[key]) return _f2sole[key];
  const c = makeCanvas(100, 200), g = c.getContext('2d'); g.translate(50, 100); g.scale(left ? -2 : 2, 2);
  g.fillStyle = '#231629'; g.beginPath(); g.moveTo(0, -42); g.bezierCurveTo(14, -42, 21, -26, 20, -10); g.bezierCurveTo(19, 4, 15, 12, 14, 22);
  g.bezierCurveTo(14, 36, 10, 42, 0, 42); g.bezierCurveTo(-10, 42, -14, 36, -13, 26); g.bezierCurveTo(-12, 16, -7, 8, -10, -6); g.bezierCurveTo(-13, -24, -14, -42, 0, -42); g.closePath(); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.lineWidth = 3.2; g.strokeStyle = '#000'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-16, 15); g.lineTo(18, 13); g.stroke();                                   // sole | heel gap
  g.lineWidth = 1.6; for (const y of [-31, -22, -13, -4, 5]) { g.beginPath(); g.moveTo(-15, y + 2); g.lineTo(18, y - 1); g.stroke(); }
  for (const y of [25, 33]) { g.beginPath(); g.moveTo(-10, y); g.lineTo(11, y - 1); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .38; g.drawImage(TEX.starve, 0, 0, 300, 150, 0, 0, 100, 200);
  return (_f2sole[key] = c);
}
/** ink shoe soles (40×84) walking along `path` (polyline [[x,y]…], screen coords): o.n prints (6), k 0..1 = how far the walk
 *  got (pass it on twos: k = prog(stepT(n), t0, t0 + 0.1·n)); alternate ±18 px, toe along the path; newest print pops.
 *  o: {n, alpha (.8), lateral 18, size (1), fit (true: shrink the soles when the path is too short for n clean steps)} */
function hp_footprints(path, k, o = {}) {
  const n = o.n || 6, cnt = Math.min(n, Math.floor(clamp(k) * n + 1e-6)); if (cnt <= 0) return;
  const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const tot = L[L.length - 1], at_ = d => { for (let i = 1; i < path.length; i++) if (d <= L[i] || i === path.length - 1) { const f = clamp((d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1])), a = path[i - 1], b = path[i];
    return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), tx: (b[0] - a[0]) / Math.max(1e-6, L[i] - L[i - 1]), ty: (b[1] - a[1]) / Math.max(1e-6, L[i] - L[i - 1]) }; } };
  // auto-fit (o.fit !== false): consecutive soles may not overlap — either far enough apart along the path, or side by side
  const lat0 = o.lateral ?? 18, gap = n > 1 ? tot / (n - 1) : 1e3, sz0 = o.size || 1;
  const sz = o.fit === false || gap >= 84 * sz0 ? sz0 : Math.min(sz0, Math.max(gap / 84, 2 * lat0 / 44));
  const frac = clamp(k) * n - (cnt - 1);
  ctx.save(); ctx.globalAlpha *= o.alpha ?? .8;
  for (let i = 0; i < cnt; i++) {
    const p = at_(tot * (n > 1 ? i / (n - 1) : .5)), left = i % 2 === 0, lat = lat0 * (left ? 1 : -1);
    const x = p.x + p.ty * lat, y = p.y - p.tx * lat, r = Math.atan2(p.ty, p.tx) + Math.PI / 2 + (left ? -.08 : .08);
    const s = sz * (i === cnt - 1 ? 1 + .14 * (1 - clamp(frac * 3)) : 1);
    at(x, y, r, s, s, () => ctx.drawImage(f2_soleSprite(left), -25, -50, 50, 100));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- paper warehouse (s5): pop-up walls + gable roof
/**
 * Kraft warehouse front that folds up around the stack. Origin = ground centre; spans x ±w/2, y −480…0 (w 720 → at (540,1180):
 * x 180–900, y 700–1180). k 0..1 = fold-up (4 poses unless o.twos === false). o.part: 'back' (dark back wall: draw it before the
 * cartons) | 'front' (walls, roll-up door, gable, roof: after) | 'all'. o.logo 0..1: cream disc r 70 + logo 100 slapped on
 * the gable at local (0, −380).
 */
function hp_roofFold(k, w = 720, o = {}) {
  k = clamp(k); if (k <= 0) return;
  const i = o.twos === false ? null : Math.min(4, Math.ceil(k * 4));
  const wY = i == null ? Math.min(1, eOutBack(clamp(k * 1.4), 1.6)) : [0, .3, .78, 1.06, 1][i];
  const rY = i == null ? eOutBack(clamp(k * 1.6 - .5), 1.6) : [0, 0, .45, 1.1, 1][i];
  const hw = w / 2, ww = 74, eh = 280, rh = 200, ov = 28, part = o.part || 'all';
  if (part !== 'front') {                                              // back wall (inside)
    at(0, 0, 0, 1, wY, () => { const x0 = -hw + ww, bw = 2 * (hw - ww);
      const g = ctx.createLinearGradient(0, -eh, 0, 0); g.addColorStop(0, '#6F4F2E'); g.addColorStop(1, '#9C7447'); ctx.fillStyle = g; ctx.fillRect(x0, -eh, bw, eh);
      ctx.strokeStyle = 'rgba(50,28,10,.25)'; ctx.lineWidth = 2; for (let x = x0 + 36; x < x0 + bw; x += 36) { ctx.beginPath(); ctx.moveTo(x, -eh); ctx.lineTo(x, 0); ctx.stroke(); }
      f2_fibres(() => { ctx.beginPath(); ctx.rect(x0, -eh, bw, eh); }, .5); });
  }
  if (part === 'back') return;
  // side walls (hinged at the ground)
  at(0, 0, 0, 1, wY, () => {
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? -hw : hw - ww, wall = () => { ctx.beginPath(); ctx.rect(x0, -eh, ww, eh); };
      withShadow(6, () => { ctx.fillStyle = TEX.kraft || C.kraft; wall(); ctx.fill(); });
      ctx.strokeStyle = 'rgba(110,76,40,.4)'; ctx.lineWidth = 2; for (let x = x0 + 18; x < x0 + ww; x += 19) { ctx.beginPath(); ctx.moveTo(x, -eh + 4); ctx.lineTo(x, 0); ctx.stroke(); }
      ctx.fillStyle = C.kraftD; ctx.fillRect(sd < 0 ? x0 + ww - 7 : x0, -eh, 7, eh);           // wall thickness (inner edge)
      ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.fillRect(x0, -14, ww, 14);                       // plinth
      f2_edge(wall, .3);
    }
  });
  if (rY <= 0) return;
  at(0, -eh * wY, 0, 1, rY, () => {
    // roll-up door, rolled under the gable
    const dx0 = -hw + ww, dw = 2 * (hw - ww);
    ctx.fillStyle = C.kraftD; rrect(dx0, -2, dw, 30, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(50,28,10,.35)'; ctx.lineWidth = 2; for (const y of [7, 15, 22]) { ctx.beginPath(); ctx.moveTo(dx0 + 8, y); ctx.lineTo(dx0 + dw - 8, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,240,210,.25)'; ctx.fillRect(dx0 + 10, 1, dw - 20, 3);
    // gable
    const gab = () => f2_poly([[-hw, 2], [0, -rh], [hw, 2]]);
    withShadow(8, () => { ctx.fillStyle = TEX.kraft || C.kraft; gab(); ctx.fill(); });
    ctx.save(); gab(); ctx.clip(); ctx.strokeStyle = 'rgba(110,76,40,.38)'; ctx.lineWidth = 2;
    for (let y = -rh + 26; y < 0; y += 26) { ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke(); }
    const sh = ctx.createLinearGradient(0, -rh, 0, 0); sh.addColorStop(0, 'rgba(60,32,12,.18)'); sh.addColorStop(.35, 'rgba(60,32,12,0)'); ctx.fillStyle = sh; ctx.fillRect(-hw, -rh, 2 * hw, rh);
    ctx.restore();
    // roof bands (corrugated, overhanging) + ridge cap
    const slope = Math.atan2(rh, hw), len = Math.hypot(hw + ov, (rh) * (hw + ov) / hw);
    for (const sd of [-1, 1]) at(0, -rh - 14, sd * slope, 1, 1, () => {
      const band = () => { ctx.beginPath(); ctx.rect(sd < 0 ? -len : 0, -16, len, 32); };
      ctx.save(); if (sd < 0) ctx.scale(1, 1);
      withShadow(6, () => { ctx.fillStyle = C.kraftD; band(); ctx.fill(); });
      ctx.save(); band(); ctx.clip(); ctx.fillStyle = 'rgba(60,32,12,.28)'; for (let x = -len; x < len; x += 15) ctx.fillRect(x, -16, 6, 32);
      ctx.fillStyle = 'rgba(255,236,200,.18)'; ctx.fillRect(-len, -16, 2 * len, 4); ctx.restore();
      f2_fibres(band, .45); ctx.restore();
    });
    ctx.fillStyle = '#7E5A34'; rrect(-26, -rh - 36, 52, 26, 8); ctx.fill();
    const lk = clamp(o.logo || 0);
    if (lk > 0) {
      const s = .5 + .5 * eOutBack(clamp(lk * 1.4));
      ctx.save(); ctx.globalAlpha *= clamp(lk * 5);
      at(0, -100, -.05, s, s / rY, () => {
        withShadow(4, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.fill(); });
        ctx.strokeStyle = 'rgba(123,34,214,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.stroke();
        drawLogo(0, 0, 100);
      });
      ctx.restore();
    }
  });
}

// ---------------------------------------------------------------- Bonzini counter (s6)
/** Bonzini counter, front view. Origin = top centre of the front (counter top surface above y 0, body y 0…220).
 *  w 560 → at (540, 1010): body x 260–820, y 1010–1230. Violet band + cream disc with the logo; no text. */
function hp_counter(w = 560, o = {}) {
  const hw = w / 2, H2 = 220;
  const body = () => { ctx.beginPath(); ctx.rect(-hw, 0, w, H2); };
  withShadow(o.lift ?? 12, () => { ctx.fillStyle = '#F4EBDD'; body(); ctx.fill(); });
  f2_fibres(body, .6);
  ctx.strokeStyle = 'rgba(156,116,71,.28)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { const x = -hw + w * i / 4; ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, H2 - 26); ctx.stroke(); }
  ctx.fillStyle = TEX.kraft || C.kraft; ctx.fillRect(-hw, H2 - 24, w, 24); ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.fillRect(-hw, H2 - 24, w, 3);    // kick plate
  const by = 102; ctx.fillStyle = C.violet; ctx.fillRect(-hw, by, w, 40); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-hw, by, w, 3);
  ctx.fillStyle = 'rgba(60,20,90,.25)'; ctx.fillRect(-hw, by + 37, w, 3);
  // counter top: slab seen slightly from above + kraftD front rail (24)
  const top = () => { ctx.beginPath(); ctx.moveTo(-hw - 22, -26); ctx.lineTo(hw + 22, -26); ctx.lineTo(hw + 18, 0); ctx.lineTo(-hw - 18, 0); ctx.closePath(); };
  withShadow(6, () => { ctx.fillStyle = C.kraftL; top(); ctx.fill(); }); f2_fibres(top, .6);
  withShadow(4, () => { ctx.fillStyle = C.kraftD; rrect(-hw - 18, -2, w + 36, 26, 4); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,236,200,.28)'; ctx.fillRect(-hw - 16, -1, w + 32, 3);
  at(0, by + 20, 0, 1, 1, () => {
    withShadow(4, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); });
    ctx.strokeStyle = 'rgba(123,34,214,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 39, 0, 7); ctx.stroke();
    drawLogo(0, 0, 64);
  });
  f2_edge(body, .35);
}

// ---------------------------------------------------------------- kraft flakes
/** kraft paper flakes bursting from (x, y) at t0: 8–18 px quads, gravity, spin, on twos, fade over 0.5 s. o {seed, spread, up} */
function hp_flakes(t, t0, x, y, n = 6, o = {}) {
  const s = f2_tw(t - t0); if (t < t0 || s > .5) return;
  const cols = [C.kraft, C.kraftD, C.kraftL], sd = o.seed ?? 3;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rnd(sd + i * 3.1) - .5) * (o.spread ?? 2.6), v = (260 + rnd(sd + i * 5.3) * 360) * (o.up ?? 1), sz = 8 + rnd(sd + i * 7.7) * 10;
    const px = x + Math.cos(a) * v * s, py = y + Math.sin(a) * v * s + 1500 * s * s, r = rnd(sd + i) * 6 + s * (rnd(sd + i * 2.2) - .5) * 18;
    ctx.globalAlpha = clamp(1 - Math.pow(s / .5, 2)) * (o.alpha ?? 1);
    at(px, py, r, 1, 1, () => { ctx.fillStyle = cols[i % 3]; f2_poly([[-sz / 2, -sz * .3], [sz * .45, -sz * .45], [sz * .5, sz * .35], [-sz * .4, sz * .4]]); ctx.fill(); });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- follow-drop (T3 s1→s2, T7 s5→s6)
/** window of the follow-drop into chapter chIn: [tb − .35, tb + .35] */
function hp_followWin(chIn) { const tb = TL.ch(chIn).start; return [tb - .35, tb + .35]; }
/** layer offset: role 'out' → 0 … −1920 ; role 'in' → 1920 … 0 (eInOutCubic). Logs whoosh_soft + cardboard_thud for 'in'. */
function hp_followY(t, chIn, role) {
  const [a, b] = hp_followWin(chIn), k = eInOutCubic(prog(t, a, b));
  if (role === 'in') { hp_sfx('whoosh_soft', a); hp_sfx('cardboard_thud', b); }
  return role === 'out' ? -1920 * k : 1920 * (1 - k);
}
/** hero during the follow-drop: {k, on, tilt (+0.08·sin πk), sx, sy (1.04 peak), y (lerp(yOut, yIn, k) when given), t0, t1}.
 *  The 6 trailing flakes: hp_flakes(t, r.t0 + .05, heroX, heroY, 6) drawn in the OUTGOING layer (they stay behind). */
function hp_followHero(t, chIn, yOut = null, yIn = null) {
  const [a, b] = hp_followWin(chIn), k = eInOutCubic(prog(t, a, b)), sn = Math.sin(Math.PI * k);
  return { k, on: t > a && t < b, tilt: .08 * sn, sx: 1 - .02 * sn, sy: 1 + .04 * sn, y: yOut != null && yIn != null ? lerp(yOut, yIn, k) : null, t0: a, t1: b };
}
