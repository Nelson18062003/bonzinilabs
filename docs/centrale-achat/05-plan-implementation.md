# Phase 5 — Plan d'implémentation par lots

> **Statut : rendu, en attente de validation.** Découpage en lots livrables, dépendances,
> estimations, critères de « fait ». **Toujours du design — aucun code n'est écrit avant la Phase 6,
> qui exige un GO explicite.** Le **catch-up mission mai 2026** est le **jalon de valeur du Lot 1**.
>
> **Décisions intégrées :** Cœur 360° · agent à commission (double-mode) · custody Cas 3 · saisie
> **formulaires + dictée à Mola** (les deux au MVP) · **pas d'OCR** (photos = preuves optionnelles) ·
> gate solde **souple** · rôle **`sourcing_agent`** (cumulé à `treasurer`) · QC interne/tiers ·
> reporting **interne + PDF** (pas de portail client) · in-app only.
>
> **Légende :** 🟢 vérifié · 🟡 proposé · 🔴 à confirmer.

---

## 1. Principe de découpage

On copie la méthode des modules précédents (trésorerie : Lot schéma → rôle → RPC → UI saisie → UI
dashboard ; cf. `docs/design-module-tracabilite.md` §H). Chaque lot est **livrable seul**, **ne casse
rien** (additif, aucun `ALTER` sur les tables critiques), et a un **critère « fait »** : `npm run
type-check` + `npm run build` verts + scénario de test passé + (pour l'argent) **revue sécurité**.

**Ordre dirigé par la valeur :** on veut le **rapport propre de mai 2026** (la douleur déclenchante)
le plus tôt possible. Donc : fondations minimales → saisie → **catch-up mai 2026** → consultation →
rapport.

---

## 2. Les lots

### Lot 0 — Fondations DB 🟡
**Objectif :** le socle, invisible pour l'utilisateur.
**Contenu :**
- Migration `procurement_schema.sql` : enums + 10 tables `proc_*` (Phase 2) + indexes + RLS (SELECT
  via `can_access_procurement()`, écritures via RPC seulement) + vues dérivées (`security_invoker=true`,
  ex. `proc_outstanding_by_po`). Copie du moule `20260515000002_treasury_schema.sql`.
- Migration `procurement_role.sql` : valeur enum `'sourcing_agent'` (ALTER TYPE non destructif) +
  helper `can_access_procurement(_user_id)` (super_admin OU sourcing_agent, exclut `is_disabled`).
- Permissions front : `canViewProcurement` / `canManageProcurement` dans `AdminAuthContext.tsx`.
- Générateurs de référence `BZ-MS / BZ-PO / BZ-SP` (miroir `generate_deposit_reference`).
- Bucket Storage `procurement-docs` (RLS `{owner}/...`, compression à l'upload) + politique.
**Dépend de :** rien. **Critère fait :** `supabase db push` OK, `type-check` OK, `can_access_procurement`
testé par rôle, seed minimal (1 mission de test). **Estimation : ~8-12 h.**

### Lot 1 — Saisie cœur + **catch-up mai 2026** 🟡 (le jalon de valeur)
**Objectif :** pouvoir **tout enregistrer à la main**, et **saisir réellement la mission mai 2026**.
**Contenu :**
- **RPC `@mola` d'écriture** (SECURITY DEFINER, tag `@mola`, audit, confirm/danger sur l'argent) :
  `proc_create_mission`, `proc_upsert_supplier`, `proc_create_purchase_order`, `proc_add_order_line`,
  `proc_record_supplier_payment` (Cas 3 : `settlement_mode` attestation|rail), `proc_set_commission`
  (double-mode), `proc_attach_document` (photo-preuve), `proc_void_*`.
- **Parité** : entrées dans `eval/assistant/parity.manifest.ts` (tue P0-B).
- **UI formulaires** (canal 1) : `MobileNewPurchase`, `MobileRecordPayment`, `MobileSupplierEdit`,
  sous `src/mobile/screens/procurement/` (miroir trésorerie). Photo-preuve **optionnelle encouragée**.
- **Dictée à Mola** (canal 2) : automatique dès que les RPC sont taguées `@mola` (Mola les découvre).
  Tester le flux « dicte les valeurs → confirmation → écriture ».
- **Gate solde souple** : à l'enregistrement d'un `balance` sans QC `pass` → alerte + motif obligatoire.
- **Opération : saisie de la mission mai 2026** (travail du père/toi, pas du dev) avec les vraies
  données + photos-preuves, rétro-datées.
**Dépend de :** Lot 0. **Critère fait :** `type-check`+`build` OK ; **mission mai 2026 entièrement
saisie** (N fournisseurs, commandes, acomptes, commissions) ; **revue sécurité** (chemins argent :
confirmation, `isSafeInteger`, cap, audit) via l'agent `security-reviewer`. **Estimation dev : ~22-32 h**
(+ saisie opérationnelle mai 2026 : variable selon volume de pièces).

### Lot 2 — Consultation 360 🟡
**Objectif :** voir/naviguer ce qui a été saisi.
**Contenu :** RPC `@mola` lecture (`proc_mission_report` data, `proc_supplier_360`,
`proc_outstanding_balances`) ; écrans `MobileProcurementHome` (control tower : missions actives,
reste-à-payer, alertes), `MobileMissions*`, `MobileSuppliers*`, `MobilePurchaseOrderDetail` ; entrée
tab bar « Centrale d'achat » (si `canViewProcurement`).
**Dépend de :** Lot 1. **Critère fait :** naviguer la mission mai 2026 (fournisseur 360, PO, reste-à-
payer cohérent avec la saisie). **Estimation : ~16-24 h.**

### Lot 3 — Reporting PDF 🟡 (la douleur résolue)
**Objectif :** **le rapport propre de mai 2026**.
**Contenu :** `proc_mission_report(mission)` (agrégat par fournisseur/commande/paiement/QC,
granularité ligne) → **`generate-report-pdf`** (existant) → aperçu + **partage WhatsApp/email natif**.
Déclenchable via écran **et** via Mola (« génère le rapport de la mission mai »).
**Dépend de :** Lot 2. **Critère fait :** un PDF mission mai 2026 lisible, exact, partageable =
**test d'acceptation du module**. **Estimation : ~10-15 h.**

### Lot 4 — QC, production & alertes 🟡
**Objectif :** enrichir le suivi au-delà de l'argent.
**Contenu :** RPC `proc_record_qc` (type, AQL, result, inspecteur interne/tiers), `proc_log_production_event`
(jalons) ; alertes control tower (`proc_overdue_qc(days)`, `proc_overdue_production(days)`) ;
affichage statut prod/QC sur PO & fournisseur 360.
**Dépend de :** Lot 2. **Critère fait :** « quels QC en retard > 7 j » répond juste. **Estimation : ~10-16 h.**

### Lot 5 — Savoir métier (RAG) + eval + Q&A 🟡
**Objectif :** Mola répond aux questions métier sans halluciner.
**Contenu :** indexer le glossaire Phase 1 (incoterms, AQL, **compliance CEMAC**, cycle PI/PO/CI) +
carte des capacités dans `mola_memory` (sémantique) ; jeu d'**eval** procurement (lecture/écriture/
honnêteté/mémoire) façon `eval/assistant/` ; vérifier la **parité** complète.
**Dépend de :** Lots 1-4. **Critère fait :** eval procurement vert ; Mola répond correctement aux
questions du brief (reste-à-payer, retards, rapport). **Estimation : ~10-15 h.**

