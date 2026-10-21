# Lot 06 — Messages clients · Douane · Mola · Outils · Agent cash

Rendu : `index.html` → `png/01.png … 18.png` (style v2 validé : blanc, filet #D9D9D9, rayon 8, un seul bouton noir, couleur = statut ou vrai logo).

## Écrans

| # | Écran | Rôle · onglet | Contenu |
|---|---|---|---|
| 01 | Messages clients | admin · Plus (pastille 6 = non-lus) | Filtres Ouvertes / À moi 3 / À prendre 2 / Fermées ; ligne = initiales, nom, dernier message (gras si non lu), assigné (tag neutre) ou « À prendre » (tag jaune), heure + rond noir des non-lus |
| 02 | Conversation | admin, plein écran | En-tête client (code BZ-4821, assigné), fil blanc/encre, bulle image du reçu Orange Money, double coche ; champ avec bouton éclair (réponses types), appareil photo, envoyer (noir) |
| 03 | Réponses types (feuille) | admin | 5 réponses, prénom déjà rempli ; toucher = insérer ; « Gérer les réponses » |
| 04 | Conversation · menu « … » (feuille) | admin | Fiche client · Assigner (Nelson) · Envoyer un fichier · Clore la conversation |
| 05 | Clore · confirmation (feuille) | admin | Client, assignée à ; noir « Clore », blanc « Garder ouverte » |
| 06 | Douane · À signer | customs · À signer (pastille 4) | Gros chiffre 4 classements + 2 déclarations à relire ; ronds Signer (noir) · DAU · Veille · Routes ; file : produit, client, code proposé, attente, tag À vous / À prendre ; lien « Signés » |
| 07 | Revue d'un classement | customs | 3 photos (+2), produit, client, code proposé en grand, droit/TVA ; choix Valider / Changer / Demander ; observation ; noir « Signer le classement » |
| 08 | Signer · confirmation (feuille) | customs | Décision, code final, client prévenu ; ligne rouge « Engage votre agrément CAD » ; noir « Signer » |
| 09 | Signé | customs | Rond vert ; « Suivant · Tissu wax » (noir) ; « Retour à la file » |
| 10 | Simulateur · le montant | customs · Simulateur | Produit + code (Changer), gros montant ¥ 48 000, devise ¥/USD/XAF, conversion, clavier, noir « Calculer » |
| 11 | Simulateur · le résultat | customs | 2 829 702 XAF à payer ; CAF, droit 30 %, TVA 19,25 %, redevance ; « 1 avis sur ce code » → Veille ; noir « Partager », blanc « Comparer avec un autre code » |
| 12 | Mola | admin, plein écran | Mascotte en en-tête ; message de Nelson ; réponse de Mola ; carte d'action « Créditer 500 000 XAF à Fatou Ndiaye » : solde avant/après, dépôt BZ-DP-2610-0388, Annuler / Confirmer (noir) ; champ + pièces jointes |
| 13 | Journal | admin (canViewLogs) | Filtres Tous / Dépôts / Paiements / Clients ; par jour ; ligne = initiales de l'auteur, action, auteur · objet, heure, chevron → ouvre l'objet |
| 14 | Justificatifs | admin | Dépôts / Paiements ; grille 3 colonnes de reçus (vrais logos OM, MTN, Wave, Ecobank, UBA, Afriland), montant, client, date ; toucher → aperçu puis le dépôt ou le paiement |
| 15 | Coordonnées de paiement | admin | Banques / Mobile Money ; titulaire NORTON GAUSS BONZINI SARL ; Ecobank, Afriland, UBA, CCA avec RIB + bouton copier ; noir « Partager en PDF », blanc « Partager en image » |
| 16 | Réglages | tous | Langue FR / EN / 中文 (grandes tuiles) ; Thème Clair / Sombre / Auto ; Mon mot de passe ; Entreprise : Adresses en Chine, Tarifs cargo ; Version |
| 17 | Cash · À remettre | cash · Paiements (pastille 3) | Gros chiffre ¥ 41 360 à remettre ; À remettre / Remis ; ligne = logo cash, bénéficiaire, client, montant, tag QR lu / À remettre |
| 18 | Cash · confirmer la remise | cash | ¥ 23 060, tag vert « QR vérifié » ; nom déclaré, client, référence ; 2 cases (pièce vérifiée, espèces remises) ; signature (Effacer) ; noir « Confirmer la remise » |

## Où est rangée chaque capacité de la version ordinateur

### Messages clients (`/m/support`, console 2 colonnes sur ordinateur)
- Liste, statut Ouvertes/Fermées, assignation Toutes/À moi/Non assignées → puces de l'écran 01 (les deux filtres fusionnés en une rangée).
- Recherche plein texte → loupe de la recherche globale (autre lot) ; rien d'ajouté ici.
- Non-lus → rond noir par ligne + pastille sur l'onglet Plus (écart n° 1 du module corrigé).
- Statistiques (7/14/30 j), Réponses types (gérer), Suggestions aux nouveaux clients → « … » de l'écran 01.
- Ouvrir une conversation, marquer comme lu (auto) → écran 02.
- **Je prends** (non assignée) → à la place du champ de saisie, un bouton noir « Je prends » tant que la ligne est « À prendre ».
- Envoyer texte / image / vocal / vidéo / fichier → champ (appareil photo, maintien du bouton envoyer pour le vocal) + « Envoyer un fichier » dans « … ».
- Répondre à (citation), Réagir → appui long sur une bulle.
- Insérer une réponse type → bouton éclair → feuille 03 ; Créer / Modifier / Monter-Descendre / Supprimer (super admin) → « Gérer les réponses ».
- Fiche client, Assigner à un admin / Personne → feuille 04 ; Clore → feuille 05 (confirmation ajoutée) ; Rouvrir → même ligne quand la conversation est fermée.
- Indicateur de frappe → sous le nom dans l'en-tête (« écrit… »).

### Douane (`/m/douane`, revue, audit, veille, routes, simulateur)
- File « Classements à signer » (À vous / Pris / À prendre) → écran 06 ; « Signés récemment » → lien « Signés ».
- Déclarations à relire (audit DAU) → rond « DAU » : même modèle que la revue (pièces, enjeu XAF, montant récupérable au clavier, avis) → feuille de confirmation avec la même ligne rouge ; « Je prends cet audit », « Relancer la lecture » → bouton noir / « … » de l'audit.
- Veille (avis, publier / corriger / retirer : canManageCustoms) → rond « Veille » ; Routes (mode, ports, poids, partager) → rond « Routes ».
- Revue : Je prends cette fiche → bouton noir tant que la fiche n'est pas prise ; Valider (+ ligne nationale facultative, observation) / Changer (choisir un code, motif obligatoire) / Demander (question obligatoire, bouton « Envoyer la question ») → écran 07 ; Signer → feuille 08 (confirmation ajoutée, ligne rouge « engage votre agrément ») → écran 09 avec « Suivant ».
- Ouvrir une photo → toucher la vignette ; proposition IA (candidats, faits manquants), fil de la fiche, simuler un candidat → « … » de l'écran 07.
- Simulateur : produit, montant, devise → écran 10 ; taux XAF, incoterm, fret, assurance, régime → « … » de l'écran 10 ; Comparer, Partager → écran 11 ; Recommencer → « … » de l'écran 11 ; avis lié → ligne « 1 avis sur ce code ».
- « Trouver le code SH » (doublon du simulateur) → supprimé : c'est « Changer » sur le produit.

### Mola (`/m/assistant`)
- Envoyer un message, jusqu'à 5 pièces jointes (image/PDF) → champ + bouton « + » (écran 12).
- Carte d'action Confirmer / Annuler (avant/après ; bandeau rouge « Action sensible » quand `danger`) → écran 12.
- Nouvelle conversation, historique → « … » de l'écran 12 ; 4 suggestions → affichées dans le fil vide.
- Aperçu / téléchargement d'image générée → toucher l'image (bridge natif).
- Accès : rond mascotte en haut à droite de l'Accueil (lot v2) et ligne dans Plus.

### Outils
- Journal (`admin_audit_logs`) : filtres par type → écran 13 ; recherche → recherche globale ; filtre par date et export → « … » de l'écran 13 ; lien vers l'objet → chevron (ajouté, l'ordinateur n'en avait pas).
- Justificatifs : preuves de dépôts **et** de paiements (ajouté), aperçu + Télécharger → toucher une vignette, puis lien vers le dépôt/paiement (ajouté).
- Coordonnées de paiement : Banques / Mobile Money, copier une ligne → écran 15 ; PDF / Image → dock ; langue du document FR/EN/les deux et portrait/paysage → « … » de l'écran 15.
- Réglages : langue FR/EN/中文 et thème (un seul endroit désormais) → écran 16 ; Mot de passe ; Adresses en Chine, Tarifs cargo (écriture canManageUsers) → section Entreprise ; Version réelle. Connexion rapide / clés d'accès, verrou Face ID, notifications push, profil, déconnexion → Moi / Plus (autre lot).

### Agent cash (`/a/*`)
- Liste À payer / Payés → écran 17 (« À remettre » / « Remis »), statuts lisibles (QR lu / À remettre / Remis).
- Scanner le QR, saisie manuelle de l'ID → onglet Scanner (autre lot).
- Fiche + Procéder (`scan_cash_payment`) + Confirmer (`confirm_cash_payment`) → fusionnés en un écran 18 (QR vérifié, nom déclaré, identité, espèces remises, signature) : trois écrans réduits à un.
- Succès, Télécharger le reçu, Scanner un autre → écran de succès du même modèle que 09 (« Suivant · Wang Lei ¥ 12 500 », « Reçu »).
- Langue, déconnexion → Plus de l'agent (autre lot).
