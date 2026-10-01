'use strict';
// =============================================================================================================
// SECTION c · master 10.0–14.0 s · shots P10–P13 · bars M6–M7
//   P10 10.0–11.5 DROP      : light comes out of the violet cut (vertical wipe, 6 frames, f300–f305, no white flash).
//                             The world turns into the product (#F5F5F7, white printer sliding down to slot y 1100).
//                             The receipt CONTRACTS: everything unknown (« On verra… », the « ??? », texture rows, the
//                             day frieze) crumbles into paper dust that falls out of frame in front of the printer —
//                             nothing goes back into the slot. The four due lines (never smaller) come down from the
//                             top; « Ça, » / « c'est dû. » shrink into the ticket footer (Satoshi 500, 56 px, ink3);
//                             the due rule lands on the cut line at 10.5 (12 px overshoot, settled 10.6).
//                             Labels: 10.0 violet · 10.5 orange + grey · 11.0 gold (Satoshi 700, 64 px).
//   P11 11.5–12.0           : « Ni plus. » (900, 140 px, ink, x 120, baseline 465 → box y 360–500).
//   P12 12.0–13.5 TVA REFUSE: the printer inhales (the ticket recedes 4/8/12 px), the gold row is pulled toward the
//                             slot in jolts on the kicks 12.0 / 12.5 / 13.0: its dot stretches into a drop down the
//                             margin, its label stretches 25 / 45 / 60 % and leans 8°. The other rows shiver 2 px and hold.
//   P13 13.5–14.0 SNAP      : the row springs back (ζ .35, two bounces, exact at f412) + « Ni moins. » (grey #86868F,
//                             baseline 605 → box y 500–640).
// Everything is a pure function of the master time m = MT(t) (the short cut 8.0–12.0 follows automatically).
// Hand-off IN  (f299): b_relance's frozen close-up (slot y 880, violet cut line y 868–872 across the frame).
// Hand-off OUT (f419): light world, white ticket x 120–960 / y 640–1080 standing on the white printer (slot 1100),
//   rows (dot x 160–180, label x 212, dither amounts x 700–780) centred at y 700 / 784 / 868 / 952, footer
//   « Ça, c'est dû. » baseline 1048, merged violet rule y 1066–1070 x 160–920, « Ni plus. » / « Ni moins. », ink pill.
//   The white printer carries the brand nameplate of the dark printer (printerPlate), debossed in light: it rides the
//   printer from slot 880 to 1100 (plate centre y 1170 → 1390) and leaves with it in section d (same helper there).
// =============================================================================================================
/** the dark printer's nameplate (printerPlate, 00_core) restyled for the white product printer: a debossed well, the
 *  real logo, « Bonzini Labs » in a quiet grey. Global so that section d draws the same plate on the same printer. */
