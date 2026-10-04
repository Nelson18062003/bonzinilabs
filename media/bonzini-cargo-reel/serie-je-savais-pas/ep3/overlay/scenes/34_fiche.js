'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — M2 « the fiche, the sample, Bonzini & end », part 1: THE FICHE (prefix FS_).
// Functions only: 50_compose.js calls them with the states SCORE computes (01_score.js). Every time is read from SCORE.A
// or from a state; every static look is a cached offscreen sprite; deterministic (rnd); no ctx.filter.
//
//   FS_fiche(F, t, L)   world. F = SCORE.fiche(t). The blank order sheet (good paper, ruled, punched, a lifted corner)
//                       slides in; 4 small satin-amber plates MATIÈRE · TAILLE · POIGNÉES · EMBALLAGE (72 px, letterpress)
//                       fall on the words (F.lines[i].k) with a puff of paper dust; TOI's felt-pen « details » next to
//                       each line (illegible loops on purpose, l.scrib, the pen tip of FS_gloves rides their head); the
//                       brush ✓ of each line (l.check, drawn on); the orange starved-ink stamp « ÉCRIS TOUT »
//                       (Stencil 120 px, F.stamp, multiply on the paper); the violet note « + MON ÉTIQUETTE BONZINI / SUR
//                       CHAQUE CARTON » pinned at the foot (52 px, F.note, the film's first violet). It all shrinks with
//                       the sheet to the thumbnail (F.x/y/s/rot). Takes over the texts 'stampAll' and 'note'.
//   FS_tags(list, t, L) world. SCORE.tags(t): the 3 orange card tags « TAILLE ? » « MATIÈRE ? » « POIGNÉES ? » (Satoshi 900
//                       52 px, white): pinned on the received bag by a dressmaker pin and a cotton string ('pin'),
//                       unpinned and drifting ('hang', the loose string trails), flying to their line's ✓ ('fly'), fading
//                       into it (q.check). The grommet end always faces the pin.
//   window.FS_lib       shared helpers for 36_sample.js / 70_bonzini.js / 76_end.js (sprite cache, palette, soft shadows,
//                       dust puffs, starved-ink stamps, the black rigid tote, the oblique kraft carton).
// =============================================================================================
const FS_lib = (function () {
  const S = window.SCORE, G = S.G, A = S.A, OB = S.OBL;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const P = {
    ink: '#1A1426', inkS: '#4A3A52', cream: '#FFF6E8', paper: '#FBF6EC', orange: '#FE560D', amber: '#F3A745', amberD: '#B86E0C',
    brown: '#2A1606', vio: '#7B4BFF', vioL: '#A947FE', vioD: '#5B2BDF', vioDD: '#3B17A8', vioInk: '#4A1FC2', sea: '#0B5FA5', seaD: '#083F70',
    seaT: '#E6F0FA', kraft: '#C79E6C', pen: '#22306E', muted: '#5A5560', hair: '#D8D6DA', steel: '#5E6878',
  };
  const hexRgb = h => { if (h[0] !== '#') { const m = h.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${cl(a).toFixed(3)})`;
  const litC = (hex, x, y, L, b = 0) => hexRgb(lit(hex, x, y, L, b));

  // ------------------------------------------------------------------ sprite cache (ep. 1/2 pattern)
  // draw(w, h) runs with the global ctx swapped to an offscreen canvas (every kit helper works), origin at (ox, oy).
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  /** a pre-blurred soft shadow of a rounded rect (shadowBlur once, at build time), black: tint with globalAlpha */
  function shadowSprite(key, w, h, r, blur) {
    return sprite(key, w + blur * 6, h + blur * 6, () => {
      ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000; ctx.fillStyle = '#000';
      rrect(-w / 2 - 20000, -h / 2, w, h, r); ctx.fill(); ctx.restore();
    });
  }
  let BLOB = null;
  function blob() {
    if (BLOB) return BLOB;
    const c = makeCanvas(128, 128), g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(.45, 'rgba(0,0,0,.62)'); rg.addColorStop(.75, 'rgba(0,0,0,.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128); return (BLOB = c);
  }
  /** a soft dark ellipse (contact / cast shadow of a small thing) */
  function softShadow(x, y, rx, ry, a, rot = 0) {
    if (a <= .004) return; ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(blob(), -rx, -ry, 2 * rx, 2 * ry); ctx.restore();
  }
  // ------------------------------------------------------------------ dust puffs (baked cloud sprites, no rotation)
  let DS = null;
  function dustSprites() {
    if (DS) return DS;
    const mk = (seed, col) => {
      const N = 96, c = makeCanvas(N, N), g = c.getContext('2d');
      for (let i = 0; i < 8; i++) {
        const x = N / 2 + (R(i, seed) - .5) * N * .34, y = N / 2 + (R(i, seed + 1) - .5) * N * .34, r = N * (.2 + .2 * R(i, seed + 2));
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${col},${(.3 + .3 * R(i, seed + 3)).toFixed(2)})`); rg.addColorStop(.6, `rgba(${col},${(.12 + .1 * R(i, seed + 4)).toFixed(2)})`); rg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, N, N);
      }
      return c;
    };
    DS = { warm: [0, 1, 2].map(k => mk(300 + k * 7, '186,150,104')), light: [0, 1, 2].map(k => mk(400 + k * 7, '252,246,234')) };
    return DS;
  }
  /** dust puffs from emitters [{x, y, nx, ny, s}] at progress k (0..1); o {n, seed, dist, size, a, spread, rise, tj, out, light} */
  function puffs(ems, k, o = {}) {
    if (k <= 0 || k >= 1) return;
    const grow = 1 - Math.pow(1 - k, 3.2), fade = Math.pow(1 - k, 1.4) * cl(k * 16);
    const out = o.out ?? 10, n = o.n || 6, seed = o.seed || 1, dist = o.dist || 90, size = o.size || 34, A0 = o.a ?? .6, spread = o.spread ?? .9, rise = o.rise ?? 26, tj = o.tj ?? 30;
    const D = dustSprites(), spr = o.light ? D.light : D.warm; let id = 0;
    ctx.save();
    for (const e of ems) {
      const nl = Math.hypot(e.nx, e.ny) || 1, nx = e.nx / nl, ny = e.ny / nl, base = Math.atan2(ny, nx), str = e.s ?? 1;
      for (let j = 0; j < n; j++, id++) {
        const r1 = R(id, seed), r2 = R(id, seed + 1), r3 = R(id, seed + 2), r4 = R(id, seed + 3), r5 = R(id, seed + 4);
        const a = base + (r1 - .5) * spread, dd = dist * (.25 + .75 * r2) * str * grow, tg = (r5 - .5) * tj;
        const px = e.x + nx * out - ny * tg + Math.cos(a) * dd, py = e.y + ny * out + nx * tg + Math.sin(a) * dd * .75 - rise * grow * (.3 + .7 * r3);
        const rad = size * (.55 + 1.1 * grow) * (.65 + .55 * r3) * Math.sqrt(str), al = A0 * fade * (.55 + .45 * r4);
        if (al < .01) continue;
        ctx.globalAlpha = al; ctx.drawImage(spr[id % 3], px - rad, py - rad, 2 * rad, 2 * rad);
      }
    }
    ctx.restore();
  }
  let MC = null;
  function measureW(s, f, ls = 0) { if (!MC) MC = makeCanvas(8, 8).getContext('2d'); MC.font = f; MC.letterSpacing = ls + 'px'; const w = MC.measureText(s).width; MC.letterSpacing = '0px'; return w; }
  /** the font size (≤ z) at which s fits maxW */
  function fit(s, fam, z, maxW, min = 10, ls = 0) { let q = z; while (q > min && measureW(s, fam.replace('#', q), ls) > maxW) q -= 1; return q; }

  // ------------------------------------------------------------------ starved-ink rubber stamp (orange / amber), cached
  /** lines in a double-bordered box, starved ink; returns {c (2×), w, h}. o = {font ('#' = size), size, ls, color, tick, pad, padY, lineH} */
  const STAMPS = {};
  function buildStamp(lines, o) {
    const z = o.size || 110, f = (o.font || '900 #px Stencil').replace('#', z), ls = o.ls ?? 3, col = o.color || P.orange, lh = (o.lineH || 1.0) * z;
    const tickW = o.tick ? z * .78 : 0;
    const tw = Math.max(...lines.map((l, i) => measureW(l, f, ls) + (o.tick && i === lines.length - 1 ? tickW + z * .2 : 0)));
    const pad = o.pad ?? 44, bw = Math.ceil(tw + 2 * pad), bh = Math.ceil(lh * lines.length + (o.padY ?? 34) * 2), sc = 2;
    const c = makeCanvas((bw + 40) * sc, (bh + 40) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((bw + 40) / 2, (bh + 40) / 2);
      g.strokeStyle = col; g.lineWidth = o.border ?? 10; rrect(-bw / 2, -bh / 2, bw, bh, 18); g.stroke();
      if (o.double !== false) { g.lineWidth = 3.5; rrect(-bw / 2 + 14, -bh / 2 + 14, bw - 28, bh - 28, 10); g.stroke(); }
      lines.forEach((l, i) => {
        const y = -bh / 2 + (o.padY ?? 34) + lh * (i + .5) + z * .36;
        const w = measureW(l, f, ls) + (o.tick && i === lines.length - 1 ? tickW + z * .2 : 0);
        text(l, -w / 2, y, { font: f, color: col, ls });
        if (o.tick && i === lines.length - 1) {
          const x0 = -w / 2 + measureW(l, f, ls) + z * .2, cy = y - z * .36;
          g.strokeStyle = col; g.lineWidth = z * .17; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(x0 + tickW * .06, cy); g.lineTo(x0 + tickW * .38, cy + z * .3); g.lineTo(x0 + tickW * .96, cy - z * .36); g.stroke();
        }
      });
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1500; i++) { g.globalAlpha = .18 + R(i, 3) * .55; g.beginPath(); g.arc(-bw / 2 + R(i, 1) * bw, -bh / 2 + R(i, 2) * bh, .5 + R(i, 4) * 2.2, 0, 7); g.fill(); }
      g.globalAlpha = .35; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) { g.lineWidth = 1.5 + R(i, 9) * 3.5; g.beginPath(); const y = -bh / 2 + R(i, 7) * bh; g.moveTo(-bw / 2, y); g.lineTo(bw / 2, y + (R(i, 8) - .5) * 24); g.stroke(); }
    } finally { ctx = prev; }
    return { c, w: bw + 40, h: bh + 40, bw, bh };
  }
  /** a stamp landing: k 0..1 (rubber comes down 1.6 → 1), since = s after the hit (ink spread); multiply */
  function stampAt(sp, x, y, rot, k, o = {}) {
    if (k <= 0) return;
    const e = eo(k), since = o.since ?? 1, s = (o.s ?? 1) * (k < 1 ? 1.6 - .6 * e : 1) * (1 + .03 * Math.exp(-Math.max(0, since) * 12));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha *= (o.alpha ?? 1) * Math.min(1, k * 2) * (o.ink ?? .95);
    ctx.globalCompositeOperation = o.comp || 'multiply';
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    ctx.restore();
  }

  // ------------------------------------------------------------------ THE BLACK RIGID TOTE (the photo's bag = the sample)
  // Glossy black faux leather, structured: front panel (a slight trapezoid), the right gusset turning away (oblique 3/4,
  // like the cartons), the top opening, two rolled handles (back one behind), stitched tabs, piping. No logo, no clasp,
  // no metal: nothing that recalls any maker. Local origin = body centre; body 200 × 190 at s = 1 (handles ≈ 92 above).
  const TOTE = { w: 200, h: 190, d: 54, hh: 92 };
  function toteDraw(o = {}) {
    const w = TOTE.w, h = TOTE.h, d = TOTE.d, ox = d * OB.x, oy = d * OB.y, wt = w * .93;
    const FTL = [-wt / 2, -h / 2], FTR = [wt / 2, -h / 2], FBR = [w / 2, h / 2], FBL = [-w / 2, h / 2];
    const BTL = [FTL[0] + ox, FTL[1] + oy], BTR = [FTR[0] + ox, FTR[1] + oy], BBR = [FBR[0] + ox, FBR[1] + oy];
    const poly = Q => { ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) ctx.lineTo(Q[i][0], Q[i][1]); ctx.closePath(); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const handle = (a, b, lift, back) => {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - lift];
      const path = () => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(a[0] - 4, m[1] + 6, b[0] + 4, m[1] + 6, b[0], b[1]); };
      ctx.strokeStyle = back ? '#050407' : '#08070B'; ctx.lineWidth = 15; path(); ctx.stroke();
      ctx.strokeStyle = back ? '#1C1922' : '#2A2631'; ctx.lineWidth = 9; path(); ctx.stroke();
      ctx.save(); ctx.translate(-2.2, -2.6); ctx.strokeStyle = back ? 'rgba(255,236,206,.18)' : 'rgba(255,240,214,.5)'; ctx.lineWidth = 2.6; path(); ctx.stroke(); ctx.restore();
    };
    // the back handle (on the back panel), then the inside of the opening
    handle([BTL[0] + w * .24, BTL[1] + 4], [BTR[0] - w * .24, BTR[1] + 4], TOTE.hh * .92, true);
    poly([FTL, FTR, BTR, BTL]); ctx.fillStyle = '#060508'; ctx.fill();
    const ig = ctx.createLinearGradient(0, BTL[1], 0, FTL[1]); ig.addColorStop(0, 'rgba(70,62,80,.55)'); ig.addColorStop(.5, 'rgba(20,18,26,0)'); ctx.fillStyle = ig; poly([FTL, FTR, BTR, BTL]); ctx.fill();
    // the gusset (right side, turning away from the sun)
    poly([FTR, BTR, BBR, FBR]);
    const sg = ctx.createLinearGradient(FTR[0], 0, BTR[0], 0); sg.addColorStop(0, '#0B0A0E'); sg.addColorStop(1, '#16131B'); ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo((FTR[0] + BTR[0]) / 2, (FTR[1] + BTR[1]) / 2 + 3); ctx.lineTo((FBR[0] + BBR[0]) / 2, (FBR[1] + BBR[1]) / 2 - 6); ctx.stroke();   // the gusset's fold
    // the front panel: satin black, a warm sheen from the door (upper left), a cool rim on the right
    poly([FTL, FTR, FBR, FBL]);
    const fg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    fg.addColorStop(0, '#2B2731'); fg.addColorStop(.16, '#3A3540'); fg.addColorStop(.3, '#1F1C24'); fg.addColorStop(.62, '#141218'); fg.addColorStop(.9, '#0E0D11'); fg.addColorStop(1, '#1C1A21');
    ctx.fillStyle = fg; ctx.fill();
    ctx.save(); poly([FTL, FTR, FBR, FBL]); ctx.clip();
    const sh = ctx.createLinearGradient(-w * .42, 0, -w * .18, 0); sh.addColorStop(0, 'rgba(255,236,200,0)'); sh.addColorStop(.5, 'rgba(255,236,200,.16)'); sh.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(-w * .44, -h / 2); ctx.lineTo(-w * .2, -h / 2); ctx.lineTo(-w * .26, h / 2); ctx.lineTo(-w * .5, h / 2); ctx.closePath(); ctx.fill();
    const vg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); vg.addColorStop(0, 'rgba(255,240,220,.07)'); vg.addColorStop(.2, 'rgba(0,0,0,0)'); vg.addColorStop(.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = vg; ctx.fillRect(-w, -h, 2 * w, 2 * h);
    // leather grain
    for (let i = 0; i < 260; i++) { ctx.fillStyle = R(i, 41) > .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)'; ctx.fillRect(-w / 2 + R(i, 42) * w, -h / 2 + R(i, 43) * h, 1.6, 1.6); }
    // stitching along the edges
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(200,190,210,.22)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(FTL[0] + 8, FTL[1] + 10); ctx.lineTo(FTR[0] - 8, FTR[1] + 10); ctx.lineTo(FBR[0] - 9, FBR[1] - 9); ctx.lineTo(FBL[0] + 9, FBL[1] - 9); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // piping: the rolled top edge and the vertical edges catch the light
    ctx.strokeStyle = '#08070A'; ctx.lineWidth = 5; poly([FTL, FTR, FBR, FBL]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,214,.55)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(FTL[0] + 4, FTL[1] - 1.5); ctx.lineTo(FTR[0] - 4, FTR[1] - 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,214,.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(FTL[0] - 1, FTL[1] + 4); ctx.lineTo(FBL[0] - 1, FBL[1] - 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,170,200,.18)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(FTR[0] + 1, FTR[1] + 4); ctx.lineTo(FBR[0] + 1, FBR[1] - 4); ctx.stroke();
    // the front handle on stitched tabs
    const ha = [-w * .26, -h / 2 + 4], hb = [w * .26, -h / 2 + 4];
    handle(ha, hb, TOTE.hh, false);
    for (const p of [ha, hb]) {
      ctx.fillStyle = '#0D0C10'; rrect(p[0] - 11, p[1] - 6, 22, 30, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,214,.22)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); rrect(p[0] - 8, p[1] - 3, 16, 24, 3); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  /** the tote sprite (2× for the close-ups); blit at (x, y) with scale s through at() */
  const toteSprite = () => sprite('tote', 300, 360, () => toteDraw(), 2, 130, 210);
  function tote(x, y, s, rot = 0, o = {}) {
    const sp = toteSprite();
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1));
    ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h); ctx.restore();
  }

  return { S, G, A, OB, P, cl, kk, mix, eo, sst, R, hexRgb, rgba, litC, sprite, blit, shadowSprite, blob, softShadow, dustSprites, puffs,
    measureW, fit, stampSprite: (key, lines, o) => STAMPS[key] || (STAMPS[key] = buildStamp(lines, o)), stampAt, TOTE, toteDraw, tote, toteSprite };
})();

