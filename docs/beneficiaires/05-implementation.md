# Phase 5 — Implémentation (journal par lot)

> Mode : **incrémental par lot**, chaque lot `/verify`-vert avant le suivant. `created_by` tracé.
> Légende statut : ✅ livré & poussé · 🔵 en cours · ⛔ bloqué (dépendance externe) · ⏳ à venir.

---

## Lot 0 — Spec partagée + Zod + labels + i18n · ✅ (commit `54d831e`)
**Fichiers créés :**
- `src/lib/beneficiaries/spec.ts` — `BENEFICIARY_SPEC` (source unique), `validateBeneficiaryInput`,
  longueurs en **caractères** (CJK-safe), `getBeneficiaryNaturalKey` / `isSameBeneficiaryKey` (dedup).
- `src/lib/beneficiaries/schema.ts` — Zod **dur** (union discriminée `payment_method` +
  `superRefine` identifier-ou-QR). Remplace la validation molle. CJK accepté (zéro regex de script).
- `src/lib/beneficiaries/labels.ts` — **réutilise** `PAYMENT_METHOD_LABELS/ICONS`, ajoute
  `BENEFICIARY_MODE_COLORS` (clé `bank_transfer`, palette SPECS).
- `src/tests/lib/beneficiarySpec.test.ts` — 14 cas (complétude/mode, CJK, dedup, email).
- i18n `fr/en/zh` : bloc `beneficiaries` étendu (champs, relations, erreurs, doublon, snapshot).

**Vérif :** `type-check` ✅ · `vitest run` **81/81** ✅ (67 existants + 14 nouveaux, zéro régression).

**Décisions techniques notables :**
- Mode canonique = `bank_transfer` (DB) ; `virement` n'est qu'un label admin → jamais une clé.
- Zod v3 : membres de l'union = objets **plain** (pas de `.refine`), règle inter-champs via
  `superRefine` (sinon `discriminatedUnion` casse).

---

## Lot 1 — Migrations DB additives (prod-safe) · ✅ (commit `1feb2be`)
**Fichiers créés (à appliquer sur la base — geste porteur produit) :**
- `supabase/migrations/20260601000000_beneficiaries_alias_relation_created_by.sql`
  — colonnes `alias`/`relation_type`/`notes`/`created_by`/`created_by_role` (nullable) →
  **backfill `alias := name`** → `alias NOT NULL`. Guards `CHECK` relation/role.
- `supabase/migrations/20260601000001_beneficiaries_completeness_checks.sql`
  — complétude par mode en **`CHECK … NOT VALID`** (durcit le neuf, grandfather le legacy) +
  requête d'audit des legacy incomplets (commentée).
- `supabase/migrations/20260601000002_beneficiaries_dedup_unique.sql`
  — **dédup** (archive le plus ancien, `is_active=false`, réversible) **puis** index `UNIQUE`
  partiels par clé naturelle. Index **plein en transaction** (table petite) plutôt que
  `CONCURRENTLY` → atomique avec le dédup. **Aucun `DROP`. `payments` jamais touché.**

**Vérif (Postgres 16 jetable, schéma représentatif + seed legacy/doublons/CJK) :**
| Assertion | Résultat |
|---|---|
| alias backfillé + `NOT NULL`, 0 vide | ✅ |
| dédup alipay 1 archivé / bank 1 archivé / **cash 0** | ✅ |
| isolation **par client** (même identifiant chez 2 clients = OK) | ✅ |
| nouveau doublon **rejeté** (`uq_benef_account`) | ✅ |
| nouveau bank incomplet **rejeté** (`chk_benef_bank_fields`) | ✅ |
| legacy incomplet **grandfathered** (NOT VALID) | ✅ |
| nouveau row complet (alias+relation+created_by) inséré | ✅ |

---

## ⛔ POINT DE DÉPLOIEMENT (gate avant Lot 2)

Le **Lot 2 (hooks)** écrit `alias`/`relation_type`/`created_by`. Il a besoin des **types Supabase
régénérés** (`src/integrations/supabase/types.ts`), donc de la **migration appliquée à la base**.

→ **Action porteur produit** (prod active = ton geste) :
1. **Sauvegarde** de la base.
2. Appliquer en **staging** d'abord : `npx supabase db push --linked` (ou skill `/migrate`).
3. Lancer la **requête d'audit** (dans 1B) pour lister les legacy incomplets à compléter.
4. `npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts`
   (gotcha cache schéma : vérifier le diff).
5. Me redonner la main → je poursuis **Lot 2 → 6**.

**Alternative pour garder le momentum sans toucher la prod tout de suite** : j'étends
`types.ts` **à la main** (additif, identique à ce que produira `gen types`) pour coder/compiler
Lot 2→6 ; la régénération réelle se fera au déploiement (diff attendu nul). À ton choix.

---

## Lot 2 — Hooks consolidés · ⏳ (bloqué par le gate)
## Lot 3 — UI client (carnet + paiement) · ⏳
## Lot 4 — UI admin (paiement + fiche client) · ⏳
## Lot 5 — Snapshot + complétion · ⏳
## Lot 6 — Tests E2E + vérif · ⏳

---

## Auto-contrôle Phase 5 (à ce stade)
- ✅ Lots 0–1 livrés, vérifiés (type-check + 81 tests + migrations testées sur PG16), poussés.
- ✅ Prod-safe respecté : aucun `DROP`, `payments` intact, additif, dédup réversible.
- ✅ Réutilisation assumée (labels/icônes, signed-URL à venir) — anti-over-engineering.
- ⛔ Gate honnête : la suite touche la base **active** → décision/déploiement = porteur produit.
