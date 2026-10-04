# Série « JE SAVAIS PAS. » — 5 vidéos virales signées Bonzini Trading Cargo

Demande du patron : du contenu viral sur la douane, le cargo / transport de colis, les arnaques, l'achat en Chine et
les conseils business (le paiement est déjà couvert par « PAS REÇU. »). Règle héritée des deux vidéos précédentes :
**compréhensible en une vue, sans le son** — chaque phrase clé est dite (voix habituelle + voix du commerçant « TOI »)
ET écrite en grand. Rituel de fin commun : « MAINTENANT, TU SAIS. » + un mot-clé à commenter.

| N° | Épisode | Sujet | Durée | Mot-clé | Dossier |
|---|---|---|---|---|---|
| 1 | « TCHAC ! » Prix chinois × 2 = 0 | conseils business (prix de revient) | 33,9 s | TCHAC | `ep1/` |
| 2 | « TU PAIES DE L'AIR. » | cargo (le mètre cube, cartons bien remplis) | 34,3 s | CBM | `ep2/` |
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
