# Analyse — Traçabilité de la chaîne de valeur XAF → USDT → CNY

> **Statut** : Phase 1 terminée — audit lecture-seule de la codebase.
>
> **Légende confiance** :
> - ✅ **Vérifié** : confirmé par lecture directe de la codebase (référence `fichier:ligne`).
> - 🟡 **Supposé** : déduit de l'audit, demande validation rapide.
> - ❓ **À confirmer avec toi** : impact métier ou doctrine.

---

## Doctrine Phase 0 (validée)

| # | Sujet | Décision |
|---|---|---|
| 1 | Valorisation stock USDT | **WAC** |
| 2 | Granularité | **Agrégée (Tier 2)** ; marge par transaction client = Tier 3 |
| 3 | Reconnaissance du gain | **À la vente USDT → CNY** |
| 4 | Cash CNY | **Comptes multiples** + inventaire hebdo |
| 5 | Devise de reporting | **XAF**, soldes natifs par devise |
| 6 | Audit trail | **Append-only**, voiding par contre-écriture |

**Précisions métier validées** :
- Achats USDT : **100 % en XAF**.
- Frais (MM, banque, Binance) : **ignorés en Tier 1/2**.
- Stock CNY effectif : **3 comptes au moins** — `cash_guangzhou`, `alipay_papa`, `wechat_papa`.
- Saisie : moi + père (mobile-first impératif).

---

## 1. Stack & architecture ✅

- **Front** : React 18 + Vite + TypeScript + Tailwind + ShadCN/Radix.
- **Forms** : `react-hook-form` v7 + `zod` v3 (pattern uniforme).
- **State** : TanStack Query v5 avec broadcast cross-tab.
- **Routing** : React Router v6, admin sous `/m/*`, agents cash sous `/a/*`.
- **Backend** : Supabase Postgres + RLS + RPC `SECURITY DEFINER`.
- **Deux clients Supabase isolés** (`src/integrations/supabase/client.ts:10-36`) :
  - `supabase` → storageKey `bonzini-client-auth`
  - `supabaseAdmin` → storageKey `bonzini-admin-auth`
- **Entrée admin** : `src/App.tsx:136-159`.
- **Shell mobile admin** : `src/mobile/components/MobileRouteWrapper.tsx` (tab bar navigation).

**Implication pour le module** : on respecte le pattern existant (forms RHF+Zod, RPC SECURITY DEFINER, `supabaseAdmin` uniquement côté admin), saisie via écrans mobiles dans `src/mobile/screens/`.

---

## 2. Modèle de données existant ✅

**Tables actives** (extraites de `src/integrations/supabase/types.ts`) :

| Table | Champs clés | Type / précision | Notes |
|---|---|---|---|
| `wallets` | `user_id`, `balance_xaf` | `BIGINT` (XAF entier) | Un wallet par client ; mutations via RPC uniquement (RLS SELECT) |
| `ledger_entries` | `wallet_id`, `amount_xaf`, `entry_type`, `metadata JSONB` | `BIGINT` | Append-only ; tout mvt XAF y passe |
| `clients` | `user_id`, email, KYC, UTM | — | Clients consommateurs uniquement |
| `user_roles` | `user_id`, `role`, `is_disabled` | enum | 5 rôles (cf. §6) |
| `deposits` | `amount_xaf`, `method`, `status` | `BIGINT` | Entrée XAF côté client |
| `payments` | `amount_xaf`, `amount_rmb`, `exchange_rate`, `beneficiary_id`, `method` | `BIGINT` / `NUMERIC(15,2)` / `NUMERIC(15,6)` | Sortie CNY côté client |
| `beneficiaries` | `client_id`, `payment_method`, `identifier`, `identifier_type` | — | Destinataires CNY (alipay/wechat/bank/cash) |
| `exchange_rates` | `rate_xaf_to_rmb`, `effective_date` | `DECIMAL(10,6)` | Taux référence journalier |
| `daily_rates` | `rate_cash`, `rate_alipay`, `rate_wechat`, `rate_virement` | **`INTEGER`** ⚠️ | Cf. §3 — dette |
| `rate_adjustments` | `type`, `percentage`, `key` | `DECIMAL(5,2)` | Markup pays/tier |
| `rate_snapshots` | `xaf_ask`, `cny_bid_binance`, `bonzini_rate`, `margin_pct` | numeric / INTEGER | Veille marché |
| `payment_proofs`, `deposit_proofs` | `file_url`, `uploaded_by_type` | — | Justificatifs |
| `payment_timeline_events`, `deposit_timeline_events` | — | — | Event log existant côté payments/deposits |
| `admin_audit_logs` | `admin_user_id`, `action_type`, `target_*`, `details JSONB` | — | Audit applicatif |
| `notifications` | — | — | Pas critique pour nous |

