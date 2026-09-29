# « Votre vrai prix de revient » — Tchac, le billet maigrit ! (3 min 06)

Kraft & Fil world, money edition. A 10 000 F spécimen note (stylised, never a BEAC replica) is cut live into
seven slices sized to each cost; a « RESTE SUR LE BILLET » calculator falls from 10 000 to 0; Junior, a sneaker
seller in Mboppi (Douala), discovers that « prix chinois fois deux… égale zéro ». Then the method: the real cost
price, the floor (« plancher »), × 1,25 to keep 20 % of the selling price, and what to do when the market won't follow.
Same voice as the series (Kyutai TTS 1.6B, CC-BY 4.0 · voice `unmute-prod-website/developpeuse-3`, CC0).
Music: makossa-flavoured groove synthesised in `lib/makossa.py` (Karplus-Strong guitar, bass, light kit).

## Worked example (FICTIONAL — labelled « exemple fictif » on screen, never Bonzini rates)
100 pairs at 5 000 F, resold at 10 000 (« × 2 »). Per pair ordered: supplier 5 000 · rate + fees 150 ·
truck in China 200 · boat 800 · customs duties & taxes 3 000 · small costs 350 = 9 500; lot 950 000.
5 unsellable pairs (two left feet) → 950 000 ÷ 95 = 10 000 F per sellable pair = the selling price → 0 profit;
at 9 000: −95 000. To keep 20 % of the selling price: 10 000 × 1,25 = 12 500 (× 1,20 only gives 16,7 %).
Market at 11 000 → target cost 11 000 × 0,80 = 8 800.

## Facts used (verified)
- Customs value = goods + transport + insurance (CAF base): CGI 2026 art. 138; WTO trade policy review
  WT/TPR/S/445 (Cameroon annex §3.26). VAT 19.25 % is charged on value + duty + excise.
- The video never states whether customs is included in a groupage rate (not documented): « inclus dans le
  groupage ou payés à part, ils sont dans votre prix ».
- Bonzini: suppliers paid from a XAF balance; the applied rate is shown before « Confirmer le paiement »
  (NewPaymentAmountStep / confirmation screen); parcels scanned, photographed, weighed and measured at the
  Guangzhou reception (migration `parcel_reception`). No Bonzini rate, fee, transit time or address is shown.
- Accounting: OHADA AUDCIF art. 37 (cost = purchase price + all attributable costs up to the place of use);
  taux de marque = marge ÷ prix de vente, coefficient = 100 ÷ (100 − taux de marque).

## Pipeline
`lib/tts_kyutai.py` (per-segment takes, `SCRIPT=` for text variants) → `lib/check_takes.py` (unbiased ASR check)
→ `lib/build_timeline.py` (chosen `take` per segment) → `overlay/render.mjs --mb 3 --jpg [--scenes …]`
→ `lib/audio.py` (+ `lib/cues.py`, `lib/makossa.py`, `lib/money_sfx.py`, `data/cues_scenes.json`) → `lib/encode.sh`.
Scenes: `20_billet.js` is the spine (note, scissors, calculator, envelopes); chapters in `15_junior`, `30_costs`,
`40_twist`, `50_ticket`, `60_method`, `62_market`, `65_bonzini`, `70_outro`; shared props in `00_money`, `01_people`,
`03_show`, `04_places`; rules in `SCENE_GUIDE.md`.
