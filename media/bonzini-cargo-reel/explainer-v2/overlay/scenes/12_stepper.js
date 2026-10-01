'use strict';
// =============================================================================================
// 12_stepper — the journey stepper on the violet thread, the chapter luggage tags and their flights,
// the brand / MERCI tags (final_storyboard §1.3, §1.4, §2.3 T8, §5.2). Package f1 (foundation).
// Everything here is AUTOMATIC from the timeline: chapter owners never draw tags, tabs or checks.
// Hooks for others: hp_tick(i, t0) (move a check), hp_pluck(t0), hp_ripple(t0), HP_STEPPER.* (recap/unhook, E).
// =============================================================================================
const HP_WORDS = ['ACHAT', 'GROUPAGE', 'TRANSPORT', 'ARRIVÉE', 'DÉCHARGEMENT', 'RETRAIT'];
const HP_TAGS = [
  { ch: 's1', num: '01', title: 'L’ACHAT',         in: () => W_('V03', 'Étape'), out: i => hp_after(i, W_('V03', 'Chine')),      x: 540, y: 600 },
  { ch: 's2', num: '02', title: 'LE GROUPAGE',     in: () => W_('V04', 'Étape'), out: i => hp_after(i, W_('V04', 'colis')),      x: 540, y: 600 },
  { ch: 's3', num: '03', title: 'LE TRANSPORT',    in: () => W_('V05', 'Étape'), out: i => hp_after(i, W_('V05', 'conteneur')),  x: 540, y: 560 },
  { ch: 's4', num: '04', title: 'L’ARRIVÉE',       in: () => W_('V06', 'Étape'), out: i => hp_after(i, W_('V06', 'voici') + .2), x: 540, y: 985 },
  { ch: 's5', num: '05', title: 'LE DÉCHARGEMENT', in: () => W_('V07', 'Étape'), out: i => hp_after(i, W_('V07', 'conteneur')),  x: 540, y: 560 },
  { ch: 's6', num: '06', title: 'LE RETRAIT',      in: () => W_('V09', 'Étape'), out: i => hp_after(i, W_('V09', 'Il')),         x: 540, y: 560 } ];
/** stepper geometry + recap hooks. E may replace unhookStart / unhookEnd / drawUnhook / recapSlot (assign, don't edit). */
const HP_STEPPER = {
  y: 176, x0: 60, x1: 1020, sag: 14, gap: 12, tabW: 100, tabH: 92, actH: 104, str: 16,
  unhookStart: () => TL.ch('recap').start - .4,          // T8 [105.6]
  unhookEnd: () => TL.ch('recap').start + .6,            // [106.6]
  drawUnhook: null,                                      // (t, n, k) => {…}  replaces the default fall when set
  recapSlot: i => ({ x: i % 2 ? 600 : 480, y: 440 + 120 * i }),
};
const _stTick = {}, _stPluck = [], _stRipple = [];
let _stC = null;
/** move tab i's check to t0 (number or () => number); default TL.ch(sN).end − 0.7 */
function hp_tick(i, t0) { _stTick[i] = t0; _stC = null; }
/** pluck: a ripple runs up the lead thread (0.25 s) then along the stepper; tabs jiggle in a wave */
function hp_pluck(t0) { _stPluck.push(t0); _stC = null; }
/** ripple 01 → 06 along the stepper (tabs jiggle in sequence) */
function hp_ripple(t0) { _stRipple.push(t0); _stC = null; }
function hp_recapSlot(i) { return HP_STEPPER.recapSlot(i); }

