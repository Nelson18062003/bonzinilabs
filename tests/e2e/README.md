# End-to-end tests

These tests run in a real browser (WebKit, i.e. mobile Safari's engine)
to catch UI bugs that unit tests cannot — primarily, the iOS Safari
**auto-zoom on focus** bug that happens when a form control has a
computed font-size < 16 px.

## Running locally

```bash
# One-time: install the WebKit browser Playwright uses.
# (Requires `sudo` on Linux because of system libs.)
npx playwright install webkit --with-deps

# Run all e2e tests. Starts the Vite dev server automatically.
npm run test:e2e

# Debug in the UI runner.
npm run test:e2e:ui
```

## Running in CI

GitHub Actions' `ubuntu-latest` runner ships with the libraries WebKit
needs. Add a workflow like:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci
- run: npx playwright install webkit --with-deps
- run: npm run test:e2e
```

## What is covered

`ios-input-font-size.spec.ts` visits every screen with form controls and
asserts that every `<input>` / `<textarea>` / `<select>` has a computed
font-size ≥ 16 px, both at rest and after focus. If any control drops
below, the test fails with the offending selector and actual size so
you can fix it in one jump.

Screens covered:

- `/` (landing)
- `/auth` (client login)
- `/m/login` (mobile admin login)
- `/a/login` (agent cash login)
- `/dev/form-showcase` (dev-only — every design-system primitive)

Device matrix: iPhone 14 and iPad Pro 11 (both WebKit). The iPad row
guards against shadcn's `sm:text-sm` breakpoint regression — text-sm
kicks in at 640 px viewport width, so iPad portrait inputs can slip
below 16 px if a future change reintroduces the default.

## Why this test matters

iOS Safari auto-zooms on inputs with font-size < 16 px and does NOT
zoom back out on blur. This silently breaks the layout for every iOS
user and is the #1 most frequently recurring mobile-web bug. The ESLint
rules at `eslint.config.js` steer contributors toward the primitives at
`src/components/form/*`, but lint rules can be bypassed. This e2e test
is the last line of defence.
