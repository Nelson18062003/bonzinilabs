# Teaser « Douane : combien ? » — APS Douane (24 s + coupe 15 s)

Pur teasing du module douane de Bonzini Labs (bonzinilabs.com/douane, en test). Vertical 1080×1920, 30 i/s, boucle
(la dernière image retombe sur la première). Aucun chiffre à l'écran, aucune promesse de remboursement ou d'économie :
la promesse est **« Payez le juste droit. Ni plus, ni moins. »** — savoir AVANT ce qui est dû.

## Histoire (storyboard complet : `analysis/final_storyboard.md`)
1. **0–6 s · l'imprimante noire** — un ticket thermique sort : « Douane : combien ? » … « On verra… à l'arrivée. »,
   quatre lignes de droits illisibles, « Ça, c'est dû. », puis les inconnues « Code ? Valeur ? Papiers ? Jours ? »
   et la frise de la franchise.
2. **6–10 s · la relance** — recul : le ticket s'entasse sur une caisse « MARGE » qu'il recouvre (« Ce qu'on ne sait
   pas… ça se paie. »), puis « Et si vous saviez AVANT ? », un seul glitch RVB, une seconde de silence numérique.
3. **10–14 s · le drop** — le monde s'éclaire (design du module) : les inconnues tombent en poussière, il reste les
   quatre lignes nommées (droit de douane, accises, TVA et centimes, autres taxes). « Ni plus. » — la ligne TVA s'étire
   puis revient — « Ni moins. »
4. **14–24 s · le vrai produit** — le ticket se replie dans la barre du vrai écran (« On l'estime… avant. »,
   « Exemple · estimation »), la vraie barre de recherche tape « baskets », le titre « Payez le juste droit. Ni plus,
   ni moins. », le tiroir « Douane » du logo, la carte de fin « Bientôt » + mention « Estimation · à faire confirmer
   par un commissionnaire agréé en douane. » + tampon « EN TEST », puis l'iris referme sur l'imprimante (boucle).
   Coupe 15 s : même début, fin dédiée (`SHORTEND` dans `overlay/scenes/00_core.js`).

## Garde-fous (analyse : `analysis/pain.md`, `product.md`, `viral.md`, `factcheck.md`)
- Bonzini n'est pas commissionnaire en douane ; pas de « premier / seul / gratuit / au franc près / tarif 2026 /
  pas un franc de plus », pas de « récupérez / remboursé », pas de « économisez X % ». Jamais d'agent des douanes,
  de corruption ni d'accusation des transitaires.
- Zéro chiffre : montants en trames, « ??? » dessinés avec des points renforcés (`qMarks`, sinon le flou de
  mouvement les fait lire « 777 »). Vérification OCR : `python3 tools/ocr_check.py <dossier d'images>`.
- Le lien n'apparaît pas (« Bientôt ») tant que (1) le design premium n'est pas en ligne, (2) les textes du site
  ne sont pas corrigés, (3) un test réel n'est pas fait.
- Les captures (`assets/img/cap/`) viennent du design premium (branche `claude/bonzini-cameroon-tariff-3b9uli`) via
  `tools/cap_teaser.mjs` : chiffres remplacés par « • », sous-titre du h1 remplacé par « Ni plus, ni moins. »
  (montage tant que ce n'est pas en ligne), zones floutées.

## Fabrication
- `lib/groove.py` (+ `lib/instruments.py`) — musique « Douane Groove » 120 BPM, mi mineur, afro-house en 3 temps :
  kit « paperasse » (tampon = grosse caisse, calculatrice = clave, imprimante = shaker, clavier = charleston),
  silence numérique 9,5–9,8 s, drop sub à 10 s, log drum, ostinato bikutsi, logo sonore (balafon + « Bonzini Labs »
  parlé). Mots chantés/parlés « Ni plus. / Ni moins. » : voix Kyutai TTS (`lib/tts_kyutai.py`, voix
  `unmute-prod-website/developpeuse-3`, CC0 ; modèle CC-BY 4.0). Écrit `out/music_<cut>.wav` (−14 LUFS) et
  `data/grid_<cut>.json` (la grille que suivent les animations).
- `overlay/` — moteur Canvas 2D (`engine.html`, `kit.js`, `render.mjs`), scènes `00_core.js` (partagé),
  `20_printer.js` (0–6), `30_relance.js` (6–10), `40_drop.js` (10–14), `50_real.js` (14–24 + fin 15 s).
  `node render.mjs 0 719 --cut main --out ../out/final_main --pages 2 --jpg` (450 images pour `--cut short`).
- Polices : `assets/fonts/` — Satoshi (copier `public/fonts/satoshi/*.woff2` de la branche tarif) + les polices de la
  série (Big Shoulders Stencil, Bricolage Grotesque, Martian Mono, Shantell Sans, DM Sans, OFL).
- Encodage : H.264 CRF 17 + AAC 256k (1080×1920) et versions WhatsApp 720p en 2 passes (≈ 7 Mo / 5,7 Mo).
