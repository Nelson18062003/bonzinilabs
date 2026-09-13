# Rendre Bonzini puissant — application de « Making Startups Powerful » (Paul Graham, septembre 2026)

> **Convention de lecture.** Trois marqueurs, pour qu'on ne confonde jamais les registres :
> **[PG]** = ce que l'article dit · **[FAIT]** = ce que le dépôt, les dossiers ou la base
> montrent · **[HYPO]** = ce que j'en déduis, et qui reste à vérifier.

---

# PARTIE I — L'article, ramené à sa structure

L'article n'est pas une liste de tactiques. C'est **une question, une contrainte, et une
quinzaine de manœuvres** qui découlent de la question.

## 1. La question

**[PG]** « Qu'est-ce qui rendrait cette entreprise plus **puissante** ? » — à préférer à
« comment gagner plus d'argent ? », qui ne produit que de l'incrémental. La question de la
puissance produit parfois des ordres de grandeur.

## 2. La contrainte, qui commande tout le reste

**[PG]** « Toutes ces stratégies […] doivent rendre les choses **meilleures pour le
client**. On ne peut pas ajouter des effets de réseau, faire passer l'argent par soi, ou
aller full stack simplement parce qu'on en a envie. Sinon, personne n'adopte. »

Et la conséquence, qui est la phrase la plus opérationnelle de l'article :

**[PG]** « À quoi ressemblerait le monde parfait, **du point de vue du client** ? S'il
existe dans ce monde une composante en laquelle la startup pourrait se transformer, elle
devrait probablement le faire. »

**[PG]** Corollaire moral : la faiblesse initiale des startups est ce qui les rend bonnes
pour le monde. Trop faibles pour imposer quoi que ce soit, elles n'ont qu'une voie —
améliorer la vie du client.

## 3. Les manœuvres, regroupées par famille

### A. Remonter le courant — « Upstream is almost always good »

C'est le fil conducteur. **[PG]** « En amont, c'est presque toujours bon : que ce soit
pour l'argent, la relation client, le stade du client, ou **la donnée**. »

| Manœuvre | Ce que dit PG |
|---|---|
| **Posséder la relation client** | Cesser d'être un fournisseur de composant enfermé dans la boîte d'un autre. |
| **Faire passer l'argent par soi** | « It's always good when money flows through you. » Note [1] : le flux de **tokens** vaut flux d'argent — vous détenez la relation, les fournisseurs de modèles deviennent des composants. Avec un risque : à quelle vitesse peuvent-ils vous avaler, vous ou vos clients ? |
| **Prendre la donnée tôt** | **Rippling** : viser le système d'exploitation de la donnée employé, donc commencer par le **onboarding**, « parce que c'est là que commence la vie de la donnée employé ». Et comme l'enjeu dépassait le marché du onboarding, leur onboarding était « bien meilleur qu'il n'avait besoin de l'être », et s'est répandu vite. |
| **Prendre le client tôt** | Note [7] : ne pas demander « quelle taille de client viser ? » mais « **à quel moment de leur vie faut-il les acquérir ?** ». Viser les grandes entreprises, c'est viser une entreprise donnée **plus tard**. Les clients n'ont pas une taille, ils ont une **trajectoire**. |

**[PG]** Sur le stade du client : Stripe s'inscrit « au premier moment possible » — en
paiements, *if it ain't broke, you don't fix it*, donc **on ne churne pas**. Et vendre à
des jeunes pousses est simple : elles décident vite, et le meilleur produit gagne. La
vente entreprise, elle, « n'est notoirement pas un domaine où le meilleur produit gagne ».

**[PG]** Plus généralement : **des clients qui décident vite vous rendent puissant**, non
pour la vitesse, mais parce qu'ils décident **sur la qualité**.

### B. S'étendre — avaler ce qui était autour

| Manœuvre | Ce que dit PG |
|---|---|
| **Full stack** | Au lieu de vendre la technologie aux entreprises qui font X, faire X soi-même, contre elles. « On voit presque l'idée s'étirer à mesure qu'elle engloutit ce qui était le client. » |
| **La variante graduelle** | Manger le client par l'intérieur en faisant **tout son travail difficile**. À la limite : « vous faites tout le travail intellectuel et ils font les courses ». Le vrai client devient **leur** client ; le client initial n'est plus qu'une **marionnette**. |
| **Généraliser pour créer un marché** | L'exemple des agents qui paient : peuvent-ils aussi **se payer entre eux** ? Alors vous êtes une place de marché. Et c'est si précieux que « si ce que les agents pourraient s'échanger n'est pas évident, cela vaut la peine d'y consacrer beaucoup de temps » — quitte à **devenir teneur de marché** pour amorcer. |

