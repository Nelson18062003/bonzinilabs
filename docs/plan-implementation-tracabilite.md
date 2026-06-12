# Plan d'implémentation — Module traçabilité (Phase 4)

> **Statut** : en attente de validation utilisateur. **Aucun code écrit tant que cette phase n'est pas validée.**
> **Effort total estimé** : **42-52 heures** réparties en **6 lots**.

---

## Vue d'ensemble des lots

| # | Lot | Effort | Dépend de | Livrable user-visible |
|---|---|---|---|---|
| 0 | Fix dette `daily_rates` INTEGER → NUMERIC | 3-4h | — | Saisie de taux décimaux possible |
| 1 | Schéma DB (6 tables + RLS + vue + seed comptes) | 6-8h | Lot 0 | Tables vides en prod, aucune UI |
| 2 | Rôle `treasurer` + permissions | 2-3h | Lot 1 | Création compte père avec rôle |
| 3 | RPCs SECURITY DEFINER + tests SQL | 8-10h | Lot 1, Lot 2 | API métier prête, testée en SQL |
| 4 | UI saisie (achats, ventes, contreparties, comptes) | 12-15h | Lot 3 | **Tu peux commencer à saisir.** |
| 5 | UI dashboard, réconciliation, historique, voiding | 10-13h | Lot 4 | **Tous les rapports livrés.** |

**Total : 41-53h. Cible 45h.**

Critère de validation **commun à tous les lots** : `npm run type-check` + `npm run build` OK + scénario manuel passé sur l'environnement de dev avant merge.

---

## Lot 0 — Fix dette `daily_rates` (3-4h)

### Pourquoi en premier
Si on ne le fait pas avant le Lot 3, l'algo de mapping taux ref CNY/XAF qui lit `daily_rates` ne peut pas représenter de taux décimal (ex: 88,5). Donc lot 0 obligatoire.

### Tâches Claude
1. Migration `supabase/migrations/<ts>_treasury_fix_daily_rates_precision.sql` :
   - `ALTER TABLE daily_rates ALTER COLUMN rate_cash TYPE numeric(10,4) USING rate_cash::numeric;`
   - idem `rate_alipay`, `rate_wechat`, `rate_virement`.
2. Adapter RPC `create_daily_rates(...)` (signature INTEGER → NUMERIC).
3. Adapter `src/mobile/screens/more/rates/MobileRatesScreen.tsx` (input `step="0.0001"`, parsing décimal).
4. Régénérer `src/integrations/supabase/types.ts`.
5. Vérifier que `MobilePaymentDetailV2` et autres consommateurs des `daily_rates` gèrent les nouvelles valeurs.

### Tâches user (toi)
- Valider visuellement la saisie de `615.5` sur l'écran taux.
- Confirmer qu'aucun écran client n'affiche les taux de façon cassée (ex: `Number.toFixed(0)` ailleurs).

### Critères de validation
- Saisie d'un taux décimal possible, restitué correctement.
- Aucun paiement existant n'a sa valeur RMB cassée.
- `npm run type-check` + `npm run build` OK.

### Risque
- Migration `USING ::numeric` est non destructive sur les valeurs entières existantes. Pas de risque de perte de donnée.

---

## Lot 1 — Schéma DB + RLS + seed (6-8h)

### Tâches Claude
1. Migration `<ts>_treasury_schema.sql` :
   - Enums : `treasury_counterparty_type`, `treasury_currency`, `treasury_account_kind`, `treasury_channel_xaf`, `treasury_ledger_entry_kind`, `treasury_ledger_source_table`.
   - 6 tables (cf. design §A).
   - Indexes.
   - Vue `treasury_account_balances`.
   - **Policies RLS strictes** :
     - SELECT permis si `is_super_admin(auth.uid()) OR is_treasurer(auth.uid())` (Lot 2 ajoute `is_treasurer`).
     - INSERT/UPDATE/DELETE : refusés à tous → tout passe par RPC SECURITY DEFINER (Lot 3).
   - Seed 10 comptes (cf. §J.1 du design).
2. Régénération `types.ts`.

### Tâches user
- Confirmer noms/labels d'affichage des comptes (j'utilise par défaut "Afriland", "UBA Cameroun", "Ecobank", "CCA", "MTN MoMo", "Orange Money", "USDT Pool", "Cash Guangzhou", "Alipay Papa", "WeChat Papa"). Tu peux ajuster.

