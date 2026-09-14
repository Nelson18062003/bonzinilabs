#!/bin/bash
# SessionStart hook — Claude Code on the web only.
# Installs npm dependencies so type-check, lint, tests and build work in a fresh container.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Idempotent: npm install is a no-op when node_modules already matches the lockfile.
# Playwright's browser is pre-installed in the web container; never re-download it.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install --no-audit --no-fund
