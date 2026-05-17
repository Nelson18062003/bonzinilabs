# Déploiement Lot 3 + Lot 4 — Version complète

Ce déploiement complète les Lots 3+4 avec : variables dans templates, notifications Telegram sur assignation, graphiques de stats, CRUD admin pour quick replies, surlignage des recherches, réordonnancement des templates et quick replies.

## Pré-requis

Le déploiement Lots 1+2+3+4 (version "MVP") doit déjà être appliqué (commit fbe0204 sur la branche).

## Étapes manuelles

### 1. Appliquer la migration d'extension

Dans **SQL Editor Supabase** :

1. https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/sql/new
2. Coller le contenu de `supabase/migrations/20260531100000_chat_lot3_lot4_full.sql`
3. **Run** → "Success. No rows returned"

**Ce qu'elle fait** :
- Crée table `chat_assignment_events` (historique audit des claims/assigns)
- Étend la RPC `get_chat_admin_stats` : ajoute `daily_volume[]`, `response_buckets`, `median_response_seconds_global`
- Crée RPCs `reorder_canned_responses(uuid[])` et `reorder_quick_replies(uuid[])`
- Met à jour `claim_chat_conversation` et `assign_chat_conversation` pour logger l'historique

### 2. Déployer la nouvelle Edge Function `notify-admin-assignment`

Dans **Edge Functions** :

1. https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/functions
2. **Deploy a new function**
3. Nom : `notify-admin-assignment`
4. Coller le contenu de `supabase/functions/notify-admin-assignment/index.ts`
5. **Deploy**

Réutilise les secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_BASE_URL` déjà configurés.

### 3. Aucun nouveau secret, aucun nouveau webhook

Cette fonction est appelée directement depuis le frontend admin (fire-and-forget) après chaque claim/assign/unassign réussi.

---

## Tests E2E

### Côté admin

1. **Variables templates** :
   - Va dans **Plus → Templates support → +**
   - Crée un template : Label "Dépôt validé", Contenu : `Bonjour {{client_first_name}}, votre dépôt a été validé le {{today}}. Merci, {{admin_first_name}}.`
   - Tu vois en bas le **panel des variables** disponibles (cliquables pour insertion)
   - L'aperçu en violet montre le rendu avec des exemples ("Jean", "17 mai 2026", "Marie")
   - Sauve
   - Va dans une conversation client → bouton **templates violet** à gauche de l'input
   - Choisis le template → le texte injecté contient le **vrai prénom du client** et la **date du jour**

2. **Réordonnancement** :
   - Dans la liste des templates, chaque template a des flèches **↑↓** (super_admin uniquement)
   - Tap ↑ ou ↓ → reorder appliqué immédiatement en BDD

3. **Notification Telegram sur assignation** :
   - Sur une conv non-assignée → tap **"Je prends"**
   - Vérifie le groupe Telegram admin : `👤 Marie Durand a pris en charge la conv de Jean Dupont 👉 [lien]`
   - Tap ⋮ → "Assigner à un admin" → choisis quelqu'un → `📌 Marie a assigné la conv de Jean à Pierre`
   - "Personne (désassigner)" → `↩️ Marie a désassigné la conv de Jean`

4. **Statistiques avec graphiques** :
   - Dans la liste admin → icône **📊** → écran stats
   - Période 7/14/30 jours
   - **4 cards KPI** en haut avec médian indiqué sur "Réponse moy."
   - **Line chart "Volume quotidien"** : 2 courbes (Client orange + Bonzini violet) sur la période
   - **Bar chart "Distribution temps de réponse"** : 4 buckets (< 1 min, 1-5 min, 5-15 min, > 15 min) avec couleurs par tone (vert/violet/ambre/orange)
   - **Bar chart horizontal "Top 5 admins"** par volume de réponses
   - Section card "Performance par admin" (détail complet)

5. **Quick replies admin CRUD** :
   - Va dans **Plus → Quick replies clients**
   - Tu vois les 4 quick replies seedées du Lot 3
   - Tap **+** → crée "Question urgente" / "Bonjour, j'ai une urgence."
   - Réordonne via ↑↓
   - Tap l'icône **œil** pour désactiver une suggestion → barre opacity + badge "Inactive"
   - Modifie → édite label/contenu/active

6. **Recherche avec surlignage** :
   - Liste admin → barre de recherche → tape un mot
   - Les snippets des messages matchants apparaissent avec le mot **surligné en jaune ambre**

### Côté client

7. **Quick replies en action** :
   - Tu te connectes avec un compte client de test
   - Tap **+ Nouvelle conversation** → "Test multi-thread" → Créer
   - Dans la conv vide, les **suggestions configurées par l'admin** apparaissent en boutons violets
   - Tap un bouton → texte pré-rempli, modifiable avant envoi

---

## Rollback

```sql
-- Rollback de cette extension uniquement (garde le Lot 3+4 MVP fonctionnel)
DROP FUNCTION IF EXISTS public.reorder_canned_responses(UUID[]);
DROP FUNCTION IF EXISTS public.reorder_quick_replies(UUID[]);
DROP TABLE IF EXISTS public.chat_assignment_events CASCADE;
-- La RPC get_chat_admin_stats redevient celle du Lot 3 MVP — il faut la recréer
-- depuis la migration 20260531000000_chat_lot3_lot4.sql si besoin.
```

Côté Edge Functions : supprime `notify-admin-assignment` du dashboard.
Côté frontend : revert le commit.
