# Rush « Bonsoir bonsoir » — storyboard de production (12/10/2026)

## 1. En tête

**Titre : « TROUVE LE MOT. » — Bonsoir, bonsoir**

**Logline.** Une vraie vidéo de téléphone, filmée un soir en Chine, devient un jeu de 7 secondes : « Trouve le mot
Bonzini ». STOP : « Tu l'as vu ? ». L'image revient au début, zoome sur la vraie étiquette écrite à la main, et un trait
violet l'entoure : « Le mot Bonzini était là dès le début. » La vidéo repart et la vraie voix dit « Merci de faire
confiance à Bonzini Trading ». Une carte dit ce que fait Bonzini : « Avec Bonzini, tes colis vont de Chine à Douala. »
Puis l'homme redit « Bonsoir, bonsoir », et on invite le spectateur à lui répondre en commentaire. La vidéo boucle.

**LA PHRASE-test** (ce qu'un commerçant doit pouvoir redire après UNE vue, même sans le son) :
> « C'est une vraie vidéo filmée en Chine : le mot Bonzini est écrit à la main sur un colis, et il était là dès le
> début. Avec Bonzini Trading Cargo, tes colis vont de Chine à Douala. »

**Seuil du test** (5 commerçants, une vue, sans le son, Android à 360 px de large, luminosité 50 %) : 4 sur 5 redisent
« Bonzini écrit sur un colis en Chine » ET « de Chine à Douala ». Bonus attendu : « il faut répondre bonsoir ».

**Durée : ≈ 25 s** (≈ 752 images à 30 i/s ; recalée sur les vraies prises, voir § 5.5).

### Pourquoi ce gagnant
Score pondéré (compréhension 40 % · viral 35 % · faisabilité 25 %) :

| Concept | Compr. | Viral | Faisab. | Pondéré |
|---|---|---|---|---|
| **libre — « TROUVE LE MOT » + BONSOIR** | 6,5 | 8 | 7,5 | **7,28** |
| preuve — « C'EST ÉCRIT QUOI ? » | 8 | 5,5 | 8 | 7,13 |
| jeu — chrono qui monte, « écris ton chiffre » | 4,5 | 7,5 | 6,5 | 6,05 |
| son — remix makossa | 5 | 6,5 | 7 | 6,03 |
| heure — « +7 H » | 4 | 4,5 | 5 | 4,43 |

« libre » gagne de peu : c'est le seul qui a les deux moteurs (une **mission** dès l'image 0, et le **réflexe du salut**
« réponds-lui : bonsoir »). Ses défauts étaient surtout de compréhension. On les corrige avec la discipline de
« preuve » (une ligne droite, peu de texte, vrais pixels, ligne de service claire). Chaque problème soulevé par les juges
et sa correction sont dans le tableau du § 4.3.

### Ce qui a été vérifié sur le rush pour écrire ce storyboard (mesures du 12/10)
- **Suivi de l'étiquette** image par image (`cv2.matchTemplate`, modèle pris à r 6,50) : corrélation ≥ 0,8 de r 0,00
  à 2,70 et de r 5,50 à 9,93 → `rush1/work/label_track.json` (positions en pixels source). L'étiquette fait environ
  53 × 25 px dans la source, soit environ 124 × 58 px à l'écran à ×1 et 495 × 233 px à ×4.
- **Image la plus nette pour le zoom : r 1,00 (image 30)**. C'est une image clé du fichier (une image sur 30 est plus
  nette) : netteté de l'étiquette 2985, contre 1977–2599 pour ses voisines et 952 pour r 6,50, l'image prévue par les
  concepts. Autres images clés nettes : r 2,00 (3142), r 2,50 (3289), r 8,00 (2725). Planche : `rush1/dir/labels.jpg`.
- **L'écriture** se lit « BoNZINI » (le 2e signe est un petit « o » qui ressemble à un « e »). Sous ce mot, une 2e ligne
  ressemble à « TRADING » et une 3e ligne, plus petite, est illisible (nom, code ou numéro possibles).
- **L'agrandissement par IA (Real-ESRGAN, `rush1/up/`) invente des lettres** : sur l'étiquette, il transforme
  « BoNZINI » en « HOUZINI » ou « BONBINI » (comparaison : `rush1/dir/esr_vs_bic3.jpg`, en haut à droite et en bas à
  droite). Il est donc **exclu** de cette vidéo (voir § 5.1).
- **Son** (énergie par tranche de 50 ms) : « Bonsoir, bonsoir » ≈ r 0,6–1,7, reprise de voix à r 1,85 ; creux avant
  le 2e « merci » à r 7,70–7,75, rafale à 7,80 ; fin de « Trading » ≈ r 9,50, creux à 9,55–9,65 ; un choc fort
  (≈ −23 dB) à r 9,70–9,80. Demucs n'a pas séparé la rue : elle est restée dans `stem_vocals`, les autres stems sont
  quasi muets (−55 à −68 dBFS). Il n'existe donc pas d'« ambiance sans voix » prête à l'emploi (voir § 5.6).

---

## 2. Storyboard seconde par seconde

`r` = temps dans le rush (secondes source, image = round(r × 30)). Plein cadre = 464 × 832 → 1080 × 1920 en Lanczos
(×2,3276, 8 px rognés en haut et 9 en bas), sans stabilisation. Étalonnage chaud et doux, grain fin sur toute l'image
(dessins compris). La **mention** « VRAIE VIDÉO · EN CHINE » (44 px, blanc sur noir à 60 %, x 64, y 160–214) est
présente de 0,00 à 15,80 et de 20,60 à la fin ; elle compte comme la mention de provenance de la série (comme
« EXEMPLE FICTIF »), en plus des 3 blocs de texte au plus.

