'use strict';
// Shared story motifs (identical look everywhere they appear):
//  juniorPhone(w, h, o)  — Junior's paper phone. o.screen: 'notif' (« Votre conteneur est arrivé · Kribi ») | 'message' (the big brother's
//                          message + Junior's hidden answer under a sealed kraft flap) ; o.seal 0..1 (1 = violet « ? » sticker on), o.flap 0..1 (1 = flap open)
//  mireilleDiary(w, page, o) — Mireille's spiral diary. page: 'MER.' | 'JEU.' | 'VEN.' ; o.note, o.tab (VENDREDI · POIVRE → KRIBI), o.check 0..1
//  qSticker(r, k)        — the round violet « ? » sticker (also used as a match-cut target)

function qSticker(r, k = 1) {
  ctx.save(); ctx.globalAlpha *= clamp(k);
  withShadow(6, () => { ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); });
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, 7); ctx.stroke();
  text('?', 0, r * .36, { font: font(FF.stencil, r * 1.1, 900), align: 'center', color: '#fff' });
  ctx.restore();
}

function juniorPhone(w, h, o = {}) {
  const b = w * .05;
  ctx.save();
  withShadow(o.lift ?? 16, () => { ctx.fillStyle = '#231629'; rrect(-w / 2, -h / 2, w, h, w * .12); ctx.fill(); });
  ctx.fillStyle = '#FBF8F1'; rrect(-w / 2 + b, -h / 2 + b * 2.2, w - 2 * b, h - b * 4.4, w * .06); ctx.fill();
  ctx.fillStyle = '#231629'; rrect(-w * .12, -h / 2 + b * .8, w * .24, b * .7, b * .35); ctx.fill();
  const sx = -w / 2 + b, sy = -h / 2 + b * 2.2, sw = w - 2 * b, sh = h - b * 4.4, u = sw / 100;   // screen units (100 = screen width)
  ctx.save(); rrect(sx, sy, sw, sh, w * .06); ctx.clip();
  if (o.screen === 'notif') {
    ctx.fillStyle = '#EDE6F7'; ctx.fillRect(sx, sy, sw, sh);
    text('09:12', 0, sy + 22 * u, { font: font(FF.brand, 16 * u, 800), align: 'center', color: C.ink });
    text('mercredi', 0, sy + 30 * u, { font: font(FF.body, 5.5 * u, 700), align: 'center', color: C.inkSoft });
    const k = clamp(o.notif ?? 1), ny = sy + 42 * u + (1 - eOutBack(k)) * -30 * u;
    ctx.save(); ctx.globalAlpha *= k; withShadow(6, () => { ctx.fillStyle = '#FFFFFF'; rrect(sx + 5 * u, ny, 90 * u, 30 * u, 5 * u); ctx.fill(); });
    ctx.fillStyle = DC.green; rrect(sx + 9 * u, ny + 5 * u, 10 * u, 10 * u, 2.5 * u); ctx.fill();
    text('Mon transitaire', sx + 23 * u, ny + 11 * u, { font: font(FF.body, 5.2 * u, 800), color: C.ink });
    text('Votre conteneur', sx + 9 * u, ny + 20 * u, { font: font(FF.body, 6 * u, 800), color: C.ink });
    text('est arrivé · Kribi', sx + 9 * u, ny + 27 * u, { font: font(FF.body, 6 * u, 700), color: C.ink }); ctx.restore();
  } else if (o.screen === 'message') {
    ctx.fillStyle = '#F2EEE6'; ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#E6DFD2'; ctx.fillRect(sx, sy, sw, 16 * u);                      // chat header: generic avatar (sunglasses silhouette)
    ctx.fillStyle = '#5A4A62'; ctx.beginPath(); ctx.arc(sx + 11 * u, sy + 8 * u, 5 * u, 0, 7); ctx.fill();
    ctx.fillStyle = '#17111B'; ctx.fillRect(sx + 7.5 * u, sy + 7 * u, 7 * u, 1.8 * u);
    text('Grand frère', sx + 19 * u, sy + 10.5 * u, { font: font(FF.body, 5.5 * u, 800), color: C.ink });
    // stamp « IL Y A 3 MOIS »
    at(sx + 76 * u, sy + 26 * u, -.12, 1, 1, () => stampText('IL Y A 3 MOIS', 0, 0, font(FF.stencil, 5.2 * u, 900), C.orange, { box: true, h: 9 * u, boxW: 1.1 * u, starve: .3, ls: 1 }));
    // his message (left bubble)
    const by = sy + 36 * u; withShadow(3, () => { ctx.fillStyle = '#FFFFFF'; rrect(sx + 5 * u, by, 88 * u, 38 * u, 4 * u); ctx.fill(); });
    const L = ['Petit prix sur facture,', 'mets juste « chaussures »…', 'moins de douane !'];
    L.forEach((l, i) => text(l, sx + 9 * u, by + 10 * u + i * 9.5 * u, { font: font(FF.hand, 5.8 * u, 800), color: C.ink }));
    // Junior's answer (right bubble) hidden under the kraft flap
    const ay = by + 46 * u, aw = 86 * u, ah = 26 * u, ax = sx + sw - 5 * u - aw;
    withShadow(3, () => { ctx.fillStyle = '#E3D2FF'; rrect(ax, ay, aw, ah, 4 * u); ctx.fill(); });
    text('Non merci.', ax + 5 * u, ay + 10.5 * u, { font: font(FF.hand, 6.4 * u, 800), color: C.violetD });
    text('Vrai prix, vraie description.', ax + 4 * u, ay + 20 * u, { font: font(FF.hand, 5.2 * u, 800), color: C.violetD });
    const f = clamp(o.flap ?? 0);                                                          // flap folds up (y-scale) to reveal
    if (f < 1) { ctx.save(); ctx.translate(ax, ay); ctx.scale(1, 1 - eInOutCubic(f)); withShadow(4, () => { ctx.fillStyle = TEX.kraft; rrect(-2 * u, -2 * u, aw + 4 * u, ah + 4 * u, 4 * u); ctx.fill(); });
      ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = .6 * u; ctx.strokeRect(0, 0, aw, ah); ctx.restore(); }
    const s = clamp(o.seal ?? 1); if (s > 0 && f < .15) at(ax + aw / 2 + (1 - s) * 30 * u, ay + ah / 2 - (1 - s) * 40 * u, (1 - s) * 1.2, 1, 1, () => qSticker(9 * u, s));
  }
  ctx.restore(); ctx.restore();
}