function f1_st() {
  if (_stC) return _stC;
  const e = W_('V01', 'étape');
  const tags = HP_TAGS.map((g, i) => { const tin = g.in(), tout = g.out(tin); hp_hold('tag ' + g.num, tin, tout); return { g, i, ch: g.ch, tin, tout, land: tout + .5 }; });
  const ticks = HP_TAGS.map((g, i) => (_stTick[i] != null ? f1_val(_stTick[i]) : TL.ch(g.ch).end - .7));
  const birth = HP_TAGS.map((g, i) => e + .32 + i * .12);
  const plucks = _stPluck.map(v => f1_val(v)).filter(v => isFinite(v)), ripples = _stRipple.map(v => f1_val(v)).filter(v => isFinite(v));
  const waves = plucks.map(t0 => ({ t0: t0 + .25, amp: 12 })).concat(ripples.map(t0 => ({ t0, amp: 16 })));
  const wAct = [], fAct = [];
  HP_TAGS.forEach((g, i) => {
    const calc = fs => 40 + measure(g.num, font(FF.stencil, fs, 900)) + 14 + measure(HP_WORDS[i], font(FF.stencil, fs, 900)) + 28;
    let fs = 48, w = calc(fs); if (w + 5 * (HP_STEPPER.tabW + HP_STEPPER.gap) > 960) { fs = 44; w = calc(fs); }
    wAct.push(w); fAct.push(fs);
  });
  return (_stC = { e, tags, ticks, birth, plucks, ripples, waves, wAct, fAct });
}
function f1_pluckTimes() { return f1_st().plucks; }

/** 'hidden'|'birth'|'ghost'|'live'|'unhook'|'gone' */
function hp_stepMode(t) {
  if (!TLD) return 'hidden';
  const S = f1_st();
  if (t < S.e) return 'hidden';
  if (t < TL.ch('brand').start) return 'birth';
  if (t < TL.ch('s1').start) return 'ghost';
  if (t < HP_STEPPER.unhookStart()) return 'live';
  if (t < HP_STEPPER.unhookEnd()) return 'unhook';
  return 'gone';
}
/** thread sag + travelling waves (plucks / ripples) */
function f1_threadY(x, t) {
  const S = f1_st(), P = HP_STEPPER, ts = f1_twos(t);
  let sag = P.sag; const ub = ts - (S.e + .47);
  if (ub < 0) sag = 40; else if (ub < 1.2) sag += 26 * Math.exp(-ub * 6) * Math.cos(ub * 13);
  let y = P.y + sag * Math.sin(Math.PI * clamp((x - P.x0) / (P.x1 - P.x0)));
  for (const w of S.waves) { const a = ts - w.t0; if (a < 0 || a > .6) continue; const xc = P.x0 + (P.x1 - P.x0) * a / .45; y -= w.amp * Math.exp(-Math.pow((x - xc) / 55, 2)) * (1 - a / .6); }
  return y;
}
const _layK = { t: NaN, v: null };
/** accordion layout at t: [{cx, w, h, kind:'future'|'done'|'active', open 0..1, alpha}] */
function f1_layout(t) {
  if (t === _layK.t) return _layK.v;
  const S = f1_st(), mode = hp_stepMode(t), P = HP_STEPPER;
  let landed = -1, act = -1, from = -1, k = 1, flying = -1;
  if (mode !== 'hidden' && mode !== 'birth' && mode !== 'ghost') {
    for (const g of S.tags) if (t >= g.land) landed = g.i;
    act = from = landed;
    for (const g of S.tags) if (t >= g.tout && t < g.land) { flying = g.i; if (t >= g.tout + .1) { act = g.i; k = eInOutCubic(prog(t, g.tout + .1, g.land)); } }
  }
  const wOf = (j, a) => (j === a ? S.wAct[j] : P.tabW);
  const tabs = HP_TAGS.map((g, j) => {
    const w = lerp(wOf(j, from), wOf(j, act), k), open = clamp((w - P.tabW) / (S.wAct[j] - P.tabW));
    let kind = 'future', alpha = 1;
    if (mode === 'birth' || mode === 'ghost') { kind = 'future'; alpha = .55; }
    else if (j === flying) {                       // the landing tag's slot: ghost fades out, the active tab cross-fades in (last 3 frames)
      const g = S.tags[j], ft = prog(t, g.tout, g.land), fin = t >= g.land - 3 / 30;
      kind = fin ? 'active' : 'future'; alpha = fin ? prog(t, g.land - 3 / 30, g.land) : .45 * (1 - clamp(ft * 2.2)); }
    else if (j === landed) kind = 'active';
    else if (j < Math.max(landed, flying)) kind = 'done';
    else { kind = 'future'; alpha = lerp(.55, .45, prog(t, TL.ch('s1').start, TL.ch('s1').start + .4)); }
    return { j, w, h: lerp(P.tabH, P.actH, open), kind, open, alpha };
  });
  let total = tabs.reduce((s, b) => s + b.w, 0) + P.gap * 5, x = 540 - total / 2;
  for (const b of tabs) { b.cx = x + b.w / 2; x += b.w + P.gap; }
  _layK.t = t; _layK.v = tabs; return tabs;
}
/** rotation of tab j at t (sway, arrival swing, birth clack, waves) */
function f1_tabRot(j, b, t) {
  const S = f1_st(), ts = f1_twos(t), mode = hp_stepMode(t);
  let r = b.open > .5 ? .03 * Math.sin(t * Math.PI * 2 / 1.4) : .012 * Math.sin(t * Math.PI * 2 / 2.3 + j * 1.7);
  const ua = ts - S.tags[j].land; if (ua >= 0 && ua < 2) r += .12 * Math.exp(-ua * 4) * Math.sin(ua * 10);
  const ub = ts - S.birth[j]; if (ub >= 0 && ub < 1.5) r += .22 * Math.exp(-ub * 5) * Math.sin(ub * 12 + .4);
  for (const w of S.waves) { const v = ts - w.t0 - (b.cx - HP_STEPPER.x0) / (HP_STEPPER.x1 - HP_STEPPER.x0) * .45; if (v >= 0 && v < 1.2) r += .09 * Math.exp(-v * 5) * Math.sin(v * 16); }
  return r;
}
function f1_tabGeom(i, t) {
  const b = f1_layout(t)[i], P = HP_STEPPER, px = b.cx, py = f1_threadY(px, t), r = f1_tabRot(i, b, t);
  let drop = 0; const ub = f1_twos(t) - f1_st().birth[i]; if (hp_stepMode(t) === 'birth' && ub < .12) drop = -46 * (1 - eInCubic(clamp(ub / .12)));
  return { b, px, py: py + drop, r, top: P.str - 4 * b.open };
}
/** screen rect of tab i: {x, y (body centre), w, h, r, px, py (hang point)} */
function hp_tabRect(i, t) {
  const g = f1_tabGeom(i, t), cy = g.top + g.b.h / 2;
  return { x: g.px - Math.sin(g.r) * cy, y: g.py + Math.cos(g.r) * cy, w: g.b.w, h: g.b.h, r: g.r, px: g.px, py: g.py };
}
/** screen point of tab i's grommet */
function hp_tabGrommet(i, t) { const g = f1_tabGeom(i, t), d = g.top + 14; return [g.px - Math.sin(g.r) * d, g.py + Math.cos(g.r) * d]; }

