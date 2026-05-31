# Assistant Directeur des Opérations (DO) — Plan de développement

> **À lire avec** [`CONCEPTION.md`](./CONCEPTION.md). Ce plan décrit *comment* on construit, phase par phase.
> **Principe :** on livre de la valeur **vite et sûr**. Chaque phase est utilisable seule, vérifiée (`type-check` + `build`), et — pour les écritures — passée en **revue de sécurité** avant livraison.

---

## 0. Règles de développement

- **Branche :** `claude/epic-newton-tNTY7`.
- **Vérification :** après chaque changement → `npm run type-check` ; avant de livrer → `npm run build` (skill `/verify`).
- **Design UI :** appliquer le framework de design (écrans distinctifs, couleurs du logo violet/ambre/orange, voix d'abord, gros boutons) avant d'écrire l'UI.
- **Sécurité :** revue de sécurité dédiée avant chaque lot d'écriture (Phases 2-4).
- **Deux clients Supabase :** tout ce qui est admin utilise `supabaseAdmin`. Ne jamais mélanger.
- **Migrations :** via `npx supabase db push --linked` ; régénérer les types après (`/gen-types`).

---

## Phase 0 — Fondations (l'ossature technique)

**But :** un squelette fonctionnel de bout en bout — l'admin écrit « bonjour », l'assistant répond (via Claude), rien d'autre. Aucune action métier encore.

### Backend
1. **Edge Function `admin-assistant`** (`supabase/functions/admin-assistant/`).
   - Secret `ANTHROPIC_API_KEY` (config Supabase).
   - Reçoit `{ conversation_id, messages }` + en-tête `Authorization: Bearer <JWT admin>`.
   - **Vérifie l'admin** : client Supabase créé avec le JWT → charge rôle + permissions (RLS s'applique). Refuse si non-admin.
   - **Adaptateur modèle** : interface `LLMProvider` + `AnthropicProvider` (tool-calling + streaming SSE).
   - **Boucle agentique** : modèle → (tool_use) → vérifie permission → exécute outil → tool_result → reboucle → texte final.
   - **Registre d'outils** : structure `{ name, description, schema, permission, kind: 'read'|'write', execute() }`. Vide au départ (rempli en Phase 1+).
2. **Persistance** (migration) : tables `assistant_conversations` (admin_id, titre, created_at) et `assistant_messages` (conversation_id, role, content JSONB, tool_calls, created_at). **RLS : l'admin ne voit que ses conversations.**

### Frontend
3. **Écran** `src/mobile/screens/assistant/MobileAssistantScreen.tsx` + route `/m/assistant` dans `App.tsx` (`<MobileRouteWrapper>`).
4. **Entrée de menu** dans `MobileMoreScreen.tsx` (icône `Sparkles`, libellé « Assistant »), **gardée par permission/rôle**. (Nom « Assistant » pour éviter la confusion avec « AgentCash ».)
5. **Hook** `src/hooks/useAdminAssistant.ts` : appelle l'edge function via `fetch()` (pas `.invoke()`), gère le **streaming** et l'état de conversation.
6. **UI chat** : réutiliser `src/components/support/*` (bulles, `MessageInput`, images). Zone de texte = compatible **dictée native**.

