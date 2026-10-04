'use strict';
// =============================================================================================
// « PAS REÇU. » — composition: camera, draw order, calls the modules (T_ table, PL_ plates, LX_ letters & fx,
// RC_ receipt, K_ gecko, TY_ type). Any module not loaded yet falls back to simple blocks.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G;
  const has = n => typeof window[n] === 'function';
  const FB = {
    steel: '#8C96A6', amber: '#F3A745', proof: '#8C96A6', violet: '#7B4BFF',
    plate(kind, st, label) {
      const h = G.plateH[kind] || 200, w = 720;
      ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.rot || 0); ctx.scale((st.s || 1) * (st.sx || 1), (st.s || 1) * (st.sy || 1)); ctx.globalAlpha = st.a ?? 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-w / 2 + 14, -h / 2 + 18, w, h);
      ctx.fillStyle = FB[kind]; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = kind === 'amber' ? '#2A1606' : '#FFF6E8'; ctx.font = `900 ${Math.round(h * .55)}px Satoshi`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 4); ctx.restore();
    },
  };

  registerScene({ id: 'compose', z: 10, draw(t) {
    const f = t * 30, L = S.light(t), cam = S.camera(t);
    ctx.save();
    ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    // 1 — the shop counter at closing time: wax cloth under the bulb (violet brand light from the rewind on)
    if (has('T_table')) T_table(f, L, cam); else { ctx.fillStyle = '#140C26'; ctx.fillRect(-80, -80, W + 160, H + 160); }
    // 2 — the margouillat, then the loose letters on the cloth
    const g = S.gecko(t);
    if (has('K_gecko')) K_gecko(t, L, g); else { ctx.fillStyle = '#e8743b'; ctx.beginPath(); ctx.ellipse(G.gecko.x, G.gecko.y, 22, 64, .4, 0, 7); ctx.fill(); }
    if (has('LX_under')) LX_under(t, L);          // letters on the table (behind the plates)
    // 3 — the plates, back to front: amber (bottom of the pile), proof, violet/receipt, steel on top
    const A = S.amber(t), P = S.proofPlate(t), V = S.violetPlate(t), St = S.steel(t);
    if (A) has('PL_plate') ? PL_plate('amber', A, t, L) : FB.plate('amber', A, A.txt);
    if (P) has('PL_plate') ? PL_plate('proof', P, t, L) : FB.plate('proof', P, P.txt);
    const receiptOnTop = V && t >= S.T.settle + .6;  // « REÇU ✓ » comes down over the receipt while it slides to the corner     // once pinned, the receipt sits on the amber plate, in front of everything
    if (V && !receiptOnTop) has('RC_draw') ? RC_draw(V, t, L) : FB.plate('violet', V, V.unfold > .5 ? 'PREUVE DE PAIEMENT' : 'BONZINI PAIE');
    if (St) has('PL_plate') ? PL_plate('steel', St, t, L) : FB.plate('steel', St, St.lost >= 3 ? 'REÇU' : St.txt);
    if (receiptOnTop) has('RC_draw') ? RC_draw(V, t, L) : FB.plate('violet', V, 'PREUVE');
    if (has('LX_over')) LX_over(t, L);            // flying letters, sparks, dust, sweat drops over the plates
    if (has('TY_world')) TY_world(t, L);          // speaker pills, day stamps, shop label, the « gars » line
    ctx.restore();
    // 4 — the air, then type (screen space)
    if (has('T_atmos')) T_atmos(f, L);
    if (has('LX_rewind')) LX_rewind(t);           // tape-rewind texture during the rewind
    if (has('TY_draw')) TY_draw(t, L);
  } });
})();