// ---------- chapter tags ----------
/** current transform of a chapter tag: {x, y, s, r, k (alpha), lift, gx, gy (grommet)} | null */
function hp_tagPose(ch, t) {
  const S = f1_st(), g = S.tags.find(q => q.ch === ch); if (!g || t < g.tin || t >= g.land) return null;
  const B = HP_TAGS[g.i], Lp = 1700, ts = f1_twos(t), th0 = -.6 * (1 - spring(.5, 9, .35));
  let x, y, s = 1, r = 0, lift = 6, k = 1;
  const hold = tt => { const d = drift(tt, 3 + g.i, 2); return [B.x + d.x, B.y + d.y]; };
  if (t < g.tout) {
    const u = ts - g.tin, th = u < .5 ? -.6 * (1 - spring(u, 9, .35)) : th0 * (1 - eOutCubic(clamp((u - .5) / .12)));
    const settle = clamp((u - .5) / .12); const [hx, hy] = hold(t);
    x = lerp(B.x, hx, settle) - Lp * Math.sin(th) * (th > 0 ? .5 : 1); y = lerp(B.y, hy, settle) - Lp * (1 - Math.cos(th)); r = th * .75;
    if (u < .5) { s = 1.04; lift = 40; }
    else { const v = u - .62; s = lerp(1.04, 1, eInCubic(settle)) * (v > 0 ? 1 - Math.exp(-v * 14) * Math.cos(v * 40) * .02 : 1); lift = lerp(40, 6, eInCubic(settle)); }
  } else {
    const v = eInOutCubic(prog(t, g.tout, g.land)), R = hp_tabRect(g.i, g.land), [x0, y0] = hold(g.tout);
    const cx = (x0 + R.x) / 2 + 120, cy = R.y + 90;                    // rises into its slot from below (never above y 150)
    x = (1 - v) * (1 - v) * x0 + 2 * v * (1 - v) * cx + v * v * R.x; y = (1 - v) * (1 - v) * y0 + 2 * v * (1 - v) * cy + v * v * R.y;
    s = lerp(1, R.h / 500 * 1.25, v); r = lerp(0, R.r, v) - .22 * Math.sin(Math.PI * v); lift = 6 + 34 * Math.sin(Math.PI * v);
    k = 1 - prog(t, g.land - 3 / 30, g.land);
  }
  return { x, y, s, r, k, lift, gx: x - 370 * s * Math.cos(r), gy: y - 370 * s * Math.sin(r) };
}
/** amber grommet with a table-coloured hole (+ reinforcement ring) */
function f1_grommet(x, y, R, hole, ring = true) {
  if (ring) { ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.beginPath(); ctx.arc(x, y, R + 9, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#C98420'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, R, 0, 7); ctx.fill();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - R * .3, y - R * .35, R * .32, 0, 7); ctx.fill();
  ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(x, y, hole, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,10,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, hole, 0, 7); ctx.stroke();
}
/** luggage-tag outline (clipped left corners c) */
function f1_tagPath(x0, y0, w, h, c, r = 8) {
  ctx.beginPath(); ctx.moveTo(x0 + c, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  ctx.lineTo(x0 + c, y0 + h); ctx.lineTo(x0, y0 + h - c); ctx.lineTo(x0, y0 + c); ctx.closePath();
}
/** the 820×500 chapter tag, local origin = centre */
function f1_chapterTag(tag, lift) {
  const w = 820, h = 500, x0 = -410, y0 = -250;
  withShadow(lift, () => { f1_tagPath(x0, y0, w, h, 74, 10); ctx.fillStyle = C.kraftD; ctx.fill(); });
  f1_tagPath(x0, y0, w, h, 74, 10); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 2; f1_tagPath(x0 + 5, y0 + 5, w - 10, h - 10, 70, 7); ctx.stroke();
  const ix0 = -346, iy0 = -222, iw = 738, ih = 444;
  withShadow(2, () => { ctx.fillStyle = C.cream; rrect(ix0, iy0, iw, ih, 10); ctx.fill(); });
  ctx.save(); rrect(ix0, iy0, iw, ih, 10); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(ix0, iy0, iw, ih);
  const g = ctx.createLinearGradient(0, iy0, 0, iy0 + ih); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(150,110,60,.06)'); ctx.fillStyle = g; ctx.fillRect(ix0, iy0, iw, ih);
  ctx.restore();
  // perforated tear line between the grommet zone and the insert
  ctx.save(); ctx.strokeStyle = 'rgba(90,60,30,.45)'; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-325 - 30, y0 + 40); ctx.lineTo(-325 - 30, -60); ctx.moveTo(-355, 60); ctx.lineTo(-355, y0 + h - 40); ctx.stroke(); ctx.restore();
  f1_grommet(-370, 0, 22, 10);
  ctx.fillStyle = C.violet; ctx.beginPath(); ctx.ellipse(-370, 0, 8, 7, 0, 0, 7); ctx.fill();          // thread knotted through the hole
  const cx = ix0 + iw / 2;
  text('ÉTAPE', -300, -170, { font: font(FF.body, 46, 800), color: C.inkSoft, ls: 8 });
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(342, -176, 30, 0, 7); ctx.fill(); drawLogo(342, -176, 48, { alpha: .9 });
  text(tag.num, cx, 40, { font: font(FF.stencil, 200, 900), color: C.violetD, align: 'center', ls: 4 });
  let ts = 100, tf = font(FF.stencil, ts, 900), tw = measure(tag.title, tf, 3);
  if (tw > 720) { ts = 96; tf = font(FF.stencil, ts, 900); tw = measure(tag.title, tf, 3); }
  const sc = Math.min(1, 690 / tw);
  at(cx, 195, 0, sc, 1, () => text(tag.title, 0, 0, { font: tf, color: C.ink, align: 'center', ls: 3 }));
}

// ---------- brand & MERCI tags (E calls them; A calls hp_brandTag in the brand chapter) ----------
function f1_pinGlyph(x, y, s = 1, col = C.orange) {
  at(x, y, 0, s, s, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-8, 8, -18, 0, -18, -10); ctx.arc(0, -10, 18, Math.PI, 0); ctx.bezierCurveTo(18, 0, 8, 8, 0, 22); ctx.fill();
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, -10, 7, 0, 7); ctx.fill(); });
}
/** brand tag: cream luggage tag + kraft rim, logo (pieces fly in with o.logoK), « BONZINI » / « TRADING CARGO » (o.wordK slam);
 *  o {logoK, wordK, footer:true|string, w, h, lift}. Call logoK/wordK with stepped time for on-twos pieces. */
