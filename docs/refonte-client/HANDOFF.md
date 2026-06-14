# PASSATION — Refonte app CLIENT (reprendre ici dans une nouvelle session)

> **Tu es une nouvelle session Claude.** Lis ce doc en entier : il contient tout
> le contexte pour continuer la refonte de l'app **client** sans rien casser.
> Branche de travail : **`claude/stoic-ritchie-Ov4D2`** (tout est poussé).

## 0. Démarrage rapide
1. `git fetch origin claude/stoic-ritchie-Ov4D2 && git checkout -f -B claude/stoic-ritchie-Ov4D2 origin/claude/stoic-ritchie-Ov4D2`
2. Vérifs : `npm run type-check`, `npm run build`. Toujours **commit + push après chaque étape**
   (le conteneur se réinitialise parfois sur un vieux commit `c71d274` ; si ça arrive,
   refais l'étape 1 pour restaurer — rien n'est perdu, tout est sur origin).
3. **Prochaine tâche = module TAUX client** (voir §4.1 — même méthode :
   maquette d'abord, validation client, puis implémentation).

## 1. Objectif & méthode
Refonte **from scratch** de l'app mobile **client** (`src/pages/`, `src/components/`,
entrée `index.html`, client Supabase **`supabase`** — jamais `supabaseAdmin`), **module
par module**, en **préservant 100 % de la logique métier**. On éradique le vieux look
(dégradés violets, `card-glass`, `liquid-nav`, halos) au profit du **designKit unifié**
de l'admin.

## 2. Décisions de design VERROUILLÉES (validées par le client)
- **Direction A** : réutiliser **`@/mobile/designKit`** (`SURFACE`, `TEXT`, `PRIMARY_PILL`,
  `SOFT_PILL`, `StatusPill`, `PrimaryPill`, `SoftPill`, `paymentStatusTone`, etc.). Canvas
  lilas, cartes blanches ombre douce, **zéro dégradé / verre / halo**, couleur = sens.
- **Sémantique cycle de vie 3 tons** (helper **`src/lib/paymentLifecycle.ts`**) :
  - 🔴 **rouge `#C0504D`** = `todo` (action requise du client : coordonnées manquantes,
    QR cash à présenter) ; aussi `failed` (refusé/annulé).
  - 🟣 **lilas `#8B5CF6`** = `progress` (Bonzini travaille).
  - 🟢 **vert `#2E7D52`** = `done` (payé).
