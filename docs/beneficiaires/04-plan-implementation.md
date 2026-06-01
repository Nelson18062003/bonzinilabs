# Phase 4 — Plan d'implémentation (par lots)

> Décisions verrouillées : app à neuf · **DB préservée + étendue (additif, prod-safe)** · feature
> complète · doublons legacy **auto-archivés** · carnet admin **aussi** dans la fiche client.
> **Aucun code n'est écrit avant ta validation de ce plan (Phase 5).**
>
> Estimations = temps de dev focalisé (hors revue/déploiement). Ordre = dépendances strictes.

> **Faits vérifiés (Phase 4) qui cadrent le chiffrage :**
> - **i18n TRILINGUE `fr/en/zh`** — le namespace `beneficiaries` existe déjà dans
>   `src/i18n/locales/{fr,en,zh}/client.json:62`. Chaque libellé = **3 entrées**, et le **`zh` est
>   pertinent** (audience qui paie des fournisseurs chinois) → ne pas le bâcler. Le chiffrage i18n
>   des Lots 0/3/4 couvre les 3 langues (FR rédigé, EN/ZH proposés puis relus).
> - **Couche RPC paiement fragile** — `20260425120000_fix_payment_beneficiary_rpcs.sql` corrige des
>   régressions d'overload/enum sur les RPC bénéficiaire-de-paiement. **Conclusion : on confirme de
>   NE PAS créer de RPC pour le carnet** (CRUD via RLS + `CHECK`) et de **ne pas toucher** les RPC de
>   paiement (cibler toujours la *dernière* version). Cela réduit le risque et l'effort.
> - **Pas de colonne `created_by` sur `beneficiaries`** aujourd'hui → la trace admin est un ajout
>   **additif optionnel** (Migration A), à confirmer.

```
Lot 0 (spec)  →  Lot 1 (DB/migr)  →  Lot 2 (hooks)  →  ┌ Lot 3 (UI client) ┐ →  Lot 5 (snapshot) → Lot 6 (tests)
                                                       └ Lot 4 (UI admin)  ┘
```

---

## Lot 0 — Spec partagée & validation (fondation) · ~3–4 h
**But** : une **source unique** des champs par mode, importée par les deux apps.
- `src/lib/beneficiaryFields.ts` : `PAYMENT_BENEFICIARY_SPEC` = `{ mode → { champs, requis,
  validateurs (autorisent le CJK), maxLength en caractères, libellés i18n } }` (= Phase 2 §3).
- Schémas **Zod durs** dérivés de la spec (remplacent `validateBeneficiaryStep` molle de
  `paymentSchemas.ts`).
- Étendre l'interface `Beneficiary` (`useBeneficiaries.ts`) : `alias`, `relation_type`, `notes`,
  (`created_by`, `created_by_role`).
- **Critères** : `npm run type-check` OK ; la spec compile et est importable client + admin.
- **Risque** : divergence avec les libellés i18n existants → réutiliser les clés `payments`/`client`.

---

## Lot 1 — Modèle de données & migrations (PROD-SAFE) · ~4–6 h
**But** : étendre `beneficiaries` sans casser la prod. **Aucun `DROP`, `payments` jamais touché.**
- **Migration A** (transactionnelle) : `ADD COLUMN alias/relation_type/notes` (+ `created_by`,
  `created_by_role` optionnels) → **backfill `alias := name`** → `alias SET NOT NULL`.
- **Migration B** : `CHECK` par mode en **`NOT VALID`** (complétude des nouvelles lignes ; legacy
  grandfathered) + **requête d'audit** listant les legacy incomplets.
- **Migration C** (NON transactionnelle) : **auto-archivage des doublons** (`is_active=false`, garder
  le plus récent) **puis** `CREATE UNIQUE INDEX CONCURRENTLY` (alipay/wechat = `identifier` ;
  virement = `bank_account+bank_name`).
- Régénérer les types : `npx supabase gen types ... > src/integrations/supabase/types.ts`.
- **Critères** : migrations appliquées sur **copie/staging** sans erreur ; lignes existantes
  intactes ; insert incomplet **rejeté** ; doublon **rejeté** ; `type-check` OK après gen-types.
- **Risques** : (a) `CONCURRENTLY` interdit en transaction → migration séparée ; (b) délai de cache
  schéma Supabase après gen-types (cf. CLAUDE.md) → vérifier le comportement, pas seulement la compil.
