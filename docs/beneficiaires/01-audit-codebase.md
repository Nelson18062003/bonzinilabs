# Phase 1 — Audit codebase (lecture seule)

> **Statut : rendu.** Verdict central : **la fonctionnalité « Bénéficiaires » n'est pas à concevoir
> de zéro — elle est déjà implémentée à ~70 %.** Table, hooks, snapshot, intégration au flux de
> paiement client : tout existe. Ce qui manque est précis et identifiable. L'engagement passe de
> « design greenfield » à **« inventaire + fermeture des trous »**.
>
> Légende : **[V]** vérifié par lecture directe `fichier:ligne` · **[S]** via sonde (sous-agent),
> cohérent avec un autre signal · **[?]** à confirmer.

---

## 0. Stack & architecture (confirmations)

- **[V] Backend partagé.** `supabase` et `supabaseAdmin` pointent sur le **même projet** (même
  `VITE_SUPABASE_URL`), isolés seulement par `storageKey` — `src/integrations/supabase/client.ts:10-36`.
  → Une feature bénéficiaires sert les deux apps via la **même table**.
- **[V] Pas de dossier `shared/`.** Code commun via `src/lib/`, `src/types/`. Validation =
  **Zod + react-hook-form** (`package.json:76,86`). Schémas paiement : `src/components/payment-form/paymentSchemas.ts`.
- **[S] Admin « pour le compte d'un client »** : sélection par **état local** `client` dans le
  wizard, pas par route — `src/mobile/screens/payments/MobileNewPayment.tsx:127`, `user_id` envoyé à
  la création (`:235`).
- **[V] DB = Postgres/Supabase, UTF-8 par défaut**, 122 migrations, aucune collation exotique.
  → **Caractères chinois supportés nativement au stockage** (colonnes `TEXT`). Le piège `utf8mb4`
  (MySQL) ne s'applique pas. *Confirme la reco Q7 côté encodage.*
- **[V] États de paiement** (`payment_status`) — `src/integrations/supabase/types.ts` + migrations :
  `created` → `waiting_beneficiary_info` → `ready_for_payment` → `processing` → `completed` /
  `rejected`, plus `cash_pending`, `cash_scanned`, `cancelled_by_admin`.

---

## 1. Modèle de données ACTUEL du destinataire

### 1.1 Table `beneficiaries` — **existe** (`supabase/migrations/20260304100000_beneficiaries_table.sql`)

| Colonne | Type | Notes (`:ligne`) |
|---|---|---|
| id | UUID PK | `:6` |
| client_id | UUID NOT NULL → `auth.users(id)` **ON DELETE CASCADE** | `:7` |
| payment_method | `public.payment_method` NOT NULL | `:8` |
| name | TEXT **NOT NULL** | `:9` — sert d'identité **ET** de libellé (pas d'alias séparé) |
| identifier | TEXT | `:10` |
| identifier_type | TEXT CHECK in (qr,id,email,phone) | `:11` |
| phone / email | TEXT | `:12-13` |
| bank_name / bank_account / bank_extra | TEXT | `:14-16` (`bank_extra` = SWIFT/agence en texte libre) |
| qr_code_url | TEXT | `:17` |
| is_active | BOOL DEFAULT TRUE | `:18` — **soft-delete prévu mais jamais utilisé** |
| created_at / updated_at | TIMESTAMPTZ (+ trigger) | `:19-39` |

- **[V] Index** : `(client_id, payment_method) WHERE is_active` + `(client_id)` — `:24-25`.
  **Aucun UNIQUE → doublons autorisés** (Q8 non satisfait).
- **[V] Aucune contrainte de complétude par mode** : seuls `name NOT NULL` + le CHECK
  `identifier_type`. → Un bénéficiaire Alipay peut être enregistré **sans** identifiant/téléphone
  (« jamais incomplet » **non garanti en base**).