function mireilleDiary(w, page = 'MER.', o = {}) {
  const h = w * 1.25; ctx.save();
  withShadow(o.lift ?? 12, () => { ctx.fillStyle = '#FFFDF7'; rrect(-w / 2, -h / 2, w, h, 10); ctx.fill(); });
  ctx.fillStyle = C.orange; ctx.fillRect(-w / 2, -h / 2, w, h * .13);
  for (let i = 0; i < 9; i++) { ctx.strokeStyle = '#6B5B72'; ctx.lineWidth = w * .012; ctx.beginPath(); ctx.arc(-w / 2 + w * (.1 + i * .1), -h / 2, w * .025, Math.PI, 0); ctx.stroke(); }
  text(page, -w / 2 + w * .07, -h / 2 + h * .095, { font: font(FF.stencil, w * .11, 900), color: '#fff', ls: 2 });
  ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; for (let y = -h / 2 + h * .22; y < h / 2 - 10; y += h * .08) { ctx.beginPath(); ctx.moveTo(-w / 2 + w * .06, y); ctx.lineTo(w / 2 - w * .06, y); ctx.stroke(); }
  if (o.note) o.note.split('\n').forEach((l, i) => text(l, -w / 2 + w * .08, -h / 2 + h * (.3 + i * .08), { font: font(FF.hand, w * .062, 800), color: C.ink }));
  if (o.tab) { at(0, h * .28, -.03, 1, 1, () => { ctx.strokeStyle = C.orange; ctx.lineWidth = w * .018; ctx.beginPath(); ctx.ellipse(0, 0, w * .44, h * .09, 0, 0, 7); ctx.stroke();
    text(o.tab, 0, w * .02, { font: font(FF.mono, w * .05, 700), align: 'center', color: C.ink }); }); }
  const ck = clamp(o.check ?? 0); if (ck > 0) { ctx.save(); ctx.strokeStyle = '#1FA86A'; ctx.lineWidth = w * .035; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = [[-w * .2, h * .02], [-w * .06, h * .14], [w * .26, -h * .12]]; ctx.beginPath(); ctx.moveTo(...P[0]);
    const k1 = clamp(ck * 2), k2 = clamp(ck * 2 - 1); ctx.lineTo(lerp(P[0][0], P[1][0], k1), lerp(P[0][1], P[1][1], k1)); if (k2 > 0) ctx.lineTo(lerp(P[1][0], P[2][0], k2), lerp(P[1][1], P[2][1], k2)); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
