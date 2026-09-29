// 19_outro.js — outro: "MERCI / pour votre confiance" on Q6, then the end card (logo lock on "Bonzini" in V11).
(() => {
  'use strict';

  // ================================================================== MERCI card (during Q6)
  const MY = 560;                        // card centre
  function drawMerci(t, n) {
    const BZF = window.BZF;
    const v11 = TL.seg('V11');
    const tM = TL.wt('Q6', 'merci'), tP = TL.wt('Q6', 'pour'), tC = TL.wt('Q6', 'confiance');
    const t0 = tM - .35, tOut = v11.start - .42;
    const inK = eOutExpo(prog(t, t0, t0 + .5)), outK = eInCubic(prog(t, tOut, tOut + .3));
    if (inK <= 0 || outK >= 1) return;
    const A = 1 - outK;
    ctx.save(); ctx.globalAlpha *= A;
    ctx.translate(540, MY); ctx.scale(lerp(1, .94, outK), lerp(1, .94, outK)); ctx.translate(-540, -MY);

    // plate grows from the centre
    const pw = 900 * inK, ph = 400;
    const py = MY - ph / 2;
    plate(540 - pw / 2, py, pw, ph, { r: 34, fill: 'rgba(10,6,24,.9)', border: 'rgba(169,71,254,.75)', lw: 3 });
    if (inK > .6) brackets(540 - pw / 2 + 20, py + 20, 540 + pw / 2 - 20, py + ph - 20, 38, ICE, 4, (inK - .6) / .4 * .8);
    // top accent
    ctx.save(); ctx.fillStyle = BZF.brandGrad(540 - pw / 2 + 40, 540 + pw / 2 - 40); ctx.shadowColor = AMBER; ctx.shadowBlur = 14;
    ctx.fillRect(540 - pw / 2 + 40, py - 2, Math.max(0, pw - 80), 5); ctx.restore();
    // warm glow inside
    ctx.save(); ctx.beginPath(); rrect(540 - pw / 2, py, pw, ph, 34); ctx.clip();
    const rg = ctx.createRadialGradient(540, MY - 50, 0, 540, MY - 50, 460);
    rg.addColorStop(0, `rgba(254,86,13,${.20 * inK})`); rg.addColorStop(1, 'rgba(254,86,13,0)'); ctx.fillStyle = rg; ctx.fillRect(0, py, W, ph);
    ctx.restore();

    // MERCI — letters slam in one after another
    const word = 'MERCI', f = `900 158px ${FONT.display}`, ls = 12;
    const tw = measure(word, f, ls); let x = 540 - tw / 2 + ls / 2;
    const gr = ctx.createLinearGradient(540 - tw / 2, 0, 540 + tw / 2, 0); gr.addColorStop(0, AMBER); gr.addColorStop(1, ORANGE);
    const baseY = MY + 18;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], cw = measure(ch, f, ls), ts = tM - .12 + i * .06, k = prog(t, ts, ts + .45);
      if (k > 0) {
        const sc = lerp(1.9, 1, eOutExpo(k)), a = eOutCubic(clamp(k * 5));
        ctx.save(); ctx.translate(x + (cw - ls) / 2, baseY - 56); ctx.scale(sc, sc);
        // gradient must be in local space: rebuild per letter
        const lg = ctx.createLinearGradient(-tw / 2 - (x + (cw - ls) / 2 - 540), 0, tw / 2 - (x + (cw - ls) / 2 - 540), 0);
        lg.addColorStop(0, AMBER); lg.addColorStop(1, ORANGE);
        txt(ch, 0, 56, { font: f, color: lg, align: 'center', alpha: a, glow: `rgba(254,86,13,${.55 + .3 * Math.exp(-(t - ts) * 3)})`, glowBlur: 30, shadowBlur: 20 });
        ctx.restore();
      }
      x += cw;
    }
    // sparkles after the word lands
    const spk = t - (tM + .3);
    if (spk > 0) for (let i = 0; i < 6; i++) {
      const ph2 = (spk * .8 + rnd(i * 3.7)) % 1, sx = 540 + (rnd(i * 5.3) - .5) * (tw + 80), sy = baseY - 150 + rnd(i * 8.1) * 170;
      BZF.sparkle(sx, sy, 9 + rnd(i) * 8, i % 2 ? AMBER : '#FFFFFF', Math.sin(ph2 * Math.PI) * .9);
    }
    // "pour votre confiance"
    const k2 = prog(t, tP - .15, tP + .35);
    if (k2 > 0) {
      const f2 = `700 66px ${FONT.body}`, a1 = measure('pour votre ', f2), b1 = measure('confiance', f2), x0 = 540 - (a1 + b1) / 2, y2 = MY + 128;
      const dy = (1 - eOutExpo(k2)) * 22, a = eOutCubic(k2);
      txt('pour votre ', x0, y2 + dy, { font: f2, color: ICE, alpha: a });
      const hc = t >= tC ? Math.exp(-(t - tC) * 2.5) : 0;
      txt('confiance', x0 + a1, y2 + dy, { font: f2, color: t >= tC - .05 ? AMBER : ICE, alpha: a, glow: t >= tC - .05 ? `rgba(243,167,69,${.4 + .5 * hc})` : null, glowBlur: 18 });
    }
    ctx.restore();
  }

  // ================================================================== END CARD
  const LX = 540, LY = 474, LS = 430;
  const Y_BZ = 786, Y_TC = 872, Y_TAG = 962, Y_DIV = 1002, Y_LOC = 1072, Y_MER = 1206;
  function drawEnd(t, n) {
    const BZF = window.BZF;
    const v = TL.seg('V11'), dur = TL.duration;
    const wt = s => TL.wt('V11', s);
    const tLock = wt('bonzini'), tTr = wt('trading'), tCol = wt('colis'), tSec = wt('securite');
    const t0 = v.start - .2;
    if (t < t0 - .55) return;
    const fade = 1 - eInCubic(prog(t, dur - .7, dur));
    ctx.save(); ctx.globalAlpha *= fade;

    // backdrop: dark, calm, readable
    const bk = eOutCubic(prog(t, t0, t0 + .4));
    if (bk > 0) {
      ctx.save(); ctx.globalAlpha *= bk;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(8,4,20,.86)'); g.addColorStop(.45, 'rgba(12,6,30,.80)'); g.addColorStop(1, 'rgba(5,3,12,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(540, 760, 0, 540, 760, 900);
      rg.addColorStop(0, 'rgba(169,71,254,.20)'); rg.addColorStop(.5, 'rgba(254,86,13,.05)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        const x = rnd(i * 1.7) * W, sp = 16 + rnd(i * 2.9) * 50, y = (rnd(i * 4.1) * H - (t - t0) * sp + H * 4) % H, s = 1 + rnd(i * 6.1) * 2.4;
        ctx.globalAlpha = bk * fade * (.2 + .5 * rnd(i * 8.8)) * (.6 + .4 * Math.sin(t * 3 + i));
        ctx.fillStyle = i % 5 === 0 ? AMBER : i % 3 === 0 ? VIOLET : ICE; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // logo: pieces fly in and lock exactly on "Bonzini"
    BZF.logoAssembly(t, { x: LX, y: LY, size: LS, tLock, fly: .55, dist: 1000, shimmerAt: [tLock + 1.3, tLock + 4.0] });

    // BONZINI / TRADING CARGO
    if (t >= tLock) {
      const k = prog(t, tLock + .02, tLock + .6), sc = lerp(1.3, 1, eOutExpo(k));
      ctx.save(); ctx.translate(540, Y_BZ - 44); ctx.scale(sc, sc);
      txt(decrypt('BONZINI', k, 90), 0, 44, { font: `900 132px ${FONT.display}`, ls: 10, color: '#FFFFFF', align: 'center', glow: 'rgba(169,71,254,.95)', glowBlur: 34, glowTwice: true, alpha: eOutCubic(clamp(k * 4)) });
      ctx.restore();
    }
    const k2 = prog(t, tTr - .06, tTr + .5);
    if (k2 > 0) {
      const gr = ctx.createLinearGradient(120, 0, 960, 0); gr.addColorStop(0, AMBER); gr.addColorStop(1, ORANGE);
      txt(decrypt('TRADING CARGO', k2, 91), 540, Y_TC + (1 - eOutExpo(k2)) * 24, { font: `700 76px ${FONT.display}`, ls: 8, color: gr, align: 'center', glow: 'rgba(254,86,13,.5)', glowBlur: 18, alpha: eOutCubic(clamp(k2 * 3)) });
    }
    // tagline on "colis"
    const tg = prog(t, tCol - .2, tCol + .35);
    if (tg > 0) {
      const f = `700 60px ${FONT.body}`, A1 = 'Vos colis, en toute ', A2 = 'sécurité.', a1 = measure(A1, f), a2 = measure(A2, f), x0 = 540 - (a1 + a2) / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 30, Y_TAG - 70, (a1 + a2 + 60) * eOutCubic(tg), 100); ctx.clip();
      const dy = (1 - eOutExpo(tg)) * 16;
      txt(A1, x0, Y_TAG + dy, { font: f, color: ICE });
      const hs = t >= tSec ? Math.exp(-(t - tSec) * 2.2) : 0;
      txt(A2, x0 + a1, Y_TAG + dy, { font: f, color: t >= tSec - .05 ? AMBER : ICE, glow: t >= tSec - .05 ? `rgba(243,167,69,${.35 + .5 * hs})` : null, glowBlur: 18 });
      ctx.restore();
    }
    // divider
    const dv = eOutExpo(prog(t, tSec + .15, tSec + .75));
    if (dv > 0) {
      const lw = 330 * dv, lg = ctx.createLinearGradient(540 - lw, 0, 540 + lw, 0);
      lg.addColorStop(0, 'rgba(169,71,254,0)'); lg.addColorStop(.25, VIOLET); lg.addColorStop(.5, AMBER); lg.addColorStop(.75, ORANGE); lg.addColorStop(1, 'rgba(254,86,13,0)');
      ctx.save(); ctx.fillStyle = lg; ctx.shadowColor = VIOLET; ctx.shadowBlur = 12; ctx.fillRect(540 - lw, Y_DIV, lw * 2, 4); ctx.restore();
    }
    // location with pin
    const tLoc = v.end - .15, la = prog(t, tLoc, tLoc + .6);
    if (la > 0) {
      const f = `700 52px ${FONT.body}`, d = (CONFIG.district || '').trim(), place = (CONFIG.location_line || 'Foyer Balengou').trim();
      const loc = d ? `Entrepôt · ${d} · ${place}` : `Entrepôt · ${place}`;
      const lw = measure(loc, f), pinW = 54, x0 = 540 - (lw + pinW) / 2;
      const pk = prog(t, tLoc, tLoc + .45), pdy = (1 - eOutBack(pk)) * -60;
      ctx.save(); ctx.globalAlpha *= eOutCubic(clamp(pk * 3)); pin(x0 + 18, Y_LOC - 18 + pdy, 34, ORANGE); ctx.restore();
      if (pk >= 1) { const rp = prog(t, tLoc + .45, tLoc + 1.1); if (rp < 1) ring(x0 + 18, Y_LOC + 4, 8 + 40 * eOutCubic(rp), ORANGE, 3, 1 - rp); }
      wipeText(loc, x0 + pinW, Y_LOC, prog(t, tLoc + .12, tLoc + .6), { font: f, size: 52, color: ICE });
    }
    // merci line — enters once V11's caption has cleared the lower zone
    const tMe = v.end + .62, mk = prog(t, tMe, tMe + .6);
    if (mk > 0) {
      const f = `800 64px ${FONT.body}`, s = 'Merci pour votre confiance', mw = measure(s, f);
      const a = eOutCubic(mk), dy = (1 - eOutExpo(mk)) * 26;
      const lw = (mw / 2 + 40) * eOutExpo(prog(t, tMe + .1, tMe + .8));
      const lg = ctx.createLinearGradient(540 - lw, 0, 540 + lw, 0);
      lg.addColorStop(0, 'rgba(243,167,69,0)'); lg.addColorStop(.5, 'rgba(243,167,69,.7)'); lg.addColorStop(1, 'rgba(243,167,69,0)');
      ctx.save(); ctx.fillStyle = lg; ctx.fillRect(540 - lw, Y_MER - 92, lw * 2, 2); ctx.fillRect(540 - lw, Y_MER + 34, lw * 2, 2); ctx.restore();
      const gr = ctx.createLinearGradient(540 - mw / 2, 0, 540 + mw / 2, 0); gr.addColorStop(0, AMBER); gr.addColorStop(1, ORANGE);
      txt(s, 540, Y_MER + dy, { font: f, color: gr, align: 'center', alpha: a, glow: 'rgba(254,86,13,.45)', glowBlur: 18 });
      for (let i = 0; i < 2; i++) {
        const ph = ((t - tMe) * .6 + i * .5) % 1, side = i ? 1 : -1;
        BZF.sparkle(540 + side * (mw / 2 + 30), Y_MER - 26 + (i ? 10 : -12), 12, i ? '#FFFFFF' : AMBER, a * Math.sin(ph * Math.PI));
      }
    }
    ctx.restore();
  }

  registerScene({
    id: 'outro_merci', z: 30,
    when: t => { const tM = TL.wt('Q6', 'merci'); return t >= tM - .4 && t < TL.seg('V11').start; },
    draw: (t, n) => drawMerci(t, n),
  });
  registerScene({ id: 'end_card', z: 32, when: t => t >= TL.seg('V11').start - .8, draw: (t, n) => drawEnd(t, n) });
})();
