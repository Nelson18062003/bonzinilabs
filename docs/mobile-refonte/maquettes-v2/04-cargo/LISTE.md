# Lot 04 · Cargo, Réception (Guangzhou), Entrepôt (Douala)

17 écrans, `index.html` → `png/01.png … 17.png`. Kit : `../kit2.css`, `../kit2.js` (non modifiés).

## Les écrans

| # | Écran | Rôle · onglet | Ce qu'on y voit |
|---|---|---|---|
| 01 | Cargo | admin · Cargo | gros chiffre « En mer · 6 conteneurs » (2 en retard, 3 sous 7 j) ; ronds Suivre · Avion · Réception · Carte ; 4 conteneurs avec logo armateur et tag de retard |
| 02 | Conteneur · Suivi | admin | ligne Nansha → Douala avec le navire, « Arrive le 28 oct. +4 j, promis le 24 » ; tags Télex / Fret / BESC ; onglets Suivi · Documents · Colis · Coûts ; escales fait / ici / à venir ; position et arrivée retenue |
| 03 | Conteneur · Documents | admin | BL, Télex release (chez Eric, le transitaire), packing list (entrepôt), factures clients 9/14 ; bouton « Ajouter une pièce » |
| 04 | Conteneur · menu « … » | admin | Rafraîchir, Corriger l'arrivée, Mettre à jour la position, Modifier les escales, Navire et voyage, Marquer arrivé, Avis d'expédition (PDF), Retirer de la flotte (rouge) |
| 05 | Expédition avion | admin | « 6 paquets », LTA, vol, Préparation ; trajet, fret, clients non soldés ; scan au départ 4/6 ; bouton « Scanner les paquets » |
| 06 | Réception · dépôts | admin | recherche RC/BZ/client/bordereau ; Dépôts · Colis · Paquets ; puces Tous / À attribuer / Incomplets / Sans photo ; dépôts par jour avec montant du devis et état |
| 07 | Fiche dépôt | admin | client, 3 colis avec photo, poids et m³, « Ajouter un colis », devis 148 000 XAF à payer ; bouton « Encaisser 148 000 XAF » |
| 08 | Fiche dépôt · menu « … » | admin | Modifier le dépôt, Réattribuer, Étiquettes des colis, Étiquette client, Bon de réception (PDF), Devis (PDF) FR · EN, Supprimer le dépôt (rouge) |
| 09 | Devis · encaisser | admin | feuille : Espèces / Orange / MoMo / Solde ; solde avant, débité, solde après ; « Encaisser » |
| 10 | Réception · Aujourd'hui | reception · Aujourd'hui | lieu Bureau ; « 37 colis reçus aujourd'hui » ; ronds Nouveau dépôt · Scanner · Paquets · Sans client (2) ; dépôts du jour |
| 11 | Nouveau dépôt · 1. Le client | reception | caméra sur la carte QR du client ; recherche nom/BZ ; récents ; Sans client ; Nouveau client |
| 12 | Colis · photo et mesures | reception | photos + Ajouter ; état Bon / Abîmé / Ouvert / Mouillé ; poids ; L × l × H et m³ calculé ; contenu ; nombre d'étiquettes ; « Enregistrer le colis » |
| 13 | Réception · Paquets avion | reception · Paquets | paquet en cours PQ-000234, jauge 24,6 / 32 kg ; « 12 colis attendent » ; paquets fermés ; « Mettre sur un vol · 2 paquets » |
| 14 | Entrepôt · Journée | warehouse · Journée | « 25 colis à pointer » (31 attendent, 2 manquants) ; ronds Pointer · Scanner · Remettre · Bons ; arrivées (conteneur, vols) |
| 15 | Entrepôt · Pointer | warehouse | MIEU 3611115 61/86, barre de progression ; scan ou saisie ; puces Tous / À pointer / Manquants ; colis à pointer (photo de Guangzhou), pointé avec rangée, abîmé, manquant ; « Terminer le pointage » |
| 16 | Entrepôt · Remettre | warehouse | client « QR vérifié » ; 3 colis prêts avec photo et rangée ; devis 148 000 XAF, reste 0, Payé ; signature au doigt + Effacer ; « Remettre 3 colis » |
| 17 | Entrepôt · Remis | warehouse | rond vert ; 3 colis à Fatou, bon BR-000189 ; « Client suivant · Ibrahim Touré » ; « Bon de retrait (PDF) » |

## Où se trouve chaque capacité de l'ordinateur

