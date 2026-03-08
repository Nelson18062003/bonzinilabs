# PROMPT CLAUDE CODE — Refonte complète du système de reçus de transactions

## Contexte

Tu travailles sur la plateforme Bonzini (React + TypeScript + Tailwind + shadcn/ui + Supabase + Vite). Il y a deux applications mobiles :
- **App Admin** (`/a/`) — gestion des dépôts, paiements, clients
- **App Client** (`/m/`) — consultation des transactions par le client

L'objectif est de **supprimer entièrement l'ancien système de génération de reçus PDF** et de le remplacer par un nouveau système uniforme, professionnel et complet.

**Avant de coder, tu DOIS :**
1. Explorer la codebase entière pour comprendre la structure
2. Identifier le code actuel de génération des reçus (chercher "PDF", "receipt", "reçu", "fiche", "export", "download", "jsPDF", "pdfmake", "html2canvas", "html2pdf")
3. Identifier les tables Supabase impliquées (deposits, payments, clients, beneficiaries, payment_proofs, signatures)
4. Comprendre les relations entre les tables
5. Identifier tous les endroits où les reçus sont déclenchés (boutons de téléchargement dans admin ET client)

---

## 1. ANALYSE DE L'EXISTANT — À FAIRE EN PREMIER

### 1.1 Trouver l'ancien système de reçus

```bash
# Chercher tous les fichiers liés aux reçus
grep -rn "PDF\|pdf\|receipt\|reçu\|fiche\|generatePDF\|downloadPDF\|exportPDF" src/ a/ m/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Chercher les imports de librairies PDF
grep -rn "jsPDF\|pdfmake\|html2canvas\|html2pdf\|@react-pdf\|pdf-lib" src/ a/ m/

# Chercher les boutons de téléchargement
grep -rn "download\|télécharger\|exporter\|Download\|Export" src/ a/ m/ --include="*.tsx" --include="*.jsx"
```

**Note tous les fichiers trouvés.** Ce sont les fichiers à remplacer.

### 1.2 Comprendre le schéma de données

```bash
# Lister les migrations Supabase
ls -la supabase/migrations/

# Chercher les tables liées
grep -rn "deposits\|payments\|clients\|beneficiaries\|payment_proofs\|signatures" supabase/ --include="*.sql"

# Chercher les types TypeScript
grep -rn "type.*Deposit\|type.*Payment\|interface.*Deposit\|interface.*Payment" src/ a/ m/ --include="*.ts" --include="*.tsx"
```

### 1.3 Identifier les requêtes existantes

```bash
# Chercher les requêtes Supabase pour les dépôts et paiements
grep -rn "from.*deposits\|from.*payments\|\.select.*deposit\|\.select.*payment" src/ a/ m/ --include="*.ts" --include="*.tsx"
```

---

## 2. SCHÉMA DE DONNÉES — Ce que le reçu doit afficher

### 2.1 Reçu de dépôt

Les données viennent de la table `deposits` (ou équivalent). Le reçu doit afficher :

| Champ | Source | Exemple |
|-------|--------|---------|
| Référence | `deposits.reference` ou `deposits.id` formaté | BZ-DP-2026-0017 |
| Statut | `deposits.status` | Validé |
| Montant | `deposits.amount` | 1 029 000 XAF |
| Mode de dépôt | `deposits.method` ou `deposits.deposit_type` | Cash agence Bonzini |
| Agence | `deposits.agency` ou champ lié | Douala — Bonamoussadi |
| Banque | `deposits.bank` (si virement) | ECOBANK |
| Date de création | `deposits.created_at` | 07 mars 2026 à 08:55 |
| Date de validation | `deposits.validated_at` ou `deposits.updated_at` | 07 mars 2026 à 08:56 |
| Nom client | `clients.name` (via `deposits.client_id`) | Liliane Kenfack |
| Téléphone client | `clients.phone` | +237 676 337 404 |
| Email client | `clients.email` (si disponible) | — |
| Pays client | `clients.country` (si disponible) | Cameroun |

