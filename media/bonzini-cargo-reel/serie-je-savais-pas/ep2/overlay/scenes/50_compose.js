'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » — composition: camera, draw order, calls the modules when they exist, else simple fallbacks.
//   M1 « carton & air »  (30_carton.js, 32_air.js, 34_plates.js, 36_measure.js — prefix CA_)
//   M2 « Bonzini & end » (70_bonzini.js, 76_end.js — prefix BZ_)
//   K  margouillat       (40_gecko.js via 39_gecko_shim.js)          TY type (60_type.js)
// Read serie/ep2/MODULES.md for the exact APIs. Fallbacks are deliberately plain (animatic blocks).
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk;
  const has = n => typeof window[n] === 'function';
  const INK = '#231629', CREAM = '#FFF6E8', ORANGE = '#FE560D', AMBER = '#F3A745', SEA = '#0B5FA5', VIOL = '#7B4BFF';
  const poly = P => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // ------------------------------------------------------------------ fallbacks (animatic blocks)
  const FB = {
    carton(st, pass, t, n) {
      const g = S.cartonGeo(st), j = S.cartonJit(st, t);
      ctx.save(); ctx.globalAlpha *= st.a ?? 1; ctx.translate(j.x, j.y); if (j.r) { ctx.translate(st.x, st.y); ctx.rotate(j.r); ctx.translate(-st.x, -st.y); }
      if (st.rot) { ctx.translate(g.cx, st.y); ctx.rotate(st.rot); ctx.translate(-g.cx, -st.y); }
      const { FTL, FTR, FBR, FBL, BTL, BTR, BBR, w, h } = g;
      if (pass === 'back') {
        // shadow on the table
        ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.22)'; poly([[FBL[0] + 10, FBL[1] + 6], [FBR[0] + 14, FBR[1] + 10], [BBR[0] + 22, BBR[1] + 10], [BTR[0] + 22, BBR[1] - 30]]); ctx.fill(); ctx.restore();
        if (st.lid > .02) {
          // cut-away interior: back wall, floor, sandals, the void hatched « VIDE »
          ctx.fillStyle = '#7A5634'; poly([FTL, FTR, FBR, FBL]); ctx.fill();
          ctx.fillStyle = '#946A40'; poly([FTL, FTR, [FTR[0], FTR[1] + h * .18], [FTL[0], FTL[1] + h * .18]]); ctx.fill();
          if (st.sandalsOn) FB.sandals(g, st.sandals, n);
          if (st.hatch > 0) {
            const x0 = FBL[0] + w * .38, x1 = FBR[0] - 8, y0 = FTL[1] + 10, y1 = FBL[1] - 8;
            ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, (x1 - x0) * st.hatch, y1 - y0); ctx.clip();
            ctx.fillStyle = 'rgba(156,195,230,.55)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            ctx.strokeStyle = 'rgba(47,120,189,.75)'; ctx.lineWidth = 6; const off = (stepT(n) * 30) % 30;
            for (let x = x0 - (y1 - y0); x < x1; x += 30) { ctx.beginPath(); ctx.moveTo(x + off, y1); ctx.lineTo(x + off + (y1 - y0), y0); ctx.stroke(); }
            ctx.restore();
            if (st.vide > 0) { const s = (.6 + .4 * st.vide) * g.s * Math.min(1, w / 400); text('VIDE', (x0 + x1) / 2, (y0 + y1) / 2 + 40 * s, { font: font(FF.stencil, Math.round(110 * s), 900), align: 'center', color: SEA, alpha: st.vide, ls: 6 }); }
          }
        }
        // back flaps when open
        if (st.flaps > .02) {
          const up = [0, -h * .42 * st.flaps];
          ctx.fillStyle = '#B98D59'; poly([BTL, BTR, add(BTR, up), add(BTL, up)]); ctx.fill();
          ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 2; ctx.stroke();
        }
      } else {
        // right side face
        ctx.fillStyle = C.kraftD; poly([FTR, BTR, BBR, FBR]); ctx.fill();
        // top
        if (st.flaps > .02) {
          ctx.fillStyle = '#4A321C'; poly([FTL, FTR, BTR, BTL]); ctx.fill();
          const sideL = [-w * .2 * st.flaps, -h * .1 * st.flaps];
          ctx.fillStyle = '#C79E6C'; poly([FTL, BTL, add(BTL, sideL), add(FTL, sideL)]); ctx.fill();
          ctx.fillStyle = '#B98D59'; poly([FTR, BTR, add(BTR, [w * .16 * st.flaps, -h * .08 * st.flaps]), add(FTR, [w * .2 * st.flaps, -h * .02 * st.flaps])]); ctx.fill();
        } else {
          ctx.fillStyle = TEX.kraft; poly([FTL, FTR, BTR, BTL]); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,210,.18)'; poly([FTL, FTR, BTR, BTL]); ctx.fill();
          ctx.strokeStyle = 'rgba(90,60,30,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); const m0 = [(FTL[0] + BTL[0]) / 2, (FTL[1] + BTL[1]) / 2], m1 = [(FTR[0] + BTR[0]) / 2, (FTR[1] + BTR[1]) / 2]; ctx.moveTo(...m0); ctx.lineTo(...m1); ctx.stroke();
          if (st.tape > 0) { const tw = 46 * g.s; ctx.fillStyle = 'rgba(214,170,110,.95)'; const e = [lerp(m0[0], m1[0] + 30, st.tape), lerp(m0[1], m1[1], st.tape)];
            poly([[m0[0] - 30, m0[1] - tw / 2], [e[0], e[1] - tw / 2], [e[0], e[1] + tw / 2], [m0[0] - 30, m0[1] + tw / 2]]); ctx.fill(); }
        }
        // front face (the flank), lifting like a lid
        if (st.lid < .98) {
          const k = st.lid, bot = [FBL[0], lerp(FBL[1], FTL[1], k)], botR = [FBR[0], lerp(FBR[1], FTR[1], k)];
          ctx.fillStyle = TEX.kraft; poly([FTL, FTR, botR, bot]); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 2; ctx.stroke();
          if (st.flaps > .02 && k < .1) { ctx.fillStyle = '#B98D59'; poly([FTL, FTR, [FTR[0], FTR[1] + h * .16 * st.flaps], [FTL[0], FTL[1] + h * .16 * st.flaps]]); ctx.fill(); }   // the front flap folded down
        }
        if (st.lid > .02) {        // the lifted flank seen from inside, above the opening
          const k = st.lid, up = h * .34 * k; ctx.fillStyle = '#D9B98C'; poly([FTL, FTR, [FTR[0] + 6, FTR[1] - up], [FTL[0] - 6, FTL[1] - up]]); ctx.fill();
          ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      ctx.restore();
    },
    sandals(g, k, n) {             // 3 unbranded pairs: heaped in the left corner (0) → head-to-tail, tight (1)
      const { FBL, w, h } = g, ks = stepT(n) >= 0 ? k : k;
      for (let i = 0; i < 6; i++) {
        const mx = FBL[0] + w * (.08 + .05 * (i % 3)) + 30 * rnd(i * 3.1), my = FBL[1] - h * (.18 + .12 * Math.floor(i / 2)) - 10 * rnd(i);
        const tx = FBL[0] + w * (.1 + (i % 3) * .3) + 10, ty = FBL[1] - h * (.25 + .4 * (i % 2));
        const x = lerp(mx, tx, ks), y = lerp(my, ty, ks), r = lerp((rnd(i * 7.7) - .5) * 1.6, i % 2 ? Math.PI : 0, ks);
        at(x + w * .1, y, r, g.s, g.s, () => { ctx.fillStyle = ['#2E8B7A', '#E07A2E', '#3C4A8C'][i >> 1]; rrect(-55, -20, 110, 40, 18); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(10, 0); ctx.lineTo(-10, 18); ctx.stroke(); });
      }
    },
    air(st, t) {
      ctx.save(); ctx.globalAlpha *= st.a; ctx.translate(st.x, st.y); ctx.rotate(st.rot || 0); ctx.scale(st.s * st.sx, st.s * st.sy);
      // its tag « À PAYER » on an orange string
      if (st.tag && st.tag.a > .05) {
        ctx.save(); ctx.globalAlpha *= st.tag.a; ctx.strokeStyle = ORANGE; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-180, 70);
        const tx = -250 + Math.sin(st.tag.sw) * 60, ty = 210; ctx.quadraticCurveTo(-230, 120, tx, ty - 50); ctx.stroke();
        at(tx, ty, st.tag.sw, 1, 1, () => priceTag(230, 128, () => handText('À PAYER', 0, 40, 48, { color: M.red, pen: false })));
        ctx.restore();
      }
      withShadow(18, () => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); for (const [x, y, r] of [[-170, 30, 95], [-60, -50, 125], [80, -40, 120], [190, 30, 90], [0, 60, 110], [-110, 70, 80], [120, 70, 85]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7); } ctx.fill(); });
      text('AIR', 0, 52, { font: font(FF.stencil, 170, 900), align: 'center', color: SEA, ls: 10 });
      const ey = -112, lid = st.mood === 'content' ? .5 : 0;     // two little eyes: proud / content / nervous
      for (const ex of [-60, 60]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 11, 15 * (1 - lid), 0, 0, 7); ctx.fill(); }
      if (st.mood === 'nervous' || st.mood === 'fleeing') { ctx.fillStyle = '#7FC4FF'; ctx.beginPath(); ctx.ellipse(130, -110, 9, 14, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    plate(st) {
      const pal = { title: [ORANGE, '#B83A06', CREAM], toi: [AMBER, '#B87513', '#2A1606'], toiSmall: [AMBER, '#B87513', '#2A1606'], bateau: ['#A89A86', '#6F6455', INK] }[st.kind];
      const sizes = { title: [84, 84, 170], toi: [96, 96], bateau: [84, 84, 84], toiSmall: [62, 62, 62] }[st.kind];
      const hgt = G.plateH[st.kind], wd = G.plateW - (st.kind === 'toiSmall' ? 120 : 0);
      ctx.save(); ctx.globalAlpha *= st.a ?? 1; ctx.translate(st.x, st.y); ctx.rotate(st.rot || 0);
      const sj = st.shake ? (rnd(Math.floor(window.__t * 15) * 3.3) - .5) * 4 * st.shake : 0; ctx.translate(sj, 0);
      ctx.scale((st.s ?? 1) * (st.sx ?? 1), (st.s ?? 1) * (st.sy ?? 1));
      ctx.fillStyle = 'rgba(60,32,12,.28)'; rrect(-wd / 2 + 12, -hgt / 2 + 22, wd, hgt, 22); ctx.fill();
      ctx.fillStyle = pal[1]; rrect(-wd / 2, -hgt / 2 + 12, wd, hgt, 22); ctx.fill();
      ctx.fillStyle = pal[0]; rrect(-wd / 2, -hgt / 2, wd, hgt, 22); ctx.fill();
      const lh = sizes.map(z => z * 1.04), tot = lh.reduce((a, b) => a + b, 0); let y = -tot / 2;
      st.lines.forEach((l, i) => { const z = sizes[i]; y += lh[i]; text(l, 0, y - z * .16, { font: font('Satoshi', z, 900), align: 'center', color: st.kind === 'bateau' && i === st.emph ? ORANGE : pal[2], ls: -1 }); });
      if (st.sweat > 0) for (let i = 0; i < 3; i++) { const yy = -hgt / 2 + 30 + ((window.__t * 160 + i * 70) % (hgt + 40)) * st.sweat; ctx.fillStyle = '#9FD4FF'; ctx.beginPath(); ctx.ellipse(wd / 2 - 40 - i * 26, yy, 8, 12, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    tape(tp) {
      for (const e of tp.edges) {
        if (e.mark > 0) { ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...e.p0); ctx.lineTo(lerp(e.p0[0], e.p1[0], e.mark), lerp(e.p0[1], e.p1[1], e.mark)); ctx.stroke(); ctx.restore(); }
        if (e.k > 0) { const a = Math.atan2(e.p1[1] - e.p0[1], e.p1[0] - e.p0[0]), len = Math.hypot(e.p1[0] - e.p0[0], e.p1[1] - e.p0[1]); at(e.p0[0], e.p0[1], a, 1, 1, () => withShadow(8, () => tapeMeasure(len, e.k))); }
      }
    },
    split(sp) {
      ctx.save(); ctx.globalAlpha *= sp.k;
      ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.lineWidth = 5; ctx.setLineDash([22, 16]); ctx.beginPath(); ctx.moveTo(G.cx, 660); ctx.lineTo(G.cx, 1340); ctx.stroke(); ctx.setLineDash([]);
      const gy = G.split.gaugeY;
      for (const [x0, len, k] of [[G.split.L - G.split.gaugeL / 2, G.split.gaugeL, sp.gaugeL], [G.split.R - G.split.gaugeL / 2, G.split.gaugeR, sp.gaugeR]]) {
        ctx.fillStyle = 'rgba(35,22,41,.12)'; rrect(x0, gy - 26, G.split.gaugeL, 52, 26); ctx.fill();
        ctx.fillStyle = ORANGE; rrect(x0, gy - 26, Math.max(52, len * k), 52, 26); ctx.fill();
        text('m³', x0 - 14, gy + 16, { font: font('Satoshi', 46, 900), align: 'right', color: INK });
      }
      ctx.restore();
    },
    glass(gl) {
      at(gl.x, gl.y, 0, gl.s, gl.s, () => {
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-60, -170); ctx.quadraticCurveTo(-70, -40, 0, -10); ctx.quadraticCurveTo(70, -40, 60, -170); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 80); ctx.moveTo(-50, 84); ctx.lineTo(50, 84); ctx.stroke();
        if (gl.wrap > 0) { ctx.save(); ctx.beginPath(); ctx.rect(-130, 120 - 320 * gl.wrap, 260, 320 * gl.wrap); ctx.clip();
          ctx.fillStyle = 'rgba(200,230,255,.55)'; rrect(-110, -200, 220, 310, 40); ctx.fill();
          ctx.strokeStyle = 'rgba(80,140,200,.7)'; ctx.lineWidth = 3; for (let y = -180; y < 100; y += 34) for (let x = -90 + (y / 34 % 2 ? 17 : 0); x < 100; x += 34) { ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); }
          ctx.restore(); }
      });
    },
    bzLabel(st, t) {
      const g = S.cartonGeo(st), j = S.cartonJit(st, t), lw = g.w * .78, lh = g.h * .66, x = g.cx + j.x, y = g.cy + 6 + j.y;
      at(x, y, -.02 + j.r, st.label, st.label, () => {
        ctx.fillStyle = CREAM; rrect(-lw / 2, -lh / 2, lw, lh, 8); ctx.fill(); ctx.fillStyle = SEA; ctx.fillRect(-lw / 2, -lh / 2, lw, lh * .26);
        at(-lw / 2 + 34, -lh / 2 + lh * .13, 0, .8, .8, () => iconShip('#fff'));
        text('BZ-482913', -lw / 2 + 18, -lh / 2 + lh * .26 + 46, { font: font(FF.mono, 32, 800), color: INK });
        text('exemple', -lw / 2 + 18, -lh / 2 + lh * .26 + 84, { font: font('Satoshi', 26, 700), color: ORANGE });
        ctx.fillStyle = 'rgba(35,22,41,.18)'; for (let i = 0; i < 3; i++) rrect(-lw / 2 + 18, lh / 2 - 60 + i * 16, lw * .62 - i * 30, 9, 4), ctx.fill();   // address, blurred
      });
    },
    bz(b, t) {
      if (b.tape > 0 && b.geo) at(b.geo.FBL[0], b.geo.FBL[1] + 30, 0, 1, 1, () => withShadow(8, () => tapeMeasure(b.geo.w, b.tape)));
      if (b.scanner.k > 0) {
        const sx = b.scanner.x, sy = b.scanner.y;
        if (b.beam && b.geo) { ctx.save(); ctx.globalAlpha *= .8; const gr = ctx.createLinearGradient(sx, 0, b.geo.cx, 0); gr.addColorStop(0, 'rgba(169,71,254,.7)'); gr.addColorStop(1, 'rgba(169,71,254,.15)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx - 8, sy - 6); ctx.lineTo(b.geo.cx, b.geo.cy - 70); ctx.lineTo(b.geo.cx, b.geo.cy + 70); ctx.lineTo(sx - 8, sy + 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = C.violet; ctx.fillRect(b.geo.cx - 3, b.geo.cy - 70, 6, 140); ctx.restore(); }
        at(sx, sy, .05, 1, 1, () => withShadow(30, () => { scanner(b.beam); if (b.beam) { ctx.fillStyle = C.violet; rrect(-8, -34, 22, 68, 8); ctx.fill(); } }));
      }
      if (b.air) { const m = b.air; at(m.x, m.y, 0, m.s, m.s, () => { FB.air({ x: 0, y: 0, s: 1, sx: 1, sy: 1, rot: 0, a: 1, mood: 'content', tag: null }, t);
        if (m.strike > 0) { ctx.strokeStyle = C.violet; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-280, 90); ctx.lineTo(-280 + 560 * m.strike, 90 - 200 * m.strike); ctx.stroke(); } }); }
    },
    bzPlate(st) {
      ctx.save(); ctx.translate(st.x, st.y); ctx.scale(st.sx, st.sy);
      ctx.fillStyle = 'rgba(30,10,60,.3)'; rrect(-420 + 10, -100 + 18, 840, 200, 30); ctx.fill();
      ctx.fillStyle = '#5B2BDF'; rrect(-420, -100 + 10, 840, 200, 30); ctx.fill(); ctx.fillStyle = VIOL; rrect(-420, -100, 840, 200, 30); ctx.fill();
      drawLogo(-330, 0, 120);
      text('BONZINI', -250, -8, { font: font('Satoshi', 92, 900), color: CREAM });
      text('TRADING CARGO', -250, 64, { font: font('Satoshi', 58, 900), color: CREAM, ls: 2 });
      ctx.restore();
    },
  };

  registerScene({ id: 'compose', z: 10, draw(t, n) {
    window.__t = t;
    const L = S.light(t), cam = S.camera(t);
    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    // 1 — the packing table (drawn larger than the frame: the camera pushes and shakes)
    if (has('CA_table')) CA_table(t, L, n); else ctx.drawImage(TEX.table, -60, -60, W + 120, H + 120);
    // 2 — the margouillat, bottom-left, on the table
    const g = S.gecko(t);
    if (has('K_gecko')) K_gecko(t, L, g); else { ctx.fillStyle = '#5282FF'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 26, 70, .7, 0, 7); ctx.fill(); ctx.fillStyle = '#FF8526'; ctx.beginPath(); ctx.arc(G.gecko.x + 40, G.gecko.y - 50, 24, 0, 7); ctx.fill(); }
    // 3 — the cartons, back to front; a cloud sitting in a carton's void is drawn between its back and front passes
    const cloud = S.air(t), drawAir = st => has('CA_air') ? CA_air(st, t, L) : FB.air(st, t);
    for (const c of S.cartons(t)) {
      has('CA_carton') ? CA_carton(c, 'back', t, L) : FB.carton(c, 'back', t, n);
      if (cloud && cloud.inside && c.id === 'hero') drawAir(cloud);
      has('CA_carton') ? CA_carton(c, 'front', t, L) : FB.carton(c, 'front', t, n);
      if (c.label > 0) has('BZ_onCarton') ? BZ_onCarton(c, t, L) : FB.bzLabel(c, t);
    }
    // 4 — AVANT / APRÈS divider + gauges, the bubble-wrapped glass, the tape measure
    const sp = S.split(t); if (sp) has('CA_split') ? CA_split(sp, t, L) : FB.split(sp);
    const gl = S.glass(t); if (gl) has('CA_glass') ? CA_glass(gl, t, L) : FB.glass(gl);
    const tp = S.tape(t); if (tp) has('CA_measure') ? CA_measure(tp, S.formula(t), t, L) : FB.tape(tp);
    // 5 — the thick-cardboard plates (top zone), then their effects (letters gushing out, dust, sweat)
    for (const P of S.plates(t)) has('CA_plate') ? CA_plate(P.kind, P, t, L) : FB.plate(P);
    if (has('CA_fx')) CA_fx(t, L);
    // 6 — the AIR cloud in the air (over everything it flies across)
    if (cloud && !cloud.inside) drawAir(cloud);
    // 7 — Bonzini: the reception (scanner, tape, struck AIR, readout), the enamel plate
    const b = S.bz(t); if (b) has('BZ_scene') ? BZ_scene(b, t, L) : FB.bz(b, t);
    const bp = S.bzPlate(t); if (bp) has('BZ_plate') ? BZ_plate(bp, t, L) : FB.bzPlate(bp);
    // 8 — the end card's world part (the tag line written on the loop carton), then world type: speaker pills, stamps and
    //     readouts the modules do not draw yet
    const ec = S.endcard(t); if (ec && has('BZ_end')) BZ_end(ec, t, L, 'world');
    if (has('TY_world')) TY_world(t, L);
    ctx.restore();
    // 9 — screen space: the brand's violet light, then type (chip, captions, band, end card)
    if (L.violet > .01) { if (has('BZ_atmos')) BZ_atmos(t, L); else { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = L.violet * .55;
      const rg = ctx.createRadialGradient(W / 2, 700, 100, W / 2, 900, 1300); rg.addColorStop(0, '#B48CFF'); rg.addColorStop(1, '#3A1A80'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
    const bd = S.band(t); if (bd && has('BZ_band')) BZ_band(bd, t);
    if (ec && has('BZ_end')) BZ_end(ec, t, L, 'screen');
    if (has('TY_draw')) TY_draw(t, L);
  } });
})();
