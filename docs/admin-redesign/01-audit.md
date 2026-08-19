# Admin desktop redesign — Phase 1 : Audit

**Scope.** The two daily-use admin modules — Dépôts and Paiements — on laptop/desktop,
plus the shell they live in. Everything below is verified against the code on this
branch (file:line references included). This document is the factual basis for the
foundation (`02-foundation.md`) and the module archetype.

---

## 1. Verdict on the "mobile-first paradigm mismatch" diagnosis

**The diagnosis is correct but incomplete.** The app is not "mobile-first CSS scaled
up" — it is architecturally a *mobile app with a desktop costume*. A first desktop
migration pass (2026, `docs/desktop-mockups/`) built a real sidebar shell and
converted the two *list* screens to tables. It stopped there. The result is a
**half-migrated hybrid**, which is in some ways worse than a purely mobile app,
because it *looks* like a desktop tool while three of the four screens an operator
touches on every single transaction are still verbatim mobile screens:

| Surface | State on desktop today | Evidence |
|---|---|---|
| Deposits list | Real `<table>`, desktop-built | `src/desktop/screens/deposits/DesktopDepositsScreen.tsx` |
| Payments list | Real `<table>`, desktop-built | `src/desktop/screens/payments/DesktopPaymentsScreen.tsx` |
| Deposit detail | **Mobile fiche** (`MobileDepositDetailV2`) squeezed into a 460px sticky aside | `MasterDetailLayout.tsx:25` — `w-[min(460px,40vw)]` |
| Payment detail | **Mobile fiche** (`MobilePaymentDetailV2`, 1 572 lines) in the same 460px aside | `DesktopPaymentsScreen.tsx:152` |
| New deposit | **Mobile wizard**, 7 sequential steps, one column. The router passes `desktop` (`App.tsx:208`) but the component **declares no props — the flag is silently ignored** | `MobileNewDeposit.tsx:70`, `:975` (`h-screen`) |
| New payment | **Mobile wizard**, 5 steps, rendered as a **phone-sized card** (`max-w-xl`) floating in the middle of the screen | `MobileNewPayment.tsx:470` |

So the reported pains map 1:1 to architecture, not taste:

1. **"Detail panel feels cramped/squeezed"** — it literally is a phone screen
   (mobile canvas, mobile sticky header, mobile bottom-sheets) rendered at 460px
   inside an aside. Bottom-sheets (`BottomSheet`, `designKit/components.tsx:406`)
   animate up from the **bottom of the browser window**, full-width, covering the
   list you were scanning — a pure phone gesture pattern on a 1440px screen.
2. **"Create form is painful"** — the deposit wizard forces 7 client-side steps
   (client → amount → family → sub-method → bank/agency → recap → creating) for a
   task an operator performs many times a day. Every step is a full-screen
   transition. On desktop all of it fits on one screen with room to spare. The
   payment wizard is 5 steps in a 576px card. Step wizards are a *mobile coping
   strategy for small viewports*, not a desktop workflow. For a repeated operator
   task they impose ~6 extra clicks + 6 animated transitions per transaction and
   make the recap the only place where all inputs are visible at once (error
   discovery arrives at the end instead of during entry).
3. **"Table columns badly organized"** — partially fixed by the first pass, but
   the tables have real defects (see §3).
4. **"Too much useless information"** — mostly wrong framing. The real problem is
   **no committed hierarchy**: primary/secondary/on-demand was never decided, so
   screens compensate by hiding (collapsed "Suivi" timeline behind a click,
   `MobileDepositDetailV2.tsx:691`) or by piling cards vertically. Density is
   *too low*, not too high — a 24″ screen shows 8 deposit rows with a giant stat
   strip above.

**Conclusion: layout paradigm change confirmed. Not a reskin.** The good news:
the data layer (hooks, filters, pagination, permissions) is solid and shared —
the redesign is a *presentation* rebuild, the logic can be kept.

---

## 2. What exists and is worth keeping

- **A real token layer exists** — `src/mobile/designKit/tokens.ts` ("Ofspace/Mola"
  language): soft lilac canvas `#ECEAF7`, white cards + diffuse shadow, neutral
  holders, one dark primary pill, 5 semantic tones (success/pending/danger/info/
  neutral) with light+dark values. It is coherent and already applied across the
  admin. **The brand language is not the problem.** It was, however, designed for
  phone cards, and its geometry (radius 22–28px, pill-everything, 16px inputs,
  py-[13px] buttons) is *touch* geometry.
- **Shell**: fixed 256px sidebar + sticky topbar + `max-w-[1400px]` frame
  (`DesktopAppShell.tsx`), permission-gated nav model (`desktopNav.ts`),
  actionable-count badges, global search, notifications menu. Keep, with density
  corrections.