function printerPlateLight(slotY, o = {}) {
  const a = o.a ?? 1; if (a <= 0) return; const s = o.scale ?? .86, y = slotY + PLATE_DY;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(540, y); ctx.scale(s, s);
  const tw = satW('Bonzini Labs', 64, 700), w = 96 + 22 + tw, x0 = -w / 2, rx = x0 - 44, rw = w + 88;
  ctx.fillStyle = 'rgba(13,13,18,.022)'; rrect(rx, -62, rw, 124, 62); ctx.fill();
  ctx.save(); rrect(rx, -62, rw, 124, 62); ctx.clip();                       // inset shade on the upper lip
  ctx.shadowColor = 'rgba(13,13,18,.10)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.rect(rx - 60, -130, rw + 120, 260);                    // a frame around the well (its hole = the well)
  ctx.moveTo(rx + 62, -62); ctx.arcTo(rx + rw, -62, rx + rw, 62, 62); ctx.arcTo(rx + rw, 62, rx, 62, 62); ctx.arcTo(rx, 62, rx, -62, 62); ctx.arcTo(rx, -62, rx + rw, -62, 62); ctx.closePath();
  ctx.fill('evenodd'); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(rx - 4, 10, rw + 8, 60); ctx.clip();        // light caught by the lower lip
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; rrect(rx, -61, rw, 124, 62); ctx.stroke(); ctx.restore();
  drawLogo(x0 + 48, 0, 96);
  sat('Bonzini Labs', x0 + 96 + 22, 24.5, { size: 64, w: 700, color: '#FFFFFF' });          // embossed edge
  sat('Bonzini Labs', x0 + 96 + 22, 23, { size: 64, w: 700, color: '#9C9CA5' });
  ctx.restore();
}
(() => {
  const F = 1 / 30, AP = '’', TX = 160, PX0 = 120, PX1 = 960;
  const INK = COL.ink, GREY = COL.mute, ORG = COL.orange, GOLD = COL.gold, VIO = COL.violet;
  const DOT_COL = [VIO, ORG, GOLD, '#B9B9C2'];
  const LABEL = ['Droit de douane', 'Accises', 'TVA et centimes', 'Autres taxes'];
  const BARS = [['Droit', 'de', 'douane'], ['Accises'], ['TVA', 'et', 'centimes'], ['Autres', 'taxes']];
  const AMT = [[24, 48], [16, 48], [24, 48], [36]];                       // dithered « ▒▒ ▒▒▒ » groups, right-aligned at x 780

  // ------------------------------------------------------------------------------------------- timing
  const T_DROP = 10.0, T_LAND = 10.5;
  const T_LBL = [10.0, 10.5, 11.0, 10.5];                                 // f300 · f315 (orange + grey together) · f330
  const T_NIPLUS = 11.5, KICKS = [12.0, 12.5, 13.0], LEVEL = [1.25, 1.45, 1.6], T_SNAP = 13.5, T_REST = 412 / 30;

  // ------------------------------------------------------------------------------------------- layout (final → start)
  const ROW_C = [700, 784, 868, 952], LBL_X = 212, DOT_X = 170, AMT_X1 = 780, CAPH = 47;
  const FOOT_B = 1048, RULE_Y = 1066, PAPER_T = 640, PAPER_B = 1080, SLOT_END = 1100;
  const D_ROWS = 712;                                                      // rows travel: 712 px (row 4 starts at y 240, above the pill)
  const CD_B0 = 602, RULE_Y0 = 615, GAP_Y0 = 286, STUB_Y0 = 629, STUB_Y1 = 870;
  const D_RULE = RULE_Y - RULE_Y0;                                        // 451 px: the compact ticket's fall (rule 615 → 1066)

  // ------------------------------------------------------------------------------------------- small helpers
  function swap(g, fn) { const s = ctx; ctx = g; try { fn(); } finally { ctx = s; } }
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };
  const sst = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  function invMT(m) {                                                      // master → cut time (for the frozen hand-off frame)
    if ((window.CUT || 'main') === 'main') return m;
    for (const [a, b, m0] of SHORT_MAP) if (m >= m0 && m < m0 + (b - a)) return a + (m - m0);
    return m;
  }

  // ------------------------------------------------------------------------------------------- the contraction
  // 10.05–10.24: the unknown crumbles. 10.12–10.36: « Ça, » / « c'est dû. » shrink into one footer line (in place,
  //   above the due rule). 10.07–10.50: the rows and the torn top edge accelerate down onto it — the ticket closes up —
  //   while from 10.28 the footer + rule fall too (gravity ease-in): everything slams on the cut line on the kick of
  //   10.5, one 12 px overshoot, settled by 10.6.
  const FA0 = 10.12, FA1 = 10.36, RA0 = 10.07, RP = 1.8, B0 = 10.28, BP = 1.7;
  const BA = 35.9;                                                         // landing bump: 12 px peak at +19 ms, ≈0 at +100 ms
  const bump = tau => (tau <= 0 || tau >= .1) ? 0 : BA * Math.exp(-tau / .025) * Math.sin(Math.PI * tau / .075);
  const sine = x => .5 - .5 * Math.cos(Math.PI * clamp(x));
  const fallB = m => m <= B0 ? 0 : m < T_LAND ? D_RULE * Math.pow((m - B0) / (T_LAND - B0), BP) : D_RULE + bump(m - T_LAND);
  const rowsY = m => m <= RA0 ? 0 : m < T_LAND ? D_ROWS * Math.pow((m - RA0) / (T_LAND - RA0), RP) : D_ROWS + bump(m - T_LAND);   // rows + torn top edge
  const footG = m => sine((m - FA0) / (FA1 - FA0));                         // footer formation progress
  const vel = (f, m) => (f(m + .004) - f(m - .004)) / .008;
  const slotY = m => lerp(880, SLOT_END, EASE(prog(m, T_DROP, 10.4)));
  function cutLine(m) {
    const e = EASE(prog(m, T_DROP, 10.42));
    return { y: lerp(868, RULE_Y, e) + (m >= T_LAND ? bump(m - T_LAND) : 0), x0: lerp(0, TX, e), x1: lerp(W, 920, e) };
  }
  function tReach(y) {                                                     // when the ticket's bottom edge reaches y
    if (y <= STUB_Y0) return B0; let a = B0, b = T_LAND;
    for (let i = 0; i < 30; i++) { const c = (a + b) / 2; if (STUB_Y0 + fallB(c) >= y) b = c; else a = c; }
    return b;
  }

  // ------------------------------------------------------------------------------------------- « la TVA refuse »
  function pullLevel(m) {                                                  // label scaleY (1 → 1.25 → 1.45 → 1.6, then snap back)
    if (m < KICKS[0]) return 1;
    if (m >= T_REST) return 1;
    if (m >= T_SNAP) {
      let s0 = 1; for (let i = 0; i < 3; i++) s0 += (LEVEL[i] - (i ? LEVEL[i - 1] : 1)) * spring(T_SNAP - KICKS[i], 34, .42);
      s0 += .02 * clamp((T_SNAP - KICKS[2]) / .5);
      return 1 + (s0 - 1) * (1 - springTo(m, T_SNAP, 43, .35));
    }
    let s = 1;
    for (let i = 0; i < 3; i++) if (m >= KICKS[i]) s += (LEVEL[i] - (i ? LEVEL[i - 1] : 1)) * spring(m - KICKS[i], 34, .42);
    const last = KICKS.filter(k => m >= k).pop();
    return s + .02 * clamp((m - last) / .5);                               // tension creeps between the kicks
  }
  const recede = m => 20 * (pullLevel(m) - 1);                             // the printer inhales: the ticket recedes 5 / 9 / 12 px
  function shiver(i, m, n) {                                               // the three other rows: ±2 px, they hold
    if (m < KICKS[0] || m >= T_SNAP) return [0, 0];
    const last = KICKS.filter(k => m >= k).pop(), env = .55 + .45 * Math.exp(-(m - last) * 9);
    return [(hash(n * 3.17 + i * 11.3) - .5) * 4 * env, (hash(n * 5.71 + i * 7.9) - .5) * 4 * env];
  }

  // ------------------------------------------------------------------------------------------- sprites: the unknown
  let CL = null, STUB = null, GAP = null, CRUMBS = null, MOTES = null, FROZ = null, TMP = null, TK = null, SB = null, PB = null, LB = null;
  const CS = 7;
  function paperNoise(w, h, seed) {
    for (let i = 0; i < w * h / 260; i++) { ctx.fillStyle = `rgba(13,13,18,${.03 + hash(i * .7 + seed) * .04})`; ctx.fillRect(Math.floor(hash(i * 1.3 + seed) * w), Math.floor(hash(i * 2.9 + seed) * h), 1, 1); }
  }
  function textureRowInk(y, seed) {                                        // « ▬▬ ▬ ……… ??? » (thermal row), drawn in sprite coords
    const w1 = 150 + hash(seed * 3.1) * 120, w2 = 60 + hash(seed * 5.7) * 70, x0 = TX - PX0;
    ctx.fillStyle = 'rgba(110,110,120,.62)'; rrect(x0, y + 21, w1, 20, 7); ctx.fill(); rrect(x0 + w1 + 14, y + 21, w2, 20, 7); ctx.fill();
    for (let x = x0 + w1 + w2 + 34; x < 700 - PX0 - 16; x += 14) ctx.fillRect(x, y + 40, 5, 5);
    qMarks(700 - PX0, y + 46, { size: 44, w: 700, color: ORG, ls: .02 });
  }
  function buildSprites() {
    const w = PX1 - PX0, h = STUB_Y1 - STUB_Y0;
    // the stub = the receipt under « c'est dû. », cut at the slot: « On verra… » + the day frieze (all unknown)
    STUB = makeCanvas(w, h);
    swap(STUB.getContext('2d'), () => {
      ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, w, h); paperNoise(w, h, 3.3);
      sat('On verra…', TX - PX0, 740 - STUB_Y0, { size: 120, w: 900, color: GREY });
      const y0 = 762 - STUB_Y0, FB = 56, FP = 66, bx = k => (k < 5 ? TX + k * FP : 510 + (k - 5) * FP) - PX0;
      sat('franchise', 510 - PX0, y0 + 46, { size: 44, w: 500, color: GREY });
      for (let k = 0; k < 8; k++) { ctx.fillStyle = k < 5 ? GOLD : ORG; rrect(bx(k), y0 + 60, FB, 52, 9); ctx.fill(); }
      ctx.fillStyle = INK; ctx.fillRect(496 - PX0 - 1.5, y0 + 6, 3, h - y0 - 6);
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(.1, 'rgba(0,0,0,0)'); g.addColorStop(.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    // the texture row printed between the due rows and « Ça, » (ink only: the ticket paper under it stays)
    GAP = makeCanvas(w, 64);
    swap(GAP.getContext('2d'), () => textureRowInk(0, 41));
    // the gold label, for the « taffy » stretch (baseline at y 70 → cap top ≈ 23)
    LB = makeCanvas(520, 96);
    swap(LB.getContext('2d'), () => sat(LABEL[2], 4, 70, { size: 64, w: 700, color: INK, ls: -.02 }));
    // crumbs: one per 10 px cell. Ink cells break into crumbs (+ a mote of dust); bare paper dissolves on the spot.
    CRUMBS = []; MOTES = [];
    const P = rgb(COL.paper);
    const addCells = (img, cw, ch, kind) => {
      const d = img.getContext('2d').getImageData(0, 0, cw, ch).data;
      for (let sy = 0; sy < ch; sy += CS) for (let sx = 0; sx < cw; sx += CS) {
        let ink = 0, r = 0, gg = 0, b = 0, cnt = 0;
        for (let yy = sy; yy < Math.min(ch, sy + CS); yy += 2) for (let xx = sx; xx < Math.min(cw, sx + CS); xx += 2) {
          const o = (yy * cw + xx) * 4, al = d[o + 3];
          const dd = kind === 'gap' ? al : Math.abs(d[o] - P[0]) + Math.abs(d[o + 1] - P[1]) + Math.abs(d[o + 2] - P[2]);
          if (dd > 40) { ink++; r += d[o]; gg += d[o + 1]; b += d[o + 2]; } cnt++;
        }
        const isInk = ink / cnt > .08; if (kind === 'gap' && !isInk) continue;
        const i = CRUMBS.length, h1 = hash(i * 1.37 + 3.1), h2 = hash(i * 2.71 + 9.4), h3 = hash(i * 4.13 + 1.7), h4 = hash(i * 6.07 + 5.5);
        let rel;
        if (kind === 'gap') rel = 10.05 + .07 * h1 + .03 * (sx / cw);
        else rel = Math.min(10.05 + .08 * (sy / ch) + .04 * h1 + .02 * (sx / cw), tReach(STUB_Y0 + sy) - .02);
        const c = { img, sx, sy, kind, ink: isInk, rel, x0: PX0 + sx, y0: (kind === 'gap' ? GAP_Y0 : STUB_Y0) + sy,
          vy: isInk ? 170 + 330 * h2 : 40 + 120 * h2, vx: (h3 - .5) * (isInk ? 260 : 90), w: (h4 - .5) * 7, g: isInk ? 4300 : 900, back: hash(i * 7.31 + 2.2) < .4 };
        CRUMBS.push(c);
        if (isInk && kind === 'stub' && h4 > .7) {
          const col = ink ? `rgb(${Math.round(r / ink)},${Math.round(gg / ink)},${Math.round(b / ink)})` : GREY;
          MOTES.push({ c, col, dx: hash(i * 8.3) * CS, dy: hash(i * 9.1) * CS, vx: c.vx * 1.4 + (hash(i * 3.9) - .5) * 200, vy: c.vy * .5 + 40, g: 1300, r: .9 + hash(i * 7.7) * 1.6, d: .04 + hash(i * 5.3) * .1 });
        }
      }
    };
    addCells(STUB, w, h, 'stub'); addCells(GAP, w, 64, 'gap');
  }
  /** a crumb's screen position at its release (the gap row rides the closing ticket) */
  function crumbStart(c) { return c.kind === 'gap' ? [c.x0, c.y0 + rowsY(c.rel), vel(rowsY, c.rel)] : [c.x0, c.y0, 0]; }

  function drawStubIntact(m) {                                             // behind the ticket; a 4 px jolt on the impact
    const sh = m < T_DROP + 3 * F ? (1 - (m - T_DROP) / (3 * F)) * 4 : 0, ox = sh * Math.cos(1.3), oy = sh * Math.sin(1.3);
    if (m < 10.075) { ctx.drawImage(STUB, PX0 + ox, STUB_Y0 + oy); return; }
    for (const c of CRUMBS) {                                              // cells crack loose: a 1.5 px tremble in the 2 frames before they go
      if (c.kind !== 'stub' || m >= c.rel) continue; const k = m > c.rel - .07 ? 1.5 : 0;
      const jx = k ? (hash(c.sx * .31 + c.sy * .17 + Math.floor(m * 60)) - .5) * 2 * k : 0, jy = k ? (hash(c.sx * .23 + c.sy * .41 + Math.floor(m * 60)) - .5) * 2 * k : 0;
      ctx.drawImage(STUB, c.sx, c.sy, CS, CS, c.x0 + ox + jx, c.y0 + oy + jy, CS, CS);
    }
  }
  function stubShadow(m) {
    if (m > 10.2) return; const k = 1 - sst(10.05, 10.15, m);
    ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = 'rgba(13,13,18,.16)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10; ctx.shadowOffsetX = 10000;
    ctx.fillStyle = '#000'; ctx.fillRect(PX0 - 10000, STUB_Y0, PX1 - PX0, STUB_Y1 - STUB_Y0); ctx.restore();
  }
  function drawGapIntact(m, dy) {
    for (const c of CRUMBS) if (c.kind === 'gap' && m < c.rel) ctx.drawImage(GAP, c.sx, c.sy, CS, CS, c.x0, c.y0 + dy, CS, CS);
  }
  /** the dust falls out of frame: 40 % of the crumbs pass behind the ticket, the rest in front (depth); crumbs still
   *  over the ticket when it lands melt away in 2 frames so the labels land on clean paper */
  function drawCrumbs(m, back, G) {
    if (m < 10.04 || m > 11.45) return;
    if (!CL) CL = makeCanvas(W, H);
    const main = ctx, g = CL.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    swap(g, () => crumbsOn(m, back, G));
    main.save(); main.filter = 'blur(1.1px)'; main.drawImage(CL, 0, 0); main.restore();
  }
  function crumbsOn(m, back, G) {
    const land = sst(10.42, 10.5, m);
    ctx.save();
    for (const c of CRUMBS) {
      if (c.back !== back) continue;
      const tau = m - c.rel; if (tau < 0) continue;
      const [x0, y0, v0] = crumbStart(c), vy = c.vy + v0 * .6;
      const y = y0 + vy * tau + .5 * c.g * tau * tau; if (y > H + 30) continue;
      const over = !back && land > 0 && y > G.top - 10 && y < G.bot ? 1 - land : 1;
      if (c.ink) {
        const a = (c.kind === 'gap' ? 1 - clamp((tau - .12) / .2) : 1 - clamp((tau - .35) / .35)) * over; if (a <= .01) continue;
        const sc = 1 - .55 * clamp(tau / .5), v = Math.max(0, vy + c.g * tau), st = Math.min(14, v / 120), sy = sc * (1 + st / CS), th = c.w * tau;
        const co = Math.cos(th), si = Math.sin(th);
        ctx.globalAlpha = a * Math.sqrt(CS / (CS + st));
        ctx.setTransform(sc * co, sy * si, -sc * si, sy * co, x0 + c.vx * tau + CS / 2, y + CS / 2);
        ctx.drawImage(c.img, c.sx, c.sy, CS, CS, -CS / 2, -CS / 2, CS, CS);
      } else {                                                             // bare paper: dissolves into a puff
        const a = (1 - clamp(tau / .14)) * over; if (a <= .01) continue; const sc = 1 - .6 * clamp(tau / .14);
        ctx.globalAlpha = a; ctx.setTransform(sc, 0, 0, sc, x0 + c.vx * tau + CS / 2, y + CS / 2);
        ctx.drawImage(c.img, c.sx, c.sy, CS, CS, -CS / 2, -CS / 2, CS, CS);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (back) { ctx.restore(); return; }
    for (const p of MOTES) {
      const tau = m - p.c.rel - p.d; if (tau < 0) continue;
      const [x0, y0] = crumbStart(p.c), y = y0 + p.dy + p.vy * tau + .5 * p.g * tau * tau; if (y > H + 20) continue;
      const over = land > 0 && y > G.top - 10 && y < G.bot ? 1 - land : 1;
      const a = .6 * (1 - clamp((tau - .2) / .55)) * over; if (a <= .01) continue;
      const st = Math.min(5, Math.max(0, p.vy + p.g * tau) / 160);
      ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(x0 + p.dx + p.vx * tau, y, p.r, p.r + st);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- the ticket
  function paperPath(top, bot) {
    ctx.beginPath(); ctx.moveTo(PX0, bot); ctx.lineTo(PX0, top + 8);
    for (let x = PX0; x <= PX1; x += 14) ctx.lineTo(x, top + hash(x * .37 + 5) * 9);
    ctx.lineTo(PX1, top + 8); ctx.lineTo(PX1, bot); ctx.closePath();
  }
  function ticketGeom(m) {
    const r = recede(m), dR = rowsY(m), dB = fallB(m);
    return { r, dR, dB, top: PAPER_T - D_ROWS + dR + r, bot: STUB_Y0 + dB + r };
  }
  function ticketShadow(m, G) {                                            // the product shadow (never smeared)
    const w = EASE(prog(m, 10.1, 10.45)), top = Math.max(G.top, -60);
    ctx.save(); ctx.shadowColor = `rgba(13,13,18,${lerp(.16, .09, w)})`; ctx.shadowBlur = lerp(28, 46, w); ctx.shadowOffsetY = lerp(10, 16, w); ctx.shadowOffsetX = 10000;
    ctx.translate(-10000, 0); paperPath(top, G.bot); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const k = sst(10.4, 10.5, m);                                          // contact shade on the printer lip once it stands on it
    if (k > 0) { ctx.save(); ctx.globalAlpha = .55 * k; ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(13,13,18,.3)'; ctx.fillRect(PX0 + 8, G.bot + 1, PX1 - PX0 - 16, 6); ctx.restore(); }
  }
  /** a dithered amount « ▒▒ ▒▒▒ »: an ordered checker of 3 px ink dots, never a digit */
  function amount(x, y, w, h) {
    ctx.fillStyle = 'rgba(13,13,18,.62)';
    for (let yy = 0; yy < h; yy += 4) for (let xx = (yy / 4) % 2 ? 2 : 0; xx < w - 1; xx += 4) ctx.fillRect(x + xx, y + yy, 2.6, 2.6);
  }
  function drawAmounts(i, yc, sy = 1) {
    ctx.save(); ctx.translate(0, yc - 14); if (sy !== 1) ctx.scale(1, sy);
    let ax = AMT_X1; for (const gw of AMT[i].slice().reverse()) { ax -= gw; amount(ax, 0, gw, 28); ax -= 8; }
    ctx.restore();
  }
  function drawRow(i, yc, m) {
    const lt = T_LBL[i], lab = m >= lt;
    if (lab) {                                                             // product dot + label pop on the beat
      const s = lerp(1.5, 1, EASE(clamp((m - lt) / (4 * F)))); ctx.fillStyle = DOT_COL[i];
      ctx.beginPath(); ctx.arc(DOT_X, yc, 10 * s, 0, 7); ctx.fill();
      popText(m, lt, LABEL[i], LBL_X, yc + 24, { size: 64, w: 700, color: INK, ls: -.02, from: 1.15 });
    } else {                                                               // receipt look: ink dot + illegible ink bars
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(DOT_X, yc, 12, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(13,13,18,.84)'; let x = LBL_X;
      for (const wd of BARS[i]) { const ww = satW(wd, 50, 700); rrect(x, yc - 11, ww, 22, 7); ctx.fill(); x += ww + 13; }
    }
    drawAmounts(i, yc);
  }
  /** the gold row pulled toward the slot: taffy label (bottoms stretch most, leaning toward the drop) + a drop down the margin */
  function drawGoldPulled(yc, m, P) {
    const lean = Math.tan((8 * Math.PI / 180) * clamp((P - 1) / .6, -1, 1)), capTop = yc - 23;
    const f = u => u <= 0 ? u : u <= CAPH ? u * (1 + (P - 1) * u / CAPH) : CAPH * P + (u - CAPH) * (2 * P - 1);
    for (let y = 0; y < 96; y += 2) {
      const u0 = y - 23, y0 = f(u0), y1 = f(u0 + 2), dx = -lean * y0 * (.4 + .6 * clamp(u0 / CAPH));
      ctx.drawImage(LB, 0, y, 520, 2, LBL_X - 4 + dx, capTop + y0, 520, Math.max(.5, y1 - y0) + .6);
    }
    drawAmounts(2, yc, P);
    goldDrop(yc, 200 * (P - 1));
  }
  function goldDrop(yc, L) {
    ctx.save(); ctx.fillStyle = GOLD;
    if (L <= .5) {                                                         // the rebound squashes the dot
      const k = clamp(-L / 40); ctx.beginPath(); ctx.ellipse(DOT_X, yc + 3 * k, 10 * (1 + .5 * k), 10 * (1 - .42 * k), 0, 0, 7); ctx.fill(); ctx.restore(); return;
    }
    // a teardrop: thin tail still anchored on the dot's place, a heavy bulb sliding down the margin (clear of row 4's dot)
    const e = clamp(L / 70), P0 = [DOT_X, yc], P1 = [DOT_X - 32 * e, yc + L], C = [DOT_X - 30 * e, yc + L * .3];
    const rt = lerp(10, 3.2, e), rb = lerp(10, 14.5, e);
    const q = s => [(1 - s) * (1 - s) * P0[0] + 2 * (1 - s) * s * C[0] + s * s * P1[0], (1 - s) * (1 - s) * P0[1] + 2 * (1 - s) * s * C[1] + s * s * P1[1]];
    const wd = s => rt + (rb - rt) * Math.pow(s, 1.7);
    const Lp = [], Rp = [];
    for (let k = 0; k <= 28; k++) {
      const s = k / 28, p = q(s), p2 = q(Math.min(1, s + .01)), p1 = q(Math.max(0, s - .01)), tx = p2[0] - p1[0], ty = p2[1] - p1[1], l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l, ny = tx / l, ww = wd(s); Lp.push([p[0] + nx * ww, p[1] + ny * ww]); Rp.push([p[0] - nx * ww, p[1] - ny * ww]);
    }
    ctx.beginPath(); ctx.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) ctx.lineTo(p[0], p[1]); for (let k = Rp.length - 1; k >= 0; k--) ctx.lineTo(Rp[k][0], Rp[k][1]); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(P0[0], P0[1], rt, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(P1[0], P1[1], rb, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawFooterAndRule(m, dy) {
    // « Ça, » + « c'est dû. » (900 / 120 px / ink) → one footer line (500 / 56 px / ink3): « c'est dû. » makes room, then « Ça, » joins it
    const g = footG(m), sz = 120 * Math.pow(56 / 120, sst(0, .85, g)), w5 = sst(.45, .9, g), col = mix(INK, COL.ink3, sst(.3, .9, g));
    const jx = sst(.05, .55, g), jy = sst(.42, .95, g), CA = 'Ça,', CD = 'c' + AP + 'est dû.';
    const wCa = lerp(satW(CA + ' ', sz, 900), satW(CA + ' ', sz, 500), w5);
    const bCD = lerp(CD_B0, FOOT_B - D_RULE, g) + dy, xCD = TX + jx * wCa, bCA = bCD - (1 - jy) * 132 * sz / 120;
    for (const [s, x, b] of [[CA, TX, bCA], [CD, xCD, bCD]]) {
      if (w5 < 1) sat(s, x, b, { size: sz, w: 900, color: col, a: 1 - w5 });
      if (w5 > 0) sat(s, x, b, { size: sz, w: 500, color: col, a: w5 });
    }
    if (m < T_LAND) {                                                      // the due rule: under « c'est dû. », lands on the cut line at 10.5
      const wR = lerp(satW(CD, sz, 900), satW(CD, sz, 500), w5) + 8 * sz / 120;
      ctx.fillStyle = VIO; ctx.fillRect(xCD, RULE_Y0 + dy, wR, 4);
    }
  }
  function drawTicketBody(m, n, G) {                                       // paper + rows (+ the gap row until it crumbles)
    const w = EASE(prog(m, 10.1, 10.45)), top = Math.max(G.top, -60);
    paperPath(top, G.bot); ctx.fillStyle = mix(COL.paper, '#FFFFFF', w); ctx.fill();
    if (w < 1) { ctx.save(); ctx.clip(); ctx.globalAlpha = 1 - w; ctx.fillStyle = ditherPattern(); ctx.fillRect(PX0, top, PX1 - PX0, G.bot - top);
      const g = ctx.createLinearGradient(PX0, 0, PX1, 0); g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(.1, 'rgba(0,0,0,0)'); g.addColorStop(.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
      ctx.fillStyle = g; ctx.fillRect(PX0, top, PX1 - PX0, G.bot - top); ctx.restore(); }
    const inh = clamp((pullLevel(m) - 1) / .6);                            // the slot breathes in: shade on the bottom of the ticket
    if (inh > 0) { ctx.save(); paperPath(top, G.bot); ctx.clip(); const g = ctx.createLinearGradient(0, G.bot - 70, 0, G.bot); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, `rgba(13,13,18,${.08 * inh})`); ctx.fillStyle = g; ctx.fillRect(PX0, G.bot - 70, PX1 - PX0, 70); ctx.restore(); }
    drawGapIntact(m, G.dR);
    const P = pullLevel(m);
    for (let i = 0; i < 4; i++) {
      const yc = ROW_C[i] - D_ROWS + G.dR + G.r; if (yc < -60 || yc > H) continue;
      if (i === 2 && P !== 1) drawGoldPulled(yc, m, P);
      else { const [dx, dyy] = shiver(i, m, n); ctx.save(); ctx.translate(dx, dyy); drawRow(i, yc, m); ctx.restore(); }
    }
  }
  /** draw fn into a layer and composite it with a vertical motion smear of Lb px (shutter 180°, exact average) */
  function smeared(Lb, fn) {
    if (Lb < 1.5) { fn(); return; }
    if (!TK) { TK = makeCanvas(W, H); SB = makeCanvas(W, H); }
    const g = TK.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, W, H);
    swap(g, fn);
    const s = SB.getContext('2d'), k = Math.min(18, Math.ceil(Lb / 2.5) + 1);
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1; s.clearRect(0, 0, W, H);
    s.globalCompositeOperation = 'lighter'; s.globalAlpha = 1 / k;
    for (let i = 0; i < k; i++) s.drawImage(TK, 0, (i / (k - 1) - 1) * Lb);   // trailing smear: the sharp copy leads
    s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1;
    ctx.drawImage(SB, 0, 0);
  }

  // ------------------------------------------------------------------------------------------- the white printer
  const BEATS = [10.0, 10.5, 11.0, 12.0, 12.5, 13.0], BEAT_LED = [0, 4, 8, 0, 4, 8];
  function drawPrinter(m) {
    const sy = slotY(m), ly = sy + 70, inh = clamp((pullLevel(m) - 1) / .6);
    ctx.save(); ctx.shadowColor = 'rgba(13,13,18,.12)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    ctx.fillStyle = COL.card; rrect(60, sy, W - 120, H - sy + 60, 28); ctx.fill(); ctx.restore();
    ctx.save(); rrect(60, sy, W - 120, H - sy + 60, 28); ctx.clip();      // body: soft top-light falloff, a lip, one panel seam
    let g = ctx.createLinearGradient(0, sy, 0, H); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.035)'); ctx.fillStyle = g; ctx.fillRect(60, sy, W - 120, H - sy);
    g = ctx.createLinearGradient(60, 0, W - 60, 0); g.addColorStop(0, 'rgba(13,13,18,.03)'); g.addColorStop(.08, 'rgba(13,13,18,0)'); g.addColorStop(.92, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.035)'); ctx.fillStyle = g; ctx.fillRect(60, sy, W - 120, H - sy);
    ctx.fillStyle = 'rgba(13,13,18,.045)'; ctx.fillRect(60, sy + 128, W - 120, 2); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(60, sy + 130, W - 120, 1);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = mix(COL.fill, '#C9C9D1', inh); rrect(110, sy - 6, W - 220, 20, 10); ctx.fill();          // the slot (darker as it inhales)
    ctx.fillStyle = `rgba(13,13,18,${.05 + .08 * inh})`; rrect(110, sy - 6, W - 220, 7, 4); ctx.fill();
    // status LED
    ctx.fillStyle = VIO; ctx.shadowColor = VIO; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(160, ly, 11, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    // 16 step LEDs: violet on 1 · 5 · 9, a violet ring on 13 (empty: the voice fills it), playhead in light grey
    const bt = ((m - T_DROP) % 2 + 2) % 2, sp = Math.floor(bt / .125 + 1e-6);
    let hitK = -1, hitE = 0; BEATS.forEach((b, j) => { if (m >= b && m - b < .5) { hitK = BEAT_LED[j]; hitE = Math.exp(-(m - b) * 9); } });
    const voice = Math.max(env(m, 11.5, 11.95, .03, .25), env(m, 13.5, 13.95, .03, .25));
    for (let k = 0; k < 16; k++) {
      const x = 220 + k * 34;
      if (k === 12) {
        if (voice > 0) { ctx.fillStyle = `rgba(169,71,254,${.28 * voice})`; ctx.beginPath(); ctx.arc(x, ly, 11, 0, 7); ctx.fill(); }
        ctx.strokeStyle = VIO; ctx.lineWidth = 3; ctx.shadowColor = VIO; ctx.shadowBlur = 14 * voice; ctx.beginPath(); ctx.arc(x, ly, 11, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; continue;
      }
      ctx.beginPath(); ctx.arc(x, ly, 11, 0, 7);
      if (k === 0 || k === 4 || k === 8) {
        ctx.fillStyle = VIO; if (k === hitK) { ctx.shadowColor = VIO; ctx.shadowBlur = 22 * hitE; } ctx.fill(); ctx.shadowBlur = 0;
        if (k === hitK && hitE > .02) { ctx.fillStyle = `rgba(255,255,255,${.35 * hitE})`; ctx.beginPath(); ctx.arc(x, ly, 5, 0, 7); ctx.fill(); }
      } else { ctx.fillStyle = k === sp ? '#D4D4DB' : COL.fill; ctx.fill(); }
    }
    ctx.restore();
    printerPlateLight(sy);                                                 // the brand on the printer face (quiet, debossed)
  }

  // ------------------------------------------------------------------------------------------- the hand-off (frozen P9) + wipe
  function fallbackFrozen() {                                              // only when section b is not loaded (isolated renders)
    ctx.fillStyle = COL.dark; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#C9C6BE'); g.addColorStop(.5, '#EEEBE3'); g.addColorStop(1, '#D3D0C8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 868);
    for (let i = 0; i < 140; i++) { ctx.fillStyle = `rgba(110,110,120,${.05 + hash(i * 3.3) * .12})`; ctx.fillRect(hash(i * 1.7) * W, 0, 1 + hash(i * 2.1) * 3, 868); }
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 872, W, 34);
    ctx.fillStyle = COL.body; ctx.fillRect(0, 906, W, H - 906);
    for (let k = 0; k < 16; k++) { ctx.fillStyle = k === 11 ? '#F4F4F6' : ORG; ctx.beginPath(); ctx.arc(33 + k * 53.7, 990, 17, 0, 7); ctx.fill(); }
    sat('Et si', 120, 492, { size: 120 }); sat('vous saviez', 120, 612, { size: 120 }); sat('AVANT' + NNBSP + '?', 120, 766, { size: 150, color: VIO });
    brandPill(120, 272, { mode: 'dark' });
    ctx.fillStyle = VIO; ctx.fillRect(0, 868, W, 4);
  }
  function frozen() {
    if (FROZ) return FROZ; FROZ = makeCanvas(W, H);
    const B = SCENES.find(s => s.id === 'b_relance');
    swap(FROZ.getContext('2d'), () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = COL.dark; ctx.fillRect(0, 0, W, H);
      if (B) { const tp = invMT(299 / 30); ctx.save(); try { B.draw(tp, Math.round(tp * 30)); } catch (e) { fallbackFrozen(); } ctx.restore(); }
      else fallbackFrozen();
    });
    return FROZ;
  }
  /** f300–f305: the light opens out of the cut (the frozen dark frame is pushed away up and down, soft edge, no flash) */
  function wipe(m) {
    const kf = (m - T_DROP) * 30; if (kf >= 5) return;
    const p = Math.pow(clamp((kf + 1) / 6), 2), FE = 34;
    const top = 868 - p * (868 + 2 * FE), bot = 872 + p * (H - 872 + 2 * FE);
    if (!TMP) TMP = makeCanvas(W, H);
    const g = TMP.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'copy'; g.drawImage(frozen(), 0, 0);
    g.globalCompositeOperation = 'destination-out';
    const L = bot - top + 2 * FE, gr = g.createLinearGradient(0, top - FE, 0, bot + FE);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(FE / L, 'rgba(0,0,0,1)'); gr.addColorStop(1 - FE / L, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, top - FE, W, L); g.globalCompositeOperation = 'source-over';
    ctx.drawImage(TMP, 0, 0);
    // the cut opens: its two lips ride the edges of the light, thinning out
    const a = Math.pow(1 - p, .6);
    ctx.save(); ctx.fillStyle = VIO; ctx.globalAlpha = a; ctx.fillRect(0, top - 2, W, 3); ctx.fillRect(0, bot - 1, W, 3); ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- brand pill (light, frosted while paper passes under it)
  function frostLight(x, y, a) {
    const pw = 30 + 56 + 14 + satW('Bonzini Labs', 44, 700) + 34, ph = 73, M = 24;
    if (!PB) PB = makeCanvas(Math.ceil(pw) + 2 * M, ph + 2 * M);
    const g = PB.getContext('2d'); g.clearRect(0, 0, PB.width, PB.height); g.drawImage(ctx.canvas, x - M, y - M, PB.width, PB.height, 0, 0, PB.width, PB.height);
    ctx.save(); rrect(x, y, pw, ph, ph / 2); ctx.clip(); ctx.globalAlpha = a; ctx.filter = 'blur(10px)'; ctx.drawImage(PB, x - M, y - M); ctx.filter = 'none';
    ctx.fillStyle = `rgba(255,255,255,${.9 * a})`; ctx.fillRect(x, y, pw, ph); ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- the scene
  registerScene({
    id: 'c_drop', z: 40,
    when: t => { const m = MT(t); return m >= T_DROP && m < 14.0; },
    draw(t, n) {
      const m = MT(t);
      if (!STUB) buildSprites();
      ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
      const G = ticketGeom(m), sh = .5 / 30;
      ticketShadow(m, G); stubShadow(m);
      drawStubIntact(m);
      drawCrumbs(m, true, G);
      smeared(Math.abs(vel(rowsY, m)) * sh, () => drawTicketBody(m, n, G));
      smeared(Math.abs(vel(fallB, m)) * sh, () => drawFooterAndRule(m, G.dB + G.r));
      // the cut line (rides the printer lip) — the due rule lands on it at 10.5 and they become one rule
      const cl = cutLine(m), pulse = m >= T_LAND ? Math.exp(-(m - T_LAND) * 28) : 0;
      ctx.save(); ctx.fillStyle = VIO;
      if (pulse > .02) { ctx.shadowColor = VIO; ctx.shadowBlur = 16 * pulse; }
      ctx.fillRect(cl.x0, cl.y + G.r - 1.5 * pulse, cl.x1 - cl.x0, 4 + 3 * pulse); ctx.restore();
      drawPrinter(m);
      drawCrumbs(m, false, G);
      // brand pill: ink, its dark pill gone; a light frost only while printed lines slide under it
      const fa = 1 - sst(10.38, 10.47, m); if (fa > .01) frostLight(120, 272, fa);
      brandPill(120, 272, { mode: 'light' });
      // the sung words
      popText(m, T_NIPLUS, 'Ni plus.', 120, 465, { size: 140, w: 900, color: INK });
      popText(m, T_SNAP, 'Ni moins.', 120, 605, { size: 140, w: 900, color: GREY });
      wipe(m);
    },
  });
})();
