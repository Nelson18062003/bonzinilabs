'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — THE SCORE. One source of truth for picture AND sound.
// Wax counter of a Mboppi shop at night, under the bulb (« PAS REÇU. » engine), 1080×1920, 30 fps.
// Times in SECONDS (float: motion blur samples sub-frames).
//
// CONTRACT (serie/PIPELINE.md):
//   T[id]   = start of the SPEECH of voice line id (ids of data/script.json); T.end = film duration.
//   DUR[id] = speech duration of line id.         Both overwritten by data/timing.json (window.TIMING / require):
//             TIMING = { C1: s, …, end: s, dur: {C1: s, …}, words: {C1: [{w, s, e}], …} (word times RELATIVE to the
//             line start), A: {optional hand overrides of derived action times} }.
//   W(id, prefix, nth = 0, fb)  → absolute time of the nth word of line id starting with prefix (accent/case/elision/
//             ligature insensitive: « cœurs » = « coeurs »; 'a|b' = either prefix), else T[id] + fb.   WE(…) the same for
//             the word END. Fallbacks are written SYL(id, u) = « u syllable-units into the line » (a fraction of its real
//             DUR, see U below), so a word the ASR missed still lands in proportion on any take.
//   A       = every action time, DERIVED from T / W / DUR after the merge (no free-floating literal time).
//   VOICE v2 (clear diction, serie/DICTION.md, E/SCRIPT_V2.md): 12 lines C1 T1 T2 C2 C3 T3 T3b C4 N1 C5 N2 N3 (T3 « Allô ? »
//             and T3b « Il dit qu'il n'a rien changé ! » are two takes: the honest steel plate answers in the silence between).
//   RULE P1: a loud cue (hit, ding, stamp, brand) never STARTS inside a word: on a word END (+.03) or in a pause. A line's
//             LAST word ends at WEL(id, prefix, u) = max(ASR end, END(id)): the ASR stamps it ≈ .07–.29 s early (v1 takes).
//             soundCues() pushes the short sounds out of the words with outOfWords(), which uses the same rule.
//   Every object state below is a pure function of t. Deterministic. Loaded by the browser AND by node (audio cues):
//   node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.A, S.soundCues(), S.music())"
// =============================================================================================
(function () {                       // own scope: kit.js already declares FPS, W, H, C… as globals
const FPS = 30;
// ---------- voice keys (defaults = SCRIPT_V2.md §7.1: 3.6 syllables/s + the pauses of §6; retime.py keeps this spacing) ----------
// C = TA COMMANDE (the parcel, the only talking object of the series), T = TOI, N = the usual narrator.
// The pauses BEFORE each line carry the pictures (§6): C1 .2 · T1 .4 · T2 .35 · C2 .55 (leap + landing before « Ce n'est ») ·
// C3 .35 · T3 .6 (flip, ring, pick-up) · T3b .6 (the steel answers) · C4 1.0 (stamp, shatter, FAUX MESSAGE) · N1 .55 · C5 .45 ·
// N2 .55 (balafon + enamel plate before « Ensuite ») · N3 .35 · tail .7. Their minimums are in data/gaps.json.
const T = { C1: .2, T1: 3.88, T2: 8.12, C2: 11.67, C3: 14.52, T3: 19.01, T3b: 20.16, C4: 23.11, N1: 25.32, C5: 30.65, N2: 33.14, N3: 39.47, end: 44.84 };
const DUR = { C1: 3.28, T1: 3.89, T2: 3.0, C2: 2.5, C3: 3.89, T3: .56, T3b: 1.94, C4: 1.67, N1: 4.87, C5: 1.94, N2: 5.98, N3: 4.67 };
const LINES = ['C1', 'T1', 'T2', 'C2', 'C3', 'T3', 'T3b', 'C4', 'N1', 'C5', 'N2', 'N3'];
const SPEAKER = { C1: 'cm', C2: 'cm', C3: 'cm', C4: 'cm', C5: 'cm', T1: 'toi', T2: 'toi', T3: 'toi', T3b: 'toi', N1: 'nar', N2: 'nar', N3: 'nar' };
// syllable-units of each line (SCRIPT_V2.md §1 « syll. » + .54 per comma and 1.26 per sentence end inside the line = the
// .15 s / .35 s pauses at 3.6 syl/s): U[id] / 3.6 = the default DUR. The SYL fallbacks below count in the same units.
const U = { C1: 11.8, T1: 14, T2: 10.8, C2: 9, C3: 14, T3: 2, T3b: 7, C4: 6, N1: 17.54, C5: 7, N2: 21.54, N3: 16.8 };
let WORDS = {}, TM = null;
if (typeof window !== 'undefined' && window.TIMING) TM = window.TIMING;
else if (typeof require !== 'undefined') { try { TM = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'timing.json'), 'utf8')); } catch (e) { } }
if (TM) { for (const k in TM) if (typeof TM[k] === 'number') T[k] = TM[k]; if (TM.dur) Object.assign(DUR, TM.dur); if (TM.words) WORDS = TM.words; }
const N = Math.round(T.end * FPS);

