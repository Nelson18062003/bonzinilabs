# Phase 1 — Audit codebase pour module Support in-app

**Date** : 2026-05-16
**Scope** : lecture seule. Identifier où et comment greffer un module de chat client ↔ admins.
**Convention** : **[vérifié]** = lu dans le code · **[supposé]** = inféré, à confirmer · **[à confirmer]** = non lu.

---

## 0. Fait structurant à retenir avant tout

**Bonzini n'est pas une app mobile native. C'est une PWA web React/Vite servie en mobile-first.** [vérifié — `package.json:1-80`, pas de React Native ni Capacitor ni Expo, présence de `public/manifest-client.json` + Tailwind responsive].

Conséquences directes pour le module support :
- Capture **voice** → Web `MediaRecorder` API (pas de SDK natif). Support : Chrome/Edge/Firefox/Safari 14.1+. **iOS Safari < 14.1 = pas de voice possible** [vérifié spec MDN — à confirmer chiffres de part de marché iOS chez nos users].
- Push notifications → **Web Push API + Service Worker**, pas FCM/APNs natifs. Et **iOS Safari ne supporte le Web Push qu'à partir d'iOS 16.4 + app installée en PWA sur l'écran d'accueil**. Sans installation PWA, pas de push iOS.
- Offline → Service Worker à construire (aucun aujourd'hui, cf §5).

---

## 1. Architecture des apps (client / admin / agent cash)

### 1.1 Routage unique, trois personas

Une seule SPA React, trois préfixes de routes [vérifié — `src/App.tsx:110-215`] :

| Persona | Préfixe | Wrapper | Layout | Auth client Supabase |
|---|---|---|---|---|
| Client | `/` | `<ProtectedRoute>` | `MobileLayout` + `BottomNav` | `supabase` (`bonzini-client-auth`) |
| Admin / Ops / Support | `/m/*` | `<MobileRouteWrapper requireAuth>` | `MobileAppShell` + `MobileTabBar` | `supabaseAdmin` (`bonzini-admin-auth`) |
| Agent Cash | `/a/*` | `<AgentCashRouteWrapper>` | `AgentCashShell` + `AgentCashTabBar` | `supabaseAdmin` |

Le module support touchera **deux personas** : `/` (client) et `/m/*` (admin). L'agent cash est hors scope a priori.

### 1.2 Points d'extension UI naturels

**Côté client** :
- `src/components/layout/BottomNav.tsx` — 5 items aujourd'hui : Wallet, Deposits, Payments, History, Profile. **Ajouter un 6e item "Support" sature la barre** sur écrans étroits. Alternatives : remplacer "History" (déjà accessible depuis Wallet) OU mettre support derrière un FAB (floating action button) flottant. **Décision design à prendre.**
- `src/components/layout/ClientHeader.tsx:1-52` — header sticky, contient déjà une cloche notifications. Bonne place pour une icône `MessageCircle` à côté.
- `src/components/layout/ClientSidebar.tsx` — sidebar desktop (`lg:pl-64`).

**Côté admin** :
- `src/mobile/components/layout/MobileTabBar.tsx:1-30` — 5 tabs : Home, Deposits (badge), Payments (badge), Clients, More. Cohérent d'ajouter "Support" ici avec badge non-lus, OU comme entrée sous `MobileMoreScreen`.
- Le pattern "badge count" existe déjà sur Deposits/Payments → réutilisable.

### 1.3 Layouts détaillés

| Fichier | Rôle |
|---|---|
| `src/components/layout/MobileLayout.tsx` | Wrapper client (sidebar desktop + header + BottomNav mobile) |
| `src/components/layout/BottomNav.tsx` | Bottom nav client (5 items, `pb-24`) |
| `src/components/layout/ClientHeader.tsx` | Header sticky client (logo, lang switcher, bell) |
| `src/mobile/components/layout/MobileAppShell.tsx:1-36` | Shell admin (`min-h-screen max-w-lg`, MobileTabBar) |
| `src/mobile/components/layout/MobileTabBar.tsx:1-30` | Tabs admin (5 items) |

---

## 2. Auth, session, identité

### 2.1 Client

[vérifié — `src/contexts/AuthContext.tsx:34-175`]
- Session via `supabase.auth`, isolée par storageKey `bonzini-client-auth`.
- Identifiant : `auth.uid()`.
- Lien à `clients` : trigger DB `handle_new_user` (déclenché si user metadata contient `is_client: 'true'`) crée la ligne `clients` + `wallets` à l'inscription [supposé — confirmé par règle dans `.claude/rules/supabase-clients.md`].
- Colonnes utiles pour afficher l'identité côté admin : `first_name`, `last_name`, `email`, `phone`, `company_name`, `avatar_url`, `country`, `city`.

### 2.2 Admin / Support

[vérifié — `src/contexts/AdminAuthContext.tsx:1-323`]
- Session via `supabaseAdmin.auth`, storageKey `bonzini-admin-auth`.
- Lookup rôle : `supabaseAdmin.from('user_roles').select(...).eq('user_id', user.id).maybeSingle()` (lignes ~149-153).
- Colonnes `user_roles` : `role`, `first_name`, `last_name`, `is_disabled` (+ `avatar_url` à confirmer dans `src/integrations/supabase/types.ts`).

### 2.3 Rôles & permissions existants

[vérifié — `src/contexts/AdminAuthContext.tsx` (table permissions par rôle)]

| Rôle | Permissions clés pour support |
|---|---|
| `super_admin` | Tout |
| `ops` | canViewClients, canProcess*, canViewLogs |
| **`support`** | **canViewClients, canEditClients, canViewDeposits, canViewPayments, canViewLogs** |
| `customer_success` | canViewClients, canEditClients, canProcessDeposits |
| `cash_agent` | canViewPayments, canProcessPayments |
| `treasurer` | canViewTreasury, canManageTreasury |

**Très bonne nouvelle** : un rôle `support` existe déjà et a exactement les permissions qu'il faut pour répondre au chat client (peut voir clients, dépôts, paiements, logs). Pas besoin d'inventer un rôle.

**À décider** : faut-il une nouvelle permission `canAccessSupportChat` (granularité fine, par ex. les `treasurer` n'y ont pas accès), ou ouvrir le chat à tous les rôles admin sauf `cash_agent` / `treasurer` ?

---

## 3. Supabase Realtime — déjà en production

[vérifié — `src/hooks/useRealtimeInvalidation.ts:1-170`]

Pattern établi et solide :
- Deux channels séparés : `client-realtime-${user.id}` (filtré par user) et `admin-realtime-invalidation` (global admin).
- Tables actuellement écoutées : `deposits`, `payments`, `wallets`, `ledger_entries`, `clients`, `user_roles`, `admin_audit_logs`, `notifications` (avec filter `user_id=eq.${user.id}`).
- L'event Realtime déclenche un `queryClient.invalidateQueries(...)` → React Query refetch.

→ **Ajouter `chat_messages` à cette mécanique est trivial** : ~10 lignes à ajouter au fichier, plus une subscription Realtime activée sur la nouvelle table dans la migration.

Le pattern "Broadcast" Supabase Realtime (non utilisé aujourd'hui dans le code) reste disponible pour les événements éphémères type "agent est en train d'écrire", sans toucher la DB.

---

## 4. Storage Supabase

### 4.1 Buckets existants

[vérifié — migrations dans `supabase/migrations/`]

| Bucket | Public | Usage actuel |
|---|---|---|
| `deposit-proofs` | non | Preuves de dépôt (client upload, admin view/delete) |
| `payment-proofs` | non | Preuves de paiement |
| `cash-signatures` | non | Signatures paiement espèces |

Pattern d'upload bien rodé, hooks de référence : `useDeposits`, `usePayments`, `useAdminUploadProofs`, `useAdminPaymentProofMultiUpload`.

### 4.2 Validation fichiers

[vérifié — `src/lib/utils.ts:8-19`]

```text
ALLOWED_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024  // 10 MB
```

**Implication directe pour le support chat** : la whitelist actuelle ne permet **ni audio, ni vidéo, ni image HEIC (iPhone)**. Il faudra :
- soit étendre `ALLOWED_UPLOAD_MIME_TYPES` (impact transverse — `validateUploadFile()` est appelé partout),
- soit créer une fonction de validation **dédiée au chat** (`validateChatMediaFile()`) avec sa propre whitelist (image/audio/vidéo) et son propre cap (peut-être 20 MB pour vidéo).

Recommandation pré-design : option 2, plus propre, pas d'impact sur les modules existants.

### 4.3 Pour le chat

**Bucket à créer** : `chat-media` (privé, RLS), avec arborescence à figer en phase 5.

---

## 5. Push notifications & Service Worker

[vérifié]
- ✅ Manifest PWA présent : `public/manifest-client.json` (display standalone, icons 192/512, theme `#6F3FF5`, start_url `/wallet`).
- ❌ **Aucun Service Worker** enregistré dans `src/main.tsx` ni dans `index.html`.
- ❌ Aucune utilisation de `PushManager`, `Notification`, `serviceWorker.register` dans la codebase.

**Conséquence** : aujourd'hui, les notifications sont **purement in-app** (bell dans `ClientHeader`, hook `useNotifications`, alimentées par table `notifications`). Si l'app n'est pas ouverte, **le client ne sait pas qu'un admin a répondu**.

→ Pour le MVP support, **rester sur in-app uniquement est acceptable** si on accepte que le client revoie son téléphone. Mais ça contredit ton SLA "24/7 réactif". **Web Push = sujet à arbitrer en phase 4/5**, pas un blocker MVP mais une vraie limite trust.

### Table `notifications` existante

[vérifié — `src/integrations/supabase/types.ts:494-525` + `src/hooks/useNotifications.ts:1-86`]

Schema utilisable tel quel pour le chat :
- Ajouter type `'chat_message_received'` dans l'enum.
- Trigger PG sur INSERT `chat_messages` → INSERT `notifications` pour le destinataire.
- L'UI bell client va déjà refresh via Realtime → ✅ gratuit.

---

## 6. Code existant : embryon de chat / messaging / support

[vérifié — grep exhaustif sur `chat`, `message`, `conversation`, `ticket`, `support`, `inbox`]

**Aucun module préexistant.** Les seuls hits sont :
- "WeChat Pay" dans modules paiement (faux positif).
- `error.message` standard Supabase.
- `supportedLanguages` dans i18n.

→ **Page blanche.** Pas de dette à reprendre, pas de code mort à supprimer. C'est positif : on construit ce qu'il faut, rien de plus.

---

## 7. Dette technique & santé du repo

### 7.1 TypeScript

[vérifié — `npm run type-check`]
- Une seule erreur, **non bloquante** : `tsconfig.json(5,5): error TS5101: Option 'baseUrl' is deprecated`. À ignorer ou patcher avec `"ignoreDeprecations": "6.0"`.
- Pas d'erreur type fonctionnelle.

### 7.2 Migrations récentes

5 dernières [vérifié — `supabase/migrations/`] :
- `20260516000002_treasury_lot7.sql`
- `20260516000001_treasury_adjust_account.sql`
- `20260515000005_treasury_counterparty_rpcs.sql`
- `20260515000004_treasury_rpcs.sql`
- `20260515000002_treasury_schema.sql`

Toutes liées au module treasury (isolé, rôle `treasurer`). **Aucune interférence prévisible avec le support chat**.

### 7.3 RLS

[vérifié via `.claude/rules/database.md` + `security.md`] — Hygiène RLS stricte dans tout le repo : SECURITY DEFINER pour mutations sensibles, `SELECT FOR UPDATE` sur wallets, validation file upload. **Le support chat devra respecter le même niveau** (RLS sur conversations/messages dès la migration).

### 7.4 Risque latent identifié

`supabaseAdmin.functions.invoke()` est connu pour fail "Invalid JWT" [vérifié — `.claude/rules/supabase-clients.md`]. → **Ne pas baser le module support sur des Edge Functions** si le frontend admin doit les appeler. Préférer RPC `SECURITY DEFINER`.

---

## 8. Stack précise

| Package | Version | Pertinence support |
|---|---|---|
| `react` | ^18.3.1 | OK |
| `@supabase/supabase-js` | ^2.97.0 | Realtime + Storage natifs |
| `react-router-dom` | ^6.30.1 | Routes à ajouter |
| `@tanstack/react-query` | ^5.90.20 | Pattern dominant (254+ hooks) |
| `@tanstack/query-broadcast-client-experimental` | ^5.99.2 | Sync multi-onglets — utile si admin a plusieurs onglets ouverts |
| `i18next` + `react-i18next` | (présent) | À étendre avec namespace `chat` |
| `framer-motion` | ^12.34.2 | Animations bulles chat possibles |
| `lucide-react` | ^0.563.0 | Icônes (MessageCircle, Mic, Paperclip, Image, Check, CheckCheck) |
| `date-fns` | ^4.1.0 | Horodatage relatif messages |

**i18n actif** : `fr`, `en`, `zh` [vérifié — `src/i18n/index.ts:35-49`]. Le chat devra exister dans les 3 langues (namespace `chat.json` à créer).

**React Query patterns** : `staleTime`, `gcTime` via `CACHE_CONFIG` ; mutations avec `onSuccess` → `invalidateQueries`. Voir `src/hooks/useAdminNotifications.ts:34-112` comme référence.

---

## 9. Capacité audio (voice messages)

[vérifié — grep `MediaRecorder|getUserMedia|audio|recording|voice`]

❌ **Aucun code audio dans la codebase aujourd'hui.** À construire intégralement.

Stack standard navigateur (pas de dépendance lourde nécessaire) :
- `navigator.mediaDevices.getUserMedia({ audio: true })` — demande permission micro.
- `MediaRecorder` natif avec `mimeType: 'audio/webm;codecs=opus'` (Chrome/Firefox/Edge) ; **Safari iOS = `audio/mp4` ou `audio/aac`** [à confirmer support exact].
- Optionnel pour la visualisation waveform : `wavesurfer.js` (~50 KB) — peut être ajouté plus tard.

**Risque connu** : iOS Safari capricieux sur MIME types ; il faudra tester réellement sur iPhone avant de promettre voice partout.

---

## 10. Mobile / écran admin

[vérifié — arborescence `src/mobile/`]

Structure mature et bien organisée :
```
src/mobile/
├── components/
│   ├── MobileRouteWrapper.tsx
│   ├── layout/         (AppShell, TabBar, Header)
│   ├── ui/             (EmptyState, SkeletonCard, StatCard, PullToRefresh…)
│   └── agent-cash/
├── screens/
│   ├── auth/  dashboard/  deposits/  payments/  clients/
│   ├── admins/  more/  treasury/  agent-cash/
```

→ **Nouveau dossier à créer** pour le module support admin : `src/mobile/screens/support/` (par cohérence avec `treasury/`, `clients/`, etc.).

Le shell admin a `max-w-lg` (≈ 32 rem) — design chat doit tenir dans cette largeur, optimisé mobile, avec gracieux scale sur desktop.

---

## 11. Synthèse — points structurants pour la suite

### Atouts (réutilisables sans effort)
1. **Realtime déjà rodé** → ajout `chat_messages` trivial.
2. **Rôle `support` déjà défini** avec les bonnes permissions.
3. **Table `notifications` + bell UI** → notifications in-app gratuites.
4. **Pattern React Query + invalidation** très propre, dupliquer un hook existant suffit.
5. **Storage Supabase rodé** sur 3 buckets → 4e bucket trivial.
6. **i18n + 3 langues** déjà en place.

### Frictions / décisions à prendre avant phase 3
1. **PWA web, pas native** → contrainte Web Push iOS (16.4+ et app installée).
2. **Pas de Service Worker aujourd'hui** → Web Push = chantier séparé non négligeable. **In-app only = MVP acceptable mais limite trust si app fermée**.
3. **`validateUploadFile()` ne gère ni audio ni vidéo ni HEIC** → créer `validateChatMediaFile()` dédié.
4. **BottomNav client à 5 items déjà** → où ajouter "Support" ? (tab dédiée vs FAB vs header).
5. **Pas une seule ligne de code audio** dans la codebase → voice = lot à part entière, à tester sur iOS Safari réel.
6. **Pas de système de permission `canAccessSupportChat`** → décision : ouvrir à quels rôles ?
7. **`supabaseAdmin.functions.invoke()` cassé** → support chat = RPC `SECURITY DEFINER`, pas d'Edge Functions appelées du frontend.

### Aucun bloqueur dur identifié
Le module support s'insère naturellement dans l'architecture existante. Pas de refactoring préalable nécessaire.

---

---

## 12. Décisions produit prises post-audit (cadrage utilisateur)

| Sujet | Décision | Impact technique |
|---|---|---|
| Notifications **admin** quand l'app n'est pas ouverte | **Bot Telegram** : chaque message client → push Telegram dans un canal admin avec deeplink `/m/support/:id` | Pas de Service Worker côté admin. Trigger PG ou Edge Function appelle Telegram Bot API. À détailler en phase 5. |
| Notifications **client** quand l'app n'est pas ouverte | **In-app only** au MVP. Web Push reporté. | Compenser par "temps de réponse moyen" visible dans l'écran chat pour le trust. |
| Entrée "Support" côté client | **6e onglet dans `BottomNav`** | Réorganisation `BottomNav.tsx` : passer à 6 items. Vérifier rendu iPhone SE (320 px). Peut-être passer à icônes-only (sans label) si squeeze. |
| Rôles admin avec accès chat | **super_admin, support, customer_success, ops** (pas treasurer, pas cash_agent) | Nouvelle permission `canAccessSupportChat` à ajouter à `AdminAuthContext`. RLS sur `chat_conversations` doit vérifier ce subset. |

**Fin Phase 1.** Prochaine étape : Phase 2 — benchmark fintech support in-app.