- **[V] RLS** `:45-76` : client CRUD sur les siens (`auth.uid() = client_id`, dont **DELETE
  physique** `:60-62`) ; admin SELECT/INSERT/UPDATE via `is_admin()` (**pas de DELETE admin**).
  → Scoping par client **correct**, pas de fuite cross-client. *(Confirme la reco sécurité.)*

### 1.2 Snapshot sur `payments` — **fondation déjà en place**

- **[S] Colonnes dénormalisées** sur `payments` : `beneficiary_name/phone/email/qr_code_url/
  bank_name/bank_account/bank_extra/notes/identifier/identifier_type` + `cash_beneficiary_*`
  (migrations `20251220211736`, `20260105181429`, `20260304200000`, `20260421000001`).
- **[S] `beneficiary_id` UUID → `beneficiaries(id)` ON DELETE SET NULL** + **`beneficiary_details`
  JSONB** (`20260304200000_payments_beneficiary_fields.sql`).
- **[V] Le snapshot est réellement constitué à la création** côté client :
  `NewPaymentPage.tsx:136-179` (`buildBeneficiarySnapshot`) copie les champs (du bénéficiaire choisi
  **ou** du brouillon) dans `beneficiary_details` + colonnes dénormalisées passées à `createPayment`
  (`:232-269`).
  → **L'invariant snapshot est techniquement satisfait** : éditer/supprimer un bénéficiaire plus
  tard n'altère pas un paiement passé (FK mise à NULL, copie conservée). **C'est la bonne nouvelle
  fintech.** *(À confirmer [?] : que le RPC `create_payment` persiste bien toutes ces colonnes — lecture RPC à faire.)*

---

## 2. Hooks `src/hooks/useBeneficiaries.ts` — **5 hooks, 2 seulement câblés**

| Hook | `:ligne` | Câblé ? | Preuve |
|---|---|---|---|
| `useBeneficiaries(method)` | `:42` | ✅ | `NewPaymentPage.tsx:101` |
| `useCreateBeneficiary` | `:85` | ✅ | `NewPaymentPage.tsx:60,205` |
| `useUpdateBeneficiary` (édite le **carnet**) | `:135` | ❌ **mort** | aucun call-site |
| `useAdminClientBeneficiaries` | `:181` | ❌ **mort** | aucun call-site |
| `useAdminCreateBeneficiary` | `:222` | ❌ **mort** | aucun call-site |

> ⚠️ **Piège de nommage** : `useUpdateBeneficiaryInfo` (dans `usePayments.ts:300`, utilisé par
> `EditBeneficiaryPage.tsx`) édite **le snapshot du paiement**, PAS l'entrée du carnet. Le hook qui
> édite le carnet (`useUpdateBeneficiary`) n'est appelé nulle part.

---

## 3. Parcours réels

### 3.1 Client — création de paiement (`NewPaymentPage.tsx`, 4 étapes)
- **[V] Choisir un existant** : onglet « Existant » liste `useBeneficiaries(method)` filtré par mode
  (`NewPaymentBeneficiaryStep.tsx:122-166`). ✅
- **[V] Nouveau + enregistré au passage** : `:203-221` → `createBeneficiary.mutateAsync(...)`
  **MAIS** : (a) en **best-effort** avec `catch {}` silencieux (`:218`) — si l'enregistrement
  échoue, le paiement passe quand même, carnet non alimenté ; (b) **uniquement si `draftName`** est
  rempli → un bénéficiaire Alipay/WeChat **sans nom** (nom optionnel dans le form) **n'est pas
  sauvegardé**.
- **[V] Se payer soi-même** : seulement pour **Cash** (`cashBenefType = 'self'`, auto depuis le
  profil — `NewPaymentBeneficiaryStep.tsx:169-208`). **Pas** de « moi-même » pour Alipay/WeChat/virement.
- **[V] Validation = molle** : l'étape bénéficiaire est *informative*, navigation toujours permise
  (`NewPaymentPage.tsx:311-318, 337-348`). Un paiement peut naître sans bénéficiaire complet
  (statut `waiting_beneficiary_info`).

