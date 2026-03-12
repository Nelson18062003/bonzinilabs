# PROMPT CLAUDE CODE — Intégration de la fiche paiement redesignée (App Admin)

> **Lis ce prompt EN ENTIER. La maquette interactive est dans `maquette_admin_fiche_paiement_v4.jsx`. Le document d'analyse complet est dans `ANALYSE_MODULE_PAIEMENTS.pdf`. Ouvre les deux avant de commencer.**

---

## Objectif

Remplacer l'actuelle fiche paiement admin (`MobilePaymentDetail.tsx` — 1402 lignes) par la nouvelle version basée sur la maquette. L'ancien composant est trop complexe, mal structuré, avec des répétitions. Le nouveau est épuré mais doit conserver TOUTE la logique métier existante.

**Le but n'est PAS de réécrire la logique. C'est de remplacer l'UI en gardant toutes les connexions intactes.**

---

## ÉTAPE 0 — CARTOGRAPHIER L'EXISTANT

### 0.1 Le composant actuel et ses dépendances

```bash
# Lire le composant principal
cat src/mobile/screens/payments/MobilePaymentDetail.tsx | head -100

# Lister TOUS les imports
grep -n "^import" src/mobile/screens/payments/MobilePaymentDetail.tsx

# Lister TOUS les hooks utilisés
grep -n "use[A-Z]" src/mobile/screens/payments/MobilePaymentDetail.tsx | head -40

# Lister TOUTES les fonctions appelées
grep -n "const.*=.*use\|function\|async" src/mobile/screens/payments/MobilePaymentDetail.tsx | head -40
```

### 0.2 Identifier chaque hook et ce qu'il fournit

```bash
# Hook principal des paiements
cat src/hooks/usePayments.ts | head -50
grep -n "export" src/hooks/usePayments.ts

# Hook admin des paiements
cat src/hooks/useAdminPayments.ts | head -50
grep -n "export" src/hooks/useAdminPayments.ts

# Hook bénéficiaires
grep -n "export" src/hooks/useBeneficiaries.ts

# Hook preuves
grep -rn "usePaymentProof\|useProof\|useUpload" src/hooks/ --include="*.ts" | head -10

# Hook agent cash
grep -n "export" src/hooks/useAgentCashActions.ts

# Hook permissions
grep -rn "usePermission\|useAuth\|useAdmin\|canProcess\|hasPermission" src/ --include="*.ts" --include="*.tsx" | grep -i "export\|const.*=" | head -10
```

### 0.3 Identifier les connexions avec les autres modules

```bash
# Navigation — quelles pages pointent vers cette fiche
grep -rn "MobilePaymentDetail\|PaymentDetail\|payment.*detail\|/payment/" src/mobile/ --include="*.tsx" --include="*.ts" | grep -i "navigate\|route\|link\|push"

# Qui navigue DEPUIS cette fiche (liens sortants)
grep -n "navigate\|router\|push\|Link" src/mobile/screens/payments/MobilePaymentDetail.tsx

# Le composant d'édition bénéficiaire
cat src/mobile/screens/payments/MobileBeneficiaryEdit.tsx | head -50

# Composants partagés utilisés
grep -n "import.*from.*component\|import.*from.*shared\|import.*from.*common" src/mobile/screens/payments/MobilePaymentDetail.tsx

# Le template PDF du reçu
grep -rn "PaymentReceipt\|receipt.*pdf\|generateReceipt\|downloadReceipt" src/mobile/screens/payments/MobilePaymentDetail.tsx

# Timeline
grep -rn "timeline\|Timeline\|paymentTimeline" src/mobile/screens/payments/MobilePaymentDetail.tsx
```

### 0.4 Variables clés — RECOPIER EXACTEMENT

Identifie et note ces variables qui existent déjà dans le composant :

```typescript
// Ces variables DOIVENT être conservées telles quelles
const isLocked = ['completed', 'rejected'].includes(payment.status);
const canProcess = hasPermission('canProcessPayments');
const isSuperAdmin = currentUser?.role === 'super_admin';
const canEditBeneficiary = canProcess && !isLocked &&
  ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);
// + toutes les autres variables de permission
```

---

