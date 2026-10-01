'use strict';
// ============================================================================================================
// PROPS — the recurring hand-drawn objects of Part 2, drawn the same way in every shot (continuity), plus the two
// procedural top-down backgrounds (the maquis table, the stall counter). All functions draw in the CURRENT ctx space
// (stage units inside stage(), pixels inside screen()); sizes are given by a width w (or a scale s).
//   writeOn(txt, x, y, t, t0, dur, o)       handwriting reveal (left → right) — for notes written line by line
//   kraftSheet(x, y, w, h, o, fn)           kraft paper with torn bottom edge (the « vraie note », the frise)
//   propEnvelope(x, y, w, o)                closed kraft envelope, hand-lettered (o.label 'TONTINE', o.sub)
//   propCahier(x, y, w, o, fnL, fnR)        open school exercise book (Seyès ruling), o.turn 0..1 turns the right page
//   propTicket(x, y, w, o)                  Part 1 receipt « NOTE PRÉVUE · estimation » (+ o.slip orange bordereau, o.stamp)
//   propPhone(x, y, w, o, fn)               generic smartphone, no logo; fn(sw, sh) draws the screen (clipped)
//   propCarton(x, y, w, o)                  Boris' cardboard box (o.open 0..1, o.inside(w, h)) + propTag(x, y, s, txt)
//   propPassport(x, y, w, o)                the green « passport » of the goods (Part 1), violet ribbon
//   propFrame(x, y, w, h, o, fn)            wooden wall frame; fn draws the framed paper (or empty mat)
//   propHand(x, y, s, o)                    cartoon hand + sleeve (top-down inserts): o.rot, o.pose 'flat'|'pen', o.sleeve
//   propLizard(x, y, s, t, o)               the margouillat (agama), animated: push-ups, head bob, o.puff 0..1, o.sleep
//   dayCard(t, t0, label, o) · tabOnglet(t, t0, label, o)   BD captions (screen px): day cartouche + kraft chapter tab
// ============================================================================================================
const PR = { kraft: '#CFA170', kraftD: '#A8784A', kraftL: '#E2BD8F', table: '#C7302A', tableD: '#8E1C19', wood: '#B77A45', woodD: '#7D4B26',
  green: '#2F7D4F', greenD: '#1F5A37', skin: '#7B4526', skinD: '#5A3018', seyes: '#8FA8D8', margin: '#E0605A', phone: '#1F1D24', slip: '#F7A23B' };

/** handwriting reveal: the text appears left → right between t0 and t0 + dur (clip wipe with a soft edge) */
function writeOn(txt, x, y, t, t0, dur, o = {}) {
  if (t < t0) return 0;
  const _c = (window.__cues = window.__cues || {}); if (t < t0 + dur) _c['w' + t0.toFixed(2)] = { t: t0, k: 'write', dur };
  const size = o.size || 44, f = font(o.fam || FF.letN, size, o.weight || 400), w = measure(txt, f), k = clamp((t - t0) / Math.max(.01, dur));
  const al = o.align || 'left', x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 8, y - size * 1.25, (w + 16) * k, size * 1.7); ctx.clip();
  text(txt, x, y, { font: f, color: o.color || BD.ink, align: al }); ctx.restore();
  if (o.underline && k >= 1) { const u = clamp((t - t0 - dur) / .35); inkLine(x0, y + size * .22, x0 + w * u, y + size * .22, { w: o.uw || 4, color: o.ucolor || BD.orange, seed: 3 }); }
  return k;
}

/** kraft paper sheet with a torn bottom edge, fibres and ink border; fn(w, h) draws the content (0,0 = top-left) */
function kraftSheet(x, y, w, h, o = {}, fn) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  const edge = tornLine(w / 2, h / 2, -w / 2, h / 2, o.seed || 7, 6, 14);
  const shape = () => { ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); edge.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.closePath(); };
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = o.fill || PR.kraft; shape(); ctx.fill(); });
  ctx.save(); shape(); ctx.clip(); ctx.globalAlpha = .18;
  for (let i = 0; i < w * h / 2600; i++) { const px = -w / 2 + hash(i * 1.7 + 3) * w, py = -h / 2 + hash(i * 2.3 + 5) * h, L = 8 + hash(i) * 22;
    ctx.strokeStyle = hash(i * 3.1) > .5 ? '#8A5A2E' : '#F3D6AE'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + L, py + (hash(i * 4.3) - .5) * 4); ctx.stroke(); }
  ctx.restore();
  inkPath([[-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2]], { w: 3.5, seed: o.seed || 7 });
  inkPath(edge, { w: 2.5, seed: (o.seed || 7) + 1 });
  if (o.pin) { inkCircle(0, -h / 2 + 22, 11, { w: 3, fill: o.pin === true ? BD.red : o.pin, seed: 2 }); }
  ctx.translate(-w / 2, -h / 2); if (fn) fn(w, h); ctx.restore();
}

