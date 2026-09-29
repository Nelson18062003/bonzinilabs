'use strict';
// ============================================================================================
// Explainer overlay kit. Every scene is a pure function of t (seconds on the final timeline).
// Globals available to scenes: W, H, FPS, ctx (swappable), TL (timeline API), CONFIG, LOGO,
// palette constants, easing, drawing helpers below, registerScene().
// ============================================================================================
const W = 1080, H = 1920, FPS = 30;
const VIOLET = '#A947FE', AMBER = '#F3A745', ORANGE = '#FE560D', ICE = '#EAF6FF', CYAN = '#5CF0FF', INK = '#0B0718', NAVY = '#120A2A';
const FONT = { display: 'Orbitron', ui: 'Chakra', body: 'DMSans', mono: 'Mono', grot: 'Grotesk' };
const cv = document.getElementById('c');
let ctx = cv.getContext('2d');
let CONFIG = {}, LOGO = [];

// ---------------- math / easing ----------------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const eOutElastic = x => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1;
function rnd(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
/** envelope: 0 outside [a,b], eased ramp in over fin, ramp out over fout */
function env(t, a, b, fin = .3, fout = .3) {
  if (t < a || t > b) return 0;
  return Math.min(fin > 0 ? eOutCubic(clamp((t - a) / fin)) : 1, fout > 0 ? clamp((b - t) / fout) : 1);
}
const GLYPHS = '01<>/#%&*+=ABCDEFHKMNPRSTXZ';
function decrypt(text, p, seed = 1) {
  if (p >= 1) return text;
  const n = text.length, k = Math.floor(p * (n + 3)); let s = '';
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === ' ') { s += ' '; continue; }
    if (i < k - 3) s += ch; else if (i < k) s += GLYPHS[Math.floor(rnd(seed * 31 + i * 7 + Math.floor(p * 40)) * GLYPHS.length)]; else s += ' ';
  }
  return s;
}

