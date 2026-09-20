# Proposition — garde d'appelant sur les edge functions internes

Statut : **proposé, non appliqué** (flux d'autorisation → validation requise).
Registre : F-048 à F-052.

> Mise à jour 19/09 (F-083) : le helper `_shared/caller.ts` existe désormais et
> est branché sur `cargo-lookup` / `cargo-sync` uniquement. Différence avec le
> §1 ci-dessous : `isServiceCaller` est asynchrone et, si l'égalité avec
> `SUPABASE_SERVICE_ROLE_KEY` échoue, valide le Bearer auprès de Supabase
> (`GET /auth/v1/admin/users`, 200 seulement pour une clé service) — le runtime
> injecte la nouvelle clé `sb_secret_…` alors que Vault garde le JWT historique.
> Les gardes des autres fonctions (§2 à §6) restent à valider.

## Constat (preuves)

La passerelle Supabase (`verify_jwt = true` par défaut) accepte **tout JWT
signé par le projet, y compris la clé anonyme** livrée dans le bundle client
(`src/lib/env.ts` → `VITE_SUPABASE_PUBLISHABLE_KEY`). Le code interne s'en
sert d'ailleurs lui-même : `admin-assistant/index.ts:496-498` appelle
`generate-receipt` avec `Authorization: Bearer <anon>`. Une fonction sans
contrôle d'appelant dans son corps est donc **publique**.

| Fonction | Contrôle actuel | Ce que permet la clé anonyme | Preuve |
|---|---|---|---|
| `send-brief` | aucun | `{type:"alert", alert:{kind, details}}` → texte **arbitraire** posté dans le groupe Telegram admin + ligne dans `briefs_log` | `send-brief/index.ts:375-395`, `:410-416` |
| `generate-receipt` | aucun | reçu Bonzini (PNG + PDF officiels) avec référence, montant, nom de client **inventés** | `generate-receipt/index.ts:183-205` |
| `predict-rate` | aucun | appel Anthropic facturé + `INSERT rate_predictions` en service-role | `predict-rate/index.ts:20-60` |
| `monitor-rates` | aucun | scraping Binance, `INSERT` snapshots, alerte Telegram | `monitor-rates/index.ts:1-15` (service-role, aucun test d'en-tête) |
| `fetch-macro` | aucun | `INSERT macro_snapshots` + déclenchement de `send-brief` alert | `fetch-macro/index.ts:250-270` |
| `generate-report-pdf` | aucun | rendu Satori 3 pages (CPU) à volonté | `generate-report-pdf/index.ts:295-330` |
| `notify-admin-assignment` | JWT quelconque (client compris) | fausse notification « X a pris la conversation Y » ; `changed_by_admin_user_id` vient du corps, jamais lié à `auth.uid()` | `notify-admin-assignment/index.ts:44-77` |
| `telegram-bot` | `chat.id === TELEGRAM_CHAT_ID` seulement | si déployée `--no-verify-jwt` (obligatoire pour que Telegram la joigne), un POST forgé avec l'id du groupe exécute `/publier` ou `/config` — pas de `X-Telegram-Bot-Api-Secret-Token` | `telegram-bot/index.ts:633-647`, `:403-440` |

Les appelants légitimes passent déjà un secret : `fetch-macro → send-brief`
avec la clé service (`fetch-macro:259-268`), `telegram-bot → generate-flyer /
generate-report-pdf` avec la clé service (`telegram-bot:464-469`, `:505-510`),
`cargo-sync` / `cargo-lookup` vérifient déjà `Bearer <service>` (`cargo-sync:160-161`).
Seul `admin-assistant` appelle `generate-receipt` et `generate-flyer` avec la
clé anonyme (`:496-498`, `:861-863`) : il faut le passer en clé service dans
le même lot.

## Changement proposé

### 1. Helper partagé `supabase/functions/_shared/caller.ts`

```ts
// Garde d'appelant commune aux edge functions internes.
// - isServiceCaller : Bearer == SUPABASE_SERVICE_ROLE_KEY (comparaison en temps constant).
// - activeAdmin     : JWT utilisateur → ligne user_roles active (is_disabled ≠ true).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** Vrai si l'appel porte la clé service (pg_cron, fonction → fonction). */
export function isServiceCaller(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return key.length > 0 && timingSafeEqual(bearer(req), key);
}

/** Admin actif porté par le JWT, ou null. Ne lit jamais le rôle « à la main ». */
export async function activeAdmin(req: Request): Promise<{ id: string; role: string } | null> {
  const token = bearer(req);
  if (!token) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const scoped = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await scoped.auth.getUser();
  if (!user) return null;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data } = await admin.from("user_roles").select("role, is_disabled").eq("user_id", user.id).maybeSingle();
  if (!data || data.is_disabled) return null;
  return { id: user.id, role: String(data.role) };
}
```

### 2. Garde en tête de chaque fonction interne

`send-brief`, `predict-rate`, `monitor-rates`, `fetch-macro`,
`generate-report-pdf`, `generate-receipt`, `generate-flyer` :

```ts
import { isServiceCaller } from "../_shared/caller.ts";
// après le OPTIONS :
if (!isServiceCaller(req)) return new Response("Unauthorized", { status: 401 });
```

`generate-flyer` garde `verify_jwt = false` (préflight CORS) : la garde dans
le corps suffit, comme pour `cargo-sync`.

### 3. `notify-admin-assignment` : lier l'acteur au JWT

```ts
import { activeAdmin } from "../_shared/caller.ts";
const actor = await activeAdmin(req);
if (!actor) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
// puis : .eq("user_id", actor.id) à la place de payload.changed_by_admin_user_id
```

Le champ `changed_by_admin_user_id` du corps devient ignoré (le type côté
front `src/lib/notify-assignment.ts` peut le garder, il est simplement inerte).

### 4. `admin-assistant` : appels internes en clé service

`admin-assistant/index.ts:498` et `:863` : `Authorization: Bearer ${serviceKey}`
(la constante `serviceKey` existe déjà à `:2821`).

### 5. `telegram-bot` : secret de webhook

```ts
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
if (!WEBHOOK_SECRET) return new Response("Missing TELEGRAM_WEBHOOK_SECRET", { status: 500 });
if (req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
```

Déploiement : `npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=…` puis
`setWebhook` avec `secret_token=<même valeur>` (fail-closed : sans secret,
le bot refuse tout).

### 6. Jobs pg_cron

Les jobs qui appellent `fetch-macro`, `send-brief`, `predict-rate`,
`monitor-rates` doivent passer `Authorization: Bearer <service_role_key>`
(même mécanique que `run_cargo_sync`, `migrations/20260913_consolidated.sql:263`,
qui lit la clé dans `vault` / `app_settings`). À vérifier dans le dashboard
avant de déployer la garde : **un job sans en-tête casserait le brief du matin.**

## Ordre de déploiement (sans interruption)

1. Déployer `admin-assistant` (clé service vers receipt/flyer) — sans effet visible.
2. Vérifier/adapter les jobs cron (en-tête Bearer service).
3. Déployer les gardes (`_shared/caller.ts` + 8 fonctions).
4. Poser `TELEGRAM_WEBHOOK_SECRET` et refaire `setWebhook`.

## Ce qui ne change pas

- `passkey`, `send-email`, `send-sms`, `telnyx-webhook`, `resend-events`,
  `notify-admin`, `cargo-sync`, `cargo-lookup`, `admin-assistant` : déjà
  gardées (signature, secret ou JWT admin vérifié dans le corps).
- Aucune RPC, aucune table, aucun montant.
