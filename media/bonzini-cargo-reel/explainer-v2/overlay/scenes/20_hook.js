'use strict';
// =============================================================================================
// 20_hook — HOOK · V01 « Vous achetez vos marchandises en Chine ? Découvrez comment elles arrivent jusqu’à vous,
// étape par étape. » (final_storyboard §3 HOOK H1–H8, §2.4 hero track, §6 SFX). Package A, prefix hk_.
// One idea: this carton is yours, and we will follow it.
//   H1 cold open: the hero falls from above the lens (s 2.4 → 1), lands at +0.30 (squash, flakes, shake 12),
//      then a slow camera-like push-in (s 1 → 1.06) until « Découvrez »; a second one (1.06 → 1.11) after the hop
//   H2 shiver (±6 px, on twos) on « achetez » / « marchandises » · H3 « CHINE » stamped on « Chine » (shake 6)
//   H4 the blank teaser prints are nudged out from under the carton from « Chine » + 0.4 (three shoves), then
//      dealt on « Découvrez » (B 4.4 · A 23.4 · B 11.0 @0.7), develop, light leak
//   H5 prints flicked out on « jusqu’à » · H6 « VOUS » written on « vous » + small hop (peak 1.06)
//   H7 lead thread + stepper birth (automatic, 11_hero / 12_stepper) · H8 hold, slow camera creep
// Hero data only REGISTERED here (11_hero.js draws it). Times are word-anchored (no hard-coded seconds).
// =============================================================================================
(() => {
  const V = (w, k = 0) => W_('V01', w, k);
  const T0 = () => TL.ch('hook').start;
  const tLand = () => T0() + .30;                        // H1 « frame 0 → 0.30 »
  const tChine = () => V('Chine') + .04;                  // H3 hit (chineK = .3)
  const tVous = () => V('vous', 1);                       // H6 write-on start (0.35 s)
  const tHop = () => tVous() + .36;                       // H6 hop right after the last stroke
  const tDeal = i => V('Découvrez') + .12 * i;            // H4 deals, 0.12 s apart
  const DEAL = .38;                                       // deal flight (on twos)
  const tFlick = i => V('jusqu’à') + .04 * i;             // H5 flick out (0.3 s)

  // ---------------------------------------------------------------- hero track (§2.4)
  // Two slow camera-like push-ins on the hero (eInOutCubic, about its centre, rising a touch toward the frame centre):
  //   landing → V01·Découvrez  s 1 → 1.06  ·  after the hop / stepper birth → V02·Suivez  s 1.06 → 1.11
  const PUSH1 = { y: 972, s: 1.06, r: -.026 }, PUSH2 = { y: 952, s: 1.11, r: -.02 };
  hp_keys('hook', () => {
    const tl = tLand();
    return [
      { t: T0(), x: 432, y: 1014, s: 2.4, r: -.12, lift: 90 },               // frame 0: label band big & readable
      { t: tl, x: 540, y: 1000, s: 1.0, r: -.02, lift: 6, ease: 'in' },      // falls from above the lens (eInCubic)
      { t: V('Découvrez'), ...PUSH1, ease: 'io' },                            // push-in #1 (0.30 → 3.78)
      { t: tHop() + .45 },                                                     // prints, VOUS, hop, stepper birth
      { t: W_('V02', 'Suivez'), ...PUSH2, ease: 'io' },                       // push-in #2 (H8 hold → brand slide)
    ];
  });
  hp_states('hook', t => {
    const o = { chineK: prog(t, tChine() - .12, tChine() + .28), vousK: prog(t, tVous(), tVous() + .35) };
    // H1 landing squash: 2 frames held, then a damped rebound (on twos)
    const u = f1_twos(t) - tLand();
    if (u >= 0 && u < .6) {
      const v = Math.max(0, u - 2 / 30), q = .065 * Math.exp(-v * 9) * Math.cos(v * 26);
      o.sxMul = 1 + q; o.syMul = 1 - q * 1.1;
    }
    // H6 small hop (peak ×1.06 on top of the push — smaller than the generic `hop`), on twos
    const h = f1_twos(t) - tHop();
    if (h >= 0 && h < .62) {
      let s = 1, lift = 0, dy = 0, sx = 1, sy = 1;
      if (h < .07) { const k = eOutCubic(h / .07); sx = 1 + .02 * k; sy = 1 - .035 * k; }
      else if (h < .25) { const k = eOutCubic((h - .07) / .18); s = lerp(1, 1.06, k); lift = 24 * k; dy = -14 * k; }
      else if (h < .40) { const k = eInCubic((h - .25) / .15); s = lerp(1.06, 1, k); lift = 24 * (1 - k); dy = -14 * (1 - k); }
      else { const v = h - .40, q = .035 * Math.exp(-v * 12) * Math.cos(v * 34); sx = 1 + q; sy = 1 - q; }
      o.sxMul = s * sx; o.syMul = s * sy; o.lift = lift; o.dy = dy;
    }
    // H2 shiver (the goods settle inside): ±6 px + a rattle of rotation and squash, on twos, 10 frames, decaying
    for (const [t0, seed] of [[V('achetez'), 11], [V('marchandises') + .12, 29]]) {
      const u = f1_twos(t) - t0; if (u < 0 || u >= 10 / 30) continue;
      const f = Math.round(u * 15), sg = f % 2 ? 1 : -1, dec = 1 - .35 * u / (10 / 30), q = (rnd(seed + f * 7.7) - .5) * .012 * dec;
      o.dx = sg * (4.5 + 1.5 * rnd(seed + f * 3.1)) * dec; o.dy = (rnd(seed + f * 5.3) - .5) * 11 * dec;   // back-and-forth, ±6 px
      o.dr = sg * (.003 + .004 * rnd(seed + f * 2.3)) * dec; o.sxMul = 1 + q; o.syMul = 1 - q;
    }
    return o;
  });

  // ---------------------------------------------------------------- teaser prints (§3 H4, §4 F1–F3)
  // pk = teaser peek pose: from V01·Chine + 0.4 the (still blank) prints are nudged out from under the carton in three
  // stop-motion shoves (P2 first), their white tops showing 40–65 px above its top edge until the deal on « Découvrez »
  const HK_P = [
    { clip: 'B', s0: 4.40, x: 250, y: 560, w: 300, h: 400, rot: -.14, fr: { fy: .62 }, out: [-150, -.40], seed: 31, pk: { x: 392, y: 874, rot: -.085, d: .1 } },
    { clip: 'A', s0: 23.40, x: 540, y: 470, w: 320, h: 427, rot: .02, fr: { fy: .55 }, out: [10, .14], seed: 32, pk: { x: 548, y: 872, rot: .012, d: 0 } },
    { clip: 'B', s0: 11.00, x: 830, y: 560, w: 300, h: 400, rot: .13, fr: { zoom: 1.2, fx: .4 }, out: [150, .40], seed: 33, pk: { x: 690, y: 870, rot: .065, d: .2 } },
  ];
  const HK_O = [540, 985];                                 // under the carton's centre (fully hidden at s .86)
  const NUDGE = [.45, .32, .23];                           // three shoves, smaller each time
  const tPeek = i => V('Chine') + .4 + HK_P[i].pk.d;
  /** peek progress 0..1: three nudges 0.2 s apart, each 4 frames on twos */
  function hk_peekK(i, ts) {
    const tp = tPeek(i); let k = 0;
    NUDGE.forEach((a, j) => { k += a * eOutCubic(clamp((ts - tp - .2 * j) / (4 / 30))); });
    return k;
  }
  /** print i at t → {rect, src, develop, lift} | null */
  function hk_print(i, t) {
    const P = HK_P[i], t0 = tDeal(i), tf = tFlick(i);
    if (t < tPeek(i) || t > tf + .34) return null;
    const ts = f1_twos(t), u = clamp((ts - t0) / DEAL), e = eOutCubic(u), kp = hk_peekK(i, ts);
    // the deal starts from the peek pose (itself out from under the carton): fanning up, slight outward bulge,
    // rotation settles on a spring
    const ox = lerp(HK_O[0], P.pk.x, kp), oy = lerp(HK_O[1], P.pk.y, kp), orot = P.pk.rot * kp;
    let x = lerp(ox, P.x, e) + (P.x - ox) * .10 * Math.sin(Math.PI * e), y = lerp(oy, P.y, e);
    let rot = lerp(orot, P.rot, spring(Math.max(0, ts - t0), 15, .42)), sc = lerp(.86, 1, e);
    let lift = lerp(3, 10, e) + 18 * Math.sin(Math.PI * e);
    const d = drift(t, P.seed, 3), dk = Math.max(e, .5 * kp); x += d.x * dk; y += d.y * dk; rot += d.r * dk;
    // H5 flick: accelerate up and off, rot ±0.4
    const ko = prog(ts, tf, tf + .3);
    if (ko > 0) { const k = ko * ko * ko; y -= 1350 * k; x += P.out[0] * k; rot += P.out[1] * eOutCubic(ko); lift += 30 * eOutCubic(ko); }
    return { rect: { x, y, w: P.w * sc, h: P.h * sc, rot }, src: P.s0 + .7 * Math.max(0, ts - (t0 + DEAL)),
      develop: hp_develop(t, t0 + .1, .4), lift };
  }
  function hk_rectPath(r, pad) {
    const c = Math.cos(r.rot), s = Math.sin(r.rot), hw = r.w / 2 + pad, hh = r.h / 2 + pad;
    ctx.moveTo(r.x - hw * c + hh * s, r.y - hw * s - hh * c);
    ctx.lineTo(r.x + hw * c + hh * s, r.y + hw * s - hh * c);
    ctx.lineTo(r.x + hw * c - hh * s, r.y + hw * s + hh * c);
    ctx.lineTo(r.x - hw * c - hh * s, r.y - hw * s + hh * c); ctx.closePath();
  }

  // ---------------------------------------------------------------- one-time registrations (shakes, SFX, holds)
  let ready = false;
  function hk_init() {
    if (ready || !TLD) return; ready = true;
    addShake(tLand(), 12, .16); addShake(tChine(), 6, .14);
    hp_sfx('cardboard_thud', tLand()); hp_sfx('paper_rustle', tLand() + .06);
    hp_sfx('rattle_goods', V('achetez'));
    hp_sfx('stamp_thunk', tChine());
    hp_sfx('paper_slide', tPeek(1));                                                  // the prints nudged out (soft)
    hp_sfx('instant_eject', tDeal(0)); for (let i = 0; i < 3; i++) hp_sfx('card_deal', tDeal(i));
    hp_sfx('whoosh_whip', tFlick(0));
    hp_sfx('marker_write', tVous());
  }

  registerScene({
    id: 'hk_back', z: 20,
    when: t => TL.in(t, 'hook', 0, .1),
    draw(t, n) {
      hk_init();
      // H1: the table contact shadow converges under the falling carton (faint & soft → dark & tight)
      const tl = tLand();
      if (t < tl + .3) {
        const k = clamp((t - T0()) / (tl - T0())), a = t < tl ? .04 + .26 * k * k * k : .30 * (1 - prog(t, tl, tl + .3));
        if (a > .005) {
          ctx.save(); ctx.filter = `blur(${lerp(46, 12, k).toFixed(1)}px)`; ctx.fillStyle = `rgba(60,32,12,${a.toFixed(3)})`;
          at(552, 1016, -.02, lerp(1.3, 1.02, k), lerp(1.3, 1.02, k), () => { rrect(-282, -212, 564, 428, 14); ctx.fill(); });
          ctx.restore();
        }
      }
      // H4: teaser prints (under the hero: they come out from under the carton)
      const R = [];
      for (let i = 0; i < 3; i++) {
        const p = hk_print(i, t); if (!p) continue; R.push(p.rect);
        const P = HK_P[i];
        hp_printAt(p.rect, P.clip, p.src, { ...P.fr, develop: p.develop, lift: p.lift, tape: false, curl: .25 });
      }
      // one light leak across the fan (clipped to the prints)
      const lp = prog(t, tDeal(2) + .17, tDeal(2) + .77);
      if (R.length && lp > 0 && lp < 1) {
        ctx.save(); ctx.beginPath(); for (const r of R) hk_rectPath(r, 18); ctx.clip(); lightLeak(lp, 3); ctx.restore();
      }
    },
  });

  registerScene({
    id: 'hk_front', z: 50,
    when: t => TL.in(t, 'hook', 0, .1),
    draw(t, n) {
      hk_init();
      // H1: kraft flakes burst from under the two lower corners on the landing
      const tl = tLand();
      hp_flakes(t, tl, 300, 1212, 3, { seed: 5, spread: 2.2 });
      hp_flakes(t, tl, 786, 1216, 3, { seed: 9, spread: 2.2 });
      // H2: the goods settle inside — a pinch of kraft dust shaken off the edges on each shiver
      hp_flakes(t, V('achetez') + .03, 268, 1100, 2, { seed: 17, spread: 1.6, up: .5, alpha: .8 });
      hp_flakes(t, V('marchandises') + .15, 812, 1060, 2, { seed: 23, spread: 1.6, up: .5, alpha: .8 });
    },
  });
})();
