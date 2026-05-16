# Phase 5 — Plan d'implémentation détaillé du Lot 1

**Mode** : analyse, pas de code écrit avant validation phase 6.
**Périmètre** : Lot 1 uniquement (texte + photos). Voice/vidéo/fichiers = Lot 2 (doc séparé).
**Décisions héritées des phases 0-4** :
- Build maison Supabase, recommandation F validée (2 lots rapprochés).
- In-app only côté client (pas de Web Push, jamais).
- Bot Telegram pour notifier les admins.
- 6e onglet BottomNav côté client.
- Rôles admin avec accès : `super_admin`, `support`, `customer_success`, `ops`.
- 2-3 admins simultanés → assignation simple (pas de queue/claim/release sophistiqué).

---

## 1. Scope précis du Lot 1 — IN et OUT

### IN (Lot 1)
- Une conversation unique par client (pas de threading par sujet).
- Messages texte (plain text, 2000 caractères max).
- Messages image (jpg/png/webp, 5 MB max).
- Liste conversations admin avec tri "non-lus en premier" → "plus récent ensuite".
- Compteur non-lu côté client + côté admin.
- Realtime via Supabase Broadcast/Postgres Changes.
- Notification Telegram à chaque message client → admins.
- Affichage "Temps de réponse moyen aujourd'hui : X min" en haut du chat client.
- Permission `canAccessSupportChat` (true pour les 4 rôles admin cités).
- i18n FR/EN/ZH.
- 6e onglet `BottomNav` côté client : icône `MessageCircle`, label "Support".

### OUT (Lot 2 ou plus tard)
- Voice messages (Lot 2).
- Vidéo (Lot 2).
- Fichiers PDF/Excel/Word (Lot 2).
- Indicateur "en train d'écrire" (Lot 2).
- Accusé de lecture précis "vu à HH:mm" (Lot 2 — au Lot 1 on a juste read_at en DB mais pas affiché).
- Assignation manuelle d'une conversation à un admin (pas besoin au début, l'idée du "premier admin qui répond" suffit à 2-3).
- Fermeture/archivage de conversation (gardé "open" en permanence au Lot 1).
- Réponses pré-enregistrées / canned responses (Lot 3 éventuel).
- Email de relance (jamais selon ta réponse précédente).
- Web Push (jamais selon ta réponse précédente).
- Statistiques admin (volume, SLA, top contributeurs) — possiblement Lot 3.

---

## 2. Schéma SQL — tables + indexes

Fichier migration : `supabase/migrations/20260516_chat_lot1_schema.sql`

```sql
-- ============================================================================
-- Lot 1 : Chat support in-app — schema
-- ============================================================================

CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_at timestamptz,
  last_client_message_at timestamptz,
  last_admin_message_at timestamptz,
  unread_count_client integer NOT NULL DEFAULT 0,
  unread_count_admin integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_client_unique UNIQUE (client_id)
  -- 1 seule conversation par client au Lot 1 (simplifie tout)
);

CREATE INDEX idx_chat_conv_status_lastmsg
  ON chat_conversations (status, last_message_at DESC NULLS LAST)
  WHERE status = 'open';

CREATE INDEX idx_chat_conv_unread_admin
  ON chat_conversations (unread_count_admin DESC, last_client_message_at DESC)
  WHERE unread_count_admin > 0;

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'admin')),
  sender_id uuid NOT NULL,
  -- sender_id pointe vers clients.id si sender_type='client', vers user_roles.id si 'admin'
  -- pas de FK pour éviter contrainte cross-table, validation applicative
  content text,
  media_url text,
  media_type text CHECK (media_type IN ('image')),  -- 'voice','video','file' arriveront au Lot 2
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_content_or_media CHECK (
    content IS NOT NULL OR media_url IS NOT NULL
  ),
  CONSTRAINT chat_messages_content_length CHECK (
    content IS NULL OR char_length(content) <= 2000
  )
);

CREATE INDEX idx_chat_messages_conv_created
  ON chat_messages (conversation_id, created_at DESC);

CREATE INDEX idx_chat_messages_unread
  ON chat_messages (conversation_id, sender_type, read_at)
  WHERE read_at IS NULL;

-- Trigger : mise à jour automatique des compteurs et timestamps
CREATE OR REPLACE FUNCTION update_chat_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'client' THEN
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at,
        last_client_message_at = NEW.created_at,
        unread_count_admin = unread_count_admin + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at,
        last_admin_message_at = NEW.created_at,
        unread_count_client = unread_count_client + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_msg_update_conversation
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversation_on_message();
```