**Tables DROPPED, à ne JAMAIS référencer** :
- `wallet_operations` (`supabase/migrations/20260221300000_drop_legacy_tables.sql:293`)
- `profiles`

**Constat critique pour le module** : aucun objet de modélisation n'existe aujourd'hui pour
- les **fournisseurs USDT** (P2P locaux Cameroun) → table à créer ;
- les **acheteurs USDT** (Binance P2P, Guangzhou) → table à créer ;
- les **comptes Bonzini multi-devises** (USDT pool, cash Guangzhou, Alipay père, WeChat père) → table à créer ;
- les **opérations d'achat/vente USDT** elles-mêmes → tables à créer.

Le modèle actuel ne trace que les extrémités (`deposits` côté client → `payments` côté bénéficiaire). Le **milieu de chaîne est totalement absent**.

---

## 3. Modèle taux / pricing actuel ✅ + ⚠️ dette

**Trois systèmes de taux cohabitent** :

1. **`exchange_rates`** — `DECIMAL(10,6)`, un enregistrement par `effective_date`. Utilisé dans `create_payment()` pour figer le taux XAF/RMB d'une transaction client.
2. **`daily_rates`** — **4 colonnes INTEGER** (`rate_cash`, `rate_alipay`, `rate_wechat`, `rate_virement`). Migration `supabase/migrations/20260303000000` (mars 2026).
   - 🟡 **Supposé** : valeurs entières représentent des XAF/CNY arrondis (ex : 615). Pas de doc sur diviseur.
   - **Dette à arbitrer** : si tu veux jamais des taux fractionnaires (ex 615.25), le schéma est cassé.
3. **`rate_adjustments`** — `DECIMAL(5,2)`, markup pays/tier en pourcentage.

**Ce qui manque pour la traçabilité chaîne** :
- ❌ Aucun taux **XAF/USDT** stocké côté Bonzini (achat fournisseur).
- ❌ Aucun taux **USDT/CNY** stocké côté Bonzini (vente acheteur).
- ❌ Aucun lien entre la chaîne d'approvisionnement réelle et le taux client.

**Décision Phase 3** (à confirmer) : ne pas toucher `exchange_rates` / `daily_rates`. Stocker les taux d'achat USDT et de vente USDT **dans les nouvelles opérations elles-mêmes** (taux implicite = montant_xaf / montant_usdt). Précision cible : `NUMERIC(20,8)`.

---

## 4. Modules admin existants ✅

Tous les écrans admin vivent dans `src/mobile/screens/` :

