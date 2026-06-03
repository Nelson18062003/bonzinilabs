# Cartographie des deux systèmes de taux (avant tout nettoyage)

> **Date :** 2026-06-03 · Lecture seule. **Aucune suppression effectuée.** Objectif : y voir clair avant de toucher quoi que ce soit.
> **Verdict :** « c'est mort » était **partiellement faux**. `daily_rates` fait foi ; `exchange_rates` survit pour un **affichage** + des **fichiers orphelins** existent.

## 1. Les deux systèmes, et qui les utilise (vérifié dans App.tsx + le code)

### Système B — `daily_rates` + `rate_adjustments` = LE système vivant qui fait foi ✅
| Usage | Route / fichier |
|---|---|
| **Gérer les taux** (admin) | `/m/more/rates` → `screens/more/index.ts` **ré-exporte** `../rates/MobileRatesScreen` → tabs `RateSetTab` (`create_daily_rates`), `RateConfigTab` (`rate_adjustments`) |
| **Page taux client** | `/rates` → `pages/rates/ClientRatesPage` (daily_rates) |
| **Calcul des PAIEMENTS** | `NewPaymentPage`, `MobileNewPayment` → `calculate_final_rate` |
| **Mola** | `set_daily_rate`, `set_rate_adjustment` |

### Système A — `exchange_rates` = LEGACY, survit pour un seul usage : l'AFFICHAGE
| Usage encore VIVANT | Route / fichier |
|---|---|
| Solde affiché en **RMB** sur le tableau de bord | `/m` → `MobileDashboard` → `useCurrentExchangeRate()` → `balanceRMB = balanceXAF × rate_xaf_to_rmb` |
| Taux courant sur la **fiche client** | `/m/clients/:id` → `MobileClientDetail` → `useCurrentExchangeRate()` |

## 2. Les fichiers ORPHELINS (morts, non routés — supprimables sans risque)
- `src/mobile/screens/more/MobileRatesScreen.tsx` (**46 Ko**, exchange_rates) — l'index ré-exporte depuis `../rates/`, ce fichier local n'est **jamais importé**. Orphelin.
- `src/pages/ClientRatesPage.tsx` (exchange_rates) — référencé **uniquement** dans `App.tsx.backup` (un backup, pas l'app live). Orphelin.
- `useWallet.ts` → `useExchangeRate()` — **aucun appelant**. Mort.

## 3. LE vrai bug que ça révèle (indépendant de Mola) ⚠️
- L'admin modifie les taux sur `/m/more/rates` → ça écrit dans **`daily_rates`**.
- Mais le tableau de bord affiche le solde en RMB via **`exchange_rates`** — une table que **plus aucun écran ne met à jour** (celui qui l'éditait est orphelin).
- **→ Le « ≈ X RMB » montré au client est calculé avec un taux LEGACY figé, déconnecté des vrais taux de paiement.** Le client voit un montant RMB qui ne correspond pas à ce qu'un paiement lui coûterait réellement. Incohérence d'affichage (pas une erreur de transaction, mais trompeur).

## 4. Plan de nettoyage SÛR (ordonné — rien d'irréversible à l'aveugle)
1. **Immédiat, sans risque** (pur code mort, couvert par `npm run build`) : supprimer les 2 fichiers orphelins + le hook `useExchangeRate()` inutilisé.
2. **Petite migration AVANT de toucher la table** : faire calculer le RMB du dashboard + fiche client à partir de **`daily_rates`** (le taux qui fait foi) au lieu d'`exchange_rates`. *(Bonus : corrige le bug §3.)*
3. **Ensuite seulement** : retirer `useExchangeRates.ts` + les fonctions exchange de `useAdminData` + les RPC `add/update/delete_exchange_rate` (qui ne servaient qu'à l'écran orphelin) → **puis DROP `exchange_rates`** (migration, donc réversible si on garde le SQL).
4. `App.tsx.backup` : à supprimer aussi (vestige).

> **Important :** ne PAS faire un `DROP TABLE exchange_rates` maintenant → le dashboard et la fiche client casseraient. L'étape 2 (migration de l'affichage) est obligatoire avant.

## 5. AVANCEMENT
- ✅ **Étape 1 FAITE** — orphelins supprimés : `screens/more/MobileRatesScreen.tsx` (46 Ko), `pages/ClientRatesPage.tsx`, `App.tsx.backup`.
- ✅ **Étape 2 FAITE** — `MobileDashboard` + `MobileClientDetail` calculent désormais le RMB via **`daily_rates`** (`rate_virement / 1 000 000` comme référence d'affichage) au lieu d'`exchange_rates`. **Bug §3 corrigé** : le solde RMB suit enfin le vrai taux.
  - Vérifié : **`tsc --noEmit` exit 0** (imports + types OK ; un import cassé ou un champ absent aurait échoué). `npm run build` non lançable ici (vite absent du sandbox) → à confirmer côté toi, mais le type-check couvre la correction d'imports.
  - `useCurrentExchangeRate` n'a plus aucun appelant (export mort).

## 6. RESTE — étape 3 (pré-DROP, sur ton go)
Avant `DROP TABLE exchange_rates` :
1. Retirer les exports morts : `useCurrentExchangeRate`/`useExchangeRate` (`useWallet`), les fonctions exchange de `useAdminData`, et le hook `useExchangeRates.ts` (+ composants chart `RateChart`/`ResponsiveRateChart`/`RateDateFilter` s'ils ne servaient qu'aux orphelins).
2. Supprimer les RPC `add/update/delete_exchange_rate` (migration).
3. `DROP TABLE public.exchange_rates` (migration — réversible si on garde le SQL).
4. `npm run build` complet pour valider.
→ À faire en une passe dédiée, vérifiée, quand tu dis go.
