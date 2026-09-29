'use strict';
// « ALERTE GOLDEN WEEK » — Kraft & Fil, alert edition.
(() => {
  const RED = '#D7261E', REDD = '#A5160F', YEL = '#FFC928', GOLD = '#E3A52C';
  // ------------------------------------------------------------------ props
  function caution(len, h = 110, label = 'ATTENTION · 注意 · ATTENTION · 注意 · ATTENTION · 注意 · ATTENTION', seed = 1) {
    ctx.save();
    const top = tornLine(-len / 2, -h / 2, len / 2, -h / 2, seed, 2, 14), bot = tornLine(len / 2, h / 2, -len / 2, h / 2, seed + 4, 2, 14);
    ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath();
    ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 10; ctx.fillStyle = YEL; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.clip(); ctx.fillStyle = '#1C1418';
    for (let x = -len / 2 - h; x < len / 2 + h; x += 90) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x + 40, -h / 2); ctx.lineTo(x + 40 - h * .6, h / 2); ctx.lineTo(x - h * .6, h / 2); ctx.closePath(); ctx.globalAlpha = .9; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = YEL; ctx.fillRect(-len / 2, -h * .28, len, h * .56);
    ctx.fillStyle = '#1C1418'; ctx.font = font(FF.stencil, h * .44, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '6px'; ctx.fillText(label, 0, 3);
    ctx.restore();
  }
  function siren(t, on = 1) {                         // paper beacon with rotating light beams
    ctx.save();
    if (on > 0) { const a = t * 7; for (const s of [0, Math.PI]) { ctx.save(); ctx.rotate(a + s); const g = ctx.createLinearGradient(0, 0, 520, 0);
      g.addColorStop(0, `rgba(255,70,50,${.45 * on})`); g.addColorStop(1, 'rgba(255,70,50,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(520, -120); ctx.lineTo(520, 120); ctx.closePath(); ctx.fill(); ctx.restore(); } }
    ctx.fillStyle = '#2B2230'; rrect(-110, 40, 220, 46, 10); ctx.fill();
    ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(-86, 44); ctx.lineTo(-70, -40); ctx.quadraticCurveTo(0, -120, 70, -40); ctx.lineTo(86, 44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-30, -30, 14, 34, .3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-86, 20, 172, 10);
    ctx.restore();
  }
  function calendar(month, first, ndays, o = {}) {   // French week (L..D); first = weekday index of day 1 (0 = lundi)
    const w = 880, h = 700, cw = (w - 60) / 7, top = -h / 2 + 170;
    ctx.save();
    ctx.fillStyle = C.cream; rrect(-w / 2, -h / 2, w, h, 18); ctx.fill();
    ctx.fillStyle = RED; rrect(-w / 2, -h / 2, w, 120, 18); ctx.fill(); ctx.fillRect(-w / 2, -h / 2 + 70, w, 50);
    for (const x of [-w / 2 + 120, w / 2 - 120]) { ctx.fillStyle = '#6A6070'; rrect(x - 12, -h / 2 - 34, 24, 64, 10); ctx.fill(); }
    text(month, 0, -h / 2 + 84, { font: font(FF.stencil, 78, 900), color: '#fff', align: 'center', ls: 8 });
    'LMMJVSD'.split('').forEach((d, i) => text(d, -w / 2 + 30 + cw * (i + .5), top - 24, { font: font(FF.body, 34, 800), align: 'center', color: C.inkSoft }));
    const cells = [];
    for (let d = 1; d <= ndays; d++) {
      const k = first + d - 1, col = k % 7, row = Math.floor(k / 7);
      const x = -w / 2 + 30 + cw * (col + .5), y = top + 18 + row * 92;
      cells.push([d, x, y]);
      const style = o.style ? o.style(d) : null;
      if (style && style.fill) { ctx.fillStyle = style.fill; rrect(x - cw / 2 + 6, y - 40, cw - 12, 80, 10); ctx.fill(); }
      text(String(d), x, y + 16, { font: font(FF.mono, 44, 800), align: 'center', color: (style && style.color) || C.ink });
    }
    ctx.restore(); return cells;
  }
  function building(kind, shutter, sign) {           // kind: 0 factory, 1 supplier shop, 2 office. shutter 0..1
    ctx.save();
    const w = 270, h = kind === 2 ? 330 : 250;
    ctx.fillStyle = kind === 0 ? '#B98A58' : kind === 1 ? '#C9A27A' : '#A7B4C2'; rrect(-w / 2, -h, w, h, 6); ctx.fill();
    if (kind === 0) { ctx.fillStyle = '#8E6A44'; ctx.fillRect(w / 2 - 70, -h - 90, 44, 90);                     // chimney
      ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(-w / 2 + 70, -h - 60); ctx.lineTo(-w / 2 + 70, -h); ctx.lineTo(-w / 2 + 140, -h - 60); ctx.lineTo(-w / 2 + 140, -h); ctx.closePath(); ctx.fillStyle = '#9C7447'; ctx.fill(); }
    if (kind === 1) { ctx.fillStyle = RED; for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : RED; ctx.fillRect(-w / 2 + i * w / 6, -h, w / 6, 40); } }
    if (kind === 2) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) ctx.fillRect(-w / 2 + 30 + c * 80, -h + 26 + r * 50, 50, 32); }
    // door + rolling shutter
    const dw = 170, dh = 130, dx = -dw / 2, dy = -dh;
    ctx.fillStyle = '#3A2E26'; ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = '#9AA0A8'; ctx.fillRect(dx, dy, dw, dh * shutter);
    ctx.strokeStyle = 'rgba(40,40,50,.35)'; ctx.lineWidth = 2; for (let y = dy + 10; y < dy + dh * shutter; y += 12) { ctx.beginPath(); ctx.moveTo(dx, y); ctx.lineTo(dx + dw, y); ctx.stroke(); }
    if (sign > 0) at(0, -dh - 34, -.06, sign, sign, () => { ctx.fillStyle = C.cream; rrect(-92, -30, 184, 60, 8); ctx.fill(); ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.stroke();
      text('FERMÉ', -18, 16, { font: font(FF.stencil, 44, 900), color: RED, align: 'center' }); ctx.font = `30px ${FF.cjk}`; ctx.fillStyle = RED; ctx.fillText('休', 52, 12); });
    ctx.restore();
  }
  function gear(r, teeth, a, col) {
    ctx.save(); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const ang = i * Math.PI / teeth, rr = i % 2 ? r : r * 1.18; ctx.lineTo(Math.cos(ang - .12) * rr, Math.sin(ang - .12) * rr); ctx.lineTo(Math.cos(ang + .12) * rr, Math.sin(ang + .12) * rr); }
    ctx.closePath(); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, r * .35, 0, 7); ctx.fill(); ctx.restore();
  }
  function phone(msgs, t, tAns) {                     // chat on a phone: msgs [{txt, t}]
    ctx.save(); ctx.fillStyle = '#2B2230'; rrect(-190, -300, 380, 600, 44); ctx.fill(); ctx.fillStyle = '#EFE9F5'; rrect(-172, -262, 344, 524, 28); ctx.fill();
    ctx.fillStyle = '#2B2230'; rrect(-60, -290, 120, 16, 8); ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = font(FF.body, 32, 800); ctx.fillText('Fournisseur', -140, -214); ctx.fillStyle = '#8A7F92'; ctx.font = font(FF.body, 24, 600); ctx.fillText('vu il y a 3 jours', -140, -184);
    let y = -130;
    for (const m of msgs) { const k = spring(t - m.t, 12, .5); if (k <= 0) continue; const f = font(FF.body, 34, 700), w = measure(m.txt, f) + 44;
      at(150 - w / 2, y, 0, clamp(k, 0, 1.1), clamp(k, 0, 1.1), () => { ctx.fillStyle = C.violet; rrect(-w / 2, -30, w, 60, 26); ctx.fill(); text(m.txt, 0, 12, { font: f, color: '#fff', align: 'center' });
        ctx.fillStyle = '#9C95A5'; ctx.font = font(FF.body, 20, 700); ctx.fillText('✓✓', w / 2 - 34, 44); }); y += 96; }
    // "typing…" that never comes
    const dots = Math.floor(t * 3) % 4; if (t > tAns) text('.'.repeat(dots), -120, 220, { font: font(FF.body, 60, 800), color: '#B5AEBD' });
    ctx.restore();
  }
  function clipboard(items, t, n) {                  // items [{title, sub, t0, tick}]
    ctx.save();
    ctx.fillStyle = '#8B6A45'; rrect(-420, -470, 840, 1000, 26); ctx.fill();
    ctx.fillStyle = C.cream; rrect(-385, -420, 770, 920, 12); ctx.fill();
    ctx.fillStyle = '#9AA0A8'; rrect(-120, -500, 240, 90, 18); ctx.fill(); ctx.fillStyle = '#6A6070'; rrect(-70, -520, 140, 40, 12); ctx.fill();
    text('3 RÉFLEXES', 0, -320, { font: font(FF.stencil, 110, 900), align: 'center', color: C.ink, ls: 4 });
    items.forEach((it, i) => {
      const k = spring(stepT(n) - it.t0, 11, .5); if (k <= 0) return;
      const y = -170 + i * 230, x0 = -340;
      at(0, y, 0, 1, 1, () => { ctx.globalAlpha = clamp(k * 2);
        at(x0 + 40, 0, 0, clamp(k, 0, 1.15), clamp(k, 0, 1.15), () => { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill(); text(String(i + 1), 0, 20, { font: font(FF.stencil, 58, 900), color: C.cream, align: 'center' }); });
        text(it.title, x0 + 110, -8, { font: font(FF.body, 46, 800), color: C.ink });
        if (it.sub) text(it.sub, x0 + 110, 50, { font: font(FF.body, 40, 600), color: C.inkSoft });
        const tk = prog(stepT(n), it.tick, it.tick + .2);
        if (tk > 0) at(285, 48, -.18, 1 + .3 * (1 - tk), 1 + .3 * (1 - tk), () => stampText('OK', 0, 0, font(FF.stencil, 76, 900), C.violetD, { box: true, h: 100, boxW: 8, starve: .35, alpha: tk }));
        ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, 110); ctx.lineTo(-x0, 110); ctx.stroke();
      });
    });
    ctx.restore();
  }
  function lantern(t, x, y, s, ph) {
    const sw = Math.sin(t * 2.2 + ph) * .12;
    at(x, y, sw, s, s, () => { ctx.strokeStyle = '#5A4130'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(0, -70); ctx.stroke();
      ctx.fillStyle = GOLD; ctx.fillRect(-40, -78, 80, 14); ctx.fillStyle = RED; ctx.beginPath(); ctx.ellipse(0, 0, 92, 72, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = REDD; ctx.lineWidth = 3; for (const k of [-.55, 0, .55]) { ctx.beginPath(); ctx.ellipse(0, 0, 92 * Math.abs(k || .05), 72, 0, 0, 7); ctx.stroke(); }
      ctx.fillStyle = GOLD; ctx.fillRect(-40, 64, 80, 14); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10, 78); ctx.lineTo(i * 10, 130); ctx.stroke(); } });
  }

  // ------------------------------------------------------------------ timing
  let T = null;
  function times() {
    const g = (s, w, e) => TL.wt(s, w, null, 0) + (e || 0);
    return { ch: id => TL.ch(id), alerte: g('S1', 'alerte'), imp: g('S1', 'importateurs'), premier: g('S1', 'premier'), oct: TL.we('S1', 'octobre'), arrete: g('S1', 'chine'),
      golden: g('S2', 'golden'), fete: g('S2', 'fete'), usines: g('S2', 'usines'), fourn: g('S2', 'fournisseurs'), bureaux: g('S2', 'bureaux'), ferment: g('S2', 'ferment'), semaine: g('S2', 'semaine'),
      resultat: g('S3', 'resultat'), production: g('S3', 'production'), messages: g('S3', 'messages'), retards: g('S3', 'retards'), apres: g('S3', 'apres'),
      trois: g('S4', 'trois'), un: g('S4', 'un'), appelez: g('S4', 'appelez'), pret: g('S4', 'pret'), attendra: g('S4', 'attendra'),
      deux: g('S5', 'deux'), marge: g('S5', 'marge'), troisB: g('S6', 'trois'), stocks: g('S6', 'stocks'), annee: g('S6', 'annee'),
      notez: g('S7', 'notez'), nouvel: g('S7', 'nouvel'), six: g('S7', 'six'), fevrier: g('S7', 'fevrier'),
      partagez: g('S8', 'partagez'), importateur: g('S8', 'importateur'), bonzini: g('S8', 'bonzini'), previent: g('S8', 'previent'), s8end: TL.seg('S8').end };
  }

  registerScene({
    id: 'alert', z: 10,
    draw(t, n) {
      if (!T) T = times();
      const ts = stepT(n);
      const inCh = (id, a = .15, b = .15) => TL.in(t, id, a, b);
      // ============ HOOK: caution tape + siren + ALERTE + October calendar
      if (inCh('hook') || inCh('what', .15, -1e9)) {
        const out = eInCubic(prog(t, TL.ch('hook').end - .25, TL.ch('hook').end + .15));
        ctx.save(); ctx.translate(0, -out * 1800);
        // two caution tapes slap across at the very start
        [[-.32, 250, 0], [.26, 1650, .12]].forEach(([r, y, d], i) => { const k = prog(ts, d, d + .16); if (k <= 0) return;
          at(W / 2 + (1 - eOutCubic(k)) * (i ? 1400 : -1400), y, r, 1, 1, () => caution(1700, 120, undefined, 3 + i)); });
        const sk = spring(ts - .15, 10, .45);
        if (sk > 0) at(W / 2, 250 - (1 - clamp(sk)) * 500, 0, 1, 1, () => siren(t, 1));
        // ALERTE stamp + IMPORTATEURS
        const up = eInOutCubic(prog(t, T.premier - .45, T.premier - .05));
        if (t >= T.alerte - .05) { const k = t - T.alerte + .05, sc = (k < .07 ? 1.35 : 1 + .05 * Math.exp(-k * 8)) * (1 - .3 * up);
          at(W / 2, lerp(520, 400, up), -.05, sc, sc, () => stampText('ALERTE', 0, 0, font(FF.stencil, 230, 900), RED, { box: true, h: 250, boxW: 14, starve: .3 })); }
        const ik = prog(ts, T.imp - .05, T.imp + .15), sw = prog(ts, T.arrete - .1, T.arrete + .1);
        if (ik > 0 && sw < 1) text('IMPORTATEURS', W / 2, lerp(740, 575, up) + (1 - ik) * 30, { font: font(FF.stencil, lerp(104, 88, up), 900), align: 'center', color: C.ink, ls: 8, alpha: ik * (1 - sw) });
        if (sw > 0) at(W / 2, 555, -.02, .9 + .1 * eOutBack(sw), .9 + .1 * eOutBack(sw), () => text('LA CHINE S\'ARRÊTE', 0, 0, { font: font(FF.stencil, 92, 900), align: 'center', color: RED, ls: 4, alpha: sw }));
        // October calendar with FERMÉ stamps on 1..7
        const ck = spring(ts - (T.premier - .35), 10, .5);
        if (ck > 0) {
          const stampT = d => T.premier + (d - 1) * ((T.oct + .5 - T.premier) / 7);
          at(W / 2, 960 + (1 - clamp(ck)) * 900, .015, .84, .84, () => withShadow(18, () => {
            const cells = calendar('OCTOBRE 2026', 3, 31, { style: d => (d <= 7 && t >= stampT(d)) ? { fill: 'rgba(215,38,30,.14)', color: REDD } : null });
            for (const [d, x, y] of cells) { if (d > 7 || t < stampT(d)) continue; const k = t - stampT(d), sc = k < .06 ? 1.4 : 1;
              at(x, y - 2, (rnd(d) - .5) * .5, sc * .55, sc * .55, () => stampText('✕', 0, 0, font(FF.stencil, 150, 900), RED, { starve: .3 })); }
          }));
        }
        ctx.restore();
      }
      // ============ WHAT: GOLDEN WEEK + buildings closing
      if (inCh('what')) {
        const c = TL.ch('what'), inK = eOutCubic(prog(t, c.start - .1, c.start + .3)), out = eInCubic(prog(t, c.end - .25, c.end + .15));
        ctx.save(); ctx.translate(0, (1 - inK) * 1200 - out * 1800);
        const gk = prog(ts, T.golden - .1, T.golden + .15);
        if (gk > 0) { at(W / 2, 330, -.02, .9 + .1 * eOutBack(gk), .9 + .1 * eOutBack(gk), () => {
          const g = ctx.createLinearGradient(-380, -100, 380, 20); g.addColorStop(0, '#B7791F'); g.addColorStop(.45, '#F6D365'); g.addColorStop(.55, '#FFF1B8'); g.addColorStop(1, '#C98A1C');
          text('GOLDEN WEEK', 0, 0, { font: font(FF.stencil, 170, 900), color: g, align: 'center', ls: 6 }); });
          const fk = prog(ts, T.fete - .1, T.fete + .15);
          if (fk > 0) { text('Fête nationale chinoise', W / 2, 420, { font: font(FF.body, 56, 800), align: 'center', alpha: fk }); ctx.font = `50px ${FF.cjk}`; ctx.fillStyle = RED; ctx.globalAlpha = fk; ctx.textAlign = 'center'; ctx.fillText('国庆节', W / 2, 490); ctx.globalAlpha = 1; ctx.textAlign = 'left'; } }
        [[T.usines, 0, 'Usines'], [T.fourn, 1, 'Fournisseurs'], [T.bureaux, 2, 'Bureaux']].forEach(([tw, kind, lab], i) => {
          const k = spring(ts - (tw - .25), 11, .5); if (k <= 0) return;
          const x = 190 + i * 350, y = 1050, sh = eInOutCubic(prog(ts, T.ferment - .1 + i * .12, T.ferment + .5 + i * .12));
          at(x, y + (1 - clamp(k)) * 500, 0, .95, .95, () => withShadow(8, () => building(kind, sh, prog(ts, T.ferment + .3 + i * .12, T.ferment + .45 + i * .12))));
          text(lab, x, y + 70, { font: font(FF.body, 46, 800), align: 'center', alpha: clamp(k) });
        });
        const wk = prog(ts, T.semaine - .05, T.semaine + .1);
        if (wk > 0) at(W / 2, 620, .06, 1 + .3 * (1 - wk), 1 + .3 * (1 - wk), () => stampText('7 JOURS', 0, 0, font(FF.stencil, 120, 900), RED, { box: true, h: 150, boxW: 10, starve: .35, alpha: wk }));
        ctx.restore();
      }
      // ============ EFFECTS: production stops · no answers · delays spill over
      if (inCh('effects')) {
        const c = TL.ch('effects'), inK = eOutCubic(prog(t, c.start - .1, c.start + .3)), out = eInCubic(prog(t, c.end - .25, c.end + .15));
        ctx.save(); ctx.translate((1 - inK) * W - out * W, 0);
        const rk = prog(ts, T.resultat - .1, T.resultat + .15);
        if (rk > 0) text('RÉSULTAT', W / 2, 300, { font: font(FF.stencil, 130, 900), align: 'center', color: C.ink, ls: 6, alpha: rk });
        // gears slowing to a halt
        const pk = prog(ts, T.production - .2, T.production + .1);
        if (pk > 0) { const stop = eOutCubic(prog(t, T.production, T.production + 1.2)), a = (t - c.start) * 2.2 * (1 - stop) + stop * 1.3;
          at(250, 560, 0, pk, pk, () => { gear(80, 10, a, '#9C7447'); at(128, 70, 0, 1, 1, () => gear(55, 8, -a * 1.45, '#C79E6C')); });
          if (stop > .6) at(250, 560, 0, 1, 1, () => stampText('STOP', 0, 0, font(FF.stencil, 90, 900), RED, { box: true, h: 110, starve: .3, alpha: prog(t, T.production + .7, T.production + .9) }));
          text('Production', 250, 720, { font: font(FF.body, 48, 800), align: 'center', alpha: pk }); }
        // phone: unanswered messages
        const mk = spring(ts - (T.messages - .3), 10, .5);
        if (mk > 0) at(770, 640 + (1 - clamp(mk)) * 700, .05, .78, .78, () => withShadow(20, () => phone([{ txt: 'Bonjour ?', t: T.messages - .1 }, { txt: 'Vous êtes là ?', t: T.messages + .35 }, { txt: '???', t: T.messages + .8 }], t, T.messages + 1.1)));
        // delay strip: 1..7 red, then 8.. spill over in orange
        const dk = prog(ts, T.retards - .2, T.retards + .1);
        if (dk > 0) { const cw = 112, x0 = W / 2 - cw * 4.5;
          for (let d = 1; d <= 9; d++) { const x = x0 + (d - .5) * cw, late = d > 7, show = late ? prog(t, T.apres + (d - 8) * .25, T.apres + (d - 8) * .25 + .15) : dk;
            if (show <= 0) continue; ctx.save(); ctx.globalAlpha = show;
            ctx.fillStyle = late ? C.orange : RED; rrect(x - cw / 2 + 6, 1040, cw - 12, 100, 12); ctx.fill();
            text(String(d), x, 1108, { font: font(FF.mono, 50, 800), align: 'center', color: '#fff' }); ctx.restore(); }
          text('Oct.', x0 - 70, 1108, { font: font(FF.body, 40, 800), align: 'center', alpha: dk });
          const ak = prog(t, T.apres, T.apres + .6);
          if (ak > 0) { ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.lineCap = 'round'; const x1 = x0 + 7 * cw, x2 = x1 + 260 * eOutCubic(ak);
            ctx.beginPath(); ctx.moveTo(x1, 1175); ctx.lineTo(x2, 1175); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x2 - 20, 1160); ctx.lineTo(x2, 1175); ctx.lineTo(x2 - 20, 1190); ctx.stroke(); ctx.restore();
            text('retards…', x1 + 140, 1225, { font: font(FF.hand, 50, 800), align: 'center', color: C.orange, alpha: ak }); }
        }
        ctx.restore();
      }
      // ============ TIPS: clipboard with 3 reflexes
      if (inCh('tip1') || inCh('tip2') || inCh('tip3')) {
        const c0 = TL.ch('tip1'), c3 = TL.ch('tip3'), inK = spring(t - (c0.start - .1), 9, .55), out = eInCubic(prog(t, c3.end - .25, c3.end + .15));
        ctx.save(); ctx.translate(0, (1 - clamp(inK)) * 1400 - out * 1800);
        at(W / 2, 720, -.012, .98, .98, () => withShadow(18, () => clipboard([
          { title: 'Appelez votre fournisseur', sub: 'Prêt ? Ou après la fête ?', t0: T.un - .15, tick: T.attendra },
          { title: 'Aucune date promise', sub: 'sans marge de sécurité', t0: T.deux - .15, tick: T.marge },
          { title: 'Anticipez vos stocks', sub: 'pour les fêtes de fin d\'année', t0: T.troisB - .15, tick: T.annee },
        ], t, n)));
        ctx.restore();
      }
      // ============ CNY teaser
      if (inCh('cny')) {
        const c = TL.ch('cny'), inK = eOutCubic(prog(t, c.start - .1, c.start + .3)), out = eInCubic(prog(t, c.end - .25, c.end + .15));
        ctx.save(); ctx.translate((1 - inK) * -W + out * W, 0);
        lantern(t, 120, 300, .8, 0); lantern(t, 960, 300, .8, 1.3);
        const k = spring(ts - (T.nouvel - .4), 10, .5);
        if (k > 0) at(W / 2, 810 + (1 - clamp(k)) * 800, -.015, .82, .82, () => withShadow(16, () => {
          const cells = calendar('FÉVRIER 2027', 0, 28, { style: d => d === 6 && t >= T.six ? { fill: 'rgba(215,38,30,.16)', color: REDD } : null });
          const c6 = cells.find(c => c[0] === 6);
          const rk = prog(t, T.six, T.six + .5);
          if (rk > 0) { ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(c6[1], c6[2] - 2, 70, 56, -.1, -1.2, -1.2 + Math.PI * 2.1 * rk); ctx.stroke(); ctx.restore(); }
        }));
        const nk = prog(ts, T.nouvel - .1, T.nouvel + .15);
        if (nk > 0) text('NOUVEL AN CHINOIS', W / 2, 390, { font: font(FF.stencil, 78, 900), align: 'center', color: RED, ls: 4, alpha: nk });
        const pk2 = prog(ts, T.notez - .1, T.notez + .2);
        if (pk2 > 0) text('Prochaine alerte :', W / 2, 280, { font: font(FF.hand, 56, 700), align: 'center', color: C.violetD, alpha: pk2 });
        ctx.restore();
      }
      // ============ OUTRO: share + brand
      if (inCh('outro', .15, 1)) {
        const c = TL.ch('outro'), inK = eOutCubic(prog(t, c.start - .1, c.start + .3));
        ctx.save(); ctx.translate(0, (1 - inK) * 1200);
        const sk = spring(ts - (T.partagez - .15), 10, .45);
        if (sk > 0 && t < T.bonzini + .1) {
          const bounce = Math.abs(Math.sin((t - T.partagez) * 5)) * 18 * Math.exp(-(t - T.partagez) * .8);
          at(W / 2, 560 - bounce, 0, clamp(sk, 0, 1.2), clamp(sk, 0, 1.2), () => withShadow(14, () => {
            ctx.fillStyle = C.violet; ctx.beginPath(); ctx.moveTo(-150, 90); ctx.quadraticCurveTo(-150, -60, 40, -60); ctx.lineTo(40, -140); ctx.lineTo(190, 0); ctx.lineTo(40, 140); ctx.lineTo(40, 60);
            ctx.quadraticCurveTo(-80, 60, -150, 90); ctx.closePath(); ctx.fill(); }));
          text('PARTAGEZ', W / 2, 820, { font: font(FF.stencil, 150, 900), align: 'center', color: C.ink, ls: 8, alpha: clamp(sk) });
          const ik = prog(ts, T.importateur - .1, T.importateur + .15);
          if (ik > 0) text('à un importateur qui doit savoir', W / 2, 910, { font: font(FF.body, 54, 800), align: 'center', color: C.inkSoft, alpha: ik });
        }
        const bk = spring(t - (T.bonzini - .1), 9, .45);
        if (bk > 0) { drawLogo(W / 2, 520, 330 * clamp(bk, 0, 1.15));
          const k = prog(ts, T.bonzini, T.bonzini + .25);
          text('BONZINI', W / 2, 830, { font: font(FF.brand, 150, 900), align: 'center', color: C.ink, alpha: k, ls: 4 });
          text('TRADING CARGO', W / 2, 915, { font: font(FF.stencil, 78, 800), align: 'center', color: C.violetD, alpha: k, ls: 14 });
          const pk = prog(ts, T.previent - .3, T.previent + .1);
          if (pk > 0) { text('On vous prévient avant.', W / 2, 1060, { font: font(FF.hand, 70, 800), align: 'center', color: RED, alpha: pk });
            ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.lineCap = 'round'; const w = 360 * eOutCubic(prog(t, T.previent, T.previent + .5));
            ctx.beginPath(); ctx.moveTo(W / 2 - 360, 1088); ctx.quadraticCurveTo(W / 2, 1102, W / 2 - 360 + 2 * w, 1082); ctx.stroke(); ctx.restore(); } }
        // caution tape seals the end
        const tp = eInOutCubic(prog(t, T.s8end + .2, T.s8end + .9));
        if (tp > 0) at(W / 2 - (1 - tp) * 1600, 1560, -.05, 1, 1, () => caution(1700, 120, 'BONZINI · ALERTE IMPORTATEURS · BONZINI · ALERTE IMPORTATEURS', 9));
        ctx.restore();
      }
      const fo = prog(t, TLD.duration - .4, TLD.duration);
      if (fo > 0) { ctx.fillStyle = `rgba(242,234,219,${fo})`; ctx.fillRect(0, 0, W, H); }
    },
  });
  // caution-tape wipes between chapters
  registerScene({
    id: 'wipes', z: 80,
    draw(t, n) {
      for (const id of ['what', 'effects', 'tip1', 'cny', 'outro']) {
        const c = TL.ch(id), k = prog(t, c.start - .28, c.start + .28); if (k <= 0 || k >= 1) continue;
        at(W / 2 + lerp(-1700, 1700, eInOutCubic(k)), H / 2 - 150, -.3, 1, 1, () => caution(2000, 420, 'ATTENTION · 注意 · ATTENTION', 13));
      }
    },
  });
})();
