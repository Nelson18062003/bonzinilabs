# Phase 4 — Recommandation argumentée

**Mode** : décision, pas de code.
**Sortie attendue** : une option principale + une fallback, conditions de bascule, risques résiduels.

---

## Recommandation principale ⭐ : Option F — Build maison Supabase en 2 lots rapprochés

**Cadence** :
- **Lot 1** (semaine 1, ~5-7 jours dev) → ship en prod à J+7.
- **Lot 2** (semaines 2-3, ~7-10 jours dev) → ship en prod à J+14 à J+17.

### Scope du Lot 1 — "Trust en 7 jours"

**Backend / DB** :
- Migration : tables `chat_conversations`, `chat_messages`.
- Bucket privé `chat-media` (politiques RLS : owner client + admin avec rôle support/customer_success/ops/super_admin).
- RLS sur les 2 tables : client voit ses propres conversations uniquement, admin avec `canAccessSupportChat` voit tout.
- RPC `mark_conversation_read(conversation_id)` côté client et côté admin.
- Trigger PG `on_new_client_message` → invoque Edge Function `notify-admin-telegram`.

**Edge Function `notify-admin-telegram`** :
- Lit `TELEGRAM_BOT_TOKEN` et `TELEGRAM_ADMIN_CHAT_IDS` depuis secrets.
- Envoie un message au bot avec : nom client, début du message (200 chars), deeplink `https://bonzini.app/m/support/:id`.
- Idempotence : ne notifie pas plus d'une fois par minute par conversation (anti-spam).

