# Lot 08 · Module Taux complet (v2)

Rendu : `index.html` → `png/01.png … 29.png`. Le kit v2 n'est pas modifié (kit2.css / kit2.js). Les styles du lot sont dans le `<style>` de la page et reprennent les mêmes jetons.
Ce lot approfondit les écrans 11 à 15 du lot 05 et en garde les données (Alipay et WeChat ¥ 10 838, Virement 10 790, Cash 10 650 depuis 08:00 ; 1 500 000 XAF = ¥ 16 257).
Données tirées du code : 4 méthodes (`PAYMENT_METHODS`) ; 6 pays (`COUNTRIES`), le Cameroun en référence et les autres pays décalés d'un écart (`rate_adjustments` de type country) ; 3 paliers t3 / t2 / t1 (≥ 1 000 000 · 400 000 à 999 999 · moins de 400 000 XAF, écarts 0 / −1 / −2 %) ; formule `base × (1 + pays) × (1 + palier)` ; prise d'effet Maintenant / Aujourd'hui / Hier / Autre ; sens « Pour 1M XAF / Pour 1 CNY » ; suggestion Binance (CMR max + marge, CHN moyenne) ; marché P2P (Achat au Cameroun / Vente en Chine, filtre Bonzini, médiane, prix le plus fréquent, meilleur prix, paliers, annonces) ; image de cotation `RateQuoteCard` (FR/EN, sombre/clair) ; flyer `RateFlyer` (pays, langue, tranches en rouge).
Graphiques : encre #2C2C2C pour la série principale, gris #B3B3B3 pour la comparaison, grille en pointillés #D9D9D9, textes de 14 px et plus, une légende dès qu'il y a 2 séries.
Les images partagées (cotation et flyer) gardent leurs vraies couleurs, car elles sont le contenu envoyé aux clients. L'interface autour reste en noir et blanc.
Noms inventés ; les annonceurs Binance sont fictifs.

## Écrans