- **Operational intelligence already computed but under-used**: SLA level per row
  (deposits: fresh <2h / aging 2–8h / overdue >8h, `depositTimeline.ts:244`;
  payments: <4h / 4–12h / >12h, `paymentSla.ts:9`), status buckets with
  server-side counts (`useDepositStats` RPC, `usePaymentStats` count queries),
  proof counts, actionable counts.
  These are the makings of a real *work queue*; today they render as a 6px dot.
- **Screenshot harness** (`screenshot.html` + `tools/shoot.mjs`): dev-only
  Playwright rig that renders any screen with fixture-intercepted network and
  captures light/dark PNGs. The project's established way to validate design
  before implementation — this redesign uses it for its mockups.

---

## 3. Detailed findings — Deposits module

### 3.1 List (`DesktopDepositsScreen`)

Structure today: title header → 4 clickable stat tiles → search + 5 status chips
→ method chip row + period chip row → table (6 columns) → infinite scroll.

Defects, ranked:

1. **The table is a list wearing a table costume.** No sortable headers (sort is
   hardcoded `created_at desc`, `DesktopDepositsScreen.tsx:136`), no column
   width discipline, no row actions — the row's only affordance is "navigate".
   The one decision an operator makes from the list (validate/reject) always
   costs a click into the detail.
2. **Two rows of pill-chips as filter UI** (status ×5, method ×6, period ×6 +
   custom range) consume ~110px of vertical space, permanently, for choices that
   are made a few times a day. Linear/Stripe solve this with a compact filter
   bar + dropdowns.
3. **Stat tiles duplicate the status chips** — same four buckets, same counts,
   both clickable, two different visual languages for the same action, ~120px
   tall. One of the two must die.
4. **Client-side search on top of server-side pagination**
   (`DesktopDepositsScreen.tsx:147-165`): search filters only *loaded pages*, so
   "search all deposits" silently lies — a correctness bug the redesign must not
   reproduce (search must go to the query).
5. **Method column wastes its pixels**: a 28px colored monogram + short label to
   convey one of 5 families; amount column right-aligned but reference gets a
   heavy "holder" background making the least-actionable column the loudest.
6. **SLA is invisible**: 6px dot at the far right, inside the status cell. For a
   queue whose whole job is "process before it goes stale", age should be a
   first-class sortable column.
7. **Infinite scroll on an ops table** — no page numbers, no "n of N", no
   keyboard paging; position is lost on navigation. The prior mockup
   (`docs/desktop-mockups/deposits.html`) correctly used pagination; the
   implementation regressed to the mobile pattern. (Server pagination exists:
   offset-range pages of 20, `usePaginatedDeposits.ts:6` — only the UI is
   infinite.)
8. **Method family filter is client-side for deposits** (`FAMILY_TO_METHODS`
   post-filter on loaded pages) while payments' method filter is server-side —
   same UI, two different truths.
9. Row height ~46px with `text-[13px]` names: acceptable; but date shown as
   relative only ("il y a 3 h") — an ops tool needs the absolute timestamp
   without a hover.

### 3.2 Detail (`MobileDepositDetailV2` in the 460px aside)

- Vertical card pile: sub-header pills → hero amount card (centered, 38px
  figure) → proofs card (16:9 previews stacked) → info card (6 label/value rows)
  → actions (3 stacked full-width pill buttons) → collapsed timeline card.
  Total height ≈ 2.5 panel-heights: **everything requires scrolling inside a
  scrolling aside**, the classic nested-scroll misery.
- **Actions live at the bottom of the pile** — the operator's decision
  (Valider/Rejeter) is the *last* thing reachable, below the proofs they need to
  inspect. On a fiche whose job is a verdict, the verdict UI must be persistent
  (header or pinned bar), not item 5 of 6.
- All confirmations are **bottom-sheets sliding from the browser bottom** with a
  drag handle (a touch affordance), focus-trapped, body-scroll-locked. On
  desktop these must become anchored dialogs/popovers local to the panel.
- **Proof inspection is the core sub-task** (compare screenshot amount vs
  declared amount) and gets a 420px-wide 16:9 thumbnail with 4 tiny 10px-font
  buttons under it. The full-screen viewer is a black overlay without zoom.
  Meanwhile ~40% of the screen (the list) sits idle to the left. The layout
  starves the exact pixels the task needs.
- Wallet balance and "montant confirmé ≠ déclaré" logic exist and are good —
  they're just buried mid-card.
- Info rows truncate at `max-w-[60vw]` (`:636`) — a *viewport* unit inside a
  460px panel: mobile code that was never re-read on desktop.

### 3.3 Create (`MobileNewDeposit`)

