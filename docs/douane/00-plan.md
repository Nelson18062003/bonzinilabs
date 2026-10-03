# Bonzini Douane — le plan

> Écrit le 29/09/2026. Point de départ : la release Flexport (Customs Technology
> Suite, Winter et Fall 2026) et la demande du fondateur de la construire **pour le
> Cameroun**. Ce document tranche l'architecture et l'ordre des étapes. Chaque étape
> est livrée seule, testée, puis poussée.

## 1. Pourquoi

Un importateur camerounais qui paie son fournisseur chinois avec Bonzini découvre ses
droits de douane **au port**, sur une DAU qu'il ne sait pas lire, établie par un
déclarant qu'il ne peut pas contrôler. Le dossier MRSU9909331 l'a montré, au franc
près (`docs/cargo/dossiers/`) :

- quatre articles mal classés « par ressemblance de mots » (« régulateur » →
  réfrigérateur 30 %, chaises → meubles, vêtements neufs → friperie) :
  **307 078 XAF** de trop sur 900 000 XAF de marchandises ;
- une valeur **triplée** faute de facture définitive déposée à la SGS :
  **2 311 829 XAF** de trop sur une seule voiture ;
- une exonération posée sur le mauvais code (le tracteur).

Flexport annonce **20 % d'erreurs** dans les déclarations des autres courtiers
américains. Au Cameroun, sur notre seul conteneur, **4 articles sur 10** étaient faux.

**La promesse de Bonzini Douane : payer le juste droit — ni plus, ni moins.**

## 2. Ce que Flexport a livré → ce que Bonzini en fait

| Flexport | Bonzini Douane (Cameroun) | Étape |
|---|---|---|
| Tariff Simulator — public, tous les droits empilés, scénario dans l'URL, journal des changements | **Simulateur de droits et taxes** : public, les 10 prélèvements de la DAU CAMCIS reproduits ligne à ligne (modèle vérifié à ±4 F sur une vraie DAU), coût de revient rendu, comparaison de classements, lien partageable | 1–2 |
| AI classification + courtier agréé qui signe | **Classer mon produit** : conversation avec l'IA (questions de matière, usage, état neuf/usagé, puissance), 2–3 codes candidats avec les règles générales (RGI) et le coût de chacun, **validation par un Commissionnaire Agréé en Douane (CAD)**, bibliothèque de produits, lettre de **décision anticipée** (art. 75) | 3–4 |
| Compliance audit — « Audit your customs broker » | **Vérifier ma déclaration** : DAU / bulletin de liquidation en photo ou PDF → lecture par l'IA → recalcul de chaque prélèvement, contrôle du code, de l'accise, de la valeur, des exonérations manquées → trop-perçu chiffré, voie de recours (162.3, 163, 179, Titre XII) et **délai de 3 ans** (art. 396) | 5 |
| Refunds / drawback | **Récupérations possibles** : pas de drawback (nos clients consomment au Cameroun), mais le trop-perçu, ses délais, et le dossier prêt à déposer | 5 |
| « 53 changements en 52 semaines » | **Veille tarifaire** : loi de finances, TEC CEEAC 2026, circulaires DGD ; alerte sur les codes déjà importés par le client | 6 |
| Atlas — perturbations sur la carte | **Perturbations** : congestion Douala/Kribi, pannes CAMCIS, corridors Douala–N'Djamena/Bangui, mer Rouge, typhons, Nouvel An chinois | 6 |
| Page d'expédition refaite, tâches en tête, messagerie unifiée | **Tâches** classées par ce qu'elles coûtent si on les rate (« le 22e jour coûte 44 413 F ») | 7 |
| Invitations des fournisseurs | **Inviter mon fournisseur** — en chinois — pour qu'il dépose la facture définitive à la SGS (la cause n° 1 de la valeur triplée) | 7 |
| Atlas multimodal, transit observé, émissions | **Routes Chine → Cameroun** : mer, air, rail/route vers Yaoundé, N'Djamena, Bangui ; transit **observé** sur nos dossiers vs promis ; CO₂ | 8 |

Écarté : entrepôts à l'étranger, robots. Hors sujet pour nous.

## 3. Règles non négociables

1. **Un chiffre faux est pire qu'aucun chiffre.** Chaque taux porte sa source et sa
   confiance : **Officiel** (texte lu) · **Observé** (reproduit sur une vraie DAU
   CAMCIS) · **Marché** · **À vérifier**. Le rouge ne s'affiche jamais comme un
   montant : c'est une action.
2. **L'IA propose, le CAD signe.** Aucun code « validé » sans un commissionnaire
   agréé identifié, horodaté. La validation est une RPC `confirm:true`, jamais
   automatique.
3. **Le calcul est déterministe.** L'IA lit (DAU, fiche produit) et converse ; le
   recalcul et les contrôles sont du code testé (`src/lib/customs/`), rejoués sur
   les DAU réelles du dépôt.
4. **Mola voit tout.** Chaque nouvelle RPC porte son étiquette `@mola` et sa garde
   `admin_has_permission`.
5. **Français d'abord**, anglais et chinois pour tout ce que voit un client ou un
   fournisseur.

## 4. Architecture

