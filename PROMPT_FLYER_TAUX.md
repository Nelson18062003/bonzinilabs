# PROMPT CLAUDE CODE — Intégration du flyer taux du jour dans l'app admin

> **Objectif : Ajouter dans le module des taux de l'app admin mobile une fonctionnalité "Générer le flyer du jour" qui produit automatiquement un flyer avec les taux actuels, téléchargeable en PNG ou PDF.**

> **La maquette du flyer est dans `flyer_taux_du_jour_v4.jsx`. Ouvre-la avant de commencer.**

---

## ÉTAPE 0 — COMPRENDRE LE MODULE DES TAUX EXISTANT

### 0.1 Trouver le module des taux

```bash
# Tous les fichiers liés aux taux
find src/ -type f \( -name "*rate*" -o -name "*Rate*" -o -name "*taux*" -o -name "*Taux*" \) | grep -v node_modules | sort

# L'écran admin des taux
find src/mobile/ -type f \( -name "*rate*" -o -name "*Rate*" -o -name "*taux*" \) | sort

# Les hooks des taux
find src/hooks/ -type f \( -name "*rate*" -o -name "*Rate*" \) | sort
```

### 0.2 Comment les taux sont stockés

```bash
# Table des taux dans les migrations
cat supabase/migrations/*.sql | grep -B 2 -A 30 "CREATE TABLE.*rate\|CREATE TABLE.*exchange"

# Structure de la table
cat supabase/migrations/*.sql | grep -A 20 "exchange_rate\|daily_rate\|rates"

# Les colonnes — quels champs existent
grep -rn "exchange_rate\|rate_alipay\|rate_wechat\|rate_cash\|rate_bank" supabase/migrations/*.sql | head -20

# RPC pour définir/récupérer les taux
cat supabase/migrations/*.sql | grep -B 2 -A 20 "FUNCTION.*rate"
```

### 0.3 Comment les taux sont affichés/définis dans l'UI

```bash
# Le composant admin qui gère les taux
cat src/mobile/screens/rates/ 2>/dev/null || find src/mobile/ -path "*rate*" -name "*.tsx" | xargs cat 2>/dev/null | head -100

# Les hooks utilisés
grep -rn "useRate\|useExchangeRate\|useDailyRate\|useCurrentRate" src/hooks/ --include="*.ts" | head -15

# Comment le taux actuel est récupéré
grep -rn "getCurrentRate\|getLatestRate\|fetchRate\|rate.*current" src/ --include="*.ts" --include="*.tsx" | head -15

# Les types
grep -rn "ExchangeRate\|DailyRate\|RateData" src/types/ --include="*.ts" | head -10
```

### 0.4 La structure exacte des données de taux

```bash
# Quels taux existent — un seul taux global ou par méthode ?
grep -rn "rate.*method\|rate.*alipay\|rate.*wechat\|rate.*cash\|rate.*bank\|rate.*transfer" src/ --include="*.ts" --include="*.tsx" | head -20

# Le formulaire de définition du taux
grep -rn "setRate\|updateRate\|createRate\|saveRate" src/ --include="*.ts" --include="*.tsx" | head -15
```

**Questions à répondre avant de coder :**
1. Y a-t-il un seul taux (ex: 11500) ou un taux par méthode (Alipay: 11500, Cash: 11450) ?
2. Le taux est-il stocké en décimal (0.01150) ou en entier (11500) ?
3. Le format est-il "1M XAF = ¥X" ou autre chose ?
4. Y a-t-il un historique des taux ou seulement le taux courant ?

---

## ÉTAPE 1 — AJOUTER LE BOUTON "GÉNÉRER LE FLYER"

### 1.1 Où l'ajouter

Dans l'écran du module des taux, après la section où l'admin définit/visualise le taux du jour, ajouter une section :