**Adapte les noms de colonnes** au schéma réel que tu trouves en base.

### 2.2 Reçu de paiement

Les données viennent de la table `payments` (ou équivalent). Le reçu doit afficher :

**Informations communes à tous les modes :**

| Champ | Source | Exemple |
|-------|--------|---------|
| Référence | `payments.reference` ou formaté | BZ-PY-2026-0020 |
| Statut | `payments.status` | Effectué |
| Montant XAF | `payments.amount_xaf` | 700 000 XAF |
| Montant CNY | `payments.amount_cny` | ¥8 071 |
| Taux appliqué | `payments.rate_applied` | 11 530 XAF/M |
| Mode de paiement | `payments.payment_method` | Alipay / WeChat / Cash / Virement |
| Date de création | `payments.created_at` | 07 mars 2026 à 09:43 |
| Date de traitement | `payments.processed_at` ou `payments.updated_at` | 07 mars 2026 à 15:12 |
| Nom client | `clients.name` | Stephan Tchamdjou |
| Téléphone client | `clients.phone` | +237 678 148 981 |

**Informations bénéficiaire (selon le mode) :**

| Mode | Champs bénéficiaire |
|------|---------------------|
| **Alipay** | Nom, Identifiant Alipay, Email, Téléphone, QR code (image URL) |
| **WeChat** | Nom, Identifiant WeChat, Email, Téléphone, QR code (image URL) |
| **Virement** | Nom titulaire, Banque, N° de compte, Agence |
| **Cash** | Nom, Téléphone |

Sources : table `beneficiaries` (via `payments.beneficiary_id`) ou champs JSON dans `payments.beneficiary_details`.

**Preuves de paiement :**

| Champ | Source |
|-------|--------|
| Image(s) de preuve | Table `payment_proofs` ou champ `payments.proof_url` ou Supabase Storage |
| Date de la preuve | `payment_proofs.created_at` |

**Signature (Cash uniquement) :**

| Champ | Source |
|-------|--------|
| Image signature | `payments.signature_url` ou `signatures.image_url` ou Supabase Storage |
| Signé par | Nom du bénéficiaire |
| Date de signature | `payments.signed_at` ou `signatures.created_at` |

---

## 3. COMPOSANT REACT — Nouveau système de reçus

### 3.1 Architecture des fichiers à créer

```
src/
├── components/
│   └── receipts/
│       ├── ReceiptLayout.tsx          ← Layout commun (header Bonzini, footer, structure)
│       ├── ReceiptStatusBadge.tsx     ← Badge de statut (Validé, Effectué, En attente...)
│       ├── ReceiptInfoRow.tsx         ← Ligne label/value
│       ├── ReceiptSectionTitle.tsx    ← Titre de section doré
│       ├── ReceiptAmountBlock.tsx     ← Bloc montant centré
│       ├── ReceiptBonziniLogo.tsx     ← Logo SVG Bonzini (ne pas modifier les paths)
│       ├── DepositReceipt.tsx         ← Reçu de dépôt complet
│       ├── PaymentReceipt.tsx         ← Reçu de paiement (gère les 4 modes)
│       └── ReceiptDownloadButton.tsx  ← Bouton de téléchargement PDF
├── hooks/
│   ├── useDepositReceipt.ts          ← Hook pour charger les données d'un dépôt
│   └── usePaymentReceipt.ts          ← Hook pour charger les données d'un paiement
└── lib/
    └── generateReceiptPDF.ts          ← Fonction de génération du PDF
```

### 3.2 Logo SVG Bonzini

Le fichier `ReceiptBonziniLogo.tsx` doit contenir le SVG exact du logo. **NE PAS recréer le logo.** Utiliser les paths SVG fournis dans le fichier `bonzini_logo.svg` du repo.

Les 4 paths du logo avec leurs couleurs exactes :
- Path 1 (éventail haut) : `fill="#F3A745"` (or)
- Path 2 (arc supérieur) : `fill="#A947FE"` (violet)
- Path 3 (arc inférieur) : `fill="#A947FE"` (violet)
- Path 4 (forme basse) : `fill="#FE560D"` (orange)

