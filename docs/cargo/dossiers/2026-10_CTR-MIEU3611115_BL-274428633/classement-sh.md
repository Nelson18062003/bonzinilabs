# Conteneur MIEU3611115 : le classement des marchandises (codes SH)

> Préparé le 02/10/2026. **Proposition à faire valider et signer par la déclarante agréée** :
> c'est elle qui répond du classement devant la douane (Code des douanes CEMAC, art. 449-450).
>
> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.

---

## 1. La méthode

Le classement suit les **Règles générales interprétatives (RGI) du Système harmonisé**,
qui s'imposent à tous les pays membres de l'OMD, Cameroun compris.

| Étape | Ce qu'on fait | Règle |
|---|---|---|
| 1 | **Identifier la marchandise** : ce que c'est, sa matière, son usage, neuve ou usagée, ses caractéristiques techniques | — |
| 2 | Trouver la **position** (4 chiffres) d'après le **texte des positions** et les **notes** de section et de chapitre. Les titres ne comptent pas | RGI 1 |
| 3 | Descendre à la **sous-position** (6 chiffres) en comparant seulement les sous-positions du même niveau | RGI 6 |
| 4 | Ajouter le **niveau national** (jusqu'à 12 chiffres dans CAMCIS). Pour les voitures : essieux moteurs et âge | tarif national |
| 5 | Lire les **taux** : droit de douane (TEC), accises (CGI), TVA | TEC, CGI |
| 6 | Noter les **faits manquants** qui changeraient le code, et les demander (photo, étiquette, fiche) | — |

**Sources utilisées :**
- **Libellés à 6 chiffres** : Système harmonisé 2022 de l'OMD, et Nomenclature combinée
  (Eurostat) pour le français. Fichier `public/data/customs/nomenclature-cm.v1.json` de la
  plateforme.
- **Taux du droit de douane** : tarif appliqué par le Cameroun, publié par l'OMC et la
  CNUCED (TRAINS, 2019). Il est identique à la déclaration de septembre 2026 sur les 8 lignes
  qu'elle porte. Le TEC CEEAC-CEMAC du 01/01/2026 a pu changer certaines lignes : **à
  confirmer** sur le tarif CAMCIS.
- **Niveau national des voitures** : relevé sur notre propre déclaration d'août 2026.
  `.10` = un seul essieu moteur (2 roues motrices) ; `.90` = autres (4 roues motrices).
  `9100` = de 1 à 15 ans ; `9900` = plus de 15 ans.
- **Faits sur les voitures** : numéros de châssis, certificats CICQ du 01/10/2026, packing list.

---

## 2. Les 3 voitures : classement sûr

Règle : position **87.03** (voitures de tourisme), puis la sous-position selon le
**moteur** (essence seule, à allumage par étincelles) et la **cylindrée**.

| Voiture | Faits | Sous-position | Code national proposé | Droit de douane |
|---|---|---|---|---|
| **Toyota Yaris** LVGCU92399G028166 | essence, **1 598 cm³** (moteur 1ZR, certificat : 1 600), 2 roues motrices, fabriquée **10/2009**, soit 17 ans | **8703.23** (1 500 < cylindrée ≤ 3 000 cm³) | **8703.23.10.9900** | 30 % |
| **Toyota RAV4** LFMJ34AF0E3035663 | essence, **2 494 cm³** (certificat : 2 500), type **ASA44**, soit **4 roues motrices**, fabriquée **01/2014**, soit 12 ans | **8703.23** | **8703.23.90.9100** | 30 % |
| **Haval H6** LGWEF4A52GF073391 | essence turbo, **1 497 cm³** (certificat : 1 500), 2 roues motrices, fabriquée en **2016**, soit 10 ans | **8703.22** (1 000 < cylindrée ≤ 1 500 cm³) | **8703.22.10.9100** | 30 % |

**Points de vigilance :**
- **Haval** : 1 497 cm³, donc **8703.22**, et pas 8703.23 comme sur le BESC. La limite est
  « n'excédant pas 1 500 cm³ » : même avec 1 500 cm³ inscrit sur le certificat, on reste en
  8703.22. À vérifier sur la plaque du moteur à la visite.
- **RAV4** : le code de type **ASA44** se termine par 4, ce qui chez Toyota désigne les
  4 roues motrices (2.5 L). Le BESC l'appelle à tort « Auris ».
- **Accises** : le taux dépend du code à 12 chiffres et de l'âge (CGI, art. 142 et
  annexe II). En septembre 2026, CAMCIS appliquait 25 % à une Yaris 2009 de plus de 15 ans.
  Le taux exact pour le RAV4 et le Haval est **à confirmer sur le tarif CAMCIS**.
- **Valeur** : fixée par SGS avec le **CIVIC**, pas par facture.

---

## 3. Les autres marchandises : classement selon les faits

