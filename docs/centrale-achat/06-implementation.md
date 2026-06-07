# Phase 6 — Implémentation (log par lot)

> **Statut : en cours.** Code écrit lot par lot après GO explicite. Chaque lot : `type-check` +
> `build` verts avant de passer au suivant. **Les migrations ne sont PAS déployées sur la prod
> Supabase** tant que le porteur produit ne le demande pas explicitement (migration par migration).
>
> **Légende :** ✅ fait & vérifié · 🔶 fait, déploiement prod en attente · ⏳ à venir.

---

## Lot 0 — Fondations DB 🔶 (code livré, déploiement prod en attente)

### Livrables (fichiers)
| Fichier | Contenu |
|---|---|
| `supabase/migrations/20260607101000_procurement_schema.sql` | 23 enums + **10 tables `proc_*`** + indexes + 3 générateurs de référence (`BZ-MS/PO/SP`) + vue `proc_po_balances` (`security_invoker`) + helper `can_access_procurement()` + RLS SELECT-only |
| `supabase/migrations/20260607101001_procurement_role.sql` | `ALTER TYPE app_role ADD VALUE 'sourcing_agent'` + helper `is_sourcing_agent()` |
| `supabase/migrations/20260607101002_procurement_storage.sql` | bucket privé `procurement-docs` (10 Mo, images+PDF) + 4 policies storage (upload/lecture/maj/suppr) scopées `{uid}/...` |
| `src/contexts/AdminAuthContext.tsx` | `AppRole` += `sourcing_agent` ; 2 permissions `canViewProcurement`/`canManageProcurement` ; **support multi-rôle** |
| `src/__screenshot__/main.tsx` | `roles` ajouté au faux admin (hygiène) |

### Décision notable — support multi-rôle (auth)
Le porteur veut que le père **cumule** `treasurer` + `sourcing_agent`. Le front chargeait **un seul**
rôle (`fetchAdminData` → `.maybeSingle()`), ce qui aurait **cassé le login** d'un user à 2 rôles. Le
DB gérait déjà le multi-rôle (helpers `can_access_*` en `EXISTS`). Donc `fetchAdminData` charge
désormais **tous** les rôles actifs, les **permissions sont l'OR-merge** de ces rôles
(`mergePermissions`), et un **rôle primaire** (`pickPrimaryRole`, priorité `super_admin` d'abord) est
gardé pour l'affichage et les checks `=== 'super_admin'`. **Zéro régression** pour les admins
mono-rôle (merge d'un seul rôle = ce rôle).

### Conventions respectées (moule trésorerie `20260515000002`)
`NUMERIC(20,8)` partout · helper `can_access_procurement()` SECURITY DEFINER (compare `role::text`
→ ship avant l'enum) · **RLS = SELECT seul, écritures via RPC SECURITY DEFINER (Lot 1)** · append-only
+ `voided_at/by/reason` sur l'argent (`proc_supplier_payments`, `_qc_inspections`,
`_production_events`, `_expenses`) · vues `security_invoker = true` · références `BZ-*` façon
`generate_deposit_reference`.

### Vérification ✅
- `npm run type-check` (TS **5.8.3 local**) : **0 erreur**.
  *(Note env : un `tsc` global 6.0.2 existait et avortait sur `TS5101 baseUrl` — faux négatif corrigé
  en installant les deps du projet via `npm ci`.)*
- `npm run build` : **succès** (`✓ built in ~27 s`), seul warning = taille de chunks (préexistant).

### NON fait volontairement
- **`supabase db push` (déploiement prod) : NON exécuté.** En attente du GO migration-par-migration.
- **`gen-types` : NON exécuté** (nécessite la connexion projet ; à lancer après le push prod pour que
  les tables `proc_*` apparaissent dans `types.ts` — requis par le code TS du Lot 1).

### Points de vigilance pour le déploiement (à border avec toi)
1. `ALTER TYPE ... ADD VALUE 'sourcing_agent'` : non destructif (PG 15) ; la valeur n'est utilisée en
   littéral dans **aucune** migration du même run (helpers en `role::text`) → pas de souci de
   transaction.
2. Ordre de push : `…101000` (schéma+helper) → `…101001` (rôle) → `…101002` (storage). Le helper
   compare en texte donc l'ordre schéma-avant-rôle est sûr.
3. Après push : **`gen-types`** puis re-`type-check`/`build` avant d'écrire le Lot 1.

---

## Lot 1 — Saisie cœur + catch-up mai 2026 ⏳
À venir (RPC `@mola` d'écriture + parité + formulaires + dictée Mola + saisie réelle mai 2026).