### 3.3 Couleurs de la charte

```typescript
export const RECEIPT_COLORS = {
  // Marque
  violet: "#a64af7",
  violetDark: "#1a1028",
  violetLight: "#f3ecf8",
  gold: "#f3a745",
  goldLight: "#fdf4e3",
  orange: "#fe560d",
  orangeLight: "#fdeee8",
  
  // Statuts
  green: "#10b981",
  greenLight: "#ecfdf5",
  
  // Modes de paiement
  alipay: "#1677ff",
  wechat: "#07c160",
  
  // Texte
  text: "#2d2040",
  muted: "#7a7290",
  light: "#f8f6fa",
  border: "#ebe6f0",
} as const;
```

### 3.4 Typographie

**Police principale : DM Sans** — utilisée dans TOUTES les maquettes. Cette police doit être intégrée dans l'application et dans les PDFs.

**Installation :**
```typescript
// Dans le HTML principal (index.html) — ajouter si pas déjà présent
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

**Configuration Tailwind (tailwind.config.ts) :**
```typescript
theme: {
  extend: {
    fontFamily: {
      sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
    },
  },
}
```

**Hiérarchie typographique des reçus :**

| Élément | Police | Taille | Poids | Couleur |
|---------|--------|--------|-------|---------|
| Nom "Bonzini" dans le header | DM Sans | 16px | 900 (Black) | #ffffff |
| Référence (BZ-XX-XXXX) | Monospace (système) | 10px | 700 | rgba(255,255,255,0.5) |
| Type de document (REÇU DE...) | DM Sans | 13px | 800 | #ffffff, uppercase, letterSpacing: 1.5px |
| Titre de section (TRANSACTION, CLIENT...) | DM Sans | 10px | 800 | #f3a745 (or), uppercase, letterSpacing: 2px |
| Label de ligne (Mode de paiement, Nom...) | DM Sans | 11px | 500 | #7a7290 (muted) |
| Valeur de ligne (Alipay, Kamga Paul...) | DM Sans | 12px | 600 | #2d2040 (text) |
| Valeur importante (nom client, mode...) | DM Sans | 12px | 700 (Bold) | #2d2040 |
| Montant principal | DM Sans | 32px | 900 (Black) | #2d2040, letterSpacing: -1px |
| Suffixe "XAF" après le montant | DM Sans | 14px | 600 | #7a7290 |
| Sous-label (Montant envoyé, Taux...) | DM Sans | 9px | 600 | #7a7290, uppercase, letterSpacing: 0.5px |
| Sous-valeur (¥8 071, 11 530 XAF/M) | DM Sans | 14px | 800 | #a64af7 (violet) |
| Texte du badge statut | DM Sans | 11px | 800 | couleur du statut |
| Date à côté du statut | DM Sans | 11px | 400 | #7a7290 |
| Footer | DM Sans | 8px | 400/700 | #7a7290 |

**Règles typographiques :**
- Tous les titres de section sont en **UPPERCASE** avec un `letter-spacing` de 2px
- Le montant principal utilise le poids **900 (Black)** — c'est le chiffre le plus important du document
- Les labels sont toujours en **muted (#7a7290)**, les valeurs en **text (#2d2040)**
- Les valeurs qui portent une couleur de mode (Alipay bleu, Cash orange) utilisent la couleur du mode
- Le format des nombres est **français avec espaces** : `1 029 000` (jamais de virgules)
- La police **monospace** du système est utilisée uniquement pour les références (BZ-XX-XXXX)

### 3.5 Palette complète détaillée

```typescript
export const RECEIPT_THEME = {
  // ──── COULEURS DE MARQUE ────
  brand: {
    violet:      "#a64af7",   // Couleur principale Bonzini
    violetDark:  "#1a1028",   // Fond du header des reçus
    violetLight: "#f3ecf8",   // Fond badge statut paiement
    gold:        "#f3a745",   // Titres de section, accents dorés
    goldLight:   "#fdf4e3",   // Fond léger pour highlights dorés
    orange:      "#fe560d",   // Logo bas, mode Cash
    orangeLight: "#fdeee8",   // Fond badge paiement, fond débits
  },

  // ──── COULEURS DE STATUT ────
  status: {
    validated:   "#10b981",   // Vert — dépôt validé
    validatedBg: "#ecfdf5",   // Fond badge validé
    completed:   "#a64af7",   // Violet — paiement effectué
    completedBg: "#f3ecf8",   // Fond badge effectué
    pending:     "#f3a745",   // Or — en attente
    pendingBg:   "#fdf4e3",   // Fond badge en attente
    failed:      "#ef4444",   // Rouge — échoué
    failedBg:    "#fef2f2",   // Fond badge échoué
  },

  // ──── COULEURS DES MODES DE PAIEMENT ────
  methods: {
    alipay:    "#1677ff",     // Bleu Alipay
    wechat:    "#07c160",     // Vert WeChat
    virement:  "#8b5cf6",     // Violet clair
    cash:      "#fe560d",     // Orange (même que brand.orange)
  },

  // ──── COULEURS DE TEXTE ────
  text: {
    primary:   "#2d2040",     // Texte principal (titres, valeurs)
    secondary: "#7a7290",     // Texte secondaire (labels, dates, footer)
    white:     "#ffffff",     // Texte sur fond sombre
    whiteAlt:  "rgba(255,255,255,0.5)",  // Texte discret sur fond sombre
  },

  // ──── COULEURS DE FOND ────
  background: {
    header:    "#1a1028",     // En-tête des reçus (dégradé vers #2a1845)
    page:      "#ffffff",     // Fond du document
    section:   "#f8f6fa",     // Fond des blocs (montant, QR, signature)
    border:    "#ebe6f0",     // Bordures et séparateurs
  },

  // ──── BARRE TRICOLORE ────
  // Toujours dans cet ordre : or → violet → orange
  // Proportions : flex 2 / flex 3 / flex 2
  stripe: {
    gold:   "#f3a745",
    violet: "#a64af7",
    orange: "#fe560d",
  },

  // ──── COULEURS COMPTABLES ────
  accounting: {
    credit:    "#10b981",     // Vert — montants positifs, dépôts
    debit:     "#fe560d",     // Orange — montants négatifs, paiements
  },
} as const;
```

### 3.6 Structure visuelle du reçu (identique pour tous)

```
┌─────────────────────────────────────────┐
│ [Logo SVG] Bonzini          BZ-XX-XXXX  │  ← Header sombre (#1a1028)
│ ═══ or ═══ violet ═══ orange ═══        │  ← Barre tricolore
│ REÇU DE DÉPÔT / REÇU DE PAIEMENT       │
├─────────────────────────────────────────┤
│ ● Validé/Effectué     07 mars à 15:12  │  ← Statut + date
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │         1 029 000 XAF               │ │  ← Montant (gros, centré)
│ │    Montant envoyé    Taux appliqué  │ │  ← Sous-infos (paiement only)
│ │       ¥8 071        11 530 XAF/M    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ TRANSACTION                             │  ← Titre doré
│ Mode de paiement ............ Alipay    │
│ Date de création .... 07 mars à 09:43  │
│ Date de traitement .. 07 mars à 15:12  │
│                                         │
│ CLIENT                                  │
│ Nom .................. Stephan Tchamdjou│
│ Téléphone ........... +237 678 148 981 │
│                                         │
│ BÉNÉFICIAIRE                            │  ← (paiement only)
│ Nom ...................... Bomarkaise   │
│ Identifiant Alipay .. bomarkaise(...)  │
│                                         │
│ ┌─── QR CODE BÉNÉFICIAIRE ───────────┐ │  ← (Alipay/WeChat only)
│ │         [ image QR ]                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─── PREUVE DE PAIEMENT ─────────────┐ │  ← (si disponible)
│ │     [ capture / justificatif ]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─── SIGNATURE DU BÉNÉFICIAIRE ──────┐ │  ← (Cash only)
│ │     [ image signature ]             │ │
│ │  Signé par: Billy T.  06 mars 15:46 │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ Document généré par Bonzini  [Logo] .com│  ← Footer
└─────────────────────────────────────────┘
```

---

## 4. HOOKS — Chargement des données

### 4.1 useDepositReceipt

```typescript
// src/hooks/useDepositReceipt.ts

interface DepositReceiptData {
  reference: string;
  status: string;
  amount: number;
  depositMethod: string;     // "Cash agence Bonzini" | "Virement bancaire" | "Mobile Money"
  agency?: string;            // "Douala — Bonamoussadi"
  bank?: string;              // "ECOBANK" (si virement)
  createdAt: string;
  validatedAt: string;
  client: {
    name: string;
    phone: string;
    email?: string;
    country?: string;
  };
}

function useDepositReceipt(depositId: string): {
  data: DepositReceiptData | null;
  loading: boolean;
  error: string | null;
}
```

**Requête Supabase :**
```typescript
const { data, error } = await supabase
  .from("deposits")
  .select(`
    *,
    client:clients(name, phone, email, country)
  `)
  .eq("id", depositId)
  .single();
```

**ADAPTE** les noms de tables et colonnes au schéma réel.

### 4.2 usePaymentReceipt

```typescript
// src/hooks/usePaymentReceipt.ts

interface PaymentReceiptData {
  reference: string;
  status: string;
  amountXaf: number;
  amountCny: number;
  rateApplied: number;
  paymentMethod: "alipay" | "wechat" | "virement" | "cash";
  createdAt: string;
  processedAt: string;
  client: {
    name: string;
    phone: string;
    email?: string;
    country?: string;
  };
  beneficiary?: {
    name: string;
    phone?: string;
    email?: string;
    alipayId?: string;
    wechatId?: string;
    bankName?: string;
    bankAccount?: string;
    bankBranch?: string;
    qrCodeUrl?: string;
  };
  proofs: Array<{
    imageUrl: string;
    createdAt: string;
  }>;
  signature?: {
    imageUrl: string;
    signedBy: string;
    signedAt: string;
  };
}
```

**Requête Supabase :**
```typescript
const { data, error } = await supabase
  .from("payments")
  .select(`
    *,
    client:clients(name, phone, email, country),
    beneficiary:beneficiaries(*),
    proofs:payment_proofs(image_url, created_at)
  `)
  .eq("id", paymentId)
  .single();
```

**Pour les images (QR code, preuves, signatures) :**
```typescript
// Si les images sont dans Supabase Storage
const { data: { publicUrl } } = supabase
  .storage
  .from("receipts")  // ou le bucket utilisé
  .getPublicUrl(imagePath);
```

**ADAPTE** tout au schéma réel. Les noms de tables, colonnes, et buckets Storage peuvent être différents.

---

## 5. GÉNÉRATION PDF

### 5.1 Approche recommandée

Utiliser **html-to-image** + **jsPDF** ou **@react-pdf/renderer** pour générer le PDF depuis le composant React.

**Option A — html-to-image + jsPDF (plus simple) :**
```typescript
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

async function generateReceiptPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  pdf.save(filename);
}
```

**Option B — @react-pdf/renderer (plus propre) :**
Recréer le layout en composants @react-pdf. Plus de travail mais meilleur contrôle.

**Choisis l'option qui s'intègre le mieux avec l'existant.** Si l'ancien code utilise déjà jsPDF ou html2canvas, reste sur la même librairie pour éviter d'ajouter des dépendances.

### 5.2 Nommage des fichiers PDF

```
Dépôt:    recu_depot_BZ-DP-2026-0017_LilianeKenfack.pdf
Paiement: recu_paiement_BZ-PY-2026-0020_StephanTchamdjou.pdf
```

Format : `recu_[type]_[reference]_[NomClient].pdf`

---

## 6. INTÉGRATION DANS LES APPLICATIONS

### 6.1 App Admin — Module Dépôts

**Où :** Fiche détaillée d'un dépôt (quand l'admin clique sur un dépôt dans la liste).

**Bouton :** Remplacer l'ancien bouton de téléchargement par :
```tsx
<ReceiptDownloadButton
  type="deposit"
  transactionId={deposit.id}
  reference={deposit.reference}
  clientName={deposit.client.name}
