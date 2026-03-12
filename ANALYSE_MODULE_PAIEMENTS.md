# Analyse du Module Paiements — Bonzini Platform

**Date :** 12 mars 2026
**Version :** 1.0
**Auteur :** Analyse automatique du code source
**Branche :** `claude/analyze-payment-flow-We7Hl`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Cycle de vie d'un paiement](#2-cycle-de-vie-dun-paiement)
3. [Modes de paiement](#3-modes-de-paiement)
4. [Bénéficiaires](#4-bénéficiaires)
5. [Taux de change](#5-taux-de-change)
6. [Solde client](#6-solde-client)
7. [Preuves de paiement](#7-preuves-de-paiement)
8. [Fiche paiement — Interface admin](#8-fiche-paiement--interface-admin)
9. [Problèmes et incohérences identifiés](#9-problèmes-et-incohérences-identifiés)
10. [Annexes](#10-annexes)

---

## 1. Vue d'ensemble

### 1.1 Architecture technique

La plateforme Bonzini est une application web React + TypeScript utilisant Supabase (PostgreSQL) comme backend. Le module paiements couvre :

- **App Admin** (mobile-first, React) : gestion complète des paiements clients
- **App Client** (mobile web) : création et suivi de paiements
- **Agent Cash** (app dédiée) : scan et confirmation des paiements en espèces
- **Backend** : Supabase PostgreSQL avec fonctions RPC SECURITY DEFINER, RLS, et Supabase Storage

**Stack technique :**
- Frontend : React 18, TypeScript, TailwindCSS, React Query (TanStack)
- Backend : Supabase PostgreSQL 15, Row Level Security, Edge Functions
- PDF : @react-pdf/renderer v4.3.2
- Storage : Supabase Storage (buckets `payment-proofs`, `cash-signatures`)

### 1.2 Tables Supabase impliquées

| Table | Rôle | Statut |
|---|---|---|
| `payments` | Table principale des paiements | Actif |
| `payment_proofs` | Preuves de paiement (client + admin) | Actif |
| `payment_timeline_events` | Historique chronologique des événements | Actif |
| `wallets` | Solde XAF de chaque client | Actif |
| `ledger_entries` | Livre de comptes (tous mouvements de solde) | Actif (depuis fév. 2026) |
| `wallet_adjustments` | Ajustements manuels de solde | Actif |
| `wallet_operations` | Ancien livre de comptes (legacy) | **Legacy — plus alimenté pour les paiements** |
| `beneficiaries` | Bénéficiaires sauvegardés par client | Actif (depuis mars 2026) |
| `daily_rates` | Taux journaliers par méthode de paiement | Actif (depuis mars 2026) |
| `rate_adjustments` | Ajustements % par pays et palier | Actif |
| `exchange_rates` | Anciens taux de change | **Legacy — remplacé par daily_rates** |
| `admin_audit_logs` | Journal d'audit des actions admin | Actif |
| `notifications` | Notifications push client | Actif |

### 1.3 Schéma des relations

```
auth.users
    │
    ├── wallets (1:1)
    │       └── ledger_entries (1:N)
    │       └── wallet_adjustments (1:N)
    │
    ├── payments (1:N)
    │       ├── payment_proofs (1:N)
    │       ├── payment_timeline_events (1:N)
    │       └── beneficiaries (N:1, nullable FK)
    │
    └── beneficiaries (1:N)

user_roles → app_role ENUM (super_admin | ops | support | customer_success | cash_agent)

daily_rates (global, pas par user)
rate_adjustments (global : pays + paliers)
```

### 1.4 Roles et permissions

| Rôle | Voir paiements | Traiter paiements | Gérer taux | Voir clients | Gérer users |
|---|---|---|---|---|---|
| `super_admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ops` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `support` | ✓ | ✗ | ✗ | ✓ | ✗ |
| `customer_success` | ✓ | ✗ | ✗ | ✓ | ✗ |
| `cash_agent` | ✓ (limité) | ✓ (cash uniquement) | ✗ | ✗ | ✗ |

---

## 2. Cycle de vie d'un paiement

### 2.1 Tous les statuts possibles

**ENUM `payment_status` :**

| Statut | Label FR | Description |
|---|---|---|
| `created` | Créé | Paiement venant d'être créé |
| `waiting_beneficiary_info` | En attente d'infos | Infos bénéficiaire manquantes |
| `ready_for_payment` | Prêt à payer | Toutes les infos sont présentes |
| `processing` | En cours | Admin a démarré le traitement |
| `completed` | Terminé | Paiement effectué avec succès |
| `rejected` | Refusé | Paiement refusé par l'admin |
| `cash_pending` | En attente (Cash) | QR code généré, en attente de scan |
| `cash_scanned` | Scanné (Cash) | QR code scanné par l'agent |

### 2.2 Flow standard (Alipay / WeChat / Virement bancaire)

```
                    ┌─────────────────────────────────┐
                    │ Bénéficiaire fourni à la création │
                    └─────────────┬───────────────────┘
                                  │ OUI
[created] ──────────────────────►[ready_for_payment]──►[processing]──►[completed]
    │                                    ▲                   │
    │ NON (pas d'infos bénéficiaire)     │                   └──►[rejected]
    ▼                                    │
[waiting_beneficiary_info]───────────────┘
    (client ou admin fournit les infos)
```

**Règles de transition — fonction SQL `process_payment(id, action, comment)` :**

| Action | Statut requis | Résultat |
|---|---|---|
| `start_processing` | `ready_for_payment` uniquement | → `processing` |
| `complete` | `processing` uniquement | → `completed` |
| `reject` | Tout sauf `completed` | → `rejected` (raison obligatoire) |

### 2.3 Flow Cash

```
[created] ──► [cash_pending] ──► [cash_scanned] ──► [completed]
```

- `cash_pending` : automatique à la création d'un paiement `cash`
- `cash_scanned` : déclenché par l'agent cash via RPC `scan_cash_payment`
- `completed` : déclenché par l'agent via RPC `confirm_cash_payment` (capture de signature)

**Note :** Les paiements cash ne passent PAS par `process_payment`. Ils ont leur propre RPC (`scan_cash_payment`, `confirm_cash_payment`). Un admin ne peut pas manuellement valider un paiement cash bloqué en `cash_pending` via l'UI normale — **c'est une lacune identifiée**.

### 2.4 Effets de bord de chaque transition

| Transition | Wallet client | Ledger entry | Timeline event | Notification client |
|---|---|---|---|---|
| **Création** | `-amount_xaf` (débit immédiat) | `PAYMENT_RESERVED` | `created` (+ `waiting_info` si pas d'infos) | `payment_created` |
| `→ processing` | aucun | aucun | `processing` | `payment_processing` |
| `→ completed` | aucun | `PAYMENT_EXECUTED` (informatif) | `completed` | `payment_completed` |
| `→ rejected` | `+amount_xaf` (remboursement) | `PAYMENT_CANCELLED_REFUNDED` | `rejected: [raison]` | `payment_rejected` |
| **Suppression** (non-super) | `+amount_xaf` si statut ≠ `rejected` | `wallet_operations` (legacy) | — | — |
| **Suppression** (super_admin) | `+amount_xaf` si ≠ `rejected` ET ≠ `completed` | — | — | — |
| `cash: → cash_scanned` | aucun | aucun | `cash_scanned` | — |
| `cash: → completed` | aucun | `PAYMENT_EXECUTED` | `completed` | `payment_completed` |

**Point critique :** Le solde est débité **dès la création**, pas à la validation. Un paiement `waiting_beneficiary_info` a déjà été débité.

---

## 3. Modes de paiement

### 3.1 ENUM `payment_method`

```
alipay | wechat | bank_transfer | cash
```

### 3.2 Alipay

**Champs spécifiques :**
- `beneficiary_qr_code_url` : QR code Alipay (principal — upload vers bucket)
- `beneficiary_phone` : identifiant de compte Alipay (téléphone)
- `beneficiary_email` : identifiant de compte Alipay (email)
- `beneficiary_name` : nom du bénéficiaire (optionnel)

**Condition `ready_for_payment` :** Si QR code OU nom OU phone/email présent

**Affichage dans la fiche :** QR code affiché en grand, identifiant texte en dessous

**Sur le reçu PDF :** Section "Bénéficiaire" avec label "Identifiant Alipay" → `beneficiary_email`

### 3.3 WeChat Pay

**Champs spécifiques :**
- `beneficiary_qr_code_url` : QR code WeChat (principal)
- `beneficiary_phone` : identifiant WeChat
- `beneficiary_name` : nom du bénéficiaire (optionnel)

**Condition `ready_for_payment` :** Si QR code OU nom OU phone présent

**Affichage dans la fiche :** Identique à Alipay

**Sur le reçu PDF :** Label "Identifiant WeChat" → `beneficiary_phone`

### 3.4 Virement bancaire (bank_transfer)

**Champs spécifiques :**
- `beneficiary_name` : **Requis** — titulaire du compte
- `beneficiary_bank_name` : **Requis** — nom de la banque
- `beneficiary_bank_account` : **Requis** — numéro de compte
- `beneficiary_email` : optionnel — email du bénéficiaire
- `beneficiary_notes` : optionnel — notes supplémentaires (agence, code SWIFT, etc.)

**Condition `ready_for_payment` :** Si nom OU compte banque présent (côté SQL) / Le frontend exige les 3 champs obligatoires

**Incohérence détectée :** La condition SQL `beneficiary_name IS NOT NULL` suffit pour passer en `ready_for_payment`, mais le frontend exige nom + banque + numéro de compte. Un paiement créé via l'API directement avec seulement le nom serait marqué `ready_for_payment` alors qu'il manque des infos critiques.

**Sur le reçu PDF :** Affiche Banque, N° de compte, Email. Support des caractères chinois (police Noto Sans SC activée depuis mars 2026).

### 3.5 Cash

**Champs spécifiques :**
- `cash_beneficiary_type` : `'self'` (client lui-même) ou `'other'` (tierce personne)
- `cash_beneficiary_first_name` / `cash_beneficiary_last_name` : si type = `'other'`
- `cash_beneficiary_phone` : téléphone du bénéficiaire cash
- `cash_qr_code` : QR code généré pour le paiement en espèces
- `cash_signed_by_name` : nom du signataire (après remise des fonds)
- `cash_signature_url` : URL de la signature numérique
- `cash_paid_at` : timestamp de la remise physique

**Condition `ready_for_payment` :** Toujours (un paiement cash est toujours prêt)

**Flow spécial :** Géré par l'agent cash via app dédiée. L'agent scanne le QR code, confirme la remise, capture la signature.

---

## 4. Bénéficiaires

### 4.1 Structure des données — Table `beneficiaries`

```sql
CREATE TABLE public.beneficiaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method  public.payment_method NOT NULL,
  name            TEXT NOT NULL,
  identifier      TEXT,
  identifier_type TEXT CHECK (identifier_type IN ('qr', 'id', 'email', 'phone')),
  phone           TEXT,
  email           TEXT,
  bank_name       TEXT,
  bank_account    TEXT,
  bank_extra      TEXT,
  qr_code_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes :**
- `idx_beneficiaries_client_method` sur `(client_id, payment_method)` WHERE `is_active = TRUE`
- `idx_beneficiaries_client_id` sur `client_id`

### 4.2 Comment sont-ils créés

- Lors de la création d'un paiement, le client peut **sauvegarder** un bénéficiaire
- L'admin peut créer/modifier des bénéficiaires via la table directement (RLS permissive pour admins)
- La table utilise `is_active = FALSE` pour le soft-delete

### 4.3 Lien avec les paiements

La table `payments` a deux colonnes liées :
- `beneficiary_id` : FK nullable vers `beneficiaries.id` (SET NULL si le bénéficiaire est supprimé)
- `beneficiary_details` : JSONB snapshot des infos au moment de la création

**Les champs `beneficiary_*` dans `payments` sont la source de vérité** pour le traitement d'un paiement donné. `beneficiary_id` est référentiel seulement.

### 4.4 Peut-on créer un paiement sans bénéficiaire ?

**Oui.** Un paiement peut être créé sans aucune info bénéficiaire → statut `waiting_beneficiary_info`. Le client ou l'admin peut renseigner les infos ensuite.

### 4.5 Modification après création

**Client :** Via `useUpdateBeneficiaryInfo()` — uniquement si statut IN `['created', 'waiting_beneficiary_info']`

**Admin :** Via RPC `admin_update_payment_beneficiary()` — autorisé si statut ≠ `completed` ET ≠ `rejected`. Met à jour les champs avec `COALESCE` (garde les valeurs existantes si NULL passé). Change automatiquement le statut vers `ready_for_payment` si les infos sont suffisantes.

**Limitation :** `admin_update_payment_beneficiary` n'accepte pas les champs `cash_*` — un paiement cash ne peut pas être mis à jour via cette fonction.

### 4.6 RLS Bénéficiaires

- Client : CRUD complet sur ses propres bénéficiaires (`auth.uid() = client_id`)
- Admin : SELECT + INSERT + UPDATE (pas de DELETE)

---

## 5. Taux de change

### 5.1 Système actuel — `daily_rates` (depuis mars 2026)

**Table `daily_rates` :**
```sql
CREATE TABLE public.daily_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_cash    INTEGER NOT NULL,   -- CNY pour 1 000 000 XAF
  rate_alipay  INTEGER NOT NULL,
  rate_wechat  INTEGER NOT NULL,
  rate_virement INTEGER NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);
```

Exemple : `rate_alipay = 11530` signifie **1 000 000 XAF = ¥11 530**

**Table `rate_adjustments` :**
```sql
CREATE TABLE public.rate_adjustments (
  id         UUID PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('country', 'tier')),
  key        TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_reference BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

**Valeurs par défaut :**

*Pays :*
| Clé | Pays | Ajustement |
|---|---|---|
| cameroun | Cameroun | 0% (référence) |
| gabon | Gabon | -1.5% |
| tchad | Tchad | -1.5% |
| rca | Centrafrique | -1.5% |
| congo | Congo | -1.5% |
| guinee | Guinée Équatoriale | -1.5% |

*Paliers (par montant XAF) :*
| Clé | Plage | Ajustement |
|---|---|---|
| t3 | ≥ 1 000 000 XAF | 0% (référence) |
| t2 | 400 000 – 999 999 XAF | -1% |
| t1 | 10 000 – 399 999 XAF | -2% |

### 5.2 Formule de calcul (`src/lib/rateCalculation.ts`)

```
T_final = T_base × (1 + country_pct/100) × (1 + tier_pct/100)
amount_CNY = amount_XAF × T_final / 1 000 000
```

Exemple : Alipay, 500 000 XAF, client Cameroun
```
T_base = 11 530 (rate_alipay)
country_pct = 0% (Cameroun)
tier = t2 → tier_pct = -1%
T_final = 11 530 × 1.00 × 0.99 = 11 414.7
amount_CNY = 500 000 × 11 414.7 / 1 000 000 = 5 707.35 ¥
```

### 5.3 Format de stockage dans `payments.exchange_rate`

**Deux formats coexistent en base (bug historique, corrigé en Chantier 1) :**

| Origine | Format | Exemple | Valeur stockée |
|---|---|---|---|
| Paiements anciens (client) | Décimal (CNY/XAF) | `0.011530` | `NUMERIC(15,6)` |
| Paiements actuels | Entier (CNY/1M XAF) | `11530` | `NUMERIC(15,6)` |

**Conversion rétro-compatible (appliquée partout dans le code) :**
```typescript
const rateInt = payment.exchange_rate < 1
  ? Math.round(payment.exchange_rate * 1_000_000)
  : Math.round(payment.exchange_rate);
// Affichage : "1M XAF = ¥{rateInt}"
```

### 5.4 Taux personnalisé (`rate_is_custom`)

Le champ `rate_is_custom BOOLEAN DEFAULT FALSE` indique qu'un admin a forcé manuellement le taux (sans calcul automatique). Ce champ est **informatif uniquement** — aucune fonction SQL ni hook ne l'exploite actuellement pour changer le comportement.

### 5.5 Ancien système — `exchange_rates` (legacy)

```sql
CREATE TABLE public.exchange_rates (
  rate_xaf_to_rmb DECIMAL(10, 6) NOT NULL,  -- ex: 0.011530
  effective_date  DATE NOT NULL UNIQUE,
  ...
);
```

Table toujours présente mais **potentiellement plus alimentée** depuis le passage à `daily_rates`.

---

## 6. Solde client

### 6.1 Quand le solde est débité

**À la création du paiement — immédiatement.**

Que ce soit via `create_payment` (client) ou `create_admin_payment` (admin), le SQL :
1. Vérifie `wallet.balance_xaf >= p_amount_xaf` (retourne erreur si insuffisant)
2. Calcule `v_new_balance = balance - amount`
3. Insère le paiement avec `balance_before` et `balance_after`
4. `UPDATE wallets SET balance_xaf = v_new_balance`
5. Insère un `ledger_entries` de type `PAYMENT_RESERVED`

**Le solde est donc réservé dès la création, même si le paiement est en `waiting_beneficiary_info`.**

### 6.2 Quand le solde est recrédité

| Événement | Recrédit ? | Montant |
|---|---|---|
| Rejet par admin (`reject`) | **Oui** | `+amount_xaf` → `PAYMENT_CANCELLED_REFUNDED` |
| Suppression admin (statut ≠ `rejected` ET ≠ `completed`) | **Oui** | `+amount_xaf` → `wallet_operations` (legacy) |
| Suppression super_admin (statut `rejected`) | **Non** (déjà remboursé) | — |
| Suppression super_admin (statut `completed`) | **Non** (argent envoyé) | — |
| Complétion (`complete`) | **Non** (argent envoyé) | — |

### 6.3 Vérifications frontend

**Côté client (`src/pages/NewPaymentPage.tsx`) :**
```typescript
const hasEnoughBalance = wallet?.balance_xaf >= amountXAF;
// Bouton "Confirmer" disabled si !hasEnoughBalance
```

**Côté admin (`src/mobile/screens/payments/MobileNewPayment.tsx`) :**
- Vérification ajoutée en Chantier 2 : `xaf >= 10_000 && xaf <= clientBalance`
- Alerte rouge affichée si `xaf > clientBalance`

**Côté SQL :** Double vérification dans le RPC (`IF v_wallet.balance_xaf < p_amount_xaf THEN RETURN error`)

### 6.4 Contraintes en base

```sql
-- wallets
balance_xaf BIGINT NOT NULL DEFAULT 0 CHECK (balance_xaf >= 0)

-- wallet_adjustments
amount_xaf BIGINT NOT NULL CHECK (amount_xaf > 0)
```

La contrainte `balance_xaf >= 0` empêche tout solde négatif au niveau SQL.

---

## 7. Preuves de paiement

### 7.1 Structure — Table `payment_proofs`

```sql
CREATE TABLE public.payment_proofs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL,
  uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('client', 'admin')),
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT,
  description     TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 7.2 Stockage (Supabase Storage)

| Type de preuve | Chemin dans le bucket |
|---|---|
| Upload client | `payment-proofs/<paymentId>/<timestamp>_<filename>` |
| Upload admin | `payment-proofs/admin/<paymentId>/<timestamp>_<filename>` |
| Signature cash | `cash-signatures/<paymentId>/<timestamp>.png` |
| QR code bénéficiaire | `payment-proofs/<paymentId>/qr_<timestamp>.<ext>` |

**Les URLs stockées en base sont des chemins relatifs.** Les URL signées (expiration 1h) sont générées à la volée via `supabase.storage.from('payment-proofs').createSignedUrl(path, 3600)`.

### 7.3 Quand peut-on ajouter une preuve ?

| Qui | Condition |
|---|---|
| Client | `status IN ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing']` |
| Admin | `!isLocked` → statut ≠ `completed` ET ≠ `rejected` |
| Super admin | Toujours |

### 7.4 Quand peut-on supprimer une preuve ?

La suppression passe par le RPC `delete_payment_proof(proof_id)` :
- Vérifie que l'appelant est admin
- Vérifie le statut du paiement associé (bloque si `completed` pour non-super admin)
- Supprime du storage ET de la table `payment_proofs`

---

## 8. Fiche paiement — Interface admin

### 8.1 Variables clés (`MobilePaymentDetail.tsx`)

```typescript
const isLocked = ['completed', 'rejected'].includes(payment.status);
const canProcess = hasPermission('canProcessPayments');
const isSuperAdmin = currentUser?.role === 'super_admin';
const showActions = canProcess && (canStartProcessing || canComplete || canReject);
const canEditBeneficiary = canProcess && !isLocked &&
  ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);
```

### 8.2 Boutons d'action et conditions d'affichage

| Bouton | Condition |
|---|---|
| **"Passer en cours"** | `canProcess && status === 'ready_for_payment'` |
| **"Valider"** | `canProcess && status === 'processing'` |
| **"Refuser"** | `canProcess && status !== 'completed'` |
| **"Modifier bénéficiaire"** | `canProcess && !isLocked && status IN ['created', 'waiting_beneficiary_info', 'ready_for_payment']` |
| **"Ajouter preuve"** | `canProcess && !isLocked` |
| **"Supprimer cette preuve"** | admin uniquement (visible sur chaque preuve) |
| **"Supprimer ce paiement"** | `canProcess && (!isLocked \|\| isSuperAdmin)` |
| **"Télécharger le reçu"** | Toujours visible si paiement chargé |

### 8.3 Affichage conditionnel selon le mode

**Alipay / WeChat :**
- Affiche le QR code si `beneficiary_qr_code_url` est présent
- Affiche l'identifiant texte (phone ou email)
- Page QR code séparée dans le reçu PDF

**Virement bancaire :**
- Affiche Banque, N° de compte, Email
- Support caractères chinois (Noto Sans SC)

**Cash :**
- Affiche le type de bénéficiaire (client lui-même / tierce personne)
- Affiche QR code de paiement généré
- Section signature si paiement complété

### 8.4 Création d'un paiement — Admin (`MobileNewPayment.tsx` — 5 étapes)

| Étape | Contenu |
|---|---|
| 1 | Sélection du client dans la liste |
| 2 | Choix de la méthode de paiement |
| 3 | Saisie montant XAF + calcul automatique CNY avec taux live |
| 4 | Infos bénéficiaire (champs selon méthode) |
| 5 | Récapitulatif + bouton "Confirmer" |

**Comportement étape 3 :**
- Vérifie `montant >= 10 000 XAF` ET `montant <= solde client`
- Affiche alerte rouge si solde insuffisant
- Bouton "Confirmer" disabled + spinner pendant la requête

### 8.5 Création d'un paiement — Client (`NewPaymentPage.tsx` — 4 étapes)

| Étape | Contenu |
|---|---|
| 1 | Saisie montant en XAF ou CNY |
| 2 | Choix méthode paiement |
| 3 | Infos bénéficiaire |
| 4 | Confirmation |

**Plage autorisée :** 10 000 – 50 000 000 XAF

---

## 9. Problèmes et incohérences identifiés

### 9.1 Bug taux de change — CORRIGÉ (Chantier 1)

**Problème :** Deux formats coexistaient pour `payments.exchange_rate` :
- Admin créait avec taux entier : `11530`
- Client créait avec taux décimal : `0.011530`

L'affichage calculait `Math.round(1 / 11530) = 0` pour les paiements admin → taux affiché = 0.

**Correction appliquée :** Normalisation rétro-compatible `rate < 1 ? rate * 1_000_000 : rate` dans toutes les pages de détail et le template PDF.

### 9.2 Double-écriture `wallet_operations` / `ledger_entries`

**Problème :** Migration progressive incomplète :
- `validate_deposit` écrit encore dans `wallet_operations` (legacy) ET `ledger_entries` (nouveau)
- `create_payment` et `process_payment` n'écrivent plus dans `wallet_operations`, seulement dans `ledger_entries`
- → Les `wallet_operations` sont **partiellement incomplètes** pour les paiements récents

**Risque :** Tout tableau de bord lisant `wallet_operations` pour reconstituer l'historique sera incomplet.

### 9.3 Table `exchange_rates` legacy probablement plus alimentée

La table `exchange_rates` (format `rate_xaf_to_rmb DECIMAL`) existe toujours avec des index, mais depuis le passage à `daily_rates` (mars 2026), elle n'est potentiellement plus alimentée. **NON CONFIRMÉ** (pas de migration de suppression visible).

### 9.4 Condition `ready_for_payment` trop permissive côté SQL

**La fonction SQL `create_payment` considère un paiement "prêt" si :**
```sql
p_beneficiary_qr_code_url IS NOT NULL OR
p_beneficiary_name IS NOT NULL OR        -- ← trop permissif !
p_beneficiary_bank_account IS NOT NULL OR
p_method = 'cash'
```

Pour Alipay ou WeChat, passer uniquement `beneficiary_name = 'Jean'` marque le paiement `ready_for_payment` alors qu'il manque le QR code ou l'identifiant. Le frontend corrige cela en validant correctement avant l'envoi, mais un appel API direct contourne cette protection.

### 9.5 `admin_update_payment_beneficiary` ne gère pas les champs `cash_*`

La fonction RPC `admin_update_payment_beneficiary` accepte uniquement :
```
beneficiary_name, phone, email, qr_code_url, bank_name, bank_account, notes
```

Aucun champ `cash_beneficiary_type`, `cash_beneficiary_first_name`, etc. Un paiement cash créé sans infos bénéficiaire ne peut pas être complété via cette fonction admin.

### 9.6 Paiements `cash_pending` bloqués — Pas de récupération admin

Si un paiement cash est en `cash_pending` ou `cash_scanned` et qu'un problème survient (agent qui ne confirme pas, etc.), il n'existe pas de bouton dans l'interface admin normale pour :
- Forcer la complétion
- Annuler / refuser

`process_payment(id, 'start_processing')` exige le statut `ready_for_payment` (pas `cash_pending`). → Paiement potentiellement bloqué sans recours UI.

### 9.7 `PAYMENT_EXECUTED` ledger entry : balance_before = balance_after

Lors de la complétion (`process_payment → complete`), un `PAYMENT_EXECUTED` ledger entry est créé avec :
```sql
balance_before = v_wallet.balance_xaf,
balance_after  = v_wallet.balance_xaf  -- identique !
```
Car le solde ne change pas à la complétion (déjà débité à la création). Ceci est **techniquement correct** mais peut induire en erreur lors de l'audit du ledger (ligne sans variation de solde visible).

### 9.8 `rate_is_custom` — Champ informatif non exploité

Le champ `rate_is_custom BOOLEAN DEFAULT FALSE` a été ajouté à `payments`, mais aucune fonction SQL ni hook React ne l'utilise pour modifier le comportement. Il est uniquement stocké. Aucune UI ne permet actuellement de le visualiser clairement.

---

## 10. Annexes

### 10.1 Liste complète des fichiers du module paiements

**Hooks React Query :**
- `src/hooks/usePayments.ts` — client + admin hooks (726 lignes)
- `src/hooks/useAdminPayments.ts` — hooks admin spécifiques (291 lignes)
- `src/hooks/useBeneficiaries.ts` — gestion bénéficiaires
- `src/hooks/useAgentCashActions.ts` — actions agent cash

**Composants UI — Admin :**
- `src/mobile/screens/payments/MobilePaymentDetail.tsx` (1402 lignes)
- `src/mobile/screens/payments/MobileNewPayment.tsx` (1111 lignes)
- `src/mobile/screens/payments/MobileBeneficiaryEdit.tsx` (349 lignes)
- `src/mobile/screens/payments/MobilePaymentsScreen.tsx` — liste paiements

**Composants UI — Client :**
- `src/pages/PaymentDetailPage.tsx` (1097 lignes)
- `src/pages/NewPaymentPage.tsx` (594 lignes)
- `src/pages/PaymentsPage.tsx` — liste paiements client

**Composants communs :**
- `src/components/payment-form/SuccessScreen.tsx`
- `src/components/payment-form/PaymentMethodCard.tsx`
- `src/components/cash/CashReceiptDownloadButton.tsx`
- `src/components/cash/CashQRCode.tsx` (supposé)

**Agent Cash :**
- `src/mobile/screens/agent-cash/AgentCashPaymentDetail.tsx`
- `src/mobile/screens/agent-cash/AgentCashSuccess.tsx`

**PDF :**
- `src/lib/pdf/templates/PaymentReceiptPDF.tsx`
- `src/lib/pdf/components/PDFInfoRow.tsx` (avec support CJK)
- `src/lib/pdf/fonts.ts` (DM Sans + Noto Sans SC)
- `src/lib/pdf/helpers.ts`

**Logique métier :**
- `src/lib/rateCalculation.ts` — formule taux
- `src/lib/paymentTimeline.ts` — construction timeline
- `src/lib/formatters.ts` — formatage montants, dates
- `src/types/payment.ts` — types, labels, couleurs
- `src/contexts/AdminAuthContext.tsx` — rôles et permissions

### 10.2 Schéma SQL — Table `payments` (version finale)

```sql
CREATE TABLE public.payments (
  id                        UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID NOT NULL,
  reference                 TEXT NOT NULL,
  amount_xaf                BIGINT NOT NULL,
  amount_rmb                NUMERIC(15,2) NOT NULL,
  exchange_rate             NUMERIC(15,6) NOT NULL,
  method                    payment_method NOT NULL,
  status                    payment_status NOT NULL DEFAULT 'created',

  -- Bénéficiaire générique
  beneficiary_name          TEXT,
  beneficiary_phone         TEXT,
  beneficiary_email         TEXT,
  beneficiary_qr_code_url   TEXT,
  beneficiary_bank_name     TEXT,
  beneficiary_bank_account  TEXT,
  beneficiary_notes         TEXT,

  -- Lien bénéficiaire sauvegardé
  beneficiary_id            UUID REFERENCES public.beneficiaries(id) ON DELETE SET NULL,
  beneficiary_details       JSONB,

  -- Cash spécifique
  cash_qr_code              TEXT,
  cash_beneficiary_type     TEXT,
  cash_beneficiary_first_name TEXT,
  cash_beneficiary_last_name  TEXT,
  cash_beneficiary_phone    TEXT,
  cash_signed_by_name       TEXT,
  cash_signature_url        TEXT,
  cash_paid_at              TIMESTAMP WITH TIME ZONE,

  -- Admin
  processed_by              UUID,
  processed_at              TIMESTAMP WITH TIME ZONE,
  rejection_reason          TEXT,
  admin_comment             TEXT,
  client_visible_comment    TEXT,

  -- Snapshot solde
  balance_before            BIGINT NOT NULL,
  balance_after             BIGINT NOT NULL,

  -- Taux
  rate_is_custom            BOOLEAN NOT NULL DEFAULT FALSE,

  created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 10.3 Liste des fonctions RPC liées aux paiements

| Fonction | Fichier migration | Description |
|---|---|---|
| `create_payment(...)` | `20260221200000_payments_use_ledger_entries.sql` | Création client — débite wallet, crée ledger |
| `create_admin_payment(...)` | `20260221200000_payments_use_ledger_entries.sql` | Création admin — même logique |
| `process_payment(id, action, comment)` | `20260221200000_payments_use_ledger_entries.sql` | start_processing / complete / reject |
| `admin_update_payment_beneficiary(...)` | `20260301000002_fix_payment_status_type.sql` | Mise à jour bénéficiaire par admin |
| `delete_payment(id)` | `20260312000000_super_admin_force_delete_payment.sql` | Suppression — avec logique super_admin |
| `delete_payment_proof(id)` | `20260107131951_*.sql` | Suppression preuve |
| `admin_adjust_wallet(...)` | `20260221200000_*.sql` | Ajustement manuel solde |
| `create_wallet_adjustment(...)` | `20260210100000_ledger_entries.sql` | Crée ledger_entry + wallet_adjustment |
| `get_client_ledger(...)` | `20260210100000_ledger_entries.sql` | Historique mouvements |
| `create_daily_rates(...)` | `20260303000000_daily_rates_system.sql` | Crée nouveau jeu de taux |
| `is_admin(user_id)` | `20260222100000_security_fix_is_admin_disabled_check.sql` | Vérifie rôle admin actif |
| `generate_payment_reference()` | `20251220211736_*.sql` | Génère référence unique PAY-XXXX |
| `scan_cash_payment(id)` | NON TROUVÉ dans migrations lues | Scan QR code par agent |
| `confirm_cash_payment(id, signature)` | NON TROUVÉ dans migrations lues | Confirmation paiement cash |

### 10.4 Politiques RLS — Table `payments`

```sql
-- Client : voir ses propres paiements
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Client : créer ses propres paiements
CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Client : modifier infos bénéficiaire uniquement sur statuts non-traités
CREATE POLICY "Users can update own payments beneficiary info" ON public.payments
  FOR UPDATE USING (
    auth.uid() = user_id AND
    status IN ('created', 'waiting_beneficiary_info')
  );

-- Admin : voir tous les paiements
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (is_admin(auth.uid()));

-- Admin : mettre à jour n'importe quel paiement
CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (is_admin(auth.uid()));
```

### 10.5 ENUMs complets

```sql
-- Méthodes de paiement
CREATE TYPE public.payment_method AS ENUM (
  'alipay', 'wechat', 'bank_transfer', 'cash'
);

-- Statuts de paiement
CREATE TYPE public.payment_status AS ENUM (
  'created',
  'waiting_beneficiary_info',
  'ready_for_payment',
  'processing',
  'completed',
  'rejected',
  'cash_pending',
  'cash_scanned'
);

-- Types d'entrées dans le ledger
CREATE TYPE public.ledger_entry_type AS ENUM (
  'DEPOSIT_VALIDATED',
  'DEPOSIT_REFUSED',
  'PAYMENT_RESERVED',
  'PAYMENT_EXECUTED',
  'PAYMENT_CANCELLED_REFUNDED',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT'
);

-- Rôles admin
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'ops', 'support', 'customer_success', 'cash_agent'
);
```

### 10.6 Index sur les tables paiements

```sql
-- payments
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_status_processed_at ON public.payments(status, processed_at)
  WHERE processed_at IS NOT NULL;
CREATE INDEX idx_payments_beneficiary_id ON public.payments(beneficiary_id);

-- payment_proofs (implicite via FK)
-- ledger_entries
CREATE INDEX idx_ledger_entries_wallet ON public.ledger_entries(wallet_id);
CREATE INDEX idx_ledger_entries_user ON public.ledger_entries(user_id);
CREATE INDEX idx_ledger_entries_type ON public.ledger_entries(entry_type);
CREATE INDEX idx_ledger_entries_created ON public.ledger_entries(created_at DESC);
CREATE INDEX idx_ledger_entries_reference ON public.ledger_entries(reference_type, reference_id);

-- beneficiaries
CREATE INDEX idx_beneficiaries_client_method ON public.beneficiaries(client_id, payment_method)
  WHERE is_active = TRUE;

-- daily_rates
CREATE INDEX idx_daily_rates_active ON public.daily_rates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_daily_rates_effective_at ON public.daily_rates(effective_at DESC);
```

### 10.7 Triggers liés aux paiements

```sql
-- Auto-update updated_at sur beneficiaries
CREATE TRIGGER trigger_update_beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beneficiaries_updated_at();
```

Aucun trigger direct sur la table `payments` n'a été trouvé dans les migrations analysées.

### 10.8 Buckets Supabase Storage

| Bucket | Contenu |
|---|---|
| `payment-proofs` | Preuves de paiement (client + admin) + QR codes bénéficiaires |
| `cash-signatures` | Signatures numériques des paiements cash |
| `deposit-proofs` | Preuves de dépôt (hors scope paiements) |

---

*Document généré automatiquement par analyse du code source — Bonzini Platform*
*Branches analysées : `claude/analyze-payment-flow-We7Hl`*
*Migrations analysées : 88 fichiers SQL*
