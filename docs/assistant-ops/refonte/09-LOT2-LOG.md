# Refonte Assistant — Journal d'implémentation Lot 2 (Parité + introspection)

> **Statut :** code livré sur la branche. Edge function **à déployer** (`supabase functions deploy admin-assistant`).
> **Date :** 2026-06-03 · **Réf. conception :** `03-CATALOGUE-PARITE.md`, `07-ROADMAP.md` (Lot 2).
> **Défauts founder appliqués :** `create_beneficiary` → `canProcessPayments` ; `set_rate_adjustment` → `super_admin`.

---

## Ce qui a été livré

### A. 4 outils de parité (comblent 2 trous identifiés)
| Outil | Mécanisme plateforme **réel** (vérifié) | Permission |
|---|---|---|
| `create_beneficiary` | **table directe** `beneficiaries.insert` (comme `useAdminCreateBeneficiary`), RLS admin (`20260304100000:69`) | canProcessPayments |
| `update_beneficiary` | `beneficiaries.update` par id | canProcessPayments |
| `archive_beneficiary` | `beneficiaries.update is_active=false` | canProcessPayments |
| `set_rate_adjustment` | **RPC** `update_rate_adjustment(p_adjustment_id, p_percentage)` (résout key→id) | super_admin + confirmation forte |

> Leçon Phase 3 appliquée : **mécanismes mirroirés, pas devinés** — bénéficiaires = écriture table (pas de RPC), ajustement = RPC. Les deux diffèrent ; deviner aurait cassé.

### B. Introspection (tue la confabulation)
- Outil `what_can_i_do(domain?)` — **toujours disponible** (flag `always`, bypass permission) — renvoie la **carte des capacités** (`CAPABILITY_MAP`).
- Règle de prompt : *« avant d'affirmer qu'une action est impossible, appelle what_can_i_do ; 3 réponses honnêtes (je peux / la plateforme peut mais pas encore d'outil / non supporté) ; ne confabule JAMAIS. »*
- Prompt d'écriture mis à jour (liste bénéficiaires réutilisables + ajustement de taux).

### C. Registre de parité + test de dérive (`eval/assistant/parity.manifest.ts` + `parity.test.ts`)
- Extracteur des params RPC depuis `types.ts` (gère Args multi-lignes **et** inline) + `checkParity`.
- Test **live** : chaque outil adossé à une RPC couvre **tous** les params réels → casse si une migration ajoute un param oublié.

---

## Vérifications faites (ici)
- ✅ **Parité exécutée contre le vrai `types.ts`** : **0 dérive** sur les 3 RPC seedées — et le détecteur a **réellement attrapé 2 problèmes** au passage : (1) `update_rate_adjustment` en Args inline (extracteur corrigé) ; (2) `create_daily_rates.p_effective_at` non couvert (ajouté en omit-avec-raison). Le mécanisme **fonctionne**.
- ✅ **Edge function** : équilibre accolades/crochets **identique à HEAD** ; comptes d'outils **43 lecture + 24 écriture = 67** (en-tête mis à jour).
- ✅ **Eval** : cas `action-create-beneficiary` (le trou devient une proposition), `action-set-rate-adjustment`, `introspection-can-register-beneficiary` ajoutés.
- ⚠️ **Limites sandbox** : `vitest`/`deno` absents → `parity.test.ts`/`grade.test.ts` tournent en **CI** ; logique vérifiée par compilation `tsc` + smoke (grader 11/11, parité 0 dérive). L'edge function se type-checke au **déploiement**.

---

## Portée / suite
- Registre de parité **seedé** sur 3 outils RPC (paiement, ajustement, taux du jour) → **à étendre** aux autres (création client/dépôt, wallet, trésorerie) selon le playbook §7 du doc 03. Les outils sur **table** (bénéficiaires) se vérifieront contre les colonnes `Insert` (extension future).
- **Pas encore** : joindre un QR à un bénéficiaire enregistré depuis le chat (la carte des capacités le déclare honnêtement `tool: null`).

## À faire par toi
1. `supabase functions deploy admin-assistant`.
2. Tester : « enregistre Alibaba comme bénéficiaire Alipay réutilisable de Jonas » → carte `create_beneficiary` ; « est-ce que tu peux enregistrer un bénéficiaire ? » → OUI (plus de confabulation).
3. (CI) `npm run test -- eval/assistant/` pour grader + parité.

*Lot 2 livré. Restent : Lot 3 (mémoire), Lot 4 (sécurité/exposition), Lot 5 (savoir + self-correction).*
