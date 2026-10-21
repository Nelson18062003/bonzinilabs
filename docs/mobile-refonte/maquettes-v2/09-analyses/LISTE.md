# Lot 09 · Analyses et graphiques (v2) — 27 écrans

Rendu : `node shot.cjs v2/09-analyses/index.html v2/09-analyses/png` (depuis `mobile-refonte/`) → `png/01.png … 27.png`.
Kit v2 inchangé (kit2.css / kit2.js) ; styles du lot dans le `<style>` de la page, mêmes jetons.
Ce lot **remplace et approfondit** les écrans 16 et 17 du lot 05 (qui restent tels quels).

Règles graphiques appliquées : un graphique par écran, gros chiffre au-dessus ; série en encre `#2C2C2C`,
comparaison en gris `#B3B3B3`, grille `#EEEEEE` (un seul repère chiffré, en haut à gauche, jamais sous une barre) ;
étiquettes 14 px `#5A5A5A` ; période en cours = barre **en contour** (jamais une fausse baisse) ; un point touché =
bulle encre, les autres barres s'effacent en `#D9D9D9`. Ni dégradé, ni ombre, ni violet/ambre/orange.
Couleur seulement pour les tags de statut (hausse verte, baisse rouge) et les vrais logos / drapeaux.

Données inventées et cohérentes d'un écran à l'autre (calculées dans la page) : 30 derniers jours du 22 sept.
au 21 oct. 2026 ; paiements 412 680 000 XAF (348, +12 %), dépôts 389 450 000 XAF (296), flux net −23 230 000 ;
paiement médian ¥ 7 493, dépôt médian 1 000 000 XAF ; 1 248 clients dont 46 nouveaux ; 296 dépôts validés et
348 paiements répartis dans l'équipe ; 1 000 000 XAF = ¥ 10 838.

## Écrans

