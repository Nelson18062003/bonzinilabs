'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — THE SCORE. One source of truth for picture AND sound.
// The « PAS REÇU. » wax counter of a Mboppi shop, IN THE MORNING (bulb off, warm raking sun from the door), 1080×1920,
// 30 fps. Times in SECONDS (float: motion blur samples sub-frames).
//
// CONTRACT (serie/PIPELINE.md):
//   T[id]   = start of the SPEECH of voice line id (ids of data/script.json); T.end = film duration.
//   DUR[id] = speech duration of line id.         Both overwritten by data/timing.json (window.TIMING / require):
//             TIMING = { T1: s, …, end: s, dur: {T1: s, …}, words: {T1: [{w, s, e}], …} (word times RELATIVE to the
//             line start), A: {optional hand overrides of derived action times} }.
//   W(id, prefix, nth = 0, fb)  → absolute time of the nth word of line id starting with prefix (accent/case/elision
//             insensitive; 'a|b' = either prefix, for the ASR's spellings: « poignées » → « poignets »), else T[id] + fb.
//             WA(id, [prefixes], …) = W(id, prefixes.join('|'), …).  WE(…) the same for the word END.  END(id) = T[id] + DUR[id].
//             Fallbacks are written SYL(id, k, n) = « after k of the line's n syllables » (a fraction of DUR[id]), so a
//             word the ASR missed still lands in proportion on any take.
//   A       = every action time, DERIVED from T / W / DUR after the merge (no free-floating literal time).
//   VOICE v2 (clear diction, serie/DICTION.md, E/SCRIPT_V2.md): 16 lines T1 T2 N1 T3 N1b N2 N3a N3 N4 N4b N4c T4 N5 N5b N6 N6b.
//   RULE P1: a loud cue (hit, stamp, brand) never starts INSIDE a word: on a word END (WE + .03), in a pause, or after the
//             line (END + …). A line's LAST word ends at WEL(id, prefix, n) = max(ASR end, END(id)): the ASR stamps it
//             ≈ .1–.2 s early. WB(id, prefix, …, lead) = in the pause just BEFORE a word (never inside the previous one).
//   Every object state below is a pure function of t. Deterministic. Loaded by the browser AND by node (audio cues):
//   node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.A, S.soundCues(), S.music())"
// =============================================================================================
(function () {                       // own scope: kit.js already declares FPS, W, H, C… as globals
const FPS = 30;
// ---------- voice keys (defaults = SCRIPT_V2.md §7.1: 3.7 syllables/s + the pauses of §6; retime.py keeps this spacing,
// or with --pauses these silences; data/gaps.json = the minimum silence before a line that the pictures need) ----------
const T = { T1: .05, T2: 1.97, N1: 3.45, T3: 7.05, N1b: 10.37, N2: 12.96, N3a: 17.02, N3: 19.27, N4: 24.32, N4b: 26.83, N4c: 28.53, T4: 32.8, N5: 34.39, N5b: 36.09, N6: 39.51, N6b: 42.34, end: 44.59 };
const DUR = { T1: 1.62, T2: 1.08, N1: 3.24, T3: 2.97, N1b: 1.89, N2: 3.51, N3a: 1.89, N3: 4.05, N4: 2.16, N4b: 1.35, N4c: 1.62, T4: 1.08, N5: 1.35, N5b: 2.97, N6: 2.43, N6b: 1.35 };
let WORDS = {}, TM = null;
if (typeof window !== 'undefined' && window.TIMING) TM = window.TIMING;
else if (typeof require !== 'undefined') { try { TM = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'timing.json'), 'utf8')); } catch (e) { } }
if (TM) { for (const k in TM) if (typeof TM[k] === 'number') T[k] = TM[k]; if (TM.dur) Object.assign(DUR, TM.dur); if (TM.words) WORDS = TM.words; }
const N = Math.round(T.end * FPS);