## ÉTAPE 1 — PLAN DE REMPLACEMENT

**Ne supprime PAS l'ancien fichier immédiatement.**

1. Crée le nouveau composant : `MobilePaymentDetailV2.tsx`
2. Copie TOUS les imports et hooks de l'ancien composant dans le nouveau
3. Reconstruit l'UI selon la maquette en utilisant les mêmes données
4. Quand tout fonctionne, remplace l'ancien par le nouveau dans le routeur
5. Supprime l'ancien fichier

---

## ÉTAPE 2 — STRUCTURE DU NOUVEAU COMPOSANT

### 2.1 Les données dont on a besoin

```typescript
// Données du paiement (vient du hook existant)
const payment = {
  id, reference, status, method,
  amount_xaf, amount_rmb, exchange_rate,
  // Bénéficiaire
  beneficiary_name, beneficiary_phone, beneficiary_email,
  beneficiary_qr_code_url, beneficiary_bank_name, beneficiary_bank_account,
  beneficiary_notes, beneficiary_id, beneficiary_details,
  // Cash
  cash_qr_code, cash_beneficiary_type,
  cash_beneficiary_first_name, cash_beneficiary_last_name,
  cash_beneficiary_phone, cash_signed_by_name, cash_signature_url, cash_paid_at,
  // Admin
  processed_by, processed_at, rejection_reason,
  admin_comment, client_visible_comment,
  // Solde
  balance_before, balance_after,
  // Taux
  rate_is_custom,
  // Dates
  created_at, updated_at,
  // Relations
  user: { name, phone, email },  // le client
};

// Preuves (vient d'un hook séparé ou inclus dans le paiement)
const proofs = payment.payment_proofs || [];

// Timeline (vient d'un hook ou fonction)
const timeline = payment.payment_timeline_events || [];

// Permissions
const { canProcess, isSuperAdmin } = useAdminAuth();
```

### 2.2 Le taux — normalisation obligatoire

```typescript
// Le taux en base peut être en décimal (ancien) ou entier (nouveau)
// TOUJOURS normaliser avec cette logique :
const rateInt = payment.exchange_rate < 1
  ? Math.round(payment.exchange_rate * 1_000_000)
  : Math.round(payment.exchange_rate);

// Affichage : "1M XAF = ¥{rateInt}"
// JAMAIS "RMB", JAMAIS l'inverse
```

### 2.3 Layout de la fiche

```
┌─────────────────────────────────────┐
│ HEADER : ‹ BZ-PY-2026-0026  [Reçu] │
├─────────────────────────────────────┤
│ STATUT (badge) ····· MODE (icône)   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │      MONTANT (carte centrale)   │ │
│ │      ¥5 765 (gros)             │ │
│ │      500 000 XAF               │ │
│ │      ──────────────             │ │
│ │   Taux: 1M=¥11530  Client: LK  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │      BÉNÉFICIAIRE               │ │
│ │  (adaptatif selon le mode)      │ │
│ │  + QR code si Alipay/WeChat     │ │
│ │  + Banque si Virement           │ │
│ │  + Signature si Cash            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  PREUVES (N) ··· [+ Ajouter]   │ │
│ │  (multiples, chacune avec       │ │
│ │   preview + agrandir/supprimer) │ │
│ │  ─── OU ───                     │ │
│ │  SIGNATURE (si Cash)            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  INFOS : Référence + Date       │ │
│ │  + Motif refus (si rejeté)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│  [Action principale]                │
│  [Refuser]                          │
│  [Supprimer]                        │
└─────────────────────────────────────┘
```

---

## ÉTAPE 3 — ACTIONS ET CONDITIONS

### 3.1 Boutons d'action — réutiliser la logique existante

**IMPORTANT : Ne réécris PAS la logique des boutons. Réutilise les fonctions existantes.**

```bash
# Trouver les handlers d'action dans l'ancien composant
grep -n "handleStartProcessing\|handleComplete\|handleReject\|handleDelete\|processPayment" src/mobile/screens/payments/MobilePaymentDetail.tsx

# Trouver les appels RPC
grep -n "\.rpc\|supabase" src/mobile/screens/payments/MobilePaymentDetail.tsx
```

