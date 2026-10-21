# Lot 05 · Trésorerie · Taux · Analyses (v2)

Rendu : `index.html` → `png/01.png … 17.png`. Kit v2 inchangé (kit2.css / kit2.js), styles du lot dans le `<style>` de la page, mêmes jetons.
Logos : Alipay, WeChat, Virement, Cash (kit), Afriland, Ecobank, UBA, CCA Bank (`../*.png`), Tether (USDT) et Binance dessinés en SVG à leurs couleurs.

## Écrans

| # | Écran | Ce qu'il montre |
|---|---|---|
| 01 | Trésorerie | Onglet Trésorerie du trésorier. Valeur totale 68 502 443 XAF, puis XAF / USDT / CNY. 4 ronds : Acheter USDT (noir), Vendre USDT, Comptes, Opérations. Les 2 dernières opérations. « … » en haut |
| 02 | Trésorerie · menu « … » | Ajuster un solde · Faire un inventaire · Fournisseurs et acheteurs · Grand livre · Inventaires passés · Visuel des soldes (image ou PDF) · Analyse trésorerie |
| 03 | Achat USDT · montants | Clavier. Fournisseur et compte payeur (avec son solde), Payé 3 000 000 XAF, Reçu 4 600 USDT, taux implicite 652,17 XAF/USDT avec le tag « Inhabituel · +8,9 % », « Dernier chez Kevin : 598,90 · Reprendre » |
| 04 | Achat USDT · confirmer | Feuille : « Acheter 5 000 USDT ? », taux, Afriland avant → après, stock USDT avant → après, bouton noir « Enregistrer l'achat » |
| 05 | Achat enregistré | Rond vert. « Copier le reçu » · « Télécharger », puis Nouvel achat / Voir l'opération |
| 06 | Opération · le reçu | Le reçu (logo USDT, montant, contrepartie, type, taux avec unité, payé depuis, date, référence). Comptes touchés avec le solde après, chacun ouvre sa fiche. Copier l'image (noir) · Télécharger |
| 07 | Opération · menu « … » | Voir Kevin Fotso · Voir le compte Afriland · Ajouter une note · **Annuler l'opération** en rouge (contre-passée, reste visible ; super admin) |
| 08 | Comptes | Segment XAF / USDT / CNY, total de la devise, comptes avec logo de banque, date du dernier mouvement et solde |
| 09 | Compte · mouvements | Afriland : solde, nombre de mouvements. Mouvements avec montant et **solde après**, lien Grand livre. « … » : Ajuster le solde, Faire l'inventaire (caisse, Alipay, WeChat), Inventaires du compte |
| 10 | Fournisseur USDT | Kevin Fotso, F-003, téléphone. Période (Octobre 2026), 4 chiffres (opérations, USDT, XAF payés, taux moyen) et ses opérations. « … » : Modifier, Archiver / Réactiver, Supprimer (sans opération seulement) |
| 11 | Taux du jour | Les 4 taux pour 1 000 000 XAF (Alipay, WeChat, Virement, Cash), actifs depuis 08:00, rappel d'hier. Ligne Binance avec « Utiliser ». Ronds Simuler · Historique · Flyer du jour. Bouton noir « Publier de nouveaux taux » |
| 12 | Publier · confirmer | Saisie (sens XAF → CNY / CNY → XAF, un champ par méthode), puis feuille « Publier ces taux ? » : prise d'effet et les 4 taux avant → après, bouton « Publier » |
| 13 | Simulateur | Méthode en tuiles, clavier, montant XAF ⇄ ¥, « Le fournisseur reçoit ¥ 16 257 » et le taux appliqué |
| 14 | Cotation · partager | L'image de la cotation (Bonzini Labs, vous payez / votre fournisseur reçoit, méthode et taux), FR/EN, Clair/Sombre, taux appliqué « Modifier ». Partager l'image (noir) · Texte WhatsApp |
| 15 | Historique des taux | 7 j / 30 j / 3 mois / 1 an, courbe à l'encre (Alipay) et en gris (Cash). Publications : tag Actif sur celle du jour, « … » sur chaque ligne (Corriger / Supprimer) |
| 16 | Analyses | Segment Activité / Trésorerie. Un gros chiffre : paiements exécutés sur 30 j (+12 %), puis 3 petits : dépôts validés, flux net, clients actifs. Barres par semaine, la semaine en cours en gris |
| 17 | Analyses · menu « … » | Période · Comparer · Croissance (12 semaines ou 12 mois) · Clients et équipe · Exporter en CSV |

Après la publication des taux, un écran de succès sur le modèle de 05, sans dessin à part. La vente d'USDT suit les écrans 03 à 05 : USDT vendus, ¥ reçus, compte CNY d'encaissement, et taux CNY/USDT avec le même tag d'alerte. La feuille de 04 ajoute « Stock USDT avant → après » et le coût moyen, avec un tag rouge si le stock passe sous zéro.

## Où est rangée chaque capacité de la version ordinateur

