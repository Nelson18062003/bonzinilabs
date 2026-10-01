# « Douane : combien ? » : teaser Bonzini Labs · Douane (montage final)

Le film part du concept « Le ticket sans fin » (24,5 pts). Il reprend des idées de « beat », « pov », « chaise » et « libre », et règle chaque défaut relevé par les trois juges (tableau 7.3).

**Durées :**
- montage principal : 24,0 s, soit 720 images, 12 mesures ;
- montage court : 15,0 s, soit 450 images.

---

## 1. Titre, logline, vérité émotionnelle, partage

**Titre :** « Douane : combien ? ». C'est le premier épisode de la série « Ni plus. Ni moins. ».

**Logline :** Un ticket de caisse imprime d'abord ce que le commerçant doit, et l'écrit noir sur blanc : « Ça, c'est dû. » Ensuite il ne s'arrête plus. Il imprime tout ce que le commerçant ne savait pas : le code, la valeur, les papiers, les jours au port. Le papier finit par recouvrir sa marge. Un trait violet coupe alors le ticket. Tout ce qu'on ignorait tombe en poussière, et il ne reste que les quatre lignes dues. L'imprimante essaie encore d'en reprendre une, mais la TVA refuse de partir. Ni plus. Ni moins. On ne voit le nom du module qu'à la fin.

**La vérité émotionnelle :** La douane n'est pas trop chère. Ce qu'on paie en trop, c'est ce qu'on ne savait pas. Le commerçant honnête ne veut pas payer moins. Il veut connaître son montant avant de payer son fournisseur, et payer ce qu'il doit, la tête haute.

**Ce qui vient des autres concepts :**
- **De « beat » :**
  - « Ça, c'est dû. » avant toute douleur ;
  - chaque ligne due est un instrument, et ces instruments jouent jusqu'à la fin ;
  - un bandeau de LED piloté par la grille musicale ;
  - à l'arrimage dans le téléphone, chaque segment de la barre se pose sur un coup de son instrument.
- **De « pov » :**
  - une frise de jours sans chiffre, avec un repère « franchise » ;
  - le moteur de l'imprimante est accordé en mi, et devient le log drum après le drop ;
  - les chiffres sont remplacés par « • » dans le DOM avant le flou ;
  - le lien n'est montré qu'après trois conditions ;
  - le trou du refrain est laissé vide deux fois.
- **De « chaise » :**
  - aucun chiffre lisible de tout le film ;
  - après le drop, chaque mot tombe sur un kick.
- **De « libre » :**
  - « plus… » chuchoté pendant la surcharge, si bien que « Ni plus. Ni moins. » sonne comme la réponse ;
  - un trait violet de référence qui ne bouge jamais, sur lequel la barre se verrouille ;
  - les captures sont faites sous 768 px CSS, ce qui fait disparaître les cartes flottantes du site.

**Pourquoi on le partagera :**
1. **L'image 0 est une affiche.** « Douane : combien ? » se lit sans le son, ce qui compte sur Facebook et WhatsApp, où la vidéo démarre muette. Puis « On verra… à l'arrivée. » : tous les importateurs ont déjà entendu cette réponse.
2. **Le spectateur est traité en commerçant honnête,** ni fraudeur ni victime. « Ça, c'est dû. » respecte la douane. On peut partager le film dans un groupe d'importateurs sans passer pour un râleur.
3. **Un proverbe facile à transférer :** « Ce qu'on ne sait pas… ça se paie. »
4. **Une surprise qui fait réagir.** La TVA refuse de partir : on voit « ni moins » sans un seul mot. Le commentaire vient tout seul : « même la TVA refuse de partir ».
5. **Une rime entre l'accroche et la réponse.** « On verra… à l'arrivée. » devient « On l'estime… avant. ». Le spectateur repart avec l'impression qu'il sait.
6. **Un son original qui porte le message.** Avant le drop, on chuchote « plus… plus… ». Après, on chante « Ni plus. Ni moins. » dans le kick qui manque. Le trou est laissé vide deux fois pour que l'oreille le remplisse. Le geste à reprendre : deux mains à plat, à la même hauteur.
7. **Une boucle parfaite.** Le même tampon « TCHAK » ouvre et ferme le film. La dernière image est la fente de l'image 0, ce qui invite à revoir.
8. **Une finition haut de gamme qui inspire confiance.** Une seule famille d'effets, un seul glitch, un seul impact grave, un seul silence. Les écrans sont les vrais écrans du site. Aucune économie n'est promise, donc le réflexe anti-arnaque ne se déclenche pas.

---

## 2. MONTAGE PRINCIPAL : 24,0 s

### 2.1 Réglages communs

**Format et grille**
- 1080×1920, 30 images/s.
- 120 BPM : 1 mesure = 2 s = 60 images ; 1 temps = 15 images ; 1 double croche = 125 ms = 3,75 images.
- Les événements visuels sont arrondis à l'image la plus proche. L'audio reste exact à l'échantillon près.
- Le script musical exporte la grille de 16 pas dans `data/grid.json` (instant, pas, instrument, vélocité). Ce fichier pilote les impressions, les LED et la pose des segments, ce qui garantit la synchro.

**Zones**
- Boîte sûre : x 120–960, y 270–1250. Sous y 840, aucun texte au-delà de x 780.
- Les sous-titres épinglés vont de y 360 à 800.
- La pastille de marque occupe y 272–345.

**Typographie**
- Satoshi seule :
  - 900 pour les titres, interlettrage −0,045 em ;
  - 700 pour les libellés et la marque, −0,02 em ;
  - 500 pour la texture et la mention légale.
- Taille minimale : 44 px.
- Espace fine insécable (U+202F) avant « : » et « ? ».
- Animation « pop » à l'apparition :
  - échelle 1,15 → 1,0 en 4 images ;
  - 1,06 → 1,0 pour les lignes de plus de 600 px ;
  - courbe du produit, `EASE` = cubic-bezier(0.16,1,0.3,1).
- Tous les textes ont été mesurés en Satoshi réel (§8). Le plus large est « Douane : combien ? » en 88 px : 750 px, 810 px au maximum du pop, donc sous la limite de 840 px.

**Couleurs** (tokens du produit)

| Rôle | Valeur |
|---|---|
| encre | #0D0D12 |
| gris | #86868F |
| ink3 | #6E6E78 |
| fond clair | #F5F5F7 |
| carte | #FFFFFF |
| violet | #A947FE |
| or | #F3A745 |
| orange | #FE560D |
| halo du téléphone | #281450 |

- Avant le drop : fond #0D0D12, jamais #000, avec 2 % de grain. Papier thermique #F7F4EC, tramé.
- Après le drop : le monde clair du produit, sans grain.

**L'imprimante avant le drop**
- Corps noir mat #16161C avec un biseau #2A2A31, de y 880 à 1920. Fente à y 880.
- LED d'état violette en x 160, y 950.
- Bandeau de 16 LED de pas (Ø 22 px, espacées de 34 px, x 220–764, y 950) piloté par `grid.json` :
  - blanc = coup dû ;
  - orange = coup de trop.

**L'imprimante après le drop**
- Blanche #FFFFFF, coins de 28 px, ombre douce. Fente à y 1100.
- LED violettes sur les pas 1, 5 et 9. La case 13 est cerclée de violet, et vide.

**Le ticket**
- Largeur x 120–960 ; le texte commence à x 160.
- Il sort de la fente vers le haut, incliné de 3° au plus (rotateX).
- Il avance par à-coups : il imprime une ligne, la tient au moins 12 images, puis saute de 132 px pour une ligne de 120 px.
- La ligne la plus récente se pose toujours en y 748–880.
- Seules les lignes de texture reçoivent du flou de mouvement.