**Tableau des actions → hooks/fonctions existants :**

| Action dans la maquette | Fonction existante à réutiliser |
|---|---|
| "Passer en cours" | `process_payment(id, 'start_processing')` via hook |
| "Valider le paiement" | `process_payment(id, 'complete')` via hook |
| "Refuser" | `process_payment(id, 'reject', reason)` via hook — avec modal de raison |
| "Supprimer" | `delete_payment(id)` via hook — avec confirmation |
| "Modifier bénéficiaire" | `admin_update_payment_beneficiary()` via hook ou navigation vers `MobileBeneficiaryEdit` |
| "Ajouter preuve" | Upload via Supabase Storage + insert `payment_proofs` — hook existant |
| "Supprimer preuve" | `delete_payment_proof(proof_id)` via hook |
| "Reçu PDF" | Composant PDF existant `PaymentReceiptPDF` |
| "Faire signer" (Cash) | Logique de signature + upload vers `cash-signatures` bucket |

### 3.2 Conditions d'affichage — EXACTES

```typescript
// Statut
const isLocked = ['completed', 'rejected'].includes(payment.status);
const isCash = payment.method === 'cash';
const isCashFlow = ['cash_pending', 'cash_scanned'].includes(payment.status);

// Bénéficiaire
const hasBeneficiaryInfo = payment.status !== 'waiting_beneficiary_info';
const canEditBeneficiary = canProcess && !isLocked &&
  ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);

// Actions principales
const canStartProcessing = canProcess && payment.status === 'ready_for_payment';
const canComplete = canProcess && payment.status === 'processing';
const canReject = canProcess && payment.status !== 'completed';
const canDelete = canProcess && (!isLocked || isSuperAdmin);

// Preuves
const canAddProof = canProcess && !isLocked;
const canDeleteProof = canProcess && (!isLocked || isSuperAdmin);

// QR code bénéficiaire (Alipay/WeChat)
const hasQRCode = !!payment.beneficiary_qr_code_url;
const canEditQR = canEditBeneficiary;

// Cash signature
const hasCashSignature = !!payment.cash_signature_url;
```

---

## ÉTAPE 4 — CONNEXIONS AVEC LES AUTRES MODULES

### 4.1 Lien Client

Le nom du client dans le bloc montant est cliquable → navigue vers la fiche client.

```bash
# Trouver comment la navigation vers le client fonctionne
grep -n "client.*navigate\|navigate.*client\|push.*client" src/mobile/screens/payments/MobilePaymentDetail.tsx
```

### 4.2 Lien Bénéficiaire sauvegardé

Si `payment.beneficiary_id` existe, le bénéficiaire est lié à un enregistrement dans la table `beneficiaries`. L'édition doit mettre à jour AUSSI ce lien si nécessaire.

### 4.3 Lien Timeline Events

La timeline est lue depuis `payment_timeline_events`. Le suivi dans la maquette est collapsible et utilise ces données.

```bash
# Trouver comment la timeline est chargée
grep -rn "timeline\|TimelineEvent\|payment_timeline" src/hooks/ --include="*.ts" | head -10
```

### 4.4 Lien Ledger / Wallet

Le solde affiché dans le bloc montant (`balance_before`, `balance_after`) vient de la table `payments` directement (snapshot). Pas besoin de requête supplémentaire.

### 4.5 Lien Notifications

Certaines transitions déclenchent des notifications client (via trigger ou code). **Ne touche pas à cette logique — elle est dans les RPC SQL, pas dans le frontend.**

### 4.6 Lien Reçu PDF

Le bouton "Reçu" en haut utilise le composant existant :

```bash
# Trouver le composant PDF
grep -rn "PaymentReceiptPDF\|receipt\|generatePDF\|downloadReceipt" src/mobile/screens/payments/MobilePaymentDetail.tsx
```

**Réutiliser exactement le même appel.**

---

## ÉTAPE 5 — SPÉCIFICITÉS PAR MODE

### 5.1 Alipay / WeChat

