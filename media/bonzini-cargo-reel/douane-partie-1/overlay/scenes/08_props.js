'use strict';
// =============================================================================================
// DOUANE — shared props & FX (paper world). Generic, friendly, never a real emblem or real form.
// =============================================================================================
const DUO = { green: ['#0B2A22', '#F2EADB'], violet: ['#231629', '#F4ECFF'], amber: ['#3A1E08', '#F7E3C0'], night: ['#0A1A2A', '#CFE0EC'] };
const XRAY = '#7FE7FF';

// ---------- camera: shakes & drift ------------------------------------------------------------
const _shakes = [];
/** register a camera shake at time t0 (seconds), amp px, dur s — call at load time (inside the IIFE, after TL is ready use lazy) */
function addShake(t0, amp = 14, dur = .14) { _shakes.push({ t0, amp, dur }); }
/** offset to apply at the start of a scene's draw: const s = shake(t, n); ctx.translate(s.x, s.y) — steps on twos */
function shake(t, n) {
  let x = 0, y = 0;
  for (const s of _shakes) { const k = (t - s.t0) / s.dur; if (k < 0 || k > 1) continue; const a = s.amp * (1 - k);
    x += (rnd(Math.floor(n / 1) * 3.1 + s.t0) - .5) * 2 * a; y += (rnd(Math.floor(n / 1) * 5.7 + s.t0) - .5) * 2 * a; }
  return { x, y };
}
/** slow hand-held drift (px), seed = scene id */
function drift(t, seed = 1, amp = 6) { return { x: Math.sin(t * .7 + seed) * amp, y: Math.cos(t * .53 + seed * 2) * amp * .8, r: Math.sin(t * .41 + seed) * .004 }; }
/** stamp slam scale: big → 1 with a squash, t0 = hit time. Returns { s, a } (a = alpha) */
function slam(t, t0, from = 1.9) {
  if (t < t0 - .1) return { s: from, a: 0 };
  const k = clamp((t - (t0 - .1)) / .1); if (k < 1) return { s: lerp(from, 1, eInCubic(k)), a: k };
  const s = t - t0; return { s: 1 - Math.exp(-s * 14) * Math.cos(s * 40) * .06, a: 1 };
}
/** pop-in with overshoot (0 → 1) starting at t0 */
const pop = (t, t0, w = 16, z = .42) => clamp(spring(t - t0, w, z), 0, 1.3);

