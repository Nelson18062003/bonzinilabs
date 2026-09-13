# Admin mobile — 05 · Simplicité : cartographie de Cargo, puis restructuration

Retour fondateur (13/09) : « trop complexe pour la cible finale — des papas
d'un certain âge ; le texte est trop pâle, trop petit ; trop de choses dans
un même écran ; du texte coupé par des points ; pas de structure ». Il a
raison : la passe précédente a appliqué le kit, pas la simplicité.

## 1. Pour qui, et dans quel état

Quelqu'un de 50–60 ans, souvent debout, souvent au soleil, qui n'est pas
un logisticien et qui veut savoir **trois choses** : *ma boîte, elle en est
où ? elle arrive quand ? qu'est-ce que je dois faire ?* Tout le reste est
du détail qu'il ira chercher s'il en a besoin — jamais avant.

Conséquences non négociables :
- **Rien sous 16 px.** Corps 16, ce qui compte 18–20, le nom du client 22.
- **Texte foncé.** Le « sourd » passe de `#757575` à **`#5A5A5A`** (7:1 sur
  blanc) ; le corps est `#1E1E1E`. Le gris clair ne sert plus qu'aux filets.
- **Aucun texte coupé.** Pas de `truncate`, pas de « … » : une phrase qui ne
  tient pas passe à la ligne. Si elle est trop longue, c'est elle qu'on
  raccourcit, pas l'écran.
- **Une idée par bloc, trois blocs par écran** avant de faire défiler.
- **Des mots de tous les jours.** « Arrive à Kribi le 11 octobre », pas
  « POD · ETA · +14 j vs promesse ». « Retard de 14 jours ». « Le télex
  n'est pas encore reçu ». Le jargon (B/L, télex, BESC) reste, parce que ce
  sont les vrais noms des papiers — mais toujours **avec une phrase qui dit
  à quoi ça sert**.

## 2. Cartographie — ce qu'il y a dans Cargo

Un **conteneur** (la boîte) porte tout. Autour de lui, six familles :

| Famille | Éléments | Question qu'elle répond |
|---|---|---|
| Identité | client, numéro de boîte, armateur, B/L | *De quoi on parle ?* |
| Voyage | départ, escales, navire, position, arrivée prévue, retard | *Elle en est où, elle arrive quand ?* |
| Argent | fret dû au transitaire, payé ou non, coûts réels | *Qu'est-ce que ça coûte, qu'est-ce qu'on doit ?* |
| Papiers | B/L, télex, facture, packing list, BESC, déclaration | *Qu'est-ce qui manque pour la sortir du port ?* |
| Arrivée | franchise, dédouanement, bon de sortie, sortie, retour du vide | *Où en est-on à Kribi ?* |
| Contenu | marchandise, poids, colis, plan de chargement 3D | *Qu'est-ce qu'il y a dedans ?* |

Les relations qui comptent :
- **Voyage → Arrivée** : la date d'arrivée déclenche la franchise et la douane.
- **Papiers + Argent → Sortie** : sans télex (donc sans fret payé) et sans
  BESC, la boîte ne sort pas. C'est **la** relation qui fait les « À faire ».
- **Contenu → Papiers** : le nombre de colis du plan doit être celui de la
  packing list ; un écart, c'est la douane qui le relève.

Ce que l'admin fait, dans l'ordre de fréquence : (1) regarder si quelque
chose brûle ; (2) ouvrir une boîte pour voir où elle en est ; (3) cocher /
ajouter un papier, marquer un paiement ; (4) chercher une nouvelle
référence ; (5) regarder la carte. Le contenu 3D est (6) — utile, rare.

## 3. La structure, écran par écran

### La flotte — « qu'est-ce qui brûle »
Une carte par conteneur, **quatre lignes, jamais plus** :
1. le **client** (22/600) et l'état en un mot, coloré (En retard · À surveiller · À l'heure · Livré)
2. « Arrive à **Kribi** le **11 octobre** » — et s'il y a retard, la ligne suivante
3. « Retard de 14 jours » (en ambre) — sinon rien
4. « À faire : régler le fret au transitaire » — la prochaine chose, une seule

Le numéro de boîte et l'armateur ne sont pas sur la carte : ils sont dans
le dossier. Les filtres restent (Tous · En retard · À surveiller…) mais à
40 px et 16 px. Deux boutons dans l'en-tête : la carte, chercher.

### Le dossier — « cette boîte »
En-tête : le client (22), le numéro de boîte (16), l'état, puis **une
phrase** : « Arrive à Kribi le 11 octobre, dans 28 jours. Retard de 14
jours sur la date promise. »

Ensuite, **une liste de sections repliées**, dans l'ordre des questions,
avec un titre en français et un sous-titre qui dit l'essentiel sans ouvrir :
- **À faire** — « 6 choses avant l'arrivée » *(ouverte par défaut)*
- **Où est le conteneur** — « En mer, position d'il y a 2 jours »
- **Le trajet** — « Nansha → Kribi, jour 29 sur 57 »
- **L'argent** — « Fret 6 550 $, pas encore payé »
- **Les papiers** — « 5 manquants sur 5 »
- **La douane et l'arrivée** — « Pas encore arrivé »
- **Ce qu'il y a dedans** — « 378 colis, 52 % du volume » → le chargement en 3D
- **Le client** · **Les coûts** · **Les notes**

Une section ouverte à la fois. L'adresse suit (`/m/cargo/:id/:section`),
donc Retour et les liens continuent de marcher. Les onglets disparaissent :
huit onglets à 14 px qui défilent, c'est exactement le « touffu ».

### Suivre une référence
Un champ, un bouton, le résultat en **une carte lisible** : numéro de boîte,
état, « Arrive à Kribi le 11 octobre », le bouton « Ajouter à ma flotte »
juste sous ces trois lignes — pas après neuf lignes de détail. Le détail
(navire, voyage, ports, jalons) est replié dessous.

### La carte
Inchangée dans sa structure (plein écran, feuille par navire) ; la feuille
prend la même langue : « Arrive à Kribi le 11 octobre ».

## 4. Ce que ça condamne dans le code d'hier

`truncate` sur les noms et références ; `TEXT.muted` à `#757575` pour du
texte porteur d'information ; les 14 px comme taille de corps ; les libellés
« B/L · CMA CGM LAPEROUSE · 631W » en une ligne ; la barre de huit chips ;
les grilles de « faits » à deux colonnes (label 11 px / valeur 13 px) pour
tout ce qui n'est pas un chiffre à comparer.