### Critères de validation
- `SELECT * FROM treasury_accounts;` retourne 10 lignes après migration.
- `INSERT INTO treasury_ledger_entries ...` direct depuis client (non-RPC) → **refusé par RLS**.
- `npm run type-check` + `npm run build` OK.

---

## Lot 2 — Rôle `treasurer` + permissions (2-3h)

### Tâches Claude
1. Migration `<ts>_treasury_role_treasurer.sql` :
   - `ALTER TYPE user_role ADD VALUE 'treasurer';`
   - Helper `is_treasurer(uuid) RETURNS boolean SECURITY DEFINER` (exclut `is_disabled`).
   - Mise à jour des policies RLS Lot 1 (les SELECT autorisent désormais `is_treasurer`).
2. Mise à jour `src/contexts/AdminAuthContext.tsx` :
   - Ajout permissions `canViewTreasury`, `canManageTreasury` dans `RolePermission`.
   - Affectations matrice (cf. design §G).
3. Régénération `types.ts`.

### Tâches user
- Créer le compte admin de ton père avec le rôle `treasurer` (via écran `MobileCreateAdmin`). Je documente la procédure exacte dans le PR.
- Tester la connexion du père : doit voir l'onglet "Trésorerie" (qui sera vide jusqu'au Lot 5 mais l'onglet doit apparaître), pas d'accès aux autres modules sensibles (gestion admins, etc.).

### Critères de validation
- `is_treasurer(uuid_pere)` retourne `true`.
- `is_admin(uuid_pere)` retourne ? **À confirmer avec toi** : le rôle `treasurer` est-il considéré comme "admin" au sens `is_admin()` ? Recommandation : oui (pour qu'il puisse se connecter à l'app admin) mais avec permissions restreintes.

---

## Lot 3 — RPCs SECURITY DEFINER (8-10h)

### Tâches Claude
1. Migration `<ts>_treasury_rpcs.sql` avec 7 fonctions :
   - `record_usdt_purchase(...)`
   - `record_usdt_sale(...)`
   - `record_inventory_snapshot(...)`
   - `void_treasury_operation(...)`
   - `get_wac_usdt(at_time)`
   - `get_treasury_dashboard(from_date, to_date)` → JSONB des 13 indicateurs
   - `get_top_counterparties(type, from_date, to_date, limit)`
2. Chaque RPC commence par garde permission (`is_treasurer OR is_super_admin`, voiding = super_admin seul).
3. Chaque mutation insère 1 ligne `admin_audit_logs`.
4. Tests SQL inline (`-- TEST` blocks) qui simulent achat/vente/inventaire et vérifient les soldes attendus.

### Tâches user
- Aucune ; je valide par tests SQL avant Lot 4.

### Critères de validation
- Scénario reproductible en SQL :
  1. Achat 1000 USDT pour 625k XAF → solde XAF compte = -625k, solde USDT pool = +1000, WAC = 625.
  2. Achat 500 USDT pour 320k XAF → WAC = 630.
  3. Vente 800 USDT contre 5600 CNY sur cash_guangzhou → solde USDT = 700, solde cash_guangzhou = 5600, `wac_at_sale` = 630.
  4. Inventaire cash_guangzhou avec actual=5550 → variance=-50, motif obligatoire, écriture d'ajustement.
  5. Void de l'achat #2 → 2 contre-écritures, soldes reviennent à (+625k XAF, 1000 USDT, WAC = 625).
- `get_treasury_dashboard(...)` retourne les valeurs attendues sur le scénario.

### Risque
- Le calcul `get_wac_usdt(at_time)` rejoue tout l'historique USDT. À ~10k ops/an, scan séquentiel < 50ms. Si volumétrie explose, prévoir Lot 7 (cache).

---

## Lot 4 — UI saisie (12-15h)

### Tâches Claude
1. Nouvelle entrée tab bar dans `src/mobile/components/MobileRouteWrapper.tsx` (visible si `canViewTreasury`).
2. Nouveau dossier `src/mobile/screens/treasury/` avec :
   - `MobileTreasuryHome.tsx` — squelette dashboard (KPIs placeholder ; sera rempli au Lot 5).
   - `purchases/MobileNewPurchase.tsx` — formulaire RHF+Zod (cf. wireframe E.3).
   - `sales/MobileNewSale.tsx` — formulaire RHF+Zod (cf. wireframe E.4) avec affichage WAC live + marge prévisionnelle.
   - `counterparties/MobileCounterpartiesScreen.tsx` + `MobileCounterpartyDetail.tsx` + `MobileNewCounterparty.tsx`.
   - `accounts/MobileAccountsScreen.tsx` + `MobileAccountDetail.tsx` (ledger filtré).
