# BONZINI HQ — refonte mobile, version 2 (VALIDÉE par le propriétaire)

Le propriétaire a REJETÉ la version 1 (« horrible » : style moche, trop chargé, pas son app,
mauvaise logique) et a VALIDÉ la version 2 : les 8 écrans de `v2/index.html` / `v2/png/`.
Il a choisi **Wave** (l'app de mobile money) comme modèle de simplicité.
Tout nouvel écran doit ressembler à ces 8 écrans au point qu'on croie qu'ils sortent du même designer.

## Regarder AVANT de dessiner
- Les 8 PNG de `v2/png/` (outil Read) et `v2/index.html`.
- Le kit partagé : `v2/kit2.css` (styles) et `v2/kit2.js` (`sbar()`, `tabs(onglet, rôle, pastilles)`,
  `meth('alipay'|'wechat'|'bank'|'cash'|'om'|'wave'|'mtn'|'uba')`, icônes `I.*`, `qr()`, `add(titre, html)`, `render()`).
- Les règles de l'app réelle : `/home/user/bonzinilabs/src/mobile/designKit/tokens.ts` (décision du fondateur).

## Règles de style (celles de l'app, NON négociables)
- Fond **blanc**. Cartes = filet 1 px `#D9D9D9`, **rayon 8**. **Aucune ombre, aucun dégradé.**
- **Un seul bouton principal par écran : noir `#2C2C2C`**, texte `#F5F5F5`, hauteur 56, rayon 8, en bas (`.dock .btn`).
  Secondaire : blanc à filet (`.btn.soft`). Danger : rouge `#EC221F` seulement pour supprimer/annuler de l'argent.
- **Pas de violet, ambre, orange de marque dans l'interface.** La couleur ne porte QUE :
  le statut (tags : À faire/attente `#FFF1C2/#682D03`, Terminé `#CFF7D3/#02542D`, Problème `#FDD3D0/#900B09`,
  Neutre `#F5F5F5/#303030`), et les **vrais logos** (Alipay, WeChat, Orange Money, MTN, Wave, banques).
- Police DM Sans ; **rien sous 14 px** ; cibles ≥ 44 px ; chiffres en gros (36–56 px) quand c'est le sujet.
- Texte : `#1E1E1E` fort, `#303030` corps, `#5A5A5A` secondaire. Gris clair seulement pour les filets.
- Mola = la mascotte (`mola-mascot.png`), en rond, en haut à droite de l'accueil ou dans Plus — jamais flottante.

## Règles de simplicité (Wave)
- **Un écran = une question ou une chose.** 3 à 6 éléments visibles, beaucoup de blanc.
- Écran d'accueil d'un module : un **gros chiffre** (ce qui compte aujourd'hui), puis **3–4 gros boutons ronds**
  (`.acts .act .r`, le premier noir), puis UNE liste courte.
- Saisie d'un montant : **gros clavier** plein écran (écran 3 de v2). Choix : grandes lignes ou grandes tuiles.
- Listes : ligne = rond 44 px (logo ou initiales), nom, sous-titre court, montant à droite + tag. Pas de cartes empilées.
- Confirmation d'argent ou d'action sensible : **feuille du bas** avec 2–3 lignes avant/après et un bouton noir.
- Tout ce qui est rare (corriger, supprimer, exporter, réattribuer…) va dans le menu **« … »** en haut à droite,
  montré ouvert en feuille du bas dans au moins un écran du lot. Rien n'est perdu, mais rien n'encombre.
- Aucune phrase d'explication. Des libellés courts. Vocabulaire : Dépôt, Paiement, Client, Fournisseur, Créditer,
  Payé, À payer, À valider, Annuler, Messages clients, Journal, Réglages.
- Après une action : écran de succès (rond vert + coche) avec « Suivant » quand une file existe.

## Navigation (inchangée)
Rôles et barres (`tabs(onglet, rôle)`) : admin (Accueil · Opérations · Clients · Cargo · Plus), treasurer, reception,
warehouse, commercial, cash, customs — voir `TABSETS` dans kit2.js. Profil, Face ID, notifications : en haut de « Plus ».

## Données
Noms INVENTÉS (Fatou Ndiaye, Jean-Paul Mbarga, Aïcha Diallo, Samuel Nkoulou, Rosine Tchoua, Ibrahim Touré,
Aminatou Bello…), fournisseurs chinois (Guangzhou Hengtai Trading, Yiwu Jinsheng Textile, Foshan Meida Furniture,
Chen Xiaoli), références BZ-PY-2610-0416 / BZ-DP-… / RC-000412, codes client BZ-4821, conteneurs MSCU 4417092.
Taux : 1 000 000 XAF = ¥ 10 838. USDT ≈ 600 XAF. Le personnel : Nelson (super admin).

## Livrable d'un lot
- `v2/NN-nom/index.html` qui charge `../kit2.css` et `../kit2.js`, ajoute ses écrans par `add()` puis `render()`.
  Styles propres au lot dans un `<style>` du fichier, avec les MÊMES jetons (ne pas modifier kit2.css/kit2.js).
  Les images (logos, mascotte) sont dans `v2/` : les référencer en `../nom.png`.
- Rendu : `node docs/mobile-refonte/maquettes-v2/shot.cjs docs/mobile-refonte/maquettes-v2/NN-nom/index.html /tmp/png` (PNG hors dépôt)
  (lancé depuis le dossier mobile-refonte). Regarder CHAQUE PNG et corriger (débordements, chevauchements,
  logos coupés, vides bizarres, contenu sous la barre d'onglets) jusqu'à ce que ce soit net.
- `v2/NN-nom/LISTE.md` : une ligne par écran + « où est rangée chaque capacité de la version ordinateur ».
- Ne rien modifier dans le dépôt git `/home/user/bonzinilabs`. Aucun appel Supabase.
