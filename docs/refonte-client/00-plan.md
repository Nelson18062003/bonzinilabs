# Refonte app mobile CLIENT — plan & suivi

Objectif : repenser **from scratch** l'app client (disposition, couleurs, icônes, UX/UI),
module après module, en préservant 100 % de la logique métier. Anti-look « généré par IA » :
zéro dégradé, zéro filet dur, couleur réservée au sens, texte large (clients 50+).

## Pourquoi (audit express)
L'app actuelle (`src/pages/` + `src/components/`) repose sur `btn-primary-gradient`,
`card-glass`, `shadow-purple` : dégradés violets omniprésents, verre dépoli, ombres
colorées — exactement le langage qu'on a éradiqué de l'admin. Nav 6 onglets trop dense.

## Méthode (éprouvée sur l'admin)
1. **Direction visuelle** : 3 maquettes réelles du module Paiements (`src/__screenshot__/clientPayDirections.tsx`,
   harness `?screen=cpay-a|b|c`) → choix client → le langage retenu devient le **kit client**.
2. **Kit client** : tokens + composants partagés (réutilise/étend `src/mobile/designKit` si direction A).
3. **Module par module** : Paiements → Dépôts → Wallet/Accueil → Bénéficiaires → Historique →
   Profil/Notifications → Taux client → Support → Auth/Onboarding → Nav (shell).
   À chaque module : captures clair/sombre, `type-check`+`build`, push.

## Directions proposées (maquettes commit du jour)
- **A « Continuité »** — le langage admin validé (canvas lilas, cartes ombre douce, pilule
  charbon, gros tabular-nums), décliné client : plus grand, moins dense, nav 4 onglets.
  → une seule marque, un seul kit à maintenir. **(recommandée)**
- **B « Grand lisible »** — 50+ d'abord : blanc cassé chaud, texte géant (montants 44-46px),
  UNE couleur d'accent (ambre), statuts en français parlé (« Payé au fournisseur »),
  cibles 56-60px, nav 3 onglets libellés.
- **C « Éditoriale ivoire »** — premium print : ivoire, encre, titres Syne, cartes à bordure
  encre, séparateurs pointillés façon reçu/bordereau, ¥ rouge, nav barre encre.

## Module Paiements — logique à préserver à l'identique (~5 500 l)
- Pages : `PaymentsPage` (99) · `NewPaymentPage` (512, wizard 4 étapes) · `PaymentDetailPage` (210)
  · `EditBeneficiaryPage` (253).
- Wizard : `payment-form/` (Method → Amount → Beneficiary → Confirm) + `paymentRateLogic.ts`
  (calculs purs XAF↔RMB) + `paymentSchemas.ts` (zod ; **MIN 10 000 / MAX 50 000 000 XAF**,
  `Number.isSafeInteger`).
- Détail : `payment-detail/` (8 composants : hero, statut+timeline, bénéficiaire, cash QR,
  documents, messages, accordion, drawer QR).
- Preuves : `PaymentProofUpload`/`Gallery` + `usePaymentProofMultiUpload` (bucket `payment-proofs`,
  `validateUploadFile()`).
- Hooks : `usePayments.ts` (694 — useMyPayments/Detail/Timeline/Proofs/**useCreatePayment** →
  RPC `create_payment_for_client`) · `useBeneficiaries.ts` (379, clé naturelle anti-doublon,
  snapshot immuable `beneficiary_details`) · `useClientRates`.
- Statuts : created · waiting_beneficiary_info · ready_for_payment · cash_pending ·
  cash_scanned · processing · completed · rejected.
- Client Supabase : **`supabase`** (jamais `supabaseAdmin`).

## Suivi
- [x] Audit + 3 directions Paiements (captures clair/sombre) — en attente du choix client
- [ ] Kit client (après choix)
- [ ] M1 Paiements (liste · wizard · détail · preuves · bénéficiaire-edit)
- [ ] M2+ : ordre ci-dessus
