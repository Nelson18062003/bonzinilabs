/**
 * DESKTOP design tokens — the visual language of the admin console on PC.
 *
 * Why a second token file next to `@/mobile/designKit`?
 * The mobile kit is tuned for a thumb on a 390px screen: a tinted lavender
 * canvas, 22px radii, big soft shadows, full pills. Stretched to 1440px it
 * reads as a toy and wastes ~40% of the vertical space an operator needs to
 * see a queue. This layer keeps the *meaning* shared — status tones, role
 * meta and method colours are still imported from the mobile kit, so a
 * "validé" deposit is the same green everywhere — and only redefines the
 * *physics*: quieter canvas, hairlines instead of shadows, tighter radii,
 * a compact type scale and a real density scale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DIMENSIONAL CONTRACT (read this before adding a class)
 *
 * Every measurement in `src/desktop` comes from one of the four ladders
 * below. Nothing else is allowed, and `tests/e2e/desktop-metrology.spec.ts`
 * measures the rendered page to prove it:
 *
 *   · control height → 24 | 28 | 32          (STEP / CONTROL)
 *   · font size      → 12 | 13 | 15 | 20 | 28       (SIZE / DT)
 *   · spacing        → multiples of 4        (SPACE)
 *   · radius         → 4 | 6 | 8 | 12 | full (RADIUS)
 *
 * Two of those ladders have an external floor, not just an internal one:
 *
 *   · **No text below 12px, and 12px only at weight ≥ 600.** The APCA
 *     readability criterion (WCAG 3 draft) disallows 12px and 14px at weight
 *     400 *at any contrast* — no colour choice rescues them. The console's
 *     first pass used 10px, 10.5px and 11px for column headers, units and
 *     badge text: content an operator actually has to read, below the floor.
 *     Dropping those steps is what took the scale from seventeen sizes to five.
 *   · **≥ 24px between the centres of adjacent targets** (WCAG 2.2 SC 2.5.8,
 *     "spacing" exception). A 24px control needs 0 gap, a 28px control has
 *     slack. This is the hard ceiling on toolbar density — no arrangement
 *     beats one target per 24px of axis.
 *
 * The first pass of this console shipped seventeen distinct font sizes and
 * six control heights, which is why a 32px search input sat next to a 28px
 * filter chip on the same toolbar row. A component must therefore never
 * write `h-…`, `text-[…px]`, `px-…` or `rounded-…` on a control by hand:
 * it asks `CONTROL[size]` for the whole set — height, padding, radius, font
 * size, icon size, internal gap — so the six values can never disagree.
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ── Surfaces ────────────────────────────────────────────────────────── */

export const DS = {
  /** App background — the desk the panels sit on. */
  canvas: 'bg-[#F4F4F8] dark:bg-[#0E0D14]',
  /** Chrome: sidebar, topbar, sticky toolbars. */
  panel: 'bg-white dark:bg-[#15141C]',
  /** Content card. */
  card: 'bg-white dark:bg-[#15141C]',
  /** Recessed area inside a card (code blocks, previews, empty wells). */
  well: 'bg-[#F7F7FA] dark:bg-[#101018]',
  /** The 1px separator that replaces shadows. */
  line: 'border-[#1C1836]/[0.09] dark:border-white/[0.08]',
  /** Hover wash for rows and ghost buttons. */
  hover: 'hover:bg-[#1C1836]/[0.035] dark:hover:bg-white/[0.045]',
  /** Persistent selection wash (selected row, active detail). */
  selected: 'bg-[#6B5BD2]/[0.08] dark:bg-[#A99BF0]/[0.12]',
  /** Neutral round holder for icons/initials. */
  holder: 'bg-[#EEEDF6] text-[#3B3750] dark:bg-[#22212C] dark:text-[#D7D5E2]',
  /** Real elevation — only for things that float above the page. */
  float:
    'shadow-[0_16px_48px_-16px_rgba(20,16,48,0.28),0_2px_8px_-2px_rgba(20,16,48,0.10)] dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7)]',
} as const;

/* ── The four ladders ────────────────────────────────────────────────── */

/**
 * Control heights. Three steps, and each one owns a role — the point is that
 * an operator can tell what a control *does* from how tall it is.
 *
 *   24 — inline: lives inside a table row or a dense list, never alone.
 *   28 — toolbar: filters, search, view controls. The console's workhorse.
 *   32 — page: screen actions, form inputs. The only size that starts a task.
 */
