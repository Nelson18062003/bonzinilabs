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