### 3.2 Client — gérer son carnet hors flux → **STUB**
- **[V] `src/pages/BeneficiariesPage.tsx`** (route `/beneficiaries`, `App.tsx:153`) :
  `:9` `// TODO: Implement beneficiaries table and useBeneficiaries hook when ready` ;
  `:11` `const beneficiaries: any[] = []` (codé en dur vide) ; `:21` bouton « + » →
  `toast.info('comingSoon')` ; `:37` texte « comingSoon ».
  → **Liste / ajout / édition / suppression hors flux = inexistants.** Le besoin explicite
  « gérer son carnet » **n'est pas couvert**, alors que les hooks existent pour le faire.
- **[V] `EditBeneficiaryPage.tsx`** (route `/payments/:paymentId/edit-beneficiary`) édite le
  **snapshot d'un paiement**, pas une entrée de carnet.

### 3.3 Admin — `MobileNewPayment.tsx` (5 étapes) → **carnet non branché**
- **[S+V] L'admin re-saisit tout.** Le wizard collecte les champs bénéficiaire en saisie brute ;
  **il n'appelle ni `useAdminClientBeneficiaries` ni `useAdminCreateBeneficiary`** (grep call-sites :
  zéro). Donc l'admin **ne voit pas** le carnet du client et **n'y enregistre pas**.
  → **`exigence_admin` non satisfaite** (voir/choisir/créer dans les bénéficiaires du client).

---

## 4. Caractères chinois — état réel
- **[V] Stockage OK** (TEXT/UTF-8). **[V] Aucune regex ne rejette le CJK** dans les inputs (texte
  libre, pas de `pattern`). Saisie/collage de 张伟 techniquement possible.
- **[V] Trou UX** : pas de **champ alias latin** distinct. `name` est à la fois l'identité (souvent
  chinoise) et le libellé affiché en liste (`NewPaymentBeneficiaryStep.tsx:150-156`). → Si `name`
  est en chinois, le client **ne reconnaît pas** son bénéficiaire — exactement le problème décrit.
  *(C'est le seul vrai manque côté « chinois » : un repère lisible.)*

---

## 5. Synthèse des trous (le « delta » à construire)

| # | Trou | Gravité | Preuve |
|--:|------|---------|--------|
| G1 | **Page carnet `/beneficiaries` = stub** (liste/ajout/édition/suppression hors flux) | 🔴 Bloquant besoin | `BeneficiariesPage.tsx:9-11` |
| G2 | **Admin non câblé** : pas de sélecteur ni de création dans le carnet du client | 🔴 Bloquant `exigence_admin` | hooks morts + `MobileNewPayment` |
| G3 | **Édition/suppression d'une entrée carnet** absente (hooks `useUpdateBeneficiary` mort, pas de delete UI) | 🟠 | call-sites |
| G4 | **Pas d'alias latin** distinct → bénéficiaires chinois illisibles en liste | 🟠 Besoin explicite | `:9, :150-156` |
| G5 | **Complétude par mode non garantie** (validation molle + pas de CHECK DB) | 🟠 Règle « jamais incomplet » | `paymentSchemas` + migration |
| G6 | **Doublons autorisés** (aucun index UNIQUE) | 🟡 | migration `:24-25` |
| G7 | **Sauvegarde best-effort silencieuse** + non-sauvegarde si nom vide | 🟡 | `NewPaymentPage.tsx:203-221` |
| G8 | **Soft-delete prévu (`is_active`) jamais utilisé** ; RLS permet le DELETE physique | 🟡 | migration `:18,60-62` |

**Ce qui est DÉJÀ bon (à ne pas refaire)** : la table polymorphe (= exactement la reco Q1), le
scoping RLS par client (sécurité Q5/Q8), la fondation snapshot sur `payments` (le piège fintique Q4
est déjà désamorcé au niveau données), l'encodage UTF-8 (Q7).

---

## 6. Réponses aux questions critiques (à la lumière du code)

- **QC1 — schéma des champs : RÉSOLU par le code.** Le schéma = la table `beneficiaries` + les
  champs des mini-formulaires par mode (voir §1.1 et le tableau par mode ci-dessous). Rien à
  inventer ; à **compléter** (alias, complétude, dedup).
- **QC2 — corridor : XAF → CNY confirmé** (logique de taux `paymentRateLogic`, `exchange_rate`
  stocké en CNY pour 1M XAF). Le routage bancaire chinois est un **simple champ libre `bank_extra`**
  (« SWIFT/agence ») — pas de CNAPS structuré. *(Décision à prendre : garder libre vs structurer.)*
- **QC3 — portée : RÉGLÉ par le code.** Le carnet est **strictement par client** (`client_id` +
  RLS). Pas d'annuaire partagé. Un client ne voit que les siens ; l'admin voit ceux du client
  concerné. *(= ta reco implicite « seulement créé par le client ».)*
- **QC4 — conformité : NON requise** (ta validation). Rien dans le code ne l'impose. On garde
  `is_active` (actif/archivé) sans `verification_status`.
- **QC5 — états & édition pendant un paiement : proposition ci-dessous.**

### Schéma par mode (état actuel, à valider/compléter)
| Mode | Champs requis aujourd'hui | Optionnels | Manque (reco) |
|---|---|---|---|
| Cash | nom (si « autre »), téléphone | email | alias |
| Alipay / WeChat | *(aucun dur)* — au moins 1 parmi QR/identifiant/tél/email (validation molle) | nom, email | **alias + nom réel requis** |
| Virement | nom titulaire, banque, n° compte | bank_extra | alias ; CNAPS/SWIFT structurés ? |

---

## 7. Proposition QC5 — états de paiement & politique d'édition

**Les états existent déjà** (§0). Le bénéficiaire (carnet) et le paiement sont **découplés** par le
snapshot. Donc :

- **Éditer/supprimer une entrée du carnet est TOUJOURS autorisé**, quel que soit l'état des
  paiements qui l'ont utilisée — car chaque paiement détient sa **copie figée** (`beneficiary_details`
  + colonnes). Aucun blocage nécessaire. *(C'est tout l'intérêt du snapshot déjà en place.)*
