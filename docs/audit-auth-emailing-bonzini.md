# Audit — Authentification & Emailing transactionnel (Bonzini)

> **Phase 1 du chantier "Social login + Emails transactionnels".** Document de référence (source de vérité). Lecture seule — aucun code modifié.
> **Date de l'audit :** 2026-05-30 · **Stack analysée :** branche locale `claude/sharp-rubin-7fL5e`.
> **Méthode :** exploration parallèle (4 agents) + vérification manuelle des chemins critiques (RPC, trigger, AuthContext) via lecture directe et `grep -n` (numéros de ligne = vérité terrain).

### Légende des tags
- **[VÉRIFIÉ]** : lu directement dans le code, `fichier:ligne` à l'appui.
- **[SUPPOSÉ]** : déduction logique cohérente avec plusieurs sources, non prouvée à 100 %.
- **[À CONFIRMER]** : dépend d'un réglage hors-repo (dashboard Supabase, compte Resend, DNS) ou d'un défaut de librairie non vérifié.

---

## 0. TL;DR — les 8 constats qui pilotent la conception

1. **Auth = Supabase Auth**, deux clients front isolés (`supabase` / `supabaseAdmin`). Aucun OAuth aujourd'hui. **[VÉRIFIÉ]** `src/integrations/supabase/client.ts:10-36`
2. **Le trigger `handle_new_user` ne se déclenchera PAS pour un user Google.** Il ne crée `clients`+`wallets` que si `raw_user_meta_data->>'is_client' = 'true'` — métadonnée qu'un signup OAuth ne porte pas. **C'est le point d'intégration central du Chantier A.** **[VÉRIFIÉ]** `supabase/migrations/20260221400000_fix_client_email_in_trigger.sql:14`
3. **La création de compte se fait en deux temps** (trigger insère 5 colonnes → le front fait un `UPDATE clients` du reste). Ce pattern n'a pas d'équivalent en OAuth (pas de second formulaire) → **un onboarding post-OAuth est obligatoire.** **[VÉRIFIÉ]** `src/contexts/AuthContext.tsx:59-113`
4. **Champs requis au signup actuel = `firstName, lastName, country, phone, email, password`.** Google fournit `firstName/lastName/email` ; il **manque `phone` + `country`** → ce sont les champs bloquants à collecter post-OAuth. **[VÉRIFIÉ]** `src/pages/AuthPage.tsx` (steps 0-1)
5. **Aucune infrastructure email n'existe** (pas de Resend, pas de react-email, pas de table `email_log/outbox`). Les emails d'auth partent via le **SMTP par défaut de Supabase** = délivrabilité faible. Chantier B = greenfield. **[VÉRIFIÉ]** (`package.json`, `.env.example`, `supabase/config.toml`)
6. **Un sous-ensemble de clients n'a PAS d'email délivrable** : les clients créés par un admin sans email reçoivent un email synthétique `@bonzini-client.local`. **L'email n'est donc pas un canal universel.** **[VÉRIFIÉ]** `supabase/migrations/20260221400000` (backfill) + `…20260301240000:282`
7. **Le pattern asynchrone idéal pour le Chantier B existe déjà** : `pg_net` + Database Webhooks → Edge Function pour les notifications Telegram admin. On le réutilise tel quel pour l'email (outbox → drainer). **[VÉRIFIÉ]** `supabase/migrations/20260227000000_admin_telegram_webhooks.sql`
8. **Les notifications in-app sont insérées DANS les RPC métier** (même transaction que le débit/crédit). C'est la couture parfaite pour un *transactional outbox* email : on insère la ligne outbox juste à côté. **[VÉRIFIÉ]** (cf. §6)

---

## 1. Stack technique