/** closed kraft envelope (never open, never money): hand-lettered label */
function propEnvelope(x, y, w, o = {}) {
  const h = w * .6;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.sx || 1, o.sy || 1);
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = o.fill || PR.kraft; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(120,70,30,.16)'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, h * .06); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,215,.12)'; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w * .08, -h * .02); ctx.lineTo(w * .08, -h * .02); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  inkPath([[-w / 2, -h / 2], [0, h * .06], [w / 2, -h / 2]], { w: 3, seed: 5 });
  inkRect(-w / 2, -h / 2, w, h, { w: 4, seed: 4 });
  inkCircle(0, h * .02, w * .045, { w: 2.5, fill: o.seal || BD.red, seed: 6 });                 // a small red sticker keeps it closed
  const lab = o.label ?? 'TONTINE';
  if (lab) text(lab, 0, h * .33, { font: font(FF.brush, o.size || w * .16, 400), align: 'center', color: '#24160E' });
  if (o.sub) text(o.sub, 0, h * .33 + w * .1, { font: font(FF.letN, w * .075, 400), align: 'center', color: '#24160E' });
  ctx.restore();
}

/** open school exercise book seen from above (Seyès ruling); o.turn 0..1 flips the right page to the left; o.cover colour */
function propCahier(x, y, w, o = {}, fnL, fnR) {
  const pw = w / 2, h = w * .7;
  const page = (sx, fn, back) => { ctx.save(); ctx.translate(sx, 0);
    ctx.fillStyle = '#FFFDF6'; ctx.fillRect(0, -h / 2, pw, h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, -h / 2, pw, h); ctx.clip();
    for (let yy = -h / 2 + h * .12, i = 0; yy < h / 2; yy += h / 36, i++) { ctx.strokeStyle = i % 4 ? 'rgba(143,168,216,.35)' : 'rgba(110,140,205,.7)'; ctx.lineWidth = i % 4 ? 1 : 1.8; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(pw, yy); ctx.stroke(); }
    ctx.strokeStyle = PR.margin; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pw * .16, -h / 2); ctx.lineTo(pw * .16, h / 2); ctx.stroke();
    ctx.restore(); ctx.translate(0, -h / 2); if (fn && !back) fn(pw, h); ctx.restore(); };
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = o.cover || '#2F6FB2'; rrect(-pw - 10, -h / 2 - 10, w + 20, h + 20, 10); ctx.fill(); });
  inkPath([[-pw - 10, -h / 2 - 10], [pw + 10, -h / 2 - 10], [pw + 10, h / 2 + 10], [-pw - 10, h / 2 + 10]], { w: 3.5, close: true, seed: 9 });
  page(-pw, fnL);
  const k = clamp(o.turn || 0);
  if (k < .5) { page(0, fnR); if (k > 0) { ctx.save(); ctx.scale(Math.cos(k * Math.PI), 1); page(0, null, true); ctx.fillStyle = `rgba(0,0,0,${.18 * k})`; ctx.fillRect(0, -h / 2, pw, h); ctx.restore(); } }
  else { page(0, o.fnNext || null); ctx.save(); ctx.scale(Math.cos(k * Math.PI), 1); page(0, null, true); ctx.fillStyle = `rgba(0,0,0,${.12 * (1 - k)})`; ctx.fillRect(0, -h / 2, pw, h); ctx.restore(); }
  inkLine(0, -h / 2, 0, h / 2, { w: 3, seed: 10 });
  inkRect(-pw, -h / 2, w, h, { w: 3, seed: 11 });
  ctx.restore();
}

