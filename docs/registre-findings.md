# Registre des findings — audit produit

Format : `id | module | catégorie | sévérité | preuve | confiance | statut | vérification`.
Statuts : ouvert · corrigé · proposé (attend validation) · wontfix.
Sévérités : P0 parcours cassé / argent faux / perte de données · P1 logique ou données fausses,
navigation cassée, responsive cassé · P2 état manquant, friction · P3 polish.

## Corrigés avant l'ouverture du registre (passes 25–31, branche `claude/bonzini-cargo-logistics-dcxcys`)
| id | module | catégorie | sév. | preuve | confiance | statut | vérification |
|---|---|---|---|---|---|---|---|
| F-001 | Paiements | argent / concurrence | P0 | `supabase/migrations/20260914091000_terminal_status_guards.sql` : `SELECT * INTO v_wallet … ;` sans `FOR UPDATE` dans les deux branches de `process_payment` → `ledger_entries.balance_before` périmé sous concurrence | HAUT | corrigé (migration `20260914093000`, reportée dans le consolidé) | test `moneyRpcGuards.test.ts` (aiguille `WHERE user_id = v_payment.user_id FOR UPDATE`) |
| F-002 | Paiements | logique métier | P1 | `MobileNewPayment.tsx` : `setClient`/`setMode` ne remettaient pas `selectedBenef` à zéro → paiement créé avec le bénéficiaire d'un autre client | HAUT | corrigé (`chooseClient`/`chooseMode`) | relecture ; `benef4Valid` dépend du bénéficiaire du client courant |
| F-003 | Paiements | calcul | P1 | `rate = parseInt(customRateStr) \|\| FALLBACK_RATE` : champ perso vidé → paiement à 11 530 | HAUT | corrigé (`\|\| baseRate` + `customRateValid` bloque « Suivant ») | relecture |
| F-004 | Dépôts | état périmé | P1 | `useEffect([deposit]) → setConfirmedAmount` écrasait la saisie pendant la validation | HAUT | corrigé (effet supprimé ; `openValidate` initialise) | relecture |
| F-005 | Opérations | données | P1 | badge « Opérations » (`useAdminActionableCounts`) ≠ hub (`to_process + pending_correction`) ≠ segments | HAUT | corrigé (`src/lib/actionable.ts`, hub sur les mêmes compteurs) | test `actionableParity.test.ts` |
| F-006 | Statuts | logique métier | P1 | `canPasteProof`, `pasteTarget`, `CashQRCode`, `getDepositSlaLevel` ignoraient `cancelled_by_admin` / `pending_correction` | HAUT | corrigé (`src/lib/terminalStatuses.ts`) | test `terminalStatuses.test.ts` |
| F-007 | Temps réel | données désynchronisées | P1 | `useRealtimeInvalidation.ts` : heuristique `admin-${table}` ne couvrait pas `admin-deposit-proofs`, `deposit-stats`, badges… ; canal client dépendant de `[user]` (mort au refresh du jeton) | HAUT | corrigé (radicaux par table + badges ; `userId` + nom de canal unique) | relecture ; non reproduit en prod (INCONNU) |
| F-008 | Dépôts | pagination | P1 | filtre famille côté client sur une liste paginée serveur → « Aucun dépôt » avec `hasNextPage` | HAUT | corrigé (`params.methods` serveur) | relecture |
| F-009 | i18n | données affichées | P1 | 20 valeurs fr coupées à l'apostrophe (`common.json` : `appTheme: "Thème de l"`, `blockAccess`, `createAdmin`, `exportError`…) | HAUT | corrigé | capture `m/more/settings` |
| F-010 | Support | runtime | P1 | `MobileSupportStatsScreen.tsx` : `stats?.daily_volume.map`, `stats.per_admin.length` → plantage + « undefined » | HAUT | corrigé (`?? []`, `?? 0`) | capture sans `errs` |
| F-011 | Agent cash | i18n | P1 | `AgentCashLogin.tsx` : `language === 'en' ? 'Continue' : '继续'` alors que `language` peut être `'fr'` | HAUT | corrigé (`pick(en, zh, fr)`) | capture `a/login` |
| F-012 | Dépôts | autorisation UI | P2 | fiche dépôt sans `hasPermission('canProcessDeposits')` (le serveur refusait déjà) | HAUT | corrigé | relecture |
| F-013 | Paiements | validation | P1 | `BulkPaymentCreate.tsx` : `amountValid = eXaf >= 1` sans plafond ni entier sûr | HAUT | corrigé (`isValidXafAmount` + cap) | relecture |
| F-014 | Paiements | upload | P2 | QR bénéficiaire sans `validateUploadFile` | HAUT | corrigé | relecture |
| F-015 | Dépôts | UX | P2 | `toast.error('Dépôt rejeté')` sur un succès ; journal d'audit bloquant après création | HAUT | corrigé | relecture |
| F-016 | Support | UX | P2 | `confirm()` natif pour supprimer une réponse / suggestion | HAUT | corrigé (feuille « Garder / Supprimer ») | type-check |
| F-017 | Kit | responsive / a11y | P2 | 37 px chips, 16 px œil, 26 px bascule thème, 8 px marqueurs, curseur 24 px (`index.css:1626` règle mobile) | HAUT | corrigé | audit `tools/audit-mobile.mjs` : 0 cible < 40 hors pseudo-éléments |
| F-018 | Clients | validation | P2 | `MobileCreateClient.tsx` : e-mail jamais vérifié, téléphone `length >= 9` sans nettoyage | HAUT | corrigé | type-check |

## Ouverts / proposés
| id | module | catégorie | sév. | preuve | confiance | statut | note |
|---|---|---|---|---|---|---|---|
| F-019 | Mola | autorisation | P1 | outils de lecture exposés à tous les rôles en service-role (`supabase/functions/admin-assistant`) ; `READ_TOOLS.filter((t) => t.always \|\| perms[t.permission])` rétablirait la garde | MOYEN | proposé | décision produit : Mola doit-il lire tout pour tous ? |
| F-020 | Infra | dette | P2 | edge functions `create-admin`, `create-agent`, `create-client` supprimées du dépôt mais toujours déployées | INCONNU (pas d'accès prod) | proposé | à retirer manuellement |
| F-021 | Paiements | données | P2 | `useAdminPayments.ts` : deux `UPDATE` directs sur `payments` (repli si `admin_update_payment_beneficiary` absente, effacement du QR) contournent la timeline serveur | MOYEN | ouvert | couvert par RLS ; à migrer vers la RPC |