| Couche | Choix | Source |
|---|---|---|
| Front | React 18 + Vite 5 + TypeScript 5.8 + Tailwind | `package.json:73,113,111` |
| Routing | `react-router-dom` ^6.30 (BrowserRouter) | `package.json:79` · `src/App.tsx` |
| State/data | `@tanstack/react-query` ^5.90 | `package.json:53` |
| Forms/validation | `react-hook-form` + `zod` ^3.25 | `package.json:76,86` |
| i18n | `i18next` + `react-i18next` (déjà multilingue !) | `package.json:65,77` |
| Backend | **Supabase** (Postgres + Auth + Edge Functions Deno) — projet `fmhsohrgbznqmcvqktjw` | `supabase/config.toml:1` |
| SDK | `@supabase/supabase-js` ^2.97 | `package.json:51` |
| Hébergement front | Vercel | `vercel.json` |
| Notifs admin | **Telegram** (bot + webhooks) | `supabase/functions/telegram-bot/`, `notify-admin/` |
| PDF | `@react-pdf/renderer`, `jspdf` | `package.json:50,68` |

**Tests** : Vitest (unit) + Playwright (e2e) présents. **[VÉRIFIÉ]** `package.json:12-15`

> **Note :** la racine du repo contient beaucoup d'artefacts hors-code (maquettes `.jsx`, PDF `email twilio bonzini*.pdf`, prompts `.md`). Les PDF "email twilio" suggèrent une exploration emailing antérieure ; **non exploités ici** (non faisant autorité). À demander au besoin.

---

## 2. Authentification actuelle

### 2.1 Deux clients Supabase isolés **[VÉRIFIÉ]** `src/integrations/supabase/client.ts:10-36`
```
supabase       → storageKey 'bonzini-client-auth' , persistSession:true , autoRefreshToken:true
supabaseAdmin  → storageKey 'bonzini-admin-auth'  , persistSession:true , autoRefreshToken:true
```
- `detectSessionInUrl` et `flowType` **NON définis** → valeurs par défaut de supabase-js v2. **[VÉRIFIÉ]** (absence) / **[À CONFIRMER]** (le défaut exact : pour OAuth on imposera explicitement `flowType:'pkce'` + `detectSessionInUrl:true`).
- Conséquence Chantier A : l'OAuth doit passer par le client `supabase` (jamais `supabaseAdmin`), et il faudra une **route de callback** dédiée (inexistante aujourd'hui).

### 2.2 Méthodes d'auth exposées **[VÉRIFIÉ]** `src/contexts/AuthContext.tsx`
| Méthode | Ligne | Implémentation |
|---|---|---|
| `signUp` | `:59` | `supabase.auth.signUp` + métadonnées + `UPDATE clients` + `signOut` |
| `signIn` | `:123` | `supabase.auth.signInWithPassword` |
| `resetPassword` | `:136` | `resetPasswordForEmail` → `/auth/reset-password` |
| `updatePassword` | `:146` | `auth.updateUser({password})` |
| **OAuth / social** | — | **ABSENT** (aucun `signInWithOAuth`/`signInWithIdToken` dans tout `src/`) **[VÉRIFIÉ]** |

### 2.3 Routes **[VÉRIFIÉ]** `src/App.tsx`
- `/auth` (`AuthPage`), `/auth/reset-password` (`ResetPasswordPage`), `/` (`LandingPage`).
- **Aucune route `/auth/callback`** → à créer pour OAuth.
- `ProtectedRoute` garde les pages client. `src/components/auth/ProtectedRoute.tsx`

---

## 3. Flow de création de compte client (détaillé)

### 3.1 Parcours UI — assistant 5 étapes **[VÉRIFIÉ]** `src/pages/AuthPage.tsx`
Entrée : `LandingPage` → `navigate('/auth?mode=signup')` (`src/pages/LandingPage.tsx:479`).

| Step | Champs | Requis ? |
|---|---|---|
| 0 — Identité | `firstName`, `lastName` | **Requis** (`min(1)`) |
| 1 — Contact | `country`, `phone`, `dateOfBirth` | `country` + `phone` **requis** (`phone min(8)`) ; `dateOfBirth` optionnel |
| 2 — Activité | `companyName`, `activitySector` | **Optionnels** (bouton "passer") |
| 3 — Adresse | `neighborhood`, `city` | **Optionnels** (bouton "passer") |
| 4 — Identifiants | `email`, `password`, `confirmPassword` | **Requis** (`email()`, `password min(6)`) |

