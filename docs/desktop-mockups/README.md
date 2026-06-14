# Desktop admin — design mockups

Static, self-contained mockups of the **dedicated desktop admin** (`src/desktop`),
used as the visual reference while migrating the mobile-only admin to a
desktop-optimised layout. They reproduce the Ofspace/Mola design kit
(`src/mobile/designKit`) — soft lilac canvas, white cards with a soft diffuse
shadow, neutral holders, dark pills, restrained colour — laid out for wide
screens (sidebar + full width + data tables).

## Files
- `home.html` — Tableau de bord (sidebar shell, KPI strip, priority queue,
  recent-activity table, rates / Mola / quick actions). Shipped as
  `src/desktop/screens/dashboard/DesktopDashboard.tsx`.
- `deposits.html` — Dépôts: the mobile card-list reimagined as a desktop data
  table (filters, columns, row actions, pagination). **Not yet implemented** —
  reference for the next migration step.
- `app.css`, `sprite.svg` — hand-written styles + inlined Lucide icon sprite so
  each page renders offline with no build step or CDN.
- `desktop-dashboard.png`, `desktop-deposits.png` — rendered previews.

Open the `.html` files directly in a browser to click around.