/>
```

**Ce bouton doit :**
1. Afficher le reçu dans un modal/preview (composant `DepositReceipt`)
2. Permettre le téléchargement PDF
3. Gérer le loading pendant la génération

### 6.2 App Admin — Module Paiements

**Où :** Fiche détaillée d'un paiement.

**Bouton :**
```tsx
<ReceiptDownloadButton
  type="payment"
  transactionId={payment.id}
  reference={payment.reference}
  clientName={payment.client.name}
/>
```

**Le composant `PaymentReceipt` s'adapte automatiquement au mode :**
- Si `payment_method === "alipay"` → affiche QR code + identifiant Alipay + preuve
- Si `payment_method === "wechat"` → affiche QR code + identifiant WeChat + preuve
- Si `payment_method === "virement"` → affiche coordonnées bancaires + justificatif
- Si `payment_method === "cash"` → affiche signature du bénéficiaire

### 6.3 App Client — Module Dépôts

**Même composant** `DepositReceipt` mais le client ne voit que ses propres dépôts.

### 6.4 App Client — Module Paiements

**Même composant** `PaymentReceipt` — le client peut voir :
- Les détails de la transaction
- Les informations du bénéficiaire
- Les preuves de paiement (captures Alipay/WeChat/banque)
- La signature (pour Cash)

---

## 7. SUPPRESSION DE L'ANCIEN SYSTÈME

### 7.1 Fichiers à supprimer

Après avoir implémenté et testé le nouveau système, **supprimer tous les anciens fichiers** de génération de reçus identifiés à l'étape 1.

```bash
# Avant de supprimer, liste ce que tu vas supprimer
echo "Fichiers à supprimer :"
# ... (les fichiers trouvés dans l'analyse)