**Schémas de validation** : `emailSchema=z.string().email()`, `passwordSchema=z.string().min(6)`, `nameSchema=min(1)`, `phoneSchema=min(8)`. `src/pages/AuthPage.tsx:36-39`
→ **Champs métier bloquants effectifs : `phone` + `country`** (les seuls requis que Google ne fournit pas).

### 3.2 Soumission **[VÉRIFIÉ]** `src/contexts/AuthContext.tsx:59-121`
1. `supabase.auth.signUp({ email, password, options:{ emailRedirectTo:'/', data:{ is_client:'true', first_name, last_name, phone, utm_* }}})` `:62-81`
   - ⚠️ `is_client` est passé comme **chaîne `'true'`** (et non booléen). Convention que le trigger lit en `= 'true'`.
2. Puis `supabase.from('clients').update({...tous les champs...}).eq('user_id', authData.user.id)` `:88-108`
   - **Pattern en deux temps** : le trigger crée la ligne minimale, le front la complète.
3. Puis `supabase.auth.signOut()` `:118` → force une connexion manuelle après inscription.

### 3.3 Trigger `handle_new_user` (version courante) **[VÉRIFIÉ]** `supabase/migrations/20260221400000_fix_client_email_in_trigger.sql:7-33`
```sql
IF NEW.raw_user_meta_data ->> 'is_client' = 'true' THEN
  INSERT INTO public.clients (user_id, first_name, last_name, phone, email)
  VALUES (NEW.id, COALESCE(... 'Utilisateur'), COALESCE(... ''), ..., NEW.email);
  INSERT INTO public.wallets (user_id, balance_xaf) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END IF;
```
- Trigger `on_auth_user_created` : `AFTER INSERT ON auth.users FOR EACH ROW`. `…20251220135027…:97-100`
- **8 redéfinitions successives** de la fonction dans l'historique ; la dernière (ci-dessus) ajoute `email`. **[VÉRIFIÉ]** (`grep` chronologique)
- 🔴 **Implication OAuth majeure** : un user créé via `signInWithOAuth` n'a **pas** `is_client` dans ses métadonnées (elles viennent des claims Google) → **le `IF` est faux → ni `clients` ni `wallets` créés**. Il faut donc, côté Chantier A, une **RPC d'onboarding** qui crée client+wallet (ou un ajustement du trigger), exécutée après le 1er login Google. **[SUPPOSÉ — fort]** (comportement standard de Supabase OAuth ; à reconfirmer en test Phase 6).

### 3.4 Création par un admin (chemin parallèle) **[VÉRIFIÉ]**
- RPC `admin_create_client` / `admin_create_admin` insèrent **manuellement** dans `auth.users` + `auth.identities` avec `email_confirmed_at = NOW()` et `email_verified:true`. `supabase/migrations/20260301240000_fix_duplicate_email_creation.sql:155-187, 318-352`
- Edge Functions `create-client`, `create-admin`, `create-agent` utilisent `email_confirm: true`. `supabase/functions/create-client/index.ts:208`
- **Email synthétique** quand aucun email fourni : `regexp_replace(phone,'[^0-9]','','g') || '@bonzini-client.local'`. `…20260301240000:282`, `…20260211100000:94`
- **Unicité téléphone** vérifiée dans `clients` ; **unicité email** seulement via `auth.users`. `…20260301240000:274`

---

## 4. Modèle de données (auth/clients)

### 4.1 Tables clés **[VÉRIFIÉ]**
| Table | Colonnes notables | Contraintes | Source |
|---|---|---|---|
| `clients` | first_name **NN**, last_name **NN**, phone, **email (nullable, NON UNIQUE)**, company_name, gender, status(ACTIVE/INACTIVE/SUSPENDED/PENDING_KYC), kyc_verified(bool=false), country, city, neighborhood, activity_sector, date_of_birth, utm_* | `user_id` **UNIQUE NN** FK→`auth.users` CASCADE | `…20260211000000_create_clients_table.sql:11-31`, `…20260412000001` (utm) |
| `user_roles` | role(app_role), first_name, last_name, email, **is_disabled(NN=false)**, last_login_at | `UNIQUE(user_id,role)` ; idx `(role,is_disabled)` | `…20251212074146…:21-27`, `…20260210000000_admin_management.sql:10-19` |
| `wallets` | balance_xaf BIGINT `CHECK>=0` | `user_id` UNIQUE NN FK→auth.users | `…20251212074146…:30-36` |
| `ledger_entries` | entry_type(enum), amount_xaf, balance_before/after, reference_type/id, metadata | FK wallet/user CASCADE ; **seule table de grand livre** | `…20260210100000_ledger_entries.sql:21-35` |

