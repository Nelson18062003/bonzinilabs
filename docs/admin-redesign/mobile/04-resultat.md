# Admin mobile — 04 · Résultat de la passe du 13/09/2026

Mêmes 21 écrans, même harnais (`tools/audit-mobile.mjs`, 390 × 844, fixtures),
avant → après. « Textes < 14 px » compte les nœuds de texte visibles sous la
plus petite taille du kit ; « ronds » les boutons à rayon ≥ 20 px ; « cibles »
les contrôles dont un côté fait moins de 40 px.

| Écran | textes < 14 px | boutons ronds | cibles < 40 | ombres | flou |
|---|---|---|---|---|---|
| `/m` | 48 → **6** | 1 → **2** | 1 → **7** | 11 → **1** | 1 → **0** |
| `/m/deposits` | 51 → **6** | 14 → **2** | 5 → **7** | 14 → **1** | 1 → **0** |
| `/m/deposits/d5` | 37 → **15** | 11 → **2** | 13 → **11** | 7 → **3** | 0 → **0** |
| `/m/deposits/new` | 15 → **15** | 9 → **9** | 1 → **1** | 11 → **2** | 0 → **0** |
| `/m/payments` | 47 → **6** | 17 → **2** | 5 → **7** | 15 → **1** | 1 → **0** |
| `/m/payments/p3` | 35 → **26** | 7 → **6** | 8 → **8** | 13 → **8** | 1 → **0** |
| `/m/payments/new` | 22 → **22** | 10 → **9** | 1 → **1** | 11 → **1** | 0 → **0** |
| `/m/clients` | 49 → **6** | 15 → **2** | 6 → **6** | 11 → **1** | 2 → **0** |
| `/m/clients/u5` | 19 → **0** | 4 → **2** | 2 → **2** | 6 → **1** | 1 → **0** |
| `/m/assistant` | 1 → **6** | 4 → **3** | 0 → **0** | 7 → **1** | 0 → **0** |
| `/m/more` | 30 → **22** | 2 → **2** | 2 → **2** | 9 → **1** | 2 → **0** |
| `/m/more/rates` | 77 → **73** | 20 → **18** | 18 → **14** | 16 → **1** | 2 → **0** |
| `/m/dashboard` | 172 → **170** | 1 → **1** | 25 → **25** | 16 → **1** | 1 → **0** |
| `/m/cargo` | 33 → **6** | 4 → **3** | 1 → **5** | 7 → **1** | 2 → **0** |
| `/m/cargo/map` | 23 → **7** | 2 → **2** | 18 → **11** | 13 → **7** | 2 → **1** |
| `/m/cargo/track` | 20 → **0** | 2 → **2** | 4 → **0** | 4 → **1** | 1 → **0** |
| `/m/cargo/2` | 76 → **68** | 2 → **2** | 20 → **18** | 17 → **9** | 1 → **0** |
| `/m/cargo/2/suivi` | 47 → **39** | 2 → **2** | 12 → **10** | 12 → **4** | 1 → **0** |
| `/m/cargo/2/chargement` | 45 → **32** | 2 → **2** | 21 → **19** | 14 → **6** | 1 → **0** |
| `/m/cargo/2/documents` | 46 → **38** | 2 → **2** | 19 → **17** | 12 → **4** | 1 → **0** |
| `/m/cargo/2/couts` | 21 → **13** | 2 → **2** | 13 → **11** | 12 → **4** | 1 → **0** |

## Ce qui a changé

- **Fondations** — `src/mobile/designKit` réécrit aux valeurs Figma (canvas
  blanc, cartes r 8 à filet `#D9D9D9`, primaire `#2C2C2C` h 40, Neutral /
  Subtle / Danger, tags 14/600, champs h 40, feuille basse r 16). Les 73
  écrans ont basculé d'un coup ; les colonnes « ronds » et « flou » tombent
  à zéro là où le kit est seul à décider.
- **Navigation** — barre plate à cinq entrées : Mola · Cargo · Opérations ·
  Clients · Plus. `/m` redirige vers Opérations ; Mola garde la barre.
- **Opérations** — Dépôts et Paiements dans un écran, Tag Toggle + feuille
  `+` (dépôt, paiement, groupé, export PDF). Plus de tuiles KPI à 9 px, plus
  de boutons flottants de couleur de module, les noms ne tronquent plus.
- **Cargo** — quatre vrais écrans mobiles : flotte triée par gravité avec la
  prochaine action, Suivre en une colonne, dossier à en-tête de 120 px et
  huit chips atteignables, carte plein écran avec feuille par navire. La
  scène 3D se mesure (plus de 660 px en dur), les jauges passent au-dessus,
  les lots s'empilent sous `lg`, les jalons du parcours ne se chevauchent plus.

## Ce qui reste (même kit, écran par écran)

Les écrans dont le compte « textes < 14 px » reste élevé sont ceux qui
portent encore leurs tailles en dur : **Analytics** (170), **Taux** (73), les
**sections du dossier Cargo** (composants partagés avec le desktop, en
`.admin-theme`), **Plus** (22) et les **détails** dépôt / paiement. Ils ont
pris la palette, les rayons et les boutons du kit ; leur typographie est la
prochaine passe.

## Passe 2 (même jour) — le reste de l'app

