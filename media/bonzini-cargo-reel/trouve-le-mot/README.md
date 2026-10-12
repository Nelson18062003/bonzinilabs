# « TROUVE LE MOT. » — Bonsoir, bonsoir (montage d'une vraie vidéo, 12/10/2026)

Une vraie vidéo WhatsApp de 10 s, filmée un soir en Chine (une camionnette chargée de colis ; « BONZINI » écrit à la main
sur l'étiquette d'un colis ; une vraie voix : « Bonsoir, bonsoir » … « Merci de faire confiance à Bonzini Trading »),
montée en jeu de 24,8 s : « Trouve le mot Bonzini » (chrono de 7 s) → STOP « Tu l'as vu ? » → retour au début et zoom ×4
sur les VRAIS pixels de l'étiquette (aucune IA : Real-ESRGAN inventait des lettres) → la vraie voix → carte « Avec Bonzini,
tes colis vont de Chine à Douala. Par bateau ou par avion. » → « Bonsoir, bonsoir » → « Réponds-lui en commentaire :
BONSOIR ». Variante statut WhatsApp : « Réponds-lui en message ».

- `BRIEF.md` — la demande, le relevé du rush (temps, son), les règles.
- `STORYBOARD.md` — concours de 5 concepts, 3 juges ; le storyboard à la seconde, les voix, les faits, le plan technique,
  la publication.
- `src/rush.mp4` — la vidéo d'origine (accord de celui qui filme et de l'employé donné par le patron le 12/10/2026 ; le
  patron a confirmé « Merci de faire confiance à Bonzini Trading »).
- `prod/` — la fabrication (moteur Canvas de la série + images du rush) : `README.md` (fichiers, API, ancres, contrôles),
  `MODULES.md`, `overlay/` (partition `01_score.js`, rush `05_rush.js`, chrono, ellipse, carte, typo), `lib/audio_rush.py`
  (vraie voix aux 3 extraits seulement, fond de rue synthétique, makossa, bruitages, mix −14 LUFS), `tools/`
  (`prep_frames.py`, `make_timing.py`, `qa.js`), `data/` (voix choisies, minutage, suivi de l'étiquette).

Refaire, depuis ce dossier (outils de la série : `../serie-je-savais-pas/`) :
```
mkdir -p src_frames work && ffmpeg -i src/rush.mp4 -start_number 0 src_frames/%04d.png && ffmpeg -i src/rush.mp4 -vn -ar 48000 work/audio48.wav
cd prod && python3 -P tools/prep_frames.py . --workers 2                      # images 1080×1920, flous, calque du zoom
python ../../serie-je-savais-pas/tts_v2.py . --takes 3                         # voix (venv Kyutai), puis tighten / select_takes
python3 tools/make_timing.py . && node tools/qa.js                              # minutage + contrôles
python3 lib/audio_rush.py --sheet && (cd overlay && node render.mjs --out ../out/final --pages 3 --mb 6 --jpg)
# variante WhatsApp : audio_rush.py --n6w ; render.mjs --n6w (→ out/frames_wa)
```
Contrôle final : `listen_test.py` (oreille faible, filtre téléphone, sur le mix final) : 37/37 mots de la narratrice.