| # | Écran | Ce qu'il montre |
|---|---|---|
| 01 | Analyses · Activité | Segment Activité / Trésorerie, période « 30 derniers jours ⌄ » + « Comparer » (actif). Gros chiffre : paiements exécutés 412 680 000 XAF, tag +12 %. Barres par jour (aujourd'hui en contour). 3 petits chiffres : dépôts validés, flux net, clients actifs. Alerte cliquable « 3 dépôts en revue depuis 48 h » |
| 02 | Analyses · tous les graphiques | Plus bas sur le même écran : 12 tuiles (nom, chiffre, mini-graphe), rangées Argent / Clients et équipe. Chaque tuile ouvre son écran (03 à 20) |
| 03 | Paiements · toucher une barre | Barres par jour ; mer. 14 oct. touché → bulle « 20 980 000 XAF · 18 paiements », les autres barres s'effacent. Paiements, ticket moyen, meilleur jour |
| 04 | Détail d'une barre | Les paiements du jour touché : total, nombre, montant en ¥, filtres par méthode, lignes logo + client + fournisseur + heure + ¥ + tag Payé. Loupe en haut |
| 05 | Comparer · période vs précédente | Pastilles Paiements / Dépôts / Clients. Gros chiffre +12 %, « 412 680 000 contre 368 460 000 ». Courbe cumulée encre (22 sept. → 21 oct.) contre gris (23 août → 21 sept.), légende, point touché au jour 18 avec les deux valeurs. Nombre et ticket moyen « actuel / précédent » |
| 06 | Dépôts validés | Total, +10 %. Pas Jour / Semaine / Mois. Barres par semaine (semaine en cours en contour). Nombre, dépôt moyen, dépôt médian 1 000 000 XAF |
| 07 | Flux net | Dépôts − paiements = −23 230 000 XAF. Barres par semaine de part et d'autre de zéro (« Plus d'entrées » / « Plus de sorties »), puis le tableau des 5 semaines avec signe |
| 08 | Paiements par méthode | Segment Paiements / Dépôts. Alipay, WeChat Pay, Virement, Cash : logo réel, nombre, montant, part, barre encre proportionnelle |
| 09 | Dépôts par méthode | Orange Money (transfert / retrait), Virement bancaire, MTN MoMo (transfert / retrait), Cash en banque, Cash agence Bonzini, Wave |
| 10 | Panier moyen | ¥ 12 852 (1 185 862 XAF), tag de variation ; paiement médian ¥ 7 493 · 691 364 XAF ; répartition des 348 paiements par tranche de montant, la tranche médiane marquée |
| 11 | Argent des clients | Soldes des portefeuilles maintenant 186 420 000 XAF, 812 clients ; barre de concentration « 10 plus gros 38 % / 802 autres 62 % » ; solde moyen, ratio dépôts / paiements, taux de validation ; plus gros soldes |
| 12 | Parc de clients | 1 248 clients, +18 % (46 nouveaux contre 39) ; courbe du total sur la période (axe qui ne part pas de zéro) ; meilleur jour, période précédente |
| 13 | Clients actifs · conversion | 214 clients avec au moins un paiement (+8 %) ; dépôt → paiement 87 % ; entonnoir Clients au total 1 248 → Ont déposé 246 → Ont payé 214 |
| 14 | Top clients | Les 10 premiers = 197 530 000 XAF (48 % des paiements) ; rang, initiales, nombre de paiements, volume, barre ; chaque ligne ouvre le client |
| 15 | Pays | 1 248 clients ; Cameroun, Gabon, Tchad, Congo, Guinée équatoriale (drapeaux ronds), Autres pays, Non renseigné ; nombre, part, barre |
| 16 | Sources d'inscription | 46 nouveaux ; barre 28 créés par l'équipe / 18 par l'app ; canaux de l'app (Facebook · publicité · campagne, WhatsApp, Google, TikTok) ; lien « Par commercial › Équipe › Ventes » (lot 03) |
| 17 | Délais de traitement | Segment Dépôts / Paiements. Médiane de validation 38 min (« 8 min de moins »), 9 sur 10 en moins de 3 h 20, rejetés · en attente ; répartition par tranche de durée |
| 18 | Équipe · qui a traité quoi | 750 actions ; une ligne par personne : dépôts validés · paiements traités, total, barre (Nelson, Clarisse Mbala, Hervé Nana, Linda Wu, Grâce Atangana, Patrick Essomba) |
| 19 | Croissance · 12 semaines | Segment 12 semaines / 12 mois, pastilles Paiements / Dépôts / Clients. Semaine dernière S42 105 230 000 XAF, +9 % vs S41 (tag posé sur la barre). S43 en contour. Moyenne, meilleure semaine |
| 20 | Croissance · 12 mois | Clients par mois, nov. → oct. (oct. en cours) : septembre 49, −6 % vs août ; moyenne, meilleur mois |
| 21 | Analyses · Trésorerie | Bénéfice de la période 2 617 300 XAF, marge 1,92 XAF par ¥ ; courbe Coût du stock (WAC) avec pastilles Achat / Vente ; taux de revient, taux client, USDT achetés · vendus ; lien Meilleurs fournisseurs et acheteurs |
| 22 | Graphique · menu « … » | Feuille : Période · Comparer (interrupteur) · Pas · Voir les 348 paiements · Voir en tableau · Exporter (CSV, PDF ou image) · Épingler à l'accueil |
| 23 | Choisir la période | Feuille : Aujourd'hui, Hier, 7 derniers jours, Cette semaine · 30 derniers jours (choisi), Ce mois, Mois dernier, 90 jours, Cette année, Tout · Personnalisé › · Comparer à la période précédente · pas Jour / Semaine / Mois · « Appliquer » |
| 24 | Période personnalisée | Du lun. 5 oct. → Au dim. 18 oct., calendrier d'octobre 2026 (plage grisée, bornes en encre, aujourd'hui souligné, jours futurs éteints), raccourcis, « Appliquer · 14 jours » |
| 25 | Exporter | Feuille : CSV (tableur) / PDF (rapport) / Image (PNG) ; Ce graphique / Toutes les analyses ; lignes et nom du fichier ; « Exporter en CSV » |
| 26 | Partager l'image | Aperçu de l'image (Bonzini Labs, date, titre, chiffre, barres, variation), Clair / Sombre ; « Partager l'image » (noir), Copier, Enregistrer |
| 27 | Accueil · mini-graphe | L'accueil v2 (écran 1) avec, sous les ronds, la carte « Paiements · 7 jours 94 940 000 XAF » et ses 7 barres (aujourd'hui en contour), lien « Analyses » ; « À payer » dessous |

Comportements communs (sans dessin à part) : tirer vers le bas = rafraîchir ; chaque écran 03 à 21 a le même « … »
(22) ; toucher une ligne de 08 / 09 / 15 ouvre la liste des opérations filtrée sur ce segment (modèle 04) ; toucher
un point de toute courbe ou barre donne la bulle (modèles 03 et 05) ; quand « Comparer » est coupé, le tag de
variation et la courbe grise disparaissent.

## Capacité ou graphique de la version ordinateur → écran mobile

Source : `DesktopAnalyticsDashboard.tsx`, `VolumeGrowthBlock`, `ClientGrowthBlock`, `GrowthMatrixSection`,
`dashboardBlocks.tsx`, `useAnalytics.ts`, `DateRangePicker`, `TreasuryAnalysisView.tsx`, `DesktopDashboard.tsx`,
et les ajouts propres au mobile actuel (`MobileAnalyticsDashboard.tsx`).

