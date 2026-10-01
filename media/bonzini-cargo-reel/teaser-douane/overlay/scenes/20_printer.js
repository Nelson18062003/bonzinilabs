'use strict';
// ============================================================================================================
// SECTION A — master 0.0–6.0 s · shots P1–P6 · bars M1–M3 (« Douane : combien ? »)
//   The thermal printer in the dark. The receipt advances by jolts (stepper motor: print, hold, jump 132 px),
//   the newest line always lands at y 748–880, the slot is at y 880. From 4.0 the paper starts to crawl
//   (260 → 520 px/s) between the jolts: only texture rows get motion blur. The 16-step LED strip follows the
//   grid (white = due hits 1·5·9·13, orange = parasitic hits from 4.0, an orange ring builds around step 13).
//   Brand: no top-left pill in the dark printer world (it hid the receipt); the nameplate printerPlate() sits on the
//   printer face (540, 1170) with the body's dressing (mirror of the paper in the bevel, seam, vents, texture).
//   Everything is a pure function of the master time m = MT(t).
// ============================================================================================================
(() => {
  const F = 1 / 30, SLOT = 880, PX0 = 120, PX1 = 960, TX = 160, N = NNBSP, AP = '’';
  const INK = COL.ink, GREY = COL.mute, ORG = COL.orange, GOLD = COL.gold;

  // ---------------------------------------------------------------- paper transport ------------------------------
  // [beat time, advance px, duration in frames, lead in frames]: each jolt starts before the beat so the line is ~90 % out on it
  const JOLTS = [[1.0, 132, 4, 1.5], [1.5, 132, 4, 1.5], [2.0, 66, 3, 1.2], [2.25, 66, 3, 1.2], [2.5, 66, 3, 1.2], [2.75, 66, 3, 1.2],
    [3.0, 132, 4, 1.5], [3.5, 132, 4, 1.5], [4.0, 132, 4, 1.5], [4.5, 132, 4, 1.5], [5.0, 132, 4, 1.5], [5.5, 264, 5, 2]];
  const jStart = j => JOLTS[j][0] - JOLTS[j][3] * F, jEnd = j => jStart(j) + JOLTS[j][2] * F;
  const backOut = x => { const y = x - 1; return 1 + 2 * y * y * y + y * y; };      // stepper jolt, 3.7 % overshoot
  function joltSum(t) {
    let s = 0;
    for (let j = 0; j < JOLTS.length; j++) { const x = (t - jStart(j)) / (JOLTS[j][2] * F); if (x <= 0) break; s += JOLTS[j][1] * (x >= 1 ? 1 : backOut(x)); }
    return s;
  }
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  /** crawl speed between the jolts (P5 speed ramp 260 → 520 px/s, the paper jams on the empty document, stops at 5.42) */
  function vCrawl(t) {
    if (t < 4.1) return 0;
    if (t < 5.0) return lerp(260, 520, (t - 4.1) / .9) * smooth((t - 4.1) / .06);
    if (t < 5.3) return 520;
    return 520 * (1 - smooth((t - 5.3) / .12));
  }
  const CDT = .001, CR = [0];
  for (let i = 1; i <= 2000; i++) CR.push(CR[i - 1] + vCrawl(4 + (i - .5) * CDT) * CDT);
  function crawl(t) { if (t <= 4) return 0; const x = (Math.min(t, 5.999) - 4) / CDT, k = Math.floor(x); return lerp(CR[k], CR[k + 1], x - k); }
  const P = t => joltSum(t) + crawl(t);                                   // total paper advance (px, upward)
  const speed = t => (P(t + .006) - P(t - .006)) / .012;
  const settled = j => JOLTS.slice(0, j + 1).reduce((s, x) => s + x[1], 0) + crawl(jEnd(j));

  // ---------------------------------------------------------------- the receipt, in paper coordinates u -----------
  // screen y = u − P(m). At m = 0 the torn top edge is at u 420 and the two printed lines at 616 / 748.
  const L = [];
  const line = (u, parts, o = {}) => ({ kind: 'text', u, h: 132, parts, size: o.size || 120, t0: o.t0 });
  L.push({ kind: 'hrule', u: 498 });
  L.push(line(616, [['Douane' + N + ':', INK]]));
  L.push(line(748, [['combien' + N + '?', INK]]));
  L.push(line(748 + settled(0), [['On verra…', GREY]], { t0: jStart(0) }));
  L.push(line(748 + settled(1), [['à l' + AP + 'arrivée.', GREY]], { t0: jStart(1) }));
  for (let i = 0; i < 4; i++) L.push({ kind: 'due', i, u: 814 + settled(2 + i), h: 66 });
  L.push(line(748 + settled(6), [['Ça,', INK]], { t0: jStart(6) }));
  const uCD = 748 + settled(7);
  L.push(line(uCD, [['c' + AP + 'est dû.', INK]], { t0: jStart(7) }));
  L.push({ kind: 'duerule', u: uCD + 117 });
  const Q = (w, j, u) => line(u ?? 748 + settled(j), [[w + N, INK], ['?', ORG]], { size: 112, t0: jStart(j) });
  const qCode = Q('Code', 8), qVal = Q('Valeur', 9), qPap = Q('Papiers', 10), qJours = Q('Jours', 11, 616 + settled(11));
  L.push(qCode, qVal, qPap, qJours);
  L.push({ kind: 'frieze', u: qJours.u + 132, h: 132 });
  L.push({ kind: 'doc', u: qPap.u + 132, h: qJours.u - qPap.u - 132 });
  // texture rows fill the crawl gaps: « barre grise ……… ??? », one of them is « SANS DÉTAIL ……… ??? » (4.75)
  function rows(a, b, seed) {
    const G = b - a, n = Math.max(1, Math.round(G / 60)), p = G / n, out = [];
    for (let k = 0; k < n; k++) out.push({ kind: 'row', u: a + k * p, h: p, seed: seed + k, sd: false });
    return out;
  }
  const g1 = rows(qCode.u + 132, qVal.u, 11), g2 = rows(qVal.u + 132, qPap.u, 31);
  { // the row whose label crosses the slot closest to 4.75 s becomes « SANS DÉTAIL »
    let best = null, bd = 1e9;
    for (const r of g2) { let te = 6; for (let t = 4.4; t < 5.4; t += .002) if (r.u + r.h / 2 - P(t) < SLOT - 8) { te = t; break; } if (Math.abs(te - 4.75) < bd) { bd = Math.abs(te - 4.75); best = r; } }
    if (best) best.sd = true;
  }
  L.push(...g1, ...g2);

  // ---------------------------------------------------------------- drawing helpers ------------------------------
  const RH = 64, BB_PAD = 26;
  const _rows = {};
  function rowImage(r) {                                                   // cached, drawn once (deterministic)
    const key = r.sd ? 'sd' : 'r' + r.seed; if (_rows[key]) return _rows[key];
    const c = makeCanvas(1080, RH), keep = ctx; ctx = c.getContext('2d');
    try {
      if (r.sd) textureRow('SANS DÉTAIL', TX, 46, { qx: 700 });
      else {
        const w1 = 120 + hash(r.seed * 3.1) * 150, w2 = hash(r.seed * 7.3) > .45 ? 50 + hash(r.seed * 5.7) * 90 : 0;
        ctx.fillStyle = 'rgba(110,110,120,.55)'; rrect(TX, 21, w1, 20, 7); ctx.fill();
        if (w2) { rrect(TX + w1 + 14, 21, w2, 20, 7); ctx.fill(); }
        const x0 = TX + w1 + (w2 ? w2 + 14 : 0) + 18; ctx.fillStyle = 'rgba(110,110,120,.6)';
        for (let x = x0; x < 700 - 16; x += 14) ctx.fillRect(x, 40, 5, 5);
        qMarks(700, 46, { size: 44, w: 700, color: ORG, ls: .02 });
      }
    } finally { ctx = keep; }
    return (_rows[key] = c);
  }
  let BB = null;
  /** vertical motion smear (180° shutter): average of k shifted copies, exact via 'lighter' + 1/k */
  function smeared(img, y, Lb) {
    if (Lb < 1.5) { ctx.drawImage(img, 0, y); return; }
    if (!BB) BB = makeCanvas(1080, RH + 2 * BB_PAD);
    const g = BB.getContext('2d'), k = Math.min(14, Math.ceil(Lb / 2) + 1);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, 1080, RH + 2 * BB_PAD);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 / k;
    for (let i = 0; i < k; i++) g.drawImage(img, 0, BB_PAD + (i / (k - 1) - .5) * Lb);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    ctx.drawImage(BB, 0, y - BB_PAD);
  }
  /** a bold line (one or two colours), popping 1.15 → 1.0 about its left baseline; the pop never pushes text past x 780 */
  function drawText(it, y, m) {
    if (it.t0 != null && m < it.t0) return;
    const base = y + (it.size >= 120 ? 104 : 102), widths = it.parts.map(p => satW(p[0], it.size, 900));
    const tw = widths.reduce((a, b) => a + b, 0);
    let s = 1; if (it.t0 != null) s = popS(m, it.t0, Math.min(tw > 600 ? 1.06 : 1.15, (780 - TX) / tw));
    ctx.save(); ctx.translate(TX, base); if (s !== 1) ctx.scale(s, s);
    let x = 0; it.parts.forEach((p, i) => { sat(p[0], x, 0, { size: it.size, w: 900, color: p[1] }); x += widths[i]; });
    ctx.restore();
  }
  const DUE_WORDS = [['Droit', 'de', 'douane'], ['Accises'], ['TVA', 'et', 'centimes'], ['Autres', 'taxes']];
  const AMT_G = [[64, 76], [40, 76], [56, 76], [76]];                     // dithered « ▒▒ ▒▒▒ » groups, never digits
  function drawDue(i, y) {                                                 // dot + illegible ink label + dithered amount
    const cy = y + 36;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(TX + 12, cy, 12, 0, 7); ctx.fill();
    let x = TX + 44; ctx.fillStyle = 'rgba(13,13,18,.84)';
    for (const w of DUE_WORDS[i]) { const ww = satW(w, 50, 700); rrect(x, cy - 11, ww, 22, 7); ctx.fill(); x += ww + 13; }
    let ax = 900; for (const gw of AMT_G[i].slice().reverse()) { ax -= gw; ditherAmount(ax, cy - 16, gw, 32); ax -= 16; }
  }
  function drawDueRule(y, m) {                                             // « le trait du dû », traced at 3.75 in 6 frames
    if (m < 3.75) return; const w = satW('c' + AP + 'est dû.', 120, 900) + 8, p = EASE(clamp((m - 3.75) / (6 * F)));
    ctx.fillStyle = COL.violet; ctx.fillRect(TX, y, w * p, 4);
  }
  function drawDoc(y, h) {                                                 // the missing paper: an empty dashed document
    const w = 100, hh = Math.min(124, h - 14), x = TX, top = y + (h - hh) / 2, d = 26;
    ctx.save(); ctx.strokeStyle = 'rgba(13,13,18,.62)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w - d, top); ctx.lineTo(x + w, top + d); ctx.lineTo(x + w, top + hh); ctx.lineTo(x, top + hh); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + w - d, top); ctx.lineTo(x + w - d, top + d); ctx.lineTo(x + w, top + d); ctx.stroke();
    ctx.restore();
  }
  // the day frieze: 8 boxes on the 32nds from 5.5 (taximeter ticks), 5 amber, marker « franchise », 3 orange, the track runs off the paper
  const FB = 56, FP = 66, FMK = 496, TICK = k => 5.5 + k / 16;
  const boxX = k => k < 5 ? TX + k * FP : 510 + (k - 5) * FP;
  function drawFrieze(y, m) {
    const by = y + 60, bh = 52;
    ctx.fillStyle = GOLD; ctx.fillRect(TX, y + 121, FMK - TX, 3);
    ctx.fillStyle = ORG; ctx.fillRect(FMK, y + 121, PX1 - FMK, 3);
    ctx.save(); ctx.strokeStyle = 'rgba(13,13,18,.2)'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) { rrect(boxX(k) + 1, by + 1, FB - 2, bh - 2, 9); ctx.stroke(); }
    ctx.restore();
    for (let k = 0; k < 8; k++) {
      if (m < TICK(k)) continue; const s = lerp(.55, 1, backOut(clamp((m - TICK(k)) / (3 * F)))), cx = boxX(k) + FB / 2, cy = by + bh / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.fillStyle = k < 5 ? GOLD : ORG; rrect(-FB / 2, -bh / 2, FB, bh, 9); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = INK; ctx.fillRect(FMK - 1.5, y + 6, 3, 118);
    sat('franchise', 510, y + 46, { size: 44, w: 500, color: GREY });
  }
  function drawHRule(y) { ctx.save(); ctx.fillStyle = 'rgba(13,13,18,.22)'; for (let x = TX; x < PX1 - 40; x += 18) ctx.fillRect(x, y, 10, 2); ctx.restore(); }

  // ---------------------------------------------------------------- printer LEDs ---------------------------------
  const LX = k => 220 + k * 34, LY = SLOT + 70, DUE_STEPS = [0, 4, 8, 12];
  const INTRUS = [[4.0, [5, 13]], [4.5, [1, 9]], [5.0, [15]]];             // parasitic patterns (orange)
  const TAXI = [2, 3, 6, 7, 10, 11, 14];                                    // lit one per taximeter tick (32nds from 5.5625)
  function ledStates(m) {
    const st = new Array(16).fill(0), bar = Math.floor(m / 2), sp = Math.floor((m - bar * 2) / .125 + 1e-6);
    if (bar === 0) st[0] = 1;                                               // the TCHAK on step 1
    else if (bar === 1) { for (const k of DUE_STEPS) if (sp >= k) st[k] = 1; }
    else {
      for (const k of DUE_STEPS) st[k] = 1;
      for (const [t0, ks] of INTRUS) if (m >= t0) for (const k of ks) st[k] = 2;
      TAXI.forEach((k, i) => { if (m >= TICK(i + 1)) st[k] = 2; });
    }
    return { st, sp, bar };
  }
  function drawLeds(m) {
    const { st, sp, bar } = ledStates(m);
    ctx.save();
    for (let k = 0; k < 16; k++) {
      const x = LX(k);
      if (!st[k]) { if (k === sp) { ctx.strokeStyle = 'rgba(244,244,246,.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, LY, 11, 0, 7); ctx.stroke(); } continue; }
      const fl = k === sp ? 1 - clamp((m - bar * 2 - k * .125) / .125) : 0, col = st[k] === 1 ? '#F4F4F6' : ORG;
      ctx.globalAlpha = .8 + .2 * fl; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10 + 16 * fl;
      ctx.beginPath(); ctx.arc(x, LY, 11, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // step 13 piles up the intruders: one quarter of an orange ring per intruder (4.0 · 4.5 · 5.0 · 5.5)
    [4.0, 4.5, 5.0, 5.5].forEach((t0, i) => {
      if (m < t0) return; const p = EASE(clamp((m - t0) / (3 * F))), a0 = -Math.PI / 2 + i * Math.PI / 2;
      ctx.strokeStyle = ORG; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.shadowColor = ORG; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(LX(12), LY, 17, a0 + .06, a0 + .06 + (Math.PI / 2 - .12) * p); ctx.stroke();
    });
    ctx.restore();
  }
  function drawStatusTalk(m) {                                             // the talking printer (1.0–2.0): the violet LED follows the syllables
    if (m < 1 || m > 2.1) return;
    let e = 0; for (const s of [1.0, 1.125, 1.25, 1.5, 1.625, 1.75, 1.875]) if (m >= s) e = Math.max(e, Math.exp(-(m - s) * 14));
    if (e < .02) return;
    ctx.save(); ctx.globalAlpha = e * .9; const g = ctx.createRadialGradient(160, LY, 0, 160, LY, 46);
    g.addColorStop(0, 'rgba(169,71,254,.75)'); g.addColorStop(1, 'rgba(169,71,254,0)'); ctx.fillStyle = g; ctx.fillRect(110, LY - 50, 100, 100); ctx.restore();
  }

  // ---------------------------------------------------------------- atmosphere -----------------------------------
  function background() {
    ctx.fillStyle = COL.dark; ctx.fillRect(-60, -60, W + 120, H + 120);
    const g = ctx.createRadialGradient(540, 470, 0, 540, 470, 980);
    g.addColorStop(0, 'rgba(255,246,228,.055)'); g.addColorStop(1, 'rgba(255,246,228,0)'); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120);
  }
  function motes(m) {                                                      // a few paper fibres in the light (behind the paper)
    ctx.save(); ctx.fillStyle = '#FFF6E6';
    for (let i = 0; i < 16; i++) {
      const bx = hash(i * 3.3) * W, by = hash(i * 5.9) * 860, vy = 6 + hash(i * 7.1) * 12;
      const y = ((by - m * vy) % 860 + 860) % 860, x = bx + Math.sin(m * .7 + i) * 10;
      ctx.globalAlpha = (.05 + .1 * hash(i * 9.7)) * (.6 + .4 * Math.sin(m * 2.1 + i * 1.7));
      ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i * 2.2) * 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function joltDust(m) {                                                   // fibres puffed out of the slot ends on each jolt
    ctx.save(); ctx.fillStyle = '#FFF4E2';
    JOLTS.forEach((J, j) => {
      const age = m - jStart(j); if (age < 0 || age > .7) return;
      for (let i = 0; i < 6; i++) {
        const h1 = hash(j * 17.3 + i * 3.1), h2 = hash(j * 5.7 + i * 11.9), left = i % 2 === 0;
        const x = (left ? PX0 - 4 - h1 * 14 : PX1 + 4 + h1 * 14) + (left ? -1 : 1) * (14 + h2 * 46) * age;
        const y = SLOT - 6 - (90 + h2 * 150) * age + .5 * 260 * age * age;
        ctx.globalAlpha = .42 * (1 - age / .7); ctx.beginPath(); ctx.arc(x, y, 1.3 + h1 * 1.8, 0, 7); ctx.fill();
      }
    });
    ctx.restore();
  }
  function bodyMotes(m) {                                                  // dust hanging in the paper's light, in front of the printer
    ctx.save(); ctx.fillStyle = '#FFF6E6';
    for (let i = 0; i < 14; i++) {
      const bx = 150 + hash(i * 4.7 + 1) * 780, by = hash(i * 6.3 + 2) * 300, vy = 4 + hash(i * 8.9) * 8;
      const y = SLOT + 14 + ((by - m * vy) % 300 + 300) % 300, x = bx + Math.sin(m * .6 + i * 2.3) * 12, d = (y - SLOT) / 300;
      ctx.globalAlpha = (.06 + .12 * hash(i * 9.1)) * Math.exp(-d * 2.4) * (.6 + .4 * Math.sin(m * 1.9 + i * 1.3)) * Math.min(1, d * 8);
      ctx.beginPath(); ctx.arc(x, y, 1 + hash(i * 2.9) * 1.4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  /** the nameplate's violet backlight: struck by the TCHAK of f0, settling to a faint hum (.22); from 2.0 it breathes on
   *  the stamp's 4-on-the-floor (the due hits 1·5·9·13), barely — the paper keeps the eye */
  const STAMPS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];
  const plateGlow = m => .22 + .78 * Math.exp(-m * 3.2) + .12 * STAMPS.reduce((e, k) => m >= k ? Math.max(e, Math.exp(-(m - k) * 8)) : e, 0);
  // camera: slow push 1.00 → 1.02 over P1, eased back under the jolts of P2, then still (stable hand-off at 6.0)
  function camScale(m) { return m < 1 ? 1 + .02 * m : m < 2 ? 1.02 - .02 * smooth(m - 1) : 1; }
  const SHAKES = [0, 4.0, 4.5, 5.0, 5.5];                                  // TCHAK, then each « ? »
  function shake(m) {
    let dx = 0, dy = 0;
    for (const s of SHAKES) { const f = Math.floor((m - s) * 30 + 1e-4); if (f < 0 || f > 2) continue;
      const a = 4 * (1 - f / 3), ang = hash(s * 97.1 + f * 13.7) * Math.PI * 2; dx += Math.cos(ang) * a; dy += Math.sin(ang) * a; }
    return [dx, dy];
  }

  // ---------------------------------------------------------------- the scene ------------------------------------
  registerScene({
    id: 'printer', z: 20,
    when: t => { const m = MT(t); return m >= 0 && m < 6; },
    draw(t, n) {
      const m = MT(t), Pm = P(m), v = speed(m), blur = clamp(Math.abs(v) * .5 / 30, 0, 2 * BB_PAD - 4);
      const [sx, sy] = shake(m), cs = camScale(m);
      ctx.save();
      ctx.translate(sx, sy); ctx.translate(540, 748); ctx.scale(cs, cs); ctx.translate(-540, -748);
      background(); motes(m);
      // paper
      const top = 420 - Pm;
      receiptPaper(Math.max(top, -80), SLOT + 24, { seed: 3 });
      for (const it of L) {
        const y = it.u - Pm, h = it.h || 8; if (y > SLOT + 4 || y + h < -140) continue;
        if (it.kind === 'text') drawText(it, y, m);
        else if (it.kind === 'row') smeared(rowImage(it), y + it.h / 2 - RH / 2, blur);
        else if (it.kind === 'due') drawDue(it.i, y);
        else if (it.kind === 'duerule') drawDueRule(y, m);
        else if (it.kind === 'doc') drawDoc(y, it.h);
        else if (it.kind === 'frieze') drawFrieze(y, m);
        else if (it.kind === 'hrule') drawHRule(y);
      }
      // paper light: recedes into the dark at the top, curls into the slot at the bottom
      ctx.save();
      const yA = Math.max(top + 10, -80);
      let g = ctx.createLinearGradient(0, 0, 0, 620); g.addColorStop(0, 'rgba(13,13,18,.16)'); g.addColorStop(1, 'rgba(13,13,18,0)');
      if (yA < 620) { ctx.fillStyle = g; ctx.fillRect(PX0, yA, PX1 - PX0, 620 - yA); }
      g = ctx.createLinearGradient(0, SLOT - 34, 0, SLOT); g.addColorStop(0, 'rgba(13,13,18,0)'); g.addColorStop(1, 'rgba(13,13,18,.2)');
      ctx.fillStyle = g; ctx.fillRect(PX0, SLOT - 34, PX1 - PX0, 34);
      ctx.restore();
      // printer
      printerDark(SLOT, new Array(16).fill(0));
      ctx.fillStyle = 'rgba(247,244,236,.16)'; ctx.fillRect(PX0, SLOT - 4, PX1 - PX0, 5);       // the paper inside the slot
      ctx.save(); ctx.translate(540, SLOT + 14); ctx.scale(1, .2);                              // light bounced by the paper on the lip
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520); g.addColorStop(0, 'rgba(247,244,236,.07)'); g.addColorStop(1, 'rgba(247,244,236,0)');
      ctx.fillStyle = g; ctx.fillRect(-520, 0, 1040, 520); ctx.restore();
      printerPlate(SLOT, { glow: plateGlow(m) });                                               // the brand lives on the printer
      drawStatusTalk(m); drawLeds(m); joltDust(m); bodyMotes(m);
      ctx.restore();
      filmGrain(n, .02);
    },
  });
})();
