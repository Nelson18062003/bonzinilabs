'use strict';
// =============================================================================================
// M1 « carton & air » · 34_plates.js — the text plates in « carton épais » + their effects.
//
//   CA_plate(kind, st, t, L)  st = an entry of SCORE.plates(t): {kind, x, y, s, sx, sy, rot, a, lines[], emph, crush, sweat,
//                             shake}. Centre (x, y); translate, rotate rot, scale s·sx, s·sy. Heights = G.plateH[kind].
//     Thick corrugated board, cut with a knife: the face is a printed liner (orange / amber ink laid on kraft, a thin
//     unprinted margin, starved specks) or raw grey board for LE BATEAU (stencil-sprayed ink, the emphasis on an orange
//     painted band: ink on orange stays readable). Thickness shows on the top edge (the flutes' wave) and the right edge
//     (liners), like the cartons' top and right faces; soft cast shadow down-right. Text is laid out once per kind,
//     fitted to the plate (title « DE L'AIR. » 170 px, the rest ≈ 84–100 px) and baked crisp at 1.5×.
//       title    orange print, cream letters          toi       amber print, dark-brown letters, trembles (st.shake),
//       bateau   grey heavy board (double wall)                  crushed at A.bateauFall (letters gone: they gush out)
//       toiSmall amber, sweating (st.sweat)           + the incoming shadow of LE BATEAU on TOI's plate (A.bateauShadow →
//                                                       A.bateauFall), and its own shadow on the table while it falls.
//   CA_fx(t, L)               effects drawn after the plates: TOI's letters gush out from under LE BATEAU (closed-form arcs,
//                             hops, spin, die-cut amber letters) with dust; dust at the m³ stamp, at each tape clack, when the
//                             walls close in (pose 2); kraft flakes and torn tape shreds of the burst at frame 0.
// Deterministic, no ctx.filter. Cost ≈ 3–5 ms per plate (one 1.5× sprite + stacked shadows); first use builds the sprite (≈ 30 ms, once).
// =============================================================================================
const CA_PL = (function () {
  const H = CA_, S = H.S, A = H.A, G = H.G, { cl, kk, mix, sst, eo, R, tq, litA, measureW } = H;
  const INK = '#231629', CREAM = '#FFF6E8', ORANGE = '#FE560D', AMBER = '#F3A745', BROWN = '#2A1606';
  const SS = 1.5, PAD = 10;
  const SPEC = {
    title: { W: 880, th: 26, face: 'orange', fam: 'Satoshi', sizes: [84, 84, 170], col: CREAM, seed: 3 },
    toi: { W: 840, th: 22, face: 'amber', fam: 'Satoshi', sizes: [96, 96], col: BROWN, seed: 5, uni: 1 },
    bateau: { W: 880, th: 34, face: 'grey', fam: 'Stencil', sizes: [104, 104, 104], col: INK, ls: 3, seed: 7, uni: 1 },
    toiSmall: { W: 1000, th: 22, face: 'amber', fam: 'Satoshi', sizes: [74, 74, 74], col: BROWN, seed: 9, uni: 1, ls: -1 },
  };
  const DV = th => [th * .3, -th * .5];                                // thickness: up-right, like the cartons
  const SPR = {}, LAY = {};

  // ---------- layout (once per kind) ----------
  function layout(kind, lines) {
    const key = kind + '|' + lines.join('|'); if (LAY[key]) return LAY[key];
    const sp = SPEC[kind], Hh = G.plateH[kind], maxW = sp.W - 96, ls = sp.ls || 0;
    const L = lines.map((l, i) => {
      let z = sp.sizes[i] || sp.sizes[sp.sizes.length - 1];
      const f = zz => `900 ${zz}px ${sp.fam}`, wAt = zz => measureW(l, f(zz)) + ls * (l.length - 1) * zz / z;
      const w0 = wAt(z); if (w0 > maxW) z = Math.floor(z * maxW / w0);
      return { s: l, z, f: f(z), w: wAt(z) };
    });
    if (sp.uni) { const z = Math.min(...L.map(q => q.z)); L.forEach(q => { q.z = z; q.f = `900 ${z}px ${sp.fam}`; q.w = measureW(q.s, q.f) + ls * (q.s.length - 1); }); }
    // vertical: cap heights + gaps, centred, and the whole block fits the plate height
    const cap = z => z * (sp.fam === 'Stencil' ? .8 : .72);
    let tot = 0; L.forEach((q, i) => { tot += cap(q.z) + (i ? Math.max(q.z, L[i - 1].z) * .3 : 0); });
    const room = Hh - 70; if (tot > room) { const k = room / tot; L.forEach(q => { q.z = Math.floor(q.z * k); q.f = `900 ${q.z}px ${sp.fam}`; q.w = measureW(q.s, q.f) + ls * (q.s.length - 1); }); tot = 0; L.forEach((q, i) => { tot += cap(q.z) + (i ? Math.max(q.z, L[i - 1].z) * .3 : 0); }); }
    let y = -tot / 2; L.forEach((q, i) => { if (i) y += Math.max(q.z, L[i - 1].z) * .3; y += cap(q.z); q.base = y; q.cap = cap(q.z); });
    return (LAY[key] = { lines: L, ls });
  }
  /** per-glyph centres (plate coords at s = 1) for the gushing letters */
  function glyphs(kind, lines) {
    const lo = layout(kind, lines), out = [];
    lo.lines.forEach((q, li) => {
      let x = -q.w / 2;
      for (let i = 0; i < q.s.length; i++) {
        const ch = q.s[i], adv = measureW(q.s.slice(0, i + 1), q.f) - measureW(q.s.slice(0, i), q.f);
        if (ch !== ' ') out.push({ ch, x: x + adv / 2, y: q.base - q.cap / 2, z: q.z, f: q.f, li, i: out.length });
        x += adv;
      }
    });
    return out;
  }

  // ---------- the board (sprite: thickness bands + printed face + text) ----------
  function cutRect(g, W, Hh, seed) {                                   // knife-cut outline, one dented corner
    const pts = [], j = (i, k) => (R(i, seed + k) - .5) * 2.2, step = 44;
    const push = (x, y) => pts.push([x, y]);
    for (let x = -W / 2; x < W / 2; x += step) push(x, -Hh / 2 + j(x, 1));
    for (let y = -Hh / 2; y < Hh / 2; y += step) push(W / 2 + j(y, 2), y);
    for (let x = W / 2; x > -W / 2 + 26; x -= step) push(x, Hh / 2 + j(x, 3));
    push(-W / 2 + 18, Hh / 2 - 1); push(-W / 2 + 6, Hh / 2 - 9); push(-W / 2 + 1, Hh / 2 - 20);      // crushed corner
    for (let y = Hh / 2 - 26; y > -Hh / 2; y -= step) push(-W / 2 + j(y, 4), y);
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    return pts;
  }
  function band(g, P0, P1, dv, col, wave, dark) {
    g.beginPath(); g.moveTo(...P0); g.lineTo(...P1); g.lineTo(P1[0] + dv[0], P1[1] + dv[1]); g.lineTo(P0[0] + dv[0], P0[1] + dv[1]); g.closePath(); g.fillStyle = col; g.fill();
    const len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), tl = Math.hypot(dv[0], dv[1]);
    g.save(); g.lineCap = 'round'; g.strokeStyle = dark; g.lineWidth = Math.max(1, tl * .1);
    for (const a of [.12, .88]) { g.beginPath(); g.moveTo(P0[0] + dv[0] * a, P0[1] + dv[1] * a); g.lineTo(P1[0] + dv[0] * a, P1[1] + dv[1] * a); g.stroke(); }
    if (wave) {
      const rows = wave, n = Math.round(len / (tl / rows * 1.6));
      for (let r = 0; r < rows; r++) {
        const a0 = .14 + .72 * r / rows, a1 = .14 + .72 * (r + 1) / rows; g.beginPath();
        for (let i = 0; i <= n * 6; i++) { const f = i / (n * 6), a = mix(a0, a1, .5 + .45 * Math.sin(f * n * Math.PI * 2 + r)); const x = P0[0] + (P1[0] - P0[0]) * f + dv[0] * a, y = P0[1] + (P1[1] - P0[1]) * f + dv[1] * a; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.lineWidth = Math.max(1, tl * .09); g.stroke();
        if (r < rows - 1) { g.beginPath(); g.moveTo(P0[0] + dv[0] * a1, P0[1] + dv[1] * a1); g.lineTo(P1[0] + dv[0] * a1, P1[1] + dv[1] * a1); g.stroke(); }
      }
    }
    g.restore();
  }
  function sprite(kind, lines, withText = true) {
    const key = kind + (withText ? '' : '#blank'); if (SPR[key]) return SPR[key];
    const sp = SPEC[kind], W = sp.W, Hh = G.plateH[kind], dv = DV(sp.th);
    const cw = Math.ceil((W + dv[0] + 2 * PAD) * SS), ch = Math.ceil((Hh - dv[1] + 2 * PAD) * SS);
    const c = makeCanvas(cw, ch), g = c.getContext('2d'); g.scale(SS, SS); g.translate(PAD + W / 2, PAD - dv[1] + Hh / 2);
    const lin = g.createPattern(H.liner(), 'repeat');
    // thickness: top edge = flutes (single or double wall), right edge = liners
    const TL = [-W / 2, -Hh / 2], TR = [W / 2, -Hh / 2], BR = [W / 2, Hh / 2];
    const rows = kind === 'bateau' ? 2 : 1;
    band(g, TL, TR, dv, '#E2C496', 'rgba(116,76,36,.62)', rows);
    g.save(); const bandPath = () => { g.beginPath(); g.moveTo(...TL); g.lineTo(...TR); g.lineTo(TR[0] + dv[0], TR[1] + dv[1]); g.lineTo(TL[0] + dv[0], TL[1] + dv[1]); g.closePath(); };
    bandPath(); g.clip(); g.globalAlpha = .35; g.fillStyle = lin; g.fillRect(-W, -Hh, 2 * W, 2 * Hh); g.restore();
    band(g, TR, BR, dv, '#B08A5C', 'rgba(90,58,26,.5)', 0);
    { g.save(); g.strokeStyle = 'rgba(80,50,20,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(TR[0] + dv[0] * .5, TR[1] + dv[1] * .5); g.lineTo(BR[0] + dv[0] * .5, BR[1] + dv[1] * .5); g.stroke(); g.restore(); }
    // the face: kraft liner, then the print
    cutRect(g, W, Hh, sp.seed); g.fillStyle = lin; g.fill();
    g.save(); cutRect(g, W, Hh, sp.seed); g.clip();
    if (sp.face === 'grey') {
      g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(176,170,160,.78)'; g.fillRect(-W, -Hh, 2 * W, 2 * Hh); g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(232,226,214,.30)'; g.fillRect(-W, -Hh, 2 * W, 2 * Hh);
    } else {
      const m = 12, col = sp.face === 'orange' ? '#FE560D' : '#F3A745';
      g.fillStyle = col; rrectOn(g, -W / 2 + m, -Hh / 2 + m, W - 2 * m, Hh - 2 * m, 8); g.fill();
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = .28; g.fillStyle = lin; rrectOn(g, -W / 2 + m, -Hh / 2 + m, W - 2 * m, Hh - 2 * m, 8); g.fill();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // starved flexo ink: specks of kraft show through, the edge of the print a little ragged
      g.fillStyle = 'rgba(214,176,124,.55)';
      for (let i = 0; i < 520; i++) { const x = -W / 2 + m + R(i, sp.seed + 11) * (W - 2 * m), y = -Hh / 2 + m + R(i, sp.seed + 12) * (Hh - 2 * m), r = .5 + R(i, sp.seed + 13) * 1.4; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }
    // light: brighter top-left, darker bottom-right; an edge highlight (the cut catches the window)
    const lg = g.createLinearGradient(-W / 2, -Hh / 2, W / 2, Hh / 2); lg.addColorStop(0, 'rgba(255,246,226,.16)'); lg.addColorStop(.55, 'rgba(255,246,226,0)'); lg.addColorStop(1, 'rgba(60,24,0,.14)');
    g.fillStyle = lg; g.fillRect(-W, -Hh, 2 * W, 2 * Hh);
    g.restore();
    g.save(); cutRect(g, W, Hh, sp.seed); g.strokeStyle = 'rgba(255,244,222,.5)'; g.lineWidth = 2; g.stroke(); g.restore();
    if (withText) text(g, kind, lines, sp);
    return (SPR[key] = { c, W, Hh, dv, ox: PAD + W / 2, oy: PAD - dv[1] + Hh / 2 });
  }
  function text(g, kind, lines, sp) {
    const lo = layout(kind, lines);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.letterSpacing = (lo.ls || 0) + 'px';
    lo.lines.forEach((q, i) => {
      g.font = q.f;
      if (kind === 'bateau' && i === (S.plateText('bateau') || {}).emph) {
        // the emphasis: an orange painted band, ink on top (readable), spray overspray at the band's ends
        const bw = q.w + 56, bh = q.cap + 34;
        g.save(); g.translate(0, q.base - q.cap / 2); g.rotate(-.018);
        g.fillStyle = ORANGE; g.beginPath(); g.moveTo(-bw / 2, -bh / 2 + 3); g.lineTo(bw / 2, -bh / 2); g.lineTo(bw / 2 - 4, bh / 2); g.lineTo(-bw / 2 + 3, bh / 2 - 2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(254,86,13,.35)'; for (let k = 0; k < 140; k++) { const sx = (R(k, 71) < .5 ? -1 : 1) * (bw / 2 + R(k, 72) * 16), sy = (R(k, 73) - .5) * bh; g.beginPath(); g.arc(sx, sy, .6 + R(k, 74) * 1.6, 0, 7); g.fill(); }
        g.restore();
      }
      if (sp.face === 'grey') {                                       // sprayed stencil ink: a faint overspray halo
        g.save(); g.shadowColor = 'rgba(35,22,41,.45)'; g.shadowBlur = 7; g.fillStyle = 'rgba(35,22,41,.0)'; g.fillStyle = INK; g.globalAlpha = .35; g.fillText(q.s, 0, q.base); g.restore();
        g.fillStyle = INK; g.fillText(q.s, 0, q.base);
      } else if (sp.col === CREAM) {                                   // cream on orange: a deep under-shadow for separation
        g.save(); g.shadowColor = 'rgba(110,30,0,.55)'; g.shadowBlur = 5; g.shadowOffsetX = 1.5; g.shadowOffsetY = 3.5; g.fillStyle = CREAM; g.fillText(q.s, 0, q.base); g.restore();
      } else {
        g.save(); g.fillStyle = 'rgba(255,236,190,.55)'; g.fillText(q.s, 0, q.base + 2); g.restore();     // letterpress: a light lip below
        g.fillStyle = sp.col; g.fillText(q.s, 0, q.base);
      }
    });
    g.restore();
  }

  // ---------- shadows (stacked footprints) ----------
  function softRect(cx, cy, w, h, blur, a, n = 5, col = '52,30,10') {
    if (a <= .004) return;
    const al = 1 - Math.pow(1 - Math.min(.95, a), 1 / n); ctx.fillStyle = `rgba(${col},${al.toFixed(4)})`;
    for (let i = 0; i < n; i++) { const e = -blur * .5 + blur * 1.5 * i / (n - 1); rrect(cx - w / 2 - e, cy - h / 2 - e, w + 2 * e, h + 2 * e, 10 + Math.max(0, e)); ctx.fill(); }
  }

  // ---------- sweat (toiSmall), after « PAS REÇU. » PL_sweat ----------
  function drop(x, y, r, e, a) {
    if (r < .6 || a <= .01) return;
    ctx.save(); ctx.globalAlpha *= a;
    const tip = y - r * (1 + e * 1.1);
    const shape = (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox, tip + oy); ctx.bezierCurveTo(x + ox + r * .5, y + oy - r * 1.05, x + ox + r, y + oy - r * .5, x + ox + r, y + oy);
      ctx.arc(x + ox, y + oy, r, 0, Math.PI); ctx.bezierCurveTo(x + ox - r, y + oy - r * .5, x + ox - r * .5, y + oy - r * 1.05, x + ox, tip + oy); ctx.closePath(); };
    shape(1.4, 2.6); ctx.fillStyle = 'rgba(96,36,0,.30)'; ctx.fill();
    shape(0, 0); const rg = ctx.createRadialGradient(x + r * .25, y + r * .35, 0, x, y - r * .2, r * 1.5);
    rg.addColorStop(0, 'rgba(255,248,214,.85)'); rg.addColorStop(.45, 'rgba(255,206,100,.18)'); rg.addColorStop(.8, 'rgba(140,56,0,.4)'); rg.addColorStop(1, 'rgba(96,34,0,.7)');
    ctx.fillStyle = rg; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(86,30,0,.55)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(x - r * .36, y - r * .38, r * .26, r * .17, -.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function sweat(W, Hh, sw, t) {
    if (sw <= .005) return;
    const N = 7, top = -Hh / 2 + 18, bot = Hh / 2 - 12;
    for (let i = 0; i < 5; i++) { const x = -W / 2 + 80 + (i + .3 + .4 * R(i, 4)) * (W - 160) / 5, a = cl(sw * 6 - i * .8), r = (10 + 6 * R(i, 2)) * (.6 + .4 * a) * (1 + .06 * Math.sin(t * 3 + i)); drop(x, top + 2 + R(i, 6) * 5, r, .1, a); }
    for (let i = 0; i < N; i++) {
      const vis = cl(sw * (N + 1) - i); if (vis <= 0) continue;
      const x = -W / 2 + 56 + (i + .2 + .6 * R(i, 7)) * (W - 112) / N, rate = .22 + .16 * R(i, 5), u = ((t * rate + R(i, 9)) % 1 + 1) % 1;
      const y = top + (bot - top) * Math.pow(u, 1.9), grow = cl(u / .16), fade = 1 - cl((u - .9) / .1), r = (12 + 7 * R(i, 3)) * (.35 + .65 * grow), e = .3 + 1.4 * Math.pow(u, 1.2);
      if (y - top > 6) { ctx.save(); ctx.globalAlpha *= vis * fade; ctx.lineCap = 'round'; const tg = ctx.createLinearGradient(0, top, 0, y); tg.addColorStop(0, 'rgba(150,64,0,0)'); tg.addColorStop(1, 'rgba(150,64,0,.2)');
        ctx.strokeStyle = tg; ctx.lineWidth = r * .75; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - r); ctx.stroke(); ctx.restore(); }
      drop(x, y, r, e, vis * fade);
    }
  }

  // ---------- one plate ----------
  function plate(kind, st, t, L) {
    if (!st || (st.a ?? 1) <= .003 || !SPEC[kind]) return;
    const sp = SPEC[kind], Hh = G.plateH[kind], sxx = (st.s ?? 1) * (st.sx ?? 1), syy = (st.s ?? 1) * (st.sy ?? 1);
    if (Math.abs(sxx) < .01 || Math.abs(syy) < .01) return;
    const crushed = (st.crush || 0) > .02, spr = sprite(kind, st.lines, !crushed);
    const n = Math.floor(tq(t) * 15), sh = st.shake || 0, jx = sh ? (R(n, 13) - .5) * 9 * sh : 0, jy = sh ? (R(n, 17) - .5) * 5 * sh : 0;
    ctx.save(); ctx.globalAlpha *= st.a ?? 1;
    // LE BATEAU, still in the air: its shadow waits on the table where it will land
    if (kind === 'bateau' && t < A.bateauFall) { const k = kk(t, A.bateauFall - .2, A.bateauFall); softRect(G.cx + 20, G.plateY + 26, sp.W * mix(1.12, 1, k), Hh * mix(1.12, 1, k), mix(40, 12, k), mix(.12, .4, k)); }
    // cast shadow (down-right) + contact
    const lift = kind === 'bateau' ? Math.max(0, G.plateY - st.y) : 0;
    if (lift < 40) {
      const sw = sp.W * Math.abs(sxx), shh = Hh * Math.abs(syy);
      softRect(st.x + 16 + jx, st.y + 22 + jy, sw, shh, 16, .34);
      softRect(st.x + 5 + jx, st.y + 7 + jy, sw, shh, 5, .26, 3);
    }
    ctx.translate(st.x + jx, st.y + jy); if (st.rot) ctx.rotate(st.rot); ctx.scale(sxx, syy);
    ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.c.width / SS, spr.c.height / SS);
    // daylight / brand light on the face (multiply); the plates live before the violet: kept as a cheap safety
    if ((L.violet || 0) > .01) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = litA([255, 255, 255], st.x, st.y, L); ctx.fillRect(-sp.W / 2, -Hh / 2, sp.W, Hh); ctx.restore(); }
    if (crushed) {                                                    // crushed board: creases, the fluting gives way
      ctx.save(); ctx.strokeStyle = 'rgba(70,30,0,.45)'; ctx.lineWidth = 3 / Math.max(.2, syy); ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const x0 = -sp.W / 2 + sp.W * (i + .5) / 7 + (R(i, 31) - .5) * 40; ctx.beginPath(); ctx.moveTo(x0, -Hh / 2 + 10); ctx.lineTo(x0 + (R(i, 32) - .5) * 60, Hh / 2 - 10); ctx.stroke(); }
      ctx.restore();
    }
    if (kind === 'toiSmall') sweat(sp.W, Hh, st.sweat || 0, t);
    ctx.restore();
    // LE BATEAU's incoming shadow darkens TOI's plate (it trembles under it)
    if (kind === 'toi' && t < A.bateauFall + .02 && t >= A.bateauShadow) {
      const k = kk(t, A.bateauShadow, A.bateauFall), sb = SPEC.bateau;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, G.plateY + 300); ctx.clip();
      softRect(G.cx + mix(50, 20, k), G.plateY + mix(34, 22, k), sb.W * mix(1.16, 1.0, k), G.plateH.bateau * mix(1.16, 1.0, k), mix(70, 14, k), mix(.04, .46, Math.pow(k, 1.7)), 7);
      ctx.restore();
    }
  }

  // =============================================================================================
  // EFFECTS
  // =============================================================================================
  let GL = null;
  function gushData() {
    if (GL) return GL;
    const P = S.plateText('toi'), gl = glyphs('toi', P.lines), bw = SPEC.bateau.W / 2, bh = G.plateH.bateau / 2;
    GL = gl.map((q, k) => {
      const r1 = R(k, 81), r2 = R(k, 82), r3 = R(k, 83);
      // squeezed out from under LE BATEAU: mostly down and to the sides, never up into the chip / pill
      const dirX = q.x / 420, side = Math.abs(dirX) > .62;
      let ex, ey;
      if (side) { ex = G.cx + Math.sign(dirX) * (bw + 30 + 70 * r1); ey = G.plateY + (q.y + 30) * .9 + (r2 - .3) * 160; }
      else { ex = G.cx + q.x * 1.05 + (r1 - .5) * 70; ey = G.plateY + bh + 40 + 70 * r2 + (q.li ? 40 : 0); }
      return { ...q, ex: cl(ex, 46, 1034), ey: cl(ey, 270, 840), vz: 900 + 600 * r3, spin: (R(k, 84) - .5) * 9, tau: .1 + .05 * R(k, 85) };
    });
    return GL;
  }
  function hop(vz, tau, g, e, nb) { let v = vz; for (let b = 0; b <= nb; b++) { const d = 2 * v / g; if (tau < d) return v * tau - g * tau * tau / 2; tau -= d; v *= e; } return 0; }
  function gush(t, L) {
    const t0 = A.bateauFall, tt = t - t0; if (tt < 0 || tt > .9) return;
    const gl = gushData(), fade = 1 - sst(kk(tt, .5, .8)), P = S.plates(t).find(q => q.kind === 'bateau');
    ctx.save();
    if (P) {                                                          // they come out from UNDER the heavy board
      const hw = SPEC.bateau.W / 2 * P.s * P.sx + 4, hh = G.plateH.bateau / 2 * P.s * P.sy + 4;
      ctx.beginPath(); ctx.rect(-400, -400, 1880, 2720); ctx.rect(P.x - hw, P.y - hh - 20, 2 * hw + 12, 2 * hh + 20); ctx.clip('evenodd');
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.letterSpacing = '0px';
    for (const q of gl) {
      const p = 1 - Math.exp(-tt / q.tau), x = mix(G.cx + q.x, q.ex, p), y = mix(G.plateY + 40 + q.y * .25, q.ey, p);
      const z = hop(q.vz, tt, 9000, .32, 2), rot = q.spin * (1 - Math.exp(-tt / .25)), sc = (.66 + z * .001) * Math.min(1, tt * 14);
      ctx.save(); ctx.globalAlpha *= fade; ctx.font = q.f;
      ctx.translate(x + 6 + z * .04, y + 9); ctx.rotate(rot); ctx.scale(sc, sc); ctx.strokeStyle = 'rgba(40,20,0,.28)'; ctx.lineWidth = 14; ctx.strokeText(q.ch, 0, 0); ctx.restore();   // shadow on the table
      ctx.save(); ctx.globalAlpha *= fade; ctx.font = q.f; ctx.translate(x, y - z * .45); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.strokeStyle = '#C97F1E'; ctx.lineWidth = 16; ctx.strokeText(q.ch, 0, 2); ctx.strokeStyle = AMBER; ctx.lineWidth = 13; ctx.strokeText(q.ch, 0, 0);
      ctx.fillStyle = BROWN; ctx.fillText(q.ch, 0, 0); ctx.restore();
    }
    ctx.restore();
    // dust squeezed out all around LE BATEAU
    const k = kk(t, t0, t0 + .9), bw = SPEC.bateau.W / 2, bh = G.plateH.bateau / 2, cy = G.plateY, em = [];
    for (let j = 0; j < 7; j++) { const x = G.cx - bw + 2 * bw * (j + .5) / 7; em.push({ x, y: cy + bh, nx: (x - G.cx) / bw * .5, ny: 1, s: .9 }); }
    for (const sd of [-1, 1]) em.push({ x: G.cx + sd * bw, y: cy + bh * .4, nx: sd, ny: .2, s: 1.4 }, { x: G.cx + sd * bw, y: cy - bh * .2, nx: sd, ny: -.3, s: 1.1 });
    H.puffs(em, k, { n: 5, seed: 11, dist: 120, size: 38, a: .55, rise: 30, tj: 70, out: 14 });
  }
  function burstDebris(t, L) {
    const tE = A.burstPeak + .45; if (t > tE) return; const tt = t + .38;           // already flying at frame 0
    const hero = S.heroCarton(Math.max(0, t)); if (!hero) return;
    const g = S.cartonGeo(hero), mx = g.top[0], my = g.top[1];
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (R(i, 91) - .5) * 2.6, v = 520 + 520 * R(i, 92), px = mx + (R(i, 93) - .5) * g.w * .7 + Math.cos(a) * v * tt, py = my + Math.sin(a) * v * tt + 1500 * tt * tt;
      const fade = 1 - sst(kk(t, tE - .4, tE)); if (py > g.FBL[1] + 40) continue;
      const tape = i % 5 === 0, sz = tape ? 34 : 9 + 10 * R(i, 94), rot = R(i, 95) * 6 + tt * (R(i, 96) - .5) * 16;
      ctx.globalAlpha = fade; ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
      ctx.fillStyle = tape ? '#A9763F' : ['#C79E6C', '#9C7447', '#E6C79C'][i % 3];
      if (tape) { ctx.beginPath(); ctx.moveTo(-sz / 2, -7); ctx.lineTo(sz / 2, -9); for (let k2 = 0; k2 < 4; k2++) ctx.lineTo(sz / 2 - (k2 % 2) * 5, -9 + k2 * 5.5); ctx.lineTo(-sz / 2, 8); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-sz / 2, -sz * .3); ctx.lineTo(sz * .45, -sz * .45); ctx.lineTo(sz * .5, sz * .35); ctx.lineTo(-sz * .4, sz * .4); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
    H.puffs([{ x: mx - g.w * .3, y: my, nx: -.6, ny: -1 }, { x: mx + g.w * .3, y: my, nx: .6, ny: -1 }, { x: mx, y: my - 10, nx: 0, ny: -1, s: 1.3 }], kk(t, -.3, A.burstPeak + .3), { n: 5, seed: 23, dist: 140, size: 44, a: .55, light: true, rise: 40 });
  }
  function fx(t, L) {
    burstDebris(t, L);
    if (typeof CA_MS !== 'undefined') CA_MS.formulaTail(t, L);
    gush(t, L);
    // « EN MÈTRES CUBES (m³) » hits the carton: dust from the stamp's ends (2-line box ≈ 480 × 210)
    { const k = kk(t, A.stampM3, A.stampM3 + .7); if (k > 0 && k < 1) { const hc = S.heroCarton(A.stampM3); if (hc) { const g = S.cartonGeo(hc), j = S.cartonJit(hc, t);
      H.puffs([{ x: g.cx - 235 + j.x, y: g.cy + j.y, nx: -1, ny: .2 }, { x: g.cx + 235 + j.x, y: g.cy - 10 + j.y, nx: 1, ny: -.2 }, { x: g.cx + j.x, y: g.cy + 105 + j.y, nx: 0, ny: 1, s: .7 }], k, { n: 5, seed: 41, dist: 80, size: 30, a: .5 }); } } }
    // each tape clack: a puff at the hook
    [A.mes0, A.mes1, A.mes2].forEach((m, i) => { const k = kk(t, m, m + .55); if (k <= 0 || k >= 1) return; const tp = S.tape(m + .001); if (!tp) return; const e = tp.edges[i];
      const dx = e.p1[0] - e.p0[0], dy = e.p1[1] - e.p0[1], l = Math.hypot(dx, dy) || 1; H.puffs([{ x: e.p1[0], y: e.p1[1], nx: dx / l, ny: dy / l }], k, { n: 5, seed: 51 + i * 7, dist: 60, size: 24, a: .45, spread: 1.6 }); });
    // the walls close in (pose 2): the air is pushed out of the corners
    { const k = kk(t, A.pose2 - .05, A.pose2 + .7); if (k > 0 && k < 1) { const hc = S.heroCarton(A.pose2 + .25); if (hc) { const g = S.cartonGeo(hc);
      H.puffs([{ x: g.FTL[0], y: g.FTL[1], nx: -1, ny: -.6 }, { x: g.BTR[0], y: g.BTR[1], nx: 1, ny: -.8 }, { x: g.FBL[0], y: g.FBL[1] - 20, nx: -1, ny: 0 }, { x: g.FBR[0] + g.ox, y: g.FBR[1] + g.oy, nx: 1, ny: -.2 }], k, { n: 5, seed: 61, dist: 110, size: 34, a: .6, light: true, rise: 34 }); } } }
  }
  return { plate, fx, glyphs, layout, SPEC };
})();
function CA_plate(kind, st, t, L) { CA_PL.plate(kind, st, t, L); }
function CA_fx(t, L) { CA_PL.fx(t, L); }
