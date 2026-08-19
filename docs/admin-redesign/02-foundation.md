# Admin desktop redesign — Phase 2 : Foundation

**This document + `tokens` below are the single source of truth** for every admin
desktop module. Dépôts and Paiements are the proving instances; Clients,
Trésorerie, Support, Admins inherit the archetype without re-deciding anything.

Design stance, stated once: this is an **operations tool used all day at a
desk**. "Simple" = fast to scan, obvious hierarchy, few clicks, predictable
placement, keyboard-reachable. It does **not** mean whitespace-padded consumer
minimalism. Benchmarks: Linear, Stripe Dashboard, Retool — dense yet effortless.

## 0. Identity decision

**Keep the Ofspace/Mola brand language, re-derive its geometry for desktop.**
The existing kit (lilac canvas `#ECEAF7`, white cards with diffuse shadow, one
dark primary action, neutral holders, 5 semantic tones, DM Sans) is coherent,
already tokenized light+dark, and shared with mobile. The problem was never the
palette — it was *touch geometry* (44px pills, 22px radii, bottom-sheets) and
*absence of scale discipline*. So: same language, desktop grammar.
Confidence: high. Counter-argument: a harder visual break would signal "new
app" and mask legacy screens during migration — rejected because half the
estate (mobile, client app) keeps the language, and continuity beats novelty
for an internal tool.

## 1. Design tokens (desktop)

