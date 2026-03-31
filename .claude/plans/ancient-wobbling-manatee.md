# Refonte Formulaire Admin — Déclaration de Dépôt (Mobile)

## Contexte

Le formulaire admin de déclaration de dépôt (`src/mobile/screens/deposits/new-deposit/`) est un système de 16 fichiers (1316 lignes) qui utilise framer-motion, des composants custom (StepIndicator, ContextBanner, GlassBottomBar), et un design qui diverge du formulaire client. Le formulaire client (`src/pages/NewDepositPage.tsx`) vient d'être refait : il est propre, cohérent, avec des patterns simples (StepTransition CSS, card-elevated, method-card, btn-primary-gradient).

**Objectif** : Reconstruire le formulaire admin en un seul fichier qui reprend la structure, le design et les patterns du formulaire client, tout en gardant les spécificités admin (sélection client, upload preuves, commentaire admin).

---

## Changements Structurels

### Fichiers à créer (1)
- `src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx` — Réécriture complète (~650 lignes)

### Fichiers à supprimer (16)
- `src/mobile/screens/deposits/new-deposit/useDepositFormState.ts`
- `src/mobile/screens/deposits/new-deposit/types.ts`
- `src/mobile/screens/deposits/new-deposit/constants.ts`
- `src/mobile/screens/deposits/new-deposit/animations.ts`
- `src/mobile/screens/deposits/new-deposit/components/GlassBottomBar.tsx`
- `src/mobile/screens/deposits/new-deposit/components/ContextBanner.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepIndicator.tsx`
- `src/mobile/screens/deposits/new-deposit/components/CopyableRow.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepClientSelect.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepAmount.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepMethodFamily.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepSubMethod.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepBank.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepAgency.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepProofs.tsx`
- `src/mobile/screens/deposits/new-deposit/components/StepSummary.tsx`
- `src/mobile/screens/deposits/MobileNewDeposit.tsx` (ancien monolithe v3, code mort)

### Fichier inchangé
- `src/mobile/screens/deposits/index.ts` — Le barrel export `from './new-deposit/MobileNewDeposit'` reste valide

---

## Architecture du Nouveau Fichier

**Un seul fichier** avec le même pattern que `NewDepositPage.tsx` :
- State inline (useState, useMemo, useEffect, useRef)
- Render functions inline (renderClientSelect, renderAmountInput, renderRecap, etc.)
- Pas de framer-motion — utilise `StepTransition` CSS
- Pas de composants custom — tout est inline avec les classes CSS existantes

### Steps
```typescript
type Step = 'client' | 'amount' | 'family' | 'submethod' | 'bank' | 'agency' | 'recap' | 'creating';
```

**Changements vs ancien admin :**
- `'method'` → `'family'` (alignement avec le client)
- `'proofs'` + `'summary'` → fusionnés en `'recap'`
- Ajout de `'creating'` (état de chargement)

### Phases (barre de progression)
```
Phase 0 : client → amount → family → submethod → bank/agency
Phase 1 : recap (coordonnées + instructions + preuves optionnelles + commentaire + CTA)
Phase 2 : creating (spinner)
```

3 segments fins (`h-1 flex-1 rounded-full`), identiques au formulaire client.

---

## Flow par Méthode

| Méthode | Steps |
|---------|-------|
| BANK_TRANSFER | client → amount → family → submethod → bank → **recap** → creating |
| BANK_CASH_DEPOSIT | client → amount → family → submethod → bank → **recap** → creating |
| AGENCY_CASH | client → amount → family → agency → **recap** → creating |
| OM_TRANSFER | client → amount → family → submethod → **recap** → creating |
| OM_WITHDRAWAL | client → amount → family → submethod → **recap** → creating |
| MTN_TRANSFER | client → amount → family → submethod → **recap** → creating |
| MTN_WITHDRAWAL | client → amount → family → submethod → **recap** → creating |
| WAVE | client → amount → family → **recap** → creating |

---

## Design par Étape

### Client (spécifique admin)
- Barre de recherche : `rounded-xl bg-secondary border border-border/50`
- Liste clients : pattern `method-card` (avatar initiales + nom + téléphone + ArrowRight)
- Loading : `Loader2 animate-spin`
- Vide : icône User + "Aucun client trouvé"