| # | Écran | Ce qu'il montre |
|---|---|---|
| 01 | Taux du jour | Accueil du module (barre Plus). Chiffre principal : Alipay ¥ 10 838 pour 1 000 000 XAF, +26 sur hier, depuis 08:00. 4 ronds : Publier (noir), Simuler, Flyer, Marché. Liste Cameroun : Alipay · WeChat, Virement, Cash avec le taux d'hier ; lien « 6 pays » |
| 02 | Taux · menu « … » | Taux par pays · Écarts pays et paliers · Historique des taux · Cotation pour un client · Copier les taux en texte (WhatsApp) |
| 03 | Publier 1/3 · point de départ | Suggestion Binance ¥ 10 870 (choisie) : Cameroun 602,60 XAF/USDT (max + 5 XAF), Chine 6,550 ¥/USDT (moyenne), « Recalculer ». Ou Taux actuels, ou Saisir à la main |
| 04 | Publier 2/3 · saisie | Segment « Pour 1 000 000 XAF / Pour 1 ¥ », une ligne par méthode avec le taux actuel, champ actif (Virement en cours de saisie), gros clavier |
| 05 | Publier 2/3 · sens « pour 1 ¥ » | Même saisie dans l'autre sens : 92,00 / 92,00 / 92,42 / 93,63 XAF pour 1 ¥, avec l'équivalent pour 1 000 000 XAF sous chaque ligne |
| 06 | Publier 3/3 · prise d'effet et aperçu | Maintenant (10:24) · Aujourd'hui · Hier (depuis 00:00) · Autre date et heure. Aperçu Cameroun avant → après |
| 07 | Publier · confirmer | Feuille « Publier ces taux ? » : prise d'effet, remplace ceux de 08:00, 3 lignes avant → après, « 5 autres pays · suivent leur écart », bouton Publier |
| 08 | Taux publiés | Rond vert, Alipay ¥ 10 870 · Cash ¥ 10 680, actifs depuis 10:24 dans 6 pays. « Partager le flyer » (noir) · Retour aux taux |
| 09 | Taux par pays | Pastilles de méthode, puis 6 pays avec drapeau, écart et taux dérivé pour 1 000 000 XAF |
| 10 | Pays · Gabon | Drapeau, ¥ 10 675 (Alipay), tag Écart −1,5 %. Les 3 lignes de méthode avec le taux du Cameroun en rappel. « Écart vs Cameroun · Modifier ». Bouton noir « Flyer du jour · Gabon » |
| 11 | Pays · modifier l'écart | Feuille : paliers 0 / −0,5 / −1 / −1,5 / −2 %, avant → après des 3 taux, « Enregistrer −1 % » |
| 12 | Écarts pays et paliers | Réglages : les 6 pays (le Cameroun en référence à 0 %) et les 3 paliers de montant avec leur % |
| 13 | Palier · modifier | Feuille du palier 400 000 à 999 999 XAF : choix du %, avant → après des taux de ce palier, rappel « en rouge sur le flyer », Enregistrer |
| 14 | Marché · taux Binance et journée | Taux Binance ¥ 10 870, notre Alipay 10 838, marge 0,29 %. Achat au Cameroun 602,60 XAF/USDT, Vente en Chine 6,550 ¥/USDT. **Graphique de la journée** : Binance à l'encre, notre taux publié en marches grises (10 812 → 10 838 à 08:00). Tag « En direct ». Bouton « Utiliser ¥ 10 870 » |
| 15 | Marché · carnet du Cameroun | Segment Cameroun · XAF / Chine · ¥, Filtre Bonzini / Tout Binance / Filtres. Meilleur prix, médiane, prix le plus fréquent, nombre d'annonces. **Histogramme** des prix, le palier touché (602) à l'encre |
| 16 | Marché · annonces à 602 XAF | Feuille : 38 annonces · 17,8 % · 41 200 USDT ; pour chaque annonceur : ordres par mois, taux de réussite, USDT disponibles, Marchand / Pro |
| 17 | Historique · graphique | 7 j / 30 j / 3 mois / 1 an. Chiffre ¥ 10 838, +148 · +1,4 %. **Grand graphique** : Alipay à l'encre, Cash en gris ; le point touché (8 oct.) affiche ses valeurs. « Comparer avec » : choix des méthodes |
| 18 | Historique · publications | Octobre 2026 · 19 publications. Pour chaque ligne : date et heure, Alipay et Cash, écart de cash sur la veille, tag Actif, « … » |
| 19 | Publication · menu « … » | Feuille : date, remplacée le…, les 3 taux. Corriger la publication · **Supprimer** en rouge |
| 20 | Publication · corriger | Feuille : 4 champs (Cash 10 640 → 10 645 en cours), date d'effet, « Enregistrer la correction » |
| 21 | Publication · supprimer | Feuille : « Supprimer la publication active ? », celle qui redevient active (20 oct., 08:05), Alipay du jour 10 838 → 10 812, bouton rouge Supprimer · Garder |
| 22 | Simulateur · XAF → ¥ | Pays (Cameroun) en haut à droite, méthode en tuiles, 1 500 000 XAF au clavier, « Le fournisseur reçoit ¥ 16 257 », palier et taux appliqué. « Voir la cotation » |
| 23 | Simulateur · ¥ → XAF et détail | Gabon, ¥ 50 000 → le client paie 4 683 652 XAF. Feuille « Détail du calcul » : base 10 838, pays −1,5 %, palier 0 %, taux appliqué 10 675,43 « Modifier » (taux personnalisé), montant à copier |
| 24 | Cotation · image à partager | La vraie image `RateQuoteCard` (sombre) : Vous payez 1 500 000 XAF, Alipay, ¥ 16 257, taux appliqué, WhatsApp, validité. FR/EN, Sombre/Clair, « Taux appliqué · Modifier ». Partager l'image (noir) · Copier le texte |
| 25 | Flyer du jour | Pastilles de pays, Français/English, le vrai flyer (nouveaux taux, heure de Guangzhou, tranches en rouge). « Partager sur WhatsApp » (noir), copier l'image, copier la légende |
| 26 | Flyer · partage WhatsApp | Flyer du Gabon en anglais, feuille de partage du téléphone : `todays_rate_gabon_2026-10-21.png`, WhatsApp, WeChat, Telegram, Messages, Copier, Enregistrer l'image |
| 27 | Cotation client · choisir | Recherche, récents, clients avec leur pays et leur drapeau |
| 28 | Cotation client · montant | Aïcha Diallo · Gabon · écart −1,5 %, méthode WeChat, 3 000 000 XAF, « Le fournisseur reçoit ¥ 32 026 » (taux du pays du client) |
| 29 | Cotation client · envoyer | Image claire avec « Taux appliqué · Gabon » (¥ 10 675). Téléphone du client. « Envoyer à Aïcha » (WhatsApp, noir) · Copier le texte |

## Où va chaque capacité de la version ordinateur

