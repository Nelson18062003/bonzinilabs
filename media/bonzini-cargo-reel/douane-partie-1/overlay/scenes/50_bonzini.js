'use strict';
// =============================================================================================
// 50_bonzini — S26–S27 at ⑧ MBOPPI (the stall is drawn by 34_mboppi; everything here is laid over it).
//  S26 « Chez Bonzini… on veut que vous réussissiez. » (camera: the stall, z 1.15)
//    · the camera settles: Junior, hand at his chin, thinks aloud — bubble « La prochaine fois, je saurai avant. »
//    · « Bonzini »: he takes out his phone (phoneFrame) — it flies up to the right of him; the Bonzini logo assembles on its
//      screen; « réglez vos fournisseurs »: « Payer un fournisseur » is written; « francs CFA »: « en francs CFA ».
//      A generic paper screen: no amount, no rate, nothing about this container. Junior points at it.
//    · « réussissiez »: thumbs up; six small paper hearts rise from him (restrained: no confetti over the texts).
//    · end of S26 (camera push on Junior, z 1.8): the same phone glides to the centre and grows.
//  S27 « Bientôt dans l'application … estimés en quelques questions. »
//    · the screen slides to the MASKED simulator captures only: app_m_sugg (« mèches » typed) → Junior's finger taps the
//      suggestion → app_m_product → app_sim_05_filled → app_m_result (short scroll, line highlights, computed values blurred).
//      Sticker « BIENTÔT · APERÇU » slapped on the phone; an opaque paper band taped over the bottom of the phone:
//      « Estimation · à faire confirmer par un commissionnaire agréé en douane » (≥ 36 px). The band also hides every
//      general-rate line of the result (the TVA line of the capture never enters the frame).
//    « D'abord au Cameroun ; ensuite, c'est notre ambition, ailleurs en Afrique. »
//    · the phone goes back down into Junior's hand; the little map pinned on the stall wall (34_mboppi) is unpinned and
//      comes forward (the wall keeps its pin and a paler rectangle); « Cameroun »: the country lights up violet — strip
//      « D'ABORD LE CAMEROUN »; « ensuite… ambition »: the map pulls back and a gentle paper outline of Africa appears
//      around it, bathed in amber — strip « ENSUITE, NOTRE AMBITION » (never « bientôt partout », no other country named).
//    · end of S27: the map flies back onto its pin while the camera pulls back for S28.
// z 23 (world) wall patch while the map is off the wall · 45 bubble · 47 hearts · 48 phone (+ sticker, band, finger) · 50 map.
// Top-level names: none (IIFE). Scene ids F50_*.
// =============================================================================================
(() => {
  const PW = 540, PHH = 885, SC = PW / 1170;                        // phone screen in phone units (= screen px at s 1); capture px → units
  const SHOTS = ['app_m_sugg', 'app_m_product', 'app_sim_05_filled', 'app_m_result'];
  const P26 = { x: 772, y: 772, s: .72 }, P27 = { x: 555, y: 735, s: 1 };
  const BAND = { y: 405, w: 650, h: 156 };                            // mention band, phone-local (units)
  const MAPW0 = { x: 7955, y: 550, r: -.04 };                         // the pinned map on the stall wall (34_mboppi, world; card 164 × 176, cmrMap(9.6))
  const mapW = () => (window.M34 && M34.map ? { x: M34.map.x, y: M34.map.y, r: MAPW0.r } : MAPW0);
  const CARD = { w: 164, h: 176, sx0: -7.2 * 9.6, sx1: 7.6 * 9.6, sy0: -8.4 * 9.6, sy1: 7.6 * 9.6 };  // card + its sea window (wall units)
  const MDISP = { x: 540, y: 505, s: 2.7 };                           // the map card on display (screen)
  const HEARTC = [C.orange, C.violet, C.amber, '#E8475F'];
  let T = null;

  // ---------- time table (lazy) -----------------------------------------------------------------------
  function tm() {
    if (T) return T;
    const o = {};
    o.bub0 = ss('S26', -.3); o.ph0 = tw('S26', 'Bonzini', -.05); o.ph1 = o.ph0 + .55;
    o.bub1 = Math.max(o.bub0 + 2.6, o.ph1 + 1.2);
    o.txt1 = tw('S26', 'réglez', 0); o.txt2 = tw('S26', 'francs', 0);
    o.thumb = tw('S26', 'veut', 0); o.hearts = tw('S26', 'réussissiez', 0);
    o.push0 = ss('S27', -.8); o.push1 = ss('S27', 0);
    o.stk = tw('S27', 'Bientôt', .05);
    o.scr = [ss('S27', .05), tw('S27', 'vos', -.05), tw('S27', 'estimés', -.02), tw('S27', 'questions', -.15)];
    for (let i = 1; i < 4; i++) o.scr[i] = Math.max(o.scr[i], o.scr[i - 1] + .8);
    o.tap = o.scr[1] - .38; o.band = o.scr[0] + .35;
    o.exit0 = Math.max(tw('S27', 'abord', .3), o.scr[3] + 1.0); o.exit1 = o.exit0 + .45;
    o.m0 = o.exit0 + .32; o.m1 = o.m0 + .55;
    o.lit = Math.max(tw('S27', 'Cameroun', 0), o.m1); o.l1 = o.lit + .08;
    o.z0 = Math.max(tw('S27', 'ensuite', .05), o.lit + .5); o.z1 = Math.max(tw('S27', 'ambition', 0), o.z0 + 1.0);
    o.l2 = Math.max(tw('S27', 'ensuite', .25), o.z0 + .2);            // on « ensuite »: ≥ 2.5 s on screen
    o.r0 = Math.max(se('S27', 0), o.l2 + 1.8); o.r1 = o.r0 + .75;
    addShake(o.stk + .12, 7, .12);                                    // sticker slapped on the phone (sound cue)
    addShake(o.band + .1, 3, .08);                                    // the band is taped
    addShake(o.lit, 3, .1);
    T = o; return T;
  }
  const E = (t, a, d) => eInOutCubic(prog(t, a, a + d));
  const juniorHand = t => { const st = actorAt('junior', t); return st ? worldToScreen(st.x + 35, st.y + 75, t) : { x: 480, y: 1050 }; };

  // ---------- Junior acts (poses) ---------------------------------------------------------------------
  const IDLE = [158, 262];
  const mixA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  poseHook('junior', (t) => {
    if (!TLD) return null; const k = tm();
    if (t < k.bub0 - .2 || t > k.r1 + .3) return null;
    const ts = Math.floor(t * 15) / 15;                                // arm moves on twos
    const named = (q, from, to, name) => (q >= 1 ? name : mixA(from, to, q));   // the finger / thumb is only drawn for a named pose
    if (t < k.ph0) return { face: 'think', arms: [named(E(ts, k.bub0 - .2, .35), IDLE, [14, -34], 'chin'), IDLE] };       // hand at the chin
    if (t < k.thumb) { const a = E(ts, k.ph0, .3), b = E(ts, k.txt1 - .15, .3);
      return { face: 'smile', arms: [mixA([14, -34], IDLE, a), b > 0 ? named(b, [120, 70], [330, -70], 'point') : mixA(IDLE, [120, 70], a)] }; }   // phone out, then points at it
    if (t < k.push0 + .4) { const a = E(ts, k.thumb, .25);
      return { face: 'grin', arms: [named(a, IDLE, [235, 10], 'thumb'), mixA([330, -70], IDLE, a)] }; }                  // thumbs up (left hand: the right one is behind the phone)
    if (t < k.exit0) return { face: 'grin', arms: [IDLE, 'hold'] };                                                        // holds the phone (hidden by it)
    if (t < k.r0) return { face: 'grin', look: -.35 };                                                                     // looks up at the map
    return { face: 'smile' };
  });

  // ---------- small helpers ---------------------------------------------------------------------------
  function reveal(k, x0, y, w, h, fn) { if (k <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(x0, y, w * clamp(k), h); ctx.clip(); fn(); ctx.restore(); }
  function tape(x, y, r, w = 96) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-w / 2, -16, w, 32); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2, -12, w, 5); }); }
  function tornPaper(w, h, seed, fill, lift = 10) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed, 3, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, seed + 4, 3, 12);
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }

  // ---------- S26: Junior's thought bubble ------------------------------------------------------------
  function thought(t, n) {
    const k = tm(); if (t < k.bub0 || t > k.bub1 + .3) return;
    const a = clamp(spring(t - k.bub0, 13, .5), 0, 1.15) * (1 - eInCubic(prog(t, k.bub1, k.bub1 + .28)));
    if (a <= .01) return;
    const L = ['La prochaine fois,', 'je saurai avant.'], fs = 48, f = font(FF.hand, fs, 800);
    const w = Math.max(...L.map(s => measure(s, f))) + 76, h = L.length * fs * 1.24 + 44, cx = 314, cy = 560;
    const hd = (() => { const st = actorAt('junior', t); return st ? worldToScreen(st.x - 10, st.y - 185, t) : { x: 430, y: 770 }; })();
    const j = jit(501, n, .4);
    at(cx + j.x, cy + j.y, -.015, a, a, () => {
      withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, 40); ctx.fill();
        const bx = hd.x - cx, by = hd.y - cy;                            // tail towards Junior's head
        ctx.beginPath(); ctx.moveTo(26, h / 2 - 6); ctx.lineTo(lerp(26, bx, .78), lerp(h / 2, by, .78)); ctx.lineTo(92, h / 2 - 6); ctx.closePath(); ctx.fill(); });
      ctx.strokeStyle = 'rgba(123,34,214,.35)'; ctx.lineWidth = 4; rrect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 34); ctx.stroke();
      L.forEach((s, i) => text(s, 0, -h / 2 + 22 + fs * .98 + i * fs * 1.24, { font: f, align: 'center', color: i ? C.violetD : C.ink }));
    });
  }

  // ---------- the phone's screens ---------------------------------------------------------------------
  function homeScreen(x, y, w, h, t, n) {                             // generic Bonzini screen: pay a supplier in CFA francs
    const k = tm();
    ctx.fillStyle = '#FBF8F1'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#F1E6FF'; ctx.fillRect(x, y, w, 310);
    ctx.fillStyle = 'rgba(169,71,254,.12)'; ctx.beginPath(); ctx.arc(x + w * .82, y + 40, 150, 0, 7); ctx.fill();
    // the logo assembles on « Bonzini » (pieces fly in a short distance, on twos)
    const ts = stepT(n), from = { wingTop: [-120, -40, -.5], wingBot: [-120, 50, .5], amber: [20, -110, .4], orange: [110, 40, -.4] }, order = { wingTop: 0, wingBot: 1, amber: 2, orange: 3 }, off = {};
    for (const r in from) { const q = clamp(spring(ts - (k.ph0 + .12 + order[r] * .06), 14, .55), 0, 1.15), f = from[r]; off[r] = [f[0] * (1 - q), f[1] * (1 - q), f[2] * (1 - q), clamp(q * 3)]; }
    drawLogo(x + w / 2, y + 160, 210, { offsets: off });
    // card: « Payer un fournisseur » / « en francs CFA »
    const cy = y + 350;
    withShadow(8, () => { ctx.fillStyle = '#FFFFFF'; rrect(x + 30, cy, w - 60, 350, 30); ctx.fill(); });
    ctx.fillStyle = C.violet; rrect(x + 30, cy, 16, 350, 8); ctx.fill();
    const f1 = font(FF.body, 70, 800), f2 = font(FF.body, 64, 700), q1 = E(t, k.txt1, .45), q2 = E(t, k.txt2, .4);   // ≥ 46 px on screen at s .72
    reveal(q1, x + 56, cy + 20, w - 86, 200, () => { text('Payer un', x + 66, cy + 104, { font: f1, color: C.ink }); text('fournisseur', x + 66, cy + 186, { font: f1, color: C.ink }); });
    reveal(q2, x + 56, cy + 220, w - 86, 110, () => text('en francs CFA', x + 66, cy + 290, { font: f2, color: C.violetD }));
    // a plain violet button (arrow only: no amount, no rate)
    const by = y + 752, bk = E(t, k.txt2 + .3, .35);
    ctx.save(); ctx.globalAlpha *= bk; withShadow(6, () => { ctx.fillStyle = C.violet; rrect(x + 60, by, w - 120, 104, 52); ctx.fill(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(x + w / 2 - 44, by + 52); ctx.lineTo(x + w / 2 + 40, by + 52); ctx.moveTo(x + w / 2 + 10, by + 24); ctx.lineTo(x + w / 2 + 42, by + 52); ctx.lineTo(x + w / 2 + 10, by + 80); ctx.stroke(); ctx.restore();
  }
  function shot(i, x, y, w, h, t) {                                   // one masked capture (phone units)
    const k = tm(), name = SHOTS[i];
    let sc = 0;
    if (name === 'app_m_result') sc = 520 * eInOutCubic(prog(t, k.scr[3] + .35, k.scr[3] + 1.15));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    screenShot(name, x, y, w, h, sc);
    if (name === 'app_m_result') {
      // the computed customs value (« Valeur en douane » and its lines) is blurred like the other amounts of the capture
      const bx = x + 680 * SC, byy = y + (1100 - sc) * SC, bw = 420 * SC, bh = 400 * SC;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, byy, bw, bh); ctx.clip(); ctx.filter = 'blur(5px)'; screenShot(name, x, y, w, h, sc); ctx.filter = 'none';
      ctx.fillStyle = 'rgba(236,236,240,.45)'; ctx.fillRect(bx, byy, bw, bh); ctx.restore();
      // line by line: « La valeur taxée », then « Sur la déclaration (DAU) »
      [[1018, 1080, 470, 'rgba(169,71,254,.30)'], [1644, 1706, 700, 'rgba(254,86,13,.30)']].forEach(([y0, y1, x1, col], j) => {
        const q = eOutCubic(prog(t, k.scr[3] + .25 + j * .45, k.scr[3] + .5 + j * .45)); if (q <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = col; ctx.fillRect(x + 80 * SC, y + (y0 - sc) * SC, (x1 - 80) * SC * q, (y1 - y0) * SC); ctx.restore(); });
    }
  }
  function simScreens(x, y, w, h, t) {                               // captures, sliding like app pages (calm .45 s eased)
    const k = tm(); let i = 0; for (let j = 1; j < 4; j++) if (t >= k.scr[j]) i = j;
    const q = eInOutCubic(prog(t, k.scr[i], k.scr[i] + .45));
    const prev = i > 0 ? () => shot(i - 1, x - w * .3 * q, y, w, h, t) : null;
    if (q < 1 && prev) { prev(); ctx.fillStyle = `rgba(35,22,41,${.22 * q})`; ctx.fillRect(x, y, w, h); }
    const nx = x + w * (1 - q);
    if (q < 1) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = -8; ctx.fillStyle = '#fff'; ctx.fillRect(nx, y, w, h); ctx.restore(); }
    shot(i, nx, y, w, h, t);
  }
  function screen(x, y, w, h, t, n) {
    const k = tm();
    if (t < k.scr[0]) return homeScreen(x, y, w, h, t, n);
    const q = eInOutCubic(prog(t, k.scr[0], k.scr[0] + .5));        // home → simulator (slides in from the right)
    if (q < 1) { homeScreen(x - w * .3 * q, y, w, h, t, n); ctx.fillStyle = `rgba(35,22,41,${.22 * q})`; ctx.fillRect(x, y, w, h);
      const nx = x + w * (1 - q); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = -8; ctx.fillStyle = '#fff'; ctx.fillRect(nx, y, w, h); ctx.restore();
      ctx.save(); ctx.translate(nx - x, 0); shot(0, x, y, w, h, t); ctx.restore(); return; }
    simScreens(x, y, w, h, t);
  }
  // the « BIENTÔT · APERÇU » sticker (paper, slapped on the top-right corner of the phone)
  function sticker(t, n) {
    const k = tm(); if (t < k.stk - .1) return;
    const sl = slam(t, k.stk, 1.8);
    at(282, -452, .13, sl.s, sl.s, () => {
      ctx.globalAlpha *= sl.a;
      const w = 246, h = 138;
      withShadow(12, () => { ctx.fillStyle = C.orange; rrect(-w / 2, -h / 2, w, h, 26); ctx.fill(); });
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); rrect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 18); ctx.stroke(); ctx.setLineDash([]);
      text('BIENTÔT', 0, -6, { font: font(FF.body, 50, 800), align: 'center', color: '#FFFFFF', ls: 2 });
      text('APERÇU', 0, 46, { font: font(FF.body, 44, 800), align: 'center', color: '#FFF3D6', ls: 3 });
      tape(-w / 2 + 16, -h / 2 + 6, -.6, 70);
    });
  }
  // the opaque mention, taped over the bottom of the phone
  function mention(t, n) {
    const k = tm(); if (t < k.band - .05) return;
    const e = eOutBack(clamp(prog(stepT(n), k.band - .05, k.band + .2)));
    const fa = font(FF.body, 40, 800), fb = font(FF.body, 36, 700), a1 = 'Estimation', a2 = ' · à faire confirmer par un', l2 = 'commissionnaire agréé en douane';
    const w1 = measure(a1, fa) + measure(a2, fb) + 30, w2 = measure(l2, fb), bw = Math.max(w1, w2) + 72, x0 = -Math.max(w1, w2) / 2;
    at(0, BAND.y + (1 - clamp(e)) * 140, -.012, 1, 1, () => {
      ctx.globalAlpha *= clamp(e * 2);
      tornPaper(bw, BAND.h, 57, '#FFFDF7', 12);
      tape(-bw / 2 + 26, -BAND.h / 2 + 4, -.5, 84); tape(bw / 2 - 26, -BAND.h / 2 + 4, .5, 84);
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x0 + 10, -38, 11, 0, 7); ctx.fill();
      text(a1, x0 + 30, -26, { font: fa, color: C.ink });
      text(a2, x0 + 30 + measure(a1, fa), -26, { font: fb, color: C.ink });
      text(l2, x0 + (Math.max(w1, w2) - w2) / 2, 34, { font: fb, color: C.ink });
    });
  }
  function finger(t) {                                                // Junior's finger taps the suggestion « 6704.19 … mèches »
    const k = tm(); if (t < k.tap - .45 || t > k.tap + .6) return;
    const x = -PW / 2 + 250 * SC * 1.0 + 60, y = -PHH / 2 + 900 * SC;
    const inK = eOutCubic(prog(t, k.tap - .45, k.tap - .05)), outK = eInCubic(prog(t, k.tap + .25, k.tap + .6));
    const d = (1 - inK + outK);
    fingerTap(x + d * 120, y + d * 420, prog(t, k.tap - .08, k.tap + .3), { skin: SKIN[1], sleeve: C.violet });
  }

  // ---------- the phone: position / scale over S26–S27 ------------------------------------------------
  function phoneState(t) {
    const k = tm(); if (t < k.ph0 || t > k.exit1) return null;
    let x, y, s, r, a = 1;
    if (t < k.ph1) { const u = eOutCubic(prog(t, k.ph0, k.ph1)), h = juniorHand(t);
      x = lerp(h.x, P26.x, u); y = lerp(h.y, P26.y, u) - Math.sin(u * Math.PI) * 60; s = lerp(.12, P26.s, u); r = lerp(-.35, .035, u); }
    else if (t < k.push0) { x = P26.x; y = P26.y + Math.sin((t - k.ph1) * 1.3) * 4; s = P26.s; r = .035 + Math.sin(t * .9) * .006; }
    else if (t < k.exit0) { const u = eInOutCubic(prog(t, k.push0, k.push1));
      x = lerp(P26.x, P27.x, u); y = lerp(P26.y, P27.y, u); s = lerp(P26.s, P27.s, u); r = lerp(.035, -.012, u) + Math.sin(t * .8) * .004 * u; }
    else { const u = eInCubic(prog(t, k.exit0, k.exit1)), h = juniorHand(t);
      x = lerp(P27.x, h.x, u); y = lerp(P27.y, h.y + 60, u); s = lerp(1, .14, u); r = lerp(-.012, .3, u); a = 1 - clamp((u - .7) / .3); }
    return { x, y, s, r, a };
  }
  function drawPhone(t, n) {
    const st = phoneState(t); if (!st) return;
    const sh = shake(t, n);
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.globalAlpha *= st.a;
    at(st.x, st.y, st.r, st.s, st.s, () => {
      phoneFrame(PW, PHH, (x, y, w, h) => screen(x, y, w, h, t, n), { lift: 18 });
      finger(t);
      mention(t, n);
      sticker(t, n);
    });
    ctx.restore();
  }

  // ---------- S26: a few paper hearts on « réussissiez » ----------------------------------------------
  function hearts(t, n) {
    const k = tm(); if (t < k.hearts - .05 || t > k.hearts + 2.2) return;
    for (let i = 0; i < 6; i++) {
      const t0 = k.hearts + i * .13, q = (stepT(n) - t0) / 1.7; if (q <= 0 || q >= 1) continue;
      const x = 470 + (i % 3 - 1) * 62 + Math.sin(q * 5 + i) * 18, y = 860 - 400 * eOutCubic(q);
      const s = (34 + rnd(i * 5.3) * 22) * (q < .12 ? eOutBack(q / .12) : 1), a = q > .7 ? (1 - q) / .3 : 1;
      at(x, y, Math.sin(q * 4 + i) * .2, 1, 1, () => { ctx.globalAlpha *= a; withShadow(5, () => iconHeart(s, HEARTC[i % 4])); });
    }
  }

  // ---------- S27: the map of Cameroon → Africa ---------------------------------------------------------
  const AFR = [[-5.9, 35.8], [-2.2, 35.1], [1.2, 36.5], [3.1, 36.8], [6.6, 37], [9.8, 37.3], [11.1, 36.9], [10.3, 35.7], [11.1, 35.2], [10.1, 34.2], [11.5, 33.1], [13.2, 32.9], [15.3, 32.3],
    [17.5, 30.9], [19, 30.3], [20.1, 31], [20, 32.1], [21.5, 32.8], [23.2, 32.3], [25.1, 31.6], [27.3, 31.4], [29.9, 31.2], [32.3, 31.3], [32.6, 29.9], [33.6, 27.8], [35.3, 24.5],
    [36.9, 22], [37.3, 19], [38.6, 17.8], [39.7, 15.5], [41.6, 13.5], [43.3, 12.5], [43.2, 11.5], [44.6, 10.4], [47.5, 11.2], [51.2, 11.8], [51, 10.4], [50.8, 8], [49, 5.2],
    [47.4, 3.2], [45.3, 2], [43, .5], [41.6, -1.7], [40.1, -3.2], [39.2, -4.7], [39.3, -6.8], [39.6, -9.3], [40.4, -10.5], [40.6, -14.5], [39.4, -16.7], [36.9, -18], [35.3, -20],
    [35.5, -22], [35.5, -24], [32.9, -25.9], [32.6, -28], [31, -29.9], [29.2, -31.6], [27.9, -33], [25.6, -34], [22.5, -34], [20, -34.8], [18.4, -34.3], [18.2, -32.5], [17.3, -30],
    [16.5, -28.6], [15.2, -26.6], [14.5, -23], [13.2, -20], [11.8, -17.3], [12, -13.5], [13.7, -11], [13.2, -8.8], [12.3, -6.1], [11.8, -4.6], [10.3, -3], [9.3, -1.5], [9.4, .4],
    [9.6, 1.2], [9.8, 2.6], [9.7, 3.6], [9.4, 3.9], [8.9, 4.5], [7.8, 4.4], [6.7, 4.3], [5.9, 4.3], [5, 5.6], [4.4, 6.3], [2.7, 6.4], [1.2, 6.1], [-.2, 5.5], [-1.9, 4.8],
    [-3.9, 5.2], [-5.8, 5], [-7.5, 4.4], [-9.3, 5.1], [-10.8, 6.3], [-12.4, 7.3], [-13.2, 8.5], [-13.9, 9.7], [-15, 10.8], [-16.7, 12.4], [-17.2, 14], [-17.5, 14.7], [-16.9, 15.5],
    [-16.4, 16.6], [-16.1, 18], [-16.3, 19.6], [-17, 21], [-16.2, 22.6], [-15.9, 23.8], [-14.9, 24.6], [-14.3, 26], [-13.2, 27.2], [-12, 28], [-10.2, 29.2], [-9.6, 30.4],
    [-9.8, 31.3], [-8.6, 33.2], [-6.8, 34.1], [-6.2, 35.3]].map(([lo, la]) => [lo - 12.5, 6 - la]);         // same projection as geo_cmr (lon 12.5 / lat 6)
  const MAD = [[49.3, -12], [50.2, -14.4], [50.5, -15.5], [49.8, -17.2], [48.7, -20.5], [47.9, -23], [47.1, -24.9], [45.3, -25.5], [44, -25], [43.3, -22.2], [43.8, -20.8],
    [44.4, -19.5], [44.1, -17.3], [44.4, -16.2], [46.3, -15.8], [47.9, -14.5], [48.8, -13.2]].map(([lo, la]) => [lo - 12.5, 6 - la]);
  const CC = [(CARD.sx0 + CARD.sx1) / 2, (CARD.sy0 + CARD.sy1) / 2];                  // centre of the sea window (card units)
  const G0 = [-CC[0] / 9.6, -CC[1] / 9.6], G1 = [4.35, 4.75], K0 = 9.6, K1 = 1.83;       // view: geo centre + scale (units / degree)
  function hexMix(a, b, q) { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], q))).join(',')})`; }
  /** the pinned map card (wall units). z 0 = Cameroon framing (as on the wall), 1 = Africa framing; lit 0..1 = Cameroon violet; afr 0..1 = Africa shown */
  function mapCard(zq, lit, afr, t) {
    const g = geo(); if (!g) return;
    const kk = Math.exp(lerp(Math.log(K0), Math.log(K1), zq)), gc = [lerp(G0[0], G1[0], zq), lerp(G0[1], G1[1], zq)];
    const P = ([x, y]) => [CC[0] + (x - gc[0]) * kk, CC[1] + (y - gc[1]) * kk];
    const path = rings => { ctx.beginPath(); for (const r of rings) { r.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); } };
    withShadow(5, () => { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h); });
    ctx.save(); rrect(CARD.sx0, CARD.sy0, CARD.sx1 - CARD.sx0, CARD.sy1 - CARD.sy0, 18); ctx.fillStyle = '#DCEAF1'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = `rgba(11,95,165,${.12 * (1 - clamp(zq * 3))})`; ctx.lineWidth = 2;
    if (zq < .34) for (let i = 0; i < 7; i++) { ctx.beginPath(); for (let x = -7.2; x <= -2.5; x += .1) { const q = P([x, 2.2 + i * .55 + Math.sin(x * 4 + i) * .06]); x === -7.2 ? ctx.moveTo(...q) : ctx.lineTo(...q); } ctx.stroke(); }
    if (afr > 0) {                                                    // Africa: a gentle paper outline bathed in amber
      ctx.save(); ctx.globalAlpha *= afr;
      path([AFR, MAD]); ctx.save(); ctx.shadowColor = 'rgba(243,167,69,.75)'; ctx.shadowBlur = 26; ctx.fillStyle = '#FBEBCD'; ctx.fill(); ctx.restore();
      ctx.save(); path([AFR, MAD]); ctx.clip(); const rg = ctx.createRadialGradient(...P([4, 4]), 2, ...P([4, 4]), 90);
      rg.addColorStop(0, 'rgba(243,167,69,.35)'); rg.addColorStop(1, 'rgba(243,167,69,.05)'); ctx.fillStyle = rg; ctx.fillRect(CARD.sx0, CARD.sy0, CARD.sx1 - CARD.sx0, CARD.sy1 - CARD.sy0); ctx.restore();
      path([AFR, MAD]); ctx.strokeStyle = '#D98A1E'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    const fill = lit > 0 ? hexMix('#CFE6DA', '#A947FE', lit) : '#CFE6DA';
    ctx.save(); ctx.shadowColor = lit > 0 ? `rgba(169,71,254,${.7 * lit})` : 'rgba(60,32,12,.26)'; ctx.shadowBlur = lit > 0 ? 8 + 22 * lit : 11; ctx.shadowOffsetX = lit > 0 ? 0 : 7; ctx.shadowOffsetY = lit > 0 ? 0 : 13;
    path(g.CMR.rings); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
    path(g.CMR.rings); ctx.strokeStyle = lit > 0 ? hexMix('#0E6B4E', '#7B22D6', lit) : DC.green; ctx.lineWidth = lerp(4, 1.6, zq); ctx.stroke();
    ctx.restore();
    const d = P([-2.785, 1.95]); ctx.fillStyle = lit > .5 ? '#FFFFFF' : C.violetD; ctx.beginPath(); ctx.arc(d[0], d[1], lerp(7, 2.4, zq), 0, 7); ctx.fill();
    if (lit > 0 && t != null) { const k = tm(), w = prog(t, k.lit, k.lit + .7); if (w > 0 && w < 1) {           // one light ring when it lights up
      ctx.save(); ctx.globalAlpha *= 1 - w; const c = P([.2, -1.4]); ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c[0], c[1], 40 + 60 * w, 0, 7); ctx.stroke(); ctx.restore(); } }
  }
  function mapState(t) {
    const k = tm(); if (t < k.m0 || t > k.r1) return null;
    const c = camAt(t), b = camBreath(t), m = mapW(), w = worldToScreen(m.x, m.y, t), wall = { x: w.x, y: w.y, s: c.z, r: c.r + b.r + m.r };
    let u = t < k.r0 ? eInOutCubic(prog(t, k.m0, k.m1)) : 1 - eInOutCubic(prog(t, k.r0, k.r1));
    const x = lerp(wall.x, MDISP.x, u), y = lerp(wall.y, MDISP.y, u) - Math.sin(u * Math.PI) * 30 * (t < k.r0 ? 1 : -1), s = lerp(wall.s, MDISP.s, u), r = lerp(wall.r, -.015, u);
    const back = t >= k.r0 ? eInOutCubic(prog(t, k.r0, k.r1 - .15)) : 0;
    const lit = eOutCubic(prog(t, k.lit, k.lit + .45)) * (1 - back), zq = eInOutCubic(prog(t, k.z0, k.z1)) * (1 - back), afr = eInOutCubic(prog(t, k.z0 + .2, k.z1 + .1)) * (1 - back);
    return { x, y, s, r, lit, zq, afr };
  }
  function mapStrip(label, y, k, fill, col, seed, taped = true) {
    if (k <= 0) return; const f = font(FF.body, 50, 800), w = measure(label, f, 2) + 80, h = 84;
    at(540 + (1 - eOutCubic(k)) * -700, y, (seed % 2 ? .012 : -.015), 1, 1, () => {
      tornPaper(w, h, seed, fill, 10); if (taped) { tape(-w / 2 + 20, -h / 2 + 4, -.5, 80); tape(w / 2 - 20, -h / 2 + 4, .5, 80); }
      text(label, 0, 18, { font: f, align: 'center', color: col, ls: 2 });
    });
  }
  function drawMap(t, n) {
    const st = mapState(t); if (!st) return; const k = tm();
    at(st.x, st.y, st.r, st.s, st.s, () => mapCard(st.zq, st.lit, st.afr, t));
    const out = 1 - eInCubic(prog(t, k.r0 - .3, k.r0 + .05));
    if (out <= 0) return;
    ctx.save(); ctx.globalAlpha *= out;
    mapStrip("D'ABORD LE CAMEROUN", 286, prog(t, k.l1, k.l1 + .45), C.violetD, '#FFFFFF', 7, false);   // no tape: stays clear of the series chip
    mapStrip('ENSUITE, NOTRE AMBITION', 752, prog(t, k.l2, k.l2 + .5), '#FFF1D6', C.ink, 12);
    ctx.restore();
  }
  // world: while the map is off the wall, the wall shows its pin and a paler rectangle (34_mboppi keeps drawing the map)
  function wallPatch(t) {
    const k = tm(); if (t < k.m0 || t >= k.r1) return;
    const m = mapW(), x0 = m.x - 93, x1 = Math.min(m.x + 103, 8058), y0 = m.y - 110, y1 = m.y + 118;   // same paper as 34's wall (planks every 104 from 7830)
    ctx.fillStyle = '#D9BF94'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.save(); ctx.globalAlpha *= .55; ctx.fillStyle = TEX.kraft; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
    ctx.strokeStyle = 'rgba(120,80,40,.18)'; ctx.lineWidth = 3; for (let x = 7934; x < x1; x += 104) { if (x <= x0) continue; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    at(m.x, m.y, m.r, 1, 1, () => {
      ctx.fillStyle = 'rgba(255,246,228,.22)'; ctx.fillRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h);
      ctx.fillStyle = DC.red; ctx.beginPath(); ctx.arc(0, -80, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-3, -83, 3, 0, 7); ctx.fill();
    });
  }

  const inWin = t => TLD && t > ss('S26', -1.5) && t < se('S27', 2.5);
  registerScene({ id: 'F50_wall', z: 23, draw(t, n) { if (!inWin(t)) return; tm(); const m = mapW(); if (!inView(m.x, m.y, 160, t)) return; ctx.save(); worldBegin(t); wallPatch(t); ctx.restore(); } });
  registerScene({ id: 'F50_bubble', z: 45, draw(t, n) { if (!inWin(t)) return; thought(t, n); } });
  registerScene({ id: 'F50_hearts', z: 49, draw(t, n) { if (!inWin(t)) return; hearts(t, n); } });
  registerScene({ id: 'F50_phone', z: 48, draw(t, n) { if (!inWin(t)) return; drawPhone(t, n); } });
  registerScene({ id: 'F50_map', z: 50, draw(t, n) { if (!inWin(t)) return; drawMap(t, n); } });
})();
