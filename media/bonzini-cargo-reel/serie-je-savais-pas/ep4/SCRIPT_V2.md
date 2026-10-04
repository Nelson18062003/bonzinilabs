# « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) : voix v2, diction claire

C'est la version finale du texte dit. Elle suit le retour du patron (« on ne comprend pas, il faut articuler, des mots
simples, définir avant d'utiliser ») et les règles de `serie/DICTION.md`. Elle part du brouillon v2 et de ses deux
relectures : l'auditeur test de Mboppi, et la relecture pédagogie et faits.

- **Fichier des voix** : `data/script_v2.json`. Il est lu par `serie/tts_v2.py` et `serie/select_takes.py`.
- **En bref** :
  - 12 répliques : 5 pour TA COMMANDE (le colis), 4 pour TOI, 3 pour la narratrice ;
  - 131 syllabes et 15 phrases, ≈ 44,8 s à 3,6 syllabes par seconde (§6) ;
  - mot-clé **ALLÔ**.
- **Mêmes images, même ordre.** Une seule réplique est coupée en deux : T3 devient T3 + T3b. Ce qui change :
  - les ancres de temps (§7) ;
  - quelques textes à l'écran (§3) ;
  - la place de plusieurs bruitages : un son fort ne tombe plus jamais sur un mot.
- **Vérifié** sur une copie de la partition, avec des temps de mots simulés à 3,5, 3,6 et 3,8 syl/s :
  - aucune voix ne se chevauche ;
  - jamais plus de 3 blocs de texte à l'écran ;
  - chaque texte clé est tenu au moins 1,4 s ;
  - aucun bruitage court ne commence dans un mot.

  La copie corrigée, prête à reporter, est au §7.6.

---

## 1. Les répliques, dans l'ordre où elles sont dites

« = » dans la colonne `tts` veut dire que la synthèse reçoit exactement le texte affiché. « syll. » compte les syllabes
dites, celles du contrôle de débit (§2). « Voix » : C = cml-tts `5830_4703` (le colis, aigu et comique, mais posé, sans
crier), T = cml-tts `1770_1028` (TOI), N = la narratrice par défaut (aucun champ `voice`).

