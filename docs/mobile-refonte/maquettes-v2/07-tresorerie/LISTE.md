# Lot 07 · Trésorerie complète (v2)

Rendu : `index.html` → `png/01.png … 34.png`. Kit v2 inchangé (kit2.css / kit2.js). Les styles du lot sont dans le `<style>` de la page, avec les mêmes jetons ; ceux du lot 05 sont repris tels quels.
Ce lot approfondit le lot 05 et garde ses données : Kevin Fotso, Afriland 18 420 000, stock 30 350,50 USDT, TR-AC-2610-0087. Les écrans 01 à 17 du lot 05 restent valables. L'achat passe de 3 à 4 étapes : 1/4 fournisseur, 2/4 comptes payeurs, 3/4 montants (03 du lot 05), 4/4 confirmer (04 du lot 05).
Graphiques : encre `#2C2C2C` et gris `#B3B3B3` / `#EDEDED`, sans couleur de marque. Un graphique par écran, avec un gros chiffre au-dessus, des axes discrets et des valeurs en 14 px au moins.
Personnes : Martine (trésorière) et Nelson (super admin). Fournisseurs USDT : Kevin Fotso F-003, Serge Ekotto F-005, Hamadou OTC F-001, Chantal Mvondo F-008, Blaise Ndjock F-011. Acheteur CNY : Wang Jun Yiwu A-002. Tous les noms sont inventés.

## Écrans

