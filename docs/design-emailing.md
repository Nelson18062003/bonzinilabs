# Design — Emails transactionnels via Resend (Chantier B)

> **Phase 3.** Conception du système d'emails déclenchés par les événements du cycle de vie client. **Aucun code écrit** (design only ; l'implémentation UI/templates invoquera `/frontend-design` en Phase 5).
> **Prérequis :** `docs/audit-auth-emailing-bonzini.md` (Phase 1) + `docs/design-social-login.md` (Phase 2).
> **Date :** 2026-05-30. Faits techniques vérifiés par 2 agents de recherche (docs officielles Resend/Supabase/Google/Yahoo ; sources en §10).

### Légende : **[DÉCISION]** · **[VÉRIFIÉ]** (doc officielle / `fichier:ligne`) · **[À CONFIRMER]** (réglage hors-repo / test Phase 6)

---

## 0. TL;DR — les 9 décisions

1. **Architecture = transactional outbox** : les RPC métier insèrent une ligne `email_outbox` **dans la même transaction** que le `notifications` ; un drainer envoie en asynchrone. **Resend down ≠ paiement bloqué.** **[DÉCISION]**
2. **Drainer = `pg_cron` toutes les 1 min** (balaye `pending`/`failed`, backoff, retry intégré). Latence ≤ 60 s, acceptable. Webhook événementiel = option d'accélération plus tard. **[DÉCISION]**
3. **2 chemins d'envoi distincts** : (a) **emails Auth** (confirmation, reset) → **SMTP custom Supabase = Resend** ; (b) **emails métier** (dépôt/paiement/bienvenue) → outbox → Edge Function → **API Resend + react-email**. **[DÉCISION]**
4. **Templates = react-email** (tourne nativement en Edge Function Deno — pattern officiel Supabase), **FR**, i18n-ready, mobile-first, **+ partie texte brut**. **[DÉCISION/VÉRIFIÉ]**
5. **Sous-domaine d'envoi dédié `send.bonzinilabs.com`** (isolation de réputation). DNS : SPF + DKIM(CNAME) + MX(bounce) + DMARC `p=none`. **[DÉCISION/VÉRIFIÉ]**
6. **Idempotence à 2 couches** : contrainte `UNIQUE(idempotency_key)` sur l'outbox (garde primaire, `ON CONFLICT DO NOTHING`) + en-tête **`Idempotency-Key` Resend** (fenêtre 24 h). **[DÉCISION/VÉRIFIÉ]**
7. **Pas d'email marketing en v1** (taux du jour reste in-app). On **prépare le schéma** opt-in/opt-out + `List-Unsubscribe` mais on n'envoie rien. **Le transactionnel est exempt de désinscription 1-clic.** **[DÉCISION/VÉRIFIÉ]**
8. **Email = identifiant de A** : destinataire résolu via `auth.users.email` ; **les `@bonzini-client.local` sont exclus** (status `skipped`). **[DÉCISION]**
9. **Budget** : le free tier (100/jour) saturera vite → on envoie un **set v1 minimal à forte valeur** pour rester gratuit le plus longtemps, puis **palier Pro (~20 $/mois)**. **[DÉCISION/VÉRIFIÉ]**

---

## 1. Architecture d'envoi — outbox + drainer (synchrone vs queue tranché)

**Pourquoi pas d'envoi synchrone dans le handler :** si Resend est lent/down, on bloquerait (ou ferait échouer) un dépôt/paiement. **Règle absolue : découplage.**
**Pourquoi pas de queue lourde (Kafka/RabbitMQ) :** ~100 emails/jour. Sur-ingénierie. On reste sur Postgres + cron.

```
RPC métier (validate_deposit, create_payment, process_payment…)  [SECURITY DEFINER]
   │  même transaction :
   ├─ INSERT notifications  (in-app, existant)
   └─ INSERT email_outbox   (status='pending', idempotency_key UNIQUE)   ◄── couture
   │
   ▼ COMMIT  (réussit même si l'email échoue plus tard)
─────────────────────────────────────────────────────────────────
[pg_cron · toutes les 1 min]  → Edge Function `send-email`
   │  SELECT … FROM email_outbox WHERE status IN ('pending','failed')
   │        AND attempts < max_attempts AND next_attempt_at <= now()  FOR UPDATE SKIP LOCKED
   │  résout destinataire (auth.users.email) ; skip si @bonzini-client.local
   │  rend le template react-email ; POST api.resend.com/emails
   │        header Idempotency-Key = '<event>:<entity_id>:<recipient>'
   │  UPDATE status='sent' (+ resend_message_id)  OU  'failed' (+ attempts++, backoff)
─────────────────────────────────────────────────────────────────
[Webhook Resend]  → Edge Function `resend-events`  (signature Svix vérifiée)
   delivered / bounced / complained / suppressed
   → MAJ email_outbox.delivery_status + table email_suppressions (anti-renvoi)
```