# Puis supprime
# rm path/to/old/receipt/file.tsx
```

### 7.2 Ce qu'il faut supprimer

- L'ancien composant/page de génération de reçu de dépôt
- L'ancien composant/page de génération de reçu de paiement
- Les anciennes fonctions utilitaires de génération PDF
- Les anciens styles/CSS dédiés aux reçus
- Les anciennes routes qui pointaient vers les pages de reçu
- Toute référence à "BONZINI TRADING" dans les headers de reçu (le nouveau nom est juste "Bonzini")
- Le header violet dégradé actuel (remplacé par le header sombre #1a1028 avec logo SVG)

### 7.3 Ce qu'il NE FAUT PAS supprimer

- Les tables Supabase (deposits, payments, etc.) — on ne touche pas aux données
- Les routes de navigation vers les fiches de transactions
- Les boutons de téléchargement (on les remplace, on ne les supprime pas)

---

## 8. FORMAT DU TAUX

**IMPORTANT — Correction du format du taux :**

L'ancien format "1 RMB = 87 XAF" est confus et incorrect.

Le nouveau format est : **"11 530 XAF/M"** (XAF pour 1 Million de CNY, ce qui est la convention Bonzini).

Si le taux stocké en base est sous un autre format, convertis-le pour l'affichage :
```typescript
// Si le taux est stocké comme "87" (XAF pour 1 RMB)
const displayRate = ratePerRMB * 1000000 / 1000000; // garder tel quel mais formater
// Afficher : "87 XAF/RMB" 