| id | qui | texte | tts | remplace | moment visuel (beat) | syll. |
|---|---|---|---|---|---|---|
| C1 | TA COMMANDE | Patron, attends ! Ne paie pas sur ce compte ! | = | C1 « Patron ! Attends ! Ne paie pas ce compte ! » | **ACCROCHE.** La commande est écrasée contre la vitre dès l'image 0 (THOK), puis se replaque sur « attends », « paie » et « compte ». La carte « PATRON, ATTENDS ! » est là dès l'image 0, puis « NE PAIE PAS SUR CE COMPTE ! » arrive sur « Ne ». La voix part à 0,2 s, après le THOK. Le dézoom commence pendant « compte », et la bulle tombe avec son « ding » **juste après** « compte ». | 10 |
| T1 | TOI | Mon fournisseur m'écrit qu'il a changé de compte bancaire. | = | T1 « « On a changé de compte bancaire. Paie ici, vite. » » (TOI lisait le message) | La bulle verte est posée : « ON A CHANGÉ DE COMPTE BANCAIRE. PAIE ICI, VITE. », que la voix ne lit jamais. La plaque ambre de TOI entre à T1 − 0,2 et porte **« IL A CHANGÉ DE COMPTE. »**. Les 3 cœurs apparaissent pendant la phrase. On voit aussi le margouillat et « Boutique · Mboppi ». TOI dit ce qu'il croit, au discours indirect. | 14 |
| T2 | TOI | Il a mis trois cœurs, c'est lui ! Je paie. | = | T2 « Trois cœurs… c'est lui ! Je paie. » | La plaque passe à « TROIS CŒURS, C'EST LUI ! » (T2 − 0,1). Les cœurs battent sur « cœurs » ; le « aww » de guitare vient **après** le mot. « JE PAIE. » arrive sur « Je », puis la plaque avance vers la bulle. | 9 |
| C2 | TA COMMANDE | Ce n'est peut-être pas ton fournisseur ! | = | C2 « Attends ! C'est peut-être pas ton fournisseur ! » | **L'INTERRUPTION.** Le bond part à la fin de T2 et atterrit **0,25 s avant la voix**. À ce moment : « boing », « bonk », la musique se coupe net, et la plaque de TOI se cogne et recule. La phrase est donc dite sur un silence. Carte sur 3 lignes : « CE N'EST / PEUT-ÊTRE PAS / TON FOURNISSEUR ! ». | 9 |
| C3 | TA COMMANDE | Appelle-le sur le numéro que tu connais déjà ! | Appelle-le, sur le numéro que tu connais déjà ! | C3 (texte inchangé ; virgule de respiration dans le tts) | **LE RÉFLEXE.** Le bandeau sombre « APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. » porte maintenant un onglet kraft « TA COMMANDE ». La commande saute sur les syllabes. **Aucun bruitage pendant la phrase** : la sonnerie vient après. | 14 |
| T3 | TOI | Allô ? | = | T3, 1re moitié (« Allô ?… ») | **L'APPEL.** Quand la commande a fini, la plaque de TOI se retourne en « ALLÔ ? ». Une sonnerie retentit et la commande se met de côté. Le déclic du décroché tombe 0,1 s avant la voix. C'est une prise à part. | 2 |
| T3b | TOI | Il dit qu'il n'a rien changé ! | = | T3, 2e moitié (« Il dit qu'il a rien changé ?! ») | **LA RÉPONSE.** Pendant les 0,6 s de silence après « Allô ? », la plaque d'acier « JE N'AI RIEN CHANGÉ. » (pastille « TON FOURNISSEUR · CHINE ») descend. C'est la réponse du vrai fournisseur, écrite et sans voix. TOI la répète. Sa plaque passe à « IL N'A RIEN CHANGÉ ! » une fois l'acier posé, et la bulle tremble. | 7 |
| C4 | TA COMMANDE | C'était un faux message ! | = | C4 « Ouf ! » | **LE FAUX TOMBE** (ralenti). Dans l'ordre : l'acier tamponne la bulle, les fissures apparaissent, la bulle se brise, la pastille se décolle (« PAS TON FOURNISSEUR »), puis le tampon « FAUX MESSAGE » tombe. La phrase part **0,13 s après ce tampon**, sur un silence. Les 3 sauts de joie se font pendant la phrase, **sans bruitage**. Après « message » viennent l'accord majeur et les 3 « clink » des cœurs qui se posent près du margouillat. | 6 |
| N1 | narratrice | Avant de payer sur un nouveau compte, appelle l'ancien numéro. | = | N1 « Nouveau compte ? Ancien numéro : appelle d'abord. » | **LA RÈGLE**, seule à l'écran ≈ 5,4 s. « NOUVEAU / COMPTE ? / ANCIEN / NUMÉRO. » sont tamponnés sur nouveau / compte / ancien / numéro : mêmes mots, même ordre. La sous-ligne « avant de payer, / appelle le numéro / que tu connais déjà. » arrive sur « appelle ». Le margouillat gobe un cœur ; son « gloup » vient après « numéro ». En musique, seulement l'accord tenu, très bas. | 17 |
| C5 | TA COMMANDE | On se voit à Douala ! | = | C5 « On se voit à Douala, patron ! » | **MARQUE.** Le conteneur en verre violet apparaît avec la lumière violette. La commande saute dedans et parle de l'intérieur. Le ruban devient violet sur « Douala », et l'étiquette BONZINI se colle juste après. Carte « ON SE VOIT / À DOUALA ! ». La makossa pleine part avec le conteneur. « Douala » est en fin de phrase, là où le français accentue. | 7 |
| N2 | narratrice | Ensuite, Bonzini Trading Cargo amène ta commande de la Chine à Douala. | = | N2 « Bonzini Trading Cargo : de la Chine à Douala. » | La signature balafon joue dans la pause **avant** la phrase. La plaque émaillée « BONZINI TRADING CARGO » tombe avec son « tonk » 0,2 s **avant** « Ensuite » : la voix lit ensuite ce qui est écrit, et rien ne frappe sur « Bonzini ». La légende « DE LA CHINE À DOUALA · MER OU AIR » arrive sur « Chine ». On voit aussi l'étiquette « Entrepôt · Foyer Balengou ». | 21 |
| N3 | narratrice | Écris le mot ALLÔ en commentaire. Maintenant, tu sais. | Écris le mot « allô » en commentaire. Maintenant, tu sais. | N3 « Écris ALLÔ en commentaire. Maintenant, tu sais. » | **FIN ET BOUCLE.** La carte de fin s'affiche. La pastille « Écris ALLÔ en commentaire ↓ » arrive juste **avant** « Écris ». Le tampon « MAINTENANT, TU SAIS. » tombe dans la pause, 0,3 s avant « Maintenant », et la voix le lit. La commande ressort après « sais » et bondit vers l'objectif. | 15 |

**Vérification des règles DICTION** :
- **Longueur** : chaque phrase a 12 mots au plus (N2 en a 12, toutes les autres 10 ou moins), avec un sujet et un verbe
  (les impératifs comptent). La seule phrase sans verbe est « Allô ? » : c'est un vrai mot, le geste enseigné et le mot-clé.
- **Une idée par phrase** : T1 tient en une seule phrase, au discours indirect.
- **Ce qui est retiré** : aucun « … », aucune onomatopée (« Ouf ! » est retiré), aucune ville chinoise. Le seul chiffre est
  « trois cœurs », en lettres et avec son unité.
- **Négation** : elle est complète partout (« Ce n'est … pas », « n'a rien »). « Ne paie **pas** » est contrôlé à la prise (§2).
- **« Bonzini »** : il a toujours un mot avant lui (« Ensuite, »), et aucun bruitage ne tombe dessus.
- **Vocabulaire** : seulement « payer / paie », jamais « transfert », « envoyer » ni « virement ». Pas de « garanti », de
  « gratuit » ni de « moins cher ».
- **Promesse** : aucune promesse anti-fraude. « Ensuite » place Bonzini **après** la vérification : c'est le cargo, pas une
  protection.
- **Faits** : aucun fait nouveau. Tous viennent de « Faits utilisés » (SERIE.md) : le piège du changement de compte
  bancaire, le contre-appel sur un numéro déjà connu, et le cargo Chine → Douala.

**Le fil pédagogique, entendu sans l'image** : deux contrastes portent la leçon.
- **Écrit / dit** : « Mon fournisseur **m'écrit qu'il a changé** » (T1) contre « Il **dit qu'il n'a rien changé** »
  (T3b). Les deux phrases ont la même construction. Ce qui est écrit peut être faux ; la voix au numéro connu est la preuve.
- **Même contraste à l'écran** : la même plaque ambre passe de « IL A CHANGÉ DE COMPTE. » à « IL N'A RIEN CHANGÉ ! ».

---

## 2. Fabrication des voix : contrôler chaque prise (c'est le débit qui fait comprendre)

Le patron se plaint de l'articulation, et le texte seul ne règle pas le débit. Les anciennes prises de ces mêmes voix
allaient à :
- C3 ≈ 5,2 syl/s ;
- N2 ≈ 6,5 syl/s (c'est là que « Bonzini » devient « Bonsigny ») ;
- T1 ≈ 4,7 syl/s.

Au labo, la voix développeuse-3 parle naturellement à ≈ 4,5 syl/s. Le recalage actuel **accélérait** même C1 (×0,88)
et C2 (×0,92).

0. **Avant de générer**, déplacer les anciennes prises : `mkdir -p audio/vo_v1 && mv audio/vo/*.wav audio/vo_v1/`. Sans cela :
   - `tts_v2.py` saute les fichiers qui existent déjà (C1_s1.wav…) ;
   - `select_takes.py` noterait les anciennes prises contre le nouveau texte.
1. **Fenêtre de débit, prise par prise.** On mesure le débit d'articulation : syllabes (colonne « syll. ») ÷ durée parlée,
   en retirant les silences de plus de 0,25 s (`pauses_of()` de `retime.py`). Ce débit doit rester **entre 3,6 et
   3,9 syl/s**. On garde la prise propre **la plus lente** dans la fenêtre, pas la plus courte.

   | Réplique | C1 | T1 | T2 | C2 | C3 | T3 | T3b | C4 | N1 | C5 | N2 | N3 |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | Parole (s), mini à 3,9 | 2,56 | 3,59 | 2,31 | 2,31 | 3,59 | 0,45 | 1,79 | 1,54 | 4,36 | 1,79 | 5,38 | 3,85 |
   | Parole (s), maxi à 3,6 | 2,78 | 3,89 | 2,50 | 2,50 | 3,89 | 0,80 | 1,94 | 1,67 | 4,72 | 1,94 | 5,83 | 4,17 |

   - **Au-dessus de 3,9 syl/s** :
     - régénérer plus lentement : `padding_bonus` 0,25 à 0,5 dans `voice_cfg.json`. Ce sont les réglages I/J du labo 3,
       mesurés sur la narratrice : à vérifier sur les voix cml-tts. Attention, `pb` 1,0 tombe à 2,4 syl/s, c'est trop lent ;
     - ou étirer sans changer la hauteur, avec `retime.py --stretch N2=1.15,…` (facteur **1,10 à 1,25** ; au labo,
       ×1,25 donne 3,75 syl/s et 93 % de mots reconnus).
   - **Si un étirement de plus de 1,25 est nécessaire**, générer la phrase en deux morceaux et les recoller avec 0,2 s
     d'écart :
     - C3 : « Appelle-le, sur le numéro » + « que tu connais déjà ! » ;
     - N2 : « Ensuite, Bonzini Trading Cargo » + « amène ta commande de la Chine à Douala. ».
   - **Jamais de facteur inférieur à 1,0.** On supprime `C1=0.88,C2=0.92` de la commande du README.
   - **Sous 3,6 syl/s** : la prise est acceptée seulement si le film recalé reste ≤ 45 s (§6).
2. **Mots qui doivent être reconnus.** Le contrôle passe par `BED=<makossa> python3 serie/select_takes.py ep4` (ASR
   « small », filtre téléphone, condition « music » à 10 dB). Une prise qui rate un de ces mots est rejetée.

   | Réplique | Mots à entendre | Rejeter si… |
   |---|---|---|
   | C1 | « pas » (≥ 0,12 s dans `vocheck.json`), « compte » | « pas » manque, ou dure moins de 0,12 s : on entend alors l'inverse (« paie sur ce compte ») |
   | T1 | « m'écrit », « changé », « compte bancaire » | on entend « m'écrit-il » (le son d'une question) |
   | T2 | « trois cœurs », « c'est lui » | on entend « trois quarts » |
   | C2 | « n'est », « pas », « fournisseur » | |
   | C3 | « appelle », « numéro », « connais », « déjà » | |
   | T3 | « allô » (ou « allo », « alo »), reconnu aussi dans la condition « music » | la prise est coupée ou fait moins de 0,45 s |
   | T3b | « dit », « rien », « changé » | |
   | C4 | « faux », « message » | |
   | N1 | « avant de payer », « nouveau compte », « ancien numéro » d'un seul groupe | il y a plus de 0,15 s de silence entre « l'ancien » et « numéro » (on entendrait « appelle l'ancien », c'est-à-dire « appelle le vieux ») |
   | C5 | « Douala » | on entend « d'où à la » |
   | N2 | « Bonzini », « Cargo », « Chine », « Douala » | on entend « bonsigny », « borsini » ou « trésincargo » |
   | N3 | « le mot », « allô », « maintenant », « tu sais » | on entend « c'est écrit » |
3. **Variantes du tts, à essayer dans cet ordre** (ne jamais changer l'ordre des mots, les ancres en dépendent) :
   - **T3** :
     - **A** (dans le JSON) : « Allô ? » seul.
     - **B** : si la prise sort tronquée ou si l'ASR la rate, générer « Allô ? Il dit qu'il n'a rien changé ! » en une
       seule prise, puis la couper au silence après « Allô ? » en `T3_sN.wav` + `T3b_sN.wav`. Les anciennes prises avaient
       déjà 0,6 à 0,9 s de silence à cet endroit.
   - **N3** :
     - **A** (dans le JSON) : « Écris le mot « allô » en commentaire. … ». L'ancienne prise avec les guillemets
       isolait « Allô » sur plus de 1,1 s.
     - **B** : « Écris le mot allô, en commentaire. … ».
   - **N2** :
     - **A** (dans le JSON) : sans virgule après le nom.
     - **B** : « Ensuite, Bonzini Trading Cargo, amène ta commande de la Chine à Douala. ». La virgule, seulement dans le
       tts, fait du nom un groupe à part.
   - **C1** : aucune variante. On choisit la prise par la mesure de « pas » ; l'ancienne C1_s1 la tenait 0,22 s, donc c'est
     possible.
4. **Le bon outil de mesure.** On choisit les prises avec `select_takes.py` / `voice_score.py`, **pas** avec
   `vocheck.json` › `match`.
   - `vocheck.py` découpe à l'apostrophe et au trait d'union, donc « c'est » devient « c » + « 'est ». Il compte alors
     comme des erreurs des mots bien transcrits : C2 « 57 % » et C3 « 82 % » étaient en réalité transcrits mot pour mot.
   - `vocheck.json` sert seulement aux temps des mots (`retime.py`).
5. **Après le mixage** : `python3 serie/listen_test.py ep4 audio/mix.wav`. Chaque réplique doit atteindre au moins 90 %,
   et tous les mots du point 2 doivent être reconnus.

---

## 3. Textes à l'écran : ce qui change

| Élément | Avant | Après | Où dans le code |
|---|---|---|---|
| Carte 2 de l'accroche | `NE PAIE PAS\|CE COMPTE !` | `NE PAIE PAS\|SUR CE COMPTE !` | `01_score.js` `TEXTS` id `'hook2'` (l. 368) **et** le texte écrit en dur dans `60_type.js` l. 116 : `'*NE PAIE PAS*\|CE COMPTE !'` → `'*NE PAIE PAS*\|SUR CE COMPTE !'`. `fit()` l'ajuste à ≈ 94 px. |
| Plaque de TOI pendant T1 | `…`, style `objectMinor` | `IL A CHANGÉ\|DE COMPTE.`, style **`object`** | `01_score.js` `toiPlate()`, valeur initiale de `txt` (l. 307), et `TEXTS` id `'toi0'` (l. 372) : `'IL A CHANGÉ DE COMPTE.'`. C'est la version courte de T1, avec les mêmes mots. Elle fait le contraste visible avec « IL N'A RIEN CHANGÉ ! ». Le texte est tenu 4,3 s. |
| Plaque de TOI pendant T2 | `TROIS CŒURS…\|C’EST LUI !` | `TROIS CŒURS,\|C’EST LUI !` | `toiPlate()` l. 308 ; `TEXTS` id `'toi1'` (l. 373) : `'TROIS CŒURS, C’EST LUI !'`. On ne remet pas « IL A MIS » : la plaque se réduirait et les mots gardés sont dits. |
| Plaque de TOI | `OK,\|JE PAIE.` | `JE PAIE.` | `toiPlate()` l. 309 ; `TEXTS` id `'toi2'` (l. 374). « OK » n'est plus dit. |
| Carte de C2 | `C’EST PEUT-ÊTRE PAS\|TON FOURNISSEUR !` | `CE N’EST\|PEUT-ÊTRE PAS\|TON FOURNISSEUR !` | `TEXTS` id `'c2'` (l. 375) **et** le texte écrit en dur dans `60_type.js` l. 115 : `'C’EST PEUT-ÊTRE *PAS*\|*TON FOURNISSEUR !*'` → `'CE N’EST\|PEUT-ÊTRE *PAS*\|*TON FOURNISSEUR !*'`. Sur 3 lignes, le texte fait ≈ 80 px ; sur 2 lignes, la ligne de 22 caractères ne ferait que ≈ 64 px. La carte va de y ≈ 243 à 557. |
| Bandeau du réflexe (C3) | sans onglet | même texte, plus un onglet kraft « TA COMMANDE » | `60_type.js` `band()`. Copier le bloc `if (tab) {…}` de `speechCard()` (l. 83–85) et le placer après les lignes de texte, avec `tab = 'TA COMMANDE'`. On ne met pas de pastille sous le colis, car elle tomberait sur la plaque de TOI (le colis est en `G.mid`). Désormais, chaque réplique de la commande est signée : C1 et C4 par la pastille, C2 et C5 par l'onglet de leur carte, C3 par celui du bandeau. |
| Plaque de TOI pendant T3b | `IL A RIEN\|CHANGÉ ?!` | `IL N’A RIEN\|CHANGÉ !` | `toiPlate()` l. 319 ; `TEXTS` id `'toi4'` (l. 379) : `'IL N’A RIEN CHANGÉ !'`. |
| Sous-ligne de LA RÈGLE | `appelle d’abord\|le numéro que tu connais` | `avant de payer,\|appelle le numéro\|que tu connais déjà.` | `TEXTS` id `'ruleSub'` (l. 383). L'ancre ne change pas (`W('N1', 'appel')`). `rule()` gère déjà n lignes : la carte grandit de 58 px (y ≈ 347–1123, largeur ≤ 820 px, donc x ≤ 935). Sans le son, la carte dit toute la règle et définit « ancien numéro ». |
| Carte de C5 | `ON SE VOIT À DOUALA,\|PATRON !` | `ON SE VOIT\|À DOUALA !` | `TEXTS` id `'c5'` (l. 386), avec une nouvelle fin : `Math.min(A.plateBZ - .25, T.N2 + .15)`. Texte écrit en dur dans `60_type.js` l. 115 : `'ON SE VOIT À *DOUALA*,\|PATRON !'` → `'ON SE VOIT\|À *DOUALA* !'`. |

**Inchangés** : on ne les dit pas, ou on les dit déjà avec les mêmes mots.
- **Accroche et faux message** :
  - « PATRON, ATTENDS ! » ;
  - la bulle « ON A CHANGÉ DE COMPTE BANCAIRE. PAIE ICI, VITE. » (écrite seulement ; la voix ne la lit plus, c'est elle
    qui faisait entendre « Paye-ci vite ») ;
  - « •••• •••• » ;
  - la pastille « « TON FOURNISSEUR » ? » ;
  - « Boutique · Mboppi ».
- **Le réflexe et l'appel** :
  - le texte du bandeau « APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. » ;
  - « ALLÔ ? » ;
  - « JE N'AI RIEN CHANGÉ. ».
- **La chute** : « FAUX MESSAGE » et « PAS TON FOURNISSEUR ».
- **La règle** : ses 4 mots (« NOUVEAU COMPTE ? ANCIEN NUMÉRO. »).
- **La marque** :
  - « BONZINI TRADING CARGO » (étiquette et plaque) ;
  - « DE LA CHINE À DOUALA · MER OU AIR » ;
  - « Entrepôt · Foyer Balengou ».
- **La fin** :
  - la carte de fin et « MAINTENANT, TU SAIS. » ;
  - la pastille « Écris ALLÔ en commentaire ↓ » (voir §5) ;
  - « Tague celui qui paie trop vite ».

---

## 4. Définitions : chaque mot est expliqué avant d'être employé

- **« compte bancaire »** : TOI le dit en T1, et la bulle le montre au même moment. Le mot vient donc avant le
  « ce compte » de l'accroche réentendue en boucle, et avant le « nouveau compte » de la règle (N1).
- **« le numéro que tu connais déjà »** : C3 le dit, et le bandeau l'écrit 10 s avant la règle.
  - « Appelle-le » montre qu'il s'agit d'un **numéro de téléphone**, pas d'un numéro de compte.
  - La règle dit ensuite « l'ancien numéro », et sa sous-ligne le redéfinit à l'écrit : « appelle le numéro que tu
    connais déjà ».
  - On évite ainsi deux fausses lectures : « l'ancien » au sens du vieux ou de l'aîné, et « mon ancien numéro » au sens
    d'un numéro qui ne sert plus.
- **« faux message »** : on le comprend d'abord par l'appel. Le vrai fournisseur répond par écrit « JE N'AI RIEN
  CHANGÉ. », puis TOI le répète (T3b). Ensuite seulement, la commande le nomme (C4), juste après le tampon « FAUX
  MESSAGE ».
- **« trois cœurs »** : les cœurs sont montrés pendant T1. Puis TOI dit « Il **a mis** trois cœurs » : sans l'image, on
  sait que ce sont des cœurs dans le message, pas des « trois quarts ».
- **« Bonzini Trading Cargo »** : la phrase dit ce qu'il fait (« amène ta commande de la Chine à Douala »). Le mot
  « cargo » est connu à Douala.
- **« ALLÔ »** : TOI le dit et le montre (T3) avant qu'il devienne le mot à écrire (N3).
- **« avant de payer »** : il ouvre la règle, et c'est le moment exact où il faut agir.

---

## 5. Mot-clé et publication

**Mot-clé : ALLÔ.** C'est un vrai mot de deux syllabes, dit et écrit dans le film, et c'est le geste même qu'on enseigne.
- **La voix** dit « Écris **le mot** ALLÔ en commentaire » (DICTION, règle 9).
- **La pastille** garde « Écris ALLÔ en commentaire ↓ », pour trois raisons :
  - `BZ_ctaPill` (`76_end.js` l. 139 et 225) met tout ce qui se trouve entre « Écris » et « en commentaire » dans la
    case orange du mot à taper : « le mot ALLÔ » y passerait en entier ;
  - la pastille ferait alors ≈ 980 px et dépasserait la limite de x = 960 ;
  - la case orange montre déjà quel mot taper.

À recopier dans `SERIE.md` › Épisode 4 › Publication :
- **Réponse WhatsApp au mot ALLÔ** : elle se déclenche sans tenir compte de la casse, des accents, de la ponctuation, des
  répétitions ni des emojis. Elle accepte : « allo », « allô », « alo », « hallo », « allo allo », « Allô 📞 ».

  Elle donne les 3 réflexes, **sans promesse de protection** :
  1. **Nouveau compte ? Ancien numéro.** Avant de payer sur un nouveau compte, appelle ton fournisseur sur le numéro que
     tu connais déjà, jamais sur celui du message.
  2. **On ne se laisse pas presser** : « paie vite » est un signal d'alerte.
  3. **On garde ses échanges.**
- **Texte de publication** :
  > « On a changé de compte bancaire, paie vite. » Stop.
  > Avant de payer sur un nouveau compte, appelle ton fournisseur sur le numéro que tu connais déjà, pas sur celui du message. Nouveau compte ? Ancien numéro.
  > Partage à ton associé et au groupe des commerçants.
  > Ensuite, Bonzini Trading Cargo amène ta commande de la Chine à Douala (mer ou air, entrepôt au Foyer Balengou).
  > Écris ALLÔ : on te donne les réflexes sur WhatsApp. Tague celui qui paie trop vite.
  > #Arnaque #ImportChine #Douala #Mboppi #Commerçant
- **Commentaire épinglé** : sans changement.

---

## 6. Durée estimée : ≈ 44,8 s (au plus 45 s)

- **Calcul de DICTION** : 131 syllabes ÷ 3,6 = 36,4 s de parole, plus 15 phrases × 0,35 s, soit 41,6 s. Il faut y ajouter
  2,45 s de moments muets que l'image exige (tableau ci-dessous). Total : **≈ 44,1 s**.
- **Simulation mot par mot** (3,6 syl/s, 0,15 s par virgule en plus, sur la copie de la partition) : **44,84 s**,
  1 345 images. Les valeurs par défaut du §7.1 donnent ce résultat.

| avant… | pause | ce qui s'y passe (et pourquoi la voix attend) |
|---|---|---|
| C1 | 0,20 | THOK, craquement de vitre, souffle coupé |
| T1 | 0,40 | « ding » de la bulle (après « compte »), la plaque de TOI entre |
| T2 | 0,35 | — |
| C2 | 0,55 | bond, atterrissage, « boing » + « bonk » + coupure de la musique, **avant** « Ce n'est » |
| C3 | 0,35 | le bandeau entre |
| T3 | 0,60 | plaque retournée en « ALLÔ ? », une sonnerie, le déclic |
| T3b | 0,60 | la plaque d'acier descend : la réponse écrite |
| C4 | 1,00 | tampon de l'acier, bris, décollage de la pastille, tampon « FAUX MESSAGE » |
| N1 | 0,55 | accord majeur, 3 « clink », la carte de la règle entre |
| C5 | 0,45 | la règle sort, le conteneur violet apparaît |
| N2 | 0,55 | balafon, puis la plaque émaillée et son « tonk » |
| N3 | 0,35 | la carte de fin, la pastille |
| fin | 0,70 | la boucle part après « sais » (le tampon rituel reste ≥ 1,5 s) |

**Selon le débit réel des prises** (simulation) :

| Débit | 3,5 syl/s | 3,6 syl/s | 3,8 syl/s |
|---|---|---|---|
| Durée du film | **45,9 s** (trop long) | 44,8 s | 42,9 s |

C'est pourquoi la fenêtre de débit du §2 commence à 3,6 syl/s.

Le film dépasse les 20–35 s de `BRIEF.md`. Mais `DICTION.md` (règle 6), plus récent et tiré du retour du patron,
autorise jusqu'à 45 s.

**Si le film recalé dépasse 45 s**, couper dans cet ordre :
1. **Raccourcir des pauses** (−0,25 s) :
   - N1 : 0,55 → 0,45 ;
   - N2 : 0,55 → 0,45 ;
   - T1 : 0,40 → 0,35.

   Ne pas toucher aux pauses de C2, T3, T3b et C4 : ce sont celles de l'image et des bruitages.
2. **N3** devient « Écris ALLÔ en commentaire. Maintenant, tu sais. » (−0,55 s). La pastille et les ancres ne changent pas.
3. **Ne jamais** accélérer une prise.

**Option, si le film recalé fait ≤ 44,4 s** : T2 devient « Il a mis trois cœurs, c'est lui ! Je paie vite. » (+0,3 s).
- La plaque passe alors à `JE PAIE|VITE.` (`toiPlate()` l. 309 et `'toi2'`).
- Les ancres ne changent pas (`W('T2', 'je')`).
- L'urgence est alors dite à voix haute, et pas seulement écrite dans la bulle et sur la ligne de fin.

---

## 7. Notes pour l'intégrateur visuel

Les images sont les mêmes, dans le même ordre. La liste des voix passe de 11 à 12 répliques : T3 est coupée en T3
(« Allô ? ») et **T3b** (« Il dit qu'il n'a rien changé ! »).

**Ordre des opérations** :
1. Copier `data/script.json` en `data/script_v1.json`, puis `data/script_v2.json` sur `data/script.json`.
   `retime.py` et `listen_test.py` lisent l'ordre des répliques dans `script.json`.
2. Déplacer les anciennes prises (§2, point 0).
3. Générer : `python3 serie/tts_v2.py serie/ep4 --seeds 1,2,3`. Le script a besoin de `serie/voice_cfg.json`, qui ne se
   trouvait pas dans `serie/` au moment de la rédaction.
4. Choisir : `BED=… python3 serie/select_takes.py serie/ep4`, puis appliquer le contrôle du §2.
5. Temps des mots : `python3 lib/vocheck.py data/script.json` (depuis E).
6. Réécrire les valeurs par défaut `T` et `DUR` d'après les vraies prises (§7.1).
7. Recaler : `python3 ../retime.py . --tail-min .7` (depuis E), **sans** `--stretch C1=0.88,C2=0.92`.
8. Contrôler : `node tools/check_text.js`, et vérifier qu'aucun bruitage court ne commence dans un mot (§7.3).
9. Mixer, puis lancer `listen_test.py`.

### 7.1 Valeurs par défaut de `T` et `DUR` (`01_score.js`, l. 24–27)
`retime.py` garde l'espacement des **départs** par défaut.
- **Si une prise est plus longue que sa valeur DUR**, la pause qui suit se réduit, jusqu'à 0,12 s. Or les pauses du §6
  portent l'image : la chute avant C4, le bond avant C2.
- **Une fois les prises choisies**, il faut donc réécrire ces valeurs avec les vraies durées. On a alors
  `T[X] = END(précédente) + pause[X]`.

Valeurs simulées (3,6 syl/s), à coller tout de suite :
```js
const T = { C1: .2, T1: 3.88, T2: 8.12, C2: 11.67, C3: 14.52, T3: 19.01, T3b: 20.16, C4: 23.11, N1: 25.32, C5: 30.65, N2: 33.14, N3: 39.47, end: 44.84 };
const DUR = { C1: 3.28, T1: 3.89, T2: 3.0, C2: 2.5, C3: 3.89, T3: .56, T3b: 1.94, C4: 1.67, N1: 4.87, C5: 1.94, N2: 5.98, N3: 4.67 };
const LINES = ['C1', 'T1', 'T2', 'C2', 'C3', 'T3', 'T3b', 'C4', 'N1', 'C5', 'N2', 'N3'];
// SPEAKER : ajouter T3b: 'toi'
```
Après le choix des prises, ce script (testé ; à lancer depuis E) imprime les deux lignes `T` et `DUR` à recoller :
```python
import json
P = {'C1': .2, 'T1': .4, 'T2': .35, 'C2': .55, 'C3': .35, 'T3': .6, 'T3b': .6, 'C4': 1.0, 'N1': .55, 'C5': .45, 'N2': .55, 'N3': .35, 'tail': .7}
ST = {}   # les facteurs --stretch passés à retime.py, ex. {'N2': 1.15, 'C3': 1.2}
tk = json.load(open('data/takes.json')); order = [s['id'] for s in json.load(open('data/script_v2.json'))['segments']]
T, D, t = {}, {}, None
for i in order:
    D[i] = round(tk[i]['dur'] * ST.get(i, 1), 2); T[i] = round(P[i] if t is None else t + P[i], 2); t = T[i] + D[i]
T['end'] = round(t + P['tail'], 2)
print('const T = { ' + ', '.join(f'{k}: {v}' for k, v in T.items()) + ' };')
print('const DUR = { ' + ', '.join(f'{k}: {v}' for k, v in D.items()) + ' };')
print('film', T['end'], 's', '(PLUS DE 45 s : appliquer le plan de coupe du §6)' if T['end'] > 45 else '')
```
**À corriger dans `serie/retime.py`** (ligne `tail = max(1.2, …)`) : la ligne impose au moins 1,2 s après la dernière
réplique. Ici, cela ajouterait 0,5 s, soit 45,3 s à 3,6 syl/s. C'est la même demande que pour l'épisode 2.
- **Correction** : ajouter `--tail-min` (valeur par défaut 1,2) et passer `.7` pour l'épisode 4.
- **Sinon** : corriger ensuite `end` dans `timing.json` à `max(END(N3) + .7, A.stampEnd + 1.5)`.

### 7.2 Temps d'action dérivés (`A`, `01_score.js` l. 68–148) : avant → après

Règle générale (relectures) : un son fort ne commence jamais dans un mot. Il tombe dans une pause, ou à la fin du mot.
L'image peut rester sur le mot, ou annoncer la phrase juste avant.

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `A.bubble` | `max(W('C1','compte'), hook2 + 1.45)` | `Math.max(WE('C1','compte', 0, 3.1) + .05, A.hook2 + 1.45)` | Le « ding » (gain 0,8) couvrait « compte », le dernier mot de l'accroche. Le dézoom (`bubble − .45`) reste pendant le mot. |
| `A.heartsPulse` | `W('T2','coeurs', 0, .25)` | `W('T2','coeurs', 0, .9)` | Seul le repli change (« Il a mis » vient avant). |
| `A.aww` (nouveau) | (son à `heartsPulse`, sur « cœurs ») | `WE('T2','coeurs', 0, 1.2) + .03` | Le « aww » de guitare ne masque plus « cœurs » (risque « trois quarts »). |
| `A.toiTxt2` | `… W('T2','je', 0, 1.6) …` | `… W('T2','je', 0, 2.4) …` | Seul le repli change. |
| `A.jump` | `T.C2 - .3` | `T.C2 - .55` | Le bond part à la fin de T2. |
| `A.jumpLand` (donc `A.bonk`, `A.cut`) | `T.C2 + .02` | `T.C2 - .25` | « boing_carton » (gain plein), « bonk » et coupure de la musique tombaient sur « Ce n'est », la première marque de négation. |
| `A.allo` | `max(W('C3','que'), T.C3 + .9)` | `END('C3') + .02` | La plaque se retourne en « ALLÔ ? » quand la commande a fini. On fait une chose à la fois. |
| `A.ring` | `[allo + .05, allo + .85]` | `[A.allo + .08]` | Les deux sonneries (gain 0,8) couvraient « que tu connais déjà ». Il n'en reste qu'une, dans la pause. `36_call.js` et `50_compose.js` parcourent `A.ring` : rien à changer. |
| `A.pickup` (nouveau) | — | `T.T3 - .1` | Le déclic du décroché, juste avant « Allô ? ». |
| `A.supIn0` (donc `supIn1`, `tremble`) | `T.T3 + .15` | `END('T3') + .02` | La plaque d'acier descend **dans le silence** entre « Allô ? » et T3b : c'est la réponse. |
| `A.toiRien` | `max(W('T3','dit') - .25, supIn0 + .3)` | `Math.max(W('T3b','dit', 0, .2) - .25, A.supIn1 + .05)` | Le texte vient de la prise T3b. La réponse s'affiche une fois l'acier posé. L'ordre `supIn1 < toiRien` est gardé pour le margouillat (`geckoShim().falls`). |
| `A.stamp` | `END('T3') + .12` | `END('T3b') + .12` | `shatter`, `peel`, `fauxStamp`, `slow0` et `slow1` gardent leur formule. |
| `A.toiOut` | `A.stamp - .25` | `END('T3b') - .02` | La plaque de TOI ne part plus pendant « changé ». |
| `A.roll` | `shatter + .55 + .3·i` | `END('C4') + .1 + .1·i` | Les 3 cœurs se posent (avec leur « clink ») **après** « faux message ». Avant, ils tombaient dans la phrase, et on perdait « faux ». Dans `34_fake.js` (l. 525), les cœurs roulent alors plus longtemps au ralenti. Si cela se voit trop, on peut garder l'ancien `A.roll` et seulement jouer les « clink » à `END('C4') + .1 / .2 / .3`. |
| `A.joy` | autour de « Ouf ! », avec 3 « boing_small » | mêmes temps, **sans aucun son** | La phrase elle-même est la joie : les « boing » tombaient dans la phrase. Changer le commentaire (l. 118). |
| `A.ruleW` | replis `0 / .35 / .9 / 1.6` | replis `1.7 / 2.25 / 3.4 / 3.95` | Les préfixes ne changent pas (`nouveau`, `compte`, `ancien`, `numero`) : les 4 mots sont dits dans le même ordre. |
| `A.ruleSub` | `W('N1','appel', 0, 2.1)` | `W('N1','appel', 0, 2.85)` | Même ancre (« appelle », après « compte, »). Le brouillon la mettait sur « avant », ce qui ne marche pas ici : « avant » est le premier mot de N1. |
| `A.ruleOut` | `max(rule + 3.8, END('N1') + .3)` | `Math.max(A.rule + 3.8, END('N1') + .4, A.ruleSub + 2.0)` | La sous-ligne de 3 lignes est tenue au moins 2 s (2,3 s simulées). |
| `A.shimmer` (nouveau) | (son à `A.ribbon`, sur « Douala ») | `WE('C5','douala', 0, 1.9) + .03` | Le ruban devient violet **sur** « Douala » (image), et le scintillement vient **après** le mot. |
| `A.sig` | `T.N2 - .03` | `T.N2 - .5` | Le balafon (1,3–1,7 kHz) masquait « Bonzini ». Il joue maintenant dans la pause, avant « Ensuite ». `music().sigAt` suit. |
| `A.plateBZ` | `W('N2','bonzini')` | `T.N2 - .2` | La plaque et son « tonk » (0,8) tombent avant la phrase, et la voix lit ensuite ce qui est écrit. Après « Cargo », c'était impossible : « amène » suit sans pause. `A.service` ne change pas (sur « Chine »). |
| `A.cta` | `T.N3` | `T.N3 - .12` | Le « pop » de la pastille vient avant « Écris ». |
| `A.stampEnd` | `W('N3','maintenant') - .1` | `W('N3','maintenant', 0, 3.3) - .32` | Le tampon frappe dans la pause, puis la voix le lit. |
| `T.end` (contrainte) | — | `≥ max(END('N3') + .7, A.stampEnd + 1.5)` | La boucle (`end − .55`) part après « sais ». |

**Inchangés**, car ils suivent leur nouvelle ancre :
- `presses`, `hook2`, `dezoom`, `land`, `hookOut`, `pillQ`, `label`, `toiIn`, `hearts`, `toiTxt1`, `advance0`, `bonk`,
  `c2cap` ;
- `band`, `c2capOut`, `aside`, `bandOut`, `supIn1`, `tremble`, `slow0`, `slow1`, `shatter`, `peel`, `fauxStamp`, `major` ;
- `rule`, `supOut`, `gulp`, `hic`, `cont`, `violet`, `leap`, `enter`, `ribbon`, `bzLabel`, `doors`, `tagBZ`, `service` ;
- `endcard`, `tagLine`, `loop0`, `out`.

**Ancres de mots qui disparaissent** :
- `W('C3','que')` ;
- `W('T3','dit')`, qui devient `W('T3b','dit')` ;
- `W('N2','bonzini')`.

Toutes les autres restent valables : attends, paie, compte, ne, cœurs, je, dit, nouveau, compte, ancien, numero, appel,
douala, chine, maintenant.

**Valeurs attendues** (simulation à 3,6 syl/s) :

| Partie du film | Valeurs |
|---|---|
| Accroche et T1 | bulle 3,53 · cœurs 4,33 / 4,68 / 5,03 |
| T2 et C2 | « aww » 9,54 · `toiTxt2` 10,51 · bond 11,12 · atterrissage 11,42 · C2 11,67 |
| L'appel | « ALLÔ ? » 18,43 · sonnerie 18,51 · déclic 18,91 · T3 19,01 · `supIn0` 19,58 · T3b 20,16 · `supIn1` 20,43 · `toiRien` 20,48 |
| La chute | tampon 22,23 · bris 22,68 · « FAUX MESSAGE » 22,98 · C4 23,11 · accord 24,82 · « clink » 24,87–25,07 |
| La règle | `rule` 25,17 · N1 25,32 · sous-ligne 28,25 · `ruleOut` 30,59 |
| La marque | conteneur 30,50 · C5 30,65 · ruban 31,76 · balafon 32,64 · plaque 32,94 · N2 33,14 · légende 37,43 |
| La fin | carte de fin 39,27 · pastille 39,35 · N3 39,47 · tampon rituel 42,28 · accord final 44,16 · boucle 44,29 · fin 44,84 |

**Tenues des textes clés** (`tools/check_text.js`, au plus 3 blocs à la fois) :
- **les plus courtes** : « NE PAIE PAS SUR CE COMPTE ! » 1,79 s · « ALLÔ ? » 2,06 s · « IL N'A RIEN CHANGÉ ! » 1,85 s ·
  légende Bonzini 1,84 s (c'était 1,42 s) · carte C5 2,04 s ;
- **les plus longues** : sous-ligne de la règle 2,34 s · « FAUX MESSAGE » 2,34 s · règle seule 5,42 s.

À 3,8 syl/s, la plus courte reste ≥ 1,70 s.

### 7.3 Sons et musique (`soundCues()` / `music()`, l. 470–493)
**Remplacer le bloc entier** par celui-ci. Il est testé : aucun son court ne commence dans un mot à 3,5, 3,6 ni 3,8 syl/s.
Seules exceptions voulues :
- les « thok_soft » graves des pressions de l'accroche, sous la bande du téléphone ;
- les 4 « tic » de la règle, à 0,2 ;
- le « low_riser », qui est une nappe et non un coup.
```js
/** v2 (voice first): a short sound must never START inside a spoken word — it slides to that word's end (+.03 s),
 *  and on to the next word's end if the words touch (at most +.6 s; past that it keeps its time at half gain) */
function outOfWords(t) {
  let u = t;
  for (let n = 0; n < 8; n++) {
    let hit = null;
    for (const id of LINES) { if (u < T[id] - .05 || u > END(id) + .03) continue;
      for (const w of WORDS[id] || []) { if (/^[«»!?.,…-]+$/.test(w.w)) continue; if (u > T[id] + w.s - .03 && u < T[id] + w.e) { hit = T[id] + w.e + .03; break; } }
      if (hit) break; }
    if (hit === null) return { t: u, k: 1 };
    u = hit;
  }
  return u - t <= .6 ? { t: u, k: 1 } : { t, k: .5 };
}
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => { if (t >= 0 && t < T.end) Q.push({ t: +t.toFixed(4), name, g, pan }); };
  const used = [], qx = (t, name, g = 1, pan = 0) => {      // pushed out of the words, never two on the same instant
    const o = outOfWords(t); let u = o.t; while (used.some(x => Math.abs(x - u) < .07)) u += .08; used.push(u); q(u, name, g * o.k, pan); };
  q(0, 'thok_glass'); q(.02, 'glass_crackle', .3); q(0, 'breath_cut', .3); q(.05, 'gecko_skitter', .3, -.6);
  A.presses.slice(1).forEach(p => q(p, 'thok_soft', .3));                       // low thuds: under the phone band
  qx(A.dezoom, 'whoosh_soft', .25); q(A.land, 'parcel_land', .7, -.3);
  q(A.bubble, 'ding_msg', .8); A.hearts.forEach((h, i) => qx(h, 'heart_pop', .25, .1 * i));
  q(A.toiIn, 'plate_pop', .4, .2); qx(A.aww, 'aww_guitar', .5);
  q(A.jump, 'whoosh_small', .4); q(A.jumpLand, 'boing_carton'); q(A.bonk, 'bonk', .7, .2); q(A.jumpLand + .05, 'gecko_skitter', .35, -.6);
  q(A.band, 'band_in', .35); A.ring.forEach(r => q(r, 'phone_ring', .7, .4)); qx(A.allo - .1, 'plate_flip', .5, .2); q(A.pickup, 'phone_pickup', .5, .3);
  q(A.supIn0, 'steel_descend', .25); q(A.tremble, 'low_riser', .4);
  qx(A.toiOut, 'whoosh_small', .3, .4);
  q(A.stamp, 'big_stamp'); q(A.stamp + .04, 'crack_glow', .6); q(A.shatter, 'glass_shatter');
  q(A.peel, 'peel', .4); q(A.fauxStamp, 'stamp');
  A.roll.forEach((r, i) => qx(r, 'clink', .5, -.3 - .15 * i)); q(A.major, 'major');
  A.ruleW.forEach(w => q(w, 'tic', .2)); qx(A.gulp, 'gloup', .8, -.6);                // v2: the 'hic' is silent (it fell in C5)
  q(A.violet, 'violet_hum', .4); qx(A.enter, 'glass_tonk', .45); qx(A.shimmer, 'ribbon_shimmer', .3);
  qx(A.bzLabel, 'label_slap', .3); q(A.sig, 'bonzini_sig'); q(A.plateBZ, 'tonk', .8);   // v2: 'doors_close' and 'pin' dropped (they piled up in the pause)
  qx(A.endcard, 'whoosh_soft', .4); q(A.cta, 'pop', .5); q(A.stampEnd, 'stamp_big'); q(A.loop0, 'whoosh', .6);
  q(Math.max(END('N3') + .02, T.end - .9), 'final_chord'); q(T.end - .1, 'toc_glass', .6);
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa, pas-recu/lib/makossa.py): silent hook, tense from the bubble (after C1), dead cut before C2,
 *  the major CHORD only after « C'était un faux message ! » (held, ≥ 14 dB under THE RULE), full makossa from the container */
function music() { return { silentUntil: A.bubble, tenseFrom: A.bubble, cut: A.cut, majorFrom: A.major, fullFrom: A.cont, sigAt: A.sig, end: T.end }; }
```
Ajouter `outOfWords` à l'objet exporté `SCORE` (l. 495).

**Ce qui change dans les sons** :
- **Retirés** :
  - la 2e sonnerie ;
  - « line_tone » (une tonalité de ligne après « Allô ? » n'a pas de sens) ;
  - les 3 « boing_small » des sauts de joie ;
  - « boing » au départ du saut dans le conteneur (il tombait dans « On se voit ») ;
  - « hic » (il tombait dans C5) ;
  - « doors_close » et « pin ».
- **Nouveau** : « phone_pickup », un clic court de décroché à synthétiser. À défaut, utiliser « tic » à 0,5.
- **Gains baissés** :
  - accroche : `glass_crackle` 0,6 → 0,3 (il touchait « Patron ») · `breath_cut` 0,5 → 0,3 (à 0,0) · `thok_soft` 0,45 → 0,3 ;
  - T1 et T2 : `heart_pop` 0,5 → 0,25 · `aww_guitar` 0,7 → 0,5 ;
  - l'appel : `phone_ring` 0,8 → 0,7 · `steel_descend` 0,4 → 0,25 · `low_riser` 0,7 → 0,4 ;
  - la chute : `peel` 0,6 → 0,4 · `clink` 0,7 → 0,5 ;
  - la règle et la marque : `tic` 0,35 → 0,2 · `glass_tonk` 0,7 → 0,45 · `ribbon_shimmer` 0,5 → 0,3 · `label_slap` 0,5 → 0,3 ;
  - la fin : `pop` 0,7 → 0,5.

**Musique** :
- Silence jusqu'à la bulle (`A.bubble`, après C1). Ensuite, la makossa tendue.
- **Coupure nette** à `A.cut`, avant C2.
- `majorFrom`, après C4 : **seulement l'accord majeur, tenu**, au moins 14 dB sous la voix jusqu'à la fin de N1. La règle,
  phrase la plus importante du film, n'a plus la makossa pleine en face d'elle.
- `fullFrom` (**nouvelle clé**, = `A.cont`) : la makossa pleine sous C5 et N2.
- **Le mixage de l'épisode 4**, qui n'a pas encore son `lib/audio_ep4.py`, reprend les réglages de `ep2/lib/audio_ep2.py` :
  - `DUCK_DB 12`, `SFX_DUCK_DB 9`, `HIT_DUCK_DB 6` ;
  - un **passe-haut à 150 Hz** sur la musique, pour le haut-parleur du téléphone ;
  - la voix toujours au moins 10 dB au-dessus de la musique.

**À ajouter au contrôle** (comme pour l'épisode 2) : aucun cue de cette liste ne doit commencer dans une fenêtre
`[s − .03, e]` d'un mot de `timing.json` › `words`.

`ding_msg`, `heart_pop`, `aww_guitar`, `boing_carton`, `bonk`, `phone_ring`, `plate_flip`, `phone_pickup`, `big_stamp`,
`glass_shatter`, `peel`, `stamp`, `clink`, `major`, `gloup`, `glass_tonk`, `ribbon_shimmer`, `label_slap`, `bonzini_sig`,
`tonk`, `pop`, `stamp_big`, `final_chord`.

### 7.4 Les textes : lignes prêtes à coller
**`TEXTS()`** (l. 366–396) :
```js
[A.hook2, A.hookOut, 'hook2', 'NE PAIE PAS|SUR CE COMPTE !', 'speech2', null],
[A.toiIn, A.toiTxt1, 'toi0', 'IL A CHANGÉ DE COMPTE.', 'object', 'toi'],
[A.toiTxt1, A.toiTxt2, 'toi1', 'TROIS CŒURS, C’EST LUI !', 'object', 'toi'],
[A.toiTxt2, A.allo, 'toi2', 'JE PAIE.', 'object', 'toi'],
[A.c2cap, A.c2capOut, 'c2', 'CE N’EST|PEUT-ÊTRE PAS|TON FOURNISSEUR !', 'speech', null],
[A.toiRien, A.toiOut + .25, 'toi4', 'IL N’A RIEN CHANGÉ !', 'object', 'toi'],
[A.ruleSub, A.ruleOut, 'ruleSub', 'avant de payer,|appelle le numéro|que tu connais déjà.', 'ruleSub', null],
[Math.max(T.C5, A.ruleOut), Math.min(A.plateBZ - .25, T.N2 + .15), 'c5', 'ON SE VOIT|À DOUALA !', 'speech', null],
```
**`toiPlate()`** (l. 307–319) :
- `txt = 'IL A CHANGÉ|DE COMPTE.'` (valeur initiale) ;
- `'TROIS CŒURS,|C’EST LUI !'` ;
- `'JE PAIE.'` ;
- `'IL N’A RIEN|CHANGÉ !'`.

**`60_type.js`** :
- l. 115 : `'CE N’EST|PEUT-ÊTRE *PAS*|*TON FOURNISSEUR !*'` et `'ON SE VOIT|À *DOUALA* !'` ;
- l. 116 : `'*NE PAIE PAS*|SUR CE COMPTE !'` ;
- `band()` : l'onglet « TA COMMANDE » (§3).

### 7.5 Autres fichiers
- **`overlay/scenes/22_commande.js`** :
  - l. 41 : `EMPH = /^(patron|attend|pas$|fournisseur|appelle|numero|connais|deja|faux|message|douala)/`, c'est-à-dire
    « ouf » remplacé par « faux|message » ;
  - commentaires l. 19 et 154 : « Ouf ! » devient « C'était un faux message ! ».
- **`overlay/scenes/01_score.js`** : commentaires l. 118, 230 et 492 (« Ouf ! »), et l. 22–23 (le 35 s et les `--stretch`).
- **`36_call.js`** :
  - commentaire l. 12 : « IL N'A RIEN CHANGÉ ! » ;
  - commentaire l. 16 : l'impulsion de réponse redescend après l'atterrissage de l'acier, sur « Il dit… » (T3b).
- **`MODULES.md` l. 139** : « Ouf ! » devient « C'était un faux message ! ».
- **`README.md`** :
  - l. 15, commande de recalage : `python3 ../retime.py . --tail-min .7`, sans `--stretch` inférieur à 1 ;
  - la liste des voix et la section « T/W anchors », d'après le §7.2 ;
  - « Known limits » : le colis qui atterrit cache maintenant « JE PAIE. », et non plus « OK, » ;
  - « Score API » : `music()` a maintenant `fullFrom`, et `outOfWords` est exporté.
- **`serie/SERIE.md`** › Épisode 4 :
  - l. 531, « Durée cible : 32 s » : ≈ 44–45 s (DICTION, règle 6) ;
  - l. 538, « TOI le lit à voix haute » : « le faux message n'a pas de voix ; TOI dit ce qu'il croit, et la bulle
    garde le texte écrit » ;
  - storyboard l. 545–558 : la colonne voix et les temps du §7.2 ;
  - « Voix : texte exact » (l. 562–577) et « Texte à l'écran » (l. 579–589) : reprendre les §1 et §3 ;
  - « Musique et bruitages » (l. 601–607) : la coupure avant C2, l'accord seul sous N1, la makossa pleine dès le conteneur ;
  - « Publication » (l. 622–637) : le §5 ;
  - tableau de vérification (l. 643 et 653) : « Ne paie pas sur ce compte », « Avant de payer sur un nouveau compte,
    appelle l'ancien numéro », et ≈ 44,8 s ;
  - « À valider par le patron » : §9.

### 7.6 La copie testée
Une copie de `01_score.js` avec toutes les modifications des §7.1 à §7.4 est dans
`/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/ep4v2/sim/overlay/scenes/01_score.js`.
- Le diff contre la version actuelle est dans `…/scratchpad/ep4v2/01_score_v2.diff`.
- Le générateur des temps simulés est `…/ep4v2/sim/mk_timing.py`, et le contrôle des sons dans les mots
  `…/ep4v2/sim/cues_check.js`.
- Les fichiers de l'épisode ne sont **pas** modifiés, sauf `data/script_v2.json` et ce document.

---

## 8. PHRASE-test (à mettre à jour dans `SERIE.md`)
> « Mon fournisseur m'écrit qu'il a changé de compte bancaire : je ne paie pas, je l'appelle sur le numéro que je connais déjà. Il dit qu'il n'a rien changé : c'était un faux message. Avant de payer sur un nouveau compte, j'appelle l'ancien numéro. Ensuite, Bonzini Trading Cargo amène ma commande de la Chine à Douala. »

**Seuil** :
- 4 personnes sur 5 citent « appeler l'ancien numéro (celui que je connais déjà) avant de payer » ;
- aucune ne dit que « Bonzini protège des arnaques » ;
- toutes voient que le faux n'est pas le vrai fournisseur.

**Question à ajouter au test à 5 personnes** : « Quel numéro faut-il appeler ? ». Réponse attendue : « celui que je
connais déjà ». Les mauvaises réponses sont « son ancien numéro » au sens d'un numéro qui ne sert plus, ou
« l'ancien compte ».

## 9. À valider par le patron
1. **La phrase de marque** « Ensuite, Bonzini Trading Cargo amène ta commande de la Chine à Douala. ». Elle remplace
   « Bonzini Trading Cargo : de la Chine à Douala. » et reprend le texte de publication.
2. **TOI ne lit plus le message** : il dit ce qu'il croit, au discours indirect (T1).
3. **L'appel en deux temps** : « Allô ? », puis la réponse écrite du vrai fournisseur, puis « Il dit qu'il n'a rien changé ! ».
4. **La commande dit « On se voit à Douala ! »**, sans « patron ». Le nom de la ville passe en fin de phrase, et ces 0,55 s
   compensent en partie les 0,8 s de « Il a mis trois cœurs ».
5. **Le gag** « Il a mis trois cœurs, c'est lui ! Je paie. », et l'option « Je paie vite. » (§6).
6. **La réponse WhatsApp au mot ALLÔ** (§5).
7. **La durée, ≈ 45 s** au lieu de 32 s : on a choisi d'être clair plutôt que court.

## 10. Retours des relectures : ce qui est repris, et pourquoi le reste ne l'est pas

**Auditeur test de Mboppi** :

| Problème | Décision |
|---|---|
| ALL, débit des prises | **Repris** (§2) : fenêtre de 3,6 à 3,9 syl/s par prise, prise la plus lente gardée, étirement de 1,10 à 1,25, jamais en dessous de 1,0 (C1 0,88 et C2 0,92 supprimés), génération en deux morceaux en dernier recours, `listen_test.py` sur le mixage. |
| N1, question dite à plat (« on te donne un compte ») | **Repris autrement** : « Avant de payer sur un nouveau compte, appelle l'ancien numéro. ». Il n'y a plus de question ni de « on », et la phrase garde 10 mots. Le « Si on te donne… » proposé faisait 13 mots (plus que les 12 permis), et gardait « on te donne » dans la voix de la marque. Les 4 mots de la carte sont dits dans le même ordre, et la phrase a 2 syllabes de moins. |
| C1, « pas » avalé | **Repris** : contrôle « pas » ≥ 0,12 s et reconnu ; craquement de vitre à 0,3 ; voix à 0,2 s. |
| C4, bruitages dans « faux message » | **Repris** : C4 part 0,13 s après le tampon ; les « clink » et les cœurs qui se posent viennent après « message » ; les sauts de joie sont sans son ; `peel` est à 0,4 et vient avant la phrase. |
| C2, atterrissage sur « Ce n'est » | **Repris** : l'atterrissage est à C2 − 0,25 (boing, bonk et coupure avant la voix). |
| T3, « Allô ? » sans réponse | **Repris** : deux prises (T3, T3b) avec 0,6 s de silence. La plaque d'acier, c'est-à-dire la réponse, descend dans ce silence. Le déclic tombe **avant** « Allô ? », car c'est le fournisseur qui décroche. |
| N1, musique | **Repris** : seulement l'accord tenu sous N1, la makossa pleine dès le conteneur (`music().fullFrom`), un passe-haut à 150 Hz. |
| T2, « trois cœurs » sans l'image | **Repris** : « Il a mis trois cœurs, c'est lui ! » (+0,8 s). C'est compensé en partie par C5 sans « patron » (−0,55 s), le repli que tu proposais toi-même. |
| N1, « l'ancien » (= le vieux) | **Repris** : pas de virgule dans le tts, un contrôle du silence entre « l'ancien » et « numéro », et la sous-ligne qui définit le numéro. |
| N2, « va » faible et « Avec Bonzini » | **Repris** : « Ensuite, Bonzini Trading Cargo amène ta commande… ». En plus, le balafon et la plaque ne tombent plus sur « Bonzini ». |
| C5, qui parle ? | **Repris** : aucun mot ajouté. Chaque réplique de la commande est signée à l'écran (l'onglet du bandeau pour C3). Contrôle de « Douala ». |

**Pédagogie et faits** :

| Problème | Décision |
|---|---|
| ALL, débit | **Repris** (voir plus haut), avec les mots à reconnaître du §2. |
| T1, virgule (« m'écrit-il ») | **Repris autrement** : le discours indirect « m'écrit **qu'**il a changé » donne une seule phrase et une seule idée, sans risque d'inversion, et coûte 0 s au lieu de 0,35 s. La phrase a la même construction que T3b (« Il dit qu'il n'a rien changé »). |
| N1, « ancien numéro » sans définition sur la carte | **Repris** : sous-ligne « avant de payer, appelle le numéro que tu connais déjà. », et la question à ajouter au test (§8). |
| T2, urgence | **Pas repris dans la version principale** : la durée serait de 45,1 s à 3,6 syl/s. L'urgence reste écrite dans la bulle (« PAIE ICI, VITE. ») et sur la ligne « Tague celui qui paie trop vite », et elle est dans la réponse WhatsApp. « Je paie vite. » est prévu en option si le film recalé fait ≤ 44,4 s (§6). |
| C2 et C3, notes fausses (`vocheck`) | **Repris** : C2 change pour la grammaire et la double négation, pas à cause d'une mesure. Les prises se choisissent avec `select_takes.py` (§2, point 4). |
| T3, « Allô ? » isolé | **Repris** : une prise à part, reconnue aussi dans la condition « music », avec 0,6 s de silence après ; une variante B en cas d'échec. |
| N3, « le mot » sur la pastille | **Voix : oui. Pastille : non** (§5) : avec « le mot », la case orange contiendrait « le mot ALLÔ » et la pastille dépasserait x = 960. **Variantes WhatsApp : reprises.** |
| DOC | **Repris** : la liste des sections de `SERIE.md` et `README.md` est au §7.5. |

**Corrigé en plus** (non relevé par les relectures, même famille de défaut : un bruit sur un mot clé) :
- le « ding » sur « compte » ;
- les 2 sonneries sur « que tu connais déjà » ;
- le « aww » sur « cœurs » ;
- le balafon et le « tonk » sur « Bonzini » ;
- le « boing » et le « tonk » dans « On se voit à Douala » ;
- le « gloup » sur « numéro » ;
- le « pop » sur « Écris » ;
- le tampon rituel sur « Maintenant » ;
- l'accord final sur « sais ».

Deux textes à l'écran changent aussi :
- la plaque de TOI pendant T1 dit « IL A CHANGÉ DE COMPTE. », en contraste avec « IL N'A RIEN CHANGÉ ! » ;
- la carte de C2 passe sur 3 lignes, plus lisibles.