**Pourquoi `UNIQUE (client_id)`** : un client a UNE conversation à vie. Plus simple à raisonner, suffit largement pour MVP. Si plus tard on veut threading multi-sujet, on ajoute `subject text` et on relâche la contrainte.

**Pourquoi pas de FK sur `sender_id`** : Postgres ne permet pas une FK conditionnelle. La validation se fait via RLS + applicatif (`useUser()` → `clientId` ou `adminId`).

---

## 3. RLS policies — écrites mot pour mot

```sql
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_conversations : SELECT
CREATE POLICY chat_conv_select_client
  ON chat_conversations FOR SELECT
  USING (
    -- client voit sa conversation
    client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
  );

CREATE POLICY chat_conv_select_admin
  ON chat_conversations FOR SELECT
  USING (
    -- admin support actif voit toutes les conversations
    is_admin() AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE auth_user_id = auth.uid()
        AND role IN ('super_admin', 'support', 'customer_success', 'ops')
        AND is_disabled = false
    )
  );

-- chat_conversations : INSERT (création initiale par le client uniquement)
CREATE POLICY chat_conv_insert_client
  ON chat_conversations FOR INSERT
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
  );

-- chat_conversations : UPDATE (mise à jour compteurs non-lus uniquement via RPC)
-- Pas de policy UPDATE directe — toutes les MAJ passent par les RPCs ci-dessous.

-- chat_messages : SELECT
CREATE POLICY chat_msg_select_client
  ON chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY chat_msg_select_admin
  ON chat_messages FOR SELECT
  USING (
    is_admin() AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE auth_user_id = auth.uid()
        AND role IN ('super_admin', 'support', 'customer_success', 'ops')
        AND is_disabled = false
    )
  );

-- chat_messages : INSERT
CREATE POLICY chat_msg_insert_client
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_type = 'client'
    AND sender_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    AND conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE client_id = sender_id AND status = 'open'
    )
  );

CREATE POLICY chat_msg_insert_admin
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_type = 'admin'
    AND is_admin()
    AND sender_id IN (
      SELECT id FROM user_roles
      WHERE auth_user_id = auth.uid()
        AND role IN ('super_admin', 'support', 'customer_success', 'ops')
        AND is_disabled = false
    )
  );

-- Pas de UPDATE/DELETE sur chat_messages → messages immuables, audit trail intact
```

**RPCs pour les opérations protégées** :

```sql
-- Marquer comme lu côté client
CREATE OR REPLACE FUNCTION mark_conversation_read_client(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id INTO v_client_id FROM clients WHERE auth_user_id = auth.uid();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Not a client';
  END IF;

  UPDATE chat_conversations
  SET unread_count_client = 0
  WHERE id = p_conversation_id AND client_id = v_client_id;

  UPDATE chat_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'admin'
    AND read_at IS NULL;
END;
$$;

-- Pareil côté admin
CREATE OR REPLACE FUNCTION mark_conversation_read_admin(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;

  UPDATE chat_conversations
  SET unread_count_admin = 0
  WHERE id = p_conversation_id;

  UPDATE chat_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'client'
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_conversation_read_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_conversation_read_admin(uuid) TO authenticated;
```

---

## 4. Storage bucket `chat-media`

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,  -- privé, URLs signées
  5242880,  -- 5 MB Lot 1 (sera 25 MB au Lot 2 pour vidéo)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Path convention : {conversation_id}/{message_id}.{ext}
-- Le frontend insère d'abord le message (sans media_url), récupère message_id,
-- upload le fichier, puis UPDATE le message avec l'URL signée.
-- Alternative plus simple : upload d'abord, message ensuite avec l'URL.
-- → Décision Lot 1 : upload d'abord, message ensuite (1 INSERT au lieu d'un UPDATE).

CREATE POLICY chat_media_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-media'
    AND (
      -- client voit les médias de sa conversation
      (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM chat_conversations
        WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
      )
      OR
      -- admin support voit tout
      (is_admin() AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE auth_user_id = auth.uid()
          AND role IN ('super_admin', 'support', 'customer_success', 'ops')
          AND is_disabled = false
      ))
    )
  );