- 7 steps; the *entire viewport* is replaced per step; progress bar shows 3
  coarse phases. Recap step contains fields+instructions+proofs+comment+CTA in
  one long column — i.e., the wizard ends in a scrolling form anyway.
- The dead `desktop` prop (`App.tsx:208` passes it; component signature takes
  nothing) means the desktop render is the *unmodified phone flow* stretched into
  `mx-auto max-w-2xl` by the shell fallback (`AdminRouteWrapper.tsx:38`).
- Uses the **old pre-kit styling** (`method-card`, `btn-primary-gradient`,
  `bg-secondary`) — visually a *third* language, neither kit nor desktop.
  MobileNewDepositV2 (kit-styled) exists but is not routed for admin desktop.
- Client picker loads **all clients** (`useAllClients`) and slices 20 — fine at
  today's volume, but the pattern (no server search) caps scale.
- Deposit creation needs, in total: client, amount, method (+bank|agency),
  optional proofs, optional note. **Five decisions.** That is one screen on
  desktop, two columns, with the payment-coordinates panel (RIB/merchant-code
  instructions to give the client) shown alongside — not a 7-screen journey.

## 4. Detailed findings — Payments module

### 4.1 List (`DesktopPaymentsScreen`)

Same skeleton as deposits, same defects (chips ×2 rows + stat strip, client-side
search over paged data, no sortable headers, infinite scroll), plus:

- **Amount column shows ¥ only** (`formatCurrencyRMB(payment.amount_rmb)`).
  The operator debits wallets in XAF; both legs matter, and the exchange rate
  even more (custom-rate payments are flagged in data, invisible in UI).
- **Beneficiary is absent from the table.** "Who receives this ¥12,400 via
  Alipay" is the single most identifying attribute of a payment and it is not a
  column; the operator must open each row to know.
- 3 header actions (Export PDF, Paiement groupé, Nouveau) — correct instinct
  (batch workflows exist) but visually equal-weight pills.
- `waiting_beneficiary_info` payments — the ones *blocked* on data — have no
  distinct presence; they melt into "à traiter".

### 4.2 Detail (`MobilePaymentDetailV2` in the aside)

The richest screen in the app (1 572 lines): hero ¥ card, cash-QR flow,
beneficiary card with copy-rows + QR viewer + inline edit, client/admin proofs,
timeline, validate/reject/complete drawers, PDF receipt. All of it works — and
all of it stacks into one 460px column where **beneficiary coordinates (the
thing the operator must copy into Alipay/WeChat/bank portals, char-perfect) and
payment proofs (the thing they must verify) can never be on screen at the same
time as the action buttons.**

Highlights to preserve: `CopyRow` tap-to-copy pattern, method brand accents
(Alipay `#1677FF` / WeChat `#07C160` / cash `#E0322B`), the status-dependent
action model (`canStartProcessing`/`canComplete` gates, `:615-617`), missing-
beneficiary and missing-proof warnings.

### 4.3 Create (`MobileNewPayment`)

5 steps in a phone-card. Contains genuinely good domain UX — XAF⇄¥ dual-currency
entry with live conversion, custom rate toggle, backdated operation date, client
carnet (saved beneficiaries) vs new + save-to-carnet, QR paste-zone, "remplir
plus tard" — all of which survives, laid out as **one two-column desktop form**:
left = the money (client, balance, amount, rate, date), right = the destination
(method, beneficiary), with a live recap rail replacing step 5.

---

## 5. Shell & foundation findings

- **Breakpoint**: `useIsDesktop` gates at `lg` (1024px). Fine.
- **Typography**: DM Sans everywhere (`index.css:177`), tabular-nums applied ad
  hoc via arbitrary classes. **There is no type scale** — 24 distinct arbitrary
  `text-[Npx]` values across the two modules (9,10,10.5,11,12,13,13.5,14,15,16,
  17,20,22,24,26,30,38,40…). Same for spacing and radius: every value is a
  local improvisation. This is the root cause of "assembled ad hoc" feel:
  *nothing repeats exactly*.
- **Touch geometry on desktop**: 44–48px controls, `active:scale-95` press
  animations (meaningless with a mouse; `transition active:scale` everywhere),
  `text-[16px]` inputs (an iOS-zoom workaround, oversized on desktop), full
  rounded pills for every button.
- **No keyboard layer**: zero shortcuts, no roving focus in tables (rows are
  focusable but only Enter/Space navigate), dialogs are bottom-sheets. For a
  daily tool, J/K row navigation + V(alider)/R(ejeter) + ⌘K palette is where
  operator speed actually comes from (the global search exists and is even
  bound to a button, but not to the keyboard).
