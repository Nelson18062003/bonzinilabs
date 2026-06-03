# Refonte Assistant — Journal de finalisation (parité complète, rétention, eval)

> **Statut :** code + migration livrés sur la branche. **Roadmap d'implémentation entièrement couverte.**
> **Date :** 2026-06-03.

---

## 1. Registre de parité étendu à TOUT le catalogue d'écriture (19 outils RPC)
- Le test de dérive ne couvrait que 3 outils → il couvre désormais **les 19 outils d'écriture adossés à une RPC** (clients, dépôts, paiements, taux, wallet, trésorerie complète).
- **L'exercice a, encore, attrapé du réel :**
  - **Vrai trou comblé** : `update_payment_beneficiary` n'exposait pas `email / identifier / identifier_type / bank_extra / notes` que la RPC accepte → **exposés** (parité rétablie).
  - **Extracteur durci** : `admin_adjust_wallet` et `reject_deposit` sont des fonctions **surchargées** (multi-signatures) dans `types.ts` (nom sur sa propre ligne) → l'extracteur gère maintenant les 3 formats (mono, inline, surcharge/union).
  - **Omits documentés** (params RPC volontairement non exposés) : `p_password` (auth), `p_occurred_at`/`p_snapshot_at` (toujours « maintenant »), `p_admin_note`/`p_rejection_category` (motif suffit), champs bénéficiaire avancés du paiement (via outils dédiés).
- **Vérifié ici** : `parity.manifest.ts` compilé + exécuté contre le vrai `types.ts` → **19/19 « parité OK », 0 dérive**.

## 2. Rétention (`20260603140000_mola_retention.sql`)
- `mola_purge_old_conversations(p_days=180)` : purge les conversations > N jours (messages en CASCADE) + les souvenirs épisodiques expirés. Audit conservé séparément.
- **Planification quotidienne via pg_cron si disponible** (sinon no-op — la migration n'échoue jamais).

## 3. Jeu d'eval élargi
Ajout : trésorerie (treasurer), création client (carte de confirmation), anti-fuite IBAN (masquage Lot 4a), + savoir métier, mémoire `remember`, parité bénéficiaire/taux, introspection. **~16 cas** couvrant les 5 familles et tous les modules. Reste à brancher les **vraies questions** du founder (graine).

---

## État FINAL de la refonte (côté code)
| Lot | Fait |
|---|---|
| QW-1→6 | ✅ |
| 1 — eval + coût | ✅ |
| 2 — parité + introspection | ✅ |
| 3 — mémoire | ✅ (migration) |
| 4a — masquage PII | ✅ |
| 4b — SQL scopé par rôle | ✅ (migration) |
| 5 — savoir + self-correction | ✅ |
| Finalisation — parité catalogue complet + rétention + eval | ✅ (migration) |

**69 outils** (44 lecture + 25 écriture). 4 migrations (mémoire, SQL scopé, rétention + la migration de parité pilotée par `types.ts`). Harnais d'eval (grader 11/11, masquage 9/9, parité 19/19 — tous vérifiés ici par compilation + exécution).

## Ce qui RESTE — uniquement côté toi (rien à coder)
1. **Déployer** : `npx supabase db push --linked` (4 migrations) → `/gen-types` → `supabase functions deploy admin-assistant` → demander `reindex_knowledge` une fois.
2. **Tester** les scénarios (cf. `12-LOT4b-LOT5-LOG.md`).
3. **Décider** : matrice PII (Phase 5 §3), durée de rétention (180 j ?).
4. **Fournir tes vraies questions** → je les branche dans l'eval (5 min).

*Refonte de fond TERMINÉE côté implémentation. Place au déploiement et au retour terrain.*
