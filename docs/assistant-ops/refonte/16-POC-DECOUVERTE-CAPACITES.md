# PoC « capacités auto-découvertes » — Mola fait du neuf sans outil écrit à la main

> **But :** te montrer **concrètement** le comportement que tu cherches — l'étiquette sur l'opération + Mola qui **découvre et exécute** une action **sans qu'on lui ait codé un outil dédié**. À déployer pour le voir vivre.
> **Date :** 2026-06-03 · **Statut :** preuve de concept réelle (3 capacités pilotes) + caveats honnêtes.

---

## 1. L'ÉTIQUETTE (ce à quoi ça ressemble, sur tes vraies RPC)
On ne touche pas à la RPC. On lui **colle une étiquette** (un COMMENT en base), écrite au moment où on construit le module :

```sql
comment on function public.cancel_deposit(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits",
          "confirm":true,"danger":true,"label":"Annuler un dépôt",
          "resolve":{"p_deposit_id":"deposit"}}';
```
- `expose` : exposée à Mola ? (**défaut = non** → une RPC non étiquetée n'est JAMAIS exposée = sûr).
- `permission` / `confirm` / `danger` : la sécurité (rôle requis, carte de confirmation argent/sensible).
- `resolve` : « pour ce paramètre, Mola peut donner une **référence** (BZ-DP-…), je résous l'UUID ».

*(3 capacités pilotes étiquetées dans `20260603150000_mola_capability_discovery.sql` : `cancel_deposit`, `confirm_cash_payment`, `get_deposit_stats` — des actions que Mola ne savait PAS faire avant.)*

## 2. La DÉCOUVERTE
Une fonction `mola_discover_capabilities(search)` **scanne** les étiquettes + lit les **paramètres réels** (live, depuis le catalogue Postgres). Mola l'appelle via l'outil **`find_capability`**. ✅ *Extraction des étiquettes vérifiée 3/3.*

## 3. LE COMPORTEMENT (le flux complet, ce que tu verras)
Tu écris : **« annule le dépôt BZ-DP-2026-0042 »**

1. Mola cherche dans ses outils dédiés → **rien** pour « annuler un dépôt ».
2. *(Avant : il s'arrêtait là, ou inventait.)* **Maintenant** : il appelle `find_capability("annuler dépôt")`.
3. La découverte renvoie : `cancel_deposit`, paramètre `p_deposit_id uuid`, « confirmation requise, permission canProcessDeposits ».
4. Mola appelle `do_capability("cancel_deposit", { p_deposit_id: "BZ-DP-2026-0042" })`.
5. Le gateway : **vérifie ta permission** → **résout** BZ-DP-2026-0042 → l'UUID → **affiche une carte de confirmation** « Annuler un dépôt (sensible) ».
6. Tu **tapes Confirmer** → `cancel_deposit` s'exécute.

**→ Mola a fait une action pour laquelle PERSONNE n'a écrit d'outil.** Il l'a **découverte** et **exécutée**, en sécurité.

## 4. Pourquoi ça répond à ton vrai but
- **Nouveau module demain ?** Si ses opérations portent l'étiquette `@mola` (1 ligne, écrite avec le module), Mola les **découvre et les utilise tout seul** — **zéro réécriture côté IA**.
- **À l'échelle (500, 1200) ?** Pareil : pas d'outils à la main. Mola **cherche** la capacité utile à la demande (`find_capability`) au lieu de tout charger. Plus il y en a, plus cette approche est la seule qui tient.
- **Sûr ?** Permission par capacité + **carte de confirmation** sur l'argent/sensible. L'IA atteint tout, **exécute l'argent seulement avec ton tap**.

## 5. Caveats honnêtes (c'est un PoC, pas la version finale)
- **Permission** : vérifiée à la préparation (avant la carte) + le RPC sous-jacent garde son `is_admin`. La version prod re-vérifiera aussi **à la confirmation** par capacité (durcissement).
- **Résolveurs** : pour l'instant `deposit` / `payment` (par référence) + `client` (par UUID). À étendre (client par nom, comptes trésorerie…).
- **Lectures** : `do_capability` gère les **écritures** ; les lectures découvertes se font via `query_database`/outils dédiés (pas de carte pour une lecture).
- **Frontière infranchissable** : Mola exécute des opérations **qui existent**. Il n'**invente** pas une opération absente (ça voudrait dire écrire+déployer du code en prod — interdit sur une fintech).
- **Non testé en runtime ici** (pas de Deno/DB) : SQL + logique revus, extraction d'étiquette vérifiée 3/3, edge équilibré. **Preuve réelle = au déploiement.**

## 6. Si ce comportement te convient → l'industrialisation
1. **Étiqueter** les RPC (par domaine) : les ~24 manquantes → exposées ; les 12 internes → `expose:false` (ou rien). 1 ligne chacune, au fil de l'eau.
2. **Étendre les résolveurs** (client par nom, comptes…).
3. **Durcir** la permission à la confirmation + audit dédié.
4. **Migrer** progressivement les 19 outils faits-main vers des étiquettes (même garanties, moins de code).
5. **Plus tard** : exposer le même registre découvrable en **serveur MCP** (mcp-lite, doc 15) → Claude Desktop / autres clients.

## 7. À tester (au déploiement)
`npx supabase db push --linked` → `supabase functions deploy admin-assistant`, puis :
- « annule le dépôt BZ-DP-… » → Mola découvre `cancel_deposit` → carte → exécute.
- « confirme le paiement cash BZ-… signé par Awa » → découvre `confirm_cash_payment`.
- « quelles sont les stats des dépôts ? » → découvre `get_deposit_stats`.

*PoC posé. Si c'est bien CE comportement que tu veux, on étiquette toute la plateforme — et Mola n'est plus jamais plafonné.*
