# « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) : voix v2, diction claire

Version finale du texte dit, après le retour du patron (« on ne comprend pas, il faut articuler, des mots simples, définir
avant d'utiliser »), les règles de `serie/DICTION.md`, le brouillon v2 et ses deux relectures (auditeur test de Mboppi ;
pédagogie et faits).

- **Fichier des voix** : `data/script_v2.json` (lu par `serie/tts_v2.py` et `serie/select_takes.py`).
- **En bref** :
  - 16 répliques : 12 pour la narratrice, 4 pour TOI ;
  - 128 syllabes dites, écrites pour 3,7 syllabes par seconde ;
  - durée estimée **≈ 44,6 s** (≈ 44,9 s si `retime.py` garde sa queue minimale de 1,2 s) ;
  - mot-clé **FICHE**.
- **Mêmes images, même ordre.** Deux temps muets deviennent dits : les 3 étiquettes « ? » (N1b) et « LA PROCHAINE
  COMMANDE » (N3a). Le moment clé reste muet. Seuls les identifiants des répliques, les ancres de temps et quelques
  textes à l'écran changent.
- **Une référence vérifiée** des changements de `01_score.js` (non appliquée au film) : §7.6.

---

## 1. Les répliques, dans l'ordre où elles sont dites

« = » dans la colonne `tts` : le texte envoyé à la synthèse est identique au texte affiché. « syll. » : syllabes dites
(c'est le compte qui sert au contrôle du débit, §2).

| id | qui | texte | tts | remplace | moment visuel (beat) | syll. |
|---|---|---|---|---|---|---|
| T1 | TOI (content) | Mes sacs sont arrivés ! | = | T1 (inchangée) | **ACCROCHE**, image 0 : le mème « commandé / reçu ». Le sac reçu retombe hors du carton (T1 + 0,35), avec le sous-titre de TOI. Pas de musique. | 6 |
| T2 | TOI (choqué) | Mais c'est pas ça ! | = (sans virgule) | T2 « Eh… c'est pas ça ! » | **IMPACT** : la plaque ambre « C'EST PAS ÇA ! » écrase le sous-titre juste avant « Mais » (slam = T2 − 0,12). Le margouillat sursaute, la makossa tendue entre. « Eh… » était entendu « Et ». « Mais » est un vrai mot, dit d'un seul cri, sans virgule. | 4 |
| N1 | narratrice | Ton fournisseur a fait ce que tu as écrit. | = | N1 « C'est ce que tu as écrit. » | **QUI A TORT ?** La pastille orange saute à N1 − 0,4, sans voix. La plaque d'acier calme (pastille « TON FOURNISSEUR · CHINE ») se pose à N1 − 0,2 et porte « IL A FAIT CE QUE / TU AS ÉCRIT. ». La voix dit qui a fait quoi, avec le mot de la pastille (« ton fournisseur »). | 12 |
| T3 | TOI (fier) | J'ai écrit : bonne qualité, comme la photo. | J'ai écrit, bonne qualité, comme la photo. | T3 « Sacs noirs, bonne qualité, comme la photo. » | **CE QUE TU AS ÉCRIT** : les plaques sortent (T3 − 0,4), puis la carte mince de TOI tombe (T3 − 0,15) et plie. La carte ne change pas. « J'ai écrit » répond mot pour mot à N1. Il dit aussi que la liste est la commande : sans lui, l'oreille peut croire que TOI décrit ce qu'il a reçu. | 11 |
| N1b | narratrice | La photo ne dit pas tout. | = | **nouvelle** (le temps muet des 3 étiquettes « ? ») | **LA PHOTO NE DIT PAS TOUT.** Le bandeau crème « LA PHOTO / NE DIT PAS TOUT. » arrive à N1b − 0,05. Juste après « tout », les 3 étiquettes « TAILLE ? », « MATIÈRE ? » et « POIGNÉES ? » s'épinglent sur le sac (END(N1b) + 0,03 / 0,25 / 0,47) : elles montrent ce « tout ». Le margouillat les suit de la tête. La phrase explique pourquoi « comme la photo » n'est pas une commande : le fournisseur n'a pas triché. Option : le polaroïd « LA PHOTO » frémit sur le mot « photo » (`W('N1b','photo')`). | 7 |
| N2 | narratrice | Le fournisseur choisit tout ce que tu n'écris pas. | = | N2 « Ce que tu n'écris pas… c'est lui qui le choisit. » | **LA LEÇON**, tenue. La 3e étiquette tombe, puis la musique s'arrête net (cut = N2 − 0,2) et le grillon chante. Le bandeau sombre « LE FOURNISSEUR / CHOISIT TOUT / CE QUE TU N'ÉCRIS PAS. » remplace le bandeau crème. La plaque « BONNE QUALITÉ » se ramollit en crêpe jusqu'à la fin de la phrase. Puis les 3 notes moqueuses. Le « lui » ambigu devient « le fournisseur ». | 13 |
| N3a | narratrice | La prochaine fois, fais une fiche. | = | **nouvelle** (le temps muet « LA PROCHAINE COMMANDE : ») | **LA PROCHAINE FOIS** : le vieux carton sort, la feuille vierge arrive, le bandeau crème « LA PROCHAINE FOIS, / FAIS UNE FICHE. » entre 0,1 s avant la voix. Le mot-clé est dit pour la première fois, sur l'image de la feuille. | 7 |
| N3 | narratrice | Écris tout : la matière, la taille, les poignées et l'emballage. | Écris tout, la matière, la taille, les poignées, et l'emballage. | N3 « Matière, taille, anses, emballage… tout par écrit. » | **LA FICHE** : les 4 plaques ambre tombent sur « matière », « taille », « poignées » et « emballage ». Les « ? » s'envolent et deviennent des ✓, les gants gribouillent. Le tampon orange « ÉCRIS TOUT » frappe en tête **après** la phrase (END(N3) + 0,05). La note violette « + MON ÉTIQUETTE BONZINI SUR CHAQUE CARTON » s'épingle 0,25 s plus tard ; elle est lue seule ≈ 0,7 s avant N4. « Anses » (entendu « hanse ») devient « poignées », le mot de tous les jours. | 15 |
| N4 | narratrice | L'échantillon, c'est un seul sac. | = | N4, 1re partie (« L'échantillon… ») | **L'ÉCHANTILLON**, défini AVANT l'usage. Les lignes 1-2 de la légende crème, « L'ÉCHANTILLON, / C'EST UN SEUL SAC. », arrivent à N4 − 0,05. La fiche rétrécit (≈ N4 + 0,75). Le colis kraft « ÉCHANTILLON » se pose dans la virgule après « L'échantillon, », puis UN seul sac en sort sur « un seul sac » (unbox = W(N4,'seul') − 0,1). | 8 |
| N4b | narratrice | Demande-le d'abord. | = | N4 (« …d'abord… ») | Les gants tiennent le sac sorti : c'est celui de la photo. La ligne 3 de la légende, « DEMANDE-LE D'ABORD. », entre avec la phrase. | 5 |
| N4c | narratrice | Garde-le pour comparer. | Garde-le, pour comparer. | N4 (« …et garde-le pour comparer. ») | Le polaroïd glisse à côté (≈ N4c − 0,25). La ligne 4, « GARDE-LE POUR COMPARER. », arrive sur « Garde », et l'étiquette kraft « À GARDER » est nouée sur « -le ». Le tampon « PAREIL ✓ » tombe dans la virgule, avant « pour comparer ». | 6 |
| — | (silence) | | | | **MOMENT CLÉ**, ralenti muet de ≈ 2,65 s. Le gros carton arrive (key = END(N4c) + 0,1) et l'échantillon tapote la plaque trois fois. P, A et S tombent, la coche ambre frappe à T4 − 0,2 et la makossa repart en majeur. | — |
| T4 | TOI (soulagé) | Voilà, c'est ça ! | = | T4 « Ahh… c'est ça ! » | Fin du moment clé : « C'EST ÇA ✓ » est recentré, avec la pastille TOI. « Ahh… » (reconnu à 29 %) devient « Voilà », un mot entier. | 4 |
| N5 | narratrice | La commande, c'est toi. | = | N5, 1re phrase « La description, c'est toi. » | **MARQUE** : la lumière violette et la signature au balafon arrivent à N5 − 0,35, **avant** la voix. La carte 1 des rôles, « LA COMMANDE, / C'EST TOI. », entre sur « commande ». 1er gloup du margouillat juste après « toi ». « La description » était jugé obscur ; « les détails » du brouillon s'entend « le détail », c'est-à-dire la vente au détail. « La commande » est le mot du commerce. Il exclut aussi « Bonzini achète pour moi » (service non vérifié). | 5 |
| N5b | narratrice | Le transport, c'est Bonzini Trading Cargo. | = | N5, 2e phrase | La carte 2, « LE TRANSPORT, C'EST / BONZINI TRADING CARGO. », entre sur « transport ». Zoom sur l'étiquette « BZ-482913 · EXEMPLE » et sur la note « collée par ton fournisseur sur chaque carton », qu'on lit sans l'entendre. 2e gloup dans la virgule après « transport, », 3e après « Cargo » : jamais sur « Bonzini ». « Bonzini » vient après « c'est ». | 11 |
| N6 | narratrice | Écris le mot FICHE en commentaire. | Écris le mot fiche, en commentaire. | N6, 1re phrase « Écris FICHE en commentaire. » | **FIN** : la carte de fin arrive à N6 − 0,25 (logo, « Chine → Douala · bateau ou avion »). La pastille « Écris FICHE en commentaire ↓ » rebondit sur « Écris ». « Le mot » dit que FICHE est un mot à taper ; sans lui, on peut comprendre « écris ta fiche dans les commentaires ». | 9 |
| N6b | narratrice | Maintenant, tu sais. | = | N6, 2e phrase | Le tampon rituel « MAINTENANT, TU SAIS. » tombe dans la pause, 0,3 s **avant** la voix, qui le lit ensuite. L'accord final vient après « sais ». Puis la boucle : « C'EST ÇA ✓ » remonte à la place du sous-titre de l'image 0. | 5 |

**Vérification des règles DICTION** :
- **Longueur** : chaque réplique fait 10 mots au plus (N3, la plus longue, en fait 10) et contient un verbe (les impératifs comptent).
- **Une idée par phrase** : l'ancien N4 (« d'abord… et garde-le ») est coupé en trois phrases.
- **Mots interdits** : aucun « … », aucun chiffre, aucune onomatopée, aucune ville chinoise, aucun sigle. « Bonzini » vient après « c'est ».
- **Vocabulaire** : jamais « envoyer », « transfert », « garanti », « gratuit » ni « moins cher ». Le paiement est absent.
- **Faits** : aucun fait nouveau, aucun service non vérifié. Le rôle de Bonzini se limite au transport et à l'étiquette, comme dans `SERIE.md`.
- **Mots remplacés plutôt que définis** :
  - « anses » → « poignées » ;
  - « la description » → « la commande » ;
  - « lui » → « le fournisseur » ;
  - « C'est… » sans sujet → « Ton fournisseur a fait… » ;
  - « Eh… » / « Ahh… » → « Mais » / « Voilà » ;
  - « tout par écrit » → « Écris tout ».

