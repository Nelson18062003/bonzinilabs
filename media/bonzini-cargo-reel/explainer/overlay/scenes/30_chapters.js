// 30_chapters.js — chapter title cards (s1…s6), persistent 6-step stepper, chapter transition wipe.
(() => {
  'use strict';
  const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'];
  // stepper geometry
  const PX0 = 60, PX1 = 1020, PY0 = 170, PY1 = 290;
  const NODE_Y = 206, LABEL_Y = 275, nodeX = i => 130 + i * 164;
  // card geometry
  const CY = 715;
  const Y_KICK = CY - 205, Y_NUM = CY + 62, Y_TIT = CY + 212, Y_DIV = CY + 252;
  const FLY = .58;

  const shortTitle = s => s.replace(/^(L['’]|LE\s+|LA\s+|LES\s+)/i, '');

  /** per-chapter timing */
  function timing(i) {
    const c = TL.ch(STEPS[i]), seg = window.BZF.firstSeg(STEPS[i]);
    const tS = c.start + .15;
    const tN = seg ? seg.start : c.start + 1.4;
    const tF = Math.max(tN + .22, tS + 1.25);
    return { c, tS, tN, tF, tL: tF + FLY, mg: c.kind === 'mg' };
  }
  function stepIndexAt(t) {
    for (let i = 0; i < STEPS.length; i++) { const c = TL.ch(STEPS[i]); if (t >= c.start && t < c.end) return i; }
    return -1;
  }

  // ================================================================== title card
  function drawCard(t, n, i) {
    const BZF = window.BZF;
    const T = timing(i), { c, tS, tF, tL, mg } = T;
    if (t < c.start || t > tL + .05) return;
    const num = c.num || String(i + 1).padStart(2, '0'), title = c.title || '';
    const fp = prog(t, tF, tL), fe = eInOutCubic(fp);               // fly progress
    const inK = prog(t, tS - .08, tS + .3);

    // ---- backdrop
    const bdA = eOutCubic(inK) * (1 - eOutCubic(prog(t, tF, tF + FLY * .55)));
    if (bdA > 0) {
      ctx.save(); ctx.globalAlpha *= bdA;
      if (mg) {
        const rg = ctx.createRadialGradient(540, CY, 60, 540, CY, 620);
        rg.addColorStop(0, 'rgba(6,3,16,.62)'); rg.addColorStop(1, 'rgba(6,3,16,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, CY - 640, W, 1280);
      } else {
        const s = lerp(.92, 1, eOutExpo(inK)), pw = 990 * s, ph = 640 * s;
        plate(540 - pw / 2, CY - 300 * s - 40, pw, ph, { r: 30, fill: 'rgba(10,6,24,.9)', border: 'rgba(169,71,254,.8)', lw: 3 });
        brackets(540 - pw / 2 + 18, CY - 300 * s - 22, 540 + pw / 2 - 18, CY - 300 * s - 40 + ph - 18, 42, ICE, 4, .8);
      }
      ctx.restore();
    }

    // ---- shock ring on the slam
    const sr = prog(t, tS, tS + .75);
    if (sr > 0 && sr < 1 && fp <= 0) {
      ring(540, Y_NUM - 95, 90 + 560 * eOutExpo(sr), VIOLET, 7 * (1 - sr) + 1, .9 * (1 - sr));
      ring(540, Y_NUM - 95, 70 + 380 * eOutExpo(prog(t, tS + .06, tS + .8)), AMBER, 4 * (1 - sr) + 1, .8 * (1 - sr));
    }

    // ---- kicker "ÉTAPE"
    const kk = prog(t, tS + .1, tS + .45), ka = eOutCubic(kk) * (1 - eOutCubic(clamp(fp * 2.5)));
    if (ka > 0) {
      const f = `700 50px ${FONT.ui}`;
      wipeText('ÉTAPE', 540, Y_KICK, kk, { font: f, size: 50, ls: 18, color: AMBER, align: 'center', glow: 'rgba(243,167,69,.45)', glowBlur: 14, alpha: ka });
      const lw = 120 * eOutExpo(kk) * (1 - fp);
      line(540 - 150 - lw, Y_KICK - 17, 540 - 150, Y_KICK - 17, 'rgba(243,167,69,.8)', 3, ka);
      line(540 + 160, Y_KICK - 17, 540 + 160 + lw, Y_KICK - 17, 'rgba(243,167,69,.8)', 3, ka);
    }

    // ---- number: outline slams, fill rises
    const numF = `900 290px ${FONT.display}`;
    const numAt = (fpp, gAlpha) => {
      const fee = eInOutCubic(fpp);
      const k = prog(t, tS, tS + .42), sc0 = lerp(1.75, 1, eOutExpo(k)), a0 = eOutCubic(clamp(k * 5));
      const tx = lerp(540, nodeX(i), fee), ty = lerp(Y_NUM - 104, NODE_Y, fee), sc = sc0 * lerp(1, .12, fee);
      const a = a0 * (1 - eInCubic(clamp((fpp - .5) / .5))) * gAlpha;
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(tx, ty + Math.sin(t * 1.6) * 3 * (1 - fee)); ctx.scale(sc, sc);
      ctx.font = numF; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '6px';
      ctx.lineJoin = 'round';
      // offset hollow outline copy (depth) — slides out from behind once the slam settles
      const ok = eOutExpo(prog(t, tS + .3, tS + .8)) * (1 - fee);
      if (ok > 0) {
        ctx.save(); ctx.globalAlpha *= .85 * ok; ctx.lineWidth = 4; ctx.strokeStyle = VIOLET; ctx.shadowColor = VIOLET; ctx.shadowBlur = 18;
        ctx.strokeText(num, -16 * ok, 104 - 16 * ok); ctx.restore();
      }
      // outline
      ctx.lineWidth = 6; ctx.strokeStyle = ICE; ctx.shadowColor = VIOLET; ctx.shadowBlur = 28;
      ctx.strokeText(num, 0, 104); ctx.shadowBlur = 0;
      // fill rising from the bottom (glyph-clipped via gradient stops, with a bright liquid edge)
      const fk = eInOutCubic(prog(t, tS + .2, tS + .62));
      if (fk > 0) {
        const top = -112, bot = 104, lvl = lerp(bot, top, fk);          // fill level (y)
        const rel = clamp((lvl - top) / (bot - top));
        const g = ctx.createLinearGradient(0, top, 0, bot);
        if (fk < 1) {
          g.addColorStop(0, 'rgba(243,167,69,0)'); g.addColorStop(Math.max(0, rel - .002), 'rgba(243,167,69,0)');
          g.addColorStop(rel, '#FFFFFF'); g.addColorStop(Math.min(1, rel + .03), AMBER); g.addColorStop(1, ORANGE);
        } else { g.addColorStop(0, AMBER); g.addColorStop(1, ORANGE); }
        ctx.fillStyle = g; ctx.shadowColor = 'rgba(254,86,13,.55)'; ctx.shadowBlur = 30 * fk; ctx.fillText(num, 0, 104); ctx.shadowBlur = 0;
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${.85 * fk})`; ctx.strokeText(num, 0, 104);
      }
      // shimmer across the filled number (text filled with a moving highlight band)
      const sh = prog(t, tS + .9, tS + 1.5);
      if (sh > 0 && sh < 1) {
        const sx = lerp(-340, 340, eInOutCubic(sh)), sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.6)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillText(num, 0, 104);
      }
      ctx.restore();
    };
    const drawNumber = () => {
      if (fp > 0 && fp < 1) { numAt(clamp(fp - .16), .18); numAt(clamp(fp - .08), .3); }
      numAt(fp, 1);
    };
    const gl = Math.max(0, 1 - prog(t, tS, tS + .2)) * .9;
    glitched(drawNumber, fp > 0 ? 0 : gl, n, 380, 860);

    // ---- title (auto-fit ≥ 96 px)
    const tk = prog(t, tS + .1, tS + .5);
    if (tk > 0) {
      const tls = measure(title, `700 100px ${FONT.ui}`, 4) <= 900 ? 4 : 0;          // tighter tracking for long titles
      const sz = BZF.fit(title, 700, FONT.ui, 900, 120, 96, tls), f = `700 ${sz}px ${FONT.ui}`;
      const drawTitle = () => {
        const sc0 = lerp(1.3, 1, eOutExpo(tk));
        const tx = 540, ty = lerp(Y_TIT - 36, LABEL_Y - 16, fe), sc = sc0 * lerp(1, 44 / sz * .9, fe);
        const a = eOutCubic(clamp(tk * 4)) * (1 - eInCubic(clamp((fp - .45) / .55)));
        if (a <= 0) return;
        ctx.save(); ctx.translate(tx, ty); ctx.scale(sc, sc);
        txt(title, 0, 36, { font: f, ls: tls, color: '#FFFFFF', align: 'center', alpha: a, glow: 'rgba(169,71,254,.85)', glowBlur: 26, shadowBlur: 18 });
        ctx.restore();
      };
      glitched(drawTitle, fp > 0 ? 0 : Math.max(0, 1 - prog(t, tS + .1, tS + .28)) * .7, n + 7, Y_TIT - 130, Y_TIT + 40);
      // divider
      const dk = eOutExpo(prog(t, tS + .3, tS + .85)) * (1 - eOutCubic(clamp(fp * 2)));
      if (dk > 0) {
        const tw = Math.min(900, measure(title, f, tls)) / 2 * dk;
        ctx.save(); ctx.fillStyle = BZF.brandGrad(540 - tw, 540 + tw); ctx.shadowColor = VIOLET; ctx.shadowBlur = 14;
        ctx.fillRect(540 - tw, Y_DIV, tw * 2, 6); ctx.restore();
      }
    }
  }

  // ================================================================== stepper
  function drawStepper(t, n) {
    const BZF = window.BZF;
    const s1 = TL.ch('s1'), s6 = TL.ch('s6');
    const inK = eOutExpo(prog(t, s1.start + .05, s1.start + .6));
    const outK = eInCubic(prog(t, s6.end - .12, s6.end + .22));
    const A = inK * (1 - outK);
    if (A <= 0) return;
    const i = Math.max(0, stepIndexAt(t) < 0 ? (t >= s6.end ? 5 : 0) : stepIndexAt(t));
    const T = timing(i), c = T.c;
    ctx.save(); ctx.globalAlpha *= A; ctx.translate(0, (1 - inK) * -40 - outK * 40);

    // plate
    plate(PX0, PY0, PX1 - PX0, PY1 - PY0, { r: 28, fill: 'rgba(10,6,24,.88)', border: 'rgba(169,71,254,.6)', lw: 2 });
    // top hairline gradient
    ctx.save(); ctx.globalAlpha *= .9; ctx.fillStyle = BZF.brandGrad(PX0 + 30, PX1 - 30); ctx.fillRect(PX0 + 30, PY0, PX1 - PX0 - 60, 3); ctx.restore();

    // progress position (float node index)
    let P;
    if (t < T.tL) P = i === 0 ? 0 : lerp(i - 1, i, eInOutCubic(prog(t, c.start + .1, T.tL - .05)));
    else P = i;
    const lastDone = t >= s6.end - .7 ? eOutCubic(prog(t, s6.end - .7, s6.end - .3)) : 0;   // final node completes before recap

    // base line + progress
    line(nodeX(0), NODE_Y, nodeX(5), NODE_Y, 'rgba(234,246,255,.2)', 4, 1);
    const px = lerp(nodeX(0), nodeX(5), P / 5);
    if (px > nodeX(0) + 1) {
      ctx.save(); ctx.fillStyle = BZF.brandGrad(nodeX(0), nodeX(5)); ctx.shadowColor = VIOLET; ctx.shadowBlur = 12;
      ctx.fillRect(nodeX(0), NODE_Y - 3, px - nodeX(0), 6); ctx.restore();
      // travelling spark at the head while moving
      if (t < T.tL && i > 0) BZF.sparkle(px, NODE_Y, 10, '#FFFFFF', Math.sin(Math.PI * prog(t, c.start + .1, T.tL - .05)));
    }

    // nodes
    for (let j = 0; j < 6; j++) {
      const x = nodeX(j);
      const appear = eOutBack(prog(t, s1.start + .15 + j * .05, s1.start + .5 + j * .05));
      if (appear <= 0) continue;
      let state, k = 1;
      if (j < i - 1) state = 'done';
      else if (j === i - 1) { state = 'done'; k = prog(t, c.start, c.start + .45); }
      else if (j === i) state = t >= T.tL ? 'cur' : 'next';
      else state = 'future';
      if (j === 5 && lastDone > 0 && state === 'cur') { state = 'curDone'; k = lastDone; }
      ctx.save(); ctx.translate(x, NODE_Y); ctx.scale(appear, appear);
      if (state === 'done' || state === 'curDone') {
        // transition from amber current → violet ✓
        const r = lerp(25, 18, eOutCubic(k));
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = k < 1 ? `rgba(${Math.round(lerp(243, 169, k))},${Math.round(lerp(167, 71, k))},${Math.round(lerp(69, 254, k))},1)` : VIOLET;
        ctx.shadowColor = VIOLET; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
        checkMark(0, 1, 22, eOutCubic(prog(k, .25, 1)), '#FFFFFF', 4.5);
        if (k > 0 && k < 1) ring(0, 0, r + 6 + 26 * eOutCubic(k), VIOLET, 3, 1 - k);
      } else if (state === 'cur') {
        const pk = prog(t, T.tL, T.tL + .45), r = lerp(15, 25, eOutBack(pk));
        const pulse = (t - T.tL) % 1.4 / 1.4;
        ring(0, 0, r + 6 + 22 * eOutCubic(pulse), AMBER, 3, (1 - pulse) * .8);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 22; ctx.fill(); ctx.shadowBlur = 0;
        txt(String(j + 1), 0, 10, { font: `700 28px ${FONT.display}`, color: '#170B02', align: 'center', shadow: false, alpha: eOutCubic(pk) });
        if (pk < 1) { ring(0, 0, r + 8 + 60 * eOutExpo(pk), '#FFFFFF', 4, 1 - pk); }
      } else if (state === 'next') {
        const bl = .5 + .5 * Math.sin(t * 7);
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(12,7,28,.95)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(243,167,69,${.45 + .5 * bl})`; ctx.shadowColor = AMBER; ctx.shadowBlur = 10 * bl; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(12,7,28,.95)'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(234,246,255,.32)'; ctx.stroke();
        txt(String(j + 1), 0, 7, { font: `700 20px ${FONT.display}`, color: 'rgba(234,246,255,.45)', align: 'center', shadow: false });
      }
      ctx.restore();
    }

    // label "ÉTAPE 3/6 · TRANSPORT"
    const drawLabel = (idx, a, pNum, pTitle) => {
      if (a <= 0) return;
      const cc = TL.ch(STEPS[idx]);
      const f = `700 44px ${FONT.ui}`, A1 = `ÉTAPE ${idx + 1}/6`, A2 = ` · ${shortTitle(cc.title || '')}`;
      const w1 = measure(A1, f, 3), w2full = measure(A2, f, 3);
      const w2 = w2full * eOutCubic(pTitle);
      const x0 = 540 - (w1 + w2) / 2;
      txt(decrypt(A1, pNum, 11 + idx), x0, LABEL_Y, { font: f, ls: 3, color: AMBER, alpha: a, glow: 'rgba(243,167,69,.35)', glowBlur: 10 });
      if (pTitle > 0) txt(decrypt(A2, pTitle, 21 + idx), x0 + w1, LABEL_Y, { font: f, ls: 3, color: ICE, alpha: a });
    };
    // previous label fades out on the cut
    if (i > 0 && t < c.start + .3) drawLabel(i - 1, 1 - eOutCubic(prog(t, c.start - .05, c.start + .25)), 1, 1);
    const lp = prog(t, c.start + .25, c.start + .6);
    drawLabel(i, eOutCubic(lp), lp, prog(t, T.tL - .12, T.tL + .4));
    ctx.restore();
  }

  // ================================================================== transition wipe
  const ANG = .42;                                   // band tilt (rad)
  const WIPE_A = .22, WIPE_B = .23;                  // before / after the cut (0.45 s total)
  function drawWipe(t, n) {
    const BZF = window.BZF;
    for (const c of TL.data.chapters) {
      if (c.start <= .01) continue;
      const p = prog(t, c.start - WIPE_A, c.start + WIPE_B);
      if (p <= 0 || p >= 1) continue;
      const ext = (W / 2) * Math.cos(ANG) + (H / 2) * Math.sin(ANG);   // half projection of screen on travel axis
      const B = 980, TAIL = 260;
      const e = .55 * p + .45 * eInOutCubic(p);
      const u = lerp(-ext - B / 2 - 40, ext + B / 2 + TAIL + 40, e) - (TAIL / 2) * 0; // band centre on travel axis
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(-ANG);
      const L = 2600;
      // trailing speed stripes
      ctx.fillStyle = 'rgba(254,86,13,.85)'; ctx.fillRect(u - B / 2 - 70, -L, 34, 2 * L);
      ctx.fillStyle = 'rgba(243,167,69,.7)'; ctx.fillRect(u - B / 2 - 150, -L, 16, 2 * L);
      ctx.fillStyle = 'rgba(169,71,254,.6)'; ctx.fillRect(u - B / 2 - TAIL, -L, 8, 2 * L);
      // main band violet (leading) → amber → orange (trailing)
      const g = ctx.createLinearGradient(u + B / 2, 0, u - B / 2, 0);
      g.addColorStop(0, '#B35CFF'); g.addColorStop(.12, VIOLET); g.addColorStop(.45, AMBER); g.addColorStop(.8, ORANGE); g.addColorStop(1, '#E84A08');
      ctx.fillStyle = g; ctx.fillRect(u - B / 2, -L, B, 2 * L);
      // texture: fine diagonal hatch inside the band
      ctx.save(); ctx.beginPath(); ctx.rect(u - B / 2, -L, B, 2 * L); ctx.clip();
      ctx.globalAlpha = .12; ctx.fillStyle = '#FFFFFF';
      for (let k = -L; k < L; k += 22) ctx.fillRect(u - B / 2, k, B, 3);
      ctx.restore();
      // leading bright edge
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 36; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(u + B / 2 - 5, -L, 10, 2 * L);
      ctx.shadowBlur = 0;
      // logo stamp riding in the band (upright)
      ctx.save(); ctx.translate(u, 0); ctx.rotate(ANG);
      drawLogo(0, 0, 360, { mono: '#FFFFFF', alpha: .9, glowBlur: 0, glow: false });
      ctx.restore();
      ctx.restore();
    }
  }

  registerScene({ id: 'stepper', z: 33, when: t => t >= TL.ch('s1').start && t < TL.ch('s6').end + .3, draw: (t, n) => drawStepper(t, n) });
  registerScene({
    id: 'chapter_cards', z: 35,
    when: t => { const i = stepIndexAt(t); return i >= 0 && t <= timing(i).tL + .05; },
    draw: (t, n) => { const i = stepIndexAt(t); if (i >= 0) drawCard(t, n, i); },
  });
  registerScene({
    id: 'chapter_wipe', z: 40,
    when: t => TL.data.chapters.some(c => c.start > .01 && t >= c.start - WIPE_A && t <= c.start + WIPE_B),
    draw: (t, n) => drawWipe(t, n),
  });
})();
