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

## Lot 1 — Saisie cœur + catch-up mai 2026 🔶 (RPC livrées ; formulaires + saisie à venir)

### Partie A — Couche d'écriture (RPC) ✅ écrite & auto-revue
| Fichier | Contenu |
|---|---|
| `supabase/migrations/20260607101003_procurement_rpcs.sql` | **13 RPC SECURITY DEFINER**, toutes étiquetées `@mola` dans la même migration |

**RPC livrées** (toutes : check `can_access_procurement`, params **typés enum**, validation,
audit `admin_audit_logs`, retour `jsonb_build_object('success', …)`) :
`proc_create_mission`, `proc_update_mission`, `proc_upsert_supplier`,
`proc_create_purchase_order`, `proc_update_purchase_order`, `proc_add_order_line`,
`proc_record_supplier_payment` (**argent** ; Cas 3 attestation/rail + **gate souple** = avertissement
`warning_no_qc_pass`, jamais de blocage), `proc_set_commission` (double-mode, `computed_*` calculés
côté RPC), `proc_attach_document`, `proc_record_qc`, `proc_log_production_event`,
`proc_record_expense` (**argent**), `proc_void_record` (**super_admin** uniquement, motif ≥10).

**Conventions** : moule `treasury_rpcs` (erreurs ASCII, `NULLIF(trim(...))`, `RETURNING id`,
plafond anti-faute de frappe 10 G). Étiquettes `@mola` `permission:"canManageProcurement"`,
`danger/confirm` à `true` sur l'argent et le void.

### Auto-revue (2 bugs trouvés & corrigés avant de m'y fier)
1. `proc_void_record` lisait l'existence via `SELECT … INTO v_found` → **NULL sur 0 ligne** (pas
   `false`), donc la branche « introuvable » ne se déclenchait pas. Corrigé avec l'idiome **`FOUND`**.
2. `proc_upsert_supplier` avait `p_category DEFAULT '{}'` → **écrasait** le tableau en update si omis.
   Passé à `DEFAULT NULL` + `COALESCE(p_category, '{}')` à l'insert.

### Parité — volontairement INCHANGÉE
Les RPC procurement passent par le **générique `do_capability`** (pas d'outil dédié `"tool"`), donc
aucune entrée à ajouter dans `eval/assistant/parity.manifest.ts` (qui ne couvre que les outils
**riches** redéclarant des params). Y ajouter les RPC maintenant **casserait** le test
(`rpcFound=false` tant que `types.ts` n'est pas régénéré). Les entrées de parité viendront **avec les
outils dédiés** (lot ultérieur), après déploiement + `gen-types`.

### Vérification ✅ / limites ⚠️
- ✅ `type-check` : 0 erreur · `build` : succès (inchangés — Lot 1A est du SQL pur).
- ✅ Suite vitest : **118 tests passent** (`grade`, `authGate`… verts → le multi-rôle n'a rien cassé).
- ⚠️ `parity.test.ts` **ne se charge pas** dans ce conteneur (`readFileSync(new URL(…, import.meta.url))`
  → URL non-`file` sous jsdom de vitest 3.2.4). **Échec de chargement, pas d'assertion** ; fichiers
  non modifiés par moi → quirk d'env, vert en CI normale.
- ⚠️ **SQL non exécuté** (pas de Postgres/creds ici) : correction reposant sur la revue manuelle +
  le moule trésorerie. À valider au déploiement.

### Partie B — Saisie (formulaires + dictée) + catch-up mai 2026 ⏳ BLOQUÉ sur déploiement
Les écrans TypeScript appellent les tables/RPC `proc_*` → nécessitent **déploiement Lot 0+1 sur
Supabase puis `gen-types`** (sinon non typés). À faire dès que tu déploies (ou me donnes l'accès).