---

## 2. Fabrication des voix : contrôler chaque prise (le texte seul ne règle pas le débit)

Les anciennes prises allaient à 4 à 4,9 syl/s, et le labo mesure 4,2 à 5,0 syl/s pour cette voix. Le texte est écrit
pour **3,7 syl/s**, dans la fourchette 3,5–3,8 de DICTION.

0. **Avant de générer** : déplacer **toutes** les anciennes prises `audio/vo/*.wav` dans `audio/vo_v1/`.
   - `tts_v2.py` saute une prise qui existe déjà.
   - Les ids T2, N1, T3, N2, N3, N4, T4, N5 et N6 gardent leur nom mais changent de texte : sans ce déplacement, `select_takes.py` choisirait d'anciennes prises.
   - T1 ne change pas, mais on la régénère quand même avec les réglages de clarté v2.
1. **Fenêtre de débit, prise par prise** : syllabes (colonne « syll. ») ÷ durée parlée (`takes.json` `dur`), entre **3,6 et 4,0 syl/s**.
   - Au-dessus de 4,0 : régénérer plus lentement (`padding_bonus`), ou étirer sans changer la hauteur avec `serie/retime.py ep3 --stretch N3=1.1,…`. Le facteur multiplie la durée ; ne jamais dépasser **1,15**, sinon les voyelles ondulent et les consonnes bavent sur un haut-parleur de téléphone (c'est la plainte du patron).
   - **La lenteur vient surtout des pauses du §6**, pas de l'étirement.
   - Sous 3,6 : on accepte la prise seulement si le film reste ≤ 45 s (§6).
   - Attention aux unités : le `rate` de `select_takes.py` compte « c'est » ou « l'é- » comme 2 syllabes. Il lit donc ≈ 8 % plus haut que la colonne (3,7 ici ≈ 4,0 là-bas).
2. **Durées parlées** :

   | Réplique | N3 | N2 | N1 | T3, N5b | N6 | N4 | N1b, N3a | T1, N4c | N4b, N5, N6b | T2, T4 |
   |---|---|---|---|---|---|---|---|---|---|---|
   | Cible (3,7 syl/s) | 4,05 s | 3,5 s | 3,25 s | 2,95 s | 2,45 s | 2,15 s | 1,9 s | 1,6 s | 1,35 s | 1,1 s |
   | Minimale (4,0 syl/s) | 3,75 s | 3,25 s | 3,0 s | 2,75 s | 2,25 s | 2,0 s | 1,75 s | 1,5 s | 1,25 s | 1,0 s |
3. **Mots qui doivent être reconnus**. Le contrôle passe par `serie/select_takes.py` / `voice_score.py` : ASR « small », filtre téléphone, musique à 10 dB. Une prise qui rate un mot de cette liste est rejetée.

   | Réplique | Mots à entendre | Rejeter si on entend |
   |---|---|---|
   | T1 | « sacs », « arrivés » | |
   | T2 | « Mais c'est pas ça », dit d'un seul cri | « Et c'est pas ça », « Mais » isolé |
   | N1 | « fournisseur », « a fait », « écrit » | |
   | T3 | « j'ai écrit », « bonne qualité », « photo » | |
   | N1b | « photo », « pas tout » | |
   | N2 | « fournisseur », « choisit », « n'écris pas » | « ne crie(s) pas » |
   | N3a | « prochaine fois », « fiche » | « affiche » |
   | N3 | « matière », « taille », « poignées », « emballage » | « hanse ». « Poignets » est toléré par l'ASR, mais la voix doit bien dire pwa-NYÉ |
   | N4 | « échantillon », « seul sac » | |
   | N4b | « demande », « d'abord » | |
   | N4c | « garde », « comparer » | |
   | T4 | « voilà », « c'est ça » | |
   | N5 | « commande », « toi » | |
   | N5b | « transport », « Bonzini » | « Bondini », « Bonsigny » |
   | N6 | « le mot », « fiche », bien isolé | « affiche » |
   | N6b | « tu sais » | |
4. **N5b, la marque** : générer au moins 4 graines (`--seeds 1,2,3,4 --only N5b`) et garder seulement une prise où l'ASR écrit « Bonzini ».
   - Cette ligne peut être un peu plus lente que les autres (≈ 3,3 syl/s), avec un étirement de 1,15 au plus.
   - Si aucune prise ne passe, variante B du tts : « Le transport, c'est : Bonzini Trading Cargo. ».
   - Ne **jamais** changer l'ordre des mots : les ancres `transp` et `bonz` en dépendent.
5. **N6, le mot-clé** : garder la prise où l'ASR isole le mieux « fiche ».
   - **A** (dans le JSON) : « Écris le mot fiche, en commentaire. ».
   - **B** : « Écris le mot, fiche, en commentaire. ».
6. **T2 et T4** : à volume normal, sans syllabe isolée. Si l'ASR entend « Et » au lieu de « Mais », changer de graine, pas de texte.
7. **N3** : si « poignées » est avalé, garder la version A, déjà avec des virgules autour du mot, et changer de graine.
8. **Après le mixage** : `python3 serie/listen_test.py ep3 audio/mix.wav`. Chaque réplique doit atteindre au moins 90 %, et les mots du point 3 doivent être reconnus.

---

## 3. Textes à l'écran : ce qui change

Toutes les mesures sont faites avec les vraies polices (`assets/fonts`, Satoshi 900 et Stencil), selon les règles de
`60_type.js` `sizes()` / `block()`.

| Élément | Avant | Après | Où dans le code |
|---|---|---|---|
| Plaque d'acier du fournisseur | `["C'EST CE QUE", 'TU AS ÉCRIT.']` | `['IL A FAIT CE QUE', 'TU AS ÉCRIT.']` | `01_score.js` `PLATE_TXT.steel` (ligne 242) ; commentaire `32_plates.js` ligne 12. La pastille « TON FOURNISSEUR » dit qui est « IL ». Les mots « a fait ce que tu as écrit » sont ceux de N1, et « J'AI » reste à TOI seul. La ligne la plus longue fait 436 px en Stencil 122, sous `maxText` 640 : la taille ne change pas. |
| **Bandeau N1b (nouveau)** | — | `'LA PHOTO\|NE DIT PAS *TOUT*.'`, style `bandCream` | `01_score.js` `TEXTS`, nouvelle ligne `[T.N1b - .05, A.band, 'photoTout', …, 'bandCream', null]`, avant `'lesson'`. Il est dessiné par `60_type.js` (style déjà géré, aucun code à ajouter). Mesures : 96 px, bloc de 263 px de haut (y 266–530), panneau de 927 px. Il est tenu 2,2 s, puis le bandeau sombre le remplace. |
| Étiquette n° 3 sur le sac | `'ANSES ?'`, `off: [10, -40]` | `'POIGNÉES ?'`, `off: [-30, -70]` | `01_score.js` `G.tagDef[2]` (ligne 165). L'étiquette mesure 409 px au lieu de 312. Au même endroit, son bord droit passerait à ≈ 1 060 px et elle couvrirait le texte de « TAILLE ? ». Recentrée en (816, 590) : x 612–1 020, y 547–633, sous le bas des bandeaux (543). **Vérifier les images** à `A.tags[2] + .3` et à `A.band + .2`. Si elle touche encore « TAILLE ? », dessiner cette seule étiquette en 46 px (372 px de large) : il faut alors une taille par étiquette dans `34_fiche.js` `tagW()` / `TAG_F`. Commentaire `34_fiche.js` ligne 15. |
| Bandeau de la leçon | `"CE QUE TU N'ÉCRIS PAS,\|^C'EST *LUI*\|QUI LE CHOISIT."` | `"LE FOURNISSEUR\|CHOISIT *TOUT*\|CE QUE TU N'ÉCRIS PAS."` | `01_score.js` `TEXTS` id `'lesson'`. Les 3 lignes restent à 72 px (aucune réduction), pour un bloc de 290 px (y 253–543). La version du brouillon, `"LE *FOURNISSEUR* CHOISIT\|TOUT CE QUE\|^TU N'ÉCRIS PAS."`, réduisait tout le bloc à 68 px. « TOUT » en orange fait écho à N1b et à N3. |
| Bandeau crème | `'LA PROCHAINE\|COMMANDE :'` | `'LA PROCHAINE FOIS,\|FAIS UNE *FICHE*.'` | `01_score.js` `TEXTS` id `'next'`. Mesure : 85 px (ajusté), y 279–517. |
| Les 4 plaques de la fiche | `['MATIÈRE', 'TAILLE', 'ANSES', 'EMBALLAGE']` | `['MATIÈRE', 'TAILLE', 'POIGNÉES', 'EMBALLAGE']` | `01_score.js` `FICHE.labels` (ligne 179). « POIGNÉES » mesure 364 px à 72 px, sous la limite de 426 px : pas de réduction. Commentaire `34_fiche.js` ligne 8. |
| Tampon en tête de fiche | `'TOUT PAR ÉCRIT'` | `'ÉCRIS TOUT'` | `01_score.js` `TEXTS` id `'stampAll'` ; dans `34_fiche.js`, valeur de secours ligne 358 et commentaires lignes 11, 357 et 373 ; commentaires `60_type.js` lignes 6 et 115. Les mêmes mots que N3. Le sprite passe de 973 à 724 px et reste centré sur `FICHE.stamp`. |
| Légende de l'échantillon | `"^L'ÉCHANTILLON\|^D'ABORD.\|GARDE-LE POUR COMPARER."` | `"L'*ÉCHANTILLON*,\|C'EST UN SEUL SAC.\|DEMANDE-LE D'ABORD.\|GARDE-LE POUR COMPARER."` | `01_score.js` `TEXTS` id `'capN4'`. Le « ^ » disparaît : avec lui, le bloc faisait 359 px (y 218–578) et sortait de la zone 225–575. On met l'accent par la couleur. Mesure : 4 lignes à 61 px, y 237–559. Changer aussi `lineIn` dans `60_type.js` ligne 164 (§7.5). |
| Carte 1 des rôles | `"LA DESCRIPTION,\|C'EST *TOI*."` | `"LA COMMANDE,\|C'EST *TOI*."` | `01_score.js` `TEXTS` id `'role1'` ; dans `70_bonzini.js`, valeur de secours ligne 209 et commentaires lignes 19 et 220. Le texte est plus court, donc il tient. |
| Pastille d'appel | `'Écris FICHE en commentaire'` | **inchangée** | La voix dit « le mot », la pastille garde la version courte (DICTION, règle 8). **Ne jamais écrire « le mot » dans `TEXTS` `'cta'`** : `76_end.js` ligne 129 extrait le mot-clé avec `/Écris (.+?) en commentaire/`, et mettrait « le mot FICHE » dans le champ au pochoir. La version longue mesurait aussi 1 022 px, et 1 145 px au rebond, plus large que l'image. |

**Inchangés** (la voix ne les dit pas, ou les dit déjà avec les mêmes mots) :
- la puce « JE SAVAIS PAS. · 3/5 », le bandeau « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU », « LA PHOTO », « Boutique · Mboppi » ;
- « C'EST PAS ÇA ! » (le cri de T2) et « QUI A TORT ? » ;
- la pastille « TON FOURNISSEUR · CHINE » ;
- **la carte de commande de TOI**, `['SACS NOIRS.', 'BONNE QUALITÉ.', 'COMME LA PHOTO.']` :
  - c'est le document qu'il a écrit ; on n'y imprime pas « J'AI ÉCRIT : » ;
  - « SACS NOIRS. » laisse vérifier à l'œil que le fournisseur a suivi ce qui était écrit (le sac reçu est noir) ;
  - « BONNE QUALITÉ. » reste la ligne qui se ramollit (`soggyLine: 1`) ;
- « TAILLE ? », « MATIÈRE ? », la note violette, « ÉCHANTILLON », « PAREIL ✓ », « À GARDER », « C'EST ÇA ✓ » ;
- la carte 2 des rôles, « BZ-482913 · EXEMPLE », « collée par ton fournisseur sur chaque carton » ;
- la carte de fin et « MAINTENANT, TU SAIS. ».

**Hors écran, à aligner** :
- `serie/SERIE.md` lignes 31, 38, 379–380, 384, 386–396, 398–414 (colonne voix), 416–430, 431–445, 485–500, 501–516 et 517–522 (§8) ;
- `ep3/README.md` lignes 46, 56, 74, 110–112, 117, 138–139, 159 et 185 ;
- `ep3/MODULES.md` lignes 124, 144, 146, 150, 157 et 203.

---

## 4. Définitions ajoutées (un mot difficile est expliqué avant d'être employé)

- **« échantillon »** :
  - **la définition d'abord** : N4 « L'échantillon, c'est un seul sac. », AVANT que le mot serve (N4b « Demande-le d'abord. », N4c « Garde-le pour comparer. ») et avant le moment clé, où on l'utilise ;
  - **à l'image, au même moment** : le colis « ÉCHANTILLON » se pose dans la virgule qui suit le mot, et UN seul sac en sort sur « un seul sac » (corrigé : avant, la définition passait pendant la lecture de la note violette, et le sac sortait 1,1 s après la fin de la phrase) ;
  - **à l'écran** : la légende l'écrit, ligne par ligne, au fil des trois phrases.
