'use strict';
// =============================================================================================
// 50_note — chapitre « note » (S10)
// « La note : le droit de douane, selon le code. Puis la TVA, 19,25 %, sur le tout… droit compris. »
//  · début      : la tour du « COMBIEN ? » est de retour (MARCHANDISE / TRANSPORT (vrai tirage) / ASSURANCE), elle respire ;
//                 « La » : elle s'accroupit (anticipation).
//  · « note »   : bande « LA NOTE » qui claque ; la tour se TASSE et une feuille violette l'emballe (en deux)
//                 → un seul bloc « VALEUR EN DOUANE » (petit nuage de papier).
//  · « droit »  : le bloc « DROIT DE DOUANE » tombe dessus (écrasement, tremblement) ;
//    « selon »  : sa hauteur respire (petit ↔ grand) ; « code » : deux étiquettes 64 03 / 64 04 pendent au bout d'un fil.
//  · « Puis »   : les étiquettes tombent, la bande remonte pour laisser la place.
//  · « TVA »    : un FILM ambre translucide tombe et emballe TOUTE la pile (rétraction élastique, reflets qui glissent),
//                 étiquette opaque « TVA » ; « 19,25 » : « 19,25 % » claque sur l'étiquette.
//  · « sur le tout » : accolade manuscrite + « SUR / LE / TOUT » ; le film s'illumine.
//  · « droit compris » : « droit compris ! » s'écrit, la flèche plonge vers le bloc droit, qui sautille.
//  · fin        : fiche propre (capturable) + post-it « + selon le produit : accises… → PARTIE 2 ».
// Aucun taux par produit, aucun montant : seuls chiffres = TVA 19,25 % et codes 64 03 / 64 04.
// La scène possède l'image de TL.ch('note').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'note', SEG = 'S10';
  const SX = 450, BASE = 1180, SW = 520, VH = 180, DH = 160;         // stack centre x, base y, width, block heights
  const STACK_TOP = BASE - VH - DH;                                     // 840
  const TOWER = [
    { h: 130, label: 'MARCHANDISE', o: { fill: BLK.marchandise, icon: () => sneaker(96, { color: '#8A5A3A', lift: 3 }) } },
    { h: 150, label: 'TRANSPORT', o: { photo: 'ships_cranes', fx_kind: 'duo', cols: DUO.amber, sub: 'le fret' } },
    { h: 130, label: 'ASSURANCE', o: { fill: BLK.assurance, icon: () => iconUmbrella(84) } },
  ];
  const TOWER_H = TOWER.reduce((a, b) => a + b.h, 0);
  const TAGS = ['64 03', '64 04'];
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), s = TL.seg(SEG), w = (k, nth = 0) => TL.wt(SEG, k, null, nth);
    const o = { c0: c.start, c1: c.end };
    const keys = [['la', 'la'], ['note', 'note'], ['droit', 'droit'], ['selon', 'selon'], ['code', 'code'], ['puis', 'puis'], ['tva', 'tva'],
      ['num', '19'], ['sur', 'sur'], ['tout', 'tout'], ['droit2', 'droit', 1], ['compris', 'compris']];
    let prev = -1e9;
    for (const [k, str, nth] of keys) { const v = Math.max(w(str, nth || 0), prev + .12); o[k] = v; prev = v; }   // monotonic safety
    // post-it slap: in the long hold of « dix-neuf virgule vingt-cinq pour cent », before the brace
    o.post = clamp(lerp(o.num, o.sur, .55), o.num + .45, Math.max(o.num + .45, o.sur - .3));
    return o;
  }

  // ---------------------------------------------------------------------------- small helpers (file-local)
  const ease2 = (ts, a, d) => eOutCubic(prog(ts, a, a + d));
  const settle = (t, t0, f = 10, w = 36, a = .07) => t > t0 ? Math.exp(-(t - t0) * f) * Math.cos((t - t0) * w) * a : 0;
  function _nt_fitFont(fam, s, maxW, size, ls = 0) { const w = measure(s, font(fam, size, 900), ls); return w > maxW ? size * maxW / w : size; }
  /** polyline stroked up to progress p (hand-drawn marker) */
  function _nt_stroke(pts, p, col, lw) {
    if (p <= 0) return; const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const lim = L[L.length - 1] * clamp(p); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) { if (L[i] <= lim) ctx.lineTo(...pts[i]); else { const k = (lim - L[i - 1]) / (L[i] - L[i - 1]); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); break; } }
    ctx.stroke(); ctx.restore();
  }
  /** paper dust puff at ground level (x,y), life k 0..1 */
  function _nt_puff(x, y, k, wd = 300, seed = 1) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = `rgba(120,86,52,${.55 * (1 - k)})`; ctx.lineCap = 'round'; ctx.lineWidth = 5 * (1 - k) + 1;
    for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, j = i % 4, x0 = x + s * (wd / 2 + 8 + 56 * k + j * 5), y0 = y - j * 15 - rnd(seed + i) * 8;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + s * (26 * (1 - k) + 10), y0 - j * 7 - 4); ctx.stroke(); }
    ctx.restore();
  }
  /** value block (same paper block as the COMBIEN tower) with a fitted stencil label */
  function block(w, h, label, fill, o = {}) {
    stackBlock(w, h, '', { fill, lift: o.lift ?? 8 });
    ctx.save(); rrect(-w / 2, -h, w, h, 16); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-w / 2, -h, w, 6);                                  // cut-edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.2;                                            // paper fibres
    for (let i = 0; i < 26; i++) { const x = (rnd(i * 3.7 + w) - .5) * w * .9, y = -rnd(i * 5.1 + h) * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 3); ctx.stroke(); }
    if (o.glow > 0) { ctx.strokeStyle = `rgba(255,255,255,${.85 * o.glow})`; ctx.lineWidth = 10; rrect(-w / 2 + 5, -h + 5, w - 10, h - 10, 12); ctx.stroke(); }
    ctx.restore();
    const fs = _nt_fitFont(FF.stencil, label, w - 80, o.size || 62, 3);
    text(label, 0, -h / 2 + fs * .36, { font: font(FF.stencil, fs, 900), align: 'center', color: o.color || '#fff', ls: 3 });
  }
  /** code tag hanging by its hole (origin = hole) */
  function codeTag(label, hi) {
    const w = 178, h = 78;
    withShadow(8, () => { ctx.fillStyle = hi ? C.violetD : DC.paper; ctx.beginPath(); ctx.moveTo(0, -h / 2 + 10); ctx.lineTo(26, -h / 2); ctx.lineTo(w, -h / 2); ctx.lineTo(w, h / 2); ctx.lineTo(26, h / 2); ctx.lineTo(0, h / 2 - 10); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(20, 0, 11, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(20, 0, 5, 0, 7); ctx.fill();
    const fs = Math.max(48, _nt_fitFont(FF.stencil, label, w - 58, 60, 2));
    text(label, 38 + (w - 38) / 2, fs * .36, { font: font(FF.stencil, fs, 900), align: 'center', color: hi ? '#fff' : C.ink, ls: 2 });
  }
  /** shrink-wrap film over the whole stack: translucent amber, crinkled edges (boil on twos), sliding gloss, crimped seal */
  function film(x0, y0, x1, y1, n, t, glow) {
    const s = Math.floor(n / 2), pts = [];
    const edge = (ax, ay, bx, by, seed) => { const L = Math.hypot(bx - ax, by - ay), N = Math.max(4, Math.round(L / 26));
      for (let i = 0; i < N; i++) { const k = i / N, nx = -(by - ay) / L, ny = (bx - ax) / L, o = (rnd(seed + i * 1.7 + s * .31) - .5) * 5;
        pts.push([lerp(ax, bx, k) + nx * o, lerp(ay, by, k) + ny * o]); } };
    const r = 22;
    edge(x0 + r, y0, x1 - r, y0, 11); edge(x1, y0 + r, x1, y1 - r, 23); edge(x1 - r, y1, x0 + r, y1, 37); edge(x0, y1 - r, x0, y0 + r, 51);
    const path = () => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save();
    ctx.shadowColor = 'rgba(120,70,10,.22)'; ctx.shadowBlur = 26; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 18;
    ctx.fillStyle = 'rgba(243,167,69,.14)'; path(); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); path(); ctx.clip();
    ctx.strokeStyle = 'rgba(243,167,69,.30)'; ctx.lineWidth = 44; path(); ctx.stroke();                         // thicker plastic at the folds
    const w = x1 - x0, g0 = x0 - 260 + ((t * 70) % (w + 520));                                                  // travelling gloss streaks
    ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.beginPath(); ctx.moveTo(g0, y0); ctx.lineTo(g0 + 90, y0); ctx.lineTo(g0 - 110, y1); ctx.lineTo(g0 - 200, y1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(g0 + 140, y0); ctx.lineTo(g0 + 170, y0); ctx.lineTo(g0 - 30, y1); ctx.lineTo(g0 - 60, y1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(199,122,18,.28)'; ctx.fillRect(x0, y0, w, 22); ctx.fillRect(x0, y1 - 18, w, 18);            // crimped seals
    ctx.strokeStyle = 'rgba(160,90,10,.38)'; ctx.lineWidth = 2;
    for (let x = x0 + 8; x < x1; x += 11) { ctx.beginPath(); ctx.moveTo(x, y0 + 3); ctx.lineTo(x + 4, y0 + 19); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y1 - 16); ctx.lineTo(x + 4, y1 - 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;                                                // wrinkles
    for (let i = 0; i < 5; i++) { const yy = lerp(y0 + 60, y1 - 60, rnd(i * 4.3)), xx = lerp(x0 + 20, x1 - 120, rnd(i * 7.9));
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 50, yy - 10 + (s % 2) * 3, xx + 100, yy + 4); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = `rgba(199,122,18,${.75 + .25 * glow})`; ctx.lineWidth = 3 + 6 * glow; path(); ctx.stroke();
    if (glow > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(243,167,69,${.5 * glow})`; ctx.lineWidth = 26 * glow; path(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  /** opaque amber label of the film: « TVA » then « 19,25 % » slams in (numK = slide 0..1, sl = slam {s,a}) */
  function tvaSticker(w, h, numK, sl, n) {
    withShadow(10, () => { ctx.fillStyle = C.amber; rrect(-w / 2, -h / 2, w, h, 18); ctx.fill(); });
    ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); rrect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 12); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; rrect(-w / 2 + 6, -h / 2 + 6, w - 12, 10, 5); ctx.fill();
    const full = 'TVA 19,25 %', fs = _nt_fitFont(FF.stencil, full, w - 64, 116, 2), f = font(FF.stencil, fs, 900);
    const wT = measure('TVA', f, 2), wN = measure('19,25 %', f, 2), sp = measure(' ', f, 2), tot = wT + sp + wN;
    const xT = lerp(-wT / 2, -tot / 2, eInOutCubic(numK)), y = fs * .35;
    text('TVA', xT, y, { font: f, color: C.ink, ls: 2 });
    if (sl && sl.a > 0) { const cx = -tot / 2 + wT + sp + wN / 2;
      at(cx, 0, -.03 * (sl.s - 1), sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; text('19,25 %', 0, y, { font: f, align: 'center', color: C.violetD, ls: 2 }); }); }
  }
  function postItNote() {
    const w = 290, lines = ['+ selon le', 'produit :', 'accises…'];
    let fs = 46; const mw = Math.max(...lines.map(l => measure(l, font(FF.hand, fs, 800))), measure('→ PARTIE 2', font(FF.hand, fs, 800))); if (mw > w - 40) fs = Math.max(44, fs * (w - 40) / mw);
    postIt(w, () => {
      lines.forEach((l, i) => text(l, -w / 2 + 22, -w / 2 + 70 + i * fs * 1.16, { font: font(FF.hand, fs, 800), color: C.ink }));
      text('→ PARTIE 2', -w / 2 + 22, -w / 2 + 70 + 3 * fs * 1.16 + 8, { font: font(FF.hand, fs, 800), color: C.orange });
    }, { lift: 12 });
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                                          // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.note + .1, 8); addShake(T.droit, 12); addShake(T.tva + .02, 14); addShake(T.num + .02, 7); addShake(T.post, 4); }
    const sh = shake(t, n);
    paperTable(n);
    ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 50, 5), cam = 1 + .02 * prog(t, T.c0, T.c1);
    ctx.translate(540, 860); ctx.scale(cam, cam); ctx.rotate(dr.r); ctx.translate(-540, -860);

    // ------------------------------------------------ the value stack (tower → single VALEUR block → + DROIT)
    const k1 = prog(ts, T.la - .02, T.la + .3), crouch = Math.sin(k1 * Math.PI * 2) * .05 * (1 - k1);   // anticipation on « La »
    const cK = eInOutCubic(prog(ts, T.note - .04, T.note + .18));                  // tower squash
    const wK = prog(ts, T.note + .08, T.note + .26);                                // violet wrap, left → right
    const sx0 = SX + dr.x, bY = BASE + dr.y * .3;
    if (wK < 1) {
      const f = lerp(1, VH / TOWER_H, cK) * (1 - crouch); let y = bY;
      TOWER.forEach((b, i) => { const j = jit(80 + i, n, .6 * (1 - cK));
        at(sx0 + j.x, y, j.r + (i - 1) * .012 * (1 - cK), 1 + (1 - f) * .05, f, () => {
          stackBlock(SW, b.h, b.label, b.o);
          if (b.o.photo) creditTag(CREDIT.ships_cranes, SW / 2 - 16, -14, { size: 18 });
        });
        y -= b.h * f; });
    }
    const vSq = settle(t, T.note + .26, 10, 36, .08) + settle(t, T.droit, 10, 36, .07);
    if (wK > 0) {
      ctx.save();
      if (wK < 1) { const L = sx0 - SW / 2 - 40, ex = L + (SW + 80) * wK, e = tornLine(ex, bY - VH - 60, ex, bY + 40, 17, 9, 16);
        ctx.beginPath(); ctx.moveTo(L, bY - VH - 60); for (const p of e) ctx.lineTo(...p); ctx.lineTo(L, bY + 40); ctx.closePath(); ctx.clip(); }
      at(sx0, bY, 0, 1 + vSq, 1 - vSq, () => block(SW, VH, 'VALEUR EN DOUANE', C.violetD, { size: 64 }));
      ctx.restore();
    }
    _nt_puff(sx0, bY - 6, prog(t, T.note + .22, T.note + .6), SW, 3);

    // DROIT DE DOUANE : drops on « droit », breathes « selon le code », hops on « compris »
    let droitTop = null, dhNow = DH;
    if (t >= T.droit - .24) {
      const d = drop(ts, T.droit - .24, 900, .24);
      const amp = 52 * env(t, T.selon - .05, T.puis + .2, .12, .28);
      dhNow = DH + amp * Math.sin((ts - T.selon) * Math.PI * 2 / .58);
      const hs = t - (T.compris + .12), hop = hs > 0 ? Math.exp(-hs * 7) * Math.abs(Math.sin(hs * 13)) * 26 : 0;
      const glow = env(t, T.compris + .1, T.compris + .75, .08, .4);
      const topV = bY - VH * (1 - vSq), j = jit(88, n, .6);
      droitTop = topV - dhNow + d.y - hop;
      at(sx0 + j.x, topV + d.y - hop, j.r, d.sx, d.sy, () => block(SW, dhNow, 'DROIT DE DOUANE', C.violet, { size: 60, glow }));
      _nt_puff(sx0, topV, prog(t, T.droit, T.droit + .4), SW, 7);
      // « selon » : a hand-drawn ↕ beside the block stretches with its height
      const ak = env(t, T.selon - .06, T.puis + .12, .12, .16);
      if (ak > 0) { const ax = sx0 - SW / 2 - 40, ya = droitTop + 10, yb = droitTop + dhNow - 10, jj = jit(89, n, .7);
        ctx.save(); ctx.globalAlpha *= ak; ctx.translate(jj.x, jj.y); ctx.strokeStyle = C.violetD; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ya + 4); ctx.lineTo(ax + 2, yb - 4);
        ctx.moveTo(ax - 18, ya + 22); ctx.lineTo(ax, ya); ctx.lineTo(ax + 18, ya + 22); ctx.moveTo(ax - 16, yb - 22); ctx.lineTo(ax + 2, yb); ctx.lineTo(ax + 20, yb - 22); ctx.stroke(); ctx.restore(); }
    }

    // mini code tags hanging off the DROIT block (« code »), they drop away on « Puis »
    if (droitTop != null && t >= T.code - .06 && t < T.tva + .1) {
      const out = eInCubic(prog(ts, T.puis, T.puis + .32));
      TAGS.forEach((lab, i) => {
        const p = clamp(pop(t, T.code - .06 + i * .1, 15, .45), 0, 1.15); if (p <= 0) return;
        const ax = sx0 + SW / 2 - 4, ay = droitTop + 34 + i * 58, hx = ax + 34, hy = droitTop + 46 + i * 96;
        const sw = Math.sin(t * 3.2 + i * 1.7) * .07 + (1 - clamp(p)) * (i ? .7 : -.7);
        const fx = hx + out * (i ? 40 : -30), fy = hy + out * out * 700;
        ctx.save(); ctx.globalAlpha *= 1 - clamp(out * 1.4 - .4);
        if (out < .15) { ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + fx) / 2, Math.max(ay, fy) + 12, fx + 18, fy); ctx.stroke(); }
        at(fx, fy, sw + out * (i ? 1.2 : -1), p, p, () => codeTag(lab, false));
        ctx.restore();
      });
    }

    // ------------------------------------------------ the TVA film (drops on « TVA », shrink-wraps the whole stack)
    const filmOn = t >= T.tva - .26;
    let fBox = null;
    if (filmOn) {
      const d = drop(ts, T.tva - .26, 1150, .26), s = Math.max(0, t - (T.tva + .0));
      const m = 16 + (d.landed ? 36 * Math.exp(-s * 7) * Math.cos(s * 17) : 36);
      const glow = env(t, T.tout - .05, T.tout + .7, .08, .45) + .6 * env(t, T.num, T.num + .35, .03, .3);
      const x0 = sx0 - SW / 2 - m, x1 = sx0 + SW / 2 + m, y0 = STACK_TOP - 152 - m * .5 + d.y, y1 = bY + m * .6 + d.y;
      fBox = { x0, x1, y0, y1 };
      at((x0 + x1) / 2, (y0 + y1) / 2, 0, d.sx, d.sy, () => film(x0 - (x0 + x1) / 2, y0 - (y0 + y1) / 2, x1 - (x0 + x1) / 2, y1 - (y0 + y1) / 2, n, t, clamp(glow)));
      if (d.landed) _nt_puff(sx0, bY + 10, prog(t, T.tva, T.tva + .45), SW + 60, 11);
      const numK = prog(ts, T.num - .1, T.num + .06), sl = t >= T.num - .1 ? slam(t, T.num, 1.8) : null, j = jit(90, n, .5);
      at(sx0 + j.x, y0 + 80 + d.y * .0, -.012 + j.r, d.sx, d.sy, () => tvaSticker(560, 140, numK, sl, n));
    }

    // ------------------------------------------------ « sur le tout » : brace + SUR / LE / TOUT
    if (fBox && t >= T.sur - .08) {
      const bx = fBox.x1 + 26, ya = fBox.y0 + 12, yb = fBox.y1 - 8, ym = (ya + yb) / 2, bw = 34;
      const pts = curve([[bx - 8, ya], [bx + 8, ya + 22], [bx + 10, ym - 60], [bx + 14, ym - 16], [bx + bw, ym], [bx + 14, ym + 16], [bx + 10, ym + 60], [bx + 8, yb - 22], [bx - 8, yb]], 10);
      const j = jit(92, n, .5);
      ctx.save(); ctx.translate(j.x * .6, j.y * .6);
      _nt_stroke(pts, ease2(ts, T.sur - .08, .3), '#C77A12', 9);
      const lx = bx + bw + 76, words = ['SUR', 'LE', 'TOUT'], wt = [T.sur - .02, T.sur + .12, T.tout - .04];
      words.forEach((wd, i) => handText(wd, lx, ym - 50 + i * 66, 60, { write: prog(t, wt[i], wt[i] + .2), color: i === 2 ? '#B5650A' : C.ink, pen: false }));
      ctx.restore();
    }

    // ------------------------------------------------ « droit compris ! » + arrow into the DROIT block
    if (t >= T.droit2 - .05) {
      const j = jit(94, n, .5), wk = prog(t, T.droit2 - .05, Math.min(T.droit2 + .38, T.compris + .1));
      at(380 + dr.x * .8 + j.x, 604 + dr.y * .8 + j.y, -.035, 1, 1, () => handText('droit compris !', 0, 0, 60, { write: wk, color: C.violetD, pen: false }));
      if (droitTop != null) { const ty = droitTop + dhNow * .5;
        handArrow([[150 + dr.x * .8, 640], [104, 740], [112, ty - 70], [150, ty - 10], [212 + dr.x, ty + 2]], ease2(ts, T.compris - .16, .22), C.violetD, 8); }
    }

    // ------------------------------------------------ headline strip « LA NOTE » (slams on « note », rises on « Puis »)
    if (t >= T.note - .1) {
      const sl = slam(t, T.note, 1.7), up = eInOutCubic(prog(ts, T.puis - .04, T.puis + .3)), d2 = drift(t, 57, 3);
      at(SX + d2.x, lerp(560, 330, up) + d2.y, -.03, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('LA NOTE', { size: 90, seed: 4 }); });
    }

    // ------------------------------------------------ post-it (end card note)
    if (t >= T.post - .02) {
      const k = prog(ts, T.post - .02, T.post + .16), e = eInCubic(k), sq = settle(t, T.post + .16, 11, 34, .08), j = jit(96, n, .5);
      at(790 + dr.x * 1.2 + j.x, 528 + dr.y * 1.2 + j.y, lerp(.3, .055, e) + j.r, lerp(1.35, 1, e) * (1 + sq), lerp(1.35, 1, e) * (1 - sq), () => { ctx.globalAlpha *= clamp(k * 4); postItNote(); });
    }
  }

  registerScene({ id: 'note', z: 50, when: t => TL.in(t, CH, .4, .4), draw });
})();