- **Réutilise un pattern déjà en place** : `pg_net` + Database Webhooks alimentent déjà `notify-admin` (Telegram) `supabase/migrations/20260227000000`. Le drainer suit la même philosophie (HTTP async vers Edge Function). **[VÉRIFIÉ]**
- **`pg_cron`** : extension standard Supabase à **activer** (Phase 1 : `pg_net` présent, **pas** `pg_cron`). **[VÉRIFIÉ absence]**
- **`FOR UPDATE SKIP LOCKED`** : évite qu'un run cron concurrent traite deux fois la même ligne.
- **Option latence < 60 s (plus tard)** : Database Webhook sur `INSERT email_outbox` → même Edge Function. `pg_cron` reste le filet de retry. Pas nécessaire en v1.

---

## 2. Catalogue des emails

> Coutures = points `INSERT notifications` repérés en Phase 1 (versions courantes). On ajoute l'`INSERT email_outbox` juste à côté.
> **V1** = on envoie. **Différé** = couture posée mais envoi désactivé (économie de quota / valeur faible car déjà couvert in-app).

| # | Événement | Déclencheur (`fichier:ligne`) | Template | Destinataire | Type | Données dynamiques | v1 ? |
|---|---|---|---|---|---|---|---|
| 1 | **Vérification email** | Supabase Auth (Confirm email) → SMTP Resend | `auth_confirm`* | client | transac. | lien de confirmation | ✅ |
| 2 | **Reset mot de passe** | `resetPasswordForEmail` `AuthContext.tsx:139` → SMTP Resend | `auth_reset`* | client | transac. | lien de reset | ✅ |
| 3 | **Bienvenue** | post-onboarding (outbox) — couvre password **et** Google | `welcome` | client | transac. | prénom | ✅ |
| 4 | **Dépôt validé** | `validate_deposit` `…20260429120000:154` | `deposit_validated` | client | transac. | montant, nouveau solde, référence | ✅ |
| 5 | **Paiement créé (accusé)** | `create_payment` `…20260304300000:134` | `payment_created` | client | transac. | référence, montant XAF/CNY, solde | ✅ |
| 6 | **Paiement complété** | `process_payment` complete `…20260221200000:257` | `payment_completed` | client | transac. | référence, bénéficiaire, (lien reçu) | ✅ |
| 7 | **Paiement rejeté/remboursé** | `process_payment` reject `…:329` | `payment_rejected` | client | transac. | référence, raison, montant remboursé | ✅ |
| 8 | **Dépôt rejeté** | `reject_deposit` `…20260221500000:137` | `deposit_rejected` | client | transac. | référence, raison | ✅ |
| 9 | Dépôt créé (accusé) | `create_client_deposit` `…20260105122508` (ajouter notif+outbox) | `deposit_created` | client | transac. | référence, montant | Différé |
| 10 | Paiement en traitement | `process_payment` start `…:199` | `payment_processing` | client | transac. | référence | Différé |
| 11 | Mot de passe modifié (sécurité) | `updatePassword` `AuthContext.tsx:147` | `password_changed` | client | transac. | date/heure | Différé |
| 12 | Relance dépôt non finalisé | `pg_cron` (deposits `created`/`proof_submitted` depuis 24 h) | `deposit_reminder` | client | transac.** | référence | Différé |
| 13 | Relance profil incomplet | `pg_cron` (clients sans phone/country, OAuth) | `onboarding_reminder` | client | transac.** | — | Différé |
| 14 | **Taux du jour** | `pg_cron` quotidien (FUTUR) | `daily_rate` | clients **opt-in** | **MARKETING** | taux XAF/CNY | ❌ (pas v1) |

