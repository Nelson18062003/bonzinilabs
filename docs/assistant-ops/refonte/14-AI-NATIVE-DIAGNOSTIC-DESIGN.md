# Refonte Assistant — Plafond de profondeur : diagnostic chiffré + plateforme AI-native

> **Statut :** diagnostic (lecture réelle de la couche RPC) + conception. Le VRAI sujet soulevé par le founder :
> Mola est plafonné par une liste d'outils écrite à la main, alors que la plateforme est bien plus profonde.
> **Date :** 2026-06-03 · **Légende :** 🟢 vérifié · 🟡 étayé · 🔴 à confirmer.

---

## 1. Le plafond, en nombres (mesuré, pas supposé) 🟢

Lecture de la couche d'actions réelle (`src/integrations/supabase/types.ts`, bloc `Functions`) croisée avec les RPC réellement appelées par l'edge function :

| | Nombre |
|---|---|
| **RPC totales de la plateforme** | **61** |
| RPC atteintes par Mola | 27 (dont ~8 helpers de lecture internes) |
| → soit **actions réelles exposées** | **~19** |
| Helpers internes (à NE PAS exposer : `is_admin`, `generate_*_reference`…) | 12 |
| **VRAIES capacités métier MANQUANTES** | **24** |

**Profondeur d'action atteinte ≈ 19 / (19 + 24) ≈ 44 %.** Mola atteint **moins de la moitié** de ce que la plateforme sait faire. Le founder a raison.

### Les 24 capacités manquantes, par domaine 🟢
- **Dépôts (cycle) — 7** : `cancel_client_deposit`, `cancel_deposit`, `revert_deposit_to_created`, `start_deposit_review`, `submit_deposit_proof`, `delete_payment_proof`, `get_deposit_stats`.
- **Paiements cash — 3** : `confirm_cash_payment`, `scan_cash_payment`, `process_payment`.
- **Taux de change — 3** : `add_exchange_rate`, `update_exchange_rate`, `delete_exchange_rate`.
- **Wallet / réconciliation — 2** : `create_wallet_adjustment`, `check_wallet_reconciliation`.
- **Clients — 5** : `admin_setup_client`, `admin_reset_client_password`, `admin_reset_password`, `get_client_ledger`, `get_xaf_per_cny_at`.
- **Administrateurs — 4** : `admin_create_admin`, `toggle_admin_status`, `update_admin_profile`, `update_admin_role`.

> **Et le pire :** ce plafond **CROÎT**. Chaque nouvelle fonctionnalité = une nouvelle RPC = un nouvel outil à écrire **à la main**, sinon Mola est aveugle dessus. Le retard est structurel, pas ponctuel.

> **Nuance importante (honnêteté) :** pour la **lecture**, le plafond est déjà largement levé — l'outil `query_database` (SQL libre) permet à Mola de répondre à **n'importe quelle** question de données sans outil dédié. Le plafond réel est sur l'**action/écriture**.

---

## 2. La cause structurelle : la plateforme n'est PAS « AI-native » 🟢

Aujourd'hui, la même couche d'actions (les RPC) a **deux consommateurs qui divergent** :

```
                 ┌──────────────► UI React (hooks) ──┐
   Couche RPC ───┤                                    ├──► Supabase
   (61 actions)  └──────────────► IA (tools MAIN) ────┘
                       ↑ écrits à la main, en retard
```

- L'**UI** consomme les RPC directement (via les hooks) → elle a toute la profondeur.
- L'**IA** consomme les RPC via un **catalogue d'outils écrit à la main** → elle n'a qu'une tranche, et elle prend du retard à chaque évolution.

**C'est ça, « bolted-on » vs « AI-native ».** La plateforme a été conçue pour l'UI ; l'IA a été branchée à côté par une petite porte manuelle. Une plateforme AI-native aurait **une seule surface d'actions auto-décrite**, consommée **à l'identique** par l'UI et par l'IA.

---

## 3. La cible : génération AUTOMATIQUE du catalogue (annotation-driven) 🟢

L'idée-clé qui lève le plafond **sans danger** :

> Les **paramètres et types** de chaque action sont **déjà** machine-lisibles dans `types.ts` (gratuit, toujours à jour). Le seul travail humain restant, c'est une **annotation de sécurité minuscule** par RPC. Un **générateur** combine les deux et produit le catalogue d'outils tout seul.

### 3.1 L'annotation (≈ 5 lignes par RPC, écrites UNE fois)
```ts
{
  rpc: "cancel_deposit",
  expose: true,                 // false = interne, jamais exposé
  kind: "write",                // read | write
  permission: "canProcessDeposits",
  confirm: true,                // carte de confirmation (argent/sensible)
  danger: true,
  resolve: { p_deposit_id: "deposit" },   // « donne une référence, je résous l'UUID »
  label: "Annuler un dépôt",
}
```
Tout le reste (le `input_schema`, le typage, la signature) est **dérivé de `types.ts`**.

