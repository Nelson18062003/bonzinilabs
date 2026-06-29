# Analyse profonde — App CLIENT, état actuel (module Paiements)

> Captures réelles de l'app **telle qu'elle est aujourd'hui** (session + données
> simulées, rendu du vrai code) : `shots/client-current-{list,new,detail}-{light,dark}.png`.
> Script : `tools/shoot-client-current.mjs` (amorce une session client + intercepte
> Supabase, zéro réseau réel, aucune modif de source).

## A. Ce qu'on VOIT (constats visuels sur les vrais écrans)

1. **Soupe de couleurs de statuts** — sur la liste, chaque badge a SA couleur vive
   sans système : `En cours` orange, `Effectué` vert, `QR généré` cyan, `En attente`
   jaune (+ bleu/violet/rouge ailleurs). 8 couleurs pleines = bruit, illisible pour 50+.
2. **Look « web2 / IA »** — FAB violet à **dégradé + halo** (`shadow-purple`), cartes à
   bordure fine + ombre, **barre de nav « liquid glass »** (flou + bruit SVG + pilule
   élastique). Exactement le langage qu'on a éradiqué de l'admin.
3. **Violations de la règle de marque** (CLAUDE.md / frontend.md) :
   - Liste : « **Envois** vers la Chine » → interdit (« envoi/envoyer »).
   - Wizard : « **Transfert** vers compte bancaire », « Retrait au bureau » → préférer
     « règlement / paiement fournisseur ».
   - « Comment votre fournisseur reçoit-il **l'argent** ? » → tournure à revoir.
4. **Navigation à 6 onglets** (Wallet · Dépôts · Paiements · Historique · Support ·
   Profil) — trop dense sur mobile, libellés minuscules (10px).
5. **Nav fixe qui chevauche le contenu** sur le détail (le message de statut passe
   sous la barre). Hiérarchie spatiale à revoir.
6. **Incohérence inter-écrans** : la liste et le détail utilisent **deux systèmes de
   badges différents** (`statusColors` bg-* vs `STATUS_BADGE_STYLES`) → mêmes statuts,
   rendus différents.
7. *(artefact dev)* la pastille « île/palmier » en bas à gauche = overlay **lovable-tagger**
   (`mode === development`), **absent en production** — à ignorer.

## B. Le design-system actuel (pourquoi c'est « horrible ») — `src/index.css`

- **Dégradés partout** : `--gradient-hero` / `--gradient-primary` (violet 60%→45/55%),
  appliqués via `.card-primary`, `.btn-primary-gradient`, `.summary-hero-card`.
- **Halos violets** : `--shadow-purple: 0 10px 40px -10px hsl(258 100% 60% / .35)` sur
  cartes ET boutons.
- **Glassmorphisme** : `.card-glass` (backdrop-blur-xl), `.liquid-nav`
  (`blur(24px) saturate(180%)` + `.liquid-nav-noise` texture SVG + `.liquid-nav-tint`
  dégradé) + pilule animée `pillStretch`.
- **Tokens HSL de marque** : `--bonzini-purple: 258 100% 60%` (+ light/dark/glow).
- **Beaucoup d'animations** : slideUp/fadeIn/shake/float/iconBounce/badgePop…
- Mode **sombre supporté** (`.dark` inverse les variables) — à conserver.

