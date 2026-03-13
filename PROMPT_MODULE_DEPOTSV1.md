# PROMPT CLAUDE CODE — Intégration du module Dépôts redesigné (App Admin)

> **Lis ce prompt EN ENTIER. La maquette interactive est dans `maquette_admin_module_depots_v3.jsx` (3 écrans navigables). Le document d'analyse est dans `ANALYSE_MODULE_DEPOTS.md`. Ouvre les deux avant de commencer.**

---

## Objectif

Remplacer les 3 écrans du module dépôts dans l'app admin mobile :
1. **Liste des dépôts** — `MobileDepositsScreen.tsx` (516 lignes)
2. **Fiche dépôt** — `MobileDepositDetail.tsx` (1196 lignes)
3. **Formulaire création** — `MobileNewDeposit.tsx` (1001 lignes)

**Le but n'est PAS de réécrire la logique métier. C'est de remplacer l'UI en gardant TOUTES les connexions, hooks, RPC et règles métier intactes.**

---

## ÉTAPE 0 — CARTOGRAPHIER L'EXISTANT (les 3 composants)

**C'est l'étape la plus importante. Passe le temps qu'il faut ici.**

### 0.1 La liste — MobileDepositsScreen.tsx

```bash
# Lire le composant
cat src/mobile/screens/deposits/MobileDepositsScreen.tsx | head -80

# Tous les imports
grep -n "^import" src/mobile/screens/deposits/MobileDepositsScreen.tsx

# Tous les hooks
grep -n "use[A-Z]" src/mobile/screens/deposits/MobileDepositsScreen.tsx | head -30

# Filtres et états
grep -n "useState\|filter\|Filter\|search\|sort\|period\|date" src/mobile/screens/deposits/MobileDepositsScreen.tsx | head -20

# Navigation
grep -n "navigate\|push\|Link" src/mobile/screens/deposits/MobileDepositsScreen.tsx

# KPIs et stats
grep -n "stat\|Stat\|count\|Count\|kpi" src/mobile/screens/deposits/MobileDepositsScreen.tsx | head -10

# Composant carte de dépôt (renderItem)
grep -n "renderItem\|DepositRow\|DepositCard\|deposit-row\|deposit.*card" src/mobile/screens/deposits/MobileDepositsScreen.tsx
```

### 0.2 La fiche — MobileDepositDetail.tsx

```bash
# Lire le composant
cat src/mobile/screens/deposits/MobileDepositDetail.tsx | head -80

# Tous les imports
grep -n "^import" src/mobile/screens/deposits/MobileDepositDetail.tsx

# Tous les hooks (queries + mutations)
grep -n "use[A-Z]" src/mobile/screens/deposits/MobileDepositDetail.tsx | head -30

# Variables de permission
grep -n "isLocked\|canValidate\|canReject\|canProcess\|isSuperAdmin\|canAdd\|canDelete\|canStartReview" src/mobile/screens/deposits/MobileDepositDetail.tsx

# Boutons d'action et handlers
grep -n "handleValidate\|handleReject\|handleCorrection\|handleDelete\|handleUpload\|handleStart\|handleDeleteProof" src/mobile/screens/deposits/MobileDepositDetail.tsx

# Bottom sheets / modales
grep -n "showValidate\|showReject\|showCorrection\|showDelete\|showUpload\|Sheet\|Modal\|Dialog" src/mobile/screens/deposits/MobileDepositDetail.tsx

# Génération PDF
grep -n "receipt\|Receipt\|pdf\|PDF\|download" src/mobile/screens/deposits/MobileDepositDetail.tsx
```

### 0.3 Le formulaire — MobileNewDeposit.tsx

```bash
# Lire le composant
cat src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx | head -80

# Tous les imports
grep -n "^import" src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx

# Les étapes
grep -n "step\|Step\|goTo\|setStep\|currentStep" src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx | head -20

# La soumission
grep -n "submit\|Submit\|handleCreate\|createDeposit\|create_client_deposit\|confirm" src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx

# Upload de preuves à la création
grep -n "upload\|Upload\|proof\|Proof\|file\|File" src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx | head -15

# Navigation post-création
grep -n "navigate\|push\|redirect" src/mobile/screens/deposits/new-deposit/MobileNewDeposit.tsx
```