### Container (flotte et dossier)
- **Suivre un conteneur / Ajouter à la flotte / Ajouter quand même** : rond **Suivre** (01).
- **Carte** (navires, feuille par navire) : rond **Carte** (01).
- **Recherche** (client, conteneur, B/L, navire, port) : loupe en haut de Cargo (01).
- **Files** Tous / En mer / Sous 7 j / À régler / Sans suivi / Livré, **armateur**, **destination**, **tri** : « Tout voir » (01) → liste complète avec puces, comme Opérations ; armateur, destination et tri dans le « … » de cette liste.
- **CSV de la flotte** : « … » de la liste complète.
- **À faire cette semaine** : tags de la liste (Télex, retard) ; chaque tag ouvre la section concernée.
- **Aperçu rapide** : remplacé par l'ouverture directe du dossier (02).
- **En-tête du dossier** : n° conteneur (copier : appui long), navire, POL → POD, arrivée relevée / armateur / promise, retard (02).
- **Fret réglé / non réglé, Télex reçu / non reçu** : toucher les tags **Fret** et **Télex** de l'en-tête (02) → feuille avant/après. **BESC** : le tag ouvre la Douane.
- **Rafraîchir**, **Corriger l'arrivée / revenir à l'armateur**, **Mettre à jour la position**, **Modifier les escales**, **Navire et voyage**, **Marquer arrivé / Annuler l'arrivée**, **Avis d'expédition (PDF)**, **Retirer de la flotte** : menu « … » (04).
- **Suivi** : escales fait / en cours / à venir, position et sa date, arrivée retenue (02). Jalons de l'armateur, estimations successives et dernier mouvement : toucher une escale ou la ligne « Position ».
- **Voir en direct (MarineTraffic)** : toucher la ligne « Position » (02).
- **Documents** : pièces avec état (03) ; **Ajouter une pièce** (bouton) ; toucher une pièce : aperçu, télécharger, déposer des fichiers, renommer/déplacer, supprimer ; **Déposer sans classer** et **Préparer les pièces habituelles** dans le « … » de l'onglet.
- **Colis** (onglet) : clients du groupage, lots, chargement 3D, **Charger des colis reçus**, **Sortir de la boîte**, lots sans propriétaire → **Attribuer**, **Rattacher / Détacher** le dossier à une fiche client. Un seul endroit (fin du doublon « Dedans » / « 3D »).
- **Coûts** (onglet) : totaux, **Ajouter un coût**, payé, justificatifs, fret annoncé, **Saisir la facture**, **Estimer le coût à quai**.
- **Douane & arrivée, Intervenants, Notes** : en bas de l'onglet **Suivi** (Douane, étape par étape ; l'arrivée y est déjà) et dans l'onglet **Documents** (Intervenants : transitaire, déclarante, avec appel et WhatsApp). La note interne est dans le « … » du dossier, sous « Avis d'expédition ».

### Avion
- **Liste des expéditions** (En cours / Préparation / En vol / Arrivés / Tous) et **Nouvelle expédition** : rond **Avion** (01).
- **Fiche avion** (05) : LTA (« à venir » si provisoire), vol, dates, fret, clients non soldés.
- **Scan au départ** : bouton principal (05). Une fois tout scanné, le bouton devient **L'avion est parti**, puis **L'avion est arrivé à Douala**.
- **Ajouter des paquets, Retirer un paquet, Refusé à l'aéroport (motif)** : toucher un paquet de la liste (05), ou « … ».
- **Charger / retirer des colis, Modifier la fiche, Pas parti, Avis d'expédition (PDF)** : « … » de la fiche avion (05).