### C. Faire travailler les autres pour soi

**[PG]** **Effets de réseau** : « je le traite comme un défi — voir s'il y a moyen d'en
obtenir même là où on ne s'y attendrait pas. Il est surprenant de voir à quelle fréquence
c'est possible. » Et quand ça marche, « ce qui était un service est désormais une place de
marché ».

**[PG]** La version économique, quand il n'y a pas de voie directe : **laisser les
utilisateurs partager quelque chose**. « Par exemple : si vous optez pour, nous vous
dirons comment vous vous situez par rapport aux autres utilisateurs. »

**[PG]** **App store / extensibilité / API**. « Le summum de l'extensibilité est de
laisser appeler son produit via une **API**. Beaucoup s'y refusent par peur de perdre le
contrôle. […] **Surtout maintenant que les agents remplacent les utilisateurs humains. Qui
sait ce qu'ils voudront faire ?** Donc penchez du côté des API. Surtout quand vous êtes une
startup larvaire et n'avez rien à perdre. »

**[PG]** Note [2] : si vous ne pouvez pas créer d'app store, pouvez-vous au moins **définir
le standard** ? « Ne craignez pas d'être trop petit pour en proposer un. […] Tout le monde
a si faim de standards que le premier proposé tend à gagner, peu importe qui l'a proposé. »

### D. Être généreux — la voie contre-intuitive vers la richesse

**[PG]** Tim O'Reilly : **créer plus de valeur qu'on n'en capte**. « Beaucoup de types
d'affaires à la tête dure écarteraient ça comme de l'idéalisme hippie, mais c'est en fait
la route pour devenir vraiment riche. Presser le client jusqu'au dernier centime est une
distraction : ça rapporte 2x au maximum. Alors que découvrir une chose nouvelle à leur
faire peut facilement rapporter 10x ou 100x. »

**[PG]** L'exemple canonique : **l'open source**. On donne littéralement le produit, et ce
faisant on en fait un **standard**, on gagne la **confiance**, ça se répand — « et à la
fin on détient un petit morceau d'un gâteau beaucoup, beaucoup plus gros ».

**[PG]** Note [5] : cette vision est plus fréquente chez les fondateurs, notamment parce
que **« les fondateurs ont éprouvé la faiblesse »**. Les dirigeants recrutés tiennent la
puissance pour acquise ; les fondateurs se souviennent du temps où il fallait enchanter
l'utilisateur pour survivre.

**[PG]** **Jouer le jeu long** vous rend puissant parce que presque personne en face ne le
fait : les concurrents sont des opportunistes qui espèrent être rachetés, les grands
groupes sont dirigés par des cadres qui pensent au trimestre. Donc **les arbitrages qui ne
paient qu'à dix ans sont systématiquement sous-évalués**. Vendre aussi bas que nécessaire
au début ; prendre les utilisateurs ; s'occuper des marges ensuite. Note [4] : prudence
quand même — si vous vendez un billet de 10 pour 5, votre croissance ne vous apprend rien.

**[PG]** Et la plus forte de toutes : **aider ses utilisateurs à gagner de l'argent**.
« Peu de choses vous rendent plus puissant. » Ils adoptent vite **et** paient cher : les
revenus croissent doublement vite.

### E. Écouter les signaux qu'on n'a pas commandés

**[PG]** **Les queues qui remuent le chien.** PayPal faisait de la sécurité pour appareils
mobiles ; PayPal n'était qu'une démo. Les vendeurs eBay s'en sont emparés, et les
fondateurs ont fini par reconnaître que c'était devenu leur métier. « Donc chaque fois que
des fondateurs construisent quelque chose de périphérique au produit principal, je demande
toujours : **est-ce que ça pourrait être le vrai produit ?** »

**[PG]** **Le mésusage.** « C'est excitant de voir des utilisateurs "mal utiliser" votre
produit. Cela signifie qu'ils veulent quelque chose si désespérément qu'ils utiliseront
non seulement n'importe quelle solution, mais même des choses qui ne sont pas censées en
être. Ne soyez pas agacé : **écoutez le message**. »

