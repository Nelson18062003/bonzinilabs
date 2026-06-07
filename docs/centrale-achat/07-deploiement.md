# Phase 7 — Runbook de déploiement (centrale d'achat)

> **But :** passer le module de « build-ahead » (tout écrit, rien déployé) à **opérationnel en
> production**, sans casse. Toutes les migrations sont **additives** (nouvelles tables/enums/rôle/
> bucket/fonctions) — elles **ne touchent pas** l'existant (`wallets`, `ledger_entries`, `payments`,
> `clients`, `user_roles` hors ajout d'une valeur d'enum).
>
> **Légende :** 🟢 sûr/additif · 🟡 à vérifier · 🔴 action humaine requise.

---

## 0. Pré-requis
- Accès au projet Supabase `fmhsohrgbznqmcvqktjw` (CLI liée : `supabase link` déjà fait, ou
  `SUPABASE_ACCESS_TOKEN` en variable d'env).
- Branche `claude/keen-franklin-aGpja` fusionnée (ou déployée depuis cette branche).

## 1. Appliquer les migrations 🟢
Les **5 migrations** s'appliquent dans l'ordre des timestamps (le CLI le fait automatiquement) :

| Ordre | Fichier | Contenu | Risque |
|---|---|---|---|
| 1 | `…101000_procurement_schema.sql` | 23 enums, 10 tables `proc_*`, helper `can_access_procurement`, vue `proc_po_balances`, refs `BZ-*`, RLS SELECT-only | 🟢 additif |
| 2 | `…101001_procurement_role.sql` | `ALTER TYPE app_role ADD VALUE 'sourcing_agent'` + `is_sourcing_agent()` | 🟢 additif (ADD VALUE non destructif, PG15) |
| 3 | `…101002_procurement_storage.sql` | bucket privé `procurement-docs` + 4 policies | 🟢 additif |
| 4 | `…101003_procurement_rpcs.sql` | 13 RPC d'écriture `@mola` | 🟢 additif |
| 5 | `…101004_procurement_read_rpcs.sql` | 8 RPC de lecture `@mola` | 🟢 additif |

```bash
npx supabase db push --linked
```
**Vérif :** la commande applique 5 fichiers sans erreur. Point de vigilance unique : `ALTER TYPE …
ADD VALUE` ne doit pas être « utilisé » comme littéral dans la même transaction — ici les helpers
comparent en `role::text`, donc **aucun souci** (déjà éprouvé par le rôle `treasurer`).

## 2. Régénérer les types 🟢
```bash
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
npm run type-check && npm run build
```
La couche d'accès écrite à la main (`procurement.ts`) **reste valide** : `callProcRpc` caste `rpc`, donc
même typé, rien ne casse. Le `type-check` doit rester à 0 erreur.

## 3. Donner le rôle au père 🔴 (action humaine)
Le père **cumule** `treasurer` (déjà présent) **+** `sourcing_agent`. Il faut **ajouter une ligne**
`user_roles` (le front gère désormais le multi-rôle). Remplacer `<USER_ID_DU_PERE>` :
```sql
insert into public.user_roles (user_id, role, first_name, last_name, is_disabled)
select user_id, 'sourcing_agent', first_name, last_name, false
from public.user_roles
where user_id = '<USER_ID_DU_PERE>'
order by created_at
limit 1
on conflict (user_id, role) do nothing;
```
> Pour un **nouvel** agent sourcing (pas le père), créer le compte via l'app admin
> (« Administrateurs » → nouveau) puis lui poser le rôle `sourcing_agent`.

**Vérif :** à la connexion, le père voit l'entrée **« Centrale d'achat »** dans *Plus*, **et garde** la
Trésorerie (permissions fusionnées).

## 4. Vérifications post-déploiement 🟡
- **RLS** : un compte sans rôle procurement ne voit rien (les écrans redirigent vers `/m/more`).
- **Bucket** : `procurement-docs` existe (privé) dans Storage.
- **Mola** : « quelles actions centrale d'achat ? » → Mola découvre les RPC `@mola` (via
  `find_capability`). Tester une écriture dictée simple (ex. « crée une mission pour … »).
- **Parité** : ajouter les entrées procurement à `eval/assistant/parity.manifest.ts` quand des
  **outils dédiés** existeront (pour l'instant les RPC passent par `do_capability` générique → rien à
  ajouter, le test reste vert).

## 5. Smoke test (parcours réel) 🟡
1. *Plus → Centrale d'achat* → **Missions → + Mission** (choisir un client) → créée.
2. Détail mission → **+ Commande** (chercher/créer un fournisseur, total, acompte) → créée.
3. Détail commande → **+ Ligne** (produit, qté, prix) → **+ Paiement** (acompte, espèces, date) →
   le **reste à payer** se met à jour ; l'avertissement « pas de QC » s'affiche pour un solde.
4. **+ QC** (PSI conforme), **+ Production**, **+ Commission**, **+ Preuve** (photo).
5. Détail mission → **bouton partage** → le **PDF** se génère et se partage (WhatsApp/email).
6. Control tower → reste-à-payer + alertes cohérents.

## 6. Catch-up mai 2026 (opérationnel)
Une fois le smoke test OK, saisir la **vraie mission de mai 2026** (fournisseurs, commandes, acomptes
rétro-datés, commissions, preuves) → générer le **rapport PDF**. C'est la douleur initiale résolue.

## 7. Reste (post-déploiement)
- Lien **rail** (Cas 2) : picker de paiement sur `MobileRecordPayment` (MVP = attestation, suffisant).
- **Outils Mola dédiés** (`tool` dans l'étiquette) si on veut des cartes de confirmation riches.
- **Eval procurement** (`eval/assistant/`) une fois les types régénérés.

---

## Rollback
Module 100 % additif → pour désactiver : retirer l'entrée de menu (front) suffit. Les tables `proc_*`
peuvent rester (vides, sans impact). La valeur d'enum `sourcing_agent` ne se retire pas facilement
(limite PG) mais est **inerte** si aucun `user_roles` ne l'utilise.
