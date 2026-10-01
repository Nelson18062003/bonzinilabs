'use strict';
// =============================================================================================
// 10_core — shared constants and helpers of « Le parcours de vos colis » V2 (final_storyboard.md §5.2).
// Lead-owned. Packages call these; they never edit this file.
// =============================================================================================
C.box = '#3E8FB0'; C.boxRib = '#2C6F8C'; C.boxIn = '#5A3E24'; C.postit = '#FFE36E'; C.halo = 'rgba(251,246,236,.92)';
const HP_PRINT = { x: 540, y: 740, w: 600, h: 800, rot: -0.02 };
const HP_PRINT_OUTRO = { x: 540, y: 700, w: 600, h: 800, rot: -0.02 };
const HP_FULL = { x: 540, y: 960, w: 1080, h: 1920, rot: 0 };
const NOTE = { x: 540, y: 1170, w: 640 };

// ---------- timing ----------
const _warned = {};
function _warnOnce(k, msg) { if (_warned[k] || window.__need) return; _warned[k] = 1; console.error(msg); }
/** TL.wt shorthand (word start); logs once if the word is missing from the timeline */
function W_(seg, word, nth = 0) {
  if (!TL.word(seg, word, nth)) _warnOnce('W|' + seg + word + nth, `MISSING WORD ${seg}·${word}#${nth}`);
  return TL.wt(seg, word, null, nth);
}
/** word end shorthand */
function WE_(seg, word, nth = 0) { if (!TL.word(seg, word, nth)) _warnOnce('WE|' + seg + word + nth, `MISSING WORD ${seg}·${word}#${nth}`); return TL.we(seg, word, null, nth); }
/** hold rule: a replacement may not come before prevIn + min */
function hp_after(prevIn, t, min = 2.1) { return Math.max(t, prevIn + min); }
/** dev assert: readable text must hold ≥ 2.0 s */
function hp_hold(name, tIn, tOut) { if (tOut - tIn < 2.0) _warnOnce('H|' + name, `HOLD ${name}: ${(tOut - tIn).toFixed(2)} s < 2.0 s`); }
/** piecewise source time: pairs [[t0,s0],[t1,s1],…] (sorted by t), clamped at both ends; ease(k) per segment (optional) */
function hp_map(t, pairs, ease = null) {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 1; i < pairs.length; i++) {
    const [ta, sa] = pairs[i - 1], [tb, sb] = pairs[i];
    if (t <= tb) { const k = tb > ta ? (t - ta) / (tb - ta) : 1; return lerp(sa, sb, ease ? ease(k) : k); }
  }
  return pairs[pairs.length - 1][1];
}

// ---------- footage helpers ----------
/** vidCover with a crossfade between the two neighbouring even frames (smooth slow motion) */
function vidBlend(clip, srcT, x, y, w, h, o = {}) {
  const fps = CLIPS[clip].fps, fi = srcT * fps, i0 = Math.floor(fi / 2) * 2, f = clamp((fi - i0) / 2);
  const ok = vidCover(clip, i0 / fps, x, y, w, h, o);
  if (f > .04 && i0 + 2 < CLIPS[clip].n) { ctx.save(); ctx.globalAlpha *= f; vidCover(clip, (i0 + 2) / fps, x, y, w, h, o); ctx.restore(); }
  return ok;
}
function hp_rectLerp(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), rot: lerp(a.rot || 0, b.rot || 0, k) }; }
/** push-in: scale rect about (px,py) by lerp(1,z,k), bring (px,py) to screen centre by k, rotation → 0 */
function hp_pushRect(rect, px, py, z, k) {
  const s = lerp(1, z, k), cx = px + (rect.x - px) * s + (540 - px) * k, cy = py + (rect.y - py) * s + (960 - py) * k;
  return { x: cx, y: cy, w: rect.w * s, h: rect.h * s, rot: lerp(rect.rot || 0, 0, k) };
}
/** frame-normalised point (nx, ny ∈ 0..1 of the source frame) → screen [x, y] inside a print rect with framing fr {fx, fy, zoom} */
function hp_frameToPrint(nx, ny, rect, fr = {}) {
  const iw = 1080, ih = 1920, z = fr.zoom || 1, s = Math.max(rect.w / iw, rect.h / ih) * z, sw = rect.w / s, sh = rect.h / s;
  const sx = clamp((fr.fx ?? .5) * iw - sw / 2, 0, iw - sw), sy = clamp((fr.fy ?? .5) * ih - sh / 2, 0, ih - sh);
  const lx = (nx * iw - sx) * s - rect.w / 2, ly = (ny * ih - sy) * s - rect.h / 2, r = rect.rot || 0;
  return [rect.x + lx * Math.cos(r) - ly * Math.sin(r), rect.y + lx * Math.sin(r) + ly * Math.cos(r)];
}
/** a playing print at rect: at(rect) + videoPrint; o.blend → vidBlend; o.drawOver(x,y,w,h) drawn inside the picture on top */
function hp_printAt(rect, clip, srcT, o = {}) {
  at(rect.x, rect.y, rect.rot || 0, 1, 1, () => videoPrint(clip, srcT, rect.w, rect.h, o));
}