// Si le taux est stocké comme "11530" (XAF pour 1M CNY)
// Afficher : "11 530 XAF/M"

// Adapter selon ce qui est en base. L'important : pas de "1 RMB = XX XAF"
```

**Pour le montant CNY affiché :** Ne JAMAIS écrire "RMB" après le symbole ¥. Écrire juste ¥8 071.

---

## 9. IMAGES DANS LES REÇUS

### 9.1 QR Code bénéficiaire

```typescript
// Charger l'image du QR code depuis Supabase Storage
const qrCodeUrl = beneficiary?.qr_code_url;

// Si c'est un path relatif
const { data: { publicUrl } } = supabase
  .storage
  .from("qr-codes")  // ou le bucket utilisé
  .getPublicUrl(qrCodeUrl);

// Afficher dans le reçu
<img src={publicUrl} alt="QR Code" style={{ width: 140, height: 140 }} />
```

### 9.2 Preuves de paiement

Les preuves sont des captures d'écran uploadées par l'admin. Elles sont stockées dans Supabase Storage.

```typescript
// Charger toutes les preuves d'un paiement
const { data: proofs } = await supabase
  .from("payment_proofs")
  .select("*")
  .eq("payment_id", paymentId)
  .order("created_at");

// Pour chaque preuve, récupérer l'URL publique
const proofUrls = proofs.map(p => {
  const { data: { publicUrl } } = supabase
    .storage
    .from("proofs")
    .getPublicUrl(p.image_path);
  return { url: publicUrl, date: p.created_at };
});
```

### 9.3 Signature (Cash)

```typescript
// La signature est capturée dans l'app Agent et stockée
const signatureUrl = payment.signature_url || payment.signature_path;

