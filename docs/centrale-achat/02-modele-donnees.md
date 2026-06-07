# Phase 2 — Modèle conceptuel & entités (conçu AI-first)

> **Statut : rendu, en attente de validation.** Design du modèle de données du **Cœur 360°**
> (périmètre MVP validé). Niveau « conception » (entités + colonnes + relations + RLS + modèle
> d'argent + crochets IA), **pas** le SQL de migration (Phase 6). Aucun code applicatif écrit.
>
> **Décisions verrouillées (Phase 0-1) :** agent à **commission** · **étendre Mola** · **custody
> Cas 3** (attestation autonome *ou* lien rail) · commission **double mode** (% ou montant) ·
> reporting **interne + PDF généré** (pas de portail client au MVP) · périmètre **Cœur 360°**.
>
> **Légende :** 🟢 vérifié (`fichier:ligne`) · 🟡 design proposé · 🔴 à confirmer avec toi.

---

## 1. Principes directeurs

1. **Greenfield à côté de l'existant.** Nouvelles tables `proc_*`, aucun `ALTER` sur les tables
   critiques (`clients`, `wallets`, `ledger_entries`, `payments`, `user_roles`). On **réutilise** :
   `clients` (le donneur d'ordre), `payments`/`ledger_entries` (le rail, quand l'argent y passe),
   `admin_audit_logs` (audit), les buckets Storage, le mécanisme `@mola`. *(Trajectoire identique aux
   modules trésorerie et bénéficiaires.)*
2. **On copie le moule trésorerie** (`supabase/migrations/20260515000002_treasury_schema.sql`) :
   enums dédiés, helper `can_access_procurement()` SECURITY DEFINER, `created_at/created_by`,
   **écritures uniquement via RPC SECURITY DEFINER** (RLS = SELECT seul), append-only + voiding par
   contre-écriture sur le money-bearing, vues dérivées `security_invoker = true`.
3. **AI-first, pas IA-bolt-on.** Trois exigences structurantes dès le schéma :
   - **toute action = une RPC `SECURITY DEFINER` taguée `@mola`** (Mola la découvre, parité testée) ;
   - **tout document est joignable comme preuve** (`proc_documents`) — les valeurs sont saisies à la
     main (formulaire) ou dictées à Mola, **aucune analyse** de document (décision produit) ;
   - **toute entité a une référence humaine** (`BZ-MS-…`, `BZ-PO-…`) résolvable par Mola (pas d'UUID
     à taper).
4. **Append-only sur l'argent, mutable+audité sur le descriptif.** Les paiements fournisseurs et les
   verdicts QC sont **append-only** (on annule par contre-écriture, on n'édite pas) ; les fiches
   descriptives (mission, fournisseur, produit) sont **mutables** avec `updated_at` + `admin_audit_logs`.
5. **Précision `NUMERIC(20,8)`** sur tout montant/taux (cohérent trésorerie). Devise explicite par
   montant (la plupart en **CNY**, certains en XAF).
6. **Anti-over-engineering assumé** : pas de catalogue SKU global (les produits sont des **lignes de
   commande**), pas de ledger double-entrée procurement (le « reste à payer » est **dérivé**), pas de
   moteur d'incoterms/douane (un **enum** + un estimateur simple). Module expédition & compliance
   CEMAC = **incréments post-MVP** (mais je réserve les champs).

---

## 2. Vue d'ensemble (ERD textuel)

```
   clients (existant, user_id)                         user_roles (existant)
        │ 1                                                  ▲ rôle "sourcing_agent" (père)
        │                                                    │
        ▼ N                                            can_access_procurement()
   proc_missions ──1───N──► proc_purchase_orders ──N──1──► proc_suppliers  (PARTAGÉ, org-wide)
        │                          │  │  │  │                     ▲
        │ 1                        │  │  │  └─1──N─► proc_order_lines (produit/SKU, HS code)
        │                         1│ 1│ 1│
        ▼ N                        │  │  └────N──► proc_qc_inspections (type, AQL, pass/fail → gate solde)
   proc_expenses                   │  └───────N──► proc_production_events (jalons)
                                   └──────────N──► proc_supplier_payments (acompte/solde)
                                                          │
                                                          ├─ Cas 1: attestation autonome (cash/alipay/wechat)
                                                          └─ Cas 2: rail_payment_id ─► payments (existant)
   proc_documents (polymorphe, PREUVES jointes — aucune analyse) ──► mission/supplier/PO/payment/qc
   proc_commissions ──► par PO (et agrégat mission), double-mode (% | montant), coût usine vs prix client
```

---

## 3. Entités (conception)

> Colonnes communes à toutes : `id UUID PK`, `created_at TIMESTAMPTZ`, `created_by UUID`,
> `updated_at` (sur les mutables). Money-bearing : + `voided_at/voided_by/void_reason`.

### 3.1 `proc_suppliers` — annuaire fournisseur **PARTAGÉ** (org-wide) 🟡

Le fournisseur (usine) est une **master-data partagée entre clients** (position #3 validée) : même
usine Foshan → plusieurs importateurs. Modelé comme `treasury_counterparties` (org-wide, RLS par
helper), enrichi.

| Colonne | Type | Notes |
|---|---|---|
| `display_name` | TEXT NOT NULL | nom usuel (latin) — repère lisible |
| `legal_name` | TEXT | raison sociale (souvent 中文) |
| `supplier_kind` | enum (`factory`,`trading_company`,`unknown`) | **usine vs négociant** (impacte prix/qualité, §C.3 Phase 1) |
| `category` | TEXT[] | catégories produits (meubles, voitures, fenêtres…) |
| `city` / `province` | TEXT | localisation (Guangzhou, Yiwu…) |
| `address` | TEXT | adresse usine |
| `wechat_id` / `phone` / `email` | TEXT | contacts (le WeChat du commercial surtout) |
| `verification_status` | enum (`unverified`,`docs_seen`,`visited`,`audited`) | **signal de confiance** — séparé du reste |
| `verification_notes` | TEXT | licence vue, vidéo usine, etc. |
| `is_active` / `archived_at` | bool / ts | soft-archive, pas de DELETE |

- **Scorecard dérivée (vue)** : `% à l'heure`, `% QC pass`, `nb commandes`, `volume total` —
  **calculée** depuis PO/QC/paiements, pas stockée (anti-doublon). *(Invariant emprunté #2 : confiance
  ≠ performance, deux signaux séparés.)*
- **Confidentialité prix** : l'identité du fournisseur est partagée ; **les prix/remises négociés
  vivent sur la commande** (`proc_order_lines` / `proc_commissions`), jamais sur la fiche fournisseur
  → pas de fuite de prix entre clients.
- **Index** : `(supplier_kind, is_active)`, `display_name` (recherche), `category` GIN.

### 3.2 `proc_missions` — le projet d'achat 🟡

Un séjour/projet d'achat d'**un** client. Rattaché à `clients.user_id` (🟢 `clients`,
`types.ts:158-237`).

| Colonne | Type | Notes |
|---|---|---|
| `reference` | TEXT UNIQUE | **`BZ-MS-YYYY-NNNN`** (miroir `generate_deposit_reference`) |
| `client_user_id` | UUID FK auth.users | le donneur d'ordre (= `clients.user_id`) |
| `label` | TEXT NOT NULL | « Mission Cameroun-Guangzhou mai 2026 » |
| `location` | TEXT | ville(s) de la mission |
| `started_on` / `ended_on` | DATE | **back-dating** assumé (catch-up mai 2026) |
| `status` | enum (`active`,`closed`,`archived`) | |
| `summary_note` | TEXT | contexte libre |

- **Catch-up rétroactif** : `started_on/ended_on` + `occurred_at` sur les paiements permettent de
  reconstruire mai 2026 avec ses vraies dates (≠ `created_at`).

### 3.3 `proc_purchase_orders` — la commande (colonne vertébrale) 🟡

Invariant emprunté #1. Une PO = un fournisseur, dans une mission.

| Colonne | Type | Notes |
|---|---|---|
| `reference` | TEXT UNIQUE | **`BZ-PO-YYYY-NNNN`** |
| `mission_id` | UUID FK `proc_missions` | |
| `supplier_id` | UUID FK `proc_suppliers` | |
| `currency` | enum (`CNY`,`XAF`) | quasi toujours CNY |
| `total_amount` | NUMERIC(20,8) | montant total négocié (somme des lignes, ou saisi) |
| `deposit_pct` | NUMERIC(5,2) | défaut **30** (éditable) — §A.2 Phase 1 |
| `incoterm` | enum (11 termes) | **enum, jamais texte libre** (§A.3) ; défaut FOB |
| `status` | enum (cf. §3.6) | cycle production |
| `expected_ready_date` | DATE | délai production annoncé |
| `notes` | TEXT | |

- **Reste à payer (dérivé)** : `total_amount − Σ paiements actifs` → vue, pas colonne.
- **CBM / shipment** : champs réservés (`total_cbm`, `incoterm`) pour le module expédition post-MVP.

### 3.4 `proc_order_lines` — produit / SKU (ligne de commande) 🟡

Pas de catalogue global (anti-over-engineering) : le produit **est** une ligne de PO.

| Colonne | Type | Notes |
|---|---|---|
| `purchase_order_id` | UUID FK | |
| `description` | TEXT NOT NULL | « chaises bureau modèle X » (latin + 中文 OK) |
| `specs` | JSONB | dimensions, couleurs, matériaux (libre) |
| `quantity` | NUMERIC(20,8) | |
| `unit` | TEXT | pcs, cartons, palettes… |
| `unit_price` | NUMERIC(20,8) | prix unitaire négocié (CNY) |
| `moq` | NUMERIC(20,8) | **par produit** (flexe par spec, §C.3) |
| `lead_time_days` | INT | **par produit** (≈ post-approbation sample) |
| `hs_code` | TEXT | **code HS** → futur estimateur coût de revient CEMAC (§A.6) |

### 3.5 `proc_supplier_payments` — acomptes/soldes (**append-only**, Cas 3) 🟡

**Le cœur du modèle d'argent.** Mirroir `usdt_purchases` (append-only + voiding). Supporte **Cas 1
(attestation)** ET **Cas 2 (lien rail)**.

| Colonne | Type | Notes |
|---|---|---|
| `reference` | TEXT UNIQUE | **`BZ-SP-YYYY-NNNN`** |
| `purchase_order_id` | UUID FK | |
| `leg` | enum (`deposit`,`balance`,`final`,`extra`) | type de versement |
| `amount` | NUMERIC(20,8) CHECK >0 | montant |
| `currency` | enum (`CNY`,`XAF`) | |
| `method` | enum (`cash`,`alipay`,`wechat`,`bank_transfer`,`other`) | canal |
| `occurred_at` | TIMESTAMPTZ NOT NULL | **date réelle** (back-dating) |
| `settlement_mode` | enum (`attestation`,`rail`) | **Cas 1 vs Cas 2** |
| `rail_payment_id` | UUID FK `payments` | **rempli si `rail`** (lien, pas copie) → 🟢 `payments`, `types.ts:621-762` |
| `paid_by` | enum (`client_direct`,`father_onsite`,`bonzini`) | qui a remis |
| `external_ref` | TEXT | réf. T/T / capture |
| `voided_at/by/reason` | | annulation par contre-attestation |

- **Anti-double-comptage** : si `settlement_mode = rail`, le montant *financier* vit déjà dans
  `payments`/`ledger_entries` ; le `proc_supplier_payment` est la **vue commerciale** (« cet argent =
  l'acompte 30 % de la PO BZ-PO-… »). Les rapports somment **soit** les attestations **soit** les
  legs rail liés, jamais les deux pour le même flux. 🔴 *Règle de réconciliation à valider.*
- **Gate solde** : l'UI/RPC empêche (ou alerte) le `balance` tant que le QC PSI n'est pas `pass`
  (§A.4) — *best practice argent = jalons*.

### 3.6 `proc_production_events` — jalons de production (append-only) 🟡

Timeline d'états (invariant #1, façon Anvyl). Append-only (chaque transition = une ligne).

`status` enum : `po_confirmed` → `materials_purchased` → `in_production` → `production_done` →
`ready_for_qc` → `shipped`. Colonnes : `purchase_order_id`, `status`, `occurred_at`, `note`,
`evidence_document_id?`.
- Le statut « courant » de la PO = dernier event (vue dérivée).

### 3.7 `proc_qc_inspections` — contrôle qualité (append-only) 🟡

| Colonne | Type | Notes |
|---|---|---|
| `purchase_order_id` | UUID FK | |
| `inspection_type` | enum (`PPI`,`DUPRO`,`PSI`,`loading`) | §A.4 |
| `inspector_kind` | enum (`internal`,`third_party`) | père vs SGS/QIMA — 🔴 §E #7 |
| `inspector_name` | TEXT | |
| `aql_level` | TEXT | défaut « II / 0-2.5-4.0 » |
| `result` | enum (`pass`,`fail`,`conditional`) | **gate du solde** |
| `defects` | JSONB | critiques/majeurs/mineurs (libre) |
| `occurred_at` | TIMESTAMPTZ | |
| `report_document_id` | UUID FK `proc_documents` | rapport/photos |

### 3.8 `proc_commissions` — rémunération Bonzini (double mode) 🟡

Ta réponse : Bonzini fixe la valeur, **en % OU en montant**, le système calcule l'autre.

| Colonne | Type | Notes |
|---|---|---|
| `mission_id` | UUID FK | (ou `purchase_order_id` pour une commission par commande) |
| `purchase_order_id` | UUID FK nullable | granularité PO si besoin |
| `input_mode` | enum (`percentage`,`fixed_amount`) | **ce que tu as saisi** |
| `input_value` | NUMERIC(20,8) | le % ou le montant saisi |
| `base_amount` | NUMERIC(20,8) | assiette (total PO/mission) |
| `computed_pct` | NUMERIC(20,8) GENERATED | si `fixed` → `input_value/base*100` |
| `computed_amount` | NUMERIC(20,8) GENERATED | si `percentage` → `base*input_value/100` |
| `factory_cost` | NUMERIC(20,8) | **coût usine** (pour le markup) |
| `client_price` | NUMERIC(20,8) | **prix facturé client** (tout-compris) |
| `negotiated_discount` | NUMERIC(20,8) | remise arrachée au fournisseur (marge interne) |
| `client_visible` | BOOLEAN | **transparence (Q6)** : la commission est-elle montrée au client ? défaut **false** |

- **Visibilité par rôle** : même en MVP interne, on stocke `factory_cost`/`client_price`/`discount`
  pour préparer le portail client (où le client ne verra que `client_price` + éventuel « frais de
  service », jamais `factory_cost` ni `negotiated_discount`).

### 3.9 `proc_documents` — coffre de **preuves** (révisé : aucune analyse) 🟡

Polymorphe, rattaché à n'importe quelle entité. **Décision produit : les documents sont des PREUVES
jointes, jamais analysés (pas d'OCR/vision).** Les vraies données sont saisies à la main (formulaire
ou dictée à Mola) ; le document confirme visuellement.

| Colonne | Type | Notes |
|---|---|---|
| `entity_type` | enum (`mission`,`supplier`,`purchase_order`,`supplier_payment`,`qc`,`order_line`) | rattachement |
| `entity_id` | UUID | |
| `doc_type` | enum (`invoice_photo`,`payment_receipt`,`pi`,`contract`,`qc_report`,`packing_list`,`bill_of_lading`,`wechat_screenshot`,`product_photo`,`other`) | nature de la preuve |
| `file_url` | TEXT | bucket `procurement-docs` (pattern `{owner}/...`), compression à l'upload |
| `file_name` / `file_type` | TEXT | |
| `caption` | TEXT | légende libre saisie par l'humain (pas d'extraction) |
| `uploaded_by_kind` | enum (`father`,`admin`,`client`) | |

- **Pas de colonnes OCR** (`ocr_status/ocr_extracted/ocr_confidence` supprimées) ni d'analyse de
  langue. Le fichier sert de **preuve consultable**, attachée à la mission/commande/paiement/QC.
- **Append-only** : on n'efface pas une preuve, on l'archive.

### 3.10 `proc_expenses` — frais de mission 🟡

`mission_id`, `category` enum (`hotel`,`transport`,`driver`,`meals`,`other`), `amount`, `currency`,
`occurred_at`, `billable_to_client BOOLEAN`, `receipt_document_id?`. Append-only + void.

---

## 4. Master-data partagée vs par-client (la décision structurante)

| Entité | Portée | RLS (MVP interne) | Justification |
|---|---|---|---|
| `proc_suppliers` | **Partagée org-wide** | SELECT si `can_access_procurement()` | même usine ↔ N clients ; scorecard transverse ; signalement qualité global (position #3) |
| `proc_missions`, `_purchase_orders`, `_order_lines`, `_supplier_payments`, `_qc_*`, `_documents`, `_commissions`, `_expenses` | **Par mission → client** (`client_user_id` via la mission) | SELECT si `can_access_procurement()` (MVP : père+toi voient tout) | transactions privées d'un client |

- **MVP interne (validé)** : pas de login client → la RLS procurement = « les utilisateurs
  procurement voient tout ». Le `client_user_id` sert au **filtrage/rapport**, pas à isoler le client
  (il n'a pas d'accès).
- **Forward-compat portail client (post-MVP)** : le jour où le client se connecte, on ajoute une
  policy `client_user_id = auth.uid()` (lecture seule de SA mission) — additive, sans refonte. Les
  prix usine/remises (`proc_commissions.factory_cost/negotiated_discount`) restent **non exposés**.
- **Prix privés** : un fournisseur partagé ne porte aucun prix ; les prix vivent sur les lignes de
  commande d'un client → pas de fuite cross-client.

---

## 5. Le modèle d'argent (Cas 3) — comment ça se branche au rail existant

```
 Cas 1 (attestation)         proc_supplier_payments (settlement_mode='attestation')
   cash/alipay/wechat   ───►  = SEULE source de vérité (argent hors Bonzini)
   payé en direct             + preuve (proc_documents: payment_receipt)

 Cas 2 (rail)                proc_supplier_payments (settlement_mode='rail', rail_payment_id=…)
   via wallet Bonzini   ───►  ─► payments (existant) ─► ledger_entries (existant)
                              le montant financier vit dans le rail ; le proc_payment = vue commerciale
```

- **Pas de nouveau ledger procurement** : le « reste à payer » par PO/mission est **dérivé**
  (`total − Σ paiements actifs`). Pour le Cas 2, l'argent réel est déjà tracé par
  `ledger_entries` (🟢 `types.ts:453-507`, append-only, `balance_before/after`).
- **Réconciliation** : 🔴 à valider — quand `rail`, on rapproche `proc_supplier_payment.amount` ↔
  `payments.amount_rmb` (devise CNY). Un écart = alerte.
- **Exposition financière interne** (« reste à payer global, marge Bonzini ») = vues agrégées sur
  `proc_purchase_orders` + `proc_commissions`.

---

## 6. Append-only, voiding & audit trail

- **Append-only + void** (contre-écriture, jamais DELETE) sur : `proc_supplier_payments`,
  `proc_qc_inspections`, `proc_production_events`, `proc_expenses` — exactement le pattern
  `usdt_purchases`/`treasury_ledger_entries` (🟢 migration `20260515000002:130-220`, RLS `269-303`).
- **Mutable + audit** sur les descriptifs (`proc_suppliers`, `proc_missions`, `proc_purchase_orders`,
  `proc_order_lines`) : `updated_at` + une ligne `admin_audit_logs` (🟢 `types.ts:41-69`) par mutation
  via RPC.
- **Toute RPC sensible journalise** dans `admin_audit_logs` (déjà la convention du projet).

---

## 7. Couche AI-first (crochets posés ici, design complet en Phase 3)

1. **Chaque écriture = une RPC `SECURITY DEFINER` taguée `@mola`.** Format (🟢 `mola_discover_capabilities`,
   migration `20260603150000` ; tags `20260603180000`) :
   ```sql
   comment on function public.proc_record_supplier_payment(...) is
     '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,
       "danger":true,"label":"Enregistrer un paiement fournisseur","resolve":{"p_po":"purchase_order"}}';
   ```
   → Mola **découvre** l'action sans outil codé à la main ; la **parité** est testée
   (`eval/assistant/parity.test.ts`).
2. **Saisie conversationnelle (pas d'OCR)** : le père **dicte les valeurs** (« pour tel fournisseur,
   montant…, acompte…, commission… ») → Mola mappe vers les params RPC → carte de confirmation →
   écriture. **Aucune analyse de document.** Les photos sont jointes en **preuves** (`proc_documents`).
   Coût ≈ inférence conversationnelle seule (pas de tokens image).
3. **Résolution de référence** : `BZ-MS-…`, `BZ-PO-…`, `BZ-SP-…`, fournisseur par nom → UUID (façon
   `resolveRef`, Mola `index.ts`). Le père dit « le fournisseur de meubles », pas un UUID.
4. **RAG métier** : le glossaire Phase 1 (incoterms, AQL, **compliance CEMAC**, cycle PI/PO/CI) →
   couche sémantique `mola_memory` → Mola répond aux questions métier sans halluciner (tue P0-C).
5. **Outils de lecture** taguย `@mola` : `proc_mission_report`, `proc_supplier_360`,
   `proc_outstanding_balances`, `proc_overdue_qc`, etc. → c'est ce qui répond à « génère le rapport
   mission mai », « combien reste-t-il à payer au fournisseur Y », « quels QC en retard > 7 j ».

---

## 8. Permissions & rôle du père 🔴

- **2 clés à ajouter** à la matrice (🟢 `src/contexts/AdminAuthContext.tsx:20-120`) :
  `canViewProcurement`, `canManageProcurement`.
- **Helper SQL** `can_access_procurement(_user_id)` (miroir `can_access_treasury`,
  `20260515000002:75-89`).
- **Rôle du père** : 🔴 **à trancher** — (a) nouveau rôle `sourcing_agent`, (b) réutiliser
  `treasurer` (il l'a déjà), (c) `super_admin`. *Reco : (a) `sourcing_agent` dédié* (séparation des
  pouvoirs — il pilote le sourcing, pas la trésorerie ni les autres admins). Affectation :
  super_admin + sourcing_agent → view+manage ; ops → view seul (🔴 ?).

---

## 9. Coût par décision (chiffré)

| Décision | Poste | Coût |
|---|---|---|
| Schéma `proc_*` (10 tables) | Postgres Supabase déjà payé | **~0 $** marginal |
| Documents (`procurement-docs` bucket) | Storage Supabase | quelques $/mois ; **politique de compression** (pré-resize ~1600px) pour éviter la dérive sur scans HD 🔴 |
| ~~OCR/vision~~ | **supprimé** (pas d'analyse de doc) | **0 $** |
| Inférence Mola (saisie conversationnelle + Q&A + rapports) | Sonnet 4.6, cache outils | marginal (~1-4 ¢/conv) |
| RAG procurement (embeddings glossaire) | gte-small Supabase.ai | **~1-5 $/mois** |
| **Total IA additionnel** | | **~quelques $/mois** 🟡 (bien moins sans OCR ; à instrumenter comme Mola) |

---

## 10. Questions à trancher avant la Phase 3

1. 🔴 **Réconciliation Cas 2** : règle de rapprochement `proc_supplier_payment` ↔ `payments` quand
   `settlement_mode='rail'` (devise CNY = `payments.amount_rmb`) — tolérance d'écart ?
2. 🔴 **Rôle du père** : `sourcing_agent` dédié (reco), `treasurer` réutilisé, ou `super_admin` ?
3. 🔴 **Gate du solde** : bloquer *dur* le paiement `balance` si QC ≠ `pass`, ou seulement **alerter**
   (le père peut passer outre avec justification) ? *Reco : alerte + justification (réalité terrain).*
4. 🔴 **Granularité commission** : par **mission**, par **PO**, ou les deux ? *Reco : les deux
   (champ nullable `purchase_order_id`).*
5. 🔴 **QC** : interne (père) seulement au MVP, ou prévoir tiers (SGS/QIMA) dès le schéma ? *(le
   schéma le supporte déjà via `inspector_kind` — c'est une question d'UX/priorité.)*
6. 🔴 **Frais de mission** : dans le MVP ou incrément suivant ? *(coût quasi nul, je le garde sauf
   avis contraire.)*

---

## 11. Validations du porteur produit (reçues après rendu)

- **Rôle du père (Q2)** → il **garde `treasurer`** + reçoit un **nouveau rôle `sourcing_agent`** avec
  tout le contrôle procurement. *(Un user peut cumuler des rôles : `user_roles` UNIQUE(user_id, role)
  → plusieurs lignes. `can_access_procurement()` matchera `super_admin` OU `sourcing_agent`.)*
- **Gate solde ↔ QC (Q3)** → **alerte + justification écrite** (souple), pas de blocage dur. Le père
  peut enregistrer le solde sans QC `pass`, mais le système avertit et exige un motif.
- **QC interne/tiers (Q5)** → **les deux** : équipe Bonzini (`internal`) **ou** cabinet tiers
  (`third_party`). `inspector_kind` couvre déjà.
- **Réconciliation Cas 2 (Q1)** → **tolérance 0, tout écart = alerte** (reco acceptée).
- **Granularité commission (Q4)** → **par mission ET par PO** (`purchase_order_id` nullable) (acceptée).
- **Frais de mission (Q6)** → **gardés au MVP** (acceptée).

→ Phase 2 close. Reste **Q-réconciliation détail** (mécanisme exact) à raffiner en Phase 6.

## Auto-contrôle Phase 2

- ✅ **Conçu AI-first** : RPC `@mola` pour toute écriture (saisie manuelle/dictée, **pas d'OCR**),
  `proc_documents` = preuves jointes, références humaines résolvables, RAG métier prévu.
- ✅ **Réutilise l'existant** (`clients`, `payments`, `ledger_entries`, `admin_audit_logs`, Storage,
  `@mola`) ; **greenfield** sinon ; **copie le moule trésorerie** (`fichier:ligne`).
- ✅ **Cas 3 modélisé** (attestation autonome + lien rail, anti-double-comptage).
- ✅ **Commission double-mode** (% ou montant → l'autre dérivé) + markup (coût usine/prix client).
- ✅ **Master-data partagée** (fournisseur org-wide) **vs par-client** (transactions) + prix privés.
- ✅ **Append-only + voiding + audit** sur l'argent ; mutable+audité sur le descriptif.
- ✅ **Persona père** : back-dating (catch-up mai 2026), ingestion-first, références humaines.
- ✅ **Compliance CEMAC & expédition** : champs réservés, hors MVP (périmètre validé).
- ✅ **Coût chiffré par décision** (~10-40 $/mois IA additionnel).
- ✅ **Pas de SQL/code** : conception seule.
- ⏳ **En attente** : réponses aux 6 questions §10 → puis **Phase 3 (couche IA en détail)**.
