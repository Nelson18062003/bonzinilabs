# Manœuvre 1 — La proforma comme porte d'entrée, et le coût à quai avant l'achat

> Spécification. Écrite le 13/09/2026, en application de
> [`2026-09_pg-making-startups-powerful.md`](2026-09_pg-making-startups-powerful.md).
>
> Marqueurs : **[FAIT]** = vérifié dans le dépôt, la base ou un dossier ·
> **[RÈGLE]** = règle de droit ou formule sourcée dans un module ·
> **[HYPO]** = inférence à vérifier.

---

# 1. Le terme, avant tout

> 📄 **Facture proforma** (*proforma invoice*, PI, 形式发票 *xíngshì fāpiào*) — une
> **offre chiffrée et engageante**, émise par le vendeur **avant** la vente. Le
> mot vient du latin *pro forma*, « pour la forme » : elle a la forme d'une
> facture sans en être une. Elle **ne comptabilise rien**, ne se déclare pas à la
> TVA du vendeur, et ne prouve aucune créance.

Ce qu'elle est vraiment, dans le commerce Chine → Afrique : **le seul document qui
existe au tout début, et qui contient déjà tout.** C'est contre elle que l'acheteur
paie, contre elle que la banque domicilie, contre elle que la douane compare.

**[FAIT]** Dans le dossier MRSU9909331, la proforma `SDLMT20260418AG01` est datée du
**18 avril 2026**. Le conteneur est arrivé à Kribi le **26 août**. La visite douanière a
eu lieu le **4 septembre**. La proforma précède la crise de **quatre mois et demi**.

C'est exactement le raisonnement de Rippling : le onboarding, « parce que c'est là que
commence la vie de la donnée employé ». Ici, **la proforma, c'est là que commence la vie
de l'import.**

---

# 2. Ce qu'elle contient, et ce que chaque champ débloque en aval

C'est le tableau central de cette manœuvre. Un seul document alimente les trois produits.

| Champ de la proforma | 💰 Paiement | 🚢 Cargo | 🛃 Douane |
|---|---|---|---|
| **Vendeur** : raison sociale, adresse, banque, SWIFT | crée / rapproche le `beneficiaries` | identifie le fournisseur du colis | nom du vendeur à la déclaration |
| **N° et date de PI** | référence du paiement | référence du dossier | pièce jointe à la déclaration |
| **Désignation de la marchandise** | — | étiquette du colis | **→ code SH** → droit de douane **et** éligibilité à l'exonération |
| **Quantité** | — | nombre de colis | quantité déclarée, unité tarifaire (`UNT`, `NMB`…) |
| **Poids net / brut** | — | **UP**, plan de chargement | **répartition du fret dans la valeur en douane** |
| **Dimensions des cartons** | — | **m³ → `cargo_packages` → groupage** | volume déclaré |
| **Prix unitaire, total, devise** | montant à payer, taux appliqué | valeur assurée | **base de la valeur en douane** (art. 30) |
| **Incoterm + lieu nommé** | qui paie le fret | qui réserve | **ce qu'il faut ajouter** (art. 31.1) |
| **Port de chargement** | — | service, transit, THC départ | port d'embarquement au manifeste |
| **Délai de production** | date de besoin de trésorerie | **fenêtre de groupage** | — |

**[FAIT]** Rien de tout cela n'entre aujourd'hui dans la plateforme. Le client tape un
bénéficiaire et un montant. Les onze autres lignes du tableau sont perdues.

---

# 3. La formule du coût à quai

Cinq couches. Chacune est sourcée.

## Couche A — la valeur en douane

**[RÈGLE]** Code CEMAC, art. 30 : la valeur est le **prix effectivement payé ou à payer**.
Art. 31.1, ce qu'on **ajoute obligatoirement** (module 7) :

| Élément | Ajouté ? | Base |
|---|---|---|
| Fret maritime jusqu'au lieu d'introduction | ✅ | art. 31.1 **e)** |
| Chargement, déchargement, manutention connexes | ✅ | art. 31.1 **f)** |
| Assurance | ✅ | art. 31.1 **g)** |
| Emballage, main-d'œuvre et matériaux | ✅ | art. 31.1 **a)** |
| Commissions et courtage | ✅ | art. 31.1 **a)** |
| **Commissions d'ACHAT** | ❌ | art. 31.1 a), **exclusion expresse** |
| Surestaries, stationnement | ❌ | postérieures — art. 31.3 |
| Dédouanement, honoraires du transitaire | ❌ | art. 31.3 |