CREATE POLICY chat_media_insert_client
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM chat_conversations
      WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY chat_media_insert_admin
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND is_admin() AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE auth_user_id = auth.uid()
        AND role IN ('super_admin', 'support', 'customer_success', 'ops')
        AND is_disabled = false
    )
  );
```

---

## 5. Realtime config

```sql
-- Activer Postgres Changes pour les deux tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
```

**Côté frontend** :
- Client : subscribe à `chat_messages` filtré `conversation_id=eq.{my_conv_id}` + à `chat_conversations` filtré `id=eq.{my_conv_id}` (pour les compteurs).
- Admin : subscribe à `chat_conversations` (tous, pour la liste) + à `chat_messages` filtré sur la conversation actuellement ouverte.

---

## 6. Vue "temps de réponse moyen"

```sql
-- Pour chaque message client, on cherche le premier message admin postérieur
-- dans la même conversation, et on calcule le delta.
CREATE OR REPLACE VIEW chat_response_pairs AS
SELECT
  client_msg.id AS client_message_id,
  client_msg.conversation_id,
  client_msg.created_at AS client_at,
  admin_reply.created_at AS admin_at,
  EXTRACT(EPOCH FROM (admin_reply.created_at - client_msg.created_at)) AS delta_seconds
FROM chat_messages client_msg
JOIN LATERAL (
  SELECT created_at FROM chat_messages
  WHERE conversation_id = client_msg.conversation_id
    AND sender_type = 'admin'
    AND created_at > client_msg.created_at
  ORDER BY created_at ASC
  LIMIT 1
) AS admin_reply ON true
WHERE client_msg.sender_type = 'client';

CREATE OR REPLACE FUNCTION chat_avg_response_seconds_today()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    AVG(delta_seconds)::integer,
    300  -- défaut 5 min si aucune donnée pour ne pas afficher 0
  )
  FROM chat_response_pairs
  WHERE client_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Douala');
$$;

GRANT EXECUTE ON FUNCTION chat_avg_response_seconds_today() TO authenticated, anon;
```

**Affichage côté client** : "Temps de réponse moyen aujourd'hui : 7 min" (formaté en JS, plafonné à 60 min pour éviter d'afficher un chiffre démoralisant les jours creux).

---

## 7. Edge Function `notify-admin-telegram`

Fichier : `supabase/functions/notify-admin-telegram/index.ts`

**Architecture choisie** : trigger PG → `pg_net.http_post` → Edge Function → Telegram Bot API.

```sql
-- Trigger PG qui appelle l'Edge Function
CREATE OR REPLACE FUNCTION notify_telegram_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_last_notif_at timestamptz;
BEGIN
  -- Anti-spam : si le dernier message client < 30 secondes, on ne re-notifie pas
  SELECT created_at INTO v_last_notif_at
  FROM chat_messages
  WHERE conversation_id = NEW.conversation_id
    AND sender_type = 'client'
    AND id != NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_notif_at IS NOT NULL AND NEW.created_at - v_last_notif_at < interval '30 seconds' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := current_setting('app.settings.edge_url') || '/notify-admin-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_notify_client_msg
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'client')
  EXECUTE FUNCTION notify_telegram_on_client_message();
```

**Edge Function** (TypeScript Deno) :

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!
const ADMIN_BASE_URL = Deno.env.get('ADMIN_BASE_URL')!  // ex: https://admin.bonzini.com

Deno.serve(async (req) => {
  const { conversation_id, message_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupère message + client
  const { data: msg } = await supabase
    .from('chat_messages')
    .select('content, media_url, media_type, conversation_id')
    .eq('id', message_id)
    .single()

  if (!msg) return new Response('Message not found', { status: 404 })

  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('client_id')
    .eq('id', conversation_id)
    .single()

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', conv!.client_id)
    .single()

  const preview = msg.content
    ? msg.content.slice(0, 120)
    : (msg.media_type === 'image' ? '🖼️ Photo' : 'Pièce jointe')

  const text = [
    `💬 Nouveau message support`,
    ``,
    `👤 ${client?.name ?? 'Client inconnu'}`,
    `💭 ${preview}`,
    ``,
    `👉 ${ADMIN_BASE_URL}/m/support/${conversation_id}`,
  ].join('\n')

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    }
  )

  if (!res.ok) {
    console.error('Telegram error', await res.text())
    return new Response('Telegram failed', { status: 500 })
  }

  return new Response('ok')
})
```