/** Part 1 receipt « NOTE PRÉVUE · estimation » — white thermal paper; o.slip: stapled orange bordereau; o.stamp: stamp label */
function propTicket(x, y, w, o = {}) {
  const h = w * 1.45;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  const edge = tornLine(w / 2, h / 2, -w / 2, h / 2, 21, 5, 10);
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = '#FBFAF4'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); edge.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill(); });
  inkPath([[-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2]], { w: 3, seed: 22 }); inkPath(edge, { w: 2, seed: 23 });
  text('NOTE PRÉVUE', 0, -h / 2 + w * .2, { font: font(FF.bd, w * .14, 400), align: 'center', color: BD.ink, ls: 1 });
  text('estimation', 0, -h / 2 + w * .31, { font: font(FF.letN, w * .09, 400), align: 'center', color: '#5A4636' });
  for (let i = 0; i < 5; i++) { const yy = -h / 2 + w * (.45 + i * .13); inkLine(-w * .36, yy, w * (.05 + hash(i + 3) * .12), yy, { w: 2.5, color: '#9A8C80', seed: 30 + i });
    inkLine(w * .22, yy, w * .36, yy, { w: 2.5, color: '#9A8C80', seed: 40 + i }); }
  inkLine(-w * .36, -h / 2 + w * 1.12, w * .36, -h / 2 + w * 1.12, { w: 3, seed: 50 });
  if (o.slip) { ctx.save(); ctx.translate(w * .08, -h / 2 + w * .02); ctx.rotate(.06);
    const sw = w * 1.02, sh = w * .5; withShadow(6, () => { ctx.fillStyle = PR.slip; ctx.fillRect(-sw / 2, 0, sw, sh); });
    inkRect(-sw / 2, 0, sw, sh, { w: 3, seed: 51 });
    text('+ AUTRES LIGNES', 0, sh * .3, { font: font(FF.bd, sw * .1, 400), align: 'center', color: BD.ink });
    text('selon le produit', 0, sh * .52, { font: font(FF.letN, sw * .07, 400), align: 'center', color: BD.ink });
    text('et votre situation', 0, sh * .68, { font: font(FF.letN, sw * .07, 400), align: 'center', color: BD.ink });
    text('→ PARTIE 2', 0, sh * .88, { font: font(FF.bd, sw * .08, 400), align: 'center', color: BD.violet });
    ctx.fillStyle = '#8A8F99'; ctx.fillRect(-sw * .3, -4, sw * .12, 7); ctx.fillRect(sw * .18, -4, sw * .12, 7);   // staples
    ctx.restore(); }
  if (o.stamp) bdStamp(0, h * .12, w * .34, o.stamp, { color: o.stampColor || BD.green, rot: -.2, a: o.stampA ?? .9, size: w * .075 });
  ctx.restore();
}

/** generic smartphone (no brand): fn(sw, sh) draws the screen, already clipped; o.glow: coloured glow; o.rot */
function propPhone(x, y, w, o = {}, fn) {
  const h = w * 2.04, r = w * .14, bz = w * .055;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  if (o.glow) { ctx.save(); ctx.shadowColor = o.glow; ctx.shadowBlur = w * .5; ctx.fillStyle = o.glow; rrect(-w / 2, -h / 2, w, h, r); ctx.globalAlpha = .5; ctx.fill(); ctx.restore(); }
  withShadow(o.lift ?? 12, () => { ctx.fillStyle = PR.phone; rrect(-w / 2, -h / 2, w, h, r); ctx.fill(); });
  const sw = w - 2 * bz, sh = h - 2 * bz;
  ctx.save(); rrect(-sw / 2, -sh / 2, sw, sh, r * .7); ctx.clip();
  ctx.fillStyle = o.screen || '#FFF8EA'; ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
  ctx.translate(-sw / 2, -sh / 2); if (fn) fn(sw, sh);
  ctx.restore();
  ctx.fillStyle = PR.phone; rrect(-w * .12, -sh / 2 + 4, w * .24, w * .06, w * .03); ctx.fill();     // notch
  const gl = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; rrect(-sw / 2, -sh / 2, sw, sh, r * .7); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = BD.ink; rrect(-w / 2, -h / 2, w, h, r); ctx.stroke();
  ctx.restore();
  return { w, h, sw, sh };
}

/** hanging paper tag with a string (e.g. « PAS AVANT SAMEDI » on Boris' box) */
function propTag(x, y, s, txt, o = {}) {
  const f = font(FF.brush, 34 * s, 400), tw = measure(txt, f) + 40 * s, th = 58 * s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.08 + Math.sin((o.t || 0) * 1.7) * .03);
  inkLine(0, -th * .9, 0, -th * .45, { w: 2, color: '#6B4A2A', seed: 60 });
  withShadow(4, () => { ctx.fillStyle = o.fill || '#FFF3D2'; ctx.beginPath(); ctx.moveTo(-tw / 2 + 14 * s, -th / 2); ctx.lineTo(tw / 2, -th / 2); ctx.lineTo(tw / 2, th / 2); ctx.lineTo(-tw / 2 + 14 * s, th / 2); ctx.lineTo(-tw / 2, 0); ctx.closePath(); ctx.fill(); });
  inkPath([[-tw / 2 + 14 * s, -th / 2], [tw / 2, -th / 2], [tw / 2, th / 2], [-tw / 2 + 14 * s, th / 2], [-tw / 2, 0]], { w: 2.5, close: true, seed: 61 });
  inkCircle(-tw / 2 + 16 * s, 0, 5 * s, { w: 2, fill: '#E9D9B8', seed: 62 });
  text(txt, 8 * s, 11 * s, { font: f, align: 'center', color: o.color || BD.red });
  ctx.restore();
}