\* Emails Auth = templates Supabase (dashboard) envoyés via SMTP Resend en v1 ; upgrade possible vers Send Email Hook + react-email plus tard (§3.3).
\*\* Relances = transactionnelles « douces » (déclenchées par inaction) ; à cadencer prudemment, jamais en boucle (idempotence + flag « relance déjà envoyée »).

**Set v1 minimal (quota) :** #1, #2, #3, #4, #5, #6, #7, #8. Les accusés à faible valeur ajoutée (#9, #10 — déjà visibles in-app) sont différés pour préserver les 100/jour gratuits.

---

## 3. Templates

### 3.1 Choix technique **[VÉRIFIÉ]**
- **react-email** (`@react-email/components`) + `renderAsync` **tournent dans l'Edge Function Deno** via specifiers `npm:` — c'est le **pattern officiel Supabase** (guide « Custom Auth Emails with React Email and Resend »). Versions **épinglées** (ex. `react@18.3.1`, `resend@4.x`, `@react-email/components@0.0.x`).
- Envoi : **API REST Resend** (`POST /emails`) depuis l'Edge Function (le plus simple en Deno) ; SDK `npm:resend` réservé à la vérification des webhooks.
- **Partie texte brut** (multipart/alternative) générée par react-email → meilleure délivrabilité + lisibilité mobile/bas débit.

### 3.2 Structure & branding
- **Layout partagé** : en-tête logo Bonzini, corps une colonne (mobile-first, gros CTA), pied de page (raison sociale, mention légale ; bloc désinscription **uniquement** pour le marketing).
- **Couleurs logo** (rappel `frontend.md`) en accents : violet `258 100% 60%`, amber `36 100% 55%`, orange `16 100% 55%` — sobre, pas de dégradés lourds.
- **Langue : FR** seul en v1, **i18n-ready** (l'app a déjà `i18next`/`react-i18next` `package.json:65,77` — on factorise les chaînes pour ajouter l'EN plus tard).
- **Messaging (`frontend.md`)** : « paiement / régler vos fournisseurs », jamais « transfert d'argent / envoyer de l'argent ».
- **Images minimales** (data chère CEMAC) ; logo léger, pas d'images lourdes.
- ⚠️ L'implémentation visuelle (Phase 5) **invoquera `/frontend-design`** avant tout code.

### 3.3 Emails Auth (confirmation / reset)
- **v1 : SMTP custom Supabase = Resend** (templates Supabase dashboard, brandés en texte) → rapide, bonne délivrabilité, priorité = arriver.
- **Plus tard : Send Email Hook** Supabase → Edge Function react-email (templates Auth alignés sur le design system). **[VÉRIFIÉ]** option documentée.

---

## 4. Délivrabilité (priorité, pas annexe)

### 4.1 DNS pour `send.bonzinilabs.com` (à créer sur Vercel DNS) **[VÉRIFIÉ]**
| Type | Nom | Valeur | Prio |
|---|---|---|---|
| TXT (SPF) | `send.bonzinilabs.com` | `v=spf1 include:_spf.resend.com -all` | — |
| CNAME (DKIM) | `resend._domainkey.send.bonzinilabs.com` | `resend._domainkey.resend.com` | — |
| MX (bounce/return-path) | `send.bonzinilabs.com` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT (DMARC) | `_dmarc.send.bonzinilabs.com` | `v=DMARC1; p=none; rua=mailto:dmarc@bonzinilabs.com` | — |

- **Le dashboard Resend génère les valeurs exactes** — les copier verbatim (le nom CNAME peut varier selon le provider DNS, relatif vs absolu). **[À CONFIRMER]**
- **DMARC** : commencer `p=none`, lire les rapports `rua`, puis monter `quarantine` → `reject`. Ne **jamais** passer `reject` avant d'avoir vérifié toutes les sources d'envoi.
- **Alignement** : `From:` = `…@send.bonzinilabs.com` pour aligner avec DKIM/SPF (alignement relaxé).
- ⚠️ Si tu as vérifié le **domaine racine** `bonzinilabs.com` dans Resend (cf. ta question), c'est OK — on enverra depuis la racine ; mais le **sous-domaine `send.` reste recommandé** pour isoler la réputation. À décider selon ce que montre ton dashboard Resend.