**La pastille de marque** (image 0 à 599)
- Le vrai logo (73 px) et « Bonzini Labs » en Satoshi 700, 44 px, violet #A947FE. Ce sont les proportions exactes de l'en-tête du site.
- Position : x 120–459, y 272–345, sur une pilule #0D0D12 à 70 %.
- Au drop, elle passe à l'encre et perd sa pilule. À 20,0 s, elle devient l'en-tête du site.

**Effets**
- Une seule famille : la physique du papier (à-coups, rampes de vitesse, plis, poussière, élastique, ressort).
- Les écrans réels gardent le mouvement propre du site.
- Un seul glitch, un seul impact grave, un seul silence.

### 2.2 Tableau des plans

Pour les plans P10 à P13, les colonnes « Texte » et « Son » se lisent avec la §4.

| # | Mes. | t (s) · images | Visuel (caméra, mouvement) | Texte à l'écran (position, taille, couleur, animation) | Écran réel | Son (section + bruitages) | Effet |
|---|---|---|---|---|---|---|---|
| P1 | M1 | 0,0–1,0 · f0–29 | **AFFICHE (image 0).** L'imprimante et le ticket dans le noir. Le ticket sort de la fente ; son bord supérieur déchiré est à y≈420. Deux lignes sont déjà imprimées. Secousse de 4 px sur f0–2 (impact du tampon). Lente poussée 1,00→1,02. La LED du pas 1 est blanche. | « Douane : » (y 616–748) / « combien ? » (y 748–880). 900, 120 px, encre, x 160. Présent dès f0, sans pop. | — | **f0 : TCHAK**, le premier son, avant la musique. Moteur d'imprimante accordé en mi3, en doubles croches (il tient le rôle de la charleston). Balafon mi4 (0,0) et sol4 (0,5), passe-bas 600 Hz, −18 dB. Nappe Em9 filtrée. | Affiche, secousse, grain. |
| P2 | M1 | 1,0–2,0 · f30–59 | Le papier saute de 132 px à 1,0 puis à 1,5. La question monte à y 352–616. **Couverture TikTok/Reels : f52.** | 1,0 « On verra… » · 1,5 « à l'arrivée. ». 900, 120 px, gris #86868F, x 160, pop. | — | **Imprimante parlante** : la hauteur du moteur suit la prosodie de « on ve-rra… / à l'a-rri-vée ». Aucune voix, rien d'intelligible. Balafon si4 (1,0) et mi5 (1,5). Un tic de papier à chaque ligne. | Avance par à-coups. |
| P3 | M2 | 2,0–3,0 · f60–89 | **CE QUI EST DÛ.** Le papier est calme et net. Quatre lignes s'impriment sur les croches 2,0 / 2,25 / 2,5 / 2,75 : une pastille noire de 24 px, une barre d'encre (le libellé est volontairement illisible) et un montant en trame ▒▒▒, sans aucun chiffre. LED blanches sur 1, 5, 9 et 13. | Aucun mot nouveau. | — | Le kit « papier » entre, un instrument par ligne due : tampon = kick 4 temps (2,0) ; calculatrice = clave (2,25) ; imprimante = shaker en doubles croches droites (2,5) ; clavier = charleston sur les contretemps (2,75). Accord Cmaj7(#11). | Impression calée sur la grille. |
| P4 | M2 | 3,0–4,0 · f90–119 | Deux lignes en gras s'impriment sous les quatre lignes dues. À 3,75, un trait violet de 4 px se trace sous « c'est dû. » en 6 images : c'est **le trait du dû**. | 3,0 « Ça, » · 3,5 « c'est dû. ». 900, 120 px, encre, x 160, pop. | — | Le groove « propre » est complet, sans swing. À 3,75, un clic de bois à −12 dB pour le trait. | Pop, tracé. |
| P5 | M3 | 4,0–5,0 · f120–149 | **LES INCONNUS.** Entre les à-coups, le papier accélère de 260 à 520 px/s. Une ligne en gras par temps. Entre elles, des lignes de texture : barre grise et « ??? » orange, floutées. Les coups parasites s'allument en orange sur les LED ; la case 13 en cumule le plus. Secousse de 4 px sur chaque « ? ». | 4,0 « Code ? » · 4,5 « Valeur ? » (900, 112 px, encre, « ? » orange #FE560D). À 4,75, une rangée « SANS DÉTAIL ……… ??? » (500, capitales, 44 px). | — | **Intrus 1** (4,0) : tampon étouffé (passe-bas 400 Hz) en boucle sur les pas 6 et 14. **Intrus 2** (4,5) : l'imprimante, plus son écho exact une double croche plus tard (compté deux fois). « plus… » chuchoté à 4,125 et 4,625. Am9. | Rampe de vitesse. |
| P6 | M3 | 5,0–6,0 · f150–179 | 5,0 : « Papiers ? » et, dessous, un rectangle vide en pointillés (le document qui manque). 5,5 : « Jours ? » et une frise de 8 cases imprimées en triples croches. Les 5 premières sont ambre #F3A745. Un repère vertical porte le mot « franchise ». Les 3 suivantes sont orange. La frise file hors du papier. Aucun chiffre. | 5,0 « Papiers ? » · 5,5 « Jours ? » (112 px). « franchise » : 500, 44 px, gris, x 510–691, y 790–834. | — | **Intrus 3** (5,0) : tampon creux sur bois nu, sans le claquement du papier. **Intrus 4** (5,5) : « clac » de drapeau de taximètre, puis un tic à chaque triple croche. « plus… » à 5,125 et 5,625. | Frise de jours sans chiffre. |
| P7 | M4 | 6,0–8,0 · f180–239 | **RELANCE.** De 6,0 à 6,4, la caméra recule d'un facteur 8 en 12 images, puis passe au ralenti à 40 %. On découvre que le ticket est un ruban de plusieurs dizaines de mètres, en grands plis, dans un vide noir éclairé par une seule lumière du haut. Le plan est en **2.5D** : 6 plans de plis pré-rendus en parallaxe, des ombres de contact, de la profondeur de champ, de la poussière de papier dans le faisceau. Le ruban retombe sur un carton kraft sans marque (x 520–900, y 980–1240). Le carton porte une étiquette kraft « MARGE » (x 560–760, y 1040–1110). À 7,5 un pli la recouvre à moitié (« MAR… ») ; à 7,875 elle a disparu. | Texte épinglé, blanc, 900, 120 px, x 120 : 6,5 « Ce qu'on » (y 360–480) · 7,0 « ne sait pas… » (y 480–600) · 7,5 « ça se paie. » (y 600–720, « paie » en orange). Étiquette « MARGE » : 900, 64 px, texture de feutre. | — | Demi-temps : le kick ne joue que sur les pas 1 et 11. Tout le kit s'entend au loin (longue réverbération, passe-bas 3 kHz). Froissement de papier sur le recul. Le sub enfle. Nuage de « plus… » chuchotés (3 voix, gauche / centre / droite). À 7,5, le bruit sourd du pli. B7sus4. | Recul 2.5D, ralenti, particules. |
| P8 | M5 | 8,0–9,5 · f240–284 | **MONTÉE.** Retour sec en gros plan sur la fente. Le papier jaillit à 2 400 px/s et les lignes deviennent des traînées. La fente tremble de 6 px à chaque double croche. Les sous-titres restent nets, en encre sur le flou crème. **f277–279 : le seul décalage RVB du film (8 px)**, suivi de deux images saccadées (f280–281). | 8,0 « Et si » · 8,5 « vous saviez » (900, 120 px, encre, x 120, y 400–640) · 9,0 « AVANT ? » (900, 150 px, violet #A947FE, y 650–800). | — | La montée, c'est l'imprimante qui s'emballe : bruit passe-bande de 800 Hz à 6 kHz, haché en doubles puis en triples croches. Roulement de kick, sub en crescendo. B7sus4 puis B7(b9) à 9,0. Bit-crush sur f277–281. | Gros plan, traînées, glitch unique. |
| P9 | M5 | 9,5–10,0 · f285–299 | **SILENCE.** Tout se fige, flou compris. Un trait violet de 4 px se trace au ras de la fente, de gauche à droite, en 8 images : **la coupe**. | « AVANT ? » reste à l'écran. | — | **Silence numérique de 9,50 à 9,80.** De 9,80 à 10,00, la réverbération du tampon jouée à l'envers enfle jusqu'au temps. | Arrêt sur image, tracé. |
| P10 | M6 | 10,0–11,5 · f300–344 | **DROP.** La lumière sort de la coupe : un volet vertical passe au #F5F5F7 en 6 images, sans flash blanc. L'imprimante devient blanche et descend (fente à y 1100). **Le ticket se contracte.** Tout ce qui était inconnu se défait en poussière de papier, éclats de « ? » orange compris, et tombe hors du cadre (gravité, flou). Cela vaut pour « On verra… », les « ? », les trames et la frise. Le papier se referme. Les quatre lignes dues, de taille inchangée, redescendent du haut. Le trait du dû rejoint le trait de coupe : **les deux traits violets fusionnent à 10,5** (dépassement de 12 px, posé à 10,6). **Rien ne rentre dans l'imprimante.** « Ça, c'est dû. » reste imprimé et se réduit en pied de ticket (500, 56 px, ink3). Le papier devient blanc, avec l'ombre du produit. La pastille de marque passe à l'encre. | Les lignes reçoivent leur libellé : 700, 64 px, casse de phrase, pastille de couleur de 20 px, x 220, lignes en y 680–1064, montants en trame x 700–780. 10,0 « Droit de douane » (violet) · 10,5 « Accises » (orange) et « Autres taxes » (gris) · 11,0 « TVA et centimes » (or). | — | **DROP, le seul impact grave du film** : sub de 55 à 35 Hz en 600 ms, bruit de 30 ms, premier kick du 3-step. Puis 3-step propre (§4). Poussière de papier granulaire de 10,0 à 10,6, en hauteur descendante. Em9. | Volet de lumière, dissolution, ressort. |
| P11 | M6 | 11,5–12,0 · f345–359 | Les quatre lignes, seules et alignées. | « Ni plus. » : 900, 140 px, encre, x 120, y 360–500, pop. | — | Pas 13 vide. **« Ni plus. » chanté** (« ni » = si4, « plus » = sol4). | Pop sur la voix. |
| P12 | M7 | 12,0–13,5 · f360–404 | **LA TVA REFUSE.** L'imprimante « inspire » (son papier recule). La ligne or « TVA et centimes » est aspirée vers la fente, par à-coups sur les kicks 12,0 / 12,5 / 13,0. Sa pastille s'étire en goutte le long de la marge. Son libellé s'allonge de 25 %, puis 45 %, puis 60 %, et penche de 8°. Les trois autres lignes tremblent de 2 px et tiennent. | « Ni plus. » reste à l'écran. | — | Étirement de caoutchouc : bruit filtré qui monte, pulsé sur les kicks. Le log drum glisse. Cmaj7(#11). | Déformation élastique. |
| P13 | M7 | 13,5–14,0 · f405–419 | **SNAP.** La ligne s'arrache et revient à sa place : ressort amorti (ζ≈0,35), deux rebonds, posée à f412. | « Ni moins. » : 900, 140 px, gris, x 120, y 500–640, pop. | — | **« Ni moins. » chanté** (« ni » = sol4, « moins » = mi4). Le claquement élastique sert d'attaque à la voix. Effet d'arrêt de bande sur « moins ». | Ressort. |
| P14 | M8 | 14,0–16,0 · f420–479 | **LE VRAI ÉCRAN.** À 14,0, « Ni plus. / Ni moins. » sortent par le haut. Les lignes se replient en une barre de 4 segments aux proportions exactes du téléphone (38,9 / 21,2 / 36,7 / 3,1 %). L'imprimante sort par le bas. De 14,0 à 14,8, le **vrai téléphone** monte avec le mouvement du site (y +40 → 0, 0,8 s). Position : x 340–740, y 600–1400. Il pivote en 3D (rotateY −12° → −4°, rotateX 4° → 1°). Halo #281450 à 25 %, flou 40 px. Un reflet balaie la vitre de 14,6 à 15,2. La barre se pose dans son emplacement vide, un segment à chaque instrument : violet 14,375, orange 14,5, or 14,75, gris 14,875. Son extrémité dépasse un trait violet de référence, puis **se verrouille à 15,0 précisément** (f450). De 15,0 à 15,2, fondu vers les vrais pixels. Le trait de référence s'éteint à 15,5. | 14,0 « Douane : combien ? » (900, 88 px, encre, y 360–450) · 14,5 « On l'estime… » (88 px, gris, y 450–540) · 15,0 « avant. » (88 px, violet, même ligne) et la pastille « Exemple · estimation » (700, 44 px, #3A3A44 sur #EAEAEF, x 304–776, y 735–795, posée sur la zone givrée du téléphone). | **C1** : le téléphone (§5) | Am9. Poses : clave 14,375, kick 14,5, log drum 14,75 ; verrouillage sur le kick de 15,0. **À 15,5, le trou est laissé vide.** | Repli en barre, montée 3D, ressorts, fondu vers le réel. |
| P15 | M9 | 16,0–18,0 · f480–539 | De 16,0 à 16,5, le téléphone bascule et sort en bas à droite, et les sous-titres sortent par le haut. La vraie pilule de recherche glisse jusqu'à y 700–797 (x 142–938). De 16,0 à 16,75, « baskets » se tape une lettre par double croche. « Estimer » n'est jamais pressé. | 16,5 « Avant de payer » (900, 112 px, « Avant » en violet, le reste en encre, y 380–500) · 17,0 « votre fournisseur. » (900, 100 px, encre, y 500–610, pop à 1,06). | **C2** : la pilule de recherche | Frappe au clavier, calée sur la grille : la paperasse, enfin rangée. B7sus4 → B7(b9). **À 17,5, le trou est laissé vide.** | Raccord de mouvement. |
| P16 | M10 | 18,0–20,0 · f540–599 | La pilule tombe (y +40, fondu de 0,3 s). Le vrai titre du site apparaît, centré en y 540–722. Il est révélé par groupes de mots, avec le mouvement du site (y 14 → 0, 0,6 s). Fond #F5F5F7 nu. | 18,0 « Payez le » · 18,5 « juste droit. » (encre) · 19,0 « Ni plus, » · 19,5 « ni moins. » (gris). Ce sont les glyphes du site, en 91 px. | **C3** : le titre | Pause : log drum, ostinato bikutsi, nappe Em9. De 19,0 à 19,8, **« Ni plus, ni moins. » chanté** (si4 sol4, puis sol4 mi4) ; « moins » tombe dans le trou de 19,5. | Révélation au masque. |
| P17 | M11 | 20,0–21,5 · f600–644 | **LE MODULE.** La signature glisse à gauche, en x 120 (ligne 1 en y 440–531, ligne 2 en y 531–622), en 0,5 s. La pastille de marque, là depuis f0, monte en y 300 et grandit. **« Douane » sort de derrière « Bonzini Labs » comme un tiroir** : c'est l'en-tête réel du site, et la première fois que le module est nommé. Un trait violet de 2 px souligne la signature (y 645, x 120–480). | 20,0 « Douane » · 20,5 la mention légale (fondu de 0,3 s) · 21,0 la pilule « Bientôt ». Détail en §6. | **C4** : l'en-tête ; **C3** | Logo sonore au balafon : mi4 (20,0), sol4 (20,25), si4 (20,5), puis mi5 tenu de 20,75 à 22,0. **« Bonzini Labs » dit de 20,8 à 21,4.** 3-step doux à −12 dB. | Mise en page qui se recompose, tiroir. |
| P18 | M11–12 | 21,5–23,5 · f645–704 | Un tampon d'encre violette « EN TEST » s'imprime (x 540–880, y 670–790, incliné de −6°). Secousse de 6 px sur 3 images ; l'encre s'étale en 4 images. Aucune main, aucun outil, aucun emblème. La carte de fin complète tient de 22,0 à 23,5. | « EN TEST » : 900, 72 px, capitales, violet. | — | **21,5 : TCHAK**, le même son qu'en f0, dans le trou du pas 13. Le mi5 résonne. À partir de 22,0, il ne reste que la nappe et le log drum, à −12 dB. | Tampon. |
| P19 | M12 | 23,5–24,0 · f705–719 | Un iris se ferme par le bas sur la fente sombre de l'imprimante et sa LED violette. Le bout d'un ticket vierge apparaît. La pastille violette revient en haut à gauche (f710–719). **La dernière image reprend la composition de f0, sans la question.** | — | — | Le moteur de l'imprimante démarre (sifflement en mi3 qui monte, sur un temps de levée), avec un accord de B7(b9). Tout se résout sur le TCHAK de f0. | Iris, boucle. |

---

## 3. LE MONTAGE COURT : 15,0 s

Il fait 450 images, soit 7,5 mesures. Il est remonté à partir des mêmes scènes et des mêmes pistes, coupé sur les barres de mesure. Ce n'est pas une version raccourcie du fichier final. La musique est réarrangée en synthèse (§4.4), sans aucun raccord audible.

| 15 s | Plans du montage principal | Ce qu'on voit |
|---|---|---|
| 0,0–2,0 | P1–P2 (M1) | Identique : l'affiche, puis « On verra… à l'arrivée. » |
| 2,0–4,0 | P3–P4 (M2) | Identique : les quatre lignes dues, « Ça, » / « c'est dû. », le trait du dû. |
| 4,0–6,0 | P5–P6 (M3) | Identique : « Code ? » « Valeur ? » « Papiers ? » « Jours ? » et la frise « franchise ». |
| 6,0–7,5 | P8 (M5) | « Et si » (6,0) / « vous saviez » (6,5) / « AVANT ? » (7,0). Glitch sur f217–221. |
| 7,5–8,0 | P9 | Silence et coupe violette. |
| 8,0–10,0 | P10–P11 (M6) | Drop, contraction, libellés à 8,0 / 8,5 / 9,0, « Ni plus. » à 9,5. |
| 10,0–12,0 | P12–P13 (M7) | La TVA est aspirée, puis revient avec « Ni moins. » à 11,5. |
| 12,0–14,5 | Fin resserrée | À 12,0, les lignes se replient dans le trait violet. « Ni plus. » et « Ni moins. » se recomposent en ligne grise sous le titre (capture C3). Les mots arrivent dans cet ordre : 12,0 « Payez le », 12,5 « juste droit. ». La mention légale apparaît dès 12,0. À 12,5, « Douane » sort de la pastille ; le logo sonore joue de 12,5 à 14,0, avec « Bonzini Labs » dit de 13,3 à 13,9. 13,0 : « Bientôt ». 14,0 : tampon « EN TEST » et TCHAK. |
| 14,5–15,0 | P19 | Iris, puis levée vers l'image 0. |

**Ce qui est retiré, et pourquoi.** Le montage court perd la relance (« MARGE » et le proverbe), le téléphone, la recherche et le titre centré. On garde ainsi un drop à 8,0 s (53 %), la ligne « Ça, c'est dû. » (la sécurité « ni moins »), et une carte de fin lisible : la mention légale reste 2,6 s à l'écran, le nom du module 2,1 s.

**Exports :**
- 1080×1920 ;
- version légère 720×1280 à environ 3 Mb/s, 8 Mo au plus (≈ 6 Mo), pour les statuts WhatsApp et les Reels Facebook.

---

## 4. SCRIPT SONORE : « Douane Groove »

### 4.1 Les bases

**Le morceau**
- Afro-house en 3-step, 120 BPM, mi mineur. Synthèse originale, aucun échantillon tiers.
- Accords, une mesure chacun :
  - M1 Em9
  - M2 Cmaj7(#11)
  - M3 Am9
  - M4 B7sus4
  - M5 B7sus4 → B7(b9)
  - silence
  - M6 Em9
  - M7 Cmaj7(#11)
  - M8 Am9
  - M9 B7sus4 → B7(b9)
  - M10 Em9
  - M11 Em9
  - M12 Em9 → B7(b9) en levée

**L'idée**
- **Le kit est fait de paperasse.** Les quatre instruments « dus » entrent en M2 et jouent jusqu'à la fin, comme un « ni moins » dans le son :
  - tampon = kick ;
  - calculatrice = clave ;
  - imprimante = shaker ;
  - clavier = charleston.
- **Les intrus s'empilent sur le pas 13.** Au drop, ce pas se vide (le kick et la clave en sortent). C'est la voix qui remplit le trou, jamais un coup de plus.
- **Le moteur de l'imprimante est accordé en mi3.** Après le drop, le même timbre joue une octave plus bas et devient le log drum en mi2 : le bruit devient le groove.

**Le code à réutiliser**
- `lib/instruments.py` : kick, log_drum, shaker, hat_open, pad, stab, bass_sub, balafon, guitar_mute, stamp, printer, calc, typing, paper, whoosh, riser, sub_drop, reverse_stamp, tape_stop.
- `bikutsi.py` (OST/ACC) et `dsp.py`.
- Fonctions à ajouter :
  - `printer_motor(note)` : le moteur accordé ;
  - `talking_printer(contour)` : l'imprimante parlante ;
  - `taximeter()` ;
  - `whisper(chop)` : vocodeur de bruit ;
  - `rubber_stretch()` : l'étirement élastique ;
  - `paper_dust()` : la poussière de papier.

### 4.2 Arrangement mesure par mesure (montage principal)

| Mes. | t (s) | Accord | Kick | Kit papier et percussions | Basse / log drum | Mélodie | Voix |
|---|---|---|---|---|---|---|---|
| M1 | 0–2 | Em9 | — (TCHAK en f0 seulement) | moteur d'imprimante en mi3, doubles croches (rôle de charleston) ; imprimante parlante de 1,0 à 2,0 | — | balafon mi4–sol4–si4–mi5 en noires, passe-bas 600 Hz, −18 dB (premier repère de marque) ; nappe Em9 en passe-bas 800 Hz | — |
| M2 | 2–4 | Cmaj7(#11) | tampon 4 temps (1-5-9-13) dès 2,0 | clave à la calculatrice 1-4-7-11-13 (2,25) ; shaker d'imprimante en doubles croches droites (2,5) ; charleston au clavier 3-7-11-15 (2,75) | sub sur le 1 | la nappe s'ouvre | — |
| M3 | 4–6 | Am9 | 4 temps + intrus | intrus 1 à 4 (§4.3), qui s'accumulent sur le pas 13 | sub | nappe | « plus… » chuchoté ×4 |
| M4 | 6–8 | B7sus4 | demi-temps, pas 1 et 11 | tout le kit au loin (réverbération de 4 s, passe-bas 3 kHz) | le sub enfle | — | nuage de « plus… » (3 voix G/C/D) |
| M5 | 8–9,5 | B7sus4 → B7(b9) à 9,0 | roulement en doubles puis triples croches | montée : l'imprimante qui s'emballe (800 Hz → 6 kHz) ; bit-crush f277–281 | sub en crescendo | — | nuage au plus dense |
| — | 9,5–10 | — | — | **silence numérique de 9,50 à 9,80** ; réverbération inversée du tampon de 9,80 à 10,00 | — | — | — |
| M6 | 10–12 | Em9 | **3-step : pas 1, 5, 9 ; pas 13 vide** | shaker swingué à 57 % (vélocités 0,9 / 0,5) ; charleston 3-7-11-15 ; clave 1-4-7-11 | log drum : mi2 sur 1, puis sur 4, glisse vers sol2 sur 7, puis 11, glisse vers ré2 sur 14 | ostinato bikutsi, 12 croches de triolet par mesure (4 contre 3 ; guitare étouffée et balafon FM) ; accords Em9 plaqués sur les contretemps | 11,5 « Ni plus. » |
| M7 | 12–14 | Cmaj7(#11) | idem | idem | idem | idem | 13,5 « Ni moins. » |
| M8 | 14–16 | Am9 | idem | idem ; les segments se posent sur leurs instruments | idem | idem | 15,5 **vide** |
| M9 | 16–18 | B7sus4 → B7(b9) | idem | frappe de « baskets » en doubles croches | idem | idem | 17,5 **vide** |
| M10 | 18–20 | Em9 | — (pause) | shaker léger | log drum | ostinato et nappe | 19,0–19,8 « Ni plus, ni moins. » |
| M11 | 20–22 | Em9 | 3-step doux à −12 dB | — | log drum | **logo sonore** : balafon mi4 20,0 · sol4 20,25 · si4 20,5 · mi5 20,75 tenu jusqu'à 22,0 | 20,8–21,4 « Bonzini Labs » ; 21,5 TCHAK dans le trou |
| M12 | 22–24 | Em9 → B7(b9) à 23,5 | — | — | mi2 sur le 1 | le mi5 résonne ; nappe | 23,5 : démarrage du moteur en levée, vers l'image 0 |

### 4.3 Bruitages et moments clés

Seuls cinq moments portent un vrai effet : le TCHAK, les intrus, le silence, le drop et le tampon de fin. Le reste est joué par le kit, sur la grille.

| t (s) | Image | Son | Rôle |
|---|---|---|---|
| 0,000 | f0 | **TCHAK** : tampon (attaque de 2 ms, corps de bois à 180 Hz, claque de papier) | premier son ; le même revient à 21,5 et ferme la boucle |
| 0,0–9,5 | — | moteur d'imprimante en mi3 (164,8 Hz) et cliquetis de pas (bande vers 1,2 kHz) | charleston avant le drop |
| 1,0–2,0 | f30–59 | imprimante parlante (contour « on verra… / à l'arrivée ») | une réponse floue, sans voix ni auteur |
| 2,0 · 2,25 · 2,5 · 2,75 | f60 · f68 · f75 · f83 | entrée du tampon, de la calculatrice, de l'imprimante, du clavier | une ligne due = un instrument |
| 3,75 | f113 | clic de bois à −12 dB | le trait du dû |
| 4,0 | f120 | intrus 1 : tampon étouffé (pas 6 et 14) | Code ? |
| 4,5 | f135 | intrus 2 : écho d'imprimante une double croche plus tard | Valeur ? |
| 5,0 | f150 | intrus 3 : tampon creux sur bois nu | Papiers ? |
| 5,5 | f165 | intrus 4 : drapeau de taximètre, puis un tic par triple croche | Jours ? |
| 4,125 · 4,625 · 5,125 · 5,625 | — | « plus… » chuchoté, puis en nuage jusqu'à 9,5 | la surcharge |
| 6,0 | f180 | froissement de papier | relance |
| 7,5 | f225 | bruit sourd du pli qui s'affaisse | « MARGE » recouverte |
| 8,0–9,5 | f240–284 | montée, roulement de kick, crescendo du sub | « Et si vous saviez AVANT ? » |
| 9,233–9,367 | f277–281 | bit-crush | le glitch unique |
| 9,50–9,80 | f285–293 | **silence numérique** | |
| 9,80–10,00 | f294–299 | réverbération inversée du tampon | |
| 10,000 | f300 | **DROP** : sub 55 → 35 Hz en 600 ms, bruit de 30 ms, kick | le seul impact grave |
| 10,0–10,6 | f300–318 | poussière de papier granulaire, en hauteur descendante | la contraction |
| 12,0 · 12,5 · 13,0 | f360 · f375 · f390 | étirement de caoutchouc, pulsé | la TVA aspirée |
| 13,5 | f405 | attaque élastique de « Ni moins. », arrêt de bande | le snap |
| 14,375–15,0 | f431–450 | segments posés sur la clave, le kick, le log drum ; verrouillage sur le kick | la barre « juste » |
| 16,0–16,75 | f480–503 | 7 frappes de clavier en doubles croches | « baskets » |
| 21,5 | f645 | **TCHAK** | « EN TEST » |
| 23,5–24,0 | f705–719 | démarrage du moteur en levée | boucle |

**Sons interdits :** le « ka-ching » de caisse enregistreuse, les pièces, les billets, le vine boom, un whoosh sur chaque coupe, les applaudissements.

### 4.4 Arrangement du montage court (15 s)

| Mesure du 15 s | Source | Remarques |
|---|---|---|
| 1 | M1 | identique |
| 2 | M2 | identique |
| 3 | M3 | identique |
| 4 | M5 | montée, bit-crush f217–221, silence de 7,5 à 7,8, réverbération inversée de 7,8 à 8,0 |
| 5 | M6 | drop, « Ni plus. » à 9,5 |
| 6 | M7 | « Ni moins. » à 11,5 |
| 7 et la demi-mesure finale (12,0–15,0) | — | accords Em9 plaqués à 12,0 ; balafon mi4 12,5 · sol4 12,75 · si4 13,0 · mi5 13,25 tenu ; « Bonzini Labs » de 13,3 à 13,9 ; TCHAK à 14,0 ; démarrage du moteur en levée de 14,5 à 15,0 |

### 4.5 Voix de synthèse : 5 mots en tout

- **Moteur :** Kyutai TTS, voix « developpeuse-3 » (la voix 3 de la série), via `lib/tts_kyutai.py`. Les prises existent déjà dans `audio/vo/` (S1, S2, S3, graines s1 et s2).
- **Texte exact :**
  - « **Ni plus.** » (S1), chanté : « ni » = si4, « plus » = sol4.
  - « **Ni moins.** » (S2), chanté : « ni » = sol4, « moins » = mi4, avec arrêt de bande sur « moins ».
  - « **Bonzini Labs.** » (S3), dit, proche et chaleureux.
- **Mots distincts :** Ni, plus, moins, Bonzini, Labs. Cinq en tout.
- **Les « plus… » chuchotés** sont découpés dans S1 et passés au vocodeur de bruit.
- **La cadence finale** « Ni plus, ni moins. » assemble S1 et S2, recalées en hauteur.
- **Traitement :** formants légèrement décalés, réverbération courte de type plaque, compression déclenchée par le kick.
- **Contrôle :** chaque prise doit être transcrite à l'identique par la reconnaissance vocale.
- **Aucune autre voix.** La voix de la marque ne dit jamais « on verra ».
- **Si le chant sonne robotique :** une découpe parlée et rythmée, doublée, aux formants décalés.

### 4.6 Mixage et livrables

**Mixage :**
- −14 LUFS intégrés, crête réelle −1 dBTP au plus ;
- passe-haut à 35 Hz sur le bus général ;
- test en mono ;
- écoute de contrôle avec un passe-haut à 200 Hz : le log drum (saturé ×2,5) et les voix doivent passer sur un haut-parleur de téléphone ;
- les voix au moins 8 LU au-dessus du fond dans les trous ;
- le fond baisse de 4 dB sous les mots chantés.

**Livrables :**
- le mix ;
- les pistes séparées (kit dû, intrus, musique, voix) ;
- le son original « Ni plus. Ni moins. (Douane Groove) » en 24 s et en 15 s ;
- une boucle de 30 s avec les trous laissés vides, pour les créateurs.

---

## 5. LISTE DES CAPTURES DE L'APPLICATION

### 5.1 Réglages

- **Code filmé :** le worktree premium, `<scratchpad>/tariff` (HEAD `0d338f62`), servi par Vite sur :8080. Il est déjà en route ; s'il tombe, `npx vite --host --port 8080`. Le site en ligne tourne encore sur l'ancien design.
- **Navigateur :** Playwright avec `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, proxy `HTTPS_PROXY`, contournement pour localhost.
- **Contexte de capture :**
  - viewport **760×1351 CSS**, locale fr-FR, thème clair, mouvement non réduit ;
  - `deviceScaleFactor` de 1080/760 pour la vérification pleine page, et de 3 ou 4 pour les plans d'éléments ;
  - **défilement : Y = 0 pour toutes les captures.** Tout le haut de page tient dans le premier écran.
- **Pourquoi 760 et pas 810 :** sous 768 px, les cartes flottantes du site sont en `display:none`. On évite ainsi « À récupérer sur votre DAU + 58 136 XAF » et « Code signé par un commissionnaire agréé ». Vérifié.
- **Changement de texte, à faire de préférence avant la capture :** dans `$W/src/i18n/locales/fr/customs.json`, ligne 773, remplacer `"h1Muted": "Pas un franc de plus."` par `"Ni plus, ni moins."`. C'est aussi la condition 2 du §6. À défaut, on peut remplacer le texte dans le DOM au moment de la capture. Les pixels sont identiques (vérifié), mais il faut alors signaler que c'est un montage tant que le texte n'est pas en ligne.

**Recette vérifiée le 01/10/2026** (base : `<scratchpad>/cd/verify.mjs`) :

```js
await ctx.addInitScript(() => { const si = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => ms === 4500 ? window.setTimeout(fn, 300) : si(fn, ms, ...a); }); // fige le téléphone sur « Mèches »
await page.goto('http://localhost:8080/douane', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.tsqd-open-btn-container{display:none!important} #dz-hero-q::placeholder{color:transparent}' });
await page.waitForSelector('text=Mèches synthétiques'); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = document.querySelector('.rounded-\\[42px\\]');
  const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace(/\d/g, '•'); }); // aucun chiffre ne survit
```

**Géométrie mesurée à 760 CSS** (en px CSS, page en haut) :

| Élément | Position | Taille |
|---|---|---|
| `main h1` | 32,137 | 696×128 (corps 64 px) |
| pilule de recherche | 100,389 | 560×68 |
| téléphone `.rounded-[52px]` | 230,626 | 300×600 |
| barre `div.flex.h-2` | 261,874 | 238×8 (segments 88/48/83/7) |
| légende | 261,894 | 238×209 |
| lien de marque de l'en-tête | 32,13 | 208×30 |

La recherche du héros n'ouvre **aucune** liste de suggestions (vérifié dans `SiteHome.tsx`) : aucun code ni taux ne peut apparaître pendant la frappe.

### 5.2 Les captures

| Id | Route | Élément (sélecteur), état | Ce qu'on garde | Ce qu'on masque | Placement dans la vidéo | Plan |
|---|---|---|---|---|---|---|
| **C1a / C1b** | `/douane` | `.rounded-\[52px\]`, capture d'élément à DPR 3 (900×1800). État « Mèches » figé, chiffres remplacés par « • ». C1b est identique, avec la barre cachée (`.rounded-\[42px\] div.flex.h-2>span{opacity:0}`) pour l'arrimage. | le corps #111 ; « À payer à la douane » ; le total en « ●●● ●●● F CFA » ; la barre 4 couleurs (C1a) ; les 4 libellés de légende et leurs pastilles | **givré** (flou 18 px et voile blanc 60 %) sur la bande de y +60 à +162 CSS dans l'élément : navigation « ‹ Estimer · Partager », nom du produit, ligne code / taux. **Total et montants** : déjà en « • », puis flou de 14 px. « Valeur de la marchandise » : givrée. **« Payer mon fournisseur »** (y +489 à +537) : hors de la zone sûre, flou de 14 px, fondu à 70 % dans un dégradé bas. Coins arrondis découpés au masque (rayon 156 px). Halo recréé en composition. | x 340–740, y 600–1400 (1 px CSS = 1,333 px vidéo). La barre tombe en y 931–941, la légende en y 957–1236. | P14 |
| **C2** | `/douane` | la pilule (`#dz-hero-q`, son `form` parent, avec une marge de 24 px pour l'ombre), DPR 3. On donne le focus puis on tape au clavier ; **7 images fixes**, de « b » à « baskets », une par lettre, recalées sur les doubles croches. Jamais Entrée, jamais « Estimer ». | la pilule, la loupe, le texte tapé, le bouton noir « Estimer » | tout ce qui est au-dessus (titre, phrase d'accroche) et en dessous (pastilles de produits, rangée de confiance) : la capture est limitée à la pilule. Texte d'exemple rendu transparent. | x 142–938, y 700–797 | P15 |
| **C3** | `/douane` | `main h1` à DPR 3, avec h1Muted = « Ni plus, ni moins. ». On relève aussi les boîtes de mots (Range API → `C3_words.json`) pour « Payez le », « juste droit. », « Ni plus, », « ni moins. ». | les deux lignes du titre | tout le reste de la page | Centré en y 540–722 (P16). Puis chaque ligne est recadrée et alignée à gauche à x 120 (P17, et carte de fin du 15 s). | P16–P17 |
| **C4a / C4b** | `/douane` | lien de marque de l'en-tête (`header a[href="/douane"]`) à DPR 4. C4b est identique, avec le `span` « Douane » à `opacity:0`. | logo, « Bonzini Labs » (700), « Douane » (500, gris) | « Se connecter », « Estimer mes droits », le menu : hors de l'élément capturé | ×3,5 : x 120–848, y 300–405 | P17–P18 |

### 5.3 Jamais filmé, ou toujours masqué

- **Héros :**
  - « Pas un franc de plus. » (avant correction) ;
  - la phrase d'accroche « …récupérez ce qui a été payé en trop. » ;
  - la rangée de confiance « Tarif 2026 · calcul CAMCIS / Commissionnaires agréés / Sans compte pour estimer » ;
  - les deux cartes flottantes ;
  - les états « Régulateur » (302 557, valeur 900 000 tirée d'un dossier privé) et « Chaises » (287 338, lié au cas interne) du téléphone.
- **Tuiles bento :**
  - 768 457 ;
  - 58 136 ;
  - 36 084 et 193 782 barrés ;
  - « 46–80 » ;
  - « Compte gratuit » ;
  - « Le trop-payé, récupéré. » ;
  - la maquette « Signé par un commissionnaire agréé ».
- **Le bloc violet de preuve :** 307 078 F et « Quatre codes sur dix ».
- **Le bandeau de paiement.**
- **Le simulateur :**
  - le sous-titre « Tarif 2026 » ;
  - « taux de la BEAC du jour » ;
  - les pastilles de taux ;
  - les notes « Pour ne pas payer plus » (Fortuner et SGS dès 2 M F) ;
  - la comparaison de codes et sa ligne « …de moins ».
- **Autres pages et éléments :**
  - les routes (46–80 jours, attribution OpenFreeMap) ;
  - la veille ;
  - le pied de page (WhatsApp et un numéro de téléphone) ;
  - toutes les pages qui demandent une connexion : classer, audit, fournisseurs, espace. L'IA n'y est pas déployée et aucun commissionnaire n'est inscrit.
  - le bouton palmier des outils de développement.

### 5.4 Contrôle qualité des images

- Exporter la version 720p à 3 Mb/s.
- Lancer une reconnaissance de caractères (`tesseract -l fra`) sur toutes les images :
  - aucun chiffre [0-9] ne doit être détecté ;
  - aucune des expressions interdites du §7.4 non plus.
- Vérifier ensuite image par image, à l'œil, les zones givrées.
- Vérifier les aplats sombres d'avant le drop : pas d'effet d'escalier.

---

## 6. CARTE DE FIN

**Durée à l'écran :**
- montage principal : elle se construit de 20,0 à 21,5 s et tient, complète, de 22,0 à 23,5 s ;
- montage court : de 12,0 à 14,5 s.

**Mise en page :**
- fond #F5F5F7, sans grain ;
- tout est aligné à gauche à x 120 ;
- sous y 840, rien ne dépasse x 780.

| Élément | Texte exact | Position | Style | Entrée (principal / 15 s) |
|---|---|---|---|---|
| En-tête | [logo] **Bonzini Labs** Douane | y 300–405 ; logo x 120–225, texte jusqu'à x 848 | « Bonzini Labs » en Satoshi 700, 63 px, #0D0D12 ; « Douane » en Satoshi 500, 63 px, #86868F (capture C4) | 20,0 / 12,5, en tiroir |
| Signature, ligne 1 | Payez le juste droit. | x 120–878, y 440–531 | capture C3, 91 px, encre | 18,0 / 12,0 |
| Signature, ligne 2 | Ni plus, ni moins. | x 120–792, y 531–622 | capture C3, gris | 19,0 / 12,0 |
| Trait | — | y 645, x 120–480 | violet #A947FE, 2 px | 20,0 / 12,0 |
| Tampon | EN TEST | x 540–880, y 670–790, incliné de −6° | encre violette, Satoshi 900, 72 px, capitales, cadre arrondi de 6 px ; sans main ni emblème | 21,5 / 14,0 |
| Pilule (variante A, par défaut) | Bientôt | x 120–351, y 880–968 | pilule noire #0D0D12, Satoshi 700, 48 px, blanc | 21,0 / 13,0 |
| Pilule (variante B) | bonzinilabs.com/douane | x 120–736, y 880–968 | même style | uniquement après les trois conditions ci-dessous |
| Mention légale | Estimation · à faire confirmer / par un commissionnaire / agréé en douane. | x 120–690, y 1040–1211 | Satoshi 500, 44 px, #6E6E78, interligne de 57 px, en 3 lignes | 20,5 → 23,6 (3,1 s) / 12,0 → 14,6 (2,6 s) |

**Décision : « Bientôt », pas le lien.**

Le module est bien joignable et en test. Pourtant, quelqu'un qui cliquerait aujourd'hui tomberait exactement sur ce que le teaser s'interdit :
- `www.bonzinilabs.com/douane` tourne encore sur l'ancien design (chunk `d3af4520`).
- Le `customs.json` en ligne contient encore « Récupérez ce qui a été payé en trop » (l.711), « au franc près » (l.15), « tarif 2026 » (l.31, 708, 796), « quatre … sur dix » (l.8, 758), le cas Fortuner (l.529), 900 000 F (l.285, 757), « taux de la BEAC du jour » (l.50) et « ce qui se récupère » (l.758).
- Le film montre une version locale que personne ne peut voir en ligne. Montrer le lien serait trompeur.
- Les fonctions d'IA ne sont pas déployées, et aucun commissionnaire n'est inscrit.

« EN TEST » et « Bientôt » disent la même chose honnête : en test, ouvert bientôt.

**On passe à la variante B quand ces trois conditions sont réunies :**
1. La version premium est déployée en ligne.
2. Les textes sont corrigés :
   - les chaînes ci-dessus ;
   - h1Muted → « Ni plus, ni moins. » ;
   - la phrase d'accroche « récupérez » ;
   - la rangée « Tarif 2026 » ;
   - « Compte gratuit », « Le trop-payé, récupéré. », « Le montant exact » ;
   - les cartes flottantes ;
   - le texte sous le bloc de preuve.
3. Un vrai test complet passe en ligne : le simulateur sur un Android de 6 pouces, en 3G, en fr-FR.

D'ici là : aucun lien dans la bio, ni dans le commentaire épinglé.

**Texte du post (non incrusté dans la vidéo) :**
- Légende : « Douane : combien ? Ni plus. Ni moins. Bonzini Labs · Douane, en test. Taguez l'importateur qui doit voir ça. »
- Commentaire épinglé : « Vous connaissez votre douane AVANT de payer votre fournisseur ? Oui / Non »
- Préparer des réponses neutres pour les récits de corruption, et ne jamais les amplifier.
- Vérifier que #NiPlusNiMoins est libre avant la publication.

---

## 7. CONFORMITÉ

### 7.1 Chaque mot à l'écran, et pourquoi il est permis

| Texte | Où et quand | Pourquoi c'est permis |
|---|---|---|
| « Bonzini Labs » (pastille, puis en-tête) | de f0 à la fin | La marque. Aucun logo tiers. |
| « Douane : combien ? » | 0,0 ; repris à 14,0 | Question neutre. Ce n'est pas « combien de trop » (fact-check, accroche 1). Ici « douane » est un nom commun ; le module n'est nommé qu'à 20,0. |
| « On verra… » / « à l'arrivée. » | 1,0 / 1,5 | Imprimé sur le propre ticket de l'importateur, sans auteur ni voix. Personne n'est accusé, ni transitaire ni douanier. |
| « Ça, » / « c'est dû. » | 3,0 / 3,5 ; reste en pied de ticket au drop | Reconnaît que la douane est due, et pose le « ni moins » avant la douleur. |
| « Code ? » « Valeur ? » « Papiers ? » « Jours ? » | 4,0 → 5,5 | Des questions : des manques d'information du côté de l'importateur. Aucun coupable. |
| « SANS DÉTAIL » | 4,75 | Ce qui est visé, c'est une note sans détail (pain.md §7). Jamais « FORFAIT » : Bonzini fait lui-même du groupage. |
| « franchise » | 5,5 | Le mot juste (fact-check, ligne 9). Pas de nombre, jamais « gratuit ». |
| « MARGE » | 6,0–7,9 | Ce que l'importateur risque. Aucun chiffre. |
| « Ce qu'on » / « ne sait pas… » / « ça se paie. » | 6,5 → 7,5 | Proverbe impersonnel, dans la version adoucie que demandait le juge. Ce n'est pas « vous payez trop ». |
| « Et si » / « vous saviez » / « AVANT ? » | 8,0 → 9,0 | Une question. |
| « Droit de douane », « Accises », « TVA et centimes », « Autres taxes » | 10,0 → 11,0 | Les libellés exacts du produit (`groups.ts`). Ni taux ni montant. Le téléphone qui suit est marqué « Exemple ». Le film ne dit pas que tous les produits paient des accises. |
| « Ni plus. » / « Ni moins. » | 11,5 / 13,5 | La signature. « Ni moins » se voit : la TVA refuse de partir. Le film ne peut donc jamais se lire comme « payer moins ». |
| « On l'estime… » / « avant. » | 14,5 / 15,0 | Parle d'estimation, et non de « savoir », de « prévu » ou de « garanti ». |
| « Exemple · estimation » | 15,0–16,0 | L'étiquette exigée pour un écran du moteur. |
| « Avant de payer » / « votre fournisseur. » | 16,5 / 17,0 | La promesse corrigée par le fact-check. On dit « payer », jamais « envoyer ». Le film ne prétend pas que payer avec Bonzini règle la douane. |
| « baskets », « Estimer » (UI) | 16,0–18,0 | Saisie réelle d'un produit générique. Pas de liste de suggestions, donc ni code ni taux. Le bouton n'est jamais pressé. |
| UI du téléphone : « À payer à la douane », « F CFA », 4 libellés | 14,4–16,0 | L'interface réelle. Navigation, nom du produit, ligne code / taux et « Valeur de la marchandise » sont givrés. « Payer mon fournisseur » est masqué. |
| « Payez le juste droit. » | 18,0 → fin | Signature : le vrai titre du site. |
| « Ni plus, ni moins. » (titre) | 19,0 → fin | h1Muted corrigé ; remplace « Pas un franc de plus. ». |
| « Douane » (en-tête) | 20,0 → fin | La révélation du module, à la fin. |
| « Bientôt » | 21,0 → fin | Honnête tant que les trois conditions du §6 ne sont pas réunies. |
| « EN TEST » | 21,5 → fin | Le statut du module. Encre violette Bonzini, sans emblème ni main. |
| Mention légale | 20,5 → 23,6 | La mention exigée. Seule exception à la règle des 3 mots par demi-temps. |
| Paroles chantées ou dites | « plus… » (chuchoté) · « Ni plus. » · « Ni moins. » · « Ni plus, ni moins. » · « Bonzini Labs » | Cinq mots de voix de synthèse. Aucun « moins » avant le drop. La voix de la marque ne dit jamais « on verra ». |

**Débit de lecture :** chaque demi-temps apporte 3 mots nouveaux au plus. Les libellés d'interface du téléphone, en 17–30 px, sont des textures déjà lues en grand au drop.

### 7.2 Les nombres

**Aucun chiffre n'est lisible dans les deux montages.** Les seuls éléments qui ressemblent à des nombres :
- les montants du ticket : une trame ▒▒▒ ;
- les jours : des cases ambre ou orange, sans chiffre ;
- le total et les montants du téléphone : les chiffres sont remplacés par « • » dans le DOM, puis floutés, sous la pastille « Exemple · estimation » ;
- la ligne code / taux : givrée ;
- l'URL de la variante B : elle ne contient pas de chiffre.

**Ne figurent jamais à l'écran :**
- 307 078 ; 58 136 ; 46 jours ; 67 % ; 900 000 ;
- 193 782 / 193 784 ; 768 457 ; 302 557 ; 36 084 ; 46–80 ;
- aucun taux par produit (10, 30, 40 %, 25 % d'accises) ;
- ni 19,25 %, ni 11 jours ;
- aucun numéro d'article de loi.

### 7.3 Défauts relevés par les juges, et corrections

| Juge | Défaut | Correction |
|---|---|---|
| Conformité | « Jour 11/12/13 » et « LIGNE 14/15 » : des chiffres ni étiquetés ni floutés | Une frise de cases sans chiffre, avec le seul repère « franchise ». Aucune ligne numérotée. |
| Conformité | Le rembobinage peut se lire comme un remboursement | Il n'y a plus de rembobinage, mais une **contraction** : rien ne rentre dans l'imprimante, l'inconnu tombe en poussière hors du cadre. Les lignes dues restent de la même taille, et « Ça, c'est dû. » reste imprimé. Test et solution de repli au §7.5. |
| Conformité | « Code. Valeur. Papiers. » laisse croire à un classement signé | Supprimé. Remplacé par la rime « Douane : combien ? / On l'estime… avant. », avec « Exemple · estimation ». Aucun classement, aucun audit, aucun « signé » à l'écran. |
| Conformité | « on le paie » énonce une vérité générale | Remplacé par « ça se paie ». |
| Conformité (général) | h1Muted, rangée de confiance, phrase « récupérez », cartes, bouton de paiement | h1Muted corrigé avant la capture, rangée et phrase hors cadre, cartes absentes à 760 CSS, bouton masqué, « Bientôt » par défaut. |
| Émotion | La douleur reste abstraite, il manque un enjeu humain | « MARGE » ensevelie ; « Ça, c'est dû. » traite le spectateur en commerçant honnête ; le nuage de « plus… » ; la rime de dignité « On l'estime… avant. ». |
| Fabrication | Recul en 3D, lignes illisibles, grille fausse à f323, débordement de 843 px, téléphone non placé | Recul en 2.5D ; avance par à-coups et inclinaison de 3° au plus ; libellés posés sur f300, f315 (orange et gris ensemble) et f330 ; toutes les largeurs remesurées (« votre fournisseur. » en 100 px) ; téléphone en x 340–740, y 600–1400 ; images fixes, texte « • » dans le DOM et animation recréée ; fond #0D0D12 avec 2 % de grain contre l'effet d'escalier. |

### 7.4 Contrôle des interdits

**Absents des deux montages, en image comme en son :**
- « transfert d'argent », « envoyer » ;
- « premier », « seul », « gratuit » ;
- « au franc près », « tarif 2026 », « pas un franc de plus » ;
- « récupérez », « remboursé » ;
- « économisez », « astuce », « éviter », « contourner », « moins cher ».

**Images absentes :**
- pas de douanier, d'uniforme ni de bâtiment ;
- pas d'argent, de billets ni d'enveloppe ;
- pas de main ;
- aucun logo tiers : WhatsApp, Facebook, TikTok, SGS, GUCE/SIMPA, CAMCIS (dans la rangée coupée), armateurs ;
- aucun nom de navire, aucune personne réelle ;
- aucun vrai document : le ticket est inventé, sans emblème ni mise en page de DAU ;
- le carton est sans marque.

**Le statut « en test » est dit à quatre endroits :** « EN TEST », « Bientôt », « Exemple · estimation » et la mention légale.

### 7.5 Tests avant publication, et solutions de repli

**Les questions du panel** (5 à 10 commerçants de Mboppi et 3 patrons de PME, vidéo vue sans le son puis avec) :
1. « Qu'est-ce que Bonzini promet ? »
2. « Le film dit-il qu'on peut payer moins de douane ? »

**Si une réponse ne va pas :**

| Réponse entendue | Solution de repli |
|---|---|
| « rembourser » | Couper et réimprimer : le ruban tombe en entier et l'imprimante imprime un ticket court, neuf. |
| « payer moins » | Pendant que la TVA est aspirée, ajouter « Le droit, » (12,0) puis « c'est le droit. » (12,5). |
| « c'est garanti » | Faire grossir la pastille « Exemple · estimation » et la tenir de 14,5 à 16,0. |

**Autres vérifications :**
- **Lisibilité :** sur un Android de 6 pouces, à 50 % de luminosité, à bout de bras.
- **Tutoiement pour TikTok :** une variante dit « Et si tu savais AVANT ? » et « Avant de payer ton fournisseur. ». La signature reste « Payez ».
- **Sécurité photosensible :** un seul volet de lumière en 6 images, un seul glitch de 3 images. On reste sous 3 flashs par seconde.

---

## 8. Fichiers de travail

- `<scratchpad>/cd/verify.mjs` : la recette de capture vérifiée (téléphone figé sur « Mèches », chiffres en « • », titre corrigé).
- `<scratchpad>/cd/probe.mjs` : la géométrie à 760 et à 810 CSS.
- `<scratchpad>/cd/measure.mjs` : les largeurs de tous les textes en Satoshi réel. Tous tiennent dans la boîte sûre.
- Images de contrôle :
  - `<scratchpad>/cd/phone_meches_dots.png`
  - `<scratchpad>/cd/hero_ni.png`
  - `<scratchpad>/cd/p760.png`