Deux codemods (`scratchpad/codemod*.py`, reproductibles) ont remplacé dans
**71 fichiers** les utilitaires codés en dur par leurs équivalents du kit :
couleurs lilas et couleurs de module (`#8B5CF6`, `#10B981`, `#6B5BD2`…) →
encre `#2C2C2C` ; tons (`#DEEFE5/#2E7D52`…) → Tag Secondary ; couleurs
Tailwind nommées (`red-600`, `emerald-700`, `violet-500/10`…) → tons du kit ;
rayons 14–26 px et `rounded-full` sur les pilules → 8 ; toute taille
< 14 px → 14 ; libellés `uppercase tracking-wider` → 14/600 encre ; paires
`PRIMARY_PILL : SOFT_PILL` sur les filtres → Tag Toggle. 2 441 remplacements,
type-check et tests verts.

Après cette passe, sur les 15 écrans re-capturés, « textes < 14 px » tombe à
0–9 partout sauf Analytics (131 — les libellés de graphiques Recharts) ; les
formulaires Nouveau dépôt / Nouveau paiement / Paiement groupé sont à 0.

Volontairement conservés : les logos et couleurs **de marque** des méthodes
(Alipay, WeChat, Orange, MTN, Wave, banque), les couleurs d'identité des
devises en Trésorerie (XAF / USDT / CNY), et l'écran de connexion (composants
partagés avec l'app client, dont la charte est verrouillée).

## Passe 3 — les composants partagés avec le desktop

Les sections du dossier Cargo (`src/components/cargo/**`) et les briques
Analytics (`src/components/analytics/**`) servent aux deux apps. Plutôt que
de les dupliquer, chaque taille sous 14 px reçoit un `max-lg:` qui la monte
à l'échelle du kit sur mobile seulement (14 minimum, 16 pour les valeurs) ;
les libellés en majuscules espacées redeviennent 14/600 sans majuscules
sous `lg`. Les axes Recharts d'Analytics passent à 14. Le desktop est
re-capturé à 1440 px : inchangé. Exception assumée : les cinq escales du
parcours (`CargoJourney`) restent à 12 px, une rangée de cinq colonnes sur
390 px ne tient pas 14.

Après cette passe, les onglets Suivi, Documents, Douane et Coûts du dossier
sont à **0 texte sous 14 px** ; Aperçu à 7 (les escales).

## Passe 4 — Cargo, l'ordre des sections pensé pour le pouce

Sur mobile, les deux colonnes du dossier s'effacent (`max-lg:contents`) et
chaque section prend son rang :
- **Aperçu** : À faire avant l'arrivée → Où est-il → Parcours → Argent →
  Marchandise → Sur la carte (la carte, décorative, ferme la page).
- **Chargement** : Le remplissage → Dans la boîte (3D) → Les lots → Ce qui
  ne colle pas → À quoi ça sert.

L'onglet Cargo de la barre du bas porte un badge = nombre de conteneurs
« en retard » (`alertTally`). Dans le dossier, Rafraîchir devient une icône
de 36 px (`DossierActions compact`). La barre de la 3D passe à 14 px / 32 px
sous 640 px. Desktop re-capturé : inchangé.

## Passe 5 — Cargo pour la vraie cible (voir `05-simplicite.md`)

Retour fondateur : trop complexe, trop pâle, trop petit, du texte coupé.
Réponse : `src/lib/cargo/plain.ts` (16 tests) écrit l'état d'un conteneur
en phrases — « Arrive à Kribi le 11 octobre, dans 28 jours », « Retard de
14 jours sur la date promise », « Fret 6 550 $, pas encore payé. Télex pas
encore reçu. », « 5 pièces manquantes sur 5 ». Le sourd passe à `#5A5A5A`,
rien sous 16 px sur les écrans Cargo, plus aucun `truncate` dans les listes.

- **Flotte** : quatre lignes par conteneur (client + état, arrivée, retard,
  la prochaine chose à faire). Le numéro de boîte attend dans le dossier.
- **Dossier** : une phrase en en-tête, puis onze sections repliées en
  français (À faire · Où est le conteneur · Le trajet · L'argent · Les
  papiers · La douane et l'arrivée · Ce qu'il y a dedans · Le chargement en
  3D · Le client · Les coûts · Les notes), chacune avec un sous-titre qui
  dit l'essentiel sans l'ouvrir. Une ouverte à la fois, l'adresse suit.
- **Suivre** : le résultat en trois lignes et le bouton « Ajouter à ma
  flotte » ; le détail (ports, jalons) replié dessous.
- **Carte** : la feuille du navire dit « Arrive à Kribi le 11 octobre ».

## Passe 6 — Opérations et Clients, même méthode

Le kit lui-même monte à 16 px là où la cible lit : chips et segmenté à
40 px / 16 px, tags de statut à 16, lignes de liste et champs à 16.
`src/lib/plainTime.ts` dit « il y a 11 heures », « hier », « le 6
septembre ». Une ligne de dépôt ou de paiement, c'est désormais : le
client (20/600) et son état, « 2 400 000 XAF par Virement », « Il y a 11
heures · 1 preuve » (en rouge quand ça attend trop). Le point SLA de 6 px
et la référence BZ-DP-… quittent la liste (ils sont dans le détail, et la
recherche par référence marche toujours). Un client : le nom et son état,
« Solde : 310 000 XAF », le téléphone. Les totaux dépôts / paiements
quittent la liste. Sur les 578 tests et les 21 écrans, rien ne casse.

## Passe 7 — « Les papiers » et « La douane » en phrases

