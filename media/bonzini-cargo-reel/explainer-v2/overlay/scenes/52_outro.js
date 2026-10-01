'use strict';
// =============================================================================================
// 52_outro — OUTRO — package E (prefix ot_) — final_storyboard §3 OUTRO, §2.3 T9 (outro side), §2.4, §2.5, §6.
// Q6  « Et nous vous disons merci pour votre confiance. »   (the team's real voice, A 18.64 → 23.2 in sync)
// V11 « Bonzini Trading Cargo. Vos colis, en toute sécurité. »
// One idea: the team says thank you, for real; Bonzini Trading Cargo — your parcels, safe.
//   ot_back  z 20: P7 (the synced print at HP_PRINT_OUTRO; tossed onto the table as the whip lands, slides away on
//                  « Bonzini »), and the end-card thread (hero knot → round the brand tag's left end → its grommet).
//   ot_front z 50: the strip « Vos colis, en toute sécurité » + highlighter, the knot, the button tape on the lid.
//   ot_tags  z 60: the MERCI tag (tied to the hero's knot: swings down around it and slaps flat) + its string, the
//                  brand tag (swings in on the thread) + the thread's last inch through its grommet.
//   T9: the outro rises with the same curve the recap leaves with (rc_whipK) — one rigid camera pan.
//   End card: a slow 3 % push-in, then a 166 px settle down once the captions are hidden (layers, hero, thread), so the
//   whole group (brand tag → hero) ends centred near y 960 instead of hanging in the top two-thirds.
// Every time is anchored on words / segment ends / the T9 window; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  // P7 framing: zoom 1.25 anchored left (fx .35 → frame x 0–0.80) keeps the person standing among the goods at the right
  // edge (A ≈ 19.95–21.0, frame x ≥ 0.83) out of the print for the whole clip.
  const PR = HP_PRINT_OUTRO, FR = { fx: .35, fy: .55, zoom: 1.25 };
  const HERO_O = { x: 842, y: 1108, s: .5 };                   // Q6: bottom right, over the print's corner (x 702–982)
  const HERO_E = { x: 540, y: 1110, s: .6 };                   // end card
  const MER = { x: 378, y: 1088, r: -.04 };                    // MERCI tag rest (x 60–696, y 963–1213: clear of the captions)
  const BRAND = { x: 540, y: 560, r: -.012, w: 800, h: 400 };  // y 360–760
  const STRIP = { x: 540, y: 852, r: -.015 };
  const CAM = [540, 820], PAN = 166, PAN_D = .6;              // end-card push-in centre; settle (px, s) once the captions hide
  const L2 = 'pour votre confiance', STR = 'Vos colis, en toute sécurité', HL = 'sécurité';
  const grid = x => Math.ceil(x * 15 - 1e-6) / 15;
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- anchors (lazy)
  let _T = null, _TL = null;
  function ot_T() {
    if (_T && _TL === TLD) return _T;
    const T = { end: TL.ch('outro').end };
    [T.w0, T.w1] = window.rc_whip();                                            // T9 [117.76 → 118.16]
    const q6 = TL.seg('Q6'); T.q6s = q6.start; T.q6e = q6.end;                  // [118.10 → 122.66]
    T.merci = W_('Q6', 'merci');                                                // [119.10]
    T.mIn = grid(T.merci - .12); T.mHit = T.mIn + .3;                           // O2 swing → slap [119.27]
    T.bz = W_('V11', 'Bonzini'); T.mv = .54;                                    // O4 [123.11]
    T.bLand = T.bz + .62;                                                       // brand tag settles [123.73]
    T.vos = W_('V11', 'Vos'); T.sec = W_('V11', 'sécurité');                    // O5 [124.51] [125.67]
    T.v11e = TL.seg('V11').end; T.taut = T.v11e + .8;                           // O6 [126.21], O7 [127.01]
    T.button = T.end - .5;                                                      // O8 [129.5]
    T.cam0 = T.bz + .7;
    hp_hold('outro MERCI', T.mHit, T.bz); hp_hold('outro strip', T.vos, T.end); hp_hold('outro brand tag', T.bLand, T.end);
    _TL = TLD; return (_T = T);
  }
  /** end-card camera: push 1 → 1.03 about CAM from cam0, settle down PAN px over PAN_D from V11·end (captions hidden),
   *  done before O7's twang (v11e + .8) so the pluck reads on a still frame */
  function ot_cam(t, T) { return { z: 1 + .03 * eInOutCubic(prog(t, T.cam0, T.end)), py: PAN * eInOutCubic(prog(t, T.v11e, T.v11e + PAN_D)) }; }
  function ot_camPt(p, c) { return [CAM[0] + (p[0] - CAM[0]) * c.z, CAM[1] + (p[1] - CAM[1]) * c.z + c.py]; }
  function ot_camApply(c) { ctx.translate(CAM[0], CAM[1] + c.py); ctx.scale(c.z, c.z); ctx.translate(-CAM[0], -CAM[1]); }
  /** T9: the outro rises with the recap's own curve (one rigid pan) */
  const ot_whipDy = (t, T) => (t < T.w1 ? 1920 * (1 - window.rc_whipK(t)) : 0);

  // ---------------------------------------------------------------- P7 — the team's « merci », synced
  function ot_printRect(t, T) {
    const d = drift(t, 117, 3), u = Math.max(0, t - T.w0), k = eOutCubic(prog(t, T.w0 + .1, T.w1 + .08));
    // tossed onto the table as the pan lands: slides down into place, rotation settles on a spring, lift 40 → 12
    let R = Object.assign({}, PR, { x: PR.x + d.x, y: PR.y + d.y - 90 * (1 - k), rot: PR.rot + d.r - .15 * (1 - spring(u * .9, 14, .45)),
      lift: lerp(40, 12, k), tape: t >= T.w1 + .08 + 2 / 30 });
    R.y += ot_whipDy(t, T);
    if (t >= T.bz) { const o = hp_out(t, T.bz, R, 'left', .42); R = Object.assign({}, o); }
    return R;
  }
  function ot_drawPrint(t, n, T) {
    if (t < T.w0 || t > T.bz + .45) return;
    hp_sfx('card_deal', T.w0 + .1);
    const R = ot_printRect(t, T), src = hp_map(stepT(n), [[T.q6s, 18.64], [T.q6e, 23.2], [T.bz + .45, 23.6]]);
    hp_printAt(R, 'A', src, { fx: FR.fx, fy: FR.fy, zoom: FR.zoom, lift: R.lift, tape: R.tape, curl: .3 });
    const lk = prog(t, T.w1 - .04, T.w1 + .6);                                         // a warm leak across the print as it lands
    if (lk > 0 && lk < 1) { ctx.save(); ctx.translate(R.x, R.y); ctx.rotate(R.rot || 0); ctx.beginPath(); ctx.rect(-R.w / 2 - 18, -R.h / 2 - 18, R.w + 36, R.h + 36); ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= .7; lightLeak(lk, 7); ctx.restore(); }
  }

  // ---------------------------------------------------------------- the MERCI tag (grommet on the RIGHT: its string runs to the hero)
  let _mg = null;
  function ot_merciGeo() {
    if (_mg) return _mg;
    const fM = font(FF.stencil, 150, 900), f2 = font(FF.body, 48, 800), tw_ = Math.max(measure('MERCI', fM, 6), measure(L2, f2));
    const w = Math.round(Math.max(600, tw_ + 160)), h = 250;
    return (_mg = { fM, f2, w, h, gx: w / 2 - 30 });
  }
  /** tied to the hero's knot: swings down around it (in the table plane) and slaps flat; slides off on « Bonzini » */
  function ot_merciPose(t, T) {
    const ts = tw(t); if (ts < T.mIn) return null;
    const K = [HERO_O.x + HP_HERO.knot[0] * HERO_O.s, HERO_O.y + HP_HERO.knot[1] * HERO_O.s];
    const u = ts - T.mIn, d = drift(t, 131, 1.6);
    let th = 0, s = 1, lift = 10;
    if (u < .3) { const k = eInCubic(clamp(u / .3)); th = 1.35 * (1 - k); s = lerp(1.06, 1, k); lift = lerp(44, 12, k); }
    else { const v = u - .3; s = 1 - Math.exp(-v * 14) * Math.cos(v * 40) * .025; }
    const vx = MER.x - K[0], vy = MER.y - K[1], c = Math.cos(th), sn = Math.sin(th);
    let x = K[0] + vx * c - vy * sn + d.x, y = K[1] + vx * sn + vy * c + d.y, r = MER.r + th + d.r;
    if (t >= T.bz) { const k = prog(t, T.bz, T.bz + .44), e = k * k * (1.4 - .4 * k); x -= 1150 * e; y += 70 * e; r -= .16 * eOutCubic(k); lift += 22 * eOutCubic(clamp(k * 3)); }
    return { x, y, r, s, lift, gone: t >= T.bz + .44 };
  }
  function ot_merciGrommet(P) { const g = ot_merciGeo(); return [P.x + g.gx * P.s * Math.cos(P.r), P.y + g.gx * P.s * Math.sin(P.r)]; }
  function ot_merciTag(P) {
    const g = ot_merciGeo(), w = g.w, h = g.h, x0 = -w / 2, y0 = -h / 2;
    at(P.x, P.y, P.r, P.s, P.s, () => {
      ctx.save(); ctx.scale(-1, 1);                                     // mirrored body: clipped corners on the right
      withShadow(P.lift, () => { f1_tagPath(x0, y0, w, h, 50, 12); ctx.fillStyle = C.kraftD; ctx.fill(); });
      f1_tagPath(x0, y0, w, h, 50, 12); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
      f1_tagPath(x0 + 7, y0 + 7, w - 14, h - 14, 46, 8); ctx.fillStyle = C.cream; ctx.fill();
      ctx.save(); f1_tagPath(x0 + 7, y0 + 7, w - 14, h - 14, 46, 8); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(x0, y0, w, h);
      const lg = ctx.createLinearGradient(0, y0, 0, y0 + h); lg.addColorStop(0, 'rgba(255,255,255,.2)'); lg.addColorStop(1, 'rgba(150,110,60,.08)'); ctx.fillStyle = lg; ctx.fillRect(x0, y0, w, h);
      ctx.restore(); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(90,60,30,.40)'; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(g.gx - 34, y0 + 30); ctx.lineTo(g.gx - 34, y0 + h - 30); ctx.stroke(); ctx.restore();
      f1_grommet(g.gx, 0, 14, 6);
      const cx = (x0 + 14 + g.gx - 34) / 2;
      text('MERCI', cx, 26, { font: g.fM, color: C.violetD, align: 'center', ls: 6 });
      text(L2, cx, 96, { font: g.f2, color: C.ink, align: 'center' });
    });
  }
  /** the MERCI string: grommet → hero knot (drawn above the hero), released on « Bonzini » */
  function ot_merciString(t, n, T, P) {
    const G = ot_merciGrommet(P), K = hp_knot(t), rel = eOutCubic(prog(t, T.bz, T.bz + .22));
    const E = [lerp(K[0], G[0] + 70, rel), lerp(K[1], G[1] - 40, rel)];
    const L = Math.hypot(E[0] - G[0], E[1] - G[1]), pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, off = Math.min(26, L * .12) * 4 * u * (1 - u); pts.push([lerp(G[0], E[0], u) + off * .25, lerp(G[1], E[1], u) + off]); }
    ctx.save(); ctx.globalAlpha *= 1 - prog(t, T.bz + .2, T.bz + .4); thread(pts, 1, n, { w: 5 }); ctx.restore();
    ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(G[0], G[1], 5, 0, 7); ctx.fill();
    if (rel < .02) { const h = hp_pose(t); at(h.x, h.y, h.r, h.s * h.sx, h.s * h.sy, () => f1_knotMark(1)); }
  }

  // ---------------------------------------------------------------- the brand tag (end card): swings in on the thread
  /** pose in end-card layer space (before ot_cam) */
  function ot_brandPose(t, T) {
    const ts = tw(t); if (ts < T.bz) return null;
    const u = ts - T.bz, Lp = 1700, d = drift(t, 141, 2);
    let x, y, r, s, lift;
    if (u < .62) {
      const th0 = -.6 * (1 - spring(.5, 9, .35)), settle = clamp((u - .5) / .12);
      const th = u < .5 ? -.6 * (1 - spring(Math.max(0, u), 9, .35)) : th0 * (1 - eOutCubic(settle));
      x = BRAND.x + d.x * settle - Lp * Math.sin(th) * (th > 0 ? .5 : 1); y = BRAND.y + d.y * settle - Lp * (1 - Math.cos(th));
      r = BRAND.r + th * .75; s = u < .5 ? 1.04 : lerp(1.04, 1, eInCubic(settle)); lift = u < .5 ? 40 : lerp(40, 10, eInCubic(settle));
    } else { const v = u - .62; x = BRAND.x + d.x; y = BRAND.y + d.y; r = BRAND.r + d.r; s = 1 - Math.exp(-v * 14) * Math.cos(v * 40) * .02; lift = 10; }
    const kt = prog(t, T.taut, T.taut + .3); y -= 9 * (kt >= 1 ? 1 : eOutBack(kt, 2.2));          // O7: pulled taut
    const kb = ts - T.button; if (kb >= 0 && kb < .5) s *= 1 + .012 * Math.exp(-kb * 9) * Math.sin(kb * 30);   // button bump
    return { x, y, r, s, lift };
  }
  /** tag-local point → end-card layer space */
  function ot_brandPt(P, lx, ly) { const c = Math.cos(P.r), s = Math.sin(P.r); return [P.x + (lx * c - ly * s) * P.s, P.y + (lx * s + ly * c) * P.s]; }
  const BG = [-BRAND.w / 2 + 32, 0];                            // the brand tag's grommet (hp_brandTag)
  /** end-card thread, screen space: hero knot → under the strip → round the tag's left end → into its grommet */
  function ot_endThread(t, T, P, c) {
    const K = hp_knot(t), G = ot_camPt(ot_brandPt(P, BG[0], BG[1]), c), B = ot_camPt(ot_brandPt(P, BG[0] - 62, 24), c), A = ot_camPt(ot_brandPt(P, BG[0] - 92, 226), c);
    const ts = tw(t), slack = 1 - .85 * (prog(t, T.taut, T.taut + .25) >= 1 ? 1 : eOutBack(prog(t, T.taut, T.taut + .25), 1.6));
    const M = [lerp(K[0], A[0], .5) - 40 * slack, lerp(K[1], A[1], .5) + 40 * slack];
    const A2 = [A[0] - 14 * slack, A[1] + 14 * slack];
    const pts = curve([K, M, A2, B, G], 12), N = pts.length - 1, a = ts - T.taut;
    if (a >= 0 && a < 1) {                                                         // the twang runs along it
      for (let i = 1; i < N; i++) { const u = i / N, p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
        const off = 13 * Math.sin(Math.PI * u) * Math.exp(-a * 5) * Math.sin(a * 38 - u * 6); p[0] += -dy / L * off; p[1] += dx / L * off; }
    }
    return { pts, B, G };
  }

  // ---------------------------------------------------------------- the strip « Vos colis, en toute sécurité »
  let _sg = null;
  function ot_stripGeo() {
    if (_sg) return _sg;
    const f = font(FF.body, 54, 800), tw_ = measure(STR, f), w = Math.round(tw_ + 110), h = 118;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 151, 3, 12), right = tornLine(w / 2, -h / 2, w / 2, h / 2, 157, 1.4, 14),
      bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 163, 3, 12), left = tornLine(-w / 2, h / 2, -w / 2, -h / 2, 167, 1.4, 14);
    const pre = measure(STR.slice(0, STR.length - HL.length), f), hw = measure(HL, f);
    return (_sg = { f, tw: tw_, w, h, pts: [...top, ...right, ...bot, ...left], hx: -tw_ / 2 + pre, hw });
  }
  function ot_strip(t, T) {
    const ts = tw(t); if (ts < T.vos) return;
    const g = ot_stripGeo(), u = ts - T.vos, d = drift(t, 151, 1.5);
    let s = 1, lift = 8, a = 1;
    if (u < .2) { const k = eInCubic(clamp(u / .2)); s = lerp(1.12, 1, k); lift = lerp(38, 8, k); a = clamp(.35 + u / .07); }
    else { const v = u - .2; s = 1 - Math.exp(-v * 13) * Math.cos(v * 40) * .022; }
    const path = () => { ctx.beginPath(); ctx.moveTo(...g.pts[0]); for (const p of g.pts) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.globalAlpha *= a;
    at(STRIP.x + d.x, STRIP.y + d.y, STRIP.r + d.r, s, s, () => {
      withShadow(lift, () => { path(); ctx.fillStyle = C.cream; ctx.fill(); });
      ctx.save(); path(); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-g.w / 2 - 8, -g.h / 2 - 8, g.w + 16, g.h + 16);
      const lg = ctx.createLinearGradient(0, -g.h / 2, 0, g.h / 2); lg.addColorStop(0, 'rgba(255,255,255,.18)'); lg.addColorStop(1, 'rgba(150,110,60,.08)'); ctx.fillStyle = lg; ctx.fillRect(-g.w / 2 - 8, -g.h / 2 - 8, g.w + 16, g.h + 16);
      ctx.restore();
      const hk = eOutCubic(prog(t, T.sec, T.sec + .26));                             // O5: highlighter swipe on « sécurité »
      if (hk > 0) { ctx.save(); ctx.fillStyle = 'rgba(169,71,254,.30)'; ctx.beginPath(); const x0 = g.hx - 10, y0 = 20 - 46, w = (g.hw + 20) * hk, hh = 56;
        ctx.moveTo(x0, y0 + 4); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w - 3, y0 + hh); ctx.lineTo(x0 + 2, y0 + hh + 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
      text(STR, -g.tw / 2, 20, { font: g.f, color: C.ink });
      ctx.fillStyle = C.tape; at(-g.w / 2 + 14, -g.h / 2 + 6, -.6, 1, 1, () => ctx.fillRect(-46, -16, 92, 32)); at(g.w / 2 - 14, g.h / 2 - 6, -.6, 1, 1, () => ctx.fillRect(-46, -16, 92, 32));
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- O8: the button — a short violet tape pressed across the lid's corner
  function ot_button(t, T) {
    const ts = tw(t); if (ts < T.button) return;
    const k = prog(ts, T.button, T.button + .2), press = lerp(1.25, 1, eOutCubic(prog(ts, T.button, T.button + .14))), p = hp_pose(t);
    at(p.x, p.y, p.r, p.s * p.sx, p.s * p.sy, () => at(268, 200, -.78, press, press, () => {
      withShadow(2 + 18 * (1 - k), () => f1_violetTape(0, -52, lerp(-40, 54, eOutCubic(k)), 58, 23));
    }));
  }

  // ---------------------------------------------------------------- hero registrations (§2.4)
  hp_keys('outro', () => {
    const T = ot_T();
    return [{ t: T.w0, x: HERO_O.x, y: HERO_O.y, s: HERO_O.s, r: .03, lift: 6, ease: 'step' },          // rises with the outro [117.76]
      { t: T.bz },
      { t: T.bz + T.mv, x: HERO_E.x, y: HERO_E.y, s: HERO_E.s, r: -.02, ease: 'io', twos: true }];      // O4 → centre [123.65]
  });
  hp_states('outro', t => {
    const T = ot_T(); if (t < T.w0) return {};
    const ts = tw(t), o = { visible: true, dx: 0, dy: ot_whipDy(t, T), dr: 0, lift: 0, sxMul: 1, syMul: 1 };
    const k = (ts - T.bz) / T.mv;
    if (k >= 0 && k < 1) { o.dy = -86 * Math.sin(Math.PI * k); o.lift = 30 * Math.sin(Math.PI * k); o.dr = -.06 * Math.sin(Math.PI * k); }
    const u = ts - T.bz - T.mv; if (u >= 0 && u < .5) { const q = .05 * Math.exp(-u * 11) * Math.cos(u * 38); o.sxMul = 1 + q; o.syMul = 1 - q * .8; }
    const c = ot_cam(t, T); if (t >= T.cam0) { o.dx = (HERO_E.x - CAM[0]) * (c.z - 1); o.dy += (HERO_E.y - CAM[1]) * (c.z - 1) + c.py; o.sxMul *= c.z; o.syMul *= c.z; }
    return o;
  });
  hp_mood('outro', () => {
    const T = ot_T();
    return [{ kind: 'peek', t0: grid(T.w1 + .08), dir: [-1, -.9], hold: .25 },     // O1 looks at the print
      { kind: 'nod', t0: grid(T.mHit + .06) },                                     // O2 « merci »
      { kind: 'nod', t0: grid(T.button) }];                                        // O8 button
  });
  // §2.5 outro: hero knot → MERCI tag → brand tag. Both strings are drawn here (they must run above the hero and round
  // the brand tag's left end), so the generic lead thread stays off.
  hp_leadEnd('outro', () => false);
  hp_badgeEarliest('Q6', () => window.rc_whip()[1]);                                // §1.6: Q6 badge pops at the whip end
  hp_badgePos('outro', 380, 270);

  // ---------------------------------------------------------------- sound (§6)
  function ot_cues(T) {
    hp_sfx('paper_slap', T.mHit); hp_sfx('string_pluck', T.mHit + .12);
    hp_sfx('whoosh_soft', T.bz + .04); hp_sfx('paper_slap', T.bz + .5); hp_sfx('thup_soft', T.bz + T.mv + .02);
    hp_sfx('paper_slap_light', T.vos + .2); hp_sfx('highlighter_swipe', T.sec); hp_sfx('string_pluck', T.taut);
    hp_sfx('tape_press', T.button); hp_sfx('cardboard_thud_soft', T.button + .14);
  }

  // ---------------------------------------------------------------- scenes
  const live = t => t >= TL.ch('outro').start - .3;
  registerScene({
    id: 'ot_back', z: 20, when: live,
    draw(t, n) {
      const T = ot_T(); ot_cues(T); if (t < T.w0) return;
      ot_drawPrint(t, n, T);
      const P = ot_brandPose(t, T);
      if (P) { const E = ot_endThread(t, T, P, ot_cam(t, T)); ctx.save(); ctx.globalAlpha *= .92; thread(E.pts, 1, n, { w: 6 }); ctx.restore(); }
    },
  });
  registerScene({
    id: 'ot_front', z: 50, when: live,
    draw(t, n) {
      const T = ot_T(); if (t < T.w0) return;
      const c = ot_cam(t, T);
      if (t >= T.bz + .22) { const h = hp_pose(t); at(h.x, h.y, h.r, h.s * h.sx, h.s * h.sy, () => f1_knotMark(1)); }   // the end-card thread's knot
      ctx.save(); ctx.translate(0, ot_whipDy(t, T)); ot_camApply(c);
      ot_strip(t, T);
      ctx.restore();
      ot_button(t, T);                                             // hero-local (the hero pose already carries the camera)
    },
  });
  registerScene({
    id: 'ot_tags', z: 60, when: live,
    draw(t, n) {
      const T = ot_T(); if (t < T.w0) return;
      const M = ot_merciPose(t, T);
      if (M && !M.gone) { ot_merciTag(M); ot_merciString(t, n, T, M); }
      const B = ot_brandPose(t, T);
      if (B) {
        const c = ot_cam(t, T);
        ctx.save(); ot_camApply(c); hp_brandTag(B.x, B.y, B.s, B.r, 1, { w: BRAND.w, h: BRAND.h, footer: true, lift: B.lift }); ctx.restore();
        const E = ot_endThread(t, T, B, c), pts = [];                              // its last inch runs over the tag into the hole
        for (let i = 0; i <= 6; i++) pts.push([lerp(E.B[0], E.G[0], i / 6), lerp(E.B[1], E.G[1], i / 6)]);
        ctx.save(); ctx.globalAlpha *= .92; thread(pts, 1, n, { w: 6 }); ctx.restore();
        ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.ellipse(E.G[0], E.G[1], 8, 7, 0, 0, 7); ctx.fill();
      }
    },
  });
})();
