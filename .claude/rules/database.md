# Database Rules

## Active Tables (source of truth)
- `clients` — client data (name, phone, email, KYC status). Use for all client info queries.
- `user_roles` — admin data (name, email, role, is_disabled). Use for all admin info queries.
- `ledger_entries` — financial ledger (deposits, payments, adjustments). The ONLY ledger table.
- `wallets` — client balances. SELECT-only via RLS. Never mutate directly.

## DROPPED TABLES — NEVER QUERY THESE
- `profiles` — DROPPED Feb 2026. Was replaced by `clients` + `user_roles`. Querying it will crash.
- `wallet_operations` — DROPPED Feb 2026. Was replaced by `ledger_entries`. Querying it will crash.

If you see code referencing `profiles` or `wallet_operations`, delete it — those tables do not exist.

## Write Patterns
- Wallet mutations: ALWAYS via SECURITY DEFINER RPC, NEVER direct INSERT/UPDATE on `wallets`
- Payments: use `SELECT FOR UPDATE` on wallet before deducting balance — prevents double-spend
- Admin disable: `is_admin()` must exclude `is_disabled = true` — revoked admins are blocked immediately

## Type Generation Gotchas
- `npx supabase gen types` has schema cache delay — new RPCs may not appear immediately after creation
- When changing an RPC return type (e.g. JSON → JSONB): must `DROP FUNCTION` before `CREATE OR REPLACE`
- TypeScript compilation can still pass if the client types have fallback overloads — always verify behavior