**Secrets à configurer** (Supabase Dashboard → Project Settings → Edge Functions → Secrets) :
- `TELEGRAM_BOT_TOKEN` — obtenu via `@BotFather` sur Telegram.
- `TELEGRAM_ADMIN_CHAT_ID` — ID du groupe Telegram admin (ou DM). Récupéré en envoyant un message au bot puis en lisant `getUpdates`.
- `ADMIN_BASE_URL` — `https://admin.bonzini.com` ou équivalent.

**Settings PostgreSQL** :
```sql
ALTER DATABASE postgres SET app.settings.edge_url = 'https://fmhsohrgbznqmcvqktjw.functions.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

**Setup bot Telegram** (à faire une fois manuellement) :
1. Ouvrir Telegram → `@BotFather` → `/newbot` → nommer `Bonzini Support Bot`.
2. Récupérer le token, le mettre dans `TELEGRAM_BOT_TOKEN`.
3. Créer un groupe Telegram "Bonzini Support" → ajouter le bot + les admins humains.
4. Envoyer un message dans le groupe, puis appeler `https://api.telegram.org/bot{TOKEN}/getUpdates` → noter le `chat.id` (négatif pour les groupes).
5. Le mettre dans `TELEGRAM_ADMIN_CHAT_ID`.

---

## 8. Structure de fichiers frontend

### Client app (`src/`)
```
src/
  pages/
    SupportPage.tsx                 # nouvelle page, route /support
  components/
    support/
      ChatThread.tsx                # zone scrollable des messages
      MessageBubble.tsx             # bulle individuelle
      MessageInput.tsx              # textarea + bouton photo + bouton envoyer
      ResponseTimeBadge.tsx         # "Réponse moyenne 7 min"
      EmptyChatState.tsx            # état vide avec illustration + CTA
      ImageMessage.tsx              # affichage image cliquable → lightbox
  hooks/
    useChatConversation.ts          # récupère/crée la conv du client courant
    useChatMessages.ts              # récupère + subscribe Realtime
    useAvgResponseTime.ts           # appelle chat_avg_response_seconds_today()
  lib/
    chat-upload.ts                  # upload image, retourne URL signée
```

### Admin app (`src/admin/` ou structure existante)
```
src/
  pages/admin/
    MobileSupportListScreen.tsx     # /m/support — liste conversations
    MobileSupportConversationScreen.tsx  # /m/support/:id — chat individuel
  components/admin/support/
    ConversationListItem.tsx        # ligne dans la liste
    AdminMessageBubble.tsx          # variante visuelle admin
    AdminMessageInput.tsx           # similaire au client
  hooks/
    useAdminConversations.ts        # liste filtrée + tri non-lu
    useAdminChatMessages.ts         # idem côté admin avec supabaseAdmin
```

### Permissions

Ajouter dans `src/lib/permissions.ts` (ou équivalent) :
```typescript
canAccessSupportChat: ['super_admin', 'support', 'customer_success', 'ops'].includes(role) && !isDisabled
```

### Route + BottomNav

`src/components/BottomNav.tsx` : ajout du 6e onglet
```typescript
{ to: '/support', icon: MessageCircle, label: t('nav.support'), badge: unreadCount }
```

Le `unreadCount` provient d'un hook léger `useUnreadSupport()` qui subscribe à `chat_conversations` filtré sur le client courant.

---

## 9. Spec composants — détails clés

### `SupportPage.tsx`
- Vérifie que le client a une conversation, sinon la crée à la volée.
- Affiche `<ResponseTimeBadge />` en haut.
- Affiche `<ChatThread />` au milieu (scrollable, scroll-to-bottom au mount).
- Affiche `<MessageInput />` en bas, sticky.
- Appelle `mark_conversation_read_client` au mount + à chaque nouveau message admin reçu.

