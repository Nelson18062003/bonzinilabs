# FINAL STORYBOARD — « Le parcours de vos colis » V2 · Kraft & Fil · « LE COLIS HÉROS »

Single source of truth for the 5 animator packages. Spine = **PARCEL** (winner), with the grafts the judges asked
for from TABLE and CARNET, and every listed problem fixed (§0.3). Vertical 1080×1920, 30 fps, Canvas 2D, deterministic.

**How to read**
- Anchors: `V03·Chine` = `TL.wt('V03','Chine')`; `V01·vous#1` = nth = 1 (2nd occurrence); `·end` = `TL.seg(id).end`.
  `after(a, b)` = `hp_after(a, b)` = `max(b, a + 2.1)` — the hold rule (every readable text stays ≥ 2.1 s).
- Times in **[brackets]** come from the CURRENT `data/timeline.json` (Kyutai voice, built 10:50, 130.0 s, 120 BPM,
  chapter starts on the 0.5 s grid). They are there to check holds only. **Code never hard-codes seconds.**
- Positions are screen px (1080×1920), `(x, y)` = centre. Sizes are final on-screen px.
- `HP_PRINT` = the hero print rect (§1.7). `NOTE` = the note-line slot (§1.8).
- Ownership: A = hook+brand, B = s1+s2, C = s3+s4, D = s5+s6, E = recap+outro (§5).

---------------------------------------------------------------------------------------------------------------------

## 0. Overview

### 0.1 The idea in one breath
One kraft carton with a cream label **« VOTRE COLIS · DE : CHINE · À : VOUS »**, and the only **violet tape** in the
film, is the hero from frame 0 to the last button. We follow it across the cream packing table: China and the groupage
are cut-paper; from the arrival onward the real phone footage plays inside photo prints taped to the table. The
signature moment is **paper → real**: the paper truck parks on a blank instant print, the print develops under it, the
paper truck peels off and the **real container** is there. Chapter cards are luggage tags that fly up into a stepper on
the violet thread; the recap brings them back down; the outro gives the real team's « merci » over its own footage.

### 0.2 One-glance plan

| ch | window [s] | owner | the parcel's scene | real footage | key FX | transition OUT |
|---|---|---|---|---|---|---|
| hook | 0–7.5 | A | carton slams in; label filled live; 3 teaser prints fan out; thread pulls the stepper up | B 4.4 · A 23.4 · B 11.0 (teasers) | slam, develop, leak | T1 continuous |
| brand | 7.5–14.0 | A | title strip; brand tag + logo assembles | — | logo pieces on twos | T2 the box opens |
| s1 | 14.0–23.5 | B | China, supplier stall, goods hop in, flaps, violet tape, EMBALLÉ, label back | — | pop-up, stamp | T3 follow-drop |
| s2 | 23.5–33.5 | B | clients A/B + Vous hop into ONE paper container; post-it « 1 conteneur » → « espace partagé » | — (paper only) | highlighter zones, flip | T4 sea rises |
| s3 | 33.5–44.5 | C | boat → paper map → tear → paper truck parks on a blank print | B 6.0 (starts developing) | pull-back, map, tear | T5 continuous develop |
| s4 | 44.5–65.0 | C | **paper → real** reveal; team speaks; container cut out; « ici » at the door | B 6.0 · B 3.62–6.05 · B 9.0 · B 10.3–12.0 | develop, peel reveal, ramp, cut-out, freeze, arrow | T6 **dive → peel** |
| s5 | 65.0–89.0 | D | container sticker opens, hero tumbles out last; paper warehouse **flips into the real one**; real cartons get violet tape; polaroids snap into a row | A 15.9–18.5 · A 23.4–23.8 · A 25.2 / 12.4 / 19.8 | flap, paper→photo flip, polygon cut-out, stamps | T7 follow-drop |
| s6 | 89.0–106.0 | D | footprints → a paper client picks the parcel up → the real door → « FOYER BALENGOU » tag, thread bow | B2 4.0–4.8 | slow-mo blend, KB, circle | T8 pull-out + stepper unhooks |
| recap | 106.0–117.5 | E | tags fall into a laced list, flip on each word; hero centre stage, final stamp | — | ticket flips | T9 whip |
| outro | 117.5–130.0 | E | real « merci » over its own footage; MERCI tag; brand tag returns | A 18.64–23.2 (sync) | synced print | button |

Seven transition styles over nine transitions; the only repeat is the follow-drop (T3, T7), never twice in a row.

### 0.3 Fix log (judges' problems → resolution)

| # | problem (judges) | resolution in this storyboard |
|---|---|---|
| 1 | s5 Q3 used B2 7.5–9.0 (readable trefoil shorts) | Q3 = **A 15.9 → 18.5** (cartons rows), reached by a paper → photo flip. No B2 interior frame anywhere. |
| 2 | s6 Q5 used B2 2.4–5.2 (green-jersey man ≤ 3.7) | Q5 = **B2 4.0 → 4.8** only (checked: man gone at 4.0), then freeze on the doorway. |
| 3 | B 15.0–16.56 used 3× (letter remnants) | **No B ≥ 12.1 anywhere.** s3/s4 reveal uses B 6.0 (checked clean); hook P3 = B 11.0. |
| 4 | s2 cut-out from B2 12.4 = slab; African street in the China chapter | **s2 is paper only.** The single container cut-out comes from **B 9.0** (whole container, 3 edges visible), in s4, cut as a scissor quad. Its star-outline ghost is covered by the « VOTRE COLIS » mini label, stuck on the blank print **before** it develops (ghost never visible). |
| 5 | « rembobinage » gag may read as a glitch | **Cut.** Replaced by a forward action: the box is opened (tape snaps, flaps spring, label set aside). |
| 6 | s4 too dense | Trimmed: no circle on V06, one stamp (ARRIVÉ), one note-line item at a time, Q1/Q2 « sécurité » get a check, not a stamp. Every beat is sequential and ≤ 2 blocks. |
| 7 | « ARRIVÉ » on Q2 « sécurité » | ARRIVÉ lands on V06 « entrepôt » right after the reveal. EN SÉCURITÉ moves to V08 « sécurité ». |
| 8 | s2 clients told apart by tape only | Kraft tags **« Client A » · « Client B » · « Vous »** (TABLE graft). |
| 9 | s6 hands-free lift too abstract | **Paper client** picks the parcel up at the Bonzini counter (TABLE) after **footprints** walk in on « venir » (CARNET). |
| 10 | « ici ! » written on footage, no halo | **Note-line rule** (CARNET): words only on paper under the print; marker strokes on prints get a 6 px cream halo. |
| 11 | `teamBadge` fonts 40/34 px | New `hp_badge` 46/44 px, waveform driven by the real Q RMS (TABLE). |
| 12 | too much bespoke code | Rewind and print push-in s3→s4 removed; one dive (s4→s5) only; one peel; world camera not needed. |
| 13 | hero overacting | ≤ 1 mood per beat, squash ≤ 6 %, no face. |
| 14 | upscaled A frames not ready; B only to ~9.7 s | Gate G2 (§5.4): every used range re-checked at 100 % on `foot/up` before final render. |

**Grafts included** — TABLE: paper → real peel on a B 6.0 develop; Client A/B/Vous tags; violet tape on the real
cartons; polaroids snap into a row on « rangé » + EN SÉCURITÉ under it; paper client at the counter; ramp to a freeze
on « ici »; forbidden/avoid list; RMS waveform; stamps on paper, never mid-image. CARNET: stepper active tab shows the
step word; note-line rule; post-it « 1 conteneur » → « espace partagé »; footprints on « venir »; thread bow on the
Foyer Balengou tag; dive → peel; paper → photo flip; low-passed bed under quotes; kraftL quote captions; `after()` holds;
stamp budget.

---------------------------------------------------------------------------------------------------------------------

## 1. Art bible

### 1.1 Palette (kit `C` + 4 additions in `10_core.js`) and what each colour MEANS

| colour | hex | used for | never for |
|---|---|---|---|
| table | `#F2EADB` | the ground, always (`paperTable` + grain) | — |
| cream | `#FBF6EC` | every paper that carries text: labels, inserts, strips, scraps, captions | — |
| kraft / D / L | `#C79E6C` / `#9C7447` / `#E6C79C` | cartons, luggage-tag bodies, badge, Q-caption strip (L), roof | text background without a cream insert |
| ink / inkSoft | `#231629` / `#4A3A52` | all readable text, footprints, marker (neutral) | — |
| violet | `#A947FE` | the journey thread, **the hero's tape (and only the hero's)**, caption highlighter, active-tab border | readable text |
| violetD | `#7B22D6` | chapter numbers, checks, notes, **safety stamps** (EN SÉCURITÉ, EN TOUTE SÉCURITÉ), MERCI | large fills |
| amber | `#F3A745` / tape `rgba(243,167,69,.82)` | tape pieces, grommets, Client A tape | text |
| orange | `#FE560D` | push-pins, **action stamps** (EMBALLÉ, ARRIVÉ, DÉCHARGÉ), « ici ! », door circle, Client B tape, truck cab | more than one element per frame (stamps excepted) |
| sea | `#0B5FA5` + waves `#9CC3E6 #5E9ED6 #2F78BD` | sea paper, map sea | the container |
| **C.box** (new) | `#3E8FB0`, ribs **C.boxRib** `#2C6F8C` | the paper container + paper truck box: it **matches the real teal container** so paper → real reads as the same object; never lettering | — |
| **C.boxIn** (new) | `#5A3E24` | container interior (s5 flap) | — |
| **C.postit** (new) | `#FFE36E` | the one post-it (s2) | — |
| **C.halo** (new) | `rgba(251,246,236,.92)` | 6 px cream halo under marker strokes on prints | — |

Footage is always graded `warm` (`05_video.js` GRADES.warm). No duotone, no darkening, no glow, no scanline, no HUD
bracket, no dark plate: the v1 look is gone entirely.

### 1.2 Type scale (final px; readable text ≥ 44 px, on opaque paper)

| level | font | size | colour | where |
|---|---|---|---|---|
| chapter number | Big Shoulders Stencil 900 | **200** | violetD | chapter tags |
| title | Stencil 900, ls 3 | **100** (96 if > 720 px: « LE DÉCHARGEMENT ») | ink | chapter tags; « LE PARCOURS / DE VOS COLIS » 96; « EN RÉSUMÉ » 96; « 6 ÉTAPES » 110 |
| big word | Stencil 900 | 150 | violetD | « MERCI » |
| stamp | Stencil 900 + box + starve .45 + multiply | 96–110 | orange (action) / violetD (safety) | 5 stamps (§1.8) |
| map / place strip | Stencil 900 | 64–84 | ink on cream | « CHINE », « AFRIQUE », « FOYER BALENGOU » 84 |
| stepper | Stencil 900 | 50 (numbers) · 48 (active word) | ink / violetD | §1.4 |
| label / tag text | Bricolage Grotesque 800 | 46–56 | ink / inkSoft | tickets, tags, badge line 1, strips |
| marker note | Shantell Sans 800 | 56–96 | violetD (notes) · orange (« ici ! ») · ink (« VOUS ») | note line, label, post-it |
| label field name | Martian Mono 700 | 44 | inkSoft | « DE : » « À : » on the hero label |
| brand | DM Sans 900 | 96–104 | ink | « BONZINI » |
| CJK | `FF.cjk` | 44 | inkSoft | « 中国 » (s1) |
| caption | Bricolage 800 | 60 | ink, highlighter violet 30 % | unchanged |

French typography: typographic apostrophe **’** in every string (« L’ACHAT », « L’équipe Bonzini »), narrow no-break
space U+202F before « ! » (« ici ! »), accents on capitals (« ÉTAPE », « À », « DÉCHARGÉ »).

### 1.3 Recurring props (one look each; owner of the drawing function in brackets)

**Hero carton** `hp_carton(o)` [A, `11_hero.js`]
- `carton(560, 420, {tape:false, seed:7})`, top view. **Violet tape** strip, vertical, at local x −190, 64 wide
  (`C.violet` α .85 + a 5 px white sheen). Knot (thread attach point) = top end of the tape, local (−190, −214).
- **Label** `hp_label(o)` cream 360×250, r 10, at local (+60, +5), rot −0.035:
  violetD band 62 high with `drawLogo` 40 at left + « VOTRE COLIS » (Stencil 900 48, cream, ls 4);
  row 1 « DE : » (Mono 44 inkSoft) + value **« CHINE »** stamped (Stencil 900 72 orange, starve; `chineK`);
  row 2 « À : » + value **« VOUS »** hand-written (Shantell 800 72 ink; `vousK` = write-on).
  Readable only at s ≥ 0.9 (hook, recap end). At s ≤ 0.6 it is texture.
