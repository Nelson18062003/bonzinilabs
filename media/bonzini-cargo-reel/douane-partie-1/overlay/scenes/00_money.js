'use strict';
// =============================================================================================
// « L'ARGENT » props — global helpers shared by every scene of "Votre vrai prix de revient".
// Stylised money only (never a replica of a real BEAC note). All functions draw around (0,0):
// call them inside at(x, y, rot, sx, sy, () => …).
// =============================================================================================
const M = {
  green: '#1F5B45', greenL: '#CFE3C9', greenM: '#7FB08F', paper: '#FFFDF7', red: '#D7261E', gold: '#E2B33F', goldD: '#A97A1E',
  silver: '#C9CDD2', silverD: '#8C939B', lcd: '#C6D6B0', lcdInk: '#233021', seyes: 'rgba(120,110,210,.30)', seyesD: 'rgba(120,110,210,.55)', margin: 'rgba(215,38,30,.55)',
  loss: '#D7261E', gain: '#14AE5C',
};
/** "1 250 000" — plain spaces (font-safe), rounded */
function fmtN(n) { const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (n < 0 ? '−' : '') + s; }
function fcfa(n, unit = ' F') { return fmtN(n) + unit; }
/** eased count-up between two values */
function countTo(a, b, k) { return a + (b - a) * eOutCubic(clamp(k)); }

