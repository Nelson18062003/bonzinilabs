'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — M2 part 3: BONZINI (prefix BZ_). Functions only, called by 50_compose.js.
// VIOLET APPEARS ONLY WITH BONZINI: the note on the fiche (34_fiche.js), then here from A.violet. No figure anywhere but
// the fictional code « BZ-482913 » + « EXEMPLE » on the label; the label's address, phones and name are blurred.
// Bonzini = the TRANSPORT (Chine → Douala); the roles band says the order (« la commande ») is TOI's: Bonzini never chooses, checks or
// buys the goods (nothing here touches them).
//
//   BZ_carton(st, t, L)    world. st = SCORE.bigCarton(t): the big carton of the order (oblique, flaps open, kraft liner),
//                          full of black rigid totes that look exactly like the sample (two rows, handles up). Its look is
//                          static once it has landed: baked ONCE into a 1.25× sprite at rest, placed with the state's
//                          translation, squash (about the foot), rot and the hand-placed jitter (FS_CART.xf).
//   BZ_onCarton(st, t, L)  world. The real blue SEA label (src/lib/shippingLabelCanvas.ts, landscape cut, as ep. 2): band
//                          with ship + 海运 SEA CARGO, address / tel / email BLURRED, QR, « BZ-482913 » and « EXEMPLE »
//                          (≥ 30 px at rest); during N5 (st.pop) it lifts off the face and grows (≥ 44 px), with a violet
//                          rim. Glued to the carton (same transform). Takes over 'bzCode'.
//   BZ_atmos(t, L)         screen. The violet brand light (L.violet): a lamp from above — one baked multiply layer (a pool
//                          on the label and the plate, edges sinking into violet), its soft cone, a one-swell bloom.
//   BZ_roles(br, t, L)     screen. The roles band (y 226–594): two paper cards — « LA COMMANDE, / C'EST [TOI]. » (amber
//                          tab with a felt pen, TOI in his amber pill) on A.role1, then « LE TRANSPORT, C'EST / BONZINI
//                          TRADING CARGO. » (violet tab with a ship, the name in violet with the logo) on A.role2 (card 1
//                          moves up). Satoshi 900, 56 / 68 px. Takes over 'role1' and 'role2'.
//   BZ_scene(br, t, L)     world. « collée par ton fournisseur / sur chaque carton » (Shantell 800 46 px, ink) on a cream
//                          slip at G.annot, with a hand-drawn ink arrow up to the label (drawn on). Takes over 'bzNote'.
//   window.BZ_lib          shared with 76_end.js.
// =============================================================================================
(function () {
  const F = FS_lib, S = F.S, G = F.G, A = F.A, P = F.P;
  const { cl, kk, mix, eo, sst, R } = F;
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };

  // =========================================================================================== THE BIG CARTON
  const REST = { x: G.big.x, y: G.big.y, w: G.big.w, h: G.big.h, d: G.big.d, s: 1, sx: 1, sy: 1, rot: 0, a: 1, flaps: 1, tape: 0, torn: 1, shake: 0 };
  const BB = { x0: 230, y0: 420, x1: 1150, y1: 1160, sc: 1.25 };
  let BIG = null;
  function bigSprite() {
    if (BIG) return BIG;
    const w = BB.x1 - BB.x0, h = BB.y1 - BB.y0, c = makeCanvas(Math.ceil(w * BB.sc), Math.ceil(h * BB.sc)), g = c.getContext('2d'), prev = ctx;
    const L0 = S.light(A.key + .6);
    ctx = g;
    try {
      g.scale(BB.sc, BB.sc); g.translate(-BB.x0, -BB.y0);
      FS_CART.draw(REST, 'back', A.key + .6, L0, { noXf: true, inside: geo => {
        // two rows of the sample's twin: the black rigid tote, handles up, packed (back row first)
        const ts = .6, T0 = F.TOTE;
        for (const [Y, dx] of [[geo.d * .74, 30], [geo.d * .32, 0]]) for (let j = 0; j < 4; j++) {
          const X = -geo.w / 2 + geo.w * (.135 + .243 * j) + dx * .3 + (R(j, Y) - .5) * 8;
          const Z = geo.h - T0.h * ts / 2 + 14 + (R(j, Y + 3) - .5) * 8;
          const p = geo.P(X, Y, Z);
          F.softShadow(p[0] + 8, p[1] - T0.h * ts * .35, T0.w * ts * .5, 14, .4);
          F.tote(p[0], p[1], ts, (R(j, Y + 5) - .5) * .05);
        }
      } });
      FS_CART.draw(REST, 'front', A.key + .6, L0, { noXf: true });
    } finally { ctx = prev; }
    return (BIG = { c, w, h });
  }
  /** the carton's transform for the current state (the sprite was baked at REST) */
  function bigXf(st, t) {
    FS_CART.xf(st, t);
    ctx.translate(st.x - REST.x, st.y - REST.y);
    if ((st.sx ?? 1) !== 1 || (st.sy ?? 1) !== 1) { ctx.translate(REST.x, REST.y); ctx.scale(st.sx ?? 1, st.sy ?? 1); ctx.translate(-REST.x, -REST.y); }
  }
  function carton(st, t, L) {
    if (!st) return;
    const sp = bigSprite();
    ctx.save(); ctx.globalAlpha *= st.a ?? 1; bigXf(st, t);
    ctx.drawImage(sp.c, BB.x0, BB.y0, sp.w, sp.h);
    ctx.restore();
    // the landing pushes dust out from under it
    const dk = kk(t, A.key + .35, A.key + 1);
    if (dk > 0 && dk < 1) { const g = S.cartonGeo(st);
      F.puffs([{ x: g.FBL[0], y: g.FBL[1], nx: -1, ny: .2, s: 1.2 }, { x: g.FBR[0] + 40, y: g.FBR[1] - 30, nx: 1, ny: .2, s: 1.2 }, { x: g.cx, y: g.FBL[1] + 4, nx: 0, ny: 1, s: 1 }], dk,
        { n: 6, seed: 260, dist: 110, size: 34, a: .45, rise: 14, tj: g.w * .7 }); }
  }

  // =========================================================================================== THE SEA LABEL (ep. 2)
  const LW = 640, LH = 400, LR = 10;
  const SHIP = new Path2D('M8 138H248L222 196H34Z M26 90H74V138H26Z M38 66H62V90H38Z M84 108H130V138H84Z M136 108H182V138H136Z M188 108H234V138H188Z M100 78H146V108H100Z M152 78H198V108H152Z M4 212H72V222H4Z M88 212H156V222H88Z M172 212H252V222H172Z');
  const ship = (x, y, size, col) => { ctx.save(); ctx.translate(x, y); ctx.scale(size / 256, size / 256); ctx.fillStyle = col; ctx.fill(SHIP); ctx.restore(); };
  const ZH = '"WenQuanYi Zen Hei"';
  function blurredText(lines, w, h, fnt, col, lh, x0 = 0) {
    const q = 11, c = makeCanvas(Math.ceil(w / q), Math.ceil(h / q)), g = c.getContext('2d');
    g.scale(1 / q, 1 / q); g.font = fnt; g.fillStyle = col; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x0, lh * (i + .5)));
    const m = makeCanvas(Math.ceil(w / 3), Math.ceil(h / 3)), mg = m.getContext('2d');
    mg.imageSmoothingQuality = 'high'; mg.drawImage(c, 0, 0, m.width, m.height);
    return m;
  }
  const labelSprite = () => F.sprite('bzLabel', LW + 24, LH + 24, () => {
    const code = (txt('bzCode') || 'BZ-482913 · EXEMPLE').split('·')[0].trim(), ex = ((txt('bzCode') || '').split('·')[1] || 'EXEMPLE').trim();
    ctx.translate(-LW / 2, -LH / 2);
    ctx.fillStyle = '#FFFFFF'; rrect(0, 0, LW, LH, LR); ctx.fill();
    ctx.save(); rrect(0, 0, LW, LH, LR); ctx.clip();
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, LW, 86); ctx.fillStyle = P.seaD; ctx.fillRect(0, 78, LW, 8);
    ship(22, 8, 66, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle';
    ctx.font = `900 42px ${ZH}`; ctx.fillText('海运', 102, 40);
    ctx.font = '900 27px DMSans'; ctx.fillText('SEA CARGO', 196, 43);
    ctx.textAlign = 'right'; ctx.font = `900 15px ${ZH}`; ctx.fillText('发货标签 · 请贴在每一个纸箱上', LW - 18, 30);
    ctx.font = '700 12px DMSans'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('Shipping label · stick on every carton', LW - 18, 52); ctx.textAlign = 'left';
    ctx.fillStyle = P.seaT; ctx.fillRect(0, 86, LW, 26);
    ctx.fillStyle = P.muted; ctx.font = '900 13px DMSans'; ctx.fillText('1', 18, 100);
    ctx.fillStyle = P.ink; ctx.font = `900 16px ${ZH}`; ctx.fillText('收件地址', 36, 100);
    ctx.fillStyle = P.muted; ctx.font = '800 12px DMSans'; ctx.fillText('DELIVER TO', 108, 101);
    ctx.fillStyle = P.sea; rrect(LW - 150, 90, 134, 18, 4); ctx.fill(); ship(LW - 143, 91, 16, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF'; ctx.font = `900 11px ${ZH}`; ctx.fillText('海运 · SEA CARGO', LW - 122, 99.5);
    ctx.fillStyle = P.hair; ctx.fillRect(0, 112, LW, 1);
    ctx.fillStyle = P.sea; ctx.fillRect(0, 113, 7, 58);
    const addr = blurredText(['广州市白云区 · 仓库 3 号门 · 收货处 88', 'Warehouse gate 3, receiving bay, Baiyun district'], 600, 56, `900 22px ${ZH}`, '#333', 28);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(addr, 22, 115, 600, 56);
    ctx.fillStyle = P.hair; ctx.fillRect(0, 171, LW, 1);
    ctx.fillStyle = P.muted; ctx.font = `700 13px ${ZH}`; ctx.fillText('电话', 22, 186); ctx.font = '700 11px DMSans'; ctx.fillText('TEL', 54, 187);
    ctx.font = `700 13px ${ZH}`; ctx.fillText('邮箱', 330, 186); ctx.font = '700 11px DMSans'; ctx.fillText('EMAIL', 362, 187);
    ctx.drawImage(blurredText(['+86 138 0000 0000'], 180, 24, '800 17px DMSans', '#333', 24), 124, 174, 180, 24);
    ctx.drawImage(blurredText(['bz_reception_88'], 180, 24, '800 17px DMSans', '#333', 24), 428, 174, 180, 24);
    ctx.fillStyle = P.ink; ctx.fillRect(0, 200, LW, 3);
    qr(24, 220, 162, 17, P.ink);
    ctx.fillStyle = P.hair; ctx.fillRect(208, 203, 1, LH - 203);
    ctx.fillStyle = P.muted; ctx.font = `900 16px ${ZH}`; ctx.fillText('客户编号', 228, 236); ctx.font = '800 13px DMSans'; ctx.fillText('· CUSTOMER ID', 296, 237);
    ctx.textBaseline = 'alphabetic';
    let cs = 84; while (cs > 40 && measure(code, `900 ${cs}px DMSans`) > LW - 228 - 22) cs -= 2;
    text(code, 226, 318, { font: `900 ${cs}px DMSans`, color: P.ink });
    text(ex, 228, 384, { font: '900 60px Satoshi', color: P.orange, ls: 2 });
    ctx.restore();
    ctx.strokeStyle = P.sea; ctx.lineWidth = 5; rrect(2.5, 2.5, LW - 5, LH - 5, LR - 2); ctx.stroke();
  }, 2);
  const labelShadow = () => F.shadowSprite('bzLabelSh', LW, LH, LR, 12);
  /** where the label sits on the front face (world, before the carton transform), and its scale at rest / popped */
  function labelBox(g) { const w = Math.min(g.w * .82, g.h * .82 * LW / LH); return { x: g.cx + g.w * .01, y: g.cy + 3, w, h: w * LH / LW, r: -.022, s: w / LW }; }
  function onCarton(st, t, L) {
    if (!st || (st.label ?? 1) <= 0) return;
    const g = S.cartonGeo({ ...REST }), lb = labelBox(g), pop = sst(st.pop || 0);
    ctx.save(); ctx.globalAlpha *= st.a ?? 1; bigXf(st, t);
    const s = lb.s * (1 + .28 * pop), lift = pop, r = lb.r + .012 * pop, y = lb.y - 10 * pop;
    // its shadow on the kraft: a contact line at rest, wider and offset once it lifts towards us
    at(lb.x + 4 + 26 * lift, y + 6 + 30 * lift, r, s * (1 + .03 * lift), s * (1 + .03 * lift), () => { ctx.globalAlpha *= .32 - .1 * lift; F.blit(labelShadow()); });
    at(lb.x, y, r, s, s, () => {
      F.blit(labelSprite());
      const cg = ctx.createLinearGradient(-LW / 2, -LH / 2, LW / 2, LH / 2);       // paper on kraft: a faint curl light
      cg.addColorStop(0, 'rgba(255,248,230,.10)'); cg.addColorStop(.5, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(80,50,20,.08)');
      ctx.fillStyle = cg; rrect(-LW / 2, -LH / 2, LW, LH, LR); ctx.fill();
      if (pop > 0) {                                                           // Bonzini's violet rim + a slow sheen across it
        ctx.strokeStyle = `rgba(123,75,255,${(.85 * pop).toFixed(3)})`; ctx.lineWidth = 9; rrect(-LW / 2 - 7, -LH / 2 - 7, LW + 14, LH + 14, LR + 6); ctx.stroke();
        const u = kk(t, A.label + .3, A.label + 1.5); if (u > 0 && u < 1) {
          ctx.save(); rrect(-LW / 2, -LH / 2, LW, LH, LR); ctx.clip(); ctx.globalCompositeOperation = 'screen';
          const x = mix(-LW, LW, u), sg = ctx.createLinearGradient(x - 120, 0, x + 120, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg; ctx.fillRect(-LW / 2, -LH / 2, LW, LH); ctx.restore();
        }
      }
    });
    ctx.restore();
  }

  // =========================================================================================== THE VIOLET LIGHT
  const tintLayer = () => F.sprite('bzTint', W, H, (w, h) => {
    ctx.fillStyle = '#8F78DE'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.translate(30, 990 - h / 2); ctx.scale(1, 1.55);
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 640);
    g.addColorStop(0, '#FCFAFF'); g.addColorStop(.4, '#F2ECFF'); g.addColorStop(.72, '#D0C2F8'); g.addColorStop(1, '#8F78DE');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.restore();
    // the lamp's cone from above: a faint brighter column on the action
    const cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(.32, 'rgba(255,255,255,.08)'); cg.addColorStop(.54, 'rgba(255,255,255,.14)'); cg.addColorStop(.76, 'rgba(255,255,255,.08)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(-120, -h / 2); ctx.lineTo(220, -h / 2); ctx.lineTo(560, h / 2); ctx.lineTo(-480, h / 2); ctx.closePath(); ctx.fill();
  });
  const bloom = () => F.sprite('bzBloom', 900, 1100, () => {
    ctx.save(); ctx.scale(1, 1.22); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 450);
    g.addColorStop(0, 'rgba(176,136,255,.55)'); g.addColorStop(.5, 'rgba(140,96,255,.20)'); g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g; circle(0, 0, 450); ctx.fill(); ctx.restore();
  });
  function atmos(t, L) {
    const v = cl(L ? L.violet : 0) * (1 - kk(t, A.out - .25, A.out)); if (v <= .002) return;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = v * .9; ctx.drawImage(tintLayer().c, 0, 0); ctx.restore();
    const on = Math.exp(-Math.max(0, t - (A.violet + .3)) * 3.2) * kk(t, A.violet, A.violet + .3);   // one soft swell, never a flicker
    const a = v * .62 * on;                                       // the swell only (a constant screen bloom costs ≈ 10 ms a frame)
    if (a > .01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; F.blit(bloom(), G.big.x, 930); ctx.restore(); }
  }

  // =========================================================================================== THE ROLES BAND
  const segs = l => l.split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  const F1 = '900 56px Satoshi', F2 = z => `900 ${z}px Satoshi`;
  const CW = 960;
  /** a cream paper card w × h with a coloured tab on the left holding an icon */
  function cardSprite(key, h, tabCol, icon) {
    return F.sprite('role_' + key, CW + 60, h + 60, () => {
      const w = CW, x0 = -w / 2, y0 = -h / 2;
      const top = tornLine(x0, y0, x0 + w, y0, 31 + key.length, 2.5, 14), bot = tornLine(x0 + w, y0 + h, x0, y0 + h, 37 + key.length, 2.5, 14);
      const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); };
      ctx.save(); ctx.shadowColor = 'rgba(14,6,4,.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 20000 + 4; ctx.shadowOffsetY = 10; ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#FFFBF2'); g.addColorStop(1, '#F5EEDF');
      path(); ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(); ctx.clip();
      for (let i = 0; i < 700; i++) { const x = x0 + R(i, 51) * w, y = y0 + R(i, 52) * h, a = R(i, 53) * 3, l = 3 + R(i, 54) * 8;
        ctx.strokeStyle = R(i, 55) > .5 ? 'rgba(150,115,75,.07)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
      ctx.fillStyle = tabCol; ctx.fillRect(x0, y0 - 10, 92, h + 20);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x0 + 86, y0 - 10, 6, h + 20);
      ctx.restore();
      at(x0 + 46, 0, 0, 1, 1, icon);
    }, 2);
  }
  const iconPen = () => { ctx.save(); ctx.rotate(-.75); ctx.fillStyle = '#FFF6E8'; rrect(-8, -34, 16, 52, 4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(8, 18); ctx.lineTo(0, 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7A4300'; ctx.fillRect(-8, -12, 16, 6); ctx.restore(); };
  const iconShipW = () => ship(-30, -30, 60, '#FFFFFF');
  let ROLE = null;
  function roleLayout() {
    if (ROLE) return ROLE;
    const r1 = (txt('role1') || "LA COMMANDE,|C'EST *TOI*.").split('|'), r2 = (txt('role2') || "LE TRANSPORT, C'EST|*BONZINI TRADING CARGO*.").split('|');
    const z2b = F.fit(r2[1].replace(/\*/g, ''), '900 #px Satoshi', 64, CW - 92 - 70 - 80, 56);
    const H1 = 196, H2 = 176;
    ROLE = { r1, r2, z2b, H1, H2 };
    return ROLE;
  }
  function roles(br, t, L) {
    if (!br) return;
    const lo = roleLayout(), out = br.out, a1 = br.role1, a2 = br.role2; if (a1 <= 0 && a2 <= 0) return;
    const yTop = 228, gap = 12, yC1 = mix(G.top.y, yTop + lo.H1 / 2, sst(kk(t, A.role2 - .1, A.role2 + .25))), yC2 = yTop + lo.H1 + gap + lo.H2 / 2;
    const fo = 1 - out;
    // card 1: LA COMMANDE, C'EST [TOI].
    if (a1 > 0) {
      const k = eo(kk(t, A.role1, A.role1 + .28)), sc = 1.06 - .06 * k, x = G.cx - 60 * (1 - k);
      ctx.save(); ctx.globalAlpha *= Math.min(1, a1 * 1.5) * fo; ctx.translate(x, yC1); ctx.rotate(-.012); ctx.scale(sc, sc);
      F.blit(cardSprite('r1', lo.H1, '#F3A745', iconPen));
      const lx = -CW / 2 + 92 + 40;
      text(lo.r1[0].replace(/\*/g, ''), lx, -lo.H1 / 2 + 24 + 50, { font: F1, color: P.ink });
      // line 2: C'EST + TOI's amber pill + .
      const sg = segs(lo.r1[1]), z = 72, f = F2(z); let cx = lx; const by = lo.H1 / 2 - 34;
      for (const q of sg) {
        if (!q.e) { text(q.s, cx, by, { font: f, color: P.ink }); cx += F.measureW(q.s, f); continue; }
        const pw = F.measureW(q.s, f) + 44, ph = 86, pk = eo(kk(t, A.role1 + .12, A.role1 + .4)), ps = 1 + .25 * Math.exp(-Math.max(0, t - A.role1 - .3) * 9) * Math.sin(Math.max(0, t - A.role1 - .3) * 22);
        ctx.save(); ctx.translate(cx + pw / 2 + 4, by - z * .36); ctx.scale(ps * pk, ps * pk);
        ctx.fillStyle = '#B86F1A'; rrect(-pw / 2, -ph / 2 + 6, pw, ph, ph / 2); ctx.fill();
        const pg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2); pg.addColorStop(0, '#FAC06A'); pg.addColorStop(1, '#EE9A30'); ctx.fillStyle = pg; rrect(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
        text(q.s, 0, z * .36, { font: f, align: 'center', color: P.ink }); ctx.restore();
        cx += pw + 10;
      }
      ctx.restore();
    }
    // card 2: LE TRANSPORT, C'EST BONZINI TRADING CARGO.
    if (a2 > 0) {
      const k = eo(kk(t, A.role2, A.role2 + .3)), sc = 1.06 - .06 * k, x = G.cx + 80 * (1 - k);
      ctx.save(); ctx.globalAlpha *= Math.min(1, a2 * 1.5) * fo; ctx.translate(x, yC2); ctx.rotate(.008); ctx.scale(sc, sc);
      F.blit(cardSprite('r2', lo.H2, '#6A35F2', iconShipW));
      const lx = -CW / 2 + 92 + 40;
      text(lo.r2[0].replace(/\*/g, ''), lx, -lo.H2 / 2 + 22 + 50, { font: F1, color: P.ink });
      const z = lo.z2b, f = F2(z), by = lo.H2 / 2 - 30, nk = eo(kk(t, A.bzName - .1, A.bzName + .2));
      drawLogo(lx + 30, by - z * .36, 62, {});
      let cx = lx + 74;
      for (const q of segs(lo.r2[1])) { text(q.s, cx, by, { font: f, color: q.e ? '#5B2BDF' : P.ink }); cx += F.measureW(q.s, f); }
      if (nk > 0 && nk < 1) {                                  // on « Bonzini »: a violet underline swipes under the name
        const w = F.measureW(lo.r2[1].replace(/\*/g, '').replace(/\.$/, ''), f);
        ctx.fillStyle = 'rgba(123,75,255,.85)'; ctx.fillRect(lx + 74, by + 10, w * nk, 6);
      } else if (nk >= 1) { const w = F.measureW(lo.r2[1].replace(/\*/g, '').replace(/\.$/, ''), f); ctx.fillStyle = 'rgba(123,75,255,.85)'; ctx.fillRect(lx + 74, by + 10, w, 6); }
      ctx.restore();
    }
  }

  // =========================================================================================== THE LABEL NOTE
  const NOTE_F = '800 46px Shantell';
  const noteSprite = () => F.sprite('bzNote', 760, 170, () => {
    const lines = (txt('bzNote') || 'collée par ton fournisseur|sur chaque carton').split('|'), w = Math.max(...lines.map(l => F.measureW(l, NOTE_F))) + 56, h = 128;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 61, 2.4, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 67, 2.4, 12);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(30,12,30,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 20000 + 6; ctx.shadowOffsetY = 8; ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = '#FBF6EC'; ctx.fill();
    lines.forEach((l, i) => text(l, 0, -h / 2 + 50 + i * 52, { font: NOTE_F, align: 'center', color: '#1E1430' }));
  }, 2);
  function scene(br, t, L) {
    if (!br) return;
    const st = S.bigCarton(t); if (!st) return;
    const a = br.labelNote * (1 - br.out); if (a <= 0) return;
    const x = G.annot.x, y = G.annot.y + 4, k = eo(kk(t, A.labelNote, A.labelNote + .3));
    ctx.save(); ctx.globalAlpha *= a;
    at(x, y + 16 * (1 - k), -.018, 1, 1, () => F.blit(noteSprite()));
    // a hand-drawn ink arrow from the slip up to the label (drawn on)
    const g = S.cartonGeo(st), lb = labelBox(g), u = kk(t, A.labelNote + .15, A.labelNote + .6);
    if (u > 0) {
      const p0 = [x + 330, y - 34], p1 = [x + 385, y - 120], p2 = [lb.x + lb.w * .64 + 14, lb.y - 10];
      ctx.strokeStyle = '#FBF6EC'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const N = 18, n = Math.round(N * u); ctx.beginPath();
      for (let i = 0; i <= n; i++) { const q = i / N, iq = 1 - q, px = iq * iq * p0[0] + 2 * iq * q * p1[0] + q * q * p2[0], py = iq * iq * p0[1] + 2 * iq * q * p1[1] + q * q * p2[1]; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      if (u >= 1) { const dx = p2[0] - p1[0], dy = p2[1] - p1[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        ctx.beginPath(); ctx.moveTo(p2[0] - ux * 24 - uy * 15, p2[1] - uy * 24 + ux * 15); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p2[0] - ux * 24 + uy * 15, p2[1] - uy * 24 - ux * 15); ctx.stroke(); }
    }
    ctx.restore();
  }

  window.BZ_carton = carton;
  window.BZ_onCarton = onCarton;
  window.BZ_atmos = atmos;
  window.BZ_roles = roles;
  window.BZ_scene = scene;
  window.BZ_lib = { P, sprite: F.sprite, blit: F.blit, shadowSprite: F.shadowSprite, circle, ship, labelBox };
})();
