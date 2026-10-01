'use strict';
// =============================================================================================
// 44_s6 — S6 · 06 LE RETRAIT — package D (prefix s6_) — final_storyboard §3 S6, §2.3 T7 (incoming side) + T8 (D's
// pull-out), §2.4, §2.5, §5.3, §6.
// V09 « Étape six : le retrait. Il ne vous reste plus qu’à venir récupérer vos colis. »
// Q5 « Et nous vous attendons dans notre entrepôt ici, au niveau du foyer Balengou, pour le retrait de vos colis. »
// One idea: come and collect it — at the door of our warehouse, Foyer Balengou.
//   s6_back  (z 20): the counter group (footprints, the paper client behind the Bonzini counter, the parcel in the
//                    client's hands once picked up), P6 (B2 4.0 → 4.8, freeze, Ken Burns toward the doorway).
//   s6_front (z 50): the check, the orange door circle, the FOYER BALENGOU place tag, the violet thread and its bow.
//   Hero: T7 follow-drop landing on the counter, hidden from V09·colis (drawn here in the client's hands).
//   T8: from TL.ch('recap').start − 0.4 both layers scale to .6 about (0, 960) and slide −900 px (E unhooks the stepper).
// Every time is anchored on words or on the T7 / T8 boundaries; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  const COUNTER = { x: 540, y: 1010, w: 560 };                 // body x 260–820, y 1010–1230; top slab y 984–1010
  // the counter group is laid out in its own frame (counter at (540, 1010) as in §3 6.1) and drawn ×1.12 about its
  // bottom (540, 1232), so the scene fills more of the frame while the counter still ends above the caption band
  const GS = 1.12, PIV = [540, 1232];
  const HERO_L = { x: 590, y: 949, s: .43 };                   // on the counter (group frame; right of the client; top clear of tag 06)
  const HERO_C = { x: PIV[0] + (HERO_L.x - PIV[0]) * GS, y: PIV[1] + (HERO_L.y - PIV[1]) * GS, s: HERO_L.s * GS };   // screen [596, 915] s .48
  const CL = { x: 360, y: 915, s: .55 };                       // the paper client (bust) behind the counter (group frame)
  const HELD = { x: 360, y: 1004, s: .3 };                     // the parcel in the client's hands (group frame)
  const CHECK = { x: 700, y: 850 };
  const STEPS = [[30, 1212], [118, 1172], [192, 1118], [238, 1056]];   // footprints: bottom-left edge → counter's left end
  const DOOR = [.64, .50];                                     // centre of the open doorway as framed in P6 (foot/up/B2/00144.jpg)
  const FR0 = { zoom: 1.1, fx: .6, fy: .5 };
  const PLACE = { x: 520, y: 1136, r: -.03 };                  // y 1041–1231: clear of the caption strip's tape
  const SKIN = '#6B3F26', WAX = [C.orange, C.violetD, C.amber, C.cream];

  // ---------------------------------------------------------------- word anchors (lazy)
  let _T = null, _TL = null;
  function s6_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V09', w), T = { s6: TL.ch('s6').start, rc: TL.ch('recap').start };
    [T.fa, T.fb] = hp_followWin('s6');                           // T7 [88.65, 89.35]
    T.etape = V('Étape'); T.tagOut = hp_after(T.etape, V('Il'));   // tag 06 (E) [90.40 → 92.50]
    T.venir = V('venir'); T.recup = V('récupérer'); T.colis = V('colis');   // [93.98] [94.22] [95.10]
    T.hold = T.colis + .3;                                        // parcel in the hands
    T.q5s = TL.seg('Q5').start; T.q5e = TL.seg('Q5').end;
    const Q = w => W_('Q5', w);
    T.et = Q('Et'); T.nous = Q('nous'); T.ici = Q('ici'); T.foyer = Q('foyer'); T.bal = Q('Balengou'); T.retrait = Q('retrait');
    T.out0 = T.rc - .4; T.out1 = T.out0 + .6;                   // T8 pull-out [105.6 → 106.2]
    hp_hold('s6 FOYER BALENGOU', T.foyer + .15, T.out0 + .3);
    _TL = TLD; return (_T = T);
  }
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- the counter group (counter + client + footprints)
  /** group transform: drift, then the slide out down-left at Q5·nous (0.45 s, on twos, s → .7) */
  function s6_group(t, T) {
    const d = drift(t, 91, 2), k = prog(tw(t), T.nous, T.nous + .45), e = k * k * (1.4 - .4 * k);
    return { dx: d.x - 900 * e, dy: d.y + 60 * e, s: GS * lerp(1, .7, e), r: d.r - .07 * e, cx: PIV[0], cy: PIV[1], gone: k >= 1, k };
  }
  /** screen → group frame */
  function s6_lpt(G, X, Y) {
    const x = X - G.cx - G.dx, y = Y - G.cy - G.dy, c = Math.cos(-G.r), s = Math.sin(-G.r);
    return [G.cx + (x * c - y * s) / G.s, G.cy + (x * s + y * c) / G.s];
  }
  function s6_gpt(G, x, y) {
    const lx = (x - G.cx) * G.s, ly = (y - G.cy) * G.s, c = Math.cos(G.r), s = Math.sin(G.r);
    return [G.cx + G.dx + lx * c - ly * s, G.cy + G.dy + lx * s + ly * c];
  }
  function s6_withGroup(G, fn) { ctx.save(); ctx.translate(G.cx + G.dx, G.cy + G.dy); ctx.rotate(G.r); ctx.scale(G.s, G.s); ctx.translate(-G.cx, -G.cy); fn(); ctx.restore(); }
  /** client x (slides in behind the counter on twos, walk-bob) */
  function s6_client(t, T) {
    const ts = tw(t), k = prog(ts, T.recup, T.recup + .4), e = k >= 1 ? 1 : eOutBack(k, 1.2);
    const x = lerp(-260, CL.x, e), bob = k > 0 && k < 1 ? (Math.floor(ts * 15) % 2 ? -7 : 0) : 0;
    return { x, y: CL.y + bob, on: ts >= T.recup, moving: k > 0 && k < 1 };
  }
  /** the parcel: hop from the counter into the hands (0.3 s, on twos), then held — screen pose before the group transform */
  function s6_heldPose(t, T) {
    const ts = tw(t), k = prog(ts, T.colis, T.hold), e = eInOutCubic(k), b = hp_pose(T.colis - .001), G0 = s6_group(T.colis, T), [bx, by] = s6_lpt(G0, b.x, b.y);
    const base = { x: bx, y: by, s: b.s / G0.s, r: b.r - G0.r };
    let x = lerp(base.x, HELD.x, e), y = lerp(base.y, HELD.y, e) - 120 * Math.sin(Math.PI * k), s = lerp(base.s, HELD.s, e), r = lerp(base.r, 0, e) - .3 * Math.sin(Math.PI * k);
    const u = ts - T.hold; if (u >= 0 && u < .4) s *= 1 + Math.exp(-u * 12) * Math.cos(u * 38) * .05;
    const w = ts - T.et; if (w >= 0 && w < 1.1) { r += .06 * Math.min(1, w * 6); y += (Math.floor(w * 7.5) % 2) * 3; }
    return { x, y, s, r, lift: 6 + 40 * Math.sin(Math.PI * k) };
  }
  function s6_drawClient(t, T, C0) {
    const ts = tw(t), held = ts >= T.hold, w = ts - T.et, waving = w >= 0 && w < 1.1;
    let arms = 'idle';
    if (held) {
      const hp = s6_heldPose(t, T), hx = 95 * hp.s / HELD.s;
      const R = [(hp.x + hx - C0.x) / CL.s, (hp.y + 6 - C0.y) / CL.s], L = [(hp.x - hx - C0.x) / CL.s, (hp.y + 6 - C0.y) / CL.s];
      arms = [[-L[0], L[1]], R];                                              // person mirrors side −1 targets
      if (waving) arms[0] = Math.floor(w * 7.5) % 2 ? [250, -175] : 'raise';  // waves (on twos, ×2)
    }
    ctx.save(); ctx.beginPath(); ctx.rect(-400, 0, 1900, 1002); ctx.clip();    // behind the counter: cut flat at its top
    at(C0.x, C0.y, 0, CL.s, CL.s, () => person({ outfit: C.orange, wax: true, waxCols: WAX, face: 'smile', arms, hair: 'short', blink: Math.floor(ts * 15) % 41 === 0, look: held ? .4 : 0 }));
    ctx.restore();
  }
  function s6_drawGroup(t, T, n) {
    const G = s6_group(t, T); if (G.gone) return;
    s6_withGroup(G, () => {
      const ts = tw(t);
      hp_footprints(STEPS, prog(ts, T.venir, T.venir + .6), { n: 6, size: .72, alpha: .8 });
      const C0 = s6_client(t, T); if (C0.on) s6_drawClient(t, T, C0);
      at(COUNTER.x, COUNTER.y, 0, 1, 1, () => {
        hp_counter(COUNTER.w);
        const hw = COUNTER.w / 2;                                             // the cream body reads on the cream table: shade + cut edge
        const g = ctx.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, 'rgba(60,32,12,.20)'); g.addColorStop(1, 'rgba(60,32,12,0)');
        ctx.fillStyle = g; ctx.fillRect(-hw, 22, COUNTER.w, 60);
        ctx.strokeStyle = 'rgba(120,86,50,.42)'; ctx.lineWidth = 2.5; ctx.strokeRect(-hw + 1, 1, COUNTER.w - 2, 218);
      });
      if (t >= T.colis) {                                                     // the parcel, now in the client's hands
        const hp = s6_heldPose(t, T), p = Object.assign({}, hp_pose(t), { x: hp.x, y: hp.y, s: hp.s, r: hp.r, sx: 1, sy: 1, alpha: 1, lift: hp.lift, labelPose: null, flaps: 0, tapeK: 1, tapeSnap: 0, label: 'on' });
        hp_drawHero(p, n, { knot: t < T.hold - .12 });
        if (ts >= T.hold) {                                                   // the hands grip its sides (paper discs)
          const hx = 95 * hp.s / HELD.s, w = ts - T.et, waving = w >= 0 && w < 1.1;
          ctx.save(); ctx.fillStyle = SKIN; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 2;
          for (const sd of waving ? [1] : [-1, 1]) { ctx.beginPath(); ctx.arc(hp.x + sd * hx, hp.y + 6, 33 * CL.s, 0, 7); ctx.fill(); ctx.stroke(); }
          ctx.restore();
        }
      }
    });
  }

  // ---------------------------------------------------------------- P6 — the walk up to the door, freeze, KB
  function s6_fr(t, T) {
    const k = eInOutCubic(prog(t, T.ici, T.out1)), z = 1 + .3 * k;
    return { zoom: FR0.zoom * z, fx: lerp(FR0.fx, DOOR[0], k), fy: lerp(FR0.fy, DOOR[1], k), kb: z };
  }
  function s6_rect(t, T) { const d = drift(t, 97, 3), R = hp_deal(t, T.nous, HP_PRINT, 'right', .35); R.x += d.x; R.y += d.y; R.rot += d.r; return R; }
  function s6_drawP6(t, T) {
    if (t < T.nous) return;
    const R = s6_rect(t, T), fr = s6_fr(t, T), src = hp_map(t, [[T.nous, 4.0], [T.ici, 4.8]]);
    hp_printAt(R, 'B2', src, { blend: true, zoom: fr.zoom, fx: fr.fx, fy: fr.fy, lift: R.lift, tape: R.tape, curl: .3 });
  }
  function s6_drawCircle(t, T) {
    if (t < T.ici || t > T.foyer + .3) return;
    const R = s6_rect(t, T), fr = s6_fr(t, T), [cx, cy] = hp_frameToPrint(DOOR[0], DOOR[1], R, fr), z = fr.kb;
    const p = prog(t, T.ici, T.ici + .4), wipe = prog(t, T.foyer, T.foyer + .25);
    ctx.save(); ctx.globalAlpha *= 1 - wipe;
    hp_circle(cx, cy, 158 * z * (1 + .06 * wipe), 280 * z * (1 + .06 * wipe), p * (1 - .6 * wipe), C.orange, 9);
    ctx.restore();
  }

  // ---------------------------------------------------------------- the place tag « FOYER BALENGOU » + the bow
  const PT = { f1: () => font(FF.stencil, 84, 900), f2: () => font(FF.body, 46, 800), l1: 'FOYER BALENGOU', l2: 'Point de retrait' };
  let _ptGeo = null;
  function s6_ptGeo() {
    if (_ptGeo) return _ptGeo;
    const w1 = measure(PT.l1, PT.f1(), 1), w2 = measure(PT.l2, PT.f2()), pin = 50, insW = 22 + pin + 16 + Math.max(w1, w2) + 28;
    const w = Math.max(660, 14 + insW + 72), h = 190;
    return (_ptGeo = { w, h, insW, pin, gx: w / 2 - 34 });
  }
  /** right-end grommet of the place tag, screen coords, for pose {x, y, r, s} */
  function s6_ptGrommet(P) { const g = s6_ptGeo(); return [P.x + g.gx * P.s * Math.cos(P.r), P.y + g.gx * P.s * Math.sin(P.r)]; }
  function s6_placePose(t, T) {
    const ts = tw(t), u = ts - T.foyer, d = drift(t, 103, 1.6);
    let s = 1, lift = 6, a = 1;
    if (u < .2) { const k = eInCubic(clamp(u / .2)); s = lerp(1.18, 1, k); lift = lerp(44, 6, k); a = clamp(u / .08); }
    else { const v = u - .2; s = 1 - Math.exp(-v * 13) * Math.cos(v * 40) * .03; }
    return { x: PLACE.x + d.x, y: PLACE.y + d.y, r: PLACE.r + d.r, s, lift, a };
  }
  function s6_placeTag(P) {
    const g = s6_ptGeo(), w = g.w, h = g.h, x0 = -w / 2, y0 = -h / 2, c = 46;
    ctx.save(); ctx.globalAlpha *= P.a;
    at(P.x, P.y, P.r, P.s, P.s, () => {
      const body = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w - c, y0); ctx.lineTo(x0 + w, y0 + c); ctx.lineTo(x0 + w, y0 + h - c); ctx.lineTo(x0 + w - c, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath(); };
      withShadow(P.lift, () => { ctx.fillStyle = C.kraftD; body(); ctx.fill(); });
      ctx.fillStyle = TEX.kraft || C.kraft; body(); ctx.fill();
      ctx.save(); body(); ctx.clip(); ctx.strokeStyle = 'rgba(255,240,210,.38)'; ctx.lineWidth = 4; body(); ctx.stroke();
      const gg = ctx.createLinearGradient(0, y0, 0, y0 + h); gg.addColorStop(0, 'rgba(255,240,210,.10)'); gg.addColorStop(1, 'rgba(90,60,30,.12)'); ctx.fillStyle = gg; ctx.fillRect(x0, y0, w, h); ctx.restore();
      const ix = x0 + 14, iy = y0 + 14, iw = g.insW, ih = h - 28;
      withShadow(2, () => { ctx.fillStyle = C.cream; rrect(ix, iy, iw, ih, 9); ctx.fill(); });
      ctx.save(); rrect(ix, iy, iw, ih, 9); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(ix, iy, iw, ih);
      const lg = ctx.createLinearGradient(0, iy, 0, iy + ih); lg.addColorStop(0, 'rgba(255,255,255,.2)'); lg.addColorStop(1, 'rgba(150,110,60,.06)'); ctx.fillStyle = lg; ctx.fillRect(ix, iy, iw, ih); ctx.restore();
      // perforation between the insert and the grommet end
      ctx.save(); ctx.strokeStyle = 'rgba(90,60,30,.42)'; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ix + iw + 12, y0 + 22); ctx.lineTo(ix + iw + 12, y0 + h - 22); ctx.stroke(); ctx.restore();
      f1_pinGlyph(ix + 22 + g.pin / 2, 4, 1.45, C.orange);
      const tx = ix + 22 + g.pin + 16;
      text(PT.l1, tx, 8, { font: PT.f1(), color: C.ink, ls: 1 });
      text(PT.l2, tx + 2, 64, { font: PT.f2(), color: C.inkSoft });
      f1_grommet(g.gx, 0, 15, 7);
      ctx.fillStyle = C.tape; at(x0 + 40, y0 + 6, -.62, 1, 1, () => ctx.fillRect(-52, -17, 104, 34));   // taped down, top-left
    });
    ctx.restore();
  }
  /** the violet thread dropping from tab 06 down the right margin to the place tag, then the bow */
  function s6_bow(t, T, n, tTop) {
    if (t < T.bal) return;
    const P = s6_placePose(t, T), Gm = s6_ptGrommet(P), Tp = hp_tabGrommet(5, tTop);
    const kT = eInOutCubic(prog(t, T.bal, T.bal + .42)), kB = prog(tw(t), T.bal + .38, T.bal + .62);
    const sway = Math.sin(t * 1.9) * 4;
    const ctrl = [Tp, [Tp[0] + 70, Tp[1] + 90], [1004 + sway, 430], [996, 760], [968 + sway * .5, 1000], [912, 1112], [Gm[0] + 10, Gm[1] - 6]];
    ctx.save(); ctx.globalAlpha *= .92; thread(curve(ctrl, 10), kT, n, { w: 6 }); ctx.restore();
    if (kB <= 0) return;
    const s = kB >= 1 ? 1 : eOutBack(kB, 2), [kx, ky] = Gm;
    at(kx, ky, -.1, s, s, () => {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const loops = () => {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-64, -62, -88, 4, 0, 0);
        ctx.moveTo(0, 0); ctx.bezierCurveTo(64, -58, 92, 8, 0, 0);
        ctx.moveTo(0, 0); ctx.quadraticCurveTo(-14, 30, -34, 62);
        ctx.moveTo(0, 0); ctx.quadraticCurveTo(16, 34, 26, 70);
      };
      ctx.translate(3, 5); ctx.strokeStyle = 'rgba(60,20,90,.22)'; ctx.lineWidth = 9; loops(); ctx.stroke(); ctx.translate(-3, -5);
      ctx.strokeStyle = C.violet; ctx.lineWidth = 6; loops(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 9]); loops(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, -.3, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-3, -3, 4, 3, -.3, 0, 7); ctx.fill();
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- hero registrations (§2.4, §2.5)
  hp_keys('s6', () => { const T = s6_T(); return [{ t: T.fb, dur: T.fb - T.fa, x: HERO_C.x, y: HERO_C.y, s: HERO_C.s, r: 0 }]; });
  hp_states('s6', t => {
    const T = s6_T(), ts = tw(t), f = hp_followHero(t, 's6');
    const o = { visible: t < T.colis, breathe: 1, dx: 0, dy: 0, lift: 0, sxMul: 1, syMul: 1, dr: 0 };
    if (t < T.fb) o.dr = -.06 * (1 - f.k);                                    // s5 left it turned toward the camera
    if (f.on) { o.dr += f.tilt; o.sxMul = f.sx; o.syMul = f.sy; o.lift = 30 * Math.sin(Math.PI * f.k); }
    const u = ts - T.fb; if (u >= 0 && u < .5) { const q = .06 * Math.exp(-u * 11) * Math.cos(u * 38); o.sxMul = 1 + q; o.syMul = 1 - q * .8; }   // lands on the counter
    return o;
  }, .4);
  hp_mood('s6', () => { const T = s6_T(); return [{ kind: 'peek', t0: T.venir + .1, dir: [-1, .35], hold: .55 }]; });   // looks at who is coming
  hp_anchor('s6', t => {
    const T = s6_T(); if (t < T.colis) return null;                          // the hero (on the counter) holds the thread
    if (t >= T.hold - .12) return false;                                      // picked up: the thread lets go (§2.5)
    const G = s6_group(t, T), hp = s6_heldPose(t, T), k = f1_heroPt({ x: hp.x, y: hp.y, s: hp.s, sx: 1, sy: 1, r: hp.r }, HP_HERO.knot[0], HP_HERO.knot[1]);
    return s6_gpt(G, k[0], k[1]);
  });
  hp_badgePos('s6', 380, 380);                                                               // §1.6 (default, stated)
  hp_ripple(() => W_('Q5', 'retrait'));
  hp_tick(5, () => W_('Q5', 'retrait'));

  // ---------------------------------------------------------------- sound (§6)
  function s6_cues(T) {
    // ≤ 2 SFX per 0.3 s (§1.10): the 6 soft stamp ticks and the 3 paper footsteps are one cue each
    hp_sfx('footprint_ticks_x6', T.venir); hp_sfx('paper_steps_x3', T.recup + .02);
    hp_sfx('thup', T.hold); hp_sfx('check_tick', T.hold + .2); hp_sfx('paper_slide', T.nous);
    hp_sfx('marker_squeak', T.ici); hp_sfx('paper_slap', T.foyer + .2);   // the place tag is taped down (no pin)
    hp_sfx('string_zip', T.bal); hp_sfx('cloth_squeak', T.bal + .5); hp_sfx('whoosh_soft', T.out0);
  }

  // ---------------------------------------------------------------- scenes
  const live = t => t >= TL.ch('s6').start - .4 && t < TL.ch('recap').start + .3;
  /** T7 rise-in (follow-drop) + T8 pull-out (scale .6 about (0, 960), slide −900 px) */
  function s6_layer(t, T) {
    ctx.translate(0, hp_followY(t, 's6', 'in'));
    const k = eInOutCubic(prog(t, T.out0, T.out1)); if (k <= 0) return;
    const s = lerp(1, .6, k); ctx.translate(-900 * k, 0); ctx.translate(0, 960); ctx.scale(s, s); ctx.translate(0, -960);
  }
  registerScene({
    id: 's6_back', z: 20, when: live,
    draw(t, n) {
      const T = s6_T(); s6_cues(T); if (t >= T.out1) return;
      ctx.save(); s6_layer(t, T);
      s6_drawGroup(t, T, n);
      s6_drawP6(t, T);
      ctx.restore();
    },
  });
  registerScene({
    id: 's6_front', z: 50, when: live,
    draw(t, n) {
      const T = s6_T(); if (t >= T.out1) return;
      ctx.save(); s6_layer(t, T);
      const ts = tw(t);
      if (t >= T.hold && t < T.nous + .5) {                                   // ✓ the parcel is collected
        const G = s6_group(t, T), k = clamp(pop(ts, T.hold + .2, 18, .45), 0, 1.2); if (!G.gone && k > 0) s6_withGroup(G, () => at(CHECK.x, CHECK.y, -.08, k, k, () => withShadow(6, () => iconCheck(60, C.violetD))));
      }
      s6_drawCircle(t, T);
      if (t >= T.foyer) s6_placeTag(s6_placePose(t, T));
      s6_bow(t, T, n, Math.min(t, T.out0));
      ctx.restore();
    },
  });
})();
