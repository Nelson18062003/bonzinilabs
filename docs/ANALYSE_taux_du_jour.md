# Taux du jour et flyers — l'analyse (24/09/2026)

Lecture complète du module (code, migrations, fonctions serveur, bot Telegram,
Mola), puis vérification des chiffres et des règles d'accès **en production**
(lecture seule). Les maquettes du nouveau flyer sont dans le harnais
(`src/__screenshot__/rateFlyerV2.tsx`) ; rien n'est encore branché dans l'app.

## 1. Comment le taux est fait

Chaque jour, l'équipe publie **4 taux de base** (ceux du Cameroun), en ¥ pour
1 000 000 XAF : Alipay, WeChat Pay, virement, cash. Tout le reste en découle :

**taux = taux de base × (1 + écart pays) × (1 + écart montant)**

| Ce qui change le taux | Aujourd'hui en production |
|---|---|
| **Mode** | Alipay 10 800 · WeChat 10 800 · Virement 10 800 · Cash 10 700 |
| **Pays** | Cameroun 0 % (référence) · Gabon, Tchad, Centrafrique, Congo, Guinée équatoriale **−1 %** |
| **Montant** | 1 000 000 XAF et plus : 0 % · 400 000 à 999 999 : **0 %** · moins de 400 000 : **−2 %** |

Donc, en pratique, **deux tranches** (400 000 XAF et plus / moins de 400 000)
et **deux taux par jour** : sur 137 publications depuis mars, Alipay, WeChat et
virement ont eu le même taux 134 fois (dernière différence le 13/05). Le cash,
lui, diffère presque toujours.

Au total aujourd'hui : **8 chiffres** couvrent tous les cas.

| | 400 000 XAF et plus | Moins de 400 000 XAF |
|---|---|---|
| Cameroun · Alipay, WeChat, virement | 10 800 | 10 584 |
| Cameroun · Cash | 10 700 | 10 486 |
| Autres pays · Alipay, WeChat, virement | 10 692 | 10 478 |
| Autres pays · Cash | 10 593 | 10 381 |

## 2. « Le montant n'est pas pris en compte » : vrai à moitié

La réduction « moins de 400 000 XAF » **existe et s'applique déjà**, mais pas
partout. Pour le **même** client gabonais, 300 000 XAF en Alipay, aujourd'hui :

| Qui crée le paiement | Pays | Montant | Taux | Le fournisseur reçoit |
|---|---|---|---|---|
| Le client, dans son app | oui | oui | 10 478 | 3 143,45 ¥ |
| Mola (sans préciser le pays) | non (Cameroun) | oui | 10 584 | 3 175,20 ¥ |
| L'équipe, « Nouveau paiement » | oui | **non** | 10 692 | 3 207,60 ¥ |
| L'équipe, paiements groupés | **non** | **non** | 10 800 | 3 240,00 ¥ |

Près de **100 ¥ d'écart** (3 %) selon le canal. Et **aucun flyer** ne montre la
tranche : ils disent tous « Pour 1 000 000 XAF », le meilleur taux. Le client
qui paie 300 000 XAF découvre un taux plus bas au moment de payer, sans
explication.

**À décider avant de publier un flyer par montant :** la règle doit être la
même partout. Si le flyer annonce « moins de 400 000 XAF : 10 478 », l'écran
« Nouveau paiement » de l'équipe, les paiements groupés et Mola doivent
l'appliquer aussi.

## 3. Le pays du client

- Il vient de la fiche client (`clients.country`), un texte libre choisi à
  l'inscription. En production : Cameroun 177, Gabon 19, Congo-Brazzaville 2,
  et 15 clients hors zone (Togo, Bénin, Burkina Faso, France, Chine, RD Congo,
  Tunisie, Cap-Vert, Sierra Leone) ; 3 sans pays.
- Tout pays hors des 6 reçoit **le taux du Cameroun**, sans avertissement.
  À confirmer : est-ce voulu pour un client du Togo ou de Chine ?
- **Le client peut changer son pays lui-même** (rien ne le bloque côté
  serveur) : un client gabonais qui se déclare « Cameroun » gagne 1 %.