// ---------- the "bête noire" ------------------------------------------------------------------
/** black cut-paper monster, origin = bottom centre, w wide. k = rise 0..1, o: { fold 0..1 (folds flat into a paper plane silhouette), look -1..1, n, label, mouth 0..1 } */
function monster(w, k, o = {}) {
  const n = o.n || 0, h = w * 1.05, fold = clamp(o.fold || 0);
  ctx.save(); ctx.translate(0, (1 - eOutBack(clamp(k))) * h * .9); ctx.scale(1 - fold * .85, 1 - fold * .6);
  const wob = i => (rnd(i * 7.7 + Math.floor(n / 2) * 1.31) - .5) * w * .018;
  // body with jagged torn outline
  const pts = [];
  for (let i = 0; i <= 28; i++) { const a = Math.PI + (i / 28) * Math.PI, r = (i % 2 ? .47 : .5) * w; pts.push([Math.cos(a) * r + wob(i), -h * .45 + Math.sin(a) * h * .55 + wob(i + 40)]); }
  ctx.save(); ctx.shadowColor = 'rgba(20,10,20,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#17111B'; ctx.beginPath(); ctx.moveTo(-w * .5, 0); for (const p of pts) ctx.lineTo(...p); ctx.lineTo(w * .5, 0);
  for (let i = 0; i <= 8; i++) ctx.lineTo(w * .5 - i * w / 8, (i % 2 ? -w * .05 : 0)); ctx.closePath(); ctx.fill(); ctx.restore();
  // fibre texture
  ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#6A5A72'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) { const x = (rnd(i * 3.3) - .5) * w * .8, y = -rnd(i * 4.1) * h * .85; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 4); ctx.stroke(); }
  ctx.restore();
  // horns
  ctx.fillStyle = '#17111B';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * .22, -h * .9); ctx.lineTo(s * w * .34, -h * 1.08); ctx.lineTo(s * w * .34, -h * .86); ctx.closePath(); ctx.fill(); }
  // googly eyes
  const lk = o.look || 0;
  for (const s of [-1, 1]) { const ex = s * w * .17, ey = -h * .62, r = w * .105;
    ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(ex, ey, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#140C10'; ctx.beginPath(); ctx.arc(ex + lk * r * .45 + wob(s + 9) * .6, ey + r * .25, r * .5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lk * r * .45 - r * .15, ey + r * .05, r * .12, 0, 7); ctx.fill(); }
  // mouth with paper teeth
  const mo = .35 + .65 * clamp(o.mouth ?? 1), my = -h * .36, mw = w * .5, mh = w * .16 * mo;
  ctx.fillStyle = '#5A1020'; ctx.beginPath(); ctx.ellipse(0, my, mw / 2, mh, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFDF7'; for (let i = 0; i < 6; i++) { const x = -mw / 2 + mw * (i + .5) / 6; ctx.beginPath(); ctx.moveTo(x - mw / 14, my); ctx.lineTo(x, my + mh * .55); ctx.lineTo(x + mw / 14, my); ctx.closePath(); ctx.fill(); }
  // belly label
  if (o.label !== false) at(0, -h * .16, -.04, 1, 1, () => { ctx.fillStyle = C.cream; rrect(-w * .3, -w * .07, w * .6, w * .14, 8); ctx.fill();
    text(o.label || 'DOUANE ?', 0, w * .045, { font: font(FF.stencil, w * .1, 900), align: 'center', color: '#17111B', ls: 3 }); });
  ctx.restore();
}

// ---------- characters & furniture --------------------------------------------------------------
/** friendly paper customs officer (generic green cap, NO badge/flag/emblem). Pass person() options to override. */
function officer(o = {}) { person(Object.assign({ skin: SKIN[2] || SKIN[0], outfit: '#E7DFC9', hair: 'cap', capColor: DC.green, face: 'smile' }, o)); }
/** paper counter (guichet) front, origin = top centre, w wide */
function counter(w, label = 'GUICHET', o = {}) {
  ctx.save(); withShadow(12, () => { ctx.fillStyle = o.fill || '#DCCFB6'; ctx.fillRect(-w / 2, 0, w, 360); });
  ctx.fillStyle = '#C7B593'; ctx.fillRect(-w / 2 - 20, -18, w + 40, 30);
  ctx.fillStyle = DC.green; rrect(-w * .28, 70, w * .56, 88, 12); ctx.fill();
  text(label, 0, 132, { font: font(FF.stencil, 60, 900), align: 'center', color: DC.yellow, ls: 6 });
  ctx.restore();
}
/** jute sack (front), origin = centre, label patch text */
function sack(w, h, label = 'POIVRE', o = {}) {
  ctx.save();
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = '#B8935A'; ctx.beginPath(); ctx.moveTo(-w * .42, -h * .38); ctx.quadraticCurveTo(-w * .56, h * .1, -w * .46, h * .48); ctx.quadraticCurveTo(0, h * .56, w * .46, h * .48);
    ctx.quadraticCurveTo(w * .56, h * .1, w * .42, -h * .38); ctx.quadraticCurveTo(0, -h * .3, -w * .42, -h * .38); ctx.fill(); });
  ctx.strokeStyle = 'rgba(90,60,25,.35)'; ctx.lineWidth = 2;                                   // weave
  for (let y = -h * .32; y < h * .46; y += 14) { ctx.beginPath(); ctx.moveTo(-w * .44, y); ctx.lineTo(w * .44, y + 3); ctx.stroke(); }
  ctx.fillStyle = '#9C7447'; ctx.beginPath(); ctx.ellipse(0, -h * .42, w * .16, h * .07, 0, 0, 7); ctx.fill();   // tied neck
  ctx.fillStyle = '#B8935A'; ctx.beginPath(); ctx.moveTo(-w * .1, -h * .44); ctx.lineTo(-w * .2, -h * .58); ctx.lineTo(0, -h * .5); ctx.lineTo(w * .2, -h * .6); ctx.lineTo(w * .1, -h * .44); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-w * .17, -h * .42); ctx.lineTo(w * .17, -h * .42); ctx.stroke();
  at(0, h * .06, -.03, 1, 1, () => { ctx.fillStyle = C.cream; rrect(-w * .34, -h * .12, w * .68, h * .24, 10); ctx.fill();
    const f = font(FF.stencil, Math.min(h * .12, w * .62 / Math.max(1, label.length) * 1.7), 900); text(label, 0, h * .045, { font: f, align: 'center', color: C.ink, ls: 2 });
    if (o.sub) text(o.sub, 0, h * .1, { font: font(FF.body, h * .045, 700), align: 'center', color: C.inkSoft }); });
  ctx.restore();
}
/** traffic light (vertical), state: 'red' | 'yellow' | 'green' | null, origin centre, scale via at() */
function trafficLight(state, o = {}) {
  ctx.save(); withShadow(10, () => { ctx.fillStyle = '#2B2230'; rrect(-60, -170, 120, 340, 30); ctx.fill(); });
  const L = [['red', DC.red, -105], ['yellow', DC.yellow, 0], ['green', '#1FA86A', 105]];
  for (const [k, col, y] of L) { const on = state === k;
    ctx.fillStyle = on ? col : 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(0, y, 40, 0, 7); ctx.fill();
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, y, 10, 0, y, 120); g.addColorStop(0, col + 'AA'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fillRect(-120, y - 120, 240, 240); ctx.restore(); } }
  ctx.restore();
}
/** manila folder with tabs; k 0..1 reveals tabs one by one; tabs = [label,...] ; origin centre */
function folder(w, h, tabs, k, o = {}) {
  ctx.save();
  const nT = tabs.length, th = 96;
  tabs.forEach((lab, i) => { const kk = clamp(k * nT - i); if (kk <= 0) return;
    const y = -h / 2 + 60 + i * (th + 18), x = w / 2 - 10 + (1 - eOutBack(kk)) * -260;
    at(x, y, 0, 1, 1, () => { withShadow(6, () => { ctx.fillStyle = [C.violet, C.amber, C.orange, DC.green][i % 4]; rrect(-40, 0, 420, th, 16); ctx.fill(); }); }); });
  withShadow(14, () => { ctx.fillStyle = '#E9C98E'; rrect(-w / 2, -h / 2, w, h, 20); ctx.fill(); });
  ctx.fillStyle = '#E9C98E'; rrect(-w / 2, -h / 2 - 50, w * .38, 80, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,30,.25)'; ctx.lineWidth = 3; rrect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36, 12); ctx.stroke();
  if (o.title) text(o.title, -w / 2 + 40, -h / 2 + 10, { font: font(FF.stencil, 64, 900), color: C.ink, ls: 4 });
  tabs.forEach((lab, i) => { const kk = clamp(k * nT - i); if (kk <= 0) return;
    const y = -h / 2 + 150 + i * (th + 18) + 40;
    ctx.save(); ctx.globalAlpha *= clamp(kk * 2);
    ctx.fillStyle = [C.violet, C.amber, C.orange, DC.green][i % 4]; ctx.beginPath(); ctx.arc(-w / 2 + 70, y - 14, 18, 0, 7); ctx.fill();
    text(lab, -w / 2 + 110, y, { font: font(FF.body, o.fs || 50, 800), color: C.ink }); ctx.restore(); });
  ctx.restore();
}
/** simple line icons (stroke ink), s = size */
function iconFactory(s, col = C.ink) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s / 2, s / 2); ctx.lineTo(-s / 2, -s * .05); ctx.lineTo(-s * .2, s * .12); ctx.lineTo(-s * .2, -s * .05); ctx.lineTo(s * .1, s * .12); ctx.lineTo(s * .1, -s * .45); ctx.lineTo(s * .3, -s * .45); ctx.lineTo(s * .3, -s * .1); ctx.lineTo(s / 2, -s * .1); ctx.lineTo(s / 2, s / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(-s * .4 + i * s * .28, s * .22, s * .12, s * .12); ctx.restore(); }
function iconAnchor(s, col = C.ink) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * .1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -s * .36, s * .1, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -s * .26); ctx.lineTo(0, s * .42); ctx.moveTo(-s * .22, -s * .12); ctx.lineTo(s * .22, -s * .12); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * .1, s * .34, .25, Math.PI - .25); ctx.stroke(); ctx.restore(); }
function iconUmbrella(s, col = C.orange) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s / 2, Math.PI, 0); for (let i = 3; i >= 0; i--) ctx.arc(-s * .375 + i * s * .25, 0, s * .125, 0, Math.PI, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = s * .06; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * .45); ctx.arc(-s * .08, s * .45, s * .08, 0, Math.PI); ctx.stroke(); ctx.restore(); }
function iconClock(s, k = 0, col = C.ink) { ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = s * .08; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(k * 12) * s * .22, -Math.cos(k * 12) * s * .22); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(k * 1) * s * .34, -Math.cos(k * 1) * s * .34); ctx.stroke(); ctx.restore(); }
function iconHeart(s, col = C.orange) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, s * .35); ctx.bezierCurveTo(-s * .6, -s * .05, -s * .35, -s * .55, 0, -s * .22); ctx.bezierCurveTo(s * .35, -s * .55, s * .6, -s * .05, 0, s * .35); ctx.fill(); ctx.restore(); }
function iconCheck(s, col = '#1FA86A') { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = s * .12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * .22, 0); ctx.lineTo(-s * .05, s * .17); ctx.lineTo(s * .24, -s * .16); ctx.stroke(); ctx.restore(); }
function iconCross(s, col = DC.red) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = s * .12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * .17, -s * .17); ctx.lineTo(s * .17, s * .17); ctx.moveTo(s * .17, -s * .17); ctx.lineTo(-s * .17, s * .17); ctx.stroke(); ctx.restore(); }
/** little paper plane (the defeated monster flies away) */
function paperPlane(s, col = '#17111B') { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s * .6, 0); ctx.lineTo(-s * .5, -s * .3); ctx.lineTo(-s * .2, 0); ctx.lineTo(-s * .5, s * .3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(s * .6, 0); ctx.lineTo(-s * .2, 0); ctx.lineTo(-s * .5, s * .3); ctx.closePath(); ctx.fill(); ctx.restore(); }
/** "MADE IN …" woven label */
function madeIn(txt, w = 360, o = {}) { ctx.save(); withShadow(6, () => { ctx.fillStyle = o.fill || '#FFFDF7'; rrect(-w / 2, -54, w, 108, 10); ctx.fill(); });
  ctx.strokeStyle = o.col || C.violetD; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); rrect(-w / 2 + 10, -44, w - 20, 88, 6); ctx.stroke(); ctx.setLineDash([]);
  text('MADE IN', 0, -8, { font: font(FF.body, 26, 800), align: 'center', color: C.inkSoft, ls: 4 }); text(txt, 0, 34, { font: font(FF.stencil, 44, 900), align: 'center', color: o.col || C.violetD, ls: 3 }); ctx.restore(); }