- **Flaps** (`flaps` 0 closed → 1 open): 4 kraft trapezoids hinged on the four edges, folded outward, interior
  `C.kraftD`; opening/closing stepped on twos (3 poses).
- **Moods** (one per beat, word-anchored, on twos except `breathe`): `land` (drop from s×1.25, squash ≤ 6 %, shadow
  40 → 6), `hop` (anticipation 0.95 → lift 1.10, shadow 34, land), `peek(dir)` (slide 26 px + rot ±0.10 toward a
  target, settle 0.4 s), `shiver` (±4 px jit, 8 frames), `nod` (two squashes 0.97, 4 frames each), `breathe`
  (always: s 1 ± 0.006 + `drift(t, 7, 3)`). No mood on a beat that already has a stamp or a slap on the hero.

**Mini label** `hp_labelMini(o)` [A] — PORTRAIT 150×280 cream, 4 px kraft rim: violetD band 54 high with `drawLogo` 34;
« VOTRE » / « COLIS » stacked, Stencil 900 50 ink (55 px at s 1.1). Used on: the s2 container lid (s .55, texture),
the s3 boat container (s .3), the paper truck box (s .7), the **real container** in s4 (s 1.1, covers the ghost), the
container sticker in s5.

**Client cartons** `hp_clientCarton(w, h, tapeCol, seed)` [B] — `carton(180, 135)` top view; amber tape = Client A,
orange tape = Client B. Never violet.

**Paper container** `hp_paperContainer(view, o)` [B]
- `'top'` 820×340: walls 16 px `C.box`, vertical ribs `C.boxRib` every 22 px on the long walls, floor `C.kraftL`,
  door end on the RIGHT (two 10 px leaves + 2 ink lock bars), `lid` 0..1 slides on from the right (ribbed `C.box`).
- `'side'` 300×128: `C.box` face, ribs, darker top rail, door end right with 2 lock bars, mini label s .3 near the door.
- Never any lettering, number or logo.

**Paper truck** `hp_paperTruck(t, o)` [B] — `truck(t, {box: C.box, cab: C.orange})` + ribs on the box + mini label
s .7 at local (−80, −175); wheels spin on twos. Origin = ground centre.

**Chapter tag** `HP_TAGS` + scene `chapterTags` [E, `12_stepper.js`] — kraft luggage tag 820×500 (TEX.kraft), two
clipped left corners, amber grommet r 22 at local (−370, 0) with a table-coloured hole r 10; cream insert 760×440 inset
18. « ÉTAPE » (Bricolage 800 46 inkSoft, ls 8) at (−300, −170) left; number (Stencil 200 violetD) centred baseline +40;
title (Stencil 100 ink) centred baseline +195. String (violet `thread`) from the grommet to the hero knot / anchor.
In: swings from off-frame top-right like a pendulum, angle −0.6 → 0 `spring(t−t0, 9, .35)` stepped on twos, then a
`drop()` slap (`paper_slap`). Out: `string_pluck`, 0.5 s `eInOutCubic` arc to the active stepper tab, scale to its size,
crossfade in the last 3 frames; the tab swings on arrival.

**Brand tag** `hp_brandTag(x, y, s, r, k, o)` [E] — cream body 760×380 (brand) / 800×400 (outro), 6 px kraft rim,
amber grommet left; `drawLogo` 170 at local (−250, −10) (pieces `logoK` fly in from 4 sides); « BONZINI » DM Sans
900 96–104 ink, left edge local −140, baseline +10; « TRADING CARGO » Stencil 900 46–50 violetD ls 8, baseline +70;
optional footer (outro) « Entrepôt · Foyer Balengou » Bricolage 800 44 inkSoft + orange pin glyph, baseline +140.

**MERCI tag** `hp_merciTag(...)` [E] — cream luggage tag 600×250: « MERCI » Stencil 900 150 violetD + « pour votre
confiance » Bricolage 800 48 ink, centred.

**Note-line items** [core `10_core.js`] — see §1.8. Scrap = torn cream paper (no tape, a small amber tape at top-left),
Shantell write-on with the pen (`marker()`) visible; tag = kraft luggage tag with cream insert and an orange push-pin at
its grommet; stamp; hand check (violetD, w 9, 90 px).

**Post-it** (s2 only) — `postIt(320)` in `C.postit`, rot −0.03.

**Place tag** (s6) — kraft body 660×190, cream insert, orange pin glyph left, « FOYER BALENGOU » (Stencil 900 84 ink)
over « Point de retrait » (Bricolage 800 46 inkSoft); amber grommet at its RIGHT end (for the thread bow).

**Footprints** `hp_footprints(path, k)` [B] — ink (α .8) shoe soles 40×84 (rounded sole + heel), alternating
±18 px lateral, rotated along the path, appearing one per 0.1 s on twos.

**Paper client** [D] — `person({outfit: C.orange, wax: true, waxCols: [C.orange, C.violetD, C.amber], face: 'smile',
arms})` at scale 0.5, bust only (always behind the counter). It is a paper character, never a real person.

**Bonzini counter** `hp_counter(w)` [B] — w 560, body 220 tall cream `#F4EBDD`, top rail kraftD 24, violet band 40
at mid-height with a cream disc r 44 holding `drawLogo` 64. No text.

**Paper warehouse** `hp_roofFold(k, w)` [B] — kraft gable roof 720 wide (corrugation lines) + two kraft side walls
that fold up (pop-up hinge, 4 poses); a cream disc r 70 with `drawLogo` 100 goes on the gable.

**Kit props reused as is**: `stall` (s1), `shoeBox` goods, `paperBoat` + `paperWaves` (s3), `BZ_MAP` (s3 + s1 China),
`strip` (torn headers), `pushPin`, `confetti`, `thread`, `ticket` (recap), `stampText`, `handText/handArrow/handCircle`.

**Kraft flakes** `hp_flakes(t, t0, x, y, n)` [B] — 8–18 px kraft quads, rotated, stepped on twos, gravity + fade 0.5 s.

### 1.4 The stepper [E, `12_stepper.js`, scene z 75, screen space]
- **Thread**: violet `thread()` w 7 from (60, 176) to (1020, 176), sag `y = 176 + 14·sin(π(x−60)/960)`.
- **Tabs** hang from it on 16 px strings, centred as a group on x 540, gap 12 px (accordion layout, recomputed when the
  active index changes, widths animated 0.4 s `eInOutCubic`, only while a chapter tag is landing).
  - inactive (future / done): kraft luggage tag 100×92 (clipped top corners, amber grommet r 9 at top centre), number
    « 01 »…« 06 » Stencil 900 50, body y ≈ 200–292.
    future = kraft ghost α .45, number inkSoft α .4; done = cream face, number violetD + violetD check (w 8) written
    over the right half in 0.25 s (`marker_squeak`) near the chapter end.
  - **active**: cream face, 4 px violet border, height 104 (y ≈ 196–300), width = 40 + measure(« 0N ») + 14 +
    measure(WORD) + 28, content « 03 » violetD + « TRANSPORT » ink, Stencil 900 48. Sway ±0.03 rad, period 1.4 s
    (never more: it carries text). Words: **ACHAT · GROUPAGE · TRANSPORT · ARRIVÉE · DÉCHARGEMENT · RETRAIT**.
    Total width must stay ≤ 960 (x 60–1020); if not, the active font drops to 44.
- **Modes** (`hp_stepMode(t)`): `hidden` (0 → V01·étape) · `birth` (hook: thread shoots, tabs clack on) · `ghost`
  (brand, α .55, all future) · `live` (s1 → s6) · `unhook` (recap entry) · `gone`.
- The stepper is chrome: it does not count as a text block.

### 1.5 Caption band [`90_captions.js`, z 90]
- Unchanged geometry: torn cream strip centred y 1340, Bricolage 800 60, violet highlighter on the spoken word.
  **Every scene keeps y 1250–1430 free.**
- Edit [D]: pages whose segment id starts with `Q` use a **kraftL `#E6C79C` strip**, the text wrapped in « … », and a
  30 px ink mic glyph at the strip's left end. That says « the real team speaking » without another label.
- `captionHide` only from `V11·end` to the end (the end card carries the words).

### 1.6 Team-voice badge [D, `14_badge.js`, scene z 65] — replaces `teamBadge`
- Kraft card, auto width ≈ 650 × 120, r 18, lift 10, rot −0.03, orange `pushPin` at its left end (x −w/2 + 30).
- Ink mic disc r 40 (cream glyph); « L’équipe Bonzini » Bricolage 800 **46** ink; « sur place » Shantell 700 **44**
  violetD; 6 waveform bars (8 px wide, 13 px pitch, max height 60, `C.violet`) driven by **`Q_RMS[q][frame]`** (real RMS
  of the Q audio, 30 Hz, from `15_qrms.js`), stepped on twos; flat (0.18) between quotes.
- Position: (380, 380) in s4–s6 (spans x 55–705, y 320–440, overlapping the hero print's top-left corner, paper over
  photo); (380, 270) in the outro (stepper gone).
- Life cycle (automatic from TL): pops (`pop`, `pin_click` + `mic_tap`) **0.3 s before each Q**; stays across gaps
  < 1.0 s (Q1→Q2, Q3→Q4); leaves 0.3 s after the Q end (lift + slide up 40 px, 0.25 s). Exception: Q6 pops at the
  end of the T9 whip (`hp_badgeEarliest('Q6', whipEnd)`, set by E). The badge is one of the two text blocks while
  visible. It never shares a frame with a chapter tag.

### 1.7 Video prints (all via `videoPrint` / `hp_printAt`)

| format | picture | centre / rot | spans (picture) | use |
|---|---|---|---|---|
| **hero print** `HP_PRINT` | 600×800 (3:4) | (540, 740), −0.02 | x 240–840, y 340–1140 (border to 1158) | s3 end, s4, s5 Q3/Q4, s6 Q5 |
| outro hero `HP_PRINT_OUTRO` | 600×800 | (540, 700), −0.02 | y 300–1100 | outro Q6 |
| teaser | 300×400 / 320×427 | fan (hook) | — | hook |
| polaroid | 280×373 + 16 border + 70 caption band | (200 / 540 / 880, 600) | paper y ≈ 397–873, caption baseline ≈ 852 | s5 V08 |

- **Look**: border 18 px `#FBFAF6`, contact shadow lift 12, two amber tape pieces at the top corners (116×38, rot ±0.55),
  gloss on, curl 0.3, warm grade. Max picture width at rest **600 px**; anything larger only during the s4 dive.
- **Playback on twos**: `vid()` only has even source frames. Source time = `vidT`/`hp_map` of `stepT(n)`.
  Below 0.6× use **`vidBlend`** (crossfade of the two neighbouring even frames) so slow motion is smooth, never a slideshow.
- **Frame references**: always `(clip, source seconds)` on the prepared frames `foot/up/<clip>/NNNNN.jpg`
  (renderer falls back to `foot/lo` while the upscale runs). Never the raw clips.
- **Framing** `fr = {fx, fy, zoom}` passed to `vidCover`. Frame-normalised points (nx, ny ∈ 0..1 of the 1080×1920 frame)
  are mapped into a print with `hp_frameToPrint(nx, ny, rect, fr)`.
- **Never static**: every print gets `drift(t, seed, 3)`; a frozen print keeps Ken Burns (1 → 1.05) and drift.
- **FX vocabulary** (helpers in `13_prints.js` [C] unless noted):
  - *deal in*: slide from a side + rot settle `spring` over 0.35 s (`card_deal`), tape press 2 frames after landing.
  - *card swap*: outgoing slides out right +0.15 rot while the new one is dealt from the left (0.35–0.4 s, `paper_slide`).
  - *develop*: cream fog → image (videoPrint `develop`), 0.6–0.9 s; slow develops allowed (s3: 0 → .3 over 3 s).
  - *flash*: white 0.12 s or 2–3 frames (`shutter_click`). *light leak*: `lightLeak(p, seed)` 0.6 s.
  - *freeze*: source time held; border stays; KB + drift continue.
  - *speed ramp*: `hp_map` piecewise source time; ramps take 0.2 s (`tape_stop` subtle).
  - *cut-out sticker*: white rim 10 px revealed by an angular clip 0 → 2π in 0.35–0.4 s (`scissors_snip` ×2), then
    lift 0 → 24–30, scale 1.05 (`sticker_peel`). Shapes are **scissor quads/polygons** in frame-normalised coords
    (hand-cut look, robust); the colour key `vidCutout` is optional and must be clipped to the quad.
  - *push-in / dive*: `hp_pushRect` scales the print rect about a focus point and brings it to screen centre; border and
    tape fly past the edges; the footage always renders inside the current rect (native 1080×1920 frame at full size).
  - *peel*: `hp_peel` corner peel of a full-screen layer (§2.3).

