# Second passage sur l'article de Paul Graham — les heuristiques que je n'avais pas utilisées

> Suite de [`2026-09_pg-making-startups-powerful.md`](2026-09_pg-making-startups-powerful.md).
> Le premier passage a produit huit manœuvres. Il laissait de côté cinq outils de
> l'article, dont celui que PG présente comme le plus générateur. Ce document les applique,
> et **révise une conclusion du premier passage**.
>
> **[PG]** article · **[FAIT]** vérifié au dépôt · **[HYPO]** inférence.

---

# 1. Faire tourner l'article à l'envers

C'est la dernière phrase du texte, et je n'avais fait que la citer.

> **[PG]** « À quoi ressemblerait le monde parfait, **du point de vue du client** ? S'il
> existe dans ce monde une composante en laquelle la startup pourrait se transformer,
> elle devrait probablement le faire. »

## Le monde parfait, écrit dans la voix de l'importateur

> « Je vois une machine sur WeChat. **Je la montre à quelqu'un.** On me dit : ça te coûtera
> 4 740 000 rendu à ton magasin, en 52 jours, et voici les trois choses qui peuvent mal
> tourner. Je dis oui. **Je paie une fois**, en XAF, depuis mon téléphone. **Je ne parle à
> personne d'autre.** Quarante jours plus tard on m'appelle : ta marchandise est arrivée.
> **Je n'ai jamais entendu les mots BESC, SGS, télex, surestaries.** »

## Ce que ce paragraphe apprend

**Le client ne veut pas un meilleur outil. Il veut moins d'interlocuteurs.**

Aujourd'hui un import camerounais en mobilise au moins sept : le fournisseur, le
groupeur chinois, l'armateur, la SGS, le CNCC, le commissionnaire en douane, le
transporteur final. Le monde parfait en compte **un**.

La composante en laquelle Bonzini peut se transformer n'est donc ni « une plateforme de
paiement », ni « un traceur de conteneurs ». C'est **l'interlocuteur unique**.

## Le critère produit qui en découle

> 🔑 **Toute fonctionnalité se juge à un seul chiffre : combien d'interlocuteurs
> elle retire au client.** Pas à ce qu'elle ajoute à l'écran.

Ce critère est plus dur que « est-ce utile ? », et il classe différemment. Un beau
tableau de suivi qui n'enlève personne vaut moins qu'un bouton laid qui supprime un
coup de fil au transitaire.

## Ce qu'il révèle dans le document d'architecture actuel

**[FAIT]** `module-app/01-vision-et-architecture.md` pose trois questions auxquelles chaque
écran doit répondre : **« Où ? Quand ? Que faire ? »**

Les deux premières sont les bonnes. La troisième est **la question de l'ops, pas celle du
client**. Dans le monde parfait, le client n'a **rien** à faire — c'est précisément la
définition du monde parfait. « Que faire ? » dit, sans le vouloir, que le travail reste
chez le client.

**[HYPO]** Pour l'écran client, la troisième question devrait être : **« Qu'est-ce qu'on
fait pour toi en ce moment ? »**

**[FAIT]** Et le même document liste les destinataires dans cet ordre : le fondateur,
le chargé de clientèle, puis « **le client importateur (phase 2)** ». Le client est en
phase 2 d'un produit dont l'objet entier est son angoisse. C'est un signal, et j'y reviens
au §7.

---

# 2. Le test mafia — et l'endroit exact où l'attaquer par le côté

> **[PG]** « Elles sont les plus faibles dans les marchés dominés par des entreprises
> qu'on qualifierait de mafia. […] On n'y gagne pas en ayant le meilleur produit. […]
> Il faudrait les battre **en venant par le côté** — en les rendant d'une façon ou d'une
> autre hors sujet, plutôt que par une attaque frontale. »

Note [9] : on les reconnaît à ce qu'elles sont pleines d'avocats. Dans ce corridor, le
marqueur n'est pas l'avocat, c'est **l'agrément** : on n'entre pas par la qualité, on entre
par une autorisation.

