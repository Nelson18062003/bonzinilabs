# Supabase Client Rules

## Two Clients — NEVER MIX THEM
- `supabase` — client app (storageKey: `bonzini-client-auth`)
- `supabaseAdmin` — admin app (storageKey: `bonzini-admin-auth`)

Sessions are completely isolated via different storageKeys. Using the wrong client returns empty data with no error — silent failure.

## THE MOST CRITICAL RULE
**If a hook, page, or component lives in the ADMIN app: ALL queries and mutations MUST use `supabaseAdmin`.**

Using `supabase` in admin context = unauthenticated request = empty results. There is no error message. This is the #1 source of bugs in this codebase.

## Edge Functions — Do Not Use From Frontend
- `supabaseAdmin.functions.invoke()` fails with "Invalid JWT" due to GoTrueClient session conflicts
- Instead: use standard `auth.signUp()` for user creation + direct table queries for setup
- For operations requiring elevated privileges: use `SECURITY DEFINER` RPC functions

## User Creation Pattern (Working)
1. `auth.signUp()` with a temporary Supabase client created with `persistSession: false` — this does NOT affect the admin session
2. `handle_new_user` database trigger fires automatically → creates `clients` + `wallets` records
3. The trigger ONLY fires when user metadata contains `is_client: true`

Do not attempt to create clients/wallets manually. The trigger handles it.