Les deux sections du dossier qui ouvraient encore les composants desktop
ont leur version mobile (`MobilePapiers.tsx`, `MobileDouane.tsx`) :
- chaque pièce dit ce qu'elle est, qui la fait et pourquoi on ne peut pas
  s'en passer (« C'est la preuve que le fret est payé. L'armateur l'envoie
  après paiement ; sans lui, le conteneur reste au port. ») ; « Ajouter le
  télex » ouvre directement l'appareil photo ou les fichiers, sans dialogue ;
  une pièce reçue montre la date et s'ouvre d'un tap ; « Retirer » demande
  confirmation ;
- chaque étape camerounaise dit ce qu'elle veut dire ; « C'est fait
  aujourd'hui » suffit dans la plupart des cas, « Un autre jour » ouvre une
  date ; la franchise est dite en ambre puis en rouge, avec le nombre de
  jours ; les numéros de BESC et de déclaration se lisent en phrase et se
  saisissent dessous.
Les deux sections sont à 0 texte sous 14 px et 2 cibles sous 40 px.

## Passe 8 — Les trois fiches du quotidien en phrases

Le dépôt, le paiement et le client sont les écrans qu'on ouvre cinquante
fois par jour ; ils suivent maintenant la même structure que le dossier
cargo, dans cet ordre : **combien · qui · comment · quand** en une phrase,
puis **la preuve** (ou la signature, pour le cash), puis **la décision**,
puis **le détail** replié (référence, banque, dates, notes) et, pour le
dépôt, **le suivi** replié.

- **Dépôt** : « 850 000 XAF — Envoyé par Fatou Ndiaye via Orange Money –
  Transfert, il y a 3 jours. » Si ça attend trop : « Ce dépôt attend depuis
  plus de 8 heures. Il faut le traiter. » La preuve se lit en entier
  (`object-contain`), avec « Envoyée par le client il y a 3 jours » et
  quatre boutons à 40 px. Un seul bouton primaire : « Commencer la
  vérification » quand la preuve vient d'arriver, sinon « Valider le
  dépôt » ; « Refuser le dépôt » en rouge discret. Le titre de l'en-tête
  est « Dépôt », la référence est dans le détail.
- **Paiement** : « ¥ 16 718 — Demandé par Fatou Ndiaye, via Alipay, il y a
  15 heures. Soit 1 450 000 XAF, au taux de 1 million XAF = ¥11 530. » Les
  coordonnées du bénéficiaire sont des lignes étiquette / valeur à 16 px,
  un appui copie. Le cash dit « Li Wei, une autre personne que le client,
  joignable au … » puis « La personne qui reçoit le cash doit signer avant
  la remise des fonds » et un bouton « Faire signer ». La fiche paiement
  n'affiche plus la barre d'onglets, comme la fiche dépôt.
- **Client** : le nom, l'entreprise, puis « Téléphone : … », « Email : … »,
  « Client depuis le 6 mai 2025 » ; « L'argent » : le solde, « Dernier
  mouvement il y a 15 heures », « Au total, ce client a déposé … et payé
  … », « Ajouter de l'argent » / « Retirer de l'argent » ; « Les gestes » :
  six lignes de 64 px avec une phrase d'explication chacune (« Le client a
  versé de l'argent. », « Les fournisseurs qu'il paie. », « Définitif :
  tout son historique disparaît. »). Les deux tuiles de totaux disparaissent.

`Line` (une phrase, tonée si besoin) et `Fold` (une section repliée)
entrent dans le kit. Les trois fiches sont à 0 texte sous 14 px. Le harnais
a désormais des fixtures pour les dépôts, les paiements et les clients
(`src/__screenshot__/mock*.ts`, actives seulement avec `SCREENSHOT_MOCK=1`).

## Passe 9 — Le dossier cargo finit ses phrases

Les trois dernières sections qui ouvraient les composants desktop dans un
`admin-theme` ont leur version mobile :
- **Les coûts** : « En tout : 535 000 XAF, dont 85 000 XAF déjà payés. Il
  reste 450 000 XAF à payer. », le devis du transitaire tel que noté dans
  « L'argent » (on dit d'où vient chaque chiffre plutôt que de laisser deux
  sources se contredire), puis une ligne par coût avec « C'est payé » et
  « Retirer » (confirmé). L'ajout se fait en cinq questions dans une feuille
  basse : c'est quoi, combien, quelle monnaie, quel jour, quelle facture.
- **Le client** : « Le dossier est au nom de « GAUSS », le nom donné par le
  transitaire. » et un bouton « Rattacher à un client » ; rattaché, la
  fiche se lit en phrases (téléphone à appeler, email, ville, identité
  vérifiée ou non) et s'ouvre d'un geste. Ses autres conteneurs dessous.
- **Les notes** : la note interne à 16 px qui s'enregistre en quittant le
  champ, puis « Dossier ouvert le 11 sept. 20:00 », « Le suivi vient de
  Maersk, mis à jour automatiquement, la dernière fois il y a 2 jours ».
Seule « Le chargement en 3D » reste partagée avec le desktop (elle se
mesure déjà). Les trois sections sont à 0 texte sous 14 px.

## Passe 10 — L'historique, le carnet, la barre du bas