| Module | Fichier principal | Rôle |
|---|---|---|
| Dashboard | `dashboard/MobileDashboard.tsx` | KPIs jour/semaine |
| Dépôts | `deposits/MobileDepositsScreenV2.tsx`, `MobileDepositDetailV2.tsx` | Workflow XAF entrant |
| Paiements | `payments/MobilePaymentsScreen.tsx`, `MobileNewPayment.tsx`, `MobilePaymentDetailV2.tsx` | Workflow CNY sortant |
| Clients | `clients/MobileClientsScreen.tsx` + Create/Detail/Ledger | CRUD clients + ledger |
| Taux | `more/rates/MobileRatesScreen.tsx` | Saisie taux journaliers |
| Admins | `admins/MobileAdminsScreen.tsx`, `MobileCreateAdmin.tsx` | Gestion admins |
| Historique | `more/MobileHistoryScreen.tsx` | Audit log |
| Agent cash | `agent-cash/` | Flow QR (rôle isolé) |
| Justificatifs | `more/MobileProofsScreen.tsx` | Vue globale proofs |

**Point d'extension naturel** : créer un nouveau dossier `src/mobile/screens/treasury/` (ou `chaine-valeur/`) sans toucher aux modules existants, et ajouter une entrée tab bar (cf. `MobileRouteWrapper`).

---

## 5. RPC / SECURITY DEFINER ✅

Toutes les écritures financières passent par RPC. Patterns à imiter :

| RPC | Migration | Usage |
|---|---|---|
| `create_payment(...)` | `20260304300000` | Paiement CNY client, fige taux |
| `create_admin_payment(...)` | `20260304300000` | Variante admin |
| `confirm_cash_payment(...)`, `scan_cash_payment(...)` | récent | Flow agents cash |
| `cancel_payment(...)` | récent | Annulation sans suppression (audit trail) |
| `validate_deposit(...)` / `reject_deposit(...)` | `20260221300000:10` | Validation dépôt → écriture ledger |
| `admin_adjust_wallet(...)` | `20260111130508` | Ajustement manuel avec entrée ledger |
| `add/update/delete_exchange_rate(...)` | `20251231131714` | Gestion taux référence |
| `create_daily_rates(...)` | `20260303000000:91` | Saisie taux journaliers |
| `get_dashboard_stats()`, `get_client_ledger(...)` | — | Lecture agrégée |
| `is_admin(uuid)`, `is_cash_agent(uuid)` | — | Garde permission |

**Convention forte observée** : pas de DELETE physique, toujours `cancel_*` qui réécrit. Vu aussi dans la migration `20260413000001_cancel_rpcs_no_delete.sql` et `20260413000003_remove_correction_flow.sql`. **Alignement parfait avec notre doctrine 6 (append-only + voiding).**

---

## 6. Permissions & rôles ✅

**Enum `user_roles.role`** (`src/integrations/supabase/types.ts:1254-1259`) :
- `super_admin`, `ops`, `support`, `customer_success`, `cash_agent`.

**Matrice de permissions** (`src/contexts/AdminAuthContext.tsx:31-87`) :
```
canViewClients, canEditClients,
canViewDeposits, canProcessDeposits,
canViewPayments, canProcessPayments,
canManageRates, canViewLogs, canManageUsers
```
Helper : `hasPermission(key)` (`AdminAuthContext.tsx:236-239`). `is_disabled` bloque immédiatement (`AdminAuthContext.tsx:140`, cf. règle sécurité projet).

**Implication module** : 1 ou 2 permissions à ajouter — proposition (à valider Phase 3) :
- `canViewTreasury` (toi, ton père, tout admin lecture)
- `canManageTreasury` (toi, ton père, et `super_admin` uniquement)

**Saisie par le père** : il doit posséder un rôle qui inclut `canManageTreasury`. Vu la sensibilité, soit on lui crée un rôle dédié (`treasurer`), soit on lui donne `super_admin`. À trancher avec toi.

---

## 7. Mobile-friendliness ✅