Implementation target: `src/desktop/designKit/tokens.ts` (mirror of the mobile
kit's structure). Values below are the contract; the mockups render them.

### 1.1 Color

Semantic roles reuse the mobile kit verbatim — one brand, two densities:

| Role | Light | Dark |
|---|---|---|
| canvas | `#ECEAF7` | `#141320` |
| surface (card/table/panel) | `#FFFFFF` | `#211F2B` |
| surface-2 (inset, hover, TH) | `#F6F5FB` | `#2A2836` |
| border hairline | `rgba(20,16,41,0.07)` | `rgba(255,255,255,0.07)` |
| text-strong | `#1B1A24` | `#F2F1F7` |
| text-body | `#4A475C` | `#C9C6D6` |
| text-muted | `#8E8BA0` | `#9B98AD` |
| primary action | `#1C1B22` (dark pill) | `#F2F1F7` |
| accent (links, focus, selection) | `#6B5BD2` | `#A99BF0` |
| tone·success | `#DEEFE5` / `#2E7D52` | `#1E3A2C` / `#7FCBA0` |
| tone·pending | `#F8EFD8` / `#9A6B12` | `#372D14` / `#E7C083` |
| tone·danger | `#FBE7E7` / `#C0504D` | `#3A2526` / `#E79A9A` |
| tone·info | `#EAE7FA` / `#5B4CC4` | `#272252` / `#B5AAF0` |

Module accents (existing, kept): deposits act on **emerald `#10B981`**, payments
on **violet `#8B5CF6`**; method brands Alipay `#1677FF`, WeChat `#07C160`,
cash `#E0322B`, Orange `#FF6600`, MTN `#FFCB05`, Wave `#1DC3E3`, bank `#1E3A5F`.
Color carries meaning only — figures stay neutral ink.

New (desktop needs it, mobile never did): **text-body** — a mid-grey between
strong and muted. Tables where every cell is either black-bold or pale-grey
(today's state) produce a checkerboard; body text carries the bulk of cells.

### 1.2 Typography

DM Sans (existing). Mono: `"JetBrains Mono", ui-monospace, monospace` for
references, IBAN, account numbers, IDs. **Numerals are `tabular-nums` by
default** in every table cell, figure and recap.

Fixed 8-step scale — **no other sizes exist**:

| Token | px/lh | Weight | Use |
|---|---|---|---|
| `micro` | 11/16 | 600, +0.06em, uppercase | column headers, section labels, filter group labels |
| `meta` | 12/16 | 400–500 | timestamps, hints, secondary cell lines |
| `body` | 13/20 | 400–500 | table cells, form values, default text |
| `emph` | 13/20 | 600 | cell emphasis (client name, amounts in rows) |
| `ui` | 14/20 | 500–600 | buttons, inputs, tabs, panel section titles |
| `title` | 16/22 | 700 | panel/dialog titles, card titles |
| `page` | 20/26 | 700 | page title (one per page) |
| `hero` | 28/32 | 800, tracking-tight | the one focal figure of a panel |

Today's 26px page titles + 38px hero on a phone panel shrink to 20/28: on
desktop the surface hierarchy does the work; oversized type is a phone habit.

### 1.3 Space, radius, elevation, controls

- **Grid 4px.** Component padding: 8 / 12 / 16. Section gaps: 16 / 24. Page
  gutter: 32 (existing `px-8`).
- **Radius**: `r-sm 6` (chips, tags, small controls) · `r-md 10` (buttons,
  inputs, table container inner) · `r-lg 14` (cards, panels, dialogs).
  Full-round is reserved for status pills, avatars, dots. The 22–28px radii are
  retired on desktop.
- **Elevation**: `e-card` = `0 1px 2px rgba(46,32,92,.05), 0 8px 24px -16px
  rgba(46,32,92,.18)` · `e-pop` (menus, dialogs) = `0 4px 12px rgba(46,32,92,.08),
  0 24px 48px -24px rgba(46,32,92,.28)`. Dark mode replaces shadows with
  `ring-1 white/[0.06]` (existing convention, kept).
- **Controls**: heights `28` (compact/inline), `32` (default: inputs, selects,
  buttons, filter controls), `36` (primary CTA only). Input text 13–14px — the
  16px iOS-zoom rule does not apply to desktop. Focus: 2px accent ring.
  `active:scale` press effects are dropped on desktop; hover states do the work.
- **Tables**: header row 36px, `micro` labels on `surface-2`, sticky. Data row
  **40px** (dense-comfortable; Stripe ≈ 40, Linear ≈ 36), hairline dividers,
  hover `surface-2`, selected = accent-tinted `#EDEAFA`/40 + 2px accent inset
  left edge. Numeric columns right-aligned. Pagination footer, never infinite
  scroll.

### 1.4 Interaction & keyboard (spec — implemented with the modules)

- `⌘K` global search (exists as UI; bind it). `n` new record on a workbench.
- Table: `↑/↓` or `J/K` move row focus, `Enter`/click opens split panel,
  `Esc` closes it, `←/→` page.
- Deposit panel: `V` opens Valider dialog, `R` Rejeter. Payment panel: same for
  its status-legal actions. All dialogs: `Esc` cancel, `⌘Enter` confirm.
- Every dialog is a **centered anchored modal** (`e-pop`, max-w 480) — the
  BottomSheet is a mobile-only component from here on.

## 2. The module archetype

Every module = three surfaces. Nothing else is invented per module.

### A. Workbench (list)

```
┌ Page header ──────────────────────────────────────────────┐
│ Title + total/actionable counts        [secondary…] [+ CTA]│
├ Queue strip (optional, actionable buckets only) ──────────┤
│ [À traiter n][À corriger n]…  ← filters, single row, small │
├ Filter bar (ONE row, 32px controls) ──────────────────────┤
│ [Search (server-side)………] [Statut ▾][Méthode ▾][Période ▾] │
├ Table (sortable headers, SLA age col, pagination) ────────┤
└───────────────────────────────────────────────────────────┘
```

Rules: one CTA per page (dark). Search hits the **query**, not loaded pages.
Stat tiles and chip rows are merged into ONE compact queue strip — buckets are
filters, shown once, with counts; "Validés/Rejetés" are dropdown values, not
permanent chrome. Age is a real column (absolute date + relative, SLA-tinted).
Default view = "À traiter", sorted **oldest first** — the queue discipline the
SLA dots always implied. Row hover exposes the 1–2 status-legal quick actions.

### B. Split detail

Selecting a row opens a **detail panel: 42% of the frame, min 560px**, list
stays live (widest columns collapse). The panel is a desktop surface, not a
phone screen:

```
┌ Panel header (pinned) ───────────────────────────┐
│ REF · status pill · SLA        [actions] [⋯] [×] │
├ Verdict zone (the decision's evidence, LARGE) ───┤
│ deposits: proof gallery + declared vs confirmed  │
│ payments: beneficiary coordinates (copy-perfect) │
├ Facts grid (2-col label/value, no scroll games) ─┤
├ Timeline (inline, open — not collapsed) ─────────┤
└──────────────────────────────────────────────────┘
```

Primary + destructive actions live **in the pinned header**, always reachable.
Confirmations are centered modals. Full-page route stays available (deep links,
mobile), rendered as the same panel at page width.

### C. Create — one page, no wizard

Full-page form, `max-w 1080`, two zones:

- **Left (main, ~640px)**: all decisions, grouped in labeled sections, fields in
  a 2-column grid where independent (client+amount side by side). Everything
  visible at once; validation inline at the field.
- **Right rail (~360px, sticky)**: live recap + context — wallet balance, rate
  math, and for deposits the **payment coordinates** (RIB/merchant code) that
  the admin reads out to the client, updating as method changes.
- Footer: one primary CTA + cancel. `⌘Enter` submits.

The mobile wizards remain the **mobile** implementation of the same logic; the
desktop route stops borrowing them.

## 3. Instantiation — Dépôts

- **Table columns**: Référence (mono, paperclip+count) · Client (name, phone
  meta) · Montant XAF (right, emph) · Méthode (16px brand square + short label)
  · Créé (absolute dd MMM HH:mm + SLA-tinted relative) · Statut (pill) ·
  hover-actions (Valider / Rejeter when status allows).
- **Queue strip**: À traiter (default) · À corriger · Tous · Validés/Rejetés in
  the Statut dropdown.
- **Panel verdict zone**: declared amount vs **confirmed-amount input inline**
  (the #1 task is "does the proof match the number") next to a large proof
  viewer (fit-width, click = lightbox with zoom, keyboard ←/→ across proofs);
  wallet balance + projected balance under the amount. Valider (emerald) /
  Rejeter in the pinned header.
- **Create sections**: 1 Client & montant (searchable client select showing
  balance; amount with live formatting + presets) · 2 Méthode (segmented family
  row + conditional bank/agency select — no extra "steps") · 3 Preuves & note
  (paste/drop zone) · rail: coordinates card + instructions + recap.

## 4. Instantiation — Paiements

- **Table columns**: Référence · Client · **Bénéficiaire** (name + method logo
  16px, identifier meta) · Montant (¥ emph over XAF meta, right) · Taux (meta,
  `perso.` tag when custom) · Créé (absolute + SLA relative) · Statut · hover
  quick action (Passer en cours / Valider by status).
- **Queue strip**: À traiter (`ready_for_payment`+`cash_scanned`, default) ·
  Info manquante (`waiting_beneficiary_info` — its own bucket; it's blocked
  work, not process-work) · En cours · Tous.
- **Panel verdict zone**: beneficiary coordinates as copy-rows (mono, one-click
  copy, method-brand accent, QR inline) — because the operator's task is
  char-perfect transcription into Alipay/WeChat/bank portals; then proofs
  (client's + admin's payment proof slot), then facts grid (both amounts, rate,
  dates, batch link), open timeline.
- **Create**: left = Client & montant (client select w/ balance, ¥⇄XAF dual
  input with live conversion, custom-rate toggle, backdate) · right column of
  main = Destination (method segmented; carnet list w/ search OR new-beneficiary
  fields; QR paste; save-to-carnet; "remplir plus tard") · rail: live recap
  (both amounts, rate, balance after debit, warnings).

## 5. Migration notes

- Tokens land as `src/desktop/designKit/` (own kit; imports mobile tone values
  from one shared palette module so the two never drift).
- Screens keep their hooks — this is a presentation swap: same
  `usePaginatedAdminDeposits/Payments`, same mutations. Server-side search is
  the one data-layer change (extend `DepositFilters`/`PaymentFilters` with
  `search`).
- `MasterDetailLayout` is replaced by the archetype's split panel; mobile
  fiches stop being mounted on desktop routes.
- Known doc bug: `CLAUDE.md` references a `/frontend-design` skill that does
  not exist in `.claude/skills/`.