### F. Ce qui vous retient

**[PG]** Les marchés **mafia** (maisons de disques, PBM) : on n'y gagne pas par le
produit. On ne les bat que **par le côté**, en les rendant hors sujet, jamais frontalement.
Note [9] : on les reconnaît à ce qu'ils sont pleins d'avocats.

**[PG]** L'heuristique générale : **« En quoi l'idée actuelle est-elle retenue par
d'autres entreprises ? »**

**[PG]** Et le plus dur : « Le plus souvent, ce sont les startups elles-mêmes qui se
retiennent. Un pourcentage surprenant de mes conseils contient le mot **"juste"**. […]
Chez les toutes jeunes startups surtout, si l'idée est compliquée, c'est **souvent la
peur**. L'entreprise se recroqueville inconsciemment en faisant moins ambitieux qu'elle ne
pourrait. *Just y*, c'est souvent, en effet, **tiens-toi droit**. Et quand elles le font,
elles sont bien plus grandes. »

---

# PARTIE II — Bonzini vu à travers la question

## 1. La queue qui remue déjà le chien

**[FAIT]** `docs/cargo/` vit **dans le dépôt de l'app de paiement**. On y trouve un
parcours de 22 modules, des dossiers conteneur par conteneur, un manuel douanier, des
outils. Le module app cargo existe déjà en base : sept tables (`cargo_shipments`,
`cargo_packages`, `cargo_costs`, `cargo_documents`, `cargo_events`, `cargo_lookups`,
`cargo_vessel_positions`), deux permissions (`canViewCargo`, `canManageCargo`), une
reconnaissance d'armateur, un cron de synchronisation.

**[FAIT]** Sur les derniers jours, le COO d'une société de paiement a passé son temps sur
un code SH, une révision SGS, un connaissement non endossé et des surestaries.

**[PG]** « Chaque fois que des fondateurs construisent quelque chose de périphérique au
produit principal, je demande : est-ce que ça pourrait être le vrai produit ? »

**[HYPO]** Ce n'est pas une distraction, c'est le signal. Cargo n'est pas un module
adjacent à Payments : **c'est la moitié manquante de la même transaction.** Un import,
c'est de l'argent qui part et de la marchandise qui vient. Bonzini a construit la première
moitié et découvre que le client vit surtout la seconde.

## 2. Ce que Bonzini possède et que personne d'autre n'a

| Actif | **[FAIT]** |
|---|---|
| **Le flux d'argent** | Dépôts, wallets, `ledger_entries`, paiements fournisseurs, paiements groupés, trésorerie avec achat/vente USDT. |
| **L'identité du fournisseur chinois** | La table `beneficiaries` — le carnet, avec l'historique des paiements. |
| **Le flux de marchandise** | Le module cargo, la reconnaissance d'armateur, le suivi par référence B/L. |
| **Une surface d'action pour agents** | **84 capacités étiquetées `@mola`**, avec permission, confirmation et résolution de références. Rare : la plupart des fintechs n'ont pas ça. |
| **Une présence physique** | Les agents cash (`scan_cash_payment`, `confirm_cash_payment`). |
| **Le savoir douanier** | Le code SH exact, l'annexe 1 du CGI, l'article 128 ter, l'accès direct à l'API CAMCIS, la structure des coûts au franc près. |

**[HYPO]** Aucun acteur du corridor Chine→Cameroun ne détient les deux flux à la fois.
La banque voit l'argent et ignore la marchandise. Le transitaire voit la marchandise et
ignore l'argent. **Bonzini est le seul point où les deux se croisent.** C'est la matière
première de tout ce qui suit.

---

# PARTIE III — Les manœuvres, par ordre de rapport puissance / coût

## Manœuvre 1 — La facture proforma comme porte d'entrée

> **[PG]** Rippling : commencer par le onboarding « parce que c'est là que commence la vie
> de la donnée employé ». Et faire ce onboarding « bien meilleur qu'il n'avait besoin de
> l'être », parce que l'enjeu est ailleurs.

**[FAIT]** Aujourd'hui l'importateur arrive dans Bonzini à l'étape **paiement**. Il saisit
un bénéficiaire. Tout ce qui précède — le fournisseur, la marchandise, le poids, le code
SH, l'incoterm — reste hors de la plateforme.

