# « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) : voix v2, diction claire

Version finale du texte dit, après le retour du patron (« on ne comprend pas, il faut articuler, des mots simples, définir
avant d'utiliser »), les règles de `serie/DICTION.md`, le brouillon v2 et ses deux relectures (auditeur test de Mboppi ;
pédagogie et faits).

- **Fichier des voix** : `data/script_v2.json` (lu par `serie/tts_v2.py` et `serie/select_takes.py`).
- **En bref** :
  - 14 répliques : 12 pour la narratrice, 2 pour TOI ;
  - 130 syllabes, ≈ 44,8 s à 3,6 syllabes par seconde ;
  - mot-clé **CARTON**.
- **Mêmes images, même ordre.** Seuls les identifiants des répliques, les ancres de temps et quelques textes à l'écran changent.

---

## 1. Les répliques, dans l'ordre où elles sont dites

« = » dans la colonne `tts` : le texte envoyé à la synthèse est identique au texte affiché. « syll. » : syllabes dites, celles
qu'on compte pour le contrôle du débit (§2).

| id | qui | texte | tts | remplace | moment visuel (beat) | syll. |
|---|---|---|---|---|---|---|
| N1 | narratrice | Dans ce carton, tu paies de l'air. | = | N1 « Dans ce carton… tu paies de l'air. » | **ACCROCHE.** Le nuage AIR jaillit déjà à l'image 0, avec l'étiquette « À PAYER » et la plaque orange « DANS CE CARTON, TU PAIES DE L'AIR. ». Le margouillat sursaute. Pas de musique. La voix part à 0,3 s, après le POUF. Le « ka-ching » tombe juste après « air ». | 8 |
| T1 | TOI | Mais mon carton est léger ! | = | T1 (inchangée) | La plaque ambre de TOI se dresse avec sa pastille TOI. La makossa tendue entre. | 7 |
| N2 | narratrice | Dans le bateau, même léger, tu paies la place. | = | N2, 1re moitié (« Au bateau, on paie la place ») | **LE BATEAU.** La plaque en carton épais (pastille « LE BATEAU ») écrase celle de TOI **dans la pause avant la phrase** : le BOUM est à T.N2 − 0,3. La voix lit ensuite la plaque « MÊME LÉGER, TU PAIES LA PLACE. ». « Même léger » répond directement à TOI. | 11 |
| N2b | narratrice | La place se mesure en mètres cubes. | = | N2, 2e moitié (« le mètre cube ») | La plaque reste. Le tampon « EN MÈTRES CUBES (m³) » frappe le carton **juste après** « cubes ». Le mot technique arrive après l'idée simple, en fin de phrase, juste après « mesure ». | 9 |
| — | (silence) | | | | **LA MESURE**, muette, ≈ 1,7 s : trois claquements du mètre ruban, puis « LONGUEUR × LARGEUR × HAUTEUR » et « le carton entier » au feutre. Le tampon de la formule tombe 0,45 s avant N3. | — |
| N3 | narratrice | On mesure le carton entier. | = | N3, 1re moitié (« Le carton entier… ») | Fin de la mesure. La formule et « le carton entier » restent à l'écran pendant la phrase : on entend ce qui est écrit. | 8 |
| N3b | narratrice | Tu paies aussi le vide dedans. | = | N3, 2e moitié (« …même le vide dedans. ») | **LE VIDE.** Le flanc se soulève à T.N3b − 0,1 et la légende « TU PAIES AUSSI LE VIDE DEDANS. » arrive avec la phrase. Les hachures « VIDE » balaient l'intérieur à partir de « paies ». Le nuage AIR se pose après « vide ». Le « tic » tombe après « dedans ». | 8 |
| T2 | TOI | Donc, j'ai payé le bateau pour transporter de l'air ? | Donc, j'ai payé le bateau, pour transporter de l'air ? | T2 (« …j'ai payé le bateau pour transporter de l'air ?! ») | **LA PRISE DE CONSCIENCE** (« It's a clock »). La musique se coupe à T2 − 0,2. La petite plaque ambre transpire, le margouillat plisse les yeux, le grillon chante. La voix est étonnée mais **à volume normal** : le « petit » se voit sur la plaque, il ne s'entend pas. | 13 |
| N4 | narratrice | Parle à ton fournisseur. | = | N4, 1re moitié (« Demande à ton fournisseur ») | **LE BON CARTON.** La pastille fixe « CHEZ TON FOURNISSEUR » entre à T.N4 − 0,15. Pose 1 (les sandales se rangent tête-bêche) juste après « fournisseur », dans la pause. | 6 |
| N4b | narratrice | Demande des cartons bien remplis. | = (sans virgule) | N4, 2e moitié (« des cartons bien remplis ») | Pose 2 sur « cartons » : les parois se resserrent et le carton rapetisse. Pose 3, le scotch kraft (ASMR), juste après « remplis ». Puis, dans la pause, le nuage AIR est chassé et le margouillat le gobe. | 8 |
| N5 | narratrice | Un carton plus petit, c'est moins de mètres cubes. | = | N5 (« Moins de vide… moins de mètres cubes. ») | **AVANT / APRÈS** à T.N5 − 0,1, avec la makossa en majeur. Les jauges se remplissent sans aucun chiffre. On voit le grand carton contre le petit : la voix dit enfin la cause qu'on voit. Le « hic » du margouillat vient après la phrase. | 12 |
| N6 | narratrice | Mais protège ce qui peut casser. | = | N6 (« Enlève le vide… pas la protection. ») | Le verre emballé dans le papier bulle, à côté du petit carton. Le papier bulle s'enroule de « protège » à la fin de « casser », puis le « plop ». Suit le bandeau muet « ENSUITE : » (garder au moins 0,5 s entre la fin de N6 et N7). | 8 |
| N7 | narratrice | Chez Bonzini Trading Cargo, tes cartons sont mesurés en Chine. | = (aucune virgule ajoutée) | N7 (« …mesurés dès la réception en Chine. ») | **BONZINI.** La lumière violette et la signature au balafon arrivent **avant** « Chez ». La plaque émaillée tombe, avec le tonk et l'étiquette, **après** « Cargo ». Le scan part sur « cartons », le mètre ruban sur « sont », « VOLUME : • m³ » s'affiche sur « mesurés » et AIR est barré. Le tampon « MESURÉ ✓ » tombe 0,2 s **après** « Chine ». | 17 |
| N8 | narratrice | Écris le mot CARTON en commentaire. | Écris le mot carton, en commentaire. | N8, 1re phrase (« Écris CBM en commentaire. ») | Carte de fin : le logo et « Cargo bateau et avion · Chine → Douala · Entrepôt : Foyer Balengou ». La pastille « Écris CARTON en commentaire ↓ » arrive juste avant le mot « carton ». | 10 |
| N8b | narratrice | Maintenant, tu sais. | = | N8, 2e phrase (« Maintenant, tu sais. ») | Le tampon rituel « MAINTENANT, TU SAIS. » tombe 0,3 s **avant** la voix, qui le lit ensuite. Le grand carton fermé de l'image 0 tremble pour la boucle. | 5 |

**Vérification des règles DICTION** :
- **Longueur** : chaque réplique fait 10 mots au plus et a un sujet et un verbe (les impératifs comptent).
- **Une idée par phrase** : N6 ne donne plus qu'un ordre.
- **Mots interdits** : aucun « … », aucun chiffre, aucune onomatopée, aucune ville chinoise, aucun sigle. « Bonzini » vient toujours après « Chez ».
- **Vocabulaire** : seulement « payer » ; jamais « transfert », « envoyer », « moins cher », « garanti » ni « gratuit ».
- **Faits** : aucun fait nouveau. « Même léger, tu paies la place » est vrai pour le bateau, facturé au m³ (`src/lib/cargoQuote.ts`, `per_cbm`). On ne dit pas « pas le poids », qui serait faux pour l'avion, facturé au kilo.

---

## 2. Fabrication des voix : contrôler chaque prise (le texte seul ne règle pas le débit)

Les anciennes prises de la même voix allaient à 5,4–7 syllabes par seconde : N4 ≈ 7, T2 ≈ 6,8. Le labo mesure 4,2–5,0
syl/s pour le débit naturel de la voix. Le texte ci-dessus est écrit pour 3,6 syl/s.

1. **Fenêtre de débit, prise par prise** : syllabes (colonne « syll. ») ÷ durée parlée (`takes.json` `dur`) entre
   **3,6 et 4,0 syl/s**.
   - Au-dessus de 4,0 : régénérer plus lentement (`padding_bonus`), ou étirer sans changer la hauteur avec
     `serie/retime.py ep2 --stretch N7=1.2,…` (facteur 1,10 à 1,30 ; Rubber Band au mixage).
   - Sous 3,6 : la prise est acceptée seulement si le film reste ≤ 45 s (§6).
2. **Durée parlée minimale (= 4,0 syl/s)** :

   | Réplique | N7 | T2 | N5 | N2 | N8 | N2b | N1, N3, N3b, N4b, N6 | T1 | N4 | N8b |
   |---|---|---|---|---|---|---|---|---|---|---|
   | Durée minimale | 4,25 s | 3,25 s | 3,0 s | 2,75 s | 2,5 s | 2,25 s | 2,0 s | 1,75 s | 1,5 s | 1,25 s |
3. **Mots qui doivent être reconnus**. Le contrôle passe par `serie/select_takes.py` / `voice_score.py` : ASR « small », filtre téléphone, musique à 10 dB. Une prise qui rate un mot de cette liste est rejetée.

   | Réplique | Mots à entendre | Rejeter si on entend |
   |---|---|---|
   | N1 | « de l'air » | |
   | T1 | « léger » | |
   | N2 | « même léger », « place » | |
   | N2b | « mètres cubes » | « maître » |
   | N3 | « carton entier » | |
   | N3b | « le vide » | |
   | T2 | « j'ai payé » ; l'intonation de question doit monter | « j'y payais » |
   | N4 | « fournisseur » | |
   | N4b | « bien remplis » | |
   | N5 | « plus petit », « mètres cubes » | |
   | N6 | « peut casser » | |
   | N7 | « Bonzini » **et** « Chine » | « bondini / bonsigny », « en chez / en cheveux » |
   | N8 | « carton », bien isolé | |
   | N8b | « tu sais » | |
4. **T2** : la ligne n'est plus baissée au mixage (`R.VOX_TRIM = {}` dans `lib/audio_ep2.py`, déjà en place : à garder).
5. **N8** : générer deux variantes du champ tts et garder celle où l'ASR isole le mieux « carton », sans intonation d'énumération plate.
   - **A** (dans le JSON) : « Écris le mot carton, en commentaire. ». La virgule après « carton » met le mot en fin de groupe, là où le français place l'accent.
   - **B** : « Écris le mot, carton, en commentaire. »
6. **N7** : essayer les versions du champ tts dans cet ordre, et prendre la première qui fait reconnaître « Bonzini » et « Chine ». Ne **jamais** changer l'ordre des mots (les ancres en dépendent).
   - **A** (dans le JSON) : sans virgule.
   - **B** : « …sont mesurés en Chine, », avec une virgule finale qui fait tenir la dernière syllabe.
   - **C** : « …sont mesurés, en Chine. »
7. **Après le mixage** : `python3 serie/listen_test.py ep2 audio/mix.wav`. Chaque réplique doit atteindre au moins 90 %, et les mots du point 3 doivent être reconnus.

---

## 3. Textes à l'écran : ce qui change

| Élément | Avant | Après | Où dans le code |
|---|---|---|---|
| Plaque LE BATEAU | `['AU BATEAU, ON PAIE', 'LA PLACE :', 'LE MÈTRE CUBE.']`, emph 1 | `['MÊME LÉGER,', 'TU PAIES', 'LA PLACE.']`, **emph 2** (bande orange sur « LA PLACE. ») | `01_score.js` `PLATE_TXT.bateau`. La pastille « LE BATEAU » dit où. La plaque est lue pendant N2, puis reste pendant N2b. |
| Tampon sur le carton | « AU m³ » | « EN MÈTRES / CUBES (m³) » sur 2 lignes, ≈ 80 px, avec le « 3 » en exposant comme aujourd'hui | `30_carton.js` `stampM3()` (texte codé en dur `'AU m'` + `'3'`, lignes 445–454) ; `01_score.js` `TEXTS` id `'m3'` → `'EN MÈTRES\|CUBES (m³)'` ; version de secours dans `60_type.js` `world()`, style `stampM3` : découper sur `'\|'` et passer de 104 à ≈ 80 px. Le tampon doit tenir sur la face avant (≈ 600 px). Il apprend « m³ » à l'œil avant « VOLUME : • m³ ». |
| Légende du vide | `'LE *VIDE*,\|TU LE PAIES AUSSI.'` | `'TU PAIES AUSSI\|LE *VIDE* DEDANS.'` | `01_score.js` `TEXTS` id `'capVide'` (son départ change, §7.2). |
| Petite plaque de TOI | `["…J'AI PAYÉ LE BATEAU", 'POUR TRANSPORTER', "DE L'AIR ?!"]` | `["J'AI PAYÉ LE BATEAU", 'POUR TRANSPORTER', "DE L'AIR ?!"]` | `01_score.js` `PLATE_TXT.toiSmall`. Seul le « … » part. C'est une version courte de T2, avec les mêmes mots. Avec « DONC, », la ligne 1 passerait à 25 caractères et réduirait toute la plaque (`uni: 1`) à ≈ 55 px. |
| Légende N5 (AVANT / APRÈS) | `'MOINS DE VIDE\|= *MOINS DE m³*'` | `"UN CARTON *PLUS PETIT*,\|C'EST MOINS DE\|^*MÈTRES CUBES*."` | `01_score.js` `TEXTS` id `'capN5'`. Avec `fit()`, les 2 petites lignes font ≈ 62 px (la ligne 1 a 21 caractères) et la grande ligne ≈ 100 px. Le bloc reste au-dessus des étiquettes AVANT / APRÈS (y ≈ 712). |
| Légende N6 | `'ENLÈVE LE VIDE,\|*PAS LA PROTECTION*.'` | `'MAIS *PROTÈGE*\|*CE QUI PEUT CASSER*.'` | `01_score.js` `TEXTS` id `'capN6'` (≈ 72 px). |
| Légende Bonzini | `'TES CARTONS, *MESURÉS*\|DÈS LA RÉCEPTION EN CHINE'` | `'TES CARTONS SONT\|*MESURÉS* EN CHINE.'` | `01_score.js` `TEXTS` id `'capBZ'`, style `captionBZ`. Les lignes font 16 et 18 caractères : le texte sort plus gros qu'avant. |
| Ligne de services (fin) | `'Groupage mer et air · Chine → Douala\|Entrepôt : Foyer Balengou'` | `'Cargo bateau et avion · Chine → Douala\|Entrepôt : Foyer Balengou'` | `01_score.js` `TEXTS` id `'service'` (dessinée par `76_end.js` `BZ_end`). « Air » n'a plus deux sens juste après la leçon, et « groupage » (jargon jamais défini) disparaît. C'est le même service vérifié : l'épisode 3 dit déjà « bateau ou avion ». |
| Pastille d'appel | `'Écris CBM en commentaire'` | `'Écris CARTON en commentaire'` | `01_score.js` `TEXTS` id `'cta'`. Dans `76_end.js` : la valeur de secours `'CBM'` de la regex (ligne 88) devient `'CARTON'` ; mettre aussi à jour les commentaires des lignes 8 et 14–15. **Largeur** : `BZ_ctaPill` fait ≈ 820 px pour un mot de 5 lettres, donc ≈ 865 px pour CARTON (x ≈ 108–973). La pastille dépasse x = 960 entre y 856 et 960, dans la zone interdite 900–1560. Dessiner la pastille à l'échelle 0,92 (≈ 795 px, x 142–938) ou monter `G.end.ctaY` à 845 au plus (vérifier l'écart avec le tampon rituel à y 676). |
| Ligne de partage (sur le carton de la boucle) | `'Tague celui qui\|remplit ses cartons\|de papier'` | `"Montre ça\|à celui qui\|paie de l'air"` | `01_score.js` `TEXTS` id `'tag'` (style `tagHand`, Shantell 50 px). Commentaires à mettre à jour : `76_end.js` lignes 9 et 102 ; `MODULES.md` ligne 224. « Tague » était un anglicisme. Surtout, l'ancienne ligne se moquait du papier, alors que la protection, c'est souvent du papier. |

**Inchangés** (à l'écran seulement, la voix ne les dit pas, ou les dit déjà avec les mêmes mots) :
- la puce « JE SAVAIS PAS. · 2/5 » ;
- « À PAYER », « AIR », « VIDE » ;
- « LONGUEUR × LARGEUR × HAUTEUR » et « le carton entier » (N3 dit maintenant ces mots) ;
- la pastille « CHEZ TON FOURNISSEUR » et la légende `capN4` `'DEMANDE À TON FOURNISSEUR :|^DES CARTONS|^*BIEN REMPLIS*.'`.
  Tous ses mots sont dits dans N4 + N4b ; la version « PARLE À TON FOURNISSEUR : DES CARTONS… » du brouillon n'avait plus de verbe d'action ;
- « AVANT », « APRÈS », « ENSUITE : », « VOLUME : • m³ », « BZ-482913 · exemple », « MESURÉ ✓ » ;
- « BONZINI TRADING CARGO » et « MAINTENANT, TU SAIS. ».

**Hors écran, à aligner** (même chaîne mot-clé → réponse ; voir §5) :
- `serie/SERIE.md`, lignes 37, 59, 68, 70, 236, 251, 254, 263, 269, 271, 272, 276–289, 290–302, 340–351, 357, 367, 370–372 ;
- `ep2/README.md`, lignes 55, 90–92, 100 et 102 ;
- `ep2/MODULES.md`, lignes 106, 219, 222 et 224.

---

## 4. Définitions ajoutées (un mot difficile est expliqué avant d'être employé)

- **« la place »** : l'idée simple vient d'abord (N2, « tu paies la place »). Elle est dite et écrite sur la plaque pendant qu'on l'entend.
- **« mètre cube »** :
  - **ordre** : il arrive après son idée simple, dans N2b « La place se mesure en mètres cubes. ».
  - **place dans la phrase** : en fin de phrase, juste après « mesure ». Il n'est jamais en début de phrase : dans le labo, « Le mètre cube… » est entendu « le maître cube » dans les 5 réglages de voix.
  - **à l'écran** : au même moment, le tampon « EN MÈTRES CUBES (m³) » l'écrit sur le carton.
- **« m³ »** : écrit seulement, jamais dit. Le tampon l'apprend avant la lecture « VOLUME : • m³ » de la partie Bonzini.
- **« le carton entier »** : dit par N3 pendant que la formule LONGUEUR × LARGEUR × HAUTEUR et « le carton entier » sont à l'écran.
  - On n'a pas choisi « tout le carton » : à l'oreille, on entendrait « tous les cartons », ce qui changerait le sens.
- **« le vide »** : montré (hachures « VIDE »), puis dit (N3b) et écrit (légende).
- **« même léger »** : répond à TOI. Dans le bateau, le poids léger ne sauve pas. La phrase est vraie pour le bateau, et on ne dit rien de l'avion.
- **« bien remplis »** : précisé par N5 « Un carton plus petit, c'est moins de mètres cubes ».
  - Bourrer un carton de papier ne réduit pas ses mètres cubes : seul un carton plus petit pour la même marchandise le fait.
  - Ce fait n'était pas dit dans l'ancienne N5 « Moins de vide… moins de mètres cubes ». L'image AVANT / APRÈS le montrait déjà.
- **« la protection »** (mot abstrait) devient « ce qui peut casser », un mot concret que le verre dans le papier bulle montre.
  - « peut » évite deux fausses lectures : « c'est déjà cassé » et « ce qu'il casse ».
- **« dès la réception »** (ambigu) : retiré. On dit « mesurés en Chine ».
- **« CBM »** (sigle à épeler) : retiré de la voix et de l'écran. Il reste seulement dans le commentaire épinglé, défini : « sur les devis, on l'écrit aussi CBM ».
- **« groupage », « tague »** (jargon) : retirés de la carte de fin.

---

## 5. Mot-clé et publication

**Mot-clé : CARTON.** C'est un vrai mot, facile à dire et à taper, et c'est l'exemple même de DICTION, règle 9.

À recopier dans `SERIE.md` › Épisode 2 › Publication :

- **Réponse WhatsApp à préparer**, sans aucun prix :
  - comment mesurer ton carton (longueur × largeur × hauteur, en mètres, le carton entier) ;
  - le rappel « des cartons bien remplis : un carton plus petit, c'est moins de mètres cubes ; mais protège ce qui peut casser » ;
  - le contact Bonzini Trading Cargo.
- **Texte de publication** :
  > Ton carton est léger ? Dans le bateau, même léger, tu paies la place : les mètres cubes. Le vide dedans aussi.
  > Demande à ton fournisseur des cartons bien remplis. Un carton plus petit, c'est moins de mètres cubes. Mais protège ce qui peut casser.
  > Chez Bonzini Trading Cargo, tes cartons sont mesurés en Chine.
  > Écris CARTON en commentaire : on t'explique comment mesurer ton carton.
  > Montre ça à celui qui paie de l'air.
  > #Cargo #ImportChine #Douala #Mboppi #Bateau
- **Commentaire épinglé** :
  > Le mètre cube, c'est la place de ton carton dans le bateau : longueur × largeur × hauteur, en mètres, du carton entier (pas seulement de la marchandise). Sur les devis, on l'écrit aussi « CBM » ou « m³ ». Un carton plus petit, c'est moins de mètres cubes. Mais protège ce qui peut casser.

C'est à l'écrit qu'on relie m³ et CBM : les commerçants verront « CBM » sur leurs devis.

---

## 6. Durée estimée : ≈ 44,8 s (au plus 45 s)

**Calcul** : 130 syllabes ÷ 3,6 = 36,1 s de parole, plus 8,65 s de pauses et de moments muets. Le tableau ci-dessous
donne ces pauses ; ce sont elles que codent les valeurs par défaut du §7.1. Une simulation calée sur les ancres du §7
donne une fin à **44,76 s**.

| avant… | pause | ce qui s'y passe |
|---|---|---|
| N1 | 0,30 | le POUF seul |
| T1 | 0,35 | « ka-ching » après « air », la plaque de TOI se dresse |
| N2 | 0,50 | ombre, chute, BOUM, lettres qui giclent |
| N2b | 0,35 | — |
| N3 | 1,70 | tampon m³, la plaque sort, la mesure muette, le tampon de la formule |
| N3b | 0,35 | le flanc se soulève |
| T2 | 0,45 | la musique se coupe, le grillon |
| N4 | 0,35 | — |
| N4b | 0,45 | pose 1 (sandales) |
| N5 | 0,75 | scotch ASMR, le nuage chassé puis gobé |
| N6 | 0,45 | « hic » |
| N7 | 0,60 | ENSUITE, la lumière violette, la signature balafon |
| N8 | 1,00 | « MESURÉ ✓ » tenu 1,45 s ; la carte de fin entre 0,65 s après le début de N8 |
| N8b | 0,55 | le tampon rituel, puis la voix |
| fin | 0,50 | l'accord final après « sais » |

**Selon le débit des prises** :
- si les répliques sont recalées avec ces pauses (§7.1) : ≈ 42,9 s à 3,8 syl/s et ≈ 41,2 s à 4,0 syl/s ;
- à 3,5 syl/s, le film passerait à 45,8 s : c'est pourquoi le débit des prises doit rester entre 3,6 et 4,0 syl/s (§2) ;
- le film dépasse les 20–35 s de `BRIEF.md`, mais `DICTION.md`, plus récent et tiré du retour du patron, autorise 45 s.

**Si le recalage donne plus de 45 s**, couper dans cet ordre :
1. T2 sans « Donc, » : −0,4 s. La plaque ne change pas.
2. `T.N8 = A.measured + .6` : −0,2 s. La pastille arrive alors juste sur « carton ».
3. Fusionner N4 et N4b en « Demande à ton fournisseur des cartons bien remplis. » : −0,45 s. Dans ce cas, `A.pose1 = W('N4','fournisseur')`, et cette prise doit rester à 4,0 syl/s au plus.

---

## 7. Notes pour l'intégrateur visuel

Les images sont les mêmes, dans le même ordre. Les ids de la voix passent de 10 à 14 : N2b, N3b, N4b et N8b s'ajoutent,
et les ancres dérivées sont recâblées sur eux. `data/script.json` doit être remplacé par `data/script_v2.json` (ou copié
dessus) avant `retime.py` et `listen_test.py`, qui lisent l'ordre des répliques dans `script.json`.

### 7.1 Valeurs par défaut de `T` et `DUR` (`01_score.js`, lignes 20–21)
`retime.py` garde l'espacement de ces valeurs par défaut. Ce sont donc elles qui codent les pauses du §6. Elles sont
calculées à 3,6 syl/s : avec des prises plus rapides, les pauses s'allongent ; elles ne raccourcissent jamais.
```js
const T = { N1: .3, T1: 2.87, N2: 5.32, N2b: 8.72, N3: 12.92, N3b: 15.49, T2: 18.17, N4: 22.13, N4b: 24.24, N5: 27.22, N6: 31.0, N7: 33.82, N8: 39.54, N8b: 42.87, end: 44.76 };
const DUR = { N1: 2.22, T1: 1.94, N2: 3.06, N2b: 2.5, N3: 2.22, N3b: 2.22, T2: 3.61, N4: 1.67, N4b: 2.22, N5: 3.33, N6: 2.22, N7: 4.72, N8: 2.78, N8b: 1.39 };
```
**Recommandé** : une fois les prises choisies, réécrire ces valeurs par défaut avec les vraies durées et les pauses du §6. On a
alors `T.X = END(précédente) + pause`, et le film dure Σ des durées + 8,65 s.

**À corriger dans `serie/retime.py`** : `tail = max(1.2, …)` impose au moins 1,2 s après la dernière réplique, soit
+0,7 s ici et ≈ 45,5 s au total. Ajouter une option `--tail-min 0.5` pour l'épisode 2, ou corriger ensuite `end` dans
`timing.json` à `max(END(N8b) + .5, A.stampEnd + 1.45)`. Le tampon rituel tombe maintenant **avant** N8b, donc une longue
queue ne sert plus à rien.

### 7.2 Temps d'action dérivés (`A`, `01_score.js`, lignes 61–127) : avant → après

La règle générale vient de la relecture P1 : **un son fort (pistes `hit`, `asmr`, `brand`) ne commence jamais à l'intérieur
d'un mot**. On le place à la fin du mot (`WE + .03`) ou dans une pause. L'image peut rester sur le mot, ou annoncer la
phrase juste avant.

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `A.hop` | `T.N1 + .05` | `Math.max(.05, T.N1 - .25)` | le sursaut reste sur le POUF (≈ 0,05 s), alors que la voix part maintenant à 0,3 s |
| `A.burstPeak` | `T.N1 + .4` | `T.N1 + .2` | garde le pic du nuage à ≈ 0,5 s : l'image 0 ne change pas |
| `A.kaching` (nouveau) | (son à `burstPeak − .1`, sur « carton ») | `WE('N1','air') + .05` | le ka-ching ponctue « de l'air » au lieu de couvrir « Dans ce carton » |
| `A.bateauFall` | `W('N2','place')` | `T.N2 - .3` | BOUM et écrasement dans la pause AVANT N2 ; la voix lit ensuite la plaque |
| `A.bateauShadow` | `T.N2 + .15` | `A.bateauFall - .25` | l'ombre précède toujours la chute |
| `A.stampM3` | `W('N2','cube')` | `WE('N2b','cube') + .03` | le tampon frappe après « cubes », le mot qu'on entendait « maître cube » |
| `A.bateauOut` | `max(END('N2') - .05, bateauFall + 1.45)` | `Math.max(A.stampM3 + .15, A.bateauFall + 1.45)` | la plaque reste pendant N2 et N2b et sort juste après le tampon |
| `A.mes0` | `bateauOut + .35` | `A.bateauOut + .2` | mesure muette ≈ 1,7 s. `GAP`, `mes1`, `mes2` et `formula` gardent leur formule (calée sur `T.N3`) |
| `A.flank` | `T.N3 - .1` | `T.N3b - .1` | |
| `A.hatch0` | `W('N3','carton') + .15` | `W('N3b','paies') + .15` | |
| `A.vide` | `W('N3','vide')` | `W('N3b','vide')` | `cloudSettle = vide + .2` ne change pas |
| `A.videTic` (nouveau) | (`'tic'` à `A.vide`) | `WE('N3b','dedans') + .05` | le « tic » sort du mot « vide ». `fill_fffff` s'arrête au tic suivant (`nxt('tic')`), donc il couvre la phrase : le baisser (§7.3) |
| `A.formulaOut` | `max(hatch0 + .35, mes2 + 1.45)` | `Math.max(T.N3b - .05, A.mes2 + 1.45)` | la formule reste pendant N3, qui la lit, et sort quand N3b commence |
| `A.capVide` | `max(hatch0 + .45, formulaOut + .18)` | `Math.max(A.flank + .2, A.formulaOut + .18)` | la légende arrive avec N3b et tient ≈ 2,3 s (≈ 1,5 s sinon, trop juste quand on recale) ; elle ne croise jamais la formule |
| `A.pose1` | `W('N4','ton')` | `WE('N4','fournisseur') + .03` | le pliage tombe dans la pause entre N4 et N4b |
| `A.pose2` | `max(W('N4','cartons'), pose1 + .75)` | `Math.max(W('N4b','cartons'), A.pose1 + .75)` | l'image tombe sur « cartons » ; ses sons sont baissés (§7.3) |
| `A.pose3` | `max(W('N4','remplis'), pose2 + .75)` | `Math.max(WE('N4b','remplis') + .05, A.pose2 + .75)` | le scotch ASMR, jamais baissé au mixage, passe après la phrase |
| `A.chase` | `min(pose3 + .2, split - .45)` | `Math.min(A.pose3 + .15, A.split - .5)` | |
| `A.gulp` | `chase + .55` | `A.chase + .45` | garde `gulp ≤ split` (ordre vérifié par le QA) avec 0,75 s entre N4b et N5 |
| `A.hic` | `gauge1 + .55` | `Math.max(END('N5') + .05, A.gauge1 + .55)` | le « hic » sort de « mètres cubes » |
| `A.glass` | `T.N6 + .05` | `T.N6 - .1` | le « pop » du verre tombe avant « Mais » |
| `A.wrap0` | `W('N6','pas') - .15` | `W('N6','protege') - .15` | |
| `A.wrap1` | `max(wrap0 + .5, W('N6','protection') + .35)` | `Math.max(A.wrap0 + .5, WE('N6','casse') + .05)` | le « plop » (piste `hit`) arrive après « casser » ; le préfixe `casse` trouve bien « casser » |
| `A.violet` | `max(T.N7 - .15, ensuite + .25)` | `Math.max(T.N7 - .25, A.ensuite + .25)` | la règle « jamais avant ENSUITE » reste |
| `A.sig` | `W('N7','bonzini') - .05` | `A.violet` | signature au balafon AVANT « Chez ». Sur « Bonzini », ses notes (1,3–1,7 kHz) masquaient le nom, et le bus `brand` y était baissé de 12 dB |
| `A.plateBZ` | `W('N7','bonzini')` | `WE('N7','cargo') + .03` | la plaque émaillée et le tonk tombent dans la pause après « Cargo, » |
| `A.label` | `violet + .3` | `A.plateBZ + .02` | le `label_slap` part avec le tonk, hors de « Bonzini » |
| `A.measured` | `max(WE('N7','mesures') + .1, airStrike + .3)` | `Math.max(WE('N7','chine') + .2, A.airStrike + .3)` | 0,2 s de silence après « Chine » avant le tampon : il ne tombe plus sur « en Chine » |
| `A.stampEnd` | `W('N8','maintenant') - .1` | `T.N8b - .3` | le tampon tombe, puis la voix le lit |
| `T.end` (contrainte) | `≥ W('N8','maintenant') + 1.55` | `≥ Math.max(END('N8b') + .5, A.stampEnd + 1.45)` | l'accord final (`end − .5`) tombe après « sais » |

**Inchangés** : `titleOut`, `toiUp`, `GAP`, `mes1`, `mes2`, `formula`, `hatch1`, `cloudSettle`, `cut`, `toiSmall`,
`toiSmallOut`, `repack`, `split`, `gauge0`, `gauge1`, `splitOut`, `ensuite`, `ensuiteOut`, `arrive`, `capBZ`, `scan`,
`tape`, `volume`, `airStrike`, `endcard`, `cta`, `loop` et `out`. Les ancres de N7 (`tes`, `cartons`, `sont`, `mesures`)
restent valables.

**Valeurs attendues** (simulation à 3,6 syl/s, avec les valeurs par défaut du §7.1) :
- **Accroche et bateau** : `bateauFall` 5,02 ; `stampM3` 11,25 ; `bateauOut` 11,40 ; `mes0` 11,60 ; `formula` 12,47.
- **Le vide** : `flank` 15,39 ; `formulaOut` 15,44 ; `capVide` 15,62 ; `cut` 17,97.
- **Le bon carton** : `pose1` 23,83 ; `pose2` 25,08 ; `pose3` 26,52 ; `gulp` 27,07 ; `split` 27,12.
- **Verre et ENSUITE** : `hic` 30,60 ; `wrap1` 33,27 ; `ensuite` 33,32.
- **Bonzini** : `sig` = `violet` 33,57 ; `plateBZ` 36,07 ; `measured` 38,74.
- **Fin** : `endcard` 40,19 ; `cta` 40,34 ; « carton » de N8 à 40,65 ; `stampEnd` 42,57 ; fin 44,76.

**Tenues des textes clés** :
- toutes les tenues font au moins 1,45 s :
  - légendes : `capVide` 2,31 ; `capN5` 3,45 ; `capN6` 2,09 ; `capBZ` 3,97 ;
  - plaques : LE BATEAU 6,38 ; plaque BZ 4,12 ;
  - tampons et textes : tampon m³ 4,14 ; formule 3,22 ; « MESURÉ ✓ » 1,45 ; MAINTENANT 2,07 ;
- même à 4,0 syl/s, la plus courte reste ≥ 1,45 s (`capN6` 1,87) ;
- le bandeau ENSUITE est lisible ≈ 0,45 s, comme avant.

### 7.3 Sons (`soundCues()`, lignes 466–484)
**Cues déplacés ou baissés** :
- `q(A.burstPeak - .1, 'kaching_soft', .55, -.2)` → `q(A.kaching, 'kaching_soft', .55, -.2)`.
- `q(A.vide, 'tic', .6)` → `q(A.videTic, 'tic', .6)`, et `q(A.hatch0, 'fill_fffff', .6)` → gain **.3**. Son souffle couvrait le « v » de « vide ».
- Pose 2, sous « cartons » : `cutter` .7 → **.4**, `carton_fold` .8 → **.5**, `pffuit` .6 → **.35**.
- `sweat_drop` : les deux « plic », aujourd'hui à `toiSmall + 1.1` et `+ 2.1`, tombent dans T2. Les remplacer par un seul : `q(END('T2') + .05, 'sweat_drop', .6, .15)`.
- `bubble_wrap` .6 → **.3** : les crépitements passent sous « protège ce qui peut casser ».
- `tape_measure` .8 → **.5** : il passe sous « sont mesurés ».
- `pop` du CTA .7 → **.4** : il passe sous « mot ».

**Sans changement de code** : tous les autres cues suivent leurs nouvelles ancres.
- `bonzini_sig` et `violet_hum` partent sur `A.sig` / `A.violet`, et `music().sigAt` suit `A.sig`.
- Dans `compose_brand`, la grille violette s'étire jusqu'au tampon « MESURÉ ✓ ».

**À ajouter dans `tools/qa_score.js`** : aucun de ces cues ne doit commencer **dans un mot**, c'est-à-dire dans les
fenêtres `[s, e]` de `timing.json` `words` :

`pouf_air`, `boum_carton`, `letters_splash`, `stamp`, `clac`, `scotch_scriiitch`, `gloup`, `hic`, `bubble_plop`,
`bonzini_sig`, `tonk`, `label_slap`, `stamp_big`, `kaching_soft`, `sweat_drop`.

Le mixage v2 (`DUCK_DB 12`, `SFX_DUCK_DB 9`, `HIT_DUCK_DB 6`) est déjà en place dans `lib/audio_ep2.py` : à garder.

### 7.4 Les textes : lignes prêtes à coller (`TEXTS()` et `PLATE_TXT`)
```js
bateau: { lines: ['MÊME LÉGER,', 'TU PAIES', 'LA PLACE.'], emph: 2 },
toiSmall: { lines: ["J'AI PAYÉ LE BATEAU", 'POUR TRANSPORTER', "DE L'AIR ?!"], emph: -1 },
[A.stampM3 - .14, A.flank + .15, 'm3', 'EN MÈTRES|CUBES (m³)', 'stampM3', 'CA_carton'],
[A.capVide, T.T2 + .05, 'capVide', 'TU PAIES AUSSI|LE *VIDE* DEDANS.', 'caption', null],
[T.N5 - .05, T.N6 - .1, 'capN5', "UN CARTON *PLUS PETIT*,|C'EST MOINS DE|^*MÈTRES CUBES*.", 'caption', null],
[T.N6 - .05, A.ensuite, 'capN6', 'MAIS *PROTÈGE*|*CE QUI PEUT CASSER*.', 'caption', null],
[A.capBZ, A.endcard, 'capBZ', 'TES CARTONS SONT|*MESURÉS* EN CHINE.', 'captionBZ', null],
[A.endcard + .25, A.out, 'service', 'Cargo bateau et avion · Chine → Douala|Entrepôt : Foyer Balengou', 'service', 'BZ_end'],
[A.cta, A.out, 'cta', 'Écris CARTON en commentaire', 'cta', 'BZ_end'],
[A.cta + .35, A.out, 'tag', "Montre ça|à celui qui|paie de l'air", 'tagHand', 'BZ_end'],
```
La légende `capN4` (`[T.N4 - .05, A.split - .05, …]`) couvre N4 et N4b sans changement.

### 7.5 Autres fichiers
**Code** :
- `overlay/scenes/30_carton.js` `stampM3()` : redessiner le tampon sur 2 lignes, « EN MÈTRES » puis « CUBES » + « m » et « 3 » en exposant (voir §3).
- `overlay/scenes/76_end.js` : la valeur de secours `'CARTON'` (ligne 88), l'échelle ou la position de la pastille, et les commentaires (§3).

**Outils** :
- `tools/qa_score.js` :
  - la liste des ids du jitter passe à `['N1','T1','N2','N2b','N3','N3b','T2','N4','N4b','N5','N6','N7','N8','N8b']` ;
  - le contrôle « measure starts under N2 voice » devient `A.mes0 < T.N2b + S.DUR.N2b` ;
  - l'étiquette de tenue `'AU m3'` devient `'EN MÈTRES CUBES'` ;
  - la fin des runs avec jitter devient `tm.end = Math.max(tm.end, tm.N8b + tm.dur.N8b + .5)` ;
  - ajouter le contrôle « aucun son fort dans un mot » (§7.3).
- `lib/audio_ep2.py` `derive_score()` (copie Python de secours du score, lignes 119 et suivantes) : y reporter les mêmes ancres. Sinon, elle diverge du score lu par node : le README dit que les deux donnent les mêmes cues.

**Recalage et contrôle**, dans l'ordre :
1. `takes.json` et `vocheck.json` pour les 14 ids ;
2. `python3 serie/retime.py ep2` ;
3. `node tools/qa_score.js 40` ;
4. régénérer `data/timeline_main.json` (commande dans le README) ;
5. le mixage ;
6. `listen_test.py`.

**Documentation** : `README.md` (ancres, tenues, CTA) et `MODULES.md` (lignes 106, 219, 222, 224).

---

## 8. PHRASE-test (à mettre à jour dans `SERIE.md`)
> « Dans le bateau, même un carton léger paie sa place : elle se mesure en mètres cubes, le vide dedans compris. Demande à ton fournisseur des cartons bien remplis : un carton plus petit, c'est moins de mètres cubes. Mais protège ce qui peut casser. Chez Bonzini Trading Cargo, tes cartons sont mesurés en Chine. »

**Seuil** : 4 personnes sur 5 citent « on paie la place / le vide » ET « des cartons bien remplis / plus petits ». Aucune ne
dit que « Bonzini remballe ».

## 9. À valider par le patron
1. **« Tes cartons sont mesurés en Chine »** : une version plus prudente de « dès la réception ». Le fait est vérifié : à la réception en Chine, chaque colis est enregistré avec photo, poids et dimensions (`supabase/migrations/20260920100000_parcel_reception.sql`).
2. **Option N7b, non incluse : « Le volume est écrit sur ton reçu. »** Elle répond au « pourquoi » que pose l'auditeur test.
   - **Indices** :
     - le reçu de dépôt affiche une ligne « Volume » (`src/mobile/screens/reception/ReceptionDone.tsx`) ;
     - l'écran du réceptionnaire indique « Le reçu est dans l'app du client. » (`src/i18n/locales/fr/agent.json`, `rc_done_receipt`).
   - **Pourquoi elle n'est pas incluse** :
     - on n'a pas vérifié ce que le client voit lui-même ;
     - elle ajoute ≈ 2,6 s, alors qu'il ne reste que 0,24 s sous les 45 s.
   - **Si le patron la valide** : appliquer d'abord le plan de coupe du §6.
3. **« Cargo bateau et avion »** sur la carte de fin, à la place de « Groupage mer et air ». C'est le même service vérifié.
4. **La ligne de partage « Montre ça à celui qui paie de l'air »**, à la place de « Tague celui qui remplit ses cartons de papier ».
5. **La réponse WhatsApp au mot CARTON** (§5).

## 10. Retours des relectures : ce qui est repris, et pourquoi le reste ne l'est pas

**Auditeur test de Mboppi** :

| Problème | Décision |
|---|---|
| Débit des prises (5,4–7 syl/s) | Repris (§2) : fenêtre de 3,6 à 4,0 syl/s, étirement de 1,15 à 1,3, ASR avec filtre téléphone et musique. Pour T2, « j'ai payé » est obligatoire. |
| Virgule dans N4b (« des cartons, bien remplis ») | Reprise : la virgule disparaît. |
| « Bien remplis » se lit « rempli de papier » | Repris : N5 devient « Un carton plus petit, c'est moins de mètres cubes. », et la ligne « Tague… papier » est remplacée. |
| N2 ne répond pas à « léger » | Repris : « Dans le bateau, même léger, tu paies la place. » |
| « Se compte » | Remplacé par « se mesure ». |
| N7 : virgule avant « en Chine » | Retirée. |
| N7 : pas de bénéfice entendu | Option N7b, à valider (§9). |
| N6 : « ce qui casse » | Devient « ce qui peut casser ». |
| N8 : pourquoi écrire le mot ? | Le bénéfice est dans la publication et dans la réponse WhatsApp (pas le temps de le dire). Deux variantes de tts sont prévues. |
| Écran : « Tague… » et « Groupage mer et air » | Remplacés. |
| Écran : `capN4` | On garde la légende « DEMANDE À TON FOURNISSEUR : … ». |

**Pédagogie et faits** :

| Problème | Décision |
|---|---|
| P1, bruits sur les mots clés | Repris en entier (§7.2 et §7.3). En plus : le BOUM passe avant N2, la plaque est lue pendant N2, et le tampon rituel tombe avant N8b. |
| P2, « Cette place » | Devient « La place » (sinon on entend « sept places »). |
| P3, N4b | « -lui » retiré. La virgule n'est pas reprise : l'autre relecture montre qu'elle sépare le nom de son adjectif. La légende reste l'ancienne. |
| P4, « Tague… papier » et N5 | Repris : nouvelle ligne de partage et N5 plus pédagogique. |
| P5, ligne de services | Reprise. |
| P6, N7 | Texte gardé, ordre des mots gardé. Côté tts, on part d'une phrase sans virgule et on essaie deux variantes de secours, dans un ordre fixé (§2). On laisse 0,2 s de silence après « Chine ». La prise est choisie à l'ASR. |
| P7, CBM restant ailleurs | Listé au §3 ; textes de publication réécrits au §5. |
| P8, T2 | Volume normal ; prise d'au moins 3,25 s. |
| P8, N6 | Réduite à une seule consigne. « Enlève le vide » était déjà dit par N4b et N5, ce qui économise 1,1 s : ce temps paie « même léger » et la nouvelle N5. |
| P8, au-delà de 45 s | Plan de coupe au §6. |