/** Boris' cardboard box, 3/4 view. o.open 0..1 opens the flaps; o.inside(w, h) draws what is inside (seen from the top) */
function propCarton(x, y, w, o = {}) {
  const h = w * .72, d = w * .32, k = clamp(o.open || 0);
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = '#C8904F'; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.fillStyle = '#DDA965'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2 + d * .6, -h / 2 - d * .6); ctx.lineTo(w / 2 + d * .6, -h / 2 - d * .6); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#A9743C'; ctx.beginPath(); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2 + d * .6, -h / 2 - d * .6); ctx.lineTo(w / 2 + d * .6, h / 2 - d * .6); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
  hatch(w / 2, -h / 2 - d * .6, d * .6, h, { gap: 12, w: 1.6 });
  if (k > 0) {                                                       // open: dark inside + flaps rotating out
    ctx.fillStyle = '#5B3A1C'; ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2 - 2); ctx.lineTo(-w / 2 + d * .6 + 4, -h / 2 - d * .6 + 3); ctx.lineTo(w / 2 + d * .6 - 6, -h / 2 - d * .6 + 3); ctx.lineTo(w / 2 - 4, -h / 2 - 2); ctx.closePath(); ctx.fill();
    if (o.inside) { ctx.save(); ctx.translate(-w / 2 + d * .3, -h / 2 - d * .3); o.inside(w, h, k); ctx.restore(); }
    const fl = d * .9 * k; ctx.fillStyle = '#E4B574';
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2 - 10, -h / 2 + fl * .3 - fl); ctx.lineTo(-w / 2 + 10, -h / 2 + fl * .3 - fl); ctx.closePath(); ctx.globalAlpha = .98; ctx.fill(); ctx.globalAlpha = 1;
    inkPath([[-w / 2, -h / 2], [-w / 2 + 10, -h / 2 + fl * .3 - fl], [w / 2 - 10, -h / 2 + fl * .3 - fl], [w / 2, -h / 2]], { w: 3, seed: 71 });
  } else {
    ctx.fillStyle = 'rgba(235,225,190,.75)'; ctx.beginPath(); ctx.moveTo(-w * .08 + d * .3, -h / 2 - d * .6); ctx.lineTo(w * .08 + d * .3, -h / 2 - d * .6); ctx.lineTo(w * .08, -h / 2); ctx.lineTo(-w * .08, -h / 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-w * .08, -h / 2, w * .16, h * .35);
  }
  inkRect(-w / 2, -h / 2, w, h, { w: 3.5, seed: 72 });
  inkPath([[-w / 2, -h / 2], [-w / 2 + d * .6, -h / 2 - d * .6], [w / 2 + d * .6, -h / 2 - d * .6], [w / 2 + d * .6, h / 2 - d * .6], [w / 2, h / 2]], { w: 3.5, seed: 73 });
  inkLine(w / 2, -h / 2, w / 2 + d * .6, -h / 2 - d * .6, { w: 3, seed: 74 });
  if (o.tag !== false) propTag(-w * .08, -h * .02, w / 320, o.tag || 'PAS AVANT SAMEDI', { t: o.t, rot: -.05 });
  ctx.restore();
}

/** the green « passport » of the goods (Part 1): closed booklet, violet ribbon; o.stamp shows a stamp on its cover */
function propPassport(x, y, w, o = {}) {
  const h = w * 1.34;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = PR.green; rrect(-w / 2, -h / 2, w, h, w * .06); ctx.fill(); });
  ctx.fillStyle = PR.greenD; ctx.fillRect(-w / 2, -h / 2, w * .08, h);
  ctx.strokeStyle = 'rgba(245,215,140,.8)'; ctx.lineWidth = 3; rrect(-w * .36, -h * .38, w * .76, h * .76, w * .04); ctx.stroke();
  text('PASSEPORT', w * .02, -h * .18, { font: font(FF.bd, w * .15, 400), align: 'center', color: '#F5D78C', ls: 2 });
  text('de la marchandise', w * .02, -h * .06, { font: font(FF.letN, w * .09, 400), align: 'center', color: '#F5D78C' });
  ctx.fillStyle = BD.violet; ctx.beginPath(); ctx.moveTo(w * .22, h / 2 - 4); ctx.lineTo(w * .32, h / 2 - 4); ctx.lineTo(w * .32, h / 2 + w * .28); ctx.lineTo(w * .27, h / 2 + w * .22); ctx.lineTo(w * .22, h / 2 + w * .28); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = BD.ink; rrect(-w / 2, -h / 2, w, h, w * .06); ctx.stroke();
  if (o.stamp) { const k = o.stampK ?? 1; if (k > 0) { ctx.save(); const s = 1 + (1 - k) * .6; ctx.translate(w * .02, h * .2); ctx.scale(s, s); ctx.globalAlpha *= k;
    ctx.fillStyle = 'rgba(255,248,230,.95)'; ctx.rotate(-.08); ctx.fillRect(-w * .44, -w * .14, w * .88, w * .28); inkRect(-w * .44, -w * .14, w * .88, w * .28, { w: 3, color: '#2E6B4A', seed: 81 });
    text(o.stamp, 0, w * .05, { font: font(FF.bd, w * .1, 400), align: 'center', color: '#2E6B4A' }); ctx.restore(); } }
  ctx.restore();
}