- **« fiche »** (le mot-clé) :
  - N3a « La prochaine fois, fais une fiche. » l'annonce, sur l'image de la feuille vierge et du bandeau « FAIS UNE FICHE. » ;
  - N3 dit tout de suite ce qu'on y écrit, pendant que la fiche se remplit ;
  - l'appel « Écris le mot FICHE » renvoie donc à une chose qu'on vient de voir et d'entendre.
- **« La photo ne dit pas tout. »** (N1b) : ce n'est pas une définition, c'est le lien logique qui manquait à l'oreille.
  - TOI a écrit « comme la photo » et le sac n'est pas comme la photo : sans N1b, N1 sonnait faux et poussait vers « le fournisseur a triché ».
  - Les 3 étiquettes montrent le « tout » que la photo ne dit pas : TAILLE, MATIÈRE, POIGNÉES.
  - N2 en tire la règle, puis N3 répète les mêmes mots.
- **« poignées »** remplace « anses », que l'ASR entendait « hanse » dans les deux prises.
- **« la commande »** remplace « la description ». C'est le mot de base du commerce, et il ne s'entend pas comme « le détail ».
- **Écrit seulement, jamais dit** (DICTION, règle 8, ne va que du dit vers l'écrit) :
  - « QUI A TORT ? » ;
  - les étiquettes « ? » ;
  - la note violette ;
  - « ÉCHANTILLON », « PAREIL ✓ », « À GARDER » ;
  - l'étiquette « BZ-482913 · EXEMPLE » et sa note ;
  - la ligne de services et la ligne de partage de la carte de fin ;
  - « Chine » (la pastille du fournisseur et la carte de fin le disent).

---

## 5. Mot-clé et publication

**Mot-clé : FICHE.** C'est un vrai mot, facile à dire et à taper, que tout le monde connaît. Il est dit deux fois (N3a,
N6), écrit trois fois (bandeau crème, pastille, réponse WhatsApp). À recopier dans `SERIE.md` › Épisode 3 › Publication (§8).