### 0.4 Les hooks partagés

```bash
# Hooks dépôts admin
cat src/hooks/useAdminDeposits.ts | head -50
grep -n "export" src/hooks/useAdminDeposits.ts

# Hook pagination
cat src/hooks/usePaginatedDeposits.ts | head -50
grep -n "export" src/hooks/usePaginatedDeposits.ts

# Hook dépôts client (pour comprendre les différences)
grep -n "export" src/hooks/useDeposits.ts

# Données statiques (banques, agences, mobile money)
cat src/data/depositMethodsData.ts | head -100

# Types et constantes
cat src/types/deposit.ts | head -100
grep -n "export" src/types/deposit.ts
```

### 0.5 Les connexions avec les autres modules

```bash
# Qui navigue vers le module dépôts
grep -rn "\/m\/deposits\|MobileDeposit" src/mobile/ --include="*.tsx" --include="*.ts" | grep -i "navigate\|route\|link\|push" | head -15

# Le dashboard utilise-t-il les stats dépôts
grep -rn "deposit" src/mobile/screens/dashboard/ src/mobile/screens/home/ --include="*.tsx" --include="*.ts" | head -10

# La fiche client affiche-t-elle les dépôts
grep -rn "deposit" src/mobile/screens/clients/ --include="*.tsx" --include="*.ts" | head -10

# Le badge de la bottom nav
grep -rn "deposit.*count\|count.*deposit\|useAdminActionableCounts" src/mobile/ --include="*.tsx" --include="*.ts" | head -10

# Les notifications
grep -rn "deposit.*notif\|notif.*deposit" src/ --include="*.tsx" --include="*.ts" | head -10

# Le composant DepositInstructions (réutilisé ?)
grep -rn "DepositInstructions" src/ --include="*.tsx" --include="*.ts" | head -10

# Le composant DepositTimelineDisplay
grep -rn "DepositTimelineDisplay\|depositTimeline" src/ --include="*.tsx" --include="*.ts" | head -10
```

---

## ÉTAPE 1 — PLAN DE REMPLACEMENT

**Ne supprime PAS les anciens fichiers immédiatement.**

1. Crée les nouveaux composants en V2 :
   - `MobileDepositsScreenV2.tsx` (liste)
   - `MobileDepositDetailV2.tsx` (fiche)
   - `MobileNewDepositV2.tsx` (formulaire)
2. Copie TOUS les imports et hooks des anciens composants dans les nouveaux
3. Reconstruis l'UI selon la maquette en utilisant les mêmes données
4. Teste chaque écran individuellement
5. Quand tout fonctionne, remplace dans le routeur
6. Supprime les anciens fichiers

---

## ÉTAPE 2 — ÉCRAN LISTE (MobileDepositsScreenV2.tsx)

### 2.1 Données nécessaires

Réutiliser exactement les mêmes hooks :
```typescript
// Hook principal
const { data, fetchNextPage, hasNextPage, isLoading, refetch } = usePaginatedAdminDeposits(filterParams);

// Stats KPI
const { data: stats } = useDepositStats(); // ou le hook existant

// Badge bottom nav (dans le layout parent)
// useAdminActionableCounts()
```

### 2.2 KPIs (3 cartes compactes)

```
[À traiter: X] [À corriger: X] [Validés: X]
```

- **À traiter** = `proof_submitted` + `admin_review` (couleur bleu)
- **À corriger** = `pending_correction` (couleur orange)
- **Validés** = `validated` (couleur vert)
- Chaque KPI est cliquable → filtre la liste

### 2.3 Filtres

**Recherche** — Barre de recherche avec debounce 300ms. Client-side sur les données chargées.

**Icône filtre = entonnoir SVG** (pas ≡). Ouvre le panneau avancé.

**Panneau avancé contient :**

**Méthode :** Filtrer par famille (pas par sous-méthode) :
- Toutes, Banque, Agence, Orange, MTN, Wave
- Côté serveur : mapper famille → méthodes DB :
  - BANK → `bank_transfer`, `bank_cash`
  - AGENCY_BONZINI → `agency_cash`
  - ORANGE_MONEY → `om_transfer`, `om_withdrawal`
  - MTN_MONEY → `mtn_transfer`, `mtn_withdrawal`
  - WAVE → `wave`

