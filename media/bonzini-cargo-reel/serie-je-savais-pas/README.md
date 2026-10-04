# Série « JE SAVAIS PAS. » — 5 vidéos virales signées Bonzini Trading Cargo

Demande du patron : du contenu viral sur la douane, le cargo / transport de colis, les arnaques, l'achat en Chine et
les conseils business (le paiement est déjà couvert par « PAS REÇU. »). Règle héritée des deux vidéos précédentes :
**compréhensible en une vue, sans le son** — chaque phrase clé est dite (voix habituelle + voix du commerçant « TOI »)
ET écrite en grand. Rituel de fin commun : « MAINTENANT, TU SAIS. » + un mot-clé à commenter.

| N° | Épisode | Sujet | Durée | Mot-clé | Dossier |
|---|---|---|---|---|---|
| 1 | « TCHAC ! » Prix chinois × 2 = 0 | conseils business (prix de revient) | 47,9 s (v2) | CALCUL | `ep1/` |
| 2 | « TU PAIES DE L'AIR. » | cargo (le mètre cube, cartons bien remplis) | 44,0 s (v2) | CARTON | `ep2/` |
| 3 | « C'EST PAS ÇA. » | achat en Chine (tout par écrit, l'échantillon) | — | FICHE | à venir |
| 4 | « PATRON, ATTENDS ! » | arnaques (« on a changé de compte bancaire ») | — | ALLÔ | à venir |
| 5 | « J'AI FIXÉ MON PRIX. » | douane (estimer avant) | — | AVANT | à venir |

- `BRIEF.md` — la demande, les leçons, les services Bonzini vérifiés, les faits disponibles, les règles.
- `SERIE.md` — le dossier de production (concours de 15 concepts, 3 juges, compréhension 40 %) : storyboards seconde
  par seconde, textes exacts, faits et sources, vérification règle par règle, points à valider par le patron.
- `PIPELINE.md` — le contrat de fabrication d'un épisode (partition unique image + son, temps dérivés des voix).
- `retime.py` — recale un épisode sur ses prises de voix : répliques sans chevauchement, écarts du storyboard gardés,
  temps des mots recalés sur la vraie parole (la transcription place un mot qui suit une pause au début de la pause)
  et chiffres réécrits en lettres (« 1000 » → « mille ») pour les ancrages.
- Faits vérifiés dans le code de l'app : le maritime est facturé au mètre cube et l'aérien au kilo
  (`src/lib/cargoQuote.ts`) ; chaque colis est enregistré à la réception avec photo, poids et dimensions
  (`supabase/migrations/20260920100000_parcel_reception.sql`). Les chiffres de l'épisode 1 sont l'exemple fictif déjà
  validé de « Votre vrai prix de revient » et restent marqués « EXEMPLE FICTIF ».

Chaque épisode : `overlay/` (moteur Canvas + scènes), `lib/audio_epN.py` (musique, bruitages et mix synthétisés, qui
importe la bibliothèque son de `../../pas-recu/lib`), `data/` (script des voix, prises retenues, temps), `MODULES.md`,
`README.md`. Voix : Kyutai TTS 1.6B (CC-BY 4.0) — narratrice `unmute-prod-website/developpeuse-3` (CC0), commerçant
`cml-tts/fr/1770_1028_000036-0002_enhanced` (CML-TTS, CC-BY 4.0). Rendu : `cd epN/overlay && node render.mjs 0 <N-1>
--out ../out/final --pages 3 --mb 6 --jpg` ; son : `python3 lib/audio_epN.py --sheet`.

## Voix claires (v2, 4 octobre 2026)

Retour du patron sur les épisodes 1 et 2 : « on ne comprend pas ce qu'elle dit ». Tout a été refait pour la
compréhension d'abord (règles dans `DICTION.md`) :

- **Texte** (`epN/SCRIPT_V2.md`, `epN/data/script_v2.json`, devenu `script.json`) : phrases complètes de 12 mots au plus,
  chiffres en lettres avec « francs », plus de « Tchac » ni de « Guangzhou » dans la voix, mot technique défini avant
  d'être employé (« La place se mesure en mètres cubes »), mot-clé de fin = un vrai mot (CALCUL, CARTON, FICHE, ALLÔ).
  Les anciennes données restent en `data/*_v1.json`.
- **Voix** (`tts_v2.py`, réglages dans `voice_cfg.json`, essais dans `lab/`) : température 0,2, CFG 3, `padding_between`
  2 (mots mieux détachés, environ 20 % plus lent), courte pause entre deux phrases ; 3 prises par réplique, générées en
  un seul lot. `voice_cfg_slow.json` (`padding_bonus` 0,25) pour une réplique courte sortie trop vite. Un étirement
  Rubber Band a été testé et rejeté : il fait baisser la compréhension sous la musique.
- **Tri des prises** (`select_takes.py` + `voice_score.py`) : une oreille volontairement faible (faster-whisper
  « small », filtre téléphone, musique de la série à 10 dB sous la voix) ; comparaison par le SON (homophones,
  lettres muettes) ; mots indispensables par réplique dans `data/must.json` ; débit visé 3 à 4 syllabes/s.
  `tighten.py` ramène à 0,45 s les silences trop longs à l'intérieur d'une prise.
- **Recalage** : `retime.py --pauses` garde les SILENCES du storyboard (et `data/gaps.json`, minimum par transition)
  quelle que soit la longueur des prises ; `--tail` fixe la queue après la dernière réplique.
- **Mixage** : musique −12 dB sous la voix (+ creux 0,9–5 kHz de 6 dB), bruitages −9 dB, impacts −6 dB ; plus aucun
  bruitage fort ne commence dans un mot clé (vérifié par `tools/qa_score.js`).
- **Contrôle final** (`listen_test.py`, même oreille faible sur le mix final) : épisode 1, 84 % des mots reconnus
  avant → 100 % ; épisode 2, 94 % → 99 % (le seul écart est « maître cube », homophone de « mètre cube »).
  Durées : 47,9 s et 44,0 s (au lieu de 33,9 s et 34,3 s) — on parle moins vite.

Commandes, pour un épisode `E` : `python tts_v2.py E --takes 3` (venv Kyutai) → `python3 tighten.py E` →
`BED=<musique> python3 select_takes.py E` → `cp E/data/script_v2.json E/data/script.json` →
`CHOSEN=1 python3 E/lib/vocheck.py E/data/script.json` → `python3 retime.py E --pauses --tail 0.6` →
`node E/tools/qa_score.js` → `python3 E/lib/audio_epN.py --sheet` → `python3 listen_test.py E E/audio/mix.wav` → rendu.