| Acteur | Mafia ? | Pourquoi |
|---|---|---|
| **Commissionnaire agréé en douane (CAD)** | 🔴 oui | Seul un agréé peut déposer une déclaration. L'entrée est administrative. |
| **SGS** (programme d'inspection) | 🔴 oui | Concession d'État. Aucun concurrent possible. |
| **CNCC** (BESC) | 🔴 oui | Monopole statutaire — arrêté n° 00557/MINT. |
| **Armateurs** | 🟡 non | Oligopole, mais on change d'armateur et ils exposent des API. |
| **Banques (jambe change)** | 🟡 partiel | Licencié, mais plusieurs acteurs. |

**[FAIT]** Les trois lignes rouges sont exactement là où l'argent a fui sur MRSU9909331.

## Le côté par lequel on entre

Une attaque frontale est impossible : on ne concurrence pas un monopole d'État. Mais
regardons **d'où vient réellement leur pouvoir**, cas par cas.

**Le CAD.** Son pouvoir n'est pas l'agrément — c'est d'être **le seul à savoir**.
**[FAIT]** Cette semaine, le code SH correct a été établi hors de lui, l'article 128 ter
lu hors de lui, l'API CAMCIS interrogée hors de lui. Retire le savoir, et l'agrément
redevient ce qu'il est : une **signature**. C'est la marionnette de PG, atteinte sans
jamais demander d'agrément.

**La SGS.** 🔑 **Son pouvoir discrétionnaire est nourri par un document manquant.**
**[FAIT]** Le motif porté sur son propre rapport est *« LA FACTURE NON SOUMISE »* — et
c'est ce motif qui a permis la méthode 6.4 et la valeur triplée.

> **On ne combat pas ce monopole : on lui retire l'entrée qui lui permet d'agir.**
> Une proforma et une preuve de paiement transmises systématiquement font disparaître
> la marge d'appréciation. Le dossier complet **est** l'attaque par le côté.

C'est mesurable : l'écart entre la valeur transactionnelle et la valeur en méthode 6.4,
dossier par dossier. Ça devient un indicateur de performance de Bonzini.

**Le CNCC.** Rien à faire : le BESC est statutaire, il se paie. Mais **[FAIT]** l'arrêté
dit « le chargeur **ou son mandataire** » (art. 4) — donc Bonzini peut être le mandataire,
et retirer un interlocuteur au client (critère du §1) sans rien affronter.

## La règle à retenir

> Ne jamais faire dépendre le succès de Bonzini d'un combat contre un agrément.
> **Faire dépendre son succès de la complétude de ses dossiers** — c'est le seul terrain
> où le meilleur gagne, et c'est celui où Bonzini est déjà meilleur que les autres.

---

# 3. Le benchmark — l'effet de réseau que j'avais raté

> **[PG]** « On peut souvent **induire** des effets de réseau en laissant ses utilisateurs
> **partager quelque chose**. Par exemple : *si vous optez pour, nous vous dirons comment
> vous vous situez par rapport aux autres utilisateurs.* »

J'avais appliqué cette phrase à la réputation fournisseur (manœuvre 8, lointaine et
risquée). Elle a une application beaucoup plus directe, et **presque gratuite**.

## Pourquoi ce corridor est le terrain idéal

Dans le commerce Chine → Cameroun, **personne ne sait ce que quoi que ce soit devrait
coûter.** Chaque prix se négocie en privé, dans un fil WeChat, sans référence. C'est la
définition exacte d'un marché où un point de comparaison vaut de l'or pour l'acheteur.

> « Vous avez payé 3 420 882 F de fret sur Nansha → Douala en juin.
> **La médiane Bonzini sur cette ligne, ce mois-ci : 2 900 000 F.** »

## Pourquoi c'est un vrai effet de réseau

Le benchmark n'a de valeur que s'il y a du monde dedans. Chaque nouveau client
**améliore** l'outil pour tous les autres, sans rien faire — la donnée est un **sous-produit**
de la manœuvre 3 (payer tout le dossier). C'est la définition stricte, et elle ne coûte
**aucun bilan**, contrairement au groupage.

Et **[PG]** c'est aussi « aider ses utilisateurs à gagner de l'argent » : savoir qu'on
paie 18 % au-dessus de la médiane est actionnable à la négociation suivante.

## 🔴 Et voici ce que j'ai trouvé dans le dépôt

**[FAIT]** `docs/cargo/outils/Bonzini-Comparateur-Cotations-Fret.xlsx` existe, avec son
script de génération. Quatre onglets. Et le README de l'outil décrit lui-même le
quatrième :

> « **Historique** — journal des cotations. Au fil des conteneurs, **il devient une base
> de données de prix sur le corridor Chine → Douala**. »