/** wooden wall frame; fn(iw, ih) draws the framed document; no fn → empty cream mat */
function propFrame(x, y, w, h, o = {}, fn) {
  const b = w * .07;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  withShadow(o.lift ?? 6, () => { ctx.fillStyle = o.wood || '#6E4424'; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.fillStyle = o.mat || '#F6EEDC'; ctx.fillRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b);
  if (fn) { ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b); ctx.clip(); ctx.translate(-w / 2 + b, -h / 2 + b); fn(w - 2 * b, h - 2 * b); ctx.restore(); }
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(.2, 'rgba(255,255,255,0)'); g.addColorStop(.32, 'rgba(255,255,255,.22)'); g.addColorStop(.42, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b);
  inkRect(-w / 2, -h / 2, w, h, { w: 4, seed: 91 }); inkRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, { w: 2.5, seed: 92 });
  ctx.restore();
}

/** cartoon hand with its sleeve, seen from above: wrist at (x, y); fingers point to angle o.rot (0 = up); the sleeve runs
 *  o.arm units back. o.pose 'flat' (resting on something) | 'pen' (holds a marker, o.pen colour) ; o.sleeve colour (+ o.dots) */
function propHand(x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  const skin = o.skin || PR.skin, arm = o.arm ?? 900;
  withShadow(o.lift ?? 14, () => { ctx.fillStyle = o.sleeve || '#E07A2E'; ctx.beginPath(); ctx.moveTo(-44, 18); ctx.lineTo(44, 18); ctx.lineTo(56, arm); ctx.lineTo(-56, arm); ctx.closePath(); ctx.fill(); });
  if (o.dots !== false) { ctx.save(); ctx.beginPath(); ctx.moveTo(-44, 18); ctx.lineTo(44, 18); ctx.lineTo(56, arm); ctx.lineTo(-56, arm); ctx.closePath(); ctx.clip();
    ctx.fillStyle = o.dots || 'rgba(40,70,160,.8)'; for (let yy = 30; yy < arm; yy += 34) for (let xx = -60; xx < 60; xx += 34) { ctx.beginPath(); ctx.arc(xx + ((yy / 34) % 2) * 17, yy, 7, 0, 7); ctx.fill(); } ctx.restore(); }
  inkPath([[-44, 18], [-56, arm]], { w: 4, seed: 101 }); inkPath([[44, 18], [56, arm]], { w: 4, seed: 102 }); inkLine(-46, 22, 46, 22, { w: 4, seed: 103 });
  const fill = () => { ctx.fillStyle = skin; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; ctx.stroke(); };
  const pen = o.pose === 'pen';
  // fingers (capsules from the knuckles), then the back of the hand over their bases, then the thumb
  const F = pen ? [[-20, 44, 15, -.5], [-3, 50, 16, -.3], [14, 46, 15, -.12], [29, 38, 13, .1]] : [[-27, 66, 15, -.14], [-9, 76, 16, -.04], [10, 74, 16, .05], [27, 60, 14, .16]];
  for (const [fx, L, fr, fa] of F) { ctx.save(); ctx.translate(fx, -58); ctx.rotate(fa); const r = fr / 1.7;
    ctx.beginPath(); ctx.moveTo(-r, 10); ctx.lineTo(-r, -L + r); ctx.arc(0, -L + r, r, Math.PI, 0); ctx.lineTo(r, 10); ctx.closePath(); fill();
    ctx.strokeStyle = 'rgba(40,20,10,.5)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-r * .6, -L * .55); ctx.quadraticCurveTo(0, -L * .5, r * .6, -L * .55); ctx.stroke();
    if (!pen) { ctx.fillStyle = 'rgba(255,230,210,.55)'; ctx.beginPath(); ctx.ellipse(0, -L + r * 1.3, r * .55, r * .7, 0, 0, 7); ctx.fill(); }
    ctx.restore(); }
  ctx.beginPath(); ctx.moveTo(-40, 14); ctx.bezierCurveTo(-46, -30, -40, -62, -30, -66); ctx.lineTo(34, -64); ctx.bezierCurveTo(44, -50, 46, -20, 40, 14); ctx.closePath(); fill();
  ctx.strokeStyle = 'rgba(40,20,10,.35)'; ctx.lineWidth = 2.5; for (const [fx] of F) { ctx.beginPath(); ctx.moveTo(fx * .7, -48); ctx.lineTo(fx * .55, -20); ctx.stroke(); }
  ctx.save(); ctx.translate(pen ? -30 : -36, pen ? -26 : -8); ctx.rotate(pen ? -.3 : -.7); ctx.beginPath(); ctx.moveTo(-11, 8); ctx.lineTo(-12, -34); ctx.arc(0, -34, 12, Math.PI, 0); ctx.lineTo(11, 8); ctx.closePath(); fill(); ctx.restore();
  if (pen) { ctx.save(); ctx.translate(-10, -86); ctx.rotate(-.35); ctx.fillStyle = o.pen || '#1E1512'; rrect(-8, -70, 16, 120, 6); ctx.fill(); ctx.fillStyle = '#F2F2F2'; ctx.fillRect(-8, -30, 16, 26);
    ctx.fillStyle = o.penTip || o.pen || '#1E1512'; ctx.beginPath(); ctx.moveTo(-6, -70); ctx.lineTo(0, -88); ctx.lineTo(6, -70); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-22, -58); ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, 7); fill(); ctx.restore(); }
  ctx.restore();
}