- **🧑 À TOI** : **sauvegarde prod avant**, puis lancer/valider `npx supabase db push --linked` et la
  gen-types (ou me donner l'accès) ; **choisir le moment** d'application en prod.

---

## Lot 2 — Couche données app (hooks consolidés) · ~5–7 h
**But** : un module propre, **tous les hooks câblés**.
- `useBeneficiaries` (refonte) : `list / create / update / archive`, **client (`supabase`) ET admin
  (`supabaseAdmin`)** — on **branche** `useAdminClientBeneficiaries` + `useAdminCreateBeneficiary`
  (morts) et on ajoute `archive` (=`is_active false`) + `useUpdateBeneficiary` (mort).
- Helper **anti-doublon partagé** (détection sur clé naturelle + offre l'existant).
- Trace `created_by`/`created_by_role` à la création (client vs admin).
- **Critères** : hooks couverts par tests d'intégration ; plus aucun hook bénéficiaire orphelin.
- **Réutilisation assumée** : logique signed-URL QR + contrat snapshot conservés.

---

## Lot 3 — UI client · ~10–14 h
**But** : carnet réel + étape paiement reconstruite.
- `BeneficiariesPage` (remplace le stub `:9-11`) : liste filtrable/recherche, ajout, édition,
  **archivage** (modale + bandeau « paiements passés non modifiés »), **alias-first**, CJK-safe,
  empty states.
- Étape bénéficiaire paiement (refonte `NewPaymentBeneficiaryStep` + orchestration `NewPaymentPage`) :
  Existant / Nouveau / **Soi-même (tous modes)** / Plus tard ; **anti-doublon** ; **save non
  silencieux** ; **validation Zod dure** ; case « ne pas enregistrer » (ponctuel).
- Design : appliquer l'esprit `/frontend-design` (distinctif, production-grade) — skill indispo →
  manuel ; couleurs de mode SPECS.
- i18n : nouvelles clés (`fr` au minimum).
- **Critères** : tous les parcours client (matrice Phase 3 §0) OK ; `type-check` + `build` verts.

---

## Lot 4 — UI admin · ~8–12 h
**But** : brancher le carnet côté admin (paiement **et** fiche client).
- `MobileNewPayment` étape 4 : **sélecteur** des bénéficiaires du client sélectionné
  (`useAdminClientBeneficiaries(client.user_id, mode)`) + **création** au carnet
  (`useAdminCreateBeneficiary`) ; reset à chaque changement de client ; **scoping strict**.
- `MobileClientDetail` : **section « Bénéficiaires »** (liste/ajout/édition/archivage du carnet du
  client, hors paiement) — décision §D.
- **Critères** : parcours admin OK ; **test anti-fuite cross-client** ; `type-check` + `build` verts.
- **Risque sécurité** : vérifier que jamais un `clientId` d'un autre client ne fuite (RLS + filtre).

---

## Lot 5 — Intégrité snapshot & complétion ultérieure · ~3–5 h
- `beneficiary_details` (snapshot) inclut désormais `alias`/`relation_type` (app-layer, sans migration).
- `EditBeneficiaryPage` (complétion d'un paiement `waiting_beneficiary_info`) : option **« Enregistrer
  aussi au carnet »**.
- **Règle de revue gravée** : interdiction de **joindre la ligne `beneficiaries` vivante** pour
  afficher un paiement.
- **Critères** : test « j'édite un bénéficiaire → un paiement passé est **inchangé** » (le test le
  plus important de la feature).

---

## Lot 6 — Tests & vérification (= Phase 6) · ~6–8 h
- **Jeu de données de test** par mode (dont noms/banques en **CJK** : `张伟`, `中国工商银行`).
- **Scénarios bout-en-bout** par mode × {client, admin} × {existant, nouveau, self, plus tard}.
- Tests ciblés : **immuabilité snapshot**, **anti-doublon**, **complétude rejetée**, **scoping
  cross-client**, **affichage/saisie CJK**.
- **Critères** : `npm run test` + `npm run type-check` + `npm run build` verts ; checklist manuelle
  cochée (skill `/verify`).

---

## Récap effort & jalons

| Lot | Contenu | Estimation | Bloque |
|---|---|---|---|
| 0 | Spec + Zod + types | 3–4 h | tout |
| 1 | Migrations prod-safe + gen-types | 4–6 h | 2,3,4 |
| 2 | Hooks consolidés | 5–7 h | 3,4 |
| 3 | UI client (carnet + paiement) | 10–14 h | 5,6 |
| 4 | UI admin (paiement + fiche client) | 8–12 h | 5,6 |
| 5 | Snapshot + complétion | 3–5 h | 6 |
| 6 | Tests E2E + vérif | 6–8 h | — |
| **Total** | | **~39–56 h** | |

> Lots 3 et 4 parallélisables si deux personnes. Sinon : 3 puis 4.

---

## Ce que TU dois faire (toi, pas moi)
1. **Valider ce plan** (ou ajuster périmètre/ordre/estimations).
2. **DB prod** : sauvegarde avant Lot 1 ; lancer/approuver `supabase db push --linked` + gen-types,
   ou me donner l'accès ; **choisir la fenêtre** d'application en prod (active).
3. **Confirmer la spec finale** des champs par mode (Phase 2 §3) — *a priori figée*.
4. **i18n** : valider les libellés FR des nouveaux écrans (je propose, tu relis).
5. **Stratégie de livraison** : un gros lot ou livraison incrémentale par Lot (reco :
   **incrémentale**, Lot 1 d'abord en staging).

---

## Auto-contrôle Phase 4
- ✅ Lots ordonnés (data → API → UI client → UI admin → snapshot → tests) avec dépendances.
- ✅ Estimations + critères de validation **par lot** + risques.
- ✅ Actions explicitement **à ta charge** (DB prod, i18n, validation).
- ✅ Le test fintech-clé (immuabilité snapshot) est un critère dédié (Lot 5).
- ✅ Prod-safe rappelé à chaque point sensible ; aucun `DROP` ; `payments` intact.
- ⏳ En attente : ta **validation du plan** → puis **Phase 5 (implémentation), lot par lot**.
