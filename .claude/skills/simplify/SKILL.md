---
name: simplify
description: Launch parallel subagents to review recently changed code for reuse opportunities, quality issues, dead code, and efficiency improvements. Boris Cherny's /simplify tip (P5#1).
---

Review the recently changed code for quality and simplification opportunities.

1. **Find recently changed files:**
   ```
   git diff --name-only HEAD~1
   ```
   If there are no recent commits, use `git status` to find modified files.

2. **Launch 3 parallel subagents** to review the changed files from different angles:

   - **Subagent A — Reuse & DRY**: "Review these files for duplication and reuse opportunities. Look for: repeated logic that could be extracted to a shared utility, components that already exist elsewhere in the codebase that should be imported instead of reimplemented, patterns that diverge from existing conventions in the project."

   - **Subagent B — Code Quality**: "Review these files for code quality issues. Look for: unnecessary complexity, overly long functions, unclear variable names, missing edge case handling, error states not covered."

   - **Subagent C — Performance & Security**: "Review these files for performance and security issues. Look for: unnecessary re-renders, missing memoization, N+1 query patterns, direct wallet mutations (must use SECURITY DEFINER RPCs), missing permission guards, amount validation without isSafeInteger check."

3. **Synthesize the findings** from all 3 subagents into a prioritized list:
   - Critical (must fix): security issues, functional bugs
   - Important (should fix): DRY violations, significant quality issues
   - Nice-to-have (optional): minor style improvements

4. Ask the user which issues to fix, then implement the approved fixes.

5. Run `/verify` after applying fixes.
