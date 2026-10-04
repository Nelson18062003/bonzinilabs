'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » — composition: camera, draw order, calls the modules when they exist, else animatic fallbacks.
//   T  wax counter, morning (10_table.js: T_table, T_atmos)          K  margouillat (40_gecko.js via 39_gecko_shim.js)
//   M1 « the order & the meme »  prefix OM_  (30_meme.js, 32_plates.js)
//   M2 « fiche, sample, Bonzini & end »  prefixes FS_ (34_fiche.js, 36_sample.js) and BZ_ (70_bonzini.js, 76_end.js)
//   TY type (60_type.js): chip, pills, bands, captions, end card, every text no module has taken over.
// Read serie/ep3/MODULES.md for the exact APIs. The fallbacks are deliberately simple (animatic), but readable.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk, FICHE = S.FICHE;
  const has = n => typeof window[n] === 'function';
  const INK = '#1A1426', CREAM = '#FFF6E8', ORANGE = '#FE560D', AMBER = '#F3A745', AMBER_D = '#B86E0C', BROWN = '#2A1606',
    STEEL = '#7C8592', VIOL = '#7B4BFF', SEA = '#0B5FA5', KRAFT = '#C79E6C', BAG = '#17141B';
  const poly = P => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;

  // ------------------------------------------------------------------ amber plate glyph layout (shared by the PAS fallback)
  const LAY = {};
  function amberLayout(txt) {
    if (LAY[txt]) return LAY[txt];
    const maxW = G.plateW.amber - 100; let z = 128; ctx.save(); ctx.font = SAT(z); let w = ctx.measureText(txt).width; if (w > maxW) { z = Math.floor(z * maxW / w); ctx.font = SAT(z); w = ctx.measureText(txt).width; }
    const xs = []; let x = -w / 2; for (let i = 0; i < txt.length; i++) { const a = ctx.measureText(txt.slice(0, i + 1)).width - ctx.measureText(txt.slice(0, i)).width; xs.push({ ch: txt[i], i, x0: x, w: a }); x += a; }
    // the final « C'EST ÇA ✓ »: glyphs 0..4 (C'EST), 10..11 (ÇA), then a ✓ the width of a cap
    const keep = [0, 1, 2, 3, 4, 10, 11], sp = ctx.measureText(' ').width, tickW = z * .78;
    const wk = keep.reduce((q, i) => q + xs[i].w, 0) + sp + sp * .9 + tickW; let fx = -wk / 2; const fin = {};
    keep.forEach((i, j) => { fin[i] = fx; fx += xs[i].w; if (j === 4) fx += sp; });
    const tickX = fx + sp * .9; ctx.restore();
    return (LAY[txt] = { z, w, xs, fin, tickX, tickW, capH: z * .72 });
  }

  // ------------------------------------------------------------------ fallbacks (animatic blocks)
  const FB = {
    /** oblique kraft carton (ep2 convention): pass 'back' (shadow, inner walls, back flaps) | 'front' (sides, flaps) */
    carton(st, pass, inside) {
      const g = S.cartonGeo(st); const { FTL, FTR, FBR, FBL, BTL, BTR, BBR, w, h } = g;
      ctx.save(); ctx.globalAlpha *= st.a ?? 1;
      if (st.rot) { ctx.translate(g.cx, st.y); ctx.rotate(st.rot); ctx.translate(-g.cx, -st.y); }
      if (pass === 'back') {
        ctx.fillStyle = 'rgba(25,12,8,.30)'; poly([[FBL[0] + 14, FBL[1] + 6], [FBR[0] + 40, FBR[1] + 22], [BBR[0] + 60, BBR[1] + 20], [BTR[0] + 50, BBR[1] - 20]]); ctx.fill();
        ctx.fillStyle = '#4A321C'; poly([FTL, FTR, BTR, BTL]); ctx.fill();                       // the open mouth (dark inside)
        if (st.flaps) { const up = [0, -h * .45 * st.flaps]; ctx.fillStyle = '#B98D59'; poly([BTL, BTR, add(BTR, up), add(BTL, up)]); ctx.fill(); ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 2; ctx.stroke(); }
        if (inside) inside(g);
      } else {
        ctx.fillStyle = C.kraftD; poly([FTR, BTR, BBR, FBR]); ctx.fill();
        ctx.fillStyle = TEX.kraft; poly([FTL, FTR, FBR, FBL]); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 2; ctx.stroke();
        if (st.flaps) {
          const sideL = [-w * .18 * st.flaps, -h * .12 * st.flaps]; ctx.fillStyle = '#C79E6C'; poly([FTL, BTL, add(BTL, sideL), add(FTL, sideL)]); ctx.fill();
          ctx.fillStyle = '#B98D59'; poly([FTR, BTR, add(BTR, [w * .14 * st.flaps, -h * .06 * st.flaps]), add(FTR, [w * .18 * st.flaps, -h * .02 * st.flaps])]); ctx.fill();
          ctx.fillStyle = '#A9804E'; poly([FTL, FTR, [FTR[0], FTR[1] + h * .14 * st.flaps], [FTL[0], FTL[1] + h * .14 * st.flaps]]); ctx.fill();
        }
        if (st.torn) { ctx.fillStyle = 'rgba(214,170,110,.9)'; poly([[FTL[0] + w * .3, FTL[1]], [FTL[0] + w * .42, FTL[1]], [FTL[0] + w * .40, FTL[1] + h * .3], [FTL[0] + w * .33, FTL[1] + h * .26]]); ctx.fill(); }
      }
      ctx.restore();
    },
    /** the black RIGID tote with two handles (the photo / the sample / the order), centred on (0,0), w×h body */
    bagRigid(w = 200, h = 200, col = BAG) {
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = '#0A080C'; ctx.lineWidth = w * .07;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * .3, -h * .42); ctx.bezierCurveTo(s * w * .3, -h * .95, s * w * .08, -h * .95, s * w * .08, -h * .42); ctx.stroke(); }
      const gr = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, '#2C2834'); gr.addColorStop(.35, col); gr.addColorStop(.7, '#0C0A10'); gr.addColorStop(1, '#25212C');
      ctx.fillStyle = gr; poly([[-w * .42, -h * .45], [w * .42, -h * .45], [w * .5, h * .5], [-w * .5, h * .5]]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * .42, -h * .45); ctx.lineTo(w * .42, -h * .45); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; poly([[-w * .3, -h * .4], [-w * .15, -h * .4], [-w * .26, h * .45], [-w * .42, h * .45]]); ctx.fill();
      ctx.restore();
    },
    /** the received bag: smaller, SOFT, saggy, one thin strap */
    bagSoft(w = 200, h = 210, sag = .6) {
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = '#2A262E'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-w * .3, -h * .3); ctx.bezierCurveTo(-w * .2, -h * 1.05, w * .3, -h * .95, w * .32, -h * .28); ctx.stroke();
      ctx.fillStyle = '#3A3640'; ctx.beginPath(); ctx.moveTo(-w * .38, -h * .34);
      ctx.bezierCurveTo(-w * .1, -h * (.2 - .1 * sag), w * .12, -h * (.42 - .1 * sag), w * .38, -h * .3);
      ctx.bezierCurveTo(w * (.52 + .05 * sag), h * .05, w * .5, h * .35, w * .36, h * .5);
      ctx.bezierCurveTo(w * .1, h * (.56 + .06 * sag), -w * .2, h * .58, -w * .42, h * .48);
      ctx.bezierCurveTo(-w * .55, h * .2, -w * .5, -h * .1, -w * .38, -h * .34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; for (const k of [-.15, .05, .2]) { ctx.beginPath(); ctx.moveTo(w * k, -h * .25); ctx.quadraticCurveTo(w * (k + .06), h * .1, w * (k - .02), h * .45); ctx.stroke(); }   // creases
      ctx.restore();
    },
    photo(P) {
      const w = P.w, h = P.h;
      at(P.x, P.y, P.rot, P.s * (P.sx || 1), P.s * (P.sy || 1), () => {
        withShadow(10, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2, -h / 2, w, h); });
        const pw = w - 40, ph = w - 40, py = -h / 2 + 20;
        const gr = ctx.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#ECEAE6'); gr.addColorStop(1, '#C9C6C0'); ctx.fillStyle = gr; ctx.fillRect(-pw / 2, py, pw, ph);
        at(0, py + ph * .58, 0, 1, 1, () => FB.bagRigid(pw * .62, ph * .5));
        text('LA PHOTO', 0, h / 2 - 34, { font: `800 50px Shantell`, align: 'center', color: INK });
        if (P.pin) { ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(0, -h / 2 + 8, 11, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-3, -h / 2 + 5, 4, 0, 7); ctx.fill(); }
      });
    },
    recv(Cn, B, t) {
      FB.carton(Cn, 'back');
      if (B) at(B.x, B.y, B.rot, B.s * B.sx, B.s * B.sy, () => FB.bagSoft(G.bag.w, G.bag.h, B.sag));
      FB.carton(Cn, 'front');
    },
    plate(P, t) {
      const W0 = G.plateW[P.kind], H0 = G.plateH[P.kind];
      ctx.save(); ctx.globalAlpha *= P.a ?? 1;
      const n = Math.round(t * 30), sh = P.shake ? (rnd(Math.floor(n / 2) * 3.3) - .5) * 8 * P.shake : 0;
      ctx.translate(P.x + sh, P.y); ctx.rotate(P.rot || 0); ctx.scale((P.s ?? 1) * (P.sx ?? 1), (P.s ?? 1) * (P.sy ?? 1));
      const z = P.z ?? 10, so = shadowOff(P.x, P.y, z, S.light(t));
      if (P.kind === 'order') {                                 // thin card that bends under its own weight
        const sag = P.sag || 0, bend = 60 * sag;
        const shape = (dx, dy) => { ctx.beginPath(); ctx.moveTo(-W0 / 2 + dx, -H0 / 2 + dy + bend * .35); ctx.quadraticCurveTo(dx, -H0 / 2 + dy - bend * .25, W0 / 2 + dx, -H0 / 2 + dy + bend * .35);
          ctx.lineTo(W0 / 2 + dx - 10 * sag, H0 / 2 + dy + bend); ctx.quadraticCurveTo(dx, H0 / 2 + dy + bend * .2, -W0 / 2 + dx + 10 * sag, H0 / 2 + dy + bend); ctx.closePath(); };
        shape(so.x, so.y); ctx.fillStyle = 'rgba(30,14,10,.32)'; ctx.fill();
        shape(0, 6); ctx.fillStyle = '#C9862A'; ctx.fill(); shape(0, 0); ctx.fillStyle = '#F6C77A'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,60,10,.35)'; ctx.lineWidth = 2; ctx.stroke();
        const lines = P.lines, lh = 104, y0 = -H0 / 2 + 70 + bend * .3;
        lines.forEach((l, i) => {
          const soggy = i === P.soggyLine ? P.soggy || 0 : 0, yy = y0 + i * lh + bend * (i / 2) * .5;
          ctx.save(); ctx.translate(0, yy); if (soggy) { ctx.scale(1 + .25 * soggy, 1 - .75 * soggy); ctx.rotate(.03 * soggy); }
          if (soggy) { ctx.fillStyle = `rgba(120,70,20,${.35 * soggy})`; ctx.beginPath(); ctx.ellipse(0, -20, 380, 46, 0, 0, 7); ctx.fill(); }
          text(l, 0, 30, { font: SAT(84), align: 'center', color: BROWN, alpha: 1 - .35 * soggy }); ctx.restore();
        });
        ctx.restore(); return;
      }
      ctx.fillStyle = 'rgba(30,14,10,.34)'; rrect(-W0 / 2 + so.x, -H0 / 2 + so.y, W0, H0, 26); ctx.fill();
      if (P.kind === 'steel') {
        ctx.fillStyle = '#3E444D'; rrect(-W0 / 2, -H0 / 2 + 14, W0, H0, 14); ctx.fill();
        const gr = ctx.createLinearGradient(0, -H0 / 2, 0, H0 / 2); gr.addColorStop(0, '#9AA3AE'); gr.addColorStop(.5, '#7C8592'); gr.addColorStop(1, '#5E6670');
        ctx.fillStyle = gr; rrect(-W0 / 2, -H0 / 2, W0, H0, 14); ctx.fill();
        for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillStyle = '#B9C0C8'; ctx.beginPath(); ctx.arc(x * (W0 / 2 - 26), y * (H0 / 2 - 26), 10, 0, 7); ctx.fill(); }
        P.lines.forEach((l, i) => text(l, 0, -H0 / 2 + 112 + i * 112, { font: `900 118px Stencil`, align: 'center', color: '#F4ECDC', ls: 1 }));
        ctx.restore(); return;
      }
      // amber « C'EST PAS ÇA ! » (and its PAS mechanic: cracks, lost letters, recentre, ✓)
      ctx.fillStyle = '#B86E0C'; rrect(-W0 / 2, -H0 / 2 + 16, W0, H0, 30); ctx.fill();
      const gr = ctx.createLinearGradient(0, -H0 / 2, 0, H0 / 2); gr.addColorStop(0, '#FFBA42'); gr.addColorStop(.5, '#FFA51E'); gr.addColorStop(1, '#F28F0C');
      ctx.fillStyle = gr; rrect(-W0 / 2, -H0 / 2, W0, H0, 30); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,228,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-W0 / 2 + 30, -H0 / 2 + 2); ctx.lineTo(W0 / 2 - 30, -H0 / 2 + 2); ctx.stroke();
      const lo = amberLayout(P.txt), base = lo.capH / 2;
      ctx.font = SAT(lo.z); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = BROWN;
      for (const g of lo.xs) {
        if (g.ch === ' ' || ((g.i === 6 || g.i === 7 || g.i === 8) && g.i - 6 < P.lost)) continue;
        if (g.ch === '!' && P.bang <= 0) continue;
        const x = lo.fin[g.i] !== undefined ? g.x0 + (lo.fin[g.i] - g.x0) * P.recentre : g.x0;
        ctx.globalAlpha = (P.a ?? 1) * (g.ch === '!' ? P.bang : 1); ctx.fillText(g.ch, x, base);
      }
      ctx.globalAlpha = P.a ?? 1;
      if (P.crack > 0 && P.lost < 3) {                      // three cracks from the bottom edge (one per tap), through P, A, S
        ctx.strokeStyle = 'rgba(60,24,0,.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        for (let c = 0; c < P.cracks; c++) { const gx = lo.xs[6 + c].x0 + lo.xs[6 + c].w / 2, k = kk(P.crack, c / 3, c / 3 + .5);
          ctx.beginPath(); ctx.moveTo(gx - 6, H0 / 2); for (let j = 1; j <= 5; j++) ctx.lineTo(gx + (rnd(c * 9 + j) - .5) * 26, H0 / 2 - H0 * .95 * k * j / 5); ctx.stroke(); }
      }
      if (P.tick > 0) {                                     // the stamped amber ✓ (dark brown, like the letters)
        const s = 1 + .5 * Math.pow(1 - P.tick, 2), tx = lo.tickX + lo.tickW / 2, ty = base - lo.capH / 2;
        ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.globalAlpha *= Math.min(1, P.tick * 2);
        ctx.strokeStyle = BROWN; ctx.lineWidth = lo.z * .17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-lo.tickW * .42, 0); ctx.lineTo(-lo.tickW * .08, lo.capH * .36); ctx.lineTo(lo.tickW * .45, -lo.capH * .46); ctx.stroke(); ctx.restore();
      }
      if (P.sweat > 0) for (let i = 0; i < 4; i++) { const yy = -H0 / 2 + 20 + ((t * 120 + i * 50) % (H0 - 20)); ctx.globalAlpha = (P.a ?? 1) * P.sweat; ctx.fillStyle = '#FFE3A0'; ctx.beginPath(); ctx.ellipse(W0 / 2 - 50 - i * 34, yy, 7, 11, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    /** the subtitle's splash after the slam: its letters gush out from under the plate like marbles */
    splash(sb, t) {
      const k = sb.splash; if (k <= 0 || k >= 1) return;
      const s = 'Messacssontarrivés!'; ctx.save();
      for (let i = 0; i < s.length; i++) {
        const a0 = (i / s.length) * Math.PI * 2 + rnd(i) * .5, v = 380 + rnd(i * 3) * 260, d = t - sb.t0;
        const x = sb.x + Math.cos(a0) * v * d * 1.2, y = sb.y + Math.sin(a0) * v * d * .6 + 600 * d * d * .5;
        ctx.globalAlpha = 1 - k; text(s[i], x, y, { font: SAT(54), align: 'center', color: '#FFFFFF' });
      }
      ctx.restore();
    },
    tag(q) {
      ctx.save(); ctx.globalAlpha *= q.a;
      if (q.phase === 'pin') { ctx.strokeStyle = '#E8DCC4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.px, q.py); ctx.quadraticCurveTo((q.px + q.x) / 2, Math.max(q.py, q.y) + 30, q.x, q.y - 34); ctx.stroke();
        ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(q.px, q.py, 9, 0, 7); ctx.fill(); }
      at(q.x, q.y, q.rot, q.s, q.s, () => {
        ctx.font = SAT(50); const w = ctx.measureText(q.txt).width + 64, h = 82;
        withShadow(8, () => { ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.moveTo(-w / 2 + 22, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 22, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(-w / 2 + 24, 0, 8, 0, 7); ctx.fill();
        text(q.txt, 12, 18, { font: SAT(50), align: 'center', color: '#FFFFFF' });
      });
      ctx.restore();
    },
    fiche(F, t) {
      at(F.x, F.y, F.rot, F.s, F.s, () => {
        withShadow(14, () => { ctx.fillStyle = '#FBF7EE'; ctx.fillRect(-F.w / 2, -F.h / 2, F.w, F.h); });
        ctx.strokeStyle = 'rgba(80,120,190,.25)'; ctx.lineWidth = 2; for (let y = -F.h / 2 + 80; y < F.h / 2; y += 42) { ctx.beginPath(); ctx.moveTo(-F.w / 2 + 30, y); ctx.lineTo(F.w / 2 - 30, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(220,60,60,.35)'; ctx.beginPath(); ctx.moveTo(-F.w / 2 + 70, -F.h / 2); ctx.lineTo(-F.w / 2 + 70, F.h / 2); ctx.stroke();
        F.lines.forEach((l, i) => {
          const y = FICHE.lineY[i];
          if (l.k > 0) {
            const dy = (1 - S.easeOut(l.k)) * -260, a = Math.min(1, l.k * 3);
            ctx.save(); ctx.globalAlpha *= a; ctx.translate(FICHE.plateX, y + dy);
            ctx.fillStyle = 'rgba(30,14,10,.25)'; rrect(-FICHE.plateW / 2 + 8, -FICHE.plateH / 2 + 12, FICHE.plateW, FICHE.plateH, 18); ctx.fill();
            ctx.fillStyle = '#C17A12'; rrect(-FICHE.plateW / 2, -FICHE.plateH / 2 + 8, FICHE.plateW, FICHE.plateH, 18); ctx.fill();
            ctx.fillStyle = AMBER; rrect(-FICHE.plateW / 2, -FICHE.plateH / 2, FICHE.plateW, FICHE.plateH, 18); ctx.fill();
            text(l.label, 0, 26, { font: SAT(72), align: 'center', color: BROWN }); ctx.restore();
          }
          if (l.scrib > 0) { ctx.save(); ctx.strokeStyle = '#2B2F7A'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); const x0 = FICHE.scribX[0] - 40, x1 = FICHE.scribX[1] - 20;
            for (let j = 0; j <= 30 * l.scrib; j++) { const x = x0 + (x1 - x0) * j / 30, yy = y + 34 + Math.sin(j * 1.9 + i) * 9; j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); ctx.restore(); }
          if (l.check > 0) { const s = 1 + .6 * Math.pow(1 - l.check, 2); at(FICHE.checkX, y, -.08, s, s, () => { ctx.globalAlpha *= Math.min(1, l.check * 2);
            ctx.strokeStyle = '#E07A06'; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(-8, 30); ctx.lineTo(40, -36); ctx.stroke(); }); }
        });
      });
    },
    parcel(p) {
      const st = { x: p.x, y: p.y + 90, w: 280, h: 170, d: 150, s: 1, sx: p.sx, sy: p.sy, rot: p.rot, a: p.a, flaps: p.open };
      FB.carton(st, 'back'); FB.carton(st, 'front');
      const g = S.cartonGeo(st);
      if (p.label) at(g.cx, g.cy + 6, p.rot, 1, 1, () => { ctx.fillStyle = '#EAD7B4'; rrect(-150, -34, 300, 68, 8); ctx.fill(); text('ÉCHANTILLON', 0, 17, { font: SAT(46), align: 'center', color: INK }); });
    },
    sampleBag(b, t) {
      at(b.x, b.y, b.rot, b.s, b.s, () => {
        FB.bagRigid(190, 190);
        if (b.keep > 0) at(-90, 40, -.1 + .06 * Math.sin(t * 3), b.keep, b.keep, () => {   // hangs from the handle down the bag's front ctx.strokeStyle = '#8A6238'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, -14); ctx.lineTo(-20, 0); ctx.stroke();
          withShadow(6, () => { ctx.fillStyle = '#D9B98C'; ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(196, -34); ctx.lineTo(196, 34); ctx.lineTo(-14, 34); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill(); });
          text('À GARDER', 84, 16, { font: SAT(44), align: 'center', color: INK }); });
      });
    },
    glove(side, h) {
      const sh = G.shoulder[side];
      ctx.save(); ctx.globalAlpha *= h.a ?? 1;
      ctx.strokeStyle = '#3B4A6B'; ctx.lineWidth = 70; ctx.lineCap = 'round';      // plain sleeve (no wax, no ring)
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo((sh.x + h.x) / 2, (sh.y + h.y) / 2 + 120, h.x, h.y + 70); ctx.stroke();
      at(h.x, h.y, h.rot || 0, (h.s || 1) * .8, (h.s || 1) * .8, () => {
        ctx.fillStyle = '#F7F4EE'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(0, 0, 54, 62, 0, 0, 7); ctx.fill(); ctx.stroke();
        const curl = h.pose === 'grip' || h.pose === 'hold' || h.pose === 'pen' ? .55 : 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 30, -62 * curl, 15, 34 * curl, 0, 0, 7); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(side === 'L' ? 52 : -52, -6, 16, 30, side === 'L' ? .6 : -.6, 0, 7); ctx.fill(); ctx.stroke();
        if (h.pose === 'pen') { ctx.fillStyle = '#2B2F7A'; ctx.save(); ctx.rotate(.5); rrect(-10, -150, 20, 140, 8); ctx.fill(); ctx.restore(); }
      });
      ctx.restore();
    },
    big(st, t) {
      const inside = g => { for (let i = 0; i < 4; i++) at(g.FTL[0] + g.w * (.18 + .21 * i) + g.ox * .4, g.FTL[1] + g.oy * .45 - 10, 0, .62, .5, () => FB.bagRigid(190, 190)); };
      FB.carton(st, 'back', inside); FB.carton(st, 'front');
    },
    bzLabel(st, t) {
      const g = S.cartonGeo(st), s = 1 + .35 * (st.pop || 0), lw = 300 * s, lh = 190 * s;
      at(g.cx - 10, g.cy + 8, -.02, 1, 1, () => {
        withShadow(4, () => { ctx.fillStyle = CREAM; rrect(-lw / 2, -lh / 2, lw, lh, 8); ctx.fill(); });
        ctx.fillStyle = SEA; ctx.fillRect(-lw / 2, -lh / 2, lw, lh * .24);
        at(-lw / 2 + 34 * s, -lh / 2 + lh * .12, 0, .8 * s, .8 * s, () => iconShip('#fff'));
        qr(-lw / 2 + 14 * s, -lh / 2 + lh * .32, 64 * s, 7);
        text('BZ-482913', -lw / 2 + 92 * s, -lh / 2 + lh * .32 + 34 * s, { font: font(FF.mono, Math.round(30 * s), 800), color: INK });
        text('EXEMPLE', -lw / 2 + 92 * s, -lh / 2 + lh * .32 + 70 * s, { font: SAT(Math.round(24 * s)), color: ORANGE });
        ctx.fillStyle = 'rgba(35,22,41,.18)'; for (let i = 0; i < 3; i++) { rrect(-lw / 2 + 14 * s, lh / 2 - 46 * s + i * 13 * s, lw * .7 - i * 30, 8 * s, 4); ctx.fill(); }   // address, phones: blurred
      });
    },
    /** P, A, S: detach, fall, roll to the margouillat's side, wait, are gulped */
    letters(t, L) {
      const P = S.lettersPlan(), Am = S.amber(Math.min(t, A.check - .05)); if (!Am || t < P.detach[0]) return;
      const lo = amberLayout(Am.txt);
      for (let i = 0; i < 3; i++) {
        const t0 = P.detach[i]; if (t < t0) continue;
        const g = lo.xs[6 + i], sx = G.cx + g.x0 + g.w / 2, sy = G.amberY - 10, R = P.rest[i], tg = P.gulps[i];
        let x, y, rot, s = 1, a = 1;
        const d1 = .55, u = kk(t, t0, t0 + d1);                 // fall + bounce down out of the plate
        if (t < t0 + d1) { x = lerp(sx, sx - 40 - 30 * i, u); y = sy + 260 * u * u - 140 * Math.sin(Math.PI * u) * (1 - u); rot = 2.5 * u * (i % 2 ? -1 : 1); }
        else { const v = S.ease(kk(t, t0 + d1, t0 + d1 + .8)); x = lerp(sx - 40 - 30 * i, R.x, v); y = lerp(sy + 260, R.y, v); rot = (i % 2 ? -1 : 1) * (2.5 + v * 6.28); }
        if (t >= tg - .2) { const m = has('K_mouth') ? K_mouth(t) : { x: G.gecko.x + 60, y: G.gecko.y - 70 }, v = S.easeIn(kk(t, tg - .2, tg)); x = lerp(R.x, m.x, v); y = lerp(R.y, m.y, v); s = 1 - .8 * v; if (t >= tg) continue; }
        at(x, y, rot, s * .75, s * .75, () => { ctx.fillStyle = '#C17A12'; rrect(-48, -54, 96, 116, 14); ctx.fill(); ctx.fillStyle = AMBER; rrect(-48, -60, 96, 116, 14); ctx.fill();
          text(g.ch, 0, 26, { font: SAT(lo.z), align: 'center', color: BROWN }); });
      }
    },
  };

  registerScene({ id: 'compose', z: 10, draw(t, n) {
    window.__t = t;
    const f = t * 30, L = S.light(t), cam = S.camera(t);
    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    // 1 — the shop counter in the morning: wax cloth in the door's sunbeam, the back wall beyond the far edge
    if (has('T_table')) T_table(f, L, cam); else { ctx.fillStyle = '#2B2A7A'; ctx.fillRect(-80, G.far, W + 160, H); ctx.fillStyle = '#33221A'; ctx.fillRect(-80, -80, W + 160, G.far + 80); }
    // 2 — the margouillat, then whatever lies flat on the cloth under the plates (the subtitle's splash: M1)
    const g = S.gecko(t);
    if (has('K_gecko')) K_gecko(t, L, g); else { ctx.fillStyle = '#5282FF'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 26, 70, .7, 0, 7); ctx.fill(); }
    if (has('OM_fxUnder')) OM_fxUnder(t, L); else { const sub = S.subtitle(t); if (sub) FB.splash(sub, t); }
    // 3 — the meme: the polaroid « LA PHOTO » (+ M2's « PAREIL ✓ » stamp on it), the received carton & bag
    const ph = S.polaroid(t);
    if (ph) { has('OM_photo') ? OM_photo(ph, t, L) : FB.photo(ph); if (has('FS_onPhoto')) FS_onPhoto(ph, t, L); }
    const rc = S.recvCarton(t), rb = S.recvBag(t);
    if (rc) has('OM_recv') ? OM_recv(rc, rb, t, L) : FB.recv(rc, rb, t);
    // 4 — the key moment's big carton (M2) and its Bonzini label
    const bc = S.bigCarton(t);
    if (bc) { has('BZ_carton') ? BZ_carton(bc, t, L) : FB.big(bc, t); has('BZ_onCarton') ? BZ_onCarton(bc, t, L) : FB.bzLabel(bc, t); }
    // 5 — the order sheet (M2: lines, ✓, scribbles, stamp, violet note), the sample parcel
    const F = S.fiche(t); if (F) has('FS_fiche') ? FS_fiche(F, t, L) : FB.fiche(F, t);
    const pc = S.parcel(t); if (pc) has('FS_parcel') ? FS_parcel(pc, t, L) : FB.parcel(pc);
    // 6 — TOI's opening subtitle on the cloth (M1 takes over 'sub'; else type draws it), then the plates (M1), back to
    //     front: order card, steel, amber
    const sbt = S.subtitle(t); if (sbt && has('OM_subtitle')) OM_subtitle(sbt, t, L);
    for (const P of S.plates(t)) has('OM_plate') ? OM_plate(P.kind, P, t, L) : FB.plate(P, t);
    // 7 — the sample bag (held under the amber plate during the taps), the « ? » tags, TOI's gloves (closest to us)
    const sb = S.sampleBag(t); if (sb) has('FS_sampleBag') ? FS_sampleBag(sb, t, L) : FB.sampleBag(sb, t);
    const tg = S.tags(t); if (tg.length) has('FS_tags') ? FS_tags(tg, t, L) : tg.forEach(FB.tag);
    const gl = S.gloves(t); if (gl.L || gl.R) { if (has('FS_gloves')) FS_gloves(gl, t, L); else { if (gl.L) FB.glove('L', gl.L); if (gl.R) FB.glove('R', gl.R); } }
    // 8 — P, A, S off the plate → the margouillat (M2); the plates' effects (dust, splash, sweat: M1)
    has('FS_letters') ? FS_letters(t, L) : FB.letters(t, L);
    if (has('OM_fx')) OM_fx(t, L);
    // 9 — Bonzini's world part (the note under the label…), world type: subtitle, pills, labels, stamps not taken over
    const br = S.brand(t); if (br && has('BZ_scene')) BZ_scene(br, t, L);
    const ec = S.endcard(t); if (ec && has('BZ_end')) BZ_end(ec, t, L, 'world');
    if (has('TY_world')) TY_world(t, L);
    ctx.restore();
    // 10 — screen space: the morning air (rays, motes, grade), the brand's violet light, then type
    if (has('T_atmos')) T_atmos(f, L);
    if (L.violet > .01 && has('BZ_atmos')) BZ_atmos(t, L);
    const mb = S.memeBand(t); if (mb && has('OM_memeBand')) OM_memeBand(mb, t);
    if (br && has('BZ_roles')) BZ_roles(br, t, L);
    if (ec && has('BZ_end')) BZ_end(ec, t, L, 'screen');
    if (has('TY_draw')) TY_draw(t, L);
  } });
  window.__FB = FB; window.__amberLayout = amberLayout;   // for the modules' debug (compare with the fallback)
})();
