# Déploiement Lot 3 + Lot 4 — Outillage admin + confort client

## Pré-requis

Lots 1 et 2 déployés et fonctionnels.

## Étapes manuelles (interface web Supabase)

### 1. Appliquer la migration SQL unique

Une seule migration cette fois — elle contient tout (A à H).

1. Va sur https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/sql/new
2. Ouvre le fichier : `supabase/migrations/20260531000000_chat_lot3_lot4.sql` (branche `claude/chat-solution-evaluation-ReKZS`)
3. Copie tout son contenu
4. Colle dans le SQL Editor
5. Clique **Run**
6. "Success. No rows returned" attendu

**Ce qu'elle fait** :
- DROP UNIQUE sur `chat_conversations.client_id` → autorise plusieurs convs par client
- Ajoute colonnes `subject` et `assigned_admin_id`
- Crée tables `chat_canned_responses`, `chat_client_quick_replies`, `chat_message_reactions`
- Crée RPCs : `claim_chat_conversation`, `assign_chat_conversation`, `close_chat_conversation`, `reopen_chat_conversation`, `search_chat_conversations`, `get_chat_admin_stats`
- Index GIN pour recherche full-text
- Trigger auto-réouverture sur INSERT message
- Seed 4 quick replies par défaut
- Réactions ajoutées à la publication Realtime

### 2. Vérification rapide (optionnel)

Dans SQL Editor :

```sql
-- Doit afficher les 4 quick replies par défaut
SELECT label FROM chat_client_quick_replies ORDER BY sort_order;

-- Doit retourner un JSONB de stats
SELECT get_chat_admin_stats(7);
```

### 3. Pas d'Edge Function à mettre à jour

Le webhook existant continue de fonctionner. Aucune modification serveur supplémentaire.

### 4. Pas de nouveau secret

Tout réutilise l'infrastructure existante.

---

## Tests E2E une fois le frontend déployé

### Côté client (toi sur un compte test)

1. **Multi-thread** :
   - Va dans Support → tu vois maintenant **une liste de conversations** (plus directement le chat)
   - Tap **+ Nouvelle conversation** → tape un sujet ("Question urgente") → Créer
   - Tu arrives dans une nouvelle conv vide
   - Reviens en arrière → tu vois 2 conversations dans la liste

2. **Quick replies** :
   - Dans une conversation vide, tu vois 4 boutons suggérés ("Comment ça marche ?", etc.)
   - Tap un bouton → le texte est pré-rempli dans l'input → tu peux le modifier avant envoi

3. **Réactions emoji** :
   - **Appui long** sur n'importe quel message → menu apparaît avec "Réagir" en premier
   - Tap "Réagir" → 6 emojis (👍 ❤️ ✅ 😂 😮 🙏) → choisis un
   - L'emoji s'affiche en pill sous la bulle, en violet (toi)
   - Re-tap le même pill → la réaction est retirée

### Côté admin (ton père / toi sur compte admin)

4. **Templates** :
   - Va dans **Plus → Templates support**
   - Tap **+** → "Dépôt validé" / "Votre dépôt de XXX a été validé. Merci !"
   - Sauvegarde → le template apparaît dans la liste
   - Va dans une conversation client → bouton **violet "templates"** à gauche de l'input
   - Tap → modal des templates → tap un template → texte pré-rempli dans l'input

5. **Assignation** :
   - Sur une conv non-assignée → bouton **"Je prends"** en haut à droite
   - Tap → toast "Conversation prise en charge" → badge violet "À vous"
   - Tap **⋮** → "Assigner à un admin" → choisis quelqu'un d'autre → toast confirmation

6. **Fermeture / réouverture** :
   - Tap **⋮** → "Clore la conversation" → toast
   - Bandeau "Conversation fermée" apparaît en bas
   - Reviens à la liste → filtre "Ouvertes" ne la montre plus, filtre "Fermées" la montre
   - Si le client renvoie un message → la conv se rouvre automatiquement (trigger SQL)

7. **Recherche full-text** :
   - Dans la liste admin → barre de recherche en haut → tape un mot (>= 2 caractères)
   - Les conversations contenant ce mot dans n'importe quel message apparaissent

8. **Filtres** :
   - Filtres par assignation : "Toutes" / "Mes convs" / "Non assignées"
   - Filtres par statut : "Ouvertes" / "Toutes" / "Fermées"
   - Combinables avec la recherche

9. **Statistiques** :
   - Dans la liste admin → icône **📊** en haut à droite → écran stats
   - Choisis période 7d / 14d / 30d
   - Cards : conv ouvertes, messages totaux, non-assignées, temps de réponse moyen
   - Liste "Performance par admin" avec nombre de réponses et temps moyen par admin

---

## Rollback total

Si problème majeur (improbable, mais juste au cas où) :

```sql
-- Restaure le mono-thread (peut casser si plusieurs convs/client existent déjà)
DROP TABLE IF EXISTS public.chat_message_reactions CASCADE;
DROP TABLE IF EXISTS public.chat_client_quick_replies CASCADE;
DROP TABLE IF EXISTS public.chat_canned_responses CASCADE;

DROP FUNCTION IF EXISTS public.get_chat_admin_stats(INTEGER);
DROP FUNCTION IF EXISTS public.search_chat_conversations(TEXT);
DROP FUNCTION IF EXISTS public.reopen_chat_conversation(UUID);
DROP FUNCTION IF EXISTS public.close_chat_conversation(UUID);
DROP FUNCTION IF EXISTS public.claim_chat_conversation(UUID);
DROP FUNCTION IF EXISTS public.assign_chat_conversation(UUID, UUID);
DROP FUNCTION IF EXISTS public.auto_reopen_chat_on_message();

DROP TRIGGER IF EXISTS trg_chat_msg_auto_reopen ON public.chat_messages;
DROP INDEX IF EXISTS idx_chat_messages_content_fts;

ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS assigned_admin_id;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS subject;
-- Recréer la contrainte UNIQUE après avoir dédupliqué manuellement si nécessaire
-- ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_client_unique UNIQUE (client_id);
```

Puis revert le commit côté Git.
