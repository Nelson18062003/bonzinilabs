'use strict';
// Full-body paper figures for the V2 journey: person() (bust, origin = chest) + legs/skirt + shoes + a paper walk cycle.
// figure(o): o = person() options + { legs: 'pants'|'skirt', pants, shoes, walk: phase (number, cycles) | null, stride }
// Origin = chest (same as person()); feet at y ≈ +640. Height head-top → feet ≈ 920 px at scale 1.
function figure(o = {}) {
  const walk = o.walk, stride = o.stride ?? 1, ph = walk == null ? null : walk * Math.PI * 2;
  const legA = ph == null ? 0 : Math.sin(ph) * .32 * stride, legB = -legA;
  const lift = ph == null ? 0 : Math.max(0, Math.cos(ph)) * 10 * stride;
  ctx.save();
  if (walk != null) ctx.translate(0, -Math.abs(Math.sin(ph)) * 10 * stride);           // body bob
  // --- legs / skirt (behind the torso)
  const shoe = o.shoes || '#2B2230', pants = o.pants || '#2E3A59';
  const leg = (side, ang, up) => {
    ctx.save(); ctx.translate(side * 62, 250); ctx.rotate(ang);
    if (o.legs !== 'skirt') { ctx.fillStyle = pants; rrect(-40, -10, 80, 360, 30); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(-4, 20, 6, 320); }
    else { ctx.fillStyle = o.skin || SKIN[0]; rrect(-22, 200, 44, 150, 18); ctx.fill(); }
    ctx.translate(0, 350 - up); ctx.fillStyle = shoe; ctx.beginPath(); ctx.ellipse(side * 0 + 18, 12, 62, 28, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-30, 22, 90, 6); ctx.restore();
  };
  // contact shadow
  ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.beginPath(); ctx.ellipse(0, 640, 170, 26, 0, 0, 7); ctx.fill(); ctx.restore();
  leg(-1, legA, legA > 0 ? lift : 0); leg(1, legB, legB > 0 ? lift : 0);
  if (o.legs === 'skirt') {                                                              // long wax pagne skirt
    const sw = ph == null ? 0 : Math.sin(ph) * 14 * stride;
    const sk = () => { ctx.beginPath(); ctx.moveTo(-150, 230); ctx.lineTo(150, 230); ctx.lineTo(178 + sw, 560); ctx.quadraticCurveTo(0, 590, -178 + sw, 560); ctx.closePath(); };
    withShadow(8, () => { ctx.fillStyle = (o.waxCols || [C.orange])[0]; sk(); ctx.fill(); });
    ctx.save(); sk(); ctx.clip(); waxFill(-190, 220, 380, 380, 7, o.waxCols); ctx.restore();
  }
  // --- upper body: arms swing opposite to legs while walking
  const sw = ph == null ? 0 : Math.sin(ph) * 40 * stride;
  const arms = o.arms || (walk != null ? [[150 + sw * .2, 250 - sw], [150 - sw * .2, 250 + sw]] : 'idle');
  person(Object.assign({}, o, { arms }));
  ctx.restore();
}
/** the recurring cast as full figures */
function juniorFig(o = {}) { figure(Object.assign({ skin: SKIN[1], outfit: C.violet, hair: 'short', face: 'smile', pants: '#2E3A59', shoes: '#F3F0E8' }, o)); }
function mireilleFig(o = {}) { figure(Object.assign({ skin: SKIN[3], outfit: C.orange, hair: 'wrap', wax: true, waxCols: [C.orange, DC.green, C.amber, C.violetD], legs: 'skirt', shoes: '#8A5A3A', face: 'smile' }, o)); }
function officerFig(o = {}) { figure(Object.assign({ skin: SKIN[2], outfit: '#E7DFC9', hair: 'cap', capColor: DC.green, pants: '#3E5A48', shoes: '#231629', face: 'smile' }, o)); }
function brokerFig(o = {}) { figure(Object.assign({ skin: SKIN[0], outfit: DC.blue, hair: 'short', pants: '#231629', shoes: '#231629', face: 'smile' }, o)); }