### 4.2 Routage des emails Auth via Resend (SMTP custom) **[VÉRIFIÉ]**
- SMTP par défaut Supabase = **~4 emails/heure**, « test only » → inutilisable en prod.
- Supabase → Authentication → SMTP : `smtp.resend.com`, port **465** (TLS) **[À CONFIRMER 465 vs 587]**, user `resend`, password = **clé API Resend**, From `noreply@send.bonzinilabs.com`, Sender name « Bonzini ».
- **Après activation**, Supabase impose un cap initial **30/h** → à **relever** dans Rate Limits.
- Intégration en 1 clic Resend↔Supabase disponible (auto-remplit SMTP + crée la clé). **[VÉRIFIÉ]**

### 4.3 Conformité Google/Yahoo 2024+ **[VÉRIFIÉ]**
- **Tous expéditeurs (même < 100/j)** : SPF **ou** DKIM, PTR valide (géré par Resend/SES sur IP partagée), TLS, **taux de plainte < 0,3 %**, format RFC 5322. → couvert par notre setup.
- **Bulk (> 5 000/j vers Gmail)** : SPF **et** DKIM, DMARC aligné, **désinscription 1-clic** (`List-Unsubscribe` + `List-Unsubscribe-Post`, RFC 8058) — **marketing uniquement**. **Le transactionnel (nos emails v1) en est exempt.**
- **Warm-up** : non nécessaire à < 100/j sur IP partagée Resend (réputation déjà établie) ; ce qui compte = auth correcte + cadence régulière + gestion des bounces.

### 4.4 Do/Don't fintech Afrique **[VÉRIFIÉ]**
- ✅ `From:` constant et brandé (« Bonzini »), liens **HTTPS complets** (jamais de raccourcisseurs bit.ly = signal phishing), partie texte, sujets transactionnels (« Confirmez votre paiement »), Google Postmaster Tools, suppression des hard-bounces sous 24 h.
- ❌ Mots déclencheurs (« gratuit », « urgent », « offre limitée »), MAJUSCULES/!!!, mélange transac./marketing sur le même sous-domaine, emails tout-image.

---

## 5. Consentement & opt-out (marketing — préparé, pas activé en v1)

- **Transactionnel** : pas de consentement requis (email attendu suite à une action) ; pas de `List-Unsubscribe` obligatoire.
- **Marketing (taux du jour, futur)** : **opt-in explicite** + **opt-out 1-clic** + honorer sous 48 h + **sous-domaine séparé** (`news.bonzinilabs.com`) pour isoler la réputation.
- **Schéma préparé maintenant** (sans envoi) :
  - `clients.marketing_opt_in BOOLEAN DEFAULT false`, `marketing_opt_in_at TIMESTAMPTZ`.
  - table `email_unsubscribes` (token, email, scope, created_at) + endpoint/page de désinscription.
- Règle : un email marketing ne part **jamais** vers un client `opt_in = false`.

---

## 6. Idempotence, retry, logging

### 6.1 Table `email_outbox` (proposition) **[DÉCISION]**
```sql
CREATE TABLE public.email_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT NOT NULL,            -- 'payment_completed', 'deposit_validated', …
  entity_id        UUID,                     -- payment_id / deposit_id / user_id
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email  TEXT,                     -- résolu à l'enqueue ; NULL/.local => skipped
  template         TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',   -- données dynamiques du template
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed','skipped')),
  attempts         INT NOT NULL DEFAULT 0,
  max_attempts     INT NOT NULL DEFAULT 5,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error       TEXT,
  resend_message_id TEXT,
  delivery_status  TEXT,                     -- MAJ par webhook: delivered/bounced/complained
  idempotency_key  TEXT NOT NULL UNIQUE,     -- '<event>:<entity_id>:<recipient>'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ
);
-- RLS: aucune policy client (table interne) ; écrite par RPC SECURITY DEFINER + service role.
```
+ table `email_suppressions (email PK, reason, created_at)` alimentée par les webhooks bounced/complained.

### 6.2 Idempotence — 2 couches **[VÉRIFIÉ]**
1. **DB (primaire)** : `INSERT … ON CONFLICT (idempotency_key) DO NOTHING` dans la RPC. Un événement re-déclenché (replay, double-clic, re-run) **n'enfile pas** un 2ᵉ email. Les RPC ont déjà des gardes de statut (early-return) qui aident `…20260429120000:54`.
2. **Resend (secondaire)** : header `Idempotency-Key` (fenêtre **24 h**) → même si le drainer renvoie après un crash, Resend dédoublonne.

