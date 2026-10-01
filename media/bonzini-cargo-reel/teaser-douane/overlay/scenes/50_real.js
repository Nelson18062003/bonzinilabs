'use strict';
// =============================================================================================================
// SECTION d · master 14.0–24.0 s · shots P14–P19 · bars M8–M12  +  the short cut's end card (short 12.0–14.5)
//   P14 14.0–16.0  LE VRAI ÉCRAN : « Ni plus. / Ni moins. » leave by the top; the ticket folds away in an accordion
//                  (paper physics) and only its four coloured dots stay; the printer drops out. The REAL phone rises
//                  (y +40 → 0, 0.8 s, EASE) with a true-perspective 3D tilt (rotateY −12° → −4°, rotateX 4° → 1°),
//                  halo #281450 25 % / 40 px, a glint across the glass 14.6–15.2. Each dot flies into the phone's empty
//                  bar slot as an elastic capsule and lands on its instrument (violet 14.375 · orange 14.5 · gold 14.75 ·
//                  grey 14.875). The due rule of the ticket retracts into a vertical violet REFERENCE at the bar's end;
//                  the grey end overshoots it and LOCKS at 15.0 exactly (f450); 15.0–15.2 crossfade to the real pixels
//                  (C1a). Texts: 14.0 « Douane : combien ? » · 14.5 « On l'estime… » · 15.0 « avant. » + the chip
//                  « Exemple · estimation » (340 × 50, 33 px) on the frosted band, inside the screen even at its pop.
//                  The reference goes out at 15.5. The white printer carries the debossed nameplate (printerPlateLight).
//   P15 16.0–18.0  the phone tips back and sinks under the pill (centre ≈ 556, 1392, ×1.12, tilted 5°): question above,
//                  the estimate's screen below; the real search pill slides in (x 142–938, y 700–797); « baskets » is
//                  typed one letter per 16th (16.0 → 16.75, C2p_1…7). 16.5 « Avant de payer » · 17.0 « votre
//                  fournisseur. » 18.0–18.42 the phone falls out with the pill.
//   P16 18.0–20.0  the pill drops (y +40, 0.3 s); the site title, centred y 540–722, revealed by word groups with the
//                  site motion (y 14 → 0, 0.6 s, soft mask): 18.0 / 18.5 / 19.0 / 19.5.
//   P17 20.0–21.5  the signature slides to x 120 and grows ×1.08 (98 px, baselines 532 / 630), the brand grows into the
//                  header (y 300, ×1.43) and « Douane » slides out like a drawer (logo pieces hop on the balafon
//                  E4 G4 B4 E5); the 2 px violet rule (y 668, x 120–480); the REAL phone (C1a, 640 px face) rises from
//                  the bottom right into the product hero (tilted, cropped by the right edge and the bottom, halo,
//                  glint 20.6–21.2); 20.5 legal mention (44 px, 4 lines, x 120–470, y ≈ 1110–1330); 21.0 « Bientôt »
//                  (x 120–351, y 974–1062).
//   P18 21.5–23.5  violet ink stamp « EN TEST » under the rule (centre 298, 836, −6°, 6 px shake × 3 frames, ink spreads in
//                  4 frames). Hold: the card breathes, the phone floats up 12 px.
//   P19 23.5–24.0  an iris closes into the dark printer slot; the blank receipt tip is fed out (top 880 → 420), section a's
//                  printer dressing is there, and the nameplate fades back in on the printer face (printerPlate(880),
//                  f710–719, backlight at section a's resting .22): f719 = frame 0 without the question (no top-left pill).
//   SHORT END (short 12.0–14.5 = SHORTEND 0..2.5): the ticket folds into the violet rule, « Ni plus. » / « Ni moins. »
//                  recompose into the grey « Ni plus, ni moins. », « Payez le » 0 / « juste droit. » .5, legal from 0,
//                  the phone rises .25 → 1.1 as the printer leaves, « Douane » .5, « Bientôt » 1.0, « EN TEST » 2.0
//                  → same final card as master 23.5 (the iris follows).
// Hand-off IN  (f420 / short f360): section c's light world (ticket x 120–960 / y 640–1080, rows, footer, rule y 1066,
//                  white printer slot 1100 with its nameplate, « Ni plus. » / « Ni moins. », ink brand at 120,272).
// Hand-off OUT (f719 / short f449): frame 0's composition without the question (dark, blank tip, printer nameplate).
// =============================================================================================================
(() => {
  const F = 1 / 30, AP = '’', NB = NNBSP, D2R = Math.PI / 180, PERSP = 1600;
  const INK = COL.ink, GREY = COL.mute, VIO = COL.violet, ORG = COL.orange, GOLD = COL.gold, BG = COL.bg;
  const sst = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const eIn = (x, p = 2) => Math.pow(clamp(x), p);
  const backIn = (x, c = 1) => { x = clamp(x); return (c + 1) * x * x * x - c * x * x; };
  function swap(g, fn) { const s = ctx; ctx = g; try { fn(); } finally { ctx = s; } }
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };
  const bez = (p0, p1, p2, p3, t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]; };
  function capsule(x0, y0, x1, y1, th, col, a = 1) {
    if (a <= 0 || th <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = th; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + (Math.abs(x1 - x0) + Math.abs(y1 - y0) < .01 ? .01 : 0), y1); ctx.stroke(); ctx.restore();
  }
  function shakeAt(t, t0, amp = 6) {                                       // amp px on the impact frame, then 2/3, 1/3
    const f = Math.floor((t - t0) * 30 + 1e-4); if (f < 0 || f > 2) return [0, 0];
    const a = amp * (1 - f / 3), ang = hash(t0 * 31.7 + f * 13.1) * Math.PI * 2; return [Math.cos(ang) * a, Math.sin(ang) * a];
  }

  // ------------------------------------------------------------------------------------------- hand-off ticket (section c, f419)
  const PX0 = 120, PX1 = 960, TX = 160, ROW_C = [700, 784, 868, 952], DOT_X = 170, LBL_X = 212, AMT_X1 = 780;
  const LABEL = ['Droit de douane', 'Accises', 'TVA et centimes', 'Autres taxes'], DOT_COL = [VIO, ORG, GOLD, '#B9B9C2'];
  const AMT = [[24, 48], [16, 48], [24, 48], [36]];
  const PAPER_T = 640, PAPER_B = 1080, FOOT_B = 1048, SLOT0 = 1100;
  function paperPath(top, bot) {
    ctx.beginPath(); ctx.moveTo(PX0, bot); ctx.lineTo(PX0, top + 8);
    for (let x = PX0; x <= PX1; x += 14) ctx.lineTo(x, top + hash(x * .37 + 5) * 9);
    ctx.lineTo(PX1, top + 8); ctx.lineTo(PX1, bot); ctx.closePath();
  }
  function amount(x, y, w, h) {
    ctx.fillStyle = 'rgba(13,13,18,.62)';
    for (let yy = 0; yy < h; yy += 4) for (let xx = (yy / 4) % 2 ? 2 : 0; xx < w - 1; xx += 4) ctx.fillRect(x + xx, y + yy, 2.6, 2.6);
  }
  function drawAmounts(i, yc) { let ax = AMT_X1; for (const gw of AMT[i].slice().reverse()) { ax -= gw; amount(ax, yc - 14, gw, 28); ax -= 8; } }
  let TK_NODOT = null, TK_DOT = null;
  function buildTicket(dots) {                                             // the ticket as it stands at 14.0 (no shadow, no rule)
    const c = makeCanvas(W, H);
    swap(c.getContext('2d'), () => {
      paperPath(PAPER_T, PAPER_B); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      for (let i = 0; i < 4; i++) {
        if (dots) { ctx.fillStyle = DOT_COL[i]; ctx.beginPath(); ctx.arc(DOT_X, ROW_C[i], 10, 0, 7); ctx.fill(); }
        sat(LABEL[i], LBL_X, ROW_C[i] + 24, { size: 64, w: 700, color: INK, ls: -.02 }); drawAmounts(i, ROW_C[i]);
      }
      const wCa = satW('Ça, ', 56, 500);
      sat('Ça,', TX, FOOT_B, { size: 56, w: 500, color: COL.ink3 }); sat('c' + AP + 'est dû.', TX + wCa, FOOT_B, { size: 56, w: 500, color: COL.ink3 });
    });
    return c;
  }

  // ------------------------------------------------------------------------------------------- the accordion fold (paper physics)
  // Five panels (row bands + footer) pleat down onto the ticket's bottom edge: mountain / valley alternate, the edges that
  // come forward widen with the perspective, panels facing down take the shade. θ: 0 → 90° (ease-in: the paper falls flat).
  const PAN = [[636, 742], [742, 826], [826, 910], [910, 994], [994, 1082]];
  const foldTheta = (t, t0) => 90 * D2R * Math.pow(prog(t + F, t0, t0 + .27), 1.6);
  function foldEdges(th) {                                                 // E[0] = bottom edge … E[5] = top edge
    const c = Math.cos(th), s = Math.sin(th); let y = PAN[4][1], z = 0; const E = [{ y, z, sy: PAN[4][1] }];
    for (let p = 4, k = 1; p >= 0; p--, k++) { const h = PAN[p][1] - PAN[p][0]; y -= h * c; z += (k % 2 ? 1 : -1) * h * s; E.push({ y, z, sy: PAN[p][0] }); }
    return E;
  }
  function foldMap(E, sy) {
    for (let k = 0; k < 5; k++) { const a = E[k + 1], b = E[k]; if (sy >= a.sy && sy <= b.sy) { const f = (sy - a.sy) / (b.sy - a.sy), z = lerp(a.z, b.z, f); return { y: lerp(a.y, b.y, f), sc: PERSP / (PERSP - z) }; } }
    return { y: E[0].y, sc: 1 };
  }
  let FL = null;
  function foldLayer(sprite, th) {
    if (!FL) FL = makeCanvas(W, H);
    const g = FL.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    const E = foldEdges(th), s = Math.sin(th), S = 10;
    for (let k = 0; k < 5; k++) {
      const top = E[k + 1], bot = E[k], sh = (bot.sy - top.sy) / S;
      for (let j = 0; j < S; j++) {
        const f0 = j / S, f1 = (j + 1) / S, y0 = lerp(top.y, bot.y, f0), y1 = lerp(top.y, bot.y, f1);
        const sc = PERSP / (PERSP - lerp(top.z, bot.z, (f0 + f1) / 2)), dh = y1 - y0; if (dh < .02) continue;
        g.drawImage(sprite, 100, top.sy + j * sh, 880, sh, 540 - 440 * sc, y0, 880 * sc, dh + Math.min(.6, dh));
      }
      if (s > .001) {                                                      // fold shading (only on the paper: source-atop)
        const st = PERSP / (PERSP - top.z), sb = PERSP / (PERSP - bot.z), down = top.z > bot.z;
        g.globalCompositeOperation = 'source-atop';
        g.beginPath(); g.moveTo(540 - 445 * st, top.y); g.lineTo(540 + 445 * st, top.y); g.lineTo(540 + 445 * sb, bot.y); g.lineTo(540 - 445 * sb, bot.y); g.closePath();
        const gr = g.createLinearGradient(0, top.y, 0, bot.y + .01);
        if (down) { gr.addColorStop(0, `rgba(13,13,18,${.06 * s})`); gr.addColorStop(1, `rgba(13,13,18,${.22 * s})`); }
        else { gr.addColorStop(0, `rgba(13,13,18,${.05 * s})`); gr.addColorStop(.35, 'rgba(13,13,18,0)'); gr.addColorStop(1, `rgba(13,13,18,${.03 * s})`); }
        g.fillStyle = gr; g.fill();
        g.fillStyle = `rgba(13,13,18,${(down ? .16 : .08) * s})`; g.fillRect(540 - 445 * st, top.y - .5, 890 * st, 1);   // crease
        g.globalCompositeOperation = 'source-over';
      }
    }
    return { L: FL, E };
  }
  function drawFold(sprite, th, printerY) {
    const { L, E } = foldLayer(sprite, th), s = Math.sin(th);
    ctx.save(); ctx.shadowColor = `rgba(13,13,18,${.09 * (1 - .75 * s)})`; ctx.shadowBlur = 46; ctx.shadowOffsetY = 16; ctx.drawImage(L, 0, 0); ctx.restore();
    if (printerY < 1110) { ctx.save(); ctx.globalAlpha = .55 * (1 - s); ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(13,13,18,.3)'; ctx.fillRect(PX0 + 8, PAPER_B + 1, PX1 - PX0 - 16, 6); ctx.restore(); }
    return E;
  }
  /** the due rule (y 1066–1070, x 160–920) carried by the folding footer panel */
  function ruleOnFold(th) {
    const E = foldEdges(th), a = foldMap(E, 1066), b = foldMap(E, 1070), sc = (a.sc + b.sc) / 2;
    return { x0: 540 - 380 * sc, x1: 540 + 380 * sc, y0: a.y, y1: Math.max(b.y, a.y + 1.6) };
  }

  // ------------------------------------------------------------------------------------------- the white printer (section c's look)
  function printerLight(sy, m) {
    if (sy >= H + 10) return;
    const ly = sy + 70, bh = Math.max(60, H - sy + 60);
    ctx.save(); ctx.shadowColor = 'rgba(13,13,18,.12)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    ctx.fillStyle = COL.card; rrect(60, sy, W - 120, bh, 28); ctx.fill(); ctx.restore();
    ctx.save(); rrect(60, sy, W - 120, bh, 28); ctx.clip();
    let g = ctx.createLinearGradient(0, sy, 0, H); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.035)'); ctx.fillStyle = g; ctx.fillRect(60, sy, W - 120, bh);
    g = ctx.createLinearGradient(60, 0, W - 60, 0); g.addColorStop(0, 'rgba(13,13,18,.03)'); g.addColorStop(.08, 'rgba(13,13,18,0)'); g.addColorStop(.92, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.035)'); ctx.fillStyle = g; ctx.fillRect(60, sy, W - 120, bh);
    ctx.fillStyle = 'rgba(13,13,18,.045)'; ctx.fillRect(60, sy + 128, W - 120, 2); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(60, sy + 130, W - 120, 1);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = COL.fill; rrect(110, sy - 6, W - 220, 20, 10); ctx.fill();
    ctx.fillStyle = 'rgba(13,13,18,.05)'; rrect(110, sy - 6, W - 220, 7, 4); ctx.fill();
    ctx.fillStyle = VIO; ctx.shadowColor = VIO; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(160, ly, 11, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    const bt = ((m - 10) % 2 + 2) % 2, sp = Math.floor(bt / .125 + 1e-6), hitE = m >= 14 && m < 14.5 ? Math.exp(-(m - 14) * 9) : 0;
    for (let k = 0; k < 16; k++) {
      const x = 220 + k * 34;
      if (k === 12) { ctx.strokeStyle = VIO; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, ly, 11, 0, 7); ctx.stroke(); continue; }
      ctx.beginPath(); ctx.arc(x, ly, 11, 0, 7);
      if (k === 0 || k === 4 || k === 8) {
        ctx.fillStyle = VIO; if (k === 0 && hitE > .02) { ctx.shadowColor = VIO; ctx.shadowBlur = 22 * hitE; } ctx.fill(); ctx.shadowBlur = 0;
        if (k === 0 && hitE > .02) { ctx.fillStyle = `rgba(255,255,255,${.35 * hitE})`; ctx.beginPath(); ctx.arc(x, ly, 5, 0, 7); ctx.fill(); }
      } else { ctx.fillStyle = k === sp ? '#D4D4DB' : COL.fill; ctx.fill(); }
    }
    ctx.restore();
    if (typeof printerPlateLight === 'function') printerPlateLight(sy);   // section c's nameplate (40_drop.js), same printer
  }

  // ------------------------------------------------------------------------------------------- the real phone, in true perspective
  // The capture (900×1803, DPR 3) becomes a 400×801 face; the face is projected column by column (affine strips) with
  // CSS-like rotateY · rotateX and a 1600 px perspective, so the near side really grows (a trapezoid, not a shear).
  const PIW = 900, PIH = 1803, PW = 400, PSC = PW / PIW, PH = PIH * PSC, PCX = 540, PCY = 600 + PH / 2;
  const BAR_X = [[93, 357], [369, 513], [525, 774], [786, 807]], BAR_Y = [744, 768];       // the real bar, measured in C1a (img px)
  const SEG_COL = [VIO, ORG, GOLD, '#C5C5C9'];
  let FACE_A = null, FACE_B = null, FACE = null, PLY = null;
  function buildFaces() {
    const mk = key => { const I = IMGK(key), c = makeCanvas(PW, Math.ceil(PH)), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; if (I) g.drawImage(I, 0, 0, PW, PH); return c; };
    FACE_A = mk('cap/C1a_frost'); FACE_B = mk('cap/C1b_frost'); FACE = makeCanvas(PW, Math.ceil(PH)); PLY = makeCanvas(W, H);
  }
  function proj(u, v, P) {
    const ry = P.ry * D2R, rx = P.rx * D2R, y1 = v * Math.cos(rx), z1 = v * Math.sin(rx);
    const x2 = u * Math.cos(ry) + z1 * Math.sin(ry), z2 = -u * Math.sin(ry) + z1 * Math.cos(ry), s = PERSP / (PERSP - z2) * (P.s || 1);
    let x = x2 * s, y = y1 * s;
    if (P.rz) { const c = Math.cos(P.rz * D2R), sn = Math.sin(P.rz * D2R), xx = x * c - y * sn; y = x * sn + y * c; x = xx; }
    return [P.cx + x, P.cy + y];
  }
  const REST = { cx: PCX, cy: PCY, ry: -4, rx: 1, rz: 0, s: 1, a: 1 };
  function phonePose(m) {
    const r = EASE(prog(m, 14.0, 14.8));
    const P = { cx: PCX, cy: PCY + 40 * (1 - r), ry: lerp(-12, -4, r), rx: lerp(4, 1, r), rz: 0, s: 1, a: EASE(prog(m, 14.0, 14.32)) };
    const d = sst(15.45, 16.3, m); P.ry += 1.6 * d; P.cy -= 6 * d;        // idle float once the reference is out
    // 16.0–16.62: the chip leaves it (→ the search pill) and the phone tips back, sinking into the lower half under the
    // pill (P15 stays a full frame: question above, the answer's screen below); 18.0–18.42 it falls out with the pill.
    const k = EASE(prog(m, 16.0, 16.62)), f = prog(m, 18.0, 18.42);
    P.cx += (PARK.cx - PCX) * k; P.cy += (PARK.cy - PCY) * k; P.ry += PARK.ry * k; P.rx += PARK.rx * k; P.rz = PARK.rz * k; P.s = lerp(1, PARK.s, k);
    P.cy -= 8 * sst(16.62, 18.0, m);                                       // a slow float while « baskets » is typed
    P.cx += 260 * Math.pow(f, 2); P.cy += 1300 * Math.pow(f, 2.2); P.rz += 16 * Math.pow(f, 1.4); P.ry -= 8 * f;
    return P;
  }
  const PARK = { cx: 556, cy: 1392, ry: -6, rx: 4, rz: 5, s: 1.12 };          // P15 pose (deltas for ry / rx from the rest)
  function composeFace(kReal, gl) {
    const g = FACE.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.globalCompositeOperation = 'copy'; g.drawImage(FACE_B, 0, 0); g.globalCompositeOperation = 'source-over';
    if (kReal > 0) { g.globalAlpha = clamp(kReal); g.drawImage(FACE_A, 0, 0); g.globalAlpha = 1; }
    glintOn(g, PW, PH, gl);
  }
  /** the glint on a face canvas g (w × h px): a soft sheen band + a thin bright streak; scaled with the face width */
  function glintOn(g, w, h, gl) {
    if (!(gl > 0 && gl < 1)) return;
    const e = eInOutCubic(gl), k = w / PW;
    g.save(); g.globalCompositeOperation = 'source-atop'; g.translate(w / 2, h / 2); g.rotate(24 * D2R); g.scale(k, k);
    const c = lerp(-620, 620, e);
    let gr = g.createLinearGradient(c - 170, 0, c + 170, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(236,232,255,.10)'); gr.addColorStop(.5, 'rgba(255,255,255,.34)'); gr.addColorStop(.58, 'rgba(236,232,255,.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-900, -900, 1800, 1800);
    gr = g.createLinearGradient(c + 70, 0, c + 110, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-900, -900, 1800, 1800);
    g.restore();
  }
  /** a face canvas (drawn size = its pixel size, centred on hw, hh) projected in strips at pose P, into the PLY layer */
  function phonePlane(P, face = FACE, hw = PW / 2, hh = PH / 2) {
    const g = PLY.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.imageSmoothingQuality = 'high';
    const N = 80, fw = face.width, fh = face.height, sw = fw / N;
    for (let i = 0; i < N; i++) {
      const u0 = -hw + i * sw, u1 = u0 + sw, TL = proj(u0, -hh, P), TR = proj(u1, -hh, P), BL = proj(u0, -hh + fh, P);
      g.setTransform((TR[0] - TL[0]) / sw, (TR[1] - TL[1]) / sw, (BL[0] - TL[0]) / fh, (BL[1] - TL[1]) / fh, TL[0], TL[1]);
      const ew = Math.min(sw + .8, fw - i * sw); g.drawImage(face, i * sw, 0, ew, fh, 0, 0, ew, fh);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); return PLY;
  }
  function phoneHalo(P, hw = PW / 2, hh = PH / 2) {
    const pts = [proj(-hw, -hh, P), proj(hw, -hh, P), proj(hw, hh, P), proj(-hw, hh, P)];
    ctx.save(); ctx.globalAlpha *= .25 * P.a; ctx.filter = 'blur(40px)'; ctx.fillStyle = COL.halo; ctx.translate(0, 30);
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawPhone(m) {
    if (m < 14.0 || m >= 18.42) return null;
    if (!FACE) buildFaces();
    const P = phonePose(m); if (P.a <= 0) return P;
    composeFace(EASE(prog(m, 15.0, 15.12)), prog(m, 14.6, 15.2));
    phoneHalo(P);
    const L = phonePlane(P); ctx.save(); ctx.globalAlpha *= P.a; ctx.drawImage(L, 0, 0); ctx.restore();
    return P;
  }
  /** the projected rect of bar segment i in the phone at pose P */
  function slotRect(i, P) {
    const uL = BAR_X[i][0] * PSC - PW / 2, uR = BAR_X[i][1] * PSC - PW / 2, vT = BAR_Y[0] * PSC - PH / 2, vB = BAR_Y[1] * PSC - PH / 2, vM = (vT + vB) / 2;
    const L = proj(uL, vM, P), R = proj(uR, vM, P), T = proj((uL + uR) / 2, vT, P), B = proj((uL + uR) / 2, vB, P);
    return { xL: L[0], xR: R[0], y: (L[1] + R[1]) / 2, h: B[1] - T[1] };
  }
  let REF = null;                                                          // the violet reference: the bar's end at rest (never moves)
  function ref() { if (!REF) { const a = slotRect(3, REST), b = slotRect(0, REST); REF = { x: a.xR + 2.5, y: b.y }; } return REF; }

  // ------------------------------------------------------------------------------------------- the four lines → the bar
  const T_HIT = [14.375, 14.5, 14.75, 14.875], T_DEP = [14.2, 14.31, 14.54, 14.67], T_LOCK = 15.0;
  const dotHop = (m, i) => -9 * Math.sin(Math.PI * prog(m, 14.03 + i * .02, 14.27 + i * .02));   // released by the folding paper
  function drawBar(m, P) {
    if (m >= 15.2) return;
    const fade = 1 - sst(15.1, 15.2, m), lockP = m >= T_LOCK ? Math.exp(-(m - T_LOCK) / .045) : 0;
    const R0 = slotRect(0, P), R3 = slotRect(3, P), ta = sst(14.12, 14.26, m) * (1 - sst(15.0, 15.06, m)) * P.a;
    if (ta > 0) capsule(R0.xL + R0.h / 2, R0.y, R3.xR - R3.h / 2, R3.y, R0.h, 'rgba(13,13,18,.075)', ta);     // the empty slot
    for (let i = 0; i < 4; i++) {
      const R = slotRect(i, P), h = R.h, y0 = ROW_C[i] + dotHop(m, i);
      if (m < T_DEP[i]) {                                                  // waiting in the margin: a breath before take-off
        const pre = sst(T_DEP[i] - .08, T_DEP[i], m), r = 10 * (1 + .12 * Math.sin(Math.PI * prog(m, 14.03, 14.27)));
        ctx.save(); ctx.fillStyle = DOT_COL[i]; ctx.beginPath(); ctx.ellipse(DOT_X - 2 * pre, y0, r * (1 - .1 * pre), r * (1 + .12 * pre), 0, 0, 7); ctx.fill(); ctx.restore();
        continue;
      }
      if (m < T_HIT[i]) {                                                  // the elastic flight: head leads, tail catches up on the hit
        const x = (m - T_DEP[i]) / (T_HIT[i] - T_DEP[i]), ph = Math.pow(x, 1.7), pt = Math.pow(clamp((x - .24) / .76), 1.7);
        const H3 = [R.xR - h / 2, R.y], T3 = [R.xL + h / 2, R.y], P0 = [DOT_X, y0], P1 = [DOT_X + 80, y0 - 70];
        const hd = bez(P0, P1, [H3[0] - 170, R.y], H3, ph), tl = bez(P0, P1, [T3[0] - 170, R.y], T3, pt);
        const th = lerp(20, h, x) * lerp(1, .74, Math.sin(Math.PI * x));
        capsule(tl[0], tl[1], hd[0], hd[1], th, mix(DOT_COL[i], SEG_COL[i], x));
        continue;
      }
      const tau = m - T_HIT[i], sq = Math.exp(-tau / .03);                 // landed: squash on the hit
      let xr = R.xR - h / 2;
      if (i === 3 && m < T_LOCK) xr += 26 * Math.exp(-tau / .05) * Math.sin(Math.PI * tau / .0625);   // the end overshoots the reference, comes back
      capsule(R.xL + h / 2, R.y, xr, R.y, h * (1 + .5 * sq) * (1 + .22 * lockP), SEG_COL[i], fade);
    }
  }
  /** the due rule: rides the fold, retracts into a point at the bar's end, stands up as the reference, locks, goes out at 15.5 */
  function drawRuleMain(m) {
    if (m >= 15.56) return;
    if (m < 14.27) { const r = ruleOnFold(foldTheta(m, 14.0)); ctx.fillStyle = VIO; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); return; }
    const R = ref(), r0 = ruleOnFold(Math.PI / 2), e1 = EASE(prog(m, 14.27, 14.5)), e2 = EASE(prog(m, 14.45, 14.62));
    const lock = m >= T_LOCK ? Math.exp(-(m - T_LOCK) / .06) : 0, a = 1 - sst(15.44, 15.54, m);
    const cx = lerp((r0.x0 + r0.x1) / 2, R.x, e1), cy = lerp((r0.y0 + r0.y1) / 2, R.y, e1), hw = lerp((r0.x1 - r0.x0) / 2, 1.5, e1), th = lerp(r0.y1 - r0.y0, 3, e1);
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = VIO;
    if (e2 <= 0) ctx.fillRect(cx - hw, cy - th / 2, 2 * hw, th);
    else { const hl = lerp(1.5, 27, e2), w = 3 + 3 * lock; if (lock > .02) { ctx.shadowColor = VIO; ctx.shadowBlur = 20 * lock; } ctx.fillRect(R.x - w / 2, R.y - hl, w, 2 * hl); }
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- texts
  /** a line of coloured parts that pops in (1.15 / 1.06 → 1, 4 frames, EASE) and leaves by the top on `exit` */
  function popParts(m, t0, parts, x, base, size, exit) {
    if (m < t0) return;
    const tw = parts.reduce((s, p) => s + satW(p[0], size, 900), 0), s = popS(m, t0, tw > 600 ? 1.06 : 1.15), aIn = clamp((m - t0) / (2 * F) + .5);
    let dy = 0, aOut = 1; if (exit != null && m >= exit - F) { const k = EASE(prog(m + F, exit, exit + .26)); dy = -70 * k; aOut = 1 - k; }
    const a = aIn * aOut; if (a <= .003) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, base + dy); ctx.scale(s, s);
    let xx = 0; for (const [str, col] of parts) { sat(str, xx, 0, { size, w: 900, color: col }); xx += satW(str, size, 900); }
    ctx.restore();
  }
  // ------------------------------------------------------------------------------------------- the chip → the real search pill (C2)
  // 15.0 the chip « Exemple · estimation » is laid on the phone's frosted band. 16.0 (match cut) the phone tips back and
  // sinks under it; the chip stays: it stretches into the real search pill (x 142–938, y 700–797) while the capture
  // fades in under the caret; « baskets » is typed on the 16ths 16.0 → 16.75; 18.0–18.3 the pill drops (y +40) and fades.
  const PILL_SC = 796 / 1680, PILL_X = 142 - 12 * PILL_SC, PILL_Y = 700 - 12 * PILL_SC, PILL_CX = 540, PILL_CY = 748.5;
  const TYPED_R = [171, 194, 218, 241, 266, 291, 307, 327];                // right edge of the typed text per image (img px)
  let PILLC = null, CHIP16 = null;
  // the chip stays inside the phone's screen (≈ 367 of its 400 px) even at its pop: 340 px (33 px text) × 1.06 = 360 px
  const CHIP_W = 340, CHIP_H = 50, CHIP_FS = 33, CHIP_POP = 1.06;
  function buildPills() {
    PILLC = [];
    for (let k = 0; k < 8; k++) { const I = IMGK('cap/C2p_' + k), c = makeCanvas(Math.ceil(1704 * PILL_SC) + 2, Math.ceil(228 * PILL_SC) + 2), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; if (I) g.drawImage(I, PILL_X % 1, PILL_Y % 1, 1704 * PILL_SC, 228 * PILL_SC); PILLC.push(c); }
  }
  function chipShape(w, h, fill, sh) {
    ctx.save(); ctx.shadowColor = `rgba(13,13,18,${sh[0]})`; ctx.shadowBlur = sh[1]; ctx.shadowOffsetY = sh[2]; ctx.fillStyle = fill; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
  }
  function chipAndPill(m, P) {
    if (m < 15.0 || m >= 18.32) return;
    if (m < 16.0) {                                                        // on the phone
      if (!P) return; const s = popS(m, 15.0, CHIP_POP), a = clamp((m - 15) / (2 * F) + .5) * P.a, c = proj(0, 765 - PCY, P);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(c[0], c[1]); ctx.rotate(P.rz * D2R); ctx.scale(s, s);
      chipShape(CHIP_W, CHIP_H, COL.fill, [.10, 20, 6]);
      ctx.strokeStyle = 'rgba(13,13,18,.06)'; ctx.lineWidth = 1; rrect(.5 - CHIP_W / 2, .5 - CHIP_H / 2, CHIP_W - 1, CHIP_H - 1, (CHIP_H - 1) / 2); ctx.stroke();
      sat('Exemple · estimation', 0, CHIP_FS * .352, { size: CHIP_FS, w: 700, color: COL.ink2, align: 'center' });
      ctx.restore(); return;
    }
    if (!PILLC) buildPills();
    if (!CHIP16) CHIP16 = proj(0, 765 - PCY, phonePose(16.0));
    const e = EASE(prog(m, 16.0, 16.34)), ko = prog(m, 18.0, 18.3), a = 1 - eIn(ko, 1.4); if (a <= .003) return;
    const cx = lerp(CHIP16[0], PILL_CX, e), cy = lerp(CHIP16[1], PILL_CY, e) + 40 * eIn(ko, 2), w = lerp(CHIP_W, 796, e), h = lerp(CHIP_H, 97, e), s = w / 796;
    const k = Math.min(7, 1 + Math.floor((m - 16.0) / .125 + 1e-6)), img = sst(16.04, 16.24, m);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy);
    chipShape(w, h, mix(COL.fill, '#FFFFFF', e), [lerp(.10, .09, e), lerp(20, 40, e), lerp(6, 14, e)]);
    const ta = 1 - sst(16.0, 16.1, m); if (ta > 0) sat('Exemple · estimation', 0, CHIP_FS * .352 * (h / CHIP_H), { size: CHIP_FS * (h / CHIP_H), w: 700, color: COL.ink2, align: 'center', a: ta });
    ctx.scale(s, s); ctx.translate(-PILL_CX, -PILL_CY);
    if (img > 0) { ctx.save(); ctx.globalAlpha *= img; ctx.drawImage(PILLC[k], Math.floor(PILL_X), Math.floor(PILL_Y)); ctx.restore(); }
    if (m < 16.8 || ((m - 16.0) % .5) < .25) { ctx.fillStyle = INK; ctx.fillRect(PILL_X + (TYPED_R[k] + 9) * PILL_SC, PILL_Y + 88 * PILL_SC, 2.5, 52 * PILL_SC); }   // caret, blinking on the 8ths
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- the site title (C3 geometry, Satoshi 900 91 px)
  const S91 = 91 / 64;
  const L1 = [['Payez', 81.5625], ['le', 259.09375], ['juste', 321.484375], ['droit.', 466.96875]];
  const L2 = [['Ni', 111.515625], ['plus,', 187.40625], ['ni', 333.65625], ['moins.', 398.03125]];
  const W1 = L1.map(([w, x]) => [w, (x - L1[0][1]) * S91]), W2 = L2.map(([w, x]) => [w, (x - L2[0][1]) * S91]);
  const CEN1 = 540 + (L1[0][1] - 348) * S91, CEN2 = 540 + (L2[0][1] - 348) * S91;
  let BASE1 = null, BASE2 = null;
  function bases() {
    if (BASE1 != null) return; ctx.save(); ctx.font = font(FF.sat, 64, 900); const fa = ctx.measureText('Payez').fontBoundingBoxAscent || 64.7; ctx.restore();
    BASE1 = 540 + (-8 + fa) * S91; BASE2 = BASE1 + 64 * S91;
  }
  let GL = null;
  /** a word group revealed with the site motion: y 14 → 0 in 0.6 s (EASE), opacity, and a soft left-to-right mask */
  function wordGroup(words, x0, base, color, tau, sc = 1) {                // sc: the card's title scale (1 → TS)
    if (tau == null || tau <= 0) return;
    const dy = 14 * (1 - EASE(clamp(tau / .6))), a = EASE(clamp(tau / .45)), r = EASE(clamp(tau / .5));
    const draw = () => { for (const [w, ox] of words) sat(w, x0 + ox * sc, base + dy, { size: 91 * sc, w: 900, color }); };
    if (r >= .999 && a >= .999) { draw(); return; }
    if (!GL) GL = makeCanvas(W, 260);
    const g = GL.getContext('2d'), top = base - 130; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, 260);
    swap(g, () => { ctx.translate(0, -top); draw(); }); g.setTransform(1, 0, 0, 1, 0, 0);
    const last = words[words.length - 1], gx0 = x0 + words[0][1] * sc - 10, gx1 = x0 + last[1] * sc + satW(last[0], 91 * sc, 900) + 10, FE = 220, e = gx0 + r * (gx1 - gx0 + FE);
    g.globalCompositeOperation = 'destination-in'; const gr = g.createLinearGradient(e - FE, 0, e, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 260); g.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(GL, 0, top); ctx.restore();
  }
  function titleLines(x1, b1, taus1, x2, b2, taus2, s1 = 1, s2 = 1) {
    wordGroup(W1.slice(0, 2), x1, b1, INK, taus1[0], s1); wordGroup(W1.slice(2), x1, b1, INK, taus1[1], s1);
    if (taus2) { wordGroup(W2.slice(0, 2), x2, b2, GREY, taus2[0], s2); wordGroup(W2.slice(2), x2, b2, GREY, taus2[1], s2); }
  }

  // ------------------------------------------------------------------------------------------- end card
  // Held layout (main 22.0–23.5 = short 1.0–2.5): a left column at x 120 and the product hero bottom-right.
  //   header y 300–404 · title ×TS (98 px) baselines Y1 / Y2 · violet rule · « Bientôt » + the « EN TEST » stamp on its
  //   right · the legal mention (44 px, 4 lines, x 120–470) · the REAL phone (C1a), tilted, cropped by the right edge and
  //   the bottom, with its halo. Below y 1540 only the phone (platform UI zone); nothing essential right of x 780 under y 840.
  const HX = 120 - 28 * 1.43, HY = 300, HS = 1.43;                         // header: the logo box lands on x 120 (as on the site)
  const TS = 1.08, Y1 = 532, Y2 = Y1 + 91 * TS, RULE_Y = 668;              // the title grows from the site's 91 px to 98 px
  const BT = [235.5, 1018], ST_C = [298, 836], LEG_Y = 1146, LEG_DY = 57;  // « Bientôt » centre · stamp centre · legal baseline 1
  const HERO = { cx: 806, cy: 1420, ry: -12, rx: 5, rz: 11 };              // the product hero at rest (face 640 × 1282)
  /** brandPill('light') redrawn so that the logo pieces can hop (identical geometry) */
  function brandLight(x, y, s, dou, offs) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const tw = satW('Bonzini Labs', 44, 700), h = 73;
    drawLogo(58, h / 2, 60, offs ? { offsets: offs } : {});
    sat('Bonzini Labs', 100, h / 2 + 16, { size: 44, w: 700, color: INK });
    if (dou > 0) { const dx = 100 + tw + 18; ctx.save(); ctx.beginPath(); ctx.rect(dx - 4, 0, 400, h); ctx.clip();
      sat('Douane', dx - (1 - EASE(dou)) * 180, h / 2 + 16, { size: 44, w: 500, color: GREY, a: clamp(dou * 2) }); ctx.restore(); }
    ctx.restore();
  }
  /** the balafon logo (E4 · G4 · B4 · E5 on 8ths from t0): the four pieces hop, bottom → top, as the pitch rises */
  function logoHops(t, t0) {
    const o = {}; ['orange', 'wingBot', 'wingTop', 'amber'].forEach((r, i) => {
      const tau = t - (t0 + i * .25); o[r] = [0, tau > 0 && tau < .17 ? -7 * Math.sin(Math.PI * tau / .17) : 0, 0, 1]; });
    return o;
  }
  const LEGAL = ['Estimation · à faire', 'confirmer par un', 'commissionnaire', 'agréé en douane.'];
  function legal(k) {                                                      // k(i) → [alpha, dy]
    LEGAL.forEach((s, i) => { const [a, dy] = k(i); if (a > .003) sat(s, 120, LEG_Y + LEG_DY * i + dy, { size: 44, w: 500, color: COL.ink3, a }); });
  }
  function bientot(tau) {
    if (tau == null || tau < 0) return; const s = popS(tau, 0, 1.15), a = clamp(tau / (2 * F) + .5);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(BT[0], BT[1]); ctx.scale(s, s);
    ctx.fillStyle = INK; rrect(-115.5, -44, 231, 88, 44); ctx.fill();
    sat('Bientôt', 0, 17, { size: 48, w: 700, color: '#FFFFFF', align: 'center' }); ctx.restore();
  }
  const ST_W = 340, ST_H = 120, ST_M = 24;
  let STP = null;
  function buildStamp() {
    STP = {};
    for (const [key, starve] of [['thin', .7], ['full', .3]]) {
      const c = makeCanvas(ST_W + 2 * ST_M, ST_H + 2 * ST_M), g = c.getContext('2d');
      swap(g, () => {
        ctx.strokeStyle = VIO; ctx.lineWidth = 6; rrect(ST_M + 3, ST_M + 3, ST_W - 6, ST_H - 6, 12); ctx.stroke();
        sat('EN TEST', ST_M + ST_W / 2, ST_M + ST_H / 2 + 27.5, { size: 72, w: 900, color: VIO, align: 'center', ls: .015 });
      });
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = starve;
      if (TEX.starve) { g.drawImage(TEX.starve, 0, 0, c.width, c.height); g.globalAlpha = starve * .6; g.drawImage(TEX.starve, 140, 20, 240, 120); g.drawImage(TEX.starve, -60, 60, 300, 150); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      STP[key] = c;
    }
  }
  /** violet ink stamp « EN TEST » (−6°): pressed on the impact frame, the ink spreads in 4 frames, a few specks */
  function stamp(tau) {
    if (tau == null || tau < 0) return; if (!STP) buildStamp();
    const k = clamp(tau / (4 * F)), sc = tau < F ? 1.045 : 1, ox = -(ST_W / 2 + ST_M), oy = -(ST_H / 2 + ST_M), a0 = ctx.globalAlpha;
    ctx.save(); ctx.translate(ST_C[0], ST_C[1]); ctx.rotate(-6 * D2R); ctx.scale(sc, sc); ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = a0 * (1 - k); ctx.drawImage(STP.thin, ox, oy);
    ctx.globalAlpha = a0 * k; ctx.drawImage(STP.full, ox, oy);
    if (k > 0) { ctx.globalAlpha = a0 * .3 * k; ctx.filter = `blur(${(.6 + .8 * k).toFixed(2)}px)`; ctx.drawImage(STP.full, ox, oy); ctx.filter = 'none'; }
    ctx.fillStyle = VIO;
    for (let i = 0; i < 14; i++) {                                         // ink specks thrown by the impact
      const side = hash(i * 7.3), ang = hash(i * 3.1) * Math.PI * 2, rr = 1 + hash(i * 5.7) * 2.2;
      const x = (side - .5) * (ST_W + 40), y = (hash(i * 9.1) > .5 ? 1 : -1) * (ST_H / 2 + 8 + hash(i * 4.4) * 18) + Math.sin(ang) * 6;
      ctx.globalAlpha = a0 * .55 * clamp(tau / (2 * F)); ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  /** the held card breathes: a 1.2 % push about the signature's left edge */
  function breathe(k) { if (k <= 0) return; const s = 1 + .012 * k; ctx.translate(120, 640); ctx.scale(s, s); ctx.translate(-120, -640); }
  // the product hero: the real capture C1a on a 600 px face, in the same true perspective as P14
  const HW = 640, HH = PIH * HW / PIW;
  let HFACE0 = null, HFACE = null;
  function heroFace(gl) {
    if (!HFACE0) { const mk = () => makeCanvas(HW, Math.ceil(HH)); HFACE0 = mk(); HFACE = mk(); const g = HFACE0.getContext('2d'), I = IMGK('cap/C1a_frost'); g.imageSmoothingQuality = 'high'; if (I) g.drawImage(I, 0, 0, HW, HH); }
    if (!(gl > 0 && gl < 1)) return HFACE0;
    const g = HFACE.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'copy'; g.drawImage(HFACE0, 0, 0); g.globalCompositeOperation = 'source-over';
    glintOn(g, HW, HH, gl); return HFACE;
  }
  /** k: entry 0..1 (rises from the bottom right, untwisting, site EASE) · hold: the slow float of the held card · gl: glint */
  function heroPose(k, hold) {
    const u = 1 - EASE(k);
    return { cx: HERO.cx + 250 * u, cy: HERO.cy + 860 * u - 12 * hold, ry: HERO.ry - 10 * u + 1.5 * hold, rx: HERO.rx + 5 * u, rz: HERO.rz + 9 * u - .7 * hold, s: 1, a: 1 };
  }
  function heroPhone(k, hold, gl) {
    if (k <= 0) return; if (!FACE) buildFaces();
    const P = heroPose(k, hold); phoneHalo(P, HW / 2, HH / 2); ctx.drawImage(phonePlane(P, heroFace(gl), HW / 2, HH / 2), 0, 0);
  }
  /** the whole card at master time m (18.0 → 23.5): centred title → module header + product hero → stamp */
  function endCardMain(m) {
    bases();
    const sh = shakeAt(m, 21.5); ctx.save(); ctx.translate(sh[0], sh[1]);
    ctx.fillStyle = BG; ctx.fillRect(-20, -20, W + 40, H + 40);
    const hold = sst(21.0, 23.5, m); breathe(hold);
    heroPhone(prog(m, 20.0, 20.85), hold, prog(m, 20.6, 21.2));
    const e = EASE(prog(m, 20.0, 20.5)), e1 = EASE(prog(m, 20.0, 20.5)), e2 = EASE(prog(m, 20.05, 20.55));
    brandLight(lerp(120, HX, e), lerp(272, HY, e), lerp(1, HS, e), prog(m, 20.05, 20.65), logoHops(m, 20.0));
    titleLines(lerp(CEN1, 120, e1), lerp(BASE1, Y1, e1), [m - 18.0, m - 18.5], lerp(CEN2, 120, e2), lerp(BASE2, Y2, e2), [m - 19.0, m - 19.5], lerp(1, TS, e1), lerp(1, TS, e2));
    const rw = 360 * EASE(prog(m, 20.15, 20.6)); if (rw > .5) { ctx.fillStyle = VIO; ctx.fillRect(120, RULE_Y, rw, 2); }
    legal(i => { const t0 = 20.5 + i * .06; return [EASE(prog(m, t0, t0 + .3)), 10 * (1 - EASE(prog(m, t0, t0 + .5)))]; });
    bientot(m - 21.0); stamp(m - 21.5);
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- P19: iris into the dark slot → frame 0
  const SLOT = 880;
  function darkMotes(m) {                                                  // section a's fibres in the light (same formula, m − 24)
    ctx.save(); ctx.fillStyle = '#FFF6E6';
    for (let i = 0; i < 16; i++) {
      const bx = hash(i * 3.3) * W, by = hash(i * 5.9) * 860, vy = 6 + hash(i * 7.1) * 12;
      const y = ((by - m * vy) % 860 + 860) % 860, x = bx + Math.sin(m * .7 + i) * 10;
      ctx.globalAlpha = (.05 + .1 * hash(i * 9.7)) * (.6 + .4 * Math.sin(m * 2.1 + i * 1.7));
      ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i * 2.2) * 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function darkWorld(m, top) {
    ctx.fillStyle = COL.dark; ctx.fillRect(-60, -60, W + 120, H + 120);
    let g = ctx.createRadialGradient(540, 470, 0, 540, 470, 980); g.addColorStop(0, 'rgba(255,246,228,.055)'); g.addColorStop(1, 'rgba(255,246,228,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120);
    darkMotes(m - 24);
    if (top < SLOT) {                                                      // the blank receipt tip (frame 0's paper, nothing printed)
      receiptPaper(Math.max(top, -80), SLOT + 24, { seed: 3 });
      if (top + 78 < SLOT + 4) { ctx.save(); ctx.fillStyle = 'rgba(13,13,18,.22)'; for (let x = TX; x < PX1 - 40; x += 18) ctx.fillRect(x, top + 78, 10, 2); ctx.restore(); }
      ctx.save(); const yA = Math.max(top + 10, -80);
      g = ctx.createLinearGradient(0, 0, 0, 620); g.addColorStop(0, 'rgba(13,13,18,.16)'); g.addColorStop(1, 'rgba(13,13,18,0)');
      if (yA < 620) { ctx.fillStyle = g; ctx.fillRect(PX0, yA, PX1 - PX0, 620 - yA); }
      ctx.restore();
    }
    ctx.save(); g = ctx.createLinearGradient(0, SLOT - 34, 0, SLOT); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.2)'); ctx.fillStyle = g; ctx.fillRect(PX0, SLOT - 34, PX1 - PX0, 34); ctx.restore();
    printerDark(SLOT, new Array(16).fill(0));
    ctx.fillStyle = 'rgba(247,244,236,.16)'; ctx.fillRect(PX0, SLOT - 4, PX1 - PX0, 5);
    ctx.save(); ctx.translate(540, SLOT + 14); ctx.scale(1, .2);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520); g.addColorStop(0, 'rgba(247,244,236,.07)'); g.addColorStop(1, 'rgba(247,244,236,0)');
    ctx.fillStyle = g; ctx.fillRect(-520, 0, 1040, 520); ctx.restore();
    // the motor spins up: the status LED breathes, a dim playhead runs the 16 steps and arrives on the last one (→ step 1 on f0's TCHAK)
    const pulse = Math.exp(-Math.pow((m - 23.82) / .08, 2));
    // section a's body dressing from 23.5; frame 0's nameplate fades back in on the printer face (f710–719), its backlight at
    // section a's resting hum (.22, lifted by the motor's pulse) — f0's TCHAK then strikes it
    printerPlate(SLOT, { a: EASE(prog(m, 23.7, 23.967)), glow: .22 + .3 * pulse });
    if (pulse > .02) { ctx.save(); ctx.globalAlpha = .7 * pulse; const rg = ctx.createRadialGradient(160, SLOT + 70, 0, 160, SLOT + 70, 46); rg.addColorStop(0, 'rgba(169,71,254,.75)'); rg.addColorStop(1, 'rgba(169,71,254,0)'); ctx.fillStyle = rg; ctx.fillRect(110, SLOT + 20, 100, 100); ctx.restore(); }
    if (m >= 23.75) {
      const p = clamp((m - 23.75) / (23.96 - 23.75)) * 15; ctx.save(); ctx.fillStyle = '#F4F4F6';
      for (let k = 0; k <= Math.floor(p + 1e-6) && k < 16; k++) { ctx.globalAlpha = .45 * Math.exp(-(p - k) * 1.1); ctx.beginPath(); ctx.arc(220 + k * 34, SLOT + 70, 11, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    bodyMotes(m - 24);
  }
  function bodyMotes(m) {                                                  // section a's dust in front of the printer (same formula, m − 24)
    ctx.save(); ctx.fillStyle = '#FFF6E6';
    for (let i = 0; i < 14; i++) {
      const bx = 150 + hash(i * 4.7 + 1) * 780, by = hash(i * 6.3 + 2) * 300, vy = 4 + hash(i * 8.9) * 8;
      const y = SLOT + 14 + ((by - m * vy) % 300 + 300) % 300, x = bx + Math.sin(m * .6 + i * 2.3) * 12, d = (y - SLOT) / 300;
      ctx.globalAlpha = (.06 + .12 * hash(i * 9.1)) * Math.exp(-d * 2.4) * (.6 + .4 * Math.sin(m * 1.9 + i * 1.3)) * Math.min(1, d * 8);
      ctx.beginPath(); ctx.arc(x, y, 1 + hash(i * 2.9) * 1.4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function irisEnd(m, n) {
    const k = Math.pow(prog(m, 23.5, 23.8), 1.35), top = m >= 23.8 ? lerp(SLOT, 420, EASE(prog(m, 23.8, 23.967))) : 9999;
    darkWorld(m, top);
    const cy = 885, rx = lerp(780, 440, k), ry = lerp(1440, 0, k);         // k = 0 just covers the frame; k = 1 is the slot's lips
    if (ry > .4) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(540, cy, rx, ry, 0, 0, 7); ctx.clip();
      const sc = lerp(1, .9, k); ctx.translate(540, 885); ctx.scale(sc, sc); ctx.translate(-540, -885);
      endCardMain(23.49);
      ctx.restore();
      if (k > .6) { ctx.save(); ctx.globalAlpha = .5 * sst(.6, .9, k) * (1 - sst(.95, 1, k)); ctx.strokeStyle = VIO; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(540, cy, rx, ry, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); if (ry > .4) ctx.ellipse(540, cy, rx, ry, 0, 0, 7); ctx.clip('evenodd');   // the dark world only
    filmGrain(n, .02); ctx.restore();                                      // (no top-left pill in the dark world: the brand is the plate)
  }

  // ------------------------------------------------------------------------------------------- the short cut's end card (SHORTEND 0..2.5)
  let NIW = null;
  function niMorph(s) {                                                    // « Ni plus. » / « Ni moins. » (140) → « Ni plus, ni moins. » (91·TS, grey)
    if (!NIW) { const wNi = satW('Ni ', 140, 900); NIW = [
      { a: 'Ni', x: 120, b: 465, c: INK, z: 'Ni', l: 0 }, { a: 'plus.', x: 120 + wNi, b: 465, c: INK, z: 'plus,', l: 0 },
      { a: 'Ni', x: 120, b: 605, c: GREY, z: 'ni', l: 1 }, { a: 'moins.', x: 120 + wNi, b: 605, c: GREY, z: 'moins.', l: 1 }]; }
    // line 2 slides right and shrinks first (it frees the baseline), line 1 shrinks in place, then drops onto it
    const e2 = EASE(prog(s + F, 0, .2)), eS = EASE(prog(s + F, 0, .2)), eB = EASE(prog(s + F, .05, .3)), tb = Y2;   // collision-free
    NIW.forEach((w, i) => {
      const ex = w.l ? e2 : eS, eb = w.l ? e2 : eB, e = w.l ? e2 : Math.min(eS, eB + .35);
      const x = lerp(w.x, 120 + W2[i][1] * TS, ex), b = lerp(w.b, tb, eb), size = lerp(140, 91 * TS, ex), color = mix(w.c, GREY, w.l ? 1 : eB);
      if (w.a === w.z) sat(w.a, x, b, { size, w: 900, color });
      else { const sw = sst(.3, .7, e); if (sw < 1) sat(w.a, x, b, { size, w: 900, color, a: 1 - sw }); if (sw > 0) sat(w.z, x, b, { size, w: 900, color, a: sw }); }
    });
  }
  function shortEnd(s, n) {
    bases(); if (!TK_DOT) TK_DOT = buildTicket(true);
    const sh = shakeAt(s, 2.0); ctx.save(); ctx.translate(sh[0], sh[1]);
    ctx.fillStyle = BG; ctx.fillRect(-20, -20, W + 40, H + 40);
    const hold = sst(1.0, 2.5, s); breathe(hold);                         // ends where the master card is at 23.5 (0 during the fold)
    legal(i => [sst(0, .4, s - i * .04), 8 * (1 - EASE(prog(s, i * .04, .5 + i * .04)))]);      // from 0, uncovered by the printer and the ticket
    const py = SLOT0 + 900 * eIn(prog(s + F, 0, .42), 2); printerLight(py, 12 + 2 + s);
    const th = foldTheta(s, 0);
    if (s < .27) { drawFold(TK_DOT, th, py); const r = ruleOnFold(th); ctx.fillStyle = VIO; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
    else {                                                                 // the rule, the ticket folded inside it, rises to its place under the signature
      const r0 = ruleOnFold(Math.PI / 2), e = EASE(prog(s, .27, .67)), y = lerp(r0.y0, RULE_Y, e), x0 = lerp(r0.x0, 120, e), x1 = lerp(r0.x1, 480, e);
      ctx.fillStyle = VIO; ctx.fillRect(x0, y, x1 - x0, lerp(r0.y1 - r0.y0, 2, e));
    }
    heroPhone(prog(s, .25, 1.1), hold, prog(s, .85, 1.45));               // the product rises as the printer leaves (master: 20.0)
    const e = EASE(prog(s + F, 0, .5));
    brandLight(lerp(120, HX, e), lerp(272, HY, e), lerp(1, HS, e), prog(s, .5, 1.1), logoHops(s, .5));
    wordGroup(W1.slice(0, 2), 120, Y1, INK, s - .1, TS);                // its line is free once « Ni plus. » has dropped
    wordGroup(W1.slice(2), 120, Y1, INK, s - .5, TS);
    if (s < .56) niMorph(s); else { for (const [w, ox] of W2) sat(w, 120 + ox * TS, Y2, { size: 91 * TS, w: 900, color: GREY }); }
    bientot(s - 1.0); stamp(s - 2.0);
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- P14 → P16 (14.0–20.0)
  function realScreens(m, n) {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (m < 14.5) { const py = SLOT0 + 900 * eIn(prog(m + F, 14.0, 14.42), 2); printerLight(py, m); }
    const P = drawPhone(m);
    if (m < 14.27) { if (!TK_NODOT) TK_NODOT = buildTicket(false); drawFold(TK_NODOT, foldTheta(m, 14.0), SLOT0 + 900 * eIn(prog(m + F, 14.0, 14.42), 2)); }
    if (P && m < 15.2) drawBar(m, P);
    drawRuleMain(m);
    chipAndPill(m, P);
    // texts
    if (m < 14.12) {                                                       // « Ni plus. / Ni moins. » are flicked out by the top on the kick (smeared)
      for (let j = 0; j < 4; j++) {
        const k = EASE(prog(m + F - j * F / 8, 14.0, 14.14)); if (k >= .999) continue;
        ctx.save(); ctx.globalAlpha *= (1 - k) / 4 * (j ? 1 : 1); sat('Ni plus.', 120, 465 - 150 * k, { size: 140, w: 900, color: INK }); sat('Ni moins.', 120, 605 - 150 * k, { size: 140, w: 900, color: GREY }); ctx.restore();
      }
    }
    popParts(m, 14.0 + F, [['Douane' + NB + ': combien' + NB + '?', INK]], 120, 426, 88, 16.0);
    popParts(m, 14.5, [['On l' + AP + 'estime…', GREY]], 120, 516, 88, 16.0);
    popParts(m, 15.0, [['avant.', VIO]], 120 + satW('On l' + AP + 'estime… ', 88, 900), 516, 88, 16.0);
    popParts(m, 16.5, [['Avant ', VIO], ['de payer', INK]], 120, 464, 112, 17.85);
    popParts(m, 17.0, [['votre fournisseur.', INK]], 120, 575, 100, 17.85);
    brandLight(120, 272, 1, 0, null);
  }

  registerScene({
    id: 'd_real', z: 50,
    when: t => { if (SHORTEND(t) != null) return true; const m = MT(t); return m >= 14.0 && m < 24.0; },
    draw(t, n) {
      const se = SHORTEND(t); if (se != null) { shortEnd(se, n); return; }
      const m = MT(t);
      if (m < 18.0) { realScreens(m, n); return; }
      if (m < 23.5) {
        endCardMain(m);
        if (m < 18.42) drawPhone(m);                                       // the P15 phone falls out with the pill (18.0–18.42)
        if (m < 18.35) {                                                   // the pill and the P15 lines are still leaving
          chipAndPill(m, null);
          popParts(m, 16.5, [['Avant ', VIO], ['de payer', INK]], 120, 464, 112, 17.85);
          popParts(m, 17.0, [['votre fournisseur.', INK]], 120, 575, 100, 17.85);
        }
        return;
      }
      irisEnd(m, n);
    },
  });
})();