### `ChatThread.tsx`
- Liste virtualisée ? Non, pas au Lot 1 (max ~200 messages, pas besoin).
- Group messages par jour : séparateur "Aujourd'hui", "Hier", "12 mai".
- Affiche `<MessageBubble />` ou `<ImageMessage />` selon le type.
- Auto-scroll au nouveau message si l'utilisateur est déjà en bas (sinon affiche un bouton "↓ Nouveau message").

### `MessageInput.tsx`
- Textarea multi-ligne auto-grow (max 5 lignes visibles).
- Bouton photo (`<input type="file" accept="image/*" capture="environment">`) — `capture` pour ouvrir directement la caméra sur mobile.
- Validation côté client : `validateUploadFile(file, ['image/jpeg', 'image/png', 'image/webp'], 5 * 1024 * 1024)`.
- Enter = envoyer, Shift+Enter = nouvelle ligne (desktop). Sur mobile : bouton "Envoyer" visible.
- État `sending` désactive le bouton et affiche un spinner.
- Échec d'envoi : toast + message reste dans le textarea pour retry.

### `ResponseTimeBadge.tsx`
- Appelle `chat_avg_response_seconds_today()` au mount + toutes les 5 min.
- Affiche "Réponse moyenne aujourd'hui : 7 min" avec icône `Clock`.
- Plafonné à 60 min côté frontend, en dessous affiche en secondes ("Réponse moyenne aujourd'hui : 45 sec").
- Couleur : vert si <10 min, ambre si 10-30 min, orange si >30 min (cohérence palette landing).

### `EmptyChatState.tsx`
- Illustration (icône `MessageCircleHeart` ou équivalent, grande, en violet).
- Titre : "L'équipe Bonzini est là pour vous aider".
- Sous-titre : "Posez vos questions sur un paiement, un taux, ou n'importe quoi d'autre. Réponse en moins de 10 minutes en moyenne."
- Affiche aussi `<ResponseTimeBadge />` pour la cohérence.

### `MobileSupportListScreen.tsx`
- Liste triée : non-lus en premier (badge rouge avec count), puis par `last_message_at DESC`.
- Chaque ligne : nom client, dernier message (preview 60 chars), timestamp relatif ("il y a 3 min"), badge non-lu.
- Filtre rapide en haut : "Tous" / "Non-lus uniquement".
- Recherche par nom client (input simple, filter en frontend).
- Tap → ouvre `/m/support/:id`.

### `MobileSupportConversationScreen.tsx`
- Header avec nom client, bouton retour, info "client depuis X".
- Lien deeplink vers la fiche client (`/m/clients/:id`).
- Reste = mêmes composants que côté client mais avec `supabaseAdmin`.
- Appelle `mark_conversation_read_admin` au mount + à chaque nouveau message client reçu.

---

## 10. i18n — clés à ajouter (FR / EN / ZH)

Fichier : `src/lib/i18n/` (selon structure existante)

```json
{
  "nav.support": {
    "fr": "Support",
    "en": "Support",
    "zh": "客服"
  },
  "support.title": {
    "fr": "Équipe Bonzini",
    "en": "Bonzini Team",
    "zh": "Bonzini 团队"
  },
  "support.subtitle": {
    "fr": "Nous sommes là pour vous aider",
    "en": "We're here to help",
    "zh": "我们在这里为您服务"
  },
  "support.empty.title": {
    "fr": "L'équipe Bonzini est là pour vous aider",
    "en": "The Bonzini team is here for you",
    "zh": "Bonzini 团队随时为您服务"
  },
  "support.empty.subtitle": {
    "fr": "Posez vos questions sur un paiement, un taux, ou autre.",
    "en": "Ask us about a payment, an exchange rate, or anything else.",
    "zh": "关于付款、汇率或其他任何问题，请告诉我们。"
  },
  "support.input.placeholder": {
    "fr": "Écrivez votre message…",
    "en": "Write your message…",
    "zh": "输入您的消息…"
  },
  "support.input.send": {
    "fr": "Envoyer",
    "en": "Send",
    "zh": "发送"
  },
  "support.responseTime.label": {
    "fr": "Réponse moyenne aujourd'hui",
    "en": "Average response today",
    "zh": "今日平均响应时间"
  },
  "support.responseTime.minutes": {
    "fr": "{count} min",
    "en": "{count} min",
    "zh": "{count} 分钟"
  },
  "support.responseTime.seconds": {
    "fr": "{count} sec",
    "en": "{count} sec",
    "zh": "{count} 秒"
  },
  "support.image.upload.error.size": {
    "fr": "Image trop volumineuse (max 5 Mo)",
    "en": "Image too large (max 5 MB)",
    "zh": "图片太大（最大 5 MB）"
  },
  "support.image.upload.error.type": {
    "fr": "Format non supporté (JPG, PNG, WebP uniquement)",
    "en": "Format not supported (JPG, PNG, WebP only)",
    "zh": "不支持的格式（仅 JPG、PNG、WebP）"
  },
  "support.day.today": { "fr": "Aujourd'hui", "en": "Today", "zh": "今天" },
  "support.day.yesterday": { "fr": "Hier", "en": "Yesterday", "zh": "昨天" }
}
```