### 6.3 Retry & observabilité
- **Retry** : `pg_cron` reprend `failed` avec `attempts < max_attempts` et backoff exponentiel (`next_attempt_at`). Au-delà → `failed` définitif (alerte admin possible).
- **Découplage prouvé** : si Resend down, les lignes restent `pending` ; la transaction métier a déjà commité. Aucun paiement/dépôt impacté.
- **Logging** : l'outbox **est** le journal ; les webhooks Resend complètent `delivery_status` (delivered/bounced/complained) → visibilité bout-en-bout + liste de suppression.

---

## 7. Connexion à l'identité de A (le pont)

- **Destinataire = `auth.users.email`** (miroir `clients.email` posé par le trigger `…20260221400000:22`).
- **Exclusion** : `recipient_email IS NULL` ou se terminant par `@bonzini-client.local` → `status='skipped'` (clients téléphone-seul créés par admin, Phase 1 §0.6). Prévoir une **incitation in-app** à renseigner un vrai email.
- **Bienvenue (#3)** déclenchée **après l'onboarding** de A → couvre password (après confirmation) **et** Google (email déjà vérifié, pas de confirm).
- **Dépendance d'ordre A→B (rappel Phase 2 §6.3)** : activer « Confirm email » exige que l'email de confirmation arrive → **SMTP Resend branché AVANT** d'activer Confirm email.

---

## 8. Ce que TU dois configurer (hors-repo)
1. **Vercel DNS** : créer les 4 enregistrements `send.bonzinilabs.com` (§4.1) — valeurs exactes depuis le dashboard Resend.
2. **Resend** : créer une **clé API** ; ajouter un **webhook** (events delivered/bounced/complained) → récupérer le **signing secret**.
3. **Supabase → Edge Functions → Secrets** : `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (jamais dans le repo / le chat). 🔒
4. **Supabase → Auth → SMTP** : Resend (§4.2) + relever le rate limit ; puis **activer « Confirm email »**.
5. **Supabase** : activer l'extension **`pg_cron`**.
6. **Google Postmaster Tools** : enregistrer `bonzinilabs.com` (suivi taux de spam/réputation).

---

## 9. Points à confirmer / tester (Phase 6)
- **[À CONFIRMER]** Domaine vérifié dans Resend : racine `bonzinilabs.com` ou `send.` ? (adapte le `From`).
- **[À CONFIRMER]** Port SMTP 465 vs 587 ; rate limit API Resend 2 vs 5 req/s.
- **[À CONFIRMER]** Volume réel : si confirmations de paiement > ~80/j → passer **Pro** (sinon cap 100/j atteint).
- **[À CONFIRMER]** Nom exact du CNAME DKIM avec sous-domaine (dashboard Resend).
- Test délivrabilité réel via mail-tester.com / Postmaster Tools (Phase 6).

---

## 10. Sources (vérifié 2026-05-30)
- Supabase — Custom Auth Emails (React Email + Resend) : https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend
- Supabase — Send emails (Edge Functions) : https://supabase.com/docs/guides/functions/examples/send-emails
- Supabase — Custom SMTP : https://supabase.com/docs/guides/auth/auth-smtp
- Supabase — Send Email Hook : https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- Resend — Send with Supabase Edge Functions : https://resend.com/docs/send-with-supabase-edge-functions
- Resend — Send with Supabase SMTP : https://resend.com/docs/send-with-supabase-smtp
- Resend — Idempotency Keys : https://resend.com/docs/dashboard/emails/idempotency-keys
- Resend — Batch : https://resend.com/docs/api-reference/emails/send-batch-emails
- Resend — Webhooks (event types / verify) : https://resend.com/docs/dashboard/webhooks/event-types
- Resend — Domains / DNS : https://resend.com/docs/dashboard/domains/introduction
- Resend — DMARC policy modes : https://resend.com/blog/dmarc-policy-modes
- Resend — Quotas & limits : https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Google — Email sender guidelines : https://support.google.com/a/answer/81126
- Yahoo — Sender best practices : https://senders.yahooinc.com/best-practices/
- RFC 8058 (one-click unsubscribe) : https://datatracker.ietf.org/doc/html/rfc8058

---

*Fin du design Chantier B (Phase 3). Prochaine étape après validation : Phase 4 — plan d'implémentation (`docs/plan-implementation-auth-emailing.md`), A puis B, en lots.*
