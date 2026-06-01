# Design — Social login Google (Chantier A)

> **Phase 2.** Conception détaillée du social login Google greffé sur le flow client existant. **Aucun code écrit** (design only ; l'implémentation UI invoquera `/frontend-design` en Phase 5).
> **Prérequis :** lire `docs/audit-auth-emailing-bonzini.md` (Phase 1).
> **Date :** 2026-05-30. Faits techniques vérifiés par 3 agents de recherche sur docs officielles Supabase/Google (sources en fin de doc).

### Légende
- **[DÉCISION]** : choix de conception à valider.
- **[VÉRIFIÉ]** : confirmé sur doc officielle (source citée en §11) ou code Phase 1 (`fichier:ligne`).
- **[À CONFIRMER]** : dépend d'un réglage hors-repo (dashboard) ou d'un test Phase 6.

---

## 0. TL;DR — les 7 décisions

1. **Google seul**, via `supabase.auth.signInWithOAuth` (flux **redirect + PKCE**), aucun SDK tiers. **[DÉCISION]**
2. **Config client à modifier** : `flowType:'pkce'` + `detectSessionInUrl:true` sur `supabase`. ⚠️ Mitigation multi-clients = **ne PAS monter `supabaseAdmin` sur la route `/auth/callback`** (le `detectSessionInUrl:false` seul **ne suffit pas** — bug supabase-js #931 : le code PKCE est traité quoi qu'il arrive). **[DÉCISION/VÉRIFIÉ]**
3. **Pas de table `oauth_accounts`** : `auth.identities` (built-in Supabase) stocke déjà provider + `sub`. **[DÉCISION]**
4. **Le trigger `handle_new_user` est étendu** pour créer `clients`+`wallets` aussi pour un user OAuth (sinon ils ne sont jamais créés). **[DÉCISION]**
5. **Linking = auto-link natif Supabase (vérifié↔vérifié uniquement)** + blocage explicite des cas non vérifiés. **Pré-requis sécurité : "Confirm email" ON.** **[DÉCISION/VÉRIFIÉ]**
6. **Onboarding post-OAuth** : collecte `phone` + `country` (seuls champs requis que Google ne fournit pas), avec **garde de complétion** bloquant paiements/dépôts tant que c'est vide. **[DÉCISION]**
7. **Dépendance A→B** : activer "Confirm email" **exige** que l'email de confirmation soit délivrable → **Resend (SMTP custom) doit être branché AVANT** de flipper ce réglage. **[DÉCISION — contrainte d'ordre]**

---

## 1. Provider & librairie

| Élément | Choix | Justification |
|---|---|---|
| Provider v1 | **Google uniquement** | Phase 0 (web/PWA → pas d'obligation Apple) |
| Méthode | `supabase.auth.signInWithOAuth({ provider:'google' })` — **flux redirect** | Le plus simple pour une SPA Vite, **aucun SDK Google à charger** (plus léger en 3G CEMAC). **[VÉRIFIÉ]** |
| Écartée | `signInWithIdToken` (Google One Tap) | Nécessite le SDK Google JS + nonce + "JavaScript origins" → plus de surface, gain UX marginal. **[VÉRIFIÉ]** |
| Compat auth actuelle | ✅ Additif | N'ajoute qu'un provider à Supabase Auth ; coexiste avec email/mot de passe. Utilise le client `supabase` existant (jamais `supabaseAdmin`). |

**Scopes** : `openid email profile` (non-sensibles → pas de revue de sécurité Google lourde). Pas besoin de `access_type:offline` (on n'appelle aucune API Google au nom de l'user). **[VÉRIFIÉ]**

---

## 2. Configuration client Supabase (à modifier)

> Aujourd'hui `src/integrations/supabase/client.ts:10-36` ne définit ni `flowType` ni `detectSessionInUrl`. Défauts v2 **[VÉRIFIÉ — source GoTrueClient]** : `detectSessionInUrl:true`, `flowType:'implicit'` — on impose `pkce` explicitement.

**[DÉCISION]** — design cible (à implémenter en Phase 5) :
```
supabase (app client)
  auth: { storageKey:'bonzini-client-auth', persistSession:true, autoRefreshToken:true,
          flowType:'pkce', detectSessionInUrl:true }

supabaseAdmin (app admin)
  auth: { storageKey:'bonzini-admin-auth', persistSession:true, autoRefreshToken:true,
          detectSessionInUrl:false }          ◄── complément ; le vrai fix = ne pas monter ce client sur /auth/callback
```

**Le vrai risque multi-clients (corrigé après recherche) :** au retour OAuth, `/auth/callback` contient `?code=`. Si **les deux** `GoTrueClient` sont instanciés sur cette page, les deux tentent l'échange ; or le *code verifier* PKCE n'existe que sous le storageKey du client initiateur (`bonzini-client-auth`), et un code PKCE n'est échangeable **qu'une seule fois** → l'autre client échoue. **`detectSessionInUrl:false` NE suffit PAS** à bloquer ça (bug supabase-js #931 : le code PKCE est traité indépendamment de ce flag). **Mitigation primaire = isolation de route : ne jamais importer/monter `supabaseAdmin` sur `/auth/callback`** (l'app admin reste en mot de passe → aucune raison de l'y monter). `detectSessionInUrl:false` sur l'admin = ceinture-bretelles complémentaire. **[VÉRIFIÉ]** **[À CONFIRMER]** : aucune page partagée n'importe `supabaseAdmin` sur la route callback.

---

## 3. Parcours complet (diagramme)

```
[AuthPage / (option) Landing]
   │  clic « Continuer avec Google »
   ▼
supabase.auth.signInWithOAuth({ provider:'google',
        options:{ redirectTo: `${origin}/auth/callback` } })
   │  redirection navigateur → data.url
   ▼
[Écran de consentement Google]
   │
   ▼
[https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback]
   │   GoTrue : applique le LINKING automatique (si email vérifié des 2 côtés)
   │   redirection retour avec ?code=...
   ▼
[/auth/callback]  (route NOUVELLE, minimale, app client only)
   │  detectSessionInUrl → échange PKCE → session établie (onAuthStateChange: SIGNED_IN)
   │  fallback explicite : supabase.auth.exchangeCodeForSession()
   │
   ├─ user.email_verified == false ? ──► signOut() + écran ERREUR (blocage)        [CAS D]
   │
   ├─ erreur GoTrue « email déjà utilisé / identity exists » ?                      [CAS B]
   │        ──► message « Un compte existe déjà avec cet email. Connecte-toi par
   │            mot de passe, puis lie Google depuis ton profil. » (PAS de 2e compte)
   │
   ▼  session OK  (nouvel utilisateur Google  OU  compte existant auto-lié)
[Garantie d'onboarding]
   │  Le trigger étendu a créé clients+wallets si absents (§5.3)
   │  Réconciliation téléphone : si phone saisi == phone d'un client @bonzini-client.local
   │        existant ──► parcours « revendiquer mon compte » (assisté admin, §6.4)
   ▼
[clients.phone ET clients.country présents ?]
   ├─ OUI (compte existant déjà complet) ─────────────► [App active]                [CAS A]
   └─ NON ──► [/onboarding]  collecte phone + country (+ optionnels)
                              prénom/nom/email pré-remplis depuis Google
                    ──► sauvegarde ──────────────────► [App active]                 [CAS C]
```

---

## 4. Données fournies par Google vs requises

| Donnée | Google la fournit ? | Requise au signup actuel ? | Action |
|---|---|---|---|
| email | ✅ (`email`, `email_verified`) | ✅ | Identité — vient de Google |
| nom complet | ✅ (`full_name` / `name`, **chaîne unique**) | ✅ (prénom+nom) | Pré-rempli, **éditable** à l'onboarding |
| prénom / nom séparés | ❌ Supabase **ne mappe PAS** `given_name`/`family_name` | ✅ | Découpe heuristique de `full_name` → corrigé par l'user |
| photo | ✅ (`picture`/`avatar_url`) | ❌ | Optionnel → `clients.avatar_url` |
| **téléphone** | ❌ | ✅ (`phoneSchema.min(8)`) | **Onboarding (bloquant)** |
| **pays** | ❌ | ✅ | **Onboarding (bloquant)** |
| société, secteur, adresse, date naiss. | ❌ | ❌ (optionnels) | Onboarding (optionnels / plus tard) |

**[VÉRIFIÉ]** champs requis actuels = `firstName,lastName,country,phone,email,password` (`src/pages/AuthPage.tsx` steps 0-1-4). En OAuth, pas de password ; **seuls `phone` + `country` manquent** réellement.
**[VÉRIFIÉ]** Google via Supabase fournit `full_name`/`name` (**pas** de prénom/nom séparés dans `user_metadata` — Supabase les écarte). Claims bruts dans `user.identities[].identity_data` ; `sub` = clé provider stable.

---

## 5. Modèle de données & création de compte

### 5.1 Pas de table `oauth_accounts` **[DÉCISION]**
`auth.identities` (built-in) contient déjà `provider`, `provider_id` (=`sub`), `identity_data`, `user_id`. Les providers liés se lisent via `user.identities` / `user.app_metadata.providers`. Une table custom **dupliquerait** ça → on n'en crée pas.
*Optionnel (analytics, non bloquant)* : une colonne `clients.signup_method TEXT` (`'password'|'google'`) pour le reporting. À trancher.

### 5.2 Le problème central : le trigger ne se déclenche pas en OAuth **[VÉRIFIÉ]**
`handle_new_user` ne crée `clients`+`wallets` que si `raw_user_meta_data->>'is_client'='true'` (`supabase/migrations/20260221400000:14`). Un signup OAuth n'a pas cette métadonnée → **ni client ni wallet créés**.

### 5.3 Solution recommandée : **étendre le trigger** (Option 2) **[DÉCISION]**
Plutôt qu'un appel client-side fragile, on étend la condition pour couvrir l'OAuth (robuste, côté serveur, dans la transaction d'`INSERT auth.users`). Pseudo-SQL cible (Phase 5) :
```sql
-- déclenche si is_client OU si provider OAuth (les admins n'utilisent jamais l'OAuth)
IF NEW.raw_user_meta_data->>'is_client' = 'true'
   OR NEW.raw_app_meta_data->>'provider' = 'google' THEN
  INSERT INTO public.clients (user_id, first_name, last_name, phone, email)
  VALUES (
    NEW.id,
    -- OAuth Google: pas de prénom/nom séparés → full_name dans first_name,
    -- l'onboarding laisse l'user corriger prénom/nom
    COALESCE(NEW.raw_user_meta_data->>'first_name',
             NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',     -- NULL en OAuth → complété à l'onboarding
    NEW.email
  ) ON CONFLICT (user_id) DO NOTHING;     -- idempotent (ajout vs version actuelle)
  INSERT INTO public.wallets (user_id, balance_xaf) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END IF;
```
- **Garde-fou** : `provider='google'` ⇒ c'est un client (l'OAuth est réservé à l'app client, Phase 0). Les admins (créés par RPC, `provider='email'`, pas de `is_client`) ne matchent pas. **[VÉRIFIÉ]** `app_role` ne contient pas de rôle "client".
- **Ajout d'`ON CONFLICT (user_id)` sur le INSERT clients** (la version actuelle n'en a pas) : sécurise contre une double-exécution.

**Alternative (Option 1, écartée par défaut)** : laisser le trigger tel quel + RPC `ensure_client_onboarded()` (SECURITY DEFINER, idempotente) appelée par la SPA au 1er login. Plus explicite mais dépend d'un appel client-side qui peut échouer. *Repli si tu préfères ne pas toucher le trigger.*

### 5.4 Onboarding — écriture des champs métier
Écran `/onboarding` → `UPDATE clients SET phone, country, [company_name, activity_sector...] WHERE user_id = auth.uid()` (RLS "update own" déjà en place, `…20260211000000:117`). **Mass-assignment** : ne mettre à jour QUE la liste blanche de champs ; jamais `kyc_verified`/`status` depuis le client.

---

## 6. Stratégie d'account linking (détaillée — le piège sécurité)

### 6.1 Mécanisme natif **[VÉRIFIÉ]**
Supabase **auto-lie** une nouvelle identité (Google) à un user existant **si et seulement si** l'email de l'identité existante est **vérifié/confirmé** et identique. Email cible non vérifié ⇒ **refus** d'auto-link (protection explicite contre le *pre-account-takeover*). Manual linking (`linkIdentity()`) **désactivé par défaut**. SSO/SAML exclus du linking.

### 6.2 Matrice de décision **[DÉCISION]**
| Cas | Google `email_verified` | Compte existant (même email) | Comportement Bonzini |
|---|---|---|---|
| **A** | true | email/mdp **vérifié** | **Auto-link natif** → connexion au compte existant. clients/wallet déjà là → app directe. ✅ sûr |
| **B** | true | email/mdp **NON vérifié** (legacy) | **Pas d'auto-link** (Supabase refuse). On affiche : « connecte-toi par mot de passe puis lie Google depuis ton profil ». **Aucun 2e compte créé.** |
| **C** | true | aucun | **Nouveau user** Google → trigger crée client+wallet → onboarding phone/country → actif. |
| **D** | **false** | quelconque | **Blocage** : `signOut()` + erreur. Jamais de création/lien. (Fintech : un email non vérifié n'atteint pas le KYC.) |

> **Nuance [VÉRIFIÉ] :** pour un compte Google dont l'email n'est **pas** `@gmail.com` et sans claim `hd` (Workspace), `email_verified=true` ne signifie PAS que Google fait autorité sur cet email. On s'appuie donc sur la confirmation côté Supabase, pas seulement sur le claim Google. (Cas rare pour la cible CEMAC, majoritairement Gmail.)

### 6.3 Pré-requis non négociable : "Confirm email" ON **[DÉCISION/sécurité]**
Si "Confirm email" est **OFF**, un attaquant peut créer `victime@gmail.com` par mot de passe (compte considéré "confirmé" sans preuve) ; au login Google de la victime, l'auto-link pourrait rattacher son identité Google au compte de l'attaquant. **→ Garder/activer "Confirm email" ON** rend le cas B impossible en régime permanent (plus de squatteur non vérifié).
⚠️ **Conséquence produit & dépendance B** : activer "Confirm email" ajoute une étape de confirmation au signup mot de passe **et** l'email de confirmation **doit arriver**. Aujourd'hui il partirait via le SMTP Supabase par défaut (délivrabilité faible, Phase 1 §5). **→ Brancher Resend (SMTP custom) AVANT de flipper "Confirm email".** C'est la couture A↔B.

### 6.4 Edge case Bonzini : comptes `@bonzini-client.local` **[DÉCISION — limitation connue]**
Un client créé par admin (téléphone seul) a un email synthétique non-Gmail. S'il se connecte un jour via Google (son vrai Gmail) → **nouveau compte distinct** (aucune collision d'email) → **doublon** (un compte `.local` + un compte Gmail pour le même humain, chacun avec son wallet).
- **Ne JAMAIS auto-fusionner** deux `auth.users` distincts portant des soldes financiers (risque).
- **Mitigation** : à l'onboarding, si le `phone` saisi correspond à un client `.local` existant → parcours **« revendiquer mon compte »** assisté **admin** (vérification + transfert du wallet/historique), ou a minima un flag d'alerte côté admin. À spécifier en détail si tu valides le principe.

### 6.5 Rôles **[VÉRIFIÉ]**
Un user OAuth n'obtient aucune ligne `user_roles` → `is_admin()` renvoie false → **jamais admin**. L'OAuth ne peut pas être un vecteur d'escalade de privilège.

---

## 7. Sécurité (synthèse OWASP-orientée)

| Risque | Traitement |
|---|---|
| Interception du code d'autorisation | **PKCE** (`flowType:'pkce'`) — *code verifier* en storage, échange one-shot. **[VÉRIFIÉ]** |
| CSRF / state | Géré par GoTrue dans le flux OAuth (param `state` interne). |
| Open redirect | `redirectTo` doit être dans l'**allowlist** Supabase (URL Configuration). **[homework dashboard]** |
| Course multi-clients sur le callback | `detectSessionInUrl:false` sur `supabaseAdmin` (§2). **[VÉRIFIÉ]** |
| Pre-account-takeover | Auto-link vérifié-only + "Confirm email" ON (§6.3). |
| Email provider non vérifié | Cas D → blocage. |
| Fusion de comptes financiers | Interdite en auto ; téléphone → parcours admin (§6.4). |
| Mass assignment (onboarding) | Liste blanche de champs ; `auth.uid()` only ; jamais `kyc_verified/status` côté client. |
| Escalade via OAuth | Impossible (pas de `user_roles`). |

---

## 8. Wireframes textuels

> L'implémentation visuelle (Phase 5) **invoquera `/frontend-design`** avant tout code. Ici = structure/contenu seulement. Le bouton Google doit respecter les **Google Branding Guidelines** (fond blanc, « G » officiel, libellé « Continuer avec Google »).

**8.1 `/auth` (login & signup)**
```
┌───────────────────────────────┐
│   [Logo Bonzini]              │
│   Connexion / Créer un compte │
│                               │
│  ┌─────────────────────────┐  │
│  │  G  Continuer avec Google│  │  ◄ bouton (les 2 onglets)
│  └─────────────────────────┘  │
│        ──────  ou  ──────      │
│   email    [____________]     │
│   mot de passe [_________]    │
│   [  Se connecter  ]          │
└───────────────────────────────┘
```

**8.2 `/auth/callback` (nouvelle route, minimale)**
```
        [spinner]
   Connexion en cours…
(succès → onboarding/app ; erreur → /auth?error=…)
```
Page volontairement ultra-légère (retour 3G rapide).

**8.3 `/onboarding` (nouveaux users Google)**
```
┌───────────────────────────────┐
│  Bonjour {given_name} 👋       │
│  Plus qu'une étape pour payer  │
│  vos fournisseurs.             │
│                               │
│  Pays *        [▼ sélection]  │   ◄ bloquant
│  Téléphone *   [+xxx ________]│   ◄ bloquant (réutilise PhoneCountryInput)
│  Société       [____________] │   (optionnel)
│  Secteur       [____________] │   (optionnel)
│  [  Continuer  ]              │
└───────────────────────────────┘
```

**8.4 Garde de complétion (Protected route)**
Un client connecté sans `phone`+`country` → redirigé vers `/onboarding` avant l'accès à NewPayment/NewDeposit. (Extension de `src/components/auth/ProtectedRoute.tsx`.)

**8.5 Écrans d'erreur**
- **D — email non vérifié** : « Votre compte Google n'a pas d'email vérifié. Utilisez un email vérifié ou créez un compte par mot de passe. »
- **B — email déjà utilisé** : « Un compte existe déjà avec cet email. Connectez-vous par mot de passe, puis liez Google depuis votre profil. »
- **Annulation / refus Google** : retour silencieux sur `/auth`.
- **Réseau** : « Connexion impossible, réessayez. »

---

## 9. Ce que TU dois configurer (hors-repo)

**Google Cloud Console** (je ne peux pas le faire) :
1. OAuth consent screen : External, scopes `openid/email/profile`, privacy policy + homepage, **publier en Production** (évite l'avertissement "app non vérifiée" + le cap 100 users). Astuce : **pas de logo custom** au début (déclenche une revue brand de plusieurs jours). **[VÉRIFIÉ]**
2. Credentials → OAuth client ID **Web application** → Authorized redirect URI = **`https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback`** (+ `http://127.0.0.1:54321/auth/v1/callback` en dev). Ajouter aussi le domaine de l'app en **Authorized JavaScript origins** (défensif). **[VÉRIFIÉ]**
   - *Recommandé (confiance + cohérence avec l'email)* : domaine d'auth custom **`auth.bonzinilabs.com`**, sinon Google affiche `fmhsohrgbznqmcvqktjw.supabase.co` sur l'écran de consentement.

**Supabase Dashboard** :
3. Authentication → Providers → **Google** : coller Client ID + Client Secret.
4. Authentication → URL Configuration → **Redirect URLs** : ajouter `https://<domaine-app>/auth/callback` (+ localhost dev).
5. Authentication → **"Confirm email" = ON** (cf. §6.3) — **après** branchement Resend.

---

## 10. Points à confirmer / tester (Phase 6)
- **[À CONFIRMER]** Comportement exact de GoTrue au **cas B** (erreur renvoyée vs création d'un user séparé) → à tester réellement.
- **[À CONFIRMER]** "Confirm email" actuellement ON ou OFF (dashboard).
- **[À CONFIRMER]** Aucune page n'importe `supabaseAdmin` sur `/auth/callback` (isolation de route — cf. §2, bug supabase-js #931).

---

## 11. Sources (vérifié 2026-05-30)
- Supabase — Initializing / auth options : https://supabase.com/docs/reference/javascript/initializing
- Supabase — `signInWithOAuth` : https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase — PKCE flow : https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase — Login with Google : https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase — Identity Linking : https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase — `linkIdentity` : https://supabase.com/docs/reference/javascript/auth-linkidentity
- Google — OpenID Connect claims : https://developers.google.com/identity/openid-connect/openid-connect
- Google — OAuth scopes : https://developers.google.com/identity/protocols/oauth2/scopes
- Google — App verification / production : https://support.google.com/cloud/answer/13463073
- supabase-js #931 — detectSessionInUrl ignoré en PKCE : https://github.com/supabase/supabase-js/issues/931
- Supabase — pré-account-takeover si "Confirm email" OFF : https://github.com/orgs/supabase/discussions/29327
- Supabase — Google ne renvoie pas given_name/family_name : https://github.com/orgs/supabase/discussions/28415

---

*Fin du design Chantier A (Phase 2). Prochaine étape après validation : Phase 3 — design emailing (`docs/design-emailing.md`).*
