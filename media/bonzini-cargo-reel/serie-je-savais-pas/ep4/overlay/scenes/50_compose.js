'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » — composition: camera, draw order, calls the modules when they exist, else fallbacks.
//   engine (lead, validated): T_ table & atmosphere & phone glass (10_table.js), P_ parcel & containers (20_props.js),
//                             PL_ plates (30_plates.js: 'toi' amber, 'honest' steel), K_ margouillat (40_gecko.js + shim)
//   M1 « TA COMMANDE & the fake message »  prefix CM_  (22_commande.js, 34_fake.js)
//   M2 « the real supplier, the call, Bonzini & end »  prefix BZ_  (36_call.js, 70_bonzini.js, 76_end.js)
//   TY type (60_type.js)
// Read serie/ep4/MODULES.md for the exact APIs. Fallbacks are plain but readable (animatic).
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk, easeOut = S.easeOut;
  const has = n => typeof window[n] === 'function';
  const INK = '#1A1426', CREAM = '#FFF6E8', ORANGE = '#FE560D', AMBER = '#F3A745', VIOL = '#7B4BFF', VIOL_D = '#5B2BDF';
  const GREEN = '#1E5A3C', GREEN_D = '#0F3523', MUSTARD = '#D9A21E', HEART = '#FF4766';
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;

  // ------------------------------------------------------------------ helpers
  /** front face of the parcel (world px, before the character transform): {x0, y0, w, h, foot} */
  function parcelFace(P) {
    const s = P.s || 1, sq = Math.max(0, Math.min(.5, P.squash || 0));
    const w = G.pw * s * (1 + .5 * sq), h = G.ph * s * (1 + .22 * sq), yb = P.y + 40 * s + .12 * h * sq;
    return { x0: P.x - w / 2, y0: yb - h, w, h, foot: { x: P.x, y: P.y + 40 * s } };
  }
  S.parcelFace = parcelFace;
  /** the character transform: squash-and-stretch about the foot, rotation, lift z */
  function parcelXf(P) {
    const f = parcelFace(P).foot;
    ctx.translate(f.x, f.y - (P.z || 0)); if (P.rot) ctx.rotate(P.rot); ctx.scale(P.sx || 1, P.sy || 1); ctx.translate(-f.x, -f.y);
  }
  S.parcelXf = parcelXf;
  function heartPath(x, y, r) {
    ctx.moveTo(x, y + r * .9);
    ctx.bezierCurveTo(x - r * 1.3, y + r * .1, x - r * 1.1, y - r * 1.0, x, y - r * .35);
    ctx.bezierCurveTo(x + r * 1.1, y - r * 1.0, x + r * 1.3, y + r * .1, x, y + r * .9); ctx.closePath();
  }
  /** where the 3 hearts sit on the bubble (world, bubble centre (bx, by)) */
  const heartOn = (b, i) => ({ x: b.x + 200 + i * 66, y: b.y + 118 });

  // ------------------------------------------------------------------ fallbacks (animatic)
  const FB = {
    parcelShadow(P, L) {
      if (P.mode === 'glass' || P.mode === 'lens' || P.inside) return;
      const f = parcelFace(P).foot, z = P.z || 0, w = G.pw * P.s * (1 + z / 500), d = G.pd * P.s * .55;
      castShadow(() => ctx.ellipse(f.x + 6, f.y - d * .45, w * .6, d * .55, 0, 0, Math.PI * 2), f.x, f.y, z, L, .9);
    },
    parcel(P, t, L) {
      if (has('P_parcel')) { P_parcel({ ...P, z: 0 }, t * 30, L, { noShadow: true, label: 'TA|COMMANDE', ribbon: P.ribbon || 0 }); return; }
      const fc = parcelFace(P); ctx.fillStyle = '#C69C6C'; ctx.fillRect(fc.x0, fc.y0, fc.w, fc.h); ctx.fillStyle = '#E2C08F'; ctx.fillRect(fc.x0 + 10, fc.y0 - fc.h * .5, fc.w - 20, fc.h * .5);
    },
    bzLabel(P, fc, t, L) {
      const k = P.bzLabel, w = fc.w * .5, h = fc.h * .36, x = fc.x0 + fc.w * .72, y = fc.y0 + fc.h * .64;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.04); ctx.scale(.6 + .4 * k, .6 + .4 * k); ctx.globalAlpha *= Math.min(1, k * 2);
      ctx.fillStyle = VIOL; rrect(-w / 2, -h / 2, w, h, 4); ctx.fill(); ctx.fillStyle = CREAM; ctx.font = SAT(Math.max(6, h * .3)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BONZINI', 0, -h * .14); ctx.font = SAT(Math.max(5, h * .2), 700); ctx.fillText('TRADING CARGO', 0, h * .22); ctx.restore();
    },
    bubble(b, t, L) {
      if (b.broken) return;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot || 0); ctx.scale(b.s * b.sx, b.s * b.sy);
      const w = b.w, h = b.h;
      ctx.fillStyle = 'rgba(6,3,14,.5)'; rrect(-w / 2 + 10, -h / 2 + 22, w, h, 46); ctx.fill();
      ctx.fillStyle = '#0B2416'; rrect(-w / 2, -h / 2 + 12, w, h, 46); ctx.fill();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#2C7A52'); g.addColorStop(.5, GREEN); g.addColorStop(1, GREEN_D);
      ctx.fillStyle = g; rrect(-w / 2, -h / 2, w, h, 46); ctx.fill();
      ctx.lineWidth = 9; ctx.strokeStyle = MUSTARD; rrect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 40); ctx.stroke();
      // the tail of a message bubble (a lacquered plate shaped like one — no real app)
      ctx.fillStyle = GREEN_D; ctx.beginPath(); ctx.moveTo(-w / 2 + 70, h / 2 - 4); ctx.lineTo(-w / 2 + 40, h / 2 + 46); ctx.lineTo(-w / 2 + 130, h / 2 - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = MUSTARD; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-w / 2 + 64, h / 2 - 10); ctx.lineTo(-w / 2 + 44, h / 2 + 36); ctx.lineTo(-w / 2 + 118, h / 2 - 10); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.10)'; rrect(-w / 2 + 24, -h / 2 + 18, w - 48, 40, 20); ctx.fill();   // lacquer sheen
      // the text: cream, 3 lines
      ctx.fillStyle = '#FFF3D6'; ctx.font = SAT(62); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      b.lines.forEach((l, i) => ctx.fillText(l, -w / 2 + 52, -h / 2 + 96 + i * 72));
      // blurred account line
      ctx.save(); ctx.font = '700 44px Martian'; ctx.fillStyle = 'rgba(255,243,214,.55)'; ctx.shadowColor = 'rgba(255,243,214,.9)'; ctx.shadowBlur = 10;
      ctx.fillText(b.acct, -w / 2 + 52, h / 2 - 40); ctx.restore();
      // three hearts
      for (let i = 0; i < 3; i++) {
        const k = b.hearts[i]; if (k <= 0) continue; const p = heartOn({ x: 0, y: 0 }, i), sc = (.4 + .6 * S.backOut(k, 3)) * (1 + .25 * b.pulse);
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc); ctx.beginPath(); heartPath(0, 0, 22); ctx.fillStyle = HEART; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#7A0F24'; ctx.stroke(); ctx.restore();
      }
      if (b.crack > 0) {                         // three cracks glowing orange from the top (where the steel hit)
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * .9 + Math.PI; const len = 330 * b.crack;
          ctx.beginPath(); ctx.moveTo(0, -h / 2 + 10); let x = 0, y = -h / 2 + 10; for (let j = 1; j <= 6; j++) { x += Math.cos(a) * len / 6 + (rnd(i * 9 + j) - .5) * 40; y += Math.sin(a) * len / 6 * .7; ctx.lineTo(x, y); }
          ctx.strokeStyle = 'rgba(255,90,20,.45)'; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = '#FFD2A0'; ctx.lineWidth = 3.5; ctx.stroke(); }
      }
      ctx.restore();
    },
    pill(pq, t) {                                // « « TON FOURNISSEUR » ? » → peels → « PAS TON FOURNISSEUR »
      const k = pq.peel;
      if (k > 0) TY.pill(pq.x, pq.y, pq.under, ORANGE, CREAM, pq.a * Math.min(1, k * 2), 48);
      if (k < 1) { ctx.save(); ctx.translate(pq.x - 200 * k, pq.y - 60 * k); ctx.rotate(-.5 * k); ctx.globalAlpha *= 1 - k;
        const w = TY.pill(0, 0, pq.label, '#3B2A10', '#F6E3A8', pq.a, 44, { border: MUSTARD }); ctx.restore(); }
    },
    fx(t, L) {                                   // shards + the 3 hearts falling and rolling to the margouillat (slow motion)
      const b = S.bubble(t); if (!b || !b.broken) { if (t < A.shatter) return; }
      const sl = S.slow(t, A.shatter), B = G.bubble;
      if (t < A.rule) for (let i = 0; i < 14; i++) {         // shards
        const x0 = B.x + (rnd(i * 3.1) - .5) * B.w * .9, y0 = B.y + (rnd(i * 5.7) - .5) * B.h * .8, vx = (rnd(i * 7.3) - .5) * 260, vy = -120 - 200 * rnd(i * 2.2);
        const yy = Math.min(1380, y0 + vy * sl + 900 * sl * sl), xx = x0 + vx * sl, a = 1 - kk(sl, .8, 1.2);
        if (a <= 0) continue; ctx.save(); ctx.globalAlpha *= a; ctx.translate(xx, yy); ctx.rotate(sl * 4 * (rnd(i) - .5));
        ctx.fillStyle = i % 2 ? GREEN : '#2C7A52'; ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(24, -20); ctx.lineTo(10, 22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = MUSTARD; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      }
      for (let i = 0; i < 3; i++) {                           // hearts → rest by the margouillat; heart 0 is gulped
        if (i === 0 && t >= A.gulp + .02) continue;
        if (t >= A.cont) continue;
        const p0 = heartOn(B, i), p1 = G.heartRest[i], k = Math.min(1, sl / (1.1 + .25 * i)), e = S.ease(k);
        let x = S.lerpv(p0.x, p1.x, e), y = S.lerpv(p0.y, p1.y, e) - Math.sin(Math.PI * k) * 160 * (1 - k * .5);
        if (i === 0 && t >= A.gulp - .15 && typeof K_mouth === 'function') { const m = K_mouth(t), q = kk(t, A.gulp - .15, A.gulp); x = S.lerpv(x, m.x, q); y = S.lerpv(y, m.y, q); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(k < 1 ? sl * 5 : 0); ctx.beginPath(); heartPath(0, 0, 22); ctx.fillStyle = HEART; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#7A0F24'; ctx.stroke(); ctx.restore();
      }
    },
    ring(t, L) {                                 // the phone rings: drawn waves from the right edge, towards TOI's plate
      for (const r of A.ring) {
        const k = kk(t, r, r + .9); if (k <= 0 || k >= 1) continue;
        ctx.save(); ctx.strokeStyle = AMBER; ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++) { const kj = kk(k, j * .15, .7 + j * .1); if (kj <= 0 || kj >= 1) continue;
          ctx.globalAlpha = (1 - kj) * .9; ctx.lineWidth = 10 - 5 * kj; ctx.beginPath(); ctx.arc(1110, G.toi.y - 40, 60 + 330 * kj, Math.PI * .72, Math.PI * 1.28); ctx.stroke(); }
        ctx.restore();
      }
    },
    container(C, t, L, inside) {
      const k = C.k, f = t * 30;
      ctx.save(); ctx.globalAlpha *= C.a;
      ctx.translate(C.x, C.y); ctx.scale(k, k); ctx.translate(-540, -1000);
      if (has('P_container')) P_container({ x: 540, y: 1000, z: C.z || 0, tilt: 0, id: C.id }, f, L, { glass: C.glass, inside: inside ? (cx, cy, w, h) => inside() : null });
      else { ctx.fillStyle = 'rgba(123,75,255,.5)'; ctx.fillRect(440, 1000 - 294, 200, 294); if (inside) inside(); }
      ctx.restore();
    },
    bzPlate(st) {
      ctx.save(); ctx.translate(st.x, st.y); ctx.scale(st.sx, st.sy);
      ctx.fillStyle = 'rgba(10,4,30,.4)'; rrect(-420 + 10, -100 + 22, 840, 200, 30); ctx.fill();
      ctx.fillStyle = '#3A1A9A'; rrect(-420, -100 + 12, 840, 200, 30); ctx.fill();
      const g = ctx.createLinearGradient(0, -100, 0, 100); g.addColorStop(0, '#9474FF'); g.addColorStop(1, VIOL_D); ctx.fillStyle = g; rrect(-420, -100, 840, 200, 30); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,246,232,.55)'; rrect(-404, -84, 808, 168, 22); ctx.stroke();
      drawLogo(-318, 0, 124);
      ctx.fillStyle = CREAM; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = SAT(96); ctx.fillText('BONZINI', -236, 8); ctx.font = SAT(56); ctx.fillText('TRADING CARGO', -234, 72);
      if (st.sweep > 0 && st.sweep < 1) { const x = -500 + 1000 * st.sweep, gr = ctx.createLinearGradient(x - 80, 0, x + 80, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); rrect(-420, -100, 840, 200, 30); ctx.clip(); ctx.fillStyle = gr; ctx.fillRect(-420, -100, 840, 200); ctx.restore(); }
      ctx.restore();
    },
  };

  // ------------------------------------------------------------------ the parcel, in one call (shadow, body, Bonzini label)
  function drawParcel(P, t, L) {
    if (!P || !P.vis) return;
    if (has('CM_pose')) P = CM_pose(P, t) || P;        // M1 may refine the character's acting (hops, squash-stretch)
    if (P.mode !== 'glass' && P.mode !== 'lens') has('CM_parcelShadow') ? CM_parcelShadow(P, t, L) : FB.parcelShadow(P, L);
    ctx.save(); parcelXf(P);
    has('CM_parcel') ? CM_parcel(P, t, L) : FB.parcel(P, t, L);
    if (P.bzLabel > 0) has('BZ_onParcel') ? BZ_onParcel(P, parcelFace(P), t, L) : FB.bzLabel(P, parcelFace(P), t, L);
    ctx.restore();
  }

  registerScene({ id: 'compose', z: 10, draw(t, n) {
    // QA (stage 3): the motion-blur sub-frames of frame 0 sample t < 0, where no text exists yet and the glass print is
    // not stamped: frame 0 came out with a half-transparent hook card and a doubled pill. The film starts AT the THOK.
    t = Math.max(0, Math.min(t, T.end - 1e-4));
    window.__t = t;
    const f = t * 30, L = S.light(t), cam = S.camera(t);
    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    // 1 — the shop counter at night: wax cloth under the bulb (the violet brand light from A.violet on)
    if (has('T_table')) T_table(f, L, cam); else { ctx.fillStyle = '#140C26'; ctx.fillRect(-80, -80, W + 160, H + 160); }
    // 2 — the margouillat (bottom-left), then what lies on the cloth (hearts, letters, shards that came to rest)
    const g = S.gecko(t);
    if (has('K_gecko')) K_gecko(t, L, g); else { ctx.fillStyle = '#e8743b'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 22, 64, .4, 0, 7); ctx.fill(); }
    if (has('CM_fx')) CM_fx(t, L, 'under');
    // 3 — the brand: the violet-glass container (the parcel inside it is drawn through the glass)
    const P = S.parcel(t), C = S.container(t);
    if (C) {
      const M = ctx.getTransform();
      const inside = P.inside ? () => { ctx.save(); ctx.setTransform(M); drawParcel(P, t, L); ctx.restore(); } : null;
      has('BZ_container') ? BZ_container(C, t, L, inside) : FB.container(C, t, L, inside);
    }
    // 4 — the fake message (flat lacquered plate on the cloth) and its pill
    const b = S.bubble(t);
    if (b) has('CM_bubble') ? CM_bubble(b, t, L) : FB.bubble(b, t, L);
    // 5 — TOI's amber plate (flat on the cloth)
    const tp = S.toiPlate(t);
    if (tp) has('BZ_toi') ? BZ_toi(tp, t, L) : PL_plate('toi', tp, t, L);
    // 6 — TA COMMANDE on the cloth (a box standing up: over the flat plates)
    if (P.vis && !P.inside && P.mode !== 'glass' && P.mode !== 'lens') drawParcel(P, t, L);
    // 7 — the sender's sticker on the bubble (before the steel: when the real supplier stamps the fake, he covers its
    //     « « TON FOURNISSEUR » ? » too — QA: drawn after it, the sticker sat on top of « JE N'AI RIEN CHANGÉ. »)
    const pq = S.pillQ(t);
    if (pq) has('CM_fake') ? CM_fake(pq, t, L) : FB.pill(pq, t);
    // 8 — the honest steel plate stamping the bubble (while it hovers high it is drawn in the hero pass, step 12)
    const sp = S.supPlate(t), spLow = sp && sp.z < 60;
    if (spLow) has('BZ_sup') ? BZ_sup(sp, t, L) : PL_plate('honest', sp, t, L);
    // 8b — the fall of the fake (cracks glow, shards, letters & hearts rolling, the sticker peeling, FAUX MESSAGE)
    has('CM_fx') ? CM_fx(t, L, 'over') : FB.fx(t, L);
    // 9 — the call (ring waves), the Bonzini scene (tag, enamel plate)
    has('BZ_call') ? BZ_call(t, L) : FB.ring(t, L);
    if (has('BZ_scene')) BZ_scene(t, L);
    const ec = S.endcard(t); if (ec && has('BZ_end')) BZ_end(ec, t, L, 'world');
    // 10 — speaker pills, shop label (world type), then the parcel on the phone glass (closest to us)
    if (has('TY_world')) TY_world(t, L);
    if (P.vis && (P.mode === 'glass' || P.mode === 'lens')) drawParcel(P, t, L);
    ctx.restore();
    // 11 — screen space: the dust print on the phone glass (hook), the air, then type
    if (t < A.glassOff && has('T_glassLayer')) {
      // 10_table's glass layer is keyed to the loop's frames (hit at f4, faded by f88) and sized for a parcel at ×3.4 on
      // (540, 880): remap our hook onto those frames and scale the print to our parcel (×G.lens.s) on G.lens
      const fr = 4 + (t < .2 ? t * 30 : 6 + 78 * kk(t, .2, A.glassOff)), k = G.lens.s / 3.4 * cam.s;
      T_build(); const gl = T_glassLayer(Math.round(Math.min(87, fr)));
      const lx = (G.lens.x - cam.cx) * cam.s + cam.cx + cam.sx, ly = (G.lens.y + 30 - cam.cy) * cam.s + cam.cy + cam.sy;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen';
      ctx.translate(lx, ly); ctx.scale(k, k); ctx.translate(-540, -880); ctx.drawImage(gl, 0, 380); ctx.restore();
    }
    if (has('T_atmos')) T_atmos(f, L);
    // 12 — hero pass (inside the camera, over the air): the plates that hover high in the dark top of the frame stay bright
    const bp = S.bzPlate(t);
    if ((sp && !spLow) || bp) {
      ctx.save(); ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
      if (sp && !spLow) has('BZ_sup') ? BZ_sup(sp, t, L) : PL_plate('honest', sp, t, L);
      if (bp) has('BZ_plate') ? BZ_plate(bp, t, L) : FB.bzPlate(bp);
      ctx.restore();
    }
    if (ec && has('BZ_end')) BZ_end(ec, t, L, 'screen');
    if (has('TY_draw')) TY_draw(t, L);
  } });
})();
