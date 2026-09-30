'use strict';
// =============================================================================================
// 74_sign — chapitre « sign » (S17) — signature, boucle vers l'image 0
// « Bonzini Trading Cargo. Payez le juste droit. Ni plus, ni moins. »
//  · début      : on revient au cadrage de l'image 0 (bandes « VOTRE CARTON / A UN PASSEPORT », le carton de Junior au centre)
//                 mais cette fois le passeport vert est là, FERMÉ, avec une fiche vierge : un gros tampon de bois descend
//                 et claque « PRÊT » (choc) — la page manquante du début est retrouvée.
//  · « Bonzini » : les bandes s'envolent, carton + passeport reculent en bas (travelling arrière) ; un médaillon papier
//                 pop et le logo s'assemble pièce par pièce (ailes violettes, U ambre, n orange), lumière chaude ;
//                 « Bonzini » lettre par lettre ; « Trading » / « Cargo » tombent sur leur mot.
//  · « Payez »  : bande « PAYEZ LE JUSTE DROIT. » ; « juste » : trait de feutre orange sous JUSTE DROIT.
//  · « Ni »     : bande ambre « NI PLUS, NI MOINS. » qui penche comme une balance sur « plus », puis « moins », et se remet à niveau.
//  · crédits photo discrets en bas ; sous-titres masqués (tout ce qui est dit est écrit en grand).
//  · dernière ½ s (si la tenue est assez longue) : retour exact au cadrage de l'image 0 → la vidéo boucle.
// =============================================================================================
(() => {
  const CH = 'sign', SEG = 'S17';
  const G0 = { x: 436, y: 848 }, G1 = { x: 540, y: 1272, s: .66 };      // group pivot: image-0 layout → end-card layout
  const CART = { x: 540, y: 905, w: 520, h: 380, r: -.05 };               // Junior's carton, exactly as in image 0
  const PASS = { x: 268, y: 846, w: 330, h: 446, r: -.13 };
  const LOGO_AT = { x: 540, y: 404, s: 330 }, NAME_Y = 684, SUB_Y = 764, S1 = { x: 540, y: 884 }, S2 = { x: 540, y: 1014 };
  const CREDITS = ['Photos : BACHELOR45 (Le Sorcier) CC BY 4.0 · gd6d CC BY 2.0', 'migmasat domaine public · roy.luck, foxypar4 CC BY 2.0'];
  let T = null, reg = false;

  function exactAfter(str, after, fb) { const k = nrm(str); for (const w of TL.seg(SEG).words) if (w.s > after && nrm(w.w) === k) return w.s; return fb; }
  function times() {
    const c = TL.ch(CH), w = (k, fb) => TL.wt(SEG, k, fb);
    const o = { c0: c.start, c1: c.end };
    o.B = w('bonzini', c.start + .4); o.Tr = Math.max(w('trading'), o.B + .3); o.Ca = Math.max(w('cargo'), o.Tr + .2);
    o.Pa = Math.max(w('payez'), o.Ca + .2); o.Ju = Math.max(w('juste'), o.Pa + .15); o.Dr = Math.max(w('droit'), o.Ju + .1);
    o.N1 = Math.max(w('ni'), o.Dr + .15); o.Pl = Math.max(w('plus'), o.N1 + .1); o.Mo = Math.max(w('moins'), o.Pl + .2);
    o.MoE = Math.max(TL.we(SEG, 'moins'), o.Mo + .15);
    o.stamp = Math.max(c.start + .34, o.B - .12);                          // just after the tape wipe clears
    o.dolly = Math.max(o.B + .02, o.stamp + .14);
    o.back = o.c1 - o.MoE >= 1.5 ? o.c1 - .5 : null;                         // loop back to image 0 at the very end
    return o;
  }
  const sp = (x, w = 14, z = .35) => x <= 0 ? 0 : spring(x, w, z);

  // ---------------------------------------------------------------------------- the carton + the passport (image-0 coordinates)
  function slip(ink, t) {                                                  // blank « visa » card taped on the passport, stamped PRÊT
    at(0, 96, .12, 1, 1, () => {
      withShadow(4, () => { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-150, -64, 300, 128); });
      ctx.strokeStyle = 'rgba(14,107,78,.3)'; ctx.setLineDash([9, 7]); ctx.lineWidth = 3; ctx.strokeRect(-132, -46, 264, 92); ctx.setLineDash([]);
      ctx.fillStyle = C.tape; at(-146, -58, -.6, 1, 1, () => ctx.fillRect(-34, -12, 68, 24)); at(146, 58, -.6, 1, 1, () => ctx.fillRect(-34, -12, 68, 24));
      if (ink > 0) stampText('PRÊT', 0, 6, font(FF.stencil, 98, 900), DC.green, { box: true, h: 106, boxW: 9, alpha: ink, starve: .45 });
    });
  }
  function group(t, n, ts, kb) {
    const jc = jit(741, n, .6), br = 1 + .008 * Math.sin(ts * 5);
    const hit = t - T.stamp, sq = hit > 0 ? Math.exp(-hit * 12) * Math.sin(hit * 40) * .05 : 0;
    at(CART.x + jc.x, CART.y + jc.y, CART.r + jc.r, 1 + sq, (1 - sq) * br, () => juniorCarton(CART.w, CART.h));
    // passport: at the loop-back it hops back into the carton (on twos)
    const kin = kb > 0 ? eInCubic(prog(stepT(n), T.back, T.back + .36)) : 0;
    if (kin >= 1) return;
    const jp = jit(742, n, .6);
    const x = lerp(PASS.x, CART.x, kin) + jp.x, y = lerp(PASS.y, CART.y - 30, kin) - 120 * Math.sin(Math.PI * kin) + jp.y, s = lerp(1, .2, kin);
    at(x, y, PASS.r + jp.r + kin * 1.4, s * (1 + sq * 1.4), s * (1 - sq * 1.4), () => {
      goodsPassport(PASS.w, PASS.h, 0);
      slip(t >= T.stamp ? 1 : 0, t);
    });
    // ink specks + dust when the stamp hits
    if (hit > 0 && hit < .45) for (let i = 0; i < 9; i++) {
      const a = rnd(i * 4.1) * Math.PI * 2, r = 150 + 170 * eOutCubic(hit / .45);
      ctx.save(); ctx.globalAlpha = .5 * (1 - hit / .45); ctx.fillStyle = i % 3 ? '#FFFDF7' : C.kraftL;
      ctx.beginPath(); ctx.arc(PASS.x + Math.cos(a) * r, PASS.y + 96 + Math.sin(a) * r * .5, 12 + 14 * hit, 0, 7); ctx.fill(); ctx.restore();
    }
  }
  /** big wooden rubber stamp seen from above; h = height (0 = on the paper) */
  function stampTool(h) {
    const s = 1 + .55 * h;
    ctx.save(); ctx.scale(s, s);
    withShadow(8 + 150 * h, () => { ctx.fillStyle = '#6E4C2B'; rrect(-170, -80, 340, 160, 18); ctx.fill(); });
    ctx.fillStyle = TEX.kraft; rrect(-160, -72, 320, 144, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,.25)'; rrect(-160, -72, 320, 20, 10); ctx.fill();
    ctx.fillStyle = DC.green; rrect(-170, 64, 340, 16, 6); ctx.fill();
    withShadow(10 + 40 * h, () => { ctx.fillStyle = C.kraftD; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill(); });
    ctx.fillStyle = C.kraft; ctx.beginPath(); ctx.arc(-6, -6, 52, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-22, -24, 20, 11, -.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------- image-0 title strips (fly off; drop back at the loop)
  function strips0(t, n, ts, kb) {
    const S = [{ txt: 'VOTRE CARTON', x: 506, y: 404, r: -.035, o: { size: 90, seed: 3 } },
               { txt: 'A UN PASSEPORT', x: 588, y: 526, r: .025, o: { size: 90, fill: DC.green, color: DC.yellow, seed: 5 } }];
    S.forEach((s, i) => {
      const ko = prog(ts, T.dolly - .06 + i * .06, T.dolly + .3 + i * .06), eo = ko * ko;
      const ki = kb > 0 ? prog(t, T.back + .08 + i * .05, T.c1 - 1.5 / FPS) : 0, ei = ki > 0 ? eOutBack(ki, 1.4) : 0;
      const off = kb > 0 ? 1 - ei : eo;
      if (off >= 1) return;
      const j = jit(750 + i, n, .8), side = i ? 1 : -1;
      at(s.x + j.x + side * 260 * off, s.y + j.y - 900 * off, s.r + j.r + side * .5 * off, 1, 1, () => strip(s.txt, s.o));
    });
  }

  // ---------------------------------------------------------------------------- end card
  function logoBlock(t, n, ts) {
    const t0 = T.dolly + .08, md = clamp(sp(t - t0, 13, .45), 0, 1.2);
    if (md <= 0) return;
    const bob = Math.sin(t * 2.4) * 5, d = drift(t, 91, 3);
    at(LOGO_AT.x + d.x, LOGO_AT.y + bob + d.y, Math.sin(t * 1.3) * .015, md, md, () => {
      withShadow(18, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(0, 0, 162, 0, 7); ctx.fill(); });
      ctx.strokeStyle = 'rgba(169,71,254,.5)'; ctx.lineWidth = 5; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -Math.floor(n / 2) * 3;
      ctx.beginPath(); ctx.arc(0, 0, 144, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    });
    // the logo assembles itself piece by piece (on twos)
    const from = { wingTop: [-440, -120, -1.1], wingBot: [440, 110, 1.0], amber: [60, -420, .8], orange: [-60, 420, -.8] };
    const order = { amber: 0, wingTop: 1, wingBot: 2, orange: 3 }, off = {};
    for (const k in from) { const kk = clamp(sp(ts - (t0 + .1 + order[k] * .07), 15, .5), 0, 1.25), f = from[k];
      off[k] = [f[0] * (1 - kk), f[1] * (1 - kk), f[2] * (1 - kk), clamp(kk * 3)]; }
    drawLogo(LOGO_AT.x + d.x, LOGO_AT.y + bob + d.y, LOGO_AT.s * (1 + .012 * Math.sin(t * 3)), { offsets: off });
  }
  function nameBlock(t, n) {
    const f = font(FF.brand, 128, 900), word = 'Bonzini', tw = measure(word, f), x0 = 540 - tw / 2, t0 = T.dolly + .28;
    for (let i = 0; i < word.length; i++) {
      const k = clamp(sp(t - t0 - i * .035, 16, .42), 0, 1.3); if (k <= 0) continue;
      const pre = measure(word.slice(0, i), f), lw = measure(word[i], f), j = jit(760 + i, n, .4);
      at(x0 + pre + lw / 2 + j.x, NAME_Y + (1 - clamp(k)) * 40 + j.y, j.r * 2, k, k, () => text(word[i], 0, 0, { font: f, align: 'center', color: C.ink }));
    }
    const sf = font(FF.body, 64, 800), a = 'Trading', b = 'Cargo', gap = measure(' ', sf), wa = measure(a, sf), wb = measure(b, sf), sx = 540 - (wa + gap + wb) / 2;
    for (const [s, x, tt] of [[a, sx, T.Tr], [b, sx + wa + gap, T.Ca]]) {
      const k = clamp(sp(t - tt + .04, 15, .45), 0, 1.2); if (k <= 0) continue;
      at(x, SUB_Y - (1 - clamp(k)) * 50, 0, 1, 1, () => text(s, 0, 0, { font: sf, color: C.violetD, alpha: clamp(k * 2) }));
    }
  }
  function slogan(t, n, ts, which) {
    const s1 = slam(t, T.Pa, 1.7);
    if (which === 1 && s1.a > 0) { const j = jit(771, n, .7), d = drift(t, 93, 3);
      at(S1.x + j.x + d.x, S1.y + j.y + d.y, -.02 + j.r, s1.s, s1.s, () => {
        ctx.globalAlpha *= s1.a;
        const size = 72, f = font(FF.stencil, size, 900);
        strip('PAYEZ LE JUSTE DROIT.', { size, seed: 8, lift: 12 });
        const tot = measure('PAYEZ LE JUSTE DROIT.', f, 3), x0 = -tot / 2 + measure('PAYEZ LE ', f, 3), x1 = x0 + measure('JUSTE DROIT', f, 3);
        const p = eOutCubic(prog(ts, T.Ju, T.Ju + clamp(T.Dr + .15 - T.Ju, .18, .4)));
        if (p > 0) { ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i <= 24; i++) { const k = i / 24; if (k > p) break; const x = lerp(x0 - 6, x1 + 6, k), y = size * .35 + 16 + Math.sin(k * 9) * 2.5 - k * 3; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke(); ctx.restore(); }
      }); }
    const s2 = slam(t, T.N1, 1.8);
    if (which === 2 && s2.a > 0) { const j = jit(772, n, .7), d = drift(t, 94, 3);
      const tilt = -.075 * sp(t - T.Pl) + .15 * sp(t - T.Mo) - .075 * sp(t - T.Mo - .3);   // a balance: plus ↙, moins ↘, level
      at(S2.x + j.x + d.x, S2.y + j.y + d.y, .01 + tilt + j.r, s2.s, s2.s, () => { ctx.globalAlpha *= s2.a; strip('NI PLUS, NI MOINS.', { size: 86, fill: C.amber, seed: 9, lift: 12 }); }); }
  }
  function credits(t) {
    const a = eOutCubic(prog(t, T.Pa + .1, T.Pa + .5)); if (a <= 0) return;
    const f = font(FF.body, 24, 700), w = Math.max(...CREDITS.map(s => measure(s, f))) + 40;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(35,22,41,.72)'; rrect(540 - w / 2, 1456, w, 74, 14); ctx.fill();
    CREDITS.forEach((s, i) => text(s, 540, 1486 + i * 31, { font: f, align: 'center', color: '#FFFDF7' }));
    ctx.restore();
  }
  function decor(t, n) {
    const d = drift(t, 27, 3);
    at(-8 + d.x, 742 + d.y, 0, 1, 1, () => {                                 // same props as image 0
      withShadow(10, () => { ctx.fillStyle = 'rgba(236,160,60,.95)'; ctx.beginPath(); ctx.arc(0, 0, 104, 0, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.fill();
      ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, 47, 0, 7); ctx.fill();
    });
    marker(1004 + d.x * 1.2, 1196 + d.y, 2.35, C.violetD);
    ctx.save(); ctx.fillStyle = 'rgba(251,246,236,.9)';
    for (const [x, y, r, s] of [[150, 1190, .5, 34], [950, 640, -.3, 26], [180, 610, 1.1, 22]]) at(x + d.x, y + d.y, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-s, -s * .4); ctx.lineTo(s, -s * .7); ctx.lineTo(s * .6, s * .6); ctx.lineTo(-s * .8, s * .5); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;
    if (!reg) { reg = true; addShake(T.stamp, 12); addShake(T.Pa, 5); addShake(T.N1, 7); addShake(T.Mo, 4);
      captionHide((tt, p) => !!p && p.seg === SEG); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 20, 5);
    ctx.translate(W / 2 + dr.x, 880 + dr.y); ctx.rotate(dr.r); ctx.translate(-W / 2, -880);
    decor(t, n);

    const kb = T.back != null ? eInOutCubic(prog(t, T.back, T.c1 - 1.5 / FPS)) : 0;
    const kd = eInOutCubic(prog(t, T.dolly, T.dolly + .55)) * (1 - kb);
    ctx.save();
    ctx.translate(lerp(G0.x, G1.x, kd), lerp(G0.y, G1.y, kd)); const gs = lerp(1, G1.s, kd); ctx.scale(gs, gs); ctx.translate(-G0.x, -G0.y);
    group(t, n, ts, kb);
    // the wooden stamp: comes down from above, hits on T.stamp, lifts away (on twos)
    { const a = T.stamp - .24, b = T.stamp + .34;
      if (ts >= a && ts < b) {
        const down = prog(ts, a, T.stamp), up = prog(ts, T.stamp + .05, b);
        const h = ts < T.stamp ? 1 - eInCubic(down) : eInCubic(up);
        const x = PASS.x + 40 + 260 * h * (ts < T.stamp ? 1 : 1.6), y = PASS.y + 96 - 30 - 420 * h;
        at(x, y, PASS.r + .12 + .3 * h, 1, 1, () => stampTool(h));
      } }
    ctx.restore();

    strips0(t, n, ts, kb);

    // end card; at the loop-back each paper piece is plucked off the table (shrinks + spins, on twos)
    const pluck = (i, cx, cy, fn) => {
      const pk = T.back != null ? eInCubic(prog(ts, T.back + i * .025, T.back + .13 + i * .025)) : 0; if (pk >= 1) return;
      if (pk <= 0) return fn();
      at(cx, cy - 60 * pk, (i % 2 ? .45 : -.45) * pk, 1 - pk, 1 - pk, () => { ctx.translate(-cx, -cy); fn(); });
    };
    pluck(0, LOGO_AT.x, LOGO_AT.y, () => logoBlock(t, n, ts));
    pluck(1, 540, NAME_Y, () => nameBlock(t, n));
    pluck(2, S1.x, S1.y, () => slogan(t, n, ts, 1));
    pluck(3, S2.x, S2.y, () => slogan(t, n, ts, 2));
    pluck(4, 540, 1493, () => credits(t));
    ctx.save(); ctx.globalAlpha = .25; lightLeak(prog(t, T.dolly, T.dolly + .9), 11); ctx.restore();
  }

  registerScene({ id: 'sign', z: 44, when: t => TL.in(t, CH, .4, .4), draw });
})();