// ---------------------------------------------------------------- banknote
const NOTE_HUE = { 10000: ['#CFE3C9', '#E7E4C4', '#1F5B45'], 5000: ['#E4D3EC', '#EFE3D6', '#5B2A6E'], 2000: ['#CFDDEE', '#E6E8DD', '#1D4577'], 1000: ['#F1DCC4', '#F3E9D3', '#7A3B12'], 500: ['#E9E1B8', '#F4EFD7', '#6A5A12'] };
/** stylised FCFA note, w×h centred. o: { value, clip:[x0,x1] (local, for cut slices), serial, alpha } */
function banknote(w, h, o = {}) {
  const v = o.value || 10000, [c0, c1, ink] = NOTE_HUE[v] || NOTE_HUE[10000];
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  if (o.clip) { ctx.beginPath(); ctx.rect(o.clip[0], -h / 2 - 4, o.clip[1] - o.clip[0], h + 8); ctx.clip(); }
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, c0); g.addColorStop(.55, c1); g.addColorStop(1, c0);
  ctx.fillStyle = g; rrect(-w / 2, -h / 2, w, h, h * .035); ctx.fill();
  // guilloche waves
  ctx.save(); rrect(-w / 2, -h / 2, w, h, h * .035); ctx.clip();
  ctx.lineWidth = Math.max(1, h * .004); ctx.strokeStyle = ink; ctx.globalAlpha *= .13;
  for (let i = 0; i < 26; i++) { ctx.beginPath(); for (let x = -w / 2; x <= w / 2; x += 8) { const y = -h / 2 + (i + .5) * h / 26 + Math.sin(x * .025 + i * .7) * h * .035; x === -w / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.globalAlpha /= .13 / .22;
  // rosette (left third) — the "watermark" zone
  const rx = -w * .28, rr = h * .3;
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(rx, 0, rr * 1.05, rr * 1.2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, h * .005);
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.ellipse(rx, 0, rr * .95, rr * .38, i * Math.PI / 18, 0, 7); ctx.stroke(); }
  ctx.restore();
  // frame
  ctx.strokeStyle = ink; ctx.globalAlpha *= .8; ctx.lineWidth = Math.max(1.5, h * .012); rrect(-w / 2 + h * .06, -h / 2 + h * .06, w - h * .12, h - h * .12, h * .03); ctx.stroke();
  ctx.lineWidth = Math.max(1, h * .005); rrect(-w / 2 + h * .09, -h / 2 + h * .09, w - h * .18, h - h * .18, h * .025); ctx.stroke(); ctx.globalAlpha /= .8;
  // value + legends
  const big = fmtN(v);
  text(big, w * .44 - h * .1, h * .12, { font: font(FF.brand, h * .36, 900), align: 'right', color: ink, ls: -h * .005 });
  text('FRANCS CFA', w * .44 - h * .1, h * .3, { font: font(FF.body, h * .1, 800), align: 'right', color: ink, ls: h * .02 });
  text(big, -w / 2 + h * .15, -h / 2 + h * .25, { font: font(FF.brand, h * .13, 900), color: ink });
  text(big, -w / 2 + h * .15, h / 2 - h * .14, { font: font(FF.brand, h * .1, 900), color: ink, alpha: .8 });
  text(o.serial || 'A 0482913', w * .44 - h * .1, -h * .27, { font: font(FF.mono, h * .08, 700), align: 'right', color: M.red });
  ctx.restore();
}
/** a fanned wad of notes; k = 0..1 how many are spread */
function noteFan(w, h, count, k, o = {}) {
  for (let i = 0; i < count; i++) { const a = (i - (count - 1) / 2) * .09 * k; at(Math.sin(a) * h * .6, -Math.cos(a) * h * .6 + h * .6, a, 1, 1, () => withShadow(4, () => banknote(w, h, { value: o.value, serial: 'A 04829' + (10 + i) }))); }
}
/** a stack of notes seen at an angle: n notes, top one fully drawn */
function noteStack(w, h, n, o = {}) {
  for (let i = 0; i < n; i++) { const dy = -i * 5; ctx.save(); ctx.translate((rnd(i * 3.1) - .5) * 8, dy); ctx.rotate((rnd(i * 5.7) - .5) * .05);
    if (i < n - 1) { ctx.fillStyle = (NOTE_HUE[o.value || 10000] || NOTE_HUE[10000])[1]; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.strokeStyle = 'rgba(31,91,69,.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else banknote(w, h, o);
    ctx.restore(); }
}

// ---------------------------------------------------------------- coins
function coin(r, label = '100', o = {}) {
  const gold = o.metal !== 'silver', base = gold ? M.gold : M.silver, dark = gold ? M.goldD : M.silverD;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, r * .12, r, r * (o.tilt ?? 1), 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r); g.addColorStop(0, gold ? '#FBE08A' : '#F1F3F5'); g.addColorStop(1, base);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * (o.tilt ?? 1), 0, 0, 7); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = r * .07; ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r * .8 * (o.tilt ?? 1), 0, 0, 7); ctx.stroke();
  ctx.save(); ctx.scale(1, o.tilt ?? 1); text(label, 0, r * .22, { font: font(FF.brand, r * .62, 900), align: 'center', color: dark }); ctx.restore();
  ctx.restore();
}
function coinStack(r, n, o = {}) { for (let i = 0; i < n; i++) at((rnd(i * 2.9) - .5) * r * .1, -i * r * .22, 0, 1, 1, () => coin(r, o.label || '500', { tilt: .42, metal: o.metal })); }

// ---------------------------------------------------------------- receipt (ticket de caisse)
/** rows: [{label, amount (number|string), k (0..1 reveal), color, bold, note}] ; returns total height.
 *  o: { title, sub, total:{label, amount, k, color}, lineH, fs } — paper grows as rows print */