**Période avec présets :**
- Toutes (pas de filtre date)
- Aujourd'hui → `dateFrom = today 00:00`
- Hier → `dateFrom = yesterday 00:00, dateTo = yesterday 23:59`
- Cette semaine → `dateFrom = lundi 00:00`
- Ce mois → `dateFrom = 1er du mois 00:00`
- Personnalisé → affiche 2 inputs date

**Chips statut :**
- Tous (avec compteur total)
- À traiter (proof_submitted + admin_review)
- À corriger (pending_correction)
- Validés (validated)
- Rejetés (rejected)

### 2.4 Carte de dépôt

Chaque carte affiche :
- **Icône méthode** (lettre sur fond coloré selon la famille)
- **Nom client** (tronqué si trop long)
- **Référence + nom court de la méthode** (ex: "BZ-DP-2026-0033 · Wave")
- **Nombre de preuves** (📎 si > 0)
- **Montant en XAF** avec le symbole devise : "28 581 000 XAF"
- **Badge statut** coloré
- **Point SLA** (vert < 2h, jaune 2-8h, rouge > 8h avec pulsation)
- **Date relative** (il y a 5h, hier, etc.)

**Au clic → `navigate(/m/deposits/${deposit.id})`**

### 2.5 Icônes des méthodes par famille

```typescript
// Mapping famille → couleur + lettre
const FAMILY_ICONS = {
  BANK: { letter: "B", color: "#fff", bg: "#1e3a5f" },
  AGENCY_BONZINI: { letter: "A", color: "#fff", bg: "#A947FE" },
  ORANGE_MONEY: { letter: "O", color: "#fff", bg: "#ff6600" },
  MTN_MONEY: { letter: "M", color: "#1a1028", bg: "#ffcb05" },
  WAVE: { letter: "W", color: "#fff", bg: "#1dc3e3" },
};

// Pour déterminer la famille depuis la méthode DB :
function getFamilyFromMethod(method: string): string {
  if (["bank_transfer", "bank_cash"].includes(method)) return "BANK";
  if (method === "agency_cash") return "AGENCY_BONZINI";
  if (["om_transfer", "om_withdrawal"].includes(method)) return "ORANGE_MONEY";
  if (["mtn_transfer", "mtn_withdrawal"].includes(method)) return "MTN_MONEY";
  if (method === "wave") return "WAVE";
  return "BANK"; // fallback
}
```

Ce mapping existe probablement déjà dans `src/types/deposit.ts`. Vérifie et réutilise.

---

## ÉTAPE 3 — FICHE DÉPÔT (MobileDepositDetailV2.tsx)

### 3.1 Données nécessaires

```typescript
// Réutiliser les hooks existants
const { data: deposit } = useAdminDepositDetail(depositId);
const { data: proofs } = useAdminDepositProofs(depositId);
const { data: timeline } = useAdminDepositTimeline(depositId);
const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);
```

### 3.2 Layout de la fiche

```
HEADER : ‹ BZ-DP-2026-0033 [Relevé]
──────────────────────────────
STATUT (badge) ···· MÉTHODE (icône + nom)

┌──────────────────────────┐
│  MONTANT (gros, centré)  │
│  2 000 000 XAF           │
│  ─────────────           │
│  Client : Johann Soh     │
└──────────────────────────┘

┌──────────────────────────┐
│  PREUVES (N)  [+ Ajouter]│
│  [img] [img] [img]       │
│  ou "Preuve manquante"   │
└──────────────────────────┘

┌──────────────────────────┐
│  INFOS : Réf · Méthode   │
│  Banque · Date · Validé  │
└──────────────────────────┘

┌──────────────────────────┐
│  SUIVI (collapsible)     │
└──────────────────────────┘

[Action principale]
[Rejeter] [Corriger]
[Supprimer]
```

### 3.3 Actions et conditions — EXACTES (tirées de l'analyse)

