# Lot 04 : Trésorerie · Taux · Analyses (19 écrans)

Couleurs des devises, partout et dans tous les graphiques : XAF = ambre `#e38a0b`, USDT = bleu-vert `#1a9bb0`, CNY = violet `#7a3cf0` (validées par le script de palette). Méthodes de taux : Alipay `#1677ff`, Cash `#a2580a` (mêmes couleurs que les marques `mk`). Dépôts = ambre, paiements = violet.

| N° | Titre | Ce qu'il montre | Capacités desktop couvertes |
|---|---|---|---|
| 01 | Trésorerie (trésorier) | Onglet Trésorerie. Segment Vue d'ensemble / Analyse. Valeur totale au coût moyen, répartition XAF/USDT/CNY (barre + 3 totaux, comptes actifs seulement). Tuiles Acheter / Vendre USDT. Dernières opérations. | Vue d'ensemble (3 chiffres, stock USDT + coût moyen, dernières opérations, Tout voir), Nouvel achat, Nouvelle vente |
| 02 | Comptes (admin via Plus) | Même page, défilée, ouverte depuis Plus (barre admin, « < Plus »). Soldes par compte, groupés XAF / Pool USDT / CNY avec total par groupe. | Comptes (3 cartes, totaux, comptes, soldes ; négatif en rouge prévu) |
| 03 | Menu « … » | Feuille : Ajuster le solde d'un compte, Faire un inventaire, Nouveau fournisseur USDT, Nouvel acheteur CNY · Contreparties, Grand livre, Inventaires, Visuel des soldes (PNG · PDF). | Menu ⋯ de la coquille desktop, rubrique Contrôle (grand livre, inventaires, visuel des soldes), liste des contreparties |
| 04 | Analyse trésorerie | Segment Analyse du même écran. Période partagée (Jour…Tout, dates libres). Bénéfice, marge par CNY, taux de revient, taux client. Courbe d'évolution (Coût moyen / Achat / Vente). Meilleurs fournisseurs cliquables, écart en % coloré (bascule Acheteurs). | Rubrique Analyse (4 titres, évolution des taux, tops cliquables), préréglages de période |
| 05 | Nouvel achat USDT | Fournisseur (+ Nouveau), Payé depuis (+ Ajouter un compte), 3 montants liés (total XAF, taux, USDT calculé) avec formule. « Dernier taux Wang · Reprendre ». Alerte « Taux inhabituel » (> 8 % vs dernier achat et coût moyen). Date, référence, note. | `PurchaseForm` complet : contrepartie rapide, multi-comptes, 3 champs liés, formule, dernier taux, garde-fou 8 %, date/réf/note |
| 06 | Nouvelle vente USDT | Acheteur (+ Nouveau), USDT (stock rappelé), taux CNY/USDT, CNY calculé, formule. Encaissé sur (facultatif). Coût moyen, coût de sortie, stock après, marge. | `SaleForm` + bloc coût moyen / stock après (spécifique mobile, gardé) |
| 07 | Opérations | Recherche plein texte. Toutes / Achats / Ventes / Annulées avec compteurs. Filtres Période, Canal, Compte, Tri. Bandeau de totaux (achetés, payés, taux moyen). Groupé par jour ; annulée barrée, hors des totaux. | `OperationsView` + filtres canal / compte CNY / tri des listes mobiles (une seule liste remplace 3) |
| 08 | Fiche opération | Le reçu (bande aux 3 couleurs, montant, contre-valeur, taux avec unité, fournisseur, comptes, date, réf.). Écritures au grand livre avec solde après, chaque ligne mène au compte. Dock : Télécharger, Copier l'image. « … » : fiche fournisseur, Annuler. | `OperationSheet` : reçu, copier/télécharger, écritures, lien vers la contrepartie et les comptes |
| 09 | Annuler l'opération | Feuille de confirmation : effet avant → après sur le compte et le stock USDT, motif (≥ 10 caractères, validé), « Contre-passée, reste visible ». | `VoidForm` / `void_treasury_operation` (super admin) ; « Annuler », jamais « Supprimer » |
| 10 | Fiche compte | Caisse Douala : solde, mouvements, dernier inventaire. Segment Mouvements / Inventaires. Mouvements avec montant et solde après. Dock : Ajuster, Faire l'inventaire. | Fiche compte `/accounts/:id` : mouvements + solde après, inventaires du compte, Ajuster, Inventorier |
| 11 | Fiche contrepartie | Wang Exchange F-003 : contact, 4 stats de la période (opérations, USDT, XAF payés, taux moyen), ses opérations. Dock : Nouvel achat chez lui. « … » : Modifier, Archiver / Réactiver, Supprimer. | Fiche contrepartie (stats + opérations + actions) |
| 12 | Taux · Publier | Segment Simulateur / Publier / Historique / Marché. « Actifs depuis 08:12 », Flyer du jour. Suggestion Binance (Recalculer, Utiliser). Sens XAF→CNY / CNY→XAF. 4 taux avec écart vs hier. Prise d'effet. Taux par pays. | Publier (`RatePublishCard`, prise d'effet), `CountryRatesCard`, flyer ; suggestion Binance et sens inverse (mobile seul, gardés) |
| 13 | Publier les taux ? | Feuille : avant → après pour les 4 méthodes, date d'effet, pays dérivés. | Dialogue de confirmation de `create_daily_rates` (absent du mobile actuel) |
| 14 | Simulateur | Montant XAF ⇅ CNY, taux appliqué « Personnalisé » (retour à l'auto), méthode, pays, tranche. Cotation de marque (FR/EN, sombre/clair). Dock : Texte (WhatsApp), Partager l'image (PNG). | `RateQuoteSimulator` complet : champs liés, taux personnalisé, cotation PNG, texte WhatsApp |
| 15 | Taux · Historique | Courbes 7J/30J/3M/1A, méthodes activables (Alipay, Cash affichés). Liste des publications (actif marqué) ; une ligne balayée : Corriger / Annuler. | `RateTrendCard`, `DesktopRateHistory`, `update_daily_rate`, `delete_daily_rate` |
| 16 | Taux · Marché | Binance P2P : côté XAF / CNY, direct, médiane / meilleur / annonces, histogramme des paliers (% annonces / % USDT), annonces du palier, filtres. | `P2PMarketView` (côté, direct, unité, paliers, annonces, filtres) |
| 17 | Analyses | Période (30 j), comparaison, granularité. Alerte cliquable. 4 KPI en montants entiers + bande : nouveaux, actifs, conversion, délai. Flux financier (barres dépôts / paiements par semaine). | `DesktopAnalyticsDashboard` : 8 StatCards avec delta, Flux financier ; alertes cliquables (mobile seul, gardé) |
| 18 | Analyses · Croissance | Matrice 12 semaines (bascule 12 mois) : clients, dépôts, paiements, variation + nombre, cases colorées baisse / stable / hausse. Paiements par méthode. | `GrowthMatrixSection` (absent du mobile actuel), répartition par méthode |
| 19 | Analyses · « … » | Feuille : Rafraîchir, Période et comparaison, Granularité · Exporter en CSV : flux, volumes dépôts, volumes paiements, clients par pays, top clients. | Exports CSV, rafraîchir, granularité (mobile seul, gardés) |

## Capacités du module : où elles sont placées

**Trésorerie**
- Vue d'ensemble (XAF, stock USDT + coût moyen, CNY, dernières opérations) → 01
- Soldes par compte, totaux par devise → 02
- Nouvel achat → tuile 01, dock 11 → 05. Nouvelle vente → tuile 01 → 06
- Contrepartie rapide dans la saisie → « + Nouveau » 05 / 06
- Reprendre le dernier taux, garde-fou > 8 % → 05
- Après enregistrement : reçu (copier / télécharger) + « Nouvel achat » → même reçu qu'en 08, montré dans le bandeau de succès (pas dessiné à part)
- Opérations : filtre type + compteurs, recherche, période, totaux, canal, compte CNY / aucun, tri, annulées → 07
- Fiche opération, reçu, copier l'image, télécharger, écritures, liens compte / contrepartie → 08
- Annuler (void, motif ≥ 10, contre-passée) → « … » de 08 → 09
- Fiche compte : mouvements + solde après, inventaires, Ajuster, Inventaire → 10
- Ajuster le solde (avant → après, motif) → 03 et dock 10 (feuille du même modèle que 09)
- Faire un inventaire → 03 et dock 10
- Historique des inventaires (tous comptes, écarts, « Non expliqué ») → 03 › Inventaires ; par compte → segment de 10
- Grand livre (devise, compte, entrées / sorties) → 03 › Grand livre
- Visuel des soldes PNG / PDF → 03
- Contreparties : liste (segment fournisseurs / acheteurs, recherche, archivés) → 03 › Contreparties ; fiche, stats, opérations → 11 ; Modifier / Archiver / Supprimer → « … » de 11 ; créer → 03 et 05 / 06
- Analyse : bénéfice, marge, revient, client, évolution des taux, tops cliquables + écart → 04 ; volumes achats / ventes, histogrammes de distribution, capital immobilisé → plus bas dans 04 (bascule courbe / distribution dans la carte)
- Période partagée Opérations / Contreparties / Analyse → puce période de 04, 07, 11

**Taux**
- Taux actifs depuis…, flyer du jour (copier, télécharger, partager, légende, pays, langue) → 12
- Publier 4 taux, prise d'effet → 12 ; confirmation → 13
- Suggestion Binance (Recalculer / Utiliser) et sens CNY→XAF → 12
- Taux par pays (écart, flyer du pays) → ligne « Taux par pays » de 12
- Réglages (ajustements pays et tranches) → « … » de l'écran Taux
- Simulateur, taux personnalisé, méthode, pays, tranche, cotation PNG, texte WhatsApp, FR/EN, sombre/clair → 14 ; copier un chiffre → appui long sur le chiffre
- Courbes d'évolution + historique, Corriger, Annuler une publication → 15
- Marché Binance P2P → 16

**Analyses**
- Période, comparaison, granularité → 17 et 19
- Alertes (cliquables) → 17
- 8 KPI avec delta, montants entiers → 17
- Flux financier → 17
- Matrices de croissance 12 semaines / 12 mois → 18
- Dépôts / paiements par méthode → 18 ; volumes dépôts / paiements, parc de clients, sources + UTM, pays, top clients, productivité des admins → plus bas dans 18
- Exports CSV, rafraîchir → 19
- Retirés volontairement (retirés aussi du desktop à la demande du propriétaire) : statut des dépôts dans le temps, évolution des taux dans Analyses (déjà en 15)

## Non dessiné (placé, mais sans écran propre)
- Liste des contreparties, grand livre, historique global des inventaires : même modèle que 07 (recherche + puces + lignes groupées par jour).
- Feuilles Ajuster le solde / Faire un inventaire / Corriger une publication / Modifier une contrepartie : même modèle de feuille que 09 et 13.
- Accueil du trésorier (onglet Accueil) : relève de l'Accueil général, pas de ce lot.