### 3.2 Le générateur
À partir de `types.ts` (params) + le manifeste d'annotations (sécurité), il **produit** :
- le `input_schema` de chaque outil (auto, toujours synchro) ;
- le `prepare` (résolution des références → UUID via des **resolvers réutilisables** : client, contrepartie, compte, dépôt, paiement) + la carte de confirmation ;
- le `execute` (appel RPC sous JWT admin).

### 3.3 La sentinelle (déjà construite !)
Mon **test de parité** (Lot 2 / finalisation) lit déjà **toutes** les signatures RPC de `types.ts`. On l'étend d'un cran : **toute RPC sans annotation casse la CI**. Donc une nouvelle RPC = soit on l'annote (5 lignes → outil auto-généré), soit on la marque `expose:false`. **Plus jamais de retard silencieux. Le plafond ne peut plus se reformer.**

```
Nouvelle RPC ──► /gen-types (auto) ──► test de parité ÉCHOUE (« non annotée »)
            └──► annotation 5 lignes ──► outil AUTO-GÉNÉRÉ ──► Mola l'atteint
```

---

## 4. Ce qui ne bouge PAS : la sécurité 🟢
« AI-native » ≠ « l'IA fait n'importe quoi seule ». Les garde-fous restent **dans le générateur**, par construction :
- **`confirm:true`** → carte de confirmation d'un tap sur tout mouvement d'argent. Jamais d'auto-exécution.
- **`permission`** héritée du rôle ; **`danger`/`super_admin`** sur le sensible (resets, gestion admin, suppressions).
- **`expose:false`** sur les 12 helpers internes.
- **Fail-closed** : une RPC non annotée n'est **pas** exposée (et la CI le crie).
- Masquage PII + SQL scopé (déjà livrés) s'appliquent pareil.

---

## 5. Architecture en couches (honnête sur l'effort)
| Niveau | Quoi | Effort | Effet |
|---|---|---|---|
| **Aujourd'hui** | tools écrits à la main | élevé/continu | plafond à ~44 %, qui croît |
| **Phase A — génération annotée** | catalogue généré depuis `types.ts` + annotations | **moyen, 1 fois** | **plafond levé sur toute la couche RPC** ; nouvelles features auto-disponibles (5 lignes) |
| **Phase B — MCP / découverte runtime** | chaque module se « présente » lui-même à l'IA | élevé | AI-native complet (multi-modules, multi-canal). Plus tard. |

**Phase A est le vrai déblocage, et il est réaliste** : la fondation (lecture machine de `types.ts` + resolvers + carte de confirmation + permission) **existe déjà** dans le code livré. Il reste à écrire le **générateur** + **annoter les 61 RPC** (dont 12 en `expose:false`, ~24 nouvelles capacités, ~19 déjà faites à reformuler en annotations).

---

## 6. Limites honnêtes (anti-magie)
- Il reste un **travail humain** : annoter chaque RPC (5 lignes). Mais c'est **10× moins** que d'écrire un outil complet, et c'est **forcé** par la CI (donc jamais oublié).
- Certaines RPC ne sont **pas** un « bouton agent » propre (générateurs d'ID, prédicats d'auth) → `expose:false`. Jugement humain, une fois.
- Les actions vraiment dangereuses (gestion admin, resets, suppressions) → exposées **mais** `super_admin` + confirmation forte, ou laissées hors-périmètre selon ton choix.
- Phase B (MCP) reste un chantier séparé pour le futur multi-modules.

---

## 7. Roadmap pour lever le plafond
1. **Générateur** : `buildToolFromAnnotation(rpcName, annotation, typesArgs)` → produit `{name, description, input_schema, prepare, execute}`.
2. **Resolvers réutilisables** : client / contrepartie / compte / dépôt / paiement (la plupart existent déjà : `resolveClient`, `resolveCounterparty`, `resolveTreasuryAccount`).
3. **Manifeste d'annotations** des 61 RPC (expose / kind / permission / confirm / danger / resolve / label).
4. **Sentinelle** : étendre le test de parité → « toute RPC est annotée ou expose:false ».
5. **Migration douce** : les ~19 outils actuels → réécrits comme annotations (mêmes garanties) ; les **24 manquants** → ajoutés par annotation → **Mola passe de ~44 % à ~100 %** de la profondeur d'action, en sécurité.

> Résultat : Mola n'est plus « un assistant avec 19 boutons » mais « un collaborateur qui atteint **toute** la plateforme — et toute nouvelle fonctionnalité, automatiquement ».

---

## 8. Décision
Ce chantier (Phase A) est **le** vrai sujet du founder. Il transforme l'architecture (de bolted-on vers auto-généré). À lancer sur go explicite — en commençant par le **générateur + 2-3 RPC pilotes** (ex. `cancel_deposit`, `confirm_cash_payment`) pour prouver le mécanisme, avant d'annoter les 61.

*Diagnostic de profondeur posé. La balle est dans ton camp : on construit la génération ?*
