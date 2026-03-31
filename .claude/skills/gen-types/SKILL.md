---
name: gen-types
description: Regenerate TypeScript types from the Supabase schema. Run after applying migrations or adding new RPC functions.
disable-model-invocation: true
---

Regenerate TypeScript types from the current Supabase schema:

1. Run the type generation command:
   ```
   npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
   ```

2. Check if the output file was updated:
   ```
   git diff src/integrations/supabase/types.ts
   ```

3. If the diff is empty, warn the user: Supabase has a schema cache delay. New RPC functions or tables may not appear immediately. Wait 1-2 minutes and try again.

4. If the diff shows changes, run type-check to confirm no type errors were introduced:
   ```
   npm run type-check
   ```

5. Report what changed (new tables, new RPCs, modified types).

IMPORTANT: If you just changed an RPC return type (e.g. JSON → JSONB), you must have run `DROP FUNCTION` before `CREATE OR REPLACE` in the migration — otherwise the old type signature will persist in the generated types.
