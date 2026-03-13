# Analyse complète du module Dépôts — Bonzini Platform (App Admin)

**Date :** 13 mars 2026
**Version :** 3.0 (rebuild exhaustif post-migrations 2026-03)
**Objectif :** Document de référence pour le redesign complet du module dépôts

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Cycle de vie d'un dépôt](#2-cycle-de-vie-dun-dépôt)
3. [Méthodes de dépôt](#3-méthodes-de-dépôt)
4. [Fiche dépôt — MobileDepositDetail.tsx (1196 lignes)](#4-fiche-dépôt--mobiledeposit-detailtsx)
5. [Formulaire de création — MobileNewDeposit.tsx (1001 lignes)](#5-formulaire-de-création--mobilenewdeposittsx)
6. [Écran liste — MobileDepositsScreen.tsx (516 lignes)](#6-écran-liste--mobiledepositsscreentsx)
7. [Preuves / justificatifs](#7-preuves--justificatifs)
8. [Version client web](#8-version-client-web)
9. [Connexions avec les autres modules](#9-connexions-avec-les-autres-modules)
10. [Différences avec le module paiements](#10-différences-avec-le-module-paiements)
11. [Problèmes et incohérences identifiés](#11-problèmes-et-incohérences-identifiés)
12. [Annexes SQL](#12-annexes-sql)

---

## 1. Vue d'ensemble

### 1.1 Inventaire des fichiers (7 226 lignes)

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/types/deposit.ts` | 314 | Types TypeScript, enums, labels, couleurs, constantes |
| `src/data/depositMethodsData.ts` | 247 | Données statiques : banques, agences, Mobile Money |
| `src/lib/depositTimeline.ts` | 259 | Construction timeline, calcul SLA, mapping événements |
| `src/hooks/useDeposits.ts` | 436 | Hooks client (create, proofs, cancel, resubmit) |
| `src/hooks/usePaginatedDeposits.ts` | 108 | Infinite scroll admin avec filtres serveur |
| `src/hooks/useAdminDeposits.ts` | 761 | Hooks admin (validate, reject, delete, create, upload) |
| `src/components/deposit/DepositInstructions.tsx` | 350 | Composant instructions copier-coller (compact + full) |
| `src/components/deposit/DepositTimelineDisplay.tsx` | 166 | Affichage visuel timeline avec icônes et connecteurs |
| `src/lib/pdf/templates/DepositReceiptPDF.tsx` | 134 | Template reçu PDF dépôt |
| `src/pages/DepositsPage.tsx` | 148 | Liste dépôts côté client web |
| `src/pages/NewDepositPage.tsx` | 746 | Création dépôt client web (7 étapes) |
| `src/pages/DepositDetailPage.tsx` | 844 | Fiche dépôt côté client web |
| `src/mobile/screens/deposits/MobileDepositsScreen.tsx` | 516 | Liste dépôts admin (KPI + filtres + SLA) |
| `src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx` | 1001 | Création dépôt admin pour client (8 étapes) |
| `src/mobile/screens/deposits/MobileDepositDetail.tsx` | 1196 | Fiche dépôt admin (command center complet) |
| **TOTAL** | **7 226** | |

### 1.2 Migrations SQL liées aux dépôts

| Fichier | Date | Rôle |
|---|---|---|
| `20260131200000_rebuild_deposit_validation.sql` | 2026-01-31 | RPCs validate, reject, correction, review, stats, resubmit |
| `20260213000000_enhanced_deposit_validation.sql` | 2026-02-13 | Colonnes confirmed_amount, rejection_category, admin_note ; soft-delete proofs |
| `20260214000000_deposit_proofs_client_policies.sql` | 2026-02-14 | RLS policies preuves (SELECT/INSERT/UPDATE) |
| `20260219300000_deposit_cancel_and_remove_rate_limit.sql` | 2026-02-19 | RPC cancel_client_deposit (client) |
| `20260221500000_fix_deposit_rpcs_is_admin.sql` | 2026-02-21 | Fix appels is_admin() dans les RPCs |
| `20260313000001_fix_delete_payment_and_add_delete_deposit.sql` | 2026-03-13 | RPC delete_deposit (super_admin uniquement) |
| `20260313000002_fix_delete_cleanup_full.sql` | 2026-03-13 | Fix cleanup ledger_entries + notifications orphelines |

### 1.3 Tables Supabase impliquées

| Table | Rôle |
|---|---|
| `deposits` | Dépôt principal (statut, montant, méthode, métadonnées) |
| `deposit_proofs` | Preuves uploadées (soft-delete, uploaded_by_type) |
| `deposit_timeline_events` | Historique des événements du dépôt |
| `wallets` | Solde client (crédité lors de la validation) |
| `ledger_entries` | Relevé de compte (DEPOSIT_VALIDATED, DEPOSIT_REFUSED) |
| `notifications` | Notifications client liées aux dépôts |
| `admin_audit_logs` | Audit toutes actions admin sur les dépôts |
| `clients` | Profil client (joint pour affichage nom, téléphone) |

### 1.4 Schéma des relations

```
deposits
  ├── deposit_proofs          (deposit_id FK, ON DELETE CASCADE)
  ├── deposit_timeline_events (deposit_id FK)
  ├── ledger_entries          (reference_id = deposit.id, SANS FK — polymorphique)
  ├── notifications           (metadata->>'deposit_id', SANS FK)
  └── admin_audit_logs        (target_id = deposit.id, target_type = 'deposit')

wallets
  └── ledger_entries          (wallet_id FK, crédité via validate_deposit)
```

### 1.5 Différence structurelle dépôt vs paiement

- **Un dépôt crédite le wallet** du client ; un paiement le débite.
- **Un dépôt n'a pas de bénéficiaire** externe : le client envoie de l'argent à Bonzini.
- **Pas de taux de change** dans les dépôts : tout est en XAF uniquement.
- **Les preuves sont soumises par le client** (preuve de virement, SMS mobile money) ; dans les paiements, les preuves sont soumises par l'admin (confirmation d'exécution).

---

## 2. Cycle de vie d'un dépôt

### 2.1 Les 8 statuts possibles

```typescript
type DepositStatus =
  | 'created'              // Dépôt créé, pas encore de preuve
  | 'awaiting_proof'       // Statut fantôme — même comportement que 'created'
  | 'proof_submitted'      // Client a uploadé au moins 1 preuve
  | 'admin_review'         // Admin a démarré la vérification
  | 'validated'            // Admin a validé — wallet crédité
  | 'rejected'             // Admin a rejeté
  | 'pending_correction'   // Admin a demandé une correction
  | 'cancelled';           // Client a annulé
```

**Labels et couleurs UI :**

| Statut | Label FR | Couleur |
|---|---|---|
| `created` | Demande créée | Gris |
| `awaiting_proof` | En attente de preuve | Jaune |
| `proof_submitted` | Preuve envoyée | Bleu |
| `admin_review` | En vérification | Violet |
| `validated` | Validé | Vert |
| `rejected` | Rejeté | Rouge |
| `pending_correction` | À corriger | Orange |
| `cancelled` | Annulé | Gris |

### 2.2 Diagramme de transition des statuts

```
              [CLIENT crée le dépôt]
                        │
            ┌───────────▼───────────┐
            │   created             │
            │  (awaiting_proof)     │◄── même comportement
            └───────┬──────────┬───┘
                    │upload    │cancel
                    ▼          ▼
        ┌────────────────┐  [cancelled] ◄── TERMINAL
        │ proof_submitted │
        └──┬──────────┬──┘
           │start     │
           │review    │correction?
           ▼          ▼
  ┌──────────────┐  [pending_correction]
  │  admin_review │       │
  └──────┬───────┘  (client resubmit)
         │                │
    ─────┴────────────────┘
         │
   ──────┴──────
  │              │
validate?     reject?
  │                │
  ▼                ▼
[validated]    [rejected]
  TERMINAL       TERMINAL
```

### 2.3 Transitions autorisées et acteurs

| De → Vers | Déclencheur | Acteur | RPC / Méthode |
|---|---|---|---|
| `created` → `proof_submitted` | Upload preuve | Client ou Admin | Direct DB update |
| `created` → `cancelled` | Annulation | Client | `cancel_client_deposit` |
| `awaiting_proof` → `proof_submitted` | Upload preuve | Client ou Admin | Direct DB update |
| `proof_submitted` → `admin_review` | Démarrer vérif | Admin | `start_deposit_review` |
| `proof_submitted` → `validated` | Valider | Admin | `validate_deposit` |
| `proof_submitted` → `rejected` | Rejeter | Admin | `reject_deposit` |
| `proof_submitted` → `pending_correction` | Demander correction | Admin | `request_deposit_correction` |
| `admin_review` → `validated` | Valider | Admin | `validate_deposit` |
| `admin_review` → `rejected` | Rejeter | Admin | `reject_deposit` |
| `admin_review` → `pending_correction` | Demander correction | Admin | `request_deposit_correction` |
| `pending_correction` → `proof_submitted` | Renvoyer | Client | `resubmit_deposit` |

> **Note :** `start_deposit_review` n'accepte que `proof_submitted` ou `pending_correction` comme état source (guard SQL).

### 2.4 Effets de bord de chaque transition

| Transition | Wallet | Ledger | Timeline event | Notification client |
|---|---|---|---|---|
| Création | Aucun | Aucun | `created` | Aucune |
| → `proof_submitted` (upload) | Aucun | Aucun | `proof_submitted` / `proof_added` | Aucune |
| → `admin_review` | Aucun | Aucun | `admin_review` | Aucune |
| → `validated` | **+amount_xaf** (crédit) | `DEPOSIT_VALIDATED` | `validated` + `wallet_credited` | ✓ `deposit_validated` |
| → `rejected` | Aucun | `DEPOSIT_REFUSED` (marqueur) | `rejected` | ✓ `deposit_rejected` |
| → `pending_correction` | Aucun | Aucun | `correction_requested` | ✓ `deposit_correction_requested` |
| → `cancelled` | Aucun | Aucun | `cancelled` | Aucune |
| Suppression dépôt validé | **-amount_xaf** (inversion) | Nettoyage (suppression) | — | Nettoyage notif |
| Suppression dépôt non-validé | Aucun | Nettoyage (suppression) | — | Nettoyage notif |

### 2.5 Ledger entries créées

```typescript
// Type enum (src/lib/ledger)
'DEPOSIT_VALIDATED'  // Créé par validate_deposit — crédite le wallet
'DEPOSIT_REFUSED'    // Créé par reject_deposit — marqueur informatif, aucun mouvement
```

Colonnes pertinentes dans `ledger_entries` :
- `entry_type` : DEPOSIT_VALIDATED ou DEPOSIT_REFUSED
- `amount_xaf` : montant du dépôt
- `balance_before` / `balance_after` : solde avant/après
- `reference_type` = `'deposit'`
- `reference_id` = `deposit.id` (SANS FK — risque orphelins, corrigé en 20260313)

### 2.6 États uploadables (preuves)

```typescript
// Client side
const UPLOADABLE_STATUSES = ['created', 'awaiting_proof', 'pending_correction'];

// Admin side (useAdminUploadProofs)
const UPLOADABLE_STATES = ['created', 'awaiting_proof', 'pending_correction'];
```

Si upload réussit et statut dans `UPLOADABLE_STATES` → status avance automatiquement vers `proof_submitted`.

Si toutes les preuves sont soft-deleted et statut non-terminal → status **revient à `created`**.

---

## 3. Méthodes de dépôt

### 3.1 Hiérarchie familles → sous-méthodes → méthode DB

```
DepositMethodFamily       DepositSubMethod              DepositMethod (DB)
─────────────────────     ──────────────────────        ──────────────────
BANK                  ──► BANK_TRANSFER           ──►  bank_transfer
                      ──► BANK_CASH_DEPOSIT        ──►  bank_cash
AGENCY_BONZINI        ──► AGENCY_CASH              ──►  agency_cash
ORANGE_MONEY          ──► OM_TRANSFER              ──►  om_transfer
                      ──► OM_WITHDRAWAL             ──►  om_withdrawal
MTN_MONEY             ──► MTN_TRANSFER             ──►  mtn_transfer
                      ──► MTN_WITHDRAWAL            ──►  mtn_withdrawal
WAVE                  ──► WAVE_TRANSFER             ──►  wave
```

### 3.2 Coordonnées statiques (src/data/depositMethodsData.ts)

**Banques (4) — Titulaire : BONZINI TRADING SARL**

| Banque | N° Compte | IBAN | SWIFT |
|---|---|---|---|
| Ecobank Cameroun | 30245039710 | CM21 10029... | ECOCMKAX |
| CCA-BANK | 00280298901 | CM21 10039... | CCAMCMCX |
| UBA Cameroun | 14011000141 | CM21 10033... | UNAFCMCX |
| Afriland First Bank | 00000020611 | CM21 10005... | CCEICMCX |

**Mobile Money :**

| Opérateur | Numéro | Titulaire |
|---|---|---|
| Orange Money | 6 96 10 38 64 | WONDER PHONE |
| MTN Money | 6 52 23 68 56 | NGANGON SOH NELSON |
| Wave | +237 691 000 003 | BONZINI TRADING |

**Codes marchands :**

| Opérateur | Code |
|---|---|
| Orange Money | `#150*14*424393*696103864*MONTANT#` |
| MTN | `*126*14*652236856*MONTANT#` |

> Limite transaction Mobile Money : **500 000 XAF** — alerte affichée si montant supérieur.

**Agences Bonzini (3) :**

| Agence | Adresse | Horaires |
|---|---|---|
| Douala Bonapriso | Rue de la Joie | Lun-Ven 8h-18h, Sam 9h-14h |
| Douala Bonamoussadi | Carrefour Maetur | Lun-Ven 8h-18h, Sam 9h-14h |
| Yaoundé Centre | Avenue Kennedy | Lun-Ven 8h-18h, Sam 9h-13h |

### 3.3 Champs DB remplis selon méthode

| Méthode | `bank_name` | `agency_name` | `client_phone` |
|---|---|---|---|
| `bank_transfer` | Nom de la banque Bonzini | — | — |
| `bank_cash` | Nom de la banque Bonzini | — | — |
| `agency_cash` | — | Nom de l'agence | — |
| `om_transfer` | — | — | Jamais rempli |
| `om_withdrawal` | — | — | Jamais rempli |
| `mtn_transfer` | — | — | Jamais rempli |
| `mtn_withdrawal` | — | — | Jamais rempli |
| `wave` | — | — | Jamais rempli |

### 3.4 Navigation dans le formulaire selon la famille

- **BANK** → `family` → `submethod` (transfer/cash) → `bank` → `recap`
- **AGENCY_BONZINI** → `family` → `agency` → `recap` (pas de submethod)
- **ORANGE_MONEY / MTN_MONEY** → `family` → `submethod` → `recap` (pas de bank)
- **WAVE** → `family` → `recap` (direct, pas de submethod ni bank)

### 3.5 Familles et sous-méthodes (descriptions)

| Famille | Icône | Description |
|---|---|---|
| BANK | Building2 | Virement ou dépôt cash en agence bancaire |
| AGENCY_BONZINI | Store | Dépôt cash dans nos locaux |
| ORANGE_MONEY | Smartphone | Transfert UV ou retrait code marchand |
| MTN_MONEY | Smartphone | Transfert Float ou retrait code marchand |
| WAVE | Waves | Transfert via Wave |

---

## 4. Fiche dépôt — MobileDepositDetail.tsx

**Fichier :** `src/mobile/screens/deposits/MobileDepositDetail.tsx`
**Lignes :** 1 196
**Route :** `/m/deposits/:depositId`

### 4.1 Hooks utilisés

**Queries :**
- `useAdminDepositDetail(depositId)` — données dépôt + profil client
- `useAdminDepositProofs(depositId)` — preuves avec signed URLs (cache 55 min)
- `useAdminDepositTimeline(depositId)` — événements chronologiques
- `useAdminWalletByUserId(deposit?.user_id)` — solde wallet client actuel

**Mutations :**
- `useValidateDeposit()` — valide et crédite le wallet
- `useRejectDeposit()` — rejette avec catégorie + note admin
- `useRequestCorrection()` — demande correction au client
- `useStartDepositReview()` — passe en `admin_review`
- `useAdminUploadProofs()` — upload preuves par admin
- `useAdminDeleteProof()` — soft-delete preuve
- `useDeleteDeposit()` — supprime le dépôt entier (super_admin)

**Contexte :** `useAdminAuth()` → `currentUser.role` (pour `isSuperAdmin`)

### 4.2 Variables de permission

```typescript
const isSuperAdmin = currentUser?.role === 'super_admin';
const isLocked = ['validated', 'rejected', 'cancelled'].includes(deposit.status);
const canValidate = !isLocked;
const canReject = !isLocked;
const canStartReview = deposit.status === 'proof_submitted';
const hasProofs = proofs && proofs.length > 0;
const canAddProof = !isLocked;
```

### 4.3 Couleurs du banner de statut (gradient)

| Statut | Gradient |
|---|---|
| `created` | Gris |
| `awaiting_proof` | Jaune |
| `proof_submitted` | Bleu |
| `admin_review` | Violet |
| `pending_correction` | Orange |
| `validated` | Vert |
| `rejected` | Rouge |
| `cancelled` | Gris |

### 4.4 Sections affichées (ordre de rendu)

1. **MobileHeader** — titre = référence du dépôt, bouton back
2. **Status Banner** — gradient coloré, badge statut, icône cadenas si `isLocked`
3. **Amount Hero** — montant XAF en grand, SLA dot (si non-terminal), date relative
4. **Proof Strip** (scroll horizontal) — miniatures preuves + bouton delete (si `!isLocked`) + bouton "+" upload
5. **Alerte "pas de preuve"** — si `!hasProofs && canValidate` (avertissement visuel non bloquant)
6. **Client info** — avatar initiales, nom complet, téléphone
7. **Wallet** — solde actuel du client
8. **Details expandable** — méthode, banque/agence, montant déclaré, montant confirmé (si différent), date création, validé par/le
9. **Timeline** — tous les événements avec icônes et dates
10. **Bouton "Supprimer ce dépôt"** — visible uniquement si `isSuperAdmin`
11. **Glass Sticky Action Bar** (sticky bottom) — visible si `canValidate || canReject || canStartReview`

### 4.5 Boutons d'action et leurs conditions exactes

| Bouton | Condition | Couleur | Action déclenchée |
|---|---|---|---|
| **Commencer la vérification** | `canStartReview` = `status === 'proof_submitted'` | Violet | `start_deposit_review` RPC |
| **Valider** | `canValidate` = `!isLocked` | Vert | Ouvre modale validate |
| **Rejeter** | `canReject` = `!isLocked` | Rouge outline | Ouvre sheet reject |
| **Corriger** | `canValidate` (même condition) | Orange outline | Ouvre sheet correction |
| **Ajouter preuve** | `canAddProof` = `!isLocked` | Icône "+" (proof strip) | Ouvre sheet upload |
| **Supprimer preuve** | `!isLocked` (sur chaque preuve) | Rouge icône | Ouvre sheet delete proof |
| **Télécharger reçu** | Toujours visible | Neutre | Génère PDF (react-pdf) |
| **Supprimer dépôt** | `isSuperAdmin` (toujours, même si locked) | Rouge outline | Ouvre sheet delete deposit |

> **Attention :** "Valider" est visible même si `!hasProofs` — seul un avertissement visuel s'affiche. Le SQL ne bloque pas dans la version actuelle des migrations.

> **L'action bar (Valider/Rejeter/Corriger) disparaît** si `isLocked` = true (statuts `validated`, `rejected`, `cancelled`).

### 4.6 Bottom Sheets / Modales

**Validate (`showValidateConfirm`) :**
```
- Montant déclaré (lecture seule)
- Champ "Montant confirmé (XAF)" — pré-rempli avec deposit.amount_xaf
- Note si montant confirmé ≠ déclaré
- Champ commentaire admin (optionnel)
- Toggle "Envoyer notification au client" (défaut : ON)
- Bouton "Valider"
```

**Reject (`showRejectSheet`) :**
```
- Sélecteur catégorie parmi REJECTION_REASONS
- Champ message visible par le client (obligatoire)
- Champ note interne admin (optionnel)
- Bouton "Confirmer le rejet" (désactivé si catégorie ou message vide)
```

**Correction (`showCorrectionSheet`) :**
```
- Champ raison de correction (obligatoire)
- Bouton "Demander correction"
```

**Upload preuves (`showUploadSheet`) :**
```
- Input file (multiple, image/* + application/pdf)
- Preview fichiers sélectionnés
- Bouton "Uploader"
```

**Delete preuve (`showDeleteProofSheet`) :**
```
- Sélecteur raison parmi PROOF_DELETE_REASONS
- Si "Autre" : champ texte libre
- Bouton "Supprimer"
```

**Delete dépôt (`showDeleteDepositSheet`) :**
```
- Warning : nom client + montant
- Texte "Cette action est irréversible"
- Bouton "Supprimer définitivement" (rouge)
```

### 4.7 Génération reçu PDF

Côté frontend uniquement via `@react-pdf/renderer` (pas de RPC).

```typescript
interface DepositReceiptData {
  id, reference, created_at, validated_at?,
  amount_xaf, confirmed_amount_xaf?,
  method, status, bank_name?, agency_name?,
  client_name, client_phone?, company_name?
}
```

**Sections du PDF :** Header (logo, titre, référence) → Badge statut + date → Box montant → Transaction (méthode, banque, dates) → Client (nom, téléphone, pays, société) → Footer

### 4.8 Problèmes identifiés

1. **Bouton Valider visible sans preuve** — avertissement visuel non bloquant, pas de validation UI stricte.
2. **`confirmed_amount_xaf` non visible dans les détails** — uniquement visible dans la modale de validation. Après validation, si le montant confirmé diffère du déclaré, cela n'est pas évident sur la fiche.
3. **Pas de navigation vers le profil client** — pas de lien depuis la fiche dépôt.
4. **Action bar `bottom-16` peut chevaucher** le bouton Supprimer dépôt sur petits écrans.
5. **Pas d'alerte en temps réel** (pas de subscription Supabase realtime) — l'admin ne voit pas les mises à jour si un autre admin valide en même temps.

---

## 5. Formulaire de création — MobileNewDeposit.tsx

**Fichier :** `src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx`
**Lignes :** 1 001
**Route :** `/m/deposits/new` ou `/m/deposits/new?clientId=xxx`

### 5.1 Les 8 étapes

```typescript
type Step = 'client' | 'amount' | 'family' | 'submethod' | 'bank' | 'agency' | 'recap' | 'creating';
```

| Étape | Clé | Contenu | Navigation suivante |
|---|---|---|---|
| 1 | `client` | Recherche et sélection du client | → `amount` |
| 2 | `amount` | Saisie montant XAF (min 1 000) | → `family` |
| 3 | `family` | Sélection famille méthode (5 options) | → `submethod` / `agency` / `recap` |
| 4 | `submethod` | Sous-méthode (BANK, OM, MTN uniquement) | → `bank` / `recap` |
| 5 | `bank` | Sélection banque (BANK uniquement, 4 options) | → `recap` |
| 6 | `agency` | Sélection agence (AGENCY_BONZINI uniquement, 3 options) | → `recap` |
| 7 | `recap` | Récapitulatif + upload preuves + commentaire | → `creating` |
| 8 | `creating` | Animation chargement | → `/m/deposits/:id` |

### 5.2 Barre de progression

```
3 barres horizontales colorées :
Phase 0 [bleu si actif] : client → amount → family → submethod → bank → agency
Phase 1 [bleu si actif] : recap
Phase 2 [gris si actif] : creating
```

### 5.3 Étape 1 — Sélection client

- Recherche type-ahead sur nom + téléphone
- Limite : 20 résultats affichés
- Si `?clientId=xxx` : client pré-sélectionné, étape sautée directement à `amount`
- Source : `useAllClients()` (table `clients`, ordre prénom ASC)

### 5.4 Étape 2 — Montant

- Input numérique (`inputMode="numeric"`)
- Animation count-up (`useCountUp`)
- Presets : 100K, 500K, 1M, 2M XAF
- Validation : montant ≥ 1 000 XAF
- **Aucun maximum côté admin** (vs client web : max 50M XAF)

### 5.5 Étape 3 — Famille

- 5 cards avec icône, label, description
- Alerte orange si montant > 500 000 XAF (limite Mobile Money)

### 5.6 Étape 4 — Sous-méthode

Affiché seulement pour BANK (transfer vs cash) et ORANGE_MONEY/MTN_MONEY (transfer vs withdrawal).
WAVE et AGENCY_BONZINI sautent cette étape.

### 5.7 Étape 5 — Banque

- 4 banques : Ecobank, CCA-BANK, UBA, Afriland
- N'apparaît que pour BANK_TRANSFER et BANK_CASH_DEPOSIT

### 5.8 Étape 6 — Agence

- 3 agences avec adresse et horaires affichés
- N'apparaît que pour AGENCY_BONZINI

### 5.9 Étape 7 — Récapitulatif (sections)

1. **Card résumé** — montant formaté + méthode sélectionnée
2. **Card client** — avatar initiales + nom complet
3. **Card coordonnées** — champs avec boutons copier-coller, valeurs monospace pour comptes/IBAN, code marchand si applicable avec bouton copie
4. **Card montant à envoyer** — montant en couleur primaire
5. **Card instructions** — liste numérotée (4 étapes)
6. **Card preuves** — upload optionnel, `accept="image/*,application/pdf"`, max 5 fichiers, preview miniatures
7. **Card commentaire admin** — textarea optionnel "Note interne..."
8. **Notice de confirmation** — "Le dépôt sera créé... Les preuves seront téléchargées..." (texte adapté)
9. **Bouton "Confirmer et créer le dépôt"**

### 5.10 Soumission

**RPC appelée :** `create_client_deposit`

```typescript
{
  p_user_id: selectedClient.user_id,
  p_amount_xaf: amountNum,
  p_method: getDepositMethod(),   // résolu depuis selectedSubMethod
  p_bank_name: selectedBank ? banks.find(b => b.bank === selectedBank)?.label : undefined,
  p_agency_name: selectedAgency ? agencies.find(a => a.agency === selectedAgency)?.label : undefined,
  p_client_phone: undefined       // toujours null dans le formulaire admin
}
```

**Post-création si preuves :**
1. Upload chaque fichier : `deposit-proofs/{userId}/{depositId}/{timestamp}-{random}.{ext}`
2. Compresse avec `compressImage()` avant upload
3. Insert dans `deposit_proofs` avec `uploaded_by_type = 'admin'`
4. `UPDATE deposits SET status = 'proof_submitted'`
5. Insert `deposit_timeline_events` (event_type `'proof_submitted'`)

**Post-création :** `navigate('/m/deposits/{id}')` vers la fiche du dépôt créé.

**En cas d'erreur RPC :** retour à l'étape `recap` (`goTo('recap', 'back')`).

### 5.11 Problèmes identifiés

1. **Pas de montant minimum admin** clairement défini (1 000 XAF) — différent du client web (50 000 XAF).
2. **`client_phone` jamais rempli** dans le formulaire admin — champ DB toujours `null`.
3. **`BankOption.OTHER`** défini dans `src/types/deposit.ts` mais absent de la liste dans `depositMethodsData.ts` — dead code.
4. **Max 5 preuves** non expliqué à l'utilisateur dans l'UI.
5. **Pas de sauvegarde de l'état** — si on navigue hors du formulaire en cours, tout est perdu.

---

## 6. Écran liste — MobileDepositsScreen.tsx

**Fichier :** `src/mobile/screens/deposits/MobileDepositsScreen.tsx`
**Lignes :** 516
**Route :** `/m/deposits`

### 6.1 KPI Cards (scrollable horizontal, cliquables = filtre toggle)

| Card | Couleur | Valeur source | Filtre déclenché |
|---|---|---|---|
| **À traiter** | Bleu | `stats.to_process` = `proof_submitted + admin_review` | `statusFilter = 'to_process'` |
| **À corriger** | Orange | `stats.pending_correction` | `statusFilter = 'pending_correction'` |
| **Validés** | Vert | `stats.validated` | `statusFilter = 'validated'` |
| **Aujourd'hui** | Primary | `stats.today_validated` + montant | Pas de filtre |

> KPI "Aujourd'hui" est **masqué si `today_validated === 0`**.

### 6.2 Filtres statut (chips horizontaux)

| Chip | Statuts inclus dans la requête |
|---|---|
| Tous | (tous) |
| À traiter | `proof_submitted` + `admin_review` (multi-status) |
| À corriger | `pending_correction` |
| Validés | `validated` |
| Rejetés | `rejected` |
| Annulés | `cancelled` |

> `created` et `awaiting_proof` sont absents des chips.

### 6.3 Filtres avancés (panneau toggle)

| Filtre | Type | Valeurs |
|---|---|---|
| Méthode | Chips sélection unique | Toutes méthodes + 8 méthodes individuelles |
| Tri | Chips sélection unique | Plus récent (défaut), Plus ancien, Montant ↓, Montant ↑ |
| Période | Date pickers natifs | Date début + Date fin |

Badge compteur sur le bouton filtre (nombre de filtres avancés actifs, hors méthode "tous" et tri "newest").

### 6.4 Recherche

- **Champ texte** avec debounce
- **Client-side** sur les données déjà chargées
- Champs recherchés : `firstName + lastName`, `reference`, `phone`

### 6.5 Indicateurs SLA

Calculés via `getDepositSlaLevel(created_at, status)` :

| Niveau | Condition | Affichage |
|---|---|---|
| `fresh` | < 2h depuis `created_at` | Pastille verte (pulse) |
| `aging` | 2h–8h | Pastille jaune |
| `overdue` | > 8h | Pastille rouge animée |
| `null` | Statut terminal | Pas de pastille |

### 6.6 Contenu d'une carte dépôt

```
[Avatar] Nom Client             Montant XAF
         Référence              [Badge statut]
         [Méthode] [📎 N]       [SLA dot] date relative
```

### 6.7 Pagination

- `usePaginatedAdminDeposits(filterParams)` — infinite scroll
- `PAGE_SIZE = 20` par page
- Trigger : `InfiniteScrollTrigger` (intersection observer)
- Pull-to-refresh via `PullToRefresh`
- Skeleton pendant le chargement initial

### 6.8 Requête backend

```typescript
interface DepositFilters {
  status?: string;              // Un seul statut
  statuses?: string[];          // Plusieurs statuts (to_process)
  method?: string;
  dateFrom?: string;            // ISO date
  dateTo?: string;              // ISO date + T23:59:59.999Z
  sortField?: 'created_at' | 'amount_xaf';
  sortAscending?: boolean;
}
```

Pour chaque page : join parallèle avec `clients` (profils) + count de preuves non-deleted.

### 6.9 Problèmes identifiés

1. **Recherche client-side uniquement** — les dépôts non encore chargés (page 2+) ne sont pas trouvables.
2. **Filtres `created` et `awaiting_proof` absents** des chips statut.
3. **Pas de compteur sur le chip "Annulés"**.
4. **KPI "Aujourd'hui" disparaît** si aucune validation du jour — incohérence avec les autres KPIs.
5. **Pas de tri par statut** dans les filtres avancés.

---

## 7. Preuves / justificatifs

### 7.1 Table deposit_proofs

```sql
deposit_proofs (
  id                   UUID PRIMARY KEY,
  deposit_id           UUID REFERENCES deposits(id) ON DELETE CASCADE,
  file_url             TEXT NOT NULL,         -- 'deposit-proofs/{userId}/{depositId}/...'
  file_name            TEXT NOT NULL,
  file_type            TEXT,                  -- MIME type
  uploaded_at          TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by          UUID REFERENCES auth.users(id),
  uploaded_by_type     VARCHAR(10) CHECK (IN ('client', 'admin')),
  is_visible_to_client BOOLEAN DEFAULT TRUE,  -- Jamais utilisé dans l'UI
  deleted_at           TIMESTAMPTZ,           -- Soft-delete
  deleted_by           UUID REFERENCES auth.users(id),
  delete_reason        TEXT
);

-- Index partiel sur les preuves actives
CREATE INDEX idx_deposit_proofs_active
  ON deposit_proofs(deposit_id) WHERE deleted_at IS NULL;
```

### 7.2 Bucket Supabase Storage

**Nom :** `deposit-proofs`

**Path pattern :**
```
{user_id}/{deposit_id}/{timestamp}-{random}.{ext}

Exemple :
abc123/def456/1741863600000-x7k3m.jpg
abc123/def456/1741863601234-p9r2n.pdf
```

**Stocké dans DB comme :** `deposit-proofs/{path}` (avec préfixe bucket)

**Signed URLs :** `createSignedUrl(path, 3600)` — validité **1 heure**

**Cache React Query :** `staleTime: 55 min` pour éviter re-génération à chaque navigation.

### 7.3 Quand peut-on uploader

**Client :**
- Statuts autorisés : `created`, `awaiting_proof`, `pending_correction`
- Upload avance automatiquement vers `proof_submitted`

**Admin :**
- Mêmes statuts pour avance automatique
- Si `proof_submitted` ou `admin_review` : upload accepté **sans** changer le statut

### 7.4 Soft-delete admin (`useAdminDeleteProof`)

1. `UPDATE deposit_proofs SET deleted_at, deleted_by, delete_reason`
2. Compte les preuves actives restantes
3. Si 0 preuves et statut non-terminal → `UPDATE deposits SET status = 'created'`
4. `INSERT deposit_timeline_events` (event `'proof_deleted'`)
5. `INSERT admin_audit_logs`

**Raisons de suppression disponibles :**
- Upload incorrect
- Mauvais dépôt
- Doublon
- Image illisible
- Autre (+ champ texte libre)

### 7.5 Formats acceptés

```
accept="image/*,application/pdf"
```

Compression auto via `compressImage()` avant upload (côté admin uniquement).

### 7.6 Nettoyage storage lors de la suppression d'un dépôt

```typescript
// useAdminDeposits.ts - useDeleteDeposit
// AVANT l'appel RPC :
const { data: proofs } = await supabaseAdmin.from('deposit_proofs').select('file_url').eq('deposit_id', depositId);
for (const proof of proofs) {
  const path = proof.file_url.split('/deposit-proofs/')[1];
  await supabaseAdmin.storage.from('deposit-proofs').remove([path]);
}
// PUIS appel RPC delete_deposit
```

### 7.7 Problèmes identifiés

1. **`is_visible_to_client`** présent en DB et dans les types mais jamais conditionne l'affichage.
2. **Pas de limite de taille** fichier clairement documentée dans l'UI.
3. **Nettoyage storage manuel** — si appel direct RPC (ex: Studio), les fichiers restent.
4. **Pas d'aperçu PDF** dans la proof strip — icône générique.

---

## 8. Version client web

### 8.1 DepositsPage.tsx — `/deposits` (148 lignes)

**Rôle :** Liste des dépôts du client connecté

**Affichage :**
- 50 dépôts récents, ordre `created_at DESC`
- Méthode (icône), date relative, badge statut coloré, montant XAF
- FAB "+" → création (`/deposits/new`)

**Mapping couleurs statut :**
```typescript
{ validated: 'success', rejected: 'error',
  pending_correction: 'info', admin_review: 'processing',
  proof_submitted: 'info' }
```

### 8.2 NewDepositPage.tsx — `/deposits/new` (746 lignes)

**Rôle :** Création dépôt par le client (7 étapes)

**Étapes :** `amount` → `family` → `submethod` → `bank` → `agency` → `recap` → `creating`

**Différences vs formulaire admin :**
| Aspect | Client web | Admin mobile |
|---|---|---|
| Étape client | Absente (auto) | Présente (step 1) |
| Montant min | 50 000 XAF | 1 000 XAF |
| Montant max | 50 000 000 XAF | Aucun |
| Presets | 100K, 500K, 1M | 100K, 500K, 1M, 2M |
| Upload preuves | Non (après création) | Optionnel à la création |
| Commentaire admin | Non | Optionnel |

### 8.3 DepositDetailPage.tsx — `/deposits/:depositId` (844 lignes)

**Rôle :** Fiche dépôt côté client

**Sections :**
1. Hero : montant animé, badge statut, référence copiable
2. Alertes contextuelles : countdown, notice rejet, notice correction, notice annulation
3. Détails : méthode, banque, agence, montant, statut, date
4. Instructions de dépôt (mode compact)
5. Strip preuves scrollable avec boutons delete
6. Zone upload preuve
7. Timeline compacte
8. Bouton reçu PDF
9. Bouton annuler (si non-terminal)

**Conditions client :**
```typescript
canUploadProof = ['created', 'awaiting_proof', 'pending_correction'].includes(status)
canDeleteProofs = !['validated', 'rejected', 'cancelled'].includes(status)
canCancel = ['created', 'awaiting_proof', 'proof_submitted'].includes(status)
isTerminal = ['validated', 'wallet_credited', 'rejected', 'cancelled'].includes(status)
```

---

## 9. Connexions avec les autres modules

### 9.1 Dashboard → Dépôts

- `get_deposit_stats()` alimente les KPI cards du dashboard admin
- Navigation directe `/m/deposits` depuis le dashboard
- `['dashboard-stats']` invalidé après validation/création dépôt

### 9.2 Fiche client → Création dépôt

```typescript
navigate('/m/deposits/new?clientId=' + client.user_id)
```

L'étape de sélection client est sautée, client pré-sélectionné.

### 9.3 Wallet — Impact d'une validation

```sql
-- validate_deposit RPC (FOR UPDATE sur les deux tables)
UPDATE wallets
SET balance_xaf = balance_xaf + v_deposit.amount_xaf,
    updated_at = now()
WHERE user_id = v_deposit.user_id;
```

Crédit **immédiat et atomique** à la validation.

Inversion lors de la suppression d'un dépôt validé :
```sql
UPDATE wallets
SET balance_xaf = GREATEST(0, balance_xaf - v_deposit.amount_xaf)
```

### 9.4 Ledger entries

| Événement | `entry_type` | `reference_type` | Mouvement wallet |
|---|---|---|---|
| Validation | `DEPOSIT_VALIDATED` | `'deposit'` | +amount_xaf |
| Rejet | `DEPOSIT_REFUSED` | `'deposit'` | Aucun |

> **Sans FK contrainte** sur `ledger_entries.reference_id` → orphelins possibles.
> **Corrigé** par la migration `20260313000002` qui nettoie lors des suppressions.

### 9.5 Notifications

| Événement | `type` | Metadata |
|---|---|---|
| Validation | `deposit_validated` | `deposit_id`, `reference`, `amount_xaf`, `new_balance`, `method` |
| Rejet | `deposit_rejected` | `deposit_id`, `reference`, `amount_xaf`, `reason` |
| Correction | `deposit_correction_requested` | `deposit_id`, `reference`, `reason` |

Nettoyées lors de la suppression d'un dépôt (migration `20260313000002`).

### 9.6 Reçu PDF

**Composant :** `src/lib/pdf/templates/DepositReceiptPDF.tsx`

Sections : Header → Statut + date → Montant (avec note si confirmé ≠ déclaré) → Transaction (méthode, dates) → Client → Footer

---

## 10. Différences avec le module paiements

### 10.1 Tableau comparatif

| Aspect | Dépôts | Paiements |
|---|---|---|
| **Effet wallet** | Crédite (+amount_xaf) | Débite (-amount_xaf) |
| **Devise** | XAF uniquement | XAF → CNY (taux de change) |
| **Bénéficiaire** | Aucun | Requis |
| **Taux de change** | Aucun | `daily_rates` + `rate_adjustments` |
| **Statuts** | 8 | 8 (différents) |
| **Statuts terminaux** | validated, rejected, cancelled | completed, rejected |
| **Méthodes** | 8 (mobile money, banque, agence) | 4 (alipay, wechat, bank, cash) |
| **Mobile Money** | Oui | Non |
| **QR Code** | Non | Oui (Alipay, WeChat) |
| **Preuves uploadées par** | Client (preuve virement) | Admin (confirmation) |
| **Soft-delete preuves** | Oui | Oui |
| **SLA tracking** | Oui (8h overdue) | Non |
| **Annulation client** | Oui | Non |
| **Correction demandable** | Oui | Non |
| **Super admin delete** | Oui | Oui |
| **Timeline steps** | 4 + 3 branches terminales | 4 + 2 branches terminales |

### 10.2 Composants partagés vs spécifiques

| Composant | Dépôts | Paiements |
|---|---|---|
| `DepositTimelineDisplay.tsx` | ✓ | ✗ |
| `DepositInstructions.tsx` | ✓ | ✗ |
| `DepositReceiptPDF.tsx` | ✓ | ✗ |
| `PaymentReceiptPDF.tsx` | ✗ | ✓ |
| `MobileHeader` | ✓ | ✓ |
| `PullToRefresh` | ✓ | ✓ |
| `InfiniteScrollTrigger` | ✓ | ✓ |
| `StepTransition` | ✓ | ✓ |

### 10.3 Incohérences structurelles identifiées

1. **Upload preuve** : dépôts = client uploade EN PREMIER ; paiements = admin uploade APRÈS exécution.
2. **`wallet_operations` (legacy)** : migrations initiales dépôts (`20260131`) écrivent dans `wallet_operations`, paiements écrivent dans `ledger_entries` — double système.
3. **Correction** : uniquement pour dépôts. Les paiements sont directement rejetés.
4. **Statut `pending_correction` reuse `rejection_reason`** — le champ `rejection_reason` est utilisé pour stocker la raison de correction, pas seulement les raisons de rejet.

---

## 11. Problèmes et incohérences identifiés

### 11.1 Bugs critiques (🔴)

| # | Description | Localisation |
|---|---|---|
| **B1** | `wallet_operations` toujours alimentée par `validate_deposit` (migration 20260131) mais les paiements n'y écrivent plus — deux systèmes de trace simultanés | `20260131200000_rebuild_deposit_validation.sql:91-113` |
| **B2** | Pas de FK sur `ledger_entries.reference_id` → orphelins possibles sans cleanup (corrigé partiellement par 20260313000002) | `20260210100000_ledger_entries.sql:29` |
| **B3** | Nettoyage storage manuel côté frontend avant RPC `delete_deposit` — si la RPC est appelée directement (Studio/API), les fichiers storage restent | `useAdminDeposits.ts:621-635` |

### 11.2 Incohérences logiques (🟡)

| # | Description | Localisation |
|---|---|---|
| **I1** | `awaiting_proof` = statut fantôme, même comportement que `created`, jamais atteint naturellement via le backend | `src/types/deposit.ts:19` |
| **I2** | `is_visible_to_client` présent en DB et dans les types mais jamais utilisé dans l'UI | `src/types/deposit.ts:149` |
| **I3** | `confirmed_amount_xaf` non affiché dans les détails de la fiche admin si différent du montant déclaré | `MobileDepositDetail.tsx section details` |
| **I4** | SLA calculé depuis `created_at`, pas depuis la date de soumission de la preuve — un dépôt créé il y a 10h mais preuve soumise il y a 5 min sera "overdue" | `src/lib/depositTimeline.ts` |
| **I5** | Montant minimum différent : client web = 50 000 XAF, admin = 1 000 XAF, non documenté ni visible | `NewDepositPage.tsx` vs `MobileNewDeposit.tsx:540` |
| **I6** | `BankOption.OTHER` défini dans les types mais absent de la liste `banks` dans les données statiques | `src/types/deposit.ts:51` |
| **I7** | `pending_correction` reuse `rejection_reason` pour stocker le motif de correction | `20260131200000:382-387` |

### 11.3 Problèmes UI/UX (🟠)

| # | Description | Localisation |
|---|---|---|
| **U1** | Bouton "Valider" visible même sans preuve — seul un avertissement non bloquant | `MobileDepositDetail.tsx:457-465` |
| **U2** | Pas de lien vers le profil client depuis la fiche dépôt | `MobileDepositDetail.tsx` |
| **U3** | Recherche client-side uniquement sur la liste — items non chargés non cherchables | `MobileDepositsScreen.tsx:137-149` |
| **U4** | Filtres `created` et `awaiting_proof` absents des chips statut | `MobileDepositsScreen.tsx:34-41` |
| **U5** | KPI "Aujourd'hui" disparaît si `today_validated === 0` — incohérence visuelle | `MobileDepositsScreen.tsx:246` |
| **U6** | Pas d'aperçu PDF dans la proof strip — icône générique | `MobileDepositDetail.tsx` |
| **U7** | Action bar sticky `bottom-16` peut chevaucher le bouton Supprimer | `MobileDepositDetail.tsx:682` |

### 11.4 Code mort

| # | Description |
|---|---|
| **D1** | `client_phone` dans les types de mutation — jamais rempli dans les formulaires admin |
| **D2** | `BankOption.OTHER` défini mais inutilisé |
| **D3** | `is_visible_to_client` en DB mais jamais conditionne l'affichage |
| **D4** | `awaiting_proof` dans `TIMELINE_STEP_LABELS` — jamais atteint naturellement |

---

## 12. Annexes SQL

### 12.1 Table deposits (colonnes complètes)

```sql
CREATE TABLE public.deposits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  reference             TEXT NOT NULL UNIQUE,
  amount_xaf            BIGINT NOT NULL CHECK (amount_xaf > 0),
  method                TEXT NOT NULL,           -- DepositMethod enum
  bank_name             TEXT,
  agency_name           TEXT,
  client_phone          TEXT,
  status                TEXT NOT NULL DEFAULT 'created',
  admin_comment         TEXT,
  rejection_reason      TEXT,                    -- aussi utilisé pour pending_correction
  confirmed_amount_xaf  BIGINT,                  -- Ajout 20260213
  rejection_category    TEXT,                    -- Ajout 20260213
  admin_internal_note   TEXT,                    -- Ajout 20260213
  validated_by          UUID REFERENCES auth.users(id),
  validated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### 12.2 Table deposit_proofs (colonnes complètes)

```sql
CREATE TABLE public.deposit_proofs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id           UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  file_url             TEXT NOT NULL,
  file_name            TEXT NOT NULL,
  file_type            TEXT,
  uploaded_at          TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by          UUID REFERENCES auth.users(id),       -- Ajout 20260213
  uploaded_by_type     VARCHAR(10) CHECK (uploaded_by_type IN ('client', 'admin')),
  is_visible_to_client BOOLEAN DEFAULT TRUE,                 -- Ajout 20260213 (non utilisé)
  deleted_at           TIMESTAMPTZ,                          -- Soft-delete
  deleted_by           UUID REFERENCES auth.users(id),
  delete_reason        TEXT
);

CREATE INDEX idx_deposit_proofs_active
  ON deposit_proofs(deposit_id) WHERE deleted_at IS NULL;
```

### 12.3 Toutes les RPCs liées aux dépôts

| Fonction | Signature complète | Rôle | Acteur |
|---|---|---|---|
| `create_client_deposit` | `(p_user_id, p_amount_xaf, p_method, p_bank_name?, p_agency_name?, p_client_phone?)` | Crée un dépôt | Client ou Admin |
| `validate_deposit` | `(p_deposit_id, p_admin_comment?, p_confirmed_amount?, p_send_notification?)` | Valide + crédite wallet | Admin |
| `reject_deposit` | `(p_deposit_id, p_reason, p_rejection_category?, p_admin_note?)` | Rejette avec raison | Admin |
| `request_deposit_correction` | `(p_deposit_id, p_reason)` | Demande correction client | Admin |
| `start_deposit_review` | `(p_deposit_id)` | Passe en `admin_review` | Admin |
| `resubmit_deposit` | `(p_deposit_id)` | Client renvoie après correction | Client |
| `cancel_client_deposit` | `(p_deposit_id)` | Client annule le dépôt | Client |
| `get_deposit_stats` | `()` | Stats agrégées (totaux par statut) | Admin |
| `delete_deposit` | `(p_deposit_id)` | Supprime + cleanup complet | Super Admin |

### 12.4 Politiques RLS principales

**Table `deposits` :**
- SELECT : `user_id = auth.uid()` OU `is_admin(auth.uid())`
- INSERT/UPDATE/DELETE : via RPCs (SECURITY DEFINER uniquement)

**Table `deposit_proofs` :**
- SELECT : Client voit ses preuves (via deposit_id joint à user_id) ; Admin voit tout
- INSERT : Client sur ses propres dépôts
- UPDATE : Client peut soft-delete ses preuves ; Admin peut tout modifier

**Table `ledger_entries` :**
- SELECT : `user_id = auth.uid()` OU `is_admin(auth.uid())`
- INSERT : Admin uniquement

### 12.5 get_deposit_stats() — valeurs retournées

```typescript
interface DepositStats {
  total: number;              // Tous les dépôts
  awaiting_proof: number;     // created + awaiting_proof
  proof_submitted: number;
  pending_correction: number;
  admin_review: number;
  validated: number;
  rejected: number;
  to_process: number;         // proof_submitted + admin_review
  today_validated: number;    // Validés aujourd'hui
  today_amount: number;       // Somme validée aujourd'hui
}
```

### 12.6 Liste exhaustive des fichiers

**Frontend (src/) :**
```
src/types/deposit.ts                                                314
src/data/depositMethodsData.ts                                      247
src/lib/depositTimeline.ts                                          259
src/hooks/useDeposits.ts                                            436
src/hooks/usePaginatedDeposits.ts                                   108
src/hooks/useAdminDeposits.ts                                       761
src/components/deposit/DepositInstructions.tsx                      350
src/components/deposit/DepositTimelineDisplay.tsx                   166
src/lib/pdf/templates/DepositReceiptPDF.tsx                         134
src/pages/DepositsPage.tsx                                          148
src/pages/NewDepositPage.tsx                                        746
src/pages/DepositDetailPage.tsx                                     844
src/mobile/screens/deposits/MobileDepositsScreen.tsx                516
src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx       1001
src/mobile/screens/deposits/MobileDepositDetail.tsx                1196
────────────────────────────────────────────────────────────────────────
TOTAL FRONTEND                                                      7226
```

**Migrations (supabase/migrations/) :**
```
20260131200000_rebuild_deposit_validation.sql                       592
20260213000000_enhanced_deposit_validation.sql                      390
20260214000000_deposit_proofs_client_policies.sql                    55
20260219300000_deposit_cancel_and_remove_rate_limit.sql             102
20260221500000_fix_deposit_rpcs_is_admin.sql                        302
20260313000001_fix_delete_payment_and_add_delete_deposit.sql        208
20260313000002_fix_delete_cleanup_full.sql                          196
────────────────────────────────────────────────────────────────────────
TOTAL MIGRATIONS                                                    1845
```

---

*Document généré par analyse statique complète du code source — Bonzini Platform — 13 mars 2026*
