'use strict';
// =============================================================================================
// Composition: camera, draw order, the steal, the reveal, the brand glass. Calls the modules
// (T_ table, P_ props, H_ hands, K_ gecko); falls back to grey blocks for any module not loaded yet.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G;
  const has = n => typeof window[n] === 'function';
  const kk = S.kk, ease = S.ease, easeOut = S.easeOut;

  // ---------- fallbacks (animatic look) ----------
  function fbBox(x, y, z, w, d, h, roof, face) {
    ctx.fillStyle = face; ctx.fillRect(x - w / 2, y - z - h, w, h);
    ctx.fillStyle = roof; ctx.fillRect(x - w / 2, y - z - h - d, w, d);
  }
  const fb = {
    table(f, L) { ctx.fillStyle = '#140C26'; ctx.fillRect(-60, -60, W + 120, H + 120);
      const g = ctx.createRadialGradient(L.x, POOL_Y, 40, L.x, POOL_Y, POOL_R); g.addColorStop(0, `rgba(243,167,69,${.5 * L.on})`); g.addColorStop(1, 'rgba(243,167,69,0)');
      ctx.fillStyle = g; ctx.fillRect(-60, 300, W + 120, 1500); },
    container(c, f, L, o) { fbBox(c.x, c.y, c.z, G.cw, G.cd, G.ch, o.glass > .5 ? '#7a52ff' : lit('#7f8aa0', c.x, c.y, L, 1), o.glass > .5 ? '#5a32df' : lit('#4d5466', c.x, c.y, L, -1));
      if (o.inside && o.glass > .5) o.inside(c.x, c.y - c.z - G.ch / 2, G.cw * .7, G.ch * .8); },
    parcel(p) { fbBox(p.x, p.y, 0, G.pw * p.s * (1 + (p.squash || 0)), G.pd * p.s, G.ph * p.s * (1 - (p.squash || 0)), '#C79E6C', '#9C7447'); },
    arm(side, h) { const sh = G.shoulder[side]; ctx.strokeStyle = side === 'L' ? '#2f6b3a' : '#5a5a1f'; ctx.lineWidth = 92; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo(sh.x, (sh.y + h.y) / 2, h.x, h.y); ctx.stroke();
      const r = 62 * h.s * (1 - h.cuffIn); if (r > 1) { ctx.fillStyle = '#F4EFE6'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 64 * h.s, r, r * 1.2, 0, 0, 7); ctx.fill(); } },
    gecko() { ctx.fillStyle = '#e8743b'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 20, 60, .4, 0, 7); ctx.fill(); },
  };

  // ---------- helpers ----------
  const glassOf = (slot, f) => {        // brand moment: steel → violet glass, swept left to right, back at the relight
    if (f < 360 || f >= 426) return 0;
    const up = easeOut(kk(f, 360 + slot * 3, 370 + slot * 3));
    const down = f < 420 ? 1 : 1 - ease(kk(f, 420 + slot * 1.5, 425));
    return Math.min(up, down);
  };
  const stepOn = (slot, f) => easeOut(kk(f, 372 + slot * 15, 378 + slot * 15));   // the three steps light up on the dings
  const ringPos = (h, f) => has('H_ringPos') ? H_ringPos(h, f) : { x: h.x - 8 * h.s, y: h.y + 66 * h.s };

  // what's seen inside the glass containers (one icon per step)
  function insideIcon(slot, f) {
    return (cx, cy, w, hh) => {
      const on = stepOn(slot, f); if (on <= 0) return;
      ctx.save(); ctx.translate(cx, cy); const sc = .75 + .25 * eOutBack(Math.min(1, on)); ctx.scale(sc, sc);
      ctx.globalAlpha = on; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#FFF4E0'; ctx.fillStyle = 'rgba(255,244,224,.14)';
      if (slot === 0) {          // phone with a tick: « Paiement créé »
        rrect(-28, -46, 56, 92, 12); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-2, 11); ctx.lineTo(15, -12); ctx.stroke();
      } else if (slot === 1) {   // stamped ticket: « Fournisseur réglé »
        rrect(-46, -30, 92, 60, 8); ctx.fill(); ctx.stroke();
        ctx.font = '800 22px Stencil'; ctx.fillStyle = '#F3A745'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RÉGLÉ', 0, 2);
      } else {                   // receipt with lines and a tick: « Preuve de paiement »
        ctx.beginPath(); ctx.moveTo(-30, -44); ctx.lineTo(30, -44); ctx.lineTo(30, 40); for (let i = 0; i < 6; i++) ctx.lineTo(30 - (i + .5) * 10, 40 + (i % 2 ? 0 : 7)); ctx.lineTo(-30, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-18, -26 + i * 14); ctx.lineTo(18 - i * 8, -26 + i * 14); ctx.stroke(); }
        ctx.lineWidth = 7; ctx.strokeStyle = '#F3A745'; ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-1, 29); ctx.lineTo(14, 10); ctx.stroke();
      }
      ctx.restore();
    };
  }

  registerScene({ id: 'compose', z: 10, draw(t) {
    const f = S.fmod(t * 30), L = S.light(f), cam = S.camera(f);
    const P = S.parcel(f), HL = S.hand('L', f), HR = S.hand('R', f), C3 = S.containers(f);
    const slotNow = S.shuffleState(f).slot;

    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);

    // 1 — table, light pool, painted numbers
    has('T_table') ? T_table(f, L, cam) : fb.table(f, L);
    const numOn = f >= 236 && f < 335 ? Math.min(easeOut(kk(f, 238, 246)), 1 - ease(kk(f, 300, 334))) : 0;
    if (has('P_tableNumbers')) P_tableNumbers(f, L, numOn);

    // 2 — the margouillat watches the parcel, then the right sleeve once the parcel has been stolen
    let target;
    if (f < 28) target = { x: P.x, y: P.y };
    else if (f < S.STEAL.slide0) { const c = C3[1]; target = { x: c.x, y: c.y - G.cd / 2 }; }
    else target = S.cuffOf('R', f);
    has('K_gecko') ? K_gecko(f, L, target) : fb.gecko();

    // 3 — arm shadows on the cloth
    const bump = f >= 218 && f < 233 ? Math.sin(Math.PI * kk(f, 218, 233)) : (f >= 233 && f < 466 ? .35 : 0);
    if (has('H_armShadow')) { H_armShadow('L', HL, f, L); H_armShadow('R', HR, f, L, { bump }); }

    // 4 — table objects, back to front
    const items = C3.map(c => ({ y: c.y, draw: () => {
      const slot = slotNow[c.id];
      const o = { glass: glassOf(slot, f), inside: insideIcon(slot, f) };
      has('P_container') ? P_container(c, f, L, o) : fb.container(c, f, L, o);
    } }));
    const big = P.mode === 'hand' && P.s > 1.3;                   // still near the lens: drawn over everything
    if (P.vis && P.mode === 'hand' && !big) items.push({ y: P.y + (P.mode === 'slide' ? -1 : 0), draw: () => has('P_parcel') ? P_parcel(P, f, L, {}) : fb.parcel(P) });
    items.sort((a, b) => a.y - b.y).forEach(i => i.draw());

    // dust puff from the slowly lifted, empty « 2 »
    if (f >= 300 && f < 330 && has('P_dust')) { const c = C3[slotNow.indexOf(1)]; P_dust(c.x, c.y - G.cd * .45, kk(f, 302, 328)); }

    // 5 — arms (the further-back wrist first). The parcel near the lens is drawn after, with the fingertips over it.
    const near = P.vis && (P.mode === 'rise' || P.mode === 'glass' || big);
    const ribbon = f >= 347 && f < 351 ? 1 : 0;
    const arms = [['L', HL, {}], ['R', HR, { bump, ribbon }]].sort((a, b) => a[1].y - b[1].y);
    for (const [side, h, o] of arms) has('H_arm') ? H_arm(side, h, f, L, o) : fb.arm(side, h);
    if (near) {
      has('P_parcel') ? P_parcel(P, f, L, { noShadow: true }) : fb.parcel(P);
      if (has('H_holdFront')) H_holdFront(HR, f, L);
    }
    // the steal: drawn over the glove so it is honestly visible on all 8 frames (screenshot-provable)
    if (P.vis && P.mode === 'slide') has('P_parcel') ? P_parcel(P, f, L, { noShadow: true }) : fb.parcel(P);

    // 6 — the diversion: the ring flashes while the parcel slips away on the other side
    if (f >= 207 && f < 216 && has('P_glint')) { const r = ringPos(HL, f); P_glint(r.x, r.y, f < 210 ? easeOut(kk(f, 207, 210)) : 1 - kk(f, 210, 216)); }
    ctx.restore();

    // 7 — the phone glass, then the air
    if (has('T_glass')) T_glass(f);
    if (has('T_atmos')) T_atmos(f, L);
  } });
})();