- **Historique d'un client** : « Fatou Ndiaye, solde aujourd'hui :
  1 240 000 XAF. », des filtres à 40 px (Tout · Dépôts · Paiements · Ajouts ·
  Retraits), puis une écriture = le montant en 20/600 et en couleur foncée
  (vert entrée, ambre réservé, rouge sortie), « Paiement réservé, il y a 16
  heures. », la description entière, « Solde après : 1 240 000 XAF. ». Plus
  de cartes, plus de `line-clamp`.
- **Bénéficiaires d'un client** : « Les fournisseurs que Fatou Ndiaye paie :
  3 bénéficiaires. », puis par ligne le surnom en 18/600, le vrai nom, et
  « Par Virement à Bank of China, compte 6214 8888 1234 5678. » ; modifier
  et retirer sont deux boutons ronds de 44 px. Retirer explique : « Hongfa
  ne sera plus proposé pour les prochains paiements. »
- **Barre du bas** : étiquettes à 14 px (elles tenaient à 12 en gris pâle),
  gris `#5A5A5A`, icônes 24, badges 20 px.
Fixtures ajoutées pour le carnet (`mockBeneficiaries.ts`).
- **Finition après audit global** : le trajet (étiquettes de ports 16 px,
  dates 14 px), la barre de la 3D (boutons 40 px, texte 16 px, légendes
  et jauges 16 px), les boutons du dossier (Rafraîchir, Plus d'actions,
  Retirer un lot : 44 px), les boutons Retour des fiches (44 px), les
  actions de section (« Ajouter », « Historique » : 40 px, 16 px). L'écran
  Plus montre la langue et le thème comme des choix visibles (chips et
  segmenté) au lieu d'un bouton qui tourne. Il ne reste sous 14 px que
  les badges de la barre du bas (12 px) et le curseur de la 3D.
- **Nouveau dépôt / nouveau paiement** : tout le texte des cinq étapes
  passe à 16 px et plus rien n'est tronqué (vérifié étape par étape avec un
  parcours Playwright : client, montant, moyen, type, récapitulatif).
- **Tableau de bord** : l'en-tête s'empile (titre, phrase, puis la période
  et Rafraîchir à 44 px), les cartes d'indicateurs ne coupent plus leur
  titre, les boutons « i » font 40 px, les sections 48 px, Exporter et la
  granularité 40 px. Les composants analytics restent partagés avec le
  desktop (classes `max-lg:` uniquement).


## État au 13 septembre, soir — audit des 21 écrans

Textes sous 14 px et cibles sous 40 px par écran (`tools/audit-mobile.mjs`,
fixtures, 390 × 844). Les « 2 » des listes sont les deux badges rouges de
la barre du bas (12 px) ; les 11 cibles de la carte sont les points des
navires et des ports (la feuille du navire s'ouvre au toucher du point ou
de son étiquette) ; la cible restante des fiches est un lien dans une
phrase (le nom du client) ou le curseur de la 3D.

| Écran | < 14 px | < 40 px |
|---|---|---|
| `m` | 2 | 0 |
| `m/deposits` | 2 | 0 |
| `m/deposits/d5` | 0 | 0 |
| `m/deposits/new` | 0 | 1 |
| `m/payments` | 2 | 0 |
| `m/payments/p3` | 0 | 1 |
| `m/payments/new` | 0 | 1 |
| `m/clients` | 2 | 0 |
| `m/clients/u5` | 0 | 1 |
| `m/assistant` | 2 | 0 |
| `m/more` | 2 | 0 |
| `m/more/rates` | 2 | 1 |
| `m/dashboard` | 2 | 1 |
| `m/cargo` | 2 | 0 |
| `m/cargo/map` | 3 | 11 |
| `m/cargo/track` | 0 | 0 |
| `m/cargo/2` | 0 | 0 |
| `m/cargo/2/suivi` | 0 | 0 |
| `m/cargo/2/chargement` | 0 | 1 |
| `m/cargo/2/documents` | 0 | 0 |
| `m/cargo/2/couts` | 0 | 0 |

## Passes 11 et 12 — Cargo : les gestes là où est l'information

