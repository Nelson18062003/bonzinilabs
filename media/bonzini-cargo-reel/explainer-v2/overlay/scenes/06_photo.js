'use strict';
// =============================================================================================
// REAL PHOTOS × PAPER — helpers to mix real-world photos (window.PH[name], loaded by render.mjs)
// with the Kraft & Fil table. Everything is cached per (photo, treatment) on offscreen canvases.
// =============================================================================================
const _phCache = {};
function ph(name) { return (window.PH || {})[name] || null; }
/** draw photo `name` into the rect (x,y,w,h) with "cover" fit; focus fx,fy ∈ 0..1, zoom ≥ 1 (Ken Burns), source = image or canvas */
function photoCover(src, x, y, w, h, o = {}) {
  const im = typeof src === 'string' ? ph(src) : src; if (!im) { ctx.fillStyle = '#9a9a9a'; ctx.fillRect(x, y, w, h); return; }
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, z = o.zoom || 1;
  const s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s;
  const fx = o.fx ?? .5, fy = o.fy ?? .5, sx = clamp(fx * iw - sw / 2, 0, iw - sw), sy = clamp(fy * ih - sh / 2, 0, ih - sh);
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
/** processed copy of a photo (duotone / xray / mono), cached. kind: 'duo' (cols [dark, light]), 'xray', 'mono' */
function photoFx(name, kind, cols) {
  const key = name + '|' + kind + '|' + (cols || []).join(','); if (_phCache[key]) return _phCache[key];
  const im = ph(name); if (!im) return null;
  const maxW = 1400, sc = Math.min(1, maxW / im.naturalWidth), w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
  const c = makeCanvas(w, h), g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  if (kind === 'duo' || kind === 'mono') {
    const [a, b] = (cols || ['#231629', '#F2EADB']).map(hex);
    for (let i = 0; i < p.length; i += 4) { let l = (p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) / 255; l = clamp((l - .08) / .84); l = l * l * (3 - 2 * l);
      p[i] = a[0] + (b[0] - a[0]) * l; p[i + 1] = a[1] + (b[1] - a[1]) * l; p[i + 2] = a[2] + (b[2] - a[2]) * l; }
  } else if (kind === 'xray') {
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) L[j] = (p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = y * w + x, gx = x > 0 && x < w - 1 ? L[j + 1] - L[j - 1] : 0, gy = y > 0 && y < h - 1 ? L[j + w] - L[j - w] : 0;
      const e = Math.min(1, Math.hypot(gx, gy) * 3.2), inv = 1 - L[j], v = clamp(inv * .55 + e * .9);
      const i = j * 4; p[i] = 20 + 90 * v; p[i + 1] = 40 + 200 * v; p[i + 2] = 70 + 185 * v;
    }
  }
  g.putImageData(d, 0, 0); _phCache[key] = c; return c;
}
/** a photo print lying on the table: white border, slight curl shadow, optional tape, caption under it (polaroid) */
function photoPrint(name, w, h, o = {}) {
  const b = o.border ?? 16, cap = o.caption ? 64 : 0;
  ctx.save();
  withShadow(o.lift ?? 12, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + cap); });
  ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
  const src = o.fx_kind ? photoFx(name, o.fx_kind, o.cols) : name;
  if (o.develop != null && o.develop < 1) { photoCover(src, -w / 2, -h / 2, w, h, o); ctx.fillStyle = `rgba(250,248,240,${1 - clamp(o.develop)})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
  else photoCover(src, -w / 2, -h / 2, w, h, o);
  if (o.scan) o.scan(-w / 2, -h / 2, w, h);                // extra FX drawn inside the photo (x-ray, loupe…)
  // print gloss + inner vignette
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  if (o.caption) text(o.caption, 0, h / 2 + b + 44, { font: font(FF.hand, 40, 800), align: 'center', color: C.ink });
  if (o.tape !== false) { ctx.fillStyle = C.tape; at(-w / 2 + 20, -h / 2 - b + 2, -.55, 1, 1, () => ctx.fillRect(-55, -18, 110, 36)); at(w / 2 - 20, -h / 2 - b + 2, .55, 1, 1, () => ctx.fillRect(-55, -18, 110, 36)); }
  if (o.credit) text(o.credit, w / 2, h / 2 + b + cap - 4 + (cap ? 0 : 22), { font: font(FF.body, 18, 600), align: 'right', color: 'rgba(35,22,41,.55)' });
  ctx.restore();
}
/** x-ray scanner pass over a photo rect: left of the beam = x-ray, the beam = glowing line; reveal ∈ 0..1 */
function xrayPass(name, x, y, w, h, reveal, o = {}) {
  const xr = photoFx(name, 'xray'); if (!xr) return;
  const bx = x + w * clamp(reveal);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, bx - x, h); ctx.clip(); photoCover(xr, x, y, w, h, o);
  if (o.inside) o.inside(x, y, w, h);                     // drawn cartons revealed inside the container
  ctx.restore();
  if (reveal > 0 && reveal < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(bx - 40, 0, bx + 8, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(1, 'rgba(160,240,255,.9)');
    ctx.fillStyle = g; ctx.fillRect(bx - 40, y, 48, h); ctx.fillStyle = 'rgba(220,250,255,.95)'; ctx.fillRect(bx - 2, y, 4, h); ctx.restore(); }
}
/** magnifying glass over the current canvas content: draws a lens at (cx,cy) radius r showing `drawFn` zoomed by k */
function loupe(cx, cy, r, k, drawFn) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); drawFn(); ctx.restore();
  ctx.save(); ctx.strokeStyle = '#2B2230'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r - 12, 3.6, 4.6); ctx.stroke();
  ctx.fillStyle = '#2B2230'; at(cx + r * .72, cy + r * .72, .78, 1, 1, () => rrect(0, -18, r * .9, 36, 16)); ctx.fill(); ctx.restore();
}
/** warm light leak across the frame (additive), p = 0..1 life, seed varies the shape */
function lightLeak(p, seed = 1) {
  if (p <= 0 || p >= 1) return; const a = Math.sin(p * Math.PI);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const x = lerp(-200, W + 200, rnd(seed + i) * .6 + p * .6), y = H * (.2 + rnd(seed * 3 + i) * .6), r = 500 + rnd(seed + i * 7) * 500;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = i % 2 ? '254,86,13' : '243,167,69';
    g.addColorStop(0, `rgba(${c},${.35 * a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
  ctx.restore();
}
/** official-looking but generic customs stamp (never a real emblem): round, double ring, text around */
function roundStamp(txt, center, r, color, o = {}) {
  const oc = makeCanvasCached('rstamp', 520, 520), g = oc.getContext('2d'); g.clearRect(0, 0, 520, 520); g.save(); g.translate(260, 260); g.rotate(o.rot || 0);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = r * .07; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.lineWidth = r * .03; g.beginPath(); g.arc(0, 0, r * .78, 0, 7); g.stroke();
  g.font = `800 ${r * .2}px ${FF.stencil}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...txt], step = (Math.PI * 1.7) / chars.length; chars.forEach((ch, i) => { g.save(); g.rotate(-Math.PI * .85 + i * step); g.translate(0, -r * .89); g.fillText(ch, 0, 0); g.restore(); });
  g.font = `900 ${r * .34}px ${FF.stencil}`; g.fillText(center, 0, r * .04);
  g.restore(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .5; g.drawImage(TEX.starve, 0, 0, 520, 520); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(oc, -260, -260); ctx.restore();
}
