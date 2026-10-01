'use strict';
// ============================================================================================================
// TEASER « Douane : combien ? » — shared core (every section file uses these; do not redefine them)
//   • Cuts: window.CUT = 'main' (24 s) | 'short' (15 s). Scenes are written in MASTER time (= main-cut time).
//     MT(t) maps the cut time to master time; in the short cut 12.0–14.5 is a dedicated end card: SHORTEND(t) → local 0..2.5.
//   • Grid: 120 BPM, 1 bar = 2 s, 1 step = 0.125 s. step(bar, s) = master time of step s (1..16) of bar (1..12).
//   • Product design system (premium « Douane » site): Satoshi 400/500/700/900, colours COL, easing EASE (cubic-bezier .16,1,.3,1).
//   • Receipt + printer primitives shared by the sections (continuity of the paper from 0 s to 14 s).
// ============================================================================================================
FF.sat = 'Satoshi';
const COL = { ink: '#0D0D12', ink2: '#3A3A44', ink3: '#6E6E78', mute: '#86868F', bg: '#F5F5F7', fill: '#EAEAEF', card: '#FFFFFF', line: '#E8E8EC',
  violet: '#A947FE', brand: '#7D22E0', gold: '#F3A745', orange: '#FE560D', good: '#038C4E', paper: '#F7F4EC', dark: '#0D0D12', body: '#16161C',
  bevel: '#2A2A31', halo: '#281450' };

// ---------- cut mapping ----------------------------------------------------------------------------------------------
const SHORT_MAP = [ [0, 6, 0], [6, 7.5, 8], [7.5, 8, 9.5], [8, 12, 10], [14.5, 15, 23.5] ];   // [t0, t1, master t0]
function MT(t) {
  if ((window.CUT || 'main') === 'main') return t;
  for (const [a, b, m] of SHORT_MAP) if (t >= a && t < b) return m + (t - a);
  if (t >= 12 && t < 14.5) return -1;                       // the short end card (see SHORTEND)
  return t >= 15 ? 24 : t;
}
function SHORTEND(t) { return (window.CUT === 'short' && t >= 12 && t < 14.5) ? t - 12 : null; }
const step = (bar, s = 1) => (bar - 1) * 2 + (s - 1) * .125;

// ---------- easing (the site's EASE) ----------------------------------------------------------------------------------
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let u = x; for (let i = 0; i < 6; i++) { const d = dx(u); if (Math.abs(d) < 1e-6) break; u -= (sx(u) - x) / d; } return sy(clamp(u)); };
}
const EASE = bezier(.16, 1, .3, 1);
const ease = (t, a, b) => EASE(prog(t, a, b));
/** pop-in scale: 1.15 → 1.0 over 4 frames with EASE (big lines: from 1.06) */
const popS = (t, t0, from = 1.15, d = 4 / 30) => t < t0 ? 0 : lerp(from, 1, EASE(clamp((t - t0) / d)));
/** damped spring 0→1 with overshoot (ζ ≈ .35 by default) */
const springTo = (t, t0, w = 18, z = .35) => t < t0 ? 0 : spring(t - t0, w, z);

// ---------- type ------------------------------------------------------------------------------------------------------
/** Satoshi text. o: { size, w (weight 400|500|700|900), color, align, ls (em, default -0.045 for 900, -0.02 otherwise), a, base } */
function sat(str, x, y, o = {}) {
  const size = o.size || 120, w = o.w || 900, ls = (o.ls ?? (w >= 900 ? -.045 : -.02)) * size;
  text(str, x, y, { font: font(FF.sat, size, w), color: o.color || COL.ink, align: o.align || 'left', ls, alpha: o.a ?? 1, base: o.base });
}
function satW(str, size = 120, w = 900, lsEm) { return measure(str, font(FF.sat, size, w), (lsEm ?? (w >= 900 ? -.045 : -.02)) * size); }
/** a text line that pops in at t0 (scale about its left baseline), visible from t0 */
function popText(t, t0, str, x, y, o = {}) {
  if (t < t0) return; const s = popS(t, t0, o.from ?? (satW(str, o.size || 120, o.w || 900) > 600 ? 1.06 : 1.15));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); sat(str, 0, 0, o); ctx.restore();
}
/** « ??? » drawn as three separate question marks with oversized dots, so motion blur never turns them into « 777 » (no-digit rule) */
function qMarks(x, y, o = {}) {
  const size = o.size || 44, col = o.color || COL.orange, gw = satW('?', size, 900), gap = size * .16;
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) { const gx = x + i * (gw + gap);
    sat('?', gx, y, { size, w: 900, color: col });
    ctx.beginPath(); ctx.arc(gx + gw * .46, y - size * .075, size * .135, 0, 7); ctx.fill(); }
  ctx.restore();
}
const NNBSP = ' ';   // narrow no-break space before « : » and « ? »