➡️ Cible refonte : **kit unifié** (idéalement le designKit Ofspace de l'admin) — canvas
doux, cartes ombre diffuse **sans dégradé ni halo**, **une** couleur par sens, pilule
sombre, gros `tabular-nums`, nav sobre.

## C. Complexité réelle du module (à préserver à 100 %)

### Liste — `src/pages/PaymentsPage.tsx`
États : loading (3 skeletons) · vide (icône + CTA) · liste. Pas de filtres/onglets, pas
de pull-to-refresh (React Query). Ligne = logo méthode + `reference` + badge statut +
date `dd MMM yyyy` + `amount_xaf` + `→ amount_rmb`. FAB `+` → `/payments/new`.

### Wizard — `src/pages/NewPaymentPage.tsx` (+ `payment-form/`)
State machine `method → amount → beneficiary → confirm` + `showSuccess`. Retour =
étape précédente ou `/payments`. Barre de progression 4 segments.
- **Method** : 4 cartes (alipay #1677FF · wechat #07C160 · bank slate · cash #dc2626).
  Changer de méthode **réinitialise** le form bénéficiaire.
- **Amount** : devise **XAF↔RMB** (le switch **vide** l'input), presets
  (`100k/250k/500k/1M` · `1k/2.5k/5k/10k` + « Tous »), **conversion live**, taux affiché
  si `amountXAF ≥ 10 000`, solde + `balanceAfter`, alerte solde insuffisant → `/deposits/new`.
  Bornes **MIN 10 000 / MAX 50 000 000 XAF** + `Number.isSafeInteger`. Calculs purs :
  `computePaymentValues` (`paymentRateLogic.ts`), schémas `paymentSchemas.ts`.
- **Beneficiary** : onglets **existant / nouveau** ; « **me payer moi-même** » (cash self
  = carte read-only pré-remplie depuis le profil, **aucun champ**) ; champs **par méthode**
  (alipay/wechat : alias*+name*+QR/identifiant ; bank : +bank_name*+bank_account* ; cash :
  +phone*) ; **upload QR** (compressé, bucket `payment-proofs`) ; **détection de doublon**
  par clé naturelle (identifier / bank_account ; cash = aucune) → « utiliser celui-ci » ;
  « **compléter plus tard** » (non-cash) → paiement en `waiting_beneficiary_info` ;
  checkbox « ne pas enregistrer au carnet ».
- **Confirm** : récap (logo, ¥, XAF, méthode, taux, bénéficiaire, débité, nouveau solde) +
  avertissement si pas de bénéficiaire (non-cash).
- **Submit** : `useCreatePayment` → RPC `create_payment` (+ UPDATE séparé pour
  `identifier`/`bank_extra`) ; **snapshot bénéficiaire gelé** sur le paiement ; écran de
  succès `variant="client"` (→ voir le paiement / retour wallet).

### Détail — `src/pages/PaymentDetailPage.tsx` (+ `payment-detail/`, 8 composants)
Sections pilotées par le **statut** (`created`, `waiting_beneficiary_info`,
`ready_for_payment`, `cash_pending`, `cash_scanned`, `processing`, `completed`,
`rejected`, `cancelled_by_admin`) :
- **Hero** (toujours) : logo, ¥ (32px), XAF, taux + calcul, date, « Verrouillé », reçu PDF.
- **Cash** : QR à présenter (`cash_pending`) → « scanné » (`cash_scanned`) → signature +
  reçu (`completed`).
- **Bénéficiaire** : éditable (`created`/`waiting`/`ready` → bouton → `/payments/:id/edit-beneficiary`),
  sinon **verrouillé** ; cash = jamais éditable ; champs **copiables** + QR agrandissable.
- **Messages de statut** contextuels ; `client_visible_comment` **prioritaire**.
- **Documents** : preuves admin (read-only) + preuves client (upload si statut
  *uploadable*) ; **accordion** timeline.
- `EDITABLE/LOCKED/UPLOADABLE_STATUSES` dans `payment-detail/types.ts`.

### Édition bénéficiaire — `src/pages/EditBeneficiaryPage.tsx`
Accès depuis le détail ; titre « Ajouter » vs « Modifier » selon présence d'infos ;
**`toStoredPath()`** normalise le QR (jamais persister une URL signée) ; option « aussi
enregistrer au carnet » (non-bloquante).

## D. Logique métier — clients/hooks (jamais réécrire la donnée)
`usePayments` (`useMyPayments/usePaymentDetail/Timeline/Proofs`, `useCreatePayment`,
`useUpdateBeneficiaryInfo`, `useUploadPaymentProof`) · `useWallet` (`useMyWallet`) ·
`useBeneficiaries` (clé naturelle anti-doublon, snapshot immuable) · `useClientRates`
(`useDailyRates`) · `usePaymentProofMultiUpload` · `useNotifications` · `useClientChat`.
Client Supabase **`supabase`** (jamais `supabaseAdmin`). Buckets privés → URL **signées**
(ne jamais stocker l'URL signée : `toStoredPath`).

## E. PIÈGES À NE PAS CASSER (refonte)
1. **Cash + self** : aucune saisie, pré-rempli du profil, snapshot `relation_type:'self'`,
   pas de bouton Modifier.
2. **« Compléter plus tard »** (non-cash uniquement) → `waiting_beneficiary_info`, reste éditable.
3. **Switch de devise vide l'input** ; preset « Tous » = `min(solde, 50M)` (RMB : `floor(maxXAF*rate)`).
4. **Taux** = décimal stocké en **micro-unités** (`normalizeRateToInt`) ; RMB→XAF **tronqué**.
5. **MIN 10 000 / MAX 50 000 000 XAF** + `Number.isSafeInteger` (durs).
6. **Détection doublon = soft** (warning, jamais bloquant ; unicité dure côté DB).
7. **QR** : compresser + `toStoredPath` (jamais d'URL signée en base).
8. **Save carnet en édition** = non-bloquant (échec carnet ≠ échec paiement).
9. **Statuts verrouillés** : pas d'édition/upload (`processing/completed/rejected`).
10. **`client_visible_comment`** prioritaire sur les messages de statut.
11. **2 systèmes de badges** (liste vs détail) → **à unifier** dans la refonte.
12. **CJK** accepté (alias/name/bank_name), longueurs en **caractères**.

## F. Ordre de refonte proposé (module par module)
Paiements (ce doc) → Dépôts (proche) → Wallet/Accueil → Bénéficiaires → Historique →
Profil/Notifications → Taux client → Support → Auth/Onboarding → **Shell & nav** (la nav
sobre remplace la liquid-glass, en dernier pour ne pas casser les écrans en route).