```
Valeur en douane = prix proforma
                 + fret réparti au prorata du poids brut
                 + assurance
                 + emballage et commissions de vente
```

> ⚠️ **[RÈGLE] Le fret est taxé** (module 7). Puisqu'il entre dans la valeur en douane,
> il subit les mêmes droits que la marchandise : **chaque franc de fret coûte 1,33 franc.**
> C'est ce qui rend l'erreur de poids si chère — voir §5.

## Couche B — droits et taxes

Fonction de deux variables seulement : **le code SH** et **la valeur en douane**.

| Ligne | Taux | Statut de la source |
|---|---|---|
| **Droit de douane** | bandes TEC CEMAC : 5 / 10 / 20 / 30 % | **[RÈGLE]** — bande donnée par le code SH |
| **TVA** | 17,5 % + 10 % CAC = **19,25 %** | **[RÈGLE]** CGI. **Exonérable** si le code figure à l'annexe 1 (art. 128-6a), appliquée **d'office** (art. 128 ter) |
| Droit d'accises | selon produit | **[RÈGLE]** — le tracteur **agricole** en est exclu (LF2026) |
| TCI · CCI · précompte · redevance informatique | ~2 % cumulés | ⚠️ **[HYPO]** relevés sur le RVC du dossier, **non reconsignés au dépôt — à re-vérifier ligne à ligne avant toute mise en production** |

## Couche C — le passage portuaire, qui est une cascade

**[RÈGLE]** Module 6, établi sur les factures réelles `CMIM1091423/24` :

```
  droits de port                          77 000
+ 4 %  de 77 000   → sûreté
+ 1 %  de 77 000   → informatique
+ 1 000            → contribution communautaire
= 81 850
+ 2 %  de 81 850   → frais administratifs
= 83 487  × 1,1925 (TVA) = 99 559
```

> 🔑 **Multiplicateur × 1,2930.** Chaque 100 F de droits de port devient 129 F sur la
> facture. **Donc prévisible dès qu'on connaît le terminal.**

## Couche D — les forfaits