- **Marque** : « **Réglez** vos fournisseurs » (pas « Envois »), « **Règlement** » (pas
  « Transfert »), « **bénéficiaire** » sur la fiche, taux au format **« 1 000 000 XAF = 11 350 ¥ »**
  (XAF d'abord, « XAF » pas « francs »).
- **Pas de numérotation** des paiements : la **référence** `BZ-PM-…` + nom du fournisseur +
  date suffisent.
- Icône **`Send`** (avion) sur la carte « Payer un fournisseur » (pas un `+`).

## 3. FAIT (implémenté sur le vrai code, poussé)
- **Re-skin Direction A** de tous les écrans paiements (commits antérieurs) : liste, wizard
  (5 étapes), détail (orchestrateur + 9 composants `payment-detail/*`), édition bénéficiaire.
- **LISTE refondue structure v8** → `src/pages/PaymentsPage.tsx` :
  carte « Nouveau paiement » (icône envoi) + taux du jour (`useClientRates`), **barre de
  recherche** (fournisseur/référence), **filtres** statut (Tous/À traiter/En cours/Terminés
  + compteur) **+ période** (Tout/Ce mois/Cette semaine), **cartes cycle de vie** (barre
  d'avancement colorée, à-traiter ROUGE en tête, référence affichée). `useMyPayments` intact.
- **FICHE refondue structure v7** → `src/pages/PaymentDetailPage.tsx` + `payment-detail/*` :
  en-tête drill-in (retour rond + référence) · **action en tête** (reçu `PRIMARY_PILL` si
  `completed`, carte ROUGE « Compléter les coordonnées » si `waiting_beneficiary_info`,
  sinon reçu en pilule douce dans Preuve & détails) · **hero** gros ¥ (58px) + « Vous avez
  payé X XAF » (« recrédités » si rejeté/annulé — `cancel_payment` recrédite bien) + taux
  lilas « 1 000 000 XAF = 11 350 ¥ » + pastille cycle de vie (`lifecycleStatusLabel`,
  PARTAGÉE avec la liste — badges unifiés) · **Bénéficiaire** (intitulé hors carte +
  Modifier/Verrouillé, QR vignette 88px « Agrandir », champs copiables nuancés par méthode,
  cash = nom + téléphone) · **Suivi** = nouveau `PaymentTrackingSection` (4 jalons
  `paymentLifecycle`, dates réelles via `buildPaymentTimelineSteps`, l'étape courante porte
  l'action rouge si todo) · **Preuve & détails** (`PaymentDocumentsSection` : preuves
  admin/client + upload + lignes Référence/Méthode/Créé le/Payé le). `PaymentStatusMessages`
  réduit aux cartes porteuses d'info (motif rejet, annulation, message Bonzini).
  SUPPRIMÉS (orphelins) : `PaymentDetailsAccordion`, `PaymentTimelineDisplay`,
  `STATUS_BADGE_STYLES`. Reçu PDF / upload preuves / QR drawer / cash QR intacts.
- **WIZARD refondu (maquette VALIDÉE par le client → implémenté)** →
  `src/pages/NewPaymentPage.tsx` + `payment-form/*`. Maquette de référence :
  `src/__screenshot__/clientPayWizard.tsx` (clés `cpay-wiz-*`). Décisions validées :
  en-tête drill-in (retour rond + titre) · **AUCUNE barre d'étapes sur l'écran Méthode**
  (demande client), visible ensuite avec libellés pleins (Méthode/Montant/Bénéficiaire/Résumé)
  · cartes méthode avec **taux du jour par mode** (ambre, `getBaseRate`, descriptions
  « Règlement sur compte… ») · montant : segment XAF/RMB en carte blanche, **saisie groupée
  en milliers** (état brut préservé), pastille solde, bloc lilas « Votre bénéficiaire
  reçoit » + « Taux du jour · 1 000 000 XAF = 11 480 ¥ » (taux **entier** via
  `Math.round(1e6*rate)`), « Solde après paiement », presets 100K/250K/500K/1M/Tout une
  ligne, rappel bornes · bénéficiaire : onglets violet en carte, sous-titre avec méthode,
  « Compléter les coordonnées plus tard » en **lien discret** (≠ CTA), icônes User/Users ·
  résumé : hero langage fiche v7 (¥ `formatYuan`, taux lilas) + récap (bénéficiaire +
  identifiant/compte/téléphone via `beneficiarySub`, « Débité maintenant », nouveau solde)
  + note lilas de débit · CTA pied avec flèche. `formatYuan` ajouté aux formatters.
  LOGIQUE 100 % intacte : `BeneficiaryForm` partagé (champs par méthode), switch devise
  vide l'input, « Tout » = min(solde, 50M), bornes/zod, doublon soft, cash+self,
  snapshot gelé, `SuccessScreen` inchangé.
- **PASSE D'UNIFORMISATION (audit Playwright) — module paiements 100 % cohérent** :
  · `BeneficiaryForm` (créer) re-stylé designKit : `inputCls` = mêmes classes que la lib
    `form/` (parité avec l'écran d'édition + reste de l'app), chips méthode/identifiant/
    relation en cartes designKit (anneau lilas), QR en boîte pointillée designKit, erreurs
    en rouge sémantique `#C0504D`. Nouvelle prop **`hideRelation`** posée par le wizard →
    supprime le **doublon « Moi-même »** (haut Moi-même/Autre + bas Relation). Touche aussi
    le carnet client/admin (amélioration, logique inchangée).
  · `EditBeneficiaryPage` : en-tête **drill-in** (rond retour + titre) au lieu du vieux
    `PageHeader` à bordure ; `pb-40` sous la barre d'action fixe.
  · **¥ uniformisé** via `formatYuan` (décimales seulement si non entier) : `SuccessScreen`
    (était `formatRMB`), liste (`PaymentsPage`, était `formatCurrencyRMB`), `PaymentHeroCard`
    (centralisé). Note : `groupDigits` (montant) garde un léger saut de curseur en édition
    au milieu — défaut mineur connu, design validé conservé.

- **MODULE DÉPÔTS — refondu + IMPLÉMENTÉ (maquette validée → vrai code)** :
  · `src/lib/depositLifecycle.ts` (cycle de vie 3 tons, jumeau de paymentLifecycle).
  · `src/mobile/components/deposits/DepositLogos.tsx` — **vrais logos de marque** (assets
    `src/assets/deposit-logos/`) : Orange (SVG Wikimedia), Wave (pingouin wave.com),
    Ecobank/UBA (Wikimedia), Afriland (emblème). MTN composé (jaune + « MTN » bleu). CCA
    monogramme (logo non libre). `DepositMethodLogo` / `DepositFamilyLogo` / `DepositBankLogo`.
  · `DepositsPage` (liste) · `NewDepositPage` (wizard : montant→famille→sous-méthode→
    banque/agence→récap, header drill-in, phases libellées, coordonnées Bonzini) ·
    `DepositDetailPage` (action reçu/preuve+countdown, hero XAF, coordonnées, preuve
    strip+upload, suivi, annuler, détails). `DepositInstructions` + `DepositTimelineDisplay`
    re-stylés designKit. `ProofUpload`/`CountdownTimer` réutilisés. Logique 100% préservée
    (bornes **50 000 / 50 000 000** XAF — min dépôt = 50k !, getRecapInfo, create_deposit,
    upload/suppression preuves, annulation, reçu PDF, confirmed_amount_xaf). i18n maquette
    `src/__screenshot__/clientDepositLayout.tsx` (clés `cdep-*`).

- **MODULE WALLET / ACCUEIL — refondu + IMPLÉMENTÉ (maquette validée → vrai code)** :
  `src/pages/WalletPage.tsx` + `src/components/wallet/*` (`BalanceCard`, `QuickActions`,
  `OperationsList`, `WelcomeGreeting`). Carte SOLDE premium **charbon sans dégradé**
  (`card-primary`/gradient supprimé) + œil masquer · actions rapides (Déposer/Payer/
  Bénéficiaires/Historique) · **taux du jour designKit inline** (4 méthodes, `PaymentMethodLogo`,
  `useClientRates` — le `RateCard` partagé admin n'est PLUS importé ici mais reste intact) ·
  activité récente (crédit vert/débit, `useMyWalletOperations`, « Voir tout » → /history).
  Maquette : `src/__screenshot__/clientWalletLayout.tsx` (clés `cwallet-*`). i18n `wallet.*`
  complété (fr+en). Logique préservée (solde, masquage, opérations, taux).

- **MODULE BÉNÉFICIAIRES (carnet) — refondu + IMPLÉMENTÉ (maquette validée → vrai code)** :
  `src/pages/BeneficiariesPage.tsx`. Liste alias-first (`PaymentMethodLogo` réel + alias +
  tag relation + identifiant), recherche, filtres par mode (chips lilas), modifier/archiver
  (archive = soft, snapshot préservé), état vide · éditeur plein écran (drill-in +
  `BeneficiaryForm` déjà refondu + pied Annuler/Enregistrer). Logique 100% préservée
  (create/update/archive, isBeneficiaryFormValid, QR). Maquette `clientBeneficiariesLayout.tsx`
  (clés `cbenef-*`). NB : `EditBeneficiaryPage` (édition bénéf D'UN PAIEMENT) déjà refondu
  lors du module paiements — distinct de ce carnet.

- **MODULE HISTORIQUE — refondu + IMPLÉMENTÉ (maquette validée → vrai code)** :
  `src/pages/HistoryPage.tsx`. Opérations groupées par jour (crédit vert ↙ / débit neutre ↗),
  filtres Tous/Crédits/Débits, bouton Relevé (PDF). Logique 100% préservée : `isDebitOperation`
  (tous types : deposit/payment/refund/admin/adjustment…), groupement par date, libellés i18n
  `history.operationLabels.*`, `generateClientStatement`. Maquette `clientHistoryLayout.tsx`
  (clé `chist-list`).

- **MODULE PROFIL + NOTIFICATIONS — refondu + IMPLÉMENTÉ (maquette validée → vrai code)** :
  `src/pages/ProfilePage.tsx` (carte identité premium sans dégradé + nom entreprise ·
  sections Compte/Préférences avec `LanguageSwitcher`/`ThemeToggle` réels · déconnexion) ·
  `src/pages/NotificationsPage.tsx` (drill-in + tout-marquer-lu, liste designKit par type,
  non-lu = point lilas). NB : `useMyNotifications` est un **stub** (renvoie [] ) → l'écran
  affiche l'état vide tant que le backend notif n'est pas branché (normal, pas un bug). Le
  badge KYC de la maquette n'est PAS rendu (champ absent de `useMyProfile` → remplacé par le
  nom d'entreprise). Maquette `clientProfileLayout.tsx` (`cprofile`, `cnotifs`). i18n
  `profile.section*` (fr+en).

## 4. À FAIRE — dans l'ordre
### 4.1 Modules client restants (même méthode : MAQUETTE → validation client → implémentation)
Taux client →
Support → Auth/Onboarding → **SHELL & nav** (`MobileLayout`/`ClientHeader`/`BottomNav`/
`LiquidTabBar`) **EN DERNIER** (remplacer la « liquid glass » par une nav sobre — ne pas
casser les écrans en route).

## 5. PIÈGES à NE PAS CASSER (détail exhaustif : `docs/refonte-client/01-analyse-paiements.md`)
cash + « me payer moi-même » (pré-rempli, aucun champ) · switch devise XAF↔RMB **vide
l'input** · presets « Tous » = min(solde, 50M) · bornes **10 000 / 50 000 000 XAF** +
`Number.isSafeInteger` · détection de doublon **soft** · « compléter plus tard » →
`waiting_beneficiary_info` · **snapshot bénéficiaire gelé** · **`toStoredPath`** (jamais
d'URL signée en base) · statuts verrouillés (processing/completed/rejected) · taux décimal
stocké en micro-unités (`normalizeRateToInt`).

## 6. Outillage captures
- Vrais écrans client : **`tools/shoot-client-current.mjs`** (amorce une session client +
  intercepte Supabase ; `PORT=8080 node tools/shoot-client-current.mjs`). Lance d'abord
  `npx vite --host 127.0.0.1 --port 8080`.
- Maquettes : harness `screenshot.html?screen=<clé>&theme=<light|dark>&font=dm` +
  `tools/shoot-one.mjs` (`KEY=cpay-detail-v7`). Clés enregistrées dans `src/__screenshot__/main.tsx`.

## 7. Docs liés
`docs/refonte-client/00-plan.md` (plan) · `01-analyse-paiements.md` (analyse + pièges) ·
maquettes `src/__screenshot__/clientPayLayout{V2..V8}.tsx`. PRs ouvertes : #147 (refonte
admin) / #148 (fix flyer) — ne pas confondre avec ce travail client (pas encore de PR client).
