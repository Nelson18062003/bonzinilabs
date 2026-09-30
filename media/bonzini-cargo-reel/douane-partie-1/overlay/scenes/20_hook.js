'use strict';
// =============================================================================================
// 20_hook — chapitre « hook » (S1)
// « Votre carton aussi a un passeport. S'il manque une page… il reste bloqué au port. »
//  · image 0 déjà pleine : table kraft, le carton de Junior (rabat entrouvert, quelque chose bouge dedans),
//    deux bandes « VOTRE CARTON » / « A UN PASSEPORT » posées de travers.
//  · « carton » : le carton sautille (squash & stretch en deux).
//  · « passeport » : le rabat claque, le livret vert jaillit (ressort) et s'ouvre ; lignes manuscrites
//    Produit / Valeur / Origine (couleurs des 3 questions).
//  · « manque » : la page se décolle, se déchire au pli et s'envole en tournoyant (en deux) ; « ? » rouge.
//  · « reste » : tout se décolore, la caméra avance.
//  · « bloqué » : 2 images de flash blanc, COUPE sur un vrai tirage (conteneurs, duotone violet, Ken Burns,
//    lumière parasite), le carton tombe sur la pile, « au » : la barrière claque, « port » : tampon BLOQUÉ AU PORT.
// Tout est calé sur les mots (TL.wt) ; la scène s'arrête pile à la fin du chapitre (sous le volet « page »).
// =============================================================================================
(() => {
  let reg = false, TT = null, SRC = null;
  const k01 = (t, a, d) => clamp((t - a) / Math.max(1e-3, d));
  const CW = 520, CH = 380;                    // Junior's carton (table phase)
  const PW = 400, PH = 540;                    // the goods' passport
  const P_AT = [712, 872];                     // passport resting spot
  const C_A = [540, 905, 1, -.05], C_B = [312, 1050, .72, -.1];   // carton pose before / after the passport pops
  const ROWS = [['Produit', 0], ['Valeur', 1], ['Origine', 2]];

  function exactAfter(seg, str, after) { const k = nrm(str); for (const w of TL.seg(seg).words) if (w.s > after && nrm(w.w) === k) return w.s; return null; }
  function times() {
    if (TT) return TT;
    const ch = TL.ch('hook'), s1 = TL.seg('S1');
    const pass = TL.wt('S1', 'passeport'), manque = TL.wt('S1', 'manque', pass + .9);
    const bloq = TL.wt('S1', 'bloque', s1.end - 1.1), port = TL.wt('S1', 'port', bloq + .6);
    const au = exactAfter('S1', 'au', bloq - .01) ?? lerp(bloq, port, .5);
    TT = { ch, s1, carton: TL.wt('S1', 'carton'), aussi: TL.wt('S1', 'aussi'), pass, manque,
      page: TL.wt('S1', 'page', manque + .6), reste: TL.wt('S1', 'reste', bloq - .4), bloq, au, port };
    TT.peel = TT.manque - .06; TT.fly = TT.peel + .14;
    // « bloqué au port » is spoken fast: the barrier slams between « bloqué » and « au », the stamp ≥ .2 s later
    TT.bar = Math.max(TT.bloq + .26, Math.min(TT.au, TT.port - .2)); TT.st = Math.max(TT.port, TT.bar + .2);
    return TT;
  }

  // ------------------------------------------------------------------ photo source (cleaned + violet tritone)
  // It is an illustration photo of a foreign port: every carrier / lessor mark on the containers, the port-authority
  // sign and the crane roundels are painted out (local heavy blur), then the print gets a brand-violet tritone.
  const MARKS = [[106, 465, 18, 22], [18, 515, 18, 22], [103, 520, 14, 22], [18, 565, 18, 22], [170, 614, 18, 22], [12, 668, 16, 12],
    [195, 511, 30, 12], [240, 559, 16, 11], [160, 410, 12, 9], [242, 405, 12, 9], [450, 615, 14, 11], [497, 567, 17, 22], [515, 630, 17, 22],
    [532, 612, 12, 12], [566, 515, 17, 22], [565, 575, 17, 22], [762, 540, 17, 22], [675, 492, 104, 14], [1005, 508, 30, 12],
    [542, 265, 16, 17], [669, 251, 17, 17], [14, 348, 16, 17]];
  function src() {
    if (SRC) return SRC;
    const im = ph('containers_cranes'); if (!im) return null;
    const w = im.naturalWidth, h = im.naturalHeight, c = makeCanvas(w, h), g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    for (let pass = 0; pass < 2; pass++) for (const [x, y, rx, ry] of MARKS) {
      g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.clip(); g.filter = 'blur(10px)'; g.drawImage(c, 0, 0); g.restore(); }
    const o = makeCanvas(w, h), og = o.getContext('2d'); og.filter = 'blur(.7px)'; og.drawImage(c, 0, 0); og.filter = 'none';
    const d = og.getImageData(0, 0, w, h), p = d.data;
    const S = [23, 11, 38], M = [112, 46, 190], L = [247, 240, 255];                 // ink violet → brand violet → pale lilac
    for (let i = 0; i < p.length; i += 4) {
      let l = (p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) / 255; l = clamp((l - .06) / .86); l = l * l * (3 - 2 * l);
      const a = l < .5 ? S : M, b = l < .5 ? M : L, k = l < .5 ? l * 2 : (l - .5) * 2;
      p[i] = a[0] + (b[0] - a[0]) * k; p[i + 1] = a[1] + (b[1] - a[1]) * k; p[i + 2] = a[2] + (b[2] - a[2]) * k;
    }
    og.putImageData(d, 0, 0);
    SRC = o; return o;
  }
  /** a photo print lying on the table (our own processed source), centred */
  function print(w, h, zoom, lift) {
    const b = 18;
    withShadow(lift, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b); });
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    photoCover(src(), -w / 2, -h / 2, w, h, { zoom, fx: .44, fy: .5 });
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    const v = ctx.createRadialGradient(0, 0, h * .35, 0, 0, h * .75); v.addColorStop(0, 'rgba(20,10,30,0)'); v.addColorStop(1, 'rgba(20,10,30,.28)');
    ctx.fillStyle = v; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.fillStyle = C.tape; at(-w / 2 + 30, -h / 2 - b + 2, -.55, 1, 1, () => ctx.fillRect(-60, -19, 120, 38)); at(w / 2 - 30, -h / 2 - b + 2, .55, 1, 1, () => ctx.fillRect(-60, -19, 120, 38));
  }

  // ------------------------------------------------------------------ Junior's carton with a lifting top flap
  /** theta = flap angle around the top edge (0 closed, π/2 upright, π flat open) */
  function box(w, h, theta) {
    withShadow(6, () => { ctx.fillStyle = C.kraftD; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); });
    juniorCarton(w, h, { tape: false });
    const L = h / 2, c = Math.cos(theta), s = Math.sin(theta), y0 = -h / 2;
    if (theta > .02) {                                           // dark inside, visible between the flap and the seam
      const yf = y0 + L * Math.max(c, 0);
      const g = ctx.createLinearGradient(0, yf, 0, -2); g.addColorStop(0, '#34220F'); g.addColorStop(1, '#6E4C2B');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + 8, yf, w - 16, -2 - yf);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 8, -12, w - 16, 10);           // lip of the closed bottom flap
    }
    const ww = 1 + .12 * s, ye = y0 + L * c;
    withShadow(4 + 26 * s, () => {
      ctx.beginPath(); ctx.moveTo(-w / 2, y0); ctx.lineTo(w / 2, y0); ctx.lineTo(w / 2 * ww, ye); ctx.lineTo(-w / 2 * ww, ye); ctx.closePath();
      ctx.fillStyle = c >= 0 ? TEX.kraft : '#E4C697'; ctx.fill();
    });
    ctx.beginPath(); ctx.moveTo(-w / 2, y0); ctx.lineTo(w / 2, y0); ctx.lineTo(w / 2 * ww, ye); ctx.lineTo(-w / 2 * ww, ye); ctx.closePath();
    ctx.fillStyle = c >= 0 ? `rgba(60,35,15,${.3 * s})` : `rgba(120,80,40,${.25 * (1 + c)})`; ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 2; ctx.stroke();
    if (c < 0) { ctx.strokeStyle = 'rgba(138,98,56,.35)'; ctx.lineWidth = 2;                 // corrugation on the flap's inner face
      for (let i = 1; i < 9; i++) { const x = -w / 2 + i * w / 9; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x * ww, ye); ctx.stroke(); } }
  }

  // ------------------------------------------------------------------ passport pages
  function rowY(h, i) { return -h / 2 + 300 + i * 92; }
  /** the data page: carton portrait, name, 3 handwritten rows; wk = writing progress 0..1 (rows one after the other) */
  function pageFace(w, h, wk, t) {
    at(-w / 2 + 96, -h / 2 + 108, -.03, 1, 1, () => {
      withShadow(3, () => { ctx.fillStyle = '#D6E7EE'; ctx.fillRect(-72, -60, 144, 120); });
      ctx.strokeStyle = 'rgba(14,107,78,.55)'; ctx.lineWidth = 3; ctx.strokeRect(-72, -60, 144, 120);
      at(0, 6, -.08, 1, 1, () => juniorCarton(104, 76, { tape: false }));
    });
    text('JUNIOR', -w / 2 + 190, -h / 2 + 96, { font: font(FF.stencil, 52, 900), color: DC.green, ls: 3 });
    ctx.save(); ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();          // signature squiggle
    for (let i = 0; i <= 30; i++) { const x = -w / 2 + 192 + i * 5.4, y = -h / 2 + 138 + Math.sin(i * .9) * 10 - i * .5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(14,107,78,.35)'; ctx.fillRect(-w / 2 + 26, -h / 2 + 186, w - 52, 4);
    ROWS.forEach(([lab, q], i) => {
      const y = rowY(h, i), k = clamp(wk * 3 - i);
      ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(14,107,78,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 30, y + 16); ctx.lineTo(w / 2 - 30, y + 16); ctx.stroke(); ctx.restore();
      if (k <= 0) return;
      ctx.fillStyle = QCOL[q]; ctx.beginPath(); ctx.arc(-w / 2 + 44, y - 16, 12, 0, 7); ctx.fill();
      handText(lab, -w / 2 + 70, y, 50, { align: 'left', write: k, color: QCOL[q], pen: false });
      const ck = clamp((wk * 3 - i - .7) / .3);
      if (ck > 0) { const s = clamp(spring(ck * .35, 16, .45), 0, 1.25); at(w / 2 - 56, y - 16, 0, s, s, () => iconCheck(50)); }
    });
  }
  /** what is left once the page is gone: torn stub on the fold, empty dashed rows, big red « ? » */
  function missingFace(w, h, t, n, T) {
    ROWS.forEach(([, q], i) => { const y = rowY(h, i);
      ctx.save(); ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(200,16,46,.55)'; ctx.lineWidth = 4; rrect(-w / 2 + 34, y - 52, w - 68, 66, 12); ctx.stroke(); ctx.restore(); });
    ctx.save(); ctx.fillStyle = '#FBF7EA';
    const e = tornLine(-w / 2 + 30, -h / 2 + 6, -w / 2 + 30, h / 2 - 6, 71, 7, 14);
    ctx.beginPath(); ctx.moveTo(-w / 2 + 2, -h / 2 + 6); for (const p of e) ctx.lineTo(...p); ctx.lineTo(-w / 2 + 2, h / 2 - 6); ctx.closePath();
    ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.fill(); ctx.restore();
    const q = pop(t, T.page - .08, 15, .4);
    if (q > 0) {
      const pulse = t > T.reste ? 1 + .06 * Math.abs(Math.sin(stepT(n) * 9)) : 1, j = jit(209, n, 1.2);
      at(10 + j.x, -40 + j.y, -.08 + j.r, q * pulse, q * pulse, () => {
        text('?', 0, 70, { font: font(FF.hand, 230, 800), align: 'center', color: DC.red });
      });
    }
  }
  /** back of a torn-out page (seen while it tumbles) */
  function pageBack(w, h) {
    ctx.strokeStyle = 'rgba(14,107,78,.2)'; ctx.lineWidth = 1.5;
    for (let y = -h / 2 + 40; y < h / 2; y += 22) { ctx.beginPath(); ctx.moveTo(-w / 2 + 20, y); ctx.lineTo(w / 2 - 20, y); ctx.stroke(); }
  }
  /** page outline with a torn left edge (where it ripped off the fold) */
  function tornPagePath(w, h) {
    const e = tornLine(-w / 2 + 30, h / 2, -w / 2 + 30, -h / 2, 71, 7, 14);
    ctx.beginPath(); ctx.moveTo(-w / 2 + 30, -h / 2); ctx.lineTo(w / 2 - 14, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 14);
    ctx.lineTo(w / 2, h / 2 - 14); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 14, h / 2); for (const p of e) ctx.lineTo(...p); ctx.closePath();
  }

  // ------------------------------------------------------------------ small table props (parallax layer)
  function decor(t, n) {
    const d = drift(t, 27, 3);
    at(-8 + d.x, 742 + d.y, 0, 1, 1, () => {                                    // roll of packing tape, half off-frame
      withShadow(10, () => { ctx.fillStyle = 'rgba(236,160,60,.95)'; ctx.beginPath(); ctx.arc(0, 0, 104, 0, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.fill();
      ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.fill();
      ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, 47, 0, 7); ctx.fill();
    });
    marker(1004 + d.x * 1.2, 1196 + d.y, 2.35, C.violetD);                          // felt marker lying on the table
    ctx.save(); ctx.fillStyle = 'rgba(251,246,236,.9)';                               // paper scraps
    for (const [x, y, r, s] of [[150, 1190, .5, 34], [950, 640, -.3, 26], [180, 610, 1.1, 22]]) at(x + d.x, y + d.y, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-s, -s * .4); ctx.lineTo(s, -s * .7); ctx.lineTo(s * .6, s * .6); ctx.lineTo(-s * .8, s * .5); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }

  // ------------------------------------------------------------------ phase 1: on the packing table
  function drawTable(t, n, T) {
    const ts = stepT(n), d = drift(t, 20, 5);
    const push = 1 + .035 * eInOutCubic(k01(t, T.reste - .15, T.bloq - T.reste + .15));
    ctx.translate(W / 2 + d.x, 880 + d.y); ctx.rotate(d.r); ctx.scale(push, push); ctx.translate(-W / 2, -880);
    decor(t, n);

    // title strips (present at frame 0; the second one kicks on « passeport »)
    { const j1 = jit(201, n, .8), j2 = jit(202, n, .8), e2 = T.pass - .02;
      const s2 = t >= e2 ? 1 + .13 * Math.exp(-(t - e2) * 7) * Math.cos((t - e2) * 24) : 1;
      at(506 + j1.x, 404 + j1.y, -.035 + j1.r, 1, 1, () => strip('VOTRE CARTON', { size: 90, seed: 3 }));
      at(588 + j2.x, 526 + j2.y, .025 + j2.r, s2, s2, () => strip('A UN PASSEPORT', { size: 90, fill: DC.green, color: DC.yellow, seed: 5 })); }

    // carton pose: A → B while the passport pops; a hop on « carton »; trembles on « reste »
    const km = eInOutCubic(k01(ts, T.pass - .18, .36));
    let cx = lerp(C_A[0], C_B[0], km), cy = lerp(C_A[1], C_B[1], km), cs = lerp(C_A[2], C_B[2], km), cr = lerp(C_A[3], C_B[3], km);
    let sx = 1, sy = 1;
    const hk = k01(ts, T.carton - .04, .34);
    if (hk > 0 && hk < 1) { cy -= 78 * Math.sin(Math.PI * hk); sy = 1 + .07 * Math.sin(Math.PI * hk); sx = 1 - .05 * Math.sin(Math.PI * hk); }
    else if (hk >= 1) { const s = t - (T.carton + .3); if (s < .6) { const q = Math.exp(-s * 9) * Math.cos(s * 36) * .08; sx = 1 + q; sy = 1 - q; } }
    const shiver = t > T.manque ? (t > T.reste ? 2.6 : 1.2) : .6, jc = jit(203, n, shiver);
    const breathe = 1 + .012 * Math.sin(ts * 7);
    // flap: ajar at rest, bumped from inside, bursts open on « passeport »
    let th = .36 + .05 * Math.sin(ts * 11);
    for (const b of [.12, T.carton + .05, T.aussi, lerp(T.aussi, T.pass, .55)]) { const k = k01(ts, b, .24); if (k > 0 && k < 1) th += .5 * Math.sin(Math.PI * k); }
    const tOpen = T.pass - .13;
    if (t >= tOpen) th = lerp(th, 2.55, clamp(spring(t - tOpen, 16, .38), 0, 1.15));
    at(cx + jc.x, cy + jc.y, cr + jc.r, cs * sx, cs * sy * breathe, () => box(CW, CH, th));
    // cartoon « it moves inside » ticks around the flap before it bursts
    if (t < tOpen) for (const b of [.12, T.carton + .05, T.aussi, lerp(T.aussi, T.pass, .55)]) {
      const k = k01(ts, b, .3); if (k <= 0 || k >= 1) continue;
      ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * k); ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (const [a, r0] of [[-2.3, 250], [-1.57, 232], [-.84, 250]]) { const x = cx + Math.cos(a) * r0 * cs, y = cy - CH * .1 + Math.sin(a) * r0 * .9 * cs;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 34, y + Math.sin(a) * 34); ctx.stroke(); }
      ctx.restore();
    }

    // passport: springs out of the carton, lands on the right and opens
    const t0 = T.pass - .1;
    if (t >= t0) {
      const kp = eOutCubic(k01(t, t0, .42)), sp = clamp(spring(t - t0, 13, .5), 0, 1.14);
      const ox = cx + Math.sin(cr) * CH * .25 * cs, oy = cy - Math.cos(cr) * CH * .25 * cs;           // mouth of the carton
      const px = lerp(ox, P_AT[0], kp), py = lerp(oy, P_AT[1], kp) - 70 * Math.sin(Math.PI * kp);
      const ps = lerp(.22, 1, sp), pr = lerp(-1.1, .04, kp) + .02 * Math.sin(ts * 3);
      const kOpen = k01(t, T.pass + .2, .34), wk = k01(t, T.pass + .38, .38);
      const jp = jit(204, n, t > T.reste ? 2 : .6);
      const peeled = t >= T.peel;
      at(px + jp.x, py + jp.y, pr + jp.r, ps, ps, () => {
        if (kOpen >= .98) { ctx.fillStyle = '#0A4F3A'; rrect(-PW / 2 - 16, -PH / 2 + 4, 40, PH - 8, 12); ctx.fill(); }      // back cover peeking at the fold
        goodsPassport(PW, PH, kOpen, { inside: (w, h) => {
          if (!peeled) pageFace(w, h, wk, t); else missingFace(w, h, t, n, T);
          ctx.fillStyle = 'rgba(10,79,58,.18)'; ctx.fillRect(-w / 2, -h / 2 + 10, 10, h - 20);                          // fold shadow
          ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(w / 2 - 2 + i * 3, -h / 2 + 12); ctx.lineTo(w / 2 - 2 + i * 3, h / 2 - 12); ctx.stroke(); }
        } });
      });

      // the page rips off the fold and flies away tumbling (poses on twos)
      if (peeled) {
        const k0 = eOutCubic(k01(t, T.peel, .14)), kf = k01(ts, T.fly, .8);
        if (kf < 1) {
          const e = Math.pow(kf, 1.15), fx = 700 * e, fy = -860 * e + 80 * Math.sin(Math.PI * kf);
          const spin = 3.4 * Math.pow(kf, 1.1), flip = Math.cos(kf * 7.2), fsx = Math.sign(flip || 1) * Math.max(.12, Math.abs(flip));
          at(px + fx, py + fy, pr + spin, ps * (1 - .22 * kf), ps * (1 - .22 * kf), () => {
            ctx.translate(-PW / 2, 0); ctx.rotate(-.09 * k0); ctx.scale((1 - .05 * k0) * (kf > 0 ? fsx : 1), 1); ctx.translate(PW / 2, 0);
            withShadow(8 + 30 * k0 + 40 * kf, () => { ctx.fillStyle = '#F7F2E4'; tornPagePath(PW, PH); ctx.fill(); });
            ctx.save(); tornPagePath(PW, PH); ctx.clip();
            if (fsx > 0 || kf === 0) { pageBack(PW, PH); pageFace(PW, PH, 1, t); } else pageBack(PW, PH);
            ctx.restore();
          });
        }
        // paper crumbs from the tear
        const sb = t - T.fly;
        if (sb > 0 && sb < .8) for (let i = 0; i < 9; i++) {
          const x = px - PW / 2 * ps + 20 + (rnd(i * 3.1) - .3) * 40 + (rnd(i * 5.3) - .5) * 260 * sb, y = py + (rnd(i * 7.7) - .5) * PH * .8 * ps + 700 * sb * sb - 120 * sb * rnd(i * 2.2);
          at(x, y, sb * 9 * (rnd(i) - .5), 1, 1, () => { ctx.globalAlpha = clamp((.8 - sb) / .3); ctx.fillStyle = i % 3 ? '#F7F2E4' : 'rgba(14,107,78,.8)'; ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(9, -3); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill(); });
        }
      }
    }

    // « il reste… » : colour drains out of the table world
    const g = .8 * eInOutCubic(k01(t, T.reste - .12, .45));
    if (g > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = g; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = g * .35; ctx.fillStyle = '#B8B0C4'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  // ------------------------------------------------------------------ phase 2: CUT to the port (real photo)
  function drawPort(t, n, T) {
    const tb = T.bloq, end = T.ch.end, ts = stepT(n), d = drift(t, 21, 5);
    const zin = 1 + .05 * eInOutCubic(k01(t, end - .45, .45));
    ctx.translate(W / 2 + d.x, 800 + d.y); ctx.rotate(d.r); ctx.scale(zin, zin); ctx.translate(-W / 2, -800);
    // darker table around the print (night mood)
    ctx.fillStyle = 'rgba(35,22,41,.28)'; ctx.fillRect(-60, -60, W + 120, H + 120);
    const land = eOutCubic(k01(t, tb, .16)), s = lerp(1.07, 1, land);
    at(540, 792, -.02, s, s, () => {
      print(900, 1130, lerp(1.02, 1.06, k01(t, tb, end - tb)), lerp(30, 12, land));
      creditTag(CREDIT.containers_cranes, 420, 553);
    });
    // Junior's paper carton falls onto the stack (drop + squash on landing)
    const t0 = tb + .03;
    if (t >= t0) {
      const dp = drop(t, t0, 1150, .26), tilt = dp.landed ? 0 : .35 * (1 - k01(t, t0, .26)), j = jit(211, n, .8);
      at(418 + j.x, 1008 + dp.y + j.y, -.12 + tilt + j.r, dp.sx, dp.sy, () => {
        withShadow(dp.landed ? 12 : 60, () => { ctx.fillStyle = C.kraftD; rrect(-150, -110, 300, 220, 6); ctx.fill(); });
        juniorCarton(300, 220);
      });
      if (dp.landed) { const sb = t - t0 - .26; if (sb < .45) for (let i = 0; i < 8; i++) {                 // dust puff
        const a = Math.PI + (i / 7) * Math.PI, r = 150 + 260 * eOutCubic(sb / .45);
        ctx.save(); ctx.globalAlpha = .55 * (1 - sb / .45); ctx.fillStyle = '#F4ECFF'; ctx.beginPath(); ctx.arc(418 + Math.cos(a) * r, 1110 + Math.sin(a) * r * .25, 16 + 20 * sb, 0, 7); ctx.fill(); ctx.restore(); } }
    }
    // the barrier: slides in raised, slams down exactly on « au »
    const bi = eOutBack(k01(t, tb + .1, .24));
    let open = 1;
    if (t >= T.bar - .12) { open = 1 - eInCubic(k01(t, T.bar - .12, .12)); if (t > T.bar) { const q = t - T.bar; open = -.08 * Math.exp(-q * 9) * Math.cos(q * 30); } }
    at(lerp(-300, 96, bi), 1132, 0, 1.3, 1.3, () => barrier(740, open));
    // stamp « BLOQUÉ AU PORT » slams on « port » (on a paper disc so it stays readable on the photo)
    const sl = slam(t, T.st, 2.3);
    if (sl.a > 0) {
      const j = jit(212, n, .5);
      at(606 + j.x, 598 + j.y, -.12, sl.s, sl.s, () => {
        ctx.globalAlpha *= sl.a;
        withShadow(16, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(0, 0, 254, 0, 7); ctx.fill(); });
        ctx.fillStyle = C.tape; at(-40, -262, -.2, 1, 1, () => ctx.fillRect(-70, -20, 140, 40));
        roundStamp('AU PORT · AU PORT · ', 'BLOQUÉ', 232, DC.red, { rot: .1 });
      });
    }
    lightLeak(k01(t, tb, .6), 7);
  }

  registerScene({
    id: 'hook', z: 30,
    when: t => TL.in(t, 'hook', .4, .4),
    draw(t, n) {
      const T = times();
      if (t >= T.ch.end) return;                                   // the « page » wipe covers the cut to « bete »
      if (!reg) { reg = true; addShake(T.pass - .1, 6); addShake(T.bloq, 10); addShake(T.bar, 12); addShake(T.st, 16);
        captionY((tt, p) => p && p.seg === 'S1' && p.words.some(w => nrm(w.w) === 'bloque') ? 1474 : null); }
      const sh = shake(t, n); ctx.translate(sh.x, sh.y);
      ctx.save();
      if (t < T.bloq) drawTable(t, n, T); else drawPort(t, n, T);
      ctx.restore();
      if (t >= T.bloq - 2 / FPS - 1e-4 && t < T.bloq) { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-60, -60, W + 120, H + 120); }   // 2-frame white flash
    },
  });
})();