---

## 6. Durée estimée : ≈ 44,6 s (au plus 45 s)

**Calcul** : 128 syllabes ÷ 3,7 = 34,6 s de parole, plus 10,0 s de pauses, de moments muets et de queue. Le tableau donne
ces pauses ; ce sont elles que codent les valeurs par défaut du §7.1. La simulation du §7.6 (le vrai `01_score.js` modifié,
sur un `timing.json` synthétique) donne une fin à **44,59 s**.

| avant… | pause | ce qui s'y passe |
|---|---|---|
| T1 | 0,05 | le sac à mi-saut, le « pouf » |
| T2 | 0,30 | l'ombre de la plaque grossit ; slam à T2 − 0,12 |
| N1 | 0,40 | « QUI A TORT ? » à N1 − 0,4 (= fin de T2) ; la plaque d'acier se pose à N1 − 0,2 |
| T3 | 0,35 | les plaques sortent (T3 − 0,4), la carte de TOI tombe (T3 − 0,15) |
| N1b | 0,35 | — (le bandeau crème entre à N1b − 0,05) |
| N2 | 0,70 | les 3 étiquettes « ? », la coupure de la musique, le grillon, le bandeau sombre |
| N3a | 0,55 | les notes moqueuses, le vieux carton sort, le bandeau crème 0,1 s avant la voix |
| N3 | 0,35 | — |
| N4 | 1,00 | le tampon « ÉCRIS TOUT » (+ 0,05), la note violette (+ 0,3), lue seule ≈ 0,7 s |
| N4b | 0,35 | le sac est tenu en l'air |
| N4c | 0,35 | — (le polaroïd glisse à N4c − 0,25) |
| T4 | **2,65** | MOMENT CLÉ muet. C'est le minimum : key = END(N4c) + 0,1 et key ≤ T4 − 2,55 |
| N5 | 0,50 | la lumière violette et la signature au balafon (N5 − 0,35) |
| N5b | 0,35 | 1er gloup |
| N6 | 0,45 | 3e gloup ; la carte de fin (N6 − 0,25) |
| N6b | 0,40 | le tampon rituel (N6b − 0,3) |
| fin | 0,90 | l'accord final après « sais », la boucle (`retime.py` impose 1,2 aujourd'hui, §7.1) |

**Selon le débit des prises** (pauses du tableau ; queue de 0,9 s, ou de 1,2 s entre parenthèses) :

| Débit | 3,6 syl/s | 3,7 syl/s | 3,8 syl/s | 4,0 syl/s |
|---|---|---|---|---|
| Durée du film | 45,56 s (45,86) | **44,59 s** (44,89) | 43,68 s (43,98) | 42,0 s (42,3) |

- Le film dépasse les 20–35 s de `BRIEF.md` et les 33 s du storyboard, mais `DICTION.md`, plus récent et tiré du retour du patron, autorise 45 s (« mieux vaut 40 s claires que 30 s incompréhensibles »). L'ancien film durait 34,3 s, à ≈ 4,5 syl/s.
- Si la moyenne des prises tombe sous 3,7 syl/s, appliquer le plan de coupe.

**Si le recalage donne plus de 45 s**, couper dans cet ordre. Les quatre premiers points ne touchent aucun mot :
1. Queue de 0,9 s au lieu de 1,2 (§7.1) : −0,3 s.
2. Pause avant N4 : 1,0 → 0,9 s. La note est alors lue seule 0,6 s, et le colis tombe 0,1 s plus tard, sur « c'est » : baisser `tonk` de 0,8 à 0,5. Gain : −0,1 s.
3. Pauses avant N1, N5 et N6 : 0,40 / 0,50 / 0,45 → 0,35 / 0,45 / 0,40 : −0,15 s.
4. Pour N3, N2 et N1, les trois lignes les plus longues, préférer la prise la plus proche de 3,9 syl/s : environ −0,5 s.
5. En dernier recours seulement : N6 devient « Écris FICHE en commentaire. » (−2 syllabes, −0,55 s). On perd « le mot », qui empêche de comprendre « écris ta fiche dans les commentaires ».

**À ne jamais couper** : N1b, N4 (la définition) et « J'ai écrit ».

**Options écartées pour la durée** (à reprendre seulement si le mixage final fait ≤ 44 s) :
- T3 « J'ai écrit : sacs noirs, bonne qualité, comme la photo. » : +0,55 s. La carte montre déjà « SACS NOIRS. ».
- N4c « Garde-le pour comparer avec ta commande. » : +1,1 s.
- N5b « Le transport depuis la Chine, c'est Bonzini Trading Cargo. » : +1,1 s.
- N3a « Pour ta prochaine commande, fais une fiche. » : +0,55 s.
- N4 « L'échantillon, c'est un seul sac, pour voir. » : +0,55 s.

Chaque option change une prise et ses ancres (`garde`, `transp`, `bonz`…) : à recaler et revérifier.

---

## 7. Notes pour l'intégrateur visuel

Les images sont les mêmes, dans le même ordre. Les ids de la voix passent de 10 à 16 : N1b, N3a, N4b, N4c, N5b et N6b
s'ajoutent, et les ancres dérivées sont recâblées sur eux.

`data/script.json` doit être remplacé par `data/script_v2.json` (ou copié dessus) avant `retime.py` et `listen_test.py`,
qui lisent l'ordre des répliques dans `script.json`.

### 7.1 Valeurs par défaut de `T` et `DUR` (`01_score.js`, lignes 20–21)
**Piège de `retime.py`** :
- il garde l'écart entre les DÉBUTS des répliques par défaut ;
- une prise **plus longue** que son `DUR` par défaut mange donc la pause qui suit, jusqu'à `--gap` (0,12 s) ;
- les pauses structurelles du §6 sont alors perdues : le colis sur « échantillon », le moment clé de 2,65 s, le tampon rituel dans la pause.