---

## 11. Ordre des tickets de dev — Lot 1

Total estimé : **5-7 jours pleins** pour 1 dev.

| # | Ticket | Effort | Dépend de | Sortie |
|---|---|---|---|---|
| 1 | Migration `20260516_chat_lot1_schema.sql` (tables, indexes, triggers compteurs) | 0.5j | — | DB schéma en place |
| 2 | Migration `20260516_chat_lot1_rls.sql` (RLS policies + 2 RPC `mark_*_read`) | 0.5j | #1 | Sécurité OK |
| 3 | Migration `20260516_chat_lot1_storage.sql` (bucket + policies storage) | 0.25j | #1 | Bucket prêt |
| 4 | Migration `20260516_chat_lot1_response_time.sql` (vue + RPC `chat_avg_response_seconds_today`) | 0.25j | #1 | Métrique dispo |
| 5 | Migration `20260516_chat_lot1_telegram_trigger.sql` (trigger PG + setup app.settings) | 0.25j | #1 | Trigger prêt |
| 6 | Edge Function `notify-admin-telegram` + secrets + bot BotFather | 0.5j | #5 | Notif Telegram fonctionne |
| 7 | `npx supabase gen types` + ajout permission `canAccessSupportChat` | 0.25j | #1-#5 | Types FR |
| 8 | Hooks `useChatConversation`, `useChatMessages`, `useAvgResponseTime` (client) | 0.5j | #7 | Data layer client OK |
| 9 | Composants client : `MessageBubble`, `ImageMessage`, `ChatThread`, `MessageInput`, `ResponseTimeBadge`, `EmptyChatState` | 1j | #8 | UI client OK |
| 10 | `SupportPage` + route `/support` + onglet `BottomNav` + badge non-lu | 0.5j | #9 | Module client live |
| 11 | Hooks admin `useAdminConversations`, `useAdminChatMessages` (avec `supabaseAdmin`) | 0.5j | #7 | Data layer admin OK |
| 12 | Composants admin : `ConversationListItem`, `AdminMessageBubble`, `AdminMessageInput` | 0.5j | #11 | UI admin OK |
| 13 | `MobileSupportListScreen` + `MobileSupportConversationScreen` + routes `/m/support` et `/m/support/:id` | 0.5j | #12 | Module admin live |
| 14 | i18n keys FR/EN/ZH (24 clés au total) | 0.25j | #9, #13 | i18n OK |
| 15 | Test plan E2E manuel : tableau ci-dessous | 0.5j | tout | QA OK |
| 16 | `/verify` (type-check + build) + commit + push + PR | 0.25j | tout | Mergé |

**Risques bloquants** :
- ⚠️ Si `pg_net` n'est pas activé : `CREATE EXTENSION pg_net;` requis (vérifier dans la console Supabase).
- ⚠️ Si on n'a pas accès au `service_role_key` côté DB : alternative = appel Edge Function via Database Webhook UI (à configurer manuellement dans le dashboard).
- ⚠️ Si `is_admin()` n'a pas exactement la signature attendue : adapter les RLS policies.

---

## 12. Test plan E2E — Lot 1

### Devices à tester (minimum vital)
| Device | OS | Browser | Pourquoi |
|---|---|---|---|
| iPhone 12+ | iOS 16+ | Safari | Cible #1 clients haut de gamme |
| iPhone SE | iOS 14 | Safari | Cible budget, viewport étroit |
| Samsung Galaxy A | Android 11+ | Chrome | Cible volume CEMAC |
| Desktop | Win/Mac | Chrome | Tests admin père |
| Desktop | Win | Firefox | Robustesse |