```
┌──────────────────────────────────────┐
│  Flyer du jour                       │
│                                      │
│  Preview miniature du flyer          │
│                                      │
│  [Télécharger PNG]  [Télécharger PDF]│
└──────────────────────────────────────┘
```

### 1.2 Le composant à créer

Créer un nouveau composant : `src/mobile/components/rates/RateFlyer.tsx`

Ce composant :
- Reçoit les taux actuels en props
- Rend le flyer (dark version par défaut)
- Fournit les boutons de téléchargement

---

## ÉTAPE 2 — LE COMPOSANT FLYER

### 2.1 Structure

Le flyer est un composant React pur qui rend le design de la maquette `flyer_taux_du_jour_v4.jsx`.

```typescript
interface RateFlyerProps {
  rates: {
    alipay: number;    // ex: 11500
    wechat: number;    // ex: 11500
    bank: number;      // ex: 11500
    cash: number;      // ex: 11450
  };
  dark?: boolean;      // dark ou light theme
}
```

### 2.2 Données dynamiques dans le flyer

Le flyer utilise ces données DYNAMIQUES (pas hardcodées) :

| Donnée | Source |
|---|---|
| Taux Alipay | `rates.alipay` depuis le hook |
| Taux WeChat | `rates.wechat` depuis le hook |
| Taux Virement | `rates.bank` depuis le hook |
| Taux Cash | `rates.cash` depuis le hook |
| Date | `new Date()` formatée en anglais + chinois |
| Heure Guangzhou | `toLocaleString("en-US", { timeZone: "Asia/Shanghai" })` |

Les données STATIQUES (hardcodées) :
- Logo Bonzini SVG (4 paths — NE PAS MODIFIER)
- Numéros WhatsApp et Chine
- URL bonzinilabs.com
- Disclaimer bilingue

### 2.3 Le logo Bonzini

Le logo SVG original est dans la maquette. Il contient 4 paths exacts. **NE PAS LE MODIFIER.** Copie-le tel quel.

### 2.4 Design

Reprendre EXACTEMENT le design de `flyer_taux_du_jour_v4.jsx` :

**Polices :** Syne (display/logo), DM Sans (body/taux), Noto Sans SC (chinois)

**Couleurs :**
```
Violet    #A947FE
Or        #F3A745
Orange    #FE560D
Alipay    #1677ff
WeChat    #07c160
Cash      #dc2626
Bank      #A947FE
```

**Taux en DM Sans 50px weight 900** — c'est le plus important, les chiffres doivent être ÉNORMES

**Heure compacte** — une seule ligne, 22px, juste indicatif

**bonzinilabs.com** en Syne 22px, bien visible dans son bloc dédié

---

## ÉTAPE 3 — EXPORT PNG

### 3.1 Librairie à utiliser

Utilise `html-to-image` (ou `html2canvas` si déjà installé) pour capturer le composant en PNG.

```bash
# Vérifier si une lib d'export est déjà installée
grep -r "html-to-image\|html2canvas\|dom-to-image" package.json

# Si pas installée :
bun add html-to-image
# OU
bun add html2canvas
```

### 3.2 Implémentation

```typescript
import { toPng } from 'html-to-image';
// OU
import html2canvas from 'html2canvas';

const flyerRef = useRef<HTMLDivElement>(null);

async function downloadPNG() {
  if (!flyerRef.current) return;
  
  // Option A — html-to-image
  const dataUrl = await toPng(flyerRef.current, {
    width: 1080,        // résolution haute pour partage
    height: 1920,       // ratio 9:16 (stories/WhatsApp)
    pixelRatio: 2,      // retina
    backgroundColor: '#050208', // fond dark
  });
  
  // Option B — html2canvas
  const canvas = await html2canvas(flyerRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#050208',
  });
  const dataUrl = canvas.toDataURL('image/png');
  
  // Télécharger
  const link = document.createElement('a');
  link.download = `bonzini-rate-${new Date().toISOString().slice(0,10)}.png`;
  link.href = dataUrl;
  link.click();
}
```

