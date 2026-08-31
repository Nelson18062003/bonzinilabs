# Security Rules

## Frontend Permission Guards
- Admin/user creation: requires `hasPermission('canManageUsers')` — prevents privilege escalation
- No `super_admin` bypass routes — was removed from `AgentCashRouteWrapper`
- File uploads: always use `validateUploadFile()` — validates MIME type AND enforces 10MB max

## Amount Validation (financial safety)
- Maximum: 50,000,000 XAF on all payment and deposit forms — hard cap
- Always verify `Number.isSafeInteger(amount)` before any financial calculation
- Applied in: `NewPaymentPage`, `NewDepositPage`

## Autorisation serveur — RÈGLE ABSOLUE (ne jamais garder une RPC avec `is_admin` seul)

`is_admin(uid)` ne teste **aucun rôle** : il renvoie vrai pour toute ligne
non désactivée de `user_roles`. Il signifie « membre du staff », pas
« autorisé ». Une RPC gardée par `is_admin()` est donc exécutable par
**tous** les rôles (cash_agent, treasurer, support…) via un appel direct à
PostgREST, même si l'UI cache le bouton.

**Toute RPC sensible doit être gardée par `admin_has_permission(uid, '<canX>')`** —
miroir SQL de `ROLE_PERMISSIONS` (`src/contexts/AdminAuthContext.tsx`), qui
filtre aussi `is_disabled`. Exemple :

```sql
IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
  RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
END IF;
```

Correspondances : dépôts → `canProcessDeposits` · paiements →
`canProcessPayments` · ajustements de portefeuille → `canAdjustWallets` ·
clients/admins → `canManageUsers` · taux → `canManageRates` · trésorerie →
`canManageTreasury`.

Si vous ajoutez un rôle ou une permission, mettez à jour **les deux**
matrices : le test `src/tests/security/rolePermissionParity.test.ts` échoue
en cas de dérive.

**Admin désactivé** : désactiver une ligne `user_roles` **ne révoque pas** le
JWT Supabase. Toute lecture de rôle doit donc filtrer
`(is_disabled = false OR is_disabled IS NULL)` — sinon un admin révoqué
garde ses pouvoirs tant que sa session vit. Ne relisez jamais le rôle « à la
main » : passez par `admin_has_permission()`.

## SQL / RPC Patterns
- Payments: use `SELECT FOR UPDATE` on the wallet row before any balance deduction — prevents double-spend race conditions
- **Verrouiller la ligne AVANT de la lire, dès qu'on la mute** (règle élargie
  après incident) : toute fonction qui lit un solde ou un statut *puis* écrit
  en fonction de ce qu'elle a lu doit faire `SELECT … FOR UPDATE`. Sans
  verrou, deux appels concurrents passent tous deux le contrôle (TOCTOU) :
  double remboursement (`process_payment`), double confirmation
  (`confirm_cash_payment`), ou solde faux (`create_wallet_adjustment`, qui
  écrivait une valeur **absolue** calculée sur une lecture périmée).
  Préférer aussi les écritures **relatives** (`balance_xaf = balance_xaf ± x`)
  aux écritures absolues.
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