function hp_brandTag(x, y, s = 1, r = 0, k = 1, o = {}) {
  if (k <= 0) return;
  const w = o.w || 760, h = o.h || 380, big = h >= 400, x0 = -w / 2, y0 = -h / 2, foot = o.footer ? (o.footer === true ? 'Entrepôt · Foyer Balengou' : o.footer) : null;
  const sc = s * (.9 + .1 * eOutBack(clamp(k)));
  at(x, y, r, sc, sc, () => {
    ctx.globalAlpha *= clamp(k * 3);
    withShadow(o.lift ?? 10, () => { f1_tagPath(x0, y0, w, h, 62, 14); ctx.fillStyle = C.kraftD; ctx.fill(); });
    f1_tagPath(x0, y0, w, h, 62, 14); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
    f1_tagPath(x0 + 6, y0 + 6, w - 12, h - 12, 58, 10); ctx.fillStyle = C.cream; ctx.fill();
    ctx.save(); f1_tagPath(x0 + 6, y0 + 6, w - 12, h - 12, 58, 10); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(x0, y0, w, h); ctx.restore();
    f1_grommet(x0 + 32, 0, 15, 7);
    const dy = foot ? -38 : 0;
    // logo pieces fly in from 4 sides
    const lk = clamp(o.logoK ?? 1), dirs = { amber: [0, -1, -1], orange: [1, 0, 1], wingTop: [-1, 0, -1], wingBot: [0, 1, 1] }, offs = {};
    ['amber', 'orange', 'wingTop', 'wingBot'].forEach((role, j) => { const kj = clamp((lk - j * .12) / .64), e = kj >= 1 ? 1 : eOutBack(kj), d = dirs[role];
      offs[role] = [d[0] * (1 - e) * 560, d[1] * (1 - e) * 560, d[2] * (1 - e) * 1.2, kj > 0 ? 1 : 0]; });
    drawLogo(-250, -10 + dy, 170, { offsets: offs });
    const wk = clamp(o.wordK ?? 1);
    if (wk > 0) {
      const q = clamp(wk / .45), ws = wk < .45 ? lerp(1.3, 1, eInCubic(q)) : 1 - Math.exp(-(wk - .45) * 9) * Math.cos((wk - .45) * 30) * .025;
      at(-140, 10 + dy, 0, ws, ws, () => {
        ctx.globalAlpha *= q;
        text('BONZINI', 0, 0, { font: font(FF.brand, big ? 104 : 96, 900), color: C.ink });
        text('TRADING CARGO', 2, 60, { font: font(FF.stencil, big ? 50 : 46, 900), color: C.violetD, ls: 8 });
      });
    }
    if (foot) {
      const ff = font(FF.body, 44, 800), fw = measure(foot, ff), fx = 20 - (fw + 44) / 2;
      ctx.save(); ctx.strokeStyle = 'rgba(74,58,82,.30)'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(x0 + 80, 82); ctx.lineTo(w / 2 - 40, 82); ctx.stroke(); ctx.restore();
      f1_pinGlyph(fx + 16, 128, 1);
      text(foot, fx + 44, 140, { font: ff, color: C.inkSoft });
    }
  });
}
/** MERCI tag: cream luggage tag, « MERCI » (Stencil 150 violetD) + « pour votre confiance » (Bricolage 800 48) */
function hp_merciTag(x, y, s = 1, r = 0, k = 1, o = {}) {
  if (k <= 0) return;
  const fM = font(FF.stencil, 150, 900), f2 = font(FF.body, 48, 800), l2 = 'pour votre confiance';
  const tw = Math.max(measure('MERCI', fM, 6), measure(l2, f2)), w = Math.max(600, tw + 150), h = 250, x0 = -w / 2, y0 = -h / 2;
  const sc = s * (.9 + .1 * eOutBack(clamp(k)));
  at(x, y, r, sc, sc, () => {
    ctx.globalAlpha *= clamp(k * 3);
    withShadow(o.lift ?? 10, () => { f1_tagPath(x0, y0, w, h, 50, 12); ctx.fillStyle = C.kraftD; ctx.fill(); });
    f1_tagPath(x0, y0, w, h, 50, 12); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
    f1_tagPath(x0 + 6, y0 + 6, w - 12, h - 12, 46, 8); ctx.fillStyle = C.cream; ctx.fill();
    ctx.save(); f1_tagPath(x0 + 6, y0 + 6, w - 12, h - 12, 46, 8); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(x0, y0, w, h); ctx.restore();
    f1_grommet(x0 + 30, 0, 14, 6);
    const cx = (x0 + 60 + w / 2 - 12) / 2;
    text('MERCI', cx, 24, { font: fM, color: C.violetD, align: 'center', ls: 6 });
    text(l2, cx, 94, { font: f2, color: C.ink, align: 'center' });
  });
}