// ---------------- timeline API ----------------
const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const TL = {
  data: null,
  get duration() { return this.data.duration; },
  ch(id) { return this.data.chapters.find(c => c.id === id); },
  seg(id) { return this.data.segments.find(s => s.id === id); },
  /** word timing {w,s,e} in segment segId whose normalised text starts with `str` (nth occurrence) */
  word(segId, str, nth = 0) {
    const s = this.seg(segId); if (!s || !s.words) return null; const k = norm(str); let c = 0;
    // match the word with or without a French elided prefix: "l'achat" matches 'achat' and 'lachat'
    const forms = w => [norm(w), norm(w.replace(/^(?:[a-zA-Z]{1,2}|qu|jusqu)['’]/i, ''))];
    for (const w of s.words) if (forms(w.w).some(f => f.startsWith(k))) { if (c++ === nth) return w; }
    return null;
  },
  /** start time of a word, with fallback */
  wt(segId, str, fallback = null, nth = 0) { const w = this.word(segId, str, nth); return w ? w.s : (fallback ?? this.seg(segId)?.start ?? 0); },
  chAt(t) { return this.data.chapters.find(c => t >= c.start && t < c.end) || this.data.chapters[this.data.chapters.length - 1]; },
  segAt(t) { return this.data.segments.find(s => t >= s.start && t < s.end) || null; },
  in(t, id, padA = 0, padB = 0) { const c = this.ch(id); return c && t >= c.start - padA && t < c.end + padB; },
  shotAt(t) { return this.data.shots.find(s => t >= s.start && t < s.end) || null; },
};

// ---------------- scenes ----------------
const SCENES = [];
function registerScene(s) { SCENES.push(s); SCENES.sort((a, b) => (a.z || 0) - (b.z || 0)); }

// ---------------- text ----------------
function setFont(size, weight = 700, fam = FONT.body) { ctx.font = `${weight} ${size}px ${fam}`; }
function measure(s, font, ls = 0) { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; }
/** text with legibility defaults: soft shadow always, optional stroke/glow. o.font or (size, weight, fam). */
function txt(s, x, y, o = {}) {
  ctx.save();
  ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.font = o.font || `${o.weight || 700} ${o.size || 44}px ${o.fam || FONT.body}`;
  ctx.letterSpacing = (o.ls ?? 0) + 'px';
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = o.shadowBlur ?? 14; ctx.shadowOffsetY = 3; }
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || 'rgba(8,5,20,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 22; ctx.shadowOffsetY = 0; }
  ctx.fillStyle = o.color || '#FFFFFF';
  ctx.fillText(s, x, y);
  if (o.glow && o.glowTwice) ctx.fillText(s, x, y);
  ctx.restore();
}
/** wrap text into lines that fit maxW */
function wrap(s, font, maxW, ls = 0) {
  const words = s.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (measure(tryS, font, ls) <= maxW || !cur) cur = tryS; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur); return lines;
}
/** reveal text with a moving mask from left (p 0..1) */
function wipeText(s, x, y, p, o = {}) {
  if (p <= 0) return;
  const w = measure(s, o.font || `${o.weight || 700} ${o.size || 44}px ${o.fam || FONT.body}`, o.ls || 0);
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, y - (o.size || 44) * 1.3, (w + 40) * eOutCubic(p), (o.size || 44) * 1.8); ctx.clip();
  txt(s, x, y + (1 - eOutCubic(p)) * 10, o); ctx.restore();
}

// ---------------- shapes ----------------
function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/** solid readable plate behind text */
function plate(x, y, w, h, o = {}) {
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  rrect(x, y, w, h, o.r ?? 18);
  ctx.fillStyle = o.fill || 'rgba(12,7,28,.86)'; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (o.border !== false) { ctx.strokeStyle = o.border || 'rgba(169,71,254,.85)'; ctx.lineWidth = o.lw ?? 2.5; ctx.stroke(); }
  if (o.accent) { ctx.fillStyle = o.accent; rrect(x, y + 14, 8, h - 28, 4); ctx.fill(); }
  ctx.restore();
}
function line(x0, y0, x1, y1, color = ICE, w = 3, alpha = 1, glow = null) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
}
function ring(x, y, r, color, w, alpha, glow = color) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.shadowColor = glow; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function brackets(x0, y0, x1, y1, arm, color = ICE, w = 4, alpha = 1, glow = VIOLET) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'square'; ctx.shadowColor = glow; ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + arm); ctx.lineTo(x0, y0); ctx.lineTo(x0 + arm, y0);
  ctx.moveTo(x1 - arm, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + arm);
  ctx.moveTo(x1, y1 - arm); ctx.lineTo(x1, y1); ctx.lineTo(x1 - arm, y1);
  ctx.moveTo(x0 + arm, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - arm);
  ctx.stroke(); ctx.restore();
}
/** partial path drawing: pts [[x,y]...], p 0..1 of total length */
function polyline(pts, p, color, w = 4, glow = null, dash = null) {
  if (p <= 0 || pts.length < 2) return null;
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let rem = p * tot; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; } if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); let head = pts[0];
  for (let i = 1; i < pts.length && rem > 0; i++) {
    const k = Math.min(1, rem / L[i - 1]); head = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
    ctx.lineTo(head[0], head[1]); rem -= L[i - 1];
  }
  ctx.stroke(); ctx.restore(); return head;
}
function checkMark(x, y, s, p, color = AMBER, w = null) {
  if (p <= 0) return;
  const pts = [[x - .45 * s, y + .02 * s], [x - .12 * s, y + .34 * s], [x + .5 * s, y - .36 * s]];
  polyline(pts, p, color, w || s * .15, color);
}
function shield(x, y, s, color = AMBER, alpha = 1, fill = 'rgba(12,7,28,.6)') {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * .09); ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .8, y - s * .65); ctx.lineTo(x + s * .72, y + s * .15);
  ctx.quadraticCurveTo(x + s * .5, y + s * .75, x, y + s); ctx.quadraticCurveTo(x - s * .5, y + s * .75, x - s * .72, y + s * .15);
  ctx.lineTo(x - s * .8, y - s * .65); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha *= alpha; checkMark(x, y + s * .02, s * .9, 1, color); ctx.restore();
}
function pin(x, y, s, color = ORANGE) {
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.arc(x, y - s * .55, s * .55, Math.PI * .85, Math.PI * 2.15); ctx.lineTo(x, y + s * .55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(12,7,28,.95)'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(x, y - s * .55, s * .22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
/** isometric box centred at (x,y) (top-face centre), size s, colours per face */
function isoBox(x, y, w, d, h, top, left, right, o = {}) {
  const c = Math.cos(Math.PI / 6), sn = .5;
  const P = (u, v, z) => [x + (u - v) * c, y + (u + v) * sn - z];
  const f = (pts, col) => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1.5; ctx.stroke(); } };
  const hw = w / 2, hd = d / 2;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  f([P(-hw, hd, h), P(hw, hd, h), P(hw, hd, 0), P(-hw, hd, 0)], left);        // front-left face
  f([P(hw, -hd, h), P(hw, hd, h), P(hw, hd, 0), P(hw, -hd, 0)], right);       // front-right face
  f([P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h)], top);       // top
  ctx.restore();
  return P;
}
/** cardboard parcel with tape (isometric) */
function parcel(x, y, s, o = {}) {
  const P = isoBox(x, y, s, s, s * .78, o.top || '#D9A86A', o.left || '#B9823F', o.right || '#9C6A2F', { alpha: o.alpha, stroke: 'rgba(60,35,10,.5)', lw: 1.2 });
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.strokeStyle = o.tape || 'rgba(255,240,210,.8)'; ctx.lineWidth = Math.max(2, s * .08);
  ctx.beginPath(); ctx.moveTo(...P(0, -s / 2, s * .78)); ctx.lineTo(...P(0, s / 2, s * .78)); ctx.lineTo(...P(0, s / 2, s * .45)); ctx.stroke();
  if (o.tag) { const q = P(s * .1, s / 2, s * .45); ctx.fillStyle = o.tag; ctx.beginPath(); ctx.arc(q[0] - s * .18, q[1] - s * .05, s * .12, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------------- logo ----------------
/** draw the Bonzini logo centred at (x,y), size = rendered width of the 100-unit viewBox; per-piece offsets optional */
function drawLogo(x, y, size, o = {}) {
  const s = size / 100;
  for (const pc of LOGO) {
    const off = (o.offsets && o.offsets[pc.role]) || [0, 0, 0, 1];
    ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1) * (off[3] ?? 1);
    ctx.translate(x + off[0], y + off[1]); ctx.rotate(off[2] || 0); ctx.scale(s, s); ctx.translate(-50, -50);
    if (o.glow !== false) { ctx.shadowColor = pc.fill; ctx.shadowBlur = (o.glowBlur ?? 20) / s; }
    ctx.fillStyle = o.mono || pc.fill; ctx.fill(pc.path); ctx.restore();
  }
}

// ---------------- backgrounds ----------------
/** motion-design background: deep ink gradient, perspective grid, drifting particles. alpha lets blurred footage show through */
function mgBackground(t, alpha = .9, o = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0E0824'); g.addColorStop(.55, '#140A30'); g.addColorStop(1, '#07040F');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, o.cy ?? 820, 0, W / 2, o.cy ?? 820, 900);
  rg.addColorStop(0, 'rgba(169,71,254,.22)'); rg.addColorStop(.5, 'rgba(254,86,13,.05)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(169,71,254,.10)'; ctx.lineWidth = 1;
  const off = (t * 18) % 60;
  for (let x = -60 + off; x < W + 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -60 + off; y < H + 60; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // particles
  for (let i = 0; i < 46; i++) {
    const x = rnd(i * 1.7) * W, sp = 12 + rnd(i * 2.9) * 40, y = (rnd(i * 4.1) * H - t * sp + H * 4) % H;
    ctx.globalAlpha = alpha * (.2 + .5 * rnd(i * 8.8)) * (.6 + .4 * Math.sin(t * 2 + i));
    ctx.fillStyle = i % 5 === 0 ? AMBER : i % 3 === 0 ? VIOLET : ICE;
    ctx.beginPath(); ctx.arc(x, y, 1 + rnd(i * 6.1) * 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------- glitch helper ----------------
const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
function glitched(fn, amount, seed, y0 = 0, y1 = H) {
  if (amount <= .001) { fn(); return; }
  octx.clearRect(0, 0, W, H);
  const main = ctx; ctx = octx; ctx.save(); fn(); ctx.restore(); ctx = main;
  let y = y0, i = 0;
  while (y < y1) {
    const h = 6 + Math.floor(rnd(seed * 17 + i) * 60);
    const dx = (rnd(seed * 29 + i * 3) - .5) * 2 * amount * (rnd(seed + i * 11) > .45 ? 110 : 12);
    ctx.drawImage(off, 0, y, W, h, dx, y, W, h); y += h; i++;
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 * amount;
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(-40deg)'; ctx.drawImage(off, 14 * amount, 0);
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(160deg)'; ctx.drawImage(off, -14 * amount, 0);
  ctx.restore();
}