| # | Écran | Ce qu'il montre |
|---|---|---|
| 01 | Accueil trésorier | Barre `treasurer` (Accueil · Trésorerie · Plus), Mola et cloche. Stock USDT 30 350,50, coût moyen 600,42 XAF/USDT, achetés / vendus aujourd'hui. Ronds : Acheter (noir), Vendre, Inventaire, Comptes. À faire : inventaire WeChat, écart Alipay non expliqué |
| 02 | Accueil · stock négatif | Tag rouge « Négatif » sur −1 649,50 USDT, ligne « Vente sans stock » → l'opération, et « Achat manquant » en tête des tâches |
| 03 | Opérations · Achats | Segment Toutes 38 / Achats 24 / Ventes 12 / Annulées 2, recherche (nom, compte, référence, montant), période, Filtres. Totaux : achetés, payés, taux moyen. Liste groupée par jour (contrepartie, compte, heure, ±USDT, contre-valeur) |
| 04 | Opérations · filtres | Feuille : fournisseur, canal, compte CNY, tri, période 7 j / 30 j / 90 j / Tout / Perso avec dates. Effacer · « Voir 9 achats » |
| 05 | Achat 1/4 · fournisseur | Recherche, récents, fournisseurs avec leur dernier taux, « + Nouveau fournisseur » |
| 06 | Nouveau fournisseur | Feuille : nom, téléphone (facultatif, +237), « Créer et choisir » |
| 07 | Achat 2/4 · payé depuis | Plusieurs comptes avec leur solde et leur part (Afriland 3 000 000, Ecobank 1 804 000), « Ajouter un compte », total payé |
| 08 | Achat 3/4 · USDT reçus | Clavier. « 2 comptes · 4 804 000 XAF », 8 000 USDT, taux calculé et formule (4 804 000 ÷ 8 000), « Dernier chez Serge · Reprendre » |
| 09 | Achat 4/4 · confirmer | Feuille : taux, chaque compte avant → après, stock avant → après, date et référence (« Ajouter ») |
| 10 | Vente · montants | Clavier. USDT vendus, ¥ reçus, taux CNY/USDT, stock avant → après, compte d'encaissement (Alipay Bonzini, solde) |
| 11 | Vente · alerte de stock | 32 000 USDT : tag rouge « Stock dépassé », « il manque 1 649,50 » |
| 12 | Vente · confirmer | Feuille : taux, coût moyen, coût de sortie en XAF, stock avant → après, compte CNY avant → après |
| 13 | Vente enregistrée · reçu | Le reçu (USDT, acheteur, ¥, taux, encaissé sur, date, référence), comptes touchés avec le solde après, Copier l'image (noir) · Télécharger, « Nouvelle vente » en haut |
| 14 | Annuler une opération | Feuille réservée au super admin : soldes avant → après (la contre-passation), motif de 10 caractères au moins avec compteur, bouton rouge « Annuler l'opération » |
| 15 | Opération annulée | Bandeau rouge (date, qui, motif), montant barré, tag Annulée, écritures de contre-passation qui mènent aux comptes |
| 16 | Compte · Caisse Douala | Solde, mouvements avec solde après (lien Grand livre), carte Inventaires du compte (Juste / −12 500) |
| 17 | Compte · menu « … » | Ajuster le solde · Faire l'inventaire (attendu) · Grand livre du compte · Inventaires du compte |
| 18 | Ajuster · montant | Compte, Créditer / Débiter, clavier, « Après : 1 525 000 XAF » |
| 19 | Ajuster · confirmer | Feuille : solde avant → après, motif (10 caractères au moins), « Enregistrer l'ajustement » |
| 20 | Ajustement enregistré | Rond vert, montant, nouveau solde. Voir le compte · Retour à la trésorerie |
| 21 | Inventaire · compter | Compte (caisse, Alipay, WeChat), montant compté au clavier, attendu, écart en tag |
| 22 | Inventaire enregistré | Attendu, compté, écart, motif. « Suivant · Caisse Douala » (file des comptes à compter) · Terminer |
| 23 | Inventaires passés | Période, filtre de compte, 14 inventaires dont 3 avec écart, liste par jour (Juste / écart, « non expliqué »), « Faire un inventaire » |
| 24 | Grand livre | XAF / USDT / CNY, compte, période. Écritures, entrées, sorties. Lignes : nature, compte, origine, montant, solde après |
| 25 | Fournisseurs et acheteurs | Segment Fournisseurs USDT / Acheteurs CNY, recherche (nom, F-003, téléphone), période, Archivés (2), tri par volume : USDT et taux moyen, « + » |
| 26 | Acheteur CNY · fiche | A-002, téléphone, WeChat, période. 4 chiffres (opérations, USDT vendus, CNY reçus, taux moyen) et ses opérations |
| 27 | Modifier l'acheteur | Nom, raison sociale, téléphone (+86), WeChat, note, Enregistrer |
| 28 | Visuel des soldes · saisir | Les 6 comptes fixes (MTN, Orange, UBA, Afriland, Ecobank, CCA), un champ par compte, total, « Voir l'image » |
| 29 | Visuel des soldes · image | L'image (MY ACCOUNT BALANCES, date, 6 cartes, TOTAL BALANCE), Clair / Sombre, Partager l'image (noir) · PDF |
| 30 | Analyse · bénéfice | +4 070 360 XAF, marge +7,94 XAF par ¥. Barres du bénéfice par semaine (la semaine en cours en gris). Taux client, taux de revient, CNY livrés |
| 31 | Analyse · stock USDT | 30 350,50 USDT (+16 150 sur 30 j), courbe du stock en fin de journée, point le plus bas marqué, capital immobilisé |
| 32 | Analyse · coût moyen | 600,42 XAF/USDT. Courbe du coût moyen (encre) et du taux d'achat du jour (gris), légende, taux moyens d'achat et de vente |
| 33 | Analyse · volumes | 98 400 USDT achetés, 72 000 vendus. Barres groupées par semaine (achats encre, ventes gris), légende, totaux XAF / ¥ |
| 34 | Analyse · par fournisseur | Part du premier (63 %). Segment Fournisseurs / Acheteurs. Barres horizontales par volume, taux moyen, écart en tag (vert = moins cher, rouge = plus cher) ; chaque ligne ouvre la fiche |

Dans 30 à 34, les 5 graphiques se suivent par balayage (points en bas). Le « … » d'Analyse trésorerie reprend la Période et l'export. Le motif d'un inventaire avec écart (étape 2/2 après 21) se saisit dans une feuille sur le modèle de 19.

## Capacité desktop → écran

