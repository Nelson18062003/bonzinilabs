# BONZINI HQ — refonte mobile : règles communes

Le propriétaire veut des **images réalistes de l'app** (comme des captures d'écran d'un vrai iPhone),
PAS une maquette explicative, PAS de texte d'explication dans les écrans. Il a rejeté une page de
prototype « avec des explications » comme « horrible ». Chaque écran doit ressembler à une vraie app
iOS haut de gamme (niveau Revolut / Wise / Linear mobile), dense mais lisible, avec de vraies données.

## Référence visuelle (OBLIGATOIRE à regarder avant de dessiner)
- `00-depots-paiements/index.html` + ses PNG dans `00-depots-paiements/png/` : 12 écrans déjà validés
  dans le style. Reprendre exactement ce langage : mêmes composants, mêmes tailles, mêmes couleurs.
- Kit partagé : `kit.css` (styles) et `kit.js` (icônes `ic.*`, `sbar()`, `tabs()`, `mk()`, `pill()`,
  `row()`, `qr()`, reçus, `add(titre, sous-titre, html, cls)`, `render()`). Lire les deux fichiers.
- Un lot = un fichier `NN-nom/index.html` qui charge `../kit.css` et `../kit.js`, appelle `add(...)`
  pour chaque écran puis `render()`. Styles propres au lot : un `<style>` dans le fichier du lot
  (ne PAS modifier kit.css ni kit.js : d'autres lots tournent en parallèle).
- Rendu : `node ../shot.cjs index.html png` depuis le dossier du lot (ou chemins absolus).
  Regarder CHAQUE PNG (outil Read) et corriger : texte qui déborde ou se chevauche, boutons écrasés,
  icônes absentes, zones vides bizarres, contenu caché sous la barre d'onglets. Itérer jusqu'à net.

## Cadre
- iPhone 393×852, barre d'état 9:41 (`sbar()`), indicateur d'accueil (`<div class="home-ind"></div>`).
- Police DM Sans (chinois : Noto SC). Fond `--bg #f4f2f7`, encre `--ink #17111f`.
- Couleurs de marque : violet `#7a3cf0` (paiements, actions principales de navigation), ambre
  `#e38a0b` (dépôts, argent qui entre), orange `#f0530f` (à faire, urgence). Vert `#1c9a57` = terminé.
- 4 familles de statut, partout : **À faire** (orange) · **En attente** (ambre) · **Terminé** (vert)
  · **Problème** (rouge). `pill('todo'|'wait'|'done'|'bad', libellé)` (voir kit.css pour les classes).

## Navigation (décidée)
Barres d'onglets par rôle (`tabs(onglet, pastilles, rôle)` dans kit.js) :
- admin (super_admin, ops, support, success) : Accueil · Opérations · Clients · Cargo · Plus
- treasurer : Accueil · Trésorerie · Plus
- reception (Guangzhou) : Aujourd'hui · Paquets · Scanner · Clients · Plus
- warehouse (Douala) : Journée · Pointer · Scanner · Remettre · Plus
- commercial : Mon mois · Prospects · Mes clients · Plus
- cash (agent cash) : Paiements · Scanner · Plus
- customs (commissionnaire) : À signer · Simulateur · Plus
Le scanner admin est un bouton dans la barre de recherche de l'Accueil. « Moi » (profil, Face ID,
notifications, mises à jour, déconnexion) est en haut de « Plus » pour TOUS les rôles.
« Plus » = grille de modules : Trésorerie, Taux, Analyses, Messages clients, Douane, Mola,
Coordonnées de paiement, Équipe & ventes, Journal, Justificatifs, Veille, Réglages.

## Règles UX
- **Une seule action principale** par écran, en bas (dock). Les actions secondaires : menu « … »
  en haut à droite, ouvert en feuille du bas (montrer la feuille ouverte dans au moins un écran du lot).
- Tout ce que fait la version ordinateur doit exister sur mobile (voir le rapport du module) :
  si une capacité est rare, elle va dans « … » ou dans une feuille, mais elle existe.
- Pas de phrases : des libellés courts, des chiffres, des statuts. Aucun texte d'aide qui explique l'écran.
- Les listes : recherche + puces de filtre (filtre retenu), regroupement par jour, ligne = icône,
  nom (2 lignes max), sous-titre, montant à droite, statut en point coloré.
- Les fiches : en-tête « < Retour » + référence + « … », gros montant / identité au centre,
  pastille de statut, cartes de détail, historique en timeline.
- L'argent et le sensible se confirment par une feuille (montant avant/après), jamais en un tap.
- Après une action : bandeau de succès + « Suivant » quand une file existe.
- Les onglets internes d'une fiche longue : segmented control en haut (pas d'accordéon de 12 sections).
- Vocabulaire unique (ne pas varier) : Dépôt, Paiement, Client, Bénéficiaire, Crédit/Débit,
  Annuler (pas « Supprimer » pour une opération d'argent), Messages clients, Journal, Réglages.

## Données
Noms INVENTÉS uniquement (jamais de vrais clients) mais formes réelles : noms camerounais de 15–30
caractères, sociétés chinoises (Yiwu…, Guangzhou…, Foshan…), références BZ-PY-2610-0409,
BZ-DP-…, codes client BZ-4821, conteneurs MSCU1234567 / MIEU…, montants réalistes (paiement
médian ¥7 493, dépôt médian 1 000 000 XAF, taux 1 M XAF = ¥10 838, USDT ≈ 600 XAF).
Le personnel : « Nelson » (super admin). Bonzini a son bureau et son entrepôt à Guangzhou ; le
transitaire fait booking/camion/douane export ; NORTON GAUSS BONZINI SARL reçoit à Douala.

## Livrable de chaque lot
- `NN-nom/index.html` + `NN-nom/png/01.png…` (un PNG par écran, tous vérifiés à l'œil).
- `NN-nom/LISTE.md` : une ligne par écran : n°, titre, ce qu'il montre, quelles capacités desktop il
  couvre. Plus une liste « capacités du module placées où » pour prouver que rien n'est perdu.
- Ne rien modifier dans le dépôt git `/home/user/bonzinilabs` (lecture seule), ne rien committer.