- `app_role` enum = `super_admin, ops, support, customer_success` (+ `cash_agent` `…20260107115502:2`, + `treasurer` `…20260515000003:21`). **Les clients ne sont PAS dans cet enum** : un client = ligne `clients`, pas un rôle. **[VÉRIFIÉ]**
- **`clients.email` n'est pas unique** ; l'ancre d'identité est `auth.users.email` (unicité gérée par GoTrue). Important pour le linking (cf. §7). **[VÉRIFIÉ]**

### 4.2 Pas de table OAuth dédiée **[VÉRIFIÉ]**
- Aucune table `oauth_accounts` / `identities` custom. Supabase fournit `auth.identities` (built-in) qui stocke déjà `provider` + `provider_id` + `identity_data` — **une table custom `oauth_accounts` est probablement INUTILE** pour le MVP ; à trancher en Phase 2.

### 4.3 RLS & rôles **[VÉRIFIÉ]**
- `wallets` : **SELECT-only** (aucune policy INSERT/UPDATE/DELETE) → toutes les écritures via RPC `SECURITY DEFINER`. `…20260222200000_security_fix_wallets_rls.sql:19-29`
- `clients` : SELECT/UPDATE own (`auth.uid()=user_id`) + admin ; INSERT `WITH CHECK (auth.uid()=user_id OR is_admin())`. `…20260211000000…:112-130`
- `ledger_entries` : SELECT own + admin ; INSERT admin-only. `…20260210100000…:75-88`
- `is_admin(_user_id)` **exclut `is_disabled=true`** (`is_disabled=false OR IS NULL`). `…20260222100000_security_fix_is_admin_disabled_check.sql:8-21` — conforme à la règle sécurité.
- `has_role()` ne vérifie PAS `is_disabled` (usage rôle-spécifique). `…20251212074146…:124-137`

---

## 5. État de l'emailing — NÉANT (greenfield)

| Vérification | Résultat | Source |
|---|---|---|
| Dépendance `resend` | **ABSENTE** | `package.json` (aucune) |
| `@react-email/*` / templates | **ABSENTS** | idem |
| Code d'envoi (nodemailer/sendgrid/SMTP) | **ABSENT** | aucun |
| Variables env email | **ABSENTES** (`.env.example` = 3 vars Supabase) | `.env.example:5-7` |
| SMTP custom Supabase | **NON configuré** dans `config.toml` | `supabase/config.toml` (minimal) |
| Tables `email_log/outbox/queue` | **ABSENTES** (existe `notifications` in-app, et `beneficiaries.email` ≠ infra email) | `…20260131000000`, `…20260304100000` |
| `pg_cron` | **ABSENT** ; `pg_net` **présent** | `…20260227000000:6` |

**Conséquences :**
- Les emails Supabase Auth (confirmation, reset, magic link) partent aujourd'hui via le **SMTP par défaut de Supabase** → quota très bas + réputation partagée = **mauvaise délivrabilité** (typique des fintech qui finissent en spam). Le Chantier B devra **router ces emails via Resend (SMTP custom Supabase)** en plus des emails métier.
- Les comptes créés par admin sont **auto-confirmés** ; le statut de confirmation des **auto-inscriptions** n'est pas dans le repo. **[À CONFIRMER — dashboard]** "Confirm email" activé ?

---

## 6. Événements métier & points d'accroche email