### 3.3 Résolution

Le PNG doit être en haute résolution pour le partage WhatsApp/réseaux sociaux :
- Largeur : 1080px minimum
- Ratio : environ 9:16 (format stories/mobile)
- pixelRatio : 2 (retina)

---

## ÉTAPE 4 — EXPORT PDF

### 4.1 Librairie

Utilise `@react-pdf/renderer` qui est déjà dans le projet (utilisé pour les reçus).

```bash
# Vérifier
grep -r "react-pdf" package.json
```

### 4.2 Implémentation

**Option A — react-pdf (si déjà installé) :**

Créer un template PDF `src/lib/pdf/templates/RateFlyerPDF.tsx` :

```typescript
import { Document, Page, View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer';

const RateFlyerPDF = ({ rates, date }) => (
  <Document>
    <Page size={[1080, 1920]} style={styles.page}>
      {/* Reproduire le layout du flyer en composants react-pdf */}
      {/* Logo SVG Bonzini */}
      {/* Date + Heure */}
      {/* Taux */}
      {/* Disclaimer */}
      {/* Contacts */}
    </Page>
  </Document>
);
```

**Option B — Convertir le PNG en PDF :**

Plus simple : générer le PNG d'abord, puis le placer dans un PDF avec `jspdf` :

```bash
# Si pas installé :
bun add jspdf
```

```typescript
import jsPDF from 'jspdf';

async function downloadPDF() {
  // Générer le PNG d'abord
  const dataUrl = await toPng(flyerRef.current, { width: 1080, height: 1920, pixelRatio: 2 });
  
  // Créer le PDF
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1080, 1920] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, 1080, 1920);
  pdf.save(`bonzini-rate-${new Date().toISOString().slice(0,10)}.pdf`);
}
```

**L'option B (PNG → PDF) est recommandée** car plus simple et le résultat est identique visuellement.

---

## ÉTAPE 5 — CONNEXION AVEC LE MODULE DES TAUX

### 5.1 Le hook des taux

```bash
# Trouver le hook qui fournit les taux actuels
grep -rn "export.*useRate\|export.*useExchangeRate\|export.*useCurrentRate\|export.*useDailyRate" src/hooks/ --include="*.ts"
```

Réutiliser ce hook dans le composant flyer :

```typescript
// Exemple (adapter selon le hook réel)
const { data: currentRate } = useCurrentRate();

// Mapper vers le format attendu par le flyer
const flyerRates = {
  alipay: currentRate?.rate_alipay || currentRate?.rate || 0,
  wechat: currentRate?.rate_wechat || currentRate?.rate || 0,
  bank: currentRate?.rate_bank || currentRate?.rate || 0,
  cash: currentRate?.rate_cash || currentRate?.rate || 0,
};
```

### 5.2 Si un seul taux global existe

Si la base a un seul taux (ex: `exchange_rate = 11500`), et que le taux cash est différent (ex: -50), adapter :

```typescript
const baseRate = currentRate?.rate || 0;
const cashDiscount = 50; // ou configurable

const flyerRates = {
  alipay: baseRate,
  wechat: baseRate,
  bank: baseRate,
  cash: baseRate - cashDiscount,
};
```

### 5.3 Normalisation du taux

Le taux peut être stocké en décimal ou en entier :

```typescript
// Si décimal (0.01150) → convertir en entier pour l'affichage
const rateInt = currentRate < 1
  ? Math.round(currentRate * 1_000_000)
  : Math.round(currentRate);
```

### 5.4 Actualisation automatique

Le flyer se met à jour automatiquement quand le taux change car il utilise le même hook reactif (TanStack Query). Quand l'admin sauvegarde un nouveau taux, le cache est invalidé, le hook refetch, et le flyer se re-rend avec les nouvelles valeurs.

