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

## Update 2026-08-19 (later) — full token extraction achieved

The file is the user's own copy (`role: owner`, renamed intent "Bonzinilabs
V2"). Both personal tokens hit the same wall: `file_variables:read` absent
from the token scopes (and Enterprise-gated), and the cost-based REST quota
of the plan rejects any node-level read of this 30-page file (persistent 429
even at depth 2, across hours and two tokens).

**Workaround that worked:** the Simple Design System is Figma's open-source
kit — its tokens live in code in the public `figma/sds` repository
(`scripts/tokens/tokens.json`, 337 tokens; `src/theme.css`). Extracted values:

| Group | Values |
|---|---|
| Type families | Inter / Noto Serif / Roboto Mono |
| Type scale | 12 · 14 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 72 |
| Type roles | body 14/16/20 · subheading 16/20/24 · heading 20/24/32 · title-page 40/48/64 |
| Space | 0 · 2 · 4 · 6 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 160 (4-px grid) |
| Radius | 4 · 8 · 16 · full |
| Stroke | border **1px** · focus ring **2px** |
| Colors | neutral ramps only — the "brand" ramp is literally greys `#f5f5f5→#111111`; semantic layers background/text/border/icon × default/brand/neutral/positive/warning/danger |
| Effects | drop-shadows 100–500 (declared, **not adopted** — shadows are banned app-wide) |

## Reconciliation (final)

- **What SDS validates in our foundation:** the 4-px spacing grid; role-based
  type tokens; the primitive → semantic two-layer token architecture; **1px
  borders + 2px focus ring** — exactly the flat, ring-delineated language the
  founder mandated when removing shadows.
- **What SDS cannot provide, by design:** brand. Its "brand" color ramp is a
  greyscale placeholder meant to be swapped — Bonzini's existing palette
  (lilac canvas, white surfaces, tone pills, module accents) *is* that swap,
  already shipped. Adopting SDS colors would un-brand the product.
- **Typography:** Inter is SDS's placeholder; DM Sans stays (brand-wide).
  SDS's role sizes (body 16) are a consumer/marketing scale; the ops-density
  scale in `02-foundation.md` stays.
- **Components:** still no data table, filter bar, or master-detail anywhere
  in the kit — the archetype remains our own design, per the audit.

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