**[FAIT]** Et `module-app/01-vision-et-architecture.md`, dans sa liste des écartés :

> « Écartés : booking en ligne, cotations de fret (**le comparateur reste un outil
> interne**). »

**L'actif exact qu'exige l'effet de réseau a été identifié, construit, décrit — puis rangé
comme outil interne.** Ce n'est pas un oubli, c'est le §7 de ce document.

## La contrainte, vérifiée

**[PG]** est-ce meilleur pour le client ? Pour l'importateur, oui, sans réserve. Pour le
transitaire, non — mais **le transitaire n'est pas le client**. Et l'opt-in agrégé protège
la confidentialité : on publie une médiane par ligne et par mois, jamais un prix nominatif.

---

# 4. Définir le standard (note [2])

> **[PG]** « Si vous ne pouvez pas créer un app store, pouvez-vous au moins **définir le
> standard** de la façon dont les produits de différentes entreprises interagissent ? Dans
> un domaine nouveau, il n'y a souvent pas encore de standard. Ne craignez pas d'être trop
> petit pour en proposer un. […] **Tout le monde a si faim de standards que le premier
> proposé tend à gagner, peu importe qui l'a proposé.** »

## Ce qui n'est standardisé nulle part dans ce corridor

**Le dossier d'import lui-même.** Aujourd'hui c'est un fil WeChat, des PDF, des captures
d'écran, et des noms de fichiers improvisés. Il n'existe aucun format nommé pour « tout ce
qui concerne un import ».

## 🔑 Et Bonzini en a déjà proposé un, sans le voir

**[FAIT]** Dans le message rédigé pour le partenaire chinois
(`docs/cargo/audit/2026-09_demande-partenaire-chine.md`), il est demandé :

> « **un dossier par conteneur, nommé `NuméroBL_NuméroConteneur`** » — 一柜一档

C'est un standard. Écrit pour résoudre un problème immédiat, mais c'en est un : une
convention de nommage, une granularité (le conteneur), une clé composite (BL + conteneur),
et une liste de pièces attendues en six sections.

## Ce que ça deviendrait, poussé jusqu'au bout

Une **spécification ouverte du dossier d'import** pour le corridor : la liste des pièces,
leur nommage, leur ordre, et un manifeste lisible par machine. Publiée librement.
Utilisable par les groupeurs chinois, les transitaires, les déclarants, les banques —
et par les agents.

Pourquoi Bonzini peut le faire : **c'est le seul acteur qui touche toutes les pièces à la
fois.** Le groupeur ne voit pas la douane, le déclarant ne voit pas le paiement, la banque
ne voit rien.

Et ça compose : le standard **est** le schéma de l'API de la manœuvre 7, **et** la table
des matières du manuel de la manœuvre 5. Trois manœuvres, un seul artefact.

---

# 5. Qui pourrait t'avaler — la note [1] retournée en défense

> **[PG]**, note [1], à propos du flux de tokens : « En théorie cela vous place en position
> de force. […] **La question est de savoir avec quelle facilité ils pourraient vous
> engloutir, vous — ou même vos clients.** »

Je n'avais pas posé cette question. Elle est défensive, et elle révise mon classement.

| Qui | Menace | Ce qui protège |
|---|---|---|
| **Le groupeur chinois** (High Goal & assimilés) | 🔴 **la plus réelle.** Il touche déjà la marchandise et le connaissement, et encaisse souvent en Chine. Il lui manque une jambe de collecte en XAF. **[FAIT]** Sur MRSU9909331 il détient le B/L pendant que Bonzini paie les surestaries — le rapport de force existe déjà. | L'agrément côté Cameroun, les agents cash, la relation client. **Pas le logiciel.** |
| **Les fintechs africaines** | 🟡 pourraient ajouter le paiement Chine | Elles n'ont ni le savoir douanier ni le côté fournisseur. Elles chassent le volume grand public, pas la profondeur commerciale. |
| **Les rails de paiement chinois** | 🟡 pourraient venir dans l'autre sens | La friction réglementaire, pour l'instant. |
| **Les armateurs** | 🟢 faible | Ils ne feront pas du change pour importateur africain. |

## Ce que cette analyse impose comme conclusion

