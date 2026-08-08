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
 * Rule of thumb when editing:
 *   · colour carries meaning, never decoration
 *   · separation is a hairline, not a shadow (shadows only for things that
 *     genuinely float: menus, popovers, drag ghosts)
 *   · every number here comes from the 4px grid
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

/* ── Type ────────────────────────────────────────────────────────────── */

export const DT = {
  /** Page title. One per screen. */
  display: 'text-[21px] font-extrabold leading-7 tracking-[-0.02em]',
  /** Card / section title. */
  title: 'text-[14px] font-bold leading-5',
  /** Default body copy. */
  body: 'text-[13px] leading-[18px]',
  /** Secondary line under a title, table cells. */
  label: 'text-[12px] leading-4',
  /** Column headers, group headings. */
  micro: 'text-[10.5px] font-bold uppercase leading-4 tracking-[0.07em]',
  /** Hints, units, badge text — the smallest step that still carries meaning. */
  tiny: 'text-[11px] leading-4',
  /** References, IDs, anything the operator may copy. */
  mono: 'font-mono text-[11.5px] tracking-[-0.01em]',
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

/* ── Density ─────────────────────────────────────────────────────────── */

export type Density = 'compact' | 'cosy';

/** Row heights and cell padding per density — used by DataTable. */
export const DENSITY: Record<Density, { row: string; cell: string; head: string }> = {
  compact: { row: 'h-9', cell: 'px-3 py-0', head: 'h-8 px-3' },
  cosy: { row: 'h-[46px]', cell: 'px-3.5 py-0', head: 'h-9 px-3.5' },
};

/* ── Layout ──────────────────────────────────────────────────────────── */

export const LAYOUT = {
  /** Sidebar width, expanded / collapsed. */
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
} as const;
