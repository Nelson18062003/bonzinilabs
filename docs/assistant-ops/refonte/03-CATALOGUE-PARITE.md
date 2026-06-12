# Refonte Assistant — Phase 3 : Catalogue d'outils à parité garantie + introspection

> **Statut :** Phase 3 / conception (deep-dive du sous-système §4.3 de `01-CIBLE-ET-QUICKWINS.md`).
> **Date :** 2026-06-03 · **Prérequis :** `00-DIAGNOSTIC.md` (P0-B), `01-CIBLE-ET-QUICKWINS.md`, `02-QUICKWINS-LOG.md` (QW-5 a déjà bouché le 1er trou).
> **Légende confiance :** 🟢 vérifié · 🟡 étayé · 🔴 à confirmer.

---

## 1. La thèse, prouvée sur 3 trous (pas 1)

Le diagnostic posait : *le catalogue d'outils est un miroir partiel et figé, maintenu à la main, d'une plateforme qui évolue — et l'agent ne sait pas où sont ses propres trous, donc il confabule.* Trois preuves concrètes, vérifiées dans le code :

| Capacité plateforme | Côté agent | Verdict |
|---|---|---|
| **Taux personnalisé** sur paiement (`MobileNewPayment.tsx:172,333`) | `create_payment` n'avait aucun param de taux | ✅ **corrigé** (QW-5) |
| **Bénéficiaires enregistrés** : module CRUD complet (`BeneficiariesPage.tsx`, `EditBeneficiaryPage.tsx`, `useBeneficiaries.ts`) | seulement `list_beneficiaries` (lecture) + `update_payment_beneficiary` (≠ registre) | ❌ **trou** : pas de créer/éditer/supprimer bénéficiaire |
| **Ajustements de taux par pays/palier** (`rate_adjustments`, `useDailyRates.ts`) | `get_rate_adjustments` (lecture) ; `set_daily_rate` ne fait que les 4 taux globaux (`index.ts:1469-1472`) | ❌ **trou** : pas d'écriture des ajustements |

Trois trous trouvés en **un seul balayage**. Ce n'est pas une anomalie : c'est la **propriété par défaut** d'un catalogue tenu à la main. Tant qu'on rallonge la liste à la main, on rouvre un trou à chaque évolution de module. **La refonte ne consiste pas à ajouter ces 2 outils manquants — ça, c'est du rattrapage — mais à rendre la parité *mécaniquement impossible à perdre*.**

---

## 2. Pourquoi un catalogue à la main dérive *toujours* (l'argument structurel)

1. **Deux sources de vérité divergentes** : l'UI (React) et l'agent (outils) mappent toutes deux les mêmes RPC, mais indépendamment. Quand une RPC gagne un paramètre (`p_rate_is_custom` en mars 2026, migration `20260304300000`), l'UI est mise à jour (`MobileNewPayment`), **pas** l'outil agent. Rien ne le détecte.
2. **Aucun signal d'échec** : la divergence ne casse aucun test, ne lève aucune erreur. Elle se manifeste des semaines plus tard par « l'agent refuse / invente ».
3. **L'agent ne connaît pas ses propres limites** : il n'a aucune carte de « ce que je peux faire » vs « ce que la plateforme peut faire ». Donc face à un trou, il **comble par une justification plausible** (« le taux est fixé ») au lieu de dire « je n'ai pas l'outil ».

→ Trois maux, trois remèdes : **(A) une source de vérité de parité testée**, **(B) une introspection** qui donne à Mola la carte de ses capacités, **(C) un chemin d'extension** sûr.

---

## 3. Remède A — Le registre de parité + test de dérive (le cœur)

**Idée :** transformer la parité en **invariant testé en CI**, piloté par une source déjà existante.

### 3.1 Le levier déjà là : les types RPC générés
`src/integrations/supabase/types.ts` contient **déjà** les signatures d'arguments des RPC (`Functions[...]['Args']`), régénérées par `/gen-types`. Exemple vérifié : `p_rate_is_custom?: boolean` y figure (`types.ts:1500,1568`), comme `p_exchange_rate`, etc. **Donc la vérité des paramètres RPC est déjà machine-lisible.**

