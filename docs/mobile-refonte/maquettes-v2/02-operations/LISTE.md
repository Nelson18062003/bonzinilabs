# Lot 02 · Opérations (v2)

Rendu : `node shot.cjs v2/02-operations/index.html v2/02-operations/png` (16 écrans, 0 erreur).
Complète les 8 écrans validés (Accueil, nouveau paiement 1-2-3, fiche « À payer », « Payé », liste des paiements, nouveau dépôt).

## Écrans

| PNG | Écran | Ce qu'il montre |
|---|---|---|
| 01 | Opérations · Dépôts | Même écran que la liste des paiements, onglet Dépôts. Puces À valider 2 / Crédités / Refusés / Tous. Lignes : logo du moyen, client, moyen + âge (ou « vu en banque »), montant XAF, tag. En-tête : recherche + « … » |
| 02 | Opérations · menu « … » | Feuille : Filtres et tri · Lots de paiements (2 en cours) · Exporter les en cours (PDF) · Justificatifs |
| 03 | Dépôt · À valider | Logo du moyen, 850 000 XAF en gros, tag À valider, photo de la preuve (1/2, un appui l'agrandit), Client (lien vers sa fiche) · Solde · Référence. Un seul bouton noir « Créditer 850 000 XAF » |
| 04 | Dépôt · Créditer ? | Feuille de confirmation : Montant reçu (souligné, modifiable) · Solde avant · Solde après, interrupteur « Prévenir Fatou », bouton noir « Créditer » |
| 05 | Dépôt · menu « … » | Vu en banque (interrupteur) · En vérification · Remplacer la preuve · Ajouter une preuve · Reçu PDF · Refuser · Annuler le dépôt (rouge, séparé) |
| 06 | Dépôt · Refuser | Feuille : puces de motif (Preuve illisible, Montant différent, Pas reçu, Doublon, Mauvais client, Autre), message au client pré-rempli, lien « Ajouter une note interne », bouton noir |
| 07 | Paiement · Marquer payé | Feuille sur la fiche « À payer » : photo du reçu Alipay (Changer), message à Fatou (facultatif), bouton noir « Payé » → écran « Payé » validé |
| 08 | Paiement · menu « … » | Partager l'instruction · Exporter l'image · Reçu PDF · Historique · Modifier le fournisseur · Corriger le montant · Passer en cours · Refuser · Annuler le paiement (rouge, séparé) |
| 09 | Paiement · Historique | Suivi : Créé (Nelson, lien vers le lot) → Fournisseur ajouté → Instruction envoyée → À payer (en cours, jaune) → Payé (à venir). Section Pièces : instruction, QR fournisseur, Ajouter |
| 10 | Opérations · Filtres | Feuille : Période (Aujourd'hui, 7 j, 30 j, calendrier = dates libres) · Moyen (tuiles logos) · Statut (Sans fournisseur, Refusés, Annulés) · Trier (Récent / Ancien / Montant ↓, un 2e appui inverse) · « Voir 12 paiements » |
| 11 | Cash · Retrait au bureau | Logo ¥ cash, ¥ 23 060, tag Au bureau, qui retire (le client ou un tiers), Lieu · Créé · Référence. Bouton noir « Scanner le QR du client » |
| 12 | Cash · Scanner le QR | Caméra plein écran (seul écran sombre), cadre, montant et client attendus, Fermer, lampe, « Saisir le code » |
| 13 | Cash · Signature | Récap ¥ 23 060 à Ibrahim, Nom de la personne (obligatoire, pré-rempli), Pièce d'identité (facultatif), zone de signature + Effacer, case « Espèces remises ». Bouton noir « Confirmer la remise » (actif seulement si nom + signature + case) |
| 14 | Cash · Remis | Rond vert, « Remis », montant, heure de signature, client prévenu. « Scanner le suivant » + « Reçu de remise » |
| 15 | Lots de paiements | Nouvelle liste (n'existait nulle part) : client, nombre de fournisseurs, date, total ¥, tag 3/6 payés ou Payé. « + » = nouveau lot |
| 16 | Lot · Payer le suivant | Total ¥ 96 400, client + XAF débité, barre 3 sur 6, les 6 lignes (un appui ouvre la fiche paiement). Bouton noir « Payer le suivant · ¥ 18 200 » |

L'agent cash (rôle `cash`) voit les écrans 11 → 14 tels quels ; son onglet « Paiements » est la liste des paiements validée filtrée sur Cash, avec `tabs('ops','cash')` ; son onglet « Scanner » ouvre directement l'écran 12. Plus d'écran de connexion à part (`/a/login`) : connexion unique.

## Où est rangée chaque capacité de la version ordinateur

| Capacité (desktop) | Place mobile |
|---|---|
| Lister / compter les dépôts, files À traiter · À corriger · Tous | 01 : puces À valider (= À traiter + À corriger, tag jaune) · Crédités · Refusés · Tous ; compteur sur la puce |
| Recherche serveur (nom, téléphone, référence, bénéficiaire) | Loupe de l'en-tête d'Opérations (recherche serveur, aussi sur le fournisseur) |
| Filtres Méthode / Période / Statut, tri par colonne | 10 (via 02) ; même feuille pour les dépôts avec Orange, MTN, Wave, Banque |
| Case « Vérifié en banque » (`set_deposit_verified`) | 05 interrupteur ; affiché dans la liste 01 (« vu en banque ») |
| Démarrer la vérification (`start_deposit_review`) | 05 « En vérification » |
| Valider un dépôt (montant confirmé, note, notifier) | 03 bouton → 04 (montant modifiable, Prévenir, note via « … » de la feuille si besoin) |
| Valider sans vérification | 03 → 04 directement (le bouton est le même) |
| Rejeter un dépôt (motif, message, note interne) | 05 → 06 |
| Ajouter / remplacer / supprimer une preuve de dépôt | 05 (Ajouter, Remplacer) ; supprimer = appui sur la photo en 03 → visionneuse → Supprimer (motif) |
| Annuler un dépôt (super admin) | 05 en rouge, seulement si non terminé |
| Relevé / reçu PDF du dépôt | 05 « Reçu PDF » |
| Lien vers la fiche client | 03 « Client » souligné |
| Créer un dépôt | Écran validé « Nouveau dépôt » (Accueil → Dépôt) |
| Lister / compter les paiements, file « Info manquante » | Liste validée ; « Sans fournisseur » dans 10 |
| Exporter les paiements en cours (PDF) | 02 |
| Passer en cours (`process_payment start`) | 08 « Passer en cours » |
| Valider un paiement (preuve + commentaire client) | Fiche validée → 07 (photo + message) → « Payé » validé |
| Refuser un paiement | 08 « Refuser » (même feuille de motifs que 06) |
| Annuler un paiement (super admin, motif) | 08 en rouge |
| Modifier / corriger montants et taux | 08 « Corriger le montant » |
| Modifier le bénéficiaire (+ QR) | 08 « Modifier le fournisseur » (remplace la page orpheline `/edit-beneficiary`) |
| Ajouter une preuve / une instruction du client | 09 « Pièces » → Ajouter ; la preuve de paiement aussi en 07 |
| Remplacer / supprimer une preuve de paiement, ouvrir un PDF | 09 appui sur une pièce → visionneuse (Ouvrir, Remplacer, Supprimer) ; 07 « Changer » |
| Instruction de paiement (PDF, image, texte) | 08 « Partager l'instruction » (feuille de partage native) |
| Fiche en PNG (copier / télécharger) | 08 « Exporter l'image » |
| Reçu PDF du paiement (avec QR cash + signature) | 08 « Reçu PDF » ; cash : 14 « Reçu de remise » |
| Suivi / timeline du paiement | 09 (via 08 « Historique ») |
| Information « Lot » sur la fiche | 09 lien « Lot BZ-LT-… » → 16 |
| Faire signer le cash | 11 → 12 → 13 → 14 |
| Agent : scanner / saisir l'ID | 12 (caméra + « Saisir le code ») |
| Agent : procéder (`scan_cash_payment`) | Automatique au scan réussi en 12 |
| Agent : confirmer remise + signature | 13 (nom obligatoire, n° de pièce facultatif, case, signature) |
| Créer un paiement groupé | 15 « + » (et Accueil → Paiement) |
| Voir / lister les lots | 15 et 16 (manquait des deux côtés) |
| Justificatifs | 02 « Justificatifs » (dépôts ET paiements, un appui ouvre l'opération) |
| Journal d'activité | Plus → Journal (lot « Plus ») ; par opération : 09 |
| Raccourcis clavier (⌘⏎, Échap) | Bouton noir collant en bas + feuilles qui se ferment au glissé |

Ajout au modèle validé : un bouton rond « … » à côté de la loupe dans l'en-tête d'Opérations (02), pour ranger filtres, lots, export et justificatifs sans encombrer la liste.