- L'admin mobile est **déjà mobile-first** : tout passe par `src/mobile/screens/`.
- Forms RHF + Zod, shadcn responsive.
- ❓ **À confirmer** : ton père utilise-t-il l'app sur mobile au quotidien (donc tab bar OK), ou doit-on prévoir un point d'entrée encore plus rapide (raccourci d'accueil) ?

---

## 8. Dette technique bloquante potentielle

| # | Sujet | Impact | Décision |
|---|---|---|---|
| 1 | `daily_rates` INTEGER ⚠️ | Pas de décimales possibles sur taux journaliers | **N'impacte PAS notre module** — on stocke nos propres taux en `NUMERIC(20,8)`. À traiter séparément si tu veux. |
| 2 | Pas de ledger multi-devise | Le ledger XAF actuel ne peut pas tracer USDT/CNY | **On crée des ledgers dédiés** par devise (cf. Phase 3). On ne touche pas `ledger_entries`. |
| 3 | Pas de table contreparties | Aucune notion de fournisseur USDT ni d'acheteur CNY | **À créer** (cœur du module). |
| 4 | `wallets.balance_xaf` BIGINT | OK si XAF entier (pas de centimes XAF en pratique) | ✅ Pas un blocker. |
| 5 | RMB vs CNY terminologie | `payments.amount_rmb` vs futur `cny_account.balance` | 🟡 Anomalie cosmétique. On utilisera **CNY** côté nouveau module ; on **ne renomme pas** l'existant (risque de régression). |
| 6 | Précision `exchange_rates` `(10,6)` | Suffisante pour XAF/CNY (rate ~85-95) | ✅ OK. |

**Aucun blocker dur** : on peut ajouter le module en greenfield à côté de l'existant, sans toucher aux tables critiques.

---

## 9. Points d'extension naturels

**Côté DB** (greenfield) : nouvelles tables (noms provisoires)
- `treasury_counterparties` — annuaire fournisseurs USDT + acheteurs CNY (1 table avec `type`).
- `treasury_accounts` — comptes Bonzini multi-devises (XAF banks, MM, USDT pool, cash Guangzhou, alipay_papa, wechat_papa…).
- `usdt_purchases` — achats USDT en XAF (append-only).
- `usdt_sales` — ventes USDT contre CNY (append-only).
- `treasury_inventory_snapshots` — inventaires hebdo cash CNY.
- `treasury_ledger_entries` — ledger interne multi-devise (parallèle au `ledger_entries` client).
- Vue matérialisée ou fonction `get_wac_usdt()` pour le WAC courant.

**Côté front** :
- Nouveau dossier `src/mobile/screens/treasury/`.
- Écrans cibles : saisie rapide achat USDT, saisie rapide vente USDT, annuaire contreparties, dashboard analytique, écran d'inventaire hebdo.
- Hook(s) `useTreasury*` dans `src/mobile/hooks/`.
- Permission gate `canManageTreasury` / `canViewTreasury`.

**Côté permissions** : 2 nouvelles entrées dans la matrice de `AdminAuthContext.tsx`, ajoutées au rôle `super_admin` + potentiellement nouveau rôle `treasurer` pour le père.

---

## Synthèse Phase 1

**Bonnes nouvelles** :
1. La codebase est saine, patterns uniformes (RHF+Zod, RPC SECURITY DEFINER, append-only récent).
2. Le module peut être **ajouté en greenfield** sans toucher aux tables critiques.
3. La doctrine append-only Phase 0 est **déjà la convention** récente (cf. migrations avril 2026).
4. Mobile-first déjà en place, donc UX de saisie père compatible nativement.

**Points d'attention** :
1. **Anomalie INTEGER sur `daily_rates`** : signalée, n'affecte pas notre module ; à arbitrer séparément.
2. **Pas de notion de contrepartie B2B** dans le modèle existant — on en crée une dédiée pour le module (ne pas réutiliser `clients` ni `beneficiaries`).
3. **Permission du père** : décision à prendre — nouveau rôle `treasurer` ou élargir `super_admin` ? Recommandation : nouveau rôle dédié pour ne pas lui donner le pouvoir de gérer les autres admins.
4. **Précision décimale** : on impose `NUMERIC(20,8)` sur tous les taux et montants USDT/CNY du nouveau module — non négociable.

**Aucun blocker** pour passer en Phase 2 (3 tiers d'ambition).