// ---------- lead-thread upper end (11_hero asks for it) ----------
/** [x, y, p] where the lead thread hangs from: birth shot (p = draw-on progress), chapter tag grommet, active / first tab grommet */
function hp_threadTop(t) {
  const mode = hp_stepMode(t); if (mode === 'hidden' || mode === 'unhook' || mode === 'gone') return null;
  const S = f1_st(), P = HP_STEPPER;
  if (mode === 'birth' && t < S.birth[0] + .2) {
    const p = eOutCubic(prog(t, S.e, S.e + .22)), pin = [P.x0, P.y];
    if (t < S.birth[0]) return [pin[0], pin[1], p];
    const g0 = hp_tabGrommet(0, t), k = eInOutCubic(prog(t, S.birth[0], S.birth[0] + .2)); return [lerp(pin[0], g0[0], k), lerp(pin[1], g0[1], k), 1];
  }
  const lay = f1_layout(t), ai = lay.findIndex(b => b.kind === 'active' && b.alpha > .99);
  let landed = -1; for (const g of S.tags) if (t >= g.land) landed = g.i;
  const base = hp_tabGrommet(landed >= 0 ? landed : (ai >= 0 ? ai : 0), t);
  for (const g of S.tags) {
    if (t < g.tin || t >= g.land) continue;
    const tp = hp_tagPose(g.ch, t); if (!tp) break;
    const kin = eOutCubic(prog(t, g.tin, g.tin + .3));
    let x = lerp(base[0], tp.gx, kin), y = lerp(base[1], tp.gy, kin);
    if (t > g.tout) { const tg = hp_tabGrommet(g.i, t), kf = eInOutCubic(prog(t, g.tout + .25, g.land)); x = lerp(x, tg[0], kf); y = lerp(y, tg[1], kf); }
    return [x, y, 1];
  }
  return [base[0], base[1], 1];
}