**[FAIT]** Or la vie d'un import ne commence pas au paiement, elle commence à la
**proforma**. Le dossier MRSU9909331 en fait la démonstration : la proforma
`SDLMT20260418AG01` du 18/04 contenait déjà le tracteur, le rotavator, les 1 750 kg et les
6 057,10 USD — **quatre mois** avant que le conteneur soit bloqué à Kribi.

**La manœuvre :** l'importateur dépose sa proforma. Bonzini en extrait tout, et lui rend
une chose que personne ne lui donne aujourd'hui : **le coût à quai, avant qu'il achète.**

```
Votre commande        6 057 USD  =  3 472 000 XAF
Fret réparti                        ~  645 000 XAF
Droit de douane 10 %                   347 000 XAF
TVA                                   exonérée — annexe 1 CGI, code 870190.11.0000
Manutention, BESC, timbre              210 000 XAF
─────────────────────────────────────────────────
Coût à quai Douala                   4 674 000 XAF
```

**Pourquoi c'est meilleur pour le client** — la contrainte de PG : la douleur numéro un de
l'importateur africain n'est pas le taux de change, c'est de **découvrir la facture
fiscale quand la marchandise est déjà au port**. Sur MRSU9909331, l'écart entre la
taxation actuelle et la taxation correcte approche **3,1 M XAF sur un tracteur qui en
coûte 2,5 M**. Le savoir qui produit ce chiffre existe déjà dans `docs/cargo/`.

**[PG]** « Aider ses utilisateurs à gagner de l'argent. Peu de choses vous rendent plus
puissant. » Ce n'est pas une commodité : c'est de l'argent rendu à l'importateur, commande
par commande.

**Pourquoi c'est la manœuvre numéro un :** elle est **en amont** des trois autres amonts de
PG à la fois — la donnée, la relation, et l'argent — et elle **conditionne** les manœuvres
2 et 4, qui sont impossibles sans elle.

**Ce que ça coûte :** l'extraction de proforma est un problème résolu. Le calcul du coût à
quai est déjà écrit, en français, dans les modules 5, 6 et 7.

**→ Spécification détaillée : [`manoeuvre-1_proforma-cout-a-quai.md`](manoeuvre-1_proforma-cout-a-quai.md).**

**Ce qui peut mal tourner :** annoncer un coût à quai, c'est s'engager. Un chiffre faux
est pire qu'aucun chiffre. Il faut afficher les fourchettes et la provenance de chaque
ligne — ce que les modules font déjà.

---

## Manœuvre 2 — Libérer les fonds contre une preuve d'embarquement vérifiée

> **[PG]** Full stack : « on voit presque l'idée s'étirer à mesure qu'elle engloutit ce
> qui était le client ». Et : à quoi ressemble le monde parfait vu du client ?

**[FAIT]** Aujourd'hui : l'importateur paie, puis espère. Le risque est entièrement de son
côté. Sur MRSU9909331, **quatre sociétés chinoises différentes** apparaissent sur un seul
conteneur (Shandong Limaotong, Shenzhen Boxin, YSH Group, High Goal) et le numéro de
facture ne correspond pas au vendeur déclaré.

**La manœuvre :** l'argent quitte le wallet **quand le connaissement existe** — vérifié
non pas sur une capture d'écran du fournisseur, mais **contre l'API de l'armateur**, que
Bonzini interroge déjà (`Suivre une référence`, reconnaissance d'armateur, cron de
synchronisation).

**Pourquoi personne d'autre ne peut le faire :** une banque tient l'argent et ne sait pas
lire un B/L. Un transitaire lit le B/L et ne tient pas l'argent. **Il faut les deux
moitiés.** C'est exactement la position que Bonzini occupe seul, et c'est la raison
stratégique de garder les deux produits dans la même société.

**Pourquoi c'est meilleur pour le client :** c'est du crédit documentaire — le mécanisme
que les grands importateurs obtiennent de leur banque et que les petits n'obtiennent
jamais. Bonzini le rendrait accessible à quelqu'un qui fait sa première commande.

**Ce qui peut mal tourner :** le fournisseur chinois refusera l'escrow s'il ne connaît pas
Bonzini — c'est un changement de rapport de force. **[HYPO]** À démarrer en option, pas en
défaut, et probablement sur les nouveaux fournisseurs seulement, là où la peur est réelle.