Valeurs calculées à 3,7 syl/s avec les pauses du §6 :
```js
const T = { T1: .05, T2: 1.97, N1: 3.45, T3: 7.05, N1b: 10.37, N2: 12.96, N3a: 17.02, N3: 19.27, N4: 24.32, N4b: 26.83, N4c: 28.53, T4: 32.8, N5: 34.39, N5b: 36.09, N6: 39.51, N6b: 42.34, end: 44.59 };
const DUR = { T1: 1.62, T2: 1.08, N1: 3.24, T3: 2.97, N1b: 1.89, N2: 3.51, N3a: 1.89, N3: 4.05, N4: 2.16, N4b: 1.35, N4c: 1.62, T4: 1.08, N5: 1.35, N5b: 2.97, N6: 2.43, N6b: 1.35 };
```
**Obligatoire** : une fois les prises choisies (`takes.json`), réécrire ces valeurs avec les vraies durées (× l'étirement)
et les pauses du §6. Chaque réplique tombe alors exactement à sa place, et le film dure Σ des durées + 10,0 s.
```python
import json   # depuis ep3/ ; ST = mêmes facteurs que retime --stretch
P = [('T1', .05), ('T2', .30), ('N1', .40), ('T3', .35), ('N1b', .35), ('N2', .70), ('N3a', .55), ('N3', .35), ('N4', 1.0),
     ('N4b', .35), ('N4c', .35), ('T4', 2.65), ('N5', .50), ('N5b', .35), ('N6', .45), ('N6b', .40)]
tk = json.load(open('data/takes.json')); ST = {}; t, T, D = 0, {}, {}
for i, p in P: t += p; T[i] = round(t, 2); D[i] = round(tk[i]['dur'] * ST.get(i, 1), 2); t += D[i]
T['end'] = round(t + .9, 2); print('const T =', T); print('const DUR =', D)
```

**La queue, dans `serie/retime.py`** : `tail = max(1.2, …)` impose 1,2 s après N6b (+0,3 s). Deux solutions :
- ajouter une option `--tail-min 0.9`, comme demandé aussi pour l'épisode 2 ;
- ou corriger ensuite `end` dans `timing.json` à `max(END(N6b) + .9, A.stampEnd + 1.8)`.

Le tampon rituel tombe maintenant **avant** N6b : une longue queue ne sert plus à rien.

### 7.2 Temps d'action dérivés (`A`, `01_score.js`, lignes 61–138) : avant → après

La règle générale vient de l'épisode 2 : **un son fort ne commence jamais à l'intérieur d'un mot**. On le met dans une pause,
une virgule ou à la fin du mot. L'image peut rester sur le mot.

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `A.tags` | `mono([END('T3') + .1, + .4, + .7], .25)` | `mono([END('N1b') + .03, END('N1b') + .25, END('N1b') + .47], .22)` | Les « ? » illustrent « …ne dit pas tout. » ; les 3 coups de tampon tombent dans la pause. |
| `A.cut` | `T.N2 - .2` | `Math.max(T.N2 - .2, A.tags[2] + .03)` | La musique se tait sur le 3e tampon, jamais avant la dernière étiquette. |
| `A.soggy1` | `max(soggy0 + 1.2, W('N2','choisit') + .3)` | `Math.max(A.soggy0 + 1.2, END('N2') - .3)` | « choisit » arrive tôt dans la nouvelle N2 : la crêpe finit avec la phrase. |
| `A.next` | `max(END('N2') + .45, T.N3 - 1.1)` | `Math.max(END('N2') + .45, T.N3a - .25)` | Le bandeau « FAIS UNE FICHE. » est maintenant dit. |
| `A.lines` | `W(mati)`, `W(tail)`, `WA(['anse','hanse',…])`, `W(emball)` (fb 0 / .55 / 1.05 / 1.6) | `W('N3','mati',0,1.2)`, `W('N3','tail',0,2.15)`, `WA('N3',['poign','pogn','poing','poin'],0,2.6)`, `W('N3','emball',0,3.25)` ; `−.06` et `mono .35` inchangés | « poignées » ; plusieurs graphies de l'ASR ; valeurs de secours pour la phrase plus longue. |
| `A.stampAll` | `max(W('N3','tout') - .05, lines[3] + .5)` | `Math.max(A.lines[3] + .5, END('N3') + .05)` | « tout » ouvre maintenant N3 : le tampon garde sa place après la 4e ligne, et son coup tombe après la voix. |
| `A.note` | `max(W('N3','ecrit') + .3, stampAll + .55)` | `A.stampAll + .25` | `W('N3','ecrit')` n'existe plus. La note est lue seule ≈ 0,7 s avant N4. |
| `A.ficheAside` | `max(note + 1.45, T.N4 + .6)` | `Math.max(A.note + 1.45, T.N4 + .25)` | La note reste tenue 1,45 s ; la fiche part pendant « L'échantillon ». |
| `A.parcel` | `ficheAside + .1` | `Math.max(A.ficheAside + .1, WE('N4','echant',0,.95) + .02)` | Le colis « ÉCHANTILLON » (et son `tonk`) se pose dans la virgule qui suit le mot. |
| `A.unbox` | `max(parcel + .8, W('N4','abord') + .3)` | `Math.max(A.parcel + .8, W('N4','seul',0,1.45) - .1)` | UN sac sort sur « un seul sac » : la définition est montrée au moment où on la dit. |
| `A.garde` | `W('N4','garde') - .05` | `W('N4c','garde',0,0) - .05` | La ligne 4 de la légende entre sur « Garde ». |
| `A.pareil` | `max(W('N4','compar') - .25, polaIn + .5)` | `Math.max(W('N4c','pour',0,.6) - .1, A.polaIn + .5)` | Le tampon tombe dans la virgule de « Garde-le, », avant « pour comparer » ; il ne couvre plus « comparer ». |
| `A.keep` | `…W('N4','garde')…` | `Math.min(Math.max(W('N4c','garde',0,0) + .1, A.unbox + .45), A.taps[0] - .9)` | |
| `A.key` | `min(END('N4') + .45, taps[0] - .55)` | `Math.min(END('N4c') + .45, A.taps[0] - .55)` | = END(N4c) + 0,10 avec la pause de 2,65 s : le gros carton n'arrive jamais pendant « comparer ». |
| `A.violet` | `T.N5 - .2` | `T.N5 - .35` | |
| `A.sig` | `violet + .1` | `A.violet` | La signature au balafon passe AVANT « La commande ». Sur la voix, elle masquait les mots (épisode 2). |
| `A.role1` | `W('N5','descr') - .12` | `W('N5','command',0,.1) - .12` | |
| `A.role2` | `W('N5','transp') - .12` | `W('N5b','transp',0,.1) - .12` | |
| `A.bzName` | `W('N5','bonz')` | `WA('N5b',['bonz','bond','bons'],0,1.2)` | |
| `A.gulps` | `[violet + .8, milieu, END('N5') - .7]` | `mono([WE('N5','toi',0,DUR.N5) + .03, WE('N5b','transp',0,.75) + .03, Math.min(END('N5b') + .03, T.N6 - .3)], .5)` | Les gloups tombent dans les pauses, jamais sur « Bonzini ». Le 3e reste avant la carte de fin. |
| `A.stampEnd` | `W('N6','maint') - .08` | `Math.max(END('N6') + .05, T.N6b - .3)` | Le tampon rituel tombe dans la pause, puis la voix le lit (comme l'épisode 2). |
| `T.end` (contrainte) | `≥ N6 + 1,2` | `≥ Math.max(END('N6b') + .9, A.stampEnd + 1.8)` | |

**Inchangés** (formules intactes, qui suivent T1, T2, N1, T3, N4 et T4) :
- `bagLand`, `slam`, `shadow0`, `music`, `memeOut`, `qui`, `steel`, `clear`, `order` ;
- `band`, `soggy0`, `mock`, `sheet`, `capN4`, `polaIn`, `parcelOut`, `capN4Out` ;
- `check`, `letters`, `taps`, `amberBack`, `recentre`, `polaOut` ;
- `label`, `labelNote`, `hic`, `endcard`, `cta`, `tagLine`, `loop`, `out`.

### 7.3 Sons (`soundCues()` et `music()`)
**Cues à changer** :
- `q(A.soggy1 - .35, 'pffuit', .7)` → gain **.35** : il tombe sous « n'écris pas ».
- `q(x, 'clac', .9, …)` (les 4 plaques) → gain **.5**. Le coup arrive 60 ms avant « matière », « taille », « poignées » et « emballage », et ne doit pas en masquer la première consonne.
- `q(A.unbox - .3, 'kraft', .6)` → **.4**, sous « c'est un ».
- `q(A.label, 'label_slap', .5)` → **.3**, sous « La commande ».
- `q(A.cta, 'pop', .7)` → **.4**, sur « Écris ».
- `q(END('N6'), 'final_chord')` → `q(END('N6b') + .05, 'final_chord')`, et `music().finalChord` : `END('N6')` → `END('N6b') + .05`.

**Sans changement de code** : ces cues suivent leurs nouvelles ancres et tombent hors des mots.
- `tag_stamp` (pause N1b → N2) ;
- `stamp` de « ÉCRIS TOUT » (après N3) ;
- `tonk` (virgule de N4) ;
- `stamp` de « PAREIL ✓ » (virgule de N4c) ;
- `bonzini_sig` / `violet_hum` (avant N5) ;
- `gloup` ×3 (pauses) ;
- `stamp_big` du tampon rituel (pause N6 → N6b).

**À ajouter dans `tools/qa_score.js`** : aucun de ces cues ne doit commencer **dans un mot**, c'est-à-dire dans les
fenêtres `[s, e]` de `timing.json` `words` :

`boum`, `marbles`, `metal_set`, `card_flop`, `tag_stamp`, `stamp`, `tonk`, `stamp_big`, `carton_thud`, `bonzini_sig`,
`gloup`, `clink`.

### 7.4 Les textes : lignes prêtes à coller (`01_score.js`)
```js
const PLATE_TXT = { amber: "C'EST PAS ÇA !", steel: ['IL A FAIT CE QUE', 'TU AS ÉCRIT.'], order: ['SACS NOIRS.', 'BONNE QUALITÉ.', 'COMME LA PHOTO.'] };
{ txt: 'POIGNÉES ?', line: 2, pin: [40, -110], off: [-30, -70] },        // G.tagDef[2]
labels: ['MATIÈRE', 'TAILLE', 'POIGNÉES', 'EMBALLAGE'],                   // FICHE
// TEXTS (rows that change; 'photoTout' is new, just before 'lesson')
[T.N1b - .05, A.band, 'photoTout', 'LA PHOTO|NE DIT PAS *TOUT*.', 'bandCream', null],
[A.band, A.next, 'lesson', "LE FOURNISSEUR|CHOISIT *TOUT*|CE QUE TU N'ÉCRIS PAS.", 'bandDark', null],
[A.next, A.stampAll, 'next', 'LA PROCHAINE FOIS,|FAIS UNE *FICHE*.', 'bandCream', null],
[A.stampAll - .1, A.ficheAside + .2, 'stampAll', 'ÉCRIS TOUT', 'stampFiche', 'FS_fiche'],
[A.capN4, A.capN4Out, 'capN4', "L'*ÉCHANTILLON*,|C'EST UN SEUL SAC.|DEMANDE-LE D'ABORD.|GARDE-LE POUR COMPARER.", 'caption2', null],
[A.role1, A.endcard + .1, 'role1', "LA COMMANDE,|C'EST *TOI*.", 'role', 'BZ_roles'],
```

### 7.5 Autres fichiers
**Code** :
- `overlay/scenes/60_type.js` ligne 164 : la légende a maintenant 4 lignes. Les lignes 1-2 entrent sur N4, la 3e sur N4b, la 4e sur « Garde ».
  ```js
  if (st === 'caption2') block(t, a, b, s, 'cream', G.top.y, 62, ORANGE, { lineIn: i => i < 2 ? 1 : i === 2 ? easeOut(kk(t, T.N4b - .05, T.N4b + .15)) : easeOut(kk(t, A.garde, A.garde + .2)) });
  ```
  Commentaires d'en-tête : lignes 6 et 9.
- `overlay/scenes/34_fiche.js` :
  - valeur de secours `'TOUT PAR ÉCRIT'` → `'ÉCRIS TOUT'` (ligne 358) ;
  - commentaires des lignes 8, 11, 15, 357 et 373 ;
  - si besoin, une taille de police par étiquette (§3).
- `overlay/scenes/70_bonzini.js` : valeur de secours de `role1` (ligne 209) et commentaires des lignes 19 et 220.
- `overlay/scenes/32_plates.js` : commentaire de la ligne 12.
- `overlay/scenes/76_end.js` : rien à changer (pastille inchangée).

**Outils** :
- `tools/qa_score.js` :
  - `IDS` = les 16 ids ;
  - le contrôle du moment clé passe à N4c ;
  - les étiquettes de tenue « TOUT PAR ÉCRIT » / « ÉCHANTILLON D'ABORD » deviennent « ÉCRIS TOUT » / « L'ÉCHANTILLON, C'EST UN SEUL SAC » et « DEMANDE-LE D'ABORD », et on ajoute « LA PHOTO NE DIT PAS TOUT » ;
  - la fin des runs avec jitter devient `tm.N6b + tm.dur.N6b + .9` ;
  - nouveaux contrôles : étiquettes après N1b, tampon après N3, tampon rituel entre N6 et N6b ;
  - plus le contrôle « aucun son fort dans un mot » (§7.3).

  Tout est prêt dans `qa_v2.diff` (§7.6).

**Documentation** : `README.md` (ancres, tenues, CTA) et `MODULES.md` (lignes du §3).

### 7.6 Référence vérifiée (non appliquée au film)
Les changements des §7.1 à §7.4 ont été appliqués à une **copie** de `01_score.js` et de `tools/qa_score.js`, puis vérifiés
sur un `timing.json` synthétique. Ce fichier contient les 16 lignes au débit choisi, les pauses du §6 et des temps de mot
par syllabe.
- Correctifs prêts à appliquer, en diff unifié :
  - `/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/ep3v2/score_v2.diff` ;
  - `/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/ep3v2/qa_v2.diff`.
- Simulateur : `…/scratchpad/ep3v2/sim.py RATE TAIL`, qui écrit `ep3v2/data/timing.json`, puis `node ep3v2/tools/qa_score.js 60`.
- **Résultat** :
  - `qa_score` : « OK — no issue » sur le timing réel simulé à 3,6, 3,7 et 4,0 syl/s ;
  - sur 60 runs avec jitter (±0,4 s sur les débuts), un seul type d'alerte : « key moment starts under N4c » (14 sur 60). Le film actuel a la même alerte (11 sur 60 avec son contrôle « under N4 ») : elle vient du jitter de ±0,4 s sur T4 ;
  - sur le vrai timing, la pause de 2,65 s garde `key` = END(N4c) + 0,10.

**Valeurs attendues** (3,7 syl/s, valeurs par défaut du §7.1) :
- **Accroche** : `slam` 1,85 ; `qui` 3,05 ; `steel` 3,25 ; `clear` 6,65 ; `order` 6,90.
- **La photo et la leçon** :
  - N1b de 10,37 à 12,26 ; `tags` 12,29 / 12,51 / 12,73 ; `cut` 12,76 ;
  - N2 de 12,96 à 16,48 ; `soggy1` 16,18 ; `next` 16,93.
- **La fiche** :
  - N3a de 17,02 à 18,92 ; N3 de 19,27 à 23,32 ;
  - `lines` 20,28 / 21,11 / 21,71 / 22,54 ; `stampAll` 23,37 ; `note` 23,62.
- **L'échantillon** :
  - N4 de 24,32 à 26,48 ; `capN4` 24,27 ; `ficheAside` 25,07 ; `parcel` 25,36 (« échantillon » finit à 25,34) ; `unbox` 26,16 (« seul » à 25,97) ;
  - N4b de 26,83 à 28,18 ;
  - N4c de 28,53 à 30,16 ; `polaIn` 28,28 ; `garde` 28,48 ; `keep` 28,63 ; `pareil` 29,05.
- **Moment clé** :
  - `key` 30,25 ; `taps` 30,80 / 31,02 / 31,24 ; `letters` 31,50 / 31,85 / 32,20 ;
  - `check` 32,60 ; T4 de 32,80 à 33,89.
- **Marque** :
  - `violet` = `sig` 34,04 ; N5 de 34,39 à 35,74 ; `role1` 34,51 ;
  - N5b de 36,09 à 39,06 ; `role2` 36,23 ; `bzName` 37,25 ; `gulps` 35,77 / 36,90 / 39,09.
- **Fin** :
  - `endcard` 39,26 ; `cta` 39,51 ; N6 de 39,51 à 41,94 ;
  - `stampEnd` 42,04 ; N6b de 42,34 à 43,69 ; `loop` 43,99 ; fin 44,59.

**Tenues des textes clés** (au moins 1,4 s ; à 3,7 syl/s, puis à 4,0 syl/s entre parenthèses) :
- **Bandeaux** : « LA PHOTO NE DIT PAS TOUT » 2,21 (2,07) ; leçon 3,83 ; « FAIS UNE FICHE » 6,30.
- **Fiche** : « ÉCRIS TOUT » 1,70 ; note violette 1,45.
- **Légende de l'échantillon** : lignes 1-2 5,89 ; ligne 3 3,52 ; ligne 4 1,62 (1,50).
- **Autres textes** : « PAREIL ✓ » 1,80 ; rôle 1 4,50 ; rôle 2 2,78 ; « MAINTENANT » 1,95 ; CTA 4,23.
- Au plus 3 blocs de texte à la fois avant la carte de fin.

### 7.7 Ordre de travail
1. Déplacer `audio/vo/*.wav` dans `audio/vo_v1/` (§2.0).
2. `tts_v2.py ep3 --seeds 1,2,3`, puis `--seeds 4 --only N5b`.
3. `BED=… select_takes.py ep3`. Rejeter à la main toute prise qui rate un mot du §2.3.
4. Réécrire `T` / `DUR` avec les vraies durées et les pauses (§7.1).
5. Appliquer `score_v2.diff` et `qa_v2.diff`.
6. Copier `script_v2.json` sur `script.json`.
7. `python3 serie/retime.py ep3` (avec `--tail-min 0.9` si l'option existe).
8. `node tools/qa_score.js 40`.
9. Images de contrôle :
   - les étiquettes (`tags[2] + .3`) ;
   - les bandeaux (`band + .2`) ;
   - la légende de l'échantillon complète (`garde + .3`) ;
   - « POIGNÉES » sur la fiche ;
   - la carte des rôles.
10. Mixage.
11. `listen_test.py` : au moins 90 % par réplique.

---

## 8. À recopier dans `SERIE.md` (Épisode 3)

**Ligne 31** (tableau de production) : « 33 s » → « ≈ 44,6 s ».

**Ligne 38** (pitch) :
> **C'EST PAS ÇA.** « Commandé / reçu » : ton fournisseur a fait ce que tu as écrit, et la photo ne dit pas tout. Le fournisseur choisit tout ce que tu n'écris pas : fais une fiche, et l'échantillon d'abord.

**LA PHRASE-test** :
> « Il a écrit juste « bonne qualité, comme la photo » et il a reçu autre chose : la photo ne dit pas tout, et le fournisseur choisit tout ce que tu n'écris pas. Il faut faire une fiche, tout écrire, et demander l'échantillon d'abord, un seul sac, à garder pour comparer. La commande, c'est toi ; le transport, c'est Bonzini Trading Cargo, avec ton étiquette sur chaque carton. »

**Seuil du test** : inchangé. 4 personnes sur 5 citent « tout écrire / la fiche » ET « échantillon ». Aucune ne dit « le
fournisseur est un voleur » ni « Bonzini contrôle la qualité ».

**Durée cible** : ≈ 44,6 s (voix v2 claires, `DICTION.md`).

**Corrections des juges appliquées**, à ajouter :
- **Voix v2** (`ep3/SCRIPT_V2.md`) :
  - 16 phrases courtes, chacune avec un verbe ;
  - « La photo ne dit pas tout. » ;
  - « poignées » au lieu de « anses » ;
  - « La commande, c'est toi. » ;
  - l'échantillon est défini avant d'être employé ;
  - « Écris le mot FICHE ».
- La légende « LA PROCHAINE COMMANDE » devient « LA PROCHAINE FOIS, FAIS UNE FICHE. ».
- Corriger aussi le point « La fiche passe à 4 lignes » : ANSES → POIGNÉES.

**Storyboard, colonne « Voix / réplique »**. Les images ne changent pas. Les temps se recalent sur les voix (valeurs du §7.6).
- 0,0–1,45 : T1 « Mes sacs sont arrivés ! » (inchangé).
- 1,45–2,9 : T2 « Mais c'est pas ça ! ».
- 2,9–5,0 : N1 « Ton fournisseur a fait ce que tu as écrit. ». Texte de la plaque : IL A FAIT CE QUE TU AS ÉCRIT.
- 5,0–9,2 :
  - T3 « J'ai écrit : bonne qualité, comme la photo. », puis N1b « La photo ne dit pas tout. » ;
  - textes : LA PHOTO NE DIT PAS TOUT. · TAILLE ? · MATIÈRE ? · POIGNÉES ? ;
  - les étiquettes tombent APRÈS N1b.
- 9,2–13,0 : N2 « Le fournisseur choisit tout ce que tu n'écris pas. ». Texte : LE FOURNISSEUR CHOISIT TOUT CE QUE TU N'ÉCRIS PAS.
- 13,0–14,0 : N3a « La prochaine fois, fais une fiche. » (ce temps n'est plus muet). Texte : LA PROCHAINE FOIS, FAIS UNE FICHE.
- 14,0–17,6 :
  - N3 « Écris tout : la matière, la taille, les poignées et l'emballage. » ;
  - textes : MATIÈRE ✓ · TAILLE ✓ · POIGNÉES ✓ · EMBALLAGE ✓ · tampon ÉCRIS TOUT.
- 17,6–21,6 :
  - N4 « L'échantillon, c'est un seul sac. », N4b « Demande-le d'abord. », N4c « Garde-le pour comparer. » ;
  - légende : L'ÉCHANTILLON, C'EST UN SEUL SAC. / DEMANDE-LE D'ABORD. / GARDE-LE POUR COMPARER. ;
  - le sac sort sur « un seul sac ».
- 21,6–25,0 : ralenti muet, puis T4 « Voilà, c'est ça ! ».
- 25,0–29,6 :
  - N5 « La commande, c'est toi. », N5b « Le transport, c'est Bonzini Trading Cargo. » ;
  - textes : LA COMMANDE, C'EST TOI. · LE TRANSPORT, C'EST BONZINI TRADING CARGO. ;
  - les gloups tombent dans les pauses ;
  - la signature au balafon arrive avant la voix.
- 29,6–33,0 :
  - N6 « Écris le mot FICHE en commentaire. », N6b « Maintenant, tu sais. » ;
  - le tampon rituel tombe avant N6b.

**Voix : texte exact** :
- **Narratrice**, voix femme habituelle :
  - N1 « Ton fournisseur a fait ce que tu as écrit. »
  - N1b « La photo ne dit pas tout. »
  - N2 « Le fournisseur choisit tout ce que tu n'écris pas. »
  - N3a « La prochaine fois, fais une fiche. »
  - N3 « Écris tout : la matière, la taille, les poignées et l'emballage. »
  - N4 « L'échantillon, c'est un seul sac. »
  - N4b « Demande-le d'abord. »
  - N4c « Garde-le pour comparer. »
  - N5 « La commande, c'est toi. »
  - N5b « Le transport, c'est Bonzini Trading Cargo. »
  - N6 « Écris le mot FICHE en commentaire. » (tts « Écris le mot fiche, en commentaire. »)
  - N6b « Maintenant, tu sais. »
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « Mes sacs sont arrivés ! » (content)
  - T2 « Mais c'est pas ça ! » (choqué, un seul cri)
  - T3 « J'ai écrit : bonne qualité, comme la photo. » (fier, il lit sa commande)
  - T4 « Voilà, c'est ça ! » (soulagé)
- **Le fournisseur n'a pas de voix** : sa plaque dit « IL A FAIT CE QUE TU AS ÉCRIT. », sous la pastille « TON FOURNISSEUR · CHINE ».

**Texte à l'écran, dans l'ordre** :
1. « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU » (bandeau) · « LA PHOTO » (polaroïd) · « Boutique · Mboppi » · « JE SAVAIS PAS. · 3/5 »
2. « Mes sacs sont arrivés ! » (sous-titre, pastille TOI)
3. « C'EST PAS ÇA ! » (plaque ambre)
4. « QUI A TORT ? » (pastille orange) · « IL A FAIT CE QUE TU AS ÉCRIT. » (plaque d'acier, pastille « TON FOURNISSEUR · CHINE »)
5. « SACS NOIRS. BONNE QUALITÉ. COMME LA PHOTO. » (carton mince, TOI)
6. « LA PHOTO NE DIT PAS TOUT. » (bandeau crème) · « TAILLE ? » « MATIÈRE ? » « POIGNÉES ? »
7. « LE FOURNISSEUR CHOISIT TOUT CE QUE TU N'ÉCRIS PAS. »
8. « LA PROCHAINE FOIS, FAIS UNE FICHE. »
9. « MATIÈRE ✓ » « TAILLE ✓ » « POIGNÉES ✓ » « EMBALLAGE ✓ » · tampon « ÉCRIS TOUT »
10. « + MON ÉTIQUETTE BONZINI SUR CHAQUE CARTON » (note violette)
11. « L'ÉCHANTILLON, C'EST UN SEUL SAC. » · « ÉCHANTILLON » (colis) · « DEMANDE-LE D'ABORD. » · « GARDE-LE POUR COMPARER. » · « PAREIL ✓ » · « À GARDER »
12. « C'EST ÇA ✓ »
13. « LA COMMANDE, C'EST TOI. » · « LE TRANSPORT, C'EST BONZINI TRADING CARGO. » · « BZ-482913 · EXEMPLE » · « collée par ton fournisseur sur chaque carton »
14. Carte de fin : « Bonzini Trading Cargo · Chine → Douala · bateau ou avion » · « MAINTENANT, TU SAIS. » · « Écris FICHE en commentaire ↓ » · « Tague celui qui commande toujours « comme la photo » »

**Publication** :
- **Réponse WhatsApp FICHE** : la fiche de commande à remplir pour chaque produit. Elle commence par les 4 lignes vues dans la vidéo, dans le même ordre.
  - la matière ;
  - la taille (les dimensions) ;
  - les parties du produit (pour un sac : les poignées) ;
  - l'emballage ;
  - puis : la couleur, la quantité, l'étiquetage du produit ;
  - « mon étiquette Bonzini sur chaque carton » ;
  - « l'échantillon d'abord : un seul, garde-le pour comparer ».
- **Couverture** (A/B) : inchangée (« C'EST PAS ÇA ! » sur le mème, ou « C'EST ÇA » avec les lettres qui tombent). Seuls les temps changent.
- **Texte de publication** :
  > Ce que j'ai commandé / ce que j'ai reçu. « Bonne qualité, comme la photo » : la photo ne dit pas tout.
  > Le fournisseur choisit tout ce que tu n'écris pas. Fais une fiche pour chaque produit : la matière, la taille, les poignées ou les autres parties, la couleur, la quantité, l'emballage, l'étiquetage. Et l'échantillon d'abord : un seul, garde-le pour comparer.
  > La commande, c'est toi. Le transport, c'est Bonzini Trading Cargo : ton étiquette sur chaque carton, de la Chine à Douala.
  > Écris le mot FICHE en commentaire : on te donne la fiche de commande à remplir.
  > Tague celui qui commande toujours « comme la photo ».
  > #ImportChine #Mboppi #Douala #Commerçant #AchatChine
- **Commentaire épinglé** :
  > Qui avait tort ? Ton fournisseur a fait ce qui était écrit : « bonne qualité, comme la photo ». Mais la photo ne dit pas tout. Bien décrire ton produit sert aussi à la douane : c'est la description qui aide à trouver le bon code. Et l'échantillon reste ta référence pour comparer.

**Vérification règle par règle**, lignes qui changent :

| Règle | Comment elle est respectée |
|---|---|
| Phrases clés dites ET écrites | Toutes sont dites et écrites : « Ton fournisseur a fait ce que tu as écrit » (plaque « IL A FAIT CE QUE TU AS ÉCRIT. »), « La photo ne dit pas tout », « Le fournisseur choisit tout ce que tu n'écris pas », « Fais une fiche », « Écris tout », « L'échantillon, c'est un seul sac / demande-le d'abord / garde-le pour comparer », « La commande, c'est toi / le transport, c'est Bonzini Trading Cargo ». |
| Diction (`DICTION.md`) | 16 phrases de 10 mots au plus, chacune avec un verbe. Aucun « … », aucun chiffre, aucune onomatopée, aucune ville chinoise. Le texte est écrit pour 3,7 syl/s, et chaque prise est contrôlée à l'ASR avec filtre téléphone. |
| Fournisseur | Plaque calme, sans visage ni voix. Il a fait ce qui était écrit, et la voix explique pourquoi ce n'était pas assez (« la photo ne dit pas tout »). Aucun cliché. |
| Services vérifiés | « La commande, c'est toi » : Bonzini n'achète pas, ne choisit pas et ne contrôle pas. Seuls le transport et l'étiquette BZ. |
| Durée et mot-clé | ≈ 44,6 s (45 s au plus, `DICTION.md`), vertical, un mot-clé : FICHE (« Écris le mot FICHE en commentaire »). |

**À valider par le patron**, remplace les points 1 et 2 : voir le §9.

---

## 9. À valider par le patron
1. **La durée, ≈ 44,6 s au lieu de 33 s**. C'est le prix du débit lent et des deux temps muets désormais dits. `DICTION.md` autorise 45 s.
2. **La nouvelle phrase N1b, « La photo ne dit pas tout. »**, et le bandeau qui la reprend.
3. **Le bandeau des rôles** : « La commande, c'est toi. Le transport, c'est Bonzini Trading Cargo. » (au lieu de « La description, c'est toi. »).
4. **La réponse WhatsApp FICHE** (§8) : les 4 lignes de la vidéo d'abord, puis le reste de la liste.
5. **Option, non incluse : T3 avec « sacs noirs »**, « J'ai écrit : sacs noirs, bonne qualité, comme la photo. ». À reprendre seulement si le mixage fait ≤ 44 s (§6).
6. **Option d'alignement avec l'épisode 2** (ligne de partage, écrite seulement), à décider pour toute la série.
   - L'épisode 2 a remplacé « Tague » (un anglicisme) par « Montre ça à celui qui… ».
   - Ici, cela donnerait « Montre ça à celui qui commande|toujours « comme la photo » », dans `TEXTS` id `'tag'`.
   - Mesure : 669 et 596 px dans la boîte de 800 px, donc ça tient.

---

## 10. Retours des relectures : ce qui est repris, et pourquoi le reste ne l'est pas

**Auditeur test de Mboppi** (8/10) :

| Problème | Décision |
|---|---|
| T3 → N2 : rien ne dit à l'oreille pourquoi « comme la photo » ne suffit pas, et N1 sonne faux | **Repris** : nouvelle N1b « La photo ne dit pas tout. », avec son bandeau. Les 3 étiquettes sont ancrées après la phrase et illustrent « tout ». On a pris la version courte : « La photo ne dit pas la taille, ni la matière » coûtait 1,4 s de plus, et N3 dit ces mots 7 s après. |
| N5 « Les détails, c'est toi » : obscur, et entendu « le détail » (la vente au détail) | **Repris**, avec la formule de l'autre relecture : « La commande, c'est toi. ». « La fiche, c'est toi » n'est pas retenu : à l'oreille, « la fiche » se confond avec « l'affiche ». |
| Plaque d'acier à la 1re personne, contre la voix à la 3e personne | **Repris** : « IL A FAIT CE QUE / TU AS ÉCRIT. ». N1 dit « Ton fournisseur », le mot de la pastille. |
| N4c « comparer avec quoi ? » | **Non repris** : +1,1 s, ce qui ferait dépasser 45 s. Le moment clé montre la comparaison, et l'option est listée au §6. |
| N4b « avant la grosse commande » | **Non repris** (durée) : on garde « d'abord ». |
| N3a sans le mot « commande » | **Non repris** (durée). « Commande » est maintenant dit dans N5. |
| T2 : la virgule isole « Mais » | **Repris** : pas de virgule, ni dans le texte ni dans le tts. Une prise qui fait entendre « Et » est rejetée. |
| N3 : « poignées » / « poignets » | **Repris** : ancre `WA` sur plusieurs graphies, contrôle à l'ASR, virgules dans le tts. |
| N5b : « Bondini », et « Chine » jamais dit | **Repris** pour la marque : au moins 4 graines, une prise ne passe que si l'ASR écrit « Bonzini », débit un peu plus lent, aucun gloup sur le nom. **Non repris** pour « depuis la Chine » (durée) : la Chine est écrite deux fois à l'écran. |
| Débit et étirement | **Repris** : prises entre 3,6 et 4,0 syl/s, étirement de 1,15 au plus, lenteur tirée des pauses (§6, §7.1), au moins 90 % à `listen_test.py`. |

**Pédagogie et faits** (7,5/10) :

| Problème | Décision |
|---|---|
| T3 / N1 : rétablir « sacs noirs » | **Repris en partie**. La carte de commande ne change pas (« SACS NOIRS. »), et « J'AI ÉCRIT : » n'y est pas imprimé : l'œil voit que le sac noir suit ce qui est écrit. Dans la voix, on a donné la priorité à N1b, qui explique le problème au lieu de seulement le montrer. Les deux ensemble coûtaient +2,5 s, soit plus de 45 s à 3,7 syl/s. « Sacs noirs » reste une option (§6, §9). |
| N4 : la définition est entendue pendant la lecture de la note, et le sac sort 1,1 s trop tard | **Repris** : la note est lue seule ≈ 0,7 s (pause de 1,0 s avant N4), le colis se pose juste après « échantillon » et le sac sort sur « un seul sac ». Le compromis qui reste : la note est encore visible pendant le premier mot de N4 (elle doit tenir 1,45 s). |
| N5 « Les détails » : mot jamais dit avant, justification fausse | **Repris** : « La commande, c'est toi. ». La justification « mot répété » a disparu. |
| Pastille d'appel à 1 022 px (1 145 px au rebond) | **Repris** : la pastille reste « Écris FICHE en commentaire ». En plus, la regex de `76_end.js` aurait mis « le mot FICHE » dans le champ au pochoir. |
| Légende à 4 lignes trop haute (y 216–580), ligne 4 à 910 px | **Repris** : le « ^ » disparaît et l'accent passe par la couleur. Mesure : 61 px, y 237–559. |
| Étiquette « POIGNÉES ? » à 409 px, qui sort presque de l'image | **Repris** : nouvelle position (816, 590), à vérifier sur image, avec un repli à 46 px. |
| Durée sous-estimée (queue de 1,2 s, moment clé de 2,65 s au minimum) | **Repris** : moment clé de 2,65 s, débit de 3,7, queue de 0,9 s à demander à `retime.py`. Le §7.1 explique en plus le piège : une prise trop longue mange la pause suivante. Estimation : 44,6 s (44,9 s avec la queue actuelle). |
| Plaque d'acier (« J'AI FAIT… ») | **Repris** sous la forme « IL A FAIT CE QUE / TU AS ÉCRIT. ». |
| N4 : la définition donne la quantité, pas le but | **Non repris** (durée). Le but arrive dans N4b et N4c, et « pour voir » est listé en option. |
| `SERIE.md` et textes de publication | **Repris** (§8) : la réponse WhatsApp commence par les 4 lignes de la vidéo ; la leçon, la PHRASE-test et la voix exacte sont mis à jour. |

**Repris en plus, après vérification sur la copie du score** :
- aucun son fort dans un mot :
  - le tampon « ÉCRIS TOUT » tombait au milieu de « emballage » avec l'ancre du brouillon (`lines[3] + .5`) ;
  - « PAREIL ✓ » tombe dans la virgule ;
  - la signature au balafon arrive avant N5 ;
  - les gloups et le tampon rituel tombent dans des pauses ;
  - cinq gains sont baissés ;
- des formules qui tiennent si une prise dure plus ou moins longtemps que prévu : `cut ≥ tags[2]`, `gulps[2] ≤ N6 − .3`, `stampEnd ≥ END(N6)` ;
- les anciennes prises à déplacer avant `tts_v2.py`.
