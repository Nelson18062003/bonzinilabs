# Payment Form Redesign — Documentation technique

## Vue d'ensemble

Refonte complète du module de paiement en 6 phases. Nouveau système de bénéficiaires, formulaires multi-étapes, taux de change multi-niveaux, et QR code dans les fiches de paiement.

---

## Architecture

### Flux admin (MobileNewPayment)
```
Client → Mode de paiement → Montant → Bénéficiaire → Résumé → Succès
  (1)          (2)            (3)          (4)          (5)
```

### Flux client (NewPaymentPage)
```
Mode de paiement → Montant → Bénéficiaire → Confirmation → Succès
       (1)           (2)          (3)            (4)
```

---

## 10 Règles absolues

| # | Règle | Détail |
|---|-------|--------|
| 1 | **Flex layout** | `h-dvh flex flex-col overflow-hidden`, jamais `position: fixed` |
| 2 | **Taux visible ≥ 10K XAF** | Le taux de change n'apparaît que quand le montant >= 10 000 XAF |
| 3 | **Bénéficiaire optionnel** | Skip possible avec "Ajouter plus tard" / checkbox orange |
| 4 | **QR code = fiche uniquement** | Le QR code n'apparaît jamais dans le résumé du formulaire |
| 5 | **Cash toujours rouge** | `#dc2626` partout (logo, bordure, badge) |
| 6 | **Barre de progression nommée** | `StepProgressBar` avec libellés sous chaque barre |
| 7 | **¥ collé au montant** | `¥${formatRMB(amount)}` sans espace |
| 8 | **Pas de labels tier** | Pas de "Tier 1", "Tier 2" etc. dans l'UI |
| 9 | **Min 10K XAF** | Validation côté client ET serveur (`BUSINESS_RULES.MIN_PAYMENT_AMOUNT`) |
| 10 | **Cohérence admin/client** | Mêmes composants partagés, même logique de calcul |

---

## Fichiers créés / modifiés

### Migrations SQL

| Fichier | Description |
|---------|-------------|
| `supabase/migrations/20260304100000_beneficiaries_table.sql` | Table `beneficiaries` avec RLS, index `(client_id, payment_method)` |
| `supabase/migrations/20260304200000_payments_beneficiary_fields.sql` | Colonnes `beneficiary_id`, `beneficiary_details` (JSONB), `rate_is_custom` sur `payments` |
| `supabase/migrations/20260304300000_update_payment_rpcs_beneficiary.sql` | RPCs `create_payment()` et `create_admin_payment()` avec 3 nouveaux paramètres |

### Hooks React Query

| Fichier | Exports |
|---------|---------|
| `src/hooks/useBeneficiaries.ts` | `useBeneficiaries()`, `useCreateBeneficiary()`, `useUpdateBeneficiary()`, `useAdminClientBeneficiaries()`, `useAdminCreateBeneficiary()` |
| `src/hooks/usePayments.ts` | Modifié : `Payment` + `CreatePaymentData` avec champs bénéficiaire |
| `src/hooks/useAdminPayments.ts` | Modifié : `AdminCreatePaymentData` avec champs bénéficiaire |

### Composants partagés

| Fichier | Description |
|---------|-------------|
| `src/components/payment-form/StepProgressBar.tsx` | Barre de progression avec noms d'étapes |
| `src/components/payment-form/PaymentMethodCard.tsx` | Carte de méthode avec bordure colorée par méthode |
| `src/components/payment-form/SuccessScreen.tsx` | Écran de succès (variante `admin` fond sombre, variante `client` centré) |

### Formulaires

| Fichier | Description |
|---------|-------------|
| `src/mobile/screens/payments/MobileNewPayment.tsx` | **Rewrite complet** — Formulaire admin 5 étapes |
| `src/pages/NewPaymentPage.tsx` | **Rewrite complet** — Formulaire client 4 étapes |

### Fiches de paiement (détail)

| Fichier | Description |
|---------|-------------|
| `src/mobile/screens/payments/MobilePaymentDetail.tsx` | Ajout : CashQRCode, sections cash scanné/complété, drawer édition bénéficiaire, QR dans PDF |
| `src/pages/PaymentDetailPage.tsx` | Ajout : capture QR SVG → data URL pour inclusion dans PDF |
| `src/lib/pdf/templates/PaymentReceiptPDF.tsx` | Ajout : champ `cashPaymentQrDataUrl`, page QR code cash dans le PDF |

