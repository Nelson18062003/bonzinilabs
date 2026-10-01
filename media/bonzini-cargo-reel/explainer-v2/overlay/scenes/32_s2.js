'use strict';
// =============================================================================================
// 32_s2 — S2 · 02 LE GROUPAGE — package B (prefix s2_) — final_storyboard §3 S2, §2.3 T3 (incoming) + T4 (B's side), §2.4,
// §2.5, §5.3, §6. V04 « Étape deux : le groupage. Les colis de plusieurs clients sont réunis dans un même conteneur.
// Chacun profite ainsi de l’espace partagé. »  One idea: several clients' parcels share ONE container — yours is in it.
// Paper only (still in China).
//   s2_back  (z 20): the pencil footprint of the groupage slot (traced just before the container), the paper container
//                    base (+ the cartons inside; + the closed lid once the hero is hidden), the client groups on the table.
//   s2_front (z 50): cartons hopping in (+ kraft flakes), the highlighter zones, the sliding lid, the client tags,
//                    the post-it; during T4 the whole closed container lifts and shrinks to the hand-off pose.
//   Hero: T3 follow-drop flight + landing, the bump, the hop into the container, hidden under the lid (§2.4); the lead
//   thread then ends on the lid's mini label (§2.5).
// Hand-off to C (§5.3): closed container at (540, 760) s .3, lifted 60, top view, at s3.start + 0.1; B draws nothing
// of the s2 table after that, except the post-it sliding out up-left (until s3.start + 0.45).
// =============================================================================================
(() => {
  const S_HERO = .40, IN_S = .85, TBL_S = .8;                  // hero scale (§2.4: .42, −5 % to fit the row); cartons inside / on the table
  const CONT = { x: 540, y: 785, s: .9 };                      // container 'top' home: x 171–909, y 632–938 (+27 front face → 965)
  const HAND = { x: 540, y: 760, s: .3, lift: 60 };            // T4 hand-off pose (§5.3)
  const HERO_IN = { x: 540 + 260 * .9, y: 785 };               // hero's place inside, by the door (container-local (260, 0))
  const LIP_Y = 785 + 200 * .9 - 3;                             // underside of the container's front face (the tags hang from it)
  const POST = { x: 540, y: 466, r: -.03, w: 300 };
  // client cartons: table pose → slot inside the container (container-local)
  const CART = [
    { id: 'A1', col: 'A', seed: 3, x: 182, y: 1030, r: -.04, slot: [-280, -60, .03], from: -1 },
    { id: 'A2', col: 'A', seed: 5, x: 296, y: 1072, r: .05, slot: [-280, 62, -.04], from: -1 },
    { id: 'B1', col: 'B', seed: 7, x: 784, y: 1030, r: .04, slot: [0, -60, -.03], from: 1 },
    { id: 'B2', col: 'B', seed: 9, x: 898, y: 1072, r: -.05, slot: [0, 62, .04], from: 1 },
  ];
  // client tags: on the table under each group → dangling from the container's front lip (drawn B, A, Vous: no text covered)
  const TAGS = [
    { s: 'Client B', x0: 835, y0: 1168, x1: 540, y1: 1052, ride: [2, 3], col: C.ink, seed: 3, lip: 470 },
    { s: 'Client A', x0: 245, y0: 1168, x1: 288, y1: 1010, ride: [0, 1], col: C.ink, seed: 1, lip: 225 },
    { s: 'Vous', x0: 540, y0: 1168, x1: 784, y1: 1010, ride: 'hero', col: C.violetD, seed: 2, lip: 722 },
  ];

  // ---------------------------------------------------------------- word anchors (lazy)
  let _T = null, _TL = null;
  function s2_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V04', w), T = { s0: TL.ch('s2').start, s3: TL.ch('s3').start };
    [T.fa, T.fb] = hp_followWin('s2');                           // T3 [23.15, 23.85]
    T.etape = V('Étape'); T.tagOut = hp_after(T.etape, V('colis'));   // chapter tag 02 leaves [27.20]
    T.cont = T.tagOut;                                           // container slides in from the right, 0.4 s [27.20]
    T.plus = V('plusieurs'); T.cli = V('clients');
    T.inA = [T.plus - .06, T.plus + .16];                        // group A slides in from the left [27.26 → 27.48]
    T.inB = [T.plus + .06, T.cli + .08];                         // group B from the right [27.38 → 27.66]
    T.tags = T.cli + .1;                                         // tags pop [27.68]
    T.reu = V('réunis');
    T.hops = CART.map((c, i) => T.reu + .13 * i); T.hopDur = .28;    // 16ths [28.20 …]
    T.heroHop = T.reu + .52; T.heroLand = T.heroHop + .46;       // hero last, bigger hop [28.72 → 29.18]
    T.meme = V('même');                                          // post-it [28.90]
    T.chac = V('Chacun'); T.hl = [0, 1, 2].map(i => T.chac + .15 * i);   // highlighter zones [29.84 …]
    T.part = V('partagé');                                       // post-it flips [31.60]
    T.lid = TL.seg('V04').end + .06; T.hide = T.lid + .4; T.mini = T.lid + .45;   // lid [32.40], hero hidden [32.80], label [32.85]
    T.lift0 = Math.max(T.s3 - .5, T.mini + .12); T.lift1 = T.s3 + .1;   // T4 lift + shrink to the hand-off pose [33.0 → 33.6]
    T.postOut = hp_after(T.part + .15, T.s3 + .2);               // post-it slides out up-left (readable from the flip's midpoint) [33.85 → 34.10]
    hp_hold('s2 tags', T.tags, T.lift0 + .3);
    hp_hold('s2 post-it 1', T.meme + .1, T.part);
    hp_hold('s2 post-it 2', T.part + .15, T.postOut);
    _TL = TLD; return (_T = T);
  }
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- container pose (screen)
  function s2_contPose(t, T) {
    const ts = tw(t);
    if (t >= T.lift0) {                                          // T4: lift (fast) then shrink to the hand-off pose
      const k = eInOutCubic(prog(t, T.lift0, T.lift1)), up = eOutCubic(prog(t, T.lift0, T.lift0 + .18));
      return { x: lerp(CONT.x, HAND.x, k), y: lerp(CONT.y, HAND.y, k), s: lerp(CONT.s * (1 + .05 * up), HAND.s, k), r: 0, lift: 8 + (HAND.lift - 8) * up };
    }
    const k = prog(ts, T.cont, T.cont + .4), e = k >= 1 ? 1 : eOutBack(k, 1.1);
    return { x: lerp(1560, CONT.x, e), y: CONT.y, s: CONT.s, r: .05 * (1 - k), lift: 8 + 22 * (1 - k) };
  }
  const s2_contPt = (P, lx, ly) => [P.x + (lx * Math.cos(P.r) - ly * Math.sin(P.r)) * P.s, P.y + (lx * Math.sin(P.r) + ly * Math.cos(P.r)) * P.s];

  // ---------------------------------------------------------------- client cartons
  function s2_cartonTable(c, t, T) {                             // on the table (before the hop): slide in from the side, on twos
    const ts = tw(t), [a, b] = c.col === 'A' ? T.inA : T.inB, k = prog(ts, a, b), e = k >= 1 ? 1 : eOutBack(k, 1.6);
    const j = jit(500 + c.seed, Math.round(t * 30), k < 1 ? 1.2 : 0);
    return { x: c.x + c.from * 470 * (1 - e) + j.x, y: c.y + j.y, r: c.r + c.from * .18 * (1 - e) + j.r, on: ts >= a };
  }
  /** landed cartons, container-local (called by hp_paperContainer's inside()) */
  function s2_inside(t, T) {
    const ts = tw(t);
    CART.forEach((c, i) => { const u = ts - T.hops[i] - T.hopDur; if (u < 0) return;
      const q = u < .3 ? Math.exp(-u * 14) * Math.cos(u * 40) * .07 : 0;
      at(c.slot[0], c.slot[1], c.slot[2], IN_S * (1 + q), IN_S * (1 - q), () => hp_clientCarton(180, 135, c.col, c.seed)); });
  }
  function s2_drawHops(t, T) {
    const ts = tw(t), P = s2_contPose(T.hops[0], T);
    CART.forEach((c, i) => {
      const t0 = T.hops[i], t1 = t0 + T.hopDur; if (ts < t0 || ts >= t1) return;
      const k = (ts - t0) / T.hopDur, e = eInOutCubic(k), A = s2_cartonTable(c, t0, T), [bx, by] = s2_contPt(P, c.slot[0], c.slot[1]);
      const x = lerp(A.x, bx, e), y = lerp(A.y, by, e) - 4 * 150 * k * (1 - k), s = lerp(TBL_S, IN_S * P.s, e) * (1 + .18 * Math.sin(Math.PI * k));
      at(x, y, lerp(A.r, c.slot[2], e) + c.from * .4 * Math.sin(Math.PI * k), s, s, () => hp_clientCarton(180, 135, c.col, c.seed));
    });
  }

  // ---------------------------------------------------------------- client tags (kraft mini-tags on short strings)
  /** current tag pose + string attach point */
  function s2_tagPose(g, i, t, T) {
    const ts = tw(t), sw = .04 * Math.sin(ts * Math.PI * 2 / 1.7 + i * 1.9);
    let x = g.x0, y = g.y0, ride = 0, from;
    if (g.ride === 'hero') {
      const a = T.heroHop + .08, b = T.heroLand; ride = eInOutCubic(prog(ts, a, b));
      x = lerp(g.x0, g.x1, ride); y = lerp(g.y0, g.y1, ride) - 160 * Math.sin(Math.PI * ride);
    } else {
      const a = T.hops[g.ride[0]], b = T.hops[g.ride[1]] + T.hopDur; ride = eInOutCubic(prog(ts, a, b));
      x = lerp(g.x0, g.x1, ride); y = lerp(g.y0, g.y1, ride) - 120 * Math.sin(Math.PI * ride);
    }
    // string: before = from the group's front carton (or the hero's bottom edge); after = from the container's lip
    if (ride < 1) {
      let f0;
      if (g.ride === 'hero') { const p = hp_pose(t); f0 = f1_heroPt(p, -150, HP_HERO.h / 2 + 4); }
      else { const c = CART[g.ride[1]], A = s2_cartonTable(c, t, T); f0 = [A.x - 34, A.y + 50]; }
      const lip = [g.lip, LIP_Y]; from = ride > 0 ? [lerp(f0[0], lip[0], ride), lerp(f0[1], lip[1], ride)] : f0;
    } else from = [g.lip, LIP_Y];
    return { x, y, r: -.02 + sw * (ride >= 1 ? 1 : .4) + .12 * Math.sin(Math.PI * ride), ride, from };
  }
  function s2_drawTags(t, T) {
    const ts = tw(t); if (ts < T.tags) return;
    const k = prog(ts, T.tags, T.tags + .2), P = s2_contPose(t, T), lifted = t >= T.lift0, fade = 1 - prog(t, T.lift0 + .12, T.lift0 + .42);
    if (fade <= 0) return;
    // T4: the tags hang from the lip, so they ride the container's lift/shrink (and fade out before the hand-off)
    const f = P.s / CONT.s, map = (x, y) => (lifted ? [P.x + (x - CONT.x) * f, P.y + (y - CONT.y) * f] : [x, y]);
    ctx.save(); ctx.globalAlpha *= fade;
    TAGS.forEach((g, i) => {
      const q = s2_tagPose(g, i, t, T), kk = clamp((k - i * .12) / .76); if (kk <= 0) return;
      const [x, y] = map(q.x, q.y), from = map(q.from[0], q.from[1]);
      hp_clientTag(g.s, x, y, { k: kk, color: g.col, rot: q.r, from, s: lifted ? f : 1, lift: lifted ? P.lift : 6 + 30 * Math.sin(Math.PI * q.ride) });
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- highlighter zones (container-local)
  const ZONES = [
    { x0: -372, x1: -188, col: 'rgba(243,167,69,.45)', pen: C.amber },
    { x0: -92, x1: 92, col: 'rgba(254,86,13,.35)', pen: C.orange },
    { x0: 124, x1: 392, col: 'rgba(169,71,254,.35)', pen: C.violet },
  ];
  function s2_highlights(t, T) {
    const ts = tw(t);
    const pen = ZONES.reduce((a, z, i) => (ts >= T.hl[i] && ts < T.hl[i] + .3 ? i : a), -1);   // one pen, on the newest stroke
    ZONES.forEach((z, i) => {
      const k = prog(ts, T.hl[i], T.hl[i] + .3); if (k <= 0) return;
      const pose = Math.min(4, Math.ceil(k * 4)), y0 = -150, y1 = y0 + 300 * pose / 4;
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = z.col; ctx.beginPath();
      ctx.moveTo(z.x0 + 3, y0 + 4); ctx.lineTo(z.x1 - 2, y0); ctx.lineTo(z.x1 + 2, y1 - 2); ctx.lineTo(z.x0 - 1, y1 + 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (i === pen) at((z.x0 + z.x1) / 2 + 70, y1 - 6, -.5, 1, 1, () => s2_highlighter(z.pen));   // the felt pen, chisel tip on the stroke
    });
  }
  function s2_highlighter(col) {
    withShadow(14, () => { ctx.fillStyle = C.cream; rrect(-14, -150, 28, 118, 9); ctx.fill(); });
    ctx.fillStyle = col; rrect(-15, -186, 30, 46, 9); ctx.fill(); ctx.fillRect(-11, -34, 22, 14);
    ctx.beginPath(); ctx.moveTo(-9, -22); ctx.lineTo(9, -22); ctx.lineTo(9, -4); ctx.lineTo(-9, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-9, -146, 4, 108);
  }

  // ---------------------------------------------------------------- the groupage slot: a pencil footprint on the table
  /** where the container will stand: a dashed graphite outline, hand-traced (on twos) in the 0.4 s before the container
   *  slides in, drafting-style (edges overshoot the corners: table marking, not a viewfinder bracket). Inset in the
   *  container's footprint, so the landed container covers it; it shows again, fading, when T4 lifts the container. */
  const MARK_EDGES = (() => {
    const x0 = CONT.x - 410 * CONT.s + 8, x1 = CONT.x + 420 * CONT.s - 10, y0 = CONT.y - 170 * CONT.s + 8, y1 = CONT.y + 200 * CONT.s - 10, o = 14;
    // traced bottom → right → top → left (the bottom is the part not under the leaving chapter tag)
    return [[x0 - o, y1, x1 + o, y1 + 3], [x1, y1 + o, x1 - 2, y0 - o], [x1 + o, y0 + 2, x0 - o, y0], [x0 + 2, y0 - o, x0, y1 + o]];
  })();
  function s2_marks(t, T) {
    const ts = tw(t), a0 = T.cont - .45, a1 = T.cont - .05; if (ts < a0) return;
    const a = 1 - prog(t, T.lift0, T.lift0 + .3); if (a <= 0) return;
    const k = prog(ts, a0, a1) * MARK_EDGES.length;
    ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.setLineDash([18, 12]);
    MARK_EDGES.forEach(([xa, ya, xb, yb], i) => {
      const e = clamp(k - i); if (e <= 0) return;
      const pts = []; for (let q = 0; q <= 24; q++) {                                 // slight hand wobble along the edge
        const u = q / 24 * e, nx = -(yb - ya), ny = xb - xa, L = Math.hypot(nx, ny), w = (rnd(i * 31 + q * .7) - .5) * 2.2 + Math.sin(u * 5 + i) * 1.4;
        pts.push([lerp(xa, xb, u) + nx / L * w, lerp(ya, yb, u) + ny / L * w]);
      }
      for (const [col, lw, dx] of [['rgba(74,58,82,.42)', 3.4, 0], ['rgba(74,58,82,.16)', 2, 1.4]]) {   // graphite: core + grain
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], q) => (q ? ctx.lineTo(x + dx, y + dx) : ctx.moveTo(x + dx, y + dx))); ctx.stroke();
      }
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- the post-it (« 1 conteneur » → « espace partagé »)
  function s2_drawPostIt(t, T) {
    const ts = tw(t); if (ts < T.meme) return;
    const u = ts - T.meme, kin = clamp(u / .14), ko = eInCubic(prog(t, T.postOut, T.postOut + .25)); if (ko >= 1) return;
    const sIn = u < .14 ? lerp(1.3, 1, eInCubic(kin)) : 1 - Math.exp(-(u - .14) * 12) * Math.cos((u - .14) * 36) * .03;
    const kf = prog(ts, T.part, T.part + .3), back = kf >= .5, fx = Math.max(.04, Math.abs(Math.cos(Math.PI * kf)));
    const d = drift(t, 61, 2), lift = (u < .14 ? lerp(34, 10, kin) : 10) + 22 * Math.sin(Math.PI * kf) + 30 * ko;
    ctx.save(); ctx.globalAlpha *= clamp(kin * 4);
    at(POST.x + d.x - 760 * ko, POST.y + d.y - 430 * ko, POST.r + d.r - .35 * ko, sIn * fx * (1 + .06 * Math.sin(Math.PI * kf)), sIn, () => {
      postIt(POST.w, () => {
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-POST.w / 2, -POST.w / 2, POST.w, 34);       // glue strip
        if (!back) {
          handText('1', 0, -18, 110, { color: C.violetD, write: prog(ts, T.meme + .1, T.meme + .3), pen: true });
          handText('conteneur', 0, 84, 50, { color: C.ink, write: prog(ts, T.meme + .28, T.meme + .62), pen: true });
        } else {
          handText('espace', 0, 0, 60, { color: C.ink });
          handText('partagé', 0, 82, 60, { color: C.ink });
        }
      }, { fill: C.postit, lift });
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- the container (both layers)
  /** layer 'back' (z 20: base + cartons inside; + the closed lid once the hero is hidden, so the lead thread (z 38) can run
   *  over it to the mini label) | 'front' (z 50: highlighter zones + the sliding lid, over the hero) | 'all' (T4, lifted) */
  function s2_drawContainer(t, T, layer) {
    const P = s2_contPose(t, T), ts = tw(t), shut = t >= T.hide;
    const lid = eOutCubic(prog(t, T.lid, T.lid + .4)), label = prog(ts, T.mini, T.mini + .22);
    at(P.x, P.y, P.r, P.s, P.s, () => {
      if (layer !== 'front') hp_paperContainer('top', { part: 'base', lift: P.lift, inside: () => s2_inside(t, T) });
      if (layer === 'front' && !shut) { s2_highlights(t, T); if (lid > 0) hp_paperContainer('top', { part: 'lid', lid, label, lift: P.lift }); }
      if (layer === 'all' || (layer === 'back' && shut)) hp_paperContainer('top', { part: 'lid', lid, label, lift: P.lift });
    });
    return P;
  }
  /** screen point of the lid's mini label (top of it) — the lead thread's end once the hero is inside */
  function s2_labelPt(t, T) { const P = s2_contPose(t, T); return s2_contPt(P, 410 + 4 - 92, -140 * .55 + 14); }

  // ---------------------------------------------------------------- hero registrations (§2.4, §2.5)
  hp_keys('s2', () => {
    const T = s2_T();
    return [
      { t: T.fb, dur: T.fb - T.fa, x: 540, y: 1060, s: S_HERO, r: 0 },                           // T3: follow-drop landing
      { t: T.heroHop + .08 },                                                                    // anticipation
      { t: T.heroHop + .27, x: 664, y: 880, s: .48, r: .07, ease: 'out', twos: true },            // bigger hop, apex
      { t: T.heroLand, x: HERO_IN.x, y: HERO_IN.y, s: S_HERO, r: .01, ease: 'in', twos: true },  // into the container
    ];
  });
  hp_states('s2', t => {
    const T = s2_T(), o = {}; if (t < T.fa) return o;
    const ts = tw(t), f = hp_followHero(t, 's2');
    if (f.on) { o.dr = f.tilt; o.sxMul = f.sx; o.syMul = f.sy; o.lift = 30 * Math.sin(Math.PI * f.k); }
    const sq = (u, amp) => { if (u < 0 || u > .5) return; const q = amp * Math.exp(-u * 11) * Math.cos(u * 38); o.sxMul = 1 + q; o.syMul = 1 - q * .8; };
    sq(ts - T.fb, .06);                                                                          // T3 landing squash
    const ua = ts - T.heroHop;
    if (ua >= 0 && ua < .08) { o.sxMul = 1.03; o.syMul = .93; }                                 // anticipation
    else if (ua >= .08 && ua < .46) o.lift = 44 * Math.sin(Math.PI * (ua - .08) / .38);
    sq(ts - T.heroLand, .07);
    if (t >= T.hide) o.visible = false;                                                          // inside, under the lid
    return o;
  }, .4);
  hp_mood('s2', () => { const T = s2_T(); return [{ kind: 'peek', t0: T.inA[1] - .02, dir: 1, hold: .1 }]; });
  hp_anchor('s2', t => {
    const T = s2_T(); if (t < T.hide - .02) return null;                                         // the hero holds the thread
    if (t >= T.lift1) return null;                                                               // C takes over (it draws the container from here)
    const k = eInOutCubic(prog(t, T.mini - .04, T.mini + .12)), L = s2_labelPt(t, T);
    if (k >= 1) return L;
    const K = hp_knot(T.hide - .03); return [lerp(K[0], L[0], k), lerp(K[1], L[1], k)];
  });
  hp_tick(1, () => TL.ch('s2').end - .5);                                                       // slot 2 check [33.0]

  // ---------------------------------------------------------------- sound (§6)
  function s2_cues(T) {
    hp_sfx('paper_slide', T.cont); hp_sfx('cardboard_bump', T.inA[1]); hp_sfx('cardboard_bump', T.inB[1]); hp_sfx('cardboard_bump', T.inB[1] + .2);
    T.hops.forEach(h => hp_sfx('thup', h + T.hopDur)); hp_sfx('thup', T.heroLand);
    hp_sfx('sticker_slap', T.meme + .12); hp_sfx('marker_write', T.meme + .1);
    T.hl.forEach(h => hp_sfx('felt_swipe', h)); hp_sfx('card_flip', T.part);
    hp_sfx('lid_scrape', T.lid); hp_sfx('sticker_slap', T.mini + .1); hp_sfx('paper_slide', T.postOut);
  }

  // ---------------------------------------------------------------- scenes
  const dyIn = t => hp_followY(t, 's2', 'in');                  // T3: the s2 table rises in from below
  registerScene({
    id: 's2_back', z: 20, when: t => TL.in(t, 's2', .4, .5),
    draw(t, n) {
      const T = s2_T(); s2_cues(T); if (t >= T.lift1) return;
      ctx.save(); ctx.translate(0, dyIn(t));
      const ts = tw(t);
      s2_marks(t, T);
      if (ts >= T.cont && t < T.lift0) s2_drawContainer(t, T, 'back');
      CART.forEach((c, i) => { if (ts >= T.hops[i]) return; const A = s2_cartonTable(c, t, T); if (A.on) at(A.x, A.y, A.r, TBL_S, TBL_S, () => hp_clientCarton(180, 135, c.col, c.seed)); });
      ctx.restore();
    },
  });
  registerScene({
    id: 's2_front', z: 50, when: t => TL.in(t, 's2', .4, .5),
    draw(t, n) {
      const T = s2_T(), ts = tw(t);
      ctx.save(); ctx.translate(0, dyIn(t));
      if (t < T.lift1) {
        if (t >= T.lift0) s2_drawContainer(t, T, 'all');
        else if (ts >= T.cont) s2_drawContainer(t, T, 'front');
        s2_drawHops(t, T);
        if (t < T.lift0) {                                       // a few kraft flakes where each parcel lands
          const P = s2_contPose(T.hops[0], T);
          CART.forEach((c, i) => { const [x, y] = s2_contPt(P, c.slot[0], c.slot[1]); hp_flakes(t, T.hops[i] + T.hopDur, x, y + 30, 4, { seed: 30 + 3 * i, up: .45, spread: 2.4 }); });
          hp_flakes(t, T.heroLand, HERO_IN.x, HERO_IN.y + 70, 5, { seed: 52, up: .5, spread: 2.6 });
        }
        s2_drawTags(t, T);
      }
      s2_drawPostIt(t, T);
      ctx.restore();
    },
  });
})();
