'use strict';
// S20–S21 « Chez Bonzini » (chapter bonzini) — full frame, the note spine is gone. FIRST Bonzini branding moment:
// warm and confident, never salesy, and NO number anywhere (no amount, no rate digits, no weight, no volume).
// S20  A1 · a kraft pay-slot wearing the Bonzini logo (its four pieces snap together on « Bonzini »); a bundle of FCFA notes
//           slides in on « vous payez », a receipt stub « PAYÉ · ¥ » comes out on « fournisseurs »; « F CFA → ¥ » in marker.
//           Headline « Payez vos fournisseurs en F CFA ».
//      A2 · pan to a paper phone: « Vous payez ▨ F CFA / Votre fournisseur reçoit ▨ ¥ / Taux appliqué ▨ » (hatched blocks,
//           never digits), chip « Taux affiché AVANT de confirmer », a paper finger presses « Confirmer » on « confirmer ».
// S21  B  · pan to the Guangzhou reception vignette: carton + the series' blue sea label (fictional code BZ-000000), one beat
//           per verb (scanner beam · camera flash (2 white frames, carton area only) · scale, needle settles · tape measure on
//           3 edges), four boxes tick in rhythm; map strip Guangzhou → Douala, the paper boat halfway, Junior already tapping
//           his calculator; « Votre volume connu AVANT l'arrivée » sits in the caption band (captions hidden for that line).
// Chapter start is covered by the tape wipe; everything is gone at the chapter end (the note wipe covers the cut to S22).
(() => {
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);
  const PAN = 1180;
  function times() {
    const ch = TL.ch('bonzini');
    const o = {
      c0: ch.start, c1: ch.end,
      bonzini: w('S20', 'bonzini'), vous: w('S20', 'vous'), payez: w('S20', 'payez'), fourn: w('S20', 'fournisseurs'),
      francs: w('S20', 'francs'), cfa: w('S20', 'cfa'), taux: w('S20', 'taux'), applique: w('S20', 'applique'),
      affiche: w('S20', 'affiche'), avant: w('S20', 'avant'), confirmer: w('S20', 'confirmer'), s20e: TL.seg('S20').end,
      guangzhou: w('S21', 'guangzhou'), colis: w('S21', 'colis'), scanne: w('S21', 'scanne'), photo: w('S21', 'photographie'),
      pese: w('S21', 'pese'), mesure: w('S21', 'mesure'), des: w('S21', 'des'), vous2: w('S21', 'vous'), connaissez: w('S21', 'connaissez'),
      volume: w('S21', 'volume'), avant2: w('S21', 'avant'), arrivee: w('S21', 'arrivee'), s21e: TL.seg('S21').end,
    };
    o.gulp = o.payez + .26;                                   // the bundle is swallowed
    o.panA = Math.max(o.cfa + .45, o.taux - .32);             // pay slot → phone
    o.panB = o.s20e + .02;                                    // phone → Guangzhou
    o.flash = o.photo + .18;
    o.ticks = [o.scanne + .24, o.flash + .14, o.pese + .26, o.mesure + .5];
    o.tapes = [o.mesure - .02, o.mesure + .2, o.mesure + .42];
    o.line = o.vous2 - .08;
    return o;
  }

  // ------------------------------------------------------------------ little props
  function tornPath(tw, th, seed, amp = 2.4) {
    ctx.beginPath(); const tp = tornLine(-tw / 2, -th / 2, tw / 2, -th / 2, seed, amp, 11), bt = tornLine(tw / 2, th / 2, -tw / 2, th / 2, seed + 5, amp, 11);
    ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath();
  }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }
  /** masked value: rounded block with diagonal hatching crawling on twos (no digits, ever) */
  function hatch(x, y, bw, bh, n, o = {}) {
    ctx.save(); rrect(x, y, bw, bh, o.r ?? 14); ctx.fillStyle = o.fill || 'rgba(35,22,41,.08)'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = o.col || 'rgba(35,22,41,.28)'; ctx.lineWidth = o.lw || 7;
    const ph = (stepT(n) * (o.speed ?? 30)) % 22;
    for (let xx = x - bh - 22 + ph; xx < x + bw + bh; xx += 22) { ctx.beginPath(); ctx.moveTo(xx, y + bh + 4); ctx.lineTo(xx + bh + 8, y - 4); ctx.stroke(); }
    if (o.sweep != null && o.sweep > 0 && o.sweep < 1) { const sx = x - 80 + o.sweep * (bw + 160), g = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, bw, bh); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = o.edge || 'rgba(35,22,41,.18)'; ctx.lineWidth = 2; rrect(x, y, bw, bh, o.r ?? 14); ctx.stroke(); ctx.restore();
  }
  /** hand-drawn check mark, centre (0,0), progress k */
  function checkMark(k, col = C.violetD, lw = 11, s = 1) {
    if (k <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const a = [-22 * s, 0], b = [-5 * s, 19 * s], c = [30 * s, -30 * s], k1 = clamp(k / .35), k2 = clamp((k - .35) / .65);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(lerp(a[0], b[0], k1), lerp(a[1], b[1], k1)); if (k2 > 0) ctx.lineTo(lerp(b[0], c[0], k2), lerp(b[1], c[1], k2)); ctx.stroke(); ctx.restore();
  }
  function sparks(x, y, s, r0, r1, count, seed, cols = [C.amber, C.violet, C.orange]) {
    if (s < 0 || s > .45) return; const k = eOutCubic(s / .45); ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.globalAlpha *= 1 - k * .9;
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + rnd(seed + i) * .3, ra = lerp(r0, r1, k), rb = ra + 26 * (1 - k * .6);
      ctx.strokeStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * ra, y + Math.sin(a) * ra); ctx.lineTo(x + Math.cos(a) * rb, y + Math.sin(a) * rb); ctx.stroke(); }
    ctx.restore();
  }
  function puff(x, y, s, seed, col = C.kraftL) {
    if (s < 0 || s > .4) return; ctx.save();
    for (let k = 0; k < 8; k++) { const a = Math.PI * (k / 7) + (k % 2 ? Math.PI : 0), v = 70 + rnd(seed * 9 + k) * 60;
      ctx.globalAlpha = clamp(1 - s / .4) * .55; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * s * 2.6, y + Math.sin(a) * 26 * s * 2, 6 + 5 * rnd(k + seed), 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function pin(col = M.red) {
    ctx.save(); ctx.strokeStyle = '#8C939B'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
    withShadow(8, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -40, 17, 0, 7); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-5, -45, 5, 0, 7); ctx.fill(); ctx.restore();
  }
  /** point + heading at arc-length fraction p along a polyline */
  function along(pts, p) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const lim = clamp(p) * L[L.length - 1]; let i = 1; while (i < pts.length - 1 && L[i] < lim) i++;
    const k = (lim - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), a = pts[i - 1], b = pts[i];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  function plateLabel(s, size = 44, fill = C.cream, col = C.ink) {
    const f = font(FF.stencil, size, 900), lw = measure(s, f, 3) + 34;
    withShadow(5, () => { ctx.fillStyle = fill; rrect(-lw / 2, -size * .72, lw, size * 1.3, 8); ctx.fill(); });
    text(s, 0, size * .36, { font: f, align: 'center', color: col, ls: 3 });
  }

  // ================================================================== S20 · A1 — the pay slot
  const SX = 450, SY = 690, BW = 480, BH = 370;
  const SCATTER = { wingTop: [-300, -215, -1.3], wingBot: [-325, 185, 1.1], amber: [300, -230, 1.5], orange: [325, 175, -1.2] };
  function logoOffsets(t, n) {
    const k = eInOutCubic(prog(t, T.bonzini - .32, T.bonzini + .02)), ts = stepT(n), o = {}, a = clamp((t - T.c0 - .1) / .3);
    Object.entries(SCATTER).forEach(([role, [x, y, r]], i) => {
      const f = 1 - k; o[role] = [(x + Math.sin(ts * 1.7 + i * 2) * 18) * f, (y + Math.cos(ts * 1.3 + i) * 16) * f, (r + Math.sin(ts * 1.1 + i) * .2) * f, a];
    });
    return o;
  }
  function bundle() {
    noteStack(300, 142, 4, { value: 10000, serial: 'SPÉCIMEN' });
    ctx.fillStyle = C.violet; ctx.fillRect(34, -84, 56, 152); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(34, -84, 9, 152);
    ctx.fillStyle = C.violetD; ctx.fillRect(85, -84, 5, 152);
  }
  function stub(sw, sh, stamp) {
    withShadow(8, () => { ctx.fillStyle = M.paper; ctx.beginPath(); ctx.moveTo(-sw / 2, -sh / 2); ctx.lineTo(sw / 2, -sh / 2);
      for (let y = -sh / 2; y < sh / 2 - 1; y += 19.6) { ctx.lineTo(sw / 2 - 12, y + 9.8); ctx.lineTo(sw / 2, y + 19.6); }
      ctx.lineTo(-sw / 2, sh / 2); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(35,22,41,.16)'; for (let i = 0; i < 11; i++) ctx.fillRect(-sw / 2 + 24 + i * 21, -sh / 2 + 20, 11, 13);
    ctx.strokeStyle = 'rgba(35,22,41,.4)'; ctx.setLineDash([7, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-sw / 2 + 18, -sh / 2 + 50); ctx.lineTo(sw / 2 - 28, -sh / 2 + 50); ctx.stroke(); ctx.setLineDash([]);
    text('PAYÉ · ¥', -14, 34, { font: font(FF.stencil, 70, 900), align: 'center', color: C.ink, ls: 3 });
    if (stamp > 0) at(sw / 2 - 52, sh / 2 - 38, -.2, lerp(1.6, 1, clamp(stamp * 3)), lerp(1.6, 1, clamp(stamp * 3)), () => {
      ctx.globalAlpha *= clamp(stamp * 4) * .9; ctx.strokeStyle = C.violet; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); ctx.stroke(); checkMark(1, C.violet, 6, .6); });
  }
  function paySlot(t, n, lo) {
    withShadow(18, () => { ctx.fillStyle = C.kraftD; rrect(-BW / 2 + 6, -BH / 2 + 12, BW, BH, 24); ctx.fill(); });
    ctx.fillStyle = TEX.kraft; rrect(-BW / 2, -BH / 2, BW, BH, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,210,.4)'; ctx.lineWidth = 2; rrect(-BW / 2 + 4, -BH / 2 + 4, BW - 8, BH - 8, 19); ctx.stroke();
    for (const s of [-1, 1]) {                                                    // the two mouths (in: notes · out: receipt)
      ctx.fillStyle = 'rgba(38,22,10,.88)'; rrect(s * BW / 2 - 10, -114, 20, 228, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,210,.45)'; ctx.fillRect(s * BW / 2 - (s > 0 ? 18 : -13), -110, 5, 220);
    }
    ctx.fillStyle = C.cream; rrect(-182, -154, 364, 308, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; ctx.stroke();
    tape(-182, -142, -.7, 80); tape(182, 142, -.7, 80);
    const led = t > T.gulp && t < T.fourn + .1 ? Math.floor(n / 3) % 2 === 0 : t >= T.fourn + .1;
    ctx.fillStyle = led ? (t >= T.fourn + .1 ? M.gain : C.amber) : '#6E5A40'; ctx.beginPath(); ctx.arc(BW / 2 - 30, -BH / 2 + 28, 11, 0, 7); ctx.fill();
    if (led) { ctx.fillStyle = 'rgba(255,230,160,.35)'; ctx.beginPath(); ctx.arc(BW / 2 - 30, -BH / 2 + 28, 22, 0, 7); ctx.fill(); }
    // logo (pieces fly in and snap on « Bonzini »), then the name stamps
    const tb = T.bonzini, bump = t > tb ? .16 * Math.exp(-(t - tb) * 7) * Math.sin((t - tb) * 26) : 0;
    drawLogo(0, -40, 222 * (1 + bump), { offsets: lo });
    const nk = prog(t, tb + .06, tb + .18);
    if (nk > 0) at(0, 118, 0, lerp(1.25, 1, eOutCubic(nk)), lerp(1.25, 1, eOutCubic(nk)), () => text('BONZINI', 0, 0, { font: font(FF.stencil, 62, 900), align: 'center', color: C.ink, ls: 10, alpha: nk }));
  }
  function drawA1(t, n, ox) {
    if (ox <= -PAN) return;
    const e = eInOutCubic(prog(t, T.payez - .3, T.payez + .3)), z = lerp(1.12, 1, e);
    const camX = lerp(140, 0, eInOutCubic(prog(t, T.gulp - .1, T.fourn + .35)));     // slot starts centred-right, glides left as the receipt comes out
    ctx.save(); ctx.translate(ox + SX + camX, SY + lerp(-60, 0, e)); ctx.scale(z, z); ctx.translate(-SX, -SY);
    // bundle → slot
    // slides up to the mouth on « vous », waits (a nervous wiggle), is swallowed on « payez »
    const b1 = eOutCubic(prog(t, T.vous - .3, T.vous + .12)), b2 = eInCubic(prog(t, T.payez - .04, T.gulp)), wait = SX - BW / 2 - 90;
    if (b1 > 0 && b2 < 1) { const j = jit(610, n, .6), bx = lerp(lerp(-170, wait, b1), SX, b2), wig = b1 >= 1 && b2 <= 0 ? Math.sin(t * 22) * .03 : 0;
      at(bx + j.x, SY + 8 - Math.sin(b1 * Math.PI) * 24 + j.y, lerp(-.16, 0, b1) + wig, 1, 1, () => withShadow(10, bundle)); }
    // receipt stub comes out on the right (stepped: the printer feeds on twos)
    const sk = eOutCubic(prog(stepT(n), T.fourn - .04, T.fourn + .5));
    if (sk > 0) { const settle = eOutBack(prog(t, T.fourn + .5, T.fourn + .8)), j = jit(611, n, .4);
      at(lerp(SX, SX + BW / 2 + 152, sk) + j.x, SY + 4 + settle * 16 + j.y, -.06 * settle + j.r, 1, 1, () => stub(300, 196, prog(t, T.fourn + .62, T.fourn + 1.2))); }
    // the slot itself
    const d = drop(t, T.c0 + .1, 380, .2);
    if (d.a) { const g = t > T.gulp ? Math.exp(-(t - T.gulp) * 9) * Math.cos((t - T.gulp) * 34) * .07 : 0;
      const busy = t > T.gulp && t < T.fourn ? 2.6 : .6, j = jit(612, n, busy), br = 1 + .006 * Math.sin(t * 3);
      at(SX + j.x, SY + d.y + j.y, -.015 + j.r, d.sx * (1 + g) * br, d.sy * (1 - g) * br, () => paySlot(t, n, logoOffsets(t, n)));
      if (d.landed) puff(SX, SY + BH / 2, t - T.c0 - .4, 3);
      sparks(SX, SY - 40, t - T.bonzini, 140, 240, 14, 5);
      if (t > T.gulp && t < T.fourn) for (let i = 0; i < 3; i++) { const s = ((t - T.gulp) * 2.2 + i / 3) % 1;   // the machine « thinks »: steam of paper bits
        ctx.save(); ctx.globalAlpha = (1 - s) * .8; ctx.fillStyle = [C.amber, C.violet, C.orange][i]; at(SX + BW / 2 - 30 + Math.sin(s * 6 + i) * 14, SY - BH / 2 - s * 90, s * 4, 1, 1, () => ctx.fillRect(-7, -4, 14, 8)); ctx.restore(); } }
    // « F CFA  →  ¥ » in marker
    const fk = prog(t, T.francs - .06, T.francs + .34), ak = prog(t, T.cfa - .12, T.cfa + .26), yk = prog(t, T.cfa + .2, T.cfa + .4);
    if (fk > 0) handText('F CFA', 205, 1068, 82, { write: fk, color: C.violetD, pen: fk < 1 });
    if (ak > 0) handArrow([[352, 1040], [520, 994], [690, 1036]], ak, C.ink, 9);
    if (yk > 0) handText('¥', 800, 1080, 104, { write: yk, color: C.orange, pen: yk < 1 });
    ctx.restore();
  }

  // ================================================================== S20 · A2 — the phone
  const PX = 540, PY = 852, PW = 620, PH = 760;
  function phone(t, n) {
    withShadow(18, () => { ctx.fillStyle = '#231629'; rrect(-PW / 2, -PH / 2, PW, PH, 66); ctx.fill(); });
    ctx.strokeStyle = '#4A3A52'; ctx.lineWidth = 3; rrect(-PW / 2 + 6, -PH / 2 + 6, PW - 12, PH - 12, 60); ctx.stroke();
    const sx = -PW / 2 + 24, sy = -PH / 2 + 24, sw = PW - 48, sh = PH - 48;
    ctx.fillStyle = C.cream; rrect(sx, sy, sw, sh, 46); ctx.fill();
    ctx.fillStyle = '#231629'; rrect(-64, sy + 10, 128, 24, 12); ctx.fill();
    // header
    drawLogo(sx + 64, sy + 82, 64);
    text('Paiement', sx + 112, sy + 100, { font: font(FF.body, 46, 800), color: C.ink });
    ctx.fillStyle = 'rgba(35,22,41,.12)'; ctx.fillRect(sx + 30, sy + 136, sw - 60, 3);
    // rows: labels + masked values (never digits)
    text('Vous payez', sx + 36, sy + 198, { font: font(FF.body, 44, 700), color: C.inkSoft });
    hatch(sx + 36, sy + 218, 300, 58, n);
    text('F CFA', sx + sw - 36, sy + 268, { font: font(FF.brand, 60, 900), align: 'right', color: C.ink });
    text('Votre fournisseur reçoit', sx + 36, sy + 340, { font: font(FF.body, 44, 700), color: C.inkSoft });
    hatch(sx + 36, sy + 360, 300, 58, n);
    text('¥', sx + sw - 50, sy + 412, { font: font(FF.brand, 68, 900), align: 'right', color: C.ink });
    ctx.fillStyle = 'rgba(35,22,41,.12)'; ctx.fillRect(sx + 30, sy + 446, sw - 60, 3);
    // rate row: pops on « appliqué », glows on « s'affiche »
    const rk = pop(t, T.applique - .1, 15, .45);
    if (rk > 0) at(0, sy + 500, 0, clamp(rk, 0, 1.2), clamp(rk, 0, 1.2), () => {
      const hot = env(t, T.affiche - .05, T.confirmer + .1, .15, .3);
      if (hot > 0) { ctx.fillStyle = `rgba(169,71,254,${.12 * hot})`; rrect(sx + 16, -48, sw - 32, 96, 20); ctx.fill(); }
      text('Taux appliqué', sx + 36, 16, { font: font(FF.body, 46, 800), color: C.ink });
      hatch(sx + sw - 196, -30, 160, 60, n, { fill: 'rgba(169,71,254,.16)', col: 'rgba(123,34,214,.55)', edge: 'rgba(123,34,214,.5)', sweep: prog(t, T.affiche, T.affiche + .5), speed: 44 });
      at(sx + sw - 116, 0, .04, 1, 1, () => handCircle(106, 54, prog(t, T.affiche - .02, T.affiche + .34), C.orange, 7, 4));
    });
    // big « Confirmer » button, pressed on « confirmer »
    const tp = T.confirmer, pr = t >= tp - .02 ? Math.max(0, 1 - (t - tp - .1) / .12) * clamp((t - tp + .02) / .05) : 0, done = t >= tp + .08;
    const by = sy + 578 + pr * 6;
    withShadow(done ? 6 : 10 - pr * 7, () => { ctx.fillStyle = done ? C.violetD : C.violet; rrect(sx + 36, by, sw - 72, 116, 32); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rrect(sx + 50, by + 10, sw - 100, 16, 8); ctx.fill();
    text('Confirmer', done ? 30 : 0, by + 80, { font: font(FF.body, 64, 800), align: 'center', color: '#fff' });
    if (t > tp) { const s = t - tp; ctx.save(); rrect(sx + 36, by, sw - 72, 116, 32); ctx.clip();
      ctx.fillStyle = `rgba(255,255,255,${.45 * clamp(1 - s / .45)})`; ctx.beginPath(); ctx.arc(150, by + 58, 40 + s * 700, 0, 7); ctx.fill(); ctx.restore(); }
    const ck = pop(t, tp + .1, 14, .45);
    if (ck > 0) at(-sw / 2 + 92, by + 58, 0, clamp(ck, 0, 1.25), clamp(ck, 0, 1.25), () => { ctx.fillStyle = M.gain; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); checkMark(1, '#fff', 8, .75); });
    return { bx: 150, by: by + 58, cx: -sw / 2 + 92 };
  }
  function finger(press) {                                   // paper index finger pointing up, tip at (0,0); arm runs down (+y)
    withShadow(20 - press * 12, () => {
      ctx.fillStyle = C.violet; rrect(-66, 196, 144, 520, 34); ctx.fill();                                 // sleeve
      ctx.fillStyle = SKIN[0]; rrect(-19, -4, 38, 128, 19); ctx.fill(); rrect(-58, 96, 130, 124, 46); ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,0,0,.14)'; rrect(-54, 124, 30, 10, 5); ctx.fill(); rrect(-54, 154, 30, 10, 5); ctx.fill();
    ctx.fillStyle = '#A0663F'; rrect(-12, 4, 24, 26, 10); ctx.fill();                                    // nail
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-66, 196, 144, 14);
  }
  function drawA2(t, n, ox) {
    if (ox >= PAN || ox <= -PAN) return;
    const j = jit(620, n, .5), bob = Math.sin(t * 2.1) * 4;
    let tip = null;
    at(PX + ox + j.x, PY + bob + j.y, -.012 + j.r, 1, 1, () => { tip = phone(t, n); });
    // chip slams on « avant »
    const ck = pop(t, T.avant - .06, 16, .5);
    if (ck > 0) chipAvant(PX + ox, 420, clamp(ck, 0, 1.2), n);
    // finger presses the button
    const tp = T.confirmer, fin = eOutCubic(prog(t, tp - .36, tp - .04)), fout = eInCubic(prog(t, tp + .26, tp + .6));
    if (fin > 0 && fout < 1) { const press = t >= tp - .02 && t < tp + .14 ? 1 : 0, far = (1 - fin) + fout;
      at(PX + ox + tip.bx + far * 640 - press * 6, PY + bob + tip.by - 8 + far * 90 + press * 3, -1.38, 1, 1, () => finger(press)); }
    if (t > tp + .12 && t < tp + 1.4) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 1470); ctx.clip();
      at(PX + ox + tip.cx, PY + tip.by, 0, 1, 1, () => confetti(t - tp - .12, 22, 9)); ctx.restore(); }
    sparks(PX + ox + tip.cx, PY + bob + tip.by, t - tp - .1, 44, 110, 12, 31);
  }
  function chipAvant(x, y, s, n) {
    const f = font(FF.body, 46, 800), parts = [['Taux affiché ', C.cream], ['AVANT', C.amber], [' de confirmer', C.cream]];
    const tw = parts.reduce((a, [p]) => a + measure(p, f), 0), h = 80, cw = tw + 124;
    at(x, y, -.025, s, s, () => withShadow(10, () => {
      ctx.fillStyle = C.ink; rrect(-cw / 2, -h / 2, cw, h, h / 2); ctx.fill();
      ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(-cw / 2 + h / 2, 0, h / 2 - 9, 0, 7); ctx.fill();
      ctx.shadowColor = 'transparent'; at(-cw / 2 + h / 2 + 2, 2, 0, 1, 1, () => checkMark(1, '#fff', 7, .62));
      let xx = -cw / 2 + h + 12; for (const [p, c] of parts) { text(p, xx, 17, { font: f, color: c }); xx += measure(p, f); }
    }));
  }
  function headline(t, n, ox) {
    const k = pop(t, T.payez - .06, 12, .5); if (k <= 0 || ox <= -PAN) return;
    const j = jit(630, n, .4), f1 = font(FF.body, 76, 800);
    at(W / 2 + ox + j.x, 262 - (1 - clamp(k)) * 80 + j.y, j.r, clamp(k, 0, 1.12), clamp(k, 0, 1.12), () => {
      paperNote(0, 0, 900, 200, -.018, () => {
        text('Payez vos fournisseurs', 0, -18, { font: f1, align: 'center', color: C.ink });
        const a = 'en ', b = 'F CFA', wa = measure(a, f1), wb = measure(b, f1), x0 = -(wa + wb + 24) / 2;
        text(a, x0, 66, { font: f1, color: C.ink });
        const hk = eOutCubic(prog(t, T.francs - .05, T.francs + .25));
        if (hk > 0) { ctx.fillStyle = C.violet; ctx.beginPath(); ctx.moveTo(x0 + wa - 8, 6); ctx.lineTo(x0 + wa + (wb + 28) * Math.max(hk, .001), 2); ctx.lineTo(x0 + wa + (wb + 26) * Math.max(hk, .001), 88); ctx.lineTo(x0 + wa - 6, 90); ctx.closePath(); ctx.fill(); }
        text(b, x0 + wa + 10, 66, { font: f1, color: hk > .5 ? '#fff' : C.violetD });
      }, { seed: 41, h: 10 });
    });
  }

  // ================================================================== S21 · B — Guangzhou reception
  const CX = 775, CY = 588, CW = 370, CH = 290, SCW = 500;
  const PAN_T = 165, PAN_B = 955;                     // vignette panel top / bottom
  function panel(t, n) {
    withShadow(10, () => { ctx.fillStyle = '#D9D3C7'; rrect(40, PAN_T, 1000, PAN_B - PAN_T, 14); ctx.fill(); });
    ctx.save(); rrect(40, PAN_T, 1000, PAN_B - PAN_T, 14); ctx.clip();
    for (let i = 0; i < 260; i++) { ctx.fillStyle = rnd(i * 3.1) > .5 ? 'rgba(90,80,70,.10)' : 'rgba(255,255,255,.35)'; ctx.fillRect(40 + rnd(i * 1.7) * 1000, PAN_T + rnd(i * 2.9) * 800, 3 + rnd(i) * 4, 2 + rnd(i * 5.5) * 3); }
    ctx.strokeStyle = 'rgba(90,80,70,.18)'; ctx.lineWidth = 3; for (const x of [300, 560, 820]) { ctx.beginPath(); ctx.moveTo(x, PAN_T); ctx.lineTo(x + 6, PAN_B); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(40, 640); ctx.lineTo(1040, 646); ctx.stroke();
    // painted reception zone around the carton
    ctx.strokeStyle = '#E8B730'; ctx.lineWidth = 9; ctx.setLineDash([34, 18]); rrect(CX - 252, CY - 200, 504, 432, 10); ctx.stroke(); ctx.setLineDash([]);
    // hazard band along the bottom
    ctx.fillStyle = '#E8B730'; ctx.fillRect(40, PAN_B - 40, 1000, 40); ctx.fillStyle = C.ink;
    for (let x = 20; x < 1080; x += 56) { ctx.beginPath(); ctx.moveTo(x, PAN_B); ctx.lineTo(x + 28, PAN_B); ctx.lineTo(x + 56, PAN_B - 40); ctx.lineTo(x + 28, PAN_B - 40); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // warehouse sign
    withShadow(8, () => { ctx.fillStyle = C.ink; rrect(56, PAN_T + 14, 968, 112, 14); ctx.fill(); });
    ctx.strokeStyle = C.amber; ctx.lineWidth = 4; rrect(68, PAN_T + 26, 944, 88, 10); ctx.stroke();
    const k = t - T.guangzhou + .04, sc = k < 0 ? 0 : 1 + .45 * Math.exp(-k * 12) * Math.cos(k * 10) * (k < .08 ? 1 : .4);
    if (k > 0) at(540, PAN_T + 70, 0, sc, sc, () => text('GUANGZHOU · RÉCEPTION', 0, 27, { font: font(FF.stencil, 76, 900), align: 'center', color: C.amber, ls: 6, alpha: clamp(k / .06) }));
  }
  const ROWS = ['scanné', 'photographié', 'pesé', 'mesuré'];
  function clipboard(t, n) {
    const bw = 450, bh = 590;
    at(52 + bw / 2, 330 + bh / 2, -.018, 1, 1, () => {
      withShadow(10, () => { ctx.fillStyle = C.kraftD; rrect(-bw / 2, -bh / 2, bw, bh, 20); ctx.fill(); });
      ctx.fillStyle = '#FFFEFA'; rrect(-bw / 2 + 14, -bh / 2 + 40, bw - 28, bh - 54, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,210,.25)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = -bh / 2 + 186 + i * 124; ctx.beginPath(); ctx.moveTo(-bw / 2 + 30, y); ctx.lineTo(bw / 2 - 30, y); ctx.stroke(); }
      withShadow(6, () => { ctx.fillStyle = '#8C939B'; rrect(-78, -bh / 2 - 16, 156, 64, 14); ctx.fill(); });
      ctx.fillStyle = '#C9CDD2'; rrect(-62, -bh / 2 - 4, 124, 36, 9); ctx.fill(); ctx.fillStyle = '#5B616A'; ctx.beginPath(); ctx.arc(0, -bh / 2 + 14, 8, 0, 7); ctx.fill();
      ROWS.forEach((lab, i) => {
        const y = -bh / 2 + 138 + i * 124, tk = T.ticks[i], k = prog(t, tk, tk + .2), s = t > tk ? t - tk : -1;
        const bump = s > 0 ? .12 * Math.exp(-s * 8) * Math.sin(s * 30) : 0, bx = -bw / 2 + 44;
        at(bx + 29, y, 0, 1 + bump, 1 + bump, () => {
          ctx.fillStyle = k > 0 ? `rgba(169,71,254,${.18 * clamp(k * 2)})` : '#FFFFFF'; rrect(-29, -29, 58, 58, 10); ctx.fill();
          ctx.strokeStyle = C.ink; ctx.lineWidth = 5; rrect(-29, -29, 58, 58, 10); ctx.stroke();
          checkMark(k, C.violetD, 11, 1.05);
        });
        text(lab, bx + 80, y + 17, { font: font(FF.body, 48, 800), color: k > 0 ? C.ink : 'rgba(35,22,41,.34)' });
        sparks(bx + 29, y, s, 40, 78, 8, 20 + i);
      });
    });
  }
  function scanner2(active) { scanner(0); if (active) { ctx.fillStyle = C.violet; rrect(-8, -34, 22, 68, 8); ctx.fill(); } }
  function beam(L, spread, k) {
    if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k;
    const g = ctx.createLinearGradient(0, 0, -L, 0); g.addColorStop(0, 'rgba(169,71,254,.65)'); g.addColorStop(1, 'rgba(169,71,254,.16)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-L, -spread); ctx.lineTo(-L, spread); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function camera(fl) {
    withShadow(14, () => { ctx.fillStyle = '#2B2230'; rrect(-60, -92, 76, 36, 8); ctx.fill(); rrect(-115, -66, 230, 146, 24); ctx.fill(); });
    ctx.fillStyle = C.violet; ctx.fillRect(-115, -20, 230, 26);
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-80, -72, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#C9CDD2'; ctx.beginPath(); ctx.arc(8, 8, 54, 0, 7); ctx.fill();
    ctx.fillStyle = '#16111A'; ctx.beginPath(); ctx.arc(8, 8, 42, 0, 7); ctx.fill();
    ctx.fillStyle = '#3A3F6B'; ctx.beginPath(); ctx.arc(8, 8, 24, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-6, -6, 9, 0, 7); ctx.fill();
    ctx.fillStyle = fl > 0 ? '#FFFFFF' : '#E9E1D2'; rrect(62, -54, 40, 24, 5); ctx.fill();
    if (fl > 0) { ctx.save(); ctx.globalAlpha *= fl; ctx.strokeStyle = '#FFF6C8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(82 + Math.cos(a) * 30, -42 + Math.sin(a) * 30); ctx.lineTo(82 + Math.cos(a) * (70 + 30 * fl), -42 + Math.sin(a) * (70 + 30 * fl)); ctx.stroke(); }
      ctx.restore(); }
  }
  function drawB(t, n, ox) {
    if (ox >= PAN) return;
    ctx.save(); ctx.translate(ox, 0);
    panel(t, n);
    clipboard(t, n);
    // --- the scale slides in under the carton (pesé)
    const sIn = eOutCubic(prog(t, T.pese - .44, T.pese - .12)), sy0 = CY - SCW * .17;
    const needle = t < T.pese ? 0 : clamp(spring(t - T.pese, 9, .28), 0, 1.35);
    const scaleAt = (fn) => at(CX + (1 - sIn) * 560, sy0, 0, 1, 1, fn);
    if (sIn > 0) scaleAt(() => withShadow(6, () => scaleDevice(SCW, needle)));
    // --- the carton
    const d = drop(t, T.colis - .1, 520, .22), lift = eOutCubic(prog(t, T.pese - .42, T.pese - .2)) * (1 - eInCubic(prog(t, T.pese - .14, T.pese)));
    const land2 = t >= T.pese ? Math.exp(-(t - T.pese) * 10) * Math.cos((t - T.pese) * 36) * .06 : 0;
    const scanK = env(t, T.scanne - .02, T.scanne + .42, .06, .12), lit = t > T.scanne ? 1 : 0;
    if (d.a) { const j = jit(700, n, .5), sc = 1 + .07 * lift;
      at(CX + j.x, CY + d.y + j.y - lift * 16, -.02 + j.r, d.sx * sc * (1 + land2), d.sy * sc * (1 - land2), () => withShadow(4 + lift * 36, () => carton(CW, CH, { seed: 5, label: () => at(30, 34, -.05, 1, 1, () => {
        if (lit) { ctx.save(); ctx.shadowColor = `rgba(169,71,254,${.5 + .5 * scanK})`; ctx.shadowBlur = 14 + 30 * scanK; ctx.fillStyle = C.violet; rrect(-139, -93, 278, 186, 15); ctx.fill(); ctx.restore(); }
        shipLabel(262, 174, 'sea', 'BZ-000000', { seed: 11 });
        if (scanK > 0) { const sxl = lerp(-120, 120, prog(t, T.scanne, T.scanne + .36)); ctx.save(); ctx.globalAlpha *= scanK; ctx.fillStyle = 'rgba(169,71,254,.85)'; ctx.fillRect(sxl - 3, -86, 6, 172);
          ctx.fillStyle = 'rgba(169,71,254,.16)'; ctx.fillRect(-131, -87, 262, 174); ctx.restore(); }
      }) })));
      if (d.landed) puff(CX, CY + CH / 2, t - (T.colis + .12), 7);
      if (t >= T.pese) puff(CX, CY + CH / 2, t - T.pese, 9, '#EDE7DB');
    }
    // dial drawn again on top of the carton so the needle stays visible
    if (sIn > 0) scaleAt(() => { ctx.save(); ctx.beginPath(); ctx.arc(0, SCW * .5, 76, 0, 7); ctx.clip(); scaleDevice(SCW, needle); ctx.restore(); });
    // --- tape measure along three edges (mesuré), then it snaps back
    const back = eInCubic(prog(t, T.des + .15, T.des + .4));
    const tk = T.tapes.map(s => eOutCubic(prog(t, s, s + .28)) * (1 - back));
    if (tk[0] > 0) at(CX - CW / 2 - 4, CY - CH / 2 - 30, 0, 1, 1, () => tapeMeasure(CW + 8, tk[0]));
    if (tk[1] > 0) at(CX + CW / 2 + 34, CY - CH / 2 - 4, 0, 1, 1, () => tapeMeasure(CH + 8, tk[1], true));
    if (tk[2] > 0) at(CX - CW / 2 - 30, CY - CH / 2 - 4, 0, 1, 1, () => tapeMeasure(CH + 8, tk[2], true));
    // --- scanner (scanné): from the top-right, beam on the label
    const scIn = eOutCubic(prog(t, T.scanne - .32, T.scanne - .04)), scOut = eInCubic(prog(t, T.scanne + .46, T.scanne + .76));
    if (scIn > 0 && scOut < 1) { const tx = CX + 30, ty = CY + 34, nx = 1004, ny = 352, r = Math.atan2(ty - ny, tx - nx) + Math.PI, far = (1 - scIn) + scOut;
      const L = Math.hypot(tx - nx, ty - ny), j = jit(710, n, .6);
      at(nx + Math.cos(r) * far * 520 + j.x, ny + Math.sin(r) * far * 520 + j.y, r, 1, 1, () => { beam(L - 20, 100, scanK); withShadow(26, () => scanner2(scanK > 0)); }); }
    // --- camera (photographié): 2 white frames on the carton area only
    const caIn = eOutCubic(prog(t, T.photo - .26, T.photo + .02)), caOut = eInCubic(prog(t, T.flash + .3, T.flash + .58)), nf = Math.round(T.flash * FPS);
    const fl = n >= nf && n < nf + 2 ? 1 : n >= nf + 2 ? clamp(1 - (t - T.flash - 2 / FPS) / .18) * .55 : 0;
    if (fl > 0) { ctx.save(); ctx.globalAlpha = n < nf + 2 ? .96 : fl; ctx.fillStyle = '#FFFFFF'; rrect(CX - CW / 2 - 40, CY - CH / 2 - 40, CW + 80, CH + 80, 26); ctx.fill(); ctx.restore(); }
    if (caIn > 0 && caOut < 1) { const j = jit(720, n, .6);
      at(CX + 40 + (1 - caIn) * 420 + caOut * 460 + j.x, 388 + j.y - (1 - caIn) * 60, -.08 + (1 - caIn) * .4 + j.r, 1, 1, () => camera(n >= nf && n < nf + 5 ? 1 - (n - nf) / 5 : 0)); }
    // floating dust in the warehouse light
    const ts = stepT(n); ctx.save(); for (let i = 0; i < 18; i++) { const x = 60 + rnd(i * 7.3) * 960 + Math.sin(ts * .7 + i) * 26, y = PAN_T + 150 + ((rnd(i * 3.9) * 640 - ts * (10 + rnd(i) * 16)) % 640 + 640) % 640;
      ctx.fillStyle = 'rgba(255,250,235,.7)'; ctx.beginPath(); ctx.arc(x, y, 2 + rnd(i * 1.3) * 3, 0, 7); ctx.fill(); } ctx.restore();
    mapStrip(t, n);
    ctx.restore();
  }
  // ---- map strip Guangzhou → Douala, boat halfway, Junior already calculating
  const MY0 = 972, MY1 = 1240, GZ = [140, 1112], DL = [742, 1112];
  function mapStrip(t, n) {
    const ts = stepT(n);
    ctx.save();
    withShadow(10, () => { at(540, (MY0 + MY1) / 2, 0, 1, 1, () => { tornPath(1020, MY1 - MY0, 61, 3); ctx.fillStyle = '#BCD7EC'; ctx.fill(); }); });
    ctx.save(); ctx.translate(540, (MY0 + MY1) / 2); tornPath(1020, MY1 - MY0, 61, 3); ctx.translate(-540, -(MY0 + MY1) / 2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const x = 250 + (i % 3) * 170 + Math.sin(ts * 1.5 + i) * 10, y = 1020 + Math.floor(i / 3) * 70; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 22, y - 12, x + 44, y); ctx.quadraticCurveTo(x + 66, y + 12, x + 88, y); ctx.stroke(); }
    ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.moveTo(30, MY0 - 10); ctx.lineTo(210, MY0 - 10); ctx.quadraticCurveTo(250, 1050, 196, 1100); ctx.quadraticCurveTo(240, 1170, 186, MY1 + 10); ctx.lineTo(30, MY1 + 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1050, MY0 - 10); ctx.lineTo(760, MY0 - 10); ctx.quadraticCurveTo(700, 1040, 736, 1090); ctx.quadraticCurveTo(690, 1160, 770, MY1 + 10); ctx.lineTo(1050, MY1 + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(138,98,56,.18)'; for (let i = 0; i < 30; i++) ctx.fillRect(rnd(i * 2.2) > .5 ? 40 + rnd(i) * 140 : 790 + rnd(i) * 240, MY0 + rnd(i * 4.1) * 250, 5, 3);
    ctx.restore();
    // route
    const pts = curve([GZ, [300, 1180], [445, 1190], [600, 1180], DL], 12), tk = prog(t, T.des + .02, T.des + .7);
    thread(pts, tk, n, { w: 7 });
    const gk = pop(t, T.guangzhou - .04, 13, .45), here = t - T.guangzhou;
    if (here > 0 && t < T.des + .3) for (let r = 0; r < 2; r++) { const s = ((here * 1.1 + r * .5) % 1); ctx.save(); ctx.globalAlpha = (1 - s) * .8; ctx.strokeStyle = C.violet; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(GZ[0], GZ[1], 18 + s * 70, (18 + s * 70) * .55, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    if (gk > 0) at(GZ[0], GZ[1] + (1 - clamp(gk)) * -60, 0, clamp(gk, 0, 1.2), clamp(gk, 0, 1.2), () => pin(C.violet));
    if (tk >= 1) at(...DL, 0, 1, 1, () => pin(M.red));
    if (gk > 0) at(GZ[0] + 74, 1022, -.03, clamp(gk, 0, 1.15), clamp(gk, 0, 1.15), () => plateLabel('GUANGZHOU'));
    if (tk > .8) at(DL[0] - 30, 1022, .03, clamp(pop(t, T.des + .7, 14, .45), 0, 1.2), clamp(pop(t, T.des + .7, 14, .45), 0, 1.2), () => plateLabel('DOUALA'));
    // the boat: docked at Guangzhou, sails out on « dès réception » and stops halfway — still at sea
    const bk = pop(t, T.guangzhou + .3, 12, .45);
    if (bk > 0) { const sail = eInOutCubic(prog(t, T.des + .12, T.des + 1.25)), [bx, by, ba] = along(pts, lerp(.2, .5, sail));
      const moving = sail > 0 && sail < 1, bob = Math.sin(ts * 5) * 5, br = Math.sin(ts * 4) * .05 + (moving ? ba * .3 : 0);
      if (moving) for (let i = 0; i < 5; i++) { const s = ((ts * 1.6 + i / 5) % 1); ctx.save(); ctx.globalAlpha = (1 - s) * .8; ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(bx - 60 - s * 70, by + 8 + (i % 2 ? -1 : 1) * s * 16, 5 * (1 - s) + 2, 0, 7); ctx.fill(); ctx.restore(); }
      at(bx, by - 26 + bob + (1 - clamp(bk)) * 60, br, .46 * clamp(bk, 0, 1.15), .46 * clamp(bk, 0, 1.15), () => withShadow(6, () => paperBoat(1))); }
    // Junior, in Douala, already tapping the calculator
    const jk = pop(t, T.vous2 - .12, 11, .45);
    if (jk > 0) { const j = jit(730, n, .7), tap = Math.floor(n / 4) % 2, typing = t > T.connaissez - .05;
      const disp = typing ? ['', '·', '··', '···'][Math.floor((t - T.connaissez) * 6) % 4] : '';
      at(918 + j.x, MY1 - 92 + (1 - clamp(jk)) * 200 + j.y, j.r - .03, .38, .38, () => person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber,
        face: t > T.avant2 ? 'grin' : 'think', arms: ['hold', typing ? (tap ? [18, 168] : [44, 150]) : 'idle'], look: -.4, blink: (n % 91) < 3,
        handProp: () => at(78, 18, -.06, .52, .52, () => calculator(300, disp, { press: typing && tap ? '=' : null })), handSide: -1 })); }
    ctx.restore();
  }
  function lineNote(t, n) {
    const k = pop(t, T.line, 12, .5); if (k <= 0) return;
    const j = jit(740, n, .4), f1 = font(FF.body, 66, 800), f2 = font(FF.body, 76, 800);
    at(W / 2 + j.x, 1345 + (1 - clamp(k)) * 40 + j.y, j.r, clamp(k, 0, 1.1), clamp(k, 0, 1.1), () => paperNote(0, 0, 800, 208, -.015, () => {
      const w1 = measure('Votre volume connu', f1), wk = eOutCubic(prog(t, T.line + .05, T.volume + .35));
      ctx.save(); ctx.beginPath(); ctx.rect(-w1 / 2 - 10, -90, (w1 + 20) * wk, 100); ctx.clip();
      text('Votre volume connu', 0, -16, { font: f1, align: 'center', color: C.ink }); ctx.restore();
      const a2 = pop(t, T.avant2 - .06, 16, .5);
      if (a2 > 0) { const wa = measure('AVANT', f2), wb = measure(' l’arrivée', f2), x0 = -(wa + wb) / 2;
        at(0, 70, 0, clamp(a2, 0, 1.2), clamp(a2, 0, 1.2), () => {
          text('AVANT', x0, 0, { font: f2, color: C.orange }); text(' l’arrivée', x0 + wa, 0, { font: f2, color: C.ink });
          const u = eOutCubic(prog(t, T.avant2 + .12, T.avant2 + .42)); if (u > 0) { ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x0, 18); ctx.quadraticCurveTo(x0 + wa / 2, 30, x0 + wa * u, 14); ctx.stroke(); ctx.restore(); }
        }); }
    }, { seed: 93, h: 10 }));
  }

  // ================================================================== scene
  registerScene({
    id: 'bonzini', z: 42,
    when: t => { const c = TL.ch('bonzini'); return t >= c.start - .02 && t < c.end; },
    draw(t, n) {
      if (!T) T = times();
      const cx = Math.sin(t * .37) * 5, cy = Math.cos(t * .29) * 4;
      ctx.translate(cx, cy);
      const kA = eInOutCubic(prog(t, T.panA, T.panA + .5)), kB = eInOutCubic(prog(t, T.panB, T.panB + .5));
      if (kB < 1) {
        drawA1(t, n, -kA * PAN - kB * PAN);
        drawA2(t, n, (1 - kA) * PAN - kB * PAN);
        headline(t, n, -kB * PAN);
      }
      if (kB > 0) { drawB(t, n, (1 - kB) * PAN); if (kB >= 1) lineNote(t, n); }
    },
  });
  captionHide(t => T && t >= T.line - .06 && t < T.c1 + .5);          // the paper note carries « Votre volume connu AVANT l'arrivée »
})();