function receipt(w, rows, o = {}) {
  const fs = o.fs || 34, lh = o.lineH || fs * 1.55, head = o.title ? fs * 3.2 : fs * .8;
  const shown = rows.filter(r => (r.k ?? 1) > 0).reduce((a, r) => a + (r.note ? 1.45 : 1), 0);
  const tot = o.total && (o.total.k ?? 0) > 0 ? fs * 3 : 0;
  const hgt = head + shown * lh + tot + fs * 1.4;
  ctx.save();
  withShadow(12, () => { ctx.fillStyle = M.paper; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2, hgt);
    const z = 18; for (let x = w / 2; x > -w / 2; x -= z) { ctx.lineTo(x - z / 2, hgt - 12); ctx.lineTo(x - z, hgt); } ctx.closePath(); ctx.fill(); });
  // thermal paper grain
  ctx.fillStyle = 'rgba(0,0,0,.025)'; for (let i = 0; i < 40; i++) ctx.fillRect(-w / 2, rnd(i * 7.3) * hgt, w, 1);
  const mono = font(FF.mono, fs, 600), monoB = font(FF.mono, fs, 800);
  if (o.title) { text(o.title, 0, fs * 1.5, { font: font(FF.mono, fs * 1.05, 800), align: 'center', color: C.ink, ls: 2 });
    if (o.sub) text(o.sub, 0, fs * 2.45, { font: font(FF.mono, fs * .62, 600), align: 'center', color: C.inkSoft });
    ctx.strokeStyle = 'rgba(35,22,41,.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 24, head - fs * .25); ctx.lineTo(w / 2 - 24, head - fs * .25); ctx.stroke(); ctx.setLineDash([]); }
  let y = head;
  for (const r of rows) {
    const k = r.k ?? 1; if (k <= 0) continue;
    y += lh; const yRow = y; if (r.note) y += lh * .45; ctx.save(); ctx.globalAlpha *= clamp(k * 3);
    // thermal "print" reveal left→right
    ctx.beginPath(); ctx.rect(-w / 2, yRow - lh, w * clamp(k * 1.6), lh * (r.note ? 1.45 : 1) + 4); ctx.clip();
    text(r.label, -w / 2 + 28, yRow - lh * .28, { font: r.bold ? monoB : mono, color: r.color || C.ink });
    const am = typeof r.amount === 'number' ? fmtN(r.amount) : (r.amount ?? '');
    text(am, w / 2 - 28, yRow - lh * .28, { font: r.bold ? monoB : mono, color: r.color || C.ink, align: 'right' });
    if (r.note) text(r.note, -w / 2 + 28, yRow + fs * .42, { font: font(FF.mono, fs * .6, 600), color: C.inkSoft });
    ctx.restore();
  }
  if (tot) { const k = o.total.k; y += fs * .9;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 24, y); ctx.lineTo(w / 2 - 24, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-w / 2 + 24, y + 7); ctx.lineTo(w / 2 - 24, y + 7); ctx.stroke();
    ctx.save(); ctx.globalAlpha *= clamp(k * 2);
    text(o.total.label || 'TOTAL', -w / 2 + 28, y + fs * 1.6, { font: font(FF.mono, fs * 1.12, 800), color: o.total.color || C.ink });
    const am = typeof o.total.amount === 'number' ? fmtN(o.total.amount) : o.total.amount;
    text(am, w / 2 - 28, y + fs * 1.6, { font: font(FF.mono, fs * 1.12, 800), color: o.total.color || C.ink, align: 'right' }); ctx.restore(); }
  ctx.restore(); return hgt;
}
/** receipt printer body (top view), slot at y=0, paper exits downward */
function receiptPrinter(w, o = {}) {
  ctx.save();
  withShadow(18, () => { ctx.fillStyle = '#2B2230'; rrect(-w / 2, -w * .42, w, w * .46, 26); ctx.fill(); });
  ctx.fillStyle = '#3A3040'; rrect(-w / 2 + 16, -w * .42 + 14, w - 32, w * .3, 18); ctx.fill();
  ctx.fillStyle = '#16111A'; rrect(-w / 2 + 30, -10, w - 60, 16, 6); ctx.fill();                 // slot
  ctx.fillStyle = o.led ? '#4DFF8A' : '#1E5B35'; ctx.beginPath(); ctx.arc(w / 2 - 50, -w * .32, 9, 0, 7); ctx.fill();
  if (o.brand) text('BONZINI', -w / 2 + 44, -w * .28, { font: font(FF.stencil, 34, 800), color: C.amber, ls: 5 });   // unbranded by default (never a logo next to a cost)
  ctx.restore();
}

