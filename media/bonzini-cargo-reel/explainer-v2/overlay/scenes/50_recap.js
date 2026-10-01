'use strict';
// =============================================================================================
// 50_recap — RECAP · EN RÉSUMÉ — package E (prefix rc_) — final_storyboard §3 RECAP, §2.3 T8 (E's side: the stepper
// lets go, its tabs fall into the recap slots and unfold into tickets) and T9 (whip, recap side), §2.4, §2.5, §6.
// V10 « En résumé : l’achat, le groupage, le transport, l’arrivée, le déchargement… et le retrait. Six étapes, et vos
//       colis arrivent en toute sécurité. »
// One idea: six steps, one thread, and the parcel arrives safely.
//   stepper z 75 : HP_STEPPER.drawUnhook (assigned here) — the thread lets go at its right end, the tabs fall on twos.
//   rc_back  z 20: the six tickets (unfold, flip on each word, checks, highlighter), confetti behind the hero.
//   rc_front z 50: the laced thread (tack → grommets → hero knot), the header strip, the EN TOUTE SÉCURITÉ stamp,
//                  and the hero's recap copy during the T9 whip (the real hero is already rising with the outro).
// Tickets are 600×118 (not 480: « Déchargement » is 389 px at 56 px) on the default slots x 480/600, y 440 + 120·i.
// Every time is anchored on words or on the T8 / T9 boundaries; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  const TK = { w: 600, h: 118, gx: -268 };                     // ticket size; grommet at local (gx, 0)
  const HDR = { x: 540, y: 285, h: 150 };                      // header strip (y 210–360)
  const HERO_L = { x: 172, y: 1125, s: .42 };                  // R1: left of ticket 06, clear of the caption band
  const HERO_C = { x: 540, y: 772, s: 1.0 };                   // R5: centre stage, label readable (y 647–897)
  const STAMP = { dx: 16, dy: 285, rot: -.05 };                // R7: under the label, straddling the lid's lower edge
  const TACK = [60, 176];                                      // the stepper's left tack stays: the lace starts there
  const TITLES = ['Achat', 'Groupage', 'Transport', 'Arrivée', 'Déchargement', 'Retrait'];
  const KEYS = ['achat', 'groupage', 'transport', 'arrivée', 'déchargement', 'retrait'];
  const NUM = ['01', '02', '03', '04', '05', '06'];
  const grid = x => Math.ceil(x * 15 - 1e-6) / 15;             // next on-twos instant (moods + twos keys share it)
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- word anchors (lazy)
  let _T = null, _TL = null;
  function rc_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V10', w), T = { rc: TL.ch('recap').start, out: TL.ch('outro').start };
    T.us = HP_STEPPER.unhookStart(); T.ue = HP_STEPPER.unhookEnd();            // T8 [105.6 → 106.6]
    T.fallDur = .44; T.unf = .2;
    T.fall = NUM.map((_, i) => grid(T.us + .1 + .07 * i));                    // tab i lets go [105.73 … 106.07]
    T.landT = T.fall.map(f => f + T.fallDur);                                 // and lands [106.17 … 106.51]
    T.land = grid(T.rc + .5);                                                 // R1 hero land [106.53]
    T.lace0 = T.landT[0] + .04; T.lace1 = T.land + .5;                        // the lace runs down [106.21 → 107.03]
    T.resume = V('résumé');                                                   // R2 [107.28]
    T.w = KEYS.map(k => V(k));                                                // R3 [108.16 … 112.28]
    T.six = V('Six');                                                         // R4 [113.00]
    T.et = W_('V10', 'et', 1);                                                // « et vos colis » [113.96]
    T.hop0 = hp_after(T.w[5], V('arrivent'));                                 // R5 [114.90]
    T.hop1 = grid(T.hop0 + .42);                                              // flight ends, `land` [115.33]
    T.hdrOut = hp_after(T.six, V('toute'));                                   // R6 [115.44]
    T.secu = V('sécurité');                                                   // R7 [115.66]
    T.whip0 = hp_after(T.secu, T.out - .2); T.whip1 = T.whip0 + .4;           // T9 [117.76 → 118.16]
    hp_hold('recap EN RÉSUMÉ', T.resume, T.six); hp_hold('recap 6 ÉTAPES', T.six, T.hdrOut);
    T.w.forEach((w, i) => hp_hold('recap ticket ' + NUM[i], w, T.hop0)); hp_hold('recap EN TOUTE SÉCURITÉ', T.secu, T.whip0);
    _TL = TLD; return (_T = T);
  }
  /** T9 window, shared with 52_outro (badge, print deal, hero rise) */
  window.rc_whip = () => { const T = rc_T(); return [T.whip0, T.whip1]; };
  /** T9 whip = one rigid camera pan (same curve on both sides, so the recap hero and the outro hero are never on
   *  screen together); the recap layers leave upward */
  window.rc_whipK = t => { const T = rc_T(); return eInOutCubic(prog(t, T.whip0, T.whip1)); };
  const rc_whipDy = (t, T) => -1920 * window.rc_whipK(t);

  // ---------------------------------------------------------------- tickets
  let _fT = null;
  const fTitle = () => (_fT = _fT || font(FF.body, 56, 800));
  /** ticket i pose: slot + hand-placed tilt + drift; R5 slides up and fades (bottom first) */
  function rc_tkPose(i, t, T) {
    const sl = hp_recapSlot(i), d = drift(t, 60 + i * 3, 1.4), r0 = (rnd(i * 3.7 + 1) - .5) * .036;
    const a0 = T.hop0 + .035 * (5 - i), k = eInCubic(prog(t, a0, a0 + .34));
    return { x: sl.x + d.x, y: sl.y + d.y - 80 * k, r: r0 + d.r, a: 1 - k, lift: 6 + 16 * k };
  }
  function rc_tkGrommet(P) { return [P.x + TK.gx * Math.cos(P.r), P.y + TK.gx * Math.sin(P.r)]; }
  /** the ticket body, local origin = centre; o {face 0 blank | 1 titled, i, swipe 0..1, check 0..1, pulse, lift, clipW} */
  function rc_ticket(o) {
    const w = TK.w, h = TK.h, x0 = -w / 2, y0 = -h / 2, i = o.i;
    ctx.save();
    if (o.clipW != null) { ctx.beginPath(); ctx.rect(x0 - 40, y0 - 60, o.clipW + 40, h + 120); ctx.clip(); }
    withShadow(o.lift ?? 6, () => { f1_tagPath(x0, y0, w, h, 30, 10); ctx.fillStyle = C.kraftD; ctx.fill(); });
    f1_tagPath(x0, y0, w, h, 30, 10); ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill();
    ctx.save(); f1_tagPath(x0, y0, w, h, 30, 10); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(255,240,210,.14)'); g.addColorStop(1, 'rgba(90,60,30,.14)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,240,210,.38)'; ctx.lineWidth = 2; f1_tagPath(x0 + 5, y0 + 5, w - 10, h - 10, 26, 7); ctx.stroke();
    // perforation between the grommet end and the insert
    ctx.save(); ctx.strokeStyle = 'rgba(90,60,30,.45)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + 62, y0 + 16); ctx.lineTo(x0 + 62, y0 + h - 16); ctx.stroke(); ctx.restore();
    f1_grommet(x0 + 32, 0, 15, 7);
    // cream insert
    const ix = x0 + 72, iy = y0 + 10, iw = w - 82, ih = h - 20;
    withShadow(1.5, () => { ctx.fillStyle = C.cream; rrect(ix, iy, iw, ih, 8); ctx.fill(); });
    ctx.save(); rrect(ix, iy, iw, ih, 8); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(ix, iy, iw, ih);
    const lg = ctx.createLinearGradient(0, iy, 0, iy + ih); lg.addColorStop(0, 'rgba(255,255,255,.22)'); lg.addColorStop(1, 'rgba(150,110,60,.07)'); ctx.fillStyle = lg; ctx.fillRect(ix, iy, iw, ih);
    ctx.restore();
    text(NUM[i], x0 + 90, 22, { font: font(FF.stencil, 60, 900), color: C.violetD, ls: 1 });
    ctx.fillStyle = 'rgba(156,116,71,.40)'; ctx.fillRect(x0 + 166, -30, 2.5, 60);
    const tx = x0 + 182;
    if (o.face) {
      const tw_ = measure(TITLES[i], fTitle());
      if (o.swipe > 0) {                                                     // 30 % violet highlighter behind the newest title
        const k = clamp(o.swipeK ?? 1), j = (rnd(i * 5.1) - .5) * 3;
        ctx.save(); ctx.globalAlpha *= o.swipe; ctx.fillStyle = 'rgba(169,71,254,.30)'; ctx.beginPath();
        const sx = tx - 10, sy = 20 - 44 + j, sw = (tw_ + 20) * k, sh = 52;
        ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw - 3, sy + sh); ctx.lineTo(sx + 2, sy + sh + 3); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      text(TITLES[i], tx, 20, { font: fTitle(), color: C.ink });
    } else {                                                                 // blank side: a dashed write-on line
      ctx.save(); ctx.strokeStyle = 'rgba(74,58,82,.30)'; ctx.lineWidth = 2.5; ctx.setLineDash([9, 8]);
      ctx.beginPath(); ctx.moveTo(tx, 22); ctx.lineTo(w / 2 - 34, 22); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    if (o.check > 0) hp_check(w / 2 + 20, 4, o.check, 60 * (o.pulse || 1), C.violetD);   // straddles the right edge
  }
  /** unfold after landing: the ticket slides out from under the tab, left anchored (3 poses on twos) */
  function rc_unfold(t, T, i) { const k = prog(tw(t), T.landT[i], T.landT[i] + T.unf); return k >= 1 ? 1 : eOutBack(k, 1.4); }
  function rc_drawTickets(t, T, n) {
    const ts = tw(t);
    for (let i = 0; i < 6; i++) {
      if (ts < T.landT[i]) continue;
      const P = rc_tkPose(i, t, T); if (P.a <= 0) continue;
      const uf = rc_unfold(t, T, i), kf = prog(ts, T.w[i], T.w[i] + .267), face = kf >= .5 ? 1 : 0;
      const sy = Math.max(.05, Math.abs(Math.cos(Math.PI * kf))) * lerp(.8, 1, clamp(uf));
      const nxt = i < 5 ? T.w[i + 1] : T.hop0, swipe = face ? 1 - prog(t, nxt, nxt + .2) : 0, swipeK = eOutCubic(prog(t, T.w[i] + .2, T.w[i] + .36));
      const check = prog(t, T.w[i] + .25, T.w[i] + .5);
      const pu = prog(t, T.six + .05 * i, T.six + .05 * i + .26), pulse = 1 + .32 * Math.sin(Math.PI * pu);
      const lift = P.lift + 18 * Math.sin(Math.PI * kf) + 24 * (1 - clamp(uf));
      ctx.save(); ctx.globalAlpha *= P.a;
      at(P.x, P.y, P.r, 1, sy * (1 + .04 * Math.sin(Math.PI * kf)), () => rc_ticket({ i, face, swipe, swipeK, check, pulse, lift, clipW: uf < 1 ? lerp(174, TK.w, uf) : null }));
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- T8: the stepper lets go (z 75, assigned to HP_STEPPER)
  /** where tab i's hang point lands: its number sits where the ticket's number will be */
  function rc_tabTarget(i) { const sl = hp_recapSlot(i); return [sl.x + TK.gx + 88, sl.y - 72]; }
  function rc_unhook(t, n) {
    const T = rc_T(), P = HP_STEPPER, ts = tw(t), kk = prog(ts, T.us, T.ue);
    // the thread lets go at its right end and swings down from the left tack, then fades (the lace takes over)
    const phi = Math.PI * .48 * eInCubic(clamp(kk * 1.6)), pts = [], at_ = (L, bend) => [P.x0 + Math.cos(phi) * L - Math.sin(phi) * bend, P.y + Math.sin(phi) * L + Math.cos(phi) * bend];
    for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push(at_((P.x1 - P.x0) * u, Math.sin(Math.PI * u) * 30 * (1 - kk))); }
    ctx.save(); ctx.globalAlpha *= 1 - clamp((kk - .45) / .3); thread(pts, 1, n, { w: 7 }); ctx.restore();
    f1_tack(P.x0, P.y, 1);
    const lay = f1_layout(T.us - 1e-3);
    lay.forEach((b, i) => {
      const f0 = T.fall[i], f1 = T.landT[i]; if (ts >= f1 + 2 / 30) return;         // landed: the ticket (z 20) took over
      const L = b.cx - P.x0, hang = at_(L, Math.sin(Math.PI * L / (P.x1 - P.x0)) * 30 * (1 - kk));
      const u = clamp((ts - f0) / T.fallDur), [tx, ty] = rc_tabTarget(i);
      const e = u * u * (1.7 - .7 * u), ex = eInOutCubic(u);
      const x = lerp(hang[0], tx, ex), y = lerp(hang[1], ty, e) - 70 * Math.sin(Math.PI * u) * (1 - u);
      const wob = (rnd(i * 3.3 + 2) - .5) * 1.1, r = wob * Math.sin(Math.PI * u) + (u <= 0 ? .05 * Math.sin(ts * 9 + i) : 0), s = 1 + .14 * Math.sin(Math.PI * u);
      const bb = { ...b, w: lerp(b.w, P.tabW, ex), h: lerp(b.h, P.tabH, ex), open: lerp(b.open, 0, ex), alpha: 1 };
      ctx.save(); ctx.globalAlpha *= ts >= f1 ? .4 : 1;                               // 2-frame cross-fade into the ticket
      at(x, y, r, s, s, () => f1_tabDraw(i, { b: bb, top: P.str, r: 0 }, t, n));
      ctx.restore();
    });
  }
  HP_STEPPER.drawUnhook = (t, n) => rc_unhook(t, n);

  // ---------------------------------------------------------------- the laced thread (tack → six grommets → hero knot)
  function rc_lacePts(t, T) {
    const ts = tw(t), G = [TACK];
    for (let i = 0; i < 6; i++) G.push(rc_tkGrommet(rc_tkPose(i, t, T)));
    const K = hp_knot(t); G.push(K);
    const done = T.w.filter(w => t >= w + .1).length, slack = lerp(1, .35, done / 6);
    const out = [];
    for (let j = 0; j < G.length - 1; j++) {
      const A = G[j], B = G[j + 1], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      let nx = -dy / L, ny = dx / L; if (ny < 0) { nx = -nx; ny = -ny; }
      let sag = (j === 0 ? 22 : 16) * slack;
      for (let q = 0; q < 6; q++) { const a = ts - T.w[q]; if (a >= 0 && a < .5 && (j === q || j === q + 1)) sag += 12 * Math.exp(-a * 7) * Math.sin(a * 34); }   // twitch as ticket q flips
      if (j === G.length - 2) { nx = 0; ny = -1; sag = 34; }                               // last run arcs over the lid to the knot
      const N = Math.max(6, Math.round(L / 22));
      for (let q = (j ? 1 : 0); q <= N; q++) { const u = q / N, off = sag * 4 * u * (1 - u); out.push([A[0] + dx * u + nx * off, A[1] + dy * u + ny * off]); }
    }
    return out;
  }

  // ---------------------------------------------------------------- header strip « EN RÉSUMÉ » → « 6 ÉTAPES »
  let _hdr = null;
  function rc_hdrGeo() {
    if (_hdr) return _hdr;
    const w = Math.round(Math.max(measure('EN RÉSUMÉ', font(FF.stencil, 96, 900), 3), measure('6 ÉTAPES', font(FF.stencil, 110, 900), 3)) + 150), h = HDR.h;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 61, 3.2, 11), right = tornLine(w / 2, -h / 2, w / 2, h / 2, 67, 1.4, 14),
      bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 71, 3.2, 11), left = tornLine(-w / 2, h / 2, -w / 2, -h / 2, 79, 1.4, 14);
    return (_hdr = { w, h, pts: [...top, ...right, ...bot, ...left] });
  }
  function rc_hdrPose(t, T) {
    const ts = tw(t); if (ts < T.resume) return null;
    const u = ts - T.resume, d = drift(t, 77, 1.6);
    let s = 1, lift = 8, a = 1;
    if (u < .2) { const k = eInCubic(clamp(u / .2)); s = lerp(1.14, 1, k); lift = lerp(42, 8, k); a = clamp(.35 + u / .07); }
    else { const v = u - .2; s = 1 - Math.exp(-v * 13) * Math.cos(v * 40) * .025; }
    const kf = prog(ts, T.six, T.six + .267), sy = Math.max(.04, Math.abs(Math.cos(Math.PI * kf)));
    lift += 22 * Math.sin(Math.PI * kf);
    const ko = eInCubic(prog(t, T.hdrOut, T.hdrOut + .34));
    return { x: HDR.x + d.x, y: HDR.y + d.y - 430 * ko, r: -.02 + d.r - .06 * ko, s: s * (1 + .03 * Math.sin(Math.PI * kf)), sy, lift: lift + 30 * ko, a, face: kf >= .5 ? 1 : 0, gone: ko >= 1 };
  }
  function rc_header(P) {
    const g = rc_hdrGeo(), w = g.w, h = g.h, path = () => { ctx.beginPath(); ctx.moveTo(...g.pts[0]); for (const p of g.pts) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.globalAlpha *= P.a;
    at(P.x, P.y, P.r, P.s, P.s * P.sy, () => {
      withShadow(P.lift, () => { path(); ctx.fillStyle = C.cream; ctx.fill(); });
      ctx.save(); path(); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
      const lg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); lg.addColorStop(0, 'rgba(255,255,255,.18)'); lg.addColorStop(1, 'rgba(150,110,60,.08)'); ctx.fillStyle = lg; ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
      ctx.restore();
      if (P.face === 0) text('EN RÉSUMÉ', 0, 35, { font: font(FF.stencil, 96, 900), color: C.ink, align: 'center', ls: 3 });
      else {
        const f = font(FF.stencil, 110, 900), w6 = measure('6 ', f, 3), wa = measure('ÉTAPES', f, 3), x0 = -(w6 + wa) / 2;
        text('6', x0, 40, { font: f, color: C.violetD, ls: 3 }); text('ÉTAPES', x0 + w6, 40, { font: f, color: C.ink, ls: 3 });
      }
      ctx.fillStyle = C.tape; at(-w / 2 + 16, -h / 2 + 6, -.55, 1, 1, () => ctx.fillRect(-50, -17, 100, 34)); at(w / 2 - 16, -h / 2 + 6, .55, 1, 1, () => ctx.fillRect(-50, -17, 100, 34));
    });
    ctx.restore();
  }

  /** the stamp's frame, inked like the rest (starved, multiply) — hp_stamp's own 2-line box sits 35 px too high */
  function rc_stampBox(w, h, cy, a) {
    const c = makeCanvasCached('rc_stampbox', 640, 380), g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 640, 380); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.strokeStyle = C.violetD; g.lineWidth = 10; rrectOn(g, 320 - w / 2, 190 - h / 2, w, h, 20); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .45; g.drawImage(TEX.starve, 0, 0, 640, 380); g.drawImage(TEX.starve, 120, 40, 420, 300);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha *= a; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(c, -320, cy - 190); ctx.restore();
  }

  // ---------------------------------------------------------------- R7: paper confetti from behind the hero (palette only)
  function rc_confetti(t, t0, x, y, n) {
    const s = f1_twos(t) - t0; if (s < 0 || s > 2.1) return;
    const cols = [C.violet, C.amber, C.orange, C.violetD, C.cream, C.kraftL];
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd(i * 1.7 + 3) - .5) * 3.6, v = 900 + rnd(i * 2.3 + 1) * 1100, drag = (1 - Math.exp(-s * 3.2)) / 3.2;
      const r0x = 250 + rnd(i * 6.1) * 60, r0y = 190 + rnd(i * 6.7) * 40;                 // they burst from behind the rim
      const px = x + Math.cos(a) * (r0x + v * drag), py = y + Math.sin(a) * (r0y + v * drag * .85) + 360 * s * s;
      const spin = rnd(i * 5.9) * 6 + s * (rnd(i * 3.1) - .5) * 14, flip = Math.cos(s * (6 + rnd(i * 7.3) * 8) + i), sz = 14 + rnd(i * 8.1) * 13;
      ctx.globalAlpha = clamp((2.1 - s) / .5);
      at(px, py, spin, 1, Math.max(.12, Math.abs(flip)), () => { ctx.fillStyle = cols[i % cols.length];
        if (i % 3) ctx.fillRect(-sz / 2, -sz * .32, sz, sz * .64); else { ctx.beginPath(); ctx.moveTo(-sz * .5, -sz * .3); ctx.lineTo(sz * .45, -sz * .42); ctx.lineTo(sz * .5, sz * .36); ctx.lineTo(-sz * .38, sz * .4); ctx.closePath(); ctx.fill(); } });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- hero registrations (§2.4)
  hp_keys('recap', () => {
    const T = rc_T();
    return [{ t: T.land, x: HERO_L.x, y: HERO_L.y, s: HERO_L.s, r: -.02, lift: 6, ease: 'step' },     // R1 [106.53]
      { t: T.hop0 },
      { t: T.hop1, x: HERO_C.x, y: HERO_C.y, s: HERO_C.s, r: -.02, ease: 'io', twos: true }];          // R5 [114.90 → 115.33]
  });
  hp_states('recap', t => {
    const T = rc_T(), ts = tw(t);
    const o = { visible: ts >= T.land, flaps: 0, tapeK: 1, tapeSnap: 0, label: 'on', labelPose: null, chineK: 1, vousK: 1, contents: null,
      alpha: 1, dx: 0, dy: 0, dr: 0, sxMul: 1, syMul: 1, lift: 0, breathe: 1 };
    const k = (ts - T.hop0) / (T.hop1 - T.hop0);                              // the hop: up toward the lens, then `land`
    if (k >= 0 && k < 1) { const m = lerp(1, 1.25, eOutCubic(k)); o.sxMul = o.syMul = m; o.lift = 40 * eOutCubic(k); o.dy = -120 * Math.sin(Math.PI * k); o.dr = .08 * Math.sin(Math.PI * k); }
    return o;
  }, .5);
  hp_mood('recap', () => {
    const T = rc_T();
    return [{ kind: 'land', t0: T.land }, { kind: 'nod', t0: T.w[5] + .1 },
      { kind: 'peek', t0: T.et, dir: [1, -.7], hold: .3 },                   // « et vos colis » — looks up at the list
      { kind: 'land', t0: T.hop1 }, { kind: 'shiver', t0: T.secu }];
  });

  // ---------------------------------------------------------------- sound (§6; ≤ 2 SFX per 0.3 s, stamps win)
  function rc_cues(T) {
    hp_sfx('paper_flutter_x6', T.fall[0]); hp_sfx('cardboard_thud_light', T.land + .22); hp_sfx('tape_press', T.lace1 - .04);
    hp_sfx('paper_slap', T.resume + .2);
    T.w.forEach(w => { hp_sfx('card_flip', w); hp_sfx('marker_squeak', w + .27); });
    hp_sfx('card_flip', T.six); hp_sfx('tab_ticks', T.six + .1);
    hp_sfx('whoosh_soft', T.hop0); hp_sfx('cardboard_thud', T.hop1 + .22);   // (header leaves silently at R6: thud + stamp win)
    hp_sfx('confetti_paper', T.secu + .3); hp_sfx('whoosh_whip', T.whip0);
  }

  // ---------------------------------------------------------------- scenes
  const live = t => { const T = rc_T(); return t >= T.us - .05 && t < T.whip1 + .05; };
  registerScene({
    id: 'rc_back', z: 20, when: live,
    draw(t, n) {
      const T = rc_T(); rc_cues(T);
      ctx.save(); ctx.translate(0, rc_whipDy(t, T));
      rc_drawTickets(t, T, n);
      if (t >= T.secu) rc_confetti(t, T.secu, HERO_C.x, HERO_C.y + 10, 46);
      ctx.restore();
    },
  });
  registerScene({
    id: 'rc_front', z: 50, when: live,
    draw(t, n) {
      const T = rc_T(), ts = tw(t), dy = rc_whipDy(t, T);
      ctx.save(); ctx.translate(0, dy);
      // the lace (fades with the tickets at R5)
      const la = 1 - prog(t, T.hop0, T.hop0 + .3);
      if (t >= T.lace0 && la > 0) {
        const p = eInOutCubic(prog(t, T.lace0, T.lace1));
        ctx.save(); ctx.globalAlpha *= la * .92; thread(rc_lacePts(t, T), p, n, { w: 6 }); ctx.restore();
        if (p > .97 && t >= T.land) { const h = hp_pose(t); ctx.save(); ctx.globalAlpha *= la; at(h.x, h.y, h.r, h.s * h.sx, h.s * h.sy, () => f1_knotMark(1)); ctx.restore(); }
      }
      if (ts >= T.ue && la > 0) { ctx.save(); ctx.globalAlpha *= la; f1_tack(TACK[0], TACK[1], 1); ctx.restore(); }
      const H = rc_hdrPose(t, T); if (H && !H.gone) rc_header(H);
      // T9: the real hero already rises with the outro — the recap copy leaves with this layer
      if (t >= T.whip0) { const p = Object.assign({}, hp_pose(T.whip0 - 1e-3)); hp_drawHero(p, n); }
      // R7 stamp, printed across the lid's lower edge (below the label, so the label stays readable)
      if (t >= T.secu - .12) {
        const d = drift(t, 7, 3);
        const sx = HERO_C.x + STAMP.dx + d.x, sy = HERO_C.y + STAMP.dy + d.y;
        hp_stamp('EN TOUTE SÉCURITÉ', sx, sy, t, T.secu, { color: C.violetD, size: 96, lines: ['EN TOUTE', 'SÉCURITÉ'], rot: STAMP.rot, shake: 14, from: 1.8, box: false });
        const sl = slam(t, T.secu, 1.8); if (sl.a > 0) at(sx, sy, STAMP.rot, sl.s, sl.s, () => rc_stampBox(446, 230, -8, sl.a));
      }
      ctx.restore();
    },
  });
})();
