# « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » — série Guangzhou → Douala

Série de 4 vidéos verticales (1080 × 1920, 30 i/s) remontées à partir de 44 vrais clips WhatsApp :
- **v1–v3** : Guangzhou, le 11/10/2026 (entrepôt et chargement, une voiture qui part en conteneur, visite du bureau), avec
  la vraie voix de l'équipe ;
- **v4–v44** : l'arrivée à Douala, le 29/09/2026 (conteneur ouvert dans la rue, SUV qui sort du conteneur, machines
  levées à la grue jusqu'aux boutiques, foule qui filme), sans voix.

| film | durée | état |
|---|---|---|
| 1 « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » (héros, écran coupé par la bande-route) | 36,7 s | livré (`prod_f1`) |
| 2 « DÉPOSÉ. REÇU. » (statut WhatsApp, variante `cut` de `prod_f1`) | 19,2 s | livré |
| 3 « LA VOITURE SORT… ET LES TÉLÉPHONES AUSSI ! » | ≈ 20 s | en production (`prod_f3`) |
| 4 « ELLE VA OÙ, CETTE MACHINE ? » | ≈ 25 s | en production (`prod_f4`) |

## Documents
- `BRIEF.md` : la demande, le journal des plans, ce qui est dit (horodaté), le fond du message, ce qu'on peut affirmer ou
  non, et les pièges de Douala : chronologie (ce n'est pas le même envoi), « premier conteneur », marques, flous, personnes.
- `SERIE.md` : la décision du jury, le système visuel « DUPLEX », les segments de vraie voix, les storyboards de
  production des 4 films, les textes de publication, **les 12 points à faire confirmer par le patron (§7)**, et la
  vérification de conformité (§8).
- `work/douala_log.json` : le journal plan par plan des 41 clips de Douala. `work/transcripts.json` : les transcriptions
  avec les mots horodatés. `work/index.json` : l'index des clips.

## Fabrication
- `prod_f1/` : le moteur multi-clips (Canvas 2D rendu dans Chromium, déterministe, une seule partition pour l'image et
  le son) et la partition des films 1 et 2. Commandes, contrats des modules et historique des relectures :
  `prod_f1/README.md` et `prod_f1/MODULES.md`.
- `voice/` : les 23 phrases de la narratrice des 4 films (Kyutai, réglage « diction claire », ≤ 3,2 syllabes/s telles que
  jouées), `takes.json` et `words.json`, plus les temps mesurés de la vraie voix dans `real_words.json`.
- `tools/ingest.py` : importe les clips envoyés (sans doublon). `tools/transcribe_more.py` : transcription.

Les clips sources (77 Mo), les images préparées, les rendus et les mixages ne sont pas versionnés : `ingest.py` reconstruit
`src/` depuis les envois, puis `prep_clips.py --score`, `render.mjs`, `lib/mix.py` et `tools/mux.sh` refont le reste.
