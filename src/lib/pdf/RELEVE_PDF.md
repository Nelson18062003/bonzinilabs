# Relevé de compte PDF — Documentation technique

## Vue d'ensemble

Le relevé de compte est un PDF A4 paysage généré côté client via **`@react-pdf/renderer`** — exactement la même technologie que les reçus de dépôts et paiements.

```
Bouton "Relevé"
    ↓
handleDownloadStatement() — HistoryPage.tsx ou MobileClientDetail.tsx
    ↓
generateClientStatement(data: StatementInput)  — src/lib/generateClientStatement.ts
    ↓
React.createElement(ClientStatementPDF, { data })
    ↓
downloadPDF(element, filename)  — src/lib/pdf/downloadPDF.ts
    ↓
pdf(element).toBlob() → URL.createObjectURL → <a>.click()
    ↓
releve_JohannSoh_20260308.pdf
```

---

## Fichiers

| Fichier | Rôle |
|---------|------|
| `src/lib/pdf/templates/ClientStatementPDF.tsx` | Composant React PDF — layout complet |
| `src/lib/generateClientStatement.ts` | Types, helpers de mapping, fonction `generateClientStatement()` |
| `src/lib/pdf/downloadPDF.ts` | Utilitaire commun de téléchargement (partagé avec les reçus) |
| `src/lib/pdf/fonts.ts` | Enregistrement DM Sans (WOFF locaux depuis `/public/fonts/`) |
| `src/pages/HistoryPage.tsx` | Déclencheur côté client mobile (page Historique) |
| `src/mobile/screens/clients/MobileClientDetail.tsx` | Déclencheur côté admin (détail client) |

---

## Structure du PDF

```
┌──────────────────────────────────────────────────── A4 Paysage ──┐
│  [Logo SVG]  Bonzini                    Document / Relevé de compte│
│              Paiements CEMAC > Chine                               │
│  ─────────────────────────────── [or][violet][orange] ────────────│
│  CLIENT                                          PÉRIODE           │
│  Johann Soh                               Du 1 janvier 2026        │
│  +237 699 000 000                         Au 8 mars 2026           │
│  Cameroun                                 Émis le 8 mars 2026      │
├───────────────────┬───────────────────┬───────────────────────────┤
│  Total dépôts     │  Total paiements  │  Solde final              │
│  +12 200 000 XAF  │  -9 300 000 XAF   │  2 900 000 XAF            │
├───────────────────┴───────────────────┴───────────────────────────┤
│  DÉTAIL DES MOUVEMENTS (15)                                        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Date    │ Réf.    │ Type      │ Motif       │ Débit │ Crédit │ Solde │
│  ├─────────┼─────────┼───────────┼─────────────┼───────┼────────┼───────┤
│  │ ...     │ ...     │ [Dépôt]   │ ...         │       │ +500k  │ 500k  │
│  │ ...     │ ...     │ [Paiement]│ Alipay...   │ -500k │        │ 0     │
│  └─────────────────────────────────────────── Totaux ───────────┘ │
│  Page 1 / 1 · bonzinilabs.com                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Éléments fixes (se répètent sur chaque page)
- **Header sombre** : logo + marque + infos client + période
- **Footer** : texte + numéro de page dynamique (`render={({ pageNumber, totalPages }) => ...}`)

### Éléments page 1 uniquement
- **3 blocs résumé** : Total dépôts (vert), Total paiements (orange), Solde final (violet)
- **Label de section** : "DÉTAIL DES MOUVEMENTS (n)"
- **En-tête du tableau** (colonnes)

---

## Types exportés

```typescript
// src/lib/generateClientStatement.ts (re-exporte depuis ClientStatementPDF.tsx)

interface StatementMovement {
  date: string;       // ISO string
  reference: string;  // ex: "DEP-ABC123"
  type: 'Dépôt' | 'Paiement' | 'Remboursement' | 'Ajustement';
  motif: string;
  debit: number;      // 0 si crédit
  credit: number;     // 0 si débit
  solde: number;      // balance_after de la ligne
}

interface StatementInput {
  clientName: string;
  clientPhone?: string;
  clientCountry?: string;
  clientRef?: string;
  movements: StatementMovement[];
  periodFrom: string;   // texte affiché — ex: "1 janvier 2026"
  periodTo: string;
  generatedAt: string;  // texte affiché — ex: "8 mars 2026 à 14:32"
}
```

---

## API publique

```typescript
// Génère et télécharge le PDF (async)
generateClientStatement(data: StatementInput): Promise<void>

// Convertit une opération wallet (snake_case, côté client)
buildMovementFromWalletOp(op: RawWalletOp): StatementMovement

