# Refonte Assistant — Journal d'implémentation des quick-wins

> **Statut :** code appliqué sur la branche `claude/exciting-hopper-9oVZP`. **PAS encore déployé en prod** (ton geste : `npx supabase functions deploy admin-assistant`).
> **Date :** 2026-06-03 · **Fichier touché :** `supabase/functions/admin-assistant/index.ts` (uniquement). Aucun `src/` modifié.
> **Réf. conception :** `01-CIBLE-ET-QUICKWINS.md` §8.

---

## Ce qui a été appliqué

| QW | Effet | Changement | Statut |
|---|---|---|---|
| **QW-1** | Mémoire à l'endroit (tue P0-A) | History : `ascending:true limit 20` → **`ascending:false limit 40` + `.reverse()`** (les 40 plus récents, en ordre chrono) | ✅ |
| **QW-2** | Fin des réponses tronquées (tue P1-A) | `max_tokens` **1500 → 4000** | ✅ |
| **QW-2b** | Continuer si `stop_reason=max_tokens` | — | ⏸️ **différé** (phase executor) — nécessite de gérer proprement le texte déjà streamé ; risque > bénéfice pour un quick-win |
| **QW-3** | Tâches composées aboutissent (tue P1-C) | `MAX_TOOL_ITERATIONS` **8 → 14** | ✅ |
| **QW-4** | Ferme la fuite SQL inter-rôles (§6) | `query_database` passe **`superAdminOnly`** ; ajout du flag à l'interface `ReadTool` + filtre `allowedRead` | ✅ (mitigation) |
| **QW-5** | Taux personnalisé (tue P0-B, ton irritant n°1) | `create_payment` : param `exchange_rate` optionnel → `p_exchange_rate` + `p_rate_is_custom=true` ; carte affiche le taux ; prompt corrigé (« ne dis JAMAIS que le taux est fixé ») | ✅ |
| **QW-6** | Commentaires menteurs corrigés | en-tête « 47→62 outils », « vision » → « preuves non analysées », « Haiku » → « Sonnet 4.6 » | ✅ |

## Décisions / compromis assumés
- **QW-4 (sécurité)** : mitigation **immédiate et volontairement brutale** — `query_database` (SQL libre) réservé au `super_admin`. Conséquence : `ops`/`support` perdent le SQL libre (ils gardent tous leurs outils dédiés). La **version propre** (allowlist tables/colonnes **par rôle** dans la RPC `assistant_readonly_query`) est un livrable de la **phase sécurité**. *(Choix founder : « lot complet » → mitigation acceptée.)*
- **QW-5 (argent)** : le taux personnalisé ne change **que** le montant RMB affiché et le `exchange_rate` enregistré — **pas** le débit XAF (`p_amount_xaf` reste le montant saisi). Même profil de risque que l'écran `MobileNewPayment`. Garde-fous intacts : solde vérifié (+ `FOR UPDATE` côté RPC), montant min, permission `canProcessPayments`, **carte de confirmation affichant le taux**, `rate_is_custom` tracé dans le ledger.

## Vérifications faites
- ✅ **Parité unités** confirmée vs `MobileNewPayment.tsx:172` et RPC `create_admin_payment` (migration `20260304300000:168-187`) : `exchange_rate` = CNY ¥ / 1 000 000 XAF ; `amount_rmb = round(amt × taux / 1e6)`.
- ✅ **Structure** : accolades/crochets équilibrés ; équilibre des parenthèses **identique à HEAD** (−3, pré-existant, dû au texte FR dans les chaînes) → aucune dérive introduite.
- ✅ **`tsc --noEmit` (app `src/`)** : exit 0. *(Ne couvre PAS l'edge function : `tsconfig.app.json` n'inclut que `src`.)*
- ⚠️ **Limite d'environnement** : **Deno indisponible ici** → l'edge function n'a pas pu être type-checkée localement. Le `deno check` réel s'exécute au **déploiement** (`supabase functions deploy`). Vérifié par revue structurelle + signature RPC + parité.

## À faire par toi (déploiement + test)
1. `npx supabase functions deploy admin-assistant` (lance le type-check Deno).
2. Tester les 6 scénarios de `01-CIBLE-ET-QUICKWINS.md` §8 (notamment QW-5 : « paie 2 000 000 XAF en Alipay pour Jonas au taux 78 » → carte avec taux 78 personnalisé ; et QW-1 : conversation > 20 messages → contexte récent retenu).
3. Signaler tout écart (numéro de QW + scénario).

*Quick-wins livrés. La refonte de fond continue en Phase 3 (catalogue à parité + introspection).*
