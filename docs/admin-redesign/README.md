# Admin desktop redesign — Dépôts & Paiements first

Desktop-first rebuild of the admin UI, proven on the two daily modules and
designed as a **module archetype** every other module inherits.

## Documents
1. `01-audit.md` — verified audit of the current state (code-level evidence).
   Verdict: half-migrated mobile app; layout paradigm change, not a reskin.
2. `02-foundation.md` — **single source of truth**: desktop token contract
   (type/space/radius/elevation/controls/tables/keyboard) + the archetype
   (Workbench → Split detail → One-page create) + both instantiations.
3. `03-figma-kit.md` — what the provided Figma kit (Simple Design System)
   verifiably contains, and why the foundation derives from the codebase kit.

## Renderable mockups
Static components in `src/__screenshot__/adminRedesign/` (kit.tsx + deposits +
payments), registered in the screenshot harness. Capture:

```bash
npx vite --host &            # port 8080 (needs .env with dummy Supabase vars)
node tools/shoot-admin.mjs   # → shots/admin-redesign/*.png (1440×900 @2x, light+dark)
```

Screens: `dd-workbench` `dd-split` `dd-validate` `dd-create` ·
`dp-workbench` `dp-split` `dp-create`.

Rendered previews are committed under `docs/admin-redesign/mockups/`.

## Status
Mockup phase — no production screens changed yet. Implementation order when
approved: desktop kit tokens → deposits workbench+panel → deposit create →
payments (same archetype) → retire `MasterDetailLayout` + mobile wizards from
desktop routes.
