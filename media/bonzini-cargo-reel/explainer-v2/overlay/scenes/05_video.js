'use strict';
// =============================================================================================
// REAL FOOTAGE × PAPER — the team's phone videos as playing prints on the Kraft & Fil table.
// Frames are prepared JPGs (AI-upscaled 1080x1920, carrier lettering removed), EVEN source frames only
// (prints play « on twos », like the stop-motion). render.mjs loads the frames a frame needs on demand:
// it first runs a probe pass (every vid() call records its key), loads the missing JPGs, then renders.
// =============================================================================================
const CLIPS = { A: { fps: 25, n: 648 }, B: { fps: 30, n: 498 }, B2: { fps: 30, n: 438 } };
// forbidden source ranges (third-party logo / printed name / car emblem) — never show them
const FORBID = { B: [[0, 2.7]], A: [[6.0, 10.5]] };
// AVOID (team list, final_storyboard §4): residual marks / people / signs. Logged as errors too; the one documented
// exception is the B 9.0 still (its ghost is covered by the « VOTRE COLIS » mini label before the print develops).
const AVOID = { B: [[6.2, 10.3], [12.1, 16.6]], B2: [[0, 3.95], [5.5, 9.7], [10, 14.6]], A: [[0, 6.0], [10.5, 12.3]] };
const AVOID_OK = [['B', 9.0]];
window.VF = window.VF || {};
window.__need = null;
function vidIdx(clip, srcT) { const c = CLIPS[clip]; let i = Math.round(srcT * c.fps); i = clamp(i, 0, c.n - 1); return i - (i % 2); }
function vidKey(clip, srcT) { return clip + '/' + String(vidIdx(clip, srcT)).padStart(5, '0'); }
function forbidden(clip, srcT) { return (FORBID[clip] || []).some(([a, b]) => srcT >= a && srcT < b); }
function avoided(clip, srcT) { return (AVOID[clip] || []).some(([a, b]) => srcT >= a && srcT < b) && !AVOID_OK.some(([c, s]) => c === clip && Math.abs(srcT - s) < .05); }
const _forbWarned = {};
/** the frame image for clip at source second srcT (null while not loaded) */
function vid(clip, srcT) {
  if (forbidden(clip, srcT) && !window.__need) { const k = clip + Math.floor(srcT); if (!_forbWarned[k]) { _forbWarned[k] = 1; console.error(`FORBIDDEN FOOTAGE ${clip} @ ${srcT.toFixed(2)} s`); } }
  if (avoided(clip, srcT) && !window.__need) { const k = 'a' + clip + Math.floor(srcT * 2); if (!_forbWarned[k]) { _forbWarned[k] = 1; console.error(`AVOID FOOTAGE ${clip} @ ${srcT.toFixed(2)} s`); } }
  const k = vidKey(clip, srcT);
  if (window.__need) window.__need.add(k);
  return window.VF[k] || null;
}
/** source time for a shot: plays from src0 at `speed` since t0 (clamped to the clip) */
function vidT(t, t0, src0, speed = 1, clip = null) {
  const s = src0 + Math.max(0, t - t0) * speed;
  return clip ? clamp(s, 0, (CLIPS[clip].n - 1) / CLIPS[clip].fps) : s;
}
// warm « print » grade so the footage sits in the cream paper world
const GRADES = { warm: 'saturate(.92) contrast(1.06) brightness(1.03) sepia(.10)', none: 'none', mono: 'grayscale(1) contrast(1.1)', duo: 'grayscale(1) sepia(.55) contrast(1.15)' };
/** draw a footage frame into (x,y,w,h) with cover fit; o: fx, fy (focus 0..1), zoom (≥1), grade ('warm'), mirror */
function vidCover(clip, srcT, x, y, w, h, o = {}) {
  const im = vid(clip, srcT);
  if (!im) { ctx.save(); ctx.fillStyle = '#8f8a80'; ctx.fillRect(x, y, w, h); ctx.restore(); return false; }
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, z = o.zoom || 1;
  const s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s;
  const fx = o.fx ?? .5, fy = o.fy ?? .5, sx = clamp(fx * iw - sw / 2, 0, iw - sw), sy = clamp(fy * ih - sh / 2, 0, ih - sh);
  ctx.save(); ctx.filter = GRADES[o.grade || 'warm'] || o.grade;
  if (o.mirror) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h); ctx.restore();
  return true;
}
/**
 * A playing video print lying on the table, centred at (0,0) (call inside at()).
 * w,h = picture size; o: border (18), lift (shadow height, 12), tape (true | 'corners' | false), caption (hand-written, under),
 * develop (0..1: cream → image), flash (0..1 white flash), gloss (true), curl (0..1 lifted corner shadow),
 * fx/fy/zoom/grade (framing), scan(x,y,w,h) extra drawing clipped inside the picture, sprocket (film strip edges), pin (push-pin colour).
 */
