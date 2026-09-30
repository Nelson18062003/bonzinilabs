'use strict';
// =============================================================================================
// 72_cta — chapitre « cta » (S16)
// « Quoi, combien, d'où : laquelle vous bloque ? Dites-le en commentaire. »
//  · début        : les trois cartes du guichet reviennent, face cachée (dos kraft « ? »), en éventail, en gros plan.
//  · « Quoi » / « combien » / « d'où » : chaque carte se RETOURNE sur son mot (QUOI violet / COMBIEN ambre / D'OÙ orange),
//                   saute et lance des traits d'action.
//  · « laquelle » : les cartes redescendent (la caméra « bascule »), vague de petits sauts ; bande « LAQUELLE » claque.
//  · « vous »     : bande rouge « VOUS BLOQUE ? ».
//  · « bloque »   : un bras de barrière rouge et blanc tombe devant les cartes (choc), étiquette « BLOQUÉ » qui se balance.
//  · « Dites-le » : la barrière se relève ; une bulle de commentaire monte (avatar de Junior) et se tape :
//                   « La 2 ! Le bateau taxé » ; dès « La 2 ! » la carte COMBIEN est entourée au feutre et grossit.
//  · « commentaire » : le cœur de la bulle se remplit et lâche de petits cœurs.
// La scène possède l'image de TL.ch('cta').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'cta', SEG = 'S16';
  const CARDS = [{ x: 238, y: 726, r: -.09 }, { x: 540, y: 700, r: .012 }, { x: 842, y: 726, r: .09 }];
  const HAND = [{ x: 250, y: 818, r: -.12 }, { x: 540, y: 792, r: 0 }, { x: 814, y: 818, r: .12 }], HS = 1.12;   // fanned « hand » before « laquelle »
  const CW = 284, CHh = 252;
  const SUB = ['le produit', 'la valeur', "l'origine"];
  const BAR = { x: -40, y: 884, len: 1180 };
  const BUB = { x: 540, y: 1062, w: 880, h: 196 };
  const L1 = { x: 380, y: 340 }, L2 = { x: 600, y: 474 };
  const COMMENT = 'La 2 ! Le bateau taxé';
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = (k, fb) => TL.wt(SEG, k, fb);
    const o = { c0: c.start, c1: c.end };
    o.q = [w('quoi', c.start + .35), w('combien'), w('dou')];
    for (let i = 1; i < 3; i++) o.q[i] = Math.max(o.q[i], o.q[i - 1] + .22);
    o.laq = Math.max(w('laquelle'), o.q[2] + .2); o.vous = Math.max(w('vous'), o.laq + .12); o.bloque = Math.max(w('bloque'), o.vous + .12);
    o.dites = Math.max(w('dites'), o.bloque + .25); o.comm = Math.max(w('commentaire'), o.dites + .3);
    o.commE = Math.max(TL.we(SEG, 'commentaire'), o.comm + .2);
    o.type0 = o.dites + .16; o.typeD = clamp(o.commE - .1 - o.type0, .5, 1.1);
    o.circle = o.type0 + o.typeD * 6 / COMMENT.length;                // the moment « La 2 ! » is typed
    return o;
  }
  const flipK = (ts, i) => prog(ts, T.q[i] - .06, T.q[i] + .16);

  // ---------------------------------------------------------------------------- cards
  function cardBack(i) {
    withShadow(12, () => { ctx.fillStyle = C.kraft; rrect(-CW / 2, -CHh / 2, CW, CHh, 20); ctx.fill(); });
    ctx.save(); ctx.fillStyle = TEX.kraft; rrect(-CW / 2, -CHh / 2, CW, CHh, 20); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(251,246,236,.8)'; ctx.lineWidth = 5; ctx.setLineDash([14, 10]); rrect(-CW / 2 + 14, -CHh / 2 + 14, CW - 28, CHh - 28, 12); ctx.stroke(); ctx.setLineDash([]);
    at(0, 0, (i - 1) * .12, 1, 1, () => text('?', 0, 60, { font: font(FF.stencil, 176, 900), align: 'center', color: C.cream }));
  }
  function cardFront(i) {
    const f0 = font(FF.stencil, 70, 900), size = Math.min(70, 70 * (CW - 48) / measure(QWORD[i], f0, 3));
    qCard(i + 1, QWORD[i], null, { band: QCOL[i], w: CW, h: CHh, size });
    text(SUB[i], 0, CHh / 2 - 30, { font: font(FF.body, 44, 800), align: 'center', color: C.inkSoft });
  }

  // ---------------------------------------------------------------------------- barrier arm (pivot off-frame left) + swinging tag
  function arm(ang, t) {
    ctx.save(); ctx.translate(BAR.x, BAR.y); ctx.rotate(ang);
    const L = BAR.len;
    withShadow(22, () => { ctx.fillStyle = '#FFFFFF'; rrect(0, -22, L, 44, 12); ctx.fill(); });
    ctx.save(); rrect(0, -22, L, 44, 12); ctx.clip();
    for (let x = 0; x < L; x += 96) { ctx.fillStyle = DC.red; ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x + 48, -22); ctx.lineTo(x + 26, 22); ctx.lineTo(x - 22, 22); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, -20, L, 7);
    ctx.restore();
    ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#8C939B'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
    // paper tag « BLOQUÉ » hanging from the arm, swings (counter-rotated so it hangs down)
    const hx = 600, sw = -ang * .9 + Math.sin(t * 5.5) * .05 * Math.exp(-Math.max(0, t - T.bloque) * 1.2) + Math.sin(t * 2) * .02;
    at(hx, 20, sw, 1, 1, () => {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.stroke();
      withShadow(10, () => { ctx.fillStyle = '#FFFDF7'; rrect(-128, 34, 256, 88, 12); ctx.fill(); });
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, 48, 8, 0, 7); ctx.fill();
      text('BLOQUÉ', 0, 110, { font: font(FF.stencil, 60, 900), align: 'center', color: DC.red, ls: 5 });
    });
    ctx.restore();
  }
  function armAngle(t) {
    const up = -Math.PI / 2, b = T.bloque;
    if (t < b - .13) return up;
    if (t < b) return lerp(up, 0, eInCubic(prog(t, b - .13, b)));
    const lift = eInOutCubic(prog(t, T.dites - .04, T.dites + .26));
    const s = t - b, bounce = -.07 * Math.exp(-s * 8) * Math.abs(Math.cos(s * 26));
    return lerp(bounce, up, lift);
  }

  // ---------------------------------------------------------------------------- comment bubble
  function heartPath(s) { ctx.beginPath(); ctx.moveTo(0, s * .35); ctx.bezierCurveTo(-s * .6, -s * .05, -s * .35, -s * .55, 0, -s * .22); ctx.bezierCurveTo(s * .35, -s * .55, s * .6, -s * .05, 0, s * .35); }
  function bubble(k, t, n) {
    const { w, h } = BUB;
    withShadow(16, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, 46); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w / 2 + 96, h / 2 - 6); ctx.lineTo(-w / 2 + 62, h / 2 + 40); ctx.lineTo(-w / 2 + 150, h / 2 - 6); ctx.closePath(); ctx.fill(); });
    const ax = -w / 2 + 90;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, 0, 60, 0, 7); ctx.fillStyle = '#EBD9FF'; ctx.fill(); ctx.clip();
    at(ax, 56, .04 * Math.sin(t * 3), .36, .36, () => junior({ face: t > T.circle ? 'grin' : 'smile', blink: (n % 80) < 3 }));
    ctx.restore();
    ctx.strokeStyle = C.violet; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(ax, 0, 60, 0, 7); ctx.stroke();
    const nf = font(FF.body, 44, 800);
    text('Junior', -w / 2 + 176, -34, { font: nf, color: C.violetD });
    text('· Mboppi', -w / 2 + 188 + measure('Junior', nf), -34, { font: font(FF.body, 44, 700), color: 'rgba(35,22,41,.5)' });
    const f = font(FF.body, 60, 800), shown = COMMENT.slice(0, Math.round(COMMENT.length * clamp(k)));
    text(shown, -w / 2 + 176, 54, { font: f, color: C.ink });
    if (k < 1 || Math.floor(n / 10) % 2 === 0) { ctx.fillStyle = C.violetD; ctx.fillRect(-w / 2 + 182 + measure(shown, f), 6, 6, 60); }
    // like heart: outline, then filled + pop on « commentaire »
    const hx = w / 2 - 66, lk = t < T.comm ? 0 : clamp(spring(t - T.comm, 15, .4), 0, 1.35);
    at(hx, 4, 0, 1, 1, () => {
      const s = 64 * (lk > 0 ? Math.max(.4, lk) : 1);
      heartPath(s); if (lk > 0) { ctx.fillStyle = C.orange; ctx.fill(); } else { ctx.strokeStyle = 'rgba(35,22,41,.45)'; ctx.lineWidth = 5; ctx.stroke(); }
    });
    if (t > T.comm) for (let i = 0; i < 4; i++) {                    // little hearts floating up
      const s = t - T.comm - i * .09; if (s <= 0 || s > 1.1) continue;
      const x = hx + (rnd(i * 3.3) - .5) * 60 + Math.sin(s * 8 + i) * 14, y = -30 - s * 240;
      ctx.save(); ctx.globalAlpha = clamp((1.1 - s) / .4); at(x, y, (rnd(i) - .5) * .6, .9, .9, () => iconHeart(30 + i * 5, i % 2 ? C.amber : C.orange)); ctx.restore();
    }
  }

  function decor(t) {
    const d = drift(t, 83, 3);
    marker(1000 + d.x, 1228 + d.y, 2.5, C.orange);
    at(-6 + d.x * .7, 1238 + d.y * .7, 0, 1, 1, () => {
      withShadow(10, () => { ctx.fillStyle = 'rgba(236,160,60,.95)'; ctx.beginPath(); ctx.arc(0, 0, 96, 0, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(0, 0, 84, 0, 7); ctx.fill();
      ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(0, 0, 55, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, 43, 0, 7); ctx.fill();
    });
    ctx.save(); ctx.fillStyle = 'rgba(251,246,236,.9)';
    for (const [x, y, r, s] of [[980, 300, .7, 26], [70, 560, -.4, 22], [1010, 1000, 1.3, 20]]) at(x + d.x, y + d.y, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-s, -s * .4); ctx.lineTo(s, -s * .7); ctx.lineTo(s * .6, s * .6); ctx.lineTo(-s * .8, s * .5); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                             // hard cut under the wipes
    if (!reg) { reg = true; T.q.forEach(x => addShake(x + .16, 5)); addShake(T.laq, 6); addShake(T.bloque, 14); addShake(T.circle + .05, 4); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 72, 5);
    ctx.translate(540, 800); ctx.rotate(dr.r); ctx.translate(-540, -800);

    decor(t);

    // ------------------------------------------------ cards: hero close-up → settle on « laquelle »
    const settle = eOutBack(prog(ts, T.laq - .04, T.laq + .3), 1.2);
    for (const i of [0, 2, 1]) {                                     // middle card on top of the fan
      const h = HAND[i], c0 = CARDS[i], c = { x: lerp(h.x, c0.x, settle), y: lerp(h.y, c0.y, settle), r: lerp(h.r, c0.r, settle) }, fk = flipK(ts, i), fl = Math.sin(fk * Math.PI), sxF = Math.abs(Math.cos(fk * Math.PI));
      const ft = t - (T.q[i] + .16), fw = ft > 0 ? Math.exp(-ft * 11) * Math.sin(ft * 40) * .07 : 0;
      const hop = Math.sin(Math.PI * prog(ts, T.laq + .1 + i * .07, T.laq + .32 + i * .07)) * 42;
      const jolt = t > T.bloque ? Math.exp(-(t - T.bloque) * 10) * Math.sin((t - T.bloque) * 34) * .07 : 0;
      const pick = i === 1 && t > T.circle ? .1 * clamp(spring(t - T.circle, 13, .4), 0, 1.4) : 0;
      const breathe = 1 + .014 * Math.sin(t * 3 + i * 2), j = jit(720 + i, n, .7), dd = drift(t, 50 + i, 3);
      const s = lerp(HS, 1, settle) * (1 + .14 * fl) * breathe * (1 + pick);
      const x = c.x + j.x + dd.x + dr.x * 1.2, y = c.y + j.y + dd.y + dr.y * 1.2 - 34 * fl - hop;
      at(x, y, c.r + j.r + (i === 1 ? -.03 * pick : 0), s * sxF * (1 + fw + jolt), s * (1 - fw - jolt), () => fk >= .5 ? cardFront(i) : cardBack(i));
      if (fk >= 1 && ft < .3) { const k = prog(t, T.q[i] + .16, T.q[i] + .44); ctx.save(); ctx.strokeStyle = QCOL[i]; ctx.lineCap = 'round'; ctx.lineWidth = 8 * (1 - k) + 1;
        for (let a = 0; a < 6; a++) { const an = -Math.PI / 2 + (a - 2.5) * .42, r0 = 168 + 34 * k, r1 = r0 + 40 * (1 - k); ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * .92); ctx.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * .92); ctx.stroke(); }
        ctx.restore(); }
      if (i !== 1 && t > T.circle) {                                 // the two others step back a little
        const dim = .32 * eOutCubic(prog(t, T.circle, T.circle + .3));
        at(x, y, c.r + j.r, s, s, () => { ctx.fillStyle = `rgba(242,234,219,${dim})`; rrect(-CW / 2 - 4, -CHh / 2 - 4, CW + 8, CHh + 8, 22); ctx.fill(); });
      }
      if (i === 1 && t > T.circle) {                                 // felt-marker circle around « COMBIEN »
        const p = eOutCubic(prog(ts, T.circle, T.circle + .32));
        at(x, y, -.05, 1, 1, () => handCircle(CW * .66, CHh * .66, p, C.orange, 10, 7));
      }
    }

    // ------------------------------------------------ title strips « LAQUELLE » / « VOUS BLOQUE ? »
    const s1 = slam(t, T.laq, 1.8);
    if (s1.a > 0) { const j = jit(731, n, .8); at(L1.x + j.x + dr.x * 1.5, L1.y + j.y + dr.y * 1.5, -.035 + j.r, s1.s, s1.s, () => { ctx.globalAlpha *= s1.a; strip('LAQUELLE', { size: 112, seed: 4, lift: 14 }); }); }
    const s2 = slam(t, T.vous, 1.8);
    if (s2.a > 0) { const j = jit(732, n, .8); at(L2.x + j.x + dr.x * 1.6, L2.y + j.y + dr.y * 1.6, .025 + j.r, s2.s, s2.s, () => { ctx.globalAlpha *= s2.a; strip('VOUS BLOQUE ?', { size: 96, seed: 6, fill: DC.red, color: '#FFFDF7', lift: 14 }); }); }

    // ------------------------------------------------ barrier arm on « bloque », lifted on « Dites-le »
    const ang = armAngle(t);
    if (ang > -Math.PI / 2 + .01) arm(ang, t);

    // ------------------------------------------------ comment bubble (Junior types « La 2 ! … »)
    if (t >= T.dites - .06) {
      const e = clamp(spring(t - T.dites + .06, 11, .5), 0, 1.15), k = prog(t, T.type0, T.type0 + T.typeD), j = jit(733, n, .5);
      const bob = Math.sin(t * 2.2) * 4;
      at(BUB.x + j.x + dr.x * 1.3, BUB.y + (1 - e) * 420 + bob + j.y + dr.y * 1.3, -.015 + (1 - clamp(e)) * .08, 1, 1, () => { ctx.globalAlpha *= clamp(e * 2); bubble(k, t, n); });
    }
  }

  registerScene({ id: 'cta', z: 42, when: t => TL.in(t, CH, .4, .4), draw });
})();
