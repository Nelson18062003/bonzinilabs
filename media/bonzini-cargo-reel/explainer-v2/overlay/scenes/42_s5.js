'use strict';
// =============================================================================================
// 42_s5 — S5 · 05 LE DÉCHARGEMENT — package D (prefix s5_) — final_storyboard §3 S5, §2.3 T6 (D's side, beneath C's
// peel) + T7 (outgoing side), §2.4, §2.5, §5.3, §6.
// V07 « Étape cinq : le déchargement. Le conteneur est vidé, et vos colis sont rangés à l’abri, dans l’entrepôt. »
// Q3 « Voilà, très chers clients, nous sommes ici à l’entrepôt de Bonzini Trading Cargo. »
// Q4 « Vos colis ont été déchargés en toute sécurité. »
// V08 « Cartons, sacs, marchandises emballées : tout est rangé en sécurité, en attendant votre passage. »
// One idea: out of the container, into the shelter of our warehouse — and those real cartons are yours.
//   s5_back  (z 20): the container sticker (drop, slide, door flap, slide out), the client cartons (tumble, stack),
//                    the warehouse back wall, P5a (paper → photo flip), P5b + the cut-out stack, the 3 polaroids,
//                    the kraft flakes of the T7 follow-drop.
//   s5_front (z 50): the warehouse walls + roof + logo, the « Entrepôt Bonzini » note tag, DÉCHARGÉ, EN SÉCURITÉ.
//   Hero (drawn by 11_hero): keys / states / moods / anchor registered here. T7 (follow-drop into s6): this file is the
//   OUTGOING side (its layers slide up with hp_followY); 44_s6.js owns the incoming side and the hero's flight.
// Drawn from TL.ch('s5').start − 1.0 so C's T6 peel reveals a live table. Every time is anchored on words or on the
// T6 / T7 boundaries; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  const CS = .72;                                              // client cartons on the table (130×97)
  const CONT0 = { x: 540, y: 1008, s: .63, r: -.03 };           // 5.1 the sticker lands here (y ≈ 742–1228, clear of the captions)
  const CONT1 = { x: 540, y: 735, s: .74, r: -.02 };            // 5.3 slid up, ready to open (y ≈ 420–995)
  const WH = { x: 540, y: 1180, w: 720 };                      // paper warehouse: x 180–900, y 700–1180
  const HERO_ROW = { x: 540, y: 1100, s: .45 }, HERO_STACK = { x: 540, y: 1080, s: .45 };
  const HERO_SIDE = { x: 870, y: 1134, s: .36 };               // beside the note line, right of the NOTE items (x 767–973, texture only)
  const FR_B = { fy: .55 };                                    // P5a / P5b framing
  const NOTE_X = 478, NOTE_Y = 1170;                           // note-line tag, shifted left of NOTE (the hero sits right of it)
  // DÉCHARGÉ is stamped on a torn cream note slip slapped at the note line (stamps on paper, never mid-image — same rule
  // as ARRIVÉ). Slip x 186–740 (clear of the hero at HERO_SIDE and of its lead thread, z 38–40 under this layer),
  // y 1050–1240 (overlaps the print's bottom edge: paper on photo; clear of the caption strip).
  const SLIP = { x: 463, y: 1145, w: 554, h: 190, r: -.02 };
  const DCH = { x: 466, y: 1149, r: -.035 };                   // stamp box (size 100: h 130 + 10 line) y ≈ 1079–1219, x ≈ 222–710
  const SECU = { x: 470, y: 1012, r: -.06 };                   // EN SÉCURITÉ under the row, left of the lead thread
  // client cartons: row after the tumble → back row of the stack (§3 5.4 / 5.5); ord = tumble order
  const CART = [
    { col: 'A', seed: 3, row: [250, 1112, -.05], st: [332, 1000, .03], ord: 0, spin: -1 },
    { col: 'A', seed: 5, row: [372, 1124, .04], st: [452, 994, -.02], ord: 2, spin: -1 },
    { col: 'B', seed: 7, row: [708, 1114, -.03], st: [630, 997, .02], ord: 3, spin: 1 },
    { col: 'B', seed: 9, row: [830, 1124, .05], st: [750, 1004, -.03], ord: 1, spin: 1 },
  ];
  // the right-hand 2-box stack on A 23.8 (measured on foot/up/A/00594.jpg): convex scissor polygon, frame-normalised
  const POLY = [[.495, .385], [.872, .378], [.872, .56], [.812, .772], [.45, .757], [.444, .524]];
  const STRIPS = [{ a: [.47, .462], b: [.895, .447] }, { a: [.425, .655], b: [.835, .642] }];   // violet tape across each box
  // polaroids (§3 5.19–5.22): picture 280×373 + 16 border + 70 caption band
  const POL = [
    { x: 200, y: 600, r: -.06, src: 24.96, kb: [1.18, 1.26], fx: .42, fy: .62, cap: 'cartons', from: 'left', key: 'cartons', delay: .12 },
    { x: 540, y: 570, r: .03, ping: [12.4, 13.6], kb: [1.15, 1.2], fx: .5, fy: .64, cap: 'sacs', from: 'top', key: 'sacs', delay: 0 },
    { x: 880, y: 610, r: .06, src: 19.36, kb: [1.12, 1.2], fx: .55, fy: .3, cap: 'emballées', from: 'right', key: 'march', delay: 0, capKey: 'emb' },
  ];
  const PW = 280, PH = 373;

  // ---------------------------------------------------------------- word anchors (lazy: the timeline loads later)
  let _T = null, _TL = null;
  function s5_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V07', w), T = { s5: TL.ch('s5').start, s6: TL.ch('s6').start };
    T.drop = T.s5 + .1;                                          // 5.1 sticker lands (under the peel) [65.10]
    T.etape = V('Étape'); T.tagOut = hp_after(T.etape, V('conteneur'));   // tag 05 leaves (E) [68.56]
    T.up = T.tagOut;                                             // 5.3 slide up 0.4 s [68.56]
    T.vide = V('vidé');                                          // 5.4 door flap [69.16]
    T.cart = CART.map(c => T.vide + .1 + c.ord * .16); T.cDur = .28;      // tumbles [69.26 …], last lands [70.02]
    T.vos = V('vos'); T.heroDur = .34;                           // hero tumbles out last [69.78 → 70.12]
    T.ranges = V('rangés');                                      // 5.5 sticker out + stack [70.70]
    T.abri = V('abri');                                          // 5.6 warehouse folds up [71.24]
    T.ent = V('entrepôt');                                       // 5.7 logo on the gable [72.08]
    T.hopOut = TL.seg('V07').end + .05; T.hopDur = .42;          // 5.8 hop out [72.75 → 73.17]
    T.q3s = TL.seg('Q3').start; T.q3e = TL.seg('Q3').end;
    T.flip = W_('Q3', 'Voilà');                                  // 5.10 paper → photo flip [73.15]
    T.q3Ent = W_('Q3', 'entrepôt'); T.q3Bon = W_('Q3', 'Bonzini');        // [75.69] [76.41]
    T.q4s = TL.seg('Q4').start; T.q4e = TL.seg('Q4').end;        // [78.65] [82.76]
    T.q4colis = W_('Q4', 'colis'); T.q4ont = W_('Q4', 'ont'); T.dech = W_('Q4', 'déchargés'); T.q4sec = W_('Q4', 'sécurité');
    T.cartons = W_('V08', 'Cartons'); T.sacs = W_('V08', 'sacs'); T.march = W_('V08', 'marchandises'); T.emb = W_('V08', 'emballées');
    T.range = W_('V08', 'rangé'); T.secu = W_('V08', 'sécurité'); T.attend = W_('V08', 'attendant'); T.passage = W_('V08', 'passage');
    [T.fa, T.fb] = hp_followWin('s6');                           // T7 [88.65, 89.35]
    hp_hold('s5 Entrepôt Bonzini', T.q3Ent + .2, T.q4s);
    hp_hold('s5 DÉCHARGÉ', T.dech, T.cartons);
    hp_hold('s5 EN SÉCURITÉ', T.secu, T.fa + .2);
    hp_hold('s5 polaroid captions', T.emb + .45, T.fa + .2);
    _TL = TLD; return (_T = T);
  }
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- the container sticker (hp_container, C)
  /** pose {x, y, s (incl. lift scale), r, lift, flapK} | null once it has left */
  function s5_contPose(t, T) {
    const ts = tw(t), d = drift(t, 51, 2.5);
    let x = CONT0.x, y = CONT0.y, s = CONT0.s, r = CONT0.r, lift = 4;
    if (t < T.drop) { const k = eInCubic(prog(t, T.drop - .24, T.drop)); lift = lerp(30, 4, k); y -= 22 * (1 - k); }
    else { const u = t - T.drop; if (u < .5) s *= 1 + Math.exp(-u * 12) * Math.cos(u * 40) * .035; }
    if (t >= T.up) {
      const k = eInOutCubic(prog(t, T.up, T.up + .4));
      x = lerp(CONT0.x, CONT1.x, k); y = lerp(CONT0.y, CONT1.y, k); s = lerp(CONT0.s, CONT1.s, k); r = lerp(CONT0.r, CONT1.r, k); lift = 4 + 18 * Math.sin(Math.PI * k);
    }
    if (t >= T.ranges) {                                         // slides out left (picked up)
      const k = prog(t, T.ranges, T.ranges + .4); if (k >= 1) return null;
      const e = k * k * (1.4 - .4 * k);
      x = lerp(CONT1.x, -560, e); y = CONT1.y - 30 * Math.sin(Math.PI * e); r = CONT1.r - .22 * eOutCubic(k); lift = 4 + 26 * eOutCubic(clamp(k * 3));
    }
    const flapK = eInOutCubic(prog(ts, T.vide, T.vide + .3));
    return { x: x + d.x, y: y + d.y, s: s * (1 + .05 * clamp(lift / 30)), r: r + d.r, lift, flapK };
  }
  /** sticker-local (px at s 1, origin = centroid) → screen */
  const s5_cpt = (P, lx, ly) => [P.x + (lx * Math.cos(P.r) - ly * Math.sin(P.r)) * P.s, P.y + (lx * Math.sin(P.r) + ly * Math.cos(P.r)) * P.s];
  function s5_drawContainer(t, T) {
    if (t >= T.ranges + .4) return;
    const P = s5_contPose(t, T); if (!P) return;
    hp_container(t, { rect: HP_PRINT, x: P.x, y: P.y, s: P.s, r: P.r, lift: P.lift, liftScale: false, flapK: P.flapK });
    s5_drawInside(t, T, P);
  }
  // the parcels waiting inside the open container (§3 5.4): nearest first out, the hero deepest — it comes out last.
  // Slots = (u across the opening, d into the depth) on the container floor, same perspective as hp_container's interior.
  const INSIDE = [[.24, .3], [.76, .34], [.4, .56], [.63, .6]], HERO_IN = [.5, .82];
  let _s5g = null;
  /** sticker-local floor point (u across, d deep) — mirrors f2_interior's vanishing geometry (kf .62, VP (0, −14)) */
  function s5_floor(u, d) {
    if (!_s5g) _s5g = f2_geom(HP_CONT.quad, HP_PRINT.w, HP_PRINT.h, HP_CONT.fr);
    const [, , BR, BL] = _s5g.pts, kf = .62, f = p => [p[0] * kf, -14 + (p[1] + 14) * kf];
    const near = [lerp(BL[0], BR[0], u), lerp(BL[1], BR[1], u)], fBL = f(BL), fBR = f(BR), far = [lerp(fBL[0], fBR[0], u), lerp(fBL[1], fBR[1], u)];
    return [lerp(near[0], far[0], d), lerp(near[1], far[1], d) - 18];
  }
  const s5_inScale = d => lerp(.36, .24, d);
  function s5_drawInside(t, T, P) {
    if (P.flapK < .3) return;
    const ts = tw(t), g = _s5g || (s5_floor(0, 0), _s5g);
    ctx.save(); ctx.beginPath(); g.pts.forEach(([lx, ly], i) => { const [x, y] = s5_cpt(P, lx, ly); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip();
    ctx.globalAlpha *= clamp((P.flapK - .3) / .3);
    const items = CART.map((c, i) => ({ i, d: INSIDE[c.ord][1] })).concat([{ i: -1, d: HERO_IN[1] }]).sort((a, b) => b.d - a.d);   // far → near
    for (const it of items) {
      if (it.i >= 0) {
        const c = CART[it.i]; if (ts >= T.cart[it.i]) continue;
        const [lx, ly] = s5_floor(...INSIDE[c.ord]), [x, y] = s5_cpt(P, lx, ly), sc = s5_inScale(INSIDE[c.ord][1]) * P.s / .74;
        at(x, y, P.r + c.row[2] * .5, sc, sc, () => hp_clientCarton(180, 135, c.col, c.seed));
      } else if (t < T.vos) {
        const [lx, ly] = s5_floor(...HERO_IN), [x, y] = s5_cpt(P, lx, ly), b = hp_pose(t);
        hp_drawHero(Object.assign({}, b, { x, y, s: .2 * P.s / .74, r: P.r - .04, sx: 1, sy: 1, alpha: 1, lift: 2, labelPose: null, flaps: 0, tapeK: 1, tapeSnap: 0, label: 'on' }), 0);
      }
    }
    ctx.fillStyle = 'rgba(20,10,4,.18)'; ctx.fillRect(-100, -100, 1300, 2200);          // the parcels sit in the container's shade
    ctx.restore();
  }

  // ---------------------------------------------------------------- client cartons: tumble out → row → stack
  /** carton i pose at t: {x, y, r, s, lift} | null (still inside) */
  function s5_cart(i, t, T) {
    const c = CART[i], ts = tw(t), t0 = T.cart[i], t1 = t0 + T.cDur;
    if (ts < t0) return null;
    if (ts < t1) {
      const P = s5_contPose(t0, T), [sx, sy] = s5_cpt(P, ...s5_floor(...INSIDE[c.ord])), k = (ts - t0) / T.cDur, e = eOutCubic(k);
      const s0 = s5_inScale(INSIDE[c.ord][1]) * P.s / .74;
      return { x: lerp(sx, c.row[0], e), y: lerp(sy, c.row[1], e) - 170 * Math.sin(Math.PI * k), r: lerp(P.r + c.row[2] * .5, c.row[2], e) + c.spin * 1.6 * Math.sin(Math.PI * k),
        s: lerp(s0, CS, eOutCubic(clamp(k * 1.25))) * (1 + .22 * Math.sin(Math.PI * k)), lift: 30 * Math.sin(Math.PI * k) };
    }
    let x = c.row[0], y = c.row[1], r = c.row[2], s = CS, lift = 0;
    const u = ts - t1; if (u < .4) { const q = Math.exp(-u * 13) * Math.cos(u * 40) * .07; s *= 1 + q; }
    const a = T.ranges + .02 + c.ord * .04, k = prog(ts, a, a + .3);
    if (k > 0) { const e = eInOutCubic(k); x = lerp(c.row[0], c.st[0], e); y = lerp(c.row[1], c.st[1], e) - 60 * Math.sin(Math.PI * k); r = lerp(c.row[2], c.st[2], e); lift = 18 * Math.sin(Math.PI * k); }
    return { x, y, r, s, lift };
  }
  function s5_drawCartons(t, T) {
    CART.map((c, i) => ({ i, p: s5_cart(i, t, T) })).filter(q => q.p).sort((a, b) => a.p.y - b.p.y).forEach(({ i, p }) => {
      const c = CART[i];
      if (p.lift > 1) { ctx.save(); ctx.globalAlpha *= .22 * clamp(p.lift / 30); ctx.fillStyle = C.shadow + '1)'; ctx.beginPath();
        ctx.ellipse(p.x + p.lift * .5, p.y + 40 + p.lift * 1.2, 70 * p.s / CS, 22 * p.s / CS, 0, 0, 7); ctx.fill(); ctx.restore(); }
      at(p.x, p.y, p.r, p.s, p.s, () => hp_clientCarton(180, 135, c.col, c.seed));
    });
  }

  // ---------------------------------------------------------------- the warehouse + paper → photo flip
  /** horizontal flip of the warehouse group about x 540: 1 → 0 on twos (0.2 s), then it is a photo */
  function s5_flipW(t, T) { const k = prog(tw(t), T.flip, T.flip + .2); return Math.cos(k * Math.PI / 2); }
  function s5_whK(t, T) { return prog(tw(t), T.abri, T.abri + .35); }
  function s5_withFlip(t, T, fn) {
    const sx = s5_flipW(t, T); if (sx <= .01) return;
    ctx.save(); ctx.translate(540, 0); ctx.scale(sx, 1); ctx.translate(-540, 0);
    if (sx < 1) { const lift = Math.sin(Math.PI * (1 - sx)) * 24; ctx.translate(-lift * .2, -lift * .6); }
    fn(sx); ctx.restore();
  }

  // ---------------------------------------------------------------- P5a (Q3) — the warehouse comes back as a photo
  function s5_rectA(t, T) {
    const d = drift(t, 53, 3), k = eInOutCubic(prog(t, T.flip + .2, T.flip + .7));
    const R0 = { x: 540, y: 935, w: 450, h: 600, rot: 0 }, R = hp_rectLerp(R0, HP_PRINT, k);
    return { x: R.x + d.x, y: R.y + d.y, w: R.w, h: R.h, rot: R.rot + d.r, lift: 12 + 22 * (1 - k) };
  }
  function s5_drawP5a(t, T) {
    if (t < T.flip + .2) return null;
    let R = s5_rectA(t, T), tape = t >= T.flip + .78;
    if (t >= T.q4s) { R = hp_out(t, T.q4s, R, 'right', .4); tape = R.tape; if (R.gone) return null; }
    // Source window = the steadiest sharp stretch of A: 18.72 → 19.28 (Laplacian 331–841 at 360 w, camera shift ≤ 7 px
    // per frame pair, so the blend crossfade never ghosts). The old 15.9 → 18.5 crossed a whip pan (16.48–17.20, 43–146)
    // and 17.28 → 18.08 is still a smeared pan (shift 12–28 px/pair). ≈ 0.11×, a slow living photo; a gentle push-in
    // (zoom 1 → 1.06) and the drift keep it moving.
    const sxP = Math.sin(Math.PI / 2 * prog(tw(t), T.flip + .2, T.flip + .4)), src = hp_map(t, [[T.q3s, 18.72], [T.q3e, 19.28]]);
    const fl = hp_flash(t, T.flip + .2, .16, false), kb = lerp(1, 1.06, prog(t, T.flip + .2, T.q4s + .4));
    at(R.x, R.y, R.rot, Math.max(.02, sxP), 1, () => videoPrint('A', src, R.w, R.h, { blend: true, fy: FR_B.fy, zoom: kb, lift: R.lift, tape, flash: fl, curl: .3 }));
    return R;
  }
  /** note-line tag « Entrepôt Bonzini »: kraft luggage tag, cream insert, logo + Bricolage 800 52, orange pin */
  function s5_noteTag(x, y, r, k, o = {}) {
    if (k <= 0) return;
    const f = font(FF.body, 52, 800), str = 'Entrepôt Bonzini', tw_ = measure(str, f), L = 58;
    const insW = 20 + L + 16 + tw_ + 30, w = 66 + insW + 14, h = 128, x0 = -w / 2, y0 = -h / 2;
    const s = .6 + .4 * eOutBack(clamp(k));
    at(x, y, r, s, s, () => {
      ctx.globalAlpha *= clamp(k * 3);
      const body = () => { ctx.beginPath(); ctx.moveTo(x0 + 34, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0 + 34, y0 + h); ctx.lineTo(x0, y0 + h - 34); ctx.lineTo(x0, y0 + 34); ctx.closePath(); };
      withShadow(o.lift ?? 8, () => { ctx.fillStyle = C.kraftD; body(); ctx.fill(); });
      ctx.fillStyle = TEX.kraft || C.kraft; body(); ctx.fill();
      ctx.save(); body(); ctx.clip(); ctx.strokeStyle = 'rgba(255,240,210,.38)'; ctx.lineWidth = 4; body(); ctx.stroke(); ctx.restore();
      const ix = x0 + 66, iy = y0 + 13, iw = insW, ih = h - 26;
      withShadow(2, () => { ctx.fillStyle = C.cream; rrect(ix, iy, iw, ih, 8); ctx.fill(); });
      ctx.save(); rrect(ix, iy, iw, ih, 8); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(ix, iy, iw, ih); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0 + 56, y0 + 16); ctx.lineTo(x0 + 56, y0 + h - 16); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.cream; const lx = ix + 20 + L / 2; ctx.beginPath(); ctx.arc(lx, 0, L / 2 + 4, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(123,34,214,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(lx, 0, L / 2 + 1, 0, 7); ctx.stroke();
      drawLogo(lx, 0, L * .82);
      text(str, ix + 20 + L + 16, 18, { font: f, color: C.ink });
      f1_grommet(x0 + 28, 0, 13, 6);
      pushPin(x0 + 28, 0, C.orange);
    });
  }

  /** the DÉCHARGÉ note slip: slapped on twos (3 poses, 0.2 s) just before Q4·déchargés — dropped from the hand (s 1.14,
   *  lift 34, a little twist), lands with a paper settle; torn top/bottom, cut sides, cream fibres, two amber tape tabs */
  function s5_slip(t, T) {
    const t0 = T.dech - .34, ts = tw(t); if (ts < t0) return;
    const k = prog(ts, t0, t0 + .2), e = eOutCubic(k), u = ts - (t0 + .2);
    const settle = u >= 0 && u < .4 ? 1 + Math.exp(-u * 14) * Math.cos(u * 38) * .02 : 1;
    const s = lerp(1.14, 1, e) * settle, lift = lerp(34, 10, e), r = SLIP.r + lerp(-.075, 0, e);
    const x = SLIP.x + lerp(-36, 0, e), y = SLIP.y + lerp(-30, 0, e), { w, h } = SLIP;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 47, 3, 14), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 59, 3.4, 13);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const q of top) ctx.lineTo(...q); for (const q of bot) ctx.lineTo(...q); ctx.closePath(); };
    at(x, y, r, s, s, () => {
      withShadow(lift, () => { ctx.fillStyle = C.cream; path(); ctx.fill(); });
      ctx.save(); path(); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-w / 2, -h / 2, w, h);
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(120,90,50,.07)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
      f2_fibres(path, .35); f2_edge(path, .5, 1.5);
      ctx.fillStyle = C.tape;
      at(-w / 2 + 18, -h / 2 + 4, -.62, 1, 1, () => ctx.fillRect(-40, -14, 80, 28));
      at(w / 2 - 16, -h / 2 + 6, .5, 1, 1, () => ctx.fillRect(-36, -13, 72, 26));
    });
  }

  // ---------------------------------------------------------------- P5b (Q4) — freeze, scissor cut, the real cartons wear violet
  function s5_rectB(t, T) {
    const d = drift(t, 57, 3), R = hp_deal(t, T.q4s, HP_PRINT, 'left', .35);
    R.x += d.x; R.y += d.y; R.rot += d.r;
    const sw = s5_sweep(t, T); R.x += sw;
    return R;
  }
  /** desk sweep at V08·Cartons: 3 poses on twos, 0.3 s, to the left */
  function s5_sweep(t, T) { const k = Math.ceil(prog(tw(t), T.cartons, T.cartons + .3) * 3 - 1e-6) / 3; return -1180 * eInCubic(clamp(k)) * (k > 0 ? 1 : 0); }
  function s5_drawP5b(t, T) {
    if (t < T.q4s || t >= T.cartons + .32) return;
    const R = s5_rectB(t, T), src = hp_map(tw(t), [[T.q4s, 23.4], [T.q4colis, 23.8]]);
    const fl = hp_flash(t, T.q4colis, .12);
    hp_printAt(R, 'A', src, { fy: FR_B.fy, lift: R.lift, tape: R.tape, flash: fl, curl: .3 });
    if (t < T.q4colis) return;
    const rimK = prog(t, T.q4colis + .08, T.q4colis + .48), lk = eOutCubic(prog(t, T.q4ont, T.q4ont + .3)), lift = 24 * lk;
    const home = hp_stickerHome(POLY, R, FR_B), tk = STRIPS.map((_, i) => Math.ceil(prog(tw(t), T.q4ont + .06 + i * .12, T.q4ont + .26 + i * .12) * 3 - 1e-6) / 3);
    hp_polyCut('A', 23.8, POLY, R, FR_B, rimK, lift, {
      x: home.x - 10 * lk, y: home.y - 16 * lk, r: home.r - .025 * lk, hole: lift > .3,
      over: g => s5_tapes(g, tk),
    });
  }
  /** two violet tape strips pulled across the lifted stack (sticker-local), pulled on twos */
  function s5_tapes(g, tk) {
    const fl = (nx, ny) => { const l = f2_frameLocal(nx, ny, HP_PRINT.w, HP_PRINT.h, FR_B); return [l[0] - g.c[0], l[1] - g.c[1]]; };
    STRIPS.forEach((S, i) => {
      const k = tk[i]; if (k <= 0) return;
      const a = fl(...S.a), b = fl(...S.b), L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      at(a[0], a[1], ang - Math.PI / 2, 1, 1, () => {
        withShadow(3, () => f1_violetTape(0, 0, L * k, 36, 61 + i * 7, { cleanTop: false }));
      });
    });
  }

  // ---------------------------------------------------------------- V08 polaroids
  function s5_polT(p, T) { return T[p.key] + (p.delay || 0); }
  function s5_polPose(p, i, t, T) {
    const t0 = s5_polT(p, T), R0 = { x: p.x, y: p.y, w: PW, h: PH + 70, rot: p.r };
    const R = hp_deal(t, t0, R0, p.from, .35, { twos: true });
    const d = drift(t, 71 + i * 3, 2.2);
    const k = spring(Math.max(0, tw(t) - T.range - i * .05), 16, .5), row = { x: 200 + 340 * i, y: 600, rot: 0 };
    return { x: lerp(R.x, row.x, k) + d.x, y: lerp(R.y, row.y, k) + d.y, rot: lerp(R.rot, row.rot, k) + d.r, lift: R.lift + 14 * Math.sin(Math.PI * clamp(k)) * (k < 1 ? 1 : 0), tape: R.tape, t0 };
  }
  function s5_drawPolaroids(t, T, part = 'paper') {
    POL.forEach((p, i) => {
      const t0 = s5_polT(p, T); if (t < t0) return;
      const R = s5_polPose(p, i, t, T), kb = lerp(p.kb[0], p.kb[1], prog(t, t0, t0 + 5.5));
      let src = p.src, blend = false;
      if (p.ping) { const L = p.ping[1] - p.ping[0], u = Math.max(0, t - t0) * .5, m = u % (2 * L); src = p.ping[0] + (m < L ? m : 2 * L - m); blend = true; }
      const dev = hp_develop(t, t0 + .12, .42), wk = prog(t, (p.capKey ? T[p.capKey] : t0 + .4), (p.capKey ? T[p.capKey] : t0 + .4) + .45);
      at(R.x, R.y, R.rot, 1, 1, () => {          // (x, y) = picture centre (§3 5.19: paper y ≈ 397–873)
        if (part === 'paper') videoPrint('A', src, PW, PH, { border: 16, caption: ' ', tape: R.tape ? 'top' : false, lift: R.lift, zoom: kb, fx: p.fx, fy: p.fy, blend, develop: dev, curl: .2 });
        else if (wk > 0) handText(p.cap, 0, PH / 2 + 16 + 50, 48, { write: wk, color: C.ink, pen: wk < 1 });
      });
    });
  }

  // ---------------------------------------------------------------- hero registrations (§2.4, §2.5)
  hp_keys('s5', () => {
    const T = s5_T(), P = s5_contPose(T.vos, T), [x0, y0] = s5_cpt(P, ...s5_floor(...HERO_IN));
    return [
      { t: T.vos, x: x0, y: y0, s: .2 * P.s / .74, r: P.r - .04, lift: 2, ease: 'step' },             // deepest inside the open container
      { t: T.vos + T.heroDur, x: HERO_ROW.x, y: HERO_ROW.y, s: HERO_ROW.s, r: 0, ease: 'out', twos: true },   // tumbles out last [70.12]
      { t: T.ranges + .1 },
      { t: T.ranges + .4, x: HERO_STACK.x, y: HERO_STACK.y, s: HERO_STACK.s, r: -.01, twos: true },   // front of the stack
      { t: T.hopOut },
      { t: T.hopOut + T.hopDur, x: HERO_SIDE.x, y: HERO_SIDE.y, s: HERO_SIDE.s, r: .03, twos: true },  // hops out [73.17]
    ];
  });
  hp_states('s5', t => {
    const T = s5_T(), o = { visible: t >= T.vos };
    if (t < T.vos) return o;
    const ts = tw(t);
    const sq = (u, amp) => { if (u < 0 || u > .5) return; const q = amp * Math.exp(-u * 11) * Math.cos(u * 38); o.sxMul = 1 + q; o.syMul = 1 - q * .8; };
    o.dy = 0; o.lift = 0; o.sxMul = 1; o.syMul = 1; o.dr = 0; o.breathe = 1;
    const k1 = (ts - T.vos) / T.heroDur;                                                       // tumble: arc + lift
    if (k1 >= 0 && k1 < 1) { o.dy = -190 * Math.sin(Math.PI * k1); o.lift = 50 * Math.sin(Math.PI * k1); o.dr = .5 * Math.sin(Math.PI * k1); }
    sq(ts - T.vos - T.heroDur, .07);
    const k2 = (ts - T.ranges - .1) / .3; if (k2 >= 0 && k2 < 1) { o.dy = -30 * Math.sin(Math.PI * k2); o.lift = 14 * Math.sin(Math.PI * k2); }
    const k3 = (ts - T.hopOut) / T.hopDur;                                                     // hop out over the wall
    if (k3 >= 0 && k3 < 1) { o.dy = -150 * Math.sin(Math.PI * k3); o.lift = 40 * Math.sin(Math.PI * k3); o.dr = .12 * Math.sin(Math.PI * k3); }
    sq(ts - T.hopOut - T.hopDur, .06);
    if (t >= T.attend) o.breathe = 2;                                                          // 5.24 it waits for you
    if (t >= T.passage) o.dr = -.06 * eInOutCubic(prog(t, T.passage, T.passage + .4));
    return o;
  }, 1.0);
  hp_mood('s5', () => {
    const T = s5_T();
    return [{ kind: 'peek', t0: T.flip + .25, dir: [-1, -.5], hold: .9 },                     // looks at the warehouse photo
      { kind: 'nod', t0: T.q3Bon },
      { kind: 'peek', t0: T.q4ont + .1, dir: [-1, -.7], hold: .5 },                            // « vos colis »: those are like me
      { kind: 'nod', t0: T.q4sec },
      { kind: 'hop', t0: TL.ch('s6').start - .45 }];                                          // launches the T7 follow-drop [88.55]
  });
  hp_badgePos('s5', 380, 380);                                                               // §1.6 (default, stated)
  hp_anchor('s5', t => {
    const T = s5_T(); if (t >= T.vos) return null;                                           // the hero holds the thread again
    const P = s5_contPose(t, T); if (!P) return null;
    const pt = hp_contPt(.34, .246, P);                                                       // on the container's roof edge
    if (t > T.vos - .16) { const k = eInOutCubic(prog(t, T.vos - .16, T.vos)), K = hp_knot(T.vos); return [lerp(pt[0], K[0], k), lerp(pt[1], K[1], k)]; }
    return pt;
  });

  // ---------------------------------------------------------------- sound (§6)
  function s5_cues(T) {
    hp_sfx('cardboard_thud', T.drop); hp_sfx('paper_slide', T.up); hp_sfx('flap_fold', T.vide + .04);
    // ≤ 2 SFX per 0.3 s (§1.10): the four landings are logged as two double thumps
    hp_sfx('thup_x2', T.vide + .1 + T.cDur + .08); hp_sfx('thup_x2', T.vide + .1 + 2 * .16 + T.cDur + .08); hp_sfx('cardboard_thud', T.vos + T.heroDur);
    hp_sfx('paper_slide', T.ranges); hp_sfx('popup_fold', T.abri); hp_sfx('cardboard_creak', T.abri + .2);
    hp_sfx('sticker_slap', T.ent + .08); hp_sfx('card_flip', T.flip + .2);   // (badge pin + mic tap own Q3 − .3 … − .1)
    hp_sfx('pin_click', T.q3Ent + .1); hp_sfx('scissors_snip_x2', T.q4colis + .14);
    hp_sfx('sticker_peel', T.q4ont); hp_sfx('tape_rip', T.q4ont + .16); hp_sfx('paper_slide', T.cartons);
    POL.forEach(p => hp_sfx('marker_write', p.capKey ? T[p.capKey] : s5_polT(p, T) + .4));
    hp_sfx('click_soft', T.range); hp_sfx('click_soft', T.range + .12);   // the row snaps (stamp_thunk follows on « sécurité »)
  }

  // ---------------------------------------------------------------- scenes
  const live = t => t >= TL.ch('s5').start - 1.0 && t < TL.ch('s6').start + .4;
  registerScene({
    id: 's5_back', z: 20, when: live,
    draw(t, n) {
      const T = s5_T(); s5_cues(T);
      ctx.save(); ctx.translate(0, hp_followY(t, 's6', 'out'));     // T7: the s5 table leaves upward
      if (t > T.drop && t < T.drop + .6) hp_flakes(t, T.drop, CONT0.x - 30, CONT0.y + 205, 5, { seed: 41, up: .35, spread: 2.8, alpha: .8 });   // 5.1 landing puff
      if (t < T.flip + .2) {
        s5_withFlip(t, T, () => { const k = s5_whK(t, T); if (k > 0) at(WH.x, WH.y, 0, 1, 1, () => hp_roofFold(k, WH.w, { part: 'back' })); });
        s5_drawContainer(t, T);
        s5_withFlip(t, T, () => s5_drawCartons(t, T));
      }
      const RA = s5_drawP5a(t, T);
      s5_drawP5b(t, T);
      s5_drawPolaroids(t, T);
      if (t > T.fa) hp_flakes(t, T.fa + .05, HERO_SIDE.x - 20, HERO_SIDE.y - 10, 6, { seed: 83 });   // T7: flakes stay behind
      ctx.restore();
    },
  });
  registerScene({
    id: 's5_front', z: 50, when: live,
    draw(t, n) {
      const T = s5_T();
      hp_stamp('DÉCHARGÉ', DCH.x, DCH.y, T.dech - 1, T.dech, { size: 100, rot: DCH.r, color: C.orange, shake: 12 });   // registers (budget, shake, cue)
      hp_stamp('EN SÉCURITÉ', SECU.x, SECU.y, T.secu - 1, T.secu, { size: 100, rot: SECU.r, color: C.violetD, shake: 12 });
      ctx.save(); ctx.translate(0, hp_followY(t, 's6', 'out'));
      if (t < T.flip + .2) s5_withFlip(t, T, () => { const k = s5_whK(t, T); if (k > 0) at(WH.x, WH.y, 0, 1, 1, () => hp_roofFold(k, WH.w, { part: 'front', logo: prog(tw(t), T.ent, T.ent + .3) })); });
      // note tag rides with P5a (pinned to its bottom edge)
      if (t >= T.q3Ent && t < T.q4s + .45) {
        const RA = s5_rectA(t, T), RO = t >= T.q4s ? hp_out(t, T.q4s, RA, 'right', .4, { sfx: false }) : RA, dx = RO.x - RA.x, dy = RO.y - RA.y;
        s5_noteTag(NOTE_X + dx + RA.x - 540, NOTE_Y + dy + RA.y - 740, -.025 + (RO.rot - RA.rot) * 1.2, clamp(pop(tw(t), T.q3Ent, 16, .45), 0, 1.15), { lift: t >= T.q4s ? 20 : 8 });
      }
      // DÉCHARGÉ on its note slip (both ride the desk sweep with P5b)
      if (t >= T.dech - .34 && t < T.cartons + .32) {
        ctx.save(); ctx.translate(s5_sweep(t, T), 0); s5_slip(t, T);
        if (t >= T.dech - .1) hp_stamp('DÉCHARGÉ', DCH.x, DCH.y, t, T.dech, { size: 100, rot: DCH.r, color: C.orange, shake: 12 });
        ctx.restore();
      }
      if (t >= T.secu - .1) hp_stamp('EN SÉCURITÉ', SECU.x, SECU.y, t, T.secu, { size: 100, rot: SECU.r, color: C.violetD, shake: 12 });
      s5_drawPolaroids(t, T, 'caption');                            // polaroid captions above the lead thread (§2.2)
      ctx.restore();
    },
  });
})();