```typescript
const isSuperAdmin = currentUser?.role === 'super_admin';
const isLocked = ['validated', 'rejected', 'cancelled'].includes(deposit.status);
const canValidate = !isLocked;
const canReject = !isLocked;
const canStartReview = deposit.status === 'proof_submitted';
const hasProofs = proofs && proofs.length > 0;
const canAddProof = !isLocked;
```

| Bouton | Condition | Couleur | Handler existant |
|---|---|---|---|
| "Commencer la vérification" | `canStartReview` (status === 'proof_submitted') | Violet | `useStartDepositReview()` |
| "Valider le dépôt" | `canValidate` (!isLocked) | Vert | `useValidateDeposit()` → ouvre modale |
| "Rejeter" | `canReject` (!isLocked) | Rouge outline | `useRejectDeposit()` → ouvre sheet |
| "Corriger" | `canValidate` (!isLocked) | Orange outline | `useRequestCorrection()` → ouvre sheet |
| "+ Ajouter" (preuve) | `canAddProof` (!isLocked) | Vert texte | `useAdminUploadProofs()` |
| "×" sur preuve | `!isLocked` | Rouge | `useAdminDeleteProof()` |
| "Relevé" (header) | Toujours | Vert | PDF via `@react-pdf/renderer` |
| "Supprimer" | `isSuperAdmin` | Gris/Rouge | `useDeleteDeposit()` |

### 3.4 Modales existantes à CONSERVER

**Validate :**
- Montant déclaré (lecture seule)
- Champ "Montant confirmé" (pré-rempli avec amount_xaf)
- Commentaire admin optionnel
- Toggle notification client
- Bouton "Valider"

**Reject :**
- Sélecteur catégorie (REJECTION_REASONS)
- Message client (obligatoire)
- Note interne admin
- Bouton "Confirmer le rejet"

**Correction :**
- Raison de correction (obligatoire)
- Bouton "Demander correction"