---

## Manœuvre 3 — Faire passer *tout* l'argent du commerce, pas seulement celui du fournisseur

> **[PG]** « Is there a way to make the money flow through it? It's always good when money
> flows through you. »

**[FAIT]** Sur ECMU5839181, le total réconcilié au franc près est **2 084 072 XAF** de
frais — fret, terminal, surestaries, douane, manutention. **Zéro** de cette somme n'est
passé par Bonzini. Bonzini n'a porté que le paiement fournisseur.

**[FAIT]** Et pourtant : `docs/cargo/dossiers/2026-07_paiement-douane-Kribi` existe.
**Bonzini a déjà payé une douane.** C'est encore une queue qui remue.

**La manœuvre :** un solde, et depuis ce solde tout ce qu'un import exige — le
fournisseur, le fret, les droits, le déclarant, le transporteur final, les surestaries
Maersk.

**Pourquoi c'est meilleur pour le client :** aujourd'hui il jongle avec cinq canaux —
virement au fournisseur, espèces au déclarant, mobile money au camionneur, facture
armateur par carte. Un seul solde qui paie tout est **strictement** meilleur, et donne
enfin le coût réel du dossier — que le module « Coûts du dossier » est déjà prévu pour
afficher.

**Effet secondaire décisif :** le coût à quai de la manœuvre 1 cesse d'être une estimation.
Bonzini l'a **payé**. Chaque dossier réglé rend la prévision suivante plus juste, sur un
corridor où personne d'autre ne dispose de la série.

---

## Manœuvre 4 — Le groupage, ou l'effet de réseau là où on ne l'attend pas

> **[PG]** « Je le traite comme un défi — voir s'il y a moyen d'obtenir des effets de
> réseau même là où on ne s'y attendrait pas. » Et : quitte à **devenir teneur de marché**
> pour amorcer.

Un paiement est une relation à deux : aucun réseau. C'est la faiblesse structurelle du
produit actuel. Mais :

**[FAIT]** Un 40' fait **68 m³**. La plupart des importateurs en ont 5 à 15. La table
`cargo_packages`, créée le 12/09/2026, porte déjà les dimensions au centimètre, le poids
au colis, le drapeau `stackable`, le `supplier` et une **position déterministe pour un
plan de chargement**. Le module 4 traite l'empotage et le CTU Code ; le module 6 établit
la densité d'équilibre à **421,9 kg/m³**.

**La manœuvre :** avec les proformas de la manœuvre 1, Bonzini sait avant tout le monde
que le client A a 12 m³ au départ de Guangzhou dans quinze jours, le client B 8 m³ de
Foshan, le client C 20 m³ de Shenzhen. **Bonzini remplit le conteneur.**

**C'est un vrai effet de réseau,** au sens strict : chaque importateur qui rejoint la
plateforme fait baisser le coût et le délai de tous les autres, parce que les boîtes se
remplissent plus vite. Un service devient une place de marché — la transformation exacte
que PG décrit.

**Pourquoi c'est meilleur pour le client :** le module 5 chiffre le cycle réel à
**84 jours** contre 57 atteignables, et la rotation à 4,35 tours par an contre 6,40, soit
**+47 % de capital qui travaille**. Un petit importateur ne subit plus le tarif LCL d'un
groupeur ni l'attente qu'une boîte se remplisse à l'aveugle.

**[PG] Le rôle de teneur de marché :** au début les deux côtés ne s'équilibrent pas.
Bonzini réserve la boîte et **porte le risque de l'espace vide**, le temps que la liquidité
vienne. PG dit explicitement que ça vaut le coup.

**Ce qui peut mal tourner :** c'est la manœuvre qui consomme du bilan. Une boîte à moitié
vide se paie comptant. **[HYPO]** À n'ouvrir qu'une fois que le flux de proformas montre
qu'il y a assez de volume pour remplir régulièrement — la manœuvre 1 est le capteur qui
dit quand.

---

## Manœuvre 5 — Donner le savoir

> **[PG]** L'open source : « ils donnent littéralement le produit, mais ce faisant ils en
> font un standard et le rendent digne de confiance. […] À la fin ils détiennent un petit
> morceau d'un gâteau beaucoup, beaucoup plus gros. » Et O'Reilly : créer plus de valeur
> qu'on n'en capte.