3. Hooks dans `src/mobile/hooks/treasury/` : `useTreasuryAccounts`, `useTreasuryCounterparties`, `useRecordUsdtPurchase`, `useRecordUsdtSale`, `useGetWacUsdt`.
4. Routes dans `App.tsx`.

### Tâches user
- **Saisie de test** : 3 achats USDT + 3 ventes USDT + création de 3 contreparties + vérification soldes.
- Validation UX : la saisie est-elle assez rapide pour ton père sur mobile ?

### Critères de validation
- Un achat USDT enregistré apparaît immédiatement dans l'historique du compte XAF débité et du pool USDT.
- Vente avec stock insuffisant : warning affiché mais soumission acceptée.
- Création contrepartie depuis le formulaire d'achat (inline) fonctionne.
- Build + type-check OK.

---

## Lot 5 — UI dashboard + réconciliation + historique + voiding (10-13h)

### Tâches Claude
1. `MobileTreasuryHome.tsx` complet avec les 13 indicateurs (consomme `get_treasury_dashboard`).
2. Composants graphiques (recharts déjà dans `package.json` ? **à confirmer** — sinon, ajouter ou utiliser SVG natif).
3. `inventory/MobileInventoryScreen.tsx` + `MobileInventoryForm.tsx` — réconciliation hebdo par compte.
4. `operations/MobileOperationsHistory.tsx` — feed unifié filtrable.
5. `operations/MobileVoidOperation.tsx` — modale de voiding (super_admin seul).
6. Sélecteurs de période (7j / 30j / mois en cours / custom).
7. Hooks : `useTreasuryDashboard`, `useInventorySnapshot`, `useVoidTreasuryOperation`.

### Tâches user
- Validation finale du module : tester un cycle complet sur 1 semaine de données simulées.
- Confirmer que les rapports répondent à ton besoin opérationnel.

### Critères de validation
- Les 13 indicateurs (cf. doctrine Phase 0) s'affichent et sont cohérents avec les données saisies.
- Bouton "Annuler" visible uniquement pour ton compte (super_admin), absent pour le père.
- Inventaire avec variance ≠ 0 sans motif → soumission bloquée.
- Build + type-check OK.

---

## Synthèse répartition Claude / user

### Ce que Claude livre
- Code : migrations SQL, RPCs, hooks React Query, écrans, types régénérés.
- Tests SQL inline dans les migrations RPC.
- PR par lot avec checklist de validation et scénario de test.

### Ce que toi tu fais
1. **Lot 0** : valider la saisie d'un taux décimal sur l'écran rates.
2. **Lot 1** : valider la liste des labels comptes (10 lignes).
3. **Lot 2** : créer le compte admin du père avec rôle `treasurer`.
4. **Lot 3** : aucune action (tests internes Claude).
5. **Lot 4** : saisir 3 achats + 3 ventes + 3 contreparties de test, valider UX.
6. **Lot 5** : tester le dashboard sur 1 semaine simulée, valider rapports.

### Décisions de structure git
- Une branche par lot (`claude/treasury-lot-0`, etc.) ? Ou tout sur la branche `claude/multi-currency-payments-accounting-JZgL4` avec commits successifs ?
- **Ma reco** : tout sur la branche actuelle, **un commit par lot**, je te livre un récap entre chaque lot pour validation. Si tu préfères PR distinctes pour pouvoir reviewer chaque lot indépendamment, on bascule sur PR multi-lots.

---

## 3 questions pour passer en Phase 5

1. **`is_treasurer` doit-il être considéré comme `is_admin` ?** (impact : connexion app admin du père OK ou pas). Ma reco : oui.
2. **Recharts ou autre lib graphique** pour le dashboard Lot 5 ? Si déjà présent on l'utilise, sinon SVG natif (zéro dépendance). Je vérifierai au début du Lot 5.
3. **Stratégie git** : un commit par lot sur la branche actuelle, ou PR par lot ? Ma reco : commit par lot, branche actuelle, je te livre récap entre chaque lot.

Réponds-moi sur ces 3 points et **je démarre le Lot 0**.
