'use strict';
// hook → code → label : the pile of identical cartons, the stamp, the client ID card, the label on every carton.
(() => {
  const CODE = 'BZ-482913';
  const CW = 290, CH = 220;
  // 12 cartons, loose grid, deterministic offsets
  const BOXES = Array.from({ length: 12 }, (_, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    return { i, x: 205 + c * 335 + (rnd(i * 3.1) - .5) * 40, y: 330 + r * 255 + (rnd(i * 5.7) - .5) * 30, r: (rnd(i * 7.3) - .5) * .16, d: .05 + ((i * 5) % 12) * .045 };
  });
  const PICK = 7;                                   // "le vôtre"
  // shell-game permutation (cartons swap places while the narrator asks the question)
  const PERM = [4, 2, 7, 10, 0, 11, 3, 1, 9, 5, 8, 6];

  function times() {
    const s1 = TL.seg('S1'), s2 = TL.seg('S2'), s3 = TL.seg('S3');
    return {
      s1, s2, s3,
      hop: TL.wt('S1', 'ressemblent'), shuffle0: TL.wt('S1', 'alors'), shuffle1: TL.we('S1', 'votre') + .1,
      stamp: TL.wt('S2', 'bonzini') + .08, clear: TL.wt('S2', 'chaque'), card: TL.wt('S2', 'code') - .15,
      bz: TL.wt('S2', 'bz'), six: TL.wt('S2', 'six'), chiffres: TL.we('S2', 'chiffres'), vous: TL.wt('S2', 'vous'), vie: TL.wt('S2', 'toujours') + .1,
      lab0: TL.ch('label').start, colle: TL.wt('S3', 'colle'), chaque: TL.wt('S3', 'chaque'), carton: TL.wt('S3', 'carton'), end: TL.ch('label').end,
    };
  }
  let T = null;

  function boxPose(b, t, ts, n) {
    // landing
    const d = drop(ts, b.d, 700 + b.i * 20, .3);
    let x = b.x, y = b.y + d.y, r = b.r;
    // synchronized hop on "ressemblent"
    const hk = ts - T.hop - b.i * .015; if (hk > 0 && hk < .5) y -= Math.sin(Math.PI * hk / .5) * 34;
    // shell game: slide to permuted slot and back is not needed — they end shuffled
    const sp = eInOutCubic(prog(ts, T.shuffle0 + (b.i % 4) * .05, T.shuffle1 - .1));
    if (sp > 0) { const tgt = BOXES[PERM[b.i]]; const arc = Math.sin(Math.PI * sp) * 60 * (b.i % 2 ? 1 : -1);
      x = lerp(x, tgt.x, sp) + arc * .6; y = lerp(y, tgt.y + (tgt.y - b.y) * 0, sp) - Math.abs(arc) * .4; r = lerp(r, tgt.r, sp); }
    const lifted = (sp > 0 && sp < 1) ? 30 * Math.sin(Math.PI * sp) : (d.landed ? 0 : 60);
    return { x, y, r, sx: d.sx, sy: d.sy, a: d.a, h: lifted };
  }

  function drawStamp(t, n, x, y) {
    // rubber stamp comes down: anticipation (rise), slam at T.stamp, lift away
    const a0 = T.stamp - .55, k = t - a0;
    if (k < 0 || t > T.stamp + .7) return;
    let yy, sc = 1;
    if (t < T.stamp - .2) yy = lerp(-900, -380, eOutCubic(prog(t, a0, T.stamp - .2)));
    else if (t < T.stamp) yy = lerp(-380, -40, eInCubic(prog(t, T.stamp - .2, T.stamp)));
    else { yy = lerp(-40, -900, eInCubic(prog(t, T.stamp + .12, T.stamp + .7))); if (t < T.stamp + .08) sc = 1.06; }
    const h = clamp(-yy / 3, 0, 200);
    at(x, y + yy, 0, sc, 1 / sc, () => withShadow(h, () => {
      ctx.fillStyle = '#3B2A1E'; rrect(-150, -40, 300, 80, 12); ctx.fill();                 // wooden block
      ctx.fillStyle = C.violetD; rrect(-160, 34, 320, 22, 6); ctx.fill();                   // rubber
      ctx.fillStyle = '#5A4130'; rrect(-40, -170, 80, 140, 24); ctx.fill();                 // handle
      ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(0, -180, 58, 0, 7); ctx.fill();    // knob
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-18, -196, 16, 0, 7); ctx.fill();
    }));
  }

  function idCard(t, n, cx, cy) {
    const k = spring(t - T.card, 11, .5); if (k <= 0) return;
    const out = eInCubic(prog(t, T.lab0 - .05, T.lab0 + .35));      // flips into the label
    const w = 900, h = 560, y = lerp(cy + 1100, cy, clamp(k, 0, 1.2)) - out * 0;
    const j = jit(501, n, .6);
    at(cx + j.x, y + j.y, -.02 + j.r, 1, 1 - out, () => withShadow(26, () => {
      ctx.fillStyle = C.cream; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill();
      ctx.save(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = C.ink; rrect(-w / 2, -h / 2, w, 110, 22); ctx.fill(); ctx.fillRect(-w / 2, -h / 2 + 60, w, 50);
      text('CODE CLIENT', -w / 2 + 44, -h / 2 + 76, { font: font(FF.stencil, 64, 800), color: C.cream, ls: 4 });
      ctx.font = `44px ${FF.cjk}`; ctx.fillStyle = C.amber; ctx.textAlign = 'right'; ctx.fillText('客户编号', w / 2 - 40, -h / 2 + 74); ctx.textAlign = 'left';
      // composing: letters drop in like letterpress type
      const f = font(FF.mono, 118, 800), total = measure(CODE, f), cw = total / CODE.length, x0 = -total / 2;
      for (let i = 0; i < CODE.length; i++) {
        const ti = i < 3 ? T.bz + i * .12 : T.six + (i - 3) * ((T.chiffres + .2 - T.six) / 6);
        const d = drop(stepT(n) + (t - n / FPS), ti, 260, .2); if (!d.a) continue;
        at(x0 + cw * (i + .5), 40 + d.y, 0, d.sx, d.sy, () => text(CODE[i], 0, 0, { font: f, color: i < 3 ? C.violetD : C.ink, align: 'center', base: 'middle' }));
      }
      // underline: 6 slots for the digits
      for (let i = 3; i < CODE.length; i++) { ctx.fillStyle = 'rgba(35,22,41,.18)'; ctx.fillRect(x0 + cw * i + 8, 112, cw - 16, 6); }
      text('Le vôtre. Unique.', -w / 2 + 44, h / 2 - 50, { size: 50, wght: 700, color: C.inkSoft, alpha: prog(t, T.vous - .2, T.vous + .2) });
      ctx.restore();
    }));
    // "À VIE" stamp
    if (t >= T.vie && out < .5) {
      const k2 = t - T.vie, sc = k2 < .08 ? 1.25 : 1 + .08 * Math.exp(-k2 * 10);
      at(cx + 285, cy + 190, -.18, sc, sc, () => stampText('À VIE', 0, 0, font(FF.stencil, 96, 900), C.orange, { box: true, h: 130, boxW: 9, starve: .45, alpha: 1 - out }));
    }
  }

  registerScene({
    id: 'intro', z: 10, when: t => t < TL.ch('label').end + .05,
    draw(t, n) {
      if (!T) T = times();
      const ts = stepT(n) + (t - n / FPS) * 0;     // objects on twos (sub-frames ignored)
      const ch = TL.ch('label');
      // camera: push toward the picked carton after the stamp
      const push = eInOutCubic(prog(t, T.clear, T.clear + 1.1));
      const pb = boxPose(BOXES[PICK], t, ts, n);
      const shake = (t >= T.stamp && t < T.stamp + .07) ? 9 : 0;
      ctx.save();
      ctx.translate(W / 2 + (rnd(n) - .5) * shake, H / 2 + (rnd(n + 9) - .5) * shake);
      ctx.scale(1 + .85 * push, 1 + .85 * push);
      ctx.translate(-lerp(W / 2, pb.x, push), -lerp(H / 2 - 120, pb.y, push));
      const fade = 1 - prog(t, ch.start - .4, ch.start + .2);
      for (const b of BOXES) {
        const p = boxPose(b, t, ts, n); if (!p.a) continue;
        let x = p.x, y = p.y, a = fade;
        if (b.i !== PICK) {                                     // the others are pushed away once "yours" is stamped
          const k = eInCubic(prog(ts, T.clear + (b.i % 5) * .04, T.clear + .55 + (b.i % 5) * .04));
          const dx = x - pb.x, dy = y - pb.y, L = Math.hypot(dx, dy) || 1; x += dx / L * 1400 * k; y += dy / L * 1400 * k;
          if (t > T.stamp) a *= 1 - .45 * prog(t, T.stamp, T.stamp + .3);
        }
        if (a <= 0) continue;
        const j = jit(b.i, n, p.h > 0 ? 1.4 : .5);
        ctx.save(); ctx.globalAlpha = a;
        at(x + j.x, y + j.y, p.r + j.r, p.sx, p.sy, () => withShadow(p.h, () => carton(CW, CH, { seed: b.i, grey: (b.i !== PICK && t > T.stamp) ? prog(t, T.stamp, T.stamp + .3) : 0,
          label: () => { if (b.i === PICK && t >= T.stamp) stampText(CODE, 0, 60, font(FF.mono, 40, 800), C.violet, { starve: .5 }); } })));
        ctx.restore();
      }
      drawStamp(t, n, pb.x, pb.y);
      ctx.restore();
      // question mark scribble on the question
      const q = env(t, T.shuffle0 + .1, T.stamp - .1, .25, .2);
      if (q > 0) at(W / 2 + 250, 330, .12, 1, 1, () => text('?', 0, 0, { font: font(FF.hand, 300, 800), color: C.violet, align: 'center', base: 'middle', alpha: q }));
      // heading note on the hook
      const hn = env(t, TL.wt('S1', 'chine') - .2, T.shuffle0 + .2, .3, .3);
      if (hn > 0) paperNote(W / 2, 205 - (1 - hn) * 40, 760, 120, -.02, () => text('Tous pareils…', 0, 20, { size: 72, wght: 800, align: 'center', alpha: hn }), { seed: 4 });
      idCard(t, n, W / 2, 660);
      // label chapter
      if (t >= ch.start - .1) labelPart(t, n);
    },
  });

  function labelPart(t, n) {
    const ch = TL.ch('label'), fl = eOutBack(prog(t, ch.start + .1, ch.start + .5));
    const out = prog(t, ch.end - .35, ch.end);
    // master label (flipped from the card)
    at(W / 2, 590 - out * 700, -.015, 1, fl, () => withShadow(20, () => shipLabel(640, 400, 'sea', CODE)));
    // three cartons slide in, each receives a label
    const sup = env(t, TL.wt('S3', 'fournisseur') - .2, ch.end, .3, .3);
    if (sup > 0) paperNote(W / 2, 225 - (1 - sup) * 30, 700, 110, .02, () => text('Chez votre fournisseur', 0, 18, { size: 56, wght: 800, align: 'center' }), { seed: 12 });
    const slap = [T.colle, T.chaque, T.carton];
    for (let i = 0; i < 3; i++) {
      const ts = stepT(n); const k = eOutCubic(prog(ts, ch.start + .25 + i * .12, ch.start + .75 + i * .12));
      const x = lerp(W + 400, 200 + i * 340, k) - out * 1400, y = 1010 + (i % 2) * 30;
      const j = jit(40 + i, n, .6);
      at(x + j.x, y + j.y, (i - 1) * .05 + j.r, 1, 1, () => withShadow(4, () => carton(300, 230, { seed: 30 + i, tape: false, label: () => {
        const d = drop(ts, slap[i], 380, .16); if (!d.a) return;
        at(0, d.y * .6, .03 * (i - 1), .42 * d.sx, .42 * d.sy, () => withShadow(d.landed ? 2 : 40, () => shipLabel(640, 400, 'sea', CODE, { seed: 7 })));
        if (d.landed) { ctx.fillStyle = C.tape; ctx.fillRect(-150, -92, 70, 22); ctx.fillRect(80, 70, 70, 22); }
      } })));
    }
  }
})();