| # | Marchandise (packing list) | Code proposé | Droit de douane | Ce qui pourrait changer le code | À demander |
|---|---|---|---|---|---|
| 1 | **Verres de lunettes** (眼镜片, « GLASS EYE »), 13 colis | **9001.40** s'ils sont en verre · **9001.50** s'ils sont en résine ou polycarbonate | 10 % dans les deux cas | s'ils ne sont **pas travaillés optiquement** (ébauches) : **7015.10**, 5 % | matière, verres finis ou ébauches, photo de l'étiquette |
| 2 | **Climatiseur** (空调), 1 colis | **8415.10** (appareil mural, fenêtre ou « split-system ») | 30 % | si seule une partie est présente (unité extérieure seule) : à revoir | photo, appareil complet ou non |
| 3 | **Chaises** (椅子), 5 colis | **9401.71 / 9401.79** si le bâti est en métal · **9401.61 / 9401.69** s'il est en bois · **9401.80** sinon (plastique, etc.) | 30 % dans tous les cas | — | matière, rembourrées ou non. En août : 9401.80, avec des accises de 25 % |
| 4 | **Pièces mécaniques** (机械配件), 1 colis | **impossible à classer** sans savoir ce que c'est | variable | une pièce se classe avec la machine à laquelle elle est destinée (notes de la section XVI) | **description précise par le client** |
| 5 | **Machine à laver** (洗衣机), 1 colis de 1,56 m³ | **8450.11** si entièrement automatique et ≤ 10 kg · **8450.12 / 8450.19** sinon | 30 % | si la capacité dépasse **10 kg** : **8450.20**, 20 % | capacité en kg, automatique ou non, nombre de machines (1,56 m³, c'est beaucoup pour une seule) |
| 6 | **Meuble de rangement** (柜子), 1 colis | **9403.20** en métal · **9403.60** en bois · **9403.70** en plastique | 30 % dans tous les cas | usage (bureau, cuisine, chambre) : seul le code change, pas le taux | matière et usage |
| 7 | **Étendoirs à linge** (晾衣架, en U, double barre), 50 colis | **7323.99** en acier · **7323.93** en inox · **7615.10** en aluminium | 30 % dans tous les cas | — | matière |
| 8 | **Vêtements** (衣服), 1 colis de 5,98 m³ | **6309.00** s'ils sont **usagés** (friperie) · chapitres **61** (tricot) ou **62** (tissu) s'ils sont **neufs**, selon le type et la fibre | 30 % | neufs ou usagés : c'est le point clé | neufs ou usagés, types (pantalons, chemises…), fibre. En août : vêtements neufs, 30 % + accises 12,5 % |
| 9 | **Tôles** (锌板), 7 paquets, « Olivier Yaoundé » | **7210.41** si acier zingué **ondulé** (tôle de toiture) · **7210.49** zingué plat · **7210.70** peint ou prélaqué · **7905.00** si **zinc pur** | **30 %** (acier zingué) · **20 à 30 %** (prélaqué) · **10 %** (zinc pur) | « 锌板 » veut dire « plaque de zinc », mais en Chine le mot désigne souvent l'**acier galvanisé** (镀锌板). Si la largeur est inférieure à 600 mm : 7212.30, 20 % | **photo**, couleur, ondulée ou plate, largeur, épaisseur, fiche du fabricant |
| 10 | **Chaussures** (鞋子), 1 colis | chapitre **64**, selon la matière de la semelle et du dessus (6402, 6403, 6404…) · **6309.00** si usagées | 30 % | neuves ou usagées | matière, neuves ou usagées |
| 11 | **Hauts, vestes** (上衣), 1 colis | comme les vêtements : 6309.00 ou chapitres 61 et 62 | 30 % | neufs ou usagés | idem |

**Les deux lignes où le code change vraiment l'argent :**
1. **Les tôles** : 10 % si c'est du zinc pur, 30 % si c'est de l'acier zingué. C'est la
   marchandise la plus lourde du conteneur.
2. **La machine à laver** : 20 % au-dessus de 10 kg, 30 % en dessous.

Pour les autres lignes, tous les codes possibles ont **le même taux** (30 % ou 10 %) :
une erreur de code y change peu l'argent, mais il faut quand même le bon code.

---

## 4. Ce que le BESC a écrit, et ce qu'il faudra corriger

| BESC MI2661716 | Proposition |
|---|---|
| 8703.23.19 pour les 3 voitures | Yaris 8703.23 · RAV4 8703.23 · **Haval 8703.22** |
| « Toyota Auris » | **Toyota RAV4** |
| « Toyota Vitz » | **Toyota Yaris** |
| 9905.00.00 « METAL FITTINGS PERSONAL EFFECTS » | le chapitre 99 n'existe pas dans le Système harmonisé (chapitres 1 à 97). C'est un code national ou propre au BESC pour les effets : **à vérifier** |

---

## 5. Les questions pour notre entrepôt de Guangzhou

L'entrepôt a reçu et chargé ces colis : il est le mieux placé pour répondre.
1. Les verres de lunettes : en verre ou en résine ? finis ou ébauches ? Photo d'un carton.
2. Le climatiseur : appareil complet (unités intérieure et extérieure) ?
3. Les chaises et le meuble : en quelle matière ?
4. Les « pièces mécaniques » : qu'est-ce que c'est exactement, et pour quelle machine ?
5. La machine à laver : capacité en kg, automatique ou non, combien de machines ?
6. Les étendoirs : en acier, en inox ou en aluminium ?
7. Les vêtements, hauts et chaussures : neufs ou usagés ? quels types ?
8. Les tôles : photo, couleur, ondulées ou plates, largeur et épaisseur, zinc ou acier galvanisé ?