// ---------- brand ------------------------------------------------------------------------------------------------------
/** « Bonzini Labs » pill (real logo + Satoshi 700). mode 'dark' (violet text on a 70 % ink pill) | 'light' (ink text, no pill). */
function brandPill(x, y, o = {}) {
  const s = o.scale || 1, mode = o.mode || 'dark', a = o.a ?? 1; if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s);
  const tw = satW('Bonzini Labs', 44, 700), w = 30 + 56 + 14 + tw + 34, h = 73;
  if (mode === 'dark') { ctx.fillStyle = 'rgba(13,13,18,.7)'; rrect(0, 0, w, h, h / 2); ctx.fill(); }
  drawLogo(30 + 28, h / 2, 60);
  sat('Bonzini Labs', 30 + 56 + 14, h / 2 + 16, { size: 44, w: 700, color: mode === 'dark' ? COL.violet : COL.ink });
  if (o.douane != null && o.douane > 0) {        // « Douane » sliding out like a drawer (0..1)
    const dx = 30 + 56 + 14 + tw + 18; ctx.save(); ctx.beginPath(); ctx.rect(dx - 4, 0, 400, h); ctx.clip();
    sat('Douane', dx - (1 - EASE(o.douane)) * 180, h / 2 + 16, { size: 44, w: 500, color: COL.mute, a: clamp(o.douane * 2) }); ctx.restore();
  }
  ctx.restore(); return { w: w * s, h: h * s };
}

// ---------- grain & dark world ---------------------------------------------------------------------------------------
let _gr = null;
function filmGrain(n, amt = .02) {
  if (!_gr) { _gr = []; for (let k = 0; k < 6; k++) { const c = makeCanvas(540, 960), g = c.getContext('2d'), id = g.createImageData(540, 960);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (hash(i * .13 + k * 7.7) - .5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); _gr.push(c); } }
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt * 6; ctx.drawImage(_gr[Math.floor(n / 2) % 6], 0, 0, W, H); ctx.restore();
}
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- the receipt (thermal paper) -------------------------------------------------------------------------------
/** paper strip from y0 (top, torn) to y1 (bottom), x 120–960; dither texture; optional skew (rotateX look via vertical squash at top) */
let _dither = null;
function ditherPattern() {
  if (_dither) return _dither; const c = makeCanvas(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = hash(i * .071) < .5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 10; }
  g.putImageData(id, 0, 0); _dither = ctx.createPattern(c, 'repeat'); return _dither;
}
function receiptPaper(y0, y1, o = {}) {
  const x0 = o.x0 ?? 120, x1 = o.x1 ?? 960, col = o.color || COL.paper;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0 + 10);
  for (let x = x0; x <= x1; x += 14) ctx.lineTo(x, y0 + (hash(x * .37 + (o.seed || 0)) * 10));          // torn top edge
  ctx.lineTo(x1, y1); ctx.closePath();
  if (o.shadow !== false) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
  ctx.fillStyle = col; ctx.fill(); ctx.clip();
  ctx.fillStyle = ditherPattern(); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(0,0,0,.06)'); g.addColorStop(.12, 'rgba(0,0,0,0)'); g.addColorStop(.88, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
