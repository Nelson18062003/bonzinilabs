# Lot 05 — Support · Douane · Mola · Outils (21 écrans)

Fichier : `index.html` (charge `../kit.css`, `../kit.js`) · Rendus : `png/01.png` … `png/21.png`.
Barres d'onglets : admin pour les écrans tirés de « Plus » (pastille Plus = non-lus des Messages clients), `customs` pour le commissionnaire, `cash` pour l'agent cash.

| N° | Titre | Ce qu'il montre | Capacités desktop couvertes |
|---|---|---|---|
| 01 | Messages clients | Liste : recherche, segmenté Ouvertes 7 / Toutes / Fermées, puces Toutes · À moi · Non assignées, ligne = client, aperçu, sujet, assigné (ou « Non assignée » en orange), heure, pastille de non-lus ; bouton Statistiques en haut à droite | Liste de la console support, recherche plein texte, filtre statut (serveur), filtre assignation, non-lus, assigné visible, accès aux statistiques |
| 02 | Conversation | Fil plein écran : carte contexte (paiement lié + statut), message, reçu Alipay en image, réponse citée, vocal, indicateur de frappe ; champ avec + (image, vidéo, fichier), éclair (réponses types), micro | Fil (texte, image, vocal, vidéo, fichier, citation), frappe en temps réel, lu automatique |
| 03 | Réponses types (feuille) | Feuille ouverte depuis l'éclair : recherche, réponses avec variables `{prénom}` `{montant}` surlignées, lien « Gérer » | Insertion d'une réponse type ; accès à la gestion des réponses types (super admin) |
| 04 | Menu « … » et assignation | Feuille : sélecteur d'assigné (Nelson coché, Carine, Patrick, Mireille, Personne), Fiche client, Réponses types, Statistiques, Clore la conversation (rouge) | Assigner / désassigner, Voir la fiche client, Clore ; « Je prends » = toucher son propre avatar |
| 05 | Clore la conversation | Feuille de confirmation : Ouverte → Fermée, « Nouveau message du client : Rouvre », Retour / Clore | Clore avec confirmation (absente sur desktop) ; Rouvrir = même menu sur une conversation fermée |
| 06 | Statistiques support | 7 / 14 / 30 j, réponse moyenne et médiane, ouvertes, non assignées, volume par jour Clients / Bonzini (barres empilées), détail par personne, délai de réponse | `get_chat_admin_stats` complet : période, compteurs, volume quotidien, top et détail par admin, distribution des temps |
| 07 | Douane · À signer | Accueil du commissionnaire (onglets À signer · Simulateur · Plus, pastille 4) : Classements (À vous / À prendre / Pris), Déclarations à relire (enjeu XAF), Outils Veille et Routes, Signés récemment | File `customs_review_queue` (classements, audits DAU, 8 signés), accès Veille et Routes ; le même écran s'ouvre depuis « Plus › Douane » pour ops / support / success |
| 08 | Revue d'un classement | Photos, produit, client, statut ; segmenté Proposition / Dossier / Fil ; candidats IA avec confiance ; panneau de décision fixé en bas : Valider / Changer / Demander, ligne nationale, observation, « Signer le classement » | `customs_classification_get` + décision (`_decide` approved / changed / needs_info) toujours atteignable sans défiler ; photos ; fil ; « Je prends » via « … » si non pris |
| 09 | Signer le classement | Feuille danger : bandeau rouge « Engage votre agrément CAD n° … », proposé → signé, client prévenu, case « Photos et étiquette vérifiées », bouton rouge Signer | Confirmation `confirm + danger` (absente aujourd'hui sur desktop et mobile) |
| 10 | Simulateur de droits | Onglet Simulateur : produit + code SH (+ pastille « 1 avis » vers la Veille), valeur ¥ / $ / XAF, incoterm, fret et assurance, régime, résultat (CAF, droit, TVA, prélèvements), Comparer · Partager ; « … » = Recommencer | Simulateur complet : nomenclature, devise, incoterm, fret, assurance, régime, comparer un 2ᵉ code, partager, recommencer, avis liés |
| 11 | Mola | Conversation : reçu MoMo joint, demande, réponse de Mola, carte d'action « Créditer 500 000 XAF à Awa Ngono Mballa » (dépôt, solde avant → après, notifier) avec Annuler / Confirmer ; icône Nouvelle conversation | Envoi avec pièces jointes (+), carte de confirmation, Confirmer / Annuler, Nouvelle conversation |
| 12 | Journal | Recherche, filtres Date (14 – 21 oct.) · Personne (Nelson) · Type (Paiements), groupé par jour ; chaque ligne = action lisible + référence violette + chevron vers l'objet | `admin_audit_logs` + ce qui manque partout : filtre par date et par personne, lien vers l'objet, libellés humains ; garde `canViewLogs` (entrée cachée sinon) |
| 13 | Justificatifs | Segmenté Tous / Dépôts / Paiements, vignettes de reçus étiquetées Dépôt / Paiement, client, montant, référence cliquable, groupé par jour | Preuves de dépôts **et** de paiements (absentes des deux côtés aujourd'hui), recherche, lien vers le dépôt ou le paiement ; aperçu et Télécharger dans la fiche ouverte |
| 14 | Notifications | Ouvert par la cloche de l'Accueil : puces Tout / Dépôts / Paiements / Cargo / Messages, non-lus (point violet), « Tout lu », groupé par jour, chaque ligne mène à l'objet | Centre de notifications + cloche du desktop ; état lu / non-lu ajouté |
| 15 | Coordonnées de paiement | Banques / Mobile Money ; par compte : titulaire, n° de compte et SWIFT copiables, agence, bouton Partager | `PaymentDetailsHub` : onglets, lignes copiables |
| 16 | Partager les coordonnées | Feuille : aperçu du document, Format PDF / Image, Orientation Portrait / Paysage, Langue FR / EN / FR+EN, Copier (image) · Partager le PDF | PDF / Image, orientation, langue retenue, partage natif, copier l'image |
| 17 | Réglages | Langue Français / English / 中文, Thème Clair / Sombre / Auto, Mot de passe, Réponses types, Suggestions aux clients, Adresses en Chine, Tarifs cargo, Version | Langue (absente du desktop), thème (une seule place), mot de passe, accès aux réponses types et suggestions (super admin), réglages d'expédition (`canManageUsers`), version réelle |
| 18 | Lots de paiements | Liste ouverte depuis Opérations : recherche, puces En cours / Terminés / Tous, avancement « 3 / 5 payés », bouton + (nouveau lot) | **Nouveau** : liste des lots (`usePaymentBatches`, jamais affiché aujourd'hui) ; création d'un lot |
| 19 | Fiche d'un lot | Total ¥ et XAF débités, avancement, client, lignes vers chaque paiement (statut), note ; dock Partager · « Payer le suivant · ¥8 200 » | `BulkPaymentDetail` (référence, client, totaux, note, lignes cliquables) + file « suivant » |
| 20 | Agent cash · Paiements | Onglets Paiements · Scanner · Plus ; bandeau « Remis · ¥12 500 » + Reçu après une remise ; À remettre 4 / Remis 14 ; ligne = bénéficiaire, pour quel client, montant, QR scanné / À remettre | `/a` : listes À payer / Payés, reçu cash, retour liste après succès |
| 21 | Confirmer la remise | QR vérifié (réf., heure de scan), montant, bénéficiaire et téléphone, client, tiers ; case « remis, pièce vérifiée », signature avec Effacer ; « Confirmer la remise · ¥15 000 » | `/a/payment/:id` + `/confirm` en un écran (`scan_cash_payment` fait au scan, `confirm_cash_payment` + signature) |

## Capacités du module placées où

### Support (Messages clients)
| Capacité desktop | Place mobile |
|---|---|
| Liste + conversation côte à côte | 01 → 02 (aller-retour), non-lus dans la pastille de l'onglet Plus et sur la ligne |
| Recherche plein texte, statut, assignation | 01 |
| Statistiques (période 7/14/30) | 01 (icône) · 04 (menu) → 06 |
| Je prends · Assigner · Désassigner | 04 (sélecteur d'assigné) |
| Voir la fiche client | 04 |
| Clore / Rouvrir | 04 → 05 (confirmation) ; Rouvrir : même menu sur une conversation fermée |
| Envoyer texte, image, vocal, vidéo, fichier ; citer ; réagir | 02 (champ, +, micro ; citer et réagir = appui long sur une bulle) |
| Insérer une réponse type | 02 (éclair) → 03 |
| Gérer les réponses types (créer, modifier, ordre, supprimer avec feuille) | 03 « Gérer » · 17 Réglages › Réponses types (super admin) |
| Suggestions aux nouveaux clients (CRUD, actif, ordre) | 17 Réglages › Suggestions aux clients |

### Douane
| Capacité desktop | Place mobile |
|---|---|
| File : classements, déclarations à relire, signés récemment | 07 (CAD : onglet À signer ; autres rôles : Plus › Douane) |
| Revue d'un classement, décision collante | 08 (panneau de décision fixé) |
| Je prends cette fiche | 08 (« … », ou automatique au premier choix de décision) |
| Valider / Changer (code + motif) / Demander (question) | 08 (segmenté du panneau) |
| Signer | 08 → 09 (confirmation danger) |
| Ouvrir une photo, simuler un candidat | 08 (photos ; « … » › Simuler ce code → 10) |
| Audit DAU : relancer la lecture, prendre, montant récupérable + avis, rendre l'avis, pièces | même mise en page que 08 depuis la ligne « Déclarations à relire » de 07 (panneau : montant récupérable + avis + « Rendre l'avis », confirmation comme 09) ; non dessiné |
| Veille : publier, corriger, retirer, conteneurs touchés | 07 › Outils › Veille ; non dessiné |
| Routes (mode, ports, poids, partager) | 07 › Outils › Routes ; non dessiné |
| Simulateur (comparer, partager, recommencer, avis liés) | Onglet Simulateur → 10 |

### Mola
| Capacité desktop | Place mobile |
|---|---|
| Envoyer un message + 5 pièces jointes | 11 (+) |
| Suggestions de départ | 11, conversation vide (non dessiné) |
| Carte de confirmation, Confirmer / Annuler | 11 |
| Nouvelle conversation | 11 (icône en haut à droite) |
| Aperçu / téléchargement d'image générée | 11, toucher l'image (visionneuse plein écran, non dessinée) |

### Outils et Plus
| Capacité desktop | Place mobile |
|---|---|
| Journal (recherche, type) + date, personne, lien vers l'objet | 12 |
| Justificatifs (dépôts) + paiements, lien vers l'objet | 13 |
| Cloche + centre de notifications | 14 (depuis la cloche de l'Accueil) |
| Coordonnées : onglets, copier, PDF / Image, orientation, langue | 15, 16 |
| Langue FR / EN / ZH, thème | 17 |
| Mot de passe | 17 |
| Adresses en Chine, Tarifs cargo | 17 › Expédition |
| Lots : liste (nouveau), fiche, création | 18, 19 (création : + de 18 et feuille + d'Opérations) |

### Agent cash
| Capacité | Place mobile |
|---|---|
| Listes À payer / Payés | 20 (À remettre / Remis) |
| Scanner, saisie manuelle de l'ID | onglet Scanner (non dessiné, scanner commun) |
| Procéder (scan) + Confirmer (case + signature) | 21 (un seul écran après le scan) |
| Reçu cash, Retour à la liste, Scanner un autre | 20 (bandeau « Remis » + Reçu) |
| Langue, déconnexion | Plus › Réglages, Plus › Moi |

## Non placé dans ce lot (autres lots ou non dessiné)
- Profil, photo, Face ID, réglages push, mises à jour, déconnexion → « Moi » (autre lot).
- Clés d'accès (masquées dans l'app native) : non placées ; site web seulement.
- Veille macro (prédictions, Brent, DXY…) : tuile « Veille » de la grille « Plus », non dessinée ici.
- Écrans non dessinés mais placés : audit DAU, Veille douane (éditeur d'avis), Routes, éditeurs Réponses types / Suggestions, scanner de l'agent cash.