### Lot 6 — Revue sécurité & durcissement 🟡
**Objectif :** avant tout usage réel élargi (surtout Cas 2 rail).
**Contenu :** revue `security-reviewer` complète (RLS par rôle, exposition LLM scopée, pas de fuite
prix cross-client, chemins argent, audit) ; réconciliation Cas 2 (`proc_supplier_payment` ↔
`payments.amount_rmb`, tolérance 0/alerte) ; durcissement void (super_admin).
**Dépend de :** Lots 1-5. **Critère fait :** revue sécurité sans findings bloquants. **Estimation : ~6-10 h.**

---

## 3. Le catch-up mai 2026 (jalon central, Lot 1→3)

C'est le fil rouge : **Lot 0-1** rendent possible la **saisie** de la mission ; **Lot 2** la rend
**navigable** ; **Lot 3** produit **le rapport propre** — exactement ce qui était « impossible »
aujourd'hui. C'est aussi le **meilleur test réel** : si saisir + naviguer + rapporter mai 2026 est
fluide pour le père, le module tient ses promesses.

🔴 *Pour dimensionner la saisie opérationnelle de Lot 1, j'ai toujours besoin de l'**inventaire des
pièces mai 2026** (combien de fournisseurs documentés, sous quelle forme) — §E #3 Phase 1, toujours
ouverte.*