**Pas besoin de logique supplémentaire pour ça.**

---

## ÉTAPE 6 — L'UI DANS L'ÉCRAN DES TAUX

### 6.1 Section à ajouter

Ajouter dans l'écran du module des taux, APRÈS la section de définition du taux :

```typescript
{/* Section Flyer */}
<div style={{ padding: "16px", marginTop: 12 }}>
  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
    Flyer du jour
  </div>
  
  {/* Preview miniature */}
  <div ref={flyerRef} style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
    <RateFlyer rates={flyerRates} dark={true} />
  </div>
  
  {/* Boutons */}
  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
    <button onClick={downloadPNG}>
      Télécharger PNG
    </button>
    <button onClick={downloadPDF}>
      Télécharger PDF
    </button>
  </div>
</div>
```

### 6.2 Le preview

Le flyer complet est rendu en miniature (scale 0.5) dans l'écran des taux pour que l'admin voit le résultat avant de télécharger.

Pour l'export, le composant est rendu à taille réelle (1080×1920) dans un div caché, puis capturé.

### 6.3 Deux versions

Optionnel : permettre à l'admin de choisir entre dark et light :

```typescript
const [flyerTheme, setFlyerTheme] = useState<'dark' | 'light'>('dark');

<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
  <button onClick={() => setFlyerTheme('dark')}>Dark</button>
  <button onClick={() => setFlyerTheme('light')}>Light</button>
</div>
```

---

## ÉTAPE 7 — STRUCTURE DES FICHIERS

```
src/
  mobile/
    components/
      rates/
        RateFlyer.tsx          ← Le composant flyer (dark + light)
        RateFlyerExport.tsx    ← La logique d'export PNG/PDF
        BonziniLogo.tsx        ← Le logo SVG (réutilisable)
  lib/
    exportFlyer.ts             ← Fonctions downloadPNG() et downloadPDF()
```

---

## DESIGN

### Polices à charger

```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet" />
```

Vérifier que ces polices sont chargées dans l'app. Si elles ne le sont pas, les ajouter dans `index.html` ou le layout principal.

### Tailles clés du flyer

```
Taux (chiffres)       50px, DM Sans, weight 900
Symbole ¥             16px, DM Sans, weight 700
Heure Guangzhou       22px, Syne, weight 800 (compact, une ligne)
"1 000 000"           32px, Syne, weight 800, couleur or
bonzinilabs.com       22px, Syne, weight 800
Nom méthode           13px, DM Sans, weight 700
Chinois méthode       10px, Noto Sans SC
Disclaimer            8px (EN) + 7px (CN)
Contacts              13px, DM Sans, weight 800
```

---

## CHECKLIST

- [ ] Le composant RateFlyer existe et reproduit exactement la maquette
- [ ] Le logo Bonzini SVG original est utilisé (4 paths, non modifié)
- [ ] Les taux viennent du hook existant (pas hardcodés)
- [ ] Le taux se normalise correctement (décimal vs entier)
- [ ] Le flyer se met à jour quand le taux change
- [ ] Le bouton "Télécharger PNG" génère un PNG 1080×1920 haute résolution
- [ ] Le bouton "Télécharger PDF" génère un PDF avec le flyer
- [ ] Le nom du fichier inclut la date : `bonzini-rate-2026-03-15.png`
- [ ] Le preview miniature s'affiche dans l'écran des taux
- [ ] Les polices Syne, DM Sans, Noto Sans SC sont chargées
- [ ] Le flyer contient : logo, date EN+CN, heure Guangzhou, "1M XAF", 4 taux, note instantané, bonzinilabs.com, disclaimer EN+CN, contacts
- [ ] Dark et Light versions fonctionnent

---

## MAQUETTE DE RÉFÉRENCE

Le fichier `flyer_taux_du_jour_v4.jsx` contient le flyer complet avec dark/light toggle. Le résultat exporté doit être visuellement identique.