### 1.8 Marker, note line, stamps, blocks, holds
- **Marker** strokes (`hp_circle`, `hp_arrow`, checks): violetD w 8 (orange only for the s4 « ici » arrow and the s6 door
  circle). On a print they get a **6 px cream halo** (`hp_halo`). Pen visible while writing (`marker_squeak/_write`).
- **Note line** (CARNET rule) for every footage page: slot `NOTE` centred (540, 1170), max 640 wide (x 220–860),
  y 1100–1240, overlapping the print's bottom edge (paper on photo). **Exactly one item at a time** (scrap, tag, stamp
  or check). The previous item physically leaves (fades 0.2 s, unpinned, or slides out with its print) before the next.
  **Words are never written on footage.**
- **Stamps — budget 5** (each a different word, never two within 4 s; orange = action, violetD = safety):

  | stamp | where | anchor [s] | colour |
  |---|---|---|---|
  | EMBALLÉ | s1, half on the lid | V03·emballées + 0.45 [21.11] | orange |
  | ARRIVÉ | s4, NOTE | V06·entrepôt [48.94] | orange |
  | DÉCHARGÉ | s5, NOTE | Q4·déchargés [80.00] | orange |
  | EN SÉCURITÉ | s5, under the polaroid row | V08·sécurité [86.11] | violetD |
  | EN TOUTE SÉCURITÉ (2 lines) | recap, on the hero carton | V10·sécurité [115.66] | violetD |

  `stampText` with box + starve + multiply, `slam(t, t0)` + `addShake(t0, 10–14)`, `stamp_thunk`. The hook's « CHINE »
  is the label's own field ink (part of the label, shake 6, not counted).
- **Blocks**: ≤ 2 readable text blocks + caption on every frame (stepper excluded; hero label counts only at s ≥ 0.9).
  Audited per beat below.
- **Holds**: every readable text stays ≥ 2.1 s: replacement times use `after(prevIn, word)`. `hp_hold(name, in, out)`
  warns in dev when < 2.0 s on the real timeline.

### 1.9 Motion grammar
- Hand-placed things (paper, tags, goods, stamps, stickers, footprints, logo pieces): stop-motion on twos (`stepT`,
  `jit`) with `drop`/`slam`/`pop` physics. No jit on text-bearing paper once it has landed (≤ 3 px drift only).
- Camera-like moves (follow-drop, pull-back, push-in, dive, whip, pull-out): smooth `eInOutCubic`/`eOutExpo`, final
  render with `--mb 3`.
- Nothing static > 1.5 s: hero breathes, prints play or drift, threads boil on twos, active tab sways.
- Lift heights (`withShadow`): table-flat 2 · tags 6 · cards / notes 10 · prints 12 · lifted stickers 24–30 · in flight 40.

### 1.10 Sound grammar
- Music: the series bed (`lib/music.py`), 120 BPM (beat 0.5 s, bar 2 s), chapter starts on the grid.
- Mix: voice first. Bed −16 dB under V; under **Q1–Q6 add a 1.2 kHz low-pass and −6 dB more, percussion only** so the
  field recording breathes and reads « on site ». Stamps above the bed.
- SFX dry, close, paper: ≤ 2 SFX per 0.3 s, stamps win. Every SFX is logged in code with `hp_sfx(name, t0)` →
  `window._cues` → `render.mjs --dump-cues` (lead adds the flag) → the mixer places them.

---------------------------------------------------------------------------------------------------------------------

## 2. Stage model (no world camera)

### 2.1 Screen-space stages
There is **no continuous world**. The table is always the full screen; each chapter is a *stage* drawn in screen
coordinates by its package. Camera-like motion is simulated per layer:
- **follow-drop** offsets the outgoing and incoming chapter layers vertically (§2.3 T3/T7);
- **local pull-back** inside a stage: a scale about a point (s3 boat → map);
- **print push / dive**: the print rect is interpolated (`hp_pushRect`);
- **whip / pull-out**: E/D translate their own layers.
Screen chrome never moves with them: stepper (z 75), badge (z 65), captions (z 90).

### 2.2 Layers (z) — every chapter file registers two scenes: `<key>_back` (z 20) and `<key>_front` (z 50)

| z | layer | owner |
|---|---|---|
| 0 | `paperTable` | engine |
| 20 | chapter back: dioramas, props, prints | each package |
| 38 | lead thread (active tab grommet → hero knot / anchor) | A |
| 40 | hero carton | A |
| 50 | chapter front: stamps, note-line items, marker, polaroid captions, things above the hero | each package |
| 60 | chapter tags (E), brand tag (A calls `hp_brandTag`), MERCI tag (E) | E / A |
| 65 | team badge | D |
| 72 | s4 dive + peel overlay | C |
| 75 | stepper | E |
| 90 | captions | engine (style edit D) |

### 2.3 Transitions catalogue (formulas; times = boundary `tb = TL.ch(next).start`)

| id | boundary | owner | spec |
|---|---|---|---|
| T1 | hook → brand [7.5] | A | Continuous. Nothing cuts; the hero stays; stepper → ghost. |
| T2 | brand → s1 [13.92–14.45] | A | **The box opens** (forward action, not a rewind): brand tag flips (scaleY 1→0) and flies up; title strip slides up and out; the hero's violet tape snaps (`tape_rip`), 4 flaps spring open (3 poses), the label peels off (`sticker_peel`) and flutters to (150, 1170) s .45 rot −0.12, where it hovers until s1. Start = `after(V02·Trading, 13.6)`. |
| T3 | s1 → s2 [23.15–23.85] | B | **Follow-drop** (`hp_followY`): window `[tb−.35, tb+.35]`, `k = eInOutCubic`; outgoing layers `dy = −1920·k`, incoming `dy = 1920·(1−k)`; hero stays near screen centre (`y = lerp(yOut, yIn, k)`), tilt `+0.08·sin(πk)`, `sy 1.04`, 6 kraft flakes trail, the lead thread trails up. Preceded by `hp_hop(tb − 0.45)`. SFX `whoosh_soft` + `cardboard_thud` on landing; music small riser. |
| T4 | s2 → s3 [33.1–33.9] | C (B hands over) | **The sea rises**: 4 torn wave layers rise from the bottom (stepped, to `y0 1090`) in 0.6 s from tb − 0.4. B lifts the closed container (lift 60) and shrinks it to s .3 by tb + 0.1, then stops drawing at tb + 0.1; C takes the container from pose (540, 760, s .3, top view), paper-flips it to side view (scaleY 1→0→1, 3 poses) and drops it on the deck of the boat sliding in from the right (tb−0.2 → tb+0.4). |
| T5 | s3 → s4 [44.5] | C | **Continuous**: the paper truck sits on the slowly developing blank print. |
| T6 | s4 → s5 [63.94–65.24] | C (D draws beneath) | **Dive → peel**: `hp_pushRect` toward the doorway, z 1 → 3.0, 0.6 s `eInCubic`; the doorway fills the screen ≤ 0.3 s; then `hp_peel` peels the full-screen image from the bottom-right corner in 0.7 s, revealing s5's table (D draws from `TL.ch('s5').start − 1.0`). Peel algorithm: corner C = (1080, 1920) travels to P(k) = lerp(C, (−240, −320), eInOutCubic(k)) with an extra lift `−220·sin(πk)` in y; fold line = perpendicular bisector of C→P; draw (1) the front image clipped to the spine side of the fold, (2) the flap = the rest reflected across the fold, filled **bare paper back** `#F4EEDC` with a gradient to `rgba(60,32,12,.18)` at the fold (nothing mirrored), (3) a 24 px soft shadow on the revealed table along the fold. Fallback if it misbehaves: the image slides up off-frame with a curl shadow. SFX `whoosh_whip` → `paper_peel` → room-tone change. |
| T7 | s5 → s6 [88.65–89.35] | D | Follow-drop (same helper as T3). |
| T8 | s6 → recap [105.6–106.3] | D + E | **Pull-out + unhook**: D scales its s6 layers to .6 about (0, 960) and slides them −900 px in x (0.6 s `eInOutCubic`, `whoosh_soft`); E unhooks the stepper (thread lets go at its right end; tabs fall on twos into the recap slots). |
| T9 | recap → outro [`after(V10·sécurité, 117.3)` = 117.76 → 118.16] | E | **Whip**: recap layers `dy = −1920·eInCubic(k)`, outro layers `dy = 1920·(1−eOutCubic(k))`, 0.4 s, `--mb 3`, `whoosh_whip`; the outro print is dealt in from the top during the whip. |

### 2.4 Hero track (pose keys registered by each package with `hp_keys(ch, …)`)

| ch | anchor | pose (x, y, s, r) / state |
|---|---|---|
| hook | frame 0 → 0.30 | (540, 1000) s 2.4 → 1.0, r −0.12 → −0.02 (slam); closed, label blank |
| hook | V01·Chine / V01·vous#1 | `chineK` 0→1 (stamp) / `vousK` 0→1 (write 0.35 s) + hop |
| brand | V02·Suivez [8.30] | → (540, 1135) s .5 (0.6 s) |
| brand→s1 | T2 [13.92] | flaps 0 → 1, tape cut, label → (150, 1170) s .45 hover |
| s1 | 14.45 | (540, 1080) s .55, `land`, open & empty |
| s1 | V03·fournisseurs [18.88] | hop onto the stall counter (540, 905) s .55 |
| s1 | V03·emballées [20.66] | flaps 1 → 0, violet tape re-applied (0.3 s) |
| s1 | V03·pour [21.84] | label slaps back on the lid |
| s2 | T3 land [23.85] | (540, 1080) s .42 |
| s2 | V04·réunis + 0.52 [28.72] | hop into the container → (800, 820) s .42; hidden under the lid from 32.8 (`inside`) |
| s3–s4 | — | hidden; lead thread anchor = container / truck / real container / sticker / door (§2.5) |
| s5 | V07·vos [69.78] | tumbles out last → (540, 1100) s .45, `land` |
| s5 | V07·rangés [70.70] | front of the stack (540, 1080) |
| s5 | V07·end + 0.05 [72.75] | hop out → (850, 1150) s .4; peeks during Q3/Q4 |
| s6 | T7 land [89.35] | on the counter (540, 945) s .5 |
| s6 | V09·colis [95.10] | picked up: `visible:false`, D draws it in the client's hands until the counter leaves (97.2) |
| recap | 106.5 | `land` at (190, 1130) s .45 |
| recap | `after(V10·retrait, V10·arrivent)` [114.90] | → (540, 860) s 1.0, `land` (label readable) |
| outro | whip end [118.16] | (800, 1150) s .55, peek toward the print |
| outro | V11·Bonzini [123.11] | → (540, 1110) s .6 |