**[FAIT]** Il existe déjà, dans le dépôt, un manuel du commerce Chine→Cameroun que
personne d'autre ne possède : 22 modules, le CTU Code appliqué, la reconstitution des
surestaries au franc, la cascade des droits de port (× 1,2930), les Incoterms confrontés au
code CEMAC, la fiche sur les exonérations avec l'article 128 ter cité verbatim, et le code
SH exact d'un tracteur agricole vérifié dans CAMCIS.

**La manœuvre :** le publier. Gratuitement, sans mur, en français.

**Pourquoi ça rend puissant :**
1. **[PG]** Ça acquiert exactement le client de la manœuvre 6 — le primo-importateur, qui
   cherche « comment importer de Chine au Cameroun » avant même de savoir qu'il a besoin
   d'un prestataire de paiement.
2. Ça fait de Bonzini l'**autorité** du corridor. Note [2] : « tout le monde a si faim de
   standards que le premier proposé tend à gagner ».
3. **[PG]** « Presser le client rapporte 2x au maximum. Découvrir une chose nouvelle à
   lui faire rapporte 10x ou 100x. » Ce manuel est déjà écrit. Le coût marginal de le
   donner est proche de zéro ; la confiance qu'il achète ne s'achète pas autrement.

**Ce qui peut mal tourner :** les dossiers contiennent des données d'entreprise — NIU,
RCCM, comptes bancaires, montants, noms de partenaires. Le dépôt porte d'ailleurs cet
avertissement. **On publie les modules, jamais les dossiers.**

---

## Manœuvre 6 — Prendre le client au premier import, pas au dixième

> **[PG]** Note [7] : « À quel moment de leur vie faut-il acquérir les clients ? […] Les
> clients n'ont pas une taille, ils ont une trajectoire. » Et : en paiements, on ne churne
> pas.

**[HYPO]** L'équivalent Bonzini du « vendre aux startups » de Stripe, c'est le
**primo-importateur** : celui qui fait sa première commande de 10 000 USD. Il n'a ni
transitaire, ni déclarant, ni ligne bancaire, ni savoir. Il décide seul et vite. Et
l'importateur de 10 000 USD d'aujourd'hui est celui de 500 000 dans cinq ans.

L'importateur établi, lui, a déjà son transitaire, sa banque, ses habitudes : *if it ain't
broke*. C'est une vente lente où le meilleur produit ne gagne pas.

**La conséquence produit :** l'onboarding doit fonctionner pour quelqu'un qui n'a **jamais**
importé. C'est l'inverse de ce que font les plateformes de commerce international, qui
supposent toutes qu'on connaît déjà les incoterms.

**Ce que ça relie :** la manœuvre 5 les attire, la manœuvre 1 les rassure, la manœuvre 2
les protège. Les trois ne visent qu'eux.

---

## Manœuvre 7 — Ouvrir Mola vers l'extérieur

> **[PG]** « Le summum de l'extensibilité est de laisser appeler son produit via une API.
> […] Surtout maintenant que les agents remplacent les utilisateurs humains. Qui sait ce
> qu'ils voudront faire ? Penchez du côté des API. Surtout quand vous êtes une startup
> larvaire et n'avez rien à perdre. » Note [1] : le flux de tokens vaut flux d'argent.

**[FAIT]** Bonzini a déjà fait le travail difficile : **84 capacités étiquetées**, avec
permission, confirmation, danger et résolution de références. `CLAUDE.md` en fait une règle
non négociable pour toute nouvelle RPC. C'est une API pour agents qui s'ignore — elle ne
sert aujourd'hui que le personnel interne.

**La manœuvre :** la même surface, ouverte à l'agent **du client**, puis à des tiers.
« Paie mon fournisseur de Guangzhou quand le B/L sort » devient une phrase qu'un agent
exécute.

**[PG] Le risque, que PG nomme lui-même** en note [1] : quand le flux passe par vous, la
question devient « à quelle vitesse peuvent-ils vous avaler, vous ou vos clients ? ».
**[HYPO]** Ce qui protège Bonzini ici n'est pas le logiciel, c'est ce qu'un modèle ne peut
pas répliquer : les agents cash, la licence, le compte de trésorerie, la relation avec le
déclarant, la connaissance de CAMCIS.

**Coût :** faible. Le plus dur est fait.

