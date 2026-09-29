'use strict';
// S10 « répit » + S11 « twist » — Junior breathes, the lot's carton opens (4 flap poses on twos), a flat paper hand
// pulls out 5 pairs… each pair is the SAME left sneaker twice. Circle « deux pieds gauches », stamp INVENDABLES,
// Seyès strip « 5 × 9 500 = 47 500 F » / « 47 500 ÷ 95 = 500 F / paire ».
// Vignette band y 880–1240 only (the note spine owns y < 870 until S12; captions live at y 1250–1430).
// Everything is gone by S12 start (the spine then slams its red plate at y≈1000).
(() => {
  const Y0 = 878, Y1 = 1246;
  const BOX = { x: 600, y: 1068, w: 330, h: 160 }, BOX2 = { x: 172, y: 1092, s: .7 };
  const JX = 150, JY = 1150, JS = .46;
  const PX = [375, 510, 645, 780, 912], PY = 1012, CIRC = 2;
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
  function times() {
    const ch = TL.ch('repit'), s10 = TL.seg('S10'), s11 = TL.seg('S11'), s12 = TL.seg('S12');
    const o = { ch, s10, s11, s12,
      reste: w('S10', 'reste'), c500: w('S10', '500'), junior: w('S10', 'junior'), respire: w('S10', 'respire'), ouvre: w('S10', 'ouvre'), cartons: w('S10', 'cartons'),
      cinq: w('S11', '5'), paires: w('S11', 'paires'), deux: w('S11', 'deux'), gauches: w('S11', 'gauches'), gauchesE: TL.we('S11', 'gauches'),
      payees: w('S11', 'payees'), transp: w('S11', 'transportees'), dedou: w('S11', 'dedouanees'), invend: w('S11', 'invendables'),
      cout: w('S11', 'cout'), n95: w('S11', '95'), p500: w('S11', '500'), paire: w('S11', 'paire', 1), tchac: w('S11', 'tchac') };
    o.duck = o.cartons + .1;                       // Junior ducks out, the carton slides left for the twist
    o.move = o.cartons + .25;
    o.pull = [0, 1, 2, 3, 4].map(i => o.cinq - .22 + i * .24);
    o.boxOut = o.pull[4] + .3;
    o.exit = o.tchac + .12;                        // everything drops out of the band after the last cut
    return o;
  }
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);
  const SHIFT = -95;                                                          // S11 row recentres once the carton has left
  const shiftX = t => SHIFT * eInOutCubic(prog(t, T.pull[4] + .28, T.pull[4] + .7));

  // ------------------------------------------------------------------ props
  function card(cw, ch, fill = C.cream, seed = 1) {
    withShadow(8, () => { ctx.fillStyle = fill; ctx.beginPath(); const tp = tornLine(-cw / 2, -ch / 2, cw / 2, -ch / 2, seed, 2, 12), bt = tornLine(cw / 2, ch / 2, -cw / 2, ch / 2, seed + 5, 2, 12);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function tape(x, y, r = 0, len = 80) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -14, len, 28); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -10, len, 4); }); }
  function pen(x, y, col = C.ink, rot = -.45) { at(x, y, 0, .5, .5, () => marker(0, 0, rot, col)); }

  // flap angles in degrees per pose [long flaps, short flaps]: 0 = closed flat, 90 = upright, 180 = flat outside
  const FLAP = [[0, 0], [48, 0], [104, 44], [140, 112], [150, 150]];
  /** kraft carton seen from above with its four flaps at a given stop-motion pose (0 closed … 4 open) */
  function boxTop(bw, bh, pose, contents) {
    if (pose <= 0) { carton(bw, bh, { seed: 71 }); return; }
    const [aL, aS] = FLAP[Math.min(pose, 4)], LL = bh / 2, LS = 62;
    const proj = (a, L) => Math.cos(a * Math.PI / 180) * L;   // + inward over the opening, − outward
    const flaps = [   // hinge A, hinge B, inward unit vector, length, angle
      [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [0, 1], LL, aL], [[bw / 2, bh / 2], [-bw / 2, bh / 2], [0, -1], LL, aL],
      [[-bw / 2, bh / 2], [-bw / 2, -bh / 2], [1, 0], LS, aS], [[bw / 2, -bh / 2], [bw / 2, bh / 2], [-1, 0], LS, aS]];
    const drawFlap = ([A, B, d, L, a], i) => {
      const p = proj(a, L), out = p < 0, tp = Math.abs(p) / L * (out ? 10 : 4);
      const ex = [B[0] - A[0], B[1] - A[1]], el = Math.hypot(...ex), u = [ex[0] / el, ex[1] / el];
      const A2 = [A[0] + d[0] * p + u[0] * tp, A[1] + d[1] * p + u[1] * tp], B2 = [B[0] + d[0] * p - u[0] * tp, B[1] + d[1] * p - u[1] * tp];
      if (Math.abs(p) < 6) { ctx.strokeStyle = C.kraftL; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); return; }
      ctx.save();
      withShadow(out ? 2 : 6 + 10 * Math.sin(a * Math.PI / 180), () => { ctx.fillStyle = out ? C.kraftL : TEX.kraft; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...B2); ctx.lineTo(...A2); ctx.closePath(); ctx.fill(); });
      if (out) { ctx.fillStyle = 'rgba(156,116,71,.25)'; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...B2); ctx.lineTo(...A2); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = `rgba(255,240,210,${.25 * Math.sin(a * Math.PI / 180)})`; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...B2); ctx.lineTo(...A2); ctx.closePath(); ctx.fill();
        if (i < 2) { ctx.fillStyle = C.tape; ctx.beginPath(); const k = 26 / Math.abs(p); ctx.moveTo(...A2); ctx.lineTo(...B2); ctx.lineTo(lerp(B2[0], B[0], k), lerp(B2[1], B[1], k)); ctx.lineTo(lerp(A2[0], A[0], k), lerp(A2[1], A[1], k)); ctx.closePath(); ctx.fill(); } }
      ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
      ctx.restore();
    };
    flaps.forEach((f, i) => { if (proj(f[4], f[3]) < 0) drawFlap(f, i); });        // outward flaps lie on the table
    ctx.fillStyle = C.kraftD; rrect(-bw / 2 + 5, -bh / 2 + 8, bw, bh, 6); ctx.fill();   // bevel
    ctx.fillStyle = TEX.kraft; rrect(-bw / 2, -bh / 2, bw, bh, 5); ctx.fill();
    const iw = bw - 20, ih = bh - 20;
    ctx.fillStyle = '#5A3E24'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
    ctx.save(); ctx.beginPath(); ctx.rect(-iw / 2, -ih / 2, iw, ih); ctx.clip();
    if (contents) contents(iw, ih);
    const g = ctx.createLinearGradient(0, -ih / 2, 0, -ih / 2 + 40); g.addColorStop(0, 'rgba(40,24,10,.55)'); g.addColorStop(1, 'rgba(40,24,10,0)'); ctx.fillStyle = g; ctx.fillRect(-iw / 2, -ih / 2, iw, 40);
    ctx.restore();
    flaps.forEach((f, i) => { if (proj(f[4], f[3]) >= 0) drawFlap(f, i); });       // flaps still over the opening
  }
  function boxContents(iw, ih) {                    // packed stock: all the same way round (a quiet clue)
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) at(-iw / 2 + 58 + c * 100 + (r % 2) * 30, -ih / 2 + 44 + r * 70, (rnd(r * 3 + c) - .5) * .12, 1, 1, () => sneaker(100, { lift: 2 }));
  }
  /** flat paper hand (top view), wrist at (0,0), fingers toward +x, violet sleeve toward −x */
  function paperHand(grab = 0, lift = 12) {
    const sk = SKIN[0];
    withShadow(lift, () => {
      ctx.fillStyle = C.violet; rrect(-560, -44, 540, 88, 16); ctx.fill();
      ctx.fillStyle = sk; rrect(-30, -38, 96, 76, 28); ctx.fill();
      const fl = 62 * (1 - .55 * grab);
      [-26, -9, 9, 26].forEach((y, i) => { rrect(52, y - 8.5, fl * (i === 0 || i === 3 ? .8 : 1) + 8, 17, 8.5); ctx.fill(); });
      ctx.save(); ctx.translate(22, -30); ctx.rotate(-1.0 + .7 * grab); rrect(0, -9, 52, 18, 9); ctx.fill(); ctx.restore();
    });
    ctx.fillStyle = C.violetD; rrect(-64, -47, 40, 94, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; for (const y of [-9, 9]) { ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(62, y); ctx.stroke(); }
  }
  /** a « pair »: the SAME left sneaker drawn twice, same orientation */
  function pairLL(s = 1, grey = 0) {
    ctx.save(); if (grey > 0) ctx.filter = `grayscale(${grey.toFixed(2)}) brightness(${(1 + .08 * grey).toFixed(2)})`;
    at(-12, -22, 0, 1, 1, () => sneaker(112 * s, { lift: 3 }));
    at(10, 16, 0, 1, 1, () => sneaker(112 * s, { lift: 6 }));
    ctx.restore();
  }
  function gSticker(k) {
    if (k <= 0) return;
    at(0, 0, (1 - clamp(k)) * .6, k, k, () => {
      withShadow(4, () => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, 29, 0, 7); ctx.fill(); });
      ctx.strokeStyle = M.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke();
      text('G', 0, 16, { font: font(FF.hand, 46, 800), align: 'center', color: M.red });
    });
  }
  /** round cost sticker slapped on the useless pairs: 0 = paid (coin), 1 = shipped (boat), 2 = cleared (customs check) */
  function costSticker(kind, k) {
    if (k <= 0) return;
    at(0, 0, (kind - 1) * .12 + (1 - clamp(k)) * .5, k, k, () => {
      withShadow(6, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); });
      ctx.strokeStyle = C.amber; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.stroke();
      if (kind === 0) coin(24, 'F', { tilt: 1 });
      else if (kind === 1) at(0, 2, 0, 1.05, 1.05, () => iconShip(C.sea));
      else { ctx.strokeStyle = C.violetD; ctx.lineWidth = 4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-13, 1); ctx.lineTo(-3, 11); ctx.lineTo(15, -11); ctx.stroke(); }
    });
  }
  function dust(x, y, s, seed, spread = 1) {
    if (s < 0 || s > .4) return;
    ctx.save(); for (let k = 0; k < 8; k++) { const a = Math.PI + (k / 7) * Math.PI, v = (50 + rnd(seed * 9 + k) * 60) * spread;
      ctx.globalAlpha = clamp(1 - s / .4) * .55; ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * s * 2.6, y + Math.sin(a) * 26 * s * 2 + 10, 4 + 4 * rnd(k + seed), 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ S10: Junior, « ouf ? », the carton
  function junior(t, n) {
    const up = pop(t, T.ch.start + .12, 11, .5), duck = eInCubic(prog(t, T.duck, T.duck + .38));
    if (up <= 0 || duck >= 1) return;
    let face = 'worry', arms = ['idle', 'idle'], look = .8, tilt = -.07, sweat = true, br = 0;
    if (t >= T.junior - .06 && t < T.respire) {                            // wipes his brow, on twos
      arms = ['idle', Math.floor(n / 4) % 2 ? [74, -190] : [-4, -200]]; look = -.2; tilt = .03;
    } else if (t >= T.respire && t < T.ouvre - .12) {                      // big breath, hands on hips
      face = 'smile'; sweat = false; look = 0; tilt = 0; arms = ['hip', 'hip']; br = Math.sin(prog(t, T.respire, T.respire + .75) * Math.PI);
    } else if (t >= T.ouvre - .12) { face = 'grin'; sweat = false; look = .9; tilt = .05; arms = ['idle', 'point']; }
    const blink = (n % 89) < 3 || (t > T.respire + .15 && t < T.respire + .5);
    const j = jit(601, n, .8);
    at(JX + j.x, JY + (1 - clamp(up, 0, 1.2)) * 250 + duck * 340 + j.y, j.r + tilt * .3, JS, JS * (1 + .06 * br), () =>
      person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber, face, arms, look, tilt, blink, sweat }));
    // breath puff
    if (br > .2) { ctx.save(); ctx.globalAlpha = br * .6; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const yy = JY - 60 + i * 14 + duck * 340, x0 = JX + 62 + br * 10; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo(x0 + 22, yy - 8, x0 + 40 + br * 16, yy); ctx.stroke(); }
      ctx.restore(); }
  }
  function oufSlip(t, n) {
    const k = pop(t, T.respire + .12, 13, .45), duck = eInCubic(prog(t, T.duck - .05, T.duck + .3));
    if (k <= 0 || duck >= 1) return;
    const j = jit(611, n, .6);
    at(322 + j.x, 962 + j.y + duck * 360, -.07 + j.r + (1 - clamp(k)) * .4, clamp(k, 0, 1.2), clamp(k, 0, 1.2), () => {
      card(196, 84, '#FFFFFF', 61); tape(0, -40, .08, 70);
      const wr = prog(t, T.respire + .2, T.respire + .6);
      handText('ouf ?', 0, 18, 50, { write: wr, color: C.violetD, pen: false });
      if (wr > 0 && wr < 1) pen(-60 + 120 * wr, 2, C.violetD);
    });
  }
  function boxPose(t, n) {
    const f0 = Math.round(T.ouvre * FPS);
    return n < f0 ? 0 : Math.min(4, 1 + Math.floor((n - f0) / 2));
  }
  function boxState(t) {
    const mv = eInOutCubic(prog(t, T.move, T.move + .5)), out = eInCubic(prog(t, T.boxOut, T.boxOut + .4));
    return { x: lerp(BOX.x, BOX2.x, mv) - out * 420, y: lerp(BOX.y, BOX2.y, mv), s: lerp(1, BOX2.s, mv), out };
  }
  function theBox(t, n) {
    const t0 = T.ch.start + .3, d = drop(t, t0, 300, .22); if (!d.a) return;
    const st = boxState(t); if (st.out >= 1) return;
    const pose = boxPose(t, n), f0 = Math.round(T.ouvre * FPS);
    const hop = n >= f0 && n < f0 + 10 ? 2.2 : 1, j = jit(620, n, .6 * hop);
    const wig = t > T.junior && t < T.ouvre ? Math.sin(stepT(n) * 9) * .012 : 0;       // the lot waits, a bit impatient
    at(st.x + j.x, st.y + d.y + j.y, j.r + wig, st.s * d.sx, st.s * d.sy, () => {
      boxTop(BOX.w, BOX.h, pose, boxContents);
      if (pose === 0 && n >= f0 - 4) { ctx.strokeStyle = '#3B2B22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-BOX.w / 2, 0); ctx.lineTo(lerp(-BOX.w / 2, BOX.w / 2, (n - f0 + 5) / 4), 0); ctx.stroke(); }
    });
    if (d.landed) dust(st.x, st.y + BOX.h / 2 - 20, t - t0 - .22, 3, 1.3);
    if (n >= f0 + 6) dust(st.x, st.y + BOX.h / 2 - 10, t - (f0 + 6) / FPS, 8, 1.6);
  }

  // ------------------------------------------------------------------ S11: the hand, the pairs, the verdict
  function hand(t, n) {
    const p0 = T.pull[0], p4 = T.pull[4];
    const hin = eOutCubic(prog(t, p0 - .5, p0 - .16)), hout = eInCubic(prog(t, p4 + .2, p4 + .5));
    if (hin <= 0 || hout >= 1) return;
    const st = boxState(t), ts = stepT(n);
    let dip = 0, grab = .2, sc = 1;
    for (const tp of T.pull) { const s = ts - (tp - .14); if (s < 0 || s >= .3) continue;
      if (s < .08) { dip = 8; grab = 0; sc = .95; } else if (s < .16) { dip = -16; grab = 1; sc = 1.1; } else { dip = -6; grab = .3; sc = 1.03; } }
    const j = jit(630, n, .8);
    at(lerp(-240, st.x - 70, hin) - hout * 380 + j.x, st.y + 4 + dip + j.y, -.05 + j.r, sc, sc, () => paperHand(grab, 12 + (sc - 1) * 120));
  }
  function pairPos(i, t) {
    const s = t - T.pull[i], st = boxState(T.pull[i]);
    const x0 = st.x + 20, y0 = st.y - 8, k = clamp(s / .32);
    return { x: lerp(x0, PX[i] + shiftX(t), eInOutCubic(k)), y: lerp(y0, PY, k) - Math.sin(k * Math.PI) * 105, r: lerp(-.9, 0, eOutCubic(k)), sc: lerp(.8, 1, k), landed: s >= .32, s };
  }
  const LIFT = 42, LIFTS = .86;                                               // row + stamp move up for the Seyès strip
  function liftK(t) { return eInOutCubic(prog(t, T.cout - .32, T.cout + .12)); }
  function pairs(t, n) {
    const dead = prog(t, T.invend - .02, T.invend + .3);
    const lk = liftK(t), sc0 = 1 - (1 - LIFTS) * lk, cx = 645 + shiftX(t);
    for (let i = 0; i < 5; i++) {
      if (t < T.pull[i]) continue;
      const p = pairPos(i, t), j = jit(640 + i, n, .5);
      const sq = p.landed ? Math.exp(-(p.s - .32) * 10) * Math.cos((p.s - .32) * 36) * .12 : 0;
      const hi = i === CIRC ? 16 * Math.sin(Math.PI * prog(t, T.deux - .05, T.gauchesE + .3)) : 0;   // the circled pair hops
      const ex = eInCubic(prog(t, T.exit + i * .04, T.exit + .45 + i * .04));
      const x = cx + (p.x - cx) * sc0, y = p.y - lk * LIFT - hi + ex * 360;
      ctx.save(); ctx.globalAlpha *= 1 - .6 * dead;
      at(x + j.x, y + j.y, p.r + j.r, p.sc * (1 + sq) * sc0, p.sc * (1 - sq) * sc0, () => pairLL(1, dead * .85));
      ctx.restore();
      if (p.landed) dust(PX[i] + shiftX(t), PY + 40, p.s - .32, 20 + i, .6);
      if (i === CIRC) {                                                            // « G » + « G » on the circled pair
        const gk = 1 - prog(t, T.invend - .3, T.invend - .05);
        at(x + j.x - 40, y + j.y - 30, 0, 1, 1, () => gSticker(pop(t, T.gauches, 16, .45) * gk));
        at(x + j.x + 44, y + j.y + 12, 0, 1, 1, () => gSticker(pop(t, T.gauches + .1, 16, .45) * gk));
      }
    }
  }
  function circle(t, n) {
    const k = prog(t, T.deux, T.gauches + .05), out = prog(t, T.invend - .25, T.invend); if (k <= 0 || out >= 1) return;
    const cx = PX[CIRC] + shiftX(t), cy = PY - 4, rx = 96, ry = 80;
    ctx.save(); ctx.globalAlpha *= 1 - out;
    at(cx, cy, -.08, 1, 1, () => handCircle(rx, ry, eOutCubic(k), M.red, 8, 17));
    if (k < 1) { const a = -2.2 + 1.12 * eOutCubic(k) * Math.PI * 2; pen(cx + Math.cos(a) * rx * Math.cos(-.08) - Math.sin(a) * ry * Math.sin(-.08), cy + Math.cos(a) * rx * Math.sin(-.08) + Math.sin(a) * ry * Math.cos(-.08), M.red); }
    ctx.restore();
  }
  function leftLabel(t, n) {
    const k = pop(t, T.deux - .08, 13, .45), out = eInCubic(prog(t, T.invend - .35, T.invend - .05));
    if (k <= 0 || out >= 1) return;
    const j = jit(650, n, .6), f = font(FF.hand, 52, 800), s1 = 'deux pieds ', s2 = 'gauches !';
    const w1 = measure(s1, f), w2 = measure(s2, f), x0 = -(w1 + w2) / 2;
    at(PX[CIRC] - 20 + shiftX(t) + j.x, 1160 + j.y + out * 160, -.03 + j.r, clamp(k, 0, 1.15), clamp(k, 0, 1.15), () => {
      card(w1 + w2 + 70, 88, '#FFFFFF', 81); tape(-(w1 + w2) / 2 - 10, -40, -.5, 64); tape((w1 + w2) / 2 + 10, -40, .5, 64);
      const a = prog(t, T.deux, T.gauches), b = prog(t, T.gauches, T.gauchesE + .15);
      handText(s1, x0, 18, 52, { align: 'left', write: a, color: C.ink, pen: false });
      if (b > 0) handText(s2, x0 + w1, 18, 52, { align: 'left', write: b, color: M.red, pen: false });
      if (a > 0 && b < 1) pen(x0 + (a < 1 ? w1 * a : w1 + w2 * b), 4, a < 1 ? C.ink : M.red);
    });
  }
  function costStickers(t, n) {
    const xs = [442, 712, 846], ts = [T.payees, T.transp, T.dedou];
    const fall = t - (T.invend - .1);
    xs.forEach((x, i) => {
      const k = pop(t, ts[i] - .04, 17, .42); if (k <= 0) return;
      const sc = t < ts[i] + .05 ? lerp(1.7, 1, prog(t, ts[i] - .04, ts[i] + .05)) : k;
      const fx = fall > 0 ? (i - 1) * 320 * fall : 0, fy = fall > 0 ? 1600 * fall * fall - 160 * fall : 0, fr = fall > 0 ? (i - 1 || 1) * 5 * fall : 0;
      if (fall > .35) return;
      const j = jit(660 + i, n, .5);
      at(x + shiftX(t) + j.x + fx, 924 + j.y + fy, fr, 1, 1, () => { ctx.globalAlpha *= 1 - clamp(fall / .35); costSticker(i, sc); });
    });
  }
  function stamp(t, n) {
    const t0 = T.invend; if (t < t0 - .14) return;
    const s = t - t0, k = eInCubic(prog(t, t0 - .14, t0)), lift = liftK(t);
    const ex = eInCubic(prog(t, T.exit + .1, T.exit + .55));
    const sc = s < 0 ? lerp(1.9, 1, k) : (1 + .05 * Math.exp(-s * 12) * Math.cos(s * 40)) * (1 - (1 - LIFTS) * lift);
    const x = 645 + shiftX(t), y = 1004 - lift * LIFT + ex * 380;
    if (s < 0) { ctx.save(); ctx.globalAlpha = .25 * k; ctx.fillStyle = C.shadow + '.6)'; ctx.beginPath(); ctx.ellipse(x + 30 * (1 - k), y + 40 * (1 - k), 310 * sc, 80 * sc, -.08, 0, 7); ctx.fill(); ctx.restore(); }
    at(x, y, -.07, sc, sc, () => stampText('INVENDABLES', 0, 0, font(FF.stencil, 100, 900), C.orange, { box: true, boxW: 11, h: 136, ls: 5, alpha: s < 0 ? .25 + .6 * k : 1, starve: .3 }));
    if (s >= 0 && s < 1.2) { ctx.save(); ctx.fillStyle = C.orange;                        // ink specks
      for (let i = 0; i < 16; i++) { const a = rnd(i * 4.1 + 17) * Math.PI * 2, d = 330 + rnd(i * 2.3) * 60, e = eOutExpo(clamp(s / .12));
        ctx.globalAlpha = .85 * (1 - ex); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d * .95 * e, y + Math.sin(a) * d * .26 * e + ex * 0, 3 + rnd(i) * 6, 0, 7); ctx.fill(); }
      ctx.restore(); }
  }
  function seyes(t, n) {
    const t0 = T.cout - .28, k = pop(t, t0, 11, .55); if (k <= 0) return;
    const ex = eInCubic(prog(t, T.exit, T.exit + .45)); if (ex >= 1) return;
    const j = jit(670, n, .5), sw = 880, sh = 170;
    at(522 + j.x, 1148 + (1 - clamp(k, 0, 1.1)) * 260 + ex * 380 + j.y, -.012 + j.r, 1, 1, () => {
      notebook(sw, sh, { grid: 22, lift: 10 });
      tape(-sw / 2 + 30, -sh / 2 + 4, -.6, 70); tape(sw / 2 - 30, -sh / 2 + 4, .6, 70);
      const fs = 50, f = font(FF.hand, fs, 800), x0 = -sw / 2 + 92;
      const L1 = '5 × 9 500 = 47 500 F', L2a = '47 500 ÷ 95 = ', L2b = '500 F / paire';
      const k1 = prog(t, T.cout - .05, T.n95 - .15), k2 = prog(t, T.n95, T.p500 - .1), k3 = prog(t, T.p500 - .02, T.paire - .05);
      if (k1 > 0) handText(L1, x0, -18, fs, { align: 'left', write: k1, color: C.ink, pen: false });
      if (k2 > 0) handText(L2a, x0, 60, fs, { align: 'left', write: k2, color: C.ink, pen: false });
      const w2a = measure(L2a, f);
      if (k3 > 0) handText(L2b, x0 + w2a, 60, fs, { align: 'left', write: k3, color: M.red, pen: false });
      const active = k1 > 0 && k1 < 1 ? [x0 + measure(L1, f) * k1, -32, C.ink] : k2 > 0 && k2 < 1 ? [x0 + w2a * k2, 46, C.ink] : k3 > 0 && k3 < 1 ? [x0 + w2a + measure(L2b, f) * k3, 46, M.red] : null;
      if (active) pen(active[0], active[1], active[2]);
      const u = prog(t, T.paire - .05, T.paire + .3);                                     // red double underline under « 500 F / paire »
      if (u > 0) { ctx.save(); ctx.strokeStyle = M.red; ctx.lineWidth = 5; ctx.lineCap = 'round'; const ww = measure(L2b, f);
        for (const dy of [72, 81]) { ctx.beginPath(); ctx.moveTo(x0 + w2a - 6, dy); ctx.lineTo(x0 + w2a - 6 + (ww + 12) * eOutCubic(u), dy - 3); ctx.stroke(); } ctx.restore(); }
    });
  }

  registerScene({
    id: 'twist', z: 34,
    when: t => t >= TL.ch('repit').start && t < TL.seg('S12').start,
    draw(t, n) {
      if (!T) T = times();
      if (t >= T.exit + 1.0) return;
      const sh = t >= T.invend && t < T.invend + .5 ? Math.exp(-(t - T.invend) * 9) : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(0, Y0, W, Y1 - Y0); ctx.clip();
      ctx.translate((rnd(n * 1.7) - .5) * 7 * sh, (rnd(n * 2.9) - .5) * 7 * sh);
      junior(t, n);
      oufSlip(t, n);
      theBox(t, n);
      pairs(t, n);
      hand(t, n);
      circle(t, n);
      costStickers(t, n);
      leftLabel(t, n);
      stamp(t, n);
      seyes(t, n);
      ctx.restore();
    },
  });
  // amber glow behind the spine's RESTE plate on « 500 » (drawn under the spine, z 29)
  registerScene({
    id: 'twist_glow', z: 29,
    when: t => TL.in(t, 'repit'),
    draw(t, n) {
      if (!T) T = times();
      const t0 = T.c500, a = env(t, t0 - .1, t0 + 1.5, .15, .5); if (a <= 0) return;
      const ts = stepT(n), pulse = 1 + .06 * Math.sin(ts * 9);
      ctx.save(); ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(830, 215, 40, 830, 215, 300 * pulse); g.addColorStop(0, 'rgba(243,167,69,.8)'); g.addColorStop(.6, 'rgba(243,167,69,.28)'); g.addColorStop(1, 'rgba(243,167,69,0)');
      ctx.fillStyle = g; ctx.fillRect(520, -100, 620, 640);
      ctx.translate(830, 215); ctx.scale(1.45, .82); ctx.rotate(ts * .5);
      ctx.fillStyle = 'rgba(243,167,69,.7)';
      for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI * 2 / 14); const L = 250 + 28 * Math.sin(ts * 7 + i * 1.9); ctx.beginPath(); ctx.moveTo(165, -9); ctx.lineTo(L, 0); ctx.lineTo(165, 9); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
  });
})();