export const STEP = { inline: 24, toolbar: 28, page: 32 } as const;
export type StepName = keyof typeof STEP;

/**
 * Type scale. Five steps, each with a locked line-height on the 4px grid.
 * A sixth size is not a design decision, it is a bug.
 *
 * 12 is the floor and it is a *conditional* floor: only usable at weight 600
 * or above (see the header note). Everything the console renders at 12 —
 * column headers, chip labels, table metadata, badges — is bold or semibold
 * for that reason, not for emphasis.
 */
export const SIZE = {
  /** 12/16 — column headers, chips, badges, table metadata. Weight ≥ 600. */
  label: 12,
  /** 13/20 — body copy, primary table cells, page-level control text. */
  body: 13,
  /** 15/20 — panel and section titles. */
  title: 15,
  /** 20/28 — screen title, KPI value. */
  display: 20,
  /** 28/32 — the one hero figure a screen is allowed. */
  hero: 28,
} as const;

/** Spacing grid. Nothing between these values, ever. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 } as const;

/**
 * Radii, concentric: a control inside a panel must curve *less* than the
 * panel, or the gap between the two curves reads as a manufacturing defect.
 */
export const RADIUS = { tag: 4, inline: 6, control: 8, panel: 12 } as const;

/* ── Type ────────────────────────────────────────────────────────────── */

/**
 * The six type steps as Tailwind classes. Sizes and line-heights are written
 * out rather than composed so a reader can see the whole scale at once.
 */
export const DT = {
  /** 28/32 — hero figure. */
  hero: 'text-[28px] font-extrabold leading-8 tracking-[-0.022em]',
  /** 20/28 — screen title. One per screen. */
  display: 'text-[20px] font-extrabold leading-7 tracking-[-0.018em]',
  /** 15/20 — card and section title. */
  title: 'text-[15px] font-bold leading-5 tracking-[-0.006em]',
  /** 13/20 — default body copy and primary table cells. */
  body: 'text-[13px] leading-5',
  /** 12/16 — secondary line under a title, table metadata. Semibold: 12 is
   *  only legible at weight ≥ 600, so the weight is part of the token. */
  label: 'text-[12px] font-semibold leading-4',
  /** 12/16 — column headers and group headings. */
  micro: 'text-[12px] font-bold uppercase leading-4 tracking-[0.05em]',
  /** 12/16 — references, IDs, anything the operator may copy. */
  mono: 'font-mono text-[12px] font-semibold leading-4 tracking-[-0.02em]',
} as const;

/**
 * Foreground ramp — four steps, no more.
 *
 * `muted` and `faint` carry real content in this console (column headers, units,
 * hints), so both are tuned to clear WCAG AA 4.5:1 on all three surfaces
 * (canvas / card / well) in both themes — the first pass shipped #7C7791
 * (3.90:1 on canvas) and #A5A1B5 (2.29:1), which were unreadable at 11-12px.
 */
export const DFG = {
  strong: 'text-[#15131F] dark:text-[#F3F2F8]',
  base: 'text-[#3B3750] dark:text-[#C9C6D6]',
  muted: 'text-[#6A6580] dark:text-[#9C98B0]',
  faint: 'text-[#767187] dark:text-[#8B8799]',
} as const;

/** Brand accent — links, active nav, focus, the one "go" colour. */
export const DACCENT = {
  text: 'text-[#6B5BD2] dark:text-[#A99BF0]',
  bg: 'bg-[#6B5BD2] dark:bg-[#7B6BE0]',
  soft: 'bg-[#6B5BD2]/[0.10] text-[#5B4CC4] dark:bg-[#A99BF0]/[0.14] dark:text-[#B9AEF5]',
  border: 'border-[#6B5BD2] dark:border-[#A99BF0]',
} as const;

/**
 * Focus ring — identical on every interactive element in the console.
 *
 * Full-opacity accent (5.18:1 on white) so it satisfies WCAG 2.2 SC 2.4.11;
 * no coloured ring-offset, because focusable elements sit on three different
 * surfaces and a fixed offset colour paints a halo on two of them; and an
 * `outline` fallback for forced-colors mode, where box-shadow rings are dropped
 * and the element would otherwise have no focus indicator at all.
 */
