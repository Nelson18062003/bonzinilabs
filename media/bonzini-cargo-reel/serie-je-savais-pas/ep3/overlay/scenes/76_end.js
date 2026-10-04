'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — M2 part 4: THE END CARD (prefix BZ_).
//   BZ_end(st, t, L, space)   st = SCORE.endcard(t) = {k, service, cta, stamp, tag, out}; compose calls it twice:
//     'screen'  · the shop's sign: a cream enamel plaque hung on the back wall (swings once, settles), the logo (its four
//                 pieces snap together) + « Bonzini Trading Cargo » (DMSans 900, y G.end.logoY), the verified service line
//                 « Chine → Douala · bateau ou avion » (Satoshi 800 44 px, violet ink, « → » drawn, y G.end.serviceY);
//               · a cream paper card slapped down for the series' ritual stamp « MAINTENANT, / TU SAIS. » (orange, y
//                 G.end.stampY, the rubber lands on A.stampEnd — « Maintenant »);
//               · the series' amber CTA pill « Écris FICHE en commentaire » (bounces once on A.cta) + its hand-drawn
//                 orange arrow ↓ at the right end;
//               · « Tague celui qui commande / toujours « comme la photo » » (Satoshi 700 44 px, y G.end.tagY) on a smoked
//                 glass panel, « comme la photo » in amber; text within x 230…850 (clear of the arrow and of x 960).
//     'world'   nothing (the counter is left to the margouillat and to « C'EST ÇA ✓ », which rises back for the loop).
//   Takes over the texts 'brand', 'service', 'stampEnd', 'cta', 'tag' (strings read from SCORE.TEXTS()).
//   The loop: every end text fades A.loop → A.out; the last frames are the plate alone (frame 0's place).
// BZ_ritualStamp / BZ_ctaPill are the series' shared pieces (episode 1 / 2, « copy as is »): same stamp, same pill in all 5.
// =============================================================================================
(function () {
  const F = FS_lib, S = F.S, G = F.G, A = F.A, P = F.P, { cl, kk, mix, eo, sst, R } = F;
  const spr = S.spr;
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };
  const fadeOut = t => 1 - kk(t, A.loop, A.out);

  // ---------------------------------------------------------------- the shop's sign (cream enamel, violet pinstripe)
  const SW = 900, SH = 214, SR = 26;
  const NAME_F = '900 66px DMSans', LOGO = 112, GAP = 22, SERV_F = '800 44px Satoshi', ARW = 50;
  const signSprite = () => F.sprite('endSign', SW + 80, SH + 90, () => {
    ctx.save(); ctx.shadowColor = 'rgba(8,3,2,.6)'; ctx.shadowBlur = 26; ctx.shadowOffsetX = 20000 + 8; ctx.shadowOffsetY = 16; ctx.translate(-20000, 0);
    rrect(-SW / 2, -SH / 2, SW, SH, SR); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#C9BCA6'; rrect(-SW / 2, -SH / 2 + 7, SW, SH, SR); ctx.fill();                 // the steel edge
    const g = ctx.createLinearGradient(0, -SH / 2, 0, SH / 2); g.addColorStop(0, '#FFFCF5'); g.addColorStop(1, '#F1E9DA');
    ctx.fillStyle = g; rrect(-SW / 2, -SH / 2, SW, SH, SR); ctx.fill();
    ctx.save(); rrect(-SW / 2, -SH / 2, SW, SH, SR); ctx.clip();
    for (let i = 0; i < 700; i++) { ctx.fillStyle = R(i, 31) > .5 ? 'rgba(255,255,255,.35)' : 'rgba(120,96,70,.05)'; ctx.fillRect(-SW / 2 + R(i, 32) * SW, -SH / 2 + R(i, 33) * SH, 2, 2); }
    const sh = ctx.createLinearGradient(-SW / 2, -SH / 2, SW / 2, SH / 2); sh.addColorStop(0, 'rgba(255,255,255,.4)'); sh.addColorStop(.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(90,60,40,.08)');
    ctx.fillStyle = sh; ctx.fillRect(-SW / 2, -SH / 2, SW, SH);
    ctx.restore();
    ctx.strokeStyle = '#6A35F2'; ctx.lineWidth = 5; rrect(-SW / 2 + 14, -SH / 2 + 14, SW - 28, SH - 28, SR - 10); ctx.stroke();   // violet pinstripe
    for (const sx of [-1, 1]) {                                                                   // two screws
      const x = sx * (SW / 2 - 34), y = -SH / 2 + 34, rg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
      rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(.5, '#CFCAD9'); rg.addColorStop(1, '#6D6680');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,60,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y + 2.5); ctx.lineTo(x + 5, y - 2.5); ctx.stroke();
    }
  }, 2);
  const PIECES = [['wingTop', -1, -.8, -.9], ['wingBot', -1, .9, .8], ['amber', 1, -.7, .7], ['orange', .9, .9, -.8]];
  function serviceLine(l, cx, y, col) {
    const parts = l.split('→'), ws = parts.map(p => F.measureW(p, SERV_F)), tot = ws.reduce((a, b) => a + b, 0) + (parts.length - 1) * ARW;
    let x = cx - tot / 2;
    parts.forEach((p, i) => {
      text(p, x, y, { font: SERV_F, color: col }); x += ws[i];
      if (i < parts.length - 1) { const ay = y - 15; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + 9, ay); ctx.lineTo(x + ARW - 11, ay); ctx.moveTo(x + ARW - 24, ay - 12); ctx.lineTo(x + ARW - 10, ay); ctx.lineTo(x + ARW - 24, ay + 12); ctx.stroke(); ctx.restore(); x += ARW; }
    });
  }
  function sign(st, t) {
    const d = t - (A.endcard + .12), k = eo(kk(t, A.endcard + .12, A.endcard + .45)); if (k <= 0) return;
    const cy = (G.end.logoY + G.end.serviceY) / 2 - 10, nailY = cy - SH / 2 - 44;
    const sw = d > 0 ? .07 * Math.exp(-d * 3.2) * Math.sin(d * 7.5) : 0, drop = -70 * (1 - k);
    ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2);
    // the nail and the two cords
    ctx.save(); ctx.translate(G.cx, nailY + drop); ctx.rotate(sw);
    ctx.strokeStyle = 'rgba(30,20,14,.85)'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-SW / 2 + 34, 44 + 34); ctx.moveTo(0, 0); ctx.lineTo(SW / 2 - 34, 44 + 34); ctx.stroke();
    ctx.translate(0, SH / 2 + 44);
    F.blit(signSprite());
    // the lockup: logo (pieces snap together) + name
    const name = txt('brand') || 'Bonzini Trading Cargo', nw = F.measureW(name, NAME_F), x0 = -(LOGO + GAP + nw) / 2, ly = G.end.logoY - cy;
    const dl = t - (A.endcard + .3), offsets = {};
    PIECES.forEach(([role, dx, dy, r], i) => { const p = cl(spr(dl - .04 * i, 12, .62), 0, 1.04), q = 1 - p; offsets[role] = [dx * 150 * q, dy * 150 * q, .22 * r * Math.max(0, q), cl(p * 3)]; });
    if (dl > 0) drawLogo(x0 + LOGO / 2, ly - 4, LOGO, { offsets });
    const nk = eo(kk(t, A.endcard + .3, A.endcard + .6));   // QA: the name comes in with the logo, before the service line
    if (nk > 0) { ctx.save(); ctx.globalAlpha *= nk; text(name, x0 + LOGO + GAP, ly + 24 + 16 * (1 - nk), { font: NAME_F, color: P.ink }); ctx.restore(); }
    // the verified service line
    const sk = st.service; if (sk > 0) { ctx.save(); ctx.globalAlpha *= sk; serviceLine(txt('service') || 'Chine → Douala · bateau ou avion', 0, G.end.serviceY - cy + 18 + 12 * (1 - sk), '#4A1FC2'); ctx.restore(); }
    ctx.restore();
    // the nail head
    ctx.fillStyle = '#2A221C'; ctx.beginPath(); ctx.arc(G.cx, nailY + drop, 6, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,240,220,.6)'; ctx.beginPath(); ctx.arc(G.cx - 1.5, nailY + drop - 1.5, 2, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- the ritual stamp, on a paper card
  const CW = 770, CH = 300;
  const cardSprite = () => F.sprite('endCard', CW + 60, CH + 70, () => {
    const top = tornLine(-CW / 2, -CH / 2, CW / 2, -CH / 2, 71, 3, 14), bot = tornLine(CW / 2, CH / 2, -CW / 2, CH / 2, 77, 3, 14);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(10,4,2,.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 20000 + 6; ctx.shadowOffsetY = 12; ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -CH / 2, 0, CH / 2); g.addColorStop(0, '#FFFBF2'); g.addColorStop(1, '#F3ECDD');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 600; i++) { const x = -CW / 2 + R(i, 41) * CW, y = -CH / 2 + R(i, 42) * CH, a = R(i, 43) * 3, l = 3 + R(i, 44) * 8;
      ctx.strokeStyle = R(i, 45) > .5 ? 'rgba(150,115,75,.07)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.restore();
  }, 2);
  function stampCard(st, t, fo) {
    const t0 = A.stampEnd - .42, k = eo(kk(t, t0, t0 + .26)); if (k <= 0) return;
    const d = t - (t0 + .26), wob = d > 0 ? .02 * Math.exp(-d * 8) * Math.sin(d * 30) : 0;
    ctx.save(); ctx.globalAlpha *= fo * Math.min(1, k * 2); ctx.translate(G.cx, G.end.stampY + 40 * (1 - k)); ctx.rotate(-.025 + wob); ctx.scale(1.1 - .1 * k, 1.1 - .1 * k);
    F.blit(cardSprite()); ctx.restore();
    BZ_ritualStamp(G.cx, G.end.stampY, st.stamp, { alpha: fo, since: t - A.stampEnd });
  }

  // ---------------------------------------------------------------- the tag line (smoked glass)
  const TAG_F = '700 44px Satoshi';
  function tagLine(st, t, fo) {
    const k = st.tag; if (k <= 0) return;
    const lines = (txt('tag') || 'Tague celui qui commande|toujours « comme la photo »').split('|');
    const w = Math.max(...lines.map(l => F.measureW(l, TAG_F))) + 64, h = 54 * lines.length + 34, y0 = G.end.tagY - 40, cx = G.cx - 30;
    ctx.save(); ctx.globalAlpha *= k * fo; ctx.translate(0, 12 * (1 - k));
    ctx.fillStyle = 'rgba(14,8,22,.74)'; rrect(cx - w / 2, y0 - 10, w, h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,232,.16)'; ctx.lineWidth = 2; rrect(cx - w / 2 + 1, y0 - 9, w - 2, h - 2, 21); ctx.stroke();
    lines.forEach((l, i) => {
      const y = y0 + 40 + i * 54, m = l.match(/^(.*?)(«.*»)(.*)$/);
      if (!m) { text(l, cx, y, { font: TAG_F, align: 'center', color: '#FFF6E8' }); return; }
      const ws = [m[1], m[2], m[3]].map(s => F.measureW(s, TAG_F)); let x = cx - (ws[0] + ws[1] + ws[2]) / 2;
      text(m[1], x, y, { font: TAG_F, color: '#FFF6E8' }); x += ws[0];
      text(m[2], x, y, { font: TAG_F, color: '#F7B54E' }); x += ws[1];
      text(m[3], x, y, { font: TAG_F, color: '#FFF6E8' });
    });
    ctx.restore();
  }

  function screenPart(st, t, L) {
    const fo = fadeOut(t); if (fo <= 0) return;
    ctx.save(); ctx.globalAlpha *= fo; sign(st, t); ctx.restore();
    stampCard(st, t, fo);
    // the CTA pill + the hand-drawn arrow ↓ at its right end (drawn on, then bobbing ≈ 1.2 Hz)
    const word = ((txt('cta') || '').match(/Écris (.+?) en commentaire/) || [0, 'FICHE'])[1];
    ctx.save(); ctx.globalAlpha *= fo;
    const geo = BZ_ctaPill(G.cx, G.end.ctaY, word, { k: st.cta, since: t - A.cta, t, scale: 1.12 });   // 50 → 56 px (MODULES)
    const ak = kk(t, A.cta + .2, A.cta + .55);
    if (ak > 0 && geo) {
      const ax = Math.min(geo.x1 - 44, 912), ay = G.end.ctaY + geo.h / 2 + 10 + 5 * Math.sin((t - A.cta - .55) * 7.5) * kk(t, A.cta + .55, A.cta + .9);
      ctx.strokeStyle = P.orange; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const k1 = cl(ak / .65), k2 = cl((ak - .6) / .4), Lh = 60;
      ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.bezierCurveTo(ax + 8, ay + Lh * .35 * k1, ax - 6, ay + Lh * .7 * k1, ax + 4, ay + Lh * k1); ctx.stroke();
      if (k2 > 0) { ctx.beginPath(); ctx.moveTo(ax - 17, ay + Lh - 22 + 16 * (1 - k2)); ctx.lineTo(ax + 4, ay + Lh + 2); ctx.lineTo(ax + 4 + 19 * k2, ay + Lh - 20 + 16 * (1 - k2)); ctx.stroke(); }
    }
    ctx.restore();
    tagLine(st, t, fo);
  }
  window.BZ_end = (st, t, L, space) => { if (!st) return; if (space !== 'world') screenPart(st, t, L); };
})();