### 3.2 Le manifeste de parité
Un fichier déclaratif (ex. `supabase/functions/admin-assistant/parity.manifest.ts`) qui, pour **chaque outil d'écriture**, déclare :
```
{
  tool: "create_payment",
  rpc: "create_admin_payment",
  exposes: ["p_amount_xaf","p_exchange_rate","p_rate_is_custom","p_method","p_beneficiary_name", ...],
  omits: {
    p_desired_date: "non pertinent pour l'agent (toujours maintenant)",
    p_client_visible_comment: "à exposer plus tard",
  },
}
```
Règle d'or : **tout paramètre RPC est soit `exposes`, soit `omits` avec une raison.** Aucun paramètre « oublié » silencieusement.

### 3.3 Le test de dérive
Un test (`npm run test`) qui, pour chaque entrée du manifeste :
1. lit les paramètres réels de la RPC depuis `types.ts` (`Functions[rpc]['Args']`),
2. vérifie que **chaque** param RPC est listé dans `exposes` ∪ `omits`,
3. vérifie que chaque `exposes` correspond bien à une propriété du `input_schema` de l'outil.

**Effet :** le jour où une migration ajoute un paramètre RPC (ex. demain un `p_fee_xaf`), `/gen-types` l'introduit dans `types.ts`, et **le test casse** : « `create_admin_payment.p_fee_xaf` n'est ni exposé ni omis-avec-raison ». Le mainteneur (ou Mola en mode proposition, §5) doit trancher. **La dérive devient impossible à merger sans décision explicite.** 🟢 (mécanisme solide ; 🔴 détail d'implémentation du parsing de `types.ts` à valider).

> **Honnêteté anti-codegen total.** On NE génère PAS les outils automatiquement depuis les RPC. Pourquoi : (a) tous les params RPC ne doivent pas être exposés à l'agent (certains exigent validation/transformation, ex. résoudre un nom → UUID via `resolveClient`) ; (b) un outil = une RPC **+ de la logique de préparation** (vérif solde, calcul taux, carte de confirmation). Le manifeste **garde l'humain dans la boucle de décision**, mais **supprime l'oubli silencieux**. C'est le bon point d'équilibre : ni codegen aveugle, ni vigilance humaine pure.

---

## 4. Remède B — Introspection : Mola connaît ses propres frontières

C'est ce qui tue la **confabulation**. Mola doit pouvoir répondre, pour toute capacité, par l'un de **trois états honnêtes** :

| État | Signification | Réponse type de Mola |
|---|---|---|
| ✅ **Je peux** | un outil le couvre | « Je le fais — confirme la carte. » |
| ⚠️ **La plateforme peut, pas moi (encore)** | capacité existe à l'écran, pas d'outil agent | « La plateforme le permet via l'écran Bénéficiaires, mais je n'ai pas encore l'outil pour le faire à ta place. Je le note pour qu'on me l'ajoute. » |
| ❌ **Non supporté** | ni outil, ni écran | « Ce n'est pas possible aujourd'hui sur la plateforme. » |

### 4.1 La carte des capacités
Un document structuré (ex. `docs/assistant-ops/capabilities/*.md`, ou une table `mola_capabilities`) décrivant, **par module**, les capacités réelles + leur couverture côté agent :
```
module: paiements
  - créer un paiement (taux du jour OU personnalisé) → outil: create_payment ✅
  - compléter le bénéficiaire d'un paiement → outil: update_payment_beneficiary ✅
  - enregistrer un bénéficiaire réutilisable → écran: Bénéficiaires ; outil: ⚠️ AUCUN
module: taux
  - définir les 4 taux du jour → outil: set_daily_rate ✅
  - ajuster un % par pays/palier → écran: Taux ; outil: ⚠️ AUCUN
```
Cette carte est **récupérée just-in-time** (couche savoir, Phase mémoire) quand Mola évalue une faisabilité — il **lit sa carte** au lieu de deviner.

### 4.2 Le méta-outil `what_can_i_do(domain)`
Un outil de lecture qui renvoie à Mola : (a) la liste de ses outils pour ce domaine (avec leurs params), (b) l'extrait pertinent de la carte des capacités. Déclenché quand l'admin demande « est-ce que tu peux… ? » ou quand Mola s'apprête à dire « non / impossible ». **Règle de prompt :** *« Avant d'affirmer qu'une action est impossible, appelle `what_can_i_do`. Ne déduis jamais une impossibilité de l'absence de paramètre dans ta tête. »*

### 4.3 Cohérence avec le registre de parité
La carte des capacités et le manifeste de parité (§3) sont **alimentés par la même source** (les modules + RPC réels). Idéalement, le `⚠️ AUCUN` de la carte est **dérivé** du diff parité : un param/capacité non couvert apparaît automatiquement comme trou connu. Ainsi Mola dit la vérité *parce que* la vérité est tenue à jour mécaniquement.

---

## 5. Remède C — Extension sûre (« développe ses propres outils », version réaliste)

Rappel du diagnostic (P2-C) et de l'arbitrage Phase 2 : **pas d'auto-génération/déploiement de code non supervisé sur une fintech.** Le réaliste et utile :

### 5.1 Composition (macros apprises)
Un « nouvel outil » peut être une **recette** de tools primitifs existants, nommée et mémorisée (couche profil utilisateur, Phase mémoire). Ex. `onboarding_complet` = `create_client` → `create_and_validate_deposit` → `create_payment`. Mola **compose** sans écrire de code. Sûr (chaque primitive garde sa carte de confirmation). C'est la lecture honnête de « élargit son périmètre ».

### 5.2 Le journal des trous (gap log) → proposition
Chaque fois que Mola atteint l'état ⚠️ (« la plateforme peut, pas moi »), il **journalise le trou** (table `mola_capability_gaps` : capacité, module, fréquence, dernière demande). Ce journal devient :
- le **backlog priorisé** des outils à ajouter (par fréquence de demande réelle),
- une **proposition de spec d'outil** que Mola rédige (nom, params, RPC cible, permission) pour **revue humaine** → ajout au catalogue + au manifeste de parité + à la carte. 

C'est ainsi que Mola « élargit son périmètre » : il **identifie** le manque, le **chiffre** (combien de fois demandé), le **spécifie**, et un humain **valide**. Boucle d'amélioration continue, pilotée par l'usage réel, sans risque de code arbitraire en prod.

### 5.3 Les 2 trous connus à combler tout de suite (rattrapage)
Indépendamment du mécanisme, on comble les 2 trous déjà identifiés (Phase d'implémentation, avec revue argent/sécurité) :
- **Bénéficiaires enregistrés** : `create_beneficiary` / `update_beneficiary` / `archive_beneficiary` (mappés sur `useBeneficiaries`/RPC), permission `canProcessPayments` ou `canEditClients` (à trancher).
- **Ajustements de taux** : `set_rate_adjustment` (écriture sur `rate_adjustments`), permission `canManageRates`, **confirmation forte** (impacte le calcul de tous les paiements).

---

## 6. MCP-readiness (design-for-later, pas adopt-now)
Chaque outil reste structuré `{ name, description, input_schema, permission, prepare/execute }` — déjà le cas en v1. Cette forme est **trivialement exposable en serveur MCP** le jour où les modules se multiplient ou où Mola devient multi-canal (Telegram/WhatsApp). **On ne monte pas d'infra MCP maintenant** (cf. Phase 2 §5 : douleurs prod stateful/scaling, spec finale stateless au 28/07/2026). On garde juste la **discipline de forme** qui rend la bascule future indolore.

---

## 7. Le playbook « absorber un nouveau module sans réécriture »

L'exigence du brief (« absorber les futurs modules métier sans réécriture »). Concrètement, quand un nouveau module ship, Mola gagne la parité en **5 gestes mécaniques** :

1. **RPC** : le module expose ses opérations en RPC `SECURITY DEFINER` (déjà la norme du repo).
2. **Types** : `/gen-types` régénère `types.ts` → les params RPC deviennent machine-lisibles.
3. **Outil + manifeste** : on ajoute l'outil (nom/desc/schema/permission/prepare-execute) **et** son entrée de parité → le test de dérive (§3) force la complétude.
4. **Carte des capacités** : on décrit le module + sa couverture (§4.1) → Mola sait en parler et connaît ses trous résiduels.
5. **Eval** : on ajoute 2-3 scénarios au jeu d'eval (Phase eval) → non-régression garantie.

Aucune réécriture du cerveau : on **étend des registres**, pas le moteur. C'est la définition opérationnelle de « évolue avec la plateforme ».

---

## 8. Principes de conception d'outil (granularité, idempotence, erreurs)

- **Granularité = les verbes métier**, ni méga-outil fourre-tout, ni 1 outil/colonne. On colle aux actions que l'admin pense (« créer un paiement », « valider un dépôt »). La v1 a déjà la bonne granularité — on la **maintient**.
- **Idempotence** : les outils d'écriture doivent survivre à un réessai réseau sans doublon. Aujourd'hui, la prise atomique `pending→executing` (`index.ts:1934`) empêche le double-tap, mais **pas** un double-create réseau au niveau RPC. → **clé d'idempotence** par action (déjà prévue CONCEPTION §9, non implémentée). À ajouter (phase impl).
- **L'erreur enseigne** : un outil renvoie une erreur **actionnable** qui apprend au modèle à se corriger — la v1 le fait déjà bien (`resolveClient` : « n'invente pas d'UUID, utilise search_clients », `index.ts:1110`). On **codifie ce style** pour tous les outils.
- **Permission héritée par outil** (conservé), + scoping du SQL libre par rôle (Phase sécurité ; QW-4 a posé la mitigation super_admin).

---

## 9. Coût / perf de ces mécanismes
- **Introspection** = lecture d'un petit doc (carte des capacités) récupéré just-in-time : quelques centaines de tokens, négligeable, et **caché** (préfixe stable).
- **Registre/test de parité** = coût **dev/CI** (un test), **zéro coût runtime**.
- **Gap log** = un INSERT occasionnel, négligeable.
- Bilan : ces mécanismes **réduisent** le coût total (moins de confabulations → moins de relances, moins d'allers-retours), pour un surcoût runtime ~nul. 🟡

---

## 10. Ce qu'on NE fait pas (calibrage)
- ❌ Codegen/déploiement d'outils autonome (risque fintech).
- ❌ Exposition automatique de **tous** les params RPC (certains exigent validation/transform).
- ❌ Infra MCP maintenant.
- ❌ Outil SQL libre généralisé à tous les rôles (cf. faille §6 diagnostic).

---

## 11. Décisions ouvertes (pour la phase d'implémentation)
- 🔴 Permission de `create_beneficiary` : `canProcessPayments` ou `canEditClients` ?
- 🔴 `set_rate_adjustment` : réservé `super_admin` (comme un quasi-taux) ou `canManageRates` suffit ?
- 🔴 Format de la carte des capacités : doc Markdown indexé (RAG) vs table `mola_capabilities` requêtable. *(Penche Markdown versionné dans le repo → une seule source, diffable en PR.)*
- 🔴 Parsing de `types.ts` pour le test de parité : AST TypeScript vs un export intermédiaire généré par `/gen-types`.

---

## 12. Prochaine étape
**Phase 4 — Mémoire en couches** (l'autre P0) : schéma pgvector, compaction, récupération just-in-time, profil utilisateur — c'est elle qui **sert** la carte des capacités (§4.1) et le savoir métier. OU **Phase sécurité** (exposition par rôle, version propre de QW-4) si tu préfères refermer la confidentialité d'abord. À trancher avec toi.

*Fin de la Phase 3.*