// ---------- the question header (1/3 · 2/3 · 3/3) -------------------------------------------------
const QCOL = [C.violetD, '#C77A12', C.orange];
const QWORD = ['QUOI ?', 'COMBIEN ?', "D'OÙ ?"];
/** compact header chip for question i (0..2), with progress dots; origin = centre */
function qHeader(i, k = 1) {
  ctx.save(); ctx.globalAlpha *= clamp(k * 2); const w = 680, h = 120;
  withShadow(10, () => { ctx.fillStyle = QCOL[i]; rrect(-w / 2, -h / 2, w, h, 60); ctx.fill(); });
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-w / 2 + 62, 0, 42, 0, 7); ctx.fill();
  text(String(i + 1), -w / 2 + 62, 17, { font: font(FF.brand, 50, 900), align: 'center', color: QCOL[i] });
  { const f0 = font(FF.stencil, 76, 900), fs = Math.min(76, 76 * (w - 128 - 150) / measure(QWORD[i], f0, 3)); text(QWORD[i], -w / 2 + 128, 26 * fs / 76, { font: font(FF.stencil, fs, 900), color: '#fff', ls: 3 }); }
  for (let d = 0; d < 3; d++) { ctx.fillStyle = d <= i ? '#fff' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(w / 2 - 100 + d * 32, 0, 11, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------- title strip & stickers ------------------------------------------------------------------
/** torn paper strip with big stencil text (headline), centred at (0,0) */
function strip(txt, o = {}) {
  const f = font(o.fam || FF.stencil, o.size || 88, 900), tw = measure(txt, f, o.ls ?? 3), w = tw + 2 * (o.pad || 44), h = (o.size || 88) * 1.45;
  ctx.save(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, (o.seed || 1) * 3, 4, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, (o.seed || 1) * 5, 4, 12);
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = o.fill || C.cream; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  text(txt, 0, (o.size || 88) * .35, { font: f, align: 'center', color: o.color || C.ink, ls: o.ls ?? 3 });
  ctx.restore(); return w;
}
/** frosted "masked" pill (used over anything we must not show), origin centre */
function masked(w, h, label = 'masqué') {
  ctx.save(); ctx.fillStyle = 'rgba(236,236,240,.92)'; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  text(label, 0, h * .15, { font: font(FF.body, h * .42, 700), align: 'center', color: 'rgba(35,22,41,.45)' }); ctx.restore();
}
/** small photo credit tag for a photo print (bottom-right of the print), always ≥ 20 px */
function creditTag(s, x, y, o = {}) {
  const f = font(FF.body, o.size || 20, 700), w = measure(s, f) + 20;
  ctx.save(); ctx.fillStyle = 'rgba(35,22,41,.62)'; rrect(x - w, y - 30, w, 34, 8); ctx.fill(); text(s, x - 10, y - 6, { font: f, align: 'right', color: '#fff' }); ctx.restore();
}
const CREDIT = {
  kribi_crane: 'Port de Kribi · BACHELOR45 (© Le Sorcier) · CC BY 4.0',
  douala_port: 'Port de Douala · gd6d · CC BY 2.0',
  douala_city: 'Douala · christing-O- · CC BY 2.0',
  douala_satellite: 'Douala · migmasat · domaine public',
  containers_cranes: "Photo d'illustration · roy.luck · CC BY 2.0",
  ships_cranes: "Photo d'illustration · foxypar4 · CC BY 2.0",
  port_hazy: "Photo d'illustration · yuukin · CC BY 2.0",
  crane_silhouette: "Photo d'illustration · Bernard Spragg · CC0",
  inspection_dog: "Photo d'illustration · USDA · domaine public",
  ship_cranes_night: "Photo d'illustration · elbfoto · CC BY 2.0",
};

// ---------- recurring cast & shared blocks (keep every chapter consistent) -----------------------------
/** Junior (importer, sneaker seller in Mboppi) — same look as « Votre vrai prix de revient » */
function junior(o = {}) { person(Object.assign({ skin: SKIN[1], outfit: C.violet, hair: 'short', face: 'smile' }, o)); }
/** Mireille (exporter of Penja pepper) — wax head wrap */
function mireille(o = {}) { person(Object.assign({ skin: SKIN[3], outfit: C.orange, hair: 'wrap', wax: true, waxCols: [C.orange, DC.green, C.amber, C.violetD], face: 'smile' }, o)); }
/** Junior's carton (top view) with a HANDWRITTEN label « JUNIOR · MBOPPI » (never a BZ label on a customs-checked carton) */
function juniorCarton(w, h, o = {}) {
  carton(w, h, Object.assign({ seed: 3, label: () => at(w * .12, h * .22, -.06, 1, 1, () => {
    ctx.fillStyle = '#FFFDF7'; rrect(-w * .3, -h * .13, w * .6, h * .26, 6); ctx.fill();
    text('JUNIOR', 0, -h * .015, { font: font(FF.hand, Math.min(h * .1, w * .09), 800), align: 'center', color: C.ink });
    text('MBOPPI', 0, h * .09, { font: font(FF.hand, Math.min(h * .08, w * .07), 700), align: 'center', color: C.inkSoft }); }) }, o));
}
/** a value block for the « COMBIEN ? » tower and « LA NOTE » stack: rounded paper block, label, optional photo / icon inside.
 *  origin = bottom centre (so blocks stack upward). o: { fill, color, photo, fx_kind, cols, icon: fn, sub, lift } */
function stackBlock(w, h, label, o = {}) {
  ctx.save(); ctx.translate(0, -h / 2);
  withShadow(o.lift ?? 8, () => { ctx.fillStyle = o.fill || C.cream; rrect(-w / 2, -h / 2, w, h, 16); ctx.fill(); });
  if (o.photo) { ctx.save(); rrect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 10); ctx.clip();
    photoCover(o.fx_kind ? photoFx(o.photo, o.fx_kind, o.cols) : o.photo, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, { zoom: o.zoom || 1.1, fx: o.fx ?? .5, fy: o.fy ?? .5 });
    ctx.fillStyle = 'rgba(20,12,24,.35)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); }
  if (o.icon) at(-w / 2 + h * .45, 0, 0, 1, 1, o.icon);
  const f = font(FF.stencil, Math.min(h * .42, 72), 900), x0 = o.icon ? -w / 2 + h * .9 : 0;
  text(label, o.icon ? x0 : 0, h * .13 - (o.sub ? h * .1 : 0), { font: f, align: o.icon ? 'left' : 'center', color: o.color || (o.photo ? '#fff' : C.ink), ls: 3 });
  if (o.sub) text(o.sub, o.icon ? x0 : 0, h * .36, { font: font(FF.body, Math.min(h * .2, 34), 700), align: o.icon ? 'left' : 'center', color: o.photo ? 'rgba(255,255,255,.9)' : C.inkSoft });
  ctx.restore();
}
/** colours for the value tower (shared by COMBIEN and LA NOTE) */
const BLK = { marchandise: '#EBD9FF', transport: null, assurance: '#FFE2C2', valeur: C.violetD, droit: C.violet, tva: 'rgba(243,167,69,.55)' };