// ---------- drawing ----------
function f1_tack(x, y, k = 1) {
  if (k <= 0) return; const s = lerp(1.6, 1, eOutCubic(clamp(k)));
  at(x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(60,32,12,.28)'; ctx.beginPath(); ctx.ellipse(6, 9, 13, 9, .4, 0, 7); ctx.fill();
    ctx.fillStyle = '#B97A1C'; ctx.beginPath(); ctx.arc(0, 1.5, 13, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 14); g.addColorStop(0, '#FFE2A8'); g.addColorStop(.45, C.amber); g.addColorStop(1, '#C98420');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
  });
}
/** one stepper tab, drawn in its hang frame (origin = hang point on the thread) */
function f1_tabDraw(i, geo, t, n) {
  const S = f1_st(), b = geo.b, w = b.w, h = b.h, top = geo.top, x0 = -w / 2, o = b.open, c = 15;
  const shape = () => { ctx.beginPath(); ctx.moveTo(x0 + c, top); ctx.lineTo(x0 + w - c, top); ctx.lineTo(x0 + w, top + c); ctx.arcTo(x0 + w, top + h, x0, top + h, 7); ctx.arcTo(x0, top + h, x0, top, 7); ctx.lineTo(x0, top + c); ctx.closePath(); };
  const cream = b.kind !== 'future';
  ctx.save(); ctx.globalAlpha *= b.alpha;
  withShadow(6, () => { shape(); ctx.fillStyle = cream ? '#E9DCC4' : C.kraftD; ctx.fill(); });
  shape(); ctx.fillStyle = cream ? f1_cream() : (TEX.kraft || C.kraft); ctx.fill();
  if (cream) { ctx.strokeStyle = 'rgba(156,116,71,.55)'; ctx.lineWidth = 2; shape(); ctx.stroke(); }
  if (b.kind === 'active' && o > .02) { ctx.save(); ctx.globalAlpha *= clamp(o * 1.5); ctx.strokeStyle = C.violet; ctx.lineWidth = 4;
    ctx.beginPath(); const q = 2; ctx.moveTo(x0 + c + q, top + q); ctx.lineTo(x0 + w - c - q, top + q); ctx.lineTo(x0 + w - q, top + c + q); ctx.lineTo(x0 + w - q, top + h - q); ctx.lineTo(x0 + q, top + h - q); ctx.lineTo(x0 + q, top + c + q); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  f1_grommet(0, top + 14, 9, 4, false);
  // content
  const fs = lerp(50, S.fAct[i], o), fN = font(FF.stencil, fs, 900), nw = measure(HP_TAGS[i].num, fN), base = top + h - 18 - 2 * o;
  const tick = S.ticks[i], ck = clamp((t - tick) / .25), done = ck > 0;
  const nxNarrow = done ? -18 : 0, nxOpen = x0 + 40 + nw / 2;
  const nx = lerp(nxNarrow, nxOpen, o);
  const numCol = b.kind === 'future' ? 'rgba(74,58,82,.88)' : C.violetD;
  text(HP_TAGS[i].num, nx, base, { font: fN, color: numCol, align: 'center' });
  if (o > .02) {
    ctx.save(); shape(); ctx.clip(); ctx.globalAlpha *= clamp((o - .25) / .6);
    text(HP_WORDS[i], x0 + 40 + nw + 14, base, { font: fN, color: C.ink }); ctx.restore();
  }
  if (done && b.kind !== 'future') {
    // narrow tab: written over the right half · open (active) tab: a tick over its top-right corner, clear of the word
    const cx = lerp(27, w / 2 - 4, o), cy = lerp(top + h * .55, top + 16, o);
    hp_check(cx, cy, ck, lerp(42, 52, o), C.violetD);
  }
  ctx.restore();
  // the short string from the thread down to the grommet
  ctx.save(); ctx.globalAlpha *= Math.max(.6, b.alpha); ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, top + 14); ctx.stroke(); ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, top + 14, 3.5, 0, 7); ctx.fill(); ctx.restore();
}
function f1_drawStepper(t, n) {
  const S = f1_st(), P = HP_STEPPER, mode = hp_stepMode(t);
  // thread (draw-on during birth)
  const pth = mode === 'birth' ? eOutCubic(prog(t, S.e + .22, S.e + .47)) : 1;
  if (pth > 0) {
    const pts = []; for (let x = P.x0; x <= P.x1 + .1; x += 24) pts.push([x, f1_threadY(x, t)]);
    thread(pts, pth, n, { w: 7 });
  }
  f1_tack(P.x0, P.y, mode === 'birth' ? prog(t, S.e + .18, S.e + .3) : 1);
  f1_tack(P.x1, P.y, mode === 'birth' ? prog(t, S.e + .45, S.e + .57) : 1);
  const lay = f1_layout(t);
  for (let i = 0; i < 6; i++) {
    if (mode === 'birth' && f1_twos(t) < S.birth[i]) continue;
    if (lay[i].alpha <= .004) continue;
    const g = f1_tabGeom(i, t);
    at(g.px, g.py, g.r, 1, 1, () => f1_tabDraw(i, g, t, n));
  }
}
function f1_drawUnhook(t, n, k) {
  const S = f1_st(), P = HP_STEPPER, ts = f1_twos(t), us = HP_STEPPER.unhookStart(), ue = HP_STEPPER.unhookEnd();
  const kk = prog(ts, us, ue);
  // the thread lets go at its right end and swings down from the left tack
  const phi = Math.PI * .48 * eInCubic(clamp(kk * 1.4)), pts = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40, L = (P.x1 - P.x0) * u, bend = Math.sin(Math.PI * u) * 30 * (1 - kk);
    pts.push([P.x0 + Math.cos(phi) * L - Math.sin(phi) * bend, P.y + Math.sin(phi) * L + Math.cos(phi) * bend]); }
  ctx.save(); ctx.globalAlpha *= 1 - clamp((kk - .6) / .4); thread(pts, 1, n, { w: 7 }); ctx.restore();
  f1_tack(P.x0, P.y, 1);
  // tabs fall on twos into the recap slots
  const lay = f1_layout(us - 1e-3);
  lay.forEach((b, i) => {
    const kt = clamp((kk - i * .06) / .7), e = eInOutCubic(kt), slot = hp_recapSlot(i), x0 = b.cx, y0 = P.y + P.str + b.h / 2 + 10;
    const x = lerp(x0, slot.x, e), y = lerp(y0, slot.y, e) - Math.sin(Math.PI * e) * 80, r = (rnd(i * 3.3) - .5) * 1.2 * Math.sin(Math.PI * e);
    const s = lerp(1, 1.3, e), a = 1 - clamp((kt - .75) / .25);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    at(x, y - (P.str + b.h / 2) * s, r, s, s, () => f1_tabDraw(i, { b: { ...b, alpha: 1 }, top: P.str, r: 0 }, t, n));
    ctx.restore();
  });
}