// =============================================================================================
// REUSABLE IN THE 5 EPISODES (from episode 1's 70_bonzini.js via episode 2's 76_end.js, « copy as is »; kit.js only).
// =============================================================================================
/** « MAINTENANT, TU SAIS. » — the series' ritual stamp. Orange rubber stamp, two lines (« MAINTENANT, » / « TU SAIS. »,
 *  Big Shoulders Stencil 112 px), double border, starved ink, printed in multiply. ≈ 690 × 262 px. (x, y) = centre in the
 *  current transform; k = landing 0..1 (the rubber comes down: 1.5 → 1, ink appears); o = {alpha, since, rot, color}. */
function BZ_ritualStamp(x, y, k, o = {}) {
  if (k <= 0) return;
  const col = o.color || '#FE560D', key = 'ritual' + col;
  const C2 = BZ_ritualStamp.cache || (BZ_ritualStamp.cache = {});
  let sp = C2[key];
  if (!sp) {
    const f = '900 112px Stencil', l1 = 'MAINTENANT,', l2 = 'TU SAIS.', w = Math.ceil(Math.max(measure(l1, f, 4), measure(l2, f, 4)) + 96), h = 262, sc = 2;
    const c = makeCanvas((w + 30) * sc, (h + 30) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 30) / 2, (h + 30) / 2);
      g.strokeStyle = col; g.lineWidth = 11; rrect(-w / 2, -h / 2, w, h, 20); g.stroke();
      g.lineWidth = 3.5; rrect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30, 11); g.stroke();
      text(l1, 2, -14, { font: f, align: 'center', color: col, ls: 4 });
      text(l2, 2, 92, { font: f, align: 'center', color: col, ls: 4 });
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .45;
      g.drawImage(TEX.starve, -w / 2 - 15, -h / 2 - 15, w + 30, h + 30); g.globalAlpha = .3; g.drawImage(TEX.starve, 80, 30, 360, 200, -w / 2, -h / 2, w, h);
    } finally { ctx = prev; }
    sp = C2[key] = { c, w: w + 30, h: h + 30 };
  }
  const e = 1 - Math.pow(1 - Math.min(1, k), 3), since = o.since ?? 1;
  const s = (k < 1 ? 1.5 - .5 * e : 1) * (1 + .028 * Math.exp(-Math.max(0, since) * 12));
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.05); ctx.scale(s, s);
  ctx.globalAlpha *= (o.alpha ?? 1) * Math.min(1, k * 2);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  ctx.restore();
}
/** the series' CTA pill « Écris [WORD] en commentaire »: amber pill with thickness, the keyword typed in a cream field
 *  (orange stencil + a 1 Hz cursor, 18 px from the word). (x, y) = centre; o = {k (0..1 appear), since (one bounce), t, scale}.
 *  Returns {x0, x1, h}. */