function videoPrint(clip, srcT, w, h, o = {}) {
  const b = o.border ?? 18, cap = o.caption ? 70 : 0;
  ctx.save();
  withShadow(o.lift ?? 12, () => { ctx.fillStyle = o.paper || '#FBFAF6'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + cap); });
  if (o.curl) { const k = clamp(o.curl); ctx.save(); const g = ctx.createLinearGradient(w / 2 + b, h / 2 + b + cap, w / 2 + b - 160 * k, h / 2 + b + cap - 160 * k);
    g.addColorStop(0, `rgba(60,32,12,${.22 * k})`); g.addColorStop(1, 'rgba(60,32,12,0)'); ctx.fillStyle = g; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + cap); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  (o.blend ? vidBlend : vidCover)(clip, srcT, -w / 2, -h / 2, w, h, o);
  if (o.scan) o.scan(-w / 2, -h / 2, w, h);
  if (o.develop != null && o.develop < 1) {             // instant film: cream fog clears unevenly (centre first)
    const d = clamp(o.develop), g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(w, h) / 2);
    g.addColorStop(0, `rgba(240,234,220,${clamp(1.25 - d * 1.6)})`); g.addColorStop(1, `rgba(236,228,210,${clamp(1.05 - d * 1.05)})`);
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  if (o.flash) { ctx.fillStyle = `rgba(255,252,244,${clamp(o.flash)})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
  if (o.gloss !== false) { const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.10)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h); }
  if (o.drawOver) o.drawOver(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(35,22,41,.10)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  ctx.restore();
  if (o.sprocket) { ctx.fillStyle = 'rgba(35,22,41,.85)'; for (let y = -h / 2; y < h / 2 - 10; y += 46) { rrect(-w / 2 - b + 4, y + 8, b - 8, 26, 4); ctx.fill(); rrect(w / 2 + 4, y + 8, b - 8, 26, 4); ctx.fill(); } }
  if (o.caption) text(o.caption, 0, h / 2 + b + 50, { font: font(FF.hand, o.captionSize || 46, 800), align: 'center', color: C.ink });
  if (o.tape === true || o.tape === undefined) { ctx.fillStyle = C.tape; at(-w / 2 + 24, -h / 2 - b + 2, -.55, 1, 1, () => ctx.fillRect(-58, -19, 116, 38)); at(w / 2 - 24, -h / 2 - b + 2, .55, 1, 1, () => ctx.fillRect(-58, -19, 116, 38)); }
  else if (o.tape === 'top') { ctx.fillStyle = C.tape; at(0, -h / 2 - b + 2, -.04, 1, 1, () => ctx.fillRect(-80, -20, 160, 40)); }
  if (o.pin) pushPin(0, -h / 2 - b + 18, o.pin);
  ctx.restore();
}
/** push-pin seen from above (head + shadow), colour */
function pushPin(x, y, col = C.orange) {
  ctx.save(); ctx.fillStyle = 'rgba(60,32,12,.28)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 14, 20, 14, .4, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - 6, y - 7, 2, x, y, 22); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); ctx.fillStyle = g; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); ctx.restore();
}
/**
 * Paper cut-out of the blue container from a frame (colour key, cached): returns {canvas, bbox} or null.
 * The canvas is the frame-sized cut-out (alpha = container). Draw it lifted (shadow, white cut border via o.border in drawCutout).
 */
const _cut = {};
function vidCutout(clip, srcT, o = {}) {
  const k = vidKey(clip, srcT) + '|' + (o.kind || 'blue'); if (_cut[k]) return _cut[k];
  const im = vid(clip, srcT); if (!im) return null;
  const sc = .5, w = Math.round((im.naturalWidth || im.width) * sc), h = Math.round((im.naturalHeight || im.height) * sc);
  const c = makeCanvas(w, h), g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data, m = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) {
    const r = p[i] / 255, gg = p[i + 1] / 255, bb = p[i + 2] / 255, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), dlt = mx - mn;
    let hue = 0; if (dlt > 1e-6) { if (mx === r) hue = ((gg - bb) / dlt) % 6; else if (mx === gg) hue = (bb - r) / dlt + 2; else hue = (r - gg) / dlt + 4; hue *= 60; if (hue < 0) hue += 360; }
    const sat = mx > 0 ? dlt / mx : 0; m[j] = hue > 165 && hue < 220 && sat > .25 && mx > .22 ? 1 : 0;
  }
  // close small holes (rails, chains): dilate 3 then erode 3 (separable box)
  const pass = (src, dil) => { const out = new Uint8Array(w * h), R = 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let q = -R; q <= R; q++) { const xx = clamp(x + q, 0, w - 1); const s = src[y * w + xx]; if (dil ? s : !s) { v = dil ? 1 : 0; break; } } out[y * w + x] = v; }
    const out2 = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let q = -R; q <= R; q++) { const yy = clamp(y + q, 0, h - 1); const s = out[yy * w + x]; if (dil ? s : !s) { v = dil ? 1 : 0; break; } } out2[y * w + x] = v; }
    return out2; };
  const mm = pass(pass(m, true), false);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = y * w + x; p[j * 4 + 3] = mm[j] ? 255 : 0; if (mm[j]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  g.putImageData(d, 0, 0);
  const res = { canvas: c, scale: sc, bbox: x1 > x0 ? [x0 / sc, y0 / sc, (x1 - x0) / sc, (y1 - y0) / sc] : null };
  _cut[k] = res; return res;
}
/** draw a cut-out (from vidCutout) mapped into the picture rect (x,y,w,h) used by vidCover with the same framing, lifted by `lift` with a white paper rim */
function drawCutout(cut, x, y, w, h, o = {}) {
  if (!cut) return; const c = cut.canvas, iw = c.width / cut.scale, ih = c.height / cut.scale, z = o.zoom || 1;
  const s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s, fx = o.fx ?? .5, fy = o.fy ?? .5;
  const sx = clamp(fx * iw - sw / 2, 0, iw - sw), sy = clamp(fy * ih - sh / 2, 0, ih - sh);
  const lift = o.lift ?? 30, rim = o.rim ?? 7;
  ctx.save();
  ctx.shadowColor = `rgba(60,32,12,${.35 * clamp(lift / 40)})`; ctx.shadowBlur = 10 + lift * .6; ctx.shadowOffsetX = lift * .35; ctx.shadowOffsetY = lift * .7;
  for (let a = 0; a < 8; a++) { const dx = Math.cos(a * Math.PI / 4) * rim, dy = Math.sin(a * Math.PI / 4) * rim;    // white rim = 8 offset silhouettes
    ctx.save(); ctx.filter = 'brightness(0) invert(1)'; ctx.drawImage(c, sx * cut.scale, sy * cut.scale, sw * cut.scale, sh * cut.scale, x + dx, y + dy, w, h); ctx.restore(); if (a === 0) { ctx.shadowColor = 'transparent'; } }
  ctx.filter = GRADES[o.grade || 'warm']; ctx.drawImage(c, sx * cut.scale, sy * cut.scale, sw * cut.scale, sh * cut.scale, x, y, w, h);
  ctx.restore();
}
/** « L'équipe Bonzini · sur place » kraft badge with a live mic waveform; k = appear 0..1, live = speaking (bars move) */
function teamBadge(x, y, k, t, n, o = {}) {
  if (k <= 0) return; const s = (o.s || 1) * (.6 + .4 * eOutBack(clamp(k)));
  at(x, y, o.rot ?? -.03, s, s, () => {
    ctx.globalAlpha *= clamp(k * 2);
    const label = o.label || 'L’équipe Bonzini', sub = o.sub || 'sur place', f1 = font(FF.body, 40, 800), f2 = font(FF.hand, 34, 700);
    const bars = 6, w = Math.max(measure(label, f1), measure(sub, f2)) + 120 + 36 + bars * 13 + 30, h = 120;
    withShadow(10, () => { ctx.fillStyle = TEX.kraft || C.kraft; rrect(-w / 2, -h / 2, w, h, 18); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 2; rrect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 14); ctx.stroke();
    // mic disc
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(-w / 2 + 62, 0, 40, 0, 7); ctx.fill();
    ctx.fillStyle = C.cream; rrect(-w / 2 + 52, -24, 20, 34, 10); ctx.fill(); ctx.strokeStyle = C.cream; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-w / 2 + 62, 0, 17, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w / 2 + 62, 17); ctx.lineTo(-w / 2 + 62, 26); ctx.stroke();
    text(label, -w / 2 + 120, -6, { font: f1, color: C.ink });
    text(sub, -w / 2 + 120, 36, { font: f2, color: C.violetD });
    // waveform (on twos)
    const bx = w / 2 - 30 - bars * 13, st = Math.floor(n / 2);
    for (let i = 0; i < bars; i++) { const a = o.live ? .25 + .75 * rnd(i * 7.3 + st * 1.7) : .18; ctx.fillStyle = C.violet; rrect(bx + i * 13, -a * 30, 8, a * 60, 4); ctx.fill(); }
  });
}
