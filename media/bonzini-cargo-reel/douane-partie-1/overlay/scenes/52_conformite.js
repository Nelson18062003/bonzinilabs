'use strict';
// =============================================================================================
// 52_conformite — chapitre « conformite » (S11)
// « Mauvais code, valeur trop basse ? Vous risquez une amende… et des retards.
//   Le secret : des papiers vrais, complets, prêts à l'avance. »
// ACTE 1 — le piège
//  · début      : une DÉCLARATION scotchée sur la table (Code 64 04 / Valeur « presque rien » / Chine / Import),
//                 le carton de Junior (étiquette manuscrite) attend devant une barrière de douane ouverte, feu orange.
//  · « Mauvais code » : feutre rouge qui entoure « 64 04 » + croix ; un faisceau RAYONS X balaie le carton :
//                 dedans, des baskets… étiquette « cuir ! » (donc pas 64 04).
//  · « valeur trop basse » : la ligne Valeur surlignée, « presque rien » RÉTRÉCIT (gag), puis barrée en rouge + flèche ↓ qui rebondit.
//  · « risquez » : la bête noire (petite) monte derrière la guérite, ricane.
//  · « amende » : tampon rouge rond « AMENDE » qui claque sur la déclaration (tremblement, éclats d'encre).
//  · « retards » : l'horloge surgit et s'emballe, la barrière RETOMBE sur le carton, le feu passe au rouge.
// ACTE 2 — le secret
//  · « Le secret » : la déclaration fautive est balayée hors champ, bande ambre « LE SECRET » qui claque, feu orange.
//  · juste après : une check-list vierge (3 bandes, ronds pointillés) glisse depuis la gauche ;
//    « papiers » : le passeport vert du carton se pose dessus.
//  · « vrais » / « complets » / « prêts » : chaque mot CLAQUE dans sa bande + coche verte qui se dessine ; la bête tremble de plus en plus.
//  · « avance » : feu VERT, la barrière se lève, le carton passe ; la bête se replie en avion de papier et s'envole.
// Aucun montant, aucun taux, aucun article : seuls chiffres = code 64 04. Carton contrôlé = étiquette manuscrite (jamais BZ).
// La scène possède l'image de TL.ch('conformite').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'conformite', SEG = 'S11';
  const SH = { x: 392, y: 636, s: 1.12, r: -.03, w: 440, h: 600 };               // declaration sheet
  const ROW_TOP = -SH.h / 2 + SH.h * .16 + 44, RH = (SH.h / 2 - 24 - ROW_TOP) / 4, VAL_X = -SH.w / 2 + 28;
  const CART = { x: 250, y: 1094, w: 300, h: 200 };
  const BOOTH = { x: 890, y: 1100 }, ARM = 600;
  const LIGHT = { x: 915, y: 610, s: .6 };
  const CLOCK = { x: 782, y: 418, s: 150 };
  const MON = { x: 890, y: 990, w: 160 };
  const CHIPS = ['VRAIS', 'COMPLETS', "PRÊTS À L'AVANCE"], CHIP_X = 100, CHIP_Y = [508, 650, 792];
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k);
    const o = { c0: c.start, c1: c.end };
    const keys = ['mauvais', 'code', 'valeur', 'trop', 'basse', 'amende', 'retards', 'secret', 'papiers', 'vrais', 'complets', 'prets', 'avance'];
    let prev = -1e9;
    for (const k of keys) { const v = Math.max(w(k), prev + .14); o[k] = v; prev = v; }            // monotonic safety
    const rq = TL.word(SEG, 'risquez');                                                           // « Vous risquez une » (real voice)
    o.rise = clamp(rq ? rq.s : o.amende - .5, o.basse + .25, Math.max(o.basse + .25, o.amende - .12));
    o.toss = Math.max(o.retards + .45, o.secret - .34);
    return o;
  }

  // ---------------------------------------------------------------------------- helpers (file-local)
  const settle = (t, t0, f = 10, w = 36, a = .07) => t > t0 ? Math.exp(-(t - t0) * f) * Math.cos((t - t0) * w) * a : 0;
  function _cf_tape(x, y, r) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-52, -17, 104, 34); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-52, -13, 104, 5); }); }
  /** ink burst lines around (0,0), life k */
  function _cf_burst(k, r0, col, squash = .6, count = 9) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 9 * (1 - k) + 1;
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + .35, ra = r0 + 46 * k, rb = ra + 50 * (1 - k) + 10;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * ra, Math.sin(a) * ra * squash); ctx.lineTo(Math.cos(a) * rb, Math.sin(a) * rb * squash); ctx.stroke(); }
    ctx.restore();
  }
  /** red hand-drawn down arrow (local origin = top of the shaft) */
  function _cf_down(len, col) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, len); ctx.moveTo(-20, len - 24); ctx.lineTo(2, len); ctx.lineTo(22, len - 22); ctx.stroke(); ctx.restore(); }

  // ---------------------------------------------------------------------------- the declaration
  function declaration(t, n, ts) {
    const hl = t >= T.mauvais - .05 && t < T.valeur - .02 ? 0 : t >= T.valeur - .02 && t < T.amende ? 1 : null;
    docSheet('declaration', SH.w, SH.h, { values: ['64 04', null, 'Chine', 'Import'], highlight: hl, lift: 12 });
    _cf_tape(-SH.w / 2 + 34, -SH.h / 2 + 6, -.5); _cf_tape(SH.w / 2 - 34, -SH.h / 2 + 6, .5);
    // Valeur « presque rien » : shrinks on « trop », struck + bouncing arrow on « basse »
    const vf = font(FF.hand, 44, 800), vw = measure('presque rien', vf), vy = ROW_TOP + RH + RH * .8;
    const vs = lerp(1, .42, eInOutCubic(prog(ts, T.trop - .02, T.trop + .3)));
    at(VAL_X, vy, 0, vs, vs, () => handText('presque rien', 0, 0, 44, { align: 'left', pen: false, color: C.ink }));
    const sk = prog(t, T.basse - .04, T.basse + .22);
    if (sk > 0) { const x1 = VAL_X + vw * vs + 14; ctx.save(); ctx.strokeStyle = DC.red; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(VAL_X - 12, vy - 44 * vs * .3); ctx.lineTo(lerp(VAL_X - 12, x1, clamp(sk * 1.6)), vy - 44 * vs * .38 - 3); ctx.stroke();
      if (sk > .5) { ctx.beginPath(); ctx.moveTo(VAL_X - 10, vy - 44 * vs * .12); ctx.lineTo(lerp(VAL_X - 10, x1 - 6, clamp(sk * 2 - 1)), vy - 44 * vs * .2); ctx.stroke(); }
      ctx.restore();
      const ak = prog(t, T.basse + .06, T.basse + .2), bs = t - T.basse - .2, bounce = bs > 0 ? Math.abs(Math.sin(bs * 7)) * 12 * Math.exp(-bs * .8) : 0;
      if (ak > 0) at(x1 + 40, vy - 70 + bounce, .05, ak, ak, () => _cf_down(64, DC.red)); }
    // Code « 64 04 » : red circle + cross
    const cf = font(FF.hand, 44, 800), cw = measure('64 04', cf), cy = ROW_TOP + RH * .8 - 12;
    at(VAL_X + cw / 2, cy, -.04, 1, 1, () => handCircle(cw / 2 + 38, 37, prog(t, T.mauvais - .04, T.code + .1), DC.red, 7, 5));
    const xk = clamp(pop(t, T.code + .06, 16, .45), 0, 1.2);
    if (xk > 0) at(VAL_X + cw + 86, cy - 2, .1, xk, xk, () => iconCross(58));
    // AMENDE : round red stamp slams on the sheet
    if (t >= T.amende - .1) { const sl = slam(t, T.amende, 2.2);
      at(46, 150, -.2, sl.s, sl.s, () => { roundStamp('FAUSSE DÉCLARATION', 'AMENDE', 152, DC.red, { alpha: sl.a }); _cf_burst(prog(t, T.amende, T.amende + .25), 170, DC.red, 1, 11); }); }
  }

  // ---------------------------------------------------------------------------- Junior's carton + x-ray pass
  function cartonXray(t, n, ts) {
    const w = CART.w, h = CART.h;
    juniorCarton(w, h);
    const xk = prog(ts, T.mauvais - .06, T.code + .12), back = prog(ts, T.valeur + .28, T.valeur + .5);
    if (xk <= 0 || back >= 1) return;
    const bx = -w / 2 - 10 + (w + 34) * xk;
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 - 12, -h / 2 - 12, bx + w / 2 + 12, h + 30); ctx.clip();
    ctx.globalAlpha *= 1 - back;
    ctx.fillStyle = '#0B1B33'; rrect(-w / 2, -h / 2, w + 12, h + 12, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(127,231,255,.10)'; ctx.lineWidth = 1.5;
    for (let x = -w / 2; x < w / 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2 + 12); ctx.stroke(); }
    for (let y = -h / 2; y < h / 2 + 12; y += 22) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2 + 12, y); ctx.stroke(); }
    ctx.strokeStyle = XRAY; ctx.lineWidth = 3; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 5); ctx.stroke();
    ctx.globalAlpha *= .6; ctx.beginPath(); ctx.moveTo(-w / 2 + 8, 0); ctx.lineTo(w / 2 - 8, 0); ctx.stroke(); ctx.globalAlpha /= .6;
    const sh = Math.floor(n / 2) % 2 ? 1 : 0;                                         // scanner flicker on twos
    at(-58, -26 + sh, -.04, 1, 1, () => sneaker(150, { color: 'rgba(127,231,255,.62)', accent: 'rgba(200,250,255,.9)', lift: 0 }));
    at(62, 42 - sh, .05, -1, 1, () => sneaker(150, { color: 'rgba(127,231,255,.55)', accent: 'rgba(200,250,255,.9)', lift: 0 }));
    ctx.restore();
    if (xk > 0 && xk < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(bx - 46, 0, bx + 8, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(1, 'rgba(160,240,255,.9)');
      ctx.fillStyle = g; ctx.fillRect(bx - 46, -h / 2 - 30, 54, h + 60); ctx.fillStyle = 'rgba(225,252,255,.95)'; ctx.fillRect(bx - 2, -h / 2 - 34, 5, h + 68); ctx.restore(); }
  }
  function cuirTag(k) {                                                               // « cuir ! » paper tag with a pointer
    ctx.save(); ctx.strokeStyle = DC.red; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-40, 34); ctx.lineTo(-40 - 70 * k, 34 + 60 * k); ctx.stroke(); ctx.restore();
    withShadow(8, () => { ctx.fillStyle = DC.paper; rrect(-96, -40, 192, 80, 12); ctx.fill(); });
    text('cuir !', 0, 17, { font: font(FF.hand, 50, 800), align: 'center', color: DC.red });
  }

  // ---------------------------------------------------------------------------- right column props
  function booth(open) {
    at(BOOTH.x, BOOTH.y, 0, -1, 1, () => barrier(ARM, open, { label: ' ' }));            // mirrored: the arm reaches left
    text('DOUANE', BOOTH.x, BOOTH.y + 30, { font: font(FF.stencil, 34, 900), align: 'center', color: DC.green, ls: 2 });
  }
  function chip(txt, sl, ck, i) {                                                    // torn paper band, left-aligned: blank → text slams → green check
    const f = font(FF.stencil, 66, 900), tw = measure(txt, f, 3), w = tw + 152, h = 112;
    const top = tornLine(0, -h / 2, w, -h / 2, 31 + i * 7, 3.5, 12), bot = tornLine(w, h / 2, 0, h / 2, 37 + i * 7, 3.5, 12);
    withShadow(10, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(31,168,106,.14)'; ctx.fillRect(0, -h / 2 + 4, 104, h - 8);
    ctx.save(); ctx.strokeStyle = 'rgba(31,168,106,.55)'; ctx.lineWidth = 4; ctx.setLineDash([9, 8]); ctx.beginPath(); ctx.arc(54, 0, 34, 0, 7); ctx.stroke(); ctx.restore();
    if (!sl) { ctx.strokeStyle = 'rgba(35,22,41,.16)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(122, 26); ctx.lineTo(w - 30, 26); ctx.stroke(); }
    const cs = clamp(ck * 1.6, 0, 1); if (cs > 0) { ctx.fillStyle = '#1FA86A'; ctx.beginPath(); ctx.arc(54, 0, 37 * eOutBack(cs), 0, 7); ctx.fill(); }
    const p = clamp(ck * 1.6 - .5); if (p > 0) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(38, 1); ctx.lineTo(38 + 12 * clamp(p * 2), 1 + 12 * clamp(p * 2)); if (p > .5) ctx.lineTo(50 + 22 * clamp(p * 2 - 1), 13 - 28 * clamp(p * 2 - 1)); ctx.stroke(); ctx.restore(); }
    if (sl && sl.a > 0) at(118, 0, -.02 * (sl.s - 1), sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; text(txt, 0, 24, { font: f, color: C.ink, ls: 3 }); });
  }


  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                                                // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.code + .06, 5); addShake(T.amende, 16); addShake(T.retards + .14, 9); addShake(T.secret, 8);
      addShake(T.vrais, 4); addShake(T.complets, 4); addShake(T.prets, 5); addShake(T.avance + .05, 6); }
    const sh = shake(t, n);
    paperTable(n);
    ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 52, 5), cam = 1 + .025 * prog(t, T.c0, T.c1);
    ctx.translate(540, 860); ctx.scale(cam, cam); ctx.rotate(dr.r); ctx.translate(-540, -860);

    // ------------------------------------------------ light pole + traffic light (red on « retards », orange on « secret », green on « avance »)
    const state = t >= T.avance - .04 ? 'green' : t >= T.secret ? 'yellow' : t >= T.retards ? 'red' : 'yellow';
    const lx = LIGHT.x + dr.x * .7, ly = LIGHT.y + dr.y * .7;
    ctx.fillStyle = '#4A3F52'; ctx.fillRect(lx - 8, ly + 90, 16, BOOTH.y - 140 - ly - 90 + 4);
    const sw = [T.retards, T.secret, T.avance - .04].reduce((a, x) => t >= x ? x : a, -9), bump = settle(t, sw, 12, 40, .1);
    at(lx, ly, .02 * Math.sin(t * 1.3), LIGHT.s * (1 + bump), LIGHT.s * (1 - bump), () => trafficLight(state));

    // ------------------------------------------------ the bête noire behind the booth (rises on « risquez », folds into a paper plane on « avance »)
    const mk = prog(ts, T.rise, T.rise + .34), fold = eInOutCubic(prog(ts, T.avance - .04, T.avance + .1));
    if (mk > 0 && fold < 1) {
      const chipsDone = [T.vrais, T.complets, T.prets].filter(x => t >= x).length, tr = jit(97, n, .6 + chipsDone * 1.4);
      const chomp = t >= T.amende - .05 && t < T.amende + .6 ? .5 + .5 * Math.abs(Math.sin((t - T.amende) * 14)) : 1 - .25 * chipsDone;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, BOOTH.y - 138); ctx.clip();
      at(MON.x + dr.x * .9 + tr.x, MON.y + tr.y, tr.r + Math.sin(t * 2.1) * .03, 1, 1, () => monster(MON.w, mk, { n, look: -1, fold, label: false, mouth: clamp(chomp) }));
      ctx.restore();
    }
    if (fold >= 1) {                                                                  // paper plane flight + dashed trail
      const fk = prog(t, T.avance + .1, T.avance + .55), P = s => [lerp(MON.x, 1240, s) - Math.sin(s * Math.PI) * 70, MON.y - 100 - 820 * s * s - Math.sin(s * Math.PI) * 130];
      const e = Math.pow(fk, 1.5), p = P(e), q = P(Math.max(0, e - .04)), a = Math.atan2(p[1] - q[1], p[0] - q[0] + 1e-3);
      ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.45)'; ctx.lineWidth = 4; ctx.setLineDash([12, 12]); ctx.lineCap = 'round'; ctx.beginPath();
      for (let s = 0; s <= e; s += .03) { const r = P(s); s ? ctx.lineTo(...r) : ctx.moveTo(...r); } ctx.stroke(); ctx.restore();
      at(p[0], p[1], fk > 0 ? a : -.3, 1, 1, () => withShadow(20, () => paperPlane(120)));
    }

    // ------------------------------------------------ Junior's carton (x-ray on « Mauvais code »), its passport on « papiers », slides through on « avance »
    const go = eInOutCubic(prog(ts, T.avance + .1, T.avance + .58)), hs = prog(ts, T.avance + .1, T.avance + .58);
    const cx = CART.x + 440 * go + dr.x, cy = CART.y - Math.abs(Math.sin(hs * Math.PI * 2)) * 26 * (hs > 0 && hs < 1 ? 1 : 0) + dr.y * .5, cj = jit(98, n, .5);
    const csq = settle(t, T.avance + .58, 10, 34, .07);
    at(cx + cj.x, cy + cj.y, -.04 + cj.r + go * .04, 1 + csq, 1 - csq, () => {
      cartonXray(t, n, ts);
      if (t >= T.papiers - .12) { const d = drop(ts, T.papiers - .12, 260, .14);
        at(-86, -4 + d.y, -.12, d.sx, d.sy, () => goodsPassport(118, 160, 0)); }
    });

    // ------------------------------------------------ booth + barrier (open → slams shut on « retards » → lifts on « avance »)
    let op;
    if (t < T.retards) op = .985 + .015 * Math.sin(t * 3);
    else if (t < T.avance - .02) { const k = prog(t, T.retards, T.retards + .14); op = k < 1 ? 1 - k * k : -.06 * Math.exp(-(t - T.retards - .14) * 8) * Math.sin((t - T.retards - .14) * 32); }
    else op = clamp(spring(t - (T.avance - .02), 11, .45), 0, 1.12);
    booth(op);

    // ------------------------------------------------ ACT 1 : the declaration (tossed away on « Le secret »)
    const tk = eInCubic(prog(ts, T.toss, T.toss + .3));
    if (tk < 1) { const j = jit(91, n, .5), sq = settle(t, T.amende, 11, 38, .05);
      at(SH.x + dr.x * .8 + j.x - 760 * tk, SH.y + dr.y * .8 + j.y + 180 * tk, SH.r + j.r - .7 * tk, SH.s * (1 + sq) * (1 - .25 * tk), SH.s * (1 - sq) * (1 - .25 * tk), () => declaration(t, n, ts)); }

    // « cuir ! » : what the x-ray saw (on top of the sheet)
    if (t >= T.code + .04 && t < T.valeur + .55) { const k = clamp(pop(t, T.code + .04, 16, .45), 0, 1.15), fo = 1 - prog(t, T.valeur + .35, T.valeur + .55), j = jit(99, n, .6);
      at(500 + j.x, 978 + j.y, .06, k, k, () => { ctx.globalAlpha *= fo; cuirTag(clamp(k)); }); }

    // clock: pops on « retards », spins like mad, pops out before « secret »
    if (t >= T.retards - .05) { const inn = clamp(pop(t, T.retards - .05, 15, .42), 0, 1.2), out = eInCubic(prog(ts, T.secret - .25, T.secret - .05)), s = inn * (1 - out);
      if (s > .01) { const sp = (t - T.retards) * 9, wob = Math.sin(t * 40) * .04;
        at(CLOCK.x + dr.x, CLOCK.y + dr.y, wob, s, s, () => { withShadow(10, () => iconClock(CLOCK.s, sp));
          ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) { const a0 = -2.4 + i * .5 + ((n >> 1) % 2) * .12; ctx.beginPath(); ctx.arc(0, 0, CLOCK.s / 2 + 22 + i * 4, a0, a0 + .32); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, CLOCK.s / 2 + 22 + i * 4, a0 + Math.PI, a0 + Math.PI + .32); ctx.stroke(); }
          ctx.restore(); }); } }

    // ------------------------------------------------ ACT 2 : « LE SECRET » + three checks
    if (t >= T.secret - .1) { const sl = slam(t, T.secret, 1.8), d2 = drift(t, 59, 3);
      at(540 + d2.x, 336 + d2.y, -.025, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('LE SECRET', { size: 88, fill: C.amber, color: C.ink, seed: 8 }); }); }
    [T.vrais, T.complets, T.prets].forEach((t0, i) => {                                // blank checklist lands on « papiers », fills word by word
      const ta = Math.min(T.papiers - .06, T.vrais - .3, Math.max(T.secret + .2, T.toss + .3)) + i * .06; if (t < ta) return;
      const ek = prog(stepT(n), ta, ta + .24), e = eOutBack(ek), ck = prog(t, t0 + .02, t0 + .3), j = jit(110 + i, n, .5), d3 = drift(t, 60 + i, 3);
      const sl = t >= t0 - .1 ? slam(t, t0, 1.7) : null, hit = settle(t, t0, 12, 38, .05);
      at(CHIP_X + d3.x + j.x - (1 - e) * 820, CHIP_Y[i] + d3.y + j.y, (1 - clamp(e)) * -.25 + [-.02, .012, -.01][i] + j.r, 1 + hit, 1 - hit, () => chip(CHIPS[i], sl, ck, i));
    });
    // « avance » : green burst from the light
    const gb = prog(t, T.avance - .04, T.avance + .36);
    if (gb > 0 && gb < 1) at(lx, ly + 63, 0, 1, 1, () => _cf_burst(gb, 70, '#1FA86A', 1, 10));
  }

  registerScene({ id: 'conformite', z: 52, when: t => TL.in(t, CH, .4, .4), draw });
})();