function BZ_ctaPill(x, y, word, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return null;
  const C2 = BZ_ctaPill.cache || (BZ_ctaPill.cache = {});
  let sp = C2[word];
  if (!sp) {
    const fA = '900 50px Satoshi', fK = '900 66px Stencil', wE = measure('Écris', fA), wC = measure('en commentaire', fA), wK = measure(word, fK, 3) + 72;
    const gap = 18, pad = 34, w = Math.ceil(wE + gap + wK + gap + wC + 2 * pad), h = 104, sc = 2;
    const c = makeCanvas((w + 80) * sc, (h + 90) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 80) / 2, (h + 90) / 2 - 12);
      g.save(); g.shadowColor = 'rgba(60,24,40,.34)'; g.shadowBlur = 22 * sc; g.shadowOffsetY = 12 * sc;
      g.fillStyle = '#B86F1A'; rrect(-w / 2, -h / 2 + 8, w, h, h / 2); g.fill(); g.restore();
      const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#FAC06A'); pg.addColorStop(1, '#EE9A30');
      g.fillStyle = pg; rrect(-w / 2, -h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2.5; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, h / 2 - 4); g.stroke();
      let cx = -w / 2 + pad;
      text('Écris', cx, 18, { font: fA, color: '#231629' }); cx += wE + gap;
      g.fillStyle = 'rgba(120,60,0,.28)'; rrect(cx, -36 + 3, wK, 76, 16); g.fill();
      g.fillStyle = '#FFF8EC'; rrect(cx, -38, wK, 76, 16); g.fill();
      text(word, cx + 20, 24, { font: fK, color: '#FE560D', ls: 3 });
      sp = { cursor: cx + wK - 24 }; cx += wK + gap;
      text('en commentaire', cx, 18, { font: fA, color: '#231629' });
    } finally { ctx = prev; }
    sp = C2[word] = { c, w: w + 80, h: h + 90, pw: w, ph: h, cursor: sp.cursor };
  }
  const d = o.since ?? 1, e = 1 - Math.pow(1 - Math.min(1, k), 3);
  const sc = o.scale ?? 1, s = sc * e * (1 + .13 * Math.exp(-Math.max(0, d) * 6) * Math.sin(Math.max(0, d) * 16));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.012); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2); ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2 + 12, sp.w, sp.h); ctx.restore();
  const tt = o.t ?? 0;
  if (Math.floor(tt * 2) % 2 === 0) { ctx.fillStyle = '#FE560D'; ctx.globalAlpha *= Math.min(1, k * 2); ctx.fillRect(sp.cursor, -22, 4, 44); }
  ctx.restore();
  return { x0: x - sp.pw / 2 * sc, x1: x + sp.pw / 2 * sc, h: sp.ph * sc };
}