// Convertit une entrée ledger (camelCase, côté admin)
buildMovementFromLedgerEntry(entry: RawLedgerEntry): StatementMovement

// Filtres (retournent false = exclure de la liste)
shouldIncludeWalletOp(op: RawWalletOp): boolean
shouldIncludeLedgerEntry(entry: RawLedgerEntry): boolean

// Formatte une date ISO en "d MMMM yyyy" en français
fmtDateLong(iso: string): string
```

---

## Règles de filtrage

Les opérations suivantes sont **exclues** du relevé officiel :

| Condition | Raison |
|-----------|--------|
| `operation_type === 'DEPOSIT_REFUSED'` | Dépôt refusé : n'affecte pas le solde réel |
| `is_test === true` | Opération de test interne |
| `isTest === true` (LedgerEntry) | Idem côté admin |

---

## Formatage des nombres

```typescript
// Espaces normaux U+0020 — jamais \u00A0 (cause "1 /732 /800" dans certains PDF engines)
function fmtNum(n: number): string {
  const str = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return n < 0 ? `-${str}` : str;
}
```

## Sanitisation du texte

```typescript
// Remplace les caractères Unicode incompatibles avec les polices PDF
function san(text: string): string {
  return text
    .replace(/\u2192/g, '>')   // → flèche droite
    .replace(/\u2014/g, '-')   // — tiret long
    .replace(/\u2013/g, '-')   // – tiret court
    .replace(/\u00B7/g, '-')   // · point médian
    .replace(/\u00A0/g, ' ')   // espace insécable
    .replace(/\u202F/g, ' ');  // espace fine insécable
}
```

---

## Police

**DM Sans** — enregistrée dans `src/lib/pdf/fonts.ts` via des fichiers WOFF locaux servis depuis `/public/fonts/`.

> **Pourquoi WOFF et pas WOFF2 ?**
> WOFF2 utilise la compression Brotli. `@react-pdf/fontkit` ne peut pas décompresser Brotli en environnement navigateur → erreur silencieuse + PDF vide. Les fichiers WOFF (zlib) fonctionnent.

Weights disponibles : 400, 500, 600, 700, 800, 900.

---

## Logo SVG

Le logo est rendu via `<Svg>` + `<Path>` de `@react-pdf/renderer` (pas une image). Les 4 paths du fichier `bonzini_logo.svg` sont copiés en dur dans `ClientStatementPDF.tsx` et `PDFHeader.tsx`.

**Ne pas modifier les paths SVG** — ils sont les tracés vectoriels exacts du logo officiel.

---

## Palette couleurs

| Clé | Hex | Usage |
|-----|-----|-------|
| `dark` | `#1a1028` | Fond header, fond ligne totaux |
| `violet` | `#a64af7` | Solde final, barre tricolore (centre) |
| `gold` | `#f3a745` | Labels "CLIENT"/"PÉRIODE", barre tricolore (gauche) |
| `orange` | `#fe560d` | Débits, barre tricolore (droite) |
| `green` | `#10b981` | Crédits, badge Dépôt |
| `text` | `#2d2040` | Texte principal |
| `muted` | `#7a7290` | Texte secondaire, dates, références |
| `light` | `#f8f6fa` | Fond lignes alternées |

---

## Types de mouvements

| Type | Badge couleur | Fond badge |
|------|--------------|------------|
| Dépôt | `#10b981` vert | `#ecfdf5` |
| Paiement | `#fe560d` orange | `#fdeee8` |
| Rembours. | `#3b82f6` bleu | `#eff6ff` |
| Ajust. | `#7a7290` gris | `#f3f4f6` |

> `"Remboursement"` est affiché `"Rembours."` pour éviter la troncature dans la colonne (72pt).

---

## Ajout d'un nouveau point d'entrée

Pour déclencher la génération depuis un nouvel écran :

```typescript
import {
  generateClientStatement,
  buildMovementFromWalletOp,  // ou buildMovementFromLedgerEntry
  shouldIncludeWalletOp,      // ou shouldIncludeLedgerEntry
  fmtDateLong,
} from '@/lib/generateClientStatement';

const handleDownload = async () => {
  setLoading(true);
  try {
    const filtered = operations.filter(op => shouldIncludeWalletOp(op));
    const sorted   = filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const movements = sorted.map(buildMovementFromWalletOp);

    await generateClientStatement({
      clientName: 'Jean Dupont',
      clientPhone: '+237 699 000 000',
      movements,
      periodFrom: movements.length ? fmtDateLong(movements[0].date) : '—',
      periodTo:   fmtDateLong(new Date().toISOString()),
      generatedAt: new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }),
    });
  } catch {
    toast.error('Erreur lors de la génération du relevé');
  } finally {
    setLoading(false);
  }
};
```