// ---------- word anchors ----------
const deacc = s => String(s).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const forms = w => { const r = deacc(w); return [r.replace(/[^a-z0-9]/g, ''), r.replace(/^(?:[a-z]{1,2}|qu|jusqu)['’]/, '').replace(/[^a-z0-9]/g, '')]; };
function word(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return null; let c = 0;
  const ks = String(prefix).split('|').map(p => deacc(p).replace(/[^a-z0-9]/g, '')).filter(Boolean);   // 'a|b': either prefix
  for (const w of ws) if (forms(w.w).some(x => x && ks.some(k => x.startsWith(k)))) { if (c++ === nth) return w; }
  return null;
}
/** absolute START time of the nth word of line id beginning with prefix, else T[id] + fb */
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
/** absolute END time of that word, else T[id] + fb */
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + DUR[id];
/** fallback offset: u syllable-units into line id (U above), i.e. a fraction of its real DUR (= u / 3.6 s on the defaults) */
const SYL = (id, u) => DUR[id] * u / U[id];
/** END of a line's LAST word: the later of the ASR word end and the measured speech end END(id) (the ASR stamps the last
 *  word ≈ .07–.29 s before the take's real end, so WE alone would start a loud cue in the word's tail). Defaults: END(id). */
const WEL = (id, prefix) => Math.max(WE(id, prefix, 0, DUR[id]), END(id));

// ---------- maths ----------
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - cl(x), 3);
const easeIn = x => x * x * x;
const backOut = (x, s = 1.7) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const lerpv = (a, b, k) => a + (b - a) * k;
/** damped spring response 0→1 */
function spr(t, w = 16, z = .45) { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
/** landing squash after an impact at t0: {sx, sy} */
function squash(t, t0, amt = .22, freq = 30, damp = 9) {
  if (t < t0) return { sx: 1, sy: 1 };
  const s = t - t0, q = Math.exp(-s * damp) * Math.cos(s * freq) * amt; return { sx: 1 + q * .8, sy: 1 - q };
}
const fall = (t, t1, dur, y0, y1) => lerpv(y0, y1, easeIn(kk(t, t1 - dur, t1)));
const bump = (t, a, b) => (t > a && t < b) ? Math.sin(Math.PI * (t - a) / (b - a)) : 0;
/** a fast attack / slower release pulse after t0 (0 → 1 → 0) */
const pulse = (t, t0, att = .05, rel = .28) => t < t0 ? 0 : t < t0 + att ? (t - t0) / att : Math.exp(-(t - t0 - att) / rel * 2.2);

// ---------- DERIVED ACTION TIMES (after the merge) ----------
// v2 voices (SCRIPT_V2.md §1) with their syllable-units (the SYL fallbacks; « , » = .54, « ! . » inside a line = 1.26):
//   C1 « Patron, | attends ! | Ne paie pas sur ce compte ! » 11.8 (attends 2.54 · ne 5.8 · paie 6.8 · compte 10.8)
//   T1 « Mon fournisseur m'écrit qu'il a changé de compte bancaire. » 14
//   T2 « Il a mis trois cœurs, | c'est lui ! | Je paie. » 10.8 (cœurs 4–5 · je 8.8)
//   C2 « Ce n'est peut-être pas ton fournisseur ! » 9 · C3 « Appelle-le sur le numéro que tu connais déjà ! » 14
//   T3 « Allô ? » 2 · T3b « Il dit qu'il n'a rien changé ! » 7 (dit 1) · C4 « C'était un faux message ! » 6
//   N1 « Avant de payer sur un nouveau compte, | appelle l'ancien numéro. » 17.54 (nouveau 7 · compte 9 · appelle 10.54 ·
//      ancien 12.54 · numéro 14.54) · C5 « On se voit à Douala ! » 7 (Douala 4)
//   N2 « Ensuite, | Bonzini Trading Cargo amène ta commande de la Chine à Douala. » 21.54 (Chine 16.54)
//   N3 « Écris le mot ALLÔ en commentaire. | Maintenant, | tu sais. » 16.8 (commentaire 7–10 · maintenant 11.26)
const A = {};
// HOOK — TA COMMANDE is already flattened against the phone glass at frame 0 (THOK), it peels off and re-presses on
// the strong syllables of C1; « PATRON, ATTENDS ! » from frame 0, « NE PAIE PAS SUR CE COMPTE ! » on « Ne ».
A.thok = 0;
A.presses = [A.thok, W('C1', 'attend', 0, SYL('C1', 2.54)), W('C1', 'pai|pay', 0, SYL('C1', 6.8)), W('C1', 'compt|comt|cont', 0, SYL('C1', 10.8))];
A.hook2 = W('C1', 'ne', 0, SYL('C1', 5.8)) - .05;
// v2: the fake message (its « ding ») lands right AFTER « compte », the hook's last word; the dezoom stays on the word
A.bubble = Math.max(WEL('C1', 'compt|comt|cont') + .05, A.hook2 + 1.45);
A.dezoom = A.bubble - .45;                            // it peels off the glass, the camera pulls back
A.land = A.dezoom + .42;                              // back on the cloth (a bounce)
A.hookOut = A.bubble + .02;                           // the two hook lines leave as the bubble lands (≤ 3 blocks)
A.glassOff = A.bubble + .9;                           // the dust print on the phone glass is gone
A.pillQ = A.bubble + .25;                             // « « TON FOURNISSEUR » ? » drops on the bubble
A.label = A.land + .15;                               // « Boutique · Mboppi »
// T1 — « Mon fournisseur m'écrit qu'il a changé de compte bancaire. »: TOI says what he believes (the bubble keeps the
// written text); his plate « IL A CHANGÉ DE COMPTE. »; three little hearts pop (< 3/s)
A.toiIn = T.T1 - .2;
A.hearts = [0, 1, 2].map(i => Math.max(T.T1 + .45 + .35 * i, A.bubble + .35 + .35 * i));
// T2 — « Il a mis trois cœurs, c'est lui ! Je paie. »: TOI's plate changes text, the hearts pulse on « cœurs » (the guitar
// « aww » AFTER the word), « JE PAIE. » on « Je », then the plate creeps to the bubble
A.toiTxt1 = T.T2 - .1;
A.heartsPulse = W('T2', 'coeur|queur', 0, SYL('T2', 4));       // 'queur': an ASR spelling data/must.json accepts
A.aww = WE('T2', 'coeur|queur', 0, SYL('T2', 5)) + .03;
A.toiTxt2 = Math.max(W('T2', 'je', 0, SYL('T2', 8.8)) - .05, A.toiTxt1 + 1.45);
A.advance0 = A.toiTxt2 + .05;
// C2 — THE INTERRUPTION: the parcel leaps at the end of T2 and lands .25 s BEFORE « Ce n'est » (boing + bonk + the music
// stops dead in the pause: the line is said on silence); TOI's plate bonks into it and recoils
A.jump = T.C2 - .55;
A.jumpLand = T.C2 - .25;
A.bonk = A.jumpLand + .05;
A.cut = A.jumpLand;
A.c2cap = T.C2 + .05;
// C3 — THE REFLEX: dark band « APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. » (tab TA COMMANDE), no sound under the line;
// TOI's plate turns « ALLÔ ? » once TA COMMANDE has finished, ONE ring in the pause, the pick-up click just before « Allô ? »
A.band = T.C3 - .1;
A.c2capOut = A.band - .05;
A.allo = END('C3') + .02;
A.ring = [A.allo + .08];
A.pickup = T.T3 - .1;
A.aside = T.T3 - .25;                                 // the parcel steps aside (3 actors on screen)
// T3 « Allô ? » — THE CALL: the honest steel plate « JE N'AI RIEN CHANGÉ. » descends in the silence after « Allô ? » (the
// real supplier's written answer, no voice); T3b « Il dit qu'il n'a rien changé ! »: TOI's plate repeats it once the steel
// has landed (supIn1 < toiRien: the margouillat's tennis match); the bubble trembles
A.bandOut = T.T3 + .1;
A.supIn0 = END('T3') + .02;
A.supIn1 = A.supIn0 + .85;
A.toiRien = Math.max(W('T3b', 'dit', 0, SYL('T3b', 1)) - .25, A.supIn1 + .05);
A.tremble = A.supIn1;
// THE FAKE FALLS (slow motion ×0.5): the steel stamps the bubble from above, 3 cracks glowing orange, it shatters,
// letters and hearts fall and roll to the margouillat; the pill peels off: « PAS TON FOURNISSEUR »; « FAUX MESSAGE »;
// C4 « C'était un faux message ! » .13 s after it, on silence; the hearts land (clink) AFTER « message »
A.stamp = END('T3b') + .12;
A.toiOut = END('T3b') - .02;                          // TOI's plate slides away after « changé » (3 actors: steel, bubble, parcel)
A.slow0 = A.stamp; A.slow1 = Math.max(A.slow0 + 1.2, Math.min(A.slow0 + 2.4, T.N1 - .2));
A.shatter = A.stamp + .45;
A.peel = A.shatter + .12;
A.fauxStamp = A.shatter + .3;
A.roll = [0, 1, 2].map(i => END('C4') + .1 + .1 * i);
A.joy = [T.C4 - .45, T.C4 + .02, T.C4 + .42];         // the parcel's 3 joy jumps around « C'était un faux message ! » (silent)
A.major = END('C4') + .05;                            // the major chord (held, alone, under THE RULE)
// N1 — THE RULE, alone on screen ≥ 3.8 s: NOUVEAU / COMPTE ? / ANCIEN / NUMÉRO. stamped on the same 4 spoken words; the
// sub-line « avant de payer, / appelle le numéro / que tu connais déjà. » on « appelle »; the margouillat gulps a heart
// right AFTER « numéro » (picture and « gloup » together)
A.ruleW = [W('N1', 'nouveau', 0, SYL('N1', 7)), W('N1', 'compte', 0, SYL('N1', 9)), W('N1', 'ancien', 0, SYL('N1', 12.54)), W('N1', 'numero', 0, SYL('N1', 14.54))];
// v2 real takes: « Avant de payer sur un » lasts ~1.6 s before « nouveau »; the poster used to sit there EMPTY. It now
// enters .7 s before its first word (the FAUX MESSAGE scene stays on screen meanwhile); its exit keeps the old formula.
A.rule = Math.max(T.N1 - .15, A.ruleW[0] - .7);
A.supOut = A.rule - .35;
A.ruleSub = W('N1', 'appel', 0, SYL('N1', 10.54));
A.ruleOut = Math.max(T.N1 - .15 + 3.8, END('N1') + .4, A.ruleSub + 2.0);
A.gulp = WEL('N1', 'numero') + .03;
A.hic = A.gulp + .75;                                 // silent (v2): the margouillat's hiccup is picture only
// C5 + N2 — THE BRAND: the violet-glass 10-ft container (full makossa); the parcel jumps in, its kraft ribbon turns violet
// ON « Douala » (the shimmer after the word), the « BONZINI TRADING CARGO » label sticks; the balafon signature, then the
// enamel plate + tonk, both in the pause BEFORE « Ensuite » (the voice then reads the plate; nothing hits « Bonzini »)
A.cont = Math.max(T.C5 - .15, A.ruleOut - .2);
A.violet = A.cont;
A.leap = T.C5 + .25;
A.enter = A.leap + .55;
// « Douala » as the ASR may spell it (data/must.json accepts « doua la », « d'ouala », « ouala »; data/alt.json tries a
// « Douwala » tts): 'doua|doula|douw|ouala'
A.ribbon = Math.max(A.enter + .15, W('C5', 'doua|doula|douw|ouala', 0, SYL('C5', 4)));
A.shimmer = WEL('C5', 'doua|doula|douw|ouala') + .03;
A.bzLabel = A.ribbon + .35;
A.doors = A.bzLabel + .35;
A.tagBZ = A.bzLabel + .25;                            // « Entrepôt · Foyer Balengou » pinned by the container
A.sig = Math.max(T.N2 - .5, WEL('C5', 'doua|doula|douw|ouala') + .03);   // guard: never in « Douala » if the N2 pause shrinks to .45
A.plateBZ = T.N2 - .2;
A.service = Math.max(W('N2', 'chine', 0, SYL('N2', 16.54)) - .3, A.plateBZ + .35);
// N3 — END CARD: the CTA pill pops just BEFORE « Écris »; the ritual stamp hits in the pause after « commentaire. », .32 s
// before « Maintenant » (the voice then reads it); the loop after « sais »
A.endcard = T.N3 - .2;
A.cta = T.N3 - .12;
A.stampEnd = Math.max(W('N3', 'maintenant', 0, SYL('N3', 11.26)) - .32, WE('N3', 'commentaire|comment', 0, SYL('N3', 10)) + .03);
A.tagLine = A.cta + .5;
A.loop0 = T.end - .55;                                // the parcel pops out of the container and leaps at the lens
A.out = T.end - .12;                                  // every end text gone: the last frames = the parcel flying at us
if (TM && TM.A) Object.assign(A, TM.A);

// ---------- layout (world px = screen px at camera 1) ----------
const G = {
  cx: 540,
  chip: { x: 56, y: 184 },                       // series chip (screen): left edge x, centre y
  // 20_props.js (the loop's props) reads these: container 200 × 176 roof × 118 door face; parcel 122 × 100 × 72 at s = 1
  cw: 200, cd: 176, ch: 118, pw: 122, pd: 100, ph: 72, slotX: [272, 540, 808], tableY: 1120, bulb: { x: 520, y: 330 },
  // TA COMMANDE — anchor (x, y) = middle of its footprint; its FRONT bottom edge sits at y + 40·s (P_parcel convention)
  lens: { x: 540, y: 850, s: 5.0 },              // pressed on the phone glass, nearly full frame (frame 0 and the loop)
  pS: 1.8,                                       // its scale on the cloth
  rest: { x: 178, y: 1298 },                     // its place on the cloth (left of TOI's plate, above the margouillat)
  mid: { x: 548, y: 1244 },                      // the interruption: between the bubble and TOI's plate (which recoils)
  // the fake message: a bottle-green lacquered plate with a mustard rim (centre, size)
  bubble: { x: 540, y: 930, w: 780, h: 370 },
  pillQ: { x: 372, y: 738 },                     // « « TON FOURNISSEUR » ? »: the sender's pill, on the bubble's top-left edge
  // TOI's amber plate (« toi » kind of 30_plates.js: 640 × 236)
  toi: { x: 630, y: 1345 }, toiNear: { x: 600, y: 1318 }, toiBack: { x: 630, y: 1418 },   // QA: 1440 put « CHANGÉ ?! » at y 1540+
  plateH: { toi: 236, honest: 300 },
  sup: { x: 540, y: 505 },                       // the honest steel plate hovers here (honest kind: 760 × 300; QA: at 560 it hid the « ? » of the fake's sticker)
  speechY: 400, speech2Y: 1335, bandY: 400, ruleY: 735,      // QA: THE RULE is a 4-line poster (≈ 376…1094)
  label: { x: 756, y: 1172 },                    // « Boutique · Mboppi » (between the bubble and TOI's plate; QA: x ≤ 960 in y 900–1560)
  gecko: { x: 112, y: 1420 },
  heartRest: [{ x: 262, y: 1372 }, { x: 330, y: 1392 }, { x: 398, y: 1410 }],   // where the hearts come to rest (gulp order)
  fauxY: 905,                                    // « FAUX MESSAGE » hits the void where the bubble was (QA: 935 → 905, clear of the joy jumps)
  // the violet-glass container: front bottom edge centre (x, y) and scale k (×200 px wide at k = 1)
  cont: { x: 620, y: 1450, k: 1.85 }, contEnd: { x: 580, y: 1500, k: 1.5 },
  pInS: 1.25,                                    // the parcel's scale inside the container (world)
  bz: { plateY: 470, serviceY: 712, tag: { x: 222, y: 1170 } },
  end: { logoY: 290, serviceY: 378, stampY: 560, ctaY: 790, tagY: 900 },
};

// ---------- who is talking: a syllable envelope from the word times (TA COMMANDE talks by hopping) ----------
/** {id, k 0..1 (pulse on each word onset), i (word index), w} for the line speaking at t (any speaker), else null */
function speaking(t, who) {
  for (const id of LINES) {
    if (who && SPEAKER[id] !== who) continue;
    if (t < T[id] - .02 || t > END(id) + .05) continue;
    const ws = WORDS[id] || [], rel = t - T[id]; let k = 0, i = -1;
    if (ws.length) ws.forEach((w, j) => { if (/^[«»!?.,…-]+$/.test(w.w)) return; const p = pulse(rel, w.s, .045, Math.max(.12, Math.min(.3, (w.e - w.s) * .8))); if (p > k) { k = p; i = j; } });
    else { const n = Math.floor(rel / .22); k = pulse(rel, n * .22, .04, .14); i = n; }
    return { id, k: cl(k), i, w: ws[i] ? ws[i].w : '' };
  }
  return null;
}
/** the parcel's own talk envelope (0..1) — only while a C line is spoken */
const talk = t => { const s = speaking(t, 'cm'); return s ? s.k : 0; };

// ---------- TA COMMANDE (the parcel) ----------
// {mode: 'glass'|'air'|'table'|'inside'|'lens', x, y (footprint middle, P_parcel convention), s, squash 0..1 (pressed
//  on the glass), z (lift px, drives the shadow), sx, sy (squash-stretch about the FOOT, the character's own),
//  rot, talk 0..1, ribbon 0..1 (kraft → violet), bzLabel 0..1, inside (drawn inside the container), vis}
function parcel(t) {
  const L0 = G.lens, PS = G.pS, rest = G.rest, mid = G.mid;
  const out = { mode: 'table', x: rest.x, y: rest.y, s: PS, squash: 0, z: 0, sx: 1, sy: 1, rot: 0, talk: talk(t), ribbon: 0, bzLabel: 0, inside: false, vis: 1 };
  // 1. HOOK — on the glass: max press at frame 0, peels off a little between the strong syllables, re-presses on them
  if (t < A.dezoom) {
    let pr = 0; for (const p of A.presses) pr = Math.max(pr, pulse(t, p, .045, .3));
    if (t < .1) pr = 1;
    return { ...out, mode: 'glass', x: L0.x, y: L0.y, s: L0.s * (1 - .03 * (1 - pr)), squash: .07 + .23 * pr, z: 0 };
  }
  // 2. it peels off the glass and falls back onto the cloth, with a bounce
  if (t < A.land) {
    const k = kk(t, A.dezoom, A.land), e = ease(k);
    return { ...out, mode: 'air', x: lerpv(L0.x, rest.x, e), y: lerpv(L0.y, rest.y, e) - Math.sin(Math.PI * k) * 90, s: lerpv(L0.s, PS, easeOut(k)),
      squash: .07 * (1 - kk(k, 0, .25)), z: 60 * Math.sin(Math.PI * k), rot: -.25 * Math.sin(Math.PI * k) };
  }
  let x = rest.x, y = rest.y, z = 0, sx = 1, sy = 1, rot = 0;
  const land = squash(t, A.land, .2, 26, 8); sx *= land.sx; sy *= land.sy;
  // 3. the interruption: one leap from its place to the middle (stretch up, squash on landing)
  if (t >= A.jump) {
    const k = kk(t, A.jump, A.jumpLand), e = ease(k);
    x = lerpv(rest.x, mid.x, e); y = lerpv(rest.y, mid.y, e); z = Math.sin(Math.PI * k) * 210;
    if (k > 0 && k < 1) { const st = Math.sin(Math.PI * k); sy *= 1 + .22 * st; sx *= 1 - .12 * st; rot = .18 * Math.sin(Math.PI * 2 * k); }
    const q = squash(t, A.jumpLand, .26, 28, 8); sx *= q.sx; sy *= q.sy;
  }
  // 4. steps aside for the call (back to its place)
  if (t >= A.aside) {
    const k = kk(t, A.aside, A.aside + .45), e = ease(k);
    x = lerpv(mid.x, rest.x, e); y = lerpv(mid.y, rest.y, e); z = Math.sin(Math.PI * k) * 70;
    const q = squash(t, A.aside + .45, .12, 28, 9); sx *= q.sx; sy *= q.sy;
  }
  // 5. three joy jumps around « C'était un faux message ! » (silent: the line itself is the joy)
  for (const j of A.joy) { const k = kk(t, j - .16, j + .16); if (k > 0 && k < 1) { z = Math.max(z, Math.sin(Math.PI * k) * 85); sy *= 1 + .1 * Math.sin(Math.PI * k); } const q = squash(t, j + .16, .14, 30, 10); sx *= q.sx; sy *= q.sy; }
  // talking hops (squash-and-stretch on the syllables) while it speaks on the cloth
  const tk = out.talk;
  if (tk > 0 && t >= A.land && t < A.leap) { z = Math.max(z, 22 * tk); sy *= 1 + .08 * tk; sx *= 1 - .05 * tk; }
  const res = { ...out, mode: 'table', x, y, s: PS, z, sx, sy, rot };
  // 6. THE BRAND — leaps into the violet-glass container (drops in through the top), shrinks to its inside scale
  if (t >= A.leap) {
    const C = container(t), inX = C ? C.x : G.cont.x, inY = C ? C.y - (G.ch * .5 + 10) * C.k : G.cont.y - 140;
    const k = kk(t, A.leap, A.enter), e = ease(k);
    res.mode = k < 1 ? 'air' : 'inside'; res.inside = k >= 1;
    res.x = lerpv(rest.x, inX, e); res.y = lerpv(rest.y, inY, e); res.s = lerpv(PS, G.pInS, easeOut(k));
    res.z = k < 1 ? Math.sin(Math.PI * k) * 320 : 0; res.rot = k < 1 ? -.5 * Math.sin(Math.PI * k) : 0;
    if (k < 1) { const st = Math.sin(Math.PI * k); res.sy = 1 + .2 * st; res.sx = 1 - .1 * st; }
    else { const q = squash(t, A.enter, .16, 26, 9); res.sx = q.sx; res.sy = q.sy; if (tk > 0) { res.z = 14 * tk; res.sy *= 1 + .06 * tk; } }
    res.ribbon = easeOut(kk(t, A.ribbon, A.ribbon + .45));
    res.bzLabel = kk(t, A.bzLabel - .1, A.bzLabel);
  }
  // 7. THE LOOP — it pops out of the container and flies at the lens: at T.end it is exactly frame 0 (on the glass)
  if (t >= A.loop0) {
    const C = container(t), inX = C ? C.x : G.cont.x, inY = C ? C.y - (G.ch * .5 + 10) * C.k : G.cont.y - 140;
    const k = kk(t, A.loop0, T.end), e = easeIn(k);
    res.mode = k < .15 ? 'air' : 'lens'; res.inside = false;
    res.x = lerpv(inX, L0.x, e); res.y = lerpv(inY, L0.y, e) - Math.sin(Math.PI * k) * 120; res.s = lerpv(G.pInS, L0.s, e);
    res.z = 0; res.squash = .3 * kk(k, .96, 1); res.rot = .3 * Math.sin(Math.PI * k) * (1 - k);
    res.sx = 1; res.sy = 1;
    // its kraft ribbon again for the loop (frame 0 is kraft): the violet fades as it flies out
    res.ribbon = 1 - kk(k, .1, .6); res.bzLabel = 1 - kk(k, .1, .5);
  }
  return res;
}

// ---------- the fake message (bottle-green lacquered bubble, mustard rim, NO real app UI) ----------
// {x, y, w, h, s, sx, sy, rot, a, lines[], acct, hearts [3× 0..1 pop], pulse 0..1, shake 0..1, crack 0..1, shatter 0..1,
//  slow (slowed seconds since the stamp: the shatter physics clock), broken (true from A.shatter: draw shards, not the plate)}
const MSG = ['ON A CHANGÉ DE', 'COMPTE BANCAIRE.', 'PAIE ICI, VITE.'];
/** slowed clock: seconds of « story time » elapsed since t0 — runs at ×0.5 between A.slow0 and A.slow1 (the fall) */
function slow(t, t0 = A.slow0) {
  const st = x => x < A.slow0 ? x : x < A.slow1 ? A.slow0 + (x - A.slow0) * .5 : A.slow0 + (A.slow1 - A.slow0) * .5 + (x - A.slow1);
  return st(t) - st(t0);
}
function bubble(t) {
  if (t < A.bubble - .22 || t >= A.rule) return null;
  const B = G.bubble; let y = B.y, sx = 1, sy = 1, rot = 0;
  if (t < A.bubble) y = fall(t, A.bubble, .22, -260, B.y);
  else { const q = squash(t, A.bubble, .14, 26, 8); sx = q.sx; sy = q.sy; }
  // the parcel lands right under it (C2): a jolt
  { const q = squash(t, A.jumpLand + .02, .05, 30, 10); sx *= q.sx; sy *= q.sy; }
  const shake = kk(t, A.tremble, A.stamp) * (t < A.stamp ? 1 : 0);
  if (shake > 0) { const n = Math.floor(t * 30 / 2); rot = (Math.sin(n * 2.3) * .5) * .012 * shake; }
  const hearts = A.hearts.map(h => easeOut(kk(t, h, h + .18)));
  const pulseK = Math.max(pulse(t, A.heartsPulse, .06, .35), pulse(t, A.heartsPulse + .4, .06, .35) * .6);
  return { x: B.x, y, w: B.w, h: B.h, s: 1, sx, sy, rot, a: 1, lines: MSG, acct: '•••• ••••', hearts, pulse: pulseK, shake,
    crack: t >= A.stamp ? easeOut(cl(slow(t, A.stamp) / .2)) : 0, shatter: t >= A.shatter ? cl(slow(t, A.shatter) / .9) : 0,
    slow: t >= A.stamp ? slow(t, A.stamp) : 0, broken: t >= A.shatter };
}
/** the pill « « TON FOURNISSEUR » ? » on the bubble; it peels off at A.peel and reveals « PAS TON FOURNISSEUR » */
function pillQ(t) {
  if (t < A.pillQ - .15 || t >= A.rule) return null;
  const b = bubble(Math.min(t, A.shatter - .01)), x = G.pillQ.x, y0 = G.pillQ.y + (b ? b.y - G.bubble.y : 0);
  const k = easeOut(kk(t, A.pillQ - .15, A.pillQ + .1));
  // after the shatter it stays in the air where it was, then peels off: « PAS TON FOURNISSEUR » underneath
  return { x, y: y0 - (1 - k) * 60, a: k * (1 - kk(t, A.rule - .2, A.rule)), drop: k,
    peel: easeOut(kk(t, A.peel, A.peel + .45)), q: 'ON A CHANGÉ…', label: '« TON FOURNISSEUR » ?', under: 'PAS TON FOURNISSEUR' };
}
/** « FAUX MESSAGE » — orange stamp hitting the void where the bubble was */
function fauxStamp(t) {
  if (t < A.fauxStamp - .14 || t >= A.rule) return null;
  return { x: G.cx - 12, y: G.fauxY, k: kk(t, A.fauxStamp - .14, A.fauxStamp), a: 1 - kk(t, A.rule - .25, A.rule), rot: -.08 };   // QA: −12 px, the 96 px box stays left of x 960
}
/** the 3 hearts' resting places by the margouillat (the letters scatter around them) */
const HEART_REST = G.heartRest;

// ---------- the plates (30_plates.js kinds) ----------
/** TOI's amber plate: {x, y, s, sx, sy, rot, a, txt ('|' = line break), flip 0..1 (turning to « ALLÔ ? »), shake, sweat, z} */
function toiPlate(t) {
  if (t < A.toiIn - .05 || t >= A.toiOut + .5) return null;
  const P0 = G.toi; let x = P0.x, y = P0.y, s = backOut(kk(t, A.toiIn - .05, A.toiIn + .3), 2.2), sx = 1, sy = 1, rot = 0, txt = 'IL A CHANGÉ|DE COMPTE.', shake = 0;
  if (t >= A.toiTxt1) txt = 'TROIS CŒURS,|C’EST LUI !';
  if (t >= A.toiTxt2) txt = 'JE PAIE.';
  // a little pop on each text change
  for (const t0 of [A.toiTxt1, A.toiTxt2, A.toiRien]) { const q = squash(t, t0, .06, 30, 10); sx *= q.sx; sy *= q.sy; }
  // creeps towards the bubble (« je paie »), bonks into the parcel and recoils
  if (t >= A.advance0) { const k = ease(kk(t, A.advance0, A.bonk)); x = lerpv(P0.x, G.toiNear.x, k); y = lerpv(P0.y, G.toiNear.y, k); }
  if (t >= A.bonk) { const k = spr(t - A.bonk, 16, .55); x = lerpv(G.toiNear.x, G.toiBack.x, k); y = lerpv(G.toiNear.y, G.toiBack.y, k); rot = .05 * Math.exp(-(t - A.bonk) * 5) * Math.sin((t - A.bonk) * 20); const q = squash(t, A.bonk, .1, 30, 9); sx *= q.sx; sy *= q.sy; }
  // turns to « ALLÔ ? » (a flip about its horizontal axis: the text swaps at mid-turn)
  const flip = kk(t, A.allo - .15, A.allo + .15);
  if (flip > 0 && flip < 1) sy *= Math.max(.04, Math.abs(Math.cos(Math.PI * flip)));
  if (flip >= .5) txt = 'ALLÔ ?';
  if (t >= A.toiRien) { txt = 'IL N’A RIEN|CHANGÉ !'; shake = .25; }
  // slides away down-right before the stamp
  if (t >= A.toiOut) { const k = easeIn(kk(t, A.toiOut, A.toiOut + .5)); y += 700 * k; x += 120 * k; rot += .12 * k; }
  return { x, y, s, sx, sy, rot, a: 1, txt, flip, shake, sweat: 0, z: 14 };
}
/** the real supplier: honest brushed-steel plate « JE N'AI RIEN CHANGÉ. », descends gently (no squash), stamps the bubble */
function supPlate(t) {
  if (t < A.supIn0 || t >= A.supOut + .45) return null;
  const S0 = G.sup, B = G.bubble; let y = lerpv(-260, S0.y, ease(kk(t, A.supIn0, A.supIn1))), sx = 1, sy = 1, z = 120;
  y += 5 * Math.sin((t - A.supIn1) * 2.2) * kk(t, A.supIn1, A.supIn1 + .4) * (t < A.stamp - .3 ? 1 : 0);
  // the stamp: a short wind-up, then down onto the bubble (in front of it), and back up to hover
  if (t >= A.stamp - .3) {
    const up = ease(kk(t, A.stamp - .3, A.stamp - .12)), down = easeIn(kk(t, A.stamp - .12, A.stamp));
    y = S0.y - 40 * up + (B.y - 20 - S0.y + 40) * down; z = lerpv(120, 8, down);
    if (t >= A.stamp) { const k = spr(slow(t, A.stamp), 7, .6); y = lerpv(B.y - 20, S0.y, k); z = lerpv(8, 120, k); const q = squash(t, A.stamp, .08, 30, 10); sx = q.sx; sy = q.sy; }
  }
  if (t >= A.supOut) y -= 900 * easeIn(kk(t, A.supOut, A.supOut + .45));
  return { x: S0.x, y, s: 1, sx, sy, rot: 0, a: 1, txt: 'JE N’AI|RIEN CHANGÉ.', z, pill: { a: kk(t, A.supIn1 - .3, A.supIn1) } };
}

// ---------- the brand: violet-glass 10-ft container, enamel plate, the warehouse tag ----------
/** {x, y (front bottom edge centre, world), k (scale), z, glass 0..1, a, doors 0..1 (closing), id} */
function container(t) {
  if (t < A.cont - .05) return null;
  const C0 = G.cont, CE = G.contEnd; const ki = backOut(kk(t, A.cont - .05, A.cont + .35), 1.4);
  let x = C0.x, y = C0.y + (1 - ki) * 80, k = C0.k * (.6 + .4 * ki), a = cl(ki * 3), z = 0;
  if (t >= A.endcard) { const e = ease(kk(t, A.endcard, A.endcard + .5)); x = lerpv(C0.x, CE.x, e); y = lerpv(C0.y, CE.y, e); k = lerpv(C0.k, CE.k, e); }
  if (t >= A.loop0) { const e = easeIn(kk(t, A.loop0 + .1, T.end)); y += 300 * e; a *= 1 - e; }   // sinks away for the loop
  return { x, y, k, z, glass: 1, a, doors: easeOut(kk(t, A.doors, A.doors + .45)), id: 1 };
}
/** the violet enamel plate « BONZINI TRADING CARGO », lands .2 s BEFORE « Ensuite » (v2): N2 then reads it */
function bzPlate(t) {
  if (t < A.plateBZ - .22 || t >= A.endcard + .3) return null;
  const y = t < A.plateBZ ? fall(t, A.plateBZ, .22, -260, G.bz.plateY) : G.bz.plateY, q = squash(t, A.plateBZ, .08, 26, 9);
  const k = easeIn(kk(t, A.endcard, A.endcard + .3));
  return { x: G.cx, y: y - 600 * k, s: 1, sx: q.sx, sy: q.sy, rot: 0, a: 1, sweep: kk(t, A.plateBZ + .1, A.plateBZ + .8) };
}
function endcard(t) {
  if (t < A.endcard) return null;
  return { k: easeOut(kk(t, A.endcard, A.endcard + .35)), service: easeOut(kk(t, A.endcard + .25, A.endcard + .55)),
    cta: kk(t, A.cta, A.cta + .25), stamp: kk(t, A.stampEnd - .12, A.stampEnd), tag: easeOut(kk(t, A.tagLine, A.tagLine + .8)),
    out: kk(t, A.out, T.end) };
}

// ---------- texts: [t0, t1, id, text, style, owner] ----------
// owner = the module function that draws this text itself (then the type layer skips it); 'object' = the text lives
// on an object (plate, bubble…) and is drawn with it — listed here for the readability checks. '|' = line break.
// v2 (SCRIPT_V2.md §3, what is said is written): « NE PAIE PAS / SUR CE COMPTE ! » · TOI « IL A CHANGÉ DE COMPTE. » (a real
// key text now, the visible contrast with « IL N'A RIEN CHANGÉ ! ») · « TROIS CŒURS, C'EST LUI ! » · « JE PAIE. » · « CE N'EST /
// PEUT-ÊTRE PAS / TON FOURNISSEUR ! » · the rule's sub-line on 3 lines · « ON SE VOIT / À DOUALA ! ». 60_type.js draws the
// speech cards with their orange emphasis (same words).
const TEXTS = () => [
  [0, A.hookOut, 'hook1', 'PATRON,|ATTENDS !', 'speech', null],
  [A.hook2, A.hookOut, 'hook2', 'NE PAIE PAS|SUR CE COMPTE !', 'speech2', null],
  [A.bubble, A.shatter, 'msg', MSG.join('|'), 'object', 'bubble'],
  [A.pillQ, A.peel + .2, 'pillQ', '« TON FOURNISSEUR » ?', 'pill', 'CM_fake'],
  [A.label, A.toiTxt2, 'label', 'Boutique · Mboppi', 'label', null],
  [A.toiIn, A.toiTxt1, 'toi0', 'IL A CHANGÉ DE COMPTE.', 'object', 'toi'],
  [A.toiTxt1, A.toiTxt2, 'toi1', 'TROIS CŒURS, C’EST LUI !', 'object', 'toi'],
  [A.toiTxt2, A.allo, 'toi2', 'JE PAIE.', 'object', 'toi'],
  [A.c2cap, A.c2capOut, 'c2', 'CE N’EST|PEUT-ÊTRE PAS|TON FOURNISSEUR !', 'speech', null],
  [A.band, A.bandOut, 'c3', 'APPELLE LE NUMÉRO|QUE TU CONNAIS DÉJÀ.', 'band', null],
  [A.allo, A.toiRien, 'toi3', 'ALLÔ ?', 'object', 'toi'],
  [A.supIn0 + .35, A.supOut + .2, 'sup', 'JE N’AI RIEN CHANGÉ.', 'object', 'sup'],
  [A.toiRien, A.toiOut + .25, 'toi4', 'IL N’A RIEN CHANGÉ !', 'object', 'toi'],
  [A.fauxStamp - .14, A.rule, 'faux', 'FAUX MESSAGE', 'stamp', 'CM_fx'],
  [A.peel + .1, A.rule, 'pas', 'PAS TON FOURNISSEUR', 'pillPas', 'CM_fake'],
  [A.rule, A.ruleOut, 'rule', 'NOUVEAU COMPTE ?|ANCIEN NUMÉRO.', 'rule', null],
  [A.ruleSub, A.ruleOut, 'ruleSub', 'avant de payer,|appelle le numéro|que tu connais déjà.', 'ruleSub', null],
  // QA (stage 3): C5 was the only TA COMMANDE line not written, and 24.9 → 26.4 s had no text at all while the parcel leaps
  // into a violet box: its kraft card says where it goes (after THE RULE, gone before the enamel plate lands)
  [Math.max(T.C5, A.ruleOut), Math.min(A.plateBZ - .25, T.N2 + .15), 'c5', 'ON SE VOIT|À DOUALA !', 'speech', null],
  [A.bzLabel, A.loop0, 'bzLabelTxt', 'BONZINI TRADING CARGO', 'onParcel', 'BZ_onParcel'],
  [A.tagBZ, A.endcard, 'tagBZ', 'Entrepôt · Foyer Balengou', 'tagBZ', 'BZ_scene'],
  [A.plateBZ, A.endcard + .2, 'bzPlate', 'BONZINI TRADING CARGO', 'object', 'bz'],
  [A.service, A.endcard, 'service', 'DE LA CHINE À DOUALA|MER OU AIR', 'caption', 'BZ_scene'],
  [A.endcard, A.out, 'brand', 'Bonzini Trading Cargo', 'brand', 'BZ_end'],
  [A.endcard + .25, A.out, 'serviceEnd', 'Cargo Chine → Douala · mer ou air', 'serviceEnd', 'BZ_end'],
  [A.stampEnd - .12, A.out, 'stampEnd', 'MAINTENANT,|TU SAIS.', 'stampEnd', 'BZ_end'],
  [A.cta, A.out, 'cta', 'Écris ALLÔ en commentaire', 'cta', 'BZ_end'],
  [A.tagLine, A.out, 'tag', 'Tague celui qui paie trop vite', 'tagLine', 'BZ_end'],
];
/** text blocks that count for « ≤ 3 at once » (pills, labels, sub-lines attached to their block do not) */
const BLOCK_STYLES = ['speech', 'speech2', 'object', 'band', 'stamp', 'rule', 'caption', 'brand', 'stampEnd', 'cta'];
/** speaker / role pills (world, follow their object): {who: 'cm'|'toi'|'sup', x, y, a, rot} */
function pills(t) {
  const out = [];
  const P = parcel(t), tk = speaking(t, 'cm');
  // TA COMMANDE: under the parcel while it talks (and during the whole hook)
  if (P.vis && !P.inside && (t < A.dezoom || (tk && tk.id === 'C4'))) {          // the speech cards carry its tab otherwise
    const big = P.mode === 'glass';
    out.push({ who: 'cm', x: P.x, y: big ? P.y + 40 * P.s + 64 : P.y + 40 * P.s + 40 - P.z, a: big ? 1 : kk(t, T.C4 - .1, T.C4 + .05) * (1 - kk(t, END('C4') + .5, END('C4') + .7)), s: big ? 1.15 : .9 });
  }
  const Tp = toiPlate(t);
  if (Tp) out.push({ who: 'toi', x: Tp.x - 320 * Tp.s + 92, y: Tp.y - G.plateH.toi / 2 * Tp.s * Tp.sy - 4, rot: -.04 + Tp.rot, a: kk(t, A.toiIn + .15, A.toiIn + .3) * (1 - kk(t, A.toiOut, A.toiOut + .2)) });
  const Sp = supPlate(t);
  // QA: the pill fades in once the plate is nearly down (it flew above y 150), and steps aside while the plate stamps the fake
  if (Sp) out.push({ who: 'sup', x: Sp.x, y: Sp.y - G.plateH.honest / 2 * Sp.sy - 34, a: Sp.pill.a * kk(Sp.z, 40, 100) * (1 - kk(t, A.supOut, A.supOut + .2)) });
  return out;
}

// ---------- light / camera ----------
function light(t) {
  const sway = Math.sin(2 * Math.PI * t / 2.6) * 18;
  const v = ease(kk(t, A.violet, A.violet + .5)) * (1 - .45 * ease(kk(t, A.endcard, A.endcard + .5))) * (1 - kk(t, A.loop0, T.end));
  return { x: 520 + sway, y: 330, on: 1, violet: v };
}
function camera(t) {
  // the hook is framed a little closer (the parcel on the glass); the dezoom pulls back; the loop pushes in again
  let s = 1.06 - .06 * ease(kk(t, A.dezoom, A.land + .2)) + .06 * ease(kk(t, A.loop0, T.end));
  s += .025 * ease(kk(t, A.rule, A.ruleOut)) * (1 - ease(kk(t, A.ruleOut, A.ruleOut + .4)));     // the rule: a slow push
  s += .03 * ease(kk(t, A.supIn1, A.stamp)) * (1 - ease(kk(t, A.stamp, A.stamp + .5)));          // tension before the stamp
  let sx = 0, sy = 0;
  const hit = (t0, amp, dur = .25) => { if (t >= t0 && t < t0 + dur) { const d = (t - t0) * 30; const a = amp * Math.exp(-d * .5) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(A.thok, 8); for (const p of A.presses.slice(1)) hit(p, 2); hit(A.land, 3); hit(A.bubble, 3); hit(A.jumpLand, 7); hit(A.bonk, 3);
  hit(A.stamp, 11); hit(A.shatter, 4); hit(A.fauxStamp, 5); hit(A.enter, 3); hit(A.plateBZ, 5); hit(A.stampEnd, 6);
  return { s, cx: 540, cy: 980, sx, sy };
}

// ---------- the margouillat ----------
// {target:{x,y}, act:'idle'|'hop'|'tennis'|'squint'|'gulp'|'hic'|'pushups'|'smug', k, n}
function gecko(t) {
  let target = { x: G.lens.x, y: G.lens.y }, act = 'idle', k = 0, n = -1;
  const P = parcel(t);
  if (t < .45) { act = 'hop'; k = kk(t, 0, .45); }                                   // the THOK of frame 0
  if (t >= A.dezoom) target = { x: P.x, y: P.y };
  if (t >= A.bubble) target = { x: G.bubble.x, y: G.bubble.y };
  if (t >= A.toiTxt1 && t < A.jump) { act = 'squint'; target = { x: G.bubble.x, y: G.bubble.y + 40 }; }   // « trois cœurs… » — he is not convinced
  if (t >= A.jumpLand && t < A.jumpLand + .45) { act = 'hop'; k = kk(t, A.jumpLand, A.jumpLand + .45); }
  if (t >= A.jumpLand + .45 && t < A.supIn0) target = { x: P.x, y: P.y };
  if (t >= A.supIn0 && t < A.stamp) {                                                 // the call: steel ↔ TOI, a tennis match
    act = 'tennis'; const ev = [A.supIn1, A.toiRien, A.toiRien + .7]; const i = ev.filter(e => t >= e).length;
    target = i % 2 === 0 ? { x: G.sup.x, y: G.sup.y } : { x: G.toi.x, y: G.toi.y };
  }
  if (t >= A.stamp && t < A.gulp - .15) target = HEART_REST[0];
  if (t >= A.gulp - .15 && t < A.gulp + .35) { act = 'gulp'; n = 0; k = kk(t, A.gulp - .15, A.gulp + .35); }
  if (t >= A.hic && t < A.hic + .4) { act = 'hic'; k = kk(t, A.hic, A.hic + .4); }
  if (t >= A.hic + .4) target = { x: G.cont.x, y: G.cont.y - 200 };
  if (t >= A.bzLabel && t < A.bzLabel + 1) { act = 'pushups'; k = kk(t, A.bzLabel, A.bzLabel + 1); }
  if (t >= A.bzLabel + 1) { act = 'smug'; target = { x: G.cx, y: G.end.stampY }; }
  return { target, act, k, n };
}
/** adapter for the validated « PAS REÇU. » lizard (40_gecko.js reads window.SCORE at load): its beat names → ours */
function geckoShim() {
  const T2 = {
    slam: A.thok, falls: [A.supIn1, A.toiRien, A.toiRien + .7], rebounds: [A.supIn1 + .3, A.toiRien + .3, A.toiRien + 1.0],
    proof: A.toiTxt1, crush: A.jumpLand - .4, stamp: A.stamp, check: A.bzLabel,
    letters: [A.shatter - .05, A.fauxStamp - .2, A.stampEnd - .22],               // flinches: shatter, FAUX MESSAGE, end stamp
    gulps: [A.gulp, T.end + 50, T.end + 51], endcard: A.gulp - .6, hic: A.hic, end: T.end,
  };
  const G2 = { gecko: G.gecko, cx: G.cx, amberY: G.toi.y, steelHigh: G.sup.y };
  return { DUR: T.end, N, T: T2, G: G2, gecko, light, LETTER_REST: [HEART_REST[0], HEART_REST[1], HEART_REST[2]] };
}

// ---------- sound (names = the storyboard's sound column) ----------
/** v2 (voice first): a short sound must never START inside a spoken word — it slides to that word's end (+.03 s),
 *  and on to the next word's end if the words touch (at most +.6 s; past that it keeps its time at half gain).
 *  A line's last word ends at END(id) at the earliest (rule P1, WEL). Without word times (the defaults) it changes nothing. */
function outOfWords(t) {
  let u = t;
  for (let n = 0; n < 8; n++) {
    let hit = null;
    for (const id of LINES) { if (u < T[id] - .05 || u > END(id) + .03) continue;
      const ws = (WORDS[id] || []).filter(w => !/^[«»!?.,…-]+$/.test(w.w));
      for (const [i, w] of ws.entries()) { const e = i === ws.length - 1 ? Math.max(w.e, DUR[id]) : w.e;
        if (u > T[id] + w.s - .03 && u < T[id] + e) { hit = T[id] + e + .03; break; } }
      if (hit) break; }
    if (hit === null) return { t: u, k: 1 };
    u = hit;
  }
  return u - t <= .6 ? { t: u, k: 1 } : { t, k: .5 };
}
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => { if (t >= 0 && t < T.end) Q.push({ t: +t.toFixed(4), name, g, pan }); };
  const used = [], qx = (t, name, g = 1, pan = 0) => {      // pushed out of the words, never two on the same instant
    const o = outOfWords(t); let u = o.t; while (used.some(x => Math.abs(x - u) < .07)) u += .08; used.push(u); q(u, name, g * o.k, pan); };
  q(0, 'thok_glass'); q(.02, 'glass_crackle', .3); q(0, 'breath_cut', .3); q(.05, 'gecko_skitter', .3, -.6);
  A.presses.slice(1).forEach(p => q(p, 'thok_soft', .3));                       // low thuds: under the phone band
  qx(A.dezoom, 'whoosh_soft', .25); q(A.land, 'parcel_land', .7, -.3);
  q(A.bubble, 'ding_msg', .8); A.hearts.forEach((h, i) => qx(h, 'heart_pop', .25, .1 * i));
  q(A.toiIn, 'plate_pop', .4, .2); qx(A.aww, 'aww_guitar', .5);
  q(A.jump, 'whoosh_small', .4); q(A.jumpLand, 'boing_carton'); q(A.bonk, 'bonk', .7, .2); q(A.jumpLand + .05, 'gecko_skitter', .35, -.6);
  // the flip's sound after « déjà » even on the defaults (no word times there, so qx alone could not push it out of C3)
  q(A.band, 'band_in', .35); A.ring.forEach(r => q(r, 'phone_ring', .7, .4)); qx(Math.max(A.allo - .1, END('C3') + .03), 'plate_flip', .5, .2); q(A.pickup, 'phone_pickup', .5, .3);
  q(A.supIn0, 'steel_descend', .25); q(A.tremble, 'low_riser', .4);
  qx(A.toiOut, 'whoosh_small', .3, .4);
  q(A.stamp, 'big_stamp'); q(A.stamp + .04, 'crack_glow', .6); q(A.shatter, 'glass_shatter');
  q(A.peel, 'peel', .4); q(A.fauxStamp, 'stamp');
  A.roll.forEach((r, i) => qx(r, 'clink', .5, -.3 - .15 * i)); q(A.major, 'major');
  A.ruleW.forEach(w => q(w, 'tic', .2)); qx(A.gulp, 'gloup', .8, -.6);                                                   // v2: the 'hic' is silent (it fell in C5)
  q(A.violet, 'violet_hum', .4); qx(A.enter, 'glass_tonk', .45); qx(A.shimmer, 'ribbon_shimmer', .3);
  qx(A.bzLabel, 'label_slap', .3); q(A.sig, 'bonzini_sig'); q(A.plateBZ, 'tonk', .8);   // v2: 'doors_close' and 'pin' dropped (they piled up in the pause)
  qx(A.endcard, 'whoosh_soft', .4); q(A.cta, 'pop', .5); q(A.stampEnd, 'stamp_big'); q(A.loop0, 'whoosh', .6);
  q(Math.max(END('N3') + .02, T.end - .9), 'final_chord'); q(T.end - .1, 'toc_glass', .6);
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa, pas-recu/lib/makossa.py): silent hook, tense from the bubble (after C1), dead cut before C2,
 *  the major CHORD only after « C'était un faux message ! » (held, ≥ 14 dB under THE RULE), full makossa from the container */
function music() { return { silentUntil: A.bubble, tenseFrom: A.bubble, cut: A.cut, majorFrom: A.major, fullFrom: A.cont, sigAt: A.sig, end: T.end }; }

const SCORE = { FPS, N, T, DUR, U, A, W, WE, WEL, SYL, END, G, LINES, SPEAKER, MSG, HEART_REST, BLOCK_STYLES, outOfWords,
  speaking, talk, slow, parcel, bubble, pillQ, fauxStamp, toiPlate, supPlate, container, bzPlate, endcard, TEXTS, pills,
  light, camera, gecko, geckoShim, soundCues, music, kk, ease, easeOut, easeIn, backOut, spr, squash, pulse, lerpv, cl, bump };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