- Un flyer par pays **existe déjà** dans l'app et dans Mola, mais le pays n'y
  est qu'une petite pastille « Taux du jour · Gabon ».

## 4. Les flyers aujourd'hui

Quatre fabriques de flyer coexistent, avec le même dessin :

1. l'app de l'équipe (Taux › « Voir le flyer du jour », PNG ou PDF) ;
2. la fonction serveur `generate-flyer` (utilisée par Mola et Telegram) —
   **publique, sans aucun contrôle** : n'importe qui peut fabriquer un flyer
   officiel avec des taux inventés ;
3. Mola (« génère le flyer ») ;
4. le bot Telegram `/flyer` (Cameroun seulement).

Toutes portent le logo et le nom « Bonzini », bonzinilabs.com, les deux
numéros WhatsApp, l'heure de Guangzhou et du chinois ; **aucune** ne porte
NORTON GAUSS BONZINI SARL. La refonte doit toucher les quatre, sinon Mola et
Telegram continueront d'envoyer l'ancien flyer.

## 5. Problèmes trouvés en chemin (vérifiés)

**Sécurité — à corriger vite, indépendamment des flyers** (vérifié en production) :

1. **Un client peut créer un paiement lui-même dans la table**, sans passer par
   la fonction qui débite son solde (règle « Users can create own payments »
   jamais retirée), avec le taux et le montant en ¥ de son choix.
2. **Un client peut modifier le taux et le montant en ¥** de son paiement tant
   qu'il est « créé » ou « en attente d'infos » (la règle ne limite pas les
   colonnes). Plus largement, le taux d'un paiement client est calculé par le
   téléphone et jamais recalculé par le serveur.
3. **Tout membre de l'équipe peut changer les taux** (caissier, support…) en
   écrivant directement dans les tables : la protection « super admin ou ops »
   ne vaut que pour les boutons.
4. **Les marges (`rate_snapshots`) sont lisibles par les clients connectés.**
5. Le bot Telegram `/publier` écrit les taux sans trace (ni auteur, ni
   journal) et impose « virement = taux − 20 ».

**Affichage** :

- l'en-tête de l'app équipe sur ordinateur affiche « ¥1 = 11 530 XAF » (unité
  inversée) ;
- l'avertissement « écart positif : paiera plus cher » dit l'inverse ;
- le libellé « 10 000 – 399 999 XAF » est périmé (plus de minimum depuis le
  19/08) ;
- côté client, 500 000 XAF est marqué « Taux standard » alors qu'il a le
  meilleur taux (la tranche 400 000–999 999 est à 0 %) ;
- l'app client bloque encore au-delà de 50 000 000 XAF, contre la règle
  « aucun plafond » ;
- en saisissant un montant en ¥ près de 400 000 XAF, l'app peut facturer la
  mauvaise tranche (≈ 4 000 XAF de trop).

**Mola** ne sait pas répondre « combien pour 250 000 XAF au Gabon en
Alipay » : aucun outil ne fait ce calcul, et il prend le Cameroun par défaut
alors que sa fiche dit le contraire.

## 6. Ce que je propose, dans l'ordre

1. **Sécurité d'abord** (points 1 à 4) : une migration courte, sans rien
   changer pour les clients honnêtes.
2. **Une seule règle de taux** : le serveur calcule le taux (pays du client +
   montant) pour tous les canaux — app client, équipe, groupés, Mola.
3. **Le nouveau flyer** (variante validée), branché à cette même règle, dans
   l'app, Mola et Telegram, avec le **texte du jour** à copier en dessous
   (voir `docs/PHRASES_taux_du_jour.md`).
4. Les petites corrections d'affichage.

## 7. Décisions attendues

- Variante du flyer : **A « L'essentiel »** (recommandée) ou **B « Le tableau »**.
- La tranche « moins de 400 000 XAF » s'applique-t-elle **aussi** aux
  paiements saisis par l'équipe ? (Aujourd'hui non.)
- Clients hors des 6 pays : taux du Cameroun, ou autre règle ?
- « Cash » ou « Espèces » ; un numéro de contact sur le flyer ou non.
