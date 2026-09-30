'use strict';
// =============================================================================================
// 34_questions — chapitre « questions » (S6)
// « Et au guichet, trois questions. Quoi ? Combien ? D'où ? »
//  · début      : un guichet vitré (cadre vert, vitre bleutée avec reflets), comptoir, sonnette, tampon, chevalet « GUICHET ».
//  · « guichet » : la sonnette tinte, le douanier (casquette verte, SANS insigne) surgit derrière la vitre (ressort) ;
//                  il sourit et lève un sourcil.
//  · « trois »  : il lance trois cartes face cachée (dos kraft « ? ») qui se collent au mur au-dessus de la vitre.
//  · « questions » : un afficheur « QUESTIONS 0/3 » tombe au bout de ses ficelles.
//  · « Quoi » / « Combien » / « D'où » : chaque carte se RETOURNE (scaleX 1→0→1, en deux) sur son mot → qCard violet / ambre / orange
//                  (le produit / la valeur / l'origine) ; le douanier la montre du doigt, le tampon du comptoir cogne, le compteur roule.
//  · fin        : 3/3 en vert, le douanier rayonne, les cartes respirent.
// La scène possède l'image de TL.ch('questions').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'questions', SEG = 'S6';
  const CARDS = [{ x: 234, y: 584, r: -.07 }, { x: 540, y: 552, r: .012 }, { x: 846, y: 584, r: .07 }];
  const CW = 272, CHh = 246;
  const SUB = ['le produit', 'la valeur', "l'origine"];
  const OFF = { x: 540, y: 1042, s: .9 };                         // officer chest
  const WIN = { x: 240, y: 742, w: 600, h: 412, f: 22 };          // window frame (outer)
  const CTOP = 1152;                                              // counter top
  const IDLE = [158, 262];
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k);
    const o = { c0: c.start, c1: c.end, guichet: w('guichet'), trois: w('trois'), questions: w('questions'), q: [w('quoi'), w('combien'), w('dou')] };
    o.q = o.q.map((x, i) => Math.max(x, i ? o.q[i - 1] + .3 : x));  // safety: flips never overlap
    return o;
  }
  const lp = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const ramp = (t, a, d = .12) => eOutCubic(prog(t, a, a + d));
  const flipK = (ts, i) => prog(ts, T.q[i] - .06, T.q[i] + .18);
  function cardLocal(i) { const c = CARDS[i]; return [(c.x - OFF.x) / OFF.s, (c.y - OFF.y) / OFF.s]; }

  // ---------------------------------------------------------------------------- props
  function cardBack(i) {
    withShadow(12, () => { ctx.fillStyle = C.kraft; rrect(-CW / 2, -CHh / 2, CW, CHh, 20); ctx.fill(); });
    ctx.save(); ctx.fillStyle = TEX.kraft; rrect(-CW / 2, -CHh / 2, CW, CHh, 20); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(251,246,236,.8)'; ctx.lineWidth = 5; ctx.setLineDash([14, 10]); rrect(-CW / 2 + 14, -CHh / 2 + 14, CW - 28, CHh - 28, 12); ctx.stroke(); ctx.setLineDash([]);
    at(0, 0, (i - 1) * .12, 1, 1, () => text('?', 0, 60, { font: font(FF.stencil, 176, 900), align: 'center', color: C.cream }));
  }
  function cardFront(i) {
    const f0 = font(FF.stencil, 66, 900), size = Math.min(66, 66 * (CW - 50) / measure(QWORD[i], f0, 3));
    qCard(i + 1, QWORD[i], null, { band: QCOL[i], w: CW, h: CHh, size });
    text(SUB[i], 0, CHh / 2 - 30, { font: font(FF.body, 44, 800), align: 'center', color: C.inkSoft });
  }
  function windowBack(t) {
    const { x, y, w, h, f } = WIN;
    withShadow(14, () => { ctx.fillStyle = DC.green; rrect(x, y, w, h, 14); ctx.fill(); });
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#E4EFF3'); g.addColorStop(1, '#C9DEE6');
    ctx.fillStyle = g; ctx.fillRect(x + f, y + f, w - 2 * f, h - f);
    ctx.strokeStyle = 'rgba(29,69,119,.12)'; ctx.lineWidth = 2;                                    // back-office shelves (depth)
    for (let i = 0; i < 3; i++) { const yy = y + f + 70 + i * 80; ctx.beginPath(); ctx.moveTo(x + f, yy); ctx.lineTo(x + w - f, yy); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['rgba(169,71,254,.16)', 'rgba(243,167,69,.2)', 'rgba(14,107,78,.14)'][i % 3]; ctx.fillRect(x + f + 30 + i * 88, y + f + 38, 50, 32); }
  }
  function windowFront(t) {
    const { x, y, w, h, f } = WIN;
    ctx.save(); ctx.beginPath(); ctx.rect(x + f, y + f, w - 2 * f, h - f); ctx.clip();
    ctx.fillStyle = 'rgba(160,200,225,.12)'; ctx.fillRect(x, y, w, h);                              // glass tint
    const sx = ((t * 60) % 900) - 200;                                                               // slow travelling reflection
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(x + sx, y); ctx.lineTo(x + sx + 70, y); ctx.lineTo(x + sx - 90, y + h); ctx.lineTo(x + sx - 160, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(x + sx + 110, y); ctx.lineTo(x + sx + 135, y); ctx.lineTo(x + sx - 25, y + h); ctx.lineTo(x + sx - 50, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 6, y + 6, w - 12, 5);
  }
  function counterFront() {
    const w = 1000;
    withShadow(14, () => { ctx.fillStyle = '#DCCFB6'; ctx.fillRect(-w / 2 + 20, 14, w - 40, 420); });
    ctx.strokeStyle = 'rgba(90,60,30,.18)'; ctx.lineWidth = 3; for (let x = -w / 2 + 120; x < w / 2 - 40; x += 120) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 420); ctx.stroke(); }
    ctx.fillStyle = DC.green; ctx.fillRect(-w / 2 + 20, 60, w - 40, 16); ctx.fillStyle = DC.yellow; ctx.fillRect(-w / 2 + 20, 76, w - 40, 5);
    withShadow(8, () => { ctx.fillStyle = '#C7B593'; rrect(-w / 2, -16, w, 34, 8); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-w / 2 + 10, -12, w - 20, 5);
  }
  function bell(ding) {                                          // service bell, origin = base centre
    const sq = ding > 0 && ding < 1 ? Math.sin(ding * Math.PI * 3) * .12 * (1 - ding) : 0;
    ctx.fillStyle = '#3A3040'; rrect(-54, -12, 108, 16, 6); ctx.fill();
    at(0, -12, 0, 1 + sq, 1 - sq, () => {
      const g = ctx.createLinearGradient(-40, -54, 36, 0); g.addColorStop(0, '#FFF3C4'); g.addColorStop(1, '#C99A28');
      withShadow(6, () => { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, Math.PI, 0); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-16, -28, 12, 6, -.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#8C939B'; ctx.fillRect(-4, -60 + (ding > 0 && ding < .3 ? 6 : 0), 8, 14); ctx.beginPath(); ctx.arc(0, -62 + (ding > 0 && ding < .3 ? 6 : 0), 9, 0, 7); ctx.fill();
    });
    if (ding > 0 && ding < 1) { ctx.save(); ctx.strokeStyle = C.amber; ctx.lineCap = 'round'; ctx.lineWidth = 6 * (1 - ding) + 1;
      for (const s of [-1, 1]) for (let r = 0; r < 2; r++) { const R = 70 + r * 26 + ding * 30; ctx.beginPath(); ctx.arc(0, -30, R, s < 0 ? Math.PI * 1.08 : -Math.PI * .38, s < 0 ? Math.PI * 1.38 : -Math.PI * .08); ctx.stroke(); }
      ctx.restore(); }
  }
  function rubberStamp(hop) {                                    // wooden stamp on an ink pad, hops (0..1)
    ctx.fillStyle = '#2B2230'; rrect(-58, -14, 116, 18, 6); ctx.fill(); ctx.fillStyle = DC.green; rrect(-50, -12, 100, 10, 4); ctx.fill();
    const y = -Math.sin(clamp(hop) * Math.PI) * 44;
    at(0, y - 14, 0, 1 + (hop > .85 ? .06 : 0), 1 - (hop > .85 ? .06 : 0), () => { withShadow(6 + 20 * Math.sin(clamp(hop) * Math.PI), () => {
      ctx.fillStyle = '#3A3040'; rrect(-34, -18, 68, 18, 4); ctx.fill(); ctx.fillStyle = C.kraftD; rrect(-12, -62, 24, 46, 8); ctx.fill();
      ctx.fillStyle = C.kraft; ctx.beginPath(); ctx.arc(0, -68, 20, 0, 7); ctx.fill(); }); });
  }
  function nameplate() {
    const w = 262, h = 84;
    ctx.fillStyle = '#0A4F3A'; ctx.beginPath(); ctx.moveTo(-w / 2 + 10, h / 2); ctx.lineTo(w / 2 - 10, h / 2); ctx.lineTo(w / 2 - 22, h / 2 + 14); ctx.lineTo(-w / 2 + 22, h / 2 + 14); ctx.closePath(); ctx.fill();
    withShadow(8, () => { ctx.fillStyle = DC.green; rrect(-w / 2, -h / 2, w, h, 10); ctx.fill(); });
    ctx.strokeStyle = 'rgba(246,197,74,.7)'; ctx.lineWidth = 3; rrect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 6); ctx.stroke();
    text('GUICHET', 0, 20, { font: font(FF.stencil, 56, 900), align: 'center', color: DC.yellow, ls: 5 });
  }
  /** hanging display « QUESTIONS n/3 » ; the digit rolls (k 0..1) from prev to cur */
  function display(prev, cur, roll, done) {
    const w = 600, h = 124;
    for (const bx of [-w / 2 + 70, w / 2 - 70]) { ctx.fillStyle = '#8C939B'; rrect(bx - 16, -h / 2 - 20, 32, 30, 6); ctx.fill(); ctx.fillStyle = '#5B616A'; ctx.beginPath(); ctx.arc(bx, -h / 2 - 8, 5, 0, 7); ctx.fill(); }
    withShadow(12, () => { ctx.fillStyle = '#231629'; rrect(-w / 2, -h / 2, w, h, 18); ctx.fill(); });
    ctx.fillStyle = '#3A2F42'; rrect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 12); ctx.fill();
    text('QUESTIONS', -w / 2 + 32, 26, { font: font(FF.stencil, 72, 900), color: C.cream, ls: 4 });
    const wx = w / 2 - 198, ww = 176;
    ctx.fillStyle = '#140C18'; rrect(wx, -40, ww, 80, 10); ctx.fill();
    ctx.save(); rrect(wx, -40, ww, 80, 10); ctx.clip();
    const col = done ? '#3DDC97' : C.amber, f = font(FF.mono, 58, 800);
    if (roll < 1) text(`${prev}/3`, wx + ww / 2, 21 - 70 * eInOutCubic(roll), { font: f, align: 'center', color: C.amber });
    text(`${cur}/3`, wx + ww / 2, 21 + 70 * (1 - eInOutCubic(roll)), { font: f, align: 'center', color: col });
    ctx.restore();
    if (done) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(61,220,151,.14)'; rrect(wx - 6, -46, ww + 12, 92, 12); ctx.fill(); ctx.restore(); }
  }
  /** officer + pointing fingers + raised brow, in officer-local coords (chest = 0,0, scale applied by caller) */
  function officerRig(t, n, ts) {
    const q = T.q;
    const toss = ramp(ts, T.trois - .08, .1) * (1 - ramp(ts, T.trois + .3, .14));
    const a1 = ramp(ts, q[0] - .1) * (1 - ramp(ts, q[1] - .12)), a2 = ramp(ts, q[1] - .1) * (1 - ramp(ts, q[2] - .12)), a3 = ramp(ts, q[2] - .1);
    const P1 = [238, -214], R2 = [168, -216], P3 = [238, -214], TOSS = [120, -30];
    const L = lp(lp(IDLE, TOSS, toss), P1, a1), R = lp(lp(lp(IDLE, TOSS, toss), R2, a2), P3, a3);
    const look = -a1 + a3, tilt = .035 * Math.sin(t * 2.2) - .05 * a1 + .05 * a3;
    const face = t > q[2] + .35 ? 'grin' : 'smile', blink = (n % 74) < 3;
    officer({ arms: [L, R], look, tilt, face, blink });
    const skin = SKIN[2] || SKIN[0];
    const finger = (side, hand, k, target) => { if (k < .6) return; const hx = side * hand[0], hy = hand[1];
      const d = [target[0] - hx, target[1] - hy], m = Math.hypot(d[0], d[1]) || 1, ux = d[0] / m, uy = d[1] / m;
      ctx.save(); ctx.strokeStyle = skin; ctx.lineCap = 'round'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(hx + ux * 14, hy + uy * 14); ctx.lineTo(hx + ux * 70, hy + uy * 70); ctx.stroke();
      ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(hx - uy * side * 18, hy + ux * side * 18); ctx.lineTo(hx - uy * side * 30 + ux * 16, hy + ux * side * 30 + uy * 16); ctx.stroke(); ctx.restore(); };
    finger(-1, L, a1, cardLocal(0)); finger(1, R, a2, cardLocal(1)); finger(1, R, a3, cardLocal(2));
    const br = env(t, T.guichet + .22, T.trois + .5, .1, .15);                                 // raised left brow
    if (br > 0) { ctx.save(); ctx.translate(look * 8, -150); ctx.rotate(tilt);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-40, -41, 31, 11, 0, 0, 7); ctx.fill();
      const lift = 14 * br; ctx.strokeStyle = '#140C10'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-64, -40 - lift * .6); ctx.quadraticCurveTo(-40, -44 - lift * 1.5, -16, -40 - lift * .5); ctx.stroke(); ctx.restore(); }
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                            // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.guichet, 6); T.q.forEach(x => addShake(x + .18, 6)); addShake(T.questions + .1, 4); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 34, 4);

    // ------------------------------------------------ window + officer (clipped to the glass) + glass
    ctx.save(); ctx.translate(dr.x * .5, dr.y * .5);
    windowBack(t);
    const pk = t < T.guichet - .06 ? 0 : spring(t - T.guichet + .06, 11, .42);
    if (pk > 0) { ctx.save(); ctx.beginPath(); ctx.rect(WIN.x + WIN.f, WIN.y + WIN.f, WIN.w - 2 * WIN.f, WIN.h); ctx.clip();
      const sq = (1 - clamp(pk)) * .12 - .008 * Math.sin(t * 3.1);
      at(OFF.x, OFF.y + (1 - pk) * 440, 0, OFF.s * (1 - sq), OFF.s * (1 + sq), () => officerRig(t, n, ts)); ctx.restore(); }
    windowFront(t);
    ctx.restore();

    // ------------------------------------------------ counter, bell, stamp, nameplate (foreground, stronger drift = parallax)
    at(540 + dr.x, CTOP + dr.y * .8, 0, 1, 1, () => {
      counterFront();
      at(-262, -14, -.02, 1, 1, () => bell(prog(t, T.guichet - .12, T.guichet + .45)));
      const hop = Math.max(...T.q.map(x => prog(ts, x - .02, x + .2) < 1 ? prog(ts, x - .02, x + .2) : 0));
      at(-134, -14, .03, 1, 1, () => rubberStamp(hop));
      at(262, -58, .025, 1, 1, () => nameplate());
    });

    // ------------------------------------------------ the three cards: dealt on « trois », flipped on their word
    for (let i = 0; i < 3; i++) {
      const c = CARDS[i], td = T.trois + i * .06; if (t < td) continue;
      const dk = prog(ts, td, td + .26), e = eOutCubic(dk);
      const x0 = OFF.x + (i - 1) * 40, y0 = OFF.y - 60;
      const x = lerp(x0, c.x, e), y = lerp(lerp(y0, c.y - 240, e), lerp(c.y - 240, c.y, e), e);
      const spin = (1 - e) * (i - 1 || .6) * 3.2, sc = lerp(.35, 1, e);
      const st = t - td - .26, wob = st > 0 ? Math.exp(-st * 11) * Math.sin(st * 42) * .07 : 0;
      const fk = flipK(ts, i), fl = Math.sin(fk * Math.PI), sxF = Math.abs(Math.cos(fk * Math.PI));
      const ft = t - (T.q[i] + .18), fw = ft > 0 ? Math.exp(-ft * 12) * Math.sin(ft * 40) * .06 : 0;
      const breathe = 1 + .012 * Math.sin(t * 3 + i * 2), j = jit(70 + i, n, .6), dd = drift(t, 40 + i, 3);
      at(x + j.x + dd.x, y + j.y + dd.y - 34 * fl, c.r + spin + j.r, sc * sxF * (1 + .14 * fl) * (1 + wob + fw) * breathe, sc * (1 + .14 * fl) * (1 - wob - fw) * breathe, () => fk >= .5 ? cardFront(i) : cardBack(i));
      if (fk >= 1 && ft < .3) { const k = prog(t, T.q[i] + .18, T.q[i] + .45); ctx.save(); ctx.strokeStyle = QCOL[i]; ctx.lineCap = 'round'; ctx.lineWidth = 7 * (1 - k) + 1;   // action lines
        for (let a = 0; a < 6; a++) { const an = -Math.PI / 2 + (a - 2.5) * .42, r0 = 150 + 30 * k, r1 = r0 + 36 * (1 - k); ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * r0, c.y + Math.sin(an) * r0 * .9); ctx.lineTo(c.x + Math.cos(an) * r1, c.y + Math.sin(an) * r1 * .9); ctx.stroke(); }
        ctx.restore(); }
    }

    // ------------------------------------------------ hanging display « QUESTIONS n/3 »
    if (t >= T.questions - .08) {
      const dp = spring(t - T.questions + .08, 10, .38), cnt = T.q.filter(x => t >= x + .06).length, last = cnt ? T.q[cnt - 1] + .06 : 0;
      const roll = cnt ? prog(t, last, last + .16) : 1, sw = Math.sin(t * 2.4) * .012 + Math.exp(-Math.max(0, t - T.questions) * 4) * Math.sin(t * 16) * .03, d2 = drift(t, 48, 2.5);
      at(540 + d2.x, 330 - (1 - clamp(dp)) * 260 + d2.y, sw, 1, 1, () => display(Math.max(0, cnt - 1), cnt, roll, cnt === 3 && roll >= 1));
    }
  }

  registerScene({ id: 'questions', z: 34, when: t => TL.in(t, CH, .4, .4), draw });
})();