### Amount
- Copié exactement du client : `card-elevated p-6` + `amount-input` + `useCountUp`
- Presets : `grid grid-cols-3 gap-2` (100k, 500k, 1M) + un 4e preset 2M pour admin
- CTA : `btn-primary-gradient`

### Family / SubMethod / Bank / Agency
- Même pattern que client : `method-card w-full text-left` + back button + ArrowRight
- Warning mobile money si montant > 2M : bandeau `border-l-4 border-amber-500 bg-amber-500/5`

### Recap (fusion proofs + summary)
Sections dans l'ordre :
1. **Back button** : `<ArrowLeft /> Retour` (navigation intelligente)
2. **Summary card** : montant + méthode (`card-elevated p-4 bg-primary/5 border-primary/20`)
3. **Client card** : avatar + nom du client (spécifique admin)
4. **Coordonnées** : `card-elevated p-4` + champs copiables + code marchand + montant
5. **Instructions** : liste numérotée (`w-6 h-6 rounded-full bg-primary/10`)
6. **Upload preuves (optionnel)** : `card-elevated p-4` + zone upload + thumbnails
7. **Commentaire admin (optionnel)** : `card-elevated p-4` + textarea
8. **Bandeau confirmation** : `rounded-xl border-l-4 border-primary bg-primary/5`
9. **CTA** : `btn-primary-gradient` "Confirmer et créer le dépôt"

### Creating
- Spinner centré : `animate-deposit-pulse` + `Loader2 animate-spin`
- Après succès : `navigate('/m/deposits')` ou `/m/deposits/${id}`

---

## Éléments Supprimés

| Ancien composant | Remplacé par |
|-----------------|-------------|
| `AnimatePresence` + `slideVariants` (framer-motion) | `StepTransition` CSS (`step-enter-right`/`step-enter-left`) |
| `StepIndicator` (dots + lignes) | 3 barres fines (`h-1 flex-1 rounded-full`) |
| `ContextBanner` (pills client + montant) | Supprimé — info visible dans le recap |
| `GlassBottomBar` (barre sticky blur) | CTA inline dans le scroll (pattern client) |
| `METHOD_FAMILY_COLORS` (système couleurs) | `bg-secondary text-foreground` simple |
| `CopyableRow` composant | Copy buttons inline (pattern client) |
| `staggerContainer` / `itemFadeUp` / `fadeUp` | Supprimé — `StepTransition` suffit |

---

## Hooks et Données Réutilisés

| Import | Source |
|--------|--------|
| `useAllClients()` | `src/hooks/useAdminDeposits.ts:168` |
| `useAdminCreateDeposit()` | `src/hooks/useAdminDeposits.ts:332` |
| `useCountUp()` | `src/hooks/useCountUp.ts` |
| `StepTransition` | `src/components/auth/StepTransition.tsx` |
| `MobileHeader` | `src/mobile/components/layout/MobileHeader.tsx` |
| `formatXAF`, `formatCurrency` | `src/lib/formatters.ts` |
| Toutes les données de méthodes | `src/data/depositMethodsData.ts` |
| Types dépôt | `src/types/deposit.ts` |

**Important** : `useAdminCreateDeposit` gère déjà l'upload des preuves, le commentaire admin, l'avancement de statut, et l'audit log. Pas besoin de logique supplémentaire.

---

## Navigation Spéciale

### URL Preselection
Si `?clientId=xxx` dans l'URL :
- Skip l'étape client, commence à `amount`
- Back depuis `amount` → `navigate('/m/clients/${clientId}')`

### Header Back
- `MobileHeader` avec `showBack={step !== 'creating'}`
- Étape client : retour vers `/m/deposits`
- Autres étapes : retour vers l'étape précédente

---

## Vérification

1. `npx tsc --noEmit` — zéro erreurs
2. `npx vite build` — build propre
3. Naviguer vers `/m/deposits/new` — formulaire charge
4. Tester `?clientId=xxx` — client présélectionné, commence à amount
5. Parcourir chaque chemin de méthode (8 chemins)
6. Vérifier la navigation arrière depuis chaque étape
7. Vérifier l'upload de preuves + commentaire dans le recap
8. Vérifier la création et redirection vers le détail
9. Vérifier le warning mobile money > 2M
10. Vérifier la copie des coordonnées (clipboard + toast)
