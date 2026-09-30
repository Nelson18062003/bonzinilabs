'use strict';
// Customs props (paper): Cameroon map, generic documents, the goods' passport, border barrier, drive-through scanner arch.
// Never a real emblem, never a real official form: generic, readable, friendly.
const DC = { green: '#0E6B4E', greenL: '#CFE6DA', red: '#C8102E', yellow: '#F6C54A', blue: '#1D4577', paper: '#FFFDF7', line: 'rgba(35,22,41,.18)' };
let _GEO = null;
function geo() { if (!_GEO) _GEO = window.GEO_CMR || null; return _GEO; }
/** paper map of Cameroon (+ faded neighbours). scale = px per degree. o: { pins: {Douala: k, Kribi: k}, fill, neighbours } */
function cmrMap(scale, o = {}) {
  const g = geo(); if (!g) return;
  const drawRings = (rings) => { for (const r of rings) { ctx.beginPath(); r.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)); ctx.closePath(); } };
  ctx.save();
  if (o.sea !== false) { ctx.save(); ctx.fillStyle = o.seaColor || '#CFE0EC'; rrect(-7.2 * scale, -8.4 * scale, 14.8 * scale, 16 * scale, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(11,95,165,.12)'; ctx.lineWidth = 2; for (let i = 0; i < 7; i++) { ctx.beginPath(); for (let x = -7.2; x <= -2.5; x += .1) { const y = 2.2 + i * .55 + Math.sin(x * 4 + i) * .06; x === -7.2 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale); } ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.beginPath(); rrect(-7.2 * scale, -8.4 * scale, 14.8 * scale, 16 * scale, 18); ctx.clip(); }
  if (o.neighbours !== false) for (const k of ['NGA', 'TCD', 'CAF', 'COG', 'GAB', 'GNQ']) { if (!g[k]) continue;
    ctx.fillStyle = '#EADBC2'; ctx.strokeStyle = 'rgba(120,90,60,.35)'; ctx.lineWidth = 2; for (const r of g[k].rings) { ctx.beginPath(); r.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  withShadow(10, () => { ctx.fillStyle = o.fill || DC.greenL; for (const r of g.CMR.rings) { ctx.beginPath(); r.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)); ctx.closePath(); ctx.fill(); } });
  ctx.strokeStyle = DC.green; ctx.lineWidth = 4; for (const r of g.CMR.rings) { ctx.beginPath(); r.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)); ctx.closePath(); ctx.stroke(); }
  if (o.sea !== false) ctx.restore();                                           // end of the map-frame clip
  const pins = o.pins || {};
  for (const [name, k] of Object.entries(pins)) { if (k <= 0) continue; const c = g._cities[name]; if (!c) continue;
    const x = c[0] * scale, y = c[1] * scale, s = clamp(spring(k * .6, 12, .45), 0, 1.2);
    at(x, y, 0, s, s, () => { ctx.fillStyle = name === 'Kribi' ? C.orange : C.violetD; ctx.beginPath(); ctx.arc(0, -30, 22, Math.PI * .15, Math.PI * .85, true); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -32, 9, 0, 7); ctx.fill(); });
    if (k > .3) paperNote(x + (name === 'Kribi' ? -150 : -160), y + (name === 'Kribi' ? 40 : -60), measure(name, font(FF.body, 46, 800)) + 50, 70, -.03, () => text(name, 0, 16, { font: font(FF.body, 46, 800), align: 'center', color: C.ink }), { seed: name.length, h: 6, tape: false });
  }
  ctx.restore();
}
/** generic document sheet (w×h) with a header band, lines and fields. kind: 'facture' | 'connaissement' | 'declaration' | 'origine' | 'colisage' */
const DOCS = {
  facture: { title: 'FACTURE', sub: 'commercial invoice', band: C.violetD, rows: ['Produit', 'Quantité', 'Prix unitaire', 'Total'] },
  connaissement: { title: 'CONNAISSEMENT', sub: 'bill of lading', band: DC.blue, rows: ['Navire', 'Port de chargement', 'Port de déchargement', 'Colis'] },
  declaration: { title: 'DÉCLARATION', sub: 'en douane', band: DC.green, rows: ['Code du produit', 'Valeur', 'Origine', 'Régime'] },
  origine: { title: "CERTIFICAT D'ORIGINE", sub: 'certificate of origin', band: C.orange, rows: ['Exportateur', 'Produit', 'Pays d\'origine'] },
  colisage: { title: 'LISTE DE COLISAGE', sub: 'packing list', band: C.amber, rows: ['Cartons', 'Poids', 'Volume'] },
};
function docSheet(kind, w, h, o = {}) {
  const d = DOCS[kind] || DOCS.facture; ctx.save();
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.fillStyle = d.band; ctx.fillRect(-w / 2, -h / 2, w, h * .16);
  const tf = font(FF.stencil, 60, 900), ts = Math.min(56, (w - 56) / measure(d.title, tf, 2) * 60);
  text(d.title, -w / 2 + 28, -h / 2 + h * .105, { font: font(FF.stencil, ts, 900), color: '#fff', ls: 2 });
  text(d.sub, -w / 2 + 28, -h / 2 + h * .16 + 30, { font: font(FF.body, 22, 700), color: C.inkSoft, alpha: .8 });
  const rows = o.rows || d.rows, top = -h / 2 + h * .16 + 44, rh = (h / 2 - 24 - top) / Math.max(4, rows.length);
  if (o.highlight != null) { const y = top + o.highlight * rh; ctx.fillStyle = 'rgba(243,167,69,.35)'; ctx.fillRect(-w / 2 + 16, y + 2, w - 32, rh - 4); }
  rows.forEach((r, i) => { const y = top + i * rh; text(r, -w / 2 + 28, y + rh * .32, { font: font(FF.body, Math.min(26, rh * .26), 700), color: C.inkSoft });
    ctx.strokeStyle = DC.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 28, y + rh * .92); ctx.lineTo(w / 2 - 28, y + rh * .92); ctx.stroke();
    if (o.values && o.values[i] != null && (o.write ?? 1) > i / rows.length) { const vf = Math.min(44, rh * .42), vw = measure(o.values[i], font(FF.hand, vf, 800));
      handText(o.values[i], -w / 2 + 28, y + rh * .8, vw > w - 60 ? vf * (w - 60) / vw : vf, { align: 'left', color: C.ink, pen: false, write: clamp(((o.write ?? 1) - i / rows.length) * rows.length) }); } });
  ctx.restore();
}
/** the goods' passport booklet. k = open 0..1 (cover rotates open), fields shown on the inside page */
function goodsPassport(w, h, k, o = {}) {
  ctx.save();
  const open = eInOutCubic(clamp(k));
  // inside pages (visible as it opens)
  if (open > 0) { withShadow(8, () => { ctx.fillStyle = '#F7F2E4'; rrect(-w / 2, -h / 2, w, h, 16); ctx.fill(); });
    ctx.strokeStyle = 'rgba(14,107,78,.25)'; ctx.lineWidth = 1.5; for (let y = -h / 2 + 40; y < h / 2; y += 22) { ctx.beginPath(); ctx.moveTo(-w / 2 + 20, y); ctx.lineTo(w / 2 - 20, y); ctx.stroke(); }
    if (o.inside) o.inside(w, h); }
  // cover
  const sx = Math.cos(open * Math.PI);
  if (sx > -0.98) at(-w / 2, 0, 0, sx, 1, () => { ctx.translate(w / 2, 0);
    if (sx > 0) { withShadow(10, () => { ctx.fillStyle = o.cover || DC.green; rrect(-w / 2, -h / 2, w, h, 16); ctx.fill(); });
      ctx.strokeStyle = 'rgba(246,197,74,.9)'; ctx.lineWidth = 4; rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 10); ctx.stroke();
      text('PASSEPORT', 0, -h * .2, { font: font(FF.stencil, w * .16, 900), align: 'center', color: DC.yellow, ls: 4 });
      text('DE LA MARCHANDISE', 0, -h * .1, { font: font(FF.body, w * .075, 800), align: 'center', color: DC.yellow });
      at(0, h * .16, 0, 1, 1, () => carton(w * .38, w * .28, { seed: 5 })); }
    else { ctx.fillStyle = '#0A4F3A'; rrect(-w / 2, -h / 2, w, h, 16); ctx.fill(); } });
  ctx.restore();
}
/** red/white border barrier with a small booth; open 0..1 lifts the arm */
function barrier(len, open, o = {}) {
  ctx.save();
  withShadow(10, () => { ctx.fillStyle = '#E9E1D2'; rrect(-70, -140, 140, 200, 12); ctx.fill(); });
  ctx.fillStyle = '#9CC3E6'; rrect(-48, -118, 96, 60, 8); ctx.fill();
  text(o.label || 'DOUANE', 0, 30, { font: font(FF.stencil, 34, 900), align: 'center', color: DC.green, ls: 2 });
  ctx.translate(60, -40); ctx.rotate(-open * 1.35);
  for (let x = 0; x < len; x += 60) { ctx.fillStyle = (x / 60) % 2 ? '#FFFFFF' : DC.red; ctx.fillRect(x, -14, 60, 28); }
  ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; ctx.strokeRect(0, -14, len, 28);
  ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
  ctx.restore();
}
/** drive-through scanner arch (front view) w×h; beam 0..1 draws the scanning curtain */
function scannerArch(w, h, beam, o = {}) {
  ctx.save();
  withShadow(12, () => { ctx.fillStyle = '#D9D2C4'; ctx.fillRect(-w / 2, -h, 60, h); ctx.fillRect(w / 2 - 60, -h, 60, h); ctx.fillRect(-w / 2, -h, w, 70); });
  ctx.fillStyle = DC.yellow; for (let x = -w / 2; x < w / 2; x += 70) ctx.fillRect(x, -h + 50, 35, 16);
  text(o.label || 'SCANNER', 0, -h + 42, { font: font(FF.stencil, 40, 900), align: 'center', color: C.ink, ls: 4 });
  if (beam > 0) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(.5, `rgba(120,230,255,${.35 * beam})`); g.addColorStop(1, 'rgba(90,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(-w / 2 + 60, -h + 70, w - 120, h - 70); }
  ctx.restore();
}
/** big question card "QUOI ?" with number badge */
function qCard(n, word, sub, o = {}) {
  const w = o.w || 380, h = o.h || 210; ctx.save();
  withShadow(12, () => { ctx.fillStyle = o.fill || DC.paper; rrect(-w / 2, -h / 2, w, h, 20); ctx.fill(); });
  ctx.fillStyle = o.band || C.violetD; ctx.beginPath(); ctx.arc(-w / 2 + 42, -h / 2 + 42, 32, 0, 7); ctx.fill();
  text(String(n), -w / 2 + 42, -h / 2 + 57, { font: font(FF.brand, 44, 900), align: 'center', color: '#fff' });
  text(word, 0, 18, { font: font(FF.stencil, o.size || 92, 900), align: 'center', color: o.band || C.violetD, ls: 3 });
  if (sub) text(sub, 0, h / 2 - 26, { font: font(FF.body, 34, 700), align: 'center', color: C.inkSoft });
  ctx.restore();
}

/** paper phone (w×h screen) with a real app screenshot inside: shots = [{name, t0, t1, scroll0, scroll1}] chosen by the caller.
 *  drawScreen(x,y,w,h) paints the screen content; the frame adds bezel, notch, glare. */
function phoneFrame(w, h, drawScreen, o = {}) {
  const b = o.bezel ?? 22; ctx.save();
  withShadow(o.lift ?? 18, () => { ctx.fillStyle = '#231629'; rrect(-w / 2 - b, -h / 2 - b * 2.4, w + 2 * b, h + b * 4.8, 64); ctx.fill(); });
  ctx.fillStyle = '#3A2F42'; rrect(-w / 2 - b + 6, -h / 2 - b * 2.4 + 6, w + 2 * b - 12, h + b * 4.8 - 12, 58); ctx.fill();
  ctx.save(); rrect(-w / 2, -h / 2, w, h, 26); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-w / 2, -h / 2, w, h);
  drawScreen(-w / 2, -h / 2, w, h);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.fillStyle = '#231629'; rrect(-60, -h / 2 - b * 1.6, 120, 22, 11); ctx.fill();
  ctx.restore();
}
/** screenshot inside a screen rect, scrolled by `scroll` px (in screenshot pixels scaled to width) */
function screenShot(name, x, y, w, h, scroll = 0) {
  const im = ph(name); if (!im) { ctx.fillStyle = '#eee'; ctx.fillRect(x, y, w, h); return; }
  const s = w / im.naturalWidth, sh = Math.min(im.naturalHeight - scroll, h / s);
  ctx.drawImage(im, 0, scroll, im.naturalWidth, sh, x, y, w, sh * s);
}
/** a finger tap (paper hand) at (x,y): k = 0..1 press animation */
function fingerTap(x, y, k, o = {}) {
  const press = Math.sin(clamp(k) * Math.PI);
  if (k > 0 && k < 1) { ctx.save(); ctx.strokeStyle = `rgba(169,71,254,${.7 * (1 - k)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 30 + 60 * k, 0, 7); ctx.stroke(); ctx.restore(); }
  at(x + 10, y + 16 + (1 - press) * 20, -.35, 1 - .06 * press, 1 - .06 * press, () => { ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 12 * (1 - press);
    ctx.fillStyle = o.skin || '#8A5433'; rrect(-26, -10, 52, 150, 26); ctx.fill(); ctx.fillStyle = 'rgba(255,230,210,.5)'; rrect(-18, -4, 36, 34, 14); ctx.fill();
    ctx.fillStyle = o.sleeve || C.violet; rrect(-40, 120, 80, 160, 30); ctx.fill(); ctx.restore(); });
}