BESC, droit de timbre (**25 000, hors TVA** — module 6 : 4 812 F d'erreur comptable par
conteneur si on l'oublie), documentation fee, frais de dossier.

## Couche E — l'après-arrivée, qui n'est pas dans la valeur en douane mais l'est dans la vie

**[RÈGLE]** Art. 31.3 exclut les surestaries de la valeur en douane. Mais le client les
paie. **[FAIT]** Module 5 : au-delà du 21ᵉ jour, un jour coûte **44 413 F TTC**. Sur
ECMU5839181, **27 jours** ont été facturés.

**Donc le coût à quai s'affiche en deux blocs :**
**ce qui est dû quoi qu'il arrive** · **ce qui dépend de la vitesse de dédouanement**.

---

# 4. Le tableau d'honnêteté — certain, estimé, inconnu

Le point le plus important de cette spec. Un chiffre faux est pire qu'aucun chiffre.

| | Élément | Pourquoi |
|---|---|---|
| 🟢 **Certain dès la proforma** | Montant fournisseur, devise | c'est écrit |
| 🟢 | Poids, volume, nombre de colis | c'est écrit |
| 🟢 | Code SH | déterminable — fait pour le tracteur, vérifié dans CAMCIS |
| 🟢 | Bande de droit de douane | découle du code |
| 🟢 | Exonération de TVA oui/non | découle du code + annexe 1 |
| 🟢 | Droit de timbre | forfait 25 000 |
| 🟢 | Cascade portuaire | × 1,2930 sur les droits de port |
| 🟡 **Estimé, avec fourchette** | Fret | dépend du booking, du mois, de l'armateur — mais Bonzini a des cotations réelles |
| 🟡 | Assurance | taux sur valeur |
| 🟡 | Droits de port | dépend du terminal et du type de boîte |
| 🟡 | Transport final | dépend de la destination |
| 🔴 **Inconnu — à afficher comme risque, pas comme chiffre** | **La valeur que retiendra la SGS** | le risque n° 1. **[FAIT]** sur MRSU9909331 : valeur **triplée** en méthode 6.4, motif « LA FACTURE NON SOUMISE » |
| 🔴 | Surestaries | dépendent du temps de dédouanement |
| 🔴 | Retard navire | **[FAIT]** transit réel 67 jours contre 34 annoncés |

> **La règle d'affichage :** le vert s'additionne, le jaune s'affiche en fourchette,
> **le rouge ne s'affiche jamais comme un montant — il s'affiche comme une action.**
> « Soumettez votre facture à la SGS, sinon la valeur peut être multipliée par trois. »

---

# 5. Le rejeu — ce que Bonzini aurait dit le 18 avril

**[FAIT]** Contenu de la proforma `SDLMT20260418AG01` : tracteur GJ704-E **4 412 USD**,
rotavator **735 USD**, service **100 USD** → **6 057,10 USD ≈ 3 472 000 XAF**.
Poids **1 530 + 220 = 1 750 kg**.

## Le chiffre

| Ligne | Montant | Statut |
|---|---|---|
| Marchandise | 3 472 000 | 🟢 |
| Fret réparti (1 750 kg) | ~ 645 000 | 🟡 |
| **Valeur en douane** | **~ 4 117 000** | |
| Droit de douane 10 % | ~ 412 000 | 🟢 taux · 🟡 base |
| **TVA** | **exonérée** — annexe 1, `870190.11.0000` | 🟢 |
| Passage portuaire + forfaits | ~ 210 000 | 🟡 |
| **Coût à quai** | **~ 4 740 000 XAF** | |

**[FAIT]** Le dossier estimait de son côté « droits et taxes ≈ **1 140 000 XAF** (≈ 33 %) »
sur la base du code `8701.90.11`. Les deux estimations sont du même ordre.

## Mais le vrai produit, ce ne sont pas ces chiffres — ce sont les trois alertes

**1. « Exigez le code `870190.11.0000`. »** 🟢
Il figure à l'annexe 1 du CGI, donc la TVA tombe d'office (art. 128 ter). **[FAIT]** La
SGS a retenu `8701.93.00.1000`, qui n'a aucune qualification agricole et ne figure nulle
part au CGI.

**2. « Poids brut 1 750 kg — vérifiez que la SGS le reprend. »** 🟢
**[FAIT]** La SGS a retenu **8 500 kg**. Un poids multiplié par ~5 multiplie le fret
réparti par ~5, et **[RÈGLE]** chaque franc de fret coûte 1,33 franc de taxe. L'erreur ne
coûte pas 5× le fret : elle coûte 5× le fret **taxé**.

**3. « Votre proforma liste un tracteur. Le connaissement n'en parle pas. »** 🔴
**[FAIT]** Le BL Maersk `271875389`, émis le 22/06, déclare `2 UNIT OF USED CARS` et
`A LOT OF PERSONAL EFFECTS`. Pas de tracteur. **[FAIT]** Le VGM confirme :
17 960 − 14 210 = 3 750 kg de tare, cohérente — **le tracteur n'est pas dans le VGM**.

## 🔑 C'est ici que se trouve la vraie fonctionnalité

Cette troisième alerte est un **diff entre deux documents que Bonzini détient déjà** : la
proforma qu'il aurait reçue en avril, et le connaissement qu'il lit **déjà** via l'API
armateur (`Suivre une référence`, reconnaissance d'armateur, cron de synchronisation).

Elle se déclenche automatiquement **le 22 juin, à l'émission du BL** — soit **deux mois
avant** l'arrivée, et **deux mois et demi avant** la visite douanière. À cette date, un
amendement de manifeste était encore possible.

> **[RÈGLE]** Code CEMAC art. **140.1 a)** : le manifeste est rectifiable **dans les 48 h
> de l'arrivée du navire**. Le 22 juin, la fenêtre était grande ouverte.

**Aucune banque ne peut faire ce diff : elle n'a pas le BL.
Aucun transitaire ne peut le faire : il n'a pas la proforma.
Bonzini est le seul à détenir les deux documents.** C'est la manœuvre 1 et la
manœuvre 2 qui se rejoignent, et c'est la démonstration la plus nette que les deux
produits doivent rester dans la même société.

---

# 6. Le modèle de données

## Le trou, constaté dans le schéma

**[FAIT]** `cargo_shipments.container_number` est `text NOT NULL UNIQUE`. **Un dossier ne
peut donc pas exister avant qu'il y ait un numéro de conteneur.** Or la proforma arrive
deux à quatre mois plus tôt, et le numéro de conteneur n'existe pas encore.

**Conséquence : la commande ne peut pas être un `cargo_shipment`. Il faut une entité en
amont.**

## L'entité manquante

```sql
-- La commande : elle naît à la proforma, bien avant le conteneur.
create table public.cargo_orders (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id),
  beneficiary_id    uuid references public.beneficiaries(id),   -- le fournisseur
  pi_number         text,                                        -- SDLMT20260418AG01
  pi_date           date,
  pi_document_id    uuid references public.cargo_documents(id),  -- le PDF d'origine
  incoterm          text check (incoterm in
                      ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  incoterm_place    text,
  pol_unlocode      text,                                        -- port de chargement
  currency          text not null default 'USD',
  goods_amount      numeric(14,2) not null check (goods_amount > 0),
  gross_weight_kg   numeric(10,2),
  volume_m3         numeric(8,3),
  hs_code           text,                                        -- 12 chiffres Cameroun
  hs_source         text check (hs_source in ('CAMCIS','SGS','DECLARANT','ESTIME')),
  ready_date        date,                                        -- fin de production
  status            text not null default 'DRAFT',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

## La jointure qui rend le groupage possible

**Une commande peut se répartir sur plusieurs conteneurs. Un conteneur porte plusieurs
commandes.** C'est une relation **plusieurs-à-plusieurs**, et c'est *exactement* ce qui
rend la manœuvre 4 réalisable :

```sql
create table public.cargo_order_shipments (
  order_id     uuid not null references public.cargo_orders(id)    on delete cascade,
  shipment_id  uuid not null references public.cargo_shipments(id) on delete cascade,
  primary key (order_id, shipment_id)
);
```

**[HYPO]** Sans cette table, le groupage est structurellement impossible : on ne peut pas
mettre trois clients dans une boîte si le modèle suppose un client par boîte.

## Deux extensions légères

1. **`cargo_packages.order_id`** — aujourd'hui les colis pendent du `shipment`. Au moment
   de la proforma le shipment n'existe pas ; les colis doivent pouvoir pendre de la
   **commande**, puis être affectés à un conteneur.
2. **`cargo_costs` : la dimension estimation.** **[FAIT]** La table a déjà la bonne
   taxonomie (`FREIGHT`, `THC`, `DEMURRAGE`, `CUSTOMS_DUTY`, `CUSTOMS_FEE`, `BESC`,
   `INSURANCE`, `TRUCKING`…) et un booléen `paid`. **C'est déjà le grand livre du coût à
   quai.** Il lui manque seulement de pouvoir porter une **prévision** :
   ```sql
   alter table public.cargo_costs
     add column is_estimate  boolean not null default false,
     add column confidence   text check (confidence in ('CERTAIN','FOURCHETTE','RISQUE')),
     add column amount_low   numeric(14,2),
     add column amount_high  numeric(14,2);
   ```
   Alors le coût à quai **prévu** et le coût à quai **payé** vivent dans la même table, et
   l'écart entre les deux devient mesurable dossier après dossier. C'est ce qui rend la
   prévision suivante plus juste que la précédente — la boucle d'apprentissage.

> ⚠️ **Rappel `CLAUDE.md`** : toute nouvelle RPC porte une étiquette `@mola` dans **la
> même migration**, avec `permission` (`canManageCargo`), `confirm`, et `resolve` sur les
> références. Puis `/gen-types`.

---

# 7. L'écran, et le seul geste demandé au client

**Un seul geste : déposer la proforma.** Tout le reste est proposé, et corrigible.

```
┌───────────────────────────────────────────────────────────┐
│  Nouvelle commande                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │   Déposez votre facture proforma                    │  │
│  │   PDF, photo ou capture WeChat                      │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
        ↓  lecture, puis tout est pré-rempli et modifiable
┌───────────────────────────────────────────────────────────┐
│  SHANDONG LIMAOTONG          PI SDLMT20260418AG01 · 18/04 │
│  Tracteur GJ704-E + rotavator      6 057,10 USD · 1 750 kg│
│  FOB Nansha                                               │
│                                                           │
│  Code SH proposé   870190.11.0000            [modifier]   │
│  Tracteurs agricoles à roues · TVA exonérée (annexe 1)    │
│                                                           │
│  ─────────  COÛT À QUAI DOUALA  ─────────                 │
│  Marchandise                          3 472 000  🟢       │
│  Fret réparti                     600 000–700 000  🟡     │
│  Droit de douane 10 %             400 000–420 000  🟡     │
│  TVA                                    exonérée  🟢      │
│  Passage portuaire et forfaits    190 000–230 000  🟡     │
│  ══════════════════════════════════════════════           │
│  À prévoir                    4 660 000–4 820 000 XAF     │
│                                                           │
│  ⚠️  2 actions pour ne pas payer plus                      │
│  • Soumettez cette proforma à la SGS. Sans facture, la    │
│    valeur peut être multipliée par trois (méthode 6.4).   │
│  • Faites porter 1 750 kg au rapport SGS. Un poids faux   │
│    est taxé 1,33 fois.                                    │
│                                                           │
│  Non compté : surestaries au-delà de 21 jours francs,     │
│  44 413 F/jour.                                           │
└───────────────────────────────────────────────────────────┘
```

**[FAIT]** Règle projet : toute UI passe d'abord par `/frontend-design`. Le bloc ci-dessus
est une **structure d'information**, pas une maquette.

---

# 8. Modes de défaillance

| Risque | Parade |
|---|---|
| **Une proforma chinoise est souvent une image, parfois manuscrite, parfois un tableau WeChat** | L'extraction est une **proposition**, jamais une vérité. Chaque champ reste éditable, et le champ vide est un champ vide, pas un zéro. |
| **Un mauvais code SH engage Bonzini** | Afficher **la source** du code (`CAMCIS` / `SGS` / `déclarant` / `estimé`) — d'où la colonne `hs_source`. Un code « estimé » ne déclenche jamais d'affirmation d'exonération. |
| **Annoncer un coût à quai, c'est promettre** | Le vert s'additionne, le jaune est une fourchette, le rouge est une action. Jamais de total unique sans intervalle. |
| **Le client ne comprend pas pourquoi la facture finale diffère** | L'écart prévu / payé s'affiche **ligne à ligne** dans le même `cargo_costs`, avec la cause. C'est ce qui construit la confiance plutôt que de l'user. |
| **Une proforma contient des données commerciales sensibles** | Le fournisseur d'un client ne doit jamais être visible d'un autre. À traiter par RLS dès la migration, pas après. |

---

# 9. La plus petite version qui soit vraie

Ne pas construire le §7 d'un coup. Construire ceci :

**v0 — le calculateur, sans extraction, à usage interne.**
Un écran admin où l'on saisit **six champs** — montant, devise, poids brut, volume, code
SH, incoterm — et qui rend le coût à quai avec les trois couleurs. Pas de lecture de PDF,
pas de nouvelle table. **Il transforme en produit le savoir déjà écrit dans les modules
5, 6 et 7.** C'est aussi l'outil dont l'ops a besoin dès aujourd'hui, sur les dossiers en
cours.

**v1 — la commande.** `cargo_orders` + `cargo_order_shipments` + `cargo_packages.order_id`.
La proforma existe dans le système, avec ou sans conteneur.

**v2 — l'alerte proforma ↔ connaissement.** Le diff du §5. **C'est la fonctionnalité qui
justifie tout le reste** : elle utilise deux sources que Bonzini est seul à détenir, et
elle se déclenche à l'émission du B/L, quand la fenêtre de l'art. 140.1 a) est encore
ouverte.

**v3 — l'extraction automatique.** Le confort. En dernier, jamais en premier : le savoir
métier est le produit, la lecture de PDF n'est qu'une saisie plus rapide.

---

# 10. Ce que je n'ai pas pu vérifier

1. **Aucun chiffre de volume.** Le connecteur Supabase n'est pas autorisé dans la session
   où cette spec a été écrite. Je n'ai vu ni le nombre de clients actifs, ni le nombre de
   commandes par client et par an, ni la marge par opération. **Tout arbitrage de
   priorité entre v0, v1 et v2 devrait être refait avec la cohorte sous les yeux.**
2. **Les taux TCI, CCI, précompte et redevance informatique** viennent d'un RVC lu en
   séance et **ne sont pas consignés au dépôt**. À reprendre ligne à ligne sur un RVC
   original avant toute mise en production du calculateur.
3. **Le fret réparti de ~645 000 XAF** au §5 est un ordre de grandeur reconstitué, pas une
   cotation. La fourchette affichée à l'écran doit venir de cotations réelles, pas de ce
   chiffre.
4. **La faisabilité de l'appel API armateur au moment de l'émission du B/L** (et non à
   l'arrivée) reste à confirmer côté Maersk et CMA CGM. C'est la condition technique de la
   v2.