| Capacité (desktop / code) | Écran mobile |
|---|---|
| « Taux actifs depuis … » en tête | 01 (« Depuis 08:00 ») |
| Les 4 taux en CNY pour 1 000 000 XAF | 01 (Alipay et WeChat réunis quand ils sont égaux, comme sur le flyer) |
| Publier : 4 taux, saisie | 04 |
| Sens XAF→CNY / CNY→XAF (mobile seul, `RateSetTab`) | 04 / 05 |
| Prise d'effet : maintenant, aujourd'hui, hier, autre date et heure | 06 (« Autre date et heure » ouvre date + heure en feuille) |
| Dialogue de confirmation avant publication (`create_daily_rates`) | 07 |
| Retour après publication | 08 (succès + flyer à partager tout de suite) |
| Suggestion automatique Binance : Recalculer, détail CMR/CHN, Utiliser (`suggest-daily-rates`, `mark_suggestion_applied`) | 03 (Recalculer, détail) et 14 (« Utiliser ») |
| Taux par pays dérivés du Cameroun (`CountryRatesCard`) | 09, 10 |
| Écart d'un pays : paliers 0 à −2 %, signe +/−, saisie libre, avertissement si écart positif (`update_rate_adjustment`) | 11 (le signe + et la saisie libre se trouvent sous les paliers dans la même feuille ; l'avertissement pour un écart positif prend la place de la note) |
| Flyer d'un pays | 10 (bouton) → 25 avec le pays choisi |
| Réglages : % par pays et par palier, Sauvegarder (`RateAdjustmentsCard`) | 12 → 11 (pays) / 13 (palier) |
| Marché Binance : côté CNY / XAF, actualiser, direct marche/arrêt | 14, 15 (segment ; « En direct » ; Actualiser et Pause dans « … ») |
| Chiffres du marché : annonces, avec vos filtres, médiane, plus fréquent, meilleur prix | 15 |
| Distribution des prix (histogramme), hauteur % annonces / % USDT, largeur des paliers, zoom | 15 (histogramme) ; unité, largeur et zoom dans « … » de 15 |
| Tous les paliers (table Prix, Annonces, Part, Cumul, USDT dispo) | 15 › « … » › Tous les paliers (liste au même modèle que 18) |
| Annonces d'un palier (annonceur, ordres/mois, réussite, USDT, limites, Pro/Marchand) | 16 (les limites s'affichent en touchant une ligne) |
| Filtres : Tout Binance / Filtre Bonzini, mode de paiement, montant, annonceurs, ordres, réussite, délai | 15 (pastilles) ; « Filtres » ouvre une feuille avec ces groupes en pastilles |
| Comparaison marché / notre taux, marge | 14 (nouveau sur mobile : la version ordinateur ne fait pas le calcul) |
| Graphique de la journée | 14 (nouveau : relevés de `rate_suggestions` et notre taux publié) |
| Historique : courbes, chips 7J/30J/3M/1A, bascule par méthode (`RateTrendCard`, `MultiCurveChart`) | 17 |
| Table de l'historique : date, 4 méthodes, Δ cash, Actif | 18 (Alipay et Cash dans la ligne ; les 4 taux s'affichent dans la feuille de 19) |
| Corriger une publication : 4 taux + date d'effet (`update_daily_rate`) | 19 → 20 |
| Supprimer une publication, avec réactivation de la précédente si c'est l'active (`delete_daily_rate`) | 19 → 21 |
| Simulateur : XAF et CNY liés, méthode, pays | 22 (XAF → ¥), 23 (¥ → XAF) |
| Détail du calcul : base, pays, palier, taux appliqué | 23 |
| Taux personnalisé, retour au taux automatique | 23 et 24 (« Modifier » ; le retour au taux automatique apparaît dans la même feuille quand un taux est personnalisé) |
| Copier chaque chiffre | 23 (icône de copie), appui long sur les montants |
| Cotation de marque FR/EN, sombre/clair, Télécharger l'image, Copier le texte | 24, 29 (l'image passe par la feuille de partage, qui propose aussi Enregistrer) |
| Flyer du jour : pays, langue, copier l'image, télécharger, partager, copier la légende (`RateFlyerSheet`) | 25, 26 |
| Copier les taux en texte | 02 (même texte que la légende du flyer) |
| Cotation pour un client donné | 27 à 29 (nouveau : le pays et l'écart viennent de la fiche du client ; l'envoi ouvre WhatsApp sur son numéro) |
| Droits : publier, corriger, supprimer, écarts, marché = `canManageRates` (super_admin, ops) | Sans ce droit, 01 n'affiche pas le rond Publier, le rond Marché ni les actions de « … » ; simulateur, historique et flyer restent en lecture |
