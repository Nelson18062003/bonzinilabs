# Security Rules

## Frontend Permission Guards
- Admin/user creation: requires `hasPermission('canManageUsers')` — prevents privilege escalation
- No `super_admin` bypass routes — was removed from `AgentCashRouteWrapper`
- File uploads: always use `validateUploadFile()` — validates MIME type AND enforces 10MB max

## Amount Validation (financial safety)
- Maximum: 50,000,000 XAF on all payment and deposit forms — hard cap
- Always verify `Number.isSafeInteger(amount)` before any financial calculation
- Applied in: `NewPaymentPage`, `NewDepositPage`

## SQL / RPC Patterns
- Payments: use `SELECT FOR UPDATE` on the wallet row before any balance deduction — prevents double-spend race conditions
- Admin auth check: `is_admin()` RPC MUST exclude `is_disabled = true` — disabled admins must be blocked immediately
- Wallet mutations: SELECT-only RLS on `wallets` — all writes must go through SECURITY DEFINER RPCs

## OWASP Checklist (apply when writing new features)
When implementing new endpoints, mutations, or forms, check for:
- SQL injection — use parameterized queries, never string interpolation
- XSS — sanitize any user-provided content before rendering
- Command injection — never interpolate user input into shell commands or RPC calls
- Unauthorized access — always verify auth session + role before sensitive operations
- Mass assignment — never pass raw user input directly to database inserts

## Key Security Files
- `src/components/MobileCreateAdmin.tsx` — `hasPermission('canManageUsers')` guard
- `src/components/AgentCashRouteWrapper.tsx` — no super_admin bypass
- `src/lib/utils.ts` — `validateUploadFile()` function
- `src/pages/NewPaymentPage.tsx` — 50M XAF cap + isSafeInteger check
- `src/pages/NewDepositPage.tsx` — 50M XAF cap + isSafeInteger check