// ---------------------------------------------------------------- price tag + hand lettering
/** hanging price tag, top-centre hole at (0,-h/2+30). o.fill, o.string (length up) */
function priceTag(w, h, fn, o = {}) {
  ctx.save();
  if (o.string) { ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -h / 2 + 30); ctx.bezierCurveTo(-20, -h / 2 - o.string * .4, 30, -h / 2 - o.string * .7, 0, -h / 2 - o.string); ctx.stroke(); }
  withShadow(10, () => { ctx.fillStyle = o.fill || C.cream; ctx.beginPath(); const c = w * .22;
    ctx.moveTo(-w / 2 + c, -h / 2); ctx.lineTo(w / 2 - c, -h / 2); ctx.lineTo(w / 2, -h / 2 + c); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h / 2 + c); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, -h / 2 + 30, 16, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, -h / 2 + 30, 8, 0, 7); ctx.fill();
  if (fn) fn();
  ctx.restore();
}
/** felt-marker text: o.write 0..1 reveals left→right with the pen at the head, o.strike 0..1 red cross-out */
function handText(s, x, y, size, o = {}) {
  const f = font(FF.hand, size, o.wght || 800), wd = measure(s, f), al = o.align || 'center';
  const x0 = al === 'center' ? x - wd / 2 : al === 'right' ? x - wd : x, k = o.write ?? 1;
  if (k <= 0) return { x0, wd };
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y - size * 1.1, (wd + 20) * k, size * 1.5); ctx.clip();
  text(s, x0, y, { font: f, color: o.color || C.ink });
  ctx.restore();
  if (k < 1 && o.pen !== false) marker(x0 + wd * k, y - size * .3, -.5, o.color || C.ink);
  if ((o.strike ?? 0) > 0) { const p = clamp(o.strike); ctx.save(); ctx.strokeStyle = o.strikeColor || M.red; ctx.lineWidth = Math.max(6, size * .09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 - 14, y - size * .28 + 8); ctx.lineTo(x0 - 14 + (wd + 28) * p, y - size * .38 - 6 * p); ctx.stroke();
    if (o.double && p > .5) { const q = (p - .5) * 2; ctx.beginPath(); ctx.moveTo(x0 - 10, y - size * .12); ctx.lineTo(x0 - 10 + (wd + 20) * q, y - size * .2 - 4 * q); ctx.stroke(); }
    ctx.restore(); }
  return { x0, wd };
}
/** felt marker pen, tip at (x,y) */
function marker(x, y, rot = -.5, col = C.ink) {
  at(x, y, rot, 1, 1, () => { ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 14;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, -22); ctx.lineTo(-12, -22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#EDE7DB'; rrect(-18, -150, 36, 130, 10); ctx.fill(); ctx.fillStyle = col; rrect(-19, -190, 38, 60, 10); ctx.fill(); ctx.restore(); });
}
/** hand-drawn arrow along control points, progress p */
function handArrow(ctrl, p, col = C.ink, w = 7) {
  if (p <= 0) return; const pts = curve(ctrl, 12), L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const lim = L[L.length - 1] * clamp(p); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...pts[0]);
  let hd = pts[0], pv = pts[0]; for (let i = 1; i < pts.length; i++) { if (L[i] > lim) break; ctx.lineTo(...pts[i]); pv = hd; hd = pts[i]; } ctx.stroke();
  if (p >= .98) { const a = Math.atan2(hd[1] - pv[1], hd[0] - pv[0]); ctx.beginPath(); ctx.moveTo(hd[0] - Math.cos(a - .5) * 30, hd[1] - Math.sin(a - .5) * 30); ctx.lineTo(...hd); ctx.lineTo(hd[0] - Math.cos(a + .5) * 30, hd[1] - Math.sin(a + .5) * 30); ctx.stroke(); }
  ctx.restore();
}
/** hand-drawn circle around (0,0) rx×ry, progress p */
function handCircle(rx, ry, p, col = M.red, w = 7, seed = 1) {
  if (p <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
  const N = 60, end = Math.floor(N * 1.12 * clamp(p)); for (let i = 0; i <= end; i++) { const a = -2.2 + i / N * Math.PI * 2, j = 1 + (rnd(seed + i * .3) - .5) * .05 + i / N * .06;
    const x = Math.cos(a) * rx * j, y = Math.sin(a) * ry * j; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
}

// ---------------------------------------------------------------- calculator
const CALC_KEYS = [['C', '÷', '×', '−'], ['7', '8', '9', '+'], ['4', '5', '6', '%'], ['1', '2', '3', '='], ['0', '00', ',', '=']];
function calculator(w, disp, o = {}) {
  const h = w * 1.45; ctx.save();
  withShadow(16, () => { ctx.fillStyle = '#2B2230'; rrect(-w / 2, -h / 2, w, h, 36); ctx.fill(); });
  ctx.fillStyle = '#3A3040'; rrect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 28); ctx.fill();
  ctx.fillStyle = M.lcd; rrect(-w / 2 + 40, -h / 2 + 44, w - 80, h * .2, 14); ctx.fill();
  ctx.fillStyle = 'rgba(35,48,33,.08)'; ctx.fillRect(-w / 2 + 48, -h / 2 + 44 + h * .2 - 26, w - 96, 10);
  const dsz = Math.min(h * .12, (w - 120) / Math.max(6, String(disp).length) * 1.55);
  text(String(disp), w / 2 - 64, -h / 2 + 44 + h * .15, { font: font(FF.mono, dsz, 700), align: 'right', color: o.dispColor || M.lcdInk });
  if (o.tag) text(o.tag, -w / 2 + 60, -h / 2 + 44 + 36, { font: font(FF.mono, 24, 700), color: M.lcdInk, alpha: .7 });
  const kx0 = -w / 2 + 40, ky0 = -h / 2 + 44 + h * .26, kw = (w - 80) / 4, kh = (h - (44 + h * .26) - 44) / 5;
  CALC_KEYS.forEach((row, j) => row.forEach((k, i) => {
    if (j === 4 && i === 3) return;
    const tall = k === '=' && j === 3, pressed = o.press === k, x = kx0 + i * kw + 8, y = ky0 + j * kh + 8 + (pressed ? 5 : 0), ww = kw - 16, hh = (tall ? kh * 2 : kh) - 16;
    ctx.fillStyle = pressed ? '#140F18' : 'rgba(0,0,0,.35)'; rrect(x + 2, y + 6, ww, hh, 16); ctx.fill();
    ctx.fillStyle = k === '=' ? C.orange : /[÷×−+%]/.test(k) ? C.amber : k === 'C' ? C.violet : '#EDE7DB'; rrect(x, y, ww, hh, 16); ctx.fill();
    text(k, x + ww / 2, y + hh / 2 + kh * .16, { font: font(FF.body, kh * .42, 800), align: 'center', color: k === '=' || k === 'C' ? '#fff' : C.ink });
  }));
  ctx.restore();
}

// ---------------------------------------------------------------- scissors
function scissors(open = .3, col = C.orange) {
  ctx.save(); const a = .08 + open * .45;
  for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * a);
    ctx.fillStyle = '#C9CDD2'; ctx.beginPath(); ctx.moveTo(0, -6 * s); ctx.lineTo(200, -2 * s); ctx.lineTo(206, 4 * s); ctx.lineTo(0, 12 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8C939B'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(-78, 44 * s, 40, 28, s * .5, 0, 7); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6, 2 * s); ctx.lineTo(-44, 24 * s); ctx.lineTo(-38, 36 * s); ctx.lineTo(6, 12 * s); ctx.fill();
    ctx.restore(); }
  ctx.fillStyle = '#5B616A'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- Seyès notebook page (cahier de comptes)
function notebook(w, h, o = {}) {
  ctx.save();
  withShadow(o.lift ?? 14, () => { ctx.fillStyle = '#FFFEFA'; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); });
  ctx.save(); rrect(-w / 2, -h / 2, w, h, 6); ctx.clip();
  const g = o.grid || 32; ctx.lineWidth = 1;
  for (let y = -h / 2 + g * 2; y < h / 2; y += g / 4) { const major = Math.round((y + h / 2) / (g / 4)) % 4 === 0; ctx.strokeStyle = major ? M.seyesD : M.seyes; ctx.lineWidth = major ? 1.6 : .8; ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke(); }
  ctx.strokeStyle = M.seyes; ctx.lineWidth = 1; for (let x = -w / 2 + g * 3; x < w / 2; x += g) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
  ctx.strokeStyle = M.margin; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w / 2 + g * 3, -h / 2); ctx.lineTo(-w / 2 + g * 3, h / 2); ctx.stroke();
  if (o.holes) { ctx.fillStyle = C.table; for (let y = -h / 2 + 90; y < h / 2 - 40; y += 160) { ctx.beginPath(); ctx.arc(-w / 2 + 34, y, 13, 0, 7); ctx.fill(); } }
  ctx.restore(); ctx.restore();
}