| Desktop (ou mobile actuel) | Écran |
|---|---|
| Sélecteur de période : préréglages Jour / Semaine / Mois / Période longue / Historique, Personnalisé | 23, 24 ; chip de période en tête de 01, 03, 05–21 |
| Granularité (heure, jour, semaine, mois…) | 23 (pas) et 06 (Jour / Semaine / Mois) ; 22 › Pas |
| Comparer à la période précédente (deltas des StatCards) | Chip « Comparer » + tags de variation ; 05 pour la courbe ; 22 et 23 (interrupteur) |
| Alertes `useDashboardAlerts` (preuves > 24 h, revue > 48 h, paiements > 24 h) | 01 (ligne d'alerte, cliquable comme sur le mobile actuel) |
| StatCard Paiements exécutés (+ nombre) | 01, 03 |
| StatCard Dépôts validés (+ nombre) | 01, 06 |
| StatCard Flux net | 01, 07 |
| StatCard Exposition portefeuilles (clients avec solde) | 11 |
| StatCard Nouveaux clients (total au bout) | 12 |
| StatCard Clients actifs | 01, 13 |
| StatCard Conversion dépôt → paiement | 13 |
| StatCard Délai de validation (médiane, P90, nombre) | 17 |
| Graphique « Flux financier » (dépôts contre paiements par seau) | 07 (le solde par semaine + tableau) ; les deux séries séparées en 03 et 06 |
| `VolumeGrowthBlock` paiements : barres, cumul, total, nombre, ticket moyen, pic, vs précédente | 03 (barres, total, nombre, ticket moyen, meilleur jour, tag) ; cumul en 05 |
| `VolumeGrowthBlock` dépôts | 06 ; cumul en 05 › Dépôts |
| Dépôts par méthode (méthode, nombre, montant, part) | 09 |
| Paiements par méthode | 08 |
| `ClientGrowthBlock` parc de clients (nouveaux, total, pic, période précédente) | 12 |
| Sources d'inscription (équipe / application) + canaux UTM (source, medium, campagne) | 16 |
| Répartition par pays (top 5 + Autres + Non renseigné, part sans pays) | 15 |
| `GrowthMatrixSection` : clients, dépôts, paiements, 12 semaines ou 12 mois, pas propre à chaque bloc, période en cours claire, dernière période complète, variation, moyenne, meilleure | 19, 20 (pastilles Paiements / Dépôts / Clients + segment 12 semaines / 12 mois) |
| Top clients (client, opérations, volume, 10 premiers) | 14 |
| Productivité des administrateurs (actions ; le hook donne aussi dépôts validés / rejetés / paiements) | 18 |
| Mobile actuel : ticket moyen | 03, 10 |
| Mobile actuel : solde moyen, concentration top 10, ratio dépôts / paiements, taux de validation | 11 |
| Mobile actuel : dépôts rejetés, dépôts en attente | 17 |
| Mobile actuel : exports CSV (flux, volumes, pays, top clients) | 22 › Exporter → 25 (CSV, plus PDF et image) |
| Mobile actuel : rafraîchir | Tirer vers le bas |
| Analyse trésorerie : bénéfice, marge par CNY, taux de revient, taux client | 21 |
| Analyse trésorerie : achats / ventes d'USDT (volumes, taux moyens) | 21 (USDT achetés · vendus) |
| Analyse trésorerie : évolution des taux (WAC / achat / vente) | 21 (pastilles Coût du stock / Achat / Vente) |
| Analyse trésorerie : meilleurs fournisseurs USDT, meilleurs acheteurs CNY | 21 › lien (liste au modèle de 14, ligne → fiche contrepartie, lot 05 écran 10) |
| Accueil desktop : Volume 7 jours, lien Analytics | 27 (mini-graphe sur 7 jours + lien Analyses) |
| Accueil desktop : solde plateforme, dépôts / paiements du jour, à traiter | Accueil v2 (écran 1) et 27 |
| Graphiques retirés sur desktop (statut des dépôts dans le temps, qualité des dépôts, évolution des taux dans Analyses) | Retirés aussi sur mobile, à la demande du propriétaire |
| Tableau de bord des ventes (commerciaux, objectifs, entonnoir prospects, fret avion / bateau) | Lot 03 (Équipe › Ventes) ; accès depuis 16 › Par commercial |

## Ce qui n'est pas couvert ou qui est nouveau

- **Délais des paiements** (segment Paiements de 17) : aucun hook ni graphique sur la version ordinateur
  (`useDepositProcessingTime` ne mesure que les dépôts). Il faut créer la mesure avant d'afficher le segment.
- **Répartition des paiements par montant** (10) et **mini-graphe de l'accueil** (27) : ajouts mobiles, calculés
  sur les mêmes données. Le desktop n'a que le ticket moyen et le KPI « Volume 7 jours ».
- « Voir en tableau » (22), la variante Sombre de l'image (26) et la liste filtrée par méthode ou par pays ont un
  modèle dessiné (04) mais pas d'écran propre.
- Le **graphique en barres jumelées** dépôts / paiements du desktop n'est pas repris tel quel : sur 353 px, il est
  remplacé par le solde par semaine (07) et les deux séries séparées (03, 06).
- Le **cargo** n'a pas de graphique dans ce tableau de bord. Le fret (kilos avion, vols, CBM bateau) vit dans le
  tableau des ventes : voir lots 03 et 04.