const { data: { publicUrl } } = supabase
  .storage
  .from("signatures")
  .getPublicUrl(signatureUrl);
```

**ADAPTE** les noms de buckets et chemins au système de stockage existant.

---

## 10. MAQUETTES DE RÉFÉRENCE

Les maquettes interactives sont fournies dans les fichiers suivants. Ouvre-les pour voir le rendu visuel exact :

1. **`maquette_recu_depot.jsx`** — Reçu de dépôt
2. **`maquette_recu_paiement_alipay.jsx`** — Paiement Alipay (avec QR + preuve)
3. **`maquette_recu_paiement_cash.jsx`** — Paiement Cash (avec signature)
4. **`maquette_recu_paiement_virement.jsx`** — Paiement Virement (avec justificatif)

Le design de ces maquettes est **la référence absolue**. Le résultat final doit être visuellement identique.

---

## 11. CHECKLIST DE VÉRIFICATION

### Données

- [ ] Le reçu de dépôt affiche toutes les données correctes depuis Supabase
- [ ] Le reçu de paiement affiche toutes les données correctes depuis Supabase
- [ ] Le nom du client correspond au vrai client en base
- [ ] Le montant XAF correspond au vrai montant en base
- [ ] Le montant CNY est correct (calculé ou stocké)
- [ ] Le taux affiché correspond au taux réellement appliqué
- [ ] Les dates sont formatées en français ("07 mars 2026 à 15:12")

### Bénéficiaire (selon le mode)

- [ ] Alipay : nom + identifiant Alipay + QR code affiché
- [ ] WeChat : nom + identifiant WeChat + QR code affiché
- [ ] Virement : titulaire + banque + n° de compte (masqué partiellement) + agence
- [ ] Cash : nom + téléphone + section signature

### Images

- [ ] QR code du bénéficiaire s'affiche correctement (Alipay/WeChat)
- [ ] Preuves de paiement s'affichent (captures, justificatifs)
- [ ] Signature s'affiche (Cash)
- [ ] Les images chargent depuis Supabase Storage sans erreur CORS

### PDF

- [ ] Le PDF se génère sans erreur
- [ ] Le PDF se télécharge automatiquement avec le bon nom de fichier
- [ ] Les images apparaissent dans le PDF (pas juste des cadres vides)
- [ ] Le PDF est lisible et professionnel
- [ ] Le logo SVG Bonzini s'affiche correctement dans le PDF

### Intégration

- [ ] Le bouton de téléchargement fonctionne dans l'app admin — module Dépôts
- [ ] Le bouton de téléchargement fonctionne dans l'app admin — module Paiements
- [ ] Le bouton de téléchargement fonctionne dans l'app client — module Dépôts
- [ ] Le bouton de téléchargement fonctionne dans l'app client — module Paiements
- [ ] Le composant s'adapte au mode de paiement automatiquement

### Nettoyage

- [ ] L'ancien système de reçus est entièrement supprimé
- [ ] Aucune référence à "BONZINI TRADING" dans le code
- [ ] Aucune occurrence de "1 RMB = XX XAF" dans le code
- [ ] Aucune occurrence de "¥...RMB" (le symbole ¥ suffit)
- [ ] Les anciennes dépendances PDF inutilisées sont supprimées du package.json

---

## 12. ORDRE D'EXÉCUTION

1. **Analyse** — Explorer la codebase, identifier l'ancien système, comprendre le schéma
2. **Composants partagés** — Créer ReceiptLayout, ReceiptBonziniLogo, etc.
3. **Hook dépôt** — Créer useDepositReceipt + composant DepositReceipt
4. **Tester dépôt** — Vérifier que le reçu de dépôt s'affiche avec les vraies données
5. **Hook paiement** — Créer usePaymentReceipt + composant PaymentReceipt
6. **Tester paiement** — Vérifier les 4 modes (Alipay, WeChat, Cash, Virement)
7. **Génération PDF** — Implémenter generateReceiptPDF
8. **Bouton téléchargement** — Créer ReceiptDownloadButton
9. **Intégration admin** — Remplacer les anciens boutons dans l'app admin
10. **Intégration client** — Remplacer les anciens boutons dans l'app client
11. **Tests** — Vérifier chaque cas avec des données réelles
12. **Nettoyage** — Supprimer l'ancien code

---

## 13. RÈGLES ABSOLUES

1. **Le logo SVG ne doit JAMAIS être modifié** — utiliser les paths exacts du fichier bonzini_logo.svg
2. **Jamais "BONZINI TRADING"** — le nom est "Bonzini" tout court
3. **Jamais "1 RMB = XX XAF"** — utiliser le format "XX XXX XAF/M" ou "XX XAF/RMB"
4. **Jamais "¥...RMB"** — le symbole ¥ suffit
5. **Un seul composant PaymentReceipt** qui s'adapte au mode (pas 4 composants séparés)
6. **Adapter au schéma existant** — ne PAS créer de nouvelles tables sauf si nécessaire
7. **Ne pas toucher aux données** — on remplace l'affichage, pas les données en base
8. **Tester avec des données réelles** — pas de mock data en production
9. **Les images doivent fonctionner dans le PDF** — attention au CORS avec Supabase Storage
10. **Mobile first** — le reçu doit être lisible sur mobile (preview) ET en PDF (A4)

---

## FICHIERS À FOURNIR AVEC CE PROMPT

1. `PROMPT_REFONTE_RECUS.md` — Ce fichier
2. `maquette_recu_depot.jsx` — Maquette reçu dépôt
3. `maquette_recu_paiement_alipay.jsx` — Maquette paiement Alipay
4. `maquette_recu_paiement_cash.jsx` — Maquette paiement Cash
5. `maquette_recu_paiement_virement.jsx` — Maquette paiement Virement
6. `maquette_releve_pdf_v2.jsx` — Maquette relevé de compte client (A4 paysage)
7. `bonzini_logo.svg` — Logo SVG original (NE PAS MODIFIER)

**NOTE :** Le fichier `maquette_releve_pdf_v2.jsx` est le relevé de compte global d'un client (tous ses mouvements sur une période). C'est un document différent des reçus individuels. Il est déclenché depuis la fiche client (bouton "Exporter le relevé PDF"). Il utilise la même charte graphique, la même police DM Sans, et les mêmes couleurs que les reçus de transaction. Se référer au prompt `PROMPT_CORRECTIONS_ADMIN.md` (Correction 4) pour les spécifications de ce relevé.