// ---------- marker & paper ----------
/** run a stroke twice: cream halo (w + 6) then colour — fn(colour, width) */
function hp_halo(fn, w = 8, col = C.violetD) { fn(C.halo, w + 6); fn(col, w); }
function hp_circle(cx, cy, rx, ry, p, col = C.violetD, seed = 1) {
  if (p <= 0) return; at(cx, cy, 0, 1, 1, () => hp_halo((c, w) => handCircle(rx, ry, p, c, w, seed), 8, col));
}
function hp_arrow(ctrl, p, col = C.violetD, w = 8) { if (p <= 0) return; hp_halo((c, ww) => handArrow(ctrl, p, c, ww), w, col); }
/** torn cream scrap with a Shantell write-on; k: 0 → 1 (pop in, then writes); o {size:60, color, rot, w, write} */
function hp_scrap(str, x, y, k, o = {}) {
  if (k <= 0) return; const size = o.size || 60, f = font(FF.hand, size, 800), tw = measure(str, f), w = o.w || tw + 90, h = size * 1.75;
  const p = clamp(k * 1.6), wr = o.write ?? clamp((k - .3) / .7);
  at(x, y, o.rot ?? -.025, .85 + .15 * eOutBack(p), .85 + .15 * eOutBack(p), () => {
    ctx.globalAlpha *= clamp(k * 4);
    withShadow(o.lift ?? 10, () => { ctx.fillStyle = C.cream; ctx.beginPath(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 5 + (o.seed || 0), 3, 14), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 13 + (o.seed || 0), 3, 14);
      ctx.moveTo(...top[0]); for (const q of top) ctx.lineTo(...q); for (const q of bot) ctx.lineTo(...q); ctx.closePath(); ctx.fill(); });
    handText(str, 0, size * .36, size, { color: o.color || C.violetD, write: wr, pen: o.pen });
  });
}
/** kraft luggage tag + cream insert + orange pin; lines [{s, font, size, color}] ; k = pop 0..1 */
function hp_tagNote(lines, x, y, k, o = {}) {
  if (k <= 0) return;
  const fs = lines.map(l => l.font || font(l.fam || FF.body, l.size || 50, l.wght || 800)), lw = lines.map((l, i) => measure(l.s, fs[i]));
  const w = o.w || Math.max(...lw) + 150, lh = lines.map(l => (l.size || 50) * 1.25), h = o.h || lh.reduce((a, b) => a + b, 0) + 56;
  const s = (o.s || 1) * (.6 + .4 * eOutBack(clamp(k)));
  at(x, y, o.rot ?? .02, s, s, () => {
    ctx.globalAlpha *= clamp(k * 3);
    withShadow(o.lift ?? 6, () => { ctx.fillStyle = TEX.kraft || C.kraft; ctx.beginPath(); ctx.moveTo(-w / 2 + 40, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 40, h / 2); ctx.lineTo(-w / 2, h / 2 - 40); ctx.lineTo(-w / 2, -h / 2 + 40); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = C.cream; rrect(-w / 2 + 74, -h / 2 + 14, w - 88, h - 28, 8); ctx.fill();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 14, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 6, 0, 7); ctx.fill();
    let yy = -h / 2 + 28; const cx = (-w / 2 + 74 + w / 2 - 14) / 2;
    lines.forEach((l, i) => { yy += lh[i]; text(l.s, o.align === 'left' ? -w / 2 + 96 : cx, yy - lh[i] * .24, { font: fs[i], color: l.color || C.ink, align: o.align || 'center' }); });
    if (o.pin !== false) pushPin(-w / 2 + 38, 0, C.orange);
  });
}
/** stamp: stampText + slam at t0 + one shake; registered in HP_STAMPS (budget 5, ≥ 4 s apart). o {color, size, box, rot, alpha, lines} */
const HP_STAMPS = {};
function hp_stamp(word, x, y, t, t0, o = {}) {
  if (!HP_STAMPS[word]) {
    HP_STAMPS[word] = t0; addShake(t0, o.shake ?? 12, .16); hp_sfx('stamp_thunk', t0);
    const all = Object.values(HP_STAMPS).sort((a, b) => a - b);
    if (all.length > 5) _warnOnce('S5', `STAMP BUDGET: ${all.length} stamps`);
    for (let i = 1; i < all.length; i++) if (all[i] - all[i - 1] < 4) _warnOnce('S4' + word, `STAMPS < 4 s apart near ${word}`);
  }
  const sl = slam(t, t0, o.from || 1.9); if (sl.a <= 0) return;
  const size = o.size || 104, f = font(FF.stencil, size, 900), lines = o.lines || [word];
  at(x, y, o.rot ?? -.06, sl.s, sl.s, () => {
    if (lines.length === 1) stampText(lines[0], 0, 0, f, o.color || C.orange, { box: o.box !== false, starve: o.starve ?? .45, alpha: sl.a * (o.alpha ?? 1), h: size * 1.3, ls: o.ls ?? 4 });
    else lines.forEach((s, i) => stampText(s, 0, (i - (lines.length - 1) / 2) * size * 1.05, f, o.color || C.orange, { box: false, starve: o.starve ?? .45, alpha: sl.a * (o.alpha ?? 1), ls: o.ls ?? 4 }));
    if (lines.length > 1 && o.box !== false) { ctx.save(); ctx.globalAlpha *= sl.a * .9; ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = o.color || C.orange; ctx.lineWidth = 10;
      const w = Math.max(...lines.map(s => measure(s, f, o.ls ?? 4))) + 70, h = size * 1.05 * lines.length + 40; rrect(-w / 2, -h / 2 - size * .36, w, h, 18); ctx.stroke(); ctx.restore(); }
  });
}
/** hand-drawn check mark, k 0..1 */
function hp_check(x, y, k, size = 90, col = C.violetD) {
  if (k <= 0) return; const s = size / 90;
  at(x, y, 0, s, s, () => hp_halo((c, w) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    const a = clamp(k * 2), b = clamp(k * 2 - 1); ctx.moveTo(-36, 0); ctx.lineTo(-36 + 24 * a, 24 * a); if (b > 0) ctx.lineTo(-12 + 52 * b, 24 - 62 * b); ctx.stroke(); ctx.restore(); }, 10, col));
}
/** tape strip pulled from (x0,y0) to (x1,y1), k 0..1 */
function hp_tape(x0, y0, x1, y1, k, col = C.tape, w = 64) {
  if (k <= 0) return; const ex = lerp(x0, x1, clamp(k)), ey = lerp(y0, y1, clamp(k)), L = Math.hypot(ex - x0, ey - y0); if (L < 1) return;
  at(x0, y0, Math.atan2(ey - y0, ex - x0), 1, 1, () => { ctx.fillStyle = col; ctx.beginPath(); const top = tornLine(0, -w / 2, L, -w / 2, 21, 1.2, 8), bot = tornLine(L, w / 2, 0, w / 2, 29, 1.2, 8);
    ctx.moveTo(...top[0]); for (const q of top) ctx.lineTo(...q); for (const q of bot) ctx.lineTo(...q); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, -w / 2 + 4, L, 5); });
}
/** sound cue log (deduped) → window._cues → render.mjs --dump-cues */
window._cues = window._cues || [];
const _cueSeen = {};
function hp_sfx(name, t0) { if (!isFinite(t0)) return; const k = name + '@' + t0.toFixed(3); if (_cueSeen[k]) return; _cueSeen[k] = 1; window._cues.push({ name, t0: +t0.toFixed(3) }); }