---

## 4. Coût

| | Coût |
|---|---|
| Dev total (Lots 0-6) | **~80-120 h** 🟡 (module plus gros que la trésorerie ~40-50 h, domaine plus large) |
| Récurrent IA | **~quelques $/mois** (inférence conversationnelle + RAG ; **pas d'OCR**) |
| Stockage photos-preuves | quelques $/mois (compression à l'upload) |
| Infra | **0 $** (edge + Postgres existants) |
| Catch-up mai 2026 | one-shot : temps humain de saisie (pas de $) |

---

## 5. Séquence de déploiement sans casse

Lot 0 (schéma, invisible) → Lot 1 (saisie + données mai) → Lot 2 (consultation) → Lot 3 (rapport) →
Lot 4 (QC/prod) → Lot 5 (RAG/eval) → Lot 6 (sécurité). Chaque lot : additif, `type-check`+`build`
verts, scénario passé. **Rien ne touche** `wallets`/`ledger_entries`/`payments`/`clients`/`user_roles`
(sauf lecture/lien). Enum `user_role` étendu (ADD VALUE, non destructif).

---

## 6. Ce qui n'est PAS dans ce plan (hors MVP, réservé)

Expédition/consolidation conteneur (CBM, LCL/FCL) · estimateur coût de revient CEMAC (HS→droits) +
checklist Douala · portail client self-service · Telegram · OCR-assist · offline PWA complet. Tous
**additifs plus tard**, sans refonte (champs réservés en Phase 2).

---

## 7. Questions avant la Phase 6 (implémentation)

1. 🔴 **GO Phase 6 ?** Le plan te convient-il ? L'implémentation (code) **ne démarre qu'à ton feu
   vert explicite**, lot par lot.
2. 🔴 **Par quel lot je commence** quand tu donnes le GO : Lot 0 (fondations) puis Lot 1 — ou tu veux
   voir d'abord un **prototype d'un seul écran** (ex. saisie d'un achat) pour valider l'ergonomie ?
3. 🔴 **Inventaire mai 2026** (pour dimensionner Lot 1) : combien de fournisseurs, quelles pièces ?
4. 🔴 **Terrain du père** (offline) : réseau en usine ? → confirme si la file d'attente + back-dating
   suffisent (reco) ou s'il faut viser l'offline complet.

---

## Auto-contrôle Phase 5

- ✅ **Lots livrables, additifs, sans casse** ; critère « fait » par lot (type-check+build+scénario+
  sécurité).
- ✅ **Catch-up mai 2026 = jalon central** (Lots 0→3), avec le rapport PDF comme test d'acceptation.
- ✅ **Décisions intégrées** : Cas 3, commission double-mode, saisie formulaire+dictée, pas d'OCR,
  gate souple, rôle `sourcing_agent`, in-app only.
- ✅ **Réutilise l'existant** (moule trésorerie, `generate-report-pdf`, `@mola`, parité, security-
  reviewer) ; greenfield sinon.
- ✅ **Coût chiffré** (~80-120 h dev ; ~quelques $/mois récurrent).
- ✅ **Revue sécurité** explicitement planifiée (Lot 1 argent + Lot 6 global).
- ✅ **Pas de code** : plan seulement ; Phase 6 sur GO explicite.
- ⏳ **En attente** : ton **GO** + réponses §7 → puis **Phase 6 (implémentation, lot par lot)**.
