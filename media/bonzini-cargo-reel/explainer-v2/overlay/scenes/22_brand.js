'use strict';
// =============================================================================================
// 22_brand — BRAND · V02 « Suivez avec nous le parcours de vos colis, avec Bonzini Trading Cargo. »
// (final_storyboard §3 BRAND B1–B8, §2.3 T1/T2, §2.4, §2.5, §5.3). Package A, prefix br_.
// One idea: Bonzini Trading Cargo walks you along that thread.
//   B2 « Suivez »: the hero slides to (540, 1135) s .5 · B3 « parcours »: title strip slapped + pluck ripple
//   B4 « colis »: nod · B5 « Bonzini »: the brand tag swings in and CATCHES the lead thread at its grommet,
//   logo pieces fly in on twos · B6 « Trading »: wordmark stamped · B7 hold · B8 T2 « the box opens »:
//   tag flips up, title whips out to the left (under the tab row), violet tape snaps, label peels and flutters to (150, 1170), flaps spring,
//   the open box is tossed up and handed to s1 at (540, 1080) s .55: if s1 registers a `land` mood there, the toss
//   ends exactly where `land` starts (1.25×, shadow 40); otherwise it touches down at the hand-off itself.
// Exports for neighbours: br_t2Start(), br_t2End() (T2 window), BR_LABEL_HOVER (the hovering label pose).
// =============================================================================================
const BR_LABEL_HOVER = { x: 150, y: 1170, s: .45, r: -.12 };
/** T2 start = after(V02·Trading, s1.start − 0.4) [13.92] */
function br_t2Start() { return hp_after(W_('V02', 'Trading'), TL.ch('s1').start - .4); }
/** T2 end = hero hand-off to s1 [14.45] */
function br_t2End() { return br_t2Start() + .53; }