### 2.5 Lead thread (violet journey thread, A draws, z 38, α .8, w 6)
From the active (or first, in hook/brand) stepper tab grommet `hp_tabGrommet(i, t)` down to `hp_knot(t)`, or to the
chapter's `hp_anchor(ch, fn)` when the hero is hidden:
hook from V01·étape (it is the thread that shoots up) · brand · s1 · s2 until the lid (then → mini label on the lid) ·
s3 → container on boat / truck token / paper truck box · s4 → truck box, then real container in P4
(`hp_frameToPrint(.5, .38)`), then the mini label on P4b, the lifted sticker, the door; hidden from the dive ·
s5 → container sticker, then hero from 69.78 · s6 → hero until 95.10, hidden after (the bow thread in s6 is D's) ·
recap: replaced by E's laced thread · outro: hero knot → MERCI tag → brand tag (taut at 127.0).

---------------------------------------------------------------------------------------------------------------------

## 3. Chapters

Columns: **#** · **anchor [s]** · **what happens** (positions, sizes, motion, exact strings, footage) · **SFX / music** ·
**blocks** (readable text blocks besides caption & stepper).

### HOOK · 0 → 7.5 · V01 « Vous achetez vos marchandises en Chine ? Découvrez comment elles arrivent jusqu’à vous, étape par étape. » — A, `20_hook.js` (`hk_`)
One idea: **this carton is yours, and we will follow it.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| H1 | frame 0 → 0.30 | Cold open: hero carton falls from above the lens: (540, 1000) s 2.4 → 1.0 (`eInCubic`), r −0.12 → −0.02, motion-blurred. Frame 0 shows the label band **« VOTRE COLIS »** large and readable (thumbnail); fields blank. Lands at 0.30: squash 2 frames, shadow 60 → 6, `hp_flakes` ×6, `addShake(.30, 12)`. | `cardboard_thud` heavy + `paper_rustle`; music downbeat (kick + bass) | 1 (label) |
| H2 | V01·achetez [1.12] → marchandises [1.64] | `shiver`: the goods settle inside. | `rattle_goods` soft | 1 |
| H3 | V01·Chine [2.46] | Label field DE stamped **« CHINE »** (Stencil 72 orange, starve, slam from 1.6), shake 6. | `stamp_thunk` light | 1 |
| H4 | V01·Découvrez [3.78] → arrivent [4.60] | Three teaser prints dealt out *from under the carton*, fanning up, 0.12 s apart on twos, each develops in 0.4 s; one `lightLeak(p, 3)` across the fan at +0.17. **P1** 300×400 at (250, 560) r −0.14: **B 4.4 →** @0.7, fr {fy .62}. **P2** 320×427 at (540, 470) r +0.02: **A 23.4 →** @0.7, fr {fy .55}. **P3** 300×400 at (830, 560) r +0.13: **B 11.0 →** @0.7, fr {zoom 1.2, fx .4}. No text on them. | `card_deal` ×3, `instant_eject` | 1 |
| H5 | V01·jusqu’à [4.96] | Prints flick out upward and off (0.3 s, rot ±0.4). | `whoosh_whip` | 1 |
| H6 | V01·vous#1 [5.28] | Marker writes **« VOUS »** in the À field (Shantell 72 ink, 0.35 s, pen visible); `hop` (peak s 1.06). | `marker_write` | 1 |
| H7 | V01·étape#0 [5.48] | A violet thread shoots from the hero knot up to (60, 176), then snaps taut across to (1020, 176) in 0.25 s (stepper `birth`); six ghost tabs clack on at 5.48 + i·0.15 (last 6.23), each with a small swing. | `string_pluck`, `clack_wood` ×6 rising; 16th-note ratchet fill into the bar | 1 |
| H8 | 6.3 → 7.5 | Hold: hero breathes, tabs settle. | — | 1 |

Out: **T1** (continuous). Footage: three teaser ranges (§4). Strings: « VOTRE COLIS », « DE : », « CHINE », « À : », « VOUS ».

### BRAND · 7.5 → 14.0 · V02 « Suivez avec nous le parcours de vos colis, avec Bonzini Trading Cargo. » — A, `22_brand.js` (`br_`)
One idea: **Bonzini Trading Cargo walks you along that thread.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| B1 | 7.5 | Stepper → `ghost` (α .55). | groove fully in | 0 |
| B2 | V02·Suivez [8.30] | Hero slides to (540, 1135) s .5 (0.6 s); lead thread re-routes. Label → texture. | `paper_slide` soft | 0 |
| B3 | V02·parcours [9.70] | **Title strip** slapped at (540, 450): torn cream, two lines **« LE PARCOURS »** / **« DE VOS COLIS »** (Stencil 96 ink, ls 3, line pitch 104; spans ≈ y 320–580), two amber tape corners, rot −0.02. Same word: `hp_pluck` ripple runs from the hero up the lead thread and along the stepper; tabs jiggle in a wave. | `paper_slap`, `string_pluck` (pitched); hi-hat lift | 1 |
| B4 | V02·colis [10.42] | Hero `nod`. | — | 1 |
| B5 | V02·Bonzini [11.20] | **Brand tag** 760×380 swings in on the thread to (540, 830) (y 640–1020); the four `drawLogo` pieces (amber, orange, wingTop, wingBot) fly in from 4 directions on twos (11.20 → 11.64) and lock as logo 170. | `paper_slap` ×4; brand stab | 2 |
| B6 | V02·Trading [11.82] | Wordmark stamped on: **« BONZINI »** DM Sans 900 96 ink, **« TRADING CARGO »** Stencil 46 violetD ls 8. | `stamp_thunk` light | 2 |
| B7 | → after(V02·Trading, 13.6) [13.92] | Hold (tag 2.1 s, title 4.2 s); everything drifts. | — | 2 |
| B8 | [13.92 → 14.45] | **T2 the box opens** (§2.3). | `tape_rip`, `flap_fold`, `sticker_peel`; 2-beat dip | 0 |

### S1 · 01 L’ACHAT · 14.0 → 23.5 · V03 « Étape un : l’achat. Tout commence en Chine, chez vos fournisseurs. Vos marchandises sont emballées et préparées pour le voyage. » — B, `30_s1.js` (`s1_`)
One idea: **in China, at the supplier's, your goods go into the carton.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 1.1 | 14.45 | Open, empty hero settles at (540, 1080) s .55 (`land`); its label hovers at (150, 1170). | `cardboard_thud` light | 0 |
| 1.2 | V03·Étape [15.60] | Chapter tag **« ÉTAPE · 01 · L’ACHAT »** at (540, 600) (E). Out = after(in, V03·Chine) [17.98]. | `paper_slap` + kick | 1 |
| 1.3 | V03·Chine [17.98] | Tag flies to slot 1. **China cut-out** drops at (600, 540): `BZ_MAP.china`, kraft + violetD 6 px outline, ≈ 520 wide; orange push-pin on it (no city). Torn strip **« CHINE »** (Stencil 80) with **« 中国 »** (CJK 44 inkSoft) under it, at (330, 395) r −0.05. | `paper_slap`, `pin_click` | 1 |
| 1.4 | V03·fournisseurs [18.88] | China slides to (210, 470) s .42. **Stall pops up** (hinge, 4 poses on twos, 0.4 s): `stall(860, {sign:'FOURNISSEUR', stripe:C.orange})` at s .75, origin (540, 1000) → sign y 458–537 (46 px), awning 550–662, shelf ≈ 812, counter 1000–1225. Hero hops onto the counter (540, 905). | `popup_fold`, `paper_rustle` | 2 (CHINE + sign) |
| 1.5 | V03·marchandises [19.80] | Four goods (3 `shoeBox` + 1 paper fabric bolt) hop from the shelf into the open carton, 0.2 s apart on twos, each landing dips the carton. | `thup` ×4; marimba off-beats | 2 |
| 1.6 | V03·emballées [20.66] | CHINE strip leaves (at −0.1). Flaps fold (4 × 3 frames), violet tape pulls across (0.3 s); **stamp EMBALLÉ** (Stencil 110 orange, box, rot −0.10) at (640, 880), half on the lid, at +0.45 [21.11]. Hold → T3. | `flap_fold`, `tape_rip`, `stamp_thunk` + snare | 2 (sign + stamp) |
| 1.7 | V03·pour [21.84] | The label flutters back and slaps on the lid (CHINE / VOUS already filled). | `sticker_slap` | 2 |
| 1.8 | V03·voyage [22.06] | Knot cinch on the lead thread (4 frames); hero turns r −0.06 « ready ». | `knot_tie` | 2 |
| 1.9 | s2.start − 0.7 [22.8] | Slot 1 check (E). | `marker_squeak` | 2 |

Out: **T3 follow-drop** [23.15–23.85] (hop at 23.05).

### S2 · 02 LE GROUPAGE · 23.5 → 33.5 · V04 « Étape deux : le groupage. Les colis de plusieurs clients sont réunis dans un même conteneur. Chacun profite ainsi de l’espace partagé. » — B, `32_s2.js` (`s2_`)
One idea: **several clients' parcels share ONE container — yours is in it.** Paper only (no footage: we are still in China).

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 2.1 | 23.85 | Hero lands (540, 1080) s .42. | `cardboard_thud` | 0 |
| 2.2 | V04·Étape [25.10] | Tag **« ÉTAPE · 02 · LE GROUPAGE »** at (540, 600). Out = after(in, V04·colis) [27.20]. | `paper_slap` | 1 |
| 2.3 | tag out [27.20] | Paper container (top view, open) slides in from the right to (540, 820) (x 130–950, y 650–990), 0.4 s. | `paper_slide` | 0 |
| 2.4 | V04·plusieurs [27.32] → clients [27.58] | Client groups slide in on twos and bump the hero (`peek`): **A** = 2 amber-tape cartons at (190, 1060)/(300, 1110); **B** = 2 orange-tape cartons at (780, 1060)/(890, 1110). Kraft mini-tags on short strings under each group (cream ticket 230×70, Bricolage 800 46): **« Client A »** (245, 1205), **« Vous »** (violetD) (540, 1205), **« Client B »** (835, 1205). | `cardboard_bump` ×3 | 1 (tag group) |
| 2.5 | V04·réunis [28.20] | The 5 cartons hop into the container one per 0.13 s (A1, A2, B1, B2, **hero last** with a bigger `hop`): A column x 260 (y 760 / 880), B column x 540 (760 / 880), hero (800, 820). The tags ride along and dangle from the front lip at y 1060: « Client A » (260), « Client B » (540), « Vous » (800). | `thup` ×5 on 16ths | 1 |
| 2.6 | V04·même [28.90] | **Post-it** 320×320 slaps at (540, 470) r −0.03; marker writes **« 1 »** (Shantell 110 violetD) / **« conteneur »** (Shantell 56 ink), 0.4 s. | `sticker_slap` light, `marker_write` | 2 |
| 2.7 | V04·Chacun [29.84] | Highlighter zones sweep over each column inside the container: amber α .45 (A), orange α .35 (B), violet α .35 (hero), 4 poses each, stagger 0.15 s. | soft felt swipes ×3 | 2 |
| 2.8 | V04·partagé [31.60] | Post-it flips (scaleX 1→0→1, 0.3 s, on twos) to **« espace »** / **« partagé »** (Shantell 60 ink). Hold → after(31.60, 33.7). | `card_flip` | 2 |
| 2.9 | V04·end + 0.06 [32.40] | Ribbed blue lid slides on from the right (0.4 s); [32.85] mini label (s .55, texture) slaps on the lid's right end. | `lid_scrape`, `sticker_slap` | 2 |
| 2.10 | 33.0 | Slot 2 check. | `marker_squeak` | 2 |

Out: **T4 the sea rises** (C). Post-it slides out up-left at 33.7.

### S3 · 03 LE TRANSPORT · 33.5 → 44.5 · V05 « Étape trois : le transport. Le conteneur traverse l’océan par bateau, de la Chine jusqu’en Afrique. Puis il continue sa route par camion, jusqu’à notre entrepôt. » — C, `34_s3.js` (`s3_`)
One idea: **by sea from China to Africa, then by road to our warehouse.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 3.0 | T4 [33.1–33.9] | Waves rise, container flips to side view and drops on the deck of `paperBoat(1)` s 2.2 centred (560, 1060) (sail top ≈ 686, hull ≈ 1038–1214). | `waves_paper` swell, `whoosh_soft`; groove opens into a pad | 1 (post-it, until 33.7) |
| 3.1 | 33.9 | Boat rocks on twos (±0.03 rad, ±6 px); our side-view container (C.box, mini label s .3) among the paper cargo. | `waves_paper` low loop | 0 |
| 3.2 | V05·Étape [35.10] | Tag **« ÉTAPE · 03 · LE TRANSPORT »** at (540, 560) (over the sail). Out = after(in, V05·conteneur) [37.20]. | `paper_slap` | 1 |
| 3.3 | tag out [37.20] | **Pull-back** (0.7 s `eInOutCubic`): the boat stage scales 1 → .35 about the boat and moves onto the China start of the route while the **paper map** slides in beneath: torn sea-blue sheet `#9CC3E6`, x 40–1040, y 330–1180, r −0.01; land `C.kraftL` (`BZ_MAP.land`), China kraft + violetD outline, route dotted inkSoft (`BZ_MAP.route`, China → round the Cape → Gulf of Guinea). Mercator frame ≈ lon −20…125, lat −40…42 (C fits it). No city, port, border or capital. | `paper_slide` | 1 |
| 3.4 | V05·traverse [37.26] | Strip **« CHINE »** (Stencil 64 on cream) at (840, 430). Hold → tear. | `paper_slap` light | 1 |
| 3.5 | V05·bateau [38.10] → Afrique + 0.3 [39.78] | Boat token sails the route (`eInOutCubic`), bobbing on twos; **the violet thread draws behind it** (`thread(routePts, p)`). | `horn_toy` one short on « bateau » | 1 |
| 3.6 | V05·Afrique [39.48] | Orange push-pin pops at the Gulf of Guinea arrival; strip **« AFRIQUE »** (Stencil 64) at (330, 720) inside the continent. | `pin_click` | 2 |
| 3.7 | V05·Puis [40.02] / route [41.12] | The container hops from the boat token onto a tiny truck token at the pin (3 poses); on « route » the token drives a short dashed marker line inland (0.5 s). | `thup`, marker squeak | 2 |
| 3.8 | tear = after(V05·Afrique, V05·route + 0.26) [41.58 → 42.03] | The map **tears in two** along a vertical `tornLine` through the pin; halves slide apart left/right and off (0.45 s on twos, rot ∓0.08). Underneath: the **blank cream hero print P4** at `HP_PRINT` (taped, develop 0). | `paper_tear` | 0 |
| 3.9 | in = max(V05·camion, tear end) [42.03] → stop = max(V05·notre, in + 0.6) [42.63] | **Paper truck** (`hp_paperTruck`, s 1.45) drives in from the left, wheels on twos, and stops at origin (520, 1000) with a `drop` bounce: box ≈ x 143–665, y 565–928; cab x 680–897. | `truck_rumble_soft`, `horn_toy` double toot at stop | 0 |
| 3.10 | stop + 0.15 [42.78] | Note-line tag **« Notre entrepôt »** (kraft 520×120, cream insert, orange pin glyph + Bricolage 800 52) pinned at NOTE. Hold → V06·Étape [45.90]. | `pin_click` | 1 |
| 3.11 | 42.63 → 45.90 | P4 develops slowly 0 → 0.3: a faint warm ghost of the street appears around the truck. P4 footage = **B 6.0 (still)**, fr {fy .40} (real container then spans print y ≈ 340–1036). | `develop_whirr` very low | 1 |
| 3.12 | 43.9 | Slot 3 check. | `marker_squeak` | 1 |

Out: **T5 continuous.**

### S4 · 04 L’ARRIVÉE · 44.5 → 65.0 · V06 + Q1 + Q2 — C, `40_s4.js` (`s4_`)
V06 « Étape quatre : l’arrivée. Le voici, devant notre entrepôt ! Écoutez notre équipe sur place. »
Q1 « Voici votre conteneur qui arrive dans notre entrepôt en toute sécurité. »
Q2 « Il sera déchargé ici, dans notre entrepôt en toute sécurité. »
One idea: **paper becomes real — this is your container, here, for real, safely.** Layout: `HP_PRINT` all chapter,
badge (380, 380), NOTE (540, 1170).

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 4.1 | V06·Étape [45.90] | Tag **« ÉTAPE · 04 · L’ARRIVÉE »** at (540, 985) (y 735–1235, covers the print's lower half and the truck wheels); string to the truck box. « Notre entrepôt » is unpinned and slides out. Out = after(in, V06·voici + 0.2) [48.00]. | `paper_slap` | 1 |
| 4.2 | V06·arrivée [47.06] | P4 develops 0.3 → 1 (0.7 s) + `lightLeak(p, 9)`: the real street and container fill in around the paper truck. | `develop_whirr` | 1 |
| 4.3 | V06·Le [47.46] | — | **music stops one beat** | 1 |
| 4.4 | V06·voici [47.76] | **PAPER → REAL**: the paper truck lifts (shadow 6 → 30), rot +0.17, flies out bottom-left (0.4 s, on twos, motion blur) — 2-frame white flash — the **real container** (B 6.0 still) is revealed where the paper one was. KB 1 → 1.05 until Q1. | `shutter_click` + low boom (reveal hit) | 1 |
| 4.5 | 48.00 | Tag flies to slot 4. | `string_pluck` | 0 |
| 4.6 | V06·entrepôt [48.94] | **Stamp ARRIVÉ** (Stencil 110 orange, box, rot −0.08) at NOTE, `addShake(t0, 10)`. Hold → Q1·votre [52.77]. | `stamp_thunk` | 1 |
| 4.7 | V06·Écoutez [50.00] | Music ducks + low-pass (§1.10) until Q2 end. | — | 1 |
| 4.8 | V06·équipe − 0.3 [50.44] | **Team badge** pops at (380, 380) (auto). | `pin_click`, `mic_tap` | 2 |
| 4.9 | Q1 start [52.01] | **The print comes alive**: 3-frame flash, then **B 3.62 →** @1 in natural sync with Q1, fr {fy .62} (crops the container codes at the top). Waveform live. | — | 2 |
| 4.10 | Q1·votre [52.77] | ARRIVÉ fades (0.2 s). Scrap **« votre conteneur »** (Shantell 60 violetD on cream 520×110, r −0.02) at NOTE, write 0.4 s; violetD arrow (halo) from (600, 1110) curving up into the container (≈ (560, 640)). Hold → Q1·entrepôt [55.35]. | `marker_write` | 2 |
| 4.11 | Q1·arrive [53.83] | **Speed ramp** 1 → 0.4× (0.2 s): `hp_map([[Q1.start, 3.62], [53.83, 5.44], [55.35, 6.05]])`, so the clip stops before B 6.2 (ghost). | `tape_stop` subtle | 2 |
| 4.12 | Q1·entrepôt [55.35] | Scrap + arrow lift off. **Card swap**: P4 out right; **P4b dealt BLANK** from the left (0.35 s). At +0.40 [55.75] the **mini label** (s 1.1, ≈ 165×308) slaps on the blank print at `hp_frameToPrint(.425, .366, HP_PRINT, HP_CONT.fr)` ≈ (408, 563) — exactly over the star-outline ghost. [55.80 → 56.50] P4b develops + light leak: **B 9.0 still**, fr {fx .62, fy .50, zoom 1.25} (crops the shop sign at the left). The ghost is never visible. | `instant_eject`, `card_deal`, `sticker_slap`, `develop_whirr` | 2 (badge + label) |
| 4.13 | Q1·toute [56.77] | White cut rim runs round the container quad (0.35 s). | `scissors_snip` ×2 | 2 |
| 4.14 | Q1·sécurité [57.07] | **Container sticker lifts** (lift 0 → 30, s 1.05, 0.3 s), leaving a container-shaped hole (table cream) in P4b; violetD **check** (90 px) drawn at NOTE (0.3 s). | `sticker_peel`, `marker_squeak` | 2 |
| 4.15 | Q1 end [58.01] → Q2 [58.46] | Sticker rises and shrinks to hover at (800, 520) s .5 (bob ±4 px on twos). P4b + check slide out right; **P4c** dealt from the left: **B 10.3 →** @0.924 (reaches B 12.0 on Q2·ici), fr {zoom 1.2, fx .4, fy .5} (container end strip cropped). | `paper_slide` | 2 |
| 4.16 | Q2·ici [60.30] | **Ramp to a freeze** on **B 12.0** (the warehouse door; last 0.2 s 1 → 0). Orange arrow (w 8, halo) from the hovering sticker curving into the doorway (door point ≈ frame (.42, .45) → ≈ (542, 676), measure on the up frame); the sticker **glides along it into the doorway** [60.5 → 61.1], s .5 → .08, fading into the dark (clipped to the doorway quad for the last 0.2 s), tiny dust puff. Scrap **« ici ! »** (Shantell 96 orange on cream 360×140) at NOTE, write 0.35 s. | `tape_stop` « vvvip », `marker_write`, `whoosh_soft` small | 2 |
| 4.17 | Q2·dans [60.76] → 63.94 | Freeze + Ken Burns toward the door (zoom 1 → 1.25 around the door point). | — | 2 |
| 4.18 | Q2·sécurité [63.44] | VioletD check appended right of « ici ! » on the scrap (0.25 s). | `marker_squeak` | 2 |
| 4.19 | 63.7 | Slot 4 check (E). | — | 2 |
| 4.20 | dive = max(Q2·sécurité + 0.5, 63.9) [63.94] | **T6 dive → peel** (§2.3). The dive layer (z 72) covers the badge (z 65), which leaves on its own at Q2 end + 0.3; the stepper (z 75) and captions stay on top. | `whoosh_whip`, `paper_peel`, room-tone change | 0 |

Footage: B 6.0 still → B 3.62–6.05 → B 9.0 still → B 10.3–12.0 (§4). Text never exceeds 2 blocks.

### S5 · 05 LE DÉCHARGEMENT · 65.0 → 89.0 · V07 + Q3 + Q4 + V08 — D, `42_s5.js` (`s5_`)
V07 « Étape cinq : le déchargement. Le conteneur est vidé, et vos colis sont rangés à l’abri, dans l’entrepôt. »
Q3 « Voilà, très chers clients, nous sommes ici à l’entrepôt de Bonzini Trading Cargo. »
Q4 « Vos colis ont été déchargés en toute sécurité. »
V08 « Cartons, sacs, marchandises emballées : tout est rangé en sécurité, en attendant votre passage. »
One idea: **out of the container, into the shelter of our warehouse — and those real cartons are yours.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 5.1 | 65.1 (under the peel) | The **container sticker** (`hp_container`, same quad + mini label as s4) drops onto the table at (540, 1000) s 1.0 (lift 30 → 4). | `cardboard_thud` | 0 |
| 5.2 | V07·Étape [66.40] | Tag **« ÉTAPE · 05 · LE DÉCHARGEMENT »** (title 96) at (540, 560). Out = after(in, V07·conteneur) [68.56]. | `paper_slap` | 1 |
| 5.3 | 68.56 → 68.96 | Sticker slides up to (540, 760). | `paper_slide` | 0 |
| 5.4 | V07·vidé [69.16] | The photo side **folds down** like a flap hinged on its bottom edge (scaleY 1 → −0.35, 0.3 s), revealing the interior (same quad filled `C.boxIn` + corrugation lines). Cartons tumble out on twos to a row: A1 (250, 1110), A2 (370, 1120), B1 (710, 1110), B2 (830, 1120) [69.2–69.6]; **the hero comes out last** on V07·vos [69.78] → (540, 1100) s .45, `land` (the reunion). | `flap_fold`, `thup` ×4, `cardboard_thud` (hero, louder) | 0 |
| 5.5 | V07·rangés [70.70] | Container sticker slides out left (0.4 s); cartons slide into a stack: back row y 1000 at x 330/450/630/750, hero front (540, 1080). | `paper_slide` | 0 |
| 5.6 | V07·abri [71.24] | **Paper warehouse**: roof + two walls fold up around the stack (`hp_roofFold`, 4 poses, 0.35 s), spanning x 180–900, y 700–1180. « à l’abri ». | `popup_fold`, cardboard creak | 0 |
| 5.7 | V07·entrepôt [72.08] | Round logo sticker (cream disc r 70 + `drawLogo` 100) slapped on the gable at (540, 790). | `sticker_slap` | 0 |
| 5.8 | V07·end + 0.05 [72.75] | Hero hops out over the front wall to (850, 1150) s .4. | `thup` | 0 |
| 5.9 | Q3 − 0.3 [72.85] | Badge pops (auto). | `pin_click`, `mic_tap` | 1 |
| 5.10 | Q3·Voilà [73.15] | **Paper → photo flip**: the warehouse group flips (scaleX 1 → 0 in 0.2 s, swap, 0 → 1 in 0.2 s, on twos) and comes back as print **P5a**, easing to `HP_PRINT` by 73.85. P5a plays **A 15.9 → 18.5** word-mapped over Q3 (`hp_map([[Q3.start, 15.9], [Q3.end, 18.5]])` ≈ 0.515×, `vidBlend`), fr {fy .55}: rows of cartons, blue stacks. Hero `peek` toward it. | `card_flip`; bed low-passed | 1 |
| 5.11 | Q3·entrepôt [75.69] | Note-line tag **« Entrepôt Bonzini »** (kraft 560×130, cream insert, logo 56 + Bricolage 800 52) pinned at NOTE. Hold → Q4 start [78.65]. | `pin_click` | 2 |
| 5.12 | Q3·Bonzini [76.41] | Hero `nod`. | — | 2 |
| 5.13 | Q4 start [78.65] | **Card swap**: P5a + its tag slide out right; **P5b** dealt from the left: **A 23.4 → 23.8** @0.78 (reaches 23.8 on Q4·colis), fr {fy .55}. | `paper_slide` | 1 |
| 5.14 | Q4·colis [79.16] | **Freeze A 23.8** (`shutter_click`, flash 0.12). White cut rim traces the polygon round the **right-hand 2-box stack** (frame poly ≈ [.47,.38] [.85,.36] [.87,.79] [.49,.80] — measure on the up frame; maps to ≈ x 528–756, y 559–986), 0.4 s. | `scissors_snip` ×2 | 1 |
| 5.15 | Q4·ont [79.54] | The stack **lifts** (lift 0 → 24, s 1.05) and **two violet tape strips** swipe across it on twos (0.3 s): the real cartons now wear the hero's colour = « vos colis ». Hero `peek`. | `sticker_peel`, `tape_rip` | 1 |
| 5.16 | Q4·déchargés [80.00] | **Stamp DÉCHARGÉ** (Stencil 110 orange, box, rot −0.10) at NOTE. Hold → V08·Cartons [83.21]. | `stamp_thunk` | 2 |
| 5.17 | Q4·sécurité [81.80] | Hero `nod`. | — | 2 |
| 5.18 | Q4 end + 0.3 [83.06] | Badge out. | — | 1 |
| 5.19 | V08·Cartons [83.21] | **Desk sweep**: P5b, sticker and stamp slide out left (3 poses on twos, 0.3 s). **Polaroid 1** dealt at (200, 600) r −0.06: **A 25.2 still** + KB, caption **« cartons »** (Shantell 48) in its band. | `card_deal`; groove back to full + marimba hit | 1 |
| 5.20 | V08·sacs [83.67] | **Polaroid 2** at (540, 570) r +0.03: **A 12.4 → 13.6** @0.5 ping-pong, caption **« sacs »**. | `card_deal`, hit | 1 |
| 5.21 | V08·marchandises [84.33] | **Polaroid 3** at (880, 610) r +0.06: **A 19.8 still** + KB; caption **« emballées »** written on V08·emballées [85.03]. | `card_deal`, hit | 1 (one captioned group) |
| 5.22 | V08·rangé [85.77] | **Tidy**: the three polaroids straighten (rot → 0) and **snap into a perfect row** at y 600, x 200 / 540 / 880 (`spring(16, .5)`). Caption baselines at y ≈ 852 (< 900, so the right-hand one is legal even past x 960). | 3 soft clicks on the beat | 1 |
| 5.23 | V08·sécurité [86.11] | **Stamp EN SÉCURITÉ** (Stencil 100 violetD, box, rot −0.06) under the row at (540, 1000). Hold → T7 (≥ 88.21). | `stamp_thunk` + kick | 2 |
| 5.24 | V08·attendant [87.07] / passage [87.55] | Hero's breathe slows (period ×2), then turns r −0.06 toward the camera: it waits for you. | — | 2 |
| 5.25 | 88.3 | Slot 5 check. | `marker_squeak` | 2 |

Out: **T7 follow-drop** [88.65–89.35].

### S6 · 06 LE RETRAIT · 89.0 → 106.0 · V09 + Q5 — D, `44_s6.js` (`s6_`)
V09 « Étape six : le retrait. Il ne vous reste plus qu’à venir récupérer vos colis. »
Q5 « Et nous vous attendons dans notre entrepôt ici, au niveau du foyer Balengou, pour le retrait de vos colis. »
One idea: **come and collect it — at the door of our warehouse, Foyer Balengou.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| 6.1 | 89.35 | Hero lands on the **Bonzini counter** (`hp_counter(560)`, origin (540, 1010): body x 260–820, y 1010–1230) at (540, 945) s .5. | `cardboard_thud` | 0 |
| 6.2 | V09·Étape [90.40] | Tag **« ÉTAPE · 06 · LE RETRAIT »** at (540, 560). Out = after(in, V09·Il) [92.50]. | `paper_slap` | 1 |
| 6.3 | V09·venir [93.98] | **Footprints** walk in from (70, 1235) to the counter's left end (235, 1050): 6 prints, 0.1 s apart on twos. | soft stamp ticks ×6 | 0 |
| 6.4 | V09·récupérer [94.22] | **Paper client** (bust, s .5) slides in from the left behind the counter to x 400 (head and shoulders above the counter top), walk-bob on twos (0.4 s). | 3 paper footsteps | 0 |
| 6.5 | V09·colis [95.10] | Client arms `hold`: the hero hops from the counter into the client's hands (D draws it there; hero `visible:false`); violetD check (`iconCheck` 60) pops at (690, 860). | `thup`, check tick | 0 |
| 6.6 | Q5 − 0.3 [95.73] | Badge pops (auto). | `pin_click`, `mic_tap` | 1 |
| 6.7 | Q5·Et [96.13] | The client waves (one arm `raise` ↔ `idle` ×2 on twos, the other holds the parcel). | — | 1 |
| 6.8 | Q5·nous [96.77] | Counter + client slide out down-left (0.45 s, s → .7). **P6** dealt from the right at `HP_PRINT`: **B2 4.0 → 4.8**, `hp_map([[96.77, 4.0], [Q5·ici, 4.8]])` ≈ 0.30×, `vidBlend`, fr {zoom 1.1, fx .6, fy .5}: the walk up to the warehouse door. | `card_deal`; bed low-passed | 1 |
| 6.9 | Q5·ici [99.41] | **Freeze B2 4.8** (open doorway, dark inside) + Ken Burns zoom 1 → 1.3 toward the doorway until the end of the chapter; orange circle (`hp_circle`, halo, rx 150, ry 260) round the doorway (0.4 s). | `marker_squeak` | 1 |
| 6.10 | Q5·foyer [101.97] | Circle wipes. **Place tag** pinned at (520, 1150) r −0.03 (text x 210–830): pin glyph + **« FOYER BALENGOU »** / **« Point de retrait »**. Hold → chapter end (4 s). | `pin_click`, `paper_slap`; small warm swell | 2 |
| 6.11 | Q5·Balengou [102.21] | **The violet thread drops** from stepper tab 06's grommet (`hp_tabGrommet(5, t)`) down the right margin (x 1000 → 960) to the place tag's right grommet (845, 1150) and **ties a bow** (0.6 s): the journey thread is complete. | `string_zip` + cloth squeak; melodic lift | 2 |
| 6.12 | Q5·retrait [103.85] | Tab 06 check + stepper ripple 01 → 06 (`hp_ripple`). | tab ticks ×6 | 2 |

Out: **T8 pull-out + unhook** [105.6–106.3].

### RECAP · EN RÉSUMÉ · 106.0 → 117.5 · V10 « En résumé : l’achat, le groupage, le transport, l’arrivée, le déchargement… et le retrait. Six étapes, et vos colis arrivent en toute sécurité. » — E, `50_recap.js` (`rc_`)
One idea: **six steps, one thread, and the parcel arrives safely.**

Layout: header strip at (540, 285) (y ≈ 215–355); six tickets 480×118 (kraft body, cream insert; number Stencil 60
violetD at left; title Bricolage 800 56 ink) laced on the violet thread in a zigzag at x 480 (i even) / 600 (i odd),
y = 440 + 120·i (440 … 1040) → x 240–840; thread runs grommet to grommet then down to the hero at (190, 1130) s .45.

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| R0 | T8 [105.6 → 106.6] | The six stepper tabs fall on twos into the slots and grow into blank tickets (number side up, title hidden); the thread re-laces. | `paper_flutter` ×6, `tape_press` | 0 |
| R1 | 106.5 | Hero `land` at (190, 1130) s .45. | `cardboard_thud` light; build starts | 0 |
| R2 | V10·résumé [107.28] | Header **« EN RÉSUMÉ »** (Stencil 96 ink on torn cream, tape) laid down. | `paper_slap`; full groove | 1 |
| R3 | V10·achat [108.16] · groupage [108.82] · transport [109.68] · arrivée [110.52] · déchargement [111.20] · retrait [112.28] | On each word ticket i flips (horizontal paper flip, 6 frames) to show **« Achat »**, **« Groupage »**, **« Transport »**, **« Arrivée »**, **« Déchargement »**, **« Retrait »**; violetD check 0.25 s later; 30 % violet swipe behind the newest title; thread tightens a little. Hero `nod` on « retrait ». | `card_flip` + `marker_squeak` each; one rising pluck per word | 2 |
| R4 | V10·Six [113.00] | Header flips to **« 6 ÉTAPES »** (Stencil 110, « 6 » violetD); the checks pulse in sequence (0.3 s wave). | full-band hit | 2 |
| R5 | after(V10·retrait, V10·arrivent) [114.90] | Tickets slide up and fade (0.4 s). Hero hops to centre (540, 860) s 1.0 (`land`): its label **« VOTRE COLIS · DE : CHINE · À : VOUS »** is readable again. | `whoosh_soft`, `cardboard_thud` | 2 (header + label) |
| R6 | after(V10·Six, V10·toute) [115.44] | Header slides up and out (must be gone before R7). | `paper_slide` | 1 |
| R7 | V10·sécurité [115.66] | **Stamp EN TOUTE SÉCURITÉ** (two lines « EN TOUTE » / « SÉCURITÉ », Stencil 96 violetD, box, rot −0.08) across the carton's lower half at (560, 1010); `addShake(t0, 14)`, hero `shiver`, `confetti(s, 28)` from behind. Hold → T9. | `stamp_thunk` heavy, `confetti_paper`; biggest hit + cymbal swell | 2 (label + stamp) |

Out: **T9 whip** [117.76 → 118.16].

### OUTRO · 117.5 → 130.0 · Q6 « Et nous vous disons merci pour votre confiance. » + V11 « Bonzini Trading Cargo. Vos colis, en toute sécurité. » — E, `52_outro.js` (`ot_`)
One idea: **the team says thank you, for real; Bonzini Trading Cargo — your parcels, safe.**

| # | anchor | what happens | SFX / music | blocks |
|---|---|---|---|---|
| O1 | whip end [118.16] | **P7** at `HP_PRINT_OUTRO` (540, 700) plays **A 18.64 → 23.2 @1 in exact sync with Q6** (src = 18.64 + (t − Q6.start)), fr {fy .55}: the real « merci » over the real warehouse. Badge at (380, 270). Hero s .55 at (800, 1150), `peek` toward the print. | bed ducked, warm chords | 1 |
| O2 | Q6·merci [119.10] | **MERCI tag** swings in on the hero's lead thread to (520, 1110) r −0.05 (y 985–1235): **« MERCI »** + **« pour votre confiance »**. Hero `nod`. Hold → V11·Bonzini [123.11]. | `paper_slap`, `string_pluck` | 2 |
| O3 | Q6 end + 0.3 [122.96] | Badge out. | — | 1 |
| O4 | V11·Bonzini [123.11] | Print + MERCI slide away (0.4 s); hero → (540, 1110) s .6; **brand tag** swings back in at (540, 560), 800×400, logo and wordmark already assembled, footer **« Entrepôt · Foyer Balengou »**. | `whoosh_soft`, `paper_slap`; final theme | 1 |
| O5 | V11·Vos [124.51] | Torn cream strip **« Vos colis, en toute sécurité »** (Bricolage 800 54 ink) at (540, 850) (x ≤ 960); violet highlighter swipes « sécurité » on V11·sécurité [125.67]. | `paper_slap` light | 2 |
| O6 | V11·end [126.21] | `captionHide` to the end. | — | 2 |
| O7 | 127.0 | The lead thread from the hero knot to the brand tag pulls taut. | `string_pluck` | 2 |
| O8 | button = `TL.ch('outro').end − 0.5` [129.5] | Last hero `nod` + a short violet tape strip pressed across the lid. | `tape_press`, soft `cardboard_thud`; **music button** | 2 |

End card hold V11 end → 130.0 = 3.8 s.

---------------------------------------------------------------------------------------------------------------------

## 4. Footage usage (every use) — prepared frames only

| # | ch / beat | clip | source range [s] | speed | framing | FX |
|---|---|---|---|---|---|---|
| F1 | hook H4 P1 | B | 4.40 → 5.24 | 0.7 | fy .62 | deal, develop |
| F2 | hook H4 P2 | A | 23.40 → 24.24 | 0.7 | fy .55 | deal, develop |
| F3 | hook H4 P3 | B | 11.00 → 11.84 | 0.7 | zoom 1.2, fx .4 | deal, develop |
| F4 | s3 3.11 → s4 4.9 | B | **6.00 still** | — (develop 0 → .3 → 1, KB) | fy .40 | develop under the paper truck, peel reveal |
| F5 | s4 Q1 | B | 3.62 → 5.44 → 6.05 | 1 → 0.4 (ramp) | fy .62 | natural sync, ramp |
| F6 | s4 Q1 | B | **9.00 still** | — | fx .62, fy .50, zoom 1.25 | blank → label → develop; container quad cut-out (reused in s5) |
| F7 | s4 Q2 | B | 10.30 → 12.00, freeze 12.00 | 0.924 → 0 | zoom 1.2, fx .4, fy .5 | ~sync, ramp → freeze, KB, dive |
| F8 | s5 Q3 | A | 15.90 → 18.50 | ≈ 0.515 (blend) | fy .55 | paper → photo flip |
| F9 | s5 Q4 | A | 23.40 → 23.80, freeze 23.80 | 0.78 | fy .55 | polygon cut-out, violet tape |
| F10 | s5 V08 pol1 | A | 25.20 still | KB | polaroid | deal |
| F11 | s5 V08 pol2 | A | 12.40 → 13.60 ping-pong | 0.5 | polaroid | deal |
| F12 | s5 V08 pol3 | A | 19.80 still | KB | polaroid | deal |
| F13 | s6 Q5 | B2 | 4.00 → 4.80, freeze 4.80 | ≈ 0.30 (blend) | zoom 1.1, fx .6, fy .5 | KB, circle |
| F14 | outro Q6 | A | 18.64 → 23.20 | 1 (sync) | fy .55 | synced print |

**Spec forbidden ranges — none touched:**
- **B < 2.7** (jersey + printed name): lowest B used = 3.62 ✓.
- **A 6.0–10.5** (car emblem): lowest A used = 12.40; nothing between 0 and 12.4 ✓ (no emblem cover needed).
- No raw clip, no « MAERSK » (prepared frames only) ✓.

**Team AVOID list (add to `05_video.js` as warnings, lead):**

| range | why | used? |
|---|---|---|
| B 6.2–10.3 | star-outline ghost left by the clean plate | only **F6 = B 9.00 still**, whose ghost box (frame x .33–.52, y .24–.50) is under the mini label stuck **before** the print develops; F7 starts at 10.30 with the container face out of the crop. Optional CP-1 (§5.4) |
| B 12.1–16.6 | cream letter remnants (B 14, B 15) / container close | no |
| B2 0–2.0 | star panel, container-end marks | no |
| B2 2.0–3.95 | green-jersey man at the kiosk | no (F13 starts at 4.00, checked) |
| B2 5.5–9.7 | people seated (faces), trefoil shorts, printed sweatshirt | no |
| B2 10–14.6 | red cab, green jersey, shop signs | no |
| A 0–6, A 10.5–12.3 | cars, car front + chair | no |
| A 20.3–20.85 | a small seated figure in a dark gap | only inside F14 at 1× (tiny, far, moving); never frozen |

**Repeats (accepted)**: F1 ⊂ F5 region (teaser vs synced), F3 ⊂ F7 region, F2 ∩ F9 (A 23.4–23.8: teaser vs
freeze), F12 = one still from F14's range. Full-frame footage only during the T6 dive (≤ 0.3 s fully full).
**Third-party content check**: carton markings (« 15x96 pcs », Chinese product text) are goods markings, allowed; no
logo, sign or plate is ever circled, enlarged or frozen.

---------------------------------------------------------------------------------------------------------------------

## 5. Division of work

### 5.1 Packages

| pkg | chapters (files, prefix) | shared file it OWNS (others only call it) | z it registers | it needs from others |
|---|---|---|---|---|
| **A** | hook `20_hook.js` (`hk_`), brand `22_brand.js` (`br_`) | `11_hero.js` (hero, labels, moods, keys, anchors, lead thread) | 20, 38, 40, 50, 60 (brand tag) | E: `hp_stepMode`, `hp_tabGrommet`, `hp_brandTag`, `hp_pluck`; core |
| **B** | s1 `30_s1.js` (`s1_`), s2 `32_s2.js` (`s2_`) | `16_paper.js` (paper props, follow-drop, flakes, counter, footprints, roof) | 20, 50 | A: hero API; core; kit `stall`, `shoeBox`, `postIt`, `BZ_MAP.china` |
| **C** | s3 `34_s3.js` (`s3_`), s4 `40_s4.js` (`s4_`) | `13_prints.js` (print FX, container sticker, polygon cut, peel); CP-1 (optional) | 20, 50, 72 | B: `hp_paperTruck`, `hp_paperContainer('side')`; A: anchors; D: badge (auto); E: tags/ticks (auto) |
| **D** | s5 `42_s5.js` (`s5_`), s6 `44_s6.js` (`s6_`) | `14_badge.js`, `15_qrms.js` (generated by `lib/q_rms.py`), `90_captions.js` Q style | 20, 50, 65 | C: `hp_container`, `hp_polyCut`; B: `hp_roofFold`, `hp_counter`, `hp_footprints`, `hp_clientCarton`, `hp_followY`; E: `hp_tabGrommet`, `hp_ripple`; kit `person` |
| **E** | recap `50_recap.js` (`rc_`), outro `52_outro.js` (`ot_`) | `12_stepper.js` (stepper, `HP_TAGS` chapter tags + flights + checks, brand / MERCI tags, unhook) | 20, 50, 60, 75 | A: hero API; D: `hp_badgePos` |
| **Lead** (Day 0, before fan-out) | — | `10_core.js`, stubs of 11–16 with the exact signatures below, `05_video.js` AVOID list, `render.mjs --dump-cues` | — | — |

Rules: one package edits only its own files; globals prefixed with the package key; IIFE + `registerScene`
(`SCENE_GUIDE.md`). Shared files `1x_` are auto-loaded by `render.mjs --scenes`, so every package can render its
chapters alone. Chapter tags, stepper checks and the badge are **automatic** (E / D draw them from TL): chapter
owners never draw them.

### 5.2 Shared helpers (signatures)

**`10_core.js` (lead)**
```js
C.box='#3E8FB0'; C.boxRib='#2C6F8C'; C.boxIn='#5A3E24'; C.postit='#FFE36E'; C.halo='rgba(251,246,236,.92)';
const HP_PRINT       = { x: 540, y: 740, w: 600, h: 800, rot: -0.02 };
const HP_PRINT_OUTRO = { x: 540, y: 700, w: 600, h: 800, rot: -0.02 };
const HP_FULL        = { x: 540, y: 960, w: 1080, h: 1920, rot: 0 };
const NOTE           = { x: 540, y: 1170, w: 640 };
function W_(seg, word, nth = 0)            // TL.wt shorthand; console.error in dev if the word is missing
function hp_after(prevIn, t, min = 2.1)    // → Math.max(t, prevIn + min)
function hp_hold(name, tIn, tOut)          // dev assert: warn if tOut − tIn < 2.0
function hp_map(t, pairs, ease = null)     // piecewise source time [[t0,s0],[t1,s1],…], clamped; ramps
function vidBlend(clip, srcT, x, y, w, h, o) // vidCover + crossfade with the next even frame (slow motion)
function hp_rectLerp(a, b, k)              // → rect
function hp_pushRect(rect, px, py, z, k)   // scale about (px,py) by lerp(1,z,k), move (px,py)→(540,960) by k, rot→0
function hp_frameToPrint(nx, ny, rect, fr) // frame-normalised point → screen [x,y] inside a print (cover fit + fr + rot)
function hp_printAt(rect, clip, srcT, o)   // at(rect) + videoPrint(clip, srcT, rect.w, rect.h, o); o.blend → vidBlend; o.drawOver(x,y,w,h)
function hp_halo(fn, w = 8)                // run stroke fn twice: C.halo at w+6, then colour at w
function hp_circle(cx, cy, rx, ry, p, col = C.violetD, seed = 1)   // handCircle + halo
function hp_arrow(ctrl, p, col = C.violetD, w = 8)                  // handArrow + halo
function hp_scrap(str, x, y, k, o)         // torn cream scrap + Shantell write-on; o {size:60, color, rot, w}
function hp_tagNote(lines, x, y, k, o)     // kraft luggage tag + cream insert + orange pin; lines [{s, font, size, color}]
function hp_stamp(word, x, y, t, t0, o)    // stampText + slam + one addShake; registers in HP_STAMPS (dev: > 5 or < 4 s apart → error)
function hp_check(x, y, k, size = 90, col = C.violetD)
function hp_tape(x0, y0, x1, y1, k, col = C.tape, w = 64)          // tape strip pulled from (x0,y0) to (x1,y1)
function hp_sfx(name, t0)                  // records {name, t0} once → window._cues (render --dump-cues)
```

**`11_hero.js` (A)**
```js
function hp_carton(o)        // hero at local origin; o {flaps 0..1, tapeK 0..1, label:'on'|'off', chineK, vousK}
function hp_label(o)         // 360×250 label; o {chineK, vousK}
function hp_labelMini(o)     // portrait 150×280 « VOTRE / COLIS »
function hp_keys(ch, fn)     // fn() → [{t, x, y, s, r, ease}]  pose keys (word-anchored)
function hp_states(ch, fn)   // fn(t) → {visible, flaps, tapeK, label, labelPose:{x,y,s,r}|null, chineK, vousK}
function hp_mood(ch, list)   // [{kind:'land'|'hop'|'peek'|'shiver'|'nod', t0, dir}]
function hp_pose(t)          // → {x, y, s, r, visible, …} merged from all chapters
function hp_knot(t)          // → [x, y] screen point of the thread knot
function hp_anchor(ch, fn)   // fn(t) → [x, y] | null : lead-thread end while the hero is hidden
// scenes: 'lead' z 38 (thread from hp_tabGrommet(active) to knot/anchor), 'hero' z 40
```

**`12_stepper.js` (E)**
```js
const HP_WORDS = ['ACHAT','GROUPAGE','TRANSPORT','ARRIVÉE','DÉCHARGEMENT','RETRAIT'];
const HP_TAGS  = [ // ch, num, title, in, out, pos — see §5.3
  { ch:'s1', num:'01', title:'L’ACHAT',         in:()=>W_('V03','Étape'), out:i=>hp_after(i, W_('V03','Chine')),            x:540, y:600 },
  { ch:'s2', num:'02', title:'LE GROUPAGE',     in:()=>W_('V04','Étape'), out:i=>hp_after(i, W_('V04','colis')),            x:540, y:600 },
  { ch:'s3', num:'03', title:'LE TRANSPORT',    in:()=>W_('V05','Étape'), out:i=>hp_after(i, W_('V05','conteneur')),        x:540, y:560 },
  { ch:'s4', num:'04', title:'L’ARRIVÉE',       in:()=>W_('V06','Étape'), out:i=>hp_after(i, W_('V06','voici') + .2),       x:540, y:985 },
  { ch:'s5', num:'05', title:'LE DÉCHARGEMENT', in:()=>W_('V07','Étape'), out:i=>hp_after(i, W_('V07','conteneur')),        x:540, y:560 },
  { ch:'s6', num:'06', title:'LE RETRAIT',      in:()=>W_('V09','Étape'), out:i=>hp_after(i, W_('V09','Il')),               x:540, y:560 } ];
function hp_stepMode(t)          // 'hidden'|'birth'|'ghost'|'live'|'unhook'|'gone'
function hp_tabRect(i, t)        // → {x, y, w, h, r} screen rect of tab i (accordion-aware)
function hp_tabGrommet(i, t)     // → [x, y]
function hp_tagPose(ch, t)       // → {x, y, s, r, k} current chapter-tag transform (strings, flights)
function hp_brandTag(x, y, s, r, k, o)   // o {logoK, wordK, footer, w, h}
function hp_merciTag(x, y, s, r, k)
function hp_pluck(t0); function hp_ripple(t0); function hp_tick(i, t0)   // checks auto at TL.ch(sN).end − 0.7
function hp_recapSlot(i)         // → {x, y} ticket slot (§3 recap)
// scenes: 'chapterTags' z 60, 'stepper' z 75
```

**`13_prints.js` (C)**
```js
const HP_CONT = { clip:'B', t:9.0, fr:{fx:.62, fy:.50, zoom:1.25},
                  quad:[[.25,.23],[1.0,.0],[1.0,.64],[.25,.59]],   // container, frame-normalised — measure on up/B/00270.jpg
                  label:{nx:.425, ny:.366, s:1.1} };                // over the star-outline ghost — measure
function hp_deal(t, t0, rect, from = 'left', dur = .35)  // → rect (slide + rot spring)
function hp_out(t, t0, rect, to = 'right', dur = .4)     // → rect
function hp_develop(t, t0, dur = .6)                     // → 0..1
function hp_flash(t, t0, dur = .12)                      // → 0..1
function hp_rimClip(cx, cy, k)                           // angular reveal clip 0 → 2π
function hp_container(t, o)  // the B 9.0 container quad sticker + mini label; o {x, y, s, r, lift, rimK, flapK, hole:bool, alpha, clipQuad}
function hp_polyCut(clip, srcT, poly, rect, fr, rimK, lift, o)   // polygon sticker cut from a frozen frame
function hp_peel(t, t0, dur, drawFront)                  // corner peel of a full-screen layer (§2.3 T6)
```

**`14_badge.js` + `15_qrms.js` (D)** — `hp_badge` scene z 65 (automatic from Q segments); `hp_badgePos(ch, x, y)`;
`hp_badgeEarliest(qId, t)` (pop no earlier than t; E uses it for Q6);
`window.Q_RMS = {Q1:[…], …}` (0..1 per output frame, generated by `lib/q_rms.py` from the Q audio used by the mix).

**`16_paper.js` (B)**
```js
function hp_clientCarton(w, h, tapeCol, seed)
function hp_paperContainer(view, o)   // 'top' 820×340 | 'side' 300×128; o {lid 0..1, label:true, fill}
function hp_paperTruck(t, o)          // o {label:true}
function hp_footprints(path, k, o)
function hp_roofFold(k, w = 720)
function hp_counter(w = 560)
function hp_flakes(t, t0, x, y, n = 6)
function hp_followY(t, chIn, role)    // role 'out'|'in' → dy ; hp_followHero(t, chIn) → {dy, tilt, sy}
```

### 5.3 Hand-off contracts at the boundaries

| boundary | window | contract |
|---|---|---|
| hook → brand | 7.5 | A owns both; stepper `ghost` from 7.5 (E). |
| brand → s1 | 13.92–14.45 | A draws T2; B draws s1 from 14.0 (empty table, no China before V03·Chine). Hero ends T2 at (540, 1080) s .55, flaps 1, label hovering at (150, 1170) s .45 — B's keys start from that pose at 14.45. |
| s1 → s2 | 23.15–23.85 | B (both). |
| s2 → s3 | 33.1–33.95 | B stops drawing the s2 table layers (container, tags, cartons) at 33.6, under the waves; the closed container's last B pose = (540, 760) s .3 lifted 60, top view at 33.6. B still draws the post-it (top of frame) until it has slid out up-left [33.7 → 33.95]. C draws waves, the flip and the boat from 33.1. |
| s3 → s4 | 44.5 | C (both). P4 = `HP_PRINT`; paper truck origin (520, 1000) s 1.45. |
| s4 → s5 | 63.94–65.24 | C's z 72 dive/peel on top; D draws s5 from 64.0 (table + container sticker dropping at 65.1). D gets the sticker from `hp_container` (C). |
| s5 → s6 | 88.65–89.35 | D (both) with `hp_followY` (B). |
| s6 → recap | 105.6–106.3 | D slides s6 out; E unhooks the stepper and draws recap from 105.6. |
| recap → outro | 117.76–118.16 | E (both). |

### 5.4 Gates (before final render)
- **G1 timeline**: `data/timeline.json` (Kyutai V01–V11 + Q1–Q6, 130.0 s) — done; any rebuild keeps the same words,
  so anchors survive. Re-run every package's check stills after a rebuild.
- **G2 footage**: `foot/up/A` and the rest of `foot/up/B` finish preparing; each owner re-checks its ranges (§4) at
  100 % on the up frames: C → F1, F3–F7 (incl. the HP_CONT quad and label position, and that B 10.3's crop shows no
  ghost); D → F8–F13 (polygon F9, the door at B2 4.8); E → F14; A → F2.
- **G3 CP-1 (optional, C)**: extend `lib/cleanplate.py` with a manual quad mask over the star-outline ghost for
  B 8.6–9.4 (frame box x .33–.52, y .24–.50, tracked linearly) and re-prep those frames. Not required by this storyboard
  (the label covers the ghost); required if anyone ever uses another B 6.2–10.3 frame.
- **G4 data**: `lib/q_rms.py` → `overlay/scenes/15_qrms.js` (D).
- **G5 asserts clean**: no `FORBIDDEN FOOTAGE`, no AVOID warning except F6 (documented), no `hp_hold` warning, stamp
  registry = 5, no readable text in y 1250–1430 (except captions) or at x > 960 for y 900–1560.

### 5.5 Check stills (current timeline; render with `--pages 2 --jpg`, look at full size AND at phone size)
- **A**: 0.0, 0.3, 2.6, 4.2, 5.4, 6.4, 9.9, 12.3, 13.9, 14.3
- **B**: 15.9, 18.3, 19.2, 21.4, 22.3, 23.5, 27.8, 29.3, 32.0, 32.9
- **C**: 33.4, 35.6, 38.9, 40.5, 41.8, 42.9, 46.4, 47.9, 49.4, 51.0, 53.3, 56.2, 57.6, 59.2, 60.9, 63.6, 64.3, 64.9
- **D**: 65.4, 66.9, 69.6, 71.6, 72.4, 73.6, 76.0, 79.4, 80.6, 84.6, 86.6, 89.5, 91.0, 94.5, 95.4, 96.4, 98.0, 100.2, 102.8, 104.5
- **E**: 105.9, 107.6, 110.0, 112.6, 113.4, 115.2, 116.0, 117.9, 119.6, 121.5, 124.0, 125.9, 128.0, 129.6

Always render the neighbouring chapter's files too for the boundary stills; final render `--mb 3`.

---------------------------------------------------------------------------------------------------------------------

## 6. Global sound cue sheet (music on the 120 BPM grid; SFX logged with `hp_sfx`)

| anchor | music | SFX |
|---|---|---|
| hook frame 0 → 0.30 | downbeat: kick + bass on the landing | `cardboard_thud`, `paper_rustle` |
| V01·Chine / Découvrez / jusqu’à / vous | hi-hat opens on « Découvrez » | `stamp_thunk` light · `card_deal` ×3 + `instant_eject` · `whoosh_whip` · `marker_write` |
| V01·étape | 16th ratchet fill into the bar | `string_pluck`, `clack_wood` ×6 rising |
| brand | full groove; brand stab on « Bonzini »; 2-beat dip on T2 | `paper_slap`, `string_pluck`, `paper_slap` ×4, `stamp_thunk` light, `tape_rip`, `flap_fold`, `sticker_peel` |
| every chapter tag | kick accent | `paper_slap` in, `string_pluck` out |
| s1 | marimba off-beats on the goods; snare on EMBALLÉ | `pin_click`, `popup_fold`, `thup` ×4, `flap_fold`, `tape_rip`, `stamp_thunk`, `sticker_slap`, `knot_tie` |
| follow-drops | small riser into the landing | `whoosh_soft`, `cardboard_thud` |
| s2 | 5 marimba notes up on the hops | `cardboard_bump` ×3, `thup` ×5, `marker_write`, felt swipes, `card_flip`, `lid_scrape`, `sticker_slap` |
| T4 / s3 | pad swell, groove opens; rising line under the crossing | `waves_paper`, `horn_toy` (« bateau »), `pin_click`, `paper_tear`, `truck_rumble_soft`, `horn_toy` ×2 |
| s4 | **1-beat stop on V06·Le, reveal hit on « voici »**; duck + low-pass from « Écoutez » to Q2 end | `develop_whirr`, `shutter_click`, `stamp_thunk`, `pin_click`, `mic_tap`, `marker_write`, `tape_stop`, `instant_eject`, `sticker_slap`, `scissors_snip` ×2, `sticker_peel`, `whoosh_soft` |
| T6 | reverse-cymbal swell; s5 downbeat brings the bed back | `whoosh_whip`, `paper_peel`, room-tone change |
| s5 | full under V07; low-passed under Q3/Q4; full again + marimba hits on Cartons / sacs / emballées; kick on EN SÉCURITÉ | `flap_fold`, `thup` ×4, `cardboard_thud`, `popup_fold`, `sticker_slap`, `card_flip`, `pin_click`, `shutter_click`, `scissors_snip`, `tape_rip`, `stamp_thunk` ×2, `card_deal` ×3, clicks ×3 |
| s6 | low-passed under Q5; melodic lift on the bow | stamp ticks ×6, footsteps, `thup`, check tick, `card_deal`, `marker_squeak`, `pin_click`, `string_zip`, tab ticks |
| recap | riser into the downbeat; one pluck per step word; full-band hit on « Six »; biggest hit + cymbal on « sécurité » | `paper_flutter` ×6, `card_flip` + `marker_squeak` ×6, `stamp_thunk` heavy, `confetti_paper` |
| outro | ducked warm chords under Q6; final theme on V11; **button at 129.5** | `paper_slap`, `string_pluck`, `whoosh_soft`, `tape_press`, soft `cardboard_thud` |

---------------------------------------------------------------------------------------------------------------------

## 7. Master list of on-screen strings (all ≤ 5 words, all on opaque paper, accents checked)

- Hook: « VOTRE COLIS » · « DE : » · « CHINE » · « À : » · « VOUS »
- Brand: « LE PARCOURS » · « DE VOS COLIS » · « BONZINI » · « TRADING CARGO »
- Chapter tags: « ÉTAPE » + « 01 »…« 06 » · « L’ACHAT » · « LE GROUPAGE » · « LE TRANSPORT » · « L’ARRIVÉE » · « LE DÉCHARGEMENT » · « LE RETRAIT »
- Stepper: « ACHAT » · « GROUPAGE » · « TRANSPORT » · « ARRIVÉE » · « DÉCHARGEMENT » · « RETRAIT »
- s1: « CHINE » · « 中国 » · « FOURNISSEUR » · « EMBALLÉ »
- s2: « Client A » · « Client B » · « Vous » · « 1 » « conteneur » → « espace » « partagé »
- s3: « CHINE » · « AFRIQUE » · « Notre entrepôt »
- s4: « ARRIVÉ » · « L’équipe Bonzini » · « sur place » · « votre conteneur » · « VOTRE » « COLIS » (mini label) · « ici ! »
- s5: « Entrepôt Bonzini » · « DÉCHARGÉ » · « cartons » · « sacs » · « emballées » · « EN SÉCURITÉ »
- s6: « FOYER BALENGOU » · « Point de retrait »
- Recap: « EN RÉSUMÉ » · « Achat » · « Groupage » · « Transport » · « Arrivée » · « Déchargement » · « Retrait » · « 6 ÉTAPES » · « EN TOUTE » « SÉCURITÉ »
- Outro: « MERCI » · « pour votre confiance » · « BONZINI » · « TRADING CARGO » · « Entrepôt · Foyer Balengou » · « Vos colis, en toute sécurité »

Facts: brand = « Bonzini Trading Cargo »; the only place = « Foyer Balengou » (no district, city, address, GPS);
map shows only « CHINE » / « AFRIQUE » and an unlabelled pin on the Gulf of Guinea coast; no price, delay, transit
time, phone, container number, carrier or other brand; no sample code (so no « exemple » tag); never « transfert
d’argent » / « envoyer de l’argent ».

## 8. Risks to watch in review

1. **Paper → real alignment (s4)**: the paper truck's box (x 143–665, y 565–928) sits inside the real container's area
   (print y 340–1036). The simultaneous lift, flash and finished develop hide any mismatch; check 47.9 at phone size.
2. **Mini-label placement on B 9.0**: measure the ghost box on `up/B/00270.jpg` and set `HP_CONT.label` so the label
   covers it with ≥ 10 px margin; the label is applied before the develop, so a wrong value shows the ghost — check 56.6.
3. **Slow motion** (F8 ≈ 0.52×, F13 ≈ 0.30×): must use `vidBlend`; if F13 still stutters, start the freeze at Q5·entrepôt
   instead of Q5·ici.
4. **s4 density**: one note-line item at a time, ≤ 2 blocks — audit stills 49.4, 53.3, 56.2, 57.6, 60.9.
5. **Hold drift with a timeline rebuild**: every replacement uses `after()`; the tightest are the brand tag
   (→ 13.92), AFRIQUE (→ tear), ticket 06 in the recap (→ list exit) and the recap stamp (→ whip). `hp_hold` flags them.
6. **Right-edge text rule**: polaroid 3 caption and the hero label in s5/outro stay < 960 or above y 900 — check
   84.6 and 119.6.
7. **Peel code**: if the corner peel misbehaves on the first try, ship the fallback (slide-up with curl shadow); the
   dive alone already links s4 to s5.