export const DFOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B5BD2] dark:focus-visible:ring-[#A99BF0] ' +
  'forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2';

/** Unread / actionable count badge. One definition for rail, tabs and bell. */
export const DBADGE =
  'bg-[#D8410A] text-white dark:bg-[#FF7A3D] dark:text-[#2A1206]';

/* ── The control geometry table ──────────────────────────────────────── */

/**
 * Everything a control needs to be drawn, derived from its step.
 *
 * This is the heart of the contract. `Button`, `IconButton`, `Chip`,
 * `Segment`, `Input` and `Select` all read from here, which is what makes
 * "same row → same height → same optical centre" a structural property
 * rather than something to remember during review.
 *
 * `padX` is chosen so the *text* is optically centred: a 28px control with
 * 10px of padding and a 12px label has 8px of ink either side of the glyph
 * box, which reads as balanced next to a 28px square icon button.
 */
export interface ControlGeometry {
  /** Rendered height in px — one of STEP. */
  h: number;
  /** Horizontal padding for a label-bearing control. */
  padX: number;
  /** Corner radius. */
  radius: number;
  /** Label size — one of SIZE. */
  font: number;
  /** Glyph box for a leading icon. */
  icon: number;
  /** Gap between the icon and the label. */
  gap: number;
  /** Ready-made Tailwind for the box: height, padding, radius, font, gap. */
  box: string;
  /** Ready-made Tailwind for a square (icon-only) box. */
  square: string;
  /** Ready-made Tailwind for the glyph. */
  glyph: string;
}

export const CONTROL: Record<StepName, ControlGeometry> = {
  inline: {
    h: STEP.inline, padX: 8, radius: RADIUS.inline, font: SIZE.label, icon: 14, gap: 4,
    box: 'h-6 gap-1 rounded-md px-2 text-[12px]',
    square: 'h-6 w-6 rounded-md',
    glyph: 'h-3.5 w-3.5',
  },
  toolbar: {
    h: STEP.toolbar, padX: 10, radius: RADIUS.control, font: SIZE.label, icon: 14, gap: 6,
    box: 'h-7 gap-1.5 rounded-lg px-2.5 text-[12px]',
    square: 'h-7 w-7 rounded-lg',
    glyph: 'h-3.5 w-3.5',
  },
  page: {
    h: STEP.page, padX: 12, radius: RADIUS.control, font: SIZE.body, icon: 16, gap: 6,
    box: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
    square: 'h-8 w-8 rounded-lg',
    glyph: 'h-4 w-4',
  },
};

/* ── Density ─────────────────────────────────────────────────────────── */

export type Density = 'compact' | 'cosy';

/**
 * Table geometry per density. The header is the `page` step (32px) in both,
 * so a table header lines up with the toolbar above it.
 *
 * Rows are `min-h`, never `h`. WCAG 2.2 SC 1.4.12 requires the layout to
 * survive the user applying line-height 1.5×, letter-spacing 0.12em and
 * word-spacing 0.16em *simultaneously* without losing content — a fixed row
 * height clips the text instead of growing, and is the criterion dense tables
 * fail most often. 36px also clears the 32px floor that inline row actions
 * need under SC 2.5.8.
 */
export const DENSITY: Record<Density, { row: string; cell: string; head: string; rowPx: number }> = {
  compact: { row: 'min-h-9', cell: 'px-3 py-1.5', head: 'h-8 px-3', rowPx: 36 },
  cosy: { row: 'min-h-11', cell: 'px-3 py-2', head: 'h-8 px-3', rowPx: 44 },
};

/* ── Layout ──────────────────────────────────────────────────────────── */

export const LAYOUT = {
  /** Sidebar width, expanded / collapsed. Both land on the 4px grid. */
  railExpanded: 236,
  railCollapsed: 60,
  /** Inspector (right master–detail panel) width. */
  inspector: 460,
  /**
   * Viewport width from which the inspector can be docked beside the list.
   * Below it the panel would leave the table under ~530px, so it overlays
   * instead — the shell itself starts at 1024 (see useIsDesktop).
   */
  inspectorDockAt: 1280,
  /** Topbar height. */
  topbar: 52,
  /** Horizontal breathing room on every screen. */
  gutter: SPACE[6],
} as const;
