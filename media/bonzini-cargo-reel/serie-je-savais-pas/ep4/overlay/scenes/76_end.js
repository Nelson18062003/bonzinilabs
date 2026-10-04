'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — M2, part 3: the end card, the ritual, the CTA, the loop (prefix BZ_).
//   BZ_end(ec, t, L, space)   ec = SCORE.endcard(t) = {k, service, cta, stamp, tag, out}; compose calls it twice:
//     'screen'  a soft night scrim behind the block (the wax stays visible, the words never fight it); the lockup — a cream
//               enamel roundel, the logo's four pieces fly in and snap onto it, « Bonzini Trading Cargo » (y G.end.logoY);
//               the verified service line « Cargo Chine → Douala · mer ou air » (y G.end.serviceY, « → » drawn); the series'
//               ritual stamp « MAINTENANT, / TU SAIS. » (orange, y G.end.stampY, on A.stampEnd — night version: printed in
//               normal blending over a soft dark seat, an ink spit at the impact); the series' amber CTA pill
//               « Écris ALLÔ en commentaire » (y G.end.ctaY, one bounce on A.cta) + its hand-drawn orange arrow ↓;
//               « Tague celui qui paie trop vite » written by hand in cream chalk (y G.end.tagY, from A.tagLine), an amber
//               swash under « trop vite ». THE LOOP: from A.loop0 every block is blown up and out towards the lens as the
//               parcel rushes at us; everything is gone at A.out (the last frames = the parcel alone, frame 0 again).
//     'world'   the loop's trail: violet sparks shed by TA COMMANDE as it leaves the container (its Bonzini violet falls
//               off: frame 0 is kraft again).
//   Takes over 'brand', 'serviceEnd', 'stampEnd', 'cta', 'tag' (strings read from SCORE.TEXTS()).
// BZ_ritualStamp / BZ_ctaPill are the series' shared pieces (episodes 1–2, « copy as is »); one addition for the night:
// BZ_ritualStamp(…, {night: true}) prints in normal blending over a dark seat (multiply would vanish on the indigo night).
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk, eOut = S.easeOut, eIn = S.easeIn, spr = S.spr, cl = S.cl, lerpv = S.lerpv;
  const TAU = Math.PI * 2;
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };
  const CREAM = '#FFF6E8', LILAC = '#DCD0FF', ORANGE = '#FE560D', AMBER = '#F3A745';
  // the loop's gust: from just after A.loop0 every block flies up/out and fades; gone at A.out
  const gust = t => eIn(kk(t, A.loop0 + .04, A.out));
  function blown(t, y, fn) {
    const g = gust(t); if (g >= 1) return;
    ctx.save(); ctx.globalAlpha *= 1 - g;
    const dy = (y - 1050) * .5 * g - 90 * g, s = 1 + .35 * g;
    ctx.translate(G.cx, y + dy); ctx.scale(s, s); ctx.translate(-G.cx, -y);
    fn(); ctx.restore();
  }
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);

  // ------------------------------------------------------------------ the night scrim (baked once)
  const scrim = () => sprite('scrim', 1080, 900, (w, h) => {
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(12,6,26,0)'); g.addColorStop(.2, 'rgba(12,6,26,.5)'); g.addColorStop(.75, 'rgba(12,6,26,.55)'); g.addColorStop(1, 'rgba(12,6,26,0)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  });

  // ------------------------------------------------------------------ the lockup
  const PIECES = [['wingTop', -1, -.8, -.9], ['wingBot', -1, .9, .8], ['amber', 1, -.7, .7], ['orange', .9, .9, -.8]];
  const LOGO = 96, RND = 124, GAP = 22;
  let NAME_F = null;
  function nameFont(name) {
    if (NAME_F) return NAME_F;
    let z = 70; while (z > 50 && measure(name, `900 ${z}px DMSans`, -1) + RND + GAP > 900) z -= 2;
    return (NAME_F = `900 ${z}px DMSans`);
  }
  const roundel = () => sprite('roundel', RND + 30, RND + 30, () => {
    const r = RND / 2;
    ctx.fillStyle = 'rgba(4,2,12,.55)'; ctx.beginPath(); ctx.arc(2, 5, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5B2BDF'; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, '#FFFDF7'); g.addColorStop(.7, '#FBF3E3'); g.addColorStop(1, '#E9DCC4');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(91,43,223,.45)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, r - 7, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, r - 2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }, 2);
  function lockup(ec, t) {
    const d = t - (A.endcard + .05); if (d <= 0) return;
    const name = txt('brand') || 'Bonzini Trading Cargo', f = nameFont(name), nw = measure(name, f, -1), x0 = G.cx - (RND + GAP + nw) / 2, ly = G.end.logoY;
    const rk = cl(spr(d, 14, .5), 0, 1.2);
    ctx.save(); ctx.translate(x0 + RND / 2, ly); ctx.scale(rk, rk); blit(roundel()); ctx.restore();
    const offsets = {};
    PIECES.forEach(([role, dx, dy, r], i) => { const p = cl(spr(d - .08 - .04 * i, 12, .62), 0, 1.04), q = 1 - p; offsets[role] = [dx * 170 * q, dy * 170 * q, .22 * r * Math.max(0, q), cl(p * 3)]; });
    drawLogo(x0 + RND / 2, ly, LOGO, { offsets });
    const nk = eOut(kk(t, A.endcard + .2, A.endcard + .52));
    if (nk > 0) {
      ctx.save(); ctx.globalAlpha *= nk;
      text(name, x0 + RND + GAP, ly + 24 + 2 + 20 * (1 - nk), { font: f, color: 'rgba(8,4,18,.6)', ls: -1 });
      text(name, x0 + RND + GAP, ly + 24 + 20 * (1 - nk), { font: f, color: CREAM, ls: -1 });
      ctx.restore();
    }
  }
  // the verified service line, « → » drawn as a shape (font-safe)
  const SERV_F = '800 44px Satoshi', ARW = 54;
  function serviceLine(l, cx, y, col) {
    const parts = l.split('→'), ws = parts.map(p => measure(p, SERV_F)), tot = ws.reduce((a, b) => a + b, 0) + (parts.length - 1) * ARW;
    let x = cx - tot / 2;
    parts.forEach((p, i) => {
      text(p, x, y + 2, { font: SERV_F, color: 'rgba(8,4,18,.55)' }); text(p, x, y, { font: SERV_F, color: col }); x += ws[i];
      if (i < parts.length - 1) {
        const ay = y - 15; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [c, o, w] of [['rgba(8,4,18,.55)', 2, 6.5], [AMBER, 0, 5.5]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x + 9, ay + o); ctx.lineTo(x + ARW - 11, ay + o); ctx.moveTo(x + ARW - 24, ay - 12 + o); ctx.lineTo(x + ARW - 10, ay + o); ctx.lineTo(x + ARW - 24, ay + 12 + o); ctx.stroke(); }
        ctx.restore(); x += ARW;
      }
    });
  }
  // ------------------------------------------------------------------ the hand-written tag line
  const TAG_F = '400 60px CaveatBrush';
  function tagLine(ec, t) {
    const s = txt('tag') || 'Tague celui qui paie trop vite', k = cl(kk(t, A.tagLine, A.tagLine + 1.0)); if (k <= 0) return;
    const w = measure(s, TAG_F), x0 = G.cx - w / 2, y = G.end.tagY + 18, head = x0 - 6 + (w + 12) * k;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, y - 70, head - x0 + 20, 110); ctx.clip();
    ctx.save(); ctx.shadowColor = 'rgba(4,2,12,.85)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    text(s, x0, y, { font: TAG_F, color: CREAM }); ctx.restore();
    ctx.restore();
    if (k < 1) {                                                     // the chalk nib, glowing amber at the writing head
      const g = ctx.createRadialGradient(head, y - 18, 0, head, y - 18, 22); g.addColorStop(0, 'rgba(255,240,210,.95)'); g.addColorStop(.3, 'rgba(243,167,69,.5)'); g.addColorStop(1, 'rgba(243,167,69,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(head - 22, y - 40, 44, 44); ctx.restore();
    }
    // an amber swash under « trop vite » once written
    const sk = eOut(kk(t, A.tagLine + 1.0, A.tagLine + 1.35)); if (sk <= 0) return;
    const i0 = s.indexOf('trop'), xa = x0 + measure(s.slice(0, i0), TAG_F), xb = x0 + w;
    ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(4,2,12,.7)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); const n = 24; for (let i = 0; i <= n * sk; i++) { const u = i / n, x = lerpv(xa - 4, xb + 6, u), yy = y + 16 + 5 * Math.sin(u * Math.PI) - 4 * u; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke();
    ctx.restore();
  }

  function screenPart(ec, t, L) {
    const live = 1 - gust(t); if (live <= 0) return;
    // the scrim (behind the stamp, the CTA and the tag line: the wax stays visible through it)
    ctx.save(); ctx.globalAlpha *= ec.k * live; blit(scrim(), G.cx, 640); ctx.restore();
    blown(t, G.end.logoY, () => lockup(ec, t));
    if (ec.service > 0) blown(t, G.end.serviceY, () => { ctx.save(); ctx.globalAlpha *= ec.service; serviceLine(txt('serviceEnd') || 'Cargo Chine → Douala · mer ou air', G.cx, G.end.serviceY + 15 + 14 * (1 - ec.service), LILAC); ctx.restore(); });
    // the ritual stamp (night print)
    if (ec.stamp > 0) blown(t, G.end.stampY, () => {
      BZ_ritualStamp(G.cx, G.end.stampY, ec.stamp, { night: true, since: t - A.stampEnd });
      const d = t - A.stampEnd;                                      // ink spit at the impact
      if (d >= 0 && d < .5) {
        const q = d / .5, e = eOut(q);
        ctx.save(); ctx.fillStyle = ORANGE; ctx.globalAlpha *= (1 - q) * .9;
        for (let i = 0; i < 14; i++) { const a = rnd(i * 3.7 + 1) * TAU, r0 = 300 + 40 * rnd(i * 1.3), r = r0 + 110 * e * (.6 + .4 * rnd(i * 5.1));
          ctx.beginPath(); ctx.arc(G.cx + Math.cos(a) * r, G.end.stampY + Math.sin(a) * r * .42, 3 + 4 * rnd(i * 2.2) * (1 - q * .5), 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    });
    // the CTA pill + the hand-drawn arrow ↓ hanging from « commentaire »
    if (ec.cta > 0) blown(t, G.end.ctaY, () => {
      const word = ((txt('cta') || '').match(/Écris (.+?) en commentaire/) || [0, 'ALLÔ'])[1];
      const geo = BZ_ctaPill(G.cx, G.end.ctaY, word, { k: ec.cta, since: t - A.cta, t });
      const ak = kk(t, A.cta + .2, A.cta + .55);
      if (ak > 0 && geo) {
        const ax = geo.x1 - 34, ay = G.end.ctaY + geo.h / 2 + 10 + 5 * Math.sin((t - A.cta - .55) * 7.5) * kk(t, A.cta + .55, A.cta + .9);
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const k1 = cl(ak / .65), k2 = cl((ak - .6) / .4), Lh = 58;
        for (const [c, o, w] of [['rgba(4,2,12,.6)', 3, 12], [ORANGE, 0, 10]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(ax - 8 + o * .5, ay + o); ctx.bezierCurveTo(ax + 8, ay + Lh * .35 * k1 + o, ax - 6, ay + Lh * .7 * k1 + o, ax + 4 + o * .5, ay + Lh * k1 + o); ctx.stroke();
          if (k2 > 0) { ctx.beginPath(); ctx.moveTo(ax - 17 + o * .5, ay + Lh - 22 + 16 * (1 - k2) + o); ctx.lineTo(ax + 4 + o * .5, ay + Lh + 2 + o); ctx.lineTo(ax + 4 + 19 * k2 + o * .5, ay + Lh - 20 + 16 * (1 - k2) + o); ctx.stroke(); }
        }
        ctx.restore();
      }
    });
    if (ec.tag > 0) blown(t, G.end.tagY, () => tagLine(ec, t));
  }

  // ------------------------------------------------------------------ the loop's violet trail (world)
  function trail(t, L) {
    if (t < A.loop0 || t > T.end) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) {
      const te = A.loop0 + .02 + i * .017; if (te > t) break;
      const age = t - te, life = .32 + .12 * rnd(i * 2.9); if (age > life) continue;
      const P = S.parcel(te); if (!P || !P.vis) continue;
      const fc = S.parcelFace ? S.parcelFace(P) : { x0: P.x - 60, y0: P.y - 40, w: 120, h: 70 };
      const u = rnd(i * 4.3 + 1), v = rnd(i * 7.1 + 2), q = age / life;
      const x = fc.x0 + fc.w * u + (rnd(i * 3.3) - .5) * 60 * age, y = fc.y0 + fc.h * v + 70 * age * age * 8 - P.z;
      const r = (6 + 9 * rnd(i * 5.5)) * (1 - q) * (.6 + P.s / 2.5), a = (1 - q) * .9 * (1 - kk(t, T.end - .1, T.end - .04));
      if (r < .5 || a <= 0) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, `rgba(240,232,255,${a.toFixed(3)})`); g.addColorStop(.3, `rgba(160,120,255,${(a * .5).toFixed(3)})`); g.addColorStop(1, 'rgba(123,75,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }

  window.BZ_end = (ec, t, L, space) => { if (!ec) return; space === 'world' ? trail(t, L) : screenPart(ec, t, L); };
})();

// =============================================================================================
// REUSABLE IN THE 5 EPISODES (from episode 1's 70_bonzini.js, « copy as is »; kit.js only).
// =============================================================================================
/** « MAINTENANT, TU SAIS. » — the series' ritual stamp. Orange rubber stamp, two lines (« MAINTENANT, » / « TU SAIS. »,
 *  Big Shoulders Stencil 112 px), double border, starved ink, printed in multiply. ≈ 690 × 262 px: centred on x = 540 it
 *  stays inside x 195…885 (clear of the right-hand UI band). (x, y) = centre in the current transform; k = landing 0..1
 *  (the rubber comes down: 1.5 → 1, ink appears); o = {alpha, since (s since the impact: ink spread), rot, color,
 *  night (ep. 4: normal blending over a soft dark seat — multiply vanishes on a night background)}. */
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
  if (o.night) {
    const seat = BZ_ritualStamp.seat || (BZ_ritualStamp.seat = (() => {       // a soft dark seat (baked once)
      const W2 = sp.w + 120, H2 = sp.h + 120, c = makeCanvas(W2, H2), g = c.getContext('2d');
      g.shadowColor = 'rgba(10,5,22,.8)'; g.shadowBlur = 34; g.shadowOffsetX = 20000; g.fillStyle = '#000';
      g.beginPath(); g.roundRect(60 - 20000, 60, sp.w, sp.h, 30); g.fill(); return c;
    })());
    ctx.drawImage(seat, -sp.w / 2 - 60, -sp.h / 2 - 60);
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  } else { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); }
  ctx.restore();
}
/** the series' CTA pill « Écris [WORD] en commentaire »: amber pill with thickness, the keyword typed in a cream field
 *  (orange stencil + a 1 Hz cursor). Width ≈ 820 px for a 5-letter word (x 130…950 centred on 540). (x, y) = centre;
 *  o = {k (0..1 appear), since (s since it appeared: one bounce), t (seconds, for the cursor)}. Returns {x0, x1, h}. */
function BZ_ctaPill(x, y, word, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return null;
  const C2 = BZ_ctaPill.cache || (BZ_ctaPill.cache = {});
  let sp = C2[word];
  if (!sp) {
    // QA (ep. 4): the keyword in Big Shoulders Stencil read « AI.I.Ô » (the stencil L is a stem + a detached foot): the
    // word people must type is set in Satoshi Black instead (TCHAC / CBM in eps 1–2 were stencil-safe letters).
    const fA = '900 50px Satoshi', fK = /L/.test(word) ? '900 60px Satoshi' : '900 66px Stencil', kLs = /L/.test(word) ? 1 : 3, wE = measure('Écris', fA), wC = measure('en commentaire', fA), wK = measure(word, fK, kLs) + 72;
    const gap = 18, pad = 34, w = Math.ceil(wE + gap + wK + gap + wC + 2 * pad), h = 104, sc = 2;
    const c = makeCanvas((w + 80) * sc, (h + 90) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 80) / 2, (h + 90) / 2 - 12);
      g.save(); g.shadowColor = 'rgba(60,24,40,.34)'; g.shadowBlur = 22 * sc; g.shadowOffsetY = 12 * sc;
      g.fillStyle = '#B86F1A'; rrect(-w / 2, -h / 2 + 8, w, h, h / 2); g.fill(); g.restore();                     // thickness + soft shadow
      const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#FAC06A'); pg.addColorStop(1, '#EE9A30');
      g.fillStyle = pg; rrect(-w / 2, -h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2.5; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, h / 2 - 4); g.stroke();
      let cx = -w / 2 + pad;
      text('Écris', cx, 18, { font: fA, color: '#231629' }); cx += wE + gap;
      g.fillStyle = 'rgba(120,60,0,.28)'; rrect(cx, -36 + 3, wK, 76, 16); g.fill();
      g.fillStyle = '#FFF8EC'; rrect(cx, -38, wK, 76, 16); g.fill();
      text(word, cx + 20, kLs === 1 ? 22 : 24, { font: fK, color: '#FE560D', ls: kLs });
      sp = { cursor: cx + wK - 24 }; cx += wK + gap;
      text('en commentaire', cx, 18, { font: fA, color: '#231629' });
    } finally { ctx = prev; }
    sp = C2[word] = { c, w: w + 80, h: h + 90, pw: w, ph: h, cursor: sp.cursor };
  }
  const d = o.since ?? 1, e = 1 - Math.pow(1 - Math.min(1, k), 3);
  const s = e * (1 + .13 * Math.exp(-Math.max(0, d) * 6) * Math.sin(Math.max(0, d) * 16));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.012); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2); ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2 + 12, sp.w, sp.h); ctx.restore();
  const tt = o.t ?? 0;
  if (Math.floor(tt * 2) % 2 === 0) { ctx.fillStyle = '#FE560D'; ctx.globalAlpha *= Math.min(1, k * 2); ctx.fillRect(sp.cursor, -22, 4, 44); }
  ctx.restore();
  return { x0: x - sp.pw / 2, x1: x + sp.pw / 2, h: sp.ph };
}