| Temps (s) | Image (rush, cadrage, vitesse, ce qui est dessiné) | Texte à l'écran (exact) | Voix (exacte) | Son |
|---|---|---|---|---|
| **0,00–0,75** · ACCROCHE | r 0,00→0,75 à vitesse réelle, plein cadre. L'employé en polo rouge sort à droite (r 0–0,4) : l'image bouge dès l'image 0. Dégradé sombre en haut (y 140–800, 45 %). **Rien n'est dessiné sur le chargement** (étiquette à l'écran ≈ x 350–470, y 1065–1240). | Dès l'image 0 (couverture) : bloc 1, plaque titre centrée « TROUVE LE MOT » (100 px, blanc, y 420–520) / « BONZINI » (150 px, violet, contour sombre, y 530–680). Bloc 2, chrono : anneau ambre (x 840–1010, y 160–350), « 7 » (110 px) et « secondes » (44 px, y 355–400). Mention. | — | Son réel du rush (rue). **Pas de musique.** Tic de bois doux à 0,00 (départ du chrono). |
| **0,75–2,00** | r 0,75→2,00 à vitesse réelle : camionnette, colis noirs, feu arrière rouge. L'anneau du chrono se vide en continu. | Bloc 3, sous-titre 0,75–2,35 : boîte blanche (x 80–940, y 1330–1460), en-tête « vraie voix » (44 px, gris) + « « Bonsoir, bonsoir. » » (64 px, noir). Chrono : « 6 » à 1,00. | **R1, vraie voix** (son d'origine, parole ≈ 0,6–1,7) : « Bonsoir, bonsoir. » | Son d'origine jusqu'à r 1,78 (fondu de sortie 1,72–1,78), puis fond de rue de remplacement (fondu croisé 150 ms). Tic à 1,00. Petite montée de shaker 1,75–2,00. |
| **2,00–2,90** | r 2,00→2,90 à vitesse réelle. | Plaque titre, chrono (« 5 » à 2,00), mention. Le sous-titre sort à 2,35. | **N1** (≈ 2,15–3,82) : « Trouve le mot Bonzini. » | **2,00 : la makossa tendue tombe d'un coup sec** (grosse caisse, basse, guitare en ostinato, 120 bpm), 12 dB sous la voix. Tic à 2,00. |
| **2,90–5,00** · difficulté | r 2,90→3,40 à ×2 (filé vers la gauche, flou de mouvement) → r 3,40→4,90 à vitesse réelle (l'employé, de dos, prend un colis noir au pied de la boutique ; diable au premier plan) → r 4,90→5,60 à ×2 (filé retour). **Flous doux cuits dans les images** de r 2,9 à 5,6 : enseigne « 5G SIM CARD », enseignes chinoises, autocollant feuille verte du scooter blanc. L'employé n'est jamais figé, ralenti ni montré à l'envers ; aucun texte ni flèche sur lui. | Plaque titre, chrono (« 4 » à 3,00, « 3 » à 4,00), mention. **À 4,55**, une ligne s'ajoute dans la plaque, sous BONZINI : « écrit sur un colis » (64 px, blanc, y 690–760). | **N2** (≈ 4,55–6,77) : « Il est écrit sur un colis. » | Whoosh sur chaque filé (2,90 et 4,65). Tics à 3,00 et 4,00. Fond de rue. Makossa tendue. |
| **5,00–7,00** · 2e chance | r 5,60→7,60 à vitesse réelle : retour sur la camionnette ; l'étiquette se lit de nouveau dès r 6,0. Vignettage qui se resserre doucement sur les bords, jamais sur l'étiquette. | Plaque titre (3 lignes), mention. Chrono « 2 » (5,00) puis « 1 » (6,00), **en orange**. | Fin de N2 (jusqu'à 6,77). | Tics à 5,00 et 6,00, plus forts. La makossa monte d'un cran. |
| **7,00–8,35** · STOP | **Gel sur r 7,60.** Secousse de 10 px amortie en 6 images, image assombrie de 25 %. | La plaque titre sort par le haut (0,2 s). Bloc 1 : tampon « STOP ! » (orange, 150 px, y 700–860, penché de −4°), de 7,00 à 8,45. Bloc 2 : « TU L'AS VU ? » (104 px, blanc, y 420–540), de 7,15 à 9,45. Bloc 3 : chrono « 0 » (orange). Mention. | **N3** (≈ 7,10–8,35) : « Stop ! Tu l'as vu ? » | **La musique se coupe net à 7,00.** Tampon + buzzer doux. Fond de rue bas. |
| **8,35–8,85** · retour au début | Le rush **rembobine** : r 7,60→5,70 (0,25 s), puis r 2,80→1,00 (0,25 s). Le raccord est caché par 2 images de filé horizontal. Flou de mouvement. Le trottoir et l'employé ne passent jamais à l'envers. | « TU L'AS VU ? » reste. « STOP ! » se décolle à 8,45. Le chiffre du chrono **roule** de 0 à 6 (compteur qui défile, sans clignoter) ; l'anneau se remplit à 6/7 et redevient ambre. Mention. | — | Bruit de rembobinage **synthétique** (bande, hauteur qui descend). Jamais la voix du rush à l'envers. |
| **8,85–9,45** · zoom | **Gel sur r 1,00** (image 30, la plus nette). **Une seule poussée continue ×1 → ×4** (accélère puis ralentit), centrée sur l'étiquette, qui se place à x 540, y 1020 (≈ 495 × 233 px). Dès ×1,6, le calque haute définition préparé prend le relais (bicubique depuis la source, sans IA). Les lignes sous BONZINI passent en **mosaïque** dès ×2. Bords assombris de 40 % ; le sac marron reste dans l'ombre. | « TU L'AS VU ? », chrono « 6 ». À 9,45, la mention devient « VRAIE IMAGE · ZOOM × 4 ». | — | Souffle montant. Clic de mise au point à 9,43. |
| **9,45–13,55** · LA RÉPONSE | ×4 tenu, poussée très lente ×4,00 → ×4,12, grain. De 9,45 à 9,85, un trait violet au feutre trace une ellipse **AUTOUR** de l'étiquette (jamais sur les lettres), avec un léger halo violet : **premier violet sur la vraie image**. Sur le mot « Bonzini » (repère W), une flèche violette dessinée va du mot BONZINI du titre jusqu'à l'ellipse. | Bloc 1, dès 9,60 (96 px, y 400–730) : « LE MOT **BONZINI** / ÉTAIT LÀ / DÈS LE DÉBUT ! » (« BONZINI » en violet, 120 px). Bloc 2, sous l'étiquette (52 px, x 300–780, y 1200–1260) : « écrit à la main ». Bloc 3 : chrono « 6 », qui pulse une fois sur « début ». Mention « VRAIE IMAGE · ZOOM × 4 ». | **N4** (≈ 9,65–13,35) : « Le mot Bonzini était là dès le début. » | **Signature balafon** (2 notes qui montent) à 9,45, sur l'ellipse. Crissement de feutre (ellipse, puis flèche). Fond de rue bas. Pas de musique. |
| **13,55–13,80** | Dézoom ×4,12 → ×1 (0,15 s), puis filé horizontal (0,1 s) vers r 7,62. | Le titre, « écrit à la main » et le chrono sortent (0,2 s). La mention redevient « VRAIE VIDÉO · EN CHINE ». | — | Whoosh retour. |
| **13,80–15,80** · la vraie voix | **La vidéo repart là où on l'avait arrêtée** : r 7,62→9,62 à vitesse réelle. Cadrage ×1,10 lissé, qui garde l'étiquette entre x 600 et 860 à l'écran (calculé depuis `label_track.json`). Une ellipse violette plus fine suit l'étiquette image par image. | Sous-titre 13,85–16,00 : boîte blanche (x 80–940, y 400–640), en-tête « vraie voix » (44 px) + « « Merci de faire confiance / à **Bonzini Trading**. » » (64 px, « Bonzini Trading » en violet). Mention. | **R2, vraie voix** (son d'origine r 7,70–9,60, parole ≈ 13,9–15,75) : « Merci de faire confiance à Bonzini Trading. » | Son d'origine r 7,70→9,60 (fondu d'entrée 60 ms, fondu de sortie 80 ms) sur le fond de rue. **Aucune musique sous la vraie voix.** |
| **15,80–20,60** · ce que fait Bonzini | De 15,80 à 16,05, une feuille de kraft monte et couvre l'image (dernier plan r 9,62). Table kraft vue de dessus. À 15,95, la plaque émaillée violette se pose : logo + « BONZINI TRADING CARGO » (y 260–520). Puis un trajet se dessine au feutre (y 860–1180, x 100–900) : un carton kraft dessiné → pointillés → « CHINE » … « DOUALA », un petit bateau (ambre) apparaît sur « Chine », un petit avion (orange) sur « Douala ». Le margouillat (x 40–300, y 1360–1530) hoche la tête sur « Douala ». **Aucune image du rush sur la carte.** | Bloc 1 : plaque « BONZINI TRADING CARGO ». Bloc 2 (96 px, 2 lignes, y 580–860) : « TES COLIS VONT / DE CHINE À DOUALA. ». Bloc 3 : le trajet dessiné (« CHINE », « DOUALA », 52 px) et dessous « Par bateau ou par avion. » (52 px, y 1210–1270, à partir de 17,5). | **N5** (≈ 16,10–20,20) : « Avec Bonzini, tes colis vont de Chine à Douala. » | Papier qui glisse (15,80). « Tonk » de la plaque (15,95). **La makossa repart en MAJEUR à 15,95**, 12 dB sous la voix. Feutre sur « Chine », petits « pop » du bateau et de l'avion. À 20,15, la guitare joue seule le motif « bon-soir, bon-soir » (2 + 2 notes) ; la musique finit sur la dernière note (20,60). |
| **20,60–22,05** · il te redit bonsoir | Coupe sur le rush **r 0,55→2,00** à vitesse réelle, même cadrage que l'accroche. Une ellipse violette fine entoure l'étiquette (rappel). À 22,05, gel sur r 2,00 (image clé nette). | Sous-titre dès 20,65 (boîte blanche, x 80–940, y 400–600) : en-tête « vraie voix » + « « Bonsoir, bonsoir. » » (64 px), tenu jusqu'à la fin. Mention. | **R1b, vraie voix** (son d'origine r 0,55–1,78, parole ≈ 20,65–21,75) : « Bonsoir, bonsoir. » | Son d'origine + fond de rue. Pas de musique. |
| **21,85–25,05** · APPEL + BOUCLE | Gel r 2,00, poussée lente ×1,00 → ×1,04. Le sac marron est assombri de 25 %. | À 21,85, pastille ambre (x 90–930, y 1370–1530) : « Réponds-lui en commentaire : » (48 px) / « **BONSOIR ↓** » (88 px), avec une flèche dessinée vers le bas et un rebond. Le sous-titre « « Bonsoir, bonsoir. » » reste au-dessus : on voit à qui répondre. Mention. | **N6** (≈ 22,00–24,75) : « Réponds-lui en commentaire : bonsoir. » | « Pop » de la pastille (21,85). Fond de rue seul. **25,05 : coupe sur l'image 0** : la boucle repart sur la rue, puis sur le vrai « Bonsoir, bonsoir ». |

**Contrôle des blocs** (3 au plus + la mention) : accroche = titre, chrono, sous-titre ; STOP = tampon, question,
chrono ; réponse = titre, « écrit à la main », chrono ; vraie voix = sous-titre seul ; carte = plaque, phrase, trajet ;
appel = sous-titre, pastille.

**Tenue des textes** (≥ 1,4 s) : titre 0,00–7,00 · « écrit sur un colis » 4,55–7,00 · sous-titre R1 0,75–2,35 ·
« STOP ! » 7,00–8,45 · « TU L'AS VU ? » 7,15–9,45 · titre réponse 9,60–13,55 · sous-titre R2 13,85–16,00 · phrase de
service 16,10–20,60 · « Par bateau ou par avion. » 17,50–20,60 · sous-titre R1b 20,65–25,05 · pastille 21,85–25,05.

---

## 3. Voix

### 3.1 Script (prêt pour `data/script.json`)
Narratrice = voix femme habituelle (Kyutai TTS 1.6B, `unmute-prod-website/developpeuse-3`, réglages « diction claire »
de `serie/voice_cfg.json`). Les lignes R sont la vraie voix, extraite de `rush1/work/audio48.wav` : jamais de
changement de hauteur ni de vitesse.

```json
{"segments": [
  {"id": "R1",  "who": "vraie voix (celui qui filme)", "text": "Bonsoir, bonsoir.", "src": "audio48.wav r 0.00-1.78 (son d'origine continu), parole r 0.60-1.70", "film_start": 0.00},
  {"id": "N1",  "who": "narratrice", "text": "Trouve le mot Bonzini.", "tts": "Trouve le mot, Bonzini."},
  {"id": "N2",  "who": "narratrice", "text": "Il est écrit sur un colis.", "tts": "Il est écrit, sur un colis."},
  {"id": "N3",  "who": "narratrice", "text": "Stop ! Tu l'as vu ?", "tts": "Stop. Tu l'as vu ?"},
  {"id": "N4",  "who": "narratrice", "text": "Le mot Bonzini était là dès le début.", "tts": "Le mot Bonzini était là, dès le début."},
  {"id": "R2",  "who": "vraie voix (celui qui filme)", "text": "Merci de faire confiance à Bonzini Trading.", "src": "audio48.wav r 7.70-9.60, fondus 60/80 ms", "sync": "joué sur ses propres images r 7.62-9.62"},
  {"id": "N5",  "who": "narratrice", "text": "Avec Bonzini, tes colis vont de Chine à Douala.", "tts": "Avec Bonzini, tes colis vont de Chine, à Douala."},
  {"id": "R1b", "who": "vraie voix (celui qui filme)", "text": "Bonsoir, bonsoir.", "src": "audio48.wav r 0.55-1.78, fondus 40/60 ms", "sync": "joué sur ses propres images r 0.55-2.00"},
  {"id": "N6",  "who": "narratrice", "text": "Réponds-lui en commentaire : bonsoir.", "tts": "Réponds-lui en commentaire : bonsoir !"},
  {"id": "N6w", "who": "narratrice", "text": "Réponds-lui en message : bonsoir.", "tts": "Réponds-lui en message : bonsoir !", "note": "export statut WhatsApp seulement, remplace N6"}
]}
```

| id | Syllabes | Durée budget (syl ÷ 3,6 + 0,35) | Mots |
|---|---|---|---|
| N1 | 6 | 2,0 s | 4 |
| N2 | 8 | 2,6 s | 6 |
| N3 | 4 | 1,5 s (pause comprise) | 4 |
| N4 | 12 | 3,7 s | 8 |
| N5 | 14 | 4,25 s | 9 |
| N6 | 9 | 2,85 s | 5 |

Règles appliquées : une idée par phrase, sujet + verbe, 12 mots au plus ; aucun chiffre dit ; « Bonzini » jamais au
début d'une phrase (toujours « le mot Bonzini », « avec Bonzini ») ; aucun mot technique (ni « groupage », ni « fret »,
ni ville chinoise) ; aucune onomatopée dans la voix. Deux voix ne parlent jamais en même temps.

### 3.2 Mots qui doivent être compris (test d'écoute `serie/listen_test.py` sur le mix final, filtre téléphone)
- Narratrice (seuil ≥ 90 % des mots par ligne) : **mot, Bonzini** (N1, N4, N5), **écrit, colis** (N2, N5), **stop, vu**
  (N3), **début** (N4), **Chine, Douala** (N5), **réponds-lui, commentaire, bonsoir** (N6).
- Vraie voix (au mieux, sans retouche) : **bonsoir** (R1, R1b) ; **merci, confiance, Bonzini** (R2). « Trading » est
  le mot le plus fragile : le sous-titre le porte.
- Fond de rue de remplacement : **aucun mot** reconnu sur 1,78–7,00 ni sur 7,00–13,80.

---

## 4. Faits, sources et vérification des règles

### 4.1 Faits utilisés

| À l'écran / à la voix | Source |
|---|---|
| « Vraie vidéo · en Chine » | Rush (enseignes en chinois), `BRIEF.md`. La ville n'est jamais dite. |
| Le mot BONZINI est écrit à la main sur **un** colis | Visible : étiquette blanche, r 0,23–2,7 et r 5,9–9,9 ; planche `rush1/dir/labels.jpg`. |
| « Il était là dès le début » | Mesuré : suivi corrélé ≥ 0,8 dès r 0,00 ; lisible dès ≈ r 0,23 (`cd_rush1_participation/early_label.jpg`). L'image du zoom (r 1,00) est montrée avec le chrono à « 6 ». |
| « Vraie image · zoom × 4 » | Vrai par construction : agrandissement bicubique de l'image source, facteur réel ×4, aucune IA. |
| « Bonsoir, bonsoir. » | Vraie voix (`BRIEF.md`). |
| « Merci de faire confiance à Bonzini Trading. » | Vraie voix ; le nom est le plus probable (0,99 sur la voix débruitée) → **à confirmer par le patron avant sous-titrage**. Indice : la 2e ligne de l'étiquette ressemble à « TRADING » (non affirmé à l'écran). |
| « Avec Bonzini, tes colis vont de Chine à Douala. » · « Par bateau ou par avion. » | Service vérifié : groupage maritime et aérien Chine → Douala (`BRIEF.md`, règle 2). Dit sur une carte dessinée, sans image du rush. |
| « Bonzini Trading Cargo » | Nom officiel. |
| Hors vidéo (légende, réponses, commentaire épinglé) : pesé et mesuré à la réception en Chine · entrepôt au Foyer Balengou · la Chine a sept heures d'avance sur Douala | `BRIEF.md`, règle 2. Le décalage horaire est formulé en fait général, jamais comme l'heure du tournage. |

**Jamais affirmé** : la ville, la destination de la camionnette, à qui sont les colis, qui est l'employé, ce qui est
écrit sur son polo, l'heure du tournage, « notre entrepôt », « agent Bonzini », « ton colis est dedans », qu'on filme
chaque colis.

### 4.2 Contrôle règle par règle

| Règle | Comment elle est tenue |
|---|---|
| BRIEF 1 · compris au premier visionnage, avec et sans le son | Une ligne droite : mission → STOP → réponse → vraie voix → service → appel. Aucune métaphore. Tout ce qui est dit est écrit. La réponse est donnée dans la vidéo, en image (ellipse + mot violet) et en voix. Phrases de 4 à 9 mots, environ 3,6 syllabes par seconde. |
| BRIEF 2 · rien d'inventé | Voir § 4.1. La ligne de service est sur une carte, pas sur le rush. Les vraies lettres ne sont jamais retouchées ni redessinées (ellipse AUTOUR, mot propre seulement dans le titre). Aucune IA sur l'image. |
| BRIEF 3 · vocabulaire | Pas d'« envoyer », de « transfert », de « moins cher / premier / seul / gratuit / garanti / zéro risque ». Pas de douanier. « 5G SIM CARD » et les enseignes sont floutées. Le nom affiché est « Bonzini Trading Cargo » ; la vraie voix est citée telle quelle (« Bonzini Trading »). |
| BRIEF 4 · la vraie voix | Gardée entière, répétée une fois (R1b), jamais coupée en syllabes, jamais accélérée, ralentie, transposée ni passée à l'envers. Le rembobinage est muet (son synthétique). |
| BRIEF 5 · format et zones sûres | 1080 × 1920. Rien au-dessus de y 150 (mention à y 160). Aucun texte à droite de x 960 entre y 900 et 1560 (sous-titres et pastille dans x 80–940). Rien d'important sous y 1540 (pastille jusqu'à 1530). Le chrono (x 840–1010) est au-dessus de y 400. |
| DICTION 1–3 | Phrases complètes, courtes ; aucun mot technique ; aucun chiffre dit. |
| DICTION 4 | Aucune onomatopée dans la voix (« Stop » est un vrai mot, écrit à l'écran). |
| DICTION 5 | « Bonzini » toujours précédé d'un mot ; aucune ville chinoise. |
| DICTION 6 | Budgets au § 3.1 ; ≈ 25 s au total, sous les 45 s. |
| DICTION 8 | Chaque phrase dite est à l'écran mot pour mot (N2 en version courte « écrit sur un colis », mêmes mots). |
| DICTION 9 | Mot-clé de fin : **BONSOIR**, vrai mot simple, facile à taper. |
| PIPELINE · lisibilité | Corps ≥ 44 px, titres ≥ 96 px, chiffres du chrono 110 px ; 3 blocs au plus + la mention ; chaque texte tenu ≥ 1,4 s (liste au § 2). |
| Sécurité visuelle | Aucun flash blanc. Le chrono change une fois par seconde ; le rembobinage est un flou dans un seul sens ; le chiffre roule au lieu de clignoter. |
| Identité Bonzini | Violet seulement avec Bonzini (le mot du titre, l'ellipse, « Bonzini Trading », la plaque). Signature balafon quand l'ellipse entoure la vraie étiquette. Makossa tendue qui se coupe net au STOP puis repart en majeur avec la marque. Pas de musique pendant les 2 premières secondes. Ambre pour l'appel, orange pour le STOP et les 2 dernières secondes du chrono. Le margouillat est seulement sur la carte, jamais sur le vrai. La boucle revient sur l'image 0. **Ce n'est pas un épisode de « JE SAVAIS PAS. »** : pas de puce « n/5 », pas de tampon « MAINTENANT, TU SAIS. ». |
| Personnes | Le visage de l'employé n'est jamais visible ni net ; il n'est ni figé, ni ralenti, ni montré à l'envers, ni commenté. Accord écrit de l'employé et de celui qui filme avant publication. |
| Vie privée | Lignes sous BONZINI en mosaïque dès ×2 (et sur toutes les images figées zoomées). Plaques de voiture vérifiées à 1:1 de r 5,6 à 9,9 et floutées si lisibles. |

### 4.3 Problèmes soulevés par les juges → correction

| Juge | Problème | Correction dans ce storyboard |
|---|---|---|
| Viral | Carte de fin de 9,6 s sur une image floutée fixe | Carte de 4,8 s, animée (plaque, trajet qui se dessine, bateau, avion, margouillat), puis l'appel sur de **vraies images qui bougent**, avec la vraie voix. |
| Viral, compr. | Accroche de 4 lignes, jusqu'à 5 blocs | 2 lignes (« TROUVE LE MOT » / « BONZINI ») + chrono ; pastille « Trouve-le ! » supprimée ; la provenance est une petite mention. |
| Viral | Pas de phrase qui pousse à revoir | « Le mot Bonzini était là dès le début. » + retour éclair sur l'image r 1,00 (chrono à 6). |
| Viral | Épingler la réponse tue la recherche | Commentaire épinglé sans la réponse pendant 24 h (§ 6). |
| Viral, son | Entrée de musique molle | Makossa qui tombe d'un coup sec à 2,00. |
| Compr. | V1 trop rapide (≈ 4 syl/s) | N1 = « Trouve le mot Bonzini. » (6 syllabes) ; l'indice passe dans N2. |
| Compr. | Étiquette trop petite, jeu-piège | Indice N2 « Il est écrit sur un colis. », 2e chance de 2 s sur la camionnette, réponse toujours montrée et zoomée. |
| Compr. | Rembobinage, « ◀◀ », « zoom × 6 » en trop | Icône « ◀◀ » supprimée ; rembobinage réduit à 0,5 s, gardé parce qu'il porte la chute « dès le début » ; « zoom × 4 » vit dans la mention, pas dans un nouveau bloc ; une seule poussée continue. |
| Compr. | « Il t'a dit bonsoir » : il, c'est qui ? | La vraie voix « Bonsoir, bonsoir » est rejouée sur ses propres images, sous-titrée, juste avant « Réponds-lui en commentaire : bonsoir. » |
| Compr., faisab. | Coupe du « Merci » qui tronque | R2 = r 7,70–9,60 (creux mesuré avant le 2e « merci », fin de « Trading » comprise), fondus 60/80 ms. |
| Compr. | Ligne de service floue | « Avec Bonzini, tes colis vont de Chine à Douala. », dite et écrite, + « Par bateau ou par avion. » écrit. |
| Faisab. | Aucune mosaïque sur les lignes privées | Mosaïque dès ×2 et sur toute image figée zoomée. |
| Faisab. | Zoom ×6 = bouillie | ×4 au plus (≈ 495 px d'étiquette), sur l'image la plus nette mesurée (r 1,00), facteur réel affiché. |
| Faisab. | Fond de rue pris sur la queue de « Trading » | Fond de rue synthétisé (aucun bout de r 9,35–10,0, choc à 9,70–9,80 évité), validé par `listen_test`. |
| Faisab. | Commentaire épinglé donnant l'heure du tournage | Fait général : « Quand c'est le soir en Chine, à Douala c'est encore l'après-midi. » |
| Faisab. | « ces colis » au pluriel | « un colis » partout. |
| Faisab. | Margouillat sur le vrai | Seulement sur la carte kraft. |
| Faisab. | Nom « Bonzini Trading » non confirmé | Publication bloquée tant que le patron n'a pas confirmé (§ 5.8). |
| Faisab. (jeu, preuve) | Repasser les lettres = retoucher la preuve | Jamais : ellipse autour, mot propre dans le titre, flèche entre les deux. |
| Faisab. (jeu) | Indice « à côté du sac marron » pointe une marque possible | « en bas du colis noir du milieu » ; sac assombri dans les images figées. |
| Faisab. (son) | Son « réutilisable » poussé aux transitaires | Pas de défi de remix ; seul le son original créé par la plateforme, avec l'accord écrit de celui qui filme. |
| Tous | Autocollant feuille du scooter (lecture « cannabis ») et « 5G SIM CARD » | Flous doux cuits dans les images, r 2,9–5,6 ; plan à vitesse réelle, jamais ralenti. |

**Greffes retenues** : de « preuve », la mention « VRAIE VIDÉO », les vrais pixels sans IA, l'ellipse AUTOUR, le mot
propre seulement dans le titre, la mosaïque, le 2e commentaire épinglé sur les 7 heures ; de « jeu », la chute « dès le
début », l'épinglage différé, « Identifie un ami… » (Facebook, légende seulement), les réponses types ; de « son », la
musique qui tombe à 2,00, le motif de guitare « bon-soir, bon-soir », répondre « Bonsoir, bonsoir ! » à chaque
commentaire ; de « heure », la publication vers 19 h, heure de Douala.

**Écartées exprès** : « Ton colis en Chine, tu ne le vois pas » (laisse croire qu'on filme chaque colis) ; le chrono
qui monte et « écris ton chiffre » ; l'écran coupé et les horloges ; l'image saccadée ; le tampon « VU. » (lu comme
« contrôlé ») ; l'agrandissement par IA.

**Durée** : le juge viral visait ≈ 20 s. Avec 6 phrases à 3,6 syllabes par seconde, 3 passages de vraie voix et un jeu de
7 s, le minimum clair est ≈ 25 s. La fin n'est plus une image fixe (carte animée, puis vraies images). Si le test de
rétention chute après 20 s, première coupe : supprimer R1b et les images r 0,55–2,00 (−1,4 s), avec la pastille sur la
carte et N6 = « Il t'a dit bonsoir. Réponds-lui en commentaire. ».

---

## 5. Plan technique

Dossier de production : `rush1/prod/` (copie du squelette `serie/ep2/` : `overlay/render.mjs` avec injection TIMING,
`overlay/kit.js`, `scenes/02_light.js` (`softPath`), `40_gecko.js`, `60_type.js`, polices de `v3/assets/fonts/`,
`lib/tts_kyutai.py`, `lib/vocheck.py`, `lib/audio_ep2.py` comme modèle de mix).

### 5.1 Préparation des images (`prod/tools/prep_frames.py`, Python + OpenCV, une fois)
- Source : `rush1/src_frames/0000–0298.png` (464 × 832, image i = r i/30).
- **Agrandissement Lanczos ×2,3276** → 1080 × 1937, rogné en y 8–1928 → 1080 × 1920. Netteté douce (rayon 1,0 px,
  force 0,35). **Pas de Real-ESRGAN** : il invente des lettres sur l'étiquette (`rush1/dir/esr_vs_bic3.jpg`). Les images
  déjà calculées dans `rush1/up/` ne servent pas à cette vidéo.
- **Pas de stabilisation** : le tremblé est la preuve et la difficulté du jeu. Le seul moment stable est une image figée.
- **Étalonnage** cuit dans les images (le moteur n'a pas le droit à `ctx.filter`) : chaud et doux, ombres relevées de
  6 %, saturation +5 %, rouge du feu arrière gardé, pas de fausse nuit.
- **Masques cuits** dans les images : flou doux (gaussien, bords fondus) sur l'enseigne « 5G SIM CARD », les enseignes
  chinoises et l'autocollant feuille verte du scooter de r 2,9 à 5,6 (rectangles posés toutes les 3 images et
  interpolés) ; plaques de voiture de r 5,6 à 9,9 si elles se lisent à 1:1 ; sac marron assombri de 25 % sur r 2,00 et
  r 7,60 (images figées). On ne rend jamais plus net le polo.
- Sortie : `prod/assets/rush/f_0000…0298.jpg` (qualité 92).
- Grain : dans le moteur, tuiles de grain pré-calculées, tirage `rnd(i)` par image, sur tout le cadre (dessins compris).

### 5.2 Suivi de l'étiquette (fait)
`rush1/work/label_track.json` : par image, `x, y, w = 53, h = 25` (pixels source), `cc`, `sharp`, `ok` (cc ≥ 0,8).
Écran = source × 2,3276, y − 8. Les images `ok = false` (r 0,27–0,40, quand l'employé passe, et les filés) sont
interpolées. Sert à : l'ellipse violette suivie (r 7,62–9,62 et r 0,55–2,00), le centrage du zoom, le cadrage ×1,10 de
la vraie voix. Repères : r 1,00 → étiquette écran ≈ x 351–475, y 1160–1219 ; r 2,00 → x 328–452, y 1114–1172 ;
r 8,00 → x 638–764, y 1198–1252.

### 5.3 Calque du zoom (`prod/assets/zoom/r100_x4.png`)
- Image source 30 (r 1,00), recadrée autour de l'étiquette (source x 90–270, y 430–600), agrandie en **une seule passe
  bicubique ×9,31** (= ×2,3276 × 4), donc sans double rééchantillonnage.
- Mosaïque (blocs d'environ 22 px écran) sur tout ce qui est sous la ligne « BONZINI ». La ligne BONZINI est laissée
  telle quelle : aucune retouche, aucune lettre redessinée.
- Médiane alignée (ECC, r 0,93–1,07) : à essayer, gardée seulement si elle se lit mieux à 360 px. C'est peu probable,
  car l'image 30 est une image clé bien plus nette que ses voisines.
- Dans le moteur : image pleine à ×1, fondu vers ce calque entre ×1,4 et ×1,6.

### 5.4 Moteur (Canvas 2D de la série, rendu Chromium déterministe)
- Nouvelles scènes :
  - `05_rush.js` : correspondance temps du film → image du rush (ci-dessous), zoom, cadrage, filés, gel, secousse ;
  - `20_chrono.js` : anneau qui se vide, chiffre, passage à l'orange, chiffre qui roule de 0 à 6 ;
  - `30_ring.js` : ellipse au feutre suivie, flèche violette, halo par `shadowBlur` ;
  - `72_card.js` : plaque, trajet, bateau, avion, en reprenant les accessoires de `prix-de-revient/overlay/scenes/65_bonzini.js`,
    `70_outro.js` et du kit Kraft & Fil.
- Scènes réutilisées : `60_type.js` (plaque titre, tampon, sous-titres, pastille avec flèche dessinée),
  `40_gecko.js` (margouillat, carte seulement), `02_light.js` (vignettage, `softPath`).
- Correspondance film → rush (`r(t)`, image = round(r × 30), bornée à 0–298) :
  - [0 ; 2,90[ : r = t
  - [2,90 ; 3,15[ : r = 2,90 + 2 (t − 2,90)
  - [3,15 ; 4,65[ : r = 3,40 + (t − 3,15)
  - [4,65 ; 5,00[ : r = 4,90 + 2 (t − 4,65)
  - [5,00 ; 7,00[ : r = 5,60 + (t − 5,00)
  - [A.stop ; A.rew[ : r = 7,60 (gel)
  - [A.rew ; A.rew + 0,25[ : 7,60 → 5,70
  - [A.rew + 0,25 ; A.rew + 0,5[ : 2,80 → 1,00 (2 images de filé horizontal au raccord)
  - [A.zoom ; A.out + 0,15[ : r = 1,00 (gel + zoom)
  - [A.live ; A.live + 2,0[ : r = 7,62 + (t − A.live)
  - carte : r = 9,62 tenu sous le kraft
  - [A.cta ; A.cta + 1,45[ : r = 0,55 + (t − A.cta), puis gel sur r 2,00
- Rendu : `--mb 6` (flou de mouvement sur les filés et le rembobinage), `--pages 2`, `nice -n 5`. N = round(T.end × 30) ≈ 752.
- Tout est fonction pure de t ; aucun `Math.random`, aucun `ctx.filter`.

### 5.5 Ancres (contrat T / W de `serie/PIPELINE.md`)
Valeurs par défaut ; tout est recalé sur les vraies prises.

| Clé | Formule | Défaut (s) |
|---|---|---|
| T.R1 | fixe (son d'origine depuis r 0,00, parole ≈ 0,6) | 0,00 |
| T.N1 | fixe, après le coup de musique de 2,00 | 2,15 |
| T.N2 | fixe ; doit finir avant 6,85 (sinon prendre une prise plus courte, ≤ 3,8 syl/s) | 4,55 |
| A.stop | fin de la chasse (chrono réel de 7 s) | 7,00 |
| T.N3 | A.stop + 0,10 | 7,10 |
| A.rew | T.N3 + DUR.N3 | 8,35 |
| A.zoom | A.rew + 0,50 | 8,85 |
| A.ring (balafon) | A.zoom + 0,60 | 9,45 |
| T.N4 | A.ring + 0,20 ; flèche sur W(N4, 'bonz'), pulsation du chrono sur W(N4, 'début') | 9,65 |
| A.out | T.N4 + DUR.N4 + 0,20 | 13,55 |
| A.live | A.out + 0,25 (r 7,62) | 13,80 |
| T.R2 | A.live + 0,08 (extrait r 7,70) | 13,88 |
| A.card | A.live + 2,00 | 15,80 |
| T.N5 | A.card + 0,30 ; bateau sur W(N5, 'chine'), avion et margouillat sur W(N5, 'doua') | 16,10 |
| A.cta | T.N5 + DUR.N5 + 0,40 (motif de guitare dans l'intervalle) | 20,60 |
| T.R1b | A.cta (extrait r 0,55) | 20,60 |
| A.pill | A.cta + 1,25 | 21,85 |
| T.N6 | A.pill + 0,15 | 22,00 |
| T.end | T.N6 + DUR.N6 + 0,30 | 25,05 |

`SCORE.soundCues()` et `SCORE.music()` sont dérivés de ces clés (§ 5.6).

### 5.6 Son
- **Vraie voix** (depuis `audio48.wav`, pas la version 16 kHz) :
  - R1 = son d'origine r 0,00–1,78, fondu de sortie 60 ms ;
  - R2 = r 7,70–9,60, fondu d'entrée 60 ms, de sortie 80 ms ;
  - R1b = r 0,55–1,78, fondu d'entrée 40 ms, de sortie 60 ms.
  Débruitage léger (porte spectrale, −6 dB au plus), passe-haut 120 Hz, +2 à 3 dB de présence vers 3 kHz. Aucun
  changement de hauteur ni de vitesse. Le passage r 1,78–7,70 n'est **jamais** diffusé.
- **Fond de rue de remplacement** (à fabriquer : la séparation demucs ne l'a pas isolé, et r 9,70–9,80 contient un
  choc) : bruit filtré sur le spectre moyen de r 0,00–0,50, houle de circulation lente, un scooter lointain, aucune
  voix. Modèle : `room_bed()` de `serie/ep2/lib/audio_ep2.py`. Niveau calé sur la rue du rush (≈ −30 dBFS RMS) ;
  fondu croisé de 150 ms à r 1,78 ; baissé de 6 dB sous les extraits d'origine pour ne pas doubler la rue. Contrôle :
  `listen_test` sur le fond seul → aucun mot reconnu.
- **Musique** (`v3/lib/makossa.py`, 120 bpm : les tics du chrono tombent sur les temps 1 et 3) :
  - `silentUntil` 2,00 ;
  - `tenseFrom` 2,00, entrée sèche sur un temps fort ;
  - `cut` A.stop ;
  - `sigAt` A.ring (balafon `audio.py`, 2 notes qui montent) ;
  - `majorFrom` A.card + 0,15 ;
  - `end` A.cta, sur le motif de guitare seule « bon-soir, bon-soir » (2 + 2 notes, même contour que la voix).
  La musique est baissée de 12 dB sous la narratrice. Aucune musique sous les vraies voix ni dans l'appel.
- **Bruitages** (`soundCues`) :
  - tic de bois à 0, 1, 2, 3, 4, 5, 6 (5 et 6 plus forts) ;
  - whoosh à 2,90 et 4,65 ;
  - à A.stop : tampon (`sfx_big_stamp`) + buzzer doux ;
  - de A.rew à A.rew + 0,5 : rembobinage (`sfx_rewind` alimenté par du bruit ou de la musique, **jamais par le son du rush**) ;
  - souffle montant de A.zoom à A.ring, clic de mise au point à A.ring − 0,02 ;
  - feutre de A.ring à A.ring + 0,4 et sur W(N4, 'bonz') ;
  - whoosh retour à A.out ;
  - à A.card : papier (`sfx_paper_lift`) puis « tonk » de la plaque ;
  - feutre et petits « pop » sur W(N5, 'chine') et W(N5, 'doua') ;
  - « pop » de la pastille (`sfx_pill_drop`) à A.pill.
- **Mix** : −14 LUFS intégré, crête vraie ≤ −1 dBTP. Les 0,3 dernières secondes ne gardent que la rue, pour que la
  boucle reparte au calme.
- **TTS** : 3 prises par ligne, choix par `vocheck.py` (transcription automatique, sans écoute biaisée), puis `retime`.

### 5.7 Contrôles avant livraison
- Images de contrôle (`--times 0,0.9,4.0,7.3,8.6,9.2,11.0,14.6,18.5,21.0,23.5 --pages 2`), en pleine taille et
  réduites à 360 px de large, à 50 % de luminosité simulée. « BONZINI » doit se lire dans le calque ×4 à 360 px.
- `serie/listen_test.py` sur le mix final (seuils au § 3.2).
- Aucune image du rush entre r 2,9 et 5,6 ne passe à l'envers (vérifier les images de A.rew à A.rew + 0,5).
- Mosaïque présente sur toute image où l'étiquette dépasse ×2.
- Test de 5 commerçants (§ 1), une vue sans le son, puis une vue avec le son.

### 5.8 À faire valider par le patron (bloquant pour la publication)
1. Le nom dit par la vraie voix est bien « Bonzini Trading » (sinon : sous-titre corrigé, ou R2 sans sous-titre du nom).
2. **Accord écrit** de celui qui filme (sa voix est le son de la vidéo, rejouée une fois, et deviendra un « son
   original ») et de l'employé en polo rouge (son image, même de dos).
3. La 2e ligne de l'étiquette est-elle « TRADING » ? Si oui, on peut la laisser nette ; la 3e ligne reste en mosaïque
   dans tous les cas.
4. La formule « Avec Bonzini, tes colis vont de Chine à Douala. Par bateau ou par avion. »
5. L'appel « Réponds-lui en commentaire : bonsoir », et une personne qui répond « Bonsoir, bonsoir ! » pendant les
   24 premières heures, avec la réponse WhatsApp prête.
6. L'heure de publication (vers 19 h, heure de Douala).

---

## 6. Appel à l'action et texte de publication

**Mot-clé : BONSOIR.**
- À l'écran : pastille ambre « Réponds-lui en commentaire : BONSOIR ↓ ».
- À la voix : « Réponds-lui en commentaire : bonsoir. » (N6), juste après la vraie voix « Bonsoir, bonsoir ».
- Au Cameroun, on rend un bonsoir : c'est un geste social, pas un appât publicitaire. Le STOP « Tu l'as vu ? » produit
  en plus des commentaires spontanés (« oui, à 2 secondes », « impossible »), sans second appel.

**Variante statut WhatsApp** (pas de commentaires) : pastille « Réponds-lui en message : BONSOIR ↓ » et voix N6w
« Réponds-lui en message : bonsoir. ». Chaque réponse arrive en privé chez Bonzini et ouvre une conversation. La vidéo
(≈ 25 s) tient dans un statut.

**Réponse WhatsApp prête** (au mot BONSOIR, faits vérifiés seulement) :
> « Bonsoir ! Bonzini Trading Cargo : groupage par bateau ou par avion, de la Chine à Douala. En Chine, tes colis sont
> pesés et mesurés dès la réception. Entrepôt au Foyer Balengou, à Douala. »

**Commentaires épinglés**
- Pendant les 24 premières heures, sans la réponse : « Bonsoir, bonsoir ! Tu l'as trouvé à quelle seconde ? »
- Après 24 h : « Le mot était sur l'étiquette blanche, en bas du colis noir du milieu. Tu l'avais vu ? »
- 2e commentaire (fait général) : « Quand c'est le soir en Chine, à Douala c'est encore l'après-midi : la Chine a sept
  heures d'avance. »

**Réponses types**
- « Je l'ai pas vu » → « Regarde l'étiquette blanche, en bas du colis noir du milieu. Rejoue la vidéo ! »
- « C'est truqué ? » → « Non : c'est la vraie vidéo, filmée en Chine. Le zoom montre les vrais pixels. »
- Question de prix ou de délai → « Écris-nous sur WhatsApp, on te répond. » (jamais de prix ni de promesse en
  commentaire, jamais « on filme ton colis »).
- À chaque « bonsoir » : « Bonsoir, bonsoir ! » pendant 24 h.

**Légende du post (TikTok, Reels)**
> « Vraie vidéo, filmée en Chine. Le mot BONZINI est quelque part : tu l'as vu à quelle seconde ?
> Bonzini Trading Cargo · colis Chine → Douala · bateau ou avion · entrepôt au Foyer Balengou.
> #Douala #Mboppi #ImportChine #Commerçant »

**Facebook** : même légende, plus « Identifie un ami qui attend un colis de Chine. » (dans la légende seulement, jamais
dans la vidéo).

**Son original** : laissé tel que la plateforme le crée, titré « Bonsoir, bonsoir — Bonzini Trading Cargo », seulement
avec l'accord écrit de celui qui filme. Aucun défi de remix.

**Publication** : vers 19 h, heure de Douala (pic du soir ; répondre « bonsoir » devient naturel).

**Test A/B possible plus tard** (ne pas mélanger avec la version de base) : accroche « UN NOM EST ÉCRIT À LA MAIN SUR UN
COLIS. LEQUEL ? », pour que les commentaires contiennent la marque d'eux-mêmes.