### Autres

| Fichier | Modification |
|---------|-------------|
| `src/mobile/components/payments/PaymentMethodLogo.tsx` | Cash : `emerald` → `#dc2626` (rouge) |

---

## Système de bénéficiaires

### Table `beneficiaries`

```sql
id              UUID PRIMARY KEY
client_id       UUID REFERENCES auth.users
payment_method  payment_method (enum)
name            TEXT NOT NULL
identifier      TEXT           -- téléphone, email, numéro Alipay/WeChat
qr_code_url     TEXT           -- URL stockage Supabase
bank_name       TEXT
bank_account    TEXT
bank_extra      TEXT
is_active       BOOLEAN DEFAULT TRUE
```

### Logique de création

1. Lors de la soumission du paiement, si un nouveau bénéficiaire est saisi :
   - Création du bénéficiaire via `useCreateBeneficiary()` / `useAdminCreateBeneficiary()`
   - L'ID est passé au RPC `create_payment()` via `p_beneficiary_id`
   - Un snapshot JSONB est stocké dans `beneficiary_details` pour historique

2. Si un bénéficiaire existant est sélectionné :
   - Son ID est directement passé au RPC
   - Le snapshot est également créé

### Formulaires par méthode

| Méthode | Champs |
|---------|--------|
| **Alipay / WeChat** | Type d'identifiant (téléphone, email, ID, QR code) + nom + valeur + upload QR |
| **Virement bancaire** | Nom du titulaire + banque + numéro de compte + commentaire |
| **Cash** | Bénéficiaire = soi-même ou autre personne (nom + téléphone) |

---

## Calcul du taux de change

```
T_final = T_mode × (1 + c) × (1 + tₙ)
```

| Variable | Description |
|----------|-------------|
| `T_mode` | Taux de base pour la méthode (alipay, wechat, virement, cash) |
| `c` | Ajustement pays (0% pour cameroun, variable pour gabon, tchad, etc.) |
| `tₙ` | Ajustement palier : t3 (≥1M, 0%), t2 (400K-999K), t1 (10K-399K) |

### Mapping méthode → clé de taux

```typescript
function toRateKey(method: string): string {
  if (method === 'bank_transfer') return 'virement';
  return method; // alipay, wechat, cash
}
```

### Mapping pays → clé d'ajustement

```typescript
function clientCountryToRateKey(country?: string | null): string {
  const map: Record<string, string> = {
    cameroun: 'cameroun', gabon: 'gabon', tchad: 'tchad',
    rca: 'rca', congo: 'congo', guinee: 'guinee',
    'guinée équatoriale': 'guinee',
  };
  return map[(country || '').toLowerCase().trim()] || 'cameroun';
}
```

---

## QR Code Cash

- Composant : `CashQRCode` (utilise `qrcode.react`)
- Payload minimal pour scan fiable :
  ```json
  { "type": "BONZINI_CASH_PAYMENT", "id": "<payment_id>", "v": 1 }
  ```
- Visible uniquement dans la **fiche de paiement** (pas dans le formulaire)
- Le QR SVG est capturé depuis le DOM et converti en data URL PNG pour inclusion dans le PDF

---

## Couleurs des méthodes de paiement

| Méthode | Couleur | Hex |
|---------|---------|-----|
| Alipay | Bleu | `#1677FF` |
| WeChat | Vert | `#07C160` |
| Virement | Gris | `slate-500` |
| Cash | Rouge | `#dc2626` |

---

## RPC modifiées

### `create_payment()`
Nouveaux paramètres :
- `p_beneficiary_id UUID DEFAULT NULL`
- `p_beneficiary_details JSONB DEFAULT NULL`
- `p_rate_is_custom BOOLEAN DEFAULT FALSE`

Validation ajoutée : `p_amount_xaf < 10000` → erreur

### `create_admin_payment()`
Mêmes 3 nouveaux paramètres. Le statut est déterminé en incluant `p_beneficiary_id IS NOT NULL` dans la logique de détection des infos bénéficiaire.

---

## Commits

| Hash | Message |
|------|---------|
| `78a7438` | `feat: complete payment form redesign with beneficiaries system` (Phases 1-5) |
| `1589320` | `feat: add QR code display, beneficiary editing, and cash QR in PDF to payment detail pages` (Phase 6) |
