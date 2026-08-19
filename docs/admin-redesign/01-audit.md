# Refonte admin desktop — Audit UI/UX & architecture

> Phase 0 de la refonte desktop de l'admin. Périmètre audité : shell admin (`/m/*`),
> module Dépôts, module Paiements. Date : 19 août 2026.

## 1. Constat global

L'admin est une app **mobile-first avec un fork desktop boulonné dessus** :

- `AdminRouteWrapper` bascule à 1024 px entre deux arbres de composants parallèles
  (`src/mobile/` 28 626 lignes, `src/desktop/` 4 690 lignes). Rien n'est responsive
  *à l'intérieur* d'un shell.
- **20 des 51 routes admin n'ont pas d'écran desktop** : elles rendent l'écran mobile
  centré en `max-w-2xl` dans un cadre de 1400 px.
- Le détail d'un dépôt/paiement sur desktop est **l'écran mobile injecté dans une
  colonne sticky de 460 px** (`MasterDetailLayout`) — la « fiche écrasée à droite ».
  Les confirmations restent des `BottomSheet` qui montent du bas du navigateur.
- Le formulaire de création est **le wizard mobile 4-6 étapes en `max-w-xl` (576 px)**
  avec paddings iOS (`env(safe-area-inset-*)`) rendus sur desktop.

### Quatre systèmes de style concurrents, zéro source de vérité

1. `src/mobile/designKit/` — le seul réellement utilisé par l'admin (155 fichiers).
   Tous ses tokens sont des **hex codés en dur dans des classes arbitraires** —
   déconnectés des variables CSS et de `tailwind.config.ts`.
2. shadcn/ui (`src/components/ui`, 53 fichiers) — configuré mais **inutilisé par
   l'admin** (3 imports). 33 fichiers n'ont aucun importeur (~3 300 lignes mortes).
3. `src/components/treasury/ui.tsx` — kit parallèle avec un type `Tone` incompatible.
4. `index.css` `@layer components` (~800 lignes) — familles `.admin-*`, `.revolut-*`,
   `.liquid-*`… dont la majorité est morte.

**945 hex hardcodés (108 valeurs distinctes)** dans `src/mobile` + `src/desktop`.
`SlaDot` est défini 7 fois, `MIcon` 3 fois, `fmt()` 3 fois, etc.

### Code mort confirmé
- Écrans dépôts V1 : 2 704 lignes (`MobileDepositsScreen`, `MobileDepositDetail`,
  `MobileNewDeposit`) — exportées par le barrel, jamais routées, toujours bundlées.
  **Le V1 n'a aucun plafond de montant** (régression latente).
- ~33 composants shadcn sans importeur ; ~500 lignes CSS mortes ; 7 variantes de
  maquettes dans `src/__screenshot__/`.

## 2. Bugs relevés (à corriger pendant la refonte)

### Dépôts
1. **Bug d'argent — montant confirmé fantôme.** `MobileDepositDetailV2` envoie
   `confirmedAmount`, mais `useValidateDeposit` (`useAdminDeposits.ts:193-206`) ne le
   transmet **jamais** au RPC (`p_confirmed_amount` existe pourtant). Le champ
   « Montant confirmé », l'alerte de divergence et l'aperçu de solde sont du théâtre :
   le crédit se fait toujours au montant déclaré.
2. La recherche ne filtre que **les pages déjà chargées** (client-side) → faux
   « Aucun dépôt trouvé ». Idem paiements.
3. Realtime ne rafraîchit **ni la liste paginée ni les stats** (clés
   `['admin-deposits-paginated']` / `['deposit-stats']` jamais invalidées ;
   `deposit_proofs`/`deposit_timeline_events` → clés heuristiques erronées).
4. `depositStatusTone` écrit pour un **autre vocabulaire de statuts** : 6 statuts sur 9
   (dont tous les actionnables) tombent en gris neutre.
5. `pending_correction` a un statut, un filtre, une tuile — mais **plus aucune action**
   dans la fiche (flux en cul-de-sac).
6. `cancelled_by_admin` absent de `isLocked` → boutons Valider/Rejeter affichés sur un
   dépôt annulé.
7. Client `NewDepositPage` (app client) : le cap 50 M est contourné —
   `parseInt(amount)` brut part au RPC pendant que `parsedAmount` clampé sert à
   l'affichage. Pas de cap serveur dans `create_client_deposit`.

### Paiements
1. **Bouton mort** : « Passer en cours » proposé pour `cash_scanned`, mais le RPC
   n'accepte que `ready_for_payment`. Le bucket « à traiter » route vers un échec.
2. Realtime : `['admin-payments-paginated']` et `['payment-stats']` jamais invalidés.
3. La signature cash n'invalide pas `['admin-payment', id]` → fiche admin périmée.
4. `validateUploadFile()` absent de **8 chemins d'upload admin** (preuves, QR,
   instructions) — violation de `.claude/rules/security.md`.
5. « Tout » remplit le solde entier sans cap alors que la validation impose 50 M →
   CTA silencieusement désactivé sur les gros portefeuilles.
6. 3 hooks d'upload de preuve concurrents, 3 vocabulaires de labels de statuts,
   éditeur de bénéficiaire dupliqué (form partagé + inline).
7. 9 casts `payment as {…}` : le type `Payment` ne décrit pas ce que la requête
   retourne.

## 3. Direction de la refonte (validée par maquettes)

Fondation : **`docs/admin-redesign/02-design-system.md`** (tokens issus du kit Figma
« Simple Design System », adaptés à la marque Bonzini). Maquettes sources dans
`docs/admin-redesign/mockups/`.

Principes :
- **Desktop d'abord** : shell sidebar 224 px + topbar 52 px + contenu pleine largeur.
- **Une table, pas des cartes** : lignes 46 px, texte 13 px, `tabular-nums`,
  pagination serveur (25/50/100), tri par colonnes, filtres dans l'URL.
- **Fiche = slide-over 660 px** (triage sans perdre la liste), URL propre,
  promotion pleine page possible. Preuves en premier, chronologie toujours visible,
  actions dans un footer sticky. Plus aucun `BottomSheet` sur desktop.
- **Création = une page** (sections numérotées + récapitulatif sticky), plus de wizard
  6 étapes sur desktop. Confirmation explicite pour tout mouvement d'argent.
- **La couleur porte du sens uniquement** : violet = action primaire/sélection ;
  vert/ambre/bleu/rouge = statuts ; ambre+orange logo = micro-accents.
- La recherche passe **côté serveur** ; realtime réparé avec les vraies clés.

## 4. Ordre des chantiers

1. Module Dépôts (liste + fiche + création) — en cours.
2. Module Paiements (mêmes patterns, workflow statuts réparé).
3. Modules suivants (clients, trésorerie, etc.) un par un sur la même fondation.