### Réception (vue de l'équipe)
- **Entrée** : rond **Réception** (01).
- **Recherche** RC, BZ, client, bordereau, contenu (et PQ, LTA en vue Paquets) ; **vues** Dépôts · Colis · Paquets (06). Les vues Photos et Par client sont dans le « … » de la page.
- **Files** Tous / À attribuer / Incomplets / Sans photo / En cours / En attente / Partis : puces qui défilent (06).
- **Période** (En stock, Aujourd'hui, 7 / 30 / 90 j, Tout, **Supprimés**), **Lieu** (Entrepôt / Bureau), **Reçu par**, **CSV**, **langue des devis FR | EN**, **Comptes cargo**, **À Douala** : « … » de la Réception (06).
- **Sélection en lot** (étiquettes PDF, impression, Mettre en paquet) : appui long sur une ligne → cases, barre en bas.
- **Fiche dépôt** (07) : client, colis avec photo (toucher : visionneuse, Modifier mesures/photos/couverture/état/bordereau, étiquette du colis, Supprimer avec motif), **Ajouter un colis**, devis.
- **Encaisser** : bouton (07) → feuille (09), dont le **solde du client** avec avant/après. Reçu PDF et partage sur l'écran de succès.
- **Devis** : toucher la ligne « Devis » (07) → prix par ligne (kg, m³, forfait), frais/remise, Envoyer/Renvoyer, PDF, partage.
- **Annuler un encaissement, Facture, Bons de retrait, Historique** : sous le devis, en faisant défiler la fiche.
- **Modifier le dépôt** (lieu, apporté par, fournisseur, notes), **Réattribuer**, **Étiquettes des colis**, **Étiquette client**, **Bon de réception (PDF)**, **Devis (PDF) FR · EN**, **Supprimer le dépôt** (motif) / **Rétablir** (s'il est supprimé) : menu « … » (08).
- **Paquets avion** (Nouveau paquet, Ouvrir PQ, Mettre en paquet, Fermer, étiquette PQ, Rouvrir, Supprimer vide, **Mettre sur un vol**) : vue **Paquets** (06), mêmes écrans que l'app Réception (13).

### App Réception (Guangzhou, `/r`)
- **Lieu** Bureau / Entrepôt + **Changer** : pastille en haut (10).
- **Journée** jour par jour : « Hier » (10).
- **Nouveau dépôt** : rond noir (10) → client (11) : scan QR, recherche, récents, **Sans client**, **Nouveau client** ; puis « Apporté par » (2/4), fournisseur (3/4, Passer), colis (12).
- **Colis** sur un seul écran (12) : photos (plusieurs), état à la réception, poids, dimensions et m³ calculé, contenu, nombre d'étiquettes. Le bordereau scanné à l'étape 1 est gardé ; la note d'état apparaît en choisissant Abîmé / Ouvert / Mouillé.
- **Fiche du dépôt en cours** : Attribuer, Ajouter un colis, Terminer (N), retirer un colis, **Abandonner** un dépôt vide, Imprimer les étiquettes. Sur la fiche, comme 07, sans l'encaissement.
- **Sans client / En attente** → Attribuer : rond **Sans client** (10) avec sa pastille.
- **Scanner** (QR client, RC, PQ) : rond et onglet **Scanner**.
- **Clients** (recherche, carte et QR, étiquette client, Nouveau dépôt pour lui) : onglet **Clients**.
- **Paquets** (13) : paquet en cours et jauge (toucher → douchette, colis prêts, Ajouter, Retirer, **Fermer (pesée)**, étiquette, Rouvrir, Supprimer vide) ; « N colis attendent » → choisir par client, Mettre en paquet (découpe automatique au-delà de 32 kg) ; fermés prêts ; **Mettre sur un vol** (absent de `/r` aujourd'hui) ; « Tous » : refusés, affectés. **Scan au départ** à l'aéroport : bouton scan en haut de Paquets.

### App Entrepôt (Douala, `/w`)
- **Journée** (14) : à pointer, attendent leur client, manquants ; arrivées conteneur et vols ; **Bons** : remis aujourd'hui et bons de retrait.
- **Recevoir un paquet** (`air_package_receive`) : scanner un PQ (rond Scanner), ou ouvrir l'arrivée du vol → « paquets reçus X / Y ».
- **Pointer** (15) : scan ou saisie, toucher une ligne = pointé OK. Appui long : **abîmé** (remarque), **place de rangement** ou **manquant**. **Ouvrir le paquet** sur les arrivées avion. **Tout pointer** et **Déclarer les N manquants** dans le « … », puis **Terminer le pointage** → bilan.
- **Remettre** : onglet ou rond (14) → scan du QR (ou BZ / RC) ou « Qui attend » → client (16) : colis prêts, pas encore là (repliés), devis et reste à payer. Si un devis n'est pas soldé, le bouton devient **Encaisser d'abord** (même feuille que 09, solde du client compris). **Qui vient chercher** : sous le nom (« elle-même » ; toucher pour une autre personne). **Signature** au doigt et **Effacer**.
- **Succès** (17) : bon BR, **Bon de retrait (PDF)** (partage WhatsApp par l'app), **Client suivant**.

### Réglages (hors lot, dans Plus)
- **Tarifs cargo** (XAF/kg avion, XAF/m³ bateau) et **Adresses en Chine (étiquette)** : Plus › Réglages › Expédition.
- **Comptes cargo** : « … » de la Réception (06).