---

## Manœuvre 8 — Le fournisseur chinois comme second côté du marché

> **[PG]** « Si je parlais à une startup construisant un moyen pour des agents de payer,
> ma première question serait : les agents peuvent-ils aussi **se payer entre eux** ? »

**[FAIT]** Aujourd'hui le fournisseur chinois est un **enregistrement passif** : une ligne
dans `beneficiaries`, un RIB. Il reçoit et ne touche jamais la plateforme.

**[FAIT]** Or c'est précisément lui qui détient ce qui manque : le message WeChat rédigé
pour le partenaire réclame connaissements, déclarations d'export, certificats
d'emballage, BESC, preuves de paiement — parce que **rien de tout cela n'est dans le
système**.

**La manœuvre, en deux temps.**
*Un :* donner un accès au fournisseur pour qu'il dépose lui-même la proforma, le B/L, la
packing list. Sa contrepartie : voir que l'argent est là, et être payé plus vite.
*Deux :* de ce dépôt naît un **registre de réputation**. « Ce fournisseur a reçu 47
paiements de 12 importateurs camerounais depuis trois ans, tous livrés. »

**Pourquoi c'est meilleur pour les deux côtés :** l'importateur voit sa peur numéro un —
la fraude fournisseur — traitée par de la preuve. Le fournisseur y gagne des acheteurs.

**[PG] La méthode exacte pour désamorcer l'objection :** « si vous optez pour, nous vous
dirons comment vous vous situez par rapport aux autres ». Un importateur ne veut pas
révéler ses fournisseurs — c'est son avantage. Donc **opt-in, et agrégé** : on ne montre
jamais qui achète, seulement que le fournisseur tient.

**[HYPO]** C'est la manœuvre la plus lointaine et la plus risquée. Elle ne devient possible
qu'une fois qu'il y a assez de volume pour que la réputation ait un sens.

---

# PARTIE IV — Ce qui retient Bonzini

> **[PG]** « En quoi l'idée actuelle est-elle retenue par d'autres entreprises ? »

**[FAIT]** Les dossiers sont un catalogue de cette question :

| Qui retient | La preuve, tirée des dossiers |
|---|---|
| **Le déclarant** | Rapport de visite n° 385 du 04/09 non transmis pendant huit jours. La DI porte « DOUALA PORT » alors que la marchandise est à Kribi. |
| **La SGS** | Valeur triplée en méthode 6.4 au motif « LA FACTURE NON SOUMISE », « USED » sur une machine neuve, numéro de facture dans le champ châssis — depuis un bureau de **Barcelone**. |
| **Le partenaire chinois** | **HIGH GOAL LOGISTICS détient le connaissement.** Bonzini paie les surestaries sans détenir le titre. |
| **L'armateur** | 83 126 XAF échus au 25/08, et le compteur qui court. |

**[PG] La réponse de l'article n'est pas l'attaque frontale, c'est la variante graduelle
du full stack :** manger le client par l'intérieur en faisant tout son travail difficile,
jusqu'à ce que « vous fassiez tout le travail intellectuel et qu'ils fassent les courses ».

**[FAIT]** C'est déjà ce qui se passe. Cette semaine, Bonzini a établi le code SH que le
déclarant n'a pas trouvé, lu l'article 128 ter que personne n'a cité, et interrogé
l'API CAMCIS directement.

**[HYPO]** Le document de conception dit « il ne remplace pas le transitaire, il permet de
le contrôler ». C'est un bon garde-fou contre un full stack prématuré — mais PG offre la
réconciliation : on ne devient pas transitaire, **on lui retire progressivement le travail
intellectuel**, jusqu'à ce qu'il ne soit plus qu'une signature. La marionnette de PG.

## Et là où Bonzini se retient tout seul

> **[PG]** « L'entreprise se recroqueville inconsciemment en faisant moins ambitieux
> qu'elle ne pourrait. *Just y*, c'est souvent : tiens-toi droit. »

Trois endroits où la question mérite d'être posée, sans que j'aie la réponse :

1. **[FAIT]** Le plafond de saisie est à **50 M XAF** alors qu'un dépôt réel de
   **133 500 000 XAF** existe en base. Les règles de sécurité l'assument comme garde-fou de
   saisie, et c'est légitime. Mais l'écart dit quelque chose de l'image que le produit a de
   lui-même par rapport à ce qu'il fait déjà.