> **Rien de ce qui protège Bonzini n'est du code.**
> Ce qui protège : l'agrément, les **agents cash** (physiques, non copiables), le rail de
> trésorerie USDT, et **la donnée de corridor accumulée**.
> De ces quatre, une seule **compose dans le temps** : la donnée.

## 🔁 La révision que ça impose au premier passage

Dans le premier mémo j'avais classé la manœuvre 7 (ouvrir Mola) comme « presque gratuite,
à faire dès qu'un client la demande », et le groupage comme le seul vrai effet de réseau.
Les deux méritent correction :

1. **Ouvrir l'API ne défend rien.** C'est une surface, pas une douve. À faire quand même —
   c'est peu cher — mais **jamais avant** ce qui accumule de la donnée propriétaire.
2. **Le groupage n'est pas le premier effet de réseau à viser.** Il consomme du bilan.
   **Le benchmark du §3 est le même effet, en sous-produit, à coût nul.** Il vient avant.

**Nouvel ordre, corrigé :**

| # | Manœuvre | Ce que ça accumule |
|---|---|---|
| 1 | Proforma + coût à quai | la donnée d'entrée |
| 2 | Publier le manuel + **le standard** (§4) | l'autorité |
| 3 | Payer tout le dossier | **la donnée de coût réelle — la seule douve qui compose** |
| 4 | **Le benchmark opt-in** (§3) | le premier effet de réseau, à coût nul |
| 5 | Diff proforma ↔ B/L | l'avantage structurel des deux flux |
| 6 | Le groupage | le second effet de réseau, mais il coûte du bilan |
| 7 | Ouvrir Mola | une surface, pas une défense |
| 8 | Le fournisseur, second côté | le plus lointain |

---

# 6. Les autres queues qui remuent — inventaire, et rejets assumés

> **[PG]** « Chaque fois que des fondateurs construisent quelque chose de périphérique au
> produit principal, je demande : est-ce que ça pourrait être le vrai produit ? »
> Et : « Ces transformations ne donnent pas toujours quelque chose de prometteur. Loin de
> là. Mais elles valent **toujours** d'être considérées ; ne serait-ce que parce
> qu'**essayer de transformer une idée aide à mieux la comprendre**. »

Je pose la question sur tout ce que Bonzini a construit à côté, y compris pour répondre non.

| Périphérie | **[FAIT]** ce que c'est | Verdict |
|---|---|---|
| **Cargo** | 22 modules, 7 tables, un cron armateur, dans le dépôt du produit de paiement | 🔴 **Ce n'est pas une queue, c'est la moitié manquante.** Traité au premier passage. |
| **Le comparateur de fret** | Un classeur à 5 offres × ~15 postes, avec un onglet Historique décrit comme « une base de données de prix sur le corridor » | 🔴 **Oui.** C'est le §3. Le plus gros rejet à annuler. |
| **L'infrastructure SMS** | `sms_outbox`, **`sms_sender_routes` (expéditeur résolu par pays)**, `sms_suppressions`, statistiques de délivrance par pays, drainer `FOR UPDATE SKIP LOCKED`, langue par client | 🟡 **Non, mais à noter.** La délivrabilité SMS multi-pays en Afrique est un problème réellement dur, et il a été résolu. Ce n'est pas un marché que Bonzini doit servir — c'est un actif à ne pas casser, et un argument de crédibilité technique. |
| **La convention `@mola`** | 84 capacités étiquetées : permission, confirmation, danger, résolution de références | 🟡 **Non comme produit** — ce serait un outil pour développeurs, un tout autre métier. 🔴 **Oui comme standard**, au sens du §4 : c'est déjà la façon dont un agent navigue une base Postgres métier. À publier, pas à vendre. |
| **La prédiction de change** | `rate_predictions`, `rate_suggestions`, `macro_snapshots`, `trump_posts` | 🟡 **Non.** Mais **[PG]** dit de poser la question sérieusement une fois : le XAF étant arrimé à l'EUR à parité fixe, l'exposition réelle est EUR/USD — un marché mondial, liquide, où Bonzini n'a aucun avantage informationnel. **Le prédire n'est pas un produit ; le couvrir est un métier.** La question est réglée. |
| **Les agents cash** | `scan_cash_payment`, `confirm_cash_payment` | 🔴 **Ce n'est pas une queue, c'est la douve.** Voir §5 : c'est la seule chose qu'un concurrent logiciel ne peut pas copier. |