// =============================================================================================
// THE FICHE
// =============================================================================================
const FS_F = (function () {
  const B = FS_lib, S = B.S, G = B.G, A = B.A, P = B.P, FICHE = S.FICHE;
  const { cl, kk, mix, eo, sst, R, rgba, litC } = B;
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };
  const SW = G.fiche.w, SH = G.fiche.h;

  // ---------------------------------------------------------------- the blank order sheet (one sprite)
  const sheetSprite = () => B.sprite('sheet', SW + 60, SH + 60, () => {
    const x0 = -SW / 2, y0 = -SH / 2;
    const path = () => {                                     // the bottom-right corner is lifted a little (curl)
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + SW, y0); ctx.lineTo(x0 + SW, y0 + SH - 46);
      ctx.quadraticCurveTo(x0 + SW - 4, y0 + SH - 8, x0 + SW - 50, y0 + SH); ctx.lineTo(x0, y0 + SH); ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, y0, 0, y0 + SH); g.addColorStop(0, '#FDFAF3'); g.addColorStop(1, '#F4EEE1');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 900; i++) {                         // paper fibres
      const x = x0 + R(i, 11) * SW, y = y0 + R(i, 12) * SH, a = R(i, 13) * Math.PI, l = 2 + R(i, 14) * 7;
      ctx.strokeStyle = R(i, 15) > .5 ? 'rgba(150,120,80,.07)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    // the form: a printed double rule under the head, ruled lines, a red margin, a faint ✓ column
    ctx.fillStyle = 'rgba(40,60,110,.30)'; ctx.fillRect(x0 + 40, y0 + 196, SW - 80, 3); ctx.fillRect(x0 + 40, y0 + 203, SW - 80, 1.4);
    ctx.strokeStyle = 'rgba(70,110,180,.20)'; ctx.lineWidth = 2;
    for (let y = y0 + 246; y < y0 + SH - 20; y += 42) { ctx.beginPath(); ctx.moveTo(x0 + 18, y); ctx.lineTo(x0 + SW - 18, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(214,64,64,.34)'; ctx.beginPath(); ctx.moveTo(x0 + 74, y0); ctx.lineTo(x0 + 74, y0 + SH); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,60,110,.13)'; ctx.setLineDash([6, 7]); ctx.beginPath(); ctx.moveTo(FICHE.checkX - 62, y0 + 212); ctx.lineTo(FICHE.checkX - 62, y0 + SH - 160); ctx.stroke(); ctx.setLineDash([]);
    // light from the door: the upper left of the page is warmer
    const lg = ctx.createLinearGradient(x0, y0, x0 + SW, y0 + SH); lg.addColorStop(0, 'rgba(255,236,196,.16)'); lg.addColorStop(.6, 'rgba(255,236,196,0)'); lg.addColorStop(1, 'rgba(60,40,80,.06)');
    ctx.fillStyle = lg; ctx.fillRect(x0, y0, SW, SH);
    // the lifted corner: shade under the curl, a lit crease
    const cg = ctx.createRadialGradient(x0 + SW, y0 + SH, 0, x0 + SW, y0 + SH, 150); cg.addColorStop(0, 'rgba(90,70,40,.22)'); cg.addColorStop(1, 'rgba(90,70,40,0)');
    ctx.fillStyle = cg; ctx.fillRect(x0 + SW - 160, y0 + SH - 160, 160, 160);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + SW - 1, y0 + SH - 70); ctx.quadraticCurveTo(x0 + SW - 6, y0 + SH - 10, x0 + SW - 70, y0 + SH - 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,100,70,.28)'; ctx.lineWidth = 1.5; path(); ctx.stroke();
    // punched holes (the dark cloth shows through)
    for (const hy of [-SH * .3, 0, SH * .3]) {
      ctx.fillStyle = 'rgba(18,16,36,.86)'; ctx.beginPath(); ctx.arc(x0 + 36, hy, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0 + 36, hy + 1, 13, .2, Math.PI - .2); ctx.stroke();
    }
  });
  const sheetShadow = () => B.shadowSprite('sheetSh', SW, SH, 4, 18);

  // ---------------------------------------------------------------- the 4 small amber plates
  const PW = FICHE.plateW, PH = FICHE.plateH, PT = 12;
  const plateSprite = (label) => B.sprite('fplate_' + label, PW + 30, PH + PT + 30, () => {
    ctx.fillStyle = '#A9620A'; rrect(-PW / 2, -PH / 2 + PT, PW, PH, 20); ctx.fill();                     // the plate's thickness
    ctx.fillStyle = '#C47A12'; rrect(-PW / 2, -PH / 2 + PT * .45, PW, PH, 20); ctx.fill();
    const g = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2); g.addColorStop(0, '#FFC75E'); g.addColorStop(.45, '#FBAA2A'); g.addColorStop(1, '#EE931A');
    ctx.fillStyle = g; rrect(-PW / 2, -PH / 2, PW, PH, 20); ctx.fill();
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, 20); ctx.clip();
    for (let i = 0; i < 360; i++) { ctx.fillStyle = R(i, 61) > .5 ? 'rgba(255,248,226,.07)' : 'rgba(150,80,0,.06)'; ctx.fillRect(-PW / 2 + R(i, 62) * PW, -PH / 2 + R(i, 63) * PH, 2, 2); }   // satin paint
    const sh = ctx.createLinearGradient(-PW / 2, 0, -PW / 2 + 190, 0); sh.addColorStop(0, 'rgba(255,250,230,.22)'); sh.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = sh; ctx.fillRect(-PW / 2, -PH / 2, 190, PH);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,246,222,.78)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-PW / 2 + 22, -PH / 2 + 2.5); ctx.lineTo(PW / 2 - 22, -PH / 2 + 2.5); ctx.stroke();   // pillowed edge
    ctx.strokeStyle = 'rgba(150,80,0,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-PW / 2 + 22, PH / 2 - 2); ctx.lineTo(PW / 2 - 22, PH / 2 - 2); ctx.stroke();
    // letterpress: the letters are pressed in (a light lip under them, then the dark brown ink)
    const z = B.fit(label, '900 #px Satoshi', 72, PW - 44, 64, -1), f = `900 ${z}px Satoshi`;
    text(label, 0, z * .36 + 2.2, { font: f, align: 'center', color: 'rgba(255,232,170,.75)', ls: -1 });
    text(label, 0, z * .36, { font: f, align: 'center', color: '#2A1606', ls: -1 });
  }, 2);

  // ---------------------------------------------------------------- the felt-pen « details » (illegible loops)
  const SCRIB = [];
  function scribPts(i) {
    if (SCRIB[i]) return SCRIB[i];
    // two « words » of cursive loops (a prolate cycloid with varying loop heights), in sheet units, relative to scrib[0]
    const x0 = FICHE.scribX[0] - 28, x1 = FICHE.scribX[1] - 6, pts = [];
    const gap = .44 + .1 * R(i, 5), N = 220, NL = 13 + (i % 2);
    for (let j = 0; j <= N; j++) {
      const u = j / N; if (Math.abs(u - gap) < .03) { pts.push(null); continue; }
      const th = u * Math.PI * 2 * NL, li = Math.floor(th / (Math.PI * 2)), r = R(li + i * 17, 6);
      const hgt = r > .78 ? 30 : r < .16 ? -20 : 12 + 5 * R(li + i * 5, 9);           // ascenders, descenders, small letters
      const y = -hgt * (.5 - .5 * Math.cos(th)) + 1.5 * Math.sin(u * 7 + i), x = mix(x0, x1, u) - 6.5 * Math.sin(th) - .28 * y;   // slanted cursive
      pts.push([x, y]);
    }
    return (SCRIB[i] = pts);
  }
  function scribble(i, k, yLine) {
    if (k <= 0) return;
    const pts = scribPts(i), n = Math.floor((pts.length - 1) * cl(k));
    ctx.save(); ctx.translate(0, yLine + 34); ctx.strokeStyle = 'rgba(30,40,104,.88)'; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); let pen = false;
    for (let j = 0; j <= n; j++) { const p = pts[j]; if (!p) { pen = false; continue; } pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; }
    ctx.stroke(); ctx.restore();
  }
  /** where the scribble's head is (sheet units) at progress k — FS_gloves puts the felt pen's tip there */
  function scribHead(i, k) {
    const pts = scribPts(i); let j = Math.floor((pts.length - 1) * cl(k)); while (j > 0 && !pts[j]) j--;
    const p = pts[j] || [FICHE.scribX[0], 0]; return [p[0], p[1] + FICHE.lineY[i] + 34];
  }

  // ---------------------------------------------------------------- the brush ✓
  const CK = [[-36, 2], [-9, 30], [46, -42]];
  function check(k, sc = 1) {
    if (k <= 0) return;
    const L1 = Math.hypot(CK[1][0] - CK[0][0], CK[1][1] - CK[0][1]), L2 = Math.hypot(CK[2][0] - CK[1][0], CK[2][1] - CK[1][1]), d = cl(k) * (L1 + L2);
    const path = () => {
      ctx.beginPath(); ctx.moveTo(CK[0][0], CK[0][1]);
      if (d <= L1) ctx.lineTo(mix(CK[0][0], CK[1][0], d / L1), mix(CK[0][1], CK[1][1], d / L1));
      else { ctx.lineTo(CK[1][0], CK[1][1]); const u = (d - L1) / L2; ctx.lineTo(mix(CK[1][0], CK[2][0], u), mix(CK[1][1], CK[2][1], u)); }
    };
    ctx.save(); ctx.scale(sc, sc); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(2, 3); ctx.strokeStyle = 'rgba(120,40,0,.35)'; ctx.lineWidth = 17; path(); ctx.stroke(); ctx.translate(-2, -3);
    ctx.strokeStyle = '#EE6A0E'; ctx.lineWidth = 16; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,.55)'; ctx.lineWidth = 4; ctx.translate(-2, -3); path(); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- the violet note (Bonzini's first appearance)
  const NW = Math.max(FICHE.noteW, 770), NH = FICHE.noteH;
  const noteSprite = () => B.sprite('note', NW + 40, NH + 50, () => {
    const lines = (txt('note') || '+ MON ÉTIQUETTE BONZINI|SUR CHAQUE CARTON').split('|');
    const path = () => { ctx.beginPath(); ctx.moveTo(-NW / 2, -NH / 2); ctx.lineTo(NW / 2, -NH / 2); ctx.lineTo(NW / 2, NH / 2 - 26); ctx.quadraticCurveTo(NW / 2 - 6, NH / 2 - 4, NW / 2 - 40, NH / 2); ctx.lineTo(-NW / 2, NH / 2); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(40,14,90,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 20000 + 5; ctx.shadowOffsetY = 9; ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -NH / 2, 0, NH / 2); g.addColorStop(0, '#8A5CFF'); g.addColorStop(1, '#6C3CF2');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 380; i++) { ctx.fillStyle = R(i, 71) > .5 ? 'rgba(255,255,255,.05)' : 'rgba(20,0,60,.06)'; ctx.fillRect(-NW / 2 + R(i, 72) * NW, -NH / 2 + R(i, 73) * NH, 2, 2); }
    const cg = ctx.createRadialGradient(NW / 2, NH / 2, 0, NW / 2, NH / 2, 110); cg.addColorStop(0, 'rgba(20,0,70,.32)'); cg.addColorStop(1, 'rgba(20,0,70,0)'); ctx.fillStyle = cg; ctx.fillRect(NW / 2 - 120, NH / 2 - 120, 120, 120);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-NW / 2, -NH / 2, NW, 5);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(NW / 2 - 1, NH / 2 - 34); ctx.quadraticCurveTo(NW / 2 - 6, NH / 2 - 5, NW / 2 - 46, NH / 2 - 1); ctx.stroke();
    const z = Math.min(...lines.map(l => B.fit(l, '900 #px Satoshi', 54, NW - 60, 50))), f = `900 ${z}px Satoshi`;
    lines.forEach((l, i) => { const y = -NH / 2 + 18 + (NH - 36) * (i + .5) / lines.length + z * .36;
      text(l, 0, y + 2, { font: f, align: 'center', color: 'rgba(30,6,90,.45)' }); text(l, 0, y, { font: f, align: 'center', color: '#FFF8EC' }); });
  }, 2);
  function pin(x, y, col = '#F4EFE6') {                     // a push pin seen from above (round head, highlight, shadow)
    B.softShadow(x + 7, y + 7, 13, 11, .45);
    const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 11); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, col); g.addColorStop(1, '#8A8070');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  // ---------------------------------------------------------------- the stamp « ÉCRIS TOUT » (the words of N3)
  const stampSp = () => B.stampSprite('tout', [txt('stampAll') || 'ÉCRIS TOUT'], { size: 104, ls: 3, color: '#F2551A', pad: 34, padY: 20 });

  function draw(F, t, L) {
    if (!F) return;
    const n = Math.round(t * 30);
    // the sheet's cast shadow (the paper lies flat: short, soft; longer while it slides in)
    const lift = 1 - kk(t, A.sheet - .05, A.sheet + .4), so = shadowOff(F.x, F.y, 6 + 60 * lift, L);
    ctx.save(); ctx.translate(F.x + so.x * F.s, F.y + so.y * F.s); ctx.rotate(F.rot); ctx.scale(F.s, F.s); ctx.globalAlpha *= .42 + .1 * (1 - F.thumb);
    B.blit(sheetShadow()); ctx.restore();
    ctx.save(); ctx.translate(F.x, F.y); ctx.rotate(F.rot); ctx.scale(F.s, F.s);
    B.blit(sheetSprite());
    // the morning light on the page (warm in the sunbeam, a touch cooler in the shade)
    const c0 = lit('#FFFFFF', F.x - SW / 2 * F.s, F.y - SH / 2 * F.s, L, .2), c1 = lit('#FFFFFF', F.x + SW / 2 * F.s, F.y + SH / 2 * F.s, L, .2);
    const lg = ctx.createLinearGradient(-SW / 2, -SH / 2, SW / 2, SH / 2); lg.addColorStop(0, c0); lg.addColorStop(1, c1);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lg; ctx.fillRect(-SW / 2, -SH / 2, SW, SH); ctx.restore();
    // « ÉCRIS TOUT » at the head (orange starved ink, multiply)
    if (F.stamp > 0) B.stampAt(stampSp(), FICHE.stamp[0], FICHE.stamp[1], -.045, F.stamp, { since: t - A.stampAll });
    // the lines: felt-pen details, the plate, the ✓
    F.lines.forEach((l, i) => {
      const y = FICHE.lineY[i];
      scribble(i, S.ease(l.scrib), y);
      if (l.k > 0) {
        const e = l.k, z = 230 * (1 - eo(e)), sc = 1 + z / 520, q = S.squash(t, A.lines[i], .07, 34, 11);
        const so2 = shadowOff(F.x, F.y, 4 + z, L), sa = (.34 - .2 * (z / 230)) * cl(e * 3);
        ctx.save(); ctx.globalAlpha *= sa; ctx.translate(FICHE.plateX + so2.x * .8, y + so2.y * .8 + 6); ctx.scale(sc * (1 + z / 700), sc * (1 + z / 700));
        B.blit(B.shadowSprite('fplateSh', PW, PH, 20, 10)); ctx.restore();
        ctx.save(); ctx.translate(FICHE.plateX, y - z * .25); ctx.scale(sc * q.sx, sc * q.sy); ctx.globalAlpha *= cl(e * 4);
        B.blit(plateSprite(l.label), 0, PT / 2);
        ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lit('#FFFFFF', F.x + FICHE.plateX * F.s, F.y + y * F.s, L, .4); rrect(-PW / 2, -PH / 2, PW, PH + PT, 20); ctx.fill();
        ctx.restore();
        // the landing breathes paper dust out from under it
        const dk = kk(t, A.lines[i], A.lines[i] + .55);
        if (F.thumb < .05 && dk > 0 && dk < 1) B.puffs([{ x: FICHE.plateX - PW / 2, y, nx: -1, ny: .15, s: .7 }, { x: FICHE.plateX + PW / 2, y, nx: 1, ny: .15, s: .7 }, { x: FICHE.plateX, y: y + PH / 2, nx: 0, ny: 1, s: .6 }], dk,
          { n: 4, seed: 30 + i * 3, dist: 50, size: 18, a: .45, rise: 8, tj: PW * .7, out: 4, light: true });
      }
      if (l.check > 0) { ctx.save(); ctx.translate(FICHE.checkX, y - 4); ctx.rotate(-.06); const s = 1 + .35 * Math.pow(1 - l.check, 2); ctx.scale(s, s); check(eo(l.check)); ctx.restore(); }
    });
    // the violet note, pinned at the foot
    if (F.note > 0) {
      const k = F.note, e = eo(k), sc = 1.3 - .3 * e, d = t - A.note, wob = d > 0 ? .012 * Math.exp(-d * 6) * Math.sin(d * 22) : 0;
      const nx = FICHE.note[0], ny = FICHE.note[1];
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(.018 + wob); ctx.scale(sc, sc); ctx.globalAlpha *= Math.min(1, k * 2.5);
      B.blit(noteSprite());
      // a soft violet bloom when it lands (one swell, never a flicker)
      const bl = d > 0 ? Math.exp(-d * 3.2) * .5 : 0;
      if (bl > .01) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= bl; const rg = ctx.createRadialGradient(0, 0, 40, 0, 0, NW * .7); rg.addColorStop(0, 'rgba(170,130,255,.6)'); rg.addColorStop(1, 'rgba(120,80,255,0)'); ctx.fillStyle = rg; ctx.fillRect(-NW, -NW * .5, 2 * NW, NW); }
      ctx.restore();
      if (k > .6) for (const sd of [-1, 1]) at(nx + sd * (NW / 2 - 18), ny - NH / 2 + 4, sd * .62, 1, 1, () => { ctx.globalAlpha *= cl((k - .6) * 2.5); ctx.fillStyle = 'rgba(246,240,226,.62)'; ctx.fillRect(-44, -15, 88, 30); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-44, -15, 88, 6); });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- the orange tags « ? »
  const TAG_F = '900 52px Satoshi', TAG_H = 86;
  const tagSprite = (label, flip) => B.sprite('tag_' + label + (flip ? 'R' : 'L'), B.measureW(label, TAG_F) + 160, TAG_H + 50, () => {
    const tw = B.measureW(label, TAG_F), w = tw + 96, h = TAG_H, pt = 30;
    const path = () => { ctx.beginPath();
      if (!flip) { ctx.moveTo(-w / 2 + pt, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + pt, h / 2); ctx.lineTo(-w / 2, 0); }
      else { ctx.moveTo(w / 2 - pt, -h / 2); ctx.lineTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(w / 2 - pt, h / 2); ctx.lineTo(w / 2, 0); }
      ctx.closePath(); };
    ctx.save(); ctx.translate(0, 4); path(); ctx.fillStyle = '#B23A06'; ctx.fill(); ctx.restore();          // card thickness
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#FF7330'); g.addColorStop(1, '#F24E0A');
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); path(); ctx.clip(); for (let i = 0; i < 200; i++) { ctx.fillStyle = R(i, 81) > .5 ? 'rgba(255,240,220,.07)' : 'rgba(120,20,0,.07)'; ctx.fillRect(-w / 2 + R(i, 82) * w, -h / 2 + R(i, 83) * h, 2, 2); } ctx.restore();
    ctx.strokeStyle = 'rgba(255,226,196,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(flip ? -w / 2 + 6 : -w / 2 + pt + 4, -h / 2 + 2); ctx.lineTo(flip ? w / 2 - pt - 4 : w / 2 - 6, -h / 2 + 2); ctx.stroke();
    const gx = flip ? w / 2 - 26 : -w / 2 + 26;                 // the grommet
    ctx.fillStyle = '#E9E2D6'; ctx.beginPath(); ctx.arc(gx, 0, 11, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(90,40,10,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2A1A20'; ctx.beginPath(); ctx.arc(gx, 0, 5.5, 0, 7); ctx.fill();
    const tx = flip ? -12 : 12;
    text(label, tx, 19, { font: TAG_F, align: 'center', color: 'rgba(120,20,0,.45)' });
    text(label, tx, 17, { font: TAG_F, align: 'center', color: '#FFFFFF' });
  }, 2);
  function tagW(label) { return B.measureW(label, TAG_F) + 96; }
  function tags(list, t, L) {
    for (const q of list) {
      if (q.a <= .003) continue;
      const flip = q.px > q.x + 4 || (q.phase !== 'pin' && q.i !== 2), w = tagW(q.txt), s = q.s;
      const gx = q.x + (flip ? 1 : -1) * (w / 2 - 26) * s * Math.cos(q.rot), gy = q.y + (flip ? 1 : -1) * (w / 2 - 26) * s * Math.sin(q.rot);
      const z = q.phase === 'pin' ? 8 : q.phase === 'hang' ? 50 : 50 + 120 * Math.sin(Math.PI * q.k);
      ctx.save(); ctx.globalAlpha *= q.a;
      // its shadow (down-right in the sun)
      const so = shadowOff(q.x, q.y, z, L);
      ctx.save(); ctx.globalAlpha *= .32 - .12 * cl(z / 170); ctx.translate(q.x + so.x, q.y + so.y); ctx.rotate(q.rot); ctx.scale(s, s);
      B.blit(B.shadowSprite('tagSh' + Math.round(w), w, TAG_H, 8, 8)); ctx.restore();
      // the cotton string: pinned → to the pin (sagging); hanging / flying → a loose end trailing
      ctx.lineCap = 'round';
      const string = (x0, y0, x1, y1, sag) => { const mx = (x0 + x1) / 2, my = Math.max(y0, y1) + sag;
        ctx.strokeStyle = 'rgba(20,10,10,.55)'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
        ctx.strokeStyle = '#EFE6D2'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke(); };
      if (q.phase === 'pin') string(q.px, q.py, gx, gy, 26 + 8 * Math.sin(t * 2 + q.i));
      else { const sw = Math.sin(t * 3.1 + q.i * 2) * 14, dir = flip ? 1 : -1; string(gx, gy, gx + dir * (30 + sw), gy + 52 - Math.abs(sw) * .3, 6); }
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(s, s);
      B.blit(tagSprite(q.txt, flip));
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lit('#FFFFFF', q.x, q.y, L, .4); ctx.fillRect(-w / 2, -TAG_H / 2, w, TAG_H + 4);
      ctx.restore();
      if (q.phase === 'pin') pin(q.px, q.py, '#FFE9D2');
      ctx.restore();
    }
  }
  return { draw, tags, scribHead, pin, check };
})();
function FS_fiche(F, t, L) { FS_F.draw(F, t, L); }
function FS_tags(list, t, L) { FS_F.tags(list, t, L); }