**Bloc bénéficiaire affiche :**
- Nom (`beneficiary_name`)
- Identifiant texte (`beneficiary_phone` ou `beneficiary_email` selon le mode)
- QR code (`beneficiary_qr_code_url`) — boutons Voir/Masquer, Changer, Retirer
- En mode édition : Nom + QR upload + ID + Téléphone + Email

**Bloc preuves :**
- Multiple preuves possibles (table `payment_proofs`)
- Chaque preuve : preview + Agrandir + Télécharger + Supprimer (si pas locked)

### 5.2 Virement (bank_transfer)

**Bloc bénéficiaire affiche :**
- Nom (`beneficiary_name`)
- Banque + Compte masqué (`beneficiary_bank_name` + `•••• derniers chiffres`)
- En mode édition : Titulaire + Banque + Compte + Notes

**Bloc preuves :** Identique à Alipay/WeChat

### 5.3 Cash

**Bloc bénéficiaire affiche :**
- Si `cash_beneficiary_type === 'self'` → affiche le nom du client + "Le client"
- Si `cash_beneficiary_type === 'other'` → affiche `cash_beneficiary_first_name` + `cash_beneficiary_last_name`
- En statut `cash_pending` / `cash_scanned` → affiche le QR code cash (`cash_qr_code`)

**Bloc signature (à la place des preuves) :**
- Si `cash_signature_url` existe → afficher l'image de la signature + date (`cash_paid_at`)
- Sinon et si pas locked → bouton "Faire signer" qui ouvre un canvas de signature
- Après signature → upload vers `cash-signatures` bucket + update `cash_signature_url` et `cash_signed_by_name`

**La signature pour Cash REMPLACE le bloc preuves.** Pas de preuves photo pour les paiements cash.

---

## ÉTAPE 6 — ÉDITION DU BÉNÉFICIAIRE

### 6.1 Via formulaire inline (maquette)

La maquette montre un formulaire inline dans la carte bénéficiaire. Mais le code actuel utilise peut-être un composant séparé `MobileBeneficiaryEdit.tsx`.

```bash
# Vérifier comment l'édition fonctionne actuellement
grep -n "BeneficiaryEdit\|editBenef\|beneficiary.*edit\|beneficiary.*modal" src/mobile/screens/payments/MobilePaymentDetail.tsx
```

**Deux options :**
- **Option A (recommandée)** : Garder le composant `MobileBeneficiaryEdit` existant et l'ouvrir au clic sur "Modifier" — mais s'assurer qu'il est visuellement cohérent avec la maquette
- **Option B** : Intégrer le formulaire inline directement dans la fiche — plus de travail mais UX plus fluide

**Choisis l'option qui minimise les changements.**

### 6.2 RPC à utiliser

```typescript
// Pour les modes non-cash :
admin_update_payment_beneficiary({
  p_payment_id: paymentId,
  p_beneficiary_name: name,
  p_beneficiary_phone: phone,
  p_beneficiary_email: email,
  p_beneficiary_qr_code_url: qrCodeUrl,
  p_beneficiary_bank_name: bankName,
  p_beneficiary_bank_account: bankAccount,
  p_beneficiary_notes: notes,
})
// Cette RPC change automatiquement le statut vers ready_for_payment si suffisant

// ATTENTION : Cette RPC ne gère PAS les champs cash_*
// Pour les paiements cash, vérifier s'il existe une autre RPC ou un UPDATE direct
```

---

## ÉTAPE 7 — UPLOAD ET SUPPRESSION

### 7.1 Preuves de paiement

```bash
# Trouver la logique d'upload actuelle
grep -rn "upload.*proof\|addProof\|createProof" src/hooks/ --include="*.ts"
grep -rn "payment-proofs" src/ --include="*.ts" --include="*.tsx" | head -10
```

**Upload :** Utiliser le hook existant. Le chemin dans le bucket est :
```
payment-proofs/admin/<paymentId>/<timestamp>_<filename>
```

**Suppression :** Utiliser `delete_payment_proof(proof_id)` — supprime du Storage ET de la table.

### 7.2 QR code bénéficiaire

```bash
# Trouver la logique d'upload QR
grep -rn "qr.*upload\|upload.*qr\|beneficiary_qr" src/ --include="*.ts" --include="*.tsx" | head -10
```

