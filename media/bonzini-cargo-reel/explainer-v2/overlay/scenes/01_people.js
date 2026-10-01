'use strict';
// Paper cut-out traders (bust, front view). Flat shapes, stop-motion friendly. Drawn around (0,0) = chest centre.
// person({ skin, outfit, wax, hair: 'short'|'wrap'|'cap', face: 'smile'|'grin'|'shock'|'worry'|'think'|'wink', arms: 'idle'|'up'|'point'|'hold'|'chin'|'thumb', blink, look })
const SKIN = ['#6B3F26', '#8A5433', '#5A3320', '#A0663F'];
/** wax-print fill (concentric circles + dots), clipped by the caller */
function waxFill(x, y, w, h, seed = 1, cols = [C.orange, C.violetD, C.amber, '#1F5B45']) {
  ctx.fillStyle = cols[0]; ctx.fillRect(x, y, w, h);
  const s = 58;
  for (let j = -1; j < h / s + 1; j++) for (let i = -1; i < w / s + 1; i++) {
    const cx = x + i * s + (j % 2 ? s / 2 : 0), cy = y + j * s;
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(cx, cy, s * .38, 0, 7); ctx.fill();
    ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(cx, cy, s * .25, 0, 7); ctx.fill();
    ctx.fillStyle = cols[3]; ctx.beginPath(); ctx.arc(cx, cy, s * .11, 0, 7); ctx.fill();
    ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(cx + s / 2, cy + s / 4, 5, 0, 7); ctx.fill();
  }
}
function person(o = {}) {
  const skin = o.skin || SKIN[0], out = o.outfit || C.violet, face = o.face || 'smile', arms = o.arms || 'idle';
  ctx.save();
  // --- torso
  const torso = () => { ctx.beginPath(); ctx.moveTo(-190, 260); ctx.quadraticCurveTo(-200, 40, -110, 10); ctx.lineTo(110, 10); ctx.quadraticCurveTo(200, 40, 190, 260); ctx.closePath(); };
  withShadow(10, () => { ctx.fillStyle = out; torso(); ctx.fill(); });
  if (o.wax) { ctx.save(); torso(); ctx.clip(); waxFill(-200, 0, 400, 270, 1, o.waxCols); ctx.restore(); }
  // neck + collar
  ctx.fillStyle = skin; rrect(-34, -40, 68, 70, 20); ctx.fill();
  ctx.fillStyle = o.wax ? C.cream : 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(-60, 12); ctx.lineTo(0, 64); ctx.lineTo(60, 12); ctx.lineTo(36, 8); ctx.lineTo(0, 40); ctx.lineTo(-36, 8); ctx.closePath(); ctx.fill();
  // --- arms (behind/in front depending on pose)
  const sleeve = o.wax ? (o.waxCols || [C.orange])[0] : out;
  // arms: 2-bone IK from the shoulder to a hand target (local coords); poses are just targets
  const HAND = { idle: [158, 262], up: [92, -118], point: [330, -70], hold: [70, 150], chin: [14, -34], thumb: [235, 10], count: [58, 175], raise: [215, -270], hip: [175, 200] };
  const arm = (side, pose) => {
    const sh = [side * 138, 48], L1 = 150, L2 = 138;
    const tg = Array.isArray(pose) ? [side * pose[0], pose[1]] : [side * (HAND[pose] || HAND.idle)[0], (HAND[pose] || HAND.idle)[1]];
    let dx = tg[0] - sh[0], dy = tg[1] - sh[1], d = Math.hypot(dx, dy); const dmax = L1 + L2 - 2;
    if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
    const base = Math.atan2(dy, dx), cA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), A = Math.acos(cA);
    const cand = [base + A, base - A].map(b => [sh[0] + Math.cos(b) * L1, sh[1] + Math.sin(b) * L1]);
    const down = ['chin', 'hold', 'count'].includes(pose);                       // elbow low for hands in front of the body
    const el = down ? (cand[0][1] > cand[1][1] ? cand[0] : cand[1]) : (side * cand[0][0] > side * cand[1][0] ? cand[0] : cand[1]), hd = [sh[0] + dx, sh[1] + dy];
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = sleeve; ctx.lineWidth = 64; ctx.beginPath(); ctx.moveTo(...sh); ctx.lineTo(...el); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(el[0] + (hd[0] - el[0]) * .08, el[1] + (hd[1] - el[1]) * .08); ctx.lineTo(...hd); ctx.stroke();
    ctx.strokeStyle = sleeve; ctx.lineWidth = 66; ctx.beginPath(); ctx.moveTo(el[0] + (hd[0] - el[0]) * .02, el[1] + (hd[1] - el[1]) * .02); ctx.lineTo(el[0] + (hd[0] - el[0]) * .14, el[1] + (hd[1] - el[1]) * .14); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hd[0], hd[1], 33, 0, 7); ctx.fill();
    const fa = Math.atan2(hd[1] - el[1], hd[0] - el[0]);
    if (pose === 'point') { ctx.strokeStyle = skin; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(...hd); ctx.lineTo(hd[0] + Math.cos(fa) * 62, hd[1] + Math.sin(fa) * 62); ctx.stroke(); }
    if (pose === 'thumb' || pose === 'raise') { ctx.strokeStyle = skin; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(hd[0], hd[1] - 10); ctx.lineTo(hd[0] + side * 4, hd[1] - 62); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hd[0], hd[1], 33, 0, 7); ctx.stroke();
    if (o.handProp && o.handSide === side) at(hd[0], hd[1], 0, 1, 1, o.handProp);
    ctx.restore();
  };
  const [aL, aR] = Array.isArray(arms) ? arms : [arms, arms];
  // --- head
  ctx.save(); ctx.translate(o.look ? o.look * 8 : 0, -150); if (o.tilt) ctx.rotate(o.tilt);
  if (o.hair === 'wrap') {                                                   // head wrap (foulard) in wax
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -95, 128, 92, 0, 0, 7); ctx.clip(); waxFill(-140, -200, 280, 200, 3, o.waxCols); ctx.restore();
    ctx.fillStyle = (o.waxCols || [C.orange])[1] || C.violetD; ctx.beginPath(); ctx.ellipse(70, -170, 60, 34, -.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(-30, -180, 46, 26, .5, 0, 7); ctx.fill();
  }
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 0, 100, 118, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-100, 6, 20, 30, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(100, 6, 20, 30, 0, 0, 7); ctx.fill();
  if (o.hair === 'short' || !o.hair) { ctx.fillStyle = '#1A1016'; ctx.beginPath(); ctx.ellipse(0, -62, 104, 64, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-104, -64, 208, 20); }
  if (o.hair === 'cap') { ctx.fillStyle = o.capColor || C.orange; ctx.beginPath(); ctx.ellipse(0, -66, 108, 70, 0, Math.PI, 0); ctx.fill(); rrect(-20, -80, 170, 26, 13); ctx.fill(); }
  if (o.hair === 'wrap') { ctx.fillStyle = (o.waxCols || [C.orange])[0]; ctx.beginPath(); ctx.ellipse(0, -70, 110, 56, 0, Math.PI, 0); ctx.fill(); }
  // eyes
  const ink = '#140C10', blink = o.blink ? .12 : 1;
  const eye = (x) => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.ellipse(x, -4, 20, 22 * blink, 0, 0, 7); ctx.fill(); if (blink > .5) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + (o.look || 0) * 6, (face === 'shock' ? -2 : 0), face === 'shock' ? 7 : 10, 0, 7); ctx.fill(); } };
  if (face === 'wink') { eye(-40); ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, -2); ctx.quadraticCurveTo(40, 8, 56, -2); ctx.stroke(); }
  else { eye(-40); eye(40); }
  // brows
  ctx.strokeStyle = ink; ctx.lineWidth = 8; ctx.lineCap = 'round';
  const brow = { smile: [-6, 0], grin: [-8, 0], shock: [-22, 0], worry: [-12, .35], think: [-10, -.3], wink: [-8, 0] }[face] || [-8, 0];
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 18, -34 + brow[0] + s * brow[1] * 10 * (s > 0 ? 1 : -1)); ctx.lineTo(s * 62, -36 + brow[0] - brow[1] * 12); ctx.stroke(); }
  // nose
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 30, 16, 10, 0, 0, 7); ctx.fill();
  // mouth
  ctx.fillStyle = '#3A0F16';
  if (face === 'smile' || face === 'wink') { ctx.strokeStyle = '#3A0F16'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 50, 30, .2, Math.PI - .2); ctx.stroke(); }
  if (face === 'grin') { ctx.beginPath(); ctx.arc(0, 52, 38, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-30, 52, 60, 10); }
  if (face === 'shock') { ctx.beginPath(); ctx.ellipse(0, 72, 20, 26, 0, 0, 7); ctx.fill(); }
  if (face === 'worry') { ctx.strokeStyle = '#3A0F16'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-26, 78); ctx.quadraticCurveTo(-10, 62, 4, 74); ctx.quadraticCurveTo(16, 84, 28, 70); ctx.stroke(); }
  if (face === 'think') { ctx.strokeStyle = '#3A0F16'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, 72); ctx.lineTo(24, 66); ctx.stroke(); }
  if (o.sweat) { ctx.fillStyle = '#9FD3FF'; ctx.beginPath(); ctx.moveTo(96, -60); ctx.quadraticCurveTo(112, -30, 96, -24); ctx.quadraticCurveTo(80, -30, 96, -60); ctx.fill(); }
  ctx.restore();
  arm(-1, aL); arm(1, aR);
  ctx.restore();
}