### Scénarios golden path
1. **Client envoie premier message** : compose texte → tap envoyer → bulle apparaît + spinner court → bulle finalisée → bot Telegram pingue le groupe admin.
2. **Admin reçoit notif Telegram** : tape le lien → atterrit sur `/m/support/:id` après login si déconnecté → message client visible → tape réponse → envoie.
3. **Client voit la réponse en temps réel** : sans rafraîchir, bulle admin apparaît → badge non-lu BottomNav passe de 0 à 1 → ouvre l'onglet Support → badge revient à 0.
4. **Client envoie une photo** : tap bouton photo → caméra s'ouvre → prend photo → preview → confirme → upload progress → bulle image apparaît → admin la voit.
5. **Temps de réponse moyen** : après plusieurs allers-retours dans la journée, le badge affiche un chiffre cohérent.

### Scénarios edge cases
6. **Photo trop lourde (>5 Mo)** : tentative d'upload → toast d'erreur clair → pas de message créé.
7. **Photo format interdit (HEIC pur)** : toast d'erreur. NB : iOS convertit souvent HEIC→JPEG en upload, à vérifier.
8. **Texte 2001 chars** : envoyer désactivé + message d'aide "Message trop long (2000 max)".
9. **Coupure réseau pendant envoi** : message reste dans le textarea + toast "Réseau indisponible, réessayez".
10. **Admin disabled (is_disabled=true)** : ne voit pas l'onglet Support admin + ne reçoit pas les notifs (le filtrage RLS le bloque).
11. **2 admins répondent simultanément** : les deux réponses apparaissent l'une après l'autre côté client, pas de conflit.
12. **Anti-spam Telegram** : client envoie 5 messages en 10 secondes → 1 seule notif Telegram (la première). Vérifier dans le groupe.
13. **Compteur non-lu fiable** : envoyer 3 messages côté client sans que l'admin n'ouvre la conv → admin doit voir badge "3".
14. **Conversation créée à la volée** : nouveau client n'ayant jamais ouvert Support → ouvre l'onglet → conversation créée silencieusement → état vide affiché.
15. **Realtime Postgres Changes coupé** : forcer désabonnement → vérifier qu'un refresh manuel récupère bien les messages.

### Critères de validation
- 0 erreur console JS pendant un parcours complet.
- Latence envoi → bulle finalisée < 2 sec sur 4G simulée (Chrome DevTools throttling).
- Upload photo 2 Mo < 8 sec sur 4G simulée.
- TypeScript : `npm run type-check` clean.
- Build : `npm run build` < 30 sec sans warning bloquant.
- Linter : `npm run lint` clean sur tous les fichiers touchés.

---

## 13. Décisions ouvertes en suspens (à valider en phase 6)

1. **Storage bucket "public" ou "privé"** : choisi privé + URLs signées. Alternatif = bucket public si on est OK avec le fait qu'une URL leakée donne accès à l'image. → Recommandation : privé.
2. **Préfixe path storage** : choisi `{conversation_id}/{filename}`. Alternatif : `client/{client_id}/{filename}`. → Recommandation : `conversation_id` car plus naturel avec les RLS.
3. **Conversation 1:1 ou multi-thread** : choisi 1:1 (UNIQUE). À reconsidérer si plus tard on veut séparer "support paiement" vs "support compte".
4. **Liste admin : pagination ou load-all** : choisi load-all au Lot 1 (<500 conversations attendues). Pagination au Lot 3 si volume.
5. **Trigger Telegram via pg_net + service_role** : si Supabase recommande plutôt les Database Webhooks pour ce cas (UI plutôt que SQL), on bascule en phase 6.

---

## 14. Commande `/verify` finale (acceptation)

À la fin du Lot 1, exécuter :
```bash
npm run type-check && npm run build && npm run lint
```

Tous trois doivent passer. Si l'un échoue, ne pas merger, fixer d'abord.

---

**Fin Phase 5.** Prochaine étape : **Phase 6 — Validation finale + démarrage de l'implémentation Lot 1** (tickets #1 → #16). Aucun code écrit avant ton GO explicite.
