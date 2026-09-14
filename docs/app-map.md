# Carte de l'application — Bonzini Labs

Construite par inspection (itération 0 de l'audit), le 14 sept. 2026.
Chaque affirmation vient d'un fichier lu ; les chiffres sont ceux du dépôt.

## Stack réel
- React 18.3 + Vite + TypeScript, Tailwind 3.4, framer-motion, react-router 6.
- Données : Supabase (Postgres + RLS + RPC `SECURITY DEFINER`, Storage, Realtime, Edge Functions Deno).
  Deux clients isolés : `supabase` (app client, storageKey `bonzini-client-auth`) et `supabaseAdmin`
  (admin, `bonzini-admin-auth`) — `src/integrations/supabase/client.ts`.
- État serveur : TanStack Query v5. **Invariant important** : `src/lib/queryClient.ts:43` — le
  `MutationCache` global invalide TOUTES les queries après chaque mutation réussie. Les
  « invalidations manquantes » ne sont donc jamais un bug dans le même onglet ; seule la
  fraîcheur temps réel (autres acteurs) dépend de `src/hooks/useRealtimeInvalidation.ts`.
- i18n : i18next, `fallbackLng: 'fr'`, 9 espaces de noms (`src/i18n/*.ts`). Locales fr/en/zh.
- PDF : jsPDF (reçus, étiquette colis) ; cartes : MapLibre ; graphiques : recharts.
- Tests : vitest, 53 fichiers / 632 tests (`npm run test`). Type-check : `tsc -p tsconfig.app.json`.
- Captures : `tools/audit-mobile.mjs` sur un serveur Vite `SCREENSHOT_MOCK=1` (port 8093),
  fixtures `tools/adminFixtures.mjs` + `src/__screenshot__/mock*.ts`.

## Les quatre surfaces (routes dans `src/App.tsx`)
| Surface | Préfixe | Auth | Écrans |
|---|---|---|---|
| App client (importateurs) | `/` | `AuthContext` (client) | `src/pages/*` : portefeuille, dépôts, paiements, bénéficiaires, historique, mon code, support, profil, taux, onboarding |
| Admin mobile | `/m/*` | `AdminAuthContext` + `ProtectedAdminRoute` | `src/mobile/screens/*` (15 modules) via `AdminRouteWrapper` |
| Admin desktop | mêmes routes `/m/*`, prop `desktop={…}` | idem | `src/desktop/screens/*` (11 modules) |
| Agent cash (remise d'espèces en Chine) | `/a/*` | `AgentCashRouteWrapper` | `src/mobile/screens/agent-cash/*`, langues en/zh/fr |

Navigation admin mobile : barre à 5 onglets (`MobileTabBar`) — Mola · Cargo · Opérations · Clients · Plus.
« Plus » ouvre : tableau de bord, taux, trésorerie, justificatifs, historique, notifications, veille
macro, messages clients, réponses toutes faites, suggestions, administrateurs, paramètres
(thème, passkeys, mot de passe, expédition), profil.

## Modules et frontières
| Module | Écrans (mobile) | Hooks | Serveur (RPC / tables) |
|---|---|---|---|
| Opérations · Dépôts | `deposits/MobileDepositsScreenV2`, `MobileDepositDetailV2`, `new-deposit/MobileNewDepositV2` | `useAdminDeposits`, `usePaginatedDeposits`, `useAdminUploadProofs` | `create_client_deposit`, `submit_deposit_proof`, `validate_deposit`, `reject_deposit`, `cancel_deposit`, `get_deposit_stats` ; tables `deposits`, `deposit_proofs`, `deposit_timeline_events` |
| Opérations · Paiements | `payments/MobilePaymentsScreen`, `MobilePaymentDetailV2`, `MobileNewPayment`, `BulkPaymentCreate`, `BulkPaymentDetail`, `MobileBeneficiaryEdit` | `usePayments`, `usePaginatedPayments`, `useAdminPayments`, `usePaymentBatches`, `useBeneficiaries` | `create_admin_payment`, `create_payment_batch`, `process_payment`, `cancel_payment`, `admin_update_payment_beneficiary`, `delete_payment_proof` ; `payments`, `payment_proofs`, `payment_batches` |
| Chaîne cash | `agent-cash/*` | `useAgentCashPayments`, `useAgentCashActions`, `useCashPayment` | `scan_cash_payment`, `confirm_cash_payment` (signature) |
| Portefeuille / grand livre | fiche client, historique client, ajustements | `useWallet`, `useClientManagement`, `AdjustmentDrawer` | `admin_adjust_wallet`, `create_wallet_adjustment`, `check_wallet_reconciliation` ; `wallets` (SELECT-only), `ledger_entries`, `wallet_adjustments` |
| Clients | `clients/*` (liste, fiche, création, scan, bénéficiaires, historique) | `useClientManagement`, `useClientPhones`, `useAdminDeleteClient` | `admin_create_client`, `admin_setup_client`, `admin_delete_client`, `admin_reset_client_password`, `find_client_by_customer_code` ; `clients`, `client_phones`, `beneficiaries` |
| Auth admin | `auth/MobileLoginScreen`, passkeys, mot de passe | `AdminAuthContext`, `lib/passkey` | `is_admin`, `admin_has_permission`, `user_roles`, `webauthn_*` ; edge `passkey` |
| Cargo | `cargo/*` (flotte, dossier à onglets, suivi, carte, coût à quai) | `useCargo` | `add_cargo_shipment`, `request_cargo_lookup`, `request_cargo_sync`, `cargo_set_*` ; `cargo_*` (6 tables) ; edge `cargo-lookup`, `cargo-sync` |
| Taux | `rates/*` (fixer, simulateur, config, historique) | `useDailyRates` | `create_daily_rates`, `delete_daily_rate`, `calculate_final_rate` ; `daily_rates`, `rate_adjustments`, `rate_suggestions` ; edge `suggest-daily-rates`, `monitor-rates` |
| Trésorerie | `treasury/*` (soldes, achats/ventes USDT, contreparties, comptes, inventaire, analyse) | `useTreasury` | `adjust_treasury_account`, `create_treasury_counterparty`… ; `treasury_*`, `usdt_purchases`, `usdt_sales` |
| Support chat | `support/*` (conversations, stats, réponses, suggestions) | `useAdminChat`, `useCannedResponses`, `useAdminQuickReplies` | `assign/claim/close_chat_conversation`, `admin_*_canned_response`, `admin_*_quick_reply` ; `chat_*` ; edge `notify-admin-chat` |
| Mola (assistant) | `assistant/MobileAssistantScreen` | `useAdminAssistant` (SSE) | edge `admin-assistant` (outils découverts par étiquette `@mola` sur les RPC) ; `assistant_*`, `mola_*` |
| Tableau de bord / analytics | `dashboard/*`, `analytics/*` | `hooks/analytics/*` | vues et RPC de stats ; edge `generate-report-pdf` |
| Notifications / e-mail / SMS | `more/MobileNotificationsScreen` | `useAdminNotifications` (`src/lib/actionable.ts`) | `notifications`, `email_outbox`, `sms_outbox` ; edge `send-email`, `send-sms`, `notify-admin` |
| Edge functions internes (cron / bot) | — | — | `send-brief`, `fetch-macro`, `predict-rate`, `monitor-rates`, `generate-report-pdf`, `generate-receipt`, `generate-flyer`, `telegram-bot`, `notify-admin-assignment` ; gardées : `passkey`, `send-email`, `send-sms`, `telnyx-webhook`, `resend-events`, `notify-admin`, `cargo-*`, `admin-assistant` |

## Statuts (source : `src/integrations/supabase/types.ts`)
- Dépôt : created → awaiting_proof → proof_submitted → admin_review → validated | rejected | pending_correction ; cancelled, cancelled_by_admin.
  Terminaux (`src/lib/terminalStatuses.ts`) : validated, rejected, cancelled, cancelled_by_admin.
- Paiement : created → waiting_beneficiary_info → ready_for_payment → processing → completed | rejected ; cash_pending → cash_scanned ; cancelled_by_admin.
  Terminaux : completed, rejected, cancelled_by_admin. « Attend un opérateur » (`src/lib/actionable.ts`) : ready_for_payment, cash_scanned, processing.
- Rôles : super_admin, ops, support, customer_success, cash_agent, treasurer — matrice `ROLE_PERMISSIONS`
  (`src/contexts/AdminAuthContext.tsx`) miroir SQL `admin_has_permission` (test `rolePermissionParity`).

## Invariants métier à protéger (règles `.claude/rules/*.md`)
- Toute mutation de portefeuille passe par une RPC `SECURITY DEFINER` gardée par `admin_has_permission`, avec `SELECT … FOR UPDATE` avant lecture-écriture (double dépense, `balance_before` du grand livre).
- Montants `> 0`, entiers sûrs, plafond de saisie 50 M XAF sur les formulaires (pas de plafond serveur).
- Statuts terminaux : `rejected` et `cancelled_by_admin` ont déjà recrédité — jamais rouverts.
- Admin désactivé : `is_disabled` filtré à chaque lecture de rôle (le JWT survit).
- Tables supprimées : `profiles`, `wallet_operations` — ne jamais les requêter.

## Ordre des cibles proposé (P0/P1 d'abord, argent et parcours critiques avant le polish)
1. Paiements (création → traitement → validation/refus, chaîne cash, lot).
2. Dépôts (création → preuve → validation/refus, annulation, corrections).
3. Portefeuille et grand livre (ajustements, réconciliation, historique client).
4. App client `/` (le parcours de l'importateur : dépôt, paiement, bénéficiaires, portefeuille).
5. Auth admin et rôles (connexion, OTP, passkeys, admin désactivé, garde des écrans).
6. Clients (création, modification, suppression, identifiant client, étiquette colis).
7. Cargo (ajout, suivi, papiers, coûts, carte).
8. Taux (fixation, suggestions, simulateur, historique).
9. Trésorerie.
10. Support chat, Mola, notifications, tableau de bord.
11. Réglages, profil, passkeys, expédition — polish.
