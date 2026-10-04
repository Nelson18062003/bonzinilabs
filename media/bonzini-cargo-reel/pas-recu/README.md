# « PAS REÇU. » — la bagarre des sous-titres (29,4 s, motion design)

Vidéo virale n°2, demandée après « Le Bonneteau du Feyman ». La leçon de la n°1, que le patron n'avait pas comprise au
premier visionnage, est devenue la règle n°1 : **un commerçant de Mboppi qui la voit une fois, sans le son, doit pouvoir
dire ce qui s'est passé et ce que fait Bonzini.** Vertical 1080×1920, 30 i/s, 882 images, voix française.

## L'histoire (dossier : `analysis/CONCEPT.md`, brief : `analysis/BRIEF.md`)
Sur le comptoir d'une boutique de Mboppi le soir (nappe wax, ampoule), les mots se battent :
1. « J'ai payé mon fournisseur. » (TOI) se fait écraser par une plaque d'acier « PAS REÇU. » (TON FOURNISSEUR · CHINE).
2. Ping-pong LUNDI → JEUDI : « J'AI PAYÉ ! » / « !! » / « !!! » contre « PAS REÇU. ». Le margouillat suit le match.
3. « LA PREUVE ? » — « …LE GARS M'A DIT QUE C'EST FAIT. » — la plaque ambre transpire, puis s'aplatit.
4. Voix habituelle : « Quand tu paies sans preuve, c'est ça. » Rembobinage : « La même commande… avec l'appli Bonzini. »
5. La plaque émaillée « BONZINI PAIE TON FOURNISSEUR ✓ » se déplie en reçu « PREUVE DE PAIEMENT », tamponne l'acier
   (sur le mot « preuve ») : le P, le A et le S tombent, il reste « REÇU ✓ », qui se pose sur « J'AI PAYÉ. ».
6. Carte de fin « Bonzini Labs · Paie tes fournisseurs chinois en XAF. Avec la preuve. », le margouillat avale P, A, S.
   Mot-clé : **REÇU**.

Choisi parmi 10 concepts (5 angles) notés par 3 juges, compréhension en premier (40 %) : 1er avec 7,85/10.

## Fabrication
- **Voix** : `lib/tts_kyutai.py` (Kyutai TTS 1.6B, CC-BY 4.0) avec une voix par réplique (`data/script_recu.json`) —
  narratrice : `unmute-prod-website/developpeuse-3` (CC0, « la voix femme habituelle ») ; commerçant : voix d'homme
  `cml-tts/fr/1770_1028_000036-0002_enhanced` (jeu CML-TTS, CC-BY 4.0), choisie par audition (`data/voices_cml_fr.json`).
  `lib/vocheck.py` note chaque prise sans écoute (transcription faster-whisper, durée, expressivité) ; prises retenues :
  `data/takes.json`. « Payer sans preuve » était entendu « payeur » : remplacé par « Quand tu paies sans preuve ».
- **Partition** : `overlay/scenes/01_score.js` pilote l'image et le son ; `tools/retime.py` recale tous les temps sur les
  vraies voix (`data/timing.json`, `data/voice_plan.json`) : deux personnes ne parlent jamais en même temps, la plaque
  Bonzini atterrit sur « Bonzini », le tampon tombe sur « preuve ». `node tools/check_score.js` contrôle les mouvements.
- **Image** : `10_table.js` (nappe wax, ampoule, atmosphère — reprise du Bonneteau), `30_plates.js` (plaques acier /
  ambre / « LA PREUVE ? », fissures, peinture violette, ✓), `32_letters.js` (sous-titre, lettres qui giclent, chute et
  roulement de P, A, S, poussières, sueur, rembobinage), `36_receipt.js` (plaque émaillée Bonzini et reçu), `40_gecko.js`
  (margouillat : sursaut, match de tennis, regard plissé, pompes, 3 bouchées, hoquet), `50_compose.js`, `60_type.js`.
  Rendu : `cd overlay && node render.mjs 0 881 --out ../out/final --pages 3 --mb 6 --jpg` (≈ 2 min 15).
- **Son** : `python3 lib/audio_recu.py --sheet` → `audio/mix.wav` (makossa tendue en fa dièse mineur en stop-time sur
  les chocs, coupure totale à « LA PREUVE ? », la majeur au ✓, 34 bruitages synthétisés, voix ≥ 12,6 dB au-dessus de la
  musique, −14 LUFS, crête vraie −1,3 dBTP). Réutilise `lib/audio.py`, `makossa.py`, `instruments.py`, `bikutsi.py`.
- **Encodage** : master CRF 16 ; version à poster en 2 passes à 7,1 Mb/s (25,5 Mo) ; WhatsApp 720p CRF 21 (6 Mo).
- Polices (`assets/fonts`, non versionnées, OFL) : Satoshi, Big Shoulders Stencil, Martian Mono, DM Sans, Caveat Brush,
  Bricolage Grotesque, Shantell Sans.

## Garde-fous
« payer / paie / paiement / preuve » ; jamais « envoyer », « transfert », « virement ». Aucun prix, délai ni chiffre :
les jours n'existent que dans l'« avant » et s'effacent au rembobinage. Le fournisseur est une plaque sans visage ni
accent, qui demande une preuve (il n'est pas accusé) ; « le gars » n'est jamais montré. Le reçu n'a ni montant, ni nom,
ni date, ni référence. « Bonzini paie ton fournisseur » et « la preuve de paiement » correspondent aux libellés réels de
l'app (« Bénéficiaire payé », « Preuve de paiement », `src/i18n/locales/fr/payments.json`). À confirmer par le patron :
une preuve existe pour chaque mode de paiement.
