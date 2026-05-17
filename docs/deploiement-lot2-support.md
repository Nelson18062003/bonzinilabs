# Déploiement Lot 2 — Voice + Vidéo + Fichiers + Typing + Read receipts + Reply

## Pré-requis

Lot 1 doit être déjà déployé et fonctionnel.

## Étapes manuelles (interface web Supabase)

### 1. Appliquer les 2 migrations SQL

Dans **SQL Editor**, exécute dans l'ordre :

1. `supabase/migrations/20260524000000_chat_lot2.sql` — étend l'enum media_type, ajoute colonnes meta + waveform peaks, bucket élargi, RPC `mark_message_read`.
2. `supabase/migrations/20260524100000_chat_lot2_reply.sql` — ajoute `reply_to_message_id` + trigger de validation cross-conversation.

Copier-coller chacun, cliquer **Run**, vérifier "Success".

### 2. Vérifier la mise à jour du bucket `chat-media`

Dans **Storage → chat-media → Settings** :
- File size limit doit afficher **25 MB** (anciennement 5 MB)
- Allowed MIME types doit inclure audio/* et video/* maintenant

Si pas mis à jour automatiquement, ré-exécuter la commande UPDATE de la migration #1.

### 3. Mise à jour de l'Edge Function `notify-admin-chat`

Le contenu de `supabase/functions/notify-admin-chat/index.ts` a été légèrement modifié pour afficher des emojis appropriés (🎤 vocal, 🎥 vidéo, 📎 fichier) dans les notifications Telegram.

Dans **Edge Functions → notify-admin-chat → Edit code** :
1. Efface le code existant
2. Colle la nouvelle version du fichier
3. **Deploy**

### 4. Pas de nouvelle webhook à créer

Le webhook configuré au Lot 1 (`chat_messages_notify_admin`) fonctionne tel quel pour le Lot 2 — il pingue déjà sur INSERT et la fonction se charge des nouveaux types.

### 5. Test E2E

Une fois le frontend déployé (auto via merge → Vercel ou équivalent) :

**Voice (test prioritaire)** :
1. Sur iPhone Safari : ouvrir le chat → tap maintenu sur le bouton micro (orange)
2. Parler 3 secondes → relâcher → message vocal envoyé avec waveform
3. Tap play → écouter
4. Côté admin : pareil + vérifier que le waveform montre les vrais pics audio

**Slide pour annuler** :
- Press long sur le micro → glisse vers la gauche pendant l'enregistrement → relâche → rien n'est envoyé

**Vidéo** :
1. Tap bouton **+** → "Envoyer une vidéo" → caméra arrière s'ouvre
2. Enregistrer 5s → preview → confirmer → bulle vidéo avec poster
3. Tap → vidéo se lit

**Fichier** :
1. Tap **+** → "Envoyer un fichier" → choisir un PDF
2. Bulle file affichée avec icône rouge PDF + taille
3. Tap **Télécharger** → ouvre dans le viewer natif

**Typing indicator** :
1. Côté client tape → côté admin doit voir "Le client écrit…" en bas
2. Arrêt 3s → disparaît
3. Inverse pareil

**Read receipts** :
1. Client envoie message → "Envoyé" gris sous la bulle
2. Admin ouvre la conv → "Envoyé" se change en "Vu" + double check violet **sans rafraîchir**
3. Tap "Vu" côté client → affiche brièvement l'heure

**Reply (citation)** :
1. **Appui long** sur un message → menu apparaît : "Répondre" + "Copier"
2. Tap "Répondre" → preview du message cité apparaît au-dessus de l'input
3. Taper "ok" + envoyer → la nouvelle bulle contient la citation au-dessus
4. Tap sur la citation dans une bulle → scroll vers le message original avec un flash visuel
5. Tap X dans la preview → annule la réponse

## Rollback

En cas de problème majeur :

```sql
-- Désactive temporairement le trigger reply (le reste continue de marcher)
DROP TRIGGER IF EXISTS trg_chat_msg_validate_reply ON public.chat_messages;
DROP FUNCTION IF EXISTS public.validate_chat_reply_same_conversation();

-- Supprime la colonne reply (si besoin total)
ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS reply_to_message_id;

-- Rollback enum media_type (revient à 'image' uniquement)
-- ATTENTION : seulement si tu acceptes de perdre les messages voice/video/file existants
DELETE FROM public.chat_messages WHERE media_type IN ('voice', 'video', 'file');
ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_media_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_media_type_check
  CHECK (media_type IN ('image'));
```

Et retirer les imports `useSendClientVoice/Video/File` (et admin) dans les pages.