**Frontend client** :
- 6e onglet `BottomNav` "Support" (icône MessageCircle + badge non-lu).
- Page `/support` : conversation unique avec l'équipe Bonzini (pas une liste, un seul thread permanent par client).
- Input : texte + bouton 📎 (photo via `<input type="file" accept="image/*" capture="environment">`).
- Header avec "Équipe Bonzini" + statut "En ligne maintenant" / "Temps de réponse moyen aujourd'hui : N min".
- Calcul SLA : moyenne sur les 24 dernières heures des delays entre message client et première réponse admin, recalculé côté DB et envoyé via Realtime ou simple polling 5 min.
- i18n FR/EN/ZH (clés à ajouter dans `src/i18n/`).
- Permission `canAccessSupportChat` (default `true` pour tous les rôles client puisque c'est un canal client).

**Frontend admin** :
- Route `/m/support` (mobile) → liste conversations triées par dernier message, badge non-lu, recherche client.
- Route `/m/support/:conversationId` → vue conversation, mêmes capacités d'envoi que le client (texte + photo).
- Permission `canAccessSupportChat` étendue côté `user_roles` : true pour `super_admin`, `support`, `customer_success`, `ops`.
- Lien depuis `MobileClientDetailsScreen` → "Ouvrir la conversation support".

**Lot 1 non-buts** :
- Pas de voice messages (lot 2).
- Pas de vidéos ni PDF (lot 2).
- Pas d'indicateur "en train d'écrire" (lot 2 si jugé utile, sinon dropped).
- Pas d'accusé de lecture côté admin (lot 2).
- Pas de Web Push (jamais — décision actée).
- Pas de pièces jointes paiement automatiques (lot 3+ éventuel).

### Scope du Lot 2 — "Riche en 17 jours"

**Voice messages** :
- `MediaRecorder` côté client, format adaptatif : `audio/mp4` (Safari) / `audio/webm;codecs=opus` (Chrome/Firefox).
- Compression : bitrate 32 kbps pour 3G-friendly (~60 KB pour 15s).
- Affichage : waveform statique (généré côté client à l'upload) + bouton play.
- Durée max : 60s (preview WhatsApp-style).
- Fallback si `MediaRecorder` indisponible : masquer le bouton, message info "Voice non supporté sur votre navigateur, envoyez un message texte".

**Vidéo + PDF** :
- Réutilise `validateUploadFile()` étendu pour accepter `video/mp4`, `video/webm`, `application/pdf`.
- Compression vidéo : pas de transcoding serveur (coûteux). On limite à 30s + 10 MB, on s'appuie sur l'encodage natif du device.

**Accusé de lecture** :
- Colonne `read_at` côté `chat_messages` mise à jour via `mark_conversation_read`.
- Affichage : ✓ (envoyé) / ✓✓ (lu) côté client uniquement (admin n'a pas besoin de voir si client a lu).

**Indicateur "en train d'écrire"** :
- Supabase Broadcast channel par conversation, debounce 1s.
- À évaluer : utile en pratique seulement si admin répond en temps réel. Si latence > 30s en moyenne, drop cette feature.

**i18n complète** : EN + ZH (FR fait au lot 1).

### Pourquoi F gagne sur A

1. **Trust client commencé à J+7** au lieu de J+21. Trois semaines sans amélioration visible = silence produit qui sape l'effort marketing.
2. **Apprentissage produit avant de coder le plus risqué**. À J+7, on observe :
   - Ratio voice/texte attendu par les clients (questions, plaintes "où est le bouton micro").
   - Taille moyenne des photos uploadées sur 3G/4G CEMAC réelle.
   - Charge réelle de notification Telegram → pondère le volume papa+co peuvent absorber.
   - Latence admin réelle → décide si "typing indicator" et "accusé de lecture" valent leur effort.
3. **Risque iOS Safari voice isolé**. Si `MediaRecorder` foire sur un iOS spécifique en prod, le lot 1 reste live. On a 10 jours pour fallback proprement.
4. **Cadence motivante**. Pour une équipe 1.5 dev, voir un truc en prod à J+7 puis enrichir = bien meilleur moral que 3 semaines de tunnel.

---

## Recommandation fallback : Option A — Build maison one-shot

**Conditions de bascule de F vers A** (à arbitrer en fin de Lot 1) :
- **Si** un test rapide `MediaRecorder` côté iOS Safari révèle un blocage sérieux qui demande lui-même 3-5 jours de R&D → on a déjà payé la majorité du coût F, autant fusionner Lot 1+2 et ship en un seul gros lot.
- **Si** les retours utilisateurs du lot 1 sont massivement négatifs sur l'absence de voice (>30 % des conversations clients = "où est le bouton micro ?") → on annule le sprint d'apprentissage prévu entre lot 1 et lot 2, on enchaîne directement.
- **Si** une contrainte business externe oblige à ship "complet ou rien" (ex : annonce marketing planifiée à J+21 promettant voice) → A devient principal.

**Différence opérationnelle** : A = un seul gros sprint de 3 semaines avec ship à J+21. Même scope final que F.

---

## Décisions de Phase 4 verrouillées

### 1. Voice messages : oui, mais au Lot 2
**Rationale** : voice est non négociable (cadrage user). Mais pas indispensable jour 1 si :
- Le client voit "Temps de réponse moyen 7 min" dès le lot 1 → trust signal fort.
- Le client peut envoyer photos dès le lot 1 → couvre 60-70 % des cas réels en fintech B2B (preuves de paiement, captures d'écran d'erreur).
- Voice arrive en moins de 2 semaines après ouverture du module.

### 2. Web Push : non, jamais (au moins MVP). In-app only, point.
**Rationale** :
- iOS impose installation PWA écran d'accueil pour Web Push (friction inacceptable côté client).
- Notre marché CEMAC est très majoritairement mobile, donc on couvrirait Android+Desktop mais pas iOS → expérience incohérente.
- Le badge non-lu sur le 6e onglet `BottomNav` + le SLA affiché ("réponse moyenne 7 min") couvrent le besoin réel : rassurer que la réponse arrive vite.
- Le client revient naturellement vérifier dans les minutes qui suivent → comportement WhatsApp déjà ancré.
- Coût d'opportunité : Service Worker + VAPID + UX d'opt-in = 3-5 jours pour un gain marginal. À réinvestir dans la qualité de l'app principale.

### 3. Notification admin : bot Telegram dédié
**Rationale** :
- Ton père et 2-3 admins ont déjà Telegram (hypothèse à confirmer, sinon WhatsApp Web).
- Edge Function `notify-admin-telegram` = ~50 lignes, déclenchée par trigger PG.
- Anti-spam : 1 notif/min/conversation.
- Deeplink direct vers `/m/support/:id` → admin clique, ouvre app, répond.
- Pas besoin de Push natif côté admin → admin reste sur Telegram pour la veille, dans Bonzini pour répondre.

### 4. Pas de SLA contractuel, juste un SLA affiché informatif
**Rationale** :
- "Temps de réponse moyen aujourd'hui : 7 min" est calculé en live, pas garanti.
- Pas de mention contractuelle "réponse sous X minutes garantie" → évite friction légale.
- Si le SLA dérape (>30 min), on affiche un message neutre : "Notre équipe est en sollicitation forte aujourd'hui. Nous vous répondons au plus vite."

### 5. Assignation conversation : "premier qui répond"
**Rationale** :
- À 2-3 admins, pas besoin de claim/release. Le premier admin qui ouvre une conversation et répond crée de fait l'historique.
- Optionnel (lot 2) : colonne `assigned_to` mise à jour automatiquement à la première réponse, juste pour reporting interne. Pas de UX de claim explicite.

---

## Risques résiduels et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **`MediaRecorder` foire sur iOS Safari ancien** | Moyenne | Voice indisponible pour ~15 % des users | POC voice à J+8 (début lot 2) sur iPhone réel. Fallback gracieux : masquer bouton micro. |
| **Bot Telegram down ou rate-limited** | Faible | Admins ratent des messages | Fallback : afficher badge non-lu dans `/m/support` côté admin. Toute notification est best-effort, le badge est la source de vérité. |
| **Charge Realtime augmente > free tier** | Faible court terme | Coût Supabase passe en Pro (~$25/mois) | Monitorer à 1 mois. Acceptable. |
| **Photos uploadées sur 3G timeout** | Moyenne | Frustration client | Compression client-side avant upload (browser `canvas.toBlob()` quality 0.7). Lot 1 doit l'inclure. |
| **Admin tape une réponse insultante en colère** | Faible | Risque réputationnel | Pas de modération automatique au MVP. Lot 3 : ajouter `support_audit_log` qui garde tous les messages admin pour relecture par super_admin. |
| **Client envoie données sensibles (numéros carte, mot de passe)** | Faible | Risque sécurité | Disclaimer in-app : "Ne partagez jamais vos mots de passe ou codes." Pas de chiffrement E2E (overkill MVP), RLS protège entre clients. |
| **Conversation utilisée pour spam ou abus** | Faible | Distraction admins | Bouton "bloquer cette conversation" côté admin (lot 2 ou lot 3) → empêche client de poster. Rare en fintech B2B authentifié. |

---

## Ce que la phase 4 NE tranche PAS (à régler en phase 5 — plan d'implémentation)

- Le schéma SQL exact (colonnes, indexes, RLS policies écrites).
- L'arborescence des composants React (`SupportPage.tsx`, `ChatThread.tsx`, `MessageBubble.tsx`, `MessageInput.tsx`, `MediaPreview.tsx`).
- Le format exact des notifications Telegram (template du texte, boutons inline éventuels).
- Le calcul précis du SLA "temps de réponse moyen" (fenêtre 24h vs glissante, exclusion nuit, etc.).
- Le test plan : scénarios E2E à couvrir, jeux de données, devices à valider.
- Les hooks React (`useSupportConversation`, `useChatMessages`, `useUnreadCount`).
- L'ordre exact des 12-15 tickets de dev du lot 1.

---

**Fin Phase 4.** Validation attendue avant Phase 5 (plan d'implémentation détaillé du Lot 1 prêt à coder).
