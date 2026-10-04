'use strict';
// =============================================================================================
// « TCHAC ! » — composition: camera, draw order, calls the modules if they are loaded, simple fallbacks otherwise.
//   MC_* = M1 « money & cuts »  (scenes/20_money.js)   ·   BZ_* = M2 « Bonzini & end » (scenes/70_bonzini.js)
//   K_*  = the margouillat (40_gecko.js)               ·   TY_* = type (60_type.js)
// Every module function receives the state the score computed (SCORE.xxx(t)) + t + L (light) + n (frame).
// Fallbacks are built from the shared props (00_money.js, kit.js): readable animatic, not the final look.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T;
  const has = n => typeof window[n] === 'function';
  const ORANGE = '#FE560D', AMBER = '#F3A745', INK = '#231629', VIOLET = '#7B4BFF', VIOLET_D = '#5B2BDF', CREAM = '#FBF6EC';

  // ------------------------------------------------------------------ fallbacks
  const FB = {
    table(t, n, L) {                                   // the cream paper table, with overscan for camera pushes / shakes
      ctx.drawImage(TEX.table, -60, -100, W + 120, H + 200);
    },
    violet(t, L) {                                     // brand light: violet wash from above + a soft pool (ONLY with Bonzini)
      if (L.violet <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .28 * L.violet; ctx.fillStyle = '#B9A4FF'; ctx.fillRect(-60, -100, W + 120, H + 200); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(540, 760, 60, 540, 760, 900);
      g.addColorStop(0, `rgba(169,120,255,${.22 * L.violet})`); g.addColorStop(1, 'rgba(169,120,255,0)'); ctx.fillStyle = g; ctx.fillRect(-60, -100, W + 120, H + 200); ctx.restore();
    },
    note(st, t, n) {
      const { w, h } = st;
      at(st.x, st.y, st.rot, st.s * st.sx, st.s * st.sy, () => {
        if (st.outline > 0) { ctx.save(); ctx.globalAlpha *= st.outline * .8; ctx.strokeStyle = 'rgba(60,50,70,.45)'; ctx.setLineDash([12, 9]); ctx.lineWidth = 3; rrect(-w / 2, -h / 2, w, h, 14); ctx.stroke(); ctx.restore(); }
        if (!st.visible) return;
        ctx.translate(st.off, 0);
        const x0 = st.from * w - w / 2;
        withShadow(6, () => banknote(w, h, { value: 10000, serial: 'SPÉCIMEN', clip: [x0, w / 2 + 2] }));
        ctx.save(); ctx.beginPath(); ctx.rect(x0, -h / 2, w / 2 - x0, h); ctx.clip();
        at(-w * .26, h * .22, -.2, 1, 1, () => stampText('SPÉCIMEN', 0, 0, font(FF.stencil, 64, 900), 'rgba(170,40,30,.6)', { alpha: .5, ls: 10, h: 90 }));
        // pencil cut marks on the part still attached
        if (st.cutLines > 0) { ctx.globalAlpha *= st.cutLines; ctx.strokeStyle = 'rgba(35,22,41,.5)'; ctx.lineWidth = 3; ctx.setLineDash([12, 9]);
          for (const f of S.EDGES.slice(1, 6)) { const x = f * w - w / 2; if (x <= x0 + 1) continue; ctx.beginPath(); ctx.moveTo(x, -h / 2 - 14); ctx.lineTo(x, h / 2 + 14); ctx.stroke(); } }
        ctx.restore();
      });
    },
    piece(p, st) {
      const { w, h } = st, cxl = ((p.a + p.b) / 2 - .5) * w;
      at(p.x, p.y, p.rot, p.s, p.s, () => { ctx.globalAlpha *= p.alpha; ctx.translate(-cxl, 0);
        withShadow(p.reform ? 8 : 14, () => banknote(w, h, { value: 10000, serial: 'SPÉCIMEN', clip: [p.a * w - w / 2, p.b * w - w / 2 + (p.reform ? 1 : 0)] })); });
    },
    scissors(st) { if (st.a <= 0) return; at(st.x, st.y, st.rot, st.s, st.s, () => withShadow(26, () => scissors(st.open, ORANGE))); },
    sneaker(st) { at(st.x, st.y, st.rot, st.s, st.s, () => sneaker(330, { color: '#3D6BD8', accent: AMBER, lift: 10 })); },   // never violet before Bonzini
    envelope(it, t, n) {
      const ew = S.G.env.w, eh = S.G.env.h;
      at(it.x, it.y, it.rot, it.s * it.sx, it.s * it.sy, () => {
        ctx.globalAlpha *= it.a;
        withShadow(6, () => { ctx.fillStyle = C.kraftL; rrect(-ew / 2, -eh / 2, ew, eh, 8); ctx.fill(); });
        ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .6; rrect(-ew / 2, -eh / 2, ew, eh, 8); ctx.fill(); ctx.globalAlpha /= .6;
        ctx.fillStyle = 'rgba(90,60,30,.32)'; ctx.beginPath(); ctx.moveTo(-ew / 2, -eh / 2); ctx.lineTo(0, -eh / 2 + eh * .42); ctx.lineTo(ew / 2, -eh / 2); ctx.closePath(); ctx.fill();
        if (it.fill > 0) { ctx.fillStyle = '#CFE3C9'; rrect(-ew / 2 + 30, -eh / 2 - 22, ew - 60, 34, 4); ctx.fill(); }   // the note peeking out
        const lf = font(FF.stencil, it.label.length > 10 ? 52 : 60, 900);
        text(it.label, 0, -eh / 2 + eh * .62, { font: lf, align: 'center', color: INK, ls: 2 });
        if (it.amountK > 0) handText(fmtN(it.amount), 0, eh / 2 - 14, 92, { write: it.amountK, color: ORANGE, pen: false });
        if (it.art > 0 && it.id === 'transport') { ctx.save(); ctx.globalAlpha *= it.art; at(-ew / 2 + 56, -eh / 2 + 40, 0, 1, 1, () => truck(INK)); at(ew / 2 - 54, -eh / 2 + 42, 0, 1.1, 1.1, () => iconShip(C.sea)); ctx.restore(); }
        if (it.art > 0 && it.id === 'douane') at(ew / 2 - 50, -eh / 2 - 6, .05, it.art, it.art, () => postIt(290, () => {   // v2: « EXEMPLE / dépend du / produit », ≥ 44 px
          const ls = it.sticker.split('|');
          ls.forEach((l, i) => text(l, 0, -50 + i * 50, { font: font(FF.hand, 44, 800), align: 'center', color: i === 0 ? ORANGE : INK })); }, { lift: 6 }));
        if (it.art > 0 && it.id === 'frais') { const ws = it.doodles; ws.forEach((wd, i) => { const k = S.kk(it.art, i / 4, (i + 1) / 4);   // v2: 2 × 2 grid, 42 px (was one row at 28 px)
          if (k > 0) handText(wd, i % 2 ? 60 : -100, -eh / 2 + 112 + 44 * Math.floor(i / 2), 42, { write: k, color: INK, pen: false }); }); }
      });
    },
    box(it, t, n) {
      const bw = S.G.box.w, bh = S.G.box.h;
      at(it.x, it.y, it.rot, it.s * it.sx * (it.boing ? it.boing.sx : 1), it.s * it.sy * (it.boing ? it.boing.sy : 1), () => {
        withShadow(8, () => { ctx.fillStyle = '#E8E0D2'; rrect(-bw / 2, -bh / 2, bw, bh, 6); ctx.fill(); });
        ctx.fillStyle = '#5A3E24'; rrect(-bw / 2 + 14, -bh / 2 + 14, bw - 28, bh - 28, 4); ctx.fill();
        if (it.feet > 0) { at(-70, -10, -.1, 1, 1, () => sneaker(200, { color: '#3D6BD8', accent: AMBER, lift: 2 })); at(70, 26, -.1, 1, 1, () => sneaker(200, { color: '#3D6BD8', accent: AMBER, lift: 4 }));
          handText('G', -70, -60, 44, { color: ORANGE, pen: false }); handText('G', 70, -24, 44, { color: ORANGE, pen: false }); }
        const lid = it.lid; if (lid < 1) at(-lid * 120, -lid * 150, -lid * .35, 1, 1, () => shoeBox(bw + 10, bh + 10, { lift: 6 + lid * 30, band: ORANGE }));
      });
    },
    calc(st) {
      const { w, h } = S.G.calc;
      at(st.x, st.y, st.rot, st.s, st.s, () => {
        withShadow(16, () => { ctx.fillStyle = '#2B2230'; rrect(-w / 2, -h / 2, w, h, 30); ctx.fill(); });
        ctx.fillStyle = st.flash > 0 ? '#E8F0D8' : M.lcd; rrect(-w / 2 + 22, -h / 2 + 56, w - 44, h - 100, 14); ctx.fill();
        text(st.label, 0, -h / 2 + 40, { font: font(FF.mono, 25, 800), align: 'center', color: AMBER, ls: 1 });
        const red = st.zero > .5, v = fmtN(st.value);
        text(v, w / 2 - 70, h / 2 - 66, { font: font(FF.brand, 104, 900), align: 'right', color: red ? M.red : M.lcdInk });
        if (st.ask) { ctx.save(); ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(w / 2 - 10, -h / 2 + 10, 44, 0, 7); ctx.fill(); text('?', w / 2 - 10, -h / 2 + 34, { font: font(FF.brand, 70, 900), align: 'center', color: INK }); ctx.restore(); }
        text('F', w / 2 - 36, h / 2 - 68, { font: font(FF.brand, 50, 900), align: 'center', color: red ? M.red : M.lcdInk });
        ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 4; i++) { rrect(-w / 2 + 30 + i * 84, h / 2 - 34, 70, 18, 6); ctx.fill(); }
      });
    },
    stamp(st) {
      ctx.save(); ctx.globalAlpha *= st.a;
      const k = st.k; if (k <= 0) { ctx.restore(); return; }
      const lines = st.text.split('|'), sq = st.landed || { sx: 1, sy: 1 };
      if (st.id === 'invendables') {
        at(st.x, st.y, st.rot, st.s * (1.5 - .5 * S.easeOut(k)), st.s * (1.5 - .5 * S.easeOut(k)), () => { ctx.globalAlpha *= Math.min(1, k * 2);
          withShadow(4, () => { ctx.fillStyle = 'rgba(251,246,236,.92)'; rrect(-470, -140, 940, 290, 14); ctx.fill(); });
          stampText(lines[0], 0, -70, font(FF.stencil, 92, 900), ORANGE, { ls: 2, starve: .35 });
          stampText(lines[1], 0, 26, font(FF.stencil, 104, 900), ORANGE, { ls: 4, starve: .35 });
          if ((st.subK ?? 1) > 0) text(st.sub, 0, 120, { font: font(FF.body, 40, 800), align: 'center', color: INK, alpha: st.subK ?? 1 }); });
      } else {
        at(st.x, st.y, st.rot, st.s * sq.sx, st.s * sq.sy, () => {
          withShadow(10 + 60 * (1 - k), () => { ctx.fillStyle = 'rgba(251,246,236,.96)'; rrect(-450, -230, 900, 470, 24); ctx.fill(); });
          ctx.strokeStyle = ORANGE; ctx.lineWidth = 12; rrect(-420, -200, 840, 410, 18); ctx.stroke();
          text(lines[0], 0, -60, { font: font(FF.stencil, 120, 900), align: 'center', color: ORANGE, ls: 2 });
          if ((st.eqK ?? 1) > 0) text(lines[1], 0, 150, { font: font(FF.brand, 210, 900), align: 'center', color: M.red, alpha: st.eqK ?? 1 });
        });
      }
      ctx.restore();
    },
    pile(st, t) {
      if (st.labelK > 0) paperNote(st.x, st.y - 250, 470, 82, -.03, () => text(st.label, 0, 17, { font: font(FF.stencil, 52, 900), align: 'center', color: INK, ls: 1 }), { seed: 31, h: 8 });
      if (st.arrowK > 0) handArrow([[st.x + 150, st.y - 20], [st.x + 260, st.y - 70], [st.tagX - 190, st.tagY - 30]], st.arrowK, ORANGE, 9);
      const k = Math.min(1.12, st.tagK); if (k > 0) at(st.tagX, st.tagY, .04, k, k, () => priceTag(330, 210, () => {
        text('TON VRAI', 0, 18, { font: font(FF.stencil, 58, 900), align: 'center', color: INK, ls: 2 }); text('PRIX', 0, 78, { font: font(FF.stencil, 66, 900), align: 'center', color: ORANGE, ls: 4 }); }, { string: 60 }));
    },
    reception(st, t, n, L) {
      ctx.save(); ctx.globalAlpha *= st.a;
      const c = st.carton;
      if (st.scale.a > 0) at(st.scale.x, st.scale.y, 0, 1, 1, () => { ctx.globalAlpha *= st.scale.a; scaleDevice(460, st.scale.needle); });
      at(c.x, c.y, c.rot, 1, 1, () => withShadow(6 + 30 * c.lift, () => carton(330, 230, { seed: 5, label: () => at(40, 40, -.04, 1, 1, () => shipLabel(200, 132, 'sea', 'BZ-000000', { seed: 11 })) })));
      if (st.scan > 0 && st.scan < 1) { ctx.save(); ctx.fillStyle = 'rgba(169,71,254,.85)'; const sx = c.x - 165 + 330 * st.scan; ctx.fillRect(sx - 3, c.y - 115, 6, 230); ctx.fillStyle = 'rgba(169,71,254,.14)'; ctx.fillRect(c.x - 165, c.y - 115, 330, 230); ctx.restore(); }
      if (st.tape > 0) { at(c.x - 170, c.y - 140, 0, 1, 1, () => tapeMeasure(340, st.tape)); at(c.x + 195, c.y - 118, 0, 1, 1, () => tapeMeasure(240, st.tape, true)); }
      const sc = st.scanner; at(sc.x, sc.y, sc.rot, 1, 1, () => { if (st.beam) { ctx.save(); ctx.fillStyle = 'rgba(169,71,254,.35)'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-330, -90); ctx.lineTo(-330, 90); ctx.lineTo(-6, 10); ctx.fill(); ctx.restore(); }
        withShadow(26, () => scanner(0)); if (st.beam) { ctx.fillStyle = C.violet; rrect(-8, -34, 22, 68, 8); ctx.fill(); } });
      const stp = (k, s, p) => { if (k <= 0) return; at(p.x, p.y, -.06, 1.4 - .4 * S.easeOut(k), 1.4 - .4 * S.easeOut(k), () => { ctx.globalAlpha *= Math.min(1, k * 2); stampText(s, 0, 0, font(FF.stencil, 78, 900), VIOLET_D, { box: true, boxW: 8, h: 110, starve: .3, ls: 3 }); }); };
      stp(st.pese, 'PESÉ ✓', G.stamps.pese); stp(st.mesure, 'MESURÉ ✓', G.stamps.mesure);
      ctx.restore();
    },
    plate(st) {
      at(st.x, st.y, st.rot, st.s * st.sx, st.s * st.sy, () => { ctx.globalAlpha *= st.a;
        withShadow(14, () => { ctx.fillStyle = VIOLET_D; rrect(-440, -105, 880, 210, 30); ctx.fill(); });
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 5; rrect(-420, -85, 840, 170, 22); ctx.stroke();
        drawLogo(-345, 0, 120);
        text('BONZINI', 40, -12, { font: font('Satoshi', 92, 900), align: 'center', color: CREAM, ls: 3 });
        text('TRADING CARGO', 40, 56, { font: font('Satoshi', 50, 900), align: 'center', color: '#FFE9C2', ls: 8 });
        if (st.sweep > 0 && st.sweep < 1) { ctx.save(); rrect(-440, -105, 880, 210, 30); ctx.clip(); const x = -540 + 1080 * st.sweep, g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-440, -105, 880, 210); ctx.restore(); }
      });
    },
    crumb(c) { at(c.x, c.y, c.rot, c.s, c.s, () => { withShadow(3, () => { ctx.fillStyle = c.i ? '#E7E4C4' : '#CFE3C9'; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(12, -11); ctx.lineTo(15, 7); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); }); }); },
  };
  function truck(col) {                                // felt-pen lorry (doodle)
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeRect(-34, -16, 42, 26); ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(24, -6); ctx.lineTo(32, 4); ctx.lineTo(32, 10); ctx.lineTo(8, 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(-20, 14, 6, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(20, 14, 6, 0, 7); ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------ the scene
  registerScene({ id: 'compose', z: 10, draw(t, n) {
    const L = S.light(t), cam = S.camera(t);
    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); if (cam.rot) ctx.rotate(cam.rot); ctx.translate(-cam.cx, -cam.cy);
    // 1 — the paper table, then the brand light (violet only from A.brandIn)
    FB.table(t, n, L);
    if (has('BZ_light')) BZ_light(t, L); else FB.violet(t, L);
    // 2 — the note: outline, remaining part, flying / re-forming pieces
    const nt = S.note(t);
    if (has('MC_note')) MC_note(nt, t, L, n); else { FB.note(nt, t, n); for (const p of nt.pieces) FB.piece(p, nt); }
    // 3 — the hook props: sneaker (its price tag is type, see TY_world)
    const hk = S.hook(t);
    if (hk) has('MC_sneaker') ? MC_sneaker(hk.sneaker, t, L, n) : FB.sneaker(hk.sneaker);
    // 4 — envelopes + box: the row first, then the active one, the pile in stacking order
    const its = S.items(t).sort((a, b) => (a.stack > 0 || b.stack > 0) ? a.k - b.k : a.active - b.active);
    for (const it of its) {
      if (it.id === 'box') has('MC_box') ? MC_box(it, t, L, n) : FB.box(it, t, n);
      else has('MC_envelope') ? MC_envelope(it, t, L, n) : FB.envelope(it, t, n);
    }
    // 5 — calculator, pile label / arrow / price tag, the money stamps
    const cs = S.calc(t); if (cs) has('MC_calc') ? MC_calc(cs, t, L, n) : FB.calc(cs);
    const pl = S.pile(t); if (pl) has('MC_pile') ? MC_pile(pl, t, L, n) : FB.pile(pl, t);
    for (const st of S.stamps(t)) has('MC_stamp') ? MC_stamp(st, t, L, n) : FB.stamp(st);
    // 6 — Bonzini: the reception (carton, scanner, scale, tape, PESÉ ✓ MESURÉ ✓) and the enamel plate
    const rc = S.reception(t); if (rc) has('BZ_reception') ? BZ_reception(rc, t, L, n) : FB.reception(rc, t, n, L);
    const pt = S.plate(t); if (pt) has('BZ_plate') ? BZ_plate(pt, t, L, n) : FB.plate(pt);
    // 7 — the margouillat and his two crumbs of the note
    for (const c of S.crumbs(t)) has('MC_crumb') ? MC_crumb(c, t, L, n) : FB.crumb(c);
    if (has('K_gecko')) K_gecko(t, L, S.gecko(t)); else { ctx.fillStyle = '#E8743B'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 22, 64, .6, 0, 7); ctx.fill(); }
    // 8 — the scissors, high above the table (over everything physical)
    const sc = S.scissors(t); has('MC_scissors') ? MC_scissors(sc, t, L, n) : FB.scissors(sc);
    // 9 — type in the world: price tag + stamp, TOI cards and pill
    if (has('TY_world')) TY_world(t, L, n);
    ctx.restore();
    // 10 — screen space: chip, EXEMPLE FICTIF, headlines, bands; end card / ritual / CTA (TY_draw hands them to
    //      BZ_endcard / BZ_ritual / BZ_cta when M2 is loaded), then the loop overlay
    if (has('TY_draw')) TY_draw(t, L, n);
    if (has('BZ_loop')) BZ_loop(S.loop(t), t, L, n);
  } });
})();
