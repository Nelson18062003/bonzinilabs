# Admin desktop redesign — Phase 3 note : Figma UI kit (Simple Design System)

File provided: `Simple Design System (Community)` —
`https://www.figma.com/design/pRtXYDpaW1ChfctcV2opTk/…` (personal access token
supplied privately; **never commit tokens to the repo**).

## What was verified via the REST API (2026-08-19)

- **Access: confirmed.** `GET /v1/files/:key?depth=1` succeeds with the token —
  the file is readable (30 pages, lastModified 2026-08-14).
- **Component inventory** (page list): Accordion, AI Chat, Avatars, Buttons,
  Calendar, Cards, Dialog, Inputs, Menu, Navigation, Notification, Pagination,
  Tabs, Tags, Text, Tooltip, Forms, Sections, Icons, Foundations, Utilities.
- **Published styles: zero.** The file exposes no style library; its tokens
  live as Figma *variables*.
- **Variables API: blocked.** `GET /v1/files/:key/variables/local` returns 403 —
  the token lacks the variables scope (Figma additionally gates that endpoint
  to Enterprise plans). Token values cannot be pulled programmatically.
- **Node-level extraction: rate-limited.** Repeated `GET /v1/files/:key/nodes`
  calls returned HTTP 429 across >30 minutes of exponential backoff; this
  community file's node reads have a high request cost against the personal
  token's quota. Retry later if pixel-level extraction is ever needed.

## Verdict for this redesign

1. **The decisive question is already answered by the inventory: the kit has
   NO data-dense components.** No data table, no filter bar, no master-detail
   panel, no dense form grid — exactly the gap anticipated. Pagination, Tabs,
   Buttons, Inputs, Dialog exist, but the components this admin lives on had
   to be designed from scratch regardless of API access.
2. **Primitives.** The Simple Design System's published documentation describes
   its baseline (Inter type, 8-pt-friendly spacing, single-radius language,
   neutral+brand color ramps). Our foundation (`02-foundation.md`) is aligned
   with those *principles* — fixed type scale, 4px grid, 3 radii — but derives
   its actual values from the codebase's existing Ofspace/Mola kit, which is
   the stronger constraint: brand continuity with the shipped mobile admin and
   client app. Adopting the kit's literal palette/type would have introduced a
   third visual language for zero operator benefit.
3. **Standing decision:** the Figma kit serves as a reference library for
   generic components (dialog anatomy, tab patterns, pagination) when
   implementing; the token contract of `02-foundation.md` remains the single
   source of truth.
