'use strict';
// =============================================================================================
// 40_s4 — S4 · 04 L’ARRIVÉE — package C (prefix s4_) — final_storyboard §3 S4, §2.3 T5 + T6 (dive → peel), §2.5, §6.
// V06 « Étape quatre : l’arrivée. Le voici, devant notre entrepôt ! Écoutez notre équipe sur place. »
// Q1 « Voici votre conteneur qui arrive dans notre entrepôt en toute sécurité. »  Q2 « Il sera déchargé ici, dans notre
// entrepôt en toute sécurité. »   One idea: paper becomes real — this is your container, here, for real, safely.
//   s4_back  (z 20): the hero prints — P4 (B 6.0 develops under the paper truck → PAPER → REAL → B 3.62–6.05 synced with Q1,
//                    speed ramp), P4b (blank, mini label, B 9.0 develops, the container is cut out: hole), P4c (B 10.3 → 12.0,
//                    ramp to a freeze on the warehouse door, Ken Burns) and the parked paper truck (from s3) until it flies.
//   s4_front (z 50): note-line items (one at a time: « Notre entrepôt » leaves, ARRIVÉ, « votre conteneur » + arrow, check,
//                    « ici ! » + check), the mini label slap, the container sticker (cut, lift, hover, glide into the door),
//                    the orange arrow, the flying paper truck.
//   s4_dive  (z 72): T6 — the camera dives into the doorway (×3), then the full-screen image peels off (hp_peel) onto s5's
//                    table. It redraws the whole s4 table (and the team badge) so nothing beneath shows through.
//   Lead thread: hp_anchor('s4') = truck label → the real container in P4 → the mini label on P4b → the lifted sticker →
//   the doorway; hidden (false) from the dive.
// Footage (§4): B 6.0 still · B 3.62 → 6.05 · B 9.0 still (HP_CONT, the only AVOID exception) · B 10.3 → 12.0 freeze.
// Every time is anchored on V06 / Q1 / Q2 words; [s] in comments = current timeline (checks only).
// =============================================================================================
(() => {
  if (typeof s3_T !== 'function') { console.error('40_s4 needs 34_s3.js (render --scenes 34_s3,40_s4)'); return; }
  const FR_Q1 = { fy: .62 };                                     // B 3.62 → 6.05 (container codes cropped at the top)
  const FR_C = { zoom: 1.2, fx: .4, fy: .5 };                    // P4c: B 10.3 → 12.0 (container end strip cropped)
  const FR_C0 = { zoom: 1.45, fx: .3, fy: .3 };                  // P4c while dealt: crop x 0–.69, y .04–.56 of the frame (no car front, no people)
  const DOOR = [.366, .42];                                       // the warehouse doorway on B 12.0 (dark gap, measured on up/B/00360.jpg)
  const DOORQ = [[.343, .17], [.392, .17], [.392, .69], [.343, .69]];
  const HOVER = { x: 800, y: 520, s: .48, r: .05 };              // the container sticker waits here during Q2 (× lift scale ≈ s .5)
  const tw = t => f1_twos(t);

  let _T = null, _TL = null;
  function s4_T() {
    if (_T && _TL === TLD) return _T;
    const V = w => W_('V06', w), Q1 = TL.seg('Q1'), Q2 = TL.seg('Q2'), S3 = s3_T(), T = { s0: TL.ch('s4').start, s1: TL.ch('s4').end };
    T.etape = V('Étape'); T.arr = V('arrivée'); T.le = V('Le'); T.voici = V('voici'); T.ent = V('entrepôt'); T.ecoutez = V('Écoutez');
    T.fly0 = T.voici - .04; T.flash = T.voici + .06; T.fly1 = T.voici + .4;     // PAPER → REAL [47.72 → 48.16]
    T.q1 = Q1.start; T.q1e = Q1.end; T.votre = W_('Q1', 'votre'); T.arrive = W_('Q1', 'arrive'); T.q1ent = W_('Q1', 'entrepôt');
    T.toute = W_('Q1', 'toute'); T.secu = W_('Q1', 'sécurité');
    T.lab = T.q1ent + .4; T.dev0 = T.q1ent + .45; T.dev1 = T.dev0 + .7;          // label slap [55.75], develop [55.80 → 56.50]
    T.hov0 = T.q1e; T.hov1 = T.hov0 + .45;                                       // sticker → hover [58.01 → 58.46]
    T.q2 = Q2.start; T.deal4c = Math.max(T.q1e + .05, T.q2 - .35);               // P4c dealt [58.11 → 58.46]
    T.ici = W_('Q2', 'ici'); T.dans = W_('Q2', 'dans'); T.q2s = W_('Q2', 'sécurité'); T.q2e = Q2.end;
    T.frC1 = W_('Q2', 'déchargé'); T.frC0 = Math.min(T.deal4c + .6, T.frC1 - .3);  // P4c tight framing → FR_C [58.71 → 59.48]
    T.slip0 = T.ent - .4; T.slip1 = T.ent - .12;                                  // ARRIVÉ slip laid at NOTE [48.54 → 48.82]
    T.out0 = T.votre - .22; T.out1 = T.votre + .02;                               // … picked up, slides out left [52.55 → 52.79]
    T.arrow0 = T.ici; T.glide0 = T.ici + .2; T.glide1 = T.glide0 + .6;           // orange arrow, glide into the door [60.5 → 61.1]
    T.dive0 = Math.max(T.q2s + .5, T.s1 - 1.06); T.dive1 = T.dive0 + .6; T.peel1 = T.dive1 + .7;   // T6 [63.94 → 64.54 → 65.24]
    T.noteIn = S3.note; T.S3 = S3;
    hp_hold('s4 note', S3.note, T.etape); hp_hold('s4 ARRIVÉ', T.ent, T.out0); hp_hold('s4 scrap', T.votre, T.q1ent);
    hp_hold('s4 label', T.lab, T.q1e); hp_hold('s4 ici', T.ici, T.dive0);
    _TL = TLD; return (_T = T);
  }

  // ---------------------------------------------------------------- framing helpers
  /** framing that zooms a print by kb while keeping frame point D fixed in the print */
  function s4_frKB(base, kb, D, w = HP_PRINT.w, h = HP_PRINT.h) {
    if (kb <= 1.0001) return base;
    const [lx, ly] = f2_frameLocal(D[0], D[1], w, h, base), z = (base.zoom || 1) * kb, s = Math.max(w / 1080, h / 1920) * z, sw = w / s, sh = h / s;
    const sx = D[0] * 1080 - (lx + w / 2) / s, sy = D[1] * 1920 - (ly + h / 2) / s;
    return { zoom: z, fx: (sx + sw / 2) / 1080, fy: (sy + sh / 2) / 1920 };
  }
  const s4_rect = (t, seed) => { const d = drift(t, seed, 3); return { x: HP_PRINT.x + d.x, y: HP_PRINT.y + d.y, w: HP_PRINT.w, h: HP_PRINT.h, rot: HP_PRINT.rot + d.r }; };
  /** warm light leak inside a print picture (x, y, w, h), p 0..1 */
  function s4_leak(p, x, y, w, h, seed = 9) {
    if (p <= 0 || p >= 1) return; const a = Math.sin(p * Math.PI);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const cx = x + w * (rnd(seed + i) * .5 - .2 + p * .9), cy = y + h * (.15 + rnd(seed * 3 + i) * .7), r = w * (.6 + rnd(seed + i * 7) * .5);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r), c = i % 2 ? '254,86,13' : '243,167,69';
      g.addColorStop(0, `rgba(${c},${.42 * a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- P4 (B 6.0 → Q1 B 3.62 … 6.05)
  /** Q1 source time: natural sync from B 3.62, ramp 1 → v2 (0.2 s) on « arrive », reaching B 6.05 on « entrepôt » */
  function s4_srcQ1(t, T) {
    const sa = 3.62 + (T.arrive - T.q1), R = .2, L = Math.max(R + .1, T.q1ent - T.arrive), D = 6.05 - sa;
    const v2 = clamp((D - R / 2) / (R / 2 + L - R), .1, 1);
    if (t < T.arrive) return { s: 3.62 + Math.max(0, tw(t) - T.q1), blend: false };
    const u = t - T.arrive, s = u < R ? sa + u - (1 - v2) * u * u / (2 * R) : sa + R * (1 + v2) / 2 + v2 * (u - R);
    return { s: Math.min(6.08, s), blend: u > R * .4 };
  }
  /** current P4 rect + draw options (null when gone) */
  function s4_p4(t, T) {
    let R = s3_p4Rect(t);
    if (t >= T.q1ent) { R = hp_out(t, T.q1ent, R, 'right', .4); if (R.gone) return null; }
    let clip = 'B', src = 6.0, o = { fy: .40, lift: R.lift ?? 12, tape: R.tape ?? true };
    if (t < T.q1) {
      const dv = t < T.arr ? s3_p4Develop(t) : S3_DEV + (1 - S3_DEV) * hp_develop(t, T.arr, .7);
      const kb = 1 + .08 * eInOutCubic(prog(t, T.voici, T.q1));
      Object.assign(o, s4_frKB({ fy: .40 }, kb, [.5, .38]), { develop: dv, flash: hp_flash(t, T.flash, 2 / 30) });
      o.fr = s4_frKB({ fy: .40 }, kb, [.5, .38]);
      const lk = prog(t, T.arr, T.arr + .8); if (lk > 0 && lk < 1) o.drawOver = (x, y, w, h) => s4_leak(lk, x, y, w, h, 9);
    } else {
      const S = s4_srcQ1(t, T); src = S.s; Object.assign(o, FR_Q1, { blend: S.blend, flash: hp_flash(t, T.q1, 3 / 30) }); o.fr = FR_Q1;
    }
    return { R, clip, src, o };
  }
  /** the real container's point in P4 (lead thread) */
  function s4_p4Pt(t, T, P) {
    const a = hp_frameToPrint(.5, .38, P.R, s4_frKB({ fy: .40 }, 1 + .08 * eInOutCubic(prog(Math.min(t, T.q1), T.voici, T.q1)), [.5, .38]));
    if (t < T.q1) return a;
    const b = hp_frameToPrint(.52, .46, P.R, FR_Q1), k = eInOutCubic(prog(t, T.q1, T.q1 + .3));
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  }

  // ---------------------------------------------------------------- P4b (B 9.0: blank → label → develop → cut → lift)
  function s4_p4b(t, T) {
    if (t < T.q1ent) return null;
    const R0 = s4_rect(t, 43); let R = hp_deal(t, T.q1ent, R0, 'left', .35);
    if (t >= T.hov0) { R = hp_out(t, T.hov0, R0, 'right', .4); if (R.gone) return null; }
    return { R, R0 };
  }
  /** the mini label slapped on the blank print, pose on rect R: slam 1.35 → 1 */
  function s4_labelSlap(t, T, R) {
    const k = prog(t, T.lab - .12, T.lab); if (k <= 0) return;
    const P = hp_contLabelPose(R), u = t - T.lab, sq = u > 0 && u < .4 ? 1 - Math.exp(-u * 14) * Math.cos(u * 40) * .05 : 1;
    const s = P.s * lerp(1.35, 1, eInCubic(k)) * sq;
    ctx.save(); ctx.globalAlpha *= clamp(k * 3); at(P.x, P.y, P.r, s, s, () => hp_labelMini({ lift: lerp(36, 2, k) })); ctx.restore();
  }
  /** the container sticker pose after the lift (null = still at home on P4b) */
  function s4_stickerPose(t, T) {
    if (t < T.hov0) return null;
    const ts = tw(t), B = s4_p4b(T.hov0, T), H = hp_contHome(B.R0);
    if (t < T.glide0) {
      const k = eInOutCubic(prog(t, T.hov0, T.hov1)), bob = Math.floor(t * 15) % 2 ? 2 : -2, up = 40 * Math.sin(Math.PI * k);
      const d = drift(t, 71, 3);
      return { x: lerp(H.x, HOVER.x, k) + d.x * k, y: lerp(H.y, HOVER.y, k) - up + (k >= 1 ? bob : 0) + d.y * k, s: lerp(1, HOVER.s, k), r: lerp(H.r, HOVER.r, k), lift: lerp(30, 26, k), alpha: 1 };
    }
    const k = eInOutCubic(prog(t, T.glide0, T.glide1)), pts = curve(s4_arrowCtrl(t, T), 12), L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const d = L[L.length - 1] * k; let j = 1; while (j < L.length - 1 && L[j] < d) j++;
    const f = clamp((d - L[j - 1]) / Math.max(1e-6, L[j] - L[j - 1])), x = lerp(pts[j - 1][0], pts[j][0], f), y = lerp(pts[j - 1][1], pts[j][1], f);
    return { x, y, s: lerp(HOVER.s, .075, k), r: lerp(HOVER.r, -.1, k), lift: lerp(26, 2, k), alpha: 1 - prog(t, T.glide1 - .12, T.glide1), clip: t > T.glide1 - .22 };
  }
  /** label knot (top of the mini label) on the sticker at pose P (or at home on rect R) */
  const s4_labKnot = (P, R) => hp_contPt(HP_CONT.label.nx, HP_CONT.label.ny - .118, P ? { x: P.x, y: P.y, s: P.s * (1 + .05 * clamp((P.lift || 0) / 30)), r: P.r } : null, R || HP_PRINT);

  // ---------------------------------------------------------------- P4c (B 10.3 → 12.0, freeze on the door, Ken Burns)
  function s4_srcC(t, T) {
    const S0 = 10.34;                                            // first frame shown = up/B/00310 (10.33 s): never the AVOID 6.2–10.3 range
    if (t <= T.q2) return { s: S0, blend: false };
    const R = .2, L1 = Math.max(.1, T.ici - R - T.q2), v = (12.0 - S0) / (L1 + R / 2);
    if (t < T.ici - R) return { s: S0 + v * (tw(t) - T.q2 > 0 ? tw(t) - T.q2 : 0), blend: v < .6 };
    const u = Math.min(R, t - (T.ici - R)); return { s: Math.min(12.0, S0 + v * L1 + v * (u - u * u / (2 * R))), blend: true };
  }
  /** P4c base framing: tight and high while it is dealt (the parked car, its plate area, the passer-by and the moto-taxi stay
   *  out of the crop on B 10.34 → 10.9), tilting down to FR_C by Q2·déchargé, when the camera has turned to the alley */
  function s4_frC(t, T) {
    const k = eInOutCubic(prog(t, T.frC0, T.frC1)); if (k >= 1) return FR_C;
    return { zoom: lerp(FR_C0.zoom, FR_C.zoom, k), fx: lerp(FR_C0.fx, FR_C.fx, k), fy: lerp(FR_C0.fy, FR_C.fy, k) };
  }
  function s4_p4c(t, T) {
    if (t < T.deal4c) return null;
    const R0 = s4_rect(t, 47), R = hp_deal(t, T.deal4c, R0, 'left', .35), kb = 1 + .25 * eInOutCubic(prog(t, T.dans, T.dive0 + .6));
    const fr = s4_frKB(s4_frC(t, T), kb, DOOR), S = s4_srcC(t, T);
    return { R, fr, src: S.s, blend: S.blend };
  }
  const s4_door = (t, T, C_) => hp_frameToPrint(DOOR[0], DOOR[1], C_.R, C_.fr);
  /** the orange arrow: from the hovering sticker's left side, curving into the doorway */
  function s4_arrowCtrl(t, T) {
    const C_ = s4_p4c(Math.max(t, T.deal4c + .4), T), D = s4_door(t, T, C_), sx = HOVER.x - 92, sy = HOVER.y + 40;
    return [[sx, sy], [sx - 70, sy - 70], [D[0] + 70, D[1] - 120], [D[0] + 4, D[1] - 8]];
  }

  // ---------------------------------------------------------------- the paper truck: parked → PAPER → REAL flight
  function s4_truck(t, T) {
    const P = s3_truckRest(t); if (t < T.fly0) return P;
    const k = prog(tw(t), T.fly0, T.fly1), up = clamp(k * 4), e = eInCubic(clamp((k - .15) / .85));
    return { x: lerp(P.x, -620, e) - 10 * up, y: lerp(P.y, 1720, e) - 34 * up, s: P.s * (1 + .07 * up), r: .17 * up + .3 * e, wheel: 0, bob: false, lift: 6 + 26 * up };
  }

  // ---------------------------------------------------------------- note line
  /** torn cream slip (note-line paper) centred at the origin: fibre texture, contact shadow, small amber tape at top-left */
  function s4_slip(w, h, o = {}) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 5 + (o.seed || 0), 3, 14), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 13 + (o.seed || 0), 3, 14);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const q of top) ctx.lineTo(...q); for (const q of bot) ctx.lineTo(...q); ctx.closePath(); };
    withShadow(o.lift ?? 10, () => { ctx.fillStyle = C.cream; path(); ctx.fill(); });
    ctx.save(); path(); ctx.clip(); ctx.fillStyle = f1_cream(); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    ctx.fillStyle = C.tape; at(-w / 2 + 16, -h / 2 + 6, -.55, 1, 1, () => ctx.fillRect(-34, -12, 68, 24));
  }
  function s4_scrap(str, x, y, k, o = {}) {
    if (k <= 0) return; const size = o.size || 60, f = font(FF.hand, size, 800), tw_ = measure(str, f), w = o.w || tw_ + 96, h = o.h || size * 1.75;
    const p = clamp(k * 1.6), wr = o.write ?? clamp((k - .3) / .7), sc = .85 + .15 * eOutBack(p);
    at(x, y, o.rot ?? -.02, sc, sc, () => {
      ctx.globalAlpha *= clamp(k * 4);
      s4_slip(w, h, { seed: o.seed, lift: o.lift });
      handText(str, o.tx || 0, size * .36, size, { color: o.color || C.violetD, write: wr, pen: wr > 0 && wr < 1 });
      if (o.check > 0) hp_check(o.cx, o.cy, o.check, o.checkSize || 80, C.violetD);
    });
  }
  /** ARRIVÉ (V06·entrepôt): a torn cream slip is laid at the note line (on twos), the stamp lands on it — the accent on cream,
   *  never on footage — and slip + stamp are picked up and slide out left just before Q1·votre (one note-line item at a time) */
  const SLIP = { x: 540, y: 1146, w: 500, h: 164, r: -.02 };
  function s4_arrive(t, T) {
    if (t < T.slip0 || t >= T.out1) return;
    const ts = tw(t), e = eOutCubic(prog(ts, T.slip0, T.slip1)), ko = eInCubic(prog(ts, T.out0, T.out1)), u = ts - T.slip1;
    const settle = u > 0 && u < .3 ? Math.exp(-u * 14) * Math.cos(u * 34) * .015 : 0, s = lerp(1.1, 1, e) * (1 - settle) + .04 * ko;
    const x = SLIP.x - 46 * (1 - e) - 440 * ko, y = SLIP.y - 34 * (1 - e) + 26 * ko, r = SLIP.r - .07 * (1 - e) - .12 * ko, lift = lerp(36, 10, e) + 22 * clamp(ko * 3);
    ctx.save(); ctx.globalAlpha *= clamp(prog(ts, T.slip0, T.slip0 + .1) * (1 - prog(ts, T.out0 + .08, T.out1)));
    at(x, y, r, s, s, () => {
      s4_slip(SLIP.w, SLIP.h, { seed: 11, lift });
      hp_stamp('ARRIVÉ', 0, 0, t, T.ent, { size: 96, rot: -.02, color: C.orange, shake: 10 });
    });
    ctx.restore();
  }
  // the caption strip glides 30 px down while the ARRIVÉ slip sits on the note line (its tape stays clear of the slip)
  captionY(t => {
    if (!TLD || !TL.in(t, 's4', 0, 0)) return null; const T = s4_T();
    const k = Math.min(eInOutCubic(prog(t, T.slip0 - .25, T.slip0 + .05)), 1 - eInOutCubic(prog(t, T.out1 - .1, T.out1 + .2)));
    return k > 0 ? 1340 + 30 * k : null;
  });
  /** « Notre entrepôt » (from s3): unpinned on V06·Étape, slides out down-right */
  function s4_noteTag(t, T) {
    const u = prog(tw(t), T.etape + .06, T.etape + .42); if (u >= 1) return;
    const lines = [{ s: 'Notre entrepôt', size: 52 }], f = font(FF.body, 52, 800), w = measure('Notre entrepôt', f) + 150, N = s3_notePose(t), rot = N.r + .16 * eInCubic(u);
    const x = N.x + 760 * eInCubic(u), y = N.y + 160 * eInCubic(u);
    hp_tagNote(lines, x, y, 1, { rot, lift: 8 + 22 * clamp(u * 4), pin: t < T.etape });
    if (t >= T.etape) { const q = prog(t, T.etape, T.etape + .3), gx = N.x + (-w / 2 + 38) * Math.cos(N.r), gy = N.y + (-w / 2 + 38) * Math.sin(N.r);
      if (q < 1) { const s = 1 + .5 * eOutCubic(q); ctx.save(); ctx.globalAlpha *= 1 - eInCubic(q); at(gx + 180 * eInCubic(q), gy - 260 * eInCubic(q), 0, s, s, () => pushPin(0, 0, C.orange)); ctx.restore(); } }
  }

  // ---------------------------------------------------------------- the whole s4 table (layers) — also used by the dive
  function s4_drawBack(t, n, T) {
    const P = s4_p4(t, T); if (P) hp_printAt(P.R, P.clip, P.src, P.o);
    const B = s4_p4b(t, T);
    if (B) {
      const blank = t < T.dev0, dv = hp_develop(t, T.dev0, .7), lk = prog(t, T.dev0, T.dev0 + .9);
      hp_printAt(B.R, HP_CONT.clip, HP_CONT.t, Object.assign({}, HP_CONT.fr, { develop: blank ? 0 : dv, lift: B.R.lift ?? 12, tape: B.R.tape ?? true,
        drawOver: lk > 0 && lk < 1 ? (x, y, w, h) => s4_leak(lk, x, y, w, h, 4) : null }));
      if (t >= T.secu) hp_container(t, { rect: B.R, hole: true, sticker: false });          // the container-shaped hole
    }
    const Cc = s4_p4c(t, T); if (Cc) hp_printAt(Cc.R, 'B', Cc.src, Object.assign({}, Cc.fr, { blend: Cc.blend, lift: Cc.R.lift ?? 12, tape: Cc.R.tape ?? true }));
    if (t < T.fly0) { const K = s4_truck(t, T); at(K.x, K.y, K.r, K.s, K.s, () => { hp_paperTruck(t, { label: true, wheel: 0, bob: K.bob, lift: 8 }); s3_stack(t, K.bob); });
      s3_exhaust(t, K, T.S3.exh0, T.S3.exh1, 1 - prog(t, T.fly0 - .3, T.fly0)); }               // the idle engine keeps puffing until the truck lifts
  }
  function s4_drawFront(t, n, T) {
    const ts = tw(t);
    if (t < T.etape + .5) s4_noteTag(t, T);
    // the paper truck leaves (PAPER → REAL)
    if (t >= T.fly0 && t < T.fly1 + .05) { const K = s4_truck(t, T); at(K.x, K.y, K.r, K.s, K.s, () => { hp_paperTruck(t, { label: true, wheel: 0, lift: K.lift }); s3_stack(t, false); }); }
    if (t >= T.fly0) hp_flakes(t, T.fly0 + .04, 330, 640, 8, { seed: 21, spread: 2.2 });            // kraft flakes where the paper peels off the print
    // ARRIVÉ on its slip (leaves just before Q1·votre)
    s4_arrive(t, T);
    // « votre conteneur » + violet arrow into the container (both ride P4 out)
    const P = s4_p4(t, T);
    if (P && t >= T.votre - .05) {
      const off = [P.R.x - s3_p4Rect(t).x, P.R.y - s3_p4Rect(t).y], k = prog(ts, T.votre, T.votre + .55);
      ctx.save(); ctx.translate(off[0], off[1]);
      const pa = prog(t, T.votre + .25, T.votre + .7), A = (lx, ly) => [P.R.x - off[0] + lx, P.R.y - off[1] + ly];
      hp_arrow([A(70, 360), A(118, 210), A(70, 30), A(18, -92)], pa, C.violetD, 8);
      s4_scrap('votre conteneur', NOTE.x, NOTE.y, k, { size: 60, color: C.violetD, rot: -.02, seed: 3 });
      ctx.restore();
    }
    // P4b: the mini label slaps on the blank print, then the cut, the lift, the check
    const B = s4_p4b(t, T);
    if (B) {
      if (t < T.toute) s4_labelSlap(t, T, B.R);
      else if (t < T.secu) hp_container(t, { rect: B.R, rimK: prog(t, T.toute, T.toute + .35) });
      else if (t < T.hov0) hp_container(t, { rect: B.R, lift: 30 * eOutCubic(prog(t, T.secu, T.secu + .3)) });
      if (t >= T.secu) { const dx = B.R.x - B.R0.x; hp_check(NOTE.x + dx, NOTE.y, prog(ts, T.secu, T.secu + .3), 90); }
    }
    // the orange arrow into the doorway, the sticker hovering / gliding in
    const Cc = s4_p4c(t, T);
    if (t >= T.arrow0 && Cc) { const fa = 1 - prog(t, T.dive0 + .1, T.dive0 + .4);                        // the marker lifts off as the camera dives
      if (fa > 0) { ctx.save(); ctx.globalAlpha *= fa; hp_arrow(s4_arrowCtrl(t, T), prog(t, T.arrow0, T.arrow0 + .4), C.orange, 8); ctx.restore(); } }
    const S = s4_stickerPose(t, T);
    if (S && S.alpha > 0) {
      const clipQ = S.clip && Cc ? DOORQ.map(([x, y]) => hp_frameToPrint(x, y, Cc.R, Cc.fr)) : null;
      hp_container(t, { rect: HP_PRINT, x: S.x, y: S.y, s: S.s, r: S.r, lift: S.lift, alpha: S.alpha, clipQuad: clipQ });
    }
    if (Cc && t >= T.glide1 - .05) s4_puff(t, T, s4_door(t, T, Cc));
    // « ici ! » (+ check on Q2·sécurité); it leaves as the dive starts (0.15 s fade) instead of riding the push under the caption
    const fi = 1 - prog(t, T.dive0, T.dive0 + .15);
    if (t >= T.ici - .05 && fi > 0) { ctx.save(); ctx.globalAlpha *= fi;
      s4_scrap('ici\u202F!', NOTE.x, NOTE.y - 6, prog(ts, T.ici, T.ici + .5), { size: 96, color: C.orange, rot: -.03, w: 470, h: 146, tx: -52, seed: 7, lift: 10 + 14 * (1 - fi),
        check: prog(ts, T.q2s, T.q2s + .25), cx: 150, cy: -6, checkSize: 84, write: clamp(prog(ts, T.ici + .08, T.ici + .43)) });
      ctx.restore(); }
  }
  /** tiny dust puff where the sticker vanished into the doorway */
  function s4_puff(t, T, D) {
    const u = tw(t) - T.glide1; if (u < 0 || u > .5) return;
    ctx.save();
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (rnd(i * 3.3 + 5) - .5) * 2.6, v = 40 + rnd(i * 5.1) * 60, r = (5 + rnd(i * 7.7) * 7) * (1 + u * 2);
      ctx.globalAlpha = .55 * (1 - u / .5); ctx.fillStyle = i % 2 ? '#EDE3D2' : '#D9CCB6';
      ctx.beginPath(); ctx.arc(D[0] + Math.cos(a) * v * u * 2, D[1] + 20 + Math.sin(a) * v * u * 1.4, r, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- lead thread (§2.5)
  function s4_knot(t, T) {
    if (t >= T.dive0) return false;
    if (t < T.flash) { const K = t < T.fly0 ? s3_truckRest(t) : s4_truck(t, T); return s3_truckKnot(K); }
    const P = s4_p4(Math.min(t, T.q1ent + .399), T);
    if (t < T.q1ent) return s4_p4Pt(t, T, P);
    const B = s4_p4b(t, T);
    if (t < T.hov0) {
      const L = s4_labKnot(t >= T.secu ? Object.assign(hp_contHome(B.R), { lift: 30 * eOutCubic(prog(t, T.secu, T.secu + .3)) }) : null, B.R);
      if (t >= T.lab + .05) return L;
      const P2 = s4_p4(t, T), a = P2 ? s4_p4Pt(t, T, P2) : [1300, 700], k = eInOutCubic(prog(t, T.q1ent + .05, T.lab + .05));
      return [lerp(a[0], L[0], k), lerp(a[1], L[1], k)];
    }
    const S = s4_stickerPose(t, T);
    if (t < T.glide1) return s4_labKnot(S, HP_PRINT);
    const Cc = s4_p4c(t, T); return s4_door(t, T, Cc);
  }

  hp_anchor('s4', t => { const T = s4_T(); if (t < T.s0) return null; return s4_knot(t, T); });
  hp_tick(3, () => s4_T().q2s + .26);                                            // slot 4 check [63.7]
  function s4_cues(T) {
    hp_sfx('paper_slide', T.etape + .06); hp_sfx('develop_whirr', T.arr); hp_sfx('music_stop_beat', T.le);
    hp_sfx('reveal_hit', T.voici); hp_sfx('paper_peel_off', T.fly0);
    hp_sfx('marker_write', T.votre + .1); hp_sfx('tape_stop', T.arrive); hp_sfx('instant_eject', T.q1ent);
    hp_sfx('sticker_slap', T.lab); hp_sfx('develop_whirr', T.dev0); hp_sfx('scissors_snip', T.toute); hp_sfx('scissors_snip', T.toute + .18);
    hp_sfx('sticker_peel', T.secu); hp_sfx('marker_squeak', T.secu + .05); hp_sfx('tape_stop', T.ici - .2);
    hp_sfx('marker_write', T.ici + .08); hp_sfx('whoosh_soft', T.glide0); hp_sfx('marker_squeak', T.q2s);
    hp_sfx('whoosh_whip', T.dive0); hp_sfx('room_tone_change', T.dive1);
  }

  // ---------------------------------------------------------------- scenes
  registerScene({
    id: 's4_back', z: 20, when: t => TL.in(t, 's4', 0, 0),
    draw(t, n) { const T = s4_T(); s4_cues(T); if (t < T.dive0) s4_drawBack(t, n, T); },
  });
  registerScene({
    id: 's4_front', z: 50, when: t => TL.in(t, 's4', 0, 0),
    draw(t, n) { const T = s4_T(); if (t < T.dive0) s4_drawFront(t, n, T); },
  });
  // T6 — dive into the doorway (×3, eInCubic) then the full-screen image peels off onto s5's table
  registerScene({
    id: 's4_dive', z: 72, when: t => { if (!TLD) return false; const T = s4_T(); return t >= T.dive0 && t < T.peel1; },
    draw(t, n) {
      const T = s4_T(), Cc = s4_p4c(T.dive0, T), D = s4_door(T.dive0, T, Cc);
      const front = () => {
        ctx.save();
        const tt = Math.min(t, T.dive1), k = eInCubic(prog(tt, T.dive0, T.dive1)), z = lerp(1, 3.4, k) * (1 + .05 * prog(t, T.dive1, T.peel1));   // ×3.4 and door → (540, 880): the picture covers the screen
        ctx.translate(D[0] + (540 - D[0]) * k, D[1] + (880 - D[1]) * k); ctx.scale(z, z); ctx.translate(-D[0], -D[1]);
        ctx.drawImage(TEX.table, 0, 0);
        s4_drawBack(tt, n, T); s4_drawFront(tt, n, T);
        ctx.restore();
      };
      hp_peel(t, T.dive1, T.peel1 - T.dive1, front);
      // the team badge is screen chrome: it stays above the dive and leaves on its own (Q2 end + .3) instead of vanishing under z 72
      const Bd = hp_badgeState(t);
      if (Bd && Bd.k > 0 && Bd.alpha > 0) { const bars = f1_badgeBars(t, n, Bd.run).bars, s = .6 + .4 * Bd.k;
        ctx.save(); ctx.globalAlpha *= Bd.alpha * clamp(Bd.k * 3); at(Bd.x, Bd.y, -.03, s, s, () => hp_badge({ bars, pinK: Bd.pinK, lift: Bd.lift })); ctx.restore(); }
    },
  });
})();