(() => {
  registerScene({
    id: 'chapterTags', z: 60,
    draw(t, n) {
      if (!TLD) return; const S = f1_st();
      for (const g of S.tags) {
        hp_sfx('paper_slap', g.tin + .5); hp_sfx('string_pluck', g.tout);
        if (t >= g.tout) continue;                                       // in flight: drawn by the stepper (above the tabs)
        const p = hp_tagPose(g.ch, t); if (!p || p.k <= 0) continue;
        ctx.save(); ctx.globalAlpha *= p.k; at(p.x, p.y, p.r, p.s, p.s, () => f1_chapterTag(HP_TAGS[g.i], p.lift)); ctx.restore();
      }
    },
  });
  registerScene({
    id: 'stepper', z: 75,
    draw(t, n) {
      if (!TLD) return; const S = f1_st(), mode = hp_stepMode(t);
      hp_sfx('string_pluck', S.e); S.birth.forEach(b => hp_sfx('clack_wood', b)); S.ticks.forEach(k => hp_sfx('marker_squeak', k));
      S.ripples.forEach(r => hp_sfx('tab_ticks', r)); S.plucks.forEach(p => hp_sfx('string_pluck', p));
      if (mode === 'hidden' || mode === 'gone') return;
      if (mode === 'unhook') { const k = prog(t, HP_STEPPER.unhookStart(), HP_STEPPER.unhookEnd()); return HP_STEPPER.drawUnhook ? HP_STEPPER.drawUnhook(t, n, k) : f1_drawUnhook(t, n, k); }
      f1_drawStepper(t, n);
      for (const g of S.tags) { if (t < g.tout || t >= g.land) continue;    // a chapter tag flying into its tab
        const p = hp_tagPose(g.ch, t); if (!p || p.k <= 0) continue;
        ctx.save(); ctx.globalAlpha *= p.k; at(p.x, p.y, p.r, p.s, p.s, () => f1_chapterTag(HP_TAGS[g.i], p.lift)); ctx.restore(); }
    },
  });
})();
