---
name: fix-issue
description: Fix a GitHub issue end-to-end. Reads the issue, finds the relevant files, implements the fix, verifies it, commits, and opens a PR.
---

Fix GitHub issue number: $ARGUMENTS

Follow these steps:

1. **Read the issue:**
   ```
   gh issue view $ARGUMENTS
   ```
   Understand the problem, the expected behavior, and any context provided.

2. **Explore the codebase:**
   Search for the relevant files using Grep and Glob. Reference existing patterns — do not create new abstractions if existing ones can be reused.
   Remember the critical rules:
   - Admin context: use `supabaseAdmin`, not `supabase`
   - Never query `profiles` or `wallet_operations` — they are dropped
   - Financial mutations go through SECURITY DEFINER RPCs

3. **Use a subagent to review the plan:**
   Before implementing, describe the fix approach and use a subagent to check for edge cases:
   "Use a subagent to review my plan for fixing issue #$ARGUMENTS: [describe plan]"

4. **Implement the fix** in the relevant files.

5. **Verify the fix:**
   Run `npm run type-check` and `npm run build`. Fix any errors before proceeding.

6. **Commit with a descriptive message:**
   ```
   git add <changed files>
   git commit -m "fix(<scope>): <description>\n\nFixes #$ARGUMENTS"
   ```

7. **Push and open a PR:**
   ```
   git push
   gh pr create --title "fix: <description>" --body "Fixes #$ARGUMENTS\n\n## Changes\n- <list changes>"
   ```

8. Report the PR URL.