- **Dark mode** is fully tokenized and must remain first-class.
- **i18n**: all admin desktop strings are hardcoded French (the i18n layer exists
  for the client app). Redesign keeps French copy — not a regression, but noted.

---

## 6. Domain model (verified against hooks/types/migrations)

### Deposit
- Statuses (`src/types/deposit.ts:17`): `created → awaiting_proof →
  proof_submitted → admin_review → validated | rejected` (+`cancelled`,
  `cancelled_by_admin`, legacy `pending_correction`). Bucket:
  TO_PROCESS = `proof_submitted` + `admin_review` (`src/lib/depositsList.ts:39`).
- Key fields: `reference` (`BZ-DP-YYYY-NNNN`, atomic generator), `amount_xaf`, `confirmed_amount_xaf`,
  `method` (8 values in 5 families: bank_transfer, bank_cash, agency_cash,
  om_transfer, om_withdrawal, mtn_transfer, mtn_withdrawal, wave), `bank_name`,
  `agency_name`, `admin_comment`, proofs[] (client/admin), timeline events,
  `validated_at/by`, profiles join (client name/phone/company).
- Admin actions (all SECURITY DEFINER RPCs): start review, validate (with
  optional corrected amount → credits wallet), reject (category + client
  message + internal note), upload/delete/replace proof (reasoned), cancel
  (super admin), PDF receipt.
- Permissions: `canViewDeposits`, `canProcessDeposits`.

### Payment
- Statuses (`src/types/payment.ts`): `created → waiting_beneficiary_info →
  ready_for_payment → processing → completed | rejected` (+
  `cancelled_by_admin`); cash branch: `cash_pending → cash_scanned` (agent
  scan + signature). Bucket: TO_PROCESS = `ready_for_payment` +
  `cash_scanned` (`src/types/payment.ts:78`).
- Key fields: `reference` (`BZ-PY-YYYY-NNNN`), `amount_xaf`, `amount_rmb`,
  `exchange_rate` (int ¥/1M XAF; legacy decimal handled), `rate_is_custom`,
  `method` (alipay | wechat | bank_transfer | cash), beneficiary_* snapshot
  (name, identifier, phone, email, bank_name/account/extra, qr_code_url,
  notes), `desired_date`, batch_id (bulk), proofs (client + admin "payment
  proof"), timeline.
- Admin actions: edit beneficiary (pre-processing), start processing, complete
  (with admin proof), reject, delete (super admin), PDF receipt, batch PDF
  export of pending payments.
- Permissions: `canViewPayments`, `canProcessPayments`.
- Wallet debit at creation (RPC with `SELECT FOR UPDATE`); balance context
  matters on every payment surface. Reject/cancel refund the wallet.
- Known logic mismatches to respect (not "fix by design"): the payment detail
  UI offers "Passer en cours" from `cash_scanned` but the `process_payment` RPC
  only accepts `ready_for_payment`; and the deposit detail screen gates actions
  on status only — `canProcessDeposits` is never checked there (permission gap;
  DB-side only `is_admin()` is enforced). The redesign surfaces actions through
  one status×permission matrix so both bugs become impossible to reintroduce
  silently.

*(Exact strings/labels: `src/types/deposit.ts`, `src/types/payment.ts`,
`src/lib/depositsList.ts`, `src/lib/paymentsList.ts`.)*

---

## 7. What the redesign must deliver (requirements extracted from this audit)

1. **A module archetype**, not two pretty modules:
   `Workbench (table + filters + queue intelligence) → Split detail (list stays
   live) → Full-page create (single screen, grouped columns)` — instantiated for
   Dépôts and Paiements, inheritable by Clients/Trésorerie/etc.
2. **Detail as a first-class desktop panel** (~40% width at 1440, resizable
   concept later): action bar pinned at top, content in tabs or zones
   (Vérification / Infos / Historique), proofs displayed large, dialogs anchored
   — no bottom-sheets.
3. **Create as a one-screen form**: all five deposit decisions visible at once;
   payment form two-column with live recap; wizard reserved for mobile.
4. **A real token scale** (type 11/12/13/14/16/20/28 + tabular numerals as
   default for figures, 4px spacing grid, 3 radii, 2 shadows, compact control
   heights 28/32/36) — desktop-first, derived from the existing kit's language
   so mobile keeps speaking it.
5. **Queue intelligence surfaced**: age column with SLA coloring, default sort
   = oldest actionable first for the "À traiter" bucket, sortable headers,
   server-side search, pagination with counts.
6. **Keyboard layer** (spec'd in foundation; implementation later): ⌘K, J/K,
   Enter, V/R, Esc.
7. **Both currencies + rate on every payment surface**; beneficiary column in
   the payments table.
8. Light + dark from day one, driven by tokens.