| Capacité (desktop) | Place sur mobile |
|---|---|
| Vue d'ensemble : comptes XAF, stock USDT, comptes CNY | 01 : total et détail par devise (comptes actifs seulement) |
| Coût moyen USDT (WAC) | 16 › Trésorerie, et la feuille de vente (stock et coût) |
| Dernières opérations + Tout voir | 01 |
| Nouvel achat / Nouvelle vente | 01 : ronds Acheter / Vendre (si `canManageTreasury`) → 03 à 05 |
| Fournisseur ou acheteur rapide pendant la saisie | Étape 1/3 (choix du fournisseur) : ligne « + Nouveau fournisseur », comme l'écran 4 de v2 |
| Plusieurs comptes payeurs | Étape 1/3 : « Ajouter un compte » ; la ligne `who` de 03 affiche alors « 2 comptes » |
| 3 montants liés (XAF, taux, USDT) et formule | 03 : Payé / Reçu au clavier, taux implicite affiché ; toucher le taux le rend saisissable |
| Dernier taux chez le fournisseur · Reprendre, alerte > 8 % | 03 : ligne « Dernier chez Kevin · Reprendre » et tag « Inhabituel » |
| Date, référence, note de la saisie | 04 : la ligne « Taux » s'ouvre sur « Plus de détails » (date, référence, note) ; la note s'ajoute aussi après coup par 07 |
| Reçu : copier l'image / télécharger | 05 (juste après la saisie) et 06 (sur la fiche) |
| Fiche opération : écritures, liens contrepartie et comptes | 06 (Comptes touchés) et 07 |
| Annuler (void) une opération, avec motif | 07 › « Annuler l'opération » (rouge, super admin), puis une feuille avec le motif et le bouton rouge |
| Liste des opérations : filtres Toutes / Achats / Ventes / Annulées, recherche, période, totaux | Rond « Opérations » de 01 : liste au modèle de l'écran 7 de v2, avec pastilles et loupe ; la période et les totaux sont en tête ; tri et filtres canal / compte CNY dans « … » |
| Comptes : totaux par devise, soldes, négatif en rouge | 08 (le négatif porte le tag rouge) |
| Fiche compte : mouvements, solde après, origine cliquable | 09 (chaque ligne ouvre l'opération) |
| Ajuster le solde | 02 et 09 › « … » (montant, sens, avant → après, motif, en feuille) |
| Faire un inventaire | 02 et 09 › « … » (caisse, Alipay, WeChat) |
| Historique des inventaires (tous comptes) | 02 › Inventaires passés ; par compte : 09 › « … » |
| Grand livre (devise, compte, entrées et sorties) | 02 › Grand livre ; lien « Grand livre » de 09 (déjà filtré sur le compte) |
| Visuel des soldes : PNG / PDF | 02 › Visuel des soldes |
| Contreparties : liste, segment fournisseurs / acheteurs, recherche, archivés, créer | 02 › Fournisseurs et acheteurs (liste au modèle de l'écran 2 de v2, segment, loupe, « + », pastille Archivés) |
| Fiche contrepartie : 4 chiffres, opérations | 10 |
| Modifier, archiver / réactiver, supprimer une contrepartie | 10 › « … » (confirmation en feuille, suppression en rouge) |
| Analyse trésorerie : bénéfice, marge, taux de revient et taux client, volumes, évolution des taux, top contreparties, capital immobilisé | 16 › segment Trésorerie (même gabarit : un gros chiffre « Bénéfice », 3 petits, un graphique) ; 02 › Analyse trésorerie y mène ; les tops s'ouvrent sur 10 |
| Taux actifs depuis … | 11 (« depuis 08:00 ») |
| Publier les taux, prise d'effet, avec confirmation | 11 › Publier → 12 |
| Sens XAF→CNY / CNY→XAF (mobile seul) | 12 |
| Suggestion Binance (Recalculer / Utiliser) | 11 (« Utiliser » remplit 12) ; « Recalculer » dans 11 › « … » |
| Simulateur (méthode, XAF ⇄ CNY) | 13 ; pays dans 13 › « … » |
| Taux personnalisé | 14 › « Modifier » sur le taux appliqué |
| Cotation PNG, texte WhatsApp, FR/EN, clair/sombre, copier un chiffre | 14 (copier un chiffre : appui long sur le montant) |
| Flyer du jour ou d'un pays (copier, télécharger, partager, légende) | 11 › rond « Flyer du jour » (feuille) ; flyer d'un pays dans Taux par pays |
| Taux par pays et leur écart | 11 › « … » › Taux par pays |
| Réglages pays et tranches | 11 › « … » › Réglages |
| Marché Binance (paliers, direct, filtres) | 11 › « … » › Marché Binance (si `canManageRates`) |
| Historique : courbes par méthode, période | 15 (les pastilles de méthode s'ajoutent au-dessus de la légende) |
| Corriger / Supprimer une publication | 15 › « … » de la ligne (Corriger, Supprimer en rouge ; `canManageRates`) |
| Analyses : période, comparaison, granularité | 17 › Période, Comparer ; granularité sous Croissance |
| 8 chiffres clés (paiements, dépôts, flux net, exposition, nouveaux et actifs, conversion, délai) | 16 : 1 gros et 3 petits ; les autres s'affichent en faisant défiler le même cadre |
| Flux financier, volumes, dépôts et paiements par méthode | 16 : graphique en barres (défilement : un graphique par écran) |
| Matrices de croissance 12 semaines / 12 mois | 17 › Croissance |
| Top clients, productivité des administrateurs, sources, pays | 17 › Clients et équipe |
| Export CSV (mobile seul) | 17 › Exporter en CSV |
| Alertes cliquables (mobile seul) | En tête de 16, sous le segment, quand il y en a (ligne tag + lien vers Dépôts / Paiements) |
| Rafraîchir | Tirer vers le bas, sur 16 comme sur 11 |
| Graphiques retirés sur desktop (statut des dépôts dans le temps, évolution des taux dans Analyses) | Retirés aussi sur mobile, à la demande du propriétaire |