- **Suppression = archivage** (`is_active = false`) plutôt que DELETE physique : l'entrée
  disparaît du sélecteur mais le lien `beneficiary_id` des paiements passés reste exploitable pour
  le reporting. *(Aligne G8.)*
- **Compléter-plus-tard** (`waiting_beneficiary_info`) : inchangé. Quand l'admin/le client complète
  le bénéficiaire d'un paiement existant, on met à jour **le snapshot du paiement** (déjà géré par
  `useUpdateBeneficiaryInfo`) et, optionnellement, on propose d'**enregistrer aussi au carnet**.

→ **Aucune machine à états nouvelle.** On réutilise l'existant ; le seul ajout est l'usage de
`is_active` pour l'archivage.

---

## Auto-contrôle Phase 1
- ✅ Lecture seule (aucun code applicatif modifié ; seuls docs écrits).
- ✅ Affirmations sourcées `fichier:ligne`, marquées [V]/[S]/[?].
- ✅ Recherche de code mort/stub/migrations effectuée → **trouvée** (stub G1, hooks morts G2/G3).
- ✅ Règles dures recontrôlées sur le réel : snapshot **déjà OK** (Q4) ; complétude **NON garantie**
  (G5) ; chinois **OK au stockage, trou alias** (G4/Q7) ; scoping **OK** (Q5/Q8) ; doublons **non
  bloqués** (G6).
- ⏳ En attente : ta décision de **direction** (compléter l'existant vs refondre) avant la Phase 2,
  qui devient un **design de delta**, pas une modélisation greenfield.
- 🔭 [?] restant à lire en Phase 2 si on avance : le corps des RPC `create_payment` /
  `create_admin_payment` (confirmer la persistance du snapshot) et le détail de l'étape bénéficiaire
  admin dans `MobileNewPayment.tsx`.
