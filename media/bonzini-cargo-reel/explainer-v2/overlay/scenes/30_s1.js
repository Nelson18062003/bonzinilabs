'use strict';
// =============================================================================================
// 30_s1 — S1 · 01 L’ACHAT — package B (prefix s1_) — final_storyboard §3 S1, §2.3 T3 (outgoing side), §2.4, §6.
// V03 « Étape un : l’achat. Tout commence en Chine, chez vos fournisseurs. Vos marchandises sont emballées et
// préparées pour le voyage. »  One idea: in China, at the supplier's, your goods go into the carton.
//   s1_back  (z 20): China cut-out + pin, the supplier stall (pop-up hinge) with its shelf goods, the EMBALLÉ ink
//                    that fell on the counter.
//   s1_front (z 50): the CHINE strip, goods hopping into the hero, the violet tape gun, the stamp while it slams,
//                    the kraft flakes of the follow-drop.
//   Hero (drawn by 11_hero): keys / states / moods / cinch registered here. T3 (follow-drop into s2): this file is
//   the OUTGOING side (its layers slide up with hp_followY); 32_s2.js owns the incoming side and the hero's flight.
// Every time is anchored on V03 words or on the T2 / T3 boundaries; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  const S_HERO = .55;                                          // hero scale through s1 (§2.4)
  const STALL = { x: 540, base: 1225, s: .75 };                // pop-up hinge = counter bottom; counter top at y 1000
  const INK = { x: 566, y: 1078, rot: -.10, size: 110 };       // EMBALLÉ on the counter; its frame's top edge runs onto the lid
  const HOVER = { x: 150, y: 1170, s: .45, r: -.12 };          // where T2 (A) leaves the label (§5.3)
  const CN = { s: .85, cx: 1042, cy: -421.5, x0: 560, y0: 560, x1: 210, y1: 470, s1: .42, pin: [1130, -300] };
  const STRIP = { x: 872, y: 416, r: -.05 };

  // ---------------------------------------------------------------- word anchors (lazy: the timeline loads later)
  let _T = null, _TL = null;
  function s1_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V03', w), T = { s0: TL.ch('s1').start, tb: TL.ch('s2').start };
    T.t2 = hp_after(W_('V02', 'Trading'), T.s0 - .4);           // T2 « the box opens » starts (A) [13.92]
    T.land = T.t2 + .53;                                         // open, empty hero settles [14.45]
    T.etape = V('Étape'); T.chine = V('Chine'); T.four = V('fournisseurs'); T.march = V('marchandises');
    T.emb = V('emballées'); T.pour = V('pour'); T.voy = V('voyage');
    T.tagOut = hp_after(T.etape, T.chine);                       // chapter tag 01 lifts off to its tab (E) [17.98]
    T.drop = T.tagOut + .06;                                     // China drops as the tag lifts away [18.04]
    T.strip = T.drop + .2;                                       // CHINE strip slap (lands +.14) [18.24]
    T.pin = T.drop + .44;                                        // push-pin [18.48]
    T.stall = T.four;                                            // pop-up, 4 poses on twos, 0.4 s [18.88]
    T.sign = T.four + .3;                                        // the FOURNISSEUR board drops on the awning [19.18]
    T.heroHop = T.four + .14;                                    // hop onto the counter (lands +.42) [19.02]
    T.hopDur = .3;                                               // goods hop in, all landed before the flaps fold [19.76 … 20.30]
    const gap = clamp((T.emb - .06 - T.hopDur - (T.march - .04)) / 3, .1, .18);
    T.goods = [0, 1, 2, 3].map(i => T.march - .04 + i * gap);
    T.stripOut = T.emb - .1;                                     // CHINE strip picked up [20.56]
    T.close = T.emb; T.tape0 = T.emb + .26; T.tape1 = T.emb + .46; // flaps fold, then the violet tape [20.66 / 20.92]
    T.stamp = T.emb + .45;                                       // EMBALLÉ hit [21.11]
    T.inkSplit = T.stamp + .24;                                  // from here the ink is split: lid part (under the label) + counter part
    T.labelDur = .34;                                            // label flutters back onto the lid [21.84 → 22.18]
    T.hop3 = T.tb - .45;                                         // hop that launches the follow-drop [23.05]
    [T.fa, T.fb] = hp_followWin('s2');                           // T3 window [23.15, 23.85]
    hp_hold('s1 CHINE strip', T.strip + .14, T.stripOut);
    hp_hold('s1 EMBALLÉ', T.stamp, T.fa + .25);
    _TL = TLD; return (_T = T);
  }
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- shelf goods (sizes in SCREEN px)
  // shelf: stall-local coords (×.75 on screen); in: hero-local coords (×.55 on screen) inside the open carton
  const GOODS = [
    { kind: 'box', w: 92, h: 68, band: C.amber, fill: '#ECE3D3', shelf: [-318, -385], in: [-150, -66, -.08], spin: -.5 },
    { kind: 'box', w: 92, h: 68, band: C.sea, fill: '#E4DCCB', shelf: [318, -385], in: [132, -78, .07], spin: .45 },
    { kind: 'bolt', w: 116, h: 44, shelf: [-205, -370], in: [-104, 96, .05], spin: -.35 },
    { kind: 'box', w: 92, h: 68, band: C.kraftD, fill: '#F1E8D6', shelf: [205, -385], in: [150, 88, -.1], spin: .4 },
  ];
  /** a rolled bolt of wax-print fabric, top view, centred (no lettering) */
  function s1_bolt(w, h, lift = 6) {
    const body = () => rrect(-w / 2, -h / 2, w, h, h / 2);
    withShadow(lift, () => { ctx.fillStyle = C.sea; body(); ctx.fill(); });
    ctx.save(); body(); ctx.clip();
    ctx.fillStyle = C.amber; for (let x = -w / 2 + 8; x < w / 2; x += 22) { ctx.beginPath(); ctx.arc(x, -h * .12, h * .2, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.ink; for (let x = -w / 2 + 19; x < w / 2; x += 22) { ctx.beginPath(); ctx.arc(x, h * .18, h * .09, 0, 7); ctx.fill(); }
    ctx.strokeStyle = C.cream; ctx.lineWidth = 3; for (let x = -w / 2 + 3; x < w / 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x + 10, h / 2); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(255,240,220,.35)'); g.addColorStop(.35, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(60,20,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    // rolled end (spiral) on the right
    at(w / 2 - h * .28, 0, 0, 1, 1, () => {
      ctx.fillStyle = '#0A4C86'; ctx.beginPath(); ctx.ellipse(0, 0, h * .26, h / 2 - 1, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,200,.7)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let a = 0; a < 12; a += .3) { const r = 1 + a * .045 * h / 2 / 1.0 * .22; ctx.lineTo(Math.cos(a) * r * .5, Math.sin(a) * r); } ctx.stroke();
    });
  }
  /** a jute sack standing on the shelf, front view, origin = bottom centre (no lettering) */
  function s1_sack(w, h, seed, col) {
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-w * .27, -h * .80);
      ctx.quadraticCurveTo(-w * .57, -h * .58, -w * .5, -h * .14); ctx.quadraticCurveTo(-w * .5, 0, -w * .34, 0);
      ctx.lineTo(w * .34, 0); ctx.quadraticCurveTo(w * .5, 0, w * .5, -h * .14); ctx.quadraticCurveTo(w * .57, -h * .58, w * .27, -h * .80);
      ctx.quadraticCurveTo(w * .12, -h * .86, w * .09, -h * .88); ctx.lineTo(-w * .09, -h * .88); ctx.quadraticCurveTo(-w * .12, -h * .86, -w * .27, -h * .80); ctx.closePath();
    };
    const tuft = () => { ctx.beginPath(); ctx.moveTo(-w * .09, -h * .87); ctx.lineTo(-w * .2, -h * 1.0); ctx.lineTo(-w * .04, -h * .95); ctx.lineTo(w * .03, -h * 1.03);
      ctx.lineTo(w * .09, -h * .95); ctx.lineTo(w * .19, -h * .99); ctx.lineTo(w * .09, -h * .87); ctx.closePath(); };
    withShadow(3, () => { ctx.fillStyle = col; body(); ctx.fill(); tuft(); ctx.fill(); });
    ctx.save(); body(); ctx.clip();
    ctx.lineWidth = 1.3;                                                                      // hessian weave (uneven threads)
    for (let y = -h, i = 0; y < 0; y += 4.2, i++) { ctx.strokeStyle = `rgba(90,60,25,${(.08 + .12 * rnd(seed * 17 + i)).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.quadraticCurveTo(0, y + 2.5 + 1.5 * Math.sin(i * 1.3), w / 2, y + 1); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,236,200,.07)'; for (let x = -w / 2; x < w / 2; x += 5.5) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x + 1, 0); ctx.stroke(); }
    f2_fibres(body, .6);
    ctx.fillStyle = 'rgba(110,74,40,.5)'; for (const y of [-h * .40, -h * .33]) ctx.fillRect(-w / 2, y, w, h * .035);   // two woven stripes
    ctx.strokeStyle = 'rgba(80,52,22,.35)'; ctx.lineWidth = 2;                               // gather folds from the neck
    for (const f of [-.22, .02, .2]) { ctx.beginPath(); ctx.moveTo(w * f * .4, -h * .86); ctx.quadraticCurveTo(w * (f + .06 * (rnd(seed + f) - .5)), -h * .6, w * f * 1.3, -h * .42); ctx.stroke(); }
    const g = ctx.createRadialGradient(-w * .14, -h * .5, 4, 0, -h * .45, w * .7);           // bulge: light upper-left, darker sides and base
    g.addColorStop(0, 'rgba(255,240,210,.22)'); g.addColorStop(.6, 'rgba(255,240,210,0)'); g.addColorStop(1, 'rgba(60,32,12,.28)');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, 2 * w, h); ctx.restore();
    ctx.fillStyle = '#6E4B2A'; rrect(-w * .14, -h * .9, w * .28, h * .06, 3); ctx.fill();    // twine tie + loose end
    ctx.strokeStyle = '#6E4B2A'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w * .12, -h * .87); ctx.quadraticCurveTo(w * .24, -h * .8, w * .2, -h * .7); ctx.stroke();
  }
  function s1_good(g, lift = 6) {
    if (g.kind === 'bolt') return s1_bolt(g.w, g.h, lift);
    shoeBox(g.w, g.h, { band: g.band, fill: g.fill, lift });
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-g.w / 2 + 4, -g.h / 2 + 3, g.w - 8, 3);
  }
  /** stall-local → screen (stall fully up) */
  function s1_stallPt(lx, ly) { return [STALL.x + STALL.s * lx, STALL.base + STALL.s * (ly - 300)]; }
  /** landing target of good i in screen coords (hero pose at the landing instant; cached per timeline) */
  let _tgt = null, _tgtTL = null;
  function s1_target(i, T) {
    if (!_tgt || _tgtTL !== TLD) { _tgt = []; _tgtTL = TLD; }
    if (!_tgt[i]) { const g = GOODS[i], p = hp_pose(T.goods[i] + T.hopDur), [x, y] = f1_heroPt(p, g.in[0], g.in[1]); _tgt[i] = { x, y, r: p.r + g.in[2] }; }
    return _tgt[i];
  }

  // ---------------------------------------------------------------- China cut-out
  function s1_chinaPath() {
    const M = window.BZ_MAP; ctx.beginPath();
    for (const r of M.china) { ctx.moveTo((r[0] - CN.cx) * CN.s, (r[1] - CN.cy) * CN.s);
      for (let i = 2; i < r.length; i += 2) ctx.lineTo((r[i] - CN.cx) * CN.s, (r[i + 1] - CN.cy) * CN.s); ctx.closePath(); }
  }
  function s1_chinaCut(lift) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // scissor margin of the printed sheet it was cut from (cream rim) + contact shadow
    withShadow(lift, () => { s1_chinaPath(); ctx.fillStyle = '#F8F1E3'; ctx.fill(); ctx.strokeStyle = '#F8F1E3'; ctx.lineWidth = 24; ctx.stroke(); });
    s1_chinaPath(); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
    f2_fibres(s1_chinaPath, .55);
    ctx.save(); s1_chinaPath(); ctx.clip();                      // soft relief: lighter north-east, deeper south-west
    const g = ctx.createLinearGradient(220, -200, -220, 200); g.addColorStop(0, 'rgba(255,240,215,.22)'); g.addColorStop(1, 'rgba(90,55,20,.18)');
    ctx.fillStyle = g; ctx.fillRect(-300, -220, 600, 440); ctx.restore();
    ctx.strokeStyle = C.violetD; ctx.lineWidth = 6; s1_chinaPath(); ctx.stroke();
    ctx.restore();
  }
  function s1_drawChina(t, n, T) {
    const ts = tw(t); if (ts < T.drop) return;
    const kd = prog(ts, T.drop, T.drop + .24), ks = eInOutCubic(prog(ts, T.four, T.four + .4)), u = ts - T.drop - .24;
    const sq = u > 0 ? 1 - Math.exp(-u * 12) * Math.cos(u * 36) * .025 : 1;
    const s = lerp(1, CN.s1, ks) * lerp(1.22, 1, eInCubic(kd)) * sq, j = jit(301, n, .35);
    const x = lerp(CN.x0, CN.x1, ks), y = lerp(CN.y0, CN.y1, ks), lift = kd < 1 ? lerp(46, 9, kd) : (ks > 0 && ks < 1 ? 9 + 22 * Math.sin(Math.PI * ks) : 9);
    ctx.save(); ctx.globalAlpha *= clamp(kd * 5);
    at(x + j.x, y + j.y, -.03 + j.r + .05 * Math.sin(Math.PI * ks), s, s, () => s1_chinaCut(lift));
    ctx.restore();
    // orange push-pin (no city: just « here, in China »)
    if (ts >= T.pin) {
      const up = ts - T.pin, ps = (up < .1 ? lerp(1.7, 1, eInCubic(up / .1)) : 1) * lerp(1, .72, ks);
      const px = x + (CN.pin[0] - CN.cx) * CN.s * s, py = y + (CN.pin[1] - CN.cy) * CN.s * s;
      at(px + j.x, py + j.y, 0, ps, ps, () => pushPin(0, 0, C.orange));
    }
  }

  // ---------------------------------------------------------------- the supplier stall (pop-up)
  function s1_shelf(t, n, T) {                                    // stall-local; called between the posts and the counter
    const ts = tw(t);
    withShadow(4, () => { ctx.fillStyle = C.kraftD; ctx.fillRect(-386, -340, 772, 16); });
    ctx.fillStyle = 'rgba(255,236,200,.3)'; ctx.fillRect(-386, -340, 772, 3);
    ctx.fillStyle = '#7E5A34'; for (const x of [-300, 300]) { ctx.beginPath(); ctx.moveTo(x - 8, -324); ctx.lineTo(x + 8, -324); ctx.lineTo(x, -296); ctx.closePath(); ctx.fill(); }
    // stock that stays: jute sacks — another shape and material than the goods, so nothing on the shelf duplicates
    // what went into the carton (the 4 goods leave the shelf one by one: it reads as « your goods » leaving the supplier)
    at(-74, -338, -.035, 1 / STALL.s, 1 / STALL.s, () => s1_sack(84, 104, 1, '#BE9A62'));
    at(66, -338, .03, 1 / STALL.s, 1 / STALL.s, () => s1_sack(104, 78, 2, '#B08B55'));
    GOODS.forEach((g, i) => { if (ts >= T.goods[i]) return;
      const d = jit(410 + i, n, ts > T.goods[i] - .1 ? .9 : 0);    // a little wobble just before it jumps
      at(g.shelf[0] + d.x, g.shelf[1] + d.y, d.r, 1 / STALL.s, 1 / STALL.s, () => s1_good(g, 3)); });
  }
  function s1_sign(t, T) {                                       // stall-local, propped on the awning
    const ts = tw(t); if (ts < T.sign) return;
    const u = ts - T.sign, k = clamp(u / .14);
    const s = u < .14 ? lerp(1.4, 1, eInCubic(k)) : 1 - Math.exp(-(u - .14) * 12) * Math.cos((u - .14) * 36) * .04;
    const f = font(FF.hand, 62, 800), w = measure('FOURNISSEUR', f) + 70;
    at(-12, -662, -.02, s, s, () => {
      ctx.globalAlpha *= clamp(k * 4);
      withShadow(u < .14 ? lerp(34, 8, k) : 8, () => { ctx.fillStyle = C.ink; rrect(-w / 2, -54, w, 108, 12); ctx.fill(); });
      ctx.strokeStyle = 'rgba(255,236,200,.16)'; ctx.lineWidth = 3; rrect(-w / 2 + 10, -44, w - 20, 88, 8); ctx.stroke();
      text('FOURNISSEUR', 0, 22, { font: f, align: 'center', color: C.amber });
      for (const x of [-w / 2 + 24, w / 2 - 24]) { ctx.fillStyle = '#C98420'; ctx.beginPath(); ctx.arc(x, -32, 7, 0, 7); ctx.fill(); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x - 1, -33, 5.5, 0, 7); ctx.fill(); }
    });
  }
  /** the supplier's counter front, repainted light plywood so the kraft hero reads on it (stall-local, over the kit counter) */
  function s1_counterFace() {
    const face = () => { ctx.beginPath(); ctx.rect(-430, 18, 860, 282); };
    ctx.fillStyle = '#EAD8B4'; face(); ctx.fill();
    f2_fibres(face, .7);
    ctx.save(); face(); ctx.clip();
    ctx.strokeStyle = 'rgba(156,116,71,.22)'; ctx.lineWidth = 1.6;                        // wood grain
    for (let i = 0; i < 26; i++) { const y = 30 + i * 10.6; ctx.beginPath(); for (let x = -430; x <= 430; x += 40) ctx.lineTo(x, y + Math.sin(x * .013 + i * 1.7) * 3); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(120,84,44,.42)'; ctx.lineWidth = 3; for (let x = -430 + 143; x < 430; x += 143.3) { ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, 300); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, 18, 0, 300); g.addColorStop(0, 'rgba(60,32,12,.16)'); g.addColorStop(.12, 'rgba(60,32,12,0)'); g.addColorStop(1, 'rgba(60,32,12,.10)');
    ctx.fillStyle = g; ctx.fillRect(-430, 18, 860, 282);
    ctx.restore();
    ctx.fillStyle = C.kraftD; ctx.fillRect(-430, 268, 860, 14); ctx.fillStyle = 'rgba(255,236,200,.25)'; ctx.fillRect(-430, 268, 860, 3);   // kick rail
  }
  function s1_drawStall(t, n, T) {
    const ts = tw(t); if (ts < T.stall) return;
    const i = Math.min(4, Math.ceil(prog(ts, T.stall, T.stall + .4) * 4)), sy = [0, .3, .78, 1.06, 1][i];
    if (sy <= 0) return;
    at(STALL.x, STALL.base, 0, STALL.s, STALL.s * sy, () => {
      ctx.translate(0, -300);
      stall(860, { stripe: C.orange, boxes: false, behind: () => s1_shelf(t, n, T) });
      s1_counterFace();
      s1_sign(t, T);
    });
  }

  // ---------------------------------------------------------------- EMBALLÉ ink (split: counter part here, lid part on the hero)
  const INK_F = () => font(FF.stencil, INK.size, 900);
  const INK_STARVE = .3;                                       // < the bible's .45: at .45 the É's accent was eaten (read « EMBALLE » at phone size)
  const INK_H = INK.size * 1.5;                                // frame taller than hp_stamp's 1.3: the accent no longer touches the frame's top edge
  /** stamp-local box [x0, y0, x1, y1] that holds only the É's accent (over the last glyph, between cap height and the accent's top;
   *  narrow in x so the frame's sides never fall inside it) */
  function s1_accBand(f) {
    ctx.save(); ctx.font = f; ctx.letterSpacing = '4px'; ctx.textBaseline = 'middle';
    const cap = ctx.measureText('E').actualBoundingBoxAscent, top = ctx.measureText('É').actualBoundingBoxAscent;
    const w = ctx.measureText('EMBALLÉ').width, wE = ctx.measureText('É').width; ctx.restore();
    return [w / 2 - wE - 6, Math.max(-top - 4, -INK_H / 2 + 7), w / 2 + 6, -cap - 1];
  }
  /** EMBALLÉ, box + starved ink; the accent is printed with fresh ink (barely starved) so the word never reads « EMBALLE » */
  function s1_ink(alpha = 1) {
    const f = INK_F(), o = { box: true, alpha, h: INK_H, ls: 4 }, [x0, y0, x1, y1] = s1_accBand(f);
    ctx.save(); ctx.beginPath(); ctx.rect(-700, -210, 1400, 420); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip('evenodd');
    stampText('EMBALLÉ', 0, 0, f, C.orange, { ...o, starve: INK_STARVE }); ctx.restore();
    if (y1 <= y0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    stampText('EMBALLÉ', 0, 0, f, C.orange, { ...o, starve: .05 }); ctx.restore();
  }
  let _ref = null, _refTL = null;
  /** hero pose at the instant the ink is split (cached) + its footprint on the table */
  function s1_ref(T) {
    if (_ref && _refTL === TLD) return _ref;
    const p = { ...hp_pose(T.inkSplit) }, W2 = HP_HERO.w / 2, H2 = HP_HERO.h / 2, b = HP_HERO.bev;
    const foot = [[-W2, -H2], [W2, -H2], [W2 + b * .4, -H2 + b * .6], [W2 + b * .4, H2 + b * .6], [-W2 + b * .4, H2 + b * .6], [-W2, H2]].map(([x, y]) => f1_heroPt(p, x, y));
    _refTL = TLD; return (_ref = { p, foot });
  }
  /** lid part — hero-local (called by 11_hero through the `lidArt` state, under the label). It only reads as ink while
   *  it continues the counter's frame: it fades out during the T3 follow-drop (alone in s2 it was a stray red line). */
  function s1_inkLid(T, alpha = 1) {
    const { p } = s1_ref(T), dx = INK.x - p.x, dy = INK.y - p.y, c = Math.cos(-p.r), s = Math.sin(-p.r), k = p.s;
    ctx.save(); rrect(-HP_HERO.w / 2, -HP_HERO.h / 2, HP_HERO.w, HP_HERO.h, 5); ctx.clip();
    at((dx * c - dy * s) / (k * p.sx), (dx * s + dy * c) / (k * p.sy), INK.rot - p.r, 1 / (k * p.sx), 1 / (k * p.sy), () => s1_ink(alpha));
    ctx.restore();
  }
  /** counter part — table coords, everything outside the box's footprint */
  function s1_inkTable(t, T) {
    if (t < T.inkSplit) return;
    const { foot } = s1_ref(T);
    ctx.save(); ctx.beginPath(); ctx.rect(-200, -200, W + 400, H + 400); ctx.moveTo(...foot[0]); for (const q of foot) ctx.lineTo(...q); ctx.closePath(); ctx.clip('evenodd');
    at(INK.x, INK.y, INK.rot, 1, 1, () => s1_ink(1)); ctx.restore();
  }

  // ---------------------------------------------------------------- CHINE strip
  function s1_stripShape(w, h) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 41, 3.2, 13), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 47, 3.2, 13);
    ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath();
  }
  function s1_strip(lift) {
    const fT = font(FF.stencil, 80, 900), fC = font(FF.cjk, 44, 400);
    const w = Math.max(measure('CHINE', fT, 5), measure('中国', fC, 10)) + 84, h = 188;
    withShadow(lift, () => { s1_stripShape(w, h); ctx.fillStyle = C.cream; ctx.fill(); });
    ctx.save(); s1_stripShape(w, h); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    text('CHINE', 0, -4, { font: fT, align: 'center', color: C.ink, ls: 5 });
    ctx.strokeStyle = 'rgba(74,58,82,.28)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(-w / 2 + 34, 14); ctx.lineTo(w / 2 - 34, 14); ctx.stroke(); ctx.setLineDash([]);
    text('中国', 0, 64, { font: fC, align: 'center', color: C.inkSoft, ls: 10 });
    ctx.fillStyle = C.tape; at(-w / 2 + 16, -h / 2 + 8, -.6, 1, 1, () => ctx.fillRect(-40, -15, 80, 30));
  }
  function s1_drawStrip(t, n, T) {
    const ts = tw(t); if (ts < T.strip) return;
    const u = ts - T.strip, k = clamp(u / .14), ko = prog(ts, T.stripOut, T.stripOut + .32); if (ko >= 1) return;
    const s = (u < .14 ? lerp(1.25, 1, eInCubic(k)) : 1 - Math.exp(-(u - .14) * 12) * Math.cos((u - .14) * 36) * .03) * (1 + .1 * Math.sin(Math.PI * ko));
    const d = drift(t, 43, 2), eo = eInCubic(ko);
    ctx.save(); ctx.globalAlpha *= clamp(k * 4) * (1 - prog(ko, .7, 1));
    at(STRIP.x + d.x + 260 * eo, STRIP.y + d.y - 170 * eo, STRIP.r + d.r + .35 * eo, s, s, () => s1_strip(u < .14 ? lerp(34, 10, k) : 10 + 30 * Math.sin(Math.PI * ko)));
    ctx.restore();
  }

  // ---------------------------------------------------------------- goods in flight, tape gun
  function s1_drawHops(t, n, T) {
    const ts = tw(t);
    GOODS.forEach((g, i) => {
      const t0 = T.goods[i], t1 = t0 + T.hopDur; if (ts < t0 || ts >= t1) return;
      const k = (ts - t0) / T.hopDur, [sx, sy] = s1_stallPt(g.shelf[0], g.shelf[1]), tg = s1_target(i, T), e = eInOutCubic(k);
      const x = lerp(sx, tg.x, e), y = lerp(sy, tg.y, e) - 150 * 4 * k * (1 - k), s = 1 + .22 * Math.sin(Math.PI * k);
      at(x, y, lerp(0, tg.r, e) + g.spin * Math.sin(Math.PI * k), s, s, () => s1_good(g, 10 + 38 * Math.sin(Math.PI * k)));
    });
  }
  /** cut-paper tape gun, top view; origin = the serrated blade pressing the tape, the gun trails behind it (−y) */
  function s1_gun(k) {
    withShadow(18, () => {                                                                  // pistol grip + side plate (ink)
      ctx.fillStyle = C.ink; at(30, -100, .62, 1, 1, () => { rrect(-17, -78, 34, 120, 15); ctx.fill(); });
      ctx.fillStyle = '#3A2E42'; ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(30, 2); ctx.lineTo(36, -70); ctx.lineTo(14, -112); ctx.lineTo(-24, -104); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; at(30, -100, .62, 1, 1, () => { rrect(-11, -72, 7, 104, 4); ctx.fill(); });
    ctx.fillStyle = 'rgba(169,71,254,.92)'; ctx.fillRect(-19, -40, 38, 40);                // tape running from the roll to the blade
    at(-4, -66, 0, 1, 1, () => {                                                           // the violet roll (the hero's tape)
      withShadow(6, () => { ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); });
      ctx.strokeStyle = 'rgba(60,10,110,.25)'; ctx.lineWidth = 1.5; for (const r of [38, 32, 27]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 36, -2.5, -1.3); ctx.stroke();
      ctx.fillStyle = '#E9D8B8'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();    // cardboard core
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      at(0, 0, k * 9, 1, 1, () => { ctx.fillStyle = C.inkSoft; ctx.fillRect(-2, -19, 4, 9); });   // turns as it pulls
    });
    ctx.fillStyle = '#A9AEB5'; ctx.beginPath(); ctx.moveTo(-34, -6);                       // serrated blade
    for (let i = 0; i <= 10; i++) ctx.lineTo(-34 + i * 6.8, i % 2 ? 7 : 1); ctx.lineTo(34, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-32, -6, 64, 2);
  }
  function s1_drawGun(t, n, T) {
    const ts = tw(t), a = T.tape0 - .12, b = T.tape1 + .14; if (ts < a || ts > b) return;
    const p = hp_pose(t), ya = -HP_HERO.h / 2 - 4, yb = HP_HERO.h / 2 + HP_HERO.bev - 2, kk = prog(ts, T.tape0, T.tape1);
    const [hx, hy] = f1_heroPt(p, HP_HERO.tapeX, lerp(ya, yb, kk));
    const kin = eOutCubic(prog(ts, a, T.tape0)), kout = eInCubic(prog(ts, T.tape1, b));
    // the body swings ~50° to the right so the freshly laid violet strip stays visible behind the blade
    const x = hx + 150 * (1 - kin) + 120 * kout, y = hy - 150 * (1 - kin) + 130 * kout, r = p.r + .88 + .4 * (1 - kin) + .5 * kout;
    ctx.save(); ctx.globalAlpha *= clamp(kin * 3) * (1 - prog(kout, .6, 1)); at(x, y, r, 1, 1, () => s1_gun(kk)); ctx.restore();
  }

  // ---------------------------------------------------------------- hero registrations (§2.4)
  hp_keys('s1', () => {
    const T = s1_T();
    return [
      { t: T.land, dur: .5, x: 540, y: 1080, s: S_HERO, r: -.02 },                 // contract pose at the end of T2
      { t: T.land + .95, dur: .6, y: 1064 },                                        // settles clear of the caption band
      { t: T.heroHop + .42, dur: .3, y: 905, twos: true },                         // hops onto the counter [19.44]
      { t: T.voy + .26, dur: .26, r: -.06 },                                        // turns, « ready »
    ];
  });
  /** label pose on the lid, replicated from the track (no states/moods are active then) — avoids recursion into hp_pose */
  function s1_labelHome(t) {
    const tr = f1_trackAt(t), d = drift(t, 7, 3), br = 1 + .006 * Math.sin(t * Math.PI * 2 / 2.4);
    const x = tr.x + d.x, y = tr.y + d.y, s = tr.s * br, r = tr.r + d.r, lx = HP_HERO.label.x * s, ly = HP_HERO.label.y * s;
    return { x: x + lx * Math.cos(r) - ly * Math.sin(r), y: y + lx * Math.sin(r) + ly * Math.cos(r), s, r: r + HP_HERO.label.r };
  }
  function s1_labelPose(t, T) {
    if (t < T.pour) return { x: HOVER.x, y: HOVER.y, s: HOVER.s, r: HOVER.r, lift: 10, bob: 3 * prog(t, T.t2 + .52, T.t2 + .95) };   // hovering, as A's T2 leaves it
    const D = T.labelDur, ts = tw(t), k = clamp((ts - T.pour) / D), u = t - T.pour - D;
    if (u >= .1) return null;                                                                     // on the lid
    const Hm = s1_labelHome(t), e = eInOutCubic(k), hb = drift(t, 13, 3), arc = Math.sin(Math.PI * k);
    const r = lerp(HOVER.r + hb.r * 4, Hm.r, e) + .55 * arc * Math.cos(k * Math.PI * 2.4) - drift(t, 13, 0).r * 4;   // flutter
    const slap = u >= 0 ? 1 + .05 * (1 - u / .1) : 1;
    return { x: lerp(HOVER.x + hb.x, Hm.x, e), y: lerp(HOVER.y + hb.y, Hm.y, e) - 170 * arc, s: lerp(HOVER.s, Hm.s, e) * (1 + .2 * arc) * slap, r,
      lift: u >= 0 ? 2 : 10 + 44 * arc, bob: 0 };
  }
  function s1_contents(t, T) {
    const ts = tw(t);
    GOODS.forEach((g, i) => {
      const u = ts - T.goods[i] - T.hopDur; if (u < 0) return;
      const q = u < .3 ? Math.exp(-u * 14) * Math.cos(u * 40) * .07 : 0, sc = 1 / S_HERO;
      at(g.in[0], g.in[1], g.in[2], sc * (1 + q), sc * (1 - q), () => s1_good(g, 3));
    });
  }
  hp_states('s1', t => {
    const T = s1_T(); if (t < T.land) return {};                 // T2 belongs to A
    const ts = tw(t), o = { visible: true, label: 'on', chineK: 1, vousK: 1, tapeSnap: 0 };
    o.flaps = 1 - prog(ts, T.close, T.close + .3);                 // 4 poses on twos (11_hero quantises)
    o.tapeK = prog(ts, T.tape0, T.tape1);
    o.contents = () => s1_contents(t, T);
    const inkA = 1 - prog(t, T.hop3 + .04, T.fa + .1);            // lid ink fades as the box hops off the counter (gone well before the T3 landing)
    o.lidArt = t >= T.inkSplit && inkA > 0 ? () => s1_inkLid(T, inkA) : null;
    o.labelPose = s1_labelPose(t, T);
    if (t < T.fa) {                                                // each good landing dips the carton
      let dip = 0; for (const g0 of T.goods) { const u = ts - g0 - T.hopDur; if (u >= 0 && u < .2) dip = Math.max(dip, Math.sin(Math.PI * u / .2) * (1 - u / .2) * 1.6); }
      o.dy = 7 * dip; o.syMul = 1 - .04 * dip; o.sxMul = 1 + .02 * dip;
    }
    return o;
  });
  hp_mood('s1', () => { const T = s1_T(); return [{ kind: 'land', t0: T.land },   // A's T2 tosses the box to exactly where `land` starts
    { kind: 'hop', t0: T.heroHop }, { kind: 'hop', t0: T.hop3 }]; });
  hp_cinch(() => s1_T().voy);

  // ---------------------------------------------------------------- sound (§6)
  function s1_cues(T) {
    hp_sfx('cardboard_thud', T.land); hp_sfx('paper_slap', T.drop + .24); hp_sfx('paper_slap', T.strip + .14); hp_sfx('pin_click', T.pin + .1);
    hp_sfx('popup_fold', T.stall); hp_sfx('paper_slide', T.four + .02); hp_sfx('paper_slap', T.sign + .14); hp_sfx('cardboard_thud', T.heroHop + .42);
    T.goods.forEach(g => hp_sfx('thup', g + T.hopDur));
    hp_sfx('flap_fold', T.close + .06); hp_sfx('tape_rip', T.tape0); hp_sfx('sticker_slap', T.pour + T.labelDur); hp_sfx('knot_tie', T.voy);
  }

  // ---------------------------------------------------------------- scenes
  registerScene({
    id: 's1_back', z: 20, when: t => TL.in(t, 's1', 0, .4),
    draw(t, n) {
      const T = s1_T(); s1_cues(T); if (t < T.drop) return;
      ctx.save(); ctx.translate(0, hp_followY(t, 's2', 'out'));     // T3: the s1 table leaves upward
      s1_drawStall(t, n, T);
      s1_drawChina(t, n, T);
      s1_inkTable(t, T);
      ctx.restore();
    },
  });
  registerScene({
    id: 's1_front', z: 50, when: t => TL.in(t, 's1', 0, .4),
    draw(t, n) {
      const T = s1_T();
      hp_stamp('EMBALLÉ', INK.x, INK.y, T.stamp - 1, T.stamp, { size: INK.size, rot: INK.rot, color: C.orange, shake: 12, starve: INK_STARVE });   // registers (budget, shake, cue)
      if (t < T.drop) return;
      ctx.save(); ctx.translate(0, hp_followY(t, 's2', 'out'));
      s1_drawStrip(t, n, T);
      s1_drawHops(t, n, T);
      s1_drawGun(t, n, T);
      if (t < T.inkSplit) {                                       // the slam, drawn with s1_ink (taller frame + fresh accent) — hp_stamp above only registers it
        const sl = slam(t, T.stamp); if (sl.a > 0) at(INK.x, INK.y, INK.rot, sl.s, sl.s, () => s1_ink(sl.a));
      }
      if (t > T.fa) hp_flakes(t, T.fa + .05, 540, 830, 6, { seed: 17 });   // T3: kraft flakes stay behind
      ctx.restore();
    },
  });
})();
