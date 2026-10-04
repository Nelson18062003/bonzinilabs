'use strict';
// =============================================================================================
// « TCHAC ! » — M1 « money & cuts » (prefix MC_). World space (inside the camera), called by 50_compose.js with
// the states the score computed:
//   MC_note(SCORE.note(t))          the 10 000 F SPÉCIMEN note, its cut slices, the pencil outline / cut marks, the loop
//   MC_scissors(SCORE.scissors(t))  orange tailor's scissors, snap + paper burst on every real cut
//   MC_sneaker(SCORE.hook(t).sneaker)  the paper sneaker of the hook (blue + amber, no brand)
//   MC_envelope(SCORE.item(k, t))   the 4 kraft envelopes (label, felt-pen amount, lorry + boat, douane sticker, 4 doodles)
//   MC_box(SCORE.item(4, t))        the shoe box: lid off, two LEFT sneakers « G » « G »
//   MC_calc(SCORE.calc(t))          « RESTE SUR LE BILLET » — 7-segment LCD, « ? » blinks, red « 0 F »
//   MC_stamp(SCORE.stamps(t)[i])    « 5 PAIRES SUR 100 : INVENDABLES » + sub-line · giant « PRIX CHINOIS × 2 = 0 »
//   MC_pile(SCORE.pile(t))          « TOUT CE QUE TU PAIES », felt-pen arrow, kraft tag « TON VRAI PRIX »
//   MC_crumb(SCORE.crumbs(t)[i])    the two bits of note the margouillat swallows
// Every look is a pure function of (state, t, n); every time comes from the score (states / SCORE.A). Static paper is
// baked ONCE into offscreen sprites, shadows are baked blurred masks: no ctx.filter, no per-frame blur, no Math.random.
// Colours: orange = cuts, scissors, stamps, amounts · ink on paper · amber only for TOI's « ? » · NO violet in this module.
// =============================================================================================
(function () {
  const S = window.SCORE, A = S.A, G = S.G, kk = S.kk;
  const ORANGE = '#FE560D', ORANGE_D = '#C63C08', ORANGE_L = '#FF9157', AMBER = '#F3A745', INK = '#231629', INK2 = '#2A1F33';
  const CREAM = '#FBF6EC', RED = '#D7261E', ZERO_INK = '#E0301E', NOTE_INK = '#1F5B45', OVERPRINT = '#C3372B';
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const eOut = x => 1 - Math.pow(1 - cl(x), 3), eIn = x => Math.pow(cl(x), 3);
  const back = (x, s = 1.9) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const CUTS = () => [A.cut1, A.cutT, A.cutD1, A.cutD2, A.cutF, A.cutI];        // the six real cuts (score times)

  // =========================================================================================== sprites
  const SPR = {};
  /** run fn with the kit's global ctx pointing at g (so every kit helper draws into the sprite) */
  function paint(g, fn) { const p = ctx; ctx = g; try { fn(); } finally { ctx = p; } }
  /** lazily baked sprite of the local box [x0, y0, w, h] at supersampling ss; fn draws in local coords */
  function mk(key, x0, y0, w, h, ss, fn) {
    const s = SPR[key]; if (s) return s;
    const c = makeCanvas(Math.max(1, Math.ceil(w * ss)), Math.max(1, Math.ceil(h * ss))), g = c.getContext('2d');
    g.setTransform(ss, 0, 0, ss, -x0 * ss, -y0 * ss); g.imageSmoothingQuality = 'high';
    paint(g, fn);
    return (SPR[key] = { c, x0, y0, w, h, ss });
  }
  function blit(s) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h); }
  /** soft warm shadow of a sprite: its alpha blurred once (half resolution), cached on the sprite */
  function bake(s, blur) {
    const key = 'sh' + blur; if (s[key]) return s[key];
    const q = .5, pad = Math.ceil(blur * 1.7) + 2, c = makeCanvas(Math.ceil((s.w + 2 * pad) * q), Math.ceil((s.h + 2 * pad) * q)), g = c.getContext('2d');
    g.shadowColor = 'rgb(60,32,12)'; g.shadowBlur = blur * q; g.shadowOffsetX = 30000;
    g.drawImage(s.c, pad * q - 30000, pad * q, s.w * q, s.h * q);
    return (s[key] = { c, x0: s.x0 - pad, y0: s.y0 - pad, w: s.w + 2 * pad, h: s.h + 2 * pad });
  }
  /** contact shadow of sprite s for an object h px above the table (daylight from the top-left window; tighter as it lands) */
  function drop(s, x, y, rot, sx, sy, h, alpha = 1, ox = 0) {
    const dx = 4 + .36 * h, dy = 7 + .62 * h, a = (.36 - .13 * cl(h / 200)) * alpha, f = cl((h - 6) / 46);
    if (a <= .004) return;
    at(x + dx, y + dy, rot, sx, sy, () => {
      if (ox) ctx.translate(ox, 0);
      const g0 = ctx.globalAlpha;
      if (f < 1) { ctx.globalAlpha = g0 * a * (1 - f); blit(bake(s, 8)); }
      if (f > 0) { ctx.globalAlpha = g0 * a * f; const g = 1 + h * .0014; ctx.scale(g, g); blit(bake(s, 30)); }
      ctx.globalAlpha = g0;
    });
  }
  /** text with optional letter-spacing / condensed stretch (the kit's text() has no stretch) */
  function txt(s, x, y, f, color, o = {}) {
    ctx.save(); ctx.font = f; if (o.stretch) ctx.fontStretch = o.stretch; ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'alphabetic'; ctx.fillStyle = color;
    if (o.alpha != null) ctx.globalAlpha *= o.alpha; ctx.fillText(s, x, y); ctx.restore();
  }
  function wid(s, f, o = {}) { ctx.save(); ctx.font = f; if (o.stretch) ctx.fontStretch = o.stretch; ctx.letterSpacing = (o.ls || 0) + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; }
  /** ink starvation: punch the kit's speckle mask out of what is already drawn in the sprite (rubber-stamp look) */
  function starve(x, y, w, h, amt, seed = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = amt;
    for (let i = 0; i < 3; i++) { const ox = (rnd(seed * 3.1 + i) - .5) * 300, oy = (rnd(seed * 5.7 + i) - .5) * 150; ctx.drawImage(TEX.starve, x + ox - w * .1, y + oy - h * .1, w * 1.2, h * 1.2); }
    ctx.restore();
  }
  /** torn-paper strip path (centred) */
  function tornRect(w, h, seed, amp = 2.4) {
    const tp = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed, amp, 12), bt = tornLine(w / 2, h / 2, -w / 2, h / 2, seed + 5, amp, 12);
    ctx.beginPath(); ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath();
  }
  function tapeBit(x, y, r, len = 84) { at(x, y, r, 1, 1, () => { ctx.fillStyle = 'rgba(243,214,160,.78)'; ctx.fillRect(-len / 2, -14, len, 28); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-len / 2, -10, len, 4); }); }
  function polyStroke(pts, close) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (close) ctx.closePath(); ctx.stroke(); }

  // =========================================================================================== THE NOTE
  // A stylised 10 000 F « SPÉCIMEN » (never a BEAC replica: no bank name, no portrait, no emblem of a state).
  // Left half (FOURNISSEUR, cut first): the big « 10 000 / FRANCS ». Right half: the guilloche rosette. Across both: a red
  // diagonal SPÉCIMEN overprint printed INTO the paper (multiply + starved ink). The centre column stays clear for the scissors.
  const NSS = 1.5;
  function noteArt(w, h) {
    const r = h * .035;
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#C9E0C2'); g.addColorStop(.48, '#E7E7CB'); g.addColorStop(1, '#CFE3C6');
    ctx.fillStyle = g; rrect(-w / 2, -h / 2, w, h, r); ctx.fill();
    ctx.save(); rrect(-w / 2, -h / 2, w, h, r); ctx.clip();
    // light falling on the paper + fibres
    const rg = ctx.createRadialGradient(-w * .1, -h * .2, 20, 0, 0, w * .62); rg.addColorStop(0, 'rgba(255,255,246,.45)'); rg.addColorStop(1, 'rgba(255,255,246,0)');
    ctx.fillStyle = rg; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < 700; i++) {
      const x = (rnd(i * 1.37) - .5) * w, y = (rnd(i * 2.71) - .5) * h, a = rnd(i * 3.3) * Math.PI, l = 2 + rnd(i * 5.1) * 7;
      ctx.strokeStyle = rnd(i * 7.9) > .5 ? 'rgba(31,91,69,.07)' : 'rgba(255,255,250,.32)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    // guilloche field: two interleaved families of fine waves
    ctx.lineWidth = 1.05;
    for (let fam = 0; fam < 2; fam++) for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = fam ? 'rgba(31,91,69,.085)' : 'rgba(40,110,90,.11)'; ctx.beginPath();
      for (let x = -w / 2; x <= w / 2 + 6; x += 6) { const y = -h / 2 + (i + .5) * h / 30 + Math.sin(x * (fam ? .021 : .028) + i * .55 + fam * 2) * h * (fam ? .05 : .034); x === -w / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // the rosette window (right half): light oval + two spirograph curves (security print)
    const rx = w * .29, ry = -h * .02;
    const og = ctx.createRadialGradient(rx, ry, 10, rx, ry, h * .42); og.addColorStop(0, 'rgba(255,255,248,.75)'); og.addColorStop(1, 'rgba(255,255,248,0)');
    ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(rx, ry, h * .42, h * .44, 0, 0, 7); ctx.fill();
    const spiro = (R, rr, d, sc, col, lw) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= 1400; i++) { const th = i / 1400 * Math.PI * 2 * rr / gcd(R, rr); const x = (R - rr) * Math.cos(th) + d * Math.cos((R - rr) / rr * th), y = (R - rr) * Math.sin(th) - d * Math.sin((R - rr) / rr * th);
        i ? ctx.lineTo(rx + x * sc, ry + y * sc) : ctx.moveTo(rx + x * sc, ry + y * sc); }
      ctx.stroke();
    };
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    spiro(96, 36, 70, 1.05, 'rgba(31,91,69,.42)', 1.15);
    spiro(80, 22, 50, 1.25, 'rgba(176,120,40,.32)', 1.0);
    ctx.strokeStyle = 'rgba(31,91,69,.42)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(rx, ry, 44, 44, 0, 0, 7); ctx.stroke();
    // micro-print bands (part of the paper)
    const micro = 'SPÉCIMEN · 10 000 · SPÉCIMEN · 10 000 · SPÉCIMEN · 10 000 · SPÉCIMEN · 10 000 · SPÉCIMEN · 10 000 · ';
    txt(micro, -w / 2 + 30, -h / 2 + 46, font(FF.mono, 10, 700), 'rgba(31,91,69,.45)', { align: 'left', ls: 1 });
    txt(micro, -w / 2 + 30, h / 2 - 38, font(FF.mono, 10, 700), 'rgba(31,91,69,.45)', { align: 'left', ls: 1 });
    // the diagonal SPÉCIMEN overprint, printed INTO the paper
    at(w * .262, h * .07, -.27, 1, 1, () => stampText('SPÉCIMEN', 0, 0, font(FF.stencil, 98, 900), OVERPRINT, { alpha: .74, ls: 5, starve: .34 }));
    ctx.restore();
    // frame + corner ornaments
    ctx.save(); ctx.strokeStyle = NOTE_INK; ctx.globalAlpha = .78; ctx.lineWidth = 4; rrect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 12); ctx.stroke();
    ctx.lineWidth = 1.4; rrect(-w / 2 + 29, -h / 2 + 29, w - 58, h - 58, 9); ctx.stroke();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - 20), sy * (h / 2 - 20), 16, 0, 7); ctx.fillStyle = '#DDE9D3'; ctx.fill(); ctx.stroke(); }
    ctx.restore();
    // values: the big one on the left half (it leaves with FOURNISSEUR), small ones in the corners
    const lx = -w * .285;
    txt('10 000', lx + 3, 34 + 3, font(FF.brand, 112, 900), 'rgba(255,255,248,.7)', { ls: -2 });       // letterpress light edge
    txt('10 000', lx, 34, font(FF.brand, 112, 900), NOTE_INK, { ls: -2 });
    txt('FRANCS', lx, 92, font(FF.body, 32, 800), NOTE_INK, { ls: 14 });
    txt('10 000', -w / 2 + 50, -h / 2 + 88, font(FF.brand, 34, 900), NOTE_INK, { align: 'left' });
    txt('10 000', w / 2 - 50, h / 2 - 58, font(FF.brand, 34, 900), NOTE_INK, { align: 'right' });
    txt('SP 000000', w / 2 - 54, -h / 2 + 80, font(FF.mono, 22, 700), RED, { align: 'right', ls: 1 });
  }
  const noteFull = (w, h) => mk('note', -w / 2, -h / 2, w, h, NSS, () => noteArt(w, h));
  // ---- cut edges: scissor-cut polylines (one per cut fraction, shared by both sides so slices tile exactly)
  const EP = {};
  function edgePts(f, w, h) {
    const key = f.toFixed(4); if (EP[key]) return EP[key];
    const x = f * w - w / 2, seed = Math.round(f * 997) + 13, N = 34, pts = [];
    const stepAt = .28 + .44 * rnd(seed * 1.7), step = (rnd(seed * 2.3) - .5) * 4.5;
    for (let i = 0; i <= N; i++) {
      const u = i / N, y = -h / 2 - 3 + (h + 6) * u;
      const j = (rnd(seed + i * 3.1) - .5) * 1.6 + Math.sin(u * 8.5 + seed) * 1.1 + (u > stepAt ? step : 0) + Math.sin(u * 41 + seed * .3) * .45;
      pts.push([x + j, y]);
    }
    return (EP[key] = pts);
  }
  const edgeX = (pts, y) => { for (let i = 1; i < pts.length; i++) if (pts[i][1] >= y) { const a = pts[i - 1], b = pts[i], k = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * k; } return pts[pts.length - 1][0]; };
  function slicePath(a, b, w, h) {
    const r = h * .035, xl = -w / 2, xr = w / 2, yt = -h / 2, yb = h / 2;
    const Lp = a > 1e-6 ? edgePts(a, w, h) : null, Rp = b < 1 - 1e-6 ? edgePts(b, w, h) : null;
    ctx.beginPath();
    if (Lp) ctx.moveTo(Lp[0][0], yt - 3); else { ctx.moveTo(xl, yt + r); ctx.quadraticCurveTo(xl, yt, xl + r, yt); }
    if (Rp) { ctx.lineTo(Rp[0][0], yt - 3); for (const p of Rp) ctx.lineTo(p[0], p[1]); }
    else { ctx.lineTo(xr - r, yt); ctx.quadraticCurveTo(xr, yt, xr, yt + r); ctx.lineTo(xr, yb - r); ctx.quadraticCurveTo(xr, yb, xr - r, yb); }
    if (Lp) { ctx.lineTo(Lp[Lp.length - 1][0], yb + 3); for (let i = Lp.length - 1; i >= 0; i--) ctx.lineTo(Lp[i][0], Lp[i][1]); }
    else { ctx.lineTo(xl + r, yb); ctx.quadraticCurveTo(xl, yb, xl, yb - r); }
    ctx.closePath();
  }
  /** the white paper core + a hair of shade along a cut, and fibres standing out of it (dir −1 = left edge, +1 = right) */
  function cutDeco(f, dir, w, h) {
    const pts = edgePts(f, w, h), seed = Math.round(f * 991);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(31,70,50,.22)'; ctx.lineWidth = 1.3; polyStroke(pts.map(p => [p[0] - dir * 2.6, p[1]]));
    ctx.strokeStyle = 'rgba(252,251,240,.96)'; ctx.lineWidth = 1.8; polyStroke(pts.map(p => [p[0] - dir * .7, p[1]]));
    ctx.restore();
    for (let i = 0; i < 54; i++) {
      const y = -h / 2 + 4 + (h - 8) * rnd(seed + i * 5.3), x = edgeX(pts, y), L = 1.2 + rnd(seed + i * 2.9) * 4.2, ang = (rnd(seed + i * 7.7) - .5) * 1.5;
      ctx.strokeStyle = rnd(seed + i * 1.1) > .38 ? 'rgba(250,248,234,.95)' : 'rgba(150,188,150,.85)'; ctx.lineWidth = .8 + rnd(i + seed) * .7;
      ctx.beginPath(); ctx.moveTo(x - dir * 1.2, y); ctx.lineTo(x + dir * L * Math.cos(ang), y + L * Math.sin(ang)); ctx.stroke();
    }
    ctx.restore();
  }
  /** a slice [a, b] of the note (fractions of the width), in note-local coords, cut edges decorated */
  function slice(a, b, w, h) {
    const pad = 9, x0 = Math.floor((a * w - w / 2 - pad) * NSS) / NSS, x1 = b * w - w / 2 + pad;
    return mk('sl' + a.toFixed(3) + '_' + b.toFixed(3), x0, -h / 2 - pad, x1 - x0, h + 2 * pad, NSS, () => {
      ctx.save(); slicePath(a, b, w, h); ctx.clip(); blit(noteFull(w, h)); ctx.restore();
      if (a > 1e-6) cutDeco(a, -1, w, h);
      if (b < 1 - 1e-6) cutDeco(b, 1, w, h);
    });
  }
  /** tailor's marks: graphite dashed cut lines + tiny scissor pictograms on the part still attached */
  function cutMarks(from, alpha, w, h) {
    if (alpha <= .01) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round';
    for (const f of S.EDGES.slice(1, 6)) {
      if (f <= from + 1e-6) continue;
      const x = f * w - w / 2;
      ctx.strokeStyle = 'rgba(44,34,52,.40)'; ctx.lineWidth = 2.4; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(x, -h / 2 - 22); ctx.lineTo(x, h / 2 + 22); ctx.stroke(); ctx.setLineDash([]);
      at(x, -h / 2 - 40, 0, 1, 1, () => {               // ✂ pictogram (graphite)
        ctx.strokeStyle = 'rgba(44,34,52,.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-5, -6, 4.2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(5, -6, 4.2, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, -2.5); ctx.lineTo(4, 11); ctx.moveTo(3, -2.5); ctx.lineTo(-4, 11); ctx.stroke();
      });
    }
    ctx.restore();
  }
  function pencilOutline(alpha, w, h) {
    if (alpha <= .01) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(52,44,62,.46)'; ctx.lineWidth = 2.6; ctx.setLineDash([16, 11]); rrect(-w / 2, -h / 2, w, h, h * .035); ctx.stroke();
    ctx.globalAlpha *= .55; ctx.lineWidth = 1.1; ctx.setLineDash([5, 17]); ctx.translate(1.4, 1); rrect(-w / 2, -h / 2, w, h, h * .035); ctx.stroke();
    ctx.restore();
  }
  /** shading across a flying slice (it curls a little): light on one half, shade on the other */
  function curlShade(x0, x1, h, k, dir) {
    if (k <= .01) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 3, -h / 2 + 3, x1 - x0 - 6, h - 6); ctx.clip();
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(255,255,250,${(.22 * k).toFixed(3)})`); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(30,50,30,${(.2 * k).toFixed(3)})`);
    if (dir < 0) { ctx.translate((x0 + x1), 0); ctx.scale(-1, 1); }
    ctx.fillStyle = g; ctx.fillRect(x0, -h / 2, x1 - x0, h); ctx.restore();
  }
  /** violet wash on the paper while the brand light is on (the loop only) — cheap multiply over the slice rect */
  function violetTint(x0, x1, h, v) {
    if (v <= .01) return;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= .24 * v; ctx.fillStyle = '#B9A4FF'; ctx.fillRect(x0 + 2, -h / 2 + 2, x1 - x0 - 4, h - 4); ctx.restore();
  }

  window.MC_note = function (st, t, L, n) {
    const w = st.w, h = st.h, rot = st.rot, sc = st.s;
    const ref = st.pieces.filter(p => p.reform), minK = ref.length === 6 ? Math.min(...ref.map(p => p.k)) : 0;
    const done = minK >= .999, seal = done ? 1 : kk(minK, .9, .999);       // the slices click together: the whole note fades over the seams
    const vio = L && L.violet || 0;
    // 1 — on the table: the pencil outline of the whole note (where the money was)
    at(st.x, st.y, rot, sc * st.sx, sc * st.sy, () => pencilOutline(st.outline, w, h));
    // 2 — the part still attached (or, the loop done, the whole note again — identical to frame 0)
    if (st.visible || done) {
      const off = done ? 0 : st.off, from = done ? 0 : st.from, sp = slice(from, 1, w, h);
      drop(sp, st.x + off * Math.cos(rot) * sc, st.y + off * Math.sin(rot) * sc, rot, sc * st.sx, sc * st.sy, 3);
      at(st.x, st.y, rot, sc * st.sx, sc * st.sy, () => {
        ctx.translate(off, 0); blit(sp);
        violetTint(from * w - w / 2, w / 2, h, vio);
        // the cut marks; they come back with the re-formed note so the last frame = frame 0
        cutMarks(from, Math.max(st.cutLines, done ? 1 : 0), w, h);
        // TCHAC: a bright slit along the fresh cut for a few frames
        const cuts = CUTS();
        for (let i = 0; i < 6; i++) {
          const d = t - cuts[i]; if (d < 0 || d > .16 || done) continue;
          const f = S.EDGES[i + 1]; if (Math.abs(f - from) > 1e-6) continue;
          const pts = edgePts(f, w, h), a = 1 - d / .16;
          ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,250,225,${(.9 * a).toFixed(3)})`; ctx.lineWidth = 7 * a + 1.5; ctx.lineCap = 'round';
          polyStroke(pts.map(p => [p[0] + 1.5, p[1]])); ctx.restore();
        }
      });
    }
    // 3 — the slices: flying into their envelope, or flying back in for the loop
    const ord = st.pieces.slice().sort((p, q) => (p.reform === q.reform ? p.i - q.i : p.reform ? 1 : -1));
    if (!done) for (const p of ord) drawPiece(p, st, vio);
    if (!done && seal > 0) at(st.x, st.y, rot, sc * st.sx, sc * st.sy, () => {
      ctx.save(); ctx.globalAlpha *= seal; blit(slice(0, 1, w, h)); violetTint(-w / 2, w / 2, h, vio); cutMarks(0, seal, w, h); ctx.restore();
    });
  };
  function drawPiece(p, st, vio) {
    const w = st.w, h = st.h, sp = slice(p.a, p.b, w, h), cxl = ((p.a + p.b) / 2 - .5) * w;
    const k = p.reform ? 1 - p.k : p.k, e = p.reform ? eOut(p.k) : 0;
    // while it is still (almost) in the note, it shares the note's transform; then it is a free scrap of paper
    const glue = p.reform ? e : 1 - cl(k * 4);
    const rot = p.rot + st.rot * glue, sc = p.s * (1 + (st.s - 1) * glue);
    const Lx = p.x - st.x, x = p.x + Lx * (Math.cos(st.rot) * st.s - 1) * glue, y = p.y + Lx * Math.sin(st.rot) * st.s * glue;
    const curl = Math.sin(Math.PI * cl(k)), lift = 3 + (p.i === 0 && !p.reform ? 22 : 74) * curl;
    const sx = sc * (1 - .16 * curl) * (glue > 0 && !p.reform ? st.sx : 1), sy = sc * (glue > 0 && !p.reform ? st.sy : 1);
    ctx.save(); ctx.globalAlpha *= p.alpha;
    drop(sp, x, y, rot, sx, sy, lift, 1, -cxl);
    at(x, y, rot, sx, sy, () => {
      ctx.translate(-cxl, 0); blit(sp);
      curlShade(p.a * w - w / 2, p.b * w - w / 2, h, curl, p.i % 2 ? 1 : -1);
      violetTint(p.a * w - w / 2, p.b * w - w / 2, h, vio);
    });
    ctx.restore();
  }

  // =========================================================================================== SCISSORS
  // Tailor's scissors seen from above: two rigid halves crossing at the screw (blade on one side, orange ring on the other).
  // Each half is a baked sprite; opening = the halves rotate ±a about the pivot. High above the paper (soft, far shadow),
  // down at paper level during a cut stroke (tight shadow). Real cuts throw a little burst of note fibres at the tips.
  const BLADE = 236;
  let _s0 = null; const S0 = () => _s0 || (_s0 = S.scissors(0));      // the scissors' frame-0 state (pure)
  function halfArt(big) {
    // --- the orange handle: overmould neck + ring (on the −y side, behind the pivot)
    const rc = big ? [-100, -50] : [-92, -45], rx = big ? 47 : 39, ry = big ? 34 : 29, rr = big ? .36 : .3, th = big ? 17 : 15;
    const og = ctx.createLinearGradient(-150, -95, -10, 10); og.addColorStop(0, ORANGE_L); og.addColorStop(.42, ORANGE); og.addColorStop(1, ORANGE_D);
    ctx.fillStyle = og; ctx.beginPath();
    ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-40, -30, rc[0] + rx * .62, rc[1] - ry * .55); ctx.lineTo(rc[0] + rx * .78, rc[1] + ry * .62); ctx.quadraticCurveTo(-36, -6, -10, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,30,0,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    at(rc[0], rc[1], rr, 1, 1, () => {
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.ellipse(0, 0, rx - th, ry - th, 0, Math.PI * 2, 0, true);
      const rg = ctx.createLinearGradient(-rx, -ry, rx, ry); rg.addColorStop(0, ORANGE_L); rg.addColorStop(.45, ORANGE); rg.addColorStop(1, ORANGE_D);
      ctx.fillStyle = rg; ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(110,28,0,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, rx - th, ry - th, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(130,34,0,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,220,.75)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, rx - th * .5, ry - th * .5, 0, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, rx - th * .5, ry - th * .5, 0, Math.PI * 1.18, Math.PI * 1.26); ctx.stroke();
    });
    // --- the steel blade (+y side of the cutting edge y ≈ 0), point at x = BLADE
    ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(BLADE, .6); ctx.quadraticCurveTo(BLADE - 4, 8, BLADE - 26, 13);
    ctx.quadraticCurveTo(130, 30, 34, 34); ctx.quadraticCurveTo(-10, 36, -26, 22); ctx.quadraticCurveTo(-32, 6, -20, -2); ctx.closePath();
    const bg = ctx.createLinearGradient(0, 0, 0, 34); bg.addColorStop(0, '#FAFBFC'); bg.addColorStop(.16, '#D9DEE3'); bg.addColorStop(.55, '#AEB6BF'); bg.addColorStop(1, '#868E98');
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(36,40,48,.62)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, .8); ctx.lineTo(BLADE - 6, 1.4); ctx.stroke();   // honed edge
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(4, 8); ctx.quadraticCurveTo(120, 11, BLADE - 30, 8.5); ctx.stroke();  // bevel
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(30, 20); ctx.quadraticCurveTo(110, 21, 170, 16); ctx.stroke();  // soft reflection
  }
  const half = side => mk('scis' + side, -160, -112, 412, 224, 1.5, () => { if (side < 0) ctx.scale(1, -1); halfArt(side < 0); });
  /** 0..1: the blades are down at paper level (a cut stroke, same window the score pushes them along the line) */
  function press(t) { let p = 0; for (const tc of CUTS()) { const d = t - tc; if (d > -.06 && d < .35) p = Math.max(p, Math.sin(Math.PI * cl((d + .06) / .41))); } return p; }
  window.MC_scissors = function (st, t, L, n) {
    if (st.a <= 0) return;
    // the loop: ease the opening back to frame 0's so the last frame matches the first
    const open = st.open + (S0().open - st.open) * kk(t, A.loop, S.T.end - .04);
    const a = .03 + open * .5, pr = press(t), h = 72 - 60 * pr;
    const last = t - st.snap, ci = CUTS().findIndex(c => Math.abs(c - last) < 1e-4);
    // shadow: both halves, far when hovering, tight while cutting
    const dx = 4 + .36 * h, dy = 7 + .62 * h, al = (.34 - .1 * cl(h / 200)) * st.a, f = cl((h - 6) / 46);
    at(st.x + dx, st.y + dy, st.rot, st.s, st.s, () => {
      const g0 = ctx.globalAlpha;
      for (const side of [-1, 1]) { ctx.save(); ctx.rotate(side * a); const s = half(side);
        if (f < 1) { ctx.globalAlpha = g0 * al * (1 - f); blit(bake(s, 8)); }
        if (f > 0) { ctx.globalAlpha = g0 * al * f; blit(bake(s, 26)); }
        ctx.restore(); }
    });
    at(st.x, st.y, st.rot, st.s, st.s, () => {
      ctx.globalAlpha *= st.a;
      ctx.save(); ctx.rotate(-a); blit(half(-1)); ctx.restore();
      ctx.save(); ctx.rotate(a); blit(half(1)); ctx.restore();
      // the screw
      const sg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11); sg.addColorStop(0, '#F4F6F8'); sg.addColorStop(.6, '#9AA3AD'); sg.addColorStop(1, '#5B626C');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(30,32,38,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,44,50,.75)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(6, -4); ctx.stroke();
      // snap: a glint runs down the closing blades
      if (ci >= 0 && st.snap >= 0 && st.snap < .12) {          // real cuts only (the dry snips of the hook stay dry)
        const q = st.snap / .12, gx = 30 + q * (BLADE - 40);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= 1 - q;
        const gg = ctx.createRadialGradient(gx, 0, 0, gx, 0, 34); gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(gx - 34, -34, 68, 68);
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 16, 0); ctx.lineTo(gx + 16, 0); ctx.moveTo(gx, -10); ctx.lineTo(gx, 10); ctx.stroke();
        ctx.restore();
      }
    });
    // a real cut (not one of the dry snips of the hook): a burst of note fibres at the blade tips
    if (st.snap >= 0 && st.snap < .16 && ci >= 0) {
      const q = st.snap / .16, tipX = st.x + Math.cos(st.rot) * BLADE * st.s * .92, tipY = st.y + Math.sin(st.rot) * BLADE * st.s * .92;
      const cols = ['#CFE3C9', '#E7E4C4', '#F8F6EA', '#9FC2A0', '#E9D9C9'];
      for (let i = 0; i < 18; i++) {
        const sd = ci * 31 + i * 7.3, along = .35 + .65 * rnd(sd + 5), ox = st.x + (tipX - st.x) * along, oy = st.y + (tipY - st.y) * along;
        const ang = st.rot + Math.PI / 2 * (i % 2 ? 1 : -1) + (rnd(sd) - .5) * 1.6, v = 240 + rnd(sd + 1) * 460, d = v * st.snap * (1 - q * .45);
        const x = ox + Math.cos(ang) * d, y = oy + Math.sin(ang) * d, sz = 4 + rnd(sd + 2) * 8, r = rnd(sd + 3) * 6 + st.snap * 30 * (rnd(sd + 4) - .5);
        at(x, y, r, 1, 1, () => { ctx.globalAlpha *= 1 - q; ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(-sz, -sz * .4); ctx.lineTo(sz * .8, -sz * .6); ctx.lineTo(sz, sz * .5); ctx.lineTo(-sz * .6, sz * .55); ctx.closePath(); ctx.fill(); });
      }
    }
  };

  // =========================================================================================== THE SNEAKER (hook)
  // A cut-paper sneaker, side view, toe to the right: blue upper, amber heel counter + pull tab, cream toe cap, white sole.
  // No brand mark, no stripes, no swoosh — and never violet.
  function sneakerArt() {
    const layer = (fn, blur = 3) => { ctx.save(); ctx.shadowColor = 'rgba(40,24,10,.24)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 2.5; fn(); ctx.restore(); };
    // outsole + midsole
    layer(() => { ctx.fillStyle = '#3B3540'; ctx.beginPath(); ctx.moveTo(-168, 58); ctx.lineTo(176, 58); ctx.quadraticCurveTo(186, 60, 180, 70); ctx.lineTo(-160, 72); ctx.quadraticCurveTo(-174, 70, -168, 58); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -150; x < 170; x += 22) ctx.fillRect(x, 64, 11, 5);
    layer(() => { ctx.fillStyle = '#F7F2E7'; ctx.beginPath(); ctx.moveTo(-178, 26); ctx.lineTo(150, 30); ctx.quadraticCurveTo(178, 26, 190, 34); ctx.quadraticCurveTo(192, 50, 176, 60); ctx.lineTo(-166, 62); ctx.quadraticCurveTo(-184, 58, -182, 44); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = 'rgba(60,40,30,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-170, 46); ctx.quadraticCurveTo(0, 50, 178, 46); ctx.stroke();
    // upper
    layer(() => {
      const ug = ctx.createLinearGradient(0, -80, 0, 30); ug.addColorStop(0, '#3D71E6'); ug.addColorStop(1, '#2450BE');
      ctx.fillStyle = ug; ctx.beginPath(); ctx.moveTo(-178, 30); ctx.lineTo(-181, -18); ctx.quadraticCurveTo(-178, -54, -152, -64); ctx.quadraticCurveTo(-112, -56, -74, -50);
      ctx.lineTo(-56, -72); ctx.quadraticCurveTo(-34, -84, -16, -70); ctx.quadraticCurveTo(50, -40, 112, -16); ctx.quadraticCurveTo(170, 4, 184, 28); ctx.lineTo(150, 32); ctx.closePath(); ctx.fill();
    }, 4);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-178, 30); ctx.lineTo(-181, -18); ctx.quadraticCurveTo(-178, -54, -152, -64); ctx.quadraticCurveTo(-112, -56, -74, -50);
    ctx.lineTo(-56, -72); ctx.quadraticCurveTo(-34, -84, -16, -70); ctx.quadraticCurveTo(50, -40, 112, -16); ctx.quadraticCurveTo(170, 4, 184, 28); ctx.lineTo(150, 32); ctx.closePath(); ctx.clip();
    for (let i = 0; i < 260; i++) { const x = -180 + rnd(i * 2.3) * 365, y = -84 + rnd(i * 3.9) * 116, a = rnd(i * 5.1) * 3.14, l = 2 + rnd(i * 6.7) * 6;
      ctx.strokeStyle = rnd(i * 7.3) > .5 ? 'rgba(255,255,255,.10)' : 'rgba(10,20,60,.10)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    const hl = ctx.createLinearGradient(0, -84, 0, -30); hl.addColorStop(0, 'rgba(255,255,255,.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(-190, -90, 380, 60);
    ctx.restore();
    // collar lining + tongue
    ctx.fillStyle = '#211A33'; ctx.beginPath(); ctx.moveTo(-150, -62); ctx.quadraticCurveTo(-110, -50, -74, -48); ctx.quadraticCurveTo(-100, -40, -146, -50); ctx.closePath(); ctx.fill();
    layer(() => { ctx.fillStyle = '#5B86EC'; ctx.beginPath(); ctx.moveTo(-60, -70); ctx.quadraticCurveTo(-46, -92, -24, -86); ctx.quadraticCurveTo(-14, -78, -20, -66); ctx.closePath(); ctx.fill(); }, 2);
    // toe cap (cream) + heel counter (amber) + pull tab
    layer(() => { ctx.fillStyle = '#EFE7D6'; ctx.beginPath(); ctx.moveTo(104, -18); ctx.quadraticCurveTo(170, 2, 184, 28); ctx.lineTo(150, 32); ctx.lineTo(96, 30); ctx.quadraticCurveTo(84, 6, 104, -18); ctx.fill(); });
    layer(() => { ctx.fillStyle = AMBER; ctx.beginPath(); ctx.moveTo(-178, 30); ctx.lineTo(-181, -16); ctx.quadraticCurveTo(-178, -44, -160, -54); ctx.quadraticCurveTo(-134, -20, -122, 30); ctx.closePath(); ctx.fill(); });
    layer(() => { ctx.fillStyle = '#E8902A'; rrect(-168, -78, 18, 30, 6); ctx.fill(); }, 2);
    // eyestay + laces
    layer(() => { ctx.fillStyle = '#1D3F9C'; ctx.beginPath(); ctx.moveTo(-52, -70); ctx.quadraticCurveTo(10, -44, 76, -24); ctx.lineTo(70, -8); ctx.quadraticCurveTo(4, -28, -58, -52); ctx.closePath(); ctx.fill(); }, 2);
    // laces: diagonal bars over the eyestay, eyelets at both ends, a bow at the top
    for (let i = 0; i < 5; i++) {
      const u = i / 4, xb = -46 + u * 112, yb = -50 + u * 38, xt = xb + 14, yt = yb - 17;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(xb + 1, yb + 2); ctx.lineTo(xt + 1, yt + 2); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(xb, yb); ctx.lineTo(xt, yt); ctx.stroke();
      ctx.fillStyle = '#C9D4EE'; ctx.beginPath(); ctx.arc(xb, yb + 1, 3, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(-34, -68); ctx.quadraticCurveTo(-58, -92, -66, -74); ctx.quadraticCurveTo(-60, -62, -34, -68);
    ctx.moveTo(-34, -68); ctx.quadraticCurveTo(-24, -96, -6, -88); ctx.quadraticCurveTo(-8, -72, -34, -68); ctx.moveTo(-34, -68); ctx.lineTo(-52, -50); ctx.stroke();
    // stitching
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(100, -12); ctx.quadraticCurveTo(88, 8, 100, 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-128, 24); ctx.quadraticCurveTo(-138, -18, -160, -46); ctx.stroke(); ctx.setLineDash([]);
    // paper edge light (cut-paper look)
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-176, -20); ctx.quadraticCurveTo(-174, -52, -152, -62); ctx.stroke();
  }
  const sneakerSpr = () => mk('sneaker', -200, -104, 400, 186, 1.5, sneakerArt);
  window.MC_sneaker = function (st, t, L, n) {
    const sp = sneakerSpr();
    drop(sp, st.x, st.y, st.rot, st.s * .92, st.s * .92, 9);
    at(st.x, st.y, st.rot, st.s * .92, st.s * .92, () => blit(sp));
  };

  // =========================================================================================== ENVELOPES
  // Kraft pay-envelopes, front face up: the back flap open above the mouth, a thumb notch, the note peeking out once
  // filled. Printed stencil label, a dotted field where the amount is written in orange felt pen.
  const EW = G.env.w, EH = G.env.h;
  const ENV_LAYOUT = [
    { lab: -30, lx: 0, amt: 96 },                       // FOURNISSEUR
    { lab: -54, lx: 0, amt: 108 },                      // TRANSPORT (+ lorry + boat)
    { lab: -30, lx: -42, amt: 96 },                     // DOUANE (+ sticker on the right)
    { lab: -54, lx: 0, amt: 108 },                      // PETITS FRAIS (+ 4 doodles)
  ];
  function envBack() {     // flap open above the mouth + the inside of the back panel
    ctx.fillStyle = '#B98D5B'; rrect(-EW / 2 + 3, -EH / 2, EW - 6, EH - 4, 8); ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.22)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    const fg = ctx.createLinearGradient(0, -EH / 2 - 66, 0, -EH / 2); fg.addColorStop(0, '#E2C493'); fg.addColorStop(1, '#CFAA76');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-EW / 2 + 4, -EH / 2 + 2); ctx.quadraticCurveTo(-30, -EH / 2 - 60, 0, -EH / 2 - 66); ctx.quadraticCurveTo(30, -EH / 2 - 60, EW / 2 - 4, -EH / 2 + 2); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .3; ctx.beginPath(); ctx.moveTo(-EW / 2 + 4, -EH / 2 + 2); ctx.quadraticCurveTo(-30, -EH / 2 - 60, 0, -EH / 2 - 66); ctx.quadraticCurveTo(30, -EH / 2 - 60, EW / 2 - 4, -EH / 2 + 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(170,120,60,.55)'; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-EW / 2 + 22, -EH / 2 - 4); ctx.quadraticCurveTo(-26, -EH / 2 - 50, 0, -EH / 2 - 55); ctx.quadraticCurveTo(26, -EH / 2 - 50, EW / 2 - 22, -EH / 2 - 4); ctx.stroke();   // gum strip
  }
  function envPeek(nFill) {   // the note slices tucked in, peeking out of the mouth
    const sp = slice(.5, 1, G.note.w, G.note.h);
    for (let i = 0; i < Math.min(2, nFill); i++) at(-60 + i * 92, -EH / 2 + 30 - i * 6, -.05 + i * .09, .4, .4, () => { ctx.translate(-215, 0); blit(sp); });
  }
  function envFront(k) {
    const r = 9;
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = -1.5;
    ctx.beginPath(); ctx.moveTo(-EW / 2 + r, -EH / 2); ctx.lineTo(-25, -EH / 2); ctx.arc(0, -EH / 2, 25, Math.PI, 0, true); ctx.lineTo(EW / 2 - r, -EH / 2);
    ctx.quadraticCurveTo(EW / 2, -EH / 2, EW / 2, -EH / 2 + r); ctx.lineTo(EW / 2, EH / 2 - r); ctx.quadraticCurveTo(EW / 2, EH / 2, EW / 2 - r, EH / 2);
    ctx.lineTo(-EW / 2 + r, EH / 2); ctx.quadraticCurveTo(-EW / 2, EH / 2, -EW / 2, EH / 2 - r); ctx.lineTo(-EW / 2, -EH / 2 + r); ctx.quadraticCurveTo(-EW / 2, -EH / 2, -EW / 2 + r, -EH / 2); ctx.closePath();
    const bg = ctx.createLinearGradient(0, -EH / 2, 0, EH / 2); bg.addColorStop(0, '#DDBB8A'); bg.addColorStop(1, '#C99F6A');
    ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    ctx.save(); ctx.clip();
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .42; ctx.fillRect(-EW / 2, -EH / 2, EW, EH); ctx.globalAlpha = 1;
    // paper thickness: darker rim, light mouth edge, a soft diagonal crease
    ctx.strokeStyle = 'rgba(110,72,36,.24)'; ctx.lineWidth = 8; rrect(-EW / 2, -EH / 2, EW, EH, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,212,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-EW / 2 + 8, -EH / 2 + 1.5); ctx.lineTo(-27, -EH / 2 + 1.5); ctx.moveTo(27, -EH / 2 + 1.5); ctx.lineTo(EW / 2 - 8, -EH / 2 + 1.5); ctx.stroke();
    const cg = ctx.createLinearGradient(-EW / 2, EH / 2, EW / 2, -EH / 2); cg.addColorStop(.47, 'rgba(255,240,210,0)'); cg.addColorStop(.5, 'rgba(255,240,210,.09)'); cg.addColorStop(.515, 'rgba(90,60,30,.07)'); cg.addColorStop(.56, 'rgba(90,60,30,0)');
    ctx.fillStyle = cg; ctx.fillRect(-EW / 2, -EH / 2, EW, EH);
    ctx.restore();
    // printing: thin frame, the label, the dotted amount field
    const Lo = ENV_LAYOUT[k], lab = S.ITEMS[k].label;
    ctx.strokeStyle = 'rgba(35,22,41,.28)'; ctx.lineWidth = 2; rrect(-EW / 2 + 14, -EH / 2 + 30, EW - 28, EH - 44, 6); ctx.stroke();
    const lf = font(FF.stencil, 60, 900), lw = wid(lab, lf, { ls: 2 });
    const lsz = lw > EW - 60 ? 60 * (EW - 60) / lw : 60;
    txt(lab, Lo.lx, Lo.lab, font(FF.stencil, lsz, 900), INK, { ls: 2 });
    ctx.strokeStyle = 'rgba(35,22,41,.38)'; ctx.lineWidth = 2.2; ctx.setLineDash([3, 6]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-EW / 2 + 34, Lo.amt + 10); ctx.lineTo(EW / 2 - 34, Lo.amt + 10); ctx.stroke(); ctx.setLineDash([]);
  }
  const envBase = (k, nFill) => mk('env' + k + '_' + nFill, -EW / 2 - 8, -EH / 2 - 80, EW + 16, EH + 90, 1.25, () => { envBack(); if (nFill > 0) envPeek(nFill); envFront(k); });
  /** the amount in orange felt pen (sprite; revealed left → right while it is written) */
  const amtSpr = k => mk('amt' + k, -EW / 2, -80, EW, 100, 1.5, () => {
    const s = fmtN(S.ITEMS[k].amount), f = font(FF.hand, 90, 800), w = wid(s, f), sz = w > EW - 24 ? 90 * (EW - 24) / w : 90;
    txt(s, 1.5, 1.5, font(FF.hand, sz, 800), 'rgba(170,52,6,.55)');
    txt(s, 0, 0, font(FF.hand, sz, 800), ORANGE);
  });
  function amount(k, kA, Lo) {
    if (kA <= 0) return;
    const sp = amtSpr(k), s = fmtN(S.ITEMS[k].amount), f = font(FF.hand, 90, 800), w = Math.min(EW - 24, wid(s, f)), x0 = -w / 2 - 6;
    at(0, Lo.amt, 0, 1, 1, () => {
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, -100, (w + 26) * kA + 10, 130); ctx.clip(); blit(sp); ctx.restore();
      if (kA < 1) at(x0 + w * kA, -26, 0, .5, .5, () => marker(0, 0, -.5, ORANGE_D));
    });
  }
  // ---- felt-pen doodles: polylines drawn stroke by stroke (progress p 0..1 over the total length)
  const circ = (cx, cy, r, m = 16) => Array.from({ length: m + 1 }, (_, i) => [cx + Math.cos(i / m * 6.2832) * r, cy + Math.sin(i / m * 6.2832) * r]);
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  const DOODLE = {
    lorry: [rect(-34, -18, 6, 10), [[6, -6], [20, -6], [30, 3], [30, 10], [6, 10]], [[12, -2], [20, -2], [24, 3], [12, 3], [12, -2]], circ(-20, 14, 6), circ(18, 14, 6), [[-46, -6], [-39, -6]], [[-48, 2], [-39, 2]]],
    boat: [[[-36, 2], [36, 2], [26, 16], [-28, 16], [-36, 2]], rect(-24, -10, -9, 2), rect(-9, -10, 6, 2), rect(6, -10, 21, 2), rect(-16, -21, -1, -10), [[26, 2], [26, -14], [32, -14], [32, 2]],
      Array.from({ length: 17 }, (_, i) => [-40 + i * 5, 23 + Math.sin(i * 1.3) * 2.4])],
    plus: [[[-9, 0], [9, 0]], [[0, -9], [0, 9]]],
    taux: [circ(-8, -8, 5, 12), circ(8, 8, 5, 12), [[11, -13], [-11, 13]]],
    pousseur: [[[-18, 4], [12, 4]], rect(-14, -10, 6, 4), [[12, 4], [19, -9]], [[-18, 4], [-21, -3]], circ(-3, 11, 5.5, 12)],
    taxi: [[[-18, 7], [-18, -1], [-10, -2], [-5, -9], [8, -9], [12, -2], [18, 0], [18, 7], [-18, 7]], circ(-9, 8, 4, 10), circ(9, 8, 4, 10), rect(-3, -14, 4, -9)],
    credit: [[[-15, -14], [-3, -14], [-3, 12], [-15, 12], [-15, -14]], [[-12, 7], [-6, 7]], [[3, 8], [3, 4]], [[8, 8], [8, -1]], [[13, 8], [13, -6]]],
  };
  const DLEN = {};
  function doodle(name, p, lw = 4.2, col = INK2) {
    if (p <= 0) return;
    const strokes = DOODLE[name];
    if (!DLEN[name]) DLEN[name] = strokes.map(s => s.reduce((a, q, i) => i ? a + Math.hypot(q[0] - s[i - 1][0], q[1] - s[i - 1][1]) : 0, 0));
    const lens = DLEN[name], tot = lens.reduce((a, b) => a + b, 0); let left = tot * cl(p);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let si = 0; si < strokes.length && left > 0; si++) {
      const s = strokes[si]; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length && left > 0; i++) {
        const sl = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        if (sl <= left) { ctx.lineTo(s[i][0], s[i][1]); left -= sl; } else { const q = left / sl; ctx.lineTo(s[i - 1][0] + (s[i][0] - s[i - 1][0]) * q, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * q); left = 0; }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function handWrite(s, x, y, size, p, col = INK2, align = 'left') {
    if (p <= 0) return;
    const f = font(FF.hand, size, 800), w = wid(s, f), x0 = align === 'center' ? x - w / 2 : x;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y - size * 1.1, (w + 8) * cl(p), size * 1.5); ctx.clip(); txt(s, x0, y, f, col, { align: 'left' }); ctx.restore();
  }
  function artTransport(p) {        // lorry « + » boat drawn stroke by stroke, then the caption
    at(-96, -8, 0, 1.25, 1.25, () => doodle('lorry', kk(p, 0, .42), 3.6));
    at(-6, -8, 0, 1.1, 1.1, () => doodle('plus', kk(p, .42, .5), 4));
    at(92, -8, 0, 1.25, 1.25, () => doodle('boat', kk(p, .5, .9), 3.6));
    handWrite('camion en Chine + bateau', 0, 42, 25, kk(p, .55, 1), INK2, 'center');
  }
  function artFrais(p) {            // « taux · pousseur · taxi · crédit »: one per quarter of the art
    const cells = [['taux', 'taux', -158, -14], ['pousseur', 'pousseur', -14, -14], ['taxi', 'taxi', -158, 26], ['credit', 'crédit', -14, 26]];
    cells.forEach(([d, word, x, y], i) => {
      const q = kk(p, i / 4, (i + 1) / 4); if (q <= 0) return;
      at(x + 18, y - 8, 0, .95, .95, () => doodle(d, kk(q, 0, .6), 3.6));
      handWrite(word, x + 42, y + 2, 28, kk(q, .45, 1));
    });
  }
  /** the yellow sticker on DOUANE: the legal mention of the douane figure (slapped on) */
  const stickerSpr = () => mk('sticker', -118, -112, 236, 228, 1.5, () => {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, -100, 0, 100); g.addColorStop(0, '#FFE680'); g.addColorStop(1, '#FBD54E');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-104, -98); ctx.lineTo(104, -98); ctx.lineTo(104, 72); ctx.quadraticCurveTo(96, 92, 72, 100); ctx.lineTo(-104, 100); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(160,120,0,.18)'; ctx.beginPath(); ctx.moveTo(104, 72); ctx.quadraticCurveTo(96, 92, 72, 100); ctx.lineTo(84, 80); ctx.closePath(); ctx.fill();   // curled corner
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-104, -98, 208, 26);                                                    // the glue band
    const lines = ['exemple ·', 'dépend du', 'code du', 'produit'];
    lines.forEach((l, i) => txt(l, 0, -46 + i * 40, font(FF.hand, 31, 800), i === 0 ? ORANGE_D : INK2));
    ctx.strokeStyle = ORANGE_D; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-62, -36); ctx.quadraticCurveTo(0, -31, 44, -37); ctx.stroke();
  });
  function sticker(p) {
    if (p <= 0) return;
    const e = eOut(p), sc = 1.55 - .55 * e, sp = stickerSpr();
    at(184, -70, .07 + .25 * (1 - e), sc * .93, sc * .93, () => { ctx.globalAlpha *= cl(p * 3); blit(sp); });
  }
  const envDone = (k, nFill) => mk('envD' + k + '_' + nFill, -EW / 2 - 8, -EH / 2 - 80, EW + 140, EH + 90, 1.25, () => {
    blit(envBase(k, nFill)); const Lo = ENV_LAYOUT[k];
    if (k === 1) artTransport(1); if (k === 3) artFrais(1);
    amount(k, 1, Lo); if (k === 2) sticker(1);
  });
  window.MC_envelope = function (it, t, L, n) {
    const k = it.k, nf = Math.min(2, it.fill), Lo = ENV_LAYOUT[k];
    const still = it.active >= 1 && it.stack <= 0 && it.out <= 0, j = still ? jit(30 + k, n, .55) : { x: 0, y: 0, r: 0 };
    const x = it.x + j.x, y = it.y + j.y, rot = it.rot + j.r, sx = it.s * it.sx, sy = it.s * it.sy;
    const lift = 5 + 46 * Math.sin(Math.PI * cl(it.active)) * (it.active < 1 ? 1 : 0) + 70 * Math.sin(Math.PI * cl(it.stack)) + 26 * cl(it.out);
    const complete = it.amountK >= 1 && (k === 0 || it.art >= 1);
    const base = complete ? envDone(k, nf) : envBase(k, nf);
    ctx.save(); ctx.globalAlpha *= it.a;
    drop(envBase(k, nf), x, y, rot, sx, sy, lift);
    at(x, y, rot, sx, sy, () => {
      blit(base);
      if (complete) return;
      if (k === 1) artTransport(it.art);
      if (k === 3) artFrais(it.art);
      amount(k, it.amountK, Lo);
      if (k === 2) sticker(it.art);
    });
    ctx.restore();
  };

  // =========================================================================================== THE SHOE BOX
  // Seen from above: cardboard box, tissue paper, TWO LEFT sneakers lying the same way (same shoe twice) with « G » « G »
  // stickers. The lid whips off, the shoes boing up out of the tissue.
  const BW = G.box.w, BH = G.box.h;
  function leftShoeArt() {          // top view, toes to the right: a LEFT shoe — big-toe bulge and the longest point on the
                                    // bottom (medial) side, the toe box slanting back to the little toe, the arch cut in
    const out = () => { ctx.beginPath(); ctx.moveTo(-88, 2);
      ctx.bezierCurveTo(-88, -16, -74, -27, -52, -28); ctx.bezierCurveTo(-18, -30, 30, -33, 62, -30); ctx.bezierCurveTo(80, -28, 90, -20, 94, -8);
      ctx.bezierCurveTo(98, 4, 100, 14, 96, 24); ctx.bezierCurveTo(90, 38, 66, 44, 46, 40); ctx.bezierCurveTo(28, 37, 18, 26, -2, 21);
      ctx.bezierCurveTo(-24, 17, -44, 25, -66, 23); ctx.bezierCurveTo(-82, 21, -88, 14, -88, 2); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(40,24,10,.32)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3; ctx.fillStyle = '#F4EEE2'; out(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(70,50,40,.45)'; ctx.lineWidth = 2; out(); ctx.stroke();                                                  // sole rim
    ctx.save(); ctx.translate(-1, 1); ctx.scale(.88, .8); const ug = ctx.createLinearGradient(0, -30, 0, 40); ug.addColorStop(0, '#3D71E6'); ug.addColorStop(1, '#2450BE'); ctx.fillStyle = ug; out(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-1, 1); ctx.scale(.88, .8); out(); ctx.clip();
    ctx.fillStyle = '#EFE7D6'; ctx.beginPath(); ctx.moveTo(58, -40); ctx.bezierCurveTo(48, -10, 50, 20, 62, 50); ctx.lineTo(130, 50); ctx.lineTo(130, -40); ctx.closePath(); ctx.fill();   // toe cap
    ctx.restore();
    ctx.fillStyle = '#211A33'; ctx.beginPath(); ctx.ellipse(-50, 0, 25, 13, 0, 0, 7); ctx.fill();                                  // collar opening
    ctx.fillStyle = '#5B86EC'; ctx.beginPath(); ctx.ellipse(-20, 0, 12, 10, 0, 0, 7); ctx.fill();                                   // tongue
    ctx.fillStyle = AMBER; ctx.beginPath(); ctx.moveTo(-88, -8); ctx.quadraticCurveTo(-96, 2, -88, 12); ctx.lineTo(-76, 10); ctx.lineTo(-76, -6); ctx.closePath(); ctx.fill();  // heel tab
    ctx.fillStyle = '#1D3F9C'; rrect(-8, -14, 52, 28, 11); ctx.fill();                                                               // eyestay
    for (let i = 0; i < 4; i++) { const x = -1 + i * 12;
      ctx.fillStyle = '#E9EEF8'; ctx.beginPath(); ctx.arc(x, -10, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x, 10, 2.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, 10); ctx.stroke(); }   // straight lacing
  }
  const shoeSpr = () => mk('lshoe', -100, -46, 200, 92, 1.5, leftShoeArt);
  const gSpr = () => mk('gstk', -34, -34, 68, 68, 2, () => {
    ctx.save(); ctx.shadowColor = 'rgba(40,24,10,.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 23, 0, 7); ctx.stroke();
    txt('G', 0, 15, font(FF.hand, 42, 800), ORANGE);
  });
  const SHOES = [{ x: -2, y: -50, r: -.04, s: 1.12 }, { x: 10, y: 52, r: .03, s: 1.12 }];
  function boxBaseArt() {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.18)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    const rg = ctx.createLinearGradient(0, -BH / 2, 0, BH / 2); rg.addColorStop(0, '#F1EBDF'); rg.addColorStop(1, '#E2D9C8');
    ctx.fillStyle = rg; rrect(-BW / 2, -BH / 2, BW, BH, 8); ctx.fill(); ctx.restore();
    const ix = -BW / 2 + 13, iy = -BH / 2 + 13, iw = BW - 26, ih = BH - 26;
    ctx.fillStyle = '#C7B79E'; ctx.fillRect(ix, iy, iw, ih);
    // tissue paper, crumpled
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    ctx.fillStyle = '#F7F4EC'; ctx.beginPath(); const tp = tornLine(ix + 6, iy + 8, ix + iw - 4, iy + 4, 81, 5, 16), bp = tornLine(ix + iw - 8, iy + ih - 6, ix + 4, iy + ih - 2, 87, 5, 16);
    ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bp) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 16; i++) { const x0 = ix + rnd(i * 3.3) * iw, y0 = iy + rnd(i * 5.1) * ih, a = rnd(i * 7.7) * Math.PI, l = 30 + rnd(i * 2.2) * 70;
      ctx.strokeStyle = i % 2 ? 'rgba(170,160,140,.35)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); ctx.stroke(); }
    for (let i = 0; i < 7; i++) { const x0 = ix + rnd(i * 9.1) * iw, y0 = iy + rnd(i * 4.4) * ih; ctx.fillStyle = 'rgba(150,140,120,.10)'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 60, y0 + 18); ctx.lineTo(x0 + 20, y0 + 50); ctx.closePath(); ctx.fill(); }
    // inner walls: shade on the top / left faces, light on the bottom / right
    const sg = ctx.createLinearGradient(0, iy, 0, iy + 26); sg.addColorStop(0, 'rgba(70,45,20,.36)'); sg.addColorStop(1, 'rgba(70,45,20,0)'); ctx.fillStyle = sg; ctx.fillRect(ix, iy, iw, 26);
    const sl = ctx.createLinearGradient(ix, 0, ix + 22, 0); sl.addColorStop(0, 'rgba(70,45,20,.26)'); sl.addColorStop(1, 'rgba(70,45,20,0)'); ctx.fillStyle = sl; ctx.fillRect(ix, iy, 22, ih);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.strokeRect(ix - 1, iy - 1, iw + 2, ih + 2);
    ctx.strokeStyle = 'rgba(90,70,50,.22)'; ctx.lineWidth = 1.5; rrect(-BW / 2 + 1, -BH / 2 + 1, BW - 2, BH - 2, 8); ctx.stroke();
  }
  const boxBase = () => mk('boxBase', -BW / 2 - 6, -BH / 2 - 6, BW + 12, BH + 12, 1.25, boxBaseArt);
  const lidSpr = () => mk('boxLid', -BW / 2 - 14, -BH / 2 - 14, BW + 28, BH + 28, 1.25, () => {
    const lw = BW + 12, lh = BH + 12;
    const g = ctx.createLinearGradient(0, -lh / 2, 0, lh / 2); g.addColorStop(0, '#F3EEE4'); g.addColorStop(1, '#E4DCCD');
    ctx.fillStyle = g; rrect(-lw / 2, -lh / 2, lw, lh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(120,96,70,.28)'; ctx.lineWidth = 10; rrect(-lw / 2 + 5, -lh / 2 + 5, lw - 10, lh - 10, 6); ctx.stroke();      // the lid's rim
    ctx.fillStyle = INK; ctx.fillRect(-lw / 2 + 10, lh * .16, lw - 20, 30);                                                            // printed band
    ctx.save(); ctx.translate(-10, -20); ctx.scale(.42, .42); ctx.globalAlpha = .7; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineJoin = 'round';       // generic shoe outline print
    ctx.beginPath(); ctx.moveTo(-170, 40); ctx.lineTo(-174, -40); ctx.quadraticCurveTo(-150, -66, -110, -58); ctx.lineTo(-60, -70); ctx.quadraticCurveTo(60, -30, 150, 4); ctx.quadraticCurveTo(186, 20, 180, 44); ctx.closePath(); ctx.stroke(); ctx.restore();
  });
  /** the shoes boing up out of the tissue (feet 0..1), the « G » stickers slap one after the other */
  function shoesAndG(feet) {
    if (feet <= 0) return;
    SHOES.forEach((s, i) => {
      const q = kk(feet, i * .18, .7 + i * .18), sc = .55 + .45 * back(q, 2.4);
      if (q > 0) at(s.x, s.y, s.r + (1 - q) * .25 * (i ? 1 : -1), sc * s.s, sc * s.s, () => blit(shoeSpr()));
    });
    SHOES.forEach((s, i) => { const q = kk(feet, .55 + i * .16, .78 + i * .16); if (q > 0) { const sc = (1.6 - .6 * eOut(q)) * .9; at(s.x - 56 * s.s, s.y + (i ? -2 : 2), -.12, sc, sc, () => { ctx.globalAlpha *= cl(q * 3); blit(gSpr()); }); } });
    const qx = kk(feet, .86, 1); if (qx > 0) at(BW / 2 - 52, -4, .1, 1, 1, () => handWrite('?!', -26, 22, 66, qx, ORANGE, 'left'));     // felt-pen « ?! »
  }
  /** the last slice of the note, lying in the box along the bottom wall */
  function lastBit() { at(40, 92, 1.5, .44, .44, () => { const sp = slice(S.EDGES[5], 1, G.note.w, G.note.h); ctx.translate(-((S.EDGES[5] + 1) / 2 - .5) * G.note.w, 0); blit(sp); }); }
  const boxDone = nFill => mk('boxDone' + nFill, -BW / 2 - 6, -BH / 2 - 40, BW + 12, BH + 46, 1.25, () => {
    blit(boxBase()); shoesAndG(1);
    if (nFill > 0) lastBit();
  });
  window.MC_box = function (it, t, L, n) {
    const bo = it.boing || { sx: 1, sy: 1 }, nf = Math.min(1, it.fill);
    const still = it.active >= 1 && it.stack <= 0 && it.out <= 0, j = still ? jit(44, n, .5) : { x: 0, y: 0, r: 0 };
    const x = it.x + j.x, y = it.y + j.y, rot = it.rot + j.r, sx = it.s * it.sx * bo.sx, sy = it.s * it.sy * bo.sy;
    const lift = 7 + 46 * Math.sin(Math.PI * cl(it.active)) * (it.active < 1 ? 1 : 0) + 70 * Math.sin(Math.PI * cl(it.stack)) + 26 * cl(it.out);
    const complete = it.lid >= 1 && it.feet >= 1 && t >= A.feet + .55;
    drop(boxBase(), x, y, rot, sx, sy, lift);
    at(x, y, rot, sx, sy, () => {
      if (complete) { blit(boxDone(nf)); return; }
      blit(boxBase());
      // the feet animation is slower than the state ramp: q runs on the score time A.feet
      shoesAndG(it.feet > 0 ? kk(t, A.feet, A.feet + .55) : 0);
      if (nf > 0) lastBit();
    });
    if (it.lid < 1) {        // the lid whips off to the top-left, lifting toward the lens
      const e = eOut(it.lid), lx = x - 720 * e * it.s, ly = y - 420 * e * it.s, lr = rot - .7 * e, ls = 1 + .18 * Math.sin(Math.PI * Math.min(1, e * 1.4));
      drop(lidSpr(), lx, ly, lr, sx * ls, sy * ls, 8 + 110 * Math.sin(Math.PI * Math.min(1, e * 1.2)));
      at(lx, ly, lr, sx * ls, sy * ls, () => blit(lidSpr()));
    }
  };

  // =========================================================================================== THE CALCULATOR
  // A sturdy dark calculator: printed « RESTE SUR LE BILLET », a recessed 7-segment LCD (ghost « 8 », real segments),
  // the backlight flashes on every change, TOI's « ? » blinks amber, the figure turns red at « 0 F ».
  const CW = G.calc.w, CH = G.calc.h;
  const LCD = { x: -164, y: -74, w: 328, h: 136 };
  const calcBody = label => mk('calcBody', -CW / 2 - 4, -CH / 2 - 4, CW + 8, CH + 8, 1.25, () => {
    const g = ctx.createLinearGradient(0, -CH / 2, 0, CH / 2); g.addColorStop(0, '#3D3346'); g.addColorStop(1, '#211A27');
    ctx.fillStyle = g; rrect(-CW / 2, -CH / 2, CW, CH, 32); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-CW / 2 + 30, -CH / 2 + 2); ctx.lineTo(CW / 2 - 30, -CH / 2 + 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; rrect(-CW / 2 + 1.5, -CH / 2 + 1.5, CW - 3, CH - 3, 31); ctx.stroke();
    txt(label, 0, -CH / 2 + 37, font(FF.mono, 25, 800), '#F4E9D6', { ls: .5 });
    ctx.fillStyle = '#120D16'; rrect(LCD.x - 8, LCD.y - 8, LCD.w + 16, LCD.h + 16, 16); ctx.fill();                          // bezel
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LCD.x - 4, LCD.y + LCD.h + 8); ctx.lineTo(LCD.x + LCD.w + 4, LCD.y + LCD.h + 8); ctx.stroke();
    const keys = 5, kw = 52, kg = (CW - 60 - keys * kw) / (keys - 1);                                                           // a row of keys
    for (let i = 0; i < keys; i++) { const x = -CW / 2 + 30 + i * (kw + kg), y = CH / 2 - 44;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(x + 1, y + 4, kw, 28, 9); ctx.fill();
      ctx.fillStyle = i === keys - 1 ? ORANGE : '#E9E1D3'; rrect(x, y, kw, 26, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; rrect(x + 5, y + 3, kw - 10, 6, 3); ctx.fill(); }
    for (const [sx, sy] of [[-1, -1], [1, -1]]) { ctx.fillStyle = '#4B4254'; ctx.beginPath(); ctx.arc(sx * (CW / 2 - 18), sy * (CH / 2 - 18) + 2, 4.5, 0, 7); ctx.fill(); }
  });
  const glassSpr = () => mk('lcdGlass', LCD.x, LCD.y, LCD.w, LCD.h, 1.25, () => {
    const g = ctx.createLinearGradient(0, LCD.y, 0, LCD.y + 26); g.addColorStop(0, 'rgba(20,30,15,.32)'); g.addColorStop(1, 'rgba(20,30,15,0)');
    ctx.fillStyle = g; ctx.fillRect(LCD.x, LCD.y, LCD.w, 26);
    const gl = ctx.createLinearGradient(LCD.x, LCD.y, LCD.x + LCD.w, LCD.y + LCD.h); gl.addColorStop(0, 'rgba(255,255,255,.0)'); gl.addColorStop(.3, 'rgba(255,255,255,.16)'); gl.addColorStop(.36, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(LCD.x, LCD.y, LCD.w, LCD.h);
  });
  const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function seg7(on, x, y, w, h, th) {     // one digit cell, top-left (x, y); on = 'abc…'
    const gp = 2.2, hs = (cx, cy, len) => { ctx.moveTo(cx - len / 2, cy); ctx.lineTo(cx - len / 2 + th / 2, cy - th / 2); ctx.lineTo(cx + len / 2 - th / 2, cy - th / 2); ctx.lineTo(cx + len / 2, cy); ctx.lineTo(cx + len / 2 - th / 2, cy + th / 2); ctx.lineTo(cx - len / 2 + th / 2, cy + th / 2); ctx.closePath(); };
    const vs = (cx, cy, len) => { ctx.moveTo(cx, cy - len / 2); ctx.lineTo(cx + th / 2, cy - len / 2 + th / 2); ctx.lineTo(cx + th / 2, cy + len / 2 - th / 2); ctx.lineTo(cx, cy + len / 2); ctx.lineTo(cx - th / 2, cy + len / 2 - th / 2); ctx.lineTo(cx - th / 2, cy - len / 2 + th / 2); ctx.closePath(); };
    const lh = w - th - 2 * gp, lv = h / 2 - th / 2 - 2 * gp;
    const P = { a: () => hs(x + w / 2, y + th / 2, lh), g: () => hs(x + w / 2, y + h / 2, lh), d: () => hs(x + w / 2, y + h - th / 2, lh),
      f: () => vs(x + th / 2, y + h / 4 + th / 4, lv), b: () => vs(x + w - th / 2, y + h / 4 + th / 4, lv), e: () => vs(x + th / 2, y + 3 * h / 4 - th / 4, lv), c: () => vs(x + w - th / 2, y + 3 * h / 4 - th / 4, lv) };
    ctx.beginPath(); for (const ch of on) P[ch](); ctx.fill();
  }
  window.MC_calc = function (st, t, L, n) {
    const body = calcBody(st.label || 'RESTE SUR LE BILLET');
    drop(body, st.x, st.y, st.rot, st.s, st.s, 15);
    at(st.x, st.y, st.rot, st.s, st.s, () => {
      ctx.globalAlpha *= st.a;
      blit(body);
      // LCD backlight: normal · flash on a change · amber while TOI's « ? » blinks · a red cast at « 0 F »
      const ask = st.ask ? 1 : 0, z = cl(st.zero), fl = cl(st.flash);
      const base = [195, 211, 172], flc = [232, 244, 206], amb = [244, 214, 150], red = [236, 198, 186];
      const mix = (c, d, k) => c.map((v, i) => v + (d[i] - v) * k);
      let bg = mix(base, flc, fl * .9); bg = mix(bg, amb, ask * .85); bg = mix(bg, red, z * .6);
      const lg = ctx.createLinearGradient(0, LCD.y, 0, LCD.y + LCD.h);
      lg.addColorStop(0, `rgb(${bg.map(v => Math.round(v * .93)).join(',')})`); lg.addColorStop(1, `rgb(${bg.map(Math.round).join(',')})`);
      ctx.fillStyle = lg; rrect(LCD.x, LCD.y, LCD.w, LCD.h, 10); ctx.fill();
      // digits (right-aligned, thousands gap), ghost 8s behind
      const v = Math.max(0, Math.round(st.value)), ds = String(v), cells = Math.max(4, ds.length);
      const unit = 34, xr = LCD.x + LCD.w - 14 - unit - 8;
      let dw = 54, th = 12.5, sp = 11, kg = 18, dh = 104;
      const need = cells * dw + (cells - 1) * sp + kg, room = xr - (LCD.x + 12);
      if (need > room) { const q = room / need; dw *= q; th *= q; sp *= q; kg *= q; dh *= q; }
      const y0 = LCD.y + (LCD.h - dh) / 2, ink = z > .5 ? '#C0261C' : '#1E2B1B';
      ctx.save(); ctx.translate(0, y0 + dh); ctx.transform(1, 0, -.08, 1, 0, 0); ctx.translate(0, -(y0 + dh));
      for (let c = 0; c < cells; c++) {
        const fromRight = cells - 1 - c, x = xr - dw - fromRight * (dw + sp) - (fromRight >= 3 ? kg : 0);
        const ch = ds.length > fromRight ? ds[ds.length - 1 - fromRight] : null;
        ctx.fillStyle = 'rgba(30,43,27,.075)'; seg7(SEGS[8], x, y0, dw, dh, th);
        if (ch != null) { ctx.fillStyle = ink; seg7(SEGS[ch], x, y0, dw, dh, th); }
      }
      ctx.restore();
      txt('F', LCD.x + LCD.w - 14 - unit / 2, y0 + dh, font(FF.brand, 42, 900), ink);
      blit(glassSpr());
      // TOI's « ? »: an amber badge pops on the corner, in time with the backlight
      // QA: perched above the corner (it used to cover « BILLET »), right edge ≤ x 960
      if (ask) at(CW / 2 - 30, -CH / 2 - 20, .12, 1, 1, () => {
        ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.restore();
        txt('?', 0, 21, font(FF.brand, 58, 900), INK);
      });
    });
  };

  // =========================================================================================== STAMPS
  /** rubber-stamp impression sprite: lines [{s, size, ls}] in one ink, optional box, starved, slight misregistration */
  function inkSpr(key, lines, col, o = {}) {
    const W0 = o.w || 900, H0 = o.h || 260;
    return mk(key, -W0 / 2, -H0 / 2, W0, H0, 1.25, () => {
      const draw = () => {
        lines.forEach(l => txt(l.s, 0, l.y, font(l.fam || FF.stencil, l.size, 900), col, { ls: l.ls || 0 }));
        if (o.box) { ctx.strokeStyle = col; ctx.lineWidth = o.boxW || 10; rrect(-o.box[0] / 2, -o.box[1] / 2 + (o.boxDy || 0), o.box[0], o.box[1], 18); ctx.stroke(); }
      };
      ctx.save(); ctx.globalAlpha = .22; ctx.translate(2.5, 2); draw(); ctx.restore();
      draw();
      starve(-W0 / 2, -H0 / 2, W0, H0, o.starve ?? .5, o.seed || 3);
      if (o.splat) for (let i = 0; i < 14; i++) { const a = rnd(i * 4.1 + o.seed) * 6.28, r = (o.splat[0] + rnd(i * 2.7) * 60), s = 2 + rnd(i * 6.3) * 5;
        ctx.fillStyle = col; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(Math.cos(a) * r * o.splat[1], Math.sin(a) * r * o.splat[2], s, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    });
  }
  const invSpr = () => inkSpr('stInv', [{ s: '5 PAIRES SUR 100 :', y: -22, size: 96, ls: 2 }, { s: 'INVENDABLES', y: 82, size: 116, ls: 6 }], ORANGE, { w: 900, h: 240, box: [830, 212], boxW: 9, starve: .38, seed: 7 });
  const invSubSpr = () => mk('stInvSub', -420, -44, 840, 88, 1.25, () => {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.22)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4; ctx.fillStyle = CREAM; tornRect(800, 70, 61, 2.2); ctx.fill(); ctx.restore();
    const f = font(FF.body, 44, 800), a = 'leur coût retombe sur les autres paires : ', b = '−500', wa = wid(a, f, { stretch: 'condensed' }), wb = wid(b, f, { stretch: 'condensed' }), x0 = -(wa + wb) / 2;
    txt(a, x0, 15, f, INK, { align: 'left', stretch: 'condensed' }); txt(b, x0 + wa, 15, f, ORANGE_D, { align: 'left', stretch: 'condensed' });
  });
  const zeroCard = () => mk('zeroCard', -462, -250, 924, 500, 1.25, () => {
    const cw = 860, ch = 420;
    ctx.fillStyle = '#D9CCB4'; rrect(-cw / 2 + 5, -ch / 2 + 7, cw, ch, 22); ctx.fill();                                                      // card thickness
    const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2); g.addColorStop(0, '#FFFCF4'); g.addColorStop(1, '#F4ECDC');
    ctx.fillStyle = g; rrect(-cw / 2, -ch / 2, cw, ch, 22); ctx.fill();
    ctx.save(); rrect(-cw / 2, -ch / 2, cw, ch, 22); ctx.clip();
    for (let i = 0; i < 260; i++) { const x = (rnd(i * 1.9) - .5) * cw, y = (rnd(i * 2.9) - .5) * ch, a = rnd(i * 3.9) * 3.14, l = 3 + rnd(i * 4.9) * 9; ctx.strokeStyle = 'rgba(150,115,75,.08)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 11; rrect(-cw / 2 + 26, -ch / 2 + 26, cw - 52, ch - 52, 14); ctx.stroke();
    ctx.lineWidth = 3; rrect(-cw / 2 + 42, -ch / 2 + 42, cw - 84, ch - 84, 10); ctx.stroke();
    txt('PRIX CHINOIS × 2', 4, -62 + 4, font(FF.stencil, 108, 900), 'rgba(120,40,10,.14)', { ls: 2 });
    txt('PRIX CHINOIS × 2', 0, -62, font(FF.stencil, 108, 900), ORANGE, { ls: 2 });
    ctx.strokeStyle = 'rgba(52,44,62,.3)'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 10]); rrect(-235, -34, 470, 192, 14); ctx.stroke(); ctx.setLineDash([]);
  });
  const zeroEq = () => inkSpr('zeroEq', [{ s: '= 0', y: 86, size: 250, ls: 6 }], ZERO_INK, { w: 520, h: 300, starve: .32, seed: 19, splat: [150, 1.15, .62] });
  window.MC_stamp = function (st, t, L, n) {
    if (st.k <= 0 || st.a <= 0) return;
    ctx.save(); ctx.globalAlpha *= st.a;
    if (st.id === 'invendables') {
      // the stamp slams on « cent » (k), the explanation strip slides in right under it
      const k = st.k, sc = 1.5 - .5 * eIn(k), sq = S.squash(t, A.stampInv, .06), sp = invSpr();
      at(st.x, st.y - 8, st.rot, st.s * sc * sq.sx, st.s * sc * sq.sy, () => { ctx.globalAlpha *= cl(k * 2.5); ctx.globalCompositeOperation = 'multiply'; blit(sp); });
      const ks = kk(t, A.stampInv + .06, A.stampInv + .3);
      if (ks > 0) { const sub = invSubSpr(), e = eOut(ks), yy = st.y + 134 + 26 * (1 - e);
        drop(sub, st.x, yy, st.rot * .5 + .006, st.s, st.s, 4 + 26 * (1 - e), cl(ks * 2));
        at(st.x, yy, st.rot * .5 + .006, st.s, st.s, () => { ctx.globalAlpha *= cl(ks * 2); blit(sub); }); }
    } else {
      // the giant card falls in slow motion (s 1.1 → 1, shadow tightening), « = 0 » is printed on « zéro »
      const k = st.k, sq = st.landed || { sx: 1, sy: 1 }, card = zeroCard(), lift = 6 + 170 * Math.pow(1 - k, 1.3);
      drop(card, st.x, st.y, st.rot, st.s * sq.sx, st.s * sq.sy, lift);
      at(st.x, st.y, st.rot, st.s * sq.sx, st.s * sq.sy, () => {
        blit(card);
        const q = cl(st.eqK ?? 0);
        if (q > 0) { const sc = 1.45 - .45 * eIn(q); at(0, 66, -.04, sc, sc, () => { ctx.globalAlpha *= cl(q * 2.2); ctx.globalCompositeOperation = 'multiply'; blit(zeroEq()); }); }
      });
    }
    ctx.restore();
  };

  // =========================================================================================== THE PILE (the rule)
  const pileLbl = () => mk('pileLbl', -290, -60, 580, 120, 1.25, () => {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.24)'; ctx.shadowBlur = 9; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 5; ctx.fillStyle = CREAM; tornRect(540, 88, 37, 2.6); ctx.fill(); ctx.restore();
    tapeBit(-252, -36, -.5, 70); tapeBit(252, -36, .5, 70);
    txt('TOUT CE QUE TU PAIES', 0, 21, font(FF.stencil, 58, 900), INK, { ls: 1.5 });
  });
  const tagSpr = () => mk('pileTag', -200, -150, 400, 290, 1.25, () => {
    const w = 360, h = 236, c = 46;
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 36, -h / 2 + 38); ctx.bezierCurveTo(-w / 2 - 6, -h / 2 - 16, -w / 2 + 30, -h / 2 - 40, -w / 2 + 4, -h / 2 - 26); ctx.stroke();   // string
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#D9B98A'; ctx.beginPath(); ctx.moveTo(-w / 2 + c, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + c, h / 2); ctx.lineTo(-w / 2, h / 2 - c); ctx.lineTo(-w / 2, -h / 2 + c); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.clip(); ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .35; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(-w / 2 + 36, -h / 2 + 38, 15, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(-w / 2 + 36, -h / 2 + 38, 7, 0, 7); ctx.fill();
    txt('TON VRAI', 18, -14, font(FF.stencil, 66, 900), INK, { ls: 3 });
    txt('PRIX', 18, 86, font(FF.stencil, 108, 900), ORANGE, { ls: 6 });
  });
  window.MC_pile = function (st, t, L, n) {
    ctx.save(); ctx.globalAlpha *= st.a;
    // « TOUT CE QUE TU PAIES » above the pile (kept 40 px inside the frame)
    if (st.labelK > 0) {
      const k = st.labelK, e = eOut(k), sc = 1.22 - .22 * e, lx = st.x + Math.max(0, 300 - G.pile.x), ly = st.y - 250 + (1 - e) * -20;
      drop(pileLbl(), lx, ly, -.03, sc, sc, 4 + 40 * (1 - e), cl(k * 3));
      at(lx, ly, -.03, sc, sc, () => { ctx.globalAlpha *= cl(k * 3); blit(pileLbl()); });
    }
    // the felt-pen arrow: pile → price tag
    if (st.arrowK > 0) handArrow([[st.x + 150, st.y - 84], [st.x + 212, st.y - 150], [st.tagX - 218, st.tagY - 118], [st.tagX - 210, st.tagY - 34]], st.arrowK, ORANGE, 10);
    // « TON VRAI PRIX »: a kraft price tag, springing in (may overshoot)
    const k = Math.min(1.18, Math.max(0, st.tagK));
    if (k > .01) {
      const sw = .05 - .14 * (1 - Math.min(1, k)), sp = tagSpr();
      drop(sp, st.tagX, st.tagY, sw, k, k, 10);
      at(st.tagX, st.tagY, sw, k, k, () => blit(sp));
    }
    ctx.restore();
  };

  // =========================================================================================== CRUMBS
  const crumbSpr = i => mk('crumb' + i, -24, -18, 48, 36, 2, () => {
    const w = G.note.w, h = G.note.h, src = i ? [230, -112] : [118, 118], R = i ? [15, 10] : [17, 11];
    const path = () => { ctx.beginPath(); for (let j = 0; j < 9; j++) { const a = j / 9 * 6.283, r = .72 + rnd(i * 17 + j * 3.3) * .4; j ? ctx.lineTo(Math.cos(a) * R[0] * r, Math.sin(a) * R[1] * r) : ctx.moveTo(Math.cos(a) * R[0] * r, Math.sin(a) * R[1] * r); } ctx.closePath(); };
    ctx.save(); path(); ctx.clip(); ctx.translate(-src[0], -src[1]); blit(noteFull(w, h)); ctx.restore();
    ctx.strokeStyle = 'rgba(250,248,236,.95)'; ctx.lineWidth = 1.3; path(); ctx.stroke();
  });
  window.MC_crumb = function (c, t, L, n) {
    if (c.s <= .01) return;
    const sp = crumbSpr(c.i || 0), sc = c.s * 1.25;
    drop(sp, c.x, c.y, c.rot, sc, sc, 10);
    at(c.x, c.y, c.rot, sc, sc, () => { ctx.globalAlpha *= c.a; blit(sp); });
  };
})();