// ---------- word anchors ----------
const deacc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const forms = w => { const r = deacc(w); return [r.replace(/[^a-z0-9]/g, ''), r.replace(/^(?:[a-z]{1,2}|qu|jusqu)['’]/, '').replace(/[^a-z0-9]/g, '')]; };
/** index of the nth word of line id beginning with one of the '|'-separated prefixes, or -1 */
function wordIx(id, prefix, nth) {
  const ws = WORDS[id]; if (!ws || !ws.length) return -1; let c = 0;
  const ks = String(prefix).split('|').map(p => deacc(p).replace(/[^a-z0-9]/g, '')).filter(Boolean);   // 'a|b': either prefix
  for (let i = 0; i < ws.length; i++) if (forms(ws[i].w).some(x => ks.some(k => x.startsWith(k)))) { if (c++ === nth) return i; }
  return -1;
}
const word = (id, prefix, nth) => { const i = wordIx(id, prefix, nth); return i < 0 ? null : WORDS[id][i]; };
/** absolute START time of the nth word of line id beginning with prefix, else T[id] + fb */
function W(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.s : fb); }
/** the same, trying several spellings (the ASR may hear « poignées » as « poignets ») */
function WA(id, prefixes, nth = 0, fb = 0) { return W(id, [].concat(prefixes).join('|'), nth, fb); }
/** absolute END time of that word, else T[id] + fb */
function WE(id, prefix, nth = 0, fb = 0) { const w = word(id, prefix, nth); return T[id] + (w ? w.e : fb); }
const END = id => T[id] + DUR[id];
/** true when absolute time x falls INSIDE a spoken word (10 ms tolerance at the edges; a line's last word runs to END(id),
 *  as in tools/qa_score.js). Without word times: false. */
const inWord = x => Object.keys(WORDS).some(id => T[id] !== undefined && (WORDS[id] || []).some((w, i, ws) => {
  const s = T[id] + w.s, e = T[id] + (i === ws.length - 1 ? Math.max(w.e, DUR[id]) : w.e); return x > s + .01 && x < e - .01; }));
/** fallback offset: k syllables into a line of n syllables (SCRIPT_V2.md §1 counts), i.e. a fraction of its real DUR */
const SYL = (id, k, n) => DUR[id] * k / n;
/** END of a line's LAST word: the later of the ASR word end and the measured speech end END(id). The ASR stamps a line's
 *  last word ≈ .07–.29 s before the take's real speech end, so WE alone would start a loud cue inside the word's tail.
 *  On the defaults (no words) it is END(id). */
const WEL = (id, prefix, n) => Math.max(WE(id, prefix, 0, SYL(id, n, n)), END(id));
/** a time in the pause just BEFORE a word: `lead` s ahead of it, but never inside the previous word (≥ its end + .02) and
 *  never inside this one (≤ its start − .01). Without words: T[id] + fb − lead. */
function WB(id, prefix, nth = 0, fb = 0, lead = .1) {
  const i = wordIx(id, prefix, nth); if (i < 0) return T[id] + fb - lead;
  const ws = WORDS[id], s = T[id] + ws[i].s, pe = i > 0 ? T[id] + ws[i - 1].e + .02 : -1e9;
  return Math.min(s - .01, Math.max(s - lead, pe));
}
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
const mono = (arr, gap) => { for (let i = 1; i < arr.length; i++) arr[i] = Math.max(arr[i], arr[i - 1] + gap); return arr; };

// ---------- DERIVED ACTION TIMES (after the merge) ----------
// v2 voices (SCRIPT_V2.md §1), with their syllable counts (the SYL fallbacks):
//   T1 « Mes sacs sont arrivés ! » 6 · T2 « Mais c'est pas ça ! » 4 · N1 « Ton fournisseur a fait ce que tu as écrit. » 12 ·
//   T3 « J'ai écrit : bonne qualité, comme la photo. » 11 · N1b « La photo ne dit pas tout. » 7 · N2 « Le fournisseur
//   choisit tout ce que tu n'écris pas. » 13 · N3a « La prochaine fois, fais une fiche. » 7 · N3 « Écris tout : la matière,
//   la taille, les poignées et l'emballage. » 15 · N4 « L'échantillon, c'est un seul sac. » 8 · N4b « Demande-le d'abord. » 5 ·
//   N4c « Garde-le pour comparer. » 6 · T4 « Voilà, c'est ça ! » 4 · N5 « La commande, c'est toi. » 5 · N5b « Le transport,
//   c'est Bonzini Trading Cargo. » 11 · N6 « Écris le mot FICHE en commentaire. » 9 · N6b « Maintenant, tu sais. » 5
// (values in the comments = the defaults)
const A = {};
// HOOK (0 → T2): the meme. The received bag is mid-jump out of its carton at frame 0 and lands; TOI's subtitle;
// the amber plate's shadow tightens on it, then « C'EST PAS ÇA ! » crushes it just before TOI's « Mais »
A.bagLand = T.T1 + .35;                               // .40
// slam (the BOUM) = T2 − .12, never inside « arrivés » (guard: ≥ END(T1) + .03 while the pause allows it); TOI's subtitle
// is always held ≥ 1.4 s
A.slam = Math.max(T.T2 - .12, Math.min(END('T1') + .03, T.T2 - .03), T.T1 + 1.4);   // 1.85
A.shadow0 = A.slam - .6;                              // 1.25
A.music = A.slam + .5;                                // 2.35 the tense makossa enters (nothing before: the shock alone)
// QUI A TORT ? (N1): the meme header folds away, the orange pill pops (= end of T2), the supplier's steel plate lands CALMLY
// and carries « IL A FAIT CE QUE / TU AS ÉCRIT. » while N1 says « Ton fournisseur a fait ce que tu as écrit. »
A.memeOut = T.N1 - .7;                                // 2.75 (folded before « QUI A TORT ? » pops)
A.qui = T.N1 - .4;                                    // 3.05
A.steel = T.N1 - .2;                                  // 3.25 (lands; .35 s gentle descent before)
// CE QUE TU AS ÉCRIT (T3 « J'ai écrit : … »): the plates clear, TOI's thin order card falls and sags
A.clear = T.T3 - .4;                                  // 6.65
A.order = T.T3 - .15;                                 // 6.90
// LA PHOTO NE DIT PAS TOUT (N1b): the cream band « LA PHOTO / NE DIT PAS TOUT. » at N1b − .05 (TEXTS 'photoTout'); the
// polaroid shivers on « photo »; right after « tout », the 3 « ? » tags pin on the received bag (the « tout » the photo
// does not say), their 3 stamps in the pause before N2
A.bandPhoto = T.N1b - .05;                                                            // 10.32
A.photoShiver = W('N1b', 'photo', 0, SYL('N1b', 1, 7));                                // 10.64
A.tags = mono([END('N1b') + .03, END('N1b') + .25, END('N1b') + .47], .22);           // 12.29 / 12.51 / 12.73: TAILLE ? · MATIÈRE ? · POIGNÉES ?
// THE LESSON (N2), held: the music cuts on the 3rd stamp (never before the last tag), a dark band; « BONNE QUALITÉ » goes
// soggy → crêpe until the end of the sentence
A.cut = Math.max(T.N2 - .2, A.tags[2] + .03);        // 12.76
A.band = A.cut + .05;                                 // 12.81
A.soggy0 = T.N2 + .25;
A.soggy1 = Math.max(A.soggy0 + 1.2, END('N2') - .3);  // 16.17
A.mock = END('N2') + .12;                             // 3 mocking guitar notes, after « n'écris pas »
// LA PROCHAINE FOIS (N3a « La prochaine fois, fais une fiche. »): the old carton slides out (its tags stay, unpinned), a
// blank sheet slides in, the cream band « LA PROCHAINE FOIS, / FAIS UNE FICHE. » just before the voice says it
A.next = Math.max(END('N2') + .45, T.N3a - .25);     // 16.92
A.sheet = A.next + .2;
// LA FICHE (N3 « Écris tout : la matière, la taille, les poignées et l'emballage. »): 4 small amber plates drop on the words,
// the 3 tags fly to their line and turn into ✓, TOI's gloves scribble; « ÉCRIS TOUT » is stamped at the head AFTER the
// voice (its stamp never inside « emballage »), then the violet note, read alone before N4
A.lines = mono([W('N3', 'mati', 0, SYL('N3', 4, 15)), W('N3', 'tail', 0, SYL('N3', 7, 15)),
  W('N3', 'poign|pogn|poing|poin', 0, SYL('N3', 9, 15)), W('N3', 'emball', 0, SYL('N3', 12, 15))].map(x => x - .06), .35);   // 20.29 / 21.10 / 21.64 / 22.45
A.stampAll = Math.max(A.lines[3] + .5, END('N3') + .05);   // 23.37
A.note = A.stampAll + .25;                            // 23.62 the violet note « + MON ÉTIQUETTE BONZINI… »
A.capN4 = T.N4 - .05;                                 // 24.27 caption lines 1–2 « L'ÉCHANTILLON, / C'EST UN SEUL SAC. »
// L'ÉCHANTILLON (N4, defined BEFORE it is used): the sheet shrinks to a thumbnail during « L'échantillon », the sample
// parcel lands in the comma after the word, ONE bag comes out on « un seul sac » (the photo's bag)
A.ficheAside = Math.max(A.note + 1.45, T.N4 + .25);  // 25.07 (the note is read ≥ 1.45 s at full size first)
A.parcel = Math.max(A.ficheAside + .1, WE('N4', 'echant|chant', 0, SYL('N4', 4, 8)) + .02);   // 25.42 lands in « L'échantillon, » (the ASR may write « les chantillon »)
A.unbox = Math.max(A.parcel + .8, W('N4', 'seul', 0, SYL('N4', 6, 8)) - .1);           // 26.22 ONE bag rises on « un seul sac »
// N4b « Demande-le d'abord. »: the gloves hold the bag up; caption line 3 comes in with the sentence
A.capL3 = T.N4b - .05;                                // 26.78
// N4c « Garde-le pour comparer. »: the polaroid slides next to it, caption line 4 on « Garde », the kraft tag « À GARDER »
// tied on « -le », « PAREIL ✓ » stamped in the comma, before « pour comparer » (never on « comparer »)
A.garde = W('N4c', 'garde', 0, 0) - .05;             // 28.48 caption line 4 « GARDE-LE POUR COMPARER. »
A.polaIn = Math.max(A.garde - .2, A.unbox + .1);      // 28.28
A.pareil = Math.max(WB('N4c', 'pour', 0, SYL('N4c', 2, 6), .1), A.polaIn + .5);       // 28.97
A.parcelOut = Math.max(A.unbox + .6, A.pareil - .3);  // the empty parcel leaves
// (A.keep — the kraft tag « À GARDER » tied on the held sample — is set below with the key-moment times: it precedes the taps)
// KEY MOMENT (silent, slow, ≥ 2.65 s between END(N4c) and T4): the big carton of the order arrives (the bags = the sample),
// the amber plate comes back, the sample held by the glove taps it from below: 3 cracks, P, A, S fall off and roll to the
// margouillat, « C'EST ÇA » springs to the centre, an amber ✓ is stamped; TOI: « Voilà, c'est ça ! »
A.check = T.T4 - .2;                                  // 32.60
A.letters = [A.check - 1.1, A.check - .75, A.check - .4];   // P 31.50, A 31.85, S 32.20
A.taps = [A.letters[0] - .7, A.letters[0] - .48, A.letters[0] - .26];   // 30.80 / 31.02 / 31.24
A.key = Math.min(END('N4c') + .45, A.taps[0] - .55);   // 30.25 = END(N4c) + .10 with T4 = END(N4c) + 2.65
// « À GARDER » is tied on « -le » (as soon as the sample is out of the parcel and shown)
A.keep = Math.min(Math.max(W('N4c', 'garde', 0, 0) + .1, A.unbox + .45), A.taps[0] - .9);   // 28.63
A.capN4Out = Math.max(A.key + .05, A.garde + 1.65);   // QA guard: « GARDE-LE POUR COMPARER. » held ≥ 1.4 s
A.amberBack = A.key + .15;
A.recentre = A.letters[2] + .08;
A.polaOut = Math.max(A.key + .45, A.pareil + 1.4);   // « PAREIL ✓ » held ≥ 1.4 s
// BRAND (N5 « La commande, c'est toi. » + N5b « Le transport, c'est Bonzini Trading Cargo. »): violet light + balafon
// signature BEFORE « La commande » (never over a word; guard: after T4's « ça » while the pause allows it), the roles band
// card by card on « commande » and « transport », the label of the big carton pops, the note « collée par ton fournisseur
// sur chaque carton »; the margouillat gulps P, A, S in the pauses (after « toi », after « transport, », after « Cargo »),
// never on « Bonzini »
A.violet = Math.max(T.N5 - .35, Math.min(END('T4') + .05, T.N5 - .1));   // 34.04
A.sig = A.violet;
A.role1 = W('N5', 'command', 0, SYL('N5', 1, 5)) - .12;                     // 34.54
A.role2 = W('N5b', 'transp', 0, SYL('N5b', 1, 11)) - .12;                   // 36.24
A.bzName = W('N5b', 'bonz|bond|bons', 0, SYL('N5b', 4, 11));               // 37.17 the violet underline swipes under the name
A.label = A.violet + .4;
A.labelNote = Math.max(A.role2 + .6, A.label + .8);
A.gulps = mono([WEL('N5', 'toi', 5) + .03, WE('N5b', 'transp', 0, SYL('N5b', 3, 11)) + .03,
  Math.min(END('N5b') + .03, T.N6 - .3)], .5);       // 35.77 / 36.93 / 39.09
A.hic = A.gulps[2] + .7;                              // (no hic in this film; the gecko adapter needs the beat)
// END (N6 « Écris le mot FICHE en commentaire. » + N6b « Maintenant, tu sais. »): end card, CTA on « Écris », the ritual
// stamp falls in the pause, THEN the voice reads it; the final chord after « sais »; loop
A.endcard = T.N6 - .25;                               // 39.26
A.cta = T.N6;                                         // 39.51
A.tagLine = A.cta + .55;
A.stampEnd = Math.max(END('N6') + .05, T.N6b - .3);  // 42.04
// the end texts fade, « C'EST ÇA ✓ » rises back to the subtitle's place (QA guard: the ritual stamp is held ≥ 1.45 s when the
// tail allows it; the rise still settles before the last frame)
A.loop = Math.min(T.end - .35, Math.max(T.end - .6, A.stampEnd + 1.45));   // 43.99
A.out = A.loop + .2;                                  // end texts gone: the last frames = the plate alone (frame 0's place)
if (TM && TM.A) Object.assign(A, TM.A);

// ---------- layout (world px = screen px at camera 1) ----------
const G = {
  cx: 540, far: 584,                             // far edge of the counter (10_table.js T_.FAR)
  door: { x: -260, y: 560 },                     // where the morning sun comes from (L.x, L.y)
  chip: { x: 56, y: 184 },                       // series chip (screen): left edge x, centre y
  top: { y: 398 },                               // the band / caption zone (screen), y 225–575, over the shop's back wall
  meme: { y: 322, xL: 282, xR: 798, h: 196 },    // the meme header (screen): two columns
  qui: { x: 540, y: 330 },
  photo: { x: 285, y: 800, w: 360, h: 440, rot: -.06 },     // the polaroid « LA PHOTO » (hook); centre, size at s = 1
  photoCmp: { x: 772, y: 1090, rot: .05, s: .86 },         // next to the sample (N4)
  recv: { x: 800, y: 1000, w: 330, h: 190, d: 170 },        // the old kraft carton the bags came in: FOOT (front-bottom middle)
  bag: { w: 210, h: 230 },                                  // the received bag's nominal size (soft, one thin strap)
  bagRest: { x: 806, y: 770 },                              // its centre at rest, half out of the carton
  sub: { x: 540, y: 1250 },                                 // TOI's opening subtitle = where the amber plate lands
  amberY: 1250, steelY: 1015, orderY: 1185,
  plateW: { amber: 860, steel: 780, order: 820 }, plateH: { amber: 190, steel: 260, order: 370 },
  label: { x: 712, y: 1478 },                               // « Boutique · Mboppi » kraft tag (hook only; right edge < 960)
  // the 3 « ? » tags, pinned on the received bag (pin offset from the bag centre at s = 1, tag centre offset from the pin)
  tagDef: [
    { txt: 'TAILLE ?', line: 1, pin: [-85, -10], off: [-136, -70] },      // → (585, 690) (v2: 40 px lower, under « POIGNÉES ? »)
    { txt: 'MATIÈRE ?', line: 0, pin: [-30, 60], off: [-136, 75] },       // → (640, 905)
    { txt: 'POIGNÉES ?', line: 2, pin: [40, -110], off: [-30, -66] },     // → (816, 594), on the strap (409 px wide: x 612–1020, y 551–637: under the bands' bottom 543, above « TAILLE ? »)
  ],
  fiche: { x: 540, y: 1000, w: 760, h: 820, rot: -.012 },   // the order sheet (centre); its inner layout: FICHE below
  ficheThumb: { x: 215, y: 760, s: .4, rot: -.05 },
  parcel: { x: 420, y: 1235 },                              // the sample parcel (kraft, « ÉCHANTILLON ») centre
  sampleShow: { x: 340, y: 1085 }, sampleTap: { x: 560, y: 1470 }, sampleOut: { x: 720, y: 2150 },
  big: { x: 600, y: 1010, w: 520, h: 280, d: 240 },         // the big carton of the order: FOOT
  annot: { x: 560, y: 1088 },                               // « collée par ton fournisseur sur chaque carton » (between the carton and the plate)
  gecko: { x: 112, y: 1420 },
  end: { logoY: 300, serviceY: 392, stampY: 615, ctaY: 852, tagY: 958 },
  shoulder: { L: { x: 90, y: 2350 }, R: { x: 990, y: 2350 } },    // TOI's gloves come in from the bottom edge (POV)
};
// the sheet's inner layout (offsets from its centre at s = 1, before its rotation)
const FICHE = {
  labels: ['MATIÈRE', 'TAILLE', 'POIGNÉES', 'EMBALLAGE'],
  stamp: [0, -300],                               // « ÉCRIS TOUT », at the head
  lineY: [-178, -52, 74, 200], plateX: -110, plateW: 470, plateH: 104, checkX: 280, scribX: [150, 330],
  note: [0, 330], noteW: 700, noteH: 150,
};
// oblique 3/4 view of a carton (same convention as ep2): front face w×h standing on its foot (x, y); the top face recedes
// up-right by d·OBL
const OBL = { x: .30, y: -.50 };
function cartonGeo(st) {
  const s = st.s ?? 1, w = st.w * s * (st.sx ?? 1), h = st.h * s * (st.sy ?? 1), d = st.d * s, x = st.x, y = st.y;
  const ox = d * OBL.x, oy = d * OBL.y;
  const FBL = [x - w / 2, y], FBR = [x + w / 2, y], FTL = [x - w / 2, y - h], FTR = [x + w / 2, y - h];
  return { FTL, FTR, FBR, FBL, BTL: [FTL[0] + ox, FTL[1] + oy], BTR: [FTR[0] + ox, FTR[1] + oy], BBR: [FBR[0] + ox, FBR[1] + oy],
    w, h, d, ox, oy, s, cx: x, cy: y - h / 2, top: [x + ox / 2, y - h + oy / 2] };
}
/** a point of a rotated, scaled object: local (dx, dy) → world */
function place(o, dx, dy) { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), k = o.s ?? 1; return { x: o.x + (dx * c - dy * s) * k, y: o.y + (dx * s + dy * c) * k }; }

// ---------- THE MEME (M1) ----------
/** the header « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU » (screen): {k (in), out (fold 0..1)} */
function memeBand(t) {
  if (t >= A.memeOut + .32) return null;
  return { k: 1, out: easeIn(kk(t, A.memeOut, A.memeOut + .32)) };
}
/** the polaroid « LA PHOTO » (a black RIGID tote, two handles, studio photo): {x, y, s, rot, a, pareil (stamp 0..1), pin} */
function polaroid(t) {
  let x = G.photo.x, y = G.photo.y, s = 1, rot = G.photo.rot, a = 1;
  if (t >= A.next && t < A.polaIn) {                        // slides out left while the sheet comes in
    const k = easeIn(kk(t, A.next, A.next + .45)); x = lerpv(G.photo.x, -320, k); rot += -.2 * k;
    if (k >= 1) return null;
  }
  if (t >= A.polaIn) {                                     // N4: slides in next to the sample
    const k = easeOut(kk(t, A.polaIn, A.polaIn + .4)); x = lerpv(1420, G.photoCmp.x, k); y = G.photoCmp.y; s = G.photoCmp.s; rot = lerpv(.3, G.photoCmp.rot, k);
    const o = easeIn(kk(t, A.polaOut, A.polaOut + .4)); x += 760 * o; rot += .2 * o; if (o >= 1) return null;
  }
  const q = squash(t, A.slam, .04, 30, 10);                 // everything on the counter jumps a little at the slam
  const sh = t < A.next ? bump(t, A.photoShiver - .04, A.photoShiver + .4) : 0;   // N1b: it shivers on « photo » (no sound)
  if (sh > 0) { rot += .035 * sh * Math.sin((t - A.photoShiver) * 34); s *= 1 + .035 * sh; }
  return { x, y: y - 10 * bump(t, A.slam, A.slam + .2), s, sx: q.sx, sy: q.sy, rot, a, pin: t < A.next ? 1 : 0,
    pareil: kk(t, A.pareil - .12, A.pareil), w: G.photo.w, h: G.photo.h };
}
/** the old kraft carton the bags arrived in (oblique, flaps torn open): carton state (cartonGeo) */
function recvCarton(t) {
  if (t >= A.next + .5) return null;
  const k = easeIn(kk(t, A.next, A.next + .5));
  const q = squash(t, A.bagLand, .05, 26, 9), q2 = squash(t, A.slam, .05, 30, 10);
  return { id: 'recv', x: G.recv.x + 760 * k, y: G.recv.y, w: G.recv.w, h: G.recv.h, d: G.recv.d, s: 1, sx: q.sx * q2.sx, sy: q.sy * q2.sy, rot: .06 * k, a: 1,
    flaps: 1, torn: 1, shake: cl(Math.exp(-Math.max(0, t) * 5) * .8 + (t >= A.slam ? .4 * Math.exp(-(t - A.slam) * 7) : 0)) };
}
/** the received bag: smaller, SOFT, one thin strap, saggy (what arrived). {x, y (centre), s, rot, sx, sy, a, jump, sag} */
function recvBag(t) {
  const C0 = recvCarton(t); if (!C0) return null;
  const dx = C0.x - G.recv.x;
  let x = G.bagRest.x + dx, y = G.bagRest.y, rot = -.04 + C0.rot, sx = 1, sy = 1;
  // frame 0: mid-jump (the « pouf »): already ≈ 140 px up, tilted, it falls back and lands at A.bagLand
  const j0 = -.18, jT = A.bagLand;                            // the jump started just before the film
  if (t < jT) { const u = kk(t, j0, jT), h = 4 * u * (1 - u); y -= 190 * h; rot += .35 * (1 - u) * Math.sin(u * 3); sx = 1 - .05 * h; sy = 1 + .08 * h; }
  const q = squash(t, jT, .14, 22, 7); sx *= q.sx; sy *= q.sy;
  return { x, y, s: 1, sx, sy, rot, a: 1, jump: t < jT ? 1 - kk(t, j0, jT) : 0, sag: .6 + .1 * Math.sin(t * 2.2) };
}

// ---------- THE PLATES (M1) ----------
// each: {kind, x, y, s, sx, sy, rot, a, txt (amber) | lines (steel, order), z (height above the cloth), shake, sweat,
//        amber: crack 0..1, cracks 0..3 (taps so far), tap (jolt 0..1), lost 0..3 (P, A, S gone), recentre 0..1, tick 0..1,
//        bang (the « ! » 1 → 0 as the ✓ lands);  order: sag 0..1 (bends under its own weight), soggy 0..1 (line 1 only)}
const PLATE_TXT = { amber: "C'EST PAS ÇA !", steel: ['IL A FAIT CE QUE', 'TU AS ÉCRIT.'], order: ['SACS NOIRS.', 'BONNE QUALITÉ.', 'COMME LA PHOTO.'] };
function amber(t) {
  if (t < A.slam - .2) return null;
  const Y = G.amberY;
  let y, x = G.cx, s = 1, sx = 1, sy = 1, rot = 0, a = 1, z = 10, sweat = 0, shake = 0;
  if (t < A.amberBack - .05) {
    if (t >= A.clear + .4) return null;
    if (t < A.slam) { y = fall(t, A.slam, .2, -420, Y); z = 10 + 300 * (1 - kk(t, A.slam - .2, A.slam)); }
    else { y = Y; const q = squash(t, A.slam, .26); sx = q.sx; sy = q.sy; rot = -.012 * Math.exp(-(t - A.slam) * 4); }
    // N1: TOI's plate shrinks a little and sweats while the calm steel says it
    if (t >= A.steel) { s = lerpv(1, .9, easeOut(kk(t, A.steel + .1, A.steel + .6))); sweat = kk(t, A.steel + .3, A.steel + .9); shake = .2 * kk(t, A.steel, A.steel + .3); }
    if (t >= A.clear) { const k = easeIn(kk(t, A.clear, A.clear + .4)); y = lerpv(Y, 2250, k); rot = .12 * k; }
  } else {
    // back for the key moment: rises from below with a spring, then each tap jolts it up a little
    const k = spr(t - (A.amberBack - .05), 13, .55); y = lerpv(2250, Y, cl(k, 0, 1.2));
    for (const tp of A.taps) y -= 16 * bump(t, tp - .02, tp + .14);
    const lt = A.letters; for (let i = 0; i < 3; i++) { const q = squash(t, lt[i], .04, 30, 10); sx *= q.sx; sy *= q.sy; }
    const q = squash(t, A.check, .08, 28, 9); sx *= q.sx; sy *= q.sy;
    // the end card: the plate makes room (slides down), then rises back to the subtitle's place for the loop
    if (t >= A.endcard) { const o = easeIn(kk(t, A.endcard, A.endcard + .4)), r = backOut(kk(t, A.loop, A.loop + .32), 1.3); y = lerpv(Y, 2250, o * (1 - r)); }   // settled .3 s before the end
  }
  const cracks = A.taps.filter(x => t >= x).length;
  return { kind: 'amber', txt: PLATE_TXT.amber, x, y, s, sx, sy, rot, a, z, sweat, shake,
    cracks, crack: kk(t, A.taps[0], A.letters[0]), tap: A.taps.reduce((m, tp) => Math.max(m, bump(t, tp - .02, tp + .14)), 0),
    lost: A.letters.filter(x => t >= x).length, recentre: ease(kk(t, A.recentre, A.check - .04)), tick: easeOut(kk(t, A.check, A.check + .12)),
    bang: 1 - kk(t, A.check - .04, A.check + .06) };
}
function steel(t) {
  if (t < A.steel - .4 || t >= A.clear + .5) return null;
  const Y = G.steelY;
  let y = lerpv(Y - 110, Y, ease(kk(t, A.steel - .4, A.steel))), a = easeOut(kk(t, A.steel - .4, A.steel - .25)), z = 10 + 70 * (1 - kk(t, A.steel - .4, A.steel));
  const q = squash(t, A.steel, .03, 24, 10);                  // lands without violence
  const k = ease(kk(t, A.clear, A.clear + .5)); y -= 900 * k; a *= 1 - kk(t, A.clear + .15, A.clear + .35); z += 120 * k;   // lifted away, calm (QA: gone before it reaches the chip / y < 150)
  return { kind: 'steel', lines: PLATE_TXT.steel, x: G.cx, y, s: 1, sx: q.sx, sy: q.sy, rot: 0, a, z };
}
function order(t) {
  if (t < A.order - .3 || t >= A.next + .5) return null;
  const Y = G.orderY;
  const y0 = t < A.order ? fall(t, A.order, .3, -500, Y) : Y;
  const flutter = t < A.order ? .06 * Math.sin(t * 22) : 0;
  const sag = t < A.order ? .08 : .1 + .5 * spr(t - A.order, 9, .3);      // bends under its own weight on landing (overshoot ≈ .85, settles .6)
  const k = easeIn(kk(t, A.next, A.next + .5));
  return { kind: 'order', lines: PLATE_TXT.order, x: G.cx - 300 * k, y: y0 + 900 * k, s: 1, sx: 1, sy: 1, rot: flutter - .15 * k, a: 1, z: t < A.order ? 200 : 6,
    sag, soggy: ease(kk(t, A.soggy0, A.soggy1)), soggyLine: 1 };
}
function plates(t) { return [order(t), steel(t), amber(t)].filter(Boolean); }
/** TOI's opening subtitle (white, black outline, 2 lines max) with the incoming plate's shadow: {x, y, a, shadow 0..1, splash} */
function subtitle(t) {
  if (t >= A.slam + 1.2) return null;
  return { x: G.sub.x, y: G.sub.y, a: t < A.slam ? 1 : 0, shadow: ease(kk(t, A.shadow0, A.slam)), splash: kk(t, A.slam, A.slam + 1.2), t0: A.slam };
}

// ---------- THE TAGS « ? » → ✓ (M2) ----------
// [{i, txt, line, phase 'pin'|'hang'|'fly'|'check', x, y (tag centre), px, py (pin), rot, s, a, k (phase progress), check 0..1}]
function ficheGeo(F) {
  const L = i => ({ label: place(F, FICHE.plateX, FICHE.lineY[i]), check: place(F, FICHE.checkX, FICHE.lineY[i]),
    scrib: [place(F, FICHE.scribX[0], FICHE.lineY[i] + 30), place(F, FICHE.scribX[1], FICHE.lineY[i] + 30)] });
  return { lines: [0, 1, 2, 3].map(L), stamp: place(F, ...FICHE.stamp), note: place(F, ...FICHE.note), s: F.s ?? 1, rot: F.rot || 0 };
}
function tags(t) {
  if (t < A.tags[0] - .2) return [];
  const out = [];
  G.tagDef.forEach((d, i) => {
    const t0 = A.tags[i]; if (t < t0 - .12) return;
    const B = recvBag(Math.min(t, A.next - .001)) || { x: G.bagRest.x, y: G.bagRest.y, rot: 0, s: 1 };
    const pin = place(B, d.pin[0], d.pin[1]);
    let px = pin.x, py = pin.y, x = px + d.off[0], y = py + d.off[1], rot = .04 * Math.sin(t * 2.3 + i * 2), s = 1, a = 1, phase = 'pin', k = 0, check = 0;
    if (t < t0) { const u = easeOut(kk(t, t0 - .12, t0)); s = lerpv(1.6, 1, u); a = u; }        // stamped on (« tac »)
    rot += .25 * Math.exp(-Math.max(0, t - t0) * 5) * Math.sin((t - t0) * 18);
    // the old carton slides out: the tags come unpinned and hang in the air, drifting
    if (t >= A.next) {
      phase = 'hang'; const P0 = { x: G.bagRest.x + d.pin[0] + d.off[0], y: G.bagRest.y + d.pin[1] + d.off[1] };
      x = P0.x - 10 * Math.sin((t - A.next) * 1.4 + i); y = P0.y + 18 * kk(t, A.next, A.next + 1) + 6 * Math.sin((t - A.next) * 2 + i); px = x; py = y - 60; k = kk(t, A.next, A.lines[d.line]);
    }
    // N3: each flies to its line on the word and becomes a ✓
    const tf = A.lines[d.line] + .08;
    if (t >= tf) {
      const F = fiche(t), g = F ? ficheGeo(F).lines[d.line].check : { x: 800, y: 1000 };
      const P0 = { x: G.bagRest.x + d.pin[0] + d.off[0] - 10 * Math.sin((tf - A.next) * 1.4 + i), y: G.bagRest.y + d.pin[1] + d.off[1] + 18 * kk(tf, A.next, A.next + 1) };
      const u = ease(kk(t, tf, tf + .42)); phase = u < 1 ? 'fly' : 'check'; k = u;
      x = lerpv(P0.x, g.x, u); y = lerpv(P0.y, g.y, u) - 120 * Math.sin(Math.PI * u); rot = .5 * Math.sin(Math.PI * u); s = lerpv(1, .55, u);
      check = kk(t, tf + .36, tf + .5);                      // the sheet draws the ✓ (fiche().lines[i].check): the tag fades into it
      a = 1 - check; if (a <= 0) return;
    }
    out.push({ i, txt: d.txt, line: d.line, phase, x, y, px, py, rot, s, a, k, check });
  });
  return out;
}

// ---------- THE FICHE (M2) ----------
/** the order sheet: {x, y, s, rot, a, w, h, lines: [{label, k (dropped 0..1), check 0..1, scrib 0..1}], stamp 0..1,
 *  note 0..1, thumb 0..1 (shrunk to the thumbnail)} */
function fiche(t) {
  if (t < A.sheet - .05 || t >= A.key + .4) return null;
  const F0 = G.fiche, k = easeOut(kk(t, A.sheet - .05, A.sheet + .4));
  let x = F0.x, y = lerpv(2300, F0.y, k), s = 1, rot = F0.rot + .08 * (1 - k);
  const th = ease(kk(t, A.ficheAside, A.ficheAside + .45));
  if (th > 0) { x = lerpv(F0.x, G.ficheThumb.x, th); y = lerpv(F0.y, G.ficheThumb.y, th); s = lerpv(1, G.ficheThumb.s, th); rot = lerpv(F0.rot, G.ficheThumb.rot, th); }
  const o = easeIn(kk(t, A.key, A.key + .4)); x -= 600 * o;
  for (const lt of A.lines) { const q = squash(t, lt, .02, 30, 12); s *= 1 + (q.sx - 1) * .5; }
  const lines = FICHE.labels.map((label, i) => {
    const tg = G.tagDef.findIndex(d => d.line === i);
    const ct = tg >= 0 ? A.lines[i] + .08 + .36 : A.lines[i] + .5;            // the tag lands and turns into ✓ / EMBALLAGE: drawn ✓
    return { label, k: kk(t, A.lines[i] - .14, A.lines[i]), check: kk(t, ct, ct + .14), scrib: kk(t, A.lines[i] + .2, A.lines[i] + .7), fromTag: tg >= 0 };
  });
  return { x, y, s, rot, a: 1, w: F0.w, h: F0.h, lines, stamp: kk(t, A.stampAll - .1, A.stampAll), note: kk(t, A.note - .12, A.note), thumb: th };
}

// ---------- THE SAMPLE (M2) ----------
/** the sample parcel (small kraft box, kraft tape — never violet): {x, y, s, rot, a, open 0..1, label 0..1} */
function parcel(t) {
  if (t < A.parcel - .3 || t >= A.parcelOut + .4) return null;
  const y = fall(t, A.parcel, .3, -300, G.parcel.y), q = squash(t, A.parcel, .12, 26, 9);
  const o = easeIn(kk(t, A.parcelOut, A.parcelOut + .4));
  return { x: G.parcel.x - 700 * o, y, s: 1, sx: q.sx, sy: q.sy, rot: -.04 - .2 * o, a: 1, open: ease(kk(t, A.unbox - .35, A.unbox - .05)), label: 1 };
}
/** the sample bag = the bag of the photo (black, RIGID, two handles): {x, y, s, rot, a, held ('L' | null), keep (À GARDER
 *  tag 0..1), tapping 0..1}. Lifted out of the parcel and shown; the kraft tag « À GARDER » is tied on its handle while
 *  it is held (A.keep); the glove takes it under the amber plate and taps it from below; after the ✓ it is laid aside. */
function sampleBag(t) {
  if (t < A.unbox - .05 || t >= A.endcard + .4) return null;
  const P = G.parcel, S1 = G.sampleShow, S3 = G.sampleTap, S4 = G.sampleOut;
  let x, y, rot = 0, s = lerpv(.95, 1.2, ease(kk(t, A.unbox, A.unbox + .4))), held = 'L', tapping = 0;
  const u = ease(kk(t, A.unbox - .05, A.unbox + .4));          // lifted out of the parcel, shown big next to the photo
  x = lerpv(P.x, S1.x, u); y = lerpv(P.y - 20, S1.y, u) - 60 * Math.sin(Math.PI * u); rot = .1 * (1 - u) + .02 * Math.sin(t * 2.6) * u;
  const g0 = A.taps[0] - .5;
  if (t >= g0) { const k = ease(kk(t, g0, g0 + .4)); x = lerpv(S1.x, S3.x, k); y = lerpv(S1.y, S3.y, k); rot *= 1 - k; s = lerpv(1.2, .95, k); tapping = k;
    for (const tp of A.taps) y -= 46 * bump(t, tp - .1, tp + .1); }
  const b0 = A.check + .35;                                    // kept: the glove takes it away (out at the bottom)
  if (t >= b0) { const k = easeIn(kk(t, b0, b0 + .6)); x = lerpv(S3.x, S4.x, k); y = lerpv(S3.y, S4.y, k); rot = .2 * k; tapping = 0; if (k >= 1) return null; }
  return { x, y, s, rot, a: 1, held, keep: kk(t, A.keep - .05, A.keep + .15), tapping };
}
/** TOI's two gloves (white cartoon gloves, PLAIN sleeves, no ring), from the bottom edge (POV):
 *  {L: h, R: h} with h = {x, y (wrist), rot, pose ('rest'|'grip'|'tap'|'open'|'hold'|'pen'|'press'), s, a} or null */
function gloves(t) {
  const SH = G.shoulder, out = { L: null, R: null };
  const key = (K, t) => { let i = 0; while (i < K.length - 1 && K[i + 1][0] <= t) i++; const [t0, p0, s0] = K[i], [t1, p1, s1] = K[Math.min(i + 1, K.length - 1)];
    const k = t1 > t0 ? ease(kk(t, t0, t1)) : 0; return { x: lerpv(p0.x, p1.x, k), y: lerpv(p0.y, p1.y, k), pose: k < .5 ? s0 : s1, k }; };
  const off = side => ({ x: SH[side].x, y: 2150 });
  // the felt pen (R): writes the details of each line, then gets out of the way of the stamp
  if (t >= A.lines[0] - .3 && t < A.stampAll + .1) {
    const F = fiche(t); if (F) {
      const g = ficheGeo(F), K = [[A.lines[0] - .3, off('R'), 'pen']];
      A.lines.forEach((lt, i) => { const [a, b] = g.lines[i].scrib; K.push([lt + .2, { x: a.x, y: a.y + 40 }, 'pen'], [lt + .7, { x: b.x, y: b.y + 40 }, 'pen']); });
      K.push([A.stampAll - .15, off('R'), 'pen']);
      const h = key(K, t); h.y += 6 * Math.sin(t * 40) * (h.pose === 'pen' ? 1 : 0); out.R = { ...h, rot: -.35, s: 1, a: 1 };
    }
  }
  // the sample: both open the parcel; L (the sample is on the left) lifts the bag out and shows it, R ties the kraft tag
  // « À GARDER » on its handle; the key moment: L takes the sample under the amber plate and taps it from below, then
  // carries it away (kept)
  if (t >= A.parcel && t < A.check + 1) {
    const p = G.parcel, S1 = G.sampleShow, b0 = A.check + .35;
    const bagAt = tt => sampleBag(tt) || { x: G.sampleOut.x, y: G.sampleOut.y, s: 1, tapping: 0 };
    // QA: R goes straight from the opened parcel to the tag (tied on « garde-le »), slaps it on, and clears it quickly
    const KR = [[A.parcel, off('R'), 'rest'], [A.unbox - .4, { x: p.x + 130, y: p.y + 60 }, 'open'], [A.unbox, { x: p.x + 130, y: p.y + 60 }, 'open'],
      [Math.max(A.unbox + .05, A.keep - .05), { x: S1.x + 130, y: S1.y + 80 }, 'press'], [A.keep + .2, { x: S1.x + 130, y: S1.y + 80 }, 'press'],
      [A.keep + .55, off('R'), 'rest']];
    const hr = key(KR, t); if (hr.y < 2100) out.R = { ...hr, rot: -.3, s: 1, a: 1 };
    let hl;
    if (t < A.unbox - .4) hl = key([[A.parcel, off('L'), 'rest'], [A.unbox - .4, { x: p.x - 130, y: p.y + 60 }, 'open']], t);
    else if (t < A.unbox - .05) hl = key([[A.unbox - .4, { x: p.x - 130, y: p.y + 60 }, 'open'], [A.unbox - .05, { x: p.x - 10, y: p.y - 70 }, 'grip']], t);
    else if (t < b0 + .6) { const b = bagAt(t), tap = b.tapping || 0; hl = { x: b.x - 10, y: b.y - 150 * b.s + 250 * tap, pose: tap > .5 ? 'hold' : 'grip' }; }   // by the handles (above the bag); under it for the taps
    else hl = { ...off('L'), pose: 'rest' };
    if (hl && hl.y < 2100) out.L = { ...hl, rot: .25, s: 1, a: 1 };
  }
  return out;
}

// ---------- KEY MOMENT & BRAND (M2) ----------
/** the big carton of the order (oblique, open, full of black RIGID totes = the sample), Bonzini sea label on the front:
 *  carton state + {label 0..1 (on it from the arrival), pop 0..1 (N5: the label grows / is emphasised), out} */
function bigCarton(t) {
  if (t < A.key - .05 || t >= A.endcard + .5) return null;
  const k = easeOut(kk(t, A.key - .05, A.key + .35)), q = squash(t, A.key + .35, .06, 24, 9);
  const o = easeIn(kk(t, A.endcard, A.endcard + .5));
  return { id: 'big', x: lerpv(1450, G.big.x, k) + 900 * o, y: lerpv(620, G.big.y, k), w: G.big.w, h: G.big.h, d: G.big.d, s: 1, sx: q.sx, sy: q.sy, rot: .04 * o, a: 1,
    flaps: 1, label: 1, pop: ease(kk(t, A.label, A.label + .45)) * (1 - ease(kk(t, A.endcard - .3, A.endcard))), code: 'BZ-482913', mode: 'sea',
    shake: t < A.key + .8 ? .5 * Math.exp(-Math.max(0, t - A.key - .35) * 6) : 0 };
}
/** P, A, S of the amber plate: when each detaches, where it rests (by the margouillat), when it is gulped. The flight
 *  itself (fall, bounce, roll, suck into K_mouth) is M2's (FS_letters). */
const LETTER_REST = [{ x: 262, y: 1356 }, { x: 318, y: 1374 }, { x: 374, y: 1392 }];
function lettersPlan() { return { detach: A.letters, gulps: A.gulps, rest: LETTER_REST, chars: ['P', 'A', 'S'] }; }
/** the brand sequence: {violet 0..1, role1 0..1, role2 0..1, labelNote 0..1, out} */
function brand(t) {
  if (t < A.violet - .1 || t >= A.endcard + .3) return null;
  return { violet: easeOut(kk(t, A.violet, A.violet + .5)), role1: easeOut(kk(t, A.role1, A.role1 + .25)), role2: easeOut(kk(t, A.role2, A.role2 + .25)),
    labelNote: easeOut(kk(t, A.labelNote, A.labelNote + .3)), out: easeIn(kk(t, A.endcard, A.endcard + .3)) };
}
function endcard(t) {
  if (t < A.endcard) return null;
  return { k: easeOut(kk(t, A.endcard, A.endcard + .35)), service: easeOut(kk(t, A.endcard + .5, A.endcard + .8)),   // QA: after the name
    cta: kk(t, A.cta, A.cta + .25), stamp: kk(t, A.stampEnd - .12, A.stampEnd), tag: easeOut(kk(t, A.tagLine, A.tagLine + .4)),
    out: kk(t, A.loop, A.out) };
}

// ---------- texts: [t0, t1, id, text, style, takeover] ----------
// takeover = name of the module function that draws this text itself (then the type layer skips it); '|' = line break,
// '||' = column break (meme header); *…* = emphasis (orange; violet in the brand band; « TOI » as an amber pill).
// The PLATES' texts (C'EST PAS ÇA !, IL A FAIT CE QUE TU AS ÉCRIT., the order card, the 4 fiche lines) are the plates
// themselves: not listed here, drawn by their module (fallback: 50_compose.js).
const TEXTS = () => [
  [0, A.slam, 'sub', 'Mes sacs sont arrivés !', 'subtitle', 'OM_subtitle'],
  [0, A.memeOut + .32, 'meme', "CE QUE J'AI|COMMANDÉ||CE QUE J'AI|REÇU", 'memeBand', 'OM_memeBand'],
  [0, A.next + .45, 'photo', 'LA PHOTO', 'photoLabel', 'OM_photo'],                               // object text: on the polaroid
  [0, A.qui, 'label', 'Boutique · Mboppi', 'label', null],
  [A.qui, A.clear + .1, 'qui', 'QUI A TORT ?', 'pillBig', null],
  [A.bandPhoto, A.band, 'photoTout', 'LA PHOTO|NE DIT PAS *TOUT*.', 'bandCream', null],         // N1b, then the lesson band replaces it
  [A.band, A.next, 'lesson', "LE FOURNISSEUR|CHOISIT *TOUT*|CE QUE TU N'ÉCRIS PAS.", 'bandDark', null],
  [A.next, A.stampAll, 'next', 'LA PROCHAINE FOIS,|FAIS UNE *FICHE*.', 'bandCream', null],
  [A.stampAll - .1, A.ficheAside + .2, 'stampAll', 'ÉCRIS TOUT', 'stampFiche', 'FS_fiche'],
  [A.note - .12, A.ficheAside + .2, 'note', '+ MON ÉTIQUETTE BONZINI|SUR CHAQUE CARTON', 'noteViolet', 'FS_fiche'],
  [A.capN4, A.capN4Out, 'capN4', "L'*ÉCHANTILLON*,|C'EST UN SEUL SAC.|DEMANDE-LE D'ABORD.|GARDE-LE POUR COMPARER.", 'caption2', null],   // lines 1–2 on N4, 3 on N4b (A.capL3), 4 on « Garde » (A.garde)
  [A.parcel - .3, A.parcelOut + .4, 'parcelLbl', 'ÉCHANTILLON', 'parcelLabel', 'FS_parcel'],      // object text: drawn with the parcel
  [A.pareil - .12, A.polaOut + .4, 'pareil', 'PAREIL ✓', 'stampAmber', 'FS_onPhoto'],
  [A.keep - .05, A.endcard + .4, 'keep', 'À GARDER', 'kraftTag', 'FS_sampleBag'],                  // object text: the tag on the sample
  [A.role1, A.endcard + .1, 'role1', "LA COMMANDE,|C'EST *TOI*.", 'role', 'BZ_roles'],
  [A.role2, A.endcard + .1, 'role2', "LE TRANSPORT, C'EST|*BONZINI TRADING CARGO*.", 'role', 'BZ_roles'],
  [A.label, A.endcard, 'bzCode', 'BZ-482913 · EXEMPLE', 'labelCode', 'BZ_onCarton'],              // object text: on the label (legal mention)
  [A.labelNote, A.endcard, 'bzNote', 'collée par ton fournisseur|sur chaque carton', 'annot', 'BZ_scene'],
  [A.endcard, A.out, 'brand', 'Bonzini Trading Cargo', 'brand', 'BZ_end'],
  [A.endcard + .5, A.out, 'service', 'Chine → Douala · bateau ou avion', 'service', 'BZ_end'],
  [A.stampEnd - .12, A.out, 'stampEnd', 'MAINTENANT,|TU SAIS.', 'stampEnd', 'BZ_end'],
  [A.cta, A.out, 'cta', 'Écris FICHE en commentaire', 'cta', 'BZ_end'],
  [A.tagLine, A.out, 'tag', 'Tague celui qui commande|toujours « comme la photo »', 'tagLine', 'BZ_end'],
];
/** speaker / role pills (world, follow their plate): {who: 'toi'|'fournisseur', x, y, a, rot} */
function pills(t) {
  const out = [], S = subtitle(t);
  if (S && S.a > 0) out.push({ who: 'toi', x: S.x, y: S.y + 128, a: 1 });                 // there from frame 0 (the loop)
  for (const P of plates(t)) {
    const hh = G.plateH[P.kind] / 2 * P.s * P.sy;
    if (P.kind === 'amber' && t < A.clear + .1) out.push({ who: 'toi', x: P.x, y: P.y + hh + 36, a: kk(t, A.slam + .1, A.slam + .25) * (1 - kk(t, A.clear - .1, A.clear + .1)) });
    if (P.kind === 'amber' && t >= A.check + .5 && t < A.violet + .3) out.push({ who: 'toi', x: P.x, y: P.y + hh + 36, a: kk(t, A.check + .5, A.check + .65) * (1 - kk(t, A.violet, A.violet + .3)) });   // T4 « Voilà, c'est ça ! »
    if (P.kind === 'order') out.push({ who: 'toi', x: P.x, y: P.y + hh + 34, a: kk(t, A.order + .1, A.order + .25) * (1 - kk(t, A.next - .1, A.next + .1)) });
    if (P.kind === 'steel') out.push({ who: 'fournisseur', x: P.x + 100, y: P.y - G.plateH.steel / 2 * P.sy - 26, a: P.a * kk(t, A.steel - .1, A.steel + .1) });
  }
  return out;
}

// ---------- light / camera ----------
function light(t) {
  const v = ease(kk(t, A.violet, A.violet + .5)) * (1 - .45 * ease(kk(t, A.endcard, A.endcard + .6))) * (1 - kk(t, A.out - .25, T.end));
  const dim = ease(kk(t, A.cut, A.cut + .3)) * (1 - ease(kk(t, A.next - .25, A.next + .15)));   // the lesson: the sun dips
  return { x: G.door.x, y: G.door.y, on: 0, day: 1, sun: 1 - .3 * dim, violet: v, dim };
}
function camera(t) {
  let s = 1.035 - .035 * ease(kk(t, 0, A.slam)), cx = 540, cy = 1000;
  // the lesson: a slow push onto the order card; the key moment: a slow push onto the amber plate; N5: towards the label
  const pL = ease(kk(t, A.cut, T.N2 + 2)) * (1 - ease(kk(t, A.next - .3, A.next + .2)));
  s += .045 * pL; cy = lerpv(cy, 600, pL);                      // pivot at the band: the counter grows downwards, clear of the band
  const pK = ease(kk(t, A.key + .2, A.check)) * (1 - ease(kk(t, A.check + .4, A.violet + .2)));
  s += .08 * pK; cy = lerpv(cy, G.amberY - 60, pK);
  const pB = ease(kk(t, A.label, A.label + 1.2)) * (1 - ease(kk(t, A.endcard - .3, A.endcard + .2)));
  s += .06 * pB; cx = lerpv(cx, G.big.x, pB); cy = lerpv(cy, G.big.y - 120, pB);
  let sx = 0, sy = 0;
  const hit = (t0, amp, dur = .25) => { if (t >= t0 && t < t0 + dur) { const d = (t - t0) * 30; const a = amp * Math.exp(-d * .5) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(A.slam, 13); hit(A.steel, 2); A.tags.forEach(x => hit(x, 2)); hit(A.order, 3); A.lines.forEach(x => hit(x, 2.5)); hit(A.stampAll, 7);
  hit(A.parcel, 3); hit(A.pareil, 3); hit(A.key + .35, 5); A.taps.forEach(x => hit(x, 2)); A.letters.forEach(x => hit(x, 2)); hit(A.check, 8); hit(A.stampEnd, 6);
  return { s, cx, cy, sx, sy };
}

// ---------- the margouillat ----------
// {target:{x,y}, act:'idle'|'hop'|'tennis'|'squint'|'gulp'|'pushups'|'smug', k, n}
function gecko(t) {
  let target = { x: G.sub.x, y: G.sub.y }, act = 'idle', k = 0, n = -1;
  if (t < A.slam) target = { x: G.bagRest.x, y: G.bagRest.y };                          // the bag that jumped
  if (t >= A.slam && t < A.slam + .45) { act = 'hop'; k = kk(t, A.slam, A.slam + .45); }
  if (t >= A.slam + .45 && t < A.steel - .1) target = { x: G.cx, y: G.amberY };
  if (t >= A.steel - .1 && t < A.clear) target = { x: G.cx + 120, y: G.steelY };            // the calm steel plate
  if (t >= A.clear && t < A.tags[0] - .3) target = { x: G.cx, y: G.orderY };
  if (t >= T.N1b - .15 && t < A.tags[0] - .3) target = { x: G.photo.x, y: G.photo.y };   // « La photo ne dit pas tout. »
  if (t >= A.tags[0] - .3 && t < A.cut) {                                               // follows each tag as it is pinned
    act = 'tennis'; let i = 0; for (let j = 0; j < 3; j++) if (t >= A.tags[j] - .15) i = j;
    const tg = tags(t).find(q => q.i === i); target = tg ? { x: tg.x, y: tg.y } : { x: G.bagRest.x, y: G.bagRest.y };
  }
  if (t >= A.cut && t < A.next) { act = 'squint'; target = { x: 560, y: 1980 }; }        // squints at the camera (the viewer)
  if (t >= A.next && t < A.lines[0] - .2) target = { x: G.fiche.x, y: G.fiche.y };
  if (t >= A.lines[0] - .2 && t < A.ficheAside) {
    let i = 0; for (let j = 0; j < 4; j++) if (t >= A.lines[j] - .2) i = j;
    const F = fiche(t); target = F ? ficheGeo(F).lines[i].label : { x: G.fiche.x, y: G.fiche.y };
    if (t >= A.stampAll - .1) target = F ? ficheGeo(F).stamp : target;
  }
  if (t >= A.ficheAside && t < A.key) { const b = sampleBag(t); target = b ? { x: b.x, y: b.y } : { x: G.parcel.x, y: G.parcel.y }; if (t >= A.pareil - .2) target = { x: G.photoCmp.x, y: G.photoCmp.y }; }
  if (t >= A.key && t < A.letters[0]) target = { x: G.cx, y: G.amberY };
  if (t >= A.check && t < A.check + 1) { act = 'pushups'; k = kk(t, A.check, A.check + 1); target = { x: G.cx, y: G.amberY }; }
  for (let i = 0; i < 3; i++) if (t >= A.gulps[i] - .15 && t < A.gulps[i] + .35) { act = 'gulp'; n = i; k = kk(t, A.gulps[i] - .15, A.gulps[i] + .35); }
  if (t >= A.gulps[2] + .35) { act = 'smug'; target = { x: G.cx, y: G.end.stampY }; }
  return { target, act, k, n };
}
/** adapter for the validated « PAS REÇU. » lizard (40_gecko.js reads window.SCORE at load): its beat names → ours */
function geckoShim() {
  const T2 = {
    slam: A.slam, falls: A.tags.slice(), rebounds: A.tags.map(x => x + .25),
    proof: A.cut, crush: A.steel - .4, stamp: A.stampAll, check: A.check,
    letters: A.letters.slice(), gulps: A.gulps.slice(), endcard: A.letters[0] + .6, hic: A.hic, end: T.end,
  };
  const G2 = { gecko: G.gecko, cx: G.cx, amberY: G.amberY, steelHigh: G.steelY };
  return { DUR: T.end, N, T: T2, G: G2, gecko, light, LETTER_REST };
}

// ---------- sound (names = the storyboard's sound column) ----------
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => { if (t >= 0 && t < T.end) Q.push({ t: +t.toFixed(4), name, g, pan }); };
  q(0, 'carton_tear', .8, .3); q(.02, 'pouf', .9, .3); q(A.bagLand, 'soft_land', .45, .3);
  q(A.shadow0, 'fall_whistle', .7); q(A.slam, 'boum'); q(A.slam + .03, 'marbles', .8); q(A.slam + .05, 'gecko_skitter', .35, -.6);
  q(A.memeOut, 'paper_flip', .45); q(A.qui, 'pop', .8); q(A.steel, 'metal_set', .9); q(A.steel + .08, 'ding_soft', .5);
  q(A.clear, 'whoosh_soft', .5); q(A.order, 'card_flop', .8);
  A.tags.forEach((x, i) => q(x, 'tag_stamp', .75, .2 + .1 * i));
  q(A.cut, 'music_cut'); q(A.cut + .1, 'cricket', .5); q(A.soggy1 - .35, 'pffuit', .35); q(A.mock, 'mock_guitar', .8);
  q(A.next, 'whoosh', .7); q(A.next + .1, 'riser', .7); q(A.sheet, 'paper_slide', .6);
  A.lines.forEach((x, i) => { q(x, 'clac', .5, -.1 + .07 * i); q(x + .02, 'balafon_note', .45); q(x + .2, 'felt', .35, .2); });
  fiche(A.lines[3] + 1).lines.forEach((l, i) => q(A.lines[i] + (l.fromTag ? .44 : .5), 'tic', .5, .2));
  q(A.stampAll, 'stamp'); q(A.note, 'tic', .7, .2); q(A.note + .04, 'paper', .4, .2);
  // the tonk lands in the comma after « L'échantillon, »; if a short N3 → N4 pause pushes it onto « c'est » it drops to .5
  // (SCRIPT_V2.md §6, cut plan point 2)
  const tonkG = A.parcel > WE('N4', 'echant|chant', 0, SYL('N4', 4, 8)) + .12 ? .5 : .8;
  q(A.ficheAside, 'paper_slide', .45, -.3); q(A.parcel, 'tonk', tonkG, -.2); q(A.unbox - .3, 'kraft', .4, -.2); q(A.unbox + .1, 'paper', .45, -.2);
  q(A.polaIn, 'paper_slide', .5, .3); q(A.pareil, 'stamp', .9, .3); q(A.pareil + .06, 'sparkle', .5, .3); q(A.keep, 'tic', .6, -.1); q(A.parcelOut, 'whoosh_soft', .35, -.3);
  q(A.key, 'whoosh_low', .6, .3); q(A.key + .35, 'carton_thud', .9, .2); q(A.amberBack + .2, 'boing_soft', .45);
  A.taps.forEach(x => { q(x, 'tap', .8); q(x + .02, 'crack', .6); });
  A.letters.forEach((x, i) => q(x, 'clink', .8, -.3 - .2 * i));
  q(A.check, 'stamp_big'); q(A.check + .01, 'major');
  q(A.violet, 'violet_hum', .4); q(A.sig, 'bonzini_sig'); q(A.label, 'label_slap', .3);
  // a gloup sits in a pause; a take that says the comma of « Le transport, c'est » without a break (N5b_s1 does) would start
  // it inside « c'est »: then it drops to .5, heard under the voice, never over it (as the tonk; QA: only a WARN)
  A.gulps.forEach(x => q(x, 'gloup', inWord(x) ? .5 : .8, -.5));
  q(A.endcard, 'whoosh_soft', .5); q(A.cta, 'pop', .4); q(A.stampEnd, 'stamp_big');
  q(END('N6b') + .05, 'final_chord'); q(T.end - .02, 'cut_dry');
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa, pas-recu/lib/makossa.py): silent hook, tense F♯ minor, dead cut at the lesson, a rise into
 *  the fiche (clear balafon on the lines), back to A major on the ✓; Bonzini signature on the violet light */
function music() { return { silentUntil: A.music, tenseFrom: A.music, cut: A.cut, riseFrom: A.next, balafonFrom: A.lines[0], majorFrom: A.check, sigAt: A.sig, finalChord: END('N6b') + .05, end: T.end }; }

const SCORE = { FPS, N, T, DUR, A, W, WA, WE, WEL, WB, SYL, END, G, FICHE, OBL, cartonGeo, place, memeBand, polaroid, recvCarton, recvBag, plates, amber, steel, order,
  plateText: k => PLATE_TXT[k], subtitle, tags, fiche, ficheGeo, parcel, sampleBag, gloves, bigCarton, lettersPlan, LETTER_REST, brand, endcard,
  TEXTS, pills, light, camera, gecko, geckoShim, soundCues, music, kk, ease, easeOut, easeIn, backOut, spr, squash, lerpv, cl, bump };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();