> Toutes les RPC sont `SECURITY DEFINER` et insèrent la **notification in-app dans la même transaction** que la mutation `wallets`/`ledger_entries`. **C'est exactement là qu'on insérera la ligne `email_outbox`** (couture transactionnelle, découplage garanti).
> ⚠️ Les citations ci-dessous corrigent celles d'un agent qui pointait des versions **périmées** de janvier (référençant la table supprimée `wallet_operations`). Versions **courantes** ci-dessous.

| Événement | RPC courante (`fichier:ligne` def) | `INSERT notifications` | Verrou | Ledger |
|---|---|---|---|---|
| Dépôt **créé** | `create_client_deposit` `…20260105122508…:2` | **AUCUNE** (gap) — statut `created` | LOCK TABLE | — |
| Dépôt **validé** | `validate_deposit` `…20260429120000…:16` | **`:154`** type `deposit_validated` | `FOR UPDATE` `:48,:87` | `:113` |
| Dépôt **rejeté** | `reject_deposit` `…20260221500000…:64` | **`:137`** type `deposit_rejected` | `FOR UPDATE` `:92` | — |
| Paiement **créé** | `create_payment` `…20260304300000…:9` | **`:134`** type `payment_created` | `FOR UPDATE` `:59` | `:110` |
| Paiement **en traitement** | `process_payment(start)` `…20260221200000…:186` | **`:199`** type `payment_processing` | — | — |
| Paiement **complété** | `process_payment(complete)` `…:214` | **`:257`** type `payment_completed` | — | `:229` |
| Paiement **rejeté/remboursé** | `process_payment(reject)` `…:272` | **`:329`** type `payment_rejected` | — (cf. dette §8) | `:292` (refund) |

- Variantes existantes : `create_admin_payment` (paiement créé par admin), paiements **cash** (`confirm_cash_payment`, `scan_cash_payment`). À cataloguer en Phase 3.
- **Idempotence native utile** : `validate_deposit` et `reject_deposit` font un *early-return* si le dépôt est déjà dans un état terminal (`if status='validated'…` `…20260429120000:54`). Une re-exécution ne réinsère donc pas la notification → bon point de départ pour l'idempotence email.
- **Types de notification = catalogue d'emails 1:1** : `deposit_validated, deposit_rejected, payment_created, payment_processing, payment_completed, payment_rejected` (+ `deposit_created` à créer).

### 6.1 Notifications in-app **[VÉRIFIÉ]** `…20260131000000_add_notifications_system.sql`
Table `notifications(id, user_id, type, title, message, metadata jsonb, is_read, created_at)`. Page `src/pages/NotificationsPage.tsx`. **Pas de colonne email** — c'est purement in-app.

### 6.2 Infra asynchrone réutilisable **[VÉRIFIÉ]** `…20260227000000_admin_telegram_webhooks.sql`
- `pg_net` (extension `net.http_post`) + **Database Webhooks** sur insert/update de `clients`, `exchange_rates`, `deposits`, `payments` → Edge Function `notify-admin` → Telegram.
- **C'est le squelette exact du drainer email** : `outbox` → webhook/`pg_net` → Edge Function → Resend. Aucun nouveau paradigme à introduire.
- ⚠️ Edge Functions appelées sans JWT user doivent avoir `verify_jwt=false` (cf. `generate-flyer` `supabase/config.toml:6-7`). À prévoir pour la fonction d'envoi.

### 6.3 Push notifications **[VÉRIFIÉ]** — **ABSENTES**
Aucun FCM / Web Push / service worker push / OneSignal / Expo. Les clients ne voient les notifs qu'en ouvrant l'app. (Hors périmètre, mais explique l'importance de l'email + Telegram.)

---

## 7. Pont vers les chantiers — implications de conception

