# PASSATION — Refonte app CLIENT (reprendre ici dans une nouvelle session)

> **Tu es une nouvelle session Claude.** Lis ce doc en entier : il contient tout
> le contexte pour continuer la refonte de l'app **client** sans rien casser.
> Branche de travail : **`claude/stoic-ritchie-Ov4D2`** (tout est poussé).

## 0. Démarrage rapide
1. `git fetch origin claude/stoic-ritchie-Ov4D2 && git checkout -f -B claude/stoic-ritchie-Ov4D2 origin/claude/stoic-ritchie-Ov4D2`
2. Vérifs : `npm run type-check`, `npm run build`. Toujours **commit + push après chaque étape**
   (le conteneur se réinitialise parfois sur un vieux commit `c71d274` ; si ça arrive,
   refais l'étape 1 pour restaurer — rien n'est perdu, tout est sur origin).
3. **Prochaine tâche = implémenter la FICHE de paiement** (voir §4).

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

## 4. À FAIRE — dans l'ordre
### 4.1 FICHE de paiement (PROCHAINE ÉTAPE) — structure « v7 »
Cible (maquette validée = `src/__screenshot__/clientPayLayoutV7.tsx`, harness
`?screen=cpay-detail-v7` ; voir aussi `clientPayLayoutV6.tsx`) :
1. **« Télécharger le reçu » TOUT EN HAUT** (sous la référence, avant le montant) — pour un
   paiement terminé ; pour un paiement « à compléter », mettre à la place l'**action rouge**
   en tête (« Compléter les coordonnées »).
2. **Montant HÉROS** : gros **¥ RMB** (≈58px) en exergue, « Vous avez payé X XAF » dessous,
   et **taux** en bloc lilas « **1 000 000 XAF = 11 350 ¥** ».
3. **Bénéficiaire** (intitulé) **nuancé par méthode** : Alipay/WeChat = QR (cliquable) + nom
   du fournisseur + nom du compte + identifiant (Alipay ID/email/téléphone) ; Banque = banque
   + compte + titulaire + SWIFT ; Cash = nom + téléphone. (Champs déjà gérés par
   `payment-detail/PaymentBeneficiarySection.tsx` + `CopyableField` — à réorganiser.)
4. **Suivi** (timeline) : 4 étapes (créé · coordonnées du bénéficiaire · traitement Bonzini ·
   bénéficiaire payé), construites depuis le statut via `paymentLifecycle()` (step/kind) ;
   l'étape en cours porte l'action si « todo » (rouge). **Descendu** sous le bénéficiaire.
5. **Preuve & détails** (regroupés en un bloc) : « Preuve de paiement » = image **cliquable**
   (preuve ajoutée par Bonzini, `PaymentQrViewerDrawer`/gallery) + lignes Référence / Méthode /
   Créé le / Payé le.
- Rythme « **intitulé → bloc** » (comme le module Taux admin), montant = focal, moins de
  boîtes flottantes. Drill-in `showNav={false} showHeader={false}`.
- Fichiers réels : `src/pages/PaymentDetailPage.tsx` (orchestrateur) + `src/components/payment-detail/*`
  (`PaymentHeroCard`, `PaymentBeneficiarySection`, `PaymentCashSection`, `PaymentStatusCard`,
  `PaymentStatusMessages`, `PaymentDocumentsSection`, `PaymentDetailsAccordion`,
  `PaymentQrViewerDrawer`, `types.ts` avec `isStatusEditable/Locked/Uploadable`,
  `normalizeRateToInt`). **Préserver** reçu PDF (`handleDownloadReceipt`), upload preuves,
  copie, QR, timeline (`buildPaymentTimelineSteps`).

### 4.2 FORMULAIRE de création (wizard) — aligner sur la structure/le langage v8
`src/pages/NewPaymentPage.tsx` (orchestrateur) + `src/components/payment-form/*`
(`NewPaymentMethodStep`, `NewPaymentAmountStep`, `NewPaymentBeneficiaryStep`,
`NewPaymentConfirmStep`, `StepProgressBar`, `SuccessScreen`, `PaymentMethodCard`,
`paymentRateLogic.ts`, `paymentSchemas.ts`). Déjà en Direction A ; à peaufiner structure.
**NE PAS** partir sur le « débit immédiat / création express » : le client l'a écarté.

### 4.3 Ensuite, autres modules client (même méthode)
Dépôts → Wallet/Accueil → Bénéficiaires → Historique → Profil/Notifications → Taux client →
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
