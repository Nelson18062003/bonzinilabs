# Lot 03 — Clients · Équipe & ventes · App commercial (18 écrans)

Rendu : `node shot.cjs v2/03-clients-ventes/index.html v2/03-clients-ventes/png` (depuis `mobile-refonte/`).

## Les écrans
| # | Écran | Contenu |
|---|---|---|
| 01 | Clients (onglet) | Recherche nom/tél./BZ-, filtres Tous · Avec solde · Découvert 3 · tri, lignes avec initiales, BZ + tél., solde à droite (tag Découvert / Inactif) ; Scanner et + en haut |
| 02 | Fiche client | Gros solde + « Disponible · Découvert », 4 ronds Dépôt (noir) · Paiement · Message · Colis, 4 dernières opérations, « Tout voir » vers le relevé |
| 03 | Fiche client · menu « … » | Feuille : Crédit / Débit, Découvert, Relevé PDF, Bénéficiaires, Étiquette colis, Téléphones, Identité, Mot de passe, Repasser en prospect, Supprimer (rouge) |
| 04 | Crédit / Débit · montant | Client + solde, Créditer / Débiter, gros clavier, « Solde après » en direct |
| 05 | Crédit / Débit · confirmer | Feuille : solde avant / après, motif (vu par le client), bouton noir « Débiter 250 000 XAF » |
| 06 | Relevé | Filtres Tout · Dépôts · Paiements · Autres, lignes par mois avec montant signé et solde après, auteur ; téléchargement PDF en haut |
| 07 | Bénéficiaires | Recherche, filtres par mode, lignes avec les vrais logos, « Ajouter un bénéficiaire » |
| 08 | Colis du client | Gros chiffre « 12 colis » à Guangzhou (kg · m³), son conteneur, ses réceptions avec leur statut, relevé des colis en PDF ; partage en haut |
| 09 | Nouveau client | Prénom/Nom, Femme/Homme, WhatsApp avec indicatif, Pays, Origine ; « + Email, ville, entreprise, naissance » pour le reste |
| 10 | Client créé | Rond vert, mot de passe provisoire + Copier, « Envoyer sur WhatsApp », « Voir la fiche » |
| 11 | Équipe · Membres | Membres / Ventes, filtres Tous · Douala · Chine · Inactifs, lignes rôle · site + dernière connexion, + Nouvel accès |
| 12 | Membre | Appeler · WhatsApp · Mot de passe, rôle, site, fiche commercial, dernière connexion, interrupteur « Accès actif » |
| 13 | Équipe · Ventes | Gros chiffre du mois (paiements apportés), nouveaux clients, % objectif, entrée « À vérifier 4 », une ligne par commercial |
| 14 | À vérifier (1/4) | Ce que le commercial a saisi, le client qui a déjà ce numéro, Attribuer (noir) / Refuser |
| 15 | Commercial · Mon mois | Gros chiffre du mois, barre d'objectif + tag de rythme, Prospect (noir) · Relances · Mes clients, prospects à relancer |
| 16 | Commercial · Prospects | Recherche, Ouverts · Relances 3 · Clients · Perdus, brouillon à reprendre, lignes avec statut |
| 17 | Commercial · Nouveau prospect 2/7 | Barre des 7 étapes, « Pour le joindre » : WhatsApp vérifié (« Numéro libre »), autre numéro, email |
| 18 | Commercial · Fiche prospect | Appeler (noir) · WhatsApp · Compléter, statut À contacter / Contacté / Intéressé, l'essentiel en lignes |

## Où se trouve chaque fonction de la version ordinateur