**Upload preuves :**
- Input file (multiple, image/* + application/pdf)
- Max 5 fichiers
- Preview avant upload

**Delete preuve :**
- Sélecteur raison (PROOF_DELETE_REASONS)
- Si "Autre" → champ texte

**Delete dépôt :**
- Warning avec nom client + montant
- Bouton "Supprimer définitivement"

**RÉUTILISE ces modales exactement comme elles sont.** Ne les réécris PAS.

### 3.5 Preuves — affichage

```typescript
// Les preuves viennent de useAdminDepositProofs
// Chaque preuve a :
// - file_url (chemin relatif dans le bucket)
// - file_name
// - uploaded_by_type ('client' | 'admin')
// - deleted_at (null si active, date si soft-deleted)

// Les URLs signées sont générées par le hook
// Afficher en miniatures (70×70px) avec scroll horizontal
// Bouton × rouge en overlay si !isLocked
// Si proofs.length === 0 → zone dashed "Preuve manquante"
```

---

## ÉTAPE 4 — FORMULAIRE CRÉATION (MobileNewDepositV2.tsx)

### 4.1 La hiérarchie des étapes

```
Étape 1 : Client (recherche + sélection)
Étape 2 : Montant (input + raccourcis)
Étape 3 : Famille (5 options : Bank, Agency, Orange, MTN, Wave)
Étape 4 : Sous-méthode (selon famille) OU Agence
Étape 5 : Banque (si famille = BANK seulement)
Étape récap : Résumé + coordonnées copiables + preuves optionnelles
→ Écran succès
```

**Le nombre total d'étapes varie selon la famille :**
- WAVE → 4 étapes (client → montant → famille → récap)
- AGENCY_BONZINI → 5 étapes (+ agence)
- ORANGE/MTN → 5 étapes (+ sous-méthode)
- BANK → 6 étapes (+ sous-méthode + banque)

**La barre de progression s'adapte dynamiquement.**

### 4.2 Navigation entre les étapes

```typescript
// Après famille (étape 3) :
if (family === "WAVE") → récap
if (family === "AGENCY_BONZINI") → étape 4 (agence)
if (family === "BANK") → étape 4 (sous-méthode transfer/cash)
if (family === "ORANGE_MONEY" || "MTN_MONEY") → étape 4 (sous-méthode transfer/withdrawal)

// Après sous-méthode (étape 4) :
if (family === "BANK") → étape 5 (banque)
else → récap

// Après banque (étape 5) :
→ récap

// Après récap :
→ écran succès
```

### 4.3 Les données statiques à utiliser

```bash
# Banques, agences, numéros mobile money
cat src/data/depositMethodsData.ts
```

**RÉUTILISE ces données.** Ne les hardcode PAS dans le composant. Importe-les depuis `depositMethodsData.ts`.

### 4.4 Le récap doit afficher les coordonnées

Selon la famille et sous-méthode choisie, le récap affiche les coordonnées Bonzini à communiquer au client :

**Banque :** Titulaire (BONZINI TRADING SARL), N° Compte, IBAN, SWIFT, Montant → chaque ligne avec bouton "Copier"

**Orange/MTN :** Numéro, Titulaire, Code marchand (si sous-méthode = withdrawal), Montant → boutons "Copier"

**Wave :** Numéro, Titulaire, Montant → boutons "Copier"

**Agence :** Nom, Adresse, Horaires

Le composant `DepositInstructions.tsx` existe déjà et fait exactement ça. Vérifie s'il peut être réutilisé :
```bash
cat src/components/deposit/DepositInstructions.tsx | head -50
```

### 4.5 Soumission

```typescript
// RPC existante — NE PAS RÉÉCRIRE
const { mutateAsync: createDeposit } = useAdminCreateDeposit();

// Payload :
{
  p_user_id: selectedClient.user_id,
  p_amount_xaf: amount,
  p_method: getDepositMethod(), // résolu depuis famille + sous-méthode
  p_bank_name: selectedBank?.label || undefined,
  p_agency_name: selectedAgency?.label || undefined,
  p_client_phone: undefined, // toujours null côté admin
}
```

**Post-création si preuves fournies :**
1. Upload chaque fichier vers `deposit-proofs/{userId}/{depositId}/...`
2. Insert dans `deposit_proofs`
3. Update status → `proof_submitted`
4. Insert timeline event

**Post-création :** Afficher écran succès, puis "Voir la fiche" → `navigate(/m/deposits/${id})`

### 4.6 Mapping famille + sous-méthode → méthode DB

```typescript
function getDepositMethod(): DepositMethod {
  switch (family) {
    case "BANK":
      return submethod === "BANK_TRANSFER" ? "bank_transfer" : "bank_cash";
    case "AGENCY_BONZINI":
      return "agency_cash";
    case "ORANGE_MONEY":
      return submethod === "TRANSFER" ? "om_transfer" : "om_withdrawal";
    case "MTN_MONEY":
      return submethod === "TRANSFER" ? "mtn_transfer" : "mtn_withdrawal";
    case "WAVE":
      return "wave";
  }
}
```

Ce mapping existe probablement déjà dans le code. Cherche et réutilise :
```bash
grep -rn "getDepositMethod\|resolveMethod\|mapMethod" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

## ÉTAPE 5 — DESIGN

### Police
**DM Sans uniquement.**

### Couleurs
```
Vert principal   #34d399   (boutons dépôt, KPI validés, +, confirmations)
Violet            #A947FE   (agence Bonzini, vérification, liens)
Orange            #FE560D   (à corriger, correction)
Or                #F3A745   (preuve manquante, warnings)
Rouge             #ef4444   (rejeté, supprimer, rejeter)
Bleu              #3b82f6   (à traiter, preuve envoyée)

Banque            #1e3a5f   (icône famille Banque)
Orange Money      #ff6600   (icône famille Orange)
MTN               #ffcb05   (icône famille MTN, texte noir)
Wave              #1dc3e3   (icône famille Wave)

Fond page         #f5f3f7
Cartes            #ffffff
Texte             #1a1028
Secondaire        #7a7290
Tertiaire         #c4bdd0
Bordures          #ebe6f0
```

### Tailles clés
```
Montant fiche            40px, weight 900
Montant récap formulaire 38px, weight 900
Titre d'étape            21px, weight 800
Nom client dans liste    14px, weight 700
Montant dans liste       14px, weight 800, + " XAF"
Badge statut             10px, weight 700
Labels sections          12px, weight 800
Bouton principal         14px, weight 700
```

---

## ÉTAPE 6 — CONNEXIONS À VÉRIFIER

### 6.1 Routes

```bash
# Vérifier les routes du module dépôts
grep -rn "\/m\/deposits" src/ --include="*.tsx" --include="*.ts" | grep -i "route\|path\|element" | head -10
```

Les routes doivent pointer vers les nouveaux composants V2.

### 6.2 Bottom nav badge

Le badge "Dépôts" dans la bottom nav utilise `useAdminActionableCounts()`. **Ne touche pas à ce hook.**

### 6.3 Dashboard

Le dashboard peut afficher un widget dépôts. Vérifie et assure que les mêmes hooks sont utilisés.

### 6.4 Fiche client

La fiche client affiche les dépôts du client. C'est une requête indépendante — **pas impactée par ce refactor.**

### 6.5 Notifications

Les notifications type `deposit_*` naviguent vers `/m/deposits/:id`. La route doit toujours fonctionner.

---

## RÈGLES

1. **Vert pour les dépôts** (pas violet comme les paiements) — bouton "+", "Valider", header "Relevé"
2. **Icônes méthodes par famille** — lettre sur fond coloré, pas d'émojis
3. **Montant toujours avec "XAF"** — jamais un nombre seul
4. **Boutons TOUJOURS visibles** en bas, jamais cachés
5. **Bottom nav masquée** dans le formulaire et la fiche
6. **Réutiliser la logique existante** — hooks, RPC, modales
7. **DM Sans partout**
8. **Le formulaire a un nombre d'étapes dynamique** selon la famille
9. **Coordonnées copiables dans le récap** du formulaire
10. **Écran succès après création** avec "Voir la fiche" et "Retour"

---

## CHECKLIST FINALE

### Liste (MobileDepositsScreenV2)
- [ ] KPIs compacts (À traiter / À corriger / Validés)
- [ ] Recherche + icône entonnoir
- [ ] Filtres : méthode par famille + période (Aujourd'hui/Hier/Semaine/Mois/Personnalisé)
- [ ] Chips statut avec compteurs
- [ ] Carte dépôt : icône famille + nom + ref + montant XAF + badge + SLA
- [ ] Infinite scroll + pull to refresh
- [ ] État vide
- [ ] Bottom nav avec badge

### Fiche (MobileDepositDetailV2)
- [ ] Header avec ref + bouton Relevé PDF
- [ ] Badge statut + icône méthode
- [ ] Montant gros centré avec "XAF"
- [ ] Client compact
- [ ] Preuves : miniatures + upload + delete (si !isLocked)
- [ ] Infos (ref, méthode, banque/agence, date)
- [ ] Suivi collapsible
- [ ] Boutons : Vérification / Valider / Rejeter / Corriger / Supprimer — selon statut
- [ ] Modales existantes réutilisées (validate, reject, correction, upload, delete)

### Formulaire (MobileNewDepositV2)
- [ ] 4 à 6 étapes selon la famille
- [ ] Progress bar dynamique
- [ ] Client → Montant → Famille → [Sous-méthode] → [Banque/Agence] → Récap
- [ ] Coordonnées Bonzini dans le récap avec boutons Copier
- [ ] Upload preuves optionnel dans le récap
- [ ] Écran succès après création
- [ ] Navigation vers la fiche du dépôt créé
- [ ] Pas de bottom nav dans le formulaire

### Connexions
- [ ] Routes pointent vers les V2
- [ ] Badge bottom nav fonctionne
- [ ] Notifications naviguent vers la fiche
- [ ] Dashboard non impacté
- [ ] Fiche client non impactée

### Design
- [ ] DM Sans partout
- [ ] Couleurs respectées (vert = dépôts, pas violet)
- [ ] Icônes familles correctes (B/A/O/M/W avec bonnes couleurs)
- [ ] Bordures 1.5px, borderRadius 10-14
- [ ] Montants formatés avec espaces + "XAF"

---

## MAQUETTE DE RÉFÉRENCE

Le fichier `maquette_admin_module_depots_v3.jsx` contient les 3 écrans navigables. Teste le flow complet avant de coder. Le résultat final doit être visuellement identique.