/** the margouillat (agama lizard): dark body, orange head. Facing right (o.flip faces left). Animated: push-ups every few
 *  seconds, head bob, tail curl, blink; o.puff 0..1 swells the throat (X2b); o.sleep closes the eyes; o.look 0..1 turns the
 *  head toward the viewer (end shot). s = body length / 100. */
function propLizard(x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale((o.flip ? -1 : 1) * s, s);
  const ph = o.phase || 0, cyc = (t + ph) % (o.period || 3.8), push = o.sleep ? 0 : (cyc < 1.1 ? Math.max(0, Math.sin(cyc / 1.1 * Math.PI * 3)) * .9 : 0) + (o.pushAt != null ? env(t, o.pushAt, o.pushAt + .9, .1, .3) : 0);
  const bob = o.sleep ? Math.sin(t * 1.2) * .6 : Math.sin(t * 2.3 + ph) * 1.2, lift = push * 9, tilt = -push * .16;
  const body = o.body || '#26252E', head = o.head || '#F0762B', ink = BD.ink;
  // tail: a tapered curve behind the body
  const tc = Math.sin(t * .9 + ph) * .25 + (o.sleep ? .5 : 0), T = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16, a = u * (1.2 + tc) ; T.push([-36 - u * 118 + Math.sin(a) * 6, 4 + u * 6 - Math.sin(a * 1.6) * 14 * u]); }
  ctx.beginPath(); T.forEach(([px, py], i) => { const wv = 7.5 * (1 - i / 16) + .8; i ? ctx.lineTo(px, py - wv) : ctx.moveTo(px, py - wv); });
  for (let i = 16; i >= 0; i--) { const wv = 7.5 * (1 - i / 16) + .8; ctx.lineTo(T[i][0], T[i][1] + wv); } ctx.closePath();
  ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
  // legs (back pair darker, then body, then front pair)
  const leg = (hx, hy, fx, fy, dark) => { ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + (fx - hx) * .3, fy - 6, fx, fy); ctx.stroke();
    ctx.strokeStyle = dark ? '#17161C' : body; ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink;
    for (const d of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 7 + d * .2, fy + d * .4 + 1); ctx.stroke(); } ctx.restore(); };
  leg(-26, 0, -42, 12, true); leg(26, -lift * .6, 34, 12, true);
  ctx.save(); ctx.translate(0, -lift * .5); ctx.rotate(tilt);
  ctx.beginPath(); ctx.ellipse(0, -6, 42, 13, 0, 0, 7); ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.ellipse(-4, -13, 28, 4, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(160,160,190,.35)'; ctx.beginPath(); ctx.arc(-28 + i * 10, -8 + (i % 2) * 3, 2, 0, 7); ctx.fill(); }
  // head (orange), with a bob and an optional turn toward the viewer
  ctx.save(); ctx.translate(40, -12 + bob); ctx.rotate(-.1 * push);
  if (o.puff) { ctx.beginPath(); ctx.ellipse(6, 9, 10 + 8 * o.puff, 5 + 9 * o.puff, 0, 0, 7); ctx.fillStyle = '#F7B84B'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke(); }
  const look = clamp(o.look || 0);
  ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(10, -16, 26, -5 + look * 2); ctx.quadraticCurveTo(30 - look * 6, 2, 22 - look * 4, 6); ctx.quadraticCurveTo(4, 10, -8, 7); ctx.closePath();
  ctx.fillStyle = head; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
  const ex = 11 - look * 4, ey = -4, blink = o.sleep ? 1 : ((t + ph * 2) % 2.9 < .12 ? 1 : 0);
  if (blink) { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex, ey, 4, .2, Math.PI - .2); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(ex, ey, 4.6, 0, 7); ctx.fillStyle = '#FFF7E0'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(ex + 1.2 - look * 2, ey + .3, 2.2, 0, 7); ctx.fillStyle = ink; ctx.fill();
    if (look > .5) { ctx.beginPath(); ctx.arc(ex - 9, ey + 1, 4, 0, 7); ctx.fillStyle = '#FFF7E0'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(ex - 9.5, ey + 1.3, 2, 0, 7); ctx.fillStyle = ink; ctx.fill(); } }
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 4); ctx.quadraticCurveTo(18, 5, 24, 3); ctx.stroke();
  if (o.sleep) { const z = (t * .6) % 1; text('z', 34 + z * 16, -20 - z * 26, { font: font(FF.bd, 16 + z * 8, 400), color: 'rgba(30,21,18,' + (1 - z) + ')' }); }
  ctx.restore();
  ctx.restore();
  leg(-22, 2, -30, 14 + lift * 0, false); leg(30, -lift, 44, 12, false);
  ctx.restore();
}