**Liste des clients** (`DesktopClientsScreen`)
- Recherche nom / tél. / e-mail / entreprise / BZ- : champ de recherche (01).
- Compteurs par statut et filtre **Solde** (avec solde / nul / **en découvert**) : filtres de 01. Le bouton tri (⇅) ouvre une feuille avec le tri (nom, solde, **dépôts**, **paiements**, ancienneté) et les autres statuts (Actifs, Inactifs, Suspendus, KYC, Solde nul).
- Pagination 25 : remplacée par un chargement au fil du défilement (pas tout d'un coup).
- Nouveau client : « + » (01) → 09. Scanner un code client (caméra + saisie BZ-) : icône scanner (01).
- Sources & commerciaux : Équipe › Ventes › « … » (13) → « Sources des clients ». Une seule entrée vers les commerciaux, au lieu de deux.

**Fiche client** (`DesktopClientPanel`)
- Solde, disponible avec découvert, découvert autorisé : en haut de 02.
- Dépôt : rond noir (02). Paiement, message au client, colis : les 3 autres ronds.
- 6 derniers mouvements : liste de 02 ; historique complet : « Tout voir » → 06.
- Crédit / Débit : « … » (03) → 04 → 05. Montré seulement aux rôles qui ont `canAdjustWallets` (super_admin, ops) ; les autres ne le voient pas.
- Découvert (autoriser, modifier, retirer) : « … » › Découvert, feuille avec les montants proposés, un plafond libre, le motif et « Retirer » (`canGrantOverdraft`).
- Relevé PDF (période + langue) : « … » › Relevé PDF, et l'icône de téléchargement de 06.
- Bénéficiaires (liste, recherche, filtre par mode, ajout avec QR) : « … » › Bénéficiaires → 07. On touche une ligne pour ouvrir une feuille Modifier / Archiver (avec confirmation).
- Étiquette colis (bateau/avion, image, PDF, bloc fournisseur) + Copier l'identifiant BZ : « … » › Étiquette colis (une seule carte pour le code, au lieu de deux).
- Numéros secondaires avec libellé : « … » › Téléphones (affiche et modifie tous les numéros).
- Modifier le profil (nom, sexe, naissance, email, entreprise, pays, ville) + Origine + « Enregistré par » + « Client depuis » : « … » › Identité.
- Réinitialiser le mot de passe : « … » › Mot de passe → mot de passe affiché une fois, avec Copier / WhatsApp (même modèle que 10).
- Repasser en prospect (blocages, choix du commercial, motif) : « … » › Repasser en prospect.
- Supprimer (contrôle solde ≠ 0, découvert compris, et paiements en cours) : « … » › Supprimer, en rouge et à part du reste.
- Total dépôts / paiements : dans 06 (ligne en tête des filtres Dépôts / Paiements).
- Colis reçus, 3 derniers dépôts, conteneurs, relevé des colis PDF + partage : rond Colis → 08. Le chiffre « à Guangzhou » compte à part les colis partis en avion (bug du mobile actuel corrigé).

**Nouveau client** (`DesktopCreateClient`)
- Prénom, Nom, Sexe, WhatsApp principal, Pays, Origine : 09. Préremplissage depuis un prospect (`?phone=`) : même écran.
- Naissance, entreprise, email, ville, numéros en plus : « + Email, ville, entreprise, naissance » (09).
- Mot de passe provisoire, Copier, Envoyer sur WhatsApp, Voir la fiche : 10. Les avertissements (numéros, identité ou origine non enregistrés) s'affichent en tag sous le mot de passe s'il y en a.

**Équipe** (`TeamScreen`, `TeamNewMember`, `TeamMemberScreen`)
- Liste par équipe / site, recherche, voir les désactivés, dernière connexion : 11 (filtres + recherche en tirant la liste vers le bas).
- Nouvel accès (rôle, identité, site, création de site, fiche commercial, message d'accès Copier / Partager) : « + » de 11, en étapes du même type que 17 et un succès comme 10.
- Fiche membre : appeler / WhatsApp, rôle, site, fiche commercial, dernière connexion : 12. Désactiver / réactiver : l'interrupteur « Accès actif » (12), avec une feuille de confirmation. Il n'apparaît pas sur sa propre fiche.
- Modifier (nom, numéros, site), Changer de rôle, Relier / changer la fiche commercial, Agrément du commissionnaire : « … » de 12. Nouveau mot de passe : rond Mot de passe (12).
- « Ses chiffres et objectifs » d'un commercial : touche sa ligne dans 13.

**Ventes** (`SalesBoard`, `SalesCommercial`, `ProspectClaims`)
- Période (3/6/12 mois, 12 semaines) : « Octobre ⌄ » dans le chiffre de 13. Les 8 indicateurs : on touche le gros chiffre pour passer de l'un à l'autre (paiements, dépôts, clients, prospects, fret avion, vols, bateau).
- Classement et objectifs du mois : lignes « Par commercial » (13).
- Page d'un commercial (tableau de bord, Fixer / Modifier les objectifs, ses prospects par statut, Confier à…, Créer son compte client, clients apportés + Appeler) : on touche une ligne de 13. Écran construit comme 15, avec « … » pour Objectifs et Son accès.
- À vérifier (attribuer, refuser avec note, confier à un commercial actif, ouvrir la fiche du client reconnu) : 14. Les fiches passent une à une (1/4). Ouvrir la fiche : on touche la ligne du client ; Confier à… : « … ».
- + Commercial, Sources des clients (période, types, nouvelle source, modifier / archiver avec confirmation) : « … » de 13.

**App commercial** (`/v`)
- Mon mois (mois, paiements, objectif + rythme, relances, fiches à vérifier) : 15. Clients, prospects (entonnoir) et fret : plus bas sur le même écran. Mot de passe et déconnexion : rond du compte en haut à droite.
- Prospects (recherche, filtres, brouillon, « À compléter ») : 16. Les autres filtres (À vérifier, À contacter, Contacté, Intéressé, Tous) : on fait glisser les filtres de côté.
- Assistant 7 étapes avec brouillon et contrôle du numéro en direct : 17 (une étape par écran).
- Fiche prospect (appeler / WhatsApp chaque numéro, statut, compléter, modifier une partie) : 18. Marquer perdu (motifs), Rouvrir, Modifier : « … » de 18.
- Mes clients (mois, 4 chiffres, Appeler / WhatsApp) : onglet « Mes clients », lignes comme 01 sans accès aux fiches `/m`.