- **« L'argent »** ne se lit plus seulement, il se touche : « Le fret est
  payé » et « Le télex est reçu » sont deux boutons sous les phrases (et se
  défont : « Le fret n'est pas payé, finalement »). Le menu « … » du dossier
  n'a plus à les porter.
- **« À faire »** emmène : chaque chose à faire ouvre la section qui la
  règle (le fret → L'argent, le bill of lading → Les papiers, prévenir le
  client → Le client).
- **La flotte** écrit le numéro de boîte sous le nom du client quand il a
  plusieurs conteneurs (trois cartes « PRC » identiques ne se distinguaient
  pas).
- **« Le chargement en 3D »** est en phrases : « Remplie à 52 % : 39,9 m³
  occupés sur 76,4 m³. », le poids, les étages, ce qui ne colle pas, puis
  la boîte en 3D et les lots (« 220 cartons de 60 × 40 × 40 cm, 18,0 kg
  chacun. ») avec « Retirer » confirmé. L'ajout d'un lot se fait en cinq
  questions dans une feuille basse. Fin du dernier composant desktop dans le
  dossier mobile.
- **« Où est le conteneur »** ouvre la carte avec le navire déjà sélectionné
  (`/m/cargo/map?vessel=<IMO>`) ; MarineTraffic reste en lien discret.
- **Suivre** reconnaît une référence déjà dans la flotte pendant la saisie
  et propose d'ouvrir le dossier avant d'interroger l'armateur.
- Le menu « … » du dossier est une feuille basse réduite à deux gestes
  (renseigner le navire, retirer de la flotte), et retirer se confirme en
  phrase. Le numéro de boîte et le bill of lading se copient d'un tap.


## Passe 13 — Les trois propositions

- **Le navire se renseigne là où on lit qu'il manque** : « Où est le
  conteneur » porte le bouton « Renseigner le navire » (feuille basse en
  cinq questions : nom, IMO, MMSI, voyage, arrivée annoncée) ; une boîte
  « sans suivi » passe « en mer » dès qu'un navire est saisi et apparaît
  sur la carte. Le menu « … » ne garde que « Retirer de la flotte ».
- **Le centre de notifications connaît Cargo** : un conteneur en retard ou
  qui arrive sous 7 jours y apparaît (« Conteneur de GAUSS en retard —
  Arrive à Kribi le 11 octobre, dans 28 jours. Retard de 14 jours sur la
  date promise. »), compte dans le badge, et ouvre le dossier. Seuls les
  rôles qui ont `canViewCargo` voient ces lignes (RLS).
- **Mola a Cargo** : migration `20260913200000_cargo_mola_fleet.sql` —
  `cargo_fleet_status(p_client)` (lecture, dans les mots de l'app :
  arrivée, retard, fret, télex, prochaine chose à faire),
  `cargo_set_freight_paid` et `cargo_set_telex` (écriture, confirmation,
  `canManageCargo`), toutes étiquetées `@mola`. La passerelle
  `admin-assistant` reçoit le catalogue Cargo, le savoir métier (cycle,
  dates, franchise), les tables cargo pour `query_database`, et un
  résolveur « cargo » qui accepte un numéro de conteneur, un B/L ou le nom
  du client. À faire après fusion : `/migrate` puis `/gen-types`.

## Passe 14 — Cargo, encore plus loin

- **La flotte dit ce qui presse** : « À faire cette semaine — 4 choses avant
  les prochaines arrivées », repliée en tête de liste, une ligne par chose
  (« Régler le fret au transitaire — PRC · arrive à Douala le 17 septembre,
  dans 4 jours ») qui ouvre la bonne section du bon dossier. Au-delà de huit
  boîtes, un champ de recherche (client, n° de boîte, B/L, navire).
- **« Le trajet » raconte ce que l'armateur a dit** : les derniers jalons
  réels en phrases (« Navire parti à GZ Oceangate Container Terminal, le
  15 août. ») et ce qui est prévu.
- **« Le client » prévient sur WhatsApp** : quand le dossier est rattaché à
  un client avec un téléphone, un bouton ouvre WhatsApp avec le message déjà
  écrit (« votre conteneur MIEU3611115 : arrive à Kribi le 11 octobre, dans
  28 jours. Retard de 14 jours sur la date promise. »).
- **Mola** propose « Où en sont mes conteneurs ? » parmi ses suggestions.

## Passe 15 — Le coût à quai, v0

La plus petite version qui soit vraie de la manœuvre 1
(`docs/strategy/manoeuvre-1_proforma-cout-a-quai.md`, §9) : pas de lecture de
proforma, pas de nouvelle table, une règle de calcul et un écran.
- **`src/lib/cargo/landedCost.ts`** (14 tests) : valeur en douane (prix +
  fret + assurance, selon l'incoterm), droit de douane par bande TEC,
  TVA 19,25 % exonérable, taxes annexes ≈ 2 % (hypothèse, dite comme telle),
  cascade portuaire × 1,293 sur les droits de port, timbre 25 000, forfaits
  saisis. Trois couleurs : le vert s'additionne, le jaune est une fourchette,
  le rouge est une action (SGS, poids, 21e jour). Les surestaries
  (44 413 F par jour) ne sont jamais dans le total.
- **`/m/cargo/cout`** : six questions en français, le résultat s'écrit
  dessous dès que le montant est saisi. Depuis « Les coûts » d'un dossier,
  le fret, le poids et le port sont déjà remplis. Le rejeu du tracteur de
  MRSU9909331 (6 057 USD, 1 750 kg, FOB, 10 %, TVA exonérée) donne le même
  ordre de grandeur que le dossier.

## Passe 16 — 14 septembre : stabilité sur iPhone, étiquette colis mobile

Retour fondateur (captures Safari iOS) : sur Mola, à l'ouverture du clavier
l'écran se décale de ~200 px et reste coupé à la hauteur « clavier ouvert »
même clavier fermé ; l'étiquette colis est longue à sortir, ses trois boutons
sont écrasés, le bloc fournisseur prend la place, le geste est enfoui en bas
de la fiche client.

**Cause du décalage** (reproduite en simulation Playwright, `computeViewportVars`
testé) : le cadre fixe suit `visualViewport` via `--vvh/--vvt` ; iOS remet
`offsetTop` à zéro APRÈS l'événement `resize`, sans `scroll`. Rien ne relisait
la géométrie → cadre figé à `top: 208px`. Corrections :
- `useVisibleViewportSync` : relecture différée (80 / 260 / 600 ms) après chaque
  événement, `focusin`/`focusout`, tout toucher ; `--vvk` (hauteur clavier) et
  `html.kb-open` (la barre d'onglets s'efface) ; document verrouillé remis à 0.
- `MobileAppShell` : `min-h-[100dvh]` (100vh = grand viewport iOS → document
  plus haut que l'écran, que Safari faisait défiler au focus).
- `BottomSheet` et la feuille « assigner » du support ancrées sur la zone
  visible (`top: var(--vvt)`, `height: var(--vvh)`) : un champ dans une
  feuille ne passe plus sous le clavier.
- `useScrollIntoViewOnFocus` : inerte dans un document verrouillé ou sous un
  ancêtre fixe.

**Étiquette colis** : feuille mobile dédiée (`MobileShippingLabelSheet`) —
Sea cargo · Air cargo, une phrase, trois sorties pleine largeur 48 px
(Télécharger d'abord, Envoyer si `navigator.share`, PDF), l'aperçu dessous,
pas de bloc fournisseur (desktop le garde). Export en mode rapide (×2, sans
incorporer Noto SC — plusieurs Mo encodés sur le téléphone, c'était le
« ça cale »). Le bouton monte sous l'identité du client, au-dessus de
l'identifiant ; la carte identifiant gagne un vrai bouton « Copier ».

**Nomenclature** : « Entrepôt » → **Sea cargo** (海运), « Bureau » → **Air cargo**
(空运), partout (étiquette, PDF, image, réglages, i18n fr/en/zh, nom de
fichier). Les clés `warehouse` / `office` de `platform_settings` ne changent pas.

**Audit stabilité (agent, lecture seule)** — corrigé dans la même passe :
- Temps réel : l'abonnement dépendait de l'objet `currentUser` (recréé à
  chaque rafraîchissement de jeton) et réutilisait un canal en train de partir
  → les listes cessaient de bouger. Dépend maintenant de l'id, canal unique.
- Filet 8 s de `AdminAuthContext` : ne renvoie plus vers `/m/login` un admin
  dont la session est connue ; l'écran de connexion redirige s'il est connecté.
- Chargement 3D : au plus 160 pavés dessinés (six calques GPU chacun), glisser
  au rythme des images — fin du rechargement d'onglet iPhone sur un gros colisage.
- `crypto.randomUUID` → `uid()` (repli iOS < 15.4) : le bouton Envoyer de Mola
  ne peut plus mourir en silence.

## Passe 17 — 14 septembre, soir : l'étiquette colis est DESSINÉE

Retour fondateur (test sur iPhone) : dans l'image exportée, tout se chevauche
(« DELIVER TO » sur deux lignes, l'adresse sur elle-même, le fournisseur
écrasé) ; et « partager le PDF » remet un lien `blob:` au lieu d'un fichier.

**Cause** : l'étiquette était un bloc HTML rasterisé (html-to-image). Sur le
téléphone, l'image partait sans les polices web ; des polices système plus
larges entraient dans des lignes de hauteur FIXE. Et le bloc débordait déjà
de ~10 % sur desktop (sections « écrasées »).

**Refonte** (`src/lib/shippingLabelCanvas.ts`) :
- `layoutLabel()` : un PLAN pur — curseur vertical, chaque texte MESURÉ
  (retour à la ligne pour l'adresse, rétrécissement 13,5 → 10,5 px puis « … »
  seulement en dernier recours), champs longs (WhatsApp, e-mails, société,
  fournisseur) sur leur propre ligne, section 5 ancrée en bas, la section
  fournisseur prend l'espace restant. 11 tests, dont un « pire cas » avec une
  police large et des valeurs très longues : aucun texte ne dépasse sa
  largeur, aucun filet à moins de 12 px d'un autre.
- `paintLabel()` : la peinture sur canvas, avec les polices de la page si
  elles sont chargées (DM Sans, Noto SC), sinon celles du système — mesurées.
- L'aperçu est l'image exacte qui part (×2) ; l'export est peint à ×3.
- Sorties : de vrais FICHIERS. Sur téléphone, `navigator.share({ files })`
  pour l'image ET le PDF (WhatsApp, WeChat, Fichiers…) ; sinon téléchargement
  par URL d'objet révoquée. Plus jamais de `blob:` dans un onglet.
- `ShippingLabel.tsx` (DOM) supprimé ; composeur desktop et feuille mobile
  branchés sur `useShippingLabel()`.

## Passe 18 — 14 septembre, nuit : le client et son cargo se répondent

- **Fiche client → « Son conteneur / Ses N conteneurs »** : la flotte (déjà en
  cache pour le badge de l'onglet) filtrée sur `client_id`, une ligne par
  boîte (numéro, phrase d'arrivée, état), qui ouvre le dossier. Section absente
  quand il n'y a rien à dire. Geste « Suivre un conteneur » dans « Les gestes »
  (réservé à `canViewCargo`).
- **Dossier cargo → « Le client »** : l'identifiant `BZ-…` en toutes lettres et
  le bouton « Étiquette colis pour son fournisseur » (même feuille que la fiche
  client). `useCargoClient` lit désormais `customer_code`.
- **Étiquette** : le QR est peint dès que son canvas est monté (ref-fonction) et
  vit hors de la feuille basse — sinon, feuille ouverte après le montage, l'image
  partait sans QR.
- Scanner un client : sous-titre qui tient sur une ligne.

## Passe 19 — 14 septembre, nuit : boucle d'audit, tour 1 (base, sécurité, qualité)

Six agents en lecture seule (sécurité, base de données, responsive/UX,
fonctionnel, performance, qualité). Corrigé dès le premier tour :
- **Temps réel** : les six tables `cargo_*` invalident le préfixe `['cargo']`
  (elles n'étaient pas abonnées : le cron `cargo-sync` écrivait sans que
  l'app le voie) ; migration `20260914090000` : index `client_id` /
  `bl_number` + tables ajoutées à la publication `supabase_realtime`.
- **Types** : les trois RPC cargo (`cargo_fleet_status`, `cargo_set_freight_paid`,
  `cargo_set_telex`) ajoutées à `types.ts` (à regénérer par `/gen-types` quand
  le projet est joignable).
- **Filtres PostgREST** : `useCargoClientOptions` efface `, ( ) % \` avant
  `.or()` ; le résolveur cargo de Mola (`resolveRef`, service-role) ne garde
  que `[A-Za-z0-9]` pour la référence et assainit le libellé client.
- **`platform_settings`** : lecture limitée aux clés publiques (`key IN
  ('shipping')`) — migration `20260914090500`, reportée dans le consolidé
  identifiant-client.
- **Edge functions mortes** `create-admin`, `create-agent`, `create-client` :
  retirées du dépôt — elles écrivaient dans `profiles` (supprimée en février),
  n'avaient pas de garde `is_disabled`, et l'app ne les appelle plus. **À
  dé-déployer** : `npx supabase functions delete create-admin` (× 3).
- `uid()` : plus de repli `Math.random` (nom de fichier de stockage).
- Qualité : `TONE_OF` unique dans `palette.ts` ; `useLabelExport()` partagé
  par le composeur et la feuille ; `fitOnPage()` pur et testé (13 tests).

**Décision à prendre (non modifié)** : dans `admin-assistant`, la LECTURE est
ouverte à tout rôle par choix documenté (« Mola AI-native ») et s'exécute en
service-role — un `cash_agent` peut donc lire la trésorerie via Mola. La règle
`security.md` dit l'inverse. Une ligne suffit à rétablir la garde :
`READ_TOOLS.filter((t) => t.always || perms[t.permission])`.

## Passe 20 — boucle d'audit, tour 1 (fonctionnel, performance)

**Argent** (migration `20260914091000`, consolidé section 10) : un dépôt
`cancelled` / `cancelled_by_admin` ne peut plus être validé ni refusé ; un
paiement `rejected` / `cancelled_by_admin` (déjà remboursé) ne peut plus être
« refusé » — c'était un second remboursement. Les écrans verrouillent les
mêmes statuts (`isLocked`).

**Cohérence** : la liste et la carte cargo lisent désormais les pièces de
toute la flotte (`useCargoFleetDocuments`) — elles disaient « B/L manquant »
quand le dossier le voyait classé. Les badges d'action (onglets, cloche) sont
invalidés après chaque geste d'argent ; la fiche paiement admin se rafraîchit
après une signature cash.

**Étiquette** : export ×3 pré-peint (le partage iOS reste dans le geste) ;
presse-papiers avec repli téléchargement ; aperçu remis à zéro au changement.

**Cargo** : fin de franchise lue à midi (plus de « en retard » un jour trop
tôt à l'ouest de Greenwich) ; « 0 jour » au singulier.

**i18n** : `resetPassword` en objet en/zh (le lien expiré s'affichait en
français) ; 17 clés zh manquantes ajoutées ; deux textes en dur de l'app
client passés par `t()`.

**Performance** (mesuré sur `dist/m/index.html`) : JS au premier chargement
**4 782 kB → 1 168 kB** (−75 %). Chunks PDF/graphiques laissés au découpage
naturel (ils étaient tirés par des aides partagées), règle `react/` resserrée
(elle attrapait lucide-react et qrcode.react), V1 du formulaire de dépôt
(`import * as Icons`, 508 kB, non routée) supprimée, page d'accueil publique
en lazy, mascotte en WebP (315 kB → 8 kB dans la barre), polices : DM Sans en
un fichier variable, Syne (jamais utilisée) retirée, feuille non bloquante sur
l'entrée admin. Plus de remontage entre Dépôts et Paiements (même écran),
tally cargo mémorisé, images d'export sans cache-bust.

## Passe 21 — boucle d'audit, tour 1 (responsive, UI/UX)

Audit à 320 / 390 / 430 px et en sombre, 25 routes. Corrigé :
- **Kit** : `Button` md à 44 px (`min-h-11`), peut passer à la ligne et ne
  déborde plus de son parent ; `Chip`, `Segmented`, `TextInput`, action de
  section à 44 px ; rouge « danger » lisible en sombre (`#FCB3AD`).
- **En-tête** : plus de `truncate` (titre et sous-titre passent à la ligne),
  sous-titre à 16 px, hauteur qui suit.
- **Barre d'onglets** : « Opérations » tient à 320 px (12 px sous 360 px).
- **Nouveau paiement / dépôt** : l'encre d'accent devient `var(--ink)` (suit le
  thème — compteur, barre d'étapes, anneaux invisibles en sombre) ; noms et
  téléphones sans troncature.
- **Taux** : encre sombre sur amber (1,8:1 → 7:1), unités lisibles, en-tête
  qui passe à la ligne, « Prise d'effet » en grille 2×2, simulateur en 2
  colonnes sous 360 px, historique sans troncature.
- **Dossier cargo** : ronds d'en-tête lisibles en sombre ; parcours lisible à
  320 px ; puces du coût à quai à 44 px, texte qui passe à la ligne.
- **Fiche client** : numéro de conteneur entier, pastille sous la phrase ;
  identifiant BZ entier à 320 px. Réglages d'expédition en une colonne sous
  360 px. Sélecteur de période du tableau de bord au kit. Carte : zoom 44 px,
  légende 16 px. « Saisie manuelle » sans capitales. Placeholder court.
Sonde `tools/_w320` (jetable) : 0 débordement de document, 0 troncature, 0
erreur JS sur 22 routes à 320 et 390 px (les seuls dépassements restants sont
des rangées de puces qui défilent horizontalement, volontaires).

## Passe 22 — boucle d'audit, tour 2 (contre-vérification)

**Régression attrapée avant mise en ligne** : la migration des statuts
terminaux (`20260914091000`) reprenait le texte des fonctions de
`20260831160000`, mais deux migrations postérieures les avaient corrigées
« en place » (`replace()` sur `pg_get_functiondef`) : le verrou `FOR UPDATE`
sur le paiement (`20260831200000`) et « montant crédité > 0 »
(`20260831220000`). Une redéfinition complète les effaçait en silence —
deux `reject` concurrents auraient remboursé deux fois. Réintégrés dans la
migration et le consolidé ; nouveau test `moneyRpcGuards` : toute
redéfinition postérieure de `process_payment` / `validate_deposit` /
`reject_deposit` doit reconduire ces correctifs.
- Étiquette : le pré-rendu ×3 (canvas de ~20 Mo) n'est plus lancé qu'à
  l'ouverture de la feuille (`active`), pas à chaque fiche client ouverte.
- Fiche client et légende de la carte desktop : `alertLevel` avec les pièces,
  comme la liste et le dossier.
Vérifié propre par l'agent : idempotence des trois migrations, portée RLS de
`platform_settings` (seul lecteur : `shipping`), préfixe temps réel cargo,
absence de cycle d'import des badges, découpage des chunks (aucun PDF /
graphique au premier chargement des trois entrées), Suspense au-dessus de la
page d'accueil lazy, `MobileOperationsScreen` lit `tab` à chaque rendu,
kit 44 px sans parent à hauteur fixe, en-tête à 320 px, `uid()` jamais au
chargement de module, `resetPassword` sans consommateur chaîne.

## Passe 23 — boucle d'audit, tour 2 (responsive, contre-vérification)

Huit finitions : ligne e-mail des réglages d'expédition en `col-span-full`
(la grille à une colonne la cassait à 320 px) ; nouveau paiement : le solde
sous le nom (à côté, il coupait les noms) ; parcours : étiquettes 14 px sans
coupure de mot ; en-têtes de graphiques : la barre d'outils descend sous le
titre sur mobile ; KPI sur une ligne ; montant du simulateur à 32 px (la règle
globale `input { font-size: 16px !important }` l'écrasait) ; « Pré-remplir »
sous le taux suggéré à 320 px ; copie du B/L en cible de 44 px.
Propre à 320 / 390 / 430 / sombre (agent) : Opérations, nouveau dépôt,
clients, fiche, scan, flotte, dossier, papiers, coût à quai, carte.

## Passe 24 — boucle d'audit, tour 3 (fin de boucle)

Le tour 3 n'a plus trouvé que des finitions : KPI du tableau de bord en une
colonne sous 360 px (le chiffre débordait de sa carte), étiquettes du
parcours à 14 px seulement à partir de 360 px, boutons info / export /
granularité et copie du numéro de conteneur à 44 px. Scripts de capture
jetables retirés du dépôt (`tools/_*.tmp.*` ignorés). Vérifié par capture
(320 px, sombre) : rien à signaler. **Boucle arrêtée** : trois tours, 6 + 2 +
1 agents, 624 tests verts.

**Bilan chiffré (version en ligne 3063bad → branche)** : JS au premier
chargement 4 690 → 1 168 kB ; mascotte 315 → 8 kB ; cibles tactiles 40 → 44
px ; 0 débordement / troncature sur 22 écrans à 320 et 390 px ; 2 failles
d'argent fermées (dépôt annulé validable, paiement clos « refusable ») ; temps
réel réparé (jeton) et étendu au cargo ; étiquette colis dessinée (aucun
chevauchement, fichier partagé natif) ; 601 → 624 tests.

## Passe 25 — critique UX (une décision, l'âge réel, le vocabulaire de « Plus »)

Suite à la critique évaluative de l'application : **une seule action
principale par fiche**. Sur le dépôt, « Valider le dépôt » reste le seul
bouton plein ; « Marquer « en vérification » » devient discret, avec la
phrase qui dit à quoi il sert (le client le voit, les collègues savent qu'on
s'en occupe) ; « Refuser » reste en texte rouge. **L'urgence dit l'âge réel** :
« Ce dépôt attend depuis 4 jours » / « Ce paiement attend depuis 24 heures »
(`sinceSentence`, heures sous 48 h, jours au-delà) au lieu d'une phrase fixe.
La file « À traiter » se lit **du plus ancien au plus récent**. Sur le
paiement, l'alerte distingue la facture du client (reçue) de la preuve
manquante de l'opérateur. Le bouton d'en-tête « Relevé » devient « Reçu ».
L'écran « Plus » parle français : « Tableau de bord », « Messages des
clients », « Réponses toutes faites », « Suggestions aux nouveaux clients »,
et la trésorerie explique ce qu'elle contient. Le champ de recherche du
nouveau dépôt ne prend plus le focus tout seul (le clavier n'apparaît plus
avant qu'on l'ait demandé). 624 tests verts, build propre.
