# Refonte Assistant — Journal Lot 4a (Masquage PII avant LLM)

> **Statut :** code livré sur la branche. Edge function **à déployer**.
> **Date :** 2026-06-03 · **Réf. conception :** `05-SECURITE-EXPOSITION.md` §3-4.

---

## Ce qui a été livré
- **`supabase/functions/_shared/mask.ts`** : `maskForRole(role, value)` — masque, dans **chaque tool_result avant envoi au LLM** :
  - **numéros de compte / IBAN / RIB → `****1234` pour TOUS** (même super_admin) : le modèle n'en a jamais besoin, l'humain les voit dans l'app.
  - **téléphone / email / wechat → masqués** pour les rôles **hors PII complète** (PII complète = super_admin, support, customer_success ; donc `ops` reçoit un tél masqué).
  - masquage **récursif** (listes, objets imbriqués) ; champs non sensibles (soldes, noms, statuts) **intacts**.
- **Edge function** : import + application à `results.push(... JSON.stringify(maskForRole(role, result)))`.

## Vérifié (ici)
- ✅ **`mask.ts` compilé + smoke 9/9** : compte masqué pour super_admin, tél/email masqués pour `ops` et **non** pour support/customer_success, imbrication profonde, non-sensible intact, `null` sûr.
- ✅ Edge function : équilibre **identique à HEAD**.

## Pourquoi JE M'ARRÊTE LÀ (Lot 4b + Lot 5 en attente — décision d'ingénierie)
- **La fuite §6 est DÉJÀ fermée** : QW-4 (SQL libre réservé super_admin) + ce masquage. Le **Lot 4b** (SQL scopé par rôle via EXPLAIN+allowlist, pour rendre le SQL libre à `ops`/`support` sur leur périmètre) est une **amélioration de confort**, **pas** un correctif de sécurité — et c'est du plpgsql **non testable ici** (risque). Il attend le déploiement.
- **Le Lot 5 (savoir + self-correction) DÉPEND du Lot 3 (mémoire)**, lui-même **non testable ici** (pas de Deno / `Supabase.ai` / pgvector). Construire le savoir sur une mémoire non validée serait imprudent.
- **Pile non déployée importante** : quick-wins + Lots 1-3 + migration + Lot 4a. **Il faut valider la fondation avant d'empiler davantage.**

## À faire par toi (validation de TOUTE la pile)
1. `npx supabase db push --linked` (migration mémoire Lot 3) + `/gen-types`.
2. `supabase functions deploy admin-assistant`.
3. Tester : taux perso, bénéficiaire réutilisable, « est-ce que tu peux… », contexte long, « retiens que… », et que les **numéros de compte n'apparaissent pas en clair** dans les réponses.
4. Retour terrain → on reprend Lot 4b (SQL scopé) + Lot 5 (savoir + vérification) sur base saine.

## Rétention (décision ouverte, §5 Phase 5)
Politique recommandée : purge des `assistant_*` > 180 j via cron (l'audit `admin_audit_logs` conservé plus longtemps). À implémenter au Lot 4b. *(Durée à confirmer.)*

*Lot 4a livré + vérifié. Stop volontaire : valider la fondation avant Lot 4b/Lot 5.*
