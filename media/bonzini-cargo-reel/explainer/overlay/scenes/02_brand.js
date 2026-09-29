// 02_brand.js — brand chapter (motion design): logo assembly locked on "Bonzini" (V02),
// BONZINI TRADING CARGO wordmark, "Le parcours de vos colis" + 6-step teaser row that hands off to the stepper.
(() => {
  'use strict';
  const SEG = 'V02';
  const LX = 540, LY = 500, LS = 470;        // logo centre / size
  const Y_BZ = 830, Y_TC = 910, Y_DIV = 942, Y_SUB = 1012, Y_ROW = 1078;
  const ROW_R = 30, ROW_SP = 98;
  // stepper geometry (must match 30_chapters.js)
  const ST_Y = 206, stX = i => 130 + i * 164;

  function drawBrand(t, n) {
    const BZF = window.BZF, C = TL.ch('brand');
    const wt = (s, nth = 0) => TL.wt(SEG, s, null, nth);
    const tPar = wt('parcours'), tCol = wt('colis'), tLock = wt('bonzini'), tTr = wt('trading'), tCa = wt('cargo');

    // ---- background (edge fades; stays full until the chapter cut so the next MG chapter can take over)
    const bgA = Math.min(eOutCubic(prog(t, C.start, C.start + .35)), 1 - prog(t, C.end, C.end + .35));
    mgBackground(t, .88 * bgA, { cy: LY + 60 });
    // soft vignette to seat the logo
    if (bgA > 0) {
      ctx.save(); ctx.globalAlpha *= bgA;
      const vg = ctx.createRadialGradient(540, 760, 300, 540, 760, 1200);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,10,.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    // ---- exit choreography
    const exK = eInCubic(prog(t, C.end - .65, C.end - .33));        // logo + wordmark
    const exS = eInCubic(prog(t, C.end - .82, C.end - .56));        // tagline + chip (clear the path of the rising dots)
    const aMain = 1 - exK, aSub = 1 - exS;

    // ---- anticipation: target reticle converging where the logo will lock
    const ra = env(t, C.start + .3, tLock + .15, .5, .15);
    if (ra > 0) {
      const k = eInOutCubic(prog(t, C.start + .3, tLock));
      const r = lerp(330, 170, k);
      ctx.save(); ctx.globalAlpha *= ra * aMain;
      ctx.translate(LX, LY); ctx.rotate(t * .6);
      ctx.setLineDash([26, 16]); ctx.strokeStyle = 'rgba(234,246,255,.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.rotate(-t * 1.1);
      ctx.strokeStyle = 'rgba(169,71,254,.8)'; ctx.lineWidth = 4; ctx.shadowColor = VIOLET; ctx.shadowBlur = 14;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, r + 26, i * Math.PI / 2 + .2, i * Math.PI / 2 + .75); ctx.stroke(); }
      ctx.fillStyle = AMBER; ctx.shadowColor = AMBER;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.fillRect(Math.cos(a) * (r + 52) - 5, Math.sin(a) * (r + 52) - 5, 10, 10); }
      ctx.restore();
      // converging particles
      const pk = prog(t, tLock - 1.2, tLock);
      if (pk > 0 && pk < 1) for (let i = 0; i < 30; i++) {
        const q = clamp((pk - rnd(i * 2.7) * .45) / .55); if (q <= 0 || q >= 1) continue;
        const ang = rnd(i * 5.1) * Math.PI * 2 + q * 1.2, d = lerp(560, 40, eInCubic(q));
        BZF.sparkle(LX + Math.cos(ang) * d, LY + Math.sin(ang) * d, 3 + rnd(i) * 5, i % 4 ? ICE : AMBER, .8 * Math.sin(q * Math.PI));
      }
    }

    // ---- logo assembly (lock exactly on "Bonzini")
    if (aMain > 0) {
      ctx.save();
      const s = lerp(1, .86, exK);
      ctx.translate(LX, LY - 60 * exK); ctx.scale(s, s); ctx.translate(-LX, -LY);
      BZF.logoAssembly(t, { x: LX, y: LY, size: LS, tLock, fly: .72, alpha: aMain, shimmerAt: [tLock + 1.2] });
      ctx.restore();
    }

    // ---- wordmark
    if (t >= tLock && aMain > 0) {
      ctx.save(); ctx.globalAlpha *= aMain;
      const k = prog(t, tLock + .02, tLock + .6), sc = lerp(1.3, 1, eOutExpo(k));
      ctx.save(); ctx.translate(540, Y_BZ - 40); ctx.scale(sc, sc);
      txt(decrypt('BONZINI', k, 44), 0, 40, { font: `900 118px ${FONT.display}`, ls: 8, color: '#FFFFFF', align: 'center', glow: 'rgba(169,71,254,.95)', glowBlur: 32, glowTwice: true, alpha: eOutCubic(clamp(k * 4)) });
      ctx.restore();
      const k2 = prog(t, tTr - .06, tTr + .5);
      if (k2 > 0) {
        const gr = ctx.createLinearGradient(130, 0, 950, 0); gr.addColorStop(0, AMBER); gr.addColorStop(1, ORANGE);
        txt(decrypt('TRADING CARGO', k2, 77), 540, Y_TC + (1 - eOutExpo(k2)) * 26, { font: `700 70px ${FONT.display}`, ls: 10, color: gr, align: 'center', glow: 'rgba(254,86,13,.5)', glowBlur: 18, alpha: eOutCubic(clamp(k2 * 3)) });
      }
      const lw = 330 * eOutExpo(prog(t, tCa, tCa + .55));
      if (lw > 1) {
        const lg = ctx.createLinearGradient(540 - lw, 0, 540 + lw, 0);
        lg.addColorStop(0, 'rgba(169,71,254,0)'); lg.addColorStop(.25, VIOLET); lg.addColorStop(.5, AMBER); lg.addColorStop(.75, ORANGE); lg.addColorStop(1, 'rgba(254,86,13,0)');
        ctx.fillStyle = lg; ctx.shadowColor = VIOLET; ctx.shadowBlur = 14; ctx.fillRect(540 - lw, Y_DIV, lw * 2, 4);
      }
      ctx.restore();
    }

    // ---- "Le parcours de vos colis": word-synced hero title in the logo zone, then each word glides
    //      into the tagline slot under the wordmark while the logo pieces fly in
    const WDS = [['Le', 'le'], ['parcours', 'parcours'], ['de', 'de'], ['vos', 'vos'], ['colis', 'colis']];
    const HS = 100, FS = 66, fH = `800 ${HS}px ${FONT.body}`, fF = `800 ${FS}px ${FONT.body}`;
    const lay = (idxs, f, y) => {
      const sp = measure(' ', f), ws = idxs.map(i => measure(WDS[i][0], f));
      let x = 540 - (ws.reduce((a, b) => a + b, 0) + sp * (idxs.length - 1)) / 2; const o = {};
      idxs.forEach((i, j) => { o[i] = [x, y, ws[j]]; x += ws[j] + sp; }); return o;
    };
    const hero = Object.assign(lay([0, 1], fH, LY - 10), lay([2, 3, 4], fH, LY + 106));
    const fin = lay([0, 1, 2, 3, 4], fF, Y_SUB);
    const m0 = tCol + .2;
    const t0 = TL.wt(SEG, 'le') - .1;
    if (t >= t0 && aSub > 0) {
      ctx.save(); ctx.globalAlpha *= aSub;
      WDS.forEach(([w, key], i) => {
        const ts = TL.wt(SEG, key) - .08; if (t < ts) return;
        const k = prog(t, ts, ts + .45), a = eOutCubic(clamp(k * 5)), e = eOutExpo(k);
        const lag = i < 2 ? .14 : 0;                                // lines glide as rigid groups: line 2 first, line 1 follows
        const mk = eInOutCubic(prog(t, m0 + lag, m0 + .56 + lag));
        const [hx, hy, hw] = hero[i], [fx, fy, fw] = fin[i];
        const sz = lerp(HS, FS, mk), cx = lerp(hx + hw / 2, fx + fw / 2, mk), by = lerp(hy, fy, mk);
        const sc = lerp(1 + Math.min(.35, 110 / hw), 1, e);
        const isC = key === 'colis', hc = isC ? Math.exp(-(t - ts) * 2.2) : 0;
        ctx.save(); ctx.translate(cx, by - sz * .36 + (1 - e) * 20); ctx.scale(sc, sc);
        txt(w, 0, sz * .36, { font: `800 ${sz}px ${FONT.body}`, color: isC ? AMBER : ICE, align: 'center', alpha: a,
          glow: isC ? `rgba(243,167,69,${.4 + .5 * hc})` : null, glowBlur: 22, shadowBlur: 16 });
        ctx.restore();
      });
      ctx.restore();
    }

    // ---- 6-step teaser row: chip "6 ÉTAPES" + 6 numbered dots lighting up in sequence
    const r0 = tLock + .45, rowIn = eOutExpo(prog(t, r0, r0 + .55));
    if (rowIn > 0) {
      const chipF = `700 44px ${FONT.ui}`, chipTxt = '6 ÉTAPES', chipW = measure(chipTxt, chipF, 4) + 44, chipH = 64;
      const rowW = ROW_SP * 5 + ROW_R * 2, gap = 34, tot = chipW + gap + rowW, xL = 540 - tot / 2;
      const dx0 = xL + chipW + gap + ROW_R;
      const lit0 = Math.max(tCa + .05, r0 + .45), litStep = .15;
      // handoff: dots rise to the stepper node positions
      const hk = eInOutCubic(prog(t, C.end - .58, C.end - .04));
      // chip
      const ca = rowIn * aSub;
      if (ca > 0) {
        ctx.save(); ctx.globalAlpha *= ca;
        plate(xL, Y_ROW - chipH / 2, chipW, chipH, { r: 16, fill: 'rgba(12,7,28,.9)', border: 'rgba(243,167,69,.85)', lw: 2.5 });
        txt(chipTxt, xL + chipW / 2 + 2, Y_ROW + 16, { font: chipF, ls: 4, color: AMBER, align: 'center', glow: 'rgba(243,167,69,.35)', glowBlur: 12 });
        ctx.restore();
      }
      // connecting line
      const litN = clamp((t - lit0) / (litStep * 5)), la = rowIn * (1 - hk);
      const pos = i => [lerp(dx0 + i * ROW_SP, stX(i), hk), lerp(Y_ROW, ST_Y, hk)];
      if (la > 0) {
        const [ax, ay] = pos(0), [bx] = pos(5);
        line(ax, ay, lerp(ax, bx, rowIn), ay, 'rgba(234,246,255,.22)', 3, la);
        if (litN > 0) { ctx.save(); ctx.globalAlpha *= la; ctx.fillStyle = BZF.brandGrad(ax, bx); ctx.shadowColor = AMBER; ctx.shadowBlur = 12; ctx.fillRect(ax, ay - 2.5, (bx - ax) * eInOutCubic(litN), 5); ctx.restore(); }
      }
      for (let i = 0; i < 6; i++) {
        const di = eOutBack(prog(t, r0 + .08 + i * .06, r0 + .5 + i * .06)); if (di <= 0) continue;
        const [x, y] = pos(i);
        const lt = prog(t, lit0 + i * litStep, lit0 + i * litStep + .25), lk = eOutCubic(lt);
        const r = lerp(ROW_R, 14, hk) * di * (1 + .18 * Math.sin(Math.PI * lt));
        ctx.save();
        ctx.globalAlpha *= lerp(1, .8, hk) * (1 - prog(t, C.end - .02, C.end + .3));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = lk > 0 ? `rgba(243,167,69,${lerp(.0, 1, lk) * (1 - hk * .7)})` : 'rgba(12,7,28,.9)';
        ctx.fill();
        if (lk < 1) { ctx.fillStyle = `rgba(12,7,28,${.9 * (1 - lk)})`; ctx.fill(); }
        ctx.lineWidth = 3; ctx.strokeStyle = lk > 0 ? AMBER : 'rgba(234,246,255,.45)'; ctx.shadowColor = lk > 0 ? AMBER : 'transparent'; ctx.shadowBlur = 16 * lk; ctx.stroke();
        ctx.restore();
        const na = di * (1 - hk);
        if (na > 0) txt(String(i + 1), x, y + 12, { font: `700 34px ${FONT.display}`, color: lk > .5 ? '#170B02' : ICE, align: 'center', alpha: na * (lk > .5 ? 1 : .8), shadow: false });
        if (lt > 0 && lt < 1) ring(x, y, r + 10 + 26 * eOutCubic(lt), AMBER, 3, 1 - lt);
      }
    }
  }

  registerScene({ id: 'brand', z: 8, when: t => TL.in(t, 'brand', .02, .4), draw: (t, n) => drawBrand(t, n) });
})();
