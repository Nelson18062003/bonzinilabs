# Plan d'implémentation — Social login + Emails transactionnels (Bonzini)

> **Phase 4.** Lots ordonnés, estimations, critères de validation, et partage des tâches (toi vs moi). **Chantier A avant B.** Toujours **aucun code écrit** ; l'implémentation démarre en Phase 5 après validation de ce plan.
> **Prérequis :** `docs/design-social-login.md` (A) + `docs/design-emailing.md` (B) + `docs/audit-auth-emailing-bonzini.md` (terrain).
> **Date :** 2026-05-30.

### Légende : **[MOI]** = code par Claude · **[TOI]** = config hors-repo (DNS, dashboards, secrets) · **[VÉRIF]** = critère de validation du lot.

---

## 0. TL;DR

- **2 chantiers, ~13 lots.** A (auth Google) ≈ **14–20 h** de build ; B (emailing) ≈ **20–30 h**. Hors config **[TOI]**.
- **Ordre imposé** : A complet et testé **avant** B (l'email vérifié de A alimente B). Et **dépendance dure dans B** : SMTP Resend branché **avant** d'activer « Confirm email ».
- **Décision d'implémentation clé à valider (§2)** : pour brancher les emails, **trigger sur la table `notifications`** plutôt qu'éditer chaque grosse RPC `SECURITY DEFINER`. Bien plus sûr.
- Chaque lot : petit, type-checké/buildé, validable isolément. On commit lot par lot sur `claude/sharp-rubin-7fL5e`.
- Règle projet respectée : **toute UI invoque `/frontend-design` avant code** ; après chaque lot **`npm run type-check`**, avant de shipper **`npm run build`** (skill `/verify`).

---

## 1. Ordonnancement & dépendances

```
CHANTIER A (auth)
 A0[TOI] Console Google + Supabase provider ─┐
 A1 config client supabase (pkce)            ├─► A3 bouton Google ─► A4 callback ─► A5 onboarding+garde ─► A6 (option) revendication .local
 A2 trigger handle_new_user (OAuth) ─────────┘                                   │
                                                                                  ▼
                                                                        ✅ A validé/testé (Phase 6 partielle)
                                                                                  │
CHANTIER B (emailing)                                                             ▼
 B0[TOI] DNS send. + Resend key/webhook + secrets + pg_cron
 B1 schéma email_outbox/suppressions ─► B2 enqueue (trigger notifications) ─► B4 drainer (Edge+cron) ─► B5 webhooks
 B3 templates react-email (// de B2)                                   ▲
 B0b[TOI] SMTP Resend ─► (puis) activer « Confirm email » ────────────┘  (AVANT tests d'inscription)
 B7 (préparé, inactif) opt-in/opt-out marketing
```

**Jalons de validation (toi)** : après **A5** (parcours Google bout-en-bout) ; après **B4** (1er email réel reçu) ; après **B5** (bounce/plainte traités).

---

## 2. ⭐ Décision d'implémentation à valider — comment brancher les emails

**Le problème :** les événements (dépôt validé, paiement créé/complété/rejeté…) vivent dans de **grosses RPC `SECURITY DEFINER`** (`validate_deposit`, `create_payment`, `process_payment`…). Les éditer une par une pour ajouter un `INSERT email_outbox` est **risqué** (fonctions critiques, règle `database.md` : `DROP FUNCTION` si le type de retour change, etc.).

**L'observation clé (Phase 1) :** **chaque** événement email fait **déjà** un `INSERT INTO notifications` dans la même transaction. Et les RPC ont des gardes de statut (early-return) → la notif est insérée **exactement une fois** par événement terminal.

**Option recommandée — Trigger `AFTER INSERT ON notifications` :**
```
notifications (INSERT par la RPC, dans SA transaction)
   └─► TRIGGER enqueue_email_from_notification()  [SECURITY DEFINER]
         si notifications.type ∈ table de mapping (type → template)
         INSERT INTO email_outbox (..., idempotency_key = 'notif:' || NEW.id)
         ON CONFLICT (idempotency_key) DO NOTHING
```
| | Trigger sur `notifications` ✅ | Éditer chaque RPC ❌ |
|---|---|---|
| Touche les RPC critiques | **Non** (zéro régression) | Oui (risqué) |
| Point d'intégration | **1 seul** (+ table de mapping) | ~6 RPC |
| Même transaction (découplage) | **Oui** (trigger interne) | Oui |
| Idempotence | **native** (1 notif = 1 ligne, `NEW.id` unique) | à coder par RPC |
| Filtrage (quels types → email) | table de mapping (whitelist) | par RPC |

**Exceptions hors-notifications** (enqueue direct, pas de notif associée) : **Bienvenue** (#3, post-onboarding) et les **relances** (#12, #13, via `pg_cron`). Les emails **Auth** (#1, #2) ne passent pas par l'outbox du tout → SMTP Supabase.

➡️ **À valider :** je pars sur le **trigger `notifications`** (recommandé). Si tu préfères l'édition explicite des RPC, dis-le.

---

## 3. CHANTIER A — Social login Google

### A0 — Config Google + Supabase **[TOI]** · ~30–45 min
- Google Cloud : OAuth consent screen (External, scopes `openid email profile`, **publier en Production**), OAuth client **Web** → redirect URI `https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback` (+ `127.0.0.1:54321` en dev).
- Supabase : Auth → Providers → **Google** (Client ID/Secret) ; Auth → URL Configuration → ajouter `https://<app>/auth/callback` (+ localhost).
- **[VÉRIF]** Le provider Google est « Enabled » dans Supabase ; un test manuel `signInWithOAuth` redirige bien vers Google. *(Je te fournis la checklist exacte au démarrage du lot.)*

### A1 — Config client Supabase **[MOI]** · ~1 h
- `src/integrations/supabase/client.ts` : ajouter `flowType:'pkce'`, `detectSessionInUrl:true` sur `supabase` ; `detectSessionInUrl:false` sur `supabaseAdmin`.
- Vérifier qu'aucune route `/auth/callback` n'importera `supabaseAdmin` (bug #931).
- **[VÉRIF]** `npm run type-check` OK ; login email/mot de passe existant **non régressé**.

### A2 — Trigger `handle_new_user` pour OAuth **[MOI]** · ~2 h (migration)
- Nouvelle migration : étendre la condition à `raw_app_meta_data->>'provider'='google'`, mapper `full_name`→`first_name` (Google ne donne pas prénom/nom séparés), `ON CONFLICT (user_id) DO NOTHING` sur `clients` **et** `wallets`.
- **[VÉRIF]** Test local : un INSERT `auth.users` simulant un user Google crée bien `clients`+`wallets` ; un admin (sans `is_client`, provider `email`) n'en crée pas. `npm run build` OK.

### A3 — Bouton « Continuer avec Google » **[MOI]** · ~2–3 h (**invoque `/frontend-design`**)
- `AuthContext.tsx` : méthode `signInWithGoogle()` (`signInWithOAuth`, `redirectTo:'/auth/callback'`, scopes).
- `AuthPage.tsx` : bouton (branding Google officiel) sur les 2 modes (login/signup) + séparateur « ou ». (Option : bouton sur la landing.)
- **[VÉRIF]** Clic → écran de consentement Google. type-check OK.

### A4 — Route callback **[MOI]** · ~3–4 h
- Nouvelle page `src/pages/AuthCallbackPage.tsx` (minimale, spinner) + route `/auth/callback` dans `App.tsx`.
- Gérer : succès (session) ; **cas D** email non vérifié → `signOut` + erreur ; **cas B** collision email → message « connecte-toi par mot de passe puis lie Google » ; annulation/réseau.
- **[VÉRIF]** Les 4 cas affichent le bon écran (testés en Phase 6).

### A5 — Onboarding + garde de complétion **[MOI]** · ~4–5 h (**invoque `/frontend-design`**)
- `src/pages/OnboardingPage.tsx` : collecte `phone` (réutilise `PhoneCountryInput`) + `country` (bloquants), prénom/nom/email pré-remplis, optionnels (société/secteur). `UPDATE clients` **liste blanche** (jamais `kyc_verified/status`).
- `ProtectedRoute.tsx` : si client connecté sans `phone`+`country` → redirige vers `/onboarding` avant NewPayment/NewDeposit.
- **[VÉRIF]** Nouveau user Google → onboarding → app ; user déjà complet → accès direct ; impossible d'atteindre un paiement sans phone+country.

### A6 — (Option) Revendication compte `@bonzini-client.local` **[MOI]** · ~3–4 h — *peut être différé après v1*
- À l'onboarding : si `phone` saisi == phone d'un client `.local` existant → flag + **parcours assisté admin** (vérif + transfert wallet/historique). **Jamais de fusion auto.**
- **[VÉRIF]** Détection du doublon → écran d'alerte ; aucune fusion automatique de soldes.

**Sous-total A (sans A6) : ~12–15 h [MOI] + ~45 min [TOI].**

---

## 4. CHANTIER B — Emailing

### B0 — Config délivrabilité & secrets **[TOI]** · ~1–2 h (+ propagation DNS)
- Vercel DNS : 4 enregistrements `send.bonzinilabs.com` (SPF/DKIM/MX/DMARC, valeurs exactes du dashboard Resend).
- Resend : clé API + webhook (delivered/bounced/complained) → signing secret.
- Supabase → Edge Functions → Secrets : `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (🔒 jamais dans le repo/chat).
- Supabase : activer extension **`pg_cron`**. Google Postmaster Tools : enregistrer le domaine.
- **[VÉRIF]** Domaine « Verified » dans Resend ; `dig` montre SPF/DKIM/DMARC.

### B0b — SMTP Auth + Confirm email **[TOI]** · ~30 min — *après B0*
- Supabase → Auth → SMTP = Resend (`smtp.resend.com`, user `resend`, pwd=clé API, From `noreply@send.bonzinilabs.com`) ; relever le rate limit (30/h → prod).
- **PUIS** activer « **Confirm email** » (sécurité linking, Phase 2). **Pas avant** que le SMTP marche.
- **[VÉRIF]** Un reset password réel arrive via Resend (pas SMTP Supabase).

### B1 — Schéma `email_outbox` + suppressions **[MOI]** · ~2–3 h (migration)
- Tables `email_outbox` (avec `idempotency_key UNIQUE`, statuts, retry/backoff) + `email_suppressions` ; RLS interne ; table de mapping `notification.type → template`.
- **[VÉRIF]** `npm run build` OK ; insert manuel respecte la contrainte d'unicité.

### B2 — Enqueue via trigger `notifications` **[MOI]** · ~2–3 h (migration) — *dépend B1, §2*
- Fonction `enqueue_email_from_notification()` `SECURITY DEFINER` + trigger `AFTER INSERT ON notifications` ; résout `recipient_email` (skip `@bonzini-client.local`).
- Hook **Bienvenue** (#3) à la fin de l'onboarding (A5).
- **[VÉRIF]** Valider un dépôt (env. de test) crée 1 ligne `email_outbox` `pending` ; re-déclenchement → pas de doublon.

### B3 — Templates react-email **[MOI]** · ~5–7 h (**invoque `/frontend-design`**) — *// de B2*
- Layout partagé (logo, 3 couleurs en accents, mobile-first, texte brut) + 8 templates v1 (welcome, deposit_validated/rejected, payment_created/completed/rejected). FR, i18n-ready. Messaging `frontend.md` (« régler vos fournisseurs »).
- **[VÉRIF]** Rendu HTML+texte ; aperçu mobile ; pas d'images lourdes ni de liens raccourcis.

### B4 — Drainer (Edge Function + cron) **[MOI]** · ~4–5 h
- Edge Function `send-email` : `SELECT … FOR UPDATE SKIP LOCKED`, rend le template, `POST api.resend.com/emails` + header `Idempotency-Key`, MAJ `sent`/`failed`+backoff. `pg_cron` toutes les 1 min. `verify_jwt=false` (config.toml).
- **[VÉRIF]** Un vrai email arrive en boîte ; couper la clé API → ligne `failed` qui **retry**, **aucun** impact transaction métier.

### B5 — Webhooks Resend **[MOI]** · ~3–4 h
- Edge Function `resend-events` : vérif signature **Svix** sur **body brut**, MAJ `delivery_status`, alimente `email_suppressions` (bounced/complained), dédup par `svix-id`.
- **[VÉRIF]** Un bounce simulé marque l'email supprimé et bloque les renvois.

### B7 — (Préparé, inactif) opt-in/opt-out marketing **[MOI]** · ~2 h — *optionnel v1*
- Colonnes `clients.marketing_opt_in*` + table `email_unsubscribes` + page de désinscription. **Aucun envoi marketing.**
- **[VÉRIF]** Schéma en place ; build OK.

**Sous-total B (sans B7) : ~18–25 h [MOI] + ~2–3 h [TOI].**

---

## 5. Récap « ce que TU fais » (checklist hors-repo)
1. **A0** Google Cloud Console (OAuth client + consent screen Production).
2. **A0** Supabase : provider Google + Redirect URLs.
3. **B0** Vercel DNS : 4 records `send.bonzinilabs.com`.
4. **B0** Resend : clé API + webhook (→ signing secret).
5. **B0** Supabase Secrets : `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Activer `pg_cron`.
6. **B0b** Supabase SMTP = Resend, **puis** activer « Confirm email ».
7. Google Postmaster Tools (suivi délivrabilité).
> Je te donne la **procédure pas-à-pas** au début de chaque lot concerné. Les secrets se posent **dans Supabase**, jamais dans le chat. 🔒

---

## 6. Plan de vérification (préfigure la Phase 6)
- **A** : inscription Google (nouveau) → onboarding → app ; collision email (cas B) ; email non vérifié (cas D) ; garde de complétion ; non-régression login mot de passe ; un user Google n'est jamais admin.
- **B** : chaque email v1 déclenché et reçu ; idempotence (re-trigger → 1 seul mail) ; **Resend down → transaction métier OK** ; bounce/plainte → suppression ; **délivrabilité réelle** via mail-tester.com + Postmaster (objectif : inbox, pas spam).

---

## 7. Risques & limites
| Risque | Mitigation |
|---|---|
| Régression sur les RPC financières | **Trigger `notifications`** (§2) → on n'y touche pas. |
| Free tier 100/j saturé | Set v1 minimal (8 emails) ; **palier Pro** quand le volume monte. |
| `@bonzini-client.local` non joignables | `status='skipped'` + incitation in-app à saisir un email. |
| Doublon Google vs compte `.local` | A6 (revendication assistée admin) ; jamais de fusion auto. |
| Délai cache schéma Supabase / type-gen | `/gen-types` + `DROP FUNCTION` avant `CREATE` si retour change (`database.md`). |
| Délai propagation DNS | B0 lancé tôt (en // du build A). |

---

## 8. Décisions à valider avant Phase 5
1. **Stratégie d'enqueue = trigger `notifications`** (§2) — OK ? *(reco)*
2. **A6 (revendication `.local`)** dans la v1, ou différé après ? *(reco : différé)*
3. **B7 (schéma marketing)** maintenant ou plus tard ? *(reco : plus tard)*
4. **Set v1 = 8 emails** (vs tout activer) — OK ? *(reco : 8)*
5. **Découpage des PR** : une PR par chantier (A, puis B), ou une PR par lot ? *(reco : par chantier, commits par lot)*

---

*Fin du plan (Phase 4). Après validation → Phase 5 : implémentation par lots, en commençant par A1/A2 (A0 étant ta config Google).*