| Capacité (desktop) | Écran mobile |
|---|---|
| Vue d'ensemble : comptes XAF, stock USDT (`get_usdt_stock`) + coût moyen (`get_wac_usdt`), comptes CNY | 01 (stock + coût moyen) ; total et devises : lot 05 › 01 |
| Alerte stock USDT négatif | 02, et 11 au moment de la vente |
| Dernières opérations + Tout voir | lot 05 › 01 → 03 |
| Menu ⋯ de la coquille (Ajuster, Inventaire, Nouveau fournisseur, Nouvel acheteur) | lot 05 › 02 ; « + » de 25 |
| Période partagée (mois en cours par défaut) | Pastille « Octobre 2026 » de 03, 23, 24, 25, 26, 30 à 34 |
| Opérations : filtre avec compteurs Toutes / Achats / Ventes / Annulées | 03 |
| Recherche (nom, compte, référence, note, montant) | 03 |
| Bandeau de totaux (achetés / payés / taux moyen ; annulées hors totaux) | 03 |
| Filtres fournisseur, canal, compte CNY, tri, période perso (mobile) | 04 |
| Pagination | Défilement continu de 03 |
| Fiche opération + reçu (copier l'image, télécharger) | lot 05 › 06 ; 13 pour une vente |
| Écritures de l'opération, liens vers la contrepartie et les comptes | lot 05 › 06 et 07 ; 13 et 15 |
| Annuler (void) avec motif ≥ 10, super admin | lot 05 › 07 › 14 |
| Opération annulée : barrée, motif affiché | 15 ; pastille « Annulées » de 03 |
| Achat : fournisseur + « Nouveau » rapide (nom + téléphone, « Créer et choisir ») | 05, 06 |
| Achat : un ou plusieurs comptes payeurs, « Ajouter un compte », compte qui passerait en négatif | 07 (le solde de chaque compte est affiché ; un compte qui passe sous zéro prend un tag rouge sur sa ligne, comme en 11) |
| 3 montants liés + formule affichée | 08 (toucher le taux le rend saisissable ; lot 05 › 03 en mode 1 compte) |
| Dernier taux du fournisseur · Reprendre, alerte > 8 % | 08 ; tag « Inhabituel » : lot 05 › 03 |
| Date, référence, note | 09 (« Ajouter ») ; note après coup : lot 05 › 07 |
| Garde « modifications non enregistrées » | Le retour depuis 07 à 10 ouvre une feuille « Abandonner la saisie ? » (sur le modèle de 19) |
| Après l'enregistrement : reçu, « Nouvel achat » / « Nouvelle vente », Fermer | lot 05 › 05 (achat), 13 (vente) |
| Vente : USDT, taux CNY/USDT, CNY liés ; encaissé sur (facultatif) | 10 |
| Vente : alerte de dépassement du stock | 11 |
| Vente : coût moyen, coût de sortie, stock après (mobile) | 12 |
| Comptes : 3 groupes avec totaux, négatif en rouge | lot 05 › 08 |
| Fiche compte : solde, nombre de mouvements, mouvements avec origine et solde après | 16 (Afriland : lot 05 › 09) |
| Carte Inventaires du compte (Juste ou écart, compté / attendu) | 16 |
| Ajuster le solde (sens, montant, avant → après, motif, « deviendra négatif ») | 17 › 18 → 19 → 20 (tag rouge sur la ligne « Solde » si l'après est négatif) |
| Faire un inventaire (caisse, Alipay, WeChat ; motif si écart) | 17 › 21 → 22 ; rond « Inventaire » de 01 |
| Historique des inventaires (tous comptes, totaux, « Non expliqué ») | 23 |
| Grand livre (devise, compte, écritures, entrées, sorties, origine cliquable) | 24 (chaque ligne ouvre son opération) |
| Contreparties : segment, période, recherche, archivés, tri par volume, colonnes Opérations / USDT / taux moyen | 25 |
| Créer un fournisseur ou un acheteur | « + » de 25, ou 06 |
| Fiche contrepartie : identité, 4 chiffres, opérations | 26 (acheteur) ; fournisseur : lot 05 › 10 |
| Modifier (nom, raison sociale, téléphone, WeChat, note) | 27 |
| Archiver / Réactiver, Supprimer (sans opération seulement) | « … » de 26 (même menu que lot 05 › 10, avec une feuille de confirmation) |
| Visuel des soldes : saisie manuelle des 6 comptes | 28 |
| Visuel des soldes : aperçu, PNG, PDF | 29 (partage natif de l'image) |
| Analyse : bénéfice, marge par CNY, taux de revient, taux client | 30 |
| Analyse : volumes achats / ventes (nombre, USDT, XAF / CNY, taux moyen) | 33 |
| Évolution des taux : coût moyen, taux d'achat, taux de vente | 32 (coût moyen et taux d'achat) ; le taux de vente se met à la place de la courbe grise |
| Capital immobilisé | 31 |
| Meilleurs fournisseurs / acheteurs : taux moyen, écart en % coloré, cliquables | 34 |
| Histogrammes de distribution des taux (mobile seul) | Pas dessinés : remplacés par la courbe du taux d'achat du jour de 32 |
| Préréglages de période Jour / Semaine / Trimestre / Année / Tout (mobile) | Pastille de période (feuille sur le modèle de 04) |
| Liens rapides Achat / Vente / Historique (mobile) | Ronds de 01 et du lot 05 › 01 |
