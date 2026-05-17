# Phase 5-bis — Plan d'implémentation détaillé du Lot 2

**Mode** : analyse, pas de code écrit avant validation utilisateur.
**Prérequis** : Lot 1 doit être en prod et stable (~3-7 jours d'usage réel minimum).
**Périmètre** : voice + vidéo + fichiers + typing indicator + accusé de lecture affiché.

---

## 1. Pourquoi attendre Lot 1 en prod avant de coder Lot 2

L'arbitrage de la phase 4 reposait sur ce point : on apprend du comportement réel des clients avant de coder la partie la plus risquée (voice iOS Safari). Spécifiquement, on cherche à observer :

- **Ratio voice/texte attendu** : si <10 % des messages clients sont des photos au Lot 1, on peut prédire que le voice sera ~30-50 % (pattern WhatsApp africain). Si même les photos sont rares, peut-être qu'on doit remettre voice en question.
- **Taille typique des médias** : si les photos clients pèsent en moyenne 4 Mo, alors les vidéos pèseront ~20 Mo et la limite de 25 Mo est juste. Si elles pèsent 1 Mo, on peut sortir une limite plus stricte.
- **Volume de messages** : pour calibrer correctement l'anti-spam Telegram (30s actuel ; peut-être 60s nécessaire si volume très élevé).
- **Comportement iOS vs Android** : combien % d'iOS dans la base ? Détermine la priorité absolue de la robustesse iOS Safari.

**Recommandation** : ne pas démarrer le code Lot 2 avant que Lot 1 ait reçu au moins 50 messages clients en prod (typiquement 3-7 jours selon le volume).

---

## 2. Scope précis du Lot 2 — IN et OUT

### IN (Lot 2)
- **Messages vocaux** : enregistrement + lecture + waveform basique (barres). 60s max, ~500 KB par message à 32 kbps.
- **Vidéos** : upload depuis caméra ou galerie. 30s max, 25 MB max, format `video/mp4` (H.264 + AAC).
- **Fichiers** : PDF, DOCX, XLSX uniquement (pas d'images puisque déjà gérées). 10 MB max.
- **Typing indicator** : "Bonzini Team écrit…" avec 3 points animés. Via Supabase Broadcast (pas de persistance DB).
- **Accusé de lecture affiché** : "Vu" sous les bulles client quand l'admin a lu. Côté admin équivalent.
- **Realtime UPDATE** sur `chat_messages` ajouté à la publication (actuellement INSERT only).
- **Fallback gracieux** si `MediaRecorder` non supporté ou refusé : bouton micro caché, message d'aide.

### OUT (Lot 3 ou plus tard)
- Assignation manuelle conversation → admin spécifique.
- Réponses pré-enregistrées / canned responses.
- Fermeture / archivage de conversation.
- Statistiques admin (volume, SLA temps de réponse par admin, etc.).
- Recherche full-text dans l'historique des conversations.
- Web Push (jamais selon arbitrage utilisateur antérieur).
- Email de relance (jamais selon arbitrage utilisateur antérieur).
- Conversion automatique HEIC → JPEG si iOS n'a pas converti (cas rare, à voir au Lot 3 si plaintes).

---

## 3. Risque #1 — Voice iOS Safari (faire un POC AVANT le reste)

**Pourquoi c'est risqué** : `MediaRecorder` est supporté sur iOS Safari **depuis 14.1 (avril 2021)**, donc 99 % des iPhones en 2026 devraient l'avoir. MAIS :

1. iOS Safari ne supporte **que `audio/mp4`** (codec MPEG-4 AAC). Pas de `audio/webm` ni de Vorbis.
2. iOS Safari refuse l'enregistrement si la **permission micro** n'a pas été accordée explicitement à l'app via `getUserMedia()` au préalable.
3. iOS verrouille le micro si le **téléphone est en mode silencieux ou en multitâche** (rare mais possible).
4. La **détection du support** se fait via `MediaRecorder.isTypeSupported('audio/mp4')` — pas via user-agent sniffing qui n'est pas fiable.
5. Si l'utilisateur **refuse la permission**, on ne peut plus reposer la question sans le faire passer dans les Réglages iOS → notre app doit gérer ce cas avec un message d'aide.

### POC à faire AVANT le code Lot 2

**Ticket POC** (à isoler, 1 demi-journée max) :

1. Créer une page de test `/dev/voice-poc` (non listée dans la nav).
2. Bouton "Demander permission micro" → `navigator.mediaDevices.getUserMedia({ audio: true })`.
3. Bouton "Enregistrer 5 secondes" → `MediaRecorder` configuré dynamiquement :
   - Préférer `audio/mp4;codecs=mp4a.40.2` (iOS)
   - Fallback `audio/webm;codecs=opus` (Chrome/FF/Edge)
   - Détecter via `isTypeSupported()`
4. Bouton "Lire l'enregistrement" → `<audio src="blob:..." controls>`.
5. Bouton "Upload vers Supabase Storage" dans un bucket de test.
6. Bouton "Lire depuis Supabase" via URL signée.

**Critères de validation du POC** :
- ✅ Fonctionne sur **iPhone 12 iOS 17** (cas dominant).
- ✅ Fonctionne sur **iPhone SE iOS 16** (low-end).
- ✅ Fonctionne sur **Samsung Galaxy A Android 11+ Chrome**.
- ✅ Permission refusée → message d'aide clair, bouton micro masqué après.
- ✅ Format MP4 lit aussi sur Android (test cross-platform).
- ✅ Taille fichier raisonnable : 5 secondes ≈ 30-50 KB à 32 kbps.

**Si le POC échoue sur iPhone réel** : on a deux options de fallback :
- A. Masquer le bouton micro sur iOS et accepter de ne livrer voice qu'aux clients Android (~30-50 % du parc CEMAC).
- B. Reporter voice au Lot 3 et livrer seulement vidéo + fichiers + typing + read receipts au Lot 2.

---

## 4. Schema DB — modifications

Fichier migration : `supabase/migrations/20260524000000_chat_lot2.sql`

```sql
-- 4.1. Étendre l'enum media_type
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_media_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_media_type_check
  CHECK (media_type IN ('image', 'voice', 'video', 'file'));

-- 4.2. Ajouter colonnes pour métadonnées média
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER,  -- voice + video
  ADD COLUMN IF NOT EXISTS media_size_bytes INTEGER,        -- tous médias
  ADD COLUMN IF NOT EXISTS media_filename TEXT;             -- file (nom original)

-- 4.3. Mettre à jour les types MIME du bucket storage
UPDATE storage.buckets
SET file_size_limit = 26214400,  -- 25 MB max (vidéo)
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg',
      'video/mp4', 'video/quicktime',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-excel'
    ]
WHERE id = 'chat-media';

-- 4.4. Activer Realtime UPDATE pour read_at
-- (Postgres Changes UPDATE est déjà couvert par la publication existante,
-- il suffit côté frontend de s'abonner à l'event UPDATE en plus de INSERT.)

-- 4.5. RPC : marquer un message individuel comme lu (granularité fine)
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg RECORD;
  v_is_recipient BOOLEAN := false;
BEGIN
  SELECT m.*, c.client_id
  INTO v_msg
  FROM public.chat_messages m
  JOIN public.chat_conversations c ON c.id = m.conversation_id
  WHERE m.id = p_message_id;

  IF v_msg.id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Le client peut marquer comme lu un message admin
  IF v_msg.sender_type = 'admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = v_msg.client_id AND user_id = auth.uid()
    ) INTO v_is_recipient;
  -- L'admin peut marquer comme lu un message client
  ELSIF v_msg.sender_type = 'client' THEN
    v_is_recipient := public.is_support_admin(auth.uid());
  END IF;

  IF NOT v_is_recipient THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.chat_messages
  SET read_at = now()
  WHERE id = p_message_id AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID) TO authenticated;
```

**Notes** :
- Pas besoin de modifier les RLS — les contraintes existantes couvrent les nouveaux media_types.
- `mark_message_read` permet le pattern "marquer chaque message lu individuellement quand il devient visible dans le viewport" (plus précis que le `mark_conversation_read_*` global).

---

## 5. Composant `VoiceRecorder` — spec détaillée

Fichier : `src/components/support/VoiceRecorder.tsx`

### Comportement

**Desktop** :
- Click sur l'icône micro → début enregistrement.
- Pendant l'enregistrement : timer, waveform live, bouton stop, bouton annuler.
- Click stop → preview lecture + bouton envoyer ou annuler.

**Mobile** (touch) :
- Touch + hold sur le micro → enregistrement (style WhatsApp).
- Slide vers la gauche pendant hold → annuler.
- Relâcher → fin enregistrement → envoi automatique (pas de preview pour fluidité).
- Verrouillage en tap-tap rapide → enregistrement mains libres avec bouton stop visible.

### Détection support

```typescript
function getVoiceMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) return 'audio/mp4;codecs=mp4a.40.2';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  return null;
}
```

Si null → le bouton micro est masqué et le placeholder du textarea devient "Écrivez ou envoyez une photo".

### Code-level (pseudo)

```typescript
const mimeType = getVoiceMimeType();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: mimeType });
  // upload + insert message avec media_type='voice' + duration + size
};
recorder.start();
// ... après stop user :
recorder.stop();
stream.getTracks().forEach(t => t.stop()); // libère le micro
```

### Waveform live (pendant enregistrement)

- Web Audio API : `AudioContext` → `MediaStreamAudioSourceNode` → `AnalyserNode`.
- 30 barres affichées, hauteur = `analyser.getByteFrequencyData()` moyenné par bande.
- 60 FPS via `requestAnimationFrame`.
- Couleur : `bg-bonzini-violet` (palette logo).

---

## 6. Composant `VoiceMessage` — spec lecture

Fichier : `src/components/support/VoiceMessage.tsx`

### Affichage dans une bulle

```
┌──────────────────────────────┐
│ [▶] ▁▂▃▅█▆▄▂▁▂▃▅▄▃   0:42   │
└──────────────────────────────┘
```

### Comportement

- Click sur ▶ → fetch URL signée → `<audio>` joue → progress bar dans la waveform avance.
- Click sur n'importe quel point de la waveform → seek à ce point.
- Vitesse 1x / 1.5x / 2x (toggle au tap-tap).
- Auto-pause si on ouvre une autre voice dans la même conversation.

### Stratégie waveform à la lecture

**Option simple (recommandée)** : afficher 30 barres aléatoires aux hauteurs pseudo-aléatoires basées sur l'ID du message (déterministe, pas de calcul réel). Avantage : pas besoin d'analyser le fichier audio.

**Option avancée (Lot 3)** : pré-calculer le waveform côté serveur via Edge Function FFmpeg-WASM. Trop complexe pour Lot 2.

---

## 7. Composant `VideoMessage` + envoi vidéo

Fichier : `src/components/support/VideoMessage.tsx`

### Envoi

- Bouton "vidéo" séparé du bouton photo dans `MessageInput`, ou intégré au menu pièce jointe (à arbitrer en phase 6).
- `<input type="file" accept="video/mp4,video/quicktime" capture="environment">` → ouvre la caméra en mode vidéo sur mobile.
- Pas de compression côté frontend (trop coûteux, prend 30s sur 4G).
- Validation : 25 MB max, durée ≤ 30s (lue via `<video>` invisible avant upload, sinon refus avec toast).
- Le poster (frame 0) est généré côté frontend via canvas et stocké comme PNG à côté de la vidéo : `{conv_id}/video/{uuid}.poster.png`.

### Affichage

- Player `<video controls poster>` natif, largeur max 280px.
- Click → fullscreen via Fullscreen API.

---

## 8. Composant `FileMessage`

Fichier : `src/components/support/FileMessage.tsx`

### Envoi

- Bouton trombone dans MessageInput.
- `<input type="file" accept=".pdf,.docx,.xlsx,.doc,.xls">` (whitelist explicite).
- Validation MIME + extension + 10 MB max.
- Nom de fichier original stocké dans `media_filename`.

### Affichage

Carte simple avec icône PDF/DOC/XLS, nom, taille, bouton "Télécharger" (déclenche download via signed URL).

```
┌─────────────────────────────────────┐
│ 📄  facture-fournisseur-mars.pdf   │
│     2.3 Mo                          │
│                       [Télécharger] │
└─────────────────────────────────────┘
```

Pas de preview inline (trop complexe pour Lot 2). Le client/admin télécharge et ouvre dans l'app native.

---

## 9. Typing indicator — Supabase Broadcast

### Approche

Pas de persistance DB. Utilise Supabase Realtime **Broadcast** :

```typescript
// Côté émetteur (qui tape)
const channel = supabase.channel(`chat:${conversationId}`);
channel.subscribe();

// Au input change, avec debounce 300ms :
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { sender_type, sender_id, ts: Date.now() }
});

// Stop après 3s d'inactivité :
channel.send({
  type: 'broadcast',
  event: 'typing-stop',
  payload: { sender_type, sender_id }
});
```

```typescript
// Côté récepteur
channel.on('broadcast', { event: 'typing' }, (payload) => {
  if (payload.sender_type !== mySenderType) setTypingFromOther(true);
});
channel.on('broadcast', { event: 'typing-stop' }, (payload) => {
  if (payload.sender_type !== mySenderType) setTypingFromOther(false);
});
// Auto-clear local : si pas de "typing" reçu pendant 5s, on cache.
```

### Affichage

Bulle "typing" avec 3 points animés en CSS :

```
┌──────────────┐
│  •  •  •     │  ← animation séquentielle
└──────────────┘
```

Apparaît en bas de la liste des messages, au-dessus de l'input. Disparaît dès qu'un message est posté ou après 5s sans signal.

### Coût Realtime

Broadcast = events volatiles, pas de DB write, pas de coût réseau significatif. Quotas Supabase free tier supportent largement.

---

## 10. Accusé de lecture affiché

### Logique

Le `read_at` existe déjà en DB depuis Lot 1. On affiche maintenant :

**Sous chaque bulle "self" (envoyée par moi)** :
- Si `read_at == null` → "Envoyé" (gris, petit).
- Si `read_at != null` → "Vu" + checkmark double bleu.

Pas de timestamp "vu à HH:mm" affiché (trop intrusif). Tap sur "Vu" → afficheToast avec l'heure exacte (UX standard WhatsApp).

### Realtime UPDATE

Le frontend (client et admin) doit s'abonner aussi aux events UPDATE sur `chat_messages` (pas seulement INSERT comme au Lot 1) pour rafraîchir l'état "Vu" en temps réel quand le destinataire ouvre la conversation.

```typescript
channel.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'chat_messages',
  filter: `conversation_id=eq.${conversationId}`,
}, (payload) => {
  // Met à jour le message localement
});
```

---

## 11. Ordre des tickets de dev — Lot 2

Total estimé : **7-10 jours** pour 1 dev, dont 0.5j de POC voice initial.

| # | Ticket | Effort | Dépend de | Sortie |
|---|---|---|---|---|
| 0 | **POC voice iOS Safari** (route /dev/voice-poc, test devices réels) | 0.5j | — | Décision Go/No-Go voice |
| 1 | Migration `20260524000000_chat_lot2.sql` (enum + colonnes + bucket + RPC) | 0.5j | #0 GO | DB prête |
| 2 | Composant `VoiceRecorder` (desktop + mobile press-and-hold) | 1.5j | #1 | Enregistrement OK |
| 3 | Composant `VoiceMessage` (lecture + waveform pseudo-random + seek) | 1j | #1 | Lecture OK |
| 4 | Composant `VideoMessage` + envoi vidéo (input + validation durée + poster) | 1j | #1 | Vidéo OK |
| 5 | Composant `FileMessage` + envoi fichier | 0.5j | #1 | Fichiers OK |
| 6 | Hook typing indicator (broadcast channel) + UI 3 points animés | 0.5j | #1 | Typing live |
| 7 | Realtime UPDATE sur `chat_messages` + affichage "Vu" / "Envoyé" | 0.5j | #1 | Read receipts visibles |
| 8 | Intégration MessageInput Lot 2 (menu pièce jointe étendu, bouton micro/vidéo/fichier) | 0.5j | #2-#6 | UI input complète |
| 9 | i18n FR/EN/ZH (ajouter ~15 clés voice/video/file) | 0.25j | #8 | i18n OK |
| 10 | Fallback gracieux quand `MediaRecorder` non supporté ou permission refusée | 0.5j | #2 | UX robuste |
| 11 | Test plan E2E manuel sur 5 devices | 0.75j | tout | QA OK |
| 12 | `/verify` + commit + push + PR | 0.25j | tout | Mergé |

**Risques bloquants** :
- ⚠️ **POC voice échoue sur iOS** → on doit prendre la décision Go/No-Go avant ticket #2. Voir options A/B en §3.
- ⚠️ **Limite vidéo 25 MB insuffisante** : observée sur des téléphones avec 4K activé par défaut. Mitigation : message d'aide "Activez 720p dans les réglages caméra" si fichier trop gros.
- ⚠️ **HEIC sur iOS** : si un client envoie une image HEIC pure (rare mais possible si désactive la conversion auto), validateUploadFile la refuse. Acceptable pour Lot 2, on traitera en Lot 3 si plaintes.

---

## 12. Test plan E2E — Lot 2

### Devices à tester (mêmes que Lot 1)

| Device | OS | Browser | Critères Lot 2 spécifiques |
|---|---|---|---|
| iPhone 12+ | iOS 16+ | Safari | Voice + vidéo + permission micro |
| iPhone SE | iOS 14.1 | Safari | Voice MIME mp4 + low-end perf |
| Samsung Galaxy A | Android 11+ | Chrome | Voice + vidéo + multitasking |
| Desktop | Win/Mac | Chrome | Voice via micro PC + fichiers drag-and-drop |
| Desktop | Win | Firefox | Compatibilité MediaRecorder webm |

### Scénarios golden path Lot 2

1. **Voice client → admin** : appui long sur micro → 5s → relâche → bulle voice envoyée → admin reçoit + waveform pseudo-random → tap play → écoute.
2. **Voice admin → client** : pareil dans l'autre sens.
3. **Vidéo client** : tap bouton vidéo → caméra arrière → enregistre 10s → preview → envoie → admin voit player avec poster.
4. **Fichier PDF admin → client** : admin upload une facture PDF → client reçoit la carte file → download → ouvre dans le viewer PDF natif.
5. **Typing indicator** : client tape → admin voit "Client écrit…" en bas du chat dans les 500ms → client arrête → indicator disparaît après 3s.
6. **Read receipt** : client envoie message → "Envoyé" gris sous la bulle → admin ouvre la conv → "Envoyé" devient "Vu" + checkmark bleu sans rafraîchir.

### Scénarios edge cases Lot 2

7. **Permission micro refusée** : bouton micro masqué, placeholder textarea "Écrivez ou envoyez une photo", aucun crash.
8. **MediaRecorder non supporté** (vieux Safari) : pareil, fallback transparent.
9. **Slide pour annuler** (mobile press-and-hold) : pendant l'enregistrement, slide gauche → annule, pas de message créé.
10. **Vidéo > 25 MB** : toast "Vidéo trop volumineuse, max 25 Mo. Activez 720p dans les réglages caméra".
11. **Vidéo > 30s** : toast "Vidéo trop longue, max 30 secondes".
12. **Fichier .exe ou .zip** : refusé, toast "Format non supporté".
13. **Voice 60s+ pile** : auto-stop à 60s avec toast "Maximum 60 secondes".
14. **2 voice messages joués en même temps** : la 2e pause la 1ère automatiquement.
15. **Typing depuis 2 admins simultanément** : indicator affiche "Bonzini Team écrit…" (générique, pas le nom).
16. **Read receipt après plusieurs jours** : un message lu il y a 3 jours affiche "Vu" sans timestamp précis (UX standard).
17. **Coupure réseau pendant upload voice** : retry automatique 1 fois, sinon toast "Échec d'envoi, votre message vocal est resté dans l'app" + bouton retry visible sur la bulle non envoyée.

### Critères de validation

- 0 erreur console JS pendant un parcours complet.
- Latence enregistrement → bulle envoyée < 3 sec sur 4G simulée pour voice 5s.
- Upload vidéo 10 Mo < 30 sec sur 4G simulée.
- TypeScript / build / lint : clean.
- POC voice OK sur les 5 devices listés.

---

## 13. Décisions ouvertes — à valider en phase 6 Lot 2

1. **Press-and-hold vs tap-to-record** sur mobile : choix pris = press-and-hold avec slide-to-cancel + tap-tap pour lock. Alternatif : tap simple pour démarrer / tap pour stop (plus simple mais moins WhatsApp-like). → Recommandation : press-and-hold pour matcher les habitudes africaines.
2. **Bouton micro vs menu pièce jointe** : choix pris = micro et photo en boutons directs, vidéo + fichier dans un menu "+". Alternatif : tout dans un menu unique. → Recommandation : micro + photo directs (les 2 plus utilisés), reste dans menu.
3. **Bitrate voice** : 32 kbps choisi (qualité acceptable, taille ~250 KB pour 60s). Alternatif : 64 kbps (mieux mais 2× plus lourd). → Recommandation : 32 kbps suffit.
4. **Waveform à la lecture** : pseudo-random déterministe choisi. Alternatif : pré-calcul serveur via FFmpeg-WASM. → Recommandation : pseudo-random pour Lot 2.
5. **Auto-stop voice à 60s** : choix pris = oui. Alternatif : pas de limite jusqu'à 5 min. → Recommandation : 60s pour garder le rythme de conversation.
6. **Poster vidéo** : généré côté client. Alternatif : laisser le browser générer au playback (sans poster pré-uploadé). → Recommandation : poster côté client pour preview immédiate dans la bulle.
7. **Typing indicator persistant ou volatile** : volatile (Broadcast) choisi. Alternatif : ajout d'une table `chat_typing` avec TTL. → Recommandation : Broadcast suffit, plus simple.

---

## 14. `/verify` final Lot 2

```bash
npm run type-check && npm run build && npm run lint
```

Tous trois doivent passer. Si l'un échoue, ne pas merger, fixer d'abord.

---

**Fin Phase 5-bis.** Prochaine étape : **POC voice iOS Safari (ticket #0)**.

Décision à prendre avant de coder :
- **Option A** : on attend que Lot 1 soit déployé et tourne 3-7 jours en prod, puis on démarre le POC voice, puis le reste de Lot 2.
- **Option B** : on fait le POC voice tout de suite (sans attendre Lot 1) parce que c'est isolé du reste et que ça nous renseigne sur la faisabilité plus tôt.
- **Option C** : on code tout Lot 2 maintenant (POC + reste) et on déploie le tout après Lot 1 stable. Risque : si POC échoue, on a codé pour rien.

À toi de trancher.
