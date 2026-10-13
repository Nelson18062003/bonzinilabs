'use strict';
// =============================================================================================
// 50_compose.js — the draw order of every frame (each motion-blur sub-sample) of film 1 / film 2 (MODULES.md):
//   1  UNDER the footage   MP_under(t, n)   (40_map.js)     the map of block B (behind the two live cards)
//                          DX_under(t, n)   (20_duplex.js)  the night background of the signature (behind the panel window)
//                          + layers z < 0 (window.LAYERS)
//   2  FT_draw(t, n)       05_footage.js    the EDL: duplex windows, cards, panel, hide boxes (blurs are baked), grade
//   3  layers 0 ≤ z < 60
//   4  DX_draw(t, n)       20_duplex.js     (4–5 inside the stamps' screen push + shake: SCORE.screenFx) band-route, parcel, pills, logo + « VRAIES IMAGES », band texts, real-voice
//                                           subtitles, stamps, signature (sub box, violet plate, amber pill)
//   5  MP_draw(t, n)       40_map.js        pins, labels, route, parcels, rings, card links, the B text block, MERCI flight
//   6  TY_draw(t, n)       60_type.js       (nothing in this film: every SCORE.TEXTS() row is taken over by a module)
//   7  layers z ≥ 60
//   (grain: window.COMPOSE_GRAIN(n), once per frame after the motion-blur accumulation)
// A module that is not loaded yet is replaced by the STAND-IN below (plain geometry from the score's states, so the film
// renders and the framing can be judged); window.COMPOSE_FB.{duplexUnder, duplex, mapUnder, map} expose them.
// Pure functions of t; no Math.random, no ctx.filter.
// =============================================================================================
window.LAYERS = window.LAYERS || [];
(function () {
  const S = window.SCORE, COL = S.COL, G = S.G, kk = S.kk, cl = S.cl, lerp = S.lerp, easeOut = S.easeOut;
  const has = n => typeof window[n] === 'function';
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`, MONO = z => `400 ${z}px Martian`;
  const C = k => COL[k] || k;
  function layers() {
    const own = typeof S.LAYERS === 'function' ? S.LAYERS() : (S.LAYERS || []);
    return [...own, ...window.LAYERS].map((l, i) => ({ l, i })).sort((a, b) => ((a.l.z || 0) - (b.l.z || 0)) || (a.i - b.i)).map(q => q.l);
  }
  const live = (l, t) => (l.t0 === undefined || t >= l.t0) && (l.t1 === undefined || t < l.t1);
  const wOf = (s, f) => { ctx.save(); ctx.font = f; const w = ctx.measureText(s).width; ctx.restore(); return w; };

  // =====================================================================================================================
  // STAND-INS (replaced by 20_duplex.js / 40_map.js)
  // =====================================================================================================================
  function duplexUnder(t, n) {
    const sg = S.signature(t); if (!sg || !sg.background.on) return;
    ctx.fillStyle = COL.night; ctx.fillRect(0, 0, G.W, G.H);
  }
  function flagCN(x, y, w, h) { ctx.fillStyle = '#DE2910'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#FFDE00'; ctx.beginPath(); ctx.arc(x + w * .2, y + h * .3, h * .17, 0, 7); ctx.fill();
    for (const [u, v] of [[.38, .12], [.45, .25], [.45, .45], [.38, .58]]) { ctx.beginPath(); ctx.arc(x + w * u, y + h * v, h * .05, 0, 7); ctx.fill(); } }
  function flagCM(x, y, w, h) { const c = ['#007A5E', '#CE1126', '#FCD116']; c.forEach((k, i) => { ctx.fillStyle = k; ctx.fillRect(x + i * w / 3, y, w / 3 + .5, h); });
    ctx.fillStyle = '#FCD116'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * .14, 0, 7); ctx.fill(); }
  function pill(p) {
    if (!p || p.a <= 0) return;
    const f = SAT(40), tw = wOf(p.text, f), w = 24 + 54 + 14 + tw + 26, h = p.y1 - p.y0;
    ctx.save(); ctx.globalAlpha *= p.a; ctx.translate(0, p.dy || 0);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.fillStyle = C(p.color); rrect(p.x, p.y0, w, h, 30); ctx.fill(); ctx.shadowColor = 'transparent';
    (p.flag === 'CN' ? flagCN : flagCM)(p.x + 20, p.y0 + (h - 36) / 2, 54, 36);
    ctx.font = f; ctx.fillStyle = p.textColor; ctx.textBaseline = 'middle'; ctx.fillText(p.text, p.x + 24 + 54 + 14, p.y0 + h / 2 + 2);
    ctx.restore();
  }
  function bandRoute(t) {
    const b = S.band(t); if (b.a <= 0 || b.y0 >= G.H) return;
    ctx.save(); ctx.globalAlpha *= b.a;
    ctx.fillStyle = 'rgba(16,20,43,.92)'; ctx.fillRect(0, b.y0, G.W, G.band.h);
    const gr = ctx.createLinearGradient(0, 0, G.W, 0); gr.addColorStop(0, COL.amber); gr.addColorStop(1, COL.orange);
    ctx.strokeStyle = gr; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(0, b.y0 + 2); ctx.lineTo(G.W, b.y0 + 2); ctx.stroke(); ctx.setLineDash([]);
    const pg = S.progress(t);                                 // the drawn parcel = progress
    ctx.fillStyle = COL.kraft; rrect(pg.x - 14, pg.y - 22, 28, 22, 3); ctx.fill(); ctx.fillStyle = COL.amber; ctx.fillRect(pg.x - 3, pg.y - 22, 6, 22);
    ctx.restore();
  }
  function bandTexts(t) {
    for (const x of S.texts(t)) {
      if (x.a <= 0) continue;
      const f = SAT(x.size); ctx.save(); ctx.font = f; ctx.textBaseline = 'alphabetic';
      x.lines.forEach((line, i) => {
        let xx = x.x; const y = x.y0 + (i + 1) * x.lead - 14 + x.dy;
        ctx.globalAlpha = x.a * (x.alpha[i] ?? 1);
        for (const w of line) {
          const x0 = xx;
          for (const sg of w.segs) { ctx.fillStyle = C(sg.color); ctx.fillText(sg.s, xx, y); xx += wOf(sg.s, f); }
          if (x.underline && x.underline.line === i && x.underline.word.split(' ').includes(w.w.replace(/[^A-ZÀ-Ü]/g, '')) && x.underline.p > 0) {
            ctx.strokeStyle = C(x.underline.color); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y + 14); ctx.lineTo(x0 + (xx - x0) * x.underline.p, y + 12); ctx.stroke();
          }
          xx += wOf(' ', f);
        }
      });
      ctx.restore();
    }
  }
  function subtitle(t) {
    const s = S.subtitles(t); if (!s || s.a <= 0) return;
    const B = s.box; ctx.save(); ctx.globalAlpha *= s.a;
    if (s.mode === 'box') { ctx.fillStyle = 'rgba(16,20,43,.88)'; rrect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 20); ctx.fill(); }
    const X = B.x0 + (s.mode === 'box' ? 28 : 0) + (s.mode === 'box' ? 0 : 64 - B.x0);
    ctx.font = MONO(30); ctx.fillStyle = COL.grey; ctx.textBaseline = 'top'; ctx.fillText(s.head, X, B.y0 + G.sub.headDy);
    ctx.textBaseline = 'alphabetic';
    s.lines.forEach((line, i) => {
      let xx = X; const y = B.y0 + (i === 0 ? G.sub.line1Dy : G.sub.line2Dy) + 18;
      for (const w of line) {
        const f = SAT(54, w.state === 'current' ? 900 : 700); ctx.font = f;
        ctx.globalAlpha = s.a * (w.state === 'coming' ? .45 : w.state === 'current' ? 1 : .75);
        ctx.fillStyle = w.color === 'white' ? COL.white : C(w.color); ctx.fillText(w.w, xx, y); xx += wOf(w.w + ' ', f);
      }
    });
    ctx.restore();
  }
  function stampsSI(t) {
    for (const st of S.stamps(t)) {
      if (st.a <= 0) continue;
      const k = kk(st.age, 0, 4 / 30), sc = st.scale * (1.6 - .6 * easeOut(k));
      ctx.save(); ctx.globalAlpha *= st.a * Math.min(1, k * 3); ctx.translate(st.cx, st.cy); ctx.rotate(st.rot * Math.PI / 180); ctx.scale(sc, sc);
      const f = SAT(st.size), lh = st.size * .9, ws = st.lines.map(l => wOf(l, f)), bw = Math.max(...ws) + 60, bh = lh * st.lines.length + 40;
      ctx.strokeStyle = C(st.color); ctx.lineWidth = 8; rrect(-bw / 2, -bh / 2, bw, bh, 14); ctx.stroke();
      ctx.lineWidth = 3; rrect(-bw / 2 + 14, -bh / 2 + 14, bw - 28, bh - 28, 10); ctx.stroke();
      ctx.font = f; ctx.fillStyle = C(st.color); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      st.lines.forEach((l, i) => ctx.fillText(l, 0, (i - (st.lines.length - 1) / 2) * lh + st.size * .04));
      ctx.restore();
    }
  }
  function logoSI(t) {
    const L = S.logo(t); ctx.save();
    ctx.fillStyle = '#FFFFFF'; rrect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0, 32); ctx.fill();
    if (LOGO && LOGO.length) drawLogo((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, 52);
    ctx.font = MONO(30); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(L.text, L.textX1, L.textY0); ctx.restore();
  }
  function signatureSI(t) {
    const sg = S.signature(t); if (!sg) return;
    if (sg.plate.a > 0) {
      const P = sg.plate, dy = (1 - P.drop) * -260; ctx.save(); ctx.translate(0, dy);
      const g = ctx.createLinearGradient(0, P.y0, 0, P.y1); g.addColorStop(0, COL.violet); g.addColorStop(1, COL.violetD);
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.fillStyle = g; rrect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 22); ctx.fill(); ctx.shadowColor = 'transparent';
      if (LOGO && LOGO.length) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(160, (P.y0 + P.y1) / 2, 44, 0, 7); ctx.fill(); drawLogo(160, (P.y0 + P.y1) / 2, 70); }
      ctx.fillStyle = '#FFFFFF'; ctx.font = SAT(50); ctx.textBaseline = 'alphabetic'; ctx.fillText(P.line1, 220, P.y0 + 80);
      ctx.globalAlpha = .9; ctx.font = SAT(40, 700); ctx.fillText(P.line2, 220, P.y0 + 140); ctx.restore();
    }
    if (sg.cta.a > 0) {
      const P = sg.cta, k = easeOut(P.p), sc = .6 + .4 * S.backOut(P.p, 2.2), cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2;
      ctx.save(); ctx.globalAlpha *= Math.min(1, k * 3); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      ctx.fillStyle = COL.amber; rrect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 56); ctx.fill();
      ctx.fillStyle = COL.ink; ctx.font = SAT(48, 700); ctx.textBaseline = 'alphabetic'; ctx.fillText(P.line1, P.x0 + 46, P.y0 + 76);
      ctx.font = SAT(88); ctx.fillText(P.line2.replace(/\*/g, ''), P.x0 + 46, P.y1 - 40);
      const bob = 8 * Math.sin((t - P.t0) * 2 * Math.PI * 2), ax = (P.arrowX0 + P.arrowX1) / 2;
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, P.y0 + 110 + bob); ctx.lineTo(ax, P.y1 - 40 + bob);
      ctx.moveTo(ax - 22, P.y1 - 62 + bob); ctx.lineTo(ax, P.y1 - 40 + bob); ctx.lineTo(ax + 22, P.y1 - 62 + bob); ctx.stroke(); ctx.restore();
    }
  }
  function duplex(t, n) {
    bandRoute(t); bandTexts(t); subtitle(t);
    const p = S.pills(t); pill(p.G); pill(p.D);
    stampsSI(t); signatureSI(t); logoSI(t);
  }
  function mapUnder(t, n) {
    const M = S.map(t); if (!M || M.bg <= 0) return;
    ctx.save(); ctx.globalAlpha *= M.bg; ctx.fillStyle = COL.night; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = M.a;
    ctx.translate(M.pushC[0], M.pushC[1]); ctx.scale(M.push, M.push); ctx.translate(-M.pushC[0], -M.pushC[1]);
    ctx.strokeStyle = 'rgba(233,215,181,.12)'; ctx.lineWidth = 2;               // stand-in graticule (the module draws Natural Earth)
    for (let lon = -20; lon <= 140; lon += 20) { const [x] = M.geo(lon, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, G.H); ctx.stroke(); }
    for (let lat = -40; lat <= 60; lat += 20) { const [, y] = M.geo(0, lat); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(G.W, y); ctx.stroke(); }
    ctx.restore();
  }
  function map(t, n) {
    const M = S.map(t);
    if (M && M.a > 0) {
      ctx.save(); ctx.globalAlpha *= M.a;
      const R = M.route, p = M.route.p, bez = u => [(1 - u) * (1 - u) * R.p0[0] + 2 * (1 - u) * u * R.c[0] + u * u * R.p1[0], (1 - u) * (1 - u) * R.p0[1] + 2 * (1 - u) * u * R.c[1] + u * u * R.p1[1]];
      if (p > 0) { ctx.strokeStyle = COL.amber; ctx.lineWidth = 8; ctx.setLineDash([20, 14]); ctx.beginPath(); for (let u = 0; u <= p + 1e-6; u += .02) { const [x, y] = bez(Math.min(u, p)); u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]); }
      for (const f of M.flows) { if (f.arrived) continue; const [x, y] = bez(f.p); ctx.fillStyle = COL.kraft; rrect(x - 13, y - 10, 26, 20, 3); ctx.fill(); }
      for (const k of ['GZ', 'DLA']) { const P = M.pins[k]; if (P.a <= 0) continue; const y = P.y - P.fall * (1 - easeOut(P.p)); ctx.fillStyle = C(P.color); ctx.beginPath(); ctx.arc(P.x, y - 24, 16, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(P.x - 10, y - 18); ctx.lineTo(P.x, y); ctx.lineTo(P.x + 10, y - 18); ctx.fill(); }
      for (const k of ['GZ', 'DLA']) { const L = M.labels[k]; if (L.a <= 0) continue; ctx.save(); ctx.globalAlpha *= L.a; ctx.font = SAT(44); ctx.textAlign = L.align; ctx.textBaseline = 'top';
        ctx.lineWidth = 6; ctx.strokeStyle = COL.night; ctx.strokeText(L.text, L.align === 'right' ? L.x1 : L.x0, L.y0); ctx.fillStyle = C(L.color); ctx.fillText(L.text, L.align === 'right' ? L.x1 : L.x0, L.y0); ctx.restore(); }
      const B = M.block;
      if (B.out > 0) {
        ctx.save(); ctx.font = SAT(64); ctx.textBaseline = 'alphabetic';
        [B.line1, B.line2].forEach((L, i) => { if (L.a <= 0) return; ctx.globalAlpha = M.a * L.a * B.out; let x = B.x0; const y = B.y0 + 60 + i * 72 + L.dy;
          for (const w of B.lines[i]) { ctx.fillStyle = C(w.color); ctx.fillText(w.w, x, y); x += wOf(w.w + ' ', SAT(64)); }
          if (i === 1 && B.underline.p > 0) { ctx.strokeStyle = COL.orange; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(B.x0, y + 14); ctx.lineTo(B.x0 + wOf('Un autre', SAT(64)) * B.underline.p, y + 12); ctx.stroke(); } });
        ctx.restore();
      }
      ctx.restore();
    }
    const m = S.merci(t);
    if (m) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.scale, m.scale); ctx.font = SAT(m.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(243,167,69,.8)'; ctx.shadowBlur = 40; ctx.fillStyle = COL.amber; ctx.fillText('MERCI', 0, 0); ctx.restore(); }
  }
  window.COMPOSE_FB = { duplexUnder, duplex, mapUnder, map };

  registerScene({ id: 'compose', z: 10, draw(t, n) {
    window.__t = t;
    const L = layers();
    (has('MP_under') ? window.MP_under : mapUnder)(t, n);
    (has('DX_under') ? window.DX_under : duplexUnder)(t, n);
    for (const l of L) if ((l.z || 0) < 0 && live(l, t)) { ctx.save(); l.draw(ctx, t, n); ctx.restore(); }
    if (has('FT_draw')) FT_draw(t, n);
    for (const l of L) if ((l.z || 0) >= 0 && (l.z || 0) < 60 && live(l, t)) { ctx.save(); l.draw(ctx, t, n); ctx.restore(); }
    // the stamps' push ×1,03 + 10 px shake move the WHOLE screen (§3.6): the footage gets it through its EDL cam, the
    // graphic layers here (SCORE.screenFx(t), about (540, 960)) — modules draw in plain screen space
    const fx = S.screenFx(t), shake = () => { if (fx.s !== 1 || fx.dx || fx.dy) { ctx.translate(540 + fx.dx, 960 + fx.dy); ctx.scale(fx.s, fx.s); ctx.translate(-540, -960); } };
    ctx.save(); shake(); (has('DX_draw') ? window.DX_draw : duplex)(t, n, has('DX_draw') ? 'blur' : undefined); ctx.restore();
    ctx.save(); shake(); (has('MP_draw') ? window.MP_draw : map)(t, n); ctx.restore();
    if (has('TY_draw')) TY_draw(t, n);
    for (const l of L) if ((l.z || 0) >= 60 && live(l, t)) { ctx.save(); l.draw(ctx, t, n); ctx.restore(); }
  } });
  window.COMPOSE_GRAIN = n => { if (has('FT_grain')) FT_grain(n); };
  // review 2: the crisp pass (engine.html, once per frame after the motion-blur accumulation): the module's type layers
  // (band phrases, karaoke, badges, logo) at the frame's own time — DX_draw applies the stamps' shake to what rides the band
  // only; the badges and the logo never move (they stay under y 150 … above it: never)
  window.COMPOSE_CRISP = (t, n) => { if (!has('DX_draw')) return; window.__t = t; window.DX_draw(t, n, 'crisp'); };
})();