```
scripts/customs/build-nomenclature.mjs   sources ouvertes → public/data/customs/*.json
public/data/customs/nomenclature-cm.v1.json
                                          SH 2022 (2/4/6 chiffres), libellés FR/EN,
                                          taux TEC appliqué par sous-position
src/lib/customs/
  hsCode.ts        12 chiffres CAMCIS, 11 chiffres CGI, SH6 : normaliser, afficher
  levies.ts        les prélèvements CAMCIS (DDI, DAC, DEA, TVA, CAC, TCI, CCI, CIA,
                   PRO, DEV), taux, base, source, confiance
  excise.ts        CGI art. 142 + annexe II + table véhicules (CGI 2024 / LF2026)
  vatExempt.ts     CGI annexe I + liste agricole
  engine.ts        la liquidation d'un article, puis le coût de revient rendu
  nomenclature.ts  chargement + recherche (vocabulaire du marché FR/EN/中文)
  marketTerms.ts   « friperie », « mèches », « okada », « 手机 »… → codes SH
src/pages/customs/                       le site bonzinilabs.com/douane (client) et
                                          les pages de l'espace équipe (variant admin)
src/pages/customs/site/                  le kit du site : SiteLayout, ui.tsx, styles.ts
src/mobile/screens/customs/ + desktop    espace équipe : file CAD, audits, veille
supabase/migrations/*_customs_*.sql      classements, revues CAD, audits, veille,
                                          tâches, invitations
supabase/functions/customs-ai/           Claude : conversation de classement,
                                          lecture de DAU
```

## 5. Les étapes

| # | Étape | Livrable |
|---|---|---|
| 1 | Moteur de liquidation + nomenclature | `src/lib/customs`, données, tests sur la DAU `SDSD2-2026-IMP-020399-I` et la simulation RAV4 |
| 2 | Simulateur (client public + équipe) | pages, URL partageable, comparaison de codes, PDF |
| 3 | Socle base de données | tables, RLS, RPC gardées, étiquettes Mola, testées sur Postgres local |
| 4 | Classement IA + validation CAD | edge function, conversation, file CAD, bibliothèque, décision anticipée |
| 5 | Audit de déclaration | lecture IA, contrôles déterministes, trop-perçu, recours |
| 6 | Veille + perturbations | journal des changements, couche carte |
| 7 | Tâches + invitations fournisseurs | boîte de tâches, page fournisseur en chinois |
| 8 | Routes et émissions | Chine → Douala/Kribi → hinterland, transit observé |
| 9 | Le site `bonzinilabs.com/douane` | une seule mise en page pour tous les outils, pensée par écran (§ 7) |

## 6. Faits retenus pour le moteur (détail et sources : `docs/douane/01-sources.md`)

Liquidation CAMCIS, par article — reproduite à ±4 F sur les articles 4 à 10 de la DAU
`SDSD2-2026-IMP-020399-I` :

```
V    valeur en douane = prix × taux de change + fret + assurance (art. 30, 31)
DDI  = V × taux TEC
DAC  = (V + DDI) × taux d'accises                 CGI 138(2), 142, annexe II
DEA  = V × 1 %                                    LF2023 art. 9 (redevance informatique)
TVA  = (V + DDI + DAC + DEA) × 17,5 %             CGI 138(1)
CAC  = TVA × 10 %                                 CGI 142(2)
TCI 0,6 · CCI 0,4 · CIA 0,2 · PRO 0,05  = 1,25 % de V   (observé sur la DAU)
DEV  = (V + DDI + DAC + TVA) × 5 %                véhicules d'occasion (observé)
```

Hors DAU : PVI 0,95 % du FOB (SGS, dès 2 M FCFA FOB), précompte 2/5/10 % selon le
régime fiscal, BESC, CIVIC 29 813 F par véhicule d'occasion, passage portuaire,
honoraires du CAD, surestaries au-delà du 21e jour.

Taux TEC par sous-position : **tarif appliqué du Cameroun, OMC/CNUCED TRAINS 2019**
(SH 2017), vérifié identique à la DAU de septembre 2026 sur les 8 lignes qu'elle
porte. Le **TEC CEEAC** en vigueur depuis le 01/01/2026 ajoute des bandes 0 % et
40 % (vêtements confectionnés, mèches, tissus…) : ces familles sont signalées
« peut passer à 40 % — à confirmer au tarif intégré CAMCIS ».

## 7. Le site `bonzinilabs.com/douane`

Un chemin du site principal, pas un sous-domaine : la session (localStorage)
reste la même que celle de l'app de paiement. Tout ce que voit le client passe
par `site/SiteLayout.tsx` et les pièces de `site/ui.tsx`, sous la portée `.dz`
(couleurs `dz.*` dans `tailwind.config.ts`, jetons dans `src/index.css`).

- **Une action principale à la fois** : bouton encre plein. Le violet Bonzini
  (`variant="brand"`) est réservé à « Payer mon fournisseur ».
- **Le chiffre avant le détail** : la somme clé sur la carte sombre
  (`bg-dz-primary`) ; le détail se déplie (`Disclosure`).
- **Texte ≥ 14 px, champs 17 px** (pas de zoom d'iOS) ; animations ≤ 400 ms,
  coupées par `MotionConfig reducedMotion="user"`.
- **Par écran** — téléphone (< 640) : en-tête 56 px et menu plein écran, une
  colonne, la somme en premier, barre de total collée en bas du simulateur ;
  tablette (640–1279) : grilles à deux colonnes, menu gardé ; ordinateur
  (≥ 1024 pour les pages outils, ≥ 1280 pour la navigation) : deux colonnes, le
  panneau de droite collant (somme + action), navigation à cinq liens.
- `text-balance` est une **taille** de police dans ce projet : utiliser
  `[text-wrap:balance]`.

Contrôle : 16 pages × 7 largeurs (360 → 1920), clair/sombre, fr/en/zh — aucun
débordement horizontal, aucun texte sous 13 px.