/** thermal-print look for text: slightly starved ink */
function thermal(fn) { ctx.save(); fn(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .18; ctx.fillStyle = ditherPattern(); ctx.restore(); }
/** the 4 « due » lines (dot + inked bar + ▒▒▒ amount). labels: null (illegible bar) or strings; colours per line. y = top of line 1, gap per line */
const DUE = [ { label: 'Droit de douane', col: COL.violet }, { label: 'Accises', col: COL.orange }, { label: 'TVA et centimes', col: COL.gold }, { label: 'Autres taxes', col: '#B9B9C2' } ];
function dueLine(i, x, y, o = {}) {
  const d = DUE[i], a = o.a ?? 1, lw = o.labelW ?? 1; if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = o.dotCol || (o.coloured ? d.col : COL.ink); ctx.beginPath(); ctx.arc(x + 12, y, o.dotR || 12, 0, 7); ctx.fill();
  if (o.label) { sat(d.label, x + 44, y + 22, { size: o.size || 64, w: 700, color: COL.ink, ls: -.02 }); }
  else { ctx.fillStyle = 'rgba(13,13,18,.82)'; rrect(x + 44, y - 12, (220 + i * 40) * lw, 24, 6); ctx.fill(); }
  ditherAmount(x + (o.amountX ?? 580), y - 16, o.amountW ?? 160, 32);
  ctx.restore();
}
/** a dither block standing for an amount (never digits) */
function ditherAmount(x, y, w, h) {
  ctx.save(); ctx.fillStyle = 'rgba(13,13,18,.78)';
  for (let yy = 0; yy < h; yy += 4) for (let xx = 0; xx < w; xx += 4) if (hash(xx * 1.7 + yy * 3.1 + x) > .42) ctx.fillRect(x + xx, y + yy, 3, 3);
  ctx.restore();
}
/** a texture row: « LABEL ……… ??? » (Satoshi 500 caps 44 px), the ??? in orange */
function textureRow(label, x, y, o = {}) {
  const a = o.a ?? 1; if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a;
  sat(label, x, y, { size: o.size || 44, w: 500, color: o.color || COL.ink3, ls: .02 });
  const lw = satW(label, o.size || 44, 500, .02); ctx.fillStyle = 'rgba(110,110,120,.6)';
  for (let xx = x + lw + 16; xx < (o.qx ?? 800) - 16; xx += 14) ctx.fillRect(xx, y - 6, 5, 5);
  qMarks(o.qx ?? 800, y, { size: o.size || 44, w: 700, color: COL.orange, ls: .02 }); ctx.restore();
}

// ---------- the printer ------------------------------------------------------------------------------------------------
/** dark printer body from slot y to the bottom, with the violet status LED and the 16 step LEDs (states: array of 0 off | 1 white | 2 orange | 3 violet | 4 ring) */
function printerDark(slotY, leds = null, o = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(0, slotY, 0, H); g.addColorStop(0, COL.bevel); g.addColorStop(.06, COL.body); g.addColorStop(1, '#0F0F14');
  ctx.fillStyle = g; rrect(40, slotY, W - 80, H - slotY + 60, 36); ctx.fill();
  ctx.fillStyle = '#050507'; rrect(100, slotY - 6, W - 200, 22, 11); ctx.fill();                                // the slot
  ctx.fillStyle = COL.violet; ctx.shadowColor = COL.violet; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(160, slotY + 70, 11, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  if (leds) for (let k = 0; k < 16; k++) { const st = leds[k] || 0, x = 220 + k * 34, y = slotY + 70;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, 7);
    if (st === 0) { ctx.fillStyle = '#26262E'; ctx.fill(); }
    else if (st === 4) { ctx.strokeStyle = COL.violet; ctx.lineWidth = 3; ctx.stroke(); }
    else { ctx.fillStyle = st === 1 ? '#F4F4F6' : st === 2 ? COL.orange : COL.violet; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0; } }
  ctx.restore();
}
/** brand nameplate on the dark printer face + the body's dressing (replaces the top-left pill while the printer is on
 *  screen in the dark world). Same call in sections a, b and d (loop): right after printerDark(slotY …), before the LEDs.
 *  Works under any uniform scale/translate (section b draws the printer at ×1/8, then ×1.5).
 *   • dressing (o.dress, default 1, independent of o.a so the plate can fade on its own): the lit paper mirrored in the
 *     gloss of the top bevel (read back from the canvas band just above the slot; o.mirror === false skips it), a satin
 *     sheen + specular lip, the lid seam, a fine brushed texture, the vent grille, rim light on the flanks. Nothing readable.
 *   • the nameplate (o.a, o.scale about its centre, o.glow 0..1 violet backlight): real logo + « Bonzini Labs » (Satoshi 700)
 *     in a recessed pill, centred at (540, slotY + PLATE_DY) = (540, 1170) for the slot at 880. */
const PLATE_DY = 290;
function printerPlate(slotY, o = {}) {
  const a = o.a ?? 1, dress = o.dress ?? 1, F = printerPlate, X0 = 40, X1 = W - 40, BW = X1 - X0;
  if (a <= 0 && dress <= 0) return;
  if (dress > 0) {
    ctx.save(); ctx.globalAlpha *= dress;
    rrect(X0, slotY, BW, H - slotY + 60, 36); ctx.clip();
    // brushed micro-texture (cached, deterministic): fine horizontal streaks, fading down the body
    if (!F.tex) { F.tex = makeCanvas(BW, 1080); const g = F.tex.getContext('2d');
      for (let i = 0; i < 1500; i++) { const y = hash(i * 1.37 + .5) * 1080, x = hash(i * 2.71) * BW, l = 60 + hash(i * 3.9) * 420, k = Math.pow(1 - y / 1080, 1.6);
        g.fillStyle = hash(i * 5.3) > .5 ? `rgba(255,255,255,${(.01 + hash(i * 7.1) * .02) * k})` : `rgba(0,0,0,${(.03 + hash(i * 8.3) * .05) * k})`;
        g.fillRect(x - l / 2, y, l, 1 + (hash(i * 9.7) > .8 ? 1 : 0)); } }
    ctx.drawImage(F.tex, X0, slotY + 24);
    // the lit paper, mirrored in the gloss of the bevel (device space: copied, blurred, flipped, squashed, faded)
    if (o.mirror !== false) {
      const T = ctx.getTransform(), k = T.d, BH = 170, SQ = .34;
      const sx = T.e + T.a * 120, sy = T.f + T.d * (slotY - 8 - BH), sw = Math.round(T.a * 840), sh = Math.round(T.d * BH), rh = Math.max(1, Math.round(sh * SQ));
      if (sw > 2 && sh > 2 && sw < 2200 && sh < 600) {
        if (!F.mA) { F.mA = makeCanvas(2200, 600); F.mB = makeCanvas(2200, 320); }
        const A = F.mA.getContext('2d'), B = F.mB.getContext('2d');
        A.setTransform(1, 0, 0, 1, 0, 0); A.clearRect(0, 0, sw + 4, sh + 4); A.filter = `blur(${Math.max(.4, 9 * k)}px)`;
        A.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh); A.filter = 'none';
        B.setTransform(1, 0, 0, 1, 0, 0); B.globalCompositeOperation = 'source-over'; B.clearRect(0, 0, sw + 4, rh + 4);
        B.setTransform(1, 0, 0, -SQ, 0, rh); B.drawImage(F.mA, 0, 0, sw, sh, 0, 0, sw, sh); B.setTransform(1, 0, 0, 1, 0, 0);
        B.globalCompositeOperation = 'destination-in';
        let g = B.createLinearGradient(0, 0, 0, rh); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.35, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        B.fillStyle = g; B.fillRect(0, 0, sw, rh);
        g = B.createLinearGradient(0, 0, sw, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.1, 'rgba(0,0,0,1)'); g.addColorStop(.9, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        B.fillStyle = g; B.fillRect(0, 0, sw, rh); B.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= .17;
        ctx.drawImage(F.mB, 0, 0, sw, rh, sx, T.f + T.d * (slotY + 17), sw, rh); ctx.restore();
      }
    }
    // satin sheen under the slot + specular lip
    let g = ctx.createLinearGradient(0, slotY + 16, 0, slotY + 120); g.addColorStop(0, 'rgba(247,244,236,.05)'); g.addColorStop(1, 'rgba(247,244,236,0)');
    ctx.fillStyle = g; ctx.fillRect(X0, slotY + 16, BW, 104);
    g = ctx.createLinearGradient(100, 0, W - 100, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(100, slotY + 17, W - 200, 1.5);
    // rim light on the flanks (the paper's light wrapping the rounded corners)
    for (const x of [X0, X1]) { ctx.save(); ctx.translate(x, slotY + 24); ctx.scale(14, 720);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(255,248,236,.075)'); g.addColorStop(.5, 'rgba(255,248,236,.03)'); g.addColorStop(1, 'rgba(255,248,236,0)');
      ctx.fillStyle = g; ctx.fillRect(-1, 0, 2, 1); ctx.restore(); }
    // the lid seam (lid with slot + LEDs above, front panel below)
    const ys = slotY + 122;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(X0, ys, BW, 2);
    g = ctx.createLinearGradient(X0, 0, X1, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(X0, ys + 2, BW, 1.2);
    // vent grille: 6 milled grooves under the plate (dark slot, lit lower lip)
    for (let i = 0; i < 6; i++) { const y = slotY + 440 + i * 22, xa = 330, xb = 750;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; rrect(xa, y, xb - xa, 8, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(xa + 2, y, xb - xa - 4, 2, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.05)'; rrect(xa + 4, y + 8, xb - xa - 8, 1.2, .6); ctx.fill(); }
    ctx.restore();
  }
  if (a <= 0) return;
  const s = o.scale || 1, y = slotY + PLATE_DY;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(540, y); ctx.scale(s, s);
  const tw = satW('Bonzini Labs', 64, 700), w = 96 + 22 + tw, x0 = -w / 2, rx = x0 - 44, rw = w + 88;
  if (o.glow) { ctx.save(); ctx.shadowColor = COL.violet; ctx.shadowBlur = 40 * o.glow; ctx.globalAlpha *= .45 * o.glow; ctx.fillStyle = COL.halo; rrect(rx + 4, -58, rw - 8, 116, 58); ctx.fill(); ctx.restore(); }
  // recessed pill: darker floor, shadowed upper wall, lit lower lip
  let g = ctx.createLinearGradient(0, -62, 0, 62); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.3, 'rgba(0,0,0,.36)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = g; rrect(rx, -62, rw, 124, 62); ctx.fill();
  g = ctx.createLinearGradient(0, -62, 0, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, 'rgba(255,255,255,.02)'); g.addColorStop(1, 'rgba(255,255,255,.14)');
  ctx.strokeStyle = g; ctx.lineWidth = 2; rrect(rx + 1, -61, rw - 2, 122, 61); ctx.stroke();
  drawLogo(x0 + 48, 0, 96);
  g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#F6F3FB'); g.addColorStop(1, '#B9B4C7');
  ctx.save(); ctx.font = font(FF.sat, 64, 700); ctx.letterSpacing = (-.02 * 64) + 'px'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText('Bonzini Labs', x0 + 118, 21);           // engraved: dark upper edge
  ctx.fillStyle = g; ctx.fillText('Bonzini Labs', x0 + 118, 23); ctx.restore();
  ctx.restore();
}
/** white printer (after the drop): product world, 28 px radius, soft shadow; slot at slotY */
function printerLight(slotY, leds = null) {
  ctx.save(); ctx.shadowColor = 'rgba(13,13,18,.12)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = COL.card; rrect(60, slotY, W - 120, H - slotY + 60, 28); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = COL.fill; rrect(110, slotY - 6, W - 220, 20, 10); ctx.fill();
  if (leds) for (let k = 0; k < 16; k++) { const st = leds[k] || 0, x = 220 + k * 34, y = slotY + 70; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7);
    if (st === 4) { ctx.strokeStyle = COL.violet; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = st === 3 ? COL.violet : COL.fill; ctx.fill(); } }
  ctx.restore();
}

// ---------- images (captures of the real site, assets/img/cap/*) --------------------------------------------------------
const IMGK = k => (window.IMG || {})[k];
/** the real phone capture, centred at (cx, cy), width w (px), with an optional 3D tilt (ry, rx in degrees, approximated) and halo */
function realPhone(key, cx, cy, w, o = {}) {
  const I = IMGK(key); if (!I) return; const h = w * I.height / I.width, ry = (o.ry || 0) * Math.PI / 180, rx = (o.rx || 0) * Math.PI / 180;
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.translate(cx, cy);
  if (o.halo !== false) { ctx.save(); ctx.globalAlpha *= .25; ctx.filter = 'blur(40px)'; ctx.fillStyle = COL.halo; rrect(-w / 2, -h / 2 + 30, w, h, w * .17); ctx.fill(); ctx.restore(); }
  // perspective approximation: horizontal squash by cos(ry) + vertical skew; vertical squash by cos(rx)
  ctx.transform(Math.cos(ry), Math.sin(ry) * .18, 0, Math.cos(rx), 0, 0);
  ctx.drawImage(I, -w / 2, -h / 2, w, h);
  if (o.glint != null && o.glint > 0 && o.glint < 1) { ctx.save(); ctx.beginPath(); rrect(-w / 2, -h / 2, w, h, w * .17); ctx.clip();
    const gx = lerp(-w * 1.2, w * 1.2, o.glint), gr = ctx.createLinearGradient(gx - 120, -h / 2, gx + 120, h / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); }
  ctx.restore(); return { w, h };
}

// ---------- debug: safe zones (only when window.SAFE) --------------------------------------------------------------------
registerScene({ id: 'safe', z: 99, when: () => !!window.SAFE, draw() { ctx.save(); ctx.strokeStyle = 'rgba(0,255,120,.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(120, 270, 840, 980); ctx.beginPath(); ctx.moveTo(780, 840); ctx.lineTo(780, 1250); ctx.stroke(); ctx.restore(); } });
