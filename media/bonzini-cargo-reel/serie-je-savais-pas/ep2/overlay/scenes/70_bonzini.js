'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) — M2 « Bonzini & end », part 1: the brand sequence (prefix BZ_).
// Functions only: 50_compose.js calls them with the states SCORE computed. VIOLET APPEARS ONLY HERE (from A.violet).
// No figure anywhere: the tape carries ticks only, the volume is masked (« VOLUME : • m³ »), the only code is the
// fictional « BZ-482913 » with « exemple » on the label, the label's address and phones are blurred.
// Bonzini = cargo, the parcel is MEASURED at reception in China; Bonzini never repacks (nothing here touches the goods).
//
//   BZ_band(st, t)            screen  « ENSUITE : » — a strip of gummed kraft tape (serrated ends, printed ink) pulled
//                                     across the frame (st = SCORE.band(t) = {in, out}). Takes over the text 'ensuite'.
//   BZ_atmos(t, L)            screen  the violet brand light: a pool from above on the action, edges sinking into violet
//                                     (one full-res multiply layer, baked once) + a soft bloom when it switches on.
//   BZ_onCarton(st, t, L)     world   the real sea label (src/lib/shippingLabelCanvas.ts, landscape cut): blue band, ship,
//                                     海运 SEA CARGO, QR, « BZ-482913 », « exemple », address + phones blurred. Slaps on
//                                     at A.label, glued to the carton (SCORE.cartonJit + st.rot).
//   BZ_scene(b, t, L)         world   the reception (b = SCORE.bz(t)): hand-held scanner (on twos) + violet laser sweep on
//                                     the label (registered: rim + ✓ badge), tape measure along LONGUEUR, violet dimension
//                                     marks L · l · H (no figure), the readout slip « VOLUME : • m³ » stamped « MESURÉ ✓ »,
//                                     the mini « AIR » cloud struck through. Takes over 'volume' and 'measured'.
//   BZ_plate(st, t, L)        world   the series' glossy violet enamel plate « BONZINI TRADING CARGO » (ep. 1 design,
//                                     sized ≤ 880×210 for G.bz.plateY), falls before « Chez » (A.plateBZ), reflection sweep, dust.
//   window.BZ_lib                     shared helpers for 76_end.js (sprite cache, palette).
// Every time is read from SCORE.A / SCORE.T or from the state; every static look is cached in an offscreen sprite;
// no ctx.filter. Stop-motion objects (scanner, slip) are sampled on twos at the frame centre (no ghosting under MB).
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T;
  const kk = S.kk, ease = S.ease, eOut = S.easeOut, eIn = S.easeIn, spr = S.spr, cl = S.cl, lerpv = S.lerpv;
  const FPS = S.FPS;
  const P = {
    vio: '#7033FF', vioL: '#A947FE', vioD: '#5B2BDF', vioDD: '#3B17A8', vioEdge: '#22105A', vioInk: '#4A1FC2',
    orange: '#FE560D', amber: '#F3A745', ink: '#231629', inkS: '#4A3A52', cream: '#FBF6EC', creamW: '#FFF8EC',
    sea: '#0B5FA5', seaD: '#083F70', seaT: '#E6F0FA', muted: '#5A5560', hair: '#D8D6DA',
  };
  const nOf = t => Math.round(t * FPS);                                   // the frame (MB sub-frames stay on it)
  const twos = t => Math.floor(nOf(t) / 2) * 2 / FPS;                     // stop-motion time, on twos

  // ------------------------------------------------------------------ sprite cache (ep. 1 pattern)
  // draw(w, h) runs with the global ctx swapped to an offscreen canvas (every kit helper works), origin at (ox, oy).
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  /** a pre-blurred soft shadow of a rounded rect (shadowBlur once, at build time) */
  function shadowSprite(key, w, h, r, blur, col) {
    return sprite(key, w + blur * 5, h + blur * 5, () => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000; ctx.fillStyle = '#000';
      rrect(-w / 2 - 20000, -h / 2, w, h, r); ctx.fill(); ctx.restore();
    });
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
  /** a glowing stroke without shadowBlur: stroked wide and faint, then narrow and bright */
  function glowStroke(path, rgb, a, w) {
    for (const [m, q] of [[5, .10], [3, .18], [1.8, .35], [1, 1]]) { ctx.strokeStyle = `rgba(${rgb},${(a * q).toFixed(3)})`; ctx.lineWidth = w * m; path(); ctx.stroke(); }
  }
  /** blurred « text » (address, phones): drawn at 1/6 scale, then upscaled = a real blur, for free, at build time */
  function blurredText(lines, w, h, fnt, col, lh, x0 = 0) {
    const q = 11, c = makeCanvas(Math.ceil(w / q), Math.ceil(h / q)), g = c.getContext('2d');
    g.scale(1 / q, 1 / q); g.font = fnt; g.fillStyle = col; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x0, lh * (i + .5)));
    const m = makeCanvas(Math.ceil(w / 3), Math.ceil(h / 3)), mg = m.getContext('2d');      // two-step upscale: soft, not blocky
    mg.imageSmoothingQuality = 'high'; mg.drawImage(c, 0, 0, m.width, m.height);
    return m;
  }

  // =========================================================================================== « ENSUITE : »
  const BW = 1520, BH = 228, BROT = -.034;                                // the tilt is baked in: an axis-aligned blit is ≈ 10× cheaper
  const bandSprite = () => sprite('band', BW + 120, BH + 180, () => {
    ctx.rotate(BROT);
    const teeth = (x, dir) => { const pts = []; for (let y = -BH / 2, i = 0; y <= BH / 2 + .1; y += 19, i++) pts.push([x + dir * (i % 2 ? 0 : 15), y]); return pts; };
    const top = tornLine(-BW / 2, -BH / 2, BW / 2, -BH / 2, 41, 1.6, 16), bot = tornLine(BW / 2, BH / 2, -BW / 2, BH / 2, 53, 1.6, 16);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of teeth(BW / 2, 1)) ctx.lineTo(...p);
      for (const p of bot) ctx.lineTo(...p); for (const p of teeth(-BW / 2, -1).reverse()) ctx.lineTo(...p); ctx.closePath(); };
    // soft cast shadow on the table (baked)
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.42)'; ctx.shadowBlur = 26; ctx.shadowOffsetX = 20000 + 6; ctx.shadowOffsetY = 16;
    ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    // gummed kraft paper
    const kg = ctx.createLinearGradient(0, -BH / 2, 0, BH / 2); kg.addColorStop(0, '#D9B27C'); kg.addColorStop(.5, '#CDA36C'); kg.addColorStop(1, '#BF925B');
    path(); ctx.fillStyle = kg; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 2600; i++) {                                     // fibres
      const x = -BW / 2 + rnd(i * 1.37 + 5) * BW, y = -BH / 2 + rnd(i * 2.71 + 9) * BH, a = (rnd(i * 3.3) - .5) * .9, l = 4 + rnd(i * 4.9) * 13;
      ctx.strokeStyle = rnd(i * 6.1) > .55 ? 'rgba(128,88,46,.30)' : 'rgba(240,214,170,.40)'; ctx.lineWidth = rnd(i) > .85 ? 1.4 : .8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,240,210,${(.04 + .05 * rnd(i * 7.3)).toFixed(3)})`; ctx.fillRect(-BW / 2, -BH / 2 + rnd(i * 3.9) * BH, BW, 2 + rnd(i) * 5); }   // the paper's machine streaks
    const sh = ctx.createLinearGradient(0, -BH / 2, 0, -BH / 2 + 70); sh.addColorStop(0, 'rgba(255,246,226,.38)'); sh.addColorStop(1, 'rgba(255,246,226,0)');   // the gum's sheen
    ctx.fillStyle = sh; ctx.fillRect(-BW / 2, -BH / 2, BW, 70);
    const lo = ctx.createLinearGradient(0, BH / 2 - 40, 0, BH / 2); lo.addColorStop(0, 'rgba(90,55,20,0)'); lo.addColorStop(1, 'rgba(90,55,20,.22)');
    ctx.fillStyle = lo; ctx.fillRect(-BW / 2, BH / 2 - 40, BW, 40);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,244,222,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(p[0], p[1] + 2); ctx.stroke();
    // printed ink (multiply, starved): « ENSUITE : »
    const ic = makeCanvas(1100, 220), ig = ic.getContext('2d');
    ig.font = '900 150px Satoshi'; ig.letterSpacing = '4px'; ig.textAlign = 'center'; ig.textBaseline = 'alphabetic'; ig.fillStyle = P.ink; ig.fillText('ENSUITE :', 550, 162);
    ig.globalCompositeOperation = 'destination-out'; ig.globalAlpha = .22; ig.drawImage(TEX.starve, 0, 0, 1100, 220); ig.drawImage(TEX.starve, 200, 50, 400, 200, 0, 0, 1100, 220);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(ic, -550, -110 - 2); ctx.restore();
  });
  function band(st, t) {
    if (!st) return;
    const n = nOf(t), j = jit(907, n, .6), x = G.cx - (BW + 140) * (1 - st.in) + (BW + 140) * st.out;
    blit(bandSprite(), Math.round(x + j.x), Math.round(940 + j.y));
  }

  // =========================================================================================== THE VIOLET LIGHT
  // one full-resolution multiply layer (baked once): near-white lavender in the pool from above (plate → carton),
  // deeper violet towards the edges; a 1:1 blit costs ≈ 3.7 ms where an upscaled one costs ≈ 16 ms here.
  const tintLayer = () => sprite('lt_tint', W, H, (w, h) => {
    ctx.fillStyle = '#9A84E4'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.translate(0, 860 - h / 2); ctx.scale(1, 1.62);
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 700);
    g.addColorStop(0, '#FBF8FF'); g.addColorStop(.38, '#F1EAFF'); g.addColorStop(.7, '#D3C4FA'); g.addColorStop(1, '#9A84E4');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.restore();
    // the lamp's cone from above: a faint brighter column on the action
    const cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(.3, 'rgba(255,255,255,.10)'); cg.addColorStop(.5, 'rgba(255,255,255,.16)'); cg.addColorStop(.7, 'rgba(255,255,255,.10)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(-180, -h / 2); ctx.lineTo(180, -h / 2); ctx.lineTo(520, h / 2); ctx.lineTo(-520, h / 2); ctx.closePath(); ctx.fill();
  });
  // the switch-on bloom: a soft violet glow on the reception (screen), local sprite (cheap)
  const bloom = () => sprite('lt_bloom', 900, 1100, () => {
    ctx.save(); ctx.scale(1, 1.22); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 450);
    g.addColorStop(0, 'rgba(176,136,255,.55)'); g.addColorStop(.5, 'rgba(140,96,255,.20)'); g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g; circle(0, 0, 450); ctx.fill(); ctx.restore();
  });
  function atmos(t, L) {
    const v = cl(L ? L.violet : 0) * (1 - kk(t, A.out - .25, A.out)); if (v <= .002) return;   // exactly 0 in the loop's last frames
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = v * .92; ctx.drawImage(tintLayer().c, 0, 0); ctx.restore();
    const on = Math.exp(-Math.max(0, t - (A.violet + .3)) * 3.2) * kk(t, A.violet, A.violet + .3);   // one soft swell, never a flicker
    const a = v * (.32 + .55 * on);
    if (a > .01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; blit(bloom(), G.bz.foot.x + 40, 980); ctx.restore(); }
  }

  // =========================================================================================== THE SEA LABEL
  // landscape cut of the real label (shippingLabelCanvas.ts): 0 band (ship, 海运, SEA CARGO) · 1 收件地址 address (blurred)
  // · tel / wechat (blurred) · 2 the QR and the customer code, here « BZ-482913 » + « exemple ».
  const LW = 640, LH = 400, LR = 10;
  const SHIP = new Path2D('M8 138H248L222 196H34Z M26 90H74V138H26Z M38 66H62V90H38Z M84 108H130V138H84Z M136 108H182V138H136Z M188 108H234V138H188Z M100 78H146V108H100Z M152 78H198V108H152Z M4 212H72V222H4Z M88 212H156V222H88Z M172 212H252V222H172Z');
  const ship = (x, y, size, col) => { ctx.save(); ctx.translate(x, y); ctx.scale(size / 256, size / 256); ctx.fillStyle = col; ctx.fill(SHIP); ctx.restore(); };
  const ZH = '"WenQuanYi Zen Hei"';
  const labelSprite = () => sprite('label', LW + 24, LH + 24, () => {
    ctx.translate(-LW / 2, -LH / 2);
    ctx.fillStyle = '#FFFFFF'; rrect(0, 0, LW, LH, LR); ctx.fill();
    ctx.save(); rrect(0, 0, LW, LH, LR); ctx.clip();
    // 0 · the band: plain blue (sea), dark strip under it
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, LW, 86); ctx.fillStyle = P.seaD; ctx.fillRect(0, 78, LW, 8);
    ship(22, 8, 66, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle';
    ctx.font = `900 42px ${ZH}`; ctx.fillText('海运', 102, 40);
    ctx.font = '900 27px DMSans'; ctx.fillText('SEA CARGO', 196, 43);
    ctx.textAlign = 'right'; ctx.font = `900 15px ${ZH}`; ctx.fillText('发货标签 · 请贴在每一个纸箱上', LW - 18, 30);
    ctx.font = '700 12px DMSans'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('Shipping label · stick on every carton', LW - 18, 52); ctx.textAlign = 'left';
    // 1 · deliver to (tinted band + the mode pill) and the address, blurred
    ctx.fillStyle = P.seaT; ctx.fillRect(0, 86, LW, 26);
    ctx.fillStyle = P.muted; ctx.font = '900 13px DMSans'; ctx.fillText('1', 18, 100);
    ctx.fillStyle = P.ink; ctx.font = `900 16px ${ZH}`; ctx.fillText('收件地址', 36, 100);
    ctx.fillStyle = P.muted; ctx.font = '800 12px DMSans'; ctx.fillText('DELIVER TO', 108, 101);
    ctx.fillStyle = P.sea; rrect(LW - 150, 90, 134, 18, 4); ctx.fill(); ship(LW - 143, 91, 16, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF'; ctx.font = `900 11px ${ZH}`; ctx.fillText('海运 · SEA CARGO', LW - 122, 99.5);
    ctx.fillStyle = P.hair; ctx.fillRect(0, 112, LW, 1);
    ctx.fillStyle = P.sea; ctx.fillRect(0, 113, 7, 58);
    const addr = blurredText(['广州市白云区 · 仓库 3 号门 · 收货处 88', 'Warehouse gate 3, receiving bay, Baiyun district'], 600, 56, `900 22px ${ZH}`, '#333', 28);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(addr, 22, 115, 600, 56);
    ctx.fillStyle = P.hair; ctx.fillRect(0, 171, LW, 1);
    // tel / wechat, values blurred
    ctx.fillStyle = P.muted; ctx.font = `700 13px ${ZH}`; ctx.fillText('电话', 22, 186); ctx.font = '700 11px DMSans'; ctx.fillText('TEL', 54, 187);
    // QA (stage 3): the real label's second field is a messaging brand — no third-party name on screen (BRIEF): the
    // e-mail field (邮箱, also on the real label) takes its place
    ctx.font = `700 13px ${ZH}`; ctx.fillText('邮箱', 330, 186); ctx.font = '700 11px DMSans'; ctx.fillText('EMAIL', 362, 187);
    ctx.drawImage(blurredText(['+86 138 0000 0000'], 180, 24, '800 17px DMSans', '#333', 24), 124, 174, 180, 24);
    ctx.drawImage(blurredText(['bz_reception_88'], 180, 24, '800 17px DMSans', '#333', 24), 428, 174, 180, 24);
    // 2 · the customer code: QR + « BZ-482913 » + « exemple »
    ctx.fillStyle = P.ink; ctx.fillRect(0, 200, LW, 3);
    qr(24, 220, 162, 17, P.ink);
    ctx.fillStyle = P.hair; ctx.fillRect(208, 203, 1, LH - 203);
    ctx.fillStyle = P.muted; ctx.font = `900 16px ${ZH}`; ctx.fillText('客户编号', 228, 236); ctx.font = '800 13px DMSans'; ctx.fillText('· CUSTOMER ID', 296, 237);
    ctx.textBaseline = 'alphabetic';
    let cs = 80; while (cs > 40 && measure('BZ-482913', `900 ${cs}px DMSans`) > LW - 228 - 20) cs -= 2;
    text('BZ-482913', 226, 318, { font: `900 ${cs}px DMSans`, color: P.ink });
    text('exemple', 228, 378, { font: '900 52px Satoshi', color: P.orange });
    ctx.restore();
    // the frame, in the mode's colour, over everything
    ctx.strokeStyle = P.sea; ctx.lineWidth = 5; rrect(2.5, 2.5, LW - 5, LH - 5, LR - 2); ctx.stroke();
  });
  /** the carton's own transform (jitter about the foot, then st.rot) = what compose's fallback and M1 apply */
  function cartonXf(st, t) {
    const g = S.cartonGeo(st), j = S.cartonJit(st, t);
    ctx.translate(j.x, j.y); if (j.r) { ctx.translate(st.x, st.y); ctx.rotate(j.r); ctx.translate(-st.x, -st.y); }
    if (st.rot) { ctx.translate(g.cx, st.y); ctx.rotate(st.rot); ctx.translate(-g.cx, -st.y); }
    return g;
  }
  /** the same transform applied to a world point (for the beam's end, outside the carton's transform) */
  function cartonPt(st, t, p) {
    const g = S.cartonGeo(st), j = S.cartonJit(st, t);
    let x = p[0], y = p[1];
    if (st.rot) { const c = Math.cos(st.rot), s = Math.sin(st.rot), dx = x - g.cx, dy = y - st.y; x = g.cx + dx * c - dy * s; y = st.y + dx * s + dy * c; }
    if (j.r) { const c = Math.cos(j.r), s = Math.sin(j.r), dx = x - st.x, dy = y - st.y; x = st.x + dx * c - dy * s; y = st.y + dx * s + dy * c; }
    return [x + j.x, y + j.y];
  }
  /** where the label sits on the front face (world, before the carton transform) */
  function labelBox(g) { const w = Math.min(g.w * .82, g.h * .82 * LW / LH); return { x: g.cx + g.w * .01, y: g.cy + 3, w, h: w * LH / LW, r: -.022, s: w / LW }; }
  function onCarton(st, t, L) {
    const k = cl(st.label); if (k <= 0) return;
    ctx.save();
    const g = cartonXf(st, t), lb = labelBox(g);
    const d = t - (A.label + .15), land = d > 0 ? 1 + .045 * Math.exp(-d * 13) * Math.cos(d * 34) : 1;     // a tiny slap wobble
    const s = lb.s * (k < 1 ? 1.42 - .42 * eOut(k) : land), r = lerpv(-.17, lb.r, eOut(k)), lift = 1 - k;
    ctx.globalAlpha *= Math.min(1, k * 3);
    // its shadow on the kraft: wide while in the air, a thin contact line once stuck
    at(lb.x + 3 + 22 * lift, lb.y + 5 + 30 * lift, r, s * (1 + .04 * lift), s * (1 + .04 * lift), () => { ctx.globalAlpha *= .30 - .12 * lift; blit(labelShadow()); });
    at(lb.x, lb.y, r, s, s, () => {
      blit(labelSprite());
      const cg = ctx.createLinearGradient(-LW / 2, -LH / 2, LW / 2, LH / 2);                  // paper on kraft: a faint curl light
      cg.addColorStop(0, 'rgba(255,255,255,.10)'); cg.addColorStop(.5, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(80,50,20,.08)');
      ctx.fillStyle = cg; rrect(-LW / 2, -LH / 2, LW, LH, LR); ctx.fill();
    });
    // the slap pushes a little air out from under it
    if (d > -.02 && d < .35) {
      const q = cl((d + .02) / .37);
      ctx.strokeStyle = `rgba(255,252,244,${(.85 * (1 - q)).toFixed(3)})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const side = i % 4, u = (rnd(i * 3.7 + 1) - .5) * .7, out = 18 + 46 * eOut(q);
        const [px, py, nx, ny] = side === 0 ? [u * lb.w, -lb.h / 2, 0, -1] : side === 1 ? [lb.w / 2, u * lb.h, 1, 0] : side === 2 ? [u * lb.w, lb.h / 2, 0, 1] : [-lb.w / 2, u * lb.h, -1, 0];
        const x0 = lb.x + px + nx * out, y0 = lb.y + py + ny * out, len = 22 * (1 - q * .6);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + nx * len + ny * 4, y0 + ny * len + nx * 4); ctx.stroke();
      }
    }
    ctx.restore();
  }
  const labelShadow = () => shadowSprite('labelSh', LW, LH, LR, 10, 'rgba(60,32,12,1)');

  // =========================================================================================== THE ENAMEL PLATE
  // the series' plate (ep. 1 design), at G.bz.plateY, ≤ 880×210
  const PW = 860, PH = 210, PR = 34;
  function rivet(x, y) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, '#CFCAD9'); g.addColorStop(1, '#6D6680');
    ctx.fillStyle = 'rgba(20,6,60,.45)'; circle(x + 1.5, y + 2.5, 10); ctx.fill();
    ctx.fillStyle = g; circle(x, y, 9.5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,60,.7)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 5.5, y + 3); ctx.lineTo(x + 5.5, y - 3); ctx.stroke();
  }
  const plateSprite = () => sprite('plate', PW + 12, PH + 24, () => {
    ctx.fillStyle = P.vioEdge; rrect(-PW / 2, -PH / 2 + 9, PW, PH, PR); ctx.fill();                               // steel edge (thickness)
    const g = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2);
    g.addColorStop(0, '#8450FF'); g.addColorStop(.5, '#6629F4'); g.addColorStop(1, '#4C1AD0');
    ctx.fillStyle = g; rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.fill();
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    for (let i = 0; i < 900; i++) { ctx.fillStyle = rnd(i * 3.3) > .5 ? 'rgba(255,255,255,.045)' : 'rgba(10,0,40,.06)'; ctx.fillRect(-PW / 2 + rnd(i * 1.7) * PW, -PH / 2 + rnd(i * 2.9) * PH, 2, 2); }
    const sh = ctx.createLinearGradient(0, PH / 2 - 56, 0, PH / 2); sh.addColorStop(0, 'rgba(15,0,50,0)'); sh.addColorStop(1, 'rgba(15,0,50,.28)');
    ctx.fillStyle = sh; ctx.fillRect(-PW / 2, PH / 2 - 56, PW, 56);
    ctx.restore();
    ctx.strokeStyle = '#F6EDDC'; ctx.lineWidth = 5; rrect(-PW / 2 + 15, -PH / 2 + 15, PW - 30, PH - 30, PR - 13); ctx.stroke();   // pinstripe
    // the logo on a cream enamel roundel
    const rx = -PW / 2 + 118;
    ctx.fillStyle = 'rgba(16,4,56,.38)'; circle(rx + 2, 6, 74); ctx.fill();
    const rg = ctx.createRadialGradient(rx - 20, -24, 10, rx, 0, 76); rg.addColorStop(0, '#FFFDF7'); rg.addColorStop(1, '#EFE5D1');
    ctx.fillStyle = rg; circle(rx, 0, 72); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 3; circle(rx, 0, 64); ctx.stroke();
    drawLogo(rx, 0, 116);
    // lettering (embossed: a deep-violet offset under cream)
    const tx = 98;
    text('BONZINI', tx, 16 + 5, { font: font('Satoshi', 104, 900), align: 'center', color: '#2A0C7E', ls: 5 });
    text('BONZINI', tx, 16, { font: font('Satoshi', 104, 900), align: 'center', color: P.creamW, ls: 5 });
    text('TRADING CARGO', tx, 70 + 3, { font: font('Satoshi', 44, 900), align: 'center', color: '#2A0C7E', ls: 10 });
    text('TRADING CARGO', tx, 70, { font: font('Satoshi', 44, 900), align: 'center', color: '#E6DBFF', ls: 10 });
    // glaze: the upper half catches the light
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    const hg = ctx.createLinearGradient(0, -PH / 2, 0, -8); hg.addColorStop(0, 'rgba(255,255,255,.30)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-PW / 2, -PH / 2); ctx.lineTo(PW / 2, -PH / 2); ctx.lineTo(PW / 2, -28); ctx.bezierCurveTo(PW / 4, -2, -PW / 4, -14, -PW / 2, -4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; rrect(-PW / 2 + 3, -PH / 2 + 3, PW - 6, PH - 6, PR - 3); ctx.stroke();
    ctx.restore();
    for (const [x, y] of [[-PW / 2 + 34, -PH / 2 + 34], [PW / 2 - 34, -PH / 2 + 34], [-PW / 2 + 34, PH / 2 - 34], [PW / 2 - 34, PH / 2 - 34]]) rivet(x, y);
  });
  const plateShadow = () => shadowSprite('plateSh', PW, PH, PR, 24, 'rgba(34,10,80,1)');
  function plate(st, t, L) {
    if (!st || st.a <= 0) return;
    const fallK = kk(t, A.plateBZ - .22, A.plateBZ), up = eIn(kk(t, A.endcard, A.endcard + .3));
    const air = Math.max(1 - eIn(fallK), .7 * up), persp = 1 + .16 * air;    // high above the table = closer to the lens
    ctx.save(); ctx.globalAlpha *= st.a * (1 - kk(t, A.endcard + .04, A.endcard + .24));      // gone before it reaches the series chip
    at(st.x + 6 + 60 * air, st.y + 16 + 150 * air, st.rot, st.sx * (1 + .3 * air), st.sy * (1 + .3 * air), () => { ctx.globalAlpha *= .42 * (1 - .65 * air); blit(plateShadow()); });
    at(st.x, st.y, st.rot, st.s * st.sx * persp, st.s * st.sy * persp, () => {
      blit(plateSprite());
      const sw = st.sweep;                                                  // a reflection crossing the enamel
      if (sw > 0 && sw < 1) {
        ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip(); ctx.globalCompositeOperation = 'screen';
        const x = -PW / 2 - 260 + (PW + 520) * ease(sw);
        ctx.transform(1, 0, -.45, 1, 0, 0);
        const g = ctx.createLinearGradient(x - 110, 0, x + 110, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,.22)'); g.addColorStop(.5, 'rgba(255,255,255,.55)'); g.addColorStop(.58, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 120, -PH, 240, PH * 2);
        ctx.restore();
      }
    });
    // landing: paper dust kicked out from under the plate
    const d = t - A.plateBZ;
    if (d >= 0 && d < .6) {
      const q = d / .6, e = 1 - Math.pow(1 - q, 2);
      for (let i = 0; i < 18; i++) {
        const side = i % 3 === 0 ? -1 : 1, x0 = st.x + (rnd(i * 4.1) - .5) * PW * .95, y0 = st.y + side * PH / 2;
        const vx = (x0 - st.x) / PW * 260 + (rnd(i * 7.7) - .5) * 90, vy = side * (50 + rnd(i * 2.3) * 110);
        ctx.fillStyle = `rgba(250,244,255,${(.75 * (1 - q)).toFixed(3)})`; circle(x0 + vx * e * .6, y0 + vy * e * .6, 2 + 4 * rnd(i * 5.3) * (1 - q * .5)); ctx.fill();
      }
    }
    ctx.restore();
  }

  // =========================================================================================== THE RECEPTION
  // --- hand-held scanner (ep. 1): violet window at the origin, body along +x, grip along +y
  const scannerSprite = () => sprite('scanner', 290, 280, () => {
    ctx.save();
    const gg = ctx.createLinearGradient(150, 0, 236, 0); gg.addColorStop(0, '#2E2836'); gg.addColorStop(1, '#16121C');
    ctx.fillStyle = gg; rrect(152, 10, 78, 200, 30); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 60; y < 196; y += 14) ctx.fillRect(160, y, 62, 5);
    ctx.fillStyle = P.vioD; rrect(132, 40, 26, 58, 9); ctx.fill();                                                 // trigger
    const hg = ctx.createLinearGradient(0, -50, 0, 50); hg.addColorStop(0, '#4A4356'); hg.addColorStop(.45, '#2C2634'); hg.addColorStop(1, '#17121D');
    ctx.fillStyle = hg; rrect(-6, -50, 262, 100, 34); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; rrect(16, -42, 220, 12, 6); ctx.fill();
    ctx.fillStyle = '#100C14'; rrect(-14, -40, 34, 80, 12); ctx.fill();                                            // nose bezel
    const wg = ctx.createLinearGradient(-10, -32, -10, 32); wg.addColorStop(0, '#9C7BFF'); wg.addColorStop(1, '#4A1FC2');
    ctx.fillStyle = wg; rrect(-10, -32, 18, 64, 7); ctx.fill();                                                  // violet window
    ctx.fillStyle = P.vio; circle(196, -16, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(194, -18, 2); ctx.fill();   // LED
    ctx.restore();
  }, 1, 24, 60);
  // --- tape measure (ep. 1): the case at the origin, the blade along +x (ticks only, never a numeral)
  const tapeCase = () => sprite('tapeCase', 96, 96, () => {
    ctx.fillStyle = 'rgba(34,12,64,.3)'; rrect(-30, -28, 68, 68, 20); ctx.fill();
    const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#3E3746'); g.addColorStop(1, '#1D1923');
    ctx.fillStyle = g; rrect(-34, -34, 68, 68, 20); ctx.fill();
    ctx.fillStyle = '#F2C230'; rrect(-25, -25, 50, 50, 13); ctx.fill();
    ctx.fillStyle = '#2B2530'; circle(0, 0, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(-4, -4, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rrect(-30, -31, 60, 8, 4); ctx.fill();
  });
  function tapeRun(len, k) {
    if (k <= 0) return;
    const Lb = len * k;
    if (Lb > 1) {
      ctx.fillStyle = 'rgba(34,12,64,.22)'; ctx.fillRect(3, -8, Lb, 26);
      const g = ctx.createLinearGradient(0, -13, 0, 13); g.addColorStop(0, '#FFE07A'); g.addColorStop(1, '#E9B524');
      ctx.fillStyle = g; ctx.fillRect(0, -13, Lb, 26);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      for (let x = 34; x < Lb - 2; x += 11) { const big = Math.round((x - 34) / 11) % 5 === 0; ctx.beginPath(); ctx.moveTo(x, -13); ctx.lineTo(x, big ? 3 : -5); ctx.stroke(); }
      ctx.fillStyle = '#8E8A96'; ctx.fillRect(Lb - 2, -16, 8, 32);                                                   // the hook
    }
    const pop = cl(k * 8); ctx.save(); ctx.translate(-6, 0); ctx.scale(pop, pop); blit(tapeCase()); ctx.restore();
  }
  /** violet dimension mark from p0 to p1 (no figure): line, end ticks, arrowheads; k draws it on */
  function dimMark(p0, p1, k) {
    if (k <= 0) return;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
    ctx.save(); ctx.translate(p0[0], p0[1]); ctx.rotate(Math.atan2(dy, dx));
    ctx.globalAlpha *= Math.min(1, k * 1.5); ctx.strokeStyle = P.vioD; ctx.fillStyle = P.vioD; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const Lm = len * eOut(k);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Lm, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.moveTo(Lm, -15); ctx.lineTo(Lm, 15); ctx.stroke();
    for (const [x, d] of [[0, 1], [Lm, -1]]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + d * 18, -9); ctx.lineTo(x + d * 18, 9); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // --- the violet rubber stamp « MESURÉ ✓ » (ep. 1: Stencil, double border, drawn check, starved ink)
  const STF = font(FF.stencil, 84, 900);
  function stampSprite(label) {
    const tw = measure(label, STF, 3), w = tw + 70 + 26 + 64, h = 120;
    return sprite('st_' + label, w + 24, h + 24, () => {
      ctx.fillStyle = P.vioD; ctx.strokeStyle = P.vioD;
      text(label, -w / 2 + 32, 30, { font: STF, color: P.vioD, ls: 3 });
      const cx = -w / 2 + 32 + tw + 26 + 30;
      ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 28, 2); ctx.lineTo(cx - 8, 24); ctx.lineTo(cx + 30, -28); ctx.stroke();
      ctx.lineWidth = 7; rrect(-w / 2, -h / 2, w, h, 16); ctx.stroke();
      ctx.lineWidth = 2.5; rrect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 10); ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .42;
      ctx.drawImage(TEX.starve, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24); ctx.globalAlpha = .25; ctx.drawImage(TEX.starve, 120, 40, 300, 150, -w / 2, -h / 2, w, h);
    });
  }
  function stamp(label, k, since, x, y, rot, seed) {
    if (k <= 0) return;
    const sp = stampSprite(label), sc = (k < 1 ? 1.45 - .45 * eOut(k) : 1) * (1 + .03 * Math.exp(-Math.max(0, since) * 14));
    at(x, y, rot, sc, sc, () => {
      ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2.2); ctx.globalCompositeOperation = 'multiply'; blit(sp); ctx.restore();
      if (k >= 1 && since < .5) {                                            // ink specks thrown by the impact
        ctx.save(); ctx.fillStyle = P.vioD; ctx.globalAlpha *= .7 * (1 - since * 1.4);
        for (let i = 0; i < 8; i++) { const a = rnd(seed * 7 + i) * Math.PI * 2, r = sp.w * .5 + 6 + rnd(seed + i * 3) * 24; circle(Math.cos(a) * r * .88, Math.sin(a) * r * .36, 1.5 + rnd(i + seed) * 3); ctx.fill(); }
        ctx.restore();
      }
    });
  }
  // --- the readout slip « VOLUME : • m³ » (thermal paper, zigzag tear, the value masked in a violet window)
  const SW_ = 540, SH_ = 214;
  const slipSprite = () => sprite('slip', SW_ + 60, SH_ + 70, () => {
    const zig = (y, dir) => { const pts = []; for (let x = -SW_ / 2, i = 0; x <= SW_ / 2 + .1; x += 18, i++) pts.push([x, y + dir * (i % 2 ? 7 : 0)]); return pts; };
    const top = zig(-SH_ / 2, -1), bot = zig(SH_ / 2, 1).reverse();
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 20000 + 5; ctx.shadowOffsetY = 10;
    ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const pg = ctx.createLinearGradient(0, -SH_ / 2, 0, SH_ / 2); pg.addColorStop(0, '#FFFFFB'); pg.addColorStop(1, '#F4F0E6');
    path(); ctx.fillStyle = pg; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 260; i++) { ctx.fillStyle = 'rgba(120,100,80,.05)'; ctx.fillRect(-SW_ / 2 + rnd(i * 2.3) * SW_, -SH_ / 2 + rnd(i * 4.1) * SH_, 1.5, 1.5); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(-SW_ / 2 + 26, 10); ctx.lineTo(SW_ / 2 - 26, 10); ctx.stroke(); ctx.setLineDash([]);
    // « VOLUME : [•] m³ » — the value is masked (no figure)
    const f = '900 60px Satoshi', w1 = measure('VOLUME :', f), w2 = measure('m³', f), bw = 92, gap = 18, tot = w1 + gap + bw + gap + w2, x0 = -tot / 2, by = -32;
    text('VOLUME :', x0, by + 21, { font: f, color: P.ink });
    const bx = x0 + w1 + gap;
    ctx.fillStyle = '#EEE7FF'; rrect(bx, by - 34, bw, 68, 14); ctx.fill();
    ctx.strokeStyle = P.vio; ctx.lineWidth = 4; rrect(bx, by - 34, bw, 68, 14); ctx.stroke();
    ctx.fillStyle = P.ink; circle(bx + bw / 2, by, 12); ctx.fill();
    text('m³', bx + bw + gap, by + 21, { font: f, color: P.ink });
  });
  // --- the mini « AIR » cloud (own drawing when M1's CA_air is absent): cut paper, « AIR » in sea-blue stencil
  const miniCloud = () => sprite('cloud', 640, 420, () => {
    const puffs = [[-175, 30, 96], [-62, -48, 126], [78, -42, 120], [188, 26, 92], [0, 62, 112], [-112, 72, 82], [118, 72, 86]];
    const path = () => { ctx.beginPath(); for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } };
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 20000 + 8; ctx.shadowOffsetY = 16;
    ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = '#E9E2D6'; ctx.fill();
    ctx.save(); ctx.translate(-4, -6); path(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore();
    text('AIR', 0, 70, { font: font(FF.stencil, 160, 900), align: 'center', color: P.sea, ls: 10 });
  });
  /** its eyes: proud dots, or « × × » once struck out */
  function miniEyes(ko) {
    ctx.fillStyle = P.ink; ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const ex of [-56, 56]) {
      if (!ko) { ctx.beginPath(); ctx.ellipse(ex, -108, 12, 16, 0, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(ex - 13, -121); ctx.lineTo(ex + 13, -95); ctx.moveTo(ex + 13, -121); ctx.lineTo(ex - 13, -95); ctx.stroke();
    }
  }
  function drawMiniAir(m, t, L) {
    if (typeof window.CA_air === 'function') {
      ctx.save();
      try { window.CA_air({ x: m.x, y: m.y, s: m.s, sx: 1, sy: 1, rot: 0, a: 1, burst: 0, mood: m.strike > .5 ? 'nervous' : 'content', frozen: false, deflate: 0, inside: false, tag: { sw: 0, a: 0 } }, t, L); ctx.restore(); return; }
      catch (e) { ctx.restore(); }
    }
    const ko = m.strike >= 1, q = ko ? S.squash(t, A.airStrike + .2, .12, 26, 8) : { sx: 1, sy: 1 };   // struck: a little « pff »
    at(m.x, m.y + 60 * m.s * (1 - q.sy), 0, m.s * q.sx, m.s * q.sy, () => { blit(miniCloud()); miniEyes(ko); });
  }
  /** the violet marker stroke that strikes the cloud out (lower-left → upper-right) */
  function strike(m, k) {
    if (k <= 0) return;
    const s = m.s, x0 = m.x - 300 * s, y0 = m.y + 110 * s, x1 = m.x + 300 * s, y1 = m.y - 120 * s;
    const ex = lerpv(x0, x1, k), ey = lerpv(y0, y1, k) - Math.sin(Math.PI * k) * 10 * s;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(lerpv(x0, ex, .5), lerpv(y0, ey, .5) - 12 * s * k, ex, ey); };
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = 'rgba(112,51,255,.92)'; ctx.lineWidth = 40 * s; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,30,200,.45)'; ctx.lineWidth = 16 * s; ctx.translate(0, 9 * s); path(); ctx.stroke(); ctx.translate(0, -19 * s); path(); ctx.stroke();
    ctx.restore();
  }
  function scene(b, t, L) {
    if (!b) return;
    const hero = S.heroCarton(t);
    // exit: the score's b.out runs A.endcard → +.3, but the CTA pill pops on A.cta (in the slip's zone): the slip, the
    // stamp, the mini cloud and the marks are whisked off to the right and gone by then
    const ex = kk(t, A.endcard - .05, Math.max(A.endcard + .05, A.cta - .02)), out = Math.max(b.out, ex), gx = 1000 * ex * ex, off = cl(1 - out * 1.6);
    // 1 — on the carton: violet dimension marks L · l · H (once measured), the tape measure along LONGUEUR, the scan
    if (hero && hero.label > 0) {
      const g = S.cartonGeo(hero), j = S.cartonJit(hero, t);
      ctx.save(); cartonXf(hero, t);
      const mk = i => eOut(kk(t, A.volume - .12 + .12 * i, A.volume + .18 + .12 * i)) * (1 - out);
      const nL = 62, nR = 40, u = [.857, .514];                              // u ⟂ to the receding edges, pointing down-right
      dimMark([g.FBL[0], g.FBL[1] + nL], [g.FBR[0], g.FBR[1] + nL], mk(0));
      dimMark([g.FBR[0] + u[0] * nR, g.FBR[1] + u[1] * nR], [g.BBR[0] + u[0] * nR, g.BBR[1] + u[1] * nR], mk(1));
      dimMark([g.BBR[0] + nR, g.BBR[1]], [g.BBR[0] + nR, g.BTR[1]], mk(2));
      if (b.tape > 0) at(g.FBR[0] + 34, g.FBR[1] + 28, Math.PI, 1, 1, () => tapeRun(g.w + 34, b.tape));
      // the scan: a violet line sweeps the label right → left, the scanned part glows; then the label is registered
      const lb = labelBox(g), lab = () => { ctx.translate(lb.x, lb.y); ctx.rotate(lb.r); };
      const sw = ease(kk(t, A.scan, A.scan + .45));
      if (b.beam) {
        const lx = lb.w / 2 + 6 - (lb.w + 12) * sw;
        ctx.save(); lab(); rrect(-lb.w / 2, -lb.h / 2, lb.w, lb.h, 6); ctx.clip();
        ctx.fillStyle = 'rgba(112,51,255,.20)'; ctx.fillRect(lx, -lb.h / 2, lb.w / 2 - lx, lb.h);
        ctx.globalCompositeOperation = 'screen';
        const gr = ctx.createLinearGradient(lx - 40, 0, lx + 40, 0); gr.addColorStop(0, 'rgba(140,90,255,0)'); gr.addColorStop(.5, 'rgba(150,100,255,.9)'); gr.addColorStop(1, 'rgba(140,90,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(lx - 40, -lb.h / 2, 80, lb.h);
        ctx.restore();
        ctx.save(); lab(); ctx.lineCap = 'round';
        glowStroke(() => { ctx.beginPath(); ctx.moveTo(lx, -lb.h / 2 - 12); ctx.lineTo(lx, lb.h / 2 + 12); }, '122,69,255', 1, 6);
        ctx.fillStyle = '#F6F1FF'; ctx.fillRect(lx - 1.5, -lb.h / 2 - 12, 3, lb.h + 24); ctx.restore();
      }
      const done = t - (A.scan + .4);
      if (done > 0) {
        ctx.save(); lab();
        const rim = Math.exp(-done * 3.5);
        if (rim > .02) glowStroke(() => rrect(-lb.w / 2 - 4, -lb.h / 2 - 4, lb.w + 8, lb.h + 8, 9), '112,51,255', .9 * rim * (1 - out), 5);
        const bb = cl(spr(done, 15, .45), 0, 1.25) * (1 - out);
        at(lb.w / 2 - 6, -lb.h / 2 + 4, 0, bb, bb, () => {
          ctx.fillStyle = 'rgba(34,12,64,.3)'; circle(2, 4, 29); ctx.fill();
          ctx.fillStyle = P.vio; circle(0, 0, 28); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.5; circle(0, 0, 28); ctx.stroke();
          ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(-3, 11); ctx.lineTo(13, -10); ctx.stroke();
        });
        ctx.restore();
      }
      ctx.restore();
      // 2 — the hand-held scanner (on twos), aimed at the label; its violet fan follows the sweep; « bip » marks
      const ts = twos(t), bs = S.bz(ts), sc0 = bs ? bs.scanner : b.scanner;
      const k = sc0.k, x = t < A.scan ? sc0.x : G.bz.scanner.x + 340 * (1 - k);
      if (k > 0 && off > 0) {
        const jj = jit(812, nOf(t), .7), ox = x + jj.x, oy = sc0.y + jj.y;
        const lc = cartonPt(hero, t, [lb.x, lb.y]), aim = Math.atan2(lc[1] - oy, lc[0] - ox) + Math.PI;
        if (b.beam) {
          const lx = lb.x + lb.w / 2 + 6 - (lb.w + 12) * sw, p1 = cartonPt(hero, t, [lx, lb.y - lb.h / 2 - 12]), p2 = cartonPt(hero, t, [lx, lb.y + lb.h / 2 + 12]);
          ctx.save(); ctx.globalCompositeOperation = 'screen';
          const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, gr = ctx.createLinearGradient(ox, oy, mx, my);
          gr.addColorStop(0, 'rgba(160,110,255,.8)'); gr.addColorStop(1, 'rgba(130,80,255,.28)');
          const nx = Math.cos(aim + Math.PI / 2) * 14, ny = Math.sin(aim + Math.PI / 2) * 14;
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(ox + nx, oy + ny); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(ox - nx, oy - ny); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(235,225,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(mx, my); ctx.stroke();
          const rg = ctx.createRadialGradient(ox, oy, 2, ox, oy, 80); rg.addColorStop(0, 'rgba(200,170,255,.95)'); rg.addColorStop(1, 'rgba(140,90,255,0)');
          ctx.fillStyle = rg; circle(ox, oy, 80); ctx.fill();
          ctx.restore();
        }
        at(ox + 10, oy + 18, aim, 1, 1, () => { ctx.save(); ctx.globalAlpha *= .28; ctx.fillStyle = '#220C40'; rrect(-6, -50, 262, 100, 34); ctx.fill(); rrect(152, 10, 78, 200, 30); ctx.fill(); ctx.restore(); });
        at(ox, oy, aim, 1, 1, () => blit(scannerSprite()));
        const db = t - b.beep;                                                // « bip »: three short violet strokes off the head
        if (db > 0 && db < .32) {
          const q = db / .32; ctx.save(); ctx.strokeStyle = `rgba(112,51,255,${(1 - q).toFixed(3)})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
          for (const a of [-2.0, -1.55, -1.1]) { const r0 = 70 + 26 * q, r1 = r0 + 26; ctx.beginPath(); ctx.moveTo(ox + 60 + Math.cos(a) * r0, oy + Math.sin(a) * r0); ctx.lineTo(ox + 60 + Math.cos(a) * r1, oy + Math.sin(a) * r1); ctx.stroke(); }
          ctx.restore();
        }
      }
    }
    // 3 — the readout slip (on twos, pinned with violet washi tape), stamped « MESURÉ ✓ »; the struck mini « AIR »
    ctx.save(); ctx.translate(gx, 0); ctx.rotate(.05 * ex); ctx.globalAlpha *= 1 - ex;
    const rk = b.readout, rk2 = S.bz(twos(t)), rs = rk2 ? rk2.readout : rk;
    if (rk > 0) {
      const jj = jit(813, nOf(t), .5), sx0 = G.bz.readout.x + 12, sy0 = G.bz.readout.y + 22;
      const y = sy0 - 70 * (1 - rs), r = lerpv(-.11, -.024, eOut(rs)), s = 1 + .06 * (1 - rs);
      ctx.save(); ctx.globalAlpha *= Math.min(1, rk * 2.5);
      at(sx0 + jj.x, y + jj.y, r + jj.r, s, s, () => {
        blit(slipSprite());
        if (rs >= .9) {                                                       // violet washi tape on the top corners
          ctx.fillStyle = 'rgba(123,75,255,.78)';
          at(-SW_ / 2 + 22, -SH_ / 2 + 4, -.62, 1, 1, () => ctx.fillRect(-46, -15, 92, 30));
          at(SW_ / 2 - 22, -SH_ / 2 + 4, .55, 1, 1, () => ctx.fillRect(-46, -15, 92, 30));
        }
      });
      ctx.restore();
      stamp('MESURÉ', b.measured, t - A.measured, sx0 + 40, sy0 + 66, -.06, 7);
    }
    if (b.air && b.air.s > .01) { drawMiniAir(b.air, t, L); strike(b.air, b.air.strike); }
    ctx.restore();
  }

  // =========================================================================================== exports
  window.BZ_band = band;
  window.BZ_atmos = atmos;
  window.BZ_onCarton = onCarton;
  window.BZ_scene = scene;
  window.BZ_plate = plate;
  window.BZ_lib = { P, sprite, blit, shadowSprite, circle, glowStroke, cartonXf, nOf, twos };
})();