// ---------------------------------------------------------------- the product: a sneaker (side view, paper cut-out)
function sneaker(w, o = {}) {
  const s = w / 400, up = o.color || C.violet, acc = o.accent || C.amber;
  ctx.save(); ctx.scale(s, s);
  withShadow(o.lift ?? 8, () => {
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(-190, 40); ctx.lineTo(195, 40); ctx.quadraticCurveTo(212, 40, 206, 62); ctx.lineTo(200, 78); ctx.lineTo(-180, 78); ctx.quadraticCurveTo(-200, 76, -196, 56); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = '#E4DED2'; ctx.fillRect(-186, 64, 384, 8);
  ctx.fillStyle = up; ctx.beginPath(); ctx.moveTo(-185, 42); ctx.lineTo(-180, -40); ctx.quadraticCurveTo(-176, -70, -140, -74); ctx.lineTo(-70, -78); ctx.quadraticCurveTo(-40, -40, 10, -30);
  ctx.lineTo(110, -8); ctx.quadraticCurveTo(190, 6, 198, 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(-60, 30); ctx.quadraticCurveTo(20, -6, 120, 8); ctx.lineTo(128, 22); ctx.quadraticCurveTo(30, 12, -52, 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(-185, 42); ctx.lineTo(-182, -30); ctx.lineTo(-150, -34); ctx.lineTo(-146, 42); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 30, -44 + i * 6); ctx.lineTo(-30 + i * 30, -30 + i * 6); ctx.stroke(); }
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(-110, -72, 38, 10, -.05, 0, 7); ctx.fill();
  ctx.restore();
}
/** shoe box (top view) with lid label */
function shoeBox(w, h, o = {}) {
  ctx.save(); withShadow(o.lift ?? 8, () => { ctx.fillStyle = o.fill || '#E8E0D2'; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); });
  ctx.fillStyle = o.band || C.orange; ctx.fillRect(-w / 2, -h / 2 + h * .62, w, h * .14);
  ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; rrect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 4); ctx.stroke();
  if (o.label) text(o.label, 0, -h * .08, { font: font(FF.stencil, h * .22, 800), align: 'center', color: C.ink, ls: 3 });
  ctx.restore();
}