---

# 7. Se tenir droit — la version dure

> **[PG]** « Le plus souvent, ce sont les startups elles-mêmes qui se retiennent. […]
> Chez les toutes jeunes surtout, **si l'idée est compliquée, c'est souvent la peur**.
> L'entreprise se recroqueville inconsciemment en faisant moins ambitieux qu'elle ne
> pourrait. *Just y*, c'est souvent, en effet : **tiens-toi droit.** Et quand elles le
> font, elles sont bien plus grandes. »

Au premier passage j'ai posé trois questions polies. Voici la version directe, avec les
citations exactes du dépôt.

## 7.1 Le paragraphe des exclusions

**[FAIT]** `module-app/01-vision-et-architecture.md` :

> « Ce que le module n'est pas : un logiciel de transitaire (pas de cotation, pas de
> booking, pas de douane automatisée). Il **observe et organise** ; il ne remplace pas le
> transitaire, il permet de **le contrôler**. »
>
> « Écartés : booking en ligne, cotations de fret (le comparateur reste un outil interne),
> **tout ce qui ferait de Bonzini un transitaire**. »

Lu froidement, c'est une liste de trois choses : la cotation, la réservation, la douane.
Ce sont exactement **les trois endroits où se trouvent l'argent et le contrôle**.

Le test de PG n'est pas « faut-il tout faire ? » — la réponse est non, et exclure est
sain. Le test est : **est-ce exclu parce que c'est mauvais, ou parce que c'est effrayant ?**

**[HYPO]** Mon avis, et je peux me tromper : « observer et organiser » est le vocabulaire
d'un outil qui s'excuse d'exister. La formule « il permet de le contrôler » dit d'ailleurs
la vérité en creux — **contrôler quelqu'un, c'est déjà faire son travail à sa place**, mais
sans en assumer la position.

## 7.2 Le client en phase 2

**[FAIT]** Le tableau « pour qui » du même document classe : le fondateur/ops, le chargé de
clientèle, puis « **le client importateur (phase 2, app client)** ».

Le produit est né de l'angoisse du client, et le client est en phase 2. **[HYPO]** C'est
le signe qu'on construit d'abord l'outil qu'on sait faire (un tableau de bord interne)
plutôt que celui qui fait peur (une promesse tenue devant le client).

## 7.3 Le comparateur rangé

Traité au §3. C'est le cas le plus net : **l'actif est construit, sa valeur est écrite
noir sur blanc par son propre auteur, et il est classé « interne ».**

## Le « just y »

> **Juste montrer le prix.** Pas devenir transitaire, pas faire du booking, pas
> automatiser la douane. **Juste publier le comparateur et la médiane par ligne.**
>
> C'est une ligne de plus dans un écran. Ça ne demande aucun agrément, aucun bilan,
> aucune licence. Ça retire un interlocuteur au client (§1), ça prive le monopole de son
> asymétrie (§2), ça crée le premier effet de réseau (§3), et ça pose le standard (§4).
>
> Quatre heuristiques de PG satisfaites par une seule décision, qui consiste à **cesser de
> cacher quelque chose qui existe déjà**.

---

# 8. Ce que ce second passage ne règle pas

1. **Toujours aucun chiffre.** Le connecteur Supabase n'est pas autorisé. Combien de clients
   actifs, combien de conteneurs par mois, quelle marge : rien de tout cela n'est sous mes
   yeux. Le classement du §5 est un raisonnement sur la structure. **Il doit être refait
   avec la cohorte.**
2. **La médiane du §3 exige un nombre minimum de dossiers pour ne pas être trompeuse — et
   pour ne pas être ré-identifiable.** Trois cotations ne font pas une médiane. **[HYPO]**
   Ne rien publier sous un seuil, à fixer avec les volumes réels.
3. **Le §2 suppose que la SGS accepte une valeur transactionnelle correctement documentée.**
   C'est l'hypothèse centrale de l'attaque par le côté, et elle n'est **pas encore
   vérifiée sur un cas**. Le dossier MRSU9909331 en cours est précisément le test.
4. **Je n'ai pas testé la transformation la plus radicale** — Bonzini achetant et revendant
   la marchandise pour son compte, plutôt que d'être le rail de l'import d'autrui.
   **[PG]** dit que la tentative vaut le coup même quand elle échoue. Elle reste à faire.