**Upload :** Même bucket `payment-proofs`, chemin :
```
payment-proofs/<paymentId>/qr_<timestamp>.<ext>
```

**Suppression :** UPDATE le paiement pour mettre `beneficiary_qr_code_url = null` + supprimer le fichier du Storage.

### 7.3 Signature Cash

```bash
# Trouver la logique de signature
grep -rn "signature\|cash.*sign\|sign.*cash\|canvas" src/ --include="*.ts" --include="*.tsx" | head -10
```

**Upload :** Bucket `cash-signatures`, chemin :
```
cash-signatures/<paymentId>/<timestamp>.png
```

**Après upload :** UPDATE le paiement avec `cash_signature_url`, `cash_signed_by_name`, `cash_paid_at`.

---

## DESIGN

### Police
**DM Sans uniquement.** Vérifie que la font est déjà chargée dans l'app.

### Couleurs
```
Violet       #A947FE   (actions principales, focus, liens)
Or           #F3A745   (statut "en attente", warnings doux)
Orange       #FE560D   (Cash, alertes)
Vert         #34d399   (Terminé, bouton Valider)
Rouge        #ef4444   (Refusé, Supprimer, Refuser)
Bleu         #3b82f6   (statut Prêt)
Alipay       #1677ff
WeChat       #07c160

Fond page    #f8f6fa
Cartes       #ffffff
Texte        #1a1028
Secondaire   #7a7290
Tertiaire    #c4bdd0
Bordures     #ebe6f0
```

### Tailles clés
```
Montant ¥         38-40px, weight 900
Montant XAF       14px, weight 400, color sub
Taux              11px, color dim
Nom bénéficiaire  15px, weight 700
Labels sections   12px, weight 800
Texte courant     11-12px
Bouton principal  14px, weight 700
Boutons petits    10px, weight 600
```

---

## CHECKLIST FINALE

### Structure
- [ ] Le nouveau composant est dans `MobilePaymentDetailV2.tsx`
- [ ] Tous les hooks de l'ancien composant sont réutilisés
- [ ] La route pointe vers le nouveau composant
- [ ] L'ancien composant est supprimé après validation

### Données
- [ ] Le taux est normalisé (< 1 → × 1 000 000)
- [ ] Le format du taux est "1M XAF = ¥X" partout
- [ ] Les montants XAF et CNY s'affichent correctement
- [ ] Le nom du client vient de la relation user

### Bénéficiaire
- [ ] Adaptatif au mode (Alipay ≠ Virement ≠ Cash)
- [ ] "En attente d'infos" → formulaire d'ajout ou bouton vers MobileBeneficiaryEdit
- [ ] Bouton "Modifier" visible uniquement si canEditBeneficiary
- [ ] QR code avec Voir/Changer/Retirer (Alipay/WeChat uniquement)
- [ ] Cash : affiche "Le client" ou le nom du tiers

### Preuves / Signature
- [ ] Non-cash : multiples preuves avec preview + Agrandir/Télécharger/Supprimer
- [ ] Cash : pad de signature (canvas) ou affichage signature existante
- [ ] Upload et suppression utilisent les hooks/RPC existants
- [ ] Boutons d'upload/suppression masqués si isLocked

### Actions
- [ ] "Passer en cours" → appelle process_payment('start_processing')
- [ ] "Valider" → appelle process_payment('complete')
- [ ] "Refuser" → ouvre modal raison → process_payment('reject', reason)
- [ ] "Supprimer" → confirmation → delete_payment(id)
- [ ] "Reçu" → utilise le composant PDF existant
- [ ] Tous les boutons respectent les conditions de permission

### Connexions
- [ ] Navigation vers fiche client fonctionne
- [ ] Navigation retour (‹) fonctionne
- [ ] Le composant reçoit le paymentId via la route/params
- [ ] Les preuves sont chargées depuis payment_proofs
- [ ] La timeline est chargée (si affichée dans le suivi)
- [ ] Le reçu PDF fonctionne

### Design
- [ ] DM Sans partout
- [ ] Couleurs respectées
- [ ] Bordures 1.5px, borderRadius 10-12
- [ ] Pas de "RMB" nulle part
