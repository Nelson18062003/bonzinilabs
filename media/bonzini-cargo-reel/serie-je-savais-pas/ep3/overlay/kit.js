'use strict';
// =============================================================================================
// « KRAFT & FIL » kit — a packing table seen from above, cut-paper stop-motion.
// Everything is a pure function of (t, n): t = seconds (continuous, may be a motion-blur
// sub-frame), n = integer frame (use it for stepped "on twos" poses so sub-frames don't ghost).
// =============================================================================================
const W = 1080, H = 1920, FPS = 30;
const C = {
  table: '#F2EADB', cream: '#FBF6EC', kraft: '#C79E6C', kraftD: '#9C7447', kraftL: '#E6C79C', fibre: '#8A6238',
  ink: '#231629', inkSoft: '#4A3A52', violet: '#A947FE', violetD: '#7B22D6', amber: '#F3A745', orange: '#FE560D',
  sea: '#0B5FA5', air: '#C8102E', shadow: 'rgba(60,32,12,', tape: 'rgba(243,167,69,.82)', white: '#FFFFFF',
};
const FF = { stencil: 'Stencil', body: 'Brico', mono: 'Martian', hand: 'Shantell', brand: 'DMSans', cjk: 'WenQuanYi Zen Hei' };
const cv = document.getElementById('c');
let ctx = cv.getContext('2d');
let TLD = null, LOGO = [];

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const eOutCubic = x => 1 - Math.pow(1 - x, 3), eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eOutBack = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
function rnd(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
/** damped spring response 0→1 (overshoot), t seconds since trigger */
function spring(t, w = 14, z = 0.4) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
/** fall with gravity then land with squash; returns {y (0 = landed), sx, sy} for an object dropped at t0 from height h0 */
function drop(t, t0, h0 = 600, dur = .32) {
  if (t < t0) return { y: -h0, sx: 1, sy: 1, landed: false, a: 0 };
  const k = (t - t0) / dur;
  if (k < 1) return { y: -h0 * (1 - k * k), sx: 1 - .06 * k, sy: 1 + .08 * k, landed: false, a: 1 };
  const s = t - t0 - dur, sq = Math.exp(-s * 9) * Math.cos(s * 38) * .12;
  return { y: 0, sx: 1 + sq, sy: 1 - sq, landed: true, a: 1 };
}
/** stepped time (on twos): stop-motion cadence */
const stepT = (n, k = 2) => Math.floor(n / k) * k / FPS;
/** hand-placed jitter for touched objects, changes every 2 frames */
function jit(id, n, amt = 1) {
  const s = Math.floor(n / 2);
  return { x: (rnd(id * 7.1 + s * 1.3) - .5) * 3 * amt, y: (rnd(id * 3.7 + s * 2.1) - .5) * 3 * amt, r: (rnd(id * 5.3 + s * .7) - .5) * .01 * amt };
}
function env(t, a, b, fin = .25, fout = .25) {
  if (t < a || t > b) return 0;
  return Math.min(fin > 0 ? eOutCubic(clamp((t - a) / fin)) : 1, fout > 0 ? clamp((b - t) / fout) : 1);
}

// ---------- timeline API ----------
const nrm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const TL = {
  ch(id) { return TLD.chapters.find(c => c.id === id) || { id, start: 1e5, end: 1e5 }; },
  seg(id) { return TLD.segments.find(s => s.id === id) || { id, start: 1e5, end: 1e5, words: [] }; },   // missing segment (provisional timeline) = far future
  word(seg, str, nth = 0) {
    const s = this.seg(seg); if (!s) return null; const k = nrm(str); let c = 0;
    for (const w of s.words) { const f = [nrm(w.w), nrm(w.w.replace(/^(?:[a-zA-Z]{1,2}|qu|jusqu)['’]/i, ''))];
      if (f.some(x => x.startsWith(k))) { if (c++ === nth) return w; } }
    return null;
  },
  wt(seg, str, fb = null, nth = 0) { const w = this.word(seg, str, nth); return w ? w.s : (fb ?? this.seg(seg).start); },
  we(seg, str, fb = null, nth = 0) { const w = this.word(seg, str, nth); return w ? w.e : (fb ?? this.seg(seg).end); },
  in(t, id, a = 0, b = 0) { const c = this.ch(id); return t >= c.start - a && t < c.end + b; },
};

const SCENES = [];
function registerScene(s) { SCENES.push(s); SCENES.sort((a, b) => (a.z || 0) - (b.z || 0)); }

// ---------- paper textures (generated once, deterministic) ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let TEX = {};
function buildTextures() {
  // table: cream paper with fibres + soft mottling
  const tb = makeCanvas(W, H), g = tb.getContext('2d');
  g.fillStyle = C.table; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = rnd(i * 1.1) * W, y = rnd(i * 2.3) * H, a = rnd(i * 3.7) * Math.PI, l = 4 + rnd(i * 4.1) * 14;
    g.strokeStyle = rnd(i * 5.9) > .5 ? 'rgba(150,115,75,.07)' : 'rgba(255,255,255,.4)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = rnd(i * 9.1) * W, y = rnd(i * 7.7) * H, r = 60 + rnd(i * 6.3) * 220;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); const col = rnd(i) > .45 ? '255,252,244' : '226,204,168'; rg.addColorStop(0, `rgba(${col},${rnd(i) > .45 ? .16 : .06})`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const vg = g.createRadialGradient(W / 2, H * .45, H * .42, W / 2, H * .5, H * .9);
  vg.addColorStop(0, 'rgba(120,80,40,0)'); vg.addColorStop(1, 'rgba(120,80,40,.10)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  TEX.table = tb;
  // kraft pattern (tileable-ish 512)
  const kp = makeCanvas(512, 512), k = kp.getContext('2d');
  k.fillStyle = C.kraft; k.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const x = rnd(i * 1.9 + 3) * 512, y = rnd(i * 2.7 + 5) * 512, a = rnd(i * 3.1) * Math.PI, l = 3 + rnd(i * 4.3) * 10;
    k.strokeStyle = rnd(i * 6.1) > .55 ? 'rgba(138,98,56,.35)' : 'rgba(230,199,156,.45)'; k.lineWidth = rnd(i) > .8 ? 1.4 : .8;
    k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke();
  }
  TEX.kraft = ctx.createPattern(kp, 'repeat');
  // grain frames (8 variants, 540x960 upscaled when drawn)
  TEX.grain = [];
  for (let v = 0; v < 8; v++) {
    const gc = makeCanvas(540, 960), gg = gc.getContext('2d'), id = gg.createImageData(540, 960);
    for (let i = 0; i < id.data.length; i += 4) { const r = rnd(i * .37 + v * 1013.1) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = r; id.data[i + 3] = 255; }
    gg.putImageData(id, 0, 0); TEX.grain.push(gc);
  }
  // ink starvation mask
  const im = makeCanvas(600, 300), m = im.getContext('2d');
  for (let i = 0; i < 1400; i++) { m.fillStyle = `rgba(0,0,0,${.25 + rnd(i * 2.2) * .6})`; const r = .6 + rnd(i * 3.3) * 2.4; m.beginPath(); m.arc(rnd(i * 1.3) * 600, rnd(i * 4.4) * 300, r, 0, 7); m.fill(); }
  TEX.starve = im;
}
function paperTable(n) { ctx.drawImage(TEX.table, 0, 0); }
function grain(n) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .10; ctx.drawImage(TEX.grain[Math.floor(n / 2) % 8], 0, 0, W, H); ctx.restore(); }

// ---------- shadows & primitives ----------
function withShadow(h, fn) {           // contact shadow for an object h px above the table
  ctx.save(); ctx.shadowColor = C.shadow + (.30 - .1 * clamp(h / 200)) + ')';
  ctx.shadowBlur = 6 + .5 * h; ctx.shadowOffsetX = 4 + .35 * h; ctx.shadowOffsetY = 7 + .6 * h; fn(); ctx.restore();
}
function rrect(x, y, w, h, r) { r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));   /* never negative (squashed sub-frames) */ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/** transform helper: translate to (x,y), rotate r, scale sx/sy, draw fn in local coords */
function at(x, y, r, sx, sy, fn) { ctx.save(); ctx.translate(x, y); if (r) ctx.rotate(r); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy); fn(); ctx.restore(); }
/** torn edge polyline between two points (deterministic) */
function tornLine(x0, y0, x1, y1, seed, amp = 4, step = 10) {
  const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, pts = [];
  for (let d = 0; d <= L; d += step) { const k = d / L, o = (rnd(seed + d * .37) - .5) * 2 * amp; pts.push([lerp(x0, x1, k) + nx * o, lerp(y0, y1, k) + ny * o]); }
  pts.push([x1, y1]); return pts;
}

// ---------- text ----------
function font(fam, size, wght = 700, extra = '') { return `${wght} ${size}px ${fam}`; }
function measure(s, f, ls = 0) { ctx.save(); ctx.font = f; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; }
function text(s, x, y, o = {}) {
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.font = o.font || font(FF.body, o.size || 56, o.wght || 800); ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.shadow) { ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; }
  ctx.fillStyle = o.color || C.ink; ctx.fillText(s, x, y); ctx.restore();
}
/** ink-stamped text: slight misregistration + starved ink */
function stampText(s, x, y, f, color, o = {}) {
  const w = measure(s, f, o.ls || 0), h = o.h || 140;
  const oc = makeCanvasCached('stamp', 1400, 420), g = oc.getContext('2d');
  g.clearRect(0, 0, 1400, 420); g.font = f; g.letterSpacing = (o.ls || 0) + 'px'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(s, 700, 210);
  if (o.box) { g.strokeStyle = color; g.lineWidth = o.boxW || 10; rrectOn(g, 700 - w / 2 - 34, 210 - h / 2, w + 68, h, 18); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.globalAlpha = o.starve ?? .55;
  g.drawImage(TEX.starve, 0, 0, 1400, 420); g.drawImage(TEX.starve, 300, 60, 900, 300);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(oc, x - 700, y - 210); ctx.restore();
}
const _cc = {};
function makeCanvasCached(k, w, h) { if (!_cc[k]) _cc[k] = makeCanvas(w, h); return _cc[k]; }
function rrectOn(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- objects ----------
/** top-down kraft carton centred at (0,0) (call inside at()); w,h size; opt: tape, seam, label draw fn, grey (0..1) */
function carton(w, h, o = {}) {
  const bev = o.bev ?? 14;
  // body with 2.5D bevel (visible side at bottom/right)
  ctx.save();
  ctx.fillStyle = C.kraftD; rrect(-w / 2 + bev * .4, -h / 2 + bev * .6, w, h, 6); ctx.fill();
  ctx.fillStyle = TEX.kraft; rrect(-w / 2, -h / 2, w, h, 5); ctx.fill();
  // corrugated cut edge highlight
  ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 2; rrect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 4); ctx.stroke();
  // flap seam
  if (o.seam !== false) { ctx.strokeStyle = 'rgba(90,60,30,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 0); ctx.lineTo(w / 2 - 6, 0); ctx.stroke(); }
  // tape
  if (o.tape !== false) {
    const tw = Math.min(64, h * .28); ctx.fillStyle = o.tapeColor || C.tape;
    ctx.beginPath(); const top = tornLine(-w / 2 - 6, -tw / 2, w / 2 + 6, -tw / 2, 11 + (o.seed || 0), 1.2, 8), bot = tornLine(w / 2 + 6, tw / 2, -w / 2 - 6, tw / 2, 19 + (o.seed || 0), 1.2, 8);
    ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2, -tw / 2 + 4, w, 5);
  }
  if (o.label) o.label();
  if (o.grey) { ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = o.grey * .8; ctx.fillStyle = '#b9b0a4'; rrect(-w / 2, -h / 2, w + bev, h + bev, 6); ctx.fill(); }
  ctx.restore();
}
/** pseudo QR code (deterministic) */
function qr(x, y, s, seed = 7, color = C.ink) {
  const N = 21, c = s / N; ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(x - c, y - c, s + 2 * c, s + 2 * c); ctx.fillStyle = color;
  const finder = (i, j) => { ctx.fillRect(x + i * c, y + j * c, 7 * c, 7 * c); ctx.fillStyle = '#fff'; ctx.fillRect(x + (i + 1) * c, y + (j + 1) * c, 5 * c, 5 * c); ctx.fillStyle = color; ctx.fillRect(x + (i + 2) * c, y + (j + 2) * c, 3 * c, 3 * c); };
  finder(0, 0); finder(14, 0); finder(0, 14);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if ((i < 8 && j < 8) || (i > 12 && j < 8) || (i < 8 && j > 12)) continue;
    if (rnd(seed * 97 + i * 31 + j * 7) > .52) ctx.fillRect(x + i * c, y + j * c, c + .5, c + .5);
  }
  ctx.restore();
}
/** Bonzini shipping label (like src/lib/shippingLabelCanvas.ts): mode 'sea' (blue band, ship) | 'air' (red hatched band, plane) */
function shipLabel(w, h, mode = 'sea', code = 'BZ-482913', o = {}) {
  const band = mode === 'sea' ? C.sea : C.air;
  ctx.save();
  ctx.fillStyle = C.cream; rrect(-w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 2; ctx.stroke();
  const bh = h * .2; ctx.save(); rrect(-w / 2, -h / 2, w, bh, 10); ctx.clip(); ctx.fillStyle = band; ctx.fillRect(-w / 2, -h / 2, w, bh);
  if (mode === 'air') { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = bh * .12; for (let x = -w; x < w; x += bh * .4) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + bh); ctx.lineTo(x + bh, -h / 2); ctx.stroke(); } }
  ctx.restore();
  const s = w / 600;
  ctx.fillStyle = '#fff'; ctx.font = font(FF.body, 34 * s, 800); ctx.textBaseline = 'middle';
  ctx.fillText(mode === 'sea' ? 'SEA CARGO' : 'AIR CARGO', -w / 2 + 96 * s, -h / 2 + bh / 2);
  ctx.font = `${30 * s}px ${FF.cjk}`; ctx.textAlign = 'right'; ctx.fillText(mode === 'sea' ? '海运' : '空运', w / 2 - 24 * s, -h / 2 + bh / 2);
  ctx.textAlign = 'left';
  at(-w / 2 + 52 * s, -h / 2 + bh / 2, 0, s * .9, s * .9, () => mode === 'sea' ? iconShip('#fff') : iconPlane('#fff'));
  qr(-w / 2 + 28 * s, -h / 2 + bh + 26 * s, 170 * s, o.seed || 7);
  ctx.fillStyle = C.inkSoft; ctx.font = `${24 * s}px ${FF.cjk}`; ctx.fillText('客户编号 · Customer ID', -w / 2 + 230 * s, -h / 2 + bh + 52 * s);
  ctx.fillStyle = C.ink; ctx.font = font(FF.mono, 62 * s, 800); ctx.fillText(code, -w / 2 + 226 * s, -h / 2 + bh + 122 * s);
  ctx.fillStyle = C.inkSoft; ctx.font = font(FF.body, 22 * s, 600); ctx.fillText('Scanned on arrival', -w / 2 + 230 * s, -h / 2 + bh + 180 * s);
  ctx.restore();
}
function iconShip(col = C.ink) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(26, 2); ctx.lineTo(18, 16); ctx.lineTo(-20, 16); ctx.closePath(); ctx.fill();
  ctx.fillRect(-14, -10, 12, 10); ctx.fillRect(0, -10, 12, 10); ctx.fillRect(-7, -20, 12, 9); ctx.restore();
}
function iconPlane(col = C.ink) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(26, 0); ctx.lineTo(4, -4); ctx.lineTo(-8, -22); ctx.lineTo(-14, -22); ctx.lineTo(-6, -4); ctx.lineTo(-20, -3); ctx.lineTo(-26, -12); ctx.lineTo(-30, -12);
  ctx.lineTo(-26, 0); ctx.lineTo(-30, 12); ctx.lineTo(-26, 12); ctx.lineTo(-20, 3); ctx.lineTo(-6, 4); ctx.lineTo(-14, 22); ctx.lineTo(-8, 22); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
}
/** violet thread along points with progress p (0..1), gentle boil on twos */
function thread(pts, p, n, o = {}) {
  if (p <= 0 || pts.length < 2) return null;
  const s = Math.floor(n / 2) % 3, L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1], lim = p * tot; let head = pts[0];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      if (L[i] <= lim) { const b = (rnd(i * 13 + s) - .5) * 1.6; ctx.lineTo(pts[i][0] + b, pts[i][1] - b); head = pts[i]; }
      else { const k = (lim - L[i - 1]) / (L[i] - L[i - 1]); head = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; ctx.lineTo(head[0], head[1]); break; }
    } };
  ctx.strokeStyle = 'rgba(60,20,90,.22)'; ctx.lineWidth = (o.w || 7) + 3; ctx.translate(3, 5); path(); ctx.stroke(); ctx.translate(-3, -5);
  ctx.strokeStyle = o.color || C.violet; ctx.lineWidth = o.w || 7; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 9]); path(); ctx.stroke();
  ctx.restore(); return head;
}
/** smooth curve points through control points (Catmull-Rom) */
function curve(ctrl, seg = 14) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) { const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(ctrl[ctrl.length - 1]); return out;
}
/** paper tag with an amber grommet (ticket) centred at (0,0) */
function ticket(w, h, title, sub, o = {}) {
  ctx.save();
  ctx.fillStyle = o.fill || C.cream; ctx.beginPath(); ctx.moveTo(-w / 2 + 34, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 34, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(35,22,41,.15)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 15, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 7, 0, 7); ctx.fill();
  text(title, -w / 2 + 70, sub ? -4 : 16, { size: o.size || 46, wght: 800, color: o.color || C.ink });
  if (sub) text(sub, -w / 2 + 70, 38, { size: 34, wght: 600, color: C.inkSoft });
  if (o.done) { ctx.save(); ctx.strokeStyle = C.violetD; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath();
    const p = clamp(o.done), x0 = w / 2 - 70, y0 = 2; ctx.moveTo(x0 - 18, y0); ctx.lineTo(x0 - 18 + 12 * clamp(p * 2), y0 + 12 * clamp(p * 2));
    if (p > .5) ctx.lineTo(x0 - 6 + 26 * clamp(p * 2 - 1), y0 + 12 - 30 * clamp(p * 2 - 1)); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
/** strip of paper with text, slightly rotated — for headings */
function paperNote(x, y, w, h, rot, fn, o = {}) {
  at(x, y, rot, 1, 1, () => {
    withShadow(o.h ?? 10, () => { ctx.fillStyle = o.fill || C.cream; ctx.beginPath(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 3 + (o.seed || 0), 2.5, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 9 + (o.seed || 0), 2.5, 12);
      ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    if (o.tape !== false) { ctx.fillStyle = C.tape; at(-w / 2 + 10, -h / 2 + 4, -.5, 1, 1, () => ctx.fillRect(-45, -16, 90, 32)); at(w / 2 - 10, -h / 2 + 4, .5, 1, 1, () => ctx.fillRect(-45, -16, 90, 32)); }
    fn();
  });
}
function drawLogo(x, y, size, o = {}) {
  const s = size / 100;
  for (const pc of LOGO) {
    const off = (o.offsets && o.offsets[pc.role]) || [0, 0, 0, 1];
    ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1) * (off[3] ?? 1); ctx.translate(x + off[0], y + off[1]); ctx.rotate(off[2] || 0); ctx.scale(s, s); ctx.translate(-50, -50);
    ctx.fillStyle = pc.fill; ctx.fill(pc.path); ctx.restore();
  }
}

// ---------- devices ----------
function scanner(beam = 0) {             // handheld barcode scanner, nose pointing left, local origin at the window
  ctx.save();
  ctx.fillStyle = '#2B2230'; rrect(0, -46, 230, 92, 30); ctx.fill();
  ctx.fillStyle = '#3A3040'; rrect(150, 20, 70, 170, 26); ctx.fill();               // grip
  ctx.fillStyle = C.orange; rrect(186, 44, 22, 46, 8); ctx.fill();                  // trigger
  ctx.fillStyle = beam > 0 ? '#FF3B2F' : '#7A1E18'; rrect(-8, -34, 22, 68, 8); ctx.fill();
  ctx.restore();
}
function laser(x0, y0, x1, ya, yb, k) {  // red fan from the scanner window to a vertical span
  if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k;
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,59,47,.55)'); g.addColorStop(1, 'rgba(255,59,47,.12)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0 - 6); ctx.lineTo(x1, ya); ctx.lineTo(x1, yb); ctx.lineTo(x0, y0 + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FF3B2F'; ctx.fillRect(x1 - 3, ya, 6, yb - ya); ctx.restore();
}
function chip(x, y, label, o = {}) {      // rounded chip with optional check
  const f = font(FF.body, o.size || 46, 800), w = measure(label, f) + (o.check ? 110 : 64), h = (o.size || 46) * 1.7;
  at(x, y, o.rot || 0, o.s || 1, o.s || 1, () => withShadow(8, () => {
    ctx.fillStyle = o.fill || C.ink; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
    if (o.check) { ctx.fillStyle = o.checkFill || C.violet; ctx.beginPath(); ctx.arc(-w / 2 + h / 2, 0, h / 2 - 8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(-w / 2 + h / 2 - 12, 1); ctx.lineTo(-w / 2 + h / 2 - 3, 11); ctx.lineTo(-w / 2 + h / 2 + 13, -10); ctx.stroke(); }
    text(label, o.check ? -w / 2 + h + 10 : 0, (o.size || 46) * .36, { font: f, color: o.color || C.cream, align: o.check ? 'left' : 'center' });
  }));
}
function scaleDevice(w, k) {             // platform scale (top view) with a round dial; k = needle settle 0..1
  ctx.save();
  ctx.fillStyle = '#D9D2C4'; rrect(-w / 2, -w * .08, w, w * .5, 18); ctx.fill();
  ctx.fillStyle = '#EDE7DB'; rrect(-w / 2 + 14, -w * .08 + 12, w - 28, w * .5 - 24, 12); ctx.fill();
  const dx = 0, dy = w * .5; ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(dx, dy, 74, 0, 7); ctx.fill();
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(dx, dy, 60, 0, 7); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = -Math.PI * .8 + i * Math.PI * 1.6 / 11; ctx.beginPath(); ctx.moveTo(dx + Math.cos(a) * 48, dy + Math.sin(a) * 48); ctx.lineTo(dx + Math.cos(a) * 58, dy + Math.sin(a) * 58); ctx.stroke(); }
  const a = -Math.PI * .8 + Math.PI * 1.6 * (.62 * k + .03 * Math.sin(k * 20) * (1 - k));
  ctx.strokeStyle = C.orange; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(a) * 46, dy + Math.sin(a) * 46); ctx.stroke();
  text('kg', dx, dy + 34, { font: font(FF.mono, 22, 700), align: 'center', color: C.inkSoft });
  ctx.restore();
}
function tapeMeasure(len, k, vertical = false) {   // amber tape with ticks, extends to len*k
  const L = len * k; if (L <= 1) return; ctx.save(); if (vertical) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#F6C54A'; ctx.fillRect(0, -14, L, 28); ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  for (let x = 10; x < L; x += 20) { ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x, x % 100 < 20 ? 4 : -4); ctx.stroke(); }
  ctx.fillStyle = '#2B2230'; rrect(-40, -34, 46, 68, 12); ctx.fill(); ctx.restore();
}