2. **[FAIT]** La liste « écartés » du module cargo exclut le booking et la cotation. Bon
   arbitrage de v1. À rouvrir une fois par an, en se demandant si c'est du **focus** ou de
   la **peur**.
3. **[FAIT]** `trump_posts`, `macro_snapshots`, `rate_predictions`, `rate_suggestions` —
   Bonzini modélise le change. **[PG]** « Est-ce que ça pourrait être le vrai produit ? »
   Je ne le crois pas, mais la question mérite d'être posée une fois, sérieusement, plutôt
   que jamais.

---

> ⚠️ **Révisé.** Un second passage sur l'article corrige l'ordre ci-dessous et ajoute
> deux manœuvres (le benchmark opt-in, et le standard du dossier d'import) :
> [`2026-09_pg-second-passage.md`](2026-09_pg-second-passage.md).

# PARTIE V — L'ordre que je propose

Le critère n'est pas la valeur, c'est **ce qui débloque le reste**.

| # | Manœuvre | Pourquoi maintenant | Dépend de |
|---|---|---|---|
| **1** | **La proforma comme entrée + le coût à quai** | En amont de tout. Capteur du volume nécessaire au reste. Le savoir est déjà écrit. | — |
| **2** | **Publier le manuel** | Coût marginal nul, contenu déjà écrit, amène le primo-importateur. | — |
| **3** | **Payer tout le dossier** | Transforme l'estimation en série mesurée. | 1 |
| **4** | **Libérer contre B/L vérifié** | Le seul avantage que la structure à deux flux rend possible. | 1, 3 |
| **5** | **Le groupage** | Le seul vrai effet de réseau. Consomme du bilan. | 1, et du volume |
| **6** | **Ouvrir Mola** | Presque gratuit ; à faire dès qu'il y a un client qui le demande. | — |
| **7** | **Le fournisseur comme second côté** | La plus grosse, la plus lointaine. | 1, 5 |

Les deux premières se font **sans une ligne de code nouvelle sur le cœur du produit**.

---

# PARTIE VI — Où je pense que l'article s'applique mal, et où je peux me tromper

Par honnêteté, et parce que reprendre un texte sans le contester n'est pas le lire.

1. **PG écrit pour un marché à terrain plat.** Son argument « les startups font le meilleur
   produit, donc elles gagnent quand les clients décident vite » suppose que le meilleur
   produit puisse gagner. Le corridor Chine→Cameroun ne remplit pas cette condition
   partout : la douane, les agréments, les licences de transfert ne sont pas des marchés.
   **[PG]** appelle ça les marchés **mafia**, qu'on ne bat « que par le côté ». La
   généralisation à retenir : ne jamais faire dépendre le succès de Bonzini d'un combat
   frontal avec une administration ou un agrément.

2. **« Vendre aussi bas que nécessaire au début » se transpose mal à une activité
   régulée.** PG met lui-même le garde-fou en note [4]. Ici, la marge est un spread de
   change adossé à une trésorerie qui porte un risque réel. Brader le spread, ce n'est pas
   subventionner l'acquisition, c'est prendre une position. Le prix bas doit se faire sur
   les **frais** de cargo, pas sur le change.

3. **Le flux de tokens et le flux d'argent ne se ressemblent qu'en apparence.** Un flux de
   tokens n'est pas régulé ; un flux d'argent transfrontalier l'est. C'est un coût — et
   c'est aussi la douve. La note [1] de PG demande « à quelle vitesse peuvent-ils vous
   avaler ? ». Pour Bonzini, la réponse tient à la licence et aux agents cash, pas au code.

4. **Ce que je ne sais pas.** Je n'ai pas vu les volumes, le nombre de clients actifs, la
   marge par opération, ni le coût d'acquisition. Tout ce classement est un raisonnement
   sur la **structure**, pas sur les chiffres. Un ordre de priorité sérieux se fait avec
   la cohorte sous les yeux — et je peux la sortir de la base quand tu veux.

---

## Source

Paul Graham, *Making Startups Powerful*, septembre 2026 — texte intégral fourni par
Nelson Soh le 13/09/2026. Les passages entre guillemets sont traduits de l'anglais ;
les formules décisives sont conservées en anglais entre parenthèses lorsque la traduction
en affaiblit le sens.