(() => {
  const V = (w, k = 0) => W_('V02', w, k);
  const BR = { heroX: 540, heroY: 1114, heroS: .46, heroR: -.02, titleY: 456, tagX: 540, tagY: 794, tagR: -.015 };   // even ~30 px gaps: stepper | title | tag | hero | caption
  const tTitle = () => V('parcours') + .04;              // B3 slap lands
  const tTag = () => V('Bonzini') + .02;                 // B5 tag lands (swing starts .62 s before)
  const tWord = () => V('Trading') + .02;                // B6 wordmark hit

  // ---------------------------------------------------------------- hand-off to s1 (§5.3): read, never write, s1's data
  let _land = null, _landBusy = false;
  /** {t, x, y, s, r, byS1}: where/when the tossed-up open box lands. Follows s1's `land` mood / first key if registered. */
  function br_land() {
    if (_land) return _land;
    const t2 = br_t2Start(); let t = br_t2End(), pose = { x: 540, y: 1080, s: .55, r: -.02 }, byS1 = false;
    if (_landBusy) return { t, ...pose, byS1 };                 // re-entered from s1's key function: contract default
    _landBusy = true;
    try {
      const m = (typeof f1_moods === 'function' ? f1_moods() : []).filter(q => q.kind === 'land' && q.t0 > t2 + .25 && q.t0 < t2 + 1.2).sort((a, b) => a.t0 - b.t0)[0];
      if (m) { t = m.t0; byS1 = true; }
      if (typeof _hpK !== 'undefined') for (const r of _hpK) {
        if (r.ch !== 's1') continue;
        const ks = (f1_val(r.fn) || []).filter(k => k && isFinite(k.t) && k.t > t2 + .2 && k.t < t2 + 1.2).sort((a, b) => a.t - b.t);
        if (ks[0]) { for (const f of ['x', 'y', 's', 'r']) if (ks[0][f] != null) pose[f] = ks[0][f]; if (!byS1) t = ks[0].t; break; }
      }
    } catch (e) { }
    _landBusy = false;
    return (_land = { t, ...pose, byS1 });
  }

  // ---------------------------------------------------------------- hero track (§2.4)
  hp_keys('brand', () => {
    const su = V('Suivez'), t2 = br_t2Start(), L = br_land();
    return [
      { t: su + .6, dur: .6, x: BR.heroX, y: BR.heroY, s: BR.heroS, r: BR.heroR, lift: 6, ease: 'io' },   // B2
      { t: t2 + .22 },                                                                                      // flaps spring first
      { t: L.t, x: L.x, y: L.y, s: L.s, r: L.r, ease: 'out', twos: true },                                  // tossed → s1 land
    ];
  });
  hp_mood('brand', () => [{ kind: 'nod', t0: V('colis') }]);                                               // B4
  hp_pluck(() => tTitle() - .02);                                                                           // B3 ripple

  /** hero pose at t2 as 11_hero computes it (rest pose + drift + breathe) — the label peels from exactly there */
  function br_heroRest(t) {
    const d = drift(t, 7, 3), br = 1 + .006 * Math.sin(t * Math.PI * 2 / 2.4);
    return { x: BR.heroX + d.x, y: BR.heroY + d.y, s: BR.heroS * br, r: BR.heroR + d.r };
  }
  /** T2 label flight: peel (t2+.06, 0.1 s) → flutter on twos (0.36 s) → hover at BR_LABEL_HOVER */
  function br_labelPose(t) {
    const t2 = br_t2Start(), H = br_heroRest(t2), c = Math.cos(H.r), s = Math.sin(H.r);
    const x0 = H.x + (HP_HERO.label.x * c - HP_HERO.label.y * s) * H.s, y0 = H.y + (HP_HERO.label.x * s + HP_HERO.label.y * c) * H.s;
    const r0 = H.r + HP_HERO.label.r, s0 = H.s, Q = BR_LABEL_HOVER;
    const kp = eOutCubic(prog(t, t2 + .06, t2 + .16));
    const x1 = x0 - 8 * kp, y1 = y0 - 12 * kp, r1 = r0 - .07 * kp, s1 = s0 * (1 + .07 * kp);
    const ts = f1_twos(t), kf = eInOutCubic(prog(ts, t2 + .14, t2 + .46));
    if (kf <= 0) return { x: x1, y: y1, s: s1, r: r1, lift: 2 + 16 * kp, bob: 0 };
    // hover = s1's pose at the hand-off (lift 8, the 11_hero bob of 3 px faded in with the flight → no jump)
    const fl = Math.sin(3 * Math.PI * kf) * (1 - kf);
    return { x: lerp(x1, Q.x, kf) - 30 * fl, y: lerp(y1, Q.y, kf) - 170 * Math.sin(Math.PI * kf), s: lerp(s1, Q.s, kf) * (1 + .05 * Math.sin(Math.PI * kf)),
      r: lerp(r1, Q.r, kf) + .45 * fl, lift: lerp(18, 8, kf) + 24 * Math.sin(Math.PI * kf), bob: 3 * kf };
  }
  hp_states('brand', t => {
    const t2 = br_t2Start(); if (t < t2) return {};
    const L = br_land(), ts = f1_twos(t), o = {};
    // B8 T2: tape snaps (0.12 s), flaps spring open (3 poses on twos) — held until s1 closes them (V03·emballées)
    if (t < W_('V03', 'emballées')) { o.tapeSnap = prog(t, t2 + .04, t2 + .16); o.flaps = prog(ts, t2 + .2, t2 + .4); }
    // the label peels off and hovers until s1 slaps it back (V03·pour)
    if (t < W_('V03', 'pour')) o.labelPose = br_labelPose(t);
    // the springing flaps toss the open box up toward the lens (on twos). If s1 registers a `land` mood at the hand-off,
    // the toss ends exactly where `land` starts (1.25×, shadow 40); otherwise it comes back down and touches the table
    // AT the hand-off (s1 takes over there with its own settle — currently a `nod`), so nothing pops at 14.45.
    if (t >= t2 + .22 && t < L.t) {
      let m;
      if (L.byS1) m = eOutCubic(prog(ts, t2 + .22, L.t));
      else { const up = eOutCubic(prog(ts, t2 + .22, t2 + .36)), dn = eInCubic(prog(ts, t2 + .36, L.t)); m = up * (1 - dn) * .8; }
      o.sxMul = o.syMul = 1 + .25 * m; o.lift = 40 * m;
    }
    return o;
  });

  // ---------------------------------------------------------------- brand tag (B5–B8): swing in, catch the thread, flip out
  /** {x, y, r, s, sy, lift, u} | null — pendulum from off-frame top-right (like the chapter tags), on twos */
  function br_tagPose(t) {
    const tl = tTag(), t0 = tl - .62, t2 = br_t2Start();
    if (t < t0 || t >= t2 + .26) return null;
    const ts = f1_twos(t), u = ts - t0, Lp = 1700, d = drift(t, 21, 2);
    let x, y, r, s, lift, sy = 1;
    if (u < .62) {
      const th0 = -.6 * (1 - spring(.5, 9, .35)), settle = clamp((u - .5) / .12);
      const th = u < .5 ? -.6 * (1 - spring(Math.max(0, u), 9, .35)) : th0 * (1 - eOutCubic(settle));
      x = BR.tagX + d.x * settle - Lp * Math.sin(th) * (th > 0 ? .5 : 1); y = BR.tagY + d.y * settle - Lp * (1 - Math.cos(th));
      r = BR.tagR + th * .75; s = u < .5 ? 1.04 : lerp(1.04, 1, eInCubic(settle)); lift = u < .5 ? 40 : lerp(40, 10, eInCubic(settle));
    } else {
      const v = u - .62; x = BR.tagX + d.x; y = BR.tagY + d.y; r = BR.tagR + d.r;
      s = (1 - Math.exp(-v * 14) * Math.cos(v * 40) * .02) * (1 + .012 * eInOutCubic(prog(t, tl + .3, t2))); lift = 10;
    }
    if (t >= t2) { const k = eInCubic(prog(ts, t2, t2 + .24)); sy = Math.cos(Math.PI / 2 * k); y -= 260 * k; lift += 30 * k; r += .05 * k; }
    return { x, y, r, s, sy, lift, u };
  }
  function br_grommet(P) { const gx = -348 * P.s; return [P.x + gx * Math.cos(P.r), P.y + gx * Math.sin(P.r) * P.sy]; }
  /** where the lead thread is held by the tag (catch → hold → twang release) | null */
  function br_junction(t) {
    const P = br_tagPose(t); if (!P) return null;
    const G = br_grommet(P), T = hp_tabGrommet(0, t), K = hp_knot(t), t2 = br_t2Start();
    const fy = (G[1] - T[1]) / Math.max(1, K[1] - T[1]), lineX = T[0] + (K[0] - T[0]) * fy;
    if (!(P.u >= .5 || G[0] <= lineX)) return null;                         // not caught yet: the grommet comes from the right
    if (t < t2 + .1) return G;
    const k = prog(t, t2 + .1, t2 + .28); if (k >= 1) return null;
    const proj = [lineX, G[1]], e = eOutBack(k, 2.2);
    return [lerp(G[0], proj[0], e), lerp(G[1], proj[1], e)];
  }
  hp_leadEnd('brand', t => (TL.in(t, 'brand', 0, .6) ? br_junction(t) : null));

  // ---------------------------------------------------------------- title strip (B3)
  const TITLE = ['LE PARCOURS', 'DE VOS COLIS'];
  let _strip = null;
  function br_stripGeo() {
    if (_strip) return _strip;
    const f = font(FF.stencil, 96, 900), wMax = Math.max(...TITLE.map(s => measure(s, f, 3)));
    ctx.save(); ctx.font = f; const asc = ctx.measureText('LE PARCOURS').actualBoundingBoxAscent || 70; ctx.restore();
    const w = Math.round(wMax + 150), h = 244, b1 = (asc - 104) / 2;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 41, 3.4, 11), right = tornLine(w / 2, -h / 2, w / 2, h / 2, 47, 1.4, 16),
      bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 53, 3.4, 11), left = tornLine(-w / 2, h / 2, -w / 2, -h / 2, 59, 1.4, 16);
    const outer = [...top, ...right, ...bot, ...left];
    const inner = [...tornLine(-w / 2 + 2, -h / 2 + 3, w / 2 - 2, -h / 2 + 3, 43, 2.2, 9), ...tornLine(w / 2 - 2, -h / 2 + 3, w / 2 - 2, h / 2 - 3, 49, 1, 16),
      ...tornLine(w / 2 - 2, h / 2 - 3, -w / 2 + 2, h / 2 - 3, 55, 2.2, 9), ...tornLine(-w / 2 + 2, h / 2 - 3, -w / 2 + 2, -h / 2 + 3, 61, 1, 16)];
    return (_strip = { f, w, h, b1, outer, inner });
  }
  function br_poly(P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }
  /** amber tape piece (jagged short ends, sheen) centred at (0,0) — k = press pop */
  function br_tape(w, h, k, seed) {
    if (k <= 0) return; const s = lerp(1.3, 1, eOutCubic(clamp(k)));
    at(0, 0, 0, s, s, () => {
      ctx.globalAlpha *= clamp(k * 2.5);
      const zig = (x, dir) => { const P = []; for (let i = 0; i <= 6; i++) P.push([x + (i % 2 ? 4 : -1) * dir + (rnd(seed + i * 1.7) - .5) * 2, -h / 2 + h * i / 6]); return P; };
      const L = zig(-w / 2, -1), R = zig(w / 2, 1).reverse();
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const p of R.slice().reverse()) ctx.lineTo(p[0], p[1]);
      for (const p of L.slice().reverse()) ctx.lineTo(p[0], p[1]); ctx.closePath();
      ctx.fillStyle = 'rgba(243,167,69,.80)'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-w / 2, -h / 2 + 5, w, 4);
      ctx.fillStyle = 'rgba(160,96,20,.14)'; ctx.fillRect(-w / 2, h / 2 - 6, w, 6); ctx.restore();
    });
  }
  function br_drawStrip(k1, k2, lift) {
    const G = br_stripGeo();
    withShadow(lift, () => { br_poly(G.outer); ctx.fillStyle = '#FFFDF6'; ctx.fill(); });
    br_poly(G.inner); ctx.fillStyle = C.cream; ctx.fill();
    ctx.save(); br_poly(G.inner); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-G.w / 2, -G.h / 2, G.w, G.h);
    const g = ctx.createLinearGradient(-G.w / 2, -G.h / 2, G.w / 2, G.h / 2); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(150,110,60,.07)');
    ctx.fillStyle = g; ctx.fillRect(-G.w / 2, -G.h / 2, G.w, G.h); ctx.restore();
    TITLE.forEach((s, i) => {
      const y = G.b1 + 104 * i;
      text(s, 0, y + 1.6, { font: G.f, color: 'rgba(35,22,41,.13)', align: 'center', ls: 3 });         // press impression
      text(s, 0, y, { font: G.f, color: C.ink, align: 'center', ls: 3 });
    });
    // two tape pieces across the torn ends, diagonally opposite (half on the strip, half on the table) — clear of the stepper
    at(-G.w / 2 + 6, -G.h / 2 + 62, -.22, 1, 1, () => br_tape(118, 38, k1, 7));
    at(G.w / 2 - 6, G.h / 2 - 62, -.22, 1, 1, () => br_tape(118, 38, k2, 13));
  }
  /** {x, y, r, s, a, lift, k1, k2} | null */
  function br_titlePose(t) {
    const tl = tTitle(), t2 = br_t2Start(); if (t < tl - .2 || t > t2 + .42) return null;
    const ts = f1_twos(t), d = drift(t, 31, 2);
    let x = 540 + d.x, y = BR.titleY + d.y, r = -.02 + d.r, s = 1, a = 1, lift = 10;
    if (ts < tl) { const k = eInCubic(prog(ts, tl - .2, tl)); s = lerp(1.32, 1, k); lift = lerp(60, 10, k); r = lerp(-.075, -.02, k); y -= 40 * (1 - k); a = clamp(prog(t, tl - .2, tl - .12) * 1.4); }
    else { const v = ts - tl; s = (1 - Math.exp(-v * 14) * Math.cos(v * 40) * .022) * (1 + .012 * eInOutCubic(prog(t, tl + .3, t2))); }
    // T2 exit: whipped out to the LEFT, level (rise ≤ 12 px, tilt ≤ .03) — its top edge stays below the stepper's tab row
    // (y ≈ 295), so it never shows through the translucent ghost tabs as the old upward exit did
    if (t >= t2) { const k = prog(t, t2, t2 + .32), e = k * k * k; x -= 1320 * e; y -= 12 * e; r -= .03 * k * k; lift += 26 * eOutCubic(k); }
    return { x, y, r, s, a, lift, k1: prog(ts, tl + 2 / 30, tl + 4 / 30), k2: prog(ts, tl + 4 / 30, tl + 6 / 30) };
  }

  // ---------------------------------------------------------------- one-time registrations (shakes, SFX, holds)
  let ready = false;
  function br_init() {
    if (ready || !TLD) return; ready = true;
    const t2 = br_t2Start(), tb = V('Bonzini');
    hp_sfx('paper_slide', V('Suivez'));
    hp_sfx('paper_slap', tTitle()); addShake(tTitle(), 3, .12);
    hp_sfx('whoosh_soft', tTag() - .62); hp_sfx('paper_slap', tTag()); addShake(tTag(), 4, .12);
    hp_sfx('paper_slap', tb + .44 * (.12 + .64)); hp_sfx('paper_slap', tb + .44);                // logo pieces lock (first / last)
    hp_sfx('stamp_thunk', tWord()); addShake(tWord(), 4, .12);
    hp_sfx('tape_rip', t2 + .04); hp_sfx('sticker_peel', t2 + .12); hp_sfx('flap_fold', t2 + .36);
    hp_hold('brand title', tTitle(), t2); hp_hold('brand tag', tTag(), t2); hp_hold('brand wordmark', tWord(), t2);
  }

  registerScene({
    id: 'br_back', z: 20,
    when: t => TL.in(t, 'brand', .1, .6),
    draw(t, n) { br_init(); },
  });
  // the upper half of the journey thread while the brand tag holds it (tab 01 → grommet); the lower half is 11_hero's lead
  registerScene({
    id: 'br_thread', z: 38,
    when: t => TL.in(t, 'brand', 0, .6),
    draw(t, n) {
      const J = br_junction(t); if (!J) return;
      const pts = f1_leadPts(J, hp_tabGrommet(0, t), t); if (!pts) return;
      ctx.save(); ctx.globalAlpha *= .8; thread(pts, 1, n, { w: 6 }); ctx.restore();
    },
  });
  registerScene({
    id: 'br_front', z: 50,
    when: t => TL.in(t, 'brand', .1, .6),
    draw(t, n) {
      br_init();
      const P = br_titlePose(t); if (!P) return;
      ctx.save(); ctx.globalAlpha *= P.a; at(P.x, P.y, P.r, P.s, P.s, () => br_drawStrip(P.k1, P.k2, P.lift)); ctx.restore();
    },
  });
  registerScene({
    id: 'br_tag', z: 60,
    when: t => TL.in(t, 'brand', 0, .6),
    draw(t, n) {
      const P = br_tagPose(t); if (!P || P.sy <= .02) return;
      const tb = V('Bonzini'), logoK = prog(f1_twos(t), tb, tb + .44), wordK = prog(t, tWord() - .22, tWord() + .28);
      at(P.x, P.y, 0, 1, P.sy, () => {
        hp_brandTag(0, 0, P.s, P.r, 1, { logoK, wordK, lift: P.lift });
        if (P.sy < 1) {                                          // flipping: the face turns away from the light
          ctx.save(); ctx.globalAlpha *= (1 - P.sy) * .35; ctx.fillStyle = C.kraftD;
          at(0, 0, P.r, P.s, P.s, () => { f1_tagPath(-380, -190, 760, 380, 62, 14); ctx.fill(); }); ctx.restore();
        }
      });
      // the journey thread knotted through the grommet
      if (br_junction(t)) {
        const G = br_grommet(P);
        ctx.save(); ctx.fillStyle = C.violet; ctx.beginPath(); ctx.ellipse(G[0], G[1], 8, 7 * P.sy, P.r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(G[0] - 2, G[1] - 2, 3, 2.4, P.r, 0, 7); ctx.fill(); ctx.restore();
      }
    },
  });
})();
