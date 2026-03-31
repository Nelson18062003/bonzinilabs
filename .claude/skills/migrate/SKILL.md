---
name: migrate
description: Push Supabase database migrations to the linked production project. Run after writing new SQL migrations.
disable-model-invocation: true
---

Push all pending Supabase migrations to the linked project:

1. Show what migrations will be applied:
   ```
   npx supabase db push --linked --dry-run
   ```

2. Ask the user to confirm before applying (this modifies the production database).

3. If confirmed, apply the migrations:
   ```
   npx supabase db push --linked
   ```

4. Report the result. If migrations succeed, remind the user to regenerate TypeScript types with `/gen-types` if the schema changed.

IMPORTANT: This modifies the production database. Always show the dry-run output first and confirm with the user before applying.
