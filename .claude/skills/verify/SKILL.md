---
name: verify
description: Run TypeScript type-check and build to verify code correctness. Use after every coding session. Boris Cherny's tip #1 priority — giving Claude a way to verify its work 2-3x improves result quality.
---

Verify the code is correct by running the following checks in order:

1. Run TypeScript type-check:
   ```
   npm run type-check
   ```
   Report any type errors found. If there are errors, fix them before proceeding.

2. If type-check passes, run the full build:
   ```
   npm run build
   ```
   Report any build errors found. If there are errors, fix them before proceeding.

3. Report the result:
   - If both pass: "✓ Type-check passed. ✓ Build passed. Code is ready."
   - If either fails: list the errors and fix them automatically, then re-run to confirm the fix.

Do not mark any task as complete until both `npm run type-check` and `npm run build` pass with zero errors.