// ---------------------------------------------------------------- misc
/** a big number plate: dark plate with cream numerals (readability on any background) */
function plate(x, y, str, o = {}) {
  const f = font(o.fam || FF.brand, o.size || 96, o.wght || 900), wd = measure(str, f, o.ls || 0), pad = o.pad || 36, hh = (o.size || 96) * 1.34;
  at(x, y, o.rot || 0, o.s ?? 1, o.s ?? 1, () => { withShadow(o.lift ?? 10, () => { ctx.fillStyle = o.fill || C.ink; rrect(-wd / 2 - pad, -hh / 2, wd + pad * 2, hh, o.r ?? 18); ctx.fill(); });
    text(str, 0, (o.size || 96) * .36, { font: f, align: 'center', color: o.color || C.cream, ls: o.ls || 0 }); });
  return wd + pad * 2;
}
/** yellow sticky note */
function postIt(w, fn, o = {}) {
  ctx.save(); withShadow(o.lift ?? 10, () => { ctx.fillStyle = o.fill || '#FFE36E'; ctx.beginPath(); ctx.moveTo(-w / 2, -w / 2); ctx.lineTo(w / 2, -w / 2); ctx.lineTo(w / 2, w / 2 - 30); ctx.lineTo(w / 2 - 30, w / 2); ctx.lineTo(-w / 2, w / 2); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.moveTo(w / 2, w / 2 - 30); ctx.lineTo(w / 2 - 30, w / 2); ctx.lineTo(w / 2 - 26, w / 2 - 26); ctx.closePath(); ctx.fill();
  if (fn) fn(); ctx.restore();
}

// ---------------------------------------------------------------- handwritten ledger (cahier de comptes)
/** rows: [{label, amount, t, color, run (running total shown in margin)}], written by marker at time t.
 *  o: { t, lh (line height), fs, labelX, amountX, runX, total:{label, amount, t, color}, strikeRows:{i: t}, rowT(i) } — draw inside notebook() coords (0,0 = page centre) */
function ledger(rows, o = {}) {
  const t = o.t, lh = o.lh || 96, fs = o.fs || 50, y0 = o.y0 ?? -300, lx = o.labelX ?? -300, ax = o.amountX ?? 330, rx = o.runX;
  rows.forEach((r, i) => {
    const y = y0 + i * lh, k = prog(t, r.t, r.t + (r.dur || .55)); if (k <= 0) return;
    const am = typeof r.amount === 'number' ? fmtN(r.amount) : (r.amount ?? '');
    const room = ax - (am ? measure(am, font(FF.hand, fs, 800)) : 0) - 36 - lx, lw = measure(r.label, font(FF.hand, fs, 800));
    handText(r.label, lx, y, lw > room ? fs * room / lw : fs, { align: 'left', write: clamp(k * 1.6), color: r.color || C.ink, pen: false });
    const kk = clamp(k * 1.6 - .6);
    if (am && kk > 0) handText(am, ax, y, fs, { align: 'right', write: kk, color: r.color || C.ink, pen: k < 1, strike: o.strikeRows && o.strikeRows[i] != null ? prog(t, o.strikeRows[i], o.strikeRows[i] + .3) : 0 });
    if (rx != null && r.run != null && k >= 1) { const kr = prog(t, r.t + (r.dur || .55), r.t + (r.dur || .55) + .3);
      if (kr > 0) at(rx, y - fs * .3, -.04, 1, 1, () => { handText(fmtN(r.run), 0, fs * .3, fs * .72, { write: kr, color: C.violetD, pen: false }); }); }
  });
  if (o.total && t >= o.total.t) {
    const y = y0 + rows.length * lh + lh * .15, k = prog(t, o.total.t, o.total.t + .5);
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const x0 = lx, x1 = ax + 10, xe = lerp(x0, x1, eOutCubic(clamp(k * 2)));
    ctx.beginPath(); ctx.moveTo(x0, y - lh * .55); ctx.lineTo(xe, y - lh * .57); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0, y - lh * .45); ctx.lineTo(xe, y - lh * .47); ctx.stroke(); ctx.restore();
    const kk = clamp(k * 2 - .8);
    if (kk > 0) { handText(o.total.label || 'TOTAL', lx, y + lh * .25, fs * 1.1, { align: 'left', write: kk, pen: false, color: o.total.color || C.ink });
      handText(typeof o.total.amount === 'number' ? fmtN(o.total.amount) : o.total.amount, ax, y + lh * .25, fs * 1.15, { align: 'right', write: kk, color: o.total.color || C.ink, pen: kk < 1 }); }
  }
}

/** calculator typing: seq = [{t, key, disp}] (disp = what the LCD shows after the key); returns {disp, press} at time t */
function calcState(t, seq, initial = '0') {
  let disp = initial, press = null;
  for (const s of seq) { if (t >= s.t) { disp = s.disp ?? disp; if (t < s.t + .12) press = s.key; } }
  return { disp, press };
}
/** build a typing sequence for an expression like "600000 ÷ 80 =" starting at t0, one key every dt; result shown after '=' */
function typeSeq(expr, t0, dt, result) {
  const out = []; let shown = '', cur = '';
  [...expr.replace(/\s/g, '')].forEach((ch, i) => {
    const t = t0 + i * dt;
    if (/[0-9]/.test(ch)) { cur += ch; shown = fmtN(+cur); }
    else if (ch === '=') { shown = typeof result === 'number' ? fmtN(result) : result; cur = ''; }
    else { cur = ''; }
    out.push({ t, key: ch === '0' && expr.includes('00') ? '0' : ch, disp: shown });
  });
  return out;
}
