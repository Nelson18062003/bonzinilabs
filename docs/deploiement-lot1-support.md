# Déploiement Lot 1 — Chat Support

Étapes manuelles à effectuer **après** que la migration `20260516120000_chat_lot1.sql` soit poussée en prod.

## 1. Pousser la migration

```bash
npx supabase db push --linked
```

Cela crée tables, RLS, RPCs, bucket storage, vue temps de réponse, et active la publication Realtime.

## 2. Regénérer les types TypeScript

```bash
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
```

Une fois fait, les casts `as never` / `as unknown` dans `useClientChat.ts` et `useAdminChat.ts` peuvent être remplacés par les types générés. Pas bloquant : le code fonctionne déjà via les types métier locaux dans `src/types/chat.ts`.

## 3. Déployer l'Edge Function `notify-admin-chat`

```bash
npx supabase functions deploy notify-admin-chat
```

## 4. Configurer les secrets Edge

Les secrets `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` **existent déjà** sur le projet (utilisés par `telegram-bot` et `notify-admin`). On les réutilise.

Ajouter le seul nouveau secret nécessaire (URL du back-office admin) :

```bash
npx supabase secrets set ADMIN_BASE_URL=https://app.bonzini.com
```

(Remplacer par l'URL réelle de prod.)

## 5. Créer la Database Webhook (action UI obligatoire)

Le projet n'a pas `pg_net` activé, donc le trigger PG ne peut pas appeler directement l'Edge Function. À la place, on configure une **Database Webhook** via le dashboard Supabase :

1. Aller sur https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/database/hooks
2. Cliquer **Create a new hook**
3. Nom : `chat_messages_notify_admin`
4. Conditions :
   - Table : `chat_messages`
   - Events : `Insert` uniquement
5. Type : `HTTP Request`
6. Méthode : `POST`
7. URL : `https://fmhsohrgbznqmcvqktjw.functions.supabase.co/notify-admin-chat`
8. HTTP Headers :
   - `Content-Type: application/json`
   - `Authorization: Bearer <SERVICE_ROLE_KEY>` (à récupérer dans Project Settings → API)
9. Cliquer **Create webhook**

La fonction filtre déjà `sender_type=client` côté Deno donc inutile d'ajouter un filtre conditionnel dans la webhook UI.

## 6. Tester en prod

1. Se connecter avec un compte client de test → onglet Support en bas → envoyer un message texte.
2. Vérifier dans le groupe Telegram admin qu'une notification arrive en moins de 5 secondes.
3. Cliquer le lien dans Telegram → atterrit sur `/m/support/:id` (login admin requis si déconnecté).
4. Répondre depuis l'admin → vérifier que le client voit la réponse en temps réel.
5. Envoyer une photo (2 Mo) côté client → admin la reçoit avec preview.

## 7. Anti-spam Telegram

L'Edge Function ne notifie pas si un autre message du même client est arrivé dans les 30 dernières secondes. Logique implémentée dans `notify-admin-chat/index.ts:75-90`.

## 8. Permissions

La permission `canAccessSupportChat` est activée pour : `super_admin`, `ops`, `support`, `customer_success`. Pas pour `cash_agent` ni `treasurer`. Voir `src/contexts/AdminAuthContext.tsx`.

## Rollback

Si problème majeur :

```sql
-- Désactiver via UI : Database → Webhooks → désactiver chat_messages_notify_admin

-- Supprimer les tables
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;
DROP FUNCTION IF EXISTS public.update_chat_conversation_on_message();
DROP FUNCTION IF EXISTS public.is_support_admin(UUID);
DROP FUNCTION IF EXISTS public.mark_conversation_read_client(UUID);
DROP FUNCTION IF EXISTS public.mark_conversation_read_admin(UUID);
DROP FUNCTION IF EXISTS public.chat_avg_response_seconds_today();
DELETE FROM storage.buckets WHERE id = 'chat-media';
```

Et retirer le 6e onglet `/support` dans `BottomNav.tsx` + route dans `App.tsx`.
