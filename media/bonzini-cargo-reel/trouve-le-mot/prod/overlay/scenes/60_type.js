'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — TYPE (from serie/ep2 60_type.js, re-cut for real footage: no multiply stamps on kraft, every text
// over video carries a soft dark shadow; the subtitles and the CTA sit in solid boxes).
//   TY_draw(t, n)        screen space, called by 50_compose.js after the rush, the ring and the card:
//                        the mention « VRAIE VIDÉO · EN CHINE » / « VRAIE IMAGE · ZOOM × 4 », the title plate
//                        « TROUVE LE MOT » / « BONZINI » (+ « écrit sur un colis »), the « vraie voix » subtitles, the STOP
//                        stamp, « TU L'AS VU ? », the answer block « LE MOT BONZINI / ÉTAIT LÀ / DÈS LE DÉBUT ! »,
//                        « écrit à la main », the CTA pill « Réponds-lui en commentaire : » / « BONSOIR ↓ » (drawn arrow).
//   TY_wordBox(id)       screen box {x, y, w, h} (cap height) of a word of a static layout: 'BONZINI' (answer block, line 1)
//                        and 'TITLE_BONZINI' (title plate) — for the violet arrow of 30_ring.js.
// Every string comes from SCORE.TEXTS() = [t0, t1, id, text, style, takeover, opt]; when window[takeover] exists the module
// draws it and this layer skips it (card texts → BZ_card, « secondes » → CH_chrono). '|' = line break, *…* = emphasis.
// Sizes / positions = STORYBOARD §2 (SCORE.G). Safe zones: nothing above y 150, no text right of x 960 for y 900–1560,
// nothing important below y 1540.
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, A = S.A, kk = S.kk, ease = S.ease, easeOut = S.easeOut, easeIn = S.easeIn, backOut = S.backOut, COL = S.COL;
  const has = n => typeof window[n] === 'function';
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;
  const SHADOW = 'rgba(6,2,12,.62)';
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(fi > 0 ? easeOut(kk(t, a, a + fi)) : 1, fo > 0 ? 1 - kk(t, b - fo, b) : 1);
  const segs = l => l.split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  const wOf = (s, f, ls = 0) => { ctx.save(); ctx.font = f; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; };
  /** text with a soft dark shadow (video), optional dark outline under the fill */
  function vtext(s, x, y, f, color, o = {}) {
    ctx.save(); ctx.font = f; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = (o.ls || 0) + 'px';
    if (o.outline) {
      ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = o.outline; ctx.lineWidth = o.outlineW || 12;
      ctx.shadowColor = SHADOW; ctx.shadowBlur = o.blur ?? 22; ctx.shadowOffsetY = 5; ctx.strokeText(s, x, y); ctx.shadowColor = 'transparent';
    } else if (o.shadow !== false) { ctx.shadowColor = SHADOW; ctx.shadowBlur = o.blur ?? 18; ctx.shadowOffsetY = 4; }
    ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
  }
  /** a rich line centred on x: segments split on *…*; emphasis = {color, font, outline} */
  function richW(l, f, fe) { let w = 0; for (const q of segs(l)) w += wOf(q.s, q.e ? fe : f); return w; }
  function richLine(l, x, y, f, col, fe, ecol, o = {}) {
    let cx = x - richW(l, f, fe) / 2; const boxes = [];
    for (const q of segs(l)) {
      const ff = q.e ? fe : f, w = wOf(q.s, ff);
      vtext(q.s, cx, y, ff, q.e ? ecol : col, { align: 'left', outline: q.e ? o.eOutline : o.outline, outlineW: o.outlineW, shadow: o.shadow, blur: o.blur });
      if (q.e) boxes.push({ s: q.s, x: cx, w }); cx += w;
    }
    return boxes;
  }
  const fitSize = (lines, size, maxW, min, f) => { let z = size; for (const l of lines) { const w = wOf(l.replace(/\*/g, ''), f(size)); if (w > maxW) z = Math.min(z, size * maxW / w); } return Math.max(min, Math.floor(z)); };

  // ---------- the mention (provenance, top-left) ----------
  function mention(t, a, b, s, id) {
    const fi = (a <= 0 || Math.abs(a - A.cta) < 1e-6) ? 0 : .12, fo = b > T.end ? 0 : .12;      // hard cuts: no fade
    const al = inOut(t, a, b, fi, fo); if (al <= 0) return;
    const M = G.mention, f = SAT(M.size, 700), h = M.y1 - M.y0, tw = wOf(s, f, 1), dot = 30, w = tw + dot + 44;
    ctx.save(); ctx.globalAlpha *= al;
    ctx.fillStyle = 'rgba(0,0,0,.60)'; rrect(M.x, M.y0, w, h, 12); ctx.fill();
    ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(M.x + 26, M.y0 + h / 2, 8, 0, 7); ctx.fill();          // « real footage » dot
    ctx.font = f; ctx.letterSpacing = '1px'; ctx.fillStyle = COL.white; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(s, M.x + 22 + dot, M.y0 + h / 2 + 2); ctx.restore();
  }

  // ---------- the title plate ----------
  /** the plate leaves upward in .2 s, fast from the first frame (the STOP stamp lands at y 700–860 in the same frames) */
  function titleExit(t) { return { a: 1 - easeOut(kk(t, A.stop, A.stop + .12)), dy: -260 * easeOut(kk(t, A.stop, A.stop + .2)) }; }
  function title(t, a, b, s, st) {
    const ex = titleExit(t); if (ex.a <= 0) return;
    ctx.save(); ctx.globalAlpha *= ex.a; ctx.translate(0, ex.dy);
    if (st === 'title1') { const L = G.title.l1; vtext(s, G.cx, L.y1 - 12, SAT(fitSize([s], L.size, 900, 80, z => SAT(z))), COL.white, { ls: 2 }); }
    if (st === 'title2') { const L = G.title.l2; vtext(s, G.cx, L.y1 - 18, SAT(L.size), COL.violet, { ls: 4, outline: COL.outline, outlineW: 14 }); }
    if (st === 'title3') {
      const L = G.title.l3, k = easeOut(kk(t, a, a + .35)), f = SAT(L.size, 700), w = wOf(s, f);
      ctx.beginPath(); ctx.rect(G.cx - w / 2 - 20, L.y0 - 20, (w + 40) * k, L.y1 - L.y0 + 50); ctx.clip();
      vtext(s, G.cx, L.y1 - 18, f, COL.white);
    }
    ctx.restore();
  }

  // ---------- « vraie voix » subtitles ----------
  function wave(x, y, t, voice) {
    const R = S.REAL[voice], on = R && t >= R.speech[0] && t < R.speech[1] ? 1 : 0;
    ctx.save(); ctx.fillStyle = COL.grey;
    for (let i = 0; i < 4; i++) {
      const h = 8 + 22 * (on ? .35 + .65 * Math.abs(Math.sin(t * (13 + 3 * i) + i * 1.9)) : .25 + .15 * (i % 2));
      rrect(x + i * 11, y - h / 2, 6, h, 3); ctx.fill();
    }
    ctx.restore();
  }
  function subtitle(t, a, b, s, opt) {
    const fo = b > T.end ? 0 : .15, al = inOut(t, a, b, .15, fo); if (al <= 0) return;
    const B = opt.box, rise = (1 - easeOut(kk(t, a, a + .18))) * 18, lines = s.split('|');
    const maxW = (B.x1 - B.x0) - 60, z = fitSize(lines, G.sub.line, maxW, 52, q => SAT(q));
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(0, rise);
    ctx.shadowColor = 'rgba(0,0,0,.40)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(255,255,255,.97)'; rrect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 26); ctx.fill(); ctx.shadowColor = 'transparent';
    const bx = (B.x0 + B.x1) / 2;                                    // the box's own centre (x 80–940 → 510: clear of the right zone)
    const hf = SAT(G.sub.head, 700), hw = wOf(opt.head, hf), hx = bx - (hw + 58) / 2;
    wave(hx, B.y0 + 35, t, opt.voice);
    ctx.font = hf; ctx.fillStyle = COL.grey; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(opt.head, hx + 58, B.y0 + 50);
    const top = B.y0 + 62, bot = B.y1 - 10, mid = (top + bot) / 2, lh = z * 1.16;
    lines.forEach((l, i) => richLine(l, bx, mid - (lines.length - 1) * lh / 2 + i * lh + z * .345, SAT(z), COL.ink, SAT(z), COL.violetD, { shadow: false }));
    ctx.restore();
  }

  // ---------- STOP stamp (starved orange ink, normal blending on video) ----------
  function stampSprite(s, size, color) {
    const c = makeCanvasCached('ty_stop_' + size, 1000, Math.round(size * 1.9)), g = c.getContext('2d');
    if (!c._done) {
      g.font = SAT(size); const tw = g.measureText(s).width, bw = tw + 90, bh = size * 1.12, x0 = (1000 - bw) / 2, y0 = (c.height - bh) / 2;
      g.strokeStyle = color; g.lineWidth = Math.max(8, size * .085); rrectOn(g, x0, y0, bw, bh, 18); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 500, c.height / 2 + size * .05);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1100; i++) { g.globalAlpha = .25 + rnd(i * 1.7 + size) * .6; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .6 + rnd(i * 3.3) * 2.6, 0, 7); g.fill(); }
      c._done = true;
    }
    return c;
  }
  function stop(t, a, b, s) {
    const k = kk(t, a, a + .09), p = kk(t, A.stopPeel, A.stopPeel + .14); if (k <= 0 || p >= 1) return;
    const St = G.stop, c = stampSprite(s, St.size, COL.orange), sc = (1.7 - .7 * easeOut(k)) * (1 + .18 * p);
    ctx.save(); ctx.translate(St.cx, (St.y0 + St.y1) / 2 - 30 * p); ctx.rotate(St.rot - .08 * p); ctx.scale(sc, sc);
    ctx.globalAlpha *= Math.min(1, k * 2) * (1 - p);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.drawImage(c, -500, -c.height / 2); ctx.restore();
  }

  // ---------- « TU L'AS VU ? » ----------
  function question(t, a, b, s) {
    const al = inOut(t, a, b, .1, .12); if (al <= 0) return;
    const Q = G.question, sc = 1.25 - .25 * easeOut(kk(t, a, a + .14));
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(G.cx, Q.y1 - 20); ctx.scale(sc, sc);
    vtext(s, 0, 0, SAT(fitSize([s], Q.size, 960, 80, z => SAT(z))), COL.white, { ls: 2 }); ctx.restore();
  }

  // ---------- the answer block ----------
  function answerLayout() {
    const An = G.answer, lines = ['LE MOT *BONZINI*', 'ÉTAIT LÀ', `DÈS LE DÉBUT !`];
    const txt = S.TEXTS().find(q => q[2] === 'answer'); const L = txt ? txt[3].split('|') : lines;
    let z = An.size, zb = An.sizeBZ; const w0 = richW(L[0], SAT(z), SAT(zb));
    const wMax = Math.max(w0, ...L.slice(1).map(l => richW(l, SAT(z), SAT(zb))));
    if (wMax > An.maxW) { const q = An.maxW / wMax; z = Math.floor(z * q); zb = Math.floor(zb * q); }
    const base = [An.y0 + zb * .93, An.y0 + zb * .93 + z * 1.06, An.y0 + zb * .93 + z * 2.12];
    return { L, z, zb, base };
  }
  function answer(t, a, b) {
    const Lo = answerLayout(), out = kk(t, A.out, A.out + .2); if (out >= 1) return;
    Lo.L.forEach((l, i) => {
      const k = easeOut(kk(t, a + i * .08, a + i * .08 + .2)); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha *= k * (1 - out); ctx.translate(0, (1 - k) * 28);
      richLine(l, G.cx, Lo.base[i], SAT(Lo.z), COL.white, SAT(Lo.zb), COL.violet, { eOutline: COL.outline, outlineW: 12 });
      ctx.restore();
    });
  }
  function hand(t, a, b, s) {
    const H_ = G.hand, k = easeOut(kk(t, a, a + .25)), out = kk(t, A.out, A.out + .2), al = k * (1 - out); if (al <= 0) return;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(0, (1 - k) * 16);
    vtext(s, G.cx, H_.y1 - 16, `700 ${H_.size}px Shantell`, COL.white, { blur: 20 }); ctx.restore();
  }

  // ---------- CTA pill ----------
  function cta(t, a, b, s) {
    const P = G.pill, k = kk(t, a, a + .32); if (k <= 0) return;
    const sc = .6 + .4 * backOut(k, 2.2), al = Math.min(1, k * 4), [l1, l2] = s.split('|'), w = P.x1 - P.x0, h = P.y1 - P.y0, cy = (P.y0 + P.y1) / 2, cx = (P.x0 + P.x1) / 2;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    ctx.fillStyle = COL.amber; rrect(P.x0, P.y0, w, h, 52); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = COL.ink;
    const f1 = SAT(fitSize([l1], P.size1, w - 80, 40, q => SAT(q, 700)), 700); ctx.font = f1; ctx.fillText(l1, cx, P.y0 + 60);
    const word = l2.replace(/\*/g, ''), f2 = SAT(P.size2), ww = wOf(word, f2, 3), aw = 56, x0 = cx - (ww + 24 + aw) / 2;
    ctx.font = f2; ctx.letterSpacing = '3px'; ctx.textAlign = 'left'; ctx.fillText(word, x0, P.y1 - 24); ctx.letterSpacing = '0px';
    // the drawn arrow ↓ (felt stroke, drawn on, then a bounce)
    const d = easeOut(kk(t, a + .15, a + .45)), bob = 7 * Math.sin((t - a) * 7) * kk(t, a + .45, a + .7), ax = x0 + ww + 24 + aw / 2, ay0 = P.y0 + 84 + bob, ay1 = P.y1 - 26 + bob;
    if (d > 0) {
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const ye = ay0 + (ay1 - ay0) * Math.min(1, d / .7);
      ctx.beginPath(); ctx.moveTo(ax - 2, ay0); ctx.bezierCurveTo(ax + 8, ay0 + (ye - ay0) * .35, ax - 8, ay0 + (ye - ay0) * .65, ax, ye); ctx.stroke();
      const hk = kk(d, .7, 1); if (hk > 0) { ctx.beginPath(); ctx.moveTo(ax - 20 * hk, ay1 - 20 * hk); ctx.lineTo(ax, ay1); ctx.lineTo(ax + 20 * hk, ay1 - 20 * hk); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- dispatch ----------
  function draw(t, n) {
    for (const [a, b, id, s, st, own, opt] of S.TEXTS()) {
      if (!(t >= a && t < b) || (own && has(own))) continue;
      if (st === 'mention') mention(t, a, b, s, id);
      else if (st === 'title1' || st === 'title2' || st === 'title3') title(t, a, b, s, st);
      else if (st === 'sub') subtitle(t, a, b, s, opt);
      else if (st === 'stop') stop(t, a, b, s);
      else if (st === 'question') question(t, a, b, s);
      else if (st === 'answer') answer(t, a, b, s);
      else if (st === 'hand') hand(t, a, b, s);
      else if (st === 'cta') cta(t, a, b, s);
      // 'card' (BZ_card) and 'chrono' (CH_chrono) texts: their module, or the stand-ins of 50_compose.js
    }
  }
  /** static boxes of key words (cap height), for the arrow of 30_ring.js */
  function wordBox(id) {
    if (id === 'BONZINI') {
      const Lo = answerLayout(), l = Lo.L[0], f = SAT(Lo.z), fe = SAT(Lo.zb); let cx = G.cx - richW(l, f, fe) / 2;
      for (const q of segs(l)) { const w = wOf(q.s, q.e ? fe : f); if (q.e) return { x: cx, y: Lo.base[0] - Lo.zb * .72, w, h: Lo.zb * .72, base: Lo.base[0] }; cx += w; }
    }
    if (id === 'TITLE_BONZINI') { const L = G.title.l2, w = wOf('BONZINI', SAT(L.size), 4); return { x: G.cx - w / 2, y: L.y1 - 18 - L.size * .72, w, h: L.size * .72, base: L.y1 - 18 }; }
    return null;
  }
  return { draw, wordBox, vtext, richLine, stampSprite, answerLayout };
})();
function TY_draw(t, n) { TY.draw(t, n); }
function TY_wordBox(id) { return TY.wordBox(id); }