### DoD Phase 0
- [ ] On ouvre `/m/assistant`, on écrit, l'assistant répond en streaming via Claude.
- [ ] La conversation est persistée et rechargée.
- [ ] Accès gardé par permission ; `fetch` avec JWT OK (pas d'« Invalid JWT »).
- [ ] `type-check` + `build` verts.

---

## Phase 1 — « Il SAIT tout » (lecture / analytics)

**But :** l'assistant répond à **n'importe quelle question** sur la plateforme. Lecture seule → **aucun risque**.

### Travail
1. Implémenter les **outils de lecture** (cf. CONCEPTION §8.1) : `rechercher_clients`, `details_client`, `solde_wallet`, `lister_depots`, `details_depot`, `lister_paiements`, `details_paiement`, `lister_beneficiaires`, `taux_du_jour`, `resume_tresorerie`, `statistiques`, `historique_audit`.
   - Chaque outil = requête/RPC existante + **vérif de permission** (ex. `resume_tresorerie` exige `canViewTreasury`).
   - Réutiliser la logique des hooks existants (`useAdminDeposits`, dashboard stats…) côté serveur.
2. **Prompt système** (FR) : rôle de DO, ton, format des réponses (chiffres formatés `10 000 000 XAF`), règle « ne jamais inventer, citer le statut exact ».
3. **Rendu riche** côté front : petites cartes de réponse (KPI, statut d'un paiement) en plus du texte.

### DoD Phase 1
- [ ] Batterie de questions testées : *« volume de la semaine »*, *« paiements en cours »*, *« solde d'Awa »*, *« taux Alipay du jour »*, *« derniers dépôts rejetés »*…
- [ ] Les permissions sont respectées (un rôle limité n'obtient pas la trésorerie).
- [ ] Réponses exactes (recoupées avec l'app).
- [ ] `type-check` + `build` verts.

---

## Phase 2 — Créations sûres (écriture + confirmation)

**But :** le flux du fondateur : créer client → dépôt → validation → paiement, **avec carte de confirmation** sur l'argent.

### Travail
1. **Outils d'écriture** (cf. §8.2) mappés sur RPC existantes : `creer_client` (`admin_create_client`), `creer_depot` (`create_client_deposit`), `valider_depot` (`validate_deposit`), `creer_paiement` (`create_payment`), `completer_paiement` (`update_payment_beneficiary`), `attacher_capture` (upload + `submit_deposit_proof`).
2. **Cartes de confirmation** (composants front) : récap montant/moyen/client, boutons **[Confirmer]** / **[Modifier]**. L'edge function renvoie une **proposition d'action** ; le front l'affiche ; l'admin confirme → le front exécute (ou l'edge function exécute après réception du « confirm »).
3. **Idempotence** : clé d'idempotence par action (anti-doublon réseau).
4. **Capture « plus tard »** : créer/valider sans preuve, pastille « capture à ajouter », upload différé.
5. **Désambiguïsation** client (recherche avant création pour éviter les doublons).
6. **🔒 Revue de sécurité** de ce lot (caps, permissions, mass-assignment, audit).

### DoD Phase 2
- [ ] Scénario complet « nouvelle cliente + dépôt + validation + paiement » jouable au chat.
- [ ] Aucune action argent sans confirmation visuelle.
- [ ] Plafond 50M + `isSafeInteger` respectés ; doublons évités.
- [ ] Revue de sécurité passée ; audit complet.
- [ ] `type-check` + `build` verts.

---

## Phase 3 — Modifs, taux, annulations (sensible)

**But :** modifier des données, **définir le taux du jour**, annuler/rejeter — avec garde-fous renforcés.

### Travail
1. **Outils** (cf. §8.3) : `modifier_client`, `rejeter_depot` (`reject_deposit`), `annuler_paiement` (statut-aware), `definir_taux_du_jour` (`create_daily_rates`).
2. **`definir_taux_du_jour`** : **confirmation forte** (récap de l'impact « ce taux s'appliquera à tous les nouveaux paiements »), idéalement `super_admin`.
3. **Annulation statut-aware** : autorisée seulement aux statuts réversibles ; sinon refus + explication.
4. **🔒 Revue de sécurité**.

### DoD Phase 3
- [ ] Changement de taux testé (avec confirmation forte) ; ancien taux désactivé.
- [ ] Annulation refusée correctement sur un paiement déjà exécuté.
- [ ] Audit + permissions OK ; `type-check` + `build` verts.

---

## Phase 4 — « Suppressions » (archivage / inversion) — haut risque

**But :** offrir l'« effet supprimer » voulu, mais proprement (réversible, légal, tracé).

### Travail
1. **`archiver_client`** : soft-delete via `status` (le client disparaît des listes actives, l'historique reste).
2. **`inverser_depot`** : **nouvelle RPC** à concevoir — écriture comptable compensatoire dans `ledger_entries` (jamais de DELETE), avec `FOR UPDATE` sur le wallet.
3. Réservé `super_admin` + **confirmation forte** + audit détaillé.
4. **🔒 Revue de sécurité approfondie** (c'est le lot le plus dangereux).

### DoD Phase 4
- [ ] Archivage/inversion testés ; soldes cohérents ; rien n'est réellement supprimé.
- [ ] Réservé super_admin ; audit complet ; revue de sécurité passée.
- [ ] `type-check` + `build` verts.

---

## Transverse (toutes phases)

- **Coûts/observabilité :** log du nombre de tokens / coût par conversation ; prompt caching ; choix Haiku vs Sonnet.
- **Multi-modèle :** garder l'`LLMProvider` propre ; ajouter `OpenAIProvider`/`GeminiProvider` quand voulu.
- **i18n :** prompt système FR ; gérer le code-switching ; réponses dans la langue de l'admin.
- **Voix (option) :** plus tard, bouton micro intégré → Whisper/Deepgram (edge function de transcription séparée).
- **Tests :** unitaires sur les outils (entrées/permissions), e2e sur les scénarios clés.

---

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Erreur de montant (voix ou modèle) | Carte de confirmation + relecture + plafond + contrôle de plausibilité |
| Privilège escaladé via l'assistant | Permissions héritées de l'admin, vérifiées par outil ; pas de service-role aveugle |
| Action destructive | Pas de hard-delete : archivage/inversion tracée |
| Doublons (réseau) | Idempotence |
| Coût API qui dérape | Modèle économique + caching + budgets de tokens |
| Fuite de données sensibles | RLS strict sur conversations + rétention + pas d'intermédiaire (clé directe) |

---

## Prochaines actions immédiates

1. **Valider ce plan ensemble** (et trancher les décisions ouvertes — surtout le niveau de confirmation argent).
2. **Obtenir la clé API Anthropic** (console.anthropic.com) → la stocker en secret Supabase.
3. **Décider du point de départ concret :**
   - (a) **Prototype cliquable Phase 1** (faux backend) pour le test « ressenti » du père, **ou**
   - (b) **Phase 0 réelle** (ossature edge function + écran) directement.