/** day cartouche (screen px, top right): yellow BD caption box, pops in at t0 */
function dayCard(t, t0, label, o = {}) {
  if (t < t0) return; const _c = (window.__cues = window.__cues || {}); _c['d' + t0.toFixed(2)] = { t: t0, k: 'card' }; const k = clamp(spring(t - t0, 15, .5), 0, 1.15), a = clamp((t - t0) / .12) * (o.a ?? 1);
  const f = font(FF.bd, o.size || 62, 400), w = measure(label, f, 3) + 60, h = (o.size || 62) * 1.35, x = o.x ?? 1030 - w, y = o.y ?? 250;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.rotate(o.rot ?? -.02);
  withShadow(8, () => { ctx.fillStyle = o.fill || BD.recit; ctx.fillRect(-w / 2, -h / 2, w, h); });
  inkRect(-w / 2, -h / 2, w, h, { w: 4.5, seed: 111 });
  text(label, 0, h * .3, { font: f, align: 'center', color: BD.ink, ls: 3 });
  ctx.restore();
}
/** kraft chapter tab (the « PARTIE 2 » folder of Part 1): slides in from the right edge under the day cartouche */
function tabOnglet(t, t0, label, o = {}) {
  if (t < t0) return; const k = eOutCubic(clamp((t - t0) / .45));
  const f = font(FF.bd, o.size || 46, 400), w = measure(label, f, 2) + 56, h = (o.size || 46) * 1.4, x = lerp(W + 20, o.x ?? 1030 - w, k), y = o.y ?? 352;
  ctx.save(); ctx.translate(x, y);
  withShadow(6, () => { ctx.fillStyle = PR.kraft; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(14, h); ctx.lineTo(0, h / 2); ctx.closePath(); ctx.fill(); });
  inkPath([[14, 0], [w, 0], [w, h], [14, h], [0, h / 2]], { w: 3.5, close: true, seed: 121 });
  text(label, w / 2 + 6, h * .68, { font: f, align: 'center', color: BD.ink, ls: 2 });
  ctx.restore();
}