### Chantier A (social login Google)
- **Lib** : `supabase.auth.signInWithOAuth({ provider:'google' })` via le client `supabase` ; route `/auth/callback` à créer ; `flowType:'pkce'` + `detectSessionInUrl:true` à imposer. **[À CONFIRMER]** défaut v2.
- **Trigger** : ne se déclenchant pas en OAuth (§3.3), prévoir **RPC `ensure_client_onboarded`** (crée `clients`+`wallets` si absents, idempotente `ON CONFLICT`) appelée au 1er login.
- **Onboarding** : collecter `phone` + `country` (bloquants) ; `firstName/lastName/email` pré-remplis depuis Google.
- **Account linking** : s'appuyer sur l'**auto-link par email vérifié natif Supabase** ; **[À CONFIRMER — dashboard]** réglages "Confirm email" (chemin mot de passe) + politique d'identités. Le pré-account-takeover vient du fait qu'une auto-inscription **non confirmée** pourrait pré-exister (§5) → à verrouiller en Phase 2.
- **Table `oauth_accounts`** : a priori **inutile** (`auth.identities` suffit). À trancher.

### Chantier B (emailing Resend)
- **Greenfield** : Resend + react-email (cohérent avec stack React/TS).
- **Outbox transactionnel** : table `email_outbox` + insert à côté de chaque `INSERT notifications` (§6) ; **drainer = pattern Telegram existant** (§6.2).
- **Délivrabilité** : router AUSSI les emails Supabase Auth via Resend (SMTP custom).
- **Segmentation critique** : exclure les `@bonzini-client.local` (non délivrables) — prévoir un flag "email réel ?" et inciter ces clients à renseigner un email.
- **Idempotence** : clé unique `(event_type, entity_id, recipient)` ; les *early-returns* des RPC (§6) aident déjà.

---

## 8. Dette technique / sécurité (pertinente au mandat)

| # | Constat | Gravité | Source |
|---|---|---|---|
| 1 | Création client **en 2 temps** (trigger + UPDATE front) : fragile (UPDATE peut échouer silencieusement, `console.error` seulement) et **inadaptée à l'OAuth**. | Moyenne (bloquant pour A) | `AuthContext.tsx:110-112` |
| 2 | **Confirmation email auto-inscription** : statut inconnu (réglage dashboard). Si désactivée → surface de pré-account-takeover. | **Haute (sécurité A)** | **[À CONFIRMER]** |
| 3 | **Emails synthétiques** `@bonzini-client.local` → clients non joignables par email. | Moyenne (cadrage B) | `…20260301240000:282` |
| 4 | `password min(6)` — faible pour une fintech. | Basse | `AuthPage.tsx:37` |
| 5 | `process_payment` (refund) **sans `FOR UPDATE`** sur le wallet (mitigé par garde de statut). | Basse | `…20260221200000:272-329` |
| 6 | `is_client` passé en **chaîne `'true'`** (convention fragile). | Cosmétique | `AuthContext.tsx:70` |
| 7 | `deposit_created` **sans notification** (pas de couture email à la création de dépôt). | Basse (gap fonctionnel) | `…20260105122508` |
| 8 | ~10 migrations `diagnostic_*`/`debug_*` (27/02) laissées dans l'arbre. | Cosmétique | `…20260227110000`→`…180000` |

> Les références `profiles` / `wallet_operations` dans `src/` sont des **commentaires / mapping UI uniquement**, pas des requêtes DB → **pas un bug** (tables bien supprimées par `…20260221300000_drop_legacy_tables.sql`). **[VÉRIFIÉ]**

---

## 9. Questions ouvertes — à confirmer hors-repo

1. **Dashboard Supabase → Auth :** "Confirm email" activé pour l'auto-inscription ? Politique de **linking d'identités** (auto-link même email) au défaut ? **SMTP custom** déjà branché ? *(Je ne peux pas voir ces réglages depuis le repo.)*
2. **Resend :** compte + clé API + domaine vérifié (tu te reconnectais). Bloque l'implémentation B, pas le design.
3. **DNS `bonzinilabs.com` :** accès confirmé (toi) → on définira SPF/DKIM/DMARC + sous-domaine en Phase 3.
4. **App native iOS/Android** prévue ? (rappel : décide de l'obligation Apple). Réponse Phase 0 = web/PWA pour l'instant → Google-only OK.
5. **Clients sans email réel** : quelle politique produit (les forcer à en saisir un ? canal alternatif ?).

---

*Fin de l'audit (Phase 1). Prochaine étape : Phase 2 — design du social login (`docs/design-social-login.md`), après validation.*