// ---------- procedural top-down backgrounds (rendered once into window.IMG) ----------------------------------------
function _bgTable(cw, ch) {                                   // BG9: red plastic maquis table at night, seen from above
  const c = makeCanvas(cw, ch), g = c.getContext('2d'), save = ctx; ctx = g;
  try {
    const s = cw / 1000;
    g.fillStyle = '#6B3A28'; g.fillRect(0, 0, cw, ch);                                   // terracotta floor
    for (let yy = 0; yy < ch; yy += 150 * s) for (let xx = (yy / (150 * s)) % 2 ? -75 * s : 0; xx < cw; xx += 150 * s) { g.fillStyle = hash(xx * .01 + yy * .003) > .5 ? '#74402C' : '#653524'; g.fillRect(xx + 3, yy + 3, 150 * s - 6, 150 * s - 6); }
    g.save(); g.translate(cw / 2, ch * .52); g.rotate(-.035);
    const tw = 900 * s, th = 1500 * s;
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40 * s; g.shadowOffsetY = 24 * s; g.fillStyle = PR.table; rrectOn(g, -tw / 2, -th / 2, tw, th, 60 * s); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = PR.tableD; g.lineWidth = 16 * s; rrectOn(g, -tw / 2 + 26 * s, -th / 2 + 26 * s, tw - 52 * s, th - 52 * s, 44 * s); g.stroke();
    g.globalAlpha = .22; g.strokeStyle = '#FF8A7A'; g.lineWidth = 5 * s; for (let r = 90; r < 420; r += 70) { g.beginPath(); g.ellipse(0, 0, r * s, r * s * 1.05, 0, 0, 7); g.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 250 * s, Math.sin(a) * 250 * s, 50 * s, 22 * s, a, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
    for (const [rx, ry, rr] of [[-250, -520, 58], [230, 420, 52], [-160, 610, 55], [300, -300, 50]]) { g.strokeStyle = 'rgba(255,220,210,.35)'; g.lineWidth = 6 * s; g.beginPath(); g.arc(rx * s, ry * s, rr * s, .3, 5.8); g.stroke(); }
    for (const [bx, by] of [[-330, -610], [350, 610], [-380, 380]]) { g.fillStyle = '#C9CDD2'; g.beginPath(); g.arc(bx * s, by * s, 20 * s, 0, 7); g.fill(); g.strokeStyle = '#1E1512'; g.lineWidth = 3 * s; g.stroke();
      for (let k = 0; k < 18; k++) { const a = k / 18 * 7; g.beginPath(); g.moveTo(bx * s + Math.cos(a) * 20 * s, by * s + Math.sin(a) * 20 * s); g.lineTo(bx * s + Math.cos(a) * 24 * s, by * s + Math.sin(a) * 24 * s); g.stroke(); } }
    ctx.save(); ctx.scale(s, s); inkPath(subdiv([-450, -750], [450, -750], 30).concat(subdiv([450, -750], [450, 750], 30).slice(1), subdiv([450, 750], [-450, 750], 30).slice(1), subdiv([-450, 750], [-450, -750], 30).slice(1)), { w: 6, seed: 131, close: true }); ctx.restore();
    g.restore();
    const lg = g.createRadialGradient(cw * .5, ch * .08, 0, cw * .5, ch * .3, ch * .8); lg.addColorStop(0, 'rgba(255,190,90,.30)'); lg.addColorStop(1, 'rgba(10,15,50,.35)');
    g.fillStyle = lg; g.fillRect(0, 0, cw, ch);
  } finally { ctx = save; }
  return c;
}
function _bgCounter(cw, ch) {                                 // BG5: worn wooden stall counter, daylight, seen from above
  const c = makeCanvas(cw, ch), g = c.getContext('2d'), save = ctx; ctx = g;
  try {
    const s = cw / 1000, ph = 210 * s;
    for (let yy = 0, i = 0; yy < ch; yy += ph, i++) {
      const base = ['#B97C45', '#AE7440', '#C1854C', '#A96F3B'][i % 4]; g.fillStyle = base; g.fillRect(0, yy, cw, ph);
      g.globalAlpha = .35; for (let k = 0; k < 16; k++) { const y0 = yy + (k + .5) * ph / 16; g.strokeStyle = hash(i * 31 + k) > .5 ? '#7D4B26' : '#D59A60'; g.lineWidth = (1 + hash(k * 7 + i) * 2.5) * s;
        g.beginPath(); for (let xx = 0; xx <= cw; xx += 40 * s) { const yv = y0 + Math.sin(xx / (160 * s) + k + i) * 4 * s + Math.sin(xx / (47 * s) + k * 2) * 1.5 * s; xx ? g.lineTo(xx, yv) : g.moveTo(xx, yv); } g.stroke(); }
      g.globalAlpha = 1;
      if (hash(i * 5.1) > .35) { const kx = hash(i * 9.7) * cw, ky = yy + ph * (.3 + hash(i * 2.2) * .4); g.fillStyle = '#6E3F1E'; g.beginPath(); g.ellipse(kx, ky, 26 * s, 12 * s, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(110,63,30,.6)'; g.lineWidth = 2 * s; for (const r of [1.6, 2.3]) { g.beginPath(); g.ellipse(kx, ky, 26 * s * r, 12 * s * r, 0, 0, 7); g.stroke(); } }
      g.fillStyle = 'rgba(40,20,8,.55)'; g.fillRect(0, yy + ph - 5 * s, cw, 7 * s);
      ctx.save(); ctx.scale(s, s); inkLine(0, (yy + ph) / s - 1, 1000, (yy + ph) / s - 1, { w: 4, seed: 140 + i, step: 30 }); ctx.restore();
      for (const nx of [60, 940]) { g.fillStyle = '#4A4A50'; g.beginPath(); g.arc(nx * s, yy + ph / 2, 9 * s, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(nx * s - 3 * s, yy + ph / 2 - 3 * s, 3 * s, 0, 7); g.fill(); }
    }
    g.strokeStyle = 'rgba(255,235,200,.35)'; g.lineWidth = 2 * s; for (let k = 0; k < 40; k++) { const x0 = hash(k * 3.3) * cw, y0 = hash(k * 7.7) * ch, L = (20 + hash(k) * 80) * s, a = (hash(k * 1.9) - .5) * .6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke(); }
    const lg = g.createLinearGradient(0, 0, cw, ch); lg.addColorStop(0, 'rgba(255,230,170,.22)'); lg.addColorStop(1, 'rgba(60,30,10,.25)'); g.fillStyle = lg; g.fillRect(0, 0, cw, ch);
  } finally { ctx = save; }
  return c;
}
shots(() => {                                                  // runs before the shot builders (12 < 2x): register the procedural backgrounds
  window.IMG = window.IMG || {};
  window.IMG['bg/table_maquis_dessus'] = _bgTable(1440, 2560);
  window.IMG['bg/comptoir_dessus'] = _bgCounter(1440, 2560);
});